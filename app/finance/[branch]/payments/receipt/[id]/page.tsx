"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";
import { exportElementToPdf } from "@/lib/exportElementToPdf";

type CustomerRelation = {
  full_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
};

type ContractRelation = {
  id?: string | null;
  contract_number?: string | null;
  debt_amount?: number | string | null;
  payment_amount?: number | string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  contract_status?: string | null;
  customer_name?: string | null;
  customer_national_id?: string | null;
  customer_phone?: string | null;
  finance_customers?:
    | CustomerRelation
    | CustomerRelation[]
    | null;
};

type PaymentReceipt = {
  id: string;
  branch_id?: string | null;
  receipt_number?: string | null;
  receipt_no?: string | null;
  payment_number?: string | null;
  payment_amount?: number | string | null;
  remaining_amount_after?: number | string | null;
  remaining_amount?: number | string | null;
  payment_type?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  finance_contracts?:
    | ContractRelation
    | ContractRelation[]
    | null;
};

type OrganizationSettingsState = {
  name: string;
  phone: string;
  city: string;
  commercialRecord: string;
  logoUrl: string;
};

type ReceiptRowProps = {
  label: string;
  value: string | number | null | undefined;
};

export default function PaymentReceiptPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "");
  const paymentId = String(params.id ?? "");

  const [payment, setPayment] =
    useState<PaymentReceipt | null>(null);

  const [loading, setLoading] = useState(true);

  const [
    organizationSettings,
    setOrganizationSettings,
  ] = useState<OrganizationSettingsState>({
    name: "احتساب",
    phone: "",
    city: "",
    commercialRecord: "",
    logoUrl: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      await loadReceipt(() => cancelled);
    }

    void run();

    const style = document.createElement("style");

    style.innerHTML = `
      @page {
        size: A4 portrait;
        margin: 8mm;
      }

      @media print {
        html,
        body {
          width: 100% !important;
          min-height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        button,
        .no-print {
          display: none !important;
        }

        main {
          width: 100% !important;
          min-height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }

        #receipt-print-area {
          width: 100% !important;
          min-height: auto !important;
          height: auto !important;
          margin: 0 !important;
          padding: 6mm !important;
          border: none !important;
          box-shadow: none !important;
          overflow: visible !important;
          box-sizing: border-box !important;
        }

        #receipt-print-area,
        #receipt-print-area * {
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        .receipt-block,
        .receipt-info-box,
        .receipt-signatures,
        .receipt-header,
        .receipt-amount {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `;

    document.head.appendChild(style);

    return () => {
      cancelled = true;
      document.head.removeChild(style);
    };
  }, [branch, paymentId]);

  async function loadReceipt(
    isCancelled: () => boolean = () => false
  ) {
    setLoading(true);

    try {
      const branchId = await getBranchId(branch);

      if (isCancelled()) {
        return;
      }

      if (!branchId || !paymentId) {
        setPayment(null);
        return;
      }

      const {
        data: paymentData,
        error: paymentError,
      } = await supabase
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

      if (isCancelled()) {
        return;
      }

      if (paymentError || !paymentData) {
        alert(
          `تعذر تحميل الإيصال: ${
            paymentError?.message || "الإيصال غير موجود"
          }`
        );

        setPayment(null);
        return;
      }

      const [
        orgSettings,
        branchResult,
      ] = await Promise.all([
        getOrganizationSettings(),

        supabase
          .from("finance_branches")
          .select(
            `
              branch_name,
              organization_name,
              city,
              commercial_record,
              phone
            `
          )
          .eq("id", branchId)
          .maybeSingle(),
      ]);

      if (isCancelled()) {
        return;
      }

      const branchData = branchResult.data;

      const organizationLogo =
        orgSettings &&
        typeof orgSettings === "object" &&
        "logoUrl" in orgSettings &&
        typeof orgSettings.logoUrl === "string"
          ? orgSettings.logoUrl
          : "";

      setOrganizationSettings({
        name:
          branchData?.organization_name ||
          orgSettings?.name ||
          branchData?.branch_name ||
          "احتساب",

        phone:
          branchData?.phone ||
          orgSettings?.phone ||
          "",

        city:
          branchData?.city ||
          orgSettings?.city ||
          "",

        commercialRecord:
          branchData?.commercial_record ||
          orgSettings?.commercialRecord ||
          "",

        logoUrl: organizationLogo,
      });

      setPayment(
        paymentData as PaymentReceipt
      );
    } catch (error) {
      console.error(
        "Load payment receipt error:",
        error
      );

      if (!isCancelled()) {
        setPayment(null);

        alert(
          "حدث خطأ غير متوقع أثناء تحميل الإيصال"
        );
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  const contract = useMemo(() => {
    const relation =
      payment?.finance_contracts;

    if (Array.isArray(relation)) {
      return relation[0] || null;
    }

    return relation || null;
  }, [payment]);

  const customer = useMemo(() => {
    const relation =
      contract?.finance_customers;

    if (Array.isArray(relation)) {
      return relation[0] || null;
    }

    return relation || null;
  }, [contract]);

  const customerName =
    contract?.customer_name ||
    customer?.full_name ||
    "................";

  const customerNationalId =
    contract?.customer_national_id ||
    customer?.national_id ||
    "-";

  const customerPhone =
    contract?.customer_phone ||
    customer?.phone ||
    "-";

  const receiptNumber = useMemo(() => {
    return getReceiptNumber(payment);
  }, [payment]);

  const paymentAmount = Number(
    payment?.payment_amount || 0
  );

  const remainingAmount = Number(
    payment?.remaining_amount_after ??
      payment?.remaining_amount ??
      contract?.remaining_amount ??
      0
  );

  const paymentDate = formatGregorianDate(
    payment?.created_at
  );

  const paymentTime = formatTime(
    payment?.created_at
  );

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>
          جاري تحميل الإيصال...
        </div>
      </main>
    );
  }

  if (!payment) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>
          لم يتم العثور على الإيصال.
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <section
        id="receipt-print-area"
        style={printArea}
      >
        <header
          className="receipt-header"
          style={receiptHeader}
        >
          <div style={countryBox}>
            <strong>
              المملكة العربية السعودية
            </strong>

            {organizationSettings.city && (
              <span>
                {organizationSettings.city}
              </span>
            )}
          </div>

          <div style={brandBox}>
            {organizationSettings.logoUrl ? (
              <img
                src={
                  organizationSettings.logoUrl
                }
                alt={
                  organizationSettings.name
                }
                style={logoImage}
              />
            ) : (
              <div
                style={organizationNameBox}
              >
                {organizationSettings.name}
              </div>
            )}

            <div style={orgMeta}>
              {organizationSettings.commercialRecord && (
                <span>
                  سجل تجاري:{" "}
                  {
                    organizationSettings.commercialRecord
                  }
                </span>
              )}

              {organizationSettings.phone && (
                <span>
                  جوال:{" "}
                  {organizationSettings.phone}
                </span>
              )}
            </div>
          </div>

          <div style={receiptMetaTop}>
            <strong>إيصال سداد</strong>
            <span>{paymentDate}</span>
          </div>
        </header>

        <section
          className="receipt-block"
          style={titleBox}
        >
          <h1 style={title}>
            إيصال سداد
          </h1>

          <div style={receiptNumberBox}>
            رقم الإيصال:{" "}
            <strong>
              {receiptNumber}
            </strong>
          </div>
        </section>

        <section
          className="receipt-block"
          style={twoColumns}
        >
          <div
            className="receipt-info-box"
            style={infoBox}
          >
            <h2 style={boxTitle}>
              بيانات العقد والعميل
            </h2>

            <Row
              label="رقم العقد"
              value={
                contract?.contract_number ||
                "-"
              }
            />

            <Row
              label="اسم العميل"
              value={customerName}
            />

            <Row
              label="رقم الهوية"
              value={customerNationalId}
            />

            <Row
              label="رقم الجوال"
              value={customerPhone}
            />
          </div>

          <div
            className="receipt-info-box"
            style={infoBox}
          >
            <h2 style={boxTitle}>
              بيانات السداد
            </h2>

            <Row
              label="مبلغ الدفعة"
              value={`${formatMoney(
                paymentAmount
              )} ر.س`}
            />

            <Row
              label="نوع السداد"
              value={
                payment.payment_type || "-"
              }
            />

            <Row
              label="طريقة الدفع"
              value={payment.notes || "-"}
            />

            <Row
              label="تاريخ السداد"
              value={paymentDate}
            />

            <Row
              label="وقت السداد"
              value={paymentTime}
            />

            <Row
              label="المتبقي بعد السداد"
              value={`${formatMoney(
                remainingAmount
              )} ر.س`}
            />

            <Row
              label="الموظف"
              value={
                payment.created_by ||
                "المدير"
              }
            />
          </div>
        </section>

        <section
          className="receipt-amount"
          style={amountHighlight}
        >
          <span>المبلغ المستلم</span>

          <strong>
            {formatMoney(paymentAmount)} ر.س
          </strong>
        </section>

        <section
          className="receipt-block"
          style={statementBox}
        >
          <p style={paragraph}>
            تشهد{" "}
            <strong>
              {organizationSettings.name}
            </strong>{" "}
            باستلام مبلغ وقدره{" "}
            <strong>
              {formatMoney(paymentAmount)}
            </strong>{" "}
            ريال سعودي من العميل{" "}
            <strong>
              {customerName}
            </strong>
            ، وذلك كسداد على العقد رقم{" "}
            <strong>
              {contract?.contract_number ||
                "................"}
            </strong>
            .
          </p>

          <p style={paragraph}>
            ويعد هذا الإيصال إثباتًا
            لعملية السداد الموضحة أعلاه،
            ولا يعتبر مخالصة نهائية إلا
            في حال سداد كامل المديونية
            وإصدار مخالصة مستقلة.
          </p>
        </section>

        <footer
          className="receipt-signatures"
          style={footerBox}
        >
          <div style={signatureBox}>
            <strong>المستلم</strong>

            <div>
              الاسم /{" "}
              {payment.created_by ||
                "المدير"}
            </div>

            <div>
              التوقيع / ................
            </div>
          </div>

          <div style={signatureBox}>
            <strong>العميل</strong>

            <div>
              الاسم / {customerName}
            </div>

            <div>
              التوقيع / ................
            </div>
          </div>
        </footer>

        <div style={receiptFooterNote}>
          تم إصدار هذا الإيصال آلياً من
          النظام
        </div>
      </section>

      <div
        className="no-print"
        style={actionsWrapper}
      >
        <button
          type="button"
          style={primaryActionButton}
          onClick={() =>
            window.print()
          }
        >
          🖨️ طباعة الإيصال
        </button>

        <button
          type="button"
          style={primaryActionButton}
          onClick={() =>
            exportElementToPdf(
              "receipt-print-area",
              `receipt-${
                receiptNumber ||
                paymentId
              }`
            )
          }
        >
          📄 تحميل PDF
        </button>

        <button
          type="button"
          style={backButton}
          onClick={() => router.back()}
        >
          ← رجوع
        </button>

        <button
          type="button"
          style={homeButton}
          onClick={() =>
            router.push(
              `/finance/${branch}`
            )
          }
        >
          محطة العمل الرئيسية
        </button>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
}: ReceiptRowProps) {
  return (
    <div style={row}>
      <span>{label}</span>

      <strong>{value || "-"}</strong>
    </div>
  );
}

