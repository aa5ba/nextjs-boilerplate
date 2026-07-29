-- Migration: fix cash wallet operation id
-- Local migration file; validate locally before any remote deployment.

CREATE OR REPLACE FUNCTION public.deposit_investor_cash_wallet_secure_atomic(
  p_branch_id uuid,
  p_investor_id uuid,
  p_actor_user_id uuid,
  p_actor_user_name text,
  p_amount numeric,
  p_note text,
  p_idempotency_key text
) RETURNS TABLE (
  transaction_id uuid,
  wallet_id uuid,
  balance_before numeric,
  balance_after numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor public.finance_branch_users%rowtype;
  v_investor public.finance_investors%rowtype;
  v_wallet public.finance_investor_wallets%rowtype;
  v_existing public.finance_investor_wallet_transactions%rowtype;
  v_actor_name text;
  v_note text;
  v_key text;
  v_amount numeric;
  v_before numeric;
  v_after numeric;
  v_operation_id uuid := gen_random_uuid();
  v_has_permission boolean := false;
BEGIN
  v_amount := round(coalesce(p_amount, 0), 2);
  v_actor_name := nullif(trim(coalesce(p_actor_user_name, '')), '');
  v_note := nullif(left(trim(coalesce(p_note, '')), 500), '');
  v_key := nullif(left(trim(coalesce(p_idempotency_key, '')), 120), '');

  IF v_amount <= 0 THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'INVALID_AMOUNT';
  END IF;

  SELECT fbu.*
  INTO v_actor
  FROM public.finance_branch_users AS fbu
  WHERE fbu.id = p_actor_user_id
    AND fbu.branch_id = p_branch_id
  LIMIT 1;

  IF NOT FOUND
     OR v_actor.is_active IS DISTINCT FROM true
     OR coalesce(v_actor.self_disabled, false) = true
     OR v_actor.disabled_at IS NOT NULL
  THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'INVALID_SESSION';
  END IF;

  v_has_permission :=
    v_actor.role IN ('main_admin', 'branch_manager', 'مدير رئيسي', 'مدير فرع', 'مدير')
    OR public.finance_user_has_permission(
      p_branch_id,
      p_actor_user_id,
      'deposit_investor_cash_wallet'
    );

  IF NOT v_has_permission THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'MISSING_PERMISSION';
  END IF;

  IF v_actor_name IS NULL THEN
    v_actor_name := coalesce(nullif(trim(v_actor.full_name), ''), nullif(trim(v_actor.username), ''), 'الموظف');
  END IF;

  SELECT fi.*
  INTO v_investor
  FROM public.finance_investors AS fi
  WHERE fi.id = p_investor_id
    AND fi.branch_id = p_branch_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'INVESTOR_NOT_FOUND';
  END IF;

  IF coalesce(v_investor.is_active, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'INVESTOR_INACTIVE';
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT fwt.*
    INTO v_existing
    FROM public.finance_investor_wallet_transactions AS fwt
    WHERE fwt.branch_id = p_branch_id
      AND fwt.idempotency_key = v_key
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT
        v_existing.id,
        v_existing.wallet_id,
        v_existing.balance_before,
        v_existing.balance_after;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.finance_investor_wallets (
    branch_id,
    investor_id,
    wallet_type,
    balance_amount
  )
  VALUES (
    p_branch_id,
    p_investor_id,
    'cash',
    0
  )
  ON CONFLICT (branch_id, investor_id, wallet_type)
  DO NOTHING;

  SELECT fw.*
  INTO v_wallet
  FROM public.finance_investor_wallets AS fw
  WHERE fw.branch_id = p_branch_id
    AND fw.investor_id = p_investor_id
    AND fw.wallet_type = 'cash'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'WALLET_NOT_FOUND';
  END IF;

  v_before := coalesce(v_wallet.balance_amount, 0);
  v_after := v_before + v_amount;

  UPDATE public.finance_investor_wallets AS fw
  SET
    balance_amount = v_after,
    updated_at = now()
  WHERE fw.id = v_wallet.id;

  INSERT INTO public.finance_investor_wallet_transactions (
    branch_id,
    investor_id,
    wallet_id,
    wallet_type,
    direction,
    amount,
    balance_before,
    balance_after,
    transaction_type,
    note,
    actor_user_id,
    actor_user_name,
    operation_id,
    idempotency_key
  )
  VALUES (
    p_branch_id,
    p_investor_id,
    v_wallet.id,
    'cash',
    'credit',
    v_amount,
    v_before,
    v_after,
    'cash_deposit',
    v_note,
    p_actor_user_id,
    v_actor_name,
    v_operation_id,
    v_key
  )
  RETURNING *
  INTO v_existing;

  INSERT INTO public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    employee_name,
    status
  )
  VALUES (
    p_branch_id,
    'إضافة رصيد مستثمر',
    'تمت إضافة رصيد نقدي لمحفظة المستثمر ' || coalesce(v_investor.investor_name, ''),
    v_actor_name,
    'نشط'
  );

  RETURN QUERY
  SELECT
    v_existing.id,
    v_wallet.id,
    v_before,
    v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_investor_cash_wallet_secure_atomic(
  p_branch_id uuid,
  p_investor_id uuid,
  p_actor_user_id uuid,
  p_actor_user_name text,
  p_amount numeric,
  p_note text,
  p_idempotency_key text
) RETURNS TABLE (
  transaction_id uuid,
  wallet_id uuid,
  balance_before numeric,
  balance_after numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor public.finance_branch_users%rowtype;
  v_investor public.finance_investors%rowtype;
  v_wallet public.finance_investor_wallets%rowtype;
  v_existing public.finance_investor_wallet_transactions%rowtype;
  v_actor_name text;
  v_note text;
  v_key text;
  v_amount numeric;
  v_before numeric;
  v_after numeric;
  v_operation_id uuid := gen_random_uuid();
  v_has_permission boolean := false;
BEGIN
  v_amount := round(coalesce(p_amount, 0), 2);
  v_actor_name := nullif(trim(coalesce(p_actor_user_name, '')), '');
  v_note := nullif(left(trim(coalesce(p_note, '')), 500), '');
  v_key := nullif(left(trim(coalesce(p_idempotency_key, '')), 120), '');

  IF v_amount <= 0 THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'INVALID_AMOUNT';
  END IF;

  SELECT fbu.*
  INTO v_actor
  FROM public.finance_branch_users AS fbu
  WHERE fbu.id = p_actor_user_id
    AND fbu.branch_id = p_branch_id
  LIMIT 1;

  IF NOT FOUND
     OR v_actor.is_active IS DISTINCT FROM true
     OR coalesce(v_actor.self_disabled, false) = true
     OR v_actor.disabled_at IS NOT NULL
  THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'INVALID_SESSION';
  END IF;

  v_has_permission :=
    v_actor.role IN ('main_admin', 'branch_manager', 'مدير رئيسي', 'مدير فرع', 'مدير')
    OR public.finance_user_has_permission(
      p_branch_id,
      p_actor_user_id,
      'withdraw_investor_cash_wallet'
    );

  IF NOT v_has_permission THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'MISSING_PERMISSION';
  END IF;

  IF v_actor_name IS NULL THEN
    v_actor_name := coalesce(nullif(trim(v_actor.full_name), ''), nullif(trim(v_actor.username), ''), 'الموظف');
  END IF;

  SELECT fi.*
  INTO v_investor
  FROM public.finance_investors AS fi
  WHERE fi.id = p_investor_id
    AND fi.branch_id = p_branch_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'INVESTOR_NOT_FOUND';
  END IF;

  IF coalesce(v_investor.is_active, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'INVESTOR_INACTIVE';
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT fwt.*
    INTO v_existing
    FROM public.finance_investor_wallet_transactions AS fwt
    WHERE fwt.branch_id = p_branch_id
      AND fwt.idempotency_key = v_key
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT
        v_existing.id,
        v_existing.wallet_id,
        v_existing.balance_before,
        v_existing.balance_after;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.finance_investor_wallets (
    branch_id,
    investor_id,
    wallet_type,
    balance_amount
  )
  VALUES (
    p_branch_id,
    p_investor_id,
    'cash',
    0
  )
  ON CONFLICT (branch_id, investor_id, wallet_type)
  DO NOTHING;

  SELECT fw.*
  INTO v_wallet
  FROM public.finance_investor_wallets AS fw
  WHERE fw.branch_id = p_branch_id
    AND fw.investor_id = p_investor_id
    AND fw.wallet_type = 'cash'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'WALLET_NOT_FOUND';
  END IF;

  v_before := coalesce(v_wallet.balance_amount, 0);

  IF v_before < v_amount THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'INSUFFICIENT_CASH_BALANCE';
  END IF;

  v_after := v_before - v_amount;

  UPDATE public.finance_investor_wallets AS fw
  SET
    balance_amount = v_after,
    updated_at = now()
  WHERE fw.id = v_wallet.id;

  INSERT INTO public.finance_investor_wallet_transactions (
    branch_id,
    investor_id,
    wallet_id,
    wallet_type,
    direction,
    amount,
    balance_before,
    balance_after,
    transaction_type,
    note,
    actor_user_id,
    actor_user_name,
    operation_id,
    idempotency_key
  )
  VALUES (
    p_branch_id,
    p_investor_id,
    v_wallet.id,
    'cash',
    'debit',
    v_amount,
    v_before,
    v_after,
    'cash_withdrawal',
    v_note,
    p_actor_user_id,
    v_actor_name,
    v_operation_id,
    v_key
  )
  RETURNING *
  INTO v_existing;

  INSERT INTO public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    employee_name,
    status
  )
  VALUES (
    p_branch_id,
    'سحب رصيد مستثمر',
    'تم سحب رصيد نقدي من محفظة المستثمر ' || coalesce(v_investor.investor_name, ''),
    v_actor_name,
    'نشط'
  );

  RETURN QUERY
  SELECT
    v_existing.id,
    v_wallet.id,
    v_before,
    v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.deposit_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deposit_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.deposit_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.deposit_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.withdraw_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.withdraw_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) TO service_role;
