"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

export default function ProductsReportPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitial();
  }, [branch]);

  async function loadInitial() {
    const branchId = await getBranchId(branch);
    setBranchId(branchId);

    const settings = await getOrganizationSettings();
    setOrganizationName(settings.name || "المنظمة");
  }

  async function loadReport() {
    if (!branchId) return;

    setLoading(true);

    let query = supabase
      .from("finance_inventory_movements")
      .select(`
        *,
        finance_products(product_name),
        finance_investors(investor_name)
      `)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    if (fromDate) {
      query = query.gte("created_at", fromDate);
    }

    if (toDate) {
      query = query.lte("created_at", `${toDate}T23:59:59`);
    }

    const { data } = await query;

    setItems(data || []);
    setLoading(false);
  }

  function printReport() {
    window.print();
  }

  function formatDate(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("ar-SA-u-ca-gregory", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const totalQuantity = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  return (
    <main dir="rtl" style={page}>
      <style>{`
        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-container {
            padding: 0 !important;
            margin: 0 !important;
          }

          @page {
            size: A4;
            margin: 8mm;
          }
        }
      `}</style>

      <div style={container} className="print-container">
        <div style={header}>
          <h1 style={{ margin: 0 }}>كشف حركة المنتجات</h1>
          <div style={{ marginTop: 10 }}>{organizationName}</div>
        </div>

        <section style={filtersCard} className="no-print">
          <div style={filtersGrid}>
            <div>
              <label style={label}>من تاريخ</label>
              <input
                type="date"
                style={input}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div>
              <label style={label}>إلى تاريخ</label>
              <input
                type="date"
                style={input}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div style={buttonsRow}>
            <button style={primaryButton} onClick={loadReport}>
              عرض الكشف
            </button>

            <button style={printButton} onClick={printReport}>
              طباعة A4
            </button>
          </div>
        </section>

        <section style={summaryCard}>
          <div style={summaryBox}>إجمالي الحركات: {items.length}</div>
          <div style={summaryBox}>إجمالي الكميات: {totalQuantity}</div>
        </section>

        <section style={tableCard}>
          <div style={tableHeader}>
            <span>المنتج</span>
            <span>المستثمر</span>
            <span>نوع الحركة</span>
            <span>الكمية</span>
            <span>قبل</span>
            <span>بعد</span>
            <span>التاريخ</span>
          </div>

          {loading ? (
            <div style={emptyBox}>جاري تحميل البيانات...</div>
          ) : items.length === 0 ? (
            <div style={emptyBox}>لا توجد بيانات</div>
          ) : (
            items.map((item) => (
              <div key={item.id} style={tableRow}>
                <span>{item.finance_products?.product_name || "-"}</span>
                <span>{item.finance_investors?.investor_name || "-"}</span>
                <span>{item.movement_type}</span>
                <strong>{item.quantity}</strong>
                <span>{item.before_quantity}</span>
                <span>{item.after_quantity}</span>
                <span>{formatDate(item.created_at)}</span>
              </div>
            ))
          )}
        </section>

        <button
          className="no-print"
          style={backButton}
          onClick={() =>
            (window.location.href = `/finance/${branch}/inventory`)
          }
        >
          الرجوع للمخزون
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
  maxWidth: 1200,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
};

const filtersCard = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 18,
};

const filtersGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
  gap: 14,
};

const label = {
  display: "block",
  marginBottom: 8,
  color: "#0d47a1",
  fontWeight: "bold",
};

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
};

const buttonsRow = {
  display: "flex",
  gap: 12,
  marginTop: 18,
  flexWrap: "wrap" as const,
};

const primaryButton = {
  padding: "14px 24px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
  fontWeight: "bold",
};

const printButton = {
  padding: "14px 24px",
  background: "#166534",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
  fontWeight: "bold",
};

const summaryCard = {
  display: "flex",
  gap: 14,
  marginBottom: 18,
  flexWrap: "wrap" as const,
};

const summaryBox = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 14,
  padding: 16,
  fontWeight: "bold",
};

const tableCard = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  overflowX: "auto" as const,
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr 1.5fr",
  gap: 12,
  minWidth: 1000,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr 1.5fr",
  gap: 12,
  minWidth: 1000,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
};

const emptyBox = {
  minWidth: 1000,
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  textAlign: "center" as const,
  color: "#6b7280",
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
