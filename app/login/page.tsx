"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://rqgzoeyyojfwyoewvhev.supabase.co",
  "sb_publishable_Zt56a_KLr3rtcdqI7slvCg_mSrB0ZoM"
);

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async () => {
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
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 5px 25px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ textAlign: "center", marginBottom: 25, fontSize: 28 }}>
          تسجيل الدخول
        </h1>

        <input
          placeholder="رقم الجوال"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
          inputMode="numeric"
        />

        <input
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          inputMode="numeric"
          type="password"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          style={buttonStyle}
        >
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>

        {message && (
          <p style={{ textAlign: "center", marginTop: 20, color: "#d00000", fontWeight: "bold" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: 50,
  marginBottom: 15,
  borderRadius: 12,
  border: "1px solid #ddd",
  padding: "0 15px",
  fontSize: 16,
};

const buttonStyle = {
  width: "100%",
  height: 50,
  border: "none",
  borderRadius: 14,
  background: "#0d6efd",
  color: "#fff",
  fontSize: 18,
  fontWeight: "bold",
  cursor: "pointer",
};
