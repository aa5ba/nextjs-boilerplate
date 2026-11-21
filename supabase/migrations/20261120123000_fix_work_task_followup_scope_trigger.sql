begin;

create or replace function public.finance_work_tasks_validate_child_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_updated_by_user_id uuid;
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

  if tg_table_name <> 'finance_work_task_followups' then
    v_updated_by_user_id := nullif(to_jsonb(new)->>'updated_by_user_id', '')::uuid;

    if not exists (
      select 1 from public.finance_branch_users as u
      where u.id = v_updated_by_user_id and u.branch_id = new.branch_id and u.is_active = true
    ) then
      raise exception using errcode = '42501', message = 'WORK_TASK_UPDATER_INVALID';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.finance_work_tasks_validate_child_scope() from public, anon, authenticated;

commit;
