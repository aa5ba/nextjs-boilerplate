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

  const totalPages = Math.max(1, Math.ceil(groups.length / ITEMS_PER_PAGE));

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return groups.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [groups, currentPage]);

  function go(path: string) {
    router.push(`/finance/${branch}/${path}`);
  }

  function openExternalVerification(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
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

  async function loadGroups() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setGroups([]);
      return;
    }

    const { data } = await supabase
      .from("finance_customer_groups")
      .select("*")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    setGroups(data || []);
    setCurrentPage(1);
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>العملاء</h1>
        </div>

        <section style={groupsSection}>
          {groups.length === 0 ? (
            <div style={emptyGroupCard}>لا توجد مجموعات عملاء حتى الآن</div>
          ) : (
            paginatedGroups.map((group) => (
              <button
                key={group.id}
                style={groupCard}
                onClick={() => go(`customers/groups/${group.id}`)}
              >
                {group.name}
              </button>
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
            onClick={() => {
              setShowVerificationModal(true);
              setVerificationNationalId("");
              setVerificationResult(null);
              setVerificationError("");
            }}
          >
            <span style={buttonContent}>
              <span style={buttonIcon}>🛡️</span>
              التحقق من العميل
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
              <h3 style={sectionTitle}>التحقق من أنشطة العميل السابقة</h3>

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
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
};

const groupsSection = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const groupCard = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  fontSize: 17,
  fontWeight: "bold",
  textAlign: "center" as const,
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
  padding: 16,
  background: "#16a34a",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(22,163,74,0.25)",
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

const sectionTitle = {
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
