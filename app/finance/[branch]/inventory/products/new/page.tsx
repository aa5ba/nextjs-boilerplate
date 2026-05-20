"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

export default function NewProductPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveProduct() {
    if (!productName.trim()) {
      alert("أدخل اسم المنتج");
      return;
    }

    const branchId = await getBranchId(branch);

    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.from("finance_products").insert([
        {
          branch_id: branchId,
          product_name: productName.trim(),
          product_category: productCategory.trim() || null,
          unit_price: toNumber(unitPrice),
          notes: notes.trim() || null,
          is_active: true,
        },
      ]);

      if (error) {
        alert("تعذر حفظ المنتج");
        return;
      }

      alert("تم حفظ المنتج بنجاح");
      window.location.href = `/finance/${branch}/inventory`;
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>➕ إضافة منتج</h1>
        </div>

        <section style={card}>
          <input
            style={input}
            placeholder="اسم المنتج مثل: بطاقات سوا 20"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />

          <input
            style={input}
            placeholder="تصنيف المنتج مثل: بطاقات / أجهزة"
            value={productCategory}
            onChange={(e) => setProductCategory(e.target.value)}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="سعر الوحدة"
            value={unitPrice}
            onChange={(e) => setUnitPrice(normalizeNumber(e.target.value))}
          />

          <textarea
            style={textarea}
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button style={primaryButton} onClick={saveProduct} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ المنتج"}
          </button>
        </section>

        <button
          style={backButton}
          onClick={() => (window.location.href = `/finance/${branch}/inventory`)}
        >
          الرجوع للمخزون
        </button>
      </div>
    </main>
  );
}

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 800,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
};

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
};

const textarea = {
  width: "100%",
  minHeight: 100,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
};

const primaryButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#6b7280",
  color: "#111827",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 18,
};
