import "server-only";

import {
  createHash,
  randomBytes,
} from "crypto";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ADMIN_SUPPORT_COOKIE_NAME,
  adminSupportCookieOptions,
  createAdminSupportSessionToken,
} from "@/lib/adminSupportSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_BYTES = 4_096;

const MAX_USERNAME_LENGTH = 50;
const MIN_USERNAME_LENGTH = 3;

const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 4;

const LOGIN_WINDOW_MS =
  15 * 60 * 1000;

const LOGIN_LOCK_MS =
  30 * 60 * 1000;

const MAX_LOGIN_ATTEMPTS = 5;

const RATE_LIMIT_CLEANUP_INTERVAL_MS =
  10 * 60 * 1000;

type LoginRequestBody = {
  username?: unknown;
  password?: unknown;
};

type SupportLoginResult = {
  id?: string | null;
  user_id?: string | null;
  full_name?: string | null;
  username?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  permissions?: unknown;
  session_version?: number | null;
};

type LoginAttemptRecord = {
  attempts: number;
  windowStartedAt: number;
  lockedUntil: number;
  lastAttemptAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __adminSupportLoginAttempts:
    | Map<string, LoginAttemptRecord>
    | undefined;

  // eslint-disable-next-line no-var
  var __adminSupportLoginLastCleanup:
    | number
    | undefined;
}

const loginAttempts =
  globalThis.__adminSupportLoginAttempts ??
  new Map<string, LoginAttemptRecord>();

globalThis.__adminSupportLoginAttempts =
  loginAttempts;

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...noStoreHeaders(),
      ...extraHeaders,
    },
  });
}

function normalizeUsername(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

function readPassword(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }

  /*
   * لا نستخدم trim() هنا.
   * المسافات قد تكون جزءًا حقيقيًا من كلمة المرور.
   */
  return value;
}

function normalizePermissions(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (
            permission
          ): permission is string =>
            typeof permission === "string"
        )
        .map((permission) =>
          permission.trim()
        )
        .filter(
          (permission) =>
            permission.length > 0 &&
            permission.length <= 100
        )
    )
  ).slice(0, 200);
}

function normalizeSessionVersion(
  value: unknown
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return 0;
  }

  return value;
}

function getClientIp(
  request: Request
): string {
  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    );

  if (forwardedFor) {
    const firstIp =
      forwardedFor
        .split(",")[0]
        ?.trim();

    if (firstIp) {
      return firstIp.slice(0, 128);
    }
  }

  const realIp =
    request.headers
      .get("x-real-ip")
      ?.trim();

  if (realIp) {
    return realIp.slice(0, 128);
  }

  return "unknown";
}

function createRateLimitKey(
  request: Request,
  username: string
): string {
  const ip = getClientIp(request);

  const usernameHash =
    createHash("sha256")
      .update(username, "utf8")
      .digest("hex")
      .slice(0, 24);

  return `${ip}:${usernameHash}`;
}

function cleanupRateLimits() {
  const now = Date.now();

  const lastCleanup =
    globalThis
      .__adminSupportLoginLastCleanup ??
    0;

  if (
    now - lastCleanup <
    RATE_LIMIT_CLEANUP_INTERVAL_MS
  ) {
    return;
  }

  for (
    const [key, record]
    of loginAttempts
  ) {
    const expiresAt = Math.max(
      record.lockedUntil,
      record.lastAttemptAt +
        LOGIN_WINDOW_MS
    );

    if (expiresAt < now) {
      loginAttempts.delete(key);
    }
  }

  globalThis
    .__adminSupportLoginLastCleanup =
    now;
}

