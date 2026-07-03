"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { clearFinanceSession } from "@/lib/financeSession";

const ITEMS_PER_PAGE = 25;
const CONTRACTS_PER_PAGE = 15;
const OVERDUE_GRACE_DAYS = 7;

type ScreenType = "mobile" | "tablet" | "desktop";
type InvestorTab = "all" | "overdue" | "paid" | "active" | "closed" | "statement";

type ActivityItem = {
  id: string;
  activity_type: string | null;
  customer_name: string | null;
  status: string | null;
  employee_name: string | null;
  created_at: string;
  is_archived?: boolean | null;
  customer_is_archived?: boolean | null;
};

type Investor = {
  id: string;
  branch_id: string;
  investor_name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  is_primary?: boolean | null;
  national_id?: string | null;
  created_at: string;
};

type ContractItem = {
  id: string;
  contract_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  investor_id: string | null;
  investor_name: string | null;
  product_name: string | null;
  product_quantity: number | null;
  debt_amount: number | null;
  payment_amount: number | null;
  installment_amount: number | null;
  payment_type: string | null;
  payment_due_date: string | null;
  contract_status: string | null;
  paid_amount: number | null;
  remaining_amount: number | null;
  closed_at: string | null;
  created_at: string;
  contract_issue_date_gregorian?: string | null;
  contract_date_gregorian?: string | null;
  is_archived?: boolean | null;
};

type WorkflowApiResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  user?: {
    id: string;
    fullName: string;
    username: string;
    role: string;
    permissions: string[];
    investorId: string | null;
    themeKey: string;
  };
  branch?: {
    id: string;
    slug: string;
    name: string;
    organizationName: string;
  };
  data?: {
    activities: ActivityItem[];
    investors: Investor[];
    contracts: ContractItem[];
  };
};

type MessageState = {
  type: "error" | "success";
  text: string;
} | null;

type InvestorSummary = {
  totalContracts: number;
  totalDebt: number;
  totalPaid: number;
  totalRemaining: number;
  totalInstallments: number;
  overdueCount: number;
  paidCount: number;
  activeCount: number;
  closedCount: number;
};

