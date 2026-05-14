"use client";

export default function FinanceCustomersPage() {
  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>عملاء التمويل</h1>
          <p style={{ margin: "8px 0 0" }}>
            إدارة عملاء عقود التقسيط والتمويل.
          </p>
        </div>

        <button style={primaryButton}>
          إضافة عميل جديد
        </button>

        <div style={emptyCard}>
          لا يوجد عملاء تمويل حتى الآن.
        </div>

        <button style={backButton} onClick={() => (window.location.href = "/finance")}>
          الرجوع لقسم التمويل
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

const primaryButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginBottom: 16,
};

const emptyCard = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
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
