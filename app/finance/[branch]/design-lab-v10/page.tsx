"use client";

import { useParams } from "next/navigation";

const sections = [
  {
    title: "سير العمل",
    desc: "متابعة العمليات والتنبيهات",
    icon: "💼",
    color: "#2563eb",
    bg: "#eff6ff",
  },
  {
    title: "العملاء",
    desc: "إدارة العملاء والملفات",
    icon: "👥",
    color: "#0f766e",
    bg: "#f0fdfa",
  },
  {
    title: "طلب جديد",
    desc: "إنشاء عقد وسند",
    icon: "➕",
    color: "#16a34a",
    bg: "#f0fdf4",
  },
  {
    title: "السداد",
    desc: "تسجيل ومتابعة الدفعات",
    icon: "💳",
    color: "#059669",
    bg: "#ecfdf5",
  },
  {
    title: "المخزون",
    desc: "المنتجات والمستثمرين",
    icon: "📦",
    color: "#ea580c",
    bg: "#fff7ed",
  },
  {
    title: "العقود",
    desc: "بحث وطباعة ومتابعة",
    icon: "📄",
    color: "#4f46e5",
    bg: "#eef2ff",
  },
  {
    title: "المصروفات",
    desc: "المشتريات والمصروفات",
    icon: "🧾",
    color: "#9333ea",
    bg: "#faf5ff",
  },
  {
    title: "الملاحظات",
    desc: "ملاحظات وتذكيرات",
    icon: "✏️",
    color: "#dc2626",
    bg: "#fef2f2",
  },
  {
    title: "الصلاحيات",
    desc: "المستخدمون والأدوار",
    icon: "🔐",
    color: "#475569",
    bg: "#f8fafc",
  },
  {
    title: "الإعدادات",
    desc: "بيانات الفرع والمنظمة",
    icon: "⚙️",
    color: "#0f172a",
    bg: "#f1f5f9",
  },
];

export default function DesignLabV10Page() {
  const params = useParams();
  const branch = params.branch as string;

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <section style={hero}>
          <div>
            <span style={badge}>نموذج ١٠ — Modern Soft</span>
            <h1 style={heroTitle}>محطة العمل</h1>
            <p style={heroSub}>مؤسسة سداد و أرقام</p>
          </div>

          <div style={todayBox}>
            <span>ملخص اليوم</span>
            <strong>نظام يعمل بهدوء ووضوح</strong>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard title="العقود النشطة" value="145" icon="📄" color="#4f46e5" />
          <StatCard title="العملاء" value="812" icon="👥" color="#0f766e" />
          <StatCard title="السداد اليوم" value="28" icon="💳" color="#16a34a" />
          <StatCard title="المنتجات" value="53" icon="📦" color="#ea580c" />
        </section>

        <section style={searchCard}>
          <span style={searchIcon}>🔎</span>
          <input style={searchInput} placeholder="البحث السريع عن عميل، عقد، هوية، جوال..." />
        </section>

        <section style={quickGrid}>
          <button style={quickButton}>➕ طلب جديد</button>
          <button style={quickButton}>💳 تسجيل سداد</button>
          <button style={quickButton}>📦 إضافة مخزون</button>
          <button style={quickButton}>🧾 فاتورة مصروف</button>
        </section>

        <section style={twoColumnGrid}>
          <div style={panel}>
            <div style={sectionHeader}>
              <span>🚨</span>
              <strong>تنبيهات هادئة</strong>
            </div>

            <div style={noticeItem}>
              <span style={noticeDot} />
              يوجد 3 منتجات قاربت على النفاد
            </div>

            <div style={noticeItem}>
              <span style={noticeDot} />
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
              <button key={item.title} style={card}>
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

                <span style={arrow}>‹</span>
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
      <div style={{ ...statIcon, color }}>{icon}</div>
      <div style={statValue}>{value}</div>
      <div style={statTitle}>{title}</div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg,#f4f7fb 0%,#eef4fb 45%,#f8fafc 100%)",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 1180,
  margin: "auto",
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg,#ffffff,#f8fafc)",
  border: "1px solid #e2e8f0",
  borderRadius: 28,
  padding: 26,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 16,
  boxShadow: "0 14px 35px rgba(15,23,42,0.06)",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  background: "#eff6ff",
  color: "#2563eb",
  border: "1px solid #dbeafe",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: 900,
  fontSize: 13,
  marginBottom: 10,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 38,
  lineHeight: 1.35,
  fontWeight: 900,
};

const heroSub: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 17,
};

const todayBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
  display: "grid",
  gap: 6,
  color: "#64748b",
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
  borderRadius: 22,
  padding: 20,
  textAlign: "center",
  boxShadow: "0 10px 25px rgba(15,23,42,0.05)",
};

const statIcon: React.CSSProperties = {
  fontSize: 30,
};

const statValue: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#0f172a",
  marginTop: 8,
};

const statTitle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
  marginTop: 5,
};

const searchCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: "0 14px",
  minHeight: 58,
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  boxShadow: "0 10px 25px rgba(15,23,42,0.04)",
};

const searchIcon: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 20,
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
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 15,
  fontWeight: 900,
  fontSize: 15,
  color: "#0f172a",
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
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 10px 25px rgba(15,23,42,0.05)",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  color: "#0f172a",
  fontSize: 17,
  marginBottom: 13,
};

const noticeItem: React.CSSProperties = {
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  borderRadius: 14,
  padding: 13,
  marginBottom: 9,
  display: "flex",
  alignItems: "center",
  gap: 9,
  lineHeight: 1.7,
};

const noticeDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#f59e0b",
  flex: "0 0 auto",
};

const activityItem: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  borderRadius: 14,
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
  minHeight: 92,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const cardRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconBox: React.CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
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
  color: "#94a3b8",
  fontSize: 28,
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