function getReceiptNumber(
  payment: PaymentReceipt | null
) {
  if (!payment) {
    return "-";
  }

  if (payment.receipt_number) {
    return String(
      payment.receipt_number
    );
  }

  if (payment.receipt_no) {
    return String(payment.receipt_no);
  }

  if (payment.payment_number) {
    return String(
      payment.payment_number
    );
  }

  const createdAt = payment.created_at
    ? new Date(payment.created_at)
    : new Date();

  const year = String(
    createdAt.getFullYear()
  ).slice(2);

  const month = String(
    createdAt.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    createdAt.getDate()
  ).padStart(2, "0");

  const shortId = String(
    payment.id || ""
  )
    .replace(/-/g, "")
    .slice(-6)
    .toUpperCase();

  return `REC-${year}${month}${day}-${
    shortId || "000000"
  }`;
}

function formatGregorianDate(
  date?: string | null
) {
  if (!date) {
    return "-";
  }

  const parsedDate = new Date(date);

  if (
    Number.isNaN(parsedDate.getTime())
  ) {
    return "-";
  }

  const day = String(
    parsedDate.getDate()
  ).padStart(2, "0");

  const month = String(
    parsedDate.getMonth() + 1
  ).padStart(2, "0");

  const year = parsedDate.getFullYear();

  return `${day}/${month}/${year}`;
}

