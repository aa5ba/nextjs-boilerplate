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
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  logoutFinanceUser,
  renewFinanceSession,
  validateFinanceSession,
} from "@/lib/financeSession";

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

function normalizeDateInput(value: string) {
  return normalizeNumber(value)
    .trim()
    .replace(/[./]/g, "-")
    .replace(/\s+/g, "");
}

function toIsoDateOnly(value: string) {
  const normalized = normalizeDateInput(value);

  return normalized.includes("T")
    ? normalized.slice(0, 10)
    : normalized;
}

const PAYMENT_METHODS = [
  "نقدًا",
  "تحويل بنكي",
  "شبكة / مدى",
  "من الصندوق",
  "من حساب بنكي",
  "أخرى",
];

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type ProcessingStatus =
  | "pending"
  | "processed";

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

type FieldProps = {
  label: string;
  children: ReactNode;
};

function normalizeNumber(value: string) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(arabicDigits.indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(persianDigits.indexOf(digit))
    )
    .replace(/٬/g, "")
    .replace(/,/g, "")
    .replace(/٫/g, ".")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1");
}

function toNumber(value: string) {
  const normalized = normalizeNumber(value);

  return Number(normalized);
}

function splitPaymentMethod(
  storedPaymentMethod: string | null
) {
  const value = String(
    storedPaymentMethod || ""
  ).trim();

  if (!value) {
    return {
      method: "نقدًا",
      source: "",
    };
  }

  const directMethod = PAYMENT_METHODS.find(
    (method) => method === value
  );

  if (directMethod) {
    return {
      method: directMethod,
      source: "",
    };
  }

  for (const method of PAYMENT_METHODS) {
    const prefix = `${method} - `;

    if (value.startsWith(prefix)) {
      return {
        method,
        source: value.slice(prefix.length),
      };
    }
  }

  return {
    method: "أخرى",
    source: value,
  };
}

