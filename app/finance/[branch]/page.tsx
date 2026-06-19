"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ScreenType = "mobile" | "tablet" | "desktop";

type FinanceUser = {
  id: string;
  branch_id: string;
  branch_slug: string;
  branch_name?: string;
  organization_name?: string;
  full_name?: string;
  username?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  logged_at?: string;
};

type SearchResult = {
  id: string;
  type: string;
  icon: string;
  title: string;
  subtitle: string;
  href: string;
};

type AlertItem = {
  id: string;
  type: "danger" | "green" | "blue";
  text: string;
  href: string;
};

type ActivityItem = {
  id: string;
  description?: string | null;
  details?: string | null;
  note?: string | null;
  action?: string | null;
  action_type?: string | null;
};

type ProductRelation =
  | {
      product_name?: string | null;
    }
  | {
      product_name?: string | null;
    }[]
  | null;

type InventoryAlertRow = {
  id: string;
  quantity?: number | string | null;
  product_name?: string | null;
  finance_products?: ProductRelation;
};

const sections = [
  {
    title: "سير العمل",
    path: "workflow",
    desc: "متابعة العمليات والتنبيهات",
    icon: "💼",
    color: "#2563eb",
    bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
    permission: "workflow",
  },
  {
    title: "العملاء",
    path: "customers",
    desc: "إدارة العملاء والملفات",
    icon: "👥",
    color: "#0284c7",
    bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)",
    permission: "customers",
  },
  {
    title: "طلب جديد",
    path: "new-request",
    desc: "إنشاء عقد وسند جديد",
    icon: "➕",
    color: "#16a34a",
    bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
    permission: "contracts",
  },
  {
    title: "السداد",
    path: "payments",
    desc: "تسجيل ومتابعة الدفعات",
    icon: "💳",
    color: "#059669",
    bg: "linear-gradient(135deg,#ecfdf5,#d1fae5)",
    permission: "payments",
  },
  {
    title: "المخزون",
    path: "inventory",
    desc: "المنتجات والمستثمرين",
    icon: "📦",
    color: "#0f766e",
    bg: "linear-gradient(135deg,#f0fdfa,#ccfbf1)",
    permission: "inventory",
  },
  {
    title: "العقود",
    path: "contracts",
    desc: "بحث وطباعة ومتابعة",
    icon: "📄",
    color: "#1d4ed8",
    bg: "linear-gradient(135deg,#eef2ff,#dbeafe)",
    permission: "contracts",
  },
  {
    title: "المصروفات",
    path: "expenses",
    desc: "المشتريات والمصروفات",
    icon: "🧾",
    color: "#475569",
    bg: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
    permission: "expenses",
  },
  {
    title: "الملاحظات",
    path: "notes",
    desc: "ملاحظات وتذكيرات",
    icon: "✏️",
    color: "#0ea5e9",
    bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)",
    permission: "workflow",
  },
  {
    title: "الصلاحيات",
    path: "permissions",
    desc: "المستخدمون والأدوار",
    icon: "🔐",
    color: "#334155",
    bg: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
    permission: "permissions",
  },
  {
    title: "الإعدادات",
    path: "settings",
    desc: "بيانات الفرع والمنظمة",
    icon: "⚙️",
    color: "#0f172a",
    bg: "linear-gradient(135deg,#f1f5f9,#e2e8f0)",
    permission: "settings",
  },
];

