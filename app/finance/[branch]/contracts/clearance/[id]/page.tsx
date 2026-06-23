"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { exportElementToPdf } from "@/lib/exportElementToPdf";

type ScreenType = "mobile" | "tablet" | "desktop";

type CustomerRelation = {
  full_name?: string | null;
  national_id?: string | null;
  phone?: string | null;
};

type ContractData = {
  id: string;
  branch_id?: string | null;
  contract_number?: string | null;
  customer_name?: string | null;
  customer_national_id?: string | null;
  customer_phone?: string | null;
  debt_amount?: number | string | null;
  payment_amount?: number | string | null;
  paid_amount?: number | string | null;
  remaining_amount?: number | string | null;
  closed_at?: string | null;
  updated_at?: string | null;
  finance_customers?:
    | CustomerRelation
    | CustomerRelation[]
    | null;
};

type HeaderProps = {
  branch: string;
  contractId: string;
  router: ReturnType<typeof useRouter>;
  isMobile: boolean;
  isCompact: boolean;
};

type InfoProps = {
  label: string;
  value: string | number | null | undefined;
};

export default function ContractClearancePage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "");
  const contractId = String(params.id ?? "");

  const [contract, setContract] =
    useState<ContractData | null>(null);

  const [organizationName, setOrganizationName] =
    useState("مؤسسة سداد وأرقام");

  const [commercialRecord, setCommercialRecord] =
    useState("");

  const [loading, setLoading] = useState(true);

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 1024) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    handleResize();

    window.addEventListener(
      "resize",
      handleResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      await loadData(() => cancelled);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [branch, contractId]);

  async function loadData(
    isCancelled: () => boolean = () => false
  ) {
    setLoading(true);
    setContract(null);

    try {
      if (!branch || !contractId) {
        return;
      }

      const currentBranchId =
        await getBranchId(branch);

      if (isCancelled()) {
        return;
      }

      if (!currentBranchId) {
        alert("تعذر تحديد الفرع");
        return;
      }

      const [
        branchResult,
        contractResult,
      ] = await Promise.all([
        supabase
          .from("finance_branches")
          .select(
            `
              organization_name,
              commercial_record
            `
          )
          .eq("id", currentBranchId)
          .maybeSingle(),

        supabase
          .from("finance_contracts")
          .select(
            `
              id,
              branch_id,
              contract_number,
              customer_name,
              customer_national_id,
              customer_phone,
              debt_amount,
              payment_amount,
              paid_amount,
              remaining_amount,
              closed_at,
              updated_at,
              finance_customers(
                full_name,
                national_id,
                phone
              )
            `
          )
          .eq("id", contractId)
          .eq("branch_id", currentBranchId)
          .single(),
      ]);

      if (isCancelled()) {
        return;
      }

      if (branchResult.error) {
        console.error(
          "Load branch data error:",
          branchResult.error
        );
      }

      if (
        branchResult.data?.organization_name
      ) {
        setOrganizationName(
          branchResult.data.organization_name
        );
      }

      if (
        branchResult.data?.commercial_record
      ) {
        setCommercialRecord(
          branchResult.data.commercial_record
        );
      }

      if (
        contractResult.error ||
        !contractResult.data
      ) {
        alert(
          `تعذر تحميل المخالصة: ${
            contractResult.error?.message ||
            "العقد غير موجود"
          }`
        );

        setContract(null);
        return;
      }

      setContract(
        contractResult.data as ContractData
      );
    } catch (error) {
      console.error(
        "Load clearance error:",
        error
      );

      if (!isCancelled()) {
        setContract(null);

        alert(
          "حدث خطأ غير متوقع أثناء تحميل المخالصة"
        );
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  function getCustomer() {
    const relation =
      contract?.finance_customers;

    if (Array.isArray(relation)) {
      return relation[0] || null;
    }

    return relation || null;
  }

  function getCustomerName() {
    const customer = getCustomer();

    return (
      customer?.full_name ||
      contract?.customer_name ||
      "-"
    );
  }

  function getCustomerNationalId() {
    const customer = getCustomer();

    return (
      customer?.national_id ||
      contract?.customer_national_id ||
      "-"
    );
  }

  const clearanceDate =
    formatGregorianDate(
      contract?.closed_at ||
        contract?.updated_at ||
        new Date().toISOString()
    );

  const pdfFileName = `clearance-${
    contract?.contract_number ||
    contractId
  }`;

  if (loading) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(isCompact)}
      >
        <style>{printStyles}</style>

        <div
          style={getContainerStyle(isCompact)}
          className="no-print"
        >
          <Header
            branch={branch}
            contractId={contractId}
            router={router}
            isMobile={isMobile}
            isCompact={isCompact}
          />
        </div>

        <div style={loadingBox}>
          جاري تحميل المخالصة...
        </div>
      </main>
    );
  }

  if (!contract) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(isCompact)}
      >
        <style>{printStyles}</style>

        <div
          style={getContainerStyle(isCompact)}
          className="no-print"
        >
          <Header
            branch={branch}
            contractId={contractId}
            router={router}
            isMobile={isMobile}
            isCompact={isCompact}
          />
        </div>

        <div style={loadingBox}>
          لم يتم العثور على العقد
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={getPageStyle(isCompact)}
    >
      <style>{printStyles}</style>

      <div
        style={getContainerStyle(isCompact)}
        className="no-print"
      >
        <Header
          branch={branch}
          contractId={contractId}
          router={router}
          isMobile={isMobile}
          isCompact={isCompact}
        />

        <div style={actionBar}>
          <button
            type="button"
            style={printButton}
            onClick={() => window.print()}
          >
            🖨️ طباعة المخالصة
          </button>

          <button
            type="button"
            style={pdfButton}
            onClick={() =>
              exportElementToPdf(
                "clearance-print-area",
                pdfFileName
              )
            }
          >
            📄 تحميل PDF
          </button>

          <button
            type="button"
            style={backButton}
            onClick={() => router.back()}
          >
            ← رجوع
          </button>

          <button
            type="button"
            style={mainWorkstationButton}
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

      <section
        id="clearance-print-area"
        style={getPaperStyle(isMobile)}
        className="print-paper"
      >
        <header
          style={paperHeader}
          className="print-block"
        >
          <h1
            style={organizationTitle}
            className="print-organization-title"
          >
            {organizationName}
          </h1>

          <h2
            style={title}
            className="print-title"
          >
            مخالصة نهائية
          </h2>
        </header>

        <div
          style={divider}
          className="print-divider"
        />

        <section className="print-block">
          <p
            style={paragraph}
            className="print-paragraph"
          >
            تشهد{" "}
            <strong>
              {organizationName}
            </strong>

            {commercialRecord && (
              <>
                {" "}
                سجل تجاري رقم{" "}
                <strong>
                  {commercialRecord}
                </strong>
              </>
            )}

            {" "}
            بأن العميل الموضحة بياناته
            أدناه قد قام بسداد كامل
            الالتزامات المالية المترتبة
            عليه بموجب العقد المشار إليه،
            ولا يترتب عليه أي مبالغ أو
            مطالبات مالية تجاه المؤسسة
            حتى تاريخ إصدار هذه المخالصة.
          </p>
        </section>

        <section
          style={infoGrid}
          className="print-info-grid print-block"
        >
          <Info
            label="اسم العميل"
            value={getCustomerName()}
          />

          <Info
            label="رقم الهوية"
            value={getCustomerNationalId()}
          />

          <Info
            label="رقم العقد"
            value={
              contract.contract_number ||
              "-"
            }
          />

          <Info
            label="تاريخ إصدار المخالصة"
            value={clearanceDate}
          />

          <Info
            label="مبلغ الدين"
            value={`${formatMoney(
              contract.debt_amount
            )} ر.س`}
          />

          <Info
            label="مبلغ السداد"
            value={`${formatMoney(
              contract.payment_amount
            )} ر.س`}
          />

          <Info
            label="المبلغ المسدد"
            value={`${formatMoney(
              contract.paid_amount
            )} ر.س`}
          />

          <Info
            label="المبلغ المتبقي"
            value={`${formatMoney(
              contract.remaining_amount
            )} ر.س`}
          />
        </section>

        <section className="print-block">
          <p
            style={paragraph}
            className="print-paragraph"
          >
            وقد أعطيت له هذه المخالصة
            بناءً على طلبه للعمل بموجبها
            عند الحاجة، دون أدنى مسؤولية
            على المؤسسة بعد تاريخ إصدارها،
            وذلك فيما يخص العقد المذكور
            أعلاه.
          </p>
        </section>

        <section
          style={signatureArea}
          className="print-signature-area print-block"
        >
          <div>
            <strong>
              الجهة المصدرة
            </strong>

            <p style={signatureText}>
              {organizationName}
            </p>
          </div>

          <div>
            <strong>
              الختم والتوقيع
            </strong>

            <div
              style={stampBox}
              className="print-stamp-box"
            />
          </div>
        </section>

        <div
          style={footerNote}
          className="print-footer-note print-block"
        >
          تم إصدار هذه المخالصة آلياً من
          النظام
        </div>
      </section>
    </main>
  );
}

