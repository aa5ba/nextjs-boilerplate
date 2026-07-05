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

type ScreenType = "mobile" | "tablet" | "desktop";

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
  contract_number?: string | number | null;
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
  product_quantity?: string | number | null;
  print_party_type?: string | null;
  print_party_name?: string | null;
  print_party_identifier?: string | null;
  first_party_type?: string | null;
  first_party_name?: string | null;
  first_party_identifier?: string | null;
  debt_amount?: string | number | null;
  payment_amount?: string | number | null;
  paid_amount?: string | number | null;
  remaining_amount?: string | number | null;
  has_deferred_payments?: boolean | null;
  installment_amount?: string | number | null;
  deferred_payments_count?: string | number | null;
  payment_due_date?: string | null;
  contract_issue_date_gregorian?: string | null;
  contract_date_gregorian?: string | null;
  contract_issue_date_hijri?: string | null;
  contract_date_hijri?: string | null;
  legal_city?: string | null;
  judicial_amount?: string | number | null;
  notes?: string | null;
  has_guarantor?: boolean | null;
  guarantor_name?: string | null;
  guarantor_national_id?: string | null;
  guarantor_phone?: string | null;
  guarantor_birth_hijri?: string | null;
  guarantor_work_name?: string | null;
  customer?: CustomerRelation | CustomerRelation[] | null;
  guarantor_customer?: CustomerRelation | CustomerRelation[] | null;
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

