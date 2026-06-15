"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";

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
  const router = useRouter();

  const branch = params.branch as string;

  const [employeeName, setEmployeeName] = useState("الموظف");

  useEffect(() => {
    loadEmployeeName();
  }, []);

  function loadEmployeeName() {
    if (typeof window === "undefined") return;

    const newName = localStorage.getItem("finance_user_name");

    if (newName) {
      setEmployeeName(newName);
      return;
    }

    const oldUser = localStorage.getItem("finance_user");

    if (oldUser) {
      try {
        const parsed = JSON.parse(oldUser);
        setEmployeeName(parsed?.full_name || parsed?.username || "الموظف");
        return;
      } catch {
        setEmployeeName("الموظف");
      }
    }
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_branch_user");
    }

    router.push(`/finance/${branch}/login`);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={pageOverlay}>
        <div style={container}>
          <header style={hero}>
            <div style={heroSoftCircleOne} />
            <div style={heroSoftCircleTwo} />

            <div style={employeeBox}>
              <div style={employeeNameBox}>{employeeName}</div>

              <button style={logoutButton} onClick={logout}>
                تسجيل الخروج
              </button>

              <button
                style={mainWorkstationButton}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                محطة العمل الرئيسية
              </button>
            </div>

            <div style={centerTitleBox}>
              <span style={badge}>نموذج تصميم تجريبي</span>
              <h1 style={pageTitle}>طلب جديد</h1>
              <p style={pageSubTitle}>تجربة الهيدر والخلفية قبل اعتمادها</p>
            </div>
          </header>

          <section style={statsGrid}>
            <StatCard title="العقود النشطة" value="145" icon="📄" color="#4f46e5" />
            <StatCard title="العملاء" value="812" icon="👥" color="#0f766e" />
            <StatCard title="السداد اليوم" value="28" icon="💳" color="#16a34a" />
            <StatCard title="المنتجات" value="53" icon="📦" color="#ea580c" />
          </section>

          <section style={searchCard}>
            <span style={searchIcon}>🔎</span>
            <input
              style={searchInput}
              placeholder="البحث السريع عن عميل، عقد، هوية، جوال..."
            />
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
                يوجد 12 عقدًا مستحقًا خلال الأسبوع
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

          <div style={bottomBackWrapper}>
            <button style={backButton} onClick={() => router.back()}>
              ← الرجوع
            </button>
          </div>
        </div>
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

const page: CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f6f9ff",
  backgroundImage: `
    radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
    radial-gradient(circle at 88% 12%, rgba(168,85,247,0.13) 0, transparent 26%),
    radial-gradient(circle at 80% 88%, rgba(34,197,94,0.11) 0, transparent 28%),
    linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
    url('/backgrounds/v13-finance-bg-1.png')
  `,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
  fontFamily: "var(--font-almarai), sans-serif",
};

const pageOverlay: CSSProperties = {
  minHeight: "100vh",
  padding: 18,
  background:
    "linear-gradient(180deg,rgba(255,255,255,0.20) 0%,rgba(248,250,252,0.58) 100%)",
};

const container: CSSProperties = {
  width: "100%",
  maxWidth: 1180,
  margin: "auto",
};

const hero: CSSProperties = {
  position: "relative",
  minHeight: 160,
  background:
    "linear-gradient(135deg,rgba(15,23,42,0.97),rgba(30,64,175,0.94) 48%,rgba(14,116,144,0.92))",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 24,
  padding: 24,
  marginBottom: 16,
  boxShadow: "0 18px 42px rgba(15,23,42,0.20)",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const heroSoftCircleOne: CSSProperties = {
  position: "absolute",
  top: -85,
  right: -70,
  width: 220,
  height: 220,
  borderRadius: "50%",
  background: "rgba(56,189,248,0.14)",
};

const heroSoftCircleTwo: CSSProperties = {
  position: "absolute",
  bottom: -95,
  left: 150,
  width: 260,
  height: 260,
  borderRadius: "50%",
  background: "rgba(129,140,248,0.13)",
};

const employeeBox: CSSProperties = {
  position: "absolute",
  top: 18,
  left: 18,
  width: 190,
  display: "grid",
  gap: 8,
  textAlign: "center",
  zIndex: 2,
};

const employeeNameBox: CSSProperties = {
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.20)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "9px 10px",
  fontSize: 14,
  fontWeight: 900,
  boxShadow: "0 8px 18px rgba(15,23,42,0.12)",
};

const logoutButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.20)",
  background: "rgba(255,255,255,0.10)",
  color: "#fee2e2",
  borderRadius: 12,
  padding: "9px 10px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const mainWorkstationButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.24)",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,0.18)",
};

const centerTitleBox: CSSProperties = {
  textAlign: "center",
  padding: "0 210px",
  position: "relative",
  zIndex: 1,
};

const badge: CSSProperties = {
  display: "inline-block",
  background: "rgba(255,255,255,0.13)",
  color: "#e0f2fe",
  border: "1px solid rgba(224,242,254,0.24)",
  borderRadius: 999,
  padding: "6px 12px",
  fontWeight: 900,
  fontSize: 12,
  marginBottom: 8,
};

const pageTitle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 30,
  lineHeight: 1.35,
  fontWeight: 900,
  letterSpacing: "-0.4px",
};

const pageSubTitle: CSSProperties = {
  margin: "7px 0 0",
  color: "#dbeafe",
  fontSize: 14,
  lineHeight: 1.7,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(226,232,240,0.90)",
  borderRadius: 22,
  padding: 20,
  textAlign: "center",
  boxShadow: "0 12px 28px rgba(37,99,235,0.07)",
};

const statIcon: CSSProperties = {
  fontSize: 30,
};

const statValue: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#0f172a",
  marginTop: 8,
};

const statTitle: CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
  marginTop: 5,
};

const searchCard: CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #dbeafe",
  borderRadius: 20,
  padding: "0 14px",
  minHeight: 58,
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  boxShadow: "0 10px 25px rgba(37,99,235,0.05)",
};

const searchIcon: CSSProperties = {
  color: "#60a5fa",
  fontSize: 20,
};

const searchInput: CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: 16,
  color: "#0f172a",
  fontFamily: "var(--font-almarai), sans-serif",
};

const quickGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
  marginBottom: 14,
};

const quickButton: CSSProperties = {
  background: "linear-gradient(135deg,#ffffff,#f8fbff)",
  border: "1px solid #dbeafe",
  borderRadius: 18,
  padding: 15,
  fontWeight: 900,
  fontSize: 15,
  color: "#1e3a8a",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(37,99,235,0.06)",
};

const twoColumnGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const panel: CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(226,232,240,0.92)",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 12px 28px rgba(37,99,235,0.06)",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  color: "#0f172a",
  fontSize: 17,
  marginBottom: 13,
};

const noticeItem: CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  borderRadius: 14,
  padding: 13,
  marginBottom: 9,
  display: "flex",
  alignItems: "center",
  gap: 9,
  lineHeight: 1.7,
};

const noticeDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#fb923c",
  flex: "0 0 auto",
};

const activityItem: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  borderRadius: 14,
  padding: 13,
  marginBottom: 9,
  lineHeight: 1.7,
};

const sectionsPanel: CSSProperties = {
  ...panel,
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
  gap: 12,
};

const card: CSSProperties = {
  width: "100%",
  minHeight: 92,
  background: "linear-gradient(135deg,#ffffff,#fbfdff)",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(37,99,235,0.04)",
};

const cardRight: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconBox: CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  flex: "0 0 auto",
};

const cardTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#0f172a",
};

const cardDesc: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 5,
};

const arrow: CSSProperties = {
  color: "#94a3b8",
  fontSize: 28,
};

const bottomBackWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 16,
};

const backButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.20)",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,.20)",
};
