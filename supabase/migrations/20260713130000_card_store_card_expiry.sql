-- Migration: finance card store card expiry
-- Adds user-entered card expiry fields while preserving listing publish expires_at.

alter table public.finance_card_store_listings
  add column if not exists card_expiry_month smallint,
  add column if not exists card_expiry_year smallint;

alter table public.finance_card_store_deals
  add column if not exists card_expiry_month_snapshot smallint,
  add column if not exists card_expiry_year_snapshot smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_card_store_listings_card_expiry_pair_check'
      and conrelid = 'public.finance_card_store_listings'::regclass
  ) then
    alter table public.finance_card_store_listings
      add constraint finance_card_store_listings_card_expiry_pair_check
      check (
        (card_expiry_month is null and card_expiry_year is null)
        or (card_expiry_month is not null and card_expiry_year is not null)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_card_store_listings_card_expiry_month_check'
      and conrelid = 'public.finance_card_store_listings'::regclass
  ) then
    alter table public.finance_card_store_listings
      add constraint finance_card_store_listings_card_expiry_month_check
      check (card_expiry_month is null or card_expiry_month between 1 and 12);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_card_store_listings_card_expiry_year_check'
      and conrelid = 'public.finance_card_store_listings'::regclass
  ) then
    alter table public.finance_card_store_listings
      add constraint finance_card_store_listings_card_expiry_year_check
      check (card_expiry_year is null or card_expiry_year between 2000 and 9999);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_card_store_deals_card_expiry_pair_check'
      and conrelid = 'public.finance_card_store_deals'::regclass
  ) then
    alter table public.finance_card_store_deals
      add constraint finance_card_store_deals_card_expiry_pair_check
      check (
        (card_expiry_month_snapshot is null and card_expiry_year_snapshot is null)
        or (card_expiry_month_snapshot is not null and card_expiry_year_snapshot is not null)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_card_store_deals_card_expiry_month_check'
      and conrelid = 'public.finance_card_store_deals'::regclass
  ) then
    alter table public.finance_card_store_deals
      add constraint finance_card_store_deals_card_expiry_month_check
      check (card_expiry_month_snapshot is null or card_expiry_month_snapshot between 1 and 12);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_card_store_deals_card_expiry_year_check'
      and conrelid = 'public.finance_card_store_deals'::regclass
  ) then
    alter table public.finance_card_store_deals
      add constraint finance_card_store_deals_card_expiry_year_check
      check (card_expiry_year_snapshot is null or card_expiry_year_snapshot between 2000 and 9999);
  end if;
end;
$$;

drop function if exists public.create_card_store_listing_for_branch_atomic(uuid, uuid, text, uuid, text, integer, numeric, text);
drop function if exists public.update_card_store_listing_for_branch_atomic(uuid, uuid, uuid, text, uuid, text, integer, numeric, text);
drop function if exists public.update_card_store_listing_for_support_atomic(uuid, uuid, text, uuid, text, integer, numeric, text);
drop function if exists public.card_store_update_listing_internal(uuid, text, uuid, text, integer, numeric, text);