function Header({
  isMobile,
  isCompact,
}: HeaderProps) {
  return (
    <header
      style={getHeroStyle(isCompact)}
    >
      <div style={heroCircleOne} />
      <div style={heroCircleTwo} />
      <div style={heroCircleThree} />
      <div style={heroDots} />

      <div
        style={getHeroContentStyle(
          isCompact
        )}
      >
        <div>
          <h1
            style={getHeroTitleStyle(
              isMobile
            )}
          >
            مخالصة نهائية
          </h1>
        </div>
      </div>
    </header>
  );
}

function Info({
  label,
  value,
}: InfoProps) {
  return (
    <div
      style={infoBox}
      className="print-info-box"
    >
      <span
        style={infoLabel}
        className="print-info-label"
      >
        {label}
      </span>

      <strong
        style={infoValue}
        className="print-info-value"
      >
        {value ?? "-"}
      </strong>
    </div>
  );
}

function formatGregorianDate(
  date?: string | null
) {
  if (!date) {
    return "-";
  }

  const parsedDate = new Date(date);

  if (
    Number.isNaN(parsedDate.getTime())
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

function formatMoney(
  value:
    | number
    | string
    | null
    | undefined
) {
  const number = Number(value || 0);

  return number.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function getPageStyle(
  isCompact: boolean
): CSSProperties {
  return {
    minHeight: "100vh",
    padding: isCompact ? 12 : 18,
    fontFamily:
      "var(--font-almarai), sans-serif",
    backgroundImage:
      "radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 34%), radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.14), transparent 30%), linear-gradient(180deg, rgba(248, 250, 252, 0.94), rgba(226, 232, 240, 0.94)), url('/backgrounds/v13-finance-bg-1.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: isCompact
      ? "scroll"
      : "fixed",
  };
}

function getContainerStyle(
  isCompact: boolean
): CSSProperties {
  return {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto 16px",
    display: "flex",
    flexDirection: "column",
    gap: isCompact ? 12 : 14,
  };
}

function getHeroStyle(
  isCompact: boolean
): CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    borderRadius: isCompact ? 20 : 24,
    padding: isCompact ? 18 : 24,
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e3a8a 48%, #0891b2 100%)",
    boxShadow:
      "0 18px 42px rgba(15, 23, 42, 0.22)",
    border:
      "1px solid rgba(255, 255, 255, 0.16)",
  };
}

function getHeroContentStyle(
  isCompact: boolean
): CSSProperties {
  return {
    position: "relative",
    zIndex: 2,
    minHeight: isCompact ? 52 : 70,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  };
}

function getHeroTitleStyle(
  isMobile: boolean
): CSSProperties {
  return {
    margin: 0,
    fontSize: isMobile ? 24 : 30,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getPaperStyle(
  isMobile: boolean
): CSSProperties {
  return {
    width: isMobile ? "100%" : "190mm",
    minHeight: isMobile
      ? "auto"
      : "250mm",
    margin: "0 auto",
    background: "#ffffff",
    padding: isMobile
      ? 16
      : "10mm",
    boxSizing: "border-box",
    borderRadius: isMobile ? 16 : 0,
    boxShadow:
      "0 18px 45px rgba(15, 23, 42, 0.12)",
    overflow: "hidden",
  };
}

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 180,
  height: 180,
  borderRadius: "50%",
  background:
    "rgba(255, 255, 255, 0.08)",
  top: -70,
  right: -55,
};

const heroCircleTwo: CSSProperties = {
  position: "absolute",
  width: 150,
  height: 150,
  borderRadius: "50%",
  background:
    "rgba(14, 165, 233, 0.18)",
  bottom: -70,
  left: 90,
};

const heroCircleThree: CSSProperties = {
  position: "absolute",
  width: 90,
  height: 90,
  borderRadius: "50%",
  background:
    "rgba(255, 255, 255, 0.07)",
  top: 30,
  left: 25,
};

const heroDots: CSSProperties = {
  position: "absolute",
  inset: 0,
  opacity: 0.18,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.72) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

const actionBar: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
};

const printButton: CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#ffffff",
  background:
    "linear-gradient(135deg, #2563eb, #0891b2)",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 10px 24px rgba(37, 99, 235, 0.28)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const pdfButton: CSSProperties = {
  ...printButton,
  background:
    "linear-gradient(135deg,#0d47a1,#1976d2)",
};

const backButton: CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#ffffff",
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 8px 18px rgba(21,128,61,0.24)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const mainWorkstationButton: CSSProperties = {
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#ffffff",
  background:
    "linear-gradient(135deg,#16a34a,#15803d)",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 8px 18px rgba(21,128,61,0.25)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const paperHeader: CSSProperties = {
  textAlign: "center",
};

const organizationTitle: CSSProperties = {
  margin: 0,
  color: "#0d47a1",
  fontSize: 22,
  fontWeight: 900,
};

const title: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 26,
  color: "#0f172a",
  fontWeight: 900,
};

const divider: CSSProperties = {
  height: 2,
  background:
    "linear-gradient(135deg, #1e3a8a, #0891b2)",
  margin: "14px 0",
};

const paragraph: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.75,
  color: "#111827",
  textAlign: "justify",
  margin: "9px 0",
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",
  gap: 8,
  margin: "14px 0",
};

