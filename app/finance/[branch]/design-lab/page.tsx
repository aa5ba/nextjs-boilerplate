"use client";

import { useParams } from "next/navigation";

const sections = [
  { title: "سير العمل", icon: "💼" },
  { title: "العملاء", icon: "👥" },
  { title: "طلب جديد", icon: "➕" },
  { title: "سداد", icon: "💳" },
  { title: "المخزون والمنتجات", icon: "📦" },
  { title: "العقود", icon: "📄" },
  { title: "المصروفات والمشتريات", icon: "🧾" },
  { title: "الملاحظات", icon: "✏️" },
  { title: "الصلاحيات", icon: "🔐" },
  { title: "الإعدادات", icon: "⚙️" },
];

export default function DesignLabPage() {
  const params = useParams();
  const branch = params.branch as string;

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <section style={hero}>
          <div>
            <div style={heroBadge}>نسخة تجريبية V2</div>

            <h1 style={heroTitle}>محطة العمل</h1>

            <p style={heroSub}>
              مؤسسة سداد و أرقام
            </p>
          </div>

          <div style={heroStats}>
            <div style={statCard}>
              <strong>142</strong>
              <span>عقد</span>
            </div>

            <div style={statCard}>
              <strong>53</strong>
              <span>عميل</span>
            </div>

            <div style={statCard}>
              <strong>28</strong>
              <span>دفعة</span>
            </div>
          </div>
        </section>

        <section style={searchCard}>
          <input
            style={searchInput}
            placeholder="البحث السريع..."
          />
        </section>

        <section style={grid}>
          {sections.map((item) => (
            <button key={item.title} style={card}>
              <div style={iconBox}>{item.icon}</div>

              <div style={cardTitle}>
                {item.title}
              </div>

              <div style={arrow}>‹</div>
            </button>
          ))}
        </section>

        <button
          style={backButton}
          onClick={() =>
            (window.location.href = `/finance/${branch}`)
          }
        >
          الرجوع لمحطة العمل
        </button>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg,#06121f,#0b1f35,#112d4e)",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: 1200,
  margin: "auto",
};

const hero: React.CSSProperties = {
  background:
    "linear-gradient(135deg,#0f172a,#1e293b)",
  border: "1px solid rgba(255,215,0,0.25)",
  borderRadius: 28,
  padding: 28,
  color: "white",
  marginBottom: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 20,
  boxShadow:
    "0 20px 60px rgba(0,0,0,0.35)",
};

const heroBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#d4af37",
  color: "#111827",
  padding: "8px 14px",
  borderRadius: 999,
  fontWeight: "bold",
  marginBottom: 10,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 42,
};

const heroSub: React.CSSProperties = {
  marginTop: 10,
  color: "#cbd5e1",
  fontSize: 18,
};

const heroStats: React.CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
};

const statCard: React.CSSProperties = {
  width: 110,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,215,0,0.2)",
  borderRadius: 18,
  padding: 16,
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const searchCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 20,
  padding: 16,
  marginBottom: 18,
  backdropFilter: "blur(12px)",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  height: 56,
  borderRadius: 16,
  border: "none",
  padding: "0 16px",
  fontSize: 16,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
};

const card: React.CSSProperties = {
  background:
    "linear-gradient(135deg,#ffffff,#f8fafc)",
  border: "1px solid rgba(212,175,55,0.25)",
  borderRadius: 22,
  minHeight: 100,
  padding: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
  boxShadow:
    "0 10px 25px rgba(0,0,0,0.12)",
};

const iconBox: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  background:
    "linear-gradient(135deg,#d4af37,#f7d774)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
};

const cardTitle: React.CSSProperties = {
  fontWeight: "bold",
  fontSize: 17,
  color: "#111827",
};

const arrow: React.CSSProperties = {
  fontSize: 28,
  color: "#d4af37",
};

const backButton: React.CSSProperties = {
  width: "100%",
  marginTop: 18,
  padding: 16,
  borderRadius: 16,
  border: "none",
  background: "#d4af37",
  color: "#111827",
  fontWeight: "bold",
  fontSize: 17,
};
