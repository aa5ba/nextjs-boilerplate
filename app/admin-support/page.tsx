"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";

const SUPPORT_PERMISSIONS = [
  {
    key: "manage_branches",
    label: "إدارة الفروع",
  },
  {
    key: "manage_support_users",
    label: "إدارة مستخدمي الدعم",
  },
  {
    key: "system_settings",
    label: "إعدادات النظام",
  },
  {
    key: "impersonate_branch",
    label: "الدخول للفروع",
  },
  {
    key: "view_logs",
    label: "عرض السجلات",
  },
  {
    key: "backup_restore",
    label: "النسخ والاستعادة",
  },
  {
    key: "manage_verification_results",
    label: "إدارة نتائج التحقق",
  },
] as const;

const SUPPORT_ROLES = [
  "support",
  "viewer",
  "super_admin",
] as const;

const VERIFICATION_POSITIONS = [
  "نشط",
  "متأخر",
  "متعثر",
] as const;

const BRANCHES_PAGE_SIZE = 15;
const DASHBOARD_PAGE_SIZE = 25;
const DASHBOARD_LOGS_PAGE_SIZE = 50;
const REQUEST_TIMEOUT_MS = 30_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BRANCH_SLUG_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

const USERNAME_PATTERN =
  /^[A-Za-z0-9_]{3,30}$/;

type SupportPermission =
  (typeof SUPPORT_PERMISSIONS)[number]["key"];

type SupportRole =
  (typeof SUPPORT_ROLES)[number];

type VerificationPosition =
  (typeof VERIFICATION_POSITIONS)[number];

type ScreenType =
  | "mobile"
  | "tablet"
  | "desktop";

type TabType =
  | "overview"
  | "branches"
  | "branch_managers"
  | "users"
  | "verifications"
  | "logs";

type DashboardSection =
  | "all"
  | "branches"
  | "support_users"
  | "logs";

type BranchListMode =
  | "active"
  | "deleted";

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
  is_deleted: boolean;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
  deleted_by_user_id: string | null;
  deleted_by_user_name: string | null;
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
  finance_branches?:
    | BranchRelation
    | BranchRelation[]
    | null;
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

type RawVerificationContract = {
  contract_id?: unknown;
  contract_number?: unknown;

  branch_id?: unknown;
  branch_name?: unknown;
  branch_slug?: unknown;

  customer_id?: unknown;
  customer_name?: unknown;
  national_id?: unknown;
  customer_phone?: unknown;

  debt_amount?: unknown;
  paid_amount?: unknown;
  remaining_amount?: unknown;

  payment_due_date?: unknown;
  contract_date?: unknown;
  contract_state?: unknown;

  automatic_position?: unknown;
  effective_position?: unknown;

  has_support_override?: unknown;
  override_position?: unknown;
  override_reason?: unknown;
  override_notes?: unknown;
  override_updated_at?: unknown;

  default_declared_at?: unknown;
  default_expires_at?: unknown;
  default_reason?: unknown;
  default_notes?: unknown;
};

type PaginationState = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type DashboardPagination = {
  branches: PaginationState;
  deleted_branches: PaginationState;
  branch_managers: PaginationState;
  support_users: PaginationState;
  logs: PaginationState;
};

type DashboardResponse = {
  ok: boolean;
  message?: string;

  requested_section?: DashboardSection;

  user?: CurrentUser;
  access?: DashboardAccess;

  branches?: unknown;
  deleted_branches?: unknown;
  branch_managers?: unknown;
  support_users?: unknown;
  logs?: unknown;

  pagination?: Partial<DashboardPagination>;
};

type ApiResponse<T = unknown> = {
  ok: boolean;
  message?: string;
  data?: T;
  redirect_url?: string;
};

type NoticeType =
  | "success"
  | "error"
  | "info";

type NoticeState = {
  type: NoticeType;
  message: string;
} | null;

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
} | null;

type PasswordDialogState = {
  manager: BranchManager;
  value: string;
} | null;

type ArchiveDialogState = {
  branch: Branch;
  value: string;
} | null;

type BusyAction =
  | "dashboard"
  | "save_branch"
  | "logout"
  | "create_support_user"
  | "verification_search"
  | "verification_refresh"
  | `dashboard_section:${DashboardSection}`
  | `branch_status:${string}`
  | `branch_enter:${string}`
  | `branch_archive:${string}`
  | `branch_restore:${string}`
  | `manager_status:${string}`
  | `manager_password:${string}`
  | `support_status:${string}`
  | `support_permissions:${string}`
  | `verification_set:${string}`
  | `verification_clear:${string}`;

type RequestResult<T> =
  | {
      ok: true;
      status: number;
      payload: ApiResponse<T>;
    }
  | {
      ok: false;
      status: number;
      message: string;
      aborted: boolean;
      unauthorized: boolean;
      forbidden: boolean;
      rateLimited: boolean;
    };

type PaginationReference = {
  branchesPage: number;
  deletedBranchesPage: number;
  managersPage: number;
  usersPage: number;
  logsPage: number;
};

const EMPTY_ACCESS: DashboardAccess = {
  manage_branches: false,
  impersonate_branch: false,
  manage_support_users: false,
  view_logs: false,
  system_settings: false,
  backup_restore: false,
  manage_verification_results: false,
};

const EMPTY_BRANCHES_PAGINATION: PaginationState = {
  page: 1,
  page_size: BRANCHES_PAGE_SIZE,
  total: 0,
  total_pages: 0,
};

const EMPTY_PAGINATION: PaginationState = {
  page: 1,
  page_size: DASHBOARD_PAGE_SIZE,
  total: 0,
  total_pages: 0,
};

const EMPTY_LOGS_PAGINATION: PaginationState = {
  page: 1,
  page_size: DASHBOARD_LOGS_PAGE_SIZE,
  total: 0,
  total_pages: 0,
};

function normalizeDigits(
  value: string
): string {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(
        "٠١٢٣٤٥٦٧٨٩".indexOf(
          digit
        )
      )
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(
        "۰۱۲۳۴۵۶۷۸۹".indexOf(
          digit
        )
      )
    );
}

function cleanNumericValue(
  value: string,
  maxLength = 30
): string {
  return normalizeDigits(value)
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

function normalizePhoneValue(
  value: string,
  maxLength = 20
): string {
  const normalized =
    normalizeDigits(value).trim();

  const hasLeadingPlus =
    normalized.startsWith("+");

  const digits = normalized
    .replace(/\D/g, "")
    .slice(
      0,
      hasLeadingPlus
        ? Math.max(
            0,
            maxLength - 1
          )
        : maxLength
    );

  return hasLeadingPlus
    ? `+${digits}`
    : digits;
}

function cleanTextValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function nullableTextValue(
  value: unknown
): string | null {
  const cleaned =
    cleanTextValue(value);

  return cleaned || null;
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function isValidUuid(
  value: string
): boolean {
  return UUID_PATTERN.test(value);
}

function isValidBranchSlug(
  value: string
): boolean {
  return BRANCH_SLUG_PATTERN.test(
    value
  );
}

function isValidUsername(
  value: string
): boolean {
  return USERNAME_PATTERN.test(
    value
  );
}

function isValidPin(
  value: string
): boolean {
  return /^\d{4,8}$/.test(value);
}

function isValidSupportPassword(
  value: string
): boolean {
  return (
    value.length >= 4 &&
    value.length <= 100
  );
}

function isSupportRole(
  value: unknown
): value is SupportRole {
  return (
    typeof value === "string" &&
    (
      SUPPORT_ROLES as readonly string[]
    ).includes(value)
  );
}

function isSupportPermission(
  value: unknown
): value is SupportPermission {
  return (
    typeof value === "string" &&
    SUPPORT_PERMISSIONS.some(
      (permission) =>
        permission.key === value
    )
  );
}

function normalizeSupportPermissions(
  value: unknown
): SupportPermission[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        isSupportPermission
      )
    )
  );
}

function toFiniteNumber(
  value: unknown
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function normalizeBoolean(
  value: unknown,
  fallback = false
): boolean {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function normalizeDateText(
  value: unknown
): string {
  return cleanTextValue(value);
}

function isVerificationPosition(
  value: unknown
): value is VerificationPosition {
  return (
    typeof value === "string" &&
    (
      VERIFICATION_POSITIONS as readonly string[]
    ).includes(value)
  );
}

function normalizeVerificationPosition(
  value: unknown,
  fallback: VerificationPosition = "نشط"
): VerificationPosition {
  return isVerificationPosition(value)
    ? value
    : fallback;
}

function normalizeOptionalVerificationPosition(
  value: unknown
): VerificationPosition | null {
  return isVerificationPosition(value)
    ? value
    : null;
}

function normalizeCurrentUser(
  value: unknown
): CurrentUser | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id =
    cleanTextValue(value.id);

  const fullName =
    cleanTextValue(
      value.full_name
    );

  const username =
    cleanTextValue(
      value.username
    );

  const role =
    cleanTextValue(
      value.role
    ).toLowerCase();

  if (
    !isValidUuid(id) ||
    !username ||
    !role
  ) {
    return null;
  }

  return {
    id,
    full_name:
      fullName || username,
    username,
    role,
    permissions:
      Array.isArray(
        value.permissions
      )
        ? Array.from(
            new Set(
              value.permissions
                .filter(
                  (
                    permission
                  ): permission is string =>
                    typeof permission ===
                    "string"
                )
                .map((permission) =>
                  permission.trim()
                )
                .filter(Boolean)
            )
          )
        : [],
  };
}

function normalizeDashboardAccess(
  value: unknown
): DashboardAccess | null {
  if (!isPlainObject(value)) {
    return null;
  }

  return {
    manage_branches:
      normalizeBoolean(
        value.manage_branches
      ),

    impersonate_branch:
      normalizeBoolean(
        value.impersonate_branch
      ),

    manage_support_users:
      normalizeBoolean(
        value.manage_support_users
      ),

    view_logs:
      normalizeBoolean(
        value.view_logs
      ),

    system_settings:
      normalizeBoolean(
        value.system_settings
      ),

    backup_restore:
      normalizeBoolean(
        value.backup_restore
      ),

    manage_verification_results:
      normalizeBoolean(
        value.manage_verification_results
      ),
  };
}
function normalizeBranch(
  value: unknown
): Branch | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id =
    cleanTextValue(value.id);

  const branchName =
    cleanTextValue(
      value.branch_name
    );

  const branchSlug =
    cleanTextValue(
      value.branch_slug
    ).toLowerCase();

  const organizationName =
    cleanTextValue(
      value.organization_name
    );

  if (
    !isValidUuid(id) ||
    !branchName ||
    !organizationName ||
    !isValidBranchSlug(
      branchSlug
    )
  ) {
    return null;
  }

  return {
    id,
    branch_name:
      branchName,

    branch_slug:
      branchSlug,

    organization_name:
      organizationName,

    city:
      nullableTextValue(
        value.city
      ),

    commercial_record:
      nullableTextValue(
        value.commercial_record
      ),

    phone:
      nullableTextValue(
        value.phone
      ),

    is_active:
      normalizeBoolean(
        value.is_active
      ),

    is_deleted:
      normalizeBoolean(
        value.is_deleted
      ),

    notes:
      nullableTextValue(
        value.notes
      ),

    created_at:
      normalizeDateText(
        value.created_at
      ),

    deleted_at:
      nullableTextValue(
        value.deleted_at
      ),

    deleted_by_user_id:
      nullableTextValue(
        value.deleted_by_user_id
      ),

    deleted_by_user_name:
      nullableTextValue(
        value.deleted_by_user_name
      ),
  };
}

function normalizeBranches(
  value: unknown
): Branch[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      normalizeBranch
    )
    .filter(
      (
        branch
      ): branch is Branch =>
        branch !== null
    );
}

function normalizeBranchRelation(
  value: unknown
): BranchRelation | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const branchName =
    cleanTextValue(
      value.branch_name
    );

  const branchSlug =
    cleanTextValue(
      value.branch_slug
    ).toLowerCase();

  const organizationName =
    cleanTextValue(
      value.organization_name
    );

  if (
    !branchName ||
    !organizationName ||
    !isValidBranchSlug(
      branchSlug
    )
  ) {
    return null;
  }

  return {
    branch_name:
      branchName,

    branch_slug:
      branchSlug,

    organization_name:
      organizationName,
  };
}

function normalizeBranchManager(
  value: unknown
): BranchManager | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id =
    cleanTextValue(value.id);

  const branchId =
    cleanTextValue(
      value.branch_id
    );

  const fullName =
    cleanTextValue(
      value.full_name
    );

  const username =
    cleanTextValue(
      value.username
    );

  const role =
    cleanTextValue(
      value.role
    );

  if (
    !isValidUuid(id) ||
    !isValidUuid(branchId) ||
    !fullName ||
    !username ||
    !role
  ) {
    return null;
  }

  let branchRelation:
    | BranchRelation
    | BranchRelation[]
    | null = null;

  if (
    Array.isArray(
      value.finance_branches
    )
  ) {
    branchRelation =
      value.finance_branches
        .map(
          normalizeBranchRelation
        )
        .filter(
          (
            relation
          ): relation is BranchRelation =>
            relation !== null
        );
  } else {
    branchRelation =
      normalizeBranchRelation(
        value.finance_branches
      );
  }

  return {
    id,
    branch_id:
      branchId,

    full_name:
      fullName,

    username,
    role,

    is_active:
      normalizeBoolean(
        value.is_active
      ),

    created_at:
      normalizeDateText(
        value.created_at
      ),

    finance_branches:
      branchRelation,
  };
}

function normalizeBranchManagers(
  value: unknown
): BranchManager[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      normalizeBranchManager
    )
    .filter(
      (
        manager
      ): manager is BranchManager =>
        manager !== null
    );
}

function normalizeSupportUser(
  value: unknown
): SupportUser | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id =
    cleanTextValue(value.id);

  const fullName =
    cleanTextValue(
      value.full_name
    );

  const username =
    cleanTextValue(
      value.username
    );

  const role =
    cleanTextValue(
      value.role
    ).toLowerCase();

  if (
    !isValidUuid(id) ||
    !fullName ||
    !username ||
    !role
  ) {
    return null;
  }

  return {
    id,

    full_name:
      fullName,

    username,
    role,

    is_active:
      normalizeBoolean(
        value.is_active
      ),

    created_at:
      normalizeDateText(
        value.created_at
      ),

    permissions:
      Array.isArray(
        value.permissions
      )
        ? Array.from(
            new Set(
              value.permissions
                .filter(
                  (
                    permission
                  ): permission is string =>
                    typeof permission ===
                    "string"
                )
                .map(
                  (
                    permission
                  ) =>
                    permission.trim()
                )
                .filter(Boolean)
            )
          )
        : [],
  };
}

function normalizeSupportUsers(
  value: unknown
): SupportUser[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      normalizeSupportUser
    )
    .filter(
      (
        user
      ): user is SupportUser =>
        user !== null
    );
}

function normalizeSupportLog(
  value: unknown
): SupportLog | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const id =
    cleanTextValue(value.id);

  const action =
    cleanTextValue(
      value.action
    );

  if (
    !isValidUuid(id) ||
    !action
  ) {
    return null;
  }

  return {
    id,

    user_id:
      nullableTextValue(
        value.user_id
      ),

    user_name:
      nullableTextValue(
        value.user_name
      ),

    action,

    target_type:
      nullableTextValue(
        value.target_type
      ),

    target_id:
      nullableTextValue(
        value.target_id
      ),

    details:
      nullableTextValue(
        value.details
      ),

    created_at:
      normalizeDateText(
        value.created_at
      ),
  };
}

function normalizeSupportLogs(
  value: unknown
): SupportLog[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      normalizeSupportLog
    )
    .filter(
      (
        log
      ): log is SupportLog =>
        log !== null
    );
}

function normalizePaginationState(
  value: unknown,
  fallbackPageSize: number
): PaginationState {
  if (!isPlainObject(value)) {
    return {
      page: 1,
      page_size:
        fallbackPageSize,
      total: 0,
      total_pages: 0,
    };
  }

  const page =
    toFiniteNumber(
      value.page
    );

  const pageSize =
    toFiniteNumber(
      value.page_size
    );

  const total =
    toFiniteNumber(
      value.total
    );

  const totalPages =
    toFiniteNumber(
      value.total_pages
    );

  return {
    page:
      Number.isSafeInteger(page) &&
      page >= 1
        ? page
        : 1,

    page_size:
      Number.isSafeInteger(
        pageSize
      ) &&
      pageSize >= 1
        ? pageSize
        : fallbackPageSize,

    total:
      Number.isSafeInteger(total) &&
      total >= 0
        ? total
        : 0,

    total_pages:
      Number.isSafeInteger(
        totalPages
      ) &&
      totalPages >= 0
        ? totalPages
        : 0,
  };
}

function normalizeVerificationContract(
  value: RawVerificationContract
): VerificationContract | null {
  const contractId =
    cleanTextValue(
      value.contract_id
    );

  const branchId =
    cleanTextValue(
      value.branch_id
    );

  const customerId =
    cleanTextValue(
      value.customer_id
    );

  if (
    !isValidUuid(contractId) ||
    !isValidUuid(branchId) ||
    !isValidUuid(customerId)
  ) {
    return null;
  }

  const automaticPosition =
    normalizeVerificationPosition(
      value.automatic_position
    );

  const effectivePosition =
    normalizeVerificationPosition(
      value.effective_position,
      automaticPosition
    );

  return {
    contract_id:
      contractId,

    contract_number:
      value.contract_number ===
        null ||
      value.contract_number ===
        undefined
        ? null
        : cleanTextValue(
            String(
              value.contract_number
            )
          ) || null,

    branch_id:
      branchId,

    branch_name:
      cleanTextValue(
        value.branch_name,
        "فرع غير محدد"
      ) || "فرع غير محدد",

    branch_slug:
      cleanTextValue(
        value.branch_slug
      ).toLowerCase(),

    customer_id:
      customerId,

    customer_name:
      cleanTextValue(
        value.customer_name,
        "العميل"
      ) || "العميل",

    national_id:
      cleanTextValue(
        value.national_id
      ),

    customer_phone:
      cleanTextValue(
        value.customer_phone
      ),

    debt_amount:
      toFiniteNumber(
        value.debt_amount
      ),

    paid_amount:
      toFiniteNumber(
        value.paid_amount
      ),

    remaining_amount:
      toFiniteNumber(
        value.remaining_amount
      ),

    payment_due_date:
      nullableTextValue(
        value.payment_due_date
      ),

    contract_date:
      nullableTextValue(
        value.contract_date
      ),

    contract_state:
      cleanTextValue(
        value.contract_state,
        "ساري"
      ) || "ساري",

    automatic_position:
      automaticPosition,

    effective_position:
      effectivePosition,

    has_support_override:
      value.has_support_override ===
      true,

    override_position:
      normalizeOptionalVerificationPosition(
        value.override_position
      ),

    override_reason:
      nullableTextValue(
        value.override_reason
      ),

    override_notes:
      nullableTextValue(
        value.override_notes
      ),

    override_updated_at:
      nullableTextValue(
        value.override_updated_at
      ),

    default_declared_at:
      nullableTextValue(
        value.default_declared_at
      ),

    default_expires_at:
      nullableTextValue(
        value.default_expires_at
      ),

    default_reason:
      nullableTextValue(
        value.default_reason
      ),

    default_notes:
      nullableTextValue(
        value.default_notes
      ),
  };
}

function normalizeVerificationResults(
  value: unknown
): VerificationContract[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      (
        item
      ) =>
        isPlainObject(item)
          ? normalizeVerificationContract(
              item
            )
          : null
    )
    .filter(
      (
        item
      ): item is VerificationContract =>
        item !== null
    );
}

function createTimeoutSignal(
  externalSignal?: AbortSignal | null
): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller =
    new AbortController();

  const abortFromExternal =
    (): void => {
      controller.abort(
        externalSignal?.reason
      );
    };

  if (
    externalSignal?.aborted
  ) {
    abortFromExternal();
  } else {
    externalSignal?.addEventListener(
      "abort",
      abortFromExternal,
      {
        once: true,
      }
    );
  }

  const timeoutId =
    window.setTimeout(
      () => {
        controller.abort(
          new DOMException(
            "انتهت مهلة الطلب",
            "TimeoutError"
          )
        );
      },
      REQUEST_TIMEOUT_MS
    );

  return {
    signal:
      controller.signal,

    cleanup:
      (): void => {
        window.clearTimeout(
          timeoutId
        );

        externalSignal?.removeEventListener(
          "abort",
          abortFromExternal
        );
      },
  };
}

