begin;

create table public.finance_work_task_groups (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  group_name text not null,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by_user_id uuid references public.finance_branch_users(id) on update restrict on delete restrict,
  archived_by_name text,
  creation_request_id uuid not null,
  request_fingerprint text not null,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  created_by_name text not null,
  updated_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_work_task_groups_name_chk check (char_length(btrim(group_name)) between 2 and 100),
  constraint finance_work_task_groups_archive_chk check (
    (is_archived = false and archived_at is null and archived_by_user_id is null and archived_by_name is null)
    or
    (is_archived = true and archived_at is not null and archived_by_user_id is not null and btrim(coalesce(archived_by_name, '')) <> '')
  ),
  constraint finance_work_task_groups_request_key unique (branch_id, creation_request_id)
);

create unique index finance_work_task_groups_active_name_key
  on public.finance_work_task_groups (branch_id, lower(btrim(group_name)))
  where is_archived = false;

create index finance_work_task_groups_branch_updated_idx
  on public.finance_work_task_groups (branch_id, is_archived, updated_at desc, id desc);

create table public.finance_work_tasks (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  group_id uuid not null references public.finance_work_task_groups(id) on update restrict on delete restrict,
  customer_id uuid not null references public.finance_customers(id) on update restrict on delete restrict,
  task_name text not null,
  status text not null default 'new',
  assigned_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  general_notes text,
  approved_salary numeric(14,2),
  additional_income numeric(14,2),
  employer_name text,
  last_action text,
  next_step text,
  next_follow_up_at timestamptz,
  completion_note text,
  creation_request_id uuid not null,
  request_fingerprint text not null,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  created_by_name text not null,
  updated_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_work_tasks_name_chk check (char_length(btrim(task_name)) between 2 and 160),
  constraint finance_work_tasks_status_chk check (
    status = any (array['new', 'under_review', 'waiting_customer', 'waiting_financier', 'completed', 'stopped']::text[])
  ),
  constraint finance_work_tasks_salary_chk check (approved_salary is null or approved_salary >= 0),
  constraint finance_work_tasks_income_chk check (additional_income is null or additional_income >= 0),
  constraint finance_work_tasks_request_key unique (branch_id, creation_request_id)
);

create index finance_work_tasks_group_page_idx
  on public.finance_work_tasks (branch_id, group_id, status, updated_at desc, id desc);

create index finance_work_tasks_customer_idx
  on public.finance_work_tasks (branch_id, customer_id, updated_at desc, id desc);

create index finance_work_tasks_follow_up_idx
  on public.finance_work_tasks (branch_id, status, next_follow_up_at, id);

create index finance_work_tasks_assignee_idx
  on public.finance_work_tasks (branch_id, assigned_user_id, status, updated_at desc);

create table public.finance_work_task_commitments (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  task_id uuid not null references public.finance_work_tasks(id) on update restrict on delete restrict,
  entity_type text not null,
  entity_name text not null,
  commitment_type text not null,
  remaining_amount numeric(14,2),
  monthly_installment numeric(14,2),
  default_amount numeric(14,2),
  settlement_amount numeric(14,2),
  status text not null default 'pending_verification',
  notes text,
  creation_request_id uuid not null,
  request_fingerprint text not null,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  created_by_name text not null,
  updated_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_work_task_commitments_entity_type_chk check (
    entity_type = any (array['bank', 'finance_company', 'telecom', 'government', 'person', 'other']::text[])
  ),
  constraint finance_work_task_commitments_entity_name_chk check (char_length(btrim(entity_name)) between 2 and 160),
  constraint finance_work_task_commitments_type_chk check (char_length(btrim(commitment_type)) between 2 and 160),
  constraint finance_work_task_commitments_amounts_chk check (
    (remaining_amount is null or remaining_amount >= 0)
    and (monthly_installment is null or monthly_installment >= 0)
    and (default_amount is null or default_amount >= 0)
    and (settlement_amount is null or settlement_amount >= 0)
  ),
  constraint finance_work_task_commitments_status_chk check (
    status = any (array['regular', 'defaulted', 'pending_verification', 'paid']::text[])
  ),
  constraint finance_work_task_commitments_request_key unique (branch_id, creation_request_id)
);