export default function PrintContractPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const branch = String(params.branch ?? "").trim();
  const contractId = String(params.id ?? "").trim();

  const contractPrintRef = useRef<HTMLElement | null>(null);

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [pageReady, setPageReady] = useState(false);
  const [employeeName, setEmployeeName] = useState("الموظف");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [contract, setContract] = useState<ContractRecord | null>(null);
  const [organizationSettings, setOrganizationSettings] =
    useState<OrganizationSettings>({
      name: "احتساب",
      phone: "",
      city: "",
      commercialRecord: "",
    });
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [printingPdf, setPrintingPdf] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [sharingWhatsapp, setSharingWhatsapp] = useState(false);
  const [actionFeedback, setActionFeedback] =
    useState<ActionFeedback | null>(null);

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

    return () => {
      window.removeEventListener("resize", updateScreen);
    };
  }, []);

  useEffect(() => {
    const style = document.createElement("style");

    style.setAttribute("data-contract-print", "true");
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

      .contract-action-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .contract-action-button:hover:not(:disabled) {
        transform: translateY(-1px);
      }

      @page {
        size: A4 portrait;
        margin: 0;
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

        .contract-print-main {
          display: block !important;
          width: 210mm !important;
          min-height: 297mm !important;
          padding: 0 !important;
          margin: 0 !important;
          background: #ffffff !important;
          background-image: none !important;
        }

        .contract-print-container {
          width: 210mm !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .no-print {
          display: none !important;
        }

        #contract-print-area {
          width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          margin: 0 !important;
          padding: 8mm 10mm !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
          page-break-inside: avoid !important;
          break-inside: avoid-page !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
        }

        #contract-print-area section,
        #contract-print-area div,
        #contract-print-area p {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
      }

      @media screen and (max-width: 850px) {
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

        .contract-action-grid {
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
      isCancelled: () => boolean = () => false
    ) => {
      if (!currentBranchId || !contractId) {
        if (!isCancelled()) {
          setPageError("تعذر تحديد العقد أو الفرع");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setPageError("");
      setActionFeedback(null);

      try {
        const [branchResult, contractResult] = await Promise.all([
          supabase
            .from("finance_branches")
            .select(
              "id, branch_slug, branch_name, organization_name, organization_phone, phone, city, commercial_record, is_active"
            )
            .eq("id", currentBranchId)
            .eq("branch_slug", branch)
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
            .eq("branch_id", currentBranchId)
            .maybeSingle(),
        ]);

        if (isCancelled()) return;

        if (branchResult.error) {
          throw new Error(branchResult.error.message);
        }

        if (!branchResult.data || branchResult.data.is_active === false) {
          throw new Error("الفرع غير موجود أو غير نشط");
        }

        if (contractResult.error) {
          throw new Error(contractResult.error.message);
        }

        if (!contractResult.data) {
          throw new Error("العقد غير موجود أو لا يتبع هذا الفرع");
        }

        const organizationName =
          branchResult.data.organization_name ||
          localStorage.getItem("finance_organization_name") ||
          "احتساب";

        setOrganizationSettings({
          name: organizationName,
          phone:
            branchResult.data.organization_phone ||
            branchResult.data.phone ||
            "",
          city:
            branchResult.data.city ||
            branchResult.data.branch_name ||
            "",
          commercialRecord:
            branchResult.data.commercial_record || "",
        });

        setContract(contractResult.data as ContractRecord);

        if (organizationName) {
          localStorage.setItem(
            "finance_organization_name",
            organizationName
          );
        }
      } catch (error) {
        if (isCancelled()) return;

        console.error("Contract print loading error:", error);
        setContract(null);
        setPageError(
          getErrorMessage(error, "تعذر تحميل بيانات العقد")
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
      if (typeof window === "undefined") return;

      if (!branch || !contractId) {
        redirectToLogin(true);
        return;
      }

      const storedSession = readStoredSession();

      if (!isValidSession(storedSession)) {
        redirectToLogin(true);
        return;
      }

      const sessionBranchSlug = String(
        storedSession?.branch_slug || ""
      ).trim();

      if (sessionBranchSlug && sessionBranchSlug !== branch) {
        router.replace(`/finance/${sessionBranchSlug}`);
        return;
      }

      const resolvedEmployeeName =
        localStorage.getItem("finance_user_name") ||
        storedSession?.full_name ||
        storedSession?.username ||
        "الموظف";

      setEmployeeName(resolvedEmployeeName);
      renewFinanceSession();
      setPageReady(true);

      const storedBranchId = String(
        storedSession?.branch_id ||
          localStorage.getItem("finance_branch_id") ||
          ""
      ).trim();

      let resolvedBranchId = storedBranchId;

      if (!resolvedBranchId) {
        try {
          const fetchedBranchId = await getBranchId(branch);

          if (cancelled) return;

          if (!fetchedBranchId) {
            setPageError("تعذر تحديد الفرع");
            setLoading(false);
            return;
          }

          resolvedBranchId = String(fetchedBranchId);
          localStorage.setItem("finance_branch_id", resolvedBranchId);
          localStorage.setItem("finance_branch_slug", branch);
        } catch (error) {
          if (cancelled) return;

          setPageError(getErrorMessage(error, "تعذر تحديد الفرع"));
          setLoading(false);
          return;
        }
      }

      if (cancelled) return;

      setBranchId(resolvedBranchId);
      await loadContract(resolvedBranchId, () => cancelled);
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [branch, contractId, loadContract, router]);

  useEffect(() => {
    if (!pageReady || typeof window === "undefined") return;

    let lastRefresh = 0;

    function handleActivity() {
      const now = Date.now();

      if (now - lastRefresh < ACTIVITY_REFRESH_INTERVAL_MS) return;

      lastRefresh = now;
      renewFinanceSession();
    }

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    const timer = window.setInterval(() => {
      const expiresAt = Number(
        localStorage.getItem("finance_session_expires_at") || 0
      );

      if (expiresAt > 0 && Date.now() >= expiresAt) {
        redirectToLogin(true);
      }
    }, 30 * 1000);

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });

      window.clearInterval(timer);
    };
  }, [pageReady, pathname]);

  function readStoredSession(): FinanceSession | null {
    if (typeof window === "undefined") return null;

    const rawSession =
      localStorage.getItem("finance_branch_user") ||
      localStorage.getItem("finance_user");

    if (!rawSession) return null;

    try {
      const parsed = JSON.parse(rawSession) as FinanceSession;

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }

      return {
        ...parsed,
        id:
          parsed.id ||
          parsed.user_id ||
          localStorage.getItem("finance_user_id"),
        full_name:
          parsed.full_name ||
          localStorage.getItem("finance_user_name") ||
          null,
        username:
          parsed.username ||
          localStorage.getItem("finance_username") ||
          null,
        role:
          parsed.role ||
          localStorage.getItem("finance_role") ||
          null,
        branch_id:
          parsed.branch_id ||
          localStorage.getItem("finance_branch_id") ||
          null,
        branch_slug:
          parsed.branch_slug ||
          localStorage.getItem("finance_branch_slug") ||
          null,
        branch_name:
          parsed.branch_name ||
          localStorage.getItem("finance_branch_name") ||
          null,
        organization_name:
          parsed.organization_name ||
          localStorage.getItem("finance_organization_name") ||
          null,
        investor_id:
          parsed.investor_id ||
          localStorage.getItem("finance_investor_id") ||
          null,
      };
    } catch {
      return null;
    }
  }

  function isValidSession(session: FinanceSession | null) {
    if (!session) return false;

    const userId = String(session.id || session.user_id || "").trim();
    const sessionBranchSlug = String(session.branch_slug || "").trim();

    if (!userId || !sessionBranchSlug) return false;
    if (session.is_active === false) return false;

    const expiresAt = Number(
      localStorage.getItem("finance_session_expires_at") || 0
    );

    return !(expiresAt > 0 && Date.now() >= expiresAt);
  }

  function renewFinanceSession() {
    if (typeof window === "undefined") return;

    const now = Date.now();
    localStorage.setItem("finance_last_activity_at", String(now));
    localStorage.setItem(
      "finance_session_expires_at",
      String(now + SESSION_DURATION_MS)
    );
  }

  function clearSession({
    preserveReturnPath = false,
  }: {
    preserveReturnPath?: boolean;
  } = {}) {
    if (typeof window === "undefined") return;

    SESSION_KEYS.forEach((key) => {
      if (preserveReturnPath && key === "finance_return_to") return;
      localStorage.removeItem(key);
    });
  }

  function getCurrentReturnPath() {
    if (typeof window === "undefined") {
      return (
        pathname ||
        `/finance/${branch}/contracts/print/${contractId}`
      );
    }

    return `${window.location.pathname}${window.location.search}`;
  }

  function isSafeReturnPath(value: string) {
    if (!value.startsWith(`/finance/${branch}`)) return false;
    if (value.startsWith("//") || value.includes("://")) return false;
    return true;
  }

  function redirectToLogin(preserveReturnPath = true) {
    if (typeof window === "undefined") {
      router.replace("/login");
      return;
    }

    const returnTo = getCurrentReturnPath();

    if (preserveReturnPath && isSafeReturnPath(returnTo)) {
      localStorage.setItem("finance_return_to", returnTo);
    }

    clearSession({ preserveReturnPath });

    if (preserveReturnPath && isSafeReturnPath(returnTo)) {
      localStorage.setItem("finance_return_to", returnTo);
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    router.replace("/login");
  }

  function logout() {
    clearSession({ preserveReturnPath: false });
    router.replace("/login");
  }

  function retryLoading() {
    if (!branchId) {
      setPageError("تعذر تحديد الفرع");
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
    return Array.isArray(relation) ? relation[0] || null : relation || null;
  }

  async function printContract() {
    if (loading || pageError || !contract) {
      setActionFeedback({
        type: "error",
        message: "انتظر حتى يكتمل تحميل بيانات العقد.",
      });
      return;
    }

    if (!isSafariBrowser()) {
      setActionFeedback(null);
      renewFinanceSession();
      window.print();
      return;
    }

    if (printingPdf) return;

    const printWindow = window.open("", "_blank");

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
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>جاري تجهيز ملف الطباعة</title>
          <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; min-height: 100%; }
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
            جاري إنشاء ملف PDF ثابت وفتحه للطباعة في Safari...
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
    renewFinanceSession();

    try {
      const { blob } = await createContractPdf({ autoPrint: true });
      const pdfUrl = URL.createObjectURL(blob);

      printWindow.location.replace(pdfUrl);
      printWindow.focus();

      window.setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 120_000);

      setActionFeedback({
        type: "success",
        message: "تم فتح ملف PDF ثابت للطباعة في Safari.",
      });
    } catch (error) {
      printWindow.close();

      console.error("Opening Safari contract PDF failed:", error);
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

  async function createContractPdf(
    options: PdfGenerationOptions = {}
  ): Promise<PdfGenerationResult> {
    const contractElement = contractPrintRef.current;

    if (!contract || !contractElement) {
      throw new Error("تعذر العثور على صفحة العقد لإنشاء الملف");
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const [html2canvasModule, jsPdfModule] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const html2canvas = html2canvasModule.default;
    const { jsPDF } = jsPdfModule;

    const canvas = await html2canvas(contractElement, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 1400,
      windowHeight: 1300,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDocument) => {
        clonedDocument.documentElement.style.background = "#ffffff";
        clonedDocument.body.style.background = "#ffffff";

        const clonedPage =
          clonedDocument.querySelector<HTMLElement>(
            '[data-pdf-page="contract"]'
          );

        if (!clonedPage) return;

        clonedPage.style.width = "210mm";
        clonedPage.style.height = "297mm";
        clonedPage.style.minHeight = "297mm";
        clonedPage.style.maxHeight = "297mm";
        clonedPage.style.margin = "0";
        clonedPage.style.padding = "8mm 10mm";
        clonedPage.style.boxShadow = "none";
        clonedPage.style.border = "none";
        clonedPage.style.borderRadius = "0";
        clonedPage.style.overflow = "hidden";
        clonedPage.style.background = "#ffffff";
      },
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const imageData = canvas.toDataURL("image/jpeg", 0.96);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const canvasRatio = canvas.width / canvas.height;

    let imageWidth = pageWidth;
    let imageHeight = imageWidth / canvasRatio;

    if (imageHeight > pageHeight) {
      imageHeight = pageHeight;
      imageWidth = imageHeight * canvasRatio;
    }

    const imageX = (pageWidth - imageWidth) / 2;
    const imageY = (pageHeight - imageHeight) / 2;

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

    if (options.autoPrint) {
      const printablePdf = pdf as typeof pdf & {
        autoPrint?: (options?: {
          variant?: "non-conform" | "javascript";
        }) => void;
      };

      printablePdf.autoPrint?.({ variant: "non-conform" });
    }

    const fileName = buildContractPdfFileName(
      contract.contract_number
    );

    return {
      blob: pdf.output("blob"),
      fileName,
    };
  }

  async function saveContractPdf() {
    if (loading || pageError || !contract) {
      setActionFeedback({
        type: "error",
        message: "انتظر حتى يكتمل تحميل بيانات العقد.",
      });
      return;
    }

    if (savingPdf) return;

    setSavingPdf(true);
    setActionFeedback(null);
    renewFinanceSession();

    try {
      const { blob, fileName } = await createContractPdf();
      downloadBlob(blob, fileName);

      setActionFeedback({
        type: "success",
        message: "تم إنشاء ملف PDF للعقد وحفظه بنجاح.",
      });
    } catch (error) {
      console.error("Saving contract PDF failed:", error);
      setActionFeedback({
        type: "error",
        message: getErrorMessage(error, "تعذر إنشاء ملف PDF للعقد"),
      });
    } finally {
      setSavingPdf(false);
    }
  }

  async function shareContractOnWhatsapp() {
    if (loading || pageError || !contract) {
      setActionFeedback({
        type: "error",
        message: "انتظر حتى يكتمل تحميل بيانات العقد.",
      });
      return;
    }

    if (sharingWhatsapp) return;

    const customer = getSingleRelation(contract.customer);
    const customerDisplayName =
      customer?.full_name || contract.customer_name || "العميل";

    setSharingWhatsapp(true);
    setActionFeedback(null);
    renewFinanceSession();

    try {
      const { blob, fileName } = await createContractPdf();
      const pdfFile = new File([blob], fileName, {
        type: "application/pdf",
        lastModified: Date.now(),
      });

      const shareData: ShareData = {
        files: [pdfFile],
        title: `العقد رقم ${String(contract.contract_number || "-")}`,
      };

      const canSharePdf =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare(shareData);

      if (!canSharePdf) {
        downloadBlob(blob, fileName);

        setActionFeedback({
          type: "info",
          message:
            "هذا المتصفح لا يدعم مشاركة ملفات PDF مباشرة. تم حفظ الملف على الجهاز، ويمكنك مشاركته من تطبيق الملفات.",
        });
        return;
      }

      await navigator.share(shareData);

      setActionFeedback({
        type: "success",
        message:
          `تم فتح نافذة مشاركة ملف PDF. اختر واتساب ثم أرسل الملف إلى ${customerDisplayName}.`,
      });
    } catch (error) {
      if (isShareCancellation(error)) {
        setActionFeedback({
          type: "info",
          message: "تم إلغاء مشاركة ملف PDF.",
        });
        return;
      }

      console.error("WhatsApp contract PDF sharing failed:", error);
      setActionFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "تعذر إنشاء ملف العقد أو مشاركته"
        ),
      });
    } finally {
      setSharingWhatsapp(false);
    }
  }

  if (!pageReady) return null;

  const customer = getSingleRelation(contract?.customer);
  const guarantorCustomer = getSingleRelation(
    contract?.guarantor_customer
  );

  const customerName =
    customer?.full_name || contract?.customer_name || "................";
  const nationalId =
    customer?.national_id ||
    contract?.customer_national_id ||
    "................";
  const phone =
    customer?.phone || contract?.customer_phone || "................";
  const birthHijri = formatHijriDate(
    customer?.birth_hijri ||
      contract?.customer_birth_hijri
  );

  const contractFirstPartyName =
    organizationSettings.name || "................";

  const contractFirstPartyIdentifier =
    organizationSettings.commercialRecord || "................";

  const rawContractPaymentAmount = Number(
    contract?.payment_amount || 0
  );

  const contractPaymentAmount = Number.isFinite(
    rawContractPaymentAmount
  )
    ? rawContractPaymentAmount
    : 0;

  const contractPaymentAmountWords = amountToArabicWords(
    contractPaymentAmount
  );

  const contractIssueDate = formatDateOnly(
    contract?.contract_issue_date_gregorian ||
      contract?.contract_date_gregorian
  );
  const paymentDueDate = formatDateOnly(contract?.payment_due_date);

  const hasGuarantor =
    Boolean(contract?.has_guarantor) ||
    Boolean(contract?.guarantor_customer_id) ||
    Boolean(guarantorCustomer?.full_name) ||
    Boolean(contract?.guarantor_name);

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
  const guarantorBirthHijri = formatHijriDate(
    guarantorCustomer?.birth_hijri ||
      contract?.guarantor_birth_hijri
  );
  const guarantorWork =
    guarantorCustomer?.work_name ||
    guarantorCustomer?.work ||
    contract?.guarantor_work_name ||
    "";

  const legalCity = String(contract?.legal_city || "").trim();
  const documentsUnavailable = loading || Boolean(pageError) || !contract;
  const actionBusy = printingPdf || savingPdf || sharingWhatsapp;

  return (
    <main
      dir="rtl"
      className="contract-print-main"
      style={getPageStyle(isMobile)}
    >
      <div
        className="contract-print-container"
        style={getContainerStyle(isCompact)}
      >
        <header className="no-print" style={getHeroStyle(isMobile)}>
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

                <button
                  type="button"
                  style={logoutInlineButton}
                  onClick={logout}
                >
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                type="button"
                style={getMainWorkstationButtonStyle(isMobile)}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>طباعة العقد</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        <section
          className="no-print"
          style={printControlsCard}
          aria-label="خيارات طباعة العقد"
        >
          <div
            className="contract-action-grid"
            style={documentActionGrid}
          >
            <button
              type="button"
              className="contract-action-button"
              style={getActionButtonStyle(
                printButton,
                documentsUnavailable || printingPdf || actionBusy
              )}
              disabled={
                documentsUnavailable || printingPdf || actionBusy
              }
              onClick={() => void printContract()}
            >
              {printingPdf ? "جاري تجهيز الطباعة..." : "طباعة"}
            </button>

            <button
              type="button"
              className="contract-action-button"
              style={getActionButtonStyle(
                saveButton,
                documentsUnavailable || savingPdf || actionBusy
              )}
              disabled={documentsUnavailable || savingPdf || actionBusy}
              onClick={() => void saveContractPdf()}
            >
              {savingPdf ? "جاري إنشاء الملف..." : "حفظ الملف PDF"}
            </button>

            <button
              type="button"
              className="contract-action-button"
              style={getActionButtonStyle(
                whatsappButton,
                documentsUnavailable || sharingWhatsapp || actionBusy
              )}
              disabled={
                documentsUnavailable || sharingWhatsapp || actionBusy
              }
              onClick={() => void shareContractOnWhatsapp()}
            >
              {sharingWhatsapp
                ? "جاري تجهيز ملف PDF..."
                : "مشاركة PDF عبر واتساب"}
            </button>

            <button
              type="button"
              className="contract-action-button"
              style={backTopButton}
              onClick={() =>
                router.push(`/finance/${branch}/contracts/${contractId}`)
              }
              disabled={actionBusy}
            >
              ← رجوع للعقد
            </button>
          </div>
        </section>

        {actionFeedback && (
          <div
            className="no-print"
            role={actionFeedback.type === "error" ? "alert" : "status"}
            style={getActionFeedbackStyle(actionFeedback.type)}
          >
            {actionFeedback.message}
          </div>
        )}

        {loading && (
          <section className="no-print" style={loadingBox}>
            جاري تحميل بيانات العقد...
          </section>
        )}

        {pageError && (
          <section className="no-print" style={errorBox}>
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

        {!loading && !pageError && !contract && (
          <section className="no-print" style={emptyBox}>
            لم يتم العثور على العقد أو أنه لا يتبع هذا الفرع
          </section>
        )}

        {contract && (
          <section
            ref={contractPrintRef}
            id="contract-print-area"
            data-pdf-page="contract"
            style={printArea}
          >
            <PrintHeader
              title="عقد بيع * شراء"
              organizationSettings={organizationSettings}
              contractNumber={contract.contract_number}
              contractIssueDate={contractIssueDate}
            />

            <div style={contentBox}>
              <p style={paragraph}>
                الحمد لله والصلاة والسلام على من لا نبي بعده، وبعد:
              </p>

              <p style={paragraph}>
                أقر أنا الموقع أدناه الطرف الثاني /{" "}
                <strong>{customerName}</strong>
                ، رقم الهوية / <strong>{nationalId}</strong>
                {" - "}تاريخ الميلاد /{" "}
                <strong style={numericDateText}>{birthHijri}</strong>
                ، رقم الجوال / <strong>{phone}</strong>
                ، بأني اشتريت من الطرف الأول /{" "}
                <strong>{contractFirstPartyName}</strong>
                ، سجل تجاري رقم /{" "}
                <strong>{contractFirstPartyIdentifier}</strong>
                . بمبلغ وقدره /{" "}
                <strong>{formatMoney(contractPaymentAmount)}</strong>{" "}
                (<strong>{contractPaymentAmountWords}</strong>) ريال سعودي.
              </p>

              <p style={paragraph}>
                وذلك مقابل /{" "}
                <strong>{contract.product_name || "................"}</strong>
                ، وعددها /{" "}
                <strong>{contract.product_quantity || "-"}</strong>.
              </p>

              <p style={paragraph}>
                ويلتزم الطرف الثاني بسداد مبلغ الشراء وقدره /{" "}
                <strong>{formatMoney(contractPaymentAmount)}</strong>{" "}
                (<strong>{contractPaymentAmountWords}</strong>) ريال سعودي،
                وأن يكون تاريخ السداد بتاريخ /{" "}
                <strong style={numericDateText}>{paymentDueDate}</strong>.
              </p>

              {legalCity && (
                <p style={paragraph}>
                  وأن تكون مدينة التقاضي في حال المطالبة /{" "}
                  <strong>{legalCity}</strong>.
                </p>
              )}

              <p style={paragraph}>
                كما يقر الطرف الثاني بأنه اطلع على كامل بنود هذا العقد،
                وأنه قبل البيع وأنه ملتزم بالسداد في الموعد المتفق عليه
                والمذكور في هذا العقد، وفي حال التأخر يحق للطرف الأول اتخاذ
                الإجراءات النظامية اللازمة للمطالبة بكامل المبلغ المتبقي.
              </p>
            </div>

            <div className="contract-signatures" style={signatures}>
              <div style={signatureBox}>
                <strong>الطرف الأول البائع</strong>
                <div>الاسم / {contractFirstPartyName}</div>
                <div>
                  سجل تجاري رقم /{" "}
                  {contractFirstPartyIdentifier}
                </div>
                <div>التوقيع / ................</div>
              </div>

              <div style={signatureBox}>
                <strong>الطرف الثاني المشتري</strong>
                <div>الاسم / {customerName}</div>
                <div>رقم الهوية / {nationalId}</div>
                <div>الجوال / {phone}</div>
                <div>التوقيع / ................</div>
              </div>
            </div>

            {hasGuarantor && (
              <div style={guarantorBox}>
                <strong>الكفيل الغارم</strong>

                <div
                  className="contract-guarantor-grid"
                  style={guarantorGrid}
                >
                  <div>الاسم / {guarantorName}</div>
                  <div>رقم الهوية / {guarantorNationalId}</div>
                  <div>الجوال / {guarantorPhone}</div>
                  <div>
                    تاريخ الميلاد /{" "}
                    <span style={numericDateText}>
                      {guarantorBirthHijri}
                    </span>
                  </div>
                  {guarantorWork && <div>العمل / {guarantorWork}</div>}
                </div>

                <div>التوقيع / ................</div>
              </div>
            )}
          </section>
        )}
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
  contractNumber: string | number | null | undefined;
  contractIssueDate: string;
}) {
  return (
    <div className="contract-document-header" style={documentHeader}>
      <div style={documentHeaderRight}>
        <div>المملكة العربية السعودية</div>
        <div>{organizationSettings.name || "................"}</div>
        <div>
          سجل تجاري رقم /{" "}
          {organizationSettings.commercialRecord || "................"}
        </div>
        {organizationSettings.phone && (
          <div>الجوال / {organizationSettings.phone}</div>
        )}
      </div>

      <div style={documentTitle}>{title}</div>

      <div className="contract-header-left" style={documentHeaderLeft}>
        <div>رقم العقد: {contractNumber || "-"}</div>
        <div>
          تاريخ تحرير العقد:{" "}
          <span style={numericDateText}>{contractIssueDate}</span>
        </div>
      </div>
    </div>
  );
}

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const vendor = navigator.vendor || "";
  const usesAppleWebKit = /AppleWebKit/i.test(userAgent);
  const hasSafariToken = /Safari/i.test(userAgent);
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

function isShareCancellation(error: unknown) {
  return (
    error instanceof DOMException &&
    ["AbortError", "NotAllowedError"].includes(error.name)
  );
}

function buildContractPdfFileName(
  contractNumber: string | number | null | undefined
) {
  const safeContractNumber = sanitizeFileNamePart(
    contractNumber || "بدون-رقم"
  );

  return `العقد-${safeContractNumber}.pdf`;
}

function sanitizeFileNamePart(value: unknown) {
  return (
    String(value || "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 70) || "بدون-رقم"
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

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

function formatMoney(value: unknown) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeDateDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    );
}

function formatDateOnly(value?: string | null) {
  if (!value) return "-";

  const normalized = normalizeDateDigits(
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
    )}/${directMatch[3].padStart(2, "0")}`;
  }

  const parsedDate = new Date(normalized);

  if (Number.isNaN(parsedDate.getTime())) return normalized;

  const year = String(parsedDate.getFullYear());
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}/${month}/${day}`;
}

function formatHijriDate(value?: string | null) {
  if (!value) return "................";

  const normalized = normalizeDateDigits(
    String(value).trim()
  )
    .replace(/[.\-]/g, "/")
    .replace(/\s+/g, "");

  const parts = normalized.split("/");

  if (parts.length !== 3) return normalized;

  let year = "";
  let month = "";
  let day = "";

  if (parts[0].length === 4) {
    [year, month, day] = parts;
  } else if (parts[2].length === 4) {
    [day, month, year] = parts;
  } else {
    return normalized;
  }

  return `${year}/${month.padStart(2, "0")}/${day.padStart(2, "0")}`;
}

function amountToArabicWords(value: number) {
  const safeValue = Math.abs(value);
  const riyals = Math.floor(safeValue);
  const halalas = Math.round((safeValue - riyals) * 100);

  const riyalWords =
    riyals === 0 ? "صفر" : integerToArabicWords(riyals);

  let result = `${riyalWords} ريال سعودي`;

  if (halalas > 0) {
    result += ` و${integerToArabicWords(halalas)} هللة`;
  }

  return `${result} فقط لا غير`;
}

function integerToArabicWords(value: number): string {
  const integer = Math.floor(Math.abs(value));

  if (integer === 0) return "صفر";

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

  for (const group of groups) {
    const count = Math.floor(remaining / group.value);

    if (count > 0) {
      parts.push(
        renderArabicScale(
          count,
          group.singular,
          group.dual,
          group.plural
        )
      );
      remaining %= group.value;
    }
  }

  if (remaining > 0) {
    parts.push(numberBelowThousandToArabic(remaining));
  }

  return parts.filter(Boolean).join(" و");
}

function renderArabicScale(
  count: number,
  singular: string,
  dual: string,
  plural: string
) {
  if (count === 1) return singular;
  if (count === 2) return dual;

  if (count >= 3 && count <= 10) {
    return `${numberBelowThousandToArabic(count)} ${plural}`;
  }

  return `${numberBelowThousandToArabic(count)} ${singular}`;
}

function numberBelowThousandToArabic(value: number): string {
  const number = Math.floor(value);

  if (number === 0) return "";

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

  const teens: Record<number, string> = {
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
  const hundred = Math.floor(number / 100);
  const remainder = number % 100;

  if (hundred > 0) {
    parts.push(hundreds[hundred]);
  }

  if (remainder > 0) {
    if (remainder < 10) {
      parts.push(units[remainder]);
    } else if (remainder < 20) {
      parts.push(teens[remainder]);
    } else {
      const ten = Math.floor(remainder / 10);
      const unit = remainder % 10;

      if (unit > 0) {
        parts.push(`${units[unit]} و${tens[ten]}`);
      } else {
        parts.push(tens[ten]);
      }
    }
  }

  return parts.join(" و");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error || fallback;
  return fallback;
}

function getActionButtonStyle(
  baseStyle: CSSProperties,
  disabled: boolean
): CSSProperties {
  return {
    ...baseStyle,
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
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
    color: "#111827",
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
    gridTemplateColumns:
      "minmax(250px,315px) 1fr minmax(220px,315px)",
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

function getMainWorkstationButtonStyle(
  isMobile: boolean
): CSSProperties {
  return {
    width: isMobile ? "100%" : 220,
    maxWidth: isMobile ? 280 : 220,
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
    fontFamily: "var(--font-almarai), sans-serif",
    fontSize: screen === "mobile" ? 24 : screen === "tablet" ? 26 : 28,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile" || screen === "tablet") {
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

const printControlsCard: CSSProperties = {
  width: "100%",
  maxWidth: 850,
  margin: "0 auto 14px",
  padding: 14,
  border: "1px solid rgba(203,213,225,0.92)",
  borderRadius: 18,
  background: "rgba(255,255,255,0.94)",
  boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
};

const documentActionGrid: CSSProperties = {
  display: "grid",
  gap: 10,
};

const actionButtonBase: CSSProperties = {
  width: "100%",
  minHeight: 50,
  padding: "12px 14px",
  border: "none",
  borderRadius: 13,
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
  transition:
    "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
};

const printButton: CSSProperties = {
  ...actionButtonBase,
  background: "linear-gradient(135deg,#0d47a1,#1565c0 55%,#0284c7)",
  boxShadow: "0 8px 20px rgba(13,71,161,0.20)",
};

const saveButton: CSSProperties = {
  ...actionButtonBase,
  background: "linear-gradient(135deg,#6d28d9,#7c3aed 55%,#8b5cf6)",
  boxShadow: "0 8px 20px rgba(109,40,217,0.20)",
};

const whatsappButton: CSSProperties = {
  ...actionButtonBase,
  background: "linear-gradient(135deg,#16a34a,#22c55e 55%,#10b981)",
  boxShadow: "0 8px 20px rgba(22,163,74,0.22)",
};

const backTopButton: CSSProperties = {
  ...actionButtonBase,
  background: "linear-gradient(135deg,#475569,#1e293b)",
  boxShadow: "0 8px 20px rgba(30,41,59,0.18)",
  cursor: "pointer",
};

const actionFeedbackBase: CSSProperties = {
  width: "100%",
  maxWidth: 850,
  margin: "0 auto 14px",
  padding: "13px 15px",
  borderRadius: 13,
  textAlign: "center",
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.7,
};

const loadingBox: CSSProperties = {
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  padding: 15,
  marginBottom: 14,
  color: "#1d4ed8",
  textAlign: "center",
  fontWeight: 900,
};

const errorBox: CSSProperties = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 14,
  padding: 14,
  marginBottom: 14,
  color: "#9a3412",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  fontWeight: 900,
};

const retryButton: CSSProperties = {
  minHeight: 38,
  padding: "8px 14px",
  border: "none",
  borderRadius: 10,
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 900,
  fontFamily: "var(--font-almarai), sans-serif",
};

const emptyBox: CSSProperties = {
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 24,
  marginBottom: 16,
  color: "#64748b",
  textAlign: "center",
  fontWeight: 900,
};

const printArea: CSSProperties = {
  background: "#ffffff",
  width: "210mm",
  height: "297mm",
  minHeight: "297mm",
  maxHeight: "297mm",
  margin: "0 auto",
  overflow: "hidden",
  padding: "8mm 10mm",
  borderRadius: 0,
  lineHeight: 1.45,
  color: "#111827",
  boxSizing: "border-box",
  pageBreakInside: "avoid",
  boxShadow: "0 14px 35px rgba(15,23,42,0.08)",
};

const documentHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.25fr 1fr 1.25fr",
  alignItems: "start",
  gap: 10,
  marginBottom: 12,
  borderBottom: "1.5px solid #111827",
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
  fontFamily: "var(--font-almarai), sans-serif",
};

const contentBox: CSSProperties = {
  marginTop: 10,
};

const paragraph: CSSProperties = {
  fontSize: 12.3,
  margin: "6px 0",
  textAlign: "justify",
};

const numericDateText: CSSProperties = {
  display: "inline-block",
  direction: "ltr",
  unicodeBidi: "isolate",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

const signatures: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginTop: 17,
};

const signatureBox: CSSProperties = {
  borderTop: "1.5px solid #111827",
  paddingTop: 8,
  lineHeight: 1.65,
  fontSize: 12.2,
  minHeight: 84,
};

const guarantorBox: CSSProperties = {
  marginTop: 14,
  borderTop: "1.5px solid #111827",
  paddingTop: 8,
  lineHeight: 1.65,
  fontSize: 12.2,
};

const guarantorGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "2px 14px",
  marginTop: 4,
  marginBottom: 4,
};
