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
              <div style={rowBetweenStyle}>
                <strong>{financeTypeMap[item.finance_type] || "تمويل"}</strong>
                <span style={arrowStyle}>›</span>
              </div>

              <div style={detailsStyle}>
                <span>مبلغ التمويل: {money(mainResult.financeAmount)} ر.س</span>
                <span>القسط: {money(mainResult.installment)} ر.س</span>
              </div>

              <div style={dateStyle}>
                {item.created_at
                  ? new Date(item.created_at).toLocaleDateString("ar-SA")
                  : "-"}
              </div>
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

const rowBetweenStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 17,
};

const detailsStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginTop: 12,
  fontSize: 14,
  color: "#374151",
};

const dateStyle = {
  marginTop: 10,
  fontSize: 13,
  color: "#6b7280",
};

const arrowStyle = {
  fontSize: 24,
  color: "#0d6efd",
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
