-- Migration: fix directed offer acceptance block upsert ambiguity
-- Uses the primary-key constraint name to avoid PL/pgSQL OUT parameter ambiguity.

CREATE OR REPLACE FUNCTION "public"."recalculate_directed_offers_accept_block_atomic"("p_branch_id" "uuid")
RETURNS TABLE("branch_id" "uuid", "active_not_delivered_count" integer, "is_blocked" boolean)
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
declare
  v_count integer := 0;
  v_blocked boolean := false;
begin
  if p_branch_id is null then
    raise exception using errcode = 'P0001', message = 'BRANCH_REQUIRED';
  end if;

  select count(*)::integer
  into v_count
  from public.finance_directed_request_offers
  where accepted_by_branch_id = p_branch_id
    and status = 'paid'
    and commission_status = 'not_delivered';

  v_blocked := v_count >= 2;

  insert into public.finance_directed_offer_acceptance_blocks (
    branch_id,
    active_not_delivered_count,
    is_blocked,
    updated_at
  )
  values (
    p_branch_id,
    v_count,
    v_blocked,
    now()
  )
  on conflict on constraint finance_directed_offer_acceptance_blocks_pkey do update
  set
    active_not_delivered_count = excluded.active_not_delivered_count,
    is_blocked = excluded.is_blocked,
    updated_at = excluded.updated_at;

  return query
  select p_branch_id, v_count, v_blocked;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_directed_offers_accept_block_atomic(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_directed_offers_accept_block_atomic(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_directed_offers_accept_block_atomic(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_directed_offers_accept_block_atomic(uuid) TO service_role;
