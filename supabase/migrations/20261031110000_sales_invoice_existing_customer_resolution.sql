begin;

do $migration$
declare
  v_definition text;
  v_updated_definition text;
  v_block_start integer;
  v_assignment_offset integer;
  v_assignment_start integer;
  v_assignment_marker constant text := '    v_customer_id := v_customer.id;';
begin
  select pg_get_functiondef(
    'public.create_purchase_sale_invoice_atomic(uuid,uuid,uuid,text,date,text,text,text,uuid,numeric,numeric,text)'::regprocedure
  )
  into v_definition;

  if v_definition is null then
    raise exception 'CREATE_PURCHASE_SALE_INVOICE_FUNCTION_NOT_FOUND';
  end if;

  v_block_start := strpos(
    v_definition,
    '    if regexp_replace(btrim(v_customer.full_name)'
  );

  if v_block_start = 0 then
    raise exception 'SALES_INVOICE_EXISTING_CUSTOMER_BLOCK_START_NOT_FOUND';
  end if;

  v_assignment_offset := strpos(
    substring(v_definition from v_block_start),
    v_assignment_marker
  );

  if v_assignment_offset = 0 then
    raise exception 'SALES_INVOICE_EXISTING_CUSTOMER_ASSIGNMENT_NOT_FOUND';
  end if;

  v_assignment_start := v_block_start + v_assignment_offset - 1;

  v_updated_definition :=
    substring(v_definition from 1 for v_block_start - 1) ||
    $new$    v_customer_id := v_customer.id;
    v_customer_name := regexp_replace(
      btrim(v_customer.full_name),
      '[[:space:]]+',
      ' ',
      'g'
    );
    v_customer_phone := regexp_replace(
      translate(
        coalesce(v_customer.phone, ''),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      ),
      '[^0-9]',
      '',
      'g'
    );$new$ ||
    substring(
      v_definition
      from v_assignment_start + char_length(v_assignment_marker)
    );

  execute v_updated_definition;
end;
$migration$;

commit;
