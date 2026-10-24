begin;

create table public.finance_sales_invoices (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.finance_branches(id) on delete restrict,
  invoice_number bigint not null,
  invoice_date date not null,
  organization_name text not null,
  customer_name text not null,
  customer_national_id text not null,
  customer_phone text not null,
  inventory_id uuid not null references public.finance_inventory(id) on delete restrict,
  product_id uuid not null references public.finance_products(id) on delete restrict,
  product_name text not null,
  investor_id uuid not null references public.finance_investors(id) on delete restrict,
  investor_name text not null,
  quantity numeric(18, 6) not null,
  total_amount numeric(14, 2) not null,
  payment_method text not null,
  sale_unit_cost numeric(18, 6) not null,
  sale_total_cost numeric(18, 6) not null,
  request_id uuid not null,
  request_fingerprint text not null,
  status text not null default 'active',
  created_by_user_id uuid not null references public.finance_branch_users(id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sale_operation_id uuid not null,
  sale_inventory_movement_id uuid,
  sale_goods_transaction_id uuid,
  inventory_quantity_after_sale numeric(18, 6) not null,
  goods_balance_after_sale numeric(18, 6) not null,
  cancellation_request_id uuid,
  cancellation_fingerprint text,
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid references public.finance_branch_users(id) on delete restrict,
  cancelled_by_name text,
  cancellation_operation_id uuid,
  cancellation_inventory_movement_id uuid,
  cancellation_goods_transaction_id uuid,
  inventory_quantity_after_cancellation numeric(18, 6),
  goods_balance_after_cancellation numeric(18, 6),
  constraint finance_sales_invoices_branch_number_key unique (branch_id, invoice_number),
  constraint finance_sales_invoices_branch_request_key unique (branch_id, request_id),
  constraint finance_sales_invoices_number_chk check (invoice_number > 0),
  constraint finance_sales_invoices_customer_name_chk check (btrim(customer_name) <> ''),
  constraint finance_sales_invoices_national_id_chk check (customer_national_id ~ '^[0-9]{10}$'),
  constraint finance_sales_invoices_phone_chk check (customer_phone ~ '^05[0-9]{8}$'),
  constraint finance_sales_invoices_quantity_chk check (quantity > 0),
  constraint finance_sales_invoices_total_amount_chk check (total_amount > 0),
  constraint finance_sales_invoices_sale_unit_cost_chk check (sale_unit_cost > 0),
  constraint finance_sales_invoices_sale_total_cost_chk check (sale_total_cost > 0),
  constraint finance_sales_invoices_payment_method_chk check (
    payment_method = any (array['شبكة', 'تحويل', 'نقدًا', 'تابي', 'تمارا', 'إمكان']::text[])
  ),
  constraint finance_sales_invoices_status_chk check (status = any (array['active', 'cancelled']::text[])),
  constraint finance_sales_invoices_cancellation_chk check (
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
      and inventory_quantity_after_cancellation is null
      and goods_balance_after_cancellation is null
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
    )
  )
);

create unique index finance_sales_invoices_branch_cancel_request_key
  on public.finance_sales_invoices (branch_id, cancellation_request_id)
  where cancellation_request_id is not null;

create index finance_sales_invoices_branch_created_idx
  on public.finance_sales_invoices (branch_id, created_at desc, id desc);

create index finance_sales_invoices_branch_status_date_idx
  on public.finance_sales_invoices (branch_id, status, invoice_date desc, invoice_number desc);

create index finance_sales_invoices_branch_customer_idx
  on public.finance_sales_invoices (branch_id, customer_national_id, customer_phone);

alter table public.finance_inventory_movements
  add column sales_invoice_id uuid;

alter table public.finance_inventory_movements
  add constraint finance_inventory_movements_sales_invoice_fkey
  foreign key (sales_invoice_id)
  references public.finance_sales_invoices(id)
  on delete restrict;

create unique index finance_inventory_movements_sales_invoice_type_key
  on public.finance_inventory_movements (sales_invoice_id, movement_type)
  where sales_invoice_id is not null;

alter table public.finance_investor_wallet_transactions
  add column sales_invoice_id uuid;

alter table public.finance_investor_wallet_transactions
  add constraint finance_investor_wallet_transactions_sales_invoice_fkey
  foreign key (sales_invoice_id)
  references public.finance_sales_invoices(id)
  on delete restrict;

