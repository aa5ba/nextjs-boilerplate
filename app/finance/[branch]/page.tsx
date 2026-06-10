"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import FinanceTrialSidebar from "./FinanceTrialSidebar";

const sections = [
  { title: "سير العمل", path: "workflow", icon: "💼", permission: "workflow" },
  { title: "العملاء", path: "customers", icon: "👥", permission: "customers" },
  { title: "طلب جديد", path: "new-request", icon: "➕", permission: "contracts" },
  { title: "سداد", path: "payments", icon: "💳", permission: "payments" },
  { title: "المخزون والمنتجات", path: "inventory", icon: "📦", permission: "inventory" },
  { title: "العقود", path: "contracts", icon: "📄", permission: "contracts" },
  { title: "المصروفات والمشتريات", path: "expenses", icon: "🧾", permission: "expenses" },
  { title: "الملاحظات", path: "notes", icon: "✏️", permission: "workflow" },
  { title: "الصلاحيات", path: "permissions", icon: "🔐", permission: "settings" },
  { title: "الإعدادات", path: "settings", icon: "⚙️", permission: "settings" },
];

export default function FinancePage() {
  const params = useParams();
  const branch = params.branch as string;

  const [organizationName, setOrganizationName] = useState("احتساب");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const [customersCount, setCustomersCount] = useState(0);
  const [contractsCount, setContractsCount] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [latestActivities, setLatestActivities] = useState<any[]>([]);

  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    loadCurrentUserPermissions();
    if (branch) loadBranch();
  }, [branch]);

  useEffect(() => {
    if (branchId) {
      loadDashboardData(branchId);
    }
  }, [branchId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      runSmartSearch();
    }, 400);

    return () => clearTimeout(timer);
  }, [searchText, branchId, permissions, roles]);

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

  const visibleSections = useMemo(() => {
    return sections.filter((item) => hasPermission(item.permission));
  }, [permissions, roles]);

  async function loadBranch() {
    setLoading(true);

    const { data, error } = await supabase
      .from("finance_branches")
      .select("id, organization_name, branch_name, is_active")
      .eq("branch_slug", branch)
      .single();

    if (error || !data || !data.is_active) {
      setOrganizationName("فرع غير موجود");
      setBranchId(null);
      setLoading(false);
      return;
    }

    setOrganizationName(data.organization_name || "احتساب");
    setBranchId(data.id);
    setLoading(false);
  }

  async function loadDashboardData(currentBranchId: string) {
    await Promise.all([
      loadCounts(currentBranchId),
      loadAlerts(currentBranchId),
      loadLatestActivities(currentBranchId),
    ]);
  }

  async function loadCounts(currentBranchId: string) {
    const [customersResult, contractsResult] = await Promise.all([
      supabase
        .from("finance_customers")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", currentBranchId),

      supabase
        .from("finance_contracts")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", currentBranchId),
    ]);

    setCustomersCount(customersResult.count || 0);
    setContractsCount(contractsResult.count || 0);
  }

  async function loadAlerts(currentBranchId: string) {
    const newAlerts: any[] = [];

    const { data: negativeInventory } = await supabase
      .from("finance_inventory")
      .select(
        `
        id,
        quantity,
        finance_products(product_name),
        finance_investors(investor_name)
      `
      )
      .eq("branch_id", currentBranchId)
      .lt("quantity", 0)
      .limit(5);

    const { data: lowInventory } = await supabase
      .from("finance_inventory")
      .select(
        `
        id,
        quantity,
        finance_products(product_name),
        finance_investors(investor_name)
      `
      )
      .eq("branch_id", currentBranchId)
      .gte("quantity", 0)
      .lte("quantity", 5)
      .limit(5);

    negativeInventory?.forEach((item: any) => {
      newAlerts.push({
        id: `negative-${item.id}`,
        type: "danger",
        icon: "🔴",
        title: "منتج بالسالب",
        text: `${getProductName(item)} لدى ${getInvestorName(item)} | الكمية: ${
          item.quantity ?? 0
        }`,
        href: `/finance/${branch}/inventory`,
      });
    });

    lowInventory?.forEach((item: any) => {
      newAlerts.push({
        id: `low-${item.id}`,
        type: "warning",
        icon: "🟠",
        title: "منتج منخفض",
        text: `${getProductName(item)} لدى ${getInvestorName(item)} | الكمية: ${
          item.quantity ?? 0
        }`,
        href: `/finance/${branch}/inventory`,
      });
    });

    if (newAlerts.length === 0) {
      newAlerts.push({
        id: "safe",
        type: "success",
        icon: "✅",
        title: "لا توجد تنبيهات حالياً",
        text: "المخزون والعمليات بحالة مستقرة.",
        href: `/finance/${branch}/inventory`,
      });
    }

    setAlerts(newAlerts.slice(0, 6));
  }

  async function loadLatestActivities(currentBranchId: string) {
    const { data } = await supabase
      .from("finance_activity_logs")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false })
      .limit(6);

    setLatestActivities(data || []);
  }

  function getProductName(item: any) {
    return (
      item?.finance_products?.product_name ||
      item?.product_name ||
      "منتج غير محدد"
    );
  }

  function getInvestorName(item: any) {
    return (
      item?.finance_investors?.investor_name ||
      item?.investor_name ||
      "مستثمر غير محدد"
    );
  }

  function getActivityText(item: any) {
    return (
      item.description ||
      item.details ||
      item.note ||
      item.action ||
      item.action_type ||
      "عملية جديدة"
    );
  }

  function getActivityTitle(item: any) {
    const action = item.action_type || item.action || "";

    if (action.includes("contract")) return "العقود";
    if (action.includes("payment")) return "السداد";
    if (action.includes("customer")) return "العملاء";
    if (action.includes("inventory")) return "المخزون";

    return "عملية";
  }

  function formatDate(value: string) {
    if (!value) return "-";

    try {
      return new Intl.DateTimeFormat("ar-SA", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function normalizeDigits(value: string) {
    return value
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
      .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString());
  }

  async function runSmartSearch() {
    const query = normalizeDigits(searchText.trim());

    if (!branchId || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);

    const safeQuery = query.replace(/,/g, " ");
    const requests: any[] = [];

    if (hasPermission("customers")) {
      requests.push(
        supabase
          .from("finance_customers")
          .select("id, full_name, national_id, phone")
          .eq("branch_id", branchId)
          .or(
            `full_name.ilike.%${safeQuery}%,national_id.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%`
          )
          .limit(5)
      );
    } else {
      requests.push(Promise.resolve({ data: [] }));
    }

    if (hasPermission("contracts")) {
      requests.push(
        supabase
          .from("finance_contracts")
          .select(
            "id, contract_number, customer_name, customer_national_id, customer_phone, investor_name"
          )
          .eq("branch_id", branchId)
          .or(
            `contract_number.ilike.%${safeQuery}%,customer_name.ilike.%${safeQuery}%,customer_national_id.ilike.%${safeQuery}%,customer_phone.ilike.%${safeQuery}%,investor_name.ilike.%${safeQuery}%`
          )
          .limit(5)
      );
    } else {
      requests.push(Promise.resolve({ data: [] }));
    }

    if (hasPermission("inventory")) {
      requests.push(
        supabase
          .from("finance_investors")
          .select("id, investor_name, national_id, commercial_record")
          .eq("branch_id", branchId)
          .or(
            `investor_name.ilike.%${safeQuery}%,national_id.ilike.%${safeQuery}%,commercial_record.ilike.%${safeQuery}%`
          )
          .limit(5)
      );
    } else {
      requests.push(Promise.resolve({ data: [] }));
    }

    const [customersResult, contractsResult, investorsResult] =
      await Promise.all(requests);

    const customers =
      customersResult.data?.map((item: any) => ({
        id: item.id,
        type: "عميل",
        icon: "👤",
        title: item.full_name || "-",
        subtitle: `${item.phone || "-"} | ${item.national_id || "-"}`,
        href: `/finance/${branch}/customers/${item.id}`,
      })) || [];

    const contracts =
      contractsResult.data?.map((item: any) => ({
        id: item.id,
        type: "عقد",
        icon: "📄",
        title: `عقد رقم ${item.contract_number || "-"}`,
        subtitle: `${item.customer_name || "-"} | ${
          item.customer_phone || "-"
        } | ${item.investor_name || "-"}`,
        href: `/finance/${branch}/contracts/${item.id}`,
      })) || [];

    const investors =
      investorsResult.data?.map((item: any) => ({
        id: item.id,
        type: "مستثمر",
        icon: "🏦",
        title: item.investor_name || "-",
        subtitle: item.national_id || item.commercial_record || "-",
        href: `/finance/${branch}/inventory/investors/${item.id}`,
      })) || [];

    setSearchResults([...customers, ...contracts, ...investors]);
    setSearchLoading(false);
  }

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingContainer}>
          <section style={hero}>
            <h1 style={heroTitle}>جاري تحميل الفرع...</h1>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={layout}>
        <div className="desktop-sidebar">
          <FinanceTrialSidebar />
        </div>

        <div style={container}>
          <section style={hero}>
            <h1 style={heroTitle}>الصفحة الرئيسية</h1>
            <p style={heroSub}>🏢 {organizationName}</p>
          </section>

          <section style={statsGrid}>
            <StatCard
              title="عدد العملاء"
              value={customersCount}
              icon="👥"
              href={`/finance/${branch}/customers`}
            />

            <StatCard
              title="عدد العقود"
              value={contractsCount}
              icon="📄"
              href={`/finance/${branch}/contracts`}
            />
          </section>

          <section style={searchCard}>
            <div style={searchInputWrap}>
              <span style={searchIcon}>🔎</span>
              <input
                style={searchInput}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="البحث السريع: اسم العميل، الهوية، الجوال، رقم العقد..."
              />

              {searchText && (
                <button
                  style={clearSearchButton}
                  onClick={() => {
                    setSearchText("");
                    setSearchResults([]);
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {searchText.trim().length >= 2 && (
              <div style={resultsBox}>
                {searchLoading ? (
                  <div style={emptyResult}>جاري البحث...</div>
                ) : searchResults.length === 0 ? (
                  <div style={emptyResult}>لا توجد نتائج مطابقة</div>
                ) : (
                  searchResults.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      style={resultItem}
                      onClick={() => (window.location.href = item.href)}
                    >
                      <span style={resultIcon}>{item.icon}</span>

                      <span style={resultContent}>
                        <strong>{item.title}</strong>
                        <small>{item.subtitle}</small>
                      </span>

                      <span style={resultType}>{item.type}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </section>

          <section style={sectionsCard}>
            <div style={grid}>
              {visibleSections.map((item) => (
                <Card
                  key={item.path}
                  title={item.title}
                  href={`/finance/${branch}/${item.path}`}
                  icon={item.icon}
                />
              ))}
            </div>
          </section>

          <section style={bottomGrid}>
            <section style={panelCard}>
              <div style={panelHeader}>
                <h2 style={panelTitle}>التنبيهات</h2>
                <button
                  style={panelLink}
                  onClick={() => (window.location.href = `/finance/${branch}/inventory`)}
                >
                  عرض المخزون
                </button>
              </div>

              <div style={listWrap}>
                {alerts.map((item) => (
                  <button
                    key={item.id}
                    style={{
                      ...alertItem,
                      ...(item.type === "danger"
                        ? alertDanger
                        : item.type === "warning"
                        ? alertWarning
                        : alertSuccess),
                    }}
                    onClick={() => (window.location.href = item.href)}
                  >
                    <span style={alertIcon}>{item.icon}</span>
                    <span style={alertContent}>
                      <strong>{item.title}</strong>
                      <small>{item.text}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section style={panelCard}>
              <div style={panelHeader}>
                <h2 style={panelTitle}>آخر العمليات</h2>
                <button
                  style={panelLink}
                  onClick={() => (window.location.href = `/finance/${branch}/workflow`)}
                >
                  عرض الكل
                </button>
              </div>

              <div style={listWrap}>
                {latestActivities.length === 0 ? (
                  <div style={emptyResult}>لا توجد عمليات مسجلة حالياً</div>
                ) : (
                  latestActivities.map((item: any) => (
                    <div key={item.id} style={activityItem}>
                      <span style={activityIcon}>🕘</span>

                      <span style={activityContent}>
                        <strong>{getActivityTitle(item)}</strong>
                        <small>{getActivityText(item)}</small>
                        <em>{formatDate(item.created_at)}</em>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </section>
        </div>
      </div>

      <style jsx>{`
        .desktop-sidebar {
          display: block;
        }

        @media (max-width: 768px) {
          .desktop-sidebar {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}

function Card({ title, href, icon }: any) {
  return (
    <button style={card} onClick={() => (window.location.href = href)}>
      <div style={cardRight}>
        <span style={iconBox}>{icon}</span>
        <span style={cardTitle}>{title}</span>
      </div>

      <span style={arrow}>‹</span>
    </button>
  );
}

function StatCard({ title, value, icon, href }: any) {
  return (
    <button style={statCard} onClick={() => (window.location.href = href)}>
      <span style={statIcon}>{icon}</span>

      <span style={statContent}>
        <strong>{value}</strong>
        <small>{title}</small>
      </span>
    </button>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f4f7fb",
  backgroundImage:
    "linear-gradient(rgba(244,247,251,0.72), rgba(244,247,251,0.72)), url('/backgrounds/finance-bg.webp')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
  overflowX: "hidden",
};

const loadingContainer: React.CSSProperties = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const layout: React.CSSProperties = {
  width: "100%",
  maxWidth: 1420,
  margin: "auto",
  display: "flex",
  gap: 18,
  alignItems: "flex-start",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  borderRadius: 24,
  padding: 24,
  marginBottom: 14,
  boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
};

const heroTitle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 32,
  lineHeight: 1.4,
};

const heroSub: React.CSSProperties = {
  margin: 0,
  opacity: 0.9,
  fontSize: 16,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 18,
  display: "flex",
  alignItems: "center",
  gap: 14,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  textAlign: "right",
};

const statIcon: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
};

const statContent: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  color: "#0f172a",
};

const searchCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.94)",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 12,
  marginBottom: 14,
  boxShadow: "0 8px 22px rgba(15,23,42,0.04)",
  backdropFilter: "blur(6px)",
};

const searchInputWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "#f8fafc",
  border: "1px solid #dbe3ef",
  borderRadius: 15,
  padding: "0 14px",
  minHeight: 56,
};

const searchIcon: React.CSSProperties = {
  fontSize: 21,
  color: "#64748b",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  fontSize: 16,
  color: "#0f172a",
  background: "transparent",
  fontFamily: "var(--font-almarai), sans-serif",
};

const clearSearchButton: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "none",
  background: "#e2e8f0",
  color: "#475569",
  fontSize: 22,
  cursor: "pointer",
};

const resultsBox: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 10,
};

const resultItem: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gridTemplateColumns: "44px 1fr auto",
  gap: 12,
  alignItems: "center",
  cursor: "pointer",
  textAlign: "right",
};

const resultIcon: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const resultContent: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#0f172a",
};

const resultType: React.CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  fontSize: 13,
};

const emptyResult: React.CSSProperties = {
  padding: 14,
  textAlign: "center",
  color: "#64748b",
  background: "#f8fafc",
  borderRadius: 14,
};

const sectionsCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.94)",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  backdropFilter: "blur(6px)",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
  gap: 12,
};

const card: React.CSSProperties = {
  width: "100%",
  minHeight: 82,
  background: "#ffffff",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 6px 16px rgba(15,23,42,0.04)",
};

const cardRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconBox: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 21,
};

const cardTitle: React.CSSProperties = {
  color: "#0f172a",
};

const arrow: React.CSSProperties = {
  color: "#2563eb",
  fontSize: 26,
};

const bottomGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 14,
  marginTop: 14,
};

const panelCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  backdropFilter: "blur(6px)",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const panelTitle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 20,
};

const panelLink: React.CSSProperties = {
  border: "none",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "9px 14px",
  fontWeight: 800,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const listWrap: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const alertItem: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  padding: 12,
  display: "grid",
  gridTemplateColumns: "42px 1fr",
  gap: 12,
  alignItems: "center",
  cursor: "pointer",
  textAlign: "right",
};

const alertDanger: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
};

const alertWarning: React.CSSProperties = {
  border: "1px solid #fed7aa",
  background: "#fff7ed",
};

const alertSuccess: React.CSSProperties = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
};

const alertIcon: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "rgba(255,255,255,0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 21,
};

const alertContent: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#0f172a",
};

const activityItem: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: 16,
  padding: 12,
  display: "grid",
  gridTemplateColumns: "42px 1fr",
  gap: 12,
  alignItems: "center",
};

const activityIcon: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "#f1f5f9",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 21,
};

const activityContent: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#0f172a",
};
