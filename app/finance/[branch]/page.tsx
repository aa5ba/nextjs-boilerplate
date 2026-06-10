"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const sections = [
  {
    title: "سير العمل",
    path: "workflow",
    desc: "متابعة العمليات والتنبيهات",
    icon: "💼",
    color: "#2563eb",
    bg: "linear-gradient(135deg,#eff6ff,#dbeafe)",
    permission: "workflow",
  },
  {
    title: "العملاء",
    path: "customers",
    desc: "إدارة العملاء والملفات",
    icon: "👥",
    color: "#0284c7",
    bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)",
    permission: "customers",
  },
  {
    title: "طلب جديد",
    path: "new-request",
    desc: "إنشاء عقد وسند جديد",
    icon: "➕",
    color: "#16a34a",
    bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
    permission: "contracts",
  },
  {
    title: "السداد",
    path: "payments",
    desc: "تسجيل ومتابعة الدفعات",
    icon: "💳",
    color: "#059669",
    bg: "linear-gradient(135deg,#ecfdf5,#d1fae5)",
    permission: "payments",
  },
  {
    title: "المخزون",
    path: "inventory",
    desc: "المنتجات والمستثمرين",
    icon: "📦",
    color: "#0f766e",
    bg: "linear-gradient(135deg,#f0fdfa,#ccfbf1)",
    permission: "inventory",
  },
  {
    title: "العقود",
    path: "contracts",
    desc: "بحث وطباعة ومتابعة",
    icon: "📄",
    color: "#1d4ed8",
    bg: "linear-gradient(135deg,#eef2ff,#dbeafe)",
    permission: "contracts",
  },
  {
    title: "المصروفات",
    path: "expenses",
    desc: "المشتريات والمصروفات",
    icon: "🧾",
    color: "#475569",
    bg: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
    permission: "expenses",
  },
  {
    title: "الملاحظات",
    path: "notes",
    desc: "ملاحظات وتذكيرات",
    icon: "✏️",
    color: "#0ea5e9",
    bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)",
    permission: "workflow",
  },
  {
    title: "الصلاحيات",
    path: "permissions",
    desc: "المستخدمون والأدوار",
    icon: "🔐",
    color: "#334155",
    bg: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
    permission: "settings",
  },
  {
    title: "الإعدادات",
    path: "settings",
    desc: "بيانات الفرع والمنظمة",
    icon: "⚙️",
    color: "#0f172a",
    bg: "linear-gradient(135deg,#f1f5f9,#e2e8f0)",
    permission: "settings",
  },
];