export default function FinancePage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "");

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [organizationName, setOrganizationName] =
    useState("جاري التحميل...");
  const [employeeName, setEmployeeName] = useState("الموظف");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const [customersCount, setCustomersCount] = useState(0);
  const [contractsCount, setContractsCount] = useState(0);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [latestActivities, setLatestActivities] = useState<ActivityItem[]>([]);

  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const today = new Date().toLocaleDateString("en-CA");

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
    if (!branch) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function run() {
      await checkLoginAndLoadBranch(() => cancelled);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [branch]);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    if (typeof branchId !== "string" || branchId.length === 0) {
      return;
    }

    const safeBranchId: string = branchId;
    let cancelled = false;

    async function run() {
      await loadDashboardData(safeBranchId, () => cancelled);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [authorized, branchId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSmartSearch();
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchText, branchId, permissions, roles, authorized]);

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

  function redirectToLogin() {
    clearFinanceSession();
    setAuthorized(false);
    setBranchId(null);
    router.replace("/login");
  }

  function getLocalUser(): FinanceUser | null {
    if (typeof window === "undefined") {
      return null;
    }

    const savedUser =
      localStorage.getItem("finance_user") ||
      localStorage.getItem("finance_branch_user");

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as Partial<FinanceUser>;

        if (
          typeof parsedUser.id === "string" &&
          typeof parsedUser.branch_id === "string" &&
          typeof parsedUser.branch_slug === "string"
        ) {
          return {
            id: parsedUser.id,
            branch_id: parsedUser.branch_id,
            branch_slug: parsedUser.branch_slug,
            branch_name: parsedUser.branch_name || "",
            organization_name: parsedUser.organization_name || "احتساب",
            full_name: parsedUser.full_name || "الموظف",
            username: parsedUser.username || "",
            role: parsedUser.role || "",
            roles: Array.isArray(parsedUser.roles)
              ? parsedUser.roles.filter(
                  (role): role is string => typeof role === "string"
                )
              : parsedUser.role
                ? [parsedUser.role]
                : [],
            permissions: Array.isArray(parsedUser.permissions)
              ? parsedUser.permissions.filter(
                  (permission): permission is string =>
                    typeof permission === "string"
                )
              : [],
            logged_at: parsedUser.logged_at || new Date().toISOString(),
          };
        }
      } catch {
        // تتم محاولة قراءة المفاتيح القديمة أدناه.
      }
    }

    const id = localStorage.getItem("finance_user_id");
    const role = localStorage.getItem("finance_role");
    const savedBranchId = localStorage.getItem("finance_branch_id");
    const branchSlug = localStorage.getItem("finance_branch_slug");

    if (!id || !role || !savedBranchId || !branchSlug) {
      return null;
    }

    return {
      id,
      branch_id: savedBranchId,
      branch_slug: branchSlug,
      branch_name: localStorage.getItem("finance_branch_name") || "",
      organization_name:
        localStorage.getItem("finance_organization_name") || "احتساب",
      full_name: localStorage.getItem("finance_user_name") || "الموظف",
      username: localStorage.getItem("finance_username") || "",
      role,
      roles: [role],
      permissions: [],
      logged_at: new Date().toISOString(),
    };
  }

  async function checkLoginAndLoadBranch(
    isCancelled: () => boolean = () => false
  ) {
    const localUser = getLocalUser();

    if (!localUser) {
      redirectToLogin();
      return;
    }

    if (localUser.branch_slug !== branch) {
      if (localUser.branch_slug) {
        router.replace(`/finance/${localUser.branch_slug}`);
        return;
      }

      redirectToLogin();
      return;
    }

    const localRoles =
      Array.isArray(localUser.roles) && localUser.roles.length > 0
        ? localUser.roles
        : localUser.role
          ? [localUser.role]
          : [];

    const localPermissions = Array.isArray(localUser.permissions)
      ? localUser.permissions
      : [];

    setOrganizationName(localUser.organization_name || "احتساب");
    setBranchId(localUser.branch_id);
    setEmployeeName(
      localUser.full_name || localUser.username || "الموظف"
    );
    setRoles(localRoles);
    setPermissions(localPermissions);

    const { data: branchData, error: branchError } = await supabase
      .from("finance_branches")
      .select("id, organization_name, branch_name, branch_slug, is_active")
      .eq("branch_slug", branch)
      .maybeSingle();

    if (isCancelled()) {
      return;
    }

    if (branchError || !branchData || !branchData.is_active) {
      redirectToLogin();
      return;
    }

    if (localUser.branch_id !== branchData.id) {
      redirectToLogin();
      return;
    }

    const { data: freshUser, error: userError } = await supabase
      .from("finance_branch_users")
      .select("id, branch_id, full_name, username, role, is_active")
      .eq("id", localUser.id)
      .eq("branch_id", branchData.id)
      .maybeSingle();

    if (isCancelled()) {
      return;
    }

    if (userError || !freshUser || !freshUser.is_active) {
      redirectToLogin();
      return;
    }

    const freshRole =
      typeof freshUser.role === "string" ? freshUser.role : "";

    const userRoles = freshRole ? [freshRole] : localRoles;

    const refreshedUser: FinanceUser = {
      id: String(freshUser.id),
      branch_id: String(branchData.id),
      branch_slug: String(branchData.branch_slug),
      branch_name: branchData.branch_name || "",
      organization_name: branchData.organization_name || "احتساب",
      full_name:
        freshUser.full_name || freshUser.username || "الموظف",
      username: freshUser.username || "",
      role: freshRole,
      roles: userRoles,
      permissions: localPermissions,
      logged_at: localUser.logged_at || new Date().toISOString(),
    };

    setOrganizationName(refreshedUser.organization_name || "احتساب");
    setBranchId(refreshedUser.branch_id);
    setEmployeeName(
      refreshedUser.full_name || refreshedUser.username || "الموظف"
    );
    setRoles(userRoles);
    setPermissions(localPermissions);
    setAuthorized(true);

    localStorage.setItem("finance_user_id", refreshedUser.id);
    localStorage.setItem(
      "finance_user_name",
      refreshedUser.full_name || ""
    );
    localStorage.setItem(
      "finance_username",
      refreshedUser.username || ""
    );
    localStorage.setItem("finance_role", refreshedUser.role || "");
    localStorage.setItem("finance_branch_id", refreshedUser.branch_id);
    localStorage.setItem("finance_branch_slug", refreshedUser.branch_slug);
    localStorage.setItem(
      "finance_branch_name",
      refreshedUser.branch_name || ""
    );
    localStorage.setItem(
      "finance_organization_name",
      refreshedUser.organization_name || "احتساب"
    );
    localStorage.setItem(
      "finance_user",
      JSON.stringify(refreshedUser)
    );
  }

  function hasPermission(permissionKey: string) {
    return (
      roles.includes("main_admin") ||
      roles.includes("branch_manager") ||
      roles.includes("employee") ||
      roles.includes("مدير فرع") ||
      roles.includes("مدير رئيسي") ||
      roles.includes("مدير") ||
      permissions.includes(permissionKey)
    );
  }

  const visibleSections = useMemo(() => {
    if (!authorized) {
      return [];
    }

    return sections.filter((item) =>
      hasPermission(item.permission)
    );
  }, [permissions, roles, authorized]);

  async function loadDashboardData(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    await Promise.all([
      loadCounts(currentBranchId, isCancelled),
      loadAlerts(currentBranchId, isCancelled),
      loadLatestActivities(currentBranchId, isCancelled),
    ]);
  }

  async function loadCounts(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    const [customersResult, contractsResult] = await Promise.all([
      supabase
        .from("finance_customers")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", currentBranchId),

      supabase
        .from("finance_contracts")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", currentBranchId),
    ]);

    if (isCancelled()) {
      return;
    }

    setCustomersCount(customersResult.count || 0);
    setContractsCount(contractsResult.count || 0);
  }

  async function loadAlerts(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    const newAlerts: AlertItem[] = [];

    const [negativeResult, lowResult] = await Promise.all([
      supabase
        .from("finance_inventory")
        .select(
          `
            id,
            quantity,
            finance_products(product_name)
          `
        )
        .eq("branch_id", currentBranchId)
        .lt("quantity", 0)
        .limit(3),

      supabase
        .from("finance_inventory")
        .select(
          `
            id,
            quantity,
            finance_products(product_name)
          `
        )
        .eq("branch_id", currentBranchId)
        .gte("quantity", 0)
        .lte("quantity", 5)
        .limit(3),
    ]);

    if (isCancelled()) {
      return;
    }

    const negativeInventory =
      (negativeResult.data || []) as InventoryAlertRow[];

    const lowInventory =
      (lowResult.data || []) as InventoryAlertRow[];

    negativeInventory.forEach((item) => {
      newAlerts.push({
        id: `negative-${item.id}`,
        type: "danger",
        text: `منتج بالسالب: ${getProductName(item)} - الكمية ${
          item.quantity || 0
        }`,
        href: `/finance/${branch}/inventory`,
      });
    });

    lowInventory.forEach((item) => {
      newAlerts.push({
        id: `low-${item.id}`,
        type: "green",
        text: `منتج منخفض: ${getProductName(item)} - الكمية ${
          item.quantity || 0
        }`,
        href: `/finance/${branch}/inventory`,
      });
    });

    if (newAlerts.length === 0) {
      newAlerts.push({
        id: "safe",
        type: "blue",
        text: "لا توجد تنبيهات مهمة حالياً",
        href: `/finance/${branch}/inventory`,
      });
    }

    setAlerts(newAlerts.slice(0, 3));
  }

  async function loadLatestActivities(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    const { data } = await supabase
      .from("finance_activity_logs")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (isCancelled()) {
      return;
    }

    setLatestActivities((data || []) as ActivityItem[]);
  }

  function getProductName(item: InventoryAlertRow) {
    const relation = item.finance_products;

    if (Array.isArray(relation)) {
      return relation[0]?.product_name || item.product_name || "منتج غير محدد";
    }

    return relation?.product_name || item.product_name || "منتج غير محدد";
  }

  function getActivityText(item: ActivityItem) {
    return (
      item.description ||
      item.details ||
      item.note ||
      item.action ||
      item.action_type ||
      "عملية جديدة"
    );
  }

  function normalizeDigits(value: string) {
    return value
      .replace(/[٠-٩]/g, (digit) =>
        "٠١٢٣٤٥٦٧٨٩".indexOf(digit).toString()
      )
      .replace(/[۰-۹]/g, (digit) =>
        "۰۱۲۳۴۵۶۷۸۹".indexOf(digit).toString()
      );
  }

  async function runSmartSearch() {
    const query = normalizeDigits(searchText.trim());

    if (
      !authorized ||
      typeof branchId !== "string" ||
      branchId.length === 0 ||
      query.length < 2
    ) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const safeBranchId: string = branchId;
    const safeQuery = query.replace(/[(),.%]/g, " ");

    setSearchLoading(true);

    try {
      const customerRequest = hasPermission("customers")
        ? supabase
            .from("finance_customers")
            .select("id, full_name, national_id, phone")
            .eq("branch_id", safeBranchId)
            .or(
              `full_name.ilike.%${safeQuery}%,national_id.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`
            )
            .limit(5)
        : Promise.resolve({ data: [], error: null });

      const contractRequest = hasPermission("contracts")
        ? supabase
            .from("finance_contracts")
            .select(
              "id, contract_number, customer_name, customer_national_id, customer_phone, investor_name"
            )
            .eq("branch_id", safeBranchId)
            .or(
              `contract_number.ilike.%${safeQuery}%,customer_name.ilike.%${safeQuery}%,customer_national_id.ilike.%${safeQuery}%,customer_phone.ilike.%${safeQuery}%,investor_name.ilike.%${safeQuery}%`
            )
            .limit(5)
        : Promise.resolve({ data: [], error: null });

      const investorRequest = hasPermission("inventory")
        ? supabase
            .from("finance_investors")
            .select(
              "id, investor_name, national_id, commercial_record"
            )
            .eq("branch_id", safeBranchId)
            .or(
              `investor_name.ilike.%${safeQuery}%,national_id.ilike.%${safeQuery}%,commercial_record.ilike.%${safeQuery}%`
            )
            .limit(5)
        : Promise.resolve({ data: [], error: null });

      const [
        customersResult,
        contractsResult,
        investorsResult,
      ] = await Promise.all([
        customerRequest,
        contractRequest,
        investorRequest,
      ]);

      const customers: SearchResult[] =
        customersResult.data?.map((item: any) => ({
          id: String(item.id),
          type: "عميل",
          icon: "👤",
          title: item.full_name || "-",
          subtitle: `${item.phone || "-"} | ${
            item.national_id || "-"
          }`,
          href: `/finance/${branch}/customers/${item.id}`,
        })) || [];

      const contracts: SearchResult[] =
        contractsResult.data?.map((item: any) => ({
          id: String(item.id),
          type: "عقد",
          icon: "📄",
          title: `عقد رقم ${item.contract_number || "-"}`,
          subtitle: `${item.customer_name || "-"} | ${
            item.customer_phone || "-"
          } | ${item.investor_name || "-"}`,
          href: `/finance/${branch}/contracts/${item.id}`,
        })) || [];

      const investors: SearchResult[] =
        investorsResult.data?.map((item: any) => ({
          id: String(item.id),
          type: "مستثمر",
          icon: "🏦",
          title: item.investor_name || "-",
          subtitle:
            item.national_id ||
            item.commercial_record ||
            "-",
          href: `/finance/${branch}/inventory/investors/${item.id}`,
        })) || [];

      setSearchResults([
        ...customers,
        ...contracts,
        ...investors,
      ]);
    } catch (error) {
      console.error("Smart search error:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function go(path: string) {
    router.push(`/finance/${branch}/${path}`);
  }

  function logout() {
    redirectToLogin();
  }

  if (!authorized) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <section style={getHeroStyle(isMobile)}>
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div style={loadingHeroContent}>
              <h1 style={getTitleStyle(screen)}>
                جاري التحقق من تسجيل الدخول...
              </h1>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <section style={getHeroStyle(isMobile)}>
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
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getOrganizationTitleStyle(screen)}>
                {organizationName}
              </h1>

              <div style={getWorkstationTitleStyle(screen)}>
                محطة العمل الرئيسية
              </div>
            </div>

            <div style={getHeroActionBoxStyle(screen)}>
              <div style={dateBox}>
                <span style={dateLabel}>التاريخ</span>
                <strong style={dateText}>{today}</strong>
              </div>
            </div>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard
            title="العقود"
            value={contractsCount}
            icon="📄"
            color="#2563eb"
          />

          <StatCard
            title="العملاء"
            value={customersCount}
            icon="👥"
            color="#0284c7"
          />
        </section>

        <section style={searchWrapper}>
          <section style={searchCard}>
            <span style={searchIcon}>🔎</span>

            <input
              style={searchInput}
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              placeholder="البحث السريع: اسم العميل، رقم العقد، الهوية، الجوال..."
            />

            {searchText && (
              <button
                type="button"
                style={clearSearchButton}
                onClick={() => {
                  setSearchText("");
                  setSearchResults([]);
                }}
              >
                ×
              </button>
            )}
          </section>

          {searchText.trim().length >= 2 && (
            <div style={resultsBox}>
              {searchLoading ? (
                <div style={emptyResult}>
                  جاري البحث...
                </div>
              ) : searchResults.length === 0 ? (
                <div style={emptyResult}>
                  لا توجد نتائج مطابقة
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    type="button"
                    key={`${item.type}-${item.id}`}
                    style={resultItem}
                    onClick={() =>
                      router.push(item.href)
                    }
                  >
                    <span style={resultIcon}>
                      {item.icon}
                    </span>

                    <span style={resultContent}>
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </span>

                    <span style={resultType}>
                      {item.type}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </section>

        <section style={quickActions}>
          {hasPermission("contracts") && (
            <button
              type="button"
              style={primaryAction}
              onClick={() => go("new-request")}
            >
              ➕ طلب جديد
            </button>
          )}

          {hasPermission("payments") && (
            <button
              type="button"
              style={greenAction}
              onClick={() => go("payments/new")}
            >
              💳 تسجيل سداد
            </button>
          )}

          {hasPermission("inventory") && (
            <button
              type="button"
              style={tealAction}
              onClick={() =>
                go("inventory/add-stock")
              }
            >
              📦 إضافة كمية للمخزون
            </button>
          )}

          {hasPermission("expenses") && (
            <button
              type="button"
              style={grayAction}
              onClick={() => go("expenses/new")}
            >
              🧾 فاتورة مصروف
            </button>
          )}
        </section>

        <section style={sectionsPanel}>
          <div style={panelHeader}>
            <span style={panelIconBlue}>⚡</span>
            <strong>أقسام محطة العمل</strong>
          </div>

          <div style={grid}>
            {visibleSections.map((item) => (
              <button
                type="button"
                key={item.title}
                style={sectionCard}
                onClick={() => go(item.path)}
              >
                <div style={cardRight}>
                  <div
                    style={{
                      ...iconBox,
                      background: item.bg,
                      color: item.color,
                    }}
                  >
                    {item.icon}
                  </div>

                  <div>
                    <div style={cardTitle}>
                      {item.title}
                    </div>

                    <div style={cardDesc}>
                      {item.desc}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    ...arrow,
                    color: item.color,
                  }}
                >
                  ‹
                </span>
              </button>
            ))}
          </div>
        </section>

        <section style={compactInfoGrid}>
          <div style={compactPanel}>
            <div style={compactPanelHeader}>
              <span style={compactPanelIconBlue}>
                🚨
              </span>

              <strong>تنبيهات مهمة</strong>
            </div>

            {alerts.map((item) => (
              <button
                type="button"
                key={item.id}
                style={
                  item.type === "green"
                    ? compactNoticeGreen
                    : item.type === "danger"
                      ? compactNoticeRed
                      : compactNoticeBlue
                }
                onClick={() =>
                  router.push(item.href)
                }
              >
                {item.text}
              </button>
            ))}
          </div>

          <div style={compactPanel}>
            <div style={compactPanelHeader}>
              <span style={compactPanelIconGreen}>
                🕒
              </span>

              <strong>آخر العمليات</strong>
            </div>

            {latestActivities.length === 0 ? (
              <div style={compactActivityItem}>
                لا توجد عمليات مسجلة حالياً
              </div>
            ) : (
              latestActivities.map((item) => (
                <div
                  key={item.id}
                  style={compactActivityItem}
                >
                  {getActivityText(item)}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div style={statCard}>
      <div
        style={{
          ...statIcon,
          background: `${color}14`,
          color,
        }}
      >
        {icon}
      </div>

      <div>
        <div style={statValue}>{value}</div>
        <div style={statTitle}>{title}</div>
      </div>
    </div>
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

function getPageStyle(
  isMobile: boolean
): CSSProperties {
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
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "center",
      gap: 18,
      direction: "rtl",
    };
  }

  if (screen === "tablet") {
    return {
      position: "relative",
      zIndex: 3,
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
    order: screen === "desktop" ? 0 : 1,
  };
}

function getOrganizationTitleStyle(
  screen: ScreenType
): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize:
      screen === "mobile"
        ? 27
        : screen === "tablet"
          ? 30
          : 34,
    lineHeight: 1.45,
    fontWeight: 700,
    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",
    fontFamily:
      "var(--font-noto-naskh-arabic), 'Noto Naskh Arabic', 'Amiri', serif",
  };
}

function getWorkstationTitleStyle(
  screen: ScreenType
): CSSProperties {
  return {
    marginTop: 4,
    color: "rgba(255,255,255,0.86)",
    fontSize: screen === "mobile" ? 14 : 16,
    fontWeight: 800,
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
        ? 24
        : screen === "tablet"
          ? 27
          : 30,
    lineHeight: 1.4,
    fontWeight: 900,
    textAlign: "center",
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
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    direction: "rtl",
  };
}

const loadingHeroContent: CSSProperties = {
  position: "relative",
  zIndex: 3,
  minHeight: 116,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

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

const dateBox: CSSProperties = {
  minWidth: 130,
  display: "grid",
  gap: 5,
  textAlign: "center",
  color: "#ffffff",
};

const dateLabel: CSSProperties = {
  color: "rgba(255,255,255,0.75)",
  fontSize: 13,
  fontWeight: 800,
};

const dateText: CSSProperties = {
  color: "#ffffff",
  fontSize: 17,
  fontWeight: 900,
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

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(260px,1fr))",
  gap: 12,
  marginBottom: 14,
  maxWidth: 620,
  marginLeft: "auto",
  marginRight: "auto",
};

const statCard: CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 18,
  display: "flex",
  alignItems: "center",
  gap: 14,
  boxShadow:
    "0 12px 28px rgba(15,23,42,0.05)",
};

const statIcon: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 25,
  flex: "0 0 auto",
};

const statValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 29,
  fontWeight: 900,
};

const statTitle: CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
  marginTop: 4,
};

