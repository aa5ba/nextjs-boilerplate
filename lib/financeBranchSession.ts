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

const FINANCE_BRANCH_SESSION_DURATION_SECONDS =
  60 * 60 * 3;

const MAX_CLOCK_SKEW_SECONDS = 60;

const MAX_TOKEN_LENGTH = 4096;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BRANCH_SLUG_PATTERN =
  /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

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
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
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

function getSecretBytes(
  environmentName:
    | "FINANCE_BRANCH_SESSION_SECRET"
    | "FINANCE_BRANCH_SESSION_PREVIOUS_SECRET"
): Buffer | null {
  const rawSecret =
    process.env[environmentName];

  if (!rawSecret) {
    return null;
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
    !currentSecret.equals(previousSecret)
  ) {
    return [
      currentSecret,
      previousSecret,
    ];
  }

  return [currentSecret];
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
  try {
    return Buffer.from(
      value,
      "base64url"
    ).toString("utf8");
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

function signaturesMatch(
  receivedSignature: string,
  expectedSignature: string
): boolean {
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
      received.byteLength !== 32 ||
      expected.byteLength !== 32 ||
      received.byteLength !==
        expected.byteLength
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

  const signedContent =
    `${TOKEN_VERSION}.${encodedPayload}`;

  const signature =
    createSignature(
      signedContent,
      getCurrentSecret()
    );

  return `${signedContent}.${signature}`;
}

function readSignedPayload(
  token: string | null | undefined
): unknown | null {
  const cleanToken =
    cleanText(token);

  if (
    !cleanToken ||
    cleanToken.length >
      MAX_TOKEN_LENGTH
  ) {
    return null;
  }

  const parts =
    cleanToken.split(".");

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
    !encodedPayload ||
    !receivedSignature
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
    fromBase64Url(encodedPayload);

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

  if (
    expiresAt - issuedAt >
    FINANCE_BRANCH_SESSION_DURATION_SECONDS
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
