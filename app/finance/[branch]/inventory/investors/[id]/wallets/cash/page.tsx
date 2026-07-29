"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";

const ITEMS_PER_PAGE = 25;

type ScreenType = "mobile" | "tablet" | "desktop";
type ActionMode = "deposit" | "withdraw";

type Investor = {
  id: string;
  investor_name: string | null;
  national_id: string | null;
};

type CashSummary = {
  balance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  transactionsCount: number;
  lastTransactionAt: string | null;
};

type CashTransaction = {
  id: string;
  direction: string | null;
  transactionType: string | null;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  actorUserName: string | null;
  createdAt: string | null;
};

export default function InvestorCashWalletPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "");
  const investorId = String(params.id ?? "");

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [authChecked, setAuthChecked] = useState(false);
  const [employeeName, setEmployeeName] = useState("الموظف");
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [investor, setInvestor] = useState<Investor | null>(null);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const isMobile = screen === "mobile";
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  useEffect(() => {
    function updateScreen() {
      const width = window.innerWidth;
      setScreen(width < 640 ? "mobile" : width < 980 ? "tablet" : "desktop");
    }

    updateScreen();
    window.addEventListener("resize", updateScreen);

    return () => window.removeEventListener("resize", updateScreen);
  }, []);

  useEffect(() => {
    if (!checkLogin()) {
      return;
    }

    loadEmployeeName();
    loadCurrentUserPermissions();
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    let cancelled = false;

    async function run() {
      await loadStatement(() => cancelled);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [authChecked, branch, investorId, page, fromDate, toDate, typeFilter]);

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

    return true;
  }

  function loadEmployeeName() {
    if (typeof window === "undefined") {
      return;
    }

    const directName = localStorage.getItem("finance_user_name");

    if (directName) {
      setEmployeeName(directName);
      return;
    }

    const savedUser =
      localStorage.getItem("finance_user") ||
      localStorage.getItem("finance_branch_user");

    if (!savedUser) {
      setEmployeeName("الموظف");
      return;
    }

    try {
      const parsed = JSON.parse(savedUser);
      setEmployeeName(parsed?.full_name || parsed?.username || "الموظف");
    } catch {
      setEmployeeName("الموظف");
    }
  }

  function loadCurrentUserPermissions() {
    if (typeof window === "undefined") {
      return;
    }

    const savedUser =
      localStorage.getItem("finance_user") ||
      localStorage.getItem("finance_branch_user");
    const legacyRole = localStorage.getItem("finance_role");

    if (!savedUser) {
      setRoles(legacyRole ? [legacyRole] : []);
      setPermissions([]);
      return;
    }

    try {
      const user = JSON.parse(savedUser);
      const currentRoles: string[] = Array.isArray(user?.roles)
        ? user.roles.filter((role: unknown): role is string => typeof role === "string")
        : typeof user?.role === "string"
          ? [user.role]
          : [];
      const currentPermissions: string[] = Array.isArray(user?.permissions)
        ? user.permissions.filter(
            (permission: unknown): permission is string =>
              typeof permission === "string"
          )
        : [];

      if (legacyRole && !currentRoles.includes(legacyRole)) {
        currentRoles.push(legacyRole);
      }

      setRoles(currentRoles);
      setPermissions(currentPermissions);
    } catch {
      setRoles(legacyRole ? [legacyRole] : []);
      setPermissions([]);
    }
  }

  function hasPermission(permissionKey: string) {
    return (
      roles.includes("main_admin") ||
      roles.includes("branch_manager") ||
      roles.includes("مدير رئيسي") ||
      roles.includes("مدير فرع") ||
      roles.includes("مدير") ||
      permissions.includes(permissionKey)
    );
  }

  async function loadStatement(isCancelled: () => boolean = () => false) {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      branch,
      page: String(page),
    });

    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (typeFilter) params.set("type", typeFilter);
    if (search.trim()) params.set("search", search.trim());

    try {
      const response = await fetch(
        `/finance/api/investors/${encodeURIComponent(investorId)}/wallets/cash/statement?${params.toString()}`,
        { credentials: "include" }
      );
      const payload = await response.json().catch(() => null);

      if (isCancelled()) {
        return;
      }

      if (!response.ok || !payload?.ok) {
        setError(payload?.message || "تعذر تحميل كشف المحفظة النقدية");
        setInvestor(null);
        setSummary(null);
        setTransactions([]);
        setTotal(0);
        return;
      }

      setInvestor(payload.investor as Investor);
      setSummary(payload.summary as CashSummary);
      setTransactions(
        Array.isArray(payload.transactions)
          ? (payload.transactions as CashTransaction[])
          : []
      );
      setTotal(Number(payload.total || 0));
    } catch {
      if (!isCancelled()) {
        setError("تعذر تحميل كشف المحفظة النقدية");
        setInvestor(null);
        setSummary(null);
        setTransactions([]);
        setTotal(0);
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  async function submitCashAction() {
    if (!actionMode || actionLoading) {
      return;
    }

    setActionError("");
    setActionMessage("");

    const numericAmount = Number(normalizeDigits(amount));

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setActionError("أدخل مبلغًا صحيحًا أكبر من صفر");
      return;
    }

    setActionLoading(true);

    try {
      const response = await fetch(
        `/finance/api/investors/${encodeURIComponent(investorId)}/wallets/cash/${actionMode}`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            branch,
            amount: numericAmount,
            note: note.trim(),
            idempotencyKey: crypto.randomUUID(),
          }),
        }
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        setActionError(payload?.message || "تعذر تنفيذ العملية");
        return;
      }

      setActionMessage(
        actionMode === "deposit"
          ? "تمت إضافة الرصيد بنجاح"
          : "تم سحب الرصيد بنجاح"
      );
      setAmount("");
      setNote("");
      setActionMode(null);
      setPage(1);
      await loadStatement();
    } catch {
      setActionError("تعذر تنفيذ العملية");
    } finally {
      setActionLoading(false);
    }
  }

  function normalizeDigits(value: string) {
    return value
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  }

  function updateAmount(value: string) {
    setAmount(normalizeDigits(value).replace(/[^\d.]/g, ""));
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_branch_user");
      localStorage.removeItem("finance_user_id");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_username");
      localStorage.removeItem("finance_role");
    }

    router.replace("/login");
  }

  if (!authChecked) {
    return null;
  }

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={container}>
        <header style={hero}>
          <div>
            <h1 style={title}>المحفظة النقدية</h1>
            <p style={subtitle}>{investor?.investor_name || "محفظة المستثمر"}</p>
          </div>

          <div style={heroActions}>
            <span style={employeeNameStyle}>{employeeName}</span>
            <button type="button" style={homeButton} onClick={() => router.push(`/finance/${branch}`)}>
              محطة العمل الرئيسية
            </button>
            <button type="button" style={logoutButton} onClick={logout}>
              تسجيل الخروج
            </button>
          </div>
        </header>

        <section style={card}>
          {loading ? (
            <div style={emptyBox}>جاري تحميل المحفظة النقدية...</div>
          ) : error ? (
            <div style={errorBox}>{error}</div>
          ) : (
            <>
              <div style={summaryGrid}>
                <SummaryBox title="الرصيد الحالي" value={formatCurrency(summary?.balance)} />
                <SummaryBox title="إجمالي الإيداعات" value={formatCurrency(summary?.totalDeposits)} />
                <SummaryBox title="إجمالي السحوبات" value={formatCurrency(summary?.totalWithdrawals)} />
                <SummaryBox title="عدد الحركات" value={formatNumber(summary?.transactionsCount)} />
              </div>

              <div style={actionsRow}>
                {hasPermission("deposit_investor_cash_wallet") && (
                  <button type="button" style={primaryButton} onClick={() => setActionMode("deposit")}>
                    إضافة رصيد
                  </button>
                )}

                {hasPermission("withdraw_investor_cash_wallet") && (
                  <button type="button" style={secondaryButton} onClick={() => setActionMode("withdraw")}>
                    سحب رصيد
                  </button>
                )}
              </div>

              {actionMessage && <div style={successBox}>{actionMessage}</div>}
              {actionError && <div style={errorBox}>{actionError}</div>}

              {actionMode && (
                <div style={formBox}>
                  <h2 style={sectionTitle}>
                    {actionMode === "deposit" ? "إضافة رصيد" : "سحب رصيد"}
                  </h2>
                  <input
                    style={input}
                    value={amount}
                    onChange={(event) => updateAmount(event.target.value)}
                    placeholder="المبلغ"
                    inputMode="decimal"
                  />
                  <textarea
                    style={textarea}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="ملاحظة اختيارية"
                  />
                  <div style={actionsRow}>
                    <button
                      type="button"
                      style={primaryButton}
                      onClick={() => void submitCashAction()}
                      disabled={actionLoading}
                    >
                      {actionLoading ? "جاري التنفيذ..." : "حفظ العملية"}
                    </button>
                    <button
                      type="button"
                      style={lightButton}
                      onClick={() => {
                        setActionMode(null);
                        setAmount("");
                        setNote("");
                        setActionError("");
                      }}
                      disabled={actionLoading}
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section style={card}>
          <div style={filterGrid}>
            <input style={input} type="date" value={fromDate} onChange={(event) => {
              setFromDate(event.target.value);
              setPage(1);
            }} />
            <input style={input} type="date" value={toDate} onChange={(event) => {
              setToDate(event.target.value);
              setPage(1);
            }} />
            <select style={input} value={typeFilter} onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}>
              <option value="">كل الحركات</option>
              <option value="cash_deposit">إضافة رصيد</option>
              <option value="cash_withdrawal">سحب رصيد</option>
            </select>
            <button type="button" style={lightButton} onClick={() => {
              setSearch(search.trim());
              setPage(1);
            }}>
              بحث
            </button>
          </div>

          <input
            style={input}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="بحث في الملاحظات أو اسم المنفذ"
          />

          <div style={tableHeader}>
            <span>النوع</span>
            <span>المبلغ</span>
            <span>قبل</span>
            <span>بعد</span>
            <span>المنفذ</span>
            <span>التاريخ</span>
          </div>

          {transactions.length === 0 ? (
            <div style={emptyBox}>لا توجد حركات نقدية</div>
          ) : (
            transactions.map((transaction) => (
              <div key={transaction.id} style={tableRow}>
                <span>{getTransactionLabel(transaction.transactionType)}</span>
                <strong>{formatCurrency(transaction.amount)}</strong>
                <span>{formatCurrency(transaction.balanceBefore)}</span>
                <span>{formatCurrency(transaction.balanceAfter)}</span>
                <span>{transaction.actorUserName || "-"}</span>
                <span>{formatDate(transaction.createdAt)}</span>
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
        </section>

        <div style={backWrapper}>
          <button type="button" style={backButton} onClick={() => router.back()}>
            الرجوع
          </button>
        </div>
      </div>
    </main>
  );
}

function getTransactionLabel(type?: string | null) {
  if (type === "cash_deposit") return "إضافة رصيد";
  if (type === "cash_withdrawal") return "سحب رصيد";
  return "-";
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

function getPageStyle(isMobile: boolean): CSSProperties {
  return {
    minHeight: "100vh",
    backgroundColor: "#f6f9ff",
    backgroundImage: `
      linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
      url('/backgrounds/v13-finance-bg-1.png')
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: isMobile ? "scroll" : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

const container: CSSProperties = {
  width: "100%",
  maxWidth: 1180,
  margin: "auto",
};

const hero: CSSProperties = {
  minHeight: 142,
  borderRadius: 24,
  padding: "22px 26px",
  marginBottom: 16,
  background:
    "linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
  color: "#ffffff",
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "center",
  flexWrap: "wrap",
};

const employeeNameStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 15,
  fontWeight: 800,
  minHeight: 44,
};

const title: CSSProperties = {
  margin: 0,
  fontSize: 30,
  fontWeight: 900,
};

const subtitle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 15,
  fontWeight: 800,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

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

const logoutButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.4)",
  borderRadius: 999,
  padding: "12px 18px",
  background: "transparent",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const card: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  overflowX: "auto",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const summaryBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  display: "grid",
  gap: 8,
  color: "#0d47a1",
  fontWeight: 900,
};

const actionsRow: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const primaryButton: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  background: "linear-gradient(135deg,#0d47a1,#0d65d9)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: "linear-gradient(135deg,#0f766e,#14b8a6)",
};

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

const formBox: CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 12,
  border: "1px solid #d9e3f5",
  borderRadius: 16,
  padding: 16,
  background: "#f8fbff",
};

const sectionTitle: CSSProperties = {
  margin: 0,
  color: "#0d47a1",
  fontSize: 20,
};

const input: CSSProperties = {
  width: "100%",
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 15,
  fontWeight: 800,
  fontFamily: "var(--font-almarai), sans-serif",
  boxSizing: "border-box",
};

const textarea: CSSProperties = {
  ...input,
  minHeight: 90,
  resize: "vertical",
};

const filterGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
  marginBottom: 12,
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr 1.3fr 1.3fr",
  minWidth: 850,
  gap: 12,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: 900,
  padding: 14,
  borderRadius: 12,
  marginTop: 16,
  marginBottom: 10,
};

const tableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr 1.3fr 1.3fr",
  minWidth: 850,
  gap: 12,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center",
  color: "#6b7280",
  fontWeight: 800,
};

const errorBox: CSSProperties = {
  ...emptyBox,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
};

const successBox: CSSProperties = {
  ...emptyBox,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  marginTop: 12,
};

const paginationBox: CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const paginationText: CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

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
