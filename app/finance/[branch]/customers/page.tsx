"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

export default function FinanceCustomersPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [groups, setGroups] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadGroups();
  }, [branch]);

  const totalPages = Math.max(1, Math.ceil(groups.length / ITEMS_PER_PAGE));

  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return groups.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [groups, currentPage]);

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
                onClick={() =>
                  (window.location.href = `/finance/${branch}/customers/groups/${group.id}`)
                }
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
          <button
            style={actionButton}
            onClick={() =>
              (window.location.href = `/finance/${branch}/customers/new`)
            }
          >
            <span style={buttonContent}>
              <span style={buttonIcon}>➕</span>
              إنشاء عميل جديد
            </span>
          </button>

          <button
            style={actionButton}
            onClick={() =>
              (window.location.href = `/finance/${branch}/customers/search`)
            }
          >
            <span style={buttonContent}>
              <span style={buttonIcon}>🔍</span>
              البحث عن عميل
            </span>
          </button>

          <button
            style={actionButton}
            onClick={() =>
              (window.location.href = `/finance/${branch}/customers/list`)
            }
          >
            <span style={buttonContent}>
              <span style={buttonIcon}>📋</span>
              قائمة العملاء
            </span>
          </button>

          <button
            style={actionButton}
            onClick={() =>
              (window.location.href = `/finance/${branch}/customers/groups`)
            }
          >
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
          onClick={() => (window.location.href = `/finance/${branch}`)}
        >
          الرجوع لمحطة العمل الرئيسية
        </button>
      </div>
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
