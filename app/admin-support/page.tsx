"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";

const SUPPORT_PERMISSIONS = [
  { key: "manage_branches", label: "إدارة الفروع" },
  { key: "manage_support_users", label: "إدارة مستخدمي الدعم" },
  { key: "system_settings", label: "إعدادات النظام" },
  { key: "impersonate_branch", label: "الدخول للفروع" },
  { key: "view_logs", label: "عرض السجلات" },
  { key: "backup_restore", label: "النسخ والاستعادة" },
  {
    key: "manage_verification_results",
    label: "إدارة نتائج التحقق",
  },
] as const;

const SUPPORT_ROLES = ["support", "viewer", "super_admin"] as const;

const VERIFICATION_POSITIONS = ["نشط", "متأخر", "متعثر"] as const;

type SupportPermission = (typeof SUPPORT_PERMISSIONS)[number]["key"];
type SupportRole = (typeof SUPPORT_ROLES)[number];
type VerificationPosition = (typeof VERIFICATION_POSITIONS)[number];

type ScreenType = "mobile" | "tablet" | "desktop";

type TabType =
  | "overview"
  | "branches"
  | "branch_managers"
  | "users"
  | "verifications"
  | "logs";

type CurrentUser = {
  id: string;
  full_name: string;
  username: string;
  role: string;
  permissions: string[];
};

type DashboardAccess = {
  manage_branches: boolean;
  impersonate_branch: boolean;
  manage_support_users: boolean;
  view_logs: boolean;
  system_settings: boolean;
  backup_restore: boolean;
  manage_verification_results: boolean;
};

type Branch = {
  id: string;
  branch_name: string;
  branch_slug: string;
  organization_name: string;
  city: string | null;
  commercial_record: string | null;
  phone: string | null;
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
  permissions: string[];
};

type BranchRelation = {
  branch_name: string;
  branch_slug: string;
  organization_name: string;
};