export default function FinanceWorkflowPage() {
  const params = useParams();
  const router = useRouter();

  const branch = useMemo(
    () => String(params.branch || "").trim().toLowerCase(),
    [params.branch]
  );

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [contractPage, setContractPage] = useState(1);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [activeInvestorTab, setActiveInvestorTab] =
    useState<InvestorTab>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      const width = window.innerWidth;

      if (width <= 640) {
        setScreen("mobile");
      } else if (width <= 1024) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    updateScreen();
    window.addEventListener("resize", updateScreen);

    return () => {
      window.removeEventListener("resize", updateScreen);
    };
  }, []);

  const clearLocalFinanceData = useCallback(() => {
    try {
      clearFinanceSession();
    } catch (error) {
      console.error("Failed to clear finance session:", error);
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_branch_user");
      localStorage.removeItem("finance_role");
    }
  }, []);

  const redirectToLogin = useCallback(() => {
    clearLocalFinanceData();

    router.replace(
      `/login?returnTo=${encodeURIComponent(`/finance/${branch}/workflow`)}`
    );
  }, [branch, clearLocalFinanceData, router]);

  const loadPageData = useCallback(
    async (
      mode: "initial" | "refresh" = "initial",
      signal?: AbortSignal
    ) => {
      if (!branch) {
        setMessage({
          type: "error",
          text: "مسار الفرع غير صحيح.",
        });
        setLoading(false);
        return;
      }

      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage(null);

      try {
        const response = await fetch(
          `/finance/api/workflow?branch=${encodeURIComponent(branch)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal,
          }
        );

        let payload: WorkflowApiResponse;

        try {
          payload = (await response.json()) as WorkflowApiResponse;
        } catch {
          payload = {
            ok: false,
            message: "تعذر قراءة استجابة الخادم.",
          };
        }

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok || !payload.ok || !payload.data || !payload.user) {
          setMessage({
            type: "error",
            text:
              payload.message ||
              "تعذر تحميل بيانات سير العمل. حاول مرة أخرى.",
          });
          return;
        }

        const safeActivities = Array.isArray(payload.data.activities)
          ? payload.data.activities.filter(
              (activity) =>
                activity.is_archived !== true &&
                activity.customer_is_archived !== true
            )
          : [];
        const safeInvestors = Array.isArray(payload.data.investors)
          ? payload.data.investors
          : [];
        const safeContracts = Array.isArray(payload.data.contracts)
          ? payload.data.contracts.filter(
              (contract) => contract.is_archived !== true
            )
          : [];

        setEmployeeName(payload.user.fullName?.trim() || "الموظف");
        setActivities(safeActivities);
        setInvestors(safeInvestors);
        setContracts(safeContracts);
        setCurrentPage(1);
        setContractPage(1);

        setSelectedInvestorId((oldId) => {
          if (safeInvestors.some((investor) => investor.id === oldId)) {
            return oldId;
          }

          const preferredInvestor =
            safeInvestors.find((investor) => investor.is_primary) ||
            safeInvestors[0];

          return preferredInvestor?.id || "";
        });

        if (mode === "refresh") {
          setMessage({
            type: "success",
            text: "تم تحديث بيانات سير العمل.",
          });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Workflow page loading failed:", error);

        setMessage({
          type: "error",
          text: "تعذر الاتصال بالخادم. تحقق من الاتصال ثم حاول مرة أخرى.",
        });
      } finally {
        if (mode === "refresh") {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [branch, redirectToLogin]
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadPageData("initial", controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadPageData]);

  useEffect(() => {
    setContractPage(1);
  }, [selectedInvestorId, activeInvestorTab]);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setMessage(null);

    try {
      await fetch("/finance/api/branch-logout", {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      console.error("Finance logout request failed:", error);
    } finally {
      clearLocalFinanceData();
      router.replace("/login");
      setLoggingOut(false);
    }
  }

  const selectedInvestor = useMemo(
    () =>
      investors.find((investor) => investor.id === selectedInvestorId) || null,
    [investors, selectedInvestorId]
  );

  const investorContracts = useMemo(() => {
    if (!selectedInvestor) return [];

    return contracts.filter((contract) => {
      if (contract.investor_id) {
        return contract.investor_id === selectedInvestor.id;
      }

      return (
        normalizeText(contract.investor_name) ===
        normalizeText(selectedInvestor.investor_name)
      );
    });
  }, [contracts, selectedInvestor]);

  const overdueContracts = useMemo(
    () =>
      investorContracts.filter(
        (contract) => getContractStatus(contract) === "overdue"
      ),
    [investorContracts]
  );

  const paidContracts = useMemo(
    () =>
      investorContracts.filter(
        (contract) => getContractStatus(contract) === "paid"
      ),
    [investorContracts]
  );

  const activeContracts = useMemo(
    () =>
      investorContracts.filter(
        (contract) => getContractStatus(contract) === "active"
      ),
    [investorContracts]
  );

  const closedContracts = useMemo(
    () =>
      investorContracts.filter(
        (contract) => getContractStatus(contract) === "closed"
      ),
    [investorContracts]
  );

  const filteredInvestorContracts = useMemo(() => {
    switch (activeInvestorTab) {
      case "overdue":
        return overdueContracts;
      case "paid":
        return paidContracts;
      case "active":
        return activeContracts;
      case "closed":
        return closedContracts;
      default:
        return investorContracts;
    }
  }, [
    activeInvestorTab,
    investorContracts,
    overdueContracts,
    paidContracts,
    activeContracts,
    closedContracts,
  ]);

  const investorSummary = useMemo<InvestorSummary>(() => {
    return {
      totalContracts: investorContracts.length,
      totalDebt: sumValues(investorContracts, "debt_amount"),
      totalPaid: sumValues(investorContracts, "paid_amount"),
      totalRemaining: sumValues(investorContracts, "remaining_amount"),
      totalInstallments: sumValues(investorContracts, "installment_amount"),
      overdueCount: overdueContracts.length,
      paidCount: paidContracts.length,
      activeCount: activeContracts.length,
      closedCount: closedContracts.length,
    };
  }, [
    investorContracts,
    overdueContracts,
    paidContracts,
    activeContracts,
    closedContracts,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(activities.length / ITEMS_PER_PAGE)
  );

  const paginatedActivities = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return activities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [activities, currentPage]);

  const totalContractPages = Math.max(
    1,
    Math.ceil(filteredInvestorContracts.length / CONTRACTS_PER_PAGE)
  );

  const paginatedContracts = useMemo(() => {
    const startIndex = (contractPage - 1) * CONTRACTS_PER_PAGE;

    return filteredInvestorContracts.slice(
      startIndex,
      startIndex + CONTRACTS_PER_PAGE
    );
  }, [filteredInvestorContracts, contractPage]);

  function openContract(contractId: string) {
    router.push(`/finance/${branch}/contracts/${contractId}`);
  }

  function printInvestorStatement() {
    window.print();
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

            <div style={loadingHeroContent}>
              <div style={loadingSpinner} aria-hidden="true" />
              <h1 style={getTitleStyle(screen)}>جاري تحميل سير العمل...</h1>
            </div>
          </section>
        </div>

        <GlobalResponsiveStyles />
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

                <div style={getEmployeeNameStyle(isMobile)}>{employeeName}</div>

                {!isMobile && <div style={employeeDividerSmall} />}

                <button
                  type="button"
                  className="no-print interactive-button"
                  style={{
                    ...logoutInlineButton,
                    opacity: loggingOut ? 0.65 : 1,
                  }}
                  onClick={() => void logout()}
                  disabled={loggingOut}
                  aria-label="تسجيل الخروج"
                >
                  <LogoutIcon />
                  <span>{loggingOut ? "جاري الخروج..." : "تسجيل الخروج"}</span>
                </button>
              </div>

              <button
                type="button"
                className="no-print interactive-button"
                style={getMainWorkstationButtonStyle(isMobile)}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>سير العمل</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)}>
              <button
                type="button"
                className="no-print interactive-button"
                style={{
                  ...getRefreshButtonStyle(isMobile),
                  opacity: refreshing ? 0.65 : 1,
                }}
                onClick={() => void loadPageData("refresh")}
                disabled={refreshing}
              >
                <RefreshIcon spinning={refreshing} />
                <span>{refreshing ? "جاري التحديث..." : "تحديث البيانات"}</span>
              </button>
            </div>
          </div>
        </header>

        {message && (
          <div
            role={message.type === "error" ? "alert" : "status"}
            style={{
              ...messageBox,
              ...(message.type === "error"
                ? errorMessageBox
                : successMessageBox),
            }}
          >
            <span>{message.text}</span>

            {message.type === "error" && (
              <button
                type="button"
                style={messageRetryButton}
                onClick={() => void loadPageData("refresh")}
                disabled={refreshing}
              >
                إعادة المحاولة
              </button>
            )}
          </div>
        )}

        <section className="workflow-stats-grid" style={statsGrid}>
          <StatCard
            title="آخر العمليات"
            value={activities.length}
            hint="عملية مسجلة"
            icon={<ActivityIcon />}
          />
          <StatCard
            title="المستثمرون"
            value={investors.length}
            hint="مستثمر داخل الفرع"
            icon={<InvestorsIcon />}
          />
          <StatCard
            title="عقود المستثمر المحدد"
            value={investorSummary.totalContracts}
            hint="عقد"
            icon={<ContractsIcon />}
          />
          <StatCard
            title="المتأخرون"
            value={investorSummary.overdueCount}
            hint="عقد متأخر"
            icon={<AlertIcon />}
          />
        </section>

        <section style={investorBoard}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>لوحة متابعة المستثمرين</h2>

            <div className="investor-select-box" style={selectBox}>
              <label style={label} htmlFor="workflow-investor">
                اختيار المستثمر
              </label>

              <div style={selectWrapper}>
                <select
                  id="workflow-investor"
                  style={select}
                  value={selectedInvestorId}
                  onChange={(event) => setSelectedInvestorId(event.target.value)}
                  disabled={investors.length === 0}
                >
                  {investors.length === 0 ? (
                    <option value="">لا يوجد مستثمرون</option>
                  ) : (
                    investors.map((investor) => (
                      <option key={investor.id} value={investor.id}>
                        {investor.is_primary ? "المستثمر الرئيسي - " : ""}
                        {investor.investor_name}
                      </option>
                    ))
                  )}
                </select>

                <span style={selectArrow} aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </div>
            </div>
          </div>

          {selectedInvestor ? (
            <>
              <div className="investor-summary-grid" style={investorSummaryGrid}>
                <SummaryCard
                  title="إجمالي العقود"
                  value={investorSummary.totalContracts}
                  hint="كل العقود"
                />
                <SummaryCard
                  title="إجمالي المديونية"
                  value={formatMoney(investorSummary.totalDebt)}
                  hint="ريال"
                />
                <SummaryCard
                  title="المدفوع"
                  value={formatMoney(investorSummary.totalPaid)}
                  hint="ريال"
                />
                <SummaryCard
                  title="المتبقي"
                  value={formatMoney(investorSummary.totalRemaining)}
                  hint="ريال"
                />
              </div>

              <div
                className="workflow-tabs no-print"
                style={tabsBox}
                role="tablist"
                aria-label="تصنيفات عقود المستثمر"
              >
                {INVESTOR_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={activeInvestorTab === tab.key}
                    className="interactive-button"
                    style={
                      activeInvestorTab === tab.key
                        ? activeTabButton
                        : tabButton
                    }
                    onClick={() => setActiveInvestorTab(tab.key)}
                  >
                    <span style={tabIcon}>{tab.icon}</span>
                    <span>{tab.label}</span>

                    {tab.key !== "statement" && (
                      <small style={tabCounter}>
                        {getTabCount(tab.key, {
                          all: investorContracts.length,
                          overdue: overdueContracts.length,
                          paid: paidContracts.length,
                          active: activeContracts.length,
                          closed: closedContracts.length,
                        })}
                      </small>
                    )}
                  </button>
                ))}
              </div>

              {activeInvestorTab === "statement" ? (
                <InvestorStatement
                  investor={selectedInvestor}
                  summary={investorSummary}
                  contracts={investorContracts}
                  overdueContracts={overdueContracts}
                  paidContracts={paidContracts}
                  activeContracts={activeContracts}
                  closedContracts={closedContracts}
                  onPrint={printInvestorStatement}
                />
              ) : (
                <ContractsList
                  contracts={paginatedContracts}
                  totalContracts={filteredInvestorContracts.length}
                  currentPage={contractPage}
                  totalPages={totalContractPages}
                  activeTab={activeInvestorTab}
                  onOpenContract={openContract}
                  onPrev={() =>
                    setContractPage((page) => Math.max(page - 1, 1))
                  }
                  onNext={() =>
                    setContractPage((page) =>
                      Math.min(page + 1, totalContractPages)
                    )
                  }
                />
              )}
            </>
          ) : (
            <div style={emptyBox}>لا يوجد مستثمرون في هذا الفرع حتى الآن.</div>
          )}
        </section>

        <section className="bottom-grid" style={bottomGrid}>
          <section style={card}>
            <div style={listHeader}>
              <h2 style={sectionTitle}>تنبيهات المستثمرين</h2>
              <span style={dangerPill}>{overdueContracts.length} متأخر</span>
            </div>

            {overdueContracts.length === 0 ? (
              <div style={successAlert}>
                لا توجد عقود متأخرة على المستثمر المحدد حاليًا.
              </div>
            ) : (
              <div style={alertsList}>
                {overdueContracts.slice(0, 6).map((contract) => (
                  <button
                    key={contract.id}
                    type="button"
                    className="interactive-button"
                    style={alertItem}
                    onClick={() => openContract(contract.id)}
                  >
                    <span style={alertIcon}>
                      <AlertIcon />
                    </span>

                    <span style={alertText}>
                      <strong>{contract.contract_number || "عقد بدون رقم"}</strong>
                      <small>
                        {contract.customer_name || "-"} — متبقي{" "}
                        {formatMoney(contract.remaining_amount)} ريال — تأخير{" "}
                        {getOverdueDays(contract.payment_due_date)} يوم
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section style={card}>
            <div style={listHeader}>
              <h2 style={sectionTitle}>آخر العمليات</h2>

              {activities.length > 0 && (
                <span style={pageInfo}>
                  صفحة {currentPage} من {totalPages}
                </span>
              )}
            </div>

            <div style={activityTableBox}>
              <div className="desktop-table" style={activityTableHeader}>
                <span>العملية</span>
                <span>العميل</span>
                <span>الحالة</span>
                <span>الموظف</span>
                <span>التاريخ والوقت</span>
              </div>

              {activities.length === 0 ? (
                <div style={emptyBox}>لا توجد عمليات مسجلة حتى الآن.</div>
              ) : (
                <>
                  <div className="desktop-table">
                    {paginatedActivities.map((activity) => (
                      <div key={activity.id} style={activityTableRow}>
                        <span style={activityTypeCell}>
                          <ActivityTypeIcon type={activity.activity_type} />
                          {activity.activity_type || "-"}
                        </span>
                        <span>{activity.customer_name || "-"}</span>
                        <span>{activity.status || "-"}</span>
                        <span>{activity.employee_name || "-"}</span>
                        <span>{formatDateTime(activity.created_at)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mobile-cards">
                    {paginatedActivities.map((activity) => (
                      <article key={activity.id} style={mobileActivityCard}>
                        <strong style={activityTypeCell}>
                          <ActivityTypeIcon type={activity.activity_type} />
                          {activity.activity_type || "-"}
                        </strong>
                        <span>العميل: {activity.customer_name || "-"}</span>
                        <span>الحالة: {activity.status || "-"}</span>
                        <span>الموظف: {activity.employee_name || "-"}</span>
                        <small>{formatDateTime(activity.created_at)}</small>
                      </article>
                    ))}
                  </div>
                </>
              )}

              {activities.length > ITEMS_PER_PAGE && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPrev={() =>
                    setCurrentPage((page) => Math.max(page - 1, 1))
                  }
                  onNext={() =>
                    setCurrentPage((page) => Math.min(page + 1, totalPages))
                  }
                />
              )}
            </div>
          </section>
        </section>

        <div className="no-print" style={backWrapper}>
          <button
            type="button"
            className="interactive-button"
            style={backButton}
            onClick={() => router.back()}
          >
            <BackIcon />
            <span>رجوع</span>
          </button>
        </div>
      </div>

      <GlobalResponsiveStyles />
    </main>
  );
}

const INVESTOR_TABS: {
  key: InvestorTab;
  label: string;
  icon: ReactNode;
}[] = [
  { key: "all", label: "جميع العقود", icon: <ContractsIcon /> },
  { key: "overdue", label: "المتأخرون", icon: <AlertIcon /> },
  { key: "paid", label: "المسددون", icon: <CheckIcon /> },
  { key: "active", label: "النشطون", icon: <ActiveIcon /> },
  { key: "closed", label: "المغلقون", icon: <LockIcon /> },
  { key: "statement", label: "الكشف الشامل", icon: <ReportIcon /> },
];

function ContractsList({
  contracts,
  totalContracts,
  currentPage,
  totalPages,
  activeTab,
  onOpenContract,
  onPrev,
  onNext,
}: {
  contracts: ContractItem[];
  totalContracts: number;
  currentPage: number;
  totalPages: number;
  activeTab: InvestorTab;
  onOpenContract: (contractId: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <section style={contractsBox}>
      <div style={listHeader}>
        <h3 style={miniTitle}>{getTabTitle(activeTab)}</h3>
        <span style={pageInfo}>عدد النتائج: {totalContracts}</span>
      </div>

      {contracts.length === 0 ? (
        <div style={emptyBox}>لا توجد عقود في هذا التصنيف.</div>
      ) : (
        <>
          <div className="desktop-table" style={contractsTableBox}>
            <div style={contractsTableHeader}>
              <span>رقم العقد</span>
              <span>العميل</span>
              <span>الجوال</span>
              <span>المنتج</span>
              <span>المتبقي</span>
              <span>الاستحقاق</span>
              <span>الحالة</span>
              <span>إجراء</span>
            </div>

            {contracts.map((contract) => (
              <div key={contract.id} style={contractsTableRow}>
                <span>{contract.contract_number || "-"}</span>
                <span>{contract.customer_name || "-"}</span>
                <span dir="ltr">{contract.customer_phone || "-"}</span>
                <span>{contract.product_name || "-"}</span>
                <span>{formatMoney(contract.remaining_amount)}</span>
                <span>{formatDateOnly(contract.payment_due_date)}</span>
                <span>
                  <StatusBadge status={getContractStatus(contract)} />
                </span>
                <span>
                  <button
                    type="button"
                    className="interactive-button"
                    style={smallActionButton}
                    onClick={() => onOpenContract(contract.id)}
                  >
                    فتح
                  </button>
                </span>
              </div>
            ))}
          </div>

          <div className="mobile-cards">
            {contracts.map((contract) => (
              <article key={contract.id} style={mobileContractCard}>
                <div style={mobileCardTop}>
                  <strong>{contract.contract_number || "عقد بدون رقم"}</strong>
                  <StatusBadge status={getContractStatus(contract)} />
                </div>

                <span>العميل: {contract.customer_name || "-"}</span>
                <span dir="ltr">الجوال: {contract.customer_phone || "-"}</span>
                <span>المنتج: {contract.product_name || "-"}</span>
                <span>المتبقي: {formatMoney(contract.remaining_amount)} ريال</span>
                <span>الاستحقاق: {formatDateOnly(contract.payment_due_date)}</span>

                <button
                  type="button"
                  className="interactive-button"
                  style={mobileOpenButton}
                  onClick={() => onOpenContract(contract.id)}
                >
                  فتح العقد
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {totalContracts > CONTRACTS_PER_PAGE && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPrev={onPrev}
          onNext={onNext}
        />
      )}
    </section>
  );
}

function InvestorStatement({
  investor,
  contracts,
  onPrint,
}: {
  investor: Investor;
  summary: InvestorSummary;
  contracts: ContractItem[];
  overdueContracts: ContractItem[];
  paidContracts: ContractItem[];
  activeContracts: ContractItem[];
  closedContracts: ContractItem[];
  onPrint: () => void;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const hasInvalidDateRange = Boolean(
    dateFrom && dateTo && dateFrom > dateTo
  );

  const filteredContracts = useMemo(() => {
    if (hasInvalidDateRange) return [];

    return contracts.filter((contract) =>
      isContractWithinDateRange(contract, dateFrom, dateTo)
    );
  }, [contracts, dateFrom, dateTo, hasInvalidDateRange]);

  const filteredOverdueContracts = useMemo(
    () =>
      filteredContracts.filter(
        (contract) => getContractStatus(contract) === "overdue"
      ),
    [filteredContracts]
  );

  const filteredPaidContracts = useMemo(
    () =>
      filteredContracts.filter(
        (contract) => getContractStatus(contract) === "paid"
      ),
    [filteredContracts]
  );

  const filteredActiveContracts = useMemo(
    () =>
      filteredContracts.filter(
        (contract) => getContractStatus(contract) === "active"
      ),
    [filteredContracts]
  );

  const filteredClosedContracts = useMemo(
    () =>
      filteredContracts.filter(
        (contract) => getContractStatus(contract) === "closed"
      ),
    [filteredContracts]
  );

  const filteredSummary = useMemo<InvestorSummary>(
    () => ({
      totalContracts: filteredContracts.length,
      totalDebt: sumValues(filteredContracts, "debt_amount"),
      totalPaid: sumValues(filteredContracts, "paid_amount"),
      totalRemaining: sumValues(filteredContracts, "remaining_amount"),
      totalInstallments: sumValues(filteredContracts, "installment_amount"),
      overdueCount: filteredOverdueContracts.length,
      paidCount: filteredPaidContracts.length,
      activeCount: filteredActiveContracts.length,
      closedCount: filteredClosedContracts.length,
    }),
    [
      filteredContracts,
      filteredOverdueContracts,
      filteredPaidContracts,
      filteredActiveContracts,
      filteredClosedContracts,
    ]
  );

  const periodLabel =
    dateFrom || dateTo
      ? `الفترة: من ${dateFrom ? formatDateOnly(dateFrom) : "البداية"} إلى ${
          dateTo ? formatDateOnly(dateTo) : "اليوم"
        }`
      : "الفترة: جميع التواريخ";

  function resetDateRange() {
    setDateFrom("");
    setDateTo("");
  }

  function handlePrint() {
    if (hasInvalidDateRange) return;
    onPrint();
  }

  return (
    <section className="print-area" style={statementBox}>
      <div className="no-print statement-controls" style={statementControls}>
        <div style={statementDateFilters}>
          <div style={dateFieldBox}>
            <label htmlFor="statement-date-from" style={dateFieldLabel}>
              من تاريخ
            </label>
            <input
              id="statement-date-from"
              type="date"
              inputMode="numeric"
              dir="ltr"
              lang="en"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
              style={dateInput}
            />
          </div>

          <div style={dateFieldBox}>
            <label htmlFor="statement-date-to" style={dateFieldLabel}>
              إلى تاريخ
            </label>
            <input
              id="statement-date-to"
              type="date"
              inputMode="numeric"
              dir="ltr"
              lang="en"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => setDateTo(event.target.value)}
              style={dateInput}
            />
          </div>

          <button
            type="button"
            className="interactive-button"
            style={resetDateButton}
            onClick={resetDateRange}
            disabled={!dateFrom && !dateTo}
          >
            مسح التواريخ
          </button>
        </div>

        {hasInvalidDateRange && (
          <div role="alert" style={dateRangeError}>
            يجب أن يكون تاريخ البداية أقدم من تاريخ النهاية أو مساويًا له.
          </div>
        )}

        <div style={statementActions}>
          <button
            type="button"
            className="interactive-button"
            style={{
              ...printButton,
              opacity: hasInvalidDateRange ? 0.55 : 1,
            }}
            onClick={handlePrint}
            disabled={hasInvalidDateRange}
          >
            <PrintIcon />
            <span>طباعة الكشف الشامل</span>
          </button>
        </div>
      </div>

      <div className="print-document">
        <header className="print-header" style={statementHeader}>
          <div>
            <h2 style={statementTitle}>الكشف الشامل للمستثمر</h2>
            <div className="print-period" style={statementPeriod}>
              {periodLabel}
            </div>
          </div>

          <div style={statementDate}>
            تاريخ التقرير: {formatDateOnly(new Date().toISOString())}
          </div>
        </header>

        <section className="print-keep-together" style={statementInvestorBox}>
          <p>
            <strong>اسم المستثمر:</strong> {investor.investor_name}
          </p>
          <p>
            <strong>الجوال:</strong> {investor.phone || "-"}
          </p>
          <p>
            <strong>النوع:</strong>{" "}
            {investor.is_primary ? "المستثمر الرئيسي" : "مستثمر"}
          </p>
        </section>

        <section
          className="statement-grid print-keep-together"
          style={statementGrid}
        >
          <StatementItem
            title="إجمالي العقود"
            value={filteredSummary.totalContracts}
          />
          <StatementItem
            title="النشطة"
            value={filteredActiveContracts.length}
          />
          <StatementItem
            title="المتأخرة"
            value={filteredOverdueContracts.length}
          />
          <StatementItem
            title="المسددة"
            value={filteredPaidContracts.length}
          />
          <StatementItem
            title="المغلقة"
            value={filteredClosedContracts.length}
          />
          <StatementItem
            title="إجمالي المديونية"
            value={formatMoney(filteredSummary.totalDebt)}
          />
          <StatementItem
            title="إجمالي المدفوع"
            value={formatMoney(filteredSummary.totalPaid)}
          />
          <StatementItem
            title="إجمالي المتبقي"
            value={formatMoney(filteredSummary.totalRemaining)}
          />
        </section>

        <section className="print-section" style={statementSection}>
          <h3 className="print-section-title" style={statementMiniTitle}>
            العقود المتأخرة
          </h3>

          {filteredOverdueContracts.length === 0 ? (
            <div className="print-empty" style={emptyBox}>
              لا توجد عقود متأخرة ضمن الفترة المحددة.
            </div>
          ) : (
            <div className="print-table-wrapper" style={statementTable}>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>رقم العقد</th>
                    <th>العميل</th>
                    <th>الجوال</th>
                    <th>المتبقي</th>
                    <th>الاستحقاق</th>
                    <th>أيام التأخير</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOverdueContracts.map((contract) => (
                    <tr key={contract.id}>
                      <td>{contract.contract_number || "-"}</td>
                      <td>{contract.customer_name || "-"}</td>
                      <td dir="ltr">{contract.customer_phone || "-"}</td>
                      <td>{formatMoney(contract.remaining_amount)}</td>
                      <td>{formatDateOnly(contract.payment_due_date)}</td>
                      <td>{getOverdueDays(contract.payment_due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="print-section" style={statementSection}>
          <h3 className="print-section-title" style={statementMiniTitle}>
            جميع عقود المستثمر
          </h3>

          {filteredContracts.length === 0 ? (
            <div className="print-empty" style={emptyBox}>
              لا توجد عقود ضمن الفترة المحددة.
            </div>
          ) : (
            <div className="print-table-wrapper" style={statementTable}>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>رقم العقد</th>
                    <th>العميل</th>
                    <th>تاريخ العقد</th>
                    <th>المديونية</th>
                    <th>المدفوع</th>
                    <th>المتبقي</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((contract) => (
                    <tr key={contract.id}>
                      <td>{contract.contract_number || "-"}</td>
                      <td>{contract.customer_name || "-"}</td>
                      <td>{formatDateOnly(getContractReferenceDate(contract))}</td>
                      <td>{formatMoney(contract.debt_amount)}</td>
                      <td>{formatMoney(contract.paid_amount)}</td>
                      <td>{formatMoney(contract.remaining_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="print-footer">
          <span>{investor.investor_name}</span>
          <span>{periodLabel}</span>
        </footer>
      </div>
    </section>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPrev,
  onNext,
}: {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div style={paginationBox}>
      <button
        type="button"
        className="interactive-button"
        style={{
          ...paginationButton,
          opacity: currentPage === 1 ? 0.5 : 1,
        }}
        disabled={currentPage === 1}
        onClick={onPrev}
      >
        السابق
      </button>

      <span style={paginationText}>
        صفحة {currentPage} من {totalPages}
      </span>

      <button
        type="button"
        className="interactive-button"
        style={{
          ...paginationButton,
          opacity: currentPage === totalPages ? 0.5 : 1,
        }}
        disabled={currentPage === totalPages}
        onClick={onNext}
      >
        التالي
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "overdue") {
    return <span style={dangerBadge}>متأخر</span>;
  }

  if (status === "paid") {
    return <span style={successBadge}>مسدد</span>;
  }

  if (status === "closed") {
    return <span style={grayBadge}>مغلق</span>;
  }

  return <span style={blueBadge}>نشط</span>;
}

function StatCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: number | string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <article style={statCard}>
      <div style={statIcon}>{icon}</div>
      <div>
        <strong style={statValue}>{value}</strong>
        <span style={statTitle}>{title}</span>
        <small style={statHint}>{hint}</small>
      </div>
    </article>
  );
}

function SummaryCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number | string;
  hint: string;
}) {
  return (
    <article style={summaryCard}>
      <strong style={summaryValue}>{value}</strong>
      <span style={summaryTitle}>{title}</span>
      <small style={summaryHint}>{hint}</small>
    </article>
  );
}

function StatementItem({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) {
  return (
    <div style={statementItem}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActivityTypeIcon({ type }: { type: string | null }) {
  switch (type) {
    case "إنشاء عقد":
      return <ContractsIcon />;
    case "سداد":
      return <PaymentIcon />;
    case "إلغاء دفعة":
      return <CancelIcon />;
    case "إنشاء عميل":
      return <UserIcon />;
    case "إنشاء سند":
      return <ReportIcon />;
    case "تعديل عقد":
      return <EditIcon />;
    case "إغلاق عقد":
      return <LockIcon />;
    default:
      return <ActivityIcon />;
  }
}

function BaseIcon({
  children,
  size = 20,
  className,
}: {
  children: ReactNode;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function UserIcon() {
  return (
    <BaseIcon size={22}>
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
    </BaseIcon>
  );
}

function LogoutIcon() {
  return (
    <BaseIcon size={22}>
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
    </BaseIcon>
  );
}

function HomeIcon() {
  return (
    <BaseIcon size={20}>
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
    </BaseIcon>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <BaseIcon size={19} className={spinning ? "spin-icon" : undefined}>
      <path
        d="M20 7v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.7 9A8 8 0 0 1 18 6.1L20 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 17v-5h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.3 15A8 8 0 0 1 6 17.9L4 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

function ChevronDownIcon() {
  return (
    <BaseIcon size={18}>
      <path
        d="m7 9.5 5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

function ActivityIcon() {
  return (
    <BaseIcon>
      <path
        d="M5 5.5h14M5 12h14M5 18.5h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="3.5" cy="5.5" r="1" fill="currentColor" />
      <circle cx="3.5" cy="12" r="1" fill="currentColor" />
      <circle cx="3.5" cy="18.5" r="1" fill="currentColor" />
    </BaseIcon>
  );
}

function InvestorsIcon() {
  return (
    <BaseIcon>
      <path
        d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3.5 19c.7-3 2.6-4.7 5.5-4.7s4.8 1.7 5.5 4.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16.2 5.2a3 3 0 0 1 0 5.6M15.8 14.5c2.4.3 4 1.8 4.7 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

function ContractsIcon() {
  return (
    <BaseIcon>
      <path
        d="M7 3.8h7l3 3V20H7V3.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14 3.8V7h3M9.5 11h5M9.5 14h5M9.5 17h3.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

function AlertIcon() {
  return (
    <BaseIcon>
      <path
        d="m12 4 8 15H4L12 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v4.5M12 16.6v.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

function CheckIcon() {
  return (
    <BaseIcon>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m8.3 12.3 2.4 2.4 5-5.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

function ActiveIcon() {
  return (
    <BaseIcon>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </BaseIcon>
  );
}

function LockIcon() {
  return (
    <BaseIcon>
      <rect
        x="5.5"
        y="10"
        width="13"
        height="9.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </BaseIcon>
  );
}

function ReportIcon() {
  return (
    <BaseIcon>
      <path
        d="M6 3.8h12V20H6V3.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 8h6M9 12h6M9 16h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

function PrintIcon() {
  return (
    <BaseIcon>
      <path
        d="M7 9V4h10v5M7 17H5.5A2.5 2.5 0 0 1 3 14.5v-3A2.5 2.5 0 0 1 5.5 9h13a2.5 2.5 0 0 1 2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5H17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 14h10v6H7v-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </BaseIcon>
  );
}

function PaymentIcon() {
  return (
    <BaseIcon>
      <rect
        x="3.5"
        y="6"
        width="17"
        height="12"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3.5 10h17M7 15h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

function CancelIcon() {
  return (
    <BaseIcon>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m9 9 6 6M15 9l-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </BaseIcon>
  );
}

function EditIcon() {
  return (
    <BaseIcon>
      <path
        d="m4.5 16.8-.6 3.3 3.3-.6L18 8.7l-2.7-2.7L4.5 16.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m13.8 7.5 2.7 2.7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </BaseIcon>
  );
}

function BackIcon() {
  return (
    <BaseIcon size={18}>
      <path
        d="M19 12H5M10 7l-5 5 5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </BaseIcon>
  );
}

function getContractStatus(contract: ContractItem) {
  const remaining = toNumber(contract.remaining_amount);
  const status = normalizeText(contract.contract_status);

  if (
    status === "closed" ||
    status === "مغلق" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "ملغي" ||
    status === "ملغى" ||
    Boolean(contract.closed_at)
  ) {
    return "closed";
  }

  if (
    status === "paid" ||
    status === "تم السداد" ||
    status === "مسدد" ||
    remaining <= 0
  ) {
    return "paid";
  }

  if (remaining > 0 && getOverdueDays(contract.payment_due_date) >= OVERDUE_GRACE_DAYS) {
    return "overdue";
  }

  return "active";
}

function getOverdueDays(date: string | null) {
  if (!date) return 0;

  const dueDate = parseDateOnly(date);

  if (!dueDate) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = today.getTime() - dueDate.getTime();

  if (diff <= 0) return 0;

  return Math.floor(diff / 86_400_000);
}

function parseDateOnly(value: string) {
  const normalized = value.slice(0, 10);
  const parts = normalized.split("-").map(Number);

  if (
    parts.length !== 3 ||
    parts.some((part) => !Number.isFinite(part))
  ) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getContractReferenceDate(contract: ContractItem) {
  return (
    contract.contract_issue_date_gregorian ||
    contract.contract_date_gregorian ||
    contract.created_at ||
    null
  );
}

function isContractWithinDateRange(
  contract: ContractItem,
  dateFrom: string,
  dateTo: string
) {
  if (!dateFrom && !dateTo) return true;

  const referenceDateValue = getContractReferenceDate(contract);
  if (!referenceDateValue) return false;

  const referenceDate = parseDateOnly(referenceDateValue);
  if (!referenceDate) return false;

  const fromDate = dateFrom ? parseDateOnly(dateFrom) : null;
  const toDate = dateTo ? parseDateOnly(dateTo) : null;

  if (fromDate && referenceDate.getTime() < fromDate.getTime()) {
    return false;
  }

  if (toDate && referenceDate.getTime() > toDate.getTime()) {
    return false;
  }

  return true;
}

function getTabTitle(tab: InvestorTab) {
  if (tab === "overdue") return "العقود المتأخرة";
  if (tab === "paid") return "العقود المسددة";
  if (tab === "active") return "العقود النشطة";
  if (tab === "closed") return "العقود المغلقة";
  return "جميع العقود";
}

function getTabCount(
  tab: InvestorTab,
  counts: {
    all: number;
    overdue: number;
    paid: number;
    active: number;
    closed: number;
  }
) {
  if (tab === "overdue") return counts.overdue;
  if (tab === "paid") return counts.paid;
  if (tab === "active") return counts.active;
  if (tab === "closed") return counts.closed;
  return counts.all;
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function sumValues(items: ContractItem[], key: keyof ContractItem) {
  return items.reduce((total, item) => total + toNumber(item[key]), 0);
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function formatMoney(value: unknown) {
  return toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateOnly(date: string | null) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(date: string) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPageStyle(isMobile: boolean): CSSProperties {
  return {
    minHeight: "100dvh",
    backgroundColor: "#f6f9ff",
    backgroundImage: `
      radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
      radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%),
      radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%),
      linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
      url('/backgrounds/v13-finance-bg-1.png')
    `,
    backgroundSize: "auto, auto, auto, auto, cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: isMobile ? "scroll" : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily: "var(--font-almarai), sans-serif",
    color: "#0f172a",
  };
}

function getContainerStyle(isCompact: boolean): CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact ? 980 : 1250,
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
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    isolation: "isolate",
  };
}

function getHeroContentStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      position: "relative",
      zIndex: 3,
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
    gridTemplateColumns: "minmax(250px,315px) 1fr minmax(220px,315px)",
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
  return {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: screen === "desktop" ? "flex-start" : "center",
    flexWrap: screen === "mobile" ? "wrap" : "nowrap",
    gap: screen === "mobile" ? 10 : 14,
    direction: "rtl",
    color: "#ffffff",
    width: "100%",
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
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  return {
    display: "flex",
    justifyContent: "center",
    alignItems: screen === "desktop" ? "flex-end" : "center",
    direction: "rtl",
    width: "100%",
    order: screen === "desktop" ? 0 : 3,
  };
}

function getRefreshButtonStyle(isMobile: boolean): CSSProperties {
  return {
    width: isMobile ? "100%" : "auto",
    maxWidth: isMobile ? 280 : "none",
    minHeight: 44,
    background: "rgba(255,255,255,.12)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,.22)",
    borderRadius: 14,
    padding: "11px 16px",
    fontSize: isMobile ? 14 : 15,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "var(--font-almarai), sans-serif",
    boxShadow: "0 8px 18px rgba(15,23,42,0.10)",
    backdropFilter: "blur(4px)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
}

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        overflow-x: hidden;
      }

      button,
      select {
        font-family: var(--font-almarai), sans-serif;
      }

      button:focus-visible,
      select:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.22);
        outline-offset: 2px;
      }

      .interactive-button {
        transition:
          transform 160ms ease,
          box-shadow 160ms ease,
          opacity 160ms ease,
          background 160ms ease;
      }

      .interactive-button:not(:disabled):hover {
        transform: translateY(-1px);
      }

      .interactive-button:not(:disabled):active {
        transform: translateY(0);
      }

      .mobile-cards {
        display: none;
      }

      .spin-icon {
        animation: workflow-spin 0.8s linear infinite;
      }

      @keyframes workflow-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 1024px) {
        .workflow-stats-grid,
        .investor-summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .bottom-grid {
          grid-template-columns: 1fr !important;
        }

        .investor-select-box {
          width: 100% !important;
          min-width: 100% !important;
        }

        .workflow-tabs {
          overflow-x: auto;
          flex-wrap: nowrap !important;
          padding-bottom: 5px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .workflow-tabs::-webkit-scrollbar {
          display: none;
        }

        .workflow-tabs button {
          flex: 0 0 auto;
          white-space: nowrap;
        }
      }

      @media (max-width: 760px) {
        .desktop-table {
          display: none !important;
        }

        .mobile-cards {
          display: grid !important;
          gap: 10px;
        }

        .workflow-stats-grid,
        .investor-summary-grid,
        .statement-grid {
          grid-template-columns: 1fr !important;
        }
      }

      @media (max-width: 640px) {
        select {
          font-size: 16px !important;
        }
      }

      .print-table-wrapper {
        width: 100%;
        overflow-x: auto;
      }

      .print-table {
        width: 100%;
        min-width: 760px;
        border-collapse: collapse;
        table-layout: fixed;
        direction: rtl;
      }

      .print-table th,
      .print-table td {
        border: 1px solid #e2e8f0;
        padding: 9px 8px;
        text-align: center;
        vertical-align: middle;
        font-size: 12px;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      .print-table th {
        background: #f1f5f9;
        color: #0f172a;
        font-weight: 900;
      }

      .print-footer {
        display: none;
      }

      @media print {
        html,
        body {
          width: 210mm !important;
          min-height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body * {
          visibility: hidden !important;
        }

        .print-area,
        .print-area * {
          visibility: visible !important;
        }

        .print-area {
          position: absolute !important;
          inset: 0 auto auto 0 !important;
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        .print-document {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          color: #000000 !important;
          background: #ffffff !important;
          font-family: var(--font-almarai), sans-serif !important;
          direction: rtl !important;
        }

        .no-print,
        .statement-controls {
          display: none !important;
        }

        .print-header,
        .print-keep-together,
        .print-section-title,
        .print-empty {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .print-header {
          margin: 0 0 4mm !important;
          padding: 0 0 3mm !important;
          border-bottom: 1.2pt solid #0f172a !important;
        }

        .print-period {
          margin-top: 1.5mm !important;
          font-size: 9pt !important;
        }

        .statement-grid {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 2mm !important;
          margin-bottom: 4mm !important;
        }

        .statement-grid > * {
          min-height: 17mm !important;
          padding: 2.5mm !important;
          border: 0.7pt solid #cbd5e1 !important;
          border-radius: 2mm !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .print-section {
          margin-top: 4mm !important;
          break-before: auto !important;
          page-break-before: auto !important;
        }

        .print-section-title {
          margin: 0 0 2.5mm !important;
          padding: 0 0 1.5mm !important;
          border-bottom: 0.8pt solid #cbd5e1 !important;
          font-size: 11pt !important;
        }

        .print-table-wrapper {
          width: 100% !important;
          overflow: visible !important;
        }

        .print-table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          border-spacing: 0 !important;
          direction: rtl !important;
        }

        .print-table thead {
          display: table-header-group !important;
        }

        .print-table tbody {
          display: table-row-group !important;
        }

        .print-table tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .print-table th,
        .print-table td {
          border: 0.65pt solid #94a3b8 !important;
          padding: 1.8mm 1.3mm !important;
          font-size: 8.5pt !important;
          line-height: 1.35 !important;
          text-align: center !important;
          vertical-align: middle !important;
          overflow-wrap: anywhere !important;
          word-break: normal !important;
        }

        .print-table th {
          background: #eaf1fb !important;
          color: #0f172a !important;
          font-weight: 900 !important;
        }

        .print-footer {
          display: flex !important;
          justify-content: space-between !important;
          gap: 4mm !important;
          margin-top: 4mm !important;
          padding-top: 2mm !important;
          border-top: 0.6pt solid #cbd5e1 !important;
          color: #475569 !important;
          font-size: 8pt !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        @page {
          size: A4 portrait;
          margin: 10mm 9mm 10mm 9mm;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          scroll-behavior: auto !important;
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `}</style>
  );
}

