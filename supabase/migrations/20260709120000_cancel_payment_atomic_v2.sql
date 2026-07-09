CREATE OR REPLACE FUNCTION "public"."cancel_payment_atomic_v2"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_payment_id" "uuid",
  "p_employee_name" "text"
) RETURNS TABLE(
  "payment_id" "uuid",
  "new_paid_amount" numeric,
  "new_remaining_amount" numeric,
  "new_contract_status" "text"
)
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_contract public.finance_contracts%rowtype;
  v_payment public.finance_payments%rowtype;

  v_debt numeric := 0;
  v_new_paid numeric := 0;
  v_new_remaining numeric := 0;
  v_new_status text := 'نشط';

  v_payment_due_date date;
  v_employee_name text;
  v_last_active_payment_at timestamp with time zone;

  v_remaining_to_apply numeric := 0;
  v_apply_amount numeric := 0;
  v_installment_new_paid numeric := 0;
  v_installment_new_remaining numeric := 0;
  v_installment_new_status text := 'غير مدفوعة';
  v_installment record;
begin
  v_employee_name := coalesce(
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

  select *
  into v_payment
  from public.finance_payments
  where id = p_payment_id
    and contract_id = p_contract_id
    and branch_id = p_branch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PAYMENT_NOT_FOUND';
  end if;

  if coalesce(v_payment.is_cancelled, false) then
    raise exception using
      errcode = 'P0001',
      message = 'PAYMENT_ALREADY_CANCELLED';
  end if;

  update public.finance_payments
  set
    is_cancelled = true,
    cancelled_at = now(),
    cancelled_by = v_employee_name
  where id = p_payment_id
    and contract_id = p_contract_id
    and branch_id = p_branch_id;

  select
    coalesce(sum(coalesce(payment_amount, 0)), 0),
    max(created_at)
  into
    v_new_paid,
    v_last_active_payment_at
  from public.finance_payments
  where contract_id = p_contract_id
    and branch_id = p_branch_id
    and coalesce(is_cancelled, false) = false;

  v_debt := coalesce(
    v_contract.payment_amount,
    v_contract.debt_amount,
    v_new_paid + coalesce(v_contract.remaining_amount, 0),
    0
  );

  v_new_paid := greatest(
    least(v_new_paid, v_debt),
    0
  );

  v_new_remaining := greatest(
    v_debt - v_new_paid,
    0
  );

  begin
    if nullif(
      trim(v_contract.payment_due_date::text),
      ''
    ) is not null
    and trim(v_contract.payment_due_date::text)
      ~ '^\d{4}-\d{2}-\d{2}$'
    then
      v_payment_due_date :=
        trim(v_contract.payment_due_date::text)::date;
    else
      v_payment_due_date := null;
    end if;
  exception
    when others then
      v_payment_due_date := null;
  end;

  v_new_status := case
    when v_new_remaining <= 0 then
      'تم السداد'
    when v_payment_due_date is not null
      and v_payment_due_date < current_date then
      'متأخر'
    else
      'نشط'
  end;

  update public.finance_contracts
  set
    paid_amount = v_new_paid,
    remaining_amount = v_new_remaining,
    contract_status = v_new_status,
    updated_at = now()
  where id = p_contract_id
    and branch_id = p_branch_id;

  update public.finance_contract_installments
  set
    paid_amount = 0,
    remaining_amount = amount,
    status = 'غير مدفوعة',
    paid_at = null,
    updated_at = now()
  where branch_id = p_branch_id
    and contract_id = p_contract_id
    and status <> 'ملغاة';

  v_remaining_to_apply := v_new_paid;

  for v_installment in
    select
      id,
      amount
    from public.finance_contract_installments
    where branch_id = p_branch_id
      and contract_id = p_contract_id
      and status <> 'ملغاة'
    order by due_date asc, installment_number asc
    for update
  loop
    exit when v_remaining_to_apply <= 0;

    v_apply_amount := least(
      v_remaining_to_apply,
      coalesce(v_installment.amount, 0)
    );

    if v_apply_amount <= 0 then
      continue;
    end if;

    v_installment_new_paid := v_apply_amount;

    v_installment_new_remaining := greatest(
      coalesce(v_installment.amount, 0) - v_installment_new_paid,
      0
    );

    v_installment_new_status := case
      when v_installment_new_remaining <= 0 then
        'مدفوعة'
      when v_installment_new_paid > 0 then
        'مدفوعة جزئيًا'
      else
        'غير مدفوعة'
    end;

    update public.finance_contract_installments
    set
      paid_amount = v_installment_new_paid,
      remaining_amount = v_installment_new_remaining,
      status = v_installment_new_status,
      paid_at = case
        when v_installment_new_remaining <= 0 then
          coalesce(v_last_active_payment_at, now())
        else
          null
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
    'إلغاء دفعة',
    'تم إلغاء دفعة بمبلغ '
      || coalesce(v_payment.payment_amount, 0)
      || ' ر.س',
    v_contract.customer_id,
    p_contract_id,
    p_payment_id,
    coalesce(v_contract.customer_name, ''),
    v_employee_name,
    v_new_status
  );

  return query
  select
    p_payment_id,
    v_new_paid,
    v_new_remaining,
    v_new_status;
end;
$$;

REVOKE ALL ON FUNCTION "public"."cancel_payment_atomic_v2"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_payment_id" "uuid",
  "p_employee_name" "text"
) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."cancel_payment_atomic_v2"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_payment_id" "uuid",
  "p_employee_name" "text"
) TO "service_role";
