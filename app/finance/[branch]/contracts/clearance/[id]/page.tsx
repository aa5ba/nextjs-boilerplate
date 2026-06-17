"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

type ScreenType = "mobile" | "tablet" | "desktop";

export default function ContractClearancePage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;
  const contractId = params.id as string;

  const [contract, setContract] = useState<any>(null);
  const [organizationName, setOrganizationName] = useState("مؤسسة سداد وأرقام");
  const [commercialRecord, setCommercialRecord] = useState("");
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<ScreenType>("desktop");

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
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    loadData();
  }, [branch, contractId]);

  async function loadData() {
    setLoading(true);

    const currentBranchId = await getBranchId(branch);

    if (!currentBranchId) {
      setContract(null);
      setLoading(false);
      return;
    }

    const { data: branchData } = await supabase
      .from("finance_branches")
      .select("organization_name, commercial_record")
      .eq("id", currentBranchId)
      .maybeSingle();

    if (branchData?.organization_name) {
      setOrganizationName(branchData.organization_name);
    }

    if (branchData?.commercial_record) {
      setCommercialRecord(branchData.commercial_record);
    }

    const { data } = await supabase
      .from("finance_contracts")
      .select(
        `
        *,
        finance_customers(
          full_name,
          national_id,
          phone
        )
      `
      )
      .eq("id", contractId)
      .eq("branch_id", currentBranchId)
      .single();

    setContract(data);
    setLoading(false);
  }

  function getCustomerName() {
    return contract?.finance_customers?.full_name || contract?.customer_name || "-";
  }

  function getCustomerNationalId() {
    return (
      contract?.finance_customers?.national_id ||
      contract?.customer_national_id ||
      "-"
    );
  }

  function formatDate(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    return targetDate.toLocaleDateString("ar-SA-u-ca-gregory");
  }

  if (loading) {
    return (
      <main dir="rtl" style={getPageStyle(isCompact)}>
        <style>{printStyles}</style>

        <div style={getContainerStyle(isCompact)} className="no-print">
          <Header
            branch={branch}
            contractId={contractId}
            router={router}
            isMobile={isMobile}
            isCompact={isCompact}
          />
        </div>

        <div style={loadingBox}>جاري تحميل المخالصة...</div>
      </main>
    );
  }

  if (!contract) {
    return (
      <main dir="rtl" style={getPageStyle(isCompact)}>
        <style>{printStyles}</style>

        <div style={getContainerStyle(isCompact)} className="no-print">
          <Header
            branch={branch}
            contractId={contractId}
            router={router}
            isMobile={isMobile}
            isCompact={isCompact}
          />
        </div>

        <div style={loadingBox}>لم يتم العثور على العقد</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={getPageStyle(isCompact)}>
      <style>{printStyles}</style>

      <div style={getContainerStyle(isCompact)} className="no-print">
        <Header
          branch={branch}
          contractId={contractId}
          router={router}
          isMobile={isMobile}
          isCompact={isCompact}
        />
      </div>

      <section style={getPaperStyle(isMobile)} className="print-paper">
        <header style={paperHeader}>
          <h1 style={organizationTitle} className="print-organization-title">
            {organizationName}
          </h1>

          <h2 style={title} className="print-title">
            مخالصة نهائية
          </h2>
        </header>

        <div style={divider} className="print-divider" />

        <p style={paragraph} className="print-paragraph">
          تشهد <strong>{organizationName}</strong>
          {commercialRecord && (
            <>
              {" "}
              سجل تجاري رقم <strong>{commercialRecord}</strong>
            </>
          )}
          {" "}
          بأن العميل الموضحة بياناته أدناه قد قام بسداد كامل الالتزامات المالية
          المترتبة عليه بموجب العقد المشار إليه، ولا يترتب عليه أي مبالغ أو مطالبات
          مالية تجاه المؤسسة حتى تاريخ إصدار هذه المخالصة.
        </p>

        <div style={infoGrid} className="print-info-grid">
          <Info label="اسم العميل" value={getCustomerName()} />
          <Info label="رقم الهوية" value={getCustomerNationalId()} />
          <Info label="رقم العقد" value={contract?.contract_number || "-"} />
          <Info label="تاريخ إصدار المخالصة" value={formatDate()} />
          <Info label="مبلغ الدين" value={`${contract?.debt_amount || 0} ر.س`} />
          <Info label="مبلغ السداد" value={`${contract?.payment_amount || 0} ر.س`} />
          <Info label="المبلغ المسدد" value={`${contract?.paid_amount || 0} ر.س`} />
          <Info label="المبلغ المتبقي" value={`${contract?.remaining_amount || 0} ر.س`} />
        </div>

        <p style={paragraph} className="print-paragraph">
          وقد أعطيت له هذه المخالصة بناءً على طلبه للعمل بموجبها عند الحاجة، دون أدنى
          مسؤولية على المؤسسة بعد تاريخ إصدارها، وذلك فيما يخص العقد المذكور أعلاه.
        </p>

        <div style={signatureArea} className="print-signature-area">
          <div>
            <strong>الجهة المصدرة</strong>
            <p>{organizationName}</p>
          </div>

          <div>
            <strong>الختم والتوقيع</strong>
            <div style={stampBox} className="print-stamp-box"></div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Header({
  branch,
  contractId,
  router,
  isMobile,
  isCompact,
}: {
  branch: string;
  contractId: string;
  router: any;
  isMobile: boolean;
  isCompact: boolean;
}) {
  return (
    <header style={getHeroStyle(isCompact)}>
      <div style={heroCircleOne} />
      <div style={heroCircleTwo} />
      <div style={heroCircleThree} />
      <div style={heroDots} />

      <div style={getHeroContentStyle(isCompact)}>
        <div>
          <h1 style={getHeroTitleStyle(isMobile)}>مخالصة نهائية</h1>
        </div>

        <div style={getHeroActionsStyle(isCompact)}>
          <button style={printButton} onClick={() => window.print()}>
            طباعة المخالصة
          </button>

          <button
            style={backButton}
            onClick={() =>
              router.push(`/finance/${branch}/contracts/${contractId}`)
            }
          >
            رجوع
          </button>

          <button
            style={mainWorkstationButton}
            onClick={() => router.push(`/finance/${branch}`)}
          >
            محطة العمل الرئيسية
          </button>
        </div>
      </div>
    </header>
  );
}

function Info({ label, value }: any) {
  return (
    <div style={infoBox} className="print-info-box">
      <span style={infoLabel} className="print-info-label">
        {label}
      </span>

      <strong style={infoValue} className="print-info-value">
        {value || "-"}
      </strong>
    </div>
  );
}

function getPageStyle(isCompact: boolean) {
  return {
    minHeight: "100vh",
    padding: isCompact ? 14 : 22,
    fontFamily: "var(--font-almarai), sans-serif",
    backgroundImage:
      "radial-gradient(circle at top right, rgba(37, 99, 235, 0.16), transparent 34%), radial-gradient(circle at bottom left, rgba(14, 165, 233, 0.14), transparent 30%), linear-gradient(180deg, rgba(248, 250, 252, 0.94), rgba(226, 232, 240, 0.94)), url('/backgrounds/v13-finance-bg-1.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
  };
}

function getContainerStyle(isCompact: boolean) {
  return {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto 18px",
    display: "flex",
    flexDirection: "column" as const,
    gap: isCompact ? 14 : 18,
  };
}

function getHeroStyle(isCompact: boolean) {
  return {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: isCompact ? 22 : 28,
    padding: isCompact ? 18 : 26,
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e3a8a 48%, #0891b2 100%)",
    boxShadow: "0 22px 55px rgba(15, 23, 42, 0.28)",
    border: "1px solid rgba(255, 255, 255, 0.16)",
  };
}

function getHeroContentStyle(isCompact: boolean) {
  return {
    position: "relative" as const,
    zIndex: 2,
    display: "flex",
    flexDirection: isCompact ? ("column" as const) : ("row" as const),
    justifyContent: "space-between",
    alignItems: isCompact ? "stretch" : "center",
    gap: 16,
  };
}

function getHeroTitleStyle(isMobile: boolean) {
  return {
    margin: 0,
    fontSize: isMobile ? 24 : 32,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  };
}

function getHeroActionsStyle(isCompact: boolean) {
  return {
    display: "flex",
    flexDirection: isCompact ? ("column" as const) : ("row" as const),
    gap: 10,
    alignItems: "stretch",
  };
}

function getPaperStyle(isMobile: boolean) {
  return {
    width: isMobile ? "100%" : "190mm",
    minHeight: isMobile ? "auto" : "auto",
    margin: "auto",
    background: "white",
    padding: isMobile ? 18 : "14mm",
    boxSizing: "border-box" as const,
    borderRadius: isMobile ? 18 : 10,
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.12)",
  };
}

const heroCircleOne = {
  position: "absolute" as const,
  width: 180,
  height: 180,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.08)",
  top: -70,
  right: -55,
};

