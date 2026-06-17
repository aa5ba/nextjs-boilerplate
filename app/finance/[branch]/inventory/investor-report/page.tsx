"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { getOrganizationSettings } from "@/lib/getOrganizationSettings";

type ScreenType = "mobile" | "tablet" | "desktop";

export default function InvestorReportPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const branch = params.branch as string;
  const investorFromUrl = searchParams.get("investor") || "";

  const [authChecked, setAuthChecked] = useState(false);
  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [branchId, setBranchId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("احتساب");

  const [investors, setInvestors] = useState<any[]>([]);
  const [investorId, setInvestorId] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [items, setItems] = useState<any[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      const width = window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 980) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    updateScreen();
    window.addEventListener("resize", updateScreen);

    return () => window.removeEventListener("resize", updateScreen);
  }, []);

  useEffect(() => {
    initializePage();
  }, [branch]);

  useEffect(() => {
    if (branchId && investorId) {
      loadReport();
    }
  }, [branchId, investorId]);

  async function initializePage() {
    const isLoggedIn = checkLogin();

    if (!isLoggedIn) return;

    loadEmployeeName();
    await loadInitial();
  }

  function checkLogin() {
    if (typeof window === "undefined") return false;

    const savedUser = localStorage.getItem("finance_user");
    const savedBranchUser = localStorage.getItem("finance_branch_user");
    const savedUserName = localStorage.getItem("finance_user_name");

    if (!savedUser && !savedBranchUser && !savedUserName) {
      router.replace(`/finance/${branch}/login`);
      return false;
    }

    setAuthChecked(true);
    return true;
  }

  function loadEmployeeName() {
    if (typeof window === "undefined") return;

    const newName = localStorage.getItem("finance_user_name");

    if (newName) {
      setEmployeeName(newName);
      return;
    }

    const oldUser =
      localStorage.getItem("finance_user") ||
      localStorage.getItem("finance_branch_user");

    if (oldUser) {
      try {
        const parsed = JSON.parse(oldUser);
        setEmployeeName(parsed?.full_name || parsed?.username || "الموظف");
      } catch {
        setEmployeeName("الموظف");
      }
    }
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_branch_user");
    }

    router.replace(`/finance/${branch}/login`);
  }

  async function loadInitial() {
    setInitialLoading(true);

    const currentBranchId = await getBranchId(branch);

    if (!currentBranchId) {
      alert("تعذر تحديد الفرع");
      setBranchId(null);
      setInvestors([]);
      setInitialLoading(false);
      return;
    }

    setBranchId(currentBranchId);

    const settings = await getOrganizationSettings();

    const { data: branchData, error: branchError } = await supabase
      .from("finance_branches")
      .select("organization_name")
      .eq("id", currentBranchId)
      .maybeSingle();

    if (branchError) {
      setOrganizationName(settings.name || "احتساب");
    } else {
      setOrganizationName(
        branchData?.organization_name || settings.name || "احتساب"
      );
    }

    const { data, error } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message || "تعذر تحميل المستثمرين");
      setInvestors([]);
      setInitialLoading(false);
      return;
    }

    setInvestors(data || []);

    if (investorFromUrl) {
      setInvestorId(investorFromUrl);
    }

    setInitialLoading(false);
  }

  async function loadReport() {
    if (!branchId || !investorId) {
      alert("اختر المستثمر أولاً");
      return;
    }

    setLoading(true);

    let query = supabase
      .from("finance_inventory_movements")
      .select(
        `
        *,
        finance_products(product_name),
        finance_investors(investor_name, national_id, phone),
        finance_contracts(contract_number),
        finance_customers(full_name, national_id)
      `
      )
      .eq("branch_id", branchId)
      .eq("investor_id", investorId)
      .order("created_at", { ascending: false });

    if (fromDate) query = query.gte("created_at", fromDate);
    if (toDate) query = query.lte("created_at", `${toDate}T23:59:59`);

    const { data, error } = await query;

    if (error) {
      alert(error.message || "تعذر تحميل كشف المستثمر");
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(data || []);
    setLoading(false);
  }

  const selectedInvestor = investors.find((x) => x.id === investorId);

  const totalOut = items
    .filter((x) => x.movement_type === "خصم")
    .reduce((sum, x) => sum + Number(x.quantity || 0), 0);

  const totalAdd = items
    .filter((x) => x.movement_type === "إضافة")
    .reduce((sum, x) => sum + Number(x.quantity || 0), 0);

  const totalReturn = items
    .filter((x) => x.movement_type === "إرجاع")
    .reduce((sum, x) => sum + Number(x.quantity || 0), 0);

  if (!authChecked) {
    return null;
  }

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <style>{`
        .print-only {
          display: none;
        }

        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-only { display: flex !important; }

          main {
            background: white !important;
            padding: 0 !important;
          }

          .print-area {
            width: 190mm !important;
            min-height: 277mm !important;
            margin: 0 auto !important;
            padding: 8mm !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
          }

          @page {
            size: A4;
            margin: 8mm;
          }
        }
      `}</style>

      <div style={getContainerStyle(isCompact)}>
        <header style={getHeroStyle(isMobile)} className="no-print">
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={getHeroContentStyle(screen)}>
            <div style={getHeroUserCardStyle(screen)}>
              <div style={getEmployeeTopRowStyle(screen)}>
                <div style={employeeIcon}>
                  <UserIcon />
                </div>

                <div style={getEmployeeNameStyle(isMobile)}>
                  {employeeName}
                </div>

                {!isMobile && <div style={employeeDividerSmall} />}

                <button style={logoutInlineButton} onClick={logout}>
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                style={getMainWorkstationButtonStyle(isMobile)}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>كشف حساب المستثمر</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        <section style={controlsCard} className="no-print">
          <div style={formGrid}>
            <div>
              <label style={label}>المستثمر</label>
              <select
                style={input}
                value={investorId}
                onChange={(e) => {
                  setInvestorId(e.target.value);
                  setItems([]);
                }}
                disabled={initialLoading}
              >
                <option value="">
                  {initialLoading ? "جاري تحميل المستثمرين..." : "اختر المستثمر"}
                </option>
                {investors.map((investor) => (
                  <option key={investor.id} value={investor.id}>
                    {investor.investor_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={label}>من تاريخ</label>
              <input
                type="date"
                style={input}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div>
              <label style={label}>إلى تاريخ</label>
              <input
                type="date"
                style={input}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div style={buttonsRow}>
            <button style={primaryButton} onClick={loadReport} disabled={loading}>
              {loading ? "جاري العرض..." : "عرض الكشف"}
            </button>

            <button style={printButton} onClick={() => window.print()}>
              طباعة A4
            </button>
          </div>
        </section>

        <section style={printArea} className="print-area">
          <div style={reportHeader}>
            <div>
              <h2 style={{ margin: 0 }}>{organizationName}</h2>
              <div style={smallText}>كشف حساب مستثمر</div>
            </div>

            <div style={reportMeta}>
              <div>تاريخ الطباعة: {formatGregorianDate(new Date())}</div>
              <div>
                الفترة: {fromDate || "البداية"} إلى {toDate || "اليوم"}
              </div>
            </div>
          </div>

          <div style={investorBox}>
            <div>
              <strong>المستثمر:</strong>{" "}
              {selectedInvestor?.investor_name || "لم يتم اختيار مستثمر"}
            </div>

            <div>
              <strong>الهوية:</strong> {selectedInvestor?.national_id || "-"}
            </div>

            <div>
              <strong>الجوال:</strong> {selectedInvestor?.phone || "-"}
            </div>
          </div>

          <div style={summaryGrid}>
            <Summary title="عدد الحركات" value={items.length} />
            <Summary title="إجمالي الإضافة" value={totalAdd} />
            <Summary title="إجمالي الخصم" value={totalOut} />
            <Summary title="إجمالي الإرجاع" value={totalReturn} />
          </div>

          <div style={tableHeader}>
            <span>التاريخ</span>
            <span>العقد</span>
            <span>العميل</span>
            <span>المنتج</span>
            <span>الحركة</span>
            <span>الكمية</span>
            <span>قبل</span>
            <span>بعد</span>
          </div>

          {loading ? (
            <div style={emptyBox}>جاري تحميل البيانات...</div>
          ) : items.length === 0 ? (
            <div style={emptyBox}>لا توجد بيانات لهذا المستثمر</div>
          ) : (
            items.map((item) => (
              <div key={item.id} style={tableRow}>
                <span>{formatGregorianDate(item.created_at)}</span>
                <span>{item.finance_contracts?.contract_number || "-"}</span>
                <span>{item.finance_customers?.full_name || "-"}</span>
                <span>{item.finance_products?.product_name || "-"}</span>
                <span>{item.movement_type || "-"}</span>
                <strong>{item.quantity || 0}</strong>
                <span>{item.before_quantity || 0}</span>
                <span>{item.after_quantity || 0}</span>
              </div>
            ))
          )}

          <div style={footer}>
            <div>تم إنشاء هذا الكشف من النظام آلياً عبر {organizationName}</div>
          </div>

          <div style={signatureRow} className="print-only">
            <div>التوقيع: .........................</div>
          </div>
        </section>

        <div style={backWrapper} className="no-print">
          <button
            style={backButton}
            onClick={() =>
              investorId
                ? router.push(`/finance/${branch}/inventory/investors/${investorId}`)
                : router.push(`/finance/${branch}/inventory`)
            }
          >
            الرجوع
          </button>
        </div>
      </div>
    </main>
  );
}

function Summary({ title, value }: any) {
  return (
    <div style={summaryBox}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatGregorianDate(date: any) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.8 20.2c.8-3.5 3.6-5.4 7.2-5.4s6.4 1.9 7.2 5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 7V5.8c0-1 .8-1.8 1.8-1.8h6.1c1 0 1.8.8 1.8 1.8v12.4c0 1-.8 1.8-1.8 1.8h-6.1c-1 0-1.8-.8-1.8-1.8V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.8 12h9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.8 8.8 4.6 12l3.2 3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.8 11.2 12 4.5l8.2 6.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 10.4v9.1h11.6v-9.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 19.5v-5.2h4v5.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getPageStyle(isMobile: boolean): CSSProperties {
  return {
    minHeight: "100vh",
    backgroundColor: "#f6f9ff",
    backgroundImage: `
      radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
      radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%),
      radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%),
      linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
      url('/backgrounds/v13-finance-bg-1.png')
    `,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: isMobile ? "scroll" : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

function getContainerStyle(isCompact: boolean): CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact ? 980 : 1200,
    margin: "auto",
  };
}

function getHeroStyle(isMobile: boolean): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile ? "auto" : 160,
    borderRadius: isMobile ? 20 : 24,
    padding: isMobile ? "18px 14px" : "22px 26px",
    marginBottom: 14,
    overflow: "hidden",
    border: "none",
    outline: "none",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    boxShadow: "none",
    isolation: "isolate",
  };
}

function getHeroContentStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "center",
      gap: 16,
      direction: "rtl",
    };
  }

  if (screen === "tablet") {
    return {
      position: "relative",
      zIndex: 3,
      minHeight: "auto",
      display: "grid",
      gridTemplateColumns: "1fr",
      alignItems: "center",
      justifyItems: "center",
      gap: 18,
      direction: "rtl",
    };
  }

  return {
    position: "relative",
    zIndex: 3,
    minHeight: 116,
    display: "grid",
    gridTemplateColumns: "minmax(250px, 315px) 1fr minmax(220px, 315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      width: "100%",
      display: "grid",
      gap: 12,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  if (screen === "tablet") {
    return {
      width: "100%",
      maxWidth: 520,
      display: "grid",
      gap: 14,
      direction: "rtl",
      justifySelf: "center",
      justifyItems: "center",
      order: 2,
    };
  }

  return {
    width: "100%",
    maxWidth: 315,
    display: "grid",
    gap: 24,
    direction: "ltr",
    justifySelf: "start",
  };
}

function getEmployeeTopRowStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      minHeight: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 10,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  if (screen === "tablet") {
    return {
      height: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      direction: "rtl",
      color: "#ffffff",
      width: "100%",
    };
  }

  return {
    height: 42,
    display: "flex",
    alignItems: "center",
    gap: 14,
    direction: "ltr",
    color: "#ffffff",
  };
}