export default function FinancePage() {
  const params = useParams();
  const branch = params.branch as string;

  const [organizationName, setOrganizationName] = useState("احتساب");
  const [employeeName, setEmployeeName] = useState("الموظف");
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

  const today = new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    loadCurrentUserPermissions();
    if (branch) loadBranch();
  }, [branch]);

  useEffect(() => {
    if (branchId) loadDashboardData(branchId);
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
      setEmployeeName("الموظف");
      return;
    }

    try {
      const user = JSON.parse(savedUser);

      setRoles(user.roles || []);
      setPermissions(user.permissions || []);
      setEmployeeName(
        user.full_name ||
          user.fullName ||
          user.name ||
          user.username ||
          "الموظف"
      );
    } catch {
      setRoles(["مدير رئيسي"]);
      setPermissions([]);
      setEmployeeName("الموظف");
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
      .limit(3);

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
      .limit(3);

    negativeInventory?.forEach((item: any) => {
      newAlerts.push({
        id: `negative-${item.id}`,
        type: "danger",
        text: `منتج بالسالب: ${getProductName(item)} - الكمية ${item.quantity}`,
        href: `/finance/${branch}/inventory`,
      });
    });

    lowInventory?.forEach((item: any) => {
      newAlerts.push({
        id: `low-${item.id}`,
        type: "green",
        text: `منتج منخفض: ${getProductName(item)} - الكمية ${item.quantity}`,
        href: `/finance/${branch}/inventory`,
      });
    });

    if (newAlerts.length === 0) {
      newAlerts.push({
        id: "safe",
        type: "blue",
        text: "لا توجد تنبيهات مهمة حالياً",
        href: `/finance/${branch}/inventory`,
      });
    }

    setAlerts(newAlerts.slice(0, 3));
  }

  async function loadLatestActivities(currentBranchId: string) {
    const { data } = await supabase
      .from("finance_activity_logs")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false })
      .limit(3);

    setLatestActivities(data || []);
  }

  function getProductName(item: any) {
    return (
      item?.finance_products?.product_name ||
      item?.product_name ||
      "منتج غير محدد"
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

  function go(path: string) {
    window.location.href = `/finance/${branch}/${path}`;
  }

  function logout() {
    localStorage.removeItem("finance_user");
    window.location.href = `/finance/${branch}`;
  }

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={container}>
          <section className="v13-hero" style={hero}>
            <div style={centerHeader}>
              <h1 className="v13-org-title" style={organizationTitle}>
                جاري تحميل الفرع...
              </h1>
            </div>
          </section>
        </div>
        <ResponsiveStyles />
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <section className="v13-hero" style={hero}>
          <div className="v13-right" style={rightHeader}>
            <div style={dateLabel}>التاريخ الميلادي</div>
            <div style={dateText}>{today}</div>
          </div>

          <div style={centerHeader}>
            <h1 className="v13-org-title" style={organizationTitle}>
              {organizationName}
            </h1>
            <div style={workstationTitle}>محطة العمل الرئيسية</div>
          </div>

          <div className="v13-left" style={leftHeader}>
            <div style={employeeBox}>
              <span>👤</span>
              <strong>{employeeName}</strong>
            </div>

            <button style={logoutButton} onClick={logout}>
              تسجيل الخروج
            </button>
          </div>
        </section>

        <section style={statsGrid}>
          <StatCard
            title="العقود"
            value={contractsCount}
            icon="📄"
            color="#2563eb"
          />
          <StatCard
            title="العملاء"
            value={customersCount}
            icon="👥"
            color="#0284c7"
          />
        </section>

        <section style={searchWrapper}>
          <section style={searchCard}>
            <span style={searchIcon}>🔎</span>
            <input
              style={searchInput}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="البحث السريع: اسم العميل، رقم العقد، الهوية، الجوال..."
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
          </section>

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

        <section style={quickActions}>
          {hasPermission("contracts") && (
            <button style={primaryAction} onClick={() => go("new-request")}>
              ➕ طلب جديد
            </button>
          )}

          {hasPermission("payments") && (
            <button style={greenAction} onClick={() => go("payments/new")}>
              💳 تسجيل سداد
            </button>
          )}

          {hasPermission("inventory") && (
            <button style={tealAction} onClick={() => go("inventory/add")}>
              📦 إضافة مخزون
            </button>
          )}

          {hasPermission("expenses") && (
            <button style={grayAction} onClick={() => go("expenses/new")}>
              🧾 فاتورة مصروف
            </button>
          )}
        </section>

        <section style={sectionsPanel}>
          <div style={panelHeader}>
            <span style={panelIconBlue}>⚡</span>
            <strong>أقسام محطة العمل</strong>
          </div>

          <div style={grid}>
            {visibleSections.map((item) => (
              <button
                key={item.title}
                style={sectionCard}
                onClick={() => go(item.path)}
              >
                <div style={cardRight}>
                  <div
                    style={{
                      ...iconBox,
                      background: item.bg,
                      color: item.color,
                    }}
                  >
                    {item.icon}
                  </div>

                  <div>
                    <div style={cardTitle}>{item.title}</div>
                    <div style={cardDesc}>{item.desc}</div>
                  </div>
                </div>

                <span style={{ ...arrow, color: item.color }}>‹</span>
              </button>
            ))}
          </div>
        </section>

        <section style={compactInfoGrid}>
          <div style={compactPanel}>
            <div style={compactPanelHeader}>
              <span style={compactPanelIconBlue}>🚨</span>
              <strong>تنبيهات مهمة</strong>
            </div>

            {alerts.map((item) => (
              <button
                key={item.id}
                style={
                  item.type === "green"
                    ? compactNoticeGreen
                    : item.type === "danger"
                    ? compactNoticeRed
                    : compactNoticeBlue
                }
                onClick={() => (window.location.href = item.href)}
              >
                {item.text}
              </button>
            ))}
          </div>

          <div style={compactPanel}>
            <div style={compactPanelHeader}>
              <span style={compactPanelIconGreen}>🕒</span>
              <strong>آخر العمليات</strong>
            </div>

            {latestActivities.length === 0 ? (
              <div style={compactActivityItem}>لا توجد عمليات مسجلة حالياً</div>
            ) : (
              latestActivities.map((item: any) => (
                <div key={item.id} style={compactActivityItem}>
                  {getActivityText(item)}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <ResponsiveStyles />
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <div style={statCard}>
      <div style={{ ...statIcon, background: `${color}14`, color }}>
        {icon}
      </div>

      <div>
        <div style={statValue}>{value}</div>
        <div style={statTitle}>{title}</div>
      </div>
    </div>
  );
}

function ResponsiveStyles() {
  return (
    <style jsx global>{`
      @media (max-width: 700px) {
        .v13-hero {
          grid-template-columns: 1fr !important;
          text-align: center !important;
          padding: 24px 18px !important;
          gap: 18px !important;
        }

        .v13-right,
        .v13-left {
          justify-content: center !important;
          text-align: center !important;
        }

        .v13-left {
          flex-direction: column !important;
        }

        .v13-org-title {
          font-size: 30px !important;
          line-height: 1.35 !important;
        }
      }
    `}</style>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.82)), url('/backgrounds/v13-finance-bg-1.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
  position: "relative",
  overflowX: "hidden",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 1180,
  margin: "auto",
  position: "relative",
  zIndex: 2,
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg,#0f172a 0%,#1d4ed8 48%,#0f766e 100%)",
  borderRadius: 30,
  padding: 24,
  color: "white",
  display: "grid",
  gridTemplateColumns: "220px 1fr 260px",
  alignItems: "center",
  gap: 16,
  marginBottom: 16,
  boxShadow: "0 18px 45px rgba(29,78,216,0.18)",
};

const rightHeader: React.CSSProperties = {
  textAlign: "right",
};

const centerHeader: React.CSSProperties = {
  textAlign: "center",
};

const leftHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const organizationTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  lineHeight: 1.25,
  fontWeight: 900,
  color: "white",
};

const workstationTitle: React.CSSProperties = {
  marginTop: 7,
  fontSize: 16,
  color: "#dbeafe",
  fontWeight: 800,
};

const dateLabel: React.CSSProperties = {
  color: "#bfdbfe",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 4,
};

const dateText: React.CSSProperties = {
  color: "white",
  fontSize: 17,
  fontWeight: 900,
};

const employeeBox: React.CSSProperties = {
  background: "rgba(255,255,255,0.13)",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 14,
  padding: "10px 12px",
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "white",
};

const logoutButton: React.CSSProperties = {
  background: "rgba(255,255,255,0.18)",
  border: "1px solid rgba(255,255,255,0.28)",
  color: "white",
  borderRadius: 14,
  padding: "10px 14px",
  fontWeight: 900,
  cursor: "pointer",
  backdropFilter: "blur(8px)",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
  gap: 12,
  marginBottom: 14,
  maxWidth: 620,
  marginLeft: "auto",
  marginRight: "auto",
};

const statCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 18,
  display: "flex",
  alignItems: "center",
  gap: 14,
  boxShadow: "0 12px 28px rgba(15,23,42,0.05)",
};

const statIcon: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 25,
  flex: "0 0 auto",
};

const statValue: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 29,
  fontWeight: 900,
};

