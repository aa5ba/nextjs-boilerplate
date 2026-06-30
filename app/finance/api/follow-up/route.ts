import { NextRequest, NextResponse } from "next/server";
import {
  FINANCE_BRANCH_SESSION_COOKIE_NAME,
  verifyFinanceBranchSessionToken,
} from "@/lib/financeBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGER_ROLES = new Set([
  "main_admin",
  "branch_manager",
  "admin",
  "manager",
  "مدير رئيسي",
  "مدير فرع",
  "مدير",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CLOSED_STATUSES = new Set([
  "تم السداد",
  "مسدد",
  "مغلق",
  "ملغي",
  "paid",
  "closed",
  "cancelled",
  "canceled",
]);

type FollowUpNoteRow = {
  id: string;
  branch_id: string;
  contract_id: string;
  customer_id: string | null;
  investor_id: string | null;
  note_text: string;
  created_by_user_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string | null;
};

type FollowUpContractRow = {
  id: string;
  branch_id: string;
  contract_number: string | null;
  customer_id: string | null;
  investor_id: string | null;
  investor_name: string | null;
  remaining_amount: number | string | null;
  debt_amount: number | string | null;
  payment_amount: number | string | null;
  payment_due_date: string | null;
  contract_status: string | null;
};

type CustomerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  national_id: string | null;
};

type FinanceBranchUserRow = {
  id: string;
  branch_id: string;
  full_name: string | null;
  username: string | null;
  role: string | null;
  permissions: string[] | null;
  is_active: boolean | null;
  session_version: number | null;
};

type FinanceBranchRow = {
  id: string;
  branch_slug: string;
  is_active: boolean | null;
};

type FollowUpNoteOwnerRow = {
  id: string;
  branch_id: string;
  contract_id?: string;
  created_by_user_id: string;
};

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
    },
  });
}

function cleanText(
  value: unknown,
  maxLength: number
) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function isValidUuid(
  value: string
) {
  return UUID_PATTERN.test(value);
}

function normalizeMoney(
  value: unknown
) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount)
    ? amount
    : 0;
}

function normalizeStatus(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isManagerRole(
  role: unknown
) {
  return MANAGER_ROLES.has(
    String(role ?? "").trim()
  );
}

function getTodaySaudiDate() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());
}