const searchWrapper: CSSProperties = {
  position: "relative",
  marginBottom: 14,
};

const searchCard: CSSProperties = {
  background: "rgba(255,255,255,0.98)",
  border: "1px solid #dbeafe",
  borderRadius: 24,
  padding: "0 16px",
  minHeight: 62,
  display: "flex",
  alignItems: "center",
  gap: 10,
  boxShadow:
    "0 12px 28px rgba(37,99,235,0.07)",
};

const searchIcon: CSSProperties = {
  color: "#2563eb",
  fontSize: 22,
};

const searchInput: CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: 16,
  color: "#0f172a",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const clearSearchButton: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "none",
  background: "#e2e8f0",
  color: "#475569",
  fontSize: 22,
  cursor: "pointer",
};

const resultsBox: CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 8,
};

const resultItem: CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  background: "rgba(255,255,255,0.98)",
  borderRadius: 16,
  padding: 11,
  display: "grid",
  gridTemplateColumns: "42px 1fr auto",
  gap: 10,
  alignItems: "center",
  cursor: "pointer",
  textAlign: "right",
  boxShadow:
    "0 8px 18px rgba(15,23,42,0.04)",
};

const resultIcon: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 21,
};

const resultContent: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "#0f172a",
};

const resultType: CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  fontSize: 13,
};

