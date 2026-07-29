import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  cleanText,
  createErrorResponse,
  createResponse,
  getActorName,
  getInvestorForSession,
  mapWalletRpcError,
  parsePositiveAmount,
  readJsonBody,
  type RouteContext,
  UUID_PATTERN,
} from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DepositResult = {
  transaction_id?: unknown;
  wallet_id?: unknown;
  balance_before?: unknown;
  balance_after?: unknown;
};

function firstRow(
  data: unknown
): DepositResult | null {
  if (Array.isArray(data)) {
    return (
      (data[0] as DepositResult | undefined) ??
      null
    );
  }

  return data &&
    typeof data === "object"
    ? (data as DepositResult)
    : null;
}

export async function POST(
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

    const body =
      await readJsonBody(
        request
      );

    if (!body) {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400,
        "INVALID_BODY"
      );
    }

    const branch =
      cleanText(
        body.branch
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
          "deposit_investor_cash_wallet",
      });

    const amount =
      parsePositiveAmount(
        body.amount
      );

    if (amount === null) {
      return createErrorResponse(
        "أدخل مبلغًا صحيحًا",
        400,
        "INVALID_AMOUNT"
      );
    }

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

    if (
      investor.is_active !== true
    ) {
      return createErrorResponse(
        "المستثمر غير نشط",
        409,
        "INVESTOR_INACTIVE"
      );
    }

    const idempotencyKey =
      cleanText(
        body.idempotencyKey
      ) || null;

    const note =
      cleanText(body.note)
        .slice(0, 500) || null;

    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
      "deposit_investor_cash_wallet_secure_atomic",
      {
        p_branch_id:
          session.branchId,
        p_investor_id:
          investorId,
        p_actor_user_id:
          session.userId,
        p_actor_user_name:
          getActorName(session),
        p_amount: amount,
        p_note: note,
        p_idempotency_key:
          idempotencyKey,
      }
    );

    if (error) {
      const mapped =
        mapWalletRpcError(
          error.message || ""
        );

      return createErrorResponse(
        mapped.message,
        mapped.status,
        mapped.code
      );
    }

    const result = firstRow(data);

    if (!result) {
      return createErrorResponse(
        "تم تنفيذ العملية لكن تعذر قراءة النتيجة",
        500,
        "INVALID_RPC_RESULT"
      );
    }

    return createResponse({
      ok: true,
      transactionId:
        result.transaction_id ??
        null,
      walletId:
        result.wallet_id ?? null,
      balanceBefore:
        Number(
          result.balance_before ?? 0
        ),
      balanceAfter:
        Number(
          result.balance_after ?? 0
        ),
      message:
        "تمت إضافة الرصيد بنجاح",
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
      "Investor cash deposit error:",
      error
    );

    return createErrorResponse(
      "تعذر إضافة الرصيد",
      500,
      "CASH_DEPOSIT_FAILED"
    );
  }
}
