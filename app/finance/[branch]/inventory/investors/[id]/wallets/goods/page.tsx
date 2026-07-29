"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";

import { normalizeNumber, toNumber } from "@/lib/numberUtils";

const ITEMS_PER_PAGE = 25;

type Investor = {
  id: string;
  investor_name: string | null;
  national_id: string | null;
};

type GoodsItem = {
  id: string;
  productId: string | null;
  productName: string | null;
  productCategory: string | null;
  productActive: boolean;
  quantity: number;
  averageUnitCost: number | null;
  totalCostValue: number;
  costInitialized: boolean;
  costInitializedAt: string | null;
  updatedAt: string | null;
};

type TransactionItem = {
  id: string;
  direction: string | null;
  transactionType: string | null;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  productName: string | null;
  note: string | null;
  createdAt: string | null;
};

type ActionMode = "initialize" | "decrease" | null;

export default function InvestorGoodsWalletPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "");
  const investorId = String(params.id ?? "");

  const [authChecked, setAuthChecked] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [items, setItems] = useState<GoodsItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statementTotal, setStatementTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statementLoading, setStatementLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [selectedItem, setSelectedItem] = useState<GoodsItem | null>(null);
  const [unitCost, setUnitCost] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const statementPages = Math.max(1, Math.ceil(statementTotal / ITEMS_PER_PAGE));
  const isManager = [
    "main_admin",
    "branch_manager",
    "مدير رئيسي",
    "مدير فرع",
    "مدير",
  ].includes(role);
  const canInitialize = isManager || permissions.includes("initialize_investor_goods_cost");
  const canDecrease = isManager || permissions.includes("adjust_investor_goods_quantity");
  const canViewStatement = isManager || permissions.includes("view_investor_goods_statement");

  const totals = useMemo(
    () =>
      items.reduce(
        (result, item) => ({
          quantity: result.quantity + Number(item.quantity || 0),
          value: result.value + Number(item.totalCostValue || 0),
          uninitialized:
            result.uninitialized + (item.quantity > 0 && !item.costInitialized ? 1 : 0),
        }),
        { quantity: 0, value: 0, uninitialized: 0 }
      ),
    [items]
  );

  useEffect(() => {
    if (!checkLogin()) {
      return;
    }

    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    let cancelled = false;

    async function run() {
      await Promise.all([
        loadGoods(() => cancelled),
        canViewStatement ? loadStatement(() => cancelled) : Promise.resolve(),
      ]);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [authChecked, branch, investorId, page, canViewStatement]);

  function checkLogin() {
    if (typeof window === "undefined") {
      return false;
    }

    const savedUser = localStorage.getItem("finance_user");
    const savedBranchUser = localStorage.getItem("finance_branch_user");
    const savedUserName = localStorage.getItem("finance_user_name");

    if (!savedUser && !savedBranchUser && !savedUserName) {
      router.replace("/login");
      return false;
    }

    setRole(localStorage.getItem("finance_role") || "");
    try {
      const parsed = JSON.parse(localStorage.getItem("finance_permissions") || "[]");
      setPermissions(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
    } catch {
      setPermissions([]);
    }

    return true;
  }

  async function loadGoods(isCancelled: () => boolean = () => false) {
    setLoading(true);
    setError("");

    const query = new URLSearchParams({
      branch,
      page: String(page),
    });

    try {
      const response = await fetch(
        `/finance/api/investors/${encodeURIComponent(investorId)}/wallets/goods?${query.toString()}`,
        { credentials: "include" }
      );
      const payload = await response.json().catch(() => null);

      if (isCancelled()) {
        return;
      }

      if (!response.ok || !payload?.ok) {
        setError(payload?.message || "تعذر تحميل محفظة السلع");
        setInvestor(null);
        setItems([]);
        setTotal(0);
        return;
      }

      setInvestor(payload.investor as Investor);
      setItems(Array.isArray(payload.items) ? (payload.items as GoodsItem[]) : []);
      setTotal(Number(payload.total || 0));
    } catch {
      if (!isCancelled()) {
        setError("تعذر تحميل محفظة السلع");
        setInvestor(null);
        setItems([]);
        setTotal(0);
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  async function loadStatement(isCancelled: () => boolean = () => false) {
    setStatementLoading(true);

    const query = new URLSearchParams({
      branch,
      page: "1",
    });

    try {
      const response = await fetch(
        `/finance/api/investors/${encodeURIComponent(investorId)}/wallets/goods/statement?${query.toString()}`,
        { credentials: "include" }
      );
      const payload = await response.json().catch(() => null);

      if (isCancelled()) {
        return;
      }

      if (!response.ok || !payload?.ok) {
        setTransactions([]);
        setStatementTotal(0);
        return;
      }

      setTransactions(
        Array.isArray(payload.transactions)
          ? (payload.transactions as TransactionItem[])
          : []
      );
      setStatementTotal(Number(payload.total || 0));
    } catch {
      if (!isCancelled()) {
        setTransactions([]);
        setStatementTotal(0);
      }
    } finally {
      if (!isCancelled()) {
        setStatementLoading(false);
      }
    }
  }

  function openAction(mode: ActionMode, item: GoodsItem) {
    setActionMode(mode);
    setSelectedItem(item);
    setUnitCost("");
    setQuantity("");
    setReason("");
    setActionError("");
    setActionMessage("");
  }

  function closeAction() {
    if (saving) {
      return;
    }

    setActionMode(null);
    setSelectedItem(null);
    setUnitCost("");
    setQuantity("");
    setReason("");
    setActionError("");
  }

  async function submitAction() {
    if (!actionMode || !selectedItem?.productId || saving) {
      return;
    }

    setSaving(true);
    setActionError("");
    setActionMessage("");

    const endpoint =
      actionMode === "initialize"
        ? "initialize-cost"
        : "decrease";
    const payload =
      actionMode === "initialize"
        ? {
            branch,
            productId: selectedItem.productId,
            openingUnitCost: toNumber(unitCost),
            note: reason.trim() || null,
          }
        : {
            branch,
            productId: selectedItem.productId,
            quantity: toNumber(quantity),
            reason: reason.trim(),
          };

    try {
      const response = await fetch(
        `/finance/api/investors/${encodeURIComponent(investorId)}/wallets/goods/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setActionError(result?.message || "تعذر تنفيذ العملية");
        return;
      }

      setActionMessage(result.message || "تم تنفيذ العملية");
      setActionMode(null);
      setSelectedItem(null);
      setUnitCost("");
      setQuantity("");
      setReason("");
      setActionError("");
      await Promise.all([loadGoods(), canViewStatement ? loadStatement() : Promise.resolve()]);
    } catch {
      setActionError("تعذر تنفيذ العملية");
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked) {
    return null;
  }

  return (
    <main dir="rtl" style={pageStyle}>
      <div style={container}>
        <header style={hero}>
          <div>
            <h1 style={title}>محفظة السلع</h1>
            <p style={subtitle}>{investor?.investor_name || "مخزون المستثمر"}</p>
          </div>

          <button type="button" style={homeButton} onClick={() => router.push(`/finance/${branch}`)}>
            محطة العمل الرئيسية
          </button>
        </header>

        <section style={summaryGrid}>
          <SummaryBox title="إجمالي الكمية" value={formatNumber(totals.quantity)} />
          <SummaryBox title="قيمة السلع" value={formatCurrency(totals.value)} />
          <SummaryBox title="منتجات بلا تكلفة" value={formatNumber(totals.uninitialized)} />
          <SummaryBox title="عدد المنتجات" value={formatNumber(total)} />
        </section>

        {actionMessage && <div style={successBox}>{actionMessage}</div>}
        {totals.uninitialized > 0 && (
          <div style={warningBox}>
            توجد سلع بتكلفة غير مهيأة. لن يتم تخمين تكلفة المخزون القديم.
          </div>
        )}

        <section style={card}>
          {loading ? (
            <div style={emptyBox}>جاري تحميل محفظة السلع...</div>
          ) : error ? (
            <div style={errorBox}>{error}</div>
          ) : (
            <>
              <div style={tableHeader}>
                <span>المنتج</span>
                <span>التصنيف</span>
                <span>الكمية</span>
                <span>تكلفة الوحدة</span>
                <span>القيمة</span>
                <span>الإجراءات</span>
              </div>

              {items.length === 0 ? (
                <div style={emptyBox}>لا توجد سلع مرتبطة بهذا المستثمر</div>
              ) : (
                items.map((item) => (
                  <div key={item.id} style={tableRow}>
                    <span>{item.productName || "-"}</span>
                    <span>{item.productCategory || "-"}</span>
                    <strong>{formatNumber(item.quantity)}</strong>
                    <span>
                      {item.costInitialized
                        ? formatCurrency(item.averageUnitCost)
                        : "غير مهيأة"}
                    </span>
                    <strong>{formatCurrency(item.totalCostValue)}</strong>
                    <div style={actionsCell}>
                      {canInitialize && !item.costInitialized && item.quantity > 0 && (
                        <button type="button" style={smallButton} onClick={() => openAction("initialize", item)}>
                          تحديد التكلفة
                        </button>
                      )}
                      {canDecrease && item.quantity > 0 && (
                        <button type="button" style={dangerButton} onClick={() => openAction("decrease", item)}>
                          تخفيض
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              <div style={paginationBox}>
                <button type="button" style={lightButton} disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  السابق
                </button>
                <span style={paginationText}>صفحة {page} من {totalPages}</span>
                <button type="button" style={lightButton} disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  التالي
                </button>
              </div>
            </>
          )}
        </section>

        {canViewStatement && (
          <section style={card}>
            <h2 style={sectionTitle}>كشف محفظة السلع</h2>
            {statementLoading ? (
              <div style={emptyBox}>جاري تحميل الكشف...</div>
            ) : transactions.length === 0 ? (
              <div style={emptyBox}>لا توجد حركات سلع مسجلة</div>
            ) : (
              <>
                <div style={statementHeader}>
                  <span>التاريخ</span>
                  <span>العملية</span>
                  <span>المنتج</span>
                  <span>الاتجاه</span>
                  <span>المبلغ</span>
                  <span>الرصيد بعد</span>
                </div>
                {transactions.map((transaction) => (
                  <div key={transaction.id} style={statementRow}>
                    <span>{formatDate(transaction.createdAt)}</span>
                    <span>{labelTransaction(transaction.transactionType)}</span>
                    <span>{transaction.productName || "-"}</span>
                    <span>{transaction.direction === "debit" ? "خصم" : "إضافة"}</span>
                    <strong>{formatCurrency(transaction.amount)}</strong>
                    <strong>{formatCurrency(transaction.balanceAfter)}</strong>
                  </div>
                ))}
                <div style={paginationText}>إجمالي حركات الكشف: {formatNumber(statementTotal)} - صفحة 1 من {statementPages}</div>
              </>
            )}
          </section>
        )}

        <div style={backWrapper}>
          <button type="button" style={backButton} onClick={() => router.back()}>
            الرجوع
          </button>
        </div>
      </div>

      {actionMode && selectedItem && (
        <div style={modalOverlay} onMouseDown={closeAction}>
          <div style={modalBox} onMouseDown={(event) => event.stopPropagation()}>
            <h2 style={sectionTitle}>
              {actionMode === "initialize" ? "تحديد التكلفة الافتتاحية" : "تخفيض كمية السلع"}
            </h2>
            <p style={modalSubtitle}>{selectedItem.productName || "-"}</p>

            {actionMode === "initialize" ? (
              <input
                style={input}
                inputMode="decimal"
                placeholder="تكلفة الوحدة"
                value={unitCost}
                onChange={(event) => setUnitCost(normalizeNumber(event.target.value))}
                disabled={saving}
              />
            ) : (
              <input
                style={input}
                inputMode="decimal"
                placeholder="الكمية"
                value={quantity}
                onChange={(event) => setQuantity(normalizeNumber(event.target.value))}
                disabled={saving}
              />
            )}

            <textarea
              style={textarea}
              placeholder={actionMode === "initialize" ? "ملاحظة اختيارية" : "سبب التخفيض"}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={saving}
            />

            {actionError && <div style={errorBox}>{actionError}</div>}

            <div style={modalActions}>
              <button type="button" style={lightButton} onClick={closeAction} disabled={saving}>
                إلغاء
              </button>
              <button type="button" style={primaryButton} onClick={submitAction} disabled={saving}>
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value?: number | string | null) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return "0 ريال";
  return `${numericValue.toLocaleString("ar-SA", {
    maximumFractionDigits: 2,
  })} ريال`;
}

function formatNumber(value?: number | string | null) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return "0";
  return numericValue.toLocaleString("ar-SA");
}

function labelTransaction(type?: string | null) {
  switch (type) {
    case "goods_opening_balance":
      return "رصيد افتتاحي";
    case "goods_purchase":
      return "شراء سلع";
    case "manual_goods_decrease":
      return "تخفيض يدوي";
    case "goods_to_contract":
      return "تحويل إلى عقد";
    case "goods_return_from_contract":
      return "إرجاع من عقد";
    default:
      return type || "-";
  }
}

function SummaryBox({ title, value }: { title: string; value: string }) {
  return (
    <div style={summaryBox}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 18,
  background:
    "linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)), url('/backgrounds/v13-finance-bg-1.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  fontFamily: "var(--font-almarai), sans-serif",
};

const container: CSSProperties = { maxWidth: 1180, margin: "auto" };

const hero: CSSProperties = {
  borderRadius: 24,
  padding: "22px 26px",
  marginBottom: 16,
  background:
    "linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
  color: "#ffffff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const title: CSSProperties = { margin: 0, fontSize: 30, fontWeight: 900 };
const subtitle: CSSProperties = { margin: "8px 0 0", fontSize: 15, fontWeight: 800 };

const homeButton: CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "12px 18px",
  background: "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 12,
  marginBottom: 16,
};

const summaryBox: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 8,
  color: "#0d47a1",
  fontWeight: 900,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const card: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  overflowX: "auto",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  marginBottom: 16,
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1.2fr 0.8fr 1fr 1fr 1.5fr",
  minWidth: 960,
  gap: 12,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: 900,
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1.2fr 0.8fr 1fr 1fr 1.5fr",
  minWidth: 960,
  gap: 12,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const statementHeader: CSSProperties = {
  ...tableHeader,
  gridTemplateColumns: "1fr 1fr 1.5fr 0.8fr 1fr 1fr",
};

const statementRow: CSSProperties = {
  ...tableRow,
  gridTemplateColumns: "1fr 1fr 1.5fr 0.8fr 1fr 1fr",
};

const actionsCell: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };

const emptyBox: CSSProperties = {
  padding: 18,
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 800,
};

const errorBox: CSSProperties = { ...emptyBox, border: "1px solid #fecaca", color: "#991b1b", background: "#fef2f2" };
const warningBox: CSSProperties = { ...emptyBox, border: "1px solid #fde68a", color: "#92400e", background: "#fffbeb", marginBottom: 14 };
const successBox: CSSProperties = { ...emptyBox, border: "1px solid #bbf7d0", color: "#166534", background: "#f0fdf4", marginBottom: 14 };

const sectionTitle: CSSProperties = { margin: "0 0 12px", color: "#0d47a1", fontSize: 20, fontWeight: 900 };
const modalSubtitle: CSSProperties = { margin: "0 0 14px", color: "#64748b", fontWeight: 800 };

const paginationBox: CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const paginationText: CSSProperties = { color: "#0f172a", fontWeight: 900 };
const lightButton: CSSProperties = {
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: "12px 18px",
  background: "#ffffff",
  color: "#0d47a1",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const smallButton: CSSProperties = {
  ...lightButton,
  padding: "9px 12px",
};

const dangerButton: CSSProperties = {
  ...smallButton,
  border: "1px solid #fecaca",
  color: "#991b1b",
};

const primaryButton: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  background: "linear-gradient(135deg,#0d65d9,#23a8e4)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const input: CSSProperties = {
  width: "100%",
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: "13px 14px",
  fontFamily: "var(--font-almarai), sans-serif",
  fontWeight: 800,
  marginBottom: 12,
  boxSizing: "border-box",
};

const textarea: CSSProperties = {
  ...input,
  minHeight: 90,
  resize: "vertical",
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  background: "rgba(15,23,42,0.42)",
  display: "grid",
  placeItems: "center",
  padding: 18,
};

const modalBox: CSSProperties = {
  width: "min(520px,100%)",
  background: "#ffffff",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 22px 60px rgba(15,23,42,0.24)",
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const backWrapper: CSSProperties = { display: "flex", justifyContent: "center", marginTop: 18 };
const backButton: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};
