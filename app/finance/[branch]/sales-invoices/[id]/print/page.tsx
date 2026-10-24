"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  formatCurrency,
  formatDate,
  formatQuantity,
  noticeStyle,
  primaryButton,
  secondaryButton,
  type SalesInvoiceRecord,
  useSalesInvoiceSession,
} from "../../components";

type DetailResponse = {
  ok?: boolean;
  message?: string;
  invoice?: SalesInvoiceRecord;
};

export default function SalesInvoicePrintPage() {
  const params = useParams();
  const router = useRouter();
  const branch = String(params.branch ?? "").trim().toLowerCase();
  const invoiceId = String(params.id ?? "").trim();
  const session = useSalesInvoiceSession(branch, "sales_invoice_print");
  const [invoice, setInvoice] = useState<SalesInvoiceRecord | null>(null);
  const [error, setError] = useState("");

  const loadInvoice = useCallback(async () => {
    if (!session.checked || !invoiceId) return;

    try {
      const response = await fetch(
        `/finance/api/sales-invoices/${encodeURIComponent(invoiceId)}?branch=${encodeURIComponent(branch)}&mode=print`,
        { credentials: "include", cache: "no-store" }
      );
      const payload = (await response.json()) as DetailResponse;

      if (!response.ok || payload.ok === false || !payload.invoice) {
        throw new Error(payload.message || "تعذر تحميل الفاتورة");
      }

      setInvoice(payload.invoice);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل الفاتورة");
    }
  }, [branch, invoiceId, session.checked]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  if (!session.checked) return <div style={noticeStyle}>جاري التحقق من الجلسة...</div>;

  return (
    <main dir="rtl" style={pageStyle}>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          body { background: #fff !important; }
          .sales-invoice-actions { display: none !important; }
          .sales-invoice-paper {
            width: 190mm !important;
            min-height: 277mm !important;
            margin: 0 auto !important;
            border: 0 !important;
            box-shadow: none !important;
            padding: 10mm !important;
          }
        }
      `}</style>

      <div className="sales-invoice-actions" style={actionsStyle}>
        <button type="button" style={primaryButton} onClick={() => window.print()}>
          طباعة A4
        </button>
        <button type="button" style={secondaryButton} onClick={() => router.back()}>
          رجوع
        </button>
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}
      {!invoice && !error ? <div style={noticeStyle}>جاري تحميل الفاتورة...</div> : null}

      {invoice ? (
        <article className="sales-invoice-paper" style={paperStyle}>
          <header style={documentHeader}>
            <div>
              <h1 style={documentTitle}>{invoice.organization_name}</h1>
              <div style={subtitle}>
                فاتورة {invoice.operation_type === "purchase" ? "شراء" : "بيع"}
              </div>
            </div>
            <div style={invoiceMeta}>
              <strong>رقم الفاتورة: {invoice.invoice_number}</strong>
              <span>التاريخ: {formatDate(invoice.invoice_date)}</span>
            </div>
          </header>

          {invoice.status === "cancelled" ? <div style={cancelledStamp}>ملغاة</div> : null}

          <section style={sectionStyle}>
            <h2 style={sectionTitle}>بيانات العميل</h2>
            <div style={gridStyle}>
              <PrintField label="اسم العميل" value={invoice.customer_name} />
              <PrintField label="رقم الهوية" value={invoice.customer_national_id} />
              <PrintField label="رقم الجوال" value={invoice.customer_phone} />
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitle}>
              بيانات {invoice.operation_type === "purchase" ? "الشراء" : "البيع"}
            </h2>
            <div style={gridStyle}>
              <PrintField label="المستثمر" value={invoice.investor_name} />
              <PrintField label="السلعة" value={invoice.product_name} />
              <PrintField label="الكمية" value={formatQuantity(invoice.quantity)} />
              <PrintField label="القيمة الإجمالية" value={`${formatCurrency(invoice.total_amount)} ر.س`} />
              <PrintField label="وسيلة الدفع" value={invoice.payment_method} />
            </div>
          </section>

          {invoice.operation_type === "sale" ? (
            <div style={acknowledgement}>
              أقر بقبولي شراء السلعة حسب البيانات أعلاه وأقر بالتحقق منها واستلامها .
            </div>
          ) : null}

          <div style={signatureArea}>
            <span>اسم العميل: {invoice.customer_name}</span>
            <span>توقيع العميل:</span>
            <div style={signatureLine} />
          </div>

          <footer style={footerStyle}>
            أنشئت الفاتورة بواسطة {invoice.created_by_name}
            {invoice.status === "cancelled" ? ` — ألغيت بواسطة ${invoice.cancelled_by_name || "-"}` : ""}
          </footer>
        </article>
      ) : null}
    </main>
  );
}

function PrintField({ label, value }: { label: string; value: string }) {
  return <div style={fieldStyle}><span style={fieldLabel}>{label}</span><strong>{value}</strong></div>;
}

const pageStyle: CSSProperties = { minHeight: "100vh", padding: 20, background: "#e8f0f7", fontFamily: "var(--font-almarai), sans-serif", color: "#111827" };
const actionsStyle: CSSProperties = { width: "min(190mm,100%)", margin: "0 auto 16px", display: "flex", gap: 10 };
const paperStyle: CSSProperties = { boxSizing: "border-box", width: "min(190mm,100%)", minHeight: "277mm", margin: "0 auto", padding: "12mm", background: "#fff", border: "1px solid #cbd5e1", boxShadow: "0 18px 45px rgba(15,23,42,0.14)", position: "relative" };
const documentHeader: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 20, borderBottom: "3px solid #0f4c81", paddingBottom: 18, marginBottom: 28 };
const documentTitle: CSSProperties = { margin: 0, color: "#0f2f5f", fontSize: 25 };
const subtitle: CSSProperties = { marginTop: 7, color: "#475569", fontWeight: 800 };
const invoiceMeta: CSSProperties = { display: "grid", gap: 8, textAlign: "left" };
const sectionStyle: CSSProperties = { marginTop: 22 };
const sectionTitle: CSSProperties = { fontSize: 17, color: "#0f4c81", margin: "0 0 12px" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", border: "1px solid #cbd5e1" };
const fieldStyle: CSSProperties = { display: "grid", gap: 7, minHeight: 62, padding: 12, border: "1px solid #e2e8f0" };
const fieldLabel: CSSProperties = { color: "#64748b", fontSize: 12 };
const acknowledgement: CSSProperties = { marginTop: 34, border: "1px solid #94a3b8", borderRadius: 10, padding: 18, lineHeight: 2, fontWeight: 700 };
const signatureArea: CSSProperties = { marginTop: 42, display: "grid", gap: 18, width: "55%" };
const signatureLine: CSSProperties = { height: 55, borderBottom: "1px solid #334155" };
const footerStyle: CSSProperties = { position: "absolute", right: "12mm", left: "12mm", bottom: "12mm", paddingTop: 10, borderTop: "1px solid #cbd5e1", color: "#64748b", fontSize: 11, textAlign: "center" };
const cancelledStamp: CSSProperties = { position: "absolute", left: 36, top: 120, transform: "rotate(-12deg)", color: "#b91c1c", border: "4px solid #b91c1c", padding: "8px 24px", fontWeight: 900, fontSize: 28, opacity: 0.7 };
const errorStyle: CSSProperties = { ...noticeStyle, color: "#b91c1c", background: "#fff1f2" };
