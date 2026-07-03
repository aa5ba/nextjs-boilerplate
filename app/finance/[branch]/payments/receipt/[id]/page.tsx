"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";
import {
  clearFinanceSession,
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  redirectToFinanceLogin,
  validateFinanceSession,
  type FinanceSessionUser,
} from "@/lib/financeSession";

type CustomerRelation = {
  full_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
};

type ContractRelation = {
  id: string;
  branch_id?: string | null;
  contract_number?: string | null;
  debt_amount?: number | string | null;
  payment_amount?: number | string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  contract_status?: string | null;
  customer_name?: string | null;
  customer_national_id?: string | null;
  customer_phone?: string | null;
  customer?:
    | CustomerRelation
    | CustomerRelation[]
    | null;
};

type PaymentReceipt = {
  id: string;
  branch_id?: string | null;
  contract_id?: string | null;
  receipt_number?: string | null;
  receipt_no?: string | null;
  payment_number?: string | null;
  payment_amount?: number | string | null;
  remaining_amount_after?: number | string | null;
  remaining_amount?: number | string | null;
  payment_type?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
};

type OrganizationSettingsState = {
  name: string;
  phone: string;
  city: string;
  commercialRecord: string;
  logoUrl: string;
};

type ReceiptRowProps = {
  label: string;
  value: string | number | null | undefined;
};

type ActionFeedback = {
  type: "success" | "info" | "error";
  message: string;
};

type PdfResult = {
  blob: Blob;
  fileName: string;
};

type PdfOptions = {
  autoPrint?: boolean;
};

