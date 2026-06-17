"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

type ScreenType = "mobile" | "tablet" | "desktop";

export default function NewFinanceCustomerPage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [groups, setGroups] = useState<any[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);

  const [groupId, setGroupId] = useState("");
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [phone, setPhone] = useState("");
  const [work, setWork] = useState("");
  const [salary, setSalary] = useState("");
  const [bank, setBank] = useState("");
  const [broker, setBroker] = useState("");

  const [loadingGroups, setLoadingGroups] = useState(true);
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
    loadGroups();
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

  async function loadGroups() {
    setLoadingGroups(true);

    const currentBranchId = await getBranchId(branch);

    setBranchId(currentBranchId);

    if (!currentBranchId) {
      setGroups([]);
      setLoadingGroups(false);
      return;
    }

    const { data, error } = await supabase
      .from("finance_customer_groups")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message || "تعذر تحميل مجموعات العملاء");
      setGroups([]);
      setLoadingGroups(false);
      return;
    }

    setGroups(data || []);
    setLoadingGroups(false);
  }

  function isValidHijriDate(day: string, month: string, year: string) {
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);

    return d >= 1 && d <= 30 && m >= 1 && m <= 12 && y >= 1300 && y <= 1600;
  }

  async function createCustomer() {
    if (saving) return;

    if (
      !branchId ||
      !groupId ||
      !fullName.trim() ||
      !nationalId ||
      !birthDay ||
      !birthMonth ||
      !birthYear ||
      !phone
    ) {
      alert("أكمل البيانات المطلوبة");
      return;
    }

    const cleanNationalId = normalizeNumber(nationalId);
    const cleanPhone = normalizeNumber(phone);
    const cleanBirthDay = normalizeNumber(birthDay);
    const cleanBirthMonth = normalizeNumber(birthMonth);
    const cleanBirthYear = normalizeNumber(birthYear);

    if (cleanNationalId.length !== 10) {
      alert("رقم الهوية يجب أن يكون 10 أرقام");
      return;
    }

    if (!/^05\d{8}$/.test(cleanPhone)) {
      alert("رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05");
      return;
    }

    if (!isValidHijriDate(cleanBirthDay, cleanBirthMonth, cleanBirthYear)) {
      alert("أدخل تاريخ ميلاد هجري صحيح");
      return;
    }

    const salaryAmount = salary ? toNumber(salary) : null;

    if (salary && (!salaryAmount || salaryAmount <= 0)) {
      alert("أدخل الراتب بشكل صحيح");
      return;
    }

    try {
      setSaving(true);

      const { data: duplicateCustomer, error: duplicateError } = await supabase
        .from("finance_customers")
        .select("id, full_name, national_id, phone")
        .eq("branch_id", branchId)
        .or(`national_id.eq.${cleanNationalId},phone.eq.${cleanPhone}`)
        .maybeSingle();

      if (duplicateError) {
        throw new Error(duplicateError.message);
      }

      if (duplicateCustomer) {
        alert("يوجد عميل مسجل مسبقًا بنفس رقم الهوية أو رقم الجوال");
        return;
      }

      const birthHijri = `${cleanBirthDay}/${cleanBirthMonth}/${cleanBirthYear}`;

      const { data: customerData, error } = await supabase
        .from("finance_customers")
        .insert([
          {
            branch_id: branchId,
            group_id: groupId,
            full_name: fullName.trim(),
            national_id: cleanNationalId,
            birth_hijri: birthHijri,
            phone: cleanPhone,
            work: work.trim(),
            work_name: work.trim(),
            salary: salaryAmount,
            bank: bank.trim(),
            broker: broker.trim(),
          },
        ])
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      await supabase.from("finance_activity_logs").insert([
        {
          branch_id: branchId,
          activity_type: "إنشاء عميل",
          description: `تم إنشاء عميل جديد باسم ${fullName.trim()}`,
          customer_id: customerData.id,
          customer_name: fullName.trim(),
          employee_name: employeeName || "الموظف",
          status: "جديد",
        },
      ]);

      alert("تم إنشاء العميل بنجاح");

      router.push(`/finance/${branch}/customers/${customerData.id}`);
    } catch (error: any) {
      alert(error.message || "تعذر إنشاء العميل");
    } finally {
      setSaving(false);
    }
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
              <h1 style={getTitleStyle(screen)}>إنشاء عميل جديد</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        <section style={card}>
          <select
            style={input}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            disabled={loadingGroups || saving}
          >
            <option value="">
              {loadingGroups ? "جاري تحميل المجموعات..." : "اختر مجموعة العملاء"}
            </option>

            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>

          <input
            style={input}
            placeholder="الاسم كاملاً"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <input
            style={input}
            inputMode="numeric"
            maxLength={10}
            placeholder="رقم الهوية"
            value={nationalId}
            onChange={(e) => setNationalId(normalizeNumber(e.target.value))}
          />

          <div style={isCompact ? dateGridCompact : dateGrid}>
            <input
              style={input}
              inputMode="numeric"
              placeholder="اليوم هجري"
              value={birthDay}
              onChange={(e) => setBirthDay(normalizeNumber(e.target.value))}
            />

            <input
              style={input}
              inputMode="numeric"
              placeholder="الشهر هجري"
              value={birthMonth}
              onChange={(e) => setBirthMonth(normalizeNumber(e.target.value))}
            />

            <input
              style={input}
              inputMode="numeric"
              placeholder="السنة هجري"
              value={birthYear}
              onChange={(e) => setBirthYear(normalizeNumber(e.target.value))}
            />
          </div>

          <input
            style={input}
            inputMode="numeric"
            maxLength={10}
            placeholder="رقم الجوال"
            value={phone}
            onChange={(e) => setPhone(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            placeholder="العمل ( اختياري )"
            value={work}
            onChange={(e) => setWork(e.target.value)}
          />

          <input
            style={input}
            inputMode="numeric"
            placeholder="الراتب ( اختياري )"
            value={salary}
            onChange={(e) => setSalary(normalizeNumber(e.target.value))}
          />

          <input
            style={input}
            placeholder="البنك ( اختياري )"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
          />

          <input
            style={input}
            placeholder="الوسيط ( اختياري )"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
          />

          <button style={primaryButton} onClick={createCustomer} disabled={saving}>
            {saving ? "جاري إنشاء العميل..." : "إنشاء العميل"}
          </button>
        </section>

        <div style={backWrapper}>
          <button
            style={backButton}
            onClick={() => router.push(`/finance/${branch}/customers`)}
          >
            الرجوع للعملاء
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

const card: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
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

const dateGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
};

const dateGridCompact: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 0,
};

const primaryButton: CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: 900,
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
