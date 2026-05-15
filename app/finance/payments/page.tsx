"use client";

export default function FinancePaymentsPage() {
  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>سداد</h1>
        </div>

        <section style={actionsSection}>
          <button style={actionButton}>إجراء سداد</button>
          <button style={actionButton}>إلغاء عملية سداد</button>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>آخر 10 عمليات سداد</h2>

          <div style={tableHeader}>
            <span>العميل</span>
            <span>رقم العقد</span>
            <span>المبلغ</span>
            <span>طريقة الدفع</span>
            <span>نوع السداد</span>
          </div>

          <div style={emptyBox}>لا توجد عمليات سداد حتى الآن</div>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = "/finance")}
        >
          الرجوع لإدارة التمويل
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

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const actionButton = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  overflowX: "auto" as const,
};

const sectionTitle = {
  marginTop: 0,
  fontSize: 22,
  color: "#0d47a1",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
  gap: 12,
  minWidth: 850,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const emptyBox = {
  minWidth: 850,
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
