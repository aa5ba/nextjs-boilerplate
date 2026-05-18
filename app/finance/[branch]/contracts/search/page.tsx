"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber } from "@/lib/numberUtils";

export default function SearchContractsPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [search, setSearch] = useState("");
  const [contracts, setContracts] = useState<any[]>([]);

  async function searchContracts() {
    if (!search.trim()) {
      alert("اكتب بيانات البحث");
      return;
    }

    const branchId = await getBranchId(branch);

    if (!branchId) {
      setContracts([]);
      return;
    }

    const normalizedSearch = normalizeNumber(search);

    const { data: customersData } = await supabase
      .from("finance_customers")
      .select("id")
      .eq("branch_id", branchId)
      .or(
        `full_name.ilike.%${search}%,national_id.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%`
      );

    const customerIds = customersData?.map((customer) => customer.id) || [];

    let query = supabase
      .from("finance_contracts")
      .select("*, finance_customers(full_name, national_id, phone)")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    if (customerIds.length > 0 && normalizedSearch) {
      query = query.or(
        `contract_number.eq.${normalizedSearch},customer_id.in.(${customerIds.join(",")})`
      );
    } else if (customerIds.length > 0) {
      query = query.in("customer_id", customerIds);
    } else if (normalizedSearch) {
      query = query.eq("contract_number", normalizedSearch);
    } else {
      setContracts([]);
      return;
    }

    const { data, error } = await query;

    if (error) {
      alert("تعذر البحث");
      return;
    }

    setContracts(data || []);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>البحث عن عقد</h1>
        </div>

        <section style={card}>
          <div style={searchRow}>
            <input
              style={input}
              placeholder="رقم العقد أو الهوية أو الجوال أو الاسم"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button style={searchButton} onClick={searchContracts}>
              🔍 بحث
            </button>
          </div>
        </section>

        <section style={card}>
          <div style={tableHeader}>
            <span>📄 العقد</span>
            <span>👤 العميل</span>
            <span>📱 الجوال</span>
            <span>📌 الحالة</span>
          </div>

          {contracts.length === 0 ? (
            <div style={emptyBox}>لا توجد نتائج</div>
          ) : (
            contracts.map((contract) => (
              <div
                key={contract.id}
                style={tableRow}
                onClick={() =>
                  (window.location.href = `/finance/${branch}/contracts/${contract.id}`)
                }
              >
                <span>📄 {contract.contract_number}</span>
                <span>👤 {contract.finance_customers?.full_name || "-"}</span>
                <span>📱 {contract.finance_customers?.phone || "-"}</span>
                <span>📌 {contract.contract_status || "-"}</span>
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
  marginBottom: 16,
  overflowX: "auto" as const,
};

const searchRow = {
  display: "grid",
  gridTemplateColumns: "1fr 140px",
  gap: 12,
};

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
};

const searchButton = {
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1.5fr 1fr",
  gap: 12,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  minWidth: 800,
  marginBottom: 10,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1.5fr 1fr",
  gap: 12,
  minWidth: 800,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  cursor: "pointer",
};

const emptyBox = {
  minWidth: 800,
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
};
