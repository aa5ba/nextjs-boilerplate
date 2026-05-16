"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function PrintContractPage() {
  const params = useParams();
  const contractId = params.id as string;

  const [contract, setContract] = useState<any>(null);

  useEffect(() => {
    loadContract();
  }, []);

  async function loadContract() {
    const { data } = await supabase
      .from("finance_contracts")
      .select(
        "*, finance_customers(full_name, national_id, phone, birth_hijri)"
      )
      .eq("id", contractId)
      .single();

    setContract(data);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={printArea}>
        <h1 style={title}>عقد تمويل</h1>

        <p>رقم العقد: {contract?.contract_number || "-"}</p>

        <p>
          تاريخ العقد بالهجري:{" "}
          {contract?.contract_date_hijri || "-"}
        </p>

        <p>
          تاريخ العقد بالميلادي:{" "}
          {contract?.contract_date_gregorian || "-"}
        </p>

        <p>اسم العميل: {contract?.finance_customers?.full_name || "-"}</p>

        <p>
          رقم الهوية:{" "}
          {contract?.finance_customers?.national_id || "-"}
        </p>

        <p>رقم الجوال: {contract?.finance_customers?.phone || "-"}</p>

        <p>
          تاريخ الميلاد:{" "}
          {contract?.finance_customers?.birth_hijri || "-"}
        </p>

        <hr />

        <p>نوع التمويل: {contract?.finance_type || "-"}</p>
        <p>المستثمر: {contract?.investor_name || "-"}</p>
        <p>المنتج: {contract?.product_name || "-"}</p>
        <p>كمية المنتجات: {contract?.product_quantity || "-"}</p>

        <hr />

        <p>مبلغ الدين: {contract?.debt_amount || 0} ر.س</p>
        <p>مبلغ السداد: {contract?.payment_amount || 0} ر.س</p>
        <p>القسط: {contract?.installment_amount || 0} ر.س</p>
        <p>نوع السداد: {contract?.payment_type || "-"}</p>

        <p>
          موعد السداد (ميلادي):{" "}
          {contract?.payment_due_date || "-"}
        </p>

        <hr />

        <p>الكفيل: {contract?.guarantor_name || "-"}</p>
        <p>مدينة التقاضي: {contract?.legal_city || "-"}</p>
        <p>الملاحظات: {contract?.notes || "-"}</p>

        <div style={signatures}>
          <div>توقيع الطرف الأول</div>
          <div>توقيع الطرف الثاني</div>
        </div>
      </div>

      <button style={printButton} onClick={() => window.print()}>
        🖨️ طباعة العقد
      </button>

      <button
        style={backButton}
        onClick={() =>
          (window.location.href = `/finance/contracts/${contractId}`)
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
  maxWidth: 850,
  margin: "auto",
  padding: 40,
  borderRadius: 18,
  lineHeight: 2,
};

const title = {
  textAlign: "center" as const,
  color: "#0d47a1",
};

const signatures = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 60,
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
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
};
