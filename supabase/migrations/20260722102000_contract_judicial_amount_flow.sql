-- Migration: support contract litigation amount across contract creation flows.
-- Uses the existing finance_contracts.judicial_amount column without changing financial calculations.

DO $$
BEGIN
  IF to_regclass('public.finance_contracts') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'finance_contracts'
         AND column_name = 'judicial_amount'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'finance_contracts_judicial_amount_nonnegative_chk'
         AND conrelid = 'public.finance_contracts'::regclass
     )
  THEN
    ALTER TABLE public.finance_contracts
      ADD CONSTRAINT finance_contracts_judicial_amount_nonnegative_chk
      CHECK (judicial_amount IS NULL OR judicial_amount >= 0)
      NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_new_request_secure_optional_city_atomic(
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
  p_allow_negative_inventory boolean DEFAULT false,
  p_judicial_amount numeric DEFAULT NULL
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
  v_judicial_amount numeric(14, 2);
BEGIN
  v_judicial_amount := round(coalesce(p_judicial_amount, 0), 2);

  IF v_judicial_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_JUDICIAL_AMOUNT';
  END IF;

  SELECT *
  INTO v_result
  FROM public.create_new_request_secure_optional_city_atomic(
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
    p_legal_city := p_legal_city,
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
    judicial_amount = v_judicial_amount,
    updated_at = now()
  WHERE fc.id = v_result.contract_id
    AND fc.branch_id = p_branch_id;

  RETURN QUERY
  SELECT
    v_result.contract_id::uuid,
    v_result.note_id::uuid,
    v_result.customer_id::uuid,
    v_result.contract_number::bigint,
    v_result.note_number::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.create_new_request_secure_optional_city_atomic(uuid, uuid, text, text, text, text, text, text, text, text, uuid, uuid, numeric, text, numeric, numeric, numeric, integer, date, date, text, text, text, boolean, text, text, text, text, boolean, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_new_request_secure_optional_city_atomic(uuid, uuid, text, text, text, text, text, text, text, text, uuid, uuid, numeric, text, numeric, numeric, numeric, integer, date, date, text, text, text, boolean, text, text, text, text, boolean, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.create_new_request_secure_optional_city_atomic(uuid, uuid, text, text, text, text, text, text, text, text, uuid, uuid, numeric, text, numeric, numeric, numeric, integer, date, date, text, text, text, boolean, text, text, text, text, boolean, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_new_request_secure_optional_city_atomic(uuid, uuid, text, text, text, text, text, text, text, text, uuid, uuid, numeric, text, numeric, numeric, numeric, integer, date, date, text, text, text, boolean, text, text, text, text, boolean, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.create_free_sale_contract_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_buyer_name text,
  p_buyer_national_id text,
  p_buyer_phone text,
  p_sale_day text,
  p_contract_date date,
  p_city text,
  p_seller_name text,
  p_seller_national_id text,
  p_item_description text,
  p_due_amount numeric,
  p_payment_method text,
  p_due_date date,
  p_seller_signature_name text,
  p_buyer_signature_name text,
  p_judicial_amount numeric DEFAULT NULL
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
  v_judicial_amount numeric(14, 2);
BEGIN
  v_judicial_amount := round(coalesce(p_judicial_amount, 0), 2);

  IF v_judicial_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_JUDICIAL_AMOUNT';
  END IF;

  SELECT *
  INTO v_result
  FROM public.create_free_sale_contract_atomic(
    p_branch_id := p_branch_id,
    p_employee_id := p_employee_id,
    p_buyer_name := p_buyer_name,
    p_buyer_national_id := p_buyer_national_id,
    p_buyer_phone := p_buyer_phone,
    p_sale_day := p_sale_day,
    p_contract_date := p_contract_date,
    p_city := p_city,
    p_seller_name := p_seller_name,
    p_seller_national_id := p_seller_national_id,
    p_item_description := p_item_description,
    p_due_amount := p_due_amount,
    p_payment_method := p_payment_method,
    p_due_date := p_due_date,
    p_seller_signature_name := p_seller_signature_name,
    p_buyer_signature_name := p_buyer_signature_name
  );

  UPDATE public.finance_contracts AS fc
  SET
    judicial_amount = v_judicial_amount,
    updated_at = now()
  WHERE fc.id = v_result.contract_id
    AND fc.branch_id = p_branch_id;

  RETURN QUERY
  SELECT
    v_result.contract_id::uuid,
    v_result.note_id::uuid,
    v_result.customer_id::uuid,
    v_result.contract_number::bigint,
    v_result.note_number::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.create_free_sale_contract_atomic(uuid, uuid, text, text, text, text, date, text, text, text, text, numeric, text, date, text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_free_sale_contract_atomic(uuid, uuid, text, text, text, text, date, text, text, text, text, numeric, text, date, text, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.create_free_sale_contract_atomic(uuid, uuid, text, text, text, text, date, text, text, text, text, numeric, text, date, text, text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_free_sale_contract_atomic(uuid, uuid, text, text, text, text, date, text, text, text, text, numeric, text, date, text, text, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.update_free_sale_contract_atomic(
  p_branch_id uuid,
  p_employee_id uuid,
  p_contract_id uuid,
  p_buyer_name text,
  p_buyer_national_id text,
  p_buyer_phone text,
  p_sale_day text,
  p_contract_date date,
  p_city text,
  p_seller_name text,
  p_seller_national_id text,
  p_item_description text,
  p_due_amount numeric,
  p_payment_method text,
  p_due_date date,
  p_seller_signature_name text,
  p_buyer_signature_name text,
  p_judicial_amount numeric DEFAULT NULL
) RETURNS TABLE(
  contract_id uuid,
  customer_id uuid,
  new_remaining_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result record;
  v_judicial_amount numeric(14, 2);
BEGIN
  v_judicial_amount := round(coalesce(p_judicial_amount, 0), 2);

  IF v_judicial_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_JUDICIAL_AMOUNT';
  END IF;

  SELECT *
  INTO v_result
  FROM public.update_free_sale_contract_atomic(
    p_branch_id := p_branch_id,
    p_employee_id := p_employee_id,
    p_contract_id := p_contract_id,
    p_buyer_name := p_buyer_name,
    p_buyer_national_id := p_buyer_national_id,
    p_buyer_phone := p_buyer_phone,
    p_sale_day := p_sale_day,
    p_contract_date := p_contract_date,
    p_city := p_city,
    p_seller_name := p_seller_name,
    p_seller_national_id := p_seller_national_id,
    p_item_description := p_item_description,
    p_due_amount := p_due_amount,
    p_payment_method := p_payment_method,
    p_due_date := p_due_date,
    p_seller_signature_name := p_seller_signature_name,
    p_buyer_signature_name := p_buyer_signature_name
  );

  UPDATE public.finance_contracts AS fc
  SET
    judicial_amount = v_judicial_amount,
    updated_at = now()
  WHERE fc.id = p_contract_id
    AND fc.branch_id = p_branch_id;

  RETURN QUERY
  SELECT
    v_result.contract_id::uuid,
    v_result.customer_id::uuid,
    v_result.new_remaining_amount::numeric;
END;
$$;

REVOKE ALL ON FUNCTION public.update_free_sale_contract_atomic(uuid, uuid, uuid, text, text, text, text, date, text, text, text, text, numeric, text, date, text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_free_sale_contract_atomic(uuid, uuid, uuid, text, text, text, text, date, text, text, text, text, numeric, text, date, text, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.update_free_sale_contract_atomic(uuid, uuid, uuid, text, text, text, text, date, text, text, text, text, numeric, text, date, text, text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_free_sale_contract_atomic(uuid, uuid, uuid, text, text, text, text, date, text, text, text, text, numeric, text, date, text, text, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.update_finance_contract_atomic(
  p_branch_id uuid,
  p_contract_id uuid,
  p_employee_id uuid,
  p_employee_name text,
  p_investor_id uuid,
  p_investor_name text,
  p_product_id uuid,
  p_product_name text,
  p_product_quantity numeric,
  p_print_party_type text,
  p_print_party_name text,
  p_print_party_identifier text,
  p_debt_amount numeric,
  p_payment_amount numeric,
  p_installment_amount numeric,
  p_payment_type text,
  p_payment_due_date date,
  p_legal_city text,
  p_notes text,
  p_judicial_amount numeric DEFAULT NULL
) RETURNS TABLE(
  contract_id uuid,
  investor_id uuid,
  product_id uuid,
  product_quantity numeric,
  new_remaining_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result record;
  v_judicial_amount numeric(14, 2);
BEGIN
  v_judicial_amount := round(coalesce(p_judicial_amount, 0), 2);

  IF v_judicial_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_JUDICIAL_AMOUNT';
  END IF;

  SELECT *
  INTO v_result
  FROM public.update_finance_contract_atomic(
    p_branch_id := p_branch_id,
    p_contract_id := p_contract_id,
    p_employee_id := p_employee_id,
    p_employee_name := p_employee_name,
    p_investor_id := p_investor_id,
    p_investor_name := p_investor_name,
    p_product_id := p_product_id,
    p_product_name := p_product_name,
    p_product_quantity := p_product_quantity,
    p_print_party_type := p_print_party_type,
    p_print_party_name := p_print_party_name,
    p_print_party_identifier := p_print_party_identifier,
    p_debt_amount := p_debt_amount,
    p_payment_amount := p_payment_amount,
    p_installment_amount := p_installment_amount,
    p_payment_type := p_payment_type,
    p_payment_due_date := p_payment_due_date,
    p_legal_city := p_legal_city,
    p_notes := p_notes
  );

  UPDATE public.finance_contracts AS fc
  SET
    judicial_amount = v_judicial_amount,
    updated_at = now()
  WHERE fc.id = p_contract_id
    AND fc.branch_id = p_branch_id;

  RETURN QUERY
  SELECT
    v_result.contract_id::uuid,
    v_result.investor_id::uuid,
    v_result.product_id::uuid,
    v_result.product_quantity::numeric,
    v_result.new_remaining_amount::numeric;
END;
$$;

REVOKE ALL ON FUNCTION public.update_finance_contract_atomic(uuid, uuid, uuid, text, uuid, text, uuid, text, numeric, text, text, text, numeric, numeric, numeric, text, date, text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_finance_contract_atomic(uuid, uuid, uuid, text, uuid, text, uuid, text, numeric, text, text, text, numeric, numeric, numeric, text, date, text, text, numeric) FROM anon;
REVOKE ALL ON FUNCTION public.update_finance_contract_atomic(uuid, uuid, uuid, text, uuid, text, uuid, text, numeric, text, text, text, numeric, numeric, numeric, text, date, text, text, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_finance_contract_atomic(uuid, uuid, uuid, text, uuid, text, uuid, text, numeric, text, text, text, numeric, numeric, numeric, text, date, text, text, numeric) TO service_role;
