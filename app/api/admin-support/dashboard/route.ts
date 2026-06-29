import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  adminSupportHasPermission,
  verifyAdminSupportRequest,
} from "@/lib/adminSupportAuth";
import { ADMIN_SUPPORT_COOKIE_NAME } from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BRANCHES_PAGE_SIZE = 15;
const MANAGERS_PAGE_SIZE = 25;
const SUPPORT_USERS_PAGE_SIZE = 25;
const LOGS_PAGE_SIZE = 50;

const MAX_PAGE_NUMBER = 1_000_000;
const MAX_MANAGERS_PAGE_SIZE = 100;
const MAX_SUPPORT_USERS_PAGE_SIZE = 100;
const MAX_LOGS_PAGE_SIZE = 100;

/*
 * يجب أن تتطابق هذه القيمة مع قيمة role الفعلية
 * لمدير الفرع داخل جدول finance_branch_users.
 */
const BRANCH_MANAGER_ROLE = "مدير فرع";

type PermissionRow = {
  user_id: string;
  permission_key: string;
};

type SupportUserRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type DashboardSection =
  | "all"
  | "branches"
  | "support_users"
  | "logs";

type PaginationInput = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
};

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control":
      "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    Vary: "Cookie",
  };
}

function createErrorResponse(
  message: string,
  status: number,
  clearCookie = false
): NextResponse {
  const response =
    NextResponse.json(
      {
        ok: false,
        message,
      },
      {
        status,
        headers:
          noStoreHeaders(),
      }
    );

  if (clearCookie) {
    response.cookies.set(
      ADMIN_SUPPORT_COOKIE_NAME,
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        priority: "high",
      }
    );
  }

  return response;
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed =
    Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum
  );
}

function getFixedPagination(
  request: NextRequest,
  pageKey: string,
  pageSize: number
): PaginationInput {
  const page =
    parsePositiveInteger(
      request.nextUrl.searchParams.get(
        pageKey
      ),
      1,
      MAX_PAGE_NUMBER
    );

  const from =
    (page - 1) * pageSize;

  const to =
    from + pageSize - 1;

  return {
    page,
    pageSize,
    from,
    to,
  };
}

function getFlexiblePagination(
  request: NextRequest,
  pageKey: string,
  pageSizeKey: string,
  defaultPageSize: number,
  maximumPageSize: number
): PaginationInput {
  const page =
    parsePositiveInteger(
      request.nextUrl.searchParams.get(
        pageKey
      ),
      1,
      MAX_PAGE_NUMBER
    );

  const pageSize =
    parsePositiveInteger(
      request.nextUrl.searchParams.get(
        pageSizeKey
      ),
      defaultPageSize,
      maximumPageSize
    );

  const from =
    (page - 1) * pageSize;

  const to =
    from + pageSize - 1;

  return {
    page,
    pageSize,
    from,
    to,
  };
}

function getRequestedSection(
  request: NextRequest
): DashboardSection {
  const value =
    request.nextUrl.searchParams
      .get("section")
      ?.trim()
      .toLowerCase();

  if (
    value === "branches" ||
    value === "support_users" ||
    value === "logs"
  ) {
    return value;
  }

  return "all";
}

function shouldLoadSection(
  requestedSection: DashboardSection,
  section: Exclude<
    DashboardSection,
    "all"
  >
): boolean {
  return (
    requestedSection === "all" ||
    requestedSection === section
  );
}

function createPermissionsMap(
  rows: PermissionRow[]
): Map<string, string[]> {
  const map =
    new Map<string, string[]>();

  for (const row of rows) {
    if (
      typeof row.user_id !==
        "string" ||
      typeof row.permission_key !==
        "string"
    ) {
      continue;
    }

    const userId =
      row.user_id.trim();

    const permissionKey =
      row.permission_key.trim();

    if (
      !userId ||
      !permissionKey
    ) {
      continue;
    }

    const current =
      map.get(userId) ?? [];

    if (
      !current.includes(
        permissionKey
      )
    ) {
      current.push(
        permissionKey
      );
    }

    map.set(
      userId,
      current
    );
  }

  return map;
}

