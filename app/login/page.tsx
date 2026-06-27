"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import type { CSSProperties } from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  clearFinanceSession,
  getSavedFinanceReturnPath,
  isSafeFinanceReturnPath,
  normalizeFinanceReturnPath,
  readFinanceSession,
  removeFinanceReturnPath,
  saveFinanceSession,
  validateFinanceSession,
} from "@/lib/financeSession";
import type { FinanceSessionUser } from "@/lib/financeSession";

type CustomerSession = {
  id: string;
  full_name: string;
  phone: string;
  work_sector: string;
};

type FinanceLoginResult = {
  id: string;
  full_name: string | null;
  username: string | null;
  role: string | null;
  branch_id: string;
  branch_slug: string | null;
  branch_name: string | null;
  organization_name: string | null;
  permissions: unknown;
  manageable_permissions?: unknown;
  investor_id: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
  phone?: string | null;
  theme_key?: string | null;
  session_version?: number | string | null;
  permissions_version?: number | string | null;
};

type CustomerLoginResult = {
  id: string;
  full_name: string | null;
  phone: string | null;
  work_sector: string | null;
};

type MessageState = {
  type: "success" | "error";
  text: string;
} | null;

const CUSTOMER_SESSION_KEYS = [
  "customer_user",
  "customer_id",
  "customer_name",
  "customer_phone",
  "customer_sector",
] as const;

