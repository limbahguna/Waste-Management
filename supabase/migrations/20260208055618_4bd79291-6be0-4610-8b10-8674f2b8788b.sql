-- Create a public view for profiles that excludes sensitive columns
CREATE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT 
    id, 
    full_name, 
    avatar_url, 
    role, 
    points, 
    created_at
  FROM public.profiles;
-- Note: phone and address are excluded from this public view

-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- Create a restrictive policy: users can only view their own profile directly
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create a policy for producers to view profiles (needed for transaction management)
CREATE POLICY "Producers can view profiles for transactions"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'producer'
    )
  );

-- Create function to increment user points (SECURITY DEFINER for producer use)
CREATE OR REPLACE FUNCTION public.increment_user_points(
  user_id uuid,
  points_to_add integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate points_to_add is positive
  IF points_to_add <= 0 THEN
    RAISE EXCEPTION 'Points to add must be positive';
  END IF;
  
  -- Verify caller is a producer
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'producer'
  ) THEN
    RAISE EXCEPTION 'Only producers can award points';
  END IF;
  
  -- Update user points
  UPDATE profiles
  SET points = COALESCE(points, 0) + points_to_add
  WHERE id = user_id;
  
  -- Verify the user exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_user_points TO authenticated;