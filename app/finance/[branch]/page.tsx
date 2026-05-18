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
              <stop offset="0%" stopColor="#eff6ff" stopOpacity="1" />
              <stop offset="55%" stopColor="#f8fbff" stopOpacity="1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
            </linearGradient>
          </defs>

          <rect width="1440" height="900" fill="url(#softBlue)" />

          <circle cx="300" cy="180" r="190" fill="#dbeafe" opacity="0.32" />
          <circle cx="1180" cy="120" r="260" fill="#f8fbff" opacity="0.95" />

          <line
            x1="245"
            y1="0"
            x2="245"
            y2="130"
            stroke="#93a4bd"
            strokeWidth="3"
            opacity="0.35"
          />
          <path
            d="M205 145 Q245 95 285 145 Z"
            fill="#8fa8c8"
            opacity="0.34"
          />
          <ellipse
            cx="245"
            cy="150"
            rx="46"
            ry="10"
            fill="#8fa8c8"
            opacity="0.28"
          />

          <g opacity="0.72">
            <rect
              x="0"
              y="220"
              width="205"
              height="500"
              rx="4"
              fill="#dbeafe"
              opacity="0.45"
            />

            <rect
              x="35"
              y="245"
              width="18"
              height="460"
              rx="7"
              fill="#5b7da8"
              opacity="0.65"
            />
            <rect
              x="180"
              y="245"
              width="18"
              height="460"
              rx="7"
              fill="#5b7da8"
              opacity="0.65"
            />

            <rect
              x="30"
              y="305"
              width="175"
              height="16"
              rx="6"
              fill="#5b7da8"
              opacity="0.55"
            />
            <rect
              x="30"
              y="415"
              width="175"
              height="16"
              rx="6"
              fill="#5b7da8"
              opacity="0.55"
            />
            <rect
              x="30"
              y="525"
              width="175"
              height="16"
              rx="6"
              fill="#5b7da8"
              opacity="0.55"
            />
            <rect
              x="30"
              y="635"
              width="175"
              height="16"
              rx="6"
              fill="#5b7da8"
              opacity="0.55"
            />

            <rect
              x="65"
              y="255"
              width="75"
              height="55"
              rx="5"
              fill="#f3c178"
              opacity="0.78"
            />
            <rect
              x="70"
              y="365"
              width="78"
              height="55"
              rx="5"
              fill="#f3c178"
              opacity="0.72"
            />
            <rect
              x="60"
              y="475"
              width="85"
              height="55"
              rx="5"
              fill="#f3c178"
              opacity="0.70"
            />
            <rect
              x="72"
              y="585"
              width="76"
              height="55"
              rx="5"
              fill="#f3c178"
              opacity="0.68"
            />

            <line
              x1="100"
              y1="255"
              x2="100"
              y2="310"
              stroke="#fff7ed"
              strokeWidth="3"
              opacity="0.5"
            />
            <line
              x1="108"
              y1="365"
              x2="108"
              y2="420"
              stroke="#fff7ed"
              strokeWidth="3"
              opacity="0.5"
            />
            <line
              x1="105"
              y1="475"
              x2="105"
              y2="530"
              stroke="#fff7ed"
              strokeWidth="3"
              opacity="0.5"
            />
          </g>

          <rect
            x="320"
            y="230"
            width="90"
            height="90"
            rx="6"
            fill="#ffffff"
            opacity="0.22"
          />
          <rect
            x="425"
            y="230"
            width="90"
            height="90"
            rx="6"
            fill="#ffffff"
            opacity="0.22"
          />
          <rect
            x="320"
            y="335"
            width="90"
            height="90"
            rx="6"
            fill="#ffffff"
            opacity="0.22"
          />
          <rect
            x="425"
            y="335"
            width="90"
            height="90"
            rx="6"
            fill="#ffffff"
            opacity="0.22"
          />

          <g opacity="0.55">
            <rect
              x="220"
              y="660"
              width="62"
              height="58"
              rx="12"
              fill="#94a3b8"
              opacity="0.55"
            />
            <ellipse
              cx="235"
              cy="620"
              rx="18"
              ry="62"
              fill="#22c55e"
              transform="rotate(-28 235 620)"
              opacity="0.45"
            />
            <ellipse
              cx="275"
              cy="605"
              rx="16"
              ry="54"
              fill="#22c55e"
              transform="rotate(30 275 605)"
              opacity="0.42"
            />
            <ellipse
              cx="255"
              cy="565"
              rx="13"
              ry="48"
              fill="#22c55e"
              transform="rotate(-10 255 565)"
              opacity="0.35"
            />
          </g>

          <path
            d="M0 760 C260 700, 460 820, 730 760 C980 705, 1160 750, 1440 700 L1440 900 L0 900 Z"
            fill="#dbeafe"
            opacity="0.20"
          />
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
  background: "rgba(255,255,255,0.92)",
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
