"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function FinanceWorkflowPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    loadActivities();
  }, []);

  async function loadActivities() {
    const { data, error } = await supabase
      .from("finance_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.log(error);
      alert("خطأ في تحميل سير العمل: " + error.message);
      return;
    }

    setActivities(data || []);
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
      default:
        return "📌";
    }
  }

  function formatDate(date: string) {
    if (!date) return "-";

    return new Date(date).toLocaleString("ar-SA", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>سير العمل</h1>
        </div>

        <section style={card}>
          <h2 style={sectionTitle}>آخر العمليات</h2>

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
              activities.map((activity) => (
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
          </div>
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

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
};

const sectionTitle = {
  marginTop: 0,
  fontSize: 22,
  color: "#0d47a1",
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
