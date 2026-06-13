"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

export default function FinancePaymentsPage() {
  const params = useParams();
  const router = useRouter();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, [branch]);

  const totalPages = Math.max(1, Math.ceil(payments.length / ITEMS_PER_PAGE));

  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return payments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [payments, currentPage]);

  async function loadPayments() {
    setLoading(true);

    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setPayments([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("finance_payments")
      .select(
        `
        *,
        finance_contracts(
          id,
          customer_id,
          contract_number,
          customer_name,
          customer_phone,
          debt_amount,
          payment_amount,
          paid_amount,
          remaining_amount,
          payment_due_date,
          contract_status,
          finance_customers(full_name, national_id)
        )
      `
      )
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    if (error) {
      alert("تعذر تحميل عمليات السداد: " + error.message);
      setPayments([]);
      setLoading(false);
      return;
    }

    setPayments(data || []);
    setCurrentPage(1);
    setLoading(false);
  }

  function getEmployeeName() {
    if (typeof window === "undefined") return "المدير";

    const newName = localStorage.getItem("finance_user_name");
    if (newName) return newName;

    const oldUser = localStorage.getItem("finance_user");

    if (oldUser) {
      try {
        const parsed = JSON.parse(oldUser);
        return parsed?.full_name || parsed?.username || "المدير";
      } catch {
        return "المدير";
      }
    }

    return "المدير";
  }

  function getStatusAfterUpdate(remainingAmount: number, dueDate?: string | null) {
    if (remainingAmount <= 0) return "تم السداد";

    if (isDateDue(dueDate)) return "متأخر";

    return "نشط";
  }

  async function cancelPayment(payment: any) {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    if (payment.is_cancelled) {
      alert("عملية السداد ملغية مسبقًا");
      return;
    }

    const contract = payment.finance_contracts;

    if (!contract) {
      alert("تعذر العثور على العقد المرتبط بعملية السداد");
      return;
    }

    const confirmed = confirm(
      `هل تريد إلغاء عملية السداد بمبلغ ${formatMoney(
        payment.payment_amount || 0
      )} ر.س؟`
    );

    if (!confirmed) return;

    const paymentAmount = Number(payment.payment_amount || 0);
    const oldPaid = Number(contract.paid_amount || 0);
    const debt = Number(
      contract.debt_amount ||
        contract.payment_amount ||
        oldPaid + Number(contract.remaining_amount || 0) ||
        0
    );

    const newPaid = Math.max(oldPaid - paymentAmount, 0);
    const newRemaining = Math.max(debt - newPaid, 0);
    const newStatus = getStatusAfterUpdate(
      newRemaining,
      contract.payment_due_date
    );

    const { error: paymentError } = await supabase
      .from("finance_payments")
      .update({
        is_cancelled: true,
      })
      .eq("id", payment.id)
      .eq("branch_id", branchId);

    if (paymentError) {
      alert(paymentError.message || "تعذر إلغاء عملية السداد");
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
      .eq("id", payment.contract_id)
      .eq("branch_id", branchId);

    if (contractError) {
      alert("تم إلغاء السداد، لكن تعذر تحديث العقد: " + contractError.message);
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        branch_id: branchId,
        activity_type: "إلغاء سداد",
        description: `تم إلغاء عملية سداد بمبلغ ${paymentAmount} ر.س للعقد رقم ${
          contract.contract_number || "-"
        }`,
        customer_id: contract.customer_id,
        contract_id: payment.contract_id,
        payment_id: payment.id,
        customer_name:
          contract.customer_name ||
          contract.finance_customers?.full_name ||
          "",
        employee_name: getEmployeeName(),
        status: newStatus,
      },
    ]);

    alert("تم إلغاء عملية السداد بنجاح");
    await loadPayments();
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <header style={header}>
          <div style={headerActions}>
            <button style={backButton} onClick={() => router.back()}>
              ← الرجوع
            </button>

            <button
              style={homeButton}
              onClick={() => router.push(`/finance/${branch}`)}
            >
              محطة العمل الرئيسية
            </button>
          </div>

          <div>
            <p style={headerLabel}>محطة العمل</p>
            <h1 style={headerTitle}>سداد</h1>
            <p style={headerSub}>
              متابعة عمليات السداد، إلغاء العمليات عند الحاجة، وربطها بالعقود
              وسير العمل.
            </p>
          </div>
        </header>

        <section style={actionsSection}>
          <button
            style={actionButton}
            onClick={() => router.push(`/finance/${branch}/payments/new`)}
          >
            <span style={actionIcon}>💳</span>
            <span>
              <strong>إجراء سداد</strong>
              <small>تسجيل دفعة جديدة على عقد</small>
            </span>
          </button>

          <button
            style={actionButton}
            onClick={() =>
              alert("لإلغاء عملية سداد، اضغط زر إلغاء بجانب العملية المطلوبة.")
            }
          >
            <span style={actionIcon}>⛔</span>
            <span>
              <strong>إلغاء عملية سداد</strong>
              <small>من جدول العمليات بالأسفل</small>
            </span>
          </button>
        </section>

        <section style={card}>
          <div style={listHeader}>
            <div>
              <p style={sectionKicker}>السداد</p>
              <h2 style={sectionTitle}>عمليات السداد</h2>
            </div>

            {payments.length > 0 && (
              <span style={pageInfo}>
                صفحة {currentPage} من {totalPages} - عرض{" "}
                {paginatedPayments.length} من {payments.length}
              </span>
            )}
          </div>

          <div className="desktop-table" style={tableBox}>
            <div style={tableHeader}>
              <span>العميل</span>
              <span>رقم العقد</span>
              <span>المبلغ</span>
              <span>طريقة الدفع</span>
              <span>نوع السداد</span>
              <span>الإجراء</span>
            </div>

            {loading ? (
              <div style={emptyBox}>جاري تحميل عمليات السداد...</div>
            ) : payments.length === 0 ? (
              <div style={emptyBox}>لا توجد عمليات سداد حتى الآن</div>
            ) : (
              paginatedPayments.map((payment) => {
                const contract = payment.finance_contracts;
                const customerName =
                  contract?.customer_name ||
                  contract?.finance_customers?.full_name ||
                  "-";

                return (
                  <div
                    key={payment.id}
                    style={{
                      ...tableRow,
                      opacity: payment.is_cancelled ? 0.55 : 1,
                    }}
                    onClick={() => {
                      if (payment.contract_id) {
                        router.push(
                          `/finance/${branch}/contracts/${payment.contract_id}`
                        );
                      }
                    }}
                  >
                    <span
                      style={customerLink}
                      onClick={(e) => {
                        e.stopPropagation();

                        if (contract?.customer_id) {
                          router.push(
                            `/finance/${branch}/customers/${contract.customer_id}`
                          );
                        }
                      }}
                    >
                      {customerName}
                    </span>

                    <span>{contract?.contract_number || "-"}</span>
                    <span>{formatMoney(payment.payment_amount)} ر.س</span>
                    <span>{payment.notes || "-"}</span>
                    <span>
                      {payment.is_cancelled
                        ? "ملغية"
                        : payment.payment_type || "-"}
                    </span>

                    <span>
                      {payment.is_cancelled ? (
                        <span style={cancelledBadge}>ملغية</span>
                      ) : (
                        <button
                          style={cancelButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelPayment(payment);
                          }}
                        >
                          إلغاء
                        </button>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="mobile-cards">
            {loading ? (
              <div style={emptyBox}>جاري تحميل عمليات السداد...</div>
            ) : payments.length === 0 ? (
              <div style={emptyBox}>لا توجد عمليات سداد حتى الآن</div>
            ) : (
              paginatedPayments.map((payment) => {
                const contract = payment.finance_contracts;
                const customerName =
                  contract?.customer_name ||
                  contract?.finance_customers?.full_name ||
                  "-";

                return (
                  <article key={payment.id} style={mobileCard}>
                    <div style={mobileCardTop}>
                      <strong>{customerName}</strong>
                      {payment.is_cancelled ? (
                        <span style={cancelledBadge}>ملغية</span>
                      ) : (
                        <span style={successBadge}>مسجلة</span>
                      )}
                    </div>

                    <span>رقم العقد: {contract?.contract_number || "-"}</span>
                    <span>المبلغ: {formatMoney(payment.payment_amount)} ر.س</span>
                    <span>طريقة الدفع: {payment.notes || "-"}</span>
                    <span>نوع السداد: {payment.payment_type || "-"}</span>

                    <div style={mobileActions}>
                      {payment.contract_id && (
                        <button
                          style={smallBlueButton}
                          onClick={() =>
                            router.push(
                              `/finance/${branch}/contracts/${payment.contract_id}`
                            )
                          }
                        >
                          فتح العقد
                        </button>
                      )}

                      {!payment.is_cancelled && (
                        <button
                          style={cancelButton}
                          onClick={() => cancelPayment(payment)}
                        >
                          إلغاء
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {payments.length > ITEMS_PER_PAGE && (
            <div style={paginationBox}>
              <button
                style={{
                  ...paginationButton,
                  opacity: currentPage === 1 ? 0.5 : 1,
                }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              >
                السابق
              </button>

              <span style={paginationText}>
                صفحة {currentPage} من {totalPages}
              </span>

              <button
                style={{
                  ...paginationButton,
                  opacity: currentPage === totalPages ? 0.5 : 1,
                }}
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(page + 1, totalPages))
                }
              >
                التالي
              </button>
            </div>
          )}
        </section>

        <div style={bottomActions}>
          <button style={backButton} onClick={() => router.back()}>
            ← الرجوع
          </button>

          <button
            style={homeButton}
            onClick={() => router.push(`/finance/${branch}`)}
          >
            محطة العمل الرئيسية
          </button>
        </div>
      </div>

      <GlobalResponsiveStyles />
    </main>
  );
}

function isDateDue(date?: string | null) {
  if (!date) return false;

  const dueDate = new Date(date);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return dueDate <= today;
}

function formatMoney(value: any) {
  const number = Number(value || 0);
  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      .mobile-cards {
        display: none;
      }

      @media (max-width: 760px) {
        .desktop-table {
          display: none !important;
        }

        .mobile-cards {
          display: grid !important;
          gap: 10px;
        }
      }
    `}</style>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#f4f7fb",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
  color: "#0f172a",
};

const container: CSSProperties = {
  width: "100%",
  maxWidth: 1150,
  margin: "auto",
};

const header: CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  padding: 24,
  borderRadius: 24,
  marginBottom: 18,
  boxShadow: "0 14px 30px rgba(15,23,42,.16)",
};

const headerActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "space-between",
  marginBottom: 18,
};

const headerLabel: CSSProperties = {
  margin: 0,
  color: "#bfdbfe",
  fontWeight: 800,
};

const headerTitle: CSSProperties = {
  margin: "4px 0",
  fontSize: 34,
  lineHeight: 1.4,
};

const headerSub: CSSProperties = {
  margin: 0,
  color: "#dbeafe",
  lineHeight: 1.8,
};

const backButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.20)",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,.20)",
};

const homeButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.20)",
  background: "linear-gradient(135deg,#16a34a,#15803d)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(21,128,61,.25)",
};

const actionsSection: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const actionButton: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 18,
  cursor: "pointer",
  color: "#0f172a",
  display: "flex",
  alignItems: "center",
  gap: 12,
  textAlign: "right",
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const actionIcon: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const card: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const listHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  flexWrap: "wrap",
};

const sectionKicker: CSSProperties = {
  margin: 0,
  color: "#2563eb",
  fontWeight: 900,
  fontSize: 13,
};

const sectionTitle: CSSProperties = {
  margin: "4px 0",
  fontSize: 22,
  color: "#0f172a",
};

const pageInfo: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: 900,
};

const tableBox: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
  gap: 12,
  minWidth: 980,
  background: "#f1f5f9",
  color: "#1e3a8a",
  fontWeight: 900,
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr",
  gap: 12,
  minWidth: 980,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  cursor: "pointer",
  alignItems: "center",
};

const customerLink: CSSProperties = {
  cursor: "pointer",
  color: "#1d4ed8",
  fontWeight: 900,
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  textAlign: "center",
  color: "#6b7280",
};

const cancelButton: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const cancelledBadge: CSSProperties = {
  background: "#e5e7eb",
  color: "#6b7280",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: 900,
  width: "fit-content",
};

const successBadge: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: 900,
  width: "fit-content",
};

const paginationBox: CSSProperties = {
  marginTop: 18,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const paginationButton: CSSProperties = {
  padding: "10px 16px",
  background: "#1e3a8a",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const paginationText: CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const mobileCard: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 13,
  background: "#f8fafc",
  display: "grid",
  gap: 7,
};

const mobileCardTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
};

const mobileActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 8,
};

const smallBlueButton: CSSProperties = {
  border: "none",
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 10,
  padding: "8px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const bottomActions: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 18,
};