function getEmployeeNameStyle(isMobile: boolean): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow: "0 4px 10px rgba(15,23,42,0.18)",
  };
}

function getMainWorkstationButtonStyle(isMobile: boolean): CSSProperties {
  return {
    width: isMobile ? "100%" : 220,
    maxWidth: isMobile ? 280 : 220,
    height: 44,
    border: "none",
    background: "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily: "var(--font-almarai), sans-serif",
    boxShadow: "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(screen: ScreenType): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order: screen === "desktop" ? 0 : 1,
  };
}

function getTitleStyle(screen: ScreenType): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize: screen === "mobile" ? 26 : screen === "tablet" ? 28 : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile" || screen === "tablet") {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: 12,
    direction: "rtl",
  };
}

const employeeIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1.5px solid rgba(255,255,255,0.34)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
  flex: "0 0 auto",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.90)",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
  padding: 0,
  whiteSpace: "nowrap",
  direction: "rtl",
};

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 210,
  height: 210,
  right: -78,
  top: -85,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.075)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleTwo: CSSProperties = {
  position: "absolute",
  width: 245,
  height: 245,
  right: 145,
  bottom: -178,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.045)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleThree: CSSProperties = {
  position: "absolute",
  width: 150,
  height: 150,
  left: 380,
  top: -96,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.035)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroDots: CSSProperties = {
  position: "absolute",
  top: 28,
  right: 34,
  width: 84,
  height: 58,
  opacity: 0.24,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const controlsCard: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 18,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
  gap: 14,
};

