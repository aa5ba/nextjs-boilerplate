"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PrintPromissoryNotePage() {
  const params = useParams();
  const noteId = params.id as string;

  const [note, setNote] = useState<any>(null);

  useEffect(() => {
    loadNote();
  }, []);

  async function loadNote() {
    const { data } = await supabase
      .from("finance_promissory_notes")
      .select("*")
      .eq("id", noteId)
      .single();

    setNote(data);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={printArea}>
        <h1 style={title}>سند لأمر</h1>

        <div style={noteNumber}>
          رقم السند: {note?.note_number || "-"}
        </div>

        <p>
          أتعهد أنا الموقع أدناه:
          <strong> {note?.debtor_name || "-"} </strong>
        </p>

        <p>
          رقم الهوية:
          <strong> {note?.debtor_national_id || "-"} </strong>
        </p>

        <p>
          رقم الجوال:
          <strong> {note?.debtor_phone || "-"} </strong>
        </p>

        <p>
          بأن أدفع بموجب هذا السند مبلغًا وقدره:
          <strong> {note?.amount || 0} ر.س </strong>
        </p>

        <p>
          وذلك في تاريخ الاستحقاق:
          <strong> {note?.due_date || "-"} </strong>
        </p>

        <p>
          بمدينة:
          <strong> {note?.city || "-"} </strong>
        </p>

        <p>
          حالة السند:
          <strong> {note?.status || "-"} </strong>
        </p>

        <p>
          ملاحظات:
          <strong> {note?.notes || "-"} </strong>
        </p>

        <div style={signatures}>
          <div>
            <div>توقيع المدين</div>
            <div style={line}></div>
          </div>

          <div>
            <div>التاريخ</div>
            <div style={line}></div>
          </div>
        </div>
      </div>

      <button style={printButton} onClick={() => window.print()}>
        🖨️ طباعة السند
      </button>

      <button
        style={backButton}
        onClick={() =>
          (window.location.href = "/finance/contracts/promissory-note/new")
        }
      >
        إنشاء سند جديد
      </button>

      <button
        style={backButton}
        onClick={() => (window.location.href = "/finance/contracts")}
      >
        الرجوع للعقود
      </button>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const printArea = {
  background: "white",
  maxWidth: 850,
  margin: "auto",
  padding: 40,
  borderRadius: 18,
  lineHeight: 2.2,
  fontSize: 18,
};

const title = {
  textAlign: "center" as const,
  color: "#0d47a1",
  fontSize: 34,
  marginBottom: 28,
};

const noteNumber = {
  textAlign: "center" as const,
  marginBottom: 28,
  fontWeight: "bold",
  color: "#111827",
};

const signatures = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 70,
  gap: 40,
};

const line = {
  width: 220,
  borderBottom: "1px solid #111827",
  marginTop: 35,
};

const printButton = {
  width: "100%",
  maxWidth: 850,
  display: "block",
  margin: "20px auto 0",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
};

const backButton = {
  width: "100%",
  maxWidth: 850,
  display: "block",
  margin: "12px auto 0",
  padding: 16,
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
};
