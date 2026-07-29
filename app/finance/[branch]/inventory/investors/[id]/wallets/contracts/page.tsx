"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";

const ITEMS_PER_PAGE = 25;

type Investor = {
  id: string;
  investor_name: string | null;
  national_id: string | null;
};

type ContractItem = {
  id: string;
  contractNumber: number | string | null;
  customerName: string | null;
  contractType: string | null;
  debtAmount: number;
  paidAmount: number;
  remainingAmount: number;
  contractStatus: string | null;
  contractDateGregorian: string | null;
  createdAt: string | null;
};

type SummaryData = {
  balance?: number;
  totalDebt?: number;
  totalPaid?: number;
  totalRemaining?: number;
  lastTransactionAt?: string | null;
};

type TransactionItem = {
  id: string;
  direction: string | null;
  transactionType: string | null;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  contractNumber: string | null;
  paymentId: string | null;
  createdAt: string | null;
};

export default function InvestorContractsWalletPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "");
  const investorId = String(params.id ?? "");

  const [authChecked, setAuthChecked] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({});
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statementTotal, setStatementTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statementLoading, setStatementLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const statementPages = Math.max(1, Math.ceil(statementTotal / ITEMS_PER_PAGE));
  const isManager = [
    "main_admin",
    "branch_manager",
    "مدير رئيسي",
    "مدير فرع",
    "مدير",
  ].includes(role);
  const canViewStatement =
    isManager || permissions.includes("view_investor_contracts_statement");

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
        loadContracts(() => cancelled),
        loadSummary(() => cancelled),
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

  async function loadContracts(isCancelled: () => boolean = () => false) {
    setLoading(true);
    setError("");

    const query = new URLSearchParams({
      branch,
      page: String(page),
    });

    try {
      const response = await fetch(
        `/finance/api/investors/${encodeURIComponent(investorId)}/wallets/contracts?${query.toString()}`,
        { credentials: "include" }
      );
      const payload = await response.json().catch(() => null);

      if (isCancelled()) {
        return;
      }

      if (!response.ok || !payload?.ok) {
        setError(payload?.message || "تعذر تحميل محفظة العقود");
        setInvestor(null);
        setContracts([]);
        setTotal(0);
        return;
      }

      setInvestor(payload.investor as Investor);
      setContracts(
        Array.isArray(payload.contracts)
          ? (payload.contracts as ContractItem[])
          : []
      );
      setTotal(Number(payload.total || 0));
    } catch {
      if (!isCancelled()) {
        setError("تعذر تحميل محفظة العقود");
        setInvestor(null);
        setContracts([]);
        setTotal(0);
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  async function loadSummary(isCancelled: () => boolean = () => false) {
    const query = new URLSearchParams({ branch });

    try {
      const response = await fetch(
        `/finance/api/investors/${encodeURIComponent(investorId)}/wallets/summary?${query.toString()}`,
        { credentials: "include" }
      );
      const payload = await response.json().catch(() => null);

      if (isCancelled() || !response.ok || !payload?.ok) {
        return;
      }

      setSummary(payload.summary?.contracts || {});
    } catch {
      if (!isCancelled()) {
        setSummary({});
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
        `/finance/api/investors/${encodeURIComponent(investorId)}/wallets/contracts/statement?${query.toString()}`,
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

  if (!authChecked) {
    return null;
  }

  return (
    <main dir="rtl" style={pageStyle}>
      <div style={container}>
        <header style={hero}>
          <div>
            <h1 style={title}>محفظة العقود</h1>
            <p style={subtitle}>{investor?.investor_name || "عقود المستثمر"}</p>
          </div>

          <button type="button" style={homeButton} onClick={() => router.push(`/finance/${branch}`)}>
            محطة العمل الرئيسية
          </button>
        </header>

        <section style={summaryGrid}>
          <SummaryBox title="رصيد محفظة العقود" value={formatCurrency(summary.balance)} />
          <SummaryBox title="إجمالي العقود" value={formatCurrency(summary.totalDebt)} />
          <SummaryBox title="إجمالي المدفوع" value={formatCurrency(summary.totalPaid)} />
          <SummaryBox title="إجمالي المتبقي" value={formatCurrency(summary.totalRemaining)} />
        </section>

        <section style={card}>
          {loading ? (
            <div style={emptyBox}>جاري تحميل محفظة العقود...</div>
          ) : error ? (
            <div style={errorBox}>{error}</div>
          ) : (
            <>
              <div style={tableHeader}>
                <span>رقم العقد</span>
                <span>العميل</span>
                <span>النوع</span>
                <span>الدين</span>
                <span>المدفوع</span>
                <span>المتبقي</span>
                <span>الحالة</span>
              </div>

              {contracts.length === 0 ? (
                <div style={emptyBox}>لا توجد عقود مرتبطة بهذا المستثمر</div>
              ) : (
                contracts.map((contract) => (
                  <button
                    key={contract.id}
                    type="button"
                    style={tableRow}
                    onClick={() => router.push(`/finance/${branch}/contracts/${contract.id}`)}
                  >
                    <span>{contract.contractNumber || "-"}</span>
                    <span>{contract.customerName || "-"}</span>
                    <span>{contract.contractType || "-"}</span>
                    <span>{formatCurrency(contract.debtAmount)}</span>
                    <span>{formatCurrency(contract.paidAmount)}</span>
                    <strong>{formatCurrency(contract.remainingAmount)}</strong>
                    <span>{contract.contractStatus || "-"}</span>
                  </button>
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
            <h2 style={sectionTitle}>كشف محفظة العقود</h2>
            {statementLoading ? (
              <div style={emptyBox}>جاري تحميل الكشف...</div>
            ) : transactions.length === 0 ? (
              <div style={emptyBox}>لا توجد حركات عقود مسجلة</div>
            ) : (
              <>
                <div style={statementHeader}>
                  <span>التاريخ</span>
                  <span>العملية</span>
                  <span>رقم العقد</span>
                  <span>الاتجاه</span>
                  <span>المبلغ</span>
                  <span>الرصيد بعد</span>
                </div>
                {transactions.map((transaction) => (
                  <div key={transaction.id} style={statementRow}>
                    <span>{formatDate(transaction.createdAt)}</span>
                    <span>{labelTransaction(transaction.transactionType)}</span>
                    <span>{transaction.contractNumber || "-"}</span>
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
    </main>
  );
}

function labelTransaction(type?: string | null) {
  switch (type) {
    case "contract_created":
      return "إضافة عقد";
    case "contract_amount_adjustment":
      return "تعديل مبلغ عقد";
    case "contract_investor_transfer":
      return "نقل عقد";
    case "contract_payment_received":
      return "سداد عقد";
    case "payment_reversed":
      return "عكس سداد";
    default:
      return type || "-";
  }
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
  gridTemplateColumns: "1fr 1.4fr 1fr 1fr 1fr 1fr 1fr",
  minWidth: 980,
  gap: 12,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: 900,
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow: CSSProperties = {
  ...tableHeader,
  width: "100%",
  border: "none",
  borderBottom: "1px solid #eef2f7",
  borderRadius: 0,
  background: "#ffffff",
  color: "#0f172a",
  textAlign: "right",
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const statementHeader: CSSProperties = {
  ...tableHeader,
  gridTemplateColumns: "1fr 1fr 1fr 0.8fr 1fr 1fr",
  minWidth: 880,
};

const statementRow: CSSProperties = {
  ...tableRow,
  gridTemplateColumns: "1fr 1fr 1fr 0.8fr 1fr 1fr",
  minWidth: 880,
};

const emptyBox: CSSProperties = {
  padding: 18,
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  textAlign: "center",
  color: "#64748b",
  fontWeight: 800,
};

const errorBox: CSSProperties = { ...emptyBox, border: "1px solid #fecaca", color: "#991b1b", background: "#fef2f2" };

const sectionTitle: CSSProperties = { margin: "0 0 12px", color: "#0d47a1", fontSize: 20, fontWeight: 900 };

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
