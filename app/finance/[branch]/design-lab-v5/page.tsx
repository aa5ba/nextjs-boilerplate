"use client";

import { useParams } from "next/navigation";

const sections = [
  { title: "سير العمل", icon: "💼", color: "#1d4ed8" },
  { title: "العملاء", icon: "👥", color: "#0891b2" },
  { title: "طلب جديد", icon: "➕", color: "#16a34a" },
  { title: "السداد", icon: "💳", color: "#059669" },
  { title: "المخزون", icon: "📦", color: "#ea580c" },
  { title: "العقود", icon: "📄", color: "#7c3aed" },
  { title: "الملاحظات", icon: "✏️", color: "#dc2626" },
  { title: "الصلاحيات", icon: "🔐", color: "#475569" },
  { title: "الإعدادات", icon: "⚙️", color: "#0f172a" },
];

export default function DesignLabV5Page() {
  const params = useParams();
  const branch = params.branch as string;

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <section style={hero}>
          <div>
            <h1 style={heroTitle}>مركز العمليات</h1>
            <p style={heroSub}>
              لوحة تحكم احتساب - نموذج V5
            </p>
          </div>

          <div style={heroBadge}>
            🏢 مؤسسة سداد و أرقام
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard title="العقود النشطة" value="145" icon="📄" />
          <StatCard title="العملاء" value="812" icon="👥" />
          <StatCard title="السداد اليوم" value="28" icon="💳" />
          <StatCard title="المنتجات" value="53" icon="📦" />
        </section>

        <section style={alertsSection}>
          <div style={sectionHeader}>
            <span>🚨</span>
            <span>التنبيهات</span>
          </div>

          <div style={alertCard}>
            يوجد 3 منتجات قاربت على النفاد من المخزون
          </div>

          <div style={alertCard}>
            يوجد 12 عقداً مستحق السداد خلال الأسبوع القادم
          </div>
        </section>

        <section style={recentSection}>
          <div style={sectionHeader}>
            <span>🕒</span>
            <span>آخر النشاطات</span>
          </div>

          <div style={activityCard}>
            تم إنشاء عقد جديد للعميل أحمد محمد
          </div>

          <div style={activityCard}>
            تم تسجيل عملية سداد بمبلغ 5,000 ريال
          </div>

          <div style={activityCard}>
            تم خصم 20 بطاقة من المخزون
          </div>
        </section>

        <section style={sectionBox}>
          <div style={sectionHeader}>
            <span>⚡</span>
            <span>أقسام محطة العمل</span>
          </div>

          <div style={grid}>
            {sections.map((item) => (
              <div
                key={item.title}
                style={{
                  ...card,
                  borderTop: `5px solid ${item.color}`,
                }}
              >
                <div style={cardRight}>
                  <div
                    style={{
                      ...iconBox,
                      background: item.color,
                    }}
                  >
                    {item.icon}
                  </div>

                  <div style={cardTitle}>
                    {item.title}
                  </div>
                </div>

                <div style={arrow}>‹</div>
              </div>
            ))}
          </div>
        </section>

        <button
          style={backButton}
          onClick={() =>
            (window.location.href = `/finance/${branch}`)
          }
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
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div style={statCard}>
      <div style={statIcon}>{icon}</div>
      <div style={statValue}>{value}</div>
      <div style={statTitle}>{title}</div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg,#eef4ff 0%,#f8fafc 100%)",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 1200,
  margin: "auto",
};

const hero: React.CSSProperties = {
  background:
    "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  borderRadius: 28,
  padding: 28,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
  flexWrap: "wrap",
  gap: 14,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
};

const heroSub: React.CSSProperties = {
  marginTop: 8,
  opacity: 0.9,
};

const heroBadge: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)",
  padding: "12px 18px",
  borderRadius: 999,
  backdropFilter: "blur(8px)",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const statCard: React.CSSProperties = {
  background: "white",
  borderRadius: 22,
  padding: 22,
  textAlign: "center",
  boxShadow: "0 10px 25px rgba(0,0,0,0.06)",
};

const statIcon: React.CSSProperties = {
  fontSize: 32,
};

const statValue: React.CSSProperties = {
  fontSize: 32,
  fontWeight: "bold",
  marginTop: 10,
};

const statTitle: React.CSSProperties = {
  marginTop: 6,
  color: "#64748b",
};

const alertsSection: React.CSSProperties = {
  background: "white",
  borderRadius: 22,
  padding: 18,
  marginBottom: 18,
};

const recentSection = alertsSection;

const sectionBox = alertsSection;

const sectionHeader: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 14,
};

const alertCard: React.CSSProperties = {
  background: "#fef3c7",
  borderRadius: 14,
  padding: 14,
  marginBottom: 10,
};

const activityCard: React.CSSProperties = {
  background: "#f8fafc",
  borderRadius: 14,
  padding: 14,
  marginBottom: 10,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(250px,1fr))",
  gap: 14,
};

const card: React.CSSProperties = {
  background: "white",
  borderRadius: 18,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
};

const cardRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconBox: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
  fontSize: 22,
};

const cardTitle: React.CSSProperties = {
  fontWeight: "bold",
  fontSize: 16,
};

const arrow: React.CSSProperties = {
  fontSize: 28,
  color: "#2563eb",
};

const backButton: React.CSSProperties = {
  width: "100%",
  marginTop: 18,
  padding: 16,
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
};
