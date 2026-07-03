import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  FINANCE_BRANCH_SESSION_COOKIE_NAME,
  financeBranchSessionDeleteCookieOptions,
} from "@/lib/financeBranchSession";
import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATABASE_PAGE_SIZE = 1000;
const MAX_ACTIVITY_RECORDS = 10_000;
const MAX_INVESTOR_RECORDS = 5_000;
const MAX_CONTRACT_RECORDS = 20_000;
const MAX_ARCHIVED_CUSTOMER_RECORDS = 20_000;

type ActivityRow = {
  id: string;
  activity_type: string | null;
  customer_name: string | null;
  status: string | null;
  employee_name: string | null;
  created_at: string;
  is_archived?: boolean | null;
  customer_is_archived?: boolean | null;
};

type InvestorRow = {
  id: string;
  branch_id: string;
  investor_name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  is_primary: boolean | null;
  national_id: string | null;
  created_at: string;
};

type ContractRow = {
  id: string;
  contract_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  investor_id: string | null;
  investor_name: string | null;
  product_name: string | null;
  product_quantity: number | null;
  debt_amount: number | null;
  payment_amount: number | null;
  installment_amount: number | null;
  payment_type: string | null;
  payment_due_date: string | null;
  contract_status: string | null;
  paid_amount: number | null;
  remaining_amount: number | null;
  closed_at: string | null;
  created_at: string;
  contract_issue_date_gregorian: string | null;
  contract_date_gregorian: string | null;
  is_archived?: boolean | null;
};

type ArchivedCustomerRow = {
  full_name: string | null;
};

