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

const ITEMS_PER_PAGE = 25;
const SUPPORT_SESSION_TIMEOUT_MS = 1200;

const NAJIZ_URL = "https://najiz.sa/";
const MOLIM_URL = "https://eservices.molim.sa/";

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
  permissions?: string[];
  is_active?: boolean;
};

type SupportSessionResponse = {
  ok: boolean;
  message?: string;
  session_type?: "admin_support";
  user?: FinanceUser;
};

type CustomerGroup = {
  id: string;
  branch_id: string;
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type VerificationResult = {
  result_status?: string | null;
  result_title?: string | null;
  result_description?: string | null;
  has_activity?: boolean | null;
  contracts_count?: number | null;
  overdue_contracts_count?: number | null;
};

type ActionCardProps = {
  title: string;
  icon: string;
  tone: "blue" | "green" | "teal" | "red" | "slate";
  onClick: () => void;
};

const MANAGER_ROLES = [
  "main_admin",
  "branch_manager",
  "admin",
  "manager",
  "مدير فرع",
  "مدير رئيسي",
  "مدير",
];

export default function FinanceCustomersPage() {
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

  const [organizationName, setOrganizationName] =
    useState("احتساب");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [role, setRole] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);

  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState("");

  const [showVerificationModal, setShowVerificationModal] =
    useState(false);

  const [verificationNationalId, setVerificationNationalId] =
    useState("");

  const [verificationLoading, setVerificationLoading] =
    useState(false);

  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);

  const [verificationError, setVerificationError] =
    useState("");

  const [groupActionLoading, setGroupActionLoading] =
    useState<string | null>(null);

  const [logoutLoading, setLogoutLoading] = useState(false);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;
  const isSupportSession = sessionType === "admin_support";

  const isManager = useMemo(() => {
    return (
      role === "support_impersonation" ||
      MANAGER_ROLES.includes(role)
    );
  }, [role]);

  const hasAnyPermission = useCallback(
    (...keys: string[]) => {
      if (isManager) {
        return true;
      }

      return keys.some((key) => permissions.includes(key));
    },
    [isManager, permissions]
  );

  const canViewCustomers = hasAnyPermission(
    "customers",
    "customers_view"
  );

  const canCreateCustomer = hasAnyPermission(
    "customers_create",
    "customer_create"
  );

  const canSearchCustomers = hasAnyPermission(
    "customers",
    "customers_view",
    "customers_search"
  );

  const canViewCustomerList = hasAnyPermission(
    "customers",
    "customers_view",
    "customers_list"
  );

  const canViewGroups = hasAnyPermission(
    "customers",
    "customer_groups_view",
    "customer_groups_manage"
  );

  const canManageGroups = hasAnyPermission(
    "customer_groups_manage",
    "customers_groups_manage",
    "customers_manage"
  );

  const canVerifyCustomers = hasAnyPermission(
    "customers_verify",
    "customer_verify",
    "customers"
  );

  const canViewBlocklist = hasAnyPermission(
    "customer_blocklist_view"
  );

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) =>
      String(a.name || "").localeCompare(
        String(b.name || ""),
        "ar"
      )
    );
  }, [groups]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedGroups.length / ITEMS_PER_PAGE)
  );

  const paginatedGroups = useMemo(() => {
    const startIndex =
      (currentPage - 1) * ITEMS_PER_PAGE;

    return sortedGroups.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [sortedGroups, currentPage]);

  const applyAuthorizedUser = useCallback(
    (
      user: FinanceUser,
      type: Exclude<SessionType, null>
    ) => {
      const nextPermissions = Array.isArray(user.permissions)
        ? user.permissions.filter(
            (item): item is string =>
              typeof item === "string" &&
              item.trim().length > 0
          )
        : [];

      setEmployeeName(
        user.full_name ||
          user.username ||
          "الموظف"
      );

      setOrganizationName(
        user.organization_name ||
          localStorage.getItem(
            "finance_organization_name"
          ) ||
          "احتساب"
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
          const refreshedOrganizationName =
            branchResult.data.organization_name ||
            user.organization_name ||
            "احتساب";

          setOrganizationName(
            refreshedOrganizationName
          );

          localStorage.setItem(
            "finance_organization_name",
            refreshedOrganizationName
          );

          localStorage.setItem(
            "finance_branch_name",
            branchResult.data.branch_name || ""
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
          `/finance/${validation.user.branch_slug}/customers`
        );

        return;
      }

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
            session.organization_name ||
            localStorage.getItem(
              "finance_organization_name"
            ) ||
            "احتساب",

          full_name:
            getFinanceEmployeeName(session),

          username:
            session.username || "",

          role:
            session.role || "",

          permissions:
            Array.isArray(
              session.permissions
            )
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
          supportBranchSlug !== branch
        ) {
          router.replace(
            `/finance/${encodeURIComponent(
              supportBranchSlug
            )}/customers`
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

    if (!canViewCustomers) {
      setAccessDenied(true);
      return;
    }

    setAccessDenied(false);
  }, [authorized, canViewCustomers]);

  useEffect(() => {
    if (
      !authorized ||
      !branchId ||
      !canViewGroups
    ) {
      setGroupsLoading(false);
      return;
    }

    let cancelled = false;

    void loadGroups(
      branchId,
      () => cancelled
    );

    return () => {
      cancelled = true;
    };
  }, [
    authorized,
    branchId,
    canViewGroups,
  ]);

  useEffect(() => {
    if (!showVerificationModal) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleEscape(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        closeVerificationModal();
      }
    }

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [showVerificationModal]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  async function loadGroups(
    currentBranchId: string,
    isCancelled: () => boolean = () => false
  ) {
    setGroupsLoading(true);
    setGroupsError("");

    try {
      const { data, error } =
        await supabase
          .from(
            "finance_customer_groups"
          )
          .select(
            "id, branch_id, name, created_at, updated_at"
          )
          .eq(
            "branch_id",
            currentBranchId
          )
          .order("name", {
            ascending: true,
          });

      if (isCancelled()) {
        return;
      }

      if (error) {
        console.error(
          "Customer groups loading error:",
          error
        );

        setGroups([]);
        setGroupsError(
          "تعذر تحميل مجموعات العملاء. يمكنك إعادة المحاولة."
        );

        return;
      }

      setGroups(
        (data || []) as CustomerGroup[]
      );

      setCurrentPage(1);
    } catch (error) {
      console.error(
        "Customer groups loading failed:",
        error
      );

      if (!isCancelled()) {
        setGroups([]);
        setGroupsError(
          "تعذر تحميل المجموعات بسبب مشكلة في الاتصال."
        );
      }
    } finally {
      if (!isCancelled()) {
        setGroupsLoading(false);
      }
    }
  }

  async function verifyCustomerByNationalId() {
    if (
      verificationLoading ||
      !canVerifyCustomers
    ) {
      return;
    }

    const cleanNationalId =
      normalizeDigits(
        verificationNationalId
      ).replace(/\D/g, "");

    setVerificationError("");
    setVerificationResult(null);

    if (cleanNationalId.length !== 10) {
      setVerificationError(
        "يرجى إدخال رقم هوية صحيح من 10 أرقام."
      );

      return;
    }

    try {
      setVerificationLoading(true);

      const { data, error } =
        await supabase.rpc(
          "verify_customer_activity_by_national_id",
          {
            search_national_id:
              cleanNationalId,
          }
        );

      if (error) {
        console.error(
          "Customer verification error:",
          error
        );

        setVerificationError(
          "حدث خطأ أثناء التحقق من العميل."
        );

        return;
      }

      const result = Array.isArray(data)
        ? data[0]
        : data;

      setVerificationResult(
        (result || null) as VerificationResult | null
      );
    } catch (error) {
      console.error(
        "Customer verification failed:",
        error
      );

      setVerificationError(
        "تعذر التحقق بسبب مشكلة في الاتصال."
      );
    } finally {
      setVerificationLoading(false);
    }
  }

  async function editGroup(
    group: CustomerGroup
  ) {
    if (
      groupActionLoading ||
      !canManageGroups ||
      !branchId
    ) {
      return;
    }

    const newName = window.prompt(
      "اكتب اسم المجموعة الجديد",
      group.name || ""
    );

    if (newName === null) {
      return;
    }

    const cleanName = newName
      .trim()
      .replace(/\s+/g, " ");

    if (!cleanName) {
      window.alert(
        "اسم المجموعة لا يمكن أن يكون فارغًا."
      );

      return;
    }

    const duplicatedGroup =
      groups.find(
        (item) =>
          item.id !== group.id &&
          normalizeGroupName(
            item.name || ""
          ) ===
            normalizeGroupName(
              cleanName
            )
      );

    if (duplicatedGroup) {
      window.alert(
        "توجد مجموعة أخرى بنفس الاسم داخل هذا الفرع."
      );

      return;
    }

    try {
      setGroupActionLoading(
        `edit-${group.id}`
      );

      const { error } =
        await supabase
          .from(
            "finance_customer_groups"
          )
          .update({
            name: cleanName,
          })
          .eq("id", group.id)
          .eq(
            "branch_id",
            branchId
          );

      if (error) {
        console.error(
          "Edit group error:",
          error
        );

        window.alert(
          "حدث خطأ أثناء تعديل المجموعة."
        );

        return;
      }

      await loadGroups(branchId);
    } catch (error) {
      console.error(
        "Edit group failed:",
        error
      );

      window.alert(
        "تعذر تعديل المجموعة بسبب مشكلة في الاتصال."
      );
    } finally {
      setGroupActionLoading(null);
    }
  }

  async function deleteGroup(
    group: CustomerGroup
  ) {
    if (
      groupActionLoading ||
      !canManageGroups ||
      !branchId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `هل أنت متأكد من حذف مجموعة "${group.name}"؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      setGroupActionLoading(
        `delete-${group.id}`
      );

      const {
        data: linkedCustomers,
        error: linkedCustomersError,
      } = await supabase
        .from("finance_customers")
        .select("id")
        .eq("branch_id", branchId)
        .eq("group_id", group.id)
        .limit(1);

      if (linkedCustomersError) {
        console.error(
          "Linked customers check error:",
          linkedCustomersError
        );

        window.alert(
          "تعذر التحقق من ارتباط المجموعة بالعملاء."
        );

        return;
      }

      if (
        (linkedCustomers || []).length > 0
      ) {
        window.alert(
          "لا يمكن حذف المجموعة لأنها مرتبطة بعملاء. انقل العملاء أولًا ثم احذف المجموعة."
        );

        return;
      }

      const { error } =
        await supabase
          .from(
            "finance_customer_groups"
          )
          .delete()
          .eq("id", group.id)
          .eq(
            "branch_id",
            branchId
          );

      if (error) {
        console.error(
          "Delete group error:",
          error
        );

        window.alert(
          "تعذر حذف المجموعة. قد تكون مرتبطة ببيانات أخرى داخل النظام."
        );

        return;
      }

      await loadGroups(branchId);
    } catch (error) {
      console.error(
        "Delete group failed:",
        error
      );

      window.alert(
        "تعذر حذف المجموعة بسبب مشكلة في الاتصال."
      );
    } finally {
      setGroupActionLoading(null);
    }
  }

  function normalizeGroupName(
    value: string
  ) {
    return value
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function go(path: string) {
    router.push(
      `/finance/${branch}/${path}`
    );
  }

  function openExternalVerification(
    url: string
  ) {
    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function openVerificationModal() {
    if (!canVerifyCustomers) {
      return;
    }

    setShowVerificationModal(true);
    setVerificationNationalId("");
    setVerificationResult(null);
    setVerificationError("");
  }

  function closeVerificationModal() {
    if (verificationLoading) {
      return;
    }

    setShowVerificationModal(false);
    setVerificationNationalId("");
    setVerificationResult(null);
    setVerificationError("");
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

  if (!authChecked || !authorized) {
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
                جاري فتح صفحة العملاء...
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
            organizationName={
              organizationName
            }
            isSupportSession={
              isSupportSession
            }
            logoutLoading={
              logoutLoading
            }
            onHome={() =>
              router.push(
                `/finance/${branch}`
              )
            }
            onLogout={() =>
              void logout()
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
              ليس لديك صلاحية الدخول إلى قسم العملاء
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
          organizationName={
            organizationName
          }
          isSupportSession={
            isSupportSession
          }
          logoutLoading={
            logoutLoading
          }
          onHome={() =>
            router.push(
              `/finance/${branch}`
            )
          }
          onLogout={() =>
            void logout()
          }
        />

        <section style={managementPanel}>
          <SectionTitle
            icon="👥"
            title="إدارة العملاء"
          />

          <div style={managementGrid}>
            {canCreateCustomer && (
              <ActionCard
                title="إنشاء عميل جديد"
                icon="➕"
                tone="green"
                onClick={() =>
                  go("customers/new")
                }
              />
            )}

            {canSearchCustomers && (
              <ActionCard
                title="البحث عن عميل"
                icon="🔍"
                tone="blue"
                onClick={() =>
                  go("customers/search")
                }
              />
            )}

            {canViewCustomerList && (
              <ActionCard
                title="قائمة العملاء"
                icon="📋"
                tone="teal"
                onClick={() =>
                  go("customers/list")
                }
              />
            )}

            {canViewBlocklist && (
              <ActionCard
                title="قائمة الحظر"
                icon="⛔"
                tone="red"
                onClick={() =>
                  go(
                    "customers/blocklist"
                  )
                }
              />
            )}
          </div>
        </section>

        {canVerifyCustomers && (
          <section
            style={verificationHighlight}
          >
            <div
              style={
                verificationHighlightContent
              }
            >
              <span
                style={
                  verificationHighlightIcon
                }
              >
                🛡️
              </span>

              <h2
                style={
                  verificationHighlightTitle
                }
              >
                التحقق من العميل
              </h2>
            </div>

            <button
              type="button"
              style={
                verificationMainButton
              }
              onClick={
                openVerificationModal
              }
            >
              فتح شاشة التحقق
            </button>
          </section>
        )}

        {canViewGroups && (
          <section style={groupsPanel}>
            <div style={groupsPanelHeader}>
              <SectionTitle
                icon="🗂️"
                title="مجموعات العملاء"
              />

              <div
                style={
                  groupsHeaderActions
                }
              >
                {groupsError && branchId && (
                  <button
                    type="button"
                    style={retryButton}
                    onClick={() =>
                      void loadGroups(
                        branchId
                      )
                    }
                    disabled={
                      groupsLoading
                    }
                  >
                    إعادة المحاولة
                  </button>
                )}

                {canManageGroups && (
                  <button
                    type="button"
                    style={
                      smallAddButton
                    }
                    onClick={() =>
                      go(
                        "customers/groups"
                      )
                    }
                  >
                    إدارة المجموعات
                  </button>
                )}
              </div>
            </div>

            {groupsError && (
              <div
                style={
                  groupsErrorBox
                }
              >
                {groupsError}
              </div>
            )}

            <div style={groupsSection}>
              {groupsLoading ? (
                <div
                  style={emptyGroupCard}
                >
                  جاري تحميل مجموعات العملاء...
                </div>
              ) : groups.length === 0 ? (
                <div
                  style={emptyGroupCard}
                >
                  لا توجد مجموعات عملاء حتى الآن
                </div>
              ) : (
                paginatedGroups.map(
                  (group, index) => {
                    const groupNumberValue =
                      (currentPage - 1) *
                        ITEMS_PER_PAGE +
                      index +
                      1;

                    const editing =
                      groupActionLoading ===
                      `edit-${group.id}`;

                    const deleting =
                      groupActionLoading ===
                      `delete-${group.id}`;

                    return (
                      <article
                        key={group.id}
                        style={groupCard}
                      >
                        <button
                          type="button"
                          style={
                            groupOpenArea
                          }
                          onClick={() =>
                            go(
                              `customers/groups/${group.id}`
                            )
                          }
                        >
                          <div
                            style={
                              groupCardTop
                            }
                          >
                            <span
                              style={
                                groupNumber
                              }
                            >
                              {String(
                                groupNumberValue
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <span
                              style={
                                groupArrow
                              }
                            >
                              ‹
                            </span>
                          </div>

                          <span
                            style={groupName}
                          >
                            {group.name}
                          </span>

                          <span
                            style={groupHint}
                          >
                            فتح عملاء المجموعة
                          </span>
                        </button>

                        {canManageGroups && (
                          <div
                            style={
                              groupActions
                            }
                          >
                            <button
                              type="button"
                              style={
                                editGroupButton
                              }
                              onClick={() =>
                                void editGroup(
                                  group
                                )
                              }
                              disabled={
                                Boolean(
                                  groupActionLoading
                                )
                              }
                            >
                              {editing
                                ? "جاري التعديل..."
                                : "تعديل"}
                            </button>

                            <button
                              type="button"
                              style={
                                deleteGroupButton
                              }
                              onClick={() =>
                                void deleteGroup(
                                  group
                                )
                              }
                              disabled={
                                Boolean(
                                  groupActionLoading
                                )
                              }
                            >
                              {deleting
                                ? "جاري الحذف..."
                                : "حذف"}
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  }
                )
              )}
            </div>

            {totalPages > 1 && (
              <div
                style={paginationBox}
              >
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

                <span
                  style={paginationText}
                >
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
        )}

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

      {showVerificationModal && (
        <div
          style={modalOverlay}
          onMouseDown={
            closeVerificationModal
          }
        >
          <section
            style={verificationModal}
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div style={modalHeader}>
              <h2 style={modalTitle}>
                التحقق من العميل
              </h2>

              <button
                type="button"
                style={closeButton}
                onClick={
                  closeVerificationModal
                }
                disabled={
                  verificationLoading
                }
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            <div
              style={
                verificationActions
              }
            >
              <button
                type="button"
                style={
                  verificationExternalButton
                }
                onClick={() =>
                  openExternalVerification(
                    NAJIZ_URL
                  )
                }
              >
                <span>⚖️</span>
                التحقق من ناجز
              </button>

              <button
                type="button"
                style={
                  verificationExternalButton
                }
                onClick={() =>
                  openExternalVerification(
                    MOLIM_URL
                  )
                }
              >
                <span>📊</span>
                التحقق من سمة / ملم
              </button>
            </div>

            <div
              style={
                internalVerificationBox
              }
            >
              <h3 style={internalTitle}>
                أنشطة العميل السابقة
              </h3>

              <label style={label}>
                رقم الهوية
              </label>

              <input
                value={
                  verificationNationalId
                }
                onChange={(event) =>
                  setVerificationNationalId(
                    normalizeDigits(
                      event.target.value
                    )
                      .replace(/\D/g, "")
                      .slice(0, 10)
                  )
                }
                placeholder="أدخل رقم الهوية"
                style={input}
                inputMode="numeric"
                autoComplete="off"
              />

              {verificationError && (
                <div style={errorBox}>
                  {verificationError}
                </div>
              )}

              <button
                type="button"
                style={{
                  ...primaryButton,

                  opacity:
                    verificationLoading
                      ? 0.7
                      : 1,

                  cursor:
                    verificationLoading
                      ? "not-allowed"
                      : "pointer",
                }}
                onClick={() =>
                  void verifyCustomerByNationalId()
                }
                disabled={
                  verificationLoading
                }
              >
                {verificationLoading
                  ? "جاري التحقق..."
                  : "بحث برقم الهوية"}
              </button>

              {verificationResult && (
                <VerificationResultCard
                  result={
                    verificationResult
                  }
                />
              )}
            </div>
          </section>
        </div>
      )}

      <GlobalStyles />
    </main>
  );
}

function PageHeader({
  screen,
  employeeName,
  organizationName,
  isSupportSession,
  logoutLoading,
  onHome,
  onLogout,
}: {
  screen: ScreenType;
  employeeName: string;
  organizationName: string;
  isSupportSession: boolean;
  logoutLoading: boolean;
  onHome: () => void;
  onLogout: () => void;
}) {
  const isMobile = screen === "mobile";

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
          <h1
            style={getTitleStyle(screen)}
          >
            العملاء
          </h1>

          <span style={organizationLabel}>
            {organizationName}
          </span>
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

function SectionTitle({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <div style={sectionTitleRow}>
      <span style={sectionTitleIcon}>
        {icon}
      </span>

      <h2 style={sectionHeading}>
        {title}
      </h2>
    </div>
  );
}

function ActionCard({
  title,
  icon,
  tone,
  onClick,
}: ActionCardProps) {
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

    teal: {
      background:
        "linear-gradient(135deg,#f0fdfa,#ffffff)",
      border: "#99f6e4",
      iconBackground: "#ccfbf1",
      color: "#0f766e",
    },

    red: {
      background:
        "linear-gradient(135deg,#fef2f2,#ffffff)",
      border: "#fecaca",
      iconBackground: "#fee2e2",
      color: "#b91c1c",
    },

    slate: {
      background:
        "linear-gradient(135deg,#f8fafc,#ffffff)",
      border: "#cbd5e1",
      iconBackground: "#e2e8f0",
      color: "#334155",
    },
  };

  const selectedTone = tones[tone];

  return (
    <button
      type="button"
      style={{
        ...actionCard,

        background:
          selectedTone.background,

        borderColor:
          selectedTone.border,
      }}
      onClick={onClick}
      className="customer-action-card"
    >
      <span
        style={{
          ...actionCardIcon,

          background:
            selectedTone.iconBackground,

          color:
            selectedTone.color,
        }}
      >
        {icon}
      </span>

      <strong style={actionCardTitle}>
        {title}
      </strong>

      <span
        style={{
          ...actionCardArrow,

          color:
            selectedTone.color,
        }}
      >
        ‹
      </span>
    </button>
  );
}

function VerificationResultCard({
  result,
}: {
  result: VerificationResult;
}) {
  const status =
    result.result_status || "";

  const colors =
    status === "regular"
      ? {
          border: "#bbf7d0",
          background: "#f0fdf4",
          icon: "✅",
          title: "✅ العميل منتظم",
        }
      : status === "overdue"
        ? {
            border: "#fde68a",
            background: "#fffbeb",
            icon: "⚠️",
            title:
              result.result_title ||
              "يوجد تأخر سابق",
          }
        : status === "no_activity"
          ? {
              border: "#bfdbfe",
              background: "#eff6ff",
              icon: "ℹ️",
              title:
                result.result_title ||
                "لا توجد أنشطة سابقة",
            }
          : {
              border: "#fecaca",
              background: "#fef2f2",
              icon: "❌",
              title:
                result.result_title ||
                "نتيجة التحقق",
            };

  return (
    <div
      style={{
        ...resultCard,

        borderColor: colors.border,
        background: colors.background,
      }}
    >
      <div style={resultIcon}>
        {colors.icon}
      </div>

      <div style={resultContent}>
        <h3 style={resultTitle}>
          {colors.title}
        </h3>

        <p style={resultDescription}>
          {result.result_description ||
            "لا توجد تفاصيل إضافية."}
        </p>

        {result.has_activity && (
          <div style={resultMeta}>
            <span style={resultMetaItem}>
              عدد الأنشطة:{" "}
              {result.contracts_count || 0}
            </span>

            <span style={resultMetaItem}>
              المتأخرات:{" "}
              {result.overdue_contracts_count ||
                0}
            </span>
          </div>
        )}
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
      input {
        font-family: var(--font-almarai), sans-serif;
      }

      button {
        -webkit-tap-highlight-color: transparent;
      }

      button:disabled {
        cursor: not-allowed !important;
        opacity: 0.65;
      }

      .customer-action-card {
        transition:
          transform 0.18s ease,
          box-shadow 0.18s ease,
          border-color 0.18s ease;
      }

      .customer-action-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08) !important;
      }

      .customer-action-card:active {
        transform: scale(0.985);
      }

      @keyframes customersPageSpin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 639px) {
        .customer-action-card {
          min-height: 72px !important;
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

    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",

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
        ? 26
        : screen === "tablet"
          ? 28
          : 30,

    lineHeight: 1.35,
    fontWeight: 900,

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
  return {
    display:
      screen === "desktop"
        ? "flex"
        : "none",

    flexDirection: "column",

    justifyContent: "center",
    alignItems: "flex-end",
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

  color: "#ffffff",

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

const organizationLabel: CSSProperties = {
  marginTop: 5,

  color:
    "rgba(255,255,255,0.80)",

  fontSize: 13,
  fontWeight: 800,
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
    "customersPageSpin 0.8s linear infinite",
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

const managementPanel: CSSProperties = {
  ...commonPanel,

  marginBottom: 14,
};

const sectionTitleRow: CSSProperties = {
  display: "flex",

  alignItems: "center",

  gap: 10,

  marginBottom: 14,
};

const sectionTitleIcon: CSSProperties = {
  width: 38,
  height: 38,

  borderRadius: 12,

  background: "#eff6ff",

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  fontSize: 19,
};

const sectionHeading: CSSProperties = {
  margin: 0,

  color: "#0f172a",

  fontSize: 20,
  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const managementGrid: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(210px,1fr))",

  gap: 11,
};

const actionCard: CSSProperties = {
  width: "100%",

  minHeight: 82,

  border: "1px solid",

  borderRadius: 19,

  padding: 13,

  display: "grid",

  gridTemplateColumns:
    "46px 1fr auto",

  alignItems: "center",

  gap: 11,

  textAlign: "right",

  cursor: "pointer",

  boxShadow:
    "0 8px 18px rgba(15,23,42,0.035)",
};

const actionCardIcon: CSSProperties = {
  width: 46,
  height: 46,

  borderRadius: 14,

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  fontSize: 21,
};

const actionCardTitle: CSSProperties = {
  color: "#0f172a",

  fontSize: 15,
  fontWeight: 900,
};

const actionCardArrow: CSSProperties = {
  fontSize: 25,
  fontWeight: 900,
};

const verificationHighlight: CSSProperties = {
  background:
    "linear-gradient(135deg,#eff6ff,#ffffff)",

  border:
    "1px solid #bfdbfe",

  borderRadius: 22,

  padding: 16,

  marginBottom: 14,

  display: "flex",

  alignItems: "center",
  justifyContent: "space-between",

  flexWrap: "wrap",

  gap: 14,

  boxShadow:
    "0 10px 26px rgba(30,64,175,0.07)",
};

const verificationHighlightContent: CSSProperties = {
  display: "flex",

  alignItems: "center",

  gap: 11,
};

const verificationHighlightIcon: CSSProperties = {
  width: 46,
  height: 46,

  borderRadius: 15,

  background: "#dbeafe",

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  fontSize: 22,
};

const verificationHighlightTitle: CSSProperties = {
  margin: 0,

  color: "#0f172a",

  fontSize: 19,
  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const verificationMainButton: CSSProperties = {
  border: "none",

  background:
    "linear-gradient(135deg,#1d4ed8,#1e3a8a)",

  color: "#ffffff",

  borderRadius: 15,

  padding: "13px 18px",

  fontWeight: 900,
  fontSize: 14,

  cursor: "pointer",

  boxShadow:
    "0 10px 22px rgba(29,78,216,0.22)",
};

const groupsPanel: CSSProperties = {
  ...commonPanel,

  marginBottom: 14,
};

const groupsPanelHeader: CSSProperties = {
  display: "flex",

  alignItems: "center",
  justifyContent: "space-between",

  flexWrap: "wrap",

  gap: 12,

  marginBottom: 14,
};

const groupsHeaderActions: CSSProperties = {
  display: "flex",

  alignItems: "center",

  flexWrap: "wrap",

  gap: 8,
};

const smallAddButton: CSSProperties = {
  border: "none",

  background:
    "linear-gradient(135deg,#2563eb,#1d4ed8)",

  color: "#ffffff",

  borderRadius: 13,

  padding: "11px 15px",

  fontSize: 13,
  fontWeight: 900,

  cursor: "pointer",

  whiteSpace: "nowrap",
};

const retryButton: CSSProperties = {
  border:
    "1px solid #bfdbfe",

  background: "#eff6ff",

  color: "#1d4ed8",

  borderRadius: 13,

  padding: "10px 14px",

  fontSize: 13,
  fontWeight: 900,

  cursor: "pointer",
};

const groupsErrorBox: CSSProperties = {
  marginBottom: 13,

  padding: 12,

  border:
    "1px solid #fecaca",

  borderRadius: 14,

  background: "#fef2f2",

  color: "#991b1b",

  fontSize: 13,
  fontWeight: 800,
};

const groupsSection: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(230px,1fr))",

  gap: 11,
};

const groupCard: CSSProperties = {
  minWidth: 0,

  background: "#ffffff",

  border:
    "1px solid #d9e3f5",

  borderRadius: 18,

  overflow: "hidden",

  boxShadow:
    "0 8px 18px rgba(15,23,42,0.04)",
};

const groupOpenArea: CSSProperties = {
  width: "100%",

  minHeight: 132,

  border: "none",

  background:
    "linear-gradient(145deg,#ffffff,#f8fbff)",

  padding: 15,

  cursor: "pointer",

  textAlign: "right",

  display: "flex",
  flexDirection: "column",

  gap: 8,
};

const groupCardTop: CSSProperties = {
  display: "flex",

  alignItems: "center",
  justifyContent: "space-between",

  gap: 10,
};

const groupNumber: CSSProperties = {
  minWidth: 40,
  height: 28,

  padding: "0 9px",

  borderRadius: 999,

  background: "#eff6ff",

  color: "#1d4ed8",

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  fontSize: 12,
  fontWeight: 900,
};

const groupArrow: CSSProperties = {
  color: "#2563eb",

  fontSize: 24,
  fontWeight: 900,
};

const groupName: CSSProperties = {
  color: "#0f172a",

  fontSize: 17,
  fontWeight: 900,

  overflowWrap: "anywhere",
};

const groupHint: CSSProperties = {
  color: "#64748b",

  fontSize: 12,
  fontWeight: 700,
};

const groupActions: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "1fr 1fr",

  gap: 7,

  borderTop:
    "1px solid #e2e8f0",

  padding: 9,

  background: "#f8fafc",
};

const editGroupButton: CSSProperties = {
  border:
    "1px solid #bfdbfe",

  background: "#eff6ff",

  color: "#1e40af",

  borderRadius: 11,

  padding: "9px 10px",

  fontSize: 13,
  fontWeight: 900,

  cursor: "pointer",
};

const deleteGroupButton: CSSProperties = {
  border:
    "1px solid #fecaca",

  background: "#fef2f2",

  color: "#991b1b",

  borderRadius: 11,

  padding: "9px 10px",

  fontSize: 13,
  fontWeight: 900,

  cursor: "pointer",
};

const emptyGroupCard: CSSProperties = {
  gridColumn: "1 / -1",

  background: "#ffffff",

  border:
    "1px dashed #cbd5e1",

  borderRadius: 17,

  padding: 24,

  fontSize: 14,

  textAlign: "center",

  color: "#64748b",
};

const paginationBox: CSSProperties = {
  marginTop: 14,

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

const modalOverlay: CSSProperties = {
  position: "fixed",

  inset: 0,

  background:
    "rgba(15,23,42,0.58)",

  backdropFilter:
    "blur(4px)",

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  zIndex: 9999,

  padding: 14,
};

const verificationModal: CSSProperties = {
  width: "100%",
  maxWidth: 620,

  maxHeight: "92vh",
  overflowY: "auto",

  background: "#ffffff",

  borderRadius: 24,

  padding: 21,

  boxShadow:
    "0 24px 80px rgba(15,23,42,0.28)",

  border:
    "1px solid #e2e8f0",
};

const modalHeader: CSSProperties = {
  display: "flex",

  alignItems: "center",
  justifyContent: "space-between",

  gap: 14,

  marginBottom: 16,
};

const modalTitle: CSSProperties = {
  margin: 0,

  fontSize: 22,

  color: "#0f172a",

  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const closeButton: CSSProperties = {
  width: 38,
  height: 38,

  borderRadius: 12,

  border:
    "1px solid #e2e8f0",

  background: "#f8fafc",

  color: "#0f172a",

  fontSize: 24,

  cursor: "pointer",
};

const verificationActions: CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",

  gap: 10,

  marginBottom: 14,
};

const verificationExternalButton: CSSProperties = {
  border:
    "1px solid #bfdbfe",

  background: "#eff6ff",

  color: "#1e40af",

  borderRadius: 15,

  padding: "13px 14px",

  fontWeight: 900,
  fontSize: 14,

  cursor: "pointer",

  display: "flex",

  alignItems: "center",
  justifyContent: "center",

  gap: 8,
};

const internalVerificationBox: CSSProperties = {
  border:
    "1px solid #e2e8f0",

  borderRadius: 18,

  padding: 15,

  background: "#f8fafc",
};

const internalTitle: CSSProperties = {
  margin: "0 0 13px",

  fontSize: 17,

  color: "#0f172a",

  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const label: CSSProperties = {
  display: "block",

  marginBottom: 7,

  color: "#334155",

  fontSize: 13,
  fontWeight: 900,
};

const input: CSSProperties = {
  width: "100%",

  border:
    "1px solid #cbd5e1",

  borderRadius: 13,

  padding: "12px 13px",

  fontSize: 14,

  outline: "none",

  background: "#ffffff",

  marginBottom: 11,
};

const primaryButton: CSSProperties = {
  width: "100%",

  border: "none",

  background:
    "linear-gradient(135deg,#1d4ed8,#1e3a8a)",

  color: "#ffffff",

  borderRadius: 13,

  padding: "12px 15px",

  fontWeight: 900,
  fontSize: 14,

  cursor: "pointer",
};

const errorBox: CSSProperties = {
  background: "#fef2f2",

  color: "#991b1b",

  border:
    "1px solid #fecaca",

  borderRadius: 13,

  padding: "10px 11px",

  marginBottom: 11,

  fontSize: 13,
  fontWeight: 800,
};

const resultCard: CSSProperties = {
  display: "flex",

  alignItems: "flex-start",

  gap: 13,

  marginTop: 14,

  padding: 14,

  border:
    "1px solid #e2e8f0",

  borderRadius: 17,
};

const resultIcon: CSSProperties = {
  fontSize: 29,
  lineHeight: 1,

  flex: "0 0 auto",
};

const resultContent: CSSProperties = {
  minWidth: 0,
};

const resultTitle: CSSProperties = {
  margin: 0,

  color: "#0f172a",

  fontSize: 18,
  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const resultDescription: CSSProperties = {
  margin: "7px 0 0",

  color: "#475569",

  fontSize: 13,

  lineHeight: 1.8,
};

const resultMeta: CSSProperties = {
  display: "flex",

  flexWrap: "wrap",

  gap: 7,

  marginTop: 10,
};

const resultMetaItem: CSSProperties = {
  padding: "6px 9px",

  borderRadius: 999,

  background:
    "rgba(255,255,255,0.72)",

  border:
    "1px solid rgba(148,163,184,0.30)",

  color: "#334155",

  fontSize: 12,
  fontWeight: 900,
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
