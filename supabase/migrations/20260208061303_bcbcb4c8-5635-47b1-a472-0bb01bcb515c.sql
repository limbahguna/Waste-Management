-- Fix the security definer view by recreating with SECURITY INVOKER
DROP VIEW IF EXISTS profiles_public;

CREATE VIEW profiles_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  full_name,
  role,
  points,
  avatar_url,
  created_at
FROM profiles;

GRANT SELECT ON profiles_public TO authenticated;
GRANT SELECT ON profiles_public TO anon;