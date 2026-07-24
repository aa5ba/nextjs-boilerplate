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
  renewFinanceSession,
  validateFinanceSession,
} from "@/lib/financeSession";

const ITEMS_PER_PAGE = 25;

const EXPENSE_PERMISSIONS = {
  PAGE_VIEW: "expenses",
  VIEW: "expenses_view",
  CREATE: "expenses_create",
  EDIT_OWN: "expenses_edit_own",
  EDIT_ALL: "expenses_edit_all",
  DELETE_OWN: "expenses_delete_own",
  DELETE_ALL: "expenses_delete_all",
  PROCESS: "expenses_process",
  REPORTS: "expenses_reports",
  PAYMENT_SOURCES_MANAGE: "expenses_payment_sources_manage",
} as const;

const MANAGER_ROLES = [
  "main_admin",
  "branch_manager",
  "admin",
  "manager",
  "مدير فرع",
  "مدير رئيسي",
  "مدير",
  "support_impersonation",
];

type ScreenType = "mobile" | "tablet" | "desktop";
type ProcessingStatus = "pending" | "processed";
type StatusFilter = "all" | ProcessingStatus;

type ExpenseInvoice = {
  id: string;
  branch_id: string;
  invoice_title: string;
  invoice_amount: number | string;
  invoice_details: string | null;
  invoice_date: string;
  payment_method: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  processing_status: ProcessingStatus;
  processed_at: string | null;
  processed_by_user_id: string | null;
  processed_by_name: string | null;
};

type FinanceSessionUser = {
  id?: string | null;
  branch_id?: string | null;
  branch_slug?: string | null;
  full_name?: string | null;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  permissions?: string[] | null;
  is_active?: boolean | null;
};

type SessionValidationResult = {
  valid?: boolean;
  isValid?: boolean;
  success?: boolean;
  reason?: string;
  user?: FinanceSessionUser;
  session?: FinanceSessionUser;
  branch_id?: string;
};

