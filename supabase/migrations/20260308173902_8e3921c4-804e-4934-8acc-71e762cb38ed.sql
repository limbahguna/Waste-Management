
-- Fix: Both SELECT policies are RESTRICTIVE (AND logic), preventing producers from seeing eco partner transactions.
-- Drop and recreate as PERMISSIVE (OR logic) so either condition grants access.

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Producers can view all transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Producers can view all transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'producer'
    )
  );
