-- Migration: directed request offers constraint guards
-- Adds missing constraints safely without modifying the original applied migration.

DO $$
BEGIN
  IF to_regclass('public.finance_directed_request_offers') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'finance_directed_request_offers_pkey'
        AND conrelid = 'public.finance_directed_request_offers'::regclass
    ) THEN
    ALTER TABLE ONLY public.finance_directed_request_offers
      ADD CONSTRAINT finance_directed_request_offers_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.finance_directed_request_offer_events') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'finance_directed_request_offer_events_pkey'
        AND conrelid = 'public.finance_directed_request_offer_events'::regclass
    ) THEN
    ALTER TABLE ONLY public.finance_directed_request_offer_events
      ADD CONSTRAINT finance_directed_request_offer_events_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.finance_directed_offer_acceptance_blocks') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'finance_directed_offer_acceptance_blocks_pkey'
        AND conrelid = 'public.finance_directed_offer_acceptance_blocks'::regclass
    ) THEN
    ALTER TABLE ONLY public.finance_directed_offer_acceptance_blocks
      ADD CONSTRAINT finance_directed_offer_acceptance_blocks_pkey PRIMARY KEY (branch_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.finance_directed_request_offers') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'finance_directed_request_offers_created_branch_fkey'
        AND conrelid = 'public.finance_directed_request_offers'::regclass
    ) THEN
    ALTER TABLE ONLY public.finance_directed_request_offers
      ADD CONSTRAINT finance_directed_request_offers_created_branch_fkey
      FOREIGN KEY (created_by_branch_id) REFERENCES public.finance_branches(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.finance_directed_request_offers') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'finance_directed_request_offers_accepted_branch_fkey'
        AND conrelid = 'public.finance_directed_request_offers'::regclass
    ) THEN
    ALTER TABLE ONLY public.finance_directed_request_offers
      ADD CONSTRAINT finance_directed_request_offers_accepted_branch_fkey
      FOREIGN KEY (accepted_by_branch_id) REFERENCES public.finance_branches(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.finance_directed_request_offers') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'finance_directed_request_offers_contract_fkey'
        AND conrelid = 'public.finance_directed_request_offers'::regclass
    ) THEN
    ALTER TABLE ONLY public.finance_directed_request_offers
      ADD CONSTRAINT finance_directed_request_offers_contract_fkey
      FOREIGN KEY (contract_id) REFERENCES public.finance_contracts(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.finance_directed_request_offer_events') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'finance_directed_request_offer_events_offer_fkey'
        AND conrelid = 'public.finance_directed_request_offer_events'::regclass
    ) THEN
    ALTER TABLE ONLY public.finance_directed_request_offer_events
      ADD CONSTRAINT finance_directed_request_offer_events_offer_fkey
      FOREIGN KEY (offer_id) REFERENCES public.finance_directed_request_offers(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.finance_directed_offer_acceptance_blocks') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'finance_directed_offer_acceptance_blocks_branch_fkey'
        AND conrelid = 'public.finance_directed_offer_acceptance_blocks'::regclass
    ) THEN
    ALTER TABLE ONLY public.finance_directed_offer_acceptance_blocks
      ADD CONSTRAINT finance_directed_offer_acceptance_blocks_branch_fkey
      FOREIGN KEY (branch_id) REFERENCES public.finance_branches(id) ON DELETE CASCADE;
  END IF;
END $$;
