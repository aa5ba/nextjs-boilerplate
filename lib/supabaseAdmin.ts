import "server-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const IS_PRODUCTION =
  process.env.NODE_ENV === "production";

const SUPABASE_REQUEST_TIMEOUT_MS =
  30_000;

function cleanEnvironmentValue(
  value: string | undefined
): string {
  return value?.trim() ?? "";
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

function isLocalHostname(
  hostname: string
): boolean {
  const normalizedHostname =
    hostname.toLowerCase();

  return (
    normalizedHostname ===
      "localhost" ||
    normalizedHostname ===
      "127.0.0.1" ||
    normalizedHostname ===
      "[::1]" ||
    normalizedHostname ===
      "::1"
  );
}

function getSupabaseUrl(): string {
  const rawUrl =
    cleanEnvironmentValue(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL
    );

  if (!rawUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL غير موجود داخل متغيرات البيئة"
    );
  }

  if (
    containsWrappingQuotes(rawUrl)
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL يحتوي علامات اقتباس زائدة داخل متغيرات البيئة"
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ليس رابطًا صحيحًا"
    );
  }

  if (
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(
      "رابط Supabase يجب ألا يحتوي اسم مستخدم أو كلمة مرور"
    );
  }

  const localDevelopmentHost =
    isLocalHostname(
      parsedUrl.hostname
    );

  if (
    parsedUrl.protocol !==
      "https:" &&
    !(
      !IS_PRODUCTION &&
      localDevelopmentHost
    )
  ) {
    throw new Error(
      "رابط Supabase يجب أن يستخدم HTTPS"
    );
  }

  if (
    IS_PRODUCTION &&
    localDevelopmentHost
  ) {
    throw new Error(
      "لا يمكن استخدام رابط Supabase محلي في بيئة الإنتاج"
    );
  }

  parsedUrl.pathname =
    parsedUrl.pathname.replace(
      /\/+$/,
      ""
    );

  parsedUrl.search = "";
  parsedUrl.hash = "";

  return parsedUrl
    .toString()
    .replace(/\/$/, "");
}

function validateSecretKeyFormat(
  value: string
): void {
  if (
    containsWrappingQuotes(value)
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY يحتوي علامات اقتباس زائدة داخل متغيرات البيئة"
    );
  }

  if (/\s/.test(value)) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY يحتوي مسافات أو أسطرًا غير صالحة"
    );
  }

  if (value.length < 32) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY غير صحيح أو قصير جدًا"
    );
  }
}

function getServiceRoleKey(): string {
  const serviceRoleKey =
    cleanEnvironmentValue(
      process.env
        .SUPABASE_SERVICE_ROLE_KEY
    );

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY غير موجود داخل متغيرات البيئة"
    );
  }

  validateSecretKeyFormat(
    serviceRoleKey
  );

  const publicKeys = [
    cleanEnvironmentValue(
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),

    cleanEnvironmentValue(
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
  ].filter(Boolean);

  if (
    publicKeys.includes(
      serviceRoleKey
    )
  ) {
    throw new Error(
      "تم استخدام مفتاح Supabase العام بدل مفتاح Service Role"
    );
  }

  const exposedServiceRoleKey =
    cleanEnvironmentValue(
      process.env
        .NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
    );

  if (exposedServiceRoleKey) {
    throw new Error(
      "خطأ أمني: يجب حذف NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY فورًا"
    );
  }

  return serviceRoleKey;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller =
    new AbortController();

  const externalSignal =
    init?.signal;

  const abortFromExternalSignal =
    () => {
      controller.abort(
        externalSignal?.reason
      );
    };

  if (externalSignal?.aborted) {
    abortFromExternalSignal();
  } else {
    externalSignal?.addEventListener(
      "abort",
      abortFromExternalSignal,
      {
        once: true,
      }
    );
  }

  const timeoutId =
    setTimeout(() => {
      controller.abort(
        new DOMException(
          "انتهت مهلة الاتصال بـ Supabase",
          "TimeoutError"
        )
      );
    }, SUPABASE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,

      cache: "no-store",

      signal:
        controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);

    externalSignal?.removeEventListener(
      "abort",
      abortFromExternalSignal
    );
  }
}

function createSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl =
    getSupabaseUrl();

  const serviceRoleKey =
    getServiceRoleKey();

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },

      db: {
        schema: "public",
      },

      global: {
        headers: {
          "X-Client-Info":
            "ehtisab-server-admin",
        },

        fetch: fetchWithTimeout,
      },
    }
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __ehtisabSupabaseAdmin:
    | SupabaseClient
    | undefined;
}

function getSupabaseAdminClient(): SupabaseClient {
  if (IS_PRODUCTION) {
    return createSupabaseAdminClient();
  }

  if (
    !globalThis
      .__ehtisabSupabaseAdmin
  ) {
    globalThis.__ehtisabSupabaseAdmin =
      createSupabaseAdminClient();
  }

  return globalThis
    .__ehtisabSupabaseAdmin;
}

export const supabaseAdmin =
  getSupabaseAdminClient();
