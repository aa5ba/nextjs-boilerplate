"use client";

import { useParams } from "next/navigation";

const sections = [
  {
    title: "سير العمل",
    desc: "متابعة العمليات اليومية",
    icon: "💼",
    color: "#2563eb",
  },
  {
    title: "العملاء",
    desc: "إدارة العملاء والملفات",
    icon: "👥",
    color: "#0891b2",
  },
  {
    title: "طلب جديد",
    desc: "إنشاء عقد وسند جديد",
    icon: "➕",
    color: "#16a34a",
  },
  {
    title: "السداد",
    desc: "إدارة المدفوعات والتحصيل",
    icon: "💳",
    color: "#059669",
  },
  {
    title: "المخزون",
    desc: "المنتجات والمستثمرين",
    icon: "📦",
    color: "#ea580c",
  },
  {
    title: "العقود",
    desc: "البحث والطباعة والمتابعة",
    icon: "📄",
    color: "#7c3aed",
  },
  {
    title: "المصروفات",
    desc: "فواتير المصروفات والمشتريات",
    icon: "🧾",
    color: "#c026d3",
  },
  {
    title: "الملاحظات",
    desc: "ملاحظات وتذكيرات العمل",
    icon: "✏️",
    color: "#dc2626",
  },
  {
    title: "الصلاحيات",
    desc: "إدارة المستخدمين والأدوار",
    icon: "🔐",
    color: "#64748b",
  },
  {
    title: "الإعدادات",
    desc: "بيانات الفرع والمنظمة",
    icon: "⚙️",
    color: "#f59e0b",
  },
];

export default function DesignLabV9Page() {
  const params = useParams();
  const branch = params.branch as string;

  return (
    <main dir="rtl" style={page}>
      <div style={glowOne} />
      <div style={glowTwo} />

      <div style={container}>
        <section style={hero}>
          <div>
            <div style={goldBadge}>نموذج ٩ — Luxury Finance</div>

            <h1 style={heroTitle}>محطة العمل الفاخرة</h1>

            <p style={heroSub}>
              منصة احتساب للإدارة المالية والعقود والمخزون والتحصيل
            </p>
          </div>

          <div style={heroOrgBox}>
            <span style={orgLabel}>المنظمة</span>
            <strong>مؤسسة سداد و أرقام</strong>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard title="العقود النشطة" value="145" icon="📄" />
          <StatCard title="العملاء" value="812" icon="👥" />
          <StatCard title="السداد اليوم" value="28" icon="💳" />
          <StatCard title="المنتجات" value="53" icon="📦" />
        </section>

        <section style={performanceBar}>
          <div style={performanceItem}>
            <span>العقود الجديدة اليوم</span>
            <strong>6</strong>
          </div>

          <div style={performanceItem}>
            <span>عمليات السداد</span>
            <strong>28</strong>
          </div>

          <div style={performanceItem}>
            <span>طلبات قيد المتابعة</span>
            <strong>14</strong>
          </div>

          <div style={performanceItem}>
            <span>مصروفات اليوم</span>
            <strong>3</strong>
          </div>
        </section>

        <section style={splitGrid}>
          <div style={panel}>
            <div style={sectionHeader}>
              <span>🚨</span>
              <span>تنبيهات مهمة</span>
            </div>

            <div style={alertCard}>
              يوجد 3 منتجات قاربت على النفاد من المخزون
            </div>

            <div style={alertCard}>
              يوجد 12 عقداً مستحق السداد خلال الأسبوع القادم
            </div>
          </div>

          <div style={panel}>
            <div style={sectionHeader}>
              <span>🕒</span>
              <span>آخر العمليات</span>
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
          </div>
        </section>

        <section style={sectionBox}>
          <div style={sectionHeader}>
            <span>⚡</span>
            <span>أقسام محطة العمل</span>
          </div>

          <div style={grid}>
            {sections.map((item) => (
              <button key={item.title} style={card}>
                <div style={cardRight}>
                  <div
                    style={{
                      ...iconBox,
                      background: `linear-gradient(135deg, ${item.color}, #020617)`,
                    }}
                  >
                    {item.icon}
                  </div>

                  <div>
                    <div style={cardTitle}>{item.title}</div>
                    <div style={cardDesc}>{item.desc}</div>
                  </div>
                </div>

                <div style={arrow}>‹</div>
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
    "radial-gradient(circle at top right,#1e293b 0%,#0f172a 42%,#020617 100%)",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
  position: "relative",
  overflowX: "hidden",
};

const glowOne: React.CSSProperties = {
  position: "fixed",
  width: 360,
  height: 360,
  borderRadius: "50%",
  background: "rgba(251,191,36,0.16)",
  filter: "blur(70px)",
  top: -120,
  right: -100,
  pointerEvents: "none",
};

const glowTwo: React.CSSProperties = {
  position: "fixed",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(37,99,235,0.18)",
  filter: "blur(80px)",
  bottom: -150,
  left: -120,
  pointerEvents: "none",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 1240,
  margin: "auto",
  position: "relative",
  zIndex: 2,
};

const hero: React.CSSProperties = {
  background:
    "linear-gradient(135deg,rgba(2,6,23,0.92),rgba(15,23,42,0.86),rgba(30,41,59,0.78))",
  color: "white",
  borderRadius: 32,
  padding: 32,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
  flexWrap: "wrap",
  gap: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.38)",
  backdropFilter: "blur(18px)",
};

const goldBadge: React.CSSProperties = {
  display: "inline-block",
  background: "linear-gradient(135deg,#fbbf24,#fde68a)",
  color: "#111827",
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 12,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 40,
  lineHeight: 1.35,
  fontWeight: 900,
};

const heroSub: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#cbd5e1",
  fontSize: 16,
  lineHeight: 1.8,
};

const heroOrgBox: React.CSSProperties = {
  minWidth: 240,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 22,
  padding: 18,
  display: "grid",
  gap: 6,
  color: "#f8fafc",
  backdropFilter: "blur(12px)",
};

const orgLabel: React.CSSProperties = {
  color: "#fbbf24",
  fontSize: 13,
  fontWeight: 800,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const statCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 24,
  padding: 24,
  textAlign: "center",
  color: "white",
  boxShadow: "0 18px 35px rgba(0,0,0,0.22)",
};

const statIcon: React.CSSProperties = {
  fontSize: 34,
};

const statValue: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  marginTop: 10,
  color: "#f8fafc",
};

const statTitle: React.CSSProperties = {
  marginTop: 8,
  color: "#cbd5e1",
  fontWeight: 800,
};

const performanceBar: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 24,
  padding: 14,
  marginBottom: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
  backdropFilter: "blur(16px)",
};

