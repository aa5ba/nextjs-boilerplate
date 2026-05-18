"use client";

import { useEffect, useState } from "react";

export default function FinanceTrialSidebar() {
  const [today, setToday] = useState("");
  const [hijri, setHijri] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [duration, setDuration] = useState("24h");

  useEffect(() => {
    const now = new Date();

    setToday(
      now.toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );

    setHijri(
      now.toLocaleDateString("ar-SA-u-ca-islamic", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );

    const saved = localStorage.getItem("finance_trial_announcement");
    if (saved) setAnnouncement(saved);
  }, []);

  function saveAnnouncement() {
    localStorage.setItem("finance_trial_announcement", announcement);
    localStorage.setItem("finance_trial_announcement_duration", duration);
    alert("تم حفظ الإعلان الإداري تجريبيًا");
  }

  function deleteAnnouncement() {
    localStorage.removeItem("finance_trial_announcement");
    localStorage.removeItem("finance_trial_announcement_duration");
    setAnnouncement("");
    alert("تم حذف الإعلان");
  }

  return (
    <aside style={sidebar}>
      <div style={dateCard}>
        <div style={smallLabel}>اليوم</div>
        <div style={dateTitle}>📅 التاريخ</div>
        <div style={dateLine}>ميلادي: {today}</div>
        <div style={dateLine}>هجري: {hijri}</div>
      </div>

      <div style={announcementCard}>
        <div style={sectionHead}>
          <span style={sectionIcon}>📢</span>
          <strong>إعلان إداري</strong>
        </div>

        <textarea
          style={textarea}
          placeholder="اكتب إعلانًا مختصرًا للموظفين..."
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
        />

        <select
          style={select}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        >
          <option value="24h">24 ساعة</option>
          <option value="week">أسبوع</option>
          <option value="month">شهر</option>
          <option value="year">سنة</option>
        </select>

        <button style={saveButton} onClick={saveAnnouncement}>
          نشر الإعلان
        </button>

        <button style={deleteButton} onClick={deleteAnnouncement}>
          حذف الإعلان
        </button>
      </div>

      <button
        style={logoutButton}
        onClick={() => {
          localStorage.clear();
          window.location.href = "/";
        }}
      >
        تسجيل الخروج
      </button>
    </aside>
  );
}

const sidebar = {
  width: 285,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column" as const,
  gap: 14,
};

const dateCard = {
  background: "linear-gradient(135deg, rgba(255,255,255,.96), rgba(239,246,255,.92))",
  border: "1px solid rgba(191,219,254,.85)",
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 18px 45px rgba(15, 23, 42, .08)",
};

const smallLabel = {
  width: "fit-content",
  background: "#dbeafe",
  color: "#0d47a1",
  padding: "5px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: "bold",
  marginBottom: 10,
};

const dateTitle = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 10,
};

const dateLine = {
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.9,
};

const announcementCard = {
  background: "rgba(255,255,255,.94)",
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 18px 45px rgba(15, 23, 42, .08)",
};

const sectionHead = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#0d47a1",
  fontSize: 17,
  marginBottom: 12,
};

const sectionIcon = {
  width: 34,
  height: 34,
  borderRadius: 12,
  background: "#eef5ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const textarea = {
  width: "100%",
  minHeight: 105,
  border: "1px solid #d9e3f5",
  background: "#f8fbff",
  borderRadius: 16,
  padding: 12,
  fontSize: 14,
  resize: "vertical" as const,
  outline: "none",
  marginBottom: 10,
  fontFamily: "inherit",
};

const select = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  background: "white",
  marginBottom: 10,
  fontFamily: "inherit",
};

const saveButton = {
  width: "100%",
  padding: 13,
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: "bold",
  marginBottom: 8,
  cursor: "pointer",
};

const deleteButton = {
  width: "100%",
  padding: 12,
  background: "#fff1f2",
  color: "#be123c",
  border: "1px solid #fecdd3",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
};

const logoutButton = {
  width: "100%",
  padding: 15,
  background: "linear-gradient(135deg,#111827,#1f2937)",
  color: "white",
  border: "none",
  borderRadius: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 12px 30px rgba(17,24,39,.18)",
};
