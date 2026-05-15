"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function FinanceCustomerProfilePage() {
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<any>(null);

  useEffect(() => {
    loadCustomer();
  }, []);

  async function loadCustomer() {
    const { data } = await supabase
      .from("finance_customers")
      .select("*, finance_customer_groups(name)")
      .eq("id", customerId)
      .single();

    setCustomer(data);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>{customer?.full_name || "ملف العميل"}</h1>
        </div>

        <section style={card}>
          <Row label="الاسم كاملاً" value={customer?.full_name} />
          <Row label="رقم الهوية" value={customer?.national_id} />
          <Row label="تاريخ الميلاد بالهجري" value={customer?.birth_hijri} />
          <Row label="رقم الجوال" value={customer?.phone} />
          <Row label="العمل" value={customer?.work || "-"} />
          <Row label="الراتب" value={customer?.salary || "-"} />
          <Row label="البنك" value={customer?.bank || "-"} />
          <Row label="الوسيط" value={customer?.broker || "-"} />
          <Row label="مجموعة العملاء" value={customer?.finance_customer_groups?.name || "-"} />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>العقود الحالية</h2>
          <div style={emptyBox}>لا توجد عقود حالية</div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>العقود السابقة</h2>
          <div style={emptyBox}>لا توجد عقود سابقة</div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>سجل العمليات</h2>
          <div style={emptyBox}>لا توجد عمليات حتى الآن</div>
        </section>

        <button
          style={backButton}
          onClick={() => (window.history.back())}
        >
          رجوع
        </button>
      </div>
    </main>
  );
}

function Row({ label, value }: any) {
  return (
    <div style={row}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
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
  marginBottom: 16,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
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
};
