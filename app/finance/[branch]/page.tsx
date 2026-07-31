"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

type ScreenType = "mobile" | "tablet" | "desktop";
type SessionType = "branch_user" | "admin_support" | null;

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
  investor_id?: string | null;
  is_active?: boolean;
  session_version?: number;
  last_login_at?: string | null;
  logged_at?: string;
  support_user_id?: string;
  support_role?: string;
  is_support_session?: boolean;
};

type SupportSessionResponse = {
  ok: boolean;
  message?: string;
  session_type?: "admin_support";
  user?: FinanceUser;
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

type CustomerSearchRow = {
  id: string;
  full_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
};

type ContractSearchRow = {
  id: string;
  contract_number?: string | null;
  customer_name?: string | null;
  customer_national_id?: string | null;
  customer_phone?: string | null;
  investor_name?: string | null;
};

type InvestorSearchRow = {
  id: string;
  investor_name?: string | null;
  national_id?: string | null;
  commercial_record?: string | null;
};

type MainSection = {
  title: string;
  path: string;
  icon: string;
  color: string;
  bg: string;
  permission?: string;
};

type DrawerLink = {
  title: string;
  path: string;
  icon: string;
  permission: string;
};

type DrawerGroup = {
  title: string;
  links: DrawerLink[];
};

const SUPPORT_SESSION_TIMEOUT_MS = 5000;
const DASHBOARD_COUNTS_CACHE_TTL_MS =
  5 * 60 * 1000;

type DashboardCountsCache = {
  customersCount: number;
  contractsCount: number;
  cachedAt: number;
};

function getDashboardCountsCacheKey(
  branchId: string
) {
  return `finance_dashboard_counts_${branchId}`;
}

function readDashboardCountsCache(
  branchId: string
): DashboardCountsCache | null {
  if (
    typeof window === "undefined" ||
    !branchId
  ) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(
      getDashboardCountsCacheKey(
        branchId
      )
    );

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(
      raw
    ) as Partial<DashboardCountsCache>;

    const customersCount = Number(
      parsed.customersCount
    );

    const contractsCount = Number(
      parsed.contractsCount
    );

    const cachedAt = Number(
      parsed.cachedAt
    );

    if (
      !Number.isFinite(
        customersCount
      ) ||
      !Number.isFinite(
        contractsCount
      ) ||
      !Number.isFinite(
        cachedAt
      ) ||
      Date.now() - cachedAt >
        DASHBOARD_COUNTS_CACHE_TTL_MS
    ) {
      window.sessionStorage.removeItem(
        getDashboardCountsCacheKey(
          branchId
        )
      );

      return null;
    }

    return {
      customersCount,
      contractsCount,
      cachedAt,
    };
  } catch {
    return null;
  }
}

function writeDashboardCountsCache(
  branchId: string,
  customersCount: number,
  contractsCount: number
) {
  if (
    typeof window === "undefined" ||
    !branchId
  ) {
    return;
  }

  try {
    const cache: DashboardCountsCache = {
      customersCount,
      contractsCount,
      cachedAt: Date.now(),
    };

    window.sessionStorage.setItem(
      getDashboardCountsCacheKey(
        branchId
      ),
      JSON.stringify(cache)
    );
  } catch {
    // التخزين المؤقت تحسين اختياري ولا يعطل الصفحة عند فشله.
  }
}


const BRANCH_SLUG_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

const MANAGER_ROLES = [
  "main_admin",
  "branch_manager",
  "admin",
  "manager",
  "مدير فرع",
  "مدير رئيسي",
  "مدير",
];

const sections: MainSection[] = [
  {
    title: "سير العمل",
    path: "workflow",
    icon: "💼",
    color: "#2563eb",
    bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
    permission: "workflow",
  },
  {
    title: "المتابعة والتواصل",
    path: "follow-up",
    icon: "📞",
    color: "#7c3aed",
    bg: "linear-gradient(135deg,#f5f3ff,#ede9fe)",
    permission: "follow_up",
  },
  {
    title: "عروض الطلب الموجه",
    path: "directed-offers",
    icon: "🎯",
    color: "#0f766e",
    bg: "linear-gradient(135deg,#ecfeff,#ccfbf1)",
  },
  {
    title: "متجر البطاقات",
    path: "card-store",
    icon: "🎟️",
    color: "#0f2f5f",
    bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
    permission: "card_store",
  },
  {
    title: "احتساب التمويل",
    path: "ehtisab",
    icon: "🧮",
    color: "#d97706",
    bg: "linear-gradient(135deg,#fffbeb,#fef3c7)",
  },
  {
    title: "المخزون",
    path: "inventory",
    icon: "📦",
    color: "#0f766e",
    bg: "linear-gradient(135deg,#f0fdfa,#ccfbf1)",
    permission: "inventory",
  },
  {
    title: "العقود",
    path: "contracts",
    icon: "📄",
    color: "#1d4ed8",
    bg: "linear-gradient(135deg,#eef2ff,#dbeafe)",
    permission: "contracts",
  },
  {
    title: "العملاء",
    path: "customers",
    icon: "👥",
    color: "#0284c7",
    bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)",
    permission: "customers",
  },
  {
    title: "المستثمرين",
    path: "inventory/investors",
    icon: "➕",
    color: "#16a34a",
    bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
    permission: "contracts_create",
  },
  {
    title: "السداد",
    path: "payments",
    icon: "💳",
    color: "#059669",
    bg: "linear-gradient(135deg,#ecfdf5,#d1fae5)",
    permission: "payments",
  },
  {
    title: "المشتريات والمصروفات",
    path: "expenses",
    icon: "🧾",
    color: "#475569",
    bg: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
    permission: "expenses",
  },
  {
    title: "الملاحظات",
    path: "notes",
    icon: "✏️",
    color: "#0ea5e9",
    bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)",
    permission: "notes",
  },
  {
    title: "الإعدادات",
    path: "settings",
    icon: "⚙️",
    color: "#0f172a",
    bg: "linear-gradient(135deg,#f1f5f9,#e2e8f0)",
    permission: "settings",
  },
  {
    title: "إدارة الموظفين والصلاحيات",
    path: "permissions",
    icon: "🔐",
    color: "#334155",
    bg: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
    permission: "permissions",
  },
];

