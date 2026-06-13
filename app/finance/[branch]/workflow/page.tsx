"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;
const CONTRACTS_PER_PAGE = 15;

type InvestorTab = "all" | "overdue" | "paid" | "active" | "closed" | "statement";

type Investor = {
  id: string;
  branch_id: string;
  investor_name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  is_primary?: boolean;
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
};

export default function FinanceWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [contracts, setContracts] = useState<ContractItem[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [contractPage, setContractPage] = useState(1);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [activeInvestorTab, setActiveInvestorTab] =
    useState<InvestorTab>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPageData();
  }, [branch]);

  useEffect(() => {
    setContractPage(1);
  }, [selectedInvestorId, activeInvestorTab]);

  const selectedInvestor = useMemo(() => {
    return investors.find((investor) => investor.id === selectedInvestorId) || null;
  }, [investors, selectedInvestorId]);

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

  const overdueContracts = useMemo(() => {
    return investorContracts.filter((contract) => getContractStatus(contract) === "overdue");
  }, [investorContracts]);

  const paidContracts = useMemo(() => {
    return investorContracts.filter((contract) => getContractStatus(contract) === "paid");
  }, [investorContracts]);

  const activeContracts = useMemo(() => {
    return investorContracts.filter((contract) => getContractStatus(contract) === "active");
  }, [investorContracts]);

  const closedContracts = useMemo(() => {
    return investorContracts.filter((contract) => getContractStatus(contract) === "closed");
  }, [investorContracts]);

  const filteredInvestorContracts = useMemo(() => {
    if (activeInvestorTab === "overdue") return overdueContracts;
    if (activeInvestorTab === "paid") return paidContracts;
    if (activeInvestorTab === "active") return activeContracts;
    if (activeInvestorTab === "closed") return closedContracts;
    return investorContracts;
  }, [
    activeInvestorTab,
    investorContracts,
    overdueContracts,
    paidContracts,
    activeContracts,
    closedContracts,
  ]);

  const investorSummary = useMemo(() => {
    const totalDebt = sumValues(investorContracts, "debt_amount");
    const totalPaid = sumValues(investorContracts, "paid_amount");
    const totalRemaining = sumValues(investorContracts, "remaining_amount");
    const totalInstallments = sumValues(investorContracts, "installment_amount");

    return {
      totalContracts: investorContracts.length,
      totalDebt,
      totalPaid,
      totalRemaining,
      totalInstallments,
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

  const totalPages = Math.max(1, Math.ceil(activities.length / ITEMS_PER_PAGE));

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

  async function loadPageData() {
    setLoading(true);

    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setActivities([]);
      setInvestors([]);
      setContracts([]);
      setSelectedInvestorId("");
      setLoading(false);
      return;
    }

    const { data: activitiesData, error: activitiesError } = await supabase
      .from("finance_activity_logs")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    if (activitiesError) {
      console.log(activitiesError);
      alert("خطأ في تحميل سير العمل: " + activitiesError.message);
    }

    const { data: investorsData, error: investorsError } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (investorsError) {
      console.log(investorsError);
      alert("خطأ في تحميل المستثمرين: " + investorsError.message);
    }

    const { data: contractsData, error: contractsError } = await supabase
      .from("finance_contracts")
      .select(
        `
        id,
        contract_number,
        customer_id,
        customer_name,
        customer_phone,
        investor_id,
        investor_name,
        product_name,
        product_quantity,
        debt_amount,
        payment_amount,
        installment_amount,
        payment_type,
        payment_due_date,
        contract_status,
        paid_amount,
        remaining_amount,
        closed_at,
        created_at,
        contract_issue_date_gregorian,
        contract_date_gregorian
      `
      )
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    if (contractsError) {
      console.log(contractsError);
      alert("خطأ في تحميل عقود المستثمرين: " + contractsError.message);
    }

    const safeInvestors = (investorsData || []) as Investor[];

    setActivities(activitiesData || []);
    setInvestors(safeInvestors);
    setContracts((contractsData || []) as ContractItem[]);
    setCurrentPage(1);
    setContractPage(1);

    setSelectedInvestorId((oldId) => {
      if (safeInvestors.some((investor) => investor.id === oldId)) {
        return oldId;
      }

      const primaryInvestor =
        safeInvestors.find((investor) => investor.is_primary) || safeInvestors[0];

      return primaryInvestor?.id || "";
    });

    setLoading(false);
  }

  function getIcon(type: string) {
    switch (type) {
      case "إنشاء عقد":
        return "📄";
      case "سداد":
        return "💳";
      case "إلغاء دفعة":
        return "⛔";
      case "إنشاء عميل":
        return "👤";
      case "إنشاء سند":
        return "🧾";
      case "تعديل عقد":
        return "✏️";
      case "إغلاق عقد":
        return "🔒";
      default:
        return "📌";
    }
  }

  function openContract(contractId: string) {
    router.push(`/finance/${branch}/contracts/${contractId}`);
  }

  function goBack() {
    router.push(`/finance/${branch}`);
  }

  function printInvestorStatement() {
    window.print();
  }

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={container}>
          <section style={header}>
            <h1 style={headerTitle}>جاري تحميل سير العمل...</h1>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <header style={header}>
          <div style={headerTop}>
            <button className="no-print" style={backButton} onClick={goBack}>
              ← الرجوع
            </button>

            <button className="no-print" style={refreshButton} onClick={loadPageData}>
              تحديث البيانات
            </button>
          </div>

          <div>
            <p style={headerLabel}>محطة العمل</p>
            <h1 style={headerTitle}>سير العمل</h1>
            <p style={headerSub}>
              متابعة العمليات اليومية، التنبيهات، وحالة عقود المستثمرين داخل نفس الفرع.
            </p>
          </div>
        </header>

        <section className="workflow-stats-grid" style={statsGrid}>
          <StatCard
            title="آخر العمليات"
            value={activities.length}
            hint="عملية مسجلة"
            icon="📌"
          />
          <StatCard
            title="المستثمرون"
            value={investors.length}
            hint="مستثمر داخل الفرع"
            icon="👥"
          />
          <StatCard
            title="عقود المستثمر المحدد"
            value={investorSummary.totalContracts}
            hint="عقد"
            icon="📄"
          />
          <StatCard
            title="المتأخرون"
            value={investorSummary.overdueCount}
            hint="عقد متأخر"
            icon="⚠️"
          />
        </section>

        <section style={investorBoard}>
          <div style={sectionHeader}>
            <div>
              <p style={sectionKicker}>لوحة متابعة المستثمرين</p>
              <h2 style={sectionTitle}>متابعة المستثمر حسب العقود</h2>
              <p style={sectionSub}>
                اختر المستثمر ثم راقب العقود المتأخرة، المسددة، النشطة، والمغلقة.
              </p>
            </div>

            <div className="investor-select-box" style={selectBox}>
              <label style={label}>اختيار المستثمر</label>
              <select
                style={select}
                value={selectedInvestorId}
                onChange={(event) => setSelectedInvestorId(event.target.value)}
              >
                {investors.length === 0 ? (
                  <option value="">لا يوجد مستثمرون</option>
                ) : (
                  investors.map((investor) => (
                    <option key={investor.id} value={investor.id}>
                      {investor.is_primary ? "⭐ " : ""}
                      {investor.investor_name}
                    </option>
                  ))
                )}
              </select>
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

              <div className="workflow-tabs no-print" style={tabsBox}>
                {INVESTOR_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    style={
                      activeInvestorTab === tab.key ? activeTabButton : tabButton
                    }
                    onClick={() => setActiveInvestorTab(tab.key)}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
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
              <div>
                <p style={sectionKicker}>التنبيهات</p>
                <h2 style={sectionTitle}>تنبيهات المستثمرين</h2>
              </div>

              <span style={dangerPill}>{overdueContracts.length} متأخر</span>
            </div>

            {overdueContracts.length === 0 ? (
              <div style={successAlert}>
                لا توجد عقود متأخرة على المستثمر المحدد حالياً.
              </div>
            ) : (
              <div style={alertsList}>
                {overdueContracts.slice(0, 6).map((contract) => (
                  <button
                    key={contract.id}
                    style={alertItem}
                    onClick={() => openContract(contract.id)}
                  >
                    <span style={alertIcon}>⚠️</span>
                    <span>
                      <strong>{contract.contract_number || "عقد بدون رقم"}</strong>
                      <small>
                        {contract.customer_name || "-"} - متبقي{" "}
                        {formatMoney(contract.remaining_amount)} ريال - تأخير{" "}
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
              <div>
                <p style={sectionKicker}>السجل</p>
                <h2 style={sectionTitle}>آخر العمليات</h2>
              </div>

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
                        <span>
                          {getIcon(activity.activity_type)}{" "}
                          {activity.activity_type}
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
                        <strong>
                          {getIcon(activity.activity_type)}{" "}
                          {activity.activity_type}
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
                <div style={paginationBox}>
                  <button
                    style={{
                      ...paginationButton,
                      opacity: currentPage === 1 ? 0.5 : 1,
                    }}
                    disabled={currentPage === 1}
                    onClick={() =>
                      setCurrentPage((page) => Math.max(page - 1, 1))
                    }
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
                      setCurrentPage((page) =>
                        Math.min(page + 1, totalPages)
                      )
                    }
                  >
                    التالي
                  </button>
                </div>
              )}
            </div>
          </section>
        </section>
      </div>

      <GlobalResponsiveStyles />
    </main>
  );
}

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
        <div>
          <h3 style={miniTitle}>{getTabTitle(activeTab)}</h3>
          <p style={miniSub}>عدد النتائج: {totalContracts}</p>
        </div>
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
                <span>{contract.customer_phone || "-"}</span>
                <span>{contract.product_name || "-"}</span>
                <span>{formatMoney(contract.remaining_amount)}</span>
                <span>{formatDateOnly(contract.payment_due_date)}</span>
                <span>
                  <StatusBadge status={getContractStatus(contract)} />
                </span>
                <span>
                  <button
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
                <span>الجوال: {contract.customer_phone || "-"}</span>
                <span>المنتج: {contract.product_name || "-"}</span>
                <span>المتبقي: {formatMoney(contract.remaining_amount)} ريال</span>
                <span>الاستحقاق: {formatDateOnly(contract.payment_due_date)}</span>

                <button
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
        <div style={paginationBox}>
          <button
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
      )}
    </section>
  );
}

