"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

type ExpenseInvoice = {
  id: string;
  branch_id: string;
  invoice_title: string;
  invoice_amount: number;
  invoice_details: string | null;
  invoice_date: string;
  payment_method: string | null;
  created_by_name: string | null;
  created_at: string;
};

export default function ExpensesPage() {
  const params = useParams();
  const router = useRouter();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<ExpenseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadInvoices();
  }, [branch]);

  async function loadInvoices() {
    setLoading(true);

    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("finance_expense_invoices")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("invoice_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      alert("تعذر تحميل الفواتير: " + error.message);
      setLoading(false);
      return;
    }

    setInvoices(data || []);
    setLoading(false);
  }

  const totalAmount = useMemo(() => {
    return invoices.reduce(
      (sum, item) => sum + Number(item.invoice_amount || 0),
      0
    );
  }, [invoices]);

  const totalPages = Math.max(1, Math.ceil(invoices.length / ITEMS_PER_PAGE));

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return invoices.slice(start, start + ITEMS_PER_PAGE);
  }, [invoices, currentPage]);

  function formatMoney(value: number) {
    return Number(value || 0).toLocaleString("ar-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <section style={hero}>
          <h1 style={heroTitle}>المصروفات والمشتريات</h1>
          <p style={heroSub}>
            إدارة فواتير المصروفات والمشتريات ومصادر السداد داخل الفرع.
          </p>
        </section>

        <section style={statsGrid}>
          <div style={statCard}>
            <span style={statValue}>{invoices.length}</span>
            <span style={statTitle}>عدد الفواتير</span>
          </div>

          <div style={statCard}>
            <span style={statValue}>{formatMoney(totalAmount)}</span>
            <span style={statTitle}>إجمالي المصروفات</span>
          </div>
        </section>

        <section style={actionsCard}>
          <button
            style={primaryButton}
            onClick={() => router.push(`/finance/${branch}/expenses/new`)}
          >
            ➕ إنشاء فاتورة جديدة
          </button>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>الفواتير</h2>

          {loading ? (
            <div style={emptyBox}>جاري تحميل الفواتير...</div>
          ) : invoices.length === 0 ? (
            <div style={emptyBox}>لا توجد فواتير حتى الآن.</div>
          ) : (
            <>
              <div style={invoiceGrid}>
                {paginatedInvoices.map((invoice) => (
                  <article key={invoice.id} style={invoiceCard}>
                    <div style={invoiceTop}>
                      <span style={invoiceBadge}>
                        {invoice.payment_method || "غير محدد"}
                      </span>
                      <strong style={amount}>
                        {formatMoney(invoice.invoice_amount)} ريال
                      </strong>
                    </div>

                    <h3 style={invoiceTitle}>{invoice.invoice_title}</h3>

                    <p style={details}>
                      {invoice.invoice_details || "لا توجد تفاصيل"}
                    </p>

                    <div style={meta}>
                      <span>📅 تاريخ الفاتورة: {invoice.invoice_date}</span>
                      <span>
                        👤 أنشأها: {invoice.created_by_name || "مستخدم"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              <div style={pagination}>
                <button
                  style={pageButton}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  السابق
                </button>

                <span style={pageInfo}>
                  صفحة {currentPage} من {totalPages}
                </span>

                <button
                  style={pageButton}
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  التالي
                </button>
              </div>
            </>
          )}
        </section>

        <div style={backWrapper}>
          <button
            style={backButton}
            onClick={() => router.push(`/finance/${branch}`)}
          >
            ← الرجوع للرئيسية
          </button>
        </div>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f4f7fb",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  borderRadius: 24,
  padding: 24,
  marginBottom: 14,
  boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 32,
  lineHeight: 1.4,
};

const heroSub: React.CSSProperties = {
  margin: "8px 0 0",
  opacity: 0.9,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 8px 22px rgba(15,23,42,0.04)",
};

const statValue: React.CSSProperties = {
  display: "block",
  color: "#2563eb",
  fontSize: 28,
  fontWeight: 900,
};

const statTitle: React.CSSProperties = {
  display: "block",
  marginTop: 6,
  color: "#475569",
  fontWeight: 800,
};

const actionsCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 14,
  marginBottom: 14,
};

const primaryButton: React.CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
};

const sectionTitle: React.CSSProperties = {
  marginTop: 0,
  color: "#0f172a",
};

const emptyBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 20,
  textAlign: "center",
  color: "#64748b",
};

const invoiceGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
  gap: 12,
};

const invoiceCard: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  background: "#ffffff",
  boxShadow: "0 6px 16px rgba(15,23,42,0.04)",
};

const invoiceTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const invoiceBadge: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 13,
  fontWeight: 800,
};

const amount: React.CSSProperties = {
  color: "#166534",
  fontSize: 16,
};

const invoiceTitle: React.CSSProperties = {
  margin: "14px 0 8px",
  color: "#0f172a",
};

const details: React.CSSProperties = {
  color: "#475569",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
};

const meta: React.CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#64748b",
  fontSize: 13,
  marginTop: 12,
};

const pagination: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 10,
  marginTop: 18,
  flexWrap: "wrap",
};

const pageButton: React.CSSProperties = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 12,
  background: "#e0f2fe",
  color: "#075985",
  fontWeight: 800,
  cursor: "pointer",
};

const pageInfo: React.CSSProperties = {
  color: "#475569",
  fontWeight: 800,
};

const backWrapper: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: React.CSSProperties = {
  padding: "11px 18px",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(51,65,85,0.22)",
};
