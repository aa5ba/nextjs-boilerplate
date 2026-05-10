"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const financeTypeMap: any = {
  personal: "تمويل شخصي",
  realEstate: "تمويل عقاري",
  both: "شخصي + عقاري",
};

const sectorMap: any = {
  civil: "مدني حكومي",
  military: "عسكري",
  retired: "متقاعد",
  private: "قطاع خاص",
  other: "غير ذلك",
};

function money(value: any) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function CalculationDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const customerId = localStorage.getItem("customer_id");

    if (!customerId) {
      window.location.href = "/login";
      return;
    }

    async function loadDetails() {
      const { data } = await supabase
        .from("calculations")
        .select("*")
        .eq("id", id)
        .eq("customer_id", customerId)
        .single();

      setItem(data);
      setLoading(false);
    }

    loadDetails();
  }, [id]);

  if (loading) return <div style={pageStyle}>جارٍ تحميل التفاصيل...</div>;

  if (!item) {
    return (
      <div dir="rtl" style={pageStyle}>
        <div style={cardStyle}>
          <h2>لم يتم العثور على العملية</h2>
          <button style={buttonStyle} onClick={() => (window.location.href = "/customer/calculations")}>
            الرجوع
          </button>
        </div>
      </div>
    );
  }

  const data = item.result_data || {};
  const inputs = data.inputs || {};
  const result = data.result || {};

  return (
    <div dir="rtl" style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>تفاصيل العملية</h1>

        <div style={infoBoxStyle}>
          <p><strong>نوع التمويل:</strong> {financeTypeMap[item.finance_type] || item.finance_type || "-"}</p>
          <p><strong>قطاع العمل:</strong> {sectorMap[item.sector] || item.sector || "-"}</p>
          <p><strong>الراتب:</strong> {money(item.salary)} ر.س</p>
          <p><strong>الاستقطاعات:</strong> {money(item.deductions)} ر.س</p>
          <p><strong>البنك:</strong> {item.bank || "غير محدد"}</p>
          <p><strong>تاريخ العملية:</strong> {item.created_at ? new Date(item.created_at).toLocaleString("ar-SA") : "-"}</p>
        </div>

        <div style={resultBoxStyle}>
          <h3>نتيجة التمويل</h3>

          {result.personal && (
            <>
              <h4>التمويل الشخصي</h4>
              <p><strong>مبلغ التمويل:</strong> {money(result.personal.financeAmount)} ر.س</p>
              <p><strong>القسط الشهري:</strong> {money(result.personal.installment)} ر.س</p>
              <p><strong>المدة:</strong> {result.personal.months || inputs.personalMonths || "-"} شهر</p>
              <p><strong>الأرباح:</strong> {money(result.personal.profit)} ر.س</p>
              <p><strong>الإجمالي:</strong> {money(result.personal.total)} ر.س</p>
            </>
          )}

          {result.realEstate && (
            <>
              <h4>التمويل العقاري</h4>
              <p><strong>مبلغ التمويل:</strong> {money(result.realEstate.financeAmount)} ر.س</p>
              <p><strong>القسط الشهري:</strong> {money(result.realEstate.installment)} ر.س</p>
              <p><strong>المدة:</strong> {result.realEstate.months || inputs.realEstateMonths || "-"} شهر</p>
              <p><strong>الأرباح:</strong> {money(result.realEstate.profit)} ر.س</p>
              <p><strong>الإجمالي:</strong> {money(result.realEstate.total)} ر.س</p>
            </>
          )}
        </div>

        <button style={buttonStyle} onClick={() => window.print()}>
          طباعة / حفظ PDF
        </button>

        <button style={backButtonStyle} onClick={() => (window.location.href = "/customer/calculations")}>
          الرجوع للعمليات السابقة
        </button>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f5f7fb",
  padding: 20,
};

const cardStyle = {
  width: "100%",
  maxWidth: 560,
  margin: "0 auto",
  background: "#fff",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 5px 25px rgba(0,0,0,0.08)",
};

const titleStyle = {
  textAlign: "center" as const,
  marginBottom: 25,
  fontSize: 28,
};

const infoBoxStyle = {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  lineHeight: 1.9,
};

const resultBoxStyle = {
  ...infoBoxStyle,
  marginTop: 16,
};

const buttonStyle = {
  width: "100%",
  height: 50,
  border: "none",
  borderRadius: 14,
  background: "#0d6efd",
  color: "#fff",
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 18,
};

const backButtonStyle = {
  ...buttonStyle,
  background: "#111827",
  marginTop: 10,
};
