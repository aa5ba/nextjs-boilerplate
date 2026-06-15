"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function FinanceContractDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;
  const contractId = params.id as string;

  const [contract, setContract] = useState<any>(null);
  const [note, setNote] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [branch, contractId]);

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
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل العقد...</div>
      </main>
    );
  }

  if (!contract) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>لم يتم العثور على العقد</div>
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
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <div>
            <h1 style={{ margin: 0 }}>
              عقد رقم {contract?.contract_number || "-"}
            </h1>
            <div style={headerSubText}>تفاصيل العقد وسجل الدفعات</div>
          </div>

          <span style={statusStyle(contract?.contract_status)}>
            {contract?.contract_status || "نشط"}
          </span>
        </div>

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

                <div style={paymentActions}>
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
            رجوع
          </button>

          <button
            style={backButton}
            onClick={() => router.push(`/finance/${branch}`)}
          >
            محطة العمل الرئيسية
          </button>
        </div>
      </div>
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

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
};

const headerSubText = {
  marginTop: 8,
  fontSize: 14,
  opacity: 0.9,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const summaryBox = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: "#0d47a1",
  fontWeight: "bold",
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
};

const sectionTitle = {
  marginTop: 0,
  fontSize: 22,
  color: "#0d47a1",
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
};

const rowValue = {
  textAlign: "left" as const,
};

const customerNameButton = {
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

const emptyBox = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center" as const,
  color: "#6b7280",
};

const paymentRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 260px",
  gap: 12,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const paymentActions = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

const receiptButton = {
  background: "#e0f2fe",
  color: "#075985",
  border: "none",
  borderRadius: 12,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: "bold",
};

const cancelButton = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 12,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: "bold",
};

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const actionButton = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  color: "#0d47a1",
};

const buttonContent = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const buttonIcon = {
  fontSize: 20,
};

const activeStatus = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const lateStatus = {
  background: "#ffedd5",
  color: "#9a3412",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const paidStatus = {
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const cancelledStatus = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const backWrapper = {
  display: "flex",
  justifyContent: "flex-start",
  gap: 10,
  marginTop: 18,
  flexWrap: "wrap" as const,
};

const backButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "11px 18px",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(51,65,85,0.22)",
};

const loadingBox = {
  textAlign: "center" as const,
  paddingTop: 80,
  fontSize: 18,
};
