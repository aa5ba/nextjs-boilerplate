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
    <main className="sales-invoice-print-page" dir="rtl" style={pageStyle}>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .sales-invoice-print-page {
            min-height: 0 !important;
            height: auto !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .sales-invoice-actions { display: none !important; }
          .sales-invoice-paper {
            width: 190mm !important;
            height: 276mm !important;
            min-height: 0 !important;
            margin: 0 auto !important;
            border: 0 !important;
            box-shadow: none !important;
            padding: 10mm !important;
            break-inside: avoid-page !important;
            page-break-inside: avoid !important;
          }
        }
        @media (max-width: 640px) {
          .sales-invoice-paper { padding: 20px !important; }
          .sales-invoice-header { grid-template-columns: 1fr !important; }
          .sales-invoice-meta { text-align: right !important; }
          .sales-invoice-grid { grid-template-columns: 1fr !important; }
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
          <header className="sales-invoice-header" style={documentHeader}>
            <div>
              <h1 style={documentTitle}>{invoice.organization_name}</h1>
              {invoice.commercial_record ? (
                <div style={commercialRecord}>
                  رقم السجل التجاري: {invoice.commercial_record}
                </div>
              ) : null}
            </div>
            <div className="sales-invoice-meta" style={invoiceMeta}>
              <span style={operationBadge}>
                فاتورة {invoice.operation_type === "purchase" ? "شراء" : "بيع"}
              </span>
              <strong style={invoiceNumber}>رقم الفاتورة: {invoice.invoice_number}</strong>
              <span style={invoiceDate}>التاريخ: {formatDate(invoice.invoice_date)}</span>
            </div>
          </header>

          {invoice.status === "cancelled" ? <div style={cancelledStamp}>ملغاة</div> : null}

          <section style={sectionStyle}>
            <h2 style={sectionTitle}>بيانات العميل</h2>
            <div className="sales-invoice-grid" style={gridStyle}>
              <PrintField label="اسم العميل" value={invoice.customer_name} />
              <PrintField label="رقم الهوية" value={invoice.customer_national_id} />
              <PrintField label="رقم الجوال" value={invoice.customer_phone} />
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitle}>
              بيانات {invoice.operation_type === "purchase" ? "الشراء" : "البيع"}
            </h2>
            <div className="sales-invoice-grid" style={gridStyle}>
              <PrintField label="السلعة" value={invoice.product_name} />
              <PrintField label="الكمية" value={formatQuantity(invoice.quantity)} />
              <PrintField label="وسيلة الدفع" value={invoice.payment_method} />
            </div>
            <div style={totalBox}>
              <span>القيمة الإجمالية</span>
              <strong>{formatCurrency(invoice.total_amount)} ر.س</strong>
            </div>
          </section>

          {invoice.operation_type === "sale" ? (
            <div style={acknowledgement}>
              أقر بقبولي شراء السلعة حسب البيانات أعلاه وأقر بالتحقق منها واستلامها .
            </div>
          ) : null}

          <div style={signatureArea}>
            <div style={signatureIdentity}>
              <span>اسم العميل</span>
              <strong>{invoice.customer_name}</strong>
            </div>
            <div style={signatureBox}>
              <span>توقيع العميل</span>
              <div style={signatureLine} />
            </div>
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
const paperStyle: CSSProperties = { boxSizing: "border-box", width: "min(190mm,100%)", minHeight: "277mm", margin: "0 auto", padding: "12mm", background: "#fff", border: "1px solid #cbd5e1", borderTop: "7px solid #0f4c81", boxShadow: "0 18px 45px rgba(15,23,42,0.14)", position: "relative", overflow: "hidden" };
const documentHeader: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "start", gap: 24, borderBottom: "2px solid #0f4c81", paddingBottom: 22, marginBottom: 30 };
const documentTitle: CSSProperties = { margin: 0, color: "#0f2f5f", fontSize: 27, lineHeight: 1.5 };
const commercialRecord: CSSProperties = { marginTop: 7, color: "#64748b", fontSize: 13, fontWeight: 700 };
const invoiceMeta: CSSProperties = { display: "grid", justifyItems: "end", gap: 8, textAlign: "left" };
const operationBadge: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 125, borderRadius: 999, padding: "8px 16px", color: "#ffffff", background: "linear-gradient(135deg,#0f4c81,#1677b8)", fontWeight: 900, fontSize: 15 };
const invoiceNumber: CSSProperties = { color: "#0f172a", fontSize: 15 };
const invoiceDate: CSSProperties = { color: "#475569", fontSize: 13, fontWeight: 700 };
const sectionStyle: CSSProperties = { marginTop: 22 };
const sectionTitle: CSSProperties = { fontSize: 17, color: "#0f4c81", margin: "0 0 12px", paddingRight: 10, borderRight: "4px solid #38bdf8" };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", border: "1px solid #cbd5e1", borderRadius: 10, overflow: "hidden" };
const fieldStyle: CSSProperties = { display: "grid", gap: 7, minHeight: 66, padding: 13, border: "1px solid #e2e8f0", background: "#fbfdff" };
const fieldLabel: CSSProperties = { color: "#64748b", fontSize: 12, fontWeight: 700 };
const totalBox: CSSProperties = { marginTop: 14, marginRight: "auto", width: "min(310px,100%)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, borderRadius: 10, padding: "14px 16px", color: "#ffffff", background: "linear-gradient(135deg,#0f2f5f,#0f4c81)", fontSize: 14 };
const acknowledgement: CSSProperties = { marginTop: 34, border: "1px solid #93c5fd", borderRadius: 12, padding: 18, lineHeight: 2, fontWeight: 700, background: "#f8fbff", color: "#1e3a5f" };
const signatureArea: CSSProperties = { marginTop: 40, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 24 };
const signatureIdentity: CSSProperties = { display: "grid", gap: 9, padding: 14, border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569" };
const signatureBox: CSSProperties = { display: "grid", gap: 10, padding: 14, border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569" };
const signatureLine: CSSProperties = { height: 48, borderBottom: "1px solid #334155" };
const footerStyle: CSSProperties = { position: "absolute", right: "12mm", left: "12mm", bottom: "12mm", paddingTop: 10, borderTop: "1px solid #cbd5e1", color: "#64748b", fontSize: 11, textAlign: "center" };
const cancelledStamp: CSSProperties = { position: "absolute", left: 36, top: 120, transform: "rotate(-12deg)", color: "#b91c1c", border: "4px solid #b91c1c", padding: "8px 24px", fontWeight: 900, fontSize: 28, opacity: 0.7 };
const errorStyle: CSSProperties = { ...noticeStyle, color: "#b91c1c", background: "#fff1f2" };