const loadingHeroContent: CSSProperties = {
  position: "relative",
  zIndex: 3,
  minHeight: 112,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
};

const loadingSpinner: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "3px solid rgba(255,255,255,0.35)",
  borderTopColor: "#ffffff",
  animation: "workflow-spin 0.8s linear infinite",
};

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

const messageBox: CSSProperties = {
  marginBottom: 14,
  padding: "12px 14px",
  borderRadius: 15,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  fontWeight: 800,
};

const errorMessageBox: CSSProperties = {
  background: "#fff1f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
};

const successMessageBox: CSSProperties = {
  background: "#f0fdf4",
  color: "#166534",
  border: "1px solid #bbf7d0",
};

const messageRetryButton: CSSProperties = {
  border: "1px solid currentColor",
  background: "transparent",
  color: "inherit",
  borderRadius: 10,
  padding: "7px 11px",
  fontWeight: 900,
  cursor: "pointer",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
  display: "flex",
  alignItems: "center",
  gap: 12,
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const statIcon: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  background: "#eff6ff",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
};

const statValue: CSSProperties = {
  display: "block",
  fontSize: 24,
  color: "#0f172a",
};

const statTitle: CSSProperties = {
  display: "block",
  color: "#334155",
  fontWeight: 900,
};

const statHint: CSSProperties = {
  display: "block",
  color: "#64748b",
  marginTop: 3,
};

