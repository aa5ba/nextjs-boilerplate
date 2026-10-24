"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";

import { normalizeNumber } from "@/lib/numberUtils";
import {
  BackButton,
  cardStyle,
  formatCurrency,
  formatQuantity,
  type InvoiceOperationType,
  inputStyle,
  labelStyle,
  noticeStyle,
  primaryButton,
  SalesInvoiceShell,
  useSalesInvoiceSession,
} from "../components";

const PAYMENT_METHODS = ["شبكة", "تحويل", "نقدًا", "تابي", "تمارا", "إمكان"];
const CREATE_PERMISSIONS = ["sales_invoice_create", "purchase_invoice_create"] as const;

type InventoryOption = {
  inventoryId: string;
  productId: string;
  productName: string;
  investorId: string;
  investorName: string;
  availableQuantity: number;
  averageUnitCost: number;
  totalCostValue: number;
  goodsWalletBalance: number;
  cashWalletBalance: number;
};

type OptionsResponse = {
  ok?: boolean;
  message?: string;
  organizationName?: string;
  options?: InventoryOption[];
};

type CreateResponse = {
  ok?: boolean;
  message?: string;
  result?: {
    invoice_id?: string;
    invoice_number?: number;
    was_created?: boolean;
  } | null;
};

function todayIso() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function NewSalesInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const branch = String(params.branch ?? "").trim().toLowerCase();
  const session = useSalesInvoiceSession(branch, CREATE_PERMISSIONS);
  const [requestId, setRequestId] = useState("");
  const [options, setOptions] = useState<InventoryOption[]>([]);
  const [organizationName, setOrganizationName] = useState("احتساب");
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [customerName, setCustomerName] = useState("");
  const [customerNationalId, setCustomerNationalId] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [operationType, setOperationType] = useState<InvoiceOperationType>("sale");
  const [investorId, setInvestorId] = useState("");
  const [inventoryId, setInventoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("شبكة");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => options.find((option) => option.inventoryId === inventoryId) ?? null,
    [inventoryId, options]
  );

  const investors = useMemo(() => {
    const investorMap = new Map<string, string>();
    for (const option of options) investorMap.set(option.investorId, option.investorName);
    return Array.from(investorMap, ([id, name]) => ({ id, name }));
  }, [options]);

  const productOptions = useMemo(
    () => options.filter((option) => option.investorId === investorId),
    [investorId, options]
  );

  const estimatedCost = useMemo(() => {
    if (!selected || operationType !== "sale") return 0;
    const normalizedQuantity = Number(normalizeNumber(quantity));
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) return 0;
    if (normalizedQuantity >= selected.availableQuantity) return selected.totalCostValue;
    return selected.totalCostValue * (normalizedQuantity / selected.availableQuantity);
  }, [operationType, quantity, selected]);

  useEffect(() => {
    if (!session.checked) return;
    if (!session.canCreateSale && session.canCreatePurchase) setOperationType("purchase");
  }, [session.canCreatePurchase, session.canCreateSale, session.checked]);

  useEffect(() => {
    if (requestId || typeof crypto === "undefined") return;

    const storageKey = `sales_invoice_request_id:${branch}`;
    const storedRequestId = sessionStorage.getItem(storageKey);
    const stableRequestId = storedRequestId || crypto.randomUUID();

    if (!storedRequestId) {
      sessionStorage.setItem(storageKey, stableRequestId);
    }

    setRequestId(stableRequestId);
  }, [branch, requestId]);

  useEffect(() => {
    if (!session.checked) return;

    let cancelled = false;

    async function loadOptions() {
      setLoadingOptions(true);
      setError("");

      try {
        const response = await fetch(
          `/finance/api/sales-invoices/options?branch=${encodeURIComponent(branch)}`,
          { credentials: "include", cache: "no-store" }
        );
        const payload = (await response.json()) as OptionsResponse;

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.message || "تعذر تحميل المخزون المتاح");
        }

        if (!cancelled) {
          setOptions(payload.options ?? []);
          setOrganizationName(payload.organizationName || "احتساب");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "تعذر تحميل المخزون المتاح");
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }

    void loadOptions();
    return () => { cancelled = true; };
  }, [branch, session.checked]);

  async function submitInvoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestId || saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/finance/api/sales-invoices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          requestId,
          invoiceDate,
          customerName,
          customerNationalId,
          customerPhone,
          operationType,
          inventoryId,
          quantity,
          totalAmount,
          paymentMethod,
        }),
      });
      const payload = (await response.json()) as CreateResponse;

      if (!response.ok || payload.ok === false || !payload.result?.invoice_id) {
        throw new Error(payload.message || "تعذر إنشاء الفاتورة");
      }

      sessionStorage.removeItem(`sales_invoice_request_id:${branch}`);
      router.replace(`/finance/${branch}/sales-invoices/${payload.result.invoice_id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر إنشاء الفاتورة");
    } finally {
      setSaving(false);
    }
  }

  if (!session.checked) return <div style={noticeStyle}>جاري التحقق من الجلسة...</div>;

  return (
    <SalesInvoiceShell
      branch={branch}
      title="فاتورة شراء أو بيع جديدة"
      employeeName={session.employeeName}
      actions={<BackButton />}
    >
      <form style={cardStyle} onSubmit={submitInvoice}>
        <div style={metaBox}>
          <div><strong>المؤسسة:</strong> {organizationName}</div>
          <div><strong>رقم الفاتورة:</strong> يُنشأ تلقائيًا للفرع عند الحفظ</div>
        </div>

        <div style={formGrid}>
          <Field label="نوع العملية">
            <select
              style={inputStyle}
              value={operationType}
              onChange={(event) => {
                setOperationType(event.target.value as InvoiceOperationType);
                setInventoryId("");
              }}
            >
              {session.canCreateSale ? <option value="sale">بيع</option> : null}
              {session.canCreatePurchase ? <option value="purchase">شراء</option> : null}
            </select>
          </Field>

          <Field label="تاريخ الفاتورة">
            <input
              type="date"
              style={inputStyle}
              value={invoiceDate}
              onChange={(event) => setInvoiceDate(event.target.value)}
              required
            />
          </Field>

          <Field label="اسم العميل">
            <input
              style={inputStyle}
              value={customerName}
              maxLength={150}
              onChange={(event) => setCustomerName(event.target.value)}
              required
            />
          </Field>

          <Field label="رقم الهوية">
            <input
              inputMode="numeric"
              style={inputStyle}
              value={customerNationalId}
              maxLength={10}
              onChange={(event) =>
                setCustomerNationalId(normalizeNumber(event.target.value).replace(/\D/g, "").slice(0, 10))
              }
              required
            />
          </Field>

          <Field label="رقم الجوال">
            <input
              inputMode="numeric"
              style={inputStyle}
              value={customerPhone}
              maxLength={10}
              onChange={(event) =>
                setCustomerPhone(normalizeNumber(event.target.value).replace(/\D/g, "").slice(0, 10))
              }
              required
            />
          </Field>

          <Field label="المستثمر">
            <select
              style={inputStyle}
              value={investorId}
              disabled={loadingOptions}
              onChange={(event) => {
                setInvestorId(event.target.value);
                setInventoryId("");
              }}
              required
            >
              <option value="">{loadingOptions ? "جاري تحميل المستثمرين..." : "اختر المستثمر"}</option>
              {investors.map((investor) => (
                <option key={investor.id} value={investor.id}>{investor.name}</option>
              ))}
            </select>
          </Field>

          <Field label="السلعة التابعة للمستثمر">
            <select
              style={inputStyle}
              value={inventoryId}
              disabled={loadingOptions || !investorId}
              onChange={(event) => setInventoryId(event.target.value)}
              required
            >
              <option value="">{loadingOptions ? "جاري تحميل المخزون..." : "اختر السلعة"}</option>
              {productOptions.map((option) => (
                <option
                  key={option.inventoryId}
                  value={option.inventoryId}
                  disabled={operationType === "sale" && option.availableQuantity <= 0}
                >
                  {option.productName} — المتاح {formatQuantity(option.availableQuantity)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الكمية">
            <input
              inputMode="decimal"
              style={inputStyle}
              value={quantity}
              onChange={(event) => setQuantity(normalizeNumber(event.target.value).replace(/[^0-9.]/g, ""))}
              required
            />
          </Field>

          <Field label={operationType === "purchase" ? "إجمالي تكلفة الشراء" : "القيمة الإجمالية للبيع"}>
            <input
              inputMode="decimal"
              style={inputStyle}
              value={totalAmount}
              onChange={(event) => setTotalAmount(normalizeNumber(event.target.value).replace(/[^0-9.]/g, ""))}
              required
            />
          </Field>

          <Field label="وسيلة الدفع">
            <select style={inputStyle} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              {PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}
            </select>
          </Field>
        </div>

        {selected ? (
          <div style={stockInfo}>
            <span>المتاح: {formatQuantity(selected.availableQuantity)}</span>
            <span>تكلفة المخزون: {formatCurrency(selected.totalCostValue)} ر.س</span>
            <span>محفظة البضائع: {formatCurrency(selected.goodsWalletBalance)} ر.س</span>
            <span>المحفظة النقدية: {formatCurrency(selected.cashWalletBalance)} ر.س</span>
            {operationType === "sale" ? (
              <span>التكلفة المتوقعة للبيع: {formatCurrency(estimatedCost)} ر.س</span>
            ) : (
              <span>متوسط التكلفة الحالي: {formatCurrency(selected.averageUnitCost)} ر.س</span>
            )}
          </div>
        ) : null}

        <p style={customerNotice}>
          بيانات العميل تخص هذه الفاتورة فقط، ولا يُنشأ أو يُعدّل سجل في العملاء.
        </p>

        {error ? <div style={errorStyle}>{error}</div> : null}

        <button type="submit" style={primaryButton} disabled={saving || loadingOptions || !requestId}>
          {saving ? "جاري حفظ الفاتورة..." : `حفظ فاتورة ${operationType === "purchase" ? "الشراء" : "البيع"}`}
        </button>
      </form>
    </SalesInvoiceShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span style={labelStyle}>{label}</span>{children}</label>;
}

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 16,
};
const metaBox: CSSProperties = { display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, background: "#eff6ff", borderRadius: 14, padding: 14, marginBottom: 18, color: "#1e3a5f" };
const stockInfo: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, margin: "18px 0", padding: 14, borderRadius: 14, background: "#f0fdfa", color: "#115e59", fontWeight: 700 };
const customerNotice: CSSProperties = { color: "#475569", fontSize: 13, margin: "14px 0" };
const errorStyle: CSSProperties = { color: "#b91c1c", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 12, padding: 12, marginBottom: 14 };
