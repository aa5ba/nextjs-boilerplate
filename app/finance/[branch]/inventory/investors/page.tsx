"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

export default function InvestorsPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [investors, setInvestors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadInvestors();
  }, [branch]);

  async function loadInvestors() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setInvestors([]);
      return;
    }

    const { data } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    setInvestors(data || []);
  }

  const filteredInvestors = useMemo(() => {
    return investors.filter((investor) => {
      const name = investor.investor_name || "";
      const nationalId = investor.national_id || "";
      const phone = investor.phone || "";

      return (
        name.includes(search) ||
        nationalId.includes(search) ||
        phone.includes(search)
      );
    });
  }, [investors, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInvestors.length / ITEMS_PER_PAGE)
  );

  const paginatedInvestors = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;

    return filteredInvestors.slice(
      start,
      start + ITEMS_PER_PAGE
    );
  }, [filteredInvestors, currentPage]);

  return (
  <main dir="rtl" style={page}>
    <div style={container}>
      <div style={header}>
        <h1 style={{ margin: 0 }}>👥 المستثمرون</h1>
      </div>

      <section style={card}>
        <input
          style={searchInput}
          placeholder="البحث باسم المستثمر أو الهوية أو الجوال"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
        />
      </section>

      <section style={card}>
        <div style={tableHeader}>
          <span>المستثمر</span>
          <span>الهوية</span>
          <span>الجوال</span>
          <span>الحالة</span>
        </div>

        {paginatedInvestors.length === 0 ? (
          <div style={emptyBox}>لا يوجد مستثمرون</div>
        ) : (
          paginatedInvestors.map((investor) => (
            <div key={investor.id} style={tableRow}>
              <span>{investor.investor_name || "-"}</span>
              <span>{investor.national_id || "-"}</span>
              <span>{investor.phone || "-"}</span>

              <span>
                {investor.is_active ? "نشط" : "معطل"}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  </main>
);

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

const searchInput = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "2fr 1.5fr 1.5fr 1fr",
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
  gridTemplateColumns: "2fr 1.5fr 1.5fr 1fr",
  gap: 12,
  minWidth: 850,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
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
