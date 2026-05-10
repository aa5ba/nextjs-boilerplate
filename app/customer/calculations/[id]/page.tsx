"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
      const { data, error } = await supabase
        .from("calculations")
        .select("*")
        .eq("id", id)
        .eq("customer_id", customerId)
        .single();

      if (!error && data) setItem(data);
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

  return (
    <div dir="rtl" style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>تفاصيل العملية</h1>

        <div style={infoBoxStyle}>
          <p><strong>نوع التمويل:</strong> {item.finance_type || "-"}</p>
          <p><strong>الراتب:</strong> {item.salary || "-"}</p>
          <p><strong>البنك:</strong> {item.bank || "-"}</p>
          <p><strong>قطاع العمل:</strong> {item.sector || item.work_sector || "-"}</p>
          <p><strong>مدة التمويل:</strong> {item.duration_months || item.duration || "-"} شهر</p>
          <p><strong>النسبة:</strong> {item.rate || "-"}%</p>
          <p><strong>الاستقطاعات:</strong> {item.obligations || "-"}</p>
          <p>
            <strong>تاريخ العملية:</strong>{" "}
            {item.created_at ? new Date(item.created_at).toLocaleString("ar-SA") : "-"}
          </p>
        </div>

        {item.result && (
          <div style={resultBoxStyle}>
            <h3>النتيجة</h3>
            <pre style={preStyle}>{JSON.stringify(item.result, null, 2)}</pre>
          </div>
        )}

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

const preStyle = {
  whiteSpace: "pre-wrap" as const,
  direction: "ltr" as const,
  textAlign: "left" as const,
  background: "#111827",
  color: "#fff",
  padding: 12,
  borderRadius: 12,
  overflowX: "auto" as const,
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