function calculateTotalPages(
  total: number,
  pageSize: number
): number {
  if (
    total <= 0 ||
    pageSize <= 0
  ) {
    return 0;
  }

  return Math.ceil(
    total / pageSize
  );
}

function logSupabaseError(
  label: string,
  error: {
    code?: string | null;
    message?: string | null;
    details?: string | null;
    hint?: string | null;
  }
): void {
  console.error(
    label,
    {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    }
  );
}

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const auth =
      await verifyAdminSupportRequest();

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    const currentUser =
      auth.user;

    const canManageBranches =
      adminSupportHasPermission(
        currentUser,
        "manage_branches"
      );

    const canEnterBranches =
      adminSupportHasPermission(
        currentUser,
        "impersonate_branch"
      );

    const canManageSupportUsers =
      adminSupportHasPermission(
        currentUser,
        "manage_support_users"
      );

    const canViewLogs =
      adminSupportHasPermission(
        currentUser,
        "view_logs"
      );

    const canManageVerificationResults =
      adminSupportHasPermission(
        currentUser,
        "manage_verification_results"
      );

    const canReadBranches =
      canManageBranches ||
      canEnterBranches;

    const requestedSection =
      getRequestedSection(
        request
      );

    /*
     * الفروع الحالية والمحذوفة:
     * حجم الصفحة ثابت 15 ولا يعتمد على القيمة القادمة
     * من الواجهة.
     */
    const branchesPagination =
      getFixedPagination(
        request,
        "branches_page",
        BRANCHES_PAGE_SIZE
      );

    const deletedBranchesPagination =
      getFixedPagination(
        request,
        "deleted_branches_page",
        BRANCHES_PAGE_SIZE
      );

    const managersPagination =
      getFlexiblePagination(
        request,
        "managers_page",
        "managers_page_size",
        MANAGERS_PAGE_SIZE,
        MAX_MANAGERS_PAGE_SIZE
      );

    const supportUsersPagination =
      getFlexiblePagination(
        request,
        "support_users_page",
        "support_users_page_size",
        SUPPORT_USERS_PAGE_SIZE,
        MAX_SUPPORT_USERS_PAGE_SIZE
      );

    const logsPagination =
      getFlexiblePagination(
        request,
        "logs_page",
        "logs_page_size",
        LOGS_PAGE_SIZE,
        MAX_LOGS_PAGE_SIZE
      );

    let branches: unknown[] = [];
    let deletedBranches: unknown[] = [];
    let branchManagers: unknown[] = [];
    let supportUsers: unknown[] = [];
    let logs: unknown[] = [];

    let branchesCount = 0;
    let deletedBranchesCount = 0;
    let branchManagersCount = 0;
    let supportUsersCount = 0;
    let logsCount = 0;

    if (
      shouldLoadSection(
        requestedSection,
        "branches"
      ) &&
      canReadBranches
    ) {
      /*
       * مستخدم الدخول للفروع فقط يحصل على الحد
       * الأدنى اللازم. أما مدير الفروع فيحصل
       * على جميع معلومات الإدارة.
       */
      const activeBranchSelect =
        canManageBranches
          ? `
              id,
              branch_name,
              branch_slug,
              organization_name,
              city,
              commercial_record,
              phone,
              is_active,
              is_deleted,
              notes,
              created_at
            `
          : `
              id,
              branch_name,
              branch_slug,
              organization_name,
              is_active,
              is_deleted,
              created_at
            `;

      const branchesPromise =
        supabaseAdmin
          .from(
            "finance_branches"
          )
          .select(
            activeBranchSelect,
            {
              count: "exact",
            }
          )
          .eq(
            "is_deleted",
            false
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .range(
            branchesPagination.from,
            branchesPagination.to
          );

      const deletedBranchesPromise =
        canManageBranches
          ? supabaseAdmin
              .from(
                "finance_branches"
              )
              .select(
                `
                  id,
                  branch_name,
                  branch_slug,
                  organization_name,
                  city,
                  commercial_record,
                  phone,
                  is_active,
                  is_deleted,
                  notes,
                  created_at,
                  deleted_at,
                  deleted_by_user_id,
                  deleted_by_user_name
                `,
                {
                  count: "exact",
                }
              )
              .eq(
                "is_deleted",
                true
              )
              .order(
                "deleted_at",
                {
                  ascending: false,
                  nullsFirst: false,
                }
              )
              .range(
                deletedBranchesPagination.from,
                deletedBranchesPagination.to
              )
          : null;

      /*
       * استخدام !inner يضمن استبعاد مديري
       * الفروع المحذوفة من النتائج والعدد.
       */
      const managersPromise =
        canManageBranches
          ? supabaseAdmin
              .from(
                "finance_branch_users"
              )
              .select(
                `
                  id,
                  branch_id,
                  full_name,
                  username,
                  role,
                  is_active,
                  created_at,
                  finance_branches!inner (
                    branch_name,
                    branch_slug,
                    organization_name,
                    is_deleted
                  )
                `,
                {
                  count: "exact",
                }
              )
              .eq(
                "role",
                BRANCH_MANAGER_ROLE
              )
              .eq(
                "finance_branches.is_deleted",
                false
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              )
              .range(
                managersPagination.from,
                managersPagination.to
              )
          : null;

      const [
        branchesResult,
        deletedBranchesResult,
        managersResult,
      ] = await Promise.all([
        branchesPromise,
        deletedBranchesPromise,
        managersPromise,
      ]);

      if (
        branchesResult.error
      ) {
        logSupabaseError(
          "Dashboard active branches load failed:",
          branchesResult.error
        );

        return createErrorResponse(
          "تعذر تحميل قائمة الفروع",
          500
        );
      }

      branches =
        branchesResult.data ?? [];

      branchesCount =
        branchesResult.count ?? 0;

      if (
        canManageBranches &&
        deletedBranchesResult
      ) {
        if (
          deletedBranchesResult.error
        ) {
          logSupabaseError(
            "Dashboard deleted branches load failed:",
            deletedBranchesResult.error
          );

          return createErrorResponse(
            "تعذر تحميل قائمة الفروع المحذوفة",
            500
          );
        }

        deletedBranches =
          deletedBranchesResult.data ??
          [];

        deletedBranchesCount =
          deletedBranchesResult.count ??
          0;
      }

      if (
        canManageBranches &&
        managersResult
      ) {
        if (
          managersResult.error
        ) {
          logSupabaseError(
            "Dashboard managers load failed:",
            managersResult.error
          );

          return createErrorResponse(
            "تعذر تحميل مدراء الفروع",
            500
          );
        }

        branchManagers =
          managersResult.data ?? [];

        branchManagersCount =
          managersResult.count ?? 0;
      }
    }

    if (
      shouldLoadSection(
        requestedSection,
        "support_users"
      ) &&
      canManageSupportUsers
    ) {
      const usersResult =
        await supabaseAdmin
          .from(
            "admin_support_users"
          )
          .select(
            `
              id,
              full_name,
              username,
              role,
              is_active,
              created_at
            `,
            {
              count: "exact",
            }
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .range(
            supportUsersPagination.from,
            supportUsersPagination.to
          );

      if (
        usersResult.error
      ) {
        logSupabaseError(
          "Dashboard support users load failed:",
          usersResult.error
        );

        return createErrorResponse(
          "تعذر تحميل مستخدمي الدعم",
          500
        );
      }

      const users =
        (usersResult.data ??
          []) as SupportUserRow[];

      supportUsersCount =
        usersResult.count ?? 0;

      const userIds =
        users
          .map(
            (user) => user.id
          )
          .filter(
            (
              userId
            ): userId is string =>
              typeof userId ===
                "string" &&
              userId.length > 0
          );

      let permissionRows:
        PermissionRow[] = [];

      if (
        userIds.length > 0
      ) {
        const permissionsResult =
          await supabaseAdmin
            .from(
              "admin_support_user_permissions"
            )
            .select(
              "user_id, permission_key"
            )
            .in(
              "user_id",
              userIds
            );

        if (
          permissionsResult.error
        ) {
          logSupabaseError(
            "Dashboard support permissions load failed:",
            permissionsResult.error
          );

          return createErrorResponse(
            "تعذر تحميل صلاحيات مستخدمي الدعم",
            500
          );
        }

        permissionRows =
          (permissionsResult.data ??
            []) as PermissionRow[];
      }

      const permissionsMap =
        createPermissionsMap(
          permissionRows
        );

      supportUsers =
        users.map(
          (user) => ({
            ...user,

            permissions:
              permissionsMap.get(
                user.id
              ) ?? [],
          })
        );
    }

    if (
      shouldLoadSection(
        requestedSection,
        "logs"
      ) &&
      canViewLogs
    ) {
      const logsResult =
        await supabaseAdmin
          .from(
            "admin_support_logs"
          )
          .select(
            `
              id,
              user_id,
              user_name,
              action,
              target_type,
              target_id,
              details,
              created_at
            `,
            {
              count: "exact",
            }
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .range(
            logsPagination.from,
            logsPagination.to
          );

      if (
        logsResult.error
      ) {
        logSupabaseError(
          "Dashboard logs load failed:",
          logsResult.error
        );

        return createErrorResponse(
          "تعذر تحميل سجل العمليات",
          500
        );
      }

      logs =
        logsResult.data ?? [];

      logsCount =
        logsResult.count ?? 0;
    }

    return NextResponse.json(
      {
        ok: true,

        user: {
          id:
            currentUser.id,

          full_name:
            currentUser.fullName,

          username:
            currentUser.username,

          role:
            currentUser.role,

          permissions:
            currentUser.permissions,
        },

        access: {
          manage_branches:
            canManageBranches,

          impersonate_branch:
            canEnterBranches,

          manage_support_users:
            canManageSupportUsers,

          view_logs:
            canViewLogs,

          system_settings:
            adminSupportHasPermission(
              currentUser,
              "system_settings"
            ),

          backup_restore:
            adminSupportHasPermission(
              currentUser,
              "backup_restore"
            ),

          manage_verification_results:
            canManageVerificationResults,
        },

        requested_section:
          requestedSection,

        branches,

        deleted_branches:
          deletedBranches,

        branch_managers:
          branchManagers,

        support_users:
          supportUsers,

        logs,

        pagination: {
          branches: {
            page:
              branchesPagination.page,

            page_size:
              branchesPagination.pageSize,

            total:
              branchesCount,

            total_pages:
              calculateTotalPages(
                branchesCount,
                branchesPagination.pageSize
              ),
          },

          deleted_branches: {
            page:
              deletedBranchesPagination.page,

            page_size:
              deletedBranchesPagination.pageSize,

            total:
              deletedBranchesCount,

            total_pages:
              calculateTotalPages(
                deletedBranchesCount,
                deletedBranchesPagination.pageSize
              ),
          },

          branch_managers: {
            page:
              managersPagination.page,

            page_size:
              managersPagination.pageSize,

            total:
              branchManagersCount,

            total_pages:
              calculateTotalPages(
                branchManagersCount,
                managersPagination.pageSize
              ),
          },

          support_users: {
            page:
              supportUsersPagination.page,

            page_size:
              supportUsersPagination.pageSize,

            total:
              supportUsersCount,

            total_pages:
              calculateTotalPages(
                supportUsersCount,
                supportUsersPagination.pageSize
              ),
          },

          logs: {
            page:
              logsPagination.page,

            page_size:
              logsPagination.pageSize,

            total:
              logsCount,

            total_pages:
              calculateTotalPages(
                logsCount,
                logsPagination.pageSize
              ),
          },
        },
      },
      {
        status: 200,
        headers:
          noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Admin support dashboard route error:",
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

    return createErrorResponse(
      "حدث خطأ أثناء تحميل لوحة الدعم",
      500
    );
  }
}
