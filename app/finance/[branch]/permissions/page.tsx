"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getBranchId } from "@/lib/getBranchId";

type ScreenType = "mobile" | "tablet" | "desktop";

type UserRole = "مدير" | "موظف" | "مستثمر";

type ActiveTab =
  | "create-user"
  | "users"
  | "create-investor"
  | "investors";

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
};

type StoredFinanceUser = Partial<FinanceUser> & {
  branch_slug?: string;
  branch_name?: string;
  organization_name?: string;
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

type PermissionOption = {
  key: string;
  label: string;
};

type PermissionGroup = {
  title: string;
  permissions: PermissionOption[];
};

type FieldProps = {
  label: string;
  children: ReactNode;
};

type PermissionGroupsProps = {
  selectedPermissions: string[];
  disabled?: boolean;
  onToggle: (permissionKey: string) => void;
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
    permissions: [
      {
        key: "workflow",
        label: "الدخول إلى سير العمل",
      },
    ],
  },
  {
    title: "العملاء",
    permissions: [
      {
        key: "customers",
        label: "عرض العملاء",
      },
      {
        key: "customers_create",
        label: "إضافة عميل",
      },
      {
        key: "customers_edit",
        label: "تعديل العميل",
      },
      {
        key: "customers_verify",
        label: "التحقق من العميل",
      },
    ],
  },
  {
    title: "العقود",
    permissions: [
      {
        key: "contracts",
        label: "عرض العقود",
      },
      {
        key: "contracts_create",
        label: "إنشاء عقد",
      },
      {
        key: "contracts_edit",
        label: "تعديل العقد",
      },
      {
        key: "contracts_close",
        label: "إغلاق العقد",
      },
      {
        key: "archive",
        label: "عرض الأرشيف",
      },
    ],
  },
  {
    title: "السداد",
    permissions: [
      {
        key: "payments",
        label: "عرض عمليات السداد",
      },
      {
        key: "payments_create",
        label: "إجراء سداد",
      },
      {
        key: "payments_cancel",
        label: "إلغاء دفعة",
      },
    ],
  },
  {
    title: "المخزون والمنتجات",
    permissions: [
      {
        key: "inventory",
        label: "عرض المخزون",
      },
      {
        key: "add_inventory",
        label: "إضافة كمية للمخزون",
      },
      {
        key: "add_product",
        label: "إضافة منتج",
      },
      {
        key: "edit_product",
        label: "تعديل منتج",
      },
      {
        key: "toggle_product",
        label: "تفعيل أو تعطيل منتج",
      },
    ],
  },
  {
    title: "المستثمرون",
    permissions: [
      {
        key: "add_investor",
        label: "إضافة مستثمر",
      },
      {
        key: "edit_investor",
        label: "تعديل مستثمر",
      },
      {
        key: "toggle_investor",
        label: "تفعيل أو تعطيل مستثمر",
      },
    ],
  },
  {
    title: "الملاحظات والمصروفات",
    permissions: [
      {
        key: "notes",
        label: "الملاحظات والتذكيرات",
      },
      {
        key: "expenses",
        label: "المصروفات والمشتريات",
      },
    ],
  },
  {
    title: "الطباعة والسندات",
    permissions: [
      {
        key: "print",
        label: "الطباعة والتقارير",
      },
      {
        key: "promissory_note_view",
        label: "عرض سند لأمر",
      },
      {
        key: "promissory_note_create",
        label: "إنشاء سند لأمر",
      },
    ],
  },
  {
    title: "الإدارة",
    permissions: [
      {
        key: "settings",
        label: "الإعدادات",
      },
      {
        key: "permissions",
        label: "إدارة الموظفين والصلاحيات",
      },
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

const DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  مدير: [...ALL_MANAGER_PERMISSIONS],

  موظف: [
    "workflow",
    "customers",
    "customers_create",
    "customers_edit",
    "contracts",
    "contracts_create",
    "payments",
    "payments_create",
    "inventory",
    "notes",
    "print",
    "promissory_note_view",
  ],

  مستثمر: [...INVESTOR_PERMISSIONS],
};

export default function FinancePermissionsPage() {
  const params = useParams();
  const router = useRouter();

  const branch = String(params.branch ?? "");

  const [screen, setScreen] =
    useState<ScreenType>("desktop");

  const [authChecked, setAuthChecked] =
    useState(false);

  const [branchId, setBranchId] =
    useState<string | null>(null);

  const [currentUser, setCurrentUser] =
    useState<FinanceUser | null>(null);

  const [employeeName, setEmployeeName] =
    useState("الموظف");

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("create-user");

  const [users, setUsers] =
    useState<FinanceUser[]>([]);

  const [investors, setInvestors] =
    useState<FinanceInvestor[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [savingUser, setSavingUser] =
    useState(false);

  const [savingInvestor, setSavingInvestor] =
    useState(false);

  const [processingUserId, setProcessingUserId] =
    useState<string | null>(null);

  const [managerPin, setManagerPin] =
    useState("");

  const [employeeNameInput, setEmployeeNameInput] =
    useState("");

  const [employeeUsername, setEmployeeUsername] =
    useState("");

  const [employeePassword, setEmployeePassword] =
    useState("");

  const [selectedRole, setSelectedRole] =
    useState<UserRole>("موظف");

  const [selectedPermissions, setSelectedPermissions] =
    useState<string[]>([
      ...DEFAULT_PERMISSIONS.موظف,
    ]);

  const [selectedInvestorId, setSelectedInvestorId] =
    useState("");

  const [editingUserId, setEditingUserId] =
    useState<string | null>(null);

  const [investorNameInput, setInvestorNameInput] =
    useState("");

  const [investorNationalId, setInvestorNationalId] =
    useState("");

  const [investorPhone, setInvestorPhone] =
    useState("");

  const [investorNotes, setInvestorNotes] =
    useState("");

  const isMobile = screen === "mobile";
  const isTablet = screen === "tablet";
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    function updateScreen() {
      const width = window.innerWidth;

      if (width < 640) {
        setScreen("mobile");
      } else if (width < 980) {
        setScreen("tablet");
      } else {
        setScreen("desktop");
      }
    }

    updateScreen();

    window.addEventListener("resize", updateScreen);

    return () => {
      window.removeEventListener("resize", updateScreen);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      await initializePage(() => cancelled);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [branch]);

  useEffect(() => {
    setSelectedPermissions([
      ...DEFAULT_PERMISSIONS[selectedRole],
    ]);

    if (selectedRole !== "مستثمر") {
      setSelectedInvestorId("");
    }
  }, [selectedRole]);

  const activeInvestors = useMemo(() => {
    return investors.filter(
      (investor) => investor.is_active !== false
    );
  }, [investors]);

  const availableInvestorsForAccount = useMemo(() => {
    const linkedInvestorIds = new Set(
      users
        .filter(
          (user) =>
            user.investor_id &&
            user.id !== editingUserId
        )
        .map((user) =>
          String(user.investor_id)
        )
    );

    return activeInvestors.filter(
      (investor) =>
        !linkedInvestorIds.has(investor.id)
    );
  }, [
    activeInvestors,
    users,
    editingUserId,
  ]);

  async function initializePage(
    isCancelled: () => boolean
  ) {
    setLoading(true);

    const sessionUser = readStoredUser();

    if (!sessionUser) {
      clearFinanceSession();
      router.replace("/login");
      return;
    }

    if (!branch) {
      setLoading(false);
      alert("مسار الفرع غير صحيح");
      return;
    }

    if (
      sessionUser.branch_slug &&
      sessionUser.branch_slug !== branch
    ) {
      setLoading(false);

      alert(
        "هذا الحساب لا يتبع الفرع الحالي"
      );

      router.replace(
        `/finance/${sessionUser.branch_slug}`
      );

      return;
    }

    const resolvedBranchId =
      await getBranchId(branch);

    if (isCancelled()) {
      return;
    }

    if (!resolvedBranchId) {
      setLoading(false);
      alert("تعذر تحديد الفرع");
      return;
    }

    if (
      sessionUser.branch_id &&
      String(sessionUser.branch_id) !==
        String(resolvedBranchId)
    ) {
      setLoading(false);

      alert(
        "هذا الحساب لا يتبع الفرع الحالي"
      );

      router.replace(
        sessionUser.branch_slug
          ? `/finance/${sessionUser.branch_slug}`
          : `/finance/${branch}`
      );

      return;
    }

    const sessionPermissions =
      Array.isArray(sessionUser.permissions)
        ? sessionUser.permissions.filter(
            (
              permission: unknown
            ): permission is string =>
              typeof permission === "string"
          )
        : [];

    const normalizedUser: FinanceUser = {
      id: String(
        sessionUser.id ||
          localStorage.getItem(
            "finance_user_id"
          ) ||
          ""
      ),

      branch_id: String(
        resolvedBranchId
      ),

      full_name:
        sessionUser.full_name ||
        localStorage.getItem(
          "finance_user_name"
        ) ||
        "الموظف",

      username:
        sessionUser.username ||
        localStorage.getItem(
          "finance_username"
        ) ||
        "",

      role:
        sessionUser.role ||
        localStorage.getItem(
          "finance_role"
        ) ||
        "",

      permissions: sessionPermissions,

      investor_id:
        sessionUser.investor_id || null,

      is_active:
        sessionUser.is_active !== false,

      created_at:
        sessionUser.created_at || null,

      updated_at:
        sessionUser.updated_at || null,
    };

    if (
      !normalizedUser.id ||
      !normalizedUser.username
    ) {
      setLoading(false);

      alert(
        "بيانات جلسة الدخول غير مكتملة، سجل الدخول مرة أخرى"
      );

      clearFinanceSession();
      router.replace("/login");
      return;
    }

    if (!hasPageAccess(normalizedUser)) {
      setLoading(false);

      alert(
        "لا تملك صلاحية الدخول لهذه الصفحة"
      );

      router.replace(
        `/finance/${branch}`
      );

      return;
    }

    setBranchId(resolvedBranchId);
    setCurrentUser(normalizedUser);

    setEmployeeName(
      normalizedUser.full_name ||
        normalizedUser.username ||
        "الموظف"
    );

    setAuthChecked(true);

    await loadLists(
      resolvedBranchId,
      isCancelled
    );
  }

  function readStoredUser(): StoredFinanceUser | null {
    if (typeof window === "undefined") {
      return null;
    }

    const saved =
      localStorage.getItem("finance_user") ||
      localStorage.getItem(
        "finance_branch_user"
      );

    if (!saved) {
      return null;
    }

    try {
      const parsed = JSON.parse(saved);

      if (
        !parsed ||
        typeof parsed !== "object"
      ) {
        return null;
      }

      return parsed as StoredFinanceUser;
    } catch {
      return null;
    }
  }

  function hasPageAccess(
    user: FinanceUser
  ) {
    return (
      MANAGER_ROLES.includes(user.role) ||
      user.permissions.includes(
        "permissions"
      )
    );
  }

  async function loadLists(
    currentBranchId: string,
    isCancelled: () => boolean = () =>
      false
  ) {
    try {
      const [
        usersResult,
        investorsResult,
      ] = await Promise.all([
        supabase
          .from("finance_users")
          .select(
            `
              id,
              branch_id,
              full_name,
              username,
              role,
              permissions,
              investor_id,
              is_active,
              created_at,
              updated_at
            `
          )
          .eq(
            "branch_id",
            currentBranchId
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("finance_investors")
          .select(
            `
              id,
              branch_id,
              investor_name,
              national_id,
              phone,
              notes,
              is_active,
              is_primary,
              created_at
            `
          )
          .eq(
            "branch_id",
            currentBranchId
          )
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (isCancelled()) {
        return;
      }

      if (usersResult.error) {
        console.error(
          "Load users error:",
          usersResult.error
        );

        setUsers([]);

        alert(
          "تم فتح الصفحة، لكن تعذر تحميل قائمة المستخدمين: " +
            usersResult.error.message
        );
      } else {
        setUsers(
          (usersResult.data ||
            []) as FinanceUser[]
        );
      }

      if (investorsResult.error) {
        console.error(
          "Load investors error:",
          investorsResult.error
        );

        setInvestors([]);

        alert(
          "تم فتح الصفحة، لكن تعذر تحميل قائمة المستثمرين: " +
            investorsResult.error.message
        );
      } else {
        setInvestors(
          (investorsResult.data ||
            []) as FinanceInvestor[]
        );
      }
    } catch (error) {
      console.error(
        "Load permissions data error:",
        error
      );

      setUsers([]);
      setInvestors([]);

      alert(
        error instanceof Error
          ? error.message
          : "تعذر تحميل بيانات الموظفين والصلاحيات"
      );
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }

  function clearFinanceSession() {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.removeItem(
      "finance_user"
    );

    localStorage.removeItem(
      "finance_branch_user"
    );

    localStorage.removeItem(
      "finance_user_id"
    );

    localStorage.removeItem(
      "finance_user_name"
    );

    localStorage.removeItem(
      "finance_username"
    );

    localStorage.removeItem(
      "finance_role"
    );

    localStorage.removeItem(
      "finance_branch_id"
    );

    localStorage.removeItem(
      "finance_branch_slug"
    );

    localStorage.removeItem(
      "finance_branch_name"
    );

    localStorage.removeItem(
      "finance_organization_name"
    );
  }

  function logout() {
    clearFinanceSession();
    router.replace("/login");
  }

  function getManagerCredentials() {
    if (!currentUser?.username) {
      alert(
        "تعذر تحديد حساب المدير الحالي"
      );

      return null;
    }

    if (!/^\d{4}$/.test(managerPin)) {
      alert(
        "أدخل الرقم السري الحالي للمدير من 4 أرقام للتأكيد"
      );

      return null;
    }

    return {
      username: currentUser.username,
      pin: managerPin,
    };
  }

  function validateUsername(
    value: string
  ) {
    const username = value.trim();

    if (
      username.length < 3 ||
      username.length > 30
    ) {
      return false;
    }

    return /^[A-Za-z0-9_\u0600-\u06FF]+$/.test(
      username
    );
  }

  function togglePermission(
    permissionKey: string
  ) {
    if (selectedRole === "مستثمر") {
      return;
    }

    setSelectedPermissions(
      (currentPermissions) => {
        if (
          currentPermissions.includes(
            permissionKey
          )
        ) {
          return currentPermissions.filter(
            (item) =>
              item !== permissionKey
          );
        }

        return [
          ...currentPermissions,
          permissionKey,
        ];
      }
    );
  }

  function resetUserForm() {
    setEditingUserId(null);

    setEmployeeNameInput("");
    setEmployeeUsername("");
    setEmployeePassword("");

    setSelectedRole("موظف");

    setSelectedPermissions([
      ...DEFAULT_PERMISSIONS.موظف,
    ]);

    setSelectedInvestorId("");
  }

  function beginEditUser(
    user: FinanceUser
  ) {
    if (
      PROTECTED_ROLES.includes(
        user.role
      )
    ) {
      alert(
        "هذا الحساب تتم إدارته من لوحة الدعم الفني"
      );

      return;
    }

    const normalizedRole: UserRole =
      user.role === "مستثمر"
        ? "مستثمر"
        : user.role === "مدير"
          ? "مدير"
          : "موظف";

    setEditingUserId(user.id);

    setEmployeeNameInput(
      user.full_name || ""
    );

    setEmployeeUsername(
      user.username || ""
    );

    setEmployeePassword("");

    setSelectedRole(normalizedRole);

    setSelectedPermissions(
      normalizedRole === "مستثمر"
        ? [...INVESTOR_PERMISSIONS]
        : Array.isArray(
              user.permissions
            )
          ? [...user.permissions]
          : []
    );

    setSelectedInvestorId(
      user.investor_id || ""
    );

    setActiveTab("create-user");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveUser() {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    const credentials =
      getManagerCredentials();

    if (!credentials) {
      return;
    }

    if (
      !employeeNameInput.trim()
    ) {
      alert(
        "يرجى إدخال اسم المستخدم"
      );

      return;
    }

    if (
      !validateUsername(
        employeeUsername
      )
    ) {
      alert(
        "اسم المستخدم يجب أن يكون من 3 إلى 30 حرفًا ويقبل العربي أو الإنجليزي أو الأرقام أو _ فقط"
      );

      return;
    }

    if (
      !editingUserId &&
      !/^\d{4}$/.test(
        employeePassword
      )
    ) {
      alert(
        "الرقم السري يجب أن يتكون من 4 أرقام"
      );

      return;
    }

    if (
      editingUserId &&
      employeePassword &&
      !/^\d{4}$/.test(
        employeePassword
      )
    ) {
      alert(
        "الرقم السري الجديد يجب أن يتكون من 4 أرقام"
      );

      return;
    }

    if (
      selectedRole === "مستثمر" &&
      !selectedInvestorId
    ) {
      alert(
        "اختر المستثمر المرتبط بالحساب"
      );

      return;
    }

    try {
      setSavingUser(true);

      if (editingUserId) {
        const { error } =
          await supabase.rpc(
            "update_finance_user_atomic",
            {
              p_branch_id: branchId,
              p_actor_username:
                credentials.username,
              p_actor_pin:
                credentials.pin,
              p_user_id:
                editingUserId,
              p_full_name:
                employeeNameInput.trim(),
              p_username:
                employeeUsername.trim(),
              p_role: selectedRole,
              p_permissions:
                selectedRole ===
                "مستثمر"
                  ? INVESTOR_PERMISSIONS
                  : selectedPermissions,
              p_investor_id:
                selectedRole ===
                "مستثمر"
                  ? selectedInvestorId
                  : null,
              p_new_password_pin:
                employeePassword ||
                null,
            }
          );

        if (error) {
          throw new Error(
            error.message
          );
        }

        alert(
          "تم تعديل المستخدم بنجاح"
        );
      } else {
        const { error } =
          await supabase.rpc(
            "create_finance_user_atomic",
            {
              p_branch_id: branchId,
              p_actor_username:
                credentials.username,
              p_actor_pin:
                credentials.pin,
              p_full_name:
                employeeNameInput.trim(),
              p_username:
                employeeUsername.trim(),
              p_password_pin:
                employeePassword,
              p_role: selectedRole,
              p_permissions:
                selectedRole ===
                "مستثمر"
                  ? INVESTOR_PERMISSIONS
                  : selectedPermissions,
              p_investor_id:
                selectedRole ===
                "مستثمر"
                  ? selectedInvestorId
                  : null,
            }
          );

        if (error) {
          throw new Error(
            error.message
          );
        }

        alert(
          "تم إنشاء المستخدم بنجاح"
        );
      }

      resetUserForm();

      await loadLists(branchId);
    } catch (error) {
      console.error(
        "Save finance user error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "تعذر حفظ المستخدم"
      );
    } finally {
      setSavingUser(false);
    }
  }

  async function toggleUserStatus(
    user: FinanceUser
  ) {
    if (!branchId) {
      return;
    }

    if (
      PROTECTED_ROLES.includes(
        user.role
      )
    ) {
      alert(
        "لا يمكن تعديل حالة هذا الحساب من هنا"
      );

      return;
    }

    if (
      user.id === currentUser?.id
    ) {
      alert(
        "لا يمكنك تعطيل حسابك الحالي"
      );

      return;
    }

    const credentials =
      getManagerCredentials();

    if (!credentials) {
      return;
    }

    const confirmed = confirm(
      user.is_active
        ? `هل تريد تعطيل حساب ${user.full_name}؟`
        : `هل تريد تفعيل حساب ${user.full_name}؟`
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingUserId(user.id);

      const { error } =
        await supabase.rpc(
          "toggle_finance_user_status_atomic",
          {
            p_branch_id: branchId,
            p_actor_username:
              credentials.username,
            p_actor_pin:
              credentials.pin,
            p_user_id: user.id,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await loadLists(branchId);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "تعذر تعديل حالة المستخدم"
      );
    } finally {
      setProcessingUserId(null);
    }
  }

  async function deleteUser(
    user: FinanceUser
  ) {
    if (!branchId) {
      return;
    }

    if (
      PROTECTED_ROLES.includes(
        user.role
      )
    ) {
      alert(
        "لا يمكن حذف هذا الحساب من هنا"
      );

      return;
    }

    if (
      user.id === currentUser?.id
    ) {
      alert(
        "لا يمكنك حذف حسابك الحالي"
      );

      return;
    }

    const credentials =
      getManagerCredentials();

    if (!credentials) {
      return;
    }

    const confirmed = confirm(
      `هل أنت متأكد من حذف المستخدم ${user.full_name}؟`
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingUserId(user.id);

      const { error } =
        await supabase.rpc(
          "delete_finance_user_atomic",
          {
            p_branch_id: branchId,
            p_actor_username:
              credentials.username,
            p_actor_pin:
              credentials.pin,
            p_user_id: user.id,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      alert(
        "تم حذف المستخدم بنجاح"
      );

      await loadLists(branchId);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "تعذر حذف المستخدم"
      );
    } finally {
      setProcessingUserId(null);
    }
  }

  async function createInvestor() {
    if (!branchId) {
      alert("تعذر تحديد الفرع");
      return;
    }

    if (
      !investorNameInput.trim()
    ) {
      alert(
        "يرجى إدخال اسم المستثمر"
      );

      return;
    }

    if (
      investorNationalId &&
      !/^\d{10}$/.test(
        investorNationalId
      )
    ) {
      alert(
        "رقم الهوية يجب أن يتكون من 10 أرقام"
      );

      return;
    }

    if (
      investorPhone &&
      !/^05\d{8}$/.test(
        investorPhone
      )
    ) {
      alert(
        "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام"
      );

      return;
    }

    try {
      setSavingInvestor(true);

      if (investorNationalId) {
        const {
          data: duplicateInvestor,
          error: duplicateError,
        } = await supabase
          .from("finance_investors")
          .select("id")
          .eq("branch_id", branchId)
          .eq(
            "national_id",
            investorNationalId
          )
          .maybeSingle();

        if (duplicateError) {
          throw new Error(
            duplicateError.message
          );
        }

        if (duplicateInvestor) {
          alert(
            "يوجد مستثمر مسجل بنفس رقم الهوية"
          );

          return;
        }
      }

      const { error } = await supabase
        .from("finance_investors")
        .insert({
          branch_id: branchId,
          investor_name:
            investorNameInput.trim(),
          national_id:
            investorNationalId ||
            null,
          phone:
            investorPhone || null,
          notes:
            investorNotes.trim() ||
            null,
          is_active: true,
          is_primary: false,
        });

      if (error) {
        throw new Error(
          error.message
        );
      }

      setInvestorNameInput("");
      setInvestorNationalId("");
      setInvestorPhone("");
      setInvestorNotes("");

      alert(
        "تم إنشاء المستثمر بنجاح دون إنشاء حساب دخول"
      );

      await loadLists(branchId);
    } catch (error) {
      console.error(
        "Create investor error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "تعذر إنشاء المستثمر"
      );
    } finally {
      setSavingInvestor(false);
    }
  }

  function getInvestorName(
    investorId?: string | null
  ) {
    if (!investorId) {
      return "-";
    }

    return (
      investors.find(
        (investor) =>
          investor.id === investorId
      )?.investor_name || "-"
    );
  }

  if (!authChecked || loading) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(isMobile)}
      >
        <div style={loadingBox}>
          جاري تحميل إدارة الموظفين
          والصلاحيات...
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={getPageStyle(isMobile)}
    >
      <div
        style={getContainerStyle(
          isCompact
        )}
      >
        <header
          style={getHeroStyle(isMobile)}
        >
          <div style={heroCircleOne} />
          <div style={heroCircleTwo} />
          <div style={heroCircleThree} />
          <div style={heroDots} />

          <div
            style={getHeroContentStyle(
              screen
            )}
          >
            <div
              style={getHeroUserCardStyle(
                screen
              )}
            >
              <div
                style={getEmployeeTopRowStyle(
                  screen
                )}
              >
                <div style={employeeIcon}>
                  <UserIcon />
                </div>

                <div
                  style={getEmployeeNameStyle(
                    isMobile
                  )}
                >
                  {employeeName}
                </div>

                {!isMobile && (
                  <div
                    style={
                      employeeDividerSmall
                    }
                  />
                )}

                <button
                  type="button"
                  style={
                    logoutInlineButton
                  }
                  onClick={logout}
                >
                  <LogoutIcon />

                  <span>
                    تسجيل الخروج
                  </span>
                </button>
              </div>

              <button
                type="button"
                style={getMainWorkstationButtonStyle(
                  isMobile
                )}
                onClick={() =>
                  router.push(
                    `/finance/${branch}`
                  )
                }
              >
                <HomeIcon />

                <span>
                  محطة العمل الرئيسية
                </span>
              </button>
            </div>

            <div
              style={getHeroTitleBoxStyle(
                screen
              )}
            >
              <h1
                style={getTitleStyle(
                  screen
                )}
              >
                إدارة الموظفين والصلاحيات
              </h1>
            </div>

            <div
              style={getHeroActionBoxStyle(
                screen
              )}
            />
          </div>
        </header>

        <section style={managerPinCard}>
          <Field label="الرقم السري الحالي للمدير للتأكيد">
            <input
              style={input}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={managerPin}
              onChange={(event) =>
                setManagerPin(
                  event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4)
                )
              }
              placeholder="أدخل 4 أرقام"
              autoComplete="off"
            />
          </Field>
        </section>

        <section style={tabs}>
          <button
            type="button"
            style={
              activeTab ===
              "create-user"
                ? activeTabButton
                : tabButton
            }
            onClick={() => {
              resetUserForm();

              setActiveTab(
                "create-user"
              );
            }}
          >
            إنشاء مستخدم جديد
          </button>

          <button
            type="button"
            style={
              activeTab === "users"
                ? activeTabButton
                : tabButton
            }
            onClick={() =>
              setActiveTab("users")
            }
          >
            المستخدمون
          </button>

          <button
            type="button"
            style={
              activeTab ===
              "create-investor"
                ? activeTabButton
                : tabButton
            }
            onClick={() =>
              setActiveTab(
                "create-investor"
              )
            }
          >
            إنشاء مستثمر
          </button>

          <button
            type="button"
            style={
              activeTab === "investors"
                ? activeTabButton
                : tabButton
            }
            onClick={() =>
              setActiveTab(
                "investors"
              )
            }
          >
            المستثمرون
          </button>
        </section>

        {activeTab ===
          "create-user" && (
          <section style={card}>
            <div style={cardHeadingRow}>
              <h2 style={sectionTitle}>
                {editingUserId
                  ? "تعديل المستخدم"
                  : "إنشاء مستخدم جديد"}
              </h2>

              {editingUserId && (
                <button
                  type="button"
                  style={cancelEditButton}
                  onClick={resetUserForm}
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            <div style={formGrid}>
              <Field label="الاسم الكامل">
                <input
                  style={input}
                  value={
                    employeeNameInput
                  }
                  onChange={(event) =>
                    setEmployeeNameInput(
                      event.target.value
                    )
                  }
                  placeholder="مثال: محمد أحمد"
                />
              </Field>

              <Field label="اسم المستخدم">
                <input
                  style={input}
                  value={
                    employeeUsername
                  }
                  onChange={(event) =>
                    setEmployeeUsername(
                      event.target.value
                    )
                  }
                  placeholder="عربي أو إنجليزي"
                  autoCapitalize="none"
                />
              </Field>

              <Field
                label={
                  editingUserId
                    ? "رقم سري جديد - اختياري"
                    : "الرقم السري - 4 أرقام"
                }
              >
                <input
                  style={input}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={
                    employeePassword
                  }
                  onChange={(event) =>
                    setEmployeePassword(
                      event.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(0, 4)
                    )
                  }
                  placeholder={
                    editingUserId
                      ? "اتركه فارغًا دون تغيير"
                      : "مثال: 1234"
                  }
                  autoComplete="new-password"
                />
              </Field>
            </div>

            <h3 style={smallTitle}>
              نوع المستخدم
            </h3>

            <div style={roleGrid}>
              {(
                [
                  "مدير",
                  "موظف",
                  "مستثمر",
                ] as UserRole[]
              ).map((role) => (
                <label
                  key={role}
                  style={
                    selectedRole === role
                      ? selectedRoleBox
                      : roleBox
                  }
                >
                  <input
                    type="radio"
                    name="finance-user-role"
                    checked={
                      selectedRole ===
                      role
                    }
                    onChange={() =>
                      setSelectedRole(
                        role
                      )
                    }
                  />

                  <span>{role}</span>
                </label>
              ))}
            </div>

            {selectedRole ===
              "مستثمر" && (
              <div
                style={
                  investorAccountBox
                }
              >
                <Field label="المستثمر المرتبط بالحساب">
                  <select
                    style={input}
                    value={
                      selectedInvestorId
                    }
                    onChange={(event) =>
                      setSelectedInvestorId(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      اختر المستثمر
                    </option>

                    {availableInvestorsForAccount.map(
                      (investor) => (
                        <option
                          key={
                            investor.id
                          }
                          value={
                            investor.id
                          }
                        >
                          {
                            investor.investor_name
                          }

                          {investor.national_id
                            ? ` - ${investor.national_id}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <div style={investorNotice}>
                  حساب المستثمر يظهر له
                  سير العمل وبياناته
                  الاستثمارية وعقوده فقط.
                </div>
              </div>
            )}

            <h3 style={smallTitle}>
              الصلاحيات
            </h3>

            <PermissionGroups
              selectedPermissions={
                selectedPermissions
              }
              disabled={
                selectedRole ===
                "مستثمر"
              }
              onToggle={
                togglePermission
              }
            />

            <button
              type="button"
              style={saveButton}
              onClick={saveUser}
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
            <h2 style={sectionTitle}>
              قائمة المستخدمين
            </h2>

            {users.length === 0 ? (
              <div style={emptyBox}>
                لا توجد بيانات مستخدمين.
              </div>
            ) : (
              <div style={usersList}>
                {users.map((user) => {
                  const isProtected =
                    PROTECTED_ROLES.includes(
                      user.role
                    );

                  const isCurrent =
                    user.id ===
                    currentUser?.id;

                  const isProcessing =
                    processingUserId ===
                    user.id;

                  return (
                    <article
                      key={user.id}
                      style={userCard}
                    >
                      <div
                        style={
                          userInformation
                        }
                      >
                        <div
                          style={
                            userTitleRow
                          }
                        >
                          <strong
                            style={
                              userFullName
                            }
                          >
                            {user.full_name ||
                              "-"}
                          </strong>

                          <span
                            style={
                              user.is_active
                                ? activeBadge
                                : inactiveBadge
                            }
                          >
                            {user.is_active
                              ? "نشط"
                              : "معطل"}
                          </span>
                        </div>

                        <div
                          style={mutedText}
                        >
                          اسم المستخدم:{" "}
                          {user.username ||
                            "-"}
                        </div>

                        <div
                          style={mutedText}
                        >
                          النوع:{" "}
                          {user.role || "-"}
                        </div>

                        {user.role ===
                          "مستثمر" && (
                          <div
                            style={
                              mutedText
                            }
                          >
                            المستثمر:{" "}
                            {getInvestorName(
                              user.investor_id
                            )}
                          </div>
                        )}

                        <div
                          style={
                            permissionTags
                          }
                        >
                          {(
                            user.permissions ||
                            []
                          ).length === 0 ? (
                            <span
                              style={
                                noPermissionTag
                              }
                            >
                              لا توجد صلاحيات
                            </span>
                          ) : (
                            (
                              user.permissions ||
                              []
                            ).map(
                              (
                                permission
                              ) => (
                                <span
                                  key={
                                    permission
                                  }
                                  style={
                                    permissionTag
                                  }
                                >
                                  {getPermissionLabel(
                                    permission
                                  )}
                                </span>
                              )
                            )
                          )}
                        </div>
                      </div>

                      <div
                        style={userActions}
                      >
                        <button
                          type="button"
                          style={
                            editSmallButton
                          }
                          disabled={
                            isProtected ||
                            isProcessing
                          }
                          onClick={() =>
                            beginEditUser(
                              user
                            )
                          }
                        >
                          تعديل
                        </button>

                        <button
                          type="button"
                          style={
                            graySmallButton
                          }
                          disabled={
                            isProtected ||
                            isCurrent ||
                            isProcessing
                          }
                          onClick={() =>
                            toggleUserStatus(
                              user
                            )
                          }
                        >
                          {isProcessing
                            ? "جاري التنفيذ..."
                            : user.is_active
                              ? "تعطيل"
                              : "تفعيل"}
                        </button>

                        <button
                          type="button"
                          style={
                            dangerSmallButton
                          }
                          disabled={
                            isProtected ||
                            isCurrent ||
                            isProcessing
                          }
                          onClick={() =>
                            deleteUser(user)
                          }
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

        {activeTab ===
          "create-investor" && (
          <section style={card}>
            <h2 style={sectionTitle}>
              إنشاء مستثمر
            </h2>

            <div style={investorNotice}>
              إنشاء المستثمر هنا ينشئ
              سجلًا استثماريًا فقط، ولا
              ينشئ له حساب دخول تلقائيًا.
            </div>

            <div style={formGrid}>
              <Field label="اسم المستثمر">
                <input
                  style={input}
                  value={
                    investorNameInput
                  }
                  onChange={(event) =>
                    setInvestorNameInput(
                      event.target.value
                    )
                  }
                  placeholder="اسم المستثمر"
                />
              </Field>

              <Field label="رقم الهوية - اختياري">
                <input
                  style={input}
                  inputMode="numeric"
                  maxLength={10}
                  value={
                    investorNationalId
                  }
                  onChange={(event) =>
                    setInvestorNationalId(
                      event.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(0, 10)
                    )
                  }
                  placeholder="10 أرقام"
                />
              </Field>

              <Field label="رقم الجوال - اختياري">
                <input
                  style={input}
                  inputMode="tel"
                  maxLength={10}
                  value={
                    investorPhone
                  }
                  onChange={(event) =>
                    setInvestorPhone(
                      event.target.value
                        .replace(
                          /\D/g,
                          ""
                        )
                        .slice(0, 10)
                    )
                  }
                  placeholder="05xxxxxxxx"
                />
              </Field>
            </div>

            <Field label="ملاحظات - اختياري">
              <textarea
                style={textarea}
                value={investorNotes}
                onChange={(event) =>
                  setInvestorNotes(
                    event.target.value
                  )
                }
                rows={4}
                placeholder="ملاحظات المستثمر"
              />
            </Field>

            <button
              type="button"
              style={saveButton}
              onClick={createInvestor}
              disabled={
                savingInvestor
              }
            >
              {savingInvestor
                ? "جاري الحفظ..."
                : "إنشاء المستثمر"}
            </button>
          </section>
        )}

        {activeTab ===
          "investors" && (
          <section style={card}>
            <h2 style={sectionTitle}>
              المستثمرون
            </h2>

            {investors.length === 0 ? (
              <div style={emptyBox}>
                لا يوجد مستثمرون حتى
                الآن.
              </div>
            ) : (
              <div style={investorsGrid}>
                {investors.map(
                  (investor) => {
                    const account =
                      users.find(
                        (user) =>
                          user.investor_id ===
                          investor.id
                      );

                    return (
                      <article
                        key={
                          investor.id
                        }
                        style={
                          investorCard
                        }
                      >
                        <div
                          style={
                            investorCardTop
                          }
                        >
                          <strong>
                            {
                              investor.investor_name
                            }
                          </strong>

                          <span
                            style={
                              investor.is_active ===
                              false
                                ? inactiveBadge
                                : activeBadge
                            }
                          >
                            {investor.is_active ===
                            false
                              ? "معطل"
                              : "نشط"}
                          </span>
                        </div>

                        <div
                          style={
                            mutedText
                          }
                        >
                          الهوية:{" "}
                          {investor.national_id ||
                            "-"}
                        </div>

                        <div
                          style={
                            mutedText
                          }
                        >
                          الجوال:{" "}
                          {investor.phone ||
                            "-"}
                        </div>

                        <div
                          style={
                            account
                              ? linkedAccountBox
                              : noAccountBox
                          }
                        >
                          {account
                            ? `حساب الدخول: ${account.username}`
                            : "لا يوجد حساب دخول"}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

        <div style={backWrapper}>
          <button
            type="button"
            style={backButton}
            onClick={() =>
              router.back()
            }
          >
            ← رجوع
          </button>
        </div>
      </div>
    </main>
  );
}

function PermissionGroups({
  selectedPermissions,
  disabled = false,
  onToggle,
}: PermissionGroupsProps) {
  return (
    <div style={permissionGroups}>
      {PERMISSION_GROUPS.map(
        (group) => (
          <section
            key={group.title}
            style={permissionGroupCard}
          >
            <h4
              style={
                permissionGroupTitle
              }
            >
              {group.title}
            </h4>

            <div
              style={permissionChecksGrid}
            >
              {group.permissions.map(
                (permission) => (
                  <label
                    key={permission.key}
                    style={
                      selectedPermissions.includes(
                        permission.key
                      )
                        ? selectedPermissionBox
                        : permissionBox
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(
                        permission.key
                      )}
                      disabled={disabled}
                      onChange={() =>
                        onToggle(
                          permission.key
                        )
                      }
                    />

                    <span>
                      {permission.label}
                    </span>
                  </label>
                )
              )}
            </div>
          </section>
        )
      )}

      {disabled && (
        <div style={investorNotice}>
          صلاحيات المستثمر ثابتة ومحددة
          بسير العمل وبياناته الاستثمارية
          وعقوده فقط.
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: FieldProps) {
  return (
    <div style={fieldBox}>
      <label style={labelStyle}>
        {label}
      </label>

      {children}
    </div>
  );
}

function getPermissionLabel(
  permissionKey: string
) {
  if (
    permissionKey ===
    "investor_data"
  ) {
    return "البيانات الاستثمارية";
  }

  if (
    permissionKey ===
    "investor_contracts"
  ) {
    return "عقود المستثمر";
  }

  for (
    const group of PERMISSION_GROUPS
  ) {
    const permission =
      group.permissions.find(
        (item) =>
          item.key === permissionKey
      );

    if (permission) {
      return permission.label;
    }
  }

  return permissionKey;
}

function UserIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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

function getPageStyle(
  isMobile: boolean
): CSSProperties {
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
    backgroundAttachment: isMobile
      ? "scroll"
      : "fixed",
    padding: isMobile ? 10 : 18,
    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getContainerStyle(
  isCompact: boolean
): CSSProperties {
  return {
    width: "100%",
    maxWidth: isCompact ? 980 : 1180,
    margin: "auto",
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",
    minHeight: isMobile
      ? "auto"
      : 160,
    borderRadius: isMobile
      ? 20
      : 24,
    padding: isMobile
      ? "18px 14px"
      : "22px 26px",
    marginBottom: 14,
    overflow: "hidden",
    background:
      "radial-gradient(circle at 15% 18%, rgba(255,255,255,0.08) 0, transparent 24%), radial-gradient(circle at 86% 18%, rgba(255,255,255,0.11) 0, transparent 26%), linear-gradient(105deg,#071c48 0%,#0a327d 30%,#0d65d9 60%,#23a8e4 82%,#6edce4 100%)",
    boxShadow: "none",
    isolation: "isolate",
  };
}

function getHeroContentStyle(
  screen: ScreenType
): CSSProperties {
  if (screen === "mobile") {
    return {
      position: "relative",
      zIndex: 3,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
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
      gap: 18,
      direction: "rtl",
    };
  }

  return {
    position: "relative",
    zIndex: 3,
    minHeight: 116,
    display: "grid",
    gridTemplateColumns:
      "minmax(250px,315px) 1fr minmax(220px,315px)",
    alignItems: "center",
    gap: 16,
    direction: "ltr",
  };
}

function getHeroUserCardStyle(
  screen: ScreenType
): CSSProperties {
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

function getEmployeeTopRowStyle(
  screen: ScreenType
): CSSProperties {
  return {
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    justifyContent:
      screen === "desktop"
        ? "flex-start"
        : "center",
    flexWrap: "wrap",
    gap: 12,
    direction:
      screen === "desktop"
        ? "ltr"
        : "rtl",
    color: "#ffffff",
    width: "100%",
  };
}

function getEmployeeNameStyle(
  isMobile: boolean
): CSSProperties {
  return {
    color: "#ffffff",
    fontSize: isMobile ? 15 : 17,
    fontWeight: 900,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getMainWorkstationButtonStyle(
  isMobile: boolean
): CSSProperties {
  return {
    width: isMobile
      ? "100%"
      : 220,
    maxWidth: isMobile
      ? 280
      : 220,
    height: 44,
    border: "none",
    background:
      "linear-gradient(135deg,#72e77d,#22c55e 58%,#16a34a)",
    color: "#ffffff",
    borderRadius: 999,
    padding: "0 18px",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    fontFamily:
      "var(--font-almarai), sans-serif",
    boxShadow:
      "0 8px 18px rgba(22,163,74,0.20)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    whiteSpace: "nowrap",
    direction: "rtl",
  };
}

function getHeroTitleBoxStyle(
  screen: ScreenType
): CSSProperties {
  return {
    position: "relative",
    zIndex: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    direction: "rtl",
    pointerEvents: "none",
    order:
      screen === "desktop"
        ? 0
        : 1,
  };
}

function getTitleStyle(
  screen: ScreenType
): CSSProperties {
  return {
    margin: 0,
    color: "#ffffff",
    fontSize:
      screen === "mobile"
        ? 24
        : screen === "tablet"
          ? 28
          : 30,
    lineHeight: 1.4,
    fontWeight: 900,
    letterSpacing: "-0.4px",
    textShadow:
      "0 5px 14px rgba(15,23,42,0.14)",
    fontFamily:
      "var(--font-almarai), sans-serif",
  };
}

function getHeroActionBoxStyle(
  screen: ScreenType
): CSSProperties {
  return {
    display:
      screen === "desktop"
        ? "flex"
        : "none",
  };
}

const employeeIcon: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border:
    "1.5px solid rgba(255,255,255,0.34)",
  background:
    "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color:
    "rgba(255,255,255,0.96)",
};

const employeeDividerSmall: CSSProperties = {
  width: 1,
  height: 34,
  background:
    "rgba(255,255,255,0.30)",
};

const logoutInlineButton: CSSProperties = {
  border: "none",
  background: "transparent",
  color:
    "rgba(255,255,255,0.90)",
  fontSize: 15,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 9,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
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
  background:
    "rgba(255,255,255,0.075)",
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
  background:
    "rgba(255,255,255,0.045)",
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
  background:
    "rgba(255,255,255,0.035)",
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
  backgroundImage:
    "radial-gradient(rgba(255,255,255,0.40) 2px, transparent 2px)",
  backgroundSize: "14px 14px",
  zIndex: 2,
};

const managerPinCard: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 16,
  marginBottom: 14,
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const tabs: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: 10,
  marginBottom: 14,
};

const tabButton: CSSProperties = {
  padding: 14,
  background: "#ffffff",
  color: "#0d47a1",
  border:
    "1px solid #d9e3f5",
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const activeTabButton: CSSProperties = {
  ...tabButton,
  background:
    "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "#ffffff",
};

const card: CSSProperties = {
  background: "#ffffff",
  border:
    "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 20,
  marginBottom: 16,
  boxShadow:
    "0 8px 20px rgba(15,23,42,0.04)",
};

const cardHeadingRow: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const sectionTitle: CSSProperties = {
  margin: "0 0 16px",
  color: "#0d47a1",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const smallTitle: CSSProperties = {
  color: "#0d47a1",
  margin: "18px 0 10px",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(230px,1fr))",
  gap: 12,
};

const fieldBox: CSSProperties = {
  marginBottom: 12,
};

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
  border:
    "1px solid #d9e3f5",
  fontSize: 15,
  boxSizing: "border-box",
  fontFamily:
    "var(--font-almarai), sans-serif",
  background: "#ffffff",
};

const textarea: CSSProperties = {
  ...input,
  resize: "vertical",
};

const roleGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",
  gap: 10,
};

const roleBox: CSSProperties = {
  border:
    "1px solid #d9e3f5",
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
  border:
    "1px solid #2563eb",
  background: "#eff6ff",
  color: "#0d47a1",
};

const investorAccountBox: CSSProperties = {
  marginTop: 14,
  border:
    "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 15,
  padding: 14,
};

const investorNotice: CSSProperties = {
  background: "#eff6ff",
  color: "#1e3a8a",
  border:
    "1px solid #bfdbfe",
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
  border:
    "1px solid #d9e3f5",
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
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: 9,
};

const permissionBox: CSSProperties = {
  border:
    "1px solid #d9e3f5",
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
  border:
    "1px solid #60a5fa",
  background: "#eff6ff",
  color: "#1e3a8a",
};

const saveButton: CSSProperties = {
  width: "100%",
  padding: 15,
  background:
    "linear-gradient(135deg,#0d47a1,#1976d2)",
  color: "#ffffff",
  border: "none",
  borderRadius: 14,
  fontSize: 16,
  fontWeight: 900,
  marginTop: 18,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const cancelEditButton: CSSProperties = {
  padding: "9px 13px",
  border:
    "1px solid #cbd5e1",
  borderRadius: 10,
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 900,
  cursor: "pointer",
};

const usersList: CSSProperties = {
  display: "grid",
  gap: 12,
};

const userCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1fr) auto",
  gap: 14,
  padding: 15,
  border:
    "1px solid #e2e8f0",
  borderRadius: 15,
  background: "#fbfdff",
  alignItems: "center",
};

const userInformation: CSSProperties = {
  minWidth: 0,
};

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
  border:
    "1px solid #bfdbfe",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 11,
  fontWeight: 800,
};

const noPermissionTag: CSSProperties = {
  ...permissionTag,
  background: "#f8fafc",
  color: "#64748b",
  border:
    "1px solid #e2e8f0",
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

const editSmallButton: CSSProperties = {
  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const graySmallButton: CSSProperties = {
  background: "#e5e7eb",
  color: "#334155",
  border:
    "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const dangerSmallButton: CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  border:
    "1px solid #fecaca",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 900,
  cursor: "pointer",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const investorsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(240px,1fr))",
  gap: 12,
};

const investorCard: CSSProperties = {
  border:
    "1px solid #d9e3f5",
  borderRadius: 15,
  padding: 14,
  background: "#fbfdff",
};

const investorCardTop: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 8,
};

const linkedAccountBox: CSSProperties = {
  marginTop: 10,
  background: "#dcfce7",
  color: "#166534",
  border:
    "1px solid #bbf7d0",
  borderRadius: 10,
  padding: 9,
  fontSize: 12,
  fontWeight: 900,
};

const noAccountBox: CSSProperties = {
  marginTop: 10,
  background: "#f8fafc",
  color: "#64748b",
  border:
    "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 9,
  fontSize: 12,
  fontWeight: 900,
};

const emptyBox: CSSProperties = {
  background: "#f8fbff",
  border:
    "1px dashed #cbd5e1",
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
  background:
    "linear-gradient(135deg,#22c55e,#15803d)",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow:
    "0 5px 14px rgba(22,163,74,0.22)",
  fontFamily:
    "var(--font-almarai), sans-serif",
};

const loadingBox: CSSProperties = {
  maxWidth: 850,
  margin: "80px auto",
  background: "#ffffff",
  border:
    "1px solid #d9e3f5",
  borderRadius: 18,
  padding: 24,
  textAlign: "center",
  color: "#0d47a1",
  fontWeight: 900,
};
