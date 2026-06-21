import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "crypto";

export const ADMIN_SUPPORT_COOKIE_NAME =
  "admin_support_session";

const SESSION_DURATION_SECONDS = 60 * 60 * 8;

export type AdminSupportSession = {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  issuedAt: number;
  expiresAt: number;
};

function getSessionSecret() {
  const secret =
    process.env.ADMIN_SUPPORT_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_SUPPORT_SESSION_SECRET غير موجود أو قصير جدًا"
    );
  }

  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString(
    "base64url"
  );
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString(
    "utf8"
  );
}

function createSignature(payload: string) {
  return createHmac(
    "sha256",
    getSessionSecret()
  )
    .update(payload)
    .digest("base64url");
}

function signaturesMatch(
  receivedSignature: string,
  expectedSignature: string
) {
  try {
    const received = Buffer.from(
      receivedSignature,
      "base64url"
    );

    const expected = Buffer.from(
      expectedSignature,
      "base64url"
    );

    if (received.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

export function createAdminSupportSessionToken(
  input: Omit<
    AdminSupportSession,
    "issuedAt" | "expiresAt"
  >
) {
  const now = Math.floor(Date.now() / 1000);

  const session: AdminSupportSession = {
    ...input,
    permissions: Array.isArray(input.permissions)
      ? input.permissions
      : [],
    issuedAt: now,
    expiresAt: now + SESSION_DURATION_SECONDS,
  };

  const encodedPayload = toBase64Url(
    JSON.stringify(session)
  );

  const signature = createSignature(
    encodedPayload
  );

  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSupportSessionToken(
  token: string | null | undefined
): AdminSupportSession | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, receivedSignature] =
    parts;

  if (
    !encodedPayload ||
    !receivedSignature
  ) {
    return null;
  }

  const expectedSignature = createSignature(
    encodedPayload
  );

  if (
    !signaturesMatch(
      receivedSignature,
      expectedSignature
    )
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      fromBase64Url(encodedPayload)
    ) as Partial<AdminSupportSession>;

    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.username !== "string" ||
      typeof parsed.fullName !== "string" ||
      typeof parsed.role !== "string" ||
      !Array.isArray(parsed.permissions) ||
      typeof parsed.issuedAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    if (parsed.expiresAt <= now) {
      return null;
    }

    return {
      userId: parsed.userId,
      username: parsed.username,
      fullName: parsed.fullName,
      role: parsed.role,
      permissions: parsed.permissions.filter(
        (permission): permission is string =>
          typeof permission === "string"
      ),
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function hasAdminSupportPermission(
  session: AdminSupportSession,
  permission: string
) {
  return (
    session.role === "super_admin" ||
    session.permissions.includes(permission)
  );
}

export const adminSupportCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
