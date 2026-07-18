-- Migration: secure update_customer_atomic execution.

ALTER FUNCTION "public"."update_customer_atomic"(
  "p_branch_id" "uuid",
  "p_customer_id" "uuid",
  "p_full_name" "text",
  "p_national_id" "text",
  "p_birth_hijri" "text",
  "p_phone" "text",
  "p_work_name" "text",
  "p_address" "text",
  "p_employee_name" "text"
) SECURITY DEFINER;

ALTER FUNCTION "public"."update_customer_atomic"(
  "p_branch_id" "uuid",
  "p_customer_id" "uuid",
  "p_full_name" "text",
  "p_national_id" "text",
  "p_birth_hijri" "text",
  "p_phone" "text",
  "p_work_name" "text",
  "p_address" "text",
  "p_employee_name" "text"
) SET search_path TO 'public';

REVOKE ALL ON FUNCTION "public"."update_customer_atomic"(
  "p_branch_id" "uuid",
  "p_customer_id" "uuid",
  "p_full_name" "text",
  "p_national_id" "text",
  "p_birth_hijri" "text",
  "p_phone" "text",
  "p_work_name" "text",
  "p_address" "text",
  "p_employee_name" "text"
) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."update_customer_atomic"(
  "p_branch_id" "uuid",
  "p_customer_id" "uuid",
  "p_full_name" "text",
  "p_national_id" "text",
  "p_birth_hijri" "text",
  "p_phone" "text",
  "p_work_name" "text",
  "p_address" "text",
  "p_employee_name" "text"
) FROM "anon";

REVOKE ALL ON FUNCTION "public"."update_customer_atomic"(
  "p_branch_id" "uuid",
  "p_customer_id" "uuid",
  "p_full_name" "text",
  "p_national_id" "text",
  "p_birth_hijri" "text",
  "p_phone" "text",
  "p_work_name" "text",
  "p_address" "text",
  "p_employee_name" "text"
) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."update_customer_atomic"(
  "p_branch_id" "uuid",
  "p_customer_id" "uuid",
  "p_full_name" "text",
  "p_national_id" "text",
  "p_birth_hijri" "text",
  "p_phone" "text",
  "p_work_name" "text",
  "p_address" "text",
  "p_employee_name" "text"
) TO "service_role";
