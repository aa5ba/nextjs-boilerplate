"use client";

import { useEffect, useState } from "react";
import { getOrganizationName } from "@/lib/getOrganizationName";

const sections = [
  { title: "سير العمل", href: "/finance/workflow", icon: "💼" },
  { title: "العملاء", href: "/finance/customers", icon: "👥" },
  { title: "طلب جديد", href: "/finance/new-request", icon: "➕🧩" },
  { title: "سداد", href: "/finance/payments", icon: "💳" },
  { title: "المخزون والمنتجات", href: "/finance/inventory", icon: "📦" },
  { title: "العقود", href: "/finance/contracts", icon: "📄" },
  { title: "الملاحظات والتذكيرات", href: "/finance/notes", icon: "✏️" },
  { title: "إدارة الصلاحيات", href: "/finance/permissions", icon: "🔐" },
];

export default function FinancePage() {
  const [organizationName, setOrganizationName] = useState("احتساب");

  useEffect(() => {
    loadOrganizationName();
  }, []);

  async function loadOrganizationName() {
    const name = await getOrganizationName();
    setOrganizationName(name);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <div style={organizationBadge}>
            🏢 {organizationName}
          </div>

          <h1 style={headerTitle}>محطة العمل الرئيسية</h1>
        </div>

        <div style={grid}>
          {sections.map((item) => (
            <Card
              key={item.href}
              title={item.title}
              href={item.href}
              icon={item.icon}
            />
          ))}
        </div>

        <button style={backButton} onClick={() => (window.location.href = "/")}>
          الرجوع للرئيسية
        </button>
      </div>
    </main>
  );
}

function Card({ title, href, icon }: any) {
  return (
    <button style={card} onClick={() => (window.location.href = href)}>
      <div style={cardRight}>
        <span style={iconBox}>{icon}</span>
        <span style={cardTitle}>{title}</span>
      </div>

      <span style={arrow}>‹</span>
    </button>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: "30px 20px",
  borderRadius: 22,
  marginBottom: 22,
};

const organizationBadge = {
  width: "fit-content",
  margin: "0 auto 14px auto",
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.25)",
  padding: "10px 18px",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  backdropFilter: "blur(6px)",
};

const headerTitle = {
  margin: 0,
  textAlign: "center" as const,
  fontSize: 34,
  fontWeight: 700,
  letterSpacing: "0px",
  lineHeight: 1.4,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 18,
};

const card = {
  width: "100%",
  minHeight: 110,
  background: "white",
  color: "#0f172a",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const cardRight = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const iconBox = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "#eef5ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const cardTitle = {
  color: "#0d47a1",
  fontWeight: "bold",
};

const arrow = {
  color: "#0d6efd",
  fontSize: 28,
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 18,
};
