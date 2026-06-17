"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

type Note = {
  id: string;
  branch_id: string;
  user_id: string | null;
  local_user_key: string | null;
  title: string;
  note: string;
  note_date: string;
  status: string;
  visibility: "private" | "branch";
  reminder_date: string | null;
  created_by_name: string | null;
  created_at: string;
};

type TabType = "branch" | "private";

export default function FinanceNotesPage() {
  const params = useParams();
  const router = useRouter();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [localUserKey, setLocalUserKey] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [employeeName, setEmployeeName] = useState("الموظف");

  const [activeTab, setActiveTab] = useState<TabType>("branch");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [reminderDate, setReminderDate] = useState("");

  useEffect(() => {
    initPage();
  }, [branch]);

  async function initPage() {
    setLoading(true);
    loadEmployeeName();

    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    let key = localStorage.getItem("finance_local_user_key");

    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem("finance_local_user_key", key);
    }

    setLocalUserKey(key);

    await loadNotes(currentBranchId, key);
    setLoading(false);
  }

  function loadEmployeeName() {
    if (typeof window === "undefined") return;

    const newName = localStorage.getItem("finance_user_name");

    if (newName) {
      setEmployeeName(newName);
      return;
    }

    const oldUser = localStorage.getItem("finance_user");

    if (oldUser) {
      try {
        const parsed = JSON.parse(oldUser);
        setEmployeeName(parsed?.full_name || parsed?.username || "الموظف");
      } catch {
        setEmployeeName("الموظف");
      }
    }
  }

  function logout() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finance_user");
      localStorage.removeItem("finance_user_name");
      localStorage.removeItem("finance_branch_user");
    }

    router.push(`/finance/${branch}/login`);
  }

  async function loadNotes(currentBranchId = branchId, currentKey = localUserKey) {
    if (!currentBranchId) return;

    const { data, error } = await supabase
      .from("finance_notes")
      .select("*")
      .eq("branch_id", currentBranchId)
      .or(`visibility.eq.branch,local_user_key.eq.${currentKey}`)
      .order("created_at", { ascending: false });

    if (error) {
      alert("تعذر تحميل الملاحظات: " + error.message);
      return;
    }

    setNotes((data || []) as Note[]);
  }

  async function saveNote() {
    if (!branchId || !localUserKey) return;

    if (!title.trim()) {
      alert("اكتب عنوان الملاحظة");
      return;
    }

    if (!note.trim()) {
      alert("اكتب نص الملاحظة");
      return;
    }

    setSaving(true);

    const payload = {
      branch_id: branchId,
      user_id: null,
      local_user_key: activeTab === "private" ? localUserKey : null,
      title: title.trim(),
      note: note.trim(),
      visibility: activeTab,
      reminder_date: reminderDate ? reminderDate : null,
      created_by_name: "مستخدم",
      status: "active",
      note_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase.from("finance_notes").update(payload).eq("id", editingId)
      : await supabase.from("finance_notes").insert(payload);

    setSaving(false);

    if (result.error) {
      alert("تعذر حفظ الملاحظة: " + result.error.message);
      return;
    }

    resetForm();
    await loadNotes();
  }

  async function deleteNote(id: string) {
    if (!confirm("هل تريد حذف هذه الملاحظة؟")) return;

    const { error } = await supabase.from("finance_notes").delete().eq("id", id);

    if (error) {
      alert("تعذر حذف الملاحظة: " + error.message);
      return;
    }

    await loadNotes();
  }

  async function completeNote(id: string) {
    const { error } = await supabase
      .from("finance_notes")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      alert("تعذر تحديث الملاحظة: " + error.message);
      return;
    }

    await loadNotes();
  }

  function editNote(item: Note) {
    setEditingId(item.id);
    setTitle(item.title);
    setNote(item.note);
    setReminderDate(item.reminder_date ? item.reminder_date.slice(0, 16) : "");
    setActiveTab(item.visibility);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setNote("");
    setReminderDate("");
    setShowForm(false);
  }

  const filteredNotes = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return notes.filter((item) => {
      const sameTab =
        activeTab === "branch"
          ? item.visibility === "branch"
          : item.visibility === "private" &&
            item.local_user_key === localUserKey;

      const matchSearch =
        !keyword ||
        item.title?.toLowerCase().includes(keyword) ||
        item.note?.toLowerCase().includes(keyword);

      return sameTab && matchSearch;
    });
  }, [notes, activeTab, search, localUserKey]);

  const branchCount = notes.filter((n) => n.visibility === "branch").length;
  const privateCount = notes.filter(
    (n) => n.visibility === "private" && n.local_user_key === localUserKey
  ).length;

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <section style={hero}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={heroContent}>
            <div style={heroUserCard}>
              <div style={employeeTopRow}>
                <div style={employeeIcon}>
                  <UserIcon />
                </div>

                <div style={employeeNameStyle}>{employeeName}</div>

                <div style={employeeDividerSmall} />

                <button style={logoutInlineButton} onClick={logout}>
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                style={mainWorkstationButton}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={heroTitleBox}>
              <h1 style={titleStyle}>الملاحظات</h1>
              <p style={subtitle}>
                ملاحظات عامة للجميع، وملاحظات خاصة تظهر لك فقط.
              </p>
            </div>

            <div style={heroActionBox}>
              <button
                style={addButton}
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                + إضافة ملاحظة
              </button>
            </div>
          </div>
        </section>

        <section style={tabsCard}>
          <button
            style={activeTab === "branch" ? activeTabBtn : tabBtn}
            onClick={() => {
              setActiveTab("branch");
              resetForm();
            }}
          >
            <span>ملاحظات عامة</span>
            <strong>{branchCount}</strong>
          </button>

          <button
            style={activeTab === "private" ? activeTabBtn : tabBtn}
            onClick={() => {
              setActiveTab("private");
              resetForm();
            }}
          >
            <span>ملاحظات خاصة</span>
            <strong>{privateCount}</strong>
          </button>
        </section>

        {showForm && (
          <section style={formCard}>
            <div style={formHeader}>
              <h2 style={formTitle}>
                {editingId ? "تعديل الملاحظة" : "ملاحظة جديدة"}
              </h2>
              <button style={closeBtn} onClick={resetForm}>
                إغلاق
              </button>
            </div>

            <div style={formGrid}>
              <div>
                <label style={label}>عنوان الملاحظة *</label>
                <input
                  style={input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: متابعة عقد"
                />
              </div>

              <div>
                <label style={label}>نوع الملاحظة</label>
                <select
                  style={input}
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as TabType)}
                >
                  <option value="branch">ملاحظة عامة للجميع</option>
                  <option value="private">ملاحظة خاصة بي</option>
                </select>
              </div>

              <div>
                <label style={label}>تاريخ التذكير اختياري</label>
                <input
                  style={input}
                  type="datetime-local"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={label}>نص الملاحظة *</label>
              <textarea
                style={textarea}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="اكتب التفاصيل هنا..."
              />
            </div>

            <button style={saveButton} onClick={saveNote} disabled={saving}>
              {saving
                ? "جاري الحفظ..."
                : editingId
                ? "حفظ التعديل"
                : "حفظ الملاحظة"}
            </button>
          </section>
        )}

        <section style={contentCard}>
          <div style={toolsRow}>
            <h2 style={listTitle}>
              {activeTab === "branch" ? "الملاحظات العامة" : "ملاحظاتي الخاصة"}
            </h2>

            <input
              style={searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث..."
            />
          </div>

          {loading ? (
            <div style={emptyBox}>جاري تحميل الملاحظات...</div>
          ) : filteredNotes.length === 0 ? (
            <div style={emptyBox}>لا توجد ملاحظات في هذا القسم.</div>
          ) : (
            <div style={notesList}>
              {filteredNotes.map((item) => (
                <article
                  key={item.id}
                  style={{
                    ...noteCard,
                    ...(item.status === "completed" ? completedCard : {}),
                  }}
                >
                  <div style={noteHeader}>
                    <div>
                      <h3 style={noteTitle}>{item.title}</h3>
                      <div style={dateLine}>
                        <span>📅 {formatDate(item.note_date)}</span>
                        {item.reminder_date && (
                          <span>⏰ {formatDateTime(item.reminder_date)}</span>
                        )}
                      </div>
                    </div>

                    <span
                      style={
                        item.visibility === "branch"
                          ? publicBadge
                          : privateBadge
                      }
                    >
                      {item.visibility === "branch" ? "عام" : "خاص"}
                    </span>
                  </div>

                  <p style={noteText}>{item.note}</p>

                  <div style={actions}>
                    <button style={editBtn} onClick={() => editNote(item)}>
                      تعديل
                    </button>

                    {item.status !== "completed" && (
                      <button
                        style={doneBtn}
                        onClick={() => completeNote(item.id)}
                      >
                        تم
                      </button>
                    )}

                    <button style={deleteBtn} onClick={() => deleteNote(item.id)}>
                      حذف
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div style={backWrapper}>
          <button
            style={backButton}
            onClick={() => router.push(`/finance/${branch}`)}
          >
            ← الرجوع للرئيسية
          </button>
        </div>
      </div>
    </main>
  );
}

function formatDate(date: string) {
  if (!date) return "-";

  const d = new Date(date);

  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatDateTime(date: string) {
  if (!date) return "-";

  const d = new Date(date);

  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.8 20.2c.8-3.5 3.6-5.4 7.2-5.4s6.4 1.9 7.2 5.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.5 7V5.8c0-1 .8-1.8 1.8-1.8h6.1c1 0 1.8.8 1.8 1.8v12.4c0 1-.8 1.8-1.8 1.8h-6.1c-1 0-1.8-.8-1.8-1.8V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4.8 12h9.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M7.8 8.8 4.6 12l3.2 3.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.8 11.2 12 4.5l8.2 6.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 10.4v9.1h11.6v-9.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M10 19.5v-5.2h4v5.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f6f9ff",
  backgroundImage: `
    radial-gradient(circle at 12% 18%, rgba(59,130,246,0.16) 0, transparent 28%),
    radial-gradient(circle at 88% 12%, rgba(168,85,247,0.10) 0, transparent 25%),
    radial-gradient(circle at 80% 88%, rgba(34,197,94,0.10) 0, transparent 28%),
    linear-gradient(rgba(246,249,255,0.72),rgba(246,249,255,0.82)),
    url('/backgrounds/v13-finance-bg-1.png')
  `,
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 1100,
  margin: "auto",
};

const hero: React.CSSProperties = {
  position: "relative",
  minHeight: 160,
  borderRadius: 24,
  padding: "22px 26px",
  marginBottom: 14,
  overflow: "hidden",
  border: "none",
  outline: "none",
  background:
    "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
  boxShadow: "none",
  isolation: "isolate",
};

const heroContent: React.CSSProperties = {
  position: "relative",
  zIndex: 3,
  minHeight: 116,
  display: "grid",
  gridTemplateColumns: "330px 1fr 330px",
  alignItems: "center",
  gap: 16,
  direction: "ltr",
};

const heroUserCard: React.CSSProperties = {
  width: 330,
  display: "grid",
  gap: 26,
  direction: "ltr",
  justifySelf: "start",
};

const employeeTopRow: React.CSSProperties = {
  height: 42,
  display: "flex",
  alignItems: "center",
  gap: 14,
  direction: "ltr",
  color: "#ffffff",
};

const employeeIcon: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "1.5px solid rgba(255,255,255,0.34)",
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.96)",
  flex: "0 0 auto",
};

const employeeNameStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 17,
  fontWeight: 900,
  whiteSpace: "nowrap",
  direction: "rtl",
  textShadow: "0 4px 10px rgba(15,23,42,0.18)",
};

const employeeDividerSmall: React.CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
  flex: "0 0 auto",
};

const logoutInlineButton: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.90)",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
  padding: 0,
  whiteSpace: "nowrap",
  direction: "rtl",
};

