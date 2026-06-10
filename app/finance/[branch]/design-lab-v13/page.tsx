"use client";

import { useParams } from "next/navigation";

const sections = [
  { title: "سير العمل", path: "workflow", desc: "متابعة العمليات والتنبيهات", icon: "💼", color: "#2563eb", bg: "linear-gradient(135deg,#eff6ff,#dbeafe)" },
  { title: "العملاء", path: "customers", desc: "إدارة العملاء والملفات", icon: "👥", color: "#0284c7", bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)" },
  { title: "طلب جديد", path: "new-request", desc: "إنشاء عقد وسند جديد", icon: "➕", color: "#16a34a", bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)" },
  { title: "السداد", path: "payments", desc: "تسجيل ومتابعة الدفعات", icon: "💳", color: "#059669", bg: "linear-gradient(135deg,#ecfdf5,#d1fae5)" },
  { title: "المخزون", path: "inventory", desc: "المنتجات والمستثمرين", icon: "📦", color: "#0f766e", bg: "linear-gradient(135deg,#f0fdfa,#ccfbf1)" },
  { title: "العقود", path: "contracts", desc: "بحث وطباعة ومتابعة", icon: "📄", color: "#1d4ed8", bg: "linear-gradient(135deg,#eef2ff,#dbeafe)" },
  { title: "المصروفات", path: "expenses", desc: "المشتريات والمصروفات", icon: "🧾", color: "#475569", bg: "linear-gradient(135deg,#f8fafc,#e2e8f0)" },
  { title: "الملاحظات", path: "notes", desc: "ملاحظات وتذكيرات", icon: "✏️", color: "#0ea5e9", bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)" },
  { title: "الصلاحيات", path: "permissions", desc: "المستخدمون والأدوار", icon: "🔐", color: "#334155", bg: "linear-gradient(135deg,#f8fafc,#e2e8f0)" },
  { title: "الإعدادات", path: "settings", desc: "بيانات الفرع والمنظمة", icon: "⚙️", color: "#0f172a", bg: "linear-gradient(135deg,#f1f5f9,#e2e8f0)" },
];

