-- Drop the trigger that calls sync_transaction_columns (if it exists)
DROP TRIGGER IF EXISTS sync_transaction_columns_trigger ON public.transactions;

-- Also drop any other possible trigger names on transactions
DROP TRIGGER IF EXISTS sync_columns_trigger ON public.transactions;
DROP TRIGGER IF EXISTS on_transaction_change ON public.transactions;
DROP TRIGGER IF EXISTS sync_transaction_trigger ON public.transactions;

-- Replace the function so it no longer references the deleted 'type', 'weight', 'photo_url' columns
CREATE OR REPLACE FUNCTION public.sync_transaction_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Sync image_url only (photo_url and type columns have been removed)
  IF NEW.image_url IS NOT NULL THEN
    -- no-op: legacy columns removed
    NULL;
  END IF;
  RETURN NEW;
END;
$$;