"use client";

import { useEffect, useState } from "react";

export default function CustomerPage() {
  const [customer, setCustomer] = useState({
    id: "",
    name: "",
    phone: "",
    sector: "",
  });

  useEffect(() => {
    const id = localStorage.getItem("customer_id");
    const name = localStorage.getItem("customer_name");
    const phone = localStorage.getItem("customer_phone");
    const sector = localStorage.getItem("customer_sector");

    if (!id) {
      window.location.href = "/login";
      return;
    }

    setCustomer({
      id,
      name: name || "",
      phone: phone || "",
      sector: sector || "",
    });
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div dir="rtl" style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>لوحة العميل</h1>

        <p>مرحباً، <strong>{customer.name}</strong></p>
        <p>رقم الجوال: {customer.phone}</p>
        <p>قطاع العمل: {customer.sector}</p>

        <button style={buttonStyle} onClick={() => (window.location.href = "/")}>
          الذهاب للحاسبة
        </button>

        <button style={logoutStyle} onClick={logout}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f5f7fb",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
};

const cardStyle = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 5px 25px rgba(0,0,0,0.08)",
};

const titleStyle = {
  textAlign: "center" as const,
  marginBottom: 25,
  fontSize: 28,
};

const buttonStyle = {
  width: "100%",
  height: 50,
  border: "none",
  borderRadius: 14,
  background: "#0d6efd",
  color: "#fff",
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 20,
};

const logoutStyle = {
  ...buttonStyle,
  background: "#dc3545",
  marginTop: 12,
};
