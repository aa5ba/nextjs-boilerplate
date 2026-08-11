"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber } from "@/lib/numberUtils";

const ITEMS_PER_PAGE = 25;

type ScreenType = "mobile" | "tablet" | "desktop";

type InvestorRow = {
  id: string;
  branch_id: string;
  investor_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  productsCount: number;
  totalQuantity: number;
};

export default function InvestorsPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "");

  const [authChecked, setAuthChecked] = useState(false);
  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [branchId, setBranchId] = useState<string | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalInvestors, setTotalInvestors] = useState(0);
  const [loading, setLoading] = useState(true);

  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(
    null
  );

  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const totalPages = Math.max(
    1,
    Math.ceil(totalInvestors / ITEMS_PER_PAGE)
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

    return () => {
      window.removeEventListener("resize", updateScreen);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      await initializePage(() => cancelled);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [branch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    if (typeof branchId !== "string" || branchId.length === 0) {
      return;
    }

    const safeBranchId: string = branchId;
    let cancelled = false;

    async function run() {
      await loadInvestors(
        safeBranchId,
        currentPage,
        search,
        () => cancelled
      );
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [authChecked, branchId, currentPage, search]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  async function initializePage(isCancelled: () => boolean) {
    const isLoggedIn = checkLogin();

    if (!isLoggedIn || isCancelled()) {
      return;
    }

    loadEmployeeName();
    loadCurrentUserPermissions();

    setLoading(true);
    setBranchId(null);
    setInvestors([]);
    setTotalInvestors(0);
    setCurrentPage(1);

    try {
      const resolvedBranchId = await getBranchId(branch);

      if (isCancelled()) {
        return;
      }

      if (
        typeof resolvedBranchId !== "string" ||
        resolvedBranchId.length === 0
      ) {
        setLoading(false);
        alert("تعذر تحديد الفرع");
        return;
      }

      setBranchId(resolvedBranchId);
    } catch (error) {
      console.error("Initialize investors page error:", error);

      if (!isCancelled()) {
        setLoading(false);
        alert("حدث خطأ أثناء تحديد الفرع");
      }
    }
  }

  function checkLogin() {
    if (typeof window === "undefined") {
      return false;
    }

    const savedUser = localStorage.getItem("finance_user");
    const savedBranchUser = localStorage.getItem(
      "finance_branch_user"
    );
    const savedUserName = localStorage.getItem(
      "finance_user_name"
    );

    if (!savedUser && !savedBranchUser && !savedUserName) {
      router.replace("/login");
      return false;
    }

    setAuthChecked(true);
    return true;
  }

  function loadEmployeeName() {
    if (typeof window === "undefined") {
      return;
    }

    const directName = localStorage.getItem(
      "finance_user_name"
    );

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

  function clearFinanceSession() {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem("finance_user");
    localStorage.removeItem("finance_branch_user");
    localStorage.removeItem("finance_user_id");
    localStorage.removeItem("finance_user_name");
    localStorage.removeItem("finance_username");
    localStorage.removeItem("finance_role");
    localStorage.removeItem("finance_branch_id");
    localStorage.removeItem("finance_branch_slug");
    localStorage.removeItem("finance_branch_name");
    localStorage.removeItem("finance_organization_name");
  }

  function logout() {
    clearFinanceSession();
    router.replace("/login");
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
      roles.includes("مدير فرع") ||
      roles.includes("مدير") ||
      permissions.includes(permissionKey)
    );
  }

  function sanitizeSearchValue(value: string) {
    return value.trim().replace(/[(),.%]/g, " ");
  }

  async function loadInvestors(
    currentBranchId: string,
    requestedPage: number,
    searchValue: string,
    isCancelled: () => boolean = () => false
  ) {
    setLoading(true);

    try {
      const from = (requestedPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const cleanSearch = sanitizeSearchValue(searchValue);
      const normalizedSearch = normalizeNumber(cleanSearch);

      let query = supabase
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
          `,
          {
            count: "exact",
          }
        )
        .eq("branch_id", currentBranchId)
        .eq("is_archived", false)
        .order("created_at", {
          ascending: false,
        })
        .range(from, to);

      if (cleanSearch) {
        query = query.or(
          [
            `investor_name.ilike.%${cleanSearch}%`,
            `national_id.ilike.%${normalizedSearch}%`,
            `phone.ilike.%${normalizedSearch}%`,
          ].join(",")
        );
      }

      const {
        data: investorsData,
        error: investorsError,
        count,
      } = await query;

      if (isCancelled()) {
        return;
      }

      if (investorsError) {
        alert(
          investorsError.message || "تعذر تحميل المستثمرين"
        );

        setInvestors([]);
        setTotalInvestors(0);
        return;
      }

      const currentTotal = count || 0;

      const calculatedTotalPages = Math.max(
        1,
        Math.ceil(currentTotal / ITEMS_PER_PAGE)
      );

      if (requestedPage > calculatedTotalPages) {
        setTotalInvestors(currentTotal);
        setCurrentPage(calculatedTotalPages);
        return;
      }

      const currentInvestors = investorsData || [];

      const investorIds = currentInvestors.map(
        (investor) => investor.id
      );

      if (investorIds.length === 0) {
        setInvestors([]);
        setTotalInvestors(currentTotal);
        return;
      }

      const {
        data: inventoryData,
        error: inventoryError,
      } = await supabase
        .from("finance_inventory")
        .select("investor_id, product_id, quantity")
        .eq("branch_id", currentBranchId)
        .in("investor_id", investorIds);

      if (isCancelled()) {
        return;
      }

      if (inventoryError) {
        alert(
          inventoryError.message ||
            "تعذر تحميل بيانات مخزون المستثمرين"
        );

        setInvestors([]);
        setTotalInvestors(currentTotal);
        return;
      }

      const inventoryByInvestor = new Map<
        string,
        {
          products: Set<string>;
          totalQuantity: number;
        }
      >();

      (inventoryData || []).forEach((item) => {
        const investorId = item.investor_id;

        if (!investorId) {
          return;
        }

        const current =
          inventoryByInvestor.get(investorId) || {
            products: new Set<string>(),
            totalQuantity: 0,
          };

        if (item.product_id) {
          current.products.add(item.product_id);
        }

        current.totalQuantity += Number(item.quantity || 0);

        inventoryByInvestor.set(investorId, current);
      });

      const enrichedInvestors: InvestorRow[] =
        currentInvestors.map((investor) => {
          const summary = inventoryByInvestor.get(investor.id);

          return {
            ...investor,
            productsCount: summary?.products.size || 0,
            totalQuantity: summary?.totalQuantity || 0,
          };
        });

      if (isCancelled()) {
        return;
      }

      setInvestors(enrichedInvestors);
      setTotalInvestors(currentTotal);
    } catch (error) {
      console.error("Load investors error:", error);

      if (!isCancelled()) {
        alert(
          "حدث خطأ غير متوقع أثناء تحميل المستثمرين"
        );

        setInvestors([]);
        setTotalInvestors(0);
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  async function toggleInvestorStatus(
    investor: InvestorRow
  ) {
    if (statusLoadingId) {
      return;
    }

    if (!checkLogin()) {
      return;
    }

    if (!hasPermission("toggle_investor")) {
      alert("لا تملك صلاحية تعطيل أو تفعيل المستثمرين");
      return;
    }

    const confirmed = window.confirm(
      investor.is_active
        ? "هل تريد تعطيل هذا المستثمر؟"
        : "هل تريد تفعيل هذا المستثمر؟"
    );

    if (!confirmed) {
      return;
    }

    const resolvedBranchId =
      branchId || (await getBranchId(branch));

    if (
      typeof resolvedBranchId !== "string" ||
      resolvedBranchId.length === 0
    ) {
      alert("تعذر تحديد الفرع");
      return;
    }

    const safeBranchId: string = resolvedBranchId;

    try {
      setStatusLoadingId(investor.id);

      const response = await fetch(
        `/finance/api/investors/${encodeURIComponent(investor.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            branch,
            action: "toggle",
            isActive:
              !investor.is_active,
          }),
        }
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok || !payload?.ok) {
        alert(
          payload?.message ||
            "تعذر تعديل حالة المستثمر"
        );
        return;
      }

      await loadInvestors(
        safeBranchId,
        currentPage,
        search
      );
    } catch (error) {
      console.error("Toggle investor status error:", error);

      alert(
        "حدث خطأ غير متوقع أثناء تعديل حالة المستثمر"
      );
    } finally {
      setStatusLoadingId(null);
    }
  }

  async function archiveInvestor(
    investor: InvestorRow
  ) {
    if (statusLoadingId) {
      return;
    }

    if (!checkLogin()) {
      return;
    }

    if (!hasPermission("edit_investor")) {
      alert("لا تملك صلاحية أرشفة المستثمرين");
      return;
    }

    const confirmed = window.confirm(
      `هل تريد أرشفة المستثمر ${investor.investor_name || ""}؟ سيختفي من قائمة المستثمرين النشطة.`
    );

    if (!confirmed) {
      return;
    }

    const resolvedBranchId =
      branchId ||
      (await getBranchId(branch));

    if (!resolvedBranchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    try {
      setStatusLoadingId(investor.id);

      const response = await fetch(
        `/finance/api/investors/${encodeURIComponent(investor.id)}?branch=${encodeURIComponent(branch)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok || !payload?.ok) {
        alert(
          payload?.message ||
            "تعذر أرشفة المستثمر"
        );
        return;
      }

      await loadInvestors(
        resolvedBranchId,
        currentPage,
        search
      );
    } catch (error) {
      console.error(
        "Archive investor error:",
        error
      );

      alert(
        "حدث خطأ غير متوقع أثناء أرشفة المستثمر"
      );
    } finally {
      setStatusLoadingId(null);
    }
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
                إدارة المستثمرين
              </h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        <section style={card}>
          <div
            style={
              isCompact
                ? topActionsCompact
                : topActions
            }
          >
            <input
              type="search"
              style={searchInput}
              placeholder="البحث باسم المستثمر أو الهوية أو الجوال"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            {hasPermission("add_investor") && (
              <button
                type="button"
                style={addButton}
                onClick={() =>
                  router.push(
                    `/finance/${branch}/inventory/investors/new`
                  )
                }
              >
                ➕ إضافة مستثمر
              </button>
            )}
          </div>
        </section>

        <section style={card}>
          <div style={listHeader}>
            <h2 style={sectionTitle}>
              قائمة المستثمرين
            </h2>

            {!loading && totalInvestors > 0 && (
              <span style={pageInfo}>
                صفحة {currentPage} من {totalPages} -
                عرض {investors.length} من{" "}
                {totalInvestors}
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

          {loading ? (
            <div style={emptyBox}>
              جاري تحميل المستثمرين...
            </div>
          ) : investors.length === 0 ? (
            <div style={emptyBox}>
              لا يوجد مستثمرون
            </div>
          ) : (
            investors.map((investor) => (
              <div
                key={investor.id}
                style={tableRow}
              >
                <button
                  type="button"
                  style={investorNameLink}
                  onClick={() =>
                    router.push(
                      `/finance/${branch}/inventory/investors/${investor.id}`
                    )
                  }
                >
                  {investor.investor_name || "-"}
                </button>

                <span>
                  {investor.national_id || "-"}
                </span>

                <span>{investor.phone || "-"}</span>

                <span>{investor.productsCount}</span>

                <strong>
                  {investor.totalQuantity}
                </strong>

                <span
                  style={
                    investor.is_active
                      ? activeBadge
                      : inactiveBadge
                  }
                >
                  {investor.is_active
                    ? "نشط"
                    : "معطل"}
                </span>

                <div style={actionsCell}>
                  <button
                    type="button"
                    style={smallButton}
                    onClick={() =>
                      router.push(
                        `/finance/${branch}/inventory/investor-report?investor=${investor.id}`
                      )
                    }
                  >
                    كشف
                  </button>

                  {hasPermission("edit_investor") && (
                    <button
                      type="button"
                      style={smallGrayButton}
                      onClick={() =>
                        router.push(
                          `/finance/${branch}/inventory/investors/${investor.id}/edit`
                        )
                      }
                    >
                      تعديل
                    </button>
                  )}

                  {hasPermission(
                    "toggle_investor"
                  ) && (
                    <button
                      type="button"
                      style={{
                        ...smallDangerButton,
                        opacity: statusLoadingId
                          ? 0.6
                          : 1,
                        cursor: statusLoadingId
                          ? "not-allowed"
                          : "pointer",
                      }}
                      onClick={() =>
                        void toggleInvestorStatus(
                          investor
                        )
                      }
                      disabled={Boolean(
                        statusLoadingId
                      )}
                    >
                      {statusLoadingId === investor.id
                        ? "جاري..."
                        : investor.is_active
                          ? "تعطيل"
                          : "تفعيل"}
                    </button>
                  )}

                  {hasPermission(
                    "edit_investor"
                  ) && (
                    <button
                      type="button"
                      style={{
                        ...smallDangerButton,
                        opacity: statusLoadingId
                          ? 0.6
                          : 1,
                        cursor: statusLoadingId
                          ? "not-allowed"
                          : "pointer",
                      }}
                      onClick={() =>
                        void archiveInvestor(
                          investor
                        )
                      }
                      disabled={Boolean(
                        statusLoadingId
                      )}
                    >
                      {statusLoadingId === investor.id
                        ? "جاري..."
                        : "أرشفة"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {!loading &&
            totalInvestors > ITEMS_PER_PAGE && (
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
                    currentPage === 1 || loading
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
                  صفحة {currentPage} من{" "}
                  {totalPages}
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
                    loading
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
      </div>
    </main>
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

function getPageStyle(
  isMobile: boolean
): CSSProperties {
  return {
    minHeight: "100vh",
    backgroundColor: "#f6f9ff",
    backgroundImage:
      "radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%), radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%), radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%), linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)), url('/backgrounds/v13-finance-bg-1.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: isMobile
      ? "scroll"
      : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily:
      "var(--font-almarai), sans-serif",
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

const topActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 180px",
  gap: 12,
  alignItems: "center",
};

const topActionsCompact: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
  alignItems: "center",
};

const searchInput: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const addButton: CSSProperties = {
  width: "100%",
  padding: 14,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const listHeader: CSSProperties = {
  minWidth: 1100,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const sectionTitle: CSSProperties = {
  margin: 0,
  color: "#0d47a1",
  fontSize: 22,
};

const pageInfo: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: "bold",
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.5fr 1.2fr 1.2fr 1fr 1fr 1fr 260px",
  gap: 12,
  minWidth: 1100,
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
    "1.5fr 1.2fr 1.2fr 1fr 1fr 1fr 260px",
  gap: 12,
  minWidth: 1100,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const investorNameLink: CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  cursor: "pointer",
  color: "#0d47a1",
  fontWeight: "bold",
  textAlign: "right",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const emptyBox: CSSProperties = {
  minWidth: 1100,
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
  padding: "6px 10px",
  fontWeight: "bold",
  textAlign: "center",
};

const inactiveBadge: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: "bold",
  textAlign: "center",
};

const actionsCell: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const smallButton: CSSProperties = {
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const smallGrayButton: CSSProperties = {
  background:
    "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  boxShadow:
    "0 4px 10px rgba(51,65,85,0.16)",
};

const smallDangerButton: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const paginationBox: CSSProperties = {
  minWidth: 1100,
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
    "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 5px 14px rgba(51,65,85,0.22)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};
