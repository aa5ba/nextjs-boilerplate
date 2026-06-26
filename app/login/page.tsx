"use client";

import { Suspense, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type FinanceUserSession = {
  id: string;
  full_name: string;
  username: string;
  role: string;
  branch_id: string;
  branch_slug: string;
  branch_name: string;
  organization_name: string;
  permissions: string[];
  investor_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
};

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
  investor_id: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
};

type CustomerLoginResult = {
  id: string;
  full_name: string | null;
  phone: string | null;
  work_sector: string | null;
};

const SESSION_DURATION_MS = 60 * 60 * 1000;

const FINANCE_SESSION_KEYS = [
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

const CUSTOMER_SESSION_KEYS = [
  "customer_user",
  "customer_id",
  "customer_name",
  "customer_phone",
  "customer_sector",
] as const;

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

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function clearFinanceSession({
    preserveReturnPath = false,
  }: {
    preserveReturnPath?: boolean;
  } = {}) {
    if (typeof window === "undefined") {
      return;
    }

    FINANCE_SESSION_KEYS.forEach((key) => {
      if (preserveReturnPath && key === "finance_return_to") {
        return;
      }

      localStorage.removeItem(key);
    });
  }

  function clearCustomerSession() {
    if (typeof window === "undefined") {
      return;
    }

    CUSTOMER_SESSION_KEYS.forEach((key) => {
      localStorage.removeItem(key);
    });
  }

  function saveFinanceSession(financeUser: FinanceUserSession) {
    if (typeof window === "undefined") {
      return;
    }

    const serializedUser = JSON.stringify(financeUser);

    localStorage.setItem("finance_user", serializedUser);
    localStorage.setItem("finance_branch_user", serializedUser);
    localStorage.setItem("finance_user_id", financeUser.id);
    localStorage.setItem("finance_user_name", financeUser.full_name);
    localStorage.setItem("finance_username", financeUser.username);
    localStorage.setItem("finance_role", financeUser.role);
    localStorage.setItem("finance_branch_id", financeUser.branch_id);
    localStorage.setItem("finance_branch_slug", financeUser.branch_slug);
    localStorage.setItem("finance_branch_name", financeUser.branch_name);

    localStorage.setItem(
      "finance_organization_name",
      financeUser.organization_name
    );

    localStorage.setItem(
      "finance_permissions",
      JSON.stringify(financeUser.permissions)
    );

    localStorage.setItem(
      "finance_investor_id",
      financeUser.investor_id || ""
    );

    localStorage.setItem(
      "finance_is_active",
      financeUser.is_active ? "true" : "false"
    );

    localStorage.setItem(
      "finance_last_login_at",
      financeUser.last_login_at || ""
    );

    const now = Date.now();

    localStorage.setItem("finance_last_activity_at", String(now));

    localStorage.setItem(
      "finance_session_expires_at",
      String(now + SESSION_DURATION_MS)
    );
  }

  function saveCustomerSession(customerUser: CustomerSession) {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem("customer_user", JSON.stringify(customerUser));
    localStorage.setItem("customer_id", customerUser.id);
    localStorage.setItem("customer_name", customerUser.full_name);
    localStorage.setItem("customer_phone", customerUser.phone);
    localStorage.setItem("customer_sector", customerUser.work_sector);
  }

  function normalizePermissions(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(
      (permission): permission is string =>
        typeof permission === "string" &&
        permission.trim().length > 0
    );
  }

  function getFinanceLoginResult(
    data: unknown
  ): FinanceLoginResult | null {
    const result = Array.isArray(data) ? data[0] : data;

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
    const result = Array.isArray(data) ? data[0] : data;

    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      return null;
    }

    return result as CustomerLoginResult;
  }

  function normalizeReturnPath(value: string | null) {
    if (!value) {
      return "";
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return "";
    }

    try {
      return decodeURIComponent(trimmedValue);
    } catch {
      return trimmedValue;
    }
  }

  function isSafeFinanceReturnPath(
    value: string,
    branchSlug: string
  ) {
    if (!value || !branchSlug) {
      return false;
    }

    if (
      !value.startsWith("/") ||
      value.startsWith("//") ||
      value.includes("://") ||
      value.includes("\\")
    ) {
      return false;
    }

    const branchBasePath = `/finance/${branchSlug}`;

    return (
      value === branchBasePath ||
      value.startsWith(`${branchBasePath}/`) ||
      value.startsWith(`${branchBasePath}?`)
    );
  }

  function getFinanceReturnPath(branchSlug: string) {
    if (typeof window === "undefined") {
      return "";
    }

    const queryReturnTo = normalizeReturnPath(
      searchParams.get("returnTo")
    );

    const storedReturnTo = normalizeReturnPath(
      localStorage.getItem("finance_return_to")
    );

    if (isSafeFinanceReturnPath(queryReturnTo, branchSlug)) {
      return queryReturnTo;
    }

    if (isSafeFinanceReturnPath(storedReturnTo, branchSlug)) {
      return storedReturnTo;
    }

    return "";
  }

  async function handleBranchLogin(
    normalizedUsername: string,
    normalizedPassword: string
  ) {
    const { data, error } = await supabase.rpc(
      "verify_finance_branch_login",
      {
        p_username: normalizedUsername,
        p_password: normalizedPassword,
      }
    );

    if (error) {
      console.error("Branch login RPC error:", error);
      throw new Error("BRANCH_LOGIN_FAILED");
    }

    const result = getFinanceLoginResult(data);

    if (!result) {
      setMessage("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }

    if (!result.id || !result.branch_id) {
      setMessage("بيانات حساب الموظف غير مكتملة");
      return;
    }

    if (!result.branch_slug) {
      setMessage("مسار الفرع غير مكتمل");
      return;
    }

    const isActive = result.is_active !== false;

    if (!isActive) {
      setMessage("هذا الحساب معطل");
      return;
    }

    const financeUser: FinanceUserSession = {
      id: String(result.id),
      full_name: result.full_name || "",
      username: result.username || normalizedUsername,
      role: result.role || "",
      branch_id: String(result.branch_id),
      branch_slug: String(result.branch_slug),
      branch_name: result.branch_name || "",
      organization_name: result.organization_name || "",
      permissions: normalizePermissions(result.permissions),
      investor_id: result.investor_id
        ? String(result.investor_id)
        : null,
      is_active: isActive,
      last_login_at: result.last_login_at
        ? String(result.last_login_at)
        : null,
    };

    const returnPath = getFinanceReturnPath(
      financeUser.branch_slug
    );

    clearFinanceSession();
    clearCustomerSession();
    saveFinanceSession(financeUser);

    localStorage.removeItem("finance_return_to");

    if (returnPath) {
      router.replace(returnPath);
      return;
    }

    router.replace(`/finance/${financeUser.branch_slug}`);
  }

  async function handleCustomerLogin(
    normalizedPhone: string,
    normalizedPassword: string
  ) {
    const { data, error } = await supabase.rpc(
      "verify_customer_login",
      {
        p_phone: normalizedPhone,
        p_password: normalizedPassword,
      }
    );

    if (error) {
      console.error("Customer login RPC error:", error);
      throw new Error("CUSTOMER_LOGIN_FAILED");
    }

    const result = getCustomerLoginResult(data);

    if (!result) {
      setMessage("رقم الجوال أو كلمة المرور غير صحيحة");
      return;
    }

    if (!result.id) {
      setMessage("بيانات حساب العميل غير مكتملة");
      return;
    }

    clearFinanceSession();
    clearCustomerSession();

    const customerUser: CustomerSession = {
      id: String(result.id),
      full_name: result.full_name || "",
      phone: result.phone || normalizedPhone,
      work_sector: result.work_sector || "",
    };

    saveCustomerSession(customerUser);
    router.replace("/customer");
  }

  async function handleLogin() {
    if (loading) {
      return;
    }

    setMessage("");

    const normalizedIdentifier = loginIdentifier.trim();

    const normalizedPassword = password
      .replace(/\D/g, "")
      .slice(0, 4);

    const customerPhoneRegex = /^05\d{8}$/;

    const usernameRegex =
      /^[\u0600-\u06FFa-zA-Z0-9_.-]{2,35}$/;

    const pinRegex = /^\d{4}$/;

    if (!normalizedIdentifier) {
      setMessage("أدخل اسم المستخدم أو رقم الجوال");
      return;
    }

    if (!pinRegex.test(normalizedPassword)) {
      setMessage("كلمة المرور يجب أن تكون 4 أرقام");
      return;
    }

    const isCustomerPhone = customerPhoneRegex.test(
      normalizedIdentifier
    );

    if (
      !isCustomerPhone &&
      !usernameRegex.test(normalizedIdentifier)
    ) {
      setMessage("اسم المستخدم أو رقم الجوال غير صحيح");
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
      console.error("Unified login error:", loginError);

      setMessage(
        "حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" style={page}>
      <div style={card}>
        <div style={logoBox}>
          <div style={logoCircle}>ا</div>

          <h1 style={title}>تسجيل الدخول</h1>

          <p style={subtitle}>برنامج احتساب</p>
        </div>

        <input
          placeholder="اسم المستخدم أو رقم الجوال"
          value={loginIdentifier}
          onChange={(event) => {
            setLoginIdentifier(event.target.value);
            setMessage("");
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
            const value = event.target.value
              .replace(/\D/g, "")
              .slice(0, 4);

            setPassword(value);
            setMessage("");
          }}
          style={inputStyle}
          inputMode="numeric"
          type="password"
          maxLength={4}
          autoComplete="current-password"
          disabled={loading}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleLogin();
            }
          }}
        />

        <button
          type="button"
          onClick={() => void handleLogin()}
          disabled={loading}
          style={{
            ...buttonStyle,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.75 : 1,
          }}
        >
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>

        {message && (
          <p role="alert" style={messageStyle}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

function LoginPageLoading() {
  return (
    <main dir="rtl" style={loadingPage}>
      <div style={loadingCard}>جاري تحميل صفحة الدخول...</div>
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
  fontFamily: "var(--font-almarai), sans-serif",
};

const card: CSSProperties = {
  width: "100%",
  maxWidth: 430,
  background: "rgba(255,255,255,0.96)",
  borderRadius: 24,
  padding: 24,
  boxSizing: "border-box",
  boxShadow: "0 20px 50px rgba(15,23,42,0.22)",
  border: "1px solid rgba(255,255,255,0.7)",
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
  fontFamily: "var(--font-almarai), sans-serif",
};

const title: CSSProperties = {
  margin: 0,
  fontSize: 28,
  color: "#0f172a",
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
};

const subtitle: CSSProperties = {
  margin: "8px 0 22px",
  color: "#64748b",
  fontSize: 15,
  fontFamily: "var(--font-almarai), sans-serif",
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 50,
  marginBottom: 14,
  borderRadius: 12,
  border: "1px solid #dbe3ef",
  padding: "0 15px",
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#0f172a",
  fontFamily: "var(--font-almarai), sans-serif",
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
  fontFamily: "var(--font-almarai), sans-serif",
};

const messageStyle: CSSProperties = {
  textAlign: "center",
  margin: "18px 0 0",
  color: "#d00000",
  fontWeight: 900,
  lineHeight: 1.7,
  fontFamily: "var(--font-almarai), sans-serif",
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
  fontFamily: "var(--font-almarai), sans-serif",
};

const loadingCard: CSSProperties = {
  padding: "22px 28px",
  borderRadius: 18,
  background: "#ffffff",
  border: "1px solid #dbeafe",
  color: "#1e3a8a",
  fontSize: 15,
  fontWeight: 900,
  boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
};