export default function EditExpenseInvoicePage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(
    params.branch ?? ""
  )
    .trim()
    .toLowerCase();

  const invoiceId = String(
    params.id ?? ""
  ).trim();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [authChecked, setAuthChecked] =
    useState(false);

  const [accessDenied, setAccessDenied] =
    useState(false);

  const [loadingInvoice, setLoadingInvoice] =
    useState(true);

  const [loadError, setLoadError] =
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

  const [invoice, setInvoice] =
    useState<ExpenseInvoice | null>(null);

  const [invoiceTitle, setInvoiceTitle] =
    useState("");

  const [invoiceAmount, setInvoiceAmount] =
    useState("");

  const [invoiceDate, setInvoiceDate] =
    useState("");

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

  const canEditAll = useMemo(() => {
    return (
      isManager ||
      permissions.includes(
        EXPENSE_PERMISSIONS.EDIT_ALL
      )
    );
  }, [isManager, permissions]);

  const canEditOwn = useMemo(() => {
    return permissions.includes(
      EXPENSE_PERMISSIONS.EDIT_OWN
    );
  }, [permissions]);

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
          String(
            sessionUser.role || ""
          ).trim();

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

        const hasEditPermission =
          manager ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.EDIT_ALL
          ) ||
          userPermissions.includes(
            EXPENSE_PERMISSIONS.EDIT_OWN
          );

        setEmployeeName(name);
        setBranchId(sessionBranchId);
        setCurrentUserId(
          String(sessionUser.id || "")
        );
        setRole(userRole);
        setPermissions(userPermissions);

        if (!hasEditPermission) {
          setAccessDenied(true);
          setLoadingInvoice(false);
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
          // لا تنتهي الجلسة بسبب خطأ الشبكة.
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
          // المتتبع لا يمنع فتح الصفحة.
        }

        setAuthChecked(true);
      } catch {
        if (cancelled) return;

        setLoadError(
          "تعذر التحقق من الجلسة مؤقتًا. تحقق من الاتصال ثم أعد المحاولة."
        );

        setLoadingInvoice(false);
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

  useEffect(() => {
    let cancelled = false;

    async function loadInvoice() {
      if (
        !authChecked ||
        accessDenied ||
        !branchId ||
        !invoiceId
      ) {
        return;
      }

      setLoadingInvoice(true);
      setLoadError("");

      const { data, error } =
        await supabase
          .from(
            "finance_expense_invoices"
          )
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
            `
          )
          .eq("id", invoiceId)
          .eq("branch_id", branchId)
          .maybeSingle();

      if (cancelled) return;

      if (error) {
        setLoadError(
          `تعذر تحميل الفاتورة: ${error.message}`
        );
        setLoadingInvoice(false);
        return;
      }

      if (!data) {
        setLoadError(
          "الفاتورة غير موجودة داخل هذا الفرع."
        );
        setLoadingInvoice(false);
        return;
      }

      const loadedInvoice =
        data as ExpenseInvoice;

      const isOwner =
        Boolean(currentUserId) &&
        loadedInvoice.created_by_user_id ===
          currentUserId;

      const allowed =
        canEditAll ||
        (canEditOwn && isOwner);

      if (!allowed) {
        setAccessDenied(true);
        setLoadingInvoice(false);
        return;
      }

      const payment =
        splitPaymentMethod(
          loadedInvoice.payment_method
        );

      setInvoice(loadedInvoice);
      setInvoiceTitle(
        loadedInvoice.invoice_title
      );
      setInvoiceAmount(
        String(
          loadedInvoice.invoice_amount ?? ""
        )
      );
      setInvoiceDate(
        toIsoDateOnly(
          loadedInvoice.invoice_date
        )
      );
      setPaymentMethod(payment.method);
      setPaymentSource(payment.source);
      setInvoiceDetails(
        loadedInvoice.invoice_details || ""
      );

      setLoadingInvoice(false);
    }

    loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [
    authChecked,
    accessDenied,
    branchId,
    invoiceId,
    currentUserId,
    canEditAll,
    canEditOwn,
  ]);

  function validateForm() {
    const amount =
      toNumber(invoiceAmount);

    if (!branchId) {
      return "تعذر تحديد فرع المستخدم.";
    }

    if (!currentUserId) {
      return "تعذر تحديد المستخدم الحالي.";
    }

    if (!invoice) {
      return "تعذر تحديد الفاتورة.";
    }

    if (
      invoice.branch_id !== branchId
    ) {
      return "لا يمكن تعديل فاتورة من فرع آخر.";
    }

    if (!invoiceTitle.trim()) {
      return "يرجى إدخال عنوان الفاتورة.";
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return "يرجى إدخال مبلغ صحيح أكبر من صفر.";
    }

    if (!invoiceDate) {
      return "يرجى تحديد تاريخ الفاتورة.";
    }

    if (!paymentMethod.trim()) {
      return "يرجى تحديد طريقة السداد.";
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

    if (
      !branchId ||
      !currentUserId ||
      !invoice
    ) {
      return;
    }

    const finalPaymentMethod =
      paymentSource.trim()
        ? `${paymentMethod} - ${paymentSource.trim()}`
        : paymentMethod;

    try {
      setSaving(true);

      const { data, error } =
        await supabase.rpc(
          "update_expense_invoice_atomic",
          {
            p_branch_id: branchId,
            p_invoice_id: invoice.id,
            p_actor_user_id:
              currentUserId,
            p_invoice_title:
              invoiceTitle.trim(),
            p_invoice_amount:
              toNumber(invoiceAmount),
            p_invoice_details:
              invoiceDetails.trim() ||
              null,
            p_invoice_date:
              invoiceDate,
            p_payment_method:
              finalPaymentMethod,
          }
        );

      if (error) throw error;

      if (
        !Array.isArray(data) ||
        data.length === 0
      ) {
        throw new Error(
          "لم يتم تحديث الفاتورة."
        );
      }

      alert(
        "تم تعديل الفاتورة بنجاح."
      );

      router.push(
        `/finance/${branch}/expenses`
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تعديل الفاتورة.";

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

  function formatDateTime(
    value: string | null
  ) {
    if (!value) return "—";

    const date = new Date(value);

    if (
      Number.isNaN(date.getTime())
    ) {
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
              لا تملك صلاحية تعديل هذه
              الفاتورة.
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
                تعديل الفاتورة
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
              onClick={() =>
                router.refresh()
              }
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {loadingInvoice ? (
          <div style={centerStatusCard}>
            جاري تحميل بيانات الفاتورة...
          </div>
        ) : !invoice ? (
          <div style={centerStatusCard}>
            تعذر العثور على الفاتورة.
          </div>
        ) : (
          <section style={card}>
            <div style={sectionHeader}>
              <h2 style={sectionTitle}>
                بيانات الفاتورة
              </h2>

              <span
                style={
                  invoice.processing_status ===
                  "processed"
                    ? processedBadge
                    : pendingBadge
                }
              >
                {invoice.processing_status ===
                "processed"
                  ? "✓ تمت المعالجة"
                  : "قيد الانتظار"}
              </span>
            </div>

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
                style={{
                  ...input,
                  opacity:
                    canManagePaymentSource
                      ? 1
                      : 0.7,
                }}
                value={paymentSource}
                maxLength={180}
                disabled={
                  !canManagePaymentSource
                }
                onChange={(event) =>
                  setPaymentSource(
                    event.target.value
                  )
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
              />
            </Field>

            <div style={invoiceInfoGrid}>
              <div style={infoBox}>
                <span style={infoLabel}>
                  منشئ الفاتورة
                </span>

                <strong style={infoValue}>
                  {invoice.created_by_name ||
                    "مستخدم"}
                </strong>
              </div>

              <div style={infoBox}>
                <span style={infoLabel}>
                  تاريخ الإنشاء
                </span>

                <strong style={infoValue}>
                  {formatDateTime(
                    invoice.created_at
                  )}
                </strong>
              </div>

              {invoice.processing_status ===
                "processed" && (
                <>
                  <div style={infoBox}>
                    <span
                      style={infoLabel}
                    >
                      تمت المعالجة بواسطة
                    </span>

                    <strong
                      style={infoValue}
                    >
                      {invoice.processed_by_name ||
                        "مستخدم"}
                    </strong>
                  </div>

                  <div style={infoBox}>
                    <span
                      style={infoLabel}
                    >
                      تاريخ المعالجة
                    </span>

                    <strong
                      style={infoValue}
                    >
                      {formatDateTime(
                        invoice.processed_at
                      )}
                    </strong>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              style={{
                ...saveButton,
                opacity: saving
                  ? 0.65
                  : 1,
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
              }}
              disabled={saving}
              onClick={saveInvoice}
            >
              {saving
                ? "جاري حفظ التعديلات..."
                : "حفظ التعديلات"}
            </button>
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
    maxWidth: isCompact
      ? 980
      : 1000,
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

const sectionHeader: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
};

const sectionTitle: CSSProperties = {
  margin: 0,
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

const invoiceInfoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(210px,1fr))",
  gap: 10,
  marginBottom: 16,
};

const infoBox: CSSProperties = {
  padding: 13,
  borderRadius: 13,
  border:
    "1px solid #e2e8f0",
  background: "#f8fafc",
};

const infoLabel: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 6,
};

const infoValue: CSSProperties = {
  color: "#334155",
  fontSize: 14,
  fontWeight: 900,
};

const processedBadge: CSSProperties = {
  minHeight: 31,
  padding: "0 11px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  border:
    "1px solid #86efac",
  display: "inline-flex",
  alignItems: "center",
  fontSize: 12,
  fontWeight: 900,
};

const pendingBadge: CSSProperties = {
  minHeight: 31,
  padding: "0 11px",
  borderRadius: 999,
  background: "#fff7ed",
  color: "#c2410c",
  border:
    "1px solid #fed7aa",
  display: "inline-flex",
  alignItems: "center",
  fontSize: 12,
  fontWeight: 900,
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

const errorBox: CSSProperties = {
  marginBottom: 14,
  padding: 14,
  borderRadius: 15,
  background: "#fff7ed",
  border:
    "1px solid #fed7aa",
  color: "#9a3412",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
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
