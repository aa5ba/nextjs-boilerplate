-- Migration: fix contract close/reopen semantics and update contract RPC ambiguity.
-- Closing a contract is an administrative pause, not a financial settlement.

CREATE OR REPLACE FUNCTION public.close_contract_atomic(
  p_branch_id uuid,
  p_contract_id uuid,
  p_employee_name text
) RETURNS TABLE(
  contract_id uuid,
  new_paid_amount numeric,
  new_remaining_amount numeric,
  new_contract_status text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_contract public.finance_contracts%rowtype;
  v_employee_name text;
  v_current_paid numeric := 0;
  v_current_remaining numeric := 0;
begin
  v_employee_name :=
    coalesce(
      nullif(trim(p_employee_name), ''),
      'الموظف'
    );

  select *
  into v_contract
  from public.finance_contracts
  where id = p_contract_id
    and branch_id = p_branch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_NOT_FOUND';
  end if;

  if coalesce(v_contract.is_archived, false) = true
     or v_contract.archived_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_ARCHIVED';
  end if;

  if coalesce(v_contract.contract_status, '') = 'مغلق' then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_ALREADY_CLOSED';
  end if;

  v_current_paid :=
    coalesce(
      v_contract.paid_amount,
      0
    );

  v_current_remaining :=
    coalesce(
      v_contract.remaining_amount,
      greatest(
        coalesce(
          v_contract.payment_amount,
          v_contract.debt_amount,
          0
        ) - v_current_paid,
        0
      )
    );

  update public.finance_contracts
  set
    contract_status = 'مغلق',
    updated_at = now()
  where id = p_contract_id
    and branch_id = p_branch_id;

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    customer_id,
    contract_id,
    customer_name,
    employee_name,
    status
  )
  values (
    p_branch_id,
    'إغلاق عقد',
    'تم إغلاق العقد مؤقتًا مع إيقاف السداد حتى إعادة التنشيط',
    v_contract.customer_id,
    p_contract_id,
    coalesce(v_contract.customer_name, ''),
    v_employee_name,
    'مغلق'
  );

  return query
  select
    p_contract_id::uuid,
    v_current_paid::numeric,
    v_current_remaining::numeric,
    'مغلق'::text;
end;
$$;

CREATE OR REPLACE FUNCTION public.reopen_contract_atomic(
  p_branch_id uuid,
  p_contract_id uuid,
  p_employee_name text
) RETURNS TABLE(
  contract_id uuid,
  new_paid_amount numeric,
  new_remaining_amount numeric,
  new_contract_status text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_contract public.finance_contracts%rowtype;
  v_payment_total numeric := 0;
  v_total_due numeric := 0;
  v_new_paid numeric := 0;
  v_new_remaining numeric := 0;
  v_new_status text;
  v_payment_due_date date;
  v_employee_name text;
begin
  v_employee_name :=
    coalesce(
      nullif(trim(p_employee_name), ''),
      'الموظف'
    );

  select *
  into v_contract
  from public.finance_contracts
  where id = p_contract_id
    and branch_id = p_branch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_NOT_FOUND';
  end if;

  if coalesce(v_contract.is_archived, false) = true
     or v_contract.archived_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_ARCHIVED';
  end if;

  if coalesce(v_contract.contract_status, '') <> 'مغلق' then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_NOT_CLOSED';
  end if;

  select coalesce(sum(fp.payment_amount), 0)
  into v_payment_total
  from public.finance_payments as fp
  where fp.branch_id = p_branch_id
    and fp.contract_id = p_contract_id
    and coalesce(fp.is_cancelled, false) = false;

  v_total_due := coalesce(
    v_contract.payment_amount,
    v_contract.debt_amount,
    coalesce(v_contract.paid_amount, 0)
      + coalesce(v_contract.remaining_amount, 0),
    0
  );

  v_new_paid :=
    greatest(
      least(
        v_payment_total,
        v_total_due
      ),
      0
    );

  v_new_remaining :=
    greatest(
      v_total_due - v_new_paid,
      0
    );

  begin
    if nullif(trim(v_contract.payment_due_date::text), '') is not null
       and trim(v_contract.payment_due_date::text)
         ~ '^\d{4}-\d{2}-\d{2}$' then
      v_payment_due_date :=
        trim(v_contract.payment_due_date::text)::date;
    else
      v_payment_due_date := null;
    end if;
  exception
    when others then
      v_payment_due_date := null;
  end;

  v_new_status :=
    case
      when v_new_remaining <= 0 then 'تم السداد'
      when v_payment_due_date is not null
           and v_payment_due_date < current_date then 'متأخر'
      else 'نشط'
    end;

  update public.finance_contracts
  set
    paid_amount = v_new_paid,
    remaining_amount = v_new_remaining,
    contract_status = v_new_status,
    updated_at = now()
  where id = p_contract_id
    and branch_id = p_branch_id;

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    customer_id,
    contract_id,
    customer_name,
    employee_name,
    status
  )
  values (
    p_branch_id,
    'إعادة تنشيط عقد',
    'تمت إعادة تنشيط العقد وإعادة احتساب المدفوع والمتبقي من الدفعات الفعلية',
    v_contract.customer_id,
    p_contract_id,
    coalesce(v_contract.customer_name, ''),
    v_employee_name,
    v_new_status
  );

  return query
  select
    p_contract_id::uuid,
    v_new_paid::numeric,
    v_new_remaining::numeric,
    v_new_status::text;
