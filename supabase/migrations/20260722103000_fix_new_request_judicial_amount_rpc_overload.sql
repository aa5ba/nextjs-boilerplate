-- Migration: resolve new-request judicial amount RPC overload ambiguity.
-- Keeps the judicial_amount flow explicit and removes the older conflicting optional-city signature.

DROP FUNCTION IF EXISTS public.create_new_request_secure_optional_city_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  boolean,
  numeric
);

CREATE FUNCTION public.create_new_request_secure_optional_city_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_employee_name text,
  p_full_name text,
  p_national_id text,
  p_birth_hijri text,
  p_phone text,
  p_work_name text,
  p_address text,
  p_contract_type text,
  p_investor_id uuid,
  p_product_id uuid,
  p_product_quantity numeric,
  p_print_party_type text,
  p_debt_amount numeric,
  p_payment_amount numeric,
  p_installment_amount numeric,
  p_installments_count integer,
  p_first_due_date date,
  p_contract_issue_date date,
  p_contract_issue_date_hijri text,
  p_legal_city text,
  p_notes text,
  p_has_guarantor boolean,
  p_guarantor_name text,
  p_guarantor_national_id text,
  p_guarantor_phone text,
  p_guarantor_birth_hijri text,
  p_allow_negative_inventory boolean,
  p_judicial_amount numeric
) RETURNS TABLE(
  contract_id uuid,
  note_id uuid,
  customer_id uuid,
  contract_number bigint,
  note_number bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result record;
  v_legal_city text;
  v_internal_city text;
  v_judicial_amount numeric(14, 2);
BEGIN
  v_judicial_amount := round(coalesce(p_judicial_amount, 0), 2);

  IF v_judicial_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_JUDICIAL_AMOUNT';
  END IF;

  v_legal_city :=
    nullif(trim(coalesce(p_legal_city, '')), '');

  /*
    الدالة الأصلية تشترط وجود مدينة التقاضي.
    نمرر قيمة داخلية مؤقتة عند تركها فارغة، ثم نمسحها
    من العقد والسند داخل المعاملة نفسها قبل الإرجاع.
  */
  v_internal_city := coalesce(
    v_legal_city,
    '__OPTIONAL_CITY_NOT_PROVIDED__'
  );

  SELECT *
  INTO v_result
  FROM public.create_new_request_secure_atomic(
    p_branch_id := p_branch_id,
    p_employee_id := p_employee_id,
    p_employee_name := p_employee_name,

    p_full_name := p_full_name,
    p_national_id := p_national_id,
    p_birth_hijri := p_birth_hijri,
    p_phone := p_phone,
    p_work_name := p_work_name,
    p_address := p_address,

    p_contract_type := p_contract_type,

    p_investor_id := p_investor_id,
    p_product_id := p_product_id,
    p_product_quantity := p_product_quantity,

    p_print_party_type := p_print_party_type,

    p_debt_amount := p_debt_amount,
    p_payment_amount := p_payment_amount,

    p_installment_amount := p_installment_amount,
    p_installments_count := p_installments_count,

    p_first_due_date := p_first_due_date,
    p_contract_issue_date := p_contract_issue_date,
    p_contract_issue_date_hijri := p_contract_issue_date_hijri,

    p_legal_city := v_internal_city,
    p_notes := p_notes,

    p_has_guarantor := p_has_guarantor,
    p_guarantor_name := p_guarantor_name,
    p_guarantor_national_id := p_guarantor_national_id,
    p_guarantor_phone := p_guarantor_phone,
    p_guarantor_birth_hijri := p_guarantor_birth_hijri,

    p_allow_negative_inventory := p_allow_negative_inventory
  );

  UPDATE public.finance_contracts AS fc
  SET
    legal_city = CASE
      WHEN v_legal_city IS NULL THEN NULL
      ELSE fc.legal_city
    END,
    judicial_amount = v_judicial_amount,
    updated_at = now()
  WHERE fc.id = v_result.contract_id
    AND fc.branch_id = p_branch_id;

  IF v_legal_city IS NULL THEN
    UPDATE public.finance_promissory_notes AS fpn
    SET
      city = NULL,
      updated_at = now()
    WHERE fpn.id = v_result.note_id
      AND fpn.branch_id = p_branch_id;
  END IF;

  RETURN QUERY
  SELECT
    v_result.contract_id::uuid,
    v_result.note_id::uuid,
    v_result.customer_id::uuid,
    v_result.contract_number::bigint,
    v_result.note_number::bigint;
END;
$$;

DROP FUNCTION IF EXISTS public.create_new_request_secure_optional_city_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  boolean
);

REVOKE ALL ON FUNCTION public.create_new_request_secure_optional_city_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  boolean,
  numeric
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_new_request_secure_optional_city_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  boolean,
  numeric
) FROM anon;

REVOKE ALL ON FUNCTION public.create_new_request_secure_optional_city_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  boolean,
  numeric
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.create_new_request_secure_optional_city_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  numeric,
  text,
  numeric,
  numeric,
  numeric,
  integer,
  date,
  date,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  boolean,
  numeric
) TO service_role;
