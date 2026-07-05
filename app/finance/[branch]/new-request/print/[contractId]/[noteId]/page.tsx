
"use client";

import {
  useCallback,
  useEffect,
  useRef,
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

type BeneficiaryType =
  | "organization"
  | "investor"
  | "other";

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
  organization_phone?: string | null;
  phone?: string | null;
  organization_address?: string | null;
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
  customer_id?: string | null;

  note_number?: string | number | null;
  note_mode?: string | null;

  beneficiary_type?: BeneficiaryType | null;
  beneficiary_investor_id?: string | null;
  beneficiary_customer_id?: string | null;
  beneficiary_name?: string | null;
  beneficiary_identifier?: string | null;
  beneficiary_phone?: string | null;
  beneficiary_birth_date_type?: string | null;
  beneficiary_birth_hijri?: string | null;
  beneficiary_birth_gregorian?: string | null;
  beneficiary_nationality?: string | null;
  beneficiary_address?: string | null;
  beneficiary_work_name?: string | null;
  beneficiary_identity_source?: string | null;
  beneficiary_notes?: string | null;

  debtor_name?: string | null;
  debtor_national_id?: string | null;
  debtor_phone?: string | null;
  debtor_birth_date_type?: string | null;
  debtor_birth_hijri?: string | null;
  debtor_birth_gregorian?: string | null;
  debtor_nationality?: string | null;
  debtor_address?: string | null;
  debtor_work_name?: string | null;
  debtor_identity_source?: string | null;
  debtor_notes?: string | null;

  amount?: number | string | null;
  amount_words?: string | null;

  city?: string | null;
  notes?: string | null;
  status?: string | null;

  due_date?: string | null;
  due_phrase?: string | null;

  note_issue_date_gregorian?: string | null;
  note_issue_date_hijri?: string | null;
  note_date_gregorian?: string | null;
  note_date_hijri?: string | null;

  has_guarantor?: boolean | null;
  guarantor_customer_id?: string | null;
  guarantor_name?: string | null;
  guarantor_national_id?: string | null;
  guarantor_phone?: string | null;
  guarantor_work_name?: string | null;
  guarantor_birth_date_type?: string | null;
  guarantor_birth_hijri?: string | null;
  guarantor_birth_gregorian?: string | null;
  guarantor_nationality?: string | null;
  guarantor_address?: string | null;
  guarantor_identity_source?: string | null;
  guarantor_notes?: string | null;

  created_by?: string | null;
  created_at?: string | null;

  legal_body_text?: string | null;
  legal_footer_text?: string | null;
};

type OrganizationSettings = {
  name: string;
  phone: string;
  city: string;
  commercialRecord: string;
};

type ActionFeedback = {
  type: "success" | "info" | "error";
  message: string;
};

type PdfGenerationResult = {
  blob: Blob;
  fileName: string;
};

type PdfGenerationOptions = {
  autoPrint?: boolean;
};

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

