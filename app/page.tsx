"use client";

export default function MainHomePage() {
  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <section style={hero}>
          <div style={badge}>منصة احتساب</div>

          <h1 style={title}>بوابة إحتساب الرئيسية</h1>

          <p style={subtitle}>
            اختر الوجهة المناسبة للانتقال إلى منصة احتساب التمويل أو محطة إدارة العمل.
          </p>

          <div style={cardsGrid}>
            <button
              style={primaryCard}
              onClick={() => (window.location.href = "/ehtisab")}
            >
              <span style={icon}>📊</span>
              <span style={cardTitle}>منصة إحتساب التمويل المطوّره</span>
              <span style={cardText}>
                حاسبة التمويل الشخصي والعقاري وفق قواعد التمويل المسؤول.
              </span>
            </button>

            <button
              style={secondaryCard}
              onClick={() => (window.location.href = "/finance/sadad")}
            >
              <span style={icon}>🏢</span>
              <span style={cardTitle}>محطة إدارة العمل</span>
              <span style={cardText}>
                إدارة العملاء والعقود والسداد والسندات وسير العمل.
              </span>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background:
    "linear-gradient(135deg, #eef5ff 0%, #f8fbff 45%, #eaf2ff 100%)",
  padding: 20,
  fontFamily: "var(--font-almarai), system-ui, sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
  minHeight: "calc(100vh - 40px)",
  display: "flex",
  alignItems: "center",
};

const hero = {
  width: "100%",
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 30,
  padding: 28,
  boxShadow: "0 20px 60px rgba(13,71,161,.12)",
};

const badge = {
  display: "inline-block",
  background: "#e8f1ff",
  color: "#0d47a1",
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: 14,
  fontWeight: "bold",
  marginBottom: 16,
};

const title = {
  margin: 0,
  color: "#0f172a",
  fontSize: 34,
  lineHeight: 1.4,
};

const subtitle = {
  color: "#64748b",
  fontSize: 17,
  lineHeight: 1.8,
  marginTop: 10,
  marginBottom: 24,
};

const cardsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
  gap: 18,
};

const primaryCard = {
  minHeight: 220,
  padding: 24,
  borderRadius: 24,
  border: "none",
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  textAlign: "right" as const,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
  boxShadow: "0 14px 35px rgba(13,71,161,.25)",
};

const secondaryCard = {
  minHeight: 220,
  padding: 24,
  borderRadius: 24,
  border: "1px solid #d9e3f5",
  background: "#f8fbff",
  color: "#0f172a",
  textAlign: "right" as const,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
};

const icon = {
  fontSize: 34,
};

const cardTitle = {
  fontSize: 22,
  fontWeight: "bold",
};

const cardText = {
  fontSize: 15,
  lineHeight: 1.8,
  opacity: 0.9,
};
