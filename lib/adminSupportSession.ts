import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "crypto";

export const ADMIN_SUPPORT_COOKIE_NAME =
  "admin_support_session";

export const ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME =
  "admin_support_impersonation";

const SESSION_DURATION_SECONDS =
  60 * 60 * 8;

const IMPERSONATION_DURATION_SECONDS =
  60 * 60;

export type AdminSupportSession = {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
};

export type AdminSupportImpersonationSession = {
  kind: "admin_support_impersonation";
  supportUserId: string;
  supportUsername: string;
  supportFullName: string;
  branchId: string;
  branchSlug: string;
  branchName: string;
  issuedAt: number;
  expiresAt: number;
};

type CreateAdminSupportSessionInput = {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  sessionVersion: number;
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

function cleanText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeSessionVersion(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return null;
  }

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

function toBase64Url(
  value: string
) {
  return Buffer.from(
    value,
    "utf8"
  ).toString("base64url");
}

function fromBase64Url(
  value: string
) {
  return Buffer.from(
    value,
    "base64url"
  ).toString("utf8");
}

function createSignature(
  payload: string
) {
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

    if (
      received.length !==
      expected.length
    ) {
      return false;
    }

    return timingSafeEqual(
      received,
      expected
    );
  } catch {
    return false;
  }
}

function createSignedToken(
  payload: object
) {
  const encodedPayload =
    toBase64Url(
      JSON.stringify(payload)
    );

  const signature =
    createSignature(
      encodedPayload
    );

  return `${encodedPayload}.${signature}`;
}

function readSignedPayload(
  token: string | null | undefined
): unknown | null {
  if (
    !token ||
    token.length > 8192
  ) {
    return null;
  }

  const parts =
    token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [
    encodedPayload,
    receivedSignature,
  ] = parts;

  if (
    !encodedPayload ||
    !receivedSignature
  ) {
    return null;
  }

  const expectedSignature =
    createSignature(
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
    return JSON.parse(
      fromBase64Url(
        encodedPayload
      )
    ) as unknown;
  } catch {
    return null;
  }
}

function hasValidSessionTimes(
  issuedAt: unknown,
  expiresAt: unknown,
  maximumDurationSeconds: number
) {
  if (
    typeof issuedAt !== "number" ||
    !Number.isSafeInteger(issuedAt) ||
    typeof expiresAt !== "number" ||
    !Number.isSafeInteger(expiresAt)
  ) {
    return false;
  }

  const now = Math.floor(
    Date.now() / 1000
  );

  if (issuedAt > now + 60) {
    return false;
  }

  if (expiresAt <= now) {
    return false;
  }

  if (expiresAt <= issuedAt) {
    return false;
  }

  if (
    expiresAt - issuedAt >
    maximumDurationSeconds
  ) {
    return false;
  }

  return true;
}

export function createAdminSupportSessionToken(
  input: CreateAdminSupportSessionInput
) {
  const userId =
    cleanText(input.userId);

  const username =
    cleanText(
      input.username
    ).toLowerCase();

  const fullName =
    cleanText(input.fullName);

  const role =
    cleanText(input.role);

  const permissions =
    normalizePermissions(
      input.permissions
    );

  const sessionVersion =
    normalizeSessionVersion(
      input.sessionVersion
    );

  if (
    !userId ||
    !username ||
    !fullName ||
    !role ||
    sessionVersion === null
  ) {
    throw new Error(
      "بيانات جلسة الدعم الفني غير مكتملة"
    );
  }

  const now = Math.floor(
    Date.now() / 1000
  );

  const session: AdminSupportSession = {
    userId,
    username,
    fullName,
    role,
    permissions,
    sessionVersion,
    issuedAt: now,
    expiresAt:
      now + SESSION_DURATION_SECONDS,
  };

  return createSignedToken(
    session
  );
}