const drawerGroups: DrawerGroup[] = [
  {
    title: "العمل والمتابعة",
    links: [
      {
        title: "سير العمل",
        path: "workflow",
        icon: "💼",
        permission: "workflow",
      },
      {
        title: "المتابعة والتواصل",
        path: "follow-up",
        icon: "📞",
        permission: "follow_up",
      },
      {
        title: "الملاحظات والتذكيرات",
        path: "notes",
        icon: "✏️",
        permission: "notes",
      },
    ],
  },
  {
    title: "العملاء والعقود",
    links: [
      {
        title: "العملاء",
        path: "customers",
        icon: "👥",
        permission: "customers",
      },
      {
        title: "التحقق من عميل",
        path: "customers?verify=1",
        icon: "🛡️",
        permission: "customers_verify",
      },
      {
        title: "طلب جديد",
        path: "new-request",
        icon: "➕",
        permission: "contracts_create",
      },
      {
        title: "عروض الطلب الموجه",
        path: "directed-offers",
        icon: "🎯",
        permission: "contracts_create",
      },
      {
        title: "متجر البطاقات",
        path: "card-store",
        icon: "🎟️",
        permission: "card_store",
      },
      {
        title: "جميع العقود",
        path: "contracts",
        icon: "📄",
        permission: "contracts",
      },
    ],
  },
  {
    title: "السداد",
    links: [
      {
        title: "عمليات السداد",
        path: "payments",
        icon: "💳",
        permission: "payments",
      },
      {
        title: "إجراء سداد",
        path: "payments/new",
        icon: "✅",
        permission: "payments_create",
      },
    ],
  },
  {
    title: "المخزون والمستثمرون",
    links: [
      {
        title: "المخزون والمنتجات",
        path: "inventory",
        icon: "📦",
        permission: "inventory",
      },
      {
        title: "إضافة كمية للمخزون",
        path: "inventory/add-stock",
        icon: "➕",
        permission: "add_inventory",
      },
      {
        title: "سجل حركات المخزون",
        path: "inventory/movements",
        icon: "🔄",
        permission: "inventory",
      },
      {
        title: "المستثمرون",
        path: "inventory/investors",
        icon: "🏦",
        permission: "inventory",
      },
    ],
  },
  {
    title: "المصروفات والإدارة",
    links: [
      {
        title: "المصروفات",
        path: "expenses",
        icon: "🧾",
        permission: "expenses",
      },
      {
        title: "فاتورة مصروف",
        path: "expenses/new",
        icon: "➕",
        permission: "expenses",
      },
      {
        title: "إدارة الموظفين والصلاحيات",
        path: "permissions",
        icon: "🔐",
        permission: "permissions",
      },
      {
        title: "الإعدادات",
        path: "settings",
        icon: "⚙️",
        permission: "settings",
      },
    ],
  },
];

