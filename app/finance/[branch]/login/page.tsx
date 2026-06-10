"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function FinanceLoginPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [organizationName, setOrganizationName] = useState("احتساب");
  const [username, setUsername] = useState("");
  const [passwordPin, setPasswordPin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBranchName();
  }, [branch]);

  async function loadBranchName() {
    if (!branch) return;

    const { data } = await supabase
      .from("finance_branches")
      .select("organization_name")
      .eq("branch_slug", branch)
      .single();

    if (data?.organization_name) {
      setOrganizationName(data.organization_name);
    }
  }

  async function login() {
    if (!username.trim()) return alert("اكتب اسم المستخدم");

    if (!/^\d{4}$/.test(passwordPin)) {
      return alert("كلمة المرور يجب أن تكون 4 أرقام");
    }

    setLoading(true);

    const { data: branchData, error: branchError } = await supabase
      .from("finance_branches")
      .select("id, branch_name, branch_slug, organization_name, is_active")
      .eq("branch_slug", branch)
      .single();

    if (branchError || !branchData) {
      setLoading(false);
      return alert("الفرع غير موجود");
    }

    if (!branchData.is_active) {
      setLoading(false);
      return alert("هذا الفرع معطل حالياً");
    }

    const { data: user, error: userError } = await supabase
      .from("finance_users")
      .select("*")
      .eq("branch_id", branchData.id)
      .eq("username", username.trim())
      .eq("password_pin", passwordPin.trim())
      .single();

    if (userError || !user) {
      setLoading(false);
      return alert("اسم المستخدم أو كلمة المرور غير صحيحة");
    }

    if (!user.is_active) {
      setLoading(false);
      return alert("هذا المستخدم معطل");
    }

    await supabase
      .from("finance_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);

    localStorage.setItem(
      "finance_user",
      JSON.stringify({
        id: user.id,
        branch_id: branchData.id,
        branch_slug: branchData.branch_slug,
        branch_name: branchData.branch_name,
        organization_name: branchData.organization_name,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
        roles: [user.role],
        permissions: user.permissions || [],
        logged_at: new Date().toISOString(),
      })
    );

    window.location.href = `/finance/${branch}`;
  }

  return (
    <main dir="rtl" style={page}>
      <section style={card}>
        <div style={logoBox}>
          <div style={logoIcon}>🏢</div>
          <div style={orgName}>{organizationName}</div>
          <div style={systemName}>محطة العمل</div>
        </div>

        <h1 style={title}>تسجيل الدخول</h1>
        <p style={subtitle}>ادخل باسم المستخدم وكلمة المرور للمتابعة</p>

        <label style={label}>اسم المستخدم</label>
        <input
          style={input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="مثال: abdullah أو عبدالله"
          autoComplete="username"
        />

        <label style={label}>كلمة المرور</label>
        <input
          style={input}
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={passwordPin}
          onChange={(e) =>
            setPasswordPin(e.target.value.replace(/\D/g, "").slice(0, 4))
          }
          placeholder="4 أرقام"
          autoComplete="current-password"
          onKeyDown={(e) => {
            if (e.key === "Enter") login();
          }}
        />

        <button style={button} onClick={login} disabled={loading}>
          {loading ? "جاري الدخول..." : "دخول"}
        </button>
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.78), rgba(255,255,255,0.78)), url('/backgrounds/v13-finance-bg-1.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 430,
  background: "rgba(255,255,255,0.88)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.45)",
  borderRadius: 30,
  padding: 28,
  boxShadow: "0 25px 60px rgba(15,23,42,.18)",
};

const logoBox: React.CSSProperties = {
  textAlign: "center",
  marginBottom: 18,
};

const logoIcon: React.CSSProperties = {
  width: 72,
  height: 72,
  margin: "0 auto 10px",
  borderRadius: 22,
  background: "linear-gradient(135deg,#1d4ed8,#0f766e)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 34,
};

const orgName: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.4,
};

const systemName: React.CSSProperties = {
  marginTop: 5,
  color: "#64748b",
  fontWeight: 800,
};

const title: React.CSSProperties = {
  margin: "0 0 6px",
  color: "#0f172a",
  fontSize: 26,
  textAlign: "center",
};

const subtitle: React.CSSProperties = {
  margin: "0 0 20px",
  color: "#64748b",
  textAlign: "center",
  lineHeight: 1.7,
};

const label: React.CSSProperties = {
  display: "block",
  color: "#334155",
  fontWeight: 900,
  marginBottom: 7,
  marginTop: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  borderRadius: 15,
  padding: 14,
  fontSize: 16,
  outline: "none",
  fontFamily: "var(--font-almarai), sans-serif",
};

const button: React.CSSProperties = {
  width: "100%",
  marginTop: 18,
  border: "none",
  borderRadius: 16,
  padding: 15,
  background: "linear-gradient(135deg,#2563eb,#0f766e)",
  color: "white",
  fontWeight: 900,
  fontSize: 17,
  cursor: "pointer",
};