end;
$$;

CREATE OR REPLACE FUNCTION public.record_payment_atomic_v2(
  p_branch_id uuid,
  p_contract_id uuid,
  p_payment_amount numeric,
  p_payment_type text,
  p_payment_method text,
  p_employee_name text,
  p_allow_overpayment boolean DEFAULT false
) RETURNS TABLE(
  payment_id uuid,
  new_paid_amount numeric,
  new_remaining_amount numeric,
  new_contract_status text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_contract public.finance_contracts%rowtype;
  v_payment_id uuid;
  v_debt numeric;
  v_old_paid numeric;
  v_current_remaining numeric;
  v_new_paid numeric;
  v_new_remaining numeric;
  v_new_status text;
  v_payment_due_date date;

  v_remaining_to_apply numeric;
  v_apply_amount numeric;
  v_installment_new_paid numeric;
  v_installment_new_remaining numeric;
  v_installment_new_status text;
  v_installment record;
begin
  if p_payment_amount is null or p_payment_amount <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_PAYMENT_AMOUNT';
  end if;

  select *
  into v_contract
  from public.finance_contracts
  where id = p_contract_id
    and branch_id = p_branch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_NOT_FOUND';
  end if;

  if coalesce(v_contract.is_archived, false) = true then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_ARCHIVED';
  end if;

  if coalesce(v_contract.contract_status, '') = 'مغلق' then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_CLOSED';
  end if;

  v_old_paid := coalesce(v_contract.paid_amount, 0);

  v_debt := coalesce(
    v_contract.payment_amount,
    v_contract.debt_amount,
    v_old_paid + coalesce(v_contract.remaining_amount, 0),
    0
  );

  v_current_remaining := coalesce(
    v_contract.remaining_amount,
    greatest(v_debt - v_old_paid, 0)
  );

  if v_current_remaining <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_FULLY_PAID';
  end if;

  if p_payment_amount > v_current_remaining
     and not p_allow_overpayment then
    raise exception using
      errcode = 'P0001',
      message = 'PAYMENT_EXCEEDS_REMAINING';
  end if;

  begin
    if nullif(trim(v_contract.payment_due_date::text), '') is not null
       and trim(v_contract.payment_due_date::text)
         ~ '^\d{4}-\d{2}-\d{2}$' then
      v_payment_due_date :=
        trim(v_contract.payment_due_date::text)::date;
    else
      v_payment_due_date := null;
    end if;
  exception
    when others then
      v_payment_due_date := null;
  end;

  v_new_paid := v_old_paid + p_payment_amount;
  v_new_remaining := greatest(v_debt - v_new_paid, 0);

  v_new_status :=
    case
      when v_new_remaining <= 0 then 'تم السداد'
      when v_payment_due_date is not null
           and v_payment_due_date <= current_date then 'متأخر'
      else 'نشط'
    end;

  insert into public.finance_payments (
    branch_id,
    contract_id,
    payment_amount,
    payment_type,
    notes,
    created_by
  )
  values (
    p_branch_id,
    p_contract_id,
    p_payment_amount,
    trim(p_payment_type),
    trim(p_payment_method),
    coalesce(
      nullif(trim(p_employee_name), ''),
      'الموظف'
    )
  )
  returning id into v_payment_id;

  update public.finance_contracts
  set
    paid_amount = v_new_paid,
    remaining_amount = v_new_remaining,
    contract_status = v_new_status,
    updated_at = now()
  where id = p_contract_id
    and branch_id = p_branch_id;

  v_remaining_to_apply := p_payment_amount;

  for v_installment in
    select
      id,
      paid_amount,
      remaining_amount,
      paid_at
    from public.finance_contract_installments
    where branch_id = p_branch_id
      and contract_id = p_contract_id
      and remaining_amount > 0
      and status <> 'ملغاة'
    order by due_date asc, installment_number asc
    for update
  loop
    exit when v_remaining_to_apply <= 0;

    v_apply_amount := least(
      v_remaining_to_apply,
      coalesce(v_installment.remaining_amount, 0)
    );

    if v_apply_amount <= 0 then
      continue;
    end if;

    v_installment_new_paid :=
      coalesce(v_installment.paid_amount, 0) + v_apply_amount;

    v_installment_new_remaining :=
      greatest(
        coalesce(v_installment.remaining_amount, 0) - v_apply_amount,
        0
      );

    v_installment_new_status :=
      case
        when v_installment_new_remaining <= 0 then 'مدفوعة'
        when v_installment_new_paid > 0 then 'مدفوعة جزئيًا'
        else 'غير مدفوعة'
      end;

    update public.finance_contract_installments
    set
      paid_amount = v_installment_new_paid,
      remaining_amount = v_installment_new_remaining,
      status = v_installment_new_status,
      paid_at =
        case
          when v_installment_new_remaining <= 0 then
            coalesce(v_installment.paid_at, now())
          else paid_at
        end,
      updated_at = now()
    where id = v_installment.id;

    v_remaining_to_apply := v_remaining_to_apply - v_apply_amount;
  end loop;

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    customer_id,
    contract_id,
    payment_id,
    customer_name,
    employee_name,
    status
  )
  values (
    p_branch_id,
    'سداد',
    'تم تسجيل سداد للعميل '
      || coalesce(v_contract.customer_name, '')
      || ' بمبلغ '
      || p_payment_amount
      || ' ر.س',
    v_contract.customer_id,
    p_contract_id,
    v_payment_id,
    coalesce(v_contract.customer_name, ''),
    coalesce(
      nullif(trim(p_employee_name), ''),
      'الموظف'
    ),
    v_new_status
  );

  return query
  select
    v_payment_id,
    v_new_paid,
    v_new_remaining,
    v_new_status;