const mainWorkstationButton: React.CSSProperties = {
  width: 245,
  height: 50,
  border: "none",
  background: "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
  color: "#ffffff",
  borderRadius: 999,
  padding: "0 24px",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily: "var(--font-almarai), sans-serif",
  boxShadow: "0 8px 18px rgba(22,163,74,0.20)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 11,
  whiteSpace: "nowrap",
  direction: "rtl",
};

const heroTitleBox: React.CSSProperties = {
  position: "relative",
  zIndex: 4,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  direction: "rtl",
  pointerEvents: "none",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 35,
  lineHeight: 1.35,
  fontWeight: 900,
  letterSpacing: "-0.6px",
  textShadow: "0 5px 14px rgba(15,23,42,0.14)",
  whiteSpace: "nowrap",
};

const subtitle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "rgba(255,255,255,0.86)",
  lineHeight: 1.7,
  fontWeight: 700,
};

const heroActionBox: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  direction: "rtl",
};

const addButton: React.CSSProperties = {
  background: "white",
  color: "#0f172a",
  border: "none",
  borderRadius: 14,
  padding: "14px 18px",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
};

const heroCircleOne: React.CSSProperties = {
  position: "absolute",
  width: 210,
  height: 210,
  right: -78,
  top: -85,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.075)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleTwo: React.CSSProperties = {
  position: "absolute",
  width: 245,
  height: 245,
  right: 145,
  bottom: -178,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.045)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroCircleThree: React.CSSProperties = {
  position: "absolute",
  width: 150,
  height: 150,
  left: 380,
  top: -96,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.035)",
  pointerEvents: "none",
  zIndex: 1,
};

