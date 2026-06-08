"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminSupportLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!username.trim()) {
      alert("اكتب اسم المستخدم");
      return;
    }

    if (!password.trim()) {
      alert("اكتب كلمة المرور");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc("verify_admin_support_login", {
      p_username: username.trim(),
      p_password: password.trim(),
    });

    setLoading(false);

    if (error) {
      alert("تعذر تسجيل الدخول: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      alert("بيانات الدخول غير صحيحة أو الحساب غير مفعل");
      return;
    }

    const user = data[0];

    localStorage.setItem("admin_support_user", JSON.stringify(user));

    window.location.href = "/admin-support";
  }

  return (
    <main dir="rtl" style={page}>
      <section style={card}>
        <div style={hero}>
          <h1 style={title}>دخول الدعم الفني</h1>
          <p style={subtitle}>لوحة إدارة الفروع وخدمات الدعم الفني</p>
        </div>

        <div style={form}>
          <label style={label}>اسم المستخدم</label>
          <input
            style={input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="مثال: admin"
          />

          <label style={label}>كلمة المرور</label>
          <input
            style={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••"
            onKeyDown={(e) => {
              if (e.key === "Enter") login();
            }}
          />

          <button style={button} onClick={login} disabled={loading}>
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>
        </div>
      </section>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f4f7fb",
  backgroundImage:
    "linear-gradient(rgba(244,247,251,0.72), rgba(244,247,251,0.72)), url('/backgrounds/finance-bg.webp')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 16px 40px rgba(15,23,42,0.10)",
  backdropFilter: "blur(6px)",
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  borderRadius: 22,
  padding: 24,
  marginBottom: 18,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
};

const subtitle: React.CSSProperties = {
  margin: "10px 0 0",
  opacity: 0.9,
  lineHeight: 1.7,
};

const form: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const label: React.CSSProperties = {
  color: "#334155",
  fontWeight: 800,
  marginTop: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  padding: 14,
  fontSize: 16,
  outline: "none",
  background: "#f8fafc",
  fontFamily: "var(--font-almarai), sans-serif",
};

const button: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  border: "none",
  background: "#2563eb",
  color: "white",
  borderRadius: 14,
  padding: 15,
  fontSize: 17,
  fontWeight: 800,
  cursor: "pointer",
};
