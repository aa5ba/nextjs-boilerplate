"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://rqgzoeyyojfwyoewvhev.supabase.co",
  "sb_publishable_Zt56a_KLr3rtcdqI7slvCg_mSrB0ZoM"
);

type LoginMode = "branch" | "customer";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>("branch");

  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleBranchLogin() {
    setMessage("");

    const usernameRegex = /^[\u0600-\u06FFa-zA-Z0-9_.-]{2,35}$/;
    const pinRegex = /^\d{4}$/;

    if (!usernameRegex.test(username.trim())) {
      setMessage("اسم المستخدم غير صحيح");
      return;
    }

    if (!pinRegex.test(password)) {
      setMessage("كلمة المرور يجب أن تكون 4 أرقام");
      return;
    }

    setLoading(true);

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
      .eq("username", username.trim())
      .eq("password", password)
      .eq("is_active", true)
      .single();

    setLoading(false);

    if (error || !data) {
      setMessage("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }

    const branchData: any = Array.isArray(data.finance_branches)
      ? data.finance_branches[0]
      : data.finance_branches;

    if (!branchData || branchData.is_active === false) {
      setMessage("هذا الفرع غير مفعل حالياً");
      return;
    }

    localStorage.setItem("finance_user_id", data.id);
    localStorage.setItem("finance_user_name", data.full_name);
    localStorage.setItem("finance_username", data.username);
    localStorage.setItem("finance_role", data.role);
    localStorage.setItem("finance_branch_id", data.branch_id);
    localStorage.setItem("finance_branch_slug", branchData.branch_slug);
    localStorage.setItem("finance_branch_name", branchData.branch_name);
    localStorage.setItem(
      "finance_organization_name",
      branchData.organization_name
    );

    window.location.href = `/finance/${branchData.branch_slug}`;
  }

  async function handleCustomerLogin() {
    setMessage("");

    const phoneRegex = /^05\d{8}$/;
    const pinRegex = /^\d{4}$/;

    if (!phoneRegex.test(phone)) {
      setMessage("رقم الجوال غير صحيح");
      return;
    }

    if (!pinRegex.test(password)) {
      setMessage("كلمة المرور يجب أن تكون 4 أرقام");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, phone, work_sector")
      .eq("phone", phone)
      .eq("password_pin", password)
      .single();

    setLoading(false);

    if (error || !data) {
      setMessage("رقم الجوال أو كلمة المرور غير صحيحة");
      return;
    }

    localStorage.setItem("customer_id", data.id);
    localStorage.setItem("customer_name", data.full_name);
    localStorage.setItem("customer_phone", data.phone);
    localStorage.setItem("customer_sector", data.work_sector);

    window.location.href = "/customer";
  }

  function handleLogin() {
    if (mode === "branch") {
      handleBranchLogin();
      return;
    }

    handleCustomerLogin();
  }

  return (
    <div dir="rtl" style={page}>
      <div style={card}>
        <div style={logoBox}>
          <div style={logoCircle}>ا</div>
          <h1 style={title}>تسجيل الدخول</h1>
          <p style={subtitle}>برنامج احتساب</p>
        </div>

        <div style={tabs}>
          <button
            type="button"
            onClick={() => {
              setMode("branch");
              setMessage("");
              setPassword("");
            }}
            style={{
              ...tabButton,
              ...(mode === "branch" ? activeTab : {}),
            }}
          >
            محطة العمل
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("customer");
              setMessage("");
              setPassword("");
            }}
            style={{
              ...tabButton,
              ...(mode === "customer" ? activeTab : {}),
            }}
          >
            دخول العميل
          </button>
        </div>

        {mode === "branch" ? (
          <input
            placeholder="اسم المستخدم"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            autoComplete="username"
          />
        ) : (
          <input
            placeholder="رقم الجوال"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
            inputMode="numeric"
            autoComplete="tel"
          />
        )}

        <input
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          inputMode="numeric"
          type="password"
          maxLength={4}
          autoComplete="current-password"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleLogin();
            }
          }}
        />

        <button onClick={handleLogin} disabled={loading} style={buttonStyle}>
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>

        {message && <p style={messageStyle}>{message}</p>}
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg, #0f172a 0%, #1e3a5f 45%, #f8fafc 100%)",
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
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 15,
};

const tabs: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  background: "#f1f5f9",
  borderRadius: 14,
  padding: 6,
  marginBottom: 18,
};

const tabButton: React.CSSProperties = {
  height: 42,
  border: "none",
  borderRadius: 11,
  background: "transparent",
  color: "#475569",
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
};

const activeTab: React.CSSProperties = {
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
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
  cursor: "pointer",
};

const messageStyle: React.CSSProperties = {
  textAlign: "center",
  marginTop: 18,
  color: "#d00000",
  fontWeight: "bold",
};
