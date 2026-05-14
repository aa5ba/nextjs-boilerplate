"use client";

export default function FinancePage() {
  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>إدارة التمويل</h1>
          <p style={{ margin: "8px 0 0" }}>
            إدارة العملاء، العقود، المخزون، السداد، والصلاحيات.
          </p>
        </div>

        <div style={grid}>
          <Card title="سير العمل" href="/finance/workflow" />
          <Card title="العملاء" href="/finance/customers" />
          <Card title="المخزون والمنتجات" href="/finance/inventory" />
          <Card title="العقود" href="/finance/contracts" />
          <Card title="الملاحظات والتذكيرات" href="/finance/notes" />
          <Card title="إدارة الصلاحيات" href="/finance/permissions" />
        </div>

        <button style={backButton} onClick={() => (window.location.href = "/")}>
          الرجوع للرئيسية
        </button>
      </div>
    </main>
  );
}

function Card({ title, href }: any) {
  return (
    <button style={card} onClick={() => (window.location.href = href)}>
      {title}
      <span style={arrow}>›</span>
    </button>
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

const grid = {
  display: "grid",
  gap: 12,
};

const card = {
  width: "100%",
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const arrow = {
  color: "#0d6efd",
  fontSize: 26,
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 18,
};