type MonthlyStats = {
  count: number;
  totalAmount: number;
  processedCount: number;
  pendingCount: number;
};

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function formatGregorianMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(
    "ar-SA-u-ca-gregory",
    {
      calendar: "gregory",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function getCurrentMonthValue() {
  const now = new Date();

  return `${now.getFullYear()}-${padNumber(
    now.getMonth() + 1
  )}`;
}

function getMonthRange(monthValue: string) {
  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  const start = `${year}-${padNumber(monthIndex + 1)}-01`;

  const nextMonth = new Date(year, monthIndex + 1, 1);

  const end = `${nextMonth.getFullYear()}-${padNumber(
    nextMonth.getMonth() + 1
  )}-01`;

  return { start, end };
}

function getMonthLabel(monthValue: string) {
  if (monthValue === "all") {
    return "كل الفترات";
  }

  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  const date = new Date(year, month - 1, 1);

  return formatGregorianMonthLabel(date);
}

function getMonthOptions() {
  const options: Array<{
    value: string;
    label: string;
  }> = [];

  const now = new Date();

  for (let index = 0; index < 36; index += 1) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - index,
      1
    );

    const value = `${date.getFullYear()}-${padNumber(
      date.getMonth() + 1
    )}`;

    options.push({
      value,
      label: formatGregorianMonthLabel(date),
    });
  }

  return options;
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export default function ExpensesPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "")
    .trim()
    .toLowerCase();

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [authChecked, setAuthChecked] =
    useState(false);

  const [accessDenied, setAccessDenied] =
    useState(false);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [currentUserId, setCurrentUserId] =
    useState("");

  const [role, setRole] =
    useState("");

  const [permissions, setPermissions] =
    useState<string[]>([]);

  const [invoices, setInvoices] =
    useState<ExpenseInvoice[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [loadError, setLoadError] =
    useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [totalCount, setTotalCount] =
    useState(0);

  const [monthlyStats, setMonthlyStats] =
    useState<MonthlyStats>({
      count: 0,
      totalAmount: 0,
      processedCount: 0,
      pendingCount: 0,
    });

  const [searchTerm, setSearchTerm] =
    useState("");

  const [appliedSearch, setAppliedSearch] =
    useState("");

  const [paymentMethodFilter, setPaymentMethodFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [selectedMonth, setSelectedMonth] =
    useState(getCurrentMonthValue());

  const [deleteLoadingId, setDeleteLoadingId] =
    useState<string | null>(null);

  const [processLoadingId, setProcessLoadingId] =
    useState<string | null>(null);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const isManager = useMemo(() => {
    return MANAGER_ROLES.includes(role);
  }, [role]);

  const hasPermission = useCallback(
    (...keys: string[]) => {
      if (isManager) return true;

      return keys.some((key) =>
        permissions.includes(key)
      );
    },
    [isManager, permissions]
  );

  const canViewExpenses = hasPermission(
    EXPENSE_PERMISSIONS.PAGE_VIEW,
    EXPENSE_PERMISSIONS.VIEW
  );

  const canCreateExpense = hasPermission(
    EXPENSE_PERMISSIONS.CREATE
  );

  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / ITEMS_PER_PAGE)
  );

  const selectedPeriodLabel =
    getMonthLabel(selectedMonth);

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
    let cleanupTracker: undefined | (() => void);

    async function initializePage() {
      setAuthChecked(false);
      setAccessDenied(false);
      setLoadError("");

      try {
        const validate =
          validateFinanceSession as unknown as (
            branchSlug: string
          ) => Promise<SessionValidationResult>;

        const result = await validate(branch);

        if (cancelled) return;

        const sessionUser =
          result?.user ||
          result?.session ||
          null;

        const valid =
          result?.valid ??
          result?.isValid ??
          result?.success ??
          Boolean(sessionUser);

        if (!valid || !sessionUser) {
          router.replace("/login");
          return;
        }

        const sessionBranchId =
          sessionUser.branch_id ||
          result.branch_id ||
          null;

        const sessionBranchSlug = String(
          sessionUser.branch_slug || ""
        )
          .trim()
          .toLowerCase();

        if (!sessionBranchId) {
          router.replace("/login");
          return;
        }

        if (
          sessionBranchSlug &&
          branch &&
          sessionBranchSlug !== branch &&
          sessionUser.role !== "support_impersonation"
        ) {
          router.replace(
            `/finance/${sessionBranchSlug}`
          );
          return;
        }

        const name =
          getFinanceEmployeeName() ||
          sessionUser.full_name ||
          sessionUser.name ||
          sessionUser.username ||
          "الموظف";

        const userRole = String(
          sessionUser.role || ""
        ).trim();

        const userPermissions =
          Array.isArray(sessionUser.permissions)
            ? sessionUser.permissions.filter(
                (item): item is string =>
                  typeof item === "string"
              )
            : [];

        setEmployeeName(name);
        setCurrentUserId(
          String(sessionUser.id || "")
        );
        setBranchId(sessionBranchId);
        setRole(userRole);
        setPermissions(userPermissions);

        const manager =
          MANAGER_ROLES.includes(userRole);

        const allowed =
          manager ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.PAGE_VIEW
          ) ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.VIEW
          ) ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.CREATE
          ) ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.EDIT_OWN
          ) ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.EDIT_ALL
          ) ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.DELETE_OWN
          ) ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.DELETE_ALL
          ) ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.PROCESS
          ) ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.REPORTS
          );

        if (!allowed) {
          setAccessDenied(true);
          setAuthChecked(true);
          return;
        }

        try {
          const renew =
            renewFinanceSession as unknown as () =>
              | void
              | Promise<void>;

          await renew();
        } catch {
          // لا يتم إنهاء الجلسة بسبب خطأ اتصال مؤقت.
        }

        try {
          const installTracker =
            installFinanceActivityTracker as unknown as () =>
              | void
              | (() => void);

          const trackerResult = installTracker();

          if (typeof trackerResult === "function") {
            cleanupTracker = trackerResult;
          }
        } catch {
          // المتتبع لا يمنع فتح الصفحة.
        }

        setAuthChecked(true);
      } catch {
        if (cancelled) return;

        setLoadError(
          "تعذر التحقق من الجلسة مؤقتًا. تحقق من الاتصال ثم أعد المحاولة."
        );
        setAuthChecked(true);
      }
    }

    initializePage();

    return () => {
      cancelled = true;

      if (cleanupTracker) {
        cleanupTracker();
      }
    };
  }, [branch, router]);

  const loadInvoices = useCallback(async () => {
    if (!branchId || !canViewExpenses) {
      setInvoices([]);
      setTotalCount(0);
      setMonthlyStats({
        count: 0,
        totalAmount: 0,
        processedCount: 0,
        pendingCount: 0,
      });
      return;
    }

    setLoading(true);
    setLoadError("");

    const from =
      (currentPage - 1) * ITEMS_PER_PAGE;

    const to =
      from + ITEMS_PER_PAGE - 1;

    let listQuery = supabase
      .from("finance_expense_invoices")
      .select(
        `
          id,
          branch_id,
          invoice_title,
          invoice_amount,
          invoice_details,
          invoice_date,
          payment_method,
          created_by_user_id,
          created_by_name,
          created_at,
          updated_at,
          processing_status,
          processed_at,
          processed_by_user_id,
          processed_by_name
        `,
        { count: "exact" }
      )
      .eq("branch_id", branchId);

    let statsQuery = supabase
      .from("finance_expense_invoices")
      .select(
        `
          invoice_amount,
          processing_status
        `
      )
      .eq("branch_id", branchId);

    if (selectedMonth !== "all") {
      const monthRange =
        getMonthRange(selectedMonth);

      listQuery = listQuery
        .gte("invoice_date", monthRange.start)
        .lt("invoice_date", monthRange.end);

      statsQuery = statsQuery
        .gte("invoice_date", monthRange.start)
        .lt("invoice_date", monthRange.end);
    }

    const cleanSearch =
      appliedSearch.trim();

    if (cleanSearch) {
      const escapedSearch =
        cleanSearch.replace(/[%_,()]/g, " ");

      listQuery = listQuery.or(
        `invoice_title.ilike.%${escapedSearch}%,invoice_details.ilike.%${escapedSearch}%,created_by_name.ilike.%${escapedSearch}%,payment_method.ilike.%${escapedSearch}%,processed_by_name.ilike.%${escapedSearch}%`
      );
    }

    if (paymentMethodFilter) {
      listQuery = listQuery.ilike(
        "payment_method",
        `%${paymentMethodFilter}%`
      );
    }

    if (statusFilter !== "all") {
      listQuery = listQuery.eq(
        "processing_status",
        statusFilter
      );
    }

    const [listResult, statsResult] =
      await Promise.all([
        listQuery
          .order("invoice_date", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          })
          .range(from, to),
        statsQuery,
      ]);

    if (listResult.error) {
      setLoadError(
        `تعذر تحميل الفواتير: ${listResult.error.message}`
      );
      setLoading(false);
      return;
    }

    const rows =
      (listResult.data || []) as ExpenseInvoice[];

    setInvoices(rows);
    setTotalCount(listResult.count || 0);

    if (statsResult.error) {
      setLoadError(
        `تم تحميل الفواتير، لكن تعذر تحميل الإحصائيات: ${statsResult.error.message}`
      );
    } else {
      const statsRows =
        statsResult.data || [];

      const nextStats =
        statsRows.reduce<MonthlyStats>(
          (stats, row) => {
            stats.count += 1;

            stats.totalAmount += Number(
              row.invoice_amount || 0
            );

            if (
              row.processing_status ===
              "processed"
            ) {
              stats.processedCount += 1;
            } else {
              stats.pendingCount += 1;
            }

            return stats;
          },
          {
            count: 0,
            totalAmount: 0,
            processedCount: 0,
            pendingCount: 0,
          }
        );

      setMonthlyStats(nextStats);
    }

    setLoading(false);
  }, [
    branchId,
    canViewExpenses,
    currentPage,
    appliedSearch,
    paymentMethodFilter,
    statusFilter,
    selectedMonth,
  ]);

  useEffect(() => {
    if (!authChecked || accessDenied) return;

    loadInvoices();
  }, [
    authChecked,
    accessDenied,
    loadInvoices,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function applyFilters() {
    setCurrentPage(1);
    setAppliedSearch(searchTerm);
  }

  function clearFilters() {
    setSearchTerm("");
    setAppliedSearch("");
    setPaymentMethodFilter("");
    setStatusFilter("all");
    setSelectedMonth(getCurrentMonthValue());
    setCurrentPage(1);
  }

  function isInvoiceOwner(
    invoice: ExpenseInvoice
  ) {
    return (
      Boolean(currentUserId) &&
      invoice.created_by_user_id ===
        currentUserId
    );
  }

  function canEditInvoice(
    invoice: ExpenseInvoice
  ) {
    if (
      !branchId ||
      invoice.branch_id !== branchId
    ) {
      return false;
    }

    if (
      isManager ||
      hasPermission(
        EXPENSE_PERMISSIONS.EDIT_ALL
      )
    ) {
      return true;
    }

    return (
      isInvoiceOwner(invoice) &&
      hasPermission(
        EXPENSE_PERMISSIONS.EDIT_OWN
      )
    );
  }

  function canDeleteInvoice(
    invoice: ExpenseInvoice
  ) {
    if (
      !branchId ||
      invoice.branch_id !== branchId
    ) {
      return false;
    }

    if (
      isManager ||
      hasPermission(
        EXPENSE_PERMISSIONS.DELETE_ALL
      )
    ) {
      return true;
    }

    return (
      isInvoiceOwner(invoice) &&
      hasPermission(
        EXPENSE_PERMISSIONS.DELETE_OWN
      )
    );
  }

  function canProcessInvoice(
    invoice: ExpenseInvoice
  ) {
    if (
      !branchId ||
      invoice.branch_id !== branchId
    ) {
      return false;
    }

    return (
      isManager ||
      hasPermission(
        EXPENSE_PERMISSIONS.PROCESS
      )
    );
  }

  function openEditInvoice(
    invoice: ExpenseInvoice
  ) {
    if (!canEditInvoice(invoice)) {
      alert(
        "ليست لديك صلاحية تعديل هذه الفاتورة."
      );
      return;
    }

    router.push(
      `/finance/${branch}/expenses/${invoice.id}/edit`
    );
  }

  async function processInvoice(
    invoice: ExpenseInvoice
  ) {
    if (!branchId || !currentUserId) {
      alert(
        "تعذر تحديد الفرع أو حساب الموظف."
      );
      return;
    }

    if (!canProcessInvoice(invoice)) {
      alert(
        "ليست لديك صلاحية معالجة هذه الفاتورة."
      );
      return;
    }

    if (
      invoice.processing_status ===
      "processed"
    ) {
      alert(
        "تمت معالجة هذه الفاتورة مسبقًا."
      );
      return;
    }

    const confirmed = window.confirm(
      `هل تؤكد أن فاتورة "${invoice.invoice_title}" تمت معالجتها وسدادها؟`
    );

    if (!confirmed) return;

    try {
      setProcessLoadingId(invoice.id);

      const { data, error } = await supabase.rpc(
        "process_expense_invoice_atomic",
        {
          p_branch_id: branchId,
          p_invoice_id: invoice.id,
          p_actor_user_id: currentUserId,
        }
      );

      if (error) {
        throw error;
      }

      if (
        !Array.isArray(data) ||
        data.length === 0
      ) {
        throw new Error(
          "لم تتم معالجة الفاتورة."
        );
      }

      await loadInvoices();
    } catch (error: unknown) {
      alert(
        getErrorMessage(
          error,
          "حدث خطأ أثناء معالجة الفاتورة."
        )
      );
    } finally {
      setProcessLoadingId(null);
    }
  }

  async function deleteInvoice(
    invoice: ExpenseInvoice
  ) {
    if (!branchId || !currentUserId) {
      alert(
        "تعذر تحديد الفرع أو حساب الموظف."
      );
      return;
    }

    if (!canDeleteInvoice(invoice)) {
      alert(
        "ليست لديك صلاحية حذف هذه الفاتورة."
      );
      return;
    }

    const confirmed = window.confirm(
      `هل تريد حذف فاتورة "${invoice.invoice_title}"؟\nلا يمكن التراجع عن الحذف.`
    );

    if (!confirmed) return;

    try {
      setDeleteLoadingId(invoice.id);

      const { data, error } = await supabase.rpc(
        "delete_expense_invoice_atomic",
        {
          p_branch_id: branchId,
          p_invoice_id: invoice.id,
          p_actor_user_id: currentUserId,
        }
      );

      if (error) {
        throw error;
      }

      if (
        !Array.isArray(data) ||
        data.length === 0
      ) {
        throw new Error(
          "لم يتم حذف الفاتورة."
        );
      }

      if (
        invoices.length === 1 &&
        currentPage > 1
      ) {
        setCurrentPage((page) =>
          Math.max(1, page - 1)
        );
      } else {
        await loadInvoices();
      }
    } catch (error: unknown) {
      alert(
        getErrorMessage(
          error,
          "حدث خطأ أثناء حذف الفاتورة."
        )
      );
    } finally {
      setDeleteLoadingId(null);
    }
  }

  async function handleLogout() {
    try {
      const logout =
        logoutFinanceUser as unknown as () =>
          | void
          | Promise<void>;

      await logout();
    } catch {
      if (typeof window !== "undefined") {
        localStorage.removeItem(
          "finance_user"
        );
        localStorage.removeItem(
          "finance_user_name"
        );
        localStorage.removeItem(
          "finance_branch_user"
        );
        localStorage.removeItem(
          "finance_role"
        );
      }
    }

    router.replace("/login");
  }

  function formatMoney(
    value: number | string
  ) {
    return Number(value || 0).toLocaleString(
      "ar-SA",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function formatDate(value: string) {
    if (!value) return "—";

    const date = new Date(
      `${value}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return `${date.getFullYear()}/${padNumber(
      date.getMonth() + 1
    )}/${padNumber(date.getDate())}`;
  }

  function formatDateTime(
    value: string | null
  ) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return `${date.getFullYear()}/${padNumber(
      date.getMonth() + 1
    )}/${padNumber(date.getDate())} ${padNumber(
      date.getHours()
    )}:${padNumber(date.getMinutes())}`;
  }

  if (!authChecked) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(isMobile)}
      >
        <div
          style={getContainerStyle(isCompact)}
        >
          <div style={centerStatusCard}>
            جاري التحقق من الجلسة...
          </div>
        </div>
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
          style={getContainerStyle(isCompact)}
        >
          <div style={accessDeniedCard}>
            <div style={accessDeniedIcon}>
              ⛔
            </div>

            <h1 style={accessDeniedTitle}>
              لا توجد صلاحية
            </h1>

            <p style={accessDeniedText}>
              لا تملك صلاحية الدخول إلى قسم
              المصروفات والمشتريات.
            </p>

            <button
              type="button"
              style={backButton}
              onClick={() =>
                router.push(
                  `/finance/${branch}`
                )
              }
            >
              العودة إلى محطة العمل
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={getPageStyle(isMobile)}
    >
      <div
        style={getContainerStyle(isCompact)}
      >
        <header style={getHeroStyle(isMobile)}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div
            style={getHeroContentStyle(screen)}
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

                {!isMobile && (
                  <div
                    style={
                      employeeDividerSmall
                    }
                  />
                )}

                <button
                  type="button"
                  style={logoutInlineButton}
                  onClick={handleLogout}
                >
                  <LogoutIcon />
                  <span>
                    تسجيل الخروج
                  </span>
                </button>
              </div>

              <button
                type="button"
                style={getMainWorkstationButtonStyle(
                  isMobile
                )}
                onClick={() =>
                  router.push(
                    `/finance/${branch}`
                  )
                }
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
                المصروفات والمشتريات
              </h1>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            />
          </div>
        </header>

        {loadError && (
          <div style={errorBox}>
            <span>{loadError}</span>

            <button
              type="button"
              style={retryButton}
              onClick={loadInvoices}
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        <section style={periodCard}>
          <div style={periodTitleBox}>
            <span style={periodIcon}>📆</span>

            <div>
              <span style={periodSmallTitle}>
                الفترة المعروضة
              </span>

              <strong style={periodTitle}>
                {selectedPeriodLabel}
              </strong>
            </div>
          </div>

          <select
            style={periodSelect}
            value={selectedMonth}
            onChange={(event) => {
              setSelectedMonth(
                event.target.value
              );
              setCurrentPage(1);
            }}
          >
            {monthOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}

            <option value="all">
              كل الفترات
            </option>
          </select>
        </section>

        <section style={statsGrid}>
          <div style={statCard}>
            <span style={statIcon}>🧾</span>

            <div>
              <span style={statValue}>
                {monthlyStats.count.toLocaleString(
                  "ar-SA"
                )}
              </span>

              <span style={statTitle}>
                عدد الفواتير
              </span>
            </div>
          </div>

          <div style={statCard}>
            <span style={statIcon}>💰</span>

            <div>
              <span style={statValue}>
                {formatMoney(
                  monthlyStats.totalAmount
                )}
              </span>

              <span style={statTitle}>
                إجمالي المصروفات
              </span>
            </div>
          </div>

          <div style={statCard}>
            <span style={processedStatIcon}>
              ✅
            </span>

            <div>
              <span style={processedStatValue}>
                {monthlyStats.processedCount.toLocaleString(
                  "ar-SA"
                )}
              </span>

              <span style={statTitle}>
                تمت معالجتها
              </span>
            </div>
          </div>

          <div style={statCard}>
            <span style={pendingStatIcon}>
              ⏳
            </span>

            <div>
              <span style={pendingStatValue}>
                {monthlyStats.pendingCount.toLocaleString(
                  "ar-SA"
                )}
              </span>

              <span style={statTitle}>
                قيد الانتظار
              </span>
            </div>
          </div>
        </section>

        {canCreateExpense && (
          <section style={actionsCard}>
            <button
              type="button"
              style={primaryButton}
              onClick={() =>
                router.push(
                  `/finance/${branch}/expenses/new`
                )
              }
            >
              <span>＋</span>
              <span>
                إنشاء فاتورة جديدة
              </span>
            </button>
          </section>
        )}

        <section style={filterCard}>
          <div style={filterHeader}>
            <h2 style={sectionTitle}>
              البحث والتصفية
            </h2>

            <button
              type="button"
              style={clearButton}
              onClick={clearFilters}
            >
              مسح التصفية
            </button>
          </div>

          <div style={filterGrid}>
            <div style={fieldBox}>
              <label style={labelStyle}>
                البحث
              </label>

              <input
                style={input}
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    applyFilters();
                  }
                }}
              />
            </div>

            <div style={fieldBox}>
              <label style={labelStyle}>
                طريقة السداد
              </label>

              <select
                style={input}
                value={paymentMethodFilter}
                onChange={(event) => {
                  setPaymentMethodFilter(
                    event.target.value
                  );
                  setCurrentPage(1);
                }}
              >
                <option value="">
                  جميع الطرق
                </option>

                <option value="نقدًا">
                  نقدًا
                </option>

                <option value="تحويل بنكي">
                  تحويل بنكي
                </option>

                <option value="شبكة">
                  شبكة / مدى
                </option>

                <option value="الصندوق">
                  من الصندوق
                </option>

                <option value="حساب بنكي">
                  من حساب بنكي
                </option>

                <option value="أخرى">
                  أخرى
                </option>
              </select>
            </div>

            <div style={fieldBox}>
              <label style={labelStyle}>
                حالة الفاتورة
              </label>

              <select
                style={input}
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(
                    event.target
                      .value as StatusFilter
                  );
                  setCurrentPage(1);
                }}
              >
                <option value="all">
                  جميع الحالات
                </option>

                <option value="pending">
                  قيد الانتظار
                </option>

                <option value="processed">
                  تمت المعالجة
                </option>
              </select>
            </div>
          </div>

          <button
            type="button"
            style={searchButton}
            onClick={applyFilters}
          >
            بحث
          </button>
        </section>

        <section style={card}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>
                الفواتير
              </h2>

              <span style={sectionPeriod}>
                {selectedPeriodLabel}
              </span>
            </div>

            <span style={resultsCount}>
              {totalCount.toLocaleString(
                "ar-SA"
              )}{" "}
              نتيجة
            </span>
          </div>

          {!canViewExpenses ? (
            <div style={emptyBox}>
              لديك صلاحية إنشاء فاتورة، لكن
              ليست لديك صلاحية عرض الفواتير.
            </div>
          ) : loading ? (
            <div style={emptyBox}>
              جاري تحميل الفواتير...
            </div>
          ) : invoices.length === 0 ? (
            <div style={emptyBox}>
              لا توجد فواتير مطابقة.
            </div>
          ) : (
            <>
              <div style={invoiceList}>
                {invoices.map((invoice) => {
                  const showEdit =
                    canEditInvoice(invoice);

                  const showProcess =
                    canProcessInvoice(invoice);

                  const showDelete =
                    canDeleteInvoice(invoice);

                  const isProcessed =
                    invoice.processing_status ===
                    "processed";

                  const isProcessing =
                    processLoadingId ===
                    invoice.id;

                  const isDeleting =
                    deleteLoadingId ===
                    invoice.id;

                  return (
                    <article
                      key={invoice.id}
                      style={
                        isProcessed
                          ? processedInvoiceCard
                          : invoiceCard
                      }
                    >
                      <div
                        style={getInvoiceMainRowStyle(
                          isCompact
                        )}
                      >
                        <div style={invoiceInfo}>
                          <div
                            style={
                              invoiceTitleRow
                            }
                          >
                            <div
                              style={
                                invoiceTitleBox
                              }
                            >
                              <h3
                                style={
                                  invoiceTitle
                                }
                              >
                                {
                                  invoice.invoice_title
                                }
                              </h3>

                              <span
                                style={
                                  isProcessed
                                    ? processedBadge
                                    : pendingBadge
                                }
                              >
                                {isProcessed
                                  ? "✓ تمت المعالجة"
                                  : "قيد الانتظار"}
                              </span>
                            </div>

                            <strong
                              style={amount}
                            >
                              {formatMoney(
                                invoice.invoice_amount
                              )}{" "}
                              ريال
                            </strong>
                          </div>

                          <div
                            style={
                              invoiceMetaGrid
                            }
                          >
                            <div
                              style={metaItem}
                            >
                              <span
                                style={
                                  metaLabel
                                }
                              >
                                تاريخ الفاتورة
                              </span>

                              <strong
                                style={
                                  metaValue
                                }
                              >
                                {formatDate(
                                  invoice.invoice_date
                                )}
                              </strong>
                            </div>

                            <div
                              style={metaItem}
                            >
                              <span
                                style={
                                  metaLabel
                                }
                              >
                                طريقة السداد
                              </span>

                              <strong
                                style={
                                  metaValue
                                }
                              >
                                {invoice.payment_method ||
                                  "غير محدد"}
                              </strong>
                            </div>

                            <div
                              style={metaItem}
                            >
                              <span
                                style={
                                  metaLabel
                                }
                              >
                                أنشأها
                              </span>

                              <strong
                                style={
                                  metaValue
                                }
                              >
                                {invoice.created_by_name ||
                                  "مستخدم"}
                              </strong>
                            </div>
                          </div>

                          {invoice.invoice_details && (
                            <div
                              style={
                                detailsBox
                              }
                            >
                              <span
                                style={
                                  detailsLabel
                                }
                              >
                                التفاصيل
                              </span>

                              <p
                                style={
                                  details
                                }
                              >
                                {
                                  invoice.invoice_details
                                }
                              </p>
                            </div>
                          )}

                          {isProcessed && (
                            <div
                              style={
                                processedDetails
                              }
                            >
                              <span>
                                ✓ تمت معالجة
                                الفاتورة
                              </span>

                              <span>
                                بواسطة:{" "}
                                <strong>
                                  {invoice.processed_by_name ||
                                    "مستخدم"}
                                </strong>
                              </span>

                              <span>
                                التاريخ:{" "}
                                <strong>
                                  {formatDateTime(
                                    invoice.processed_at
                                  )}
                                </strong>
                              </span>
                            </div>
                          )}
                        </div>

                        {(showEdit ||
                          showProcess ||
                          showDelete) && (
                          <div
                            style={getInvoiceActionsStyle(
                              isCompact
                            )}
                          >
                            {showEdit && (
                              <button
                                type="button"
                                style={
                                  editButton
                                }
                                onClick={() =>
                                  openEditInvoice(
                                    invoice
                                  )
                                }
                              >
                                تعديل
                              </button>
                            )}

                            {showProcess && (
                              <button
                                type="button"
                                style={{
                                  ...processButton,
                                  opacity:
                                    isProcessed ||
                                    isProcessing
                                      ? 0.58
                                      : 1,
                                  cursor:
                                    isProcessed ||
                                    isProcessing
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                                disabled={
                                  isProcessed ||
                                  isProcessing
                                }
                                onClick={() =>
                                  processInvoice(
                                    invoice
                                  )
                                }
                              >
                                {isProcessing
                                  ? "جاري المعالجة..."
                                  : "تمت المعالجة"}
                              </button>
                            )}

                            {showDelete && (
                              <button
                                type="button"
                                style={{
                                  ...deleteButton,
                                  opacity:
                                    isDeleting
                                      ? 0.62
                                      : 1,
                                  cursor:
                                    isDeleting
                                      ? "not-allowed"
                                      : "pointer",
                                }}
                                disabled={
                                  isDeleting
                                }
                                onClick={() =>
                                  deleteInvoice(
                                    invoice
                                  )
                                }
                              >
                                {isDeleting
                                  ? "جاري الحذف..."
                                  : "حذف"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div style={pagination}>
                <button
                  type="button"
                  style={{
                    ...pageButton,
                    opacity:
                      currentPage === 1
                        ? 0.5
                        : 1,
                    cursor:
                      currentPage === 1
                        ? "not-allowed"
                        : "pointer",
                  }}
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.max(1, page - 1)
                    )
                  }
                >
                  السابق
                </button>

                <span style={pageInfo}>
                  صفحة {currentPage} من{" "}
                  {totalPages}
                </span>

                <button
                  type="button"
                  style={{
                    ...pageButton,
                    opacity:
                      currentPage ===
                      totalPages
                        ? 0.5
                        : 1,
                    cursor:
                      currentPage ===
                      totalPages
                        ? "not-allowed"
                        : "pointer",
                  }}
                  disabled={
                    currentPage === totalPages
                  }
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(
                        totalPages,
                        page + 1
                      )
                    )
                  }
                >
                  التالي
                </button>
              </div>
            </>
          )}
        </section>

        <div style={backWrapper}>
          <button
            type="button"
            style={backButton}
            onClick={() => router.back()}
          >
            ← رجوع
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
    gap: screen === "mobile" ? 10 : 14,
    direction:
      screen === "desktop" ? "ltr" : "rtl",
    color: "#ffffff",
    width: "100%",
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
        ? 25
        : screen === "tablet"
          ? 28
          : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace:
      screen === "mobile"
        ? "normal"
        : "nowrap",
    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  return screen === "desktop"
    ? {
        display: "flex",
        justifyContent: "flex-end",
      }
    : {
        display: "none",
      };
}

function getInvoiceMainRowStyle(
  isCompact: boolean
): CSSProperties {
  return {
    display: "flex",
    flexDirection: isCompact
      ? "column"
      : "row",
    alignItems: isCompact
      ? "stretch"
      : "center",
    justifyContent: "space-between",
    gap: 18,
  };
}

function getInvoiceActionsStyle(
  isCompact: boolean
): CSSProperties {
  return {
    display: "flex",
    flexDirection: isCompact
      ? "row"
      : "column",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 8,
    width: isCompact ? "100%" : 145,
    flex: isCompact
      ? "1 1 100%"
      : "0 0 145px",
    paddingTop: isCompact ? 14 : 0,
    borderTop: isCompact
      ? "1px solid #e2e8f0"
      : "none",
    borderRight: isCompact
      ? "none"
      : "1px solid #e2e8f0",
    paddingRight: isCompact ? 0 : 18,
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
  color: "#ffffff",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.92)",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  padding: 0,
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

const periodCard: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbeafe",
  borderRadius: 18,
  padding: 15,
  marginBottom: 14,
  boxShadow:
    "0 8px 22px rgba(15,23,42,0.04)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const periodTitleBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const periodIcon: CSSProperties = {
  width: 45,
  height: 45,
  borderRadius: 14,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 21,
};

const periodSmallTitle: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 4,
};

const periodTitle: CSSProperties = {
  display: "block",
  color: "#1d4ed8",
  fontSize: 17,
  fontWeight: 900,
};

const periodSelect: CSSProperties = {
  minWidth: 210,
  height: 46,
  padding: "0 13px",
  borderRadius: 13,
  border: "1px solid #bfdbfe",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(210px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
  boxShadow:
    "0 8px 22px rgba(15,23,42,0.04)",
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const statIcon: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 15,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 23,
};

const processedStatIcon: CSSProperties = {
  ...statIcon,
  background: "#ecfdf5",
};

const pendingStatIcon: CSSProperties = {
  ...statIcon,
  background: "#fff7ed",
};

const statValue: CSSProperties = {
  display: "block",
  color: "#2563eb",
  fontSize: 25,
  fontWeight: 900,
};

const processedStatValue: CSSProperties = {
  ...statValue,
  color: "#15803d",
};

const pendingStatValue: CSSProperties = {
  ...statValue,
  color: "#c2410c",
};

const statTitle: CSSProperties = {
  display: "block",
  marginTop: 5,
  color: "#475569",
  fontWeight: 800,
};

const actionsCard: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 14,
  marginBottom: 14,
};

const primaryButton: CSSProperties = {
  width: "100%",
  minHeight: 52,
  padding: "12px 16px",
  background:
    "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const filterCard: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
  marginBottom: 14,
  boxShadow:
    "0 10px 24px rgba(15,23,42,0.04)",
};

const filterHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const filterGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(210px,1fr))",
  gap: 12,
};

const fieldBox: CSSProperties = {
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 14,
};

const input: CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 13px",
  borderRadius: 13,
  border: "1px solid #dbe3ef",
  fontSize: 15,
  boxSizing: "border-box",
  background: "#f8fafc",
  fontFamily:
    "var(--font-almarai), sans-serif",
  color: "#0f172a",
};

const searchButton: CSSProperties = {
  width: "100%",
  minHeight: 48,
  marginTop: 12,
  border: "none",
  borderRadius: 13,
  background:
    "linear-gradient(135deg,#0ea5e9,#2563eb)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const clearButton: CSSProperties = {
  minHeight: 38,
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  padding: "0 13px",
  background: "#ffffff",
  color: "#475569",
  fontWeight: 800,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const card: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
  boxShadow:
    "0 10px 24px rgba(15,23,42,0.05)",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
};

const sectionTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 19,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const sectionPeriod: CSSProperties = {
  display: "block",
  marginTop: 5,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 800,
};

const resultsCount: CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "7px 11px",
  fontSize: 13,
  fontWeight: 900,
};

const emptyBox: CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 22,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 700,
};

const invoiceList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const invoiceCard: CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  borderRight: "4px solid #f59e0b",
  borderRadius: 17,
  padding: 17,
  background: "#ffffff",
  boxShadow:
    "0 5px 16px rgba(15,23,42,0.045)",
  boxSizing: "border-box",
};

const processedInvoiceCard: CSSProperties = {
  ...invoiceCard,
  border: "1px solid #bbf7d0",
  borderRight: "4px solid #22c55e",
  background:
    "linear-gradient(135deg,#ffffff,#f0fdf4)",
};

const invoiceInfo: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
};

const invoiceTitleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
};

const invoiceTitleBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const invoiceTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const processedBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 30,
  padding: "0 11px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #86efac",
  fontSize: 12,
  fontWeight: 900,
};

const pendingBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 30,
  padding: "0 11px",
  borderRadius: 999,
  background: "#fff7ed",
  color: "#c2410c",
  border: "1px solid #fed7aa",
  fontSize: 12,
  fontWeight: 900,
};

const amount: CSSProperties = {
  color: "#166534",
  fontSize: 18,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const invoiceMetaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
};

const metaItem: CSSProperties = {
  minWidth: 0,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #eef2f7",
};

const metaLabel: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
  marginBottom: 5,
};

const metaValue: CSSProperties = {
  display: "block",
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: "anywhere",
};

const detailsBox: CSSProperties = {
  marginTop: 12,
  padding: "11px 13px",
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #eef2f7",
};

const detailsLabel: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
  marginBottom: 5,
};

const details: CSSProperties = {
  margin: 0,
  color: "#475569",
  lineHeight: 1.75,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  fontSize: 13,
};

const processedDetails: CSSProperties = {
  marginTop: 12,
  padding: "11px 13px",
  borderRadius: 12,
  background: "#dcfce7",
  border: "1px solid #86efac",
  color: "#166534",
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  fontSize: 12,
  fontWeight: 800,
};

const editButton: CSSProperties = {
  minHeight: 40,
  padding: "0 13px",
  border: "none",
  borderRadius: 11,
  background:
    "linear-gradient(135deg,#0ea5e9,#2563eb)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const processButton: CSSProperties = {
  minHeight: 40,
  padding: "0 13px",
  border: "none",
  borderRadius: 11,
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const deleteButton: CSSProperties = {
  minHeight: 40,
  padding: "0 13px",
  border: "none",
  borderRadius: 11,
  background:
    "linear-gradient(135deg,#ef4444,#b91c1c)",
  color: "#ffffff",
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const pagination: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 10,
  marginTop: 18,
  flexWrap: "wrap",
};

const pageButton: CSSProperties = {
  padding: "10px 15px",
  border: "none",
  borderRadius: 12,
  background: "#e0f2fe",
  color: "#075985",
  fontWeight: 800,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const pageInfo: CSSProperties = {
  color: "#475569",
  fontWeight: 800,
};

const errorBox: CSSProperties = {
  marginBottom: 14,
  padding: 14,
  borderRadius: 15,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const retryButton: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "9px 12px",
  background: "#ea580c",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const centerStatusCard: CSSProperties = {
  margin: "80px auto",
  maxWidth: 460,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 28,
  textAlign: "center",
  color: "#475569",
  fontWeight: 900,
};

const accessDeniedCard: CSSProperties = {
  maxWidth: 500,
  margin: "80px auto",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 28,
  textAlign: "center",
  boxShadow:
    "0 16px 40px rgba(15,23,42,0.08)",
};

const accessDeniedIcon: CSSProperties = {
  fontSize: 42,
};

const accessDeniedTitle: CSSProperties = {
  margin: "12px 0 8px",
  color: "#991b1b",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const accessDeniedText: CSSProperties = {
  color: "#64748b",
  lineHeight: 1.8,
  marginBottom: 20,
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  minWidth: 120,
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
