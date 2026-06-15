"use client";

import { useEffect, useState } from "react";
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
    <main dir="rtl" className="finance-design-page">
      <div className="page-overlay">
        <div className="container">
          <header className="modern-hero">
            <div className="hero-wave-one" />
            <div className="hero-wave-two" />
            <div className="hero-soft-circle" />
            <div className="hero-dots" />

            <div className="hero-left-box">
              <div className="employee-row">
                <div className="employee-mark">م</div>

                <div className="employee-text">
                  <div className="employee-name">{employeeName}</div>

                  <button className="logout-button" onClick={logout}>
                    تسجيل الخروج
                  </button>
                </div>
              </div>

              <button
                className="main-workstation-button"
                onClick={() => router.push(`/finance/${branch}`)}
              >
                محطة العمل الرئيسية
              </button>
            </div>

            <div className="hero-title-box">
              <h1 className="hero-title">طلب جديد</h1>
              <p className="hero-subtitle">نموذج الهيدر رقم ٨ — نسخة خفيفة عصرية</p>
            </div>
          </header>

          <section className="stats-grid">
            <StatCard title="العقود النشطة" value="145" icon="📄" color="#4f46e5" />
            <StatCard title="العملاء" value="812" icon="👥" color="#0f766e" />
            <StatCard title="السداد اليوم" value="28" icon="💳" color="#16a34a" />
            <StatCard title="المنتجات" value="53" icon="📦" color="#ea580c" />
          </section>

          <section className="search-card">
            <span className="search-icon">🔎</span>
            <input
              className="search-input"
              placeholder="البحث السريع عن عميل، عقد، هوية، جوال..."
            />
          </section>

          <section className="quick-grid">
            <button className="quick-button">➕ طلب جديد</button>
            <button className="quick-button">💳 تسجيل سداد</button>
            <button className="quick-button">📦 إضافة مخزون</button>
            <button className="quick-button">🧾 فاتورة مصروف</button>
          </section>

          <section className="two-column-grid">
            <div className="panel">
              <div className="section-header">
                <span>🚨</span>
                <strong>تنبيهات هادئة</strong>
              </div>

              <div className="notice-item">
                <span className="notice-dot" />
                يوجد 3 منتجات قاربت على النفاد
              </div>

              <div className="notice-item">
                <span className="notice-dot" />
                يوجد 12 عقدًا مستحقًا خلال الأسبوع
              </div>
            </div>

            <div className="panel">
              <div className="section-header">
                <span>🕒</span>
                <strong>آخر العمليات</strong>
              </div>

              <div className="activity-item">تم إنشاء عقد جديد للعميل أحمد محمد</div>
              <div className="activity-item">تم تسجيل سداد بمبلغ 5,000 ريال</div>
              <div className="activity-item">تم خصم 20 بطاقة من المخزون</div>
            </div>
          </section>

          <section className="panel sections-panel">
            <div className="section-header">
              <span>⚡</span>
              <strong>أقسام محطة العمل</strong>
            </div>

            <div className="sections-grid">
              {sections.map((item) => (
                <button key={item.title} className="section-card">
                  <div className="section-card-right">
                    <div
                      className="section-icon-box"
                      style={{
                        background: item.bg,
                        color: item.color,
                      }}
                    >
                      {item.icon}
                    </div>

                    <div>
                      <div className="section-card-title">{item.title}</div>
                      <div className="section-card-desc">{item.desc}</div>
                    </div>
                  </div>

                  <span className="section-arrow">‹</span>
                </button>
              ))}
            </div>
          </section>

          <div className="bottom-back-wrapper">
            <button className="back-button" onClick={() => router.back()}>
              ← الرجوع
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .finance-design-page {
          min-height: 100vh;
          background-color: #f6f9ff;
          background-image:
            radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
            radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%),
            radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%),
            linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
            url('/backgrounds/v13-finance-bg-1.png');
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
          font-family: var(--font-almarai), sans-serif;
        }

        .page-overlay {
          min-height: 100vh;
          padding: 18px;
          background: linear-gradient(
            180deg,
            rgba(255,255,255,0.20) 0%,
            rgba(248,250,252,0.58) 100%
          );
        }

        .container {
          width: 100%;
          max-width: 1180px;
          margin: auto;
        }

        .modern-hero {
          position: relative;
          min-height: 160px;
          border-radius: 24px;
          padding: 24px;
          margin-bottom: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.26);
          background:
            linear-gradient(
              135deg,
              #071b46 0%,
              #0b327c 28%,
              #0f66d8 58%,
              #33b5ef 82%,
              #9be7f4 100%
            );
          box-shadow: 0 18px 42px rgba(15,23,42,0.18);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-wave-one {
          position: absolute;
          left: -120px;
          bottom: -118px;
          width: 72%;
          height: 210px;
          border-radius: 50%;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.02),
            rgba(255,255,255,0.13)
          );
          transform: rotate(-5deg);
        }

        .hero-wave-two {
          position: absolute;
          right: -100px;
          bottom: -130px;
          width: 72%;
          height: 230px;
          border-radius: 50%;
          border-top: 2px solid rgba(255,255,255,0.22);
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.03),
            rgba(255,255,255,0.16)
          );
          transform: rotate(-7deg);
        }

        .hero-soft-circle {
          position: absolute;
          top: -95px;
          left: 38%;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
        }

        .hero-dots {
          position: absolute;
          top: 32px;
          right: 34px;
          width: 92px;
          height: 68px;
          opacity: 0.55;
          background-image: radial-gradient(rgba(255,255,255,0.55) 2px, transparent 2px);
          background-size: 14px 14px;
        }

        .hero-left-box {
          position: absolute;
          top: 22px;
          left: 22px;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 14px;
          direction: rtl;
        }

        .employee-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-left: 16px;
          border-left: 1px solid rgba(255,255,255,0.24);
        }

        .employee-mark {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.18);
          color: #ffffff;
          font-size: 17px;
          font-weight: 900;
          box-shadow: 0 8px 18px rgba(15,23,42,0.14);
        }

        .employee-text {
          display: grid;
          gap: 5px;
          min-width: 112px;
        }

        .employee-name {
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.4;
          white-space: nowrap;
        }

        .logout-button {
          width: fit-content;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.82);
          font-size: 12px;
          font-weight: 800;
          padding: 0;
          cursor: pointer;
          font-family: var(--font-almarai), sans-serif;
        }

        .logout-button:hover {
          color: #ffffff;
          text-decoration: underline;
        }

        .main-workstation-button {
          border: 1px solid rgba(255,255,255,0.22);
          background: linear-gradient(135deg,#34d399,#16a34a 58%,#15803d);
          color: #ffffff;
          border-radius: 14px;
          padding: 11px 18px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          font-family: var(--font-almarai), sans-serif;
          box-shadow: 0 10px 22px rgba(22,163,74,0.24);
          white-space: nowrap;
        }

        .main-workstation-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 26px rgba(22,163,74,0.30);
        }

        .hero-title-box {
          position: relative;
          z-index: 2;
          text-align: center;
          padding: 0 280px;
        }

        .hero-title {
          margin: 0;
          color: #ffffff;
          font-size: 36px;
          line-height: 1.35;
          font-weight: 900;
          letter-spacing: -0.6px;
          text-shadow: 0 8px 22px rgba(15,23,42,0.20);
        }

        .hero-subtitle {
          margin: 8px 0 0;
          color: rgba(255,255,255,0.82);
          font-size: 13px;
          font-weight: 800;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(210px,1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .stat-card {
          background: rgba(255,255,255,0.96);
          border: 1px solid rgba(226,232,240,0.90);
          border-radius: 22px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 12px 28px rgba(37,99,235,0.07);
        }

        .stat-icon {
          font-size: 30px;
        }

        .stat-value {
          font-size: 30px;
          font-weight: 900;
          color: #0f172a;
          margin-top: 8px;
        }

        .stat-title {
          color: #64748b;
          font-weight: 800;
          margin-top: 5px;
        }

        .search-card {
          background: rgba(255,255,255,0.96);
          border: 1px solid #dbeafe;
          border-radius: 20px;
          padding: 0 14px;
          min-height: 58px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
          box-shadow: 0 10px 25px rgba(37,99,235,0.05);
        }

        .search-icon {
          color: #60a5fa;
          font-size: 20px;
        }

        .search-input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          font-size: 16px;
          color: #0f172a;
          font-family: var(--font-almarai), sans-serif;
        }

        .quick-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(170px,1fr));
          gap: 10px;
          margin-bottom: 14px;
        }

        .quick-button {
          background: linear-gradient(135deg,#ffffff,#f8fbff);
          border: 1px solid #dbeafe;
          border-radius: 18px;
          padding: 15px;
          font-weight: 900;
          font-size: 15px;
          color: #1e3a8a;
          cursor: pointer;
          font-family: var(--font-almarai), sans-serif;
          box-shadow: 0 8px 20px rgba(37,99,235,0.06);
        }

        .two-column-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(300px,1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .panel {
          background: rgba(255,255,255,0.96);
          border: 1px solid rgba(226,232,240,0.92);
          border-radius: 22px;
          padding: 18px;
          box-shadow: 0 12px 28px rgba(37,99,235,0.06);
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #0f172a;
          font-size: 17px;
          margin-bottom: 13px;
        }

        .notice-item {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #9a3412;
          border-radius: 14px;
          padding: 13px;
          margin-bottom: 9px;
          display: flex;
          align-items: center;
          gap: 9px;
          line-height: 1.7;
        }

        .notice-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fb923c;
          flex: 0 0 auto;
        }

        .activity-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #475569;
          border-radius: 14px;
          padding: 13px;
          margin-bottom: 9px;
          line-height: 1.7;
        }

        .sections-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit,minmax(250px,1fr));
          gap: 12px;
        }

        .section-card {
          width: 100%;
          min-height: 92px;
          background: linear-gradient(135deg,#ffffff,#fbfdff);
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(37,99,235,0.04);
          font-family: var(--font-almarai), sans-serif;
        }

        .section-card-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .section-icon-box {
          width: 50px;
          height: 50px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex: 0 0 auto;
        }

        .section-card-title {
          font-weight: 900;
          font-size: 16px;
          color: #0f172a;
          text-align: right;
        }

        .section-card-desc {
          color: #64748b;
          font-size: 13px;
          margin-top: 5px;
          text-align: right;
        }

        .section-arrow {
          color: #94a3b8;
          font-size: 28px;
        }

        .bottom-back-wrapper {
          display: flex;
          justify-content: center;
          margin-top: 16px;
        }

        .back-button {
          border: 1px solid rgba(255,255,255,.20);
          background: linear-gradient(135deg,#64748b,#334155);
          color: #ffffff;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
          font-family: var(--font-almarai), sans-serif;
          box-shadow: 0 8px 18px rgba(15,23,42,.20);
        }

        @media (max-width: 820px) {
          .modern-hero {
            min-height: auto;
            padding: 18px;
            display: grid;
            gap: 18px;
            justify-content: initial;
          }

          .hero-left-box {
            position: relative;
            top: auto;
            left: auto;
            justify-content: center;
            flex-wrap: wrap;
            width: 100%;
          }

          .employee-row {
            border-left: none;
            padding-left: 0;
          }

          .hero-title-box {
            padding: 0;
          }

          .hero-title {
            font-size: 26px;
          }

          .hero-subtitle {
            font-size: 12px;
          }
        }

        @media (max-width: 520px) {
          .page-overlay {
            padding: 12px;
          }

          .modern-hero {
            border-radius: 20px;
          }

          .hero-left-box {
            display: grid;
            gap: 10px;
          }

          .employee-row {
            justify-content: center;
          }

          .main-workstation-button {
            width: 100%;
            padding: 12px 14px;
          }

          .hero-title {
            font-size: 24px;
          }

          .stats-grid,
          .quick-grid,
          .two-column-grid,
          .sections-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
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
    <div className="stat-card">
      <div className="stat-icon" style={{ color }}>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-title">{title}</div>
    </div>
  );
}
