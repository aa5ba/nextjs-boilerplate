CREATE OR REPLACE FUNCTION "public"."record_payment_atomic_v2"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_payment_amount" numeric,
  "p_payment_type" "text",
  "p_payment_method" "text",
  "p_employee_name" "text",
  "p_allow_overpayment" boolean DEFAULT false
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
