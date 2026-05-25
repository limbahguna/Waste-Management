
-- 1) Prevent self role escalation on profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Not authorized to change role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_change_trg ON public.profiles;
CREATE TRIGGER prevent_profile_role_change_trg
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

-- 2) Tighten eco_partner transactions policies
DROP POLICY IF EXISTS "Eco partners can view assigned transactions" ON public.transactions;
CREATE POLICY "Eco partners can view assigned transactions"
ON public.transactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('eco_partner','partner')
  )
  AND (producer_id = auth.uid() OR producer_id IS NULL)
);

DROP POLICY IF EXISTS "Eco partners can update assigned transactions" ON public.transactions;
CREATE POLICY "Eco partners can update assigned transactions"
ON public.transactions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('eco_partner','partner')
  )
  AND (producer_id = auth.uid() OR producer_id IS NULL)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('eco_partner','partner')
  )
  AND producer_id = auth.uid()
);

-- 3) Restrict products bucket uploads to producers
DROP POLICY IF EXISTS "Authenticated users can upload product files" ON storage.objects;
CREATE POLICY "Producers can upload product files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'products'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'producer'
  )
);
