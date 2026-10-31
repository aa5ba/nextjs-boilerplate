begin;

create or replace function public.reset_admin_support_user_password_atomic(
  p_target_user_id uuid,
  p_new_password text,
  p_actor_user_id uuid,
  p_actor_user_name text
)
returns table(
  user_id uuid,
  new_session_version integer
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_target public.admin_support_users%rowtype;

  v_new_password text :=
    coalesce(p_new_password, '');

  v_actor_name text :=
    nullif(
      trim(coalesce(p_actor_user_name, '')),
      ''
    );

  v_new_session_version integer;
begin
  if p_target_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'TARGET_USER_ID_REQUIRED';
  end if;

  if p_actor_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'ACTOR_USER_ID_REQUIRED';
  end if;

  if v_actor_name is null then
    raise exception using
      errcode = 'P0001',
      message = 'ACTOR_USER_NAME_REQUIRED';
  end if;

  if length(v_new_password) < 4
     or length(v_new_password) > 100
  then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_PASSWORD_LENGTH';
  end if;

  select aus.*
  into v_target
  from public.admin_support_users as aus
  where aus.id = p_target_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'SUPPORT_USER_NOT_FOUND';
  end if;

  update public.admin_support_users as aus
  set
    password_hash = extensions.crypt(
      v_new_password,
      extensions.gen_salt('bf')
    ),
    session_version =
      coalesce(aus.session_version, 0) + 1,
    updated_at = now()
  where aus.id = p_target_user_id
  returning aus.session_version
  into v_new_session_version;

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
    'إعادة تعيين كلمة مرور مستخدم دعم',
    'support_user',
    p_target_user_id::text,
    coalesce(v_target.full_name, 'مستخدم دعم')
      || ' - '
      || v_target.username
      || ' - الدور: '
      || v_target.role
      || ' - تم إنهاء الجلسات السابقة'
  );

  return query
  select
    p_target_user_id,
    v_new_session_version;
end;
$function$;

revoke all on function public.reset_admin_support_user_password_atomic(
  uuid,
  text,
  uuid,
  text
) from public;

revoke all on function public.reset_admin_support_user_password_atomic(
  uuid,
  text,
  uuid,
  text
) from anon;

revoke all on function public.reset_admin_support_user_password_atomic(
  uuid,
  text,
  uuid,
  text
) from authenticated;

grant execute on function public.reset_admin_support_user_password_atomic(
  uuid,
  text,
  uuid,
  text
) to service_role;

commit;
