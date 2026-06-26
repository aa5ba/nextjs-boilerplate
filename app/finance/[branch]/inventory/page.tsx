"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  logoutFinanceUser,
  redirectToFinanceLogin,
  renewFinanceSession,
  validateFinanceSession,
} from "@/lib/financeSession";

const LOW_STOCK_LIMIT = 5;
const ITEMS_PER_PAGE = 25;
const SUPPORT_SESSION_TIMEOUT_MS = 1200;

const INVENTORY_PERMISSIONS = {
  PAGE_VIEW: "inventory",
  VIEW: "inventory_view",

  PRODUCTS_VIEW: "inventory_products_view",
  PRODUCT_CREATE: "add_product",
  PRODUCT_EDIT: "inventory_product_edit",
  PRODUCT_DELETE: "inventory_product_delete",

  STOCK_ADD: "add_inventory",
  MOVEMENTS_VIEW: "inventory_movements_view",

  INVESTORS_VIEW: "investors_view",
  INVESTOR_ADD: "add_investor",
  INVESTOR_EDIT: "edit_investor",
  INVESTOR_TOGGLE: "toggle_investor",

  PRODUCTS_REPORT: "inventory_products_report",
  INVESTOR_REPORT: "inventory_investor_report",
} as const;

const MANAGER_ROLES = [
  "main_admin",
  "branch_manager",
  "admin",
  "manager",
  "مدير فرع",
  "مدير رئيسي",
  "مدير",
];

type ScreenType = "mobile" | "tablet" | "desktop";
type SessionType = "branch_user" | "admin_support" | null;
type StockStatusKey = "negative" | "low" | "normal";
type StockFilter = "all" | StockStatusKey;
type ActionTone =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "teal"
  | "slate";

type FinanceUser = {
  id: string;
  branch_id: string;
  branch_slug: string;
  branch_name?: string;
  organization_name?: string;
  full_name?: string;
  username?: string;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
};

type SupportSessionResponse = {
  ok: boolean;
  message?: string;
  session_type?: "admin_support";
  user?: FinanceUser;
};

type ProductRelation =
  | {
      product_name?: string | null;
    }
  | {
      product_name?: string | null;
    }[]
  | null;

type InvestorRelation =
  | {
      investor_name?: string | null;
    }
  | {
      investor_name?: string | null;
    }[]
  | null;

type InventoryItem = {
  id: string;
  branch_id: string;
  product_id?: string | null;
  investor_id?: string | null;
  quantity?: number | string | null;
  updated_at?: string | null;
  finance_products?: ProductRelation;
  finance_investors?: InvestorRelation;
};

type StockStatus = {
  key: StockStatusKey;
  label: string;
  priority: number;
};

type SummaryCardProps = {
  icon: string;
  title: string;
  value: string | number;
  tone: "blue" | "green" | "purple" | "red" | "orange";
  active?: boolean;
  onClick?: () => void;
};

type ActionButtonProps = {
  icon: string;
  title: string;
  tone: ActionTone;
  onClick: () => void;
};