const LEGAL_FOOTER_TEXT =
  "هذا السند واجب الدفع بموجب قرار مجلس الوزراء رقم ٦٩٢ و تاريخ ٢٦ / ٩ / ١٣٨٣ هـ\nوالمتوج بالمرسوم الملكي رقم ٣٧ و تاريخ ١١ / ١٠ / ١٣٨٣ هـ / نظام الأوراق التجاريه - ويسري على هذا السند جميع القرارات والأنظمه والتنظيمات في المملكة العربية السعودية";

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

  const contractPrintRef =
    useRef<HTMLElement | null>(null);

  const notePrintRef =
    useRef<HTMLElement | null>(null);

  const [pageReady, setPageReady] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [branchData, setBranchData] =
    useState<BranchRecord | null>(null);

  const [contract, setContract] =
    useState<ContractRecord | null>(null);

  const [note, setNote] =
    useState<PromissoryNoteRecord | null>(
      null
    );

  const [printingPdf, setPrintingPdf] =
    useState(false);

  const [savingPdf, setSavingPdf] =
    useState(false);

  const [sharingWhatsapp, setSharingWhatsapp] =
    useState(false);

  const [actionFeedback, setActionFeedback] =
    useState<ActionFeedback | null>(null);

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

  function clearFinanceSession({
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

    clearFinanceSession({
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
      setActionFeedback(null);

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
                organization_phone,
                phone,
                organization_address,
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
            .select(
              `
                id,
                note_number,
                branch_id,
                contract_id,
                customer_id,
                note_mode,

                beneficiary_type,
                beneficiary_investor_id,
                beneficiary_customer_id,
                beneficiary_name,
                beneficiary_identifier,
                beneficiary_phone,
                beneficiary_birth_date_type,
                beneficiary_birth_hijri,
                beneficiary_birth_gregorian,
                beneficiary_nationality,
                beneficiary_address,
                beneficiary_work_name,
                beneficiary_identity_source,
                beneficiary_notes,

                debtor_name,
                debtor_national_id,
                debtor_phone,
                debtor_birth_date_type,
                debtor_birth_hijri,
                debtor_birth_gregorian,
                debtor_nationality,
                debtor_address,
                debtor_work_name,
                debtor_identity_source,
                debtor_notes,

                amount,
                amount_words,
                city,
                notes,
                status,
                due_date,
                due_phrase,

                note_issue_date_gregorian,
                note_issue_date_hijri,
                note_date_gregorian,
                note_date_hijri,

                has_guarantor,
                guarantor_customer_id,
                guarantor_name,
                guarantor_national_id,
                guarantor_phone,
                guarantor_work_name,
                guarantor_birth_date_type,
                guarantor_birth_hijri,
                guarantor_birth_gregorian,
                guarantor_nationality,
                guarantor_address,
                guarantor_identity_source,
                guarantor_notes,

                created_by,
                created_at,
                legal_body_text,
                legal_footer_text
              `
            )
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

        const loadedBranch =
          branchResult.data as BranchRecord;

        const organizationName =
          loadedBranch.organization_name ||
          localStorage.getItem(
            "finance_organization_name"
          ) ||
          "احتساب";

        setBranchData(loadedBranch);

        setOrganizationSettings({
          name: organizationName,

          phone:
            loadedBranch.organization_phone ||
            loadedBranch.phone ||
            "",

          city:
            loadedBranch.city ||
            loadedBranch.branch_name ||
            "",

          commercialRecord:
            loadedBranch.commercial_record ||
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

      if (!session) {
        redirectToLogin(true);
        return;
      }

      if (
        session.is_active === false
      ) {
        redirectToLogin(true);
        return;
      }

      const employeeId = String(
        session.id ||
          session.user_id ||
          localStorage.getItem(
            "finance_user_id"
          ) ||
          ""
      ).trim();

      if (!employeeId) {
        redirectToLogin(true);
        return;
      }

      const storedBranchSlug =
        String(
          session.branch_slug ||
            localStorage.getItem(
              "finance_branch_slug"
            ) ||
            ""
        ).trim();

      if (
        storedBranchSlug &&
        storedBranchSlug !== branch
      ) {
        router.replace(
          `/finance/${storedBranchSlug}`
        );

        return;
      }

      setPageReady(true);

      let resolvedBranchId =
        String(
          session.branch_id ||
            localStorage.getItem(
              "finance_branch_id"
            ) ||
            ""
        ).trim();

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
    const style =
      document.createElement("style");

    style.setAttribute(
      "data-contract-note-print",
      "true"
    );

    style.innerHTML = `
      @page {
        size: A4 portrait;
        margin: 0;
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

      .document-action-grid {
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
      }

      @media print {
        html,
        body {
          width: 210mm !important;
          height: auto !important;
          min-height: 0 !important;
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
          display: block !important;
          width: 210mm !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          background-image:
            none !important;
          overflow: visible !important;
        }

        .print-action-buttons,
        .print-action-feedback,
        .print-loading-message,
        .print-error-message {
          display: none !important;
        }

        .contract-print-area,
        .note-print-area {
          position: relative !important;
          display: block !important;
          width: 210mm !important;
          height: 296mm !important;
          min-height: 296mm !important;
          max-height: 296mm !important;
          margin: 0 !important;
          padding: 6mm 9mm !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          page-break-inside:
            auto !important;
          break-inside:
            auto !important;
        }

        .contract-print-area {
          page-break-after:
            always !important;
          break-after:
            page !important;
        }

        .note-print-area {
          display: flex !important;
          flex-direction:
            column !important;
          page-break-before:
            auto !important;
          break-before:
            auto !important;
          page-break-after:
            auto !important;
          break-after:
            auto !important;
        }

        .print-document-header,
        .print-content-box,
        .print-signatures,
        .print-guarantor-box,
        .note-document-header,
        .note-legal-body,
        .note-party-grid,
        .note-signature-grid,
        .note-guarantor-box,
        .note-legal-footer {
          page-break-inside:
            auto !important;
          break-inside:
            auto !important;
        }

        .print-document-header {
          margin-bottom: 8px !important;
          padding-bottom: 6px !important;
        }

        .print-content-box {
          margin-top: 6px !important;
        }

        .contract-print-area p {
          margin: 4px 0 !important;
          font-size: 12.8px !important;
          line-height: 1.42 !important;
          orphans: 1 !important;
          widows: 1 !important;
        }

        .print-signatures {
          margin-top: 12px !important;
          gap: 12px !important;
        }

        .print-signatures > div {
          min-height: 72px !important;
          padding-top: 6px !important;
          font-size: 12.3px !important;
          line-height: 1.48 !important;
        }

        .note-document-title {
          margin: 3mm 0 2mm !important;
          font-size: 22pt !important;
        }

        .note-document-header {
          flex: 0 0 auto !important;
        }

        .note-legal-body {
          margin-top: 1.5mm !important;
          flex: 0 0 auto !important;
        }

        .note-legal-body p {
          margin: 0.6mm 0 !important;
          font-size: 10.1pt !important;
          line-height: 1.43 !important;
          orphans: 1 !important;
          widows: 1 !important;
        }

        .note-party-grid {
          margin-top: 2mm !important;
          gap: 3mm !important;
          flex: 0 0 auto !important;
        }

        .note-party-grid > div {
          padding: 2.2mm 3mm !important;
        }

        .note-signature-grid {
          margin-top: 2.5mm !important;
          gap: 4mm !important;
          flex: 0 0 auto !important;
        }

        .note-signature-grid > div {
          min-height: 16mm !important;
          padding-top: 1.5mm !important;
        }

        .note-guarantor-box {
          margin-top: 2mm !important;
          padding: 2mm 3mm !important;
          flex: 0 0 auto !important;
        }

        .note-legal-footer {
          margin-top: auto !important;
          margin-bottom: 8mm !important;
          padding: 2.4mm 3mm !important;
          font-size: 8.6pt !important;
          line-height: 1.45 !important;
          transform:
            translateY(-2mm) !important;
          flex: 0 0 auto !important;
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
        .print-guarantor-grid,
        .note-party-grid,
        .note-guarantor-grid {
          grid-template-columns:
            1fr !important;
        }

        .document-action-grid {
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

  async function printDocuments() {
    if (
      loading ||
      pageError ||
      !contract ||
      !note
    ) {
      setActionFeedback({
        type: "error",
        message:
          "انتظر حتى يكتمل تحميل العقد والسند.",
      });

      return;
    }

    if (!isSafariBrowser()) {
      setActionFeedback(null);
      window.print();
      return;
    }

    if (printingPdf) {
      return;
    }

    const printWindow =
      window.open(
        "",
        "_blank"
      );

    if (!printWindow) {
      setActionFeedback({
        type: "error",
        message:
          "تعذر فتح نافذة الطباعة في Safari. اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مرة أخرى.",
      });

      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width,initial-scale=1"
          />
          <title>جاري تجهيز ملف الطباعة</title>
          <style>
            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              min-height: 100%;
            }

            body {
              min-height: 100vh;
              display: grid;
              place-items: center;
              padding: 24px;
              background: #f8fafc;
              color: #0f172a;
              font-family: Arial, sans-serif;
            }

            .message {
              width: min(520px, 100%);
              padding: 24px;
              border: 1px solid #bfdbfe;
              border-radius: 18px;
              background: #ffffff;
              text-align: center;
              font-size: 18px;
              font-weight: 700;
              line-height: 1.8;
              box-shadow: 0 16px 40px rgba(15, 23, 42, 0.1);
            }
          </style>
        </head>
        <body>
          <div class="message">
            جاري إنشاء ملف PDF ثابت من صفحتين وفتحه للطباعة في Safari...
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    try {
      printWindow.opener = null;
    } catch {
      // بعض إصدارات Safari تمنع تعديل opener، ولا يؤثر ذلك على الطباعة.
    }

    setPrintingPdf(true);
    setActionFeedback(null);

    try {
      const { blob } =
        await createDocumentsPdf({
          autoPrint: true,
        });

      const pdfUrl =
        URL.createObjectURL(blob);

      printWindow.location.replace(
        pdfUrl
      );

      printWindow.focus();

      window.setTimeout(() => {
        URL.revokeObjectURL(
          pdfUrl
        );
      }, 120_000);

      setActionFeedback({
        type: "success",
        message:
          "تم فتح ملف PDF ثابت من صفحتين للطباعة في Safari.",
      });
    } catch (error) {
      printWindow.close();

      console.error(
        "Opening Safari printable PDF failed:",
        error
      );

      setActionFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "تعذر إنشاء ملف الطباعة في Safari"
        ),
      });
    } finally {
      setPrintingPdf(false);
    }
  }

  async function createDocumentsPdf(
    options: PdfGenerationOptions = {}
  ): Promise<PdfGenerationResult> {
    const contractElement =
      contractPrintRef.current;

    const noteElement =
      notePrintRef.current;

    if (
      !contract ||
      !note ||
      !contractElement ||
      !noteElement
    ) {
      throw new Error(
        "تعذر العثور على صفحات العقد والسند لإنشاء الملف"
      );
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const [
      html2canvasModule,
      jsPdfModule,
    ] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const html2canvas =
      html2canvasModule.default;

    const { jsPDF } = jsPdfModule;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pages = [
      {
        element: contractElement,
        pageKey: "contract",
      },
      {
        element: noteElement,
        pageKey: "note",
      },
    ];

    for (
      let index = 0;
      index < pages.length;
      index += 1
    ) {
      const currentPage = pages[index];

      const canvas = await html2canvas(
        currentPage.element,
        {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 1400,
          windowHeight: 1300,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDocument) => {
            clonedDocument.documentElement.style.background =
              "#ffffff";

            clonedDocument.body.style.background =
              "#ffffff";

            const clonedPage =
              clonedDocument.querySelector<HTMLElement>(
                `[data-pdf-page="${currentPage.pageKey}"]`
              );

            if (!clonedPage) {
              return;
            }

            clonedPage.style.width =
              "210mm";
            clonedPage.style.height =
              "297mm";
            clonedPage.style.minHeight =
              "297mm";
            clonedPage.style.maxHeight =
              "297mm";
            clonedPage.style.margin = "0";
            clonedPage.style.boxShadow =
              "none";
            clonedPage.style.border =
              "none";
            clonedPage.style.borderRadius =
              "0";
            clonedPage.style.overflow =
              "hidden";
            clonedPage.style.background =
              "#ffffff";
          },
        }
      );

      if (index > 0) {
        pdf.addPage("a4", "portrait");
      }

      const imageData =
        canvas.toDataURL(
          "image/jpeg",
          0.96
        );

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const canvasRatio =
        canvas.width / canvas.height;

      let imageWidth = pageWidth;
      let imageHeight =
        imageWidth / canvasRatio;

      if (imageHeight > pageHeight) {
        imageHeight = pageHeight;
        imageWidth =
          imageHeight * canvasRatio;
      }

      const imageX =
        (pageWidth - imageWidth) / 2;

      const imageY =
        (pageHeight - imageHeight) / 2;

      pdf.addImage(
        imageData,
        "JPEG",
        imageX,
        imageY,
        imageWidth,
        imageHeight,
        undefined,
        "FAST"
      );
    }

    if (options.autoPrint) {
      const printablePdf =
        pdf as typeof pdf & {
          autoPrint?: (
            options?: {
              variant?:
                | "non-conform"
                | "javascript";
            }
          ) => void;
        };

      printablePdf.autoPrint?.({
        variant: "non-conform",
      });
    }

    const fileName =
      buildDocumentsPdfFileName(
        contract.contract_number,
        note.note_number
      );

    return {
      blob: pdf.output("blob"),
      fileName,
    };
  }

  async function saveDocumentsPdf() {
    if (
      loading ||
      pageError ||
      !contract ||
      !note
    ) {
      setActionFeedback({
        type: "error",
        message:
          "انتظر حتى يكتمل تحميل العقد والسند.",
      });

      return;
    }

    if (savingPdf) {
      return;
    }

    setSavingPdf(true);
    setActionFeedback(null);

    try {
      const { blob, fileName } =
        await createDocumentsPdf();

      downloadBlob(blob, fileName);

      setActionFeedback({
        type: "success",
        message:
          "تم إنشاء ملف PDF واحد يحتوي على العقد والسند وحفظه بنجاح.",
      });
    } catch (error) {
      console.error(
        "Saving contract PDF failed:",
        error
      );

      setActionFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "تعذر إنشاء ملف PDF"
        ),
      });
    } finally {
      setSavingPdf(false);
    }
  }

  async function shareDocumentsOnWhatsapp() {
    if (
      loading ||
      pageError ||
      !contract ||
      !note
    ) {
      setActionFeedback({
        type: "error",
        message:
          "انتظر حتى يكتمل تحميل العقد والسند.",
      });

      return;
    }

    if (sharingWhatsapp) {
      return;
    }

    const customerRelation =
      getSingleRelation(
        contract.customer
      );

    const customerDisplayName =
      customerRelation?.full_name ||
      contract.customer_name ||
      note.debtor_name ||
      "العميل";

    const contractNumber =
      String(
        contract.contract_number ||
          "-"
      );

    const noteNumber =
      formatNoteNumber(
        note.note_number
      );

    setSharingWhatsapp(true);
    setActionFeedback(null);

    try {
      const { blob, fileName } =
        await createDocumentsPdf();

      const pdfFile = new File(
        [blob],
        fileName,
        {
          type: "application/pdf",
          lastModified: Date.now(),
        }
      );

      const shareData: ShareData = {
        files: [pdfFile],

        title:
          `العقد رقم ${contractNumber} والسند رقم ${noteNumber}`,
      };

      const canSharePdf =
        typeof navigator !==
          "undefined" &&
        typeof navigator.share ===
          "function" &&
        typeof navigator.canShare ===
          "function" &&
        navigator.canShare(
          shareData
        );

      if (!canSharePdf) {
        downloadBlob(
          blob,
          fileName
        );

        setActionFeedback({
          type: "info",
          message:
            "هذا المتصفح لا يدعم مشاركة ملفات PDF مباشرة. تم حفظ الملف على الجهاز، ويمكنك مشاركته من تطبيق الملفات.",
        });

        return;
      }

      await navigator.share(
        shareData
      );

      setActionFeedback({
        type: "success",
        message:
          `تم فتح نافذة مشاركة ملف PDF. اختر واتساب ثم أرسل الملف إلى ${customerDisplayName}.`,
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setActionFeedback({
          type: "info",
          message:
            "تم إلغاء مشاركة ملف PDF.",
        });

        return;
      }

      console.error(
        "WhatsApp PDF sharing failed:",
        error
      );

      setActionFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "تعذر إنشاء ملف العقد والسند أو مشاركته"
        ),
      });
    } finally {
      setSharingWhatsapp(false);
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
    formatHijriDate(
      customer?.birth_hijri ||
        contract?.customer_birth_hijri
    );

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

  const contractFirstPartyName =
    organizationSettings.name ||
    "................";

  const contractFirstPartyIdentifier =
    organizationSettings.commercialRecord ||
    "................";

  const rawContractPaymentAmount =
    Number(
      contract?.payment_amount ||
        0
    );

  const contractPaymentAmount =
    Number.isFinite(
      rawContractPaymentAmount
    )
      ? rawContractPaymentAmount
      : 0;

  const contractPaymentAmountWords =
    amountToArabicWords(
      contractPaymentAmount
    );

  const contractIssueDate =
    formatDateOnly(
      contract?.contract_issue_date_gregorian ||
        contract?.contract_date_gregorian
    );

  const noteIssueDate =
    note?.note_issue_date_gregorian ||
    note?.note_date_gregorian ||
    note?.created_at ||
    contract?.contract_issue_date_gregorian ||
    contract?.contract_date_gregorian ||
    null;

  const rawDueDate =
    contract?.payment_due_date ||
    note?.due_date ||
    null;

  const dueDate =
    formatDateOnly(rawDueDate);

  const noteDueDateDisplay =
    rawDueDate
      ? dueDate
      : "عند الطلب";

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
    formatHijriDate(
      guarantorCustomer?.birth_hijri ||
        contract?.guarantor_birth_hijri ||
        note?.guarantor_birth_hijri
    );

  const beneficiaryName =
    note?.beneficiary_name?.trim() ||
    firstPartyName ||
    "................";

  const beneficiaryIdentifier =
    note?.beneficiary_identifier?.trim() ||
    firstPartyIdentifier ||
    "";

  const beneficiaryIdentifierLabel =
    note?.beneficiary_type ===
      "organization" ||
    (!note?.beneficiary_type &&
      !isInvestorParty)
      ? "السجل التجاري"
      : "رقم الهوية";

  const noteAmount = Number(
    contract?.payment_amount ||
      contract?.debt_amount ||
      note?.amount ||
      0
  );

  const safeNoteAmount =
    Number.isFinite(noteAmount)
      ? noteAmount
      : 0;

  const amountWords =
    amountToArabicWords(
      safeNoteAmount
    );

  const legalCity = String(
    contract?.legal_city || ""
  ).trim();

  const noteCity =
    note?.city ||
    contract?.legal_city ||
    branchData?.city ||
    branchData?.branch_name ||
    "................";

  const documentsUnavailable =
    loading ||
    Boolean(pageError) ||
    !contract ||
    !note;

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

      <div
        className="print-action-buttons"
        style={actionButtons}
        role="toolbar"
        aria-label="خيارات الطباعة والمشاركة"
      >
        <div
          className="document-action-grid"
          style={documentActionGrid}
        >
          <button
            type="button"
            style={getActionButtonStyle(
              printButton,
              documentsUnavailable ||
                printingPdf
            )}
            disabled={
              documentsUnavailable ||
              printingPdf
            }
            onClick={() =>
              void printDocuments()
            }
          >
            {printingPdf
              ? "جاري تجهيز الطباعة..."
              : "طباعة"}
          </button>

          <button
            type="button"
            style={getActionButtonStyle(
              saveButton,
              documentsUnavailable ||
                savingPdf
            )}
            disabled={
              documentsUnavailable ||
              savingPdf
            }
            onClick={() =>
              void saveDocumentsPdf()
            }
          >
            {savingPdf
              ? "جاري إنشاء الملف..."
              : "حفظ الملف PDF"}
          </button>

          <button
            type="button"
            style={getActionButtonStyle(
              whatsappButton,
              documentsUnavailable ||
                sharingWhatsapp
            )}
            disabled={
              documentsUnavailable ||
              sharingWhatsapp
            }
            onClick={() =>
              void shareDocumentsOnWhatsapp()
            }
          >
            {sharingWhatsapp
              ? "جاري تجهيز ملف PDF..."
              : "مشاركة PDF عبر واتساب"}
          </button>
        </div>

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

      {actionFeedback && (
        <div
          className="print-action-feedback"
          role={
            actionFeedback.type ===
            "error"
              ? "alert"
              : "status"
          }
          style={getActionFeedbackStyle(
            actionFeedback.type
          )}
        >
          {actionFeedback.message}
        </div>
      )}


      {contract && note && (
        <>
          <section
            ref={contractPrintRef}
            data-pdf-page="contract"
            className="contract-print-area"
            style={contractPrintArea}
          >
            <ContractPrintHeader
              title="عقد بيع * شراء"
              rightInfo={
                organizationSettings
              }
              contractNumber={
                contract.contract_number
              }
              contractIssueDate={
                contractIssueDate
              }
            />

            <div
              className="print-content-box"
              style={contractContentBox}
            >
              <p style={contractParagraph}>
                الحمد لله والصلاة
                والسلام على من لا نبي
                بعده، وبعد:
              </p>

              <p style={contractParagraph}>
                أقر أنا الموقع أدناه
                الطرف الثاني /{" "}
                <strong>
                  {customerName}
                </strong>
                ، رقم الهوية /{" "}
                <strong>
                  {nationalId}
                </strong>
                {" - "}تاريخ الميلاد /{" "}
                <strong
                  style={numericDateText}
                >
                  {birthHijri}
                </strong>
                ، رقم الجوال /{" "}
                <strong>{phone}</strong>
                ، بأني اشتريت من الطرف
                الأول /{" "}
                <strong>
                  {contractFirstPartyName}
                </strong>
                ، سجل تجاري رقم /{" "}
                <strong>
                  {
                    contractFirstPartyIdentifier
                  }
                </strong>
                . بمبلغ وقدره /{" "}
                <strong>
                  {formatMoney(
                    contractPaymentAmount
                  )}
                </strong>{" "}
                ريال سعودي (
                <strong>
                  {
                    contractPaymentAmountWords
                  }
                </strong>
                ).
              </p>

              <p style={contractParagraph}>
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
                .
              </p>

              <p style={contractParagraph}>
                ويلتزم الطرف الثاني
                بسداد مبلغ الشراء وقدره
                /{" "}
                <strong>
                  {formatMoney(
                    contractPaymentAmount
                  )}
                </strong>{" "}
                ريال سعودي (
                <strong>
                  {
                    contractPaymentAmountWords
                  }
                </strong>
                )، وأن يكون
                تاريخ السداد بتاريخ /{" "}
                <strong
                  style={numericDateText}
                >
                  {dueDate}
                </strong>
                .
              </p>

              {legalCity && (
                <p style={contractParagraph}>
                  وأن تكون مدينة التقاضي
                  في حال المطالبة /{" "}
                  <strong>
                    {legalCity}
                  </strong>
                  .
                </p>
              )}

              <p style={contractParagraph}>
                كما يقر الطرف الثاني
                بأنه اطلع على كامل بنود
                هذا العقد، وأنه قبل
                الشراء وأنه ملتزم
                بالسداد في الموعد
                المتفق عليه والمذكور
                في هذا العقد، وفي حال
                التأخر يحق للطرف الأول
                اتخاذ الإجراءات النظامية
                اللازمة للمطالبة بكامل
                المبلغ المتبقي.
              </p>
            </div>

            <div
              className="print-signatures"
              style={contractSignatures}
            >
              <div
                style={contractSignatureBox}
              >
                <strong>
                  الطرف الأول البائع
                </strong>

                <div>
                  الاسم /{" "}
                  {contractFirstPartyName}
                </div>

                <div>
                  سجل تجاري رقم /{" "}
                  {
                    contractFirstPartyIdentifier
                  }
                </div>

                <div>
                  التوقيع /
                  ................
                </div>
              </div>

              <div
                style={contractSignatureBox}
              >
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
                style={
                  contractGuarantorBox
                }
              >
                <strong>
                  الكفيل الغارم
                </strong>

                <div
                  className="print-guarantor-grid"
                  style={
                    contractGuarantorGrid
                  }
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
                    <span
                      style={
                        numericDateText
                      }
                    >
                      {
                        guarantorBirthHijri
                      }
                    </span>
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
            ref={notePrintRef}
            data-pdf-page="note"
            className="note-print-area"
            style={notePrintArea}
          >
            <header
              className="note-document-header"
              style={noteDocumentHeader}
            >
              <div
                style={noteTopRow}
              >
                <div
                  style={
                    noteCountryBlock
                  }
                >
                  <strong>
                    المملكة العربية
                    السعودية
                  </strong>

                  <span>
                    {branchData?.city ||
                      branchData?.branch_name ||
                      "................"}
                  </span>
                </div>

                <div
                  style={noteTopMeta}
                >
                  <span>
                    رقم السند:{" "}
                    <strong>
                      {formatNoteNumber(
                        note.note_number ??
                          null
                      )}
                    </strong>
                  </span>

                  <span>
                    تاريخ التحرير:{" "}
                    <strong>
                      {formatDisplayDate(
                        noteIssueDate
                      )}
                    </strong>
                  </span>
                </div>
              </div>

              <h1
                style={noteDocumentTitle}
              >
                سند لأمر
              </h1>

              <div
                style={
                  noteDocumentAmountBox
                }
              >
                <span
                  style={
                    noteDocumentAmountLabel
                  }
                >
                  قيمة السند
                </span>

                <strong
                  style={
                    noteDocumentAmountValue
                  }
                >
                  {formatMoney(
                    safeNoteAmount
                  )}{" "}
                  ريال سعودي
                </strong>
              </div>

              <div
                style={
                  noteDocumentDueBox
                }
              >
                <span>
                  الاستحقاق:
                </span>

                <strong>
                  دفعة واحدة بتاريخ{" "}
                  {noteDueDateDisplay}
                </strong>
              </div>
            </header>

            <section
              className="note-legal-body"
              style={noteLegalBodySection}
            >
              <p style={noteLegalParagraph}>
                حُرر هذا السند في مدينة{" "}
                <strong>
                  {noteCity}
                </strong>{" "}
                بتاريخ{" "}
                <strong>
                  {formatDisplayDate(
                    noteIssueDate
                  )}
                </strong>{" "}
                وقيمة السند{" "}
                <strong>
                  {formatMoney(
                    safeNoteAmount
                  )}
                </strong>{" "}
                ريال سعودي.
              </p>

              <p style={noteLegalParagraph}>
                بموجب هذا السند أتعهد
                أنا الموقع أدناه بأن
                أدفع لأمر{" "}
                <strong>
                  {beneficiaryName}
                </strong>{" "}
                المستفيد، المبلغ الموضح
                أعلاه وقدره{" "}
                <strong>
                  {amountWords}
                </strong>
                .
              </p>

              <p style={noteLegalParagraph}>
                وذلك قيمة كامل المبلغ
                المستحق على المدين
                للمستفيد، ويستحق كامل
                مبلغ هذا السند{" "}
                <strong>
                  دفعة واحدة بتاريخ{" "}
                  {noteDueDateDisplay}
                </strong>
                .
              </p>

              <p style={noteLegalParagraph}>
                وبموجب هذا السند يسقط
                المدين كافة حقوق التقديم
                والمطالبة والاحتجاج
                والإخطار بالامتناع عن
                الوفاء.
              </p>

              <p style={noteLegalParagraph}>
                ويجوز لحامل هذا السند
                المستفيد تقديم وإظهار
                هذا السند لأي طرف دون
                موافقة المدين.
              </p>

              <p style={noteLegalParagraph}>
                وللمستفيد حق الرجوع بدون
                مصروفات أو احتجاج أو
                إخطار لعدم الوفاء، وهذا
                السند واجب الدفع دون
                تعطيل.
              </p>

              <p style={noteLegalParagraph}>
                وفي حالة الترافع والنزاع
                يكون الفصل في المحاكم
                التنفيذية المختصة في
                المكان الذي يرغب فيه
                المدعي.
              </p>
            </section>

            <section
              className="note-party-grid"
              style={notePartyGrid}
            >
              <div style={notePartyBox}>
                <h2
                  style={notePartyBoxTitle}
                >
                  بيانات المستفيد
                </h2>

                <NoteDataRow
                  label="الاسم"
                  value={beneficiaryName}
                />

                {beneficiaryIdentifier && (
                  <NoteDataRow
                    label={
                      beneficiaryIdentifierLabel
                    }
                    value={
                      beneficiaryIdentifier
                    }
                  />
                )}

                {note.beneficiary_phone && (
                  <NoteDataRow
                    label="رقم الجوال"
                    value={
                      note.beneficiary_phone
                    }
                  />
                )}
              </div>

              <div style={notePartyBox}>
                <h2
                  style={notePartyBoxTitle}
                >
                  بيانات المدين
                </h2>

                <NoteDataRow
                  label="الاسم"
                  value={
                    note.debtor_name ||
                    customerName
                  }
                />

                <NoteDataRow
                  label="رقم الهوية"
                  value={
                    note.debtor_national_id ||
                    nationalId
                  }
                />

                <NoteDataRow
                  label="رقم الجوال"
                  value={
                    note.debtor_phone ||
                    phone
                  }
                />

                {(note.debtor_address ||
                  customer?.address) && (
                  <NoteDataRow
                    label="العنوان"
                    value={
                      note.debtor_address ||
                      customer?.address ||
                      "................"
                    }
                  />
                )}

                {note.debtor_work_name && (
                  <NoteDataRow
                    label="العمل"
                    value={
                      note.debtor_work_name
                    }
                  />
                )}
              </div>
            </section>

            {note.notes?.trim() && (
              <section
                style={noteNotesBox}
              >
                <strong
                  style={noteNotesTitle}
                >
                  ملاحظات السند:
                </strong>

                <span>
                  {note.notes.trim()}
                </span>
              </section>
            )}

            <section
              className="note-signature-grid"
              style={{
                ...noteSignatureGrid,
                gridTemplateColumns:
                  "minmax(0,1fr)",
              }}
            >
              <div
                style={noteSignatureBox}
              >
                <h2
                  style={
                    noteSignatureTitle
                  }
                >
                  توقيع المدين
                </h2>

                <div
                  style={
                    noteSignatureName
                  }
                >
                  الاسم:{" "}
                  {note.debtor_name ||
                    customerName}
                </div>

                <div
                  style={
                    noteSignatureLine
                  }
                >
                  التوقيع:
                </div>
              </div>
            </section>

            {hasGuarantor && (
              <section
                className="note-guarantor-box"
                style={
                  noteGuarantorDetailsBox
                }
              >
                <h2
                  style={
                    noteGuarantorTitle
                  }
                >
                  بيانات وتوقيع الكفيل
                </h2>

                <div
                  className="note-guarantor-grid"
                  style={
                    noteGuarantorDetailsGrid
                  }
                >
                  <NoteDataRow
                    label="الاسم"
                    value={
                      guarantorName
                    }
                  />

                  <NoteDataRow
                    label="رقم الهوية"
                    value={
                      guarantorNationalId
                    }
                  />

                  <NoteDataRow
                    label="رقم الجوال"
                    value={
                      guarantorPhone
                    }
                  />

                  <NoteDataRow
                    label="تاريخ الميلاد"
                    value={
                      guarantorBirthHijri
                    }
                  />

                  {note.guarantor_work_name && (
                    <NoteDataRow
                      label="العمل"
                      value={
                        note.guarantor_work_name
                      }
                    />
                  )}
                </div>

                <div
                  style={
                    noteGuarantorSignatureLine
                  }
                >
                  التوقيع:
                  ................................
                </div>
              </section>
            )}

            <footer
              className="note-legal-footer"
              style={noteLegalFooterBox}
            >
              {note.legal_footer_text?.trim() ||
                LEGAL_FOOTER_TEXT}
            </footer>
          </section>
        </>
      )}

    </main>
  );
}

function ContractPrintHeader({
  title,
  rightInfo,
  contractNumber,
  contractIssueDate,
}: {
  title: string;
  rightInfo: OrganizationSettings;
  contractNumber:
    | string
    | number
    | null
    | undefined;
  contractIssueDate: string;
}) {
  return (
    <div
      className="print-document-header"
      style={contractHeader}
    >
      <div
        className="print-header-right"
        style={contractHeaderRight}
      >
        <div>
          المملكة العربية السعودية
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

      <div
        style={contractDocumentTitle}
      >
        {title}
      </div>

      <div
        className="print-header-left"
        style={contractHeaderLeft}
      >
        <div>
          رقم العقد:{" "}
          {contractNumber || "-"}
        </div>

        <div>
          تاريخ تحرير العقد:{" "}
          <span style={numericDateText}>
            {contractIssueDate}
          </span>
        </div>
      </div>
    </div>
  );
}

function NoteDataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={noteDataRow}>
      <span style={noteDataLabel}>
        {label}:
      </span>

      <strong style={noteDataValue}>
        {value}
      </strong>
    </div>
  );
}


function isSafariBrowser() {
  if (
    typeof navigator ===
    "undefined"
  ) {
    return false;
  }

  const userAgent =
    navigator.userAgent || "";

  const vendor =
    navigator.vendor || "";

  const usesAppleWebKit =
    /AppleWebKit/i.test(
      userAgent
    );

  const hasSafariToken =
    /Safari/i.test(
      userAgent
    );

  const isAnotherBrowser =
    /Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|OPiOS|FxiOS|Firefox|SamsungBrowser|Android/i.test(
      userAgent
    );

  return (
    usesAppleWebKit &&
    hasSafariToken &&
    !isAnotherBrowser &&
    /Apple/i.test(vendor)
  );
}

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (
    error instanceof Error
  ) {
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

function getActionButtonStyle(
  baseStyle: CSSProperties,
  disabled: boolean
): CSSProperties {
  return {
    ...baseStyle,
    opacity: disabled ? 0.6 : 1,
    cursor: disabled
      ? "not-allowed"
      : "pointer",
  };
}

function getActionFeedbackStyle(
  type: ActionFeedback["type"]
): CSSProperties {
  if (type === "success") {
    return {
      ...actionFeedbackBase,
      border: "1px solid #bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
    };
  }

  if (type === "error") {
    return {
      ...actionFeedbackBase,
      border: "1px solid #fecaca",
      background: "#fff7f7",
      color: "#991b1b",
    };
  }

  return {
    ...actionFeedbackBase,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
  };
}


function buildDocumentsPdfFileName(
  contractNumber:
    | string
    | number
    | null
    | undefined,
  noteNumber:
    | string
    | number
    | null
    | undefined
) {
  const safeContractNumber =
    sanitizeFileNamePart(
      contractNumber || "بدون-رقم"
    );

  const safeNoteNumber =
    sanitizeFileNamePart(
      noteNumber || "بدون-رقم"
    );

  return `العقد-${safeContractNumber}-والسند-${safeNoteNumber}.pdf`;
}

function sanitizeFileNamePart(
  value: unknown
) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70) || "بدون-رقم";
}

function downloadBlob(
  blob: Blob,
  fileName: string
) {
  const objectUrl =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1500);
}


function formatMoney(
  value: unknown
) {
  const number = Number(
    value || 0
  );

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat(
    "ar-SA",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(number);
}

function normalizeDateDigits(
  value: string
) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".indexOf(
          digit
        )
      )
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".indexOf(
          digit
        )
      )
    );
}

function formatDateOnly(
  value?: string | null
) {
  if (!value) {
    return "-";
  }

  const normalized =
    normalizeDateDigits(
      String(value).trim()
    );

  const directMatch =
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/.exec(
      normalized
    );

  if (directMatch) {
    return `${directMatch[1]}/${directMatch[2].padStart(
      2,
      "0"
    )}/${directMatch[3].padStart(
      2,
      "0"
    )}`;
  }

  const parsedDate =
    new Date(normalized);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return normalized;
  }

  const year = String(
    parsedDate.getFullYear()
  );

  const month = String(
    parsedDate.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    parsedDate.getDate()
  ).padStart(2, "0");

  return `${year}/${month}/${day}`;
}

function formatDisplayDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  return formatDateOnly(value);
}

function formatHijriDate(
  value?: string | null
) {
  if (!value) {
    return "................";
  }

  const normalized =
    normalizeDateDigits(
      String(value).trim()
    )
      .replace(/[.\-]/g, "/")
      .replace(/\s+/g, "");

  const parts =
    normalized.split("/");

  if (parts.length !== 3) {
    return normalized;
  }

  let year = "";
  let month = "";
  let day = "";

  if (parts[0].length === 4) {
    [year, month, day] = parts;
  } else if (
    parts[2].length === 4
  ) {
    [day, month, year] = parts;
  } else {
    return normalized;
  }

  return `${year}/${month.padStart(
    2,
    "0"
  )}/${day.padStart(2, "0")}`;
}

function formatNoteNumber(
  value:
    | string
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numericValue =
    Number(value);

  if (
    Number.isFinite(
      numericValue
    )
  ) {
    return String(
      Math.trunc(
        numericValue
      )
    ).padStart(6, "0");
  }

  return String(value);
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

function amountToArabicWords(
  value: number
) {
  const safeValue =
    Math.abs(value);

  const riyals =
    Math.floor(safeValue);

  const halalas =
    Math.round(
      (safeValue - riyals) *
        100
    );

  const riyalWords =
    riyals === 0
      ? "صفر"
      : integerToArabicWords(
          riyals
        );

  let result =
    `${riyalWords} ريال سعودي`;

  if (halalas > 0) {
    result +=
      ` و${integerToArabicWords(
        halalas
      )} هللة`;
  }

  return `${result} فقط لا غير`;
}

function integerToArabicWords(
  value: number
): string {
  const integer =
    Math.floor(
      Math.abs(value)
    );

  if (integer === 0) {
    return "صفر";
  }

  const groups = [
    {
      value: 1_000_000_000,
      singular: "مليار",
      dual: "ملياران",
      plural: "مليارات",
    },
    {
      value: 1_000_000,
      singular: "مليون",
      dual: "مليونان",
      plural: "ملايين",
    },
    {
      value: 1_000,
      singular: "ألف",
      dual: "ألفان",
      plural: "آلاف",
    },
  ];

  let remaining = integer;
  const parts: string[] = [];

  for (
    const group of groups
  ) {
    const count =
      Math.floor(
        remaining /
          group.value
      );

    if (count > 0) {
      parts.push(
        renderArabicScale(
          count,
          group.singular,
          group.dual,
          group.plural
        )
      );

      remaining %=
        group.value;
    }
  }

  if (remaining > 0) {
    parts.push(
      numberBelowThousandToArabic(
        remaining
      )
    );
  }

  return parts
    .filter(Boolean)
    .join(" و");
}

function renderArabicScale(
  count: number,
  singular: string,
  dual: string,
  plural: string
) {
  if (count === 1) {
    return singular;
  }

  if (count === 2) {
    return dual;
  }

  if (
    count >= 3 &&
    count <= 10
  ) {
    return `${numberBelowThousandToArabic(
      count
    )} ${plural}`;
  }

  return `${numberBelowThousandToArabic(
    count
  )} ${singular}`;
}

function numberBelowThousandToArabic(
  value: number
): string {
  const number =
    Math.floor(value);

  if (number === 0) {
    return "";
  }

  const units = [
    "",
    "واحد",
    "اثنان",
    "ثلاثة",
    "أربعة",
    "خمسة",
    "ستة",
    "سبعة",
    "ثمانية",
    "تسعة",
  ];

  const teens:
    Record<number, string> = {
      10: "عشرة",
      11: "أحد عشر",
      12: "اثنا عشر",
      13: "ثلاثة عشر",
      14: "أربعة عشر",
      15: "خمسة عشر",
      16: "ستة عشر",
      17: "سبعة عشر",
      18: "ثمانية عشر",
      19: "تسعة عشر",
    };

  const tens = [
    "",
    "",
    "عشرون",
    "ثلاثون",
    "أربعون",
    "خمسون",
    "ستون",
    "سبعون",
    "ثمانون",
    "تسعون",
  ];

  const hundreds = [
    "",
    "مائة",
    "مائتان",
    "ثلاثمائة",
    "أربعمائة",
    "خمسمائة",
    "ستمائة",
    "سبعمائة",
    "ثمانمائة",
    "تسعمائة",
  ];

  const parts: string[] = [];

  const hundred =
    Math.floor(number / 100);

  const remainder =
    number % 100;

  if (hundred > 0) {
    parts.push(
      hundreds[hundred]
    );
  }

  if (remainder > 0) {
    if (remainder < 10) {
      parts.push(
        units[remainder]
      );
    } else if (
      remainder < 20
    ) {
      parts.push(
        teens[remainder]
      );
    } else {
      const ten =
        Math.floor(
          remainder / 10
        );

      const unit =
        remainder % 10;

      if (unit > 0) {
        parts.push(
          `${units[unit]} و${tens[ten]}`
        );
      } else {
        parts.push(
          tens[ten]
        );
      }
    }
  }

  return parts.join(" و");
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
  border:
    "1px solid #bfdbfe",
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
  border:
    "1px solid #fecaca",
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

const contractPrintArea: CSSProperties = {
  width: "210mm",
  height: "297mm",
  minHeight: "297mm",
  maxHeight: "297mm",

  margin: "0 auto",
  padding: "8mm 10mm",

  overflow: "hidden",

  background: "#ffffff",
  color: "#111827",

  lineHeight: 1.45,

  boxSizing: "border-box",

  pageBreakInside: "avoid",

  boxShadow:
    "0 14px 35px rgba(15,23,42,0.10)",
};

const notePrintArea: CSSProperties = {
  width: "210mm",
  height: "297mm",
  minHeight: "297mm",
  maxHeight: "297mm",

  margin: "20px auto 0",
  padding: "8mm 10mm",

  overflow: "hidden",

  background: "#ffffff",
  color: "#111827",

  display: "flex",
  flexDirection: "column",

  boxSizing: "border-box",

  pageBreakInside: "avoid",

  boxShadow:
    "0 14px 35px rgba(15,23,42,0.10)",
};

const contractHeader: CSSProperties = {
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

const contractHeaderRight:
  CSSProperties = {
    fontSize: 12.8,
    lineHeight: 1.6,
    fontWeight: 900,
  };

const contractHeaderLeft:
  CSSProperties = {
    fontSize: 12.8,
    lineHeight: 1.6,
    textAlign: "left",
    fontWeight: 900,
  };

const contractDocumentTitle:
  CSSProperties = {
    marginTop: 13,

    textAlign: "center",

    color: "#111827",

    fontSize: 25,

    fontWeight: 900,

    whiteSpace: "nowrap",

    fontFamily:
      "var(--font-almarai), sans-serif",
  };

const contractContentBox:
  CSSProperties = {
    marginTop: 10,
  };

const contractParagraph:
  CSSProperties = {
    margin: "5px 0",

    fontSize: 14.4,

    lineHeight: 1.5,

    textAlign: "justify",
  };

const numericDateText:
  CSSProperties = {
    display: "inline-block",
    direction: "ltr",
    unicodeBidi: "isolate",
    whiteSpace: "nowrap",
    fontVariantNumeric:
      "tabular-nums",
  };

const contractSignatures:
  CSSProperties = {
    display: "grid",

    gridTemplateColumns:
      "1fr 1fr",

    gap: 16,

    marginTop: 17,
  };

const contractSignatureBox:
  CSSProperties = {
    minHeight: 84,

    paddingTop: 8,

    borderTop:
      "1.5px solid #111827",

    lineHeight: 1.58,

    fontSize: 14,
  };

const contractGuarantorBox:
  CSSProperties = {
    marginTop: 14,

    paddingTop: 8,

    borderTop:
      "1.5px solid #111827",

    lineHeight: 1.58,

    fontSize: 14,
  };

const contractGuarantorGrid:
  CSSProperties = {
    display: "grid",

    gridTemplateColumns:
      "1fr 1fr",

    gap: "2px 14px",

    marginTop: 4,
  };

const noteDocumentHeader:
  CSSProperties = {
    flex: "0 0 auto",
  };

const noteTopRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent:
    "space-between",
  gap: "8mm",

  borderBottom:
    "0.3mm solid #cbd5e1",

  paddingBottom: "2.5mm",
};

const noteCountryBlock:
  CSSProperties = {
    display: "grid",
    gap: "1mm",

    color: "#111827",

    fontSize: "11.3pt",
    lineHeight: 1.42,
  };

const noteTopMeta:
  CSSProperties = {
    display: "grid",
    gap: "1mm",

    textAlign: "left",

    fontSize: "11.3pt",
    lineHeight: 1.42,
  };

const noteDocumentTitle:
  CSSProperties = {
    margin: "4mm 0 2.5mm",

    textAlign: "center",

    color: "#0f172a",

    fontSize: "28pt",

    lineHeight: 1.2,

    fontWeight: 900,

    fontFamily:
      "var(--font-almarai), sans-serif",
  };

const noteDocumentAmountBox:
  CSSProperties = {
    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    gap: "4mm",

    padding: "2.5mm 5mm",

    border:
      "0.4mm solid #1e3a8a",

    borderRadius: "2.5mm",

    background: "#eff6ff",
  };

const noteDocumentAmountLabel:
  CSSProperties = {
    color: "#475569",

    fontSize: "10.8pt",

    fontWeight: 800,
  };

const noteDocumentAmountValue:
  CSSProperties = {
    color: "#1e3a8a",

    fontSize: "15.2pt",

    fontWeight: 900,
  };

const noteDocumentDueBox:
  CSSProperties = {
    display: "flex",

    alignItems: "center",

    justifyContent: "center",

    gap: "2mm",

    marginTop: "1.8mm",

    color: "#0f2b55",

    fontSize: "10.8pt",

    lineHeight: 1.45,
  };

const noteLegalBodySection:
  CSSProperties = {
    marginTop: "3.2mm",
    flex: "0 0 auto",
  };

const noteLegalParagraph:
  CSSProperties = {
    margin: "1mm 0",

    color: "#111827",

    fontSize: "12.1pt",

    lineHeight: 1.58,

    textAlign: "justify",
  };

const notePartyGrid:
  CSSProperties = {
    display: "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    gap: "3.5mm",

    marginTop: "2.8mm",

    flex: "0 0 auto",
  };

const notePartyBox:
  CSSProperties = {
    border:
      "0.3mm solid #cbd5e1",

    borderRadius: "2.5mm",

    padding: "2.5mm 3.5mm",

    minWidth: 0,
  };

const notePartyBoxTitle:
  CSSProperties = {
    margin: "0 0 2mm",

    paddingBottom: "1.5mm",

    borderBottom:
      "0.25mm solid #e2e8f0",

    color: "#0f2b55",

    fontSize: "12.1pt",

    fontWeight: 900,
  };

const noteDataRow:
  CSSProperties = {
    display: "flex",

    alignItems: "baseline",

    gap: "1.5mm",

    margin: "1.1mm 0",

    minWidth: 0,

    fontSize: "10.7pt",

    lineHeight: 1.45,
  };

const noteDataLabel:
  CSSProperties = {
    color: "#475569",

    fontWeight: 800,

    whiteSpace: "nowrap",
  };

const noteDataValue:
  CSSProperties = {
    color: "#111827",

    fontWeight: 900,

    overflowWrap: "anywhere",
  };

const noteNotesBox:
  CSSProperties = {
    display: "flex",

    gap: "2mm",

    marginTop: "2.5mm",

    padding: "2.2mm 3mm",

    border:
      "0.3mm solid #dbeafe",

    borderRadius: "2mm",

    background: "#f8fbff",

    color: "#334155",

    fontSize: "10.7pt",

    lineHeight: 1.6,

    flex: "0 0 auto",
  };

const noteNotesTitle:
  CSSProperties = {
    color: "#0f2b55",

    whiteSpace: "nowrap",
  };

const noteSignatureGrid:
  CSSProperties = {
    display: "grid",

    gap: "6mm",

    marginTop: "3.5mm",

    flex: "0 0 auto",
  };

const noteSignatureBox:
  CSSProperties = {
    minHeight: "19mm",

    borderTop:
      "0.4mm solid #111827",

    paddingTop: "2mm",
  };

const noteSignatureTitle:
  CSSProperties = {
    margin: "0 0 2mm",

    color: "#111827",

    fontSize: "12.1pt",

    fontWeight: 900,
  };

const noteSignatureName:
  CSSProperties = {
    fontSize: "10.7pt",

    marginBottom: "3mm",
  };

const noteSignatureLine:
  CSSProperties = {
    fontSize: "10.7pt",

    paddingTop: "1.5mm",
  };

const noteGuarantorDetailsBox:
  CSSProperties = {
    marginTop: "2.5mm",

    border:
      "0.3mm solid #cbd5e1",

    borderRadius: "2mm",

    padding: "2.5mm 3mm",

    flex: "0 0 auto",
  };

const noteGuarantorTitle:
  CSSProperties = {
    margin: "0 0 1.5mm",

    color: "#0f2b55",

    fontSize: "11.7pt",

    fontWeight: 900,
  };

const noteGuarantorDetailsGrid:
  CSSProperties = {
    display: "grid",

    gridTemplateColumns:
      "repeat(2,minmax(0,1fr))",

    columnGap: "5mm",
  };

const noteGuarantorSignatureLine:
  CSSProperties = {
    marginTop: "2mm",

    paddingTop: "2mm",

    borderTop:
      "0.25mm solid #e2e8f0",

    color: "#111827",

    fontSize: "10.7pt",

    fontWeight: 900,
  };

const noteLegalFooterBox:
  CSSProperties = {
    marginTop: "auto",

    marginBottom: "10mm",

    padding: "3mm 4mm",

    border:
      "0.4mm solid #475569",

    borderRadius: "2mm",

    background: "#f8fafc",

    color: "#111827",

    fontSize: "9.3pt",

    lineHeight: 1.58,

    fontWeight: 800,

    textAlign: "center",

    whiteSpace: "pre-line",

    flex: "0 0 auto",
  };

const actionFeedbackBase:
  CSSProperties = {
    width: "100%",
    maxWidth: 850,
    margin: "0 auto 20px",
    padding: "13px 15px",
    borderRadius: 13,
    textAlign: "center",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.7,
  };

const actionButtons:
  CSSProperties = {
    width: "100%",

    maxWidth: 850,

    margin: "0 auto 12px",

    padding: 14,

    display: "grid",

    gap: 12,

    border: "1px solid rgba(191,219,254,0.92)",

    borderRadius: 18,

    background: "rgba(255,255,255,0.94)",

    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",

    backdropFilter: "blur(14px)",

    WebkitBackdropFilter: "blur(14px)",
  };

const documentActionGrid:
  CSSProperties = {
    display: "grid",
    gap: 12,
  };

const actionButtonBase:
  CSSProperties = {
    width: "100%",

    minHeight: 52,

    padding: "14px 16px",

    border: "none",

    borderRadius: 14,

    color: "#ffffff",

    fontSize: 16,

    fontWeight: 900,

    fontFamily:
      "var(--font-almarai), sans-serif",

    transition:
      "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
  };

const printButton:
  CSSProperties = {
    ...actionButtonBase,

    background:
      "linear-gradient(135deg,#0d47a1,#1565c0 55%,#0284c7)",

    boxShadow:
      "0 8px 20px rgba(13,71,161,0.20)",
  };

const saveButton:
  CSSProperties = {
    ...actionButtonBase,

    background:
      "linear-gradient(135deg,#6d28d9,#7c3aed 55%,#8b5cf6)",

    boxShadow:
      "0 8px 20px rgba(109,40,217,0.20)",
  };

const whatsappButton:
  CSSProperties = {
    ...actionButtonBase,

    background:
      "linear-gradient(135deg,#16a34a,#22c55e 55%,#10b981)",

    boxShadow:
      "0 8px 20px rgba(22,163,74,0.22)",
  };

const backButton:
  CSSProperties = {
    width: "fit-content",

    minWidth: 105,

    minHeight: 38,

    justifySelf: "center",

    padding: "8px 16px",

    border: "none",

    borderRadius: 10,

    background:
      "linear-gradient(135deg,#22c55e,#15803d)",

    color: "#ffffff",

    fontSize: 13,

    fontWeight: 900,

    cursor: "pointer",

    fontFamily:
      "var(--font-almarai), sans-serif",

    boxShadow:
      "0 5px 14px rgba(22,163,74,0.18)",
  };
