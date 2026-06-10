"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

const roleOptions = ["مدير", "موظف", "مشاهدة فقط"];

const permissionOptions = [
  { key: "contracts", label: "العقود" },
  { key: "customers", label: "العملاء" },
  { key: "inventory", label: "المخزون" },
  { key: "payments", label: "السداد" },
  { key: "workflow", label: "سير العمل" },
  { key: "settings", label: "الإعدادات" },
  { key: "permissions", label: "الصلاحيات" },
  { key: "expenses", label: "المصروفات" },
  { key: "print", label: "الطباعة" },
  { key: "archive", label: "الأرشيف" },

  { key: "add_investor", label: "إضافة مستثمر" },
  { key: "edit_investor", label: "تعديل مستثمر" },
  { key: "toggle_investor", label: "تعطيل / تفعيل مستثمر" },

  { key: "add_product", label: "إضافة منتج" },
  { key: "edit_product", label: "تعديل منتج" },
  { key: "toggle_product", label: "تعطيل / تفعيل منتج" },
];

export default function FinancePermissionsPage() {
  const params = useParams();
  const branch = params.branch as string;

  const [branchId, setBranchId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authorized, setAuthorized] = useState(false);

  const [activeTab, setActiveTab] = useState("users");

  const [users, setUsers] = useState<any[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
  const [archivedContracts, setArchivedContracts] = useState<any[]>([]);

  const [employeeName, setEmployeeName] = useState("");
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("موظف");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    "contracts",
    "customers",
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [branch]);

  function hasPageAccess(user: any) {
    return (
      user?.role === "مدير فرع" ||
      user?.role === "مدير رئيسي" ||
      user?.permissions?.includes("permissions")
    );
  }

  async function loadData() {
    setLoading(true);

    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("finance_user")
        : null;

    if (!saved) {
      window.location.href = `/finance/${branch}/login`;
      return;
    }

    let parsedUser: any = null;

    try {
      parsedUser = JSON.parse(saved);
    } catch {
      localStorage.removeItem("finance_user");
      window.location.href = `/finance/${branch}/login`;
      return;
    }

    if (!parsedUser?.branch_slug || parsedUser.branch_slug !== branch) {
      localStorage.removeItem("finance_user");
      window.location.href = `/finance/${branch}/login`;
      return;
    }

    if (!hasPageAccess(parsedUser)) {
      alert("لا تملك صلاحية الدخول لهذه الصفحة");
      window.location.href = `/finance/${branch}`;
      return;
    }

    const currentBranchId = await getBranchId(branch);
    setBranchId(currentBranchId);

    if (!currentBranchId || parsedUser.branch_id !== currentBranchId) {
      localStorage.removeItem("finance_user");
      window.location.href = `/finance/${branch}/login`;
      return;
    }

    const { data: freshUser } = await supabase
      .from("finance_users")
      .select("id, branch_id, full_name, username, role, permissions, is_active")
      .eq("id", parsedUser.id)
      .eq("branch_id", currentBranchId)
      .single();

    if (!freshUser || !freshUser.is_active || !hasPageAccess(freshUser)) {
      localStorage.removeItem("finance_user");
      window.location.href = `/finance/${branch}/login`;
      return;
    }

    setCurrentUser(freshUser);
    setAuthorized(true);

    const { data: usersData } = await supabase
      .from("finance_users")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    const { data: investorsData } = await supabase
      .from("finance_investors")
      .select("*")
      .eq("branch_id", currentBranchId)
      .order("created_at", { ascending: false });

    const { data: archiveData } = await supabase
      .from("finance_contracts")
      .select("*")
      .eq("branch_id", currentBranchId)
      .eq("contract_status", "ملغي")
      .order("updated_at", { ascending: false });

    setUsers(usersData || []);
    setInvestors(investorsData || []);
    setArchivedContracts(archiveData || []);
    setLoading(false);
  }

  function togglePermission(value: string) {
    if (selectedPermissions.includes(value)) {
      setSelectedPermissions(selectedPermissions.filter((item) => item !== value));
    } else {
      setSelectedPermissions([...selectedPermissions, value]);
    }
  }

  function validateUsername(value: string) {
    const username = value.trim();
    if (username.length < 3 || username.length > 30) return false;
    return /^[A-Za-z0-9_\u0600-\u06FF]+$/.test(username);
  }

  async function createUser() {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    if (!employeeName.trim()) {
      alert("يرجى إدخال اسم الموظف");
      return;
    }

    if (!validateUsername(employeeUsername)) {
      alert("اسم المستخدم يجب أن يكون من 3 إلى 30 حرفاً ويقبل العربي أو الإنجليزي أو الأرقام أو _ فقط");
      return;
    }

    if (!/^\d{4}$/.test(employeePassword)) {
      alert("كلمة المرور يجب أن تكون 4 أرقام فقط");
      return;
    }

    if (selectedRole === "مدير فرع") {
      alert("مدير الفرع يتم إنشاؤه من لوحة الدعم الفني فقط");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.from("finance_users").insert({
        branch_id: branchId,
        full_name: employeeName.trim(),
        username: employeeUsername.trim(),
        password_pin: employeePassword.trim(),
        role: selectedRole,
        permissions: selectedPermissions,
        is_active: true,
      });

      if (error) throw new Error(error.message);

      setEmployeeName("");
      setEmployeeUsername("");
      setEmployeePassword("");
      setSelectedRole("موظف");
      setSelectedPermissions(["contracts", "customers"]);

      alert("تم إنشاء المستخدم بنجاح");
      await loadData();
    } catch (error: any) {
      alert(error.message || "تعذر إنشاء المستخدم");
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserStatus(user: any) {
    if (user.role === "مدير فرع") {
      alert("لا يمكن تعطيل مدير الفرع من هنا، يتم ذلك من لوحة الدعم الفني");
      return;
    }

    if (user.id === currentUser?.id) {
      alert("لا يمكنك تعطيل حسابك الحالي");
      return;
    }

    const { error } = await supabase
      .from("finance_users")
      .update({
        is_active: !user.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .eq("branch_id", branchId);

    if (error) {
      alert("تعذر تعديل حالة المستخدم");
      return;
    }

    await loadData();
  }

  async function deleteUser(user: any) {
    if (user.role === "مدير فرع") {
      alert("لا يمكن حذف مدير الفرع من هنا");
      return;
    }

    if (user.id === currentUser?.id) {
      alert("لا يمكنك حذف حسابك الحالي");
      return;
    }

    const confirmed = confirm("هل أنت متأكد من حذف هذا المستخدم؟");
    if (!confirmed) return;

    const { error } = await supabase
      .from("finance_users")
      .delete()
      .eq("id", user.id)
      .eq("branch_id", branchId);

    if (error) {
      alert("تعذر حذف المستخدم");
      return;
    }

    await loadData();
  }

  async function resetUserPassword(user: any) {
    if (user.role === "مدير فرع") {
      alert("تغيير كلمة مرور مدير الفرع يتم من لوحة الدعم الفني");
      return;
    }

    const newPin = prompt("أدخل كلمة المرور الجديدة من 4 أرقام");

    if (newPin === null) return;

    if (!/^\d{4}$/.test(newPin)) {
      alert("كلمة المرور يجب أن تكون 4 أرقام فقط");
      return;
    }

    const { error } = await supabase
      .from("finance_users")
      .update({
        password_pin: newPin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .eq("branch_id", branchId);

    if (error) {
      alert("تعذر تحديث كلمة المرور");
      return;
    }

    alert("تم تحديث كلمة المرور");
  }

  if (loading || !authorized) {
    return (
      <main dir="rtl" style={page}>
        <div style={loadingBox}>جاري تحميل الصلاحيات...</div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={page}>
      <div style={container}>
        <div style={header}>
          <h1 style={{ margin: 0 }}>إدارة الصلاحيات</h1>
          <p style={headerText}>
            إدارة موظفي الفرع والصلاحيات والأرشيف والمستثمرين.
          </p>
        </div>

        <section style={tabs}>
          <button
            style={activeTab === "users" ? activeTabButton : tabButton}
            onClick={() => setActiveTab("users")}
          >
            إضافة مستخدم
          </button>

          <button
            style={activeTab === "permissions" ? activeTabButton : tabButton}
            onClick={() => setActiveTab("permissions")}
          >
            المستخدمون
          </button>

          <button
            style={activeTab === "investors" ? activeTabButton : tabButton}
            onClick={() => setActiveTab("investors")}
          >
            المستثمرون
          </button>

          <button
            style={activeTab === "archive" ? activeTabButton : tabButton}
            onClick={() => setActiveTab("archive")}
          >
            الأرشيف
          </button>
        </section>

        {activeTab === "users" && (
          <section style={card}>
            <h2 style={sectionTitle}>إضافة مستخدم جديد</h2>

            <Field label="اسم الموظف">
              <input
                style={input}
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                placeholder="مثال: محمد أحمد"
              />
            </Field>

            <Field label="اسم المستخدم">
              <input
                style={input}
                value={employeeUsername}
                onChange={(e) => setEmployeeUsername(e.target.value)}
                placeholder="مثال: mohammed أو محمد"
              />
            </Field>

            <Field label="كلمة المرور 4 أرقام">
              <input
                style={input}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={employeePassword}
                onChange={(e) =>
                  setEmployeePassword(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="مثال: 1234"
              />
            </Field>

            <h3 style={smallTitle}>الدور</h3>

            <div style={checksGrid}>
              {roleOptions.map((role) => (
                <label key={role} style={checkBox}>
                  <input
                    type="radio"
                    name="role"
                    checked={selectedRole === role}
                    onChange={() => setSelectedRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>

            <h3 style={smallTitle}>صلاحيات الأقسام والعمليات</h3>

            <div style={checksGrid}>
              {permissionOptions.map((item) => (
                <label key={item.key} style={checkBox}>
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(item.key)}
                    onChange={() => togglePermission(item.key)}
                  />
                  {item.label}
                </label>
              ))}
            </div>

            <button style={saveButton} onClick={createUser} disabled={saving}>
              {saving ? "جاري الحفظ..." : "إضافة المستخدم"}
            </button>
          </section>
        )}

        {activeTab === "permissions" && (
          <section style={card}>
            <h2 style={sectionTitle}>قائمة المستخدمين</h2>

            {users.length === 0 ? (
              <div style={emptyBox}>لا توجد بيانات مستخدمين.</div>
            ) : (
              users.map((user) => (
                <div key={user.id} style={userRow}>
                  <div>
                    <strong>{user.full_name || "-"}</strong>
                    <div style={mutedText}>@{user.username || "-"}</div>
                    <div style={mutedText}>الدور: {user.role || "-"}</div>
                    <div style={mutedText}>
                      الصلاحيات: {(user.permissions || []).join("، ") || "-"}
                    </div>
                  </div>

                  <div style={userActions}>
                    <span style={user.is_active ? activeBadge : inactiveBadge}>
                      {user.is_active ? "نشط" : "معطل"}
                    </span>

                    <button
                      style={graySmallButton}
                      onClick={() => resetUserPassword(user)}
                    >
                      كلمة المرور
                    </button>

                    <button
                      style={graySmallButton}
                      onClick={() => toggleUserStatus(user)}
                    >
                      {user.is_active ? "تعطيل" : "تفعيل"}
                    </button>

                    <button
                      style={dangerSmallButton}
                      onClick={() => deleteUser(user)}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "investors" && (
          <section style={card}>
            <h2 style={sectionTitle}>المستثمرون</h2>

            {investors.length === 0 ? (
              <div style={emptyBox}>لا يوجد مستثمرون حتى الآن</div>
            ) : (
              investors.map((investor) => (
                <div key={investor.id} style={simpleRow}>
                  <strong>{investor.investor_name || "-"}</strong>
                  <span>
                    {investor.national_id || investor.commercial_record || "-"}
                  </span>
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "archive" && (
          <section style={card}>
            <h2 style={sectionTitle}>الأرشيف</h2>

            {archivedContracts.length === 0 ? (
              <div style={emptyBox}>لا توجد عقود ملغية في الأرشيف</div>
            ) : (
              archivedContracts.map((contract) => (
                <button
                  key={contract.id}
                  style={itemButton}
                  onClick={() =>
                    (window.location.href = `/finance/${branch}/contracts/${contract.id}`)
                  }
                >
                  عقد رقم {contract.contract_number || "-"} -{" "}
                  {contract.customer_name || "-"} -{" "}
                  {contract.payment_amount || 0} ر.س
                </button>
              ))
            )}
          </section>
        )}

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

function Field({ label, children }: any) {
  return (
    <div style={fieldBox}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
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

const headerText = {
  margin: "10px 0 0",
  opacity: 0.9,
  fontSize: 15,
};

const tabs = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 12,
  marginBottom: 16,
};

const tabButton = {
  padding: 14,
  background: "white",
  color: "#0d47a1",
  border: "1px solid #d9e3f5",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};

const activeTabButton = {
  ...tabButton,
  background: "#0d47a1",
  color: "white",
};

const card = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
};

const sectionTitle = {
  marginTop: 0,
  color: "#0d47a1",
};

const smallTitle = {
  color: "#0d47a1",
  margin: "16px 0 10px",
};

const fieldBox = {
  marginBottom: 12,
};

const labelStyle = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontWeight: "bold",
  fontSize: 14,
};

const input = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #d9e3f5",
  fontSize: 16,
  boxSizing: "border-box" as const,
};

const checksGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: 10,
};

const checkBox = {
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 12,
  padding: 12,
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontWeight: "bold",
};

const saveButton = {
  width: "100%",
  padding: 16,
  background: "#0d47a1",
  color: "white",
  border: "none",
  borderRadius: 14,
  fontSize: 17,
  fontWeight: "bold",
  marginTop: 18,
  cursor: "pointer",
};

const emptyBox = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center" as const,
  color: "#6b7280",
};

const userRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
  alignItems: "center",
};

const userActions = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap" as const,
};

const mutedText = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 4,
};

const activeBadge = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
};

const inactiveBadge = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "7px 12px",
  fontWeight: "bold",
};

const graySmallButton = {
  background: "#e5e7eb",
  color: "#0d47a1",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: "bold",
  cursor: "pointer",
};

const dangerSmallButton = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: "bold",
  cursor: "pointer",
};

const simpleRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: 14,
  borderBottom: "1px solid #eef2f7",
};

const itemButton = {
  width: "100%",
  padding: 14,
  background: "#f8fbff",
  border: "1px solid #d9e3f5",
  borderRadius: 14,
  fontSize: 16,
  cursor: "pointer",
  marginBottom: 10,
  textAlign: "right" as const,
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

const loadingBox = {
  background: "white",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  textAlign: "center" as const,
  color: "#0d47a1",
  fontWeight: "bold",
};
