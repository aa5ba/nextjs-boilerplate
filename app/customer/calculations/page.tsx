"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
      const { data, error } = await supabase
        .from("calculations")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (!error && data) setItems(data);
      setLoading(false);
    }

    loadCalculations();
  }, []);

  return (
    <div dir="rtl" style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>عملياتي السابقة</h1>

        {loading && <p>جارٍ تحميل العمليات...</p>}

        {!loading && items.length === 0 && (
          <p style={{ textAlign: "center" }}>لا توجد عمليات محفوظة حتى الآن.</p>
        )}

        {items.map((item) => (
          <div key={item.id} style={itemStyle}>
            <strong>
              {item.finance_type === "personal"
                ? "تمويل شخصي"
                : item.finance_type === "realEstate"
                ? "تمويل عقاري"
                : "تمويل"}
            </strong>

            <p>الراتب: {item.salary?.toLocaleString?.() || item.salary}</p>
            <p>البنك: {item.bank || "غير محدد"}</p>
            <p>
              التاريخ:{" "}
              {item.created_at
                ? new Date(item.created_at).toLocaleDateString("ar-SA")
                : "-"}
            </p>
          </div>
        ))}

        <button style={buttonStyle} onClick={() => (window.location.href = "/customer")}>
          الرجوع للوحة العميل
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
  maxWidth: 520,
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

const itemStyle = {
  border: "1px solid #e5e5e5",
  borderRadius: 14,
  padding: 15,
  marginBottom: 12,
  background: "#fafafa",
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
  marginTop: 20,
};