function isAbortError(
  error: unknown
): boolean {
  return (
    error instanceof DOMException &&
    (
      error.name ===
        "AbortError" ||
      error.name ===
        "TimeoutError"
    )
  );
}

function getApiErrorMessage(
  status: number,
  payloadMessage?: string
): string {
  if (payloadMessage) {
    return payloadMessage;
  }

  if (status === 400) {
    return "بيانات الطلب غير صحيحة";
  }

  if (status === 401) {
    return "انتهت جلسة الدخول";
  }

  if (status === 403) {
    return "لا تملك الصلاحية لتنفيذ هذه العملية";
  }

  if (status === 404) {
    return "البيانات المطلوبة غير موجودة";
  }

  if (status === 409) {
    return "توجد بيانات متعارضة مع العملية المطلوبة";
  }

  if (status === 413) {
    return "حجم البيانات أكبر من الحد المسموح";
  }

  if (status === 415) {
    return "نوع البيانات غير مدعوم";
  }

  if (status === 429) {
    return "تم تنفيذ عدد كبير من الطلبات، حاول بعد قليل";
  }

  if (status >= 500) {
    return "حدث خطأ في الخادم";
  }

  return `تعذر تنفيذ الطلب، رمز الاستجابة ${status}`;
}

function buildDashboardUrl(
  section: DashboardSection,
  pagination: PaginationReference
): string {
  const searchParams =
    new URLSearchParams();

  searchParams.set(
    "section",
    section
  );

  searchParams.set(
    "branches_page",
    String(
      pagination.branchesPage
    )
  );

  searchParams.set(
    "branches_page_size",
    String(
      BRANCHES_PAGE_SIZE
    )
  );

  searchParams.set(
    "deleted_branches_page",
    String(
      pagination.deletedBranchesPage
    )
  );

  searchParams.set(
    "deleted_branches_page_size",
    String(
      BRANCHES_PAGE_SIZE
    )
  );

  searchParams.set(
    "managers_page",
    String(
      pagination.managersPage
    )
  );

  searchParams.set(
    "managers_page_size",
    String(
      DASHBOARD_PAGE_SIZE
    )
  );

  searchParams.set(
    "support_users_page",
    String(
      pagination.usersPage
    )
  );

  searchParams.set(
    "support_users_page_size",
    String(
      DASHBOARD_PAGE_SIZE
    )
  );

  searchParams.set(
    "logs_page",
    String(
      pagination.logsPage
    )
  );

  searchParams.set(
    "logs_page_size",
    String(
      DASHBOARD_LOGS_PAGE_SIZE
    )
  );

  return `/api/admin-support/dashboard?${searchParams.toString()}`;
}

function getBranchRelation(
  manager: BranchManager
): BranchRelation | null {
  const relation =
    manager.finance_branches;

  if (
    Array.isArray(relation)
  ) {
    return relation[0] || null;
  }

  return relation || null;
}

function roleLabel(
  role: string
): string {
  if (
    role === "super_admin"
  ) {
    return "مدير النظام";
  }

  if (
    role === "viewer"
  ) {
    return "مشاهدة فقط";
  }

  return "دعم فني";
}

function permissionLabel(
  key: string
): string {
  return (
    SUPPORT_PERMISSIONS.find(
      (
        permission
      ) =>
        permission.key === key
    )?.label || key
  );
}

function formatDateTime(
  date: string
): string {
  if (!date) {
    return "-";
  }

  const parsedDate =
    new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return "-";
  }

  return parsedDate.toLocaleString(
    "ar-SA",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatDate(
  date: string | null
): string {
  if (!date) {
    return "-";
  }

  const parsedDate =
    new Date(date);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return date;
  }

  return parsedDate.toLocaleDateString(
    "ar-SA",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );
}

function formatMoney(
  value: number
): string {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  return `${safeValue.toLocaleString(
    "ar-SA",
    {
      maximumFractionDigits: 2,
    }
  )} ر.س`;
}

function getDisabledStyle(
  baseStyle: CSSProperties,
  disabled: boolean
): CSSProperties {
  if (!disabled) {
    return baseStyle;
  }

  return {
    ...baseStyle,
    opacity: 0.55,
    cursor: "not-allowed",
  };
}

