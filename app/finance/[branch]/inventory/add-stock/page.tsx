"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

export default function AddStockPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [investors, setInvestors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [investorId, setInvestorId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const branchId = await getBranchId(branch);

    if (!branchId) return;

    const { data: investorsData } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const { data: productsData } = await supabase
      .from("finance_products")
      .select("*")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setInvestors(investorsData || []);
    setProducts(productsData || []);
  }

  async function saveStock() {
    if (!investorId || !productId || !quantity) {
      alert("أكمل البيانات");
      return;
    }

    const branchId = await getBranchId(branch);

    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    try {
      setSaving(true);

      const qty = toNumber(quantity);

      const { data: existingStock } = await supabase
        .from("finance_inventory")
        .select("*")
        .eq("branch_id", branchId)
        .eq("investor_id", investorId)
        .eq("product_id", productId)
        .single();

      if (existingStock) {
        const beforeQty = existingStock.quantity || 0;
        const afterQty = beforeQty + qty;

        await supabase
          .from("finance_inventory")
          .update({
            quantity: afterQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingStock.id);

        await supabase.from("finance_inventory_movements").insert([
          {
            branch_id: branchId,
            investor_id: investorId,
            product_id: productId,
            movement_type: "إضافة",
            quantity: qty,
            before_quantity: beforeQty,
            after_quantity: afterQty,
            notes,
          },
        ]);
      } else {
        await supabase.from("finance_inventory").insert([
          {
            branch_id: branchId,
            investor_id: investorId,
            product_id: productId,
            quantity: qty,
          },
        ]);

        await supabase.from("finance_inventory_movements").insert([
          {
            branch_id: branchId,
            investor_id: investorId,
            product_id: productId,
            movement_type: "إضافة",
            quantity: qty,
            before_quantity: 0,
            after_quantity: qty,
            notes,
          },
        ]);
      }

      alert("تمت إضافة الكمية بنجاح");

      window.location.href = `/finance/${branch}/inventory`;
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>📦 إضافة كمية للمخزون</h1>
        </div>

        <section style={card}>
          <select
            style={input}
            value={investorId}
            onChange={(e) => setInvestorId(e.target.value)}
          >
            <option value="">اختر المستثمر</option>

            {investors.map((investor) => (
              <option key={investor.id} value={investor.id}>
                {investor.investor_name}
              </option>
            ))}
          </select>

          <select
            style={input}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">اختر المنتج</option>

            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_name}
              </option>
            ))}
          </select>

          <input
            style={input}
            inputMode="numeric"
            placeholder="الكمية"
            value={quantity}
            onChange={(e) => setQuantity(normalizeNumber(e.target.value))}
          />

          <textarea
            style={textarea}
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button style={primaryButton} onClick={saveStock}>
            {saving ? "جاري الحفظ..." : "حفظ الكمية"}
          </button>
        </section>

        <button
          style={backButton}
          onClick={() =>
            (window.location.href = `/finance/${branch}/inventory`)
          }
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