create unique index finance_investor_wallet_transactions_sales_invoice_type_key
  on public.finance_investor_wallet_transactions (sales_invoice_id, transaction_type)
  where sales_invoice_id is not null;

alter table public.finance_investor_goods_transaction_details
  add column sales_invoice_id uuid;

alter table public.finance_investor_goods_transaction_details
  add constraint finance_investor_goods_details_sales_invoice_fkey
  foreign key (sales_invoice_id)
  references public.finance_sales_invoices(id)
  on delete restrict;

create index finance_investor_goods_details_sales_invoice_idx
  on public.finance_investor_goods_transaction_details (sales_invoice_id, created_at, id)
  where sales_invoice_id is not null;

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
        'sales_invoice_cancel'
      ]::text[]
    )
  );

alter table public.finance_sales_invoices enable row level security;

revoke all on table public.finance_sales_invoices from public, anon, authenticated;
grant select, insert, update on table public.finance_sales_invoices to service_role;

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
  ('sales_invoice_view', 'عرض فواتير البيع', 'sales_invoices', 'فواتير البيع', 610, false, true, true, false, true),
  ('sales_invoice_create', 'إنشاء فاتورة بيع', 'sales_invoices', 'فواتير البيع', 620, true, true, true, false, true),
  ('sales_invoice_print', 'طباعة فاتورة بيع', 'sales_invoices', 'فواتير البيع', 630, false, true, true, false, true),
  ('sales_invoice_cancel', 'إلغاء فاتورة بيع', 'sales_invoices', 'فواتير البيع', 640, true, true, true, false, true)
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

create or replace function public.create_sales_invoice_atomic(
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_request_id uuid,
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
  was_created boolean,
  inventory_quantity_after numeric,
  goods_balance_after numeric
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
  v_quantity numeric;
  v_total_amount numeric;
  v_before_quantity numeric;
  v_after_quantity numeric;
  v_before_total_cost numeric;
  v_after_total_cost numeric;
  v_after_average_cost numeric;
  v_sale_total_cost numeric;
  v_sale_unit_cost numeric;
  v_request_fingerprint text;
  v_invoice_id uuid := gen_random_uuid();
  v_invoice_number bigint;
  v_operation_id uuid := gen_random_uuid();
  v_movement_id uuid;
  v_goods_result record;
  v_actor_name text;
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
    'sales_invoice_create'
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
      p_branch_id::text || ':sales-invoice-request:' || p_request_id::text,
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
      false,
      v_existing.inventory_quantity_after_sale,
      v_existing.goods_balance_after_sale;
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

  select
    fp.product_name,
    finv.investor_name
  into
    v_product_name,
    v_investor_name
  from public.finance_products as fp
  join public.finance_investors as finv
    on finv.id = v_inventory.investor_id
    and finv.branch_id = p_branch_id
  where fp.id = v_inventory.product_id
    and fp.branch_id = p_branch_id;

  v_before_quantity := round(coalesce(v_inventory.quantity, 0), 6);
  v_before_total_cost := round(coalesce(v_inventory.total_cost_value, 0), 6);

  if v_before_quantity < v_quantity then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_GOODS_QUANTITY';
  end if;

  if v_inventory.average_unit_cost is null
     or v_inventory.cost_initialized_at is null
     or v_before_total_cost <= 0
  then
    raise exception using errcode = 'P0001', message = 'GOODS_COST_NOT_INITIALIZED';
  end if;

  if v_quantity = v_before_quantity then
    v_sale_total_cost := v_before_total_cost;
    v_after_quantity := 0;
    v_after_total_cost := 0;
    v_after_average_cost := null;
  else
    v_sale_total_cost := round(v_before_total_cost * (v_quantity / v_before_quantity), 6);
    v_after_quantity := round(v_before_quantity - v_quantity, 6);
    v_after_total_cost := greatest(round(v_before_total_cost - v_sale_total_cost, 6), 0);
    v_after_average_cost := round(v_after_total_cost / v_after_quantity, 6);
  end if;

  if v_sale_total_cost <= 0 then
    raise exception using errcode = 'P0001', message = 'GOODS_COST_NOT_INITIALIZED';
  end if;

  v_sale_unit_cost := round(v_sale_total_cost / v_quantity, 6);

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
  values (
    p_branch_id,
    'sales_invoice',
    v_invoice_number
  )
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
    goods_balance_after_sale
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
    v_sale_unit_cost,
    v_sale_total_cost,
    p_request_id,
    v_request_fingerprint,
    p_actor_user_id,
    v_actor_name,
    v_operation_id,
    v_after_quantity,
    0
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
    'بيع مباشر',
    v_quantity,
    v_before_quantity,
    v_after_quantity,
    'بيع مباشر – رقم الفاتورة ' || v_invoice_number::text,
    v_actor_name
  )
  returning id into v_movement_id;

  select *
  into v_goods_result
  from public.create_investor_wallet_transaction_internal(
    p_branch_id,
    v_inventory.investor_id,
    'goods',
    'debit',
    'sales_invoice_sale',
    v_sale_total_cost,
    'بيع مباشر – رقم الفاتورة ' || v_invoice_number::text,
    p_actor_user_id,
    v_actor_name,
    v_operation_id,
    v_inventory.product_id,
    null,
    v_movement_id,
    null,
    null,
    'sales-invoice:sale:' || v_invoice_id::text,
    jsonb_build_object(
      'sales_invoice_id', v_invoice_id,
      'invoice_number', v_invoice_number,
      'quantity', v_quantity,
      'unit_cost', v_sale_unit_cost
    )
  );

  update public.finance_investor_wallet_transactions
  set sales_invoice_id = v_invoice_id
  where id = v_goods_result.transaction_id;

  update public.finance_inventory
  set
    quantity = v_after_quantity,
    total_cost_value = v_after_total_cost,
    average_unit_cost = v_after_average_cost,
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
    -v_quantity,
    v_before_quantity,
    v_after_quantity,
    v_sale_unit_cost,
    -v_sale_total_cost,
    v_movement_id
  );

  update public.finance_sales_invoices
  set
    sale_inventory_movement_id = v_movement_id,
    sale_goods_transaction_id = v_goods_result.transaction_id,
    goods_balance_after_sale = v_goods_result.balance_after,
    updated_at = now()
  where id = v_invoice_id;

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    employee_name,
    status
  )
  values (
    p_branch_id,
    'إنشاء فاتورة بيع',
    'تم إنشاء فاتورة البيع رقم ' || v_invoice_number::text,
    v_actor_name,
    'نشط'
  );

  return query
  select
    v_invoice_id,
    v_invoice_number,
    true,
    v_after_quantity,
    v_goods_result.balance_after::numeric;
