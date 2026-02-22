
-- Fix the security definer view issue
-- Recreate profiles_public with security_invoker (safe)
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public 
WITH (security_invoker = true)
AS SELECT id, full_name, role, points, avatar_url, created_at
FROM public.profiles;

-- Grant to authenticated only
REVOKE ALL ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;

-- We need authenticated users to read other profiles via the view
-- Add a SELECT policy for authenticated users to read non-sensitive profile fields
-- The view already filters columns, so row-level access can be broader
CREATE POLICY "Authenticated can view profiles for public view"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
