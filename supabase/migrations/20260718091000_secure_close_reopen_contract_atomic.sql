-- Migration: secure contract close and reopen RPC execution.

ALTER FUNCTION "public"."close_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) SECURITY DEFINER;

ALTER FUNCTION "public"."close_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) SET search_path TO 'public';

REVOKE ALL ON FUNCTION "public"."close_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."close_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) FROM "anon";

REVOKE ALL ON FUNCTION "public"."close_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."close_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) TO "service_role";

ALTER FUNCTION "public"."reopen_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) SECURITY DEFINER;

ALTER FUNCTION "public"."reopen_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) SET search_path TO 'public';

REVOKE ALL ON FUNCTION "public"."reopen_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."reopen_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) FROM "anon";

REVOKE ALL ON FUNCTION "public"."reopen_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."reopen_contract_atomic"(
  "p_branch_id" "uuid",
  "p_contract_id" "uuid",
  "p_employee_name" "text"
) TO "service_role";