function getRateLimitState(
  key: string
): {
  blocked: boolean;
  retryAfterSeconds: number;
} {
  cleanupRateLimits();

  const record =
    loginAttempts.get(key);

  if (!record) {
    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }

  const now = Date.now();

  if (record.lockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          (record.lockedUntil - now) /
            1000
        )
      ),
    };
  }

  if (
    now - record.windowStartedAt >
    LOGIN_WINDOW_MS
  ) {
    loginAttempts.delete(key);

    return {
      blocked: false,
      retryAfterSeconds: 0,
    };
  }

  return {
    blocked: false,
    retryAfterSeconds: 0,
  };
}

function registerFailedAttempt(
  key: string
) {
  const now = Date.now();

  const existing =
    loginAttempts.get(key);

  if (
    !existing ||
    now - existing.windowStartedAt >
      LOGIN_WINDOW_MS
  ) {
    loginAttempts.set(key, {
      attempts: 1,
      windowStartedAt: now,
      lockedUntil: 0,
      lastAttemptAt: now,
    });

    return;
  }

  const attempts =
    existing.attempts + 1;

  loginAttempts.set(key, {
    attempts,
    windowStartedAt:
      existing.windowStartedAt,
    lockedUntil:
      attempts >= MAX_LOGIN_ATTEMPTS
        ? now + LOGIN_LOCK_MS
        : existing.lockedUntil,
    lastAttemptAt: now,
  });
}

function clearFailedAttempts(
  key: string
) {
  loginAttempts.delete(key);
}

function isSameOriginRequest(
  request: Request
): boolean {
  const originHeader =
    request.headers.get("origin");

  /*
   * بعض طلبات الخادم أو أدوات الاختبار
   * لا ترسل Origin.
   */
  if (!originHeader) {
    return true;
  }

  try {
    const requestUrl =
      new URL(request.url);

    const originUrl =
      new URL(originHeader);

    return (
      requestUrl.protocol ===
        originUrl.protocol &&
      requestUrl.host === originUrl.host
    );
  } catch {
    return false;
  }
}

async function enforceMinimumResponseTime(
  startedAt: number
) {
  const randomDelay =
    randomBytes(1)[0] % 151;

  const minimumDuration =
    450 + randomDelay;

  const elapsed =
    Date.now() - startedAt;

  const remaining =
    minimumDuration - elapsed;

  if (remaining > 0) {
    await new Promise<void>(
      (resolve) => {
        setTimeout(resolve, remaining);
      }
    );
  }
}

function invalidCredentialsResponse() {
  return jsonResponse(
    {
      ok: false,
      message:
        "اسم المستخدم أو كلمة المرور غير صحيحة",
    },
    401
  );
}

