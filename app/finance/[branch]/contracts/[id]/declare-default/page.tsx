"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CSSProperties,
  FormEvent,
  ReactNode,
} from "react";
import {
  useParams,
  usePathname,
  useRouter,
} from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type FinanceSession = {
  id?: string | null;
  user_id?: string | null;
  full_name?: string | null;
  username?: string | null;
  role?: string | null;
  branch_id?: string | null;
  branch_slug?: string | null;
  permissions?: unknown;
  is_active?: boolean | null;
};

type CustomerRelation = {
  id?: string | null;
  full_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
};

type Contract = {
  id: string;
  branch_id?: string | null;
  customer_id?: string | null;
  contract_number?: string | number | null;
  contract_status?: string | null;
  debt_amount?: number | string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  payment_due_date?: string | null;
  default_declared_at?: string | null;
  default_expires_at?: string | null;
  default_declared_by?: string | null;
  default_declared_by_name?: string | null;
  customer_name?: string | null;
  customer_national_id?: string | null;
  customer?: CustomerRelation | CustomerRelation[] | null;
};

type DeclareDefaultResult = {
  contract_id: string;
  default_declared_at: string;
  default_expires_at: string;
};

const SESSION_DURATION_MS =
  60 * 60 * 1000;

const ACTIVITY_REFRESH_INTERVAL_MS =
  60 * 1000;

const DAY_MS =
  24 * 60 * 60 * 1000;

const SESSION_KEYS = [
  "finance_user",
  "finance_branch_user",
  "finance_user_id",
  "finance_user_name",
  "finance_username",
  "finance_role",
  "finance_branch_id",
  "finance_branch_slug",
  "finance_branch_name",
  "finance_organization_name",
  "finance_permissions",
  "finance_investor_id",
  "finance_is_active",
  "finance_last_login_at",
  "finance_session_expires_at",
  "finance_last_activity_at",
  "finance_return_to",
] as const;

