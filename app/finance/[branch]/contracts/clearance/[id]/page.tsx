"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function ContractClearancePage() {
  const params = useParams();
  const branch = params.branch as string;
  const contractId = params.id as string;

  const [contract, setContract] = useState<any>(null);
  const [organizationName, setOrganizationName] = useState("مؤسسة سداد وأرقام");
  const [commercialRecord, setCommercialRecord] = useState("");
  const [loading, setLoading] = useState(true);

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
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل المخالصة...</div>
      </main>
    );
  }

  if (!contract) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>لم يتم العثور على العقد</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <style>{printStyles}</style>

      <div style={toolbar} className="no-print">
        <button style={printButton} onClick={() => window.print()}>
          🖨️ طباعة المخالصة
        </button>

        <button
          style={backButton}
          onClick={() =>
            (window.location.href = `/finance/${branch}/contracts/${contractId}`)
          }
        >
          الرجوع للعقد
        </button>
      </div>

      <section style={paper}>
        <header style={header}>
          <h1 style={organizationTitle}>{organizationName}</h1>
          <h2 style={title}>مخالصة نهائية</h2>
        </header>

        <div style={divider} />

        <p style={paragraph}>
          تشهد <strong>{organizationName}</strong>
          {commercialRecord && (
            <>
              {" "}
              سجل تجاري رقم <strong>{commercialRecord}</strong>
            </>
          )}
          {" "}بأن العميل الموضحة بياناته أدناه قد قام بسداد كامل الإلتزامات
          المالية المترتبة عليه بموجب العقد المشار إليه، ولا يترتب عليه أي مبالغ
          أو مطالبات مالية تجاه المؤسسة حتى تاريخ إصدار هذه المخالصة.
        </p>

        <div style={infoGrid}>
          <Info label="اسم العميل" value={getCustomerName()} />
          <Info label="رقم الهوية" value={getCustomerNationalId()} />
          <Info label="رقم العقد" value={contract?.contract_number || "-"} />
          <Info label="تاريخ إصدار المخالصة" value={formatDate()} />
          <Info label="مبلغ الدين" value={`${contract?.debt_amount || 0} ر.س`} />
          <Info label="مبلغ السداد" value={`${contract?.payment_amount || 0} ر.س`} />
          <Info label="المبلغ المسدد" value={`${contract?.paid_amount || 0} ر.س`} />
          <Info label="المبلغ المتبقي" value={`${contract?.remaining_amount || 0} ر.س`} />
        </div>

        <p style={paragraph}>
          وقد أعطيت له هذه المخالصة بناءً على طلبه للعمل بموجبها عند الحاجة، دون أدنى
          مسؤولية على المؤسسة بعد تاريخ إصدارها، وذلك فيما يخص العقد المذكور أعلاه.
        </p>

        <div style={signatureArea}>
          <div>
            <strong>الجهة المصدرة</strong>
            <p>{organizationName}</p>
          </div>

          <div>
            <strong>الختم والتوقيع</strong>
            <div style={stampBox}></div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: any) {
  return (
    <div style={infoBox}>
      <span style={infoLabel}>{label}</span>
      <strong style={infoValue}>{value || "-"}</strong>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const toolbar = {
  maxWidth: 794,
  margin: "0 auto 16px",
  display: "flex",
  gap: 10,
};

const printButton = {
  flex: 1,
  padding: 14,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const backButton = {
  flex: 1,
  padding: 14,
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const paper = {
  width: "190mm",
  minHeight: "257mm",
  margin: "auto",
  background: "white",
  padding: "18mm",
  boxSizing: "border-box" as const,
  borderRadius: 10,
  boxShadow: "0 12px 35px rgba(15,23,42,.12)",
};

const header = {
  textAlign: "center" as const,
};

const organizationTitle = {
  margin: 0,
  color: "#0d47a1",
  fontSize: 26,
};

const title = {
  margin: "18px 0 0",
  fontSize: 30,
  color: "#0f172a",
};

const divider = {
  height: 2,
  background: "#0d47a1",
  margin: "26px 0",
};

const paragraph = {
  fontSize: 18,
  lineHeight: 2,
  color: "#111827",
  textAlign: "justify" as const,
};

const infoGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  margin: "26px 0",
};

const infoBox = {
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: 14,
  background: "#f8fbff",
};

const infoLabel = {
  display: "block",
  color: "#64748b",
  fontSize: 14,
  marginBottom: 8,
};

const infoValue = {
  color: "#0f172a",
  fontSize: 17,
};

const signatureArea = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 30,
  marginTop: 60,
  fontSize: 17,
};

const stampBox = {
  height: 90,
  border: "1px dashed #94a3b8",
  borderRadius: 12,
  marginTop: 16,
};

const loadingBox = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  textAlign: "center" as const,
  color: "#0d47a1",
  fontWeight: "bold",
};

const printStyles = `
@page {
  size: A4;
  margin: 8mm;
}

@media print {
  body {
    background: white !important;
  }

  .no-print {
    display: none !important;
  }

  main {
    padding: 0 !important;
    background: white !important;
  }
}
`;
