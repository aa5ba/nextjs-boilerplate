import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  cleanText,
  createErrorResponse,
  createResponse,
  getInvestorForSession,
  parsePage,
  type RouteContext,
  UUID_PATTERN,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 25;

type ContractRow = {
  id: string;
  contract_number: number | string | null;
  customer_name: string | null;
  contract_type: string | null;
  debt_amount: number | string | null;
  paid_amount: number | string | null;
  remaining_amount: number | string | null;
  contract_status: string | null;
  contract_date_gregorian: string | null;
  created_at: string | null;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { id: investorId } =
      await context.params;

    if (
      !UUID_PATTERN.test(
        investorId
      )
    ) {
      return createErrorResponse(
        "معرف المستثمر غير صحيح",
        400,
        "INVALID_INVESTOR_ID"
      );
    }

    const url = new URL(
      request.url
    );

    const branch =
      cleanText(
        url.searchParams.get(
          "branch"
        )
      ).toLowerCase();

    if (!branch) {
      return createErrorResponse(
        "تعذر تحديد الفرع",
        400,
        "BRANCH_REQUIRED"
      );
    }

    const session =
      await requireFinanceBranchSession({
        requestedBranchSlug:
          branch,
        requiredPermission:
          "view_investor_contracts_wallet",
      });

    const investor =
      await getInvestorForSession(
        session,
        investorId
      );

    if (!investor) {
      return createErrorResponse(
        "المستثمر غير موجود أو لا يتبع هذا الفرع",
        404,
        "INVESTOR_NOT_FOUND"
      );
    }

    const page = parsePage(
      url.searchParams.get("page")
    );
    const from =
      (page - 1) * ITEMS_PER_PAGE;
    const to =
      from + ITEMS_PER_PAGE - 1;

    const { data, error, count } =
      await supabaseAdmin
        .from("finance_contracts")
        .select(
          `
            id,
            contract_number,
            customer_name,
            contract_type,
            debt_amount,
            paid_amount,
            remaining_amount,
            contract_status,
            contract_date_gregorian,
            created_at
          `,
          {
            count: "exact",
          }
        )
        .eq("branch_id", session.branchId)
        .eq("investor_id", investorId)
        .or(
          "is_archived.is.null,is_archived.eq.false"
        )
        .order("created_at", {
          ascending: false,
        })
        .range(from, to);

    if (error) {
      return createErrorResponse(
        "تعذر تحميل محفظة العقود",
        500,
        "CONTRACTS_WALLET_FAILED"
      );
    }

    return createResponse({
      ok: true,
      investor,
      page,
      pageSize: ITEMS_PER_PAGE,
      total: count || 0,
      contracts:
        ((data || []) as ContractRow[]).map(
          (contract) => ({
            id: contract.id,
            contractNumber:
              contract.contract_number,
            customerName:
              contract.customer_name,
            contractType:
              contract.contract_type,
            debtAmount:
              Number(
                contract.debt_amount ||
                  0
              ),
            paidAmount:
              Number(
                contract.paid_amount ||
                  0
              ),
            remainingAmount:
              Number(
                contract.remaining_amount ||
                  0
              ),
            contractStatus:
              contract.contract_status,
            contractDateGregorian:
              contract.contract_date_gregorian,
            createdAt:
              contract.created_at,
          })
        ),
    });
  } catch (error) {
    if (
      isFinanceBranchSessionError(
        error
      )
    ) {
      return createErrorResponse(
        error.message,
        error.status,
        error.code
      );
    }

    console.error(
      "Investor contracts wallet error:",
      error
    );

    return createErrorResponse(
      "تعذر تحميل محفظة العقود",
      500,
      "CONTRACTS_WALLET_FAILED"
    );
  }
}
