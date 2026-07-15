begin;

create table if not exists public.ehtisab_finance_providers (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  display_order integer not null default 0,
  default_margin_rate numeric(7,4) not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  created_by_name text,
  updated_by uuid,
  updated_by_name text,
  constraint ehtisab_finance_providers_name_check
    check (length(trim(provider_name)) >= 2),
  constraint ehtisab_finance_providers_default_margin_rate_check
    check (default_margin_rate > 0 and default_margin_rate <= 100)
);

create unique index if not exists ehtisab_finance_providers_name_unique_idx
  on public.ehtisab_finance_providers (lower(trim(provider_name)))
  where is_deleted = false;

create index if not exists ehtisab_finance_providers_active_order_idx
  on public.ehtisab_finance_providers (is_active, is_deleted, display_order, provider_name);

create table if not exists public.ehtisab_provider_finance_types (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.ehtisab_finance_providers (id) on delete cascade,
  finance_type text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ehtisab_provider_finance_types_type_check
    check (finance_type in ('personal', 'real')),
  constraint ehtisab_provider_finance_types_unique
    unique (provider_id, finance_type)
);

create index if not exists ehtisab_provider_finance_types_lookup_idx
  on public.ehtisab_provider_finance_types (finance_type, is_active, provider_id);

create table if not exists public.ehtisab_margin_rules (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.ehtisab_finance_providers (id) on delete cascade,
  finance_type text not null,
  work_category text not null,
  salary_from numeric(14,2) not null,
  salary_to numeric(14,2) not null,
  term_months_from integer,
  term_months_to integer,
  margin_rate numeric(7,4) not null,
  is_active boolean not null default true,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  created_by_name text,
  updated_by uuid,
  updated_by_name text,
  constraint ehtisab_margin_rules_finance_type_check
    check (finance_type in ('personal', 'real')),
  constraint ehtisab_margin_rules_work_category_check
    check (work_category in ('civil', 'military', 'retired', 'semi_government', 'private')),
  constraint ehtisab_margin_rules_salary_check
    check (salary_from > 0 and salary_to > 0 and salary_from <= salary_to),
  constraint ehtisab_margin_rules_term_check
    check (
      (term_months_from is null and term_months_to is null)
      or (
        term_months_from is not null
        and term_months_to is not null
        and term_months_from > 0
        and term_months_from <= term_months_to
      )
    ),
  constraint ehtisab_margin_rules_margin_rate_check
    check (margin_rate > 0 and margin_rate <= 100)
);

create index if not exists ehtisab_margin_rules_lookup_idx
  on public.ehtisab_margin_rules (
    provider_id,
    finance_type,
    work_category,
    is_active,
    is_deleted,
    salary_from,
    salary_to
  );

create or replace function public.set_ehtisab_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_ehtisab_finance_providers_updated_at
  on public.ehtisab_finance_providers;

create trigger set_ehtisab_finance_providers_updated_at
before update on public.ehtisab_finance_providers
for each row
execute function public.set_ehtisab_updated_at();

drop trigger if exists set_ehtisab_provider_finance_types_updated_at
  on public.ehtisab_provider_finance_types;

create trigger set_ehtisab_provider_finance_types_updated_at
before update on public.ehtisab_provider_finance_types
for each row
execute function public.set_ehtisab_updated_at();

drop trigger if exists set_ehtisab_margin_rules_updated_at
  on public.ehtisab_margin_rules;

create trigger set_ehtisab_margin_rules_updated_at
before update on public.ehtisab_margin_rules
for each row
execute function public.set_ehtisab_updated_at();

create or replace function public.ehtisab_normalized_finance_types(
  p_finance_types text[]
)
returns text[]
language plpgsql
stable
as $$
declare
  v_finance_types text[];