const infoBox: CSSProperties = {
  border: "1px solid #d9e3f5",
  borderRadius: 9,
  padding: "8px 10px",
  background: "#f8fbff",
  breakInside: "avoid",
};

const infoLabel: CSSProperties = {
  display: "block",
  color: "#64748b",
  fontSize: 12,
  marginBottom: 4,
};

const infoValue: CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
};

const signatureArea: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: 22,
  marginTop: 22,
  fontSize: 14,
};

const signatureText: CSSProperties = {
  margin: "8px 0 0",
};

const stampBox: CSSProperties = {
  height: 54,
  border:
    "1px dashed #94a3b8",
  borderRadius: 9,
  marginTop: 8,
};

const footerNote: CSSProperties = {
  marginTop: 18,
  paddingTop: 8,
  borderTop:
    "1px solid #e2e8f0",
  textAlign: "center",
  color: "#64748b",
  fontSize: 10.5,
};

const loadingBox: CSSProperties = {
  maxWidth: 794,
  margin: "0 auto",
  background:
    "rgba(255, 255, 255, 0.94)",
  border:
    "1px solid rgba(226, 232, 240, 0.95)",
  borderRadius: 18,
  padding: 22,
  textAlign: "center",
  color: "#1e3a8a",
  fontWeight: 900,
  boxShadow:
    "0 18px 45px rgba(15, 23, 42, 0.08)",
};

