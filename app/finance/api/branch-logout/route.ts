import { NextResponse } from "next/server";

import {
  FINANCE_BRANCH_SESSION_COOKIE_NAME,
  financeBranchSessionDeleteCookieOptions,
} from "@/lib/financeBranchSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createJsonResponse(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function createLogoutResponse() {
  const response = createJsonResponse(
    {
      ok: true,
    },
    200
  );

  response.cookies.set(
    FINANCE_BRANCH_SESSION_COOKIE_NAME,
    "",
    financeBranchSessionDeleteCookieOptions
  );

  return response;
}

export async function DELETE() {
  try {
    return createLogoutResponse();
  } catch (error) {
    console.error(
      "Finance branch logout route failed:",
      error
    );

    return createJsonResponse(
      {
        ok: false,
        message:
          "تعذر إنهاء جلسة تسجيل الدخول",
      },
      500
    );
  }
}

export async function POST() {
  try {
    return createLogoutResponse();
  } catch (error) {
    console.error(
      "Finance branch logout POST route failed:",
      error
    );

    return createJsonResponse(
      {
        ok: false,
        message:
          "تعذر إنهاء جلسة تسجيل الدخول",
      },
      500
    );
  }
}
