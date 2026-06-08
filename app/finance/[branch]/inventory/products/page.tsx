"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

export default function ProductsPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    loadCurrentUserPermissions();
    loadProducts();
  }, [branch]);

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

  async function loadProducts() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setProducts([]);
      return;
    }

    const { data: productsData } = await supabase
      .from("finance_products")
      .select("*")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    const { data: inventoryData } = await supabase
      .from("finance_inventory")
      .select("product_id, investor_id, quantity")
      .eq("branch_id", branchId);

    const enrichedProducts = (productsData || []).map((product) => {
      const productInventory = (inventoryData || []).filter(
        (item) => item.product_id === product.id
      );

      const investorsCount = new Set(
        productInventory.map((item) => item.investor_id)
      ).size;

      const totalQuantity = productInventory.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      );

      return {
        ...product,
        investorsCount,
        totalQuantity,
      };
    });

    setProducts(enrichedProducts);
  }

  async function toggleProductStatus(product: any) {
    if (!hasPermission("toggle_product")) {
      alert("لا تملك صلاحية تعطيل أو تفعيل المنتجات");
      return;
    }

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
      .eq("id", product.id);

    if (error) {
      alert("تعذر تعديل حالة المنتج");
      return;
    }

    await loadProducts();
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim();

    return products.filter((product) => {
      const name = product.product_name || "";
      const category = product.product_category || "";

      return name.includes(query) || category.includes(query);
    });
  }, [products, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  );

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>📦 المنتجات</h1>
        </div>

        <section style={card}>
          <div style={topActions}>
            <input
              style={searchInput}
              placeholder="البحث باسم المنتج أو التصنيف"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />

            {hasPermission("add_product") && (
              <button
                style={addButton}
                onClick={() =>
                  (window.location.href = `/finance/${branch}/inventory/products/new`)
                }
              >
                ➕ إضافة منتج
              </button>
            )}
          </div>
        </section>

        <section style={card}>
          <div style={listHeader}>
            <h2 style={sectionTitle}>قائمة المنتجات</h2>

            {filteredProducts.length > 0 && (
              <span style={pageInfo}>
                صفحة {currentPage} من {totalPages} - عرض{" "}
                {paginatedProducts.length} من {filteredProducts.length}
              </span>
            )}
          </div>

          <div style={tableHeader}>
            <span>المنتج</span>
            <span>التصنيف</span>
            <span>سعر الوحدة</span>
            <span>عدد المستثمرين</span>
            <span>إجمالي المخزون</span>
            <span>الحالة</span>
            <span>الإجراءات</span>
          </div>

          {paginatedProducts.length === 0 ? (
            <div style={emptyBox}>لا توجد منتجات</div>
          ) : (
            paginatedProducts.map((product) => (
              <div key={product.id} style={tableRow}>
                <span
                  style={{
                    cursor: "pointer",
                    color: "#0d47a1",
                    fontWeight: "bold",
                  }}
                  onClick={() =>
                    (window.location.href = `/finance/${branch}/inventory/products/${product.id}`)
                  }
                >
                  {product.product_name || "-"}
                </span>

                <span>{product.product_category || "-"}</span>
                <span>{product.unit_price || 0} ر.س</span>
                <span>{product.investorsCount || 0}</span>
                <strong>{product.totalQuantity || 0}</strong>

                <span style={product.is_active ? activeBadge : inactiveBadge}>
                  {product.is_active ? "نشط" : "معطل"}
                </span>

                <div style={actionsCell}>
                  {hasPermission("edit_product") && (
                    <button
                      style={smallGrayButton}
                      onClick={() =>
                        (window.location.href = `/finance/${branch}/inventory/products/${product.id}/edit`)
                      }
                    >
                      تعديل
                    </button>
                  )}

                  {hasPermission("toggle_product") && (
                    <button
                      style={smallDangerButton}
                      onClick={() => toggleProductStatus(product)}
                    >
                      {product.is_active ? "تعطيل" : "تفعيل"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {filteredProducts.length > ITEMS_PER_PAGE && (
            <div style={paginationBox}>
              <button
                style={{
                  ...paginationButton,
                  opacity: currentPage === 1 ? 0.5 : 1,
                }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
              >
                السابق
              </button>

              <span style={paginationText}>
                صفحة {currentPage} من {totalPages}
              </span>

              <button
                style={{
                  ...paginationButton,
                  opacity: currentPage === totalPages ? 0.5 : 1,
                }}
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(page + 1, totalPages))
                }
              >
                التالي
              </button>
            </div>
          )}
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
  maxWidth: 1100,
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
  marginBottom: 16,
  overflowX: "auto" as const,
};

const topActions = {
  display: "grid",
  gridTemplateColumns: "1fr 170px",
  gap: 12,
  alignItems: "center",
};

const searchInput = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
};

const addButton = {
  width: "100%",
  padding: 14,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const listHeader = {
  minWidth: 1100,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const sectionTitle = {
  margin: 0,
  color: "#0d47a1",
  fontSize: 22,
};

const pageInfo = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: "bold",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 1fr 180px",
  gap: 12,
  minWidth: 1100,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 1fr 180px",
  gap: 12,
  minWidth: 1100,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const emptyBox = {
  minWidth: 1100,
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
  padding: "6px 10px",
  fontWeight: "bold",
  textAlign: "center" as const,
};

const inactiveBadge = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: "bold",
  textAlign: "center" as const,
};

const actionsCell = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
};

const smallGrayButton = {
  background: "#e5e7eb",
  color: "#111827",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: "bold",
  cursor: "pointer",
};

const smallDangerButton = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 10,
  padding: "8px 10px",
  fontWeight: "bold",
  cursor: "pointer",
};

const paginationBox = {
  minWidth: 1100,
  marginTop: 18,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const paginationButton = {
  padding: "11px 18px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
};

const paginationText = {
  color: "#0f172a",
  fontWeight: "bold",
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
