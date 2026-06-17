"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

type ScreenType = "mobile" | "tablet" | "desktop";

export default function PrintPromissoryNotePage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;
  const noteId = params.id as string;

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [note, setNote] = useState<any>(null);

  const [organizationSettings, setOrganizationSettings] = useState({
    name: "احتساب",
    phone: "",
    city: "",
    commercialRecord: "",
  });

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
    loadNote();

    const style = document.createElement("style");

    style.innerHTML = `
      @media print {
        .no-print {
          display: none !important;
        }

        button {
          display: none !important;
        }

        body {
          background: white !important;
        }

        main {
          padding: 0 !important;
          background: white !important;
        }
      }

      @page {
        size: A4;
        margin: 8mm;
      }
    `;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, [branch, noteId]);

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

  async function loadNote() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setNote(null);
      return;
    }

    const { data: branchData, error: branchError } = await supabase
      .from("finance_branches")
      .select("organization_name, phone, city, commercial_record, branch_name")
      .eq("id", branchId)
      .single();

    if (branchError) {
      alert(branchError.message);
      setNote(null);
      return;
    }

    const { data, error } = await supabase
      .from("finance_promissory_notes")
      .select(`
        *,
        finance_contracts(
          print_party_name,
          print_party_identifier,
          print_party_type,
          first_party_name,
          first_party_identifier,
          first_party_type,
          investor_name
        )
      `)
      .eq("id", noteId)
      .eq("branch_id", branchId)
      .single();

    if (error) {
      alert(error.message);
      setNote(null);
      return;
    }

    setOrganizationSettings({
      name: branchData?.organization_name || "احتساب",
      phone: branchData?.phone || "",
      city: branchData?.city || branchData?.branch_name || "",
      commercialRecord: branchData?.commercial_record || "",
    });

    setNote(data);
  }

  const firstPartyType =
    note?.finance_contracts?.print_party_type ||
    note?.finance_contracts?.first_party_type ||
    "organization";

  const isInvestorParty = firstPartyType === "investor";

  const firstPartyName = isInvestorParty
    ? note?.finance_contracts?.print_party_name ||
      note?.finance_contracts?.first_party_name ||
      note?.finance_contracts?.investor_name ||
      "................"
    : note?.finance_contracts?.print_party_name ||
      note?.finance_contracts?.first_party_name ||
      organizationSettings.name ||
      "................";

  const firstPartyIdentifier = isInvestorParty
    ? note?.finance_contracts?.print_party_identifier ||
      note?.finance_contracts?.first_party_identifier ||
      ""
    : note?.finance_contracts?.print_party_identifier ||
      note?.finance_contracts?.first_party_identifier ||
      organizationSettings.commercialRecord ||
      "";

  const firstPartyIdentifierLabel = isInvestorParty
    ? "رقم الهوية"
    : "السجل التجاري";

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <header className="no-print" style={getHeroStyle(isMobile)}>
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
              <h1 style={getTitleStyle(screen)}>طباعة السند</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        <section style={printArea}>
          <div style={topLine}>
            <span>المملكة العربية السعودية</span>
            <span>{organizationSettings.city || "بيع * شراء"}</span>
          </div>

          <div style={logoBox}>
            <div style={organizationLogoText}>
              {organizationSettings.name}
            </div>
          </div>

          <div style={organizationInfo}>
            {organizationSettings.phone && (
              <span>جوال: {organizationSettings.phone}</span>
            )}

            {organizationSettings.commercialRecord && (
              <span>
                سجل تجاري: {organizationSettings.commercialRecord}
              </span>
            )}
          </div>

          <h1 style={title}>النموذج 1 للسند</h1>
          <h2 style={subtitle}>سند لأمر</h2>

          <div style={metaRow}>
            <span>رقم السند: {note?.note_number || "-"}</span>
            <span>
              تاريخ التحرير:{" "}
              {note?.note_issue_date_gregorian ||
                note?.note_date_gregorian ||
                "-"}
            </span>
          </div>

          <div style={metaRow}>
            <span>
              تاريخ التحرير هجري:{" "}
              {note?.note_issue_date_hijri ||
                note?.note_date_hijri ||
                "-"}
            </span>
            <span>تاريخ الاستحقاق: {note?.due_date || "-"}</span>
          </div>

          <p style={paragraph}>
            حرر هذا السند في مدينة{" "}
            <strong>
              {note?.city || organizationSettings.city || "................"}
            </strong>
            ، وبموجب هذا السند أتعهد أنا الموقع أدناه بأن أدفع لأمر الطرف
            المستفيد / <strong>{firstPartyName}</strong>
            {firstPartyIdentifier ? (
              <>
                ، {firstPartyIdentifierLabel} /{" "}
                <strong>{firstPartyIdentifier}</strong>
              </>
            ) : null}{" "}
            مبلغًا وقدره <strong>{note?.amount || 0}</strong> ريال سعودي.
          </p>

          <p style={paragraph}>
            ويستحق هذا المبلغ في تاريخ{" "}
            <strong>{note?.due_date || "................"}</strong>،
            دون مماطلة أو تأخير، ويعد هذا السند التزامًا واجب الوفاء
            حسب الأنظمة المعمول بها.
          </p>

          <div style={infoBox}>
            <div>
              اسم المدين / {note?.debtor_name || "................"}
            </div>

            <div>
              رقم الهوية /{" "}
              {note?.debtor_national_id || "................"}
            </div>

            <div>
              رقم الجوال / {note?.debtor_phone || "................"}
            </div>

            <div>
              العنوان / {note?.city || "................"}
            </div>

            <div>حالة السند / {note?.status || "-"}</div>
          </div>

          <p style={paragraph}>
            ملاحظات: <strong>{note?.notes || "-"}</strong>
          </p>

          <div style={signatures}>
            <div style={signatureBox}>
              <strong>المدين</strong>
              <div>
                الاسم / {note?.debtor_name || "................"}
              </div>
              <div>التوقيع / ................</div>
              <div>البصمة / ................</div>
            </div>

            <div style={signatureBox}>
              <strong>الطرف المستفيد</strong>

              <div>الاسم / {firstPartyName}</div>

              <div>
                {firstPartyIdentifierLabel} /{" "}
                {firstPartyIdentifier || "................"}
              </div>

              <div>التوقيع / ................</div>
            </div>
          </div>
        </section>

        <div className="no-print" style={buttonsArea}>
          <button style={printButton} onClick={() => window.print()}>
            🖨️ طباعة السند
          </button>

          <button
            style={backButton}
            onClick={() =>
              router.push(`/finance/${branch}/contracts/promissory-note/new`)
            }
          >
            إنشاء سند جديد
          </button>

          <button style={backButton} onClick={() => router.back()}>
            رجوع
          </button>
        </div>
      </div>
    </main>
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

