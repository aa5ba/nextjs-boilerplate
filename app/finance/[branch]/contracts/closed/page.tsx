"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

type ScreenType = "mobile" | "tablet" | "desktop";

export default function ClosedContractsPage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;

  const [contracts, setContracts] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [screen, setScreen] = useState<ScreenType>("desktop");

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 1024) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    loadContracts();
  }, [branch]);

  const totalPages = Math.max(1, Math.ceil(contracts.length / ITEMS_PER_PAGE));

  const paginatedContracts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return contracts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [contracts, currentPage]);

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
      .in("contract_status", ["تم السداد", "ملغي"])
      .order("updated_at", { ascending: false });

    setContracts(data || []);
    setCurrentPage(1);
  }

  return (
    <main dir="rtl" style={getPageStyle(isCompact)}>
      <div style={getContainerStyle(isCompact)}>
        <header style={getHeroStyle(isCompact)}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={getHeroContentStyle(isCompact)}>
            <div>
              <h1 style={getHeroTitleStyle(isMobile)}>العقود المنتهية</h1>
            </div>

            <div style={getHeroActionsStyle(isCompact)}>
              <button style={backButton} onClick={() => router.back()}>
                رجوع
              </button>

              <button
                style={mainWorkstationButton}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                محطة العمل الرئيسية
              </button>
            </div>
          </div>
        </header>

        <section style={getCardStyle(isCompact)}>
          <div style={getListHeaderStyle(isCompact)}>
            <h2 style={sectionTitle}>قائمة العقود المنتهية</h2>

            {contracts.length > 0 && (
              <span style={pageInfo}>
                صفحة {currentPage} من {totalPages} - عرض{" "}
                {paginatedContracts.length} من {contracts.length}
              </span>
            )}
          </div>

          <div style={tableScroll}>
            <div style={tableHeader}>
              <span>رقم العقد</span>
              <span>العميل</span>
              <span>نوع التمويل</span>
              <span>المسدد</span>
              <span>الحالة</span>
            </div>

            {contracts.length === 0 ? (
              <div style={emptyBox}>لا توجد عقود منتهية</div>
            ) : (
              paginatedContracts.map((contract) => (
                <div
                  key={contract.id}
                  style={tableRow}
                  onClick={() =>
                    router.push(`/finance/${branch}/contracts/${contract.id}`)
                  }
                >
                  <span>{contract.contract_number}</span>

                  <span
                    style={customerLink}
                    onClick={(e) => {
                      e.stopPropagation();

                      router.push(
                        `/finance/${branch}/customers/${contract.customer_id}`
                      );
                    }}
                  >
                    {contract.finance_customers?.full_name || "-"}
                  </span>

                  <span>{contract.finance_type}</span>
                  <span>{contract.paid_amount || 0} ر.س</span>

                  <span>
                    <span
                      style={{
                        ...statusBadge,
                        ...(contract.contract_status === "ملغي"
                          ? canceledBadge
                          : paidBadge),
                      }}
                    >
                      {contract.contract_status || "-"}
                    </span>
                  </span>
                </div>
              ))
            )}

            {contracts.length > ITEMS_PER_PAGE && (
              <div style={paginationBox}>
                <button
                  style={{
                    ...paginationButton,
                    opacity: currentPage === 1 ? 0.5 : 1,
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  }}
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(page - 1, 1))
                  }
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
                    cursor:
                      currentPage === totalPages ? "not-allowed" : "pointer",
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
          </div>
        </section>
      </div>
    </main>
  );
}

function getPageStyle(isCompact: boolean) {
  return {
    minHeight: "100vh",
    padding: isCompact ? 14 : 22,
    fontFamily: "var(--font-almarai), sans-serif",
    backgroundImage:
      "radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 34%), radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.14), transparent 30%), linear-gradient(180deg, rgba(248, 250, 252, 0.94), rgba(226, 232, 240, 0.94)), url('/backgrounds/v13-finance-bg-1.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
  };
}

function getContainerStyle(isCompact: boolean) {
  return {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column" as const,
    gap: isCompact ? 14 : 18,
  };
}

function getHeroStyle(isCompact: boolean) {
  return {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: isCompact ? 22 : 28,
    padding: isCompact ? 18 : 26,
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e3a8a 48%, #0891b2 100%)",
    boxShadow: "0 22px 55px rgba(15, 23, 42, 0.28)",
    border: "1px solid rgba(255, 255, 255, 0.16)",
  };
}