const investorBoard: CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 18,
  marginBottom: 14,
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  alignItems: "flex-start",
  marginBottom: 14,
};

const sectionTitle: CSSProperties = {
  margin: "4px 0",
  fontSize: 21,
  color: "#0f172a",
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
};

const selectBox: CSSProperties = {
  minWidth: 300,
};

const label: CSSProperties = {
  display: "block",
  color: "#334155",
  fontWeight: 900,
  marginBottom: 7,
  fontSize: 14,
};

const selectWrapper: CSSProperties = {
  position: "relative",
};

const select: CSSProperties = {
  width: "100%",
  minHeight: 50,
  appearance: "none",
  WebkitAppearance: "none",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  borderRadius: 14,
  padding: "12px 44px 12px 14px",
  fontSize: 15,
  color: "#0f172a",
  cursor: "pointer",
  outline: "none",
};

const selectArrow: CSSProperties = {
  position: "absolute",
  right: 14,
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
  pointerEvents: "none",
  display: "flex",
};

const investorSummaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: 10,
  marginBottom: 14,
};

const summaryCard: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 14,
};

const summaryValue: CSSProperties = {
  display: "block",
  color: "#1d4ed8",
  fontSize: 22,
};

const summaryTitle: CSSProperties = {
  display: "block",
  fontWeight: 900,
  color: "#0f172a",
  marginTop: 4,
};

