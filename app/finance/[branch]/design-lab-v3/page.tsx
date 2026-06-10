"use client";

import { useParams } from "next/navigation";

const sections = [
  { title: "سير العمل", icon: "💼" },
  { title: "العملاء", icon: "👥" },
  { title: "طلب جديد", icon: "➕" },
  { title: "سداد", icon: "💳" },
  { title: "المخزون", icon: "📦" },
  { title: "العقود", icon: "📄" },
  { title: "المصروفات", icon: "🧾" },
  { title: "الملاحظات", icon: "✏️" },
  { title: "الصلاحيات", icon: "🔐" },
  { title: "الإعدادات", icon: "⚙️" },
];

export default function DesignLabV3Page() {
  const params = useParams();
  const branch = params.branch as string;

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <section style={hero}>
          <div style={badge}>نموذج ٣</div>

          <h1 style={heroTitle}>محطة العمل</h1>

          <p style={heroSub}>
            مؤسسة سداد و أرقام
          </p>

          <div style={statsRow}>
            <div style={stat}>
              <strong>53</strong>
              <span>عميل</span>
            </div>

            <div style={stat}>
              <strong>142</strong>
              <span>عقد</span>
            </div>

            <div style={stat}>
              <strong>28</strong>
              <span>سداد</span>
            </div>

            <div style={stat}>
              <strong>15</strong>
              <span>مصروف</span>
            </div>
          </div>
        </section>

        <section style={searchCard}>
          <input
            style={searchInput}
            placeholder="🔎 البحث السريع..."
          />
        </section>

        <section style={grid}>
          {sections.map((item) => (
            <button key={item.title} style={card}>
              <div style={bigIcon}>{item.icon}</div>

              <div style={cardTitle}>
                {item.title}
              </div>
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
  padding: 20,
  background:
    "linear-gradient(180deg,#f8fbff,#eef5ff,#f8fbff)",
  fontFamily: "var(--font-almarai), sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: 1200,
  margin: "auto",
};

const hero: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  backdropFilter: "blur(18px)",
  border: "1px solid rgba(255,255,255,0.8)",
  borderRadius: 30,
  padding: 28,
  textAlign: "center",
  marginBottom: 18,
  boxShadow: "0 20px 50px rgba(59,130,246,0.12)",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 16px",
  borderRadius: 999,
  background: "#dbeafe",
  color: "#2563eb",
  fontWeight: "bold",
  marginBottom: 12,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 40,
  color: "#0f172a",
};

const heroSub: React.CSSProperties = {
  marginTop: 10,
  color: "#475569",
  fontSize: 18,
};

const statsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  gap: 10,
  marginTop: 20,
};

const stat: React.CSSProperties = {
  background: "rgba(255,255,255,0.75)",
  borderRadius: 20,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const searchCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(14px)",
  borderRadius: 24,
  padding: 16,
  marginBottom: 18,
};

const searchInput: React.CSSProperties = {
  width: "100%",
  height: 58,
  border: "none",
  borderRadius: 18,
  padding: "0 18px",
  fontSize: 16,
  background: "#ffffff",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: 14,
};

const card: React.CSSProperties = {
  minHeight: 150,
  background: "rgba(255,255,255,0.75)",
  backdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.9)",
  borderRadius: 28,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
};

const bigIcon: React.CSSProperties = {
  fontSize: 42,
};

const cardTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: "bold",
  color: "#0f172a",
};

const backButton: React.CSSProperties = {
  width: "100%",
  marginTop: 18,
  padding: 16,
  borderRadius: 16,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
  fontSize: 17,
};