const label: CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#0d47a1",
  fontWeight: "bold",
};

const input: CSSProperties = {
  width: "100%",
  height: 50,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box",
  background: "white",
  fontFamily: "var(--font-almarai), sans-serif",
};

const buttonsRow: CSSProperties = {
  display: "flex",
  gap: 12,
  marginTop: 16,
  flexWrap: "wrap",
};

const primaryButton: CSSProperties = {
  padding: "14px 24px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const printButton: CSSProperties = {
  padding: "14px 24px",
  background: "#166534",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const printArea: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 24,
  overflowX: "auto",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const reportHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  borderBottom: "2px solid #0d47a1",
  paddingBottom: 14,
  marginBottom: 16,
};

const reportMeta: CSSProperties = {
  textAlign: "left",
  fontSize: 13,
  lineHeight: 1.8,
};

const smallText: CSSProperties = {
  color: "#64748b",
  marginTop: 6,
};

const investorBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: 14,
  marginBottom: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 10,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
  gap: 12,
  marginBottom: 16,
};

const summaryBox: CSSProperties = {
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  background: "#f8fbff",
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 1.7fr 1.6fr 1fr .8fr .8fr .8fr",
  gap: 8,
  background: "#0d47a1",
  color: "white",
  padding: 10,
  fontSize: 12,
  fontWeight: "bold",
  minWidth: 900,
};

const tableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 1.7fr 1.6fr 1fr .8fr .8fr .8fr",
  gap: 8,
  padding: 10,
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  minWidth: 900,
};

const emptyBox: CSSProperties = {
  padding: 22,
  textAlign: "center",
  color: "#6b7280",
  border: "1px dashed #cbd5e1",
  marginTop: 10,
  borderRadius: 12,
};

const footer: CSSProperties = {
  marginTop: 24,
  paddingTop: 12,
  borderTop: "1px solid #cbd5e1",
  fontSize: 12,
};

const signatureRow: CSSProperties = {
  justifyContent: "flex-end",
  marginTop: 24,
  fontSize: 12,
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "11px 18px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily: "var(--font-almarai), sans-serif",
};
