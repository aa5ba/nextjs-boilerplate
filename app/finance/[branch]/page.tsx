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

  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    loadCurrentUserPermissions();
    if (branch) loadBranch();
  }, [branch]);

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
