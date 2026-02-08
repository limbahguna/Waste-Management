-- Create a view for public profile data (non-sensitive)
DROP VIEW IF EXISTS profiles_public;

CREATE VIEW profiles_public AS
SELECT 
  id,
  full_name,
  role,
  points,
  avatar_url,
  created_at
FROM profiles;

-- Add RLS policy to restrict phone/address to owner only
-- First, drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Producers can view profiles for transactions" ON public.profiles;

-- Create new policy: Users can view their own full profile
CREATE POLICY "Users can view own full profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Producers can view public profile info of others through the view
-- The profiles_public view only exposes non-sensitive fields

GRANT SELECT ON profiles_public TO authenticated;
GRANT SELECT ON profiles_public TO anon;