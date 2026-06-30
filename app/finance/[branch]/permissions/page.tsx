"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  clearFinanceSession,
  getFinanceEmployeeName,
  installFinanceActivityTracker,
  logoutFinanceUser,
  redirectToFinanceLogin,
  validateFinanceSession,
  type FinanceSessionUser,
} from "@/lib/financeSession";

type ScreenType = "mobile" | "tablet" | "desktop";
type UserRole = "مدير" | "موظف" | "مستثمر";
type ActiveTab =
  | "create-user"
  | "users"
  | "create-investor"
  | "investors"
  | null;

type FinanceUser = {
  id: string;
  branch_id: string;
  full_name: string;
  username: string;
  role: string;
  permissions: string[];
  investor_id?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_login_at?: string | null;
};

type FinanceInvestor = {
  id: string;
  branch_id: string;
  investor_name: string;
  national_id?: string | null;
  phone?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
  is_primary?: boolean | null;
  created_at?: string | null;
};

type PermissionOption = { key: string; label: string };
type PermissionGroup = { title: string; permissions: PermissionOption[] };
type FieldProps = { label: string; children: ReactNode };
type PermissionGroupsProps = {
  selectedPermissions: string[];
  disabled?: boolean;
  onToggle: (permissionKey: string) => void;
};

type ApiResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  users?: unknown[];
  investors?: unknown[];
};

const MANAGER_ROLES = [
  "مدير",
  "مدير فرع",
  "مدير رئيسي",
  "branch_manager",
  "main_admin",
];

const PROTECTED_ROLES = [
  "مدير فرع",
  "مدير رئيسي",
  "branch_manager",
  "main_admin",
];

const INVESTOR_PERMISSIONS = [
  "workflow",
  "investor_data",
  "investor_contracts",
];

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "سير العمل",
    permissions: [{ key: "workflow", label: "الدخول إلى سير العمل" }],
  },
  {
    title: "العملاء",
    permissions: [
      { key: "customers", label: "عرض العملاء" },
      { key: "customers_create", label: "إضافة عميل" },
      { key: "customers_edit", label: "تعديل العميل" },
      { key: "customers_verify", label: "التحقق من العميل" },
    ],
  },
  {
    title: "العقود",
    permissions: [
      { key: "contracts", label: "عرض العقود" },
      { key: "contracts_create", label: "إنشاء عقد" },
      { key: "contracts_edit", label: "تعديل العقد" },
      { key: "contracts_close", label: "إغلاق العقد" },
      { key: "archive", label: "عرض الأرشيف" },
    ],
  },
  {
    title: "السداد",
    permissions: [
      { key: "payments", label: "عرض عمليات السداد" },
      { key: "payments_create", label: "إجراء سداد" },
      { key: "payments_cancel", label: "إلغاء دفعة" },
    ],
  },
  {
    title: "المخزون والمنتجات",
    permissions: [
      { key: "inventory", label: "عرض المخزون" },
      { key: "add_inventory", label: "إضافة كمية للمخزون" },
      { key: "add_product", label: "إضافة منتج" },
      { key: "edit_product", label: "تعديل منتج" },
      { key: "toggle_product", label: "تفعيل أو تعطيل منتج" },
    ],
  },
  {
    title: "المستثمرون",
    permissions: [
      { key: "add_investor", label: "إضافة مستثمر" },
      { key: "edit_investor", label: "تعديل مستثمر" },
      { key: "toggle_investor", label: "تفعيل أو تعطيل مستثمر" },
    ],
  },
  {
    title: "الملاحظات والمصروفات",
    permissions: [
      { key: "notes", label: "الملاحظات والتذكيرات" },
      { key: "expenses", label: "المصروفات والمشتريات" },
    ],
  },
  {
    title: "الطباعة والسندات",
    permissions: [
      { key: "print", label: "الطباعة والتقارير" },
      { key: "promissory_note_view", label: "عرض سند لأمر" },
      { key: "promissory_note_create", label: "إنشاء سند لأمر" },
    ],
  },
  {
    title: "المتابعة والتواصل",
    permissions: [
      { key: "follow_up", label: "المتابعة والتواصل" },
    ],
  },
  {
    title: "الإدارة",
    permissions: [
      { key: "settings", label: "الإعدادات" },
      { key: "permissions", label: "إدارة الموظفين والصلاحيات" },
    ],
  },
];

const ALL_MANAGER_PERMISSIONS = Array.from(
  new Set(
    PERMISSION_GROUPS.flatMap((group) =>
      group.permissions.map((permission) => permission.key)
    )
  )
);

const DEFAULT_EXCLUDED_PERMISSIONS = new Set([
  "add_investor",
  "edit_investor",
  "toggle_investor",
  "permissions",
]);

const DEFAULT_STANDARD_PERMISSIONS = ALL_MANAGER_PERMISSIONS.filter(
  (permission) => !DEFAULT_EXCLUDED_PERMISSIONS.has(permission)
);

const DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  مدير: [...DEFAULT_STANDARD_PERMISSIONS],
  موظف: [...DEFAULT_STANDARD_PERMISSIONS],
  مستثمر: [...INVESTOR_PERMISSIONS],
};

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
    )
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
    );
}

function normalizeUsernameInput(value: string) {
  return normalizeDigits(value)
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, 30)
    .toLowerCase();
}

function normalizePasswordInput(value: string) {
  return normalizeDigits(value)
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 10);
}

function normalizeIdentifierDigits(value: string, maxLength: number) {
  return normalizeDigits(value)
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

function normalizePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((permission): permission is string => typeof permission === "string")
        .map((permission) => permission.trim())
        .filter(Boolean)
    )
  );
}

function sessionToFinanceUser(user: FinanceSessionUser): FinanceUser {
  return {
    id: String(user.id || "").trim(),
    branch_id: String(user.branch_id || "").trim(),
    full_name: String(user.full_name || "").trim(),
    username: String(user.username || "").trim(),
    role: String(user.role || "").trim(),
    permissions: normalizePermissions(user.permissions),
    investor_id: user.investor_id ? String(user.investor_id).trim() : null,
    is_active: user.is_active !== false,
    last_login_at: user.last_login_at || null,
  };
}

