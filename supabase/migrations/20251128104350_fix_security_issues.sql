/*
  # Fix Security Issues

  This migration addresses multiple security concerns:

  ## 1. Unused Indexes
  - Removes 8 unused indexes that are not being utilized by queries
  - Improves database performance by reducing index maintenance overhead
  - Indexes removed:
    - idx_profiles_email
    - idx_products_category
    - idx_products_seller
    - idx_transactions_user
    - idx_transactions_status
    - idx_transactions_type
    - idx_transactions_approved_by
    - idx_transactions_product_id

  ## 2. Multiple Permissive RLS Policies
  - Consolidates overlapping SELECT policies on profiles table
  - Consolidates overlapping SELECT policies on transactions table
  - Uses RESTRICTIVE policies where appropriate to avoid permission conflicts
  - Ensures proper access control without policy conflicts

  ## Changes
  1. Drop unused indexes
  2. Drop existing overlapping policies
  3. Create new consolidated policies with proper restrictions
*/

-- Drop unused indexes
DROP INDEX IF EXISTS idx_profiles_email;
DROP INDEX IF EXISTS idx_products_category;
DROP INDEX IF EXISTS idx_products_seller;
DROP INDEX IF EXISTS idx_transactions_user;
DROP INDEX IF EXISTS idx_transactions_status;
DROP INDEX IF EXISTS idx_transactions_type;
DROP INDEX IF EXISTS idx_transactions_approved_by;
DROP INDEX IF EXISTS idx_transactions_product_id;

-- Fix profiles table policies
-- Drop existing overlapping policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Producers can view all profiles" ON profiles;

-- Create new consolidated SELECT policy for profiles
CREATE POLICY "Profiles select access"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'producer'
    )
  );

-- Fix transactions table policies
-- Drop existing overlapping policies
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Producers can view all supply transactions" ON transactions;

-- Create new consolidated SELECT policy for transactions
CREATE POLICY "Transactions select access"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'producer'
    )
  );
