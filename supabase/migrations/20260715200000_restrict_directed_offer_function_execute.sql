-- Migration: restrict directed offer function execution
-- Keeps directed offer RPCs executable only through service_role-backed APIs.

DO $$
DECLARE
  v_missing_signatures text[];
BEGIN
  SELECT array_agg(signature)
  INTO v_missing_signatures
  FROM (
    VALUES
      ('public.recalculate_directed_offers_accept_block_atomic(uuid)'),
      ('public.create_directed_request_offer_atomic(uuid,uuid,text,text,text,text,text,numeric,text,integer,integer,integer,numeric)'),
      ('public.create_directed_request_offer_atomic(uuid,uuid,text,text,text,text,text,text,numeric,text,integer,integer,integer,numeric)'),
      ('public.accept_directed_request_offer_atomic(uuid,uuid,uuid,text)'),
      ('public.withdraw_directed_request_offer_acceptance_atomic(uuid,uuid,uuid,text)'),
      ('public.cancel_directed_request_offer_atomic(uuid,uuid,uuid,text)'),
      ('public.mark_directed_offer_contract_created_atomic(uuid,uuid,uuid,text,uuid)'),
      ('public.mark_directed_offer_paid_atomic(uuid)'),
      ('public.mark_directed_offer_commission_not_delivered_atomic(uuid,uuid,uuid,text)'),
      ('public.mark_directed_offer_commission_received_atomic(uuid,uuid,uuid,text)'),
      ('public.sync_directed_offer_paid_from_contract()')
  ) AS required(signature)
  WHERE to_regprocedure(signature) IS NULL;

  IF v_missing_signatures IS NOT NULL THEN
    RAISE EXCEPTION 'Missing directed offer function signatures: %', array_to_string(v_missing_signatures, ', ');
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.recalculate_directed_offers_accept_block_atomic(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_directed_offers_accept_block_atomic(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_directed_offers_accept_block_atomic(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_directed_offers_accept_block_atomic(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_directed_request_offer_atomic(uuid, uuid, text, text, text, text, text, numeric, text, integer, integer, integer, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_directed_request_offer_atomic(uuid, uuid, text, text, text, text, text, numeric, text, integer, integer, integer, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_directed_request_offer_atomic(uuid, uuid, text, text, text, text, text, numeric, text, integer, integer, integer, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_directed_request_offer_atomic(uuid, uuid, text, text, text, text, text, numeric, text, integer, integer, integer, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_directed_request_offer_atomic(uuid, uuid, text, text, text, text, text, text, numeric, text, integer, integer, integer, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_directed_request_offer_atomic(uuid, uuid, text, text, text, text, text, text, numeric, text, integer, integer, integer, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_directed_request_offer_atomic(uuid, uuid, text, text, text, text, text, text, numeric, text, integer, integer, integer, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_directed_request_offer_atomic(uuid, uuid, text, text, text, text, text, text, numeric, text, integer, integer, integer, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.accept_directed_request_offer_atomic(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_directed_request_offer_atomic(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_directed_request_offer_atomic(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_directed_request_offer_atomic(uuid, uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.withdraw_directed_request_offer_acceptance_atomic(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.withdraw_directed_request_offer_acceptance_atomic(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_directed_request_offer_acceptance_atomic(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_directed_request_offer_acceptance_atomic(uuid, uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_directed_request_offer_atomic(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_directed_request_offer_atomic(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_directed_request_offer_atomic(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_directed_request_offer_atomic(uuid, uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_contract_created_atomic(uuid, uuid, uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_contract_created_atomic(uuid, uuid, uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_contract_created_atomic(uuid, uuid, uuid, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_directed_offer_contract_created_atomic(uuid, uuid, uuid, text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_paid_atomic(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_paid_atomic(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_paid_atomic(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_directed_offer_paid_atomic(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_commission_not_delivered_atomic(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_commission_not_delivered_atomic(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_commission_not_delivered_atomic(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_directed_offer_commission_not_delivered_atomic(uuid, uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_commission_received_atomic(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_commission_received_atomic(uuid, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_directed_offer_commission_received_atomic(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_directed_offer_commission_received_atomic(uuid, uuid, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.sync_directed_offer_paid_from_contract() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_directed_offer_paid_from_contract() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_directed_offer_paid_from_contract() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_directed_offer_paid_from_contract() TO service_role;
