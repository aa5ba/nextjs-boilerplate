"use client";

import { useEffect, useState } from "react";

export default function CustomerPage() {
  const [customer, setCustomer] = useState({ name: "", phone: "", sector: "" });

  useEffect(() => {
    const id = localStorage.getItem("customer_id");
    if (!id) {
      window.location.href = "/login";
      return;
    }

    setCustomer({
      name: localStorage.getItem("customer_name") || "",
      phone: localStorage.getItem("customer_phone") || "",
      sector: localStorage.getItem("customer_sector") || "",
    });
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div dir="rtl" style={pageStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>لوحة العميل</h1>
            <p style={subtitleStyle}>مرحباً بك في احتساب</p>
          </div>
          <div style={avatarStyle}>
            {customer.name ? customer.name.charAt(0) : "ع"}
          </div>
        </div>

        <div style={infoBoxStyle}>
          <p><strong>الاسم:</strong> {customer.name}</p>
          <p><strong>رقم الجوال:</strong> {customer.phone}</p>
          <p><strong>قطاع العمل:</strong> {customer.sector}</p>
        </div>

        <button style={primaryButtonStyle} onClick={() => (window.location.href = "/")}>
          إجراء حسبة جديدة
        </button>

        <button
          style={secondaryButtonStyle}
          onClick={() => (window.location.href = "/customer/calculations")}
        >
          عملياتي السابقة
        </button>

        <button style={logoutButtonStyle} onClick={logout}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f5f7fb 0%, #eef3ff 100%)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
};

const cardStyle = {
  width: "100%",
  maxWidth: 430,
  background: "#fff",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 12px 35px rgba(0,0,0,0.10)",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 24,
};

const titleStyle = {
  margin: 0,
  fontSize: 28,
  fontWeight: "bold",
  color: "#111827",
};

const subtitleStyle = {
  margin: "6px 0 0",
  color: "#6b7280",
  fontSize: 15,
};

const avatarStyle = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "#0d6efd",
  color: "#fff",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: 26,
  fontWeight: "bold",
};

const infoBoxStyle = {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  marginBottom: 20,
  lineHeight: 1.9,
};

const primaryButtonStyle = {
  width: "100%",
  height: 52,
  border: "none",
  borderRadius: 16,
  background: "#0d6efd",
  color: "#fff",
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
  marginBottom: 12,
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: "#111827",
};

const logoutButtonStyle = {
  ...primaryButtonStyle,
  background: "#dc3545",
  marginBottom: 0,
};