const printStyles = `
@page {
  size: A4 portrait;
  margin: 8mm;
}

@media print {
  html,
  body {
    width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    overflow: visible !important;
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }

  .no-print {
    display: none !important;
  }

  main {
    width: 100% !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    overflow: visible !important;
  }

  .print-paper {
    width: 100% !important;
    min-height: auto !important;
    height: auto !important;
    margin: 0 !important;
    padding: 7mm !important;
    box-sizing: border-box !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    overflow: visible !important;
  }

  .print-paper,
  .print-paper * {
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }

  .print-block,
  .print-info-box,
  .print-info-grid,
  .print-signature-area,
  .print-footer-note {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .print-organization-title {
    font-size: 20px !important;
    margin: 0 !important;
  }

  .print-title {
    font-size: 24px !important;
    margin: 6px 0 0 !important;
  }

  .print-divider {
    margin: 11px 0 !important;
  }

  .print-paragraph {
    font-size: 13px !important;
    line-height: 1.6 !important;
    margin: 7px 0 !important;
  }

  .print-info-grid {
    gap: 6px !important;
    margin: 11px 0 !important;
  }

  .print-info-box {
    padding: 7px 9px !important;
    border-radius: 7px !important;
  }

  .print-info-label {
    font-size: 11px !important;
    margin-bottom: 3px !important;
  }

  .print-info-value {
    font-size: 13px !important;
  }

  .print-signature-area {
    margin-top: 17px !important;
    font-size: 13px !important;
    gap: 18px !important;
  }

  .print-stamp-box {
    height: 48px !important;
    margin-top: 6px !important;
  }

  .print-footer-note {
    margin-top: 12px !important;
    padding-top: 6px !important;
    font-size: 9.5px !important;
  }
}
`;
