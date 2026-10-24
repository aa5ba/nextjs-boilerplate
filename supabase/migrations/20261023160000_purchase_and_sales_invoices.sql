begin;

alter table public.finance_sales_invoices
  add column operation_type text not null default 'sale',
  add column inventory_quantity_before_operation numeric(18, 6),
  add column inventory_total_cost_before_operation numeric(18, 6),
  add column inventory_average_cost_before_operation numeric(18, 6),
  add column inventory_total_cost_after_operation numeric(18, 6),
  add column inventory_average_cost_after_operation numeric(18, 6),
  add column cash_transaction_id uuid,
  add column cash_balance_after_operation numeric(18, 6),
  add column cancellation_cash_transaction_id uuid,
  add column cash_balance_after_cancellation numeric(18, 6);

alter table public.finance_sales_invoices
  add constraint finance_sales_invoices_operation_type_chk
  check (operation_type = any (array['sale', 'purchase']::text[])),
  add constraint finance_sales_invoices_cash_transaction_fkey
  foreign key (cash_transaction_id)
  references public.finance_investor_wallet_transactions(id)
  on delete restrict,
  add constraint finance_sales_invoices_cancel_cash_transaction_fkey
  foreign key (cancellation_cash_transaction_id)
  references public.finance_investor_wallet_transactions(id)
  on delete restrict;

alter table public.finance_inventory_movements
  add column movement_sequence bigint generated always as identity;

create unique index finance_inventory_movements_sequence_key
  on public.finance_inventory_movements (movement_sequence);

alter table public.finance_sales_invoices
  drop constraint finance_sales_invoices_cancellation_chk;

alter table public.finance_sales_invoices
  add constraint finance_sales_invoices_cancellation_chk check (
    (
      status = 'active'
      and cancellation_request_id is null
      and cancellation_fingerprint is null
      and cancellation_reason is null
      and cancelled_at is null
      and cancelled_by_user_id is null
      and cancelled_by_name is null
      and cancellation_operation_id is null
      and cancellation_inventory_movement_id is null
      and cancellation_goods_transaction_id is null
      and cancellation_cash_transaction_id is null
      and inventory_quantity_after_cancellation is null
      and goods_balance_after_cancellation is null
      and cash_balance_after_cancellation is null
    )
    or
    (
      status = 'cancelled'
      and cancellation_request_id is not null
      and cancellation_fingerprint is not null
      and cancellation_reason is not null
      and cancelled_at is not null
      and cancelled_by_user_id is not null
      and cancelled_by_name is not null
      and cancellation_operation_id is not null
      and cancellation_inventory_movement_id is not null
      and cancellation_goods_transaction_id is not null
      and inventory_quantity_after_cancellation is not null
      and goods_balance_after_cancellation is not null
      and (
        (
          operation_type = 'sale'
          and cancellation_cash_transaction_id is null
          and cash_balance_after_cancellation is null
        )
        or
        (
          operation_type = 'purchase'
          and cancellation_cash_transaction_id is not null
          and cash_balance_after_cancellation is not null
        )
      )
    )
  );

alter table public.finance_sales_invoices
  add constraint finance_sales_invoices_purchase_snapshot_chk check (
    operation_type = 'sale'
    or (
      inventory_quantity_before_operation is not null
      and inventory_total_cost_before_operation is not null
      and inventory_total_cost_after_operation is not null
      and inventory_average_cost_after_operation is not null
    )
  );

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
        'sales_invoice_cancel',
        'purchase_invoice_cash',
        'purchase_invoice_goods',
        'purchase_invoice_cancel_cash',
        'purchase_invoice_cancel_goods'
      ]::text[]
    )
  );

insert into public.finance_permission_catalog (
  permission_key,
  permission_name,
  section_key,
  section_name,
  sort_order,
  is_sensitive,
  allowed_for_employee,
  allowed_for_branch_manager,
  allowed_for_investor,
  is_active
)
values
  ('purchase_invoice_create', 'إنشاء فاتورة شراء', 'purchase_sales_invoices', 'شراء وبيع', 625, true, true, true, false, true)
on conflict (permission_key)
do update set
  permission_name = excluded.permission_name,
  section_key = excluded.section_key,
  section_name = excluded.section_name,
  sort_order = excluded.sort_order,
  is_sensitive = excluded.is_sensitive,
  allowed_for_employee = excluded.allowed_for_employee,
  allowed_for_branch_manager = excluded.allowed_for_branch_manager,
  allowed_for_investor = excluded.allowed_for_investor,
  is_active = excluded.is_active,
  updated_at = now();

