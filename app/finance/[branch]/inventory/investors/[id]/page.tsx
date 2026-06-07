"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function InvestorDetailsPage() {
  const params = useParams();
  const branch = params.branch as string;
  const investorId = params.id as string;

  const [investor, setInvestor] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [contractsCount, setContractsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvestor();
  }, [branch, investorId]);

  async function loadInvestor() {
    setLoading(true);

    const branchId = await getBranchId(branch);

    if (!branchId) {
      setInvestor(null);
      setInventory([]);
      setLoading(false);
      return;
    }

    const { data: investorData } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("id", investorId)
      .eq("branch_id", branchId)
      .single();

    const { data: inventoryData } = await supabase
      .from("finance_inventory")
      .select(`
        *,
        finance_products(product_name, product_category)
      `)
      .eq("branch_id", branchId)
      .eq("investor_id", investorId)
      .order("updated_at", { ascending: false });

    const { count } = await supabase
      .from("finance_contracts")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("investor_id", investorId);

    setInvestor(investorData);
    setInventory(inventoryData || []);
    setContractsCount(count || 0);
    setLoading(false);
  }

  async function toggleInvestorStatus() {
    if (!investor) return;

    const confirmed = confirm(
      investor.is_active
        ? "هل تريد تعطيل هذا المستثمر؟"
        : "هل تريد تفعيل هذا المستثمر؟"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("finance_investors")
      .update({
        is_active: !investor.is_active,
      })
      .eq("id", investorId);

    if (error) {
      alert("تعذر تعديل حالة المستثمر");
      return;
    }

    await loadInvestor();
  }

  function formatDate(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("ar-SA-u-ca-gregory", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const totalQuantity = inventory.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل بيانات المستثمر...</div>
      </main>
    );
  }

  if (!investor) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>لم يتم العثور على المستثمر</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <div>
            <h1 style={{ margin: 0 }}>👤 ملف المستثمر</h1>
            <p style={headerText}>{investor.investor_name || "-"}</p>
          </div>

          <span style={investor.is_active ? activeBadge : inactiveBadge}>
            {investor.is_active ? "نشط" : "معطل"}
          </span>
        </div>

        <section style={summaryGrid}>
          <SummaryBox title="عدد المنتجات" value={inventory.length} />
          <SummaryBox title="إجمالي المخزون" value={totalQuantity} />
          <SummaryBox title="عدد العقود" value={contractsCount} />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات المستثمر</h2>

          <Row label="اسم المستثمر" value={investor.investor_name || "-"} />
          <Row label="رقم الهوية" value={investor.national_id || "-"} />
          <Row label="رقم الجوال" value={investor.phone || "-"} />
          <Row label="الملاحظات" value={investor.notes || "-"} />
          <Row label="تاريخ الإنشاء" value={formatDate(investor.created_at)} />
        </section>

        <section style={actionsSection}>
          <ActionButton
            title="🧾 كشف المستثمر"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/investor-report?investor=${investorId}`)
            }
          />

          <ActionButton
            title="✏️ تعديل المستثمر"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/investors/${investorId}/edit`)
            }
          />

          <button
            style={investor.is_active ? dangerButton : activateButton}
            onClick={toggleInvestorStatus}
          >
            {investor.is_active ? "تعطيل المستثمر" : "تفعيل المستثمر"}
          </button>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>منتجات المستثمر</h2>

          <div style={tableHeader}>
            <span>المنتج</span>
            <span>التصنيف</span>
            <span>الكمية الحالية</span>
            <span>آخر تحديث</span>
          </div>

          {inventory.length === 0 ? (
            <div style={emptyBox}>لا توجد منتجات مرتبطة بهذا المستثمر</div>
          ) : (
            inventory.map((item) => (
              <div key={item.id} style={tableRow}>
                <span>{item.finance_products?.product_name || "-"}</span>
                <span>{item.finance_products?.product_category || "-"}</span>
                <strong>{item.quantity || 0}</strong>
                <span>{formatDate(item.updated_at)}</span>
              </div>
            ))
          )}
        </section>

        <button
          style={backButton}
          onClick={() =>
            (window.location.href = `/finance/${branch}/inventory/investors`)
          }
        >
          الرجوع للمستثمرين
        </button>
      </div>
    </main>
  );
}

function Row({ label, value }: any) {
  return (
    <div style={row}>
      <span>{label}</span>
      <strong>{value}</strong>
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

function ActionButton({ title, onClick }: any) {
  return (
    <button style={actionButton} onClick={onClick}>
      {title}
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

const headerText = {
  margin: "8px 0 0",
  opacity: 0.9,
  fontSize: 15,
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
  color: "#0d47a1",
  fontWeight: "bold",
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  overflowX: "auto" as const,
};

const sectionTitle = {
  marginTop: 0,
  color: "#0d47a1",
  fontSize: 22,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
};

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const actionButton = {
  width: "100%",
  padding: 16,
  background: "white",
  color: "#0d47a1",
  border: "1px solid #d9e3f5",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const dangerButton = {
  width: "100%",
  padding: 16,
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const activateButton = {
  width: "100%",
  padding: 16,
  background: "#dcfce7",
  color: "#166534",
  border: "none",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr",
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
  gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr",
  gap: 12,
  minWidth: 850,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
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

const activeBadge = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const inactiveBadge = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
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

const loadingBox = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  textAlign: "center" as const,
  color: "#0d47a1",
  fontWeight: "bold",
};
