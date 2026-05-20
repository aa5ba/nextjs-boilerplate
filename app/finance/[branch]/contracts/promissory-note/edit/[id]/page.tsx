"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

export default function EditPromissoryNotePage() {
  const params = useParams();

  const branch = params.branch as string;
  const noteId = params.id as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [note, setNote] = useState<any>(null);

  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNote();
  }, [branch, noteId]);

  async function loadNote() {
    setLoading(true);

    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("finance_promissory_notes")
      .select("*")
      .eq("id", noteId)
      .eq("branch_id", currentBranchId)
      .single();

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setNote(data);
    setAmount(String(data?.amount || ""));
    setDueDate(data?.due_date || "");
    setCity(data?.city || "");
    setNotes(data?.notes || "");

    setLoading(false);
  }

  async function saveNote() {
    if (!branchId || !note) {
      alert("تعذر تحميل السند");
      return;
    }

    if (!amount || !dueDate || !city) {
      alert("أكمل مبلغ السند وتاريخ الاستحقاق والمدينة");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("finance_promissory_notes")
        .update({
          amount: toNumber(amount),
          due_date: dueDate,
          city,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", noteId)
        .eq("branch_id", branchId);

      if (error) {
        alert(error.message);
        return;
      }

      await supabase.from("finance_activity_logs").insert([
        {
          branch_id: branchId,
          activity_type: "تعديل سند",
          description: `تم تعديل سند رقم ${note?.note_number || ""}`,
          customer_id: note?.customer_id,
          contract_id: note?.contract_id,
          customer_name: note?.debtor_name || "",
          employee_name: "المدير",
          status: note?.status || "نشط",
        },
      ]);

      alert("تم حفظ تعديل السند بنجاح");
      window.location.href = `/finance/${branch}/contracts/promissory-note/print/${noteId}`;
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل السند...</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>✏️ تعديل السند</h1>
        </div>

        <section style={card}>
          <input
            style={input}
            inputMode="numeric"
            placeholder="مبلغ السند"
            value={amount}
            onChange={(e) => setAmount(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <input
            style={input}
            placeholder="المدينة"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          <textarea
            style={textarea}
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button style={saveButton} onClick={saveNote} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ تعديل السند"}
          </button>
        </section>

        <button
          style={backButton}
          onClick={() => window.history.back()}
        >
          رجوع
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
  maxWidth: 800,
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
  boxSizing: "border-box" as const,
};

const textarea = {
  width: "100%",
  minHeight: 100,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
  boxSizing: "border-box" as const,
};

const saveButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
};

const loadingBox = {
  textAlign: "center" as const,
  paddingTop: 80,
  fontSize: 18,
};