function normalizeApiUser(value: unknown): FinanceUser {
  const user =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    id: String(user.user_id ?? user.id ?? ""),
    branch_id: String(user.branch_id ?? ""),
    full_name: String(user.full_name ?? ""),
    username: String(user.username ?? ""),
    role: String(user.role ?? ""),
    permissions: normalizePermissions(user.permissions),
    investor_id: user.investor_id ? String(user.investor_id) : null,
    is_active: user.is_active !== false,
    created_at: user.created_at ? String(user.created_at) : null,
    updated_at: user.updated_at ? String(user.updated_at) : null,
    last_login_at: user.last_login_at ? String(user.last_login_at) : null,
  };
}

function normalizeApiInvestor(value: unknown): FinanceInvestor {
  const investor =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    id: String(investor.investor_id ?? investor.id ?? ""),
    branch_id: String(investor.branch_id ?? ""),
    investor_name: String(investor.investor_name ?? ""),
    national_id: investor.national_id ? String(investor.national_id) : null,
    phone: investor.phone ? String(investor.phone) : null,
    notes: investor.notes ? String(investor.notes) : null,
    is_active: investor.is_active !== false,
    is_primary: investor.is_primary === true,
    created_at: investor.created_at ? String(investor.created_at) : null,
  };
}

async function readApiResponse(response: Response): Promise<ApiResponse> {
  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {};
  }
}

