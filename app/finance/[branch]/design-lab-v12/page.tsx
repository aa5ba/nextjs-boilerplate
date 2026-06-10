"use client";

import { useParams } from "next/navigation";

const sections = [
  {
    title: "سير العمل",
    desc: "متابعة العمليات والتنبيهات",
    icon: "💼",
    color: "#2563eb",
    glow: "rgba(37,99,235,0.20)",
  },
  {
    title: "العملاء",
    desc: "إدارة العملاء والملفات",
    icon: "👥",
    color: "#0891b2",
    glow: "rgba(8,145,178,0.20)",
  },
  {
    title: "طلب جديد",
    desc: "إنشاء عقد وسند جديد",
    icon: "➕",
    color: "#16a34a",
    glow: "rgba(22,163,74,0.20)",
  },
  {
    title: "السداد",
    desc: "تسجيل ومتابعة الدفعات",
    icon: "💳",
    color: "#059669",
    glow: "rgba(5,150,105,0.20)",
  },
  {
    title: "المخزون",
    desc: "المنتجات والمستثمرين",
    icon: "📦",
    color: "#ea580c",
    glow: "rgba(234,88,12,0.20)",
  },
  {
    title: "العقود",
    desc: "بحث وطباعة ومتابعة",
    icon: "📄",
    color: "#7c3aed",
    glow: "rgba(124,58,237,0.22)",
  },
  {
    title: "المصروفات",
    desc: "المشتريات والمصروفات",
    icon: "🧾",
    color: "#c026d3",
    glow: "rgba(192,38,211,0.20)",
  },
  {
    title: "الملاحظات",
    desc: "ملاحظات وتذكيرات",
    icon: "✏️",
    color: "#dc2626",
    glow: "rgba(220,38,38,0.18)",
  },
  {
    title: "الصلاحيات",
    desc: "المستخدمون والأدوار",
    icon: "🔐",
    color: "#475569",
    glow: "rgba(71,85,105,0.18)",
  },
  {
    title: "الإعدادات",
    desc: "بيانات الفرع والمنظمة",
    icon: "⚙️",
    color: "#0f172a",
    glow: "rgba(15,23,42,0.16)",
  },
];

export default function DesignLabV12Page() {
  const params = useParams();
  const branch = params.branch as string;

  return (
    <main dir="rtl" style={page}>
      <div style={auroraOne} />
      <div style={auroraTwo} />
      <div style={auroraThree} />

      <div style={container}>
        <section style={hero}>
          <div>
            <span style={badge}>نموذج ١٢ — Aurora Dashboard</span>

            <h1 style={heroTitle}>محطة العمل</h1>

            <p style={heroSub}>
              واجهة مالية حديثة بألوان هادئة وممتعة بصرياً
            </p>
          </div>

          <div style={heroOrg}>
            <span>🏢 المنظمة</span>
            <strong>مؤسسة سداد و أرقام</strong>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard title="العقود النشطة" value="145" icon="📄" color="#7c3aed" />
          <StatCard title="العملاء" value="812" icon="👥" color="#0891b2" />
          <StatCard title="السداد اليوم" value="28" icon="💳" color="#16a34a" />
          <StatCard title="المنتجات" value="53" icon="📦" color="#ea580c" />
        </section>

        <section style={searchCard}>
          <span style={searchIcon}>🔎</span>
          <input
            style={searchInput}
            placeholder="البحث السريع عن عميل، عقد، رقم هوية، جوال..."
          />
        </section>

        <section style={quickActions}>
          <button style={quickPrimary}>➕ طلب جديد</button>
          <button style={quickGreen}>💳 تسجيل سداد</button>
          <button style={quickOrange}>📦 إضافة مخزون</button>
          <button style={quickPurple}>🧾 فاتورة مصروف</button>
        </section>

        <section style={mainGrid}>
          <div style={panel}>
            <div style={panelHeader}>
              <span>🚨</span>
              <strong>تنبيهات العمل</strong>
            </div>

            <div style={alertBlue}>
              يوجد 12 عقداً مستحق السداد خلال الأسبوع القادم
            </div>

            <div style={alertOrange}>
              يوجد 3 منتجات قاربت على النفاد من المخزون
            </div>
          </div>

          <div style={panel}>
            <div style={panelHeader}>
              <span>🕒</span>
              <strong>آخر العمليات</strong>
            </div>

            <div style={activityItem}>تم إنشاء عقد جديد للعميل أحمد محمد</div>
            <div style={activityItem}>تم تسجيل عملية سداد بمبلغ 5,000 ريال</div>
            <div style={activityItem}>تم خصم 20 بطاقة من المخزون</div>
          </div>
        </section>

        <section style={sectionsPanel}>
          <div style={panelHeader}>
            <span>⚡</span>
            <strong>أقسام محطة العمل</strong>
          </div>

          <div style={grid}>
            {sections.map((item) => (
              <button
                key={item.title}
                style={{
                  ...card,
                  boxShadow: `0 14px 34px ${item.glow}`,
                }}
              >
                <div style={cardRight}>
                  <div
                    style={{
                      ...iconBox,
                      color: item.color,
                      background: item.glow,
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
}: {
  title: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ ...statIcon, color, background: `${color}18` }}>{icon}</div>
      <div>
        <div style={statValue}>{value}</div>
        <div style={statTitle}>{title}</div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg,#edf7ff 0%,#f7f3ff 42%,#f0fdfa 100%)",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
  position: "relative",
  overflowX: "hidden",
};

const auroraOne: React.CSSProperties = {
  position: "fixed",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(37,99,235,0.22)",
  filter: "blur(85px)",
  top: -150,
  right: -140,
  pointerEvents: "none",
};

const auroraTwo: React.CSSProperties = {
  position: "fixed",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(124,58,237,0.18)",
  filter: "blur(90px)",
  top: 180,
  left: -160,
  pointerEvents: "none",
};

const auroraThree: React.CSSProperties = {
  position: "fixed",
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "rgba(20,184,166,0.18)",
  filter: "blur(85px)",
  bottom: -140,
  right: "25%",
  pointerEvents: "none",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 1200,
  margin: "auto",
  position: "relative",
  zIndex: 2,
};

const hero: React.CSSProperties = {
  background:
    "linear-gradient(135deg,rgba(255,255,255,0.82),rgba(255,255,255,0.58))",
  border: "1px solid rgba(255,255,255,0.75)",
  borderRadius: 32,
  padding: 28,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 16,
  boxShadow: "0 20px 50px rgba(37,99,235,0.12)",
  backdropFilter: "blur(18px)",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  background: "linear-gradient(135deg,#dbeafe,#ede9fe)",
  color: "#3730a3",
  border: "1px solid rgba(99,102,241,0.18)",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: 900,
  fontSize: 13,
  marginBottom: 10,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 42,
  lineHeight: 1.3,
  color: "#0f172a",
  fontWeight: 900,
};

const heroSub: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  fontSize: 17,
};

const heroOrg: React.CSSProperties = {
  minWidth: 250,
  background: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(255,255,255,0.8)",
  borderRadius: 24,
  padding: 17,
  display: "grid",
  gap: 7,
  color: "#334155",
  boxShadow: "0 12px 28px rgba(15,23,42,0.07)",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(255,255,255,0.8)",
  borderRadius: 24,
  padding: 18,
  display: "flex",
  alignItems: "center",
  gap: 14,
  boxShadow: "0 14px 34px rgba(15,23,42,0.06)",
  backdropFilter: "blur(14px)",
};

const statIcon: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 25,
  flex: "0 0 auto",
};

const statValue: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 29,
  fontWeight: 900,
};

const statTitle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
  marginTop: 4,
};

const searchCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  border: "1px solid rgba(255,255,255,0.8)",
  borderRadius: 24,
  padding: "0 16px",
  minHeight: 62,
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  boxShadow: "0 14px 30px rgba(37,99,235,0.08)",
  backdropFilter: "blur(14px)",
};

const searchIcon: React.CSSProperties = {
  color: "#2563eb",
  fontSize: 22,
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

const quickActions: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
  marginBottom: 14,
};

const quickButtonBase: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.75)",
  borderRadius: 20,
  padding: 16,
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
};

const quickPrimary: React.CSSProperties = {
  ...quickButtonBase,
  background: "linear-gradient(135deg,#dbeafe,#eff6ff)",
  color: "#1d4ed8",
};

const quickGreen: React.CSSProperties = {
  ...quickButtonBase,
  background: "linear-gradient(135deg,#dcfce7,#f0fdf4)",
  color: "#166534",
};

const quickOrange: React.CSSProperties = {
  ...quickButtonBase,
  background: "linear-gradient(135deg,#fed7aa,#fff7ed)",
  color: "#c2410c",
};

const quickPurple: React.CSSProperties = {
  ...quickButtonBase,
  background: "linear-gradient(135deg,#f3e8ff,#faf5ff)",
  color: "#7e22ce",
};

const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(255,255,255,0.82)",
  borderRadius: 26,
  padding: 18,
  boxShadow: "0 14px 34px rgba(15,23,42,0.06)",
  backdropFilter: "blur(14px)",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  color: "#0f172a",
  fontSize: 17,
  marginBottom: 13,
};

const alertBlue: React.CSSProperties = {
  background: "rgba(219,234,254,0.72)",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  borderRadius: 16,
  padding: 13,
  marginBottom: 9,
  lineHeight: 1.7,
  fontWeight: 800,
};

const alertOrange: React.CSSProperties = {
  background: "rgba(255,247,237,0.86)",
  border: "1px solid #fed7aa",
  color: "#c2410c",
  borderRadius: 16,
  padding: 13,
  marginBottom: 9,
  lineHeight: 1.7,
  fontWeight: 800,
};

const activityItem: React.CSSProperties = {
  background: "rgba(248,250,252,0.85)",
  border: "1px solid #e2e8f0",
  color: "#475569",
  borderRadius: 16,
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
  minHeight: 98,
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(255,255,255,0.85)",
  borderRadius: 24,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  backdropFilter: "blur(12px)",
};

const cardRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconBox: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
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
  background: "linear-gradient(135deg,#16a34a,#22c55e)",
  color: "white",
  border: "none",
  borderRadius: 18,
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 12px 28px rgba(22,163,74,0.20)",
};
