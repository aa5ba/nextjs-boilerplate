"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const financeTypeMap: any = {
  personal: "تمويل شخصي",
  realEstate: "تمويل عقاري",
  both: "شخصي + عقاري",
};

function money(value: any) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function formatDate(value: any) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB");
}

export default function CustomerCalculationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const customerId = localStorage.getItem("customer_id");

    if (!customerId) {
      window.location.href = "/login";
      return;
    }

    async function loadCalculations() {
      const { data } = await supabase
        .from("calculations")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setItems(data || []);
      setLoading(false);
    }

    loadCalculations();
  }, []);

  return (
    <div dir="rtl" style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={titleStyle}>عملياتي السابقة</h1>

        {loading && <p style={emptyStyle}>جارٍ تحميل العمليات...</p>}

        {!loading && items.length === 0 && (
          <p style={emptyStyle}>لا توجد عمليات محفوظة حتى الآن.</p>
        )}

        {items.map((item) => {
          const data = item.result_data || {};
          const result = data.result || {};
          const personal = result.personal;
          const realEstate = result.realEstate;
          const mainResult = personal || realEstate || {};

          return (
            <div
              key={item.id}
              style={itemStyle}
              onClick={() =>
                (window.location.href = `/customer/calculations/${item.id}`)
              }
            >
              <div style={headerStyle}>
                <strong>{financeTypeMap[item.finance_type] || "تمويل"}</strong>
                <span style={arrowStyle}>›</span>
              </div>

              <div style={lineStyle}>
                <span>مبلغ التمويل</span>
                <strong>{money(mainResult.financeAmount)} ر.س</strong>
              </div>

              <div style={lineStyle}>
                <span>القسط الشهري</span>
                <strong>{money(mainResult.installment)} ر.س</strong>
              </div>

              <div style={lineStyle}>
                <span>المدة</span>
                <strong>{mainResult.months || "-"} شهر</strong>
              </div>

              <div style={lineStyle}>
                <span>الأرباح</span>
                <strong>{money(mainResult.profit)} ر.س</strong>
              </div>

              <div style={lineStyle}>
                <span>الإجمالي</span>
                <strong>{money(mainResult.total)} ر.س</strong>
              </div>

              <div style={lineStyle}>
                <span>البنك</span>
                <strong>{item.bank || "غير محدد"}</strong>
              </div>

              <div style={dateStyle}>{formatDate(item.created_at)}</div>
            </div>
          );
        })}

        <button
          style={buttonStyle}
          onClick={() => (window.location.href = "/customer")}
        >
          الرجوع للوحة العميل
        </button>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f5f7fb",
  padding: 16,
};

const containerStyle = {
  width: "100%",
  maxWidth: 520,
  margin: "0 auto",
};

const titleStyle = {
  textAlign: "center" as const,
  marginBottom: 20,
  fontSize: 26,
};

const itemStyle = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
  cursor: "pointer",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 18,
  marginBottom: 14,
};

const arrowStyle = {
  fontSize: 26,
  color: "#0d6efd",
};

const lineStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "7px 0",
  borderBottom: "1px solid #f1f1f1",
  fontSize: 14,
};

const dateStyle = {
  marginTop: 12,
  fontSize: 12,
  color: "#6b7280",
  textAlign: "left" as const,
  direction: "ltr" as const,
};

const emptyStyle = {
  textAlign: "center" as const,
  color: "#6b7280",
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
