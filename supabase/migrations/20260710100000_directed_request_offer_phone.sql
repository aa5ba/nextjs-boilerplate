ALTER TABLE "public"."finance_directed_request_offers"
  ADD COLUMN IF NOT EXISTS "customer_phone" "text";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_constraint"
    WHERE "conname" = 'finance_directed_request_offers_customer_phone_check'
  ) THEN
    ALTER TABLE "public"."finance_directed_request_offers"
      ADD CONSTRAINT "finance_directed_request_offers_customer_phone_check"
      CHECK (
        "customer_phone" IS NULL
        OR "customer_phone" ~ '^05[0-9]{8}$'::"text"
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."create_directed_request_offer_atomic"(
  "p_created_by_branch_id" "uuid",
  "p_created_by_user_id" "uuid",
  "p_created_by_name" "text",
  "p_request_type" "text",
  "p_customer_name" "text",
  "p_customer_national_id" "text",
  "p_customer_phone" "text",
  "p_city" "text",
  "p_requested_amount" numeric,
  "p_work_name" "text",
  "p_birth_hijri_day" integer,
  "p_birth_hijri_month" integer,
  "p_birth_hijri_year" integer,
  "p_commission_amount" numeric
) RETURNS TABLE("offer_id" "uuid")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_offer_id uuid;
begin
  if p_created_by_branch_id is null then
    raise exception using errcode = 'P0001', message = 'BRANCH_REQUIRED';
  end if;

  if trim(coalesce(p_request_type, '')) not in ('طلب مهلة', 'طلب سداد') then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUEST_TYPE';
  end if;

  if length(trim(coalesce(p_customer_name, ''))) < 2 then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_NAME_REQUIRED';
  end if;

  if trim(coalesce(p_customer_national_id, '')) !~ '^[0-9]{10}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_NATIONAL_ID';
  end if;

  if trim(coalesce(p_customer_phone, '')) !~ '^05[0-9]{8}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_CUSTOMER_PHONE';
  end if;

  if length(trim(coalesce(p_city, ''))) < 2 then
    raise exception using errcode = 'P0001', message = 'CITY_REQUIRED';
  end if;

  if length(trim(coalesce(p_work_name, ''))) < 2 then
    raise exception using errcode = 'P0001', message = 'WORK_NAME_REQUIRED';
  end if;

  if coalesce(p_requested_amount, 0) <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_REQUESTED_AMOUNT';
  end if;

  if coalesce(p_commission_amount, 0) < 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_COMMISSION_AMOUNT';
  end if;

  insert into public.finance_directed_request_offers (
    created_by_branch_id,
    created_by_user_id,
    created_by_name,
    request_type,
    customer_name,
    customer_national_id,
    customer_phone,
    city,
    requested_amount,
    work_name,
    birth_hijri_day,
    birth_hijri_month,
    birth_hijri_year,
    commission_amount
  )
  values (
    p_created_by_branch_id,
    p_created_by_user_id,
    coalesce(nullif(trim(p_created_by_name), ''), 'الموظف'),
    trim(p_request_type),
    trim(p_customer_name),
    trim(p_customer_national_id),
    trim(p_customer_phone),
    trim(p_city),
    round(p_requested_amount, 2),
    trim(coalesce(p_work_name, '')),
    p_birth_hijri_day,
    p_birth_hijri_month,
    p_birth_hijri_year,
    round(coalesce(p_commission_amount, 0), 2)
  )
  returning id into v_offer_id;

  insert into public.finance_directed_request_offer_events (
    offer_id,
    branch_id,
    user_id,
    employee_name,
    event_type
  )
  values (
    v_offer_id,
    p_created_by_branch_id,
    p_created_by_user_id,
    coalesce(nullif(trim(p_created_by_name), ''), 'الموظف'),
    'created'
  );

  return query select v_offer_id;
end;
$$;

REVOKE ALL ON FUNCTION "public"."create_directed_request_offer_atomic"("uuid", "uuid", "text", "text", "text", "text", "text", "text", numeric, "text", integer, integer, integer, numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_directed_request_offer_atomic"("uuid", "uuid", "text", "text", "text", "text", "text", "text", numeric, "text", integer, integer, integer, numeric) TO "service_role";
