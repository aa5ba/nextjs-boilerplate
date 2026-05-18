"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber } from "@/lib/numberUtils";

export default function SearchCustomersPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);

  async function searchCustomers() {
    if (!search.trim()) {
      alert("اكتب الاسم أو رقم الهوية أو الجوال");
      return;
    }

    const branchId = await getBranchId(branch);

    if (!branchId) {
      setCustomers([]);
      return;
    }

    const normalizedSearch = normalizeNumber(search);

    const { data, error } = await supabase
      .from("finance_customers")
      .select("*, finance_customer_groups(name)")
      .eq("branch_id", branchId)
      .or(
        `full_name.ilike.%${search}%,national_id.ilike.%${normalizedSearch}%,phone.ilike.%${normalizedSearch}%`
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert("تعذر البحث عن العميل");
      return;
    }

    setCustomers(data || []);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>البحث عن عميل</h1>
        </div>

        <section style={card}>
          <div style={searchRow}>
            <input
              style={input}
              placeholder="الاسم أو رقم الهوية أو الجوال"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button style={searchButton} onClick={searchCustomers}>
              🔍 بحث
            </button>
          </div>
        </section>

        <section style={card}>
          <div style={tableHeader}>
            <span>👤 العميل</span>
            <span>🪪 الهوية</span>
            <span>📱 الجوال</span>
            <span>👥 المجموعة</span>
          </div>

          {customers.length === 0 ? (
            <div style={emptyBox}>لا توجد نتائج</div>
          ) : (
            customers.map((customer) => (
              <div
                key={customer.id}
                style={tableRow}
                onClick={() =>
                  (window.location.href = `/finance/${branch}/customers/${customer.id}`)
                }
              >
                <span>👤 {customer.full_name || "-"}</span>
                <span>🪪 {customer.national_id || "-"}</span>
                <span>📱 {customer.phone || "-"}</span>
                <span>👥 {customer.finance_customer_groups?.name || "-"}</span>
              </div>
            ))
          )}
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}/customers`)}
        >
          الرجوع للعملاء
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
  gridTemplateColumns: "2fr 1.5fr 1.5fr 1.5fr",
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
  gridTemplateColumns: "2fr 1.5fr 1.5fr 1.5fr",
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
};
