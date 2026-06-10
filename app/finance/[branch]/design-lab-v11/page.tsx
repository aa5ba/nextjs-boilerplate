"use client";

import { useParams } from "next/navigation";

const sections = [
  {
    title: "سير العمل",
    desc: "متابعة العمليات والتنبيهات",
    icon: "💼",
    color: "#2563eb",
    bg: "#dbeafe",
    accent: "#eff6ff",
  },
  {
    title: "العملاء",
    desc: "إدارة العملاء والملفات",
    icon: "👥",
    color: "#0891b2",
    bg: "#cffafe",
    accent: "#ecfeff",
  },
  {
    title: "طلب جديد",
    desc: "إنشاء عقد وسند جديد",
    icon: "➕",
    color: "#16a34a",
    bg: "#dcfce7",
    accent: "#f0fdf4",
  },
  {
    title: "السداد",
    desc: "تسجيل ومتابعة الدفعات",
    icon: "💳",
    color: "#059669",
    bg: "#d1fae5",
    accent: "#ecfdf5",
  },
  {
    title: "المخزون",
    desc: "المنتجات والمستثمرين",
    icon: "📦",
    color: "#ea580c",
    bg: "#fed7aa",
    accent: "#fff7ed",
  },
  {
    title: "العقود",
    desc: "بحث وطباعة ومتابعة",
    icon: "📄",
    color: "#4f46e5",
    bg: "#e0e7ff",
    accent: "#eef2ff",
  },
  {
    title: "المصروفات",
    desc: "المشتريات والمصروفات",
    icon: "🧾",
    color: "#9333ea",
    bg: "#f3e8ff",
    accent: "#faf5ff",
  },
  {
    title: "الملاحظات",
    desc: "ملاحظات وتذكيرات",
    icon: "✏️",
    color: "#dc2626",
    bg: "#fee2e2",
    accent: "#fef2f2",
  },
  {
    title: "الصلاحيات",
    desc: "المستخدمون والأدوار",
    icon: "🔐",
    color: "#475569",
    bg: "#e2e8f0",
    accent: "#f8fafc",
  },
  {
    title: "الإعدادات",
    desc: "بيانات الفرع والمنظمة",
    icon: "⚙️",
    color: "#0f172a",
    bg: "#e5e7eb",
    accent: "#f9fafb",
  },
];

