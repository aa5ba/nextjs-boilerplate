"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const ITEMS_PER_PAGE = 25;

export default function FinanceWorkflowPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [activities, setActivities] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadActivities();
  }, [branch]);

  const totalPages = Math.max(1, Math.ceil(activities.length / ITEMS_PER_PAGE));

  const paginatedActivities = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return activities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [activities, currentPage]);

  async function loadActivities() {
    const branchId = await getBranchId(branch);

    if (!branchId) {
      setActivities([]);
      return;
    }

    const { data, error } = await supabase
      .from("finance_activity_logs")
      .select("*")
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      alert("خطأ في تحميل سير العمل: " + error.message);
      return;
    }

    setActivities(data || []);
    setCurrentPage(1);
  }

  function getIcon(type: string) {
    switch (type) {
      case "إنشاء عقد":
        return "📄";
      case "سداد":
        return "💳";
      case "إلغاء دفعة":
        return "⛔";
      case "إنشاء عميل":
        return "👤";
      case "إنشاء سند":
        return "🧾";
      case "تعديل عقد":
        return "✏️";
      case "إغلاق عقد":
        return "🔒";
      default:
        return "📌";
    }
  }

  function formatDate(date: string) {
  if (!date) return "-";

  return new Date(date).toLocaleString(
    "en-GB",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>سير العمل</h1>
        </div>

        <section style={card}>
          <div style={listHeader}>
            <h2 style={sectionTitle}>آخر العمليات</h2>

            {activities.length > 0 && (
              <span style={pageInfo}>
                صفحة {currentPage} من {totalPages} - عرض{" "}
                {paginatedActivities.length} من {activities.length}
              </span>
            )}
          </div>

          <div style={tableBox}>
            <div style={tableHeader}>
              <span>العملية</span>
              <span>العميل</span>
              <span>الحالة</span>
              <span>الموظف</span>
              <span>التاريخ والوقت</span>
            </div>

            {activities.length === 0 ? (
              <div style={emptyBox}>لا توجد عمليات مسجلة حتى الآن.</div>
            ) : (
              paginatedActivities.map((activity) => (
                <div key={activity.id} style={tableRow}>
                  <span>
                    {getIcon(activity.activity_type)} {activity.activity_type}
                  </span>

                  <span>{activity.customer_name || "-"}</span>
                  <span>{activity.status || "-"}</span>
                  <span>{activity.employee_name || "-"}</span>
                  <span>{formatDate(activity.created_at)}</span>
                </div>
              ))
            )}

            {activities.length > ITEMS_PER_PAGE && (
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
          </div>
        </section>

        <div
  style={{
    display: "flex",
    justifyContent: "center",
    marginTop: 18,
  }}
>
  <button
    style={backButton}
    onClick={() => (window.location.href = `/finance/${branch}`)}
  >
    ← الرجوع
  </button>
</div>
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

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
};

const listHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const sectionTitle = {
  margin: 0,
  fontSize: 22,
  color: "#0d47a1",
};

const pageInfo = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: "bold",
};

const tableBox = {
  width: "100%",
  overflowX: "auto" as const,
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "220px 180px 120px 120px 190px",
  gap: 12,
  background: "#f4f8ff",
  color: "#0d47a1",
  fontWeight: "bold",
  padding: 14,
  borderRadius: 12,
  minWidth: 890,
  marginBottom: 10,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "220px 180px 120px 120px 190px",
  gap: 12,
  minWidth: 890,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
};

const emptyBox = {
  minWidth: 890,
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  marginTop: 12,
  textAlign: "center" as const,
  color: "#6b7280",
};

const paginationBox = {
  minWidth: 890,
  marginTop: 18,
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
