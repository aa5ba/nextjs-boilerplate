"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";
import { exportElementToPdf } from "@/lib/exportElementToPdf";

export default function PaymentReceiptPage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;
  const paymentId = params.id as string;

  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [organizationSettings, setOrganizationSettings] = useState({
    name: "احتساب",
    phone: "",
    city: "",
    commercialRecord: "",
    logoUrl: "",
  });

  useEffect(() => {
    loadReceipt();

    const style = document.createElement("style");

    style.innerHTML = `
      @media print {
        button,
        .no-print {
          display: none !important;
        }

        body {
          background: white !important;
        }

        main {
          padding: 0 !important;
          background: white !important;
        }

        #receipt-print-area {
          box-shadow: none !important;
          border: none !important;
          margin: 0 auto !important;
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
    setLoading(true);

    const branchId = await getBranchId(branch);

    if (!branchId) {
      setPayment(null);
      setLoading(false);
      return;
    }

    const { data: paymentData, error: paymentError } = await supabase
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
          customer_name,
          customer_national_id,
          customer_phone,
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

    if (paymentError) {
      alert("تعذر تحميل الإيصال: " + paymentError.message);
      setPayment(null);
      setLoading(false);
      return;
    }

    const orgSettings = await getOrganizationSettings();

    const { data: branchData } = await supabase
      .from("finance_branches")
      .select("branch_name, organization_name, city, commercial_record, phone")
      .eq("id", branchId)
      .maybeSingle();

    setOrganizationSettings({
      name:
        branchData?.organization_name ||
        orgSettings?.name ||
        branchData?.branch_name ||
        "احتساب",
      phone: branchData?.phone || orgSettings?.phone || "",
      city: branchData?.city || orgSettings?.city || "",
      commercialRecord:
        branchData?.commercial_record || orgSettings?.commercialRecord || "",
      logoUrl: (orgSettings as any)?.logoUrl || "",
    });

    setPayment(paymentData);
    setLoading(false);
  }

  const contract = payment?.finance_contracts;
  const customer = contract?.finance_customers;

  const customerName =
    contract?.customer_name || customer?.full_name || "................";

  const customerNationalId =
    contract?.customer_national_id || customer?.national_id || "-";

  const customerPhone = contract?.customer_phone || customer?.phone || "-";

  const receiptNumber = useMemo(() => {
    return getReceiptNumber(payment);
  }, [payment]);

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

  const paymentTime = payment?.created_at
    ? new Date(payment.created_at).toLocaleTimeString("ar-SA", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل الإيصال...</div>
      </main>
    );
  }

  if (!payment) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>لم يتم العثور على الإيصال.</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <section id="receipt-print-area" style={printArea}>
        <header style={receiptHeader}>
          <div style={countryBox}>
            <strong>المملكة العربية السعودية</strong>
            {organizationSettings.city && (
              <span>{organizationSettings.city}</span>
            )}
          </div>

          <div style={brandBox}>
            {organizationSettings.logoUrl ? (
              <img
                src={organizationSettings.logoUrl}
                alt={organizationSettings.name}
                style={logoImage}
              />
            ) : (
              <div style={organizationNameBox}>
                {organizationSettings.name}
              </div>
            )}

            <div style={orgMeta}>
              {organizationSettings.commercialRecord && (
                <span>سجل تجاري: {organizationSettings.commercialRecord}</span>
              )}

              {organizationSettings.phone && (
                <span>جوال: {organizationSettings.phone}</span>
              )}
            </div>
          </div>

          <div style={receiptMetaTop}>
            <strong>إيصال سداد</strong>
            <span>{paymentDate}</span>
          </div>
        </header>

        <section style={titleBox}>
          <h1 style={title}>إيصال سداد</h1>

          <div style={receiptNumberBox}>
            رقم الإيصال: <strong>{receiptNumber}</strong>
          </div>
        </section>

        <section style={twoColumns}>
          <div style={infoBox}>
            <h2 style={boxTitle}>بيانات العقد والعميل</h2>

            <Row label="رقم العقد" value={contract?.contract_number || "-"} />
            <Row label="اسم العميل" value={customerName} />
            <Row label="رقم الهوية" value={customerNationalId} />
            <Row label="رقم الجوال" value={customerPhone} />
          </div>

          <div style={infoBox}>
            <h2 style={boxTitle}>بيانات السداد</h2>

            <Row
              label="مبلغ الدفعة"
              value={`${formatMoney(paymentAmount)} ر.س`}
            />
            <Row label="نوع السداد" value={payment?.payment_type || "-"} />
            <Row label="طريقة الدفع" value={payment?.notes || "-"} />
            <Row label="تاريخ السداد" value={paymentDate} />
            <Row label="وقت السداد" value={paymentTime} />
            <Row
              label="المتبقي بعد السداد"
              value={`${formatMoney(remainingAmount)} ر.س`}
            />
            <Row label="الموظف" value={payment?.created_by || "المدير"} />
          </div>
        </section>

        <section style={amountHighlight}>
          <span>المبلغ المستلم</span>
          <strong>{formatMoney(paymentAmount)} ر.س</strong>
        </section>

        <p style={paragraph}>
          تشهد <strong>{organizationSettings.name}</strong> باستلام مبلغ وقدره{" "}
          <strong>{formatMoney(paymentAmount)}</strong> ريال سعودي من العميل{" "}
          <strong>{customerName}</strong>، وذلك كسداد على العقد رقم{" "}
          <strong>{contract?.contract_number || "................"}</strong>.
        </p>

        <p style={paragraph}>
          ويعد هذا الإيصال إثباتًا لعملية السداد الموضحة أعلاه، ولا يعتبر
          مخالصة نهائية إلا في حال سداد كامل المديونية وإصدار مخالصة مستقلة.
        </p>

        <footer style={footerBox}>
          <div style={signatureBox}>
            <strong>المستلم</strong>
            <div>الاسم / {payment?.created_by || "المدير"}</div>
            <div>التوقيع / ................</div>
          </div>

          <div style={signatureBox}>
            <strong>العميل</strong>
            <div>الاسم / {customerName}</div>
            <div>التوقيع / ................</div>
          </div>
        </footer>

        <div style={receiptFooterNote}>
          تم إصدار هذا الإيصال آليًا من نظام محطة العمل.
        </div>
      </section>

      <div className="no-print" style={actionsWrapper}>
        <button style={primaryActionButton} onClick={() => window.print()}>
          🖨️ طباعة الإيصال
        </button>

        <button
          style={primaryActionButton}
          onClick={() =>
            exportElementToPdf(
              "receipt-print-area",
              `receipt-${receiptNumber || paymentId}`
            )
          }
        >
          📄 تحميل PDF
        </button>

        <button style={backButton} onClick={() => router.back()}>
          ← الرجوع
        </button>

        <button
          style={homeButton}
          onClick={() => router.push(`/finance/${branch}`)}
        >
          محطة العمل الرئيسية
        </button>
      </div>
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

function getReceiptNumber(payment: any) {
  if (!payment) return "-";

  if (payment.receipt_number) {
    return String(payment.receipt_number);
  }

  if (payment.receipt_no) {
    return String(payment.receipt_no);
  }

  if (payment.payment_number) {
    return String(payment.payment_number);
  }

  const createdAt = payment.created_at
    ? new Date(payment.created_at)
    : new Date();

  const year = String(createdAt.getFullYear()).slice(2);
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  const day = String(createdAt.getDate()).padStart(2, "0");

  const shortId = String(payment.id || "")
    .replace(/-/g, "")
    .slice(-6)
    .toUpperCase();

  return `REC-${year}${month}${day}-${shortId || "000000"}`;
}

function formatMoney(value: any) {
  const number = Number(value || 0);

  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
  color: "#111827",
};

const loadingBox: CSSProperties = {
  width: "100%",
  maxWidth: 850,
  margin: "80px auto",
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 24,
  textAlign: "center",
  fontWeight: 900,
  color: "#334155",
};

const printArea: CSSProperties = {
  background: "white",
  width: "190mm",
  minHeight: "257mm",
  margin: "0 auto",
  padding: "10mm",
  borderRadius: 0,
  lineHeight: 1.7,
  color: "#111827",
  boxSizing: "border-box",
  boxShadow: "0 18px 45px rgba(15,23,42,.08)",
};

const receiptHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.2fr 1fr",
  gap: 12,
  alignItems: "start",
  borderBottom: "2px solid #e2e8f0",
  paddingBottom: 12,
  marginBottom: 16,
};

const countryBox: CSSProperties = {
  display: "grid",
  gap: 5,
  fontSize: 13,
  color: "#111827",
};

const brandBox: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 7,
};

const logoImage: CSSProperties = {
  width: 78,
  height: 78,
  objectFit: "contain",
};

const organizationNameBox: CSSProperties = {
  minWidth: 150,
  maxWidth: 230,
  minHeight: 58,
  padding: "10px 14px",
  border: "1px solid #bfdbfe",
  borderRadius: 16,
  background: "#eff6ff",
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.6,
  textAlign: "center",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const orgMeta: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
  fontSize: 11,
  color: "#475569",
};

const receiptMetaTop: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 5,
  fontSize: 13,
  color: "#111827",
};

const titleBox: CSSProperties = {
  textAlign: "center",
  marginBottom: 16,
};

const title: CSSProperties = {
  color: "#0d47a1",
  fontSize: 25,
  margin: "0 0 10px",
  fontWeight: 900,
};

const receiptNumberBox: CSSProperties = {
  display: "inline-block",
  background: "#eef5ff",
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: "10px 24px",
  color: "#0d47a1",
  fontWeight: 900,
  fontSize: 15,
};

const twoColumns: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginBottom: 12,
};

const infoBox: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  background: "#ffffff",
};

const boxTitle: CSSProperties = {
  margin: "0 0 10px",
  color: "#0d47a1",
  fontSize: 17,
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "7px 0",
  borderBottom: "1px solid #eef2f7",
  fontSize: 13,
};

const amountHighlight: CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  margin: "14px 0",
  fontSize: 18,
  fontWeight: 900,
};

const paragraph: CSSProperties = {
  fontSize: 13.5,
  margin: "10px 0",
  textAlign: "justify",
};

const footerBox: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  marginTop: 34,
};

const signatureBox: CSSProperties = {
  borderTop: "1px solid #111827",
  paddingTop: 10,
  lineHeight: 1.9,
  fontSize: 13,
};

const receiptFooterNote: CSSProperties = {
  marginTop: 28,
  textAlign: "center",
  fontSize: 11,
  color: "#64748b",
  borderTop: "1px solid #e2e8f0",
  paddingTop: 10,
};

const actionsWrapper: CSSProperties = {
  width: "100%",
  maxWidth: 850,
  margin: "18px auto 0",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
};

const primaryActionButton: CSSProperties = {
  padding: 14,
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 25px rgba(13,71,161,0.18)",
};

const backButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.20)",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  borderRadius: 14,
  padding: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,.20)",
};

const homeButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.20)",
  background: "linear-gradient(135deg,#16a34a,#15803d)",
  color: "#ffffff",
  borderRadius: 14,
  padding: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(21,128,61,.25)",
};
