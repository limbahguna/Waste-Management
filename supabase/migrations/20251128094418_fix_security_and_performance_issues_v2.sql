/*
  # Fix Security and Performance Issues

  ## Overview
  This migration fixes all security warnings and performance issues identified by Supabase Advisor.

  ## Changes Made

  ### 1. Add Missing Indexes
  - Add index for `transactions.approved_by` foreign key
  - Add index for `transactions.product_id` foreign key

  ### 2. Optimize RLS Policies
  - Replace `auth.uid()` with `(SELECT auth.uid())` in all policies
  - This prevents re-evaluation of auth functions for each row
  - Significantly improves query performance at scale

  ### 3. Fix Function Search Paths
  - Add explicit search_path to all functions
  - Prevents search_path hijacking attacks

  ### 4. Consolidate Permissive Policies
  - Combine multiple SELECT policies into single optimized policies
  - Reduces policy evaluation overhead

  ## Security Improvements
  1. Protected against search_path attacks
  2. Optimized RLS policy evaluation
  3. Better index coverage for foreign keys

  ## Performance Improvements
  1. Faster query execution with proper indexes
  2. Reduced auth function re-evaluation
  3. Simplified policy evaluation
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_transactions_approved_by ON transactions(approved_by);
CREATE INDEX IF NOT EXISTS idx_transactions_product_id ON transactions(product_id);

-- Drop ALL existing RLS policies to recreate them with optimizations
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON profiles';
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'products' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON products';
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'transactions' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON transactions';
    END LOOP;
END $$;

-- Recreate optimized RLS policies for profiles table
-- Consolidate SELECT policies into one
CREATE POLICY "Users can view own or admin can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = id 
    OR 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Recreate optimized RLS policies for products table
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = seller_id);

CREATE POLICY "Sellers can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = seller_id)
  WITH CHECK ((SELECT auth.uid()) = seller_id);

CREATE POLICY "Sellers can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = seller_id);

-- Recreate optimized RLS policies for transactions table
-- Consolidate SELECT policies into one
CREATE POLICY "Users can view own or admin can view all transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create supply transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id 
    AND type = 'supply'
  );

CREATE POLICY "Admins can update transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- Fix function search paths by recreating functions with explicit search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, points)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'user',
    0
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_user_points_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.type = 'supply' THEN
    UPDATE public.profiles
    SET points = points + NEW.points_earned
    WHERE id = NEW.user_id;
    
    NEW.approved_at = now();
  END IF;
  RETURN NEW;
END;
$$;