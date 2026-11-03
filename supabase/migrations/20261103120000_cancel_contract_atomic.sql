begin;

create or replace function public.prevent_cancelled_contract_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if lower(btrim(coalesce(old.contract_status, ''))) in (
    'ملغي',
    'ملغى',
    'cancelled'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_CANCELLED_READ_ONLY';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_cancelled_contract_update_trigger
  on public.finance_contracts;

create trigger prevent_cancelled_contract_update_trigger
before update on public.finance_contracts
for each row
execute function public.prevent_cancelled_contract_update();

create or replace function public.prevent_cancelled_contract_payment_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contract_status text;
begin
  if tg_op = 'UPDATE' then
    select fc.contract_status
    into v_contract_status
    from public.finance_contracts as fc
    where fc.id = old.contract_id
      and fc.branch_id = old.branch_id;

    if lower(btrim(coalesce(v_contract_status, ''))) in (
      'ملغي',
      'ملغى',
      'cancelled'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'CONTRACT_CANCELLED_READ_ONLY';
    end if;
  end if;

  select fc.contract_status
  into v_contract_status
  from public.finance_contracts as fc
  where fc.id = new.contract_id
    and fc.branch_id = new.branch_id;

  if lower(btrim(coalesce(v_contract_status, ''))) in (
    'ملغي',
    'ملغى',
    'cancelled'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_CANCELLED_READ_ONLY';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_cancelled_contract_payment_change_trigger
  on public.finance_payments;

create trigger prevent_cancelled_contract_payment_change_trigger
before insert or update on public.finance_payments
for each row
execute function public.prevent_cancelled_contract_payment_change();

create or replace function public.prevent_cancelled_contract_installment_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contract_status text;
begin
  if tg_op = 'UPDATE' then
    select fc.contract_status
    into v_contract_status
    from public.finance_contracts as fc
    where fc.id = old.contract_id
      and fc.branch_id = old.branch_id;

    if lower(btrim(coalesce(v_contract_status, ''))) in (
      'ملغي',
      'ملغى',
      'cancelled'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'CONTRACT_CANCELLED_READ_ONLY';
    end if;
  end if;

  select fc.contract_status
  into v_contract_status
  from public.finance_contracts as fc
  where fc.id = new.contract_id
    and fc.branch_id = new.branch_id;

  if lower(btrim(coalesce(v_contract_status, ''))) in (
    'ملغي',
    'ملغى',
    'cancelled'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_CANCELLED_READ_ONLY';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_cancelled_contract_installment_change_trigger
  on public.finance_contract_installments;

create trigger prevent_cancelled_contract_installment_change_trigger
before insert or update on public.finance_contract_installments
for each row
execute function public.prevent_cancelled_contract_installment_change();

create or replace function public.prevent_cancelled_contract_inventory_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contract_status text;
begin
  if tg_op = 'UPDATE' and old.contract_id is not null then
    select fc.contract_status
    into v_contract_status
    from public.finance_contracts as fc
    where fc.id = old.contract_id
      and fc.branch_id = old.branch_id;

    if lower(btrim(coalesce(v_contract_status, ''))) in (
      'ملغي',
      'ملغى',
      'cancelled'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'CONTRACT_CANCELLED_READ_ONLY';
    end if;
  end if;

  if new.contract_id is null then
    return new;
  end if;

  select fc.contract_status
  into v_contract_status
  from public.finance_contracts as fc
  where fc.id = new.contract_id
    and fc.branch_id = new.branch_id;

  if lower(btrim(coalesce(v_contract_status, ''))) in (
    'ملغي',
    'ملغى',
    'cancelled'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_CANCELLED_READ_ONLY';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_cancelled_contract_inventory_change_trigger
  on public.finance_inventory_movements;

create trigger prevent_cancelled_contract_inventory_change_trigger
before insert or update on public.finance_inventory_movements
for each row
execute function public.prevent_cancelled_contract_inventory_change();

create or replace function public.prevent_cancelled_contract_note_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contract_status text;
begin
  if tg_op = 'UPDATE' and old.contract_id is not null then
    select fc.contract_status
    into v_contract_status
    from public.finance_contracts as fc
    where fc.id = old.contract_id
      and fc.branch_id = old.branch_id;

    if lower(btrim(coalesce(v_contract_status, ''))) in (
      'ملغي',
      'ملغى',
      'cancelled'
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'CONTRACT_CANCELLED_READ_ONLY';
    end if;
  end if;

  if new.contract_id is null then
    return new;
  end if;

  select fc.contract_status
  into v_contract_status
  from public.finance_contracts as fc
  where fc.id = new.contract_id
    and fc.branch_id = new.branch_id;

  if lower(btrim(coalesce(v_contract_status, ''))) in (
    'ملغي',
    'ملغى',
    'cancelled'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_CANCELLED_READ_ONLY';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_cancelled_contract_note_change_trigger
  on public.finance_promissory_notes;

create trigger prevent_cancelled_contract_note_change_trigger
before insert or update on public.finance_promissory_notes
for each row
execute function public.prevent_cancelled_contract_note_change();

create or replace function public.cancel_finance_contract_atomic(
  p_branch_id uuid,
  p_contract_id uuid,
  p_employee_id uuid,
  p_employee_name text
) returns table(
  contract_id uuid,
  new_contract_status text,
  cancelled_payments_count integer,
  returned_inventory_quantity numeric,
  returned_inventory_cost numeric,
  reversed_cash_amount numeric,
  removed_contracts_wallet_amount numeric,
  cancelled_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user public.finance_branch_users%rowtype;
  v_contract public.finance_contracts%rowtype;
  v_inventory public.finance_inventory%rowtype;
  v_cash_wallet public.finance_investor_wallets%rowtype;
  v_goods_result record;
  v_allocation record;
  v_cash_requirement record;
  v_operation_id uuid := gen_random_uuid();
  v_cancelled_at timestamptz := now();
  v_employee_name text;
  v_cancelled_payments integer := 0;
  v_returned_quantity numeric := 0;
  v_returned_cost numeric := 0;
  v_reversed_cash numeric := 0;
  v_contracts_wallet_amount numeric := 0;
  v_allocation_groups integer := 0;
  v_allocation_quantity numeric := 0;
  v_before_quantity numeric;
  v_after_quantity numeric;
  v_before_total_cost numeric;
  v_after_total_cost numeric;
  v_after_average_cost numeric;
  v_movement_id uuid;
begin
  if p_branch_id is null
     or p_contract_id is null
     or p_employee_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_CANCEL_CONTRACT_INPUT';
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
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_EMPLOYEE_SESSION';
  end if;

  if not public.finance_user_has_permission(
    p_branch_id,
    p_employee_id,
    'contracts_close'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_CANCEL_PERMISSION_DENIED';
  end if;

  v_employee_name := coalesce(
    nullif(btrim(p_employee_name), ''),
    nullif(btrim(v_user.full_name), ''),
    nullif(btrim(v_user.username), ''),
    'الموظف'
  );

  select fc.*
  into v_contract
  from public.finance_contracts as fc
  where fc.id = p_contract_id
    and fc.branch_id = p_branch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_NOT_FOUND';
  end if;

  if coalesce(v_contract.is_archived, false)
     or v_contract.archived_at is not null then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_ARCHIVED';
  end if;

  if lower(btrim(coalesce(v_contract.contract_status, ''))) in (
    'ملغي',
    'ملغى',
    'cancelled'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_ALREADY_CANCELLED';
  end if;

  if exists (
    select 1
    from public.finance_investor_goods_transaction_details as gtd
    where gtd.branch_id = p_branch_id
      and gtd.contract_id = p_contract_id
    group by gtd.investor_id, gtd.product_id
    having round(sum(gtd.quantity_delta), 6) > 0
      or round(sum(gtd.value_delta), 6) > 0
      or (
        round(sum(gtd.quantity_delta), 6) < 0
        and round(sum(gtd.value_delta), 6) >= 0
      )
      or (
        round(sum(gtd.value_delta), 6) < 0
        and round(sum(gtd.quantity_delta), 6) >= 0
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_INVENTORY_HISTORY_INVALID';
  end if;

  select
    count(*)::integer,
    coalesce(sum(allocation.return_quantity), 0)
  into
    v_allocation_groups,
    v_allocation_quantity
  from (
    select
      gtd.investor_id,
      gtd.product_id,
      round(-sum(gtd.quantity_delta), 6) as return_quantity
    from public.finance_investor_goods_transaction_details as gtd
    where gtd.branch_id = p_branch_id
      and gtd.contract_id = p_contract_id
    group by gtd.investor_id, gtd.product_id
    having round(sum(gtd.quantity_delta), 6) < 0
  ) as allocation;

  if coalesce(v_contract.product_quantity, 0) > 0 then
    if v_allocation_groups <> 1
       or abs(
         round(v_allocation_quantity, 6)
         - round(v_contract.product_quantity, 6)
       ) > 0.000001
       or not exists (
         select 1
         from public.finance_investor_goods_transaction_details as gtd
         where gtd.branch_id = p_branch_id
           and gtd.contract_id = p_contract_id
           and gtd.investor_id = v_contract.investor_id
           and gtd.product_id = v_contract.product_id
         group by gtd.investor_id, gtd.product_id
         having round(sum(gtd.quantity_delta), 6) < 0
       ) then
      raise exception using
        errcode = 'P0001',
        message = 'CONTRACT_INVENTORY_HISTORY_MISMATCH';
    end if;
  elsif v_allocation_groups <> 0 then
    raise exception using
      errcode = 'P0001',
      message = 'CONTRACT_INVENTORY_HISTORY_MISMATCH';
  end if;

  for v_allocation in
    select
      gtd.investor_id,
      gtd.product_id,
      round(-sum(gtd.quantity_delta), 6) as return_quantity,
      round(-sum(gtd.value_delta), 6) as return_cost
    from public.finance_investor_goods_transaction_details as gtd
    where gtd.branch_id = p_branch_id
      and gtd.contract_id = p_contract_id
    group by gtd.investor_id, gtd.product_id
    having round(sum(gtd.quantity_delta), 6) < 0
    order by gtd.investor_id, gtd.product_id
  loop
    if v_allocation.return_quantity <= 0
       or v_allocation.return_cost <= 0 then
      raise exception using
        errcode = 'P0001',
        message = 'CONTRACT_INVENTORY_HISTORY_INVALID';
    end if;

    select finv.*
    into v_inventory
    from public.finance_inventory as finv
    where finv.branch_id = p_branch_id
      and finv.investor_id = v_allocation.investor_id
      and finv.product_id = v_allocation.product_id
    for update;

    if not found then
      raise exception using
        errcode = 'P0001',
        message = 'INVENTORY_NOT_FOUND';
    end if;

    v_before_quantity := round(coalesce(v_inventory.quantity, 0), 6);
    v_before_total_cost := round(
      coalesce(v_inventory.total_cost_value, 0),
      6
    );
    v_after_quantity := round(
      v_before_quantity + v_allocation.return_quantity,
      6
    );
    v_after_total_cost := round(
      v_before_total_cost + v_allocation.return_cost,
      6
    );
    v_after_average_cost := case
      when v_after_quantity > 0 then
        round(v_after_total_cost / v_after_quantity, 6)
      else null
    end;

    update public.finance_inventory
    set
      quantity = v_after_quantity,
      total_cost_value = v_after_total_cost,
      average_unit_cost = v_after_average_cost,
      cost_initialized_at = coalesce(cost_initialized_at, now()),
      updated_at = now()
    where id = v_inventory.id;

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
      v_allocation.investor_id,
      v_allocation.product_id,
      p_contract_id,
      v_contract.customer_id,
      'إرجاع إلغاء عقد',
      v_allocation.return_quantity,
      v_before_quantity,
      v_after_quantity,
      'إعادة البطاقات بالتكلفة التاريخية بسبب إلغاء العقد',
      v_employee_name
    )
    returning id into v_movement_id;

    select *
    into v_goods_result
    from public.create_investor_wallet_transaction_internal(
      p_branch_id,
      v_allocation.investor_id,
      'goods',
      'credit',
      'goods_return_from_contract',
      v_allocation.return_cost,
      'إعادة تكلفة بطاقات عقد ملغي',
      p_employee_id,
      v_employee_name,
      v_operation_id,
      v_allocation.product_id,
      p_contract_id,
      v_movement_id,
      null,
      null,
      'contract-cancel-goods:'
        || p_contract_id::text
        || ':'
        || v_allocation.investor_id::text
        || ':'
        || v_allocation.product_id::text,
      jsonb_build_object(
        'quantity', v_allocation.return_quantity,
        'historical_total_cost', v_allocation.return_cost,
        'cancelled_at', v_cancelled_at
      )
    );

    insert into public.finance_investor_goods_transaction_details (
      transaction_id,
      operation_id,
      branch_id,
      investor_id,
      product_id,
      quantity_delta,
      quantity_before,
      quantity_after,
      unit_cost,
      value_delta,
      inventory_movement_id,
      contract_id
    )
    values (
      v_goods_result.transaction_id,
      v_operation_id,
      p_branch_id,
      v_allocation.investor_id,
      v_allocation.product_id,
      v_allocation.return_quantity,
      v_before_quantity,
      v_after_quantity,
      round(
        v_allocation.return_cost / v_allocation.return_quantity,
        6
      ),
      v_allocation.return_cost,
      v_movement_id,
      p_contract_id
    );

    v_returned_quantity := round(
      v_returned_quantity + v_allocation.return_quantity,
      6
    );
    v_returned_cost := round(
      v_returned_cost + v_allocation.return_cost,
      6
    );
  end loop;

  for v_cash_requirement in
    select
      original_cash.investor_id,
      round(sum(original_cash.amount), 6) as required_amount
    from public.finance_payments as fp
    join lateral (
      select fwt.*
      from public.finance_investor_wallet_transactions as fwt
      where fwt.branch_id = p_branch_id
        and fwt.payment_id = fp.id
        and fwt.wallet_type = 'cash'
        and fwt.transaction_type = 'contract_payment_received'
      order by fwt.created_at desc, fwt.id desc
      limit 1
    ) as original_cash on true
    where fp.branch_id = p_branch_id
      and fp.contract_id = p_contract_id
      and coalesce(fp.is_cancelled, false) = false
      and not exists (
        select 1
        from public.finance_investor_wallet_transactions as reversal
        where reversal.reversal_of_transaction_id = original_cash.id
      )
    group by original_cash.investor_id
    order by original_cash.investor_id
  loop
    select fiw.*
    into v_cash_wallet
    from public.finance_investor_wallets as fiw
    where fiw.branch_id = p_branch_id
      and fiw.investor_id = v_cash_requirement.investor_id
      and fiw.wallet_type = 'cash'
    for update;

    if not found
       or coalesce(v_cash_wallet.balance_amount, 0)
          < v_cash_requirement.required_amount then
      raise exception using
        errcode = 'P0001',
        message = 'INSUFFICIENT_CASH_BALANCE';
    end if;

    v_reversed_cash := round(
      v_reversed_cash + v_cash_requirement.required_amount,
      6
    );
  end loop;

  update public.finance_payments as fp
  set
    is_cancelled = true,
    cancelled_at = v_cancelled_at,
    cancelled_by = v_employee_name
  where fp.branch_id = p_branch_id
    and fp.contract_id = p_contract_id
    and coalesce(fp.is_cancelled, false) = false;

  get diagnostics v_cancelled_payments = row_count;

  update public.finance_contract_installments as fci
  set
    paid_amount = 0,
    remaining_amount = fci.amount,
    status = 'ملغاة',
    paid_at = null,
    updated_at = v_cancelled_at
  where fci.branch_id = p_branch_id
    and fci.contract_id = p_contract_id
    and fci.status <> 'ملغاة';

  select coalesce(ficws.contribution_amount, 0)
  into v_contracts_wallet_amount
  from public.finance_investor_contract_wallet_state as ficws
  where ficws.branch_id = p_branch_id
    and ficws.contract_id = p_contract_id;

  v_contracts_wallet_amount := coalesce(v_contracts_wallet_amount, 0);

  update public.finance_contracts as fc
  set
    paid_amount = 0,
    remaining_amount = 0,
    contract_status = 'ملغي',
    updated_at = v_cancelled_at
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
    created_at,
    old_values,
    new_values,
    changed_fields
  )
  values (
    p_branch_id,
    'إلغاء عقد',
    'تم إلغاء العقد وإلغاء دفعاته وإعادة البطاقات المرتبطة به',
    v_contract.customer_id,
    p_contract_id,
    coalesce(v_contract.customer_name, ''),
    v_employee_name,
    'ملغي',
    v_cancelled_at,
    jsonb_build_object(
      'contract_status', v_contract.contract_status,
      'paid_amount', v_contract.paid_amount,
      'remaining_amount', v_contract.remaining_amount
    ),
    jsonb_build_object(
      'contract_status', 'ملغي',
      'paid_amount', 0,
      'remaining_amount', 0,
      'cancelled_at', v_cancelled_at,
      'cancelled_by_user_id', p_employee_id,
      'cancelled_by_name', v_employee_name,
      'cancelled_payments_count', v_cancelled_payments,
      'returned_inventory_quantity', v_returned_quantity,
      'returned_inventory_cost', v_returned_cost,
      'reversed_cash_amount', v_reversed_cash,
      'removed_contracts_wallet_amount', v_contracts_wallet_amount
    ),
    array[
      'contract_status',
      'paid_amount',
      'remaining_amount',
      'cancelled_at',
      'cancelled_by_user_id',
      'cancelled_by_name',
      'cancelled_payments_count',
      'returned_inventory_quantity',
      'returned_inventory_cost',
      'reversed_cash_amount',
      'removed_contracts_wallet_amount'
    ]::text[]
  );

  return query
  select
    p_contract_id,
    'ملغي'::text,
    v_cancelled_payments,
    v_returned_quantity,
    v_returned_cost,
    v_reversed_cash,
    v_contracts_wallet_amount,
    v_cancelled_at;
end;
$$;

revoke all on function public.prevent_cancelled_contract_update()
  from public, anon, authenticated;
revoke all on function public.prevent_cancelled_contract_payment_change()
  from public, anon, authenticated;
revoke all on function public.prevent_cancelled_contract_installment_change()
  from public, anon, authenticated;
revoke all on function public.prevent_cancelled_contract_inventory_change()
  from public, anon, authenticated;
revoke all on function public.prevent_cancelled_contract_note_change()
  from public, anon, authenticated;

revoke all on function public.cancel_finance_contract_atomic(
  uuid,
  uuid,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.cancel_finance_contract_atomic(
  uuid,
  uuid,
  uuid,
  text
) to service_role;

comment on function public.cancel_finance_contract_atomic(
  uuid,
  uuid,
  uuid,
  text
) is 'إلغاء العقد ودفعاته وإعادة مخزونه وتكلفته التاريخية وعكس محافظه ذريًا.';

commit;