const statTitle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 800,
  marginTop: 4,
};

const searchWrapper: React.CSSProperties = {
  position: "relative",
  marginBottom: 14,
};

const searchCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.98)",
  border: "1px solid #dbeafe",
  borderRadius: 24,
  padding: "0 16px",
  minHeight: 62,
  display: "flex",
  alignItems: "center",
  gap: 10,
  boxShadow: "0 12px 28px rgba(37,99,235,0.07)",
};

const searchIcon: React.CSSProperties = {
  color: "#2563eb",
  fontSize: 22,
};

const searchInput: React.CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: 16,
  color: "#0f172a",
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
  marginTop: 10,
  display: "grid",
  gap: 8,
};

const resultItem: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e2e8f0",
  background: "rgba(255,255,255,0.98)",
  borderRadius: 16,
  padding: 11,
  display: "grid",
  gridTemplateColumns: "42px 1fr auto",
  gap: 10,
  alignItems: "center",
  cursor: "pointer",
  textAlign: "right",
  boxShadow: "0 8px 18px rgba(15,23,42,0.04)",
};

const resultIcon: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 21,
};

const resultContent: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
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
  padding: 13,
  textAlign: "center",
  color: "#64748b",
  background: "#f8fafc",
  borderRadius: 14,
};

const quickActions: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
  marginBottom: 14,
};

const actionBase: React.CSSProperties = {
  border: "none",
  borderRadius: 18,
  padding: 16,
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
};

const primaryAction: React.CSSProperties = {
  ...actionBase,
  background: "linear-gradient(135deg,#2563eb,#60a5fa)",
  color: "white",
};

const greenAction: React.CSSProperties = {
  ...actionBase,
  background: "linear-gradient(135deg,#16a34a,#4ade80)",
  color: "white",
};

const tealAction: React.CSSProperties = {
  ...actionBase,
  background: "linear-gradient(135deg,#0f766e,#2dd4bf)",
  color: "white",
};

const grayAction: React.CSSProperties = {
  ...actionBase,
  background: "linear-gradient(135deg,#475569,#94a3b8)",
  color: "white",
};

const panel: React.CSSProperties = {
  background: "rgba(255,255,255,0.98)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 12px 28px rgba(15,23,42,0.05)",
};

const sectionsPanel: React.CSSProperties = {
  ...panel,
  marginBottom: 14,
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  color: "#0f172a",
  fontSize: 17,
  marginBottom: 13,
};

const panelIconBlue: React.CSSProperties = {
  background: "#eff6ff",
  color: "#2563eb",
  width: 36,
  height: 36,
  borderRadius: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
  gap: 12,
};

const sectionCard: React.CSSProperties = {
  width: "100%",
  minHeight: 96,
  background: "linear-gradient(135deg,#ffffff,#f8fafc)",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
};

const cardRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const iconBox: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  flex: "0 0 auto",
};

const cardTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#0f172a",
};

const cardDesc: React.CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 5,
};

const arrow: React.CSSProperties = {
  fontSize: 29,
};

const compactInfoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
  gap: 10,
  maxWidth: 780,
  margin: "0 auto 8px",
};

const compactPanel: React.CSSProperties = {
  background: "rgba(255,255,255,0.98)",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 13,
  boxShadow: "0 10px 22px rgba(15,23,42,0.04)",
};

const compactPanelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#0f172a",
  fontSize: 15,
  marginBottom: 9,
};

const compactPanelIconBlue: React.CSSProperties = {
  background: "#eff6ff",
  color: "#2563eb",
  width: 30,
  height: 30,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const compactPanelIconGreen: React.CSSProperties = {
  ...compactPanelIconBlue,
  background: "#f0fdf4",
  color: "#16a34a",
};

const compactNoticeBlue: React.CSSProperties = {
  width: "100%",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  borderRadius: 13,
  padding: 10,
  marginBottom: 7,
  lineHeight: 1.6,
  fontWeight: 800,
  textAlign: "right",
  cursor: "pointer",
};

const compactNoticeGreen: React.CSSProperties = {
  ...compactNoticeBlue,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#166534",
};

const compactNoticeRed: React.CSSProperties = {
  ...compactNoticeBlue,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
};

const compactActivityItem: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  borderRadius: 13,
  padding: 10,
  marginBottom: 7,
  lineHeight: 1.6,
  fontSize: 13,
};