function formatTime(
  date?: string | null
) {
  if (!date) {
    return "-";
  }

  const parsedDate = new Date(date);

  if (
    Number.isNaN(parsedDate.getTime())
  ) {
    return "-";
  }

  return parsedDate.toLocaleTimeString(
    "ar-SA",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatMoney(
  value: number | string | null | undefined
) {
  const number = Number(value || 0);

  return number.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 16,
  fontFamily:
    "var(--font-almarai), sans-serif",
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
  background: "#ffffff",
  width: "190mm",
  minHeight: "255mm",
  margin: "0 auto",
  padding: "7mm",
  borderRadius: 0,
  lineHeight: 1.55,
  color: "#111827",
  boxSizing: "border-box",
  overflow: "hidden",
  boxShadow:
    "0 18px 45px rgba(15,23,42,0.08)",
};

const receiptHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1.25fr 1fr",
  gap: 10,
  alignItems: "start",
  borderBottom:
    "1.5px solid #e2e8f0",
  paddingBottom: 9,
  marginBottom: 10,
};

const countryBox: CSSProperties = {
  display: "grid",
  gap: 3,
  fontSize: 11.5,
  color: "#111827",
};

const brandBox: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 4,
};

const logoImage: CSSProperties = {
  width: 62,
  height: 62,
  objectFit: "contain",
};

