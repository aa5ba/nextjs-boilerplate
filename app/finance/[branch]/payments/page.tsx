"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

export default function FinancePaymentsPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [payments, setPayments] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadPayments();
  }, [branch]);

  const totalPages = Math.max(1, Math.ceil(payments.length / ITEMS_PER_PAGE));

  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return payments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [payments, currentPage]);

  async function loadPayments() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setPayments([]);
      return;
    }

    const { data } = await supabase
      .from("finance_payments")
      .select(
        "*, finance_contracts(id, customer_id, contract_number, finance_customers(full_name, national_id))"
      )
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    setPayments(data || []);
    setCurrentPage(1);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>سداد</h1>
        </div>

        <section style={actionsSection}>
          <button
            style={actionButton}
            onClick={() =>
              (window.location.href = `/finance/${branch}/payments/new`)
            }
          >
            💳 إجراء سداد
          </button>

          <button style={actionButton}>⛔ إلغاء عملية سداد</button>
        </section>

        <section style={card}>
          <div style={listHeader}>
            <h2 style={sectionTitle}>عمليات السداد</h2>

            {payments.length > 0 && (
              <span style={pageInfo}>
                صفحة {currentPage} من {totalPages} - عرض{" "}
                {paginatedPayments.length} من {payments.length}
              </span>
            )}
          </div>

          <div style={tableHeader}>
            <span>العميل</span>
            <span>رقم العقد</span>
            <span>المبلغ</span>
            <span>طريقة الدفع</span>
            <span>نوع السداد</span>
          </div>

          {payments.length === 0 ? (
            <div style={emptyBox}>لا توجد عمليات سداد حتى الآن</div>
          ) : (
            paginatedPayments.map((payment) => (
              <div
                key={payment.id}
                style={{
                  ...tableRow,
                  opacity: payment.is_cancelled ? 0.6 : 1,
                }}
                onClick={() =>
                  payment.finance_contracts?.contract_number &&
                  (window.location.href = `/finance/${branch}/contracts/${payment.contract_id}`)
                }
              >
                <span
                  style={{
                    cursor: "pointer",
                    color: "#0d47a1",
                    fontWeight: "bold",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();

                    window.location.href = `/finance/${branch}/customers/${payment.finance_contracts?.customer_id}`;
                  }}
                >
                  {payment.finance_contracts?.finance_customers?.full_name ||
                    "-"}
                </span>

                <span>{payment.finance_contracts?.contract_number || "-"}</span>

                <span>{payment.payment_amount || 0} ر.س</span>

                <span>{payment.notes || "-"}</span>

                <span>
                  {payment.is_cancelled
                    ? "ملغية"
                    : payment.payment_type || "-"}
                </span>
              </div>
            ))
          )}

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

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}`)}
        >
          الرجوع لمحطة العمل الرئيسية
        </button>
      </div>
    </main>
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
};

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
  marginBottom: 18,
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

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  overflowX: "auto" as const,
};

const listHeader = {
  minWidth: 850,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const sectionTitle = {
  margin: 0,
  fontSize: 22,
  color: "#0d47a1",
};

const pageInfo = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: "bold",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
  gap: 12,
  minWidth: 850,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
  gap: 12,
  minWidth: 850,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  cursor: "pointer",
};

const emptyBox = {
  minWidth: 850,
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  textAlign: "center" as const,
  color: "#6b7280",
};

const paginationBox = {
  minWidth: 850,
  marginTop: 18,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const paginationButton = {
  padding: "11px 18px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
};

const paginationText = {
  color: "#0f172a",
  fontWeight: "bold",
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#16a34a",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(22,163,74,0.25)",
};
