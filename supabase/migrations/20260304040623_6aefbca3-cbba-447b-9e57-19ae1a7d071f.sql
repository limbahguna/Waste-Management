
-- Drop the overly broad SELECT policy that exposes phone/address to all authenticated users
DROP POLICY IF EXISTS "Authenticated can view profiles for public view" ON profiles;

-- Add a targeted policy: producers can view all profiles (needed for transaction joins)
CREATE POLICY "Producers can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'producer'
  )
);
