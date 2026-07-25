-- Migration: fix admin branch manager role check
-- Allows the existing admin branch manager RPC to recognize the actual Arabic branch manager roles.

CREATE OR REPLACE FUNCTION public.update_admin_branch_manager_atomic(p_manager_id uuid, p_action text, p_is_active boolean, p_new_password text, p_actor_user_id uuid, p_actor_user_name text) RETURNS TABLE(manager_id uuid, is_active boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $_$
declare
  v_manager public.finance_branch_users%rowtype;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_actor_name text :=
    nullif(trim(coalesce(p_actor_user_name, '')), '');
begin
  if p_manager_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'MANAGER_ID_REQUIRED';
  end if;

  select *
  into v_manager
  from public.finance_branch_users
  where id = p_manager_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MANAGER_NOT_FOUND';
  end if;

  if v_manager.role not in ('مدير فرع', 'مدير رئيسي') then
    raise exception using
      errcode = 'P0001',
      message = 'USER_IS_NOT_BRANCH_MANAGER';
  end if;

  if v_action = 'set_active' then
    if p_is_active is null then
      raise exception using
        errcode = 'P0001',
        message = 'ACTIVE_STATUS_REQUIRED';
    end if;

    update public.finance_branch_users
    set is_active = p_is_active
    where id = p_manager_id;

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
      v_actor_name,
      case
        when p_is_active
          then 'تفعيل مدير فرع'
        else 'تعطيل مدير فرع'
      end,
      'branch_manager',
      p_manager_id,
      v_manager.full_name
        || ' - '
        || v_manager.username
    );

    return query
    select
      p_manager_id,
      p_is_active;

    return;
  end if;

  if v_action = 'reset_password' then
    if trim(coalesce(p_new_password, '')) !~ '^[0-9]{4}$' then
      raise exception using
        errcode = 'P0001',
        message = 'PASSWORD_MUST_BE_4_DIGITS';
    end if;

    update public.finance_branch_users
    set
      password = trim(p_new_password),
      password_hash = extensions.crypt(
        trim(p_new_password),
        extensions.gen_salt('bf')
      )
    where id = p_manager_id;

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
      v_actor_name,
      'إعادة تعيين كلمة مرور مدير فرع',
      'branch_manager',
      p_manager_id,
      v_manager.full_name
        || ' - '
        || v_manager.username
    );

    return query
    select
      p_manager_id,
      v_manager.is_active;

    return;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'INVALID_MANAGER_ACTION';
end;
$_$;

REVOKE ALL ON FUNCTION public.update_admin_branch_manager_atomic(p_manager_id uuid, p_action text, p_is_active boolean, p_new_password text, p_actor_user_id uuid, p_actor_user_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_admin_branch_manager_atomic(p_manager_id uuid, p_action text, p_is_active boolean, p_new_password text, p_actor_user_id uuid, p_actor_user_name text) TO service_role;
