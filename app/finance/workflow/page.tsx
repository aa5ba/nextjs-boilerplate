"use client";

export default function FinanceWorkflowPage() {
  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>سير العمل</h1>
        </div>

        <section style={card}>
          <h2 style={sectionTitle}>آخر العمليات</h2>

          <div style={tableBox}>
            <div style={tableHeader}>
              <span>العملية</span>
              <span>العميل</span>
              <span>الحالة</span>
              <span>الموظف</span>
            </div>

            <div style={emptyBox}>لا توجد عمليات مسجلة حتى الآن.</div>
          </div>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = "/finance")}
        >
          الرجوع لمحطة العمل الرئيسية
        </button>
      </div>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "system-ui",
};

const container = {
  width: "100%",
  maxWidth: 1100,
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

const sectionTitle = {
  marginTop: 0,
  fontSize: 22,
  color: "#0d47a1",
};

const tableBox = {
  width: "100%",
  overflowX: "auto" as const,
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "2fr 1.5fr 1fr 1fr",
  gap: 12,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  minWidth: 720,
};

const emptyBox = {
  minWidth: 720,
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  marginTop: 12,
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
