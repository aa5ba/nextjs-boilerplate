"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

export default function FinanceContractsPage() {
  const params = useParams();
  const router = useRouter();
  const branch = params.branch as string;

  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [investorFilter, setInvestorFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadContracts();
  }, [branch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchText,
    statusFilter,
    investorFilter,
    productFilter,
    fromDate,
    toDate,
  ]);

  function go(path: string) {
    router.push(`/finance/${branch}/${path}`);
  }

  async function loadContracts() {
    setLoading(true);

    const currentBranchId = await getBranchId(branch);

    if (!currentBranchId) {
      setContracts([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("finance_contracts")
      .select(
        `
        *,
        finance_customers(
          full_name,
          national_id,
          phone,
          work_name,
          address
        )
      `
      )
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setContracts([]);
      setLoading(false);
      return;
    }

    setContracts(data || []);
    setLoading(false);
  }

  function normalizeDigits(value: string) {
    return value
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
      .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString());
  }

  function getCustomerName(contract: any) {
    return contract?.finance_customers?.full_name || contract?.customer_name || "-";
  }

  function getCustomerNationalId(contract: any) {
    return (
      contract?.finance_customers?.national_id ||
      contract?.customer_national_id ||
      "-"
    );
  }

  function getCustomerPhone(contract: any) {
    return contract?.finance_customers?.phone || contract?.customer_phone || "-";
  }

  function isDateInRange(contract: any) {
    const date = contract?.created_at || contract?.contract_issue_date_gregorian;

    if (!date) return true;

    const contractDate = new Date(date);
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;

    if (from && contractDate < from) return false;

    if (to) {
      const endOfDay = new Date(to);
      endOfDay.setHours(23, 59, 59, 999);
      if (contractDate > endOfDay) return false;
    }

    return true;
  }

  const investorOptions = useMemo(() => {
    return Array.from(
      new Set(contracts.map((item) => item.investor_name).filter(Boolean))
    );
  }, [contracts]);

  const productOptions = useMemo(() => {
    return Array.from(
      new Set(contracts.map((item) => item.product_name).filter(Boolean))
    );
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    const query = normalizeDigits(searchText.trim()).toLowerCase();

    return contracts.filter((contract) => {
      const searchableText = [
        contract?.contract_number,
        getCustomerName(contract),
        getCustomerNationalId(contract),
        getCustomerPhone(contract),
        contract?.investor_name,
        contract?.product_name,
        contract?.payment_amount,
        contract?.debt_amount,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);
      const matchesStatus =
        !statusFilter || contract?.contract_status === statusFilter;
      const matchesInvestor =
        !investorFilter || contract?.investor_name === investorFilter;
      const matchesProduct =
        !productFilter || contract?.product_name === productFilter;
      const matchesDate = isDateInRange(contract);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesInvestor &&
        matchesProduct &&
        matchesDate
      );
    });
  }, [
    contracts,
    searchText,
    statusFilter,
    investorFilter,
    productFilter,
    fromDate,
    toDate,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredContracts.length / ITEMS_PER_PAGE)
  );

  const paginatedContracts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredContracts.slice(startIndex, endIndex);
  }, [filteredContracts, currentPage]);

  function resetFilters() {
    setSearchText("");
    setStatusFilter("");
    setInvestorFilter("");
    setProductFilter("");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  }

  function statusStyle(status: string) {
    if (status === "تم السداد") return paidStatus;
    if (status === "متأخر") return lateStatus;
    if (status === "ملغي") return cancelledStatus;
    return activeStatus;
  }

  function formatDate(date: string) {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ar-SA");
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <div>
            <h1 style={{ margin: 0 }}>العقود</h1>
            <p style={headerText}>
              بحث وإدارة العقود والسندات حسب العميل، الهوية، الحالة، المستثمر، والمنتج.
            </p>
          </div>
        </div>

        <section style={actionsSection}>
          <ActionButton
            icon="📄"
            title="إنشاء عقد جديد"
            onClick={() => go("contracts/new")}
          />

          <ActionButton
            icon="🧾"
            title="إنشاء سند جديد"
            onClick={() => go("contracts/promissory-note/new")}
          />

          <ActionButton
            icon="🔎"
            title="البحث عن سند"
            onClick={() => go("contracts/promissory-note/search")}
          />

          <ActionButton
            icon="📂"
            title="العقود القائمة"
            onClick={() => go("contracts/active")}
          />

          <ActionButton
            icon="✅"
            title="العقود المنتهية"
            onClick={() => go("contracts/closed")}
          />

          <ActionButton icon="🔄" title="تحديث النتائج" onClick={loadContracts} />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>البحث المتقدم</h2>

          <div style={filtersGrid}>
            <Field label="بحث عام">
              <input
                style={input}
                value={searchText}
                placeholder="اسم، هوية، جوال، رقم عقد، مستثمر، منتج"
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Field>

            <Field label="حالة العقد">
              <select
                style={input}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">كل الحالات</option>
                <option value="نشط">نشط</option>
                <option value="متأخر">متأخر</option>
                <option value="تم السداد">تم السداد</option>
                <option value="ملغي">ملغي</option>
              </select>
            </Field>

            <Field label="المستثمر">
              <select
                style={input}
                value={investorFilter}
                onChange={(e) => setInvestorFilter(e.target.value)}
              >
                <option value="">كل المستثمرين</option>
                {investorOptions.map((investor) => (
                  <option key={investor} value={investor}>
                    {investor}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="المنتج">
              <select
                style={input}
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
              >
                <option value="">كل المنتجات</option>
                {productOptions.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="من تاريخ">
              <input
                style={input}
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </Field>

            <Field label="إلى تاريخ">
              <input
                style={input}
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </Field>
          </div>

          <button style={clearButton} onClick={resetFilters}>
            مسح الفلاتر
          </button>
        </section>

        <section style={summaryGrid}>
          <SummaryBox title="كل العقود" value={contracts.length} />
          <SummaryBox title="نتائج البحث" value={filteredContracts.length} />
          <SummaryBox
            title="العقود النشطة"
            value={contracts.filter((item) => item.contract_status === "نشط").length}
          />
          <SummaryBox
            title="العقود المتأخرة"
            value={
              contracts.filter((item) => item.contract_status === "متأخر").length
            }
          />
        </section>

        <section style={card}>
          <div style={resultsHeader}>
            <h2 style={sectionTitle}>نتائج العقود</h2>
            {!loading && filteredContracts.length > 0 && (
              <span style={pageInfo}>
                صفحة {currentPage} من {totalPages} - عرض{" "}
                {paginatedContracts.length} من {filteredContracts.length}
              </span>
            )}
          </div>

          {loading ? (
            <div style={emptyBox}>جاري تحميل العقود...</div>
          ) : filteredContracts.length === 0 ? (
            <div style={emptyBox}>لا توجد عقود مطابقة للبحث</div>
          ) : (
            <>
              {paginatedContracts.map((contract) => (
                <button
                  key={contract.id}
                  style={contractCard}
                  onClick={() => go(`contracts/${contract.id}`)}
                >
                  <div style={contractTop}>
                    <strong>عقد رقم {contract.contract_number || "-"}</strong>
                    <span style={statusStyle(contract.contract_status)}>
                      {contract.contract_status || "نشط"}
                    </span>
                  </div>

                  <div style={contractGrid}>
                    <span>👤 {getCustomerName(contract)}</span>
                    <span>🪪 {getCustomerNationalId(contract)}</span>
                    <span>📱 {getCustomerPhone(contract)}</span>
                    <span>🏦 {contract.investor_name || "-"}</span>
                    <span>📦 {contract.product_name || "-"}</span>
                    <span>💰 {contract.payment_amount || 0} ر.س</span>
                    <span>✅ المسدد: {contract.paid_amount || 0} ر.س</span>
                    <span>⏳ المتبقي: {contract.remaining_amount || 0} ر.س</span>
                    <span>📅 {formatDate(contract.created_at)}</span>
                  </div>
                </button>
              ))}

              <div style={paginationBox}>
                <button
                  style={{
                    ...paginationButton,
                    opacity: currentPage === 1 ? 0.5 : 1,
                  }}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                >
                  السابق
                </button>

                <span style={paginationText}>
                  صفحة {currentPage} من {totalPages}
                </span>

                <button
                  style={{
                    ...paginationButton,
                    opacity: currentPage === totalPages ? 0.5 : 1,
                  }}
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(page + 1, totalPages))
                  }
                >
                  التالي
                </button>
              </div>
            </>
          )}
        </section>

        <button style={backButton} onClick={() => router.push(`/finance/${branch}`)}>
          الرجوع لمحطة العمل الرئيسية
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: any) {
  return (
    <div style={fieldBox}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ActionButton({ icon, title, onClick }: any) {
  return (
    <button style={actionButton} onClick={onClick}>
      <span style={buttonContent}>
        <span style={buttonIcon}>{icon}</span>
        {title}
      </span>
    </button>
  );
}

function SummaryBox({ title, value }: any) {
  return (
    <div style={summaryBox}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
};

const headerText = {
  margin: "10px 0 0",
  opacity: 0.9,
  fontSize: 15,
};

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const actionButton = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  color: "#0d47a1",
};

const buttonContent = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const buttonIcon = {
  fontSize: 20,
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
};

const sectionTitle = {
  marginTop: 0,
  color: "#0d47a1",
};

const resultsHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 10,
};

const pageInfo = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: "bold",
};

const filtersGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const fieldBox = {
  marginBottom: 10,
};

const labelStyle = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontWeight: "bold",
  fontSize: 14,
};

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
  background: "white",
};

const clearButton = {
  width: "100%",
  padding: 14,
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  marginTop: 12,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const summaryBox = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  color: "#0d47a1",
  fontWeight: "bold",
};

const contractCard = {
  width: "100%",
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 16,
  marginBottom: 12,
  cursor: "pointer",
  textAlign: "right" as const,
};

const contractTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 12,
};

const contractGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
  color: "#334155",
  fontSize: 14,
};

const paginationBox = {
  marginTop: 18,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const paginationButton = {
  padding: "11px 18px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
};

const paginationText = {
  color: "#0f172a",
  fontWeight: "bold",
};

const activeStatus = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const lateStatus = {
  background: "#ffedd5",
  color: "#9a3412",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const paidStatus = {
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const cancelledStatus = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const emptyBox = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center" as const,
  color: "#6b7280",
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#16a34a",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(22,163,74,0.25)",
};
