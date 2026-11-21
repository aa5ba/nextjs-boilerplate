begin;

alter table public.finance_work_task_opportunities
  add column commission_type text not null default 'unset',
  add column commission_value numeric(14,4),
  add constraint finance_work_task_opportunities_commission_chk check (
    (commission_type = 'unset' and commission_value is null)
    or (commission_type = 'none' and commission_value is null)
    or (commission_type = 'fixed' and commission_value is not null and commission_value >= 0)
    or (
      commission_type = 'percentage'
      and commission_value is not null
      and commission_value >= 0
      and commission_value <= 100
    )
  );

create table public.finance_work_task_worksheets (
  task_id uuid primary key references public.finance_work_tasks(id) on update restrict on delete restrict,
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  selected_opportunity_id uuid references public.finance_work_task_opportunities(id) on update restrict on delete restrict,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  created_by_name text not null,
  updated_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_work_task_worksheets_branch_idx
  on public.finance_work_task_worksheets (branch_id, task_id);

create table public.finance_work_task_opportunity_commitments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  task_id uuid not null references public.finance_work_tasks(id) on update restrict on delete restrict,
  opportunity_id uuid not null references public.finance_work_task_opportunities(id) on update restrict on delete restrict,
  commitment_id uuid not null references public.finance_work_task_commitments(id) on update restrict on delete restrict,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  constraint finance_work_task_opportunity_commitments_key unique (opportunity_id, commitment_id)
);

create index finance_work_task_opportunity_commitments_task_idx
  on public.finance_work_task_opportunity_commitments (branch_id, task_id, opportunity_id);

create table public.finance_work_task_opportunity_costs (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  task_id uuid not null references public.finance_work_tasks(id) on update restrict on delete restrict,
  opportunity_id uuid not null references public.finance_work_task_opportunities(id) on update restrict on delete restrict,
  cost_name text not null,
  amount numeric(14,2),
  is_archived boolean not null default false,
  archived_at timestamptz,
  creation_request_id uuid not null,
  request_fingerprint text not null,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  created_by_name text not null,
  updated_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_work_task_opportunity_costs_name_chk check (char_length(btrim(cost_name)) between 2 and 160),
  constraint finance_work_task_opportunity_costs_amount_chk check (amount is null or amount >= 0),
  constraint finance_work_task_opportunity_costs_archive_chk check (
    (is_archived = false and archived_at is null)
    or (is_archived = true and archived_at is not null)
  ),
  constraint finance_work_task_opportunity_costs_request_key unique (branch_id, creation_request_id)
);

create index finance_work_task_opportunity_costs_task_idx
  on public.finance_work_task_opportunity_costs (branch_id, task_id, opportunity_id, is_archived, created_at, id);

create table public.finance_work_task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  task_id uuid not null references public.finance_work_tasks(id) on update restrict on delete restrict,
  item_name text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by_user_id uuid references public.finance_branch_users(id) on update restrict on delete restrict,
  completed_by_name text,
  creation_request_id uuid not null,
  request_fingerprint text not null,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  created_by_name text not null,
  updated_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_work_task_checklist_items_name_chk check (char_length(btrim(item_name)) between 2 and 240),
  constraint finance_work_task_checklist_items_completed_chk check (
    (is_completed = false and completed_at is null and completed_by_user_id is null and completed_by_name is null)
    or (
      is_completed = true
      and completed_at is not null
      and completed_by_user_id is not null
      and btrim(coalesce(completed_by_name, '')) <> ''
    )
  ),
  constraint finance_work_task_checklist_items_request_key unique (branch_id, creation_request_id)
);

create index finance_work_task_checklist_items_task_idx
  on public.finance_work_task_checklist_items (branch_id, task_id, is_completed, created_at, id);

