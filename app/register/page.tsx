"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://rqgzoeyyojfwyoewvhev.supabase.co",
  "sb_publishable_Zt56a_KLr3rtcdqI7slvCg_mSrB0ZoM"
);

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [workSector, setWorkSector] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRegister = async () => {
    setMessage("");

    const nameRegex = /^[\u0600-\u06FFa-zA-Z0-9\s]{2,35}$/;
    const phoneRegex = /^05\d{8}$/;
    const pinRegex = /^\d{4}$/;

    if (!nameRegex.test(fullName)) {
      setMessage("الاسم غير صحيح");
      return;
    }

    if (!phoneRegex.test(phone)) {
      setMessage("رقم الجوال غير صحيح");
      return;
    }

    if (!pinRegex.test(password)) {
      setMessage("كلمة المرور يجب أن تكون 4 أرقام");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("كلمتا المرور غير متطابقتين");
      return;
    }

    if (!workSector) {
      setMessage("اختر قطاع العمل");
      return;
    }

    if (!termsAccepted) {
      setMessage("يجب الموافقة على الشروط والأحكام");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("customers").insert({
      full_name: fullName,
      email: email || null,
      phone,
      work_sector: workSector,
      password_pin: password,
      terms_accepted: termsAccepted,
    });

    setLoading(false);

    if (error) {
      if (error.message.includes("duplicate")) {
        setMessage("رقم الجوال مستخدم مسبقاً");
      } else {
        setMessage(error.message);
      }

      return;
    }

    setMessage("تم إنشاء الحساب بنجاح");
  };

  return (
    <div
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
        <h1
          style={{
            textAlign: "center",
            marginBottom: 25,
            fontSize: 28,
            fontWeight: "bold",
          }}
        >
          تسجيل عميل جديد
        </h1>

        <input
          placeholder="الاسم الكامل"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
        />

        <input
          placeholder="البريد الإلكتروني (اختياري)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <input
          placeholder="رقم الجوال"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
          inputMode="numeric"
        />

        <select
          value={workSector}
          onChange={(e) => setWorkSector(e.target.value)}
          style={inputStyle}
        >
          <option value="">اختر قطاع العمل</option>
          <option>مدني حكومي</option>
          <option>عسكري</option>
          <option>متقاعد</option>
          <option>قطاع خاص</option>
          <option>غير ذلك</option>
        </select>

        <input
          placeholder="كلمة المرور"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          inputMode="numeric"
          type="password"
        />

        <input
          placeholder="تأكيد كلمة المرور"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={inputStyle}
          inputMode="numeric"
          type="password"
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
          />
          أوافق على الشروط والأحكام
        </label>

        <button
          onClick={handleRegister}
          disabled={loading}
          style={{
            width: "100%",
            height: 50,
            border: "none",
            borderRadius: 14,
            background: "#0d6efd",
            color: "#fff",
            fontSize: 18,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {loading ? "جارٍ التسجيل..." : "إنشاء حساب"}
        </button>

        {message && (
          <p
            style={{
              textAlign: "center",
              marginTop: 20,
              color: "#d00000",
              fontWeight: "bold",
            }}
          >
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
