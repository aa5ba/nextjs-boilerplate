"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  normalizeNumber,
  toNumber,
} from "@/lib/numberUtils";
import {
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  logoutFinanceUser,
  renewFinanceSession,
  validateFinanceSession,
} from "@/lib/financeSession";

const PAYMENT_METHODS = [
  "نقدًا",
  "تحويل بنكي",
  "شبكة / مدى",
  "من الصندوق",
  "من حساب بنكي",
  "أخرى",
];

const EXPENSE_PERMISSIONS = {
  PAGE_VIEW: "expenses",
  VIEW: "expenses_view",
  CREATE: "expenses_create",
  EDIT_OWN: "expenses_edit_own",
  EDIT_ALL: "expenses_edit_all",
  DELETE_OWN: "expenses_delete_own",
  DELETE_ALL: "expenses_delete_all",
  REPORTS: "expenses_reports",
  PAYMENT_SOURCES_MANAGE:
    "expenses_payment_sources_manage",
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

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function getTodayIsoDate() {
  const today = new Date();

  return `${today.getFullYear()}-${padNumber(
    today.getMonth() + 1
  )}-${padNumber(today.getDate())}`;
}

function normalizeDateInput(value: string) {
  return normalizeNumber(value)
    .trim()
    .replace(/[./]/g, "-")
    .replace(/\s+/g, "");
}

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

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

type FieldProps = {
  label: string;
  children: ReactNode;
};

export default function NewExpenseInvoicePage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "")
    .trim()
    .toLowerCase();

  const today = getTodayIsoDate();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [authChecked, setAuthChecked] =
    useState(false);

  const [accessDenied, setAccessDenied] =
    useState(false);

  const [sessionError, setSessionError] =
    useState("");

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

  const [invoiceTitle, setInvoiceTitle] =
    useState("");

  const [invoiceAmount, setInvoiceAmount] =
    useState("");

  const [invoiceDate, setInvoiceDate] =
    useState(today);

  const [paymentMethod, setPaymentMethod] =
    useState("نقدًا");

  const [paymentSource, setPaymentSource] =
    useState("");

  const [invoiceDetails, setInvoiceDetails] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const isManager = useMemo(() => {
    return MANAGER_ROLES.includes(role);
  }, [role]);

  const canCreateExpense = useMemo(() => {
    return (
      isManager ||
      permissions.includes(
        EXPENSE_PERMISSIONS.CREATE
      )
    );
  }, [isManager, permissions]);

  const canManagePaymentSource =
    useMemo(() => {
      return (
        isManager ||
        permissions.includes(
          EXPENSE_PERMISSIONS
            .PAYMENT_SOURCES_MANAGE
        )
      );
    }, [isManager, permissions]);

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
    let cancelled = false;
    let cleanupTracker:
      | undefined
      | (() => void);

    async function initializePage() {
      setAuthChecked(false);
      setAccessDenied(false);
      setSessionError("");

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

        const sessionBranchSlug =
          String(
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
          sessionUser.role !==
            "support_impersonation"
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

        const userRole =
          String(sessionUser.role || "")
            .trim();

        const userPermissions =
          Array.isArray(
            sessionUser.permissions
          )
            ? sessionUser.permissions.filter(
                (
                  item
                ): item is string =>
                  typeof item === "string"
              )
            : [];

        const manager =
          MANAGER_ROLES.includes(userRole);

        const allowed =
          manager ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.CREATE
          );

        setEmployeeName(name);
        setBranchId(sessionBranchId);
        setCurrentUserId(
          String(sessionUser.id || "")
        );
        setRole(userRole);
        setPermissions(userPermissions);

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
          // لا يتم إنهاء الجلسة بسبب خطأ شبكة.
        }

        try {
          const installTracker =
            installFinanceActivityTracker as unknown as () =>
              | void
              | (() => void);

          const trackerResult =
            installTracker();

          if (
            typeof trackerResult ===
            "function"
          ) {
            cleanupTracker =
              trackerResult;
          }
        } catch {
          // المتتبع لا يمنع الصفحة.
        }

        setAuthChecked(true);
      } catch {
        if (cancelled) return;

        setSessionError(
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

  function validateForm() {
    const amount =
      toNumber(invoiceAmount);

    if (!branchId) {
      return "تعذر تحديد فرع الموظف.";
    }

    if (!currentUserId) {
      return "تعذر تحديد حساب الموظف الحالي.";
    }

    if (!canCreateExpense) {
      return "ليست لديك صلاحية إنشاء فاتورة.";
    }

    if (!invoiceTitle.trim()) {
      return "يرجى إدخال عنوان الفاتورة.";
    }

    if (!invoiceAmount.trim()) {
      return "يرجى إدخال مبلغ الفاتورة.";
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return "يرجى إدخال مبلغ صحيح أكبر من صفر.";
    }

    if (!invoiceDate) {
      return "يرجى اختيار تاريخ الفاتورة.";
    }

    if (!paymentMethod.trim()) {
      return "يرجى اختيار طريقة السداد.";
    }

    return "";
  }

  async function saveInvoice() {
    if (saving) return;

    const validationMessage =
      validateForm();

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    if (!branchId || !currentUserId) {
      return;
    }

    try {
      setSaving(true);

      /*
       * لا يوجد حاليًا عمود payment_source مستقل،
       * لذلك يُدمج المصدر مع طريقة السداد.
       */
      const finalPaymentMethod =
        paymentSource.trim()
          ? `${paymentMethod} - ${paymentSource.trim()}`
          : paymentMethod;

      const { data, error } =
        await supabase
          .from(
            "finance_expense_invoices"
          )
          .insert({
            branch_id: branchId,
            invoice_title:
              invoiceTitle.trim(),
            invoice_amount:
              toNumber(invoiceAmount),
            invoice_details:
              invoiceDetails.trim() ||
              null,
            invoice_date: invoiceDate,
            payment_method:
              finalPaymentMethod,
            created_by_user_id:
              currentUserId,
            created_by_name:
              employeeName,
          })
          .select(
            "id, branch_id, created_by_user_id"
          )
          .single();

      if (error) throw error;

      if (
        !data ||
        data.branch_id !== branchId ||
        data.created_by_user_id !==
          currentUserId
      ) {
        throw new Error(
          "تمت إعادة نتيجة غير متوقعة أثناء حفظ الفاتورة."
        );
      }

      alert(
        "تم حفظ الفاتورة بنجاح."
      );

      router.push(
        `/finance/${branch}/expenses`
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء حفظ الفاتورة.";

      alert(message);
    } finally {
      setSaving(false);
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
      if (
        typeof window !== "undefined"
      ) {
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

  if (!authChecked) {
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
          <div style={centerStatusCard}>
            جاري التحقق من الجلسة...
          </div>
        </div>
      </main>
    );
  }

  if (sessionError && !branchId) {
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
          <div style={accessDeniedCard}>
            <div
              style={accessDeniedIcon}
            >
              ⚠️
            </div>

            <h1
              style={accessDeniedTitle}
            >
              تعذر فتح الصفحة
            </h1>

            <p style={accessDeniedText}>
              {sessionError}
            </p>

            <button
              type="button"
              style={backButton}
              onClick={() =>
                window.location.reload()
              }
            >
              إعادة المحاولة
            </button>
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
          style={getContainerStyle(
            isCompact
          )}
        >
          <div style={accessDeniedCard}>
            <div
              style={accessDeniedIcon}
            >
              ⛔
            </div>

            <h1
              style={accessDeniedTitle}
            >
              لا توجد صلاحية
            </h1>

            <p style={accessDeniedText}>
              لا تملك صلاحية إنشاء
              فواتير المصروفات والمشتريات.
            </p>

            <button
              type="button"
              style={backButton}
              onClick={() =>
                router.push(
                  `/finance/${branch}/expenses`
                )
              }
            >
              العودة إلى المصروفات
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
        style={getContainerStyle(
          isCompact
        )}
      >
        <header
          style={getHeroStyle(isMobile)}
        >
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
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
                  style={
                    logoutInlineButton
                  }
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
                style={getTitleStyle(
                  screen
                )}
              >
                إنشاء فاتورة جديدة
              </h1>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            />
          </div>
        </header>

        <section style={card}>
          <h2 style={sectionTitle}>
            بيانات الفاتورة
          </h2>

          <div style={formGrid}>
            <Field label="عنوان الفاتورة *">
              <input
                style={input}
                value={invoiceTitle}
                maxLength={180}
                onChange={(event) =>
                  setInvoiceTitle(
                    event.target.value
                  )
                }
                placeholder="مثال: شراء أدوات مكتبية"
              />
            </Field>

            <Field label="مبلغ الفاتورة *">
              <input
                style={input}
                inputMode="decimal"
                value={invoiceAmount}
                onChange={(event) =>
                  setInvoiceAmount(
                    normalizeNumber(
                      event.target.value
                    )
                  )
                }
                placeholder="مثال: 1500"
              />
            </Field>

            <Field label="تاريخ الفاتورة *">
              <input
                style={input}
                type="date"
                lang="en-CA"
                dir="ltr"
                value={invoiceDate}
                onChange={(event) =>
                  setInvoiceDate(
                    normalizeDateInput(
                      event.target.value
                    )
                  )
                }
              />
            </Field>

            <Field label="طريقة السداد *">
              <select
                style={input}
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value
                  )
                }
              >
                {PAYMENT_METHODS.map(
                  (method) => (
                    <option
                      key={method}
                      value={method}
                    >
                      {method}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>

          <Field label="مصدر السداد - اختياري">
            <input
              style={input}
              value={paymentSource}
              maxLength={180}
              onChange={(event) =>
                setPaymentSource(
                  event.target.value
                )
              }
              disabled={
                !canManagePaymentSource
              }
              placeholder={
                canManagePaymentSource
                  ? "مثال: صندوق الفرع، حساب الراجحي، حساب المؤسسة"
                  : "لا تملك صلاحية تحديد مصدر السداد"
              }
            />
          </Field>

          <Field label="تفاصيل الفاتورة">
            <textarea
              style={textarea}
              value={invoiceDetails}
              maxLength={4000}
              onChange={(event) =>
                setInvoiceDetails(
                  event.target.value
                )
              }
              placeholder="اكتب تفاصيل المصروف أو المشتريات..."
            />
          </Field>

          <div style={createdByBox}>
            <span>
              👤 سيتم تسجيل الفاتورة
              باسم:
            </span>

            <strong>
              {employeeName}
            </strong>
          </div>

          <button
            type="button"
            style={{
              ...saveButton,
              opacity: saving ? 0.65 : 1,
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
            onClick={saveInvoice}
            disabled={saving}
          >
            {saving
              ? "جاري حفظ الفاتورة..."
              : "حفظ الفاتورة"}
          </button>
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
    </main>
  );
}

function Field({
  label,
  children,
}: FieldProps) {
  return (
    <div style={fieldBox}>
      <label style={labelStyle}>
        {label}
      </label>

      {children}
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
    maxWidth: isCompact ? 980 : 1000,
    margin: "auto",
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile
      ? "auto"
      : 160,
    borderRadius: isMobile
      ? 20
      : 24,
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
    gap: screen === "mobile"
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
    fontSize: isMobile
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
    width: isMobile
      ? "100%"
      : 220,
    maxWidth: isMobile
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
      }
    : {
        display: "none",
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
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color:
    "rgba(255,255,255,0.92)",
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
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const card: CSSProperties = {
  background: "#ffffff",
  border:
    "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 18,
  boxShadow:
    "0 10px 24px rgba(15,23,42,0.05)",
};

const sectionTitle: CSSProperties = {
  margin:
    "0 0 16px",
  color: "#0f172a",
  fontSize: 19,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(230px,1fr))",
  gap: 14,
};

const fieldBox: CSSProperties = {
  marginBottom: 14,
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
  minHeight: 50,
  padding: "0 14px",
  borderRadius: 14,
  border:
    "1px solid #dbe3ef",
  fontSize: 16,
  boxSizing: "border-box",
  background: "#f8fafc",
  fontFamily:
    "var(--font-almarai), sans-serif",
  color: "#0f172a",
};

const textarea: CSSProperties = {
  width: "100%",
  minHeight: 120,
  padding: 14,
  borderRadius: 14,
  border:
    "1px solid #dbe3ef",
  fontSize: 16,
  boxSizing: "border-box",
  background: "#f8fafc",
  resize: "vertical",
  fontFamily:
    "var(--font-almarai), sans-serif",
  color: "#0f172a",
};

const createdByBox: CSSProperties = {
  background: "#f8fafc",
  border:
    "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  color: "#475569",
  marginBottom: 14,
};

const saveButton: CSSProperties = {
  width: "100%",
  minHeight: 52,
  padding: "13px 16px",
  background:
    "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const centerStatusCard: CSSProperties = {
  margin: "80px auto",
  maxWidth: 460,
  background: "#ffffff",
  border:
    "1px solid #e2e8f0",
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
  border:
    "1px solid #e2e8f0",
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
