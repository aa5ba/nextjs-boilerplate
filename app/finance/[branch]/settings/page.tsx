"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ScreenType = "mobile" | "tablet" | "desktop";

export default function FinanceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const branch = params.branch as string;

  const [screen, setScreen] = useState<ScreenType>("desktop");

  const [employeeName, setEmployeeName] = useState("الموظف");

  const [organizationName, setOrganizationName] = useState("");
  const [organizationPhone, setOrganizationPhone] = useState("");
  const [organizationCity, setOrganizationCity] = useState("");
  const [commercialRecord, setCommercialRecord] = useState("");

  const [organizationLogoUrl, setOrganizationLogoUrl] = useState("");
  const [organizationStampUrl, setOrganizationStampUrl] = useState("");
  const [printFooterText, setPrintFooterText] = useState("");
  const [printMargin, setPrintMargin] = useState("8mm");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    loadEmployeeName();

    if (branch) {
      loadSettings();
    }
  }, [branch]);

  function loadEmployeeName() {
    if (typeof window === "undefined") return;

    const newName = localStorage.getItem("finance_user_name");

    if (newName) {
      setEmployeeName(newName);
      return;
    }

    const oldUser = localStorage.getItem("finance_user");

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

    router.push(`/finance/${branch}/login`);
  }

  function normalizeDigits(value: string) {
    return value
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
      .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString());
  }

  async function loadSettings() {
    setLoading(true);

    const { data: branchData, error: branchError } = await supabase
      .from("finance_branches")
      .select("organization_name, commercial_record, phone, city")
      .eq("branch_slug", branch)
      .single();

    if (branchError) {
      alert(branchError.message);
      setLoading(false);
      return;
    }

    setOrganizationName(branchData?.organization_name || "");
    setCommercialRecord(branchData?.commercial_record || "");
    setOrganizationPhone(branchData?.phone || "");
    setOrganizationCity(branchData?.city || "");

    const { data: settingsData } = await supabase
      .from("finance_settings")
      .select("*");

    const getValue = (key: string) =>
      settingsData?.find((x) => x.setting_key === key)?.setting_value || "";

    setOrganizationLogoUrl(getValue("organization_logo_url"));
    setOrganizationStampUrl(getValue("organization_stamp_url"));
    setPrintFooterText(getValue("print_footer_text"));
    setPrintMargin(getValue("print_margin") || "8mm");

    setLoading(false);
  }

  async function saveSetting(key: string, value: string) {
    const { error } = await supabase.from("finance_settings").upsert(
      {
        setting_key: key,
        setting_value: value.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" }
    );

    if (error) throw error;
  }

  async function saveSettings() {
    const cleanPhone = normalizeDigits(organizationPhone);
    const cleanCommercialRecord = normalizeDigits(commercialRecord);

    if (!organizationName.trim()) {
      alert("يرجى إدخال اسم المنظمة");
      return;
    }

    if (!cleanCommercialRecord.trim()) {
      alert("يرجى إدخال رقم السجل التجاري");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("finance_branches")
        .update({
          organization_name: organizationName.trim(),
          commercial_record: cleanCommercialRecord.trim(),
          phone: cleanPhone.trim(),
          city: organizationCity.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("branch_slug", branch);

      if (error) throw error;

      await saveSetting("organization_logo_url", organizationLogoUrl);
      await saveSetting("organization_stamp_url", organizationStampUrl);
      await saveSetting("print_footer_text", printFooterText);
      await saveSetting("print_margin", printMargin);

      alert("تم حفظ الإعدادات بنجاح");
      await loadSettings();
    } catch (error: any) {
      alert(error?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={loadingBox}>جاري تحميل الإعدادات...</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <section style={getHeroStyle(isMobile)}>
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
              <h1 style={getTitleStyle(screen)}>الإعدادات</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>بيانات المنظمة</h2>

          <Field label="اسم المنظمة">
            <input
              style={input}
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </Field>

          <Field label="رقم السجل التجاري">
            <input
              style={input}
              type="text"
              inputMode="numeric"
              value={commercialRecord}
              onChange={(e) =>
                setCommercialRecord(normalizeDigits(e.target.value))
              }
            />
          </Field>

          <Field label="رقم الجوال - اختياري">
            <input
              style={input}
              type="text"
              inputMode="numeric"
              value={organizationPhone}
              onChange={(e) =>
                setOrganizationPhone(normalizeDigits(e.target.value))
              }
            />
          </Field>

          <Field label="المدينة - اختياري">
            <input
              style={input}
              type="text"
              value={organizationCity}
              onChange={(e) => setOrganizationCity(e.target.value)}
            />
          </Field>
        </section>

        <section style={card}>
          <h2 style={sectionTitle}>إعدادات الطباعة</h2>

          <Field label="رابط الشعار - اختياري">
            <input
              style={input}
              type="text"
              value={organizationLogoUrl}
              onChange={(e) => setOrganizationLogoUrl(e.target.value)}
            />
          </Field>

          <Field label="رابط الختم - اختياري">
            <input
              style={input}
              type="text"
              value={organizationStampUrl}
              onChange={(e) => setOrganizationStampUrl(e.target.value)}
            />
          </Field>

          <Field label="نص التذييل في الطباعة - اختياري">
            <textarea
              style={textarea}
              value={printFooterText}
              onChange={(e) => setPrintFooterText(e.target.value)}
            />
          </Field>

          <Field label="هامش الطباعة">
            <select
              style={input}
              value={printMargin}
              onChange={(e) => setPrintMargin(e.target.value)}
            >
              <option value="6mm">6mm</option>
              <option value="8mm">8mm - المعتمد</option>
              <option value="10mm">10mm</option>
              <option value="12mm">12mm</option>
            </select>
          </Field>

          <button style={saveButton} onClick={saveSettings} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </button>
        </section>

        <div style={backWrapper}>
          <button style={backButton} onClick={() => router.back()}>
            ← رجوع
          </button>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: any) {
  return (
    <div style={fieldBox}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
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

function getPageStyle(isMobile: boolean): React.CSSProperties {
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

function getContainerStyle(isCompact: boolean): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact ? 980 : 1180,
    margin: "auto",
  };
}

function getHeroStyle(isMobile: boolean): React.CSSProperties {
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

function getHeroContentStyle(screen: ScreenType): React.CSSProperties {
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

function getHeroUserCardStyle(screen: ScreenType): React.CSSProperties {
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

function getEmployeeTopRowStyle(screen: ScreenType): React.CSSProperties {
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

function getEmployeeNameStyle(isMobile: boolean): React.CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
    textShadow: "0 4px 10px rgba(15,23,42,0.18)",
  };
}

function getMainWorkstationButtonStyle(isMobile: boolean): React.CSSProperties {
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

function getHeroTitleBoxStyle(screen: ScreenType): React.CSSProperties {
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

function getTitleStyle(screen: ScreenType): React.CSSProperties {
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

function getHeroActionBoxStyle(screen: ScreenType): React.CSSProperties {
  if (screen === "mobile") {
    return {
      display: "none",
      width: "100%",
      order: 3,
    };
  }

  if (screen === "tablet") {
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

const employeeIcon: React.CSSProperties = {
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

const employeeDividerSmall: React.CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
  flex: "0 0 auto",
};

const logoutInlineButton: React.CSSProperties = {
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

const heroCircleOne: React.CSSProperties = {
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

const heroCircleTwo: React.CSSProperties = {
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

const heroCircleThree: React.CSSProperties = {
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

const heroDots: React.CSSProperties = {
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

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  boxShadow: "0 8px 22px rgba(15,23,42,0.04)",
};

const sectionTitle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 18,
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 900,
};

const fieldBox: React.CSSProperties = {
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontWeight: "bold",
  fontSize: 14,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #dbe3ef",
  fontSize: 16,
  boxSizing: "border-box",
  background: "#f8fafc",
  fontFamily: "var(--font-almarai), sans-serif",
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 90,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #dbe3ef",
  fontSize: 16,
  boxSizing: "border-box",
  background: "#f8fafc",
  fontFamily: "var(--font-almarai), sans-serif",
};

const saveButton: React.CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 8,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const backWrapper: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: React.CSSProperties = {
  padding: "11px 18px",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,.20)",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,.20)",
  fontFamily: "var(--font-almarai), sans-serif",
};

const loadingBox: React.CSSProperties = {
  textAlign: "center",
  paddingTop: 80,
  fontSize: 18,
  color: "#0f172a",
  fontWeight: 800,
};
