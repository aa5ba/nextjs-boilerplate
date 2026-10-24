"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  BackButton,
  cardStyle,
  dangerButton,
  formatCurrency,
  formatDate,
  formatQuantity,
  inputStyle,
  labelStyle,
  noticeStyle,
  primaryButton,
  SalesInvoiceShell,
  secondaryButton,
  type SalesInvoiceRecord,
  useSalesInvoiceSession,
} from "../components";

type DetailResponse = {
  ok?: boolean;
  message?: string;
  invoice?: SalesInvoiceRecord;
};

export default function SalesInvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const branch = String(params.branch ?? "").trim().toLowerCase();
  const invoiceId = String(params.id ?? "").trim();
  const session = useSalesInvoiceSession(branch, "sales_invoice_view");
  const [invoice, setInvoice] = useState<SalesInvoiceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCancellation, setShowCancellation] = useState(false);
  const [reason, setReason] = useState("");
  const [cancellationRequestId, setCancellationRequestId] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const loadInvoice = useCallback(async () => {
    if (!session.checked || !invoiceId) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/finance/api/sales-invoices/${encodeURIComponent(invoiceId)}?branch=${encodeURIComponent(branch)}`,
        { credentials: "include", cache: "no-store" }
      );
      const payload = (await response.json()) as DetailResponse;

      if (!response.ok || payload.ok === false || !payload.invoice) {
        throw new Error(payload.message || "تعذر تحميل الفاتورة");
      }

      setInvoice(payload.invoice);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل الفاتورة");
    } finally {
      setLoading(false);
    }
  }, [branch, invoiceId, session.checked]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  function openCancellation() {
    if (!cancellationRequestId && typeof crypto !== "undefined") {
      setCancellationRequestId(crypto.randomUUID());
    }
    setShowCancellation(true);
  }

  async function cancelInvoice() {
    if (!reason.trim() || !cancellationRequestId || cancelling) return;

    setCancelling(true);
    setError("");

    try {
      const response = await fetch(`/finance/api/sales-invoices/${encodeURIComponent(invoiceId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          cancellationRequestId,
          reason,
        }),
      });
      const payload = (await response.json()) as DetailResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || "تعذر إلغاء الفاتورة");
      }

      setShowCancellation(false);
      await loadInvoice();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "تعذر إلغاء الفاتورة");
    } finally {
      setCancelling(false);
    }
  }

  if (!session.checked) return <div style={noticeStyle}>جاري التحقق من الجلسة...</div>;

  return (
    <SalesInvoiceShell
      branch={branch}
      title="تفاصيل فاتورة شراء وبيع"
      employeeName={session.employeeName}
      actions={
        <>
          <BackButton />
          {invoice && session.canPrint ? (
            <button
              type="button"
              style={primaryButton}
              onClick={() => router.push(`/finance/${branch}/sales-invoices/${invoice.id}/print`)}
            >
              طباعة A4
            </button>
          ) : null}
          {invoice?.status === "active" && session.canCancel ? (
            <button type="button" style={dangerButton} onClick={openCancellation}>
              إلغاء الفاتورة
            </button>
          ) : null}
        </>
      }
    >
      {loading ? <div style={noticeStyle}>جاري تحميل الفاتورة...</div> : null}
      {error ? <div style={errorStyle}>{error}</div> : null}

      {invoice ? (
        <section style={cardStyle}>
          <div style={headingRow}>
            <div>
              <h2 style={{ margin: 0 }}>فاتورة رقم {invoice.invoice_number}</h2>
              <div style={muted}>{invoice.organization_name}</div>
            </div>
            <div style={badgesRow}>
              <span style={invoice.operation_type === "purchase" ? purchaseBadge : saleBadge}>
                {invoice.operation_type === "purchase" ? "شراء" : "بيع"}
              </span>
              <span style={invoice.status === "cancelled" ? cancelledBadge : activeBadge}>
                {invoice.status === "cancelled" ? "ملغاة" : "نشطة"}
              </span>
            </div>
          </div>

          <div style={detailsGrid}>
            <Detail label="تاريخ الفاتورة" value={formatDate(invoice.invoice_date)} />
            <Detail label="اسم العميل" value={invoice.customer_name} />
            <Detail label="رقم الهوية" value={invoice.customer_national_id} />
            <Detail label="رقم الجوال" value={invoice.customer_phone} />
            <Detail label="السلعة" value={invoice.product_name} />
            <Detail label="المستثمر" value={invoice.investor_name} />
            <Detail label="الكمية" value={formatQuantity(invoice.quantity)} />
            <Detail label="القيمة الإجمالية" value={`${formatCurrency(invoice.total_amount)} ر.س`} />
            <Detail label="وسيلة الدفع" value={invoice.payment_method} />
            <Detail
              label={invoice.operation_type === "purchase" ? "تكلفة الشراء التاريخية" : "تكلفة البيع التاريخية"}
              value={`${formatCurrency(invoice.sale_total_cost)} ر.س`}
            />
            {invoice.operation_type === "purchase" ? (
              <Detail label="الرصيد النقدي بعد الشراء" value={`${formatCurrency(invoice.cash_balance_after_operation)} ر.س`} />
            ) : null}
            <Detail label="منشئ الفاتورة" value={invoice.created_by_name} />
            <Detail label="وقت الإنشاء" value={formatDate(invoice.created_at)} />
          </div>

          {invoice.status === "cancelled" ? (
            <div style={cancelledBox}>
              <strong>بيانات الإلغاء</strong>
              <div>السبب: {invoice.cancellation_reason}</div>
              <div>ألغيت بواسطة: {invoice.cancelled_by_name}</div>
              <div>وقت الإلغاء: {formatDate(invoice.cancelled_at)}</div>
            </div>
          ) : null}

          {showCancellation ? (
            <div style={cancelForm}>
              <label>
                <span style={labelStyle}>سبب الإلغاء</span>
                <textarea
                  style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                  value={reason}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <div style={buttonRow}>
                <button
                  type="button"
                  style={dangerButton}
                  disabled={cancelling || !reason.trim()}
                  onClick={() => void cancelInvoice()}
                >
                  {cancelling ? "جاري الإلغاء..." : "تأكيد الإلغاء وعكس الحركات"}
                </button>
                <button type="button" style={secondaryButton} onClick={() => setShowCancellation(false)}>
                  تراجع
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </SalesInvoiceShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div style={detailBox}><span style={muted}>{label}</span><strong>{value}</strong></div>;
}

const headingRow: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 22 };
const badgesRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const detailsGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 };
const detailBox: CSSProperties = { display: "grid", gap: 6, padding: 14, borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" };
const muted: CSSProperties = { color: "#64748b", fontSize: 13 };
const badge: CSSProperties = { borderRadius: 999, padding: "7px 13px", fontWeight: 800 };
const activeBadge: CSSProperties = { ...badge, color: "#166534", background: "#dcfce7" };
const cancelledBadge: CSSProperties = { ...badge, color: "#991b1b", background: "#fee2e2" };
const saleBadge: CSSProperties = { ...badge, color: "#1d4ed8", background: "#dbeafe" };
const purchaseBadge: CSSProperties = { ...badge, color: "#92400e", background: "#fef3c7" };
const cancelledBox: CSSProperties = { display: "grid", gap: 7, marginTop: 18, padding: 16, borderRadius: 14, background: "#fff1f2", color: "#881337" };
const cancelForm: CSSProperties = { marginTop: 20, paddingTop: 20, borderTop: "1px solid #e2e8f0" };
const buttonRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 };
const errorStyle: CSSProperties = { ...cardStyle, color: "#b91c1c", background: "#fff1f2", marginBottom: 16 };
