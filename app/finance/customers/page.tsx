"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FinanceCustomersPage() {
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    const { data } = await supabase
      .from("finance_customer_groups")
      .select("*")
      .order("created_at", { ascending: false });

    setGroups(data || []);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>العملاء</h1>
        </div>

        <section style={groupsSection}>
          {groups.length === 0 ? (
            <div style={emptyGroupCard}>لا توجد مجموعات عملاء حتى الآن</div>
          ) : (
            groups.map((group) => (
              <button
                key={group.id}
                style={groupCard}
                onClick={() =>
                  (window.location.href = `/finance/customers/groups/${group.id}`)
                }
              >
                {group.name}
              </button>
            ))
          )}
        </section>

        <section style={actionsSection}>
          <button
            style={actionButton}
            onClick={() => (window.location.href = "/finance/customers/new")}
          >
            إنشاء عميل جديد
          </button>

          <button style={actionButton}>البحث عن عميل</button>

          <button
            style={actionButton}
            onClick={() => (window.location.href = "/finance/customers/groups")}
          >
            إنشاء / تعديل مجموعة عملاء
          </button>

          <button style={actionButton}>حذف / تعديل عميل</button>
          <button style={actionButton}>قائمة الحظر</button>
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

const groupsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const groupCard = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  fontSize: 17,
  fontWeight: "bold",
  textAlign: "center" as const,
  cursor: "pointer",
};

const emptyGroupCard = {
  background: "white",
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 20,
  fontSize: 16,
  textAlign: "center" as const,
  color: "#6b7280",
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