begin
  select array_agg(distinct trimmed_type order by trimmed_type)
  into v_finance_types
  from (
    select trim(value) as trimmed_type
    from unnest(coalesce(p_finance_types, array[]::text[])) as value
  ) as normalized
  where trimmed_type <> '';

  if coalesce(array_length(v_finance_types, 1), 0) = 0 then
    raise exception 'FINANCE_TYPE_REQUIRED';
  end if;

  if exists (
    select 1
    from unnest(v_finance_types) as value
    where value not in ('personal', 'real')
  ) then
    raise exception 'INVALID_FINANCE_TYPE';
  end if;

  return v_finance_types;
end;
$$;

create or replace function public.ehtisab_validate_provider_finance_type(
  p_provider_id uuid,
  p_finance_type text
)
returns void
language plpgsql
stable
as $$
begin
  if not exists (
    select 1
    from public.ehtisab_finance_providers provider
    join public.ehtisab_provider_finance_types provider_type
      on provider_type.provider_id = provider.id
    where provider.id = p_provider_id
      and provider.is_active = true
      and provider.is_deleted = false
      and provider_type.finance_type = p_finance_type
      and provider_type.is_active = true
  ) then
    raise exception 'PROVIDER_FINANCE_TYPE_NOT_SUPPORTED';
  end if;
end;
$$;

create or replace function public.ehtisab_margin_rule_has_overlap(
  p_provider_id uuid,
  p_finance_type text,
  p_work_category text,
  p_salary_from numeric,
  p_salary_to numeric,
  p_term_months_from integer,
  p_term_months_to integer,
  p_exclude_rule_id uuid default null
)
returns boolean
language plpgsql
stable
as $$
begin
  return exists (
    select 1
    from public.ehtisab_margin_rules rule
    where rule.provider_id = p_provider_id
      and rule.finance_type = p_finance_type
      and rule.work_category = p_work_category
      and rule.is_active = true
      and rule.is_deleted = false
      and (p_exclude_rule_id is null or rule.id <> p_exclude_rule_id)
      and rule.salary_from <= p_salary_to
      and rule.salary_to >= p_salary_from
      and (
        rule.term_months_from is null
        or p_term_months_to is null
        or rule.term_months_from <= p_term_months_to
      )
      and (
        rule.term_months_to is null
        or p_term_months_from is null
        or rule.term_months_to >= p_term_months_from
      )
  );
end;
$$;

create or replace function public.ehtisab_margin_rules_prevent_overlap()
returns trigger
language plpgsql
as $$
begin
  if new.is_active = true and new.is_deleted = false then
    if public.ehtisab_margin_rule_has_overlap(
      new.provider_id,
      new.finance_type,
      new.work_category,
      new.salary_from,
      new.salary_to,
      new.term_months_from,
      new.term_months_to,
      case when tg_op = 'UPDATE' then old.id else null end
    ) then
      raise exception 'MARGIN_RULE_OVERLAP';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ehtisab_margin_rules_prevent_overlap_trigger
  on public.ehtisab_margin_rules;

create trigger ehtisab_margin_rules_prevent_overlap_trigger
before insert or update on public.ehtisab_margin_rules
for each row
execute function public.ehtisab_margin_rules_prevent_overlap();

create or replace function public.create_ehtisab_finance_provider_atomic(
  p_provider_name text,
  p_display_order integer,
  p_default_margin_rate numeric,
  p_finance_types text[],
  p_actor_user_id uuid,
  p_actor_user_name text
)
returns table (
  provider_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id uuid;
  v_finance_types text[];
begin
  if length(trim(coalesce(p_provider_name, ''))) < 2 then
    raise exception 'PROVIDER_NAME_REQUIRED';
  end if;

  if p_default_margin_rate is null or p_default_margin_rate <= 0 or p_default_margin_rate > 100 then
    raise exception 'INVALID_DEFAULT_MARGIN_RATE';
  end if;

  v_finance_types := public.ehtisab_normalized_finance_types(p_finance_types);

  insert into public.ehtisab_finance_providers (
    provider_name,
    display_order,
    default_margin_rate,
    created_by,
    created_by_name,
    updated_by,
    updated_by_name
  )
  values (
    trim(p_provider_name),
    coalesce(p_display_order, 0),
    p_default_margin_rate,
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), ''),
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), '')
  )
  returning id into v_provider_id;

  insert into public.ehtisab_provider_finance_types (
    provider_id,
    finance_type
  )
  select v_provider_id, value
  from unnest(v_finance_types) as value;

  insert into public.admin_support_logs (
    user_id,
    user_name,
    action,
    target_type,
    target_id,
    details
  )
  values (
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), ''),
    'إنشاء جهة تمويل احتساب',
    'ehtisab_finance_provider',
    v_provider_id::text,
    jsonb_build_object(
      'provider_name', trim(p_provider_name),
      'finance_types', v_finance_types
    )::text
  );

  return query select v_provider_id;