export default function DesignLabV13Page() {
  const params = useParams();
  const branch = params.branch as string;

  function go(path: string) {
    window.location.href = `/finance/${branch}/${path}`;
  }

  return (
    <main dir="rtl" style={page}>
      <div style={backgroundGlowOne} />
      <div style={backgroundGlowTwo} />

      <div style={container}>
        <section style={hero}>
          <div>
            <span style={badge}>نموذج ١٣ — Blue Green Professional</span>
            <h1 style={heroTitle}>محطة العمل</h1>
            <p style={heroSub}>لوحة تشغيل مالية حديثة، مريحة، وسريعة الاستخدام</p>
          </div>

          <div style={heroCard}>
            <span>🏢 مؤسسة سداد و أرقام</span>
            <strong>جاهز للعمل اليومي</strong>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard title="العقود النشطة" value="145" icon="📄" color="#2563eb" />
          <StatCard title="العملاء" value="812" icon="👥" color="#0284c7" />
          <StatCard title="السداد اليوم" value="28" icon="💳" color="#16a34a" />
          <StatCard title="المنتجات" value="53" icon="📦" color="#0f766e" />
        </section>

        <section style={searchCard}>
          <span style={searchIcon}>🔎</span>
          <input
            style={searchInput}
            placeholder="البحث السريع: اسم العميل، رقم العقد، الهوية، الجوال..."
          />
        </section>

        <section style={quickActions}>
          <button style={primaryAction} onClick={() => go("new-request")}>➕ طلب جديد</button>
          <button style={greenAction} onClick={() => go("payments/new")}>💳 تسجيل سداد</button>
          <button style={tealAction} onClick={() => go("inventory/add")}>📦 إضافة مخزون</button>
          <button style={grayAction} onClick={() => go("expenses/new")}>🧾 فاتورة مصروف</button>
        </section>

        <section style={infoGrid}>
          <div style={panel}>
            <div style={panelHeader}>
              <span style={panelIconBlue}>🚨</span>
              <strong>تنبيهات مهمة</strong>
            </div>

            <div style={noticeBlue}>يوجد 12 عقداً مستحق السداد خلال الأسبوع القادم</div>
            <div style={noticeGreen}>يوجد 3 منتجات قاربت على النفاد من المخزون</div>
          </div>

          <div style={panel}>
            <div style={panelHeader}>
              <span style={panelIconGreen}>🕒</span>
              <strong>آخر العمليات</strong>
            </div>

            <div style={activityItem}>تم إنشاء عقد جديد للعميل أحمد محمد</div>
            <div style={activityItem}>تم تسجيل عملية سداد بمبلغ 5,000 ريال</div>
            <div style={activityItem}>تم إضافة فاتورة مصروف جديدة</div>
          </div>
        </section>

        <section style={sectionsPanel}>
          <div style={panelHeader}>
            <span style={panelIconBlue}>⚡</span>
            <strong>أقسام محطة العمل</strong>
          </div>

          <div style={grid}>
            {sections.map((item) => (
              <button
                key={item.title}
                style={sectionCard}
                onClick={() => go(item.path)}
              >
                <div style={cardRight}>
                  <div style={{ ...iconBox, background: item.bg, color: item.color }}>
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
      <div style={{ ...statIcon, background: `${color}14`, color }}>{icon}</div>
      <div>
        <div style={statValue}>{value}</div>
        <div style={statTitle}>{title}</div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(135deg,#f1f8ff 0%,#f4fbf8 45%,#f8fafc 100%)",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
  position: "relative",
  overflowX: "hidden",
};

const backgroundGlowOne: React.CSSProperties = {
  position: "fixed",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(37,99,235,0.14)",
  filter: "blur(85px)",
  top: -150,
  right: -150,
  pointerEvents: "none",
};

const backgroundGlowTwo: React.CSSProperties = {
  position: "fixed",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(22,163,74,0.12)",
  filter: "blur(85px)",
  bottom: -160,
  left: -140,
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
  background: "linear-gradient(135deg,#0f172a 0%,#1d4ed8 48%,#0f766e 100%)",
  borderRadius: 30,
  padding: 24,
  color: "white",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 16,
  boxShadow: "0 18px 45px rgba(29,78,216,0.18)",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(255,255,255,0.15)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.24)",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: 900,
  fontSize: 13,
  marginBottom: 10,
  backdropFilter: "blur(8px)",
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 38,
  lineHeight: 1.35,
  fontWeight: 900,
};

const heroSub: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#e0f2fe",
  fontSize: 16,
  lineHeight: 1.7,
};

const heroCard: React.CSSProperties = {
  minWidth: 245,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 22,
  padding: 16,
  display: "grid",
  gap: 7,
  backdropFilter: "blur(10px)",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 18,
  display: "flex",
  alignItems: "center",
  gap: 14,
  boxShadow: "0 12px 28px rgba(15,23,42,0.05)",
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
  background: "rgba(255,255,255,0.98)",
  border: "1px solid #dbeafe",
  borderRadius: 24,
  padding: "0 16px",
  minHeight: 62,
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  boxShadow: "0 12px 28px rgba(37,99,235,0.07)",
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

const actionBase: React.CSSProperties = {
  border: "none",
  borderRadius: 18,
  padding: 16,
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
};

const primaryAction: React.CSSProperties = {
  ...actionBase,
  background: "linear-gradient(135deg,#2563eb,#60a5fa)",
  color: "white",
};

const greenAction: React.CSSProperties = {
  ...actionBase,
  background: "linear-gradient(135deg,#16a34a,#4ade80)",
  color: "white",
};

const tealAction: React.CSSProperties = {
  ...actionBase,
  background: "linear-gradient(135deg,#0f766e,#2dd4bf)",
  color: "white",
};

const grayAction: React.CSSProperties = {
  ...actionBase,
  background: "linear-gradient(135deg,#475569,#94a3b8)",
  color: "white",
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.98)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 12px 28px rgba(15,23,42,0.05)",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  color: "#0f172a",
  fontSize: 17,
  marginBottom: 13,
};

const panelIconBlue: React.CSSProperties = {
  background: "#eff6ff",
  color: "#2563eb",
  width: 36,
  height: 36,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const panelIconGreen: React.CSSProperties = {
  ...panelIconBlue,
  background: "#f0fdf4",
  color: "#16a34a",
};

const noticeBlue: React.CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  borderRadius: 15,
  padding: 13,
  marginBottom: 9,
  lineHeight: 1.7,
  fontWeight: 800,
};

const noticeGreen: React.CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  borderRadius: 15,
  padding: 13,
  marginBottom: 9,
  lineHeight: 1.7,
  fontWeight: 800,
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

const sectionCard: React.CSSProperties = {
  width: "100%",
  minHeight: 96,
  background: "linear-gradient(135deg,#ffffff,#f8fafc)",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
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
  boxShadow: "0 12px 28px rgba(22,163,74,0.18)",
};
