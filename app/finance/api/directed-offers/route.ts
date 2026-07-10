import { NextResponse } from "next/server";

import {
  isFinanceBranchSessionError,
  requireFinanceBranchSession,
} from "@/lib/requireFinanceBranchSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  action?: unknown;
  branch?: unknown;
  offerId?: unknown;
  contractId?: unknown;
  requestType?: unknown;
  customerName?: unknown;
  customerNationalId?: unknown;
  customerPhone?: unknown;
  city?: unknown;
  requestedAmount?: unknown;
  workName?: unknown;
  birthHijriDay?: unknown;
  birthHijriMonth?: unknown;
  birthHijriYear?: unknown;
  commissionAmount?: unknown;
};

type OfferRow = {
  id: string;
  created_by_branch_id: string;
  created_by_user_id?: string | null;
  accepted_by_branch_id: string | null;
  accepted_by_user_id?: string | null;
  request_type: string;
  customer_name: string;
  customer_national_id?: string | null;
  customer_phone?: string | null;
  city: string;
  requested_amount: number | string;
  work_name: string;
  birth_hijri_day?: number | null;
  birth_hijri_month?: number | null;
  birth_hijri_year?: number | null;
  commission_amount: number | string;
  status: string;
  commission_status: string;
  contract_id: string | null;
  accepted_at: string | null;
  contract_created_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

type DirectedOffersQueryResult = {
  data: unknown[] | null;
  error: {
    message: string;
  } | null;
};

type DirectedOffersQuery = PromiseLike<
  DirectedOffersQueryResult
> & {
  eq: (
    column: string,
    value: unknown
  ) => DirectedOffersQuery;
  gt: (
    column: string,
    value: unknown
  ) => DirectedOffersQuery;
  gte: (
    column: string,
    value: unknown
  ) => DirectedOffersQuery;
  neq: (
    column: string,
    value: unknown
  ) => DirectedOffersQuery;
  lte: (
    column: string,
    value: unknown
  ) => DirectedOffersQuery;
  in: (
    column: string,
    values: readonly unknown[]
  ) => DirectedOffersQuery;
  or: (
    filters: string
  ) => DirectedOffersQuery;
};

type DirectedOffersTable = {
  select: (
    columns: string
  ) => {
    order: (
      column: string,
      options: {
        ascending: boolean;
      }
    ) => {
      limit: (
        count: number
      ) => DirectedOffersQuery;
    };
  };
};

type BranchInfo = {
  name: string;
  phone: string;
};

type UserInfo = {
  fullName: string;
  phone: string;
};

const OPEN_SELECT = `
  id,
  created_by_branch_id,
  accepted_by_branch_id,
  request_type,
  customer_name,
  city,
  requested_amount,
  work_name,
  commission_amount,
  status,
  commission_status,
  contract_id,
  accepted_at,
  contract_created_at,
  paid_at,
  cancelled_at,
  expires_at,
  created_at,
  updated_at
`;

const FULL_SELECT = `
  id,
  created_by_branch_id,
  created_by_user_id,
  accepted_by_branch_id,
  accepted_by_user_id,
  request_type,
  customer_name,
  customer_national_id,
  customer_phone,
  city,
  requested_amount,
  work_name,
  birth_hijri_day,
  birth_hijri_month,
  birth_hijri_year,
  commission_amount,
  status,
  commission_status,
  contract_id,
  accepted_at,
  contract_created_at,
  paid_at,
  cancelled_at,
  expires_at,
  created_at,
  updated_at
`;

const SAUDI_REGIONS = [
  "الرياض",
  "مكة المكرمة",
  "المدينة المنورة",
  "القصيم",
  "المنطقة الشرقية",
  "عسير",
  "تبوك",
  "حائل",
  "الحدود الشمالية",
  "جازان",
  "نجران",
  "الباحة",
  "الجوف",
];

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeDigits(value: string): string {
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

function normalizeNumericText(
  value: unknown,
  maxLength: number
): string {
  return normalizeDigits(
    cleanText(value)
  )
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

function normalizeAmount(
  value: unknown
): number | null {
  const normalized =
    normalizeDigits(
      cleanText(value)
    )
      .replace(/[\s,\u066C]/g, "")
      .replace(/\u066B/g, ".");

  if (
    !/^\d+(?:\.\d+)?$/.test(
      normalized
    )
  ) {
    return null;
  }

  const amount = Number(
    normalized
  );

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return null;
  }

  return amount;
}

function createResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function createErrorResponse(
  message: string,
  status: number,
  code = "REQUEST_FAILED"
) {
  return createResponse(
    {
      ok: false,
      message,
      code,
    },
    status
  );
}

async function readRequestBody(
  request: Request
): Promise<RequestBody | null> {
  try {
    const parsed: unknown =
      await request.json();

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed as RequestBody;
  } catch {
    return null;
  }
}

function maskCustomerName(name: string) {
  const cleanName = name
    .trim()
    .replace(/\s+/g, " ");

  if (!cleanName) {
    return "-";
  }

  return `${cleanName.slice(0, 5)}...`;
}

function mapOffer(
  row: OfferRow,
  currentBranchId: string,
  branchInfo: Map<
    string,
    BranchInfo
  >,
  userInfo: Map<
    string,
    UserInfo
  >,
  includeSensitive: boolean
) {
  const isCreator =
    row.created_by_branch_id ===
    currentBranchId;

  const isAcceptedByCurrent =
    row.accepted_by_branch_id ===
    currentBranchId;

  const base = {
    id: row.id,
    requestType:
      row.request_type,
    customerName:
      includeSensitive
        ? row.customer_name
        : maskCustomerName(
            row.customer_name
          ),
    city: row.city,
    requestedAmount:
      Number(row.requested_amount || 0),
    workName:
      row.work_name,
    commissionAmount:
      Number(row.commission_amount || 0),
    status: row.status,
    commissionStatus:
      row.commission_status,
    contractId:
      row.contract_id,
    createdAt:
      row.created_at,
    updatedAt:
      row.updated_at,
    acceptedAt:
      row.accepted_at,
    contractCreatedAt:
      row.contract_created_at,
    paidAt: row.paid_at,
    cancelledAt:
      row.cancelled_at,
    expiresAt:
      row.expires_at,
    isCreator,
    isAcceptedByCurrent,
  };

  if (!includeSensitive) {
    return base;
  }

  const creatorBranchInfo =
    branchInfo.get(
      row.created_by_branch_id
    );

  const acceptedBranchInfo =
    row.accepted_by_branch_id
      ? branchInfo.get(
          row.accepted_by_branch_id
        )
      : undefined;

  const otherBranchPhone = isCreator
    ? acceptedBranchInfo?.phone || ""
    : isAcceptedByCurrent
      ? creatorBranchInfo?.phone || ""
      : "";

  const canExposeCustomerPhone =
    row.status === "accepted" ||
    row.status ===
      "contract_created" ||
    row.status === "paid";

  const canExposeUserPhone =
    canExposeCustomerPhone &&
    (isCreator ||
      isAcceptedByCurrent);

  const creatorUserInfo =
    row.created_by_user_id
      ? userInfo.get(
          row.created_by_user_id
        )
      : undefined;

  const acceptedUserInfo =
    row.accepted_by_user_id
      ? userInfo.get(
          row.accepted_by_user_id
        )
      : undefined;

  const otherUserName =
    canExposeUserPhone
      ? isCreator
        ? acceptedUserInfo?.fullName ||
          ""
        : isAcceptedByCurrent
          ? creatorUserInfo?.fullName ||
            ""
          : ""
      : "";

  const otherUserPhone =
    canExposeUserPhone
      ? isCreator
        ? acceptedUserInfo?.phone ||
          ""
        : isAcceptedByCurrent
          ? creatorUserInfo?.phone ||
            ""
          : ""
      : "";

  return {
    ...base,
    customerNationalId:
      row.customer_national_id,
    customerPhone:
      canExposeCustomerPhone
        ? row.customer_phone
        : null,
    birthHijriDay:
      row.birth_hijri_day,
    birthHijriMonth:
      row.birth_hijri_month,
    birthHijriYear:
      row.birth_hijri_year,
    createdByBranchId:
      row.created_by_branch_id,
    acceptedByBranchId:
      row.accepted_by_branch_id,
    createdByBranchName:
      creatorBranchInfo?.name || "",
    acceptedByBranchName:
      acceptedBranchInfo?.name || "",
    creatorBranchPhone:
      creatorBranchInfo?.phone || "",
    acceptedBranchPhone:
      acceptedBranchInfo?.phone || "",
    otherBranchPhone,
    createdByUserName:
      canExposeUserPhone
        ? creatorUserInfo?.fullName ||
          ""
        : "",
    createdByUserPhone:
      canExposeUserPhone
        ? creatorUserInfo?.phone || ""
        : "",
    acceptedByUserName:
      canExposeUserPhone
        ? acceptedUserInfo?.fullName ||
          ""
        : "",
    acceptedByUserPhone:
      canExposeUserPhone
        ? acceptedUserInfo?.phone ||
          ""
        : "",
    otherUserName,
    otherUserPhone,
  };
}

async function getBranchInfo(
  branchIds: string[]
) {
  const uniqueIds = Array.from(
    new Set(
      branchIds.filter(Boolean)
    )
  );

  if (uniqueIds.length === 0) {
    return new Map<
      string,
      BranchInfo
    >();
  }

  const { data } =
    await supabaseAdmin
      .from("finance_branches")
      .select(
        "id, branch_name, organization_name, phone"
      )
      .in("id", uniqueIds);

  return new Map(
    ((data || []) as Array<{
      id: string;
      branch_name?: string | null;
      organization_name?: string | null;
      phone?: string | null;
    }>).map((item) => [
      item.id,
      {
        name:
          item.branch_name ||
          item.organization_name ||
          "",
        phone: item.phone || "",
      },
    ])
  );
}

async function getBranchUserInfo(
  userIds: string[]
) {
  const uniqueIds = Array.from(
    new Set(
      userIds.filter(Boolean)
    )
  );

  if (uniqueIds.length === 0) {
    return new Map<
      string,
      UserInfo
    >();
  }

  const { data } =
    await supabaseAdmin
      .from(
        "finance_branch_users"
      )
      .select(
        "id, full_name, phone"
      )
      .in("id", uniqueIds);

  return new Map(
    ((data || []) as Array<{
      id: string;
      full_name?: string | null;
      phone?: string | null;
    }>).map((item) => [
      item.id,
      {
        fullName:
          item.full_name || "",
        phone: item.phone || "",
      },
    ])
  );
}

async function getBlockStatus(
  branchId: string
) {
  await supabaseAdmin.rpc(
    "recalculate_directed_offers_accept_block_atomic",
    {
      p_branch_id:
        branchId,
    }
  );

  const { data } =
    await supabaseAdmin
      .from(
        "finance_directed_offer_acceptance_blocks"
      )
      .select(
        "active_not_delivered_count, is_blocked"
      )
      .eq("branch_id", branchId)
      .maybeSingle();

  return {
    activeNotDeliveredCount:
      Number(
        data?.active_not_delivered_count ||
          0
      ),
    isBlocked:
      Boolean(data?.is_blocked),
  };
}

function getEmployeeName(
  session: Awaited<
    ReturnType<
      typeof requireFinanceBranchSession
    >
  >
) {
  return (
    cleanText(
      session.user.fullName
    ) ||
    cleanText(
      session.user.username
    ) ||
    "الموظف"
  );
}

function getRpcErrorCode(
  message: string
) {
  const knownCodes = [
    "OFFER_NOT_FOUND",
    "CANNOT_ACCEPT_OWN_OFFER",
    "OFFER_NOT_ACTIVE",
    "OFFER_EXPIRED",
    "DIRECTED_OFFERS_ACCEPTANCE_BLOCKED",
    "OFFER_NOT_ACCEPTED_BY_BRANCH",
    "ONLY_CREATOR_CAN_CANCEL",
    "OFFER_CANNOT_BE_CANCELLED",
    "ONLY_ACCEPTING_BRANCH_CAN_CREATE_CONTRACT",
    "OFFER_NOT_ACCEPTED",
    "OFFER_NOT_PAID",
    "ONLY_CREATOR_CAN_MARK_COMMISSION",
    "INVALID_NATIONAL_ID",
    "INVALID_CUSTOMER_PHONE",
    "INVALID_REQUEST_TYPE",
    "WORK_NAME_REQUIRED",
    "INVALID_CONTRACT_FOR_BRANCH",
    "OFFER_CONTRACT_NOT_CREATED",
    "ACCEPTING_BRANCH_REQUIRED",
    "CITY_REQUIRED",
    "CUSTOMER_NAME_REQUIRED",
    "INVALID_REQUESTED_AMOUNT",
    "INVALID_COMMISSION_AMOUNT",
    "BRANCH_REQUIRED",
    "INVALID_BIRTH_HIJRI_DATE",
  ];

  return (
    knownCodes.find((code) =>
      message.includes(code)
    ) || "DIRECTED_OFFER_FAILED"
  );
}

export async function GET(
  request: Request
) {
  try {
    const url = new URL(
      request.url
    );

    const branch =
      cleanText(
        url.searchParams.get(
          "branch"
        )
      ).toLowerCase();

    const scope =
      cleanText(
        url.searchParams.get(
          "scope"
        )
      ) || "open";

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
      });

    const blockStatus =
      await getBlockStatus(
        session.branchId
      );

    const offerId =
      cleanText(
        url.searchParams.get(
          "offerId"
        )
      );

    const city =
      cleanText(
        url.searchParams.get(
          "city"
        )
      );

    const requestType =
      cleanText(
        url.searchParams.get(
          "requestType"
        )
      );

    const amountFrom =
      normalizeAmount(
        url.searchParams.get(
          "amountFrom"
        )
      );

    const amountTo =
      normalizeAmount(
        url.searchParams.get(
          "amountTo"
        )
      );

    const includeSensitive =
      scope === "sent" ||
      scope === "accepted" ||
      scope === "archive";

    const directedOffersTable =
      supabaseAdmin.from(
        "finance_directed_request_offers"
      ) as unknown as DirectedOffersTable;

    let query = directedOffersTable
      .select(
        includeSensitive
          ? FULL_SELECT
          : OPEN_SELECT
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(200);

    if (offerId) {
      query = query.eq(
        "id",
        offerId
      );
    }

    if (scope === "open") {
      const now =
        new Date().toISOString();

      query = query
        .eq("status", "active")
        .gt("expires_at", now);
    } else if (scope === "sent") {
      query = query
        .eq(
          "created_by_branch_id",
          session.branchId
        )
        .neq("status", "cancelled");
    } else if (scope === "accepted") {
      query = query
        .eq(
          "accepted_by_branch_id",
          session.branchId
        )
        .in("status", [
          "accepted",
          "contract_created",
          "paid",
        ]);
    } else if (scope === "archive") {
      query = query
        .or(
          `created_by_branch_id.eq.${session.branchId},accepted_by_branch_id.eq.${session.branchId}`
        )
        .in("status", [
          "cancelled",
          "paid",
        ]);
    } else {
      return createErrorResponse(
        "نوع القائمة غير صحيح",
        400,
        "INVALID_SCOPE"
      );
    }

    if (city) {
      query = query.eq(
        "city",
        city
      );
    }

    if (requestType) {
      query = query.eq(
        "request_type",
        requestType
      );
    }

    if (amountFrom !== null) {
      query = query.gte(
        "requested_amount",
        amountFrom
      );
    }

    if (amountTo !== null) {
      query = query.lte(
        "requested_amount",
        amountTo
      );
    }

    const { data, error } =
      await query;

    if (error) {
      throw new Error(
        error.message
      );
    }

    const rows =
      (data || []) as OfferRow[];

    const branchInfo =
      await getBranchInfo(
        rows.flatMap((row) => [
          row.created_by_branch_id,
          row.accepted_by_branch_id ||
            "",
        ])
      );

    const userInfo =
      includeSensitive
        ? await getBranchUserInfo(
            rows.flatMap((row) => [
              row.created_by_user_id ||
                "",
              row.accepted_by_user_id ||
                "",
            ])
          )
        : new Map<
            string,
            UserInfo
          >();

    const offers = rows.map((row) =>
      mapOffer(
        row,
        session.branchId,
        branchInfo,
        userInfo,
        includeSensitive
      )
    );

    return createResponse({
      ok: true,
      offers,
      blockStatus,
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
      "Directed offers GET error:",
      error
    );

    return createErrorResponse(
      "تعذر تحميل عروض الطلب الموجه",
      500,
      "DIRECTED_OFFERS_LOAD_FAILED"
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await readRequestBody(
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
      });

    const action =
      cleanText(
        body.action
      ) || "create";

    const employeeName =
      getEmployeeName(session);

    let rpcName = "";
    let rpcArgs: Record<
      string,
      unknown
    > = {};

    if (action === "create") {
      const requestType =
        cleanText(
          body.requestType
        );

      const customerName =
        cleanText(
          body.customerName
        );

      const customerNationalId =
        normalizeNumericText(
          body.customerNationalId,
          10
        );

      const customerPhone =
        normalizeNumericText(
          body.customerPhone,
          10
        );

      const city =
        cleanText(
          body.city
        );

      const requestedAmount =
        normalizeAmount(
          body.requestedAmount
        );

      const commissionAmount =
        normalizeAmount(
          body.commissionAmount
        );

      const workName =
        cleanText(
          body.workName
        );

      const birthHijriDay =
        Number(
          normalizeNumericText(
            body.birthHijriDay,
            2
          )
        );

      const birthHijriMonth =
        Number(
          normalizeNumericText(
            body.birthHijriMonth,
            2
          )
        );

      const birthHijriYear =
        Number(
          normalizeNumericText(
            body.birthHijriYear,
            4
          )
        );

      if (
        requestType !== "طلب مهلة" &&
        requestType !== "طلب سداد"
      ) {
        return createErrorResponse(
          "نوع الطلب غير صحيح",
          400,
          "INVALID_REQUEST_TYPE"
        );
      }

      if (!customerName) {
        return createErrorResponse(
          "اسم العميل مطلوب",
          400,
          "CUSTOMER_NAME_REQUIRED"
        );
      }

      if (
        customerNationalId.length !==
        10
      ) {
        return createErrorResponse(
          "رقم الهوية يجب أن يكون 10 أرقام",
          400,
          "INVALID_NATIONAL_ID"
        );
      }

      if (
        customerPhone.length !== 10 ||
        !customerPhone.startsWith(
          "05"
        )
      ) {
        return createErrorResponse(
          "رقم الجوال يجب أن يكون 10 أرقام ويبدأ بـ 05",
          400,
          "INVALID_CUSTOMER_PHONE"
        );
      }

      if (
        !SAUDI_REGIONS.includes(city)
      ) {
        return createErrorResponse(
          "المنطقة مطلوبة",
          400,
          "CITY_REQUIRED"
        );
      }

      if (workName.length < 2) {
        return createErrorResponse(
          "جهة العمل مطلوبة",
          400,
          "WORK_NAME_REQUIRED"
        );
      }

      if (
        birthHijriDay < 1 ||
        birthHijriDay > 30 ||
        birthHijriMonth < 1 ||
        birthHijriMonth > 12 ||
        birthHijriYear < 1200 ||
        birthHijriYear > 1600
      ) {
        return createErrorResponse(
          "تاريخ الميلاد الهجري غير صحيح",
          400,
          "INVALID_BIRTH_HIJRI_DATE"
        );
      }

      if (
        requestedAmount === null ||
        requestedAmount <= 0
      ) {
        return createErrorResponse(
          "المبلغ المطلوب غير صحيح",
          400,
          "INVALID_REQUESTED_AMOUNT"
        );
      }

      if (
        commissionAmount === null
      ) {
        return createErrorResponse(
          "العمولة غير صحيحة",
          400,
          "INVALID_COMMISSION_AMOUNT"
        );
      }

      rpcName =
        "create_directed_request_offer_atomic";

      rpcArgs = {
        p_created_by_branch_id:
          session.branchId,
        p_created_by_user_id:
          session.userId || null,
        p_created_by_name:
          employeeName,
        p_request_type:
          requestType,
        p_customer_name:
          customerName,
        p_customer_national_id:
          customerNationalId,
        p_customer_phone:
          customerPhone,
        p_city: city,
        p_requested_amount:
          requestedAmount,
        p_work_name:
          workName,
        p_birth_hijri_day:
          birthHijriDay,
        p_birth_hijri_month:
          birthHijriMonth,
        p_birth_hijri_year:
          birthHijriYear,
        p_commission_amount:
          commissionAmount,
      };
    } else {
      const offerId =
        cleanText(
          body.offerId
        );

      if (!offerId) {
        return createErrorResponse(
          "معرف العرض مطلوب",
          400,
          "OFFER_REQUIRED"
        );
      }

      if (action === "accept") {
        rpcName =
          "accept_directed_request_offer_atomic";
        rpcArgs = {
          p_offer_id:
            offerId,
          p_accepting_branch_id:
            session.branchId,
          p_accepting_user_id:
            session.userId || null,
          p_accepting_name:
            employeeName,
        };
      } else if (
        action === "withdraw"
      ) {
        rpcName =
          "withdraw_directed_request_offer_acceptance_atomic";
        rpcArgs = {
          p_offer_id:
            offerId,
          p_accepting_branch_id:
            session.branchId,
          p_user_id:
            session.userId || null,
          p_employee_name:
            employeeName,
        };
      } else if (
        action === "cancel"
      ) {
        rpcName =
          "cancel_directed_request_offer_atomic";
        rpcArgs = {
          p_offer_id:
            offerId,
          p_branch_id:
            session.branchId,
          p_user_id:
            session.userId || null,
          p_employee_name:
            employeeName,
        };
      } else if (
        action === "markContractCreated"
      ) {
        const contractId =
          cleanText(
            body.contractId
          );

        if (!contractId) {
          return createErrorResponse(
            "معرف العقد مطلوب",
            400,
            "CONTRACT_REQUIRED"
          );
        }

        rpcName =
          "mark_directed_offer_contract_created_atomic";
        rpcArgs = {
          p_offer_id:
            offerId,
          p_branch_id:
            session.branchId,
          p_user_id:
            session.userId || null,
          p_employee_name:
            employeeName,
          p_contract_id:
            contractId,
        };
      } else if (
        action ===
        "commissionNotDelivered"
      ) {
        rpcName =
          "mark_directed_offer_commission_not_delivered_atomic";
        rpcArgs = {
          p_offer_id:
            offerId,
          p_branch_id:
            session.branchId,
          p_user_id:
            session.userId || null,
          p_employee_name:
            employeeName,
        };
      } else if (
        action ===
        "commissionReceived"
      ) {
        rpcName =
          "mark_directed_offer_commission_received_atomic";
        rpcArgs = {
          p_offer_id:
            offerId,
          p_branch_id:
            session.branchId,
          p_user_id:
            session.userId || null,
          p_employee_name:
            employeeName,
        };
      } else {
        return createErrorResponse(
          "الإجراء غير صحيح",
          400,
          "INVALID_ACTION"
        );
      }
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        rpcName,
        rpcArgs
      );

    if (error) {
      const message =
        error.message ||
        "تعذر تنفيذ العملية";

      return createErrorResponse(
        message,
        400,
        getRpcErrorCode(
          message
        )
      );
    }

    const result = Array.isArray(data)
      ? data[0] ?? null
      : data ?? null;

    let acceptedOffer:
      | ReturnType<typeof mapOffer>
      | null = null;

    if (action === "accept") {
      const acceptedOfferId =
        cleanText(body.offerId);

      const {
        data: acceptedRow,
      } = await supabaseAdmin
        .from(
          "finance_directed_request_offers"
        )
        .select(FULL_SELECT)
        .eq("id", acceptedOfferId)
        .eq(
          "accepted_by_branch_id",
          session.branchId
        )
        .maybeSingle();

      if (acceptedRow) {
        const row =
          acceptedRow as OfferRow;

        const branchInfo =
          await getBranchInfo([
            row.created_by_branch_id,
            row.accepted_by_branch_id ||
              "",
          ]);

        const userInfo =
          await getBranchUserInfo([
            row.created_by_user_id ||
              "",
            row.accepted_by_user_id ||
              "",
          ]);

        acceptedOffer = mapOffer(
          row,
          session.branchId,
          branchInfo,
          userInfo,
          true
        );
      }
    }

    return createResponse({
      ok: true,
      result,
      acceptedOffer,
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
      "Directed offers POST error:",
      error
    );

    return createErrorResponse(
      "تعذر تنفيذ عملية عروض الطلب الموجه",
      500,
      "DIRECTED_OFFER_ACTION_FAILED"
    );
  }
}