export async function POST(
  request: Request
) {
  const startedAt = Date.now();

  try {
    if (!isSameOriginRequest(request)) {
      await enforceMinimumResponseTime(
        startedAt
      );

      return jsonResponse(
        {
          ok: false,
          message: "الطلب غير مسموح",
        },
        403
      );
    }

    const contentType =
      request.headers
        .get("content-type")
        ?.toLowerCase() ?? "";

    if (
      !contentType.startsWith(
        "application/json"
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "نوع محتوى الطلب غير مدعوم",
        },
        415
      );
    }

    const contentLengthHeader =
      request.headers.get(
        "content-length"
      );

    if (contentLengthHeader) {
      const contentLength =
        Number(contentLengthHeader);

      if (
        Number.isFinite(
          contentLength
        ) &&
        contentLength >
          MAX_REQUEST_BODY_BYTES
      ) {
        return jsonResponse(
          {
            ok: false,
            message:
              "حجم الطلب أكبر من المسموح",
          },
          413
        );
      }
    }

    let body: LoginRequestBody;

    try {
      const rawBody =
        await request.text();

      if (
        Buffer.byteLength(
          rawBody,
          "utf8"
        ) > MAX_REQUEST_BODY_BYTES
      ) {
        return jsonResponse(
          {
            ok: false,
            message:
              "حجم الطلب أكبر من المسموح",
          },
          413
        );
      }

      body =
        JSON.parse(
          rawBody
        ) as LoginRequestBody;
    } catch {
      await enforceMinimumResponseTime(
        startedAt
      );

      return jsonResponse(
        {
          ok: false,
          message:
            "بيانات الطلب غير صحيحة",
        },
        400
      );
    }

    const username =
      normalizeUsername(
        body.username
      );

    const password =
      readPassword(
        body.password
      );

    if (
      username.length <
        MIN_USERNAME_LENGTH ||
      username.length >
        MAX_USERNAME_LENGTH ||
      password.length <
        MIN_PASSWORD_LENGTH ||
      password.length >
        MAX_PASSWORD_LENGTH
    ) {
      await enforceMinimumResponseTime(
        startedAt
      );

      return invalidCredentialsResponse();
    }

    const rateLimitKey =
      createRateLimitKey(
        request,
        username
      );

    const rateLimitState =
      getRateLimitState(
        rateLimitKey
      );

    if (rateLimitState.blocked) {
      await enforceMinimumResponseTime(
        startedAt
      );

      return jsonResponse(
        {
          ok: false,
          message:
            "تم تعليق محاولات الدخول مؤقتًا، حاول لاحقًا",
        },
        429,
        {
          "Retry-After": String(
            rateLimitState
              .retryAfterSeconds
          ),
        }
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
      "verify_admin_support_login",
      {
        p_username: username,
        p_password: password,
      }
    );

    if (error) {
      console.error(
        "verify_admin_support_login failed",
        {
          code: error.code,
          message: error.message,
        }
      );

      await enforceMinimumResponseTime(
        startedAt
      );

      return jsonResponse(
        {
          ok: false,
          message:
            "تعذر إتمام تسجيل الدخول حاليًا",
        },
        503
      );
    }

    const rawResult =
      Array.isArray(data)
        ? data[0]
        : data;

    const result =
      rawResult &&
      typeof rawResult === "object" &&
      !Array.isArray(rawResult)
        ? (rawResult as SupportLoginResult)
        : null;

    const userId =
      typeof result?.id === "string"
        ? result.id.trim()
        : typeof result?.user_id ===
            "string"
          ? result.user_id.trim()
          : "";

    const fullName =
      typeof result?.full_name ===
      "string"
        ? result.full_name.trim()
        : "";

    const verifiedUsername =
      typeof result?.username ===
      "string"
        ? normalizeUsername(
            result.username
          )
        : "";

    const role =
      typeof result?.role ===
      "string"
        ? result.role.trim()
        : "";

    const permissions =
      normalizePermissions(
        result?.permissions
      );

    const sessionVersion =
      normalizeSessionVersion(
        result?.session_version
      );

    /*
     * يجب أن تكون true صراحة.
     * null أو undefined لا يعنيان "تفضل يا بطل".
     */
    const isActive =
      result?.is_active === true;

    if (
      !result ||
      !userId ||
      !verifiedUsername ||
      !role ||
      !isActive
    ) {
      registerFailedAttempt(
        rateLimitKey
      );

      await enforceMinimumResponseTime(
        startedAt
      );

      return invalidCredentialsResponse();
    }

    clearFailedAttempts(
      rateLimitKey
    );

    const sessionToken =
      createAdminSupportSessionToken({
        userId,
        username:
          verifiedUsername,
        fullName:
          fullName ||
          verifiedUsername,
        role,
        permissions,
        sessionVersion,
      });

    const response =
      jsonResponse(
        {
          ok: true,
        },
        200
      );

    response.cookies.set(
      ADMIN_SUPPORT_COOKIE_NAME,
      sessionToken,
      adminSupportCookieOptions
    );

    return response;
  } catch (error) {
    console.error(
      "Admin support login route error",
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
          }
        : {
            message:
              "Unknown login route error",
          }
    );

    await enforceMinimumResponseTime(
      startedAt
    );

    return jsonResponse(
      {
        ok: false,
        message:
          "تعذر إتمام تسجيل الدخول حاليًا",
      },
      500
    );
  }
}
