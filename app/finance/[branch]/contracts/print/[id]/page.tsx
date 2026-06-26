"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import type { CSSProperties } from "react";
import {
  useParams,
  usePathname,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { exportElementToPdf } from "@/lib/exportElementToPdf";

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type FinanceSession = {
  id?: string | null;
  user_id?: string | null;
  full_name?: string | null;
  username?: string | null;
  role?: string | null;
  branch_id?: string | null;
  branch_slug?: string | null;
  branch_name?: string | null;
  organization_name?: string | null;
  permissions?: unknown;
  investor_id?: string | null;
  is_active?: boolean | null;
  last_login_at?: string | null;
};

type CustomerRelation = {
  id?: string | null;
  full_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
  birth_hijri?: string | null;
  work?: string | null;
  work_name?: string | null;
  address?: string | null;
};

type ContractRecord = {
  id: string;
  branch_id?: string | null;

  customer_id?: string | null;
  guarantor_customer_id?: string | null;

  contract_number?:
    | string
    | number
    | null;

  contract_status?: string | null;
  finance_type?: string | null;

  customer_name?: string | null;
  customer_national_id?: string | null;
  customer_phone?: string | null;
  customer_birth_hijri?: string | null;
  customer_work_name?: string | null;
  customer_address?: string | null;

  investor_name?: string | null;
  investor_national_id?: string | null;

  product_name?: string | null;
  product_quantity?:
    | string
    | number
    | null;

  print_party_type?: string | null;
  print_party_name?: string | null;
  print_party_identifier?: string | null;

  first_party_type?: string | null;
  first_party_name?: string | null;
  first_party_identifier?: string | null;

  debt_amount?:
    | string
    | number
    | null;

  payment_amount?:
    | string
    | number
    | null;

  paid_amount?:
    | string
    | number
    | null;

  remaining_amount?:
    | string
    | number
    | null;

  has_deferred_payments?: boolean | null;

  installment_amount?:
    | string
    | number
    | null;

  deferred_payments_count?:
    | string
    | number
    | null;

  payment_due_date?: string | null;

  contract_issue_date_gregorian?: string | null;
  contract_date_gregorian?: string | null;

  contract_issue_date_hijri?: string | null;
  contract_date_hijri?: string | null;

  legal_city?: string | null;

  judicial_amount?:
    | string
    | number
    | null;

  notes?: string | null;

  has_guarantor?: boolean | null;
  guarantor_name?: string | null;
  guarantor_national_id?: string | null;
  guarantor_phone?: string | null;
  guarantor_birth_hijri?: string | null;
  guarantor_work_name?: string | null;

  customer?:
    | CustomerRelation
    | CustomerRelation[]
    | null;

  guarantor_customer?:
    | CustomerRelation
    | CustomerRelation[]
    | null;
};

type OrganizationSettings = {
  name: string;
  phone: string;
  city: string;
  commercialRecord: string;
};

const SESSION_DURATION_MS =
  60 * 60 * 1000;

const ACTIVITY_REFRESH_INTERVAL_MS =
  60 * 1000;

const SESSION_KEYS = [
  "finance_user",
  "finance_branch_user",
  "finance_user_id",
  "finance_user_name",
  "finance_username",
  "finance_role",
  "finance_branch_id",
  "finance_branch_slug",
  "finance_branch_name",
  "finance_organization_name",
  "finance_permissions",
  "finance_investor_id",
  "finance_is_active",
  "finance_last_login_at",
  "finance_session_expires_at",
  "finance_last_activity_at",
  "finance_return_to",
] as const;

export default function PrintContractPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const branch = String(
    params.branch ?? ""
  ).trim();

  const contractId = String(
    params.id ?? ""
  ).trim();

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [pageReady, setPageReady] =
    useState(false);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [contract, setContract] =
    useState<ContractRecord | null>(
      null
    );

  const [
    organizationSettings,
    setOrganizationSettings,
  ] = useState<OrganizationSettings>({
    name: "احتساب",
    phone: "",
    city: "",
    commercialRecord: "",
  });

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [exportingPdf, setExportingPdf] =
    useState(false);

  const isMobile =
    screen === "mobile";

  const isTablet =
    screen === "tablet";

  const isCompact =
    isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      const width =
        window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 980) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    updateScreen();

    window.addEventListener(
      "resize",
      updateScreen
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateScreen
      );
    };
  }, []);

  useEffect(() => {
    const style =
      document.createElement("style");

    style.innerHTML = `
      * {
        box-sizing: border-box;
      }

      body {
        overflow-x: hidden;
      }

      button {
        -webkit-tap-highlight-color: transparent;
      }

      @media print {
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        .contract-print-main {
          min-height: auto !important;
          padding: 0 !important;
          margin: 0 !important;
          background: #ffffff !important;
        }

        .contract-print-container {
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
        }

        .no-print {
          display: none !important;
        }

        #contract-print-area {
          width: 194mm !important;
          height: 281mm !important;
          min-height: 281mm !important;
          max-height: 281mm !important;
          margin: 0 auto !important;
          padding: 7mm !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
          page-break-inside: avoid !important;
          break-inside: avoid-page !important;
        }

        #contract-print-area section,
        #contract-print-area div,
        #contract-print-area p {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }

      @page {
        size: A4 portrait;
        margin: 8mm;
      }

      @media (max-width: 850px) {
        #contract-print-area {
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          padding: 18px !important;
        }

        .contract-document-header {
          grid-template-columns: 1fr !important;
          text-align: center !important;
        }

        .contract-header-left {
          text-align: center !important;
        }

        .contract-signatures,
        .contract-guarantor-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const loadContract = useCallback(
    async (
      currentBranchId: string,
      isCancelled: () => boolean =
        () => false
    ) => {
      if (
        !currentBranchId ||
        !contractId
      ) {
        setPageError(
          "تعذر تحديد العقد أو الفرع"
        );

        setLoading(false);
        return;
      }

      setLoading(true);
      setPageError("");

      try {
        const [
          branchResult,
          contractResult,
        ] = await Promise.all([
          supabase
            .from("finance_branches")
            .select(
              "id, branch_slug, branch_name, organization_name, phone, city, commercial_record, is_active"
            )
            .eq(
              "id",
              currentBranchId
            )
            .eq(
              "branch_slug",
              branch
            )
            .maybeSingle(),

          supabase
            .from("finance_contracts")
            .select(
              `
              *,
              customer:finance_customers!finance_contracts_customer_id_fkey(
                id,
                full_name,
                national_id,
                phone,
                birth_hijri,
                work,
                work_name,
                address
              ),
              guarantor_customer:finance_customers!finance_contracts_guarantor_customer_id_fkey(
                id,
                full_name,
                national_id,
                phone,
                birth_hijri,
                work,
                work_name,
                address
              )
            `
            )
            .eq("id", contractId)
            .eq(
              "branch_id",
              currentBranchId
            )
            .maybeSingle(),
        ]);

        if (isCancelled()) {
          return;
        }

        if (branchResult.error) {
          throw new Error(
            branchResult.error.message
          );
        }

        if (
          !branchResult.data ||
          branchResult.data.is_active ===
            false
        ) {
          throw new Error(
            "الفرع غير موجود أو غير نشط"
          );
        }

        if (contractResult.error) {
          throw new Error(
            contractResult.error.message
          );
        }

        if (!contractResult.data) {
          throw new Error(
            "العقد غير موجود أو لا يتبع هذا الفرع"
          );
        }

        setOrganizationSettings({
          name:
            branchResult.data
              .organization_name ||
            localStorage.getItem(
              "finance_organization_name"
            ) ||
            "احتساب",

          phone:
            branchResult.data.phone ||
            "",

          city:
            branchResult.data.city ||
            branchResult.data
              .branch_name ||
            "",

          commercialRecord:
            branchResult.data
              .commercial_record ||
            "",
        });

        setContract(
          contractResult.data as ContractRecord
        );

        if (
          branchResult.data
            .organization_name
        ) {
          localStorage.setItem(
            "finance_organization_name",
            branchResult.data
              .organization_name
          );
        }
      } catch (error) {
        if (isCancelled()) {
          return;
        }

        console.error(
          "Contract print loading error:",
          error
        );

        setContract(null);

        setPageError(
          getErrorMessage(
            error,
            "تعذر تحميل بيانات العقد"
          )
        );
      } finally {
        if (!isCancelled()) {
          setLoading(false);
        }
      }
    },
    [branch, contractId]
  );

  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      if (
        typeof window === "undefined"
      ) {
        return;
      }

      if (
        !branch ||
        !contractId
      ) {
        redirectToLogin(true);
        return;
      }

      const storedSession =
        readStoredSession();

      if (
        !isValidSession(
          storedSession
        )
      ) {
        redirectToLogin(true);
        return;
      }

      const sessionBranchSlug =
        String(
          storedSession
            ?.branch_slug || ""
        ).trim();

      if (
        sessionBranchSlug &&
        sessionBranchSlug !== branch
      ) {
        router.replace(
          `/finance/${sessionBranchSlug}`
        );

        return;
      }

      const resolvedEmployeeName =
        localStorage.getItem(
          "finance_user_name"
        ) ||
        storedSession?.full_name ||
        storedSession?.username ||
        "الموظف";

      setEmployeeName(
        resolvedEmployeeName
      );

      renewFinanceSession();
      setPageReady(true);

      const storedBranchId =
        String(
          storedSession?.branch_id ||
            localStorage.getItem(
              "finance_branch_id"
            ) ||
            ""
        ).trim();

      let resolvedBranchId =
        storedBranchId;

      if (!resolvedBranchId) {
        try {
          const fetchedBranchId =
            await getBranchId(branch);

          if (cancelled) {
            return;
          }

          if (!fetchedBranchId) {
            setPageError(
              "تعذر تحديد الفرع"
            );

            setLoading(false);
            return;
          }

          resolvedBranchId =
            String(fetchedBranchId);

          localStorage.setItem(
            "finance_branch_id",
            resolvedBranchId
          );

          localStorage.setItem(
            "finance_branch_slug",
            branch
          );
        } catch (error) {
          if (cancelled) {
            return;
          }

          setPageError(
            getErrorMessage(
              error,
              "تعذر تحديد الفرع"
            )
          );

          setLoading(false);
          return;
        }
      }

      if (cancelled) {
        return;
      }

      setBranchId(
        resolvedBranchId
      );

      await loadContract(
        resolvedBranchId,
        () => cancelled
      );
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [
    branch,
    contractId,
    loadContract,
    router,
  ]);

  useEffect(() => {
    if (
      !pageReady ||
      typeof window === "undefined"
    ) {
      return;
    }

    let lastRefresh = 0;

    function handleActivity() {
      const now = Date.now();

      if (
        now - lastRefresh <
        ACTIVITY_REFRESH_INTERVAL_MS
      ) {
        return;
      }

      lastRefresh = now;
      renewFinanceSession();
    }

    const events:
      Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    events.forEach((eventName) => {
      window.addEventListener(
        eventName,
        handleActivity,
        { passive: true }
      );
    });

    const timer =
      window.setInterval(() => {
        const expiresAt = Number(
          localStorage.getItem(
            "finance_session_expires_at"
          ) || 0
        );

        if (
          expiresAt > 0 &&
          Date.now() >= expiresAt
        ) {
          redirectToLogin(true);
        }
      }, 30 * 1000);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          handleActivity
        );
      });

      window.clearInterval(timer);
    };
  }, [pageReady, pathname]);

  function readStoredSession():
    | FinanceSession
    | null {
    if (
      typeof window === "undefined"
    ) {
      return null;
    }

    const rawSession =
      localStorage.getItem(
        "finance_branch_user"
      ) ||
      localStorage.getItem(
        "finance_user"
      );

    if (!rawSession) {
      return null;
    }

    try {
      const parsed =
        JSON.parse(
          rawSession
        ) as FinanceSession;

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return null;
      }

      return {
        ...parsed,

        id:
          parsed.id ||
          parsed.user_id ||
          localStorage.getItem(
            "finance_user_id"
          ),

        full_name:
          parsed.full_name ||
          localStorage.getItem(
            "finance_user_name"
          ) ||
          null,

        username:
          parsed.username ||
          localStorage.getItem(
            "finance_username"
          ) ||
          null,

        role:
          parsed.role ||
          localStorage.getItem(
            "finance_role"
          ) ||
          null,

        branch_id:
          parsed.branch_id ||
          localStorage.getItem(
            "finance_branch_id"
          ) ||
          null,

        branch_slug:
          parsed.branch_slug ||
          localStorage.getItem(
            "finance_branch_slug"
          ) ||
          null,

        branch_name:
          parsed.branch_name ||
          localStorage.getItem(
            "finance_branch_name"
          ) ||
          null,

        organization_name:
          parsed.organization_name ||
          localStorage.getItem(
            "finance_organization_name"
          ) ||
          null,

        investor_id:
          parsed.investor_id ||
          localStorage.getItem(
            "finance_investor_id"
          ) ||
          null,
      };
    } catch {
      return null;
    }
  }

  function isValidSession(
    session: FinanceSession | null
  ) {
    if (!session) {
      return false;
    }

    const userId = String(
      session.id ||
        session.user_id ||
        ""
    ).trim();

    const sessionBranchSlug =
      String(
        session.branch_slug || ""
      ).trim();

    if (
      !userId ||
      !sessionBranchSlug
    ) {
      return false;
    }

    if (
      session.is_active === false
    ) {
      return false;
    }

    const expiresAt = Number(
      localStorage.getItem(
        "finance_session_expires_at"
      ) || 0
    );

    if (
      expiresAt > 0 &&
      Date.now() >= expiresAt
    ) {
      return false;
    }

    return true;
  }

  function renewFinanceSession() {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    const now = Date.now();

    localStorage.setItem(
      "finance_last_activity_at",
      String(now)
    );

    localStorage.setItem(
      "finance_session_expires_at",
      String(
        now + SESSION_DURATION_MS
      )
    );
  }

  function clearSession({
    preserveReturnPath = false,
  }: {
    preserveReturnPath?: boolean;
  } = {}) {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    SESSION_KEYS.forEach((key) => {
      if (
        preserveReturnPath &&
        key === "finance_return_to"
      ) {
        return;
      }

      localStorage.removeItem(key);
    });
  }

  function getCurrentReturnPath() {
    if (
      typeof window === "undefined"
    ) {
      return (
        pathname ||
        `/finance/${branch}/contracts/print/${contractId}`
      );
    }

    return `${window.location.pathname}${window.location.search}`;
  }

  function isSafeReturnPath(
    value: string
  ) {
    if (
      !value.startsWith(
        `/finance/${branch}`
      )
    ) {
      return false;
    }

    if (
      value.startsWith("//") ||
      value.includes("://")
    ) {
      return false;
    }

    return true;
  }

  function redirectToLogin(
    preserveReturnPath = true
  ) {
    if (
      typeof window === "undefined"
    ) {
      router.replace("/login");
      return;
    }

    const returnTo =
      getCurrentReturnPath();

    if (
      preserveReturnPath &&
      isSafeReturnPath(returnTo)
    ) {
      localStorage.setItem(
        "finance_return_to",
        returnTo
      );
    }

    clearSession({
      preserveReturnPath,
    });

    if (
      preserveReturnPath &&
      isSafeReturnPath(returnTo)
    ) {
      localStorage.setItem(
        "finance_return_to",
        returnTo
      );

      router.replace(
        `/login?returnTo=${encodeURIComponent(
          returnTo
        )}`
      );

      return;
    }

    router.replace("/login");
  }

  function logout() {
    clearSession({
      preserveReturnPath: false,
    });

    router.replace("/login");
  }

  function retryLoading() {
    if (!branchId) {
      setPageError(
        "تعذر تحديد الفرع"
      );

      return;
    }

    void loadContract(branchId);
  }

  function getSingleRelation(
    relation:
      | CustomerRelation
      | CustomerRelation[]
      | null
      | undefined
  ) {
    if (Array.isArray(relation)) {
      return relation[0] || null;
    }

    return relation || null;
  }

  function formatMoney(
    value: unknown
  ) {
    const amount =
      Number(value || 0);

    return amount.toLocaleString(
      "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function formatDateOnly(
    value?: string | null
  ) {
    if (!value) {
      return "-";
    }

    const directMatch =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        value
      );

    if (directMatch) {
      return `${directMatch[3]}/${directMatch[2]}/${directMatch[1]}`;
    }

    const parsedDate =
      new Date(value);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return String(value);
    }

    return new Intl.DateTimeFormat(
      "en-GB-u-ca-gregory",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    ).format(parsedDate);
  }

  function handlePrint() {
    if (
      loading ||
      pageError ||
      !contract
    ) {
      alert(
        "انتظر حتى يكتمل تحميل بيانات العقد"
      );

      return;
    }

    renewFinanceSession();
    window.print();
  }

  async function handleExportPdf() {
    if (
      loading ||
      pageError ||
      !contract ||
      exportingPdf
    ) {
      if (!exportingPdf) {
        alert(
          "انتظر حتى يكتمل تحميل بيانات العقد"
        );
      }

      return;
    }

    try {
      setExportingPdf(true);
      renewFinanceSession();

      await exportElementToPdf(
        "contract-print-area",
        String(
          contract.contract_number ||
            "contract"
        )
      );
    } catch (error) {
      console.error(
        "PDF export error:",
        error
      );

      alert(
        getErrorMessage(
          error,
          "تعذر تحميل ملف PDF"
        )
      );
    } finally {
      setExportingPdf(false);
    }
  }

  if (!pageReady) {
    return null;
  }

  const customer =
    getSingleRelation(
      contract?.customer
    );

  const guarantorCustomer =
    getSingleRelation(
      contract?.guarantor_customer
    );

  const customerName =
    customer?.full_name ||
    contract?.customer_name ||
    "................";

  const nationalId =
    customer?.national_id ||
    contract?.customer_national_id ||
    "................";

  const phone =
    customer?.phone ||
    contract?.customer_phone ||
    "................";

  const birthHijri =
    customer?.birth_hijri ||
    contract?.customer_birth_hijri ||
    "................";

  const customerWork =
    customer?.work_name ||
    customer?.work ||
    contract?.customer_work_name ||
    "";

  const customerAddress =
    customer?.address ||
    contract?.customer_address ||
    "";

  const firstPartyType =
    contract?.print_party_type ||
    contract?.first_party_type ||
    "organization";

  const isInvestorParty =
    firstPartyType === "investor";

  const firstPartyName =
    isInvestorParty
      ? contract?.print_party_name ||
        contract?.first_party_name ||
        contract?.investor_name ||
        "................"
      : contract?.print_party_name ||
        contract?.first_party_name ||
        organizationSettings.name ||
        "................";

  const firstPartyIdentifier =
    isInvestorParty
      ? contract?.print_party_identifier ||
        contract?.first_party_identifier ||
        contract?.investor_national_id ||
        ""
      : contract?.print_party_identifier ||
        contract?.first_party_identifier ||
        organizationSettings.commercialRecord ||
        "";

  const firstPartyIdentifierLabel =
    isInvestorParty
      ? "رقم الهوية"
      : "سجل تجاري رقم";

  const contractIssueDate =
    formatDateOnly(
      contract?.contract_issue_date_gregorian ||
        contract?.contract_date_gregorian
    );

  const contractIssueDateHijri =
    contract?.contract_issue_date_hijri ||
    contract?.contract_date_hijri ||
    "";

  const paymentDueDate =
    formatDateOnly(
      contract?.payment_due_date
    );

  const hasDeferredPayments =
    Boolean(
      contract?.has_deferred_payments
    ) ||
    Number(
      contract?.installment_amount ||
        0
    ) > 0;

  const hasGuarantor =
    Boolean(
      contract?.has_guarantor
    ) ||
    Boolean(
      contract?.guarantor_customer_id
    ) ||
    Boolean(
      guarantorCustomer?.full_name
    ) ||
    Boolean(
      contract?.guarantor_name
    );

  const guarantorName =
    guarantorCustomer?.full_name ||
    contract?.guarantor_name ||
    "................";

  const guarantorNationalId =
    guarantorCustomer?.national_id ||
    contract?.guarantor_national_id ||
    "................";

  const guarantorPhone =
    guarantorCustomer?.phone ||
    contract?.guarantor_phone ||
    "................";

  const guarantorBirthHijri =
    guarantorCustomer?.birth_hijri ||
    contract?.guarantor_birth_hijri ||
    "................";

  const guarantorWork =
    guarantorCustomer?.work_name ||
    guarantorCustomer?.work ||
    contract?.guarantor_work_name ||
    "";

  return (
    <main
      dir="rtl"
      className="contract-print-main"
      style={getPageStyle(isMobile)}
    >
      <div
        className="contract-print-container"
        style={getContainerStyle(
          isCompact
        )}
      >
        <header
          className="no-print"
          style={getHeroStyle(
            isMobile
          )}
        >
          <div
            style={heroCircleOne}
          />

          <div
            style={heroCircleTwo}
          />

          <div
            style={heroCircleThree}
          />

          <div style={heroDots} />

          <div
            style={getHeroContentStyle(
              screen
            )}
          >
            <div
              style={getHeroUserCardStyle(
                screen
              )}
            >
              <div
                style={getEmployeeTopRowStyle(
                  screen
                )}
              >
                <div
                  style={employeeIcon}
                >
                  <UserIcon />
                </div>

                <div
                  style={getEmployeeNameStyle(
                    isMobile
                  )}
                >
                  {employeeName}
                </div>

                {!isMobile && (
                  <div
                    style={
                      employeeDividerSmall
                    }
                  />
                )}

                <button
                  type="button"
                  style={
                    logoutInlineButton
                  }
                  onClick={logout}
                >
                  <LogoutIcon />

                  <span>
                    تسجيل الخروج
                  </span>
                </button>
              </div>

              <button
                type="button"
                style={getMainWorkstationButtonStyle(
                  isMobile
                )}
                onClick={() =>
                  router.push(
                    `/finance/${branch}`
                  )
                }
              >
                <HomeIcon />

                <span>
                  محطة العمل الرئيسية
                </span>
              </button>
            </div>

            <div
              style={getHeroTitleBoxStyle(
                screen
              )}
            >
              <h1
                style={getTitleStyle(
                  screen
                )}
              >
                طباعة العقد
              </h1>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            />
          </div>
        </header>

        {loading && (
          <section
            className="no-print"
            style={loadingBox}
          >
            جاري تحميل بيانات العقد...
          </section>
        )}

        {pageError && (
          <section
            className="no-print"
            style={errorBox}
          >
            <span>{pageError}</span>

            <button
              type="button"
              style={retryButton}
              onClick={retryLoading}
            >
              إعادة المحاولة
            </button>
          </section>
        )}

        {!loading &&
          !pageError &&
          !contract && (
            <section
              className="no-print"
              style={emptyBox}
            >
              لم يتم العثور على العقد أو أنه لا يتبع هذا الفرع
            </section>
          )}

        {contract && (
          <section
            id="contract-print-area"
            style={printArea}
          >
            <PrintHeader
              title="عقد اتفاق بيع"
              organizationSettings={
                organizationSettings
              }
              contractNumber={
                contract.contract_number
              }
              contractIssueDate={
                contractIssueDate
              }
            />

            <div style={contentBox}>
              <p style={paragraph}>
                الحمد لله والصلاة
                والسلام على من لا نبي
                بعده، وبعد:
              </p>

              <p style={paragraph}>
                أقر أنا الموقع أدناه
                الطرف الثاني /{" "}
                <strong>
                  {customerName}
                </strong>
                ، رقم الهوية /{" "}
                <strong>
                  {nationalId}
                </strong>
                ، تاريخ الميلاد /{" "}
                <strong>
                  {birthHijri}
                </strong>
                ، رقم الجوال /{" "}
                <strong>{phone}</strong>

                {customerWork ? (
                  <>
                    ، العمل /{" "}
                    <strong>
                      {customerWork}
                    </strong>
                  </>
                ) : null}

                {customerAddress ? (
                  <>
                    ، العنوان /{" "}
                    <strong>
                      {customerAddress}
                    </strong>
                  </>
                ) : null}

                ، بأني اشتريت من الطرف
                الأول /{" "}
                <strong>
                  {firstPartyName}
                </strong>

                {firstPartyIdentifier ? (
                  <>
                    ،{" "}
                    {
                      firstPartyIdentifierLabel
                    }{" "}
                    /{" "}
                    <strong>
                      {
                        firstPartyIdentifier
                      }
                    </strong>
                  </>
                ) : null}
                .
              </p>

              <p style={paragraph}>
                وذلك مقابل /{" "}
                <strong>
                  {contract.product_name ||
                    "................"}
                </strong>
                ، وعددها /{" "}
                <strong>
                  {contract.product_quantity ||
                    "-"}
                </strong>
                ، بمبلغ دين وقدره /{" "}
                <strong>
                  {formatMoney(
                    contract.debt_amount
                  )}
                </strong>{" "}
                ريال سعودي.
              </p>

              <p style={paragraph}>
                ويلتزم الطرف الثاني
                بسداد مبلغ وقدره /{" "}
                <strong>
                  {formatMoney(
                    contract.payment_amount ??
                      contract.debt_amount
                  )}
                </strong>{" "}
                ريال سعودي

                {hasDeferredPayments ? (
                  <>
                    ، على دفعات آجلة
                    قيمة كل دفعة /{" "}
                    <strong>
                      {formatMoney(
                        contract.installment_amount
                      )}
                    </strong>{" "}
                    ريال سعودي، وعددها /{" "}
                    <strong>
                      {contract.deferred_payments_count ||
                        0}
                    </strong>{" "}
                    دفعات، ويكون تاريخ
                    الاستحقاق بتاريخ /{" "}
                    <strong>
                      {paymentDueDate}
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    ، ويكون تاريخ
                    الاستحقاق بتاريخ /{" "}
                    <strong>
                      {paymentDueDate}
                    </strong>
                    .
                  </>
                )}
              </p>

              <p style={paragraph}>
                وتكون مدينة التقاضي /{" "}
                <strong>
                  {contract.legal_city ||
                    "-"}
                </strong>
                .
              </p>

              {Number(
                contract.judicial_amount ||
                  0
              ) > 0 && (
                <p style={paragraph}>
                  ويكون المبلغ القضائي
                  المتفق عليه /{" "}
                  <strong>
                    {formatMoney(
                      contract.judicial_amount
                    )}
                  </strong>{" "}
                  ريال سعودي.
                </p>
              )}

              <p style={paragraph}>
                كما يقر الطرف الثاني
                بأنه اطلع على كامل بنود
                هذا العقد، وأنه ملتزم
                بالسداد في المواعيد
                المتفق عليها، وفي حال
                التأخر يحق للطرف الأول
                اتخاذ الإجراءات النظامية
                اللازمة للمطالبة بكامل
                المبلغ المتبقي.
              </p>

              {contract.notes?.trim() && (
                <p style={paragraph}>
                  ملاحظات:{" "}
                  <strong>
                    {contract.notes}
                  </strong>
                </p>
              )}
            </div>

            <div
              className="contract-signatures"
              style={signatures}
            >
              <div style={signatureBox}>
                <strong>
                  الطرف الأول البائع
                </strong>

                <div>
                  الاسم /{" "}
                  {firstPartyName}
                </div>

                <div>
                  {
                    firstPartyIdentifierLabel
                  }{" "}
                  /{" "}
                  {firstPartyIdentifier ||
                    "................"}
                </div>

                <div>
                  التوقيع /
                  ................
                </div>
              </div>

              <div style={signatureBox}>
                <strong>
                  الطرف الثاني المشتري
                </strong>

                <div>
                  الاسم / {customerName}
                </div>

                <div>
                  رقم الهوية /{" "}
                  {nationalId}
                </div>

                <div>
                  الجوال / {phone}
                </div>

                <div>
                  التوقيع /
                  ................
                </div>
              </div>
            </div>

            {hasGuarantor && (
              <div style={guarantorBox}>
                <strong>
                  الكفيل الغارم
                </strong>

                <div
                  className="contract-guarantor-grid"
                  style={guarantorGrid}
                >
                  <div>
                    الاسم /{" "}
                    {guarantorName}
                  </div>

                  <div>
                    رقم الهوية /{" "}
                    {guarantorNationalId}
                  </div>

                  <div>
                    الجوال /{" "}
                    {guarantorPhone}
                  </div>

                  <div>
                    تاريخ الميلاد /{" "}
                    {
                      guarantorBirthHijri
                    }
                  </div>

                  {guarantorWork && (
                    <div>
                      العمل /{" "}
                      {guarantorWork}
                    </div>
                  )}
                </div>

                <div>
                  التوقيع /
                  ................
                </div>
              </div>
            )}

            <div style={documentFooter}>
              <span>
                رقم العقد:{" "}
                {contract.contract_number ||
                  "-"}
              </span>

              <span>
                تاريخ التحرير:{" "}
                {contractIssueDate}
              </span>

              {contractIssueDateHijri && (
                <span>
                  التاريخ الهجري:{" "}
                  {
                    contractIssueDateHijri
                  }
                </span>
              )}
            </div>
          </section>
        )}

        <div
          className="no-print"
          style={buttonsArea}
        >
          <button
            type="button"
            style={{
              ...printButton,
              opacity:
                loading ||
                Boolean(pageError) ||
                !contract
                  ? 0.6
                  : 1,
            }}
            disabled={
              loading ||
              Boolean(pageError) ||
              !contract
            }
            onClick={handlePrint}
          >
            🖨️ طباعة العقد
          </button>

          <button
            type="button"
            style={{
              ...pdfButton,
              opacity:
                loading ||
                Boolean(pageError) ||
                !contract ||
                exportingPdf
                  ? 0.6
                  : 1,
            }}
            disabled={
              loading ||
              Boolean(pageError) ||
              !contract ||
              exportingPdf
            }
            onClick={() =>
              void handleExportPdf()
            }
          >
            {exportingPdf
              ? "جاري تجهيز PDF..."
              : "📄 تحميل PDF"}
          </button>
        </div>

        <div
          className="no-print"
          style={backWrapper}
        >
          <button
            type="button"
            style={backButton}
            onClick={() =>
              router.push(
                `/finance/${branch}/contracts/${contractId}`
              )
            }
          >
            ← رجوع للعقد
          </button>
        </div>
      </div>
    </main>
  );
}

function PrintHeader({
  title,
  organizationSettings,
  contractNumber,
  contractIssueDate,
}: {
  title: string;
  organizationSettings: OrganizationSettings;
  contractNumber:
    | string
    | number
    | null
    | undefined;
  contractIssueDate: string;
}) {
  return (
    <div
      className="contract-document-header"
      style={documentHeader}
    >
      <div style={documentHeaderRight}>
        <div>
          المملكة العربية السعودية
        </div>

        <div>
          {organizationSettings.city ||
            "................"}
        </div>

        <div>
          {organizationSettings.name ||
            "................"}
        </div>

        <div>
          سجل تجاري رقم /{" "}
          {organizationSettings.commercialRecord ||
            "................"}
        </div>

        {organizationSettings.phone && (
          <div>
            الجوال /{" "}
            {
              organizationSettings.phone
            }
          </div>
        )}
      </div>

      <div style={documentTitle}>
        {title}
      </div>

      <div
        className="contract-header-left"
        style={documentHeaderLeft}
      >
        <div>
          رقم العقد:{" "}
          {contractNumber || "-"}
        </div>

        <div>
          تاريخ تحرير العقد:{" "}
          {contractIssueDate}
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error) {
    return (
      error.message || fallback
    );
  }

  if (
    typeof error === "string"
  ) {
    return error || fallback;
  }

  return fallback;
}

function UserIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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

function getPageStyle(
  isMobile: boolean
): CSSProperties {
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
    backgroundAttachment:
      isMobile
        ? "scroll"
        : "fixed",
    padding:
      isMobile ? 10 : 18,
    fontFamily:
      "var(--font-almarai), sans-serif",
    color: "#111827",
  };
}

function getContainerStyle(
  isCompact: boolean
): CSSProperties {
  return {
    width: "100%",
    maxWidth:
      isCompact
        ? 980
        : 1180,
    margin: "auto",
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",
    minHeight:
      isMobile
        ? "auto"
        : 160,
    borderRadius:
      isMobile
        ? 20
        : 24,
    padding:
      isMobile
        ? "18px 14px"
        : "22px 26px",
    marginBottom: 14,
    overflow: "hidden",
    border: "none",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    isolation: "isolate",
  };
}

function getHeroContentStyle(
  screen: ScreenType
): CSSProperties {
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
    gridTemplateColumns:
      "minmax(250px,315px) 1fr minmax(220px,315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(
  screen: ScreenType
): CSSProperties {
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

function getEmployeeTopRowStyle(
  screen: ScreenType
): CSSProperties {
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

function getEmployeeNameStyle(
  isMobile: boolean
): CSSProperties {
  return {
    color: "#ffffff",
    fontSize:
      isMobile
        ? 15
        : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow:
      "0 4px 10px rgba(15,23,42,0.18)",
  };
}

function getMainWorkstationButtonStyle(
  isMobile: boolean
): CSSProperties {
  return {
    width:
      isMobile
        ? "100%"
        : 220,
    maxWidth:
      isMobile
        ? 280
        : 220,
    height: 44,
    border: "none",
    background:
      "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily:
      "var(--font-almarai), sans-serif",
    boxShadow:
      "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(
  screen: ScreenType
): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order:
      screen === "desktop"
        ? 0
        : 1,
  };
}

function getTitleStyle(
  screen: ScreenType
): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontFamily:
      "var(--font-almarai), sans-serif",
    fontSize:
      screen === "mobile"
        ? 24
        : screen === "tablet"
          ? 26
          : 28,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  if (
    screen === "mobile" ||
    screen === "tablet"
  ) {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };
}

const employeeIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border:
    "1.5px solid rgba(255,255,255,0.34)",
  background:
    "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color:
    "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background:
    "rgba(255,255,255,0.30)",
  flex: "0 0 auto",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color:
    "rgba(255,255,255,0.90)",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
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
  background:
    "rgba(255,255,255,0.075)",
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
  background:
    "rgba(255,255,255,0.045)",
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
  background:
    "rgba(255,255,255,0.035)",
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
  backgroundSize:
    "14px 14px",
  zIndex: 2,
};

const loadingBox: CSSProperties = {
  background: "#eff6ff",
  border:
    "1px solid #bfdbfe",
  borderRadius: 14,
  padding: 15,
  marginBottom: 14,
  color: "#1d4ed8",
  textAlign: "center",
  fontWeight: 900,
};

const errorBox: CSSProperties = {
  background: "#fff7ed",
  border:
    "1px solid #fed7aa",
  borderRadius: 14,
  padding: 14,
  marginBottom: 14,
  color: "#9a3412",
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 12,
  flexWrap: "wrap",
  fontWeight: 900,
};

const retryButton: CSSProperties = {
  minHeight: 38,
  padding: "8px 14px",
  border: "none",
  borderRadius: 10,
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const emptyBox: CSSProperties = {
  background: "#ffffff",
  border:
    "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 24,
  marginBottom: 16,
  color: "#64748b",
  textAlign: "center",
  fontWeight: 900,
};

const printArea: CSSProperties = {
  background: "#ffffff",
  width: "190mm",
  height: "257mm",
  margin: "0 auto",
  overflow: "hidden",
  padding: "7mm",
  borderRadius: 0,
  lineHeight: 1.45,
  color: "#111827",
  boxSizing: "border-box",
  pageBreakInside: "avoid",
  boxShadow:
    "0 14px 35px rgba(15,23,42,0.08)",
};

const documentHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.25fr 1fr 1.25fr",
  alignItems: "start",
  gap: 10,
  marginBottom: 12,
  borderBottom:
    "1.5px solid #111827",
  paddingBottom: 8,
};

const documentHeaderRight: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.65,
  fontWeight: 900,
};

const documentHeaderLeft: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.65,
  textAlign: "left",
  fontWeight: 900,
};

const documentTitle: CSSProperties = {
  textAlign: "center",
  color: "#111827",
  fontSize: 21,
  fontWeight: 900,
  marginTop: 13,
  whiteSpace: "nowrap",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const contentBox: CSSProperties = {
  marginTop: 10,
};

const paragraph: CSSProperties = {
  fontSize: 12.3,
  margin: "6px 0",
  textAlign: "justify",
};

const signatures: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: 16,
  marginTop: 17,
};

const signatureBox: CSSProperties = {
  borderTop:
    "1.5px solid #111827",
  paddingTop: 8,
  lineHeight: 1.65,
  fontSize: 12.2,
  minHeight: 84,
};

const guarantorBox: CSSProperties = {
  marginTop: 14,
  borderTop:
    "1.5px solid #111827",
  paddingTop: 8,
  lineHeight: 1.65,
  fontSize: 12.2,
};

const guarantorGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: "2px 14px",
  marginTop: 4,
  marginBottom: 4,
};

const documentFooter: CSSProperties = {
  marginTop: 18,
  paddingTop: 8,
  borderTop:
    "1px solid #d1d5db",
  display: "flex",
  justifyContent:
    "space-between",
  gap: 10,
  flexWrap: "wrap",
  fontSize: 9.8,
  color: "#64748b",
};

const buttonsArea: CSSProperties = {
  width: "100%",
  maxWidth: 850,
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
  margin: "20px auto 0",
};

const printButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background:
    "linear-gradient(135deg,#0d47a1,#1565c0 55%,#0284c7)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
  boxShadow:
    "0 8px 20px rgba(13,71,161,0.20)",
};

const pdfButton: CSSProperties = {
  ...printButton,
  background:
    "linear-gradient(135deg,#475569,#1e293b)",
  boxShadow:
    "0 8px 20px rgba(30,41,59,0.18)",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "11px 18px",
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};
