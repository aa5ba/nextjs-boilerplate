"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function InventoryMovementsPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMovements();
  }, [branch]);

  async function loadMovements() {
    setLoading(true);

    const branchId = await getBranchId(branch);

    if (!branchId) {
      setMovements([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("finance_inventory_movements")
      .select(`
        *,
        finance_products(product_name),
        finance_investors(investor_name)
      `)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    setMovements(data || []);
    setLoading(false);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>📋 سجل الحركات</h1>
        </div>

        <section style={tableCard}>
          <div style={tableHeader}>
            <span>الحركة</span>
            <span>المنتج</span>
            <span>المستثمر</span>
            <span>الكمية</span>
            <span>قبل</span>
            <span>بعد</span>
            <span>التاريخ</span>
          </div>

          {loading ? (
            <div style={emptyBox}>جاري تحميل الحركات...</div>
          ) : movements.length === 0 ? (
            <div style={emptyBox}>لا توجد حركات حتى الآن</div>
          ) : (
            movements.map((movement) => (
              <div key={movement.id} style={tableRow}>
                <strong style={movementType}>
                  {movement.movement_type || "-"}
                </strong>

                <span>
                  {movement.finance_products?.product_name || "-"}
                </span>

                <span>
                  {movement.finance_investors?.investor_name || "-"}
                </span>

                <strong>{movement.quantity || 0}</strong>

                <span>{movement.before_quantity || 0}</span>

                <span>{movement.after_quantity || 0}</span>

                <span>{formatDate(movement.created_at)}</span>
              </div>
            ))
          )}
        </section>

        <button
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

function formatDate(date: string) {
  if (!date) return "-";

  return new Date(date).toLocaleString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
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

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
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
  gridTemplateColumns: "1fr 2fr 2fr 1fr 1fr 1fr 1.5fr",
  gap: 12,
  minWidth: 950,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 2fr 1fr 1fr 1fr 1.5fr",
  gap: 12,
  minWidth: 950,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const movementType = {
  color: "#0d47a1",
};

const emptyBox = {
  minWidth: 950,
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
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
};
