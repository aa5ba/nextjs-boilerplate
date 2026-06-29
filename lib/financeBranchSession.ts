import "server-only";

import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "crypto";

const IS_PRODUCTION =
  process.env.NODE_ENV === "production";

const TOKEN_VERSION = "v1";

const SESSION_KIND =
  "finance_branch_session" as const;

export const FINANCE_BRANCH_SESSION_DURATION_SECONDS =
  60 * 60 * 3;

const MAX_CLOCK_SKEW_SECONDS = 60;

const MAX_TOKEN_LENGTH = 4096;

const MAX_ENCODED_PAYLOAD_LENGTH = 3072;

const SHA256_BASE64URL_SIGNATURE_LENGTH = 43;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BRANCH_SLUG_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

const BASE64URL_PATTERN =
  /^[A-Za-z0-9_-]+$/;

export const FINANCE_BRANCH_SESSION_COOKIE_NAME =
  IS_PRODUCTION
    ? "__Host-finance_branch_session"
    : "finance_branch_session";

export type FinanceBranchSession = {
  kind: typeof SESSION_KIND;
  tokenVersion: typeof TOKEN_VERSION;
  sessionId: string;
  userId: string;
  branchId: string;
  branchSlug: string;
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
};

type FinanceBranchSessionInput = {
  userId: string;
  branchId: string;
  branchSlug: string;
  sessionVersion: number;
};

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

function normalizeBranchSlug(
  value: unknown
): string {
  return cleanText(value).toLowerCase();
}