end;
$$;

create or replace function public.update_ehtisab_finance_provider_atomic(
  p_provider_id uuid,
  p_provider_name text,
  p_display_order integer,
  p_default_margin_rate numeric,
  p_finance_types text[],
  p_actor_user_id uuid,
  p_actor_user_name text
)
returns table (
  provider_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_finance_types text[];
begin
  if p_provider_id is null then
    raise exception 'PROVIDER_ID_REQUIRED';
  end if;

  if length(trim(coalesce(p_provider_name, ''))) < 2 then
    raise exception 'PROVIDER_NAME_REQUIRED';
  end if;

  if p_default_margin_rate is null or p_default_margin_rate <= 0 or p_default_margin_rate > 100 then
    raise exception 'INVALID_DEFAULT_MARGIN_RATE';
  end if;

  v_finance_types := public.ehtisab_normalized_finance_types(p_finance_types);

  select to_jsonb(provider)
  into v_before
  from public.ehtisab_finance_providers provider
  where provider.id = p_provider_id
    and provider.is_deleted = false
  for update;

  if v_before is null then
    raise exception 'PROVIDER_NOT_FOUND';
  end if;

  update public.ehtisab_finance_providers
  set provider_name = trim(p_provider_name),
      display_order = coalesce(p_display_order, 0),
      default_margin_rate = p_default_margin_rate,
      updated_by = p_actor_user_id,
      updated_by_name = nullif(trim(coalesce(p_actor_user_name, '')), '')
  where id = p_provider_id;

  update public.ehtisab_provider_finance_types
  set is_active = false
  where provider_id = p_provider_id
    and finance_type <> all(v_finance_types);

  insert into public.ehtisab_provider_finance_types (
    provider_id,
    finance_type,
    is_active
  )
  select p_provider_id, value, true
  from unnest(v_finance_types) as value
  on conflict (provider_id, finance_type)
  do update set is_active = excluded.is_active;

  select to_jsonb(provider)
  into v_after
  from public.ehtisab_finance_providers provider
  where provider.id = p_provider_id;

  insert into public.admin_support_logs (
    user_id,
    user_name,
    action,
    target_type,
    target_id,
    details
  )
  values (
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), ''),
    'تعديل جهة تمويل احتساب',
    'ehtisab_finance_provider',
    p_provider_id::text,
    jsonb_build_object(
      'before', v_before,
      'after', v_after,
      'finance_types', v_finance_types
    )::text
  );

  return query select p_provider_id;
end;
$$;

create or replace function public.set_ehtisab_finance_provider_active_atomic(
  p_provider_id uuid,
  p_is_active boolean,
  p_actor_user_id uuid,
  p_actor_user_name text
)
returns table (
  provider_id uuid,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if p_provider_id is null then
    raise exception 'PROVIDER_ID_REQUIRED';
  end if;

  if p_is_active is null then
    raise exception 'PROVIDER_STATUS_REQUIRED';
  end if;

  select to_jsonb(provider)
  into v_before
  from public.ehtisab_finance_providers provider
  where provider.id = p_provider_id
    and provider.is_deleted = false
  for update;

  if v_before is null then
    raise exception 'PROVIDER_NOT_FOUND';
  end if;

  update public.ehtisab_finance_providers
  set is_active = p_is_active,
      updated_by = p_actor_user_id,
      updated_by_name = nullif(trim(coalesce(p_actor_user_name, '')), '')
  where id = p_provider_id;

  insert into public.admin_support_logs (
    user_id,
    user_name,
    action,
    target_type,
    target_id,
    details
  )
  values (
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), ''),
    case when p_is_active then 'تفعيل جهة تمويل احتساب' else 'تعطيل جهة تمويل احتساب' end,
    'ehtisab_finance_provider',
    p_provider_id::text,
    jsonb_build_object('before', v_before, 'is_active', p_is_active)::text
  );

  return query select p_provider_id, p_is_active;
