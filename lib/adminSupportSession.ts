import "server-only";

import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "crypto";

const IS_PRODUCTION =
  process.env.NODE_ENV === "production";

const TOKEN_VERSION = "v1";

const ADMIN_SUPPORT_SESSION_KIND =
  "admin_support_session" as const;

const ADMIN_SUPPORT_IMPERSONATION_KIND =
  "admin_support_impersonation" as const;

export const ADMIN_SUPPORT_SESSION_DURATION_SECONDS =
  60 * 60 * 8;

export const ADMIN_SUPPORT_IMPERSONATION_DURATION_SECONDS =
  60 * 60;

const MAX_CLOCK_SKEW_SECONDS = 60;

const MAX_TOKEN_LENGTH = 8192;

const MAX_ENCODED_PAYLOAD_LENGTH = 6144;

const SHA256_SIGNATURE_LENGTH = 32;

const SHA256_BASE64URL_SIGNATURE_LENGTH = 43;

const BASE64URL_PATTERN =
  /^[A-Za-z0-9_-]+$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const USERNAME_PATTERN =
  /^[\p{L}\p{N}._-]{2,50}$/u;

const ROLE_PATTERN =
  /^[a-z][a-z0-9_]{1,63}$/;

const PERMISSION_KEY_PATTERN =
  /^[a-z][a-z0-9_]{1,99}$/;

const BRANCH_SLUG_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

export const ADMIN_SUPPORT_COOKIE_NAME =
  IS_PRODUCTION
    ? "__Host-admin_support_session"
    : "admin_support_session";

export const ADMIN_SUPPORT_IMPERSONATION_COOKIE_NAME =
  IS_PRODUCTION
    ? "__Secure-admin_support_impersonation"
    : "admin_support_impersonation";