type BranchManager = {
  id: string;
  branch_id: string;
  full_name: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
  finance_branches?: BranchRelation | BranchRelation[] | null;
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

type VerificationContract = {
  contract_id: string;
  contract_number: string | null;

  branch_id: string;
  branch_name: string;
  branch_slug: string;

  customer_id: string;
  customer_name: string;
  national_id: string;
  customer_phone: string;

  debt_amount: number;
  paid_amount: number;
  remaining_amount: number;

  payment_due_date: string | null;
  contract_date: string | null;
  contract_state: string;

  automatic_position: VerificationPosition;
  effective_position: VerificationPosition;

  has_support_override: boolean;
  override_position: VerificationPosition | null;
  override_reason: string | null;
  override_notes: string | null;
  override_updated_at: string | null;

  default_declared_at: string | null;
  default_expires_at: string | null;
  default_reason: string | null;
  default_notes: string | null;
};

type DashboardResponse = {
  ok: boolean;
  message?: string;
  user?: CurrentUser;
  access?: DashboardAccess;
  branches?: Branch[];
  branch_managers?: BranchManager[];
  support_users?: SupportUser[];
  logs?: SupportLog[];
};

type ApiResponse<T = unknown> = {
  ok: boolean;
  message?: string;
  data?: T;
  redirect_url?: string;
};

type BusyAction =
  | "dashboard"
  | "save_branch"
  | "logout"
  | "create_support_user"
  | "verification_search"
  | `branch_status:${string}`
  | `branch_enter:${string}`
  | `manager_status:${string}`
  | `manager_password:${string}`
  | `support_status:${string}`
  | `support_permissions:${string}`
  | `verification_set:${string}`
  | `verification_clear:${string}`
  | null;

const EMPTY_ACCESS: DashboardAccess = {
  manage_branches: false,
  impersonate_branch: false,
  manage_support_users: false,
  view_logs: false,
  system_settings: false,
  backup_restore: false,
  manage_verification_results: false,
};

export default function AdminSupportPage() {
  const router = useRouter();

  const [screen, setScreen] = useState<ScreenType>("desktop");

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [access, setAccess] = useState<DashboardAccess>(EMPTY_ACCESS);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchManagers, setBranchManagers] = useState<BranchManager[]>([]);
  const [supportUsers, setSupportUsers] = useState<SupportUser[]>([]);
  const [logs, setLogs] = useState<SupportLog[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>("dashboard");
  const [pageError, setPageError] = useState("");

  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  const [branchName, setBranchName] = useState("");
  const [branchSlug, setBranchSlug] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [branchCity, setBranchCity] = useState("");
  const [branchCommercialRecord, setBranchCommercialRecord] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [branchNotes, setBranchNotes] = useState("");

  const [managerFullName, setManagerFullName] = useState("");
  const [managerUsername, setManagerUsername] = useState("");
  const [managerPassword, setManagerPassword] = useState("");

  const [showUserForm, setShowUserForm] = useState(false);
  const [supportFullName, setSupportFullName] = useState("");
  const [supportUsername, setSupportUsername] = useState("");
  const [supportPassword, setSupportPassword] = useState("");
  const [supportRole, setSupportRole] = useState<SupportRole>("support");

  const [selectedPermissions, setSelectedPermissions] = useState<
    SupportPermission[]
  >([]);

  const [editingPermissionsUserId, setEditingPermissionsUserId] = useState<
    string | null
  >(null);

  const [editingPermissions, setEditingPermissions] = useState<
    SupportPermission[]
  >([]);

  const [verificationSearchValue, setVerificationSearchValue] = useState("");
  const [verificationResults, setVerificationResults] = useState<
    VerificationContract[]
  >([]);

  const [verificationSearchPerformed, setVerificationSearchPerformed] =
    useState(false);

  const [editingVerificationContractId, setEditingVerificationContractId] =
    useState<string | null>(null);

  const [verificationPosition, setVerificationPosition] =
    useState<VerificationPosition>("نشط");

  const [verificationReason, setVerificationReason] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      const width = window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
        return;
      }

      if (width < 1024) {
        setScreen("tablet");
        return;
      }

      setScreen("desktop");
    }

    updateScreen();
    window.addEventListener("resize", updateScreen);

    return () => {
      window.removeEventListener("resize", updateScreen);
    };
  }, []);

  const redirectToLogin = useCallback(() => {
    router.replace("/admin-support/login");
    router.refresh();
  }, [router]);

  const apiRequest = useCallback(
    async <T,>(
      url: string,
      options?: RequestInit
    ): Promise<ApiResponse<T>> => {
      try {
        const response = await fetch(url, {
          ...options,
          credentials: "include",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            ...(options?.headers || {}),
          },
        });

        let payload: ApiResponse<T>;

        try {
          payload = (await response.json()) as ApiResponse<T>;
        } catch {
          payload = {
            ok: false,
            message: "تعذر قراءة استجابة الخادم",
          };
        }

        if (response.status === 401) {
          redirectToLogin();

          return {
            ok: false,
            message: payload.message || "انتهت جلسة الدخول",
          };
        }

        if (!response.ok || !payload.ok) {
          return {
            ok: false,
            message:
              payload.message ||
              `تعذر تنفيذ الطلب، رمز الاستجابة ${response.status}`,
          };
        }

        return payload;
      } catch (error) {
        console.error("Admin support request failed:", error);

        return {
          ok: false,
          message: "تعذر الاتصال بالخادم، تحقق من اتصال الإنترنت",
        };
      }
    },
    [redirectToLogin]
  );

  const loadDashboard = useCallback(
    async (showFullLoader = false) => {
      if (showFullLoader) {
        setLoading(true);
      }

      setBusyAction("dashboard");
      setPageError("");

      try {
        const response = await fetch("/api/admin-support/dashboard", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        let payload: DashboardResponse;

        try {
          payload = (await response.json()) as DashboardResponse;
        } catch {
          payload = {
            ok: false,
            message: "تعذر قراءة بيانات لوحة الدعم",
          };
        }

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        if (!response.ok || !payload.ok || !payload.user || !payload.access) {
          setPageError(payload.message || "تعذر تحميل لوحة الدعم");
          return;
        }

        setCurrentUser(payload.user);
        setAccess({
          ...EMPTY_ACCESS,
          ...payload.access,
        });

        setBranches(Array.isArray(payload.branches) ? payload.branches : []);

        setBranchManagers(
          Array.isArray(payload.branch_managers)
            ? payload.branch_managers
            : []
        );

        setSupportUsers(
          Array.isArray(payload.support_users) ? payload.support_users : []
        );

        setLogs(Array.isArray(payload.logs) ? payload.logs : []);
      } catch (error) {
        console.error("Dashboard load failed:", error);
        setPageError("تعذر الاتصال بالخادم أثناء تحميل لوحة الدعم");
      } finally {
        setBusyAction(null);
        setLoading(false);
      }
    },
    [redirectToLogin]
  );

  useEffect(() => {
    void loadDashboard(true);
  }, [loadDashboard]);

  useEffect(() => {
    const tabAllowed =
      activeTab === "overview" ||
      (activeTab === "branches" &&
        (access.manage_branches || access.impersonate_branch)) ||
      (activeTab === "branch_managers" && access.manage_branches) ||
      (activeTab === "users" && access.manage_support_users) ||
      (activeTab === "verifications" &&
        access.manage_verification_results) ||
      (activeTab === "logs" && access.view_logs);

    if (!tabAllowed) {
      setActiveTab("overview");
    }
  }, [access, activeTab]);

  function normalizeDigits(value: string) {
    return value
      .replace(/[٠-٩]/g, (digit) =>
        String("٠١٢٣٤٥٦٧٨٩".indexOf(digit))
      )
      .replace(/[۰-۹]/g, (digit) =>
        String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
      );
  }

  function cleanNumericValue(value: string, maxLength = 30) {
    return normalizeDigits(value)
      .replace(/\D/g, "")
      .slice(0, maxLength);
  }

  function hasPermission(key: SupportPermission) {
    return (
      currentUser?.role === "super_admin" ||
      currentUser?.permissions.includes(key) === true
    );
  }

  function getBranchRelation(manager: BranchManager) {
    const relation = manager.finance_branches;

    if (Array.isArray(relation)) {
      return relation[0] || null;
    }

    return relation || null;
  }

  function validateUsername(value: string) {
    const username = value.trim();

    return (
      username.length >= 3 &&
      username.length <= 30 &&
      /^[A-Za-z0-9_\u0600-\u06FF]+$/.test(username)
    );
  }

  function validatePin(value: string) {
    return /^\d{4}$/.test(value.trim());
  }

  function validateSupportPassword(value: string) {
    return value.length >= 4 && value.length <= 100;
  }

  function showMessage(message?: string) {
    if (message) {
      window.alert(message);
    }
  }

  function resetBranchForm() {
    setEditingBranchId(null);
    setBranchName("");
    setBranchSlug("");
    setOrganizationName("");
    setBranchCity("");
    setBranchCommercialRecord("");
    setBranchPhone("");
    setBranchNotes("");
    setManagerFullName("");
    setManagerUsername("");
    setManagerPassword("");
    setShowBranchForm(false);
  }

  function editBranch(branch: Branch) {
    if (!access.manage_branches) {
      showMessage("لا تملك صلاحية إدارة الفروع");
      return;
    }

    setEditingBranchId(branch.id);
    setBranchName(branch.branch_name || "");
    setBranchSlug(branch.branch_slug || "");
    setOrganizationName(branch.organization_name || "");
    setBranchCity(branch.city || "");
    setBranchCommercialRecord(branch.commercial_record || "");
    setBranchPhone(branch.phone || "");
    setBranchNotes(branch.notes || "");
    setManagerFullName("");
    setManagerUsername("");
    setManagerPassword("");
    setShowBranchForm(true);
    setActiveTab("branches");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveBranch() {
    if (!access.manage_branches) {
      showMessage("لا تملك صلاحية إدارة الفروع");
      return;
    }

    if (busyAction) return;

    const cleanBranchName = branchName.trim();
    const cleanSlug = branchSlug.trim().toLowerCase();
    const cleanOrganizationName = organizationName.trim();
    const cleanManagerFullName = managerFullName.trim();
    const cleanManagerUsername = managerUsername.trim();
    const cleanManagerPassword = managerPassword.trim();

    if (!cleanBranchName) {
      showMessage("اكتب اسم الفرع");
      return;
    }

    if (!cleanSlug) {
      showMessage("اكتب رابط الفرع");
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(cleanSlug)) {
      showMessage(
        "رابط الفرع يقبل الحروف الإنجليزية الصغيرة والأرقام و _ أو - فقط"
      );
      return;
    }

    if (!cleanOrganizationName) {
      showMessage("اكتب اسم المنظمة");
      return;
    }

    if (!editingBranchId) {
      if (!cleanManagerFullName) {
        showMessage("اكتب اسم مدير الفرع");
        return;
      }

      if (!validateUsername(cleanManagerUsername)) {
        showMessage(
          "اسم مستخدم مدير الفرع يجب أن يكون من 3 إلى 30 حرفًا"
        );
        return;
      }

      if (!validatePin(cleanManagerPassword)) {
        showMessage("كلمة مرور مدير الفرع يجب أن تكون 4 أرقام فقط");
        return;
      }
    }

    const requestBody = {
      branch_name: cleanBranchName,
      branch_slug: cleanSlug,
      organization_name: cleanOrganizationName,
      city: branchCity.trim(),
      commercial_record: branchCommercialRecord.trim(),
      phone: branchPhone.trim(),
      notes: branchNotes.trim(),
    };

    setBusyAction("save_branch");

    const response = editingBranchId
      ? await apiRequest(`/api/admin-support/branches/${editingBranchId}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...requestBody,
            is_active:
              branches.find((branch) => branch.id === editingBranchId)
                ?.is_active ?? true,
          }),
        })
      : await apiRequest("/api/admin-support/branches", {
          method: "POST",
          body: JSON.stringify({
            ...requestBody,
            manager_full_name: cleanManagerFullName,
            manager_username: cleanManagerUsername,
            manager_password: cleanManagerPassword,
          }),
        });

    setBusyAction(null);

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    resetBranchForm();

    showMessage(
      response.message ||
        (editingBranchId ? "تم تحديث الفرع" : "تم إنشاء الفرع")
    );

    await loadDashboard();
  }

  async function toggleBranch(branch: Branch) {
    if (!access.manage_branches) {
      showMessage("لا تملك صلاحية إدارة الفروع");
      return;
    }

    if (busyAction) return;

    const nextStatus = !branch.is_active;

    const confirmed = window.confirm(
      nextStatus
        ? `هل تريد تفعيل فرع ${branch.branch_name}؟`
        : `هل تريد تعطيل فرع ${branch.branch_name}؟`
    );

    if (!confirmed) return;

    setBusyAction(`branch_status:${branch.id}`);

    const response = await apiRequest(
      `/api/admin-support/branches/${branch.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          branch_name: branch.branch_name,
          branch_slug: branch.branch_slug,
          organization_name: branch.organization_name,
          city: branch.city || "",
          commercial_record: branch.commercial_record || "",
          phone: branch.phone || "",
          notes: branch.notes || "",
          is_active: nextStatus,
        }),
      }
    );

    setBusyAction(null);

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    showMessage(response.message);
    await loadDashboard();
  }

  async function toggleBranchManager(manager: BranchManager) {
    if (!access.manage_branches) {
      showMessage("لا تملك صلاحية إدارة الفروع");
      return;
    }

    if (busyAction) return;

    const nextStatus = !manager.is_active;

    const confirmed = window.confirm(
      nextStatus
        ? `هل تريد تفعيل المدير ${manager.full_name}؟`
        : `هل تريد تعطيل المدير ${manager.full_name}؟`
    );

    if (!confirmed) return;

    setBusyAction(`manager_status:${manager.id}`);

    const response = await apiRequest(
      `/api/admin-support/branch-managers/${manager.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "set_active",
          is_active: nextStatus,
        }),
      }
    );

    setBusyAction(null);

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    showMessage(response.message);
    await loadDashboard();
  }

  async function resetBranchManagerPassword(manager: BranchManager) {
    if (!access.manage_branches) {
      showMessage("لا تملك صلاحية إدارة الفروع");
      return;
    }

    if (busyAction) return;

    const newPassword = window.prompt(
      `اكتب كلمة مرور جديدة من 4 أرقام للمدير: ${manager.full_name}`
    );

    if (newPassword === null) return;

    const cleanPassword = cleanNumericValue(newPassword, 4);

    if (!validatePin(cleanPassword)) {
      showMessage("كلمة المرور يجب أن تكون 4 أرقام فقط");
      return;
    }

    setBusyAction(`manager_password:${manager.id}`);

    const response = await apiRequest(
      `/api/admin-support/branch-managers/${manager.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "reset_password",
          new_password: cleanPassword,
        }),
      }
    );

    setBusyAction(null);

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    showMessage(response.message || "تم تحديث كلمة المرور بنجاح");
    await loadDashboard();
  }

  async function enterBranch(branch: Branch) {
    if (!access.impersonate_branch) {
      showMessage("لا تملك صلاحية الدخول للفروع");
      return;
    }

    if (!branch.is_active) {
      showMessage("لا يمكن الدخول إلى فرع معطل");
      return;
    }

    if (busyAction) return;

    setBusyAction(`branch_enter:${branch.id}`);

    const response = await apiRequest("/api/admin-support/impersonate", {
      method: "POST",
      body: JSON.stringify({
        branch_id: branch.id,
      }),
    });

    setBusyAction(null);

    if (!response.ok || !response.redirect_url) {
      showMessage(response.message || "تعذر الدخول إلى الفرع");
      return;
    }

    router.push(response.redirect_url);
  }

  function resetUserForm() {
    setSupportFullName("");
    setSupportUsername("");
    setSupportPassword("");
    setSupportRole("support");
    setSelectedPermissions([]);
    setShowUserForm(false);
  }

  async function createSupportUser() {
    if (!access.manage_support_users) {
      showMessage("لا تملك صلاحية إدارة مستخدمي الدعم");
      return;
    }

    if (busyAction) return;

    const cleanFullName = supportFullName.trim();
    const cleanUsername = supportUsername.trim();

    if (!cleanFullName) {
      showMessage("اكتب الاسم");
      return;
    }

    if (cleanFullName.length > 100) {
      showMessage("الاسم طويل جدًا");
      return;
    }

    if (!validateUsername(cleanUsername)) {
      showMessage(
        "اسم المستخدم يجب أن يكون من 3 إلى 30 حرفًا، ويقبل العربي أو الإنجليزي أو الأرقام أو _ فقط"
      );
      return;
    }

    if (!validateSupportPassword(supportPassword)) {
      showMessage("كلمة المرور يجب أن تكون من 4 إلى 100 حرف");
      return;
    }

    if (supportRole === "super_admin" && currentUser?.role !== "super_admin") {
      showMessage("إنشاء مدير نظام متاح لمدير النظام فقط");
      return;
    }

    setBusyAction("create_support_user");

    const response = await apiRequest("/api/admin-support/support-users", {
      method: "POST",
      body: JSON.stringify({
        full_name: cleanFullName,
        username: cleanUsername,
        password: supportPassword,
        role: supportRole,
        permissions: selectedPermissions,
      }),
    });

    setBusyAction(null);

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    resetUserForm();
    showMessage(response.message || "تم إنشاء مستخدم الدعم بنجاح");
    await loadDashboard();
  }

  async function toggleSupportUser(user: SupportUser) {
    if (!access.manage_support_users) {
      showMessage("لا تملك صلاحية إدارة مستخدمي الدعم");
      return;
    }

    if (busyAction) return;

    const nextStatus = !user.is_active;

    const confirmed = window.confirm(
      nextStatus
        ? `هل تريد تفعيل المستخدم ${user.full_name}؟`
        : `هل تريد تعطيل المستخدم ${user.full_name}؟`
    );

    if (!confirmed) return;

    setBusyAction(`support_status:${user.id}`);

    const response = await apiRequest(
      `/api/admin-support/support-users/${user.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "set_active",
          is_active: nextStatus,
        }),
      }
    );

    setBusyAction(null);

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    showMessage(response.message);
    await loadDashboard();
  }

  function openPermissionsEditor(user: SupportUser) {
    if (user.role === "super_admin") {
      showMessage("مدير النظام يملك جميع الصلاحيات تلقائيًا");
      return;
    }

    if (user.id === currentUser?.id) {
      showMessage("لا يمكنك تعديل صلاحيات حسابك الحالي");
      return;
    }

    const allowedPermissions = user.permissions.filter(
      (permission): permission is SupportPermission =>
        SUPPORT_PERMISSIONS.some((item) => item.key === permission)
    );

    setEditingPermissionsUserId(user.id);
    setEditingPermissions(allowedPermissions);
  }

  function closePermissionsEditor() {
    setEditingPermissionsUserId(null);
    setEditingPermissions([]);
  }

  async function saveSupportUserPermissions(user: SupportUser) {
    if (!access.manage_support_users) {
      showMessage("لا تملك صلاحية إدارة مستخدمي الدعم");
      return;
    }

    if (busyAction) return;

    const confirmed = window.confirm(
      `هل تريد حفظ صلاحيات المستخدم ${user.full_name}؟ ستنتهي جلسته الحالية إن كان مسجلًا.`
    );

    if (!confirmed) return;

    setBusyAction(`support_permissions:${user.id}`);

    const response = await apiRequest(
      `/api/admin-support/support-users/${user.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "update_permissions",
          permissions: editingPermissions,
        }),
      }
    );

    setBusyAction(null);

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    closePermissionsEditor();
    showMessage(response.message || "تم تحديث الصلاحيات");
    await loadDashboard();
  }

  function resetVerificationEditor() {
    setEditingVerificationContractId(null);
    setVerificationPosition("نشط");
    setVerificationReason("");
    setVerificationNotes("");
  }

  function openVerificationEditor(contract: VerificationContract) {
    setEditingVerificationContractId(contract.contract_id);

    setVerificationPosition(
      contract.override_position || contract.effective_position || "نشط"
    );

    setVerificationReason("");
    setVerificationNotes(contract.override_notes || "");

    setTimeout(() => {
      document
        .getElementById(`verification-editor-${contract.contract_id}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 50);
  }

  async function searchVerificationContracts() {
    if (!access.manage_verification_results) {
      showMessage("لا تملك صلاحية إدارة نتائج التحقق");
      return;
    }

    if (busyAction) return;

    const searchValue = cleanNumericValue(verificationSearchValue, 30);

    if (!searchValue) {
      showMessage("اكتب رقم الهوية أو رقم العقد");
      return;
    }

    setVerificationSearchValue(searchValue);
    setVerificationSearchPerformed(true);
    setVerificationResults([]);
    resetVerificationEditor();

    setBusyAction("verification_search");

    const response = await apiRequest<VerificationContract[]>(
      "/api/admin-support/verifications/search",
      {
        method: "POST",
        body: JSON.stringify({
          search_value: searchValue,
        }),
      }
    );

    setBusyAction(null);

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    setVerificationResults(Array.isArray(response.data) ? response.data : []);
  }

  async function refreshVerificationSearch() {
    const searchValue = cleanNumericValue(verificationSearchValue, 30);

    if (!searchValue) return;

    const response = await apiRequest<VerificationContract[]>(
      "/api/admin-support/verifications/search",
      {
        method: "POST",
        body: JSON.stringify({
          search_value: searchValue,
        }),
      }
    );

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    setVerificationResults(Array.isArray(response.data) ? response.data : []);
  }

  async function setVerificationOverride(contract: VerificationContract) {
    if (!access.manage_verification_results) {
      showMessage("لا تملك صلاحية إدارة نتائج التحقق");
      return;
    }

    if (busyAction) return;

    const reason = verificationReason.trim();
    const notes = verificationNotes.trim();

    if (reason.length < 3) {
      showMessage("اكتب سبب التعديل، ويجب ألا يقل عن 3 أحرف");
      return;
    }

    if (reason.length > 500) {
      showMessage("سبب التعديل طويل جدًا");
      return;
    }

    if (notes.length > 1000) {
      showMessage("الملاحظات طويلة جدًا");
      return;
    }

    const confirmed = window.confirm(
      `هل تريد جعل نتيجة العقد رقم ${
        contract.contract_number || "-"
      } تظهر بحالة "${verificationPosition}"؟`
    );

    if (!confirmed) return;

    setBusyAction(`verification_set:${contract.contract_id}`);

    const response = await apiRequest(
      `/api/admin-support/verifications/${contract.contract_id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "set_override",
          position: verificationPosition,
          reason,
          notes,
        }),
      }
    );

    setBusyAction(null);

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    resetVerificationEditor();
    showMessage(response.message);

    await refreshVerificationSearch();
  }

  async function clearVerificationOverride(contract: VerificationContract) {
    if (!access.manage_verification_results) {
      showMessage("لا تملك صلاحية إدارة نتائج التحقق");
      return;
    }

    if (busyAction) return;

    const reason = verificationReason.trim();

    if (reason.length < 3) {
      showMessage("اكتب سبب العودة للوضع التلقائي");
      return;
    }

    if (reason.length > 500) {
      showMessage("سبب الإلغاء طويل جدًا");
      return;
    }

    const confirmed = window.confirm(
      `هل تريد إلغاء تدخل الدعم عن العقد رقم ${
        contract.contract_number || "-"
      } والعودة للحسبة التلقائية؟`
    );

    if (!confirmed) return;

    setBusyAction(`verification_clear:${contract.contract_id}`);

    const response = await apiRequest(
      `/api/admin-support/verifications/${contract.contract_id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "clear_override",
          reason,
        }),
      }
    );

    setBusyAction(null);

    if (!response.ok) {
      showMessage(response.message);
      return;
    }

    resetVerificationEditor();
    showMessage(response.message);

    await refreshVerificationSearch();
  }

  async function logout() {
    if (busyAction) return;

    setBusyAction("logout");

    try {
      await fetch("/api/admin-support/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      setBusyAction(null);
      redirectToLogin();
    }
  }

  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.is_active).length,
    [branches]
  );

  const disabledBranches = branches.length - activeBranches;

  const visibleTabs = useMemo(
    () => ({
      branches: access.manage_branches || access.impersonate_branch,
      branchManagers: access.manage_branches,
      users: access.manage_support_users,
      verifications: access.manage_verification_results,
      logs: access.view_logs,
    }),
    [access]
  );

  if (loading) {
    return (
      <main dir="rtl" style={getPageStyle(isCompact)}>
        <section style={loadingCard}>
          <div style={loadingSpinner} />
          <h1 style={loadingTitle}>جاري تحميل لوحة الدعم الفني</h1>
        </section>

        <GlobalResponsiveStyles />
      </main>
    );
  }

  if (pageError && !currentUser) {
    return (
      <main dir="rtl" style={getPageStyle(isCompact)}>
        <section style={errorCard}>
          <h1 style={errorTitle}>تعذر تحميل لوحة الدعم</h1>
          <p style={errorText}>{pageError}</p>

          <button
            type="button"
            style={primaryButton}
            onClick={() => void loadDashboard(true)}
            disabled={busyAction === "dashboard"}
          >
            {busyAction === "dashboard" ? "جاري المحاولة..." : "إعادة المحاولة"}
          </button>
        </section>

        <GlobalResponsiveStyles />
      </main>
    );
  }

  return (
    <main dir="rtl" style={getPageStyle(isCompact)}>
      <div className="support-shell" style={getShellStyle(isCompact)}>
        {!isCompact && (
          <aside className="support-sidebar" style={sidePanel}>
            <BrandBox />

            <SideNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              visibleTabs={visibleTabs}
            />

            <button
              type="button"
              style={getDisabledStyle(logoutButton, busyAction === "logout")}
              onClick={() => void logout()}
              disabled={busyAction !== null}
            >
              {busyAction === "logout" ? "جاري الخروج..." : "تسجيل خروج"}
            </button>
          </aside>
        )}

        <section className="support-main" style={mainPanel}>
          <header style={getHeroStyle(isMobile)}>
            <span style={heroCircleOne} />
            <span style={heroCircleTwo} />
            <span style={heroCircleThree} />
            <span style={heroDots} />

            <div style={heroContent}>
              <div>
                <p style={topLabel}>لوحة الدعم الفني</p>
                <h1 style={getHeroTitleStyle(isMobile)}>
                  إدارة النظام والفروع
                </h1>

                <p style={heroSub}>
                  مرحبًا {currentUser?.full_name || currentUser?.username}
                </p>
              </div>

              <div style={heroUserCard}>
                <span style={heroUserName}>
                  {currentUser?.full_name || currentUser?.username}
                </span>

                <span style={heroUserRole}>
                  {roleLabel(currentUser?.role || "")}
                </span>
              </div>
            </div>
          </header>

          {isCompact && (
            <MobileNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              visibleTabs={visibleTabs}
              onLogout={() => void logout()}
              disabled={busyAction !== null}
            />
          )}

          {pageError && (
            <div style={inlineError}>
              <span>{pageError}</span>

              <button
                type="button"
                style={inlineRetryButton}
                onClick={() => void loadDashboard()}
                disabled={busyAction === "dashboard"}
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          <section className="stats-grid" style={statsGrid}>
            {visibleTabs.branches && (
              <>
                <Stat title="كل الفروع" value={branches.length} />
                <Stat title="الفروع النشطة" value={activeBranches} />
                <Stat title="الفروع المعطلة" value={disabledBranches} />
              </>
            )}

            {visibleTabs.branchManagers && (
              <Stat title="مدراء الفروع" value={branchManagers.length} />
            )}

            {visibleTabs.users && (
              <Stat title="مستخدمو الدعم" value={supportUsers.length} />
            )}
          </section>

          {activeTab === "overview" && (
            <section className="dashboard-grid" style={dashboardGrid}>
              <div style={darkCard}>
                <h2 style={whiteTitle}>لوحة التحكم المركزية</h2>

                <div style={quickActions}>
                  {visibleTabs.branches && (
                    <button
                      type="button"
                      style={quickButton}
                      onClick={() => setActiveTab("branches")}
                    >
                      إدارة الفروع
                    </button>
                  )}

                  {visibleTabs.branchManagers && (
                    <button
                      type="button"
                      style={quickButton}
                      onClick={() => setActiveTab("branch_managers")}
                    >
                      مدراء الفروع
                    </button>
                  )}

                  {visibleTabs.users && (
                    <button
                      type="button"
                      style={quickButton}
                      onClick={() => setActiveTab("users")}
                    >
                      مستخدمو الدعم
                    </button>
                  )}

                  {visibleTabs.verifications && (
                    <button
                      type="button"
                      style={quickButton}
                      onClick={() => setActiveTab("verifications")}
                    >
                      نتائج التحقق
                    </button>
                  )}

                  {visibleTabs.logs && (
                    <button
                      type="button"
                      style={quickButton}
                      onClick={() => setActiveTab("logs")}
                    >
                      سجل العمليات
                    </button>
                  )}
                </div>
              </div>

              {visibleTabs.logs && (
                <div style={panelCard}>
                  <h2 style={panelTitle}>آخر العمليات</h2>

                  {logs.length === 0 ? (
                    <div style={emptyBox}>لا توجد عمليات حتى الآن</div>
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
              )}
            </section>
          )}

          {activeTab === "branches" && visibleTabs.branches && (
            <>
              <div style={sectionTop}>
                <h2 style={sectionTitle}>إدارة الفروع</h2>

                {access.manage_branches && (
                  <button
                    type="button"
                    style={primaryButton}
                    onClick={() => {
                      resetBranchForm();
                      setShowBranchForm(true);
                    }}
                    disabled={busyAction !== null}
                  >
                    + إضافة فرع
                  </button>
                )}
              </div>

              {showBranchForm && access.manage_branches && (
                <section style={formCard}>
                  <h2 style={formTitle}>
                    {editingBranchId ? "تعديل فرع" : "إضافة فرع جديد"}
                  </h2>

                  <div style={formGrid}>
                    <Field label="اسم الفرع *">
                      <input
                        style={input}
                        value={branchName}
                        maxLength={100}
                        onChange={(event) => setBranchName(event.target.value)}
                        placeholder="مثال: فرع الرياض"
                        disabled={busyAction !== null}
                      />
                    </Field>

                    <Field label="رابط الفرع *">
                      <input
                        style={input}
                        value={branchSlug}
                        maxLength={60}
                        dir="ltr"
                        autoCapitalize="none"
                        spellCheck={false}
                        onChange={(event) =>
                          setBranchSlug(
                            event.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_-]/g, "")
                          )
                        }
                        placeholder="riyadh"
                        disabled={busyAction !== null}
                      />
                    </Field>

                    <Field label="اسم المنظمة *">
                      <input
                        style={input}
                        value={organizationName}
                        maxLength={150}
                        onChange={(event) =>
                          setOrganizationName(event.target.value)
                        }
                        placeholder="مثال: مؤسسة سداد وأرقام"
                        disabled={busyAction !== null}
                      />
                    </Field>

                    <Field label="المدينة">
                      <input
                        style={input}
                        value={branchCity}
                        maxLength={100}
                        onChange={(event) => setBranchCity(event.target.value)}
                        placeholder="مثال: حائل"
                        disabled={busyAction !== null}
                      />
                    </Field>

                    <Field label="السجل التجاري">
                      <input
                        style={input}
                        value={branchCommercialRecord}
                        maxLength={30}
                        inputMode="numeric"
                        onChange={(event) =>
                          setBranchCommercialRecord(
                            cleanNumericValue(event.target.value, 30)
                          )
                        }
                        placeholder="مثال: 7049981769"
                        disabled={busyAction !== null}
                      />
                    </Field>

                    <Field label="رقم الجوال">
                      <input
                        style={input}
                        value={branchPhone}
                        maxLength={20}
                        inputMode="tel"
                        dir="ltr"
                        onChange={(event) =>
                          setBranchPhone(
                            normalizeDigits(event.target.value).replace(
                              /[^\d+]/g,
                              ""
                            )
                          )
                        }
                        placeholder="05xxxxxxxx"
                        disabled={busyAction !== null}
                      />
                    </Field>
                  </div>

                  {!editingBranchId && (
                    <>
                      <div style={subFormTitle}>بيانات دخول مدير الفرع</div>

                      <div style={formGrid}>
                        <Field label="اسم مدير الفرع *">
                          <input
                            style={input}
                            value={managerFullName}
                            maxLength={100}
                            onChange={(event) =>
                              setManagerFullName(event.target.value)
                            }
                            placeholder="مثال: عبدالله البكر"
                            disabled={busyAction !== null}
                          />
                        </Field>

                        <Field label="اسم المستخدم *">
                          <input
                            style={input}
                            value={managerUsername}
                            maxLength={30}
                            autoCapitalize="none"
                            spellCheck={false}
                            onChange={(event) =>
                              setManagerUsername(
                                event.target.value.replace(
                                  /[^A-Za-z0-9_\u0600-\u06FF]/g,
                                  ""
                                )
                              )
                            }
                            placeholder="admin_riyadh"
                            disabled={busyAction !== null}
                          />
                        </Field>

                        <Field label="كلمة المرور 4 أرقام *">
                          <input
                            style={input}
                            type="password"
                            inputMode="numeric"
                            autoComplete="new-password"
                            maxLength={4}
                            value={managerPassword}
                            onChange={(event) =>
                              setManagerPassword(
                                cleanNumericValue(event.target.value, 4)
                              )
                            }
                            placeholder="••••"
                            disabled={busyAction !== null}
                          />
                        </Field>
                      </div>
                    </>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <label style={label}>ملاحظات</label>

                    <textarea
                      style={textarea}
                      value={branchNotes}
                      maxLength={1000}
                      onChange={(event) => setBranchNotes(event.target.value)}
                      placeholder="ملاحظات داخلية للدعم الفني"
                      disabled={busyAction !== null}
                    />
                  </div>

                  <div style={buttonsRow}>
                    <button
                      type="button"
                      style={getDisabledStyle(
                        primaryButton,
                        busyAction === "save_branch"
                      )}
                      onClick={() => void saveBranch()}
                      disabled={busyAction !== null}
                    >
                      {busyAction === "save_branch"
                        ? "جاري الحفظ..."
                        : editingBranchId
                          ? "حفظ التعديلات"
                          : "إنشاء الفرع"}
                    </button>

                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={resetBranchForm}
                      disabled={busyAction !== null}
                    >
                      إلغاء
                    </button>
                  </div>
                </section>
              )}

              <section style={panelCard}>
                {branches.length === 0 ? (
                  <div style={emptyBox}>لا توجد فروع متاحة</div>
                ) : (
                  <div style={branchesList}>
                    {branches.map((branch) => {
                      const branchBusy =
                        busyAction === `branch_status:${branch.id}` ||
                        busyAction === `branch_enter:${branch.id}`;

                      return (
                        <article
                          className="branch-row"
                          key={branch.id}
                          style={branchRow}
                        >
                          <div style={branchMain}>
                            <div style={branchAvatar}>
                              {branch.branch_name?.slice(0, 1) || "ف"}
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <h3 style={branchTitle}>{branch.branch_name}</h3>

                              <p style={muted}>{branch.organization_name}</p>
                              <p style={muted}>
                                {branch.city || "المدينة غير محددة"}
                              </p>
                              <p style={muted}>
                                {branch.commercial_record ||
                                  "لا يوجد سجل تجاري"}
                              </p>
                              <p style={muted}>
                                {branch.phone || "لا يوجد رقم جوال"}
                              </p>
                              <p style={ltrMuted}>
                                /finance/{branch.branch_slug}
                              </p>
                            </div>
                          </div>

                          <span
                            style={
                              branch.is_active ? activeBadge : inactiveBadge
                            }
                          >
                            {branch.is_active ? "نشط" : "معطل"}
                          </span>

                          <div style={rowActions}>
                            {access.impersonate_branch && (
                              <button
                                type="button"
                                style={getDisabledStyle(
                                  smallBlueButton,
                                  branchBusy || !branch.is_active
                                )}
                                onClick={() => void enterBranch(branch)}
                                disabled={
                                  busyAction !== null || !branch.is_active
                                }
                              >
                                {busyAction === `branch_enter:${branch.id}`
                                  ? "جاري الدخول..."
                                  : "دخول"}
                              </button>
                            )}

                            {access.manage_branches && (
                              <>
                                <button
                                  type="button"
                                  style={smallButton}
                                  onClick={() => editBranch(branch)}
                                  disabled={busyAction !== null}
                                >
                                  تعديل
                                </button>

                                <button
                                  type="button"
                                  style={getDisabledStyle(
                                    branch.is_active
                                      ? smallDangerButton
                                      : smallGreenButton,
                                    branchBusy
                                  )}
                                  onClick={() => void toggleBranch(branch)}
                                  disabled={busyAction !== null}
                                >
                                  {busyAction === `branch_status:${branch.id}`
                                    ? "جاري التنفيذ..."
                                    : branch.is_active
                                      ? "تعطيل"
                                      : "تفعيل"}
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === "branch_managers" &&
            visibleTabs.branchManagers && (
              <>
                <div style={sectionTop}>
                  <h2 style={sectionTitle}>مدراء الفروع</h2>
                </div>

                <section style={usersGrid}>
                  {branchManagers.length === 0 ? (
                    <div style={emptyBox}>لا يوجد مدراء فروع</div>
                  ) : (
                    branchManagers.map((manager) => {
                      const branchInfo = getBranchRelation(manager);

                      const managerBusy =
                        busyAction === `manager_status:${manager.id}` ||
                        busyAction === `manager_password:${manager.id}`;

                      return (
                        <article key={manager.id} style={userCard}>
                          <div style={userIcon}>م</div>

                          <h3 style={userTitle}>{manager.full_name}</h3>
                          <p style={muted}>@{manager.username}</p>
                          <p style={muted}>
                            {branchInfo?.branch_name || "فرع غير محدد"}
                          </p>
                          <p style={ltrMuted}>
                            /finance/{branchInfo?.branch_slug || "-"}
                          </p>
                          <p style={muted}>
                            {formatDateTime(manager.created_at)}
                          </p>

                          <span
                            style={
                              manager.is_active ? activeBadge : inactiveBadge
                            }
                          >
                            {manager.is_active ? "نشط" : "معطل"}
                          </span>

                          <div style={rowActions}>
                            <button
                              type="button"
                              style={getDisabledStyle(
                                smallBlueButton,
                                managerBusy
                              )}
                              onClick={() =>
                                void resetBranchManagerPassword(manager)
                              }
                              disabled={busyAction !== null}
                            >
                              {busyAction ===
                              `manager_password:${manager.id}`
                                ? "جاري التحديث..."
                                : "إعادة كلمة المرور"}
                            </button>

                            <button
                              type="button"
                              style={getDisabledStyle(
                                manager.is_active
                                  ? smallDangerButton
                                  : smallGreenButton,
                                managerBusy
                              )}
                              onClick={() => void toggleBranchManager(manager)}
                              disabled={busyAction !== null}
                            >
                              {busyAction === `manager_status:${manager.id}`
                                ? "جاري التنفيذ..."
                                : manager.is_active
                                  ? "تعطيل"
                                  : "تفعيل"}
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </section>
              </>
            )}

          {activeTab === "users" && visibleTabs.users && (
            <>
              <div style={sectionTop}>
                <h2 style={sectionTitle}>مستخدمو الدعم الفني</h2>

                <button
                  type="button"
                  style={primaryButton}
                  onClick={() => {
                    resetUserForm();
                    setShowUserForm(true);
                  }}
                  disabled={busyAction !== null}
                >
                  + إضافة مستخدم
                </button>
              </div>

              {showUserForm && (
                <section style={formCard}>
                  <h2 style={formTitle}>إضافة مستخدم دعم فني</h2>

                  <div style={formGrid}>
                    <Field label="الاسم *">
                      <input
                        style={input}
                        value={supportFullName}
                        maxLength={100}
                        onChange={(event) =>
                          setSupportFullName(event.target.value)
                        }
                        disabled={busyAction !== null}
                      />
                    </Field>

                    <Field label="اسم المستخدم *">
                      <input
                        style={input}
                        value={supportUsername}
                        maxLength={30}
                        autoCapitalize="none"
                        spellCheck={false}
                        onChange={(event) =>
                          setSupportUsername(
                            event.target.value.replace(
                              /[^A-Za-z0-9_\u0600-\u06FF]/g,
                              ""
                            )
                          )
                        }
                        disabled={busyAction !== null}
                      />
                    </Field>

                    <Field label="كلمة المرور *">
                      <input
                        style={input}
                        type="password"
                        autoComplete="new-password"
                        value={supportPassword}
                        maxLength={100}
                        onChange={(event) =>
                          setSupportPassword(event.target.value)
                        }
                        disabled={busyAction !== null}
                      />
                    </Field>

                    <Field label="الدور *">
                      <select
                        style={input}
                        value={supportRole}
                        onChange={(event) =>
                          setSupportRole(event.target.value as SupportRole)
                        }
                        disabled={busyAction !== null}
                      >
                        <option value="support">دعم فني</option>
                        <option value="viewer">مشاهدة فقط</option>

                        {currentUser?.role === "super_admin" && (
                          <option value="super_admin">مدير النظام</option>
                        )}
                      </select>
                    </Field>
                  </div>

                  <div style={permissionsBox}>
                    {SUPPORT_PERMISSIONS.map((permission) => (
                      <label key={permission.key} style={permissionItem}>
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission.key)}
                          disabled={busyAction !== null}
                          onChange={(event) => {
                            setSelectedPermissions((previous) =>
                              event.target.checked
                                ? Array.from(
                                    new Set([...previous, permission.key])
                                  )
                                : previous.filter(
                                    (value) => value !== permission.key
                                  )
                            );
                          }}
                        />

                        {permission.label}
                      </label>
                    ))}
                  </div>

                  <div style={buttonsRow}>
                    <button
                      type="button"
                      style={getDisabledStyle(
                        primaryButton,
                        busyAction === "create_support_user"
                      )}
                      onClick={() => void createSupportUser()}
                      disabled={busyAction !== null}
                    >
                      {busyAction === "create_support_user"
                        ? "جاري الحفظ..."
                        : "حفظ المستخدم"}
                    </button>

                    <button
                      type="button"
                      style={secondaryButton}
                      onClick={resetUserForm}
                      disabled={busyAction !== null}
                    >
                      إلغاء
                    </button>
                  </div>
                </section>
              )}

              <section style={usersGrid}>
                {supportUsers.length === 0 ? (
                  <div style={emptyBox}>لا يوجد مستخدمو دعم متاحون</div>
                ) : (
                  supportUsers.map((user) => {
                    const userBusy =
                      busyAction === `support_status:${user.id}` ||
                      busyAction === `support_permissions:${user.id}`;

                    const permissionsEditorOpen =
                      editingPermissionsUserId === user.id;

                    return (
                      <article key={user.id} style={userCard}>
                        <div style={userIcon}>د</div>

                        <h3 style={userTitle}>{user.full_name}</h3>
                        <p style={muted}>@{user.username}</p>
                        <p style={roleBadge}>{roleLabel(user.role)}</p>

                        <span
                          style={user.is_active ? activeBadge : inactiveBadge}
                        >
                          {user.is_active ? "نشط" : "معطل"}
                        </span>

                        <div style={permissionsTags}>
                          {user.role === "super_admin" ? (
                            <span style={permissionTag}>جميع الصلاحيات</span>
                          ) : user.permissions?.length ? (
                            user.permissions.map((permission) => (
                              <span key={permission} style={permissionTag}>
                                {permissionLabel(permission)}
                              </span>
                            ))
                          ) : (
                            <span style={permissionTag}>
                              بدون صلاحيات محددة
                            </span>
                          )}
                        </div>

                        {permissionsEditorOpen && (
                          <div style={permissionsEditorBox}>
                            <strong>تعديل الصلاحيات</strong>

                            <div style={permissionsBox}>
                              {SUPPORT_PERMISSIONS.map((permission) => (
                                <label
                                  key={permission.key}
                                  style={permissionItem}
                                >
                                  <input
                                    type="checkbox"
                                    checked={editingPermissions.includes(
                                      permission.key
                                    )}
                                    disabled={busyAction !== null}
                                    onChange={(event) => {
                                      setEditingPermissions((previous) =>
                                        event.target.checked
                                          ? Array.from(
                                              new Set([
                                                ...previous,
                                                permission.key,
                                              ])
                                            )
                                          : previous.filter(
                                              (value) =>
                                                value !== permission.key
                                            )
                                      );
                                    }}
                                  />

                                  {permission.label}
                                </label>
                              ))}
                            </div>

                            <div style={buttonsRow}>
                              <button
                                type="button"
                                style={smallGreenButton}
                                onClick={() =>
                                  void saveSupportUserPermissions(user)
                                }
                                disabled={busyAction !== null}
                              >
                                {busyAction ===
                                `support_permissions:${user.id}`
                                  ? "جاري الحفظ..."
                                  : "حفظ الصلاحيات"}
                              </button>

                              <button
                                type="button"
                                style={smallButton}
                                onClick={closePermissionsEditor}
                                disabled={busyAction !== null}
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        )}

                        <div style={rowActions}>
                          {user.role !== "super_admin" &&
                            user.id !== currentUser?.id && (
                              <button
                                type="button"
                                style={smallBlueButton}
                                onClick={() =>
                                  permissionsEditorOpen
                                    ? closePermissionsEditor()
                                    : openPermissionsEditor(user)
                                }
                                disabled={busyAction !== null}
                              >
                                {permissionsEditorOpen
                                  ? "إغلاق الصلاحيات"
                                  : "تعديل الصلاحيات"}
                              </button>
                            )}

                          <button
                            type="button"
                            style={getDisabledStyle(
                              user.is_active
                                ? smallDangerButton
                                : smallGreenButton,
                              userBusy || user.id === currentUser?.id
                            )}
                            onClick={() => void toggleSupportUser(user)}
                            disabled={
                              busyAction !== null || user.id === currentUser?.id
                            }
                            title={
                              user.id === currentUser?.id
                                ? "لا يمكنك تعطيل حسابك الحالي"
                                : undefined
                            }
                          >
                            {busyAction === `support_status:${user.id}`
                              ? "جاري التنفيذ..."
                              : user.id === currentUser?.id
                                ? "الحساب الحالي"
                                : user.is_active
                                  ? "تعطيل"
                                  : "تفعيل"}
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </section>
            </>
          )}

          {activeTab === "verifications" && visibleTabs.verifications && (
            <>
              <div style={sectionTop}>
                <h2 style={sectionTitle}>التحكم بنتائج التحقق</h2>
              </div>

              <section style={verificationSearchCard}>
                <div style={verificationSearchGrid}>
                  <Field label="رقم الهوية أو رقم العقد">
                    <input
                      style={input}
                      value={verificationSearchValue}
                      inputMode="numeric"
                      maxLength={30}
                      placeholder="اكتب رقم الهوية أو رقم العقد"
                      onChange={(event) =>
                        setVerificationSearchValue(
                          cleanNumericValue(event.target.value, 30)
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void searchVerificationContracts();
                        }
                      }}
                      disabled={busyAction !== null}
                    />
                  </Field>

                  <button
                    type="button"
                    style={getDisabledStyle(
                      primaryButton,
                      busyAction === "verification_search"
                    )}
                    onClick={() => void searchVerificationContracts()}
                    disabled={busyAction !== null}
                  >
                    {busyAction === "verification_search"
                      ? "جاري البحث..."
                      : "بحث"}
                  </button>
                </div>
              </section>

              {!verificationSearchPerformed ? (
                <div style={emptyBox}>
                  لن تظهر أي عقود قبل إدخال رقم الهوية أو رقم العقد وتنفيذ
                  البحث.
                </div>
              ) : verificationResults.length === 0 ? (
                <div style={emptyBox}>لم يتم العثور على نتائج مطابقة</div>
              ) : (
                <section style={verificationResultsList}>
                  {verificationResults.map((contract) => {
                    const editorOpen =
                      editingVerificationContractId === contract.contract_id;

                    const contractBusy =
                      busyAction ===
                        `verification_set:${contract.contract_id}` ||
                      busyAction ===
                        `verification_clear:${contract.contract_id}`;

                    return (
                      <article
                        key={contract.contract_id}
                        style={verificationCard}
                      >
                        <div style={verificationCardTop}>
                          <div>
                            <h3 style={verificationTitle}>
                              العقد رقم {contract.contract_number || "-"}
                            </h3>

                            <p style={muted}>
                              {contract.customer_name} — الهوية:{" "}
                              {contract.national_id || "-"}
                            </p>

                            <p style={muted}>
                              الفرع: {contract.branch_name}
                            </p>
                          </div>

                          <div style={verificationBadges}>
                            <PositionBadge
                              label={`التلقائي: ${contract.automatic_position}`}
                              position={contract.automatic_position}
                            />

                            <PositionBadge
                              label={`الظاهر: ${contract.effective_position}`}
                              position={contract.effective_position}
                              emphasized
                            />

                            <span
                              style={
                                contract.has_support_override
                                  ? supportOverrideBadge
                                  : automaticModeBadge
                              }
                            >
                              {contract.has_support_override
                                ? "تدخل دعم فعال"
                                : "وضع تلقائي"}
                            </span>
                          </div>
                        </div>

                        <div style={verificationInfoGrid}>
                          <InfoItem
                            label="مبلغ العقد"
                            value={formatMoney(contract.debt_amount)}
                          />

                          <InfoItem
                            label="المبلغ المدفوع"
                            value={formatMoney(contract.paid_amount)}
                          />

                          <InfoItem
                            label="المبلغ المتبقي"
                            value={formatMoney(contract.remaining_amount)}
                          />

                          <InfoItem
                            label="تاريخ العقد"
                            value={formatDate(contract.contract_date)}
                          />

                          <InfoItem
                            label="تاريخ الاستحقاق"
                            value={formatDate(contract.payment_due_date)}
                          />

                          <InfoItem
                            label="حالة العقد"
                            value={contract.contract_state}
                          />

                          <InfoItem
                            label="الجوال"
                            value={contract.customer_phone || "-"}
                          />
                        </div>

                        {contract.has_support_override && (
                          <div style={overrideDetailsBox}>
                            <strong>
                              النتيجة المفروضة:{" "}
                              {contract.override_position || "-"}
                            </strong>

                            <span>
                              السبب: {contract.override_reason || "-"}
                            </span>

                            {contract.override_notes && (
                              <span>
                                الملاحظات: {contract.override_notes}
                              </span>
                            )}

                            <small>
                              آخر تحديث:{" "}
                              {formatDateTime(
                                contract.override_updated_at || ""
                              )}
                            </small>
                          </div>
                        )}

                        {contract.default_declared_at && (
                          <div style={defaultDetailsBox}>
                            <strong>يوجد إعلان تعثر من الفرع</strong>

                            <span>
                              تاريخ الإعلان:{" "}
                              {formatDateTime(contract.default_declared_at)}
                            </span>

                            <span>
                              انتهاء التعثر:{" "}
                              {formatDateTime(
                                contract.default_expires_at || ""
                              )}
                            </span>

                            {contract.default_reason && (
                              <span>
                                السبب: {contract.default_reason}
                              </span>
                            )}
                          </div>
                        )}

                        <div style={rowActions}>
                          <button
                            type="button"
                            style={smallBlueButton}
                            onClick={() =>
                              editorOpen
                                ? resetVerificationEditor()
                                : openVerificationEditor(contract)
                            }
                            disabled={busyAction !== null}
                          >
                            {editorOpen ? "إغلاق التحكم" : "التحكم بالنتيجة"}
                          </button>
                        </div>

                        {editorOpen && (
                          <div
                            id={`verification-editor-${contract.contract_id}`}
                            style={verificationEditorBox}
                          >
                            <div style={formGrid}>
                              <Field label="النتيجة التي ستظهر للفروع">
                                <select
                                  style={input}
                                  value={verificationPosition}
                                  onChange={(event) =>
                                    setVerificationPosition(
                                      event.target
                                        .value as VerificationPosition
                                    )
                                  }
                                  disabled={busyAction !== null}
                                >
                                  <option value="نشط">نشط</option>
                                  <option value="متأخر">متأخر</option>
                                  <option value="متعثر">متعثر</option>
                                </select>
                              </Field>

                              <Field label="سبب التعديل *">
                                <input
                                  style={input}
                                  value={verificationReason}
                                  maxLength={500}
                                  placeholder="سبب داخلي إلزامي"
                                  onChange={(event) =>
                                    setVerificationReason(event.target.value)
                                  }
                                  disabled={busyAction !== null}
                                />
                              </Field>
                            </div>

                            <div style={{ marginTop: 12 }}>
                              <label style={label}>ملاحظات داخلية</label>

                              <textarea
                                style={textarea}
                                value={verificationNotes}
                                maxLength={1000}
                                placeholder="ملاحظات اختيارية لا تظهر للفروع"
                                onChange={(event) =>
                                  setVerificationNotes(event.target.value)
                                }
                                disabled={busyAction !== null}
                              />
                            </div>

                            <div style={buttonsRow}>
                              <button
                                type="button"
                                style={getDisabledStyle(
                                  smallGreenButton,
                                  contractBusy
                                )}
                                onClick={() =>
                                  void setVerificationOverride(contract)
                                }
                                disabled={busyAction !== null}
                              >
                                {busyAction ===
                                `verification_set:${contract.contract_id}`
                                  ? "جاري الحفظ..."
                                  : `تعيين ${verificationPosition}`}
                              </button>

                              {contract.has_support_override && (
                                <button
                                  type="button"
                                  style={getDisabledStyle(
                                    smallDangerButton,
                                    contractBusy
                                  )}
                                  onClick={() =>
                                    void clearVerificationOverride(contract)
                                  }
                                  disabled={busyAction !== null}
                                >
                                  {busyAction ===
                                  `verification_clear:${contract.contract_id}`
                                    ? "جاري الإلغاء..."
                                    : "العودة للوضع التلقائي"}
                                </button>
                              )}

                              <button
                                type="button"
                                style={smallButton}
                                onClick={resetVerificationEditor}
                                disabled={busyAction !== null}
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              )}
            </>
          )}

          {activeTab === "logs" && visibleTabs.logs && (
            <>
              <div style={sectionTop}>
                <h2 style={sectionTitle}>سجل عمليات الدعم</h2>
              </div>

              <section style={panelCard}>
                {logs.length === 0 ? (
                  <div style={emptyBox}>لا توجد سجلات حتى الآن</div>
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

      <GlobalResponsiveStyles />
    </main>
  );
}

function Field({
  label: fieldLabel,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label style={label}>{fieldLabel}</label>
      {children}
    </div>
  );
}

function InfoItem({ label: itemLabel, value }: { label: string; value: string }) {
  return (
    <div style={verificationInfoItem}>
      <span style={verificationInfoLabel}>{itemLabel}</span>
      <strong style={verificationInfoValue}>{value}</strong>
    </div>
  );
}

function PositionBadge({
  label: badgeLabel,
  position,
  emphasized = false,
}: {
  label: string;
  position: VerificationPosition;
  emphasized?: boolean;
}) {
  const base =
    position === "متعثر"
      ? defaultPositionBadge
      : position === "متأخر"
        ? overduePositionBadge
        : activePositionBadge;

  return (
    <span
      style={{
        ...base,
        ...(emphasized
          ? {
              boxShadow: "0 0 0 3px rgba(15,23,42,.08)",
            }
          : {}),
      }}
    >
      {badgeLabel}
    </span>
  );
}

function BrandBox() {
  return (
    <div style={brandBox}>
      <div style={brandIcon}>د</div>

      <div>
        <h2 style={brandTitle}>دعم احتساب</h2>
        <p style={brandSub}>لوحة التحكم المركزية</p>
      </div>
    </div>
  );
}

function SideNav({
  activeTab,
  setActiveTab,
  visibleTabs,
}: {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  visibleTabs: {
    branches: boolean;
    branchManagers: boolean;
    users: boolean;
    verifications: boolean;
    logs: boolean;
  };
}) {
  return (
    <nav style={nav}>
      <NavButton
        active={activeTab === "overview"}
        onClick={() => setActiveTab("overview")}
      >
        النظرة العامة
      </NavButton>

      {visibleTabs.branches && (
        <NavButton
          active={activeTab === "branches"}
          onClick={() => setActiveTab("branches")}
        >
          الفروع
        </NavButton>
      )}

      {visibleTabs.branchManagers && (
        <NavButton
          active={activeTab === "branch_managers"}
          onClick={() => setActiveTab("branch_managers")}
        >
          مدراء الفروع
        </NavButton>
      )}

      {visibleTabs.users && (
        <NavButton
          active={activeTab === "users"}
          onClick={() => setActiveTab("users")}
        >
          مستخدمو الدعم
        </NavButton>
      )}

      {visibleTabs.verifications && (
        <NavButton
          active={activeTab === "verifications"}
          onClick={() => setActiveTab("verifications")}
        >
          نتائج التحقق
        </NavButton>
      )}

      {visibleTabs.logs && (
        <NavButton
          active={activeTab === "logs"}
          onClick={() => setActiveTab("logs")}
        >
          سجل العمليات
        </NavButton>
      )}
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      style={active ? navActive : navItem}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MobileNav({
  activeTab,
  setActiveTab,
  visibleTabs,
  onLogout,
  disabled,
}: {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  visibleTabs: {
    branches: boolean;
    branchManagers: boolean;
    users: boolean;
    verifications: boolean;
    logs: boolean;
  };
  onLogout: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mobile-nav">
      <button
        type="button"
        className={
          activeTab === "overview" ? "mobile-tab active" : "mobile-tab"
        }
        onClick={() => setActiveTab("overview")}
      >
        العامة
      </button>

      {visibleTabs.branches && (
        <button
          type="button"
          className={
            activeTab === "branches" ? "mobile-tab active" : "mobile-tab"
          }
          onClick={() => setActiveTab("branches")}
        >
          الفروع
        </button>
      )}

      {visibleTabs.branchManagers && (
        <button
          type="button"
          className={
            activeTab === "branch_managers"
              ? "mobile-tab active"
              : "mobile-tab"
          }
          onClick={() => setActiveTab("branch_managers")}
        >
          المدراء
        </button>
      )}

      {visibleTabs.users && (
        <button
          type="button"
          className={
            activeTab === "users" ? "mobile-tab active" : "mobile-tab"
          }
          onClick={() => setActiveTab("users")}
        >
          الدعم
        </button>
      )}

      {visibleTabs.verifications && (
        <button
          type="button"
          className={
            activeTab === "verifications"
              ? "mobile-tab active"
              : "mobile-tab"
          }
          onClick={() => setActiveTab("verifications")}
        >
          التحقق
        </button>
      )}

      {visibleTabs.logs && (
        <button
          type="button"
          className={
            activeTab === "logs" ? "mobile-tab active" : "mobile-tab"
          }
          onClick={() => setActiveTab("logs")}
        >
          السجل
        </button>
      )}

      <button
        type="button"
        className="mobile-tab logout"
        onClick={onLogout}
        disabled={disabled}
      >
        خروج
      </button>
    </div>
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

function roleLabel(role: string) {
  if (role === "super_admin") return "مدير النظام";
  if (role === "viewer") return "مشاهدة فقط";
  return "دعم فني";
}

function permissionLabel(key: string) {
  return (
    SUPPORT_PERMISSIONS.find((permission) => permission.key === key)?.label ||
    key
  );
}

function formatDateTime(date: string) {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleString("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(date: string | null) {
  if (!date) return "-";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatMoney(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;

  return `${safeValue.toLocaleString("ar-SA", {
    maximumFractionDigits: 2,
  })} ر.س`;
}

function getDisabledStyle(
  baseStyle: CSSProperties,
  disabled: boolean
): CSSProperties {
  if (!disabled) return baseStyle;

  return {
    ...baseStyle,
    opacity: 0.55,
    cursor: "not-allowed",
  };
}

function getPageStyle(isCompact: boolean): CSSProperties {
  return {
    minHeight: "100vh",
    padding: isCompact ? 8 : 14,
    fontFamily: "var(--font-almarai), sans-serif",
    color: "#0f172a",
    overflowX: "hidden",
    backgroundColor: "#edf4ff",
    backgroundImage:
      "radial-gradient(circle at 12% 16%, rgba(37,99,235,.14), transparent 28%), radial-gradient(circle at 88% 8%, rgba(14,165,233,.12), transparent 26%), linear-gradient(rgba(244,247,251,.88), rgba(244,247,251,.94)), url('/backgrounds/v13-finance-bg-1.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  };
}

function getShellStyle(isCompact: boolean): CSSProperties {
  return {
    width: "100%",
    maxWidth: 1450,
    margin: "auto",
    display: "grid",
    gridTemplateColumns: isCompact ? "1fr" : "280px minmax(0, 1fr)",
    gap: 14,
  };
}

function getHeroStyle(isMobile: boolean): CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1d4ed8 58%, #0ea5e9 100%)",
    color: "white",
    borderRadius: isMobile ? 20 : 24,
    padding: isMobile ? 18 : 24,
    marginBottom: 14,
    boxShadow: "0 18px 42px rgba(30,64,175,.20)",
  };
}

function getHeroTitleStyle(isMobile: boolean): CSSProperties {
  return {
    margin: "6px 0",
    fontSize: isMobile ? 25 : 32,
    lineHeight: 1.4,
    fontFamily: "var(--font-almarai), sans-serif",
  };
}

function GlobalResponsiveStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }

      html {
        background: #edf4ff;
      }

      body {
        margin: 0;
        overflow-x: hidden;
      }

      @keyframes support-spin {
        to {
          transform: rotate(360deg);
        }
      }

      button,
      input,
      textarea,
      select {
        font-family: var(--font-almarai), sans-serif;
      }

      button:focus-visible,
      input:focus-visible,
      textarea:focus-visible,
      select:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.22);
        outline-offset: 2px;
      }

      .mobile-nav {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 2px 1px 12px;
        margin-bottom: 10px;
        -webkit-overflow-scrolling: touch;
      }

      .mobile-nav::-webkit-scrollbar {
        display: none;
      }

      .mobile-tab {
        flex: 0 0 auto;
        border: 1px solid #dbe4f0;
        background: rgba(255, 255, 255, 0.92);
        color: #334155;
        border-radius: 999px;
        padding: 10px 13px;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
      }

      .mobile-tab.active {
        color: #ffffff;
        border-color: transparent;
        background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
      }

      .mobile-tab.logout {
        background: #fee2e2;
        color: #991b1b;
      }

      .mobile-tab:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      @media (max-width: 1023px) {
        .support-main {
          min-height: auto !important;
          border-radius: 22px !important;
          padding: 12px !important;
        }

        .dashboard-grid {
          grid-template-columns: 1fr !important;
        }

        .branch-row {
          grid-template-columns: 1fr !important;
          align-items: stretch !important;
        }
      }

      @media (max-width: 700px) {
        .stats-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }

      @media (max-width: 440px) {
        .stats-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
  );
}

const loadingCard: CSSProperties = {
  width: "min(100%, 480px)",
  margin: "18vh auto 0",
  padding: 28,
  borderRadius: 24,
  background: "rgba(255,255,255,.94)",
  border: "1px solid #dbe4f0",
  boxShadow: "0 18px 50px rgba(15,23,42,.12)",
  textAlign: "center",
};

const loadingSpinner: CSSProperties = {
  width: 42,
  height: 42,
  margin: "0 auto 16px",
  borderRadius: "50%",
  border: "4px solid #dbeafe",
  borderTopColor: "#2563eb",
  animation: "support-spin .8s linear infinite",
};

const loadingTitle: CSSProperties = {
  margin: 0,
  fontSize: 21,
  fontFamily: "var(--font-almarai), sans-serif",
};

const errorCard: CSSProperties = {
  ...loadingCard,
  marginTop: "14vh",
};

const errorTitle: CSSProperties = {
  margin: "0 0 10px",
  color: "#991b1b",
};

const errorText: CSSProperties = {
  color: "#64748b",
  lineHeight: 1.8,
};

const sidePanel: CSSProperties = {
  minHeight: "calc(100vh - 28px)",
  background: "linear-gradient(180deg,#0f172a,#020617)",
  border: "1px solid rgba(148,163,184,.18)",
  borderRadius: 26,
  padding: 16,
  color: "white",
  position: "sticky",
  top: 14,
  alignSelf: "start",
};

const brandBox: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: 12,
  borderRadius: 20,
  background: "rgba(255,255,255,.06)",
  marginBottom: 18,
};

const brandIcon: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,
  background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  fontWeight: 900,
};

const brandTitle: CSSProperties = {
  margin: 0,
  fontSize: 20,
};

const brandSub: CSSProperties = {
  margin: "5px 0 0",
  color: "#94a3b8",
  fontSize: 13,
};

const nav: CSSProperties = {
  display: "grid",
  gap: 8,
};

const navItem: CSSProperties = {
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

const navActive: CSSProperties = {
  ...navItem,
  color: "white",
  background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
  border: "1px solid rgba(255,255,255,.15)",
};

const logoutButton: CSSProperties = {
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

const mainPanel: CSSProperties = {
  minWidth: 0,
  minHeight: "calc(100vh - 28px)",
  background: "rgba(248,250,252,.93)",
  border: "1px solid rgba(226,232,240,.92)",
  borderRadius: 26,
  padding: 16,
  backdropFilter: "blur(10px)",
  boxShadow: "0 18px 48px rgba(15,23,42,.08)",
};

const heroContent: CSSProperties = {
  position: "relative",
  zIndex: 3,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const topLabel: CSSProperties = {
  margin: 0,
  color: "#bfdbfe",
  fontWeight: 800,
};

const heroSub: CSSProperties = {
  margin: 0,
  color: "#e0f2fe",
};

const heroUserCard: CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 175,
  padding: "12px 15px",
  borderRadius: 17,
  border: "1px solid rgba(255,255,255,.22)",
  background: "rgba(255,255,255,.10)",
  backdropFilter: "blur(7px)",
};

const heroUserName: CSSProperties = {
  fontWeight: 900,
};

const heroUserRole: CSSProperties = {
  color: "#dbeafe",
  fontSize: 13,
};

const heroCircleOne: CSSProperties = {
  position: "absolute",
  width: 180,
  height: 180,
  borderRadius: "50%",
  top: -95,
  left: -45,
  background: "rgba(255,255,255,.10)",
};

const heroCircleTwo: CSSProperties = {
  position: "absolute",
  width: 110,
  height: 110,
  borderRadius: "50%",
  bottom: -58,
  right: "28%",
  background: "rgba(125,211,252,.14)",
};

const heroCircleThree: CSSProperties = {
  position: "absolute",
  width: 74,
  height: 74,
  borderRadius: "50%",
  top: 18,
  right: 28,
  border: "1px solid rgba(255,255,255,.18)",
};

const heroDots: CSSProperties = {
  position: "absolute",
  insetInlineEnd: 26,
  bottom: 18,
  width: 74,
  height: 34,
  opacity: 0.32,
  backgroundImage:
    "radial-gradient(circle, rgba(255,255,255,.9) 1.3px, transparent 1.5px)",
  backgroundSize: "10px 10px",
};

const inlineError: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  background: "#fee2e2",
  color: "#991b1b",
  border: "1px solid #fecaca",
};

const inlineRetryButton: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "8px 12px",
  background: "#991b1b",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const statCard: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 8px 18px rgba(15,23,42,.04)",
};

const statValue: CSSProperties = {
  display: "block",
  fontSize: 34,
  fontWeight: 900,
  color: "#2563eb",
};

const statTitle: CSSProperties = {
  display: "block",
  color: "#0f172a",
  fontWeight: 900,
  marginTop: 4,
};

const dashboardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const darkCard: CSSProperties = {
  background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
  color: "white",
  borderRadius: 22,
  padding: 20,
  minHeight: 190,
};

const whiteTitle: CSSProperties = {
  marginTop: 0,
};

const quickActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 20,
};

const quickButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.08)",
  color: "white",
  borderRadius: 14,
  padding: "12px 14px",
  cursor: "pointer",
  fontWeight: 800,
};

const panelCard: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 8px 18px rgba(15,23,42,.04)",
};

const panelTitle: CSSProperties = {
  marginTop: 0,
};

const miniLogs: CSSProperties = {
  display: "grid",
  gap: 8,
};

const miniLogItem: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 4,
};

const sectionTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontFamily: "var(--font-almarai), sans-serif",
};

const primaryButton: CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "white",
  borderRadius: 14,
  padding: "13px 18px",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(37,99,235,.18)",
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: "linear-gradient(135deg,#64748b,#334155)",
  boxShadow: "0 8px 18px rgba(51,65,85,.14)",
};

const formCard: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  marginBottom: 14,
};

const formTitle: CSSProperties = {
  marginTop: 0,
  fontFamily: "var(--font-almarai), sans-serif",
};

const subFormTitle: CSSProperties = {
  marginTop: 18,
  marginBottom: 12,
  padding: 12,
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  borderRadius: 14,
  fontWeight: 900,
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 12,
};

const label: CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#334155",
  fontWeight: 900,
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 13,
  padding: 13,
  fontSize: 15,
  background: "#f8fafc",
  color: "#0f172a",
};

const textarea: CSSProperties = {
  ...input,
  minHeight: 90,
  resize: "vertical",
};

const buttonsRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

const branchesList: CSSProperties = {
  display: "grid",
  gap: 10,
};

const branchRow: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) auto auto",
  gap: 12,
  alignItems: "center",
};

const branchMain: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  minWidth: 0,
};

const branchAvatar: CSSProperties = {
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
  flex: "0 0 auto",
};

const branchTitle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-almarai), sans-serif",
};

const muted: CSSProperties = {
  color: "#64748b",
  margin: "6px 0",
  wordBreak: "break-word",
};

const ltrMuted: CSSProperties = {
  ...muted,
  direction: "ltr",
  textAlign: "right",
};

const activeBadge: CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 900,
  width: "fit-content",
};

const inactiveBadge: CSSProperties = {
  display: "inline-block",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "6px 10px",
  fontWeight: 900,
  width: "fit-content",
};

const rowActions: CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};

const smallButton: CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg,#e0f2fe,#dbeafe)",
  color: "#075985",
  borderRadius: 10,
  padding: "9px 12px",
  cursor: "pointer",
  fontWeight: 800,
};

const smallBlueButton: CSSProperties = {
  ...smallButton,
  background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "white",
};

const smallGreenButton: CSSProperties = {
  ...smallButton,
  background: "linear-gradient(135deg,#16a34a,#15803d)",
  color: "white",
};

const smallDangerButton: CSSProperties = {
  ...smallButton,
  background: "linear-gradient(135deg,#ef4444,#b91c1c)",
  color: "white",
};

const usersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
  gap: 12,
};

const userCard: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  display: "grid",
  gap: 8,
};

const userIcon: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 18,
  background: "#ede9fe",
  color: "#5b21b6",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  fontWeight: 900,
};

const userTitle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-almarai), sans-serif",
};

const roleBadge: CSSProperties = {
  background: "#f1f5f9",
  color: "#334155",
  borderRadius: 999,
  padding: "7px 10px",
  width: "fit-content",
  fontWeight: 800,
};

const permissionsBox: CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
  gap: 10,
};

const permissionItem: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 800,
};

const permissionsTags: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const permissionTag: CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 12,
  fontWeight: 800,
};

const permissionsEditorBox: CSSProperties = {
  marginTop: 8,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 16,
  padding: 12,
};

const emptyBox: CSSProperties = {
  background: "#f8fafc",
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 18,
  textAlign: "center",
  color: "#64748b",
};

const logTable: CSSProperties = {
  display: "grid",
  gap: 8,
};

const logRow: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const logAction: CSSProperties = {
  color: "#0f172a",
};

const logMeta: CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#64748b",
};

const verificationSearchCard: CSSProperties = {
  background: "white",
  border: "1px solid #dbe4f0",
  borderRadius: 22,
  padding: 16,
  marginBottom: 14,
  boxShadow: "0 8px 18px rgba(15,23,42,.04)",
};

const verificationSearchGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px,1fr) auto",
  alignItems: "end",
  gap: 10,
};

const verificationResultsList: CSSProperties = {
  display: "grid",
  gap: 14,
};

const verificationCard: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 8px 18px rgba(15,23,42,.04)",
};

const verificationCardTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const verificationTitle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-almarai), sans-serif",
};

const verificationBadges: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 7,
  flexWrap: "wrap",
};

const activePositionBadge: CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,
  padding: "7px 10px",
  fontWeight: 900,
};

const overduePositionBadge: CSSProperties = {
  display: "inline-block",
  background: "#fef3c7",
  color: "#92400e",
  borderRadius: 999,
  padding: "7px 10px",
  fontWeight: 900,
};

const defaultPositionBadge: CSSProperties = {
  display: "inline-block",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,
  padding: "7px 10px",
  fontWeight: 900,
};

const supportOverrideBadge: CSSProperties = {
  display: "inline-block",
  background: "#ede9fe",
  color: "#5b21b6",
  borderRadius: 999,
  padding: "7px 10px",
  fontWeight: 900,
};

const automaticModeBadge: CSSProperties = {
  display: "inline-block",
  background: "#f1f5f9",
  color: "#475569",
  borderRadius: 999,
  padding: "7px 10px",
  fontWeight: 900,
};

const verificationInfoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
  gap: 10,
  marginTop: 14,
  marginBottom: 14,
};

const verificationInfoItem: CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 11,
  display: "grid",
  gap: 5,
};

const verificationInfoLabel: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const verificationInfoValue: CSSProperties = {
  color: "#0f172a",
  wordBreak: "break-word",
};

const overrideDetailsBox: CSSProperties = {
  display: "grid",
  gap: 7,
  padding: 12,
  marginBottom: 12,
  borderRadius: 15,
  background: "#f5f3ff",
  border: "1px solid #ddd6fe",
  color: "#4c1d95",
};

const defaultDetailsBox: CSSProperties = {
  display: "grid",
  gap: 7,
  padding: 12,
  marginBottom: 12,
  borderRadius: 15,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
};

const verificationEditorBox: CSSProperties = {
  marginTop: 14,
  background: "#f8fafc",
  border: "1px solid #bfdbfe",
  borderRadius: 18,
  padding: 14,
};
