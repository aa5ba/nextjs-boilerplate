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

type FinanceSession = {
  id?: string | null;
  user_id?: string | null;
  full_name?: string | null;
  username?: string | null;
  branch_id?: string | null;
  branch_slug?: string | null;
  is_active?: boolean | null;
};

type BranchRecord = {
  id: string;
  branch_slug?: string | null;
  branch_name?: string | null;
  organization_name?: string | null;
  phone?: string | null;
  city?: string | null;
  commercial_record?: string | null;
  is_active?: boolean | null;
};

type ContractRecord = {
  id: string;
  branch_id?: string | null;
  customer_id?: string | null;
  guarantor_customer_id?: string | null;

  contract_number?: string | number | null;
  customer_name?: string | null;
  customer_national_id?: string | null;
  customer_phone?: string | null;
  customer_birth_hijri?: string | null;

  investor_name?: string | null;
  investor_national_id?: string | null;

  product_name?: string | null;
  product_quantity?: number | string | null;

  print_party_type?: string | null;
  print_party_name?: string | null;
  print_party_identifier?: string | null;

  first_party_type?: string | null;
  first_party_name?: string | null;
  first_party_identifier?: string | null;

  debt_amount?: number | string | null;
  payment_amount?: number | string | null;

  payment_due_date?: string | null;
  legal_city?: string | null;
  judicial_amount?: number | string | null;

  contract_issue_date_gregorian?: string | null;
  contract_date_gregorian?: string | null;

  has_deferred_payments?: boolean | null;
  installment_amount?: number | string | null;
  deferred_payments_count?: number | string | null;

  has_guarantor?: boolean | null;
  guarantor_name?: string | null;
  guarantor_national_id?: string | null;
  guarantor_phone?: string | null;
  guarantor_birth_hijri?: string | null;

  notes?: string | null;

  customer?:
    | CustomerRelation
    | CustomerRelation[]
    | null;

  guarantor_customer?:
    | CustomerRelation
    | CustomerRelation[]
    | null;
};

type PromissoryNoteRecord = {
  id: string;
  branch_id?: string | null;
  contract_id?: string | null;

  note_number?: string | number | null;
  amount?: number | string | null;
  due_date?: string | null;

  debtor_name?: string | null;
  debtor_national_id?: string | null;
  debtor_phone?: string | null;

  note_issue_date_gregorian?: string | null;
  note_date_gregorian?: string | null;

  city?: string | null;
  notes?: string | null;

  has_guarantor?: boolean | null;
  guarantor_name?: string | null;
  guarantor_national_id?: string | null;
  guarantor_phone?: string | null;
  guarantor_birth_hijri?: string | null;
};

type OrganizationSettings = {
  name: string;
  phone: string;
  city: string;
  commercialRecord: string;
};

const SESSION_DURATION_MS = 60 * 60 * 1000;
const ACTIVITY_REFRESH_INTERVAL_MS = 60 * 1000;

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

