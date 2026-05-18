"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function FinanceCustomerProfilePage() {
  const params = useParams();

  const branch = params.branch as string;
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<any>(null);
  const [activeContracts, setActiveContracts] = useState<any[]>([]);
  const [closedContracts, setClosedContracts] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [branch, customerId]);

  async function loadData() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setCustomer(null);
      setActiveContracts([]);
      setClosedContracts([]);
      setNotes([]);
      setActivities([]);
      return;
    }

    const { data: customerData } = await supabase
      .from("finance_customers")
      .select("*, finance_customer_groups(name)")
      .eq("id", customerId)
      .eq("branch_id", branchId)
      .single();

    const { data: activeData } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("customer_id", customerId)
      .eq("branch_id", branchId)
      .in("contract_status", ["نشط", "متأخر"])
      .order("created_at", { ascending: false });

    const { data: closedData } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("customer_id", customerId)
      .eq("branch_id", branchId)
      .in("contract_status", ["تم السداد", "ملغي"])
      .order("created_at", { ascending: false });

    const { data: notesData } = await supabase
      .from("finance_promissory_notes")
      .select("*")
      .eq("customer_id", customerId)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    const { data: activitiesData } = await supabase
      .from("finance_activity_logs")
      .select("*")
      .eq("customer_id", customerId)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(20);

    setCustomer(customerData);
    setActiveContracts(activeData || []);
    setClosedContracts(closedData || []);
    setNotes(notesData || []);
    setActivities(activitiesData || []);
  }

  function formatDate(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleString("ar-SA", {
      dateStyle: "short",
      timeStyle: "short",
    });
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
          <Row
            label="مجموعة العملاء"
            value={customer?.finance_customer_groups?.name || "-"}
          />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>العقود الحالية</h2>

          {activeContracts.length === 0 ? (
            <div style={emptyBox}>لا توجد عقود حالية</div>
          ) : (
            activeContracts.map((contract) => (
              <button
                key={contract.id}
                style={itemButton}
                onClick={() =>
                  (window.location.href = `/finance/${branch}/contracts/${contract.id}`)
                }
              >
                📄 عقد رقم {contract.contract_number} -{" "}
                {contract.contract_status} - المتبقي{" "}
                {contract.remaining_amount || 0} ر.س
              </button>
            ))
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>العقود السابقة</h2>

          {closedContracts.length === 0 ? (
            <div style={emptyBox}>لا توجد عقود سابقة</div>
          ) : (
            closedContracts.map((contract) => (
              <button
                key={contract.id}
                style={itemButton}
                onClick={() =>
                  (window.location.href = `/finance/${branch}/contracts/${contract.id}`)
                }
              >
                ✅ عقد رقم {contract.contract_number} -{" "}
                {contract.contract_status} - المسدد {contract.paid_amount || 0}{" "}
                ر.س
              </button>
            ))
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>السندات</h2>

          {notes.length === 0 ? (
            <div style={emptyBox}>لا توجد سندات مرتبطة بالعميل</div>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                style={itemButton}
                onClick={() =>
                  (window.location.href = `/finance/${branch}/contracts/promissory-note/print/${note.id}`)
                }
              >
                🧾 سند رقم {note.note_number} - {note.amount || 0} ر.س -{" "}
                {note.status || "-"}
              </button>
            ))
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>سجل العمليات</h2>

          {activities.length === 0 ? (
            <div style={emptyBox}>لا توجد عمليات حتى الآن</div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} style={activityRow}>
                <span>{activity.activity_type || "-"}</span>
                <span>{activity.status || "-"}</span>
                <span>{formatDate(activity.created_at)}</span>
              </div>
            ))
          )}
        </section>

        <button style={backButton} onClick={() => window.history.back()}>
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
  fontFamily: "var(--font-almarai), sans-serif",
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

const itemButton = {
  width: "100%",
  padding: 14,
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
  marginBottom: 10,
  textAlign: "right" as const,
};

const activityRow = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1.5fr",
  gap: 12,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
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