end;
$$;

create or replace function public.soft_delete_ehtisab_finance_provider_atomic(
  p_provider_id uuid,
  p_actor_user_id uuid,
  p_actor_user_name text
)
returns table (
  provider_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if p_provider_id is null then
    raise exception 'PROVIDER_ID_REQUIRED';
  end if;

  select to_jsonb(provider)
  into v_before
  from public.ehtisab_finance_providers provider
  where provider.id = p_provider_id
    and provider.is_deleted = false
  for update;

  if v_before is null then
    raise exception 'PROVIDER_NOT_FOUND';
  end if;

  update public.ehtisab_finance_providers
  set is_active = false,
      is_deleted = true,
      updated_by = p_actor_user_id,
      updated_by_name = nullif(trim(coalesce(p_actor_user_name, '')), '')
  where id = p_provider_id;

  update public.ehtisab_provider_finance_types
  set is_active = false
  where provider_id = p_provider_id;

  insert into public.admin_support_logs (
    user_id,
    user_name,
    action,
    target_type,
    target_id,
    details
  )
  values (
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), ''),
    'حذف ناعم لجهة تمويل احتساب',
    'ehtisab_finance_provider',
    p_provider_id::text,
    jsonb_build_object('before', v_before)::text
  );

  return query select p_provider_id;
end;
$$;

create or replace function public.create_ehtisab_margin_rule_atomic(
  p_provider_id uuid,
  p_finance_type text,
  p_work_category text,
  p_salary_from numeric,
  p_salary_to numeric,
  p_term_months_from integer,
  p_term_months_to integer,
  p_margin_rate numeric,
  p_actor_user_id uuid,
  p_actor_user_name text
)
returns table (
  rule_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule_id uuid;
begin
  perform public.ehtisab_validate_provider_finance_type(p_provider_id, trim(coalesce(p_finance_type, '')));

  insert into public.ehtisab_margin_rules (
    provider_id,
    finance_type,
    work_category,
    salary_from,
    salary_to,
    term_months_from,
    term_months_to,
    margin_rate,
    created_by,
    created_by_name,
    updated_by,
    updated_by_name
  )
  values (
    p_provider_id,
    trim(coalesce(p_finance_type, '')),
    trim(coalesce(p_work_category, '')),
    p_salary_from,
    p_salary_to,
    p_term_months_from,
    p_term_months_to,
    p_margin_rate,
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), ''),
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), '')
  )
  returning id into v_rule_id;

  insert into public.admin_support_logs (
    user_id,
    user_name,
    action,
    target_type,
    target_id,
    details
  )
  values (
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), ''),
    'إنشاء قاعدة هامش احتساب',
    'ehtisab_margin_rule',
    v_rule_id::text,
    jsonb_build_object(
      'provider_id', p_provider_id,
      'finance_type', p_finance_type,
      'work_category', p_work_category
    )::text
  );

  return query select v_rule_id;
end;
$$;

