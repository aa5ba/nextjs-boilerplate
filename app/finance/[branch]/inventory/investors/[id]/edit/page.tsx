"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber } from "@/lib/numberUtils";

export default function EditInvestorPage() {
  const params = useParams();
  const branch = params.branch as string;
  const investorId = params.id as string;

  const [investorName, setInvestorName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInvestor();
  }, [branch, investorId]);

  async function loadInvestor() {
    setLoading(true);

    const branchId = await getBranchId(branch);

    if (!branchId) {
      alert("تعذر تحديد الفرع");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("id", investorId)
      .eq("branch_id", branchId)
      .single();

    if (error || !data) {
      alert("لم يتم العثور على المستثمر");
      setLoading(false);
      return;
    }

    setInvestorName(data.investor_name || "");
    setNationalId(data.national_id || "");
    setPhone(data.phone || "");
    setNotes(data.notes || "");

    setLoading(false);
  }

  async function saveInvestor() {
    if (!investorName.trim()) {
      alert("أدخل اسم المستثمر");
      return;
    }

    const cleanNationalId = normalizeNumber(nationalId);
    const cleanPhone = normalizeNumber(phone);

    if (cleanNationalId && cleanNationalId.length !== 10) {
      alert("رقم هوية المستثمر يجب أن يكون 10 أرقام");
      return;
    }

    const branchId = await getBranchId(branch);

    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("finance_investors")
        .update({
          investor_name: investorName.trim(),
          national_id: cleanNationalId || null,
          phone: cleanPhone || null,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", investorId)
        .eq("branch_id", branchId);

      if (error) {
        alert(error.message);
        return;
      }

      alert("تم تعديل المستثمر بنجاح");
      window.location.href = `/finance/${branch}/inventory/investors`;
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل بيانات المستثمر...</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>✏️ تعديل المستثمر</h1>
        </div>

        <section style={card}>
          <input
            style={input}
            placeholder="اسم المستثمر"
            value={investorName}
            onChange={(e) => setInvestorName(e.target.value)}
          />

          <input
            style={input}
            inputMode="numeric"
            maxLength={10}
            placeholder="رقم هوية المستثمر"
            value={nationalId}
            onChange={(e) => setNationalId(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            inputMode="numeric"
            maxLength={10}
            placeholder="رقم الجوال"
            value={phone}
            onChange={(e) => setPhone(normalizeNumber(e.target.value))}
          />

          <textarea
            style={textarea}
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button style={primaryButton} onClick={saveInvestor} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
          </button>
        </section>

        <button
          style={backButton}
          onClick={() =>
            (window.location.href = `/finance/${branch}/inventory/investors`)
          }
        >
          الرجوع للمستثمرين
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

const primaryButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#16a34a",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(22,163,74,0.25)",
};

const loadingBox = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  textAlign: "center" as const,
  color: "#0d47a1",
  fontWeight: "bold",
};