const summaryHint: CSSProperties = {
  display: "block",
  color: "#64748b",
  marginTop: 3,
};

const tabsBox: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 14,
};

const tabButton: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#334155",
  borderRadius: 999,
  padding: "9px 13px",
  minHeight: 42,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const activeTabButton: CSSProperties = {
  ...tabButton,
  border: "1px solid transparent",
  background: "linear-gradient(135deg,#2563eb,#1e3a8a)",
  color: "#ffffff",
  boxShadow: "0 8px 18px rgba(37,99,235,0.18)",
};

const tabIcon: CSSProperties = {
  display: "flex",
};

const tabCounter: CSSProperties = {
  minWidth: 24,
  textAlign: "center",
  background: "rgba(148,163,184,.18)",
  borderRadius: 999,
  padding: "2px 7px",
  fontWeight: 900,
  color: "inherit",
};

const contractsBox: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 14,
};

const miniTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  color: "#0f172a",
  fontWeight: 900,
};

const contractsTableBox: CSSProperties = {
  overflowX: "auto",
};

const contractsTableHeader: CSSProperties = {
  minWidth: 990,
  display: "grid",
  gridTemplateColumns: "130px 160px 130px 150px 120px 120px 100px 70px",
  gap: 10,
  background: "#f1f5f9",
  color: "#1e3a8a",
  padding: 13,
  borderRadius: 12,
  fontWeight: 900,
};

