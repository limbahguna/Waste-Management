
-- Update eco partner SELECT policy to include 'picked_up' status
DROP POLICY IF EXISTS "Eco partners can view assigned transactions" ON public.transactions;
CREATE POLICY "Eco partners can view assigned transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('eco_partner', 'partner')
  ))
  AND (producer_id = auth.uid() OR status IN ('awaiting_pickup', 'approved', 'pending', 'picked_up'))
);

-- Allow regular users to also see their own transactions with picked_up status (they need to confirm handover)
-- The existing "Users can view own transactions" policy already covers this since it checks user_id = auth.uid()

-- Allow regular users to update their own transactions (for confirm handover)
CREATE POLICY "Users can update own transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
