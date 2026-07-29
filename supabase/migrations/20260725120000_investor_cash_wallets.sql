-- Migration: investor cash wallets
-- Local migration file; validate locally before any remote deployment.

CREATE TABLE IF NOT EXISTS public.finance_investor_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  investor_id uuid NOT NULL,
  wallet_type text NOT NULL,
  balance_amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_investor_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  investor_id uuid NOT NULL,
  wallet_id uuid NOT NULL,
  wallet_type text NOT NULL,
  direction text NOT NULL,
  amount numeric NOT NULL,
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  transaction_type text NOT NULL,
  note text,
  actor_user_id uuid,
  actor_user_name text,
  idempotency_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallets_branch_fkey'
      AND conrelid = 'public.finance_investor_wallets'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallets
      ADD CONSTRAINT finance_investor_wallets_branch_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.finance_branches(id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallets_investor_fkey'
      AND conrelid = 'public.finance_investor_wallets'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallets
      ADD CONSTRAINT finance_investor_wallets_investor_fkey
      FOREIGN KEY (investor_id)
      REFERENCES public.finance_investors(id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallets_type_chk'
      AND conrelid = 'public.finance_investor_wallets'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallets
      ADD CONSTRAINT finance_investor_wallets_type_chk
      CHECK (wallet_type IN ('cash', 'goods', 'contracts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallets_balance_nonnegative_chk'
      AND conrelid = 'public.finance_investor_wallets'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallets
      ADD CONSTRAINT finance_investor_wallets_balance_nonnegative_chk
      CHECK (balance_amount >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallets_unique_wallet'
      AND conrelid = 'public.finance_investor_wallets'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallets
      ADD CONSTRAINT finance_investor_wallets_unique_wallet
      UNIQUE (branch_id, investor_id, wallet_type);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_branch_fkey'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_branch_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.finance_branches(id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_investor_fkey'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_investor_fkey
      FOREIGN KEY (investor_id)
      REFERENCES public.finance_investors(id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_wallet_fkey'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_wallet_fkey
      FOREIGN KEY (wallet_id)
      REFERENCES public.finance_investor_wallets(id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_type_chk'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_type_chk
      CHECK (wallet_type IN ('cash', 'goods', 'contracts'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_direction_chk'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_direction_chk
      CHECK (direction IN ('credit', 'debit'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_amount_chk'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_amount_chk
      CHECK (
        amount > 0
        AND balance_before >= 0
        AND balance_after >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_cash_type_chk'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_cash_type_chk
      CHECK (
        transaction_type IN (
          'cash_deposit',
          'cash_withdrawal'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS finance_investor_wallets_branch_investor_idx
  ON public.finance_investor_wallets (branch_id, investor_id);

CREATE INDEX IF NOT EXISTS finance_investor_wallet_transactions_wallet_created_idx
  ON public.finance_investor_wallet_transactions (wallet_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS finance_investor_wallet_transactions_investor_created_idx
  ON public.finance_investor_wallet_transactions (branch_id, investor_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS finance_investor_wallet_transactions_idempotency_key_idx
  ON public.finance_investor_wallet_transactions (branch_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.finance_investor_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_investor_wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_investor_wallets_summary_secure(
  p_branch_id uuid,
  p_investor_id uuid,
  p_actor_user_id uuid
) RETURNS TABLE (
  cash_balance numeric,
  cash_total_deposits numeric,
  cash_total_withdrawals numeric,
  cash_transactions_count bigint,
  cash_last_transaction_at timestamp with time zone,
  goods_products_count bigint,
  goods_total_quantity numeric,
  goods_last_movement_at timestamp with time zone,
  contracts_count bigint,
  contracts_total_debt numeric,
  contracts_total_paid numeric,
  contracts_total_remaining numeric,
  contracts_last_created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor public.finance_branch_users%rowtype;
  v_investor public.finance_investors%rowtype;
  v_has_permission boolean := false;
BEGIN
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
      'view_investor_wallets'
    );

  IF NOT v_has_permission THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'MISSING_PERMISSION';
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

  RETURN QUERY
  WITH cash_wallet AS (
    SELECT fw.*
    FROM public.finance_investor_wallets AS fw
    WHERE fw.branch_id = p_branch_id
      AND fw.investor_id = p_investor_id
      AND fw.wallet_type = 'cash'
    LIMIT 1
  ),
  cash_stats AS (
    SELECT
      coalesce(sum(fwt.amount) FILTER (WHERE fwt.direction = 'credit'), 0)::numeric AS total_deposits,
      coalesce(sum(fwt.amount) FILTER (WHERE fwt.direction = 'debit'), 0)::numeric AS total_withdrawals,
      count(*)::bigint AS transactions_count,
      max(fwt.created_at) AS last_transaction_at
    FROM public.finance_investor_wallet_transactions AS fwt
    WHERE fwt.branch_id = p_branch_id
      AND fwt.investor_id = p_investor_id
      AND fwt.wallet_type = 'cash'
  ),
  goods_stats AS (
    SELECT
      count(*) FILTER (WHERE coalesce(finv.quantity, 0) <> 0)::bigint AS products_count,
      coalesce(sum(finv.quantity), 0)::numeric AS total_quantity
    FROM public.finance_inventory AS finv
    WHERE finv.branch_id = p_branch_id
      AND finv.investor_id = p_investor_id
  ),
  goods_movement_stats AS (
    SELECT max(fim.created_at) AS last_movement_at
    FROM public.finance_inventory_movements AS fim
    WHERE fim.branch_id = p_branch_id
      AND fim.investor_id = p_investor_id
  ),
  contract_stats AS (
    SELECT
      count(*)::bigint AS contracts_count,
      coalesce(sum(fc.debt_amount), 0)::numeric AS total_debt,
      coalesce(sum(fc.paid_amount), 0)::numeric AS total_paid,
      coalesce(sum(fc.remaining_amount), 0)::numeric AS total_remaining,
      max(fc.created_at) AS last_created_at
    FROM public.finance_contracts AS fc
    WHERE fc.branch_id = p_branch_id
      AND fc.investor_id = p_investor_id
      AND coalesce(fc.is_archived, false) = false
  )
  SELECT
    coalesce((SELECT balance_amount FROM cash_wallet), 0)::numeric,
    cash_stats.total_deposits,
    cash_stats.total_withdrawals,
    cash_stats.transactions_count,
    cash_stats.last_transaction_at,
    goods_stats.products_count,
    goods_stats.total_quantity,
    goods_movement_stats.last_movement_at,
    contract_stats.contracts_count,
    contract_stats.total_debt,
    contract_stats.total_paid,
    contract_stats.total_remaining,
    contract_stats.last_created_at
  FROM cash_stats
  CROSS JOIN goods_stats
  CROSS JOIN goods_movement_stats
  CROSS JOIN contract_stats;
END;
$$;

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

REVOKE ALL ON TABLE public.finance_investor_wallets FROM PUBLIC;
REVOKE ALL ON TABLE public.finance_investor_wallets FROM anon;
REVOKE ALL ON TABLE public.finance_investor_wallets FROM authenticated;
GRANT ALL ON TABLE public.finance_investor_wallets TO service_role;

REVOKE ALL ON TABLE public.finance_investor_wallet_transactions FROM PUBLIC;
REVOKE ALL ON TABLE public.finance_investor_wallet_transactions FROM anon;
REVOKE ALL ON TABLE public.finance_investor_wallet_transactions FROM authenticated;
GRANT ALL ON TABLE public.finance_investor_wallet_transactions TO service_role;

REVOKE ALL ON FUNCTION public.get_investor_wallets_summary_secure(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_investor_wallets_summary_secure(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_investor_wallets_summary_secure(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_investor_wallets_summary_secure(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.deposit_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deposit_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.deposit_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.deposit_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.withdraw_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.withdraw_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.withdraw_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_investor_cash_wallet_secure_atomic(uuid, uuid, uuid, text, numeric, text, text) TO service_role;
