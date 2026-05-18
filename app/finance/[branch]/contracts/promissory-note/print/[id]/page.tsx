"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function PrintPromissoryNotePage() {
  const params = useParams();

  const branch = params.branch as string;
  const noteId = params.id as string;

  const [note, setNote] = useState<any>(null);

  useEffect(() => {
    loadNote();
  }, [branch, noteId]);

  async function loadNote() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setNote(null);
      return;
    }

    const { data } = await supabase
      .from("finance_promissory_notes")
      .select("*")
      .eq("id", noteId)
      .eq("branch_id", branchId)
      .single();

    setNote(data);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={printArea}>
        <div style={topLine}>
          <span>المملكة العربية السعودية</span>
          <span>بيع * شراء</span>
        </div>

        <div style={logoBox}>الشعار</div>

        <h1 style={title}>النموذج 1 للسند</h1>
        <h2 style={subtitle}>سند لأمر</h2>

        <div style={metaRow}>
          <span>رقم السند: {note?.note_number || "-"}</span>
          <span>تاريخ التحرير: {note?.note_date_gregorian || "-"}</span>
        </div>

        <div style={metaRow}>
          <span>تاريخ التحرير هجري: {note?.note_date_hijri || "-"}</span>
          <span>تاريخ الاستحقاق: {note?.due_date || "-"}</span>
        </div>

        <p style={paragraph}>
          حرر هذا السند في مدينة <strong>{note?.city || "................"}</strong>،
          وبموجب هذا السند أتعهد أنا الموقع أدناه بأن أدفع لأمر الطرف المستفيد
          مبلغًا وقدره <strong>{note?.amount || 0}</strong> ريال سعودي.
        </p>

        <p style={paragraph}>
          ويستحق هذا المبلغ في تاريخ{" "}
          <strong>{note?.due_date || "................"}</strong>، دون مماطلة أو
          تأخير، ويعد هذا السند التزامًا واجب الوفاء حسب الأنظمة المعمول بها.
        </p>

        <div style={infoBox}>
          <div>اسم المدين / {note?.debtor_name || "................"}</div>
          <div>رقم الهوية / {note?.debtor_national_id || "................"}</div>
          <div>رقم الجوال / {note?.debtor_phone || "................"}</div>
          <div>العنوان / {note?.city || "................"}</div>
          <div>حالة السند / {note?.status || "-"}</div>
        </div>

        <p style={paragraph}>
          ملاحظات: <strong>{note?.notes || "-"}</strong>
        </p>

        <div style={signatures}>
          <div style={signatureBox}>
            <strong>المدين</strong>
            <div>الاسم / {note?.debtor_name || "................"}</div>
            <div>التوقيع / ................</div>
            <div>البصمة / ................</div>
          </div>

          <div style={signatureBox}>
            <strong>الكفيل</strong>
            <div>الاسم / ................</div>
            <div>رقم الهوية / ................</div>
            <div>التوقيع / ................</div>
            <div>البصمة / ................</div>
          </div>
        </div>
      </div>

      <button style={printButton} onClick={() => window.print()}>
        🖨️ طباعة السند
      </button>

      <button
        style={backButton}
        onClick={() =>
          (window.location.href = `/finance/${branch}/contracts/promissory-note/new`)
        }
      >
        إنشاء سند جديد
      </button>

      <button
        style={backButton}
        onClick={() => (window.location.href = `/finance/${branch}/contracts`)}
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
  padding: 38,
  borderRadius: 18,
  lineHeight: 2,
  color: "#111827",
};

const topLine = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 15,
  fontWeight: "bold",
  marginBottom: 16,
};

const logoBox = {
  width: 90,
  height: 90,
  margin: "0 auto 14px",
  border: "1px dashed #94a3b8",
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#64748b",
  fontSize: 14,
};

const title = {
  textAlign: "center" as const,
  color: "#0d47a1",
  fontSize: 22,
  margin: "0 0 4px",
};

const subtitle = {
  textAlign: "center" as const,
  color: "#111827",
  fontSize: 28,
  margin: "0 0 20px",
  textDecoration: "underline",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: 8,
  marginBottom: 8,
  fontSize: 15,
};

const paragraph = {
  fontSize: 17,
  margin: "16px 0",
  textAlign: "justify" as const,
};

const infoBox = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  marginTop: 20,
  lineHeight: 2,
};

const signatures = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  marginTop: 50,
};

const signatureBox = {
  borderTop: "1px solid #111827",
  paddingTop: 12,
  lineHeight: 2,
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

if (typeof window !== "undefined") {
  const style = document.createElement("style");

  style.innerHTML = `
    @media print {
      button {
        display: none !important;
      }

      body {
        background: white !important;
      }
    }

    @page {
      size: A4;
      margin: 12mm;
    }
  `;

  document.head.appendChild(style);
}