const heroCircleTwo = {
  position: "absolute" as const,
  width: 150,
  height: 150,
  borderRadius: "50%",
  background: "rgba(14, 165, 233, 0.18)",
  bottom: -70,
  left: 90,
};

const heroCircleThree = {
  position: "absolute" as const,
  width: 90,
  height: 90,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.07)",
  top: 30,
  left: 25,
};

const heroDots = {
  position: "absolute" as const,
  inset: 0,
  opacity: 0.18,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.72) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

const printButton = {
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#ffffff",
  background: "linear-gradient(135deg, #2563eb, #0891b2)",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(37, 99, 235, 0.28)",
};

const backButton = {
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#ffffff",
  background: "linear-gradient(135deg, #64748b, #334155)",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(51, 65, 85, 0.28)",
};

const mainWorkstationButton = {
  border: "none",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#ffffff",
  background: "linear-gradient(135deg, #16a34a, #15803d)",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(22, 163, 74, 0.28)",
};

const paperHeader = {
  textAlign: "center" as const,
};

const organizationTitle = {
  margin: 0,
  color: "#0d47a1",
  fontSize: 24,
  fontWeight: 900,
};

const title = {
  margin: "12px 0 0",
  fontSize: 28,
  color: "#0f172a",
  fontWeight: 900,
};

