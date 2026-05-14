"use client";

export default function FinanceWorkflowPage() {
  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>سير العمل</h1>
          <p style={{ margin: "8px 0 0" }}>
            متابعة آخر العمليات والتنبيهات داخل نظام التمويل.
          </p>
        </div>

        <section style={card}>
          <h2 style={sectionTitle}>آخر العمليات</h2>

          <div style={emptyBox}>
            لا توجد عمليات مسجلة حتى الآن.
          </div>
        </section>

        <button style={backButton} onClick={() => (window.location.href = "/finance")}>
          الرجوع لإدارة التمويل
        </button>
      </div>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 16,
  fontFamily: "system-ui",
};

const container = {
  maxWidth: 620,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 24,
  borderRadius: 24,
  marginBottom: 16,
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
};

const sectionTitle = {
  marginTop: 0,
  fontSize: 20,
  color: "#0d47a1",
};

const emptyBox = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
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
