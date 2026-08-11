"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber } from "@/lib/numberUtils";

type ScreenType = "mobile" | "tablet" | "desktop";

type UserAccess = {
  roles: string[];
  permissions: string[];
};

export default function NewInvestorPage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;

  const savingRef = useRef(false);

  const [authChecked, setAuthChecked] = useState(false);
  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [branchId, setBranchId] = useState<string | null>(null);

  const [investorName, setInvestorName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissionLoaded, setPermissionLoaded] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

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
    let cancelled = false;

    async function run() {
      await initializePage(() => cancelled);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [branch]);

  async function initializePage(isCancelled: () => boolean) {
    setPermissionLoaded(false);
    setAccessDenied(false);
    setBranchId(null);

    const isLoggedIn = checkLogin();

    if (!isLoggedIn || isCancelled()) return;

    loadEmployeeName();

    const userAccess = loadCurrentUserPermissions();

    if (isCancelled()) return;

    const canAddInvestor = hasPermissionFromAccess(
      userAccess.roles,
      userAccess.permissions,
      "add_investor"
    );

    if (!canAddInvestor) {
      setAccessDenied(true);
      setPermissionLoaded(true);
      return;
    }

    const currentBranchId = await getBranchId(branch);

    if (isCancelled()) return;

    if (!currentBranchId) {
      setAccessDenied(false);
      setPermissionLoaded(true);
      alert("تعذر تحديد الفرع");
      return;
    }

    setBranchId(currentBranchId);
    setAccessDenied(false);
    setPermissionLoaded(true);
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

    const directName = localStorage.getItem("finance_user_name");

    if (directName) {
      setEmployeeName(directName);
      return;
    }

    const savedUser =
      localStorage.getItem("finance_user") ||
      localStorage.getItem("finance_branch_user");

    if (!savedUser) {
      setEmployeeName("الموظف");
      return;
    }

    try {
      const parsed = JSON.parse(savedUser);

      setEmployeeName(
        parsed?.full_name ||
          parsed?.username ||
          parsed?.name ||
          "الموظف"
      );
    } catch {
      setEmployeeName("الموظف");
    }
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_branch_user");
      localStorage.removeItem("finance_role");
    }

    router.replace(`/finance/${branch}/login`);
  }

  function loadCurrentUserPermissions(): UserAccess {
    if (typeof window === "undefined") {
      setRoles([]);
      setPermissions([]);

      return {
        roles: [],
        permissions: [],
      };
    }

    const savedUser =
      localStorage.getItem("finance_user") ||
      localStorage.getItem("finance_branch_user");

    const legacyRole = localStorage.getItem("finance_role");

    if (!savedUser) {
      const currentRoles = legacyRole ? [legacyRole] : [];

      setRoles(currentRoles);
      setPermissions([]);

      return {
        roles: currentRoles,
        permissions: [],
      };
    }

    try {
      const user = JSON.parse(savedUser);

      const currentRoles = Array.isArray(user?.roles)
        ? user.roles
        : [user?.role].filter(Boolean);

      const currentPermissions = Array.isArray(user?.permissions)
        ? user.permissions
        : [];

      if (legacyRole && !currentRoles.includes(legacyRole)) {
        currentRoles.push(legacyRole);
      }

      setRoles(currentRoles);
      setPermissions(currentPermissions);

      return {
        roles: currentRoles,
        permissions: currentPermissions,
      };
    } catch {
      const currentRoles = legacyRole ? [legacyRole] : [];

      setRoles(currentRoles);
      setPermissions([]);

      return {
        roles: currentRoles,
        permissions: [],
      };
    }
  }

  function hasPermissionFromAccess(
    currentRoles: string[],
    currentPermissions: string[],
    permissionKey: string
  ) {
    return (
      currentRoles.includes("main_admin") ||
      currentRoles.includes("branch_manager") ||
      currentRoles.includes("مدير رئيسي") ||
      currentRoles.includes("مدير فرع") ||
      currentRoles.includes("مدير") ||
      currentPermissions.includes(permissionKey)
    );
  }

  function hasPermission(permissionKey: string) {
    return hasPermissionFromAccess(roles, permissions, permissionKey);
  }

  function resetForm() {
    setInvestorName("");
    setNationalId("");
    setPhone("");
    setNotes("");
  }

  async function saveInvestor() {
    if (savingRef.current || saving) return;

    if (!checkLogin()) return;

    if (!hasPermission("add_investor")) {
      alert("لا تملك صلاحية إضافة المستثمرين");
      return;
    }

    const cleanInvestorName = investorName.trim();
    const cleanNationalId = normalizeNumber(nationalId);
    const cleanPhone = normalizeNumber(phone);
    const cleanNotes = notes.trim();

    if (!cleanInvestorName) {
      alert("أدخل اسم المستثمر");
      return;
    }

    if (cleanNationalId && cleanNationalId.length !== 10) {
      alert("رقم هوية المستثمر يجب أن يكون 10 أرقام");
      return;
    }

    if (cleanPhone && cleanPhone.length !== 10) {
      alert("رقم الجوال يجب أن يكون 10 أرقام");
      return;
    }

    const currentBranchId = branchId || (await getBranchId(branch));

    if (!currentBranchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const response = await fetch(
        "/finance/api/investors",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            branch,
            investorName:
              cleanInvestorName,
            nationalId:
              cleanNationalId,
            phone: cleanPhone,
            notes: cleanNotes,
          }),
        }
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok || !payload?.ok) {
        alert(
          payload?.message ||
            "تعذر حفظ المستثمر"
        );
        return;
      }

      resetForm();

      alert("تم حفظ المستثمر بنجاح");
      router.push(`/finance/${branch}/inventory/investors`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!authChecked) {
    return null;
  }

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <header style={getHeroStyle(isMobile)}>
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

                <button
                  type="button"
                  style={logoutInlineButton}
                  onClick={logout}
                >
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                type="button"
                style={getMainWorkstationButtonStyle(isMobile)}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>إضافة مستثمر</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        {!permissionLoaded ? (
          <div style={loadingBox}>جاري التحقق من الصلاحيات...</div>
        ) : accessDenied ? (
          <section style={deniedCard}>
            <h2 style={{ marginTop: 0 }}>لا تملك صلاحية الوصول</h2>
            <p style={{ marginBottom: 0 }}>
              ليس لديك صلاحية إضافة المستثمرين.
            </p>

            <div style={backWrapper}>
              <button
                type="button"
                style={backButton}
                onClick={() => router.back()}
              >
                الرجوع
              </button>
            </div>
          </section>
        ) : !branchId ? (
          <div style={loadingBox}>تعذر تجهيز بيانات الفرع</div>
        ) : (
          <>
            <section style={card}>
              <input
                style={input}
                placeholder="اسم المستثمر"
                value={investorName}
                onChange={(event) =>
                  setInvestorName(event.target.value)
                }
                disabled={saving}
              />

              <input
                style={input}
                inputMode="numeric"
                maxLength={10}
                placeholder="رقم هوية المستثمر"
                value={nationalId}
                onChange={(event) =>
                  setNationalId(
                    normalizeNumber(event.target.value).slice(0, 10)
                  )
                }
                disabled={saving}
              />

              <input
                style={input}
                inputMode="numeric"
                maxLength={10}
                placeholder="رقم الجوال"
                value={phone}
                onChange={(event) =>
                  setPhone(
                    normalizeNumber(event.target.value).slice(0, 10)
                  )
                }
                disabled={saving}
              />

              <textarea
                style={textarea}
                placeholder="ملاحظات"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={saving}
              />

              <button
                type="button"
                style={{
                  ...primaryButton,
                  opacity: saving ? 0.65 : 1,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
                onClick={saveInvestor}
                disabled={saving}
              >
                {saving ? "جاري الحفظ..." : "حفظ المستثمر"}
              </button>
            </section>

            <div style={backWrapper}>
              <button
                type="button"
                style={{
                  ...backButton,
                  opacity: saving ? 0.65 : 1,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
                onClick={() => router.back()}
                disabled={saving}
              >
                الرجوع
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function UserIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    maxWidth: isCompact ? 980 : 1180,
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
    gridTemplateColumns:
      "minmax(250px, 315px) 1fr minmax(220px, 315px)",
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

function getMainWorkstationButtonStyle(
  isMobile: boolean
): CSSProperties {
  return {
    width: isMobile ? "100%" : 220,
    maxWidth: isMobile ? 280 : 220,
    height: 44,
    border: "none",
    background:
      "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
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

function getHeroTitleBoxStyle(
  screen: ScreenType
): CSSProperties {
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
    fontSize:
      screen === "mobile"
        ? 26
        : screen === "tablet"
        ? 28
        : 30,
    lineHeight: 1.35,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
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

const card: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const deniedCard: CSSProperties = {
  background: "white",
  border: "1px solid #fecaca",
  borderRadius: 18,
  padding: 24,
  color: "#991b1b",
  textAlign: "center",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const input: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
  boxSizing: "border-box",
  background: "white",
  fontFamily: "var(--font-almarai), sans-serif",
};

const textarea: CSSProperties = {
  width: "100%",
  minHeight: 100,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  marginBottom: 12,
  boxSizing: "border-box",
  background: "white",
  resize: "vertical",
  fontFamily: "var(--font-almarai), sans-serif",
};

const primaryButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "11px 18px",
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily: "var(--font-almarai), sans-serif",
};

const loadingBox: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  textAlign: "center",
  color: "#0d47a1",
  fontWeight: "bold",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};
