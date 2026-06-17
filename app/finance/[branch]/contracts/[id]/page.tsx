"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

type ScreenType = "mobile" | "tablet" | "desktop";

export default function FinanceContractDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;
  const contractId = params.id as string;

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [contract, setContract] = useState<any>(null);
  const [note, setNote] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      const width = window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 980) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    updateScreen();
    window.addEventListener("resize", updateScreen);

    return () => window.removeEventListener("resize", updateScreen);
  }, []);

  useEffect(() => {
    loadEmployeeName();
    loadData();
  }, [branch, contractId]);

  function loadEmployeeName() {
    if (typeof window === "undefined") return;

    const newName = localStorage.getItem("finance_user_name");

    if (newName) {
      setEmployeeName(newName);
      return;
    }

    const oldUser = localStorage.getItem("finance_user");

    if (oldUser) {
      try {
        const parsed = JSON.parse(oldUser);
        setEmployeeName(parsed?.full_name || parsed?.username || "الموظف");
      } catch {
        setEmployeeName("الموظف");
      }
    }
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_branch_user");
    }

    router.push(`/finance/${branch}/login`);
  }

  async function loadData() {
    setLoading(true);

    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setContract(null);
      setNote(null);
      setPayments([]);
      setLoading(false);
      return;
    }

    const { data: contractData } = await supabase
      .from("finance_contracts")
      .select(
        `
        *,
        finance_customers(
          full_name,
          national_id,
          phone,
          birth_hijri,
          work,
          work_name,
          address
        )
      `
      )
      .eq("id", contractId)
      .eq("branch_id", currentBranchId)
      .single();

    const { data: noteData } = await supabase
      .from("finance_promissory_notes")
      .select("*")
      .eq("contract_id", contractId)
      .eq("branch_id", currentBranchId)
      .maybeSingle();

    const { data: paymentsData } = await supabase
      .from("finance_payments")
      .select("*")
      .eq("contract_id", contractId)
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    setContract(contractData);
    setNote(noteData);
    setPayments(paymentsData || []);
    setLoading(false);
  }

  async function cancelPayment(payment: any) {
    if (!branchId || !contract) {
      alert("تعذر تحديد العقد أو الفرع");
      return;
    }

    if (payment.is_cancelled) {
      alert("تم إلغاء هذه الدفعة مسبقًا");
      return;
    }

    const confirmed = confirm("هل أنت متأكد من إلغاء الدفعة؟");
    if (!confirmed) return;

    const currentPaid = Number(contract?.paid_amount || 0);
    const totalPayment = Number(contract?.payment_amount || 0);
    const paymentAmount = Number(payment.payment_amount || 0);

    const newPaid = Math.max(currentPaid - paymentAmount, 0);
    const newRemaining = Math.max(totalPayment - newPaid, 0);
    const newStatus = newRemaining <= 0 ? "تم السداد" : "نشط";

    const { error: paymentError } = await supabase
      .from("finance_payments")
      .update({
        is_cancelled: true,
        cancelled_at: new Date().toISOString(),
        cancelled_by: "المدير",
      })
      .eq("id", payment.id)
      .eq("branch_id", branchId);

    if (paymentError) {
      alert("تعذر إلغاء الدفعة");
      return;
    }

    const { error: contractError } = await supabase
      .from("finance_contracts")
      .update({
        paid_amount: newPaid,
        remaining_amount: newRemaining,
        contract_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .eq("branch_id", branchId);

    if (contractError) {
      alert("تم إلغاء الدفعة، لكن تعذر تحديث العقد");
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        branch_id: branchId,
        activity_type: "إلغاء دفعة",
        description: `تم إلغاء دفعة للعميل ${getCustomerName()} بمبلغ ${paymentAmount} ر.س`,
        customer_id: contract?.customer_id,
        contract_id: contractId,
        payment_id: payment.id,
        customer_name: getCustomerName(),
        employee_name: "المدير",
        status: newStatus,
      },
    ]);

    await loadData();
    alert("تم إلغاء الدفعة");
  }

  async function closeContract() {
    if (!branchId || !contract) {
      alert("تعذر تحديد العقد أو الفرع");
      return;
    }

    const confirmed = confirm("هل أنت متأكد من إغلاق العقد كسداد كامل؟");
    if (!confirmed) return;

    const totalPayment = Number(contract?.payment_amount || 0);

    const { error } = await supabase
      .from("finance_contracts")
      .update({
        contract_status: "تم السداد",
        paid_amount: totalPayment,
        remaining_amount: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .eq("branch_id", branchId);

    if (error) {
      alert("تعذر إغلاق العقد");
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        branch_id: branchId,
        activity_type: "إغلاق عقد",
        description: `تم إغلاق عقد العميل ${getCustomerName()} كسداد كامل`,
        customer_id: contract?.customer_id,
        contract_id: contractId,
        customer_name: getCustomerName(),
        employee_name: "المدير",
        status: "تم السداد",
      },
    ]);

    await loadData();
    alert("تم إغلاق العقد كسداد كامل");
  }

  function openCustomerProfile() {
    if (!contract?.customer_id) {
      alert("لا يوجد رقم عميل مرتبط بهذا العقد");
      return;
    }

    router.push(`/finance/${branch}/customers/${contract.customer_id}`);
  }

  function getCustomerName() {
    return (
      contract?.finance_customers?.full_name ||
      contract?.customer_name ||
      "-"
    );
  }

  function getCustomerNationalId() {
    return (
      contract?.finance_customers?.national_id ||
      contract?.customer_national_id ||
      "-"
    );
  }

  function getCustomerPhone() {
    return (
      contract?.finance_customers?.phone ||
      contract?.customer_phone ||
      "-"
    );
  }

  function getCustomerBirthHijri() {
    return (
      contract?.finance_customers?.birth_hijri ||
      contract?.customer_birth_hijri ||
      "-"
    );
  }

  function getCustomerWorkName() {
    return (
      contract?.finance_customers?.work_name ||
      contract?.finance_customers?.work ||
      contract?.customer_work_name ||
      "-"
    );
  }

  function getCustomerAddress() {
    return contract?.finance_customers?.address || "-";
  }

  function formatDate(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleString("ar-SA-u-ca-gregory", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function formatDateOnly(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("ar-SA-u-ca-gregory");
  }

  function statusStyle(status: string) {
    if (status === "تم السداد") return paidStatus;
    if (status === "متأخر") return lateStatus;
    if (status === "ملغي") return cancelledStatus;
    return activeStatus;
  }

  if (loading) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <section style={getHeroStyle(isMobile)}>
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div style={getHeroContentStyle(screen)}>
              <div style={getHeroTitleBoxStyle(screen)}>
                <h1 style={getTitleStyle(screen)}>جاري تحميل العقد...</h1>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!contract) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <section style={getHeroStyle(isMobile)}>
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div style={getHeroContentStyle(screen)}>
              <div style={getHeroTitleBoxStyle(screen)}>
                <h1 style={getTitleStyle(screen)}>لم يتم العثور على العقد</h1>
              </div>
            </div>
          </section>

          <div style={backWrapper}>
            <button style={backButton} onClick={() => router.back()}>
              ← رجوع
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isFullyPaid =
    Number(contract?.remaining_amount || 0) <= 0 ||
    contract?.contract_status === "تم السداد";

  const hasDeferredPayments =
    Boolean(contract?.has_deferred_payments) ||
    Number(contract?.installment_amount || 0) > 0;

  const hasGuarantor = Boolean(contract?.has_guarantor);

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <header style={getHeroStyle(isMobile)}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={getHeroContentStyle(screen)}>
            <div style={getHeroUserCardStyle(screen)}>
              <div style={getEmployeeTopRowStyle(screen)}>
                <div style={employeeIcon}>
                  <UserIcon />
                </div>

                <div style={getEmployeeNameStyle(isMobile)}>
                  {employeeName}
                </div>

                {!isMobile && <div style={employeeDividerSmall} />}

                <button style={logoutInlineButton} onClick={logout}>
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                style={getMainWorkstationButtonStyle(isMobile)}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>
                عقد رقم {contract?.contract_number || "-"}
              </h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)}>
              <span style={statusStyle(contract?.contract_status)}>
                {contract?.contract_status || "نشط"}
              </span>
            </div>
          </div>
        </header>

        <section style={summaryGrid}>
          <SummaryBox
            title="مبلغ الاستحقاق"
            value={`${contract?.payment_amount || 0} ر.س`}
          />
          <SummaryBox
            title="المسدد"
            value={`${contract?.paid_amount || 0} ر.س`}
          />
          <SummaryBox
            title="المتبقي"
            value={`${contract?.remaining_amount || 0} ر.س`}
          />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات العميل</h2>

          <Row
            label="العميل"
            value={
              <button style={customerNameButton} onClick={openCustomerProfile}>
                {getCustomerName()}
              </button>
            }
          />
          <Row label="رقم الهوية" value={getCustomerNationalId()} />
          <Row label="تاريخ الميلاد بالهجري" value={getCustomerBirthHijri()} />
          <Row label="رقم الجوال" value={getCustomerPhone()} />
          <Row label="العمل" value={getCustomerWorkName()} />
          <Row label="العنوان" value={getCustomerAddress()} />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات العقد</h2>

          <Row label="نوع التمويل" value={contract?.finance_type || "-"} />
          <Row label="المستثمر المرتبط بالمخزون" value={contract?.investor_name || "-"} />
          <Row label="المنتج" value={contract?.product_name || "-"} />
          <Row label="كمية المنتجات" value={contract?.product_quantity || "-"} />
          <Row label="الطرف الأول في الطباعة" value={contract?.print_party_name || "-"} />

          <Row
            label={
              contract?.print_party_type === "investor"
                ? "رقم هوية الطرف الأول"
                : "السجل التجاري للطرف الأول"
            }
            value={contract?.print_party_identifier || "-"}
          />

          <Row label="مبلغ الدين" value={`${contract?.debt_amount || 0} ر.س`} />
          <Row label="مبلغ السداد" value={`${contract?.payment_amount || 0} ر.س`} />
          <Row label="تاريخ الاستحقاق" value={contract?.payment_due_date || "-"} />
          <Row label="مدينة التقاضي" value={contract?.legal_city || "-"} />
          <Row label="تاريخ تحرير العقد" value={contract?.contract_issue_date_gregorian || contract?.contract_date_gregorian || "-"} />
          <Row label="الموظف المنشئ" value={contract?.created_by || "-"} />
          <Row label="تاريخ الإنشاء" value={formatDate(contract?.created_at)} />
          <Row label="آخر تحديث" value={formatDate(contract?.updated_at)} />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>الدفعات الآجلة</h2>

          {hasDeferredPayments ? (
            <>
              <Row
                label="قيمة الدفعة الآجلة"
                value={`${contract?.installment_amount || 0} ر.س`}
              />
              <Row
                label="عدد الدفعات الآجلة"
                value={`${contract?.deferred_payments_count || 0} دفعات`}
              />
            </>
          ) : (
            <div style={emptyBox}>لا توجد دفعات آجلة لهذا العقد</div>
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات الكفيل</h2>

          {hasGuarantor ? (
            <>
              <Row label="اسم الكفيل" value={contract?.guarantor_name || "-"} />
              <Row label="رقم هوية الكفيل" value={contract?.guarantor_national_id || "-"} />
              <Row label="رقم جوال الكفيل" value={contract?.guarantor_phone || "-"} />
              <Row label="تاريخ ميلاد الكفيل" value={contract?.guarantor_birth_hijri || "-"} />
            </>
          ) : (
            <div style={emptyBox}>لا يوجد كفيل لهذا العقد</div>
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>السند المرتبط</h2>

          {note ? (
            <>
              <Row label="رقم السند" value={note?.note_number || "-"} />
              <Row label="مبلغ السند" value={`${note?.amount || 0} ر.س`} />
              <Row label="تاريخ الاستحقاق" value={note?.due_date || "-"} />
              <Row label="حالة السند" value={note?.status || "-"} />
            </>
          ) : (
            <div style={emptyBox}>لا يوجد سند مرتبط بهذا العقد</div>
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>سجل الدفعات</h2>

          {payments.length === 0 ? (
            <div style={emptyBox}>لا توجد دفعات مسجلة</div>
          ) : (
            payments.map((payment) => (
              <div
                key={payment.id}
                className="payment-row"
                style={{
                  ...paymentRow,
                  opacity: payment.is_cancelled ? 0.6 : 1,
                }}
              >
                <span>💰 {payment.payment_amount} ر.س</span>

                <span>
                  {payment.is_cancelled
                    ? "❌ ملغية"
                    : `💳 ${payment.payment_type || "-"}`}
                </span>

                <span>📅 {formatDateOnly(payment.created_at)}</span>

                <div className="payment-actions" style={paymentActions}>
                  <button
                    style={receiptButton}
                    onClick={() =>
                      router.push(`/finance/${branch}/payments/receipt/${payment.id}`)
                    }
                    disabled={payment.is_cancelled}
                  >
                    🧾 طباعة الإيصال
                  </button>

                  <button
                    style={cancelButton}
                    onClick={() => cancelPayment(payment)}
                    disabled={payment.is_cancelled}
                  >
                    ⛔ إلغاء
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <section style={actionsSection}>
          {!isFullyPaid && (
            <ActionButton
              icon="💳"
              title="تسجيل سداد"
              onClick={() =>
                router.push(`/finance/${branch}/payments/new?contract=${contractId}`)
              }
            />
          )}

          <ActionButton
            icon="✏️"
            title="تعديل العقد"
            onClick={() =>
              router.push(`/finance/${branch}/contracts/edit/${contractId}`)
            }
          />

          <ActionButton
            icon="🖨️"
            title="طباعة العقد"
            onClick={() =>
              router.push(`/finance/${branch}/contracts/print/${contractId}`)
            }
          />

          {note && (
            <ActionButton
              icon="🧾"
              title="طباعة العقد والسند"
              onClick={() =>
                router.push(`/finance/${branch}/new-request/print/${contractId}/${note.id}`)
              }
            />
          )}

          {note && (
            <ActionButton
              icon="📑"
              title="طباعة السند"
              onClick={() =>
                router.push(`/finance/${branch}/contracts/promissory-note/print/${note.id}`)
              }
            />
          )}

          {isFullyPaid && (
            <ActionButton
              icon="📄"
              title="طباعة المخالصة"
              onClick={() =>
                router.push(`/finance/${branch}/contracts/clearance/${contractId}`)
              }
            />
          )}

          {!isFullyPaid && (
            <ActionButton icon="🔒" title="إغلاق العقد" onClick={closeContract} />
          )}
        </section>

        <div style={backWrapper}>
          <button style={backButton} onClick={() => router.back()}>
            ← رجوع
          </button>
        </div>
      </div>

      <GlobalResponsiveStyles />
    </main>
  );
}

function Row({ label, value }: any) {
  return (
    <div style={row}>
      <span>{label}</span>
      <strong style={rowValue}>{value || "-"}</strong>
    </div>
  );
}

function SummaryBox({ title, value }: any) {
  return (
    <div style={summaryBox}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionButton({ icon, title, onClick }: any) {
  return (
    <button style={actionButton} onClick={onClick}>
      <span style={buttonContent}>
        <span style={buttonIcon}>{icon}</span>
        {title}
      </span>
    </button>
  );
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.8 20.2c.8-3.5 3.6-5.4 7.2-5.4s6.4 1.9 7.2 5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 7V5.8c0-1 .8-1.8 1.8-1.8h6.1c1 0 1.8.8 1.8 1.8v12.4c0 1-.8 1.8-1.8 1.8h-6.1c-1 0-1.8-.8-1.8-1.8V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.8 12h9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.8 8.8 4.6 12l3.2 3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.8 11.2 12 4.5l8.2 6.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 10.4v9.1h11.6v-9.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 19.5v-5.2h4v5.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        overflow-x: hidden;
      }

      @media (max-width: 760px) {
        .payment-row {
          grid-template-columns: 1fr !important;
        }

        .payment-actions {
          justify-content: stretch !important;
          flex-direction: column !important;
        }

        .payment-actions button {
          width: 100% !important;
        }
      }
    `}</style>
  );
}

function getPageStyle(isMobile: boolean): CSSProperties {
  return {
    minHeight: "100vh",
    backgroundColor: "#f6f9ff",
    backgroundImage: `
      radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
      radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%),
      radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%),
      linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
      url('/backgrounds/v13-finance-bg-1.png')
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: isMobile ? "scroll" : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

function getContainerStyle(isCompact: boolean): CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact ? 980 : 1180,
    margin: "auto",
  };
}

function getHeroStyle(isMobile: boolean): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile ? "auto" : 160,
    borderRadius: isMobile ? 20 : 24,
    padding: isMobile ? "18px 14px" : "22px 26px",
    marginBottom: 14,
    overflow: "hidden",
    border: "none",
    outline: "none",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    boxShadow: "none",
    isolation: "isolate",
  };
}

function getHeroContentStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "center",
      gap: 16,
      direction: "rtl",
    };
  }

  if (screen === "tablet") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "grid",
      gridTemplateColumns: "1fr",
      alignItems: "center",
      justifyItems: "center",
      gap: 18,
      direction: "rtl",
    };
  }

  return {
    position: "relative",
    zIndex: 3,
    minHeight: 116,
    display: "grid",
    gridTemplateColumns: "minmax(250px, 315px) 1fr minmax(220px, 315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      width: "100%",
      display: "grid",
      gap: 12,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  if (screen === "tablet") {
    return {
      width: "100%",
      maxWidth: 520,
      display: "grid",
      gap: 14,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  return {
    width: "100%",
    maxWidth: 315,
    display: "grid",
    gap: 24,
    direction: "ltr",
    justifySelf: "start",
  };
}

function getEmployeeTopRowStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      minHeight: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 10,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  if (screen === "tablet") {
    return {
      height: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  return {
    height: 42,
    display: "flex",
    alignItems: "center",
    gap: 14,
    direction: "ltr",
    color: "#ffffff",
  };
}

function getEmployeeNameStyle(isMobile: boolean): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow: "0 4px 10px rgba(15,23,42,0.18)",
  };
}

function getMainWorkstationButtonStyle(isMobile: boolean): CSSProperties {
  return {
    width: isMobile ? "100%" : 220,
    maxWidth: isMobile ? 280 : 220,
    height: 44,
    border: "none",
    background: "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "var(--font-almarai), sans-serif",
    boxShadow: "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(screen: ScreenType): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order: screen === "desktop" ? 0 : 1,
  };
}

function getTitleStyle(screen: ScreenType): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize: screen === "mobile" ? 24 : screen === "tablet" ? 26 : 28,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      order: 3,
    };
  }

  if (screen === "tablet") {
    return {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
    direction: "rtl",
  };
}

const employeeIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1.5px solid rgba(255,255,255,0.34)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
  flex: "0 0 auto",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.90)",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
  padding: 0,
  whiteSpace: "nowrap",
  direction: "rtl",
};

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 210,
  height: 210,
  right: -78,
  top: -85,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.075)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleTwo: CSSProperties = {
  position: "absolute",
  width: 245,
  height: 245,
  right: 145,
  bottom: -178,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.045)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleThree: CSSProperties = {
  position: "absolute",
  width: 150,
  height: 150,
  left: 380,
  top: -96,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.035)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroDots: CSSProperties = {
  position: "absolute",
  top: 28,
  right: 34,
  width: 84,
  height: 58,
  opacity: 0.24,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const summaryBox: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#0d47a1",
  fontWeight: "bold",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const card: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const sectionTitle: CSSProperties = {
  marginTop: 0,
  fontSize: 22,
  color: "#0d47a1",
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
  flexWrap: "wrap",
};

const rowValue: CSSProperties = {
  textAlign: "left",
};

const customerNameButton: CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: "#0d47a1",
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  textDecoration: "underline",
  fontFamily: "inherit",
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center",
  color: "#6b7280",
};

const paymentRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 260px",
  gap: 12,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const paymentActions: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

const receiptButton: CSSProperties = {
  background: "#e0f2fe",
  color: "#075985",
  border: "none",
  borderRadius: 12,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: "bold",
  fontFamily: "var(--font-almarai), sans-serif",
};

const cancelButton: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 12,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: "bold",
  fontFamily: "var(--font-almarai), sans-serif",
};

const actionsSection: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const actionButton: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  color: "#0d47a1",
  fontFamily: "var(--font-almarai), sans-serif",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const buttonContent: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const buttonIcon: CSSProperties = {
  fontSize: 20,
};

const activeStatus: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const lateStatus: CSSProperties = {
  background: "#ffedd5",
  color: "#9a3412",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const paidStatus: CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const cancelledStatus: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "11px 18px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily: "var(--font-almarai), sans-serif",
};
