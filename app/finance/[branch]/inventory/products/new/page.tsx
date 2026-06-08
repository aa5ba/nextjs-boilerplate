"use client";

import { useEffect, useState } from "react";
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

  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissionLoaded, setPermissionLoaded] = useState(false);

  useEffect(() => {
    loadCurrentUserPermissions();
  }, []);

  function loadCurrentUserPermissions() {
    const savedUser =
      typeof window !== "undefined"
        ? localStorage.getItem("finance_user")
        : null;

    if (!savedUser) {
      setRoles(["مدير رئيسي"]);
      setPermissions([]);
      setPermissionLoaded(true);
      return;
    }

    try {
      const user = JSON.parse(savedUser);
      setRoles(user.roles || []);
      setPermissions(user.permissions || []);
    } catch {
      setRoles(["مدير رئيسي"]);
      setPermissions([]);
    }

    setPermissionLoaded(true);
  }

  function hasPermission(permissionKey: string) {
    return (
      roles.includes("مدير رئيسي") ||
      roles.includes("مدير") ||
      permissions.includes(permissionKey)
    );
  }

  async function saveProduct() {
    if (!hasPermission("add_product")) {
      alert("لا تملك صلاحية إضافة المنتجات");
      return;
    }

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
        console.log(error);
        alert(error.message);
        return;
      }

      alert("تم حفظ المنتج بنجاح");
      window.location.href = `/finance/${branch}/inventory`;
    } finally {
      setSaving(false);
    }
  }

  if (!permissionLoaded) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري التحقق من الصلاحيات...</div>
      </main>
    );
  }

  if (!hasPermission("add_product")) {
    return (
      <main dir="rtl" style={page}>
        <div style={container}>
          <section style={deniedCard}>
            <h1 style={{ marginTop: 0 }}>🚫 لا تملك صلاحية الوصول</h1>
            <p>ليس لديك صلاحية إضافة المنتجات.</p>

            <button
              style={backButton}
              onClick={() =>
                (window.location.href = `/finance/${branch}/inventory`)
              }
            >
              الرجوع للمخزون
            </button>
          </section>
        </div>
      </main>
    );
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

const deniedCard = {
  background: "white",
  border: "1px solid #fecaca",
  borderRadius: 18,
  padding: 24,
  color: "#991b1b",
  textAlign: "center" as const,
};

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
  boxSizing: "border-box" as const,
};

const textarea = {
  width: "100%",
  minHeight: 100,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
  boxSizing: "border-box" as const,
};

const primaryButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
};

const backButton = {
  width: "100%",
  padding: 16,
  background: "#16a34a",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(22,163,74,0.25)",
};

const loadingBox = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  textAlign: "center" as const,
  color: "#0d47a1",
  fontWeight: "bold",
};
