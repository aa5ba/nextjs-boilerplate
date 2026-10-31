begin;

do $migration$
declare
  v_constraint_definition text;
begin
  select pg_get_constraintdef(pc.oid)
  into v_constraint_definition
  from pg_constraint as pc
  where pc.conrelid = 'public.finance_investor_wallet_transactions'::regclass
    and pc.conname = 'finance_investor_wallet_transactions_cash_type_chk';

  if v_constraint_definition is null then
    raise exception 'INVESTOR_WALLET_TRANSACTION_TYPE_CONSTRAINT_NOT_FOUND';
  end if;

  if v_constraint_definition not like '%sales_invoice_cash%'
     or v_constraint_definition not like '%sales_invoice_cancel_cash%'
  then
    alter table public.finance_investor_wallet_transactions
      drop constraint finance_investor_wallet_transactions_cash_type_chk;

    alter table public.finance_investor_wallet_transactions
      add constraint finance_investor_wallet_transactions_cash_type_chk check (
        transaction_type = any (
          array[
            'cash_deposit',
            'cash_withdrawal',
            'goods_opening_balance',
            'goods_purchase',
            'manual_goods_decrease',
            'goods_to_contract',
            'goods_return_from_contract',
            'contract_created',
            'contract_amount_adjustment',
            'contract_investor_transfer',
            'contract_payment_received',
            'payment_reversed',
            'contract_balance_reconciliation',
            'sales_invoice_sale',
            'sales_invoice_cash',
            'sales_invoice_cancel',
            'sales_invoice_cancel_cash',
            'purchase_invoice_cash',
            'purchase_invoice_goods',
            'purchase_invoice_cancel_cash',
            'purchase_invoice_cancel_goods'
          ]::text[]
        )
      );
  end if;
end;
$migration$;