export default function AdminSupportPage() {
  const router =
    useRouter();

  const mountedRef =
    useRef(false);

  const busyActionsRef =
    useRef<Set<BusyAction>>(
      new Set<BusyAction>()
    );

  const dashboardAbortRef =
    useRef<AbortController | null>(
      null
    );

  const verificationAbortRef =
    useRef<AbortController | null>(
      null
    );

  const paginationRef =
    useRef<PaginationReference>({
      branchesPage: 1,
      deletedBranchesPage: 1,
      managersPage: 1,
      usersPage: 1,
      logsPage: 1,
    });

  const dashboardRequestSequenceRef =
    useRef(0);

  const verificationRequestSequenceRef =
    useRef(0);

  const confirmationResolverRef =
    useRef<
      ((confirmed: boolean) => void) | null
    >(null);

  const [screen, setScreen] =
    useState<ScreenType>(
      "desktop"
    );

  const [
    currentUser,
    setCurrentUser,
  ] =
    useState<CurrentUser | null>(
      null
    );

  const [access, setAccess] =
    useState<DashboardAccess>(
      EMPTY_ACCESS
    );

  const [branches, setBranches] =
    useState<Branch[]>([]);

  const [
    deletedBranches,
    setDeletedBranches,
  ] =
    useState<Branch[]>([]);

  const [
    branchListMode,
    setBranchListMode,
  ] =
    useState<BranchListMode>(
      "active"
    );

  const [
    branchManagers,
    setBranchManagers,
  ] =
    useState<BranchManager[]>([]);

  const [
    supportUsers,
    setSupportUsers,
  ] =
    useState<SupportUser[]>([]);

  const [logs, setLogs] =
    useState<SupportLog[]>([]);

  const [
    branchesPagination,
    setBranchesPagination,
  ] =
    useState<PaginationState>(
      EMPTY_BRANCHES_PAGINATION
    );

  const [
    deletedBranchesPagination,
    setDeletedBranchesPagination,
  ] =
    useState<PaginationState>(
      EMPTY_BRANCHES_PAGINATION
    );

  const [
    managersPagination,
    setManagersPagination,
  ] =
    useState<PaginationState>(
      EMPTY_PAGINATION
    );

  const [
    usersPagination,
    setUsersPagination,
  ] =
    useState<PaginationState>(
      EMPTY_PAGINATION
    );

  const [
    logsPagination,
    setLogsPagination,
  ] =
    useState<PaginationState>(
      EMPTY_LOGS_PAGINATION
    );

  const [activeTab, setActiveTab] =
    useState<TabType>(
      "overview"
    );

  const [loading, setLoading] =
    useState(true);

  const [
    busyActions,
    setBusyActions,
  ] =
    useState<Set<BusyAction>>(
      () =>
        new Set<BusyAction>()
    );

  const [
    pageError,
    setPageError,
  ] =
    useState("");

  const [notice, setNotice] =
    useState<NoticeState>(
      null
    );

  const [
    confirmState,
    setConfirmState,
  ] =
    useState<ConfirmState>(
      null
    );

  const [
    passwordDialog,
    setPasswordDialog,
  ] =
    useState<PasswordDialogState>(
      null
    );

  const [
    archiveDialog,
    setArchiveDialog,
  ] =
    useState<ArchiveDialogState>(
      null
    );

  const [
    showBranchForm,
    setShowBranchForm,
  ] =
    useState(false);

  const [
    editingBranchId,
    setEditingBranchId,
  ] =
    useState<string | null>(
      null
    );

  const [
    branchName,
    setBranchName,
  ] =
    useState("");

  const [
    branchSlug,
    setBranchSlug,
  ] =
    useState("");

  const [
    organizationName,
    setOrganizationName,
  ] =
    useState("");

  const [
    branchCity,
    setBranchCity,
  ] =
    useState("");

  const [
    branchCommercialRecord,
    setBranchCommercialRecord,
  ] =
    useState("");

  const [
    branchPhone,
    setBranchPhone,
  ] =
    useState("");

  const [
    branchNotes,
    setBranchNotes,
  ] =
    useState("");

  const [
    managerFullName,
    setManagerFullName,
  ] =
    useState("");

  const [
    managerUsername,
    setManagerUsername,
  ] =
    useState("");

  const [
    managerPassword,
    setManagerPassword,
  ] =
    useState("");

  const [
    managerPhone,
    setManagerPhone,
  ] =
    useState("");

  const [
    showUserForm,
    setShowUserForm,
  ] =
    useState(false);

  const [
    supportFullName,
    setSupportFullName,
  ] =
    useState("");

  const [
    supportUsername,
    setSupportUsername,
  ] =
    useState("");

  const [
    supportPassword,
    setSupportPassword,
  ] =
    useState("");

  const [
    supportRole,
    setSupportRole,
  ] =
    useState<SupportRole>(
      "support"
    );

  const [
    selectedPermissions,
    setSelectedPermissions,
  ] =
    useState<
      SupportPermission[]
    >([]);

  const [
    editingPermissionsUserId,
    setEditingPermissionsUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    editingPermissions,
    setEditingPermissions,
  ] =
    useState<
      SupportPermission[]
    >([]);

  const [
    verificationSearchValue,
    setVerificationSearchValue,
  ] =
    useState("");

  const [
    verificationResults,
    setVerificationResults,
  ] =
    useState<
      VerificationContract[]
    >([]);

  const [
    verificationSearchPerformed,
    setVerificationSearchPerformed,
  ] =
    useState(false);

  const [
    editingVerificationContractId,
    setEditingVerificationContractId,
  ] =
    useState<string | null>(
      null
    );

  const [
    verificationPosition,
    setVerificationPosition,
  ] =
    useState<VerificationPosition>(
      "نشط"
    );

  const [
    verificationReason,
    setVerificationReason,
  ] =
    useState("");

  const [
    verificationNotes,
    setVerificationNotes,
  ] =
    useState("");
    const isMobile =
    screen === "mobile";

  const isTablet =
    screen === "tablet";

  const isCompact =
    isMobile || isTablet;

  const beginAction =
    useCallback(
      (
        action: BusyAction
      ): boolean => {
        if (
          busyActionsRef.current.has(
            action
          )
        ) {
          return false;
        }

        busyActionsRef.current.add(
          action
        );

        if (mountedRef.current) {
          setBusyActions(
            new Set(
              busyActionsRef.current
            )
          );
        }

        return true;
      },
      []
    );

  const endAction =
    useCallback(
      (
        action: BusyAction
      ): void => {
        busyActionsRef.current.delete(
          action
        );

        if (mountedRef.current) {
          setBusyActions(
            new Set(
              busyActionsRef.current
            )
          );
        }
      },
      []
    );

  const isBusy =
    useCallback(
      (
        action: BusyAction
      ): boolean =>
        busyActions.has(action),
      [busyActions]
    );

  const showNotice =
    useCallback(
      (
        message?: string,
        type: NoticeType = "info"
      ): void => {
        const cleanMessage =
          cleanTextValue(message);

        if (
          !cleanMessage ||
          !mountedRef.current
        ) {
          return;
        }

        setNotice({
          message:
            cleanMessage,

          type,
        });
      },
      []
    );

  const closeNotice =
    useCallback((): void => {
      if (
        mountedRef.current
      ) {
        setNotice(null);
      }
    }, []);

  const requestConfirmation =
    useCallback(
      (
        message: string,
        options?: {
          title?: string;
          confirmLabel?: string;
          danger?: boolean;
        }
      ): Promise<boolean> => {
        if (
          confirmationResolverRef.current
        ) {
          confirmationResolverRef.current(
            false
          );
        }

        return new Promise<boolean>(
          (resolve) => {
            confirmationResolverRef.current =
              resolve;

            setConfirmState({
              title:
                cleanTextValue(
                  options?.title
                ) ||
                "تأكيد العملية",

              message:
                cleanTextValue(
                  message
                ),

              confirmLabel:
                cleanTextValue(
                  options?.confirmLabel
                ) ||
                "تأكيد",

              danger:
                options?.danger ===
                true,
            });
          }
        );
      },
      []
    );

  const resolveConfirmation =
    useCallback(
      (
        confirmed: boolean
      ): void => {
        const resolver =
          confirmationResolverRef.current;

        confirmationResolverRef.current =
          null;

        if (
          mountedRef.current
        ) {
          setConfirmState(null);
        }

        resolver?.(confirmed);
      },
      []
    );

  const resetVerificationEditor =
    useCallback((): void => {
      setEditingVerificationContractId(
        null
      );

      setVerificationPosition(
        "نشط"
      );

      setVerificationReason("");
      setVerificationNotes("");
    }, []);

  const clearVerificationWorkspace =
    useCallback((): void => {
      verificationAbortRef.current?.abort();

      verificationAbortRef.current =
        null;

      verificationRequestSequenceRef.current +=
        1;

      if (
        !mountedRef.current
      ) {
        return;
      }

      setVerificationSearchValue(
        ""
      );

      setVerificationResults(
        []
      );

      setVerificationSearchPerformed(
        false
      );

      resetVerificationEditor();

      busyActionsRef.current.delete(
        "verification_search"
      );

      busyActionsRef.current.delete(
        "verification_refresh"
      );

      setBusyActions(
        new Set(
          busyActionsRef.current
        )
      );
    }, [
      resetVerificationEditor,
    ]);

  const redirectToLogin =
    useCallback((): void => {
      dashboardAbortRef.current?.abort();

      verificationAbortRef.current?.abort();

      router.replace(
        "/admin-support/login"
      );
    }, [router]);

  const executeRequest =
    useCallback(
      async <T,>(
        url: string,
        options?: RequestInit
      ): Promise<
        RequestResult<T>
      > => {
        const timeoutRequest =
          createTimeoutSignal(
            options?.signal
          );

        try {
          const headers =
            new Headers(
              options?.headers
            );

          headers.set(
            "Accept",
            "application/json"
          );

          const method =
            (
              options?.method ||
              "GET"
            ).toUpperCase();

          if (
            method !== "GET" &&
            method !== "HEAD" &&
            options?.body !==
              undefined &&
            !headers.has(
              "Content-Type"
            )
          ) {
            headers.set(
              "Content-Type",
              "application/json"
            );
          }

          const response =
            await fetch(
              url,
              {
                ...options,

                method,

                credentials:
                  "include",

                cache:
                  "no-store",

                headers,

                signal:
                  timeoutRequest.signal,
              }
            );

          let payload:
            ApiResponse<T>;

          try {
            const rawPayload =
              (await response.json()) as unknown;

            payload =
              isPlainObject(
                rawPayload
              ) &&
              typeof rawPayload.ok ===
                "boolean"
                ? (
                    rawPayload as ApiResponse<T>
                  )
                : {
                    ok: false,
                    message:
                      "استجابة الخادم غير صالحة",
                  };
          } catch {
            payload = {
              ok: false,
              message:
                "تعذر قراءة استجابة الخادم",
            };
          }

          if (
            response.status === 401
          ) {
            redirectToLogin();

            return {
              ok: false,

              status:
                response.status,

              message:
                getApiErrorMessage(
                  response.status,
                  payload.message
                ),

              aborted: false,
              unauthorized: true,
              forbidden: false,
              rateLimited: false,
            };
          }

          if (
            !response.ok ||
            !payload.ok
          ) {
            return {
              ok: false,

              status:
                response.status,

              message:
                getApiErrorMessage(
                  response.status,
                  payload.message
                ),

              aborted: false,
              unauthorized: false,

              forbidden:
                response.status ===
                403,

              rateLimited:
                response.status ===
                429,
            };
          }

          return {
            ok: true,

            status:
              response.status,

            payload,
          };
        } catch (error) {
          if (
            isAbortError(error) ||
            timeoutRequest.signal
              .aborted
          ) {
            const timeoutReason =
              timeoutRequest.signal
                .reason;

            const timedOut =
              timeoutReason instanceof
                DOMException &&
              timeoutReason.name ===
                "TimeoutError";

            return {
              ok: false,
              status: 0,

              message:
                timedOut
                  ? "انتهت مهلة الاتصال بالخادم"
                  : "تم إلغاء الطلب",

              aborted: true,
              unauthorized: false,
              forbidden: false,
              rateLimited: false,
            };
          }

          console.error(
            "Admin support request failed:",
            error instanceof Error
              ? {
                  name:
                    error.name,

                  message:
                    error.message,
                }
              : {
                  name:
                    "UnknownError",
                }
          );

          return {
            ok: false,
            status: 0,

            message:
              "تعذر الاتصال بالخادم، تحقق من اتصال الإنترنت",

            aborted: false,
            unauthorized: false,
            forbidden: false,
            rateLimited: false,
          };
        } finally {
          timeoutRequest.cleanup();
        }
      },
      [redirectToLogin]
    );

  const applyDashboardPayload =
    useCallback(
      (
        payload: DashboardResponse,
        section: DashboardSection
      ): boolean => {
        const normalizedUser =
          normalizeCurrentUser(
            payload.user
          );

        const normalizedAccess =
          normalizeDashboardAccess(
            payload.access
          );

        if (
          !normalizedUser ||
          !normalizedAccess
        ) {
          return false;
        }

        setCurrentUser(
          normalizedUser
        );

        setAccess(
          normalizedAccess
        );

        const pagination =
          isPlainObject(
            payload.pagination
          )
            ? payload.pagination
            : {};

        if (
          section === "all" ||
          section === "branches"
        ) {
          setBranches(
            normalizeBranches(
              payload.branches
            )
          );

          const nextBranchesPagination =
            normalizePaginationState(
              pagination.branches,
              DASHBOARD_PAGE_SIZE
            );

          setBranchesPagination(
            nextBranchesPagination
          );

          paginationRef.current.branchesPage =
            nextBranchesPagination.page;

          if (
            normalizedAccess.manage_branches
          ) {
            setDeletedBranches(
              normalizeBranches(
                payload.deleted_branches
              )
            );

            const nextDeletedBranchesPagination =
              normalizePaginationState(
                pagination.deleted_branches,
                BRANCHES_PAGE_SIZE
              );

            setDeletedBranchesPagination(
              nextDeletedBranchesPagination
            );

            paginationRef.current.deletedBranchesPage =
              nextDeletedBranchesPagination.page;

            setBranchManagers(
              normalizeBranchManagers(
                payload.branch_managers
              )
            );

            const nextManagersPagination =
              normalizePaginationState(
                pagination.branch_managers,
                DASHBOARD_PAGE_SIZE
              );

            setManagersPagination(
              nextManagersPagination
            );

            paginationRef.current.managersPage =
              nextManagersPagination.page;
          } else {
            setDeletedBranches(
              []
            );

            setDeletedBranchesPagination(
              EMPTY_BRANCHES_PAGINATION
            );

            paginationRef.current.deletedBranchesPage =
              1;

            setBranchManagers(
              []
            );

            setManagersPagination(
              EMPTY_PAGINATION
            );

            paginationRef.current.managersPage =
              1;
          }
        }

        if (
          section === "all" ||
          section ===
            "support_users"
        ) {
          setSupportUsers(
            normalizeSupportUsers(
              payload.support_users
            )
          );

          const nextUsersPagination =
            normalizePaginationState(
              pagination.support_users,
              DASHBOARD_PAGE_SIZE
            );

          setUsersPagination(
            nextUsersPagination
          );

          paginationRef.current.usersPage =
            nextUsersPagination.page;
        }

        if (
          section === "all" ||
          section === "logs"
        ) {
          setLogs(
            normalizeSupportLogs(
              payload.logs
            )
          );

          const nextLogsPagination =
            normalizePaginationState(
              pagination.logs,
              DASHBOARD_LOGS_PAGE_SIZE
            );

          setLogsPagination(
            nextLogsPagination
          );

          paginationRef.current.logsPage =
            nextLogsPagination.page;
        }

        return true;
      },
      []
    );

  const loadDashboard =
    useCallback(
      async (
        options?: {
          fullLoader?: boolean;
          section?: DashboardSection;
          branchesPage?: number;
          deletedBranchesPage?: number;
          managersPage?: number;
          usersPage?: number;
          logsPage?: number;
        }
      ): Promise<void> => {
        const section =
          options?.section ||
          "all";

        const action:
          BusyAction =
          section === "all"
            ? "dashboard"
            : `dashboard_section:${section}`;

        if (
          !beginAction(action)
        ) {
          return;
        }

        dashboardAbortRef.current?.abort();

        const controller =
          new AbortController();

        dashboardAbortRef.current =
          controller;

        const requestSequence =
          dashboardRequestSequenceRef.current +
          1;

        dashboardRequestSequenceRef.current =
          requestSequence;

        if (
          options?.fullLoader &&
          mountedRef.current
        ) {
          setLoading(true);
        }

        if (
          mountedRef.current
        ) {
          setPageError("");
        }

        try {
          const requestedPagination:
            PaginationReference = {
            branchesPage:
              options?.branchesPage ??
              paginationRef.current
                .branchesPage,

            deletedBranchesPage:
              options?.deletedBranchesPage ??
              paginationRef.current
                .deletedBranchesPage,

            managersPage:
              options?.managersPage ??
              paginationRef.current
                .managersPage,

            usersPage:
              options?.usersPage ??
              paginationRef.current
                .usersPage,

            logsPage:
              options?.logsPage ??
              paginationRef.current
                .logsPage,
          };

          const url =
            buildDashboardUrl(
              section,
              requestedPagination
            );

          const result =
            await executeRequest<unknown>(
              url,
              {
                method: "GET",

                signal:
                  controller.signal,
              }
            );

          if (
            controller.signal.aborted ||
            requestSequence !==
              dashboardRequestSequenceRef.current ||
            !mountedRef.current
          ) {
            return;
          }

          if (!result.ok) {
            if (
              !result.aborted &&
              !result.unauthorized
            ) {
              setPageError(
                result.message
              );
            }

            return;
          }

          const payload =
            result.payload as DashboardResponse;

          if (
            !applyDashboardPayload(
              payload,
              section
            )
          ) {
            setPageError(
              "بيانات لوحة الدعم غير مكتملة أو غير صالحة"
            );

            return;
          }
        } finally {
          if (
            dashboardAbortRef.current ===
            controller
          ) {
            dashboardAbortRef.current =
              null;
          }

          endAction(action);

          if (
            options?.fullLoader &&
            mountedRef.current
          ) {
            setLoading(false);
          }
        }
      },
      [
        applyDashboardPayload,
        beginAction,
        endAction,
        executeRequest,
      ]
    );

  useEffect(() => {
    mountedRef.current =
      true;

    function updateScreen(): void {
      const width =
        window.innerWidth;

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

    window.addEventListener(
      "resize",
      updateScreen,
      {
        passive: true,
      }
    );

    return () => {
      mountedRef.current =
        false;

      window.removeEventListener(
        "resize",
        updateScreen
      );

      dashboardAbortRef.current?.abort();

      verificationAbortRef.current?.abort();

      confirmationResolverRef.current?.(
        false
      );

      confirmationResolverRef.current =
        null;
    };
  }, []);

  useEffect(() => {
    paginationRef.current = {
      branchesPage:
        branchesPagination.page,

      deletedBranchesPage:
        deletedBranchesPagination.page,

      managersPage:
        managersPagination.page,

      usersPage:
        usersPagination.page,

      logsPage:
        logsPagination.page,
    };
  }, [
    branchesPagination.page,
    deletedBranchesPagination.page,
    managersPagination.page,
    usersPagination.page,
    logsPagination.page,
  ]);

  useEffect(() => {
    void loadDashboard({
      fullLoader: true,
      section: "all",
      branchesPage: 1,
      deletedBranchesPage: 1,
      managersPage: 1,
      usersPage: 1,
      logsPage: 1,
    });
  }, [loadDashboard]);

  useEffect(() => {
    if (
      activeTab !==
      "verifications"
    ) {
      clearVerificationWorkspace();
    }
  }, [
    activeTab,
    clearVerificationWorkspace,
  ]);

  useEffect(() => {
    const tabAllowed =
      activeTab ===
        "overview" ||
      (
        activeTab ===
          "branches" &&
        (
          access.manage_branches ||
          access.impersonate_branch
        )
      ) ||
      (
        activeTab ===
          "branch_managers" &&
        access.manage_branches
      ) ||
      (
        activeTab ===
          "users" &&
        access.manage_support_users
      ) ||
      (
        activeTab ===
          "verifications" &&
        access.manage_verification_results
      ) ||
      (
        activeTab ===
          "logs" &&
        access.view_logs
      );

    if (
      !tabAllowed
    ) {
      setActiveTab(
        "overview"
      );
    }
  }, [
    access,
    activeTab,
  ]);

  const resetBranchForm =
    useCallback((): void => {
      setEditingBranchId(
        null
      );

      setBranchName("");
      setBranchSlug("");
      setOrganizationName("");
      setBranchCity("");

      setBranchCommercialRecord(
        ""
      );

      setBranchPhone("");
      setBranchNotes("");
      setManagerFullName("");
      setManagerUsername("");
      setManagerPassword("");
      setManagerPhone("");

      setShowBranchForm(
        false
      );
    }, []);

  const resetUserForm =
    useCallback((): void => {
      setSupportFullName("");
      setSupportUsername("");
      setSupportPassword("");

      setSupportRole(
        "support"
      );

      setSelectedPermissions(
        []
      );

      setShowUserForm(
        false
      );
    }, []);

  const closePermissionsEditor =
    useCallback((): void => {
      setEditingPermissionsUserId(
        null
      );

      setEditingPermissions(
        []
      );
    }, []);

  function openNewBranchForm(): void {
    if (
      !access.manage_branches
    ) {
      showNotice(
        "لا تملك صلاحية إدارة الفروع",
        "error"
      );
      return;
    }

    resetUserForm();
    closePermissionsEditor();
    resetBranchForm();

    setShowBranchForm(
      true
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function editBranch(
    branch: Branch
  ): void {
    if (
      !access.manage_branches
    ) {
      showNotice(
        "لا تملك صلاحية إدارة الفروع",
        "error"
      );
      return;
    }

    resetUserForm();
    closePermissionsEditor();

    setEditingBranchId(
      branch.id
    );

    setBranchName(
      branch.branch_name
    );

    setBranchSlug(
      branch.branch_slug
    );

    setOrganizationName(
      branch.organization_name
    );

    setBranchCity(
      branch.city || ""
    );

    setBranchCommercialRecord(
      branch.commercial_record ||
        ""
    );

    setBranchPhone(
      branch.phone || ""
    );

    setBranchNotes(
      branch.notes || ""
    );

    setManagerFullName("");
    setManagerUsername("");
    setManagerPassword("");
    setManagerPhone("");

    setShowBranchForm(
      true
    );

    setActiveTab(
      "branches"
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openNewUserForm(): void {
    if (
      !access.manage_support_users
    ) {
      showNotice(
        "لا تملك صلاحية إدارة مستخدمي الدعم",
        "error"
      );
      return;
    }

    resetBranchForm();
    closePermissionsEditor();
    resetUserForm();

    setShowUserForm(
      true
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openPermissionsEditor(
    user: SupportUser
  ): void {
    if (
      !access.manage_support_users
    ) {
      showNotice(
        "لا تملك صلاحية إدارة مستخدمي الدعم",
        "error"
      );
      return;
    }

    if (
      user.role ===
      "super_admin"
    ) {
      showNotice(
        "مدير النظام يملك جميع الصلاحيات تلقائيًا",
        "info"
      );
      return;
    }

    if (
      user.id ===
      currentUser?.id
    ) {
      showNotice(
        "لا يمكنك تعديل صلاحيات حسابك الحالي",
        "error"
      );
      return;
    }

    resetUserForm();

    setEditingPermissionsUserId(
      user.id
    );

    setEditingPermissions(
      normalizeSupportPermissions(
        user.permissions
      )
    );
  }

  function openPasswordDialog(
    manager: BranchManager
  ): void {
    if (
      !access.manage_branches
    ) {
      showNotice(
        "لا تملك صلاحية إدارة الفروع",
        "error"
      );
      return;
    }

    setPasswordDialog({
      manager,
      value: "",
    });
  }

  function closePasswordDialog(): void {
    setPasswordDialog(
      null
    );
  }

  function openVerificationEditor(
    contract: VerificationContract
  ): void {
    setEditingVerificationContractId(
      contract.contract_id
    );

    setVerificationPosition(
      contract.override_position ||
        contract.effective_position
    );

    setVerificationReason(
      contract.override_reason ||
        ""
    );

    setVerificationNotes(
      contract.override_notes ||
        ""
    );

    window.setTimeout(
      () => {
        document
          .getElementById(
            `verification-editor-${contract.contract_id}`
          )
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "center",
          });
      },
      50
    );
  }
  async function saveBranch(): Promise<void> {
    if (!access.manage_branches) {
      showNotice(
        "لا تملك صلاحية إدارة الفروع",
        "error"
      );
      return;
    }

    if (!beginAction("save_branch")) {
      return;
    }

    try {
      const cleanBranchName =
        branchName.trim();

      const cleanSlug =
        branchSlug
          .trim()
          .toLowerCase();

      const cleanOrganizationName =
        organizationName.trim();

      const cleanManagerFullName =
        managerFullName.trim();

      const cleanManagerUsername =
        normalizeDigits(
          managerUsername
        )
          .trim()
          .toLowerCase();

      const cleanManagerPassword =
        cleanNumericValue(
          managerPassword,
          8
        );

      const cleanManagerPhone =
        normalizePhoneValue(
          managerPhone,
          10
        );

      if (
        cleanBranchName.length < 2 ||
        cleanBranchName.length > 100
      ) {
        showNotice(
          "اسم الفرع يجب أن يكون من حرفين إلى 100 حرف",
          "error"
        );
        return;
      }

      if (
        !isValidBranchSlug(
          cleanSlug
        )
      ) {
        showNotice(
          "رابط الفرع غير صحيح، ويقبل الحروف الإنجليزية الصغيرة والأرقام و _ أو - فقط",
          "error"
        );
        return;
      }

      if (
        cleanOrganizationName.length < 2 ||
        cleanOrganizationName.length > 150
      ) {
        showNotice(
          "اسم المنظمة يجب أن يكون من حرفين إلى 150 حرف",
          "error"
        );
        return;
      }

      if (
        branchCity.trim().length > 100
      ) {
        showNotice(
          "اسم المدينة طويل جدًا",
          "error"
        );
        return;
      }

      if (
        branchCommercialRecord.trim().length > 30
      ) {
        showNotice(
          "رقم السجل التجاري طويل جدًا",
          "error"
        );
        return;
      }

      if (
        branchPhone.trim().length > 20
      ) {
        showNotice(
          "رقم الجوال طويل جدًا",
          "error"
        );
        return;
      }

      if (
        branchNotes.trim().length > 1000
      ) {
        showNotice(
          "الملاحظات طويلة جدًا",
          "error"
        );
        return;
      }

      if (!editingBranchId) {
        if (
          cleanManagerFullName.length < 2 ||
          cleanManagerFullName.length > 100
        ) {
          showNotice(
            "اسم مدير الفرع يجب أن يكون من حرفين إلى 100 حرف",
            "error"
          );
          return;
        }

        if (
          !isValidUsername(
            cleanManagerUsername
          )
        ) {
          showNotice(
            "اسم مستخدم مدير الفرع يجب أن يكون من 3 إلى 30 خانة، ويقبل الحروف الإنجليزية والأرقام و _ فقط",
            "error"
          );
          return;
        }

        if (
          !isValidPin(
            cleanManagerPassword
          )
        ) {
          showNotice(
            "كلمة مرور مدير الفرع يجب أن تكون من 4 إلى 8 أرقام",
            "error"
          );
          return;
        }

        if (!cleanManagerPhone) {
          showNotice(
            "رقم جوال مدير الفرع مطلوب",
            "error"
          );
          return;
        }

        if (
          !/^05\d{8}$/.test(
            cleanManagerPhone
          )
        ) {
          showNotice(
            "رقم جوال مدير الفرع يجب أن يبدأ بـ 05 ويتكون من 10 أرقام",
            "error"
          );
          return;
        }
      }

      const requestBody = {
        branch_name:
          cleanBranchName,

        branch_slug:
          cleanSlug,

        organization_name:
          cleanOrganizationName,

        city:
          branchCity.trim(),

        commercial_record:
          cleanNumericValue(
            branchCommercialRecord,
            30
          ),

        phone:
          normalizePhoneValue(
            branchPhone,
            20
          ),

        notes:
          branchNotes.trim(),
      };

      const result =
        editingBranchId
          ? await executeRequest(
              `/api/admin-support/branches/${editingBranchId}`,
              {
                method: "PATCH",

                body: JSON.stringify({
                  ...requestBody,

                  is_active:
                    branches.find(
                      (branch) =>
                        branch.id ===
                        editingBranchId
                    )?.is_active ?? true,
                }),
              }
            )
          : await executeRequest(
              "/api/admin-support/branches",
              {
                method: "POST",

                body: JSON.stringify({
                  ...requestBody,

                  manager_full_name:
                    cleanManagerFullName,

                  manager_username:
                    cleanManagerUsername,

                  manager_password:
                    cleanManagerPassword,

                  manager_phone:
                    cleanManagerPhone,
                }),
              }
            );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      const wasEditing =
        Boolean(
          editingBranchId
        );

      resetBranchForm();

      showNotice(
        result.payload.message ||
          (
            wasEditing
              ? "تم تحديث الفرع بنجاح"
              : "تم إنشاء الفرع بنجاح"
          ),
        "success"
      );

      await loadDashboard({
        section: "branches",

        branchesPage:
          wasEditing
            ? paginationRef.current
                .branchesPage
            : 1,

        deletedBranchesPage:
          paginationRef.current
            .deletedBranchesPage,

        managersPage:
          paginationRef.current
            .managersPage,
      });
    } finally {
      endAction(
        "save_branch"
      );
    }
  }

  async function toggleBranch(
    branch: Branch
  ): Promise<void> {
    if (!access.manage_branches) {
      showNotice(
        "لا تملك صلاحية إدارة الفروع",
        "error"
      );
      return;
    }

    const action:
      BusyAction =
      `branch_status:${branch.id}`;

    if (!beginAction(action)) {
      return;
    }

    try {
      const nextStatus =
        !branch.is_active;

      const confirmed =
        await requestConfirmation(
          nextStatus
            ? `هل تريد تفعيل فرع ${branch.branch_name}؟`
            : `هل تريد تعطيل فرع ${branch.branch_name}؟`,
          {
            title:
              nextStatus
                ? "تفعيل الفرع"
                : "تعطيل الفرع",

            confirmLabel:
              nextStatus
                ? "تفعيل"
                : "تعطيل",

            danger:
              !nextStatus,
          }
        );

      if (!confirmed) {
        return;
      }

      const result =
        await executeRequest(
          `/api/admin-support/branches/${branch.id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              branch_name:
                branch.branch_name,

              branch_slug:
                branch.branch_slug,

              organization_name:
                branch.organization_name,

              city:
                branch.city || "",

              commercial_record:
                branch.commercial_record ||
                "",

              phone:
                branch.phone || "",

              notes:
                branch.notes || "",

              is_active:
                nextStatus,
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      showNotice(
        result.payload.message ||
          (
            nextStatus
              ? "تم تفعيل الفرع"
              : "تم تعطيل الفرع"
          ),
        "success"
      );

      await loadDashboard({
        section: "branches",

        branchesPage:
          paginationRef.current
            .branchesPage,

        deletedBranchesPage:
          paginationRef.current
            .deletedBranchesPage,

        managersPage:
          paginationRef.current
            .managersPage,
      });
    } finally {
      endAction(action);
    }
  }

  function openArchiveDialog(
    branch: Branch
  ): void {
    if (!access.manage_branches) {
      showNotice(
        "لا تملك صلاحية إدارة الفروع",
        "error"
      );
      return;
    }

    setArchiveDialog({
      branch,
      value: "",
    });
  }

  function closeArchiveDialog(): void {
    setArchiveDialog(
      null
    );
  }

  async function archiveBranch(): Promise<void> {
    if (!archiveDialog) {
      return;
    }

    const branch =
      archiveDialog.branch;

    const action:
      BusyAction =
      `branch_archive:${branch.id}`;

    if (!beginAction(action)) {
      return;
    }

    try {
      const confirmationName =
        archiveDialog.value.trim();

      if (
        confirmationName !==
        branch.branch_name
      ) {
        showNotice(
          "اكتب اسم الفرع مطابقًا لتأكيد نقله إلى المحذوفة",
          "error"
        );
        return;
      }

      const result =
        await executeRequest(
          `/api/admin-support/branches/${branch.id}`,
          {
            method: "DELETE",

            body: JSON.stringify({
              confirm_branch_name:
                confirmationName,
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      closeArchiveDialog();

      showNotice(
        result.payload.message ||
          "تم نقل الفرع إلى قائمة المحذوفة",
        "success"
      );

      setBranchListMode(
        "active"
      );

      await loadDashboard({
        section: "branches",
        branchesPage: 1,
        deletedBranchesPage: 1,
        managersPage: 1,
      });
    } finally {
      endAction(action);
    }
  }

  async function restoreBranch(
    branch: Branch
  ): Promise<void> {
    if (!access.manage_branches) {
      showNotice(
        "لا تملك صلاحية إدارة الفروع",
        "error"
      );
      return;
    }

    const action:
      BusyAction =
      `branch_restore:${branch.id}`;

    if (!beginAction(action)) {
      return;
    }

    try {
      const confirmed =
        await requestConfirmation(
          `هل تريد استعادة فرع ${branch.branch_name}؟ سيعود معطلًا حتى تقوم بتفعيله.`,
          {
            title:
              "استعادة الفرع",

            confirmLabel:
              "استعادة",
          }
        );

      if (!confirmed) {
        return;
      }

      const result =
        await executeRequest(
          `/api/admin-support/branches/${branch.id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              action:
                "restore",
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      showNotice(
        result.payload.message ||
          "تمت استعادة الفرع بنجاح",
        "success"
      );

      await loadDashboard({
        section: "branches",
        branchesPage: 1,
        deletedBranchesPage: 1,
        managersPage: 1,
      });
    } finally {
      endAction(action);
    }
  }

  async function toggleBranchManager(
    manager: BranchManager
  ): Promise<void> {
    if (!access.manage_branches) {
      showNotice(
        "لا تملك صلاحية إدارة الفروع",
        "error"
      );
      return;
    }

    const action:
      BusyAction =
      `manager_status:${manager.id}`;

    if (!beginAction(action)) {
      return;
    }

    try {
      const nextStatus =
        !manager.is_active;

      const confirmed =
        await requestConfirmation(
          nextStatus
            ? `هل تريد تفعيل المدير ${manager.full_name}؟`
            : `هل تريد تعطيل المدير ${manager.full_name}؟`,
          {
            title:
              nextStatus
                ? "تفعيل مدير الفرع"
                : "تعطيل مدير الفرع",

            confirmLabel:
              nextStatus
                ? "تفعيل"
                : "تعطيل",

            danger:
              !nextStatus,
          }
        );

      if (!confirmed) {
        return;
      }

      const result =
        await executeRequest(
          `/api/admin-support/branch-managers/${manager.id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              action:
                "set_active",

              is_active:
                nextStatus,
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      showNotice(
        result.payload.message ||
          (
            nextStatus
              ? "تم تفعيل مدير الفرع"
              : "تم تعطيل مدير الفرع"
          ),
        "success"
      );

      await loadDashboard({
        section: "branches",

        branchesPage:
          paginationRef.current
            .branchesPage,

        deletedBranchesPage:
          paginationRef.current
            .deletedBranchesPage,

        managersPage:
          paginationRef.current
            .managersPage,
      });
    } finally {
      endAction(action);
    }
  }

  async function submitBranchManagerPassword(): Promise<void> {
    if (!passwordDialog) {
      return;
    }

    const manager =
      passwordDialog.manager;

    const action:
      BusyAction =
      `manager_password:${manager.id}`;

    if (!beginAction(action)) {
      return;
    }

    try {
      const cleanPassword =
        cleanNumericValue(
          passwordDialog.value,
          8
        );

      if (
        !isValidPin(
          cleanPassword
        )
      ) {
        showNotice(
          "كلمة المرور يجب أن تكون من 4 إلى 8 أرقام",
          "error"
        );
        return;
      }

      const result =
        await executeRequest(
          `/api/admin-support/branch-managers/${manager.id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              action:
                "reset_password",

              new_password:
                cleanPassword,
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      closePasswordDialog();

      showNotice(
        result.payload.message ||
          "تم تحديث كلمة المرور بنجاح",
        "success"
      );

      await loadDashboard({
        section: "branches",

        branchesPage:
          paginationRef.current
            .branchesPage,

        deletedBranchesPage:
          paginationRef.current
            .deletedBranchesPage,

        managersPage:
          paginationRef.current
            .managersPage,
      });
    } finally {
      endAction(action);
    }
  }

  async function enterBranch(
    branch: Branch
  ): Promise<void> {
    if (
      !access.impersonate_branch
    ) {
      showNotice(
        "لا تملك صلاحية الدخول للفروع",
        "error"
      );
      return;
    }

    if (!branch.is_active) {
      showNotice(
        "لا يمكن الدخول إلى فرع معطل",
        "error"
      );
      return;
    }

    const action:
      BusyAction =
      `branch_enter:${branch.id}`;

    if (!beginAction(action)) {
      return;
    }

    try {
      const result =
        await executeRequest(
          "/api/admin-support/impersonate",
          {
            method: "POST",

            body: JSON.stringify({
              branch_id:
                branch.id,
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      const redirectUrl =
        cleanTextValue(
          result.payload.redirect_url
        );

      if (
        !redirectUrl ||
        !redirectUrl.startsWith(
          "/finance/"
        )
      ) {
        showNotice(
          "رابط الدخول إلى الفرع غير صالح",
          "error"
        );
        return;
      }

      router.push(
        redirectUrl
      );
    } finally {
      endAction(action);
    }
  }

  async function createSupportUser(): Promise<void> {
    if (
      !access.manage_support_users
    ) {
      showNotice(
        "لا تملك صلاحية إدارة مستخدمي الدعم",
        "error"
      );
      return;
    }

    if (
      !beginAction(
        "create_support_user"
      )
    ) {
      return;
    }

    try {
      const cleanFullName =
        supportFullName.trim();

      const cleanUsername =
        supportUsername.trim();

      if (
        cleanFullName.length < 2 ||
        cleanFullName.length > 100
      ) {
        showNotice(
          "الاسم يجب أن يكون من حرفين إلى 100 حرف",
          "error"
        );
        return;
      }

      if (
        !isValidUsername(
          cleanUsername
        )
      ) {
        showNotice(
          "اسم المستخدم يجب أن يكون من 3 إلى 30 حرفًا، ويقبل العربي أو الإنجليزي أو الأرقام أو _ فقط",
          "error"
        );
        return;
      }

      if (
        !isValidSupportPassword(
          supportPassword
        )
      ) {
        showNotice(
          "كلمة المرور يجب أن تكون من 4 إلى 100 حرف",
          "error"
        );
        return;
      }

      if (
        !isSupportRole(
          supportRole
        )
      ) {
        showNotice(
          "دور المستخدم غير صحيح",
          "error"
        );
        return;
      }

      if (
        supportRole ===
          "super_admin" &&
        currentUser?.role !==
          "super_admin"
      ) {
        showNotice(
          "إنشاء مدير نظام متاح لمدير النظام فقط",
          "error"
        );
        return;
      }

      const normalizedPermissions =
        supportRole ===
        "super_admin"
          ? []
          : normalizeSupportPermissions(
              selectedPermissions
            );

      const result =
        await executeRequest(
          "/api/admin-support/support-users",
          {
            method: "POST",

            body: JSON.stringify({
              full_name:
                cleanFullName,

              username:
                cleanUsername,

              password:
                supportPassword,

              role:
                supportRole,

              permissions:
                normalizedPermissions,
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      resetUserForm();

      showNotice(
        result.payload.message ||
          "تم إنشاء مستخدم الدعم بنجاح",
        "success"
      );

      await loadDashboard({
        section:
          "support_users",

        usersPage: 1,
      });
    } finally {
      endAction(
        "create_support_user"
      );
    }
  }

  async function toggleSupportUser(
    user: SupportUser
  ): Promise<void> {
    if (
      !access.manage_support_users
    ) {
      showNotice(
        "لا تملك صلاحية إدارة مستخدمي الدعم",
        "error"
      );
      return;
    }

    if (
      user.id ===
      currentUser?.id
    ) {
      showNotice(
        "لا يمكنك تعطيل حسابك الحالي",
        "error"
      );
      return;
    }

    const action:
      BusyAction =
      `support_status:${user.id}`;

    if (!beginAction(action)) {
      return;
    }

    try {
      const nextStatus =
        !user.is_active;

      const confirmed =
        await requestConfirmation(
          nextStatus
            ? `هل تريد تفعيل المستخدم ${user.full_name}؟`
            : `هل تريد تعطيل المستخدم ${user.full_name}؟`,
          {
            title:
              nextStatus
                ? "تفعيل مستخدم الدعم"
                : "تعطيل مستخدم الدعم",

            confirmLabel:
              nextStatus
                ? "تفعيل"
                : "تعطيل",

            danger:
              !nextStatus,
          }
        );

      if (!confirmed) {
        return;
      }

      const result =
        await executeRequest(
          `/api/admin-support/support-users/${user.id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              action:
                "set_active",

              is_active:
                nextStatus,
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      showNotice(
        result.payload.message ||
          (
            nextStatus
              ? "تم تفعيل المستخدم"
              : "تم تعطيل المستخدم"
          ),
        "success"
      );

      await loadDashboard({
        section:
          "support_users",

        usersPage:
          paginationRef.current
            .usersPage,
      });
    } finally {
      endAction(action);
    }
  }

  async function saveSupportUserPermissions(
    user: SupportUser
  ): Promise<void> {
    if (
      !access.manage_support_users
    ) {
      showNotice(
        "لا تملك صلاحية إدارة مستخدمي الدعم",
        "error"
      );
      return;
    }

    if (
      user.role ===
      "super_admin"
    ) {
      showNotice(
        "مدير النظام يملك جميع الصلاحيات تلقائيًا",
        "info"
      );
      return;
    }

    if (
      user.id ===
      currentUser?.id
    ) {
      showNotice(
        "لا يمكنك تعديل صلاحيات حسابك الحالي",
        "error"
      );
      return;
    }

    const action:
      BusyAction =
      `support_permissions:${user.id}`;

    if (!beginAction(action)) {
      return;
    }

    try {
      const confirmed =
        await requestConfirmation(
          `هل تريد حفظ صلاحيات المستخدم ${user.full_name}؟ ستنتهي جلسته الحالية إن كان مسجلًا.`,
          {
            title:
              "حفظ صلاحيات المستخدم",

            confirmLabel:
              "حفظ الصلاحيات",
          }
        );

      if (!confirmed) {
        return;
      }

      const result =
        await executeRequest(
          `/api/admin-support/support-users/${user.id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              action:
                "update_permissions",

              permissions:
                normalizeSupportPermissions(
                  editingPermissions
                ),
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      closePermissionsEditor();

      showNotice(
        result.payload.message ||
          "تم تحديث الصلاحيات",
        "success"
      );

      await loadDashboard({
        section:
          "support_users",

        usersPage:
          paginationRef.current
            .usersPage,
      });
    } finally {
      endAction(action);
    }
  }

  async function performVerificationSearch(
    searchValue: string,
    mode: "search" | "refresh"
  ): Promise<boolean> {
    verificationAbortRef.current?.abort();

    const controller =
      new AbortController();

    verificationAbortRef.current =
      controller;

    const requestSequence =
      verificationRequestSequenceRef.current +
      1;

    verificationRequestSequenceRef.current =
      requestSequence;

    const action:
      BusyAction =
      mode === "search"
        ? "verification_search"
        : "verification_refresh";

    if (!beginAction(action)) {
      return false;
    }

    if (
      mode === "search" &&
      mountedRef.current
    ) {
      setVerificationResults(
        []
      );

      setVerificationSearchPerformed(
        false
      );

      resetVerificationEditor();
    }

    try {
      const result =
        await executeRequest<
          RawVerificationContract[]
        >(
          "/api/admin-support/verifications/search",
          {
            method: "POST",

            signal:
              controller.signal,

            body: JSON.stringify({
              search_value:
                searchValue,
            }),
          }
        );

      if (
        controller.signal.aborted ||
        requestSequence !==
          verificationRequestSequenceRef.current ||
        !mountedRef.current
      ) {
        return false;
      }

      if (!result.ok) {
        if (
          !result.aborted &&
          !result.unauthorized
        ) {
          showNotice(
            result.message,
            "error"
          );
        }

        return false;
      }

      const normalizedResults =
        normalizeVerificationResults(
          result.payload.data
        );

      setVerificationResults(
        normalizedResults
      );

      setVerificationSearchPerformed(
        true
      );

      return true;
    } finally {
      if (
        verificationAbortRef.current ===
        controller
      ) {
        verificationAbortRef.current =
          null;
      }

      endAction(action);
    }
  }

  async function searchVerificationContracts(): Promise<void> {
    if (
      !access.manage_verification_results
    ) {
      showNotice(
        "لا تملك صلاحية إدارة نتائج التحقق",
        "error"
      );
      return;
    }

    const searchValue =
      cleanNumericValue(
        verificationSearchValue,
        30
      );

    if (!searchValue) {
      showNotice(
        "اكتب رقم الهوية أو رقم العقد",
        "error"
      );
      return;
    }

    setVerificationSearchValue(
      searchValue
    );

    await performVerificationSearch(
      searchValue,
      "search"
    );
  }

  async function refreshVerificationSearch(): Promise<boolean> {
    const searchValue =
      cleanNumericValue(
        verificationSearchValue,
        30
      );

    if (!searchValue) {
      return false;
    }

    return performVerificationSearch(
      searchValue,
      "refresh"
    );
  }

  async function setVerificationOverride(
    contract: VerificationContract
  ): Promise<void> {
    if (
      !access.manage_verification_results
    ) {
      showNotice(
        "لا تملك صلاحية إدارة نتائج التحقق",
        "error"
      );
      return;
    }

    const action:
      BusyAction =
      `verification_set:${contract.contract_id}`;

    if (!beginAction(action)) {
      return;
    }

    try {
      const reason =
        verificationReason.trim();

      const notes =
        verificationNotes.trim();

      if (
        !isVerificationPosition(
          verificationPosition
        )
      ) {
        showNotice(
          "حالة التحقق المختارة غير صحيحة",
          "error"
        );
        return;
      }

      if (
        reason.length < 3
      ) {
        showNotice(
          "اكتب سبب التعديل، ويجب ألا يقل عن 3 أحرف",
          "error"
        );
        return;
      }

      if (
        reason.length > 500
      ) {
        showNotice(
          "سبب التعديل طويل جدًا",
          "error"
        );
        return;
      }

      if (
        notes.length > 1000
      ) {
        showNotice(
          "الملاحظات طويلة جدًا",
          "error"
        );
        return;
      }

      const confirmed =
        await requestConfirmation(
          `هل تريد جعل نتيجة العقد رقم ${
            contract.contract_number ||
            "-"
          } تظهر بحالة "${verificationPosition}"؟`,
          {
            title:
              "تعديل نتيجة التحقق",

            confirmLabel:
              `تعيين ${verificationPosition}`,
          }
        );

      if (!confirmed) {
        return;
      }

      const result =
        await executeRequest(
          `/api/admin-support/verifications/${contract.contract_id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              action:
                "set_override",

              position:
                verificationPosition,

              reason,
              notes,
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      const refreshed =
        await refreshVerificationSearch();

      if (!refreshed) {
        showNotice(
          "تم حفظ النتيجة، لكن تعذر تحديث بيانات البحث الحالية",
          "info"
        );
        return;
      }

      resetVerificationEditor();

      showNotice(
        result.payload.message ||
          "تم تحديث نتيجة التحقق",
        "success"
      );
    } finally {
      endAction(action);
    }
  }

  async function clearVerificationOverride(
    contract: VerificationContract
  ): Promise<void> {
    if (
      !access.manage_verification_results
    ) {
      showNotice(
        "لا تملك صلاحية إدارة نتائج التحقق",
        "error"
      );
      return;
    }

    const action:
      BusyAction =
      `verification_clear:${contract.contract_id}`;

    if (!beginAction(action)) {
      return;
    }

    try {
      const reason =
        verificationReason.trim();

      if (
        reason.length < 3
      ) {
        showNotice(
          "اكتب سبب العودة للوضع التلقائي",
          "error"
        );
        return;
      }

      if (
        reason.length > 500
      ) {
        showNotice(
          "سبب الإلغاء طويل جدًا",
          "error"
        );
        return;
      }

      const confirmed =
        await requestConfirmation(
          `هل تريد إلغاء تدخل الدعم عن العقد رقم ${
            contract.contract_number ||
            "-"
          } والعودة للحسبة التلقائية؟`,
          {
            title:
              "العودة للوضع التلقائي",

            confirmLabel:
              "العودة للوضع التلقائي",

            danger:
              true,
          }
        );

      if (!confirmed) {
        return;
      }

      const result =
        await executeRequest(
          `/api/admin-support/verifications/${contract.contract_id}`,
          {
            method: "PATCH",

            body: JSON.stringify({
              action:
                "clear_override",

              reason,
            }),
          }
        );

      if (!result.ok) {
        if (!result.aborted) {
          showNotice(
            result.message,
            "error"
          );
        }

        return;
      }

      const refreshed =
        await refreshVerificationSearch();

      if (!refreshed) {
        showNotice(
          "تمت العودة للوضع التلقائي، لكن تعذر تحديث بيانات البحث الحالية",
          "info"
        );
        return;
      }

      resetVerificationEditor();

      showNotice(
        result.payload.message ||
          "تمت العودة للوضع التلقائي",
        "success"
      );
    } finally {
      endAction(action);
    }
  }

  async function logout(): Promise<void> {
    if (
      !beginAction("logout")
    ) {
      return;
    }

    try {
      const confirmed =
        await requestConfirmation(
          "هل تريد تسجيل الخروج من لوحة الدعم الفني؟",
          {
            title:
              "تسجيل الخروج",

            confirmLabel:
              "تسجيل الخروج",
          }
        );

      if (!confirmed) {
        return;
      }

      dashboardAbortRef.current?.abort();

      verificationAbortRef.current?.abort();

      const result =
        await executeRequest(
          "/api/admin-support/logout",
          {
            method: "POST",
          }
        );

      if (
        !result.ok &&
        !result.aborted &&
        !result.unauthorized
      ) {
        showNotice(
          result.message,
          "error"
        );
      }

      clearVerificationWorkspace();

      redirectToLogin();
    } finally {
      endAction("logout");
    }
  }

  async function goToBranchesPage(
    page: number
  ): Promise<void> {
    if (
      page < 1 ||
      (
        branchesPagination.total_pages > 0 &&
        page >
          branchesPagination.total_pages
      )
    ) {
      return;
    }

    await loadDashboard({
      section: "branches",

      branchesPage:
        page,

      deletedBranchesPage:
        paginationRef.current
          .deletedBranchesPage,

      managersPage:
        paginationRef.current
          .managersPage,
    });
  }

  async function goToDeletedBranchesPage(
    page: number
  ): Promise<void> {
    if (
      page < 1 ||
      (
        deletedBranchesPagination.total_pages > 0 &&
        page >
          deletedBranchesPagination.total_pages
      )
    ) {
      return;
    }

    await loadDashboard({
      section: "branches",

      branchesPage:
        paginationRef.current
          .branchesPage,

      deletedBranchesPage:
        page,

      managersPage:
        paginationRef.current
          .managersPage,
    });
  }

  async function goToManagersPage(
    page: number
  ): Promise<void> {
    if (
      page < 1 ||
      (
        managersPagination.total_pages > 0 &&
        page >
          managersPagination.total_pages
      )
    ) {
      return;
    }

    await loadDashboard({
      section: "branches",

      branchesPage:
        paginationRef.current
          .branchesPage,

      managersPage:
        page,
    });
  }

  async function goToUsersPage(
    page: number
  ): Promise<void> {
    if (
      page < 1 ||
      (
        usersPagination.total_pages > 0 &&
        page >
          usersPagination.total_pages
      )
    ) {
      return;
    }

    await loadDashboard({
      section:
        "support_users",

      usersPage:
        page,
    });
  }

  async function goToLogsPage(
    page: number
  ): Promise<void> {
    if (
      page < 1 ||
      (
        logsPagination.total_pages > 0 &&
        page >
          logsPagination.total_pages
      )
    ) {
      return;
    }

    await loadDashboard({
      section: "logs",

      logsPage:
        page,
    });
  }

  const activeBranches =
    useMemo(
      () =>
        branches.filter(
          (branch) =>
            branch.is_active
        ).length,
      [branches]
    );

  const disabledBranches =
    branches.length -
    activeBranches;

  const activeSupportUsers =
    useMemo(
      () =>
        supportUsers.filter(
          (user) =>
            user.is_active
        ).length,
      [supportUsers]
    );

  const visibleTabs =
    useMemo(
      () => ({
        branches:
          access.manage_branches ||
          access.impersonate_branch,

        branchManagers:
          access.manage_branches,

        users:
          access.manage_support_users,

        verifications:
          access.manage_verification_results,

        logs:
          access.view_logs,
      }),
      [access]
    );

  const dashboardBusy =
    isBusy("dashboard");

  const branchSectionBusy =
    isBusy(
      "dashboard_section:branches"
    );

  const usersSectionBusy =
    isBusy(
      "dashboard_section:support_users"
    );

  const logsSectionBusy =
    isBusy(
      "dashboard_section:logs"
    );

  const branchSaveBusy =
    isBusy(
      "save_branch"
    );

  const supportCreateBusy =
    isBusy(
      "create_support_user"
    );

  const verificationSearching =
    isBusy(
      "verification_search"
    );

  const verificationRefreshing =
    isBusy(
      "verification_refresh"
    );

  const logoutBusy =
    isBusy("logout");
  if (loading) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(
          isCompact
        )}
      >
        <section
          style={loadingCard}
        >
          <div
            style={loadingSpinner}
          />

          <h1
            style={loadingTitle}
          >
            جاري تحميل لوحة الدعم الفني
          </h1>
        </section>

        <GlobalResponsiveStyles />
      </main>
    );
  }

  if (
    pageError &&
    !currentUser
  ) {
    return (
      <main
        dir="rtl"
        style={getPageStyle(
          isCompact
        )}
      >
        <section
          style={errorCard}
        >
          <h1
            style={errorTitle}
          >
            تعذر تحميل لوحة الدعم
          </h1>

          <p
            style={errorText}
          >
            {pageError}
          </p>

          <button
            type="button"
            style={getDisabledStyle(
              primaryButton,
              dashboardBusy
            )}
            onClick={() =>
              void loadDashboard({
                fullLoader: true,
                section: "all",
                branchesPage: 1,
                deletedBranchesPage: 1,
                managersPage: 1,
                usersPage: 1,
                logsPage: 1,
              })
            }
            disabled={
              dashboardBusy
            }
          >
            {dashboardBusy
              ? "جاري المحاولة..."
              : "إعادة المحاولة"}
          </button>
        </section>

        <GlobalResponsiveStyles />
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={getPageStyle(
        isCompact
      )}
    >
      <div
        className="support-shell"
        style={getShellStyle(
          isCompact
        )}
      >
        {!isCompact && (
          <aside
            className="support-sidebar"
            style={sidePanel}
          >
            <BrandBox />

            <SideNav
              activeTab={
                activeTab
              }
              setActiveTab={
                setActiveTab
              }
              visibleTabs={
                visibleTabs
              }
            />

            <button
              type="button"
              style={getDisabledStyle(
                logoutButton,
                logoutBusy
              )}
              onClick={() =>
                void logout()
              }
              disabled={
                logoutBusy
              }
            >
              {logoutBusy
                ? "جاري الخروج..."
                : "تسجيل خروج"}
            </button>
          </aside>
        )}

        <section
          className="support-main"
          style={mainPanel}
        >
          <header
            style={getHeroStyle(
              isMobile
            )}
          >
            <span
              style={heroCircleOne}
            />

            <span
              style={heroCircleTwo}
            />

            <span
              style={heroCircleThree}
            />

            <span
              style={heroDots}
            />

            <div
              style={heroContent}
            >
              <div>
                <p
                  style={topLabel}
                >
                  لوحة الدعم الفني
                </p>

                <h1
                  style={getHeroTitleStyle(
                    isMobile
                  )}
                >
                  إدارة النظام والفروع
                </h1>

                <p
                  style={heroSub}
                >
                  مرحبًا{" "}
                  {currentUser?.full_name ||
                    currentUser?.username}
                </p>
              </div>

              <div
                style={heroUserCard}
              >
                <span
                  style={heroUserName}
                >
                  {currentUser?.full_name ||
                    currentUser?.username}
                </span>

                <span
                  style={heroUserRole}
                >
                  {roleLabel(
                    currentUser?.role ||
                      ""
                  )}
                </span>
              </div>
            </div>
          </header>

          {isCompact && (
            <MobileNav
              activeTab={
                activeTab
              }
              setActiveTab={
                setActiveTab
              }
              visibleTabs={
                visibleTabs
              }
              onLogout={() =>
                void logout()
              }
              disabled={
                logoutBusy
              }
            />
          )}

          {notice && (
            <NoticeBanner
              notice={notice}
              onClose={
                closeNotice
              }
            />
          )}

          {pageError && (
            <div
              style={inlineError}
            >
              <span>
                {pageError}
              </span>

              <button
                type="button"
                style={inlineRetryButton}
                onClick={() =>
                  void loadDashboard({
                    section:
                      activeTab ===
                      "branches"
                        ? "branches"
                        : activeTab ===
                            "branch_managers"
                          ? "branches"
                          : activeTab ===
                              "users"
                            ? "support_users"
                            : activeTab ===
                                "logs"
                              ? "logs"
                              : "all",
                  })
                }
                disabled={
                  dashboardBusy ||
                  branchSectionBusy ||
                  usersSectionBusy ||
                  logsSectionBusy
                }
              >
                {dashboardBusy ||
                branchSectionBusy ||
                usersSectionBusy ||
                logsSectionBusy
                  ? "جاري المحاولة..."
                  : "إعادة المحاولة"}
              </button>
            </div>
          )}

          <section
            className="stats-grid"
            style={statsGrid}
          >
            {visibleTabs.branches && (
              <>
                <Stat
                  title="الفروع في الصفحة"
                  value={
                    branches.length
                  }
                />

                <Stat
                  title="إجمالي الفروع"
                  value={
                    branchesPagination.total
                  }
                />

                <Stat
                  title="النشطة في الصفحة"
                  value={
                    activeBranches
                  }
                />

                <Stat
                  title="المعطلة في الصفحة"
                  value={
                    disabledBranches
                  }
                />
              </>
            )}

            {visibleTabs.branchManagers && (
              <Stat
                title="إجمالي مدراء الفروع"
                value={
                  managersPagination.total
                }
              />
            )}

            {visibleTabs.users && (
              <>
                <Stat
                  title="إجمالي مستخدمي الدعم"
                  value={
                    usersPagination.total
                  }
                />

                <Stat
                  title="النشطون في الصفحة"
                  value={
                    activeSupportUsers
                  }
                />
              </>
            )}
          </section>

          {activeTab ===
            "overview" && (
            <section
              className="dashboard-grid"
              style={dashboardGrid}
            >
              <div
                style={darkCard}
              >
                <h2
                  style={whiteTitle}
                >
                  لوحة التحكم المركزية
                </h2>

                <div
                  style={quickActions}
                >
                  {visibleTabs.branches && (
                    <button
                      type="button"
                      style={quickButton}
                      onClick={() =>
                        setActiveTab(
                          "branches"
                        )
                      }
                    >
                      إدارة الفروع
                    </button>
                  )}

                  {visibleTabs.branchManagers && (
                    <button
                      type="button"
                      style={quickButton}
                      onClick={() =>
                        setActiveTab(
                          "branch_managers"
                        )
                      }
                    >
                      مدراء الفروع
                    </button>
                  )}

                  {visibleTabs.users && (
                    <button
                      type="button"
                      style={quickButton}
                      onClick={() =>
                        setActiveTab(
                          "users"
                        )
                      }
                    >
                      مستخدمو الدعم
                    </button>
                  )}

                  {visibleTabs.verifications && (
                    <button
                      type="button"
                      style={quickButton}
                      onClick={() =>
                        setActiveTab(
                          "verifications"
                        )
                      }
                    >
                      نتائج التحقق
                    </button>
                  )}

                  {visibleTabs.logs && (
                    <button
                      type="button"
                      style={quickButton}
                      onClick={() =>
                        setActiveTab(
                          "logs"
                        )
                      }
                    >
                      سجل العمليات
                    </button>
                  )}
                </div>
              </div>

              {visibleTabs.logs && (
                <div
                  style={panelCard}
                >
                  <h2
                    style={panelTitle}
                  >
                    آخر العمليات
                  </h2>

                  {logs.length === 0 ? (
                    <div
                      style={emptyBox}
                    >
                      لا توجد عمليات حتى الآن
                    </div>
                  ) : (
                    <div
                      style={miniLogs}
                    >
                      {logs
                        .slice(0, 6)
                        .map(
                          (log) => (
                            <div
                              key={
                                log.id
                              }
                              style={miniLogItem}
                            >
                              <strong>
                                {log.action}
                              </strong>

                              <span>
                                {log.user_name ||
                                  "-"}
                              </span>

                              <small>
                                {formatDateTime(
                                  log.created_at
                                )}
                              </small>
                            </div>
                          )
                        )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab ===
            "branches" &&
            visibleTabs.branches && (
              <>
                <div
                  style={sectionTop}
                >
                  <div>
                    <h2
                      style={sectionTitle}
                    >
                      إدارة الفروع
                    </h2>

                    <p
                      style={sectionHint}
                    >
                      عرض خفيف ومنظم، 15 فرعًا في كل صفحة
                    </p>
                  </div>

                  {access.manage_branches &&
                    branchListMode ===
                      "active" && (
                    <button
                      type="button"
                      style={getDisabledStyle(
                        primaryButton,
                        branchSaveBusy
                      )}
                      onClick={
                        openNewBranchForm
                      }
                      disabled={
                        branchSaveBusy
                      }
                    >
                      + إضافة فرع
                    </button>
                  )}
                </div>

                {access.manage_branches && (
                  <div
                    style={branchTabs}
                  >
                    <button
                      type="button"
                      style={
                        branchListMode ===
                        "active"
                          ? branchTabActive
                          : branchTab
                      }
                      onClick={() => {
                        setBranchListMode(
                          "active"
                        );
                        resetBranchForm();
                      }}
                    >
                      الفروع الحالية
                      <span
                        style={branchTabCount}
                      >
                        {
                          branchesPagination.total
                        }
                      </span>
                    </button>

                    <button
                      type="button"
                      style={
                        branchListMode ===
                        "deleted"
                          ? branchTabActive
                          : branchTab
                      }
                      onClick={() => {
                        setBranchListMode(
                          "deleted"
                        );
                        resetBranchForm();
                      }}
                    >
                      الفروع المحذوفة
                      <span
                        style={branchTabCount}
                      >
                        {
                          deletedBranchesPagination.total
                        }
                      </span>
                    </button>
                  </div>
                )}

                {showBranchForm &&
                  access.manage_branches &&
                  branchListMode ===
                    "active" && (
                    <section
                      style={formCard}
                    >
                      <h2
                        style={formTitle}
                      >
                        {editingBranchId
                          ? "تعديل فرع"
                          : "إضافة فرع جديد"}
                      </h2>

                      <div
                        style={formGrid}
                      >
                        <Field
                          id="branch-name"
                          label="اسم الفرع *"
                        >
                          <input
                            id="branch-name"
                            style={input}
                            value={
                              branchName
                            }
                            maxLength={100}
                            onChange={(
                              event
                            ) =>
                              setBranchName(
                                event.target
                                  .value
                              )
                            }
                            disabled={
                              branchSaveBusy
                            }
                          />
                        </Field>

                        <Field
                          id="branch-slug"
                          label="رابط الفرع *"
                        >
                          <input
                            id="branch-slug"
                            style={input}
                            value={
                              branchSlug
                            }
                            maxLength={64}
                            dir="ltr"
                            autoCapitalize="none"
                            spellCheck={false}
                            onChange={(
                              event
                            ) =>
                              setBranchSlug(
                                normalizeDigits(
                                  event.target
                                    .value
                                )
                                  .toLowerCase()
                                  .replace(
                                    /[^a-z0-9_-]/g,
                                    ""
                                  )
                                  .slice(
                                    0,
                                    64
                                  )
                              )
                            }
                            disabled={
                              branchSaveBusy
                            }
                          />
                        </Field>

                        <Field
                          id="organization-name"
                          label="اسم المنظمة *"
                        >
                          <input
                            id="organization-name"
                            style={input}
                            value={
                              organizationName
                            }
                            maxLength={150}
                            onChange={(
                              event
                            ) =>
                              setOrganizationName(
                                event.target
                                  .value
                              )
                            }
                            disabled={
                              branchSaveBusy
                            }
                          />
                        </Field>

                        <Field
                          id="branch-city"
                          label="المدينة"
                        >
                          <input
                            id="branch-city"
                            style={input}
                            value={
                              branchCity
                            }
                            maxLength={100}
                            onChange={(
                              event
                            ) =>
                              setBranchCity(
                                event.target
                                  .value
                              )
                            }
                            disabled={
                              branchSaveBusy
                            }
                          />
                        </Field>

                        <Field
                          id="branch-commercial-record"
                          label="السجل التجاري"
                        >
                          <input
                            id="branch-commercial-record"
                            style={input}
                            value={
                              branchCommercialRecord
                            }
                            maxLength={30}
                            inputMode="numeric"
                            onChange={(
                              event
                            ) =>
                              setBranchCommercialRecord(
                                cleanNumericValue(
                                  event.target
                                    .value,
                                  30
                                )
                              )
                            }
                            disabled={
                              branchSaveBusy
                            }
                          />
                        </Field>

                        <Field
                          id="branch-phone"
                          label="رقم الجوال"
                        >
                          <input
                            id="branch-phone"
                            style={input}
                            value={
                              branchPhone
                            }
                            maxLength={20}
                            inputMode="tel"
                            dir="ltr"
                            onChange={(
                              event
                            ) =>
                              setBranchPhone(
                                normalizePhoneValue(
                                  event.target
                                    .value,
                                  20
                                )
                              )
                            }
                            disabled={
                              branchSaveBusy
                            }
                          />
                        </Field>
                      </div>

                      {!editingBranchId && (
                        <>
                          <div
                            style={subFormTitle}
                          >
                            بيانات دخول مدير الفرع
                          </div>

                          <div
                            style={formGrid}
                          >
                            <Field
                              id="manager-full-name"
                              label="اسم مدير الفرع *"
                            >
                              <input
                                id="manager-full-name"
                                style={input}
                                value={
                                  managerFullName
                                }
                                maxLength={100}
                                onChange={(
                                  event
                                ) =>
                                  setManagerFullName(
                                    event.target
                                      .value
                                  )
                                }
                                disabled={
                                  branchSaveBusy
                                }
                              />
                            </Field>

                            <Field
                              id="manager-phone"
                              label="رقم جوال مدير الفرع *"
                            >
                              <input
                                id="manager-phone"
                                style={input}
                                value={
                                  managerPhone
                                }
                                maxLength={10}
                                inputMode="tel"
                                dir="ltr"
                                onChange={(
                                  event
                                ) =>
                                  setManagerPhone(
                                    normalizePhoneValue(
                                      event.target
                                        .value,
                                      10
                                    )
                                  )
                                }
                                disabled={
                                  branchSaveBusy
                                }
                              />
                            </Field>

                            <Field
                              id="manager-username"
                              label="اسم المستخدم الإنجليزي *"
                            >
                              <input
                                id="manager-username"
                                style={input}
                                value={
                                  managerUsername
                                }
                                maxLength={30}
                                dir="ltr"
                                autoCapitalize="none"
                                spellCheck={false}
                                onChange={(
                                  event
                                ) =>
                                  setManagerUsername(
                                    normalizeDigits(
                                      event.target
                                        .value
                                    )
                                      .toLowerCase()
                                      .replace(
                                        /[^a-z0-9_]/g,
                                        ""
                                      )
                                      .slice(
                                        0,
                                        30
                                      )
                                  )
                                }
                                disabled={
                                  branchSaveBusy
                                }
                              />
                            </Field>

                            <Field
                              id="manager-password"
                              label="كلمة المرور من 4 إلى 8 أرقام *"
                            >
                              <input
                                id="manager-password"
                                style={input}
                                type="password"
                                inputMode="numeric"
                                autoComplete="new-password"
                                minLength={4}
                                maxLength={8}
                                value={
                                  managerPassword
                                }
                                onChange={(
                                  event
                                ) =>
                                  setManagerPassword(
                                    cleanNumericValue(
                                      event.target
                                        .value,
                                      8
                                    )
                                  )
                                }
                                disabled={
                                  branchSaveBusy
                                }
                              />
                            </Field>
                          </div>
                        </>
                      )}

                      <div
                        style={{
                          marginTop: 12,
                        }}
                      >
                        <label
                          htmlFor="branch-notes"
                          style={label}
                        >
                          ملاحظات
                        </label>

                        <textarea
                          id="branch-notes"
                          style={textarea}
                          value={
                            branchNotes
                          }
                          maxLength={1000}
                          onChange={(
                            event
                          ) =>
                            setBranchNotes(
                              event.target
                                .value
                            )
                          }
                          disabled={
                            branchSaveBusy
                          }
                        />
                      </div>

                      <div
                        style={buttonsRow}
                      >
                        <button
                          type="button"
                          style={getDisabledStyle(
                            primaryButton,
                            branchSaveBusy
                          )}
                          onClick={() =>
                            void saveBranch()
                          }
                          disabled={
                            branchSaveBusy
                          }
                        >
                          {branchSaveBusy
                            ? "جاري الحفظ..."
                            : editingBranchId
                              ? "حفظ التعديلات"
                              : "إنشاء الفرع"}
                        </button>

                        <button
                          type="button"
                          style={secondaryButton}
                          onClick={
                            resetBranchForm
                          }
                          disabled={
                            branchSaveBusy
                          }
                        >
                          إلغاء
                        </button>
                      </div>
                    </section>
                  )}

                <section
                  style={compactPanelCard}
                >
                  {branchSectionBusy ? (
                    <SectionLoading />
                  ) : branchListMode ===
                      "active" ? (
                    branches.length ===
                    0 ? (
                      <div
                        style={emptyBox}
                      >
                        لا توجد فروع حالية
                      </div>
                    ) : (
                      <div
                        style={branchesList}
                      >
                        {branches.map(
                          (branch) => {
                            const statusAction:
                              BusyAction =
                              `branch_status:${branch.id}`;

                            const enterAction:
                              BusyAction =
                              `branch_enter:${branch.id}`;

                            const archiveAction:
                              BusyAction =
                              `branch_archive:${branch.id}`;

                            const branchBusy =
                              isBusy(
                                statusAction
                              ) ||
                              isBusy(
                                enterAction
                              ) ||
                              isBusy(
                                archiveAction
                              );

                            return (
                              <article
                                className="branch-row"
                                key={
                                  branch.id
                                }
                                style={branchRow}
                              >
                                <div
                                  style={branchMain}
                                >
                                  <div
                                    style={branchAvatar}
                                  >
                                    {branch.branch_name.slice(
                                      0,
                                      1
                                    )}
                                  </div>

                                  <div
                                    style={branchDetails}
                                  >
                                    <h3
                                      style={branchTitle}
                                    >
                                      {
                                        branch.branch_name
                                      }
                                    </h3>

                                    <div
                                      style={branchMetaLine}
                                    >
                                      <span>
                                        <strong>
                                          الفرع:
                                        </strong>{" "}
                                        <bdi
                                          dir="ltr"
                                        >
                                          {
                                            branch.branch_slug
                                          }
                                        </bdi>
                                      </span>

                                      <span
                                        style={metaDivider}
                                      >
                                        •
                                      </span>

                                      <span>
                                        <strong>
                                          المنظمة:
                                        </strong>{" "}
                                        {
                                          branch.organization_name
                                        }
                                      </span>

                                      {branch.city && (
                                        <>
                                          <span
                                            style={metaDivider}
                                          >
                                            •
                                          </span>

                                          <span>
                                            <strong>
                                              المدينة:
                                            </strong>{" "}
                                            {
                                              branch.city
                                            }
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <span
                                  style={
                                    branch.is_active
                                      ? activeBadge
                                      : inactiveBadge
                                  }
                                >
                                  {branch.is_active
                                    ? "نشط"
                                    : "معطل"}
                                </span>

                                <div
                                  style={rowActions}
                                >
                                  {access.impersonate_branch && (
                                    <button
                                      type="button"
                                      style={getDisabledStyle(
                                        compactBlueButton,
                                        isBusy(
                                          enterAction
                                        ) ||
                                          !branch.is_active
                                      )}
                                      onClick={() =>
                                        void enterBranch(
                                          branch
                                        )
                                      }
                                      disabled={
                                        isBusy(
                                          enterAction
                                        ) ||
                                        !branch.is_active
                                      }
                                    >
                                      {isBusy(
                                        enterAction
                                      )
                                        ? "دخول..."
                                        : "دخول"}
                                    </button>
                                  )}

                                  {access.manage_branches && (
                                    <>
                                      <button
                                        type="button"
                                        style={compactButton}
                                        onClick={() =>
                                          editBranch(
                                            branch
                                          )
                                        }
                                        disabled={
                                          branchBusy ||
                                          branchSaveBusy
                                        }
                                      >
                                        تعديل
                                      </button>

                                      <button
                                        type="button"
                                        style={getDisabledStyle(
                                          branch.is_active
                                            ? compactWarningButton
                                            : compactGreenButton,
                                          isBusy(
                                            statusAction
                                          )
                                        )}
                                        onClick={() =>
                                          void toggleBranch(
                                            branch
                                          )
                                        }
                                        disabled={isBusy(
                                          statusAction
                                        )}
                                      >
                                        {isBusy(
                                          statusAction
                                        )
                                          ? "تنفيذ..."
                                          : branch.is_active
                                            ? "تعطيل"
                                            : "تفعيل"}
                                      </button>

                                      <button
                                        type="button"
                                        style={getDisabledStyle(
                                          compactDangerButton,
                                          branchBusy
                                        )}
                                        onClick={() =>
                                          openArchiveDialog(
                                            branch
                                          )
                                        }
                                        disabled={
                                          branchBusy
                                        }
                                      >
                                        حذف
                                      </button>
                                    </>
                                  )}
                                </div>
                              </article>
                            );
                          }
                        )}
                      </div>
                    )
                  ) : deletedBranches.length ===
                    0 ? (
                    <div
                      style={emptyBox}
                    >
                      لا توجد فروع في قائمة المحذوفة
                    </div>
                  ) : (
                    <div
                      style={branchesList}
                    >
                      {deletedBranches.map(
                        (branch) => {
                          const restoreAction:
                            BusyAction =
                            `branch_restore:${branch.id}`;

                          return (
                            <article
                              className="branch-row"
                              key={
                                branch.id
                              }
                              style={deletedBranchRow}
                            >
                              <div
                                style={branchMain}
                              >
                                <div
                                  style={deletedBranchAvatar}
                                >
                                  ×
                                </div>

                                <div
                                  style={branchDetails}
                                >
                                  <h3
                                    style={branchTitle}
                                  >
                                    {
                                      branch.branch_name
                                    }
                                  </h3>

                                  <div
                                    style={branchMetaLine}
                                  >
                                    <span>
                                      <strong>
                                        الفرع:
                                      </strong>{" "}
                                      <bdi
                                        dir="ltr"
                                      >
                                        {
                                          branch.branch_slug
                                        }
                                      </bdi>
                                    </span>

                                    <span
                                      style={metaDivider}
                                    >
                                      •
                                    </span>

                                    <span>
                                      <strong>
                                        المنظمة:
                                      </strong>{" "}
                                      {
                                        branch.organization_name
                                      }
                                    </span>
                                  </div>

                                  <div
                                    style={deletedMetaLine}
                                  >
                                    حُذف بواسطة:{" "}
                                    {branch.deleted_by_user_name ||
                                      "-"}{" "}
                                    —{" "}
                                    {formatDateTime(
                                      branch.deleted_at ||
                                        ""
                                    )}
                                  </div>
                                </div>
                              </div>

                              <span
                                style={deletedBadge}
                              >
                                محذوف
                              </span>

                              <div
                                style={rowActions}
                              >
                                <button
                                  type="button"
                                  style={getDisabledStyle(
                                    compactGreenButton,
                                    isBusy(
                                      restoreAction
                                    )
                                  )}
                                  onClick={() =>
                                    void restoreBranch(
                                      branch
                                    )
                                  }
                                  disabled={isBusy(
                                    restoreAction
                                  )}
                                >
                                  {isBusy(
                                    restoreAction
                                  )
                                    ? "استعادة..."
                                    : "استعادة"}
                                </button>
                              </div>
                            </article>
                          );
                        }
                      )}
                    </div>
                  )}

                  {branchListMode ===
                  "active" ? (
                    <PaginationControls
                      pagination={
                        branchesPagination
                      }
                      loading={
                        branchSectionBusy
                      }
                      onPrevious={() =>
                        void goToBranchesPage(
                          branchesPagination.page -
                            1
                        )
                      }
                      onNext={() =>
                        void goToBranchesPage(
                          branchesPagination.page +
                            1
                        )
                      }
                    />
                  ) : (
                    <PaginationControls
                      pagination={
                        deletedBranchesPagination
                      }
                      loading={
                        branchSectionBusy
                      }
                      onPrevious={() =>
                        void goToDeletedBranchesPage(
                          deletedBranchesPagination.page -
                            1
                        )
                      }
                      onNext={() =>
                        void goToDeletedBranchesPage(
                          deletedBranchesPagination.page +
                            1
                        )
                      }
                    />
                  )}
                </section>
              </>
            )}

          {activeTab ===
            "branch_managers" &&
            visibleTabs.branchManagers && (
              <>
                <div
                  style={sectionTop}
                >
                  <h2
                    style={sectionTitle}
                  >
                    مدراء الفروع
                  </h2>
                </div>

                <section
                  style={usersGrid}
                >
                  {branchSectionBusy ? (
                    <SectionLoading />
                  ) : branchManagers.length ===
                    0 ? (
                    <div
                      style={emptyBox}
                    >
                      لا يوجد مدراء فروع
                    </div>
                  ) : (
                    branchManagers.map(
                      (manager) => {
                        const branchInfo =
                          getBranchRelation(
                            manager
                          );

                        const statusAction:
                          BusyAction =
                          `manager_status:${manager.id}`;

                        const passwordAction:
                          BusyAction =
                          `manager_password:${manager.id}`;

                        const managerBusy =
                          isBusy(
                            statusAction
                          ) ||
                          isBusy(
                            passwordAction
                          );

                        return (
                          <article
                            key={
                              manager.id
                            }
                            style={userCard}
                          >
                            <div
                              style={userIcon}
                            >
                              م
                            </div>

                            <h3
                              style={userTitle}
                            >
                              {
                                manager.full_name
                              }
                            </h3>

                            <p
                              style={muted}
                            >
                              @
                              {
                                manager.username
                              }
                            </p>

                            <p
                              style={muted}
                            >
                              {branchInfo?.branch_name ||
                                "فرع غير محدد"}
                            </p>

                            <p
                              style={ltrMuted}
                            >
                              /finance/
                              {branchInfo?.branch_slug ||
                                "-"}
                            </p>

                            <p
                              style={muted}
                            >
                              {formatDateTime(
                                manager.created_at
                              )}
                            </p>

                            <span
                              style={
                                manager.is_active
                                  ? activeBadge
                                  : inactiveBadge
                              }
                            >
                              {manager.is_active
                                ? "نشط"
                                : "معطل"}
                            </span>

                            <div
                              style={rowActions}
                            >
                              <button
                                type="button"
                                style={getDisabledStyle(
                                  smallBlueButton,
                                  managerBusy
                                )}
                                onClick={() =>
                                  openPasswordDialog(
                                    manager
                                  )
                                }
                                disabled={
                                  managerBusy
                                }
                              >
                                إعادة كلمة المرور
                              </button>

                              <button
                                type="button"
                                style={getDisabledStyle(
                                  manager.is_active
                                    ? smallDangerButton
                                    : smallGreenButton,
                                  isBusy(
                                    statusAction
                                  )
                                )}
                                onClick={() =>
                                  void toggleBranchManager(
                                    manager
                                  )
                                }
                                disabled={isBusy(
                                  statusAction
                                )}
                              >
                                {isBusy(
                                  statusAction
                                )
                                  ? "جاري التنفيذ..."
                                  : manager.is_active
                                    ? "تعطيل"
                                    : "تفعيل"}
                              </button>
                            </div>
                          </article>
                        );
                      }
                    )
                  )}
                </section>

                <PaginationControls
                  pagination={
                    managersPagination
                  }
                  loading={
                    branchSectionBusy
                  }
                  onPrevious={() =>
                    void goToManagersPage(
                      managersPagination.page -
                        1
                    )
                  }
                  onNext={() =>
                    void goToManagersPage(
                      managersPagination.page +
                        1
                    )
                  }
                />
              </>
            )}

          {activeTab ===
            "users" &&
            visibleTabs.users && (
              <>
                <div
                  style={sectionTop}
                >
                  <h2
                    style={sectionTitle}
                  >
                    مستخدمو الدعم الفني
                  </h2>

                  <button
                    type="button"
                    style={getDisabledStyle(
                      primaryButton,
                      supportCreateBusy
                    )}
                    onClick={
                      openNewUserForm
                    }
                    disabled={
                      supportCreateBusy
                    }
                  >
                    + إضافة مستخدم
                  </button>
                </div>

                {showUserForm && (
                  <section
                    style={formCard}
                  >
                    <h2
                      style={formTitle}
                    >
                      إضافة مستخدم دعم فني
                    </h2>

                    <div
                      style={formGrid}
                    >
                      <Field
                        id="support-full-name"
                        label="الاسم *"
                      >
                        <input
                          id="support-full-name"
                          style={input}
                          value={
                            supportFullName
                          }
                          maxLength={100}
                          onChange={(
                            event
                          ) =>
                            setSupportFullName(
                              event.target
                                .value
                            )
                          }
                          disabled={
                            supportCreateBusy
                          }
                        />
                      </Field>

                      <Field
                        id="support-username"
                        label="اسم المستخدم *"
                      >
                        <input
                          id="support-username"
                          style={input}
                          value={
                            supportUsername
                          }
                          maxLength={30}
                          autoCapitalize="none"
                          spellCheck={false}
                          onChange={(
                            event
                          ) =>
                            setSupportUsername(
                              event.target.value
                                .replace(
                                  /[^A-Za-z0-9_\u0600-\u06FF]/g,
                                  ""
                                )
                                .slice(
                                  0,
                                  30
                                )
                            )
                          }
                          disabled={
                            supportCreateBusy
                          }
                        />
                      </Field>

                      <Field
                        id="support-password"
                        label="كلمة المرور *"
                      >
                        <input
                          id="support-password"
                          style={input}
                          type="password"
                          autoComplete="new-password"
                          value={
                            supportPassword
                          }
                          maxLength={100}
                          onChange={(
                            event
                          ) =>
                            setSupportPassword(
                              event.target
                                .value
                            )
                          }
                          disabled={
                            supportCreateBusy
                          }
                        />
                      </Field>

                      <Field
                        id="support-role"
                        label="الدور *"
                      >
                        <select
                          id="support-role"
                          style={input}
                          value={
                            supportRole
                          }
                          onChange={(
                            event
                          ) => {
                            const value =
                              event.target
                                .value;

                            if (
                              isSupportRole(
                                value
                              )
                            ) {
                              setSupportRole(
                                value
                              );
                            }
                          }}
                          disabled={
                            supportCreateBusy
                          }
                        >
                          <option value="support">
                            دعم فني
                          </option>

                          <option value="viewer">
                            مشاهدة فقط
                          </option>

                          {currentUser?.role ===
                            "super_admin" && (
                            <option value="super_admin">
                              مدير النظام
                            </option>
                          )}
                        </select>
                      </Field>
                    </div>

                    {supportRole !==
                      "super_admin" && (
                      <div
                        style={permissionsBox}
                      >
                        {SUPPORT_PERMISSIONS.map(
                          (
                            permission
                          ) => (
                            <label
                              key={
                                permission.key
                              }
                              style={permissionItem}
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(
                                  permission.key
                                )}
                                disabled={
                                  supportCreateBusy
                                }
                                onChange={(
                                  event
                                ) => {
                                  setSelectedPermissions(
                                    (
                                      previous
                                    ) =>
                                      event.target
                                        .checked
                                        ? Array.from(
                                            new Set(
                                              [
                                                ...previous,
                                                permission.key,
                                              ]
                                            )
                                          )
                                        : previous.filter(
                                            (
                                              value
                                            ) =>
                                              value !==
                                              permission.key
                                          )
                                  );
                                }}
                              />

                              {
                                permission.label
                              }
                            </label>
                          )
                        )}
                      </div>
                    )}

                    <div
                      style={buttonsRow}
                    >
                      <button
                        type="button"
                        style={getDisabledStyle(
                          primaryButton,
                          supportCreateBusy
                        )}
                        onClick={() =>
                          void createSupportUser()
                        }
                        disabled={
                          supportCreateBusy
                        }
                      >
                        {supportCreateBusy
                          ? "جاري الحفظ..."
                          : "حفظ المستخدم"}
                      </button>

                      <button
                        type="button"
                        style={secondaryButton}
                        onClick={
                          resetUserForm
                        }
                        disabled={
                          supportCreateBusy
                        }
                      >
                        إلغاء
                      </button>
                    </div>
                  </section>
                )}

                <section
                  style={usersGrid}
                >
                  {usersSectionBusy ? (
                    <SectionLoading />
                  ) : supportUsers.length ===
                    0 ? (
                    <div
                      style={emptyBox}
                    >
                      لا يوجد مستخدمو دعم متاحون
                    </div>
                  ) : (
                    supportUsers.map(
                      (user) => {
                        const statusAction:
                          BusyAction =
                          `support_status:${user.id}`;

                        const permissionsAction:
                          BusyAction =
                          `support_permissions:${user.id}`;

                        const userBusy =
                          isBusy(
                            statusAction
                          ) ||
                          isBusy(
                            permissionsAction
                          );

                        const editorOpen =
                          editingPermissionsUserId ===
                          user.id;

                        return (
                          <article
                            key={
                              user.id
                            }
                            style={userCard}
                          >
                            <div
                              style={userIcon}
                            >
                              د
                            </div>

                            <h3
                              style={userTitle}
                            >
                              {
                                user.full_name
                              }
                            </h3>

                            <p
                              style={muted}
                            >
                              @
                              {
                                user.username
                              }
                            </p>

                            <p
                              style={roleBadge}
                            >
                              {roleLabel(
                                user.role
                              )}
                            </p>

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

                            <div
                              style={permissionsTags}
                            >
                              {user.role ===
                              "super_admin" ? (
                                <span
                                  style={permissionTag}
                                >
                                  جميع الصلاحيات
                                </span>
                              ) : user.permissions.length >
                                0 ? (
                                user.permissions.map(
                                  (
                                    permission
                                  ) => (
                                    <span
                                      key={
                                        permission
                                      }
                                      style={permissionTag}
                                    >
                                      {permissionLabel(
                                        permission
                                      )}
                                    </span>
                                  )
                                )
                              ) : (
                                <span
                                  style={permissionTag}
                                >
                                  بدون صلاحيات محددة
                                </span>
                              )}
                            </div>

                            {editorOpen && (
                              <div
                                style={permissionsEditorBox}
                              >
                                <strong>
                                  تعديل الصلاحيات
                                </strong>

                                <div
                                  style={permissionsBox}
                                >
                                  {SUPPORT_PERMISSIONS.map(
                                    (
                                      permission
                                    ) => (
                                      <label
                                        key={
                                          permission.key
                                        }
                                        style={permissionItem}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={editingPermissions.includes(
                                            permission.key
                                          )}
                                          disabled={isBusy(
                                            permissionsAction
                                          )}
                                          onChange={(
                                            event
                                          ) => {
                                            setEditingPermissions(
                                              (
                                                previous
                                              ) =>
                                                event.target
                                                  .checked
                                                  ? Array.from(
                                                      new Set(
                                                        [
                                                          ...previous,
                                                          permission.key,
                                                        ]
                                                      )
                                                    )
                                                  : previous.filter(
                                                      (
                                                        value
                                                      ) =>
                                                        value !==
                                                        permission.key
                                                    )
                                            );
                                          }}
                                        />

                                        {
                                          permission.label
                                        }
                                      </label>
                                    )
                                  )}
                                </div>

                                <div
                                  style={buttonsRow}
                                >
                                  <button
                                    type="button"
                                    style={getDisabledStyle(
                                      smallGreenButton,
                                      isBusy(
                                        permissionsAction
                                      )
                                    )}
                                    onClick={() =>
                                      void saveSupportUserPermissions(
                                        user
                                      )
                                    }
                                    disabled={isBusy(
                                      permissionsAction
                                    )}
                                  >
                                    {isBusy(
                                      permissionsAction
                                    )
                                      ? "جاري الحفظ..."
                                      : "حفظ الصلاحيات"}
                                  </button>

                                  <button
                                    type="button"
                                    style={smallButton}
                                    onClick={
                                      closePermissionsEditor
                                    }
                                    disabled={isBusy(
                                      permissionsAction
                                    )}
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              </div>
                            )}

                            <div
                              style={rowActions}
                            >
                              {user.role !==
                                "super_admin" &&
                                user.id !==
                                  currentUser?.id && (
                                  <button
                                    type="button"
                                    style={smallBlueButton}
                                    onClick={() =>
                                      editorOpen
                                        ? closePermissionsEditor()
                                        : openPermissionsEditor(
                                            user
                                          )
                                    }
                                    disabled={
                                      userBusy
                                    }
                                  >
                                    {editorOpen
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
                                  isBusy(
                                    statusAction
                                  ) ||
                                    user.id ===
                                      currentUser?.id
                                )}
                                onClick={() =>
                                  void toggleSupportUser(
                                    user
                                  )
                                }
                                disabled={
                                  isBusy(
                                    statusAction
                                  ) ||
                                  user.id ===
                                    currentUser?.id
                                }
                              >
                                {isBusy(
                                  statusAction
                                )
                                  ? "جاري التنفيذ..."
                                  : user.id ===
                                      currentUser?.id
                                    ? "الحساب الحالي"
                                    : user.is_active
                                      ? "تعطيل"
                                      : "تفعيل"}
                              </button>
                            </div>
                          </article>
                        );
                      }
                    )
                  )}
                </section>

                <PaginationControls
                  pagination={
                    usersPagination
                  }
                  loading={
                    usersSectionBusy
                  }
                  onPrevious={() =>
                    void goToUsersPage(
                      usersPagination.page -
                        1
                    )
                  }
                  onNext={() =>
                    void goToUsersPage(
                      usersPagination.page +
                        1
                    )
                  }
                />
              </>
            )}

          {activeTab ===
            "verifications" &&
            visibleTabs.verifications && (
              <>
                <div
                  style={sectionTop}
                >
                  <h2
                    style={sectionTitle}
                  >
                    التحكم بنتائج التحقق
                  </h2>
                </div>

                <section
                  style={verificationSearchCard}
                >
                  <div
                    className="verification-search-grid"
                    style={verificationSearchGrid}
                  >
                    <Field
                      id="verification-search"
                      label="رقم الهوية أو رقم العقد"
                    >
                      <input
                        id="verification-search"
                        style={input}
                        value={
                          verificationSearchValue
                        }
                        inputMode="numeric"
                        maxLength={30}
                        onChange={(
                          event
                        ) =>
                          setVerificationSearchValue(
                            cleanNumericValue(
                              event.target
                                .value,
                              30
                            )
                          )
                        }
                        onKeyDown={(
                          event
                        ) => {
                          if (
                            event.key ===
                            "Enter"
                          ) {
                            event.preventDefault();

                            void searchVerificationContracts();
                          }
                        }}
                        disabled={
                          verificationSearching
                        }
                      />
                    </Field>

                    <button
                      type="button"
                      style={getDisabledStyle(
                        primaryButton,
                        verificationSearching
                      )}
                      onClick={() =>
                        void searchVerificationContracts()
                      }
                      disabled={
                        verificationSearching
                      }
                    >
                      {verificationSearching
                        ? "جاري البحث..."
                        : "بحث"}
                    </button>
                  </div>
                </section>

                {verificationRefreshing && (
                  <div
                    style={verificationRefreshingBox}
                  >
                    <div
                      style={smallSpinner}
                    />

                    <span>
                      جاري تحديث بيانات النتائج...
                    </span>
                  </div>
                )}

                {!verificationSearchPerformed ? (
                  <div
                    style={emptyBox}
                  >
                    لن تظهر أي عقود قبل إدخال رقم الهوية أو رقم العقد وتنفيذ البحث.
                  </div>
                ) : verificationResults.length ===
                  0 ? (
                  <div
                    style={emptyBox}
                  >
                    لم يتم العثور على نتائج مطابقة
                  </div>
                ) : (
                  <section
                    style={verificationResultsList}
                  >
                    {verificationResults.map(
                      (contract) => {
                        const editorOpen =
                          editingVerificationContractId ===
                          contract.contract_id;

                        const setAction:
                          BusyAction =
                          `verification_set:${contract.contract_id}`;

                        const clearAction:
                          BusyAction =
                          `verification_clear:${contract.contract_id}`;

                        const contractBusy =
                          isBusy(
                            setAction
                          ) ||
                          isBusy(
                            clearAction
                          );

                        return (
                          <article
                            key={
                              contract.contract_id
                            }
                            style={verificationCard}
                          >
                            <div
                              style={verificationCardTop}
                            >
                              <div>
                                <h3
                                  style={verificationTitle}
                                >
                                  العقد رقم{" "}
                                  {contract.contract_number ||
                                    "-"}
                                </h3>

                                <p
                                  style={muted}
                                >
                                  {
                                    contract.customer_name
                                  }{" "}
                                  — الهوية:{" "}
                                  {contract.national_id ||
                                    "-"}
                                </p>

                                <p
                                  style={muted}
                                >
                                  الفرع:{" "}
                                  {
                                    contract.branch_name
                                  }
                                </p>
                              </div>

                              <div
                                style={verificationBadges}
                              >
                                <PositionBadge
                                  label={`التلقائي: ${contract.automatic_position}`}
                                  position={
                                    contract.automatic_position
                                  }
                                />

                                <PositionBadge
                                  label={`الظاهر: ${contract.effective_position}`}
                                  position={
                                    contract.effective_position
                                  }
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

                            <div
                              style={verificationInfoGrid}
                            >
                              <InfoItem
                                label="مبلغ العقد"
                                value={formatMoney(
                                  contract.debt_amount
                                )}
                              />

                              <InfoItem
                                label="المبلغ المدفوع"
                                value={formatMoney(
                                  contract.paid_amount
                                )}
                              />

                              <InfoItem
                                label="المبلغ المتبقي"
                                value={formatMoney(
                                  contract.remaining_amount
                                )}
                              />

                              <InfoItem
                                label="تاريخ العقد"
                                value={formatDate(
                                  contract.contract_date
                                )}
                              />

                              <InfoItem
                                label="تاريخ الاستحقاق"
                                value={formatDate(
                                  contract.payment_due_date
                                )}
                              />

                              <InfoItem
                                label="حالة العقد"
                                value={
                                  contract.contract_state
                                }
                              />

                              <InfoItem
                                label="الجوال"
                                value={
                                  contract.customer_phone ||
                                  "-"
                                }
                              />
                            </div>

                            {contract.has_support_override && (
                              <div
                                style={overrideDetailsBox}
                              >
                                <strong>
                                  النتيجة المفروضة:{" "}
                                  {contract.override_position ||
                                    "-"}
                                </strong>

                                <span>
                                  السبب:{" "}
                                  {contract.override_reason ||
                                    "-"}
                                </span>

                                {contract.override_notes && (
                                  <span>
                                    الملاحظات:{" "}
                                    {
                                      contract.override_notes
                                    }
                                  </span>
                                )}

                                <small>
                                  آخر تحديث:{" "}
                                  {formatDateTime(
                                    contract.override_updated_at ||
                                      ""
                                  )}
                                </small>
                              </div>
                            )}

                            {contract.default_declared_at && (
                              <div
                                style={defaultDetailsBox}
                              >
                                <strong>
                                  يوجد إعلان تعثر من الفرع
                                </strong>

                                <span>
                                  تاريخ الإعلان:{" "}
                                  {formatDateTime(
                                    contract.default_declared_at
                                  )}
                                </span>

                                <span>
                                  انتهاء التعثر:{" "}
                                  {formatDateTime(
                                    contract.default_expires_at ||
                                      ""
                                  )}
                                </span>

                                {contract.default_reason && (
                                  <span>
                                    السبب:{" "}
                                    {
                                      contract.default_reason
                                    }
                                  </span>
                                )}

                                {contract.default_notes && (
                                  <span>
                                    الملاحظات:{" "}
                                    {
                                      contract.default_notes
                                    }
                                  </span>
                                )}
                              </div>
                            )}

                            <div
                              style={rowActions}
                            >
                              <button
                                type="button"
                                style={smallBlueButton}
                                onClick={() =>
                                  editorOpen
                                    ? resetVerificationEditor()
                                    : openVerificationEditor(
                                        contract
                                      )
                                }
                                disabled={
                                  contractBusy ||
                                  verificationRefreshing
                                }
                              >
                                {editorOpen
                                  ? "إغلاق التحكم"
                                  : "التحكم بالنتيجة"}
                              </button>
                            </div>

                            {editorOpen && (
                              <div
                                id={`verification-editor-${contract.contract_id}`}
                                style={verificationEditorBox}
                              >
                                <div
                                  style={formGrid}
                                >
                                  <Field
                                    id={`verification-position-${contract.contract_id}`}
                                    label="النتيجة التي ستظهر للفروع"
                                  >
                                    <select
                                      id={`verification-position-${contract.contract_id}`}
                                      style={input}
                                      value={
                                        verificationPosition
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        setVerificationPosition(
                                          normalizeVerificationPosition(
                                            event.target
                                              .value
                                          )
                                        )
                                      }
                                      disabled={
                                        contractBusy
                                      }
                                    >
                                      <option value="نشط">
                                        نشط
                                      </option>

                                      <option value="متأخر">
                                        متأخر
                                      </option>

                                      <option value="متعثر">
                                        متعثر
                                      </option>
                                    </select>
                                  </Field>

                                  <Field
                                    id={`verification-reason-${contract.contract_id}`}
                                    label="سبب التعديل *"
                                  >
                                    <input
                                      id={`verification-reason-${contract.contract_id}`}
                                      style={input}
                                      value={
                                        verificationReason
                                      }
                                      maxLength={500}
                                      onChange={(
                                        event
                                      ) =>
                                        setVerificationReason(
                                          event.target
                                            .value
                                        )
                                      }
                                      disabled={
                                        contractBusy
                                      }
                                    />
                                  </Field>
                                </div>

                                <div
                                  style={{
                                    marginTop: 12,
                                  }}
                                >
                                  <label
                                    htmlFor={`verification-notes-${contract.contract_id}`}
                                    style={label}
                                  >
                                    ملاحظات داخلية
                                  </label>

                                  <textarea
                                    id={`verification-notes-${contract.contract_id}`}
                                    style={textarea}
                                    value={
                                      verificationNotes
                                    }
                                    maxLength={1000}
                                    onChange={(
                                      event
                                    ) =>
                                      setVerificationNotes(
                                        event.target
                                          .value
                                      )
                                    }
                                    disabled={
                                      contractBusy
                                    }
                                  />
                                </div>

                                <div
                                  style={buttonsRow}
                                >
                                  <button
                                    type="button"
                                    style={getDisabledStyle(
                                      smallGreenButton,
                                      contractBusy
                                    )}
                                    onClick={() =>
                                      void setVerificationOverride(
                                        contract
                                      )
                                    }
                                    disabled={
                                      contractBusy
                                    }
                                  >
                                    {isBusy(
                                      setAction
                                    )
                                      ? "جاري الحفظ..."
                                      : contract.has_support_override
                                        ? `حفظ ${verificationPosition}`
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
                                        void clearVerificationOverride(
                                          contract
                                        )
                                      }
                                      disabled={
                                        contractBusy
                                      }
                                    >
                                      {isBusy(
                                        clearAction
                                      )
                                        ? "جاري الإلغاء..."
                                        : "العودة للوضع التلقائي"}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    style={smallButton}
                                    onClick={
                                      resetVerificationEditor
                                    }
                                    disabled={
                                      contractBusy
                                    }
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      }
                    )}
                  </section>
                )}
              </>
            )}

          {activeTab ===
            "logs" &&
            visibleTabs.logs && (
              <>
                <div
                  style={sectionTop}
                >
                  <h2
                    style={sectionTitle}
                  >
                    سجل عمليات الدعم
                  </h2>
                </div>

                <section
                  style={panelCard}
                >
                  {logsSectionBusy ? (
                    <SectionLoading />
                  ) : logs.length ===
                    0 ? (
                    <div
                      style={emptyBox}
                    >
                      لا توجد سجلات حتى الآن
                    </div>
                  ) : (
                    <div
                      style={logTable}
                    >
                      {logs.map(
                        (log) => (
                          <div
                            key={
                              log.id
                            }
                            style={logRow}
                          >
                            <div>
                              <strong
                                style={logAction}
                              >
                                {log.action}
                              </strong>

                              <p
                                style={muted}
                              >
                                {log.details ||
                                  "-"}
                              </p>
                            </div>

                            <div
                              style={logMeta}
                            >
                              <span>
                                {log.user_name ||
                                  "-"}
                              </span>

                              <small>
                                {formatDateTime(
                                  log.created_at
                                )}
                              </small>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <PaginationControls
                    pagination={
                      logsPagination
                    }
                    loading={
                      logsSectionBusy
                    }
                    onPrevious={() =>
                      void goToLogsPage(
                        logsPagination.page -
                          1
                      )
                    }
                    onNext={() =>
                      void goToLogsPage(
                        logsPagination.page +
                          1
                      )
                    }
                  />
                </section>
              </>
            )}
        </section>
      </div>

      {confirmState && (
        <ModalOverlay>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            style={modalCard}
          >
            <h2
              id="confirm-dialog-title"
              style={modalTitle}
            >
              {
                confirmState.title
              }
            </h2>

            <p
              style={modalText}
            >
              {
                confirmState.message
              }
            </p>

            <div
              style={modalButtonsRow}
            >
              <button
                type="button"
                style={
                  confirmState.danger
                    ? smallDangerButton
                    : smallGreenButton
                }
                onClick={() =>
                  resolveConfirmation(
                    true
                  )
                }
              >
                {
                  confirmState.confirmLabel
                }
              </button>

              <button
                type="button"
                style={smallButton}
                onClick={() =>
                  resolveConfirmation(
                    false
                  )
                }
              >
                إلغاء
              </button>
            </div>
          </section>
        </ModalOverlay>
      )}

      {passwordDialog && (
        <ModalOverlay>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-dialog-title"
            style={modalCard}
          >
            <h2
              id="password-dialog-title"
              style={modalTitle}
            >
              إعادة تعيين كلمة المرور
            </h2>

            <p
              style={modalText}
            >
              المدير:{" "}
              {
                passwordDialog.manager
                  .full_name
              }
            </p>

            <Field
              id="manager-new-password"
              label="كلمة المرور الجديدة من 4 إلى 8 أرقام"
            >
              <input
                id="manager-new-password"
                style={input}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                minLength={4}
                maxLength={8}
                value={
                  passwordDialog.value
                }
                autoFocus
                onChange={(
                  event
                ) =>
                  setPasswordDialog(
                    (
                      previous
                    ) =>
                      previous
                        ? {
                            ...previous,

                            value:
                              cleanNumericValue(
                                event.target
                                  .value,
                                8
                              ),
                          }
                        : previous
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    event.preventDefault();

                    void submitBranchManagerPassword();
                  }

                  if (
                    event.key ===
                    "Escape"
                  ) {
                    event.preventDefault();

                    closePasswordDialog();
                  }
                }}
                disabled={isBusy(
                  `manager_password:${passwordDialog.manager.id}`
                )}
              />
            </Field>

            <div
              style={modalButtonsRow}
            >
              <button
                type="button"
                style={getDisabledStyle(
                  smallGreenButton,
                  isBusy(
                    `manager_password:${passwordDialog.manager.id}`
                  )
                )}
                onClick={() =>
                  void submitBranchManagerPassword()
                }
                disabled={isBusy(
                  `manager_password:${passwordDialog.manager.id}`
                )}
              >
                {isBusy(
                  `manager_password:${passwordDialog.manager.id}`
                )
                  ? "جاري التحديث..."
                  : "حفظ كلمة المرور"}
              </button>

              <button
                type="button"
                style={smallButton}
                onClick={
                  closePasswordDialog
                }
                disabled={isBusy(
                  `manager_password:${passwordDialog.manager.id}`
                )}
              >
                إلغاء
              </button>
            </div>
          </section>
        </ModalOverlay>
      )}

      {archiveDialog && (
        <ModalOverlay>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-dialog-title"
            style={modalCard}
          >
            <h2
              id="archive-dialog-title"
              style={modalTitle}
            >
              نقل الفرع إلى المحذوفة
            </h2>

            <p
              style={modalText}
            >
              اكتب اسم الفرع كما هو للتأكيد:
              <strong>
                {" "}
                {
                  archiveDialog.branch
                    .branch_name
                }
              </strong>
            </p>

            <Field
              id="archive-branch-name"
              label="اسم الفرع للتأكيد"
            >
              <input
                id="archive-branch-name"
                style={input}
                value={
                  archiveDialog.value
                }
                autoFocus
                maxLength={100}
                onChange={(
                  event
                ) =>
                  setArchiveDialog(
                    (
                      previous
                    ) =>
                      previous
                        ? {
                            ...previous,
                            value:
                              event.target
                                .value,
                          }
                        : previous
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    event.preventDefault();
                    void archiveBranch();
                  }

                  if (
                    event.key ===
                    "Escape"
                  ) {
                    event.preventDefault();
                    closeArchiveDialog();
                  }
                }}
                disabled={isBusy(
                  `branch_archive:${archiveDialog.branch.id}`
                )}
              />
            </Field>

            <div
              style={modalButtonsRow}
            >
              <button
                type="button"
                style={getDisabledStyle(
                  smallDangerButton,
                  isBusy(
                    `branch_archive:${archiveDialog.branch.id}`
                  ) ||
                    archiveDialog.value.trim() !==
                      archiveDialog.branch
                        .branch_name
                )}
                onClick={() =>
                  void archiveBranch()
                }
                disabled={
                  isBusy(
                    `branch_archive:${archiveDialog.branch.id}`
                  ) ||
                  archiveDialog.value.trim() !==
                    archiveDialog.branch
                      .branch_name
                }
              >
                {isBusy(
                  `branch_archive:${archiveDialog.branch.id}`
                )
                  ? "جاري النقل..."
                  : "نقل إلى المحذوفة"}
              </button>

              <button
                type="button"
                style={smallButton}
                onClick={
                  closeArchiveDialog
                }
                disabled={isBusy(
                  `branch_archive:${archiveDialog.branch.id}`
                )}
              >
                إلغاء
              </button>
            </div>
          </section>
        </ModalOverlay>
      )}

      <GlobalResponsiveStyles />
    </main>
  );
}

function Field({
  id,
  label: fieldLabel,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        style={label}
      >
        {fieldLabel}
      </label>

      {children}
    </div>
  );
}

function InfoItem({
  label: itemLabel,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={verificationInfoItem}
    >
      <span
        style={verificationInfoLabel}
      >
        {itemLabel}
      </span>

      <strong
        style={verificationInfoValue}
      >
        {value}
      </strong>
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
              boxShadow:
                "0 0 0 3px rgba(15,23,42,.08)",
            }
          : {}),
      }}
    >
      {badgeLabel}
    </span>
  );
}

function NoticeBanner({
  notice,
  onClose,
}: {
  notice: Exclude<
    NoticeState,
    null
  >;
  onClose: () => void;
}) {
  const noticeStyle =
    notice.type ===
    "success"
      ? successNotice
      : notice.type ===
          "error"
        ? errorNotice
        : infoNotice;

  return (
    <div
      role={
        notice.type ===
        "error"
          ? "alert"
          : "status"
      }
      style={{
        ...noticeBase,
        ...noticeStyle,
      }}
    >
      <span>
        {notice.message}
      </span>

      <button
        type="button"
        aria-label="إغلاق الرسالة"
        style={noticeCloseButton}
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

function ModalOverlay({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      style={modalOverlay}
    >
      {children}
    </div>
  );
}

function SectionLoading() {
  return (
    <div
      style={sectionLoadingBox}
    >
      <div
        style={smallSpinner}
      />

      <span>
        جاري تحميل البيانات...
      </span>
    </div>
  );
}

function PaginationControls({
  pagination,
  loading,
  onPrevious,
  onNext,
}: {
  pagination: PaginationState;
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (
    pagination.total_pages <=
    1
  ) {
    return null;
  }

  const previousDisabled =
    loading ||
    pagination.page <= 1;

  const nextDisabled =
    loading ||
    pagination.page >=
      pagination.total_pages;

  return (
    <div
      style={paginationRow}
    >
      <button
        type="button"
        style={getDisabledStyle(
          smallButton,
          previousDisabled
        )}
        onClick={onPrevious}
        disabled={
          previousDisabled
        }
      >
        السابق
      </button>

      <span
        style={paginationText}
      >
        الصفحة{" "}
        {pagination.page} من{" "}
        {pagination.total_pages}
      </span>

      <button
        type="button"
        style={getDisabledStyle(
          smallBlueButton,
          nextDisabled
        )}
        onClick={onNext}
        disabled={
          nextDisabled
        }
      >
        التالي
      </button>
    </div>
  );
}

function BrandBox() {
  return (
    <div
      style={brandBox}
    >
      <div
        style={brandIcon}
      >
        د
      </div>

      <div>
        <h2
          style={brandTitle}
        >
          دعم احتساب
        </h2>

        <p
          style={brandSub}
        >
          لوحة التحكم المركزية
        </p>
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

  setActiveTab: (
    tab: TabType
  ) => void;

  visibleTabs: {
    branches: boolean;
    branchManagers: boolean;
    users: boolean;
    verifications: boolean;
    logs: boolean;
  };
}) {
  return (
    <nav
      style={nav}
    >
      <NavButton
        active={
          activeTab ===
          "overview"
        }
        onClick={() =>
          setActiveTab(
            "overview"
          )
        }
      >
        النظرة العامة
      </NavButton>

      {visibleTabs.branches && (
        <NavButton
          active={
            activeTab ===
            "branches"
          }
          onClick={() =>
            setActiveTab(
              "branches"
            )
          }
        >
          الفروع
        </NavButton>
      )}

      {visibleTabs.branchManagers && (
        <NavButton
          active={
            activeTab ===
            "branch_managers"
          }
          onClick={() =>
            setActiveTab(
              "branch_managers"
            )
          }
        >
          مدراء الفروع
        </NavButton>
      )}

      {visibleTabs.users && (
        <NavButton
          active={
            activeTab ===
            "users"
          }
          onClick={() =>
            setActiveTab(
              "users"
            )
          }
        >
          مستخدمو الدعم
        </NavButton>
      )}

      {visibleTabs.verifications && (
        <NavButton
          active={
            activeTab ===
            "verifications"
          }
          onClick={() =>
            setActiveTab(
              "verifications"
            )
          }
        >
          نتائج التحقق
        </NavButton>
      )}

      {visibleTabs.logs && (
        <NavButton
          active={
            activeTab ===
            "logs"
          }
          onClick={() =>
            setActiveTab(
              "logs"
            )
          }
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
      style={
        active
          ? navActive
          : navItem
      }
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

  setActiveTab: (
    tab: TabType
  ) => void;

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
    <div
      className="mobile-nav"
    >
      <button
        type="button"
        className={
          activeTab ===
          "overview"
            ? "mobile-tab active"
            : "mobile-tab"
        }
        onClick={() =>
          setActiveTab(
            "overview"
          )
        }
      >
        العامة
      </button>

      {visibleTabs.branches && (
        <button
          type="button"
          className={
            activeTab ===
            "branches"
              ? "mobile-tab active"
              : "mobile-tab"
          }
          onClick={() =>
            setActiveTab(
              "branches"
            )
          }
        >
          الفروع
        </button>
      )}

      {visibleTabs.branchManagers && (
        <button
          type="button"
          className={
            activeTab ===
            "branch_managers"
              ? "mobile-tab active"
              : "mobile-tab"
          }
          onClick={() =>
            setActiveTab(
              "branch_managers"
            )
          }
        >
          المدراء
        </button>
      )}

      {visibleTabs.users && (
        <button
          type="button"
          className={
            activeTab ===
            "users"
              ? "mobile-tab active"
              : "mobile-tab"
          }
          onClick={() =>
            setActiveTab(
              "users"
            )
          }
        >
          الدعم
        </button>
      )}

      {visibleTabs.verifications && (
        <button
          type="button"
          className={
            activeTab ===
            "verifications"
              ? "mobile-tab active"
              : "mobile-tab"
          }
          onClick={() =>
            setActiveTab(
              "verifications"
            )
          }
        >
          التحقق
        </button>
      )}

      {visibleTabs.logs && (
        <button
          type="button"
          className={
            activeTab ===
            "logs"
              ? "mobile-tab active"
              : "mobile-tab"
          }
          onClick={() =>
            setActiveTab(
              "logs"
            )
          }
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

function Stat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div
      style={statCard}
    >
      <span
        style={statValue}
      >
        {value}
      </span>

      <span
        style={statTitle}
      >
        {title}
      </span>
    </div>
  );
}
function getPageStyle(
  isCompact: boolean
): CSSProperties {
  return {
    minHeight: "100vh",
    padding:
      isCompact ? 8 : 14,

    fontFamily:
      "var(--font-almarai), sans-serif",

    color: "#0f172a",
    overflowX: "hidden",
    backgroundColor: "#edf4ff",

    backgroundImage:
      "radial-gradient(circle at 12% 16%, rgba(37,99,235,.14), transparent 28%), radial-gradient(circle at 88% 8%, rgba(14,165,233,.12), transparent 26%), linear-gradient(rgba(244,247,251,.88), rgba(244,247,251,.94)), url('/backgrounds/v13-finance-bg-1.png')",

    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",

    backgroundAttachment:
      isCompact
        ? "scroll"
        : "fixed",
  };
}

function getShellStyle(
  isCompact: boolean
): CSSProperties {
  return {
    width: "100%",
    maxWidth: 1450,
    margin: "auto",
    display: "grid",

    gridTemplateColumns:
      isCompact
        ? "minmax(0, 1fr)"
        : "240px minmax(0, 1fr)",

    gap: 14,
  };
}

function getHeroStyle(
  isMobile: boolean
): CSSProperties {
  return {
    position: "relative",
    overflow: "hidden",

    background:
      "linear-gradient(135deg, #0f172a 0%, #1d4ed8 58%, #0ea5e9 100%)",

    color: "white",

    borderRadius:
      isMobile ? 20 : 24,

    padding:
      isMobile ? 15 : 18,

    marginBottom: 14,

    boxShadow:
      "0 18px 42px rgba(30,64,175,.20)",
  };
}

function getHeroTitleStyle(
  isMobile: boolean
): CSSProperties {
  return {
    margin: "6px 0",

    fontSize:
      isMobile ? 23 : 28,

    lineHeight: 1.4,

    fontFamily:
      "var(--font-almarai), sans-serif",
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

      button {
        -webkit-tap-highlight-color: transparent;
      }

      button:focus-visible,
      input:focus-visible,
      textarea:focus-visible,
      select:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.22);
        outline-offset: 2px;
      }

      button:disabled,
      input:disabled,
      textarea:disabled,
      select:disabled {
        cursor: not-allowed;
      }

      input,
      textarea,
      select {
        min-width: 0;
      }

      .mobile-nav {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 2px 1px 12px;
        margin-bottom: 10px;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
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
        background: linear-gradient(
          135deg,
          #1d4ed8,
          #0ea5e9
        );
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

        .branch-row > span {
          justify-self: start;
        }
      }

      @media (max-width: 700px) {
        .stats-grid {
          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            ) !important;
        }

        .verification-search-grid {
          grid-template-columns:
            1fr !important;
        }

        .verification-search-grid button {
          width: 100%;
        }
      }

      @media (max-width: 440px) {
        .stats-grid {
          grid-template-columns:
            1fr !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          scroll-behavior: auto !important;
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `}</style>
  );
}

const loadingCard:
  CSSProperties = {
  width: "min(100%, 480px)",
  margin: "18vh auto 0",
  padding: 28,
  borderRadius: 24,

  background:
    "rgba(255,255,255,.94)",

  border:
    "1px solid #dbe4f0",

  boxShadow:
    "0 18px 50px rgba(15,23,42,.12)",

  textAlign: "center",
};

const loadingSpinner:
  CSSProperties = {
  width: 42,
  height: 42,
  margin: "0 auto 16px",
  borderRadius: "50%",

  border:
    "4px solid #dbeafe",

  borderTopColor:
    "#2563eb",

  animation:
    "support-spin .8s linear infinite",
};

const smallSpinner:
  CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: "50%",

  border:
    "3px solid #bfdbfe",

  borderTopColor:
    "#2563eb",

  animation:
    "support-spin .8s linear infinite",

  flex: "0 0 auto",
};

const loadingTitle:
  CSSProperties = {
  margin: 0,
  fontSize: 21,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const errorCard:
  CSSProperties = {
  ...loadingCard,
  marginTop: "14vh",
};

const errorTitle:
  CSSProperties = {
  margin: "0 0 10px",
  color: "#991b1b",
};

const errorText:
  CSSProperties = {
  color: "#64748b",
  lineHeight: 1.8,
};

const sidePanel:
  CSSProperties = {
  minHeight:
    "calc(100vh - 28px)",

  background:
    "linear-gradient(180deg,#0f172a,#020617)",

  border:
    "1px solid rgba(148,163,184,.18)",

  borderRadius: 26,
  padding: 13,
  color: "white",

  position: "sticky",
  top: 14,
  alignSelf: "start",
};

const brandBox:
  CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  padding: 12,
  borderRadius: 20,

  background:
    "rgba(255,255,255,.06)",

  marginBottom: 18,
};

const brandIcon:
  CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,

  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  fontSize: 22,
  fontWeight: 900,
};

const brandTitle:
  CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const brandSub:
  CSSProperties = {
  margin: "5px 0 0",
  color: "#94a3b8",
  fontSize: 13,
};

const nav:
  CSSProperties = {
  display: "grid",
  gap: 8,
};

const navItem:
  CSSProperties = {
  width: "100%",

  border:
    "1px solid transparent",

  background: "transparent",
  color: "#cbd5e1",
  borderRadius: 15,

  padding:
    "13px 12px",

  cursor: "pointer",
  textAlign: "right",
  fontSize: 15,
  fontWeight: 800,
};

const navActive:
  CSSProperties = {
  ...navItem,
  color: "white",

  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",

  border:
    "1px solid rgba(255,255,255,.15)",
};

const logoutButton:
  CSSProperties = {
  width: "100%",
  marginTop: 18,
  background: "#fee2e2",
  color: "#991b1b",
  border: "none",
  borderRadius: 15,

  padding:
    "13px 16px",

  fontWeight: 900,
  cursor: "pointer",
};

const mainPanel:
  CSSProperties = {
  minWidth: 0,

  minHeight:
    "calc(100vh - 28px)",

  background:
    "rgba(248,250,252,.93)",

  border:
    "1px solid rgba(226,232,240,.92)",

  borderRadius: 26,
  padding: 13,

  backdropFilter:
    "blur(10px)",

  boxShadow:
    "0 18px 48px rgba(15,23,42,.08)",
};

const heroContent:
  CSSProperties = {
  position: "relative",
  zIndex: 3,
  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
};

const topLabel:
  CSSProperties = {
  margin: 0,
  color: "#bfdbfe",
  fontWeight: 800,
};

const heroSub:
  CSSProperties = {
  margin: 0,
  color: "#e0f2fe",
};

const heroUserCard:
  CSSProperties = {
  display: "grid",
  gap: 5,
  minWidth: 175,

  padding:
    "12px 15px",

  borderRadius: 17,

  border:
    "1px solid rgba(255,255,255,.22)",

  background:
    "rgba(255,255,255,.10)",

  backdropFilter:
    "blur(7px)",
};

const heroUserName:
  CSSProperties = {
  fontWeight: 900,
};

const heroUserRole:
  CSSProperties = {
  color: "#dbeafe",
  fontSize: 13,
};

const heroCircleOne:
  CSSProperties = {
  position: "absolute",
  width: 180,
  height: 180,
  borderRadius: "50%",
  top: -95,
  left: -45,

  background:
    "rgba(255,255,255,.10)",
};

const heroCircleTwo:
  CSSProperties = {
  position: "absolute",
  width: 110,
  height: 110,
  borderRadius: "50%",
  bottom: -58,
  right: "28%",

  background:
    "rgba(125,211,252,.14)",
};

const heroCircleThree:
  CSSProperties = {
  position: "absolute",
  width: 74,
  height: 74,
  borderRadius: "50%",
  top: 18,
  right: 28,

  border:
    "1px solid rgba(255,255,255,.18)",
};

const heroDots:
  CSSProperties = {
  position: "absolute",
  insetInlineEnd: 26,
  bottom: 18,
  width: 74,
  height: 34,
  opacity: 0.32,

  backgroundImage:
    "radial-gradient(circle, rgba(255,255,255,.9) 1.3px, transparent 1.5px)",

  backgroundSize:
    "10px 10px",
};

const noticeBase:
  CSSProperties = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",

  marginBottom: 12,
  padding: 13,
  borderRadius: 15,
  fontWeight: 800,
};

const successNotice:
  CSSProperties = {
  background: "#dcfce7",
  color: "#166534",

  border:
    "1px solid #bbf7d0",
};

const errorNotice:
  CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",

  border:
    "1px solid #fecaca",
};

const infoNotice:
  CSSProperties = {
  background: "#e0f2fe",
  color: "#075985",

  border:
    "1px solid #bae6fd",
};

const noticeCloseButton:
  CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  border: "none",

  background:
    "rgba(255,255,255,.66)",

  color: "inherit",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
};

const inlineError:
  CSSProperties = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",

  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  background: "#fee2e2",
  color: "#991b1b",

  border:
    "1px solid #fecaca",
};

const inlineRetryButton:
  CSSProperties = {
  border: "none",
  borderRadius: 10,

  padding:
    "8px 12px",

  background: "#991b1b",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const statsGrid:
  CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(145px,1fr))",

  gap: 9,
  marginBottom: 12,
};

const statCard:
  CSSProperties = {
  background: "white",

  border:
    "1px solid #e2e8f0",

  borderRadius: 15,
  padding: 12,

  boxShadow:
    "0 8px 18px rgba(15,23,42,.04)",
};

const statValue:
  CSSProperties = {
  display: "block",
  fontSize: 26,
  fontWeight: 900,
  color: "#2563eb",
};

const statTitle:
  CSSProperties = {
  display: "block",
  color: "#0f172a",
  fontWeight: 900,
  marginTop: 4,
};

const dashboardGrid:
  CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "1fr 1fr",

  gap: 12,
};

const darkCard:
  CSSProperties = {
  background:
    "linear-gradient(135deg,#0f172a,#1e3a8a)",

  color: "white",
  borderRadius: 22,
  padding: 20,
  minHeight: 190,
};

const whiteTitle:
  CSSProperties = {
  marginTop: 0,
};

const quickActions:
  CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 20,
};

const quickButton:
  CSSProperties = {
  border:
    "1px solid rgba(255,255,255,.18)",

  background:
    "rgba(255,255,255,.08)",

  color: "white",
  borderRadius: 14,

  padding:
    "12px 14px",

  cursor: "pointer",
  fontWeight: 800,
};

const panelCard:
  CSSProperties = {
  background: "white",

  border:
    "1px solid #e2e8f0",

  borderRadius: 16,
  padding: 12,

  boxShadow:
    "0 8px 18px rgba(15,23,42,.04)",
};

const panelTitle:
  CSSProperties = {
  marginTop: 0,
};

const miniLogs:
  CSSProperties = {
  display: "grid",
  gap: 8,
};

const miniLogItem:
  CSSProperties = {
  border:
    "1px solid #e2e8f0",

  background: "#f8fafc",
  borderRadius: 14,
  padding: 12,
  display: "grid",
  gap: 4,
};

const sectionTop:
  CSSProperties = {
  display: "flex",

  justifyContent:
    "space-between",

  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 12,
};

const sectionTitle:
  CSSProperties = {
  margin: 0,
  color: "#0f172a",

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const primaryButton:
  CSSProperties = {
  border: "none",

  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",

  color: "white",
  borderRadius: 14,

  padding:
    "13px 18px",

  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",

  boxShadow:
    "0 8px 18px rgba(37,99,235,.18)",
};

const secondaryButton:
  CSSProperties = {
  ...primaryButton,

  background:
    "linear-gradient(135deg,#64748b,#334155)",

  boxShadow:
    "0 8px 18px rgba(51,65,85,.14)",
};

const formCard:
  CSSProperties = {
  background: "white",

  border:
    "1px solid #e2e8f0",

  borderRadius: 22,
  padding: 16,
  marginBottom: 14,
};

const formTitle:
  CSSProperties = {
  marginTop: 0,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const subFormTitle:
  CSSProperties = {
  marginTop: 18,
  marginBottom: 12,
  padding: 12,
  background: "#eff6ff",
  color: "#1d4ed8",

  border:
    "1px solid #bfdbfe",

  borderRadius: 14,
  fontWeight: 900,
};

const formGrid:
  CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(220px,1fr))",

  gap: 12,
};

const label:
  CSSProperties = {
  display: "block",
  marginBottom: 7,
  color: "#334155",
  fontWeight: 900,
};

const input:
  CSSProperties = {
  width: "100%",
  boxSizing: "border-box",

  border:
    "1px solid #cbd5e1",

  borderRadius: 13,
  padding: 13,
  fontSize: 15,
  background: "#f8fafc",
  color: "#0f172a",
};

const textarea:
  CSSProperties = {
  ...input,
  minHeight: 90,
  resize: "vertical",
};

const buttonsRow:
  CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

const branchesList:
  CSSProperties = {
  display: "grid",
  gap: 7,
};

const branchRow:
  CSSProperties = {
  border:
    "1px solid #e2e8f0",

  background: "#ffffff",
  borderRadius: 12,
  padding: 10,
  display: "grid",

  gridTemplateColumns:
    "minmax(0,1fr) auto auto",

  gap: 9,
  alignItems: "center",
};

const branchMain:
  CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  minWidth: 0,
};

const branchAvatar:
  CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 11,
  background: "#dbeafe",
  color: "#1d4ed8",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  fontWeight: 900,
  fontSize: 20,
  flex: "0 0 auto",
};

const branchTitle:
  CSSProperties = {
  margin: 0,
  fontSize: 15,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const muted:
  CSSProperties = {
  color: "#64748b",
  margin: "6px 0",
  wordBreak: "break-word",
};

const ltrMuted:
  CSSProperties = {
  ...muted,
  direction: "ltr",
  textAlign: "right",
};

const activeBadge:
  CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,

  padding:
    "5px 8px",

  fontWeight: 900,
  width: "fit-content",
};

const inactiveBadge:
  CSSProperties = {
  display: "inline-block",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,

  padding:
    "5px 8px",

  fontWeight: 900,
  width: "fit-content",
};

const rowActions:
  CSSProperties = {
  display: "flex",
  gap: 5,
  flexWrap: "wrap",
};

const smallButton:
  CSSProperties = {
  border: "none",

  background:
    "linear-gradient(135deg,#e0f2fe,#dbeafe)",

  color: "#075985",
  borderRadius: 10,

  padding:
    "9px 12px",

  cursor: "pointer",
  fontWeight: 800,
};

const smallBlueButton:
  CSSProperties = {
  ...smallButton,

  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",

  color: "white",
};

const smallGreenButton:
  CSSProperties = {
  ...smallButton,

  background:
    "linear-gradient(135deg,#16a34a,#15803d)",

  color: "white",
};

const smallDangerButton:
  CSSProperties = {
  ...smallButton,

  background:
    "linear-gradient(135deg,#ef4444,#b91c1c)",

  color: "white",
};

const usersGrid:
  CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(250px,1fr))",

  gap: 12,
};

const userCard:
  CSSProperties = {
  background: "white",

  border:
    "1px solid #e2e8f0",

  borderRadius: 22,
  padding: 16,
  display: "grid",
  gap: 8,
};

const userIcon:
  CSSProperties = {
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

const userTitle:
  CSSProperties = {
  margin: 0,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const roleBadge:
  CSSProperties = {
  background: "#f1f5f9",
  color: "#334155",
  borderRadius: 999,

  padding:
    "7px 10px",

  width: "fit-content",
  fontWeight: 800,
};

const permissionsBox:
  CSSProperties = {
  marginTop: 14,
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",

  gap: 10,
};

const permissionItem:
  CSSProperties = {
  background: "#f8fafc",

  border:
    "1px solid #e2e8f0",

  borderRadius: 12,
  padding: 12,
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 800,
};

const permissionsTags:
  CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const permissionTag:
  CSSProperties = {
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 999,

  padding:
    "5px 8px",

  fontSize: 12,
  fontWeight: 800,
};

const permissionsEditorBox:
  CSSProperties = {
  marginTop: 8,

  border:
    "1px solid #bfdbfe",

  background: "#eff6ff",
  borderRadius: 16,
  padding: 12,
};

const emptyBox:
  CSSProperties = {
  background: "#f8fafc",

  border:
    "1px dashed #cbd5e1",

  borderRadius: 16,
  padding: 18,
  textAlign: "center",
  color: "#64748b",
};

const sectionLoadingBox:
  CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 10,
  minHeight: 120,
  padding: 18,
  color: "#1d4ed8",
  fontWeight: 900,
};

const paginationRow:
  CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const paginationText:
  CSSProperties = {
  color: "#475569",
  fontWeight: 900,
};

const logTable:
  CSSProperties = {
  display: "grid",
  gap: 8,
};

const logRow:
  CSSProperties = {
  border:
    "1px solid #e2e8f0",

  borderRadius: 16,
  padding: 12,
  display: "flex",

  justifyContent:
    "space-between",

  gap: 12,
  flexWrap: "wrap",
};

const logAction:
  CSSProperties = {
  color: "#0f172a",
};

const logMeta:
  CSSProperties = {
  display: "grid",
  gap: 4,
  color: "#64748b",
};

const sectionHint:
  CSSProperties = {
  margin: "5px 0 0",
  color: "#64748b",
  fontSize: 13,
};

const branchTabs:
  CSSProperties = {
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
  marginBottom: 10,
};

const branchTab:
  CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#ffffff",
  color: "#475569",
  borderRadius: 10,
  padding: "8px 11px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
};

const branchTabActive:
  CSSProperties = {
  ...branchTab,
  color: "#ffffff",
  borderColor: "transparent",
  background:
    "linear-gradient(135deg,#1d4ed8,#0ea5e9)",
};

const branchTabCount:
  CSSProperties = {
  minWidth: 22,
  height: 22,
  padding: "0 6px",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,.18)",
  fontSize: 11,
};

const compactPanelCard:
  CSSProperties = {
  background: "rgba(255,255,255,.92)",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 10,
  boxShadow:
    "0 6px 16px rgba(15,23,42,.035)",
};

const branchDetails:
  CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 5,
};

const branchMetaLine:
  CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.7,
};

const metaDivider:
  CSSProperties = {
  color: "#cbd5e1",
};

const deletedMetaLine:
  CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
};

const deletedBranchRow:
  CSSProperties = {
  ...branchRow,
  background: "#fffafa",
  borderColor: "#fecaca",
};

const deletedBranchAvatar:
  CSSProperties = {
  ...branchAvatar,
  background: "#fee2e2",
  color: "#991b1b",
};

const deletedBadge:
  CSSProperties = {
  ...inactiveBadge,
  background: "#f1f5f9",
  color: "#475569",
};

const compactButton:
  CSSProperties = {
  border: "1px solid #dbe4f0",
  background: "#f8fafc",
  color: "#334155",
  borderRadius: 8,
  padding: "7px 9px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const compactBlueButton:
  CSSProperties = {
  ...compactButton,
  color: "#ffffff",
  borderColor: "transparent",
  background:
    "linear-gradient(135deg,#2563eb,#0ea5e9)",
};

const compactGreenButton:
  CSSProperties = {
  ...compactButton,
  color: "#ffffff",
  borderColor: "transparent",
  background:
    "linear-gradient(135deg,#16a34a,#15803d)",
};

const compactWarningButton:
  CSSProperties = {
  ...compactButton,
  color: "#92400e",
  borderColor: "#fde68a",
  background: "#fef3c7",
};

const compactDangerButton:
  CSSProperties = {
  ...compactButton,
  color: "#991b1b",
  borderColor: "#fecaca",
  background: "#fee2e2",
};

const verificationSearchCard:
  CSSProperties = {
  background: "white",

  border:
    "1px solid #dbe4f0",

  borderRadius: 22,
  padding: 16,
  marginBottom: 14,

  boxShadow:
    "0 8px 18px rgba(15,23,42,.04)",
};

const verificationSearchGrid:
  CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "minmax(220px,1fr) auto",

  alignItems: "end",
  gap: 10,
};

const verificationRefreshingBox:
  CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,

  marginBottom: 12,
  padding: 11,

  borderRadius: 14,
  background: "#eff6ff",
  color: "#1d4ed8",

  border:
    "1px solid #bfdbfe",

  fontWeight: 900,
};

const verificationResultsList:
  CSSProperties = {
  display: "grid",
  gap: 14,
};

const verificationCard:
  CSSProperties = {
  background: "white",

  border:
    "1px solid #e2e8f0",

  borderRadius: 22,
  padding: 16,

  boxShadow:
    "0 8px 18px rgba(15,23,42,.04)",
};

const verificationCardTop:
  CSSProperties = {
  display: "flex",

  justifyContent:
    "space-between",

  gap: 12,
  flexWrap: "wrap",
};

const verificationTitle:
  CSSProperties = {
  margin: 0,

  fontFamily:
    "var(--font-almarai), sans-serif",
};

const verificationBadges:
  CSSProperties = {
  display: "flex",

  alignItems:
    "flex-start",

  gap: 7,
  flexWrap: "wrap",
};

const activePositionBadge:
  CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  borderRadius: 999,

  padding:
    "7px 10px",

  fontWeight: 900,
};

const overduePositionBadge:
  CSSProperties = {
  display: "inline-block",
  background: "#fef3c7",
  color: "#92400e",
  borderRadius: 999,

  padding:
    "7px 10px",

  fontWeight: 900,
};

const defaultPositionBadge:
  CSSProperties = {
  display: "inline-block",
  background: "#fee2e2",
  color: "#991b1b",
  borderRadius: 999,

  padding:
    "7px 10px",

  fontWeight: 900,
};

const supportOverrideBadge:
  CSSProperties = {
  display: "inline-block",
  background: "#ede9fe",
  color: "#5b21b6",
  borderRadius: 999,

  padding:
    "7px 10px",

  fontWeight: 900,
};

const automaticModeBadge:
  CSSProperties = {
  display: "inline-block",
  background: "#f1f5f9",
  color: "#475569",
  borderRadius: 999,

  padding:
    "7px 10px",

  fontWeight: 900,
};

const verificationInfoGrid:
  CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit,minmax(160px,1fr))",

  gap: 10,
  marginTop: 14,
  marginBottom: 14,
};