export default function PrintNewRequestPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const branch = String(
    params.branch ?? ""
  ).trim();

  const contractId = String(
    params.contractId ?? ""
  ).trim();

  const noteId = String(
    params.noteId ?? ""
  ).trim();

  const [pageReady, setPageReady] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [contract, setContract] =
    useState<ContractRecord | null>(null);

  const [note, setNote] =
    useState<PromissoryNoteRecord | null>(
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
      const parsed = JSON.parse(
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

        branch_id:
          parsed.branch_id ||
          localStorage.getItem(
            "finance_branch_id"
          ),

        branch_slug:
          parsed.branch_slug ||
          localStorage.getItem(
            "finance_branch_slug"
          ),
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

    const sessionBranchSlug = String(
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

  function getCurrentReturnPath() {
    if (
      typeof window === "undefined"
    ) {
      return (
        pathname ||
        `/finance/${branch}`
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

  const loadData = useCallback(
    async (
      currentBranchId: string,
      isCancelled: () => boolean =
        () => false
    ) => {
      if (
        !currentBranchId ||
        !contractId ||
        !noteId
      ) {
        if (!isCancelled()) {
          setPageError(
            "بيانات العقد أو السند غير مكتملة"
          );

          setLoading(false);
        }

        return;
      }

      setLoading(true);
      setPageError("");

      try {
        const [
          branchResult,
          contractResult,
          noteResult,
        ] = await Promise.all([
          supabase
            .from("finance_branches")
            .select(
              `
                id,
                branch_slug,
                branch_name,
                organization_name,
                phone,
                city,
                commercial_record,
                is_active
              `
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
            .eq(
              "id",
              contractId
            )
            .eq(
              "branch_id",
              currentBranchId
            )
            .maybeSingle(),

          supabase
            .from(
              "finance_promissory_notes"
            )
            .select("*")
            .eq("id", noteId)
            .eq(
              "contract_id",
              contractId
            )
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

        if (noteResult.error) {
          throw new Error(
            noteResult.error.message
          );
        }

        if (!noteResult.data) {
          throw new Error(
            "السند غير موجود أو لا يتبع هذا العقد"
          );
        }

        const branchData =
          branchResult.data as BranchRecord;

        const organizationName =
          branchData.organization_name ||
          localStorage.getItem(
            "finance_organization_name"
          ) ||
          "احتساب";

        setOrganizationSettings({
          name: organizationName,

          phone:
            branchData.phone || "",

          city:
            branchData.city ||
            branchData.branch_name ||
            "",

          commercialRecord:
            branchData.commercial_record ||
            "",
        });

        setContract(
          contractResult.data as ContractRecord
        );

        setNote(
          noteResult.data as PromissoryNoteRecord
        );

        localStorage.setItem(
          "finance_branch_id",
          currentBranchId
        );

        localStorage.setItem(
          "finance_branch_slug",
          branch
        );

        if (organizationName) {
          localStorage.setItem(
            "finance_organization_name",
            organizationName
          );
        }
      } catch (error) {
        if (isCancelled()) {
          return;
        }

        console.error(
          "Print request loading error:",
          error
        );

        setContract(null);
        setNote(null);

        setPageError(
          getErrorMessage(
            error,
            "تعذر تحميل بيانات العقد والسند"
          )
        );
      } finally {
        if (!isCancelled()) {
          setLoading(false);
        }
      }
    },
    [
      branch,
      contractId,
      noteId,
    ]
  );

  useEffect(() => {
    const style =
      document.createElement("style");

    style.innerHTML = `
      @page {
        size: A4 portrait;
        margin: 8mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        overflow-x: hidden;
      }

      button {
        font-family:
          var(--font-almarai),
          sans-serif;
        -webkit-tap-highlight-color:
          transparent;
      }

      @media print {
        html,
        body {
          width: 210mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: visible !important;
          -webkit-print-color-adjust:
            exact !important;
          print-color-adjust:
            exact !important;
        }

        .print-page-main {
          width: 100% !important;
          min-height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          background-image:
            none !important;
        }

        .print-action-buttons,
        .print-loading-message,
        .print-error-message {
          display: none !important;
        }

        .contract-print-area,
        .note-print-area {
          width: 194mm !important;
          height: 281mm !important;
          min-height: 281mm !important;
          max-height: 281mm !important;
          margin: 0 auto !important;
          padding: 6mm !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          page-break-inside:
            avoid !important;
          break-inside:
            avoid-page !important;
        }

        .contract-print-area {
          page-break-after:
            always !important;
          break-after:
            page !important;
        }

        .note-print-area {
          page-break-before:
            auto !important;
          break-before:
            auto !important;
        }

        .print-document-header,
        .print-content-box,
        .print-signatures,
        .print-guarantor-box,
        .print-legal-boxes,
        .print-info-box,
        .print-paragraph {
          page-break-inside:
            avoid !important;
          break-inside:
            avoid-page !important;
        }
      }

      @media screen and (max-width: 850px) {
        .contract-print-area,
        .note-print-area {
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          padding: 18px !important;
        }

        .print-document-header {
          grid-template-columns:
            1fr !important;
          text-align: center !important;
        }

        .print-header-left,
        .print-header-right {
          text-align:
            center !important;
        }

        .print-signatures,
        .print-legal-boxes,
        .print-guarantor-grid {
          grid-template-columns:
            1fr !important;
        }
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      if (
        typeof window === "undefined"
      ) {
        return;
      }

      setPageError("");
      setLoading(true);

      if (
        !branch ||
        !contractId ||
        !noteId
      ) {
        setPageReady(true);
        setPageError(
          "رابط العقد أو السند غير مكتمل"
        );
        setLoading(false);
        return;
      }

      const session =
        readStoredSession();

      if (!isValidSession(session)) {
        redirectToLogin(true);
        return;
      }

      const sessionBranchSlug =
        String(
          session?.branch_slug || ""
        ).trim();

      if (
        sessionBranchSlug !== branch
      ) {
        router.replace(
          `/finance/${sessionBranchSlug}`
        );

        return;
      }

      renewFinanceSession();
      setPageReady(true);

      const storedBranchId = String(
        session?.branch_id ||
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

      localStorage.setItem(
        "finance_branch_id",
        resolvedBranchId
      );

      localStorage.setItem(
        "finance_branch_slug",
        branch
      );

      setBranchId(
        resolvedBranchId
      );

      await loadData(
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
    noteId,
    loadData,
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
  }, [
    pageReady,
    pathname,
  ]);

  function retryLoading() {
    if (!branchId) {
      setPageError(
        "تعذر تحديد الفرع"
      );

      return;
    }

    void loadData(branchId);
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
    const number = Number(
      value || 0
    );

    if (!Number.isFinite(number)) {
      return "0.00";
    }

    return number.toLocaleString(
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

  function isWithoutGuarantor(
    value?: string | null
  ) {
    const normalized = String(
      value || ""
    )
      .trim()
      .toLowerCase();

    if (!normalized) {
      return false;
    }

    return [
      "بدون كفيل",
      "لا يوجد كفيل",
      "لايوجد كفيل",
      "لا يوجد",
      "لايوجد",
      "بدون",
      "none",
      "no guarantor",
    ].includes(normalized);
  }

  function printDocuments() {
    if (
      loading ||
      pageError ||
      !contract ||
      !note
    ) {
      alert(
        "انتظر حتى يكتمل تحميل العقد والسند"
      );

      return;
    }

    renewFinanceSession();
    window.print();
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
    note?.debtor_name ||
    "................";

  const nationalId =
    customer?.national_id ||
    contract?.customer_national_id ||
    note?.debtor_national_id ||
    "................";

  const phone =
    customer?.phone ||
    contract?.customer_phone ||
    note?.debtor_phone ||
    "................";

  const birthHijri =
    customer?.birth_hijri ||
    contract?.customer_birth_hijri ||
    "................";

  const firstPartyType = String(
    contract?.print_party_type ||
      contract?.first_party_type ||
      "organization"
  )
    .trim()
    .toLowerCase();

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

  const noteIssueDate =
    formatDateOnly(
      note?.note_issue_date_gregorian ||
        note?.note_date_gregorian ||
        contract?.contract_issue_date_gregorian ||
        contract?.contract_date_gregorian
    );

  const rawDueDate =
    contract?.payment_due_date ||
    note?.due_date ||
    null;

  const dueDate =
    formatDateOnly(rawDueDate);

  const noteDueDate =
    formatDateOnly(
      note?.due_date ||
        contract?.payment_due_date
    );

  const installmentAmount =
    Number(
      contract?.installment_amount ||
        0
    );

  const deferredPaymentsCount =
    Number(
      contract?.deferred_payments_count ||
        0
    );

  const hasDeferredPayments =
    contract?.has_deferred_payments ===
      true ||
    installmentAmount > 0;

  const rawGuarantorName =
    guarantorCustomer?.full_name ||
    contract?.guarantor_name ||
    note?.guarantor_name ||
    "";

  const hasGuarantorData =
    Boolean(
      contract?.guarantor_customer_id
    ) ||
    Boolean(rawGuarantorName) ||
    contract?.has_guarantor === true ||
    note?.has_guarantor === true;

  const hasGuarantor =
    hasGuarantorData &&
    !isWithoutGuarantor(
      rawGuarantorName
    );

  const guarantorName =
    rawGuarantorName ||
    "................";

  const guarantorNationalId =
    guarantorCustomer?.national_id ||
    contract?.guarantor_national_id ||
    note?.guarantor_national_id ||
    "................";

  const guarantorPhone =
    guarantorCustomer?.phone ||
    contract?.guarantor_phone ||
    note?.guarantor_phone ||
    "................";

  const guarantorBirthHijri =
    guarantorCustomer?.birth_hijri ||
    contract?.guarantor_birth_hijri ||
    note?.guarantor_birth_hijri ||
    "................";

  return (
    <main
      dir="rtl"
      className="print-page-main"
      style={page}
    >
      {loading && (
        <div
          className="print-loading-message"
          style={loadingMessage}
        >
          جاري تحميل بيانات العقد
          والسند...
        </div>
      )}

      {pageError && (
        <div
          className="print-error-message"
          style={errorMessage}
        >
          <span>{pageError}</span>

          <button
            type="button"
            style={retryButton}
            onClick={retryLoading}
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {contract && note && (
        <>
          <section
            className="contract-print-area"
            style={printArea}
          >
            <PrintHeader
              title="عقد اتفاق بيع"
              rightInfo={
                organizationSettings
              }
              leftItems={[
                `رقم العقد: ${
                  contract.contract_number ||
                  "-"
                }`,
                `تاريخ تحرير العقد: ${contractIssueDate}`,
              ]}
            />

            <div
              className="print-content-box"
              style={contentBox}
            >
              <p
                className="print-paragraph"
                style={paragraph}
              >
                الحمد لله والصلاة
                والسلام على من لا نبي
                بعده، وبعد:
              </p>

              <p
                className="print-paragraph"
                style={paragraph}
              >
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

              <p
                className="print-paragraph"
                style={paragraph}
              >
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

              <p
                className="print-paragraph"
                style={paragraph}
              >
                ويلتزم الطرف الثاني
                بسداد مبلغ وقدره /{" "}
                <strong>
                  {formatMoney(
                    contract.payment_amount
                  )}
                </strong>{" "}
                ريال سعودي

                {hasDeferredPayments ? (
                  <>
                    ، على دفعات آجلة
                    قيمة كل دفعة /{" "}
                    <strong>
                      {formatMoney(
                        installmentAmount
                      )}
                    </strong>{" "}
                    ريال سعودي

                    {deferredPaymentsCount >
                      0 && (
                      <>
                        ، وعددها /{" "}
                        <strong>
                          {
                            deferredPaymentsCount
                          }
                        </strong>{" "}
                        دفعات
                      </>
                    )}

                    ، ويكون تاريخ
                    الاستحقاق بتاريخ /{" "}
                    <strong>
                      {dueDate}
                    </strong>
                    .
                  </>
                ) : (
                  <>
                    ، ويكون تاريخ
                    الاستحقاق بتاريخ /{" "}
                    <strong>
                      {dueDate}
                    </strong>
                    .
                  </>
                )}
              </p>

              <p
                className="print-paragraph"
                style={paragraph}
              >
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
                <p
                  className="print-paragraph"
                  style={paragraph}
                >
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

              <p
                className="print-paragraph"
                style={paragraph}
              >
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

              {contract.notes && (
                <p
                  className="print-paragraph"
                  style={paragraph}
                >
                  ملاحظات:{" "}
                  <strong>
                    {contract.notes}
                  </strong>
                </p>
              )}
            </div>

            <div
              className="print-signatures"
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
              <div
                className="print-guarantor-box"
                style={guarantorBox}
              >
                <strong>
                  الكفيل الغارم
                </strong>

                <div
                  className="print-guarantor-grid"
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
                </div>

                <div>
                  التوقيع /
                  ................
                </div>
              </div>
            )}
          </section>

          <section
            className="note-print-area"
            style={secondPrintArea}
          >
            <PrintHeader
              title="سند لأمر"
              rightInfo={
                organizationSettings
              }
              leftItems={[
                `رقم السند: ${
                  note.note_number ||
                  "-"
                }`,
                `تاريخ تحرير السند: ${noteIssueDate}`,
              ]}
            />

            <div
              className="print-content-box"
              style={contentBox}
            >
              <p
                className="print-paragraph"
                style={paragraph}
              >
                بموجب هذا السند أتعهد
                أنا الموقع أدناه بأن
                أدفع لأمر الطرف المستفيد
                /{" "}
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
                ) : null}{" "}
                مبلغًا وقدره{" "}
                <strong>
                  {formatMoney(
                    note.amount ||
                      contract.payment_amount ||
                      contract.debt_amount
                  )}
                </strong>{" "}
                ريال سعودي.
              </p>

              <p
                className="print-paragraph"
                style={paragraph}
              >
                ويستحق هذا المبلغ في
                تاريخ{" "}
                <strong>
                  {noteDueDate}
                </strong>
                ، دون مماطلة أو تأخير،
                ويعد هذا السند التزامًا
                واجب الوفاء حسب الأنظمة
                المعمول بها.
              </p>

              <div
                className="print-info-box"
                style={infoBox}
              >
                <div>
                  اسم المدين /{" "}
                  {note.debtor_name ||
                    customerName}
                </div>

                <div>
                  رقم الهوية /{" "}
                  {note.debtor_national_id ||
                    nationalId}
                </div>

                <div>
                  رقم الجوال /{" "}
                  {note.debtor_phone ||
                    phone}
                </div>

                <div>
                  العنوان /{" "}
                  {note.city ||
                    contract.legal_city ||
                    customer?.address ||
                    "................"}
                </div>
              </div>

              {note.notes && (
                <p
                  className="print-paragraph"
                  style={paragraph}
                >
                  ملاحظات:{" "}
                  <strong>
                    {note.notes}
                  </strong>
                </p>
              )}
            </div>

            <div
              className="print-signatures"
              style={signatures}
            >
              <div style={signatureBox}>
                <strong>المدين</strong>

                <div>
                  الاسم /{" "}
                  {note.debtor_name ||
                    customerName}
                </div>

                <div>
                  رقم الهوية /{" "}
                  {note.debtor_national_id ||
                    nationalId}
                </div>

                <div>
                  الجوال /{" "}
                  {note.debtor_phone ||
                    phone}
                </div>

                <div>
                  التوقيع /
                  ................
                </div>

                <div>
                  البصمة /
                  ................
                </div>
              </div>

              {hasGuarantor && (
                <div style={signatureBox}>
                  <strong>
                    الكفيل
                  </strong>

                  <div>
                    الاسم /{" "}
                    {guarantorName}
                  </div>

                  <div>
                    رقم الهوية /{" "}
                    {
                      guarantorNationalId
                    }
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

                  <div>
                    التوقيع /
                    ................
                  </div>

                  <div>
                    البصمة /
                    ................
                  </div>
                </div>
              )}
            </div>

            <div
              className="print-legal-boxes"
              style={legalBoxes}
            >
              <div style={legalBox}>
                هذا السند واجب الدفع
                بدون تعامل بموجب قرار
                مجلس الوزراء الموقر رقم
                692 بتاريخ 1383/9/26 هـ
                والمتوج بالمرسوم الملكي
                الكريم رقم 37 بتاريخ
                1383/10/11 هـ نظام
                الأوراق التجارية.
              </div>

              <div style={legalBox}>
                بموجب هذا السند يحق
                لطالب الدين والكفيل
                الغارم حقوق التقدم
                والمطالبة والاحتجاج
                والإخطار بالامتناع عن
                الوفاء والمتعلقة بهذا
                السند، كما يجوز لمدعي
                موجب هذا السند الرجوع
                للمدين أو الكفيل الغارم
                منفردين أو مجتمعين ودون
                مراعاة أو ترتيب.
              </div>
            </div>
          </section>
        </>
      )}

      <div
        className="print-action-buttons"
        style={actionButtons}
      >
        <button
          type="button"
          style={{
            ...printButton,

            opacity:
              loading ||
              Boolean(pageError) ||
              !contract ||
              !note
                ? 0.6
                : 1,

            cursor:
              loading ||
              Boolean(pageError) ||
              !contract ||
              !note
                ? "not-allowed"
                : "pointer",
          }}
          disabled={
            loading ||
            Boolean(pageError) ||
            !contract ||
            !note
          }
          onClick={printDocuments}
        >
          🖨️ طباعة العقد والسند
        </button>

        <button
          type="button"
          style={backButton}
          onClick={() =>
            router.back()
          }
        >
          ← رجوع
        </button>
      </div>
    </main>
  );
}

function PrintHeader({
  title,
  rightInfo,
  leftItems,
}: {
  title: string;
  rightInfo: OrganizationSettings;
  leftItems: string[];
}) {
  return (
    <div
      className="print-document-header"
      style={header}
    >
      <div
        className="print-header-right"
        style={headerRight}
      >
        <div>
          المملكة العربية السعودية
        </div>

        <div>
          {rightInfo.city ||
            "................"}
        </div>

        <div>
          {rightInfo.name ||
            "................"}
        </div>

        {rightInfo.commercialRecord && (
          <div>
            سجل تجاري رقم /{" "}
            {
              rightInfo.commercialRecord
            }
          </div>
        )}

        {rightInfo.phone && (
          <div>
            رقم التواصل /{" "}
            {rightInfo.phone}
          </div>
        )}
      </div>

      <div style={documentTitle}>
        {title}
      </div>

      <div
        className="print-header-left"
        style={headerLeft}
      >
        {leftItems.map(
          (item, index) => (
            <div
              key={`${item}-${index}`}
            >
              {item}
            </div>
          )
        )}
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

const page: CSSProperties = {
  minHeight: "100dvh",
  padding: 20,
  color: "#111827",
  fontFamily:
    "var(--font-almarai), sans-serif",

  backgroundColor: "#edf4fb",

  backgroundImage: `
    radial-gradient(
      circle at 13% 15%,
      rgba(14,165,233,0.15),
      transparent 31%
    ),
    radial-gradient(
      circle at 87% 80%,
      rgba(37,99,235,0.13),
      transparent 34%
    ),
    linear-gradient(
      rgba(241,247,253,0.88),
      rgba(234,243,251,0.92)
    ),
    url("/backgrounds/v13-finance-bg-1.png")
  `,

  backgroundSize:
    "auto, auto, auto, cover",

  backgroundPosition: "center",

  backgroundRepeat: "no-repeat",

  backgroundAttachment: "fixed",
};

const loadingMessage: CSSProperties = {
  width: "100%",
  maxWidth: 850,
  margin: "20px auto",
  padding: 18,
  borderRadius: 14,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  textAlign: "center",
  fontWeight: 900,
};

const errorMessage: CSSProperties = {
  width: "100%",
  maxWidth: 850,
  margin: "20px auto",
  padding: 16,
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fff7f7",
  color: "#991b1b",
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: 12,
  flexWrap: "wrap",
  fontWeight: 900,
};

const retryButton: CSSProperties = {
  minHeight: 40,
  padding: "9px 15px",
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

const printArea: CSSProperties = {
  width: "194mm",
  height: "281mm",
  minHeight: "281mm",
  maxHeight: "281mm",

  margin: "0 auto",
  padding: "6mm",

  overflow: "hidden",

  background: "#ffffff",
  color: "#111827",

  borderRadius: 0,

  lineHeight: 1.45,

  boxSizing: "border-box",

  pageBreakInside: "avoid",

  boxShadow:
    "0 14px 35px rgba(15,23,42,0.10)",
};

const secondPrintArea: CSSProperties = {
  ...printArea,

  marginTop: 20,
};

const header: CSSProperties = {
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

const headerRight: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.65,
  fontWeight: 900,
};

const headerLeft: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.65,
  textAlign: "left",
  fontWeight: 900,
};

const documentTitle: CSSProperties = {
  marginTop: 13,

  textAlign: "center",

  color: "#111827",

  fontSize: 21,

  fontWeight: 900,

  whiteSpace: "nowrap",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const contentBox: CSSProperties = {
  marginTop: 10,
};

const paragraph: CSSProperties = {
  margin: "6px 0",

  fontSize: 12.3,

  lineHeight: 1.58,

  textAlign: "justify",
};

const infoBox: CSSProperties = {
  marginTop: 10,

  padding: 9,

  border: "1px solid #d1d5db",

  borderRadius: 8,

  lineHeight: 1.65,

  fontSize: 12.2,
};

const signatures: CSSProperties = {
  display: "grid",

  gridTemplateColumns: "1fr 1fr",

  gap: 16,

  marginTop: 17,
};

const signatureBox: CSSProperties = {
  minHeight: 84,

  paddingTop: 8,

  borderTop:
    "1.5px solid #111827",

  lineHeight: 1.65,

  fontSize: 12.2,
};

const guarantorBox: CSSProperties = {
  marginTop: 14,

  paddingTop: 8,

  borderTop:
    "1.5px solid #111827",

  lineHeight: 1.65,

  fontSize: 12.2,
};

const guarantorGrid: CSSProperties = {
  display: "grid",

  gridTemplateColumns: "1fr 1fr",

  gap: "2px 14px",

  marginTop: 4,
};

const legalBoxes: CSSProperties = {
  display: "grid",

  gridTemplateColumns: "1fr 1fr",

  gap: 12,

  marginTop: 20,
};

const legalBox: CSSProperties = {
  padding: 9,

  border: "1.5px solid #111827",

  borderRadius: 12,

  fontSize: 10.5,

  lineHeight: 1.65,

  textAlign: "center",

  fontWeight: 900,
};

const actionButtons: CSSProperties = {
  width: "100%",

  maxWidth: 850,

  margin: "20px auto 0",

  display: "grid",

  gap: 12,
};

const printButton: CSSProperties = {
  width: "100%",

  minHeight: 52,

  padding: 16,

  border: "none",

  borderRadius: 14,

  background:
    "linear-gradient(135deg,#0d47a1,#1565c0 55%,#0284c7)",

  color: "#ffffff",

  fontSize: 17,

  fontWeight: 900,

  fontFamily:
    "var(--font-almarai), sans-serif",

  boxShadow:
    "0 8px 20px rgba(13,71,161,0.20)",
};

const backButton: CSSProperties = {
  width: "100%",

  minHeight: 48,

  padding: "13px 16px",

  border: "none",

  borderRadius: 14,

  background:
    "linear-gradient(135deg,#22c55e,#15803d)",

  color: "#ffffff",

  fontSize: 15,

  fontWeight: 900,

  cursor: "pointer",

  fontFamily:
    "var(--font-almarai), sans-serif",

  boxShadow:
    "0 7px 18px rgba(22,163,74,0.20)",
};
