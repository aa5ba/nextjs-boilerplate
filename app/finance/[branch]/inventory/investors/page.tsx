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

    const { data: investorsData } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    const { data: inventoryData } = await supabase
      .from("finance_inventory")
      .select("investor_id, product_id, quantity")
      .eq("branch_id", branchId);

    const enrichedInvestors = (investorsData || []).map((investor) => {
      const investorInventory = (inventoryData || []).filter(
        (item) => item.investor_id === investor.id
      );

      const productsCount = new Set(
        investorInventory.map((item) => item.product_id)
      ).size;

      const totalQuantity = investorInventory.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );

      return {
        ...investor,
        productsCount,
        totalQuantity,
      };
    });

    setInvestors(enrichedInvestors);
  }

  async function toggleInvestorStatus(investor: any) {
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", investor.id);

    if (error) {
      alert("تعذر تعديل حالة المستثمر");
      return;
    }

    await loadInvestors();
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
    return filteredInvestors.slice(start, start + ITEMS_PER_PAGE);
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
          <div style={listHeader}>
            <h2 style={sectionTitle}>قائمة المستثمرين</h2>

            {filteredInvestors.length > 0 && (
              <span style={pageInfo}>
                صفحة {currentPage} من {totalPages} - عرض{" "}
                {paginatedInvestors.length} من {filteredInvestors.length}
              </span>
            )}
          </div>

          <div style={tableHeader}>
            <span>المستثمر</span>
            <span>الهوية</span>
            <span>الجوال</span>
            <span>عدد المنتجات</span>
            <span>إجمالي المخزون</span>
            <span>الحالة</span>
            <span>الإجراءات</span>
          </div>

          {paginatedInvestors.length === 0 ? (
            <div style={emptyBox}>لا يوجد مستثمرون</div>
          ) : (
            paginatedInvestors.map((investor) => (
              <div key={investor.id} style={tableRow}>
                <span>{investor.investor_name || "-"}</span>
                <span>{investor.national_id || "-"}</span>
                <span>{investor.phone || "-"}</span>
                <span>{investor.productsCount || 0}</span>
                <strong>{investor.totalQuantity || 0}</strong>

                <span style={investor.is_active ? activeBadge : inactiveBadge}>
                  {investor.is_active ? "نشط" : "معطل"}
                </span>

                <div style={actionsCell}>
                  <button
                    style={smallButton}
                    onClick={() =>
                      (window.location.href = `/finance/${branch}/inventory/investor-report`)
                    }
                  >
                    كشف
                  </button>

                  <button
                    style={smallGrayButton}
                    onClick={() => alert("تعديل المستثمر سيُضاف لاحقًا")}
                  >
                    تعديل
                  </button>

                  <button
                    style={smallDangerButton}
                    onClick={() => toggleInvestorStatus(investor)}
                  >
                    {investor.is_active ? "تعطيل" : "تفعيل"}
                  </button>
                </div>
              </div>
            ))
          )}

          {filteredInvestors.length > ITEMS_PER_PAGE && (
            <div style={paginationBox}>
              <button
                style={{
                  ...paginationButton,
                  opacity: currentPage === 1 ? 0.5 : 1,
                }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              >
                السابق
              </button>

              <span style={paginationText}>
                صفحة {currentPage} من {totalPages}
              </span>

              <button
                style={{
                  ...paginationButton,
                  opacity: currentPage === totalPages ? 0.5 : 1,
                }}
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(page + 1, totalPages))
                }
              >
                التالي
              </button>
            </div>
          )}
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}/inventory`)}
        >
          الرجوع للمخزون
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

const searchInput = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
};

const listHeader = {
  minWidth: 1100,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const sectionTitle = {
  margin: 0,
  color: "#0d47a1",
  fontSize: 22,
};

const pageInfo = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: "bold",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1.2fr 1.2fr 1fr 1fr 1fr 260px",
  gap: 12,
  minWidth: 1100,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1.2fr 1.2fr 1fr 1fr 1fr 260px",
  gap: 12,
  minWidth: 1100,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const emptyBox = {
  minWidth: 1100,
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
  padding: "6px 10px",
  fontWeight: "bold",
  textAlign: "center" as const,
};

const inactiveBadge = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: "bold",
  textAlign: "center" as const,
};

const actionsCell = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
};

const smallButton = {
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: "bold",
  cursor: "pointer",
};

const smallGrayButton = {
  background: "#e5e7eb",
  color: "#111827",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: "bold",
  cursor: "pointer",
};

const smallDangerButton = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: "bold",
  cursor: "pointer",
};

const paginationBox = {
  minWidth: 1100,
  marginTop: 18,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const paginationButton = {
  padding: "11px 18px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
};

const paginationText = {
  color: "#0f172a",
  fontWeight: "bold",
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