const emptyResult: CSSProperties = {
  padding: 13,
  textAlign: "center",
  color: "#64748b",
  background: "#f8fafc",
  borderRadius: 14,
};

const quickActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
  marginBottom: 14,
};

const actionBase: CSSProperties = {
  border: "none",
  borderRadius: 18,
  padding: 16,
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  boxShadow:
    "0 10px 24px rgba(15,23,42,0.06)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const primaryAction: CSSProperties = {
  ...actionBase,
  background:
    "linear-gradient(135deg,#2563eb,#60a5fa)",
  color: "white",
};

const greenAction: CSSProperties = {
  ...actionBase,
  background:
    "linear-gradient(135deg,#16a34a,#4ade80)",
  color: "white",
};

const tealAction: CSSProperties = {
  ...actionBase,
  background:
    "linear-gradient(135deg,#0f766e,#2dd4bf)",
  color: "white",
};

const grayAction: CSSProperties = {
  ...actionBase,
  background:
    "linear-gradient(135deg,#475569,#94a3b8)",
  color: "white",
};

const panel: CSSProperties = {
  background: "rgba(255,255,255,0.98)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 18,
  boxShadow:
    "0 12px 28px rgba(15,23,42,0.05)",
};

const sectionsPanel: CSSProperties = {
  ...panel,
  marginBottom: 14,
};

const panelHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  color: "#0f172a",
  fontSize: 17,
  marginBottom: 13,
};

const panelIconBlue: CSSProperties = {
  background: "#eff6ff",
  color: "#2563eb",
  width: 36,
  height: 36,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(250px,1fr))",
  gap: 12,
};

const sectionCard: CSSProperties = {
  width: "100%",
  minHeight: 96,
  background:
    "linear-gradient(135deg,#ffffff,#f8fafc)",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  boxShadow:
    "0 10px 24px rgba(15,23,42,0.04)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const cardRight: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  textAlign: "right",
};

const iconBox: CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  flex: "0 0 auto",
};

const cardTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#0f172a",
};

const cardDesc: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 5,
};

const arrow: CSSProperties = {
  fontSize: 29,
};

const compactInfoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(260px,1fr))",
  gap: 10,
  maxWidth: 780,
  margin: "0 auto 8px",
};

const compactPanel: CSSProperties = {
  background: "rgba(255,255,255,0.98)",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 13,
  boxShadow:
    "0 10px 22px rgba(15,23,42,0.04)",
};

const compactPanelHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#0f172a",
  fontSize: 15,
  marginBottom: 9,
};

const compactPanelIconBlue: CSSProperties = {
  background: "#eff6ff",
  color: "#2563eb",
  width: 30,
  height: 30,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const compactPanelIconGreen: CSSProperties = {
  ...compactPanelIconBlue,
  background: "#f0fdf4",
  color: "#16a34a",
};

const compactNoticeBlue: CSSProperties = {
  width: "100%",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  borderRadius: 13,
  padding: 10,
  marginBottom: 7,
  lineHeight: 1.6,
  fontWeight: 800,
  textAlign: "right",
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const compactNoticeGreen: CSSProperties = {
  ...compactNoticeBlue,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
};

const compactNoticeRed: CSSProperties = {
  ...compactNoticeBlue,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
};

const compactActivityItem: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  borderRadius: 13,
  padding: 10,
  marginBottom: 7,
  lineHeight: 1.6,
  fontSize: 13,
};
