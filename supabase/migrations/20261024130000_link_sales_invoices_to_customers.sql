begin;

alter table public.finance_sales_invoices
  add column customer_id uuid;

alter table public.finance_sales_invoices
  add constraint finance_sales_invoices_customer_id_fkey
  foreign key (customer_id)
  references public.finance_customers(id)
  on delete restrict;

create index finance_sales_invoices_branch_customer_id_idx
  on public.finance_sales_invoices (
    branch_id,
    customer_id,
    invoice_date desc,
    invoice_number desc
  )
  where customer_id is not null;

comment on column public.finance_sales_invoices.customer_id is
  'ملف العميل المرتبط بالفاتورة. يبقى فارغًا للفواتير السابقة التي لا يمكن ربطها بصورة مؤكدة.';

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

  v_updated_definition := replace(
    v_definition,
    $old$  v_inventory public.finance_inventory%rowtype;
  v_existing public.finance_sales_invoices%rowtype;
  v_product_name text;$old$,
    $new$  v_inventory public.finance_inventory%rowtype;
  v_existing public.finance_sales_invoices%rowtype;
  v_customer public.finance_customers%rowtype;
  v_customer_id uuid;
  v_product_name text;$new$
  );

  if v_updated_definition = v_definition then
    raise exception 'SALES_INVOICE_CUSTOMER_DECLARATION_POINT_NOT_FOUND';
  end if;

  v_definition := v_updated_definition;
  v_updated_definition := replace(
    v_definition,
    $old$    return;
  end if;

  select fi.*
  into v_inventory$old$,
    $new$    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text || ':customer:' || v_customer_national_id,
      0
    )
  );

  select fc.*
  into v_customer
  from public.finance_customers as fc
  where fc.branch_id = p_branch_id
    and fc.national_id = v_customer_national_id
  for update;

  if found then
    if coalesce(v_customer.is_archived, false) then
      raise exception using
        errcode = 'P0001',
        message = 'SALES_INVOICE_CUSTOMER_ARCHIVED';
    end if;

    if regexp_replace(btrim(v_customer.full_name), '[[:space:]]+', ' ', 'g')
         <> regexp_replace(v_customer_name, '[[:space:]]+', ' ', 'g')
       or regexp_replace(
            translate(
              coalesce(v_customer.phone, ''),
              '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
              '01234567890123456789'
            ),
            '[^0-9]',
            '',
            'g'
          ) <> v_customer_phone
    then
      raise exception using
        errcode = 'P0001',
        message = 'SALES_INVOICE_CUSTOMER_DATA_MISMATCH';
    end if;

    v_customer_id := v_customer.id;
  else
    insert into public.finance_customers (
      branch_id,
      full_name,
      national_id,
      phone,
      created_at,
      updated_at
    )
    values (
      p_branch_id,
      v_customer_name,
      v_customer_national_id,
      v_customer_phone,
      now(),
      now()
    )
    returning id into v_customer_id;

    insert into public.finance_activity_logs (
      branch_id,
      customer_id,
      customer_name,
      activity_type,
      description,
      employee_name,
      status,
      new_values,
      changed_fields
    )
    values (
      p_branch_id,
      v_customer_id,
      v_customer_name,
      'إنشاء عميل',
      'تم إنشاء العميل تلقائيًا عند إنشاء فاتورة ' || v_action_name,
      v_actor_name,
      'جديد',
      jsonb_build_object(
        'customer_id', v_customer_id,
        'full_name', v_customer_name,
        'national_id', v_customer_national_id,
        'phone', v_customer_phone,
        'source', 'purchase_sale_invoice'
      ),
      array['إنشاء العميل من فاتورة شراء وبيع']::text[]
    );
  end if;

  select fi.*
  into v_inventory$new$
  );

  if v_updated_definition = v_definition then
    raise exception 'SALES_INVOICE_CUSTOMER_RESOLUTION_POINT_NOT_FOUND';
  end if;

  v_definition := v_updated_definition;
  v_updated_definition := replace(
    v_definition,
    $old$    customer_national_id,
    customer_phone,
    inventory_id,$old$,
    $new$    customer_national_id,
    customer_phone,
    customer_id,
    inventory_id,$new$
  );

  if v_updated_definition = v_definition then
    raise exception 'SALES_INVOICE_CUSTOMER_COLUMN_POINT_NOT_FOUND';
  end if;

  v_definition := v_updated_definition;
  v_updated_definition := replace(
    v_definition,
    $old$    v_customer_national_id,
    v_customer_phone,
    v_inventory.id,$old$,
    $new$    v_customer_national_id,
    v_customer_phone,
    v_customer_id,
    v_inventory.id,$new$
  );

  if v_updated_definition = v_definition then
    raise exception 'SALES_INVOICE_CUSTOMER_VALUE_POINT_NOT_FOUND';
  end if;

  execute v_updated_definition;
end;
$migration$;

commit;