update public.finance_permission_catalog
set
  permission_name = case permission_key
    when 'sales_invoice_view' then 'عرض فواتير الشراء والبيع'
    when 'sales_invoice_print' then 'طباعة فواتير الشراء والبيع'
    when 'sales_invoice_cancel' then 'إلغاء فواتير الشراء والبيع'
    else permission_name
  end,
  section_key = 'purchase_sales_invoices',
  section_name = 'شراء وبيع',
  updated_at = now()
where permission_key = any (
  array[
    'sales_invoice_view',
    'sales_invoice_create',
    'sales_invoice_print',
    'sales_invoice_cancel'
  ]::text[]
);

create or replace function public.finance_manager_required_permissions()
returns text[]
language sql
immutable
set search_path to 'public'
as $function$
  select array[
    'workflow',
    'follow_up',
    'customers',
    'customers_create',
    'customers_edit',
    'customers_verify',
    'contracts',
    'contracts_create',
    'contracts_edit',
    'contracts_close',
    'archive',
    'payments',
    'payments_create',
    'payments_cancel',
    'inventory',
    'add_inventory',
    'add_product',
    'edit_product',
    'toggle_product',
    'add_investor',
    'toggle_investor',
    'notes',
    'expenses',
    'print',
    'promissory_note_view',
    'promissory_note_create',
    'settings',
    'permissions',
    'sales_invoice_view',
    'sales_invoice_create',
    'purchase_invoice_create',
    'sales_invoice_print',
    'sales_invoice_cancel'
  ]::text[];
$function$;

update public.finance_branch_users
set
  permissions = (
    select coalesce(
      array_agg(distinct permission_key order by permission_key),
      array[]::text[]
    )
    from unnest(
      coalesce(finance_branch_users.permissions, array[]::text[])
      || public.finance_manager_required_permissions()
    ) as manager_permissions(permission_key)
  ),
  permissions_version = permissions_version + 1,
  updated_at = now()
where btrim(coalesce(role, '')) = any (
  array[
    'main_admin',
    'branch_manager',
    'admin',
    'manager',
    'مدير فرع',
    'مدير رئيسي',
    'مدير'
  ]::text[]
);

