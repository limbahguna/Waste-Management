
-- Drop the recursive policy that causes infinite recursion
DROP POLICY IF EXISTS "Producers can view all profiles" ON profiles;

-- Recreate: users can always view their own profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Producers can view all profiles using the security definer function (avoids recursion)
CREATE POLICY "Producers can view all profiles via function"
ON profiles FOR SELECT
TO authenticated
USING (public.is_producer(auth.uid()));
