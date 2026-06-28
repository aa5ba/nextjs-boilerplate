import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "crypto";

export const FINANCE_BRANCH_SESSION_COOKIE_NAME =
  "finance_branch_session";

const FINANCE_BRANCH_SESSION_DURATION_SECONDS =
  60 * 60 * 3;

export type FinanceBranchSession = {
  kind: "finance_branch_session";
  userId: string;
  branchId: string;
  branchSlug: string;
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
};

function getFinanceBranchSessionSecret() {
  const secret =
    process.env.FINANCE_BRANCH_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "FINANCE_BRANCH_SESSION_SECRET غير موجود أو قصير جدًا"
    );
  }

  return secret;
}

function cleanText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeVersion(value: unknown) {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return 0;
  }

  return Math.floor(parsed);
}

function toBase64Url(value: string) {
  return Buffer.from(
    value,
    "utf8"
  ).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(
    value,
    "base64url"
  ).toString("utf8");
}

function createSignature(
  encodedPayload: string
) {
  return createHmac(
    "sha256",
    getFinanceBranchSessionSecret()
  )
    .update(encodedPayload)
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
  if (!token) {
    return null;
  }

  const parts = token.split(".");

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

function isNotExpired(
  expiresAt: unknown
) {
  if (
    typeof expiresAt !== "number" ||
    !Number.isFinite(expiresAt)
  ) {
    return false;
  }

  const now = Math.floor(
    Date.now() / 1000
  );

  return expiresAt > now;
}

export function createFinanceBranchSessionToken(
  input: {
    userId: string;
    branchId: string;
    branchSlug: string;
    sessionVersion: number;
  }
) {
  const userId =
    cleanText(input.userId);

  const branchId =
    cleanText(input.branchId);

  const branchSlug =
    cleanText(
      input.branchSlug
    ).toLowerCase();

  if (
    !userId ||
    !branchId ||
    !branchSlug
  ) {
    throw new Error(
      "بيانات جلسة موظف الفرع غير مكتملة"
    );
  }

  if (
    !/^[a-z0-9_-]+$/.test(
      branchSlug
    )
  ) {
    throw new Error(
      "رابط الفرع غير صحيح"
    );
  }

  const now = Math.floor(
    Date.now() / 1000
  );

  const session: FinanceBranchSession = {
    kind:
      "finance_branch_session",
    userId,
    branchId,
    branchSlug,
    sessionVersion:
      normalizeVersion(
        input.sessionVersion
      ),
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

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const parsed =
    payload as Partial<FinanceBranchSession>;

  const userId =
    cleanText(parsed.userId);

  const branchId =
    cleanText(parsed.branchId);

  const branchSlug =
    cleanText(
      parsed.branchSlug
    ).toLowerCase();

  if (
    parsed.kind !==
      "finance_branch_session" ||
    !userId ||
    !branchId ||
    !branchSlug ||
    !/^[a-z0-9_-]+$/.test(
      branchSlug
    ) ||
    typeof parsed.issuedAt !==
      "number" ||
    !isNotExpired(
      parsed.expiresAt
    )
  ) {
    return null;
  }

  return {
    kind:
      "finance_branch_session",
    userId,
    branchId,
    branchSlug,
    sessionVersion:
      normalizeVersion(
        parsed.sessionVersion
      ),
    issuedAt:
      parsed.issuedAt,
    expiresAt:
      parsed.expiresAt as number,
  };
}

export const financeBranchSessionCookieOptions =
  {
    httpOnly: true,

    secure:
      process.env.NODE_ENV ===
      "production",

    sameSite: "lax" as const,

    path: "/finance",

    maxAge:
      FINANCE_BRANCH_SESSION_DURATION_SECONDS,
  };