create or replace function public.create_purchase_sale_invoice_atomic(
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
  p_operation_type text,
  p_invoice_date date,
  p_customer_name text,
  p_customer_national_id text,
  p_customer_phone text,
  p_inventory_id uuid,
  p_quantity numeric,
  p_total_amount numeric,
  p_payment_method text
)
returns table (
  invoice_id uuid,
  invoice_number bigint,
  operation_type text,
  was_created boolean,
  inventory_quantity_after numeric,
  goods_balance_after numeric,
  cash_balance_after numeric
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor public.finance_branch_users%rowtype;
  v_branch public.finance_branches%rowtype;
  v_inventory public.finance_inventory%rowtype;
  v_existing public.finance_sales_invoices%rowtype;
  v_product_name text;
  v_investor_name text;
  v_customer_name text;
  v_customer_national_id text;
  v_customer_phone text;
  v_payment_method text;
  v_operation_type text;
  v_required_permission text;
  v_quantity numeric;
  v_total_amount numeric;
  v_before_quantity numeric;
  v_after_quantity numeric;
  v_before_total_cost numeric;
  v_after_total_cost numeric;
  v_before_average_cost numeric;
  v_after_average_cost numeric;
  v_operation_total_cost numeric;
  v_operation_unit_cost numeric;
  v_request_fingerprint text;
  v_invoice_id uuid := gen_random_uuid();
  v_invoice_number bigint;
  v_operation_id uuid := gen_random_uuid();
  v_movement_id uuid;
  v_goods_result record;
  v_cash_result record;
  v_actor_name text;
  v_action_name text;
begin
  select fbu.*
  into v_actor
  from public.finance_branch_users as fbu
  where fbu.id = p_actor_user_id
    and fbu.branch_id = p_branch_id
    and fbu.is_active = true
    and coalesce(fbu.self_disabled, false) = false
    and fbu.disabled_at is null
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_SESSION';
  end if;

  v_operation_type := lower(btrim(coalesce(p_operation_type, '')));

  if v_operation_type not in ('sale', 'purchase') then
    raise exception using errcode = 'P0001', message = 'INVALID_OPERATION_TYPE';
  end if;

  v_required_permission := case
    when v_operation_type = 'purchase' then 'purchase_invoice_create'
    else 'sales_invoice_create'
  end;

  if not public.finance_user_has_permission(
    p_branch_id,
    p_actor_user_id,
    v_required_permission
  ) then
    raise exception using errcode = 'P0001', message = 'MISSING_PERMISSION';
  end if;

  select fb.*
  into v_branch
  from public.finance_branches as fb
  where fb.id = p_branch_id
    and coalesce(fb.is_active, false) = true
    and coalesce(fb.is_deleted, false) = false
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'BRANCH_NOT_FOUND';
  end if;

  if p_request_id is null then
    raise exception using errcode = 'P0001', message = 'REQUEST_ID_REQUIRED';
  end if;

  v_customer_name := nullif(btrim(coalesce(p_customer_name, '')), '');
  v_customer_national_id := regexp_replace(coalesce(p_customer_national_id, ''), '[^0-9]', '', 'g');
  v_customer_phone := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g');
  v_payment_method := btrim(coalesce(p_payment_method, ''));
  v_quantity := round(coalesce(p_quantity, 0), 6);
  v_total_amount := round(coalesce(p_total_amount, 0), 2);
  v_actor_name := coalesce(nullif(btrim(v_actor.full_name), ''), nullif(btrim(v_actor.username), ''), 'الموظف');
  v_action_name := case when v_operation_type = 'purchase' then 'شراء' else 'بيع' end;

  if v_customer_name is null or char_length(v_customer_name) > 150 then
    raise exception using errcode = 'P0001', message = 'INVALID_CUSTOMER_NAME';
  end if;

  if v_customer_national_id !~ '^[0-9]{10}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_CUSTOMER_NATIONAL_ID';
  end if;

  if v_customer_phone !~ '^05[0-9]{8}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_CUSTOMER_PHONE';
  end if;

  if p_invoice_date is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INVOICE_DATE';
  end if;

  if v_quantity <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_QUANTITY';
  end if;

  if v_total_amount <= 0 then
    raise exception using errcode = 'P0001', message = 'INVALID_TOTAL_AMOUNT';
  end if;

  if v_payment_method <> all (array['شبكة', 'تحويل', 'نقدًا', 'تابي', 'تمارا', 'إمكان']::text[]) then
    raise exception using errcode = 'P0001', message = 'INVALID_PAYMENT_METHOD';
  end if;

  v_request_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'operation_type', v_operation_type,
        'invoice_date', p_invoice_date,
        'customer_name', v_customer_name,
        'customer_national_id', v_customer_national_id,
        'customer_phone', v_customer_phone,
        'inventory_id', p_inventory_id,
        'quantity', v_quantity,
        'total_amount', v_total_amount,
        'payment_method', v_payment_method
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text || ':purchase-sale-invoice-request:' || p_request_id::text,
      0
    )
  );

  select fsi.*
  into v_existing
  from public.finance_sales_invoices as fsi
  where fsi.branch_id = p_branch_id
    and fsi.request_id = p_request_id
  limit 1;

  if found then
    if v_existing.request_fingerprint <> v_request_fingerprint then
      raise exception using errcode = 'P0001', message = 'REQUEST_ID_PAYLOAD_MISMATCH';
    end if;

    return query
    select
      v_existing.id,
      v_existing.invoice_number,
      v_existing.operation_type,
      false,
      v_existing.inventory_quantity_after_sale,
      v_existing.goods_balance_after_sale,
      v_existing.cash_balance_after_operation;
    return;
  end if;

  select fi.*
  into v_inventory
  from public.finance_inventory as fi
  join public.finance_products as fp
    on fp.id = fi.product_id
    and fp.branch_id = fi.branch_id
    and coalesce(fp.is_active, false) = true
  join public.finance_investors as finv
    on finv.id = fi.investor_id
    and finv.branch_id = fi.branch_id
    and coalesce(finv.is_active, false) = true
    and coalesce(finv.is_archived, false) = false
  where fi.id = p_inventory_id
    and fi.branch_id = p_branch_id
  for update of fi;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVENTORY_NOT_FOUND';
  end if;

  select fp.product_name, finv.investor_name
  into v_product_name, v_investor_name
  from public.finance_products as fp
  join public.finance_investors as finv
    on finv.id = v_inventory.investor_id
    and finv.branch_id = p_branch_id
  where fp.id = v_inventory.product_id
    and fp.branch_id = p_branch_id;

  v_before_quantity := round(coalesce(v_inventory.quantity, 0), 6);
  v_before_total_cost := round(coalesce(v_inventory.total_cost_value, 0), 6);
  v_before_average_cost := case
    when v_inventory.average_unit_cost is null then null
    else round(v_inventory.average_unit_cost, 6)
  end;

  if v_operation_type = 'sale' then
    if v_before_quantity < v_quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_GOODS_QUANTITY';
    end if;

    if v_before_average_cost is null
       or v_inventory.cost_initialized_at is null
       or v_before_total_cost <= 0
    then
      raise exception using errcode = 'P0001', message = 'GOODS_COST_NOT_INITIALIZED';
    end if;

    if v_quantity = v_before_quantity then
      v_operation_total_cost := v_before_total_cost;
      v_after_quantity := 0;
      v_after_total_cost := 0;
      v_after_average_cost := null;
    else
      v_operation_total_cost := round(v_before_total_cost * (v_quantity / v_before_quantity), 6);
      v_after_quantity := round(v_before_quantity - v_quantity, 6);
      v_after_total_cost := greatest(round(v_before_total_cost - v_operation_total_cost, 6), 0);
      v_after_average_cost := round(v_after_total_cost / v_after_quantity, 6);
    end if;

    if v_operation_total_cost <= 0 then
      raise exception using errcode = 'P0001', message = 'GOODS_COST_NOT_INITIALIZED';
    end if;

    v_operation_unit_cost := round(v_operation_total_cost / v_quantity, 6);
  else
    v_operation_total_cost := round(v_total_amount, 6);
    v_operation_unit_cost := round(v_operation_total_cost / v_quantity, 6);
    v_after_quantity := round(v_before_quantity + v_quantity, 6);
    v_after_total_cost := round(v_before_total_cost + v_operation_total_cost, 6);
    v_after_average_cost := round(v_after_total_cost / v_after_quantity, 6);

    if v_before_quantity > 0
       and (
         v_before_average_cost is null
         or v_inventory.cost_initialized_at is null
       )
    then
      raise exception using errcode = 'P0001', message = 'GOODS_COST_NOT_INITIALIZED';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_branch_id::text || ':sales-invoice-number', 0)
  );

  select coalesce(max(fsi.invoice_number), 0) + 1
  into v_invoice_number
  from public.finance_sales_invoices as fsi
  where fsi.branch_id = p_branch_id;

  insert into public.finance_branch_sequences (
    branch_id,
    sequence_type,
    last_number
  )
  values (p_branch_id, 'sales_invoice', v_invoice_number)
  on conflict (branch_id, sequence_type)
  do update set
    last_number = greatest(
      public.finance_branch_sequences.last_number + 1,
      excluded.last_number
    ),
    updated_at = now()
  returning last_number into v_invoice_number;

  insert into public.finance_sales_invoices (
    id,
    branch_id,
    invoice_number,
    invoice_date,
    organization_name,
    customer_name,
    customer_national_id,
    customer_phone,
    inventory_id,
    product_id,
    product_name,
    investor_id,
    investor_name,
    quantity,
    total_amount,
    payment_method,
    sale_unit_cost,
    sale_total_cost,
    request_id,
    request_fingerprint,
    created_by_user_id,
    created_by_name,
    sale_operation_id,
    inventory_quantity_after_sale,
    goods_balance_after_sale,
    operation_type,
    inventory_quantity_before_operation,
    inventory_total_cost_before_operation,
    inventory_average_cost_before_operation,
    inventory_total_cost_after_operation,
    inventory_average_cost_after_operation
  )
  values (
    v_invoice_id,
    p_branch_id,
    v_invoice_number,
    p_invoice_date,
    coalesce(nullif(btrim(v_branch.organization_name), ''), nullif(btrim(v_branch.branch_name), ''), 'احتساب'),
    v_customer_name,
    v_customer_national_id,
    v_customer_phone,
    v_inventory.id,
    v_inventory.product_id,
    v_product_name,
    v_inventory.investor_id,
    v_investor_name,
    v_quantity,
    v_total_amount,
    v_payment_method,
    v_operation_unit_cost,
    v_operation_total_cost,
    p_request_id,
    v_request_fingerprint,
    p_actor_user_id,
    v_actor_name,
    v_operation_id,
    v_after_quantity,
    0,
    v_operation_type,
    v_before_quantity,
    v_before_total_cost,
    v_before_average_cost,
    v_after_total_cost,
    v_after_average_cost
  );

  insert into public.finance_inventory_movements (
    branch_id,
    investor_id,
    product_id,
    sales_invoice_id,
    movement_type,
    quantity,
    before_quantity,
    after_quantity,
    notes,
    created_by
  )
  values (
    p_branch_id,
    v_inventory.investor_id,
    v_inventory.product_id,
    v_invoice_id,
    case when v_operation_type = 'purchase' then 'شراء مباشر' else 'بيع مباشر' end,
    v_quantity,
    v_before_quantity,
    v_after_quantity,
    v_action_name || ' مباشر – رقم الفاتورة ' || v_invoice_number::text,
    v_actor_name
  )
  returning id into v_movement_id;

  if v_operation_type = 'purchase' then
    select *
    into v_cash_result
    from public.create_investor_wallet_transaction_internal(
      p_branch_id,
      v_inventory.investor_id,
      'cash',
      'debit',
      'purchase_invoice_cash',
      v_operation_total_cost,
      'شراء مباشر – رقم الفاتورة ' || v_invoice_number::text,
      p_actor_user_id,
      v_actor_name,
      v_operation_id,
      v_inventory.product_id,
      null,
      v_movement_id,
      null,
      null,
      'purchase-sale-invoice:purchase:cash:' || v_invoice_id::text,
      jsonb_build_object(
        'sales_invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'quantity', v_quantity,
        'unit_cost', v_operation_unit_cost
      )
    );

    select *
    into v_goods_result
    from public.create_investor_wallet_transaction_internal(
      p_branch_id,
      v_inventory.investor_id,
      'goods',
      'credit',
      'purchase_invoice_goods',
      v_operation_total_cost,
      'شراء مباشر – رقم الفاتورة ' || v_invoice_number::text,
      p_actor_user_id,
      v_actor_name,
      v_operation_id,
      v_inventory.product_id,
      null,
      v_movement_id,
      null,
      null,
      'purchase-sale-invoice:purchase:goods:' || v_invoice_id::text,
      jsonb_build_object(
        'sales_invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'quantity', v_quantity,
        'unit_cost', v_operation_unit_cost
      )
    );
  else
    select *
    into v_goods_result
    from public.create_investor_wallet_transaction_internal(
      p_branch_id,
      v_inventory.investor_id,
      'goods',
      'debit',
      'sales_invoice_sale',
      v_operation_total_cost,
      'بيع مباشر – رقم الفاتورة ' || v_invoice_number::text,
      p_actor_user_id,
      v_actor_name,
      v_operation_id,
      v_inventory.product_id,
      null,
      v_movement_id,
      null,
      null,
      'purchase-sale-invoice:sale:goods:' || v_invoice_id::text,
      jsonb_build_object(
        'sales_invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'quantity', v_quantity,
        'unit_cost', v_operation_unit_cost
      )
    );
  end if;

  update public.finance_investor_wallet_transactions
  set sales_invoice_id = v_invoice_id
  where id = v_goods_result.transaction_id;

  if v_operation_type = 'purchase' then
    update public.finance_investor_wallet_transactions
    set sales_invoice_id = v_invoice_id
    where id = v_cash_result.transaction_id;
  end if;

  update public.finance_inventory
  set
    quantity = v_after_quantity,
    total_cost_value = v_after_total_cost,
    average_unit_cost = v_after_average_cost,
    cost_initialized_at = case
      when v_operation_type = 'purchase' then coalesce(cost_initialized_at, now())
      else cost_initialized_at
    end,
    cost_initialized_by = case
      when v_operation_type = 'purchase' then coalesce(cost_initialized_by, p_actor_user_id)
      else cost_initialized_by
    end,
    updated_at = now()
  where id = v_inventory.id;

  insert into public.finance_investor_goods_transaction_details (
    transaction_id,
    operation_id,
    branch_id,
    investor_id,
    product_id,
    sales_invoice_id,
    quantity_delta,
    quantity_before,
    quantity_after,
    unit_cost,
    value_delta,
    inventory_movement_id
  )
  values (
    v_goods_result.transaction_id,
    v_operation_id,
    p_branch_id,
    v_inventory.investor_id,
    v_inventory.product_id,
    v_invoice_id,
    case when v_operation_type = 'purchase' then v_quantity else -v_quantity end,
    v_before_quantity,
    v_after_quantity,
    v_operation_unit_cost,
    case when v_operation_type = 'purchase' then v_operation_total_cost else -v_operation_total_cost end,
    v_movement_id
  );

  update public.finance_sales_invoices
  set
    sale_inventory_movement_id = v_movement_id,
    sale_goods_transaction_id = v_goods_result.transaction_id,
    goods_balance_after_sale = v_goods_result.balance_after,
    updated_at = now()
  where id = v_invoice_id;

  if v_operation_type = 'purchase' then
    update public.finance_sales_invoices
    set
      cash_transaction_id = v_cash_result.transaction_id,
      cash_balance_after_operation = v_cash_result.balance_after,
      updated_at = now()
    where id = v_invoice_id;
  end if;

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    employee_name,
    status
  )
  values (
    p_branch_id,
    'إنشاء فاتورة ' || v_action_name,
    'تم إنشاء فاتورة ' || v_action_name || ' رقم ' || v_invoice_number::text,
    v_actor_name,
    'نشط'
  );

  if v_operation_type = 'purchase' then
    return query
    select
      v_invoice_id,
      v_invoice_number,
      v_operation_type,
      true,
      v_after_quantity,
      v_goods_result.balance_after::numeric,
      v_cash_result.balance_after::numeric;
  else
    return query
    select
      v_invoice_id,
      v_invoice_number,
      v_operation_type,
      true,
      v_after_quantity,
      v_goods_result.balance_after::numeric,
      null::numeric;
  end if;