function subtractDays(
  isoDate: string,
  days: number
) {
  const [year, month, day] =
    isoDate.split("-").map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  date.setUTCDate(
    date.getUTCDate() - days
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function calculateDaysLate(
  dueDate: string | null,
  todayIso: string
) {
  if (!dueDate) return 0;

  const due = new Date(
    `${dueDate.slice(0, 10)}T00:00:00Z`
  );

  const today = new Date(
    `${todayIso}T00:00:00Z`
  );

  const difference =
    today.getTime() -
    due.getTime();

  if (
    !Number.isFinite(difference)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      difference /
        86_400_000
    )
  );
}

async function authorize(
  request: NextRequest,
  branchSlug: string
) {
  const token =
    request.cookies.get(
      FINANCE_BRANCH_SESSION_COOKIE_NAME
    )?.value ?? null;

  let session;

  try {
    session =
      verifyFinanceBranchSessionToken(
        token
      );
  } catch (error) {
    console.error(
      "Follow-up session verification error:",
      error
    );

    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          code: "INVALID_SESSION",
          message:
            "تعذر التحقق من جلسة تسجيل الدخول",
        },
        401
      ),
    };
  }

  if (!session) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          code: "INVALID_SESSION",
          message:
            "الجلسة غير صالحة أو منتهية",
        },
        401
      ),
    };
  }

  const normalizedBranchSlug =
    cleanText(
      branchSlug,
      120
    ).toLowerCase();

  if (
    session.branchSlug !==
    normalizedBranchSlug
  ) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          code: "BRANCH_MISMATCH",
          message:
            "الجلسة لا تخص هذا الفرع",
        },
        403
      ),
    };
  }

  const [
    branchResult,
    userResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("finance_branches")
      .select(
        "id,branch_slug,is_active"
      )
      .eq(
        "id",
        session.branchId
      )
      .eq(
        "branch_slug",
        normalizedBranchSlug
      )
      .maybeSingle(),

    supabaseAdmin
      .from(
        "finance_branch_users"
      )
      .select(
        "id,branch_id,full_name,username,role,permissions,is_active,session_version"
      )
      .eq(
        "id",
        session.userId
      )
      .eq(
        "branch_id",
        session.branchId
      )
      .maybeSingle(),
  ]);

  if (
    branchResult.error ||
    userResult.error
  ) {
    console.error(
      "Follow-up authorization database error:",
      branchResult.error ??
        userResult.error
    );

    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          code:
            "AUTHORIZATION_CHECK_FAILED",
          message:
            "تعذر التحقق من صلاحية الدخول",
        },
        500
      ),
    };
  }

  const branchRow =
    branchResult.data as unknown as
      | FinanceBranchRow
      | null;

  const userRow =
    userResult.data as unknown as
      | FinanceBranchUserRow
      | null;

  if (
    !branchRow ||
    branchRow.is_active === false ||
    !userRow ||
    userRow.is_active === false
  ) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          code: "SESSION_REVOKED",
          message:
            "تم إيقاف المستخدم أو الفرع",
        },
        401
      ),
    };
  }

  if (
    Number(
      userRow.session_version ??
        0
    ) !==
    session.sessionVersion
  ) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          code: "SESSION_REVOKED",
          message:
            "انتهت صلاحية الجلسة، سجل الدخول مرة أخرى",
        },
        401
      ),
    };
  }

  const role =
    cleanText(
      userRow.role,
      80
    );

  const permissions =
    Array.isArray(
      userRow.permissions
    )
      ? userRow.permissions.filter(
          (
            permission
          ): permission is string =>
            typeof permission ===
              "string" &&
            permission.trim()
              .length > 0
        )
      : [];

  if (
    !isManagerRole(role) &&
    !permissions.includes(
      "follow_up"
    )
  ) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          code: "FORBIDDEN",
          message:
            "لا تملك صلاحية المتابعة والتواصل",
        },
        403
      ),
    };
  }

  return {
    ok: true as const,
    branchId:
      session.branchId,
    userId:
      session.userId,
    userName:
      cleanText(
        userRow.full_name ??
          userRow.username ??
          "الموظف",
        160
      ),
    role,
  };
}