export default function FinanceInventoryPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "")
    .trim()
    .toLowerCase();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [sessionType, setSessionType] =
    useState<SessionType>(null);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [role, setRole] = useState("");
  const [permissions, setPermissions] =
    useState<string[]>([]);

  const [items, setItems] =
    useState<InventoryItem[]>([]);

  const [productsCount, setProductsCount] = useState(0);
  const [investorsCount, setInvestorsCount] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [negativeCount, setNegativeCount] = useState(0);
  const [lowCount, setLowCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StockFilter>("all");

  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [logoutLoading, setLogoutLoading] = useState(false);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const isSupportSession =
    sessionType === "admin_support";

  const isManager = useMemo(() => {
    return (
      role === "support_impersonation" ||
      MANAGER_ROLES.includes(role)
    );
  }, [role]);

  const hasPermission = useCallback(
    (...permissionKeys: string[]) => {
      if (isManager) {
        return true;
      }

      return permissionKeys.some((permissionKey) =>
        permissions.includes(permissionKey)
      );
    },
    [isManager, permissions]
  );

  /*
   * الصفحة مجهزة لصفحة إدارة الصلاحيات.
   * كل قسم أو عملية له مفتاح مستقل وثابت.
   */
  const canViewInventory = hasPermission(
    INVENTORY_PERMISSIONS.PAGE_VIEW,
    INVENTORY_PERMISSIONS.VIEW,
    INVENTORY_PERMISSIONS.PRODUCTS_VIEW,
    INVENTORY_PERMISSIONS.STOCK_ADD,
    INVENTORY_PERMISSIONS.MOVEMENTS_VIEW,
    INVENTORY_PERMISSIONS.INVESTORS_VIEW,
    INVENTORY_PERMISSIONS.PRODUCT_CREATE,
    INVENTORY_PERMISSIONS.INVESTOR_ADD
  );

  const canViewProducts = hasPermission(
    INVENTORY_PERMISSIONS.PRODUCTS_VIEW,
    INVENTORY_PERMISSIONS.PAGE_VIEW,
    INVENTORY_PERMISSIONS.VIEW
  );

  const canAddProduct = hasPermission(
    INVENTORY_PERMISSIONS.PRODUCT_CREATE
  );

  const canAddStock = hasPermission(
    INVENTORY_PERMISSIONS.STOCK_ADD
  );

  const canViewMovements = hasPermission(
    INVENTORY_PERMISSIONS.MOVEMENTS_VIEW,
    INVENTORY_PERMISSIONS.PAGE_VIEW
  );

  const canViewInvestors = hasPermission(
    INVENTORY_PERMISSIONS.INVESTORS_VIEW,
    INVENTORY_PERMISSIONS.PAGE_VIEW
  );

  const canAddInvestor = hasPermission(
    INVENTORY_PERMISSIONS.INVESTOR_ADD
  );

  const canViewProductsReport = hasPermission(
    INVENTORY_PERMISSIONS.PRODUCTS_REPORT,
    INVENTORY_PERMISSIONS.PAGE_VIEW
  );

  const canViewInvestorReport = hasPermission(
    INVENTORY_PERMISSIONS.INVESTOR_REPORT,
    INVENTORY_PERMISSIONS.INVESTORS_VIEW,
    INVENTORY_PERMISSIONS.PAGE_VIEW
  );

  const applyAuthorizedUser = useCallback(
    (
      user: FinanceUser,
      type: Exclude<SessionType, null>
    ) => {
      const nextPermissions = Array.isArray(user.permissions)
        ? user.permissions.filter(
            (permission): permission is string =>
              typeof permission === "string" &&
              permission.trim().length > 0
          )
        : [];

      setEmployeeName(
        user.full_name ||
          user.username ||
          "الموظف"
      );

      setBranchId(user.branch_id);
      setRole(user.role || "");
      setPermissions(nextPermissions);
      setSessionType(type);
      setAuthorized(true);
    },
    []
  );

  const getSupportSession = useCallback(
    async (
      isCancelled: () => boolean
    ): Promise<FinanceUser | null> => {
      const controller = new AbortController();

      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, SUPPORT_SESSION_TIMEOUT_MS);

      try {
        const response = await fetch(
          `/finance/api/support-session?branch=${encodeURIComponent(
            branch
          )}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

        let payload: SupportSessionResponse;

        try {
          payload =
            (await response.json()) as SupportSessionResponse;
        } catch {
          payload = {
            ok: false,
            message: "تعذر قراءة استجابة جلسة الدعم",
          };
        }

        if (isCancelled()) {
          return null;
        }

        if (
          response.ok &&
          payload.ok &&
          payload.session_type === "admin_support" &&
          payload.user?.id &&
          payload.user.branch_id &&
          payload.user.branch_slug
        ) {
          return payload.user;
        }

        return null;
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return null;
        }

        console.error(
          "Support session verification failed:",
          error
        );

        return null;
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [branch]
  );

  const verifyUserInBackground = useCallback(
    async (
      user: FinanceUser,
      isCancelled: () => boolean
    ) => {
      try {
        const [branchResult, userResult] =
          await Promise.all([
            supabase
              .from("finance_branches")
              .select(
                "id, branch_slug, branch_name, organization_name, is_active"
              )
              .eq("id", user.branch_id)
              .maybeSingle(),

            supabase
              .from("finance_branch_users")
              .select(
                "id, full_name, username, role, branch_id, is_active"
              )
              .eq("id", user.id)
              .eq("branch_id", user.branch_id)
              .maybeSingle(),
          ]);

        if (isCancelled()) {
          return;
        }

        if (branchResult.error) {
          console.error(
            "Background branch verification error:",
            branchResult.error
          );
        }

        if (userResult.error) {
          console.error(
            "Background user verification error:",
            userResult.error
          );
        }

        /*
         * لا يُحوّل المستخدم إلى تسجيل الدخول بسبب خطأ شبكة.
         * التحويل فقط عندما ينجح الاستعلام ويؤكد أن الفرع غير موجود أو معطل.
         */
        if (
          !branchResult.error &&
          (!branchResult.data ||
            branchResult.data.is_active === false)
        ) {
          redirectToFinanceLogin(router, {
            branchSlug: branch,
            preserveReturnPath: true,
          });

          return;
        }

        if (
          !userResult.error &&
          (!userResult.data ||
            userResult.data.is_active === false)
        ) {
          redirectToFinanceLogin(router, {
            branchSlug: branch,
            preserveReturnPath: true,
          });

          return;
        }

        if (branchResult.data) {
          localStorage.setItem(
            "finance_branch_name",
            branchResult.data.branch_name || ""
          );

          localStorage.setItem(
            "finance_organization_name",
            branchResult.data.organization_name || ""
          );
        }

        if (userResult.data) {
          const refreshedEmployeeName =
            userResult.data.full_name ||
            userResult.data.username ||
            user.full_name ||
            user.username ||
            "الموظف";

          setEmployeeName(refreshedEmployeeName);

          localStorage.setItem(
            "finance_user_name",
            refreshedEmployeeName
          );
        }
      } catch (error) {
        console.error(
          "Background session verification failed:",
          error
        );
      }
    },
    [branch, router]
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
    if (!branch) {
      redirectToFinanceLogin(router, {
        preserveReturnPath: true,
      });

      return;
    }

    let cancelled = false;

    async function initializeSession() {
      const validation =
        validateFinanceSession(branch);

      if (
        validation.reason === "BRANCH_MISMATCH" &&
        validation.user?.branch_slug
      ) {
        router.replace(
          `/finance/${validation.user.branch_slug}/inventory`
        );

        return;
      }

      /*
       * فتح الصفحة فورًا اعتمادًا على الجلسة المحلية الصالحة.
       */
      if (
        validation.valid &&
        validation.user
      ) {
        const session = validation.user;

        const localUser: FinanceUser = {
          id: String(session.id || ""),

          branch_id: String(
            session.branch_id || ""
          ),

          branch_slug: String(
            session.branch_slug || branch
          )
            .trim()
            .toLowerCase(),

          branch_name:
            session.branch_name || "",

          organization_name:
            session.organization_name || "",

          full_name:
            getFinanceEmployeeName(session),

          username:
            session.username || "",

          role:
            session.role || "",

          permissions:
            Array.isArray(session.permissions)
              ? session.permissions
              : [],

          is_active:
            session.is_active !== false,
        };

        if (
          localUser.id &&
          localUser.branch_id
        ) {
          renewFinanceSession(true);

          applyAuthorizedUser(
            localUser,
            "branch_user"
          );

          setAuthChecked(true);

          /*
           * التحقق من الموظف والفرع في الخلفية دون تعطيل فتح الصفحة.
           */
          void verifyUserInBackground(
            localUser,
            () => cancelled
          );

          void getSupportSession(
            () => cancelled
          ).then((supportUser) => {
            if (
              cancelled ||
              !supportUser
            ) {
              return;
            }

            const supportBranchSlug =
              supportUser.branch_slug
                .trim()
                .toLowerCase();

            if (
              supportBranchSlug === branch &&
              supportUser.branch_id
            ) {
              applyAuthorizedUser(
                supportUser,
                "admin_support"
              );
            }
          });

          return;
        }
      }

      /*
       * لا ننتظر جلسة الدعم إلا إذا لم توجد جلسة موظف محلية صالحة.
       */
      const supportUser =
        await getSupportSession(
          () => cancelled
        );

      if (cancelled) {
        return;
      }

      if (supportUser) {
        const supportBranchSlug =
          supportUser.branch_slug
            .trim()
            .toLowerCase();

        if (supportBranchSlug !== branch) {
          router.replace(
            `/finance/${encodeURIComponent(
              supportBranchSlug
            )}/inventory`
          );

          return;
        }

        applyAuthorizedUser(
          supportUser,
          "admin_support"
        );

        setAuthChecked(true);
        return;
      }

      setAuthChecked(true);

      redirectToFinanceLogin(router, {
        branchSlug: branch,
        preserveReturnPath: true,
      });
    }

    void initializeSession();

    return () => {
      cancelled = true;
    };
  }, [
    applyAuthorizedUser,
    branch,
    getSupportSession,
    router,
    verifyUserInBackground,
  ]);

  useEffect(() => {
    if (
      !authorized ||
      isSupportSession
    ) {
      return;
    }

    return installFinanceActivityTracker({
      onExpired: () => {
        redirectToFinanceLogin(router, {
          branchSlug: branch,
          preserveReturnPath: true,
        });
      },
    });
  }, [
    authorized,
    branch,
    isSupportSession,
    router,
  ]);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    setAccessDenied(!canViewInventory);
  }, [
    authorized,
    canViewInventory,
  ]);

  useEffect(() => {
    if (
      !authorized ||
      !branchId ||
      !canViewInventory
    ) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void loadInventory(
      branchId,
      () => cancelled
    );

    return () => {
      cancelled = true;
    };
  }, [
    authorized,
    branchId,
    canViewInventory,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
  ]);

  function go(path: string) {
    router.push(
      `/finance/${branch}/${path}`
    );
  }

  async function loadInventory(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    setLoading(true);
    setLoadError("");

    try {
      /*
       * الاستعلامات مستقلة حتى لا يؤدي تعطل إحصائية واحدة
       * إلى إخفاء جدول المخزون كاملًا.
       */
      const results = await Promise.allSettled([
        supabase
          .from("finance_products")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("branch_id", currentBranchId)
          .eq("is_active", true),

        supabase
          .from("finance_investors")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("branch_id", currentBranchId)
          .eq("is_active", true),

        supabase
          .from("finance_inventory")
          .select(
            `
              id,
              branch_id,
              product_id,
              investor_id,
              quantity,
              updated_at,
              finance_products(
                product_name
              ),
              finance_investors(
                investor_name
              )
            `
          )
          .eq("branch_id", currentBranchId)
          .order("updated_at", {
            ascending: false,
          }),
      ]);

      if (isCancelled()) {
        return;
      }

      const [
        productsSettled,
        investorsSettled,
        inventorySettled,
      ] = results;

      let nextProductsCount = productsCount;
      let nextInvestorsCount = investorsCount;
      let nextItems = items;

      let hasError = false;

      if (productsSettled.status === "fulfilled") {
        const productsResult = productsSettled.value;

        if (productsResult.error) {
          hasError = true;

          console.error(
            "Products count error:",
            productsResult.error
          );
        } else {
          nextProductsCount =
            productsResult.count || 0;
        }
      } else {
        hasError = true;

        console.error(
          "Products count failed:",
          productsSettled.reason
        );
      }

      if (investorsSettled.status === "fulfilled") {
        const investorsResult =
          investorsSettled.value;

        if (investorsResult.error) {
          hasError = true;

          console.error(
            "Investors count error:",
            investorsResult.error
          );
        } else {
          nextInvestorsCount =
            investorsResult.count || 0;
        }
      } else {
        hasError = true;

        console.error(
          "Investors count failed:",
          investorsSettled.reason
        );
      }

      if (inventorySettled.status === "fulfilled") {
        const inventoryResult =
          inventorySettled.value;

        if (inventoryResult.error) {
          hasError = true;

          console.error(
            "Inventory loading error:",
            inventoryResult.error
          );
        } else {
          nextItems =
            (inventoryResult.data ||
              []) as InventoryItem[];
        }
      } else {
        hasError = true;

        console.error(
          "Inventory loading failed:",
          inventorySettled.reason
        );
      }

      /*
       * لا نفرغ البيانات القديمة عند فشل الشبكة المؤقت.
       */
      setProductsCount(nextProductsCount);
      setInvestorsCount(nextInvestorsCount);
      setItems(nextItems);

      calculateInventorySummary(nextItems);

      if (hasError) {
        setLoadError(
          "تعذر تحميل بعض بيانات المخزون. البيانات المتاحة ما زالت معروضة ويمكنك إعادة المحاولة."
        );
      }

      setCurrentPage(1);
    } catch (error) {
      console.error(
        "Load inventory error:",
        error
      );

      if (!isCancelled()) {
        setLoadError(
          "تعذر تحديث المخزون بسبب مشكلة في الاتصال."
        );
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  function calculateInventorySummary(
    inventoryList: InventoryItem[]
  ) {
    const nextTotalQuantity =
      inventoryList.reduce(
        (sum, item) =>
          sum +
          normalizeQuantity(
            item.quantity
          ),
        0
      );

    const nextNegativeCount =
      inventoryList.filter(
        (item) =>
          normalizeQuantity(
            item.quantity
          ) < 0
      ).length;

    const nextLowCount =
      inventoryList.filter(
        (item) => {
          const quantity =
            normalizeQuantity(
              item.quantity
            );

          return (
            quantity >= 0 &&
            quantity <= LOW_STOCK_LIMIT
          );
        }
      ).length;

    setTotalQuantity(nextTotalQuantity);
    setNegativeCount(nextNegativeCount);
    setLowCount(nextLowCount);
  }

  function getProductName(
    item: InventoryItem
  ) {
    const relation =
      item.finance_products;

    if (Array.isArray(relation)) {
      return (
        relation[0]?.product_name ||
        "-"
      );
    }

    return (
      relation?.product_name ||
      "-"
    );
  }

  function getInvestorName(
    item: InventoryItem
  ) {
    const relation =
      item.finance_investors;

    if (Array.isArray(relation)) {
      return (
        relation[0]?.investor_name ||
        "-"
      );
    }

    return (
      relation?.investor_name ||
      "-"
    );
  }

  const filteredItems = useMemo(() => {
    const cleanSearch =
      normalizeSearch(searchTerm);

    return items
      .filter((item) => {
        const productName =
          normalizeSearch(
            getProductName(item)
          );

        const investorName =
          normalizeSearch(
            getInvestorName(item)
          );

        const quantity =
          normalizeQuantity(
            item.quantity
          );

        const status =
          getStockStatus(quantity);

        const matchesSearch =
          !cleanSearch ||
          productName.includes(
            cleanSearch
          ) ||
          investorName.includes(
            cleanSearch
          ) ||
          String(quantity).includes(
            cleanSearch
          );

        const matchesStatus =
          statusFilter === "all" ||
          status.key === statusFilter;

        return (
          matchesSearch &&
          matchesStatus
        );
      })
      .sort(
        (
          firstItem,
          secondItem
        ) => {
          const firstQuantity =
            normalizeQuantity(
              firstItem.quantity
            );

          const secondQuantity =
            normalizeQuantity(
              secondItem.quantity
            );

          const firstStatus =
            getStockStatus(
              firstQuantity
            );

          const secondStatus =
            getStockStatus(
              secondQuantity
            );

          if (
            firstStatus.priority !==
            secondStatus.priority
          ) {
            return (
              firstStatus.priority -
              secondStatus.priority
            );
          }

          return getProductName(
            firstItem
          ).localeCompare(
            getProductName(
              secondItem
            ),
            "ar"
          );
        }
      );
  }, [
    items,
    searchTerm,
    statusFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredItems.length /
        ITEMS_PER_PAGE
    )
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages,
  ]);

  const paginatedItems = useMemo(() => {
    const startIndex =
      (currentPage - 1) *
      ITEMS_PER_PAGE;

    return filteredItems.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [
    filteredItems,
    currentPage,
  ]);

  function changeStatusFilter(
    filter: StockFilter
  ) {
    setStatusFilter(filter);
  }

  function clearFilters() {
    setSearchTerm("");
    setStatusFilter("all");
  }

  async function leaveSupportBranch() {
    setLogoutLoading(true);

    try {
      await fetch(
        "/finance/api/support-session",
        {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );
    } catch (error) {
      console.error(
        "Support logout failed:",
        error
      );
    } finally {
      setLogoutLoading(false);

      router.replace(
        "/admin-support"
      );

      router.refresh();
    }
  }

  async function logout() {
    if (logoutLoading) {
      return;
    }

    if (isSupportSession) {
      await leaveSupportBranch();
      return;
    }

    logoutFinanceUser(router);
  }

  if (
    !authChecked ||
    !authorized
  ) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(isMobile)}
      >
        <div
          style={getContainerStyle(
            isCompact
          )}
        >
          <header
            style={getHeroStyle(isMobile)}
          >
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div
              style={loadingHeroContent}
            >
              <span
                style={loadingSpinner}
              />

              <h1
                style={getTitleStyle(
                  screen
                )}
              >
                جاري فتح صفحة المخزون...
              </h1>
            </div>
          </header>
        </div>

        <GlobalStyles />
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(isMobile)}
      >
        <div
          style={getContainerStyle(
            isCompact
          )}
        >
          <PageHeader
            screen={screen}
            employeeName={employeeName}
            isSupportSession={
              isSupportSession
            }
            logoutLoading={
              logoutLoading
            }
            onLogout={() =>
              void logout()
            }
            onHome={() =>
              router.push(
                `/finance/${branch}`
              )
            }
          />

          <section
            style={accessDeniedCard}
          >
            <div
              style={accessDeniedIcon}
            >
              🔒
            </div>

            <h2
              style={accessDeniedTitle}
            >
              ليس لديك صلاحية الدخول إلى قسم المخزون
            </h2>

            <button
              type="button"
              style={backButton}
              onClick={() =>
                router.back()
              }
            >
              ← رجوع
            </button>
          </section>
        </div>

        <GlobalStyles />
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={getPageStyle(isMobile)}
    >
      <div
        style={getContainerStyle(
          isCompact
        )}
      >
        <PageHeader
          screen={screen}
          employeeName={employeeName}
          isSupportSession={
            isSupportSession
          }
          logoutLoading={
            logoutLoading
          }
          onLogout={() =>
            void logout()
          }
          onHome={() =>
            router.push(
              `/finance/${branch}`
            )
          }
        />

        <section style={overviewPanel}>
          <SectionHeading
            icon="📊"
            title="ملخص المخزون"
          />

          <div style={summaryGrid}>
            <SummaryCard
              icon="🧩"
              title="عدد المنتجات"
              value={productsCount}
              tone="blue"
              onClick={
                canViewProducts
                  ? () =>
                      go(
                        "inventory/products"
                      )
                  : undefined
              }
            />

            <SummaryCard
              icon="📦"
              title="إجمالي الكمية"
              value={formatNumber(
                totalQuantity
              )}
              tone="green"
              active={
                statusFilter === "all"
              }
              onClick={() =>
                changeStatusFilter(
                  "all"
                )
              }
            />

            <SummaryCard
              icon="👤"
              title="عدد المستثمرين"
              value={investorsCount}
              tone="purple"
              onClick={
                canViewInvestors
                  ? () =>
                      go(
                        "inventory/investors"
                      )
                  : undefined
              }
            />

            <SummaryCard
              icon="🔴"
              title="منتجات بالسالب"
              value={negativeCount}
              tone="red"
              active={
                statusFilter ===
                "negative"
              }
              onClick={() =>
                changeStatusFilter(
                  "negative"
                )
              }
            />

            <SummaryCard
              icon="🟠"
              title="منتجات منخفضة"
              value={lowCount}
              tone="orange"
              active={
                statusFilter === "low"
              }
              onClick={() =>
                changeStatusFilter(
                  "low"
                )
              }
            />
          </div>
        </section>

        <section style={actionsPanel}>
          <SectionHeading
            icon="⚡"
            title="إدارة المخزون"
          />

          <div style={actionsSection}>
            {canAddProduct && (
              <ActionButton
                icon="➕"
                title="إضافة منتج"
                tone="green"
                onClick={() =>
                  go(
                    "inventory/products/new"
                  )
                }
              />
            )}

            {canViewProducts && (
              <ActionButton
                icon="📦"
                title="المنتجات"
                tone="blue"
                onClick={() =>
                  go(
                    "inventory/products"
                  )
                }
              />
            )}

            {canAddStock && (
              <ActionButton
                icon="➕"
                title="إضافة كمية للمخزون"
                tone="orange"
                onClick={() =>
                  go(
                    "inventory/add-stock"
                  )
                }
              />
            )}

            {canViewMovements && (
              <ActionButton
                icon="📋"
                title="سجل الحركات"
                tone="slate"
                onClick={() =>
                  go(
                    "inventory/movements"
                  )
                }
              />
            )}

            {canViewInvestors && (
              <ActionButton
                icon="👥"
                title="المستثمرون"
                tone="purple"
                onClick={() =>
                  go(
                    "inventory/investors"
                  )
                }
              />
            )}

            {canAddInvestor && (
              <ActionButton
                icon="👤"
                title="إضافة مستثمر"
                tone="teal"
                onClick={() =>
                  go(
                    "inventory/investors/new"
                  )
                }
              />
            )}

            {canViewProductsReport && (
              <ActionButton
                icon="🖨️"
                title="كشف المنتجات"
                tone="blue"
                onClick={() =>
                  go(
                    "inventory/products-report"
                  )
                }
              />
            )}

            {canViewInvestorReport && (
              <ActionButton
                icon="🧾"
                title="كشف المستثمر"
                tone="purple"
                onClick={() =>
                  go(
                    "inventory/investor-report"
                  )
                }
              />
            )}
          </div>

          {!canAddProduct &&
            !canViewProducts &&
            !canAddStock &&
            !canViewMovements &&
            !canViewInvestors &&
            !canAddInvestor &&
            !canViewProductsReport &&
            !canViewInvestorReport && (
              <div style={emptyActionsBox}>
                لا توجد أدوات متاحة ضمن صلاحياتك الحالية.
              </div>
            )}
        </section>

        <section style={inventoryPanel}>
          <div style={inventoryPanelHeader}>
            <SectionHeading
              icon="🏷️"
              title="المخزون الحالي"
            />

            <button
              type="button"
              style={{
                ...refreshButton,
                opacity:
                  loading ? 0.65 : 1,
              }}
              disabled={loading}
              onClick={() => {
                if (branchId) {
                  void loadInventory(
                    branchId
                  );
                }
              }}
            >
              {loading
                ? "جاري التحديث..."
                : "تحديث المخزون"}
            </button>
          </div>

          <div style={filtersPanel}>
            <div style={searchBox}>
              <span style={searchIcon}>
                🔎
              </span>

              <input
                type="search"
                style={searchInput}
                placeholder="بحث باسم المنتج أو المستثمر"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
              />

              {searchTerm && (
                <button
                  type="button"
                  style={clearSearchButton}
                  onClick={() =>
                    setSearchTerm("")
                  }
                  aria-label="مسح البحث"
                >
                  ×
                </button>
              )}
            </div>

            <select
              style={filterSelect}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as StockFilter
                )
              }
            >
              <option value="all">
                كل الحالات
              </option>

              <option value="negative">
                بالسالب
              </option>

              <option value="low">
                منخفض
              </option>

              <option value="normal">
                طبيعي
              </option>
            </select>

            {(searchTerm ||
              statusFilter !==
                "all") && (
              <button
                type="button"
                style={clearFiltersButton}
                onClick={
                  clearFilters
                }
              >
                مسح الفلاتر
              </button>
            )}
          </div>

          {loadError && (
            <div style={loadErrorBox}>
              <span>{loadError}</span>

              {branchId && (
                <button
                  type="button"
                  style={retryButton}
                  onClick={() =>
                    void loadInventory(
                      branchId
                    )
                  }
                  disabled={loading}
                >
                  إعادة المحاولة
                </button>
              )}
            </div>
          )}

          {!loading &&
            filteredItems.length > 0 && (
              <div style={recordsBar}>
                <span>
                  عرض{" "}
                  {paginatedItems.length}{" "}
                  من{" "}
                  {filteredItems.length}{" "}
                  سجل
                </span>

                <span>
                  صفحة {currentPage} من{" "}
                  {totalPages}
                </span>
              </div>
            )}

          {loading && items.length === 0 ? (
            <div style={emptyBox}>
              <span
                style={contentSpinner}
              />

              <span>
                جاري تحميل المخزون...
              </span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={emptyBox}>
              لا توجد نتائج مطابقة
            </div>
          ) : isMobile ? (
            <div style={mobileCardsGrid}>
              {paginatedItems.map(
                (item) => {
                  const quantity =
                    normalizeQuantity(
                      item.quantity
                    );

                  const status =
                    getStockStatus(
                      quantity
                    );

                  return (
                    <InventoryMobileCard
                      key={item.id}
                      productName={getProductName(
                        item
                      )}
                      investorName={getInvestorName(
                        item
                      )}
                      quantity={quantity}
                      status={status}
                      updatedAt={
                        item.updated_at
                      }
                    />
                  );
                }
              )}
            </div>
          ) : (
            <div style={tableScroll}>
              <div style={tableHeader}>
                <span>المنتج</span>
                <span>المستثمر</span>
                <span>الكمية</span>
                <span>الحالة</span>
                <span>آخر تحديث</span>
              </div>

              {paginatedItems.map(
                (item) => {
                  const quantity =
                    normalizeQuantity(
                      item.quantity
                    );

                  const status =
                    getStockStatus(
                      quantity
                    );

                  return (
                    <div
                      key={item.id}
                      style={getTableRowStyle(
                        status.key
                      )}
                    >
                      <strong
                        style={productCell}
                      >
                        {getProductName(
                          item
                        )}
                      </strong>

                      <span>
                        {getInvestorName(
                          item
                        )}
                      </span>

                      <strong
                        style={getQuantityStyle(
                          status.key
                        )}
                      >
                        {formatNumber(
                          quantity
                        )}
                      </strong>

                      <span
                        style={getStatusBadgeStyle(
                          status.key
                        )}
                      >
                        {status.label}
                      </span>

                      <span>
                        {formatDate(
                          item.updated_at
                        )}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          )}

          {totalPages > 1 && (
            <div style={paginationBox}>
              <button
                type="button"
                style={{
                  ...paginationButton,
                  opacity:
                    currentPage === 1
                      ? 0.5
                      : 1,
                }}
                disabled={
                  currentPage === 1
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
                      Math.max(
                        page - 1,
                        1
                      )
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
                    currentPage ===
                    totalPages
                      ? 0.5
                      : 1,
                }}
                disabled={
                  currentPage ===
                  totalPages
                }
                onClick={() =>
                  setCurrentPage(
                    (page) =>
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
            onClick={() =>
              router.back()
            }
          >
            ← رجوع
          </button>
        </div>
      </div>

      <GlobalStyles />
    </main>
  );
}

function PageHeader({
  screen,
  employeeName,
  isSupportSession,
  logoutLoading,
  onLogout,
  onHome,
}: {
  screen: ScreenType;
  employeeName: string;
  isSupportSession: boolean;
  logoutLoading: boolean;
  onLogout: () => void;
  onHome: () => void;
}) {
  const isMobile =
    screen === "mobile";

  return (
    <header style={getHeroStyle(isMobile)}>
      <div style={heroCircleOne} />
      <div style={heroCircleTwo} />
      <div style={heroCircleThree} />
      <div style={heroDots} />

      <div style={getHeroContentStyle(screen)}>
        <div
          style={getHeroUserCardStyle(
            screen
          )}
        >
          <div
            style={getEmployeeTopRowStyle(
              screen
            )}
          >
            <div style={employeeIcon}>
              <UserIcon />
            </div>

            <div
              style={getEmployeeNameStyle(
                isMobile
              )}
            >
              {employeeName}
            </div>

            {isSupportSession && (
              <span style={supportBadge}>
                دخول دعم
              </span>
            )}

            {!isMobile && (
              <div
                style={
                  employeeDividerSmall
                }
              />
            )}

            <button
              type="button"
              style={{
                ...logoutInlineButton,
                opacity:
                  logoutLoading
                    ? 0.65
                    : 1,
              }}
              onClick={onLogout}
              disabled={logoutLoading}
            >
              <LogoutIcon />

              <span>
                {logoutLoading
                  ? "جاري الخروج..."
                  : isSupportSession
                    ? "العودة للوحة الدعم"
                    : "تسجيل الخروج"}
              </span>
            </button>
          </div>

          <button
            type="button"
            style={getMainWorkstationButtonStyle(
              isMobile
            )}
            onClick={onHome}
          >
            <HomeIcon />

            <span>
              محطة العمل الرئيسية
            </span>
          </button>
        </div>

        <div
          style={getHeroTitleBoxStyle(
            screen
          )}
        >
          <h1 style={getTitleStyle(screen)}>
            المخزون والمنتجات
          </h1>
        </div>

        <div
          style={getHeroActionBoxStyle(
            screen
          )}
        />
      </div>
    </header>
  );
}

function SectionHeading({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <div style={sectionHeadingRow}>
      <span style={sectionHeadingIcon}>
        {icon}
      </span>

      <h2 style={sectionHeadingTitle}>
        {title}
      </h2>
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  tone,
  active = false,
  onClick,
}: SummaryCardProps) {
  const tones = {
    blue: {
      background: "#eff6ff",
      border: "#bfdbfe",
      color: "#1d4ed8",
    },

    green: {
      background: "#f0fdf4",
      border: "#bbf7d0",
      color: "#15803d",
    },

    purple: {
      background: "#faf5ff",
      border: "#e9d5ff",
      color: "#7e22ce",
    },

    red: {
      background: "#fef2f2",
      border: "#fecaca",
      color: "#b91c1c",
    },

    orange: {
      background: "#fff7ed",
      border: "#fed7aa",
      color: "#c2410c",
    },
  };

  const selectedTone =
    tones[tone];

  const content = (
    <>
      <span
        style={{
          ...summaryIcon,
          background:
            selectedTone.background,
          color:
            selectedTone.color,
        }}
      >
        {icon}
      </span>

      <span style={summaryTextBox}>
        <strong style={summaryValue}>
          {value}
        </strong>

        <span style={summaryTitle}>
          {title}
        </span>
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div
        style={{
          ...summaryCard,
          borderColor:
            selectedTone.border,
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      style={{
        ...summaryCard,
        borderColor:
          active
            ? selectedTone.color
            : selectedTone.border,

        boxShadow:
          active
            ? `0 10px 25px ${selectedTone.color}20`
            : summaryCard.boxShadow,

        cursor: "pointer",
      }}
      onClick={onClick}
      className="inventory-summary-card"
    >
      {content}
    </button>
  );
}

function ActionButton({
  icon,
  title,
  tone,
  onClick,
}: ActionButtonProps) {
  const tones = {
    blue: {
      background:
        "linear-gradient(135deg,#eff6ff,#ffffff)",
      border: "#bfdbfe",
      iconBackground: "#dbeafe",
      color: "#1d4ed8",
    },

    green: {
      background:
        "linear-gradient(135deg,#f0fdf4,#ffffff)",
      border: "#bbf7d0",
      iconBackground: "#dcfce7",
      color: "#15803d",
    },

    purple: {
      background:
        "linear-gradient(135deg,#faf5ff,#ffffff)",
      border: "#e9d5ff",
      iconBackground: "#f3e8ff",
      color: "#7e22ce",
    },

    orange: {
      background:
        "linear-gradient(135deg,#fff7ed,#ffffff)",
      border: "#fed7aa",
      iconBackground: "#ffedd5",
      color: "#c2410c",
    },

    teal: {
      background:
        "linear-gradient(135deg,#f0fdfa,#ffffff)",
      border: "#99f6e4",
      iconBackground: "#ccfbf1",
      color: "#0f766e",
    },

    slate: {
      background:
        "linear-gradient(135deg,#f8fafc,#ffffff)",
      border: "#cbd5e1",
      iconBackground: "#e2e8f0",
      color: "#334155",
    },
  };

  const selectedTone =
    tones[tone];

  return (
    <button
      type="button"
      style={{
        ...actionButton,
        background:
          selectedTone.background,
        borderColor:
          selectedTone.border,
      }}
      onClick={onClick}
      className="inventory-action-card"
    >
      <span
        style={{
          ...actionIcon,
          background:
            selectedTone.iconBackground,
          color:
            selectedTone.color,
        }}
      >
        {icon}
      </span>

      <strong style={actionTitle}>
        {title}
      </strong>

      <span
        style={{
          ...actionArrow,
          color:
            selectedTone.color,
        }}
      >
        ‹
      </span>
    </button>
  );
}

function InventoryMobileCard({
  productName,
  investorName,
  quantity,
  status,
  updatedAt,
}: {
  productName: string;
  investorName: string;
  quantity: number;
  status: StockStatus;
  updatedAt?: string | null;
}) {
  return (
    <article
      style={{
        ...mobileInventoryCard,
        borderColor:
          status.key === "negative"
            ? "#fecaca"
            : status.key === "low"
              ? "#fde68a"
              : "#dbeafe",
      }}
    >
      <div style={mobileCardHeader}>
        <div>
          <h3 style={mobileProductName}>
            {productName}
          </h3>

          <span style={mobileInvestorName}>
            {investorName}
          </span>
        </div>

        <span
          style={getStatusBadgeStyle(
            status.key
          )}
        >
          {status.label}
        </span>
      </div>

      <div style={mobileDetailsGrid}>
        <div style={mobileDetailItem}>
          <span style={mobileDetailLabel}>
            الكمية
          </span>

          <strong
            style={getQuantityStyle(
              status.key
            )}
          >
            {formatNumber(quantity)}
          </strong>
        </div>

        <div style={mobileDetailItem}>
          <span style={mobileDetailLabel}>
            آخر تحديث
          </span>

          <strong style={mobileDetailValue}>
            {formatDate(updatedAt)}
          </strong>
        </div>
      </div>
    </article>
  );
}

function getStockStatus(
  quantity: number
): StockStatus {
  if (quantity < 0) {
    return {
      key: "negative",
      label: "بالسالب",
      priority: 1,
    };
  }

  if (
    quantity <= LOW_STOCK_LIMIT
  ) {
    return {
      key: "low",
      label: "منخفض",
      priority: 2,
    };
  }

  return {
    key: "normal",
    label: "طبيعي",
    priority: 3,
  };
}

function normalizeQuantity(
  value: number | string | null | undefined
) {
  const quantity =
    Number(value || 0);

  return Number.isFinite(quantity)
    ? quantity
    : 0;
}

function normalizeSearch(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function formatNumber(
  value: number
) {
  return new Intl.NumberFormat(
    "ar-SA",
    {
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatDate(
  date?: string | null
) {
  if (!date) {
    return "-";
  }

  const parsedDate =
    new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "ar-SA-u-ca-gregory",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(parsedDate);
}

function getTableRowStyle(
  status: StockStatusKey
): CSSProperties {
  if (status === "negative") {
    return {
      ...tableRow,
      background: "#fff7f7",
      borderColor: "#fee2e2",
    };
  }

  if (status === "low") {
    return {
      ...tableRow,
      background: "#fffdf5",
      borderColor: "#fef3c7",
    };
  }

  return tableRow;
}

function getStatusBadgeStyle(
  status: StockStatusKey
): CSSProperties {
  if (status === "negative") {
    return statusNegative;
  }

  if (status === "low") {
    return statusLow;
  }

  return statusNormal;
}

function getQuantityStyle(
  status: StockStatusKey
): CSSProperties {
  if (status === "negative") {
    return {
      ...quantityValue,
      color: "#b91c1c",
    };
  }

  if (status === "low") {
    return {
      ...quantityValue,
      color: "#b45309",
    };
  }

  return {
    ...quantityValue,
    color: "#15803d",
  };
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

function GlobalStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        overflow-x: hidden;
      }

      button,
      input,
      select {
        font-family: var(--font-almarai), sans-serif;
      }

      button {
        -webkit-tap-highlight-color: transparent;
      }

      button:disabled {
        cursor: not-allowed !important;
      }

      .inventory-action-card,
      .inventory-summary-card {
        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease,
          border-color 0.18s ease;
      }

      .inventory-action-card:hover,
      .inventory-summary-card:hover {
        transform: translateY(-2px);
        box-shadow:
          0 14px 28px rgba(15, 23, 42, 0.08) !important;
      }

      .inventory-action-card:active,
      .inventory-summary-card:active {
        transform: scale(0.985);
      }

      @keyframes inventoryPageSpin {
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
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

    backgroundAttachment:
      isMobile
        ? "scroll"
        : "fixed",

    padding:
      isMobile
        ? 10
        : 18,

    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getContainerStyle(
  isCompact: boolean
): CSSProperties {
  return {
    width: "100%",

    maxWidth:
      isCompact
        ? 980
        : 1180,

    margin: "auto",
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",

    minHeight:
      isMobile
        ? "auto"
        : 160,

    borderRadius:
      isMobile
        ? 20
        : 24,

    padding:
      isMobile
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

      gap: 16,
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
      "minmax(250px,315px) 1fr minmax(220px,315px)",

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
  return {
    minHeight: 42,

    display: "flex",

    alignItems: "center",

    justifyContent:
      screen === "desktop"
        ? "flex-start"
        : "center",

    flexWrap: "wrap",

    gap:
      screen === "mobile"
        ? 10
        : 14,

    direction:
      screen === "desktop"
        ? "ltr"
        : "rtl",

    color: "#ffffff",
    width: "100%",
  };
}

function getEmployeeNameStyle(
  isMobile: boolean
): CSSProperties {
  return {
    color: "#ffffff",

    fontSize:
      isMobile
        ? 15
        : 17,

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
    width:
      isMobile
        ? "100%"
        : 220,

    maxWidth:
      isMobile
        ? 280
        : 220,

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

    order:
      screen === "desktop"
        ? 0
        : 1,
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
          ? 28
          : 30,

    lineHeight: 1.35,
    fontWeight: 900,

    letterSpacing: "-0.4px",

    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",

    whiteSpace: "nowrap",

    fontFamily:
      "var(--font-almarai), sans-serif",
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

  background:
    "rgba(255,255,255,0.06)",

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  color:
    "rgba(255,255,255,0.96)",

  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,

  background:
    "rgba(255,255,255,0.30)",

  flex: "0 0 auto",
};

const supportBadge: CSSProperties = {
  padding: "5px 9px",

  borderRadius: 999,

  background:
    "rgba(22,163,74,0.22)",

  border:
    "1px solid rgba(187,247,208,0.42)",

  color: "#dcfce7",

  fontSize: 11,
  fontWeight: 900,

  whiteSpace: "nowrap",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",

  color:
    "rgba(255,255,255,0.90)",

  fontSize: 15,
  fontWeight: 800,

  display: "flex",
  alignItems: "center",
  gap: 9,

  cursor: "pointer",
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

  background:
    "rgba(255,255,255,0.075)",

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

  background:
    "rgba(255,255,255,0.045)",

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

  background:
    "rgba(255,255,255,0.035)",

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

  backgroundSize:
    "14px 14px",

  zIndex: 2,
};

const loadingHeroContent: CSSProperties = {
  position: "relative",
  zIndex: 3,

  minHeight: 116,

  display: "flex",
  flexDirection: "column",

  alignItems: "center",
  justifyContent: "center",

  gap: 14,
};

const loadingSpinner: CSSProperties = {
  width: 34,
  height: 34,

  borderRadius: "50%",

  border:
    "3px solid rgba(255,255,255,0.28)",

  borderTopColor: "#ffffff",

  animation:
    "inventoryPageSpin 0.8s linear infinite",
};

const commonPanel: CSSProperties = {
  background:
    "rgba(255,255,255,0.97)",

  border:
    "1px solid #dbeafe",

  borderRadius: 24,

  padding: 18,

  boxShadow:
    "0 12px 28px rgba(15,23,42,0.05)",
};

const overviewPanel: CSSProperties = {
  ...commonPanel,
  marginBottom: 14,
};

const actionsPanel: CSSProperties = {
  ...commonPanel,
  marginBottom: 14,
};

const inventoryPanel: CSSProperties = {
  ...commonPanel,
  marginBottom: 14,
};

const sectionHeadingRow: CSSProperties = {
  display: "flex",

  alignItems: "center",

  gap: 10,

  marginBottom: 14,
};

const sectionHeadingIcon: CSSProperties = {
  width: 38,
  height: 38,

  borderRadius: 12,

  background: "#eff6ff",

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  fontSize: 19,

  flex: "0 0 auto",
};

const sectionHeadingTitle: CSSProperties = {
  margin: 0,

  color: "#0f172a",

  fontSize: 20,
  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const summaryGrid: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(175px,1fr))",

  gap: 10,
};

const summaryCard: CSSProperties = {
  width: "100%",

  minHeight: 82,

  background: "#ffffff",

  border:
    "1px solid #dbeafe",

  borderRadius: 18,

  padding: 12,

  display: "flex",

  alignItems: "center",

  gap: 11,

  textAlign: "right",

  boxShadow:
    "0 8px 18px rgba(15,23,42,0.035)",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const summaryIcon: CSSProperties = {
  width: 45,
  height: 45,

  borderRadius: 14,

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  fontSize: 21,

  flex: "0 0 auto",
};

const summaryTextBox: CSSProperties = {
  display: "flex",

  flexDirection: "column",

  gap: 3,
};

const summaryValue: CSSProperties = {
  color: "#0f172a",

  fontSize: 22,
  fontWeight: 900,
};

const summaryTitle: CSSProperties = {
  color: "#64748b",

  fontSize: 12,
  fontWeight: 800,
};

const actionsSection: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(210px,1fr))",

  gap: 10,
};

const actionButton: CSSProperties = {
  width: "100%",

  minHeight: 76,

  border: "1px solid",

  borderRadius: 18,

  padding: 12,

  display: "grid",

  gridTemplateColumns:
    "44px 1fr auto",

  alignItems: "center",

  gap: 10,

  textAlign: "right",

  cursor: "pointer",

  boxShadow:
    "0 8px 18px rgba(15,23,42,0.035)",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const actionIcon: CSSProperties = {
  width: 44,
  height: 44,

  borderRadius: 13,

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  fontSize: 20,
};

const actionTitle: CSSProperties = {
  color: "#0f172a",

  fontSize: 14,
  fontWeight: 900,
};

const actionArrow: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
};

const emptyActionsBox: CSSProperties = {
  padding: 18,

  border:
    "1px dashed #cbd5e1",

  borderRadius: 16,

  background: "#f8fafc",

  color: "#64748b",

  textAlign: "center",

  fontSize: 13,
  fontWeight: 800,
};

const inventoryPanelHeader: CSSProperties = {
  display: "flex",

  alignItems: "center",
  justifyContent: "space-between",

  flexWrap: "wrap",

  gap: 12,

  marginBottom: 13,
};

const refreshButton: CSSProperties = {
  border: "none",

  borderRadius: 13,

  padding: "11px 15px",

  background:
    "linear-gradient(135deg,#2563eb,#1d4ed8)",

  color: "#ffffff",

  fontSize: 13,
  fontWeight: 900,

  cursor: "pointer",

  whiteSpace: "nowrap",
};

const filtersPanel: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "minmax(220px,1fr) auto auto",

  gap: 9,

  marginBottom: 13,
};

const searchBox: CSSProperties = {
  minHeight: 50,

  padding: "0 13px",

  borderRadius: 15,

  border:
    "1px solid #dbeafe",

  background: "#ffffff",

  display: "flex",

  alignItems: "center",

  gap: 8,
};

const searchIcon: CSSProperties = {
  fontSize: 18,
};

const searchInput: CSSProperties = {
  width: "100%",

  border: "none",

  outline: "none",

  background: "transparent",

  color: "#0f172a",

  fontSize: 14,

  minWidth: 0,
};

const clearSearchButton: CSSProperties = {
  width: 30,
  height: 30,

  border: "none",

  borderRadius: 999,

  background: "#e2e8f0",

  color: "#475569",

  fontSize: 19,

  cursor: "pointer",

  flex: "0 0 auto",
};

const filterSelect: CSSProperties = {
  minHeight: 50,

  padding: "0 13px",

  borderRadius: 15,

  border:
    "1px solid #dbeafe",

  background: "#ffffff",

  color: "#0f172a",

  fontSize: 14,

  outline: "none",
};

const clearFiltersButton: CSSProperties = {
  minHeight: 50,

  padding: "0 14px",

  borderRadius: 15,

  border:
    "1px solid #cbd5e1",

  background: "#f8fafc",

  color: "#475569",

  fontSize: 13,
  fontWeight: 900,

  cursor: "pointer",

  whiteSpace: "nowrap",
};

const loadErrorBox: CSSProperties = {
  marginBottom: 13,

  padding: 12,

  border:
    "1px solid #fde68a",

  borderRadius: 14,

  background: "#fffbeb",

  color: "#92400e",

  fontSize: 13,
  fontWeight: 800,

  display: "flex",

  alignItems: "center",
  justifyContent: "space-between",

  flexWrap: "wrap",

  gap: 10,
};

const retryButton: CSSProperties = {
  border:
    "1px solid #f59e0b",

  borderRadius: 11,

  padding: "8px 11px",

  background: "#ffffff",

  color: "#92400e",

  fontSize: 12,
  fontWeight: 900,

  cursor: "pointer",
};

const recordsBar: CSSProperties = {
  marginBottom: 10,

  padding: "9px 12px",

  borderRadius: 13,

  background: "#f8fafc",

  border:
    "1px solid #e2e8f0",

  color: "#64748b",

  fontSize: 12,
  fontWeight: 800,

  display: "flex",

  alignItems: "center",
  justifyContent: "space-between",

  flexWrap: "wrap",

  gap: 8,
};

const tableScroll: CSSProperties = {
  width: "100%",

  overflowX: "auto",
};

const tableHeader: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "2fr 2fr 0.8fr 1.1fr 1.35fr",

  gap: 12,

  minWidth: 820,

  background:
    "linear-gradient(135deg,#eff6ff,#f8fbff)",

  color: "#1d4ed8",

  fontSize: 13,
  fontWeight: 900,

  padding: 13,

  borderRadius: 13,

  marginBottom: 7,

  border:
    "1px solid #dbeafe",
};

const tableRow: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "2fr 2fr 0.8fr 1.1fr 1.35fr",

  gap: 12,

  minWidth: 820,

  padding: 13,

  border:
    "1px solid transparent",

  borderBottomColor:
    "#e2e8f0",

  alignItems: "center",

  color: "#334155",

  fontSize: 13,

  transition:
    "background 0.15s ease",
};

const productCell: CSSProperties = {
  color: "#0f172a",

  fontWeight: 900,

  overflowWrap: "anywhere",
};

const quantityValue: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
};

const statusNegative: CSSProperties = {
  background: "#fee2e2",

  color: "#991b1b",

  border:
    "1px solid #fecaca",

  padding: "6px 9px",

  borderRadius: 999,

  fontSize: 11,
  fontWeight: 900,

  textAlign: "center",

  display: "inline-flex",

  alignItems: "center",
  justifyContent: "center",
};

const statusLow: CSSProperties = {
  background: "#fef3c7",

  color: "#92400e",

  border:
    "1px solid #fde68a",

  padding: "6px 9px",

  borderRadius: 999,

  fontSize: 11,
  fontWeight: 900,

  textAlign: "center",

  display: "inline-flex",

  alignItems: "center",
  justifyContent: "center",
};

const statusNormal: CSSProperties = {
  background: "#dcfce7",

  color: "#166534",

  border:
    "1px solid #bbf7d0",

  padding: "6px 9px",

  borderRadius: 999,

  fontSize: 11,
  fontWeight: 900,

  textAlign: "center",

  display: "inline-flex",

  alignItems: "center",
  justifyContent: "center",
};

const mobileCardsGrid: CSSProperties = {
  display: "grid",

  gap: 10,
};

const mobileInventoryCard: CSSProperties = {
  background: "#ffffff",

  border:
    "1px solid #dbeafe",

  borderRadius: 17,

  padding: 13,

  boxShadow:
    "0 7px 18px rgba(15,23,42,0.04)",
};

const mobileCardHeader: CSSProperties = {
  display: "flex",

  alignItems: "flex-start",
  justifyContent: "space-between",

  gap: 10,

  marginBottom: 11,
};

const mobileProductName: CSSProperties = {
  margin: "0 0 5px",

  color: "#0f172a",

  fontSize: 15,
  fontWeight: 900,

  overflowWrap: "anywhere",
};

const mobileInvestorName: CSSProperties = {
  color: "#64748b",

  fontSize: 12,
  fontWeight: 700,
};

const mobileDetailsGrid: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",

  gap: 8,
};

const mobileDetailItem: CSSProperties = {
  padding: 10,

  borderRadius: 13,

  background: "#f8fafc",

  border:
    "1px solid #e2e8f0",

  display: "flex",

  flexDirection: "column",

  gap: 4,
};

const mobileDetailLabel: CSSProperties = {
  color: "#64748b",

  fontSize: 10,
  fontWeight: 800,
};

const mobileDetailValue: CSSProperties = {
  color: "#334155",

  fontSize: 12,
  fontWeight: 900,
};

const emptyBox: CSSProperties = {
  minHeight: 130,

  background: "#f8fafc",

  border:
    "1px dashed #cbd5e1",

  borderRadius: 16,

  padding: 22,

  textAlign: "center",

  color: "#64748b",

  fontSize: 14,
  fontWeight: 800,

  display: "flex",

  flexDirection: "column",

  alignItems: "center",
  justifyContent: "center",

  gap: 12,
};

const contentSpinner: CSSProperties = {
  width: 28,
  height: 28,

  borderRadius: "50%",

  border:
    "3px solid #dbeafe",

  borderTopColor: "#2563eb",

  animation:
    "inventoryPageSpin 0.8s linear infinite",
};

const paginationBox: CSSProperties = {
  marginTop: 15,

  display: "flex",

  justifyContent: "center",
  alignItems: "center",

  flexWrap: "wrap",

  gap: 10,
};

const paginationButton: CSSProperties = {
  padding: "10px 16px",

  background: "#1d4ed8",

  color: "#ffffff",

  border: "none",

  borderRadius: 11,

  fontSize: 13,
  fontWeight: 900,

  cursor: "pointer",
};

const paginationText: CSSProperties = {
  color: "#334155",

  fontSize: 13,
  fontWeight: 900,
};

const backWrapper: CSSProperties = {
  display: "flex",

  justifyContent: "center",

  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "11px 20px",

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
};

const accessDeniedCard: CSSProperties = {
  maxWidth: 620,

  margin: "30px auto",

  padding: 28,

  borderRadius: 24,

  border:
    "1px solid #fecaca",

  background: "#ffffff",

  textAlign: "center",

  boxShadow:
    "0 14px 34px rgba(15,23,42,0.08)",
};

const accessDeniedIcon: CSSProperties = {
  fontSize: 42,

  marginBottom: 10,
};

const accessDeniedTitle: CSSProperties = {
  margin: "0 0 18px",

  color: "#991b1b",

  fontSize: 20,
  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",
};