export type AdminSupportSession = {
  kind: typeof ADMIN_SUPPORT_SESSION_KIND;
  tokenVersion: typeof TOKEN_VERSION;
  sessionId: string;
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
  kind: typeof ADMIN_SUPPORT_IMPERSONATION_KIND;
  tokenVersion: typeof TOKEN_VERSION;
  impersonationId: string;
  supportSessionId: string;
  supportUserId: string;
  supportUsername: string;
  supportFullName: string;
  supportSessionVersion: number;
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

type CreateAdminSupportImpersonationInput = {
  supportSessionId: string;
  supportUserId: string;
  supportUsername: string;
  supportFullName: string;
  supportSessionVersion: number;
  branchId: string;
  branchSlug: string;
  branchName: string;
};

type SessionTokenPurpose =
  | "support-session"
  | "support-impersonation";

function cleanText(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function isValidUuid(
  value: string
): boolean {
  return UUID_PATTERN.test(value);
}

function normalizeUsername(
  value: unknown
): string | null {
  const username =
    cleanText(value).toLowerCase();

  if (
    !USERNAME_PATTERN.test(username)
  ) {
    return null;
  }

  return username;
}

function normalizeFullName(
  value: unknown
): string | null {
  const fullName =
    cleanText(value);

  if (
    fullName.length < 2 ||
    fullName.length > 150
  ) {
    return null;
  }

  return fullName;
}

function normalizeRole(
  value: unknown
): string | null {
  const role =
    cleanText(value).toLowerCase();

  if (!ROLE_PATTERN.test(role)) {
    return null;
  }

  return role;
}

function normalizePermissionKey(
  value: unknown
): string | null {
  const permission =
    cleanText(value).toLowerCase();

  if (
    !PERMISSION_KEY_PATTERN.test(
      permission
    )
  ) {
    return null;
  }

  return permission;
}

function normalizePermissions(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const permissions =
    new Set<string>();

  for (const item of value) {
    const permission =
      normalizePermissionKey(item);

    if (permission) {
      permissions.add(permission);
    }

    if (permissions.size >= 200) {
      break;
    }
  }

  return Array.from(permissions).sort(
    (first, second) =>
      first.localeCompare(second)
  );
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

function normalizeUnixTimestamp(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    return null;
  }

  return value;
}

function normalizeBranchSlug(
  value: unknown
): string | null {
  const branchSlug =
    cleanText(value).toLowerCase();

  if (
    branchSlug.length < 1 ||
    branchSlug.length > 64 ||
    !BRANCH_SLUG_PATTERN.test(
      branchSlug
    )
  ) {
    return null;
  }

  return branchSlug;
}

function normalizeBranchName(
  value: unknown
): string | null {
  const branchName =
    cleanText(value);

  if (
    branchName.length < 1 ||
    branchName.length > 150
  ) {
    return null;
  }

  return branchName;
}

function containsWrappingQuotes(
  value: string
): boolean {
  return (
    (value.startsWith('"') &&
      value.endsWith('"')) ||
    (value.startsWith("'") &&
      value.endsWith("'"))
  );
}

function validateSessionSecret(
  environmentName: string,
  rawSecret: string
): Buffer {
  if (
    rawSecret !== rawSecret.trim()
  ) {
    throw new Error(
      `${environmentName} يحتوي مسافات زائدة في بدايته أو نهايته`
    );
  }

  if (
    containsWrappingQuotes(
      rawSecret
    )
  ) {
    throw new Error(
      `${environmentName} يحتوي علامات اقتباس زائدة`
    );
  }

  if (
    /[\r\n\t]/.test(rawSecret)
  ) {
    throw new Error(
      `${environmentName} يحتوي أسطرًا أو محارف غير صالحة`
    );
  }

  const secret =
    Buffer.from(
      rawSecret,
      "utf8"
    );

  if (secret.byteLength < 32) {
    throw new Error(
      `${environmentName} يجب ألا يقل عن 32 بايت`
    );
  }

  return secret;
}

function assertSecretIsNotExposed(
  environmentName: string,
  rawSecret: string
): void {
  const exposedNames = [
    "NEXT_PUBLIC_ADMIN_SUPPORT_SESSION_SECRET",
    "NEXT_PUBLIC_ADMIN_SUPPORT_SESSION_PREVIOUS_SECRET",
    `NEXT_PUBLIC_${environmentName}`,
  ];

  for (
    const exposedName
    of exposedNames
  ) {
    const exposedValue =
      process.env[exposedName];

    if (
      exposedValue &&
      exposedValue.trim()
    ) {
      throw new Error(
        `خطأ أمني: يجب حذف ${exposedName} من متغيرات البيئة العامة`
      );
    }
  }

  const publicKeys = [
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ]
    .map((value) =>
      value?.trim() ?? ""
    )
    .filter(Boolean);

  if (
    publicKeys.includes(rawSecret)
  ) {
    throw new Error(
      `${environmentName} يطابق مفتاحًا عامًا ولا يصلح لتوقيع الجلسات`
    );
  }
}

function getSecretBytes(
  environmentName:
    | "ADMIN_SUPPORT_SESSION_SECRET"
    | "ADMIN_SUPPORT_SESSION_PREVIOUS_SECRET"
): Buffer | null {
  const rawSecret =
    process.env[environmentName];

  if (
    rawSecret === undefined ||
    rawSecret === ""
  ) {
    return null;
  }

  assertSecretIsNotExposed(
    environmentName,
    rawSecret
  );

  return validateSessionSecret(
    environmentName,
    rawSecret
  );
}

function getCurrentSecret(): Buffer {
  const secret =
    getSecretBytes(
      "ADMIN_SUPPORT_SESSION_SECRET"
    );

  if (!secret) {
    throw new Error(
      "ADMIN_SUPPORT_SESSION_SECRET غير موجود"
    );
  }

  return secret;
}

function getVerificationSecrets(): Buffer[] {
  const currentSecret =
    getCurrentSecret();

  const previousSecret =
    getSecretBytes(
      "ADMIN_SUPPORT_SESSION_PREVIOUS_SECRET"
    );

  if (
    previousSecret &&
    !currentSecret.equals(
      previousSecret
    )
  ) {
    return [
      currentSecret,
      previousSecret,
    ];
  }

  return [currentSecret];
}

function isCanonicalBase64Url(
  value: string,
  maximumLength: number
): boolean {
  return (
    value.length > 0 &&
    value.length <= maximumLength &&
    BASE64URL_PATTERN.test(value) &&
    !value.includes("=")
  );
}

function toBase64Url(
  value: string
): string {
  return Buffer.from(
    value,
    "utf8"
  ).toString("base64url");
}

function fromBase64Url(
  value: string
): string | null {
  if (
    !isCanonicalBase64Url(
      value,
      MAX_ENCODED_PAYLOAD_LENGTH
    )
  ) {
    return null;
  }

  try {
    const buffer =
      Buffer.from(
        value,
        "base64url"
      );

    if (
      buffer.byteLength === 0 ||
      buffer.toString(
        "base64url"
      ) !== value
    ) {
      return null;
    }

    return buffer.toString("utf8");
  } catch {
    return null;
  }
}

function createSignature(
  signedContent: string,
  purpose: SessionTokenPurpose,
  secret: Buffer
): string {
  return createHmac(
    "sha256",
    secret
  )
    .update(
      `ehtisab:${purpose}:${signedContent}`,
      "utf8"
    )
    .digest("base64url");
}

function decodeSignature(
  value: string
): Buffer | null {
  if (
    value.length !==
      SHA256_BASE64URL_SIGNATURE_LENGTH ||
    !isCanonicalBase64Url(
      value,
      SHA256_BASE64URL_SIGNATURE_LENGTH
    )
  ) {
    return null;
  }

  try {
    const decoded =
      Buffer.from(
        value,
        "base64url"
      );

    if (
      decoded.byteLength !==
        SHA256_SIGNATURE_LENGTH ||
      decoded.toString(
        "base64url"
      ) !== value
    ) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

function signaturesMatch(
  receivedSignature: string,
  expectedSignature: string
): boolean {
  const received =
    decodeSignature(
      receivedSignature
    );

  const expected =
    decodeSignature(
      expectedSignature
    );

  if (
    !received ||
    !expected ||
    received.byteLength !==
      expected.byteLength
  ) {
    return false;
  }

  return timingSafeEqual(
    received,
    expected
  );
}

function hasValidSignature(
  signedContent: string,
  receivedSignature: string,
  purpose: SessionTokenPurpose
): boolean {
  const secrets =
    getVerificationSecrets();

  let valid = false;

  for (const secret of secrets) {
    const expectedSignature =
      createSignature(
        signedContent,
        purpose,
        secret
      );

    const matches =
      signaturesMatch(
        receivedSignature,
        expectedSignature
      );

    valid = matches || valid;
  }

  return valid;
}

function createSignedToken(
  payload: object,
  purpose: SessionTokenPurpose
): string {
  const encodedPayload =
    toBase64Url(
      JSON.stringify(payload)
    );

  if (
    encodedPayload.length >
    MAX_ENCODED_PAYLOAD_LENGTH
  ) {
    throw new Error(
      "بيانات الجلسة تجاوزت الحد المسموح"
    );
  }

  const signedContent =
    `${TOKEN_VERSION}.${encodedPayload}`;

  const signature =
    createSignature(
      signedContent,
      purpose,
      getCurrentSecret()
    );

  const token =
    `${signedContent}.${signature}`;

  if (
    token.length >
    MAX_TOKEN_LENGTH
  ) {
    throw new Error(
      "رمز الجلسة تجاوز الحد المسموح"
    );
  }

  return token;
}

function readSignedPayload(
  token: string | null | undefined,
  purpose: SessionTokenPurpose
): unknown | null {
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length >
      MAX_TOKEN_LENGTH ||
    token !== token.trim()
  ) {
    return null;
  }

  const parts =
    token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [
    tokenVersion,
    encodedPayload,
    receivedSignature,
  ] = parts;

  if (
    tokenVersion !== TOKEN_VERSION ||
    !isCanonicalBase64Url(
      encodedPayload,
      MAX_ENCODED_PAYLOAD_LENGTH
    ) ||
    receivedSignature.length !==
      SHA256_BASE64URL_SIGNATURE_LENGTH
  ) {
    return null;
  }

  const signedContent =
    `${tokenVersion}.${encodedPayload}`;

  if (
    !hasValidSignature(
      signedContent,
      receivedSignature,
      purpose
    )
  ) {
    return null;
  }

  const decodedPayload =
    fromBase64Url(
      encodedPayload
    );

  if (!decodedPayload) {
    return null;
  }

  try {
    return JSON.parse(
      decodedPayload
    ) as unknown;
  } catch {
    return null;
  }
}

function hasCanonicalTextValue(
  rawValue: unknown,
  normalizedValue: string
): boolean {
  return (
    typeof rawValue === "string" &&
    rawValue === normalizedValue
  );
}

function hasValidSessionTimes(
  issuedAt: number,
  expiresAt: number,
  maximumDurationSeconds: number
): boolean {
  const now =
    Math.floor(
      Date.now() / 1000
    );

  if (
    issuedAt >
    now + MAX_CLOCK_SKEW_SECONDS
  ) {
    return false;
  }

  if (expiresAt <= now) {
    return false;
  }

  if (expiresAt <= issuedAt) {
    return false;
  }

  const duration =
    expiresAt - issuedAt;

  if (
    duration <= 0 ||
    duration >
      maximumDurationSeconds
  ) {
    return false;
  }

  if (
    now - issuedAt >
      maximumDurationSeconds +
        MAX_CLOCK_SKEW_SECONDS
  ) {
    return false;
  }

  return true;
}

export function createAdminSupportSessionToken(
  input: CreateAdminSupportSessionInput
): string {
  const userId =
    cleanText(input.userId);

  const username =
    normalizeUsername(
      input.username
    );

  const fullName =
    normalizeFullName(
      input.fullName
    );

  const role =
    normalizeRole(input.role);

  const permissions =
    normalizePermissions(
      input.permissions
    );

  const sessionVersion =
    normalizeSessionVersion(
      input.sessionVersion
    );

  if (!isValidUuid(userId)) {
    throw new Error(
      "معرف مستخدم الدعم غير صحيح"
    );
  }

  if (!username) {
    throw new Error(
      "اسم مستخدم الدعم غير صحيح"
    );
  }

  if (!fullName) {
    throw new Error(
      "اسم مستخدم الدعم الكامل غير صحيح"
    );
  }

  if (!role) {
    throw new Error(
      "دور مستخدم الدعم غير صحيح"
    );
  }

  if (sessionVersion === null) {
    throw new Error(
      "إصدار جلسة مستخدم الدعم غير صحيح"
    );
  }

  const now =
    Math.floor(
      Date.now() / 1000
    );

  const session: AdminSupportSession = {
    kind:
      ADMIN_SUPPORT_SESSION_KIND,

    tokenVersion:
      TOKEN_VERSION,

    sessionId:
      randomUUID(),

    userId,
    username,
    fullName,
    role,
    permissions,
    sessionVersion,

    issuedAt: now,

    expiresAt:
      now +
      ADMIN_SUPPORT_SESSION_DURATION_SECONDS,
  };

  return createSignedToken(
    session,
    "support-session"
  );
}

export function verifyAdminSupportSessionToken(
  token: string | null | undefined
): AdminSupportSession | null {
  const payload =
    readSignedPayload(
      token,
      "support-session"
    );

  if (!isPlainObject(payload)) {
    return null;
  }

  const kind =
    cleanText(payload.kind);

  const tokenVersion =
    cleanText(
      payload.tokenVersion
    );

  const sessionId =
    cleanText(
      payload.sessionId
    );

  const userId =
    cleanText(
      payload.userId
    );

  const username =
    normalizeUsername(
      payload.username
    );

  const fullName =
    normalizeFullName(
      payload.fullName
    );

  const role =
    normalizeRole(
      payload.role
    );

  const sessionVersion =
    normalizeSessionVersion(
      payload.sessionVersion
    );

  const issuedAt =
    normalizeUnixTimestamp(
      payload.issuedAt
    );

  const expiresAt =
    normalizeUnixTimestamp(
      payload.expiresAt
    );

  if (
    kind !==
      ADMIN_SUPPORT_SESSION_KIND ||
    tokenVersion !==
      TOKEN_VERSION ||
    !username ||
    !fullName ||
    !role ||
    !hasCanonicalTextValue(
      payload.kind,
      kind
    ) ||
    !hasCanonicalTextValue(
      payload.tokenVersion,
      tokenVersion
    ) ||
    !hasCanonicalTextValue(
      payload.sessionId,
      sessionId
    ) ||
    !hasCanonicalTextValue(
      payload.userId,
      userId
    ) ||
    !hasCanonicalTextValue(
      payload.username,
      username
    ) ||
    !hasCanonicalTextValue(
      payload.fullName,
      fullName
    ) ||
    !hasCanonicalTextValue(
      payload.role,
      role
    ) ||
    !isValidUuid(sessionId) ||
    !isValidUuid(userId) ||
    !Array.isArray(
      payload.permissions
    ) ||
    sessionVersion === null ||
    issuedAt === null ||
    expiresAt === null ||
    !hasValidSessionTimes(
      issuedAt,
      expiresAt,
      ADMIN_SUPPORT_SESSION_DURATION_SECONDS
    )
  ) {
    return null;
  }

  const permissions =
    normalizePermissions(
      payload.permissions
    );

  return {
    kind:
      ADMIN_SUPPORT_SESSION_KIND,

    tokenVersion:
      TOKEN_VERSION,

    sessionId,
    userId,
    username,
    fullName,
    role,
    permissions,
    sessionVersion,
    issuedAt,
    expiresAt,
  };
}

export function createAdminSupportImpersonationToken(
  input: CreateAdminSupportImpersonationInput
): string {
  const supportSessionId =
    cleanText(
      input.supportSessionId
    );

  const supportUserId =
    cleanText(
      input.supportUserId
    );

  const supportUsername =
    normalizeUsername(
      input.supportUsername
    );

  const supportFullName =
    normalizeFullName(
      input.supportFullName
    );

  const supportSessionVersion =
    normalizeSessionVersion(
      input.supportSessionVersion
    );

  const branchId =
    cleanText(input.branchId);

  const branchSlug =
    normalizeBranchSlug(
      input.branchSlug
    );

  const branchName =
    normalizeBranchName(
      input.branchName
    );

  if (
    !isValidUuid(
      supportSessionId
    )
  ) {
    throw new Error(
      "معرف جلسة الدعم الأصلية غير صحيح"
    );
  }

  if (
    !isValidUuid(
      supportUserId
    )
  ) {
    throw new Error(
      "معرف مستخدم الدعم غير صحيح"
    );
  }

  if (!supportUsername) {
    throw new Error(
      "اسم مستخدم الدعم غير صحيح"
    );
  }

  if (!supportFullName) {
    throw new Error(
      "اسم مستخدم الدعم الكامل غير صحيح"
    );
  }

  if (
    supportSessionVersion === null
  ) {
    throw new Error(
      "إصدار جلسة مستخدم الدعم غير صحيح"
    );
  }

  if (!isValidUuid(branchId)) {
    throw new Error(
      "معرف الفرع غير صحيح"
    );
  }

  if (!branchSlug) {
    throw new Error(
      "رابط الفرع غير صحيح"
    );
  }

  if (!branchName) {
    throw new Error(
      "اسم الفرع غير صحيح"
    );
  }

  const now =
    Math.floor(
      Date.now() / 1000
    );

  const session: AdminSupportImpersonationSession = {
    kind:
      ADMIN_SUPPORT_IMPERSONATION_KIND,

    tokenVersion:
      TOKEN_VERSION,

    impersonationId:
      randomUUID(),

    supportSessionId,
    supportUserId,
    supportUsername,
    supportFullName,
    supportSessionVersion,

    branchId,
    branchSlug,
    branchName,

    issuedAt: now,

    expiresAt:
      now +
      ADMIN_SUPPORT_IMPERSONATION_DURATION_SECONDS,
  };

  return createSignedToken(
    session,
    "support-impersonation"
  );
}

export function verifyAdminSupportImpersonationToken(
  token: string | null | undefined
): AdminSupportImpersonationSession | null {
  const payload =
    readSignedPayload(
      token,
      "support-impersonation"
    );

  if (!isPlainObject(payload)) {
    return null;
  }

  const kind =
    cleanText(payload.kind);

  const tokenVersion =
    cleanText(
      payload.tokenVersion
    );

  const impersonationId =
    cleanText(
      payload.impersonationId
    );

  const supportSessionId =
    cleanText(
      payload.supportSessionId
    );

  const supportUserId =
    cleanText(
      payload.supportUserId
    );

  const supportUsername =
    normalizeUsername(
      payload.supportUsername
    );

  const supportFullName =
    normalizeFullName(
      payload.supportFullName
    );

  const supportSessionVersion =
    normalizeSessionVersion(
      payload.supportSessionVersion
    );

  const branchId =
    cleanText(
      payload.branchId
    );

  const branchSlug =
    normalizeBranchSlug(
      payload.branchSlug
    );

  const branchName =
    normalizeBranchName(
      payload.branchName
    );

  const issuedAt =
    normalizeUnixTimestamp(
      payload.issuedAt
    );

  const expiresAt =
    normalizeUnixTimestamp(
      payload.expiresAt
    );

  if (
    kind !==
      ADMIN_SUPPORT_IMPERSONATION_KIND ||
    tokenVersion !==
      TOKEN_VERSION ||
    !supportUsername ||
    !supportFullName ||
    !branchSlug ||
    !branchName ||
    !hasCanonicalTextValue(
      payload.kind,
      kind
    ) ||
    !hasCanonicalTextValue(
      payload.tokenVersion,
      tokenVersion
    ) ||
    !hasCanonicalTextValue(
      payload.impersonationId,
      impersonationId
    ) ||
    !hasCanonicalTextValue(
      payload.supportSessionId,
      supportSessionId
    ) ||
    !hasCanonicalTextValue(
      payload.supportUserId,
      supportUserId
    ) ||
    !hasCanonicalTextValue(
      payload.supportUsername,
      supportUsername
    ) ||
    !hasCanonicalTextValue(
      payload.supportFullName,
      supportFullName
    ) ||
    !hasCanonicalTextValue(
      payload.branchId,
      branchId
    ) ||
    !hasCanonicalTextValue(
      payload.branchSlug,
      branchSlug
    ) ||
    !hasCanonicalTextValue(
      payload.branchName,
      branchName
    ) ||
    !isValidUuid(
      impersonationId
    ) ||
    !isValidUuid(
      supportSessionId
    ) ||
    !isValidUuid(
      supportUserId
    ) ||
    !isValidUuid(branchId) ||
    supportSessionVersion === null ||
    issuedAt === null ||
    expiresAt === null ||
    !hasValidSessionTimes(
      issuedAt,
      expiresAt,
      ADMIN_SUPPORT_IMPERSONATION_DURATION_SECONDS
    )
  ) {
    return null;
  }

  return {
    kind:
      ADMIN_SUPPORT_IMPERSONATION_KIND,

    tokenVersion:
      TOKEN_VERSION,

    impersonationId,
    supportSessionId,
    supportUserId,
    supportUsername,
    supportFullName,
    supportSessionVersion,

    branchId,
    branchSlug,
    branchName,

    issuedAt,
    expiresAt,
  };
}

/**
 * هذه الدالة تصلح لإظهار أو إخفاء عناصر الواجهة فقط.
 * لا يجوز استخدامها وحدها لتفويض عمليات API الحساسة.
 * مسارات الخادم يجب أن تستخدم verifyAdminSupportRequest.
 */
export function hasAdminSupportPermission(
  session: AdminSupportSession,
  permission: string
): boolean {
  const cleanPermission =
    normalizePermissionKey(
      permission
    );

  if (!cleanPermission) {
    return false;
  }

  return (
    session.role ===
      "super_admin" ||
    session.permissions.includes(
      cleanPermission
    )
  );
}

export const adminSupportCookieOptions =
  Object.freeze({
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict" as const,
    path: "/",
    maxAge:
      ADMIN_SUPPORT_SESSION_DURATION_SECONDS,
    priority: "high" as const,
  });

export const adminSupportCookieDeleteOptions =
  Object.freeze({
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    priority: "high" as const,
  });

export const adminSupportImpersonationCookieOptions =
  Object.freeze({
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict" as const,
    path: "/finance",
    maxAge:
      ADMIN_SUPPORT_IMPERSONATION_DURATION_SECONDS,
    priority: "high" as const,
  });

export const adminSupportImpersonationCookieDeleteOptions =
  Object.freeze({
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict" as const,
    path: "/finance",
    maxAge: 0,
    expires: new Date(0),
    priority: "high" as const,
  });