const FINANCE_PASSWORD_CHANGED_MESSAGE_KEY =
  "finance_password_changed_message";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loginIdentifier, setLoginIdentifier] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    checkingExistingSession,
    setCheckingExistingSession,
  ] = useState(true);

  const [message, setMessage] =
    useState<MessageState>(null);

  useEffect(() => {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    const successMessage =
      sessionStorage.getItem(
        FINANCE_PASSWORD_CHANGED_MESSAGE_KEY
      );

    if (successMessage) {
      setMessage({
        type: "success",
        text: successMessage,
      });

      sessionStorage.removeItem(
        FINANCE_PASSWORD_CHANGED_MESSAGE_KEY
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    function checkExistingFinanceSession() {
      if (
        typeof window === "undefined"
      ) {
        return;
      }

      const storedSession =
        readFinanceSession();

      if (!storedSession) {
        if (!cancelled) {
          setCheckingExistingSession(
            false
          );
        }

        return;
      }

      const validation =
        validateFinanceSession(
          storedSession.branch_slug
        );

      if (
        !validation.valid ||
        !validation.user
      ) {
        clearFinanceSession({
          preserveReturnPath: true,
        });

        if (!cancelled) {
          setCheckingExistingSession(
            false
          );
        }

        return;
      }

      const branchSlug =
        validation.user.branch_slug.trim();

      if (!branchSlug) {
        clearFinanceSession({
          preserveReturnPath: true,
        });

        if (!cancelled) {
          setCheckingExistingSession(
            false
          );
        }

        return;
      }

      const destination =
        getRequestedFinanceReturnPath(
          branchSlug
        ) ||
        `/finance/${branchSlug}`;

      removeFinanceReturnPath();

      router.prefetch(destination);
      router.replace(destination);
    }

    checkExistingFinanceSession();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  function clearCustomerSession() {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    CUSTOMER_SESSION_KEYS.forEach(
      (key) => {
        localStorage.removeItem(key);
      }
    );
  }

  function saveCustomerSession(
    customerUser: CustomerSession
  ) {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    localStorage.setItem(
      "customer_user",
      JSON.stringify(customerUser)
    );

    localStorage.setItem(
      "customer_id",
      customerUser.id
    );

    localStorage.setItem(
      "customer_name",
      customerUser.full_name
    );

    localStorage.setItem(
      "customer_phone",
      customerUser.phone
    );

    localStorage.setItem(
      "customer_sector",
      customerUser.work_sector
    );
  }

  function normalizePermissions(
    value: unknown
  ): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .filter(
            (
              permission
            ): permission is string =>
              typeof permission ===
              "string"
          )
          .map((permission) =>
            permission.trim()
          )
          .filter(Boolean)
      )
    );
  }

  function normalizeVersion(
    value: unknown
  ) {
    const parsed = Number(value);

    if (
      !Number.isFinite(parsed) ||
      parsed < 0
    ) {
      return 0;
    }

    return Math.floor(parsed);
  }

  function getFinanceLoginResult(
    data: unknown
  ): FinanceLoginResult | null {
    const result =
      Array.isArray(data)
        ? data[0]
        : data;

    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      return null;
    }

    return result as FinanceLoginResult;
  }

  function getCustomerLoginResult(
    data: unknown
  ): CustomerLoginResult | null {
    const result =
      Array.isArray(data)
        ? data[0]
        : data;

    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      return null;
    }

    return result as CustomerLoginResult;
  }

  function getRequestedFinanceReturnPath(
    branchSlug: string
  ) {
    if (
      typeof window === "undefined"
    ) {
      return "";
    }

    const queryReturnTo =
      normalizeFinanceReturnPath(
        searchParams.get("returnTo")
      );

    if (
      queryReturnTo &&
      isSafeFinanceReturnPath(
        queryReturnTo,
        branchSlug
      )
    ) {
      return queryReturnTo;
    }

    return getSavedFinanceReturnPath(
      branchSlug
    );
  }

  async function handleBranchLogin(
    normalizedUsername: string,
    normalizedPassword: string
  ) {
    const { data, error } =
      await supabase.rpc(
        "verify_finance_branch_login",
        {
          p_username:
            normalizedUsername,
          p_password:
            normalizedPassword,
        }
      );

    if (error) {
      console.error(
        "Branch login RPC error:",
        error
      );

      throw new Error(
        "BRANCH_LOGIN_FAILED"
      );
    }

    const result =
      getFinanceLoginResult(data);

    if (!result) {
      setMessage({
        type: "error",
        text: "اسم المستخدم أو كلمة المرور غير صحيحة",
      });

      return;
    }

    if (
      !result.id ||
      !result.branch_id
    ) {
      setMessage({
        type: "error",
        text: "بيانات حساب الموظف غير مكتملة",
      });

      return;
    }

    const branchSlug = String(
      result.branch_slug || ""
    ).trim();

    if (!branchSlug) {
      setMessage({
        type: "error",
        text: "مسار الفرع غير مكتمل",
      });

      return;
    }

    const isActive =
      result.is_active !== false;

    if (!isActive) {
      setMessage({
        type: "error",
        text: "هذا الحساب معطل",
      });

      return;
    }

    const financeUser: FinanceSessionUser =
      {
        id: String(
          result.id
        ).trim(),

        full_name: String(
          result.full_name || ""
        ).trim(),

        username: String(
          result.username ||
            normalizedUsername
        ).trim(),

        role: String(
          result.role || ""
        ).trim(),

        branch_id: String(
          result.branch_id
        ).trim(),

        branch_slug: branchSlug,

        branch_name: String(
          result.branch_name || ""
        ).trim(),

        organization_name: String(
          result.organization_name ||
            ""
        ).trim(),

        permissions:
          normalizePermissions(
            result.permissions
          ),

        manageable_permissions:
          normalizePermissions(
            result.manageable_permissions
          ),

        investor_id:
          result.investor_id
            ? String(
                result.investor_id
              ).trim()
            : null,

        is_active: true,

        last_login_at:
          result.last_login_at
            ? String(
                result.last_login_at
              )
            : null,

        phone:
          result.phone
            ? String(
                result.phone
              ).trim()
            : null,

        theme_key:
          String(
            result.theme_key ||
              "professional"
          ).trim() ||
          "professional",

        session_version:
          normalizeVersion(
            result.session_version
          ),

        permissions_version:
          normalizeVersion(
            result.permissions_version
          ),
      };

    const returnPath =
      getRequestedFinanceReturnPath(
        financeUser.branch_slug
      );

    clearFinanceSession({
      preserveReturnPath: true,
    });

    clearCustomerSession();

    saveFinanceSession(
      financeUser,
      {
        preserveReturnPath: true,
      }
    );

    const destination =
      returnPath ||
      `/finance/${financeUser.branch_slug}`;

    removeFinanceReturnPath();

    router.prefetch(destination);
    router.replace(destination);
  }

  async function handleCustomerLogin(
    normalizedPhone: string,
    normalizedPassword: string
  ) {
    const { data, error } =
      await supabase.rpc(
        "verify_customer_login",
        {
          p_phone: normalizedPhone,
          p_password:
            normalizedPassword,
        }
      );

    if (error) {
      console.error(
        "Customer login RPC error:",
        error
      );

      throw new Error(
        "CUSTOMER_LOGIN_FAILED"
      );
    }

    const result =
      getCustomerLoginResult(data);

    if (!result) {
      setMessage({
        type: "error",
        text: "رقم الجوال أو كلمة المرور غير صحيحة",
      });

      return;
    }

    if (!result.id) {
      setMessage({
        type: "error",
        text: "بيانات حساب العميل غير مكتملة",
      });

      return;
    }

    clearFinanceSession();
    clearCustomerSession();

    const customerUser: CustomerSession =
      {
        id: String(result.id),

        full_name:
          result.full_name || "",

        phone:
          result.phone ||
          normalizedPhone,

        work_sector:
          result.work_sector || "",
      };

    saveCustomerSession(
      customerUser
    );

    router.prefetch("/customer");
    router.replace("/customer");
  }

  async function handleLogin() {
    if (
      loading ||
      checkingExistingSession
    ) {
      return;
    }

    setMessage(null);

    const normalizedIdentifier =
      loginIdentifier.trim();

    const normalizedPassword =
      password
        .replace(/\D/g, "")
        .slice(0, 8);

    const customerPhoneRegex =
      /^05\d{8}$/;

    const usernameRegex =
      /^[\u0600-\u06FFa-zA-Z0-9_.-]{2,35}$/;

    const customerPinRegex =
      /^\d{4}$/;

    const financePasswordRegex =
      /^\d{4,8}$/;

    if (!normalizedIdentifier) {
      setMessage({
        type: "error",
        text: "أدخل اسم المستخدم أو رقم الجوال",
      });

      return;
    }

    const isCustomerPhone =
      customerPhoneRegex.test(
        normalizedIdentifier
      );

    if (
      !isCustomerPhone &&
      !usernameRegex.test(
        normalizedIdentifier
      )
    ) {
      setMessage({
        type: "error",
        text: "اسم المستخدم أو رقم الجوال غير صحيح",
      });

      return;
    }

    if (
      isCustomerPhone &&
      !customerPinRegex.test(
        normalizedPassword
      )
    ) {
      setMessage({
        type: "error",
        text: "كلمة مرور العميل يجب أن تكون 4 أرقام",
      });

      return;
    }

    if (
      !isCustomerPhone &&
      !financePasswordRegex.test(
        normalizedPassword
      )
    ) {
      setMessage({
        type: "error",
        text: "كلمة المرور يجب أن تكون من 4 إلى 8 أرقام",
      });

      return;
    }

    setLoading(true);

    try {
      if (isCustomerPhone) {
        await handleCustomerLogin(
          normalizedIdentifier,
          normalizedPassword
        );
      } else {
        await handleBranchLogin(
          normalizedIdentifier,
          normalizedPassword
        );
      }
    } catch (loginError) {
      console.error(
        "Unified login error:",
        loginError
      );

      setMessage({
        type: "error",
        text: "حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى",
      });
    } finally {
      setLoading(false);
    }
  }

  if (checkingExistingSession) {
    return <LoginPageLoading />;
  }

  return (
    <div
      dir="rtl"
      style={page}
    >
      <div style={card}>
        <div style={logoBox}>
          <div style={logoCircle}>
            ا
          </div>

          <h1 style={title}>
            تسجيل الدخول
          </h1>

          <p style={subtitle}>
            برنامج احتساب
          </p>
        </div>

        <input
          placeholder="اسم المستخدم أو رقم الجوال"
          value={loginIdentifier}
          onChange={(event) => {
            setLoginIdentifier(
              event.target.value
            );

            if (
              message?.type ===
              "error"
            ) {
              setMessage(null);
            }
          }}
          style={inputStyle}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={loading}
        />

        <input
          placeholder="كلمة المرور"
          value={password}
          onChange={(event) => {
            const value =
              event.target.value
                .replace(/\D/g, "")
                .slice(0, 8);

            setPassword(value);

            if (
              message?.type ===
              "error"
            ) {
              setMessage(null);
            }
          }}
          style={inputStyle}
          inputMode="numeric"
          type="password"
          maxLength={8}
          autoComplete="current-password"
          disabled={loading}
          onKeyDown={(event) => {
            if (
              event.key === "Enter"
            ) {
              void handleLogin();
            }
          }}
        />

        <button
          type="button"
          onClick={() =>
            void handleLogin()
          }
          disabled={loading}
          style={{
            ...buttonStyle,
            cursor: loading
              ? "not-allowed"
              : "pointer",
            opacity: loading
              ? 0.75
              : 1,
          }}
        >
          {loading
            ? "جارٍ الدخول..."
            : "دخول"}
        </button>

        {message && (
          <p
            role={
              message.type ===
              "error"
                ? "alert"
                : "status"
            }
            style={{
              ...messageStyle,
              ...(message.type ===
              "success"
                ? successMessageStyle
                : errorMessageStyle),
            }}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

function LoginPageLoading() {
  return (
    <main
      dir="rtl"
      style={loadingPage}
    >
      <div style={loadingCard}>
        جاري تحميل صفحة الدخول...
      </div>
    </main>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.82)), url('/backgrounds/v13-finance-bg-2.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  boxSizing: "border-box",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 430,
  background:
    "rgba(255,255,255,0.96)",
  borderRadius: 24,
  padding: 24,
  boxSizing: "border-box",
  boxShadow:
    "0 20px 50px rgba(15,23,42,0.22)",
  border:
    "1px solid rgba(255,255,255,0.7)",
};

const logoBox: CSSProperties = {
  textAlign: "center",
  marginBottom: 22,
};

const logoCircle: CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: "50%",
  margin: "0 auto 12px",
  background: "#0f172a",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const title: CSSProperties = {
  margin: 0,
  fontSize: 28,
  color: "#0f172a",
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const subtitle: CSSProperties = {
  margin: "8px 0 22px",
  color: "#64748b",
  fontSize: 15,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 50,
  marginBottom: 14,
  borderRadius: 12,
  border:
    "1px solid #dbe3ef",
  padding: "0 15px",
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#0f172a",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const buttonStyle: CSSProperties = {
  width: "100%",
  height: 50,
  border: "none",
  borderRadius: 14,
  background: "#0f172a",
  color: "#ffffff",
  fontSize: 18,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const messageStyle: CSSProperties = {
  textAlign: "center",
  margin: "18px 0 0",
  padding: "11px 13px",
  borderRadius: 12,
  fontWeight: 900,
  lineHeight: 1.7,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const successMessageStyle: CSSProperties = {
  color: "#166534",
  background: "#f0fdf4",
  border:
    "1px solid #bbf7d0",
};

const errorMessageStyle: CSSProperties = {
  color: "#b91c1c",
  background: "#fef2f2",
  border:
    "1px solid #fecaca",
};

const loadingPage: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
  backgroundColor: "#f6f9ff",
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.82)), url('/backgrounds/v13-finance-bg-2.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const loadingCard: CSSProperties = {
  padding: "22px 28px",
  borderRadius: 18,
  background: "#ffffff",
  border:
    "1px solid #dbeafe",
  color: "#1e3a8a",
  fontSize: 15,
  fontWeight: 900,
  boxShadow:
    "0 12px 30px rgba(15,23,42,0.08)",
};