export default function FinancePage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "")
    .trim()
    .toLowerCase();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [organizationName, setOrganizationName] =
    useState("احتساب");

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [authorized, setAuthorized] =
    useState(false);

  const [sessionType, setSessionType] =
    useState<SessionType>(null);

  const [authMessage, setAuthMessage] =
    useState("جاري فتح محطة العمل...");

  const [sessionRestoreKey, setSessionRestoreKey] =
    useState(0);

  const [logoutLoading, setLogoutLoading] =
    useState(false);

  const [permissions, setPermissions] =
    useState<string[]>([]);

  const [roles, setRoles] =
    useState<string[]>([]);

  const [customersCount, setCustomersCount] =
    useState<number | null>(null);

  const [contractsCount, setContractsCount] =
    useState<number | null>(null);

  const [alerts, setAlerts] =
    useState<AlertItem[]>([]);

  const [latestActivities, setLatestActivities] =
    useState<ActivityItem[]>([]);

  const [searchText, setSearchText] =
    useState("");

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [searchResults, setSearchResults] =
    useState<SearchResult[]>([]);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const searchRequestIdRef =
    useRef(0);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const isSupportSession =
    sessionType === "admin_support";

  const isManagerUser = useMemo(
    () =>
      roles.some((role) =>
        MANAGER_ROLES.includes(
          role.trim().toLowerCase()
        )
      ),
    [roles]
  );

  const today = new Date().toLocaleDateString(
    "en-CA"
  );

  const normalizeStringArray = useCallback(
    (value: unknown): string[] => {
      if (!Array.isArray(value)) {
        return [];
      }

      return Array.from(
        new Set(
          value
            .filter(
              (item): item is string =>
                typeof item === "string"
            )
            .map((item) =>
              item.trim()
            )
            .filter(Boolean)
        )
      );
    },
    []
  );

  const applyAuthorizedUser = useCallback(
    (
      user: FinanceUser,
      type: Exclude<SessionType, null>
    ) => {
      const baseRoles =
        Array.isArray(user.roles) &&
        user.roles.length > 0
          ? normalizeStringArray(user.roles)
          : user.role
            ? normalizeStringArray([
                user.role,
              ])
            : [];

      const userRoles =
        type === "admin_support"
          ? Array.from(
              new Set([
                ...baseRoles,
                "support_impersonation",
              ])
            )
          : baseRoles;

      const userPermissions =
        normalizeStringArray(
          user.permissions
        );

      setOrganizationName(
        user.organization_name ||
          "احتساب"
      );

      setBranchId(user.branch_id);

      setCustomersCount(null);
      setContractsCount(null);

      setEmployeeName(
        user.full_name ||
          user.username ||
          "الموظف"
      );

      setRoles(userRoles);
      setPermissions(userPermissions);
      setSessionType(type);
      setAuthorized(true);
      setAuthMessage(
        "جاري فتح محطة العمل..."
      );
    },
    [normalizeStringArray]
  );

  const getSupportSession = useCallback(
    async (
      isCancelled: () => boolean
    ): Promise<FinanceUser | null> => {
      const controller =
        new AbortController();

      const timeoutId =
        window.setTimeout(() => {
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
            message:
              "تعذر قراءة استجابة جلسة الدعم",
          };
        }

        if (isCancelled()) {
          return null;
        }

        if (
          response.ok &&
          payload.ok &&
          payload.session_type ===
            "admin_support" &&
          payload.user &&
          typeof payload.user.id ===
            "string" &&
          typeof payload.user.branch_id ===
            "string" &&
          typeof payload.user.branch_slug ===
            "string"
        ) {
          return payload.user;
        }

        if (
          response.status !== 401 &&
          response.status !== 403
        ) {
          console.error(
            "Support session verification failed:",
            payload.message ||
              response.status
          );
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
          "Support session request failed:",
          error
        );

        return null;
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [branch]
  );

  const verifyBranchUserInBackground =
    useCallback(
      async (
        user: FinanceUser,
        isCancelled: () => boolean
      ) => {
        try {
          const [
            branchResult,
            userResult,
          ] = await Promise.all([
            supabase
              .from("finance_branches")
              .select(
                "id, organization_name, branch_name, branch_slug, is_active"
              )
              .eq("id", user.branch_id)
              .maybeSingle(),

            supabase
              .from(
                "finance_branch_users"
              )
              .select(
                "id, full_name, username, role, permissions, branch_id, is_active, session_version"
              )
              .eq("id", user.id)
              .eq(
                "branch_id",
                user.branch_id
              )
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

          if (
            !branchResult.error &&
            (!branchResult.data ||
              branchResult.data.is_active ===
                false)
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
              userResult.data.is_active ===
                false)
          ) {
            redirectToFinanceLogin(router, {
              branchSlug: branch,
              preserveReturnPath: true,
            });

            return;
          }

          if (
            !userResult.error &&
            userResult.data &&
            typeof user.session_version ===
              "number" &&
            typeof userResult.data
              .session_version ===
              "number" &&
            userResult.data
              .session_version !==
              user.session_version
          ) {
            redirectToFinanceLogin(router, {
              branchSlug: branch,
              preserveReturnPath: true,
            });

            return;
          }

          if (branchResult.data) {
            const refreshedOrganizationName =
              branchResult.data
                .organization_name ||
              user.organization_name ||
              "احتساب";

            setOrganizationName(
              refreshedOrganizationName
            );

            localStorage.setItem(
              "finance_branch_name",
              branchResult.data.branch_name ||
                ""
            );

            localStorage.setItem(
              "finance_organization_name",
              refreshedOrganizationName
            );
          }

          if (userResult.data) {
            const refreshedEmployeeName =
              userResult.data.full_name ||
              userResult.data.username ||
              user.full_name ||
              user.username ||
              "الموظف";

            const refreshedRole =
              typeof userResult.data.role ===
                "string"
                ? userResult.data.role.trim()
                : "";

            const refreshedPermissions =
              normalizeStringArray(
                userResult.data.permissions
              );

            setEmployeeName(
              refreshedEmployeeName
            );

            setRoles(
              refreshedRole
                ? [refreshedRole]
                : []
            );

            setPermissions(
              refreshedPermissions
            );

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
      [
        branch,
        normalizeStringArray,
        router,
      ]
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

    window.addEventListener(
      "resize",
      updateScreen
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateScreen
      );
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [menuOpen]);

  useEffect(() => {
    function handlePageShow(
      event: PageTransitionEvent
    ) {
      if (!event.persisted) {
        return;
      }

      setAuthMessage(
        "جاري فتح محطة العمل..."
      );

      setSessionRestoreKey(
        (currentKey) =>
          currentKey + 1
      );
    }

    window.addEventListener(
      "pageshow",
      handlePageShow
    );

    return () => {
      window.removeEventListener(
        "pageshow",
        handlePageShow
      );
    };
  }, []);

  useEffect(() => {
    if (
      !branch ||
      !BRANCH_SLUG_PATTERN.test(
        branch
      )
    ) {
      redirectToFinanceLogin(router, {
        preserveReturnPath: true,
      });

      return;
    }

    let cancelled = false;

    async function initializePage() {
      setAuthMessage(
        "جاري فتح محطة العمل..."
      );

      const validation =
        validateFinanceSession(branch);

      if (
        validation.reason ===
          "BRANCH_MISMATCH" &&
        validation.user?.branch_slug
      ) {
        router.replace(
          `/finance/${validation.user.branch_slug}`
        );

        return;
      }

      if (
        validation.valid &&
        validation.user
      ) {
        const session =
          validation.user;

        const localUser: FinanceUser = {
          id: String(
            session.id || ""
          ),

          branch_id: String(
            session.branch_id || ""
          ),

          branch_slug: String(
            session.branch_slug ||
              branch
          )
            .trim()
            .toLowerCase(),

          branch_name:
            session.branch_name || "",

          organization_name:
            session.organization_name ||
            localStorage.getItem(
              "finance_organization_name"
            ) ||
            "احتساب",

          full_name:
            getFinanceEmployeeName(
              session
            ),

          username:
            session.username || "",

          role:
            session.role || "",

          roles: session.role
            ? [session.role]
            : [],

          permissions:
            Array.isArray(
              session.permissions
            )
              ? session.permissions
              : [],

          investor_id:
            session.investor_id ||
            null,

          is_active:
            session.is_active !==
            false,

          session_version:
            typeof session.session_version ===
              "number"
              ? session.session_version
              : undefined,

          last_login_at:
            session.last_login_at ||
            null,
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

          void verifyBranchUserInBackground(
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
              BRANCH_SLUG_PATTERN.test(
                supportBranchSlug
              ) &&
              supportBranchSlug ===
                branch &&
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

        if (
          !BRANCH_SLUG_PATTERN.test(
            supportBranchSlug
          ) ||
          !supportUser.branch_id
        ) {
          redirectToFinanceLogin(router, {
            preserveReturnPath: true,
          });

          return;
        }

        if (
          supportBranchSlug !== branch
        ) {
          router.replace(
            `/finance/${encodeURIComponent(
              supportBranchSlug
            )}`
          );

          return;
        }

        applyAuthorizedUser(
          supportUser,
          "admin_support"
        );

        return;
      }

      redirectToFinanceLogin(router, {
        branchSlug: branch,
        preserveReturnPath: true,
      });
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [
    applyAuthorizedUser,
    branch,
    getSupportSession,
    router,
    sessionRestoreKey,
    verifyBranchUserInBackground,
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
        setMenuOpen(false);

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
    if (!authorized || !branchId) {
      return;
    }

    const safeBranchId =
      branchId;

    let cancelled = false;

    void loadDashboardData(
      safeBranchId,
      {
        canViewCustomers:
          hasPermission(
            "customers"
          ),
        canViewContracts:
          hasPermission(
            "contracts"
          ),
        canViewInventory:
          isManagerUser,
        canViewActivities:
          isManagerUser,
      },
      () => cancelled
    );

    return () => {
      cancelled = true;
    };
  }, [
    authorized,
    branchId,
    permissions,
    roles,
    isManagerUser,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSmartSearch();
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    searchText,
    branchId,
    permissions,
    roles,
    authorized,
  ]);

  function resetPageSessionState() {
    setAuthorized(false);
    setSessionType(null);
    setBranchId(null);
    setPermissions([]);
    setRoles([]);
    setSearchText("");
    setSearchResults([]);
    setCustomersCount(null);
    setContractsCount(null);
    setAlerts([]);
    setLatestActivities([]);
    setMenuOpen(false);
  }

  function hasPermission(
    permissionKey: string
  ) {
    return (
      roles.includes(
        "support_impersonation"
      ) ||
      roles.some((role) =>
        MANAGER_ROLES.includes(role)
      ) ||
      permissions.includes(
        permissionKey
      )
    );
  }

  const visibleSections = useMemo(() => {
    if (!authorized) {
      return [];
    }

    return sections.filter(
      (item) =>
        !item.permission ||
        hasPermission(item.permission)
    );
  }, [
    authorized,
    permissions,
    roles,
  ]);

  const visibleDrawerGroups =
    useMemo(() => {
      if (!authorized) {
        return [];
      }

      return drawerGroups
        .map((group) => ({
          ...group,

          links: group.links.filter(
            (link) =>
              hasPermission(
                link.permission
              )
          ),
        }))
        .filter(
          (group) =>
            group.links.length > 0
        );
    }, [
      authorized,
      permissions,
      roles,
    ]);

  async function loadDashboardData(
    currentBranchId: string,
    access: {
      canViewCustomers: boolean;
      canViewContracts: boolean;
      canViewInventory: boolean;
      canViewActivities: boolean;
    },
    isCancelled: () => boolean = () => false
  ) {
    const tasks: Promise<void>[] = [
      loadCounts(
        currentBranchId,
        access,
        isCancelled
      ),
    ];

    if (access.canViewInventory) {
      tasks.push(
        loadAlerts(
          currentBranchId,
          isCancelled
        )
      );
    } else {
      setAlerts([]);
    }

    if (access.canViewActivities) {
      tasks.push(
        loadLatestActivities(
          currentBranchId,
          isCancelled
        )
      );
    } else {
      setLatestActivities([]);
    }

    await Promise.allSettled(tasks);
  }

  async function loadCounts(
    currentBranchId: string,
    access: {
      canViewCustomers: boolean;
      canViewContracts: boolean;
    },
    isCancelled: () => boolean = () => false
  ) {
    try {
      const customersRequest =
        access.canViewCustomers
          ? supabase
              .from(
                "finance_customers"
              )
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq(
                "branch_id",
                currentBranchId
              )
              .or(
                "is_archived.is.null,is_archived.eq.false"
              )
          : Promise.resolve({
              count: 0,
              error: null,
            });

      const contractsRequest =
        access.canViewContracts
          ? supabase
              .from(
                "finance_contracts"
              )
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq(
                "branch_id",
                currentBranchId
              )
              .or(
                "is_archived.is.null,is_archived.eq.false"
              )
          : Promise.resolve({
              count: 0,
              error: null,
            });

      const [
        customersResult,
        contractsResult,
      ] = await Promise.all([
        customersRequest,
        contractsRequest,
      ]);

      if (isCancelled()) {
        return;
      }

      if (customersResult.error) {
        console.error(
          "Customers count error:",
          customersResult.error
        );
      }

      if (contractsResult.error) {
        console.error(
          "Contracts count error:",
          contractsResult.error
        );
      }

      const nextCustomersCount =
        access.canViewCustomers
          ? customersResult.error
            ? customersCount
            : customersResult.count ?? 0
          : 0;

      const nextContractsCount =
        access.canViewContracts
          ? contractsResult.error
            ? contractsCount
            : contractsResult.count ?? 0
          : 0;

      if (
        nextCustomersCount !== null
      ) {
        setCustomersCount(
          nextCustomersCount
        );
      }

      if (
        nextContractsCount !== null
      ) {
        setContractsCount(
          nextContractsCount
        );
      }

      if (
        nextCustomersCount !== null &&
        nextContractsCount !== null
      ) {
        writeDashboardCountsCache(
          currentBranchId,
          nextCustomersCount,
          nextContractsCount
        );
      }
    } catch (error) {
      console.error(
        "Counts loading failed:",
        error
      );
    }
  }

  async function loadAlerts(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    try {
      const newAlerts: AlertItem[] =
        [];

      const [
        negativeResult,
        lowResult,
      ] = await Promise.all([
        supabase
          .from("finance_inventory")
          .select(
            `
              id,
              quantity,
              finance_products(product_name)
            `
          )
          .eq(
            "branch_id",
            currentBranchId
          )
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
          .eq(
            "branch_id",
            currentBranchId
          )
          .gte("quantity", 0)
          .lte("quantity", 5)
          .limit(3),
      ]);

      if (isCancelled()) {
        return;
      }

      if (negativeResult.error) {
        console.error(
          "Negative inventory alerts error:",
          negativeResult.error
        );
      }

      if (lowResult.error) {
        console.error(
          "Low inventory alerts error:",
          lowResult.error
        );
      }

      const negativeInventory =
        (negativeResult.data ||
          []) as InventoryAlertRow[];

      const lowInventory =
        (lowResult.data ||
          []) as InventoryAlertRow[];

      negativeInventory.forEach(
        (item) => {
          newAlerts.push({
            id: `negative-${item.id}`,
            type: "danger",

            text: `منتج بالسالب: ${getProductName(
              item
            )} - الكمية ${
              item.quantity ?? 0
            }`,

            href: `/finance/${branch}/inventory`,
          });
        }
      );

      lowInventory.forEach(
        (item) => {
          newAlerts.push({
            id: `low-${item.id}`,
            type: "green",

            text: `منتج منخفض: ${getProductName(
              item
            )} - الكمية ${
              item.quantity ?? 0
            }`,

            href: `/finance/${branch}/inventory`,
          });
        }
      );

      if (newAlerts.length === 0) {
        newAlerts.push({
          id: "safe",
          type: "blue",

          text:
            "لا توجد تنبيهات مهمة حالياً",

          href: `/finance/${branch}/inventory`,
        });
      }

      setAlerts(
        newAlerts.slice(0, 3)
      );
    } catch (error) {
      console.error(
        "Alerts loading failed:",
        error
      );
    }
  }

  async function loadLatestActivities(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    try {
      const { data, error } =
        await supabase
          .from(
            "finance_activity_logs"
          )
          .select("*")
          .eq(
            "branch_id",
            currentBranchId
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(3);

      if (isCancelled()) {
        return;
      }

      if (error) {
        console.error(
          "Latest activities error:",
          error
        );

        setLatestActivities([]);
        return;
      }

      setLatestActivities(
        (data || []) as ActivityItem[]
      );
    } catch (error) {
      console.error(
        "Activities loading failed:",
        error
      );
    }
  }

  function getProductName(
    item: InventoryAlertRow
  ) {
    const relation =
      item.finance_products;

    if (Array.isArray(relation)) {
      return (
        relation[0]?.product_name ||
        item.product_name ||
        "منتج غير محدد"
      );
    }

    return (
      relation?.product_name ||
      item.product_name ||
      "منتج غير محدد"
    );
  }

  function getActivityText(
    item: ActivityItem
  ) {
    return (
      item.description ||
      item.details ||
      item.note ||
      item.action ||
      item.action_type ||
      "عملية جديدة"
    );
  }

  function normalizeDigits(
    value: string
  ) {
    return value
      .replace(
        /[٠-٩]/g,
        (digit) =>
          "٠١٢٣٤٥٦٧٨٩"
            .indexOf(digit)
            .toString()
      )
      .replace(
        /[۰-۹]/g,
        (digit) =>
          "۰۱۲۳۴۵۶۷۸۹"
            .indexOf(digit)
            .toString()
      );
  }

  async function runSmartSearch() {
    const query = normalizeDigits(
      searchText.trim()
    );

    if (
      !authorized ||
      !branchId ||
      query.length < 2
    ) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const safeBranchId =
      branchId;

    const safeQuery = query
      .replace(
        /[(),.%*"'\\:{}\[\]]/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();

    if (safeQuery.length < 2) {
      searchRequestIdRef.current += 1;
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const requestId =
      ++searchRequestIdRef.current;

    setSearchLoading(true);

    try {
      const customerRequest =
        hasPermission("customers")
          ? supabase
              .from(
                "finance_customers"
              )
              .select(
                "id, full_name, national_id, phone"
              )
              .eq(
                "branch_id",
                safeBranchId
              )
              .or(
                "is_archived.is.null,is_archived.eq.false"
              )
              .or(
                `full_name.ilike.%${safeQuery}%,national_id.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`
              )
              .limit(5)
          : Promise.resolve({
              data:
                [] as CustomerSearchRow[],
              error: null,
            });

      const contractRequest =
        hasPermission("contracts")
          ? supabase
              .from(
                "finance_contracts"
              )
              .select(
                "id, contract_number, customer_name, customer_national_id, customer_phone, investor_name"
              )
              .eq(
                "branch_id",
                safeBranchId
              )
              .or(
                "is_archived.is.null,is_archived.eq.false"
              )
              .or(
                `contract_number.ilike.%${safeQuery}%,customer_name.ilike.%${safeQuery}%,customer_national_id.ilike.%${safeQuery}%,customer_phone.ilike.%${safeQuery}%,investor_name.ilike.%${safeQuery}%`
              )
              .limit(5)
          : Promise.resolve({
              data:
                [] as ContractSearchRow[],
              error: null,
            });

      const investorRequest =
        hasPermission("inventory")
          ? supabase
              .from(
                "finance_investors"
              )
              .select(
                "id, investor_name, national_id, commercial_record"
              )
              .eq(
                "branch_id",
                safeBranchId
              )
              .or(
                `investor_name.ilike.%${safeQuery}%,national_id.ilike.%${safeQuery}%,commercial_record.ilike.%${safeQuery}%`
              )
              .limit(5)
          : Promise.resolve({
              data:
                [] as InvestorSearchRow[],
              error: null,
            });

      const [
        customersResult,
        contractsResult,
        investorsResult,
      ] = await Promise.all([
        customerRequest,
        contractRequest,
        investorRequest,
      ]);

      if (customersResult.error) {
        console.error(
          "Customer smart search error:",
          customersResult.error
        );
      }

      if (contractsResult.error) {
        console.error(
          "Contract smart search error:",
          contractsResult.error
        );
      }

      if (investorsResult.error) {
        console.error(
          "Investor smart search error:",
          investorsResult.error
        );
      }

      const customerRows =
        (customersResult.data ||
          []) as CustomerSearchRow[];

      const contractRows =
        (contractsResult.data ||
          []) as ContractSearchRow[];

      const investorRows =
        (investorsResult.data ||
          []) as InvestorSearchRow[];

      if (
        requestId !==
        searchRequestIdRef.current
      ) {
        return;
      }

      const customers: SearchResult[] =
        customerRows.map((item) => ({
          id: String(item.id),
          type: "عميل",
          icon: "👤",

          title:
            item.full_name || "-",

          subtitle: `${
            item.phone || "-"
          } | ${
            item.national_id || "-"
          }`,

          href: `/finance/${branch}/customers/${item.id}`,
        }));

      const contracts: SearchResult[] =
        contractRows.map((item) => ({
          id: String(item.id),
          type: "عقد",
          icon: "📄",

          title: `عقد رقم ${
            item.contract_number || "-"
          }`,

          subtitle: `${
            item.customer_name || "-"
          } | ${
            item.customer_phone || "-"
          } | ${
            item.investor_name || "-"
          }`,

          href: `/finance/${branch}/contracts/${item.id}`,
        }));

      const investors: SearchResult[] =
        investorRows.map((item) => ({
          id: String(item.id),
          type: "مستثمر",
          icon: "🏦",

          title:
            item.investor_name || "-",

          subtitle:
            item.national_id ||
            item.commercial_record ||
            "-",

          href: `/finance/${branch}/inventory/investors/${item.id}`,
        }));

      setSearchResults([
        ...customers,
        ...contracts,
        ...investors,
      ]);
    } catch (error) {
      console.error(
        "Smart search error:",
        error
      );

      setSearchResults([]);
    } finally {
      if (
        requestId ===
        searchRequestIdRef.current
      ) {
        setSearchLoading(false);
      }
    }
  }

  function go(path: string) {
    const safePath =
      path.trim();

    if (
      !safePath ||
      safePath.startsWith("/") ||
      safePath.includes("..") ||
      safePath.includes("\\") ||
      !BRANCH_SLUG_PATTERN.test(
        branch
      )
    ) {
      console.error(
        "Blocked unsafe finance navigation path:",
        path
      );

      return;
    }

    setMenuOpen(false);

    router.push(
      `/finance/${branch}/${safePath}`
    );
  }

  async function leaveSupportBranch() {
    setLogoutLoading(true);
    setMenuOpen(false);
    setAuthorized(false);

    try {
      const response = await fetch(
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

      if (!response.ok) {
        console.error(
          "Support impersonation logout failed:",
          response.status
        );
      }
    } catch (error) {
      console.error(
        "Support impersonation logout request failed:",
        error
      );
    } finally {
      resetPageSessionState();
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

    setMenuOpen(false);

    if (isSupportSession) {
      await leaveSupportBranch();
      return;
    }

    logoutFinanceUser(router);
  }

  if (!authorized) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(
          isMobile
        )}
      >
        <div
          style={getContainerStyle(
            isCompact
          )}
        >
          <section
            style={getHeroStyle(
              isMobile
            )}
          >
            <div
              style={heroCircleOne}
            />

            <div
              style={heroCircleTwo}
            />

            <div
              style={heroCircleThree}
            />

            <div style={heroDots} />

            <div
              style={loadingHeroContent}
            >
              <div
                style={loadingContentBox}
              >
                <span
                  style={loadingSpinner}
                />

                <h1
                  style={getTitleStyle(
                    screen
                  )}
                >
                  {authMessage}
                </h1>
              </div>
            </div>
          </section>
        </div>

        <GlobalStyles />
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={getPageStyle(
        isMobile
      )}
    >
      <div
        style={getContainerStyle(
          isCompact
        )}
      >
        <section
          style={getHeroStyle(
            isMobile
          )}
        >
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <button
            type="button"
            style={getMenuButtonStyle(
              isMobile
            )}
            onClick={() =>
              setMenuOpen(true)
            }
            aria-label="فتح القائمة الجانبية"
            aria-expanded={menuOpen}
          >
            <MenuIcon />

            {!isMobile && (
              <span>القائمة</span>
            )}
          </button>

          <div
            style={getHeroContentStyle(
              screen
            )}
          >
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
                <div
                  style={employeeIcon}
                >
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
                  <span
                    style={
                      supportSessionBadge
                    }
                  >
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
                        ? 0.7
                        : 1,

                    cursor:
                      logoutLoading
                        ? "not-allowed"
                        : "pointer",
                  }}
                  onClick={() =>
                    void logout()
                  }
                  disabled={
                    logoutLoading
                  }
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
            </div>

            <div
              style={getHeroTitleBoxStyle(
                screen
              )}
            >
              <h1
                style={getOrganizationTitleStyle(
                  screen
                )}
              >
                {organizationName}
              </h1>

              <div
                style={getWorkstationTitleStyle(
                  screen
                )}
              >
                محطة العمل الرئيسية
              </div>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            >
              <div style={dateBox}>
                <span style={dateLabel}>
                  التاريخ
                </span>

                <strong style={dateText}>
                  {today}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section style={statsGrid}>
          {hasPermission(
            "contracts"
          ) && (
            <StatCard
              title="العقود"
              value={contractsCount}
              icon="📄"
              color="#2563eb"
              onClick={() =>
                go("contracts")
              }
            />
          )}

          {hasPermission(
            "customers"
          ) && (
            <StatCard
              title="العملاء"
              value={customersCount}
              icon="👥"
              color="#0284c7"
              onClick={() =>
                go("customers/list")
              }
            />
          )}
        </section>

        <section
          style={searchWrapper}
        >
          <section
            style={searchCard}
          >
            <span style={searchIcon}>
              🔎
            </span>

            <input
              style={searchInput}
              value={searchText}
              onChange={(event) =>
                setSearchText(
                  event.target.value
                )
              }
              placeholder="البحث السريع: اسم العميل، رقم العقد، الهوية، الجوال..."
            />

            {searchText && (
              <button
                type="button"
                style={
                  clearSearchButton
                }
                onClick={() => {
                  setSearchText("");
                  setSearchResults([]);
                }}
                aria-label="مسح البحث"
              >
                ×
              </button>
            )}
          </section>

          {searchText.trim().length >=
            2 && (
            <div style={resultsBox}>
              {searchLoading ? (
                <div
                  style={emptyResult}
                >
                  جاري البحث...
                </div>
              ) : searchResults.length ===
                0 ? (
                <div
                  style={emptyResult}
                >
                  لا توجد نتائج مطابقة
                </div>
              ) : (
                searchResults.map(
                  (item) => (
                    <button
                      type="button"
                      key={`${item.type}-${item.id}`}
                      style={resultItem}
                      onClick={() =>
                        router.push(
                          item.href
                        )
                      }
                    >
                      <span
                        style={
                          resultIcon
                        }
                      >
                        {item.icon}
                      </span>

                      <span
                        style={
                          resultContent
                        }
                      >
                        <strong>
                          {item.title}
                        </strong>

                        <small>
                          {item.subtitle}
                        </small>
                      </span>

                      <span
                        style={
                          resultType
                        }
                      >
                        {item.type}
                      </span>
                    </button>
                  )
                )
              )}
            </div>
          )}
        </section>

        <section style={quickActions}>
          {hasPermission(
            "contracts_create"
          ) && (
            <button
              type="button"
              style={primaryAction}
              onClick={() =>
                go("new-request")
              }
            >
              ➕ طلب جديد
            </button>
          )}

          {hasPermission(
            "payments_create"
          ) && (
            <button
              type="button"
              style={greenAction}
              onClick={() =>
                go("payments/new")
              }
            >
              💳 تسجيل سداد
            </button>
          )}

          {hasPermission(
            "add_inventory"
          ) && (
            <button
              type="button"
              style={tealAction}
              onClick={() =>
                go(
                  "inventory/add-stock"
                )
              }
            >
              📦 إضافة كمية للمخزون
            </button>
          )}

          {hasPermission(
            "expenses"
          ) && (
            <button
              type="button"
              style={grayAction}
              onClick={() =>
                go("expenses/new")
              }
            >
              🧾 فاتورة مصروف
            </button>
          )}
        </section>

        <section style={sectionsPanel}>
          <div style={panelHeader}>
            <span
              style={panelIconBlue}
            >
              ⚡
            </span>

            <strong>
              أقسام محطة العمل
            </strong>
          </div>

          <div style={grid}>
            {visibleSections.map(
              (item) => (
                <button
                  type="button"
                  key={item.title}
                  style={sectionCard}
                  onClick={() =>
                    go(item.path)
                  }
                >
                  <div style={cardRight}>
                    <div
                      style={{
                        ...iconBox,

                        background:
                          item.bg,

                        color:
                          item.color,
                      }}
                    >
                      {item.icon}
                    </div>

                    <div
                      style={cardTitle}
                    >
                      {item.title}
                    </div>
                  </div>

                  <span
                    style={{
                      ...arrow,

                      color:
                        item.color,
                    }}
                  >
                    ‹
                  </span>
                </button>
              )
            )}
          </div>
        </section>

        {isManagerUser && (
          <section
            style={compactInfoGrid}
          >
          <div style={compactPanel}>
            <div
              style={
                compactPanelHeader
              }
            >
              <span
                style={
                  compactPanelIconBlue
                }
              >
                🚨
              </span>

              <strong>
                تنبيهات مهمة
              </strong>
            </div>

            {alerts.map((item) => (
              <button
                type="button"
                key={item.id}
                style={
                  item.type === "green"
                    ? compactNoticeGreen
                    : item.type ===
                        "danger"
                      ? compactNoticeRed
                      : compactNoticeBlue
                }
                onClick={() =>
                  router.push(
                    item.href
                  )
                }
              >
                {item.text}
              </button>
            ))}
          </div>

          <div style={compactPanel}>
            <div
              style={
                compactPanelHeader
              }
            >
              <span
                style={
                  compactPanelIconGreen
                }
              >
                🕒
              </span>

              <strong>
                آخر العمليات
              </strong>
            </div>

            {latestActivities.length ===
            0 ? (
              <div
                style={
                  compactActivityItem
                }
              >
                لا توجد عمليات مسجلة
                حالياً
              </div>
            ) : (
              latestActivities.map(
                (item) => (
                  <div
                    key={item.id}
                    style={
                      compactActivityItem
                    }
                  >
                    {getActivityText(
                      item
                    )}
                  </div>
                )
              )
            )}
          </div>
          </section>
        )}
      </div>

      <SideDrawer
        open={menuOpen}
        organizationName={
          organizationName
        }
        employeeName={employeeName}
        groups={visibleDrawerGroups}
        isSupportSession={
          isSupportSession
        }
        logoutLoading={logoutLoading}
        onClose={() =>
          setMenuOpen(false)
        }
        onGo={go}
        onHome={() => {
          setMenuOpen(false);

          router.push(
            `/finance/${branch}`
          );
        }}
        onLogout={() =>
          void logout()
        }
      />

      <GlobalStyles />
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  onClick,
}: {
  title: string;
  value: number | null;
  icon: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      style={statCard}
      onClick={onClick}
      className="finance-stat-card"
      aria-label={`فتح قائمة ${title}`}
      aria-busy={value === null}
    >
      <div
        style={{
          ...statIcon,

          background:
            `${color}14`,

          color,
        }}
      >
        {icon}
      </div>

      <div style={statContent}>
        <div style={statValue}>
          {value === null
            ? "..."
            : value}
        </div>

        <div style={statTitle}>
          {title}
        </div>
      </div>

      <span
        style={{
          ...statArrow,
          color,
        }}
      >
        ‹
      </span>
    </button>
  );
}

function SideDrawer({
  open,
  organizationName,
  employeeName,
  groups,
  isSupportSession,
  logoutLoading,
  onClose,
  onGo,
  onHome,
  onLogout,
}: {
  open: boolean;
  organizationName: string;
  employeeName: string;
  groups: DrawerGroup[];
  isSupportSession: boolean;
  logoutLoading: boolean;
  onClose: () => void;
  onGo: (path: string) => void;
  onHome: () => void;
  onLogout: () => void;
}) {
  return (
    <div
      style={{
        ...drawerLayer,

        visibility:
          open
            ? "visible"
            : "hidden",

        pointerEvents:
          open
            ? "auto"
            : "none",
      }}
      aria-hidden={!open}
    >
      <button
        type="button"
        style={{
          ...drawerBackdrop,

          opacity:
            open
              ? 1
              : 0,
        }}
        onClick={onClose}
        aria-label="إغلاق القائمة"
      />

      <aside
        style={{
          ...drawerPanel,

          transform:
            open
              ? "translateX(0)"
              : "translateX(105%)",
        }}
        aria-label="قائمة محطة العمل"
      >
        <div style={drawerHeader}>
          <div>
            <div
              style={
                drawerOrganizationName
              }
            >
              {organizationName}
            </div>

            <div
              style={drawerSubtitle}
            >
              محطة العمل الرئيسية
            </div>
          </div>

          <button
            type="button"
            style={drawerCloseButton}
            onClick={onClose}
            aria-label="إغلاق القائمة"
          >
            ×
          </button>
        </div>

        <div style={drawerEmployeeBox}>
          <div
            style={
              drawerEmployeeIcon
            }
          >
            <UserIcon />
          </div>

          <div
            style={
              drawerEmployeeDetails
            }
          >
            <strong>
              {employeeName}
            </strong>

            <span>
              {isSupportSession
                ? "جلسة دعم فني"
                : "موظف محطة العمل"}
            </span>
          </div>
        </div>

        <button
          type="button"
          style={drawerHomeButton}
          onClick={onHome}
        >
          <span>🏠</span>
          <span>
            محطة العمل الرئيسية
          </span>
        </button>

        <div style={drawerScrollArea}>
          {groups.map((group) => (
            <section
              key={group.title}
              style={drawerGroup}
            >
              <div
                style={
                  drawerGroupTitle
                }
              >
                {group.title}
              </div>

              <div
                style={
                  drawerLinksList
                }
              >
                {group.links.map(
                  (link) => (
                    <button
                      type="button"
                      key={`${group.title}-${link.path}`}
                      style={
                        drawerLinkButton
                      }
                      onClick={() =>
                        onGo(link.path)
                      }
                    >
                      <span
                        style={
                          drawerLinkIcon
                        }
                      >
                        {link.icon}
                      </span>

                      <span>
                        {link.title}
                      </span>

                      <span
                        style={
                          drawerLinkArrow
                        }
                      >
                        ‹
                      </span>
                    </button>
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        <div style={drawerFooter}>
          <button
            type="button"
            style={drawerLogoutButton}
            disabled={logoutLoading}
            onClick={onLogout}
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
      </aside>
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

function MenuIcon() {
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6.5h16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      <path
        d="M4 12h16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      <path
        d="M4 17.5h16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
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

      button {
        -webkit-tap-highlight-color: transparent;
      }

      button:disabled {
        cursor: not-allowed !important;
        opacity: 0.65;
      }

      .finance-stat-card {
        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease,
          border-color 0.18s ease;
      }

      .finance-stat-card:hover {
        transform: translateY(-2px);
        border-color: #bfdbfe !important;
        box-shadow:
          0 14px 30px rgba(37, 99, 235, 0.1) !important;
      }

      .finance-stat-card:active {
        transform: scale(0.985);
      }

      @keyframes financeMainSpin {
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

      gap: 18,
      direction: "rtl",

      paddingTop: 46,
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

      paddingTop: 38,
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
      minHeight: 42,

      display: "flex",

      alignItems: "center",
      justifyContent: "center",

      flexWrap: "wrap",
      gap: 14,

      direction: "rtl",
      color: "#ffffff",

      width: "100%",
    };
  }

  return {
    minHeight: 42,

    display: "flex",

    alignItems: "center",
    flexWrap: "wrap",

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

    order:
      screen === "desktop"
        ? 0
        : 1,
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
    fontWeight: 900,

    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",

    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getWorkstationTitleStyle(
  screen: ScreenType
): CSSProperties {
  return {
    marginTop: 4,

    color:
      "rgba(255,255,255,0.86)",

    fontSize:
      screen === "mobile"
        ? 14
        : 16,

    fontWeight: 800,

    fontFamily:
      "var(--font-almarai), sans-serif",
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
        ? 19
        : screen === "tablet"
          ? 22
          : 24,

    lineHeight: 1.5,
    fontWeight: 900,
    textAlign: "center",

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

function getMenuButtonStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "absolute",

    top:
      isMobile
        ? 14
        : 20,

    right:
      isMobile
        ? 14
        : 22,

    zIndex: 8,

    minWidth:
      isMobile
        ? 44
        : 94,

    height: 42,

    border:
      "1px solid rgba(255,255,255,0.30)",

    borderRadius: 13,

    background:
      "rgba(7,28,72,0.24)",

    backdropFilter:
      "blur(8px)",

    color: "#ffffff",

    padding:
      isMobile
        ? 0
        : "0 13px",

    display: "inline-flex",

    alignItems: "center",
    justifyContent: "center",

    gap: 8,

    fontSize: 13,
    fontWeight: 900,

    cursor: "pointer",

    boxShadow:
      "0 8px 18px rgba(15,23,42,0.12)",

    fontFamily:
      "var(--font-almarai), sans-serif",
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

const loadingContentBox: CSSProperties = {
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
    "financeMainSpin 0.8s linear infinite",
};

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

const supportSessionBadge: CSSProperties = {
  display: "inline-flex",

  alignItems: "center",
  justifyContent: "center",

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
  direction: "rtl",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,

  background:
    "rgba(255,255,255,0.30)",

  flex: "0 0 auto",
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
  color:
    "rgba(255,255,255,0.75)",

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

const statsGrid: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(230px,1fr))",

  gap: 10,

  marginBottom: 14,

  maxWidth: 560,

  marginLeft: "auto",
  marginRight: "auto",
};

const statCard: CSSProperties = {
  width: "100%",

  position: "relative",

  background:
    "rgba(255,255,255,0.96)",

  border:
    "1px solid #e2e8f0",

  borderRadius: 20,

  padding: 14,

  display: "flex",

  alignItems: "center",

  gap: 12,

  textAlign: "right",

  cursor: "pointer",

  boxShadow:
    "0 10px 24px rgba(15,23,42,0.045)",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const statIcon: CSSProperties = {
  width: 46,
  height: 46,

  borderRadius: 15,

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  fontSize: 22,

  flex: "0 0 auto",
};

const statContent: CSSProperties = {
  flex: 1,

  minWidth: 0,
};

const statValue: CSSProperties = {
  color: "#0f172a",

  fontSize: 25,
  fontWeight: 900,

  lineHeight: 1.2,
};

const statTitle: CSSProperties = {
  color: "#64748b",

  fontSize: 14,
  fontWeight: 800,

  marginTop: 3,
};

const statArrow: CSSProperties = {
  fontSize: 25,
  fontWeight: 900,

  flex: "0 0 auto",
};

const searchWrapper: CSSProperties = {
  position: "relative",
  marginBottom: 14,
};

const searchCard: CSSProperties = {
  background:
    "rgba(255,255,255,0.98)",

  border:
    "1px solid #dbeafe",

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

  border:
    "1px solid #e2e8f0",

  background:
    "rgba(255,255,255,0.98)",

  borderRadius: 16,

  padding: 11,

  display: "grid",

  gridTemplateColumns:
    "42px 1fr auto",

  gap: 10,

  alignItems: "center",

  cursor: "pointer",

  textAlign: "right",

  boxShadow:
    "0 8px 18px rgba(15,23,42,0.04)",

  fontFamily:
    "var(--font-almarai), sans-serif",
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
  background:
    "rgba(255,255,255,0.98)",

  border:
    "1px solid #e2e8f0",

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

  minHeight: 86,

  background:
    "linear-gradient(135deg,#ffffff,#f8fafc)",

  border:
    "1px solid #e2e8f0",

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
  background:
    "rgba(255,255,255,0.98)",

  border:
    "1px solid #e2e8f0",

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

  border:
    "1px solid #bfdbfe",

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

  border:
    "1px solid #bbf7d0",

  color: "#166534",
};

const compactNoticeRed: CSSProperties = {
  ...compactNoticeBlue,

  background: "#fef2f2",

  border:
    "1px solid #fecaca",

  color: "#b91c1c",
};

const compactActivityItem: CSSProperties = {
  background: "#f8fafc",

  border:
    "1px solid #e2e8f0",

  color: "#475569",

  borderRadius: 13,

  padding: 10,

  marginBottom: 7,

  lineHeight: 1.6,

  fontSize: 13,
};

const drawerLayer: CSSProperties = {
  position: "fixed",

  inset: 0,

  zIndex: 1000,

  direction: "rtl",
};

const drawerBackdrop: CSSProperties = {
  position: "absolute",

  inset: 0,

  width: "100%",
  height: "100%",

  border: "none",

  background:
    "rgba(2,6,23,0.50)",

  backdropFilter:
    "blur(3px)",

  cursor: "default",

  transition:
    "opacity 0.24s ease",
};

const drawerPanel: CSSProperties = {
  position: "absolute",

  top: 0,
  right: 0,

  width:
    "min(88vw, 390px)",

  height: "100%",

  background:
    "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)",

  borderLeft:
    "1px solid rgba(148,163,184,0.30)",

  boxShadow:
    "-18px 0 46px rgba(15,23,42,0.22)",

  display: "flex",

  flexDirection: "column",

  transition:
    "transform 0.27s ease",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const drawerHeader: CSSProperties = {
  minHeight: 94,

  padding: "20px 18px",

  display: "flex",

  alignItems: "center",
  justifyContent: "space-between",

  gap: 14,

  background:
    "linear-gradient(115deg,#071c48,#0d65d9 65%,#23a8e4)",

  color: "#ffffff",
};

const drawerOrganizationName: CSSProperties = {
  fontSize: 20,

  fontWeight: 900,

  lineHeight: 1.45,
};

const drawerSubtitle: CSSProperties = {
  marginTop: 3,

  color:
    "rgba(255,255,255,0.78)",

  fontSize: 12,
  fontWeight: 800,
};

const drawerCloseButton: CSSProperties = {
  width: 40,
  height: 40,

  borderRadius: 12,

  border:
    "1px solid rgba(255,255,255,0.26)",

  background:
    "rgba(255,255,255,0.10)",

  color: "#ffffff",

  fontSize: 27,

  lineHeight: 1,

  cursor: "pointer",

  flex: "0 0 auto",
};

const drawerEmployeeBox: CSSProperties = {
  margin: "14px 14px 10px",

  padding: 12,

  border:
    "1px solid #dbeafe",

  borderRadius: 16,

  background: "#eff6ff",

  display: "flex",

  alignItems: "center",

  gap: 11,
};

const drawerEmployeeIcon: CSSProperties = {
  width: 42,
  height: 42,

  borderRadius: 14,

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  background: "#dbeafe",

  color: "#1d4ed8",

  flex: "0 0 auto",
};

const drawerEmployeeDetails: CSSProperties = {
  minWidth: 0,

  display: "flex",

  flexDirection: "column",

  gap: 3,

  color: "#0f172a",

  fontSize: 14,
};

const drawerHomeButton: CSSProperties = {
  margin: "0 14px 10px",

  minHeight: 46,

  border: "none",

  borderRadius: 14,

  background:
    "linear-gradient(135deg,#22c55e,#15803d)",

  color: "#ffffff",

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  gap: 9,

  fontSize: 14,
  fontWeight: 900,

  cursor: "pointer",

  boxShadow:
    "0 8px 18px rgba(22,163,74,0.18)",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const drawerScrollArea: CSSProperties = {
  flex: 1,

  minHeight: 0,

  overflowY: "auto",

  padding: "0 14px 16px",
};

const drawerGroup: CSSProperties = {
  marginTop: 14,
};

const drawerGroupTitle: CSSProperties = {
  marginBottom: 7,

  padding: "0 4px",

  color: "#64748b",

  fontSize: 12,
  fontWeight: 900,
};

const drawerLinksList: CSSProperties = {
  display: "grid",

  gap: 6,
};

const drawerLinkButton: CSSProperties = {
  width: "100%",

  minHeight: 46,

  border:
    "1px solid #e2e8f0",

  borderRadius: 13,

  background: "#ffffff",

  padding: "8px 10px",

  display: "grid",

  gridTemplateColumns:
    "34px 1fr auto",

  alignItems: "center",

  gap: 9,

  textAlign: "right",

  color: "#0f172a",

  fontSize: 13,
  fontWeight: 900,

  cursor: "pointer",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const drawerLinkIcon: CSSProperties = {
  width: 34,
  height: 34,

  borderRadius: 10,

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  background: "#eff6ff",

  fontSize: 17,
};

const drawerLinkArrow: CSSProperties = {
  color: "#2563eb",

  fontSize: 22,

  fontWeight: 900,
};

const drawerFooter: CSSProperties = {
  padding: 14,

  borderTop:
    "1px solid #e2e8f0",

  background:
    "rgba(255,255,255,0.96)",
};

const drawerLogoutButton: CSSProperties = {
  width: "100%",

  minHeight: 46,

  border:
    "1px solid #fecaca",

  borderRadius: 14,

  background: "#fef2f2",

  color: "#b91c1c",

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  gap: 9,

  fontSize: 14,
  fontWeight: 900,

  cursor: "pointer",

  fontFamily:
    "var(--font-almarai), sans-serif",
};
