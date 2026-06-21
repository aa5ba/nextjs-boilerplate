import { NextResponse } from "next/server";

import {
  ADMIN_SUPPORT_COOKIE_NAME,
  ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
} from "@/lib/adminSupportSession";

export async function POST() {
  const response = NextResponse.json(
    {
      ok: true,
      message: "تم تسجيل الخروج",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  response.cookies.set(
    ADMIN_SUPPORT_COOKIE_NAME,
    "",
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    }
  );

  response.cookies.set(
    ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME,
    "",
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/finance",
      maxAge: 0,
      expires: new Date(0),
    }
  );

  return response;
}
