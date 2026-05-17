"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function FinanceCustomerGroupsPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [name, setName] = useState("");
  const [groups, setGroups] = useState<any[]>([]);

  async function loadGroups() {
    const { data } = await supabase
      .from("finance_customer_groups")
      .select("*")
      .order("created_at", { ascending: false });

    setGroups(data || []);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function addGroup() {
    if (!name.trim()) {
      alert("اكتب اسم مجموعة العملاء");
      return;
    }

    const { error } = await supabase
      .from("finance_customer_groups")
      .insert({ name: name.trim() });

    if (error) {
      alert("تعذر إنشاء المجموعة");
      return;
    }

    setName("");
    loadGroups();
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>إنشاء / تعديل مجموعة عملاء</h1>
        </div>

        <section style={card}>
          <input
            style={input}
            placeholder="اسم مجموعة العملاء"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <button style={primaryButton} onClick={addGroup}>
            إنشاء مجموعة
          </button>
        </section>

        <section style={card}>
          {groups.length === 0 ? (
            <div style={emptyBox}>لا توجد مجموعات عملاء حتى الآن</div>
          ) : (
            groups.map((group) => (
              <div key={group.id} style={row}>
                <strong>{group.name}</strong>
              </div>
            ))
          )}
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}/customers`)}
        >
          الرجوع للعملاء
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

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
};

const primaryButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
};

const row = {
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 14,
  padding: 14,
  marginBottom: 10,
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
