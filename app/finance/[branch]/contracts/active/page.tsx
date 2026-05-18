"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function ActiveContractsPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [contracts, setContracts] = useState<any[]>([]);

  useEffect(() => {
    loadContracts();
  }, [branch]);

  async function loadContracts() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setContracts([]);
      return;
    }

    const { data } = await supabase
      .from("finance_contracts")
      .select("*, finance_customers(full_name, national_id, phone)")
      .eq("branch_id", branchId)
      .in("contract_status", ["نشط", "متأخر"])
      .order("created_at", { ascending: false });

    setContracts(data || []);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>العقود القائمة</h1>
        </div>

        <section style={card}>
          <div style={tableHeader}>
            <span>رقم العقد</span>
            <span>العميل</span>
            <span>نوع التمويل</span>
            <span>المتبقي</span>
            <span>الحالة</span>
          </div>

          {contracts.length === 0 ? (
            <div style={emptyBox}>لا توجد عقود قائمة</div>
          ) : (
            contracts.map((contract) => (
              <div
                key={contract.id}
                style={tableRow}
                onClick={() =>
                  (window.location.href = `/finance/${branch}/contracts/${contract.id}`)
                }
              >
                <span>{contract.contract_number}</span>
                <span
  style={{ cursor: "pointer", color: "#0d47a1", fontWeight: "bold" }}
  onClick={(e) => {
    e.stopPropagation();

    window.location.href =
      `/finance/${branch}/customers/${contract.customer_id}`;
  }}
>
  👤 {contract.finance_customers?.full_name || "-"}
</span>
                <span>{contract.finance_type}</span>
                <span>{contract.remaining_amount} ر.س</span>
                <span>{contract.contract_status}</span>
              </div>
            ))
          )}
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}/contracts`)}
        >
          الرجوع للعقود
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

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  overflowX: "auto" as const,
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1.5fr 1fr 1fr",
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
  gridTemplateColumns: "1fr 2fr 1.5fr 1fr 1fr",
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

const backButton = {
  width: "100%",
  padding: 16,
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 18,
};