const printArea: CSSProperties = {
  background: "white",
  width: "190mm",
  minHeight: "257mm",
  margin: "0 auto",
  overflow: "hidden",
  padding: "7mm",
  borderRadius: 0,
  lineHeight: 1.45,
  color: "#111827",
  boxSizing: "border-box",
};

const topLine: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
  fontWeight: "bold",
  marginBottom: 8,
};

const logoBox: CSSProperties = {
  width: 55,
  height: 55,
  margin: "0 auto 6px",
  border: "1px dashed #94a3b8",
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const organizationLogoText: CSSProperties = {
  textAlign: "center",
  fontSize: 11,
  fontWeight: "bold",
  color: "#0f172a",
  lineHeight: 1.5,
  padding: 4,
};

const organizationInfo: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 12,
  fontSize: 10.5,
  color: "#475569",
  marginBottom: 6,
};

const title: CSSProperties = {
  textAlign: "center",
  color: "#0d47a1",
  fontSize: 16,
  margin: "0 0 2px",
};

const subtitle: CSSProperties = {
  textAlign: "center",
  color: "#111827",
  fontSize: 20,
  margin: "0 0 10px",
  textDecoration: "underline",
};

const metaRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: 4,
  marginBottom: 5,
  fontSize: 12,
};

const paragraph: CSSProperties = {
  fontSize: 12.5,
  margin: "5px 0",
  textAlign: "justify",
};

const infoBox: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 10,
  marginTop: 10,
  lineHeight: 1.7,
  fontSize: 12.5,
};

const signatures: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginTop: 16,
};

const signatureBox: CSSProperties = {
  borderTop: "1px solid #111827",
  paddingTop: 8,
  lineHeight: 1.7,
  fontSize: 12.5,
};

const buttonsArea: CSSProperties = {
  width: "100%",
  maxWidth: 850,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
  margin: "20px auto 0",
};

const printButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const backButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};
