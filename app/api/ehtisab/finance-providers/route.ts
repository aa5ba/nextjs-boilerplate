import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_FINANCE_TYPES = [
  "personal",
] as const;

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
  };
}

function createErrorResponse(
  message: string,
  status: number,
  code = "REQUEST_FAILED"
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
    },
    {
      status,
      headers: noStoreHeaders(),
    }
  );
}

function normalizeFinanceType(
  value: string | null
) {
  const financeType =
    typeof value === "string"
      ? value.trim()
      : "";

  return (
    SUPPORTED_FINANCE_TYPES as readonly string[]
  ).includes(financeType)
    ? financeType
    : null;
}

type ProviderRow = {
  id: string;
  provider_name: string | null;
  display_order: number | null;
};

export async function GET(
  request: Request
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const financeType =
      normalizeFinanceType(
        searchParams.get("finance_type")
      );

    if (!financeType) {
      return createErrorResponse(
        "نوع التمويل غير صحيح",
        400,
        "INVALID_FINANCE_TYPE"
      );
    }

    const { data, error } =
      await supabaseAdmin
        .from(
          "ehtisab_finance_providers"
        )
        .select(
          `
            id,
            provider_name,
            display_order,
            ehtisab_provider_finance_types!inner (
              finance_type,
              is_active
            )
          `
        )
        .eq("is_active", true)
        .eq("is_deleted", false)
        .eq(
          "ehtisab_provider_finance_types.finance_type",
          financeType
        )
        .eq(
          "ehtisab_provider_finance_types.is_active",
          true
        )
        .order("display_order", {
          ascending: true,
        })
        .order("provider_name", {
          ascending: true,
        });

    if (error) {
      console.error(
        "Ehtisab finance providers query failed:",
        error
      );

      return createErrorResponse(
        "تعذر تحميل جهات التمويل",
        500
      );
    }

    const providers = (
      (data ?? []) as ProviderRow[]
    ).map((provider) => ({
      id: provider.id,
      providerName:
        provider.provider_name ?? "",
      displayOrder:
        provider.display_order ?? 0,
    }));

    return NextResponse.json(
      {
        ok: true,
        providers,
      },
      {
        status: 200,
        headers: noStoreHeaders(),
      }
    );
  } catch (error) {
    console.error(
      "Ehtisab finance providers route error:",
      error
    );

    return createErrorResponse(
      "حدث خطأ أثناء تحميل جهات التمويل",
      500
    );
  }
}
