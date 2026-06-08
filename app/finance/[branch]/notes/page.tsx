"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

type Note = {
  id: string;
  branch_id: string;
  user_id: string | null;
  title: string;
  note: string;
  note_date: string;
  status: string;
  note_type: string;
  visibility: string;
  reminder_date: string | null;
  created_by_name: string | null;
  created_at: string;
};

export default function FinanceNotesPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("مستخدم");
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<"private" | "branch">("private");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [reminderDate, setReminderDate] = useState("");

  useEffect(() => {
    initPage();
  }, [branch]);

  async function initPage() {
    setLoading(true);

    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    const { data } = await supabase.auth.getUser();
    const currentUserId = data.user?.id || "local-user";
    const currentUserName =
      data.user?.email ||
      localStorage.getItem("finance_user_name") ||
      "مستخدم";

    setUserId(currentUserId);
    setUserName(currentUserName);

    await loadNotes(currentBranchId, currentUserId);
    setLoading(false);
  }

  async function loadNotes(currentBranchId = branchId, currentUserId = userId) {
    if (!currentBranchId) return;

    const { data, error } = await supabase
      .from("finance_notes")
      .select("*")
      .eq("branch_id", currentBranchId)
      .or(`user_id.eq.${currentUserId},visibility.eq.branch`)
      .order("created_at", { ascending: false });

    if (error) {
      alert("تعذر تحميل الملاحظات: " + error.message);
      return;
    }

    setNotes(data || []);
  }

  async function saveNote() {
    if (!branchId || !userId) return;

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
      user_id: userId,
      title: title.trim(),
      note: note.trim(),
      note_type: noteType,
      visibility: activeTab,
      reminder_date: reminderDate ? reminderDate : null,
      created_by_name: userName,
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

  async function completeNote(id: string) {
    const { error } = await supabase
      .from("finance_notes")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      alert("تعذر إكمال الملاحظة: " + error.message);
      return;
    }

    await loadNotes();
  }

  async function deleteNote(id: string) {
    const confirmDelete = confirm("هل تريد حذف هذه الملاحظة؟");
    if (!confirmDelete) return;

    const { error } = await supabase.from("finance_notes").delete().eq("id", id);

    if (error) {
      alert("تعذر حذف الملاحظة: " + error.message);
      return;
    }

    await loadNotes();
  }

  function editNote(item: Note) {
    setEditingId(item.id);
    setTitle(item.title);
    setNote(item.note);
    setNoteType(item.note_type || "general");
    setReminderDate(item.reminder_date ? item.reminder_date.slice(0, 16) : "");
    setActiveTab(item.visibility === "branch" ? "branch" : "private");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setNote("");
    setNoteType("general");
    setReminderDate("");
  }

  const filteredNotes = useMemo(() => {
    return notes.filter((item) => {
      const sameTab =
        activeTab === "private"
          ? item.visibility === "private" && item.user_id === userId
          : item.visibility === "branch";

      const keyword = search.trim().toLowerCase();

      const matchesSearch =
        !keyword ||
        item.title?.toLowerCase().includes(keyword) ||
        item.note?.toLowerCase().includes(keyword) ||
        item.created_by_name?.toLowerCase().includes(keyword);

      return sameTab && matchesSearch;
    });
  }, [notes, activeTab, search, userId]);

  function typeLabel(type: string) {
    const labels: any = {
      general: "عامة",
      customer: "عميل",
      contract: "عقد",
      payment: "سداد",
      inventory: "مخزون",
    };
    return labels[type] || "عامة";
  }

  function typeIcon(type: string) {
    const icons: any = {
      general: "📌",
      customer: "👤",
      contract: "📄",
      payment: "💵",
      inventory: "📦",
    };
    return icons[type] || "📌";
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <div>
            <h1 style={{ margin: 0 }}>الملاحظات والتذكيرات</h1>
            <p style={{ margin: "10px 0 0", opacity: 0.9 }}>
              إدارة الملاحظات الشخصية وملاحظات الفرع بسهولة.
            </p>
          </div>
        </div>

        <section style={formCard}>
          <h2 style={sectionTitle}>
            {editingId ? "تعديل الملاحظة" : "إنشاء ملاحظة جديدة"}
          </h2>

          <div style={grid}>
            <div>
              <label style={label}>عنوان الملاحظة *</label>
              <input
                style={input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: متابعة عقد العميل"
              />
            </div>

            <div>
              <label style={label}>نوع الملاحظة</label>
              <select
                style={input}
                value={noteType}
                onChange={(e) => setNoteType(e.target.value)}
              >
                <option value="general">عامة</option>
                <option value="customer">عميل</option>
                <option value="contract">عقد</option>
                <option value="payment">سداد</option>
                <option value="inventory">مخزون</option>
              </select>
            </div>

            <div>
              <label style={label}>تاريخ التذكير</label>
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
              placeholder="اكتب تفاصيل الملاحظة هنا..."
            />
          </div>

          <div style={buttonsRow}>
            <button style={primaryButton} onClick={saveNote} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديل" : "حفظ الملاحظة"}
            </button>

            {editingId && (
              <button style={cancelButton} onClick={resetForm}>
                إلغاء التعديل
              </button>
            )}
          </div>
        </section>

        <section style={card}>
          <div style={tabs}>
            <button
              style={activeTab === "private" ? activeTabButton : tabButton}
              onClick={() => setActiveTab("private")}
            >
              👤 ملاحظاتي
            </button>

            <button
              style={activeTab === "branch" ? activeTabButton : tabButton}
              onClick={() => setActiveTab("branch")}
            >
              👥 ملاحظات الفرع
            </button>
          </div>

          <input
            style={searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الملاحظات..."
          />

          {loading ? (
            <div style={emptyBox}>جاري تحميل الملاحظات...</div>
          ) : filteredNotes.length === 0 ? (
            <div style={emptyBox}>لا توجد ملاحظات حتى الآن.</div>
          ) : (
            <div style={notesGrid}>
              {filteredNotes.map((item) => (
                <div
                  key={item.id}
                  style={{
                    ...noteCard,
                    ...(item.status === "completed" ? completedCard : {}),
                  }}
                >
                  <div style={noteTop}>
                    <span style={badge}>
                      {typeIcon(item.note_type)} {typeLabel(item.note_type)}
                    </span>

                    {item.status === "completed" && (
                      <span style={doneBadge}>✓ مكتملة</span>
                    )}
                  </div>

                  <h3 style={noteTitle}>{item.title}</h3>
                  <p style={noteText}>{item.note}</p>

                  <div style={meta}>
                    <span>📅 {item.note_date}</span>
                    {item.reminder_date && (
                      <span>
                        ⏰{" "}
                        {new Date(item.reminder_date).toLocaleString("ar-SA")}
                      </span>
                    )}
                    {item.visibility === "branch" && (
                      <span>👤 {item.created_by_name || "مستخدم"}</span>
                    )}
                  </div>

                  <div style={actionRow}>
                    <button style={smallButton} onClick={() => editNote(item)}>
                      ✏️ تعديل
                    </button>

                    {item.status !== "completed" && (
                      <button
                        style={completeButton}
                        onClick={() => completeNote(item.id)}
                      >
                        ✓ إكمال
                      </button>
                    )}

                    <button
                      style={deleteButton}
                      onClick={() => deleteNote(item.id)}
                    >
                      🗑️ حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#eef5ff",
  padding: 20,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container: React.CSSProperties = {
  width: "100%",
  maxWidth: 1150,
  margin: "auto",
};

const header: React.CSSProperties = {
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "white",
  padding: 28,
  borderRadius: 24,
  marginBottom: 18,
};

const formCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 20,
  padding: 20,
  marginBottom: 18,
  boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
};

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 10px 25px rgba(15,23,42,0.06)",
};

const sectionTitle: React.CSSProperties = {
  marginTop: 0,
  fontSize: 22,
  color: "#0d47a1",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const label: React.CSSProperties = {
  display: "block",
  marginBottom: 7,
  fontWeight: 700,
  color: "#334155",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 13,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  fontSize: 15,
  boxSizing: "border-box",
};

const textarea: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: 13,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  fontSize: 15,
  resize: "vertical",
  boxSizing: "border-box",
};

const buttonsRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 14,
  flexWrap: "wrap",
};

const primaryButton: React.CSSProperties = {
  padding: "14px 22px",
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
};

const cancelButton: React.CSSProperties = {
  padding: "14px 22px",
  background: "#64748b",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
};

const tabs: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginBottom: 14,
  flexWrap: "wrap",
};

const tabButton: React.CSSProperties = {
  flex: 1,
  padding: 14,
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #dbeafe",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
};

const activeTabButton: React.CSSProperties = {
  ...tabButton,
  background: "#0d47a1",
  color: "white",
};

const searchInput: React.CSSProperties = {
  ...input,
  marginBottom: 16,
};

const emptyBox: React.CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 22,
  marginTop: 12,
  textAlign: "center",
  color: "#6b7280",
};

const notesGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
};

const noteCard: React.CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 18,
  padding: 16,
  background: "#ffffff",
  boxShadow: "0 8px 18px rgba(15,23,42,0.05)",
};

const completedCard: React.CSSProperties = {
  background: "#f0fdf4",
  borderColor: "#bbf7d0",
};

const noteTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
};

const badge: React.CSSProperties = {
  background: "#eff6ff",
  color: "#0d47a1",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
};

const doneBadge: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
};

const noteTitle: React.CSSProperties = {
  margin: "14px 0 8px",
  color: "#0f172a",
  fontSize: 18,
};

const noteText: React.CSSProperties = {
  color: "#475569",
  lineHeight: 1.8,
  whiteSpace: "pre-wrap",
};

const meta: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#64748b",
  fontSize: 13,
  marginTop: 12,
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 14,
  flexWrap: "wrap",
};

const smallButton: React.CSSProperties = {
  padding: "9px 12px",
  background: "#e0f2fe",
  color: "#075985",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
};

const completeButton: React.CSSProperties = {
  padding: "9px 12px",
  background: "#dcfce7",
  color: "#166534",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
};

const deleteButton: React.CSSProperties = {
  padding: "9px 12px",
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
};

const backButton: React.CSSProperties = {
  width: "100%",
  padding: 16,
  background: "#16a34a",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  marginTop: 18,
  cursor: "pointer",
};
