"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

export default function InvestorReportPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("احتساب");

  const [investors, setInvestors] = useState<any[]>([]);
  const [investorId, setInvestorId] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitial();
  }, [branch]);

  async function loadInitial() {
    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    const settings = await getOrganizationSettings();
    setOrganizationName(settings.name || "احتساب");

    if (!currentBranchId) return;

    const { data } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    setInvestors(data || []);
  }

  async function loadReport() {
    if (!branchId || !investorId) {
      alert("اختر المستثمر أولاً");
      return;
    }

    setLoading(true);

    let query = supabase
      .from("finance_inventory_movements")
      .select(`
        *,
        finance_products(product_name),
        finance_investors(investor_name),
        finance_contracts(contract_number),
        finance_customers(full_name, national_id)
      `)
      .eq("branch_id", branchId)
      .eq("investor_id", investorId)
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

  const selectedInvestor = investors.find((x) => x.id === investorId);

  const totalOut = items
    .filter((x) => x.movement_type === "خصم")
    .reduce((sum, x) => sum + Number(x.quantity || 0), 0);

  const totalReturn = items
    .filter((x) => x.movement_type === "إرجاع")
    .reduce((sum, x) => sum + Number(x.quantity || 0), 0);

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
          }

          @page {
            size: A4;
            margin: 8mm;
          }
        }
      `}</style>

      <div style={container}>
        <section style={controlsCard} className="no-print">
          <h1 style={pageTitle}>🧾 كشف حساب المستثمر</h1>

          <select
            style={input}
            value={investorId}
            onChange={(e) => setInvestorId(e.target.value)}
          >
            <option value="">اختر المستثمر</option>
            {investors.map((investor) => (
              <option key={investor.id} value={investor.id}>
                {investor.investor_name}
              </option>
            ))}
          </select>

          <div style={filtersGrid}>
            <input
              type="date"
              style={input}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />

            <input
              type="date"
              style={input}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
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
              <div style={smallText}>كشف حساب مستثمر</div>
            </div>

            <div style={reportMeta}>
              <div>تاريخ الطباعة: {new Date().toLocaleDateString("ar-SA")}</div>
              <div>
                الفترة: {fromDate || "البداية"} إلى {toDate || "اليوم"}
              </div>
            </div>
          </div>

          <div style={investorBox}>
            <strong>المستثمر:</strong>{" "}
            {selectedInvestor?.investor_name || "لم يتم اختيار مستثمر"}
          </div>

          <div style={summaryGrid}>
            <Summary title="عدد الحركات" value={items.length} />
            <Summary title="إجمالي الخصم" value={totalOut} />
            <Summary title="إجمالي الإرجاع" value={totalReturn} />
          </div>

          <div style={tableHeader}>
            <span>التاريخ</span>
            <span>العقد</span>
            <span>العميل</span>
            <span>المنتج</span>
            <span>الحركة</span>
            <span>الكمية</span>
            <span>قبل</span>
            <span>بعد</span>
          </div>

          {loading ? (
            <div style={emptyBox}>جاري تحميل البيانات...</div>
          ) : items.length === 0 ? (
            <div style={emptyBox}>لا توجد بيانات لهذا المستثمر</div>
          ) : (
            items.map((item) => (
              <div key={item.id} style={tableRow}>
                <span>{formatDate(item.created_at)}</span>
                <span>{item.finance_contracts?.contract_number || "-"}</span>
                <span>{item.finance_customers?.full_name || "-"}</span>
                <span>{item.finance_products?.product_name || "-"}</span>
                <span>{item.movement_type || "-"}</span>
                <strong>{item.quantity || 0}</strong>
                <span>{item.before_quantity || 0}</span>
                <span>{item.after_quantity || 0}</span>
              </div>
            ))
          )}

          <div style={footer}>
            <div>تم إنشاء هذا الكشف آليًا من نظام احتساب</div>
            <div>التوقيع: .........................</div>
          </div>
        </section>

        <button
          className="no-print"
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}/inventory`)}
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

function formatDate(date: string) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
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
  color: "#0d47a1",
};

const filtersGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
  marginTop: 12,
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
};

const printButton = {
  padding: "14px 24px",
  background: "#166534",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
};

const printArea = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 24,
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

const investorBox = {
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: 14,
  marginBottom: 14,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
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
  gridTemplateColumns: "1.2fr 1fr 1.7fr 1.6fr 1fr .8fr .8fr .8fr",
  gap: 8,
  background: "#0d47a1",
  color: "white",
  padding: 10,
  fontSize: 12,
  fontWeight: "bold",
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 1.7fr 1.6fr 1fr .8fr .8fr .8fr",
  gap: 8,
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
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
  display: "flex",
  justifyContent: "space-between",
  marginTop: 24,
  paddingTop: 12,
  borderTop: "1px solid #cbd5e1",
  fontSize: 12,
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
};
