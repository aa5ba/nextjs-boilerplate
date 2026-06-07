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
