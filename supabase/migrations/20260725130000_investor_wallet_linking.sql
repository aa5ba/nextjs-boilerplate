-- Migration: investor wallet linking
-- Local migration file; validate locally before any remote deployment.

ALTER TABLE public.finance_investor_wallet_transactions
  ADD COLUMN IF NOT EXISTS operation_id uuid,
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS contract_id uuid,
  ADD COLUMN IF NOT EXISTS inventory_movement_id uuid,
  ADD COLUMN IF NOT EXISTS payment_id uuid,
  ADD COLUMN IF NOT EXISTS reversal_of_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.finance_investor_wallet_transactions
SET operation_id = id
WHERE operation_id IS NULL;

ALTER TABLE public.finance_investor_wallet_transactions
  ALTER COLUMN operation_id SET NOT NULL;

ALTER TABLE public.finance_inventory
  ADD COLUMN IF NOT EXISTS average_unit_cost numeric,
  ADD COLUMN IF NOT EXISTS total_cost_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_initialized_at timestamptz,
  ADD COLUMN IF NOT EXISTS cost_initialized_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.finance_inventory
SET total_cost_value = 0
WHERE total_cost_value IS NULL;

DO $$
BEGIN
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

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_cash_type_chk'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      DROP CONSTRAINT finance_investor_wallet_transactions_cash_type_chk;
  END IF;

  ALTER TABLE public.finance_investor_wallet_transactions
    ADD CONSTRAINT finance_investor_wallet_transactions_cash_type_chk
    CHECK (
      transaction_type IN (
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
        'payment_reversed'
      )
    );
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_product_fkey'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_product_fkey
      FOREIGN KEY (product_id)
      REFERENCES public.finance_products(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_contract_fkey'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_contract_fkey
      FOREIGN KEY (contract_id)
      REFERENCES public.finance_contracts(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_inventory_movement_fkey'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_inventory_movement_fkey
      FOREIGN KEY (inventory_movement_id)
      REFERENCES public.finance_inventory_movements(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_payment_fkey'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_payment_fkey
      FOREIGN KEY (payment_id)
      REFERENCES public.finance_payments(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_wallet_transactions_reversal_fkey'
      AND conrelid = 'public.finance_investor_wallet_transactions'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_wallet_transactions
      ADD CONSTRAINT finance_investor_wallet_transactions_reversal_fkey
      FOREIGN KEY (reversal_of_transaction_id)
      REFERENCES public.finance_investor_wallet_transactions(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_inventory_average_cost_nonnegative_chk'
      AND conrelid = 'public.finance_inventory'::regclass
  ) THEN
    ALTER TABLE public.finance_inventory
      ADD CONSTRAINT finance_inventory_average_cost_nonnegative_chk
      CHECK (average_unit_cost IS NULL OR average_unit_cost >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_inventory_total_cost_value_nonnegative_chk'
      AND conrelid = 'public.finance_inventory'::regclass
  ) THEN
    ALTER TABLE public.finance_inventory
      ADD CONSTRAINT finance_inventory_total_cost_value_nonnegative_chk
      CHECK (total_cost_value >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS finance_investor_wallet_transactions_operation_idx
  ON public.finance_investor_wallet_transactions (branch_id, operation_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS finance_investor_wallet_transactions_product_idx
  ON public.finance_investor_wallet_transactions (branch_id, investor_id, product_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS finance_investor_wallet_transactions_contract_idx
  ON public.finance_investor_wallet_transactions (branch_id, investor_id, contract_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS finance_investor_wallet_transactions_payment_idx
  ON public.finance_investor_wallet_transactions (branch_id, payment_id)
  WHERE payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.finance_investor_goods_transaction_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  investor_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity_delta numeric NOT NULL,
  quantity_before numeric NOT NULL,
  quantity_after numeric NOT NULL,
  unit_cost numeric,
  value_delta numeric NOT NULL,
  inventory_movement_id uuid,
  contract_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_goods_details_transaction_fkey'
      AND conrelid = 'public.finance_investor_goods_transaction_details'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_goods_transaction_details
      ADD CONSTRAINT finance_investor_goods_details_transaction_fkey
      FOREIGN KEY (transaction_id)
      REFERENCES public.finance_investor_wallet_transactions(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_goods_details_branch_fkey'
      AND conrelid = 'public.finance_investor_goods_transaction_details'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_goods_transaction_details
      ADD CONSTRAINT finance_investor_goods_details_branch_fkey
      FOREIGN KEY (branch_id)
      REFERENCES public.finance_branches(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_goods_details_investor_fkey'
      AND conrelid = 'public.finance_investor_goods_transaction_details'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_goods_transaction_details
      ADD CONSTRAINT finance_investor_goods_details_investor_fkey
      FOREIGN KEY (investor_id)
      REFERENCES public.finance_investors(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_goods_details_product_fkey'
      AND conrelid = 'public.finance_investor_goods_transaction_details'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_goods_transaction_details
      ADD CONSTRAINT finance_investor_goods_details_product_fkey
      FOREIGN KEY (product_id)
      REFERENCES public.finance_products(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_goods_details_movement_fkey'
      AND conrelid = 'public.finance_investor_goods_transaction_details'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_goods_transaction_details
      ADD CONSTRAINT finance_investor_goods_details_movement_fkey
      FOREIGN KEY (inventory_movement_id)
      REFERENCES public.finance_inventory_movements(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_goods_details_contract_fkey'
      AND conrelid = 'public.finance_investor_goods_transaction_details'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_goods_transaction_details
      ADD CONSTRAINT finance_investor_goods_details_contract_fkey
      FOREIGN KEY (contract_id)
      REFERENCES public.finance_contracts(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_goods_details_quantity_chk'
      AND conrelid = 'public.finance_investor_goods_transaction_details'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_goods_transaction_details
      ADD CONSTRAINT finance_investor_goods_details_quantity_chk
      CHECK (
        quantity_before >= 0
        AND quantity_after >= 0
        AND quantity_delta <> 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_investor_goods_details_cost_chk'
      AND conrelid = 'public.finance_investor_goods_transaction_details'::regclass
  ) THEN
    ALTER TABLE public.finance_investor_goods_transaction_details
      ADD CONSTRAINT finance_investor_goods_details_cost_chk
      CHECK (
        unit_cost IS NULL OR unit_cost >= 0
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS finance_investor_goods_details_investor_created_idx
  ON public.finance_investor_goods_transaction_details (branch_id, investor_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS finance_investor_goods_details_product_created_idx
  ON public.finance_investor_goods_transaction_details (product_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS finance_investor_goods_details_contract_idx
  ON public.finance_investor_goods_transaction_details (contract_id, operation_id)
  WHERE contract_id IS NOT NULL;

ALTER TABLE public.finance_investor_goods_transaction_details ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_investor_wallet_transaction_internal(
  p_branch_id uuid,
  p_investor_id uuid,
  p_wallet_type text,
  p_direction text,
  p_transaction_type text,
  p_amount numeric,
  p_note text,
  p_actor_user_id uuid,
  p_actor_user_name text,
  p_operation_id uuid,
  p_product_id uuid DEFAULT NULL,
  p_contract_id uuid DEFAULT NULL,
  p_inventory_movement_id uuid DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL,
  p_reversal_of_transaction_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(
  transaction_id uuid,
  wallet_id uuid,
  balance_before numeric,
  balance_after numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet public.finance_investor_wallets%rowtype;
  v_amount numeric;
  v_before numeric;
  v_after numeric;
  v_transaction_id uuid;
BEGIN
  v_amount := round(coalesce(p_amount, 0), 6);

  IF p_branch_id IS NULL
     OR p_investor_id IS NULL
     OR p_wallet_type NOT IN ('cash', 'goods', 'contracts')
     OR p_direction NOT IN ('credit', 'debit')
     OR v_amount <= 0
  THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'INVALID_WALLET_TRANSACTION';
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
    p_wallet_type,
    0
  )
  ON CONFLICT (branch_id, investor_id, wallet_type)
  DO UPDATE SET updated_at = public.finance_investor_wallets.updated_at
  RETURNING * INTO v_wallet;

  SELECT fw.*
  INTO v_wallet
  FROM public.finance_investor_wallets AS fw
  WHERE fw.id = v_wallet.id
  FOR UPDATE;

  v_before := coalesce(v_wallet.balance_amount, 0);

  IF p_direction = 'debit' THEN
    IF v_before < v_amount THEN
      RAISE EXCEPTION USING
        errcode = 'P0001',
        message = CASE
          WHEN p_wallet_type = 'cash' THEN 'INSUFFICIENT_CASH_BALANCE'
          WHEN p_wallet_type = 'goods' THEN 'INSUFFICIENT_GOODS_BALANCE'
          ELSE 'INSUFFICIENT_CONTRACTS_BALANCE'
        END;
    END IF;

    v_after := v_before - v_amount;
  ELSE
    v_after := v_before + v_amount;
  END IF;

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
    transaction_type,
    amount,
    balance_before,
    balance_after,
    note,
    actor_user_id,
    actor_user_name,
    operation_id,
    product_id,
    contract_id,
    inventory_movement_id,
    payment_id,
    reversal_of_transaction_id,
    idempotency_key,
    metadata
  )
  VALUES (
    p_branch_id,
    p_investor_id,
    v_wallet.id,
    p_wallet_type,
    p_direction,
    p_transaction_type,
    v_amount,
    v_before,
    v_after,
    nullif(trim(coalesce(p_note, '')), ''),
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_user_name, '')), ''),
    coalesce(p_operation_id, gen_random_uuid()),
    p_product_id,
    p_contract_id,
    p_inventory_movement_id,
    p_payment_id,
    p_reversal_of_transaction_id,
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY
  SELECT
    v_transaction_id,
    v_wallet.id,
    v_before,
    v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.initialize_investor_goods_cost_secure_atomic(
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_investor_id uuid,
  p_product_id uuid,
  p_opening_unit_cost numeric,
  p_note text,
  p_idempotency_key text
) RETURNS TABLE(
  operation_id uuid,
  transaction_id uuid,
  inventory_id uuid,
  quantity numeric,
  total_cost_value numeric,
  average_unit_cost numeric,
  goods_balance_after numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor public.finance_branch_users%rowtype;
  v_investor public.finance_investors%rowtype;
  v_inventory public.finance_inventory%rowtype;
  v_existing public.finance_investor_wallet_transactions%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_unit_cost numeric;
  v_opening_value numeric;
  v_wallet_result record;
  v_actor_name text;
BEGIN
  SELECT fbu.*
  INTO v_actor
  FROM public.finance_branch_users AS fbu
  WHERE fbu.id = p_actor_user_id
    AND fbu.branch_id = p_branch_id
    AND fbu.is_active = true
    AND coalesce(fbu.self_disabled, false) = false
    AND fbu.disabled_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVALID_SESSION';
  END IF;

  IF NOT (
    v_actor.role IN ('main_admin', 'branch_manager', 'مدير رئيسي', 'مدير فرع', 'مدير')
    OR public.finance_user_has_permission(p_branch_id, p_actor_user_id, 'initialize_investor_goods_cost')
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'MISSING_PERMISSION';
  END IF;

  v_actor_name := coalesce(nullif(trim(v_actor.full_name), ''), nullif(trim(v_actor.username), ''), 'الموظف');
  v_unit_cost := round(coalesce(p_opening_unit_cost, 0), 6);

  IF v_unit_cost <= 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVALID_UNIT_COST';
  END IF;

  IF nullif(trim(coalesce(p_idempotency_key, '')), '') IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.finance_investor_wallet_transactions
    WHERE branch_id = p_branch_id
      AND idempotency_key = trim(p_idempotency_key)
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT
        v_existing.operation_id,
        v_existing.id,
        v_existing.inventory_movement_id,
        0::numeric,
        0::numeric,
        0::numeric,
        v_existing.balance_after;
      RETURN;
    END IF;
  END IF;

  SELECT *
  INTO v_investor
  FROM public.finance_investors
  WHERE id = p_investor_id
    AND branch_id = p_branch_id
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVESTOR_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.finance_products AS fp
    WHERE fp.id = p_product_id
      AND fp.branch_id = p_branch_id
      AND fp.is_active = true
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  END IF;

  SELECT *
  INTO v_inventory
  FROM public.finance_inventory
  WHERE branch_id = p_branch_id
    AND investor_id = p_investor_id
    AND product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND OR coalesce(v_inventory.quantity, 0) <= 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVENTORY_NOT_FOUND';
  END IF;

  IF v_inventory.average_unit_cost IS NOT NULL
     OR coalesce(v_inventory.total_cost_value, 0) > 0
     OR v_inventory.cost_initialized_at IS NOT NULL
  THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'GOODS_COST_ALREADY_INITIALIZED';
  END IF;

  v_opening_value := round(coalesce(v_inventory.quantity, 0) * v_unit_cost, 6);

  UPDATE public.finance_inventory
  SET
    average_unit_cost = v_unit_cost,
    total_cost_value = v_opening_value,
    cost_initialized_at = now(),
    cost_initialized_by = p_actor_user_id,
    updated_at = now()
  WHERE id = v_inventory.id
  RETURNING * INTO v_inventory;

  SELECT *
  INTO v_wallet_result
  FROM public.create_investor_wallet_transaction_internal(
    p_branch_id,
    p_investor_id,
    'goods',
    'credit',
    'goods_opening_balance',
    v_opening_value,
    coalesce(nullif(trim(p_note), ''), 'تحديد تكلفة افتتاحية'),
    p_actor_user_id,
    v_actor_name,
    v_operation_id,
    p_product_id,
    NULL,
    NULL,
    NULL,
    NULL,
    p_idempotency_key,
    jsonb_build_object('unit_cost', v_unit_cost, 'quantity', v_inventory.quantity)
  );

  INSERT INTO public.finance_investor_goods_transaction_details (
    transaction_id,
    operation_id,
    branch_id,
    investor_id,
    product_id,
    quantity_delta,
    quantity_before,
    quantity_after,
    unit_cost,
    value_delta
  )
  VALUES (
    v_wallet_result.transaction_id,
    v_operation_id,
    p_branch_id,
    p_investor_id,
    p_product_id,
    coalesce(v_inventory.quantity, 0),
    0,
    coalesce(v_inventory.quantity, 0),
    v_unit_cost,
    v_opening_value
  );

  INSERT INTO public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    employee_name,
    status
  )
  VALUES (
    p_branch_id,
    'تحديد تكلفة افتتاحية',
    'تم تحديد تكلفة افتتاحية لمخزون المستثمر ' || coalesce(v_investor.investor_name, ''),
    v_actor_name,
    'نشط'
  );

  RETURN QUERY
  SELECT
    v_operation_id,
    v_wallet_result.transaction_id::uuid,
    v_inventory.id,
    coalesce(v_inventory.quantity, 0),
    coalesce(v_inventory.total_cost_value, 0),
    v_inventory.average_unit_cost,
    v_wallet_result.balance_after::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_investor_goods_secure_atomic(
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_investor_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_investor_unit_cost numeric,
  p_note text,
  p_idempotency_key text
) RETURNS TABLE(
  operation_id uuid,
  cash_transaction_id uuid,
  goods_transaction_id uuid,
  inventory_movement_id uuid,
  quantity_before numeric,
  quantity_after numeric,
  cash_balance_after numeric,
  goods_balance_after numeric,
  average_unit_cost numeric,
  total_cost_value numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor public.finance_branch_users%rowtype;
  v_investor public.finance_investors%rowtype;
  v_inventory public.finance_inventory%rowtype;
  v_existing public.finance_investor_wallet_transactions%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_quantity numeric;
  v_unit_cost numeric;
  v_added_value numeric;
  v_before_quantity numeric := 0;
  v_after_quantity numeric := 0;
  v_before_total_value numeric := 0;
  v_after_total_value numeric := 0;
  v_after_average numeric;
  v_cash_result record;
  v_goods_result record;
  v_movement_id uuid;
  v_actor_name text;
BEGIN
  SELECT fbu.*
  INTO v_actor
  FROM public.finance_branch_users AS fbu
  WHERE fbu.id = p_actor_user_id
    AND fbu.branch_id = p_branch_id
    AND fbu.is_active = true
    AND coalesce(fbu.self_disabled, false) = false
    AND fbu.disabled_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVALID_SESSION';
  END IF;

  IF NOT (
    v_actor.role IN ('main_admin', 'branch_manager', 'مدير رئيسي', 'مدير فرع', 'مدير')
    OR public.finance_user_has_permission(p_branch_id, p_actor_user_id, 'purchase_investor_goods')
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'MISSING_PERMISSION';
  END IF;

  v_actor_name := coalesce(nullif(trim(v_actor.full_name), ''), nullif(trim(v_actor.username), ''), 'الموظف');
  v_quantity := round(coalesce(p_quantity, 0), 6);
  v_unit_cost := round(coalesce(p_investor_unit_cost, 0), 6);

  IF v_quantity <= 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVALID_QUANTITY';
  END IF;

  IF v_unit_cost <= 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVALID_UNIT_COST';
  END IF;

  IF nullif(trim(coalesce(p_idempotency_key, '')), '') IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.finance_investor_wallet_transactions
    WHERE branch_id = p_branch_id
      AND idempotency_key = trim(p_idempotency_key)
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT
        v_existing.operation_id,
        v_existing.id,
        NULL::uuid,
        v_existing.inventory_movement_id,
        0::numeric,
        0::numeric,
        v_existing.balance_after,
        0::numeric,
        0::numeric,
        0::numeric;
      RETURN;
    END IF;
  END IF;

  SELECT *
  INTO v_investor
  FROM public.finance_investors
  WHERE id = p_investor_id
    AND branch_id = p_branch_id
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVESTOR_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.finance_products AS fp
    WHERE fp.id = p_product_id
      AND fp.branch_id = p_branch_id
      AND fp.is_active = true
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'PRODUCT_NOT_FOUND';
  END IF;

  SELECT *
  INTO v_inventory
  FROM public.finance_inventory
  WHERE branch_id = p_branch_id
    AND investor_id = p_investor_id
    AND product_id = p_product_id
  FOR UPDATE;

  IF FOUND THEN
    v_before_quantity := coalesce(v_inventory.quantity, 0);
    v_before_total_value := coalesce(v_inventory.total_cost_value, 0);

    IF v_before_quantity > 0
       AND (
         v_inventory.average_unit_cost IS NULL
         OR v_inventory.cost_initialized_at IS NULL
       )
    THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'GOODS_COST_NOT_INITIALIZED';
    END IF;
  ELSE
    INSERT INTO public.finance_inventory (
      branch_id,
      investor_id,
      product_id,
      quantity,
      average_unit_cost,
      total_cost_value,
      cost_initialized_at,
      cost_initialized_by,
      updated_at
    )
    VALUES (
      p_branch_id,
      p_investor_id,
      p_product_id,
      0,
      NULL,
      0,
      now(),
      p_actor_user_id,
      now()
    )
    RETURNING * INTO v_inventory;
  END IF;

  v_added_value := round(v_quantity * v_unit_cost, 6);
  v_after_quantity := v_before_quantity + v_quantity;
  v_after_total_value := v_before_total_value + v_added_value;
  v_after_average := round(v_after_total_value / v_after_quantity, 6);

  SELECT *
  INTO v_cash_result
  FROM public.create_investor_wallet_transaction_internal(
    p_branch_id,
    p_investor_id,
    'cash',
    'debit',
    'goods_purchase',
    v_added_value,
    coalesce(nullif(trim(p_note), ''), 'شراء وإضافة سلع للمستثمر'),
    p_actor_user_id,
    v_actor_name,
    v_operation_id,
    p_product_id,
    NULL,
    NULL,
    NULL,
    NULL,
    p_idempotency_key,
    jsonb_build_object('quantity', v_quantity, 'unit_cost', v_unit_cost)
  );

  UPDATE public.finance_inventory
  SET
    quantity = v_after_quantity,
    average_unit_cost = v_after_average,
    total_cost_value = v_after_total_value,
    cost_initialized_at = coalesce(cost_initialized_at, now()),
    cost_initialized_by = coalesce(cost_initialized_by, p_actor_user_id),
    updated_at = now()
  WHERE id = v_inventory.id
  RETURNING * INTO v_inventory;

  INSERT INTO public.finance_inventory_movements (
    branch_id,
    investor_id,
    product_id,
    movement_type,
    quantity,
    before_quantity,
    after_quantity,
    notes,
    created_by
  )
  VALUES (
    p_branch_id,
    p_investor_id,
    p_product_id,
    'شراء',
    v_quantity,
    v_before_quantity,
    v_after_quantity,
    coalesce(nullif(trim(p_note), ''), 'شراء وإضافة سلع للمستثمر'),
    v_actor_name
  )
  RETURNING id INTO v_movement_id;

  SELECT *
  INTO v_goods_result
  FROM public.create_investor_wallet_transaction_internal(
    p_branch_id,
    p_investor_id,
    'goods',
    'credit',
    'goods_purchase',
    v_added_value,
    coalesce(nullif(trim(p_note), ''), 'شراء وإضافة سلع للمستثمر'),
    p_actor_user_id,
    v_actor_name,
    v_operation_id,
    p_product_id,
    NULL,
    v_movement_id,
    NULL,
    NULL,
    NULL,
    jsonb_build_object('quantity', v_quantity, 'unit_cost', v_unit_cost)
  );

  UPDATE public.finance_investor_wallet_transactions
  SET inventory_movement_id = v_movement_id
  WHERE id = v_cash_result.transaction_id;

  INSERT INTO public.finance_investor_goods_transaction_details (
    transaction_id,
    operation_id,
    branch_id,
    investor_id,
    product_id,
    quantity_delta,
    quantity_before,
    quantity_after,
    unit_cost,
    value_delta,
    inventory_movement_id
  )
  VALUES (
    v_goods_result.transaction_id,
    v_operation_id,
    p_branch_id,
    p_investor_id,
    p_product_id,
    v_quantity,
    v_before_quantity,
    v_after_quantity,
    v_unit_cost,
    v_added_value,
    v_movement_id
  );

  INSERT INTO public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    employee_name,
    status
  )
  VALUES (
    p_branch_id,
    'شراء سلع مستثمر',
    'تم شراء وإضافة كمية لمحفظة سلع المستثمر ' || coalesce(v_investor.investor_name, ''),
    v_actor_name,
    'نشط'
  );

  RETURN QUERY
  SELECT
    v_operation_id,
    v_cash_result.transaction_id::uuid,
    v_goods_result.transaction_id::uuid,
    v_movement_id,
    v_before_quantity,
    v_after_quantity,
    v_cash_result.balance_after::numeric,
    v_goods_result.balance_after::numeric,
    v_after_average,
    v_after_total_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrease_investor_goods_secure_atomic(
  p_branch_id uuid,
  p_actor_user_id uuid,
  p_investor_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_reason text,
  p_idempotency_key text
) RETURNS TABLE(
  operation_id uuid,
  goods_transaction_id uuid,
  inventory_movement_id uuid,
  quantity_before numeric,
  quantity_after numeric,
  removed_value numeric,
  goods_balance_after numeric,
  average_unit_cost numeric,
  total_cost_value numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor public.finance_branch_users%rowtype;
  v_investor public.finance_investors%rowtype;
  v_inventory public.finance_inventory%rowtype;
  v_existing public.finance_investor_wallet_transactions%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_quantity numeric;
  v_reason text;
  v_before_quantity numeric;
  v_after_quantity numeric;
  v_removed_value numeric;
  v_after_total_value numeric;
  v_after_average numeric;
  v_goods_result record;
  v_movement_id uuid;
  v_actor_name text;
BEGIN
  SELECT fbu.*
  INTO v_actor
  FROM public.finance_branch_users AS fbu
  WHERE fbu.id = p_actor_user_id
    AND fbu.branch_id = p_branch_id
    AND fbu.is_active = true
    AND coalesce(fbu.self_disabled, false) = false
    AND fbu.disabled_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVALID_SESSION';
  END IF;

  IF NOT (
    v_actor.role IN ('main_admin', 'branch_manager', 'مدير رئيسي', 'مدير فرع', 'مدير')
    OR public.finance_user_has_permission(p_branch_id, p_actor_user_id, 'adjust_investor_goods_quantity')
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'MISSING_PERMISSION';
  END IF;

  v_actor_name := coalesce(nullif(trim(v_actor.full_name), ''), nullif(trim(v_actor.username), ''), 'الموظف');
  v_quantity := round(coalesce(p_quantity, 0), 6);
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  IF v_quantity <= 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVALID_QUANTITY';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'REASON_REQUIRED';
  END IF;

  IF nullif(trim(coalesce(p_idempotency_key, '')), '') IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.finance_investor_wallet_transactions
    WHERE branch_id = p_branch_id
      AND idempotency_key = trim(p_idempotency_key)
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT
        v_existing.operation_id,
        v_existing.id,
        v_existing.inventory_movement_id,
        0::numeric,
        0::numeric,
        v_existing.amount,
        v_existing.balance_after,
        0::numeric,
        0::numeric;
      RETURN;
    END IF;
  END IF;

  SELECT *
  INTO v_investor
  FROM public.finance_investors
  WHERE id = p_investor_id
    AND branch_id = p_branch_id
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVESTOR_NOT_FOUND';
  END IF;

  SELECT *
  INTO v_inventory
  FROM public.finance_inventory
  WHERE branch_id = p_branch_id
    AND investor_id = p_investor_id
    AND product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVENTORY_NOT_FOUND';
  END IF;

  v_before_quantity := coalesce(v_inventory.quantity, 0);

  IF v_before_quantity < v_quantity THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INSUFFICIENT_GOODS_QUANTITY';
  END IF;

  IF v_inventory.average_unit_cost IS NULL
     OR v_inventory.cost_initialized_at IS NULL
     OR coalesce(v_inventory.total_cost_value, 0) <= 0
  THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'GOODS_COST_NOT_INITIALIZED';
  END IF;

  IF v_quantity = v_before_quantity THEN
    v_removed_value := coalesce(v_inventory.total_cost_value, 0);
    v_after_quantity := 0;
    v_after_total_value := 0;
    v_after_average := NULL;
  ELSE
    v_removed_value := round(coalesce(v_inventory.total_cost_value, 0) * (v_quantity / v_before_quantity), 6);
    v_after_quantity := v_before_quantity - v_quantity;
    v_after_total_value := greatest(coalesce(v_inventory.total_cost_value, 0) - v_removed_value, 0);
    v_after_average := round(v_after_total_value / v_after_quantity, 6);
  END IF;

  SELECT *
  INTO v_goods_result
  FROM public.create_investor_wallet_transaction_internal(
    p_branch_id,
    p_investor_id,
    'goods',
    'debit',
    'manual_goods_decrease',
    v_removed_value,
    v_reason,
    p_actor_user_id,
    v_actor_name,
    v_operation_id,
    p_product_id,
    NULL,
    NULL,
    NULL,
    NULL,
    p_idempotency_key,
    jsonb_build_object('quantity', v_quantity)
  );

  UPDATE public.finance_inventory
  SET
    quantity = v_after_quantity,
    average_unit_cost = v_after_average,
    total_cost_value = v_after_total_value,
    updated_at = now()
  WHERE id = v_inventory.id
  RETURNING * INTO v_inventory;

  INSERT INTO public.finance_inventory_movements (
    branch_id,
    investor_id,
    product_id,
    movement_type,
    quantity,
    before_quantity,
    after_quantity,
    notes,
    created_by
  )
  VALUES (
    p_branch_id,
    p_investor_id,
    p_product_id,
    'إنقاص يدوي',
    v_quantity,
    v_before_quantity,
    v_after_quantity,
    v_reason,
    v_actor_name
  )
  RETURNING id INTO v_movement_id;

  UPDATE public.finance_investor_wallet_transactions
  SET inventory_movement_id = v_movement_id
  WHERE id = v_goods_result.transaction_id;

  INSERT INTO public.finance_investor_goods_transaction_details (
    transaction_id,
    operation_id,
    branch_id,
    investor_id,
    product_id,
    quantity_delta,
    quantity_before,
    quantity_after,
    unit_cost,
    value_delta,
    inventory_movement_id
  )
  VALUES (
    v_goods_result.transaction_id,
    v_operation_id,
    p_branch_id,
    p_investor_id,
    p_product_id,
    -v_quantity,
    v_before_quantity,
    v_after_quantity,
    CASE WHEN v_quantity > 0 THEN round(v_removed_value / v_quantity, 6) ELSE NULL END,
    -v_removed_value,
    v_movement_id
  );

  INSERT INTO public.finance_activity_logs (
    branch_id,
    activity_type,
    description,
    employee_name,
    status
  )
  VALUES (
    p_branch_id,
    'إنقاص سلع مستثمر',
    'تم إنقاص كمية من محفظة سلع المستثمر ' || coalesce(v_investor.investor_name, ''),
    v_actor_name,
    'نشط'
  );

  RETURN QUERY
  SELECT
    v_operation_id,
    v_goods_result.transaction_id::uuid,
    v_movement_id,
    v_before_quantity,
    v_after_quantity,
    v_removed_value,
    v_goods_result.balance_after::numeric,
    v_after_average,
    v_after_total_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_investor_wallet_from_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contract public.finance_contracts%rowtype;
  v_inventory public.finance_inventory%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_quantity numeric;
  v_before_quantity numeric;
  v_after_quantity numeric;
  v_value numeric;
  v_after_total_value numeric;
  v_after_average numeric;
  v_goods_result record;
  v_contract_result record;
  v_unit_cost numeric;
BEGIN
  IF NEW.contract_id IS NULL
     OR NEW.investor_id IS NULL
     OR NEW.product_id IS NULL
     OR NEW.movement_type NOT IN ('خصم', 'إرجاع')
  THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.finance_investor_wallet_transactions AS fwt
    WHERE fwt.inventory_movement_id = NEW.id
      AND fwt.wallet_type = 'goods'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_contract
  FROM public.finance_contracts
  WHERE id = NEW.contract_id
    AND branch_id = NEW.branch_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_inventory
  FROM public.finance_inventory
  WHERE branch_id = NEW.branch_id
    AND investor_id = NEW.investor_id
    AND product_id = NEW.product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVENTORY_NOT_FOUND';
  END IF;

  v_quantity := round(coalesce(NEW.quantity, 0), 6);
  v_before_quantity := round(coalesce(NEW.before_quantity, 0), 6);
  v_after_quantity := round(coalesce(NEW.after_quantity, 0), 6);

  IF v_quantity <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.movement_type = 'خصم' THEN
    IF v_before_quantity <= 0
       OR v_inventory.average_unit_cost IS NULL
       OR v_inventory.cost_initialized_at IS NULL
       OR coalesce(v_inventory.total_cost_value, 0) <= 0
    THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'GOODS_COST_NOT_INITIALIZED';
    END IF;

    IF v_quantity >= v_before_quantity THEN
      v_value := coalesce(v_inventory.total_cost_value, 0);
      v_after_total_value := 0;
      v_after_average := NULL;
    ELSE
      v_value := round(coalesce(v_inventory.total_cost_value, 0) * (v_quantity / v_before_quantity), 6);
      v_after_total_value := greatest(coalesce(v_inventory.total_cost_value, 0) - v_value, 0);
      v_after_average := CASE
        WHEN v_after_quantity > 0 THEN round(v_after_total_value / v_after_quantity, 6)
        ELSE NULL
      END;
    END IF;

    SELECT *
    INTO v_goods_result
    FROM public.create_investor_wallet_transaction_internal(
      NEW.branch_id,
      NEW.investor_id,
      'goods',
      'debit',
      'goods_to_contract',
      v_value,
      coalesce(NEW.notes, 'خصم سلع لعقد'),
      NULL,
      NEW.created_by,
      v_operation_id,
      NEW.product_id,
      NEW.contract_id,
      NEW.id,
      NULL,
      NULL,
      NULL,
      jsonb_build_object('quantity', v_quantity)
    );

    IF coalesce(v_contract.payment_amount, v_contract.debt_amount, 0) > 0
       AND NOT EXISTS (
      SELECT 1
      FROM public.finance_investor_wallet_transactions AS fwt
      WHERE fwt.branch_id = NEW.branch_id
        AND fwt.contract_id = NEW.contract_id
        AND fwt.wallet_type = 'contracts'
        AND fwt.transaction_type = 'contract_created'
    ) THEN
      SELECT *
      INTO v_contract_result
      FROM public.create_investor_wallet_transaction_internal(
        NEW.branch_id,
        NEW.investor_id,
        'contracts',
        'credit',
        'contract_created',
        coalesce(v_contract.payment_amount, v_contract.debt_amount, 0),
        'إضافة عقد إلى محفظة العقود',
        NULL,
        NEW.created_by,
        v_operation_id,
        NEW.product_id,
        NEW.contract_id,
        NEW.id,
        NULL,
        NULL,
        NULL,
        jsonb_build_object('contract_number', v_contract.contract_number)
      );
    END IF;

    UPDATE public.finance_inventory
    SET
      total_cost_value = v_after_total_value,
      average_unit_cost = v_after_average,
      updated_at = now()
    WHERE id = v_inventory.id;

    v_unit_cost := CASE WHEN v_quantity > 0 THEN round(v_value / v_quantity, 6) ELSE NULL END;

    INSERT INTO public.finance_investor_goods_transaction_details (
      transaction_id,
      operation_id,
      branch_id,
      investor_id,
      product_id,
      quantity_delta,
      quantity_before,
      quantity_after,
      unit_cost,
      value_delta,
      inventory_movement_id,
      contract_id
    )
    VALUES (
      v_goods_result.transaction_id,
      v_operation_id,
      NEW.branch_id,
      NEW.investor_id,
      NEW.product_id,
      -v_quantity,
      v_before_quantity,
      v_after_quantity,
      v_unit_cost,
      -v_value,
      NEW.id,
      NEW.contract_id
    );
  ELSE
    SELECT
      coalesce(
        (
          SELECT round(abs(gtd.value_delta) / nullif(abs(gtd.quantity_delta), 0), 6)
          FROM public.finance_investor_goods_transaction_details AS gtd
          WHERE gtd.branch_id = NEW.branch_id
            AND gtd.investor_id = NEW.investor_id
            AND gtd.product_id = NEW.product_id
            AND gtd.contract_id = NEW.contract_id
            AND gtd.value_delta < 0
          ORDER BY gtd.created_at DESC, gtd.id DESC
          LIMIT 1
        ),
        v_inventory.average_unit_cost
      )
    INTO v_unit_cost;

    IF v_unit_cost IS NULL OR v_unit_cost <= 0 THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'GOODS_COST_NOT_INITIALIZED';
    END IF;

    v_value := round(v_quantity * v_unit_cost, 6);
    v_after_total_value := coalesce(v_inventory.total_cost_value, 0) + v_value;
    v_after_average := CASE
      WHEN v_after_quantity > 0 THEN round(v_after_total_value / v_after_quantity, 6)
      ELSE NULL
    END;

    SELECT *
    INTO v_goods_result
    FROM public.create_investor_wallet_transaction_internal(
      NEW.branch_id,
      NEW.investor_id,
      'goods',
      'credit',
      'goods_return_from_contract',
      v_value,
      coalesce(NEW.notes, 'إرجاع سلع من عقد'),
      NULL,
      NEW.created_by,
      v_operation_id,
      NEW.product_id,
      NEW.contract_id,
      NEW.id,
      NULL,
      NULL,
      NULL,
      jsonb_build_object('quantity', v_quantity, 'unit_cost', v_unit_cost)
    );

    UPDATE public.finance_inventory
    SET
      total_cost_value = v_after_total_value,
      average_unit_cost = v_after_average,
      cost_initialized_at = coalesce(cost_initialized_at, now()),
      updated_at = now()
    WHERE id = v_inventory.id;

    INSERT INTO public.finance_investor_goods_transaction_details (
      transaction_id,
      operation_id,
      branch_id,
      investor_id,
      product_id,
      quantity_delta,
      quantity_before,
      quantity_after,
      unit_cost,
      value_delta,
      inventory_movement_id,
      contract_id
    )
    VALUES (
      v_goods_result.transaction_id,
      v_operation_id,
      NEW.branch_id,
      NEW.investor_id,
      NEW.product_id,
      v_quantity,
      v_before_quantity,
      v_after_quantity,
      v_unit_cost,
      v_value,
      NEW.id,
      NEW.contract_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_investor_wallet_from_contract_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_amount numeric;
  v_new_amount numeric;
  v_paid numeric;
  v_delta numeric;
  v_old_remaining numeric;
  v_new_remaining numeric;
  v_operation_id uuid := gen_random_uuid();
BEGIN
  IF coalesce(NEW.is_archived, false) = true THEN
    RETURN NEW;
  END IF;

  v_old_amount := coalesce(OLD.payment_amount, OLD.debt_amount, 0);
  v_new_amount := coalesce(NEW.payment_amount, NEW.debt_amount, 0);
  v_paid := coalesce(NEW.paid_amount, OLD.paid_amount, 0);

  IF OLD.investor_id IS DISTINCT FROM NEW.investor_id THEN
    IF OLD.investor_id IS NOT NULL THEN
      v_old_remaining := greatest(v_old_amount - coalesce(OLD.paid_amount, 0), 0);

      IF v_old_remaining > 0 THEN
        PERFORM *
        FROM public.create_investor_wallet_transaction_internal(
          OLD.branch_id,
          OLD.investor_id,
          'contracts',
          'debit',
          'contract_investor_transfer',
          v_old_remaining,
          'نقل عقد من مستثمر',
          NULL,
          NULL,
          v_operation_id,
          OLD.product_id,
          OLD.id,
          NULL,
          NULL,
          NULL,
          NULL,
          jsonb_build_object('contract_number', OLD.contract_number)
        );
      END IF;
    END IF;

    IF NEW.investor_id IS NOT NULL THEN
      v_new_remaining := greatest(v_new_amount - v_paid, 0);

      IF v_new_remaining > 0 THEN
        PERFORM *
        FROM public.create_investor_wallet_transaction_internal(
          NEW.branch_id,
          NEW.investor_id,
          'contracts',
          'credit',
          'contract_investor_transfer',
          v_new_remaining,
          'نقل عقد إلى مستثمر',
          NULL,
          NULL,
          v_operation_id,
          NEW.product_id,
          NEW.id,
          NULL,
          NULL,
          NULL,
          NULL,
          jsonb_build_object('contract_number', NEW.contract_number)
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.investor_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_delta := round(v_new_amount - v_old_amount, 6);

  IF v_delta = 0 THEN
    RETURN NEW;
  END IF;

  PERFORM *
  FROM public.create_investor_wallet_transaction_internal(
    NEW.branch_id,
    NEW.investor_id,
    'contracts',
    CASE WHEN v_delta > 0 THEN 'credit' ELSE 'debit' END,
    'contract_amount_adjustment',
    abs(v_delta),
    'تعديل قيمة عقد المستثمر',
    NULL,
    NULL,
    v_operation_id,
    NEW.product_id,
    NEW.id,
    NULL,
    NULL,
    NULL,
    NULL,
    jsonb_build_object('contract_number', NEW.contract_number)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_investor_wallet_from_payment_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contract public.finance_contracts%rowtype;
  v_operation_id uuid;
  v_amount numeric;
BEGIN
  IF coalesce(NEW.is_cancelled, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_contract
  FROM public.finance_contracts
  WHERE id = NEW.contract_id
    AND branch_id = NEW.branch_id
  LIMIT 1;

  IF NOT FOUND OR v_contract.investor_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_amount := round(coalesce(NEW.payment_amount, 0), 6);

  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  v_operation_id := NEW.id;

  IF EXISTS (
    SELECT 1
    FROM public.finance_investor_wallet_transactions AS fwt
    WHERE fwt.payment_id = NEW.id
      AND fwt.transaction_type = 'contract_payment_received'
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM *
  FROM public.create_investor_wallet_transaction_internal(
    NEW.branch_id,
    v_contract.investor_id,
    'contracts',
    'debit',
    'contract_payment_received',
    v_amount,
    'تحصيل سداد عقد',
    NULL,
    NEW.created_by,
    v_operation_id,
    v_contract.product_id,
    NEW.contract_id,
    NULL,
    NEW.id,
    NULL,
    NULL,
    jsonb_build_object('contract_number', v_contract.contract_number)
  );

  PERFORM *
  FROM public.create_investor_wallet_transaction_internal(
    NEW.branch_id,
    v_contract.investor_id,
    'cash',
    'credit',
    'contract_payment_received',
    v_amount,
    'تحصيل سداد عقد',
    NULL,
    NEW.created_by,
    v_operation_id,
    v_contract.product_id,
    NEW.contract_id,
    NULL,
    NEW.id,
    NULL,
    NULL,
    jsonb_build_object('contract_number', v_contract.contract_number)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_investor_wallet_from_payment_cancel()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contract public.finance_contracts%rowtype;
  v_original_contract_tx public.finance_investor_wallet_transactions%rowtype;
  v_original_cash_tx public.finance_investor_wallet_transactions%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_amount numeric;
BEGIN
  IF coalesce(OLD.is_cancelled, false) = true
     OR coalesce(NEW.is_cancelled, false) IS DISTINCT FROM true
  THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_contract
  FROM public.finance_contracts
  WHERE id = NEW.contract_id
    AND branch_id = NEW.branch_id
  LIMIT 1;

  IF NOT FOUND OR v_contract.investor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_original_contract_tx
  FROM public.finance_investor_wallet_transactions
  WHERE payment_id = NEW.id
    AND wallet_type = 'contracts'
    AND transaction_type = 'contract_payment_received'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  SELECT *
  INTO v_original_cash_tx
  FROM public.finance_investor_wallet_transactions
  WHERE payment_id = NEW.id
    AND wallet_type = 'cash'
    AND transaction_type = 'contract_payment_received'
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  IF v_original_contract_tx.id IS NULL OR v_original_cash_tx.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.finance_investor_wallet_transactions AS fwt
    WHERE fwt.reversal_of_transaction_id IN (v_original_contract_tx.id, v_original_cash_tx.id)
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := round(coalesce(NEW.payment_amount, 0), 6);

  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  PERFORM *
  FROM public.create_investor_wallet_transaction_internal(
    NEW.branch_id,
    v_contract.investor_id,
    'cash',
    'debit',
    'payment_reversed',
    v_amount,
    'عكس سداد عقد ملغى',
    NULL,
    NEW.cancelled_by,
    v_operation_id,
    v_contract.product_id,
    NEW.contract_id,
    NULL,
    NEW.id,
    v_original_cash_tx.id,
    NULL,
    jsonb_build_object('contract_number', v_contract.contract_number)
  );

  PERFORM *
  FROM public.create_investor_wallet_transaction_internal(
    NEW.branch_id,
    v_contract.investor_id,
    'contracts',
    'credit',
    'payment_reversed',
    v_amount,
    'عكس سداد عقد ملغى',
    NULL,
    NEW.cancelled_by,
    v_operation_id,
    v_contract.product_id,
    NEW.contract_id,
    NULL,
    NEW.id,
    v_original_contract_tx.id,
    NULL,
    jsonb_build_object('contract_number', v_contract.contract_number)
  );

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.get_investor_wallets_summary_secure(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_investor_wallets_summary_secure(
  p_branch_id uuid,
  p_investor_id uuid,
  p_actor_user_id uuid
) RETURNS TABLE(
  cash_balance numeric,
  cash_total_deposits numeric,
  cash_total_withdrawals numeric,
  cash_transactions_count integer,
  cash_last_transaction_at timestamptz,
  goods_products_count integer,
  goods_total_quantity numeric,
  goods_total_value numeric,
  goods_uninitialized_count integer,
  goods_last_movement_at timestamptz,
  contracts_count integer,
  contracts_balance numeric,
  contracts_total_debt numeric,
  contracts_total_paid numeric,
  contracts_total_remaining numeric,
  contracts_last_created_at timestamptz,
  contracts_last_transaction_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor public.finance_branch_users%rowtype;
  v_investor public.finance_investors%rowtype;
BEGIN
  SELECT fbu.*
  INTO v_actor
  FROM public.finance_branch_users AS fbu
  WHERE fbu.id = p_actor_user_id
    AND fbu.branch_id = p_branch_id
    AND fbu.is_active = true
    AND coalesce(fbu.self_disabled, false) = false
    AND fbu.disabled_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVALID_SESSION';
  END IF;

  IF NOT (
    v_actor.role IN ('main_admin', 'branch_manager', 'مدير رئيسي', 'مدير فرع', 'مدير')
    OR public.finance_user_has_permission(p_branch_id, p_actor_user_id, 'view_investor_wallets')
  ) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'MISSING_PERMISSION';
  END IF;

  SELECT *
  INTO v_investor
  FROM public.finance_investors
  WHERE id = p_investor_id
    AND branch_id = p_branch_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'INVESTOR_NOT_FOUND';
  END IF;

  RETURN QUERY
  SELECT
    coalesce((SELECT balance_amount FROM public.finance_investor_wallets WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND wallet_type = 'cash'), 0),
    coalesce((SELECT sum(amount) FROM public.finance_investor_wallet_transactions WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND wallet_type = 'cash' AND direction = 'credit'), 0),
    coalesce((SELECT sum(amount) FROM public.finance_investor_wallet_transactions WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND wallet_type = 'cash' AND direction = 'debit'), 0),
    coalesce((SELECT count(*)::integer FROM public.finance_investor_wallet_transactions WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND wallet_type = 'cash'), 0),
    (SELECT max(created_at) FROM public.finance_investor_wallet_transactions WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND wallet_type = 'cash'),
    coalesce((SELECT count(*)::integer FROM public.finance_inventory WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND coalesce(quantity, 0) > 0), 0),
    coalesce((SELECT sum(coalesce(quantity, 0)) FROM public.finance_inventory WHERE branch_id = p_branch_id AND investor_id = p_investor_id), 0),
    coalesce((SELECT sum(coalesce(total_cost_value, 0)) FROM public.finance_inventory WHERE branch_id = p_branch_id AND investor_id = p_investor_id), 0),
    coalesce((SELECT count(*)::integer FROM public.finance_inventory WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND coalesce(quantity, 0) > 0 AND (average_unit_cost IS NULL OR cost_initialized_at IS NULL)), 0),
    (SELECT max(created_at) FROM public.finance_inventory_movements WHERE branch_id = p_branch_id AND investor_id = p_investor_id),
    coalesce((SELECT count(*)::integer FROM public.finance_contracts WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND coalesce(is_archived, false) = false), 0),
    coalesce((SELECT balance_amount FROM public.finance_investor_wallets WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND wallet_type = 'contracts'), 0),
    coalesce((SELECT sum(coalesce(payment_amount, debt_amount, 0)) FROM public.finance_contracts WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND coalesce(is_archived, false) = false), 0),
    coalesce((SELECT sum(coalesce(paid_amount, 0)) FROM public.finance_contracts WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND coalesce(is_archived, false) = false), 0),
    coalesce((SELECT sum(coalesce(remaining_amount, 0)) FROM public.finance_contracts WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND coalesce(is_archived, false) = false), 0),
    (SELECT max(created_at) FROM public.finance_contracts WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND coalesce(is_archived, false) = false),
    (SELECT max(created_at) FROM public.finance_investor_wallet_transactions WHERE branch_id = p_branch_id AND investor_id = p_investor_id AND wallet_type = 'contracts');
END;
$$;

DROP TRIGGER IF EXISTS sync_investor_wallet_inventory_movement_trigger
  ON public.finance_inventory_movements;

CREATE TRIGGER sync_investor_wallet_inventory_movement_trigger
AFTER INSERT ON public.finance_inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.sync_investor_wallet_from_inventory_movement();

DROP TRIGGER IF EXISTS sync_investor_wallet_contract_update_trigger
  ON public.finance_contracts;

CREATE TRIGGER sync_investor_wallet_contract_update_trigger
AFTER UPDATE OF investor_id, payment_amount, debt_amount ON public.finance_contracts
FOR EACH ROW
WHEN (
  OLD.investor_id IS DISTINCT FROM NEW.investor_id
  OR OLD.payment_amount IS DISTINCT FROM NEW.payment_amount
  OR OLD.debt_amount IS DISTINCT FROM NEW.debt_amount
)
EXECUTE FUNCTION public.sync_investor_wallet_from_contract_update();

DROP TRIGGER IF EXISTS sync_investor_wallet_payment_insert_trigger
  ON public.finance_payments;

CREATE TRIGGER sync_investor_wallet_payment_insert_trigger
AFTER INSERT ON public.finance_payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_investor_wallet_from_payment_insert();

DROP TRIGGER IF EXISTS sync_investor_wallet_payment_cancel_trigger
  ON public.finance_payments;

CREATE TRIGGER sync_investor_wallet_payment_cancel_trigger
AFTER UPDATE OF is_cancelled ON public.finance_payments
FOR EACH ROW
WHEN (OLD.is_cancelled IS DISTINCT FROM NEW.is_cancelled)
EXECUTE FUNCTION public.sync_investor_wallet_from_payment_cancel();

REVOKE ALL ON TABLE public.finance_investor_goods_transaction_details FROM PUBLIC;
REVOKE ALL ON TABLE public.finance_investor_goods_transaction_details FROM anon;
REVOKE ALL ON TABLE public.finance_investor_goods_transaction_details FROM authenticated;
GRANT ALL ON TABLE public.finance_investor_goods_transaction_details TO service_role;

REVOKE ALL ON FUNCTION public.create_investor_wallet_transaction_internal(uuid, uuid, text, text, text, numeric, text, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_investor_wallet_transaction_internal(uuid, uuid, text, text, text, numeric, text, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_investor_wallet_transaction_internal(uuid, uuid, text, text, text, numeric, text, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_investor_wallet_transaction_internal(uuid, uuid, text, text, text, numeric, text, uuid, text, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.initialize_investor_goods_cost_secure_atomic(uuid, uuid, uuid, uuid, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.initialize_investor_goods_cost_secure_atomic(uuid, uuid, uuid, uuid, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.initialize_investor_goods_cost_secure_atomic(uuid, uuid, uuid, uuid, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_investor_goods_cost_secure_atomic(uuid, uuid, uuid, uuid, numeric, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.purchase_investor_goods_secure_atomic(uuid, uuid, uuid, uuid, numeric, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purchase_investor_goods_secure_atomic(uuid, uuid, uuid, uuid, numeric, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.purchase_investor_goods_secure_atomic(uuid, uuid, uuid, uuid, numeric, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_investor_goods_secure_atomic(uuid, uuid, uuid, uuid, numeric, numeric, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.decrease_investor_goods_secure_atomic(uuid, uuid, uuid, uuid, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrease_investor_goods_secure_atomic(uuid, uuid, uuid, uuid, numeric, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.decrease_investor_goods_secure_atomic(uuid, uuid, uuid, uuid, numeric, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.decrease_investor_goods_secure_atomic(uuid, uuid, uuid, uuid, numeric, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_inventory_movement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_inventory_movement() FROM anon;
REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_inventory_movement() FROM authenticated;

REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_contract_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_contract_update() FROM anon;
REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_contract_update() FROM authenticated;

REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_payment_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_payment_insert() FROM anon;
REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_payment_insert() FROM authenticated;

REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_payment_cancel() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_payment_cancel() FROM anon;
REVOKE ALL ON FUNCTION public.sync_investor_wallet_from_payment_cancel() FROM authenticated;

REVOKE ALL ON FUNCTION public.get_investor_wallets_summary_secure(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_investor_wallets_summary_secure(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_investor_wallets_summary_secure(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_investor_wallets_summary_secure(uuid, uuid, uuid) TO service_role;
