-- Soft-archive finance investors while preserving their historical relations.
ALTER TABLE public.finance_investors
  ADD COLUMN IF NOT EXISTS is_archived boolean,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

ALTER TABLE public.finance_investors
  ALTER COLUMN is_archived SET DEFAULT false;

UPDATE public.finance_investors
SET is_archived = false
WHERE is_archived IS NULL;

ALTER TABLE public.finance_investors
  ALTER COLUMN is_archived SET NOT NULL;

CREATE INDEX IF NOT EXISTS finance_investors_branch_active_list_idx
  ON public.finance_investors (branch_id, created_at DESC)
  WHERE is_archived = false;

COMMENT ON COLUMN public.finance_investors.is_archived IS
  'Hides an investor from active lists without deleting historical data.';

COMMENT ON COLUMN public.finance_investors.archived_at IS
  'Timestamp when the investor was archived.';

COMMENT ON COLUMN public.finance_investors.archived_by IS
  'Finance branch user who archived the investor.';
