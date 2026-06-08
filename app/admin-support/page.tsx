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

type SupportLog = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: string | null;
  created_at: string;
};

type TabType = "overview" | "branches" | "users" | "logs";

export default function AdminSupportPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [supportUsers, setSupportUsers] = useState<SupportUser[]>([]);
  const [logs, setLogs] = useState<SupportLog[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
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
    loadData(parsed);
  }, []);

  function hasPermission(key: string) {
    return (
      currentUser?.role === "super_admin" ||
      currentUser?.permissions?.includes(key)
    );
  }

  async function addLog(
    action: string,
    targetType?: string,
    targetId?: string,
    details?: string
  ) {
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("admin_support_user")
        : null;

    const user = saved ? JSON.parse(saved) : currentUser;

    await supabase.from("admin_support_logs").insert({
      user_id: user?.id || null,
      user_name: user?.full_name || user?.username || "دعم فني",
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      details: details || null,
    });
  }

  async function loadData(user = currentUser) {
    setLoading(true);
    await Promise.all([loadBranches(), loadSupportUsers(), loadLogs()]);
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

  async function loadLogs() {
    const { data, error } = await supabase
      .from("admin_support_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error) {
      setLogs(data || []);
    }
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

    await addLog(
      editingBranchId ? "تعديل فرع" : "إضافة فرع",
      "branch",
      editingBranchId || branchSlug,
      `${branchName} - ${organizationName}`
    );

    resetBranchForm();
    await Promise.all([loadBranches(), loadLogs()]);
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

    await addLog(
      branch.is_active ? "تعطيل فرع" : "تفعيل فرع",
      "branch",
      branch.id,
      branch.branch_name
    );

    await Promise.all([loadBranches(), loadLogs()]);
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

  async function enterBranch(branch: Branch) {
    if (!hasPermission("impersonate_branch")) {
      alert("لا تملك صلاحية الدخول للفروع");
      return;
    }

    await addLog(
      "دخول فرع",
      "branch",
      branch.id,
      `${branch.branch_name} - ${branch.branch_slug}`
    );

    localStorage.setItem(
      "admin_support_impersonation",
      JSON.stringify({
        branch_id: branch.id,
        branch_slug: branch.branch_slug,
        branch_name: branch.branch_name,
        support_user: currentUser?.full_name || currentUser?.username,
        entered_at: new Date().toISOString(),
      })
    );

    window.location.href = `/finance/${branch.branch_slug}`;
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

    await addLog(
      "إضافة مستخدم دعم",
      "support_user",
      supportUsername,
      supportFullName
    );

    resetUserForm();
    await Promise.all([loadSupportUsers(), loadLogs()]);
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

    await addLog(
      user.is_active ? "تعطيل مستخدم دعم" : "تفعيل مستخدم دعم",
      "support_user",
      user.id,
      user.full_name
    );

    await Promise.all([loadSupportUsers(), loadLogs()]);
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
    localStorage.removeItem("admin_support_impersonation");
    window.location.href = "/admin-support/login";
  }

  const activeBranches = useMemo(
    () => branches.filter((b) => b.is_active).length,
    [branches]
  );

  const disabledBranches = branches.length - activeBranches;

  if (loading) {
    return (
      <main dir="rtl" style={page}>
        <div style={shell}>
          <section style={topHero}>
            <h1 style={heroTitle}>جاري تحميل لوحة الدعم الفني...</h1>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={shell}>
        <aside style={sidePanel}>
          <div style={brandBox}>
            <div style={brandIcon}>🛠️</div>
            <div>
              <h2 style={brandTitle}>دعم احتساب</h2>
              <p style={brandSub}>لوحة التحكم المركزية</p>
            </div>
          </div>

          <nav style={nav}>
            <button
              style={activeTab === "overview" ? navActive : navItem}
              onClick={() => setActiveTab("overview")}
            >
              📊 النظرة العامة
            </button>

            <button
              style={activeTab === "branches" ? navActive : navItem}
              onClick={() => setActiveTab("branches")}
            >
              🏢 الفروع
            </button>

            <button
              style={activeTab === "users" ? navActive : navItem}
              onClick={() => setActiveTab("users")}
            >
              👨‍💼 مستخدمو الدعم
            </button>

            <button
              style={activeTab === "logs" ? navActive : navItem}
              onClick={() => setActiveTab("logs")}
            >
              🧾 سجل العمليات
            </button>
          </nav>

          <button style={logoutButton} onClick={logout}>
            تسجيل خروج
          </button>
        </aside>

        <section style={mainPanel}>
          <header style={topHero}>
            <div>
              <p style={topLabel}>لوحة الدعم الفني</p>
              <h1 style={heroTitle}>إدارة النظام والفروع</h1>
              <p style={heroSub}>
                مرحباً {currentUser?.full_name || currentUser?.username}
              </p>
            </div>
          </header>

          <section style={statsGrid}>
            <Stat title="كل الفروع" value={branches.length} hint="إجمالي الفروع" />
            <Stat title="النشطة" value={activeBranches} hint="فروع تعمل الآن" />
            <Stat title="المعطلة" value={disabledBranches} hint="فروع موقوفة" />
            <Stat
              title="الدعم"
              value={supportUsers.length}
              hint="مستخدمو الدعم الفني"
            />
          </section>

          {activeTab === "overview" && (
            <section style={dashboardGrid}>
              <div style={darkCard}>
                <h2 style={whiteTitle}>مختصر النظام</h2>
                <p style={whiteText}>
                  من هنا يمكنك إدارة فروع احتساب، إضافة مستخدمي الدعم الفني،
                  وتوثيق عمليات الدخول والتعديل.
                </p>

                <div style={quickActions}>
                  <button
                    style={quickButton}
                    onClick={() => setActiveTab("branches")}
                  >
                    إدارة الفروع
                  </button>

                  <button
                    style={quickButton}
                    onClick={() => setActiveTab("users")}
                  >
                    إدارة المستخدمين
                  </button>
                </div>
              </div>

              <div style={panelCard}>
                <h2 style={panelTitle}>آخر العمليات</h2>

                {logs.length === 0 ? (
                  <div style={emptyBox}>لا توجد عمليات حتى الآن.</div>
                ) : (
                  <div style={miniLogs}>
                    {logs.slice(0, 6).map((log) => (
                      <div key={log.id} style={miniLogItem}>
                        <strong>{log.action}</strong>
                        <span>{log.user_name || "-"}</span>
                        <small>{formatDateTime(log.created_at)}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "branches" && (
            <>
              <div style={sectionTop}>
                <div>
                  <h2 style={sectionTitle}>إدارة الفروع</h2>
                  <p style={sectionSub}>إضافة وتعديل وتفعيل فروع النظام.</p>
                </div>

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

              <section style={panelCard}>
                <div style={branchesList}>
                  {branches.map((branch) => (
                    <article key={branch.id} style={branchRow}>
                      <div style={branchMain}>
                        <div style={branchAvatar}>
                          {branch.branch_name?.slice(0, 1) || "ف"}
                        </div>

                        <div>
                          <h3 style={branchTitle}>{branch.branch_name}</h3>
                          <p style={muted}>🏢 {branch.organization_name}</p>
                          <p style={muted}>/finance/{branch.branch_slug}</p>
                        </div>
                      </div>

                      <span
                        style={branch.is_active ? activeBadge : inactiveBadge}
                      >
                        {branch.is_active ? "نشط" : "معطل"}
                      </span>

                      <div style={rowActions}>
                        {hasPermission("impersonate_branch") && (
                          <button
                            style={smallBlueButton}
                            onClick={() => enterBranch(branch)}
                          >
                            دخول
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
              <div style={sectionTop}>
                <div>
                  <h2 style={sectionTitle}>مستخدمو الدعم الفني</h2>
                  <p style={sectionSub}>إنشاء حسابات الدعم وتحديد الصلاحيات.</p>
                </div>

                <button
                  style={primaryButton}
                  onClick={() => setShowUserForm(true)}
                >
                  + إضافة مستخدم
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

              <section style={usersGrid}>
                {supportUsers.map((user) => (
                  <article key={user.id} style={userCard}>
                    <div style={userIcon}>👨‍💼</div>

                    <h3 style={userTitle}>{user.full_name}</h3>
                    <p style={muted}>@{user.username}</p>
                    <p style={roleBadge}>{roleLabel(user.role)}</p>

                    <span style={user.is_active ? activeBadge : inactiveBadge}>
                      {user.is_active ? "نشط" : "معطل"}
                    </span>

                    <div style={permissionsTags}>
                      {user.permissions?.length ? (
                        user.permissions.map((p) => (
                          <span key={p} style={permissionTag}>
                            {permissionLabel(p)}
                          </span>
                        ))
                      ) : (
                        <span style={permissionTag}>بدون صلاحيات محددة</span>
                      )}
                    </div>

                    <button
                      style={user.is_active ? smallDangerButton : smallGreenButton}
                      onClick={() => toggleSupportUser(user)}
                    >
                      {user.is_active ? "تعطيل" : "تفعيل"}
                    </button>
                  </article>
                ))}
              </section>
            </>
          )}

          {activeTab === "logs" && (
            <>
              <div style={sectionTop}>
                <div>
                  <h2 style={sectionTitle}>سجل عمليات الدعم</h2>
                  <p style={sectionSub}>
                    آخر عمليات الدخول والتعديل داخل لوحة الدعم الفني.
                  </p>
                </div>
              </div>

              <section style={panelCard}>
                {logs.length === 0 ? (
                  <div style={emptyBox}>لا توجد سجلات حتى الآن.</div>
                ) : (
                  <div style={logTable}>
                    {logs.map((log) => (
                      <div key={log.id} style={logRow}>
                        <div>
                          <strong style={logAction}>{log.action}</strong>
                          <p style={muted}>{log.details || "-"}</p>
                        </div>

                        <div style={logMeta}>
                          <span>{log.user_name || "-"}</span>
                          <small>{formatDateTime(log.created_at)}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint: string;
}) {
  return (
    <div style={statCard}>
      <span style={statValue}>{value}</span>
      <span style={statTitle}>{title}</span>
      <small style={statHint}>{hint}</small>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "super_admin") return "مدير النظام";
  if (role === "viewer") return "مشاهدة فقط";
  return "دعم فني";
}

function permissionLabel(key: string) {
  return SUPPORT_PERMISSIONS.find((p) => p.key === key)?.label || key;
}

function formatDateTime(date: string) {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-GB");
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0b1020",
  padding: 14,
  fontFamily: "var(--font-almarai), sans-serif",
  color: "#0f172a",
};

const shell: React.CSSProperties = {
  width: "100%",
  maxWidth: 1450,
  margin: "auto",
  display: "grid",
  gridTemplateColumns: "280px 1fr",
  gap: 14,
};

const sidePanel: React.CSSProperties = {
  minHeight: "calc(100vh - 28px)",
  background: "linear-gradient(180deg,#111827,#020617)",
  border: "1px solid rgba(148,163,184,.18)",
  borderRadius: 26,
  padding: 16,
  color: "white",
  position: "sticky",
  top: 14,
};

const brandBox: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: 12,
  borderRadius: 20,
  background: "rgba(255,255,255,.06)",
  marginBottom: 18,
};

const brandIcon: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,
  background: "#2563eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
};

const brandTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
};

const brandSub: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#94a3b8",
  fontSize: 13,
};

const nav: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const navItem: React.CSSProperties = {
  width: "100%",
  border: "1px solid transparent",
  background: "transparent",
  color: "#cbd5e1",
  borderRadius: 15,
  padding: "13px 12px",
  cursor: "pointer",
  textAlign: "right",
  fontSize: 15,
  fontWeight: 800,
};

const navActive: React.CSSProperties = {
  ...navItem,
  color: "white",
  background: "linear-gradient(135deg,#2563eb,#7c3aed)",
  border: "1px solid rgba(255,255,255,.15)",
};

const logoutButton: React.CSSProperties = {
  width: "100%",
  marginTop: 18,
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 15,
  padding: "13px 16px",
  fontWeight: 900,
  cursor: "pointer",
};

const mainPanel: React.CSSProperties = {
  minHeight: "calc(100vh - 28px)",
  background: "#f8fafc",
  borderRadius: 26,
  padding: 16,
};

const topHero: React.CSSProperties = {
  background:
    "radial-gradient(circle at top left,rgba(124,58,237,.38),transparent 30%), linear-gradient(135deg,#111827,#1e3a8a)",
  color: "white",
  borderRadius: 24,
  padding: 24,
  marginBottom: 14,
};

const topLabel: React.CSSProperties = {
  margin: 0,
  color: "#bfdbfe",
  fontWeight: 800,
};

const heroTitle: React.CSSProperties = {
  margin: "6px 0",
  fontSize: 32,
  lineHeight: 1.4,
};

const heroSub: React.CSSProperties = {
  margin: 0,
  color: "#dbeafe",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 8px 18px rgba(15,23,42,.04)",
};

const statValue: React.CSSProperties = {
  display: "block",
  fontSize: 34,
  fontWeight: 900,
  color: "#2563eb",
};

const statTitle: React.CSSProperties = {
  display: "block",
  color: "#0f172a",
  fontWeight: 900,
  marginTop: 4,
};

const statHint: React.CSSProperties = {
  display: "block",
  color: "#64748b",
  marginTop: 5,
};

const dashboardGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const darkCard: React.CSSProperties = {
  background: "linear-gradient(135deg,#020617,#172554)",
  color: "white",
  borderRadius: 22,
  padding: 20,
  minHeight: 220,
};

const whiteTitle: React.CSSProperties = {
  marginTop: 0,
};

const whiteText: React.CSSProperties = {
  color: "#cbd5e1",
  lineHeight: 1.9,
};

const quickActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 20,
};

const quickButton: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.08)",
  color: "white",
  borderRadius: 14,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 800,
};

const panelCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 8px 18px rgba(15,23,42,.04)",
};

const panelTitle: React.CSSProperties = {
  marginTop: 0,
};

const miniLogs: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const miniLogItem: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 4,
};

const sectionTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  color: "#0f172a",
};

const sectionSub: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
};

const primaryButton: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg,#2563eb,#7c3aed)",
  color: "white",
  borderRadius: 14,
  padding: "13px 18px",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "#64748b",
};

const formCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  marginBottom: 14,
};

const formTitle: React.CSSProperties = {
  marginTop: 0,
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
  fontWeight: 900,
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

const branchesList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const branchRow: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  gap: 12,
  alignItems: "center",
};

const branchMain: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const branchAvatar: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 16,
  background: "#dbeafe",
  color: "#1d4ed8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 20,
};

const branchTitle: React.CSSProperties = {
  margin: 0,
};

const muted: React.CSSProperties = {
  color: "#64748b",
  margin: "6px 0",
};

const activeBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 900,
};

const inactiveBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 900,
};

const rowActions: React.CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};

const smallButton: React.CSSProperties = {
  border: "none",
  background: "#e0f2fe",
  color: "#075985",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 800,
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

const usersGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
  gap: 12,
};

const userCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  display: "grid",
  gap: 8,
};

const userIcon: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  background: "#ede9fe",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
};

const userTitle: React.CSSProperties = {
  margin: 0,
};

const roleBadge: React.CSSProperties = {
  background: "#f1f5f9",
  color: "#334155",
  borderRadius: 999,
  padding: "7px 10px",
  width: "fit-content",
  fontWeight: 800,
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
  fontWeight: 800,
};

const permissionsTags: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const permissionTag: React.CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 12,
  fontWeight: 800,
};

const emptyBox: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 18,
  textAlign: "center",
  color: "#64748b",
};

const logTable: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const logRow: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const logAction: React.CSSProperties = {
  color: "#0f172a",
};

const logMeta: React.CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#64748b",
};
