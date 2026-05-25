
-- 1) Drop weak storage upload policy
DROP POLICY IF EXISTS "Producer Upload" ON storage.objects;

-- 2) Scope producer profile visibility to users who have a transaction
DROP POLICY IF EXISTS "Producers can view all profiles via function" ON public.profiles;
CREATE POLICY "Producers can view transacting user profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.is_producer(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.user_id = profiles.id
  )
);

-- 3) Scope producer UPDATE on transactions
DROP POLICY IF EXISTS "Producers can update transactions" ON public.transactions;
CREATE POLICY "Producers can update own transactions"
ON public.transactions FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'producer')
  AND (producer_id = auth.uid() OR producer_id IS NULL)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'producer')
  AND (producer_id = auth.uid() OR producer_id IS NULL)
);

-- 4) Restrict columns eco_partner can change on transactions
CREATE OR REPLACE FUNCTION public.restrict_eco_partner_transaction_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF caller_role IN ('eco_partner','partner') THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.weight_kg IS DISTINCT FROM OLD.weight_kg
       OR NEW.waste_type IS DISTINCT FROM OLD.waste_type
       OR NEW.grade IS DISTINCT FROM OLD.grade
       OR NEW.carbon_saved IS DISTINCT FROM OLD.carbon_saved
       OR NEW.confidence_score IS DISTINCT FROM OLD.confidence_score
       OR NEW.technical_data IS DISTINCT FROM OLD.technical_data
       OR NEW.latitude IS DISTINCT FROM OLD.latitude
       OR NEW.longitude IS DISTINCT FROM OLD.longitude
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.address IS DISTINCT FROM OLD.address
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Eco partners may only update claim/status/pickup fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_eco_partner_transaction_columns_trg ON public.transactions;
CREATE TRIGGER restrict_eco_partner_transaction_columns_trg
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.restrict_eco_partner_transaction_columns();
