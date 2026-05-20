"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function FinanceInventoryPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [items, setItems] = useState<any[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [investorsCount, setInvestorsCount] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, [branch]);

  async function loadInventory() {
    setLoading(true);

    const branchId = await getBranchId(branch);

    if (!branchId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: products } = await supabase
      .from("finance_products")
      .select("id")
      .eq("branch_id", branchId)
      .eq("is_active", true);

    const { data: investors } = await supabase
      .from("finance_investors")
      .select("id")
      .eq("branch_id", branchId)
      .eq("is_active", true);

    const { data: inventory } = await supabase
      .from("finance_inventory")
      .select(
        "*, finance_products(product_name), finance_investors(investor_name)"
      )
      .eq("branch_id", branchId)
      .order("updated_at", { ascending: false });

    setProductsCount(products?.length || 0);
    setInvestorsCount(investors?.length || 0);
    setItems(inventory || []);

    const quantitySum = (inventory || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    setTotalQuantity(quantitySum);
    setLoading(false);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>📦 المخزون والمنتجات</h1>
        </div>

        <section style={summaryGrid}>
          <SummaryCard icon="🧩" title="عدد المنتجات" value={productsCount} />

          <SummaryCard icon="📦" title="إجمالي الكمية" value={totalQuantity} />

          <SummaryCard icon="👤" title="عدد المستثمرين" value={investorsCount} />
        </section>

        <section style={actionsSection}>
          <ActionButton
            icon="➕"
            title="إضافة منتج"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/products/new`)
            }
          />

          <ActionButton
            icon="👤"
            title="إضافة مستثمر"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/investors/new`)
            }
          />

          <ActionButton
            icon="📦"
            title="إضافة كمية للمخزون"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/add-stock`)
            }
          />

          <ActionButton
            icon="📋"
            title="سجل الحركات"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/movements`)
            }
          />

          <ActionButton
            icon="🖨️"
            title="كشف المنتجات"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/products-report`)
            }
          />

          <ActionButton
            icon="🧾"
            title="كشف المستثمر"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/investor-report`)
            }
          />
        </section>

        <section style={tableCard}>
          <h2 style={sectionTitle}>المخزون الحالي</h2>

          <div style={tableHeader}>
            <span>المنتج</span>
            <span>المستثمر</span>
            <span>الكمية</span>
            <span>آخر تحديث</span>
          </div>

          {loading ? (
            <div style={emptyBox}>جاري تحميل المخزون...</div>
          ) : items.length === 0 ? (
            <div style={emptyBox}>لا يوجد مخزون حتى الآن</div>
          ) : (
            items.map((item) => (
              <div key={item.id} style={tableRow}>
                <span>{item.finance_products?.product_name || "-"}</span>
                <span>{item.finance_investors?.investor_name || "-"}</span>
                <strong>{item.quantity || 0}</strong>
                <span>{formatDate(item.updated_at)}</span>
              </div>
            ))
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

function SummaryCard({ icon, title, value }: any) {
  return (
    <div style={summaryCard}>
      <div>
        <strong>{title}</strong>
        <span>{value}</span>
      </div>

      <div style={summaryIcon}>{icon}</div>
    </div>
  );
}

function ActionButton({ icon, title, onClick }: any) {
  return (
    <button style={actionButton} onClick={onClick}>
      <span style={actionIcon}>{icon}</span>
      <span>{title}</span>
    </button>
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

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const summaryCard = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const summaryIcon = {
  width: 46,
  height: 46,
  borderRadius: 14,
  background: "#eef5ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
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
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const actionIcon = {
  fontSize: 20,
};

const tableCard = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  overflowX: "auto" as const,
};

const sectionTitle = {
  marginTop: 0,
  color: "#0d47a1",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr 1.5fr",
  gap: 12,
  minWidth: 760,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr 1.5fr",
  gap: 12,
  minWidth: 760,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
};

const emptyBox = {
  minWidth: 760,
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
  background: "#6b7280",
  color: "#111827",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 18,
};
