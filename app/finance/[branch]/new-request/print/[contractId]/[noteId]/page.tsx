"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

export default function PrintNewRequestPage() {
  const params = useParams();

  const branch = params.branch as string;
  const contractId = params.contractId as string;
  const noteId = params.noteId as string;

  const [contract, setContract] = useState<any>(null);
  const [note, setNote] = useState<any>(null);
  const [organizationSettings, setOrganizationSettings] = useState({
    name: "احتساب",
    phone: "",
    city: "",
    commercialRecord: "",
  });

  useEffect(() => {
    loadData();

    const style = document.createElement("style");

    style.innerHTML = `
      @media print {
        button {
          display: none !important;
        }

        body {
          background: white !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        main {
          padding: 0 !important;
          background: white !important;
        }

        section {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }

      @page {
        size: A4;
        margin: 8mm;
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  async function loadData() {
    const { data: branchData } = await supabase
      .from("finance_branches")
      .select("*")
      .eq("branch_slug", branch)
      .single();

    const { data: contractData } = await supabase
      .from("finance_contracts")
      .select("*, finance_customers(full_name, national_id, phone, birth_hijri)")
      .eq("id", contractId)
      .single();

    const { data: noteData } = await supabase
      .from("finance_promissory_notes")
      .select("*")
      .eq("id", noteId)
      .single();

    const oldSettings = await getOrganizationSettings();

    setOrganizationSettings({
      name:
        branchData?.organization_name ||
        oldSettings?.name ||
        "احتساب",
      phone:
        branchData?.phone ||
        oldSettings?.phone ||
        "",
      city:
        branchData?.city ||
        oldSettings?.city ||
        branchData?.branch_name ||
        "",
      commercialRecord:
        branchData?.commercial_record ||
        oldSettings?.commercialRecord ||
        "",
    });

    setContract(contractData);
    setNote(noteData);
  }

  const customerName =
    contract?.finance_customers?.full_name ||
    contract?.customer_name ||
    note?.debtor_name ||
    "................";

  const nationalId =
    contract?.finance_customers?.national_id ||
    contract?.customer_national_id ||
    note?.debtor_national_id ||
    "................";

  const phone =
    contract?.finance_customers?.phone ||
    contract?.customer_phone ||
    note?.debtor_phone ||
    "................";

  const birthHijri =
    contract?.finance_customers?.birth_hijri ||
    contract?.customer_birth_hijri ||
    "................";

  const firstPartyType =
    contract?.print_party_type ||
    contract?.first_party_type ||
    "organization";

  const isInvestorParty = firstPartyType === "investor";

  const firstPartyName = isInvestorParty
    ? contract?.print_party_name ||
      contract?.first_party_name ||
      contract?.investor_name ||
      "................"
    : organizationSettings.name || "................";

  const firstPartyIdentifier = isInvestorParty
    ? contract?.print_party_identifier ||
      contract?.first_party_identifier ||
      contract?.investor_national_id ||
      ""
    : organizationSettings.commercialRecord || "";

  const firstPartyIdentifierLabel = isInvestorParty
    ? "رقم الهوية"
    : "سجل تجاري رقم";

  const contractIssueDate =
    contract?.contract_issue_date_gregorian ||
    contract?.contract_date_gregorian ||
    "-";

  const noteIssueDate =
    note?.note_issue_date_gregorian ||
    note?.note_date_gregorian ||
    contractIssueDate ||
    "-";

  const dueDate =
    contract?.payment_due_date ||
    note?.due_date ||
    "................";

  const hasDeferredPayments =
    Boolean(contract?.has_deferred_payments) ||
    Number(contract?.installment_amount || 0) > 0;

  const hasGuarantor =
    Boolean(contract?.has_guarantor) || Boolean(note?.has_guarantor);

  const guarantorName =
    contract?.guarantor_name || note?.guarantor_name || "................";

  const guarantorNationalId =
    contract?.guarantor_national_id ||
    note?.guarantor_national_id ||
    "................";

  const guarantorPhone =
    contract?.guarantor_phone || note?.guarantor_phone || "................";

  const guarantorBirthHijri =
    contract?.guarantor_birth_hijri ||
    note?.guarantor_birth_hijri ||
    "................";

  return (
    <main dir="rtl" style={page}>
      <section style={printArea}>
        <PrintHeader
          title="عقد اتفاق بيع"
          rightInfo={organizationSettings}
          leftItems={[
            `رقم العقد: ${contract?.contract_number || "-"}`,
            `تاريخ تحرير العقد: ${contractIssueDate}`,
          ]}
        />

        <div style={contentBox}>
          <p style={paragraph}>الحمد لله والصلاة والسلام على من لا نبي بعده، وبعد:</p>

          <p style={paragraph}>
            أقر أنا الموقع أدناه الطرف الثاني / <strong>{customerName}</strong>،
            رقم الهوية / <strong>{nationalId}</strong>، تاريخ الميلاد /
            <strong> {birthHijri}</strong>، رقم الجوال /
            <strong> {phone}</strong>، بأني اشتريت من الطرف الأول /
            <strong> {firstPartyName}</strong>
            {firstPartyIdentifier ? (
              <>
                ، {firstPartyIdentifierLabel} /{" "}
                <strong>{firstPartyIdentifier}</strong>
              </>
            ) : null}
            .
          </p>

          <p style={paragraph}>
            وذلك مقابل /{" "}
            <strong>{contract?.product_name || "................"}</strong>،
            وعددها / <strong>{contract?.product_quantity || "-"}</strong>، بمبلغ
            دين وقدره / <strong>{contract?.debt_amount || 0}</strong> ريال سعودي.
          </p>

          <p style={paragraph}>
            ويلتزم الطرف الثاني بسداد مبلغ وقدره /
            <strong> {contract?.payment_amount || 0}</strong> ريال سعودي
            {hasDeferredPayments ? (
              <>
                ، على دفعات آجلة قيمة كل دفعة /
                <strong> {contract?.installment_amount || 0}</strong> ريال سعودي،
                وعددها /{" "}
                <strong>{contract?.deferred_payments_count || 0}</strong> دفعات،
                ويكون تاريخ الاستحقاق بتاريخ / <strong>{dueDate}</strong>.
              </>
            ) : (
              <>
                ، ويكون تاريخ الاستحقاق بتاريخ / <strong>{dueDate}</strong>.
              </>
            )}
          </p>

          <p style={paragraph}>
            وتكون مدينة التقاضي / <strong>{contract?.legal_city || "-"}</strong>.
          </p>

          <p style={paragraph}>
            كما يقر الطرف الثاني بأنه اطلع على كامل بنود هذا العقد، وأنه ملتزم
            بالسداد في المواعيد المتفق عليها، وفي حال التأخر يحق للطرف الأول
            اتخاذ الإجراءات النظامية اللازمة للمطالبة بكامل المبلغ المتبقي.
          </p>

          {contract?.notes && (
            <p style={paragraph}>
              ملاحظات: <strong>{contract.notes}</strong>
            </p>
          )}
        </div>

        <div style={signatures}>
          <div style={signatureBox}>
            <strong>الطرف الأول البائع</strong>
            <div>الاسم / {firstPartyName}</div>
            <div>
              {firstPartyIdentifierLabel} / {firstPartyIdentifier || "................"}
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
            <div style={guarantorGrid}>
              <div>الاسم / {guarantorName}</div>
              <div>رقم الهوية / {guarantorNationalId}</div>
              <div>الجوال / {guarantorPhone}</div>
              <div>تاريخ الميلاد / {guarantorBirthHijri}</div>
            </div>
            <div>التوقيع / ................</div>
          </div>
        )}
      </section>

      <section style={secondPrintArea}>
        <PrintHeader
          title="سند لأمر"
          rightInfo={organizationSettings}
          leftItems={[
            `رقم السند: ${note?.note_number || "-"}`,
            `تاريخ تحرير السند: ${noteIssueDate}`,
          ]}
        />

        <div style={contentBox}>
          <p style={paragraph}>
            بموجب هذا السند أتعهد أنا الموقع أدناه بأن أدفع لأمر الطرف المستفيد /
            <strong> {firstPartyName}</strong>
            {firstPartyIdentifier ? (
              <>
                ، {firstPartyIdentifierLabel} /{" "}
                <strong>{firstPartyIdentifier}</strong>
              </>
            ) : null}{" "}
            مبلغًا وقدره <strong>{note?.amount || 0}</strong> ريال سعودي.
          </p>

          <p style={paragraph}>
            ويستحق هذا المبلغ في تاريخ{" "}
            <strong>{note?.due_date || dueDate}</strong>، دون مماطلة أو تأخير،
            ويعد هذا السند التزامًا واجب الوفاء حسب الأنظمة المعمول بها.
          </p>

          <div style={infoBox}>
            <div>اسم المدين / {note?.debtor_name || customerName}</div>
            <div>رقم الهوية / {note?.debtor_national_id || nationalId}</div>
            <div>رقم الجوال / {note?.debtor_phone || phone}</div>
            <div>العنوان / {note?.city || contract?.legal_city || "................"}</div>
          </div>

          {note?.notes && (
            <p style={paragraph}>
              ملاحظات: <strong>{note.notes}</strong>
            </p>
          )}
        </div>

        <div style={signatures}>
          <div style={signatureBox}>
            <strong>المدين</strong>
            <div>الاسم / {note?.debtor_name || customerName}</div>
            <div>رقم الهوية / {note?.debtor_national_id || nationalId}</div>
            <div>الجوال / {note?.debtor_phone || phone}</div>
            <div>التوقيع / ................</div>
            <div>البصمة / ................</div>
          </div>

          {hasGuarantor && (
            <div style={signatureBox}>
              <strong>الكفيل</strong>
              <div>الاسم / {guarantorName}</div>
              <div>رقم الهوية / {guarantorNationalId}</div>
              <div>الجوال / {guarantorPhone}</div>
              <div>تاريخ الميلاد / {guarantorBirthHijri}</div>
              <div>التوقيع / ................</div>
              <div>البصمة / ................</div>
            </div>
          )}
        </div>

        <div style={legalBoxes}>
          <div style={legalBox}>
            هذا السند واجب الدفع بدون تعامل بموجب قرار مجلس الوزراء الموقر رقم
            692 بتاريخ 1383/9/26 هـ والمتوج بالمرسوم الملكي الكريم رقم 37
            بتاريخ 1383/10/11 هـ نظام الأوراق التجارية.
          </div>

          <div style={legalBox}>
            بموجب هذا السند يحق لطالب الدين والكفيل الغارم حقوق التقدم
            والمطالبة والاحتجاج والإخطار بالامتناع عن الوفاء والمتعلقة بهذا
            السند، كما يجوز لمدعي موجب هذا السند الرجوع للمدين أو الكفيل الغارم
            منفردين أو مجتمعين ودون مراعاة أو ترتيب.
          </div>
        </div>
      </section>

      <button style={printButton} onClick={() => window.print()}>
        🖨️ طباعة العقد والسند
      </button>

      <button
        style={backButton}
        onClick={() =>
          (window.location.href = `/finance/${branch}/contracts/${contractId}`)
        }
      >
        الرجوع للعقد
      </button>
    </main>
  );
}

function PrintHeader({ title, rightInfo, leftItems }: any) {
  return (
    <div style={header}>
      <div style={headerRight}>
        <div>المملكة العربية السعودية</div>
        <div>{rightInfo.city || "................"}</div>
        <div>{rightInfo.name || "................"}</div>
        <div>سجل تجاري رقم / {rightInfo.commercialRecord || "................"}</div>
      </div>

      <div style={documentTitle}>{title}</div>

      <div style={headerLeft}>
        {leftItems.map((item: string, index: number) => (
          <div key={index}>{item}</div>
        ))}
      </div>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const printArea = {
  background: "white",
  width: "190mm",
  height: "257mm",
  margin: "0 auto",
  overflow: "hidden" as const,
  padding: "7mm",
  borderRadius: 0,
  lineHeight: 1.45,
  color: "#111827",
  boxSizing: "border-box" as const,
  pageBreakInside: "avoid" as const,
};

const secondPrintArea = {
  ...printArea,
  pageBreakBefore: "always" as const,
};

const header = {
  display: "grid",
  gridTemplateColumns: "1.25fr 1fr 1.25fr",
  alignItems: "start",
  gap: 10,
  marginBottom: 12,
  borderBottom: "1.5px solid #111827",
  paddingBottom: 8,
};

const headerRight = {
  fontSize: 11,
  lineHeight: 1.65,
  fontWeight: "bold",
};

const headerLeft = {
  fontSize: 11,
  lineHeight: 1.65,
  textAlign: "left" as const,
  fontWeight: "bold",
};

const documentTitle = {
  textAlign: "center" as const,
  color: "#111827",
  fontSize: 21,
  fontWeight: "bold",
  marginTop: 13,
  whiteSpace: "nowrap" as const,
};

const contentBox = {
  marginTop: 10,
};

const paragraph = {
  fontSize: 12.3,
  margin: "6px 0",
  textAlign: "justify" as const,
};

const infoBox = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: 9,
  marginTop: 10,
  lineHeight: 1.65,
  fontSize: 12.2,
};

const signatures = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginTop: 17,
};

const signatureBox = {
  borderTop: "1.5px solid #111827",
  paddingTop: 8,
  lineHeight: 1.65,
  fontSize: 12.2,
  minHeight: 84,
};

const guarantorBox = {
  marginTop: 14,
  borderTop: "1.5px solid #111827",
  paddingTop: 8,
  lineHeight: 1.65,
  fontSize: 12.2,
};

const guarantorGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "2px 14px",
  marginTop: 4,
};

const legalBoxes = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 20,
};

const legalBox = {
  border: "1.5px solid #111827",
  borderRadius: 12,
  padding: 9,
  fontSize: 10.5,
  lineHeight: 1.65,
  textAlign: "center" as const,
  fontWeight: "bold",
};

const printButton = {
  width: "100%",
  maxWidth: 850,
  display: "block",
  margin: "20px auto 0",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
};

const backButton = {
  width: "100%",
  maxWidth: 850,
  display: "block",
  margin: "12px auto 0",
  padding: 16,
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
};