end;
$function$;

create or replace function public.cancel_sales_invoice_atomic(
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_invoice_id uuid,
  p_cancellation_request_id uuid,
  p_reason text
)
returns table (
  invoice_id uuid,
  invoice_number bigint,
  was_cancelled boolean,
  inventory_quantity_after numeric,
  goods_balance_after numeric
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
  v_operation_id uuid := gen_random_uuid();
  v_before_quantity numeric;
  v_after_quantity numeric;
  v_before_total_cost numeric;
  v_after_total_cost numeric;
  v_after_average_cost numeric;
  v_movement_id uuid;
  v_goods_result record;
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
      jsonb_build_object(
        'invoice_id', p_invoice_id,
        'reason', v_reason
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text || ':sales-invoice-cancel:' || p_cancellation_request_id::text,
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
      false,
      v_existing.inventory_quantity_after_cancellation,
      v_existing.goods_balance_after_cancellation;
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
  v_after_quantity := round(v_before_quantity + v_invoice.quantity, 6);
  v_after_total_cost := round(v_before_total_cost + v_invoice.sale_total_cost, 6);
  v_after_average_cost := round(v_after_total_cost / v_after_quantity, 6);

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
    'إلغاء بيع مباشر',
    v_invoice.quantity,
    v_before_quantity,
    v_after_quantity,
    'إلغاء بيع مباشر – رقم الفاتورة ' || v_invoice.invoice_number::text || ' – ' || v_reason,
    v_actor_name
  )
  returning id into v_movement_id;

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
    'sales-invoice:cancel:' || v_invoice.id::text,
    jsonb_build_object(
      'sales_invoice_id', v_invoice.id,
      'invoice_number', v_invoice.invoice_number,
      'quantity', v_invoice.quantity,
      'historical_unit_cost', v_invoice.sale_unit_cost
    )
  );

  update public.finance_investor_wallet_transactions
  set sales_invoice_id = v_invoice.id
  where id = v_goods_result.transaction_id;

  update public.finance_inventory
  set
    quantity = v_after_quantity,
    total_cost_value = v_after_total_cost,
    average_unit_cost = v_after_average_cost,
    cost_initialized_at = coalesce(cost_initialized_at, now()),
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
    v_invoice.quantity,
    v_before_quantity,
    v_after_quantity,
    v_invoice.sale_unit_cost,
    v_invoice.sale_total_cost,
    v_movement_id
  );

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

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    employee_name,
    status
  )
  values (
    p_branch_id,
    'إلغاء فاتورة بيع',
    'تم إلغاء فاتورة البيع رقم ' || v_invoice.invoice_number::text,
    v_actor_name,
    'نشط'
  );

  return query
  select
    v_invoice.id,
    v_invoice.invoice_number,
    true,
    v_after_quantity,
    v_goods_result.balance_after::numeric;
