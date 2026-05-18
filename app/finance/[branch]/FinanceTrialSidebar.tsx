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
      <div style={box}>
        <div style={boxTitle}>📅 التاريخ</div>
        <div style={dateText}>ميلادي: {today}</div>
        <div style={dateText}>هجري: {hijri}</div>
      </div>

      <div style={box}>
        <div style={boxTitle}>📢 إعلان إداري</div>

        <textarea
          style={textarea}
          placeholder="اكتب إعلانًا للموظفين..."
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
  width: 280,
  flexShrink: 0,
};

const box = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 16,
  marginBottom: 14,
  boxShadow: "0 10px 25px rgba(13,71,161,.06)",
};

const boxTitle = {
  fontWeight: "bold",
  color: "#0d47a1",
  marginBottom: 10,
  fontSize: 16,
};

const dateText = {
  color: "#334155",
  fontSize: 14,
  lineHeight: 1.8,
};

const textarea = {
  width: "100%",
  minHeight: 95,
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: 10,
  fontSize: 14,
  resize: "vertical" as const,
  marginBottom: 10,
};

const select = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: "1px solid #d9e3f5",
  marginBottom: 10,
};

const saveButton = {
  width: "100%",
  padding: 12,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 12,
  marginBottom: 8,
  cursor: "pointer",
};

const deleteButton = {
  width: "100%",
  padding: 12,
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
};

const logoutButton = {
  width: "100%",
  padding: 14,
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
};
