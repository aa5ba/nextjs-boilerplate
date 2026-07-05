"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";
import { normalizeNumber, toNumber } from "@/lib/numberUtils";

type ScreenType = "mobile" | "tablet" | "desktop";

type CustomerGroup = {
  id: string;
  name: string | null;
};

type CustomerLookupData = {
  id: string;
  groupId: string | null;
  fullName: string;
  nationalId: string;
  birthHijri: string;
  phone: string;
  workName: string;
  salary: number | null;
  bank: string;
  broker: string;
};

type CustomerLookupResponse = {
  ok?: boolean;
  found?: boolean;
  customer?: CustomerLookupData | null;
  message?: string;
  code?: string;
};

type CustomerSaveResponse = {
  ok?: boolean;
  customer?: {
    id?: string;
    name?: string;
    wasCreated?: boolean;
  };
  message?: string;
  code?: string;
};

function cleanDigits(value: string, maxLength: number): string {
  return normalizeNumber(value)
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

function splitHijriDate(value: string): {
  year: string;
  month: string;
  day: string;
} | null {
  const normalized = normalizeNumber(value)
    .trim()
    .replace(/[.\-]/g, "/")
    .replace(/\s+/g, "")
    .replace(/\/{2,}/g, "/");

  const parts = normalized.split("/");

  if (parts.length !== 3) {
    return null;
  }

  if (parts[0].length === 4) {
    return {
      year: parts[0],
      month: parts[1],
      day: parts[2],
    };
  }

  if (parts[2].length === 4) {
    return {
      year: parts[2],
      month: parts[1],
      day: parts[0],
    };
  }

  return null;
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function NewFinanceCustomerPage() {
  const params = useParams();
  const router = useRouter();

  const branchParam = params.branch;
  const branch = Array.isArray(branchParam)
    ? branchParam[0] ?? ""
    : typeof branchParam === "string"
      ? branchParam
      : "";

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");
  const [authChecked, setAuthChecked] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [groups, setGroups] = useState<CustomerGroup[]>([]);
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
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "found" | "not-found" | "error"
  >("idle");
  const [lookupMessage, setLookupMessage] = useState("");
  const [existingCustomerId, setExistingCustomerId] = useState<string | null>(
    null
  );
  const [resolvedNationalId, setResolvedNationalId] = useState("");
  const [saving, setSaving] = useState(false);

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const normalizedNationalId = useMemo(
    () => cleanDigits(nationalId, 10),
    [nationalId]
  );

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
    if (typeof window === "undefined") {
      return;
    }

    const storedName = localStorage.getItem("finance_user_name")?.trim() ?? "";
    const storedUser =
      localStorage.getItem("finance_branch_user") ||
      localStorage.getItem("finance_user");

    let fallbackName = "";

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as {
          full_name?: unknown;
          username?: unknown;
          name?: unknown;
        };

        fallbackName =
          (typeof parsed.full_name === "string" && parsed.full_name.trim()) ||
          (typeof parsed.username === "string" && parsed.username.trim()) ||
          (typeof parsed.name === "string" && parsed.name.trim()) ||
          "";
      } catch {
        fallbackName = "";
      }
    }

    if (!storedName && !storedUser) {
      router.replace("/login");
      return;
    }

    setEmployeeName(storedName || fallbackName || "الموظف");
    setAuthChecked(true);
  }, [router]);

  useEffect(() => {
    if (!authChecked || !branch) {
      return;
    }

    let cancelled = false;

    async function loadGroups() {
      setLoadingGroups(true);

      try {
        const currentBranchId = await getBranchId(branch);

        if (cancelled) {
          return;
        }

        if (!currentBranchId) {
          setGroups([]);
          return;
        }

        const { data, error } = await supabase
          .from("finance_customer_groups")
          .select("id, name")
          .eq("branch_id", currentBranchId)
          .order("created_at", { ascending: false });

        if (cancelled) {
          return;
        }

        if (error) {
          throw new Error(error.message || "تعذر تحميل مجموعات العملاء");
        }

        setGroups((data ?? []) as CustomerGroup[]);
      } catch (error) {
        if (!cancelled) {
          setGroups([]);
          alert(
            error instanceof Error
              ? error.message
              : "تعذر تحميل مجموعات العملاء"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingGroups(false);
        }
      }
    }

    void loadGroups();

    return () => {
      cancelled = true;
    };
  }, [authChecked, branch]);

  useEffect(() => {
    if (
      !authChecked ||
      !branch ||
      normalizedNationalId.length !== 10
    ) {
      setLookingUpCustomer(false);

      if (normalizedNationalId.length !== 10) {
        setLookupStatus("idle");
        setLookupMessage("");
      }

      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(async () => {
      setLookingUpCustomer(true);
      setLookupStatus("idle");
      setLookupMessage("جاري البحث عن العميل...");

      try {
        const query = new URLSearchParams({
          branchSlug: branch,
          nationalId: normalizedNationalId,
        });

        const response = await fetch(
          `/api/finance/customers?${query.toString()}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result = await readJsonResponse<CustomerLookupResponse>(response);

        if (response.status === 401 || result?.code === "INVALID_SESSION") {
          clearLocalFinanceSession();
          router.replace("/login");
          return;
        }

        if (!response.ok || result?.ok !== true) {
          throw new Error(result?.message || "تعذر البحث عن بيانات العميل");
        }

        if (result.found === true && result.customer) {
          const customer = result.customer;
          const birth = splitHijriDate(customer.birthHijri);

          setExistingCustomerId(customer.id);
          setGroupId(customer.groupId ?? "");
          setFullName(customer.fullName ?? "");
          setPhone(cleanDigits(customer.phone ?? "", 10));
          setWork(customer.workName ?? "");
          setSalary(
            customer.salary === null || customer.salary === undefined
              ? ""
              : String(customer.salary)
          );
          setBank(customer.bank ?? "");
          setBroker(customer.broker ?? "");

          if (birth) {
            setBirthYear(cleanDigits(birth.year, 4));
            setBirthMonth(cleanDigits(birth.month, 2));
            setBirthDay(cleanDigits(birth.day, 2));
          } else {
            setBirthYear("");
            setBirthMonth("");
            setBirthDay("");
          }

          setLookupStatus("found");
          setLookupMessage(
            "تم العثور على العميل وتعبئة بياناته. أي تعديل تحفظه سيعتمد كبياناته الجديدة."
          );
        } else {
          setExistingCustomerId(null);
          setLookupStatus("not-found");
          setLookupMessage(
            "رقم الهوية غير مسجل في هذا الفرع، وسيتم إنشاء عميل جديد."
          );
        }

        setResolvedNationalId(normalizedNationalId);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setExistingCustomerId(null);
        setLookupStatus("error");
        setLookupMessage(
          error instanceof Error
            ? error.message
            : "تعذر البحث عن بيانات العميل"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLookingUpCustomer(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [authChecked, branch, normalizedNationalId, router]);

  function clearCustomerFieldsAfterIdentityChange() {
    setGroupId("");
    setFullName("");
    setBirthDay("");
    setBirthMonth("");
    setBirthYear("");
    setPhone("");
    setWork("");
    setSalary("");
    setBank("");
    setBroker("");
    setExistingCustomerId(null);
  }

  function handleNationalIdChange(value: string) {
    const nextNationalId = cleanDigits(value, 10);

    if (
      resolvedNationalId &&
      nextNationalId !== resolvedNationalId
    ) {
      clearCustomerFieldsAfterIdentityChange();
      setResolvedNationalId("");
      setLookupStatus("idle");
      setLookupMessage("");
    }

    setNationalId(nextNationalId);
  }

  function isValidHijriDate(day: string, month: string, year: string) {
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);

    return d >= 1 && d <= 30 && m >= 1 && m <= 12 && y >= 1300 && y <= 1600;
  }

  async function createCustomer() {
    if (saving || lookingUpCustomer) {
      return;
    }

    const cleanNationalId = cleanDigits(nationalId, 10);
    const cleanPhone = cleanDigits(phone, 10);
    const cleanBirthDay = cleanDigits(birthDay, 2);
    const cleanBirthMonth = cleanDigits(birthMonth, 2);
    const cleanBirthYear = cleanDigits(birthYear, 4);

    if (
      !fullName.trim() ||
      !cleanNationalId ||
      !cleanBirthDay ||
      !cleanBirthMonth ||
      !cleanBirthYear ||
      !cleanPhone
    ) {
      alert("أكمل البيانات المطلوبة");
      return;
    }

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

    const salaryAmount = salary.trim() ? toNumber(salary) : null;

    if (
      salary.trim() &&
      (!Number.isFinite(salaryAmount) || Number(salaryAmount) <= 0)
    ) {
      alert("أدخل الراتب بشكل صحيح");
      return;
    }

    const birthHijri = [
      cleanBirthYear.padStart(4, "0"),
      cleanBirthMonth.padStart(2, "0"),
      cleanBirthDay.padStart(2, "0"),
    ].join("/");

    try {
      setSaving(true);

      const response = await fetch("/api/finance/customers", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchSlug: branch,
          nationalId: cleanNationalId,
          fullName: fullName.trim(),
          birthHijri,
          phone: cleanPhone,
          groupId: groupId || null,
          workName: work.trim() || null,
          salary: salaryAmount,
          bank: bank.trim() || null,
          broker: broker.trim() || null,
        }),
      });

      const result = await readJsonResponse<CustomerSaveResponse>(response);

      if (response.status === 401 || result?.code === "INVALID_SESSION") {
        clearLocalFinanceSession();
        router.replace("/login");
        return;
      }

      if (!response.ok || result?.ok !== true) {
        throw new Error(result?.message || "تعذر حفظ بيانات العميل");
      }

      const customerId = result.customer?.id?.trim() ?? "";

      if (!customerId) {
        throw new Error("تم الحفظ لكن تعذر قراءة معرف العميل");
      }

      alert(
        result.message ||
          (result.customer?.wasCreated
            ? "تم إنشاء العميل بنجاح"
            : "تم تحديث بيانات العميل بنجاح")
      );

      router.push(`/finance/${branch}/customers/${customerId}`);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "تعذر حفظ بيانات العميل"
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await fetch("/api/finance/login", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch {
      // يستمر تسجيل الخروج محليًا حتى لو تعذر الاتصال بالخادم.
    } finally {
      clearLocalFinanceSession();
      router.replace("/login");
      setLoggingOut(false);
    }
  }

  if (!authChecked) {
    return null;
  }

  const saveButtonText = saving
    ? existingCustomerId
      ? "جاري تحديث العميل..."
      : "جاري إنشاء العميل..."
    : existingCustomerId
      ? "تحديث بيانات العميل"
      : "إنشاء العميل";

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
                  style={logoutInlineButton}
                  onClick={() => void logout()}
                  disabled={loggingOut}
                >
                  <LogoutIcon />
                  <span>{loggingOut ? "جاري الخروج..." : "تسجيل الخروج"}</span>
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
          <input
            style={input}
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            placeholder="رقم الهوية"
            value={nationalId}
            onChange={(event) => handleNationalIdChange(event.target.value)}
            disabled={saving}
          />

          {(lookingUpCustomer || lookupMessage) && (
            <div
              style={getLookupStatusStyle(
                lookingUpCustomer ? "loading" : lookupStatus
              )}
              role="status"
              aria-live="polite"
            >
              {lookingUpCustomer ? "جاري البحث عن العميل..." : lookupMessage}
            </div>
          )}

          <select
            style={input}
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            disabled={loadingGroups || saving}
          >
            <option value="">
              {loadingGroups
                ? "جاري تحميل المجموعات..."
                : "مجموعة العملاء - اختياري"}
            </option>

            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || "مجموعة بدون اسم"}
              </option>
            ))}
          </select>

          <input
            style={input}
            placeholder="الاسم كاملاً"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={saving}
          />

          <div style={isCompact ? dateGridCompact : dateGrid}>
            <input
              style={input}
              inputMode="numeric"
              maxLength={2}
              placeholder="اليوم هجري"
              value={birthDay}
              onChange={(event) =>
                setBirthDay(cleanDigits(event.target.value, 2))
              }
              disabled={saving}
            />

            <input
              style={input}
              inputMode="numeric"
              maxLength={2}
              placeholder="الشهر هجري"
              value={birthMonth}
              onChange={(event) =>
                setBirthMonth(cleanDigits(event.target.value, 2))
              }
              disabled={saving}
            />

            <input
              style={input}
              inputMode="numeric"
              maxLength={4}
              placeholder="السنة هجري"
              value={birthYear}
              onChange={(event) =>
                setBirthYear(cleanDigits(event.target.value, 4))
              }
              disabled={saving}
            />
          </div>

          <input
            style={input}
            inputMode="numeric"
            maxLength={10}
            placeholder="رقم الجوال"
            value={phone}
            onChange={(event) => setPhone(cleanDigits(event.target.value, 10))}
            disabled={saving}
          />

          <input
            style={input}
            placeholder="العمل ( اختياري )"
            value={work}
            onChange={(event) => setWork(event.target.value)}
            disabled={saving}
          />

          <input
            style={input}
            inputMode="decimal"
            placeholder="الراتب ( اختياري )"
            value={salary}
            onChange={(event) => setSalary(normalizeNumber(event.target.value))}
            disabled={saving}
          />

          <input
            style={input}
            placeholder="البنك ( اختياري )"
            value={bank}
            onChange={(event) => setBank(event.target.value)}
            disabled={saving}
          />

          <input
            style={input}
            placeholder="الوسيط ( اختياري )"
            value={broker}
            onChange={(event) => setBroker(event.target.value)}
            disabled={saving}
          />

          <button
            style={primaryButton}
            onClick={() => void createCustomer()}
            disabled={saving || lookingUpCustomer}
          >
            {saveButtonText}
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

function clearLocalFinanceSession() {
  if (typeof window === "undefined") {
    return;
  }

  const keys = [
    "finance_user",
    "finance_user_name",
    "finance_branch_user",
    "finance_role",
    "finance_permissions",
  ];

  for (const key of keys) {
    localStorage.removeItem(key);
  }
}

function getLookupStatusStyle(
  status: "loading" | "found" | "not-found" | "error" | "idle"
): CSSProperties {
  const palette = {
    loading: {
      background: "rgba(37,99,235,0.08)",
      border: "1px solid rgba(37,99,235,0.22)",
      color: "#1d4ed8",
    },
    found: {
      background: "rgba(22,163,74,0.08)",
      border: "1px solid rgba(22,163,74,0.24)",
      color: "#15803d",
    },
    "not-found": {
      background: "rgba(217,119,6,0.08)",
      border: "1px solid rgba(217,119,6,0.24)",
      color: "#b45309",
    },
    error: {
      background: "rgba(220,38,38,0.08)",
      border: "1px solid rgba(220,38,38,0.22)",
      color: "#b91c1c",
    },
    idle: {
      background: "rgba(100,116,139,0.08)",
      border: "1px solid rgba(100,116,139,0.18)",
      color: "#475569",
    },
  }[status];

  return {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    padding: "11px 13px",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.7,
    ...palette,
  };
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
