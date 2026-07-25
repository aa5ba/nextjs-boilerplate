-- Migration: reactivate archived customer when saving from customer creation flow.
-- Keeps the existing customer id and does not restore archived contracts or notes.

CREATE OR REPLACE FUNCTION public.create_finance_customer_secure_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_employee_name text,
  p_full_name text,
  p_national_id text,
  p_birth_hijri text,
  p_phone text,
  p_group_id uuid DEFAULT NULL::uuid,
  p_work_name text DEFAULT NULL::text,
  p_salary numeric DEFAULT NULL::numeric,
  p_bank text DEFAULT NULL::text,
  p_broker text DEFAULT NULL::text
) RETURNS TABLE(customer_id uuid, was_created boolean, customer_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
declare
  v_user public.finance_branch_users%rowtype;

  v_customer_id uuid;
  v_was_created boolean := false;

  v_employee_name text;
  v_full_name text;

  v_national_id text;
  v_phone text;

  v_birth_raw text;
  v_birth_parts text[];
  v_birth_year integer;
  v_birth_month integer;
  v_birth_day integer;
  v_birth_hijri text;

  v_work_name text;
  v_bank text;
  v_broker text;
  v_salary numeric(14, 2);
begin
  -- =====================================================
  -- الفرع والموظف والصلاحية
  -- =====================================================

  if p_branch_id is null then
    raise exception 'BRANCH_REQUIRED';
  end if;

  if p_employee_id is null then
    raise exception 'EMPLOYEE_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.finance_branches as fb
    where fb.id = p_branch_id
      and coalesce(fb.is_active, true) = true
      and coalesce(fb.is_deleted, false) = false
  ) then
    raise exception 'BRANCH_NOT_FOUND_OR_INACTIVE';
  end if;

  select fbu.*
  into v_user
  from public.finance_branch_users as fbu
  where fbu.id = p_employee_id
    and fbu.branch_id = p_branch_id
    and fbu.is_active = true
    and coalesce(fbu.self_disabled, false) = false
    and fbu.disabled_at is null
  limit 1;

  if not found then
    raise exception 'INVALID_EMPLOYEE_SESSION';
  end if;

  if not public.finance_user_has_permission(
    p_branch_id,
    p_employee_id,
    'customers_create'
  ) then
    raise exception 'CUSTOMERS_CREATE_PERMISSION_DENIED';
  end if;

  v_employee_name := coalesce(
    nullif(trim(v_user.full_name), ''),
    nullif(trim(v_user.username), ''),
    nullif(trim(coalesce(p_employee_name, '')), ''),
    'الموظف'
  );

  -- =====================================================
  -- تنظيف البيانات
  -- =====================================================

  v_full_name :=
    nullif(trim(coalesce(p_full_name, '')), '');

  v_national_id := regexp_replace(
    translate(
      coalesce(p_national_id, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  v_phone := regexp_replace(
    translate(
      coalesce(p_phone, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  v_birth_raw := translate(
    trim(coalesce(p_birth_hijri, '')),
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );

  v_birth_raw := replace(
    replace(
      replace(
        v_birth_raw,
        '-',
        '/'
      ),
      '.',
      '/'
    ),
    ' ',
    ''
  );

  v_birth_raw := regexp_replace(
    v_birth_raw,
    '/+',
    '/',
    'g'
  );

  v_work_name :=
    nullif(trim(coalesce(p_work_name, '')), '');

  v_bank :=
    nullif(trim(coalesce(p_bank, '')), '');

  v_broker :=
    nullif(trim(coalesce(p_broker, '')), '');

  if p_salary is null then
    v_salary := null;
  else
    v_salary := round(p_salary, 2);
  end if;

  -- =====================================================
  -- التحقق من البيانات الأساسية
  -- =====================================================

  if v_full_name is null then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if char_length(v_full_name) < 2 then
    raise exception 'INVALID_CUSTOMER_NAME';
  end if;

  if v_national_id !~ '^[0-9]{10}$' then
    raise exception 'INVALID_CUSTOMER_NATIONAL_ID';
  end if;

  if v_phone !~ '^05[0-9]{8}$' then
    raise exception 'INVALID_CUSTOMER_PHONE';
  end if;

  if v_salary is not null
     and v_salary <= 0
  then
    raise exception 'INVALID_CUSTOMER_SALARY';
  end if;

  -- =====================================================
  -- توحيد التاريخ الهجري إلى YYYY/MM/DD
  -- يدعم أيضًا البيانات القديمة DD/MM/YYYY
  -- =====================================================

  v_birth_parts :=
    string_to_array(v_birth_raw, '/');

  if array_length(v_birth_parts, 1) <> 3 then
    raise exception 'INVALID_CUSTOMER_HIJRI_BIRTH_DATE';
  end if;

  if v_birth_parts[1] !~ '^[0-9]+$'
     or v_birth_parts[2] !~ '^[0-9]+$'
     or v_birth_parts[3] !~ '^[0-9]+$'
  then
    raise exception 'INVALID_CUSTOMER_HIJRI_BIRTH_DATE';
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
      raise exception 'INVALID_CUSTOMER_HIJRI_BIRTH_DATE';
    end if;
  exception
    when invalid_text_representation
      or numeric_value_out_of_range
    then
      raise exception 'INVALID_CUSTOMER_HIJRI_BIRTH_DATE';
  end;

  if v_birth_year < 1300
     or v_birth_year > 1600
     or v_birth_month < 1
     or v_birth_month > 12
     or v_birth_day < 1
     or v_birth_day > 30
  then
    raise exception 'INVALID_CUSTOMER_HIJRI_BIRTH_DATE';
  end if;

  v_birth_hijri :=
    lpad(v_birth_year::text, 4, '0')
    || '/'
    || lpad(v_birth_month::text, 2, '0')
    || '/'
    || lpad(v_birth_day::text, 2, '0');

  -- =====================================================
  -- التحقق من المجموعة الاختيارية
  -- =====================================================

  if p_group_id is not null
     and not exists (
       select 1
       from public.finance_customer_groups as fcg
       where fcg.id = p_group_id
         and fcg.branch_id = p_branch_id
     )
  then
    raise exception 'CUSTOMER_GROUP_NOT_FOUND';
  end if;

  -- يمنع سباق إنشاء عميلين بالهوية نفسها
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text
      || ':customer:'
      || v_national_id,
      0
    )
  );

  -- =====================================================
  -- تحديث العميل الموجود أو إنشاء عميل جديد
  -- =====================================================

  select fc.id
  into v_customer_id
  from public.finance_customers as fc
  where fc.branch_id = p_branch_id
    and fc.national_id = v_national_id
  for update;

  if found then
    update public.finance_customers
    set
      group_id = p_group_id,
      full_name = v_full_name,
      birth_date_type = 'hijri',
      birth_hijri = v_birth_hijri,
      birth_gregorian = null,
      phone = v_phone,
      work = v_work_name,
      work_name = v_work_name,
      salary = v_salary,
      bank = v_bank,
      broker = v_broker,
      is_archived = false,
      archived_at = null,
      archived_by = null,
      updated_at = now()
    where id = v_customer_id
      and branch_id = p_branch_id;

    v_was_created := false;

  else
    insert into public.finance_customers (
      branch_id,
      group_id,
      full_name,
      national_id,

      birth_date_type,
      birth_hijri,
      birth_gregorian,

      phone,
      work,
      work_name,
      salary,
      bank,
      broker,

      created_at,
      updated_at
    )
    values (
      p_branch_id,
      p_group_id,
      v_full_name,
      v_national_id,

      'hijri',
      v_birth_hijri,
      null,

      v_phone,
      v_work_name,
      v_work_name,
      v_salary,
      v_bank,
      v_broker,

      now(),
      now()
    )
    returning id
    into v_customer_id;

    v_was_created := true;
  end if;

  -- =====================================================
  -- سجل النشاط
  -- =====================================================

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
  )
  values (
    p_branch_id,

    case
      when v_was_created
        then 'إنشاء عميل'
      else 'تحديث عميل'
    end,

    case
      when v_was_created then
        'تم إنشاء عميل جديد باسم ' || v_full_name
      else
        'تم تحديث بيانات العميل ' || v_full_name
    end,

    v_customer_id,
    v_full_name,
    v_employee_name,

    case
      when v_was_created
        then 'جديد'
      else 'محدث'
    end,

    jsonb_build_object(
      'customer_id', v_customer_id,
      'full_name', v_full_name,
      'national_id', v_national_id,
      'birth_hijri', v_birth_hijri,
      'phone', v_phone,
      'group_id', p_group_id,
      'work_name', v_work_name,
      'salary', v_salary,
      'bank', v_bank,
      'broker', v_broker
    ),

    array[
      case
        when v_was_created
          then 'إنشاء العميل'
        else 'تحديث بيانات العميل'
      end
    ]::text[],

    now()
  );

  return query
  select
    v_customer_id,
    v_was_created,
    v_full_name;
end;
$_$;

COMMENT ON FUNCTION public.create_finance_customer_secure_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_employee_name text,
  p_full_name text,
  p_national_id text,
  p_birth_hijri text,
  p_phone text,
  p_group_id uuid,
  p_work_name text,
  p_salary numeric,
  p_bank text,
  p_broker text
) IS 'إنشاء أو تحديث عميل داخل الفرع بصورة ذرية وآمنة حسب رقم الهوية.';

REVOKE ALL ON FUNCTION public.create_finance_customer_secure_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_employee_name text,
  p_full_name text,
  p_national_id text,
  p_birth_hijri text,
  p_phone text,
  p_group_id uuid,
  p_work_name text,
  p_salary numeric,
  p_bank text,
  p_broker text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_finance_customer_secure_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_employee_name text,
  p_full_name text,
  p_national_id text,
  p_birth_hijri text,
  p_phone text,
  p_group_id uuid,
  p_work_name text,
  p_salary numeric,
  p_bank text,
  p_broker text
) FROM anon;

REVOKE ALL ON FUNCTION public.create_finance_customer_secure_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_employee_name text,
  p_full_name text,
  p_national_id text,
  p_birth_hijri text,
  p_phone text,
  p_group_id uuid,
  p_work_name text,
  p_salary numeric,
  p_bank text,
  p_broker text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.create_finance_customer_secure_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_employee_name text,
  p_full_name text,
  p_national_id text,
  p_birth_hijri text,
  p_phone text,
  p_group_id uuid,
  p_work_name text,
  p_salary numeric,
  p_bank text,
  p_broker text
) TO service_role;
