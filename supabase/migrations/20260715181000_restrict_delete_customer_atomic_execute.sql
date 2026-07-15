REVOKE ALL ON FUNCTION "public"."delete_customer_atomic"(
  "p_branch_id" "uuid",
  "p_customer_id" "uuid",
  "p_employee_name" "text"
) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."delete_customer_atomic"(
  "p_branch_id" "uuid",
  "p_customer_id" "uuid",
  "p_employee_name" "text"
) FROM "anon";

REVOKE ALL ON FUNCTION "public"."delete_customer_atomic"(
  "p_branch_id" "uuid",
  "p_customer_id" "uuid",
  "p_employee_name" "text"
) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."delete_customer_atomic"(
  "p_branch_id" "uuid",
  "p_customer_id" "uuid",
  "p_employee_name" "text"
) TO "service_role";