create index finance_work_task_commitments_task_idx
  on public.finance_work_task_commitments (branch_id, task_id, created_at, id);

create table public.finance_work_task_opportunities (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  task_id uuid not null references public.finance_work_tasks(id) on update restrict on delete restrict,
  provider_name text not null,
  expected_amount numeric(14,2),
  status text not null default 'preliminary',
  notes text,
  creation_request_id uuid not null,
  request_fingerprint text not null,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  created_by_name text not null,
  updated_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  updated_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_work_task_opportunities_provider_chk check (char_length(btrim(provider_name)) between 2 and 160),
  constraint finance_work_task_opportunities_amount_chk check (expected_amount is null or expected_amount >= 0),
  constraint finance_work_task_opportunities_status_chk check (
    status = any (array['preliminary', 'pending_response', 'approved', 'rejected']::text[])
  ),
  constraint finance_work_task_opportunities_request_key unique (branch_id, creation_request_id)
);

create index finance_work_task_opportunities_task_idx
  on public.finance_work_task_opportunities (branch_id, task_id, created_at, id);

create table public.finance_work_task_followups (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.finance_branches(id) on update restrict on delete restrict,
  task_id uuid not null references public.finance_work_tasks(id) on update restrict on delete restrict,
  action_text text not null,
  next_step text,
  next_follow_up_at timestamptz,
  request_id uuid not null,
  request_fingerprint text not null,
  created_by_user_id uuid not null references public.finance_branch_users(id) on update restrict on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  constraint finance_work_task_followups_action_chk check (char_length(btrim(action_text)) between 2 and 2000),
  constraint finance_work_task_followups_request_key unique (branch_id, request_id)
);

create index finance_work_task_followups_task_idx
  on public.finance_work_task_followups (branch_id, task_id, created_at desc, id desc);