const performanceItem: React.CSSProperties = {
  background: "rgba(2,6,23,0.35)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 14,
  color: "#cbd5e1",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const splitGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(16px)",
  borderRadius: 24,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  color: "white",
};

const sectionBox: React.CSSProperties = {
  ...panel,
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  fontSize: 18,
  fontWeight: 900,
  marginBottom: 14,
  color: "white",
};

const alertCard: React.CSSProperties = {
  background: "rgba(251,191,36,0.15)",
  border: "1px solid rgba(251,191,36,0.25)",
  color: "#fde68a",
  borderRadius: 16,
  padding: 14,
  marginBottom: 10,
  lineHeight: 1.7,
};

const activityCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: 14,
  marginBottom: 10,
  color: "#e2e8f0",
  lineHeight: 1.7,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))",
  gap: 14,
};

const card: React.CSSProperties = {
  width: "100%",
  minHeight: 92,
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 22,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "white",
  boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
  cursor: "pointer",
};

const cardRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconBox: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
  fontSize: 23,
  boxShadow: "0 10px 20px rgba(0,0,0,0.22)",
};

const cardTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "white",
};

const cardDesc: React.CSSProperties = {
  marginTop: 5,
  color: "#cbd5e1",
  fontSize: 13,
};

const arrow: React.CSSProperties = {
  fontSize: 30,
  color: "#fbbf24",
};

const backButton: React.CSSProperties = {
  width: "100%",
  marginTop: 18,
  padding: 16,
  background: "linear-gradient(135deg,#fbbf24,#fde68a)",
  color: "#111827",
  border: "none",
  borderRadius: 16,
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};
