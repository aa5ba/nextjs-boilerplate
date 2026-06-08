"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function ProductDetailsPage() {
  const params = useParams();
  const branch = params.branch as string;
  const productId = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [contractsCount, setContractsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    loadCurrentUserPermissions();
    loadProduct();
  }, [branch, productId]);

  function loadCurrentUserPermissions() {
    const savedUser =
      typeof window !== "undefined"
        ? localStorage.getItem("finance_user")
        : null;

    if (!savedUser) {
      setRoles(["مدير رئيسي"]);
      setPermissions([]);
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
  }

  function hasPermission(permissionKey: string) {
    return (
      roles.includes("مدير رئيسي") ||
      roles.includes("مدير") ||
      permissions.includes(permissionKey)
    );
  }

  async function loadProduct() {
    setLoading(true);

    const branchId = await getBranchId(branch);

    if (!branchId) {
      setProduct(null);
      setInventory([]);
      setLoading(false);
      return;
    }

    const { data: productData } = await supabase
      .from("finance_products")
      .select("*")
      .eq("id", productId)
      .eq("branch_id", branchId)
      .single();

    const { data: inventoryData } = await supabase
      .from("finance_inventory")
      .select(`
        *,
        finance_investors(investor_name, national_id, phone)
      `)
      .eq("branch_id", branchId)
      .eq("product_id", productId)
      .order("updated_at", { ascending: false });

    const { count } = await supabase
      .from("finance_contracts")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", branchId)
      .eq("product_id", productId);

    setProduct(productData);
    setInventory(inventoryData || []);
    setContractsCount(count || 0);
    setLoading(false);
  }

  async function toggleProductStatus() {
    if (!hasPermission("toggle_product")) {
      alert("لا تملك صلاحية تعطيل أو تفعيل المنتجات");
      return;
    }

    if (!product) return;

    const confirmed = confirm(
      product.is_active
        ? "هل تريد تعطيل هذا المنتج؟"
        : "هل تريد تفعيل هذا المنتج؟"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("finance_products")
      .update({
        is_active: !product.is_active,
      })
      .eq("id", productId);

    if (error) {
      alert("تعذر تعديل حالة المنتج");
      return;
    }

    await loadProduct();
  }

  function formatDate(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("ar-SA-u-ca-gregory", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const totalQuantity = inventory.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل بيانات المنتج...</div>
      </main>
    );
  }

  if (!product) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>لم يتم العثور على المنتج</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <div>
            <h1 style={{ margin: 0 }}>📦 ملف المنتج</h1>
            <p style={headerText}>{product.product_name || "-"}</p>
          </div>

          <span style={product.is_active ? activeBadge : inactiveBadge}>
            {product.is_active ? "نشط" : "معطل"}
          </span>
        </div>

        <section style={summaryGrid}>
          <SummaryBox title="عدد المستثمرين" value={inventory.length} />
          <SummaryBox title="إجمالي المخزون" value={totalQuantity} />
          <SummaryBox title="عدد العقود" value={contractsCount} />
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات المنتج</h2>

          <Row label="اسم المنتج" value={product.product_name || "-"} />
          <Row label="التصنيف" value={product.product_category || "-"} />
          <Row label="سعر الوحدة" value={`${product.unit_price || 0} ر.س`} />
          <Row label="الملاحظات" value={product.notes || "-"} />
          <Row label="تاريخ الإنشاء" value={formatDate(product.created_at)} />
        </section>

        <section style={actionsSection}>
          {hasPermission("edit_product") && (
            <ActionButton
              title="✏️ تعديل المنتج"
              onClick={() =>
                (window.location.href = `/finance/${branch}/inventory/products/${productId}/edit`)
              }
            />
          )}

          {hasPermission("toggle_product") && (
            <button
              style={product.is_active ? dangerButton : activateButton}
              onClick={toggleProductStatus}
            >
              {product.is_active ? "تعطيل المنتج" : "تفعيل المنتج"}
            </button>
          )}
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>المستثمرون المرتبطون بالمنتج</h2>

          <div style={tableHeader}>
            <span>المستثمر</span>
            <span>الهوية</span>
            <span>الجوال</span>
            <span>الكمية الحالية</span>
            <span>آخر تحديث</span>
          </div>

          {inventory.length === 0 ? (
            <div style={emptyBox}>لا يوجد مستثمرون مرتبطون بهذا المنتج</div>
          ) : (
            inventory.map((item) => (
              <div key={item.id} style={tableRow}>
                <span
                  style={{
                    cursor: "pointer",
                    color: "#0d47a1",
                    fontWeight: "bold",
                  }}
                  onClick={() =>
                    (window.location.href = `/finance/${branch}/inventory/investors/${item.investor_id}`)
                  }
                >
                  {item.finance_investors?.investor_name || "-"}
                </span>
                <span>{item.finance_investors?.national_id || "-"}</span>
                <span>{item.finance_investors?.phone || "-"}</span>
                <strong>{item.quantity || 0}</strong>
                <span>{formatDate(item.updated_at)}</span>
              </div>
            ))
          )}
        </section>

        <button
          style={backButton}
          onClick={() =>
            (window.location.href = `/finance/${branch}/inventory/products`)
          }
        >
          الرجوع للمنتجات
        </button>
      </div>
    </main>
  );
}

function Row({ label, value }: any) {
  return (
    <div style={row}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryBox({ title, value }: any) {
  return (
    <div style={summaryBox}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionButton({ title, onClick }: any) {
  return (
    <button style={actionButton} onClick={onClick}>
      {title}
    </button>
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
  maxWidth: 1100,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
};

const headerText = {
  margin: "8px 0 0",
  opacity: 0.9,
  fontSize: 15,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const summaryBox = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  color: "#0d47a1",
  fontWeight: "bold",
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  overflowX: "auto" as const,
};

const sectionTitle = {
  marginTop: 0,
  color: "#0d47a1",
  fontSize: 22,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
};

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 16,
};

const actionButton = {
  width: "100%",
  padding: 16,
  background: "white",
  color: "#0d47a1",
  border: "1px solid #d9e3f5",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const dangerButton = {
  width: "100%",
  padding: 16,
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const activateButton = {
  width: "100%",
  padding: 16,
  background: "#dcfce7",
  color: "#166534",
  border: "none",
  borderRadius: 16,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "2fr 1.4fr 1.4fr 1fr 1.5fr",
  gap: 12,
  minWidth: 900,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "2fr 1.4fr 1.4fr 1fr 1.5fr",
  gap: 12,
  minWidth: 900,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const emptyBox = {
  minWidth: 900,
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  textAlign: "center" as const,
  color: "#6b7280",
};

const activeBadge = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
};

const inactiveBadge = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "8px 14px",
  fontWeight: "bold",
  whiteSpace: "nowrap" as const,
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
