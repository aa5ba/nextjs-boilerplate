"use client";

import { useEffect, useState } from "react";

export default function FinanceTrialSidebar() {
  const [today, setToday] = useState("");
  const [hijri, setHijri] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [duration, setDuration] = useState("24h");
  const [userName, setUserName] = useState("محمد");

  useEffect(() => {
    const now = new Date();

    setToday(
      now.toLocaleDateString("ar-SA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );

    setHijri(
      now.toLocaleDateString("ar-SA-u-ca-islamic", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );

    const saved = localStorage.getItem("finance_trial_announcement");
    if (saved) setAnnouncement(saved);

    const savedUserName =
      localStorage.getItem("employee_name") ||
      localStorage.getItem("user_name") ||
      localStorage.getItem("customer_name");

    if (savedUserName) setUserName(savedUserName);
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
      <div style={userCard}>
        <div style={userTopRow}>
          <span style={onlineDot} />
          <span style={onlineText}>تم الدخول بنجاح</span>
        </div>

        <div style={userNameText}>المستخدم: {userName}</div>
      </div>

      <div style={dateCard}>
        <div style={dateLine}>{hijri}</div>
        <div style={dateLineMuted}>{today}</div>
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

const userCard = {
  background: "rgba(255,255,255,.9)",
  border: "1px solid rgba(217,227,245,.9)",
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 16px 38px rgba(15, 23, 42, .07)",
  backdropFilter: "blur(6px)",
};

const userTopRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 10,
};

const onlineDot = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow: "0 0 0 5px rgba(34,197,94,.12)",
};

const onlineText = {
  color: "#15803d",
  fontSize: 13,
  fontWeight: "bold",
};

const userNameText = {
  color: "#0f172a",
  fontSize: 15,
  fontWeight: "bold",
};

const dateCard = {
  background: "linear-gradient(135deg, rgba(255,255,255,.92), rgba(239,246,255,.82))",
  border: "1px solid rgba(191,219,254,.72)",
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 16px 38px rgba(15, 23, 42, .07)",
  backdropFilter: "blur(6px)",
};

const dateLine = {
  color: "#0d47a1",
  fontSize: 14,
  fontWeight: "bold",
  lineHeight: 1.8,
};

const dateLineMuted = {
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.8,
};

const announcementCard = {
  background: "rgba(255,255,255,.9)",
  border: "1px solid rgba(226,232,240,.9)",
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 16px 38px rgba(15, 23, 42, .07)",
  backdropFilter: "blur(6px)",
};

const sectionHead = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#0d47a1",
  fontSize: 16,
  marginBottom: 12,
};

const sectionIcon = {
  width: 32,
  height: 32,
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
  background: "rgba(248,251,255,.9)",
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
  background: "linear-gradient(135deg,#2563eb,#38bdf8)",
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
  background: "#fff7ed",
  color: "#c2410c",
  border: "1px solid #fed7aa",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: "bold",
  cursor: "pointer",
};

const logoutButton = {
  width: "100%",
  padding: 14,
  background: "linear-gradient(135deg,#e8f1ff,#dbeafe)",
  color: "#0d47a1",
  border: "1px solid #bfdbfe",
  borderRadius: 18,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 12px 28px rgba(37,99,235,.12)",
};