export default function DesignLabV11Page() {
  const params = useParams();
  const branch = params.branch as string;

  return (
    <main dir="rtl" style={page}>
      <div style={softCircleOne} />
      <div style={softCircleTwo} />

      <div style={container}>
        <section style={hero}>
          <div>
            <span style={badge}>نموذج ١١ — Soft Colorful</span>
            <h1 style={heroTitle}>محطة العمل</h1>
            <p style={heroSub}>مؤسسة سداد و أرقام</p>
          </div>

          <div style={heroPanel}>
            <span>اليوم</span>
            <strong>واجهة حديثة ومريحة للعمل اليومي</strong>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard
            title="العقود النشطة"
            value="145"
            icon="📄"
            color="#4f46e5"
            bg="#eef2ff"
          />
          <StatCard
            title="العملاء"
            value="812"
            icon="👥"
            color="#0891b2"
            bg="#ecfeff"
          />
          <StatCard
            title="السداد اليوم"
            value="28"
            icon="💳"
            color="#16a34a"
            bg="#f0fdf4"
          />
          <StatCard
            title="المنتجات"
            value="53"
            icon="📦"
            color="#ea580c"
            bg="#fff7ed"
          />
        </section>

        <section style={searchCard}>
          <span style={searchIcon}>🔎</span>
          <input
            style={searchInput}
            placeholder="البحث السريع عن عميل، عقد، هوية، جوال..."
          />
        </section>

        <section style={quickGrid}>
          <button style={{ ...quickButton, background: "#eff6ff", color: "#1d4ed8" }}>
            ➕ طلب جديد
          </button>
          <button style={{ ...quickButton, background: "#f0fdf4", color: "#166534" }}>
            💳 تسجيل سداد
          </button>
          <button style={{ ...quickButton, background: "#fff7ed", color: "#c2410c" }}>
            📦 إضافة مخزون
          </button>
          <button style={{ ...quickButton, background: "#faf5ff", color: "#7e22ce" }}>
            🧾 فاتورة مصروف
          </button>
        </section>

        <section style={twoColumnGrid}>
          <div style={panel}>
            <div style={sectionHeader}>
              <span>🚨</span>
              <strong>تنبيهات مهمة</strong>
            </div>

            <div style={noticeItemOrange}>
              يوجد 3 منتجات قاربت على النفاد من المخزون
            </div>

            <div style={noticeItemBlue}>
              يوجد 12 عقداً مستحقاً خلال الأسبوع
            </div>
          </div>

          <div style={panel}>
            <div style={sectionHeader}>
              <span>🕒</span>
              <strong>آخر العمليات</strong>
            </div>

            <div style={activityItem}>تم إنشاء عقد جديد للعميل أحمد محمد</div>
            <div style={activityItem}>تم تسجيل سداد بمبلغ 5,000 ريال</div>
            <div style={activityItem}>تم خصم 20 بطاقة من المخزون</div>
          </div>
        </section>

        <section style={sectionsPanel}>
          <div style={sectionHeader}>
            <span>⚡</span>
            <strong>أقسام محطة العمل</strong>
          </div>

          <div style={grid}>
            {sections.map((item) => (
              <button
                key={item.title}
                style={{
                  ...card,
                  background: `linear-gradient(135deg,#ffffff 0%,${item.accent} 100%)`,
                  borderTop: `4px solid ${item.color}`,
                }}
              >
                <div style={cardRight}>
                  <div
                    style={{
                      ...iconBox,
                      background: item.bg,
                      color: item.color,
                    }}
                  >
                    {item.icon}
                  </div>

                  <div>
                    <div style={cardTitle}>{item.title}</div>
                    <div style={cardDesc}>{item.desc}</div>
                  </div>
                </div>

                <span style={{ ...arrow, color: item.color }}>‹</span>
              </button>
            ))}
          </div>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}`)}
        >
          الرجوع للصفحة الرئيسية
        </button>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  bg,
}: {
  title: string;
  value: string;
  icon: string;
  color: string;
  bg: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ ...statIcon, background: bg, color }}>{icon}</div>
      <div style={statValue}>{value}</div>
      <div style={statTitle}>{title}</div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg,#eef6ff 0%,#f8fafc 48%,#eef4ff 100%)",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
  position: "relative",
  overflowX: "hidden",
};

const softCircleOne: React.CSSProperties = {
  position: "fixed",
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "rgba(37,99,235,0.13)",
  filter: "blur(70px)",
  top: -130,
  right: -120,
  pointerEvents: "none",
};

const softCircleTwo: React.CSSProperties = {
  position: "fixed",
  width: 380,
  height: 380,
  borderRadius: "50%",
  background: "rgba(147,51,234,0.10)",
  filter: "blur(75px)",
  bottom: -150,
  left: -130,
  pointerEvents: "none",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 1180,
  margin: "auto",
  position: "relative",
  zIndex: 2,
};

const hero: React.CSSProperties = {
  background:
    "linear-gradient(135deg,#2563eb 0%,#4f46e5 48%,#7c3aed 100%)",
  border: "1px solid rgba(255,255,255,0.55)",
  borderRadius: 30,
  padding: 28,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 16,
  boxShadow: "0 18px 45px rgba(79,70,229,0.20)",
  color: "white",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(255,255,255,0.18)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: 900,
  fontSize: 13,
  marginBottom: 10,
  backdropFilter: "blur(8px)",
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 40,
  lineHeight: 1.35,
  fontWeight: 900,
};

const heroSub: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#eef2ff",
  fontSize: 17,
};

const heroPanel: React.CSSProperties = {
  background: "rgba(255,255,255,0.16)",
  border: "1px solid rgba(255,255,255,0.24)",
  borderRadius: 22,
  padding: 16,
  display: "grid",
  gap: 6,
  color: "#eef2ff",
  backdropFilter: "blur(10px)",
  minWidth: 250,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 20,
  display: "grid",
  gap: 8,
  boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
};

const statIcon: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
};

const statValue: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#0f172a",
};

const statTitle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
};

const searchCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbeafe",
  borderRadius: 22,
  padding: "0 15px",
  minHeight: 60,
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  boxShadow: "0 10px 25px rgba(37,99,235,0.07)",
};

const searchIcon: React.CSSProperties = {
  color: "#2563eb",
  fontSize: 21,
};

const searchInput: React.CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: 16,
  color: "#0f172a",
  fontFamily: "var(--font-almarai), sans-serif",
};

const quickGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
  marginBottom: 14,
};

const quickButton: React.CSSProperties = {
  border: "1px solid rgba(226,232,240,0.9)",
  borderRadius: 18,
  padding: 15,
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const twoColumnGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const panel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  color: "#0f172a",
  fontSize: 17,
  marginBottom: 13,
};

const noticeItemOrange: React.CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#c2410c",
  borderRadius: 15,
  padding: 13,
  marginBottom: 9,
  lineHeight: 1.7,
  fontWeight: 700,
};

const noticeItemBlue: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  borderRadius: 15,
  padding: 13,
  marginBottom: 9,
  lineHeight: 1.7,
  fontWeight: 700,
};

const activityItem: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  borderRadius: 15,
  padding: 13,
  marginBottom: 9,
  lineHeight: 1.7,
};

const sectionsPanel: React.CSSProperties = {
  ...panel,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
  gap: 12,
};

const card: React.CSSProperties = {
  width: "100%",
  minHeight: 96,
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
};

const cardRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconBox: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 17,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 23,
  flex: "0 0 auto",
};

const cardTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#0f172a",
};

const cardDesc: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 5,
};

const arrow: React.CSSProperties = {
  fontSize: 29,
};

const backButton: React.CSSProperties = {
  width: "100%",
  marginTop: 16,
  padding: 16,
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 16,
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 12px 25px rgba(22,163,74,0.18)",
};