const contractsTableRow: CSSProperties = {
  minWidth: 990,
  display: "grid",
  gridTemplateColumns: "130px 160px 130px 150px 120px 120px 100px 70px",
  gap: 10,
  padding: 13,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const smallActionButton: CSSProperties = {
  border: "none",
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 10,
  padding: "8px 11px",
  fontWeight: 900,
  cursor: "pointer",
};

const mobileContractCard: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 13,
  background: "#f8fafc",
  display: "grid",
  gap: 7,
};

const mobileCardTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
};

const mobileOpenButton: CSSProperties = {
  ...smallActionButton,
  marginTop: 6,
  width: "100%",
};

const bottomGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.8fr 1.2fr",
  gap: 14,
  alignItems: "start",
};

const card: CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 8px 20px rgba(15,23,42,.05)",
};

const listHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  flexWrap: "wrap",
};

const pageInfo: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: 900,
};

const dangerPill: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "7px 11px",
  fontWeight: 900,
};

const successAlert: CSSProperties = {
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
  borderRadius: 16,
  padding: 14,
  lineHeight: 1.8,
  fontWeight: 900,
};

const alertsList: CSSProperties = {
  display: "grid",
  gap: 9,
};

const alertItem: CSSProperties = {
  width: "100%",
  border: "1px solid #fed7aa",
  background: "#fff7ed",
  color: "#7c2d12",
  borderRadius: 15,
  padding: 12,
  textAlign: "right",
  cursor: "pointer",
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
};

