import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import {
  cleanText,
  createErrorResponse,
  createResponse,
  investorDuplicateMessage,
  normalizeDigits,
  readJsonBody,
  UUID_PATTERN,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getInvestor(
  branchId: string,
  investorId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("finance_investors")
    .select(
      "id, branch_id, investor_name, national_id, phone, notes, is_active"
    )
    .eq("id", investorId)
    .eq("branch_id", branchId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const { id: investorId } =
      await context.params;
    const body =
      await readJsonBody(request);

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

    if (!body) {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400,
        "INVALID_BODY"
      );
    }

    const branch =
      cleanText(body.branch).toLowerCase();
    const action = cleanText(body.action);

    if (!branch) {
      return createErrorResponse(
        "تعذر تحديد الفرع",
        400,
        "BRANCH_REQUIRED"
      );
    }

    if (
      action !== "update" &&
      action !== "toggle"
    ) {
      return createErrorResponse(
        "العملية المطلوبة غير صحيحة",
        400,
        "INVALID_ACTION"
      );
    }

    const session =
      await requireFinanceBranchSession({
        requestedBranchSlug:
          branch,
        requiredPermission:
          action === "update"
            ? "edit_investor"
            : "toggle_investor",
      });

    const currentInvestor =
      await getInvestor(
        session.branchId,
        investorId
      );

    if (!currentInvestor) {
      return createErrorResponse(
        "المستثمر غير موجود أو لا يتبع هذا الفرع",
        404,
        "INVESTOR_NOT_FOUND"
      );
    }

    if (action === "toggle") {
      if (
        typeof body.isActive !==
        "boolean"
      ) {
        return createErrorResponse(
          "حالة المستثمر غير صحيحة",
          400,
          "INVALID_STATUS"
        );
      }

      const {
        data: investor,
        error: updateError,
      } = await supabaseAdmin
        .from("finance_investors")
        .update({
          is_active: body.isActive,
        })
        .eq("id", investorId)
        .eq(
          "branch_id",
          session.branchId
        )
        .eq("is_archived", false)
        .select(
          "id, investor_name, national_id, phone, notes, is_active"
        )
        .maybeSingle();

      if (updateError || !investor) {
        throw new Error(
          updateError?.message ||
            "تعذر تعديل حالة المستثمر"
        );
      }

      return createResponse({
        ok: true,
        investor,
      });
    }

    const investorName =
      cleanText(body.investorName);
    const nationalId =
      normalizeDigits(body.nationalId);
    const phone =
      normalizeDigits(body.phone);
    const notes = cleanText(body.notes);

    if (!investorName) {
      return createErrorResponse(
        "أدخل اسم المستثمر",
        400,
        "INVESTOR_NAME_REQUIRED"
      );
    }

    if (
      nationalId &&
      nationalId.length !== 10
    ) {
      return createErrorResponse(
        "رقم هوية المستثمر يجب أن يكون 10 أرقام",
        400,
        "INVALID_NATIONAL_ID"
      );
    }

    if (
      phone &&
      phone.length !== 10
    ) {
      return createErrorResponse(
        "رقم الجوال يجب أن يكون 10 أرقام",
        400,
        "INVALID_PHONE"
      );
    }

    if (nationalId || phone) {
      let duplicateQuery =
        supabaseAdmin
          .from("finance_investors")
          .select(
            "id, national_id, phone"
          )
          .eq(
            "branch_id",
            session.branchId
          )
          .neq("id", investorId);

      if (nationalId && phone) {
        duplicateQuery =
          duplicateQuery.or(
            `national_id.eq.${nationalId},phone.eq.${phone}`
          );
      } else if (nationalId) {
        duplicateQuery =
          duplicateQuery.eq(
            "national_id",
            nationalId
          );
      } else {
        duplicateQuery =
          duplicateQuery.eq(
            "phone",
            phone
          );
      }

      const {
        data: duplicateData,
        error: duplicateError,
      } = await duplicateQuery.limit(1);

      if (duplicateError) {
        throw new Error(
          duplicateError.message
        );
      }

      const duplicateInvestor =
        duplicateData?.[0];

      if (duplicateInvestor) {
        return createErrorResponse(
          investorDuplicateMessage(
            duplicateInvestor,
            nationalId,
            phone
          ),
          409,
          "DUPLICATE_INVESTOR"
        );
      }
    }

    const {
      data: investor,
      error: updateError,
    } = await supabaseAdmin
      .from("finance_investors")
      .update({
        investor_name: investorName,
        national_id:
          nationalId || null,
        phone: phone || null,
        notes: notes || null,
      })
      .eq("id", investorId)
      .eq(
        "branch_id",
        session.branchId
      )
      .eq("is_archived", false)
      .select(
        "id, investor_name, national_id, phone, notes, is_active"
      )
      .maybeSingle();

    if (updateError || !investor) {
      if (
        updateError?.code === "23505"
      ) {
        return createErrorResponse(
          "يوجد مستثمر آخر بنفس البيانات داخل هذا الفرع",
          409,
          "DUPLICATE_INVESTOR"
        );
      }

      throw new Error(
        updateError?.message ||
          "تعذر تعديل المستثمر"
      );
    }

    return createResponse({
      ok: true,
      investor,
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
      "Update investor error:",
      error
    );

    return createErrorResponse(
      "تعذر تعديل المستثمر",
      500,
      "UPDATE_INVESTOR_FAILED"
    );
  }
}

export async function DELETE(
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

    const url = new URL(request.url);
    const branch = cleanText(
      url.searchParams.get("branch")
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
          "edit_investor",
      });

    const currentInvestor =
      await getInvestor(
        session.branchId,
        investorId
      );

    if (!currentInvestor) {
      return createErrorResponse(
        "المستثمر غير موجود أو لا يتبع هذا الفرع",
        404,
        "INVESTOR_NOT_FOUND"
      );
    }

    const {
      data: investor,
      error: archiveError,
    } = await supabaseAdmin
      .from("finance_investors")
      .update({
        is_active: false,
        is_archived: true,
        archived_at:
          new Date().toISOString(),
        archived_by:
          session.userId,
      })
      .eq("id", investorId)
      .eq(
        "branch_id",
        session.branchId
      )
      .eq("is_archived", false)
      .select("id, investor_name")
      .maybeSingle();

    if (archiveError || !investor) {
      throw new Error(
        archiveError?.message ||
          "تعذر أرشفة المستثمر"
      );
    }

    return createResponse({
      ok: true,
      investor,
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
      "Archive investor error:",
      error
    );

    return createErrorResponse(
      "تعذر أرشفة المستثمر",
      500,
      "ARCHIVE_INVESTOR_FAILED"
    );
  }
}