export function verifyAdminSupportSessionToken(
  token: string | null | undefined
): AdminSupportSession | null {
  const payload =
    readSignedPayload(token);

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const parsed =
    payload as Partial<AdminSupportSession>;

  const userId =
    cleanText(parsed.userId);

  const username =
    cleanText(
      parsed.username
    ).toLowerCase();

  const fullName =
    cleanText(parsed.fullName);

  const role =
    cleanText(parsed.role);

  const sessionVersion =
    normalizeSessionVersion(
      parsed.sessionVersion
    );

  if (
    !userId ||
    !username ||
    !fullName ||
    !role ||
    !Array.isArray(
      parsed.permissions
    ) ||
    sessionVersion === null ||
    !hasValidSessionTimes(
      parsed.issuedAt,
      parsed.expiresAt,
      SESSION_DURATION_SECONDS
    )
  ) {
    return null;
  }

  return {
    userId,
    username,
    fullName,
    role,
    permissions:
      normalizePermissions(
        parsed.permissions
      ),
    sessionVersion,
    issuedAt:
      parsed.issuedAt as number,
    expiresAt:
      parsed.expiresAt as number,
  };
}

export function createAdminSupportImpersonationToken(
  input: Omit<
    AdminSupportImpersonationSession,
    "kind" | "issuedAt" | "expiresAt"
  >
) {
  const supportUserId =
    cleanText(
      input.supportUserId
    );

  const supportUsername =
    cleanText(
      input.supportUsername
    );

  const supportFullName =
    cleanText(
      input.supportFullName
    );

  const branchId =
    cleanText(input.branchId);

  const branchSlug =
    cleanText(
      input.branchSlug
    ).toLowerCase();

  const branchName =
    cleanText(input.branchName);

  if (
    !supportUserId ||
    !supportUsername ||
    !supportFullName ||
    !branchId ||
    !branchSlug ||
    !branchName
  ) {
    throw new Error(
      "بيانات جلسة دخول الفرع غير مكتملة"
    );
  }

  const now = Math.floor(
    Date.now() / 1000
  );

  const session: AdminSupportImpersonationSession =
    {
      kind:
        "admin_support_impersonation",
      supportUserId,
      supportUsername,
      supportFullName,
      branchId,
      branchSlug,
      branchName,
      issuedAt: now,
      expiresAt:
        now +
        IMPERSONATION_DURATION_SECONDS,
    };

  return createSignedToken(
    session
  );
}

export function verifyAdminSupportImpersonationToken(
  token: string | null | undefined
): AdminSupportImpersonationSession | null {
  const payload =
    readSignedPayload(token);

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const parsed =
    payload as Partial<AdminSupportImpersonationSession>;

  const supportUserId =
    cleanText(
      parsed.supportUserId
    );

  const supportUsername =
    cleanText(
      parsed.supportUsername
    );

  const supportFullName =
    cleanText(
      parsed.supportFullName
    );

  const branchId =
    cleanText(parsed.branchId);

  const branchSlug =
    cleanText(
      parsed.branchSlug
    ).toLowerCase();

  const branchName =
    cleanText(parsed.branchName);

  if (
    parsed.kind !==
      "admin_support_impersonation" ||
    !supportUserId ||
    !supportUsername ||
    !supportFullName ||
    !branchId ||
    !branchSlug ||
    !branchName ||
    !hasValidSessionTimes(
      parsed.issuedAt,
      parsed.expiresAt,
      IMPERSONATION_DURATION_SECONDS
    )
  ) {
    return null;
  }

  return {
    kind:
      "admin_support_impersonation",
    supportUserId,
    supportUsername,
    supportFullName,
    branchId,
    branchSlug,
    branchName,
    issuedAt:
      parsed.issuedAt as number,
    expiresAt:
      parsed.expiresAt as number,
  };
}

export function hasAdminSupportPermission(
  session: AdminSupportSession,
  permission: string
) {
  const cleanPermission =
    cleanText(permission);

  if (!cleanPermission) {
    return false;
  }

  return (
    session.role === "super_admin" ||
    session.permissions.includes(
      cleanPermission
    )
  );
}

export const adminSupportCookieOptions = {
  httpOnly: true,

  secure:
    process.env.NODE_ENV ===
    "production",

  sameSite: "strict" as const,

  path: "/",

  maxAge:
    SESSION_DURATION_SECONDS,

  priority: "high" as const,
};

export const adminSupportImpersonationCookieOptions =
  {
    httpOnly: true,

    secure:
      process.env.NODE_ENV ===
      "production",

    sameSite: "strict" as const,

    path: "/finance",

    maxAge:
      IMPERSONATION_DURATION_SECONDS,

    priority: "high" as const,
  };
