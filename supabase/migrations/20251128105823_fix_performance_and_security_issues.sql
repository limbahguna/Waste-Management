/*
  # Fix Performance and Security Issues

  This migration addresses critical performance and security concerns:

  ## 1. Add Missing Foreign Key Indexes
  Foreign keys without indexes cause slow queries. Adding indexes for:
  - `products.seller_id` → profiles(id)
  - `transactions.user_id` → profiles(id)
  - `transactions.approved_by` → profiles(id)
  - `transactions.product_id` → products(id)

  ## 2. Optimize RLS Policies
  Rewrites RLS policies to use `(select auth.uid())` instead of direct `auth.uid()` calls.
  This prevents re-evaluation for each row, significantly improving query performance.

  Policies optimized:
  - `profiles`: "Profiles select access"
  - `transactions`: "Transactions select access"

  ## 3. Benefits
  - Faster foreign key lookups and JOINs
  - Better query performance at scale (thousands of rows)
  - Reduced CPU usage on database
  - More efficient RLS policy evaluation
*/

-- ============================================
-- 1. ADD FOREIGN KEY INDEXES
-- ============================================

-- Index for products.seller_id
CREATE INDEX IF NOT EXISTS idx_products_seller_id 
  ON products(seller_id);

-- Index for transactions.user_id
CREATE INDEX IF NOT EXISTS idx_transactions_user_id 
  ON transactions(user_id);

-- Index for transactions.approved_by
CREATE INDEX IF NOT EXISTS idx_transactions_approved_by 
  ON transactions(approved_by);

-- Index for transactions.product_id
CREATE INDEX IF NOT EXISTS idx_transactions_product_id 
  ON transactions(product_id);

-- ============================================
-- 2. OPTIMIZE RLS POLICIES
-- ============================================

-- Drop and recreate profiles SELECT policy with optimized auth check
DROP POLICY IF EXISTS "Profiles select access" ON profiles;

CREATE POLICY "Profiles select access"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (select auth.uid()) OR 
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.role = 'producer'
    )
  );

-- Drop and recreate transactions SELECT policy with optimized auth check
DROP POLICY IF EXISTS "Transactions select access" ON transactions;

CREATE POLICY "Transactions select access"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.role = 'producer'
    )
  );
