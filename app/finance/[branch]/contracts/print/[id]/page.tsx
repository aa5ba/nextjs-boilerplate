"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PrintContractPage() {
  const params = useParams();

  const branch = params.branch as string;
  const contractId = params.id as string;

  const [contract, setContract] = useState<any>(null);

  useEffect(() => {
    loadContract();
  }, []);

  async function loadContract() {
    const { data } = await supabase
      .from("finance_contracts")
      .select(
        "*, finance_customers(full_name, national_id, phone, birth_hijri)"
      )
      .eq("id", contractId)
      .single();

    setContract(data);
  }

  const customerName =
    contract?.finance_customers?.full_name || "................";
  const nationalId =
    contract?.finance_customers?.national_id || "................";
  const phone = contract?.finance_customers?.phone || "................";
  const birthHijri =
    contract?.finance_customers?.birth_hijri || "................";

  return (
    <main dir="rtl" style={page}>
      <div style={printArea}>
        <div style={topLine}>
          <span>المملكة العربية السعودية</span>
          <span>بيع * شراء</span>
        </div>

        <div style={logoBox}>الشعار</div>

        <h1 style={title}>النموذج 1 للعقد</h1>
        <h2 style={subtitle}>عقد اتفاق بيع</h2>

        <div style={metaRow}>
          <span>رقم العقد: {contract?.contract_number || "-"}</span>
          <span>
            التاريخ الميلادي: {contract?.contract_date_gregorian || "-"}
          </span>
        </div>

        <div style={metaRow}>
          <span>التاريخ الهجري: {contract?.contract_date_hijri || "-"}</span>
          <span>موعد السداد: {contract?.payment_due_date || "-"}</span>
        </div>

        <p style={paragraph}>
          الحمد لله والصلاة والسلام على من لا نبي بعده، وبعد:
        </p>

        <p style={paragraph}>
          أقر أنا الموقع أدناه الطرف الثاني / <strong>{customerName}</strong>،
          رقم الهوية / <strong>{nationalId}</strong>، تاريخ الميلاد /
          <strong> {birthHijri}</strong>، رقم الجوال /
          <strong> {phone}</strong>، بأني اشتريت من الطرف الأول /
          <strong> {contract?.investor_name || "................"}</strong>.
        </p>

        <p style={paragraph}>
          وذلك مقابل منتج /{" "}
          <strong>{contract?.product_name || "................"}</strong>،
          وعددها / <strong>{contract?.product_quantity || "-"}</strong>، بمبلغ
          دين وقدره / <strong>{contract?.debt_amount || 0}</strong> ريال سعودي.
        </p>

        <p style={paragraph}>
          ويلتزم الطرف الثاني بسداد مبلغ وقدره /
          <strong> {contract?.payment_amount || 0}</strong> ريال سعودي، وذلك حسب
          نوع السداد / <strong>{contract?.payment_type || "-"}</strong>، وبقسط
          قدره / <strong> {contract?.installment_amount || 0}</strong> ريال
          سعودي.
        </p>

        <p style={paragraph}>
          وتكون مدينة التقاضي / <strong>{contract?.legal_city || "-"}</strong>.
        </p>

        <p style={paragraph}>
          كما يقر الطرف الثاني بأنه اطلع على كامل بنود هذا العقد، وأنه ملتزم
          بالسداد في المواعيد المتفق عليها، وفي حال التأخر يحق للطرف الأول
          اتخاذ الإجراءات النظامية اللازمة للمطالبة بكامل المبلغ المتبقي.
        </p>

        <p style={paragraph}>
          ملاحظات: <strong>{contract?.notes || "-"}</strong>
        </p>

        <div style={signatures}>
          <div style={signatureBox}>
            <strong>الطرف الأول البائع</strong>
            <div>الاسم / {contract?.investor_name || "................"}</div>
            <div>التوقيع / ................</div>
          </div>

          <div style={signatureBox}>
            <strong>الطرف الثاني المشتري</strong>
            <div>الاسم / {customerName}</div>
            <div>رقم الهوية / {nationalId}</div>
            <div>الجوال / {phone}</div>
            <div>التوقيع / ................</div>
          </div>
        </div>

        <div style={guarantorBox}>
          <strong>الكفيل الغارم</strong>
          <div>الاسم / {contract?.guarantor_name || "................"}</div>
          <div>رقم الهوية / ................</div>
          <div>الجوال / ................</div>
          <div>التوقيع / ................</div>
        </div>
      </div>

      <button style={printButton} onClick={() => window.print()}>
        🖨️ طباعة العقد
      </button>

      <button
        style={backButton}
        onClick={() =>
          (window.location.href = `/finance/${branch}/contracts/${contractId}`)
        }
      >
        الرجوع للعقد
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
  fontSize: 24,
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
  fontSize: 16,
  margin: "12px 0",
  textAlign: "justify" as const,
};

const signatures = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  marginTop: 40,
};

const signatureBox = {
  borderTop: "1px solid #111827",
  paddingTop: 12,
  lineHeight: 2,
};

const guarantorBox = {
  marginTop: 30,
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