const verificationInfoItem:
  CSSProperties = {
  background: "#f8fafc",

  border:
    "1px solid #e2e8f0",

  borderRadius: 14,
  padding: 11,
  display: "grid",
  gap: 5,
};

const verificationInfoLabel:
  CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 800,
};

const verificationInfoValue:
  CSSProperties = {
  color: "#0f172a",
  wordBreak: "break-word",
};

const overrideDetailsBox:
  CSSProperties = {
  display: "grid",
  gap: 7,
  padding: 12,
  marginBottom: 12,
  borderRadius: 15,
  background: "#f5f3ff",

  border:
    "1px solid #ddd6fe",

  color: "#4c1d95",
};

const defaultDetailsBox:
  CSSProperties = {
  display: "grid",
  gap: 7,
  padding: 12,
  marginBottom: 12,
  borderRadius: 15,
  background: "#fff7ed",

  border:
    "1px solid #fed7aa",

  color: "#9a3412",
};

const verificationEditorBox:
  CSSProperties = {
  marginTop: 14,
  background: "#f8fafc",

  border:
    "1px solid #bfdbfe",

  borderRadius: 18,
  padding: 14,
};

const modalOverlay:
  CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  padding: 16,

  background:
    "rgba(15,23,42,.58)",

  backdropFilter:
    "blur(5px)",
};

const modalCard:
  CSSProperties = {
  width: "min(100%, 460px)",
  maxHeight: "90vh",
  overflowY: "auto",

  background: "white",

  border:
    "1px solid #e2e8f0",

  borderRadius: 22,
  padding: 20,

  boxShadow:
    "0 24px 70px rgba(15,23,42,.30)",
};

const modalTitle:
  CSSProperties = {
  margin: "0 0 10px",

  fontFamily:
    "var(--font-almarai), sans-serif",

  color: "#0f172a",
};

const modalText:
  CSSProperties = {
  margin: "0 0 16px",
  color: "#475569",
  lineHeight: 1.9,
};

const modalButtonsRow:
  CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 16,
};
