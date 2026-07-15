-- Migration: finance card store
-- Local migration file; validate locally before any remote deployment.

-- VERIFY LOCALLY: يجب تأكيد schema الامتدادات في بيئة Supabase قبل التنفيذ.
-- exclusion constraint يحتاج operator class مناسبة لمساواة uuid داخل GiST.
create extension if not exists btree_gist;

-- REQUIRED BEFORE UI USE:
-- يجب إضافة manage_card_store إلى قائمة صلاحيات الدعم في ملفات النظام قبل تفعيل الواجهة.

create function public.card_store_normalize_digits(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select pg_catalog.regexp_replace(
    pg_catalog.translate(
      coalesce(p_value, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '\s+',
    '',
    'g'
  );
$$;

create function public.card_store_is_valid_city(p_city_code text)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(p_city_code, '') = any (array[
    'riyadh',
    'makkah',
    'madinah',
    'qassim',
    'eastern_region',
    'asir',
    'tabuk',
    'hail',
    'northern_borders',
    'jazan',
    'najran',
    'al_baha',
    'al_jouf'
  ]);
$$;

create function public.card_store_is_manager_role(p_role text)
returns boolean
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(p_role, '') = any (array[
    'main_admin',
    'branch_manager',
    'مدير رئيسي',
    'مدير فرع',
    'مدير'
  ]);
$$;

create table public.finance_card_store_products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  min_quantity integer not null,
  max_quantity integer not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_support_user_id uuid null references public.admin_support_users(id) on update restrict on delete set null,
  updated_by_support_user_id uuid null references public.admin_support_users(id) on update restrict on delete set null,
  constraint finance_card_store_products_name_check check (pg_catalog.length(pg_catalog.btrim(product_name)) >= 2),
  constraint finance_card_store_products_min_quantity_check check (min_quantity > 0),
  constraint finance_card_store_products_max_quantity_check check (max_quantity >= min_quantity)
);

create table public.finance_card_store_listings (
  id uuid primary key default gen_random_uuid(),
  listing_type text not null,
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  product_id uuid not null references public.finance_card_store_products(id) on update restrict on delete restrict,
  product_name_snapshot text not null,
  city_code text not null,
  quantity integer not null,
  total_price numeric(12,0) not null,
  unit_price numeric(14,2) not null,
  contact_phone text not null,
  published_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_card_store_listings_type_check check (listing_type in ('offered', 'wanted')),
  constraint finance_card_store_listings_city_check check (public.card_store_is_valid_city(city_code)),
  constraint finance_card_store_listings_quantity_check check (quantity > 0),
  constraint finance_card_store_listings_total_price_check check (total_price > 0 and total_price = pg_catalog.trunc(total_price)),
  constraint finance_card_store_listings_unit_price_check check (unit_price > 0),
  constraint finance_card_store_listings_phone_check check (contact_phone ~ '^05[0-9]{8}$'),
  constraint finance_card_store_listings_duration_check check (expires_at = published_at + interval '24 hours'),
  constraint finance_card_store_listings_product_snapshot_check check (pg_catalog.length(pg_catalog.btrim(product_name_snapshot)) >= 2),
  constraint finance_card_store_listings_no_user_time_overlap exclude using gist (
    created_by_user_id with =,
    tstzrange(published_at, expires_at, '[)') with &&
  )
);

create table public.finance_card_store_deals (
  id uuid primary key default gen_random_uuid(),
  source_listing_id uuid not null,
  listing_type text not null,
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  branch_name_snapshot text not null,
  city_code text not null,
  product_id uuid not null references public.finance_card_store_products(id) on update restrict on delete restrict,
  product_name_snapshot text not null,
  quantity integer not null,
  total_price numeric(12,0) not null,
  unit_price numeric(14,2) not null,
  contact_phone text not null,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  published_at timestamptz not null,
  expires_at timestamptz not null,
  completed_at timestamptz not null default now(),
  completed_by_actor_type text not null,
  completed_by_actor_id uuid not null,
  constraint finance_card_store_deals_source_listing_uidx unique (source_listing_id),
  constraint finance_card_store_deals_type_check check (listing_type in ('offered', 'wanted')),
  constraint finance_card_store_deals_city_check check (public.card_store_is_valid_city(city_code)),
  constraint finance_card_store_deals_quantity_check check (quantity > 0),
  constraint finance_card_store_deals_total_price_check check (total_price > 0 and total_price = pg_catalog.trunc(total_price)),
  constraint finance_card_store_deals_unit_price_check check (unit_price > 0),
  constraint finance_card_store_deals_phone_check check (contact_phone ~ '^05[0-9]{8}$'),
  constraint finance_card_store_deals_actor_type_check check (completed_by_actor_type in ('branch_user', 'admin_support_user')),
  constraint finance_card_store_deals_branch_snapshot_check check (pg_catalog.length(pg_catalog.btrim(branch_name_snapshot)) >= 2),
  constraint finance_card_store_deals_product_snapshot_check check (pg_catalog.length(pg_catalog.btrim(product_name_snapshot)) >= 2),
  constraint finance_card_store_deals_duration_check check (expires_at = published_at + interval '24 hours')
);

create unique index finance_card_store_products_name_not_deleted_uidx
on public.finance_card_store_products (pg_catalog.lower(pg_catalog.btrim(product_name)))
where is_deleted = false;

create index finance_card_store_products_pick_idx
on public.finance_card_store_products (is_deleted, is_active, sort_order, product_name, id);

create index finance_card_store_listings_type_city_page_idx
on public.finance_card_store_listings (listing_type, city_code, expires_at, published_at desc, id desc);

create index finance_card_store_listings_type_page_idx
on public.finance_card_store_listings (listing_type, expires_at, published_at desc, id desc);

create index finance_card_store_listings_user_expiry_idx
on public.finance_card_store_listings (created_by_user_id, expires_at);

create index finance_card_store_listings_branch_expiry_idx
on public.finance_card_store_listings (branch_id, expires_at);

create index finance_card_store_deals_creator_page_idx
on public.finance_card_store_deals (created_by_user_id, completed_at desc, id desc);

create index finance_card_store_deals_branch_page_idx
on public.finance_card_store_deals (branch_id, completed_at desc, id desc);

create index finance_card_store_deals_city_page_idx
on public.finance_card_store_deals (city_code, completed_at desc, id desc);

create function public.card_store_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function public.card_store_prepare_listing_row()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.quantity is null or new.quantity <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
  end if;

  if new.total_price is null or new.total_price <= 0 or new.total_price <> pg_catalog.trunc(new.total_price) then
    raise exception using errcode = 'P0001', message = 'INVALID_TOTAL_PRICE';
  end if;

  new.contact_phone := public.card_store_normalize_digits(new.contact_phone);
  new.unit_price := pg_catalog.round(new.total_price::numeric / new.quantity::numeric, 2);

  if tg_op = 'INSERT' then
    if new.published_at is null then
      raise exception using errcode = 'P0001', message = 'INVALID_PUBLISHED_AT';
    end if;

    if new.expires_at is null then
      raise exception using errcode = 'P0001', message = 'INVALID_EXPIRES_AT';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.branch_id is distinct from old.branch_id
       or new.created_by_user_id is distinct from old.created_by_user_id
       or new.published_at is distinct from old.published_at
       or new.expires_at is distinct from old.expires_at then
      raise exception using errcode = 'P0001', message = 'IMMUTABLE_LISTING_FIELD';
    end if;
  end if;

  if new.expires_at <> new.published_at + interval '24 hours' then
    raise exception using errcode = 'P0001', message = 'INVALID_LISTING_DURATION';
  end if;

  return new;
end;
$$;

create function public.card_store_block_deal_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception using errcode = 'P0001', message = 'CARD_STORE_DEAL_IMMUTABLE';
end;
$$;

create trigger finance_card_store_products_touch_updated_at
before update on public.finance_card_store_products
for each row execute function public.card_store_touch_updated_at();

create trigger finance_card_store_listings_prepare_row
before insert or update on public.finance_card_store_listings
for each row execute function public.card_store_prepare_listing_row();

create trigger finance_card_store_listings_touch_updated_at
before update on public.finance_card_store_listings
for each row execute function public.card_store_touch_updated_at();

create trigger finance_card_store_deals_block_mutation
before update or delete on public.finance_card_store_deals
for each row execute function public.card_store_block_deal_mutation();

alter table public.finance_card_store_products enable row level security;
alter table public.finance_card_store_listings enable row level security;
alter table public.finance_card_store_deals enable row level security;

create function public.card_store_branch_user_has_access(
  p_user_id uuid,
  p_branch_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_user record;
begin
  select
    u.id,
    u.branch_id,
    u.role,
    u.permissions,
    u.is_active,
    u.disabled_at,
    u.self_disabled,
    b.is_active as branch_is_active
  into v_user
  from public.finance_branch_users as u
  join public.finance_branches as b
    on b.id = u.branch_id
  where u.id = p_user_id
    and u.branch_id = p_branch_id;

  if not found then
    return false;
  end if;

  if coalesce(v_user.is_active, false) is not true
     or v_user.disabled_at is not null
     or coalesce(v_user.self_disabled, false) is true
     or coalesce(v_user.branch_is_active, false) is not true then
    return false;
  end if;

  if public.card_store_is_manager_role(v_user.role) then
    return true;
  end if;

  return 'card_store' = any(coalesce(v_user.permissions, '{}'::text[]));
end;
$$;

create function public.card_store_branch_user_is_manager(
  p_user_id uuid,
  p_branch_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_role text;
begin
  select u.role
  into v_role
  from public.finance_branch_users as u
  join public.finance_branches as b
    on b.id = u.branch_id
  where u.id = p_user_id
    and u.branch_id = p_branch_id
    and coalesce(u.is_active, false) is true
    and u.disabled_at is null
    and coalesce(u.self_disabled, false) is false
    and coalesce(b.is_active, false) is true;

  return public.card_store_is_manager_role(v_role);
end;
$$;

create function public.card_store_support_has_manage_access(
  p_support_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_role text;
begin
  select su.role
  into v_role
  from public.admin_support_users as su
  where su.id = p_support_user_id
    and coalesce(su.is_active, false) is true;

  if not found then
    return false;
  end if;

  if v_role = 'super_admin' then
    return true;
  end if;

  return exists (
    select 1
    from public.admin_support_user_permissions as sup
    where sup.user_id = p_support_user_id
      and sup.permission_key = 'manage_card_store'
  );
end;
$$;

create function public.card_store_update_listing_internal(
  p_listing_id uuid,
  p_listing_type text,
  p_product_id uuid,
  p_city_code text,
  p_quantity integer,
  p_total_price numeric,
  p_contact_phone text
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
      contact_phone = v_phone
  where l.id = p_listing_id
  returning l.id into v_listing_id;

  out_listing_id := v_listing_id;
  return next;
end;
$$;

create function public.card_store_delete_listing_internal(
  p_listing_id uuid
)
returns table(out_deleted_listing_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_deleted_id uuid;
begin
  delete from public.finance_card_store_listings as l
  where l.id = p_listing_id
  returning l.id into v_deleted_id;

  if v_deleted_id is null then
    raise exception using errcode = 'P0001', message = 'LISTING_DELETE_FAILED';
  end if;

  out_deleted_listing_id := v_deleted_id;
  return next;
end;
$$;

create function public.card_store_complete_deal_internal(
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

create function public.create_card_store_product_atomic(
  p_support_user_id uuid,
  p_product_name text,
  p_min_quantity integer,
  p_max_quantity integer,
  p_sort_order integer default 0
)
returns table(out_product_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_product_id uuid;
  v_constraint_name text;
begin
  if not public.card_store_support_has_manage_access(p_support_user_id) then
    raise exception using errcode = 'P0001', message = 'ADMIN_ACCESS_DENIED';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_product_name, ''))) < 2 then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT_NAME';
  end if;

  if p_min_quantity is null or p_max_quantity is null or p_min_quantity <= 0 or p_max_quantity < p_min_quantity then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT_LIMITS';
  end if;

  begin
    insert into public.finance_card_store_products as p (
      product_name,
      min_quantity,
      max_quantity,
      sort_order,
      created_by_support_user_id,
      updated_by_support_user_id
    )
    values (
      pg_catalog.btrim(p_product_name),
      p_min_quantity,
      p_max_quantity,
      coalesce(p_sort_order, 0),
      p_support_user_id,
      p_support_user_id
    )
    returning p.id into v_product_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'finance_card_store_products_name_not_deleted_uidx'
         and exists (
           select 1
           from public.finance_card_store_products as existing
           where existing.is_deleted = false
             and pg_catalog.lower(pg_catalog.btrim(existing.product_name)) =
                 pg_catalog.lower(pg_catalog.btrim(p_product_name))
         ) then
        raise exception using errcode = 'P0001', message = 'PRODUCT_NAME_ALREADY_EXISTS';
      end if;

      raise;
  end;

  out_product_id := v_product_id;
  return next;
end;
$$;

create function public.update_card_store_product_atomic(
  p_support_user_id uuid,
  p_product_id uuid,
  p_product_name text,
  p_min_quantity integer,
  p_max_quantity integer,
  p_sort_order integer default 0
)
returns table(out_product_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_product_id uuid;
  v_constraint_name text;
begin
  if not public.card_store_support_has_manage_access(p_support_user_id) then
    raise exception using errcode = 'P0001', message = 'ADMIN_ACCESS_DENIED';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_product_name, ''))) < 2 then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT_NAME';
  end if;

  if p_min_quantity is null or p_max_quantity is null or p_min_quantity <= 0 or p_max_quantity < p_min_quantity then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT_LIMITS';
  end if;

  begin
    update public.finance_card_store_products as p
    set product_name = pg_catalog.btrim(p_product_name),
        min_quantity = p_min_quantity,
        max_quantity = p_max_quantity,
        sort_order = coalesce(p_sort_order, 0),
        updated_by_support_user_id = p_support_user_id
    where p.id = p_product_id
      and p.is_deleted = false
    returning p.id into v_product_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'finance_card_store_products_name_not_deleted_uidx'
         and exists (
           select 1
           from public.finance_card_store_products as existing
           where existing.id <> p_product_id
             and existing.is_deleted = false
             and pg_catalog.lower(pg_catalog.btrim(existing.product_name)) =
                 pg_catalog.lower(pg_catalog.btrim(p_product_name))
         ) then
        raise exception using errcode = 'P0001', message = 'PRODUCT_NAME_ALREADY_EXISTS';
      end if;

      raise;
  end;

  if v_product_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
  end if;

  out_product_id := v_product_id;
  return next;
end;
$$;

create function public.set_card_store_product_active_atomic(
  p_support_user_id uuid,
  p_product_id uuid,
  p_is_active boolean
)
returns table(out_product_id uuid, out_is_active boolean)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_product_id uuid;
  v_is_active boolean;
begin
  if not public.card_store_support_has_manage_access(p_support_user_id) then
    raise exception using errcode = 'P0001', message = 'ADMIN_ACCESS_DENIED';
  end if;

  update public.finance_card_store_products as p
  set is_active = coalesce(p_is_active, false),
      updated_by_support_user_id = p_support_user_id
  where p.id = p_product_id
    and p.is_deleted = false
  returning p.id, p.is_active into v_product_id, v_is_active;

  if v_product_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
  end if;

  out_product_id := v_product_id;
  out_is_active := v_is_active;
  return next;
end;
$$;

create function public.soft_delete_card_store_product_atomic(
  p_support_user_id uuid,
  p_product_id uuid
)
returns table(out_product_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_product_id uuid;
begin
  if not public.card_store_support_has_manage_access(p_support_user_id) then
    raise exception using errcode = 'P0001', message = 'ADMIN_ACCESS_DENIED';
  end if;

  update public.finance_card_store_products as p
  set is_deleted = true,
      is_active = false,
      updated_by_support_user_id = p_support_user_id
  where p.id = p_product_id
    and p.is_deleted = false
  returning p.id into v_product_id;

  if v_product_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_PRODUCT';
  end if;

  out_product_id := v_product_id;
  return next;
end;
$$;

create function public.create_card_store_listing_for_branch_atomic(
  p_actor_user_id uuid,
  p_actor_branch_id uuid,
  p_listing_type text,
  p_product_id uuid,
  p_city_code text,
  p_quantity integer,
  p_total_price numeric,
  p_contact_phone text
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
      expires_at
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
      v_expires_at
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

create function public.update_card_store_listing_for_branch_atomic(
  p_actor_user_id uuid,
  p_actor_branch_id uuid,
  p_listing_id uuid,
  p_listing_type text,
  p_product_id uuid,
  p_city_code text,
  p_quantity integer,
  p_total_price numeric,
  p_contact_phone text
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
    p_contact_phone
  ) as internal_result;
end;
$$;

create function public.delete_card_store_listing_for_branch_atomic(
  p_actor_user_id uuid,
  p_actor_branch_id uuid,
  p_listing_id uuid
)
returns table(out_deleted_listing_id uuid)
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
  select internal_result.out_deleted_listing_id
  from public.card_store_delete_listing_internal(p_listing_id) as internal_result;
end;
$$;

create function public.complete_card_store_deal_for_branch_atomic(
  p_actor_user_id uuid,
  p_actor_branch_id uuid,
  p_listing_id uuid
)
returns table(out_deal_id uuid, out_source_listing_id uuid)
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
  select internal_result.out_deal_id, internal_result.out_source_listing_id
  from public.card_store_complete_deal_internal(
    p_listing_id,
    'branch_user',
    p_actor_user_id
  ) as internal_result;
end;
$$;

create function public.update_card_store_listing_for_support_atomic(
  p_support_user_id uuid,
  p_listing_id uuid,
  p_listing_type text,
  p_product_id uuid,
  p_city_code text,
  p_quantity integer,
  p_total_price numeric,
  p_contact_phone text
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
    p_contact_phone
  ) as internal_result;
end;
$$;

create function public.delete_card_store_listing_for_support_atomic(
  p_support_user_id uuid,
  p_listing_id uuid
)
returns table(out_deleted_listing_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not public.card_store_support_has_manage_access(p_support_user_id) then
    raise exception using errcode = 'P0001', message = 'ADMIN_ACCESS_DENIED';
  end if;

  return query
  select internal_result.out_deleted_listing_id
  from public.card_store_delete_listing_internal(p_listing_id) as internal_result;
end;
$$;

create function public.complete_card_store_deal_for_support_atomic(
  p_support_user_id uuid,
  p_listing_id uuid
)
returns table(out_deal_id uuid, out_source_listing_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if not public.card_store_support_has_manage_access(p_support_user_id) then
    raise exception using errcode = 'P0001', message = 'ADMIN_ACCESS_DENIED';
  end if;

  return query
  select internal_result.out_deal_id, internal_result.out_source_listing_id
  from public.card_store_complete_deal_internal(
    p_listing_id,
    'admin_support_user',
    p_support_user_id
  ) as internal_result;
end;
$$;

revoke all on table public.finance_card_store_products from PUBLIC, anon, authenticated;
revoke all on table public.finance_card_store_listings from PUBLIC, anon, authenticated;
revoke all on table public.finance_card_store_deals from PUBLIC, anon, authenticated;

revoke insert, update, delete, truncate, references, trigger on table public.finance_card_store_products from service_role;
revoke insert, update, delete, truncate, references, trigger on table public.finance_card_store_listings from service_role;
revoke insert, update, delete, truncate, references, trigger on table public.finance_card_store_deals from service_role;

grant select on table public.finance_card_store_products to service_role;
grant select on table public.finance_card_store_listings to service_role;
grant select on table public.finance_card_store_deals to service_role;

revoke execute on function public.card_store_normalize_digits(text) from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_is_valid_city(text) from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_is_manager_role(text) from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_touch_updated_at() from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_prepare_listing_row() from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_block_deal_mutation() from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_branch_user_has_access(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_branch_user_is_manager(uuid, uuid) from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_support_has_manage_access(uuid) from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_update_listing_internal(uuid, text, uuid, text, integer, numeric, text) from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_delete_listing_internal(uuid) from PUBLIC, anon, authenticated, service_role;
revoke execute on function public.card_store_complete_deal_internal(uuid, text, uuid) from PUBLIC, anon, authenticated, service_role;

revoke execute on function public.create_card_store_product_atomic(uuid, text, integer, integer, integer) from PUBLIC, anon, authenticated;
revoke execute on function public.update_card_store_product_atomic(uuid, uuid, text, integer, integer, integer) from PUBLIC, anon, authenticated;
revoke execute on function public.set_card_store_product_active_atomic(uuid, uuid, boolean) from PUBLIC, anon, authenticated;
revoke execute on function public.soft_delete_card_store_product_atomic(uuid, uuid) from PUBLIC, anon, authenticated;
revoke execute on function public.create_card_store_listing_for_branch_atomic(uuid, uuid, text, uuid, text, integer, numeric, text) from PUBLIC, anon, authenticated;
revoke execute on function public.update_card_store_listing_for_branch_atomic(uuid, uuid, uuid, text, uuid, text, integer, numeric, text) from PUBLIC, anon, authenticated;
revoke execute on function public.delete_card_store_listing_for_branch_atomic(uuid, uuid, uuid) from PUBLIC, anon, authenticated;
revoke execute on function public.complete_card_store_deal_for_branch_atomic(uuid, uuid, uuid) from PUBLIC, anon, authenticated;
revoke execute on function public.update_card_store_listing_for_support_atomic(uuid, uuid, text, uuid, text, integer, numeric, text) from PUBLIC, anon, authenticated;
revoke execute on function public.delete_card_store_listing_for_support_atomic(uuid, uuid) from PUBLIC, anon, authenticated;
revoke execute on function public.complete_card_store_deal_for_support_atomic(uuid, uuid) from PUBLIC, anon, authenticated;

grant execute on function public.create_card_store_product_atomic(uuid, text, integer, integer, integer) to service_role;
grant execute on function public.update_card_store_product_atomic(uuid, uuid, text, integer, integer, integer) to service_role;
grant execute on function public.set_card_store_product_active_atomic(uuid, uuid, boolean) to service_role;
grant execute on function public.soft_delete_card_store_product_atomic(uuid, uuid) to service_role;
grant execute on function public.create_card_store_listing_for_branch_atomic(uuid, uuid, text, uuid, text, integer, numeric, text) to service_role;
grant execute on function public.update_card_store_listing_for_branch_atomic(uuid, uuid, uuid, text, uuid, text, integer, numeric, text) to service_role;
grant execute on function public.delete_card_store_listing_for_branch_atomic(uuid, uuid, uuid) to service_role;
grant execute on function public.complete_card_store_deal_for_branch_atomic(uuid, uuid, uuid) to service_role;
grant execute on function public.update_card_store_listing_for_support_atomic(uuid, uuid, text, uuid, text, integer, numeric, text) to service_role;
grant execute on function public.delete_card_store_listing_for_support_atomic(uuid, uuid) to service_role;
grant execute on function public.complete_card_store_deal_for_support_atomic(uuid, uuid) to service_role;