export default function PaymentReceiptPage() {
  const params = useParams();
  const router = useRouter();

  const branch =
    typeof params.branch === "string"
      ? params.branch.trim()
      : "";

  const paymentId =
    typeof params.id === "string"
      ? params.id.trim()
      : "";

  const receiptPrintRef =
    useRef<HTMLElement | null>(null);

  const [sessionUser, setSessionUser] =
    useState<FinanceSessionUser | null>(
      null
    );

  const [authChecked, setAuthChecked] =
    useState(false);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [payment, setPayment] =
    useState<PaymentReceipt | null>(null);

  const [contract, setContract] =
    useState<ContractRelation | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState("");

  const [printingPdf, setPrintingPdf] =
    useState(false);

  const [exportingPdf, setExportingPdf] =
    useState(false);

  const [sharingWhatsapp, setSharingWhatsapp] =
    useState(false);

  const [actionFeedback, setActionFeedback] =
    useState<ActionFeedback | null>(null);

  const [organizationSettings, setOrganizationSettings] =
    useState<OrganizationSettingsState>({
      name: "احتساب",
      phone: "",
      city: "",
      commercialRecord: "",
      logoUrl: "",
    });

  useEffect(() => {
    let cancelled = false;

    async function initializePage() {
      setLoading(true);
      setPageError("");
      setAuthChecked(false);

      if (!branch) {
        clearFinanceSession();
        router.replace("/login");
        return;
      }

      if (!paymentId) {
        setPayment(null);
        setContract(null);
        setPageError(
          "رابط الإيصال غير مكتمل"
        );
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      const validation =
        validateFinanceSession(branch);

      if (
        !validation.valid ||
        !validation.user
      ) {
        redirectToFinanceLogin(router, {
          branchSlug: branch,
        });
        return;
      }

      const authenticatedUser =
        validation.user;

      const currentBranchId = String(
        authenticatedUser.branch_id || ""
      ).trim();

      if (!currentBranchId) {
        clearFinanceSession();
        redirectToFinanceLogin(router, {
          branchSlug: branch,
        });
        return;
      }

      if (cancelled) {
        return;
      }

      setSessionUser(authenticatedUser);
      setEmployeeName(
        getFinanceEmployeeName(
          authenticatedUser
        )
      );
      setAuthChecked(true);

      await loadReceipt(
        currentBranchId,
        () => cancelled
      );
    }

    void initializePage();

    return () => {
      cancelled = true;
    };
  }, [branch, paymentId, router]);

  useEffect(() => {
    if (!authChecked || !sessionUser) {
      return;
    }

    const uninstall =
      installFinanceActivityTracker({
        expectedBranchSlug: branch,

        onExpired: () => {
          redirectToFinanceLogin(router, {
            branchSlug: branch,
          });
        },

        onInvalidated: () => {
          clearFinanceSession();
          router.replace("/login");
        },

        onSessionUpdated: (
          updatedUser
        ) => {
          const updatedBranchId = String(
            updatedUser.branch_id || ""
          ).trim();

          if (!updatedBranchId) {
            clearFinanceSession();
            router.replace("/login");
            return;
          }

          setSessionUser(updatedUser);
          setEmployeeName(
            getFinanceEmployeeName(
              updatedUser
            )
          );
        },
      });

    return uninstall;
  }, [
    authChecked,
    branch,
    router,
    sessionUser?.id,
  ]);

  useEffect(() => {
    const style =
      document.createElement("style");

    style.setAttribute(
      "data-payment-receipt-print",
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
        font-family: var(--font-almarai), sans-serif;
        -webkit-tap-highlight-color: transparent;
      }

      @media print {
        html,
        body {
          width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          overflow: hidden !important;
          print-color-adjust: exact !important;
          -webkit-print-color-adjust: exact !important;
        }

        body * {
          visibility: hidden !important;
        }

        #receipt-print-area,
        #receipt-print-area * {
          visibility: visible !important;
        }

        .receipt-page-main {
          width: 210mm !important;
          min-height: 297mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }

        .no-print {
          display: none !important;
        }

        #receipt-print-area {
          position: absolute !important;
          top: 14mm !important;
          right: 22.5mm !important;
          width: 165mm !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: 265mm !important;
          margin: 0 !important;
          padding: 6mm !important;
          border: 0.3mm solid #d7dee8 !important;
          border-radius: 2.4mm !important;
          box-shadow: none !important;
          overflow: hidden !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          background: #ffffff !important;
        }

        .receipt-block,
        .receipt-info-box,
        .receipt-signatures,
        .receipt-header,
        .receipt-summary {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }

      @media screen and (max-width: 760px) {
        #receipt-print-area {
          width: 100% !important;
          min-height: 0 !important;
          padding: 16px !important;
        }

        .receipt-header-grid,
        .receipt-two-columns,
        .receipt-signatures-grid,
        .receipt-summary-grid {
          grid-template-columns: 1fr !important;
        }

        .receipt-header-grid {
          text-align: center !important;
        }

        .receipt-country-box,
        .receipt-meta-top,
        .receipt-brand-box {
          justify-items: center !important;
          text-align: center !important;
        }

        .receipt-meta-top {
          align-items: center !important;
        }
      }
    `;

    document.head.appendChild(style);

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  async function loadReceipt(
    currentBranchId: string,
    isCancelled: () => boolean =
      () => false
  ) {
    try {
      setLoading(true);
      setPageError("");
      setActionFeedback(null);
      setPayment(null);
      setContract(null);

      const {
        data: paymentData,
        error: paymentError,
      } = await supabase
        .from("finance_payments")
        .select("*")
        .eq("id", paymentId)
        .eq("branch_id", currentBranchId)
        .maybeSingle();

      if (isCancelled()) {
        return;
      }

      if (paymentError || !paymentData) {
        throw new Error(
          paymentError?.message ||
            "الإيصال غير موجود"
        );
      }

      const typedPayment =
        paymentData as PaymentReceipt;

      const linkedContractId = String(
        typedPayment.contract_id || ""
      ).trim();

      let contractData:
        | ContractRelation
        | null = null;

      if (linkedContractId) {
        const {
          data: loadedContract,
          error: contractError,
        } = await supabase
          .from("finance_contracts")
          .select(
            `
              id,
              branch_id,
              contract_number,
              debt_amount,
              payment_amount,
              paid_amount,
              remaining_amount,
              contract_status,
              customer_name,
              customer_national_id,
              customer_phone,
              customer:finance_customers!finance_contracts_customer_id_fkey(
                full_name,
                national_id,
                phone
              )
            `
          )
          .eq("id", linkedContractId)
          .eq("branch_id", currentBranchId)
          .maybeSingle();

        if (isCancelled()) {
          return;
        }

        if (contractError) {
          throw new Error(
            contractError.message
          );
        }

        contractData =
          loadedContract as
            | ContractRelation
            | null;
      }

      const [
        orgSettings,
        branchResult,
      ] = await Promise.all([
        getOrganizationSettings(),

        supabase
          .from("finance_branches")
          .select(
            `
              branch_name,
              organization_name,
              city,
              commercial_record,
              phone
            `
          )
          .eq("id", currentBranchId)
          .maybeSingle(),
      ]);

      if (isCancelled()) {
        return;
      }

      if (branchResult.error) {
        console.error(
          "Load receipt branch error:",
          branchResult.error
        );
      }

      const branchData =
        branchResult.data;

      const organizationLogo =
        orgSettings &&
        typeof orgSettings === "object" &&
        "logoUrl" in orgSettings &&
        typeof orgSettings.logoUrl ===
          "string"
          ? orgSettings.logoUrl
          : "";

      setOrganizationSettings({
        name:
          branchData?.organization_name ||
          orgSettings?.name ||
          branchData?.branch_name ||
          "احتساب",

        phone:
          branchData?.phone ||
          orgSettings?.phone ||
          "",

        city:
          branchData?.city ||
          orgSettings?.city ||
          "",

        commercialRecord:
          branchData?.commercial_record ||
          orgSettings?.commercialRecord ||
          "",

        logoUrl: organizationLogo,
      });

      setPayment(typedPayment);
      setContract(contractData);
    } catch (error) {
      console.error(
        "Load payment receipt error:",
        error
      );

      if (!isCancelled()) {
        setPayment(null);
        setContract(null);
        setPageError(
          getErrorMessage(
            error,
            "حدث خطأ غير متوقع أثناء تحميل الإيصال"
          )
        );
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  const customer =
    useMemo<CustomerRelation | null>(
      () => {
        const relation =
          contract?.customer;

        if (Array.isArray(relation)) {
          return relation[0] || null;
        }

        return relation || null;
      },
      [contract]
    );

  const customerName =
    contract?.customer_name ||
    customer?.full_name ||
    "................";

  const customerNationalId =
    contract?.customer_national_id ||
    customer?.national_id ||
    "-";

  const customerPhone =
    contract?.customer_phone ||
    customer?.phone ||
    "-";

  const receiptNumber = useMemo(
    () => getReceiptNumber(payment),
    [payment]
  );

  const paymentAmount = Number(
    payment?.payment_amount || 0
  );

  const remainingAmount = Number(
    payment?.remaining_amount_after ??
      payment?.remaining_amount ??
      contract?.remaining_amount ??
      0
  );

  const paymentDate =
    formatGregorianDate(
      payment?.created_at
    );

  const paymentTime =
    formatTime(payment?.created_at);

  const paymentEmployeeName =
    payment?.created_by_name ||
    payment?.created_by ||
    employeeName ||
    "الموظف";

  const linkedContractId = String(
    contract?.id ||
      payment?.contract_id ||
      ""
  ).trim();

  const receiptUnavailable =
    loading ||
    Boolean(pageError) ||
    !payment;

  function goToContract() {
    if (!linkedContractId) {
      setActionFeedback({
        type: "error",
        message:
          "تعذر تحديد العقد المرتبط بهذا الإيصال.",
      });
      return;
    }

    router.push(
      `/finance/${branch}/contracts/${linkedContractId}`
    );
  }

  function goToNewPayment() {
    const destination =
      linkedContractId
        ? `/finance/${branch}/payments/new?contract=${linkedContractId}`
        : `/finance/${branch}/payments/new`;

    router.push(destination);
  }

  async function createReceiptPdf(
    options: PdfOptions = {}
  ): Promise<PdfResult> {
    const receiptElement =
      receiptPrintRef.current;

    if (!payment || !receiptElement) {
      throw new Error(
        "تعذر العثور على الإيصال لإنشاء الملف"
      );
    }

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await waitForImages(
      receiptElement
    );

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

    const canvas = await html2canvas(
      receiptElement,
      {
        backgroundColor: "#ffffff",
        scale: 2.2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        windowWidth: 1400,
        scrollX: 0,
        scrollY: 0,

        onclone: (clonedDocument) => {
          clonedDocument.documentElement.style.background =
            "#ffffff";
          clonedDocument.body.style.background =
            "#ffffff";

          const clonedReceipt =
            clonedDocument.querySelector<HTMLElement>(
              "#receipt-print-area"
            );

          if (!clonedReceipt) {
            return;
          }

          clonedReceipt.style.width =
            "165mm";
          clonedReceipt.style.height =
            "auto";
          clonedReceipt.style.minHeight =
            "0";
          clonedReceipt.style.maxHeight =
            "none";
          clonedReceipt.style.margin =
            "0";
          clonedReceipt.style.padding =
            "6mm";
          clonedReceipt.style.border =
            "1px solid #d7dee8";
          clonedReceipt.style.borderRadius =
            "9px";
          clonedReceipt.style.boxShadow =
            "none";
          clonedReceipt.style.overflow =
            "hidden";
          clonedReceipt.style.background =
            "#ffffff";
        },
      }
    );

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    if (options.autoPrint) {
      const printablePdf =
        pdf as typeof pdf & {
          autoPrint?: (
            autoPrintOptions?: {
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

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    const maxImageWidth = 165;
    const maxImageHeight = 263;

    const canvasRatio =
      canvas.width / canvas.height;

    let imageWidth = maxImageWidth;
    let imageHeight =
      imageWidth / canvasRatio;

    if (imageHeight > maxImageHeight) {
      imageHeight = maxImageHeight;
      imageWidth =
        imageHeight * canvasRatio;
    }

    const imageX =
      (pageWidth - imageWidth) / 2;

    const imageY = Math.max(
      12,
      (pageHeight - imageHeight) / 2
    );

    pdf.addImage(
      canvas.toDataURL(
        "image/jpeg",
        0.96
      ),
      "JPEG",
      imageX,
      imageY,
      imageWidth,
      imageHeight,
      undefined,
      "FAST"
    );

    const fileName =
      buildReceiptFileName(
        receiptNumber,
        paymentId
      );

    return {
      blob: pdf.output("blob"),
      fileName,
    };
  }

  async function printReceipt() {
    if (receiptUnavailable) {
      setActionFeedback({
        type: "error",
        message:
          "انتظر حتى يكتمل تحميل الإيصال.",
      });
      return;
    }

    if (printingPdf) {
      return;
    }

    const printWindow = window.open(
      "",
      "_blank"
    );

    if (!printWindow) {
      setActionFeedback({
        type: "error",
        message:
          "تعذر فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مرة أخرى.",
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
          <title>جاري تجهيز الإيصال</title>
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
              width: min(520px,100%);
              padding: 24px;
              border: 1px solid #dbeafe;
              border-radius: 18px;
              background: #ffffff;
              text-align: center;
              font-size: 18px;
              font-weight: 700;
              line-height: 1.8;
              box-shadow: 0 16px 40px rgba(15,23,42,0.10);
            }
          </style>
        </head>
        <body>
          <div class="message">
            جاري إنشاء إيصال PDF من صفحة واحدة وفتحه للطباعة...
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    try {
      printWindow.opener = null;
    } catch {
      // بعض المتصفحات تمنع تعديل opener، ولا يؤثر ذلك على الطباعة.
    }

    setPrintingPdf(true);
    setActionFeedback(null);

    try {
      const { blob } =
        await createReceiptPdf({
          autoPrint: true,
        });

      const pdfUrl =
        URL.createObjectURL(blob);

      printWindow.location.replace(
        pdfUrl
      );
      printWindow.focus();

      window.setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 120_000);

      setActionFeedback({
        type: "success",
        message:
          "تم فتح إيصال PDF من صفحة واحدة للطباعة.",
      });
    } catch (error) {
      printWindow.close();

      console.error(
        "Print receipt PDF error:",
        error
      );

      setActionFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "تعذر تجهيز الإيصال للطباعة"
        ),
      });
    } finally {
      setPrintingPdf(false);
    }
  }

  async function downloadPdf() {
    if (
      receiptUnavailable ||
      exportingPdf
    ) {
      if (!exportingPdf) {
        setActionFeedback({
          type: "error",
          message:
            "انتظر حتى يكتمل تحميل الإيصال.",
        });
      }
      return;
    }

    setExportingPdf(true);
    setActionFeedback(null);

    try {
      const { blob, fileName } =
        await createReceiptPdf();

      downloadBlob(blob, fileName);

      setActionFeedback({
        type: "success",
        message:
          "تم حفظ إيصال PDF من صفحة واحدة بنجاح.",
      });
    } catch (error) {
      console.error(
        "Export receipt PDF error:",
        error
      );

      setActionFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "تعذر تحميل الإيصال بصيغة PDF"
        ),
      });
    } finally {
      setExportingPdf(false);
    }
  }

  async function shareReceiptOnWhatsapp() {
    if (
      receiptUnavailable ||
      sharingWhatsapp
    ) {
      if (!sharingWhatsapp) {
        setActionFeedback({
          type: "error",
          message:
            "انتظر حتى يكتمل تحميل الإيصال.",
        });
      }
      return;
    }

    setSharingWhatsapp(true);
    setActionFeedback(null);

    try {
      const { blob, fileName } =
        await createReceiptPdf();

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
        title: `إيصال سداد ${receiptNumber}`,
      };

      const canSharePdf =
        typeof navigator !==
          "undefined" &&
        typeof navigator.share ===
          "function" &&
        typeof navigator.canShare ===
          "function" &&
        navigator.canShare(shareData);

      if (!canSharePdf) {
        downloadBlob(
          blob,
          fileName
        );

        setActionFeedback({
          type: "info",
          message:
            "هذا المتصفح لا يدعم مشاركة ملفات PDF مباشرة. تم حفظ الإيصال على الجهاز لتشاركه من تطبيق الملفات عبر واتساب.",
        });
        return;
      }

      await navigator.share(shareData);

      setActionFeedback({
        type: "success",
        message:
          "تم فتح نافذة مشاركة ملف PDF. اختر واتساب لإرسال الإيصال.",
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setActionFeedback({
          type: "info",
          message:
            "تم إلغاء مشاركة الإيصال.",
        });
        return;
      }

      console.error(
        "Share receipt PDF error:",
        error
      );

      setActionFeedback({
        type: "error",
        message: getErrorMessage(
          error,
          "تعذر إنشاء الإيصال أو مشاركته"
        ),
      });
    } finally {
      setSharingWhatsapp(false);
    }
  }

  if (!authChecked || loading) {
    return (
      <main
        dir="rtl"
        className="receipt-page-main"
        style={page}
      >
        <div style={loadingBox}>
          جاري تحميل الإيصال...
        </div>
      </main>
    );
  }

  if (pageError || !payment) {
    return (
      <main
        dir="rtl"
        className="receipt-page-main"
        style={page}
      >
        <div style={loadingBox}>
          {pageError ||
            "لم يتم العثور على الإيصال."}

          <div style={errorActions}>
            <button
              type="button"
              style={backButton}
              onClick={() =>
                router.back()
              }
            >
              ← رجوع
            </button>

            <button
              type="button"
              style={homeButton}
              onClick={() =>
                router.push(
                  `/finance/${branch}`
                )
              }
            >
              محطة العمل الرئيسية
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="receipt-page-main"
      style={page}
    >
      <div
        className="no-print"
        style={actionsCard}
      >
        <div style={actionsWrapper}>
          <button
            type="button"
            style={getActionButtonStyle(
              printButton,
              receiptUnavailable ||
                printingPdf
            )}
            disabled={
              receiptUnavailable ||
              printingPdf
            }
            onClick={() =>
              void printReceipt()
            }
          >
            {printingPdf
              ? "جاري تجهيز الطباعة..."
              : "طباعة الإيصال"}
          </button>

          <button
            type="button"
            style={getActionButtonStyle(
              pdfButton,
              receiptUnavailable ||
                exportingPdf
            )}
            disabled={
              receiptUnavailable ||
              exportingPdf
            }
            onClick={() =>
              void downloadPdf()
            }
          >
            {exportingPdf
              ? "جاري تجهيز PDF..."
              : "حفظ PDF"}
          </button>

          <button
            type="button"
            style={getActionButtonStyle(
              whatsappButton,
              receiptUnavailable ||
                sharingWhatsapp
            )}
            disabled={
              receiptUnavailable ||
              sharingWhatsapp
            }
            onClick={() =>
              void shareReceiptOnWhatsapp()
            }
          >
            {sharingWhatsapp
              ? "جاري تجهيز الملف..."
              : "مشاركة PDF عبر واتساب"}
          </button>

          <button
            type="button"
            style={getActionButtonStyle(
              contractButton,
              !linkedContractId
            )}
            disabled={!linkedContractId}
            onClick={goToContract}
          >
            العودة إلى العقد
          </button>

          <button
            type="button"
            style={paymentButton}
            onClick={goToNewPayment}
          >
            إجراء سداد آخر
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
          className="no-print"
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

      <section
        id="receipt-print-area"
        ref={receiptPrintRef}
        style={printArea}
      >
        <header
          className="receipt-header receipt-header-grid"
          style={receiptHeader}
        >
          <div
            className="receipt-country-box"
            style={countryBox}
          >
            <strong>
              المملكة العربية السعودية
            </strong>

            {organizationSettings.city && (
              <span>
                {organizationSettings.city}
              </span>
            )}
          </div>

          <div
            className="receipt-brand-box"
            style={brandBox}
          >
            {organizationSettings.logoUrl ? (
              <img
                src={
                  organizationSettings.logoUrl
                }
                crossOrigin="anonymous"
                alt={
                  organizationSettings.name
                }
                style={logoImage}
              />
            ) : (
              <div
                style={organizationNameBox}
              >
                {organizationSettings.name}
              </div>
            )}

            <div style={orgMeta}>
              {organizationSettings.commercialRecord && (
                <span>
                  سجل تجاري: {" "}
                  {
                    organizationSettings.commercialRecord
                  }
                </span>
              )}

              {organizationSettings.phone && (
                <span>
                  جوال: {" "}
                  {organizationSettings.phone}
                </span>
              )}
            </div>
          </div>

          <div
            className="receipt-meta-top"
            style={receiptMetaTop}
          >
            <strong style={receiptTitle}>
              إيصال سداد
            </strong>

            <span>
              رقم الإيصال: {" "}
              <b>{receiptNumber}</b>
            </span>

            <span>{paymentDate}</span>
          </div>
        </header>

        <section
          className="receipt-summary receipt-summary-grid"
          style={summaryGrid}
        >
          <div style={summaryItem}>
            <span style={summaryLabel}>
              المبلغ المستلم
            </span>

            <strong style={summaryAmount}>
              {formatMoney(paymentAmount)} ر.س
            </strong>
          </div>

          <div style={summaryItem}>
            <span style={summaryLabel}>
              المتبقي بعد السداد
            </span>

            <strong style={summaryRemaining}>
              {formatMoney(remainingAmount)} ر.س
            </strong>
          </div>
        </section>

        <section
          className="receipt-block receipt-two-columns"
          style={twoColumns}
        >
          <div
            className="receipt-info-box"
            style={infoBox}
          >
            <h2 style={boxTitle}>
              بيانات العقد والعميل
            </h2>

            <Row
              label="رقم العقد"
              value={
                contract?.contract_number ||
                "-"
              }
            />

            <Row
              label="اسم العميل"
              value={customerName}
            />

            <Row
              label="رقم الهوية"
              value={customerNationalId}
            />

            <Row
              label="رقم الجوال"
              value={customerPhone}
            />
          </div>

          <div
            className="receipt-info-box"
            style={infoBox}
          >
            <h2 style={boxTitle}>
              بيانات السداد
            </h2>

            <Row
              label="نوع السداد"
              value={
                payment.payment_type || "-"
              }
            />

            <Row
              label="طريقة الدفع"
              value={
                payment.payment_method ||
                payment.notes ||
                "-"
              }
            />

            <Row
              label="تاريخ السداد"
              value={paymentDate}
            />

            <Row
              label="وقت السداد"
              value={paymentTime}
            />

            <Row
              label="الموظف"
              value={paymentEmployeeName}
            />
          </div>
        </section>

        <section
          className="receipt-block"
          style={statementBox}
        >
          <p style={paragraph}>
            تشهد {" "}
            <strong>
              {organizationSettings.name}
            </strong>{" "}
            باستلام مبلغ وقدره {" "}
            <strong>
              {formatMoney(paymentAmount)}
            </strong>{" "}
            ريال سعودي من العميل {" "}
            <strong>{customerName}</strong>
            ، وذلك كسداد على العقد رقم {" "}
            <strong>
              {contract?.contract_number ||
                "................"}
            </strong>
            .
          </p>

          <p style={paragraph}>
            يعد هذا الإيصال إثباتًا لعملية
            السداد الموضحة أعلاه، ولا يعد
            مخالصة نهائية إلا بعد سداد كامل
            المديونية وإصدار مخالصة مستقلة.
          </p>
        </section>

        <footer
          className="receipt-signatures receipt-signatures-grid"
          style={footerBox}
        >
          <div style={signatureBox}>
            <strong>المستلم</strong>

            <div>
              الاسم / {paymentEmployeeName}
            </div>

            <div>
              التوقيع / ................
            </div>
          </div>

          <div style={signatureBox}>
            <strong>العميل</strong>

            <div>
              الاسم / {customerName}
            </div>

            <div>
              التوقيع / ................
            </div>
          </div>
        </footer>

        <div style={receiptFooterNote}>
          تم إصدار هذا الإيصال آليًا من النظام
        </div>
      </section>
    </main>
  );
}

function Row({
  label,
  value,
}: ReceiptRowProps) {
  return (
    <div style={row}>
      <span>{label}</span>

      <strong>
        {value === null ||
        value === undefined ||
        value === ""
          ? "-"
          : value}
      </strong>
    </div>
  );
}

function getReceiptNumber(
  payment: PaymentReceipt | null
) {
  if (!payment) {
    return "-";
  }

  if (payment.receipt_number) {
    return String(
      payment.receipt_number
    );
  }

  if (payment.receipt_no) {
    return String(payment.receipt_no);
  }

  if (payment.payment_number) {
    return String(
      payment.payment_number
    );
  }

  const createdAt =
    payment.created_at
      ? new Date(payment.created_at)
      : new Date();

  const year = String(
    createdAt.getFullYear()
  ).slice(2);

  const month = String(
    createdAt.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    createdAt.getDate()
  ).padStart(2, "0");

  const shortId = String(
    payment.id || ""
  )
    .replace(/-/g, "")
    .slice(-6)
    .toUpperCase();

  return `REC-${year}${month}${day}-${
    shortId || "000000"
  }`;
}

function formatGregorianDate(
  date?: string | null
) {
  if (!date) {
    return "-";
  }

  const parsedDate = new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "-";
  }

  const day = String(
    parsedDate.getDate()
  ).padStart(2, "0");

  const month = String(
    parsedDate.getMonth() + 1
  ).padStart(2, "0");

  const year =
    parsedDate.getFullYear();

  return `${day}/${month}/${year}`;
}

function formatTime(
  date?: string | null
) {
  if (!date) {
    return "-";
  }

  const parsedDate = new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "-";
  }

  return parsedDate.toLocaleTimeString(
    "ar-SA",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatMoney(
  value:
    | number
    | string
    | null
    | undefined
) {
  const number = Number(value || 0);

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

function getErrorMessage(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === "string") {
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
    opacity: disabled ? 0.58 : 1,
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

async function waitForImages(
  rootElement: HTMLElement
) {
  const images = Array.from(
    rootElement.querySelectorAll("img")
  );

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          const finish = () => {
            image.removeEventListener(
              "load",
              finish
            );
            image.removeEventListener(
              "error",
              finish
            );
            resolve();
          };

          image.addEventListener(
            "load",
            finish,
            { once: true }
          );
          image.addEventListener(
            "error",
            finish,
            { once: true }
          );
        })
    )
  );
}

function buildReceiptFileName(
  receiptNumber: string,
  paymentId: string
) {
  const safeNumber =
    sanitizeFileNamePart(
      receiptNumber || paymentId
    );

  return `إيصال-سداد-${safeNumber}.pdf`;
}

function sanitizeFileNamePart(
  value: unknown
) {
  return (
    String(value || "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "بدون-رقم"
  );
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

const page: CSSProperties = {
  minHeight: "100dvh",
  padding: 16,
  color: "#111827",
  fontFamily:
    "var(--font-almarai), sans-serif",
  backgroundColor: "#f3f7fc",
  backgroundImage: `
    radial-gradient(circle at 12% 18%, rgba(59,130,246,0.12) 0, transparent 28%),
    radial-gradient(circle at 88% 12%, rgba(168,85,247,0.07) 0, transparent 25%),
    radial-gradient(circle at 80% 88%, rgba(34,197,94,0.07) 0, transparent 28%),
    linear-gradient(rgba(246,249,255,0.78),rgba(246,249,255,0.88)),
    url('/backgrounds/v13-finance-bg-1.png')
  `,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
};

const loadingBox: CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "80px auto",
  padding: 24,
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  background: "#ffffff",
  color: "#334155",
  textAlign: "center",
  fontWeight: 900,
  lineHeight: 1.8,
  boxShadow:
    "0 14px 35px rgba(15,23,42,0.07)",
};

const errorActions: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 18,
};

const actionsCard: CSSProperties = {
  width: "100%",
  maxWidth: 980,
  margin: "0 auto 14px",
  padding: 12,
  border: "1px solid #dbe5f2",
  borderRadius: 16,
  background: "rgba(255,255,255,0.96)",
  display: "grid",
  gap: 10,
  boxShadow:
    "0 12px 30px rgba(15,23,42,0.07)",
};

const actionsWrapper: CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: 9,
};

const actionButtonBase: CSSProperties = {
  minHeight: 44,
  padding: "10px 13px",
  border: "none",
  borderRadius: 11,
  color: "#ffffff",
  fontSize: 13.5,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
  transition:
    "transform 160ms ease, opacity 160ms ease",
};

const printButton: CSSProperties = {
  ...actionButtonBase,
  background:
    "linear-gradient(135deg,#0d47a1,#1565c0 55%,#0284c7)",
};

const pdfButton: CSSProperties = {
  ...actionButtonBase,
  background:
    "linear-gradient(135deg,#475569,#1e293b)",
};

const whatsappButton: CSSProperties = {
  ...actionButtonBase,
  background:
    "linear-gradient(135deg,#16a34a,#22c55e 55%,#10b981)",
};

const contractButton: CSSProperties = {
  ...actionButtonBase,
  background:
    "linear-gradient(135deg,#7c3aed,#4f46e5)",
};

const paymentButton: CSSProperties = {
  ...actionButtonBase,
  background:
    "linear-gradient(135deg,#0891b2,#0369a1)",
};

const backButton: CSSProperties = {
  minWidth: 108,
  minHeight: 38,
  justifySelf: "center",
  padding: "8px 15px",
  border: "none",
  borderRadius: 10,
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 5px 14px rgba(21,128,61,0.20)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const homeButton: CSSProperties = {
  minHeight: 42,
  padding: "9px 14px",
  border: "none",
  borderRadius: 10,
  background:
    "linear-gradient(135deg,#16a34a,#15803d)",
  color: "#ffffff",
  fontSize: 13.5,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const actionFeedbackBase: CSSProperties = {
  width: "100%",
  maxWidth: 980,
  margin: "0 auto 14px",
  padding: "12px 14px",
  borderRadius: 12,
  textAlign: "center",
  fontSize: 13.5,
  fontWeight: 900,
  lineHeight: 1.7,
};

const printArea: CSSProperties = {
  width: "165mm",
  minHeight: 0,
  margin: "0 auto",
  padding: "6mm",
  border: "1px solid #d7dee8",
  borderRadius: 9,
  background: "#ffffff",
  color: "#111827",
  boxSizing: "border-box",
  overflow: "hidden",
  lineHeight: 1.45,
  boxShadow:
    "0 16px 36px rgba(15,23,42,0.09)",
};

const receiptHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1.25fr 1fr",
  gap: 9,
  alignItems: "start",
  borderBottom: "1px solid #d8e0ea",
  paddingBottom: 7,
  marginBottom: 8,
};

const countryBox: CSSProperties = {
  display: "grid",
  gap: 2,
  fontSize: 10.2,
  lineHeight: 1.5,
  color: "#334155",
};

const brandBox: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 3,
};

const logoImage: CSSProperties = {
  width: 48,
  height: 48,
  objectFit: "contain",
};

const organizationNameBox: CSSProperties = {
  minWidth: 135,
  maxWidth: 210,
  minHeight: 35,
  padding: "5px 10px",
  border: "1px solid #dbe7f4",
  borderRadius: 9,
  background: "#f8fbff",
  color: "#0f172a",
  fontSize: 14.5,
  fontWeight: 900,
  lineHeight: 1.4,
  textAlign: "center",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const orgMeta: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 6,
  flexWrap: "wrap",
  fontSize: 8.7,
  color: "#64748b",
};

const receiptMetaTop: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 2,
  fontSize: 9.8,
  lineHeight: 1.5,
  color: "#334155",
};

const receiptTitle: CSSProperties = {
  color: "#0f3f7a",
  fontSize: 17,
  lineHeight: 1.25,
  fontWeight: 900,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: 8,
  marginBottom: 8,
};

const summaryItem: CSSProperties = {
  display: "grid",
  gap: 3,
  padding: "7px 10px",
  border: "1px solid #dce7e2",
  borderRadius: 9,
  background: "#fbfefc",
};

const summaryLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 9.3,
  fontWeight: 800,
};

const summaryAmount: CSSProperties = {
  color: "#166534",
  fontSize: 16,
  fontWeight: 900,
};

const summaryRemaining: CSSProperties = {
  color: "#0f3f7a",
  fontSize: 15.2,
  fontWeight: 900,
};

const twoColumns: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginBottom: 8,
};

const infoBox: CSSProperties = {
  padding: 8,
  border: "1px solid #e2e8f0",
  borderRadius: 9,
  background: "#ffffff",
};

const boxTitle: CSSProperties = {
  margin: "0 0 5px",
  paddingBottom: 4,
  borderBottom: "1px solid #eef2f7",
  color: "#0f3f7a",
  fontSize: 12.2,
  fontWeight: 900,
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
  minHeight: 20,
  padding: "3px 0",
  borderBottom: "1px solid #f1f4f8",
  fontSize: 9.8,
  lineHeight: 1.45,
};

const statementBox: CSSProperties = {
  marginTop: 2,
  padding: "7px 9px",
  border: "1px solid #e2e8f0",
  borderRadius: 9,
  background: "#fcfdff",
};

const paragraph: CSSProperties = {
  margin: "3px 0",
  fontSize: 9.8,
  lineHeight: 1.65,
  textAlign: "justify",
};

const footerBox: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
  marginTop: 12,
};

const signatureBox: CSSProperties = {
  minHeight: 54,
  paddingTop: 5,
  borderTop: "1px solid #334155",
  fontSize: 9.8,
  lineHeight: 1.65,
};

const receiptFooterNote: CSSProperties = {
  marginTop: 9,
  paddingTop: 5,
  borderTop: "1px solid #e2e8f0",
  color: "#64748b",
  textAlign: "center",
  fontSize: 8.6,
};
