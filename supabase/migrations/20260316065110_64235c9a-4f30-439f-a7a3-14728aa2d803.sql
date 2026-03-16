CREATE POLICY "Eco partners can view assigned transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('eco_partner', 'partner')
  )
  AND (producer_id = auth.uid() OR status IN ('awaiting_pickup', 'approved', 'pending'))
);

CREATE POLICY "Eco partners can update assigned transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('eco_partner', 'partner')
  )
);