-- Migration: free sale guarantor and judicial options.
-- Recreates free sale RPCs with one explicit signature per function.

DROP FUNCTION IF EXISTS public.create_free_sale_contract_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric
);

DROP FUNCTION IF EXISTS public.create_free_sale_contract_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric,
  boolean,
  text,
  text,
  text
);

DROP FUNCTION IF EXISTS public.update_free_sale_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric
);

DROP FUNCTION IF EXISTS public.update_free_sale_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric,
  boolean,
  text,
  text,
  text
);

CREATE FUNCTION public.create_free_sale_contract_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_buyer_name text,
  p_buyer_national_id text,
  p_buyer_phone text,
  p_sale_day text,
  p_contract_date date,
  p_city text,
  p_seller_name text,
  p_seller_national_id text,
  p_item_description text,
  p_due_amount numeric,
  p_payment_method text,
  p_due_date date,
  p_seller_signature_name text,
  p_buyer_signature_name text,
  p_judicial_amount numeric,
  p_has_guarantor boolean,
  p_guarantor_name text,
  p_guarantor_national_id text,
  p_guarantor_phone text
) returns table (
  contract_id uuid,
  note_id uuid,
  customer_id uuid,
  contract_number bigint,
  note_number bigint
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user public.finance_branch_users%rowtype;
  v_employee_name text;
  v_buyer_name text;
  v_buyer_national_id text;
  v_buyer_phone text;
  v_seller_national_id text;
  v_due_amount numeric(14, 2);
  v_judicial_amount numeric(14, 2);
  v_payment_method text;
  v_contract_id uuid;
  v_customer_id uuid;
  v_guarantor_customer_id uuid;
  v_contract_number bigint;
  v_has_guarantor boolean;
  v_guarantor_name text;
  v_guarantor_national_id text;
  v_guarantor_phone text;
  v_free_sale_data jsonb;
begin
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
    'contracts_create'
  ) then
    raise exception 'CONTRACTS_CREATE_PERMISSION_DENIED';
  end if;

  v_employee_name := coalesce(
    nullif(trim(v_user.full_name), ''),
    nullif(trim(v_user.username), ''),
    'الموظف'
  );

  v_buyer_name := nullif(trim(coalesce(p_buyer_name, '')), '');

  v_buyer_national_id := regexp_replace(
    translate(
      coalesce(p_buyer_national_id, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  v_buyer_phone := regexp_replace(
    translate(
      coalesce(p_buyer_phone, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  v_seller_national_id := regexp_replace(
    translate(
      coalesce(p_seller_national_id, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  v_has_guarantor := coalesce(p_has_guarantor, false);
  v_guarantor_name := nullif(trim(coalesce(p_guarantor_name, '')), '');
  v_guarantor_national_id := regexp_replace(
    translate(
      coalesce(p_guarantor_national_id, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );
  v_guarantor_phone := regexp_replace(
    translate(
      coalesce(p_guarantor_phone, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  if v_buyer_name is null then
    raise exception 'BUYER_NAME_REQUIRED';
  end if;

  if v_buyer_national_id !~ '^[0-9]{10}$' then
    raise exception 'INVALID_BUYER_NATIONAL_ID';
  end if;

  if v_buyer_phone <> ''
     and v_buyer_phone !~ '^05[0-9]{8}$' then
    raise exception 'INVALID_BUYER_PHONE';
  end if;

  if v_seller_national_id <> ''
     and v_seller_national_id !~ '^[0-9]+$' then
    raise exception 'INVALID_SELLER_NATIONAL_ID';
  end if;

  if v_has_guarantor then
    if v_guarantor_name is null or length(v_guarantor_name) < 2 then
      raise exception 'GUARANTOR_NAME_REQUIRED';
    end if;

    if v_guarantor_national_id !~ '^[0-9]{10}$' then
      raise exception 'INVALID_GUARANTOR_NATIONAL_ID';
    end if;

    if v_guarantor_national_id = v_buyer_national_id then
      raise exception 'GUARANTOR_SAME_AS_BUYER';
    end if;

    if v_guarantor_phone <> ''
       and v_guarantor_phone !~ '^05[0-9]{8}$' then
      raise exception 'INVALID_GUARANTOR_PHONE';
    end if;
  else
    v_guarantor_name := null;
    v_guarantor_national_id := '';
    v_guarantor_phone := '';
    v_guarantor_customer_id := null;
  end if;

  v_due_amount := round(greatest(coalesce(p_due_amount, 0), 0), 2);

  v_judicial_amount := round(coalesce(p_judicial_amount, 0), 2);

  if v_judicial_amount < 0 then
    raise exception 'INVALID_JUDICIAL_AMOUNT';
  end if;

  v_payment_method := nullif(trim(coalesce(p_payment_method, '')), '');

  if v_payment_method is not null
     and v_payment_method not in ('على دفعة واحدة', 'على دفعات') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if p_contract_date is not null
     and p_due_date is not null
     and p_due_date < p_contract_date then
    raise exception 'DUE_DATE_BEFORE_CONTRACT_DATE';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text || ':customer:' || v_buyer_national_id,
      0
    )
  );

  insert into public.finance_customers (
    branch_id,
    full_name,
    national_id,
    birth_date_type,
    birth_hijri,
    birth_gregorian,
    phone,
    updated_at,
    is_archived,
    archived_at,
    archived_by
  )
  values (
    p_branch_id,
    v_buyer_name,
    v_buyer_national_id,
    null,
    null,
    null,
    v_buyer_phone,
    now(),
    false,
    null,
    null
  )
  on conflict (branch_id, national_id)
  do update
  set
    full_name = excluded.full_name,
    phone = case
      when excluded.phone <> '' then excluded.phone
      else public.finance_customers.phone
    end,
    is_archived = false,
    archived_at = null,
    archived_by = null,
    updated_at = now()
  returning id
  into v_customer_id;

  if v_has_guarantor then
    perform pg_advisory_xact_lock(
      hashtextextended(
        p_branch_id::text || ':customer:' || v_guarantor_national_id,
        0
      )
    );

    insert into public.finance_customers (
      branch_id,
      full_name,
      national_id,
      birth_date_type,
      birth_hijri,
      birth_gregorian,
      phone,
      updated_at,
      is_archived,
      archived_at,
      archived_by
    )
    values (
      p_branch_id,
      v_guarantor_name,
      v_guarantor_national_id,
      null,
      null,
      null,
      coalesce(nullif(v_guarantor_phone, ''), ''),
      now(),
      false,
      null,
      null
    )
    on conflict (branch_id, national_id)
    do update
    set
      full_name = excluded.full_name,
      phone = case
        when excluded.phone <> '' then excluded.phone
        else public.finance_customers.phone
      end,
      is_archived = false,
      archived_at = null,
      archived_by = null,
      updated_at = now()
    returning id
    into v_guarantor_customer_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text || ':contract-number',
      0
    )
  );

  select coalesce(max(fc.contract_number), 0) + 1
  into v_contract_number
  from public.finance_contracts as fc
  where fc.branch_id = p_branch_id;

  insert into public.finance_branch_sequences (
    branch_id,
    sequence_type,
    last_number
  )
  values (
    p_branch_id,
    'contract',
    v_contract_number
  )
  on conflict (branch_id, sequence_type)
  do update
  set
    last_number = greatest(
      public.finance_branch_sequences.last_number + 1,
      excluded.last_number
    ),
    updated_at = now()
  returning last_number
  into v_contract_number;

  v_free_sale_data := jsonb_build_object(
    'sale_day', nullif(trim(coalesce(p_sale_day, '')), ''),
    'contract_date', case
      when p_contract_date is null then null
      else p_contract_date::text
    end,
    'city', nullif(trim(coalesce(p_city, '')), ''),
    'seller_name', nullif(trim(coalesce(p_seller_name, '')), ''),
    'seller_national_id', nullif(v_seller_national_id, ''),
    'buyer_name', v_buyer_name,
    'buyer_national_id', v_buyer_national_id,
    'buyer_phone', nullif(v_buyer_phone, ''),
    'item_description', nullif(trim(coalesce(p_item_description, '')), ''),
    'due_amount', v_due_amount,
    'payment_method', v_payment_method,
    'due_date', case
      when p_due_date is null then null
      else p_due_date::text
    end,
    'seller_signature_name', nullif(trim(coalesce(p_seller_signature_name, '')), ''),
    'buyer_signature_name', nullif(trim(coalesce(p_buyer_signature_name, '')), '')
  );

  insert into public.finance_contracts (
    branch_id,
    contract_number,
    customer_id,
    customer_name,
    customer_national_id,
    customer_phone,
    customer_birth_hijri,
    contract_type,
    finance_type,
    debt_amount,
    payment_amount,
    installment_amount,
    has_deferred_payments,
    deferred_payments_count,
    payment_type,
    payment_due_date,
    contract_date_gregorian,
    contract_issue_date_gregorian,
    legal_city,
    judicial_amount,
    notes,
    has_guarantor,
    guarantor_customer_id,
    guarantor_name,
    guarantor_national_id,
    guarantor_phone,
    contract_status,
    paid_amount,
    remaining_amount,
    free_sale_data,
    created_by,
    created_at,
    updated_at
  )
  values (
    p_branch_id,
    v_contract_number,
    v_customer_id,
    v_buyer_name,
    v_buyer_national_id,
    nullif(v_buyer_phone, ''),
    null,
    'عقد بيع حر',
    null,
    v_due_amount,
    v_due_amount,
    0,
    false,
    0,
    v_payment_method,
    case when p_due_date is null then null else p_due_date::text end,
    case when p_contract_date is null then null else p_contract_date::text end,
    p_contract_date,
    nullif(trim(coalesce(p_city, '')), ''),
    v_judicial_amount,
    null,
    v_has_guarantor,
    v_guarantor_customer_id,
    case when v_has_guarantor then v_guarantor_name else null end,
    case when v_has_guarantor then v_guarantor_national_id else null end,
    case
      when v_has_guarantor then nullif(v_guarantor_phone, '')
      else null
    end,
    'نشط',
    0,
    v_due_amount,
    v_free_sale_data,
    v_employee_name,
    now(),
    now()
  )
  returning id
  into v_contract_id;

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    customer_id,
    contract_id,
    customer_name,
    employee_name,
    status,
    new_values,
    changed_fields,
    created_at
  )
  values (
    p_branch_id,
    'إنشاء عقد',
    'تم إنشاء عقد بيع حر رقم '
      || v_contract_number::text
      || ' للعميل '
      || v_buyer_name,
    v_customer_id,
    v_contract_id,
    v_buyer_name,
    v_employee_name,
    'نشط',
    jsonb_build_object(
      'contract_id', v_contract_id,
      'contract_number', v_contract_number,
      'contract_type', 'عقد بيع حر',
      'payment_amount', v_due_amount,
      'remaining_amount', v_due_amount,
      'judicial_amount', v_judicial_amount,
      'has_guarantor', v_has_guarantor,
      'guarantor_name', case when v_has_guarantor then v_guarantor_name else null end,
      'guarantor_national_id', case when v_has_guarantor then v_guarantor_national_id else null end
    ),
    array[
      'إنشاء العميل أو تحديثه',
      'إنشاء عقد بيع حر'
    ]::text[],
    now()
  );

  return query
  select
    v_contract_id,
    null::uuid,
    v_customer_id,
    v_contract_number,
    null::bigint;
end;
$$;

REVOKE ALL ON FUNCTION public.create_free_sale_contract_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric,
  boolean,
  text,
  text,
  text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_free_sale_contract_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric,
  boolean,
  text,
  text,
  text
) FROM anon;
REVOKE ALL ON FUNCTION public.create_free_sale_contract_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric,
  boolean,
  text,
  text,
  text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_free_sale_contract_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric,
  boolean,
  text,
  text,
  text
) TO service_role;

CREATE FUNCTION public.update_free_sale_contract_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_contract_id uuid,
  p_buyer_name text,
  p_buyer_national_id text,
  p_buyer_phone text,
  p_sale_day text,
  p_contract_date date,
  p_city text,
  p_seller_name text,
  p_seller_national_id text,
  p_item_description text,
  p_due_amount numeric,
  p_payment_method text,
  p_due_date date,
  p_seller_signature_name text,
  p_buyer_signature_name text,
  p_judicial_amount numeric,
  p_has_guarantor boolean,
  p_guarantor_name text,
  p_guarantor_national_id text,
  p_guarantor_phone text
)
returns table (
  contract_id uuid,
  customer_id uuid,
  new_remaining_amount numeric
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user public.finance_branch_users%rowtype;
  v_contract public.finance_contracts%rowtype;
  v_employee_name text;
  v_buyer_name text;
  v_buyer_national_id text;
  v_buyer_phone text;
  v_seller_national_id text;
  v_customer_id uuid;
  v_guarantor_customer_id uuid;
  v_has_guarantor boolean;
  v_guarantor_name text;
  v_guarantor_national_id text;
  v_guarantor_phone text;
  v_due_amount numeric(14, 2);
  v_judicial_amount numeric(14, 2);
  v_paid_amount numeric(14, 2);
  v_remaining_amount numeric(14, 2);
  v_contract_status text;
begin
  if p_branch_id is null then
    raise exception 'BRANCH_REQUIRED';
  end if;

  if p_employee_id is null then
    raise exception 'EMPLOYEE_REQUIRED';
  end if;

  if p_contract_id is null then
    raise exception 'CONTRACT_REQUIRED';
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
    'contracts_edit'
  ) then
    raise exception 'CONTRACTS_EDIT_PERMISSION_DENIED';
  end if;

  select fc.*
  into v_contract
  from public.finance_contracts as fc
  where fc.id = p_contract_id
    and fc.branch_id = p_branch_id
    and fc.contract_type = 'عقد بيع حر'
    and coalesce(fc.is_archived, false) = false
    and fc.archived_at is null
  for update;

  if not found then
    raise exception 'CONTRACT_NOT_FOUND';
  end if;

  v_employee_name := coalesce(
    nullif(trim(v_user.full_name), ''),
    nullif(trim(v_user.username), ''),
    'الموظف'
  );

  v_buyer_name :=
    nullif(trim(coalesce(p_buyer_name, '')), '');

  if v_buyer_name is null then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  v_buyer_national_id := regexp_replace(
    translate(
      coalesce(p_buyer_national_id, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  if v_buyer_national_id !~ '^[0-9]{10}$' then
    raise exception 'INVALID_CUSTOMER_NATIONAL_ID';
  end if;

  v_buyer_phone := regexp_replace(
    translate(
      coalesce(p_buyer_phone, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  if v_buyer_phone <> ''
     and v_buyer_phone !~ '^05[0-9]{8}$'
  then
    raise exception 'INVALID_CUSTOMER_PHONE';
  end if;

    v_seller_national_id := regexp_replace(
    translate(
      coalesce(p_seller_national_id, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  v_has_guarantor := coalesce(p_has_guarantor, false);
  v_guarantor_name := nullif(trim(coalesce(p_guarantor_name, '')), '');
  v_guarantor_national_id := regexp_replace(
    translate(
      coalesce(p_guarantor_national_id, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );
  v_guarantor_phone := regexp_replace(
    translate(
      coalesce(p_guarantor_phone, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

if v_has_guarantor then
    if v_guarantor_name is null or length(v_guarantor_name) < 2 then
      raise exception 'GUARANTOR_NAME_REQUIRED';
    end if;

    if v_guarantor_national_id !~ '^[0-9]{10}$' then
      raise exception 'INVALID_GUARANTOR_NATIONAL_ID';
    end if;

    if v_guarantor_national_id = v_buyer_national_id then
      raise exception 'GUARANTOR_SAME_AS_BUYER';
    end if;

    if v_guarantor_phone <> ''
       and v_guarantor_phone !~ '^05[0-9]{8}$' then
      raise exception 'INVALID_GUARANTOR_PHONE';
    end if;
  else
    v_guarantor_name := null;
    v_guarantor_national_id := '';
    v_guarantor_phone := '';
    v_guarantor_customer_id := null;
  end if;

  v_due_amount := round(coalesce(p_due_amount, 0), 2);

  if v_due_amount < 0 then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  v_judicial_amount := round(coalesce(p_judicial_amount, 0), 2);

  if v_judicial_amount < 0 then
    raise exception 'INVALID_JUDICIAL_AMOUNT';
  end if;

  if nullif(trim(coalesce(p_payment_method, '')), '') is not null
     and trim(p_payment_method) not in ('على دفعة واحدة', 'على دفعات')
  then
    raise exception 'INVALID_PAYMENT_TYPE';
  end if;

  if p_contract_date is not null
     and p_due_date is not null
     and p_due_date < p_contract_date
  then
    raise exception 'DUE_DATE_BEFORE_CONTRACT_DATE';
  end if;

  v_paid_amount := round(coalesce(v_contract.paid_amount, 0), 2);

  if v_due_amount < v_paid_amount then
    raise exception 'PAYMENT_LESS_THAN_PAID';
  end if;

  v_remaining_amount := greatest(v_due_amount - v_paid_amount, 0);

  v_contract_status :=
    case
      when v_remaining_amount = 0 then 'تم السداد'
      when p_due_date is not null
           and p_due_date < current_date then 'متأخر'
      else 'نشط'
    end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text
      || ':customer:'
      || v_buyer_national_id,
      0
    )
  );

  insert into public.finance_customers (
    branch_id,
    full_name,
    national_id,
    birth_date_type,
    birth_hijri,
    birth_gregorian,
    phone,
    updated_at,
    is_archived,
    archived_at,
    archived_by
  )
  values (
    p_branch_id,
    v_buyer_name,
    v_buyer_national_id,
    null,
    null,
    null,
    coalesce(nullif(v_buyer_phone, ''), ''),
    now(),
    false,
    null,
    null
  )
  on conflict (branch_id, national_id)
  do update
  set
    full_name = excluded.full_name,
    phone = coalesce(nullif(excluded.phone, ''), public.finance_customers.phone),
    is_archived = false,
    archived_at = null,
    archived_by = null,
    updated_at = now()
  returning id
  into v_customer_id;

  if v_has_guarantor then
    perform pg_advisory_xact_lock(
      hashtextextended(
        p_branch_id::text || ':customer:' || v_guarantor_national_id,
        0
      )
    );

    insert into public.finance_customers (
      branch_id,
      full_name,
      national_id,
      birth_date_type,
      birth_hijri,
      birth_gregorian,
      phone,
      updated_at,
      is_archived,
      archived_at,
      archived_by
    )
    values (
      p_branch_id,
      v_guarantor_name,
      v_guarantor_national_id,
      null,
      null,
      null,
      coalesce(nullif(v_guarantor_phone, ''), ''),
      now(),
      false,
      null,
      null
    )
    on conflict (branch_id, national_id)
    do update
    set
      full_name = excluded.full_name,
      phone = coalesce(nullif(excluded.phone, ''), public.finance_customers.phone),
      is_archived = false,
      archived_at = null,
      archived_by = null,
      updated_at = now()
    returning id
    into v_guarantor_customer_id;
  end if;

  update public.finance_contracts as fc
  set
    customer_id = v_customer_id,
    customer_name = v_buyer_name,
    customer_national_id = v_buyer_national_id,
    customer_phone = coalesce(nullif(v_buyer_phone, ''), fc.customer_phone),
    debt_amount = v_due_amount,
    payment_amount = v_due_amount,
    paid_amount = v_paid_amount,
    remaining_amount = v_remaining_amount,
    payment_due_date = case
      when p_due_date is null then null
      else p_due_date::text
    end,
    legal_city = nullif(trim(coalesce(p_city, '')), ''),
    judicial_amount = v_judicial_amount,
    has_guarantor = v_has_guarantor,
    guarantor_customer_id = case
      when v_has_guarantor then v_guarantor_customer_id
      else null
    end,
    guarantor_name = case
      when v_has_guarantor then v_guarantor_name
      else null
    end,
    guarantor_national_id = case
      when v_has_guarantor then v_guarantor_national_id
      else null
    end,
    guarantor_phone = case
      when v_has_guarantor then nullif(v_guarantor_phone, '')
      else null
    end,
    guarantor_birth_hijri = null,
    contract_status = v_contract_status,
    free_sale_data = jsonb_build_object(
      'sale_day', nullif(trim(coalesce(p_sale_day, '')), ''),
      'contract_date', case
        when p_contract_date is null then null
        else p_contract_date::text
      end,
      'city', nullif(trim(coalesce(p_city, '')), ''),
      'seller_name', nullif(trim(coalesce(p_seller_name, '')), ''),
      'seller_national_id', nullif(v_seller_national_id, ''),
      'buyer_name', v_buyer_name,
      'buyer_national_id', v_buyer_national_id,
      'buyer_phone', nullif(v_buyer_phone, ''),
      'item_description', nullif(trim(coalesce(p_item_description, '')), ''),
      'due_amount', v_due_amount,
      'payment_method', nullif(trim(coalesce(p_payment_method, '')), ''),
      'due_date', case
        when p_due_date is null then null
        else p_due_date::text
      end,
      'seller_signature_name',
        nullif(trim(coalesce(p_seller_signature_name, '')), ''),
      'buyer_signature_name',
        nullif(trim(coalesce(p_buyer_signature_name, '')), '')
    ),
    updated_at = now()
  where fc.id = p_contract_id
    and fc.branch_id = p_branch_id;

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    customer_id,
    contract_id,
    customer_name,
    employee_name,
    status,
    old_values,
    new_values,
    changed_fields,
    created_at
  )
  values (
    p_branch_id,
    'تعديل عقد',
    'تم تعديل عقد بيع حر رقم '
      || coalesce(v_contract.contract_number::text, p_contract_id::text)
      || ' للعميل '
      || v_buyer_name,
    v_customer_id,
    p_contract_id,
    v_buyer_name,
    v_employee_name,
    v_contract_status,
    jsonb_build_object(
      'contract_id', p_contract_id,
      'contract_type', 'عقد بيع حر',
      'payment_amount', v_contract.payment_amount,
      'remaining_amount', v_contract.remaining_amount,
      'judicial_amount', coalesce(v_contract.judicial_amount, 0),
      'has_guarantor', coalesce(v_contract.has_guarantor, false),
      'guarantor_name', v_contract.guarantor_name,
      'guarantor_national_id', v_contract.guarantor_national_id
    ),
    jsonb_build_object(
      'contract_id', p_contract_id,
      'contract_type', 'عقد بيع حر',
      'payment_amount', v_due_amount,
      'remaining_amount', v_remaining_amount,
      'judicial_amount', v_judicial_amount,
      'has_guarantor', v_has_guarantor,
      'guarantor_name', case when v_has_guarantor then v_guarantor_name else null end,
      'guarantor_national_id', case when v_has_guarantor then v_guarantor_national_id else null end
    ),
    array[
      'تحديث العميل',
      'تعديل عقد بيع حر',
      'تعديل كفيل عقد البيع الحر'
    ]::text[],
    now()
  );

  return query
  select
    p_contract_id,
    v_customer_id,
    v_remaining_amount;
end;
$$;

REVOKE ALL ON FUNCTION public.update_free_sale_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric,
  boolean,
  text,
  text,
  text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_free_sale_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric,
  boolean,
  text,
  text,
  text
) FROM anon;
REVOKE ALL ON FUNCTION public.update_free_sale_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric,
  boolean,
  text,
  text,
  text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_free_sale_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  text,
  date,
  text,
  text,
  numeric,
  boolean,
  text,
  text,
  text
) TO service_role;

NOTIFY pgrst, 'reload schema';