create or replace function public.update_ehtisab_margin_rule_atomic(
  p_rule_id uuid,
  p_provider_id uuid,
  p_finance_type text,
  p_work_category text,
  p_salary_from numeric,
  p_salary_to numeric,
  p_term_months_from integer,
  p_term_months_to integer,
  p_margin_rate numeric,
  p_is_active boolean,
  p_actor_user_id uuid,
  p_actor_user_name text
)
returns table (
  rule_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_active boolean;
begin
  if p_rule_id is null then
    raise exception 'RULE_ID_REQUIRED';
  end if;

  perform public.ehtisab_validate_provider_finance_type(p_provider_id, trim(coalesce(p_finance_type, '')));

  select to_jsonb(rule)
  into v_before
  from public.ehtisab_margin_rules rule
  where rule.id = p_rule_id
    and rule.is_deleted = false
  for update;

  if v_before is null then
    raise exception 'RULE_NOT_FOUND';
  end if;

  v_active := coalesce(p_is_active, true);

  update public.ehtisab_margin_rules
  set provider_id = p_provider_id,
      finance_type = trim(coalesce(p_finance_type, '')),
      work_category = trim(coalesce(p_work_category, '')),
      salary_from = p_salary_from,
      salary_to = p_salary_to,
      term_months_from = p_term_months_from,
      term_months_to = p_term_months_to,
      margin_rate = p_margin_rate,
      is_active = v_active,
      updated_by = p_actor_user_id,
      updated_by_name = nullif(trim(coalesce(p_actor_user_name, '')), '')
  where id = p_rule_id;

  insert into public.admin_support_logs (
    user_id,
    user_name,
    action,
    target_type,
    target_id,
    details
  )
  values (
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), ''),
    'تعديل قاعدة هامش احتساب',
    'ehtisab_margin_rule',
    p_rule_id::text,
    jsonb_build_object('before', v_before)::text
  );

  return query select p_rule_id;
end;
$$;

create or replace function public.soft_delete_ehtisab_margin_rule_atomic(
  p_rule_id uuid,
  p_actor_user_id uuid,
  p_actor_user_name text
)
returns table (
  rule_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if p_rule_id is null then
    raise exception 'RULE_ID_REQUIRED';
  end if;

  select to_jsonb(rule)
  into v_before
  from public.ehtisab_margin_rules rule
  where rule.id = p_rule_id
    and rule.is_deleted = false
  for update;

  if v_before is null then
    raise exception 'RULE_NOT_FOUND';
  end if;

  update public.ehtisab_margin_rules
  set is_active = false,
      is_deleted = true,
      updated_by = p_actor_user_id,
      updated_by_name = nullif(trim(coalesce(p_actor_user_name, '')), '')
  where id = p_rule_id;

  insert into public.admin_support_logs (
    user_id,
    user_name,
    action,
    target_type,
    target_id,
    details
  )
  values (
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), ''),
    'حذف قاعدة هامش احتساب',
    'ehtisab_margin_rule',
    p_rule_id::text,
    jsonb_build_object('before', v_before)::text
  );

  return query select p_rule_id;
end;
$$;