async function ensureContractAccess(
  contractId: string,
  branchId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("finance_contracts")
    .select(
      "id,branch_id,contract_number,customer_id,investor_id,investor_name,remaining_amount,debt_amount,payment_amount,payment_due_date,contract_status"
    )
    .eq("id", contractId)
    .eq("branch_id", branchId)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message
    );
  }

  if (!data) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          code: "CONTRACT_NOT_FOUND",
          message:
            "العقد غير موجود في هذا الفرع",
        },
        404
      ),
    };
  }

  const contract =
    data as unknown as FollowUpContractRow;

  const today =
    getTodaySaudiDate();

  const daysLate =
    calculateDaysLate(
      contract.payment_due_date,
      today
    );

  const remainingAmount =
    normalizeMoney(
      contract.remaining_amount
    );

  const status =
    normalizeStatus(
      contract.contract_status
    );

  const isClosed =
    CLOSED_STATUSES.has(status);

  if (
    remainingAmount <= 0 ||
    isClosed ||
    daysLate < 7
  ) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          code:
            "CONTRACT_NOT_OVERDUE",
          message:
            "لا يمكن إضافة متابعة لأن العقد غير متأخر 7 أيام كاملة أو لا يوجد عليه مبلغ متبقٍ",
        },
        409
      ),
    };
  }

  return {
    ok: true as const,
    contract,
    daysLate,
    remainingAmount,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const branchSlug =
      cleanText(
        request.nextUrl
          .searchParams
          .get("branch"),
        120
      );

    if (!branchSlug) {
      return json(
        {
          ok: false,
          code:
            "BRANCH_REQUIRED",
          message:
            "معرف الفرع مطلوب",
        },
        400
      );
    }

    const auth =
      await authorize(
        request,
        branchSlug
      );

    if (!auth.ok) {
      return auth.response;
    }

    const today =
      getTodaySaudiDate();

    const overdueCutoff =
      subtractDays(
        today,
        7
      );

    const {
      data: contractsData,
      error: contractsError,
    } = await supabaseAdmin
      .from("finance_contracts")
      .select(
        "id,branch_id,contract_number,customer_id,investor_id,investor_name,remaining_amount,debt_amount,payment_amount,payment_due_date,contract_status"
      )
      .eq(
        "branch_id",
        auth.branchId
      )
      .gt(
        "remaining_amount",
        0
      )
      .not(
        "payment_due_date",
        "is",
        null
      )
      .lte(
        "payment_due_date",
        overdueCutoff
      )
      .order(
        "payment_due_date",
        {
          ascending: true,
        }
      )
      .limit(2000);

    if (contractsError) {
      throw new Error(
        contractsError.message
      );
    }

    const contracts =
      (
        Array.isArray(
          contractsData
        )
          ? contractsData
          : []
      ).filter((row) => {
        const status =
          normalizeStatus(
            row.contract_status
          );

        return !CLOSED_STATUSES.has(
          status
        );
      }) as unknown as FollowUpContractRow[];

    const customerIds =
      Array.from(
        new Set(
          contracts
            .map(
              (contract) =>
                contract.customer_id
            )
            .filter(
              (
                value
              ): value is string =>
                Boolean(value)
            )
        )
      );

    const contractIds =
      contracts.map(
        (contract) =>
          contract.id
      );

    let customers: CustomerRow[] =
      [];

    if (
      customerIds.length > 0
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "finance_customers"
        )
        .select(
          "id,full_name,phone,national_id"
        )
        .eq(
          "branch_id",
          auth.branchId
        )
        .in(
          "id",
          customerIds
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      customers =
        Array.isArray(data)
          ? (data as unknown as CustomerRow[])
          : [];
    }

    let notes: FollowUpNoteRow[] =
      [];

    if (
      contractIds.length > 0
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "finance_followup_notes"
        )
        .select(
          "id,branch_id,contract_id,customer_id,investor_id,note_text,created_by_user_id,created_by_name,created_at,updated_at"
        )
        .eq(
          "branch_id",
          auth.branchId
        )
        .in(
          "contract_id",
          contractIds
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(5000);

      if (error) {
        throw new Error(
          error.message
        );
      }

      notes =
        Array.isArray(data)
          ? (data as unknown as FollowUpNoteRow[])
          : [];
    }

    const customerMap =
      new Map(
        customers.map(
          (customer) => [
            customer.id,
            customer,
          ]
        )
      );

    const notesByContract =
      new Map<
        string,
        FollowUpNoteRow[]
      >();

    for (
      const note of notes
    ) {
      const existing =
        notesByContract.get(
          note.contract_id
        ) ?? [];

      existing.push(note);

      notesByContract.set(
        note.contract_id,
        existing
      );
    }

    const rows =
      contracts
        .map((contract) => {
          const customer =
            contract.customer_id
              ? customerMap.get(
                  contract.customer_id
                )
              : undefined;

          const contractNotes =
            notesByContract.get(
              contract.id
            ) ?? [];

          const latestNote =
            contractNotes[0] ??
            null;

          const daysLate =
            calculateDaysLate(
              contract.payment_due_date,
              today
            );

          return {
            id: contract.id,
            contract_id:
              contract.id,
            contract_number:
              contract.contract_number,
            customer_id:
              contract.customer_id,
            customer_name:
              customer?.full_name ??
              "-",
            customer_phone:
              customer?.phone ??
              null,
            customer_national_id:
              customer?.national_id ??
              null,
            investor_id:
              contract.investor_id,
            investor_name:
              contract.investor_name,
            remaining_amount:
              normalizeMoney(
                contract.remaining_amount
              ),
            debt_amount:
              normalizeMoney(
                contract.debt_amount
              ),
            payment_amount:
              normalizeMoney(
                contract.payment_amount
              ),
            payment_due_date:
              contract.payment_due_date,
            contract_status:
              contract.contract_status,
            days_late:
              daysLate,
            latest_note:
              latestNote,
            notes:
              contractNotes,
            notes_count:
              contractNotes.length,
          };
        })
        .filter(
          (row) =>
            row.days_late >= 7 &&
            row.remaining_amount >
              0
        );

    return json({
      ok: true,
      branch_id:
        auth.branchId,
      server_date: today,
      overdue_count:
        rows.length,
      rows,
    });
  } catch (error) {
    console.error(
      "Follow-up GET error:",
      error
    );

    return json(
      {
        ok: false,
        code:
          "FOLLOW_UP_LOAD_FAILED",
        message:
          "تعذر تحميل بيانات المتابعة",
      },
      500
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as Record<
        string,
        unknown
      >;

    const branchSlug =
      cleanText(
        body.branch,
        120
      );

    const contractId =
      cleanText(
        body.contractId,
        80
      );

    const noteText =
      cleanText(
        body.noteText,
        2000
      );

    if (!branchSlug) {
      return json(
        {
          ok: false,
          code:
            "BRANCH_REQUIRED",
          message:
            "معرف الفرع مطلوب",
        },
        400
      );
    }

    if (!isValidUuid(contractId)) {
      return json(
        {
          ok: false,
          code:
            "INVALID_CONTRACT_ID",
          message:
            "معرف العقد غير صحيح",
        },
        400
      );
    }

    if (
      noteText.length < 2
    ) {
      return json(
        {
          ok: false,
          code:
            "NOTE_REQUIRED",
          message:
            "اكتب ملاحظة متابعة صحيحة",
        },
        400
      );
    }

    const auth =
      await authorize(
        request,
        branchSlug
      );

    if (!auth.ok) {
      return auth.response;
    }

    const access =
      await ensureContractAccess(
        contractId,
        auth.branchId
      );

    if (!access.ok) {
      return access.response;
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "finance_followup_notes"
      )
      .insert({
        branch_id:
          auth.branchId,
        contract_id:
          access.contract.id,
        customer_id:
          access.contract
            .customer_id ??
          null,
        investor_id:
          access.contract
            .investor_id ??
          null,
        note_text:
          noteText,
        created_by_user_id:
          auth.userId,
        created_by_name:
          auth.userName,
      })
      .select(
        "id,branch_id,contract_id,customer_id,investor_id,note_text,created_by_user_id,created_by_name,created_at,updated_at"
      )
      .single();

    if (error) {
      throw new Error(
        error.message
      );
    }

    return json(
      {
        ok: true,
        message:
          "تمت إضافة ملاحظة المتابعة بنجاح",
        note: data,
      },
      201
    );
  } catch (error) {
    console.error(
      "Follow-up POST error:",
      error
    );

    return json(
      {
        ok: false,
        code:
          "FOLLOW_UP_CREATE_FAILED",
        message:
          "تعذر إضافة ملاحظة المتابعة",
      },
      500
    );
  }
}