end;
$$;

CREATE OR REPLACE FUNCTION public.record_payment_atomic(
  p_branch_id uuid,
  p_contract_id uuid,
  p_payment_amount numeric,
  p_payment_type text,
  p_payment_method text,
  p_employee_name text,
  p_allow_overpayment boolean DEFAULT false
) RETURNS TABLE(
  payment_id uuid,
  new_paid_amount numeric,
  new_remaining_amount numeric,
  new_contract_status text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_contract public.finance_contracts%rowtype;
  v_payment_id uuid;
  v_debt numeric;
  v_old_paid numeric;
  v_current_remaining numeric;
  v_new_paid numeric;
  v_new_remaining numeric;
  v_new_status text;
  v_payment_due_date date;
begin
  if p_payment_amount is null or p_payment_amount <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_PAYMENT_AMOUNT';
  end if;

  select *
  into v_contract
  from public.finance_contracts
  where id = p_contract_id
    and branch_id = p_branch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_NOT_FOUND';
  end if;

  if coalesce(v_contract.contract_status, '') = 'مغلق' then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_CLOSED';
  end if;

  v_old_paid := coalesce(v_contract.paid_amount, 0);

  v_debt := coalesce(
    v_contract.debt_amount,
    v_contract.payment_amount,
    v_old_paid + coalesce(v_contract.remaining_amount, 0),
    0
  );

  v_current_remaining := coalesce(
    v_contract.remaining_amount,
    greatest(v_debt - v_old_paid, 0)
  );

  if v_current_remaining <= 0 then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_FULLY_PAID';
  end if;

  if p_payment_amount > v_current_remaining
     and not p_allow_overpayment then
    raise exception using
      errcode = 'P0001',
      message = 'PAYMENT_EXCEEDS_REMAINING';
  end if;

  begin
    if nullif(trim(v_contract.payment_due_date::text), '') is not null
       and trim(v_contract.payment_due_date::text)
         ~ '^\d{4}-\d{2}-\d{2}$' then
      v_payment_due_date :=
        trim(v_contract.payment_due_date::text)::date;
    else
      v_payment_due_date := null;
    end if;
  exception
    when others then
      v_payment_due_date := null;
  end;

  v_new_paid := v_old_paid + p_payment_amount;
  v_new_remaining := greatest(v_debt - v_new_paid, 0);

  v_new_status :=
    case
      when v_new_remaining <= 0 then 'تم السداد'
      when v_payment_due_date is not null
           and v_payment_due_date <= current_date then 'متأخر'
      else 'نشط'
    end;

  insert into public.finance_payments (
    branch_id,
    contract_id,
    payment_amount,
    payment_type,
    notes,
    created_by
  )
  values (
    p_branch_id,
    p_contract_id,
    p_payment_amount,
    trim(p_payment_type),
    trim(p_payment_method),
    coalesce(
      nullif(trim(p_employee_name), ''),
      'الموظف'
    )
  )
  returning id into v_payment_id;

  update public.finance_contracts
  set
    paid_amount = v_new_paid,
    remaining_amount = v_new_remaining,
    contract_status = v_new_status,
    updated_at = now()
  where id = p_contract_id
    and branch_id = p_branch_id;

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    customer_id,
    contract_id,
    payment_id,
    customer_name,
    employee_name,
    status
  )
  values (
    p_branch_id,
    'سداد',
    'تم تسجيل سداد للعميل '
      || coalesce(v_contract.customer_name, '')
      || ' بمبلغ '
      || p_payment_amount
      || ' ر.س',
    v_contract.customer_id,
    p_contract_id,
    v_payment_id,
    coalesce(v_contract.customer_name, ''),
    coalesce(
      nullif(trim(p_employee_name), ''),
      'الموظف'
    ),
    v_new_status
  );

  return query
  select
    v_payment_id,
    v_new_paid,
    v_new_remaining,
    v_new_status;