end;
$function$;

create or replace function public.delete_finance_user_server_atomic(
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_user_id uuid
)
returns table(deleted_user_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor public.finance_branch_users%rowtype;
  v_target public.finance_branch_users%rowtype;
begin
  select actor.*
  into v_actor
  from public.finance_branch_users as actor
  where actor.id = p_actor_user_id
    and actor.branch_id = p_branch_id
    and coalesce(actor.is_active, false) = true
    and coalesce(actor.self_disabled, false) = false
    and actor.disabled_at is null
  limit 1;

  if v_actor.id is null then
    raise exception 'جلسة المستخدم غير صالحة';
  end if;

  if not (
    coalesce(v_actor.role, '') in (
      'مدير',
      'مدير فرع',
      'مدير رئيسي',
      'branch_manager',
      'main_admin'
    )
    or 'permissions' = any(coalesce(v_actor.permissions, '{}'::text[]))
  ) then
    raise exception 'لا تملك صلاحية حذف المستخدمين';
  end if;

  select target.*
  into v_target
  from public.finance_branch_users as target
  where target.id = p_user_id
    and target.branch_id = p_branch_id
  limit 1;

  if v_target.id is null then
    raise exception 'المستخدم غير موجود في هذا الفرع';
  end if;

  if v_target.id = v_actor.id then
    raise exception 'لا يمكنك حذف حسابك الحالي';
  end if;

  if coalesce(v_target.role, '') in (
    'مدير فرع',
    'مدير رئيسي',
    'branch_manager',
    'main_admin'
  ) then
    raise exception 'لا يمكن حذف هذا الحساب من صفحة إدارة الفرع';
  end if;

  if exists (
    select 1
    from public.finance_sales_invoices as fsi
    where fsi.branch_id = p_branch_id
      and (
        fsi.created_by_user_id = p_user_id
        or fsi.cancelled_by_user_id = p_user_id
      )
  ) then
    raise exception 'لا يمكن حذف الموظف لوجود سجلات مالية مرتبطة به في فواتير البيع';
  end if;

  delete from public.finance_branch_users
  where id = p_user_id
    and branch_id = p_branch_id;

  return query
  select v_target.id;
end;
$function$;

revoke all on function public.create_sales_invoice_atomic(
  uuid, uuid, uuid, date, text, text, text, uuid, numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.create_sales_invoice_atomic(
  uuid, uuid, uuid, date, text, text, text, uuid, numeric, numeric, text
) to service_role;

revoke all on function public.cancel_sales_invoice_atomic(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.cancel_sales_invoice_atomic(
  uuid, uuid, uuid, uuid, text
) to service_role;

comment on table public.finance_sales_invoices is
  'فواتير البيع المباشر المستقلة عن العقود والسداد.';

comment on column public.finance_sales_invoices.request_id is
  'معرف ثابت لمحاولة الإنشاء يمنع تكرار الفاتورة والخصم.';

comment on column public.finance_sales_invoices.sale_total_cost is
  'التكلفة التاريخية الكاملة للكمية عند البيع وتستخدم نفسها عند الإلغاء.';

comment on function public.create_sales_invoice_atomic(
  uuid, uuid, uuid, date, text, text, text, uuid, numeric, numeric, text
) is 'إنشاء فاتورة بيع وخصم المخزون وتكلفته ومحفظة البضائع ذريًا مع idempotency.';

comment on function public.cancel_sales_invoice_atomic(
  uuid, uuid, uuid, uuid, text
) is 'إلغاء فاتورة بيع وإعادة الكمية والتكلفة التاريخية ومحفظة البضائع مرة واحدة.';

commit;
