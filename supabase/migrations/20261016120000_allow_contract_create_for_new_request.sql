-- Let the existing contract-create permission authorize the new-request
-- contract flow without granting any unrelated permission.
CREATE OR REPLACE FUNCTION public.finance_user_has_permission(
  p_branch_id uuid,
  p_user_id uuid,
  p_permission_key text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_permissions text[];
  v_is_active boolean;
BEGIN
  SELECT
    role,
    permissions,
    is_active
  INTO
    v_role,
    v_permissions,
    v_is_active
  FROM public.finance_branch_users
  WHERE id = p_user_id
    AND branch_id = p_branch_id
  LIMIT 1;

  IF NOT FOUND OR coalesce(v_is_active, false) = false THEN
    RETURN false;
  END IF;

  -- Keep the current manager-role bypass unchanged.
  IF lower(btrim(coalesce(v_role, ''))) IN (
    'main_admin',
    'branch_manager',
    'admin',
    'manager',
    'مدير رئيسي',
    'مدير',
    'مدير فرع'
  ) THEN
    RETURN true;
  END IF;

  RETURN
    coalesce(v_permissions, '{}'::text[])
      @> ARRAY[p_permission_key]::text[]
    OR (
      p_permission_key = 'new_request_create'
      AND coalesce(v_permissions, '{}'::text[])
        @> ARRAY['contracts_create']::text[]
    );
END;
$$;
