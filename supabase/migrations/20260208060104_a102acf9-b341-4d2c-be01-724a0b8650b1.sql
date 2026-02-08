-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Producers can view profiles for transactions" ON public.profiles;

-- Create a security definer function to check if user is producer (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_producer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'producer'
  )
$$;

-- Now create the policy using the function (no recursion)
CREATE POLICY "Producers can view profiles for transactions"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_producer(auth.uid()));

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION public.is_producer TO authenticated;