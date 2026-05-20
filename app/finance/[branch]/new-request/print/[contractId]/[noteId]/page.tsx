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
    const { data: contractData } = await supabase
      .from("finance_contracts")
      .select(
        "*, finance_customers(full_name, national_id, phone, birth_hijri)"
      )
      .eq("id", contractId)
      .single();

    const { data: noteData } = await supabase
      .from("finance_promissory_notes")
      .select("*")
      .eq("id", noteId)
      .single();

    const orgSettings = await getOrganizationSettings();

    setOrganizationSettings(orgSettings);
    setContract(contractData);
    setNote(noteData);
  }

  const customerName =
    contract?.finance_customers?.full_name ||
    note?.debtor_name ||
    "................";

  const nationalId =
    contract?.finance_customers?.national_id ||
    note?.debtor_national_id ||
    "................";

  const phone =
    contract?.finance_customers?.phone ||
    note?.debtor_phone ||
    "................";

  const birthHijri =
    contract?.finance_customers?.birth_hijri || "................";

  const firstPartyName =
    contract?.print_party_name ||
    contract?.first_party_name ||
    contract?.investor_name ||
    organizationSettings.name ||
    "................";

  const firstPartyIdentifier =
    contract?.print_party_identifier ||
    contract?.first_party_identifier ||
    "";

  const firstPartyIdentifierLabel =
    contract?.print_party_type === "investor" ||
    contract?.first_party_type === "investor"
      ? "رقم الهوية"
      : "السجل التجاري";

  return (
    <main dir="rtl" style={page}>
      <section style={printArea}>
        <div style={topLine}>
          <span>المملكة العربية السعودية</span>
          <span>{organizationSettings.city || "بيع * شراء"}</span>
        </div>

        <div style={logoBox}>
          <div style={organizationLogoText}>{organizationSettings.name}</div>
        </div>

        <div style={organizationInfo}>
          {organizationSettings.phone && (
            <span>جوال: {organizationSettings.phone}</span>
          )}

          {organizationSettings.commercialRecord && (
            <span>سجل تجاري: {organizationSettings.commercialRecord}</span>
          )}
        </div>

        <h1 style={title}>النموذج 1 للعقد</h1>
        <h2 style={subtitle}>عقد اتفاق بيع</h2>

        <div style={metaRow}>
          <span>رقم العقد: {contract?.contract_number || "-"}</span>
          <span>
            التاريخ الميلادي: {contract?.contract_date_gregorian || "-"}
          </span>
        </div>

        <div style={metaRow}>
          <span>التاريخ الهجري: {contract?.contract_date_hijri || "-"}</span>
          <span>موعد السداد: {contract?.payment_due_date || "-"}</span>
        </div>

        <p style={paragraph}>
          الحمد لله والصلاة والسلام على من لا نبي بعده، وبعد:
        </p>

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
          وذلك مقابل منتج /{" "}
          <strong>{contract?.product_name || "................"}</strong>،
          وعددها / <strong>{contract?.product_quantity || "-"}</strong>، بمبلغ
          دين وقدره / <strong> {contract?.debt_amount || 0}</strong> ريال سعودي.
        </p>

        <p style={paragraph}>
          ويلتزم الطرف الثاني بسداد مبلغ وقدره /
          <strong> {contract?.payment_amount || 0}</strong> ريال سعودي، وذلك حسب
          نوع السداد / <strong> {contract?.payment_type || "-"}</strong>، وبقسط
          قدره / <strong> {contract?.installment_amount || 0}</strong> ريال
          سعودي.
        </p>

        <p style={paragraph}>
          وتكون مدينة التقاضي / <strong>{contract?.legal_city || "-"}</strong>.
        </p>

        <p style={paragraph}>
          كما يقر الطرف الثاني بأنه اطلع على كامل بنود هذا العقد، وأنه ملتزم
          بالسداد في المواعيد المتفق عليها، وفي حال التأخر يحق للطرف الأول اتخاذ
          الإجراءات النظامية اللازمة للمطالبة بكامل المبلغ المتبقي.
        </p>

        <p style={paragraph}>
          ملاحظات: <strong>{contract?.notes || "-"}</strong>
        </p>

        <div style={signatures}>
          <div style={signatureBox}>
            <strong>الطرف الأول البائع</strong>
            <div>الاسم / {firstPartyName}</div>
            <div>
              {firstPartyIdentifierLabel} /{" "}
              {firstPartyIdentifier || "................"}
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

        <div style={guarantorBox}>
          <strong>الكفيل الغارم</strong>
          <div>الاسم / {contract?.guarantor_name || "................"}</div>
          <div>رقم الهوية / ................</div>
          <div>الجوال / ................</div>
          <div>التوقيع / ................</div>
        </div>
      </section>

      <section style={secondPrintArea}>
        <div style={topLine}>
          <span>المملكة العربية السعودية</span>
          <span>{organizationSettings.city || "بيع * شراء"}</span>
        </div>

        <div style={logoBox}>
          <div style={organizationLogoText}>{organizationSettings.name}</div>
        </div>

        <div style={organizationInfo}>
          {organizationSettings.phone && (
            <span>جوال: {organizationSettings.phone}</span>
          )}

          {organizationSettings.commercialRecord && (
            <span>سجل تجاري: {organizationSettings.commercialRecord}</span>
          )}
        </div>

        <h1 style={title}>النموذج 1 للسند</h1>
        <h2 style={subtitle}>سند لأمر</h2>

        <div style={metaRow}>
          <span>رقم السند: {note?.note_number || "-"}</span>
          <span>تاريخ التحرير: {note?.note_date_gregorian || "-"}</span>
        </div>

        <div style={metaRow}>
          <span>تاريخ التحرير هجري: {note?.note_date_hijri || "-"}</span>
          <span>تاريخ الاستحقاق: {note?.due_date || "-"}</span>
        </div>

        <p style={paragraph}>
          حرر هذا السند في مدينة{" "}
          <strong>
            {note?.city || organizationSettings.city || "................"}
          </strong>
          ، وبموجب هذا السند أتعهد أنا الموقع أدناه بأن أدفع لأمر الطرف
          المستفيد / <strong>{firstPartyName}</strong>
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
          <strong>{note?.due_date || "................"}</strong>، دون مماطلة أو
          تأخير، ويعد هذا السند التزامًا واجب الوفاء حسب الأنظمة المعمول بها.
        </p>

        <div style={infoBox}>
          <div>اسم المدين / {note?.debtor_name || customerName}</div>
          <div>رقم الهوية / {note?.debtor_national_id || nationalId}</div>
          <div>رقم الجوال / {note?.debtor_phone || phone}</div>
          <div>العنوان / {note?.city || "................"}</div>
          <div>حالة السند / {note?.status || "-"}</div>
        </div>

        <p style={paragraph}>
          ملاحظات: <strong>{note?.notes || "-"}</strong>
        </p>

        <div style={signatures}>
          <div style={signatureBox}>
            <strong>المدين</strong>
            <div>الاسم / {note?.debtor_name || customerName}</div>
            <div>التوقيع / ................</div>
            <div>البصمة / ................</div>
          </div>

          <div style={signatureBox}>
            <strong>الكفيل</strong>
            <div>الاسم / ................</div>
            <div>رقم الهوية / ................</div>
            <div>التوقيع / ................</div>
            <div>البصمة / ................</div>
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

const topLine = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
  fontWeight: "bold",
  marginBottom: 8,
};

const logoBox = {
  width: 55,
  height: 55,
  margin: "0 auto 6px",
  border: "1px dashed #94a3b8",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#64748b",
  fontSize: 11,
};

const organizationLogoText = {
  textAlign: "center" as const,
  fontSize: 11,
  fontWeight: "bold",
  color: "#0f172a",
  lineHeight: 1.5,
  padding: 4,
};

const organizationInfo = {
  display: "flex",
  justifyContent: "center",
  gap: 12,
  fontSize: 10.5,
  color: "#475569",
  marginBottom: 6,
};

const title = {
  textAlign: "center" as const,
  color: "#0d47a1",
  fontSize: 16,
  margin: "0 0 2px",
};

const subtitle = {
  textAlign: "center" as const,
  color: "#111827",
  fontSize: 20,
  margin: "0 0 10px",
  textDecoration: "underline",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: 4,
  marginBottom: 5,
  fontSize: 12,
};

const paragraph = {
  fontSize: 12.5,
  margin: "5px 0",
  textAlign: "justify" as const,
};

const infoBox = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 10,
  marginTop: 10,
  lineHeight: 1.7,
  fontSize: 12.5,
};

const signatures = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginTop: 16,
};

const signatureBox = {
  borderTop: "1px solid #111827",
  paddingTop: 8,
  lineHeight: 1.7,
  fontSize: 12.5,
};

const guarantorBox = {
  marginTop: 16,
  borderTop: "1px solid #111827",
  paddingTop: 8,
  lineHeight: 1.7,
  fontSize: 12.5,
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
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
};
