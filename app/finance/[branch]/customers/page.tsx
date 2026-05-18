"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

export default function FinanceCustomersPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    loadGroups();
  }, [branch]);

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
            groups.map((group) => (
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

const backButton = {
  width: "100%",
  padding: 16,
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 18,
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