function getHeroContentStyle(isCompact: boolean) {
  return {
    position: "relative" as const,
    zIndex: 2,
    display: "flex",
    flexDirection: isCompact ? ("column" as const) : ("row" as const),
    justifyContent: "space-between",
    alignItems: isCompact ? "stretch" : "center",
    gap: 16,
  };
}

function getHeroTitleStyle(isMobile: boolean) {
  return {
    margin: 0,
    fontSize: isMobile ? 24 : 32,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  };
}

function getHeroActionsStyle(isCompact: boolean) {
  return {
    display: "flex",
    flexDirection: isCompact ? ("column" as const) : ("row" as const),
    gap: 10,
    alignItems: "stretch",
  };
}

function getCardStyle(isCompact: boolean) {
  return {
    background: "rgba(255, 255, 255, 0.94)",
    border: "1px solid rgba(226, 232, 240, 0.95)",
    borderRadius: isCompact ? 18 : 22,
    padding: isCompact ? 14 : 20,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
    backdropFilter: "blur(10px)",
  };
}

function getListHeaderStyle(isCompact: boolean) {
  return {
    display: "flex",
    flexDirection: isCompact ? ("column" as const) : ("row" as const),
    justifyContent: "space-between",
    alignItems: isCompact ? "flex-start" : "center",
    gap: 10,
    marginBottom: 14,
  };
}

const heroCircleOne = {
  position: "absolute" as const,
  width: 180,
  height: 180,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.08)",
  top: -70,
  right: -55,
};

const heroCircleTwo = {
  position: "absolute" as const,
  width: 150,
  height: 150,
  borderRadius: "50%",
  background: "rgba(14, 165, 233, 0.18)",
  bottom: -70,
  left: 90,
};

const heroCircleThree = {
  position: "absolute" as const,
  width: 90,
  height: 90,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.07)",
  top: 30,
  left: 25,
};

const heroDots = {
  position: "absolute" as const,
  inset: 0,
  opacity: 0.18,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.72) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

const backButton = {
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#ffffff",
  background: "linear-gradient(135deg, #64748b, #334155)",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(51, 65, 85, 0.28)",
};

const mainWorkstationButton = {
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#ffffff",
  background: "linear-gradient(135deg, #16a34a, #15803d)",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(22, 163, 74, 0.28)",
};

const sectionTitle = {
  margin: 0,
  color: "#0f172a",
  fontSize: 21,
  fontWeight: 900,
};

const pageInfo = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: 800,
};

const tableScroll = {
  width: "100%",
  overflowX: "auto" as const,
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1.5fr 1fr 1fr",
  gap: 12,
  minWidth: 850,
  background: "linear-gradient(135deg, #eff6ff, #ecfeff)",
  color: "#1e3a8a",
  fontWeight: 900,
  padding: 14,
  borderRadius: 14,
  marginBottom: 8,
  border: "1px solid #dbeafe",
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1.5fr 1fr 1fr",
  alignItems: "center",
  gap: 12,
  minWidth: 850,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  cursor: "pointer",
  color: "#0f172a",
  fontWeight: 700,
};

const customerLink = {
  cursor: "pointer",
  color: "#1d4ed8",
  fontWeight: 900,
};

const statusBadge = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 80,
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 900,
};

const paidBadge = {
  color: "#166534",
  background: "#dcfce7",
  border: "1px solid #bbf7d0",
};

const canceledBadge = {
  color: "#991b1b",
  background: "#fee2e2",
  border: "1px solid #fecaca",
};

const emptyBox = {
  minWidth: 850,
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 24,
  textAlign: "center" as const,
  color: "#64748b",
  fontWeight: 800,
};

const paginationBox = {
  minWidth: 850,
  marginTop: 18,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const paginationButton = {
  padding: "11px 18px",
  background: "linear-gradient(135deg, #2563eb, #0891b2)",
  color: "white",
  border: "none",
  borderRadius: 13,
  fontSize: 15,
  fontWeight: 900,
  boxShadow: "0 10px 22px rgba(37, 99, 235, 0.18)",
};

const paginationText = {
  color: "#0f172a",
  fontWeight: 900,
};
