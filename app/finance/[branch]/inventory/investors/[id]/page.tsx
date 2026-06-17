"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

type ScreenType = "mobile" | "tablet" | "desktop";

type Investor = {
  id: string;
  branch_id: string;
  investor_name: string | null;
  national_id: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string | null;
};

type InventoryItem = {
  id: string;
  branch_id: string;
  investor_id: string | null;
  product_id: string | null;
  quantity: number | string | null;
  updated_at: string | null;
  finance_products:
    | {
        product_name: string | null;
        product_category: string | null;
      }
    | {
        product_name: string | null;
        product_category: string | null;
      }[]
    | null;
};

export default function InvestorDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;
  const investorId = params.id as string;

  const statusLoadingRef = useRef(false);

  const [authChecked, setAuthChecked] = useState(false);
  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [branchId, setBranchId] = useState<string | null>(null);
  const [investor, setInvestor] = useState<Investor | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [contractsCount, setContractsCount] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalInventoryRows, setTotalInventoryRows] = useState(0);

  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const totalPages = Math.max(
    1,
    Math.ceil(totalInventoryRows / ITEMS_PER_PAGE)
  );

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
  }, [branch, investorId]);

  useEffect(() => {
    if (!authChecked || !branchId || !investor?.id) return;

    let cancelled = false;

    async function run() {
      await loadInventoryPage(
        branchId,
        currentPage,
        () => cancelled
      );
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [authChecked, branchId, investor?.id, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  async function initializePage(isCancelled: () => boolean) {
    setLoading(true);
    setInventoryLoading(false);
    setBranchId(null);
    setInvestor(null);
    setInventory([]);
    setProductsCount(0);
    setTotalQuantity(0);
    setContractsCount(0);
    setTotalInventoryRows(0);
    setCurrentPage(1);

    const isLoggedIn = checkLogin();

    if (!isLoggedIn || isCancelled()) return;

    loadEmployeeName();
    loadCurrentUserPermissions();

    const currentBranchId = await getBranchId(branch);

    if (isCancelled()) return;

    if (!currentBranchId) {
      setLoading(false);
      alert("تعذر تحديد الفرع");
      return;
    }

    setBranchId(currentBranchId);

    await loadInvestorMainData(
      currentBranchId,
      isCancelled
    );
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

    const directName = localStorage.getItem("finance_user_name");

    if (directName) {
      setEmployeeName(directName);
      return;
    }

    const savedUser =
      localStorage.getItem("finance_user") ||
      localStorage.getItem("finance_branch_user");

    if (!savedUser) {
      setEmployeeName("الموظف");
      return;
    }

    try {
      const parsed = JSON.parse(savedUser);

      setEmployeeName(
        parsed?.full_name ||
          parsed?.username ||
          parsed?.name ||
          "الموظف"
      );
    } catch {
      setEmployeeName("الموظف");
    }
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_branch_user");
      localStorage.removeItem("finance_role");
    }

    router.replace(`/finance/${branch}/login`);
  }

  function loadCurrentUserPermissions() {
    if (typeof window === "undefined") {
      setRoles([]);
      setPermissions([]);
      return;
    }

    const savedUser =
      localStorage.getItem("finance_user") ||
      localStorage.getItem("finance_branch_user");

    const legacyRole = localStorage.getItem("finance_role");

    if (!savedUser) {
      setRoles(legacyRole ? [legacyRole] : []);
      setPermissions([]);
      return;
    }

    try {
      const user = JSON.parse(savedUser);

      const currentRoles: string[] = Array.isArray(user?.roles)
        ? user.roles.filter(
            (role: unknown): role is string =>
              typeof role === "string"
          )
        : typeof user?.role === "string"
        ? [user.role]
        : [];

      const currentPermissions: string[] = Array.isArray(
        user?.permissions
      )
        ? user.permissions.filter(
            (permission: unknown): permission is string =>
              typeof permission === "string"
          )
        : [];

      if (legacyRole && !currentRoles.includes(legacyRole)) {
        currentRoles.push(legacyRole);
      }

      setRoles(currentRoles);
      setPermissions(currentPermissions);
    } catch {
      setRoles(legacyRole ? [legacyRole] : []);
      setPermissions([]);
    }
  }

  function hasPermission(permissionKey: string) {
    return (
      roles.includes("main_admin") ||
      roles.includes("branch_manager") ||
      roles.includes("مدير رئيسي") ||
      roles.includes("مدير") ||
      permissions.includes(permissionKey)
    );
  }

  async function loadInvestorMainData(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    try {
      const { data: investorData, error: investorError } =
        await supabase
          .from("finance_investors")
          .select(
            `
              id,
              branch_id,
              investor_name,
              national_id,
              phone,
              notes,
              is_active,
              created_at
            `
          )
          .eq("id", investorId)
          .eq("branch_id", currentBranchId)
          .maybeSingle();

      if (isCancelled()) return;

      if (investorError) {
        alert(
          investorError.message ||
            "تعذر تحميل بيانات المستثمر"
        );

        setInvestor(null);
        return;
      }

      if (!investorData) {
        setInvestor(null);
        return;
      }

      const [
        contractsResult,
        inventorySummaryResult,
      ] = await Promise.all([
        supabase
          .from("finance_contracts")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("branch_id", currentBranchId)
          .eq("investor_id", investorId),

        supabase.rpc(
          "get_finance_investor_inventory_summary",
          {
            p_branch_id: currentBranchId,
            p_investor_id: investorId,
          }
        ),
      ]);

      if (isCancelled()) return;

      if (contractsResult.error) {
        alert(
          contractsResult.error.message ||
            "تعذر تحميل عدد العقود"
        );
      }

      if (inventorySummaryResult.error) {
        alert(
          inventorySummaryResult.error.message ||
            "تعذر تحميل ملخص مخزون المستثمر"
        );
      }

      const summary = inventorySummaryResult.data?.[0];

      setInvestor(investorData as Investor);
      setContractsCount(contractsResult.count || 0);
      setProductsCount(
        Number(summary?.products_count || 0)
      );
      setTotalQuantity(
        Number(summary?.total_quantity || 0)
      );
    } catch {
      alert("حدث خطأ غير متوقع أثناء تحميل بيانات المستثمر");
      setInvestor(null);
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  async function loadInventoryPage(
    currentBranchId: string,
    requestedPage: number,
    isCancelled: () => boolean = () => false
  ) {
    setInventoryLoading(true);

    try {
      const from =
        (requestedPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from("finance_inventory")
        .select(
          `
            id,
            branch_id,
            investor_id,
            product_id,
            quantity,
            updated_at,
            finance_products(
              product_name,
              product_category
            )
          `,
          {
            count: "exact",
          }
        )
        .eq("branch_id", currentBranchId)
        .eq("investor_id", investorId)
        .order("updated_at", {
          ascending: false,
        })
        .range(from, to);

      if (isCancelled()) return;

      if (error) {
        alert(
          error.message ||
            "تعذر تحميل منتجات المستثمر"
        );

        setInventory([]);
        setTotalInventoryRows(0);
        return;
      }

      const currentTotal = count || 0;

      const calculatedTotalPages = Math.max(
        1,
        Math.ceil(currentTotal / ITEMS_PER_PAGE)
      );

      if (requestedPage > calculatedTotalPages) {
        setTotalInventoryRows(currentTotal);
        setCurrentPage(calculatedTotalPages);
        return;
      }

      setInventory((data || []) as InventoryItem[]);
      setTotalInventoryRows(currentTotal);
    } catch {
      if (!isCancelled()) {
        alert(
          "حدث خطأ غير متوقع أثناء تحميل منتجات المستثمر"
        );

        setInventory([]);
        setTotalInventoryRows(0);
      }
    } finally {
      if (!isCancelled()) {
        setInventoryLoading(false);
      }
    }
  }

  async function toggleInvestorStatus() {
    if (statusLoadingRef.current || statusLoading) return;

    if (!checkLogin()) return;

    if (!hasPermission("toggle_investor")) {
      alert("لا تملك صلاحية تعطيل أو تفعيل المستثمرين");
      return;
    }

    if (!investor || !branchId) return;

    const confirmed = confirm(
      investor.is_active
        ? "هل تريد تعطيل هذا المستثمر؟"
        : "هل تريد تفعيل هذا المستثمر؟"
    );

    if (!confirmed) return;

    statusLoadingRef.current = true;
    setStatusLoading(true);

    try {
      const newStatus = !investor.is_active;

      const { error } = await supabase
        .from("finance_investors")
        .update({
          is_active: newStatus,
        })
        .eq("id", investorId)
        .eq("branch_id", branchId);

      if (error) {
        alert(
          error.message ||
            "تعذر تعديل حالة المستثمر"
        );
        return;
      }

      setInvestor((currentInvestor) =>
        currentInvestor
          ? {
              ...currentInvestor,
              is_active: newStatus,
            }
          : currentInvestor
      );
    } catch {
      alert("حدث خطأ غير متوقع أثناء تعديل حالة المستثمر");
    } finally {
      statusLoadingRef.current = false;
      setStatusLoading(false);
    }
  }

  function getProductData(item: InventoryItem) {
    if (Array.isArray(item.finance_products)) {
      return item.finance_products[0] || null;
    }

    return item.finance_products;
  }

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

                {!isMobile && (
                  <div style={employeeDividerSmall} />
                )}

                <button
                  type="button"
                  style={logoutInlineButton}
                  onClick={logout}
                >
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                type="button"
                style={getMainWorkstationButtonStyle(
                  isMobile
                )}
                onClick={() =>
                  router.push(`/finance/${branch}`)
                }
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>
                ملف المستثمر
              </h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        {loading ? (
          <div style={loadingBox}>
            جاري تحميل بيانات المستثمر...
          </div>
        ) : !investor ? (
          <>
            <div style={loadingBox}>
              لم يتم العثور على المستثمر
            </div>

            <div style={backWrapper}>
              <button
                type="button"
                style={backButton}
                onClick={() => router.back()}
              >
                الرجوع
              </button>
            </div>
          </>
        ) : (
          <>
            <section style={investorHeroCard}>
              <h2 style={investorHeroTitle}>
                {investor.investor_name || "-"}
              </h2>

              <span
                style={
                  investor.is_active
                    ? activeBadge
                    : inactiveBadge
                }
              >
                {investor.is_active ? "نشط" : "معطل"}
              </span>
            </section>

            <section style={summaryGrid}>
              <SummaryBox
                title="عدد المنتجات"
                value={productsCount}
              />

              <SummaryBox
                title="إجمالي المخزون"
                value={totalQuantity}
              />

              <SummaryBox
                title="عدد العقود"
                value={contractsCount}
              />
            </section>

            <section style={card}>
              <h2 style={sectionTitle}>بيانات المستثمر</h2>

              <Row
                label="اسم المستثمر"
                value={investor.investor_name || "-"}
              />

              <Row
                label="رقم الهوية"
                value={investor.national_id || "-"}
              />

              <Row
                label="رقم الجوال"
                value={investor.phone || "-"}
              />

              <Row
                label="الملاحظات"
                value={investor.notes || "-"}
              />

              <Row
                label="تاريخ الإنشاء"
                value={formatDate(investor.created_at)}
              />
            </section>

            <section style={actionsSection}>
              <ActionButton
                title="🧾 كشف المستثمر"
                onClick={() =>
                  router.push(
                    `/finance/${branch}/inventory/investor-report?investor=${investorId}`
                  )
                }
              />

              {hasPermission("edit_investor") && (
                <ActionButton
                  title="✏️ تعديل المستثمر"
                  onClick={() =>
                    router.push(
                      `/finance/${branch}/inventory/investors/${investorId}/edit`
                    )
                  }
                />
              )}

              {hasPermission("toggle_investor") && (
                <button
                  type="button"
                  style={{
                    ...(investor.is_active
                      ? dangerButton
                      : activateButton),
                    opacity: statusLoading ? 0.65 : 1,
                    cursor: statusLoading
                      ? "not-allowed"
                      : "pointer",
                  }}
                  onClick={toggleInvestorStatus}
                  disabled={statusLoading}
                >
                  {statusLoading
                    ? "جاري التنفيذ..."
                    : investor.is_active
                    ? "تعطيل المستثمر"
                    : "تفعيل المستثمر"}
                </button>
              )}
            </section>

            <section style={card}>
              <div style={productsHeader}>
                <h2 style={sectionTitle}>
                  منتجات المستثمر
                </h2>

                {!inventoryLoading &&
                  totalInventoryRows > 0 && (
                    <span style={pageInfo}>
                      صفحة {currentPage} من {totalPages} -
                      عرض {inventory.length} من{" "}
                      {totalInventoryRows}
                    </span>
                  )}
              </div>

              <div style={tableHeader}>
                <span>المنتج</span>
                <span>التصنيف</span>
                <span>الكمية الحالية</span>
                <span>آخر تحديث</span>
              </div>

              {inventoryLoading ? (
                <div style={emptyBox}>
                  جاري تحميل المنتجات...
                </div>
              ) : inventory.length === 0 ? (
                <div style={emptyBox}>
                  لا توجد منتجات مرتبطة بهذا المستثمر
                </div>
              ) : (
                inventory.map((item) => {
                  const product = getProductData(item);

                  return (
                    <div key={item.id} style={tableRow}>
                      <span>
                        {product?.product_name || "-"}
                      </span>

                      <span>
                        {product?.product_category || "-"}
                      </span>

                      <strong>
                        {Number(item.quantity || 0)}
                      </strong>

                      <span>
                        {formatDate(item.updated_at)}
                      </span>
                    </div>
                  );
                })
              )}

              {!inventoryLoading &&
                totalInventoryRows > ITEMS_PER_PAGE && (
                  <div style={paginationBox}>
                    <button
                      type="button"
                      style={{
                        ...paginationButton,
                        opacity:
                          currentPage === 1 ? 0.5 : 1,
                        cursor:
                          currentPage === 1
                            ? "not-allowed"
                            : "pointer",
                      }}
                      disabled={
                        currentPage === 1 ||
                        inventoryLoading
                      }
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.max(page - 1, 1)
                        )
                      }
                    >
                      السابق
                    </button>

                    <span style={paginationText}>
                      صفحة {currentPage} من {totalPages}
                    </span>

                    <button
                      type="button"
                      style={{
                        ...paginationButton,
                        opacity:
                          currentPage === totalPages
                            ? 0.5
                            : 1,
                        cursor:
                          currentPage === totalPages
                            ? "not-allowed"
                            : "pointer",
                      }}
                      disabled={
                        currentPage === totalPages ||
                        inventoryLoading
                      }
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.min(
                            page + 1,
                            totalPages
                          )
                        )
                      }
                    >
                      التالي
                    </button>
                  </div>
                )}
            </section>

            <div style={backWrapper}>
              <button
                type="button"
                style={backButton}
                onClick={() => router.back()}
              >
                الرجوع
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function formatDate(date?: string | null) {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleDateString(
    "ar-SA-u-ca-gregory",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div style={row}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryBox({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div style={summaryBox}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionButton({
  title,
  onClick,
}: {
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      style={actionButton}
      onClick={onClick}
    >
      {title}
    </button>
  );
}

function UserIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    backgroundAttachment: isMobile
      ? "scroll"
      : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

function getContainerStyle(
  isCompact: boolean
): CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact ? 980 : 1180,
    margin: "auto",
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile ? "auto" : 160,
    borderRadius: isMobile ? 20 : 24,
    padding: isMobile
      ? "18px 14px"
      : "22px 26px",
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

function getHeroContentStyle(
  screen: ScreenType
): CSSProperties {
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
    gridTemplateColumns:
      "minmax(250px, 315px) 1fr minmax(220px, 315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(
  screen: ScreenType
): CSSProperties {
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

function getEmployeeTopRowStyle(
  screen: ScreenType
): CSSProperties {
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

function getEmployeeNameStyle(
  isMobile: boolean
): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow:
      "0 4px 10px rgba(15,23,42,0.18)",
  };
}

function getMainWorkstationButtonStyle(
  isMobile: boolean
): CSSProperties {
  return {
    width: isMobile ? "100%" : 220,
    maxWidth: isMobile ? 280 : 220,
    height: 44,
    border: "none",
    background:
      "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily:
      "var(--font-almarai), sans-serif",
    boxShadow:
      "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(
  screen: ScreenType
): CSSProperties {
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

function getTitleStyle(
  screen: ScreenType
): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize:
      screen === "mobile"
        ? 26
        : screen === "tablet"
        ? 28
        : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  if (
    screen === "mobile" ||
    screen === "tablet"
  ) {
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
  border:
    "1.5px solid rgba(255,255,255,0.34)",
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
  fontFamily:
    "var(--font-almarai), sans-serif",
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

const investorHeroCard: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 20,
  padding: 18,
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const investorHeroTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 900,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const summaryBox: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  color: "#0d47a1",
  fontWeight: "bold",
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const card: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  overflowX: "auto",
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const sectionTitle: CSSProperties = {
  margin: 0,
  color: "#0d47a1",
  fontSize: 22,
};

const productsHeader: CSSProperties = {
  minWidth: 850,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const pageInfo: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: "bold",
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
};

const actionsSection: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const actionButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "white",
  color: "#0d47a1",
  border: "1px solid #d9e3f5",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const dangerButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const activateButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#dcfce7",
  color: "#166534",
  border: "none",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "2fr 1.5fr 1fr 1.5fr",
  gap: 12,
  minWidth: 850,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "2fr 1.5fr 1fr 1.5fr",
  gap: 12,
  minWidth: 850,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const emptyBox: CSSProperties = {
  minWidth: 850,
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  textAlign: "center",
  color: "#6b7280",
};

const activeBadge: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const inactiveBadge: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const paginationBox: CSSProperties = {
  minWidth: 850,
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
  fontFamily:
    "var(--font-almarai), sans-serif",
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
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const loadingBox: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  textAlign: "center",
  color: "#0d47a1",
  fontWeight: "bold",
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};
