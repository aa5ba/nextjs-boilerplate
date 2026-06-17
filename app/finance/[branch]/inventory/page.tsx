"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const LOW_STOCK_LIMIT = 5;
const ITEMS_PER_PAGE = 25;

type ScreenType = "mobile" | "tablet" | "desktop";

export default function FinanceInventoryPage() {
  const params = useParams();
  const router = useRouter();
  const branch = params.branch as string;

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [items, setItems] = useState<any[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [investorsCount, setInvestorsCount] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [negativeCount, setNegativeCount] = useState(0);
  const [lowCount, setLowCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      const width = window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 980) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    updateScreen();
    window.addEventListener("resize", updateScreen);

    return () => window.removeEventListener("resize", updateScreen);
  }, []);

  useEffect(() => {
    loadEmployeeName();
    loadInventory();
  }, [branch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  function loadEmployeeName() {
    if (typeof window === "undefined") return;

    const newName = localStorage.getItem("finance_user_name");

    if (newName) {
      setEmployeeName(newName);
      return;
    }

    const oldUser = localStorage.getItem("finance_user");

    if (oldUser) {
      try {
        const parsed = JSON.parse(oldUser);
        setEmployeeName(parsed?.full_name || parsed?.username || "الموظف");
      } catch {
        setEmployeeName("الموظف");
      }
    }
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_branch_user");
    }

    router.push(`/finance/${branch}/login`);
  }

  function go(path: string) {
    router.push(`/finance/${branch}/${path}`);
  }

  function loadCurrentUserPermissions() {
    const savedUser =
      typeof window !== "undefined"
        ? localStorage.getItem("finance_user")
        : null;

    if (!savedUser) {
      setRoles(["مدير رئيسي"]);
      setPermissions([]);
      return;
    }

    try {
      const user = JSON.parse(savedUser);
      setRoles(user.roles || []);
      setPermissions(user.permissions || []);
    } catch {
      setRoles(["مدير رئيسي"]);
      setPermissions([]);
    }
  }

  function hasPermission(permissionKey: string) {
    return (
      roles.includes("مدير رئيسي") ||
      roles.includes("مدير") ||
      permissions.includes(permissionKey)
    );
  }

  function resetInventoryState() {
    setItems([]);
    setProductsCount(0);
    setInvestorsCount(0);
    setTotalQuantity(0);
    setNegativeCount(0);
    setLowCount(0);
    setCurrentPage(1);
  }

  async function loadInventory() {
    setLoading(true);
    loadCurrentUserPermissions();

    const branchId = await getBranchId(branch);

    if (!branchId) {
      resetInventoryState();
      setLoading(false);
      return;
    }

    const { data: products, error: productsError } = await supabase
      .from("finance_products")
      .select("id")
      .eq("branch_id", branchId)
      .eq("is_active", true);

    if (productsError) {
      alert(productsError.message || "تعذر تحميل المنتجات");
      resetInventoryState();
      setLoading(false);
      return;
    }

    const { data: investors, error: investorsError } = await supabase
      .from("finance_investors")
      .select("id")
      .eq("branch_id", branchId)
      .eq("is_active", true);

    if (investorsError) {
      alert(investorsError.message || "تعذر تحميل المستثمرين");
      resetInventoryState();
      setLoading(false);
      return;
    }

    const { data: inventory, error: inventoryError } = await supabase
      .from("finance_inventory")
      .select(
        "*, finance_products(product_name), finance_investors(investor_name)"
      )
      .eq("branch_id", branchId)
      .order("updated_at", { ascending: false });

    if (inventoryError) {
      alert(inventoryError.message || "تعذر تحميل المخزون");
      resetInventoryState();
      setLoading(false);
      return;
    }

    const list = inventory || [];

    setProductsCount(products?.length || 0);
    setInvestorsCount(investors?.length || 0);
    setItems(list);

    setTotalQuantity(
      list.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    );

    setNegativeCount(
      list.filter((item) => Number(item.quantity || 0) < 0).length
    );

    setLowCount(
      list.filter((item) => {
        const qty = Number(item.quantity || 0);
        return qty >= 0 && qty <= LOW_STOCK_LIMIT;
      }).length
    );

    setCurrentPage(1);
    setLoading(false);
  }

  const filteredItems = useMemo(() => {
    const cleanSearch = searchTerm.trim();

    return items
      .filter((item) => {
        const productName = item.finance_products?.product_name || "";
        const investorName = item.finance_investors?.investor_name || "";
        const qty = Number(item.quantity || 0);
        const status = getStockStatus(qty);

        const matchesSearch =
          !cleanSearch ||
          productName.includes(cleanSearch) ||
          investorName.includes(cleanSearch);

        const matchesStatus =
          statusFilter === "all" || status.key === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aStatus = getStockStatus(Number(a.quantity || 0)).priority;
        const bStatus = getStockStatus(Number(b.quantity || 0)).priority;

        return aStatus - bStatus;
      });
  }, [items, searchTerm, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / ITEMS_PER_PAGE)
  );

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <header style={getHeroStyle(isMobile)}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={getHeroContentStyle(screen)}>
            <div style={getHeroUserCardStyle(screen)}>
              <div style={getEmployeeTopRowStyle(screen)}>
                <div style={employeeIcon}>
                  <UserIcon />
                </div>

                <div style={getEmployeeNameStyle(isMobile)}>
                  {employeeName}
                </div>

                {!isMobile && <div style={employeeDividerSmall} />}

                <button style={logoutInlineButton} onClick={logout}>
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                style={getMainWorkstationButtonStyle(isMobile)}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>المخزون والمنتجات</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        <section style={summaryGrid}>
          <SummaryCard icon="🧩" title="عدد المنتجات" value={productsCount} />
          <SummaryCard icon="📦" title="إجمالي الكمية" value={totalQuantity} />
          <SummaryCard icon="👤" title="عدد المستثمرين" value={investorsCount} />
          <SummaryCard icon="🔴" title="منتجات بالسالب" value={negativeCount} />
          <SummaryCard icon="🟠" title="منتجات منخفضة" value={lowCount} />
        </section>

        <section style={actionsSection}>
          <ActionButton
            icon="➕"
            title="إضافة منتج"
            onClick={() => go("inventory/products/new")}
          />

          {hasPermission("add_investor") && (
            <ActionButton
              icon="👤"
              title="إضافة مستثمر"
              onClick={() => go("inventory/investors/new")}
            />
          )}

          <ActionButton
            icon="👥"
            title="المستثمرين"
            onClick={() => go("inventory/investors")}
          />

          <ActionButton
            icon="📦"
            title="المنتجات"
            onClick={() => go("inventory/products")}
          />

          <ActionButton
            icon="📦"
            title="إضافة كمية للمخزون"
            onClick={() => go("inventory/add-stock")}
          />

          <ActionButton
            icon="📋"
            title="سجل الحركات"
            onClick={() => go("inventory/movements")}
          />

          <ActionButton
            icon="🖨️"
            title="كشف المنتجات"
            onClick={() => go("inventory/products-report")}
          />

          <ActionButton
            icon="🧾"
            title="كشف المستثمر"
            onClick={() => go("inventory/investor-report")}
          />
        </section>

        <section style={tableCard}>
          <div style={tableTop}>
            <div>
              <h2 style={sectionTitle}>المخزون الحالي</h2>

              {!loading && filteredItems.length > 0 && (
                <div style={pageInfo}>
                  صفحة {currentPage} من {totalPages} - عرض{" "}
                  {paginatedItems.length} من {filteredItems.length}
                </div>
              )}
            </div>

            <div style={filters}>
              <input
                style={searchInput}
                placeholder="بحث باسم المنتج أو المستثمر"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <select
                style={filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">كل الحالات</option>
                <option value="negative">بالسالب</option>
                <option value="low">منخفض</option>
                <option value="normal">طبيعي</option>
              </select>
            </div>
          </div>

          <div style={tableHeader}>
            <span>المنتج</span>
            <span>المستثمر</span>
            <span>الكمية</span>
            <span>الحالة</span>
            <span>آخر تحديث</span>
          </div>

          {loading ? (
            <div style={emptyBox}>جاري تحميل المخزون...</div>
          ) : filteredItems.length === 0 ? (
            <div style={emptyBox}>لا توجد نتائج مطابقة</div>
          ) : (
            paginatedItems.map((item) => {
              const qty = Number(item.quantity || 0);
              const status = getStockStatus(qty);

              return (
                <div key={item.id} style={getTableRowStyle(status.key)}>
                  <span>{item.finance_products?.product_name || "-"}</span>
                  <span>{item.finance_investors?.investor_name || "-"}</span>
                  <strong>{qty}</strong>
                  <span style={getStatusBadgeStyle(status.key)}>
                    {status.label}
                  </span>
                  <span>{formatDate(item.updated_at)}</span>
                </div>
              );
            })
          )}

          {!loading && filteredItems.length > ITEMS_PER_PAGE && (
            <div style={paginationBox}>
              <button
                style={{
                  ...paginationButton,
                  opacity: currentPage === 1 ? 0.5 : 1,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
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
        </section>

        <div style={backWrapper}>
          <button
            style={backButton}
            onClick={() => router.push(`/finance/${branch}`)}
          >
            الرجوع للرئيسية
          </button>
        </div>
      </div>
    </main>
  );
}

function getStockStatus(quantity: number) {
  if (quantity < 0) {
    return {
      key: "negative",
      label: "🔴 بالسالب",
      priority: 1,
    };
  }

  if (quantity <= LOW_STOCK_LIMIT) {
    return {
      key: "low",
      label: "🟠 منخفض",
      priority: 2,
    };
  }

  return {
    key: "normal",
    label: "🟢 طبيعي",
    priority: 3,
  };
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

  return new Date(date).toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getTableRowStyle(status: string) {
  if (status === "negative") return { ...tableRow, ...negativeRow };
  if (status === "low") return { ...tableRow, ...lowRow };
  return tableRow;
}

function getStatusBadgeStyle(status: string) {
  if (status === "negative") return statusNegative;
  if (status === "low") return statusLow;
  return statusNormal;
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.8 20.2c.8-3.5 3.6-5.4 7.2-5.4s6.4 1.9 7.2 5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 7V5.8c0-1 .8-1.8 1.8-1.8h6.1c1 0 1.8.8 1.8 1.8v12.4c0 1-.8 1.8-1.8 1.8h-6.1c-1 0-1.8-.8-1.8-1.8V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.8 12h9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.8 8.8 4.6 12l3.2 3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.8 11.2 12 4.5l8.2 6.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 10.4v9.1h11.6v-9.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 19.5v-5.2h4v5.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getPageStyle(isMobile: boolean): CSSProperties {
  return {
    minHeight: "100vh",
    backgroundColor: "#f6f9ff",
    backgroundImage: `
      radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
      radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%),
      radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%),
      linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
      url('/backgrounds/v13-finance-bg-1.png')
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: isMobile ? "scroll" : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

function getContainerStyle(isCompact: boolean): CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact ? 980 : 1180,
    margin: "auto",
  };
}

function getHeroStyle(isMobile: boolean): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile ? "auto" : 160,
    borderRadius: isMobile ? 20 : 24,
    padding: isMobile ? "18px 14px" : "22px 26px",
    marginBottom: 14,
    overflow: "hidden",
    border: "none",
    outline: "none",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    boxShadow: "none",
    isolation: "isolate",
  };
}

function getHeroContentStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "center",
      gap: 16,
      direction: "rtl",
    };
  }

  if (screen === "tablet") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "grid",
      gridTemplateColumns: "1fr",
      alignItems: "center",
      justifyItems: "center",
      gap: 18,
      direction: "rtl",
    };
  }

  return {
    position: "relative",
    zIndex: 3,
    minHeight: 116,
    display: "grid",
    gridTemplateColumns: "minmax(250px, 315px) 1fr minmax(220px, 315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      width: "100%",
      display: "grid",
      gap: 12,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  if (screen === "tablet") {
    return {
      width: "100%",
      maxWidth: 520,
      display: "grid",
      gap: 14,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  return {
    width: "100%",
    maxWidth: 315,
    display: "grid",
    gap: 24,
    direction: "ltr",
    justifySelf: "start",
  };
}

function getEmployeeTopRowStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      minHeight: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 10,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  if (screen === "tablet") {
    return {
      height: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  return {
    height: 42,
    display: "flex",
    alignItems: "center",
    gap: 14,
    direction: "ltr",
    color: "#ffffff",
  };
}

function getEmployeeNameStyle(isMobile: boolean): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow: "0 4px 10px rgba(15,23,42,0.18)",
  };
}

function getMainWorkstationButtonStyle(isMobile: boolean): CSSProperties {
  return {
    width: isMobile ? "100%" : 220,
    maxWidth: isMobile ? 280 : 220,
    height: 44,
    border: "none",
    background: "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "var(--font-almarai), sans-serif",
    boxShadow: "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(screen: ScreenType): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order: screen === "desktop" ? 0 : 1,
  };
}

function getTitleStyle(screen: ScreenType): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize: screen === "mobile" ? 26 : screen === "tablet" ? 28 : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  if (screen === "tablet") {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 12,
    direction: "rtl",
  };
}

const employeeIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1.5px solid rgba(255,255,255,0.34)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
  flex: "0 0 auto",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.90)",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
  padding: 0,
  whiteSpace: "nowrap",
  direction: "rtl",
};

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 210,
  height: 210,
  right: -78,
  top: -85,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.075)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleTwo: CSSProperties = {
  position: "absolute",
  width: 245,
  height: 245,
  right: 145,
  bottom: -178,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.045)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleThree: CSSProperties = {
  position: "absolute",
  width: 150,
  height: 150,
  left: 380,
  top: -96,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.035)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroDots: CSSProperties = {
  position: "absolute",
  top: 28,
  right: 34,
  width: 84,
  height: 58,
  opacity: 0.24,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const summaryCard: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const summaryIcon: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 14,
  background: "#eef5ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const actionsSection: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const actionButton: CSSProperties = {
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
  fontFamily: "var(--font-almarai), sans-serif",
};

const actionIcon: CSSProperties = {
  fontSize: 20,
};

const tableCard: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  overflowX: "auto",
};

const tableTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitle: CSSProperties = {
  margin: 0,
  color: "#0d47a1",
};

const pageInfo: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: "bold",
  marginTop: 6,
};

const filters: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const searchInput: CSSProperties = {
  minWidth: 240,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #d9e3f5",
  fontSize: 15,
  fontFamily: "var(--font-almarai), sans-serif",
};

const filterSelect: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #d9e3f5",
  fontSize: 15,
  fontFamily: "var(--font-almarai), sans-serif",
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr 1.2fr 1.5fr",
  gap: 12,
  minWidth: 860,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr 1.2fr 1.5fr",
  gap: 12,
  minWidth: 860,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const negativeRow: CSSProperties = {
  background: "#fef2f2",
};

const lowRow: CSSProperties = {
  background: "#fffbeb",
};

const statusNegative: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: "bold",
  textAlign: "center",
};

const statusLow: CSSProperties = {
  background: "#fef3c7",
  color: "#92400e",
  border: "1px solid #fde68a",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: "bold",
  textAlign: "center",
};

const statusNormal: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: "bold",
  textAlign: "center",
};

const emptyBox: CSSProperties = {
  minWidth: 760,
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  textAlign: "center",
  color: "#6b7280",
};

const paginationBox: CSSProperties = {
  minWidth: 860,
  marginTop: 18,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const paginationButton: CSSProperties = {
  padding: "11px 18px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const paginationText: CSSProperties = {
  color: "#0f172a",
  fontWeight: "bold",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "11px 18px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily: "var(--font-almarai), sans-serif",
};
