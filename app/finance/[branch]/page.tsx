"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import FinanceTrialSidebar from "./FinanceTrialSidebar";

const sections = [
  { title: "سير العمل", path: "workflow", icon: "💼" },
  { title: "العملاء", path: "customers", icon: "👥" },
  { title: "طلب جديد", path: "new-request", icon: "➕🧩" },
  { title: "سداد", path: "payments", icon: "💳" },
  { title: "المخزون والمنتجات", path: "inventory", icon: "📦" },
  { title: "العقود", path: "contracts", icon: "📄" },
  { title: "الملاحظات والتذكيرات", path: "notes", icon: "✏️" },
  { title: "إدارة الصلاحيات", path: "permissions", icon: "🔐" },
];

export default function FinancePage() {
  const params = useParams();
  const branch = params.branch as string;

  const [organizationName, setOrganizationName] = useState("احتساب");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (branch) {
      loadBranch();
    }
  }, [branch]);

  async function loadBranch() {
    const { data, error } = await supabase
      .from("finance_branches")
      .select("organization_name, branch_name, is_active")
      .eq("branch_slug", branch)
      .single();

    if (error || !data || !data.is_active) {
      setOrganizationName("فرع غير موجود");
      setLoading(false);
      return;
    }

    setOrganizationName(data.organization_name || "احتساب");
    setLoading(false);
  }

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={container}>
          <div style={header}>
            <h1 style={headerTitle}>جاري تحميل الفرع...</h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={backgroundLayer}>
  <svg
    viewBox="0 0 1440 900"
    preserveAspectRatio="xMidYMid slice"
    style={backgroundSvg}
  >
    <defs>
      <linearGradient id="softBlue" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.95" />
        <stop offset="55%" stopColor="#f8fbff" stopOpacity="1" />
        <stop offset="100%" stopColor="#eef5ff" stopOpacity="1" />
      </linearGradient>
    </defs>

    <rect width="1440" height="900" fill="url(#softBlue)" />

    <g opacity="0.26">
      <rect x="70" y="210" width="150" height="480" rx="10" fill="#dbeafe" />
      <rect x="95" y="250" width="95" height="55" rx="6" fill="#f59e0b" opacity="0.45" />
      <rect x="95" y="335" width="95" height="55" rx="6" fill="#f59e0b" opacity="0.35" />
      <rect x="95" y="420" width="95" height="55" rx="6" fill="#f59e0b" opacity="0.42" />
      <rect x="95" y="505" width="95" height="55" rx="6" fill="#f59e0b" opacity="0.32" />
      <rect x="95" y="590" width="95" height="55" rx="6" fill="#f59e0b" opacity="0.38" />

      <rect x="62" y="205" width="20" height="500" rx="8" fill="#2563eb" opacity="0.22" />
      <rect x="208" y="205" width="20" height="500" rx="8" fill="#2563eb" opacity="0.22" />
    </g>

    <g opacity="0.18">
      <circle cx="1240" cy="160" r="180" fill="#bfdbfe" />
      <circle cx="1280" cy="760" r="260" fill="#dbeafe" />
      <circle cx="1120" cy="520" r="110" fill="#93c5fd" />
    </g>

    <g opacity="0.16" stroke="#2563eb" strokeWidth="2" fill="none">
      <path d="M930 90 C1050 40, 1180 70, 1320 25" />
      <path d="M955 125 C1070 80, 1200 100, 1340 65" />
      <path d="M980 160 C1095 120, 1220 130, 1360 105" />
    </g>

    <g opacity="0.22">
      <rect x="300" y="240" width="70" height="70" rx="6" fill="#ffffff" />
      <rect x="390" y="240" width="70" height="70" rx="6" fill="#ffffff" />
      <rect x="300" y="330" width="70" height="70" rx="6" fill="#ffffff" />
      <rect x="390" y="330" width="70" height="70" rx="6" fill="#ffffff" />
    </g>

    <g opacity="0.2" fill="#22c55e">
      <ellipse cx="250" cy="680" rx="18" ry="60" transform="rotate(-25 250 680)" />
      <ellipse cx="292" cy="660" rx="15" ry="48" transform="rotate(28 292 660)" />
      <rect x="262" y="700" width="55" height="60" rx="10" fill="#94a3b8" opacity="0.55" />
    </g>
  </svg>
</div>
      <div style={layout}>
        <FinanceTrialSidebar />

        <div style={container}>
          <div style={header}>
            <div style={organizationBadge}>🏢 {organizationName}</div>
            <h1 style={headerTitle}>محطة العمل الرئيسية</h1>
          </div>

          <div style={grid}>
            {sections.map((item) => (
              <Card
                key={item.path}
                title={item.title}
                href={`/finance/${branch}/${item.path}`}
                icon={item.icon}
              />
            ))}
          </div>

          <button style={backButton} onClick={() => (window.location.href = "/")}>
            الرجوع للرئيسية
          </button>
        </div>
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
  background: "transparent",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};
const backgroundLayer = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 0,
  overflow: "hidden" as const,
  pointerEvents: "none" as const,
};
const backgroundSvg = {
  width: "100%",
  height: "100%",
  display: "block",
};
const layout = {
  position: "relative" as const,
  zIndex: 1,
  width: "100%",
  maxWidth: 1420,
  margin: "auto",
  display: "flex",
  gap: 20,
  alignItems: "flex-start",
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
