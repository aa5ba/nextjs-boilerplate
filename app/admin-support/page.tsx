"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const SUPPORT_PERMISSIONS = [
  { key: "manage_branches", label: "إدارة الفروع" },
  { key: "manage_support_users", label: "إدارة مستخدمي الدعم" },
  { key: "system_settings", label: "إعدادات النظام" },
  { key: "impersonate_branch", label: "الدخول للفروع" },
  { key: "view_logs", label: "عرض السجلات" },
  { key: "backup_restore", label: "النسخ والاستعادة" },
];

type Branch = {
  id: string;
  branch_name: string;
  branch_slug: string;
  organization_name: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

type SupportUser = {
  id: string;
  full_name: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
  permissions?: string[];
};

export default function AdminSupportPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [supportUsers, setSupportUsers] = useState<SupportUser[]>([]);
  const [activeTab, setActiveTab] = useState<"branches" | "users">("branches");
  const [loading, setLoading] = useState(true);

  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchSlug, setBranchSlug] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [branchNotes, setBranchNotes] = useState("");

  const [showUserForm, setShowUserForm] = useState(false);
  const [supportFullName, setSupportFullName] = useState("");
  const [supportUsername, setSupportUsername] = useState("");
  const [supportPassword, setSupportPassword] = useState("");
  const [supportRole, setSupportRole] = useState("support");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("admin_support_user")
        : null;

    if (!saved) {
      window.location.href = "/admin-support/login";
      return;
    }

    const parsed = JSON.parse(saved);
    setCurrentUser(parsed);
    loadData();
  }, []);

  function hasPermission(key: string) {
    return (
      currentUser?.role === "super_admin" ||
      currentUser?.permissions?.includes(key)
    );
  }

  async function loadData() {
    setLoading(true);
    await Promise.all([loadBranches(), loadSupportUsers()]);
    setLoading(false);
  }

  async function loadBranches() {
    const { data, error } = await supabase
      .from("finance_branches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("تعذر تحميل الفروع: " + error.message);
      return;
    }

    setBranches(data || []);
  }

  async function loadSupportUsers() {
    const { data: users, error } = await supabase
      .from("admin_support_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert("تعذر تحميل مستخدمي الدعم: " + error.message);
      return;
    }

    const { data: perms } = await supabase
      .from("admin_support_user_permissions")
      .select("user_id, permission_key");

    const merged =
      users?.map((user: any) => ({
        ...user,
        permissions:
          perms
            ?.filter((p: any) => p.user_id === user.id)
            .map((p: any) => p.permission_key) || [],
      })) || [];

    setSupportUsers(merged);
  }

  async function saveBranch() {
    if (!hasPermission("manage_branches")) {
      alert("لا تملك صلاحية إدارة الفروع");
      return;
    }

    if (!branchName.trim()) return alert("اكتب اسم الفرع");
    if (!branchSlug.trim()) return alert("اكتب رابط الفرع");
    if (!organizationName.trim()) return alert("اكتب اسم المنظمة");

    const payload = {
      branch_name: branchName.trim(),
      branch_slug: branchSlug.trim().toLowerCase(),
      organization_name: organizationName.trim(),
      notes: branchNotes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = editingBranchId
      ? await supabase
          .from("finance_branches")
          .update(payload)
          .eq("id", editingBranchId)
      : await supabase.from("finance_branches").insert({
          ...payload,
          is_active: true,
        });

    if (result.error) {
      alert("تعذر حفظ الفرع: " + result.error.message);
      return;
    }

    resetBranchForm();
    await loadBranches();
  }

  async function toggleBranch(branch: Branch) {
    if (!hasPermission("manage_branches")) return alert("لا تملك الصلاحية");

    const { error } = await supabase
      .from("finance_branches")
      .update({
        is_active: !branch.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", branch.id);

    if (error) {
      alert("تعذر تعديل حالة الفرع: " + error.message);
      return;
    }

    await loadBranches();
  }

  function editBranch(branch: Branch) {
    setEditingBranchId(branch.id);
    setBranchName(branch.branch_name || "");
    setBranchSlug(branch.branch_slug || "");
    setOrganizationName(branch.organization_name || "");
    setBranchNotes(branch.notes || "");
    setShowBranchForm(true);
  }

  function resetBranchForm() {
    setEditingBranchId(null);
    setBranchName("");
    setBranchSlug("");
    setOrganizationName("");
    setBranchNotes("");
    setShowBranchForm(false);
  }

  async function createSupportUser() {
    if (!hasPermission("manage_support_users")) {
      alert("لا تملك صلاحية إدارة مستخدمي الدعم");
      return;
    }

    if (!supportFullName.trim()) return alert("اكتب الاسم");
    if (!supportUsername.trim()) return alert("اكتب اسم المستخدم");
    if (!supportPassword.trim()) return alert("اكتب كلمة المرور");

    const { error } = await supabase.rpc("create_admin_support_user", {
      p_full_name: supportFullName.trim(),
      p_username: supportUsername.trim(),
      p_password: supportPassword.trim(),
      p_role: supportRole,
      p_permissions: selectedPermissions,
    });

    if (error) {
      alert("تعذر إنشاء المستخدم: " + error.message);
      return;
    }

    resetUserForm();
    await loadSupportUsers();
  }

  async function toggleSupportUser(user: SupportUser) {
    if (!hasPermission("manage_support_users")) return alert("لا تملك الصلاحية");

    const { error } = await supabase
      .from("admin_support_users")
      .update({
        is_active: !user.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      alert("تعذر تعديل المستخدم: " + error.message);
      return;
    }

    await loadSupportUsers();
  }

  function resetUserForm() {
    setSupportFullName("");
    setSupportUsername("");
    setSupportPassword("");
    setSupportRole("support");
    setSelectedPermissions([]);
    setShowUserForm(false);
  }

  function logout() {
    localStorage.removeItem("admin_support_user");
    window.location.href = "/admin-support/login";
  }

  const activeBranches = useMemo(
    () => branches.filter((b) => b.is_active).length,
    [branches]
  );

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <section style={hero}>
          <h1 style={heroTitle}>جاري تحميل لوحة الدعم الفني...</h1>
        </section>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <section style={hero}>
          <div>
            <h1 style={heroTitle}>لوحة الدعم الفني</h1>
            <p style={heroSub}>إدارة الفروع ومستخدمي الدعم الفني</p>
          </div>

          <button style={logoutButton} onClick={logout}>
            تسجيل خروج
          </button>
        </section>

        <section style={statsGrid}>
          <Stat title="الفروع" value={branches.length} />
          <Stat title="الفروع النشطة" value={activeBranches} />
          <Stat title="مستخدمي الدعم" value={supportUsers.length} />
        </section>

        <section style={tabsCard}>
          <button
            style={activeTab === "branches" ? activeTabButton : tabButton}
            onClick={() => setActiveTab("branches")}
          >
            الفروع
          </button>

          <button
            style={activeTab === "users" ? activeTabButton : tabButton}
            onClick={() => setActiveTab("users")}
          >
            مستخدمو الدعم
          </button>
        </section>

        {activeTab === "branches" && (
          <>
            <div style={actionBar}>
              <button
                style={primaryButton}
                onClick={() => {
                  resetBranchForm();
                  setShowBranchForm(true);
                }}
              >
                + إضافة فرع
              </button>
            </div>

            {showBranchForm && (
              <section style={formCard}>
                <h2 style={formTitle}>
                  {editingBranchId ? "تعديل فرع" : "إضافة فرع جديد"}
                </h2>

                <div style={formGrid}>
                  <div>
                    <label style={label}>اسم الفرع</label>
                    <input
                      style={input}
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="مثال: فرع الرياض"
                    />
                  </div>

                  <div>
                    <label style={label}>رابط الفرع</label>
                    <input
                      style={input}
                      value={branchSlug}
                      onChange={(e) => setBranchSlug(e.target.value)}
                      placeholder="مثال: riyadh"
                    />
                  </div>

                  <div>
                    <label style={label}>اسم المنظمة</label>
                    <input
                      style={input}
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      placeholder="مثال: مؤسسة سداد وأرقام"
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={label}>ملاحظات</label>
                  <textarea
                    style={textarea}
                    value={branchNotes}
                    onChange={(e) => setBranchNotes(e.target.value)}
                    placeholder="ملاحظات داخلية للدعم الفني"
                  />
                </div>

                <div style={buttonsRow}>
                  <button style={primaryButton} onClick={saveBranch}>
                    حفظ
                  </button>
                  <button style={secondaryButton} onClick={resetBranchForm}>
                    إلغاء
                  </button>
                </div>
              </section>
            )}

            <section style={card}>
              <div style={listGrid}>
                {branches.map((branch) => (
                  <article key={branch.id} style={branchCard}>
                    <div>
                      <h3 style={cardTitle}>{branch.branch_name}</h3>
                      <p style={muted}>🏢 {branch.organization_name}</p>
                      <p style={muted}>🔗 /finance/{branch.branch_slug}</p>
                    </div>

                    <span
                      style={branch.is_active ? activeBadge : inactiveBadge}
                    >
                      {branch.is_active ? "نشط" : "معطل"}
                    </span>

                    <div style={buttonsRow}>
                      {hasPermission("impersonate_branch") && (
                        <button
                          style={smallBlueButton}
                          onClick={() =>
                            (window.location.href = `/finance/${branch.branch_slug}`)
                          }
                        >
                          دخول الفرع
                        </button>
                      )}

                      <button
                        style={smallButton}
                        onClick={() => editBranch(branch)}
                      >
                        تعديل
                      </button>

                      <button
                        style={
                          branch.is_active ? smallDangerButton : smallGreenButton
                        }
                        onClick={() => toggleBranch(branch)}
                      >
                        {branch.is_active ? "تعطيل" : "تفعيل"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "users" && (
          <>
            <div style={actionBar}>
              <button
                style={primaryButton}
                onClick={() => setShowUserForm(true)}
              >
                + إضافة مستخدم دعم
              </button>
            </div>

            {showUserForm && (
              <section style={formCard}>
                <h2 style={formTitle}>إضافة مستخدم دعم فني</h2>

                <div style={formGrid}>
                  <div>
                    <label style={label}>الاسم</label>
                    <input
                      style={input}
                      value={supportFullName}
                      onChange={(e) => setSupportFullName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={label}>اسم المستخدم</label>
                    <input
                      style={input}
                      value={supportUsername}
                      onChange={(e) => setSupportUsername(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={label}>كلمة المرور</label>
                    <input
                      style={input}
                      type="password"
                      value={supportPassword}
                      onChange={(e) => setSupportPassword(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={label}>الدور</label>
                    <select
                      style={input}
                      value={supportRole}
                      onChange={(e) => setSupportRole(e.target.value)}
                    >
                      <option value="support">دعم فني</option>
                      <option value="viewer">مشاهدة فقط</option>
                      <option value="super_admin">مدير النظام</option>
                    </select>
                  </div>
                </div>

                <div style={permissionsBox}>
                  {SUPPORT_PERMISSIONS.map((p) => (
                    <label key={p.key} style={permissionItem}>
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(p.key)}
                        onChange={(e) => {
                          setSelectedPermissions((prev) =>
                            e.target.checked
                              ? [...prev, p.key]
                              : prev.filter((x) => x !== p.key)
                          );
                        }}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>

                <div style={buttonsRow}>
                  <button style={primaryButton} onClick={createSupportUser}>
                    حفظ المستخدم
                  </button>
                  <button style={secondaryButton} onClick={resetUserForm}>
                    إلغاء
                  </button>
                </div>
              </section>
            )}

            <section style={card}>
              <div style={listGrid}>
                {supportUsers.map((user) => (
                  <article key={user.id} style={branchCard}>
                    <div>
                      <h3 style={cardTitle}>{user.full_name}</h3>
                      <p style={muted}>👤 {user.username}</p>
                      <p style={muted}>🔐 {user.role}</p>
                    </div>

                    <span style={user.is_active ? activeBadge : inactiveBadge}>
                      {user.is_active ? "نشط" : "معطل"}
                    </span>

                    <div style={permissionsTags}>
                      {user.permissions?.map((p) => (
                        <span key={p} style={permissionTag}>
                          {p}
                        </span>
                      ))}
                    </div>

                    <div style={buttonsRow}>
                      <button
                        style={user.is_active ? smallDangerButton : smallGreenButton}
                        onClick={() => toggleSupportUser(user)}
                      >
                        {user.is_active ? "تعطيل" : "تفعيل"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div style={statCard}>
      <span style={statValue}>{value}</span>
      <span style={statTitle}>{title}</span>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f4f7fb",
  backgroundImage:
    "linear-gradient(rgba(244,247,251,0.72), rgba(244,247,251,0.72)), url('/backgrounds/finance-bg.webp')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "fixed",
  padding: 18,
  fontFamily: "var(--font-almarai), sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: 1200,
  margin: "auto",
};

const hero: React.CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  borderRadius: 24,
  padding: 24,
  marginBottom: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 32,
};

const heroSub: React.CSSProperties = {
  margin: "8px 0 0",
  opacity: 0.9,
};

const logoutButton: React.CSSProperties = {
  background: "white",
  color: "#0f172a",
  border: "none",
  borderRadius: 14,
  padding: "12px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.94)",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 18,
  display: "grid",
  gap: 6,
};

const statValue: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#2563eb",
};

const statTitle: React.CSSProperties = {
  color: "#475569",
  fontWeight: 800,
};

const tabsCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 8,
  display: "grid",
  gridTemplateColumns: "repeat(2,1fr)",
  gap: 8,
  marginBottom: 14,
};

const tabButton: React.CSSProperties = {
  border: "none",
  background: "#f8fafc",
  color: "#334155",
  borderRadius: 14,
  padding: 14,
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
};

const activeTabButton: React.CSSProperties = {
  ...tabButton,
  background: "#2563eb",
  color: "white",
};

const actionBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
  marginBottom: 14,
};

const primaryButton: React.CSSProperties = {
  border: "none",
  background: "#2563eb",
  color: "white",
  borderRadius: 14,
  padding: "13px 18px",
  fontSize: 16,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "#64748b",
};

const formCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 18,
  marginBottom: 14,
};

const formTitle: React.CSSProperties = {
  marginTop: 0,
  color: "#0f172a",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
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
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 13,
  padding: 13,
  fontSize: 15,
  background: "#f8fafc",
};

const textarea: React.CSSProperties = {
  ...input,
  minHeight: 90,
  resize: "vertical",
};

const buttonsRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.94)",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 16,
};

const listGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
  gap: 12,
};

const branchCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 16,
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 18,
};

const muted: React.CSSProperties = {
  color: "#64748b",
  margin: "8px 0",
};

const activeBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 800,
};

const inactiveBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 800,
};

const smallButton: React.CSSProperties = {
  border: "none",
  background: "#e0f2fe",
  color: "#075985",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
};

const smallBlueButton: React.CSSProperties = {
  ...smallButton,
  background: "#dbeafe",
  color: "#1d4ed8",
};

const smallGreenButton: React.CSSProperties = {
  ...smallButton,
  background: "#dcfce7",
  color: "#166534",
};

const smallDangerButton: React.CSSProperties = {
  ...smallButton,
  background: "#fee2e2",
  color: "#991b1b",
};

const permissionsBox: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
};

const permissionItem: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 700,
};

const permissionsTags: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 10,
};

const permissionTag: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 12,
};
