"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

export default function NewPromissoryNotePage() {
  const [debtorName, setDebtorName] = useState("");
  const [debtorNationalId, setDebtorNationalId] = useState("");
  const [debtorPhone, setDebtorPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  async function createNote() {
    if (!debtorName || !amount) {
      alert("أكمل اسم المدين ومبلغ السند");
      return;
    }

    const noteAmount = toNumber(amount);

    if (noteAmount <= 0) {
      alert("أدخل مبلغ سند صحيح");
      return;
    }

    const { data, error } = await supabase
      .from("finance_promissory_notes")
      .insert([
        {
          debtor_name: debtorName,
          debtor_national_id: normalizeNumber(debtorNationalId),
          debtor_phone: normalizeNumber(debtorPhone),
          amount: noteAmount,
          due_date: dueDate,
          city,
          notes,
          status: "نشط",
          created_by: "المدير",
        },
      ])
      .select()
      .single();

    if (error) {
      alert("تعذر إنشاء السند");
      return;
    }

    await supabase.from("finance_activity_logs").insert([
      {
        activity_type: "إنشاء سند",
        description: `تم إنشاء سند جديد باسم ${debtorName} بمبلغ ${noteAmount} ر.س`,
        customer_name: debtorName,
        employee_name: "المدير",
        status: "نشط",
      },
    ]);

    alert("تم إنشاء السند بنجاح");
    window.location.href = `/finance/contracts/promissory-note/print/${data.id}`;
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>إنشاء سند جديد</h1>
        </div>

        <section style={card}>
          <input
            style={input}
            placeholder="اسم المدين"
            value={debtorName}
            onChange={(e) => setDebtorName(e.target.value)}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="رقم هوية المدين"
            value={debtorNationalId}
            onChange={(e) => setDebtorNationalId(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="رقم جوال المدين"
            value={debtorPhone}
            onChange={(e) => setDebtorPhone(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="مبلغ السند"
            value={amount}
            onChange={(e) => setAmount(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            placeholder="تاريخ الاستحقاق"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <input
            style={input}
            placeholder="مدينة التحرير / التقاضي"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          <textarea
            style={textarea}
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button style={primaryButton} onClick={createNote}>
            إنشاء السند
          </button>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = "/finance/contracts")}
        >
          الرجوع للعقود
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
  maxWidth: 900,
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

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
};

const textarea = {
  width: "100%",
  minHeight: 100,
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