end;
$function$;

create or replace function public.cancel_purchase_sale_invoice_atomic(
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_cancellation_request_id uuid,
  p_reason text
)
returns table (
  invoice_id uuid,
  invoice_number bigint,
  operation_type text,
  was_cancelled boolean,
  inventory_quantity_after numeric,
  goods_balance_after numeric,
  cash_balance_after numeric
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor public.finance_branch_users%rowtype;
  v_invoice public.finance_sales_invoices%rowtype;
  v_existing public.finance_sales_invoices%rowtype;
  v_inventory public.finance_inventory%rowtype;
  v_reason text;
  v_fingerprint text;
  v_actor_name text;
  v_action_name text;
  v_operation_id uuid := gen_random_uuid();
  v_before_quantity numeric;
  v_after_quantity numeric;
  v_before_total_cost numeric;
  v_after_total_cost numeric;
  v_after_average_cost numeric;
  v_source_movement_sequence bigint;
  v_movement_id uuid;
  v_goods_result record;
  v_cash_result record;
begin
  select fbu.*
  into v_actor
  from public.finance_branch_users as fbu
  where fbu.id = p_actor_user_id
    and fbu.branch_id = p_branch_id
    and fbu.is_active = true
    and coalesce(fbu.self_disabled, false) = false
    and fbu.disabled_at is null
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVALID_SESSION';
  end if;

  if not public.finance_user_has_permission(
    p_branch_id,
    p_actor_user_id,
    'sales_invoice_cancel'
  ) then
    raise exception using errcode = 'P0001', message = 'MISSING_PERMISSION';
  end if;

  if p_invoice_id is null or p_cancellation_request_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_CANCELLATION_REQUEST';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  v_actor_name := coalesce(nullif(btrim(v_actor.full_name), ''), nullif(btrim(v_actor.username), ''), 'الموظف');

  if v_reason is null or char_length(v_reason) > 500 then
    raise exception using errcode = 'P0001', message = 'CANCELLATION_REASON_REQUIRED';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      jsonb_build_object('invoice_id', p_invoice_id, 'reason', v_reason)::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text || ':purchase-sale-invoice-cancel:' || p_cancellation_request_id::text,
      0
    )
  );

  select fsi.*
  into v_existing
  from public.finance_sales_invoices as fsi
  where fsi.branch_id = p_branch_id
    and fsi.cancellation_request_id = p_cancellation_request_id
  limit 1;

  if found then
    if v_existing.id <> p_invoice_id
       or v_existing.cancellation_fingerprint <> v_fingerprint
    then
      raise exception using errcode = 'P0001', message = 'CANCELLATION_REQUEST_PAYLOAD_MISMATCH';
    end if;

    return query
    select
      v_existing.id,
      v_existing.invoice_number,
      v_existing.operation_type,
      false,
      v_existing.inventory_quantity_after_cancellation,
      v_existing.goods_balance_after_cancellation,
      v_existing.cash_balance_after_cancellation;
    return;
  end if;

  select fsi.*
  into v_invoice
  from public.finance_sales_invoices as fsi
  where fsi.id = p_invoice_id
    and fsi.branch_id = p_branch_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'SALES_INVOICE_NOT_FOUND';
  end if;

  if v_invoice.status = 'cancelled' then
    raise exception using errcode = 'P0001', message = 'SALES_INVOICE_ALREADY_CANCELLED';
  end if;

  select fi.*
  into v_inventory
  from public.finance_inventory as fi
  where fi.id = v_invoice.inventory_id
    and fi.branch_id = p_branch_id
    and fi.investor_id = v_invoice.investor_id
    and fi.product_id = v_invoice.product_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVENTORY_NOT_FOUND';
  end if;

  v_before_quantity := round(coalesce(v_inventory.quantity, 0), 6);
  v_before_total_cost := round(coalesce(v_inventory.total_cost_value, 0), 6);
  v_action_name := case when v_invoice.operation_type = 'purchase' then 'شراء' else 'بيع' end;

  if v_invoice.operation_type = 'purchase' then
    select fim.movement_sequence
    into v_source_movement_sequence
    from public.finance_inventory_movements as fim
    where fim.id = v_invoice.sale_inventory_movement_id
      and fim.branch_id = p_branch_id
      and fim.sales_invoice_id = v_invoice.id;

    if v_source_movement_sequence is null
       or exists (
         select 1
         from public.finance_inventory_movements as later_movement
         where later_movement.branch_id = p_branch_id
           and later_movement.investor_id = v_invoice.investor_id
           and later_movement.product_id = v_invoice.product_id
           and later_movement.movement_sequence > v_source_movement_sequence
       )
       or v_before_quantity <> round(v_invoice.inventory_quantity_after_sale, 6)
       or v_before_total_cost <> round(v_invoice.inventory_total_cost_after_operation, 6)
    then
      raise exception using
        errcode = 'P0001',
        message = 'PURCHASE_CANCELLATION_BLOCKED_BY_LATER_MOVEMENT';
    end if;

    v_after_quantity := round(v_invoice.inventory_quantity_before_operation, 6);
    v_after_total_cost := round(v_invoice.inventory_total_cost_before_operation, 6);
    v_after_average_cost := case
      when v_invoice.inventory_average_cost_before_operation is null then null
      else round(v_invoice.inventory_average_cost_before_operation, 6)
    end;
  else
    v_after_quantity := round(v_before_quantity + v_invoice.quantity, 6);
    v_after_total_cost := round(v_before_total_cost + v_invoice.sale_total_cost, 6);
    v_after_average_cost := round(v_after_total_cost / v_after_quantity, 6);
  end if;

  insert into public.finance_inventory_movements (
    branch_id,
    investor_id,
    product_id,
    sales_invoice_id,
    movement_type,
    quantity,
    before_quantity,
    after_quantity,
    notes,
    created_by
  )
  values (
    p_branch_id,
    v_invoice.investor_id,
    v_invoice.product_id,
    v_invoice.id,
    case
      when v_invoice.operation_type = 'purchase' then 'إلغاء شراء مباشر'
      else 'إلغاء بيع مباشر'
    end,
    v_invoice.quantity,
    v_before_quantity,
    v_after_quantity,
    'إلغاء ' || v_action_name || ' مباشر – رقم الفاتورة ' || v_invoice.invoice_number::text || ' – ' || v_reason,
    v_actor_name
  )
  returning id into v_movement_id;

  if v_invoice.operation_type = 'purchase' then
    select *
    into v_goods_result
    from public.create_investor_wallet_transaction_internal(
      p_branch_id,
      v_invoice.investor_id,
      'goods',
      'debit',
      'purchase_invoice_cancel_goods',
      v_invoice.sale_total_cost,
      'إلغاء شراء مباشر – رقم الفاتورة ' || v_invoice.invoice_number::text,
      p_actor_user_id,
      v_actor_name,
      v_operation_id,
      v_invoice.product_id,
      null,
      v_movement_id,
      null,
      v_invoice.sale_goods_transaction_id,
      'purchase-sale-invoice:cancel:purchase:goods:' || v_invoice.id::text,
      jsonb_build_object(
        'sales_invoice_id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'quantity', v_invoice.quantity,
        'historical_unit_cost', v_invoice.sale_unit_cost
      )
    );

    select *
    into v_cash_result
    from public.create_investor_wallet_transaction_internal(
      p_branch_id,
      v_invoice.investor_id,
      'cash',
      'credit',
      'purchase_invoice_cancel_cash',
      v_invoice.sale_total_cost,
      'إلغاء شراء مباشر – رقم الفاتورة ' || v_invoice.invoice_number::text,
      p_actor_user_id,
      v_actor_name,
      v_operation_id,
      v_invoice.product_id,
      null,
      v_movement_id,
      null,
      v_invoice.cash_transaction_id,
      'purchase-sale-invoice:cancel:purchase:cash:' || v_invoice.id::text,
      jsonb_build_object(
        'sales_invoice_id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'quantity', v_invoice.quantity,
        'historical_unit_cost', v_invoice.sale_unit_cost
      )
    );
  else
    select *
    into v_goods_result
    from public.create_investor_wallet_transaction_internal(
      p_branch_id,
      v_invoice.investor_id,
      'goods',
      'credit',
      'sales_invoice_cancel',
      v_invoice.sale_total_cost,
      'إلغاء بيع مباشر – رقم الفاتورة ' || v_invoice.invoice_number::text,
      p_actor_user_id,
      v_actor_name,
      v_operation_id,
      v_invoice.product_id,
      null,
      v_movement_id,
      null,
      v_invoice.sale_goods_transaction_id,
      'purchase-sale-invoice:cancel:sale:goods:' || v_invoice.id::text,
      jsonb_build_object(
        'sales_invoice_id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'quantity', v_invoice.quantity,
        'historical_unit_cost', v_invoice.sale_unit_cost
      )
    );
  end if;

  update public.finance_investor_wallet_transactions
  set sales_invoice_id = v_invoice.id
  where id = v_goods_result.transaction_id;

  if v_invoice.operation_type = 'purchase' then
    update public.finance_investor_wallet_transactions
    set sales_invoice_id = v_invoice.id
    where id = v_cash_result.transaction_id;
  end if;

  update public.finance_inventory
  set
    quantity = v_after_quantity,
    total_cost_value = v_after_total_cost,
    average_unit_cost = v_after_average_cost,
    cost_initialized_at = case
      when v_after_quantity = 0 then null
      else coalesce(cost_initialized_at, now())
    end,
    cost_initialized_by = case
      when v_after_quantity = 0 then null
      else cost_initialized_by
    end,
    updated_at = now()
  where id = v_inventory.id;

  insert into public.finance_investor_goods_transaction_details (
    transaction_id,
    operation_id,
    branch_id,
    investor_id,
    product_id,
    sales_invoice_id,
    quantity_delta,
    quantity_before,
    quantity_after,
    unit_cost,
    value_delta,
    inventory_movement_id
  )
  values (
    v_goods_result.transaction_id,
    v_operation_id,
    p_branch_id,
    v_invoice.investor_id,
    v_invoice.product_id,
    v_invoice.id,
    case when v_invoice.operation_type = 'purchase' then -v_invoice.quantity else v_invoice.quantity end,
    v_before_quantity,
    v_after_quantity,
    v_invoice.sale_unit_cost,
    case when v_invoice.operation_type = 'purchase' then -v_invoice.sale_total_cost else v_invoice.sale_total_cost end,
    v_movement_id
  );

  if v_invoice.operation_type = 'purchase' then
    update public.finance_sales_invoices
    set
      status = 'cancelled',
      cancellation_request_id = p_cancellation_request_id,
      cancellation_fingerprint = v_fingerprint,
      cancellation_reason = v_reason,
      cancelled_at = now(),
      cancelled_by_user_id = p_actor_user_id,
      cancelled_by_name = v_actor_name,
      cancellation_operation_id = v_operation_id,
      cancellation_inventory_movement_id = v_movement_id,
      cancellation_goods_transaction_id = v_goods_result.transaction_id,
      cancellation_cash_transaction_id = v_cash_result.transaction_id,
      inventory_quantity_after_cancellation = v_after_quantity,
      goods_balance_after_cancellation = v_goods_result.balance_after,
      cash_balance_after_cancellation = v_cash_result.balance_after,
      updated_at = now()
    where id = v_invoice.id;
  else
    update public.finance_sales_invoices
    set
      status = 'cancelled',
      cancellation_request_id = p_cancellation_request_id,
      cancellation_fingerprint = v_fingerprint,
      cancellation_reason = v_reason,
      cancelled_at = now(),
      cancelled_by_user_id = p_actor_user_id,
      cancelled_by_name = v_actor_name,
      cancellation_operation_id = v_operation_id,
      cancellation_inventory_movement_id = v_movement_id,
      cancellation_goods_transaction_id = v_goods_result.transaction_id,
      inventory_quantity_after_cancellation = v_after_quantity,
      goods_balance_after_cancellation = v_goods_result.balance_after,
      updated_at = now()
    where id = v_invoice.id;
  end if;

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    employee_name,
    status
  )
  values (
    p_branch_id,
    'إلغاء فاتورة ' || v_action_name,
    'تم إلغاء فاتورة ' || v_action_name || ' رقم ' || v_invoice.invoice_number::text,
    v_actor_name,
    'نشط'
  );

  if v_invoice.operation_type = 'purchase' then
    return query
    select
      v_invoice.id,
      v_invoice.invoice_number,
      v_invoice.operation_type,
      true,
      v_after_quantity,
      v_goods_result.balance_after::numeric,
      v_cash_result.balance_after::numeric;
  else
    return query
    select
      v_invoice.id,
      v_invoice.invoice_number,
      v_invoice.operation_type,
      true,
      v_after_quantity,
      v_goods_result.balance_after::numeric,
      null::numeric;
  end if;