create or replace function public.match_ehtisab_margin(
  p_finance_type text,
  p_provider_id uuid,
  p_work_category text,
  p_salary numeric,
  p_term_months integer
)
returns table (
  matched_margin numeric,
  source text,
  rule_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider public.ehtisab_finance_providers%rowtype;
  v_match_count integer;
  v_rule public.ehtisab_margin_rules%rowtype;
begin
  if p_provider_id is null then
    raise exception 'PROVIDER_ID_REQUIRED';
  end if;

  if trim(coalesce(p_finance_type, '')) not in ('personal', 'real') then
    raise exception 'INVALID_FINANCE_TYPE';
  end if;

  if trim(coalesce(p_work_category, '')) not in ('civil', 'military', 'retired', 'semi_government', 'private') then
    raise exception 'INVALID_WORK_CATEGORY';
  end if;

  if p_salary is null or p_salary <= 0 then
    raise exception 'INVALID_SALARY';
  end if;

  if p_term_months is null or p_term_months <= 0 then
    raise exception 'INVALID_TERM_MONTHS';
  end if;

  select *
  into v_provider
  from public.ehtisab_finance_providers
  where id = p_provider_id
    and is_active = true
    and is_deleted = false;

  if v_provider.id is null then
    raise exception 'PROVIDER_NOT_FOUND';
  end if;

  perform public.ehtisab_validate_provider_finance_type(
    p_provider_id,
    trim(coalesce(p_finance_type, ''))
  );

  select count(*)
  into v_match_count
  from public.ehtisab_margin_rules rule
  where rule.provider_id = p_provider_id
    and rule.finance_type = trim(coalesce(p_finance_type, ''))
    and rule.work_category = trim(coalesce(p_work_category, ''))
    and rule.is_active = true
    and rule.is_deleted = false
    and p_salary between rule.salary_from and rule.salary_to
    and (
      rule.term_months_from is null
      or (
        p_term_months >= rule.term_months_from
        and p_term_months <= rule.term_months_to
      )
    );

  if v_match_count > 1 then
    raise exception 'MARGIN_RULE_MATCH_CONFLICT';
  end if;

  if v_match_count = 1 then
    select *
    into v_rule
    from public.ehtisab_margin_rules rule
    where rule.provider_id = p_provider_id
      and rule.finance_type = trim(coalesce(p_finance_type, ''))
      and rule.work_category = trim(coalesce(p_work_category, ''))
      and rule.is_active = true
      and rule.is_deleted = false
      and p_salary between rule.salary_from and rule.salary_to
      and (
        rule.term_months_from is null
        or (
          p_term_months >= rule.term_months_from
          and p_term_months <= rule.term_months_to
        )
      )
    limit 1;

    return query select v_rule.margin_rate, 'rule'::text, v_rule.id;
    return;
  end if;

  return query select v_provider.default_margin_rate, 'default'::text, null::uuid;
end;
$$;

alter table public.ehtisab_finance_providers enable row level security;
alter table public.ehtisab_provider_finance_types enable row level security;
alter table public.ehtisab_margin_rules enable row level security;

revoke all on table public.ehtisab_finance_providers from public, anon, authenticated;
revoke all on table public.ehtisab_provider_finance_types from public, anon, authenticated;
revoke all on table public.ehtisab_margin_rules from public, anon, authenticated;

grant all on table public.ehtisab_finance_providers to service_role;
grant all on table public.ehtisab_provider_finance_types to service_role;
grant all on table public.ehtisab_margin_rules to service_role;

revoke all on function public.create_ehtisab_finance_provider_atomic(text, integer, numeric, text[], uuid, text) from public, anon, authenticated;
revoke all on function public.update_ehtisab_finance_provider_atomic(uuid, text, integer, numeric, text[], uuid, text) from public, anon, authenticated;
revoke all on function public.set_ehtisab_finance_provider_active_atomic(uuid, boolean, uuid, text) from public, anon, authenticated;
revoke all on function public.soft_delete_ehtisab_finance_provider_atomic(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.create_ehtisab_margin_rule_atomic(uuid, text, text, numeric, numeric, integer, integer, numeric, uuid, text) from public, anon, authenticated;
revoke all on function public.update_ehtisab_margin_rule_atomic(uuid, uuid, text, text, numeric, numeric, integer, integer, numeric, boolean, uuid, text) from public, anon, authenticated;
revoke all on function public.soft_delete_ehtisab_margin_rule_atomic(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.match_ehtisab_margin(text, uuid, text, numeric, integer) from public, anon, authenticated;

grant execute on function public.create_ehtisab_finance_provider_atomic(text, integer, numeric, text[], uuid, text) to service_role;
grant execute on function public.update_ehtisab_finance_provider_atomic(uuid, text, integer, numeric, text[], uuid, text) to service_role;
grant execute on function public.set_ehtisab_finance_provider_active_atomic(uuid, boolean, uuid, text) to service_role;
grant execute on function public.soft_delete_ehtisab_finance_provider_atomic(uuid, uuid, text) to service_role;
grant execute on function public.create_ehtisab_margin_rule_atomic(uuid, text, text, numeric, numeric, integer, integer, numeric, uuid, text) to service_role;
grant execute on function public.update_ehtisab_margin_rule_atomic(uuid, uuid, text, text, numeric, numeric, integer, integer, numeric, boolean, uuid, text) to service_role;
grant execute on function public.soft_delete_ehtisab_margin_rule_atomic(uuid, uuid, text) to service_role;
grant execute on function public.match_ehtisab_margin(text, uuid, text, numeric, integer) to service_role;

commit;