create function public.finance_work_tasks_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.finance_work_tasks_validate_group_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.finance_branch_users as u
    where u.id = new.created_by_user_id
      and u.branch_id = new.branch_id
      and u.is_active = true
      and coalesce(u.self_disabled, false) = false
      and u.disabled_at is null
  ) then
    raise exception using errcode = '42501', message = 'WORK_TASK_ACTOR_INVALID';
  end if;

  if not exists (
    select 1
    from public.finance_branch_users as u
    where u.id = new.updated_by_user_id
      and u.branch_id = new.branch_id
      and u.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'WORK_TASK_UPDATER_INVALID';
  end if;

  return new;
end;
$$;

create function public.finance_work_tasks_validate_task_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if not exists (
    select 1 from public.finance_work_task_groups as g
    where g.id = new.group_id and g.branch_id = new.branch_id and g.is_archived = false
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_GROUP_SCOPE_MISMATCH';
  end if;

  if not exists (
    select 1 from public.finance_customers as c
    where c.id = new.customer_id and c.branch_id = new.branch_id and c.is_archived = false
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_CUSTOMER_SCOPE_MISMATCH';
  end if;

  if not exists (
    select 1 from public.finance_branch_users as u
    where u.id = new.assigned_user_id and u.branch_id = new.branch_id and u.is_active = true
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_ASSIGNEE_SCOPE_MISMATCH';
  end if;

  if not exists (
    select 1 from public.finance_branch_users as u
    where u.id = new.created_by_user_id and u.branch_id = new.branch_id and u.is_active = true
  ) or not exists (
    select 1 from public.finance_branch_users as u
    where u.id = new.updated_by_user_id and u.branch_id = new.branch_id and u.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'WORK_TASK_ACTOR_INVALID';
  end if;

  return new;
end;
$$;

create function public.finance_work_tasks_validate_child_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if not exists (
    select 1 from public.finance_work_tasks as t
    where t.id = new.task_id and t.branch_id = new.branch_id
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_CHILD_SCOPE_MISMATCH';
  end if;

  if not exists (
    select 1 from public.finance_branch_users as u
    where u.id = new.created_by_user_id and u.branch_id = new.branch_id and u.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'WORK_TASK_ACTOR_INVALID';
  end if;

  if tg_table_name <> 'finance_work_task_followups' and not exists (
    select 1 from public.finance_branch_users as u
    where u.id = new.updated_by_user_id and u.branch_id = new.branch_id and u.is_active = true
  ) then
    raise exception using errcode = '42501', message = 'WORK_TASK_UPDATER_INVALID';
  end if;

  return new;
end;
$$;

create trigger finance_work_task_groups_validate_scope
before insert or update on public.finance_work_task_groups
for each row execute function public.finance_work_tasks_validate_group_scope();

create trigger finance_work_task_groups_touch_updated_at
before update on public.finance_work_task_groups
for each row execute function public.finance_work_tasks_touch_updated_at();

create trigger finance_work_tasks_validate_scope
before insert or update on public.finance_work_tasks
for each row execute function public.finance_work_tasks_validate_task_scope();

create trigger finance_work_tasks_touch_updated_at
before update on public.finance_work_tasks
for each row execute function public.finance_work_tasks_touch_updated_at();

create trigger finance_work_task_commitments_validate_scope
before insert or update on public.finance_work_task_commitments
for each row execute function public.finance_work_tasks_validate_child_scope();

create trigger finance_work_task_commitments_touch_updated_at
before update on public.finance_work_task_commitments
for each row execute function public.finance_work_tasks_touch_updated_at();

create trigger finance_work_task_opportunities_validate_scope
before insert or update on public.finance_work_task_opportunities
for each row execute function public.finance_work_tasks_validate_child_scope();

create trigger finance_work_task_opportunities_touch_updated_at
before update on public.finance_work_task_opportunities
for each row execute function public.finance_work_tasks_touch_updated_at();

create trigger finance_work_task_followups_validate_scope
before insert on public.finance_work_task_followups
for each row execute function public.finance_work_tasks_validate_child_scope();

create or replace function public.add_finance_work_task_followup_atomic(
  p_branch_id uuid,
  p_task_id uuid,
  p_actor_user_id uuid,
  p_actor_name text,
  p_action_text text,
  p_next_step text,
  p_next_follow_up_at timestamptz,
  p_request_id uuid,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_task public.finance_work_tasks%rowtype;
  v_existing public.finance_work_task_followups%rowtype;
  v_followup public.finance_work_task_followups%rowtype;
begin
  if p_branch_id is null or p_task_id is null or p_actor_user_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'WORK_TASK_REQUIRED_FIELDS';
  end if;

  if char_length(btrim(coalesce(p_action_text, ''))) not between 2 and 2000 then
    raise exception using errcode = '22023', message = 'WORK_TASK_INVALID_FOLLOWUP';
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

  select * into v_existing
  from public.finance_work_task_followups as f
  where f.branch_id = p_branch_id and f.request_id = p_request_id;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '23505', message = 'WORK_TASK_REQUEST_REUSED';
    end if;

    return jsonb_build_object('followup_id', v_existing.id, 'task_id', v_existing.task_id, 'was_created', false);
  end if;

  select * into v_task
  from public.finance_work_tasks as t
  where t.id = p_task_id and t.branch_id = p_branch_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'WORK_TASK_NOT_FOUND';
  end if;

  insert into public.finance_work_task_followups (
    branch_id, task_id, action_text, next_step, next_follow_up_at,
    request_id, request_fingerprint, created_by_user_id, created_by_name
  ) values (
    p_branch_id, p_task_id, btrim(p_action_text), nullif(btrim(coalesce(p_next_step, '')), ''), p_next_follow_up_at,
    p_request_id, p_request_fingerprint, p_actor_user_id, btrim(p_actor_name)
  ) returning * into v_followup;

  update public.finance_work_tasks
  set last_action = btrim(p_action_text),
      next_step = nullif(btrim(coalesce(p_next_step, '')), ''),
      next_follow_up_at = p_next_follow_up_at,
      updated_by_user_id = p_actor_user_id,
      updated_by_name = btrim(p_actor_name)
  where id = p_task_id and branch_id = p_branch_id;

  return jsonb_build_object('followup_id', v_followup.id, 'task_id', p_task_id, 'was_created', true);
end;
$$;

create or replace function public.get_finance_work_task_alerts(
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_limit integer default 100
)
returns table (
  task_id uuid,
  group_id uuid,
  group_name text,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  task_name text,
  task_status text,
  assigned_user_id uuid,
  assigned_user_name text,
  next_follow_up_at timestamptz,
  alert_type text
)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
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

  return query
  select
    t.id,
    t.group_id,
    g.group_name,
    t.customer_id,
    c.full_name,
    c.phone,
    t.task_name,
    t.status,
    t.assigned_user_id,
    u.full_name,
    t.next_follow_up_at,
    case
      when t.next_follow_up_at is null then 'unscheduled'
      when timezone('Asia/Riyadh', t.next_follow_up_at)::date < timezone('Asia/Riyadh', now())::date then 'overdue'
      else 'today'
    end
  from public.finance_work_tasks as t
  join public.finance_work_task_groups as g on g.id = t.group_id and g.branch_id = t.branch_id
  join public.finance_customers as c on c.id = t.customer_id and c.branch_id = t.branch_id
  join public.finance_branch_users as u on u.id = t.assigned_user_id and u.branch_id = t.branch_id
  where t.branch_id = p_branch_id
    and g.is_archived = false
    and c.is_archived = false
    and t.status not in ('completed', 'stopped')
    and (
      t.next_follow_up_at is null
      or timezone('Asia/Riyadh', t.next_follow_up_at)::date <= timezone('Asia/Riyadh', now())::date
    )
  order by
    case
      when t.next_follow_up_at is not null
       and timezone('Asia/Riyadh', t.next_follow_up_at)::date < timezone('Asia/Riyadh', now())::date then 1
      when t.next_follow_up_at is not null then 2
      else 3
    end,
    t.next_follow_up_at asc nulls last,
    t.updated_at asc,
    t.id asc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

alter table public.finance_work_task_groups enable row level security;
alter table public.finance_work_tasks enable row level security;
alter table public.finance_work_task_commitments enable row level security;
alter table public.finance_work_task_opportunities enable row level security;
alter table public.finance_work_task_followups enable row level security;

revoke all on table public.finance_work_task_groups from public, anon, authenticated;
revoke all on table public.finance_work_tasks from public, anon, authenticated;
revoke all on table public.finance_work_task_commitments from public, anon, authenticated;
revoke all on table public.finance_work_task_opportunities from public, anon, authenticated;
revoke all on table public.finance_work_task_followups from public, anon, authenticated;

grant select, insert, update on table public.finance_work_task_groups to service_role;
grant select, insert, update on table public.finance_work_tasks to service_role;
grant select, insert, update on table public.finance_work_task_commitments to service_role;
grant select, insert, update on table public.finance_work_task_opportunities to service_role;
grant select, insert on table public.finance_work_task_followups to service_role;

revoke all on function public.add_finance_work_task_followup_atomic(uuid, uuid, uuid, text, text, text, timestamptz, uuid, text) from public, anon, authenticated;
grant execute on function public.add_finance_work_task_followup_atomic(uuid, uuid, uuid, text, text, text, timestamptz, uuid, text) to service_role;

revoke all on function public.get_finance_work_task_alerts(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.get_finance_work_task_alerts(uuid, uuid, integer) to service_role;

revoke all on function public.finance_work_tasks_touch_updated_at() from public, anon, authenticated;
revoke all on function public.finance_work_tasks_validate_group_scope() from public, anon, authenticated;
revoke all on function public.finance_work_tasks_validate_task_scope() from public, anon, authenticated;
revoke all on function public.finance_work_tasks_validate_child_scope() from public, anon, authenticated;

commit;
