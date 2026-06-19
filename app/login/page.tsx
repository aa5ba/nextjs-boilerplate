"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://rqgzoeyyojfwyoewvhev.supabase.co",
  "sb_publishable_Zt56a_KLr3rtcdqI7slvCg_mSrB0ZoM"
);

type FinanceBranch = {
  id: string;
  branch_name: string;
  branch_slug: string;
  organization_name: string | null;
  is_active: boolean | null;
};

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

export default function LoginPage() {
  const router = useRouter();

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function clearFinanceSession() {
    localStorage.removeItem("finance_user");
    localStorage.removeItem("finance_user_id");
    localStorage.removeItem("finance_user_name");
    localStorage.removeItem("finance_username");
    localStorage.removeItem("finance_role");
    localStorage.removeItem("finance_branch_id");
    localStorage.removeItem("finance_branch_slug");
    localStorage.removeItem("finance_branch_name");
    localStorage.removeItem("finance_organization_name");
  }

  function clearCustomerSession() {
    localStorage.removeItem("customer_user");
    localStorage.removeItem("customer_id");
    localStorage.removeItem("customer_name");
    localStorage.removeItem("customer_phone");
    localStorage.removeItem("customer_sector");
  }

  function saveFinanceSession(financeUser: FinanceUserSession) {
    localStorage.setItem("finance_user", JSON.stringify(financeUser));

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
  }

  function saveCustomerSession(customerUser: CustomerSession) {
    localStorage.setItem("customer_user", JSON.stringify(customerUser));

    localStorage.setItem("customer_id", customerUser.id);
    localStorage.setItem("customer_name", customerUser.full_name);
    localStorage.setItem("customer_phone", customerUser.phone);
    localStorage.setItem("customer_sector", customerUser.work_sector);
  }

  async function handleBranchLogin(
    normalizedUsername: string,
    normalizedPassword: string
  ) {
    const { data, error } = await supabase
      .from("finance_branch_users")
      .select(
        `
        id,
        full_name,
        username,
        role,
        branch_id,
        is_active,
        finance_branches (
          id,
          branch_name,
          branch_slug,
          organization_name,
          is_active
        )
      `
      )
      .eq("username", normalizedUsername)
      .eq("password", normalizedPassword)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Branch login error:", error);
      throw new Error("تعذر التحقق من بيانات الدخول");
    }

    if (!data) {
      setMessage("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }

    const branchData = (
      Array.isArray(data.finance_branches)
        ? data.finance_branches[0]
        : data.finance_branches
    ) as FinanceBranch | null;

    if (!branchData) {
      setMessage("لم يتم العثور على الفرع المرتبط بهذا المستخدم");
      return;
    }

    if (branchData.is_active === false) {
      setMessage("هذا الفرع غير مفعل حالياً");
      return;
    }

    if (!branchData.branch_slug) {
      setMessage("مسار الفرع غير مكتمل");
      return;
    }

    clearFinanceSession();
    clearCustomerSession();

    const financeUser: FinanceUserSession = {
      id: String(data.id),
      full_name: data.full_name || "",
      username: data.username || normalizedUsername,
      role: data.role || "",
      branch_id: String(data.branch_id),
      branch_slug: branchData.branch_slug,
      branch_name: branchData.branch_name || "",
      organization_name: branchData.organization_name || "",
    };

    saveFinanceSession(financeUser);

    router.replace(`/finance/${financeUser.branch_slug}`);
  }

  async function handleCustomerLogin(
    normalizedPhone: string,
    normalizedPassword: string
  ) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, phone, work_sector")
      .eq("phone", normalizedPhone)
      .eq("password_pin", normalizedPassword)
      .maybeSingle();

    if (error) {
      console.error("Customer login error:", error);
      throw new Error("تعذر التحقق من بيانات الدخول");
    }

    if (!data) {
      setMessage("رقم الجوال أو كلمة المرور غير صحيحة");
      return;
    }

    clearFinanceSession();
    clearCustomerSession();

    const customerUser: CustomerSession = {
      id: String(data.id),
      full_name: data.full_name || "",
      phone: data.phone || normalizedPhone,
      work_sector: data.work_sector || "",
    };

    saveCustomerSession(customerUser);

    router.replace("/customer");
  }

  async function handleLogin() {
    if (loading) return;

    setMessage("");

    const normalizedIdentifier = loginIdentifier.trim();
    const normalizedPassword = password.replace(/\D/g, "").slice(0, 4);

    const customerPhoneRegex = /^05\d{8}$/;
    const usernameRegex = /^[\u0600-\u06FFa-zA-Z0-9_.-]{2,35}$/;
    const pinRegex = /^\d{4}$/;

    if (!normalizedIdentifier) {
      setMessage("أدخل اسم المستخدم أو رقم الجوال");
      return;
    }

    if (!pinRegex.test(normalizedPassword)) {
      setMessage("كلمة المرور يجب أن تكون 4 أرقام");
      return;
    }

    const isCustomerPhone = customerPhoneRegex.test(normalizedIdentifier);

    if (!isCustomerPhone && !usernameRegex.test(normalizedIdentifier)) {
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
      setMessage("حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى");
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
          onChange={(e) => {
            setLoginIdentifier(e.target.value);
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
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 4);
            setPassword(value);
            setMessage("");
          }}
          style={inputStyle}
          inputMode="numeric"
          type="password"
          maxLength={4}
          autoComplete="current-password"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
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

        {message && <p style={messageStyle}>{message}</p>}
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
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
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 430,
  background: "rgba(255,255,255,0.96)",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 20px 50px rgba(15,23,42,0.22)",
  border: "1px solid rgba(255,255,255,0.7)",
};

const logoBox: React.CSSProperties = {
  textAlign: "center",
  marginBottom: 22,
};

const logoCircle: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: "50%",
  margin: "0 auto 12px",
  background: "#0f172a",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  fontWeight: "bold",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  color: "#0f172a",
};

const subtitle: React.CSSProperties = {
  margin: "8px 0 22px",
  color: "#64748b",
  fontSize: 15,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 50,
  marginBottom: 14,
  borderRadius: 12,
  border: "1px solid #dbe3ef",
  padding: "0 15px",
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  height: 50,
  border: "none",
  borderRadius: 14,
  background: "#0f172a",
  color: "#fff",
  fontSize: 18,
  fontWeight: "bold",
};

const messageStyle: React.CSSProperties = {
  textAlign: "center",
  marginTop: 18,
  color: "#d00000",
  fontWeight: "bold",
};