const heroDots: React.CSSProperties = {
  position: "absolute",
  top: 28,
  right: 34,
  width: 84,
  height: 58,
  opacity: 0.24,
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const tabsCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 8,
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: 8,
  marginBottom: 14,
};

const tabBtn: React.CSSProperties = {
  border: "none",
  background: "#f8fafc",
  color: "#334155",
  borderRadius: 14,
  padding: 14,
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const activeTabBtn: React.CSSProperties = {
  ...tabBtn,
  background: "#2563eb",
  color: "white",
};

const formCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #dbeafe",
  borderRadius: 20,
  padding: 18,
  marginBottom: 14,
  boxShadow: "0 12px 30px rgba(15,23,42,0.07)",
};

const formHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
};

const formTitle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 22,
};

const closeBtn: React.CSSProperties = {
  border: "none",
  background: "#f1f5f9",
  color: "#334155",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#334155",
  fontWeight: 800,
};

const input: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: 13,
  padding: 13,
  fontSize: 15,
  boxSizing: "border-box",
  background: "white",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: 120,
  resize: "vertical",
  lineHeight: 1.8,
};

const saveButton: React.CSSProperties = {
  width: "100%",
  marginTop: 14,
  border: "none",
  background: "#2563eb",
  color: "white",
  borderRadius: 14,
  padding: 15,
  fontSize: 17,
  fontWeight: 800,
  cursor: "pointer",
};

const contentCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
};

const toolsRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 14,
};

const listTitle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 22,
};

const searchInput: React.CSSProperties = {
  ...input,
  maxWidth: 320,
};

const notesList: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
};

const noteCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 8px 18px rgba(15,23,42,0.04)",
};

const completedCard: React.CSSProperties = {
  background: "#f0fdf4",
  borderColor: "#bbf7d0",
};

const noteHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const noteTitle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 18,
};

const dateLine: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  marginTop: 8,
  color: "#64748b",
  fontSize: 13,
};

const publicBadge: React.CSSProperties = {
  background: "#dbeafe",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 13,
  fontWeight: 800,
};

const privateBadge: React.CSSProperties = {
  background: "#fef3c7",
  color: "#92400e",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 13,
  fontWeight: 800,
};

const noteText: React.CSSProperties = {
  color: "#334155",
  lineHeight: 1.9,
  whiteSpace: "pre-wrap",
  marginTop: 14,
};

const actions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 14,
};

const editBtn: React.CSSProperties = {
  border: "none",
  background: "#e0f2fe",
  color: "#075985",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
};

const doneBtn: React.CSSProperties = {
  border: "none",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
};

const deleteBtn: React.CSSProperties = {
  border: "none",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
};

const emptyBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  color: "#64748b",
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
};

const backWrapper: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: React.CSSProperties = {
  padding: "11px 18px",
  background: "linear-gradient(135deg,#64748b,#334155)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(51,65,85,0.22)",
};
