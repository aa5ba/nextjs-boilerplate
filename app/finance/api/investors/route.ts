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
} from "./_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request
) {
  try {
    const body =
      await readJsonBody(request);

    if (!body) {
      return createErrorResponse(
        "بيانات الطلب غير صحيحة",
        400,
        "INVALID_BODY"
      );
    }

    const branch =
      cleanText(body.branch).toLowerCase();
    const investorName =
      cleanText(body.investorName);
    const nationalId =
      normalizeDigits(body.nationalId);
    const phone =
      normalizeDigits(body.phone);
    const notes = cleanText(body.notes);

    if (!branch) {
      return createErrorResponse(
        "تعذر تحديد الفرع",
        400,
        "BRANCH_REQUIRED"
      );
    }

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

    const session =
      await requireFinanceBranchSession({
        requestedBranchSlug:
          branch,
        requiredPermission:
          "add_investor",
      });

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
          );

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
      error: insertError,
    } = await supabaseAdmin
      .from("finance_investors")
      .insert({
        branch_id: session.branchId,
        investor_name: investorName,
        national_id:
          nationalId || null,
        phone: phone || null,
        notes: notes || null,
        is_active: true,
        is_archived: false,
        archived_at: null,
        archived_by: null,
      })
      .select(
        "id, investor_name, national_id, phone, notes, is_active"
      )
      .single();

    if (insertError || !investor) {
      if (
        insertError?.code === "23505"
      ) {
        return createErrorResponse(
          "يوجد مستثمر بنفس البيانات داخل هذا الفرع",
          409,
          "DUPLICATE_INVESTOR"
        );
      }

      throw new Error(
        insertError?.message ||
          "تعذر حفظ المستثمر"
      );
    }

    return createResponse(
      {
        ok: true,
        investor,
      },
      201
    );
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
      "Create investor error:",
      error
    );

    return createErrorResponse(
      "تعذر حفظ المستثمر",
      500,
      "CREATE_INVESTOR_FAILED"
    );
  }
}
