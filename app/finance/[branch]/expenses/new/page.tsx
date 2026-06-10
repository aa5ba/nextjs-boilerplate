"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

const PAYMENT_METHODS = [
  "نقدًا",
  "تحويل بنكي",
  "شبكة / مدى",
  "من الصندوق",
  "من حساب بنكي",
  "أخرى",
];

export default function NewExpenseInvoicePage() {
  const params = useParams();
  const branch = params.branch as string;

  const today = new Date().toLocaleDateString("en-CA");

  const [branchId, setBranchId] = useState<string | null>(null);

  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState("نقدًا");
  const [paymentSource, setPaymentSource] = useState("");
  const [invoiceDetails, setInvoiceDetails] = useState("");

  const [createdByName, setCreatedByName] = useState("مستخدم");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    initPage();
  }, [branch]);

  async function initPage() {
    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    const savedUser =
      typeof window !== "undefined"
        ? localStorage.getItem("finance_user")
        : null;

    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCreatedByName(user.full_name || user.name || user.username || "مستخدم");
      } catch {
        setCreatedByName("مستخدم");
      }
    }
  }

  function validateForm() {
    const amount = toNumber(invoiceAmount);

    if (!branchId) return "تعذر تحديد الفرع";
    if (!invoiceTitle.trim()) return "يرجى إدخال عنوان الفاتورة";
    if (!invoiceAmount) return "يرجى إدخال مبلغ الفاتورة";
    if (amount <= 0) return "يرجى إدخال مبلغ صحيح";
    if (!invoiceDate) return "يرجى اختيار تاريخ الفاتورة";
    if (!paymentMethod.trim()) return "يرجى اختيار طريقة السداد";

    return "";
  }

  async function saveInvoice() {
    if (saving) return;

    const validationMessage = validateForm();

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    try {
      setSaving(true);

      const finalPaymentMethod =
        paymentSource.trim()
          ? `${paymentMethod} - ${paymentSource.trim()}`
          : paymentMethod;

      const { error } = await supabase.from("finance_expense_invoices").insert({
        branch_id: branchId,
        invoice_title: invoiceTitle.trim(),
        invoice_amount: toNumber(invoiceAmount),
        invoice_details: invoiceDetails.trim() || null,
        invoice_date: invoiceDate,
        payment_method: finalPaymentMethod,
        created_by_name: createdByName,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      alert("تم حفظ الفاتورة بنجاح");
      window.location.href = `/finance/${branch}/expenses`;
    } catch (error: any) {
      alert(error?.message || "حدث خطأ أثناء حفظ الفاتورة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <section style={hero}>
          <h1 style={heroTitle}>إنشاء فاتورة جديدة</h1>
          <p style={heroSub}>
            إضافة فاتورة مصروفات أو مشتريات مع تحديد طريقة ومصدر السداد.
          </p>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات الفاتورة</h2>

          <Field label="عنوان الفاتورة *">
            <input
              style={input}
              value={invoiceTitle}
              onChange={(e) => setInvoiceTitle(e.target.value)}
              placeholder="مثال: شراء أدوات مكتبية"
            />
          </Field>

          <Field label="مبلغ الفاتورة *">
            <input
              style={input}
              inputMode="numeric"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(normalizeNumber(e.target.value))}
              placeholder="مثال: 1500"
            />
          </Field>

          <Field label="تاريخ الفاتورة *">
            <input
              style={input}
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </Field>

          <Field label="طريقة السداد *">
            <select
              style={input}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </Field>

          <Field label="مصدر السداد - اختياري">
            <input
              style={input}
              value={paymentSource}
              onChange={(e) => setPaymentSource(e.target.value)}
              placeholder="مثال: صندوق الفرع، حساب الراجحي، حساب المؤسسة"
            />
          </Field>

          <Field label="تفاصيل الفاتورة">
            <textarea
              style={textarea}
              value={invoiceDetails}
              onChange={(e) => setInvoiceDetails(e.target.value)}
              placeholder="اكتب تفاصيل المصروف أو المشتريات..."
            />
          </Field>

          <div style={createdByBox}>
            <span>👤 سيتم تسجيل الفاتورة باسم:</span>
            <strong>{createdByName}</strong>
          </div>

          <button style={saveButton} onClick={saveInvoice} disabled={saving}>
            {saving ? "جاري حفظ الفاتورة..." : "حفظ الفاتورة"}
          </button>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}/expenses`)}
        >
          الرجوع للمصروفات والمشتريات
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: any) {
  return (
    <div style={fieldBox}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f4f7fb",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 850,
  margin: "auto",
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  borderRadius: 24,
  padding: 24,
  marginBottom: 14,
  boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 32,
  lineHeight: 1.4,
};

const heroSub: React.CSSProperties = {
  margin: "8px 0 0",
  opacity: 0.9,
};

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
};

const sectionTitle: React.CSSProperties = {
  marginTop: 0,
  color: "#0f172a",
};

const fieldBox: React.CSSProperties = {
  marginBottom: 14,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 14,
};

const input: React.CSSProperties = {
  width: "100%",
  height: 50,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid #dbe3ef",
  fontSize: 16,
  boxSizing: "border-box",
  background: "#f8fafc",
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #dbe3ef",
  fontSize: 16,
  boxSizing: "border-box",
  background: "#f8fafc",
  resize: "vertical",
};

const createdByBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  color: "#475569",
  marginBottom: 14,
};

const saveButton: React.CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
};

const backButton: React.CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
  cursor: "pointer",
};