const divider = {
  height: 2,
  background: "linear-gradient(135deg, #1e3a8a, #0891b2)",
  margin: "18px 0",
};

const paragraph = {
  fontSize: 16,
  lineHeight: 1.85,
  color: "#111827",
  textAlign: "justify" as const,
  margin: "12px 0",
};

const infoGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  margin: "18px 0",
};

const infoBox = {
  border: "1px solid #d9e3f5",
  borderRadius: 10,
  padding: 11,
  background: "#f8fbff",
};

const infoLabel = {
  display: "block",
  color: "#64748b",
  fontSize: 13,
  marginBottom: 6,
};

const infoValue = {
  color: "#0f172a",
  fontSize: 15,
};

const signatureArea = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  marginTop: 34,
  fontSize: 16,
};

const stampBox = {
  height: 70,
  border: "1px dashed #94a3b8",
  borderRadius: 10,
  marginTop: 12,
};

const loadingBox = {
  maxWidth: 794,
  margin: "0 auto",
  background: "rgba(255, 255, 255, 0.94)",
  border: "1px solid rgba(226, 232, 240, 0.95)",
  borderRadius: 18,
  padding: 22,
  textAlign: "center" as const,
  color: "#1e3a8a",
  fontWeight: 900,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
};

const printStyles = `
@page {
  size: A4;
  margin: 6mm;
}

@media print {
  html,
  body {
    width: 210mm !important;
    min-height: 297mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    overflow: hidden !important;
  }

  body * {
    visibility: hidden;
  }

  .print-paper,
  .print-paper * {
    visibility: visible;
  }

  .no-print {
    display: none !important;
    visibility: hidden !important;
  }

  main {
    width: 210mm !important;
    min-height: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    display: block !important;
    overflow: hidden !important;
  }

  .print-paper {
    position: absolute !important;
    top: 0 !important;
    right: 0 !important;
    left: 0 !important;
    width: 198mm !important;
    min-height: auto !important;
    height: auto !important;
    margin: 0 auto !important;
    padding: 9mm 10mm !important;
    box-sizing: border-box !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    page-break-before: avoid !important;
    page-break-after: avoid !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  .print-organization-title {
    font-size: 21px !important;
    margin: 0 !important;
  }

  .print-title {
    font-size: 25px !important;
    margin: 8px 0 0 !important;
  }

  .print-divider {
    margin: 14px 0 !important;
  }

  .print-paragraph {
    font-size: 15px !important;
    line-height: 1.65 !important;
    margin: 9px 0 !important;
  }

  .print-info-grid {
    gap: 8px !important;
    margin: 14px 0 !important;
  }

  .print-info-box {
    padding: 8px 10px !important;
    border-radius: 8px !important;
  }

  .print-info-label {
    font-size: 12px !important;
    margin-bottom: 4px !important;
  }

  .print-info-value {
    font-size: 14px !important;
  }

  .print-signature-area {
    margin-top: 22px !important;
    font-size: 15px !important;
    gap: 20px !important;
  }

  .print-stamp-box {
    height: 54px !important;
    margin-top: 8px !important;
  }
}
`;