function isValidBranchSlug(
  value: string
): boolean {
  return (
    value.length >= 1 &&
    value.length <= 64 &&
    BRANCH_SLUG_PATTERN.test(value)
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

function hasWrappingQuotes(
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
    hasWrappingQuotes(rawSecret)
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

  const secret = Buffer.from(
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

function assertSecretIsNotPublic(
  environmentName: string,
  rawSecret: string
): void {
  const publicEnvironmentNames = [
    `NEXT_PUBLIC_${environmentName}`,
    "NEXT_PUBLIC_FINANCE_BRANCH_SESSION_SECRET",
    "NEXT_PUBLIC_FINANCE_BRANCH_SESSION_PREVIOUS_SECRET",
  ];

  for (
    const publicEnvironmentName
    of publicEnvironmentNames
  ) {
    const exposedValue =
      process.env[
        publicEnvironmentName
      ];

    if (
      exposedValue &&
      exposedValue.trim()
    ) {
      throw new Error(
        `خطأ أمني: يجب حذف ${publicEnvironmentName} من متغيرات البيئة العامة`
      );
    }
  }

  const publicValues = [
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
    publicValues.includes(rawSecret)
  ) {
    throw new Error(
      `${environmentName} يطابق مفتاحًا عامًا ولا يصلح لتوقيع الجلسات`
    );
  }
}

function getSecretBytes(
  environmentName:
    | "FINANCE_BRANCH_SESSION_SECRET"
    | "FINANCE_BRANCH_SESSION_PREVIOUS_SECRET"
): Buffer | null {
  const rawSecret =
    process.env[environmentName];

  if (
    rawSecret === undefined ||
    rawSecret === ""
  ) {
    return null;
  }

  assertSecretIsNotPublic(
    environmentName,
    rawSecret
  );

  return validateSessionSecret(
    environmentName,
    rawSecret
  );
}

function getCurrentSecret(): Buffer {
  const secret = getSecretBytes(
    "FINANCE_BRANCH_SESSION_SECRET"
  );

  if (!secret) {
    throw new Error(
      "FINANCE_BRANCH_SESSION_SECRET غير موجود"
    );
  }

  return secret;
}

function getVerificationSecrets(): Buffer[] {
  const currentSecret =
    getCurrentSecret();

  const previousSecret =
    getSecretBytes(
      "FINANCE_BRANCH_SESSION_PREVIOUS_SECRET"
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
  maxLength: number
): boolean {
  return (
    value.length > 0 &&
    value.length <= maxLength &&
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
  value: string,
  maxLength: number
): string | null {
  if (
    !isCanonicalBase64Url(
      value,
      maxLength
    )
  ) {
    return null;
  }

  try {
    const decodedBuffer =
      Buffer.from(
        value,
        "base64url"
      );

    if (
      decodedBuffer.length === 0
    ) {
      return null;
    }

    const reEncoded =
      decodedBuffer.toString(
        "base64url"
      );

    if (reEncoded !== value) {
      return null;
    }

    return decodedBuffer.toString(
      "utf8"
    );
  } catch {
    return null;
  }
}

function createSignature(
  signedContent: string,
  secret: Buffer
): string {
  return createHmac(
    "sha256",
    secret
  )
    .update(
      `finance-branch-session:${signedContent}`,
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
      decoded.byteLength !== 32 ||
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
  receivedSignature: string
): boolean {
  const secrets =
    getVerificationSecrets();

  let valid = false;

  for (const secret of secrets) {
    const expectedSignature =
      createSignature(
        signedContent,
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
  payload: FinanceBranchSession
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
      "بيانات جلسة موظف الفرع تجاوزت الحد المسموح"
    );
  }

  const signedContent =
    `${TOKEN_VERSION}.${encodedPayload}`;

  const signature =
    createSignature(
      signedContent,
      getCurrentSecret()
    );

  const token =
    `${signedContent}.${signature}`;

  if (
    token.length >
    MAX_TOKEN_LENGTH
  ) {
    throw new Error(
      "رمز جلسة موظف الفرع تجاوز الحد المسموح"
    );
  }

  return token;
}

function readSignedPayload(
  token: string | null | undefined
): unknown | null {
  if (
    typeof token !== "string"
  ) {
    return null;
  }

  if (
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
      receivedSignature
    )
  ) {
    return null;
  }

  const decodedPayload =
    fromBase64Url(
      encodedPayload,
      MAX_ENCODED_PAYLOAD_LENGTH
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
  expiresAt: number
): boolean {
  const now = Math.floor(
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
    duration >
      FINANCE_BRANCH_SESSION_DURATION_SECONDS ||
    duration <= 0
  ) {
    return false;
  }

  if (
    now - issuedAt >
      FINANCE_BRANCH_SESSION_DURATION_SECONDS +
        MAX_CLOCK_SKEW_SECONDS
  ) {
    return false;
  }

  return true;
}

export function createFinanceBranchSessionToken(
  input: FinanceBranchSessionInput
): string {
  const userId =
    cleanText(input.userId);

  const branchId =
    cleanText(input.branchId);

  const branchSlug =
    normalizeBranchSlug(
      input.branchSlug
    );

  const sessionVersion =
    normalizeSessionVersion(
      input.sessionVersion
    );

  if (!isValidUuid(userId)) {
    throw new Error(
      "معرف موظف الفرع غير صحيح"
    );
  }

  if (!isValidUuid(branchId)) {
    throw new Error(
      "معرف الفرع غير صحيح"
    );
  }

  if (
    !isValidBranchSlug(
      branchSlug
    )
  ) {
    throw new Error(
      "رابط الفرع غير صحيح"
    );
  }

  if (sessionVersion === null) {
    throw new Error(
      "إصدار جلسة موظف الفرع غير صحيح"
    );
  }

  const now = Math.floor(
    Date.now() / 1000
  );

  const session: FinanceBranchSession = {
    kind: SESSION_KIND,
    tokenVersion: TOKEN_VERSION,
    sessionId: randomUUID(),
    userId,
    branchId,
    branchSlug,
    sessionVersion,
    issuedAt: now,
    expiresAt:
      now +
      FINANCE_BRANCH_SESSION_DURATION_SECONDS,
  };

  return createSignedToken(
    session
  );
}

export function verifyFinanceBranchSessionToken(
  token: string | null | undefined
): FinanceBranchSession | null {
  const payload =
    readSignedPayload(token);

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
    cleanText(payload.userId);

  const branchId =
    cleanText(payload.branchId);

  const branchSlug =
    normalizeBranchSlug(
      payload.branchSlug
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
    kind !== SESSION_KIND ||
    tokenVersion !== TOKEN_VERSION ||
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
      payload.branchId,
      branchId
    ) ||
    !hasCanonicalTextValue(
      payload.branchSlug,
      branchSlug
    ) ||
    !isValidUuid(sessionId) ||
    !isValidUuid(userId) ||
    !isValidUuid(branchId) ||
    !isValidBranchSlug(branchSlug) ||
    sessionVersion === null ||
    issuedAt === null ||
    expiresAt === null ||
    !hasValidSessionTimes(
      issuedAt,
      expiresAt
    )
  ) {
    return null;
  }

  return {
    kind: SESSION_KIND,
    tokenVersion: TOKEN_VERSION,
    sessionId,
    userId,
    branchId,
    branchSlug,
    sessionVersion,
    issuedAt,
    expiresAt,
  };
}

export const financeBranchSessionCookieOptions =
  Object.freeze({
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict" as const,
    path: "/",
    maxAge:
      FINANCE_BRANCH_SESSION_DURATION_SECONDS,
    priority: "high" as const,
  });

export const financeBranchSessionDeleteCookieOptions =
  Object.freeze({
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    priority: "high" as const,
  });
