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
  const [organizationName, setOrganizationName] = useState("احتساب");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitial();
  }, [branch]);

  async function loadInitial() {
    const { data: branchData, error: branchError } = await supabase
      .from("finance_branches")
      .select("id, organization_name")
      .eq("branch_slug", branch)
      .single();

    if (branchError || !branchData) {
      alert("تعذر تحديد الفرع");
      return;
    }

    setBranchId(branchData.id);

    const settings = await getOrganizationSettings();
    setOrganizationName(
      branchData.organization_name || settings.name || "احتساب"
    );
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

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setItems(data || []);
    setLoading(false);
  }

  const totalQuantity = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const totalAdd = items
    .filter((item) => item.movement_type === "إضافة")
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const totalOut = items
    .filter((item) => item.movement_type === "خصم")
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const totalReturn = items
    .filter((item) => item.movement_type === "إرجاع")
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <main dir="rtl" style={page}>
      <style>{`
        .print-only {
          display: none;
        }

        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-only { display: flex !important; }

          main {
            background: white !important;
            padding: 0 !important;
          }

          .print-area {
            width: 190mm !important;
            min-height: 277mm !important;
            margin: 0 auto !important;
            padding: 8mm !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
          }

          @page {
            size: A4;
            margin: 8mm;
          }
        }
      `}</style>

      <div style={container}>
        <section style={controlsCard} className="no-print">
          <h1 style={pageTitle}>🖨️ كشف حركة المنتجات</h1>

          <div style={formGrid}>
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

            <button style={printButton} onClick={() => window.print()}>
              طباعة A4
            </button>
          </div>
        </section>

        <section style={printArea} className="print-area">
          <div style={reportHeader}>
            <div>
              <h2 style={{ margin: 0 }}>{organizationName}</h2>
              <div style={smallText}>كشف حركة المنتجات</div>
            </div>

            <div style={reportMeta}>
              <div>تاريخ الطباعة: {formatGregorianDate(new Date())}</div>
              <div>
                الفترة: {fromDate || "البداية"} إلى {toDate || "اليوم"}
              </div>
            </div>
          </div>

          <div style={summaryGrid}>
            <Summary title="عدد الحركات" value={items.length} />
            <Summary title="إجمالي الكميات" value={totalQuantity} />
            <Summary title="إجمالي الإضافة" value={totalAdd} />
            <Summary title="إجمالي الخصم" value={totalOut} />
            <Summary title="إجمالي الإرجاع" value={totalReturn} />
          </div>

          <div style={tableHeader}>
            <span>التاريخ</span>
            <span>المنتج</span>
            <span>المستثمر</span>
            <span>الحركة</span>
            <span>الكمية</span>
            <span>قبل</span>
            <span>بعد</span>
          </div>

          {loading ? (
            <div style={emptyBox}>جاري تحميل البيانات...</div>
          ) : items.length === 0 ? (
            <div style={emptyBox}>لا توجد بيانات</div>
          ) : (
            items.map((item) => (
              <div key={item.id} style={tableRow}>
                <span>{formatGregorianDate(item.created_at)}</span>
                <span>{item.finance_products?.product_name || "-"}</span>
                <span>{item.finance_investors?.investor_name || "-"}</span>
                <span>{item.movement_type || "-"}</span>
                <strong>{item.quantity || 0}</strong>
                <span>{item.before_quantity || 0}</span>
                <span>{item.after_quantity || 0}</span>
              </div>
            ))
          )}

          <div style={footer}>
            <div>تم إنشاء هذا الكشف من النظام آلياً عبر {organizationName}</div>
          </div>

          <div style={signatureRow} className="print-only">
            <div>التوقيع: .........................</div>
          </div>
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

function Summary({ title, value }: any) {
  return (
    <div style={summaryBox}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatGregorianDate(date: any) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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

const controlsCard = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 18,
};

const pageTitle = {
  marginTop: 0,
  marginBottom: 16,
  color: "#0d47a1",
};

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
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
  height: 50,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
  background: "white",
};

const buttonsRow = {
  display: "flex",
  gap: 12,
  marginTop: 16,
  flexWrap: "wrap" as const,
};

const primaryButton = {
  padding: "14px 24px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const printButton = {
  padding: "14px 24px",
  background: "#166534",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const printArea = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 24,
  overflowX: "auto" as const,
};

const reportHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  borderBottom: "2px solid #0d47a1",
  paddingBottom: 14,
  marginBottom: 16,
};

const reportMeta = {
  textAlign: "left" as const,
  fontSize: 13,
  lineHeight: 1.8,
};

const smallText = {
  color: "#64748b",
  marginTop: 6,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
  gap: 12,
  marginBottom: 16,
};

const summaryBox = {
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  background: "#f8fbff",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1.8fr 1.8fr 1fr .8fr .8fr .8fr",
  gap: 8,
  background: "#0d47a1",
  color: "white",
  padding: 10,
  fontSize: 12,
  fontWeight: "bold",
  minWidth: 900,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1.8fr 1.8fr 1fr .8fr .8fr .8fr",
  gap: 8,
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  minWidth: 900,
};

const emptyBox = {
  padding: 22,
  textAlign: "center" as const,
  color: "#6b7280",
  border: "1px dashed #cbd5e1",
  marginTop: 10,
  borderRadius: 12,
};

const footer = {
  marginTop: 24,
  paddingTop: 12,
  borderTop: "1px solid #cbd5e1",
  fontSize: 12,
};

const signatureRow = {
  justifyContent: "flex-end",
  marginTop: 24,
  fontSize: 12,
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
