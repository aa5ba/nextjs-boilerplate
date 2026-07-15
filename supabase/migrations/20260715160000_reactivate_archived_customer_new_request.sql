-- Migration: reactivate archived customer during new request creation
-- Keeps existing request creation flow intact while unarchiving reused customers.

CREATE OR REPLACE FUNCTION "public"."create_new_request_atomic"("p_branch_id" "uuid", "p_full_name" "text", "p_national_id" "text", "p_birth_hijri" "text", "p_phone" "text", "p_work_name" "text", "p_address" "text", "p_finance_type" "text", "p_investor_id" "uuid", "p_investor_name" "text", "p_product_id" "uuid", "p_product_name" "text", "p_product_quantity" numeric, "p_print_party_type" "text", "p_print_party_name" "text", "p_print_party_identifier" "text", "p_debt_amount" numeric, "p_payment_amount" numeric, "p_has_deferred_payments" boolean, "p_installment_amount" numeric, "p_deferred_payments_count" numeric, "p_payment_type" "text", "p_payment_due_date" "text", "p_contract_issue_date_gregorian" "text", "p_contract_issue_date_hijri" "text", "p_legal_city" "text", "p_notes" "text", "p_has_guarantor" boolean, "p_guarantor_name" "text", "p_guarantor_national_id" "text", "p_guarantor_phone" "text", "p_guarantor_birth_hijri" "text") RETURNS TABLE("contract_id" "uuid", "note_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_customer_id uuid;
  v_contract_id uuid;
  v_note_id uuid;

  v_stock_id uuid;
  v_before_qty numeric := 0;
  v_after_qty numeric;

  v_contract_number bigint;
  v_note_number bigint;

  v_beneficiary_type text;

  v_contract_type text;
  v_is_installment_contract boolean;

  v_installment_amount numeric(14, 2);
  v_installments_count integer;

  v_payment_due_date date;
  v_contract_issue_date date;

  v_clean_national_id text;
  v_clean_phone text;
  v_clean_birth_hijri text;

  v_clean_guarantor_national_id text;
  v_clean_guarantor_phone text;
  v_clean_guarantor_birth_hijri text;

  v_clean_print_party_identifier text;
  v_clean_contract_issue_hijri text;

  v_legal_footer_text text :=
    E'هذا السند واجب الدفع بموجب قرار مجلس الوزراء رقم ٦٩٢ و تاريخ ٢٦ / ٩ / ١٣٨٣ هـ\nوالمتوج بالمرسوم الملكي رقم ٣٧ و تاريخ ١١ / ١٠ / ١٣٨٣ هـ / نظام الأوراق التجاريه - ويسري على هذا السند جميع القرارات والأنظمه والتنظيمات في المملكة العربية السعودية';

  v_legal_body_text text :=
    E'بموجب هذا السند أتعهد أنا الموقع أدناه بأن أدفع لأمر المستفيد المبلغ الموضح في السند.\nوتستحق الدفع عند الطلب.\nوبموجب هذا السند يسقط المدين كافة حقوق التقديم والمطالبة والاحتجاج والإخطار بالامتناع عن الوفاء.\nويجوز لحامل هذا السند المستفيد تقديم وإظهار هذا السند لأي طرف دون موافقة المدين.\nوللمستفيد حق الرجوع بدون مصروفات أو احتجاج أو إخطار لعدم الوفاء، وهذا السند واجب الدفع دون تعطيل.\nوفي حالة الترافع والنزاع يكون الفصل في المحاكم التنفيذية المختصة في المكان الذي يرغب فيه المدعي.';
begin

  -- =====================================================
  -- تحويل الأرقام العربية والفارسية إلى إنجليزية
  -- =====================================================

  v_clean_national_id :=
    trim(
      translate(
        coalesce(p_national_id, ''),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      )
    );

  v_clean_phone :=
    trim(
      translate(
        coalesce(p_phone, ''),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      )
    );

  v_clean_birth_hijri :=
    nullif(
      trim(
        translate(
          coalesce(p_birth_hijri, ''),
          '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          '01234567890123456789'
        )
      ),
      ''
    );

  v_clean_guarantor_national_id :=
    trim(
      translate(
        coalesce(p_guarantor_national_id, ''),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      )
    );

  v_clean_guarantor_phone :=
    trim(
      translate(
        coalesce(p_guarantor_phone, ''),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      )
    );

  v_clean_guarantor_birth_hijri :=
    nullif(
      trim(
        translate(
          coalesce(p_guarantor_birth_hijri, ''),
          '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          '01234567890123456789'
        )
      ),
      ''
    );

  v_clean_print_party_identifier :=
    nullif(
      trim(
        translate(
          coalesce(p_print_party_identifier, ''),
          '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          '01234567890123456789'
        )
      ),
      ''
    );

  v_clean_contract_issue_hijri :=
    nullif(
      trim(
        translate(
          coalesce(p_contract_issue_date_hijri, ''),
          '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          '01234567890123456789'
        )
      ),
      ''
    );

  -- =====================================================
  -- التحقق من البيانات الأساسية
  -- =====================================================

  if p_branch_id is null then
    raise exception 'تعذر تحديد الفرع';
  end if;

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'يرجى إدخال اسم العميل';
  end if;

  if v_clean_national_id !~ '^[0-9]{10}$' then
    raise exception 'رقم هوية العميل يجب أن يكون 10 أرقام';
  end if;

  if v_clean_phone !~ '^05[0-9]{8}$' then
    raise exception 'رقم جوال العميل يجب أن يكون 10 أرقام ويبدأ بـ 05';
  end if;

  if p_investor_id is null then
    raise exception 'يرجى اختيار المستثمر';
  end if;

  if p_product_id is null then
    raise exception 'يرجى اختيار المنتج';
  end if;

  if coalesce(p_product_quantity, 0) <= 0 then
    raise exception 'كمية المنتج غير صحيحة';
  end if;

  if coalesce(p_debt_amount, 0) <= 0 then
    raise exception 'مبلغ الاستحقاق غير صحيح';
  end if;

  -- =====================================================
  -- نوع العقد
  -- =====================================================

  v_contract_type :=
    trim(coalesce(p_finance_type, ''));

  if v_contract_type not in ('عقد بيع', 'عقد تقسيط') then
    raise exception 'نوع العقد يجب أن يكون عقد بيع أو عقد تقسيط';
  end if;

  v_is_installment_contract :=
    v_contract_type = 'عقد تقسيط';

  -- =====================================================
  -- تاريخ الاستحقاق وتاريخ تحرير العقد
  -- =====================================================

  begin
    v_payment_due_date :=
      translate(
        nullif(trim(coalesce(p_payment_due_date, '')), ''),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      )::date;
  exception
    when others then
      raise exception 'تاريخ الاستحقاق غير صحيح';
  end;

  if v_payment_due_date is null then
    raise exception 'يرجى اختيار تاريخ الاستحقاق';
  end if;

  begin
    v_contract_issue_date :=
      translate(
        nullif(
          trim(coalesce(p_contract_issue_date_gregorian, '')),
          ''
        ),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      )::date;
  exception
    when others then
      raise exception 'تاريخ تحرير العقد غير صحيح';
  end;

  if v_contract_issue_date is null then
    raise exception 'يرجى اختيار تاريخ تحرير العقد';
  end if;

  -- =====================================================
  -- إعداد الدفعات
  -- =====================================================

  if v_is_installment_contract then
    if coalesce(p_installment_amount, 0) <= 0 then
      raise exception 'قيمة الدفعة الآجلة يجب أن تكون أكبر من صفر';
    end if;

    if coalesce(p_deferred_payments_count, 0) <= 0 then
      raise exception 'عدد الدفعات يجب أن يكون أكبر من صفر';
    end if;

    if p_deferred_payments_count <> trunc(p_deferred_payments_count) then
      raise exception 'عدد الدفعات يجب أن يكون رقمًا صحيحًا';
    end if;

    v_installment_amount :=
      round(p_installment_amount, 2);

    v_installments_count :=
      p_deferred_payments_count::integer;
  else
    v_installment_amount := 0;
    v_installments_count := 1;
  end if;

  -- =====================================================
  -- التحقق من بيانات الكفيل
  -- =====================================================

  if coalesce(p_has_guarantor, false) then
    if nullif(trim(coalesce(p_guarantor_name, '')), '') is null then
      raise exception 'يرجى إدخال اسم الكفيل';
    end if;

    if v_clean_guarantor_national_id !~ '^[0-9]{10}$' then
      raise exception 'رقم هوية الكفيل يجب أن يكون 10 أرقام';
    end if;

    if v_clean_guarantor_national_id = v_clean_national_id then
      raise exception 'لا يمكن أن يكون العميل كفيلًا لنفسه';
    end if;

    if v_clean_guarantor_phone !~ '^05[0-9]{8}$' then
      raise exception 'رقم جوال الكفيل يجب أن يكون 10 أرقام ويبدأ بـ 05';
    end if;

    if v_clean_guarantor_birth_hijri is null then
      raise exception 'يرجى إدخال تاريخ ميلاد الكفيل';
    end if;
  end if;

  v_beneficiary_type :=
    case
      when lower(trim(coalesce(p_print_party_type, ''))) = 'investor'
        then 'investor'
      else 'organization'
    end;

  -- =====================================================
  -- توليد رقم العقد حسب الفرع
  -- =====================================================

  insert into public.finance_branch_sequences (
    branch_id,
    sequence_type,
    last_number
  )
  select
    p_branch_id,
    'contract',
    coalesce(max(fc.contract_number), 0) + 1
  from public.finance_contracts as fc
  where fc.branch_id = p_branch_id
  on conflict (branch_id, sequence_type)
  do update
  set
    last_number =
      greatest(
        public.finance_branch_sequences.last_number,
        (
          select coalesce(max(ec.contract_number), 0)
          from public.finance_contracts ec
          where ec.branch_id = p_branch_id
        )
      ) + 1,
    updated_at = now()
  returning last_number
  into v_contract_number;

  -- =====================================================
  -- توليد رقم السند حسب الفرع
  -- =====================================================

  insert into public.finance_branch_sequences (
    branch_id,
    sequence_type,
    last_number
  )
  select
    p_branch_id,
    'note',
    coalesce(max(fpn.note_number), 0) + 1
  from public.finance_promissory_notes as fpn
  where fpn.branch_id = p_branch_id
  on conflict (branch_id, sequence_type)
  do update
  set
    last_number =
      greatest(
        public.finance_branch_sequences.last_number,
        (
          select coalesce(max(en.note_number), 0)
          from public.finance_promissory_notes en
          where en.branch_id = p_branch_id
        )
      ) + 1,
    updated_at = now()
  returning last_number
  into v_note_number;

  -- =====================================================
  -- قفل المخزون وحساب الرصيد الجديد
  -- =====================================================

  select
    fi.id,
    fi.quantity
  into
    v_stock_id,
    v_before_qty
  from public.finance_inventory fi
  where fi.branch_id = p_branch_id
    and fi.investor_id = p_investor_id
    and fi.product_id = p_product_id
  for update;

  v_before_qty := coalesce(v_before_qty, 0);
  v_after_qty := v_before_qty - p_product_quantity;

  if v_stock_id is null then
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
      v_after_qty
    )
    returning id into v_stock_id;
  else
    update public.finance_inventory
    set
      quantity = v_after_qty,
      updated_at = now()
    where id = v_stock_id;
  end if;

  -- =====================================================
  -- إنشاء العميل أو تحديثه
  -- =====================================================

  insert into public.finance_customers (
    branch_id,
    full_name,
    national_id,
    birth_hijri,
    phone,
    work_name,
    address
  )
  values (
    p_branch_id,
    trim(p_full_name),
    v_clean_national_id,
    v_clean_birth_hijri,
    v_clean_phone,
    nullif(trim(coalesce(p_work_name, '')), ''),
    nullif(trim(coalesce(p_address, '')), '')
  )
  on conflict (branch_id, national_id)
  do update
  set
    full_name = excluded.full_name,
    birth_hijri = excluded.birth_hijri,
    phone = excluded.phone,
    work_name = excluded.work_name,
    address = excluded.address,
    is_archived = false,
    archived_at = null,
    archived_by = null
  returning id into v_customer_id;

  -- =====================================================
  -- إنشاء العقد
  -- =====================================================

  insert into public.finance_contracts (
    branch_id,
    contract_number,

    customer_id,
    customer_name,
    customer_national_id,
    customer_phone,
    customer_birth_hijri,
    customer_work_name,

    finance_type,

    investor_id,
    investor_name,

    product_id,
    product_name,
    product_quantity,

    print_party_type,
    print_party_name,
    print_party_identifier,

    debt_amount,
    payment_amount,

    has_deferred_payments,
    installment_amount,
    deferred_payments_count,

    payment_type,
    payment_due_date,

    contract_date_gregorian,
    contract_date_hijri,
    contract_issue_date_gregorian,
    contract_issue_date_hijri,

    legal_city,
    notes,

    has_guarantor,
    guarantor_name,
    guarantor_national_id,
    guarantor_phone,
    guarantor_birth_hijri,

    contract_status,
    paid_amount,
    remaining_amount,
    created_by
  )
  values (
    p_branch_id,
    v_contract_number,

    v_customer_id,
    trim(p_full_name),
    v_clean_national_id,
    v_clean_phone,
    v_clean_birth_hijri,
    nullif(trim(coalesce(p_work_name, '')), ''),

    v_contract_type,

    p_investor_id,
    trim(coalesce(p_investor_name, '')),

    p_product_id,
    trim(coalesce(p_product_name, '')),
    p_product_quantity,

    v_beneficiary_type,
    trim(coalesce(p_print_party_name, '')),
    v_clean_print_party_identifier,

    round(p_debt_amount, 2),
    round(coalesce(p_payment_amount, p_debt_amount), 2),

    v_is_installment_contract,
    v_installment_amount,

    case
      when v_is_installment_contract
        then v_installments_count
      else 0
    end,

    case
      when v_is_installment_contract
        then 'دفعات شهرية'
      else 'دفعة آجلة واحدة'
    end,

    v_payment_due_date,

    v_contract_issue_date,
    v_clean_contract_issue_hijri,
    v_contract_issue_date,
    v_clean_contract_issue_hijri,

    nullif(trim(coalesce(p_legal_city, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),

    coalesce(p_has_guarantor, false),

    case
      when coalesce(p_has_guarantor, false)
        then trim(coalesce(p_guarantor_name, ''))
      else ''
    end,

    case
      when coalesce(p_has_guarantor, false)
        then v_clean_guarantor_national_id
      else ''
    end,

    case
      when coalesce(p_has_guarantor, false)
        then v_clean_guarantor_phone
      else ''
    end,

    case
      when coalesce(p_has_guarantor, false)
        then coalesce(v_clean_guarantor_birth_hijri, '')
      else ''
    end,

    'نشط',
    0,
    round(p_debt_amount, 2),
    'المدير'
  )
  returning id into v_contract_id;

  -- =====================================================
  -- إنشاء جدول الدفعات
  -- =====================================================

  perform 1
  from public.create_contract_installments_atomic(
    p_branch_id := p_branch_id,
    p_contract_id := v_contract_id,
    p_contract_type := v_contract_type,
    p_debt_amount := round(p_debt_amount, 2),

    p_installment_amount :=
      case
        when v_is_installment_contract
          then v_installment_amount
        else null
      end,

    p_installments_count :=
      case
        when v_is_installment_contract
          then v_installments_count
        else 1
      end,

    p_first_due_date := v_payment_due_date
  );

  -- =====================================================
  -- إنشاء السند لأمر
  -- =====================================================

  insert into public.finance_promissory_notes (
    branch_id,
    note_number,
    contract_id,
    customer_id,

    note_mode,

    beneficiary_type,
    beneficiary_investor_id,
    beneficiary_customer_id,
    beneficiary_name,
    beneficiary_identifier,
    beneficiary_phone,
    beneficiary_birth_date_type,
    beneficiary_birth_hijri,
    beneficiary_birth_gregorian,
    beneficiary_nationality,
    beneficiary_address,
    beneficiary_work_name,
    beneficiary_identity_source,
    beneficiary_notes,

    debtor_name,
    debtor_national_id,
    debtor_phone,
    debtor_birth_date_type,
    debtor_birth_hijri,
    debtor_birth_gregorian,
    debtor_nationality,
    debtor_address,
    debtor_work_name,
    debtor_identity_source,
    debtor_notes,

    amount,
    amount_words,

    due_date,
    due_phrase,

    city,
    notes,

    note_date_gregorian,
    note_date_hijri,
    note_issue_date_gregorian,
    note_issue_date_hijri,

    has_guarantor,
    guarantor_customer_id,
    guarantor_name,
    guarantor_national_id,
    guarantor_phone,
    guarantor_work_name,
    guarantor_birth_date_type,
    guarantor_birth_hijri,
    guarantor_birth_gregorian,
    guarantor_nationality,
    guarantor_address,
    guarantor_identity_source,
    guarantor_notes,

    deferred_payments_count,

    status,
    created_by,
    legal_body_text,
    legal_footer_text
  )
  values (
    p_branch_id,
    v_note_number,
    v_contract_id,
    v_customer_id,

    'contract_linked',

    v_beneficiary_type,

    case
      when v_beneficiary_type = 'investor'
        then p_investor_id
      else null
    end,

    null,

    trim(coalesce(p_print_party_name, '')),
    v_clean_print_party_identifier,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,

    trim(p_full_name),
    v_clean_national_id,
    v_clean_phone,
    'hijri',
    v_clean_birth_hijri,
    null,
    null,
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_work_name, '')), ''),
    null,
    nullif(trim(coalesce(p_notes, '')), ''),

    round(p_debt_amount, 2),
    null,

    v_payment_due_date,

    case
      when v_is_installment_contract
        then 'وتستحق الدفعات شهريًا حسب جدول الدفعات'
      else 'وتستحق الدفعة في التاريخ المحدد'
    end,

    nullif(trim(coalesce(p_legal_city, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),

    v_contract_issue_date,
    v_clean_contract_issue_hijri,
    v_contract_issue_date,
    v_clean_contract_issue_hijri,

    coalesce(p_has_guarantor, false),
    null,

    case
      when coalesce(p_has_guarantor, false)
        then nullif(trim(coalesce(p_guarantor_name, '')), '')
      else null
    end,

    case
      when coalesce(p_has_guarantor, false)
        then nullif(v_clean_guarantor_national_id, '')
      else null
    end,

    case
      when coalesce(p_has_guarantor, false)
        then nullif(v_clean_guarantor_phone, '')
      else null
    end,

    null,

    case
      when coalesce(p_has_guarantor, false)
        then 'hijri'
      else null
    end,

    case
      when coalesce(p_has_guarantor, false)
        then v_clean_guarantor_birth_hijri
      else null
    end,

    null,
    null,
    null,
    null,
    null,

    case
      when v_is_installment_contract
        then v_installments_count
      else 0
    end,

    'نشط',
    'المدير',
    v_legal_body_text,
    v_legal_footer_text
  )
  returning id into v_note_id;

  -- =====================================================
  -- تسجيل حركة المخزون
  -- =====================================================

  insert into public.finance_inventory_movements (
    branch_id,
    investor_id,
    product_id,
    customer_id,
    contract_id,
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
    v_customer_id,
    v_contract_id,
    'خصم',
    p_product_quantity,
    v_before_qty,
    v_after_qty,

    case
      when v_after_qty < 0 then
        'خصم بسبب إنشاء طلب للعميل '
        || trim(p_full_name)
        || ' مع تجاوز المخزون المتاح'
      else
        'خصم بسبب إنشاء طلب للعميل '
        || trim(p_full_name)
    end,

    'المدير'
  );

  -- =====================================================
  -- تسجيل النشاط
  -- =====================================================

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
    'طلب جديد',

    'تم إنشاء '
    || v_contract_type
    || ' للعميل '
    || trim(p_full_name)
    || ' وخصم '
    || p_product_quantity
    || ' من '
    || coalesce(p_product_name, ''),

    v_customer_id,
    v_contract_id,
    trim(p_full_name),
    'المدير',

    case
      when v_after_qty < 0 then
        'مخزون بالسالب'
      else
        'نشط'
    end
  );

  return query
  select
    v_contract_id,
    v_note_id;
