begin;

create or replace function public.create_finance_work_task_with_customer_atomic(
  p_branch_id uuid,
  p_group_id uuid,
  p_customer_id uuid,
  p_create_customer boolean,
  p_customer_full_name text,
  p_customer_national_id text,
  p_customer_birth_hijri text,
  p_customer_phone text,
  p_assigned_user_id uuid,
  p_task_name text,
  p_request_id uuid,
  p_request_fingerprint text,
  p_actor_user_id uuid,
  p_actor_name text
)
returns table (
  task_id uuid,
  customer_id uuid,
  customer_was_created boolean,
  task_was_created boolean
)
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_existing_task public.finance_work_tasks%rowtype;
  v_customer public.finance_customers%rowtype;
  v_task public.finance_work_tasks%rowtype;
  v_customer_id uuid;
  v_full_name text;
  v_national_id text;
  v_phone text;
  v_birth_raw text;
  v_birth_parts text[];
  v_birth_year integer;
  v_birth_month integer;
  v_birth_day integer;
  v_birth_hijri text;
  v_actor_name text;
begin
  if p_branch_id is null
     or p_group_id is null
     or p_assigned_user_id is null
     or p_request_id is null
     or p_actor_user_id is null
     or char_length(btrim(coalesce(p_request_fingerprint, ''))) <> 64
  then
    raise exception using errcode = '22023', message = 'WORK_TASK_REQUIRED_FIELDS';
  end if;

  if char_length(btrim(coalesce(p_task_name, ''))) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'WORK_TASK_INVALID_TASK';
  end if;

  if not exists (
    select 1
    from public.finance_branch_users as u
    where u.id = p_actor_user_id
      and u.branch_id = p_branch_id
      and u.is_active = true
      and coalesce(u.self_disabled, false) = false
      and u.disabled_at is null
  ) then
    raise exception using errcode = '42501', message = 'WORK_TASK_ACTOR_INVALID';
  end if;

  if not exists (
    select 1
    from public.finance_work_task_groups as g
    where g.id = p_group_id
      and g.branch_id = p_branch_id
      and g.is_archived = false
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_GROUP_SCOPE_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.finance_branch_users as u
    where u.id = p_assigned_user_id
      and u.branch_id = p_branch_id
      and u.is_active = true
      and coalesce(u.self_disabled, false) = false
      and u.disabled_at is null
  ) then
    raise exception using errcode = '23514', message = 'WORK_TASK_ASSIGNEE_SCOPE_MISMATCH';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_branch_id::text || ':work-task-request:' || p_request_id::text, 0)
  );

  select t.*
  into v_existing_task
  from public.finance_work_tasks as t
  where t.branch_id = p_branch_id
    and t.creation_request_id = p_request_id
  for update;

  if found then
    if v_existing_task.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '23505', message = 'WORK_TASK_REQUEST_REUSED';
    end if;

    return query
    select
      v_existing_task.id,
      v_existing_task.customer_id,
      false,
      false;
    return;
  end if;

  if p_create_customer then
    if not public.finance_user_has_permission(
      p_branch_id,
      p_actor_user_id,
      'customers_create'
    ) then
      raise exception using errcode = '42501', message = 'CUSTOMERS_CREATE_PERMISSION_DENIED';
    end if;

    v_full_name := regexp_replace(
      btrim(coalesce(p_customer_full_name, '')),
      '[[:space:]]+',
      ' ',
      'g'
    );
    v_national_id := regexp_replace(
      translate(
        coalesce(p_customer_national_id, ''),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      ),
      '[^0-9]',
      '',
      'g'
    );
    v_phone := regexp_replace(
      translate(
        coalesce(p_customer_phone, ''),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      ),
      '[^0-9]',
      '',
      'g'
    );
    v_birth_raw := regexp_replace(
      translate(
        btrim(coalesce(p_customer_birth_hijri, '')),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹.-',
        '01234567890123456789//'
      ),
      '[[:space:]]+',
      '',
      'g'
    );
    v_birth_raw := regexp_replace(v_birth_raw, '/+', '/', 'g');

    if char_length(v_full_name) < 2 then
      raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_NAME';
    end if;
    if v_national_id !~ '^[0-9]{10}$' then
      raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_NATIONAL_ID';
    end if;
    if v_phone !~ '^05[0-9]{8}$' then
      raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_PHONE';
    end if;

    if v_birth_raw <> '' then
      v_birth_parts := string_to_array(v_birth_raw, '/');
      if array_length(v_birth_parts, 1) <> 3
         or v_birth_parts[1] !~ '^[0-9]+$'
         or v_birth_parts[2] !~ '^[0-9]+$'
         or v_birth_parts[3] !~ '^[0-9]+$'
      then
        raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_HIJRI_BIRTH_DATE';
      end if;

      begin
        if char_length(v_birth_parts[1]) = 4 then
          v_birth_year := v_birth_parts[1]::integer;
          v_birth_month := v_birth_parts[2]::integer;
          v_birth_day := v_birth_parts[3]::integer;
        elsif char_length(v_birth_parts[3]) = 4 then
          v_birth_day := v_birth_parts[1]::integer;
          v_birth_month := v_birth_parts[2]::integer;
          v_birth_year := v_birth_parts[3]::integer;
        else
          raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_HIJRI_BIRTH_DATE';
        end if;
      exception
        when invalid_text_representation or numeric_value_out_of_range then
          raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_HIJRI_BIRTH_DATE';
      end;

      if v_birth_year < 1300
         or v_birth_year > 1600
         or v_birth_month < 1
         or v_birth_month > 12
         or v_birth_day < 1
         or v_birth_day > 30
      then
        raise exception using errcode = '22023', message = 'INVALID_CUSTOMER_HIJRI_BIRTH_DATE';
      end if;

      v_birth_hijri :=
        lpad(v_birth_year::text, 4, '0') || '/'
        || lpad(v_birth_month::text, 2, '0') || '/'
        || lpad(v_birth_day::text, 2, '0');
    else
      v_birth_hijri := null;
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(p_branch_id::text || ':customer:' || v_national_id, 0)
    );

    select c.*
    into v_customer
    from public.finance_customers as c
    where c.branch_id = p_branch_id
      and c.national_id = v_national_id
    for update;

    if found then
      if v_customer.is_archived then
        raise exception using errcode = '23505', message = 'WORK_TASK_CUSTOMER_ARCHIVED';
      end if;
      raise exception using errcode = '23505', message = 'WORK_TASK_CUSTOMER_ALREADY_EXISTS';
    end if;

    insert into public.finance_customers (
      branch_id,
      full_name,
      national_id,
      birth_date_type,
      birth_hijri,
      birth_gregorian,
      phone,
      created_at,
      updated_at
    ) values (
      p_branch_id,
      v_full_name,
      v_national_id,
      case when v_birth_hijri is null then null else 'hijri' end,
      v_birth_hijri,
      null,
      v_phone,
      now(),
      now()
    )
    returning * into v_customer;

    v_customer_id := v_customer.id;
    v_actor_name := coalesce(
      nullif(btrim(p_actor_name), ''),
      (
        select coalesce(nullif(btrim(u.full_name), ''), nullif(btrim(u.username), ''))
        from public.finance_branch_users as u
        where u.id = p_actor_user_id and u.branch_id = p_branch_id
      ),
      'الموظف'
    );

    insert into public.finance_activity_logs (
      branch_id,
      activity_type,
      description,
      customer_id,
      customer_name,
      employee_name,
      status,
      new_values,
      changed_fields,
      created_at
    ) values (
      p_branch_id,
      'إنشاء عميل',
      'تم إنشاء عميل جديد من مهمة عمل باسم ' || v_full_name,
      v_customer_id,
      v_full_name,
      v_actor_name,
      'جديد',
      jsonb_build_object(
        'customer_id', v_customer_id,
        'full_name', v_full_name,
        'national_id', v_national_id,
        'birth_hijri', v_birth_hijri,
        'phone', v_phone,
        'source', 'work_task'
      ),
      array['إنشاء العميل من مهمة عمل']::text[],
      now()
    );
  else
    if p_customer_id is null then
      raise exception using errcode = '22023', message = 'WORK_TASK_CUSTOMER_REQUIRED';
    end if;

    select c.*
    into v_customer
    from public.finance_customers as c
    where c.id = p_customer_id
      and c.branch_id = p_branch_id
      and c.is_archived = false;

    if not found then
      raise exception using errcode = '23514', message = 'WORK_TASK_CUSTOMER_SCOPE_MISMATCH';
    end if;

    v_customer_id := v_customer.id;
  end if;

  insert into public.finance_work_tasks (
    branch_id,
    group_id,
    customer_id,
    task_name,
    assigned_user_id,
    creation_request_id,
    request_fingerprint,
    created_by_user_id,
    created_by_name,
    updated_by_user_id,
    updated_by_name
  ) values (
    p_branch_id,
    p_group_id,
    v_customer_id,
    btrim(p_task_name),
    p_assigned_user_id,
    p_request_id,
    p_request_fingerprint,
    p_actor_user_id,
    coalesce(nullif(btrim(p_actor_name), ''), 'الموظف'),
    p_actor_user_id,
    coalesce(nullif(btrim(p_actor_name), ''), 'الموظف')
  )
  returning * into v_task;

  return query
  select
    v_task.id,
    v_customer_id,
    p_create_customer,
    true;
end;
$$;

revoke all on function public.create_finance_work_task_with_customer_atomic(
  uuid, uuid, uuid, boolean, text, text, text, text,
  uuid, text, uuid, text, uuid, text
) from public, anon, authenticated;

grant execute on function public.create_finance_work_task_with_customer_atomic(
  uuid, uuid, uuid, boolean, text, text, text, text,
  uuid, text, uuid, text, uuid, text
) to service_role;

comment on function public.create_finance_work_task_with_customer_atomic(
  uuid, uuid, uuid, boolean, text, text, text, text,
  uuid, text, uuid, text, uuid, text
) is 'ينشئ مهمة عمل لعميل موجود أو ينشئ العميل والمهمة معًا ذريًا داخل الفرع، مع ميلاد اختياري في هذا المسار.';

commit;
