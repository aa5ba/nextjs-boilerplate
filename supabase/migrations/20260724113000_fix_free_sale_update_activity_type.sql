-- Migration: fix free sale update activity log column.
-- Recreates update_free_sale_contract_atomic with the correct activity log column.

CREATE OR REPLACE FUNCTION public.update_free_sale_contract_atomic(
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
  p_judicial_amount numeric DEFAULT NULL
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
      'payment_amount', v_due_amount,
      'remaining_amount', v_remaining_amount,
      'judicial_amount', v_judicial_amount
    ),
    array[
      'تحديث العميل',
      'تعديل عقد بيع حر'
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
  numeric
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
  numeric
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
  numeric
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
  numeric
) TO service_role;

NOTIFY pgrst, 'reload schema';
