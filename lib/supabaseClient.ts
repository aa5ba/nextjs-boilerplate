import { createClient } from "@supabase/supabase-js"

const IS_PRODUCTION =
  process.env.NODE_ENV === "production"

function cleanEnvironmentValue(
  value: string | undefined
) {
  return stripWrappingQuotes(
    value?.trim() ?? ""
  )
}

function stripWrappingQuotes(
  value: string
) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') &&
      value.endsWith('"')) ||
      (value.startsWith("'") &&
        value.endsWith("'")))
  ) {
    return value.slice(1, -1).trim()
  }

  return value
}

function isLocalHostname(
  hostname: string
) {
  const normalizedHostname =
    hostname.toLowerCase()

  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "[::1]" ||
    normalizedHostname === "::1"
  )
}

function getSupabaseUrl() {
  const rawUrl =
    cleanEnvironmentValue(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL
    )

  if (!rawUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL غير موجود"
    )
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL ليس رابطًا صحيحًا"
    )
  }

  if (
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL يجب ألا يحتوي اسم مستخدم أو كلمة مرور"
    )
  }

  const localDevelopmentHost =
    isLocalHostname(parsedUrl.hostname)

  if (
    parsedUrl.protocol !== "https:" &&
    !(
      !IS_PRODUCTION &&
      parsedUrl.protocol === "http:" &&
      localDevelopmentHost
    )
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL يجب أن يستخدم HTTPS، ويسمح بـ HTTP محليًا فقط"
    )
  }

  if (
    IS_PRODUCTION &&
    localDevelopmentHost
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL لا يمكن أن يكون محليًا في الإنتاج"
    )
  }

  parsedUrl.pathname =
    parsedUrl.pathname.replace(
      /\/+$/,
      ""
    )

  parsedUrl.search = ""
  parsedUrl.hash = ""

  return parsedUrl
    .toString()
    .replace(/\/$/, "")
}

function getSupabasePublicKey() {
  const publicKey =
    cleanEnvironmentValue(
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) ||
    cleanEnvironmentValue(
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )

  if (!publicKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY أو NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY غير موجود"
    )
  }

  if (/\s/.test(publicKey)) {
    throw new Error(
      "مفتاح Supabase العام يحتوي مسافات أو أسطرًا غير صالحة"
    )
  }

  return publicKey
}

export const supabase = createClient(
  getSupabaseUrl(),
  getSupabasePublicKey()
)
