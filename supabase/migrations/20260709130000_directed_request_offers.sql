CREATE TABLE IF NOT EXISTS "public"."finance_directed_request_offers" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "created_by_branch_id" "uuid" NOT NULL,
  "created_by_user_id" "uuid",
  "created_by_name" "text",
  "accepted_by_branch_id" "uuid",
  "accepted_by_user_id" "uuid",
  "accepted_by_name" "text",
  "accepted_at" timestamp with time zone,
  "request_type" "text" NOT NULL,
  "customer_name" "text" NOT NULL,
  "customer_national_id" "text" NOT NULL,
  "city" "text" NOT NULL,
  "requested_amount" numeric(14,2) NOT NULL,
  "work_name" "text" NOT NULL,
  "birth_hijri_day" integer NOT NULL,
  "birth_hijri_month" integer NOT NULL,
  "birth_hijri_year" integer NOT NULL,
  "commission_amount" numeric(14,2) NOT NULL,
  "status" "text" DEFAULT 'active'::"text" NOT NULL,
  "commission_status" "text" DEFAULT 'pending'::"text" NOT NULL,
  "contract_id" "uuid",
  "contract_created_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancelled_by_branch_id" "uuid",
  "expires_at" timestamp with time zone DEFAULT ("now"() + interval '7 days') NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  CONSTRAINT "finance_directed_request_offers_amount_check" CHECK (("requested_amount" > 0)),
  CONSTRAINT "finance_directed_request_offers_birth_day_check" CHECK (("birth_hijri_day" BETWEEN 1 AND 30)),
  CONSTRAINT "finance_directed_request_offers_birth_month_check" CHECK (("birth_hijri_month" BETWEEN 1 AND 12)),
  CONSTRAINT "finance_directed_request_offers_birth_year_check" CHECK (("birth_hijri_year" BETWEEN 1200 AND 1600)),
  CONSTRAINT "finance_directed_request_offers_commission_check" CHECK (("commission_amount" >= 0)),
  CONSTRAINT "finance_directed_request_offers_commission_status_check" CHECK (("commission_status" = ANY (ARRAY['pending'::"text", 'not_delivered'::"text", 'received'::"text"]))),
  CONSTRAINT "finance_directed_request_offers_national_id_check" CHECK (("customer_national_id" ~ '^[0-9]{10}$'::"text")),
  CONSTRAINT "finance_directed_request_offers_request_type_check" CHECK (("request_type" = ANY (ARRAY['طلب مهلة'::"text", 'طلب سداد'::"text"]))),
  CONSTRAINT "finance_directed_request_offers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'accepted'::"text", 'contract_created'::"text", 'paid'::"text", 'cancelled'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."finance_directed_request_offer_events" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "offer_id" "uuid" NOT NULL,
  "branch_id" "uuid",
  "user_id" "uuid",
  "employee_name" "text",
  "event_type" "text" NOT NULL,
  "event_note" "text",
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."finance_directed_offer_acceptance_blocks" (
  "branch_id" "uuid" NOT NULL,
  "active_not_delivered_count" integer DEFAULT 0 NOT NULL,
  "is_blocked" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."finance_directed_request_offers"
  ADD CONSTRAINT "finance_directed_request_offers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_directed_request_offer_events"
  ADD CONSTRAINT "finance_directed_request_offer_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."finance_directed_offer_acceptance_blocks"
  ADD CONSTRAINT "finance_directed_offer_acceptance_blocks_pkey" PRIMARY KEY ("branch_id");

ALTER TABLE ONLY "public"."finance_directed_request_offers"
  ADD CONSTRAINT "finance_directed_request_offers_created_branch_fkey" FOREIGN KEY ("created_by_branch_id") REFERENCES "public"."finance_branches"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_directed_request_offers"
  ADD CONSTRAINT "finance_directed_request_offers_accepted_branch_fkey" FOREIGN KEY ("accepted_by_branch_id") REFERENCES "public"."finance_branches"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."finance_directed_request_offers"
  ADD CONSTRAINT "finance_directed_request_offers_contract_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."finance_contracts"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."finance_directed_request_offer_events"
  ADD CONSTRAINT "finance_directed_request_offer_events_offer_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."finance_directed_request_offers"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."finance_directed_offer_acceptance_blocks"
  ADD CONSTRAINT "finance_directed_offer_acceptance_blocks_branch_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."finance_branches"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "finance_directed_request_offers_status_idx" ON "public"."finance_directed_request_offers" USING "btree" ("status");
CREATE INDEX IF NOT EXISTS "finance_directed_request_offers_city_idx" ON "public"."finance_directed_request_offers" USING "btree" ("city");
CREATE INDEX IF NOT EXISTS "finance_directed_request_offers_amount_idx" ON "public"."finance_directed_request_offers" USING "btree" ("requested_amount");
CREATE INDEX IF NOT EXISTS "finance_directed_request_offers_created_branch_idx" ON "public"."finance_directed_request_offers" USING "btree" ("created_by_branch_id");
CREATE INDEX IF NOT EXISTS "finance_directed_request_offers_accepted_branch_idx" ON "public"."finance_directed_request_offers" USING "btree" ("accepted_by_branch_id");
CREATE INDEX IF NOT EXISTS "finance_directed_request_offers_created_at_idx" ON "public"."finance_directed_request_offers" USING "btree" ("created_at");
CREATE INDEX IF NOT EXISTS "finance_directed_request_offers_expires_at_idx" ON "public"."finance_directed_request_offers" USING "btree" ("expires_at");
CREATE INDEX IF NOT EXISTS "finance_directed_request_offers_contract_idx" ON "public"."finance_directed_request_offers" USING "btree" ("contract_id");
CREATE UNIQUE INDEX IF NOT EXISTS "finance_directed_request_offers_contract_unique_idx" ON "public"."finance_directed_request_offers" USING "btree" ("contract_id") WHERE "contract_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "finance_directed_request_offer_events_offer_idx" ON "public"."finance_directed_request_offer_events" USING "btree" ("offer_id", "created_at");

ALTER TABLE "public"."finance_directed_request_offers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."finance_directed_request_offer_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."finance_directed_offer_acceptance_blocks" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION "public"."recalculate_directed_offers_accept_block_atomic"("p_branch_id" "uuid")
RETURNS TABLE("branch_id" "uuid", "active_not_delivered_count" integer, "is_blocked" boolean)
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_count integer := 0;
  v_blocked boolean := false;
begin
  if p_branch_id is null then
    raise exception using errcode = 'P0001', message = 'BRANCH_REQUIRED';
  end if;

  select count(*)::integer
  into v_count
  from public.finance_directed_request_offers
  where accepted_by_branch_id = p_branch_id
    and status = 'paid'
    and commission_status = 'not_delivered';

  v_blocked := v_count >= 2;

  insert into public.finance_directed_offer_acceptance_blocks (
    branch_id,
    active_not_delivered_count,
    is_blocked,
    updated_at
  )
  values (
    p_branch_id,
    v_count,
    v_blocked,
    now()
  )
  on conflict (branch_id) do update
  set
    active_not_delivered_count = excluded.active_not_delivered_count,
    is_blocked = excluded.is_blocked,
    updated_at = excluded.updated_at;

  return query
  select p_branch_id, v_count, v_blocked;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."create_directed_request_offer_atomic"(
  "p_created_by_branch_id" "uuid",
  "p_created_by_user_id" "uuid",
  "p_created_by_name" "text",
  "p_request_type" "text",
  "p_customer_name" "text",
  "p_customer_national_id" "text",
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

CREATE OR REPLACE FUNCTION "public"."accept_directed_request_offer_atomic"(
  "p_offer_id" "uuid",
  "p_accepting_branch_id" "uuid",
  "p_accepting_user_id" "uuid",
  "p_accepting_name" "text"
) RETURNS TABLE("offer_id" "uuid", "status" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_offer public.finance_directed_request_offers%rowtype;
  v_is_blocked boolean := false;
begin
  select *
  into v_offer
  from public.finance_directed_request_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_FOUND';
  end if;

  if v_offer.created_by_branch_id = p_accepting_branch_id then
    raise exception using errcode = 'P0001', message = 'CANNOT_ACCEPT_OWN_OFFER';
  end if;

  if v_offer.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_ACTIVE';
  end if;

  if v_offer.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'OFFER_EXPIRED';
  end if;

  perform 1
  from public.recalculate_directed_offers_accept_block_atomic(p_accepting_branch_id);

  select coalesce(is_blocked, false)
  into v_is_blocked
  from public.finance_directed_offer_acceptance_blocks
  where branch_id = p_accepting_branch_id;

  if coalesce(v_is_blocked, false) then
    raise exception using errcode = 'P0001', message = 'DIRECTED_OFFERS_ACCEPTANCE_BLOCKED';
  end if;

  update public.finance_directed_request_offers
  set
    status = 'accepted',
    accepted_by_branch_id = p_accepting_branch_id,
    accepted_by_user_id = p_accepting_user_id,
    accepted_by_name = coalesce(nullif(trim(p_accepting_name), ''), 'الموظف'),
    accepted_at = now(),
    updated_at = now()
  where id = p_offer_id;

  insert into public.finance_directed_request_offer_events (
    offer_id,
    branch_id,
    user_id,
    employee_name,
    event_type
  )
  values (
    p_offer_id,
    p_accepting_branch_id,
    p_accepting_user_id,
    coalesce(nullif(trim(p_accepting_name), ''), 'الموظف'),
    'accepted'
  );

  return query select p_offer_id, 'accepted'::text;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."withdraw_directed_request_offer_acceptance_atomic"(
  "p_offer_id" "uuid",
  "p_accepting_branch_id" "uuid",
  "p_user_id" "uuid",
  "p_employee_name" "text"
) RETURNS TABLE("offer_id" "uuid", "status" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_offer public.finance_directed_request_offers%rowtype;
begin
  select *
  into v_offer
  from public.finance_directed_request_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_FOUND';
  end if;

  if v_offer.status <> 'accepted' or v_offer.accepted_by_branch_id <> p_accepting_branch_id then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_ACCEPTED_BY_BRANCH';
  end if;

  update public.finance_directed_request_offers
  set
    status = 'active',
    accepted_by_branch_id = null,
    accepted_by_user_id = null,
    accepted_by_name = null,
    accepted_at = null,
    updated_at = now()
  where id = p_offer_id;

  insert into public.finance_directed_request_offer_events (
    offer_id,
    branch_id,
    user_id,
    employee_name,
    event_type
  )
  values (
    p_offer_id,
    p_accepting_branch_id,
    p_user_id,
    coalesce(nullif(trim(p_employee_name), ''), 'الموظف'),
    'withdrawn'
  );

  return query select p_offer_id, 'active'::text;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."cancel_directed_request_offer_atomic"(
  "p_offer_id" "uuid",
  "p_branch_id" "uuid",
  "p_user_id" "uuid",
  "p_employee_name" "text"
) RETURNS TABLE("offer_id" "uuid", "status" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_offer public.finance_directed_request_offers%rowtype;
begin
  select *
  into v_offer
  from public.finance_directed_request_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_FOUND';
  end if;

  if v_offer.created_by_branch_id <> p_branch_id then
    raise exception using errcode = 'P0001', message = 'ONLY_CREATOR_CAN_CANCEL';
  end if;

  if v_offer.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'OFFER_CANNOT_BE_CANCELLED';
  end if;

  update public.finance_directed_request_offers
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by_branch_id = p_branch_id,
    updated_at = now()
  where id = p_offer_id;

  insert into public.finance_directed_request_offer_events (
    offer_id,
    branch_id,
    user_id,
    employee_name,
    event_type
  )
  values (
    p_offer_id,
    p_branch_id,
    p_user_id,
    coalesce(nullif(trim(p_employee_name), ''), 'الموظف'),
    'cancelled'
  );

  return query select p_offer_id, 'cancelled'::text;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."mark_directed_offer_contract_created_atomic"(
  "p_offer_id" "uuid",
  "p_branch_id" "uuid",
  "p_user_id" "uuid",
  "p_employee_name" "text",
  "p_contract_id" "uuid"
) RETURNS TABLE("offer_id" "uuid", "status" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_offer public.finance_directed_request_offers%rowtype;
begin
  select *
  into v_offer
  from public.finance_directed_request_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_FOUND';
  end if;

  if v_offer.accepted_by_branch_id <> p_branch_id then
    raise exception using errcode = 'P0001', message = 'ONLY_ACCEPTING_BRANCH_CAN_CREATE_CONTRACT';
  end if;

  if v_offer.status <> 'accepted' then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_ACCEPTED';
  end if;

  perform 1
  from public.finance_contracts
  where id = p_contract_id
    and branch_id = p_branch_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_CONTRACT_FOR_BRANCH';
  end if;

  update public.finance_directed_request_offers
  set
    status = 'contract_created',
    contract_id = p_contract_id,
    contract_created_at = now(),
    updated_at = now()
  where id = p_offer_id;

  insert into public.finance_directed_request_offer_events (
    offer_id,
    branch_id,
    user_id,
    employee_name,
    event_type,
    event_note
  )
  values (
    p_offer_id,
    p_branch_id,
    p_user_id,
    coalesce(nullif(trim(p_employee_name), ''), 'الموظف'),
    'contract_created',
    p_contract_id::text
  );

  return query select p_offer_id, 'contract_created'::text;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."mark_directed_offer_paid_atomic"(
  "p_offer_id" "uuid"
) RETURNS TABLE("offer_id" "uuid", "status" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_offer public.finance_directed_request_offers%rowtype;
begin
  select *
  into v_offer
  from public.finance_directed_request_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_FOUND';
  end if;

  if v_offer.status not in ('contract_created', 'paid') then
    raise exception using errcode = 'P0001', message = 'OFFER_CONTRACT_NOT_CREATED';
  end if;

  update public.finance_directed_request_offers
  set
    status = 'paid',
    paid_at = coalesce(paid_at, now()),
    commission_status = coalesce(commission_status, 'pending'),
    updated_at = now()
  where id = p_offer_id;

  insert into public.finance_directed_request_offer_events (
    offer_id,
    employee_name,
    event_type,
    event_note
  )
  values (
    p_offer_id,
    'النظام',
    'paid',
    coalesce(v_offer.contract_id::text, p_offer_id::text)
  );

  return query select p_offer_id, 'paid'::text;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."mark_directed_offer_commission_not_delivered_atomic"(
  "p_offer_id" "uuid",
  "p_branch_id" "uuid",
  "p_user_id" "uuid",
  "p_employee_name" "text"
) RETURNS TABLE("offer_id" "uuid", "commission_status" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_offer public.finance_directed_request_offers%rowtype;
begin
  select *
  into v_offer
  from public.finance_directed_request_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_FOUND';
  end if;

  if v_offer.created_by_branch_id <> p_branch_id then
    raise exception using errcode = 'P0001', message = 'ONLY_CREATOR_CAN_MARK_COMMISSION';
  end if;

  if v_offer.status <> 'paid' then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_PAID';
  end if;

  if v_offer.accepted_by_branch_id is null then
    raise exception using errcode = 'P0001', message = 'ACCEPTING_BRANCH_REQUIRED';
  end if;

  update public.finance_directed_request_offers
  set
    commission_status = 'not_delivered',
    updated_at = now()
  where id = p_offer_id;

  insert into public.finance_directed_request_offer_events (
    offer_id,
    branch_id,
    user_id,
    employee_name,
    event_type
  )
  values (
    p_offer_id,
    p_branch_id,
    p_user_id,
    coalesce(nullif(trim(p_employee_name), ''), 'الموظف'),
    'commission_not_delivered'
  );

  perform 1
  from public.recalculate_directed_offers_accept_block_atomic(v_offer.accepted_by_branch_id);

  return query select p_offer_id, 'not_delivered'::text;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."mark_directed_offer_commission_received_atomic"(
  "p_offer_id" "uuid",
  "p_branch_id" "uuid",
  "p_user_id" "uuid",
  "p_employee_name" "text"
) RETURNS TABLE("offer_id" "uuid", "commission_status" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_offer public.finance_directed_request_offers%rowtype;
begin
  select *
  into v_offer
  from public.finance_directed_request_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_FOUND';
  end if;

  if v_offer.created_by_branch_id <> p_branch_id then
    raise exception using errcode = 'P0001', message = 'ONLY_CREATOR_CAN_MARK_COMMISSION';
  end if;

  if v_offer.status <> 'paid' then
    raise exception using errcode = 'P0001', message = 'OFFER_NOT_PAID';
  end if;

  update public.finance_directed_request_offers
  set
    commission_status = 'received',
    updated_at = now()
  where id = p_offer_id;

  insert into public.finance_directed_request_offer_events (
    offer_id,
    branch_id,
    user_id,
    employee_name,
    event_type
  )
  values (
    p_offer_id,
    p_branch_id,
    p_user_id,
    coalesce(nullif(trim(p_employee_name), ''), 'الموظف'),
    'commission_received'
  );

  if v_offer.accepted_by_branch_id is not null then
    perform 1
    from public.recalculate_directed_offers_accept_block_atomic(v_offer.accepted_by_branch_id);
  end if;

  return query select p_offer_id, 'received'::text;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."sync_directed_offer_paid_from_contract"()
RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
begin
  if new.contract_status = 'تم السداد'
     and coalesce(old.contract_status, '') <> 'تم السداد' then
    with updated_offers as (
      update public.finance_directed_request_offers
      set
        status = 'paid',
        paid_at = coalesce(paid_at, now()),
        updated_at = now()
      where contract_id = new.id
        and status = 'contract_created'
      returning id
    )
    insert into public.finance_directed_request_offer_events (
      offer_id,
      employee_name,
      event_type,
      event_note
    )
    select
      id,
      'النظام',
      'paid',
      new.id::text
    from updated_offers;
  end if;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS "sync_directed_offer_paid_from_contract_trigger" ON "public"."finance_contracts";

CREATE TRIGGER "sync_directed_offer_paid_from_contract_trigger"
AFTER UPDATE OF "contract_status" ON "public"."finance_contracts"
FOR EACH ROW
EXECUTE FUNCTION "public"."sync_directed_offer_paid_from_contract"();

REVOKE ALL ON FUNCTION "public"."create_directed_request_offer_atomic"("uuid", "uuid", "text", "text", "text", "text", "text", numeric, "text", integer, integer, integer, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."accept_directed_request_offer_atomic"("uuid", "uuid", "uuid", "text") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."withdraw_directed_request_offer_acceptance_atomic"("uuid", "uuid", "uuid", "text") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."cancel_directed_request_offer_atomic"("uuid", "uuid", "uuid", "text") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."mark_directed_offer_contract_created_atomic"("uuid", "uuid", "uuid", "text", "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."mark_directed_offer_paid_atomic"("uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."mark_directed_offer_commission_not_delivered_atomic"("uuid", "uuid", "uuid", "text") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."mark_directed_offer_commission_received_atomic"("uuid", "uuid", "uuid", "text") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."recalculate_directed_offers_accept_block_atomic"("uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."create_directed_request_offer_atomic"("uuid", "uuid", "text", "text", "text", "text", "text", numeric, "text", integer, integer, integer, numeric) TO "service_role";
GRANT ALL ON FUNCTION "public"."accept_directed_request_offer_atomic"("uuid", "uuid", "uuid", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."withdraw_directed_request_offer_acceptance_atomic"("uuid", "uuid", "uuid", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."cancel_directed_request_offer_atomic"("uuid", "uuid", "uuid", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."mark_directed_offer_contract_created_atomic"("uuid", "uuid", "uuid", "text", "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."mark_directed_offer_paid_atomic"("uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."mark_directed_offer_commission_not_delivered_atomic"("uuid", "uuid", "uuid", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."mark_directed_offer_commission_received_atomic"("uuid", "uuid", "uuid", "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."recalculate_directed_offers_accept_block_atomic"("uuid") TO "service_role";

GRANT ALL ON TABLE "public"."finance_directed_request_offers" TO "service_role";
GRANT ALL ON TABLE "public"."finance_directed_request_offer_events" TO "service_role";
GRANT ALL ON TABLE "public"."finance_directed_offer_acceptance_blocks" TO "service_role";
