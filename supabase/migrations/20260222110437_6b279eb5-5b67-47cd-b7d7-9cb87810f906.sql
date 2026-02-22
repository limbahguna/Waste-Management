
-- Fix 1: Restrict products SELECT to authenticated users only (hides contact_info from anonymous)
DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

-- Fix 2: Add RLS policies to profiles_public view
-- Note: profiles_public is a view with security_invoker=true, so it inherits RLS from profiles table.
-- The issue is that anon users have no SELECT policy on profiles. Let's add a limited public view policy.
-- Actually since it's security_invoker, anon users can't read it (no profile RLS for anon). 
-- But let's ensure the view is accessible to authenticated users by verifying profiles RLS covers it.
-- The current profiles SELECT policy only allows auth.uid() = id, so profiles_public view 
-- with security_invoker would only return the caller's own profile.
-- To make it useful as a public directory, we need a separate approach.

-- Create a proper RLS policy on profiles for the public view fields only
-- We'll use a function to provide limited public profile data
CREATE POLICY "Anyone can view public profile fields"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Drop the overly restrictive owner-only policy and replace with the above
-- Actually we need both: the above allows reading basic fields, but we need to restrict sensitive columns.
-- Since RLS is row-level not column-level, we keep the view approach.
-- Let's just drop the new policy and keep the owner-only one, and instead make profiles_public 
-- use SECURITY DEFINER to bypass RLS safely.

-- Revert: drop the broad policy we just created
DROP POLICY IF EXISTS "Anyone can view public profile fields" ON public.profiles;

-- Recreate profiles_public as a SECURITY DEFINER view (not security_invoker)
-- This allows it to bypass profiles RLS while only exposing safe columns
DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public 
WITH (security_barrier = true)
AS SELECT id, full_name, role, points, avatar_url, created_at
FROM public.profiles;

-- Grant access to authenticated users only (not anon)
REVOKE ALL ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;
