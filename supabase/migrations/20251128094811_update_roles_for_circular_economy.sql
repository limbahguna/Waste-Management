/*
  # Update Roles for Circular Economy Model

  ## Overview
  This migration updates the role system to support the new circular economy business model
  with two main user types: 'producer' (Mitra Produsen) and 'public' (Sobat Lingkungan).

  ## Changes Made

  ### 1. Update Role Constraints
  - Remove 'admin' role option
  - Add 'producer' role for business partners who process waste and sell biomass products
  - Add 'public' role for public users who supply waste and buy products

  ### 2. Update RLS Policies
  - Producers can create, read, update, and delete their own products
  - Producers can view and validate waste supply transactions from public users
  - Public users can create supply transactions
  - Public users can view products in marketplace

  ### 3. Data Migration
  - Convert existing 'admin' role to 'producer'
  - Convert existing 'user' role to 'public'

  ## Role Permissions

  ### Producer (Mitra Produsen)
  - Create/upload new products to marketplace
  - View and validate incoming waste supplies
  - Manage their own product listings

  ### Public (Sobat Lingkungan)
  - Submit waste supply forms
  - View marketplace and purchase products
  - Access carbon calculator
*/

-- First, migrate existing data
UPDATE profiles 
SET role = 'producer' 
WHERE role = 'admin';

UPDATE profiles 
SET role = 'public' 
WHERE role = 'user';

-- Drop existing constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add new constraint with updated roles
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('producer', 'public'));

-- Update default role for new signups to 'public'
ALTER TABLE profiles 
ALTER COLUMN role SET DEFAULT 'public';

-- Drop all existing policies to recreate with new role system
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

-- RLS Policies for profiles table
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Producers can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'producer'
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- RLS Policies for products table
CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Producers can create products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = seller_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'producer'
    )
  );

CREATE POLICY "Producers can update own products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = seller_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'producer'
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = seller_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'producer'
    )
  );

CREATE POLICY "Producers can delete own products"
  ON products FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = seller_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'producer'
    )
  );

-- RLS Policies for transactions table
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Producers can view all supply transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'producer'
    )
    AND type = 'supply'
  );

CREATE POLICY "Public users can create supply transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id 
    AND type = 'supply'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'public'
    )
  );

CREATE POLICY "Producers can update supply transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    type = 'supply'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'producer'
    )
  )
  WITH CHECK (
    type = 'supply'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'producer'
    )
  );

-- Update handle_new_user function to use 'public' as default role
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
    COALESCE(NEW.raw_user_meta_data->>'role', 'public'),
    0
  );
  RETURN NEW;
END;
$$;