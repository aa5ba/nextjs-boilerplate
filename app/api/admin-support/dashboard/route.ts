import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  adminSupportHasPermission,
  verifyAdminSupportRequest,
} from "@/lib/adminSupportAuth";
import {
  ADMIN_SUPPORT_COOKIE_NAME,
} from "@/lib/adminSupportSession";

type PermissionRow = {
  user_id: string;
  permission_key: string;
};

function createErrorResponse(
  message: string,
  status: number,
  clearCookie = false
) {
  const response = NextResponse.json(
    {
      ok: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  if (clearCookie) {
    response.cookies.set(
      ADMIN_SUPPORT_COOKIE_NAME,
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      }
    );
  }

  return response;
}

export async function GET() {
  try {
    const auth = await verifyAdminSupportRequest();

    if (!auth.ok) {
      return createErrorResponse(
        auth.message,
        auth.status,
        auth.clearCookie === true
      );
    }

    const currentUser = auth.user;

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

    const canReadBranches =
      canManageBranches || canEnterBranches;

    let branches: unknown[] = [];
    let branchManagers: unknown[] = [];
    let supportUsers: unknown[] = [];
    let logs: unknown[] = [];

    if (canReadBranches) {
      const [
        branchesResult,
        managersResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("finance_branches")
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
            notes,
            created_at
          `
          )
          .order("created_at", {
            ascending: false,
          }),

        supabaseAdmin
          .from("finance_branch_users")
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
          `
          )
          .eq("role", "branch_manager")
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (branchesResult.error) {
        console.error(
          "Dashboard branches load failed:",
          branchesResult.error
        );

        return createErrorResponse(
          "تعذر تحميل بيانات الفروع",
          500
        );
      }

      if (managersResult.error) {
        console.error(
          "Dashboard managers load failed:",
          managersResult.error
        );

        return createErrorResponse(
          "تعذر تحميل مدراء الفروع",
          500
        );
      }

      branches = branchesResult.data || [];
      branchManagers =
        managersResult.data || [];
    }

    if (canManageSupportUsers) {
      const [
        usersResult,
        permissionsResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("admin_support_users")
          .select(
            `
            id,
            full_name,
            username,
            role,
            is_active,
            created_at
          `
          )
          .order("created_at", {
            ascending: false,
          }),

        supabaseAdmin
          .from(
            "admin_support_user_permissions"
          )
          .select(
            "user_id, permission_key"
          ),
      ]);

      if (usersResult.error) {
        console.error(
          "Dashboard support users load failed:",
          usersResult.error
        );

        return createErrorResponse(
          "تعذر تحميل مستخدمي الدعم",
          500
        );
      }

      if (permissionsResult.error) {
        console.error(
          "Dashboard support permissions load failed:",
          permissionsResult.error
        );

        return createErrorResponse(
          "تعذر تحميل صلاحيات مستخدمي الدعم",
          500
        );
      }

      const permissionRows = (
        permissionsResult.data || []
      ) as PermissionRow[];

      supportUsers = (
        usersResult.data || []
      ).map((user) => ({
        ...user,
        permissions: permissionRows
          .filter(
            (permission) =>
              permission.user_id === user.id
          )
          .map(
            (permission) =>
              permission.permission_key
          ),
      }));
    }

    if (canViewLogs) {
      const logsResult = await supabaseAdmin
        .from("admin_support_logs")
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
        `
        )
        .order("created_at", {
          ascending: false,
        })
        .limit(50);

      if (logsResult.error) {
        console.error(
          "Dashboard logs load failed:",
          logsResult.error
        );

        return createErrorResponse(
          "تعذر تحميل سجل العمليات",
          500
        );
      }

      logs = logsResult.data || [];
    }

    return NextResponse.json(
      {
        ok: true,

        user: {
          id: currentUser.id,
          full_name: currentUser.fullName,
          username: currentUser.username,
          role: currentUser.role,
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
          view_logs: canViewLogs,
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
        },

        branches,
        branch_managers: branchManagers,
        support_users: supportUsers,
        logs,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Admin support dashboard route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء تحميل لوحة الدعم",
      500
    );
  }
}