export default function FinancePermissionsPage() {
  const params = useParams();
  const router = useRouter();

  const branch =
    typeof params.branch === "string" ? params.branch : "";

  const [screen, setScreen] = useState<ScreenType>("desktop");
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionUser, setSessionUser] = useState<FinanceSessionUser | null>(null);
  const [currentUser, setCurrentUser] = useState<FinanceUser | null>(null);
  const [employeeName, setEmployeeName] = useState("الموظف");
  const [activeTab, setActiveTab] = useState<ActiveTab>(null);
  const [users, setUsers] = useState<FinanceUser[]>([]);
  const [investors, setInvestors] = useState<FinanceInvestor[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUser, setSavingUser] = useState(false);
  const [savingInvestor, setSavingInvestor] = useState(false);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const [employeeNameInput, setEmployeeNameInput] = useState("");
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("موظف");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    ...DEFAULT_PERMISSIONS.موظف,
  ]);
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [investorNameInput, setInvestorNameInput] = useState("");
  const [investorNationalId, setInvestorNationalId] = useState("");
  const [investorPhone, setInvestorPhone] = useState("");
  const [investorNotes, setInvestorNotes] = useState("");

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  const activeInvestors = useMemo(
    () => investors.filter((investor) => investor.is_active !== false),
    [investors]
  );

  const availableInvestorsForAccount = useMemo(() => {
    const linkedInvestorIds = new Set(
      users
        .filter(
          (user) =>
            Boolean(user.investor_id) &&
            user.id !== editingUserId
        )
        .map((user) => String(user.investor_id))
    );

    return activeInvestors.filter(
      (investor) => !linkedInvestorIds.has(investor.id)
    );
  }, [activeInvestors, users, editingUserId]);

  useEffect(() => {
    function updateScreen() {
      const width = window.innerWidth;

      if (width < 640) setScreen("mobile");
      else if (width < 980) setScreen("tablet");
      else setScreen("desktop");
    }

    updateScreen();
    window.addEventListener("resize", updateScreen);

    return () => window.removeEventListener("resize", updateScreen);
  }, []);

  useEffect(() => {
    if (!branch) return;

    const validation = validateFinanceSession(branch);

    if (!validation.valid || !validation.user) {
      redirectToFinanceLogin(router, { branchSlug: branch });
      return;
    }

    const authenticatedUser = validation.user;
    const normalizedCurrentUser = sessionToFinanceUser(authenticatedUser);

    if (
      !normalizedCurrentUser.id ||
      !normalizedCurrentUser.branch_id ||
      !normalizedCurrentUser.username
    ) {
      clearFinanceSession({ preserveReturnPath: true });
      redirectToFinanceLogin(router, { branchSlug: branch });
      return;
    }

    if (!hasPageAccess(normalizedCurrentUser)) {
      window.alert("لا تملك صلاحية الدخول لهذه الصفحة");
      router.replace(`/finance/${branch}`);
      return;
    }

    setSessionUser(authenticatedUser);
    setCurrentUser(normalizedCurrentUser);
    setEmployeeName(getFinanceEmployeeName(authenticatedUser));
    setAuthChecked(true);
    setLoading(false);
  }, [branch, router]);

  useEffect(() => {
    if (!authChecked || !sessionUser) return;

    return installFinanceActivityTracker({
      expectedBranchSlug: branch,
      onExpired: () =>
        redirectToFinanceLogin(router, { branchSlug: branch }),
      onInvalidated: () => {
        clearFinanceSession();
        router.replace("/login");
      },
      onSessionUpdated: (updatedUser) => {
        const updatedCurrentUser = sessionToFinanceUser(updatedUser);

        if (!hasPageAccess(updatedCurrentUser)) {
          router.replace(`/finance/${branch}`);
          return;
        }

        setSessionUser(updatedUser);
        setCurrentUser(updatedCurrentUser);
        setEmployeeName(getFinanceEmployeeName(updatedUser));
      },
    });
  }, [authChecked, branch, router, sessionUser?.id]);

  useEffect(() => {
    if (editingUserId) return;

    setSelectedPermissions([...DEFAULT_PERMISSIONS[selectedRole]]);

    if (selectedRole !== "مستثمر") {
      setSelectedInvestorId("");
    }
  }, [selectedRole, editingUserId]);

  function hasPageAccess(user: FinanceUser) {
    return (
      MANAGER_ROLES.includes(user.role) ||
      user.permissions.includes("permissions")
    );
  }

  function handleApiSessionError(status: number, code?: string) {
    if (status === 401 || code === "INVALID_SESSION" || code === "SESSION_REVOKED") {
      clearFinanceSession({ preserveReturnPath: true });
      redirectToFinanceLogin(router, { branchSlug: branch });
      return true;
    }

    if (status === 403) {
      window.alert("لا تملك صلاحية تنفيذ هذه العملية");
      router.replace(`/finance/${branch}`);
      return true;
    }

    return false;
  }

  async function loadLists(isCancelled: () => boolean = () => false) {
    setLoading(true);

    try {
      const response = await fetch(
        `/finance/api/permissions?branch=${encodeURIComponent(branch)}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        }
      );

      const payload = await readApiResponse(response);

      if (isCancelled()) return false;

      if (!response.ok || payload.ok === false) {
        if (handleApiSessionError(response.status, payload.code)) return false;
        throw new Error(payload.message || "تعذر تحميل بيانات الإدارة");
      }

      setUsers(
        Array.isArray(payload.users)
          ? payload.users.map(normalizeApiUser)
          : []
      );

      setInvestors(
        Array.isArray(payload.investors)
          ? payload.investors.map(normalizeApiInvestor)
          : []
      );

      return true;
    } catch (error) {
      if (isCancelled()) return false;

      console.error("Load permissions data error:", error);
      setUsers([]);
      setInvestors([]);
      window.alert(getErrorMessage(error, "تعذر تحميل بيانات إدارة المستخدمين"));
      return false;
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }

  async function openProtectedTab(tab: Exclude<ActiveTab, null>) {
    const loaded = await loadLists();
    if (!loaded) return;

    if (tab === "create-user") resetUserForm();

    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function togglePermission(permissionKey: string) {
    if (selectedRole === "مستثمر") return;

    setSelectedPermissions((currentPermissions) =>
      currentPermissions.includes(permissionKey)
        ? currentPermissions.filter((item) => item !== permissionKey)
        : [...currentPermissions, permissionKey]
    );
  }

  function handleRoleChange(role: UserRole) {
    setSelectedRole(role);

    setSelectedPermissions([
      ...DEFAULT_PERMISSIONS[role],
    ]);

    if (role !== "مستثمر") {
      setSelectedInvestorId("");
    }
  }

  function resetUserForm() {
    setEditingUserId(null);
    setEmployeeNameInput("");
    setEmployeeUsername("");
    setEmployeePassword("");
    setSelectedRole("موظف");
    setSelectedPermissions([...DEFAULT_PERMISSIONS.موظف]);
    setSelectedInvestorId("");
  }

  function returnToMainOptions() {
    resetUserForm();
    setActiveTab(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function beginEditUser(user: FinanceUser) {
    if (PROTECTED_ROLES.includes(user.role)) {
      window.alert("هذا الحساب تتم إدارته من لوحة الدعم الفني");
      return;
    }

    const normalizedRole: UserRole =
      user.role === "مستثمر"
        ? "مستثمر"
        : user.role === "مدير"
          ? "مدير"
          : "موظف";

    setEditingUserId(user.id);
    setEmployeeNameInput(user.full_name || "");
    setEmployeeUsername(user.username || "");
    setEmployeePassword("");
    setSelectedRole(normalizedRole);
    setSelectedPermissions(
      normalizedRole === "مستثمر"
        ? [...INVESTOR_PERMISSIONS]
        : [...(user.permissions || [])]
    );
    setSelectedInvestorId(user.investor_id || "");
    setActiveTab("create-user");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveUser() {
    if (!employeeNameInput.trim()) {
      window.alert("يرجى إدخال الاسم الكامل");
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(employeeUsername)) {
      window.alert(
        "اسم المستخدم يجب أن يكون من 3 إلى 30 خانة ويقبل الأحرف الإنجليزية والأرقام والشرطة السفلية فقط"
      );
      return;
    }

    if (!editingUserId && !/^[A-Za-z0-9]{4,10}$/.test(employeePassword)) {
      window.alert("كلمة المرور يجب أن تكون من 4 إلى 10 أحرف أو أرقام");
      return;
    }

    if (
      editingUserId &&
      employeePassword &&
      !/^[A-Za-z0-9]{4,10}$/.test(employeePassword)
    ) {
      window.alert("كلمة المرور الجديدة يجب أن تكون من 4 إلى 10 أحرف أو أرقام");
      return;
    }

    if (selectedRole === "مستثمر" && !selectedInvestorId) {
      window.alert("اختر المستثمر المرتبط بالحساب");
      return;
    }

    try {
      setSavingUser(true);

      const response = await fetch("/finance/api/permissions", {
        method: editingUserId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action: editingUserId ? "update-user" : "create-user",
          branch,
          userId: editingUserId || undefined,
          fullName: employeeNameInput.trim(),
          username: employeeUsername,
          password: employeePassword,
          role: selectedRole,
          permissions:
            selectedRole === "مستثمر"
              ? INVESTOR_PERMISSIONS
              : selectedPermissions,
          investorId:
            selectedRole === "مستثمر"
              ? selectedInvestorId
              : null,
        }),
      });

      const payload = await readApiResponse(response);

      if (!response.ok || payload.ok === false) {
        if (handleApiSessionError(response.status, payload.code)) return;
        throw new Error(payload.message || "تعذر حفظ المستخدم");
      }

      window.alert(
        payload.message ||
          (editingUserId
            ? "تم تعديل المستخدم بنجاح"
            : "تم إنشاء المستخدم بنجاح")
      );

      resetUserForm();

      if (await loadLists()) {
        setActiveTab("users");
      }
    } catch (error) {
      console.error("Save finance user error:", error);
      window.alert(getErrorMessage(error, "تعذر حفظ المستخدم"));
    } finally {
      setSavingUser(false);
    }
  }

  async function toggleUserStatus(user: FinanceUser) {
    if (PROTECTED_ROLES.includes(user.role)) {
      window.alert("لا يمكن تعديل حالة هذا الحساب من هنا");
      return;
    }

    if (user.id === currentUser?.id) {
      window.alert("لا يمكنك تعطيل حسابك الحالي");
      return;
    }

    const confirmed = window.confirm(
      user.is_active
        ? `هل تريد تعطيل حساب ${user.full_name}؟`
        : `هل تريد تفعيل حساب ${user.full_name}؟`
    );

    if (!confirmed) return;

    try {
      setProcessingUserId(user.id);

      const response = await fetch("/finance/api/permissions", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action: "toggle-user",
          branch,
          userId: user.id,
        }),
      });

      const payload = await readApiResponse(response);

      if (!response.ok || payload.ok === false) {
        if (handleApiSessionError(response.status, payload.code)) return;
        throw new Error(payload.message || "تعذر تعديل حالة المستخدم");
      }

      window.alert(
        user.is_active
          ? "تم تعطيل المستخدم بنجاح"
          : "تم تفعيل المستخدم بنجاح"
      );

      await loadLists();
    } catch (error) {
      console.error("Toggle finance user error:", error);
      window.alert(getErrorMessage(error, "تعذر تعديل حالة المستخدم"));
    } finally {
      setProcessingUserId(null);
    }
  }

  async function deleteUser(user: FinanceUser) {
    if (PROTECTED_ROLES.includes(user.role)) {
      window.alert("لا يمكن حذف هذا الحساب من هنا");
      return;
    }

    if (user.id === currentUser?.id) {
      window.alert("لا يمكنك حذف حسابك الحالي");
      return;
    }

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف المستخدم ${user.full_name}؟`
    );

    if (!confirmed) return;

    try {
      setProcessingUserId(user.id);

      const response = await fetch(
        `/finance/api/permissions?branch=${encodeURIComponent(branch)}&userId=${encodeURIComponent(user.id)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        }
      );

      const payload = await readApiResponse(response);

      if (!response.ok || payload.ok === false) {
        if (handleApiSessionError(response.status, payload.code)) return;
        throw new Error(payload.message || "تعذر حذف المستخدم");
      }

      window.alert("تم حذف المستخدم بنجاح");
      await loadLists();
    } catch (error) {
      console.error("Delete finance user error:", error);
      window.alert(getErrorMessage(error, "تعذر حذف المستخدم"));
    } finally {
      setProcessingUserId(null);
    }
  }

  async function createInvestor() {
    if (!investorNameInput.trim()) {
      window.alert("يرجى إدخال اسم المستثمر");
      return;
    }

    if (investorNationalId && !/^\d{10}$/.test(investorNationalId)) {
      window.alert("رقم الهوية يجب أن يتكون من 10 أرقام");
      return;
    }

    if (investorPhone && !/^05\d{8}$/.test(investorPhone)) {
      window.alert("رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام");
      return;
    }

    try {
      setSavingInvestor(true);

      const response = await fetch("/finance/api/permissions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          action: "create-investor",
          branch,
          investorName: investorNameInput.trim(),
          nationalId: investorNationalId || null,
          phone: investorPhone || null,
          notes: investorNotes.trim() || null,
        }),
      });

      const payload = await readApiResponse(response);

      if (!response.ok || payload.ok === false) {
        if (handleApiSessionError(response.status, payload.code)) return;
        throw new Error(payload.message || "تعذر إنشاء المستثمر");
      }

      setInvestorNameInput("");
      setInvestorNationalId("");
      setInvestorPhone("");
      setInvestorNotes("");

      window.alert("تم إنشاء المستثمر بنجاح دون إنشاء حساب دخول");

      if (await loadLists()) {
        setActiveTab("investors");
      }
    } catch (error) {
      console.error("Create investor error:", error);
      window.alert(getErrorMessage(error, "تعذر إنشاء المستثمر"));
    } finally {
      setSavingInvestor(false);
    }
  }

  function getInvestorName(investorId?: string | null) {
    if (!investorId) return "-";

    return (
      investors.find((investor) => investor.id === investorId)
        ?.investor_name || "-"
    );
  }

  function logout() {
    logoutFinanceUser(router);
  }

  if (!authChecked || loading) {
    return (
      <main dir="rtl" style={getPageStyle(isMobile)}>
        <div style={loadingBox}>
          جاري تحميل إدارة الموظفين والصلاحيات...
        </div>
        <GlobalStyles />
      </main>
    );
  }

  return (
    <main dir="rtl" style={getPageStyle(isMobile)}>
      <div style={getContainerStyle(isCompact)}>
        <header style={getHeroStyle(isMobile)}>
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div style={getHeroContentStyle(screen)}>
            <div style={getHeroUserCardStyle(screen)}>
              <div style={getEmployeeTopRowStyle(screen)}>
                <div style={employeeIcon}>
                  <UserIcon />
                </div>

                <div style={getEmployeeNameStyle(isMobile)}>
                  {employeeName}
                </div>

                {!isMobile && <div style={employeeDividerSmall} />}

                <button type="button" style={logoutInlineButton} onClick={logout}>
                  <LogoutIcon />
                  <span>تسجيل الخروج</span>
                </button>
              </div>

              <button
                type="button"
                style={getMainWorkstationButtonStyle(isMobile)}
                onClick={() => router.push(`/finance/${branch}`)}
              >
                <HomeIcon />
                <span>محطة العمل الرئيسية</span>
              </button>
            </div>

            <div style={getHeroTitleBoxStyle(screen)}>
              <h1 style={getTitleStyle(screen)}>
                إدارة الموظفين والصلاحيات
              </h1>
            </div>

            <div style={getHeroActionBoxStyle(screen)} />
          </div>
        </header>

        {activeTab === null && (
          <section style={managementMenu}>
            <ManagementOption
              title="إنشاء مستخدم جديد"
              icon={<UserPlusIcon />}
              onClick={() => void openProtectedTab("create-user")}
            />

            <ManagementOption
              title="إدارة المستخدمين"
              icon={<UsersIcon />}
              onClick={() => void openProtectedTab("users")}
            />

            <ManagementOption
              title="إنشاء مستثمر"
              icon={<InvestorAddIcon />}
              onClick={() => void openProtectedTab("create-investor")}
            />

            <ManagementOption
              title="عرض المستثمرين"
              icon={<InvestorsIcon />}
              onClick={() => void openProtectedTab("investors")}
            />
          </section>
        )}

        {activeTab !== null && (
          <div style={sectionNavigation}>
            <button
              type="button"
              style={sectionBackButton}
              onClick={returnToMainOptions}
            >
              → العودة للخيارات
            </button>
          </div>
        )}

        {activeTab === "create-user" && (
          <section style={card}>
            <div style={cardHeadingRow}>
              <h2 style={sectionTitle}>
                {editingUserId ? "تعديل المستخدم" : "إنشاء مستخدم جديد"}
              </h2>

              {editingUserId && (
                <button
                  type="button"
                  style={cancelEditButton}
                  onClick={() => {
                    resetUserForm();
                    setActiveTab("users");
                  }}
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            <div style={formGrid}>
              <Field label="الاسم الكامل">
                <input
                  className="permissions-input"
                  style={input}
                  value={employeeNameInput}
                  onChange={(event) => setEmployeeNameInput(event.target.value)}
                  placeholder="مثال: محمد أحمد"
                />
              </Field>

              <Field label="اسم المستخدم">
                <input
                  className="permissions-input"
                  style={input}
                  value={employeeUsername}
                  onChange={(event) =>
                    setEmployeeUsername(
                      normalizeUsernameInput(event.target.value)
                    )
                  }
                  placeholder="أحرف إنجليزية أو أرقام"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={30}
                  dir="ltr"
                />
              </Field>

              <Field
                label={
                  editingUserId
                    ? "كلمة مرور جديدة - اختيارية"
                    : "كلمة المرور - من 4 إلى 10 أحرف أو أرقام"
                }
              >
                <input
                  className="permissions-input"
                  style={input}
                  type="password"
                  inputMode="text"
                  maxLength={10}
                  value={employeePassword}
                  onChange={(event) =>
                    setEmployeePassword(
                      normalizePasswordInput(event.target.value)
                    )
                  }
                  placeholder={
                    editingUserId
                      ? "اتركها فارغة دون تغيير"
                      : "من 4 إلى 10 أحرف أو أرقام"
                  }
                  autoComplete="new-password"
                  dir="ltr"
                />
              </Field>
            </div>

            <h3 style={smallTitle}>نوع المستخدم</h3>

            <div style={getRoleGridStyle(isMobile)}>
              {(["مدير", "موظف", "مستثمر"] as UserRole[]).map((role) => (
                <label
                  key={role}
                  style={selectedRole === role ? selectedRoleBox : roleBox}
                >
                  <input
                    type="radio"
                    name="finance-user-role"
                    checked={selectedRole === role}
                    onChange={() => handleRoleChange(role)}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>

            {selectedRole === "مستثمر" && (
              <div style={investorAccountBox}>
                <Field label="المستثمر المرتبط بالحساب">
                  <select
                    className="permissions-input"
                    style={input}
                    value={selectedInvestorId}
                    onChange={(event) =>
                      setSelectedInvestorId(event.target.value)
                    }
                  >
                    <option value="">اختر المستثمر</option>

                    {availableInvestorsForAccount.map((investor) => (
                      <option key={investor.id} value={investor.id}>
                        {investor.investor_name}
                        {investor.national_id
                          ? ` - ${investor.national_id}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <div style={investorNotice}>
                  حساب المستثمر يظهر له سير العمل وبياناته الاستثمارية وعقوده فقط.
                </div>
              </div>
            )}

            <h3 style={smallTitle}>الصلاحيات</h3>

            <PermissionGroups
              selectedPermissions={selectedPermissions}
              disabled={selectedRole === "مستثمر"}
              onToggle={togglePermission}
            />

            <button
              type="button"
              style={{
                ...saveButton,
                opacity: savingUser ? 0.65 : 1,
                cursor: savingUser ? "not-allowed" : "pointer",
              }}
              onClick={() => void saveUser()}
              disabled={savingUser}
            >
              {savingUser
                ? "جاري الحفظ..."
                : editingUserId
                  ? "حفظ تعديلات المستخدم"
                  : "إنشاء المستخدم"}
            </button>
          </section>
        )}

        {activeTab === "users" && (
          <section style={card}>
            <div style={cardHeadingRow}>
              <h2 style={sectionTitle}>إدارة المستخدمين</h2>

              <button
                type="button"
                style={addSmallButton}
                onClick={() => {
                  resetUserForm();
                  setActiveTab("create-user");
                }}
              >
                + مستخدم جديد
              </button>
            </div>

            {users.length === 0 ? (
              <div style={emptyBox}>لا توجد بيانات مستخدمين.</div>
            ) : (
              <div style={usersList}>
                {users.map((user) => {
                  const isProtected = PROTECTED_ROLES.includes(user.role);
                  const isCurrent = user.id === currentUser?.id;
                  const isProcessing = processingUserId === user.id;

                  return (
                    <article key={user.id} style={getUserCardStyle(isMobile)}>
                      <div style={userInformation}>
                        <div style={userTitleRow}>
                          <strong style={userFullName}>
                            {user.full_name || "-"}
                          </strong>

                          <span style={user.is_active ? activeBadge : inactiveBadge}>
                            {user.is_active ? "نشط" : "معطل"}
                          </span>

                          {isProtected && (
                            <span style={protectedBadge}>حساب محمي</span>
                          )}
                        </div>

                        <div style={mutedText}>
                          اسم المستخدم: {user.username || "-"}
                        </div>

                        <div style={mutedText}>النوع: {user.role || "-"}</div>

                        {user.role === "مستثمر" && (
                          <div style={mutedText}>
                            المستثمر: {getInvestorName(user.investor_id)}
                          </div>
                        )}

                        <div style={permissionTags}>
                          {(user.permissions || []).length === 0 ? (
                            <span style={noPermissionTag}>لا توجد صلاحيات</span>
                          ) : (
                            (user.permissions || []).map((permission) => (
                              <span key={permission} style={permissionTag}>
                                {getPermissionLabel(permission)}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div style={userActions}>
                        <button
                          type="button"
                          style={actionStyle(
                            editSmallButton,
                            isProtected || isProcessing
                          )}
                          disabled={isProtected || isProcessing}
                          onClick={() => beginEditUser(user)}
                        >
                          تعديل
                        </button>

                        <button
                          type="button"
                          style={actionStyle(
                            graySmallButton,
                            isProtected || isCurrent || isProcessing
                          )}
                          disabled={isProtected || isCurrent || isProcessing}
                          onClick={() => void toggleUserStatus(user)}
                        >
                          {isProcessing
                            ? "جاري التنفيذ..."
                            : user.is_active
                              ? "تعطيل"
                              : "تفعيل"}
                        </button>

                        <button
                          type="button"
                          style={actionStyle(
                            dangerSmallButton,
                            isProtected || isCurrent || isProcessing
                          )}
                          disabled={isProtected || isCurrent || isProcessing}
                          onClick={() => void deleteUser(user)}
                        >
                          حذف
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === "create-investor" && (
          <section style={card}>
            <h2 style={sectionTitle}>إنشاء مستثمر</h2>

            <div style={investorNotice}>
              إنشاء المستثمر هنا ينشئ سجلًا استثماريًا فقط، ولا ينشئ له حساب دخول تلقائيًا.
            </div>

            <div style={formGrid}>
              <Field label="اسم المستثمر">
                <input
                  className="permissions-input"
                  style={input}
                  value={investorNameInput}
                  onChange={(event) => setInvestorNameInput(event.target.value)}
                  placeholder="اسم المستثمر"
                />
              </Field>

              <Field label="رقم الهوية - اختياري">
                <input
                  className="permissions-input"
                  style={input}
                  inputMode="numeric"
                  maxLength={10}
                  value={investorNationalId}
                  onChange={(event) =>
                    setInvestorNationalId(
                      normalizeIdentifierDigits(event.target.value, 10)
                    )
                  }
                  placeholder="10 أرقام"
                />
              </Field>

              <Field label="رقم الجوال - اختياري">
                <input
                  className="permissions-input"
                  style={input}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={investorPhone}
                  onChange={(event) =>
                    setInvestorPhone(
                      normalizeIdentifierDigits(event.target.value, 10)
                    )
                  }
                  placeholder="05xxxxxxxx"
                />
              </Field>
            </div>

            <Field label="ملاحظات - اختياري">
              <textarea
                className="permissions-input"
                style={textarea}
                value={investorNotes}
                onChange={(event) => setInvestorNotes(event.target.value)}
                rows={4}
                placeholder="ملاحظات المستثمر"
              />
            </Field>

            <button
              type="button"
              style={{
                ...saveButton,
                opacity: savingInvestor ? 0.65 : 1,
                cursor: savingInvestor ? "not-allowed" : "pointer",
              }}
              onClick={() => void createInvestor()}
              disabled={savingInvestor}
            >
              {savingInvestor ? "جاري الحفظ..." : "إنشاء المستثمر"}
            </button>
          </section>
        )}

        {activeTab === "investors" && (
          <section style={card}>
            <div style={cardHeadingRow}>
              <h2 style={sectionTitle}>المستثمرون</h2>

              <button
                type="button"
                style={addSmallButton}
                onClick={() => setActiveTab("create-investor")}
              >
                + مستثمر جديد
              </button>
            </div>

            {investors.length === 0 ? (
              <div style={emptyBox}>لا يوجد مستثمرون حتى الآن.</div>
            ) : (
              <div style={investorsGrid}>
                {investors.map((investor) => {
                  const account = users.find(
                    (user) => user.investor_id === investor.id
                  );

                  return (
                    <article key={investor.id} style={investorCard}>
                      <div style={investorCardTop}>
                        <strong>{investor.investor_name}</strong>

                        <span
                          style={
                            investor.is_active === false
                              ? inactiveBadge
                              : activeBadge
                          }
                        >
                          {investor.is_active === false ? "معطل" : "نشط"}
                        </span>
                      </div>

                      <div style={mutedText}>
                        الهوية: {investor.national_id || "-"}
                      </div>

                      <div style={mutedText}>
                        الجوال: {investor.phone || "-"}
                      </div>

                      <div style={account ? linkedAccountBox : noAccountBox}>
                        {account
                          ? `حساب الدخول: ${account.username}`
                          : "لا يوجد حساب دخول"}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <div style={backWrapper}>
          <button
            type="button"
            style={backButton}
            onClick={() => router.back()}
          >
            ← رجوع
          </button>
        </div>
      </div>

      <GlobalStyles />
    </main>
  );
}

function ManagementOption({
  title,
  icon,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="management-option"
      style={managementOptionCard}
      onClick={onClick}
    >
      <span style={managementOptionIcon}>{icon}</span>
      <span style={managementOptionContent}>
        <strong style={managementOptionTitle}>{title}</strong>
      </span>
      <span style={managementOptionArrow}>←</span>
    </button>
  );
}

function PermissionGroups({
  selectedPermissions,
  disabled = false,
  onToggle,
}: PermissionGroupsProps) {
  return (
    <div style={permissionGroups}>
      {PERMISSION_GROUPS.map((group) => (
        <section key={group.title} style={permissionGroupCard}>
          <h4 style={permissionGroupTitle}>{group.title}</h4>

          <div style={permissionChecksGrid}>
            {group.permissions.map((permission) => (
              <label
                key={permission.key}
                style={
                  selectedPermissions.includes(permission.key)
                    ? selectedPermissionBox
                    : permissionBox
                }
              >
                <input
                  type="checkbox"
                  checked={selectedPermissions.includes(permission.key)}
                  disabled={disabled}
                  onChange={() => onToggle(permission.key)}
                />
                <span>{permission.label}</span>
              </label>
            ))}
          </div>
        </section>
      ))}

      {disabled && (
        <div style={investorNotice}>
          صلاحيات المستثمر ثابتة ومحددة بسير العمل وبياناته الاستثمارية وعقوده فقط.
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: FieldProps) {
  return (
    <div style={fieldBox}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function GlobalStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        overflow-x: hidden;
      }

      button,
      input,
      select,
      textarea {
        font-family: var(--font-almarai), sans-serif;
      }

      .permissions-input {
        transition:
          border-color 0.18s ease,
          box-shadow 0.18s ease,
          background 0.18s ease;
      }

      .permissions-input:focus {
        outline: none !important;
        border-color: #3b82f6 !important;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.11) !important;
        background: #ffffff !important;
      }

      .management-option {
        transition:
          transform 0.18s ease,
          border-color 0.18s ease,
          box-shadow 0.18s ease;
      }

      .management-option:hover {
        transform: translateY(-2px);
        border-color: #93c5fd !important;
        box-shadow: 0 13px 28px rgba(15, 23, 42, 0.08) !important;
      }

      button:disabled {
        filter: grayscale(0.12);
      }
    `}</style>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

function getPermissionLabel(permissionKey: string) {
  if (permissionKey === "investor_data") return "البيانات الاستثمارية";
  if (permissionKey === "investor_contracts") return "عقود المستثمر";

  for (const group of PERMISSION_GROUPS) {
    const permission = group.permissions.find(
      (item) => item.key === permissionKey
    );

    if (permission) return permission.label;
  }

  return permissionKey;
}

function actionStyle(base: CSSProperties, disabled: boolean): CSSProperties {
  return {
    ...base,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.8 20.2c.8-3.5 3.6-5.4 7.2-5.4s6.4 1.9 7.2 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 19c.7-3.2 2.8-5 5.7-5 1.6 0 3 .5 4 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.5 12.5v7M14 16h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 19c.7-3.2 2.9-5 6-5s5.3 1.8 6 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.2 10.8a3 3 0 1 0 0-5.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 14.3c2 .5 3.4 2 4 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function InvestorAddIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8.5h12v10H4v-10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 8.5V6.8c0-1 .8-1.8 1.8-1.8h2.4c1 0 1.8.8 1.8 1.8v1.7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M18.5 11.5v7M15 15h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function InvestorsIcon() {
  return (
    <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8h16v11H4V8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 8V6.5A1.5 1.5 0 0 1 9.5 5h5A1.5 1.5 0 0 1 16 6.5V8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 12.5h16M10 12.5v2h4v-2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9.5 7V5.8c0-1 .8-1.8 1.8-1.8h6.1c1 0 1.8.8 1.8 1.8v12.4c0 1-.8 1.8-1.8 1.8h-6.1c-1 0-1.8-.8-1.8-1.8V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4.8 12h9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.8 8.8 4.6 12l3.2 3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.8 11.2 12 4.5l8.2 6.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.2 10.4v9.1h11.6v-9.1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 19.5v-5.2h4v5.2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function getPageStyle(isMobile: boolean): CSSProperties {
  return {
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
    backgroundAttachment: isMobile ? "scroll" : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily: "var(--font-almarai), sans-serif",
    overflowX: "hidden",
  };
}

function getContainerStyle(isCompact: boolean): CSSProperties {
  return { width: "100%", maxWidth: isCompact ? 980 : 1180, margin: "auto" };
}

function getHeroStyle(isMobile: boolean): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile ? "auto" : 160,
    borderRadius: isMobile ? 20 : 24,
    padding: isMobile ? "18px 14px" : "22px 26px",
    marginBottom: 14,
    overflow: "hidden",
    border: "none",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    isolation: "isolate",
  };
}

function getHeroContentStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      position: "relative",
      zIndex: 3,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "center",
      gap: 16,
      direction: "rtl",
    };
  }

  if (screen === "tablet") {
    return {
      position: "relative",
      zIndex: 3,
      display: "grid",
      gridTemplateColumns: "1fr",
      justifyItems: "center",
      alignItems: "center",
      gap: 18,
      direction: "rtl",
    };
  }

  return {
    position: "relative",
    zIndex: 3,
    minHeight: 116,
    display: "grid",
    gridTemplateColumns: "minmax(250px,315px) 1fr minmax(220px,315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(screen: ScreenType): CSSProperties {
  if (screen === "mobile") {
    return {
      width: "100%",
      display: "grid",
      gap: 12,
      direction: "rtl",
      justifyItems: "center",
      order: 2,
    };
  }

  if (screen === "tablet") {
    return {
      width: "100%",
      maxWidth: 520,
      display: "grid",
      gap: 14,
      direction: "rtl",
      justifyItems: "center",
      order: 2,
    };
  }

  return {
    width: "100%",
    maxWidth: 315,
    display: "grid",
    gap: 24,
    direction: "ltr",
    justifySelf: "start",
  };
}

function getEmployeeTopRowStyle(screen: ScreenType): CSSProperties {
  return {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: screen === "desktop" ? "flex-start" : "center",
    flexWrap: "wrap",
    gap: 12,
    direction: screen === "desktop" ? "ltr" : "rtl",
    color: "#ffffff",
    width: "100%",
  };
}

function getEmployeeNameStyle(isMobile: boolean): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getMainWorkstationButtonStyle(isMobile: boolean): CSSProperties {
  return {
    width: isMobile ? "100%" : 220,
    maxWidth: isMobile ? 280 : 220,
    height: 44,
    border: "none",
    background: "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(screen: ScreenType): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order: screen === "desktop" ? 0 : 1,
  };
}

function getTitleStyle(screen: ScreenType): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize: screen === "mobile" ? 24 : screen === "tablet" ? 28 : 30,
    lineHeight: 1.4,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow: "0 5px 14px rgba(15,23,42,0.14)",
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

function getHeroActionBoxStyle(screen: ScreenType): CSSProperties {
  return { display: screen === "desktop" ? "flex" : "none" };
}

function getUserCardStyle(isMobile: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) auto",
    gap: 14,
    padding: 15,
    border: "1px solid #e2e8f0",
    borderRadius: 15,
    background: "#fbfdff",
    alignItems: "center",
  };
}

function getRoleGridStyle(isMobile: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))",
    gap: 10,
  };
}

const employeeIcon: CSSProperties = {
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

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background: "rgba(255,255,255,0.30)",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.90)",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  padding: 0,
  whiteSpace: "nowrap",
  direction: "rtl",
};

const heroCircleOne: CSSProperties = {
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

const heroCircleTwo: CSSProperties = {
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

const heroCircleThree: CSSProperties = {
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

const heroDots: CSSProperties = {
  position: "absolute",
  top: 28,
  right: 34,
  width: 84,
  height: 58,
  opacity: 0.24,
  backgroundImage: "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const managementMenu: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 14,
  marginBottom: 18,
};

const managementOptionCard: CSSProperties = {
  width: "100%",
  minHeight: 108,
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: "18px 20px",
  display: "grid",
  gridTemplateColumns: "auto minmax(0,1fr) auto",
  alignItems: "center",
  gap: 14,
  color: "#0d47a1",
  cursor: "pointer",
  textAlign: "right",
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const managementOptionIcon: CSSProperties = {
  width: 50,
  height: 50,
  borderRadius: 15,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
  color: "#1d4ed8",
};

const managementOptionContent: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 5,
};

const managementOptionTitle: CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#0d47a1",
};

const managementOptionArrow: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#2563eb",
};

const sectionNavigation: CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
  marginBottom: 12,
};

const sectionBackButton: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 11,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const card: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
};

const cardHeadingRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const sectionTitle: CSSProperties = {
  margin: "0 0 16px",
  color: "#0d47a1",
};

const smallTitle: CSSProperties = {
  color: "#0d47a1",
  margin: "18px 0 10px",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
  gap: 12,
};

const fieldBox: CSSProperties = { marginBottom: 12 };

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 14,
};

const input: CSSProperties = {
  width: "100%",
  padding: 13,
  borderRadius: 13,
  border: "1px solid #d9e3f5",
  fontSize: 15,
  background: "#ffffff",
  color: "#0f172a",
  outline: "none",
};

const textarea: CSSProperties = {
  ...input,
  resize: "vertical",
};

const roleBox: CSSProperties = {
  border: "1px solid #d9e3f5",
  background: "#f8fbff",
  borderRadius: 14,
  padding: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const selectedRoleBox: CSSProperties = {
  ...roleBox,
  border: "1px solid #2563eb",
  background: "#eff6ff",
  color: "#0d47a1",
};

const investorAccountBox: CSSProperties = {
  marginTop: 14,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 15,
  padding: 14,
};

const investorNotice: CSSProperties = {
  background: "#eff6ff",
  color: "#1e3a8a",
  border: "1px solid #bfdbfe",
  borderRadius: 13,
  padding: 12,
  fontSize: 14,
  fontWeight: 800,
  lineHeight: 1.7,
  marginBottom: 14,
};

const permissionGroups: CSSProperties = {
  display: "grid",
  gap: 12,
};

const permissionGroupCard: CSSProperties = {
  border: "1px solid #d9e3f5",
  background: "#fbfdff",
  borderRadius: 15,
  padding: 14,
};

const permissionGroupTitle: CSSProperties = {
  margin: "0 0 10px",
  color: "#0d47a1",
  fontSize: 15,
};

const permissionChecksGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 9,
};

const permissionBox: CSSProperties = {
  border: "1px solid #d9e3f5",
  background: "#ffffff",
  borderRadius: 11,
  padding: 11,
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const selectedPermissionBox: CSSProperties = {
  ...permissionBox,
  border: "1px solid #60a5fa",
  background: "#eff6ff",
  color: "#1e3a8a",
};

const saveButton: CSSProperties = {
  width: "100%",
  padding: 15,
  background: "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: 900,
  marginTop: 18,
  cursor: "pointer",
};

const cancelEditButton: CSSProperties = {
  padding: "9px 13px",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 900,
  cursor: "pointer",
};

const addSmallButton: CSSProperties = {
  padding: "9px 13px",
  border: "none",
  borderRadius: 10,
  background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const usersList: CSSProperties = {
  display: "grid",
  gap: 12,
};

const userInformation: CSSProperties = { minWidth: 0 };

const userTitleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const userFullName: CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
};

const userActions: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const mutedText: CSSProperties = {
  color: "#64748b",
  fontSize: 13,
  marginTop: 5,
};

const permissionTags: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 10,
};

const permissionTag: CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 11,
  fontWeight: 800,
};

const noPermissionTag: CSSProperties = {
  ...permissionTag,
  background: "#f8fafc",
  color: "#64748b",
  border: "1px solid #e2e8f0",
};

const activeBadge: CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 900,
  fontSize: 12,
};

const inactiveBadge: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 900,
  fontSize: 12,
};

const protectedBadge: CSSProperties = {
  background: "#f1f5f9",
  color: "#475569",
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 900,
  fontSize: 11,
};

const editSmallButton: CSSProperties = {
  background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 900,
};

const graySmallButton: CSSProperties = {
  background: "#e5e7eb",
  color: "#334155",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 900,
};

const dangerSmallButton: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 900,
};

const investorsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
  gap: 12,
};

const investorCard: CSSProperties = {
  border: "1px solid #d9e3f5",
  borderRadius: 15,
  padding: 14,
  background: "#fbfdff",
};

const investorCardTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 8,
};

const linkedAccountBox: CSSProperties = {
  marginTop: 10,
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #bbf7d0",
  borderRadius: 10,
  padding: 9,
  fontSize: 12,
  fontWeight: 900,
};

const noAccountBox: CSSProperties = {
  marginTop: 10,
  background: "#f8fafc",
  color: "#64748b",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 9,
  fontSize: 12,
  fontWeight: 900,
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #cbd5e1",
  borderRadius: 14,
  padding: 18,
  textAlign: "center",
  color: "#6b7280",
};

const backWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 18,
};

const backButton: CSSProperties = {
  padding: "11px 18px",
  background: "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 5px 14px rgba(22,163,74,0.22)",
};

const loadingBox: CSSProperties = {
  maxWidth: 850,
  margin: "80px auto",
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 24,
  textAlign: "center",
  color: "#0d47a1",
  fontWeight: 900,
};
