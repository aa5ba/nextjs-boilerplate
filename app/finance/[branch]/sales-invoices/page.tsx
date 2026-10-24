"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  BackButton,
  cardStyle,
  formatCurrency,
  formatDate,
  formatQuantity,
  inputStyle,
  noticeStyle,
  primaryButton,
  SalesInvoiceShell,
  secondaryButton,
  type SalesInvoiceRecord,
  useSalesInvoiceSession,
} from "./components";

type ListResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  invoices?: SalesInvoiceRecord[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export default function SalesInvoicesPage() {
  const params = useParams();
  const router = useRouter();
  const branch = String(params.branch ?? "").trim().toLowerCase();
  const session = useSalesInvoiceSession(branch, "sales_invoice_view");
  const [invoices, setInvoices] = useState<SalesInvoiceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [operationType, setOperationType] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadInvoices = useCallback(async () => {
    if (!session.checked) return;

    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({ branch, page: String(page) });
      if (appliedSearch) query.set("search", appliedSearch);
      if (status !== "all") query.set("status", status);
      if (operationType !== "all") query.set("operationType", operationType);

      const response = await fetch(`/finance/api/sales-invoices?${query.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json()) as ListResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || "تعذر تحميل فواتير الشراء والبيع");
      }

      setInvoices(payload.invoices ?? []);
      setTotalPages(payload.pagination?.totalPages ?? 1);
      setTotal(payload.pagination?.total ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل فواتير الشراء والبيع");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, branch, operationType, page, session.checked, status]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  if (!session.checked) return <div style={noticeStyle}>جاري التحقق من الجلسة...</div>;

  return (
    <SalesInvoiceShell
      branch={branch}
      title="شراء وبيع"
      employeeName={session.employeeName}
      actions={
        <>
          {session.canCreate ? (
            <button
              type="button"
              style={primaryButton}
              onClick={() => router.push(`/finance/${branch}/sales-invoices/new`)}
            >
              فاتورة شراء أو بيع جديدة
            </button>
          ) : null}
          <BackButton />
        </>
      }
    >
      <section style={cardStyle}>
        <form
          style={filtersStyle}
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setAppliedSearch(search.trim());
          }}
        >
          <input
            style={inputStyle}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث برقم الفاتورة أو العميل أو الهوية أو الجوال أو السلعة"
          />
          <select
            style={inputStyle}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">كل الحالات</option>
            <option value="active">نشطة</option>
            <option value="cancelled">ملغاة</option>
          </select>
          <select
            style={inputStyle}
            value={operationType}
            onChange={(event) => {
              setOperationType(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">كل العمليات</option>
            <option value="sale">بيع</option>
            <option value="purchase">شراء</option>
          </select>
          <button type="submit" style={primaryButton}>بحث</button>
          <button
            type="button"
            style={secondaryButton}
            onClick={() => {
              setSearch("");
              setAppliedSearch("");
              setStatus("all");
              setOperationType("all");
              setPage(1);
            }}
          >
            مسح
          </button>
        </form>

        <div style={summaryStyle}>إجمالي النتائج: {total}</div>

        {error ? <div style={errorStyle}>{error}</div> : null}

        <div style={tableWrapper}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>العميل</th>
                <th>السلعة / المستثمر</th>
                <th>الكمية</th>
                <th>الإجمالي</th>
                <th>الدفع</th>
                <th>الحالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={emptyCell}>جاري التحميل...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={10} style={emptyCell}>لا توجد فواتير شراء أو بيع</td></tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.invoice_number}</td>
                    <td>{formatDate(invoice.invoice_date)}</td>
                    <td>
                      <span style={invoice.operation_type === "purchase" ? purchaseBadge : saleBadge}>
                        {invoice.operation_type === "purchase" ? "شراء" : "بيع"}
                      </span>
                    </td>
                    <td>
                      <strong>{invoice.customer_name}</strong>
                      <small style={subText}>{invoice.customer_national_id}</small>
                    </td>
                    <td>
                      <strong>{invoice.product_name}</strong>
                      <small style={subText}>{invoice.investor_name}</small>
                    </td>
                    <td>{formatQuantity(invoice.quantity)}</td>
                    <td>{formatCurrency(invoice.total_amount)} ر.س</td>
                    <td>{invoice.payment_method}</td>
                    <td>
                      <span style={invoice.status === "cancelled" ? cancelledBadge : activeBadge}>
                        {invoice.status === "cancelled" ? "ملغاة" : "نشطة"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        style={linkButton}
                        onClick={() => router.push(`/finance/${branch}/sales-invoices/${invoice.id}`)}
                      >
                        التفاصيل
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={paginationStyle}>
          <button
            type="button"
            style={secondaryButton}
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            السابق
          </button>
          <span>الصفحة {page} من {totalPages}</span>
          <button
            type="button"
            style={secondaryButton}
            disabled={page >= totalPages || loading}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            التالي
          </button>
        </div>
      </section>
    </SalesInvoiceShell>
  );
}

const filtersStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(240px,2fr) minmax(150px,1fr) minmax(150px,1fr) auto auto",
  gap: 10,
  alignItems: "center",
};

const summaryStyle: CSSProperties = { margin: "18px 0 10px", color: "#475569", fontWeight: 700 };
const tableWrapper: CSSProperties = { overflowX: "auto" };
const tableStyle: CSSProperties = { width: "100%", minWidth: 900, borderCollapse: "collapse", textAlign: "right" };
const emptyCell: CSSProperties = { textAlign: "center", padding: 30, color: "#64748b" };
const subText: CSSProperties = { display: "block", marginTop: 4, color: "#64748b" };
const badgeBase: CSSProperties = { display: "inline-block", borderRadius: 999, padding: "5px 10px", fontWeight: 800, fontSize: 12 };
const activeBadge: CSSProperties = { ...badgeBase, background: "#dcfce7", color: "#166534" };
const cancelledBadge: CSSProperties = { ...badgeBase, background: "#fee2e2", color: "#991b1b" };
const saleBadge: CSSProperties = { ...badgeBase, background: "#dbeafe", color: "#1d4ed8" };
const purchaseBadge: CSSProperties = { ...badgeBase, background: "#fef3c7", color: "#92400e" };
const linkButton: CSSProperties = { border: 0, background: "transparent", color: "#0f4c81", cursor: "pointer", fontFamily: "inherit", fontWeight: 800 };
const paginationStyle: CSSProperties = { display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 20 };
const errorStyle: CSSProperties = { background: "#fff1f2", color: "#b91c1c", border: "1px solid #fecdd3", borderRadius: 12, padding: 12, marginBottom: 12 };
