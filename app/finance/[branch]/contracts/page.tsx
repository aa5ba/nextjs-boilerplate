"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

type ScreenType = "mobile" | "tablet" | "desktop";

export default function FinanceContractsPage() {
  const params = useParams();
  const router = useRouter();
  const branch = params.branch as string;

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [investorFilter, setInvestorFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      const width = window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 980) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    updateScreen();
    window.addEventListener("resize", updateScreen);

    return () => window.removeEventListener("resize", updateScreen);
  }, []);

  useEffect(() => {
    loadEmployeeName();
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

  function loadEmployeeName() {
    if (typeof window === "undefined") return;

    const newName = localStorage.getItem("finance_user_name");

    if (newName) {
      setEmployeeName(newName);
      return;
    }

    const oldUser = localStorage.getItem("finance_user");

    if (oldUser) {
      try {
        const parsed = JSON.parse(oldUser);
        setEmployeeName(parsed?.full_name || parsed?.username || "الموظف");
      } catch {
        setEmployeeName("الموظف");
      }
    }
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_branch_user");
    }

    router.push(`/finance/${branch}/login`);
  }

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

  if (loading) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={getContainerStyle(isCompact)}>
          <section style={getHeroStyle(isMobile)}>
            <div style={heroCircleOne} />
            <div style={heroCircleTwo} />
            <div style={heroCircleThree} />
            <div style={heroDots} />

            <div style={getHeroContentStyle(screen)}>
              <div style={getHeroTitleBoxStyle(screen)}>
                <h1 style={getTitleStyle(screen)}>جاري تحميل العقود...</h1>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <header style={getHeroStyle(isMobile)}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={getHeroContentStyle(screen)}>
            <div style={getHeroUserCardStyle(screen)}>
              <div style={getEmployeeTopRowStyle(screen)}>
                <div style={employeeIcon}>
                  <UserIcon />
                </div>

                <div style={getEmployeeNameStyle(isMobile)}>
                  {employeeName}
                </div>

                {!isMobile && <div style={employeeDividerSmall} />}

                <button style={logoutInlineButton} onClick={logout}>
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                style={getMainWorkstationButtonStyle(isMobile)}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>العقود</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

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

          {filteredContracts.length === 0 ? (
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

        <div style={backWrapper}>
          <button style={backButton} onClick={() => router.back()}>
            ← رجوع
          </button>
        </div>
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

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.8 20.2c.8-3.5 3.6-5.4 7.2-5.4s6.4 1.9 7.2 5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 7V5.8c0-1 .8-1.8 1.8-1.8h6.1c1 0 1.8.8 1.8 1.8v12.4c0 1-.8 1.8-1.8 1.8h-6.1c-1 0-1.8-.8-1.8-1.8V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.8 12h9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.8 8.8 4.6 12l3.2 3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.8 11.2 12 4.5l8.2 6.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 10.4v9.1h11.6v-9.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 19.5v-5.2h4v5.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getPageStyle(isMobile: boolean): CSSProperties {
  return {
    minHeight: "100vh",
    backgroundColor: "#f6f9ff",
    backgroundImage: `
      radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
      radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%),
      radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%),
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

function getContainerStyle(isCompact: boolean): CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact ? 980 : 1180,
    margin: "auto",
  };
}

function getHeroStyle(isMobile: boolean): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile ? "auto" : 160,
    borderRadius: isMobile ? 20 : 24,
    padding: isMobile ? "18px 14px" : "22px 26px",
    marginBottom: 14,
    overflow: "hidden",
    border: "none",
    outline: "none",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    boxShadow: "none",
    isolation: "isolate",
  };
}

function getHeroContentStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "center",
      gap: 16,
      direction: "rtl",
    };
  }

  if (screen === "tablet") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "grid",
      gridTemplateColumns: "1fr",
      alignItems: "center",
      justifyItems: "center",
      gap: 18,
      direction: "rtl",
    };
  }

  return {
    position: "relative",
    zIndex: 3,
    minHeight: 116,
    display: "grid",
    gridTemplateColumns: "minmax(250px, 315px) 1fr minmax(220px, 315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      width: "100%",
      display: "grid",
      gap: 12,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  if (screen === "tablet") {
    return {
      width: "100%",
      maxWidth: 520,
      display: "grid",
      gap: 14,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  return {
    width: "100%",
    maxWidth: 315,
    display: "grid",
    gap: 24,
    direction: "ltr",
    justifySelf: "start",
  };
}

function getEmployeeTopRowStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      minHeight: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 10,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  if (screen === "tablet") {
    return {
      height: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  return {
    height: 42,
    display: "flex",
    alignItems: "center",
    gap: 14,
    direction: "ltr",
    color: "#ffffff",
  };
}

function getEmployeeNameStyle(isMobile: boolean): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow: "0 4px 10px rgba(15,23,42,0.18)",
  };
}

function getMainWorkstationButtonStyle(isMobile: boolean): CSSProperties {
  return {
    width: isMobile ? "100%" : 220,
    maxWidth: isMobile ? 280 : 220,
    height: 44,
    border: "none",
    background: "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "var(--font-almarai), sans-serif",
    boxShadow: "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(screen: ScreenType): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order: screen === "desktop" ? 0 : 1,
  };
}

function getTitleStyle(screen: ScreenType): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize: screen === "mobile" ? 26 : screen === "tablet" ? 28 : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  if (screen === "tablet") {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 12,
    direction: "rtl",
  };
}

const employeeIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1.5px solid rgba(255,255,255,0.34)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
  flex: "0 0 auto",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.90)",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
  padding: 0,
  whiteSpace: "nowrap",
  direction: "rtl",
};

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 210,
  height: 210,
  right: -78,
  top: -85,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.075)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleTwo: CSSProperties = {
  position: "absolute",
  width: 245,
  height: 245,
  right: 145,
  bottom: -178,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.045)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleThree: CSSProperties = {
  position: "absolute",
  width: 150,
  height: 150,
  left: 380,
  top: -96,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.035)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroDots: CSSProperties = {
  position: "absolute",
  top: 28,
  right: 34,
  width: 84,
  height: 58,
  opacity: 0.24,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const actionsSection: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const actionButton: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  color: "#0d47a1",
  fontFamily: "var(--font-almarai), sans-serif",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const buttonContent: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const buttonIcon: CSSProperties = {
  fontSize: 20,
};

const card: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const sectionTitle: CSSProperties = {
  marginTop: 0,
  color: "#0d47a1",
  fontSize: 22,
  fontWeight: 900,
};

const resultsHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 10,
  flexWrap: "wrap",
};

const pageInfo: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: "bold",
};

const filtersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const fieldBox: CSSProperties = {
  marginBottom: 10,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontWeight: "bold",
  fontSize: 14,
};

const input: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box",
  background: "white",
  fontFamily: "var(--font-almarai), sans-serif",
};

const clearButton: CSSProperties = {
  width: "100%",
  padding: 14,
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  marginTop: 12,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const summaryBox: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  color: "#0d47a1",
  fontWeight: "bold",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const contractCard: CSSProperties = {
  width: "100%",
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 16,
  marginBottom: 12,
  cursor: "pointer",
  textAlign: "right",
  fontFamily: "var(--font-almarai), sans-serif",
};

const contractTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 12,
  flexWrap: "wrap",
};

const contractGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
  color: "#334155",
  fontSize: 14,
};

const paginationBox: CSSProperties = {
  marginTop: 18,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const paginationButton: CSSProperties = {
  padding: "11px 18px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const paginationText: CSSProperties = {
  color: "#0f172a",
  fontWeight: "bold",
};

const activeStatus: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const lateStatus: CSSProperties = {
  background: "#ffedd5",
  color: "#9a3412",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const paidStatus: CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const cancelledStatus: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center",
  color: "#6b7280",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "11px 18px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily: "var(--font-almarai), sans-serif",
};
