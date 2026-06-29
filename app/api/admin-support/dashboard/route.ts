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

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const DEFAULT_LOGS_PAGE_SIZE = 50;
const MAX_LOGS_PAGE_SIZE = 100;

/*
 * يجب أن تتطابق هذه القيمة مع قيد role
 * داخل جدول finance_branch_users.
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

function noStoreHeaders(): Record<
  string,
  string
> {
  return {
    "Cache-Control":
      "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",

    Pragma: "no-cache",
    Expires: "0",

    "X-Content-Type-Options":
      "nosniff",

    "Referrer-Policy":
      "no-referrer",

    "X-Frame-Options":
      "DENY",

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

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(
      parsed
    ) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum
  );
}

function getPagination(
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
      Number.MAX_SAFE_INTEGER
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
  requestedSection:
    DashboardSection,

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
    new Map<
      string,
      string[]
    >();

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

    const branchesPagination =
      getPagination(
        request,
        "branches_page",
        "branches_page_size",
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );

    const managersPagination =
      getPagination(
        request,
        "managers_page",
        "managers_page_size",
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );

    const supportUsersPagination =
      getPagination(
        request,
        "support_users_page",
        "support_users_page_size",
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );

    const logsPagination =
      getPagination(
        request,
        "logs_page",
        "logs_page_size",
        DEFAULT_LOGS_PAGE_SIZE,
        MAX_LOGS_PAGE_SIZE
      );

    let branches: unknown[] = [];
    let branchManagers: unknown[] = [];
    let supportUsers: unknown[] = [];
    let logs: unknown[] = [];

    let branchesCount = 0;
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
       * مستخدم يملك صلاحية الدخول للفروع فقط
       * يحصل على الحد الأدنى اللازم للدخول.
       */
      const branchSelect =
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
              notes,
              created_at
            `
          : `
              id,
              branch_name,
              branch_slug,
              organization_name,
              is_active
            `;

      const branchesPromise =
        supabaseAdmin
          .from(
            "finance_branches"
          )
          .select(
            branchSelect,
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
            branchesPagination.from,
            branchesPagination.to
          );

      /*
       * لا تُرسل قائمة مدراء الفروع
       * إلا لمن يملك صلاحية إدارة الفروع.
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
                  finance_branches (
                    branch_name,
                    branch_slug,
                    organization_name
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
        managersResult,
      ] = await Promise.all([
        branchesPromise,
        managersPromise,
      ]);

      if (
        branchesResult.error
      ) {
        console.error(
          "Dashboard branches load failed:",
          {
            code:
              branchesResult.error
                .code,

            message:
              branchesResult.error
                .message,

            details:
              branchesResult.error
                .details,

            hint:
              branchesResult.error
                .hint,
          }
        );

        return createErrorResponse(
          "تعذر تحميل بيانات الفروع",
          500
        );
      }

      branches =
        branchesResult.data ?? [];

      branchesCount =
        branchesResult.count ?? 0;

      if (
        canManageBranches &&
        managersResult
      ) {
        if (
          managersResult.error
        ) {
          console.error(
            "Dashboard managers load failed:",
            {
              code:
                managersResult.error
                  .code,

              message:
                managersResult.error
                  .message,

              details:
                managersResult.error
                  .details,

              hint:
                managersResult.error
                  .hint,
            }
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
        console.error(
          "Dashboard support users load failed:",
          {
            code:
              usersResult.error.code,

            message:
              usersResult.error.message,

            details:
              usersResult.error.details,

            hint:
              usersResult.error.hint,
          }
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
          console.error(
            "Dashboard support permissions load failed:",
            {
              code:
                permissionsResult
                  .error.code,

              message:
                permissionsResult
                  .error.message,

              details:
                permissionsResult
                  .error.details,

              hint:
                permissionsResult
                  .error.hint,
            }
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
        console.error(
          "Dashboard logs load failed:",
          {
            code:
              logsResult.error.code,

            message:
              logsResult.error
                .message,

            details:
              logsResult.error
                .details,

            hint:
              logsResult.error.hint,
          }
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