const organizationNameBox: CSSProperties = {
  minWidth: 145,
  maxWidth: 225,
  minHeight: 45,
  padding: "7px 12px",
  border: "1px solid #bfdbfe",
  borderRadius: 13,
  background: "#eff6ff",
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.45,
  textAlign: "center",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const orgMeta: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 8,
  flexWrap: "wrap",
  fontSize: 9.5,
  color: "#475569",
};

const receiptMetaTop: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 3,
  fontSize: 11.5,
  color: "#111827",
};

const titleBox: CSSProperties = {
  textAlign: "center",
  marginBottom: 10,
};

const title: CSSProperties = {
  color: "#0d47a1",
  fontSize: 22,
  margin: "0 0 7px",
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const receiptNumberBox: CSSProperties = {
  display: "inline-block",
  background: "#eef5ff",
  border: "1px solid #bfdbfe",
  borderRadius: 12,
  padding: "7px 18px",
  color: "#0d47a1",
  fontWeight: 900,
  fontSize: 12.5,
};

const twoColumns: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 9,
  marginBottom: 9,
};

const infoBox: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 13,
  padding: 10,
  background: "#ffffff",
};

const boxTitle: CSSProperties = {
  margin: "0 0 6px",
  color: "#0d47a1",
  fontSize: 14.5,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  minHeight: 23,
  padding: "4px 0",
  borderBottom:
    "1px solid #eef2f7",
  fontSize: 11.3,
};

const amountHighlight: CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 13,
  padding: "9px 12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  margin: "9px 0",
  fontSize: 15.5,
  fontWeight: 900,
};

const statementBox: CSSProperties = {
  marginTop: 4,
};

const paragraph: CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.75,
  margin: "5px 0",
  textAlign: "justify",
};

const footerBox: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 22,
  marginTop: 20,
};

const signatureBox: CSSProperties = {
  borderTop: "1px solid #111827",
  paddingTop: 7,
  lineHeight: 1.75,
  fontSize: 11.5,
};

const receiptFooterNote: CSSProperties = {
  marginTop: 16,
  textAlign: "center",
  fontSize: 10,
  color: "#64748b",
  borderTop:
    "1px solid #e2e8f0",
  paddingTop: 7,
};

const actionsWrapper: CSSProperties = {
  width: "100%",
  maxWidth: 850,
  margin: "16px auto 0",
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
};

const primaryActionButton: CSSProperties = {
  padding: 14,
  background:
    "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 10px 25px rgba(13,71,161,0.18)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const backButton: CSSProperties = {
  border:
    "1px solid rgba(255,255,255,0.20)",
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  borderRadius: 14,
  padding: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 8px 18px rgba(21,128,61,0.24)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const homeButton: CSSProperties = {
  border:
    "1px solid rgba(255,255,255,0.20)",
  background:
    "linear-gradient(135deg,#16a34a,#15803d)",
  color: "#ffffff",
  borderRadius: 14,
  padding: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 8px 18px rgba(21,128,61,0.25)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};