const alertIcon: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 11,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#ffedd5",
  color: "#c2410c",
  flex: "0 0 auto",
};

const alertText: CSSProperties = {
  display: "grid",
  gap: 4,
};

const activityTableBox: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const activityTableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 160px 110px 120px 170px",
  gap: 12,
  background: "#f4f8ff",
  color: "#1e3a8a",
  fontWeight: 900,
  padding: 14,
  borderRadius: 12,
  minWidth: 820,
  marginBottom: 10,
};

const activityTableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 160px 110px 120px 170px",
  gap: 12,
  minWidth: 820,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const activityTypeCell: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const mobileActivityCard: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 15,
  padding: 12,
  display: "grid",
  gap: 6,
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  marginTop: 12,
  textAlign: "center",
  color: "#6b7280",
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
  padding: "10px 16px",
  background: "#1e3a8a",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const paginationText: CSSProperties = {
  color: "#0f172a",
  fontWeight: 900,
};

const dangerBadge: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "5px 9px",
  fontWeight: 900,
  fontSize: 12,
};

const successBadge: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "5px 9px",
  fontWeight: 900,
  fontSize: 12,
};

const blueBadge: CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "5px 9px",
  fontWeight: 900,
  fontSize: 12,
};

const grayBadge: CSSProperties = {
  background: "#e2e8f0",
  color: "#334155",
  borderRadius: 999,
  padding: "5px 9px",
  fontWeight: 900,
  fontSize: 12,
};

