"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

const NAJIZ_URL = "https://najiz.sa/";
const MOLIM_URL = "https://eservices.molim.sa/";

export default function FinanceCustomersPage() {
  const params = useParams();
  const router = useRouter();
  const branch = params.branch as string;

  const [groups, setGroups] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationNationalId, setVerificationNationalId] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verificationError, setVerificationError] = useState("");

  useEffect(() => {
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
    const cleanNationalId = verificationNationalId.replace(/\D/g, "");

    setVerificationError("");
    setVerificationResult(null);

    if (cleanNationalId.length !== 10) {
      setVerificationError("يرجى إدخال رقم هوية صحيح من 10 أرقام.");
      return;
    }

    setVerificationLoading(true);

    const { data, error } = await supabase.rpc(
      "verify_customer_activity_by_national_id",
      {
        search_national_id: cleanNationalId,
      }
    );

    setVerificationLoading(false);

    if (error) {
      console.error(error);
      setVerificationError("حدث خطأ أثناء التحقق من العميل.");
      return;
    }

    setVerificationResult(data?.[0] || null);
  }

  async function editGroup(group: any) {
    const newName = window.prompt("اكتب اسم المجموعة الجديد", group.name || "");

    if (!newName) return;

    const cleanName = newName.trim();

    if (!cleanName) {
      alert("اسم المجموعة لا يمكن أن يكون فارغًا.");
      return;
    }

    const { error } = await supabase
      .from("finance_customer_groups")
      .update({ name: cleanName })
      .eq("id", group.id);

    if (error) {
      console.error(error);
      alert("حدث خطأ أثناء تعديل المجموعة.");
      return;
    }

    await loadGroups();
  }

  async function deleteGroup(group: any) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف مجموعة "${group.name}"؟`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("finance_customer_groups")
      .delete()
      .eq("id", group.id);

    if (error) {
      console.error(error);
      alert(
        "تعذر حذف المجموعة. قد تكون مرتبطة بعملاء داخل النظام، وفي هذه الحالة يجب نقل العملاء أو حذف الارتباط أولًا."
      );
      return;
    }

    await loadGroups();
  }

  function openVerificationModal() {
    setShowVerificationModal(true);
    setVerificationNationalId("");
    setVerificationResult(null);
    setVerificationError("");
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <div>
            <h1 style={headerTitle}>العملاء</h1>
            <p style={headerSubtitle}>
              إدارة العملاء والمجموعات والتحقق من سجل العميل داخل جميع الفروع.
            </p>
          </div>
        </div>

        <section style={verificationHighlight}>
          <div>
            <h2 style={verificationHighlightTitle}>التحقق من العميل</h2>
            <p style={verificationHighlightText}>
              تحقق من ناجز أو سمة، أو افحص أنشطة العميل السابقة داخل جميع الفروع
              برقم الهوية دون إظهار بيانات الفروع.
            </p>
          </div>

          <button style={verificationMainButton} onClick={openVerificationModal}>
            <span style={verificationMainIcon}>🛡️</span>
            التحقق من العميل
          </button>
        </section>

        <section style={sectionHeader}>
          <div>
            <h2 style={sectionHeading}>مجموعات العملاء</h2>
            <p style={sectionDescription}>
              اختر مجموعة لعرض العملاء، أو عدّل اسم المجموعة، أو احذفها عند الحاجة.
            </p>
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
                  >
                    تعديل
                  </button>

                  <button
                    style={deleteGroupButton}
                    onClick={() => deleteGroup(group)}
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

          <button style={actionButton}>
            <span style={buttonContent}>
              <span style={buttonIcon}>✏️</span>
              حذف / تعديل عميل
            </span>
          </button>

          <button style={actionButton}>
            <span style={buttonContent}>
              <span style={buttonIcon}>⛔</span>
              قائمة الحظر
            </span>
          </button>
        </section>

        <button
          style={backButton}
          onClick={() => router.push(`/finance/${branch}`)}
        >
          الرجوع لمحطة العمل الرئيسية
        </button>
      </div>

      {showVerificationModal && (
        <div style={modalOverlay}>
          <div style={verificationModal}>
            <div style={modalHeader}>
              <div>
                <h2 style={modalTitle}>التحقق من العميل</h2>
                <p style={modalSubtitle}>
                  تحقق خارجيًا من ناجز أو سمة، أو داخليًا من أنشطة العميل
                  السابقة برقم الهوية.
                </p>
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

const page = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const header = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
  boxShadow: "0 18px 35px rgba(15,23,42,0.18)",
};

const headerTitle = {
  margin: 0,
  fontSize: 30,
  fontWeight: 900,
};

const headerSubtitle = {
  margin: "10px 0 0",
  color: "#dbeafe",
  fontSize: 15,
  lineHeight: 1.8,
};

const verificationHighlight = {
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

const verificationHighlightTitle = {
  margin: 0,
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 900,
};

const verificationHighlightText = {
  margin: "8px 0 0",
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.8,
};

const verificationMainButton = {
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
};

const verificationMainIcon = {
  fontSize: 22,
};

const sectionHeader = {
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

const sectionHeading = {
  margin: 0,
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 900,
};

const sectionDescription = {
  margin: "8px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const smallAddButton = {
  border: "none",
  background: "#0d47a1",
  color: "#ffffff",
  borderRadius: 14,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const groupsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const groupCard = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 20,
  overflow: "hidden",
  boxShadow: "0 8px 20px rgba(15,23,42,0.05)",
};

const groupOpenArea = {
  width: "100%",
  border: "none",
  background: "#ffffff",
  padding: 18,
  cursor: "pointer",
  textAlign: "right" as const,
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const groupNumber = {
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

const groupName = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 900,
};

const groupHint = {
  color: "#64748b",
  fontSize: 13,
};

const groupActions = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  borderTop: "1px solid #e2e8f0",
  padding: 10,
  background: "#f8fafc",
};

const editGroupButton = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e40af",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const deleteGroupButton = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  borderRadius: 12,
  padding: "10px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const emptyGroupCard = {
  background: "white",
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 20,
  fontSize: 16,
  textAlign: "center" as const,
  color: "#6b7280",
};

const actionsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
};

const actionButton = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,0.04)",
};

const paginationBox = {
  marginBottom: 18,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const paginationButton = {
  padding: "11px 18px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
};

const paginationText = {
  color: "#0f172a",
  fontWeight: "bold",
};

const backButton = {
  width: "100%",
  padding: 15,
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  marginTop: 18,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(51,65,85,0.22)",
};

const buttonContent = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const buttonIcon = {
  fontSize: 20,
};

const modalOverlay = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const verificationModal = {
  width: "100%",
  maxWidth: 620,
  background: "#ffffff",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)",
  border: "1px solid #e2e8f0",
};

const modalHeader = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const modalTitle = {
  margin: 0,
  fontSize: 24,
  color: "#0f172a",
  fontWeight: 900,
};

const modalSubtitle = {
  margin: "8px 0 0",
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.8,
};

const closeButton = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 24,
  cursor: "pointer",
};

const verificationActions = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const verificationExternalButton = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e40af",
  borderRadius: 16,
  padding: "14px 16px",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
};

const internalVerificationBox = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  background: "#f8fafc",
};

const internalTitle = {
  margin: "0 0 14px",
  fontSize: 18,
  color: "#0f172a",
  fontWeight: 900,
};

const label = {
  display: "block",
  marginBottom: 8,
  color: "#334155",
  fontSize: 14,
  fontWeight: 800,
};

const input = {
  width: "100%",
  boxSizing: "border-box" as const,
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  padding: "13px 14px",
  fontSize: 15,
  outline: "none",
  background: "#ffffff",
  marginBottom: 12,
};

const primaryButton = {
  width: "100%",
  border: "none",
  background: "linear-gradient(135deg,#1d4ed8,#1e3a8a)",
  color: "#ffffff",
  borderRadius: 14,
  padding: "13px 16px",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
};

const errorBox = {
  background: "#fef2f2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  borderRadius: 14,
  padding: "10px 12px",
  marginBottom: 12,
  fontSize: 14,
  fontWeight: 800,
};

const resultCard = {
  display: "flex",
  gap: 14,
  marginTop: 16,
  padding: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 18,
};

const resultIcon = {
  fontSize: 32,
  lineHeight: 1,
};

const resultTitle = {
  margin: 0,
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 900,
};

const resultDescription = {
  margin: "8px 0 0",
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.8,
};

const resultMeta = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
  marginTop: 12,
  color: "#334155",
  fontSize: 13,
  fontWeight: 800,
};
