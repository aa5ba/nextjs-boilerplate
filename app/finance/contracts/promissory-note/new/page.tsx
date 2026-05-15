"use client";

export default function NewPromissoryNotePage() {
  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>إنشاء سند جديد</h1>
        </div>

        <section style={card}>
          <div style={emptyBox}>
            سيتم تجهيز نموذج السند في الخطوة التالية.
          </div>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = "/finance/contracts")}
        >
          الرجوع للعقود
        </button>
      </div>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 900,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
};

const emptyBox = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  textAlign: "center" as const,
  color: "#6b7280",
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 18,
};