do $migration$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(
    'public.create_purchase_sale_invoice_atomic(uuid,uuid,uuid,text,date,text,text,text,uuid,numeric,numeric,text)'::regprocedure
  )
  into v_definition;

  if v_definition is null then
    raise exception 'CREATE_PURCHASE_SALE_INVOICE_FUNCTION_NOT_FOUND';
  end if;

  if v_definition not like '%''sales_invoice_cash''%' then
    v_updated_definition := replace(
      v_definition,
      $old$
  else
    select *
    into v_goods_result
    from public.create_investor_wallet_transaction_internal(
      p_branch_id,
      v_inventory.investor_id,
      'goods',
      'debit',
      'sales_invoice_sale',$old$,
      $new$
  else
    select *
    into v_cash_result
    from public.create_investor_wallet_transaction_internal(
      p_branch_id,
      v_inventory.investor_id,
      'cash',
      'credit',
      'sales_invoice_cash',
      v_total_amount,
      'بيع مباشر – رقم الفاتورة ' || v_invoice_number::text,
      p_actor_user_id,
      v_actor_name,
      v_operation_id,
      v_inventory.product_id,
      null,
      v_movement_id,
      null,
      null,
      'purchase-sale-invoice:sale:cash:' || v_invoice_id::text,
      jsonb_build_object(
        'sales_invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'quantity', v_quantity,
        'sale_amount', v_total_amount,
        'payment_method', v_payment_method
      )
    );

    select *
    into v_goods_result
    from public.create_investor_wallet_transaction_internal(
      p_branch_id,
      v_inventory.investor_id,
      'goods',
      'debit',
      'sales_invoice_sale',$new$
    );

    if v_updated_definition = v_definition then
      raise exception 'CREATE_SALE_CASH_INSERTION_POINT_NOT_FOUND';
    end if;

    v_definition := v_updated_definition;
    v_updated_definition := replace(
      v_definition,
      $old$  if v_operation_type = 'purchase' then
    update public.finance_investor_wallet_transactions
    set sales_invoice_id = v_invoice_id
    where id = v_cash_result.transaction_id;
  end if;$old$,
      $new$  update public.finance_investor_wallet_transactions
  set sales_invoice_id = v_invoice_id
  where id = v_cash_result.transaction_id;$new$
    );

    if v_updated_definition = v_definition then
      raise exception 'CREATE_SALE_CASH_LINK_POINT_NOT_FOUND';
    end if;

    v_definition := v_updated_definition;
    v_updated_definition := replace(
      v_definition,
      $old$  if v_operation_type = 'purchase' then
    update public.finance_sales_invoices
    set
      cash_transaction_id = v_cash_result.transaction_id,
      cash_balance_after_operation = v_cash_result.balance_after,
      updated_at = now()
    where id = v_invoice_id;
  end if;$old$,
      $new$  update public.finance_sales_invoices
  set
    cash_transaction_id = v_cash_result.transaction_id,
    cash_balance_after_operation = v_cash_result.balance_after,
    updated_at = now()
  where id = v_invoice_id;$new$
    );

    if v_updated_definition = v_definition then
      raise exception 'CREATE_SALE_CASH_SNAPSHOT_POINT_NOT_FOUND';
    end if;

    v_definition := v_updated_definition;
    v_updated_definition := replace(
      v_definition,
      $old$  else
    return query
    select
      v_invoice_id,
      v_invoice_number,
      v_operation_type,
      true,
      v_after_quantity,
      v_goods_result.balance_after::numeric,
      null::numeric;
  end if;$old$,
      $new$  else
    return query
    select
      v_invoice_id,
      v_invoice_number,
      v_operation_type,
      true,
      v_after_quantity,
      v_goods_result.balance_after::numeric,
      v_cash_result.balance_after::numeric;
  end if;$new$
    );

    if v_updated_definition = v_definition then
      raise exception 'CREATE_SALE_CASH_RETURN_POINT_NOT_FOUND';
    end if;

    execute v_updated_definition;
  end if;

  select pg_get_functiondef(
    'public.cancel_purchase_sale_invoice_atomic(uuid,uuid,uuid,uuid,text)'::regprocedure
  )
  into v_definition;

  if v_definition is null then
    raise exception 'CANCEL_PURCHASE_SALE_INVOICE_FUNCTION_NOT_FOUND';
  end if;

  if v_definition not like '%''sales_invoice_cancel_cash''%' then
    v_updated_definition := replace(
      v_definition,
      $old$      jsonb_build_object(
        'sales_invoice_id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'quantity', v_invoice.quantity,
        'historical_unit_cost', v_invoice.sale_unit_cost
      )
    );
  end if;

  update public.finance_investor_wallet_transactions
  set sales_invoice_id = v_invoice.id
  where id = v_goods_result.transaction_id;$old$,
      $new$      jsonb_build_object(
        'sales_invoice_id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'quantity', v_invoice.quantity,
        'historical_unit_cost', v_invoice.sale_unit_cost
      )
    );

    if v_invoice.cash_transaction_id is not null then
      select *
      into v_cash_result
      from public.create_investor_wallet_transaction_internal(
        p_branch_id,
        v_invoice.investor_id,
        'cash',
        'debit',
        'sales_invoice_cancel_cash',
        v_invoice.total_amount,
        'إلغاء بيع مباشر – رقم الفاتورة ' || v_invoice.invoice_number::text,
        p_actor_user_id,
        v_actor_name,
        v_operation_id,
        v_invoice.product_id,
        null,
        v_movement_id,
        null,
        v_invoice.cash_transaction_id,
        'purchase-sale-invoice:cancel:sale:cash:' || v_invoice.id::text,
        jsonb_build_object(
          'sales_invoice_id', v_invoice.id,
          'invoice_number', v_invoice.invoice_number,
          'quantity', v_invoice.quantity,
          'sale_amount', v_invoice.total_amount,
          'payment_method', v_invoice.payment_method
        )
      );
    end if;
  end if;

  update public.finance_investor_wallet_transactions
  set sales_invoice_id = v_invoice.id
  where id = v_goods_result.transaction_id;$new$
    );

    if v_updated_definition = v_definition then
      raise exception 'CANCEL_SALE_CASH_INSERTION_POINT_NOT_FOUND';
    end if;

    v_definition := v_updated_definition;
    v_updated_definition := replace(
      v_definition,
      $old$  if v_invoice.operation_type = 'purchase' then
    update public.finance_investor_wallet_transactions
    set sales_invoice_id = v_invoice.id
    where id = v_cash_result.transaction_id;
  end if;$old$,
      $new$  if v_invoice.operation_type = 'purchase'
     or v_invoice.cash_transaction_id is not null
  then
    update public.finance_investor_wallet_transactions
    set sales_invoice_id = v_invoice.id
    where id = v_cash_result.transaction_id;
  end if;$new$
    );

    if v_updated_definition = v_definition then
      raise exception 'CANCEL_SALE_CASH_LINK_POINT_NOT_FOUND';
    end if;

    v_definition := v_updated_definition;
    v_updated_definition := replace(
      v_definition,
      $old$  if v_invoice.operation_type = 'purchase' then
    update public.finance_sales_invoices
    set
      status = 'cancelled',$old$,
      $new$  if v_invoice.operation_type = 'purchase'
     or v_invoice.cash_transaction_id is not null
  then
    update public.finance_sales_invoices
    set
      status = 'cancelled',$new$
    );

    if v_updated_definition = v_definition then
      raise exception 'CANCEL_SALE_CASH_SNAPSHOT_BRANCH_NOT_FOUND';
    end if;

    v_definition := v_updated_definition;
    v_updated_definition := replace(
      v_definition,
      $old$  if v_invoice.operation_type = 'purchase' then
    return query
    select
      v_invoice.id,
      v_invoice.invoice_number,
      v_invoice.operation_type,
      true,
      v_after_quantity,
      v_goods_result.balance_after::numeric,
      v_cash_result.balance_after::numeric;
  else$old$,
      $new$  if v_invoice.operation_type = 'purchase'
     or v_invoice.cash_transaction_id is not null
  then
    return query
    select
      v_invoice.id,
      v_invoice.invoice_number,
      v_invoice.operation_type,
      true,
      v_after_quantity,
      v_goods_result.balance_after::numeric,
      v_cash_result.balance_after::numeric;
  else$new$
    );

    if v_updated_definition = v_definition then
      raise exception 'CANCEL_SALE_CASH_RETURN_BRANCH_NOT_FOUND';
    end if;

    execute v_updated_definition;
  end if;
end;
$migration$;

commit;
