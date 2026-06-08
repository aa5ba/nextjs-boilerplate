"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const LOW_STOCK_LIMIT = 5;
const ITEMS_PER_PAGE = 25;

export default function FinanceInventoryPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [items, setItems] = useState<any[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [investorsCount, setInvestorsCount] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [negativeCount, setNegativeCount] = useState(0);
  const [lowCount, setLowCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    loadInventory();
  }, [branch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

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

  async function loadInventory() {
    setLoading(true);
    loadCurrentUserPermissions();

    const branchId = await getBranchId(branch);

    if (!branchId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data: products } = await supabase
      .from("finance_products")
      .select("id")
      .eq("branch_id", branchId)
      .eq("is_active", true);

    const { data: investors } = await supabase
      .from("finance_investors")
      .select("id")
      .eq("branch_id", branchId)
      .eq("is_active", true);

    const { data: inventory } = await supabase
      .from("finance_inventory")
      .select(
        "*, finance_products(product_name), finance_investors(investor_name)"
      )
      .eq("branch_id", branchId)
      .order("updated_at", { ascending: false });

    const list = inventory || [];

    setProductsCount(products?.length || 0);
    setInvestorsCount(investors?.length || 0);
    setItems(list);

    setTotalQuantity(
      list.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    );

    setNegativeCount(
      list.filter((item) => Number(item.quantity || 0) < 0).length
    );

    setLowCount(
      list.filter((item) => {
        const qty = Number(item.quantity || 0);
        return qty >= 0 && qty <= LOW_STOCK_LIMIT;
      }).length
    );

    setLoading(false);
  }

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const productName = item.finance_products?.product_name || "";
        const investorName = item.finance_investors?.investor_name || "";
        const qty = Number(item.quantity || 0);
        const status = getStockStatus(qty);

        const matchesSearch =
          productName.includes(searchTerm) || investorName.includes(searchTerm);

        const matchesStatus =
          statusFilter === "all" || status.key === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aStatus = getStockStatus(Number(a.quantity || 0)).priority;
        const bStatus = getStockStatus(Number(b.quantity || 0)).priority;

        return aStatus - bStatus;
      });
  }, [items, searchTerm, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / ITEMS_PER_PAGE)
  );

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>📦 المخزون والمنتجات</h1>
        </div>

        <section style={summaryGrid}>
          <SummaryCard icon="🧩" title="عدد المنتجات" value={productsCount} />
          <SummaryCard icon="📦" title="إجمالي الكمية" value={totalQuantity} />
          <SummaryCard icon="👤" title="عدد المستثمرين" value={investorsCount} />
          <SummaryCard icon="🔴" title="منتجات بالسالب" value={negativeCount} />
          <SummaryCard icon="🟠" title="منتجات منخفضة" value={lowCount} />
        </section>

        <section style={actionsSection}>
          <ActionButton
            icon="➕"
            title="إضافة منتج"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/products/new`)
            }
          />

          {hasPermission("add_investor") && (
            <ActionButton
              icon="👤"
              title="إضافة مستثمر"
              onClick={() =>
                (window.location.href = `/finance/${branch}/inventory/investors/new`)
              }
            />
          )}

          <ActionButton
            icon="👥"
            title="المستثمرين"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/investors`)
            }
          />

          <ActionButton
            icon="📦"
            title="المنتجات"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/products`)
            }
          />

          <ActionButton
            icon="📦"
            title="إضافة كمية للمخزون"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/add-stock`)
            }
          />

          <ActionButton
            icon="📋"
            title="سجل الحركات"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/movements`)
            }
          />

          <ActionButton
            icon="🖨️"
            title="كشف المنتجات"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/products-report`)
            }
          />

          <ActionButton
            icon="🧾"
            title="كشف المستثمر"
            onClick={() =>
              (window.location.href = `/finance/${branch}/inventory/investor-report`)
            }
          />
        </section>

        <section style={tableCard}>
          <div style={tableTop}>
            <div>
              <h2 style={sectionTitle}>المخزون الحالي</h2>

              {!loading && filteredItems.length > 0 && (
                <div style={pageInfo}>
                  صفحة {currentPage} من {totalPages} - عرض{" "}
                  {paginatedItems.length} من {filteredItems.length}
                </div>
              )}
            </div>

            <div style={filters}>
              <input
                style={searchInput}
                placeholder="بحث باسم المنتج أو المستثمر"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <select
                style={filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">كل الحالات</option>
                <option value="negative">بالسالب</option>
                <option value="low">منخفض</option>
                <option value="normal">طبيعي</option>
              </select>
            </div>
          </div>

          <div style={tableHeader}>
            <span>المنتج</span>
            <span>المستثمر</span>
            <span>الكمية</span>
            <span>الحالة</span>
            <span>آخر تحديث</span>
          </div>

          {loading ? (
            <div style={emptyBox}>جاري تحميل المخزون...</div>
          ) : filteredItems.length === 0 ? (
            <div style={emptyBox}>لا توجد نتائج مطابقة</div>
          ) : (
            paginatedItems.map((item) => {
              const qty = Number(item.quantity || 0);
              const status = getStockStatus(qty);

              return (
                <div key={item.id} style={getTableRowStyle(status.key)}>
                  <span>{item.finance_products?.product_name || "-"}</span>
                  <span>{item.finance_investors?.investor_name || "-"}</span>
                  <strong>{qty}</strong>
                  <span style={getStatusBadgeStyle(status.key)}>
                    {status.label}
                  </span>
                  <span>{formatDate(item.updated_at)}</span>
                </div>
              );
            })
          )}

          {!loading && filteredItems.length > ITEMS_PER_PAGE && (
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
          onClick={() => (window.location.href = `/finance/${branch}`)}
        >
          الرجوع لمحطة العمل الرئيسية
        </button>
      </div>
    </main>
  );
}

function getStockStatus(quantity: number) {
  if (quantity < 0) {
    return {
      key: "negative",
      label: "🔴 بالسالب",
      priority: 1,
    };
  }

  if (quantity <= LOW_STOCK_LIMIT) {
    return {
      key: "low",
      label: "🟠 منخفض",
      priority: 2,
    };
  }

  return {
    key: "normal",
    label: "🟢 طبيعي",
    priority: 3,
  };
}

function SummaryCard({ icon, title, value }: any) {
  return (
    <div style={summaryCard}>
      <div>
        <strong>{title}</strong>
        <span>{value}</span>
      </div>

      <div style={summaryIcon}>{icon}</div>
    </div>
  );
}

function ActionButton({ icon, title, onClick }: any) {
  return (
    <button style={actionButton} onClick={onClick}>
      <span style={actionIcon}>{icon}</span>
      <span>{title}</span>
    </button>
  );
}

function formatDate(date: string) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("ar-SA-u-ca-gregory", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getTableRowStyle(status: string) {
  if (status === "negative") return { ...tableRow, ...negativeRow };
  if (status === "low") return { ...tableRow, ...lowRow };
  return tableRow;
}

function getStatusBadgeStyle(status: string) {
  if (status === "negative") return statusNegative;
  if (status === "low") return statusLow;
  return statusNormal;
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

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const summaryCard = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const summaryIcon = {
  width: 46,
  height: 46,
  borderRadius: 14,
  background: "#eef5ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const actionButton = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  color: "#0d47a1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const actionIcon = {
  fontSize: 20,
};

const tableCard = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  overflowX: "auto" as const,
};

const tableTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap" as const,
  marginBottom: 12,
};

const sectionTitle = {
  margin: 0,
  color: "#0d47a1",
};

const pageInfo = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: "bold",
  marginTop: 6,
};

const filters = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap" as const,
};

const searchInput = {
  minWidth: 240,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #d9e3f5",
  fontSize: 15,
};

const filterSelect = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid #d9e3f5",
  fontSize: 15,
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr 1.2fr 1.5fr",
  gap: 12,
  minWidth: 860,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  marginBottom: 10,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr 1.2fr 1.5fr",
  gap: 12,
  minWidth: 860,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const negativeRow = {
  background: "#fef2f2",
};

const lowRow = {
  background: "#fffbeb",
};

const statusNegative = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: "bold",
  textAlign: "center" as const,
};

const statusLow = {
  background: "#fef3c7",
  color: "#92400e",
  border: "1px solid #fde68a",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: "bold",
  textAlign: "center" as const,
};

const statusNormal = {
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  padding: "6px 10px",
  borderRadius: 999,
  fontWeight: "bold",
  textAlign: "center" as const,
};

const emptyBox = {
  minWidth: 760,
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  textAlign: "center" as const,
  color: "#6b7280",
};

const paginationBox = {
  minWidth: 860,
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