type SupabaseErrorShape = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBranchSlug(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function normalizeCustomerName(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function createJsonResponse(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function createErrorResponse(
  message: string,
  status: number,
  code: string
) {
  return createJsonResponse(
    {
      ok: false,
      code,
      message,
    },
    status
  );
}

function logDatabaseError(
  label: string,
  error: SupabaseErrorShape
) {
  console.error(label, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

async function loadActivities(
  branchId: string
): Promise<ActivityRow[]> {
  const rows: ActivityRow[] = [];

  for (
    let from = 0;
    from < MAX_ACTIVITY_RECORDS;
    from += DATABASE_PAGE_SIZE
  ) {
    const to = Math.min(
      from + DATABASE_PAGE_SIZE - 1,
      MAX_ACTIVITY_RECORDS - 1
    );

    const { data, error } = await supabaseAdmin
      .from("finance_activity_logs")
      .select(
        `
          id,
          activity_type,
          customer_name,
          status,
          employee_name,
          created_at
        `
      )
      .eq("branch_id", branchId)
      .order("created_at", {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      logDatabaseError(
        "Workflow activities query failed:",
        error
      );

      throw new Error("ACTIVITIES_QUERY_FAILED");
    }

    const pageRows = (data || []) as ActivityRow[];

    rows.push(...pageRows);

    if (pageRows.length < DATABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function loadArchivedCustomerNames(
  branchId: string
): Promise<Set<string>> {
  const names = new Set<string>();

  for (
    let from = 0;
    from < MAX_ARCHIVED_CUSTOMER_RECORDS;
    from += DATABASE_PAGE_SIZE
  ) {
    const to = Math.min(
      from + DATABASE_PAGE_SIZE - 1,
      MAX_ARCHIVED_CUSTOMER_RECORDS - 1
    );

    const { data, error } = await supabaseAdmin
      .from("finance_customers")
      .select("full_name")
      .eq("branch_id", branchId)
      .eq("is_archived", true)
      .order("created_at", {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      logDatabaseError(
        "Workflow archived customers query failed:",
        error
      );

      throw new Error("ARCHIVED_CUSTOMERS_QUERY_FAILED");
    }

    const pageRows = (data || []) as ArchivedCustomerRow[];

    pageRows.forEach((customer) => {
      const normalizedName = normalizeCustomerName(
        customer.full_name
      );

      if (normalizedName) {
        names.add(normalizedName);
      }
    });

    if (pageRows.length < DATABASE_PAGE_SIZE) {
      break;
    }
  }

  return names;
}

async function loadInvestors(
  branchId: string
): Promise<InvestorRow[]> {
  const rows: InvestorRow[] = [];

  for (
    let from = 0;
    from < MAX_INVESTOR_RECORDS;
    from += DATABASE_PAGE_SIZE
  ) {
    const to = Math.min(
      from + DATABASE_PAGE_SIZE - 1,
      MAX_INVESTOR_RECORDS - 1
    );

    const { data, error } = await supabaseAdmin
      .from("finance_investors")
      .select(
        `
          id,
          branch_id,
          investor_name,
          phone,
          notes,
          is_active,
          is_primary,
          national_id,
          created_at
        `
      )
      .eq("branch_id", branchId)
      .order("is_primary", {
        ascending: false,
      })
      .order("created_at", {
        ascending: true,
      })
      .range(from, to);

    if (error) {
      logDatabaseError(
        "Workflow investors query failed:",
        error
      );

      throw new Error("INVESTORS_QUERY_FAILED");
    }

    const pageRows = (data || []) as InvestorRow[];

    rows.push(...pageRows);

    if (pageRows.length < DATABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function loadContracts(
  branchId: string
): Promise<ContractRow[]> {
  const rows: ContractRow[] = [];

  for (
    let from = 0;
    from < MAX_CONTRACT_RECORDS;
    from += DATABASE_PAGE_SIZE
  ) {
    const to = Math.min(
      from + DATABASE_PAGE_SIZE - 1,
      MAX_CONTRACT_RECORDS - 1
    );

    const { data, error } = await supabaseAdmin
      .from("finance_contracts")
      .select(
        `
          id,
          contract_number,
          customer_id,
          customer_name,
          customer_phone,
          investor_id,
          investor_name,
          product_name,
          product_quantity,
          debt_amount,
          payment_amount,
          installment_amount,
          payment_type,
          payment_due_date,
          contract_status,
          paid_amount,
          remaining_amount,
          closed_at,
          created_at,
          contract_issue_date_gregorian,
          contract_date_gregorian,
          is_archived
        `
      )
      .eq("branch_id", branchId)
      .or("is_archived.is.null,is_archived.eq.false")
      .order("created_at", {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      logDatabaseError(
        "Workflow contracts query failed:",
        error
      );

      throw new Error("CONTRACTS_QUERY_FAILED");
    }

    const pageRows = (data || []) as ContractRow[];

    rows.push(...pageRows);

    if (pageRows.length < DATABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function clearInvalidSessionCookie(
  response: NextResponse
) {
  response.cookies.set(
    FINANCE_BRANCH_SESSION_COOKIE_NAME,
    "",
    financeBranchSessionDeleteCookieOptions
  );
}

export async function GET(request: NextRequest) {
  try {
    const requestedBranchSlug =
      normalizeBranchSlug(
        request.nextUrl.searchParams.get("branch")
      );

    if (!requestedBranchSlug) {
      return createErrorResponse(
        "مسار الفرع مطلوب",
        400,
        "BRANCH_REQUIRED"
      );
    }

    const session =
      await requireFinanceBranchSession({
        requestedBranchSlug,
      });

    let activities: ActivityRow[];
    let investors: InvestorRow[];
    let contracts: ContractRow[];
    let archivedCustomerNames: Set<string>;

    try {
      [
        activities,
        investors,
        contracts,
        archivedCustomerNames,
      ] = await Promise.all([
        loadActivities(session.branchId),
        loadInvestors(session.branchId),
        loadContracts(session.branchId),
        loadArchivedCustomerNames(
          session.branchId
        ),
      ]);
    } catch (error) {
      console.error(
        "Workflow data loading failed:",
        error
      );

      return createErrorResponse(
        "تعذر تحميل بيانات سير العمل",
        500,
        "WORKFLOW_DATA_LOAD_FAILED"
      );
    }

    const safeActivities = activities
      .map((activity) => {
        const normalizedCustomerName =
          normalizeCustomerName(
            activity.customer_name
          );

        const customerIsArchived = Boolean(
          normalizedCustomerName &&
            archivedCustomerNames.has(
              normalizedCustomerName
            )
        );

        return {
          ...activity,
          is_archived: false,
          customer_is_archived:
            customerIsArchived,
        };
      })
      .filter(
        (activity) =>
          activity.customer_is_archived !==
          true
      );

    return createJsonResponse(
      {
        ok: true,

        session: {
          expiresAt: session.expiresAt,
        },

        user: {
          id: session.user.id,
          fullName: session.user.fullName,
          username: session.user.username,
          role: session.user.role,
          permissions: session.user.permissions,
          investorId: session.user.investorId,
          themeKey: session.user.themeKey,
        },

        branch: {
          id: session.branch.id,
          slug: session.branch.slug,
          name: session.branch.name,
          organizationName:
            session.branch.organizationName,
        },

        data: {
          activities: safeActivities,
          investors,
          contracts,
        },

        limits: {
          activities: MAX_ACTIVITY_RECORDS,
          investors: MAX_INVESTOR_RECORDS,
          contracts: MAX_CONTRACT_RECORDS,
          archivedCustomers:
            MAX_ARCHIVED_CUSTOMER_RECORDS,
        },
      },
      200
    );
  } catch (error) {
    if (isFinanceBranchSessionError(error)) {
      const response = createErrorResponse(
        error.message,
        error.status,
        error.code
      );

      if (error.status === 401) {
        clearInvalidSessionCookie(response);
      }

      return response;
    }

    console.error(
      "Workflow route unexpected error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ غير متوقع أثناء تحميل سير العمل",
      500,
      "WORKFLOW_UNEXPECTED_ERROR"
    );
  }
}
