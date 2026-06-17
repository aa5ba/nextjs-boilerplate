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

  const [authChecked, setAuthChecked] = useState(false);
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
    let cancelled = false;

    async function run() {
      await initializePage(() => cancelled);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [branch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  async function initializePage(isCancelled: () => boolean) {
    const isLoggedIn = checkLogin();

    if (!isLoggedIn || isCancelled()) return;

    loadEmployeeName();
    loadCurrentUserPermissions();

    if (isCancelled()) return;

    await loadInventory(isCancelled);
  }

  function checkLogin() {
    if (typeof window === "undefined") return false;

    const savedUser = localStorage.getItem("finance_user");
    const savedBranchUser = localStorage.getItem("finance_branch_user");
    const savedUserName = localStorage.getItem("finance_user_name");

    if (!savedUser && !savedBranchUser && !savedUserName) {
      router.replace(`/finance/${branch}/login`);
      return false;
    }

    setAuthChecked(true);
    return true;
  }

  function loadEmployeeName() {
    if (typeof window === "undefined") return;

    const newName = localStorage.getItem("finance_user_name");

    if (newName) {
      setEmployeeName(newName);
      return;
    }

    const oldUser =
      localStorage.getItem("finance_user") ||
      localStorage.getItem("finance_branch_user");

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

    router.replace(`/finance/${branch}/login`);
  }

  function go(path: string) {
    router.push(`/finance/${branch}/${path}`);
  }

  function loadCurrentUserPermissions() {
    const savedUser =
      typeof window !== "undefined"
        ? localStorage.getItem("finance_user") ||
          localStorage.getItem("finance_branch_user")
        : null;

    if (!savedUser) {
      setRoles([]);
      setPermissions([]);
      return;
    }

    try {
      const user = JSON.parse(savedUser);
      setRoles(user.roles || []);
      setPermissions(user.permissions || []);
    } catch {
      setRoles([]);
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

  async function loadInventory(isCancelled: () => boolean) {
    setLoading(true);
    resetInventoryState();

    const branchId = await getBranchId(branch);

    if (isCancelled()) return;

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

    if (isCancelled()) return;

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

    if (isCancelled()) return;

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

    if (isCancelled()) return;

    if (inventoryError) {
      alert(inventoryError.message || "تعذر تحميل المخزون");
      resetInventoryState();
      setLoading(false);
      return;
    }

    const list = inventory || [];

    const currentTotalQuantity = list.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const currentNegativeCount = list.filter(
      (item) => Number(item.quantity || 0) < 0
    ).length;

    const currentLowCount = list.filter((item) => {
      const qty = Number(item.quantity || 0);
      return qty >= 0 && qty <= LOW_STOCK_LIMIT;
    }).length;

    setProductsCount(products?.length || 0);
    setInvestorsCount(investors?.length || 0);
    setItems(list);
    setTotalQuantity(currentTotalQuantity);
    setNegativeCount(currentNegativeCount);
    setLowCount(currentLowCount);
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

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  if (!authChecked) {
    return null;
  }

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