create or replace function public.card_store_update_listing_internal(
  p_listing_id uuid,
  p_listing_type text,
  p_product_id uuid,
  p_city_code text,
  p_quantity integer,
  p_total_price numeric,
  p_contact_phone text,
  p_card_expiry_month integer,
  p_card_expiry_year integer
)
returns table(out_listing_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_listing public.finance_card_store_listings%rowtype;
  v_product record;
  v_phone text;
  v_quantity_changed boolean;
  v_product_changed boolean;
  v_unit_price numeric(14,2);
  v_listing_id uuid;
begin
  select *
  into v_listing
  from public.finance_card_store_listings as l
  where l.id = p_listing_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'LISTING_NOT_FOUND';
  end if;

  if v_listing.expires_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'LISTING_EXPIRED';
  end if;

  if p_listing_type not in ('offered', 'wanted') then
    raise exception using errcode = 'P0001', message = 'INVALID_LISTING_TYPE';
  end if;

  if not public.card_store_is_valid_city(p_city_code) then
    raise exception using errcode = 'P0001', message = 'INVALID_CITY';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
  end if;

  if p_total_price is null or p_total_price <= 0 or p_total_price <> pg_catalog.trunc(p_total_price) then
    raise exception using errcode = 'P0001', message = 'INVALID_TOTAL_PRICE';
  end if;

  if p_card_expiry_month is null
    or p_card_expiry_year is null
    or p_card_expiry_month < 1
    or p_card_expiry_month > 12
    or p_card_expiry_year < 2000
    or p_card_expiry_year > 9999
  then
    raise exception using errcode = 'P0001', message = 'INVALID_CARD_EXPIRY';
  end if;

  v_phone := public.card_store_normalize_digits(p_contact_phone);

  if v_phone !~ '^05[0-9]{8}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_CONTACT_PHONE';
  end if;

  v_product_changed := p_product_id is distinct from v_listing.product_id;
  v_quantity_changed := p_quantity is distinct from v_listing.quantity;

  select p.id, p.product_name, p.min_quantity, p.max_quantity, p.is_active, p.is_deleted
  into v_product
  from public.finance_card_store_products as p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
  end if;

  if v_product_changed then
    if v_product.is_deleted then
      raise exception using errcode = 'P0001', message = 'PRODUCT_DELETED';
    end if;

    if not v_product.is_active then
      raise exception using errcode = 'P0001', message = 'PRODUCT_INACTIVE';
    end if;

    if p_quantity < v_product.min_quantity or p_quantity > v_product.max_quantity then
      raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
    end if;
  else
    if v_product.is_deleted then
      if v_quantity_changed then
        raise exception using errcode = 'P0001', message = 'PRODUCT_DELETED';
      end if;
    else
      if p_quantity < v_product.min_quantity or p_quantity > v_product.max_quantity then
        raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
      end if;
    end if;
  end if;

  v_unit_price := pg_catalog.round(p_total_price::numeric / p_quantity::numeric, 2);

  update public.finance_card_store_listings as l
  set listing_type = p_listing_type,
      product_id = p_product_id,
      product_name_snapshot = case
        when v_product_changed then v_product.product_name
        else l.product_name_snapshot
      end,
      city_code = p_city_code,
      quantity = p_quantity,
      total_price = p_total_price,
      unit_price = v_unit_price,
      contact_phone = v_phone,
      card_expiry_month = p_card_expiry_month::smallint,
      card_expiry_year = p_card_expiry_year::smallint
  where l.id = p_listing_id
  returning l.id into v_listing_id;

  out_listing_id := v_listing_id;
  return next;
end;
$$;

create or replace function public.card_store_complete_deal_internal(
  p_listing_id uuid,
  p_completed_by_actor_type text,
  p_completed_by_actor_id uuid
)
returns table(out_deal_id uuid, out_source_listing_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_listing public.finance_card_store_listings%rowtype;
  v_branch_name text;
  v_deal_id uuid;
  v_source_listing_id uuid;
  v_deleted_id uuid;
  v_constraint_name text;
begin
  select *
  into v_listing
  from public.finance_card_store_listings as l
  where l.id = p_listing_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'LISTING_NOT_FOUND';
  end if;

  if v_listing.expires_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'LISTING_EXPIRED';
  end if;

  select coalesce(nullif(pg_catalog.btrim(b.branch_name), ''), nullif(pg_catalog.btrim(b.organization_name), ''))
  into v_branch_name
  from public.finance_branches as b
  where b.id = v_listing.branch_id;

  if pg_catalog.length(pg_catalog.btrim(coalesce(v_branch_name, ''))) < 2 then
    raise exception using errcode = 'P0001', message = 'INVALID_BRANCH';
  end if;

  begin
    insert into public.finance_card_store_deals as d (
      source_listing_id,
      listing_type,
      branch_id,
      branch_name_snapshot,
      city_code,
      product_id,
      product_name_snapshot,
      quantity,
      total_price,
      unit_price,
      contact_phone,
      created_by_user_id,
      published_at,
      expires_at,
      card_expiry_month_snapshot,
      card_expiry_year_snapshot,
      completed_by_actor_type,
      completed_by_actor_id
    )
    values (
      v_listing.id,
      v_listing.listing_type,
      v_listing.branch_id,
      v_branch_name,
      v_listing.city_code,
      v_listing.product_id,
      v_listing.product_name_snapshot,
      v_listing.quantity,
      v_listing.total_price,
      v_listing.unit_price,
      v_listing.contact_phone,
      v_listing.created_by_user_id,
      v_listing.published_at,
      v_listing.expires_at,
      v_listing.card_expiry_month,
      v_listing.card_expiry_year,
      p_completed_by_actor_type,
      p_completed_by_actor_id
    )
    returning d.id, d.source_listing_id
    into v_deal_id, v_source_listing_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'finance_card_store_deals_source_listing_uidx' then
        raise exception using errcode = 'P0001', message = 'DEAL_ALREADY_COMPLETED';
      end if;

      raise;
  end;

  delete from public.finance_card_store_listings as l
  where l.id = v_listing.id
  returning l.id into v_deleted_id;

  if v_deleted_id is null then
    raise exception using errcode = 'P0001', message = 'LISTING_DELETE_FAILED';
  end if;

  out_deal_id := v_deal_id;
  out_source_listing_id := v_source_listing_id;
  return next;
end;
$$;

create or replace function public.create_card_store_listing_for_branch_atomic(
  p_actor_user_id uuid,
  p_actor_branch_id uuid,
  p_listing_type text,
  p_product_id uuid,
  p_city_code text,
  p_quantity integer,
  p_total_price numeric,
  p_contact_phone text,
  p_card_expiry_month integer,
  p_card_expiry_year integer
)
returns table(
  out_listing_id uuid,
  out_published_at timestamptz,
  out_expires_at timestamptz,
  out_unit_price numeric
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_product record;
  v_listing_id uuid;
  v_published_at timestamptz;
  v_expires_at timestamptz;
  v_unit_price numeric(14,2);
  v_phone text;
  v_constraint_name text;
begin
  -- API الفرع يستخرج p_actor_user_id و p_actor_branch_id من requireFinanceBranchSession.
  if not public.card_store_branch_user_has_access(p_actor_user_id, p_actor_branch_id) then
    raise exception using errcode = 'P0001', message = 'LISTING_ACCESS_DENIED';
  end if;

  if p_listing_type not in ('offered', 'wanted') then
    raise exception using errcode = 'P0001', message = 'INVALID_LISTING_TYPE';
  end if;

  if not public.card_store_is_valid_city(p_city_code) then
    raise exception using errcode = 'P0001', message = 'INVALID_CITY';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
  end if;

  if p_total_price is null or p_total_price <= 0 or p_total_price <> pg_catalog.trunc(p_total_price) then
    raise exception using errcode = 'P0001', message = 'INVALID_TOTAL_PRICE';
  end if;

  if p_card_expiry_month is null
    or p_card_expiry_year is null
    or p_card_expiry_month < 1
    or p_card_expiry_month > 12
    or p_card_expiry_year < 2000
    or p_card_expiry_year > 9999
  then
    raise exception using errcode = 'P0001', message = 'INVALID_CARD_EXPIRY';
  end if;

  v_phone := public.card_store_normalize_digits(p_contact_phone);

  if v_phone !~ '^05[0-9]{8}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_CONTACT_PHONE';
  end if;

  select p.id, p.product_name, p.min_quantity, p.max_quantity, p.is_active, p.is_deleted
  into v_product
  from public.finance_card_store_products as p
  where p.id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
  end if;

  if v_product.is_deleted then
    raise exception using errcode = 'P0001', message = 'PRODUCT_DELETED';
  end if;

  if not v_product.is_active then
    raise exception using errcode = 'P0001', message = 'PRODUCT_INACTIVE';
  end if;

  if p_quantity < v_product.min_quantity or p_quantity > v_product.max_quantity then
    raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
  end if;

  v_published_at := clock_timestamp();
  v_expires_at := v_published_at + interval '24 hours';
  v_unit_price := pg_catalog.round(p_total_price::numeric / p_quantity::numeric, 2);

  begin
    insert into public.finance_card_store_listings as l (
      listing_type,
      branch_id,
      created_by_user_id,
      product_id,
      product_name_snapshot,
      city_code,
      quantity,
      total_price,
      unit_price,
      contact_phone,
      published_at,
      expires_at,
      card_expiry_month,
      card_expiry_year
    )
    values (
      p_listing_type,
      p_actor_branch_id,
      p_actor_user_id,
      p_product_id,
      v_product.product_name,
      p_city_code,
      p_quantity,
      p_total_price,
      v_unit_price,
      v_phone,
      v_published_at,
      v_expires_at,
      p_card_expiry_month::smallint,
      p_card_expiry_year::smallint
    )
    returning l.id, l.published_at, l.expires_at, l.unit_price
    into v_listing_id, v_published_at, v_expires_at, v_unit_price;
  exception
    when exclusion_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'finance_card_store_listings_no_user_time_overlap' then
        raise exception using errcode = 'P0001', message = 'USER_ALREADY_HAS_ACTIVE_LISTING';
      end if;

      raise;
  end;

  out_listing_id := v_listing_id;
  out_published_at := v_published_at;
  out_expires_at := v_expires_at;
  out_unit_price := v_unit_price;
  return next;
end;
$$;

create or replace function public.update_card_store_listing_for_branch_atomic(
  p_actor_user_id uuid,
  p_actor_branch_id uuid,
  p_listing_id uuid,
  p_listing_type text,
  p_product_id uuid,
  p_city_code text,
  p_quantity integer,
  p_total_price numeric,
  p_contact_phone text,
  p_card_expiry_month integer,
  p_card_expiry_year integer
)
returns table(out_listing_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_listing public.finance_card_store_listings%rowtype;
  v_is_manager boolean;
begin
  if not public.card_store_branch_user_has_access(p_actor_user_id, p_actor_branch_id) then
    raise exception using errcode = 'P0001', message = 'LISTING_ACCESS_DENIED';
  end if;

  select *
  into v_listing
  from public.finance_card_store_listings as l
  where l.id = p_listing_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'LISTING_NOT_FOUND';
  end if;

  if v_listing.branch_id is distinct from p_actor_branch_id then
    raise exception using errcode = 'P0001', message = 'LISTING_ACCESS_DENIED';
  end if;

  v_is_manager := public.card_store_branch_user_is_manager(p_actor_user_id, p_actor_branch_id);

  if not (
    v_listing.created_by_user_id = p_actor_user_id
    or v_is_manager
  ) then
    raise exception using errcode = 'P0001', message = 'LISTING_ACCESS_DENIED';
  end if;

  return query
  select internal_result.out_listing_id
  from public.card_store_update_listing_internal(
    p_listing_id,
    p_listing_type,
    p_product_id,
    p_city_code,
    p_quantity,
    p_total_price,
    p_contact_phone,
    p_card_expiry_month,
    p_card_expiry_year
  ) as internal_result;
end;
$$;

create or replace function public.update_card_store_listing_for_support_atomic(
  p_support_user_id uuid,
  p_listing_id uuid,
  p_listing_type text,
  p_product_id uuid,
  p_city_code text,
  p_quantity integer,
  p_total_price numeric,
  p_contact_phone text,
  p_card_expiry_month integer,
  p_card_expiry_year integer
)
returns table(out_listing_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  -- API الإدارة المركزية يستخرج p_support_user_id من verifyAdminSupportRequest.
  if not public.card_store_support_has_manage_access(p_support_user_id) then
    raise exception using errcode = 'P0001', message = 'ADMIN_ACCESS_DENIED';
  end if;

  return query
  select internal_result.out_listing_id
  from public.card_store_update_listing_internal(
    p_listing_id,
    p_listing_type,
    p_product_id,
    p_city_code,
    p_quantity,
    p_total_price,
    p_contact_phone,
    p_card_expiry_month,
    p_card_expiry_year
  ) as internal_result;
end;
$$;

revoke execute on function public.card_store_update_listing_internal(uuid, text, uuid, text, integer, numeric, text, integer, integer) from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_complete_deal_internal(uuid, text, uuid) from PUBLIC, anon, authenticated, service_role;

revoke execute on function public.create_card_store_listing_for_branch_atomic(uuid, uuid, text, uuid, text, integer, numeric, text, integer, integer) from PUBLIC, anon, authenticated;
revoke execute on function public.update_card_store_listing_for_branch_atomic(uuid, uuid, uuid, text, uuid, text, integer, numeric, text, integer, integer) from PUBLIC, anon, authenticated;
revoke execute on function public.update_card_store_listing_for_support_atomic(uuid, uuid, text, uuid, text, integer, numeric, text, integer, integer) from PUBLIC, anon, authenticated;

grant execute on function public.create_card_store_listing_for_branch_atomic(uuid, uuid, text, uuid, text, integer, numeric, text, integer, integer) to service_role;
grant execute on function public.update_card_store_listing_for_branch_atomic(uuid, uuid, uuid, text, uuid, text, integer, numeric, text, integer, integer) to service_role;
grant execute on function public.update_card_store_listing_for_support_atomic(uuid, uuid, text, uuid, text, integer, numeric, text, integer, integer) to service_role;