export async function PATCH(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as Record<
        string,
        unknown
      >;

    const branchSlug =
      cleanText(
        body.branch,
        120
      );

    const noteId =
      cleanText(
        body.noteId,
        80
      );

    const noteText =
      cleanText(
        body.noteText,
        2000
      );

    if (
      !branchSlug ||
      !isValidUuid(noteId)
    ) {
      return json(
        {
          ok: false,
          code:
            "INVALID_REQUEST",
          message:
            "بيانات التعديل غير صحيحة",
        },
        400
      );
    }

    if (
      noteText.length < 2
    ) {
      return json(
        {
          ok: false,
          code:
            "NOTE_REQUIRED",
          message:
            "اكتب ملاحظة متابعة صحيحة",
        },
        400
      );
    }

    const auth =
      await authorize(
        request,
        branchSlug
      );

    if (!auth.ok) {
      return auth.response;
    }

    const {
      data: existing,
      error: existingError,
    } = await supabaseAdmin
      .from(
        "finance_followup_notes"
      )
      .select(
        "id,branch_id,contract_id,created_by_user_id"
      )
      .eq(
        "id",
        noteId
      )
      .eq(
        "branch_id",
        auth.branchId
      )
      .maybeSingle();

    if (existingError) {
      throw new Error(
        existingError.message
      );
    }

    const existingNote =
      existing as unknown as FollowUpNoteOwnerRow;

    if (!existing) {
      return json(
        {
          ok: false,
          code:
            "NOTE_NOT_FOUND",
          message:
            "ملاحظة المتابعة غير موجودة",
        },
        404
      );
    }

    const canManage =
      existingNote.created_by_user_id ===
        auth.userId ||
      isManagerRole(
        auth.role
      );

    if (!canManage) {
      return json(
        {
          ok: false,
          code:
            "FORBIDDEN",
          message:
            "لا يمكنك تعديل ملاحظة أنشأها مستخدم آخر",
        },
        403
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "finance_followup_notes"
      )
      .update({
        note_text:
          noteText,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        noteId
      )
      .eq(
        "branch_id",
        auth.branchId
      )
      .select(
        "id,branch_id,contract_id,customer_id,investor_id,note_text,created_by_user_id,created_by_name,created_at,updated_at"
      )
      .single();

    if (error) {
      throw new Error(
        error.message
      );
    }

    return json({
      ok: true,
      message:
        "تم تعديل ملاحظة المتابعة بنجاح",
      note: data,
    });
  } catch (error) {
    console.error(
      "Follow-up PATCH error:",
      error
    );

    return json(
      {
        ok: false,
        code:
          "FOLLOW_UP_UPDATE_FAILED",
        message:
          "تعذر تعديل ملاحظة المتابعة",
      },
      500
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const branchSlug =
      cleanText(
        request.nextUrl
          .searchParams
          .get("branch"),
        120
      );

    const noteId =
      cleanText(
        request.nextUrl
          .searchParams
          .get("noteId"),
        80
      );

    if (
      !branchSlug ||
      !isValidUuid(noteId)
    ) {
      return json(
        {
          ok: false,
          code:
            "INVALID_REQUEST",
          message:
            "بيانات الحذف غير صحيحة",
        },
        400
      );
    }

    const auth =
      await authorize(
        request,
        branchSlug
      );

    if (!auth.ok) {
      return auth.response;
    }

    const {
      data: existing,
      error: existingError,
    } = await supabaseAdmin
      .from(
        "finance_followup_notes"
      )
      .select(
        "id,branch_id,created_by_user_id"
      )
      .eq(
        "id",
        noteId
      )
      .eq(
        "branch_id",
        auth.branchId
      )
      .maybeSingle();

    if (existingError) {
      throw new Error(
        existingError.message
      );
    }

    const existingNote =
      existing as unknown as FollowUpNoteOwnerRow;

    if (!existing) {
      return json(
        {
          ok: false,
          code:
            "NOTE_NOT_FOUND",
          message:
            "ملاحظة المتابعة غير موجودة",
        },
        404
      );
    }

    const canManage =
      existingNote.created_by_user_id ===
        auth.userId ||
      isManagerRole(
        auth.role
      );

    if (!canManage) {
      return json(
        {
          ok: false,
          code:
            "FORBIDDEN",
          message:
            "لا يمكنك حذف ملاحظة أنشأها مستخدم آخر",
        },
        403
      );
    }

    const {
      error,
    } = await supabaseAdmin
      .from(
        "finance_followup_notes"
      )
      .delete()
      .eq(
        "id",
        noteId
      )
      .eq(
        "branch_id",
        auth.branchId
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    return json({
      ok: true,
      message:
        "تم حذف ملاحظة المتابعة بنجاح",
    });
  } catch (error) {
    console.error(
      "Follow-up DELETE error:",
      error
    );

    return json(
      {
        ok: false,
        code:
          "FOLLOW_UP_DELETE_FAILED",
        message:
          "تعذر حذف ملاحظة المتابعة",
      },
      500
    );
  }
}
