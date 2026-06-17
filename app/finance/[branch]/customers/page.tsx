"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

const NAJIZ_URL = "https://najiz.sa/";
const MOLIM_URL = "https://eservices.molim.sa/";

type ScreenType = "mobile" | "tablet" | "desktop";

export default function FinanceCustomersPage() {
  const params = useParams();
  const router = useRouter();

  const branch = params.branch as string;

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [groups, setGroups] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationNationalId, setVerificationNationalId] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verificationError, setVerificationError] = useState("");

  const [groupActionLoading, setGroupActionLoading] = useState(false);

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

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "ar")
    );
  }, [groups]);

  const totalPages = Math.max(1, Math.ceil(sortedGroups.length / ITEMS_PER_PAGE));

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedGroups.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedGroups, currentPage]);

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

  function go(path: string) {
    router.push(`/finance/${branch}/${path}`);
  }

  function openExternalVerification(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function loadGroups() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setGroups([]);
      return;
    }

    const { data, error } = await supabase
      .from("finance_customer_groups")
      .select("*")
      .eq("branch_id", branchId)
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setGroups([]);
      return;
    }

    setGroups(data || []);
    setCurrentPage(1);
  }

  async function verifyCustomerByNationalId() {
    if (verificationLoading) return;

    const cleanNationalId = verificationNationalId.replace(/\D/g, "");

    setVerificationError("");
    setVerificationResult(null);

    if (cleanNationalId.length !== 10) {
      setVerificationError("يرجى إدخال رقم هوية صحيح من 10 أرقام.");
      return;
    }

    try {
      setVerificationLoading(true);

      const { data, error } = await supabase.rpc(
        "verify_customer_activity_by_national_id",
        {
          search_national_id: cleanNationalId,
        }
      );

      if (error) {
        console.error(error);
        setVerificationError("حدث خطأ أثناء التحقق من العميل.");
        return;
      }

      setVerificationResult(data?.[0] || null);
    } finally {
      setVerificationLoading(false);
    }
  }

  async function editGroup(group: any) {
    if (groupActionLoading) return;

    const newName = window.prompt("اكتب اسم المجموعة الجديد", group.name || "");

    if (!newName) return;

    const cleanName = newName.trim();

    if (!cleanName) {
      alert("اسم المجموعة لا يمكن أن يكون فارغًا.");
      return;
    }

    const branchId = await getBranchId(branch);

    if (!branchId) {
      alert("تعذر تحديد الفرع.");
      return;
    }

    try {
      setGroupActionLoading(true);

      const { error } = await supabase
        .from("finance_customer_groups")
        .update({ name: cleanName })
        .eq("id", group.id)
        .eq("branch_id", branchId);

      if (error) {
        console.error(error);
        alert("حدث خطأ أثناء تعديل المجموعة.");
        return;
      }

      await loadGroups();
    } finally {
      setGroupActionLoading(false);
    }
  }

  async function deleteGroup(group: any) {
    if (groupActionLoading) return;

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف مجموعة "${group.name}"؟`
    );

    if (!confirmed) return;

    const branchId = await getBranchId(branch);

    if (!branchId) {
      alert("تعذر تحديد الفرع.");
      return;
    }

    try {
      setGroupActionLoading(true);

      const { error } = await supabase
        .from("finance_customer_groups")
        .delete()
        .eq("id", group.id)
        .eq("branch_id", branchId);

      if (error) {
        console.error(error);
        alert(
          "تعذر حذف المجموعة. قد تكون مرتبطة بعملاء داخل النظام، وفي هذه الحالة يجب نقل العملاء أو حذف الارتباط أولًا."
        );
        return;
      }

      await loadGroups();
    } finally {
      setGroupActionLoading(false);
    }
  }

  function openVerificationModal() {
    setShowVerificationModal(true);
    setVerificationNationalId("");
    setVerificationResult(null);
    setVerificationError("");
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
              <h1 style={getTitleStyle(screen)}>العملاء</h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        <section style={verificationHighlight}>
          <div>
            <h2 style={verificationHighlightTitle}>التحقق من العميل</h2>
          </div>

          <button style={verificationMainButton} onClick={openVerificationModal}>
            <span style={verificationMainIcon}>🛡️</span>
            التحقق من العميل
          </button>
        </section>

        <section style={sectionHeader}>
          <div>
            <h2 style={sectionHeading}>مجموعات العملاء</h2>
          </div>

          <button style={smallAddButton} onClick={() => go("customers/groups")}>
            إنشاء / تعديل مجموعة
          </button>
        </section>

        <section style={groupsSection}>
          {groups.length === 0 ? (
            <div style={emptyGroupCard}>لا توجد مجموعات عملاء حتى الآن</div>
          ) : (
            paginatedGroups.map((group, index) => (
              <div key={group.id} style={groupCard}>
                <button
                  style={groupOpenArea}
                  onClick={() => go(`customers/groups/${group.id}`)}
                >
                  <span style={groupNumber}>
                    {String((currentPage - 1) * ITEMS_PER_PAGE + index + 1).padStart(
                      2,
                      "0"
                    )}
                  </span>

                  <span style={groupName}>{group.name}</span>

                  <span style={groupHint}>اضغط لفتح المجموعة</span>
                </button>

                <div style={groupActions}>
                  <button
                    style={editGroupButton}
                    onClick={() => editGroup(group)}
                    disabled={groupActionLoading}
                  >
                    تعديل
                  </button>

                  <button
                    style={deleteGroupButton}
                    onClick={() => deleteGroup(group)}
                    disabled={groupActionLoading}
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        {groups.length > ITEMS_PER_PAGE && (
          <div style={paginationBox}>
            <button
              style={{
                ...paginationButton,
                opacity: currentPage === 1 ? 0.5 : 1,
              }}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            >
              السابق
            </button>

            <span style={paginationText}>
              صفحة {currentPage} من {totalPages}
            </span>

            <button
              style={{
                ...paginationButton,
                opacity: currentPage === totalPages ? 0.5 : 1,
              }}
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(page + 1, totalPages))
              }
            >
              التالي
            </button>
          </div>
        )}

        <section style={actionsSection}>
          <button style={actionButton} onClick={() => go("customers/new")}>
            <span style={buttonContent}>
              <span style={buttonIcon}>➕</span>
              إنشاء عميل جديد
            </span>
          </button>

          <button style={actionButton} onClick={() => go("customers/search")}>
            <span style={buttonContent}>
              <span style={buttonIcon}>🔍</span>
              البحث عن عميل
            </span>
          </button>

          <button style={actionButton} onClick={() => go("customers/list")}>
            <span style={buttonContent}>
              <span style={buttonIcon}>📋</span>
              قائمة العملاء
            </span>
          </button>

          <button style={actionButton} onClick={() => go("customers/groups")}>
            <span style={buttonContent}>
              <span style={buttonIcon}>👥</span>
              إنشاء / تعديل مجموعة عملاء
            </span>
          </button>

          <button
            style={actionButton}
            onClick={() => alert("هذه الميزة غير مفعلة حاليًا.")}
          >
            <span style={buttonContent}>
              <span style={buttonIcon}>✏️</span>
              حذف / تعديل عميل
            </span>
          </button>

          <button
            style={actionButton}
            onClick={() => alert("قائمة الحظر غير مفعلة حاليًا.")}
          >
            <span style={buttonContent}>
              <span style={buttonIcon}>⛔</span>
              قائمة الحظر
            </span>
          </button>
        </section>

        <div style={backWrapper}>
          <button
            style={backButton}
            onClick={() => router.push(`/finance/${branch}`)}
          >
            الرجوع لمحطة العمل الرئيسية
          </button>
        </div>
      </div>

      {showVerificationModal && (
        <div style={modalOverlay}>
          <div style={verificationModal}>
            <div style={modalHeader}>
              <div>
                <h2 style={modalTitle}>التحقق من العميل</h2>
              </div>

              <button
                style={closeButton}
                onClick={() => setShowVerificationModal(false)}
              >
                ×
              </button>
            </div>

            <div style={verificationActions}>
              <button
                style={verificationExternalButton}
                onClick={() => openExternalVerification(NAJIZ_URL)}
              >
                التحقق من ناجز
              </button>

              <button
                style={verificationExternalButton}
                onClick={() => openExternalVerification(MOLIM_URL)}
              >
                التحقق من سمة
              </button>
            </div>

            <div style={internalVerificationBox}>
              <h3 style={internalTitle}>التحقق من أنشطة العميل السابقة</h3>

              <label style={label}>رقم الهوية</label>
              <input
                value={verificationNationalId}
                onChange={(e) =>
                  setVerificationNationalId(
                    e.target.value.replace(/\D/g, "").slice(0, 10)
                  )
                }
                placeholder="أدخل رقم الهوية"
                style={input}
                inputMode="numeric"
              />

              {verificationError && <div style={errorBox}>{verificationError}</div>}

              <button
                style={{
                  ...primaryButton,
                  opacity: verificationLoading ? 0.7 : 1,
                  cursor: verificationLoading ? "not-allowed" : "pointer",
                }}
                onClick={verifyCustomerByNationalId}
                disabled={verificationLoading}
              >
                {verificationLoading ? "جاري التحقق..." : "بحث برقم الهوية"}
              </button>

              {verificationResult && (
                <div
                  style={{
                    ...resultCard,
                    borderColor:
                      verificationResult.result_status === "regular"
                        ? "#bbf7d0"
                        : verificationResult.result_status === "overdue"
                        ? "#fde68a"
                        : verificationResult.result_status === "no_activity"
                        ? "#bfdbfe"
                        : "#fecaca",
                    background:
                      verificationResult.result_status === "regular"
                        ? "#f0fdf4"
                        : verificationResult.result_status === "overdue"
                        ? "#fffbeb"
                        : verificationResult.result_status === "no_activity"
                        ? "#eff6ff"
                        : "#fef2f2",
                  }}
                >
                  <div style={resultIcon}>
                    {verificationResult.result_status === "regular"
                      ? "✅"
                      : verificationResult.result_status === "overdue"
                      ? "⚠️"
                      : verificationResult.result_status === "no_activity"
                      ? "ℹ️"
                      : "❌"}
                  </div>

                  <div>
                    <h3 style={resultTitle}>
                      {verificationResult.result_status === "regular"
                        ? "✅ العميل منتظم"
                        : verificationResult.result_title}
                    </h3>

                    <p style={resultDescription}>
                      {verificationResult.result_description}
                    </p>

                    {verificationResult.has_activity && (
                      <div style={resultMeta}>
                        <span>
                          عدد الأنشطة: {verificationResult.contracts_count}
                        </span>
                        <span>
                          المتأخرات:{" "}
                          {verificationResult.overdue_contracts_count}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

const verificationHighlight: CSSProperties = {
  background: "linear-gradient(135deg,#eff6ff,#ffffff)",
  border: "1px solid #bfdbfe",
  borderRadius: 22,
  padding: 20,
  marginBottom: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  boxShadow: "0 10px 26px rgba(30,64,175,0.08)",
};

const verificationHighlightTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 900,
};

const verificationMainButton: CSSProperties = {
  minWidth: 210,
  border: "none",
  background: "linear-gradient(135deg,#1d4ed8,#1e3a8a)",
  color: "#ffffff",
  borderRadius: 18,
  padding: "15px 20px",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
  boxShadow: "0 12px 26px rgba(29,78,216,0.28)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  fontFamily: "var(--font-almarai), sans-serif",
};

const verificationMainIcon: CSSProperties = {
  fontSize: 22,
};

const sectionHeader: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 20,
  padding: 18,
  marginBottom: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
};

const sectionHeading: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 900,
};

const smallAddButton: CSSProperties = {
  border: "none",
  background: "#0d47a1",
  color: "#ffffff",
  borderRadius: 14,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontFamily: "var(--font-almarai), sans-serif",
};

const groupsSection: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const groupCard: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 20,
  overflow: "hidden",
  boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
};

const groupOpenArea: CSSProperties = {
  width: "100%",
  border: "none",
  background: "#ffffff",
  padding: 18,
  cursor: "pointer",
  textAlign: "right",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  fontFamily: "var(--font-almarai), sans-serif",
};

const groupNumber: CSSProperties = {
  width: 42,
  height: 30,
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 900,
};

const groupName: CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const groupHint: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
};

const groupActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  borderTop: "1px solid #e2e8f0",
  padding: 10,
  background: "#f8fafc",
};

const editGroupButton: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e40af",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const deleteGroupButton: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const emptyGroupCard: CSSProperties = {
  background: "white",
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 20,
  fontSize: 16,
  textAlign: "center",
  color: "#6b7280",
};

const actionsSection: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
};

const actionButton: CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,0.04)",
  fontFamily: "var(--font-almarai), sans-serif",
};

const paginationBox: CSSProperties = {
  marginBottom: 18,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const paginationButton: CSSProperties = {
  padding: "11px 18px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const paginationText: CSSProperties = {
  color: "#0f172a",
  fontWeight: "bold",
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

const buttonContent: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const buttonIcon: CSSProperties = {
  fontSize: 20,
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const verificationModal: CSSProperties = {
  width: "100%",
  maxWidth: 620,
  background: "#ffffff",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)",
  border: "1px solid #e2e8f0",
};

const modalHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const modalTitle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  color: "#0f172a",
  fontWeight: 900,
};

const closeButton: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 24,
  cursor: "pointer",
};

const verificationActions: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const verificationExternalButton: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e40af",
  borderRadius: 16,
  padding: "14px 16px",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const internalVerificationBox: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  background: "#f8fafc",
};

const internalTitle: CSSProperties = {
  margin: "0 0 14px",
  fontSize: 18,
  color: "#0f172a",
  fontWeight: 900,
};

const label: CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#334155",
  fontSize: 14,
  fontWeight: 800,
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  padding: "13px 14px",
  fontSize: 15,
  outline: "none",
  background: "#ffffff",
  marginBottom: 12,
  fontFamily: "var(--font-almarai), sans-serif",
};

const primaryButton: CSSProperties = {
  width: "100%",
  border: "none",
  background: "linear-gradient(135deg,#1d4ed8,#1e3a8a)",
  color: "#ffffff",
  borderRadius: 14,
  padding: "13px 16px",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
};

const errorBox: CSSProperties = {
  background: "#fef2f2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  borderRadius: 14,
  padding: "10px 12px",
  marginBottom: 12,
  fontSize: 14,
  fontWeight: 800,
};

const resultCard: CSSProperties = {
  display: "flex",
  gap: 14,
  marginTop: 16,
  padding: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 18,
};

const resultIcon: CSSProperties = {
  fontSize: 32,
  lineHeight: 1,
};

const resultTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 900,
};

const resultDescription: CSSProperties = {
  margin: "8px 0 0",
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.8,
};

const resultMeta: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
};