end;
$$;

DROP FUNCTION IF EXISTS public.update_finance_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  uuid,
  text,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  date,
  text,
  text,
  numeric
);

DROP FUNCTION IF EXISTS public.update_finance_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  uuid,
  text,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  date,
  text,
  text
);

CREATE FUNCTION public.update_finance_contract_atomic(
  p_branch_id uuid,
  p_contract_id uuid,
  p_employee_id uuid,
  p_employee_name text,
  p_investor_id uuid,
  p_investor_name text,
  p_product_id uuid,
  p_product_name text,
  p_product_quantity numeric,
  p_print_party_type text,
  p_print_party_name text,
  p_print_party_identifier text,
  p_debt_amount numeric,
  p_payment_amount numeric,
  p_installment_amount numeric,
  p_payment_type text,
  p_payment_due_date date,
  p_legal_city text,
  p_notes text,
  p_judicial_amount numeric
) RETURNS TABLE(
  contract_id uuid,
  investor_id uuid,
  product_id uuid,
  product_quantity numeric,
  new_remaining_amount numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
#variable_conflict use_column

declare
  v_user public.finance_branch_users%rowtype;
  v_contract public.finance_contracts%rowtype;

  v_old_inventory public.finance_inventory%rowtype;
  v_new_inventory public.finance_inventory%rowtype;

  v_customer_name text;

  v_old_quantity numeric := 0;
  v_new_quantity numeric := 0;

  v_old_before numeric := 0;
  v_old_after numeric := 0;

  v_new_before numeric := 0;
  v_new_after numeric := 0;

  v_quantity_difference numeric := 0;
  v_remaining numeric := 0;

  v_same_inventory boolean := false;
  v_is_manager boolean := false;
  v_has_permission boolean := false;
  v_old_inventory_exists boolean := false;
  v_new_inventory_exists boolean := false;

  v_employee_display_name text;
begin
  if p_product_quantity is null
     or p_product_quantity <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if p_debt_amount is null
     or p_debt_amount <= 0
     or p_payment_amount is null
     or p_payment_amount <= 0
     or coalesce(p_installment_amount, 0) < 0 then
    raise exception 'INVALID_AMOUNTS';
  end if;

  if p_investor_id is null then
    raise exception 'INVESTOR_NOT_FOUND';
  end if;

  if p_product_id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select fbu.*
  into v_user
  from public.finance_branch_users as fbu
  where fbu.id = p_employee_id
    and fbu.branch_id = p_branch_id
    and fbu.is_active = true
  for update;

  if not found then
    raise exception 'USER_NOT_FOUND';
  end if;

  v_employee_display_name :=
    coalesce(
      nullif(trim(p_employee_name), ''),
      nullif(trim(v_user.full_name), ''),
      nullif(trim(v_user.username), ''),
      'الموظف'
    );

  v_is_manager :=
    v_user.role in (
      'main_admin',
      'branch_manager',
      'مدير فرع',
      'مدير رئيسي',
      'مدير'
    );

  v_has_permission :=
    coalesce(
      v_user.permissions,
      array[]::text[]
    )
    && array[
      'contracts_edit',
      'contracts_update',
      'edit_contract',
      'contracts'
    ]::text[];

  if not v_is_manager
     and not v_has_permission then
    raise exception 'PERMISSION_DENIED';
  end if;

  select fc.*
  into v_contract
  from public.finance_contracts as fc
  where fc.id = p_contract_id
    and fc.branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'CONTRACT_NOT_FOUND';
  end if;

  if p_payment_amount <
     coalesce(v_contract.paid_amount, 0) then
    raise exception 'PAYMENT_LESS_THAN_PAID';
  end if;

  if not exists (
    select 1
    from public.finance_investors as fi
    where fi.id = p_investor_id
      and fi.branch_id = p_branch_id
      and fi.is_active = true
  ) then
    raise exception 'INVESTOR_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.finance_products as fp
    where fp.id = p_product_id
      and fp.branch_id = p_branch_id
      and fp.is_active = true
  ) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select fcus.full_name
  into v_customer_name
  from public.finance_customers as fcus
  where fcus.id = v_contract.customer_id
    and fcus.branch_id = p_branch_id
  limit 1;

  v_customer_name :=
    coalesce(
      nullif(trim(v_customer_name), ''),
      nullif(trim(v_contract.customer_name), ''),
      ''
    );

  v_old_quantity :=
    coalesce(
      v_contract.product_quantity,
      0
    );

  v_new_quantity := p_product_quantity;

  v_same_inventory :=
    v_contract.investor_id = p_investor_id
    and v_contract.product_id = p_product_id;

  if v_same_inventory then
    select finv.*
    into v_new_inventory
    from public.finance_inventory as finv
    where finv.branch_id = p_branch_id
      and finv.investor_id = p_investor_id
      and finv.product_id = p_product_id
    for update;

    v_new_inventory_exists := found;

    v_quantity_difference :=
      v_new_quantity - v_old_quantity;

    v_new_before :=
      case
        when v_new_inventory_exists then
          coalesce(v_new_inventory.quantity, 0)
        else 0
      end;

    v_new_after :=
      v_new_before - v_quantity_difference;

    if v_new_inventory_exists then
      if v_quantity_difference <> 0 then
        update public.finance_inventory as finv
        set
          quantity = v_new_after,
          updated_at = now()
        where finv.id = v_new_inventory.id
          and finv.branch_id = p_branch_id;
      end if;
    else
      insert into public.finance_inventory (
        branch_id,
        investor_id,
        product_id,
        quantity
      )
      values (
        p_branch_id,
        p_investor_id,
        p_product_id,
        v_new_after
      )
      returning * into v_new_inventory;
    end if;

    if v_quantity_difference > 0 then
      insert into public.finance_inventory_movements (
        branch_id,
        investor_id,
        product_id,
        contract_id,
        customer_id,
        movement_type,
        quantity,
        before_quantity,
        after_quantity,
        notes,
        created_by
      )
      values (
        p_branch_id,
        p_investor_id,
        p_product_id,
        p_contract_id,
        v_contract.customer_id,
        'خصم',
        v_quantity_difference,
        v_new_before,
        v_new_after,
        case
          when v_new_after < 0 then
            'خصم فرق الكمية بسبب تعديل عقد العميل '
              || v_customer_name
              || ' مع تجاوز المخزون المتاح'
          else
            'خصم فرق الكمية بسبب تعديل عقد العميل '
              || v_customer_name
        end,
        v_employee_display_name
      );

    elsif v_quantity_difference < 0 then
      insert into public.finance_inventory_movements (
        branch_id,
        investor_id,
        product_id,
        contract_id,
        customer_id,
        movement_type,
        quantity,
        before_quantity,
        after_quantity,
        notes,
        created_by
      )
      values (
        p_branch_id,
        p_investor_id,
        p_product_id,
        p_contract_id,
        v_contract.customer_id,
        'إرجاع',
        abs(v_quantity_difference),
        v_new_before,
        v_new_after,
        case
          when v_new_after < 0 then
            'إرجاع فرق الكمية بسبب تعديل عقد العميل '
              || v_customer_name
              || ' مع بقاء رصيد المخزون بالسالب'
          else
            'إرجاع فرق الكمية بسبب تعديل عقد العميل '
              || v_customer_name
        end,
        v_employee_display_name
      );
    end if;

  else
    if v_contract.investor_id is not null
       and v_contract.product_id is not null
       and v_old_quantity > 0 then

      select finv.*
      into v_old_inventory
      from public.finance_inventory as finv
      where finv.branch_id = p_branch_id
        and finv.investor_id = v_contract.investor_id
        and finv.product_id = v_contract.product_id
      for update;

      v_old_inventory_exists := found;

      v_old_before :=
        case
          when v_old_inventory_exists then
            coalesce(v_old_inventory.quantity, 0)
          else 0
        end;

      v_old_after :=
        v_old_before + v_old_quantity;

      if v_old_inventory_exists then
        update public.finance_inventory as finv
        set
          quantity = v_old_after,
          updated_at = now()
        where finv.id = v_old_inventory.id
          and finv.branch_id = p_branch_id;
      else
        insert into public.finance_inventory (
          branch_id,
          investor_id,
          product_id,
          quantity
        )
        values (
          p_branch_id,
          v_contract.investor_id,
          v_contract.product_id,
          v_old_after
        )
        returning * into v_old_inventory;
      end if;

      insert into public.finance_inventory_movements (
        branch_id,
        investor_id,
        product_id,
        contract_id,
        customer_id,
        movement_type,
        quantity,
        before_quantity,
        after_quantity,
        notes,
        created_by
      )
      values (
        p_branch_id,
        v_contract.investor_id,
        v_contract.product_id,
        p_contract_id,
        v_contract.customer_id,
        'إرجاع',
        v_old_quantity,
        v_old_before,
        v_old_after,
        case
          when v_old_after < 0 then
            'إرجاع كمية بسبب تعديل عقد العميل '
              || v_customer_name
              || ' مع بقاء رصيد المخزون بالسالب'
          else
            'إرجاع كمية بسبب تعديل عقد العميل '
              || v_customer_name
        end,
        v_employee_display_name
      );
    end if;

    select finv.*
    into v_new_inventory
    from public.finance_inventory as finv
    where finv.branch_id = p_branch_id
      and finv.investor_id = p_investor_id
      and finv.product_id = p_product_id
    for update;

    v_new_inventory_exists := found;

    v_new_before :=
      case
        when v_new_inventory_exists then
          coalesce(v_new_inventory.quantity, 0)
        else 0
      end;

    v_new_after :=
      v_new_before - v_new_quantity;

    if v_new_inventory_exists then
      update public.finance_inventory as finv
      set
        quantity = v_new_after,
        updated_at = now()
      where finv.id = v_new_inventory.id
        and finv.branch_id = p_branch_id;
    else
      insert into public.finance_inventory (
        branch_id,
        investor_id,
        product_id,
        quantity
      )
      values (
        p_branch_id,
        p_investor_id,
        p_product_id,
        v_new_after
      )
      returning * into v_new_inventory;
    end if;

    insert into public.finance_inventory_movements (
      branch_id,
      investor_id,
      product_id,
      contract_id,
      customer_id,
      movement_type,
      quantity,
      before_quantity,
      after_quantity,
      notes,
      created_by
    )
    values (
      p_branch_id,
      p_investor_id,
      p_product_id,
      p_contract_id,
      v_contract.customer_id,
      'خصم',
      v_new_quantity,
      v_new_before,
      v_new_after,
      case
        when v_new_after < 0 then
          'خصم كمية جديدة بسبب تعديل عقد العميل '
            || v_customer_name
            || ' مع تجاوز المخزون المتاح'
        else
          'خصم كمية جديدة بسبب تعديل عقد العميل '
            || v_customer_name
      end,
      v_employee_display_name
    );
  end if;

  v_remaining :=
    greatest(
      p_payment_amount -
      coalesce(
        v_contract.paid_amount,
        0
      ),
      0
    );

  update public.finance_contracts as fc
  set
    investor_id = p_investor_id,
    investor_name = p_investor_name,

    product_id = p_product_id,
    product_name = p_product_name,
    product_quantity = v_new_quantity,

    print_party_type = p_print_party_type,
    print_party_name = p_print_party_name,
    print_party_identifier = p_print_party_identifier,

    first_party_type = p_print_party_type,
    first_party_name = p_print_party_name,
    first_party_identifier = p_print_party_identifier,

    debt_amount = p_debt_amount,
    payment_amount = p_payment_amount,

    installment_amount =
      coalesce(
        p_installment_amount,
        0
      ),

    payment_type = p_payment_type,
    payment_due_date = p_payment_due_date,

    legal_city =
      nullif(
        trim(p_legal_city),
        ''
      ),

    notes =
      nullif(
        trim(p_notes),
        ''
      ),

    judicial_amount =
      coalesce(
        p_judicial_amount,
        0
      ),

    remaining_amount = v_remaining,
    updated_at = now()

  where fc.id = p_contract_id
    and fc.branch_id = p_branch_id;

  if not found then
    raise exception 'CONTRACT_UPDATE_FAILED';
  end if;

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    customer_id,
    contract_id,
    customer_name,
    employee_name,
    status
  )
  values (
    p_branch_id,
    'تعديل عقد',
    'تم تعديل عقد العميل '
      || v_customer_name
      || case
           when v_new_after < 0 then
             ' مع تجاوز المخزون المتاح'
           else ''
         end,
    v_contract.customer_id,
    p_contract_id,
    v_customer_name,
    v_employee_display_name,
    case
      when v_new_after < 0 then
        'مخزون بالسالب'
      else
        coalesce(
          v_contract.contract_status,
          'نشط'
        )
    end
  );

  return query
  select
    p_contract_id::uuid as contract_id,
    p_investor_id::uuid as investor_id,
    p_product_id::uuid as product_id,
    v_new_quantity::numeric as product_quantity,
    v_remaining::numeric as new_remaining_amount;
end;
$$;

REVOKE ALL ON FUNCTION public.update_finance_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  uuid,
  text,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  date,
  text,
  text,
  numeric
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.update_finance_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  uuid,
  text,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  date,
  text,
  text,
  numeric
) FROM anon;

REVOKE ALL ON FUNCTION public.update_finance_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  uuid,
  text,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  date,
  text,
  text,
  numeric
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.update_finance_contract_atomic(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  uuid,
  text,
  numeric,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text,
  date,
  text,
  text,
  numeric
) TO service_role;
