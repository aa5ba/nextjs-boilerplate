"use client";

export default function FinanceContractsPage() {
  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>العقود</h1>
        </div>

        <section style={actionsSection}>
          <button
  style={actionButton}
  onClick={() => (window.location.href = "/finance/contracts/new")}
>
  <span style={buttonContent}>
    <span style={buttonIcon}>📄</span>
    إنشاء عقد جديد
  </span>
</button>

<button style={actionButton}>
  <span style={buttonContent}>
    <span style={buttonIcon}>🧾</span>
    إنشاء سند جديد
  </span>
</button>

<button style={actionButton}>
  <span style={buttonContent}>
    <span style={buttonIcon}>🔍</span>
    البحث عن عقد
  </span>
</button>

<button style={actionButton}>
  <span style={buttonContent}>
    <span style={buttonIcon}>✏️</span>
    تعديل عقد
  </span>
</button>

<button
  style={actionButton}
  onClick={() => (window.location.href = "/finance/contracts/active")}
>
  <span style={buttonContent}>
    <span style={buttonIcon}>📂</span>
    العقود القائمة
  </span>
</button>

<button style={actionButton}>
  <span style={buttonContent}>
    <span style={buttonIcon}>✅</span>
    العقود المنتهية
  </span>
</button>
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

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
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
const buttonContent = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
}

const buttonIcon = {
  fontSize: 20,
}