create table public.finance_work_task_settlement_sources (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  task_id uuid not null references public.finance_work_tasks(id) on update restrict on delete restrict,
  opportunity_id uuid not null references public.finance_work_task_opportunities(id) on update restrict on delete restrict,
  commitment_id uuid references public.finance_work_task_commitments(id) on update restrict on delete restrict,
  provider_type text not null,
  provider_name text,
  planned_amount numeric(14,2),
  paid_amount numeric(14,2),
  notes text,
  creation_request_id uuid not null,
  request_fingerprint text not null,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  created_by_name text not null,
  updated_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_work_task_settlement_sources_provider_type_chk check (
    provider_type = any (array['office', 'customer', 'other']::text[])
  ),
  constraint finance_work_task_settlement_sources_provider_name_chk check (
    (provider_type <> 'other' and provider_name is null)
    or (provider_type = 'other' and char_length(btrim(coalesce(provider_name, ''))) between 2 and 160)
  ),
  constraint finance_work_task_settlement_sources_amounts_chk check (
    (planned_amount is null or planned_amount >= 0)
    and (paid_amount is null or paid_amount >= 0)
    and (planned_amount is null or paid_amount is null or paid_amount <= planned_amount)
  ),
  constraint finance_work_task_settlement_sources_request_key unique (branch_id, creation_request_id)
);

create index finance_work_task_settlement_sources_task_idx
  on public.finance_work_task_settlement_sources (branch_id, task_id, opportunity_id, created_at, id);

create function public.finance_work_task_worksheet_validate_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_branch_id uuid := nullif(v_row->>'branch_id', '')::uuid;
  v_task_id uuid := nullif(v_row->>'task_id', '')::uuid;
  v_opportunity_id uuid := nullif(v_row->>'opportunity_id', '')::uuid;
  v_selected_opportunity_id uuid := nullif(v_row->>'selected_opportunity_id', '')::uuid;
  v_commitment_id uuid := nullif(v_row->>'commitment_id', '')::uuid;
  v_created_by_user_id uuid := nullif(v_row->>'created_by_user_id', '')::uuid;
  v_updated_by_user_id uuid := nullif(v_row->>'updated_by_user_id', '')::uuid;
