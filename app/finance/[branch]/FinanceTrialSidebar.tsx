"use client";

import { useEffect, useState } from "react";

export default function FinanceTrialSidebar() {
  const [today, setToday] = useState("");
  const [hijri, setHijri] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [userName, setUserName] = useState("عبدالله");

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

    const savedUserName =
      localStorage.getItem("employee_name") ||
      localStorage.getItem("user_name") ||
      localStorage.getItem("customer_name");

    if (savedUserName) setUserName(savedUserName);
  }, []);

  return (
    <aside style={sidebar}>
      <div style={userCard}>
        <div style={userTopRow}>
          <span style={onlineDot} />
          <span style={onlineText}>تم الدخول بنجاح</span>
        </div>

        <div style={userNameText}>المستخدم: {userName}</div>

        <button
          style={logoutButton}
          onClick={() => {
            localStorage.clear();
            window.location.href = "/";
          }}
        >
          تسجيل الخروج
        </button>
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

        <div style={announcementBox}>
          {announcement || "لا يوجد إعلان إداري حاليًا"}
        </div>
      </div>
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
  marginBottom: 12,
};

const logoutButton = {
  width: "fit-content",
  padding: "7px 12px",
  background: "#eef5ff",
  color: "#0d47a1",
  border: "1px solid #bfdbfe",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: "bold",
  cursor: "pointer",
};

const dateCard = {
  background:
    "linear-gradient(135deg, rgba(255,255,255,.92), rgba(239,246,255,.82))",
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

const announcementBox = {
  minHeight: 86,
  border: "1px solid #d9e3f5",
  background: "rgba(248,251,255,.9)",
  borderRadius: 16,
  padding: 12,
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.8,
  whiteSpace: "pre-wrap" as const,
};
