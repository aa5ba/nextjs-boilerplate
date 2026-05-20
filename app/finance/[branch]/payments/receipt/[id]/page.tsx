"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";
import { exportElementToPdf } from "@/lib/exportElementToPdf";

export default function PaymentReceiptPage() {
  const params = useParams();

  const branch = params.branch as string;
  const paymentId = params.id as string;

  const [payment, setPayment] = useState<any>(null);
  const [organizationSettings, setOrganizationSettings] = useState({
    name: "احتساب",
    phone: "",
    city: "",
    commercialRecord: "",
  });

  useEffect(() => {
    loadReceipt();

    const style = document.createElement("style");

    style.innerHTML = `
      @media print {
        button {
          display: none !important;
        }

        body {
          background: white !important;
        }

        main {
          padding: 0 !important;
          background: white !important;
        }
      }

      @page {
        size: A4;
        margin: 8mm;
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [branch, paymentId]);

  async function loadReceipt() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setPayment(null);
      return;
    }

    const { data } = await supabase
      .from("finance_payments")
      .select(
        `
        *,
        finance_contracts(
          id,
          contract_number,
          debt_amount,
          payment_amount,
          paid_amount,
          remaining_amount,
          contract_status,
          finance_customers(
            full_name,
            national_id,
            phone
          )
        )
      `
      )
      .eq("id", paymentId)
      .eq("branch_id", branchId)
      .single();

    const orgSettings = await getOrganizationSettings();

    setOrganizationSettings(orgSettings);
    setPayment(data);
  }

  const contract = payment?.finance_contracts;
  const customer = contract?.finance_customers;

  const receiptNumber = payment?.receipt_number || payment?.id || "-";
  const paymentAmount = Number(payment?.payment_amount || 0);
  const remainingAmount = Number(
    payment?.remaining_amount_after ||
      payment?.remaining_amount ||
      contract?.remaining_amount ||
      0
  );

  const paymentDate = payment?.created_at
    ? new Date(payment.created_at).toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  return (
    <main dir="rtl" style={page}>
      <section id="receipt-print-area" style={printArea}>
        <div style={topLine}>
          <span>المملكة العربية السعودية</span>
          <span>{organizationSettings.city || "إيصال سداد"}</span>
        </div>

        <div style={logoBox}>
          <div style={organizationLogoText}>{organizationSettings.name}</div>
        </div>

        <div style={organizationInfo}>
          {organizationSettings.phone && (
            <span>جوال: {organizationSettings.phone}</span>
          )}

          {organizationSettings.commercialRecord && (
            <span>سجل تجاري: {organizationSettings.commercialRecord}</span>
          )}
        </div>

        <h1 style={title}>إيصال سداد</h1>

        <div style={receiptNumberBox}>رقم الإيصال: {receiptNumber}</div>

        <section style={infoBox}>
          <Row label="رقم العقد" value={contract?.contract_number || "-"} />
          <Row label="اسم العميل" value={customer?.full_name || "-"} />
          <Row label="رقم الهوية" value={customer?.national_id || "-"} />
          <Row label="رقم الجوال" value={customer?.phone || "-"} />
        </section>

        <section style={infoBox}>
          <Row label="مبلغ الدفعة" value={`${paymentAmount} ر.س`} />
          <Row label="نوع السداد" value={payment?.payment_type || "-"} />
          <Row label="تاريخ السداد" value={paymentDate} />
          <Row label="المتبقي بعد السداد" value={`${remainingAmount} ر.س`} />
          <Row label="الموظف" value={payment?.created_by || "المدير"} />
        </section>

        <p style={paragraph}>
          تشهد <strong>{organizationSettings.name}</strong> باستلام مبلغ وقدره{" "}
          <strong>{paymentAmount}</strong> ريال سعودي من العميل{" "}
          <strong>{customer?.full_name || "................"}</strong>، وذلك
          كسداد على العقد رقم{" "}
          <strong>{contract?.contract_number || "................"}</strong>.
        </p>

        <p style={paragraph}>
          ويعد هذا الإيصال إثباتًا لعملية السداد الموضحة أعلاه، ولا يعتبر
          مخالصة نهائية إلا في حال سداد كامل المديونية وإصدار مخالصة مستقلة.
        </p>

        <div style={signatures}>
          <div style={signatureBox}>
            <strong>المستلم</strong>
            <div>الاسم / {payment?.created_by || "المدير"}</div>
            <div>التوقيع / ................</div>
          </div>

          <div style={signatureBox}>
            <strong>العميل</strong>
            <div>الاسم / {customer?.full_name || "................"}</div>
            <div>التوقيع / ................</div>
          </div>
        </div>
      </section>

      <button style={printButton} onClick={() => window.print()}>
        🖨️ طباعة الإيصال
      </button>

      <button
        style={printButton}
        onClick={() =>
          exportElementToPdf(
            "receipt-print-area",
            `receipt-${receiptNumber || paymentId}`
          )
        }
      >
        📄 تحميل PDF
      </button>

      <button
        style={backButton}
        onClick={() =>
          (window.location.href = `/finance/${branch}/contracts/${
            contract?.id || ""
          }`)
        }
      >
        الرجوع للعقد
      </button>
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

const printArea = {
  background: "white",
  width: "190mm",
  minHeight: "257mm",
  margin: "0 auto",
  overflow: "hidden" as const,
  padding: "8mm",
  borderRadius: 0,
  lineHeight: 1.6,
  color: "#111827",
  boxSizing: "border-box" as const,
};

const topLine = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
  fontWeight: "bold",
  marginBottom: 8,
};

const logoBox = {
  width: 55,
  height: 55,
  margin: "0 auto 6px",
  border: "1px dashed #94a3b8",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const organizationLogoText = {
  textAlign: "center" as const,
  fontSize: 11,
  fontWeight: "bold",
  color: "#0f172a",
  lineHeight: 1.5,
  padding: 4,
};

const organizationInfo = {
  display: "flex",
  justifyContent: "center",
  gap: 12,
  fontSize: 10.5,
  color: "#475569",
  marginBottom: 8,
};

const title = {
  textAlign: "center" as const,
  color: "#0d47a1",
  fontSize: 22,
  margin: "8px 0 10px",
  textDecoration: "underline",
};

const receiptNumberBox = {
  textAlign: "center" as const,
  background: "#eef5ff",
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: 10,
  marginBottom: 14,
  color: "#0d47a1",
  fontWeight: "bold",
};

const infoBox = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "7px 0",
  borderBottom: "1px solid #eef2f7",
  fontSize: 13,
};

const paragraph = {
  fontSize: 13,
  margin: "10px 0",
  textAlign: "justify" as const,
};

const signatures = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
  marginTop: 28,
};

const signatureBox = {
  borderTop: "1px solid #111827",
  paddingTop: 10,
  lineHeight: 1.8,
  fontSize: 13,
};

const printButton = {
  width: "100%",
  maxWidth: 850,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  margin: "20px auto 0",
  padding: 16,
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  border: "none",
  borderRadius: 16,
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 10px 25px rgba(13,71,161,0.18)",
  transition: "0.2s",
};

const backButton = {
  width: "100%",
  maxWidth: 850,
  display: "block",
  margin: "12px auto 0",
  padding: 16,
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
};