export default function DeclareDefaultPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const branch = String(
    params.branch ?? ""
  ).trim();

  const contractId = String(
    params.id ?? ""
  ).trim();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [pageReady, setPageReady] =
    useState(false);

  const [dataLoading, setDataLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [pageError, setPageError] =
    useState("");

  const [formError, setFormError] =
    useState("");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [employeeId, setEmployeeId] =
    useState("");

  const [
    employeeName,
    setEmployeeName,
  ] = useState("الموظف");

  const [contract, setContract] =
    useState<Contract | null>(null);

  const [reason, setReason] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const isMobile =
    screen === "mobile";

  const isTablet =
    screen === "tablet";

  const isCompact =
    isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      const width =
        window.innerWidth;

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

  const loadContract =
    useCallback(
      async (
        currentBranchId: string,
        isCancelled: () => boolean =
          () => false
      ) => {
        setDataLoading(true);
        setPageError("");

        try {
          const {
            data,
            error,
          } = await supabase
            .from("finance_contracts")
            .select(
              `
                id,
                branch_id,
                customer_id,
                contract_number,
                contract_status,
                debt_amount,
                paid_amount,
                remaining_amount,
                payment_due_date,
                default_declared_at,
                default_expires_at,
                default_declared_by,
                default_declared_by_name,
                customer_name,
                customer_national_id,
                customer:finance_customers!finance_contracts_customer_id_fkey(
                  id,
                  full_name,
                  national_id,
                  phone
                )
              `
            )
            .eq(
              "id",
              contractId
            )
            .eq(
              "branch_id",
              currentBranchId
            )
            .maybeSingle();

          if (isCancelled()) {
            return;
          }

          if (error) {
            throw new Error(
              error.message
            );
          }

          setContract(
            (data as Contract | null) ||
              null
          );
        } catch (error) {
          if (isCancelled()) {
            return;
          }

          console.error(
            "Declare default loading error:",
            error
          );

          setPageError(
            getErrorMessage(
              error,
              "تعذر تحميل بيانات العقد"
            )
          );
        } finally {
          if (!isCancelled()) {
            setDataLoading(false);
          }
        }
      },
      [contractId]
    );

  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      if (
        typeof window ===
        "undefined"
      ) {
        return;
      }

      const session =
        readStoredSession();

      if (
        !isValidSession(session)
      ) {
        redirectToLogin(true);
        return;
      }

      const sessionBranchSlug =
        String(
          session?.branch_slug || ""
        ).trim();

      if (
        sessionBranchSlug &&
        sessionBranchSlug !== branch
      ) {
        router.replace(
          `/finance/${sessionBranchSlug}`
        );

        return;
      }

      const currentEmployeeId =
        String(
          session?.id ||
            session?.user_id ||
            localStorage.getItem(
              "finance_user_id"
            ) ||
            ""
        ).trim();

      const currentEmployeeName =
        String(
          localStorage.getItem(
            "finance_user_name"
          ) ||
            session?.full_name ||
            session?.username ||
            "الموظف"
        ).trim();

      if (!currentEmployeeId) {
        redirectToLogin(true);
        return;
      }

      setEmployeeId(
        currentEmployeeId
      );

      setEmployeeName(
        currentEmployeeName ||
          "الموظف"
      );

      renewFinanceSession();
      setPageReady(true);

      let resolvedBranchId =
        String(
          session?.branch_id ||
            localStorage.getItem(
              "finance_branch_id"
            ) ||
            ""
        ).trim();

      if (!resolvedBranchId) {
        try {
          const fetchedBranchId =
            await getBranchId(
              branch
            );

          if (cancelled) {
            return;
          }

          if (!fetchedBranchId) {
            setPageError(
              "تعذر تحديد الفرع"
            );

            setDataLoading(false);
            return;
          }

          resolvedBranchId =
            String(
              fetchedBranchId
            );

          localStorage.setItem(
            "finance_branch_id",
            resolvedBranchId
          );

          localStorage.setItem(
            "finance_branch_slug",
            branch
          );
        } catch (error) {
          if (cancelled) {
            return;
          }

          setPageError(
            getErrorMessage(
              error,
              "تعذر تحديد الفرع"
            )
          );

          setDataLoading(false);
          return;
        }
      }

      setBranchId(
        resolvedBranchId
      );

      await loadContract(
        resolvedBranchId,
        () => cancelled
      );
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [
    branch,
    contractId,
    loadContract,
    router,
  ]);

  useEffect(() => {
    if (
      !pageReady ||
      typeof window ===
        "undefined"
    ) {
      return;
    }

    let lastRefresh = 0;

    function handleActivity() {
      const now = Date.now();

      if (
        now - lastRefresh <
        ACTIVITY_REFRESH_INTERVAL_MS
      ) {
        return;
      }

      lastRefresh = now;
      renewFinanceSession();
    }

    const events: Array<
      keyof WindowEventMap
    > = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    events.forEach(
      (eventName) => {
        window.addEventListener(
          eventName,
          handleActivity,
          {
            passive: true,
          }
        );
      }
    );

    const timer =
      window.setInterval(
        () => {
          const expiresAt =
            Number(
              localStorage.getItem(
                "finance_session_expires_at"
              ) || 0
            );

          if (
            expiresAt > 0 &&
            Date.now() >=
              expiresAt
          ) {
            redirectToLogin(
              true
            );
          }
        },
        30 * 1000
      );

    return () => {
      events.forEach(
        (eventName) => {
          window.removeEventListener(
            eventName,
            handleActivity
          );
        }
      );

      window.clearInterval(
        timer
      );
    };
  }, [
    pageReady,
    pathname,
  ]);

  const customer =
    useMemo(
      () =>
        getSingleRelation(
          contract?.customer
        ),
      [contract]
    );

  const dueDate =
    useMemo(
      () =>
        parseDateOnly(
          contract?.payment_due_date
        ),
      [
        contract?.payment_due_date,
      ]
    );

  const daysAfterDue =
    useMemo(() => {
      if (!dueDate) {
        return null;
      }

      const today =
        getTodayUtcDate();

      return Math.floor(
        (today.getTime() -
          dueDate.getTime()) /
          DAY_MS
      );
    }, [dueDate]);

  const isFullyPaid =
    Number(
      contract?.remaining_amount ||
        0
    ) <= 0 ||
    contract?.contract_status ===
      "تم السداد";

  const isClosedOrCancelled =
    [
      "تم السداد",
      "مغلق",
      "ملغي",
      "ملغى",
    ].includes(
      String(
        contract?.contract_status ||
          ""
      ).trim()
    );

  const hasActiveDefault =
    Boolean(
      contract?.default_declared_at &&
        contract?.default_expires_at &&
        new Date(
          contract.default_expires_at
        ).getTime() >
          Date.now()
    );

  const isLate =
    Boolean(
      dueDate &&
        daysAfterDue !== null &&
        daysAfterDue >= 7 &&
        !isFullyPaid &&
        !isClosedOrCancelled &&
        Number(
          contract?.remaining_amount ||
            0
        ) > 0
    );

  const canSubmit =
    Boolean(
      contract &&
        branchId &&
        employeeId &&
        isLate &&
        !hasActiveDefault &&
        reason.trim().length >=
          3 &&
        !submitting
    );

  function getSingleRelation(
    relation:
      | CustomerRelation
      | CustomerRelation[]
      | null
      | undefined
  ) {
    if (
      Array.isArray(relation)
    ) {
      return (
        relation[0] || null
      );
    }

    return relation || null;
  }

  function parseDateOnly(
    value?: string | null
  ) {
    const cleanValue =
      String(
        value || ""
      ).trim();

    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        cleanValue
      );

    if (!match) {
      return null;
    }

    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    const day =
      Number(match[3]);

    const date = new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

    if (
      date.getUTCFullYear() !==
        year ||
      date.getUTCMonth() !==
        month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function getTodayUtcDate() {
    const now = new Date();

    return new Date(
      Date.UTC(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      )
    );
  }

  function formatDateOnly(
    value?: string | null
  ) {
    const cleanValue =
      String(
        value || ""
      ).trim();

    const match =
      /^(\d{4})-(\d{2})-(\d{2})/.exec(
        cleanValue
      );

    if (!match) {
      return cleanValue || "-";
    }

    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  function formatDateTime(
    value?: string | null
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return new Intl.DateTimeFormat(
      "en-GB-u-ca-gregory",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(date);
  }

  function formatMoney(
    value: unknown
  ) {
    const number =
      Number(value || 0);

    return number.toLocaleString(
      "en-US",
      {
        minimumFractionDigits:
          2,
        maximumFractionDigits:
          2,
      }
    );
  }

  function getDeclareErrorMessage(
    message: string
  ) {
    if (
      message.includes(
        "BRANCH_REQUIRED"
      )
    ) {
      return "تعذر تحديد الفرع";
    }

    if (
      message.includes(
        "CONTRACT_REQUIRED"
      )
    ) {
      return "تعذر تحديد العقد";
    }

    if (
      message.includes(
        "EMPLOYEE_REQUIRED"
      ) ||
      message.includes(
        "EMPLOYEE_NAME_REQUIRED"
      )
    ) {
      return "تعذر تحديد الموظف الحالي";
    }

    if (
      message.includes(
        "DEFAULT_REASON_REQUIRED"
      )
    ) {
      return "سبب إعلان التعثر إلزامي";
    }

    if (
      message.includes(
        "CONTRACT_NOT_FOUND"
      )
    ) {
      return "العقد غير موجود أو لا يتبع هذا الفرع";
    }

    if (
      message.includes(
        "CONTRACT_NOT_ELIGIBLE"
      )
    ) {
      return "لا يمكن إعلان تعثر عقد مسدد أو مغلق أو ملغي";
    }

    if (
      message.includes(
        "CONTRACT_FULLY_PAID"
      )
    ) {
      return "لا يمكن إعلان تعثر عقد مسدد بالكامل";
    }

    if (
      message.includes(
        "INVALID_PAYMENT_DUE_DATE"
      )
    ) {
      return "تاريخ استحقاق العقد غير صحيح";
    }

    if (
      message.includes(
        "CONTRACT_NOT_LATE_YET"
      )
    ) {
      return "لا يمكن إعلان التعثر قبل مرور 7 أيام كاملة على تاريخ الاستحقاق";
    }

    if (
      message.includes(
        "DEFAULT_ALREADY_ACTIVE"
      )
    ) {
      return "يوجد إعلان تعثر فعّال على هذا العقد مسبقًا";
    }

    return (
      message ||
      "تعذر إعلان تعثر العقد"
    );
  }

  async function submitDefault(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setFormError("");

    if (
      !branchId ||
      !contract ||
      !employeeId
    ) {
      setFormError(
        "تعذر تحديد بيانات العقد أو الموظف"
      );

      return;
    }

    if (!isLate) {
      setFormError(
        "لا يمكن إعلان التعثر إلا بعد مرور 7 أيام كاملة على تاريخ الاستحقاق"
      );

      return;
    }

    if (hasActiveDefault) {
      setFormError(
        "يوجد إعلان تعثر فعّال على هذا العقد مسبقًا"
      );

      return;
    }

    const cleanReason =
      reason.trim();

    const cleanNotes =
      notes.trim();

    if (
      cleanReason.length < 3
    ) {
      setFormError(
        "اكتب سبب إعلان التعثر بشكل واضح"
      );

      return;
    }

    const confirmed =
      window.confirm(
        `هل أنت متأكد من إعلان تعثر العقد رقم ${
          contract.contract_number ||
          "-"
        } لمدة 6 أشهر؟`
      );

    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(true);
      renewFinanceSession();

      const {
        data,
        error,
      } = await supabase.rpc(
        "declare_contract_default_atomic",
        {
          p_branch_id:
            branchId,

          p_contract_id:
            contract.id,

          p_employee_id:
            employeeId,

          p_employee_name:
            employeeName ||
            "الموظف",

          p_default_reason:
            cleanReason,

          p_default_notes:
            cleanNotes || null,
        }
      );

      if (error) {
        throw new Error(
          getDeclareErrorMessage(
            error.message
          )
        );
      }

      const rawResult =
        Array.isArray(data)
          ? data[0]
          : data;

      const result =
        rawResult as
          | DeclareDefaultResult
          | null;

      if (
        !result?.contract_id
      ) {
        throw new Error(
          "لم يتم استلام نتيجة إعلان التعثر"
        );
      }

      alert(
        `تم إعلان تعثر العقد بنجاح، ويستمر حتى ${formatDateTime(
          result.default_expires_at
        )}`
      );

      router.push(
        `/finance/${branch}/contracts/${contract.id}`
      );
    } catch (error) {
      setFormError(
        getDeclareErrorMessage(
          getErrorMessage(
            error,
            "تعذر إعلان تعثر العقد"
          )
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  function retryLoading() {
    if (!branchId) {
      setPageError(
        "تعذر تحديد الفرع"
      );

      return;
    }

    void loadContract(
      branchId
    );
  }

  function clearSession({
    clearReturnPath = true,
  }: {
    clearReturnPath?: boolean;
  } = {}) {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    SESSION_KEYS.forEach(
      (key) => {
        if (
          !clearReturnPath &&
          key ===
            "finance_return_to"
        ) {
          return;
        }

        localStorage.removeItem(
          key
        );
      }
    );
  }

  function readStoredSession(): FinanceSession | null {
    if (
      typeof window ===
      "undefined"
    ) {
      return null;
    }

    const rawSession =
      localStorage.getItem(
        "finance_branch_user"
      ) ||
      localStorage.getItem(
        "finance_user"
      );

    if (!rawSession) {
      return null;
    }

    try {
      const parsed =
        JSON.parse(
          rawSession
        ) as FinanceSession;

      if (
        !parsed ||
        typeof parsed !==
          "object" ||
        Array.isArray(parsed)
      ) {
        return null;
      }

      return {
        ...parsed,

        id:
          parsed.id ||
          parsed.user_id ||
          localStorage.getItem(
            "finance_user_id"
          ),

        full_name:
          parsed.full_name ||
          localStorage.getItem(
            "finance_user_name"
          ) ||
          null,

        username:
          parsed.username ||
          localStorage.getItem(
            "finance_username"
          ) ||
          null,

        role:
          parsed.role ||
          localStorage.getItem(
            "finance_role"
          ) ||
          null,

        branch_id:
          parsed.branch_id ||
          localStorage.getItem(
            "finance_branch_id"
          ) ||
          null,

        branch_slug:
          parsed.branch_slug ||
          localStorage.getItem(
            "finance_branch_slug"
          ) ||
          null,
      };
    } catch {
      return null;
    }
  }

  function isValidSession(
    session: FinanceSession | null
  ) {
    if (!session) {
      return false;
    }

    const userId =
      String(
        session.id ||
          session.user_id ||
          ""
      ).trim();

    const sessionBranchSlug =
      String(
        session.branch_slug ||
          ""
      ).trim();

    if (
      !userId ||
      !sessionBranchSlug
    ) {
      return false;
    }

    if (
      session.is_active ===
      false
    ) {
      return false;
    }

    const expiresAt =
      Number(
        localStorage.getItem(
          "finance_session_expires_at"
        ) || 0
      );

    if (
      expiresAt > 0 &&
      Date.now() >=
        expiresAt
    ) {
      return false;
    }

    return true;
  }

  function renewFinanceSession() {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const now = Date.now();

    localStorage.setItem(
      "finance_last_activity_at",
      String(now)
    );

    localStorage.setItem(
      "finance_session_expires_at",
      String(
        now +
          SESSION_DURATION_MS
      )
    );
  }

  function getCurrentReturnPath() {
    if (
      typeof window ===
      "undefined"
    ) {
      return (
        pathname ||
        `/finance/${branch}`
      );
    }

    return `${window.location.pathname}${window.location.search}`;
  }

  function isSafeInternalReturnPath(
    value: string
  ) {
    if (
      !value.startsWith(
        "/finance/"
      )
    ) {
      return false;
    }

    if (
      value.startsWith("//") ||
      value.includes("://")
    ) {
      return false;
    }

    return value.startsWith(
      `/finance/${branch}`
    );
  }

  function redirectToLogin(
    preserveReturnPath = true
  ) {
    if (
      typeof window ===
      "undefined"
    ) {
      router.replace(
        "/login"
      );

      return;
    }

    const returnTo =
      getCurrentReturnPath();

    if (
      preserveReturnPath &&
      isSafeInternalReturnPath(
        returnTo
      )
    ) {
      localStorage.setItem(
        "finance_return_to",
        returnTo
      );
    }

    clearSession({
      clearReturnPath:
        !preserveReturnPath,
    });

    if (
      preserveReturnPath &&
      isSafeInternalReturnPath(
        returnTo
      )
    ) {
      localStorage.setItem(
        "finance_return_to",
        returnTo
      );

      router.replace(
        `/login?returnTo=${encodeURIComponent(
          returnTo
        )}`
      );

      return;
    }

    router.replace("/login");
  }

  function logout() {
    clearSession({
      clearReturnPath: true,
    });

    router.replace("/login");
  }

  if (!pageReady) {
    return null;
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
        <PageHero
          screen={screen}
          employeeName={
            employeeName
          }
          title="إعلان تعثر العقد"
          onLogout={logout}
          onHome={() =>
            router.push(
              `/finance/${branch}`
            )
          }
        />

        {dataLoading && (
          <section
            style={
              inlineLoadingBox
            }
          >
            جاري تحميل بيانات
            العقد...
          </section>
        )}

        {pageError && (
          <section
            style={inlineErrorBox}
          >
            <span>
              {pageError}
            </span>

            <button
              type="button"
              style={retryButton}
              onClick={
                retryLoading
              }
            >
              إعادة المحاولة
            </button>
          </section>
        )}

        {!dataLoading &&
          !pageError &&
          !contract && (
            <section
              style={
                emptyContractBox
              }
            >
              لم يتم العثور على
              العقد أو أنه لا يتبع
              هذا الفرع
            </section>
          )}

        {contract && (
          <>
            <section
              style={summaryGrid}
            >
              <SummaryBox
                title="رقم العقد"
                value={String(
                  contract.contract_number ||
                    "-"
                )}
              />

              <SummaryBox
                title="المبلغ المتبقي"
                value={`${formatMoney(
                  contract.remaining_amount
                )} ر.س`}
              />

              <SummaryBox
                title="أيام التأخير"
                value={
                  daysAfterDue !==
                    null &&
                  daysAfterDue > 0
                    ? `${daysAfterDue} يوم`
                    : "غير متأخر"
                }
              />
            </section>

            <InfoCard title="بيانات العقد">
              <Row
                label="اسم العميل"
                value={
                  customer?.full_name ||
                  contract.customer_name ||
                  "-"
                }
              />

              <Row
                label="رقم الهوية"
                value={
                  customer?.national_id ||
                  contract.customer_national_id ||
                  "-"
                }
              />

              <Row
                label="تاريخ الاستحقاق"
                value={formatDateOnly(
                  contract.payment_due_date
                )}
              />

              <Row
                label="حالة العقد"
                value={
                  contract.contract_status ||
                  "نشط"
                }
              />

              <Row
                label="مبلغ الدين"
                value={`${formatMoney(
                  contract.debt_amount
                )} ر.س`}
              />

              <Row
                label="المبلغ المسدد"
                value={`${formatMoney(
                  contract.paid_amount
                )} ر.س`}
              />

              <Row
                label="المبلغ المتبقي"
                value={`${formatMoney(
                  contract.remaining_amount
                )} ر.س`}
              />
            </InfoCard>

            {hasActiveDefault && (
              <section
                style={
                  existingDefaultBox
                }
              >
                <strong>
                  يوجد إعلان تعثر
                  فعّال على هذا
                  العقد
                </strong>

                <span>
                  بدأ في:{" "}
                  {formatDateTime(
                    contract.default_declared_at
                  )}
                </span>

                <span>
                  ينتهي في:{" "}
                  {formatDateTime(
                    contract.default_expires_at
                  )}
                </span>
              </section>
            )}

            {!hasActiveDefault &&
              !isLate && (
                <section
                  style={
                    notEligibleBox
                  }
                >
                  <strong>
                    العقد غير مؤهل
                    لإعلان التعثر
                  </strong>

                  {!dueDate && (
                    <span>
                      تاريخ الاستحقاق
                      غير صحيح أو غير
                      مسجل.
                    </span>
                  )}

                  {dueDate &&
                    daysAfterDue !==
                      null &&
                    daysAfterDue <
                      7 && (
                      <span>
                        لا يظهر إعلان
                        التعثر إلا بعد
                        مرور 7 أيام
                        كاملة على تاريخ
                        الاستحقاق.
                      </span>
                    )}

                  {isFullyPaid && (
                    <span>
                      العقد مسدد
                      بالكامل.
                    </span>
                  )}

                  {isClosedOrCancelled &&
                    !isFullyPaid && (
                      <span>
                        العقد مغلق أو
                        ملغي.
                      </span>
                    )}
                </section>
              )}

            {!hasActiveDefault &&
              isLate && (
                <form
                  style={formCard}
                  onSubmit={
                    submitDefault
                  }
                >
                  <h2
                    style={
                      sectionTitle
                    }
                  >
                    بيانات إعلان
                    التعثر
                  </h2>

                  <label
                    style={
                      fieldLabel
                    }
                  >
                    سبب إعلان التعثر
                    <span
                      style={
                        requiredMark
                      }
                    >
                      *
                    </span>
                  </label>

                  <textarea
                    value={reason}
                    onChange={(
                      event
                    ) =>
                      setReason(
                        event.target
                          .value
                      )
                    }
                    placeholder="اكتب سبب إعلان التعثر بشكل واضح"
                    maxLength={500}
                    rows={5}
                    style={textarea}
                    disabled={
                      submitting
                    }
                  />

                  <div
                    style={
                      fieldCounter
                    }
                  >
                    {reason.length} /
                    500
                  </div>

                  <label
                    style={
                      fieldLabel
                    }
                  >
                    ملاحظات إضافية
                    <span
                      style={
                        optionalText
                      }
                    >
                      اختياري
                    </span>
                  </label>

                  <textarea
                    value={notes}
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="أضف أي ملاحظات داخلية عند الحاجة"
                    maxLength={1000}
                    rows={4}
                    style={textarea}
                    disabled={
                      submitting
                    }
                  />

                  <div
                    style={
                      fieldCounter
                    }
                  >
                    {notes.length} /
                    1000
                  </div>

                  <section
                    style={
                      warningBox
                    }
                  >
                    <strong>
                      تنبيه
                    </strong>

                    <span>
                      سيظهر العقد في
                      التحقق بوضع
                      «متعثر» لمدة 6
                      أشهر من وقت
                      التأكيد.
                    </span>

                    <span>
                      سبب التعثر
                      والملاحظات لا
                      يظهران في صفحة
                      التحقق.
                    </span>
                  </section>

                  {formError && (
                    <div
                      style={
                        formErrorBox
                      }
                    >
                      {formError}
                    </div>
                  )}

                  <div
                    style={
                      formActions
                    }
                  >
                    <button
                      type="submit"
                      style={
                        declareButton
                      }
                      disabled={
                        !canSubmit
                      }
                    >
                      {submitting
                        ? "جاري إعلان التعثر..."
                        : "تأكيد إعلان التعثر"}
                    </button>

                    <button
                      type="button"
                      style={
                        cancelFormButton
                      }
                      onClick={() =>
                        router.back()
                      }
                      disabled={
                        submitting
                      }
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
          </>
        )}

        <div
          style={backWrapper}
        >
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

      <GlobalResponsiveStyles />
    </main>
  );
}

function PageHero({
  screen,
  employeeName,
  title,
  onLogout,
  onHome,
}: {
  screen: ScreenType;
  employeeName: string;
  title: string;
  onLogout: () => void;
  onHome: () => void;
}) {
  const isMobile =
    screen === "mobile";

  return (
    <header
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

            {!isMobile && (
              <div
                style={
                  employeeDividerSmall
                }
              />
            )}

            <button
              type="button"
              style={
                logoutInlineButton
              }
              onClick={onLogout}
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
            style={getTitleStyle(
              screen
            )}
          >
            {title}
          </h1>
        </div>

        <div
          style={getHeroActionBoxStyle(
            screen
          )}
        >
          <span
            style={
              defaultStatusBadge
            }
          >
            إعلان تعثر
          </span>
        </div>
      </div>
    </header>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={card}>
      <h2
        style={sectionTitle}
      >
        {title}
      </h2>

      {children}
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  return (
    <div style={row}>
      <span>{label}</span>

      <strong
        style={rowValue}
      >
        {value || "-"}
      </strong>
    </div>
  );
}

function SummaryBox({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div style={summaryBox}>
      <span>{title}</span>

      <strong>{value}</strong>
    </div>
  );
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error instanceof Error
  ) {
    return (
      error.message ||
      fallback
    );
  }

  if (
    typeof error ===
    "string"
  ) {
    return error || fallback;
  }

  return fallback;
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

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        overflow-x: hidden;
      }

      button,
      textarea {
        -webkit-tap-highlight-color: transparent;
      }

      button:disabled {
        cursor: not-allowed !important;
        opacity: 0.6;
      }

      textarea:focus {
        outline: none;
        border-color: #2563eb !important;
        box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
      }

      @media (max-width: 640px) {
        .declare-form-actions {
          flex-direction: column !important;
        }

        .declare-form-actions button {
          width: 100% !important;
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
    backgroundPosition:
      "center",
    backgroundAttachment:
      isMobile
        ? "scroll"
        : "fixed",
    padding:
      isMobile ? 10 : 18,
    fontFamily:
      "var(--font-almarai), sans-serif",
    color: "#0f172a",
  };
}

function getContainerStyle(
  isCompact: boolean
): CSSProperties {
  return {
    width: "100%",
    maxWidth:
      isCompact ? 980 : 1180,
    margin: "auto",
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",
    minHeight:
      isMobile ? "auto" : 160,
    borderRadius:
      isMobile ? 20 : 24,
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
  if (
    screen === "mobile"
  ) {
    return {
      position: "relative",
      zIndex: 3,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent:
        "center",
      gap: 16,
      direction: "rtl",
    };
  }

  if (
    screen === "tablet"
  ) {
    return {
      position: "relative",
      zIndex: 3,
      display: "grid",
      gridTemplateColumns:
        "1fr",
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
  if (
    screen === "mobile"
  ) {
    return {
      width: "100%",
      display: "grid",
      gap: 12,
      direction: "rtl",
      justifyItems: "center",
      order: 2,
    };
  }

  if (
    screen === "tablet"
  ) {
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
  if (
    screen === "mobile"
  ) {
    return {
      minHeight: 42,
      display: "flex",
      alignItems: "center",
      justifyContent:
        "center",
      flexWrap: "wrap",
      gap: 10,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  return {
    height: 42,
    display: "flex",
    alignItems: "center",
    justifyContent:
      screen === "tablet"
        ? "center"
        : "flex-start",
    gap: 14,
    direction:
      screen === "tablet"
        ? "rtl"
        : "ltr",
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
      isMobile ? 15 : 17,
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
      isMobile ? "100%" : 220,
    maxWidth:
      isMobile ? 280 : 220,
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
    justifyContent:
      "center",
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
    justifyContent:
      "center",
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
    fontFamily:
      "var(--font-almarai), sans-serif",
    fontSize:
      screen === "mobile"
        ? 24
        : screen === "tablet"
          ? 26
          : 28,
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
      display: "flex",
      justifyContent:
        "center",
      alignItems: "center",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    justifyContent:
      "center",
    alignItems: "flex-end",
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
  justifyContent:
    "center",
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

const defaultStatusBadge: CSSProperties = {
  background:
    "rgba(127,29,29,0.88)",
  color: "#ffffff",
  border:
    "1px solid rgba(255,255,255,0.28)",
  borderRadius: 999,
  padding: "8px 15px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const inlineLoadingBox: CSSProperties = {
  background: "#eff6ff",
  border:
    "1px solid #bfdbfe",
  borderRadius: 14,
  padding: "12px 15px",
  marginBottom: 14,
  textAlign: "center",
  color: "#1d4ed8",
  fontWeight: 900,
};

const inlineErrorBox: CSSProperties = {
  background: "#fff7ed",
  border:
    "1px solid #fed7aa",
  borderRadius: 14,
  padding: 14,
  marginBottom: 14,
  color: "#9a3412",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const retryButton: CSSProperties = {
  minHeight: 38,
  padding: "8px 14px",
  border: "none",
  borderRadius: 10,
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const emptyContractBox: CSSProperties = {
  background: "#ffffff",
  border:
    "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 24,
  marginBottom: 16,
  textAlign: "center",
  color: "#64748b",
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
  background: "#ffffff",
  border:
    "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent:
    "space-between",
  gap: 12,
  color: "#0d47a1",
  fontWeight: 900,
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const card: CSSProperties = {
  background: "#ffffff",
  border:
    "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const formCard: CSSProperties = {
  ...card,
  maxWidth: 860,
  marginLeft: "auto",
  marginRight: "auto",
};

const sectionTitle: CSSProperties = {
  marginTop: 0,
  marginBottom: 18,
  fontSize: 22,
  color: "#0d47a1",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const row: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom:
    "1px solid #eef2f7",
  flexWrap: "wrap",
};

const rowValue: CSSProperties = {
  textAlign: "left",
};

const existingDefaultBox: CSSProperties = {
  background: "#fef2f2",
  border:
    "1px solid #fecaca",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  color: "#991b1b",
  display: "grid",
  gap: 10,
  fontWeight: 800,
};

const notEligibleBox: CSSProperties = {
  background: "#fff7ed",
  border:
    "1px solid #fed7aa",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  color: "#9a3412",
  display: "grid",
  gap: 10,
  fontWeight: 800,
};

const fieldLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  marginTop: 14,
  marginBottom: 8,
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 900,
};

const requiredMark: CSSProperties = {
  color: "#dc2626",
};

const optionalText: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
};

const textarea: CSSProperties = {
  width: "100%",
  resize: "vertical",
  border:
    "1px solid #cbd5e1",
  borderRadius: 14,
  padding: "13px 14px",
  fontSize: 15,
  lineHeight: 1.8,
  color: "#0f172a",
  background: "#ffffff",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const fieldCounter: CSSProperties = {
  marginTop: 5,
  textAlign: "left",
  color: "#64748b",
  fontSize: 12,
  direction: "ltr",
};

const warningBox: CSSProperties = {
  background: "#fff7ed",
  border:
    "1px solid #fed7aa",
  borderRadius: 14,
  padding: 15,
  marginTop: 18,
  color: "#9a3412",
  display: "grid",
  gap: 8,
  fontSize: 14,
  lineHeight: 1.8,
};

const formErrorBox: CSSProperties = {
  background: "#fef2f2",
  border:
    "1px solid #fecaca",
  color: "#991b1b",
  borderRadius: 12,
  padding: 13,
  marginTop: 16,
  fontWeight: 900,
};

const formActions: CSSProperties = {
  display: "flex",
  justifyContent:
    "center",
  alignItems: "center",
  gap: 12,
  marginTop: 20,
  flexWrap: "wrap",
};

const declareButton: CSSProperties = {
  minWidth: 220,
  minHeight: 48,
  border: "none",
  borderRadius: 13,
  padding: "11px 18px",
  background:
    "linear-gradient(135deg,#dc2626,#991b1b)",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 8px 18px rgba(153,27,27,0.20)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const cancelFormButton: CSSProperties = {
  minWidth: 130,
  minHeight: 48,
  border:
    "1px solid #cbd5e1",
  borderRadius: 13,
  padding: "11px 18px",
  background: "#ffffff",
  color: "#475569",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent:
    "center",
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
