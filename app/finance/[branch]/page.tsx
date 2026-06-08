"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import FinanceTrialSidebar from "./FinanceTrialSidebar";

const sections = [
  { title: "سير العمل", path: "workflow", icon: "💼", permission: "workflow" },
  { title: "العملاء", path: "customers", icon: "👥", permission: "customers" },
  { title: "طلب جديد", path: "new-request", icon: "➕🧩", permission: "contracts" },
  { title: "سداد", path: "payments", icon: "💳", permission: "payments" },
  { title: "المخزون والمنتجات", path: "inventory", icon: "📦", permission: "inventory" },
  { title: "العقود", path: "contracts", icon: "📄", permission: "contracts" },
  { title: "الملاحظات والتذكيرات", path: "notes", icon: "✏️", permission: "workflow" },
  { title: "إدارة الصلاحيات", path: "permissions", icon: "🔐", permission: "settings" },
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

    if (branch) {
      loadBranch();
    }
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
        <div style={container}>
          <div style={header}>
            <h1 style={headerTitle}>جاري تحميل الفرع...</h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={backgroundLayer} />

      <div style={layout}>
        <FinanceTrialSidebar />

        <div style={container}>
          <div style={header}>
            <div style={organizationBadge}>🏢 {organizationName}</div>
            <h1 style={headerTitle}>محطة العمل الرئيسية</h1>
          </div>

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

          <section style={smartSearchBox}>
            <div style={searchInputWrap}>
              <span style={searchIcon}>🔎</span>
              <input
                style={searchInput}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="البحث السريع : اسم العميل او الهويه او رقم الجوال ..."
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
        </div>
      </div>
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

const page = {
  minHeight: "100vh",
  background: "transparent",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const backgroundLayer = {
  position: "fixed" as const,
  inset: 0,
  zIndex: 0,
  backgroundImage:
    "url('/backgrounds/E9E9FD94-8BE8-4410-9168-2F1985604328.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  pointerEvents: "none" as const,
};

const layout = {
  position: "relative" as const,
  zIndex: 1,
  width: "100%",
  maxWidth: 1420,
  margin: "auto",
  display: "flex",
  gap: 20,
  alignItems: "flex-start",
};

const container = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const header = {
  background:
    "linear-gradient(135deg,rgba(13,71,161,.96),rgba(25,118,210,.94))",
  color: "white",
  padding: "30px 20px",
  borderRadius: 22,
  marginBottom: 22,
  boxShadow: "0 18px 45px rgba(13,71,161,.16)",
};

const organizationBadge = {
  width: "fit-content",
  margin: "0 auto 14px auto",
  background: "rgba(255,255,255,0.15)",
  border: "1px solid rgba(255,255,255,0.25)",
  padding: "10px 18px",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  backdropFilter: "blur(6px)",
};

const headerTitle = {
  margin: 0,
  textAlign: "center" as const,
  fontSize: 34,
  fontWeight: 700,
  letterSpacing: "0px",
  lineHeight: 1.4,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 18,
};

const card = {
  width: "100%",
  minHeight: 110,
  background: "rgba(255,255,255,0.9)",
  color: "#0f172a",
  border: "1px solid rgba(217,227,245,.9)",
  borderRadius: 18,
  padding: 18,
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 14px 35px rgba(15,23,42,.06)",
  backdropFilter: "blur(4px)",
};

const cardRight = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const iconBox = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "#eef5ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const cardTitle = {
  color: "#0d47a1",
  fontWeight: "bold",
};

const arrow = {
  color: "#0d6efd",
  fontSize: 28,
};

const smartSearchBox = {
  marginTop: 18,
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(217,227,245,.95)",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 14px 35px rgba(15,23,42,.07)",
  backdropFilter: "blur(6px)",
};

const searchInputWrap = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 16,
  padding: "0 14px",
  minHeight: 58,
};

const searchIcon = {
  fontSize: 22,
  color: "#64748b",
};

const searchInput = {
  width: "100%",
  border: "none",
  outline: "none",
  fontSize: 17,
  color: "#0f172a",
  background: "transparent",
  fontFamily: "var(--font-almarai), sans-serif",
};

const clearSearchButton = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "none",
  background: "#eef2f7",
  color: "#64748b",
  fontSize: 22,
  cursor: "pointer",
};

const resultsBox = {
  marginTop: 12,
  display: "grid",
  gap: 10,
};

const resultItem = {
  width: "100%",
  border: "1px solid #e2e8f0",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gridTemplateColumns: "44px 1fr auto",
  gap: 12,
  alignItems: "center",
  cursor: "pointer",
  textAlign: "right" as const,
};

const resultIcon = {
  width: 44,
  height: 44,
  borderRadius: 14,
  background: "#eef5ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
};

const resultContent = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 5,
  color: "#0f172a",
};

const resultType = {
  background: "#e0f2fe",
  color: "#075985",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
  fontSize: 13,
};

const emptyResult = {
  padding: 14,
  textAlign: "center" as const,
  color: "#64748b",
  background: "#f8fbff",
  borderRadius: 14,
};
