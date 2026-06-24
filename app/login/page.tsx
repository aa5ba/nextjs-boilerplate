"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
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
};

type CustomerLoginResult = {
  id: string;
  full_name: string | null;
  phone: string | null;
  work_sector: string | null;
};

export default function LoginPage() {
  const router = useRouter();

  const [loginIdentifier, setLoginIdentifier] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  function clearFinanceSession() {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem(
      "finance_user"
    );

    localStorage.removeItem(
      "finance_branch_user"
    );

    localStorage.removeItem(
      "finance_user_id"
    );

    localStorage.removeItem(
      "finance_user_name"
    );

    localStorage.removeItem(
      "finance_username"
    );

    localStorage.removeItem(
      "finance_role"
    );

    localStorage.removeItem(
      "finance_branch_id"
    );

    localStorage.removeItem(
      "finance_branch_slug"
    );

    localStorage.removeItem(
      "finance_branch_name"
    );

    localStorage.removeItem(
      "finance_organization_name"
    );
  }

  function clearCustomerSession() {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem(
      "customer_user"
    );

    localStorage.removeItem(
      "customer_id"
    );

    localStorage.removeItem(
      "customer_name"
    );

    localStorage.removeItem(
      "customer_phone"
    );

    localStorage.removeItem(
      "customer_sector"
    );
  }

  function saveFinanceSession(
    financeUser: FinanceUserSession
  ) {
    if (typeof window === "undefined") {
      return;
    }

    const serializedUser =
      JSON.stringify(financeUser);

    /*
      finance_user هو المفتاح الأساسي.

      finance_branch_user محفوظ أيضًا
      للتوافق مع الصفحات الأقدم في محطة العمل.
    */
    localStorage.setItem(
      "finance_user",
      serializedUser
    );

    localStorage.setItem(
      "finance_branch_user",
      serializedUser
    );

    localStorage.setItem(
      "finance_user_id",
      financeUser.id
    );

    localStorage.setItem(
      "finance_user_name",
      financeUser.full_name
    );

    localStorage.setItem(
      "finance_username",
      financeUser.username
    );

    localStorage.setItem(
      "finance_role",
      financeUser.role
    );

    localStorage.setItem(
      "finance_branch_id",
      financeUser.branch_id
    );

    localStorage.setItem(
      "finance_branch_slug",
      financeUser.branch_slug
    );

    localStorage.setItem(
      "finance_branch_name",
      financeUser.branch_name
    );

    localStorage.setItem(
      "finance_organization_name",
      financeUser.organization_name
    );
  }

  function saveCustomerSession(
    customerUser: CustomerSession
  ) {
    if (typeof window === "undefined") {
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

    const result = Array.isArray(data)
      ? (data[0] as
          | FinanceLoginResult
          | undefined)
      : undefined;

    if (!result) {
      setMessage(
        "اسم المستخدم أو كلمة المرور غير صحيحة"
      );

      return;
    }

    if (!result.branch_slug) {
      setMessage(
        "مسار الفرع غير مكتمل"
      );

      return;
    }

    clearFinanceSession();
    clearCustomerSession();

    const financeUser: FinanceUserSession =
      {
        id: String(result.id),

        full_name:
          result.full_name || "",

        username:
          result.username ||
          normalizedUsername,

        role: result.role || "",

        branch_id: String(
          result.branch_id
        ),

        branch_slug:
          result.branch_slug,

        branch_name:
          result.branch_name || "",

        organization_name:
          result.organization_name ||
          "",
      };

    saveFinanceSession(
      financeUser
    );

    router.replace(
      `/finance/${encodeURIComponent(
        financeUser.branch_slug
      )}`
    );
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

    const result = Array.isArray(data)
      ? (data[0] as
          | CustomerLoginResult
          | undefined)
      : undefined;

    if (!result) {
      setMessage(
        "رقم الجوال أو كلمة المرور غير صحيحة"
      );

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

    router.replace("/customer");
  }

  async function handleLogin() {
    if (loading) {
      return;
    }

    setMessage("");

    const normalizedIdentifier =
      loginIdentifier.trim();

    const normalizedPassword =
      password
        .replace(/\D/g, "")
        .slice(0, 4);

    const customerPhoneRegex =
      /^05\d{8}$/;

    const usernameRegex =
      /^[\u0600-\u06FFa-zA-Z0-9_.-]{2,35}$/;

    const pinRegex = /^\d{4}$/;

    if (!normalizedIdentifier) {
      setMessage(
        "أدخل اسم المستخدم أو رقم الجوال"
      );

      return;
    }

    if (
      !pinRegex.test(
        normalizedPassword
      )
    ) {
      setMessage(
        "كلمة المرور يجب أن تكون 4 أرقام"
      );

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
      setMessage(
        "اسم المستخدم أو رقم الجوال غير صحيح"
      );

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
            const value =
              event.target.value
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
            role="alert"
            style={messageStyle}
          >
            {message}
          </p>
        )}
      </div>
    </div>
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
  border: "1px solid #dbe3ef",

  padding: "0 15px",
  fontSize: 16,

  outline: "none",
  boxSizing: "border-box",

  background: "#ffffff",

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
  marginTop: 18,

  color: "#d00000",
  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",
};
