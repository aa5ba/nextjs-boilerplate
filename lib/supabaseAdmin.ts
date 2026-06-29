import "server-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

const IS_PRODUCTION =
  process.env.NODE_ENV === "production";

type SupabaseAdminDatabase = Record<
  string,
  never
>;

function cleanEnvironmentValue(
  value: string | undefined
): string {
  return value?.trim() ?? "";
}

function getSupabaseUrl(): string {
  const rawUrl =
    cleanEnvironmentValue(
      process.env.NEXT_PUBLIC_SUPABASE_URL
    );

  if (!rawUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL غير موجود داخل متغيرات البيئة"
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

  const isLocalDevelopmentHost =
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "127.0.0.1";

  if (
    parsedUrl.protocol !== "https:" &&
    !(
      !IS_PRODUCTION &&
      isLocalDevelopmentHost
    )
  ) {
    throw new Error(
      "رابط Supabase يجب أن يستخدم HTTPS"
    );
  }

  if (
    IS_PRODUCTION &&
    isLocalDevelopmentHost
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

  return parsedUrl.toString().replace(
    /\/$/,
    ""
  );
}

function getServiceRoleKey(): string {
  const serviceRoleKey =
    cleanEnvironmentValue(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY غير موجود داخل متغيرات البيئة"
    );
  }

  if (serviceRoleKey.length < 32) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY غير صحيح أو قصير جدًا"
    );
  }

  const publicAnonKey =
    cleanEnvironmentValue(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

  if (
    publicAnonKey &&
    serviceRoleKey === publicAnonKey
  ) {
    throw new Error(
      "تم استخدام مفتاح Supabase العام بدل مفتاح Service Role"
    );
  }

  if (
    process.env
      .NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "خطأ أمني: يجب حذف NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY فورًا"
    );
  }

  return serviceRoleKey;
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

      global: {
        headers: {
          "X-Client-Info":
            "ehtisab-server-admin",
        },

        fetch: (
          input,
          init
        ) => {
          return fetch(input, {
            ...init,
            cache: "no-store",
          });
        },
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
    !globalThis.__ehtisabSupabaseAdmin
  ) {
    globalThis.__ehtisabSupabaseAdmin =
      createSupabaseAdminClient();
  }

  return globalThis.__ehtisabSupabaseAdmin;
}

export const supabaseAdmin =
  getSupabaseAdminClient();