end;
$_$;

ALTER FUNCTION "public"."create_new_request_atomic"("p_branch_id" "uuid", "p_full_name" "text", "p_national_id" "text", "p_birth_hijri" "text", "p_phone" "text", "p_work_name" "text", "p_address" "text", "p_finance_type" "text", "p_investor_id" "uuid", "p_investor_name" "text", "p_product_id" "uuid", "p_product_name" "text", "p_product_quantity" numeric, "p_print_party_type" "text", "p_print_party_name" "text", "p_print_party_identifier" "text", "p_debt_amount" numeric, "p_payment_amount" numeric, "p_has_deferred_payments" boolean, "p_installment_amount" numeric, "p_deferred_payments_count" numeric, "p_payment_type" "text", "p_payment_due_date" "text", "p_contract_issue_date_gregorian" "text", "p_contract_issue_date_hijri" "text", "p_legal_city" "text", "p_notes" "text", "p_has_guarantor" boolean, "p_guarantor_name" "text", "p_guarantor_national_id" "text", "p_guarantor_phone" "text", "p_guarantor_birth_hijri" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_new_request_secure_atomic"("p_branch_id" "uuid", "p_employee_id" "uuid", "p_employee_name" "text", "p_full_name" "text", "p_national_id" "text", "p_birth_hijri" "text", "p_phone" "text", "p_work_name" "text", "p_address" "text", "p_contract_type" "text", "p_investor_id" "uuid", "p_product_id" "uuid", "p_product_quantity" numeric, "p_print_party_type" "text", "p_debt_amount" numeric, "p_payment_amount" numeric, "p_installment_amount" numeric, "p_installments_count" integer, "p_first_due_date" "date", "p_contract_issue_date" "date", "p_contract_issue_date_hijri" "text", "p_legal_city" "text", "p_notes" "text", "p_has_guarantor" boolean, "p_guarantor_name" "text", "p_guarantor_national_id" "text", "p_guarantor_phone" "text", "p_guarantor_birth_hijri" "text", "p_allow_negative_inventory" boolean DEFAULT false) RETURNS TABLE("contract_id" "uuid", "note_id" "uuid", "customer_id" "uuid", "contract_number" bigint, "note_number" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_user public.finance_branch_users%rowtype;

  v_customer_id uuid;
  v_guarantor_customer_id uuid;

  v_contract_id uuid;
  v_note_id uuid;

  v_contract_number bigint;
  v_note_number bigint;

  v_investor_name text;
  v_investor_national_id text;

  v_product_name text;
  v_product_unit_price numeric;

  v_organization_name text;
  v_commercial_record text;

  v_print_party_name text;
  v_print_party_identifier text;

  v_employee_name text;

  v_clean_national_id text;
  v_clean_phone text;
  v_clean_birth_hijri text;

  v_clean_guarantor_national_id text;
  v_clean_guarantor_phone text;
  v_clean_guarantor_birth_hijri text;

  v_clean_issue_hijri text;

  v_contract_type text;

  v_product_quantity numeric;
  v_debt_amount numeric(14, 2);
  v_payment_amount numeric(14, 2);

  v_installment_amount numeric(14, 2);
  v_installments_count integer;

  v_stock_id uuid;
  v_before_quantity numeric := 0;
  v_after_quantity numeric := 0;

  v_note_snapshot jsonb;

  v_legal_body_text text :=
    E'بموجب هذا السند أتعهد أنا الموقع أدناه بأن أدفع لأمر المستفيد كامل المبلغ الموضح في السند في تاريخ الاستحقاق المحدد أعلاه.\nوبموجب هذا السند يسقط المدين كافة حقوق التقديم والمطالبة والاحتجاج والإخطار بالامتناع عن الوفاء.\nويجوز لحامل هذا السند المستفيد تقديم وإظهار هذا السند لأي طرف دون موافقة المدين.\nوللمستفيد حق الرجوع بدون مصروفات أو احتجاج أو إخطار لعدم الوفاء، وهذا السند واجب الدفع دون تعطيل.\nوفي حالة الترافع والنزاع يكون الفصل في المحاكم التنفيذية المختصة في المكان الذي يرغب فيه المدعي.';

  v_legal_footer_text text :=
    E'هذا السند واجب الدفع بموجب قرار مجلس الوزراء رقم ٦٩٢ وتاريخ ٢٦ / ٩ / ١٣٨٣ هـ\nوالمتوج بالمرسوم الملكي رقم ٣٧ وتاريخ ١١ / ١٠ / ١٣٨٣ هـ / نظام الأوراق التجارية، وتسري على هذا السند جميع القرارات والأنظمة والتنظيمات في المملكة العربية السعودية.';
begin
  -- =====================================================
  -- التحقق من الفرع والموظف والصلاحية
  -- =====================================================

  if p_branch_id is null then
    raise exception 'BRANCH_REQUIRED';
  end if;

  if p_employee_id is null then
    raise exception 'EMPLOYEE_REQUIRED';
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
    'new_request_create'
  ) then
    raise exception 'NEW_REQUEST_PERMISSION_DENIED';
  end if;

  v_employee_name := coalesce(
    nullif(trim(v_user.full_name), ''),
    nullif(trim(v_user.username), ''),
    nullif(trim(p_employee_name), ''),
    'الموظف'
  );

  -- =====================================================
  -- تنظيف البيانات الرقمية
  -- =====================================================

  v_clean_national_id := regexp_replace(
    translate(
      coalesce(p_national_id, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  v_clean_phone := regexp_replace(
    translate(
      coalesce(p_phone, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  v_clean_birth_hijri := replace(
    replace(
      translate(
        trim(coalesce(p_birth_hijri, '')),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      ),
      '-',
      '/'
    ),
    '.',
    '/'
  );

  v_clean_guarantor_national_id := regexp_replace(
    translate(
      coalesce(p_guarantor_national_id, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  v_clean_guarantor_phone := regexp_replace(
    translate(
      coalesce(p_guarantor_phone, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );

  v_clean_guarantor_birth_hijri := replace(
    replace(
      translate(
        trim(coalesce(p_guarantor_birth_hijri, '')),
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789'
      ),
      '-',
      '/'
    ),
    '.',
    '/'
  );

  v_clean_issue_hijri := nullif(
    replace(
      replace(
        translate(
          trim(coalesce(p_contract_issue_date_hijri, '')),
          '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
          '01234567890123456789'
        ),
        '-',
        '/'
      ),
      '.',
      '/'
    ),
    ''
  );

  -- =====================================================
  -- التحقق من بيانات العميل
  -- =====================================================

  if nullif(trim(coalesce(p_full_name, '')), '') is null then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if v_clean_national_id !~ '^[0-9]{10}$' then
    raise exception 'INVALID_CUSTOMER_NATIONAL_ID';
  end if;

  if v_clean_phone !~ '^05[0-9]{8}$' then
    raise exception 'INVALID_CUSTOMER_PHONE';
  end if;

  if v_clean_birth_hijri !~
    '^[0-9]{4}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|30)$'
  then
    raise exception 'INVALID_CUSTOMER_HIJRI_BIRTH_DATE';
  end if;

  -- =====================================================
  -- نوع العقد
  -- =====================================================

  v_contract_type := trim(coalesce(p_contract_type, ''));

  if v_contract_type not in (
    'عقد بيع',
    'عقد تقسيط'
  ) then
    raise exception 'INVALID_CONTRACT_TYPE';
  end if;

  -- =====================================================
  -- المستثمر والمنتج
  -- =====================================================

  select
    fi.investor_name,
    fi.national_id
  into
    v_investor_name,
    v_investor_national_id
  from public.finance_investors as fi
  where fi.id = p_investor_id
    and fi.branch_id = p_branch_id
    and coalesce(fi.is_active, true) = true
  limit 1;

  if not found then
    raise exception 'INVESTOR_NOT_FOUND';
  end if;

  select
    fp.product_name,
    coalesce(fp.unit_price, 0)
  into
    v_product_name,
    v_product_unit_price
  from public.finance_products as fp
  where fp.id = p_product_id
    and fp.branch_id = p_branch_id
    and coalesce(fp.is_active, true) = true
  limit 1;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  v_product_quantity := round(
    coalesce(p_product_quantity, 0),
    2
  );

  if v_product_quantity <= 0 then
    raise exception 'INVALID_PRODUCT_QUANTITY';
  end if;

  -- =====================================================
  -- مبالغ العقد
  -- =====================================================

  v_debt_amount := round(
    case
      when coalesce(p_debt_amount, 0) > 0
        then p_debt_amount
      else v_product_quantity * v_product_unit_price
    end,
    2
  );

  v_payment_amount := round(
    coalesce(p_payment_amount, 0),
    2
  );

  if v_debt_amount <= 0 then
    raise exception 'INVALID_DEBT_AMOUNT';
  end if;

  if v_payment_amount <= 0 then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  -- لا توجد علاقة إلزامية بين قيمة البضاعة ومبلغ السداد.

  -- =====================================================
  -- مواعيد العقد
  -- =====================================================

  if p_first_due_date is null then
    raise exception 'FIRST_DUE_DATE_REQUIRED';
  end if;

  if p_contract_issue_date is null then
    raise exception 'CONTRACT_ISSUE_DATE_REQUIRED';
  end if;

  if p_first_due_date < p_contract_issue_date then
    raise exception 'DUE_DATE_BEFORE_CONTRACT_DATE';
  end if;

  if nullif(trim(coalesce(p_legal_city, '')), '') is null then
    raise exception 'LEGAL_CITY_REQUIRED';
  end if;

  -- =====================================================
  -- بيانات التقسيط
  -- =====================================================

  if v_contract_type = 'عقد تقسيط' then
    v_installment_amount := round(
      coalesce(p_installment_amount, 0),
      2
    );

    v_installments_count := coalesce(
      p_installments_count,
      0
    );

    if v_installment_amount <= 0 then
      raise exception 'INVALID_INSTALLMENT_AMOUNT';
    end if;

    if v_installments_count <= 0 then
      raise exception 'INVALID_INSTALLMENTS_COUNT';
    end if;

    if v_installments_count > 1
       and (
         v_installment_amount *
         (v_installments_count - 1)
       ) >= v_payment_amount
    then
      raise exception 'INSTALLMENTS_EXCEED_PAYMENT_AMOUNT';
    end if;
  else
    v_installment_amount := 0;
    v_installments_count := 1;
  end if;

  -- =====================================================
  -- بيانات الكفيل
  -- =====================================================

  if coalesce(p_has_guarantor, false) then
    if nullif(trim(coalesce(p_guarantor_name, '')), '') is null then
      raise exception 'GUARANTOR_NAME_REQUIRED';
    end if;

    if v_clean_guarantor_national_id !~ '^[0-9]{10}$' then
      raise exception 'INVALID_GUARANTOR_NATIONAL_ID';
    end if;

    if v_clean_guarantor_national_id = v_clean_national_id then
      raise exception 'GUARANTOR_SAME_AS_CUSTOMER';
    end if;

    if v_clean_guarantor_phone !~ '^05[0-9]{8}$' then
      raise exception 'INVALID_GUARANTOR_PHONE';
    end if;

    if v_clean_guarantor_birth_hijri !~
      '^[0-9]{4}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|30)$'
    then
      raise exception 'INVALID_GUARANTOR_HIJRI_BIRTH_DATE';
    end if;
  end if;

  -- =====================================================
  -- بيانات الطرف الأول
  -- =====================================================

  if p_print_party_type not in (
    'organization',
    'investor'
  ) then
    raise exception 'INVALID_PRINT_PARTY_TYPE';
  end if;

  if p_print_party_type = 'organization' then
    select
      fb.organization_name,
      fb.commercial_record
    into
      v_organization_name,
      v_commercial_record
    from public.finance_branches as fb
    where fb.id = p_branch_id
    limit 1;

    v_print_party_name :=
      nullif(trim(v_organization_name), '');

    v_print_party_identifier :=
      nullif(trim(v_commercial_record), '');
  else
    v_print_party_name :=
      nullif(trim(v_investor_name), '');

    v_print_party_identifier :=
      nullif(trim(v_investor_national_id), '');
  end if;

  if v_print_party_name is null then
    raise exception 'PRINT_PARTY_NAME_REQUIRED';
  end if;

  -- =====================================================
  -- إنشاء أو تحديث العميل
  -- =====================================================

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text
      || ':customer:'
      || v_clean_national_id,
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
    work,
    work_name,
    address,
    updated_at
  )
  values (
    p_branch_id,
    trim(p_full_name),
    v_clean_national_id,
    'hijri',
    v_clean_birth_hijri,
    null,
    v_clean_phone,
    nullif(trim(coalesce(p_work_name, '')), ''),
    nullif(trim(coalesce(p_work_name, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    now()
  )
  on conflict (branch_id, national_id)
  do update
  set
    full_name = excluded.full_name,
    birth_date_type = excluded.birth_date_type,
    birth_hijri = excluded.birth_hijri,
    birth_gregorian = null,
    phone = excluded.phone,
    work = excluded.work,
    work_name = excluded.work_name,
    address = excluded.address,
    is_archived = false,
    archived_at = null,
    archived_by = null,
    updated_at = now()
  returning id
  into v_customer_id;

  -- =====================================================
  -- إنشاء أو تحديث الكفيل كعميل
  -- =====================================================

  if coalesce(p_has_guarantor, false) then
    perform pg_advisory_xact_lock(
      hashtextextended(
        p_branch_id::text
        || ':customer:'
        || v_clean_guarantor_national_id,
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
      updated_at
    )
    values (
      p_branch_id,
      trim(p_guarantor_name),
      v_clean_guarantor_national_id,
      'hijri',
      v_clean_guarantor_birth_hijri,
      null,
      v_clean_guarantor_phone,
      now()
    )
    on conflict (branch_id, national_id)
    do update
    set
      full_name = excluded.full_name,
      birth_date_type = excluded.birth_date_type,
      birth_hijri = excluded.birth_hijri,
      birth_gregorian = null,
      phone = excluded.phone,
      updated_at = now()
    returning id
    into v_guarantor_customer_id;
  else
    v_guarantor_customer_id := null;
  end if;

  -- =====================================================
  -- إنشاء أو قفل سجل المخزون
  -- =====================================================

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
    0
  )
  on conflict (
    branch_id,
    investor_id,
    product_id
  )
  do nothing;

  select
    fi.id,
    coalesce(fi.quantity, 0)
  into
    v_stock_id,
    v_before_quantity
  from public.finance_inventory as fi
  where fi.branch_id = p_branch_id
    and fi.investor_id = p_investor_id
    and fi.product_id = p_product_id
  for update;

  if not found then
    raise exception 'INVENTORY_ROW_NOT_FOUND';
  end if;

  v_after_quantity :=
    v_before_quantity - v_product_quantity;

  if v_after_quantity < 0
     and not coalesce(p_allow_negative_inventory, false)
  then
    raise exception 'NEGATIVE_INVENTORY_CONFIRMATION_REQUIRED';
  end if;

  update public.finance_inventory
  set
    quantity = v_after_quantity,
    updated_at = now()
  where id = v_stock_id;

  -- =====================================================
  -- رقم العقد
  -- =====================================================

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text
      || ':contract-number',
      0
    )
  );

  select
    coalesce(max(fc.contract_number), 0) + 1
  into v_contract_number
  from public.finance_contracts as fc
  where fc.branch_id = p_branch_id;

  insert into public.finance_branch_sequences (
    branch_id,
    sequence_type,
    last_number
  )
  values (
    p_branch_id,
    'contract',
    v_contract_number
  )
  on conflict (
    branch_id,
    sequence_type
  )
  do update
  set
    last_number = greatest(
      public.finance_branch_sequences.last_number + 1,
      excluded.last_number
    ),
    updated_at = now()
  returning last_number
  into v_contract_number;

  -- =====================================================
  -- إنشاء العقد
  -- =====================================================

  insert into public.finance_contracts (
    branch_id,
    contract_number,

    customer_id,
    customer_name,
    customer_national_id,
    customer_phone,
    customer_birth_hijri,
    customer_work_name,

    contract_type,
    finance_type,

    investor_id,
    investor_name,

    product_id,
    product_name,
    product_quantity,

    print_party_type,
    print_party_name,
    print_party_identifier,

    first_party_type,
    first_party_name,
    first_party_identifier,

    debt_amount,
    payment_amount,
    installment_amount,

    has_deferred_payments,
    deferred_payments_count,

    payment_type,
    payment_due_date,

    contract_date_gregorian,
    contract_date_hijri,

    contract_issue_date_gregorian,
    contract_issue_date_hijri,

    legal_city,
    judicial_amount,
    notes,

    has_guarantor,
    guarantor_customer_id,
    guarantor_name,
    guarantor_national_id,
    guarantor_phone,
    guarantor_birth_hijri,

    contract_status,
    paid_amount,
    remaining_amount,

    created_by,
    created_at,
    updated_at
  )
  values (
    p_branch_id,
    v_contract_number,

    v_customer_id,
    trim(p_full_name),
    v_clean_national_id,
    v_clean_phone,
    v_clean_birth_hijri,
    nullif(trim(coalesce(p_work_name, '')), ''),

    v_contract_type,
    null,

    p_investor_id,
    v_investor_name,

    p_product_id,
    v_product_name,
    v_product_quantity,

    p_print_party_type,
    v_print_party_name,
    v_print_party_identifier,

    p_print_party_type,
    v_print_party_name,
    v_print_party_identifier,

    v_debt_amount,
    v_payment_amount,
    v_installment_amount,

    v_contract_type = 'عقد تقسيط',

    case
      when v_contract_type = 'عقد تقسيط'
        then v_installments_count
      else 0
    end,

    case
      when v_contract_type = 'عقد تقسيط'
        then 'دفعات شهرية'
      else 'دفعة آجلة واحدة'
    end,

    p_first_due_date::text,

    p_contract_issue_date::text,
    v_clean_issue_hijri,

    p_contract_issue_date,
    v_clean_issue_hijri,

    trim(p_legal_city),
    0,
    nullif(trim(coalesce(p_notes, '')), ''),

    coalesce(p_has_guarantor, false),
    v_guarantor_customer_id,

    case
      when coalesce(p_has_guarantor, false)
        then trim(p_guarantor_name)
      else null
    end,

    case
      when coalesce(p_has_guarantor, false)
        then v_clean_guarantor_national_id
      else null
    end,

    case
      when coalesce(p_has_guarantor, false)
        then v_clean_guarantor_phone
      else null
    end,

    case
      when coalesce(p_has_guarantor, false)
        then v_clean_guarantor_birth_hijri
      else null
    end,

    'نشط',
    0,
    v_payment_amount,

    v_employee_name,
    now(),
    now()
  )
  returning id
  into v_contract_id;

  -- =====================================================
  -- إنشاء جدول الدفعات
  -- =====================================================

  perform 1
  from public.create_contract_installments_from_contract_atomic(
    p_branch_id := p_branch_id,
    p_contract_id := v_contract_id,

    p_installment_amount :=
      case
        when v_contract_type = 'عقد تقسيط'
          then v_installment_amount
        else null
      end,

    p_installments_count :=
      case
        when v_contract_type = 'عقد تقسيط'
          then v_installments_count
        else 1
      end
  );

  -- =====================================================
  -- رقم السند
  -- =====================================================

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_branch_id::text
      || ':note-number',
      0
    )
  );

  select
    coalesce(max(fpn.note_number), 0) + 1
  into v_note_number
  from public.finance_promissory_notes as fpn
  where fpn.branch_id = p_branch_id;

  insert into public.finance_branch_sequences (
    branch_id,
    sequence_type,
    last_number
  )
  values (
    p_branch_id,
    'note',
    v_note_number
  )
  on conflict (
    branch_id,
    sequence_type
  )
  do update
  set
    last_number = greatest(
      public.finance_branch_sequences.last_number + 1,
      excluded.last_number
    ),
    updated_at = now()
  returning last_number
  into v_note_number;

  -- =====================================================
  -- إنشاء السند المرتبط بالعقد
  -- =====================================================

  insert into public.finance_promissory_notes (
    branch_id,
    note_number,

    note_mode,
    contract_id,
    customer_id,

    beneficiary_type,
    beneficiary_investor_id,
    beneficiary_name,
    beneficiary_identifier,

    debtor_name,
    debtor_national_id,
    debtor_phone,
    debtor_birth_date_type,
    debtor_birth_hijri,
    debtor_address,
    debtor_work_name,
    debtor_notes,

    amount,
    amount_words,

    due_date,
    due_phrase,

    city,
    notes,

    note_date_gregorian,
    note_date_hijri,
    note_issue_date_gregorian,
    note_issue_date_hijri,

    has_guarantor,
    guarantor_customer_id,
    guarantor_name,
    guarantor_national_id,
    guarantor_phone,
    guarantor_birth_date_type,
    guarantor_birth_hijri,

    deferred_payments_count,

    status,
    created_by,
    created_by_user_id,

    legal_body_text,
    legal_footer_text,

    created_at,
    updated_at
  )
  values (
    p_branch_id,
    v_note_number,

    'contract',
    v_contract_id,
    v_customer_id,

    p_print_party_type,

    case
      when p_print_party_type = 'investor'
        then p_investor_id
      else null
    end,

    v_print_party_name,
    v_print_party_identifier,

    trim(p_full_name),
    v_clean_national_id,
    v_clean_phone,
    'hijri',
    v_clean_birth_hijri,
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_work_name, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),

    v_payment_amount,
    null,

    p_first_due_date::text,
    'وتستحق كامل قيمة السند في التاريخ المحدد',

    trim(p_legal_city),
    nullif(trim(coalesce(p_notes, '')), ''),

    p_contract_issue_date::text,
    v_clean_issue_hijri,
    p_contract_issue_date,
    v_clean_issue_hijri,

    coalesce(p_has_guarantor, false),
    v_guarantor_customer_id,

    case
      when coalesce(p_has_guarantor, false)
        then trim(p_guarantor_name)
      else null
    end,

    case
      when coalesce(p_has_guarantor, false)
        then v_clean_guarantor_national_id
      else null
    end,

    case
      when coalesce(p_has_guarantor, false)
        then v_clean_guarantor_phone
      else null
    end,

    case
      when coalesce(p_has_guarantor, false)
        then 'hijri'
      else null
    end,

    case
      when coalesce(p_has_guarantor, false)
        then v_clean_guarantor_birth_hijri
      else null
    end,

    case
      when v_contract_type = 'عقد تقسيط'
        then v_installments_count
      else 0
    end,

    'نشط',
    v_employee_name,
    p_employee_id,

    v_legal_body_text,
    v_legal_footer_text,

    now(),
    now()
  )
  returning id
  into v_note_id;

  -- =====================================================
  -- حركة المخزون
  -- =====================================================

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
    v_contract_id,
    v_customer_id,

    'خصم',
    v_product_quantity,

    v_before_quantity,
    v_after_quantity,

    case
      when v_after_quantity < 0 then
        'خصم بسبب إنشاء طلب جديد للعميل '
        || trim(p_full_name)
        || ' مع السماح بوصول المخزون إلى السالب'
      else
        'خصم بسبب إنشاء طلب جديد للعميل '
        || trim(p_full_name)
    end,

    v_employee_name
  );

  -- =====================================================
  -- سجل النشاط
  -- =====================================================

  insert into public.finance_activity_logs (
    branch_id,
    activity_type,
    description,

    customer_id,
    contract_id,
    promissory_note_id,

    customer_name,
    employee_name,
    status,

    new_values,
    changed_fields,
    created_at
  )
  values (
    p_branch_id,
    'طلب جديد',

    'تم إنشاء '
    || v_contract_type
    || ' رقم '
    || v_contract_number::text
    || ' والسند رقم '
    || v_note_number::text
    || ' للعميل '
    || trim(p_full_name),

    v_customer_id,
    v_contract_id,
    v_note_id,

    trim(p_full_name),
    v_employee_name,

    case
      when v_after_quantity < 0
        then 'مخزون بالسالب'
      else 'نشط'
    end,

    jsonb_build_object(
      'contract_id', v_contract_id,
      'contract_number', v_contract_number,
      'note_id', v_note_id,
      'note_number', v_note_number,
      'contract_type', v_contract_type,
      'payment_amount', v_payment_amount,
      'debt_amount', v_debt_amount,
      'inventory_before', v_before_quantity,
      'inventory_after', v_after_quantity
    ),

    array[
      'إنشاء العميل أو تحديثه',
      'إنشاء العقد',
      'إنشاء جدول الدفعات',
      'إنشاء السند',
      'خصم المخزون'
    ]::text[],

    now()
  );

  -- =====================================================
  -- سجل تغييرات السند
  -- =====================================================

  select to_jsonb(fpn)
  into v_note_snapshot
  from public.finance_promissory_notes as fpn
  where fpn.id = v_note_id;

  insert into public.finance_promissory_note_change_logs (
    branch_id,
    promissory_note_id,
    contract_id,
    customer_id,
    note_number,

    change_type,
    changed_fields,
    old_values,
    new_values,

    previous_amount,
    new_amount,

    employee_id,
    employee_name,
    change_note,
    created_at
  )
  values (
    p_branch_id,
    v_note_id,
    v_contract_id,
    v_customer_id,
    v_note_number,

    'create',
    array['إنشاء السند مع الطلب الجديد']::text[],
    '{}'::jsonb,
    v_note_snapshot,

    null,
    v_payment_amount,

    p_employee_id,
    v_employee_name,
    'تم إنشاء السند تلقائيًا مع الطلب الجديد',
    now()
  );

  return query
  select
    v_contract_id,
    v_note_id,
    v_customer_id,
    v_contract_number,
    v_note_number;
end;
$_$;

ALTER FUNCTION "public"."create_new_request_secure_atomic"("p_branch_id" "uuid", "p_employee_id" "uuid", "p_employee_name" "text", "p_full_name" "text", "p_national_id" "text", "p_birth_hijri" "text", "p_phone" "text", "p_work_name" "text", "p_address" "text", "p_contract_type" "text", "p_investor_id" "uuid", "p_product_id" "uuid", "p_product_quantity" numeric, "p_print_party_type" "text", "p_debt_amount" numeric, "p_payment_amount" numeric, "p_installment_amount" numeric, "p_installments_count" integer, "p_first_due_date" "date", "p_contract_issue_date" "date", "p_contract_issue_date_hijri" "text", "p_legal_city" "text", "p_notes" "text", "p_has_guarantor" boolean, "p_guarantor_name" "text", "p_guarantor_national_id" "text", "p_guarantor_phone" "text", "p_guarantor_birth_hijri" "text", "p_allow_negative_inventory" boolean) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."create_new_request_secure_atomic"("p_branch_id" "uuid", "p_employee_id" "uuid", "p_employee_name" "text", "p_full_name" "text", "p_national_id" "text", "p_birth_hijri" "text", "p_phone" "text", "p_work_name" "text", "p_address" "text", "p_contract_type" "text", "p_investor_id" "uuid", "p_product_id" "uuid", "p_product_quantity" numeric, "p_print_party_type" "text", "p_debt_amount" numeric, "p_payment_amount" numeric, "p_installment_amount" numeric, "p_installments_count" integer, "p_first_due_date" "date", "p_contract_issue_date" "date", "p_contract_issue_date_hijri" "text", "p_legal_city" "text", "p_notes" "text", "p_has_guarantor" boolean, "p_guarantor_name" "text", "p_guarantor_national_id" "text", "p_guarantor_phone" "text", "p_guarantor_birth_hijri" "text", "p_allow_negative_inventory" boolean) IS 'إنشاء طلب جديد ذري وآمن عبر الخادم: عميل، عقد، دفعات، سند، مخزون وسجلات النشاط.';

GRANT ALL ON FUNCTION "public"."create_new_request_atomic"("p_branch_id" "uuid", "p_full_name" "text", "p_national_id" "text", "p_birth_hijri" "text", "p_phone" "text", "p_work_name" "text", "p_address" "text", "p_finance_type" "text", "p_investor_id" "uuid", "p_investor_name" "text", "p_product_id" "uuid", "p_product_name" "text", "p_product_quantity" numeric, "p_print_party_type" "text", "p_print_party_name" "text", "p_print_party_identifier" "text", "p_debt_amount" numeric, "p_payment_amount" numeric, "p_has_deferred_payments" boolean, "p_installment_amount" numeric, "p_deferred_payments_count" numeric, "p_payment_type" "text", "p_payment_due_date" "text", "p_contract_issue_date_gregorian" "text", "p_contract_issue_date_hijri" "text", "p_legal_city" "text", "p_notes" "text", "p_has_guarantor" boolean, "p_guarantor_name" "text", "p_guarantor_national_id" "text", "p_guarantor_phone" "text", "p_guarantor_birth_hijri" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_new_request_atomic"("p_branch_id" "uuid", "p_full_name" "text", "p_national_id" "text", "p_birth_hijri" "text", "p_phone" "text", "p_work_name" "text", "p_address" "text", "p_finance_type" "text", "p_investor_id" "uuid", "p_investor_name" "text", "p_product_id" "uuid", "p_product_name" "text", "p_product_quantity" numeric, "p_print_party_type" "text", "p_print_party_name" "text", "p_print_party_identifier" "text", "p_debt_amount" numeric, "p_payment_amount" numeric, "p_has_deferred_payments" boolean, "p_installment_amount" numeric, "p_deferred_payments_count" numeric, "p_payment_type" "text", "p_payment_due_date" "text", "p_contract_issue_date_gregorian" "text", "p_contract_issue_date_hijri" "text", "p_legal_city" "text", "p_notes" "text", "p_has_guarantor" boolean, "p_guarantor_name" "text", "p_guarantor_national_id" "text", "p_guarantor_phone" "text", "p_guarantor_birth_hijri" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_new_request_atomic"("p_branch_id" "uuid", "p_full_name" "text", "p_national_id" "text", "p_birth_hijri" "text", "p_phone" "text", "p_work_name" "text", "p_address" "text", "p_finance_type" "text", "p_investor_id" "uuid", "p_investor_name" "text", "p_product_id" "uuid", "p_product_name" "text", "p_product_quantity" numeric, "p_print_party_type" "text", "p_print_party_name" "text", "p_print_party_identifier" "text", "p_debt_amount" numeric, "p_payment_amount" numeric, "p_has_deferred_payments" boolean, "p_installment_amount" numeric, "p_deferred_payments_count" numeric, "p_payment_type" "text", "p_payment_due_date" "text", "p_contract_issue_date_gregorian" "text", "p_contract_issue_date_hijri" "text", "p_legal_city" "text", "p_notes" "text", "p_has_guarantor" boolean, "p_guarantor_name" "text", "p_guarantor_national_id" "text", "p_guarantor_phone" "text", "p_guarantor_birth_hijri" "text") TO "service_role";
REVOKE ALL ON FUNCTION "public"."create_new_request_secure_atomic"("p_branch_id" "uuid", "p_employee_id" "uuid", "p_employee_name" "text", "p_full_name" "text", "p_national_id" "text", "p_birth_hijri" "text", "p_phone" "text", "p_work_name" "text", "p_address" "text", "p_contract_type" "text", "p_investor_id" "uuid", "p_product_id" "uuid", "p_product_quantity" numeric, "p_print_party_type" "text", "p_debt_amount" numeric, "p_payment_amount" numeric, "p_installment_amount" numeric, "p_installments_count" integer, "p_first_due_date" "date", "p_contract_issue_date" "date", "p_contract_issue_date_hijri" "text", "p_legal_city" "text", "p_notes" "text", "p_has_guarantor" boolean, "p_guarantor_name" "text", "p_guarantor_national_id" "text", "p_guarantor_phone" "text", "p_guarantor_birth_hijri" "text", "p_allow_negative_inventory" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_new_request_secure_atomic"("p_branch_id" "uuid", "p_employee_id" "uuid", "p_employee_name" "text", "p_full_name" "text", "p_national_id" "text", "p_birth_hijri" "text", "p_phone" "text", "p_work_name" "text", "p_address" "text", "p_contract_type" "text", "p_investor_id" "uuid", "p_product_id" "uuid", "p_product_quantity" numeric, "p_print_party_type" "text", "p_debt_amount" numeric, "p_payment_amount" numeric, "p_installment_amount" numeric, "p_installments_count" integer, "p_first_due_date" "date", "p_contract_issue_date" "date", "p_contract_issue_date_hijri" "text", "p_legal_city" "text", "p_notes" "text", "p_has_guarantor" boolean, "p_guarantor_name" "text", "p_guarantor_national_id" "text", "p_guarantor_phone" "text", "p_guarantor_birth_hijri" "text", "p_allow_negative_inventory" boolean) TO "service_role";