const statementBox: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
};

const statementControls: CSSProperties = {
  display: "grid",
  gap: 12,
  marginBottom: 16,
  padding: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
};

const statementDateFilters: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const dateFieldBox: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 185,
  flex: "1 1 185px",
};

const dateFieldLabel: CSSProperties = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 900,
};

const dateInput: CSSProperties = {
  width: "100%",
  minHeight: 45,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "9px 11px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 800,
  fontFamily: "var(--font-almarai), sans-serif",
};

const resetDateButton: CSSProperties = {
  minHeight: 45,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "9px 14px",
  background: "#ffffff",
  color: "#475569",
  fontWeight: 900,
  cursor: "pointer",
};

const dateRangeError: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #fecaca",
  borderRadius: 12,
  background: "#fff1f2",
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 900,
};

const statementActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: 12,
};

const printButton: CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg,#16a34a,#15803d)",
  color: "#ffffff",
  borderRadius: 13,
  padding: "11px 16px",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const statementHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  borderBottom: "1px solid #e2e8f0",
  paddingBottom: 12,
  marginBottom: 12,
};

const statementTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontFamily: "var(--font-almarai), sans-serif",
};

const statementPeriod: CSSProperties = {
  marginTop: 7,
  color: "#475569",
  fontSize: 13,
  fontWeight: 800,
};

const statementDate: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 10,
  height: "fit-content",
  fontWeight: 900,
  color: "#334155",
};

const statementInvestorBox: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
  marginBottom: 12,
  display: "grid",
  gap: 4,
};

const statementGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: 10,
  marginBottom: 14,
};

const statementItem: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 5,
  background: "#ffffff",
};

const statementSection: CSSProperties = {
  marginTop: 14,
};

const statementMiniTitle: CSSProperties = {
  margin: "0 0 10px",
  color: "#1e3a8a",
  fontFamily: "var(--font-almarai), sans-serif",
};

const statementTable: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "10px 17px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,163,74,0.22)",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
};
