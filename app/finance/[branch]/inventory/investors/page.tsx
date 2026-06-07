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
    <main dir="rtl">
      <h1>قائمة المستثمرين</h1>
    </main>
  );
}