begin
  if not exists (
    select 1 from public.finance_work_tasks as t
    where t.id = v_task_id and t.branch_id = v_branch_id
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_WORKSHEET_TASK_SCOPE_MISMATCH';
  end if;

  if tg_op = 'INSERT' and not exists (
    select 1 from public.finance_branch_users as u
    where u.id = v_created_by_user_id
      and u.branch_id = v_branch_id
      and u.is_active = true
      and coalesce(u.self_disabled, false) = false
      and u.disabled_at is null
  ) then
    raise exception using errcode = '42501', message = 'WORK_TASK_ACTOR_INVALID';
  end if;

  if v_updated_by_user_id is not null and not exists (
    select 1 from public.finance_branch_users as u
    where u.id = v_updated_by_user_id
      and u.branch_id = v_branch_id
      and u.is_active = true
      and coalesce(u.self_disabled, false) = false
      and u.disabled_at is null
  ) then
    raise exception using errcode = '42501', message = 'WORK_TASK_UPDATER_INVALID';
  end if;

  if v_opportunity_id is not null and not exists (
    select 1 from public.finance_work_task_opportunities as o
    where o.id = v_opportunity_id and o.task_id = v_task_id and o.branch_id = v_branch_id
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_OPPORTUNITY_SCOPE_MISMATCH';
  end if;

  if v_selected_opportunity_id is not null and not exists (
    select 1 from public.finance_work_task_opportunities as o
    where o.id = v_selected_opportunity_id and o.task_id = v_task_id and o.branch_id = v_branch_id
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_OPPORTUNITY_SCOPE_MISMATCH';
  end if;

  if v_commitment_id is not null and not exists (
    select 1 from public.finance_work_task_commitments as c
    where c.id = v_commitment_id and c.task_id = v_task_id and c.branch_id = v_branch_id
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_COMMITMENT_SCOPE_MISMATCH';
  end if;

  return new;
end;
$$;

create trigger finance_work_task_worksheets_validate_scope
before insert or update on public.finance_work_task_worksheets
for each row execute function public.finance_work_task_worksheet_validate_scope();

create trigger finance_work_task_worksheets_touch_updated_at
before update on public.finance_work_task_worksheets
for each row execute function public.finance_work_tasks_touch_updated_at();

create trigger finance_work_task_opportunity_commitments_validate_scope
before insert on public.finance_work_task_opportunity_commitments
for each row execute function public.finance_work_task_worksheet_validate_scope();

create trigger finance_work_task_opportunity_costs_validate_scope
before insert or update on public.finance_work_task_opportunity_costs
for each row execute function public.finance_work_task_worksheet_validate_scope();

create trigger finance_work_task_opportunity_costs_touch_updated_at
before update on public.finance_work_task_opportunity_costs
for each row execute function public.finance_work_tasks_touch_updated_at();

create trigger finance_work_task_checklist_items_validate_scope
before insert or update on public.finance_work_task_checklist_items
for each row execute function public.finance_work_task_worksheet_validate_scope();

create trigger finance_work_task_checklist_items_touch_updated_at
before update on public.finance_work_task_checklist_items
for each row execute function public.finance_work_tasks_touch_updated_at();

create trigger finance_work_task_settlement_sources_validate_scope
before insert or update on public.finance_work_task_settlement_sources
for each row execute function public.finance_work_task_worksheet_validate_scope();

create trigger finance_work_task_settlement_sources_touch_updated_at
before update on public.finance_work_task_settlement_sources
for each row execute function public.finance_work_tasks_touch_updated_at();

create or replace function public.save_finance_work_task_opportunity_plan_atomic(
  p_branch_id uuid,
  p_task_id uuid,
  p_opportunity_id uuid,
  p_actor_user_id uuid,
  p_actor_name text,
  p_commission_type text,
  p_commission_value numeric,
  p_commitment_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_commitment_ids uuid[] := coalesce(p_commitment_ids, array[]::uuid[]);
  v_requested_count integer;
  v_valid_count integer;
begin
  if p_branch_id is null or p_task_id is null or p_opportunity_id is null or p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'WORK_TASK_REQUIRED_FIELDS';
  end if;

  if not exists (
    select 1 from public.finance_branch_users as u
    where u.id = p_actor_user_id
      and u.branch_id = p_branch_id
      and u.is_active = true
      and coalesce(u.self_disabled, false) = false
      and u.disabled_at is null
  ) then
    raise exception using errcode = '42501', message = 'WORK_TASK_ACTOR_INVALID';
  end if;

  perform 1
  from public.finance_work_task_opportunities as o
  where o.id = p_opportunity_id and o.task_id = p_task_id and o.branch_id = p_branch_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'WORK_TASK_OPPORTUNITY_NOT_FOUND';
  end if;

  if not (
    (p_commission_type = 'unset' and p_commission_value is null)
    or (p_commission_type = 'none' and p_commission_value is null)
    or (p_commission_type = 'fixed' and p_commission_value is not null and p_commission_value >= 0)
    or (
      p_commission_type = 'percentage'
      and p_commission_value is not null
      and p_commission_value >= 0
      and p_commission_value <= 100
    )
  ) then
    raise exception using errcode = '22023', message = 'WORK_TASK_INVALID_COMMISSION';
  end if;

  if array_position(v_commitment_ids, null) is not null then
    raise exception using errcode = '22023', message = 'WORK_TASK_INVALID_COMMITMENT_SELECTION';
  end if;

  select count(*) into v_requested_count
  from (
    select distinct selected_id
    from unnest(v_commitment_ids) as selected_id
  ) as requested;

  if v_requested_count <> cardinality(v_commitment_ids) then
    raise exception using errcode = '22023', message = 'WORK_TASK_INVALID_COMMITMENT_SELECTION';
  end if;

  select count(*) into v_valid_count
  from public.finance_work_task_commitments as c
  where c.id = any(v_commitment_ids)
    and c.task_id = p_task_id
    and c.branch_id = p_branch_id;

  if v_valid_count <> v_requested_count then
    raise exception using errcode = '23514', message = 'WORK_TASK_COMMITMENT_SCOPE_MISMATCH';
  end if;

  update public.finance_work_task_opportunities
  set commission_type = p_commission_type,
      commission_value = p_commission_value,
      updated_by_user_id = p_actor_user_id,
      updated_by_name = btrim(p_actor_name)
  where id = p_opportunity_id and task_id = p_task_id and branch_id = p_branch_id;

  delete from public.finance_work_task_opportunity_commitments
  where opportunity_id = p_opportunity_id and task_id = p_task_id and branch_id = p_branch_id;

  insert into public.finance_work_task_opportunity_commitments (
    branch_id, task_id, opportunity_id, commitment_id, created_by_user_id, created_by_name
  )
  select
    p_branch_id, p_task_id, p_opportunity_id, selected_id, p_actor_user_id, btrim(p_actor_name)
  from unnest(v_commitment_ids) as selected_id;

  return jsonb_build_object(
    'opportunity_id', p_opportunity_id,
    'selected_commitments', v_requested_count,
    'commission_type', p_commission_type
  );
end;
$$;

create or replace function public.set_finance_work_task_selected_opportunity_atomic(
  p_branch_id uuid,
  p_task_id uuid,
  p_opportunity_id uuid,
  p_actor_user_id uuid,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if p_branch_id is null or p_task_id is null or p_actor_user_id is null then
    raise exception using errcode = '22023', message = 'WORK_TASK_REQUIRED_FIELDS';
  end if;

  if not exists (
    select 1 from public.finance_branch_users as u
    where u.id = p_actor_user_id
      and u.branch_id = p_branch_id
      and u.is_active = true
      and coalesce(u.self_disabled, false) = false
      and u.disabled_at is null
  ) then
    raise exception using errcode = '42501', message = 'WORK_TASK_ACTOR_INVALID';
  end if;

  perform 1
  from public.finance_work_tasks as t
  where t.id = p_task_id and t.branch_id = p_branch_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'WORK_TASK_NOT_FOUND';
  end if;

  if p_opportunity_id is not null and not exists (
    select 1 from public.finance_work_task_opportunities as o
    where o.id = p_opportunity_id and o.task_id = p_task_id and o.branch_id = p_branch_id
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_OPPORTUNITY_SCOPE_MISMATCH';
  end if;

  insert into public.finance_work_task_worksheets (
    task_id, branch_id, selected_opportunity_id,
    created_by_user_id, created_by_name, updated_by_user_id, updated_by_name
  ) values (
    p_task_id, p_branch_id, p_opportunity_id,
    p_actor_user_id, btrim(p_actor_name), p_actor_user_id, btrim(p_actor_name)
  )
  on conflict (task_id) do update
  set selected_opportunity_id = excluded.selected_opportunity_id,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_by_name = excluded.updated_by_name;

  return jsonb_build_object('task_id', p_task_id, 'selected_opportunity_id', p_opportunity_id);
end;
$$;

alter table public.finance_work_task_worksheets enable row level security;
alter table public.finance_work_task_opportunity_commitments enable row level security;
alter table public.finance_work_task_opportunity_costs enable row level security;
alter table public.finance_work_task_checklist_items enable row level security;
alter table public.finance_work_task_settlement_sources enable row level security;

revoke all on table public.finance_work_task_worksheets from public, anon, authenticated;
revoke all on table public.finance_work_task_opportunity_commitments from public, anon, authenticated;
revoke all on table public.finance_work_task_opportunity_costs from public, anon, authenticated;
revoke all on table public.finance_work_task_checklist_items from public, anon, authenticated;
revoke all on table public.finance_work_task_settlement_sources from public, anon, authenticated;

grant select, insert, update on table public.finance_work_task_worksheets to service_role;
grant select on table public.finance_work_task_opportunity_commitments to service_role;
grant select, insert, update on table public.finance_work_task_opportunity_costs to service_role;
grant select, insert, update on table public.finance_work_task_checklist_items to service_role;
grant select, insert, update on table public.finance_work_task_settlement_sources to service_role;

revoke all on function public.finance_work_task_worksheet_validate_scope() from public, anon, authenticated;
revoke all on function public.save_finance_work_task_opportunity_plan_atomic(uuid, uuid, uuid, uuid, text, text, numeric, uuid[]) from public, anon, authenticated;
revoke all on function public.set_finance_work_task_selected_opportunity_atomic(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.save_finance_work_task_opportunity_plan_atomic(uuid, uuid, uuid, uuid, text, text, numeric, uuid[]) to service_role;
grant execute on function public.set_finance_work_task_selected_opportunity_atomic(uuid, uuid, uuid, uuid, text) to service_role;

commit;