function InvestorStatement({
  investor,
  summary,
  contracts,
  overdueContracts,
  paidContracts,
  activeContracts,
  closedContracts,
  onPrint,
}: {
  investor: Investor;
  summary: {
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
  contracts: ContractItem[];
  overdueContracts: ContractItem[];
  paidContracts: ContractItem[];
  activeContracts: ContractItem[];
  closedContracts: ContractItem[];
  onPrint: () => void;
}) {
  return (
    <section className="print-area" style={statementBox}>
      <div className="no-print" style={statementActions}>
        <button style={printButton} onClick={onPrint}>
          طباعة الكشف الشامل
        </button>
      </div>

      <div style={statementHeader}>
        <div>
          <h2 style={statementTitle}>الكشف الشامل للمستثمر</h2>
          <p style={statementSub}>
            تقرير مختصر لحالة العقود والمبالغ والمتأخرات.
          </p>
        </div>

        <div style={statementDate}>
          تاريخ التقرير: {formatDateOnly(new Date().toISOString())}
        </div>
      </div>

      <div style={statementInvestorBox}>
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
      </div>

      <div className="statement-grid" style={statementGrid}>
        <StatementItem title="إجمالي العقود" value={summary.totalContracts} />
        <StatementItem title="النشطة" value={activeContracts.length} />
        <StatementItem title="المتأخرة" value={overdueContracts.length} />
        <StatementItem title="المسددة" value={paidContracts.length} />
        <StatementItem title="المغلقة" value={closedContracts.length} />
        <StatementItem title="إجمالي المديونية" value={formatMoney(summary.totalDebt)} />
        <StatementItem title="إجمالي المدفوع" value={formatMoney(summary.totalPaid)} />
        <StatementItem title="إجمالي المتبقي" value={formatMoney(summary.totalRemaining)} />
      </div>

      <div style={statementSection}>
        <h3 style={statementMiniTitle}>العقود المتأخرة</h3>

        {overdueContracts.length === 0 ? (
          <div style={emptyBox}>لا توجد عقود متأخرة.</div>
        ) : (
          <div style={statementTable}>
            <div style={statementTableHeader}>
              <span>رقم العقد</span>
              <span>العميل</span>
              <span>الجوال</span>
              <span>المتبقي</span>
              <span>الاستحقاق</span>
              <span>أيام التأخير</span>
            </div>

            {overdueContracts.map((contract) => (
              <div key={contract.id} style={statementTableRow}>
                <span>{contract.contract_number || "-"}</span>
                <span>{contract.customer_name || "-"}</span>
                <span>{contract.customer_phone || "-"}</span>
                <span>{formatMoney(contract.remaining_amount)}</span>
                <span>{formatDateOnly(contract.payment_due_date)}</span>
                <span>{getOverdueDays(contract.payment_due_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={statementSection}>
        <h3 style={statementMiniTitle}>جميع عقود المستثمر</h3>

        {contracts.length === 0 ? (
          <div style={emptyBox}>لا توجد عقود.</div>
        ) : (
          <div style={statementTable}>
            <div style={statementTableHeader}>
              <span>رقم العقد</span>
              <span>العميل</span>
              <span>المنتج</span>
              <span>المديونية</span>
              <span>المدفوع</span>
              <span>المتبقي</span>
            </div>

            {contracts.map((contract) => (
              <div key={contract.id} style={statementTableRow}>
                <span>{contract.contract_number || "-"}</span>
                <span>{contract.customer_name || "-"}</span>
                <span>{contract.product_name || "-"}</span>
                <span>{formatMoney(contract.debt_amount)}</span>
                <span>{formatMoney(contract.paid_amount)}</span>
                <span>{formatMoney(contract.remaining_amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
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
  icon: string;
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

function getContractStatus(contract: ContractItem) {
  const remaining = toNumber(contract.remaining_amount);
  const status = normalizeText(contract.contract_status);

  if (status === "closed" || status === "مغلق" || contract.closed_at) {
    return "closed";
  }

  if (remaining <= 0) {
    return "paid";
  }

  if (isOverdue(contract.payment_due_date) && remaining > 0) {
    return "overdue";
  }

  return "active";
}

function isOverdue(date: string | null) {
  if (!date) return false;

  const dueDate = new Date(date);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return dueDate <= today;
}

function getOverdueDays(date: string | null) {
  if (!date) return 0;

  const dueDate = new Date(date);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diff = today.getTime() - dueDate.getTime();

  if (diff <= 0) return 0;

  return Math.floor(diff / (1000 * 60 * 60 * 24));
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

function toNumber(value: any) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function sumValues(items: ContractItem[], key: keyof ContractItem) {
  return items.reduce((total, item) => total + toNumber(item[key]), 0);
}

function normalizeText(value: any) {
  return String(value || "").trim().toLowerCase();
}

function formatMoney(value: any) {
  return toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateOnly(date: string | null) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(date: string) {
  if (!date) return "-";

  return new Date(date).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      body {
        overflow-x: hidden;
      }

      .mobile-cards {
        display: none;
      }

      @media (max-width: 900px) {
        .workflow-stats-grid,
        .investor-summary-grid,
        .bottom-grid,
        .statement-grid {
          grid-template-columns: 1fr !important;
        }

        .investor-select-box {
          width: 100% !important;
          min-width: 100% !important;
        }

        .workflow-tabs {
          overflow-x: auto;
          flex-wrap: nowrap !important;
          padding-bottom: 4px;
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
      }

      @media print {
        body * {
          visibility: hidden !important;
        }

        .print-area,
        .print-area * {
          visibility: visible !important;
        }

        .print-area {
          position: absolute !important;
          top: 0 !important;
          right: 0 !important;
          left: 0 !important;
          width: 100% !important;
          background: white !important;
          box-shadow: none !important;
          border: none !important;
          padding: 14mm !important;
        }

        .no-print {
          display: none !important;
        }

        @page {
          size: A4;
          margin: 10mm;
        }
      }
    `}</style>
  );
}

const INVESTOR_TABS: { key: InvestorTab; label: string; icon: string }[] = [
  { key: "all", label: "جميع العقود", icon: "📄" },
  { key: "overdue", label: "المتأخرون", icon: "⚠️" },
  { key: "paid", label: "المسددون", icon: "✅" },
  { key: "active", label: "النشطون", icon: "🟢" },
  { key: "closed", label: "المغلقون", icon: "🔒" },
  { key: "statement", label: "الكشف الشامل", icon: "🧾" },
];

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#f4f7fb",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
  color: "#0f172a",
};

const container: CSSProperties = {
  width: "100%",
  maxWidth: 1250,
  margin: "auto",
};

const header: CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  padding: 24,
  borderRadius: 24,
  marginBottom: 18,
  boxShadow: "0 14px 30px rgba(15,23,42,.16)",
};

const headerTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 18,
};

const headerLabel: CSSProperties = {
  margin: 0,
  color: "#bfdbfe",
  fontWeight: 800,
};

const headerTitle: CSSProperties = {
  margin: "4px 0",
  fontSize: 34,
  lineHeight: 1.4,
};

const headerSub: CSSProperties = {
  margin: 0,
  color: "#dbeafe",
  lineHeight: 1.8,
};

const backButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.20)",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,.20)",
};

const refreshButton: CSSProperties = {
  ...backButton,
  background: "rgba(255,255,255,.10)",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: CSSProperties = {
  background: "white",
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
  fontSize: 22,
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
  background: "white",
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

const sectionKicker: CSSProperties = {
  margin: 0,
  color: "#2563eb",
  fontWeight: 900,
  fontSize: 13,
};

const sectionTitle: CSSProperties = {
  margin: "4px 0",
  fontSize: 22,
  color: "#0f172a",
};

const sectionSub: CSSProperties = {
  margin: 0,
  color: "#64748b",
  lineHeight: 1.8,
};

const selectBox: CSSProperties = {
  minWidth: 280,
};

const label: CSSProperties = {
  display: "block",
  color: "#334155",
  fontWeight: 900,
  marginBottom: 7,
};

const select: CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  borderRadius: 14,
  padding: 13,
  fontSize: 15,
  fontFamily: "inherit",
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
  padding: "10px 13px",
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
  color: "white",
};

const tabCounter: CSSProperties = {
  background: "rgba(255,255,255,.20)",
  borderRadius: 999,
  padding: "2px 7px",
  fontWeight: 900,
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
};

const miniSub: CSSProperties = {
  margin: "4px 0 0",
  color: "#64748b",
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
  background: "white",
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
  border: "1px solid #fecaca",
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
  fontSize: 20,
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
  color: "white",
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

const statementActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: 12,
};

const printButton: CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg,#16a34a,#15803d)",
  color: "white",
  borderRadius: 13,
  padding: "11px 16px",
  fontWeight: 900,
  cursor: "pointer",
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
};

const statementSub: CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
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
};

const statementTable: CSSProperties = {
  width: "100%",
  overflowX: "auto",
};

const statementTableHeader: CSSProperties = {
  minWidth: 760,
  display: "grid",
  gridTemplateColumns: "130px 150px 130px 120px 120px 110px",
  gap: 10,
  background: "#f1f5f9",
  color: "#0f172a",
  padding: 11,
  borderRadius: 10,
  fontWeight: 900,
};

const statementTableRow: CSSProperties = {
  minWidth: 760,
  display: "grid",
  gridTemplateColumns: "130px 150px 130px 120px 120px 110px",
  gap: 10,
  padding: 11,
  borderBottom: "1px solid #e2e8f0",
};