end;
$function$;

revoke all on function public.create_purchase_sale_invoice_atomic(
  uuid, uuid, uuid, text, date, text, text, text, uuid, numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.create_purchase_sale_invoice_atomic(
  uuid, uuid, uuid, text, date, text, text, text, uuid, numeric, numeric, text
) to service_role;

revoke all on function public.cancel_purchase_sale_invoice_atomic(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.cancel_purchase_sale_invoice_atomic(
  uuid, uuid, uuid, uuid, text
) to service_role;

comment on table public.finance_sales_invoices is
  'فواتير الشراء والبيع المباشر المستقلة عن العقود والسداد.';

comment on column public.finance_sales_invoices.operation_type is
  'نوع العملية: بيع أو شراء. جميع السجلات السابقة تعد فواتير بيع.';

comment on column public.finance_sales_invoices.sale_total_cost is
  'التكلفة التاريخية الكاملة لحركة المخزون؛ تكلفة المباع للبيع وقيمة الشراء للشراء.';

comment on function public.create_purchase_sale_invoice_atomic(
  uuid, uuid, uuid, text, date, text, text, text, uuid, numeric, numeric, text
) is 'إنشاء فاتورة شراء أو بيع وحركات المخزون والمحافظ ذريًا مع منع تكرار الطلب.';

comment on function public.cancel_purchase_sale_invoice_atomic(
  uuid, uuid, uuid, uuid, text
) is 'إلغاء فاتورة شراء أو بيع وعكس حركاتها مرة واحدة؛ يرفض إلغاء الشراء بعد حركة مخزون لاحقة.';

commit;
