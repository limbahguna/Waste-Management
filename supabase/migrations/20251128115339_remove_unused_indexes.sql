/*
  # Remove Unused Database Indexes

  1. Changes
    - Drop unused index `idx_products_seller_id` on `public.products`
    - Drop unused index `idx_transactions_user_id` on `public.transactions`
    - Drop unused index `idx_transactions_approved_by` on `public.transactions`
    - Drop unused index `idx_transactions_product_id` on `public.transactions`

  2. Rationale
    - These indexes have not been used and are consuming storage
    - Removing unused indexes improves write performance
    - If needed in the future, they can be recreated

  3. Notes
    - Using IF EXISTS to prevent errors if indexes don't exist
    - This is a safe operation that only affects performance optimization
*/

DROP INDEX IF EXISTS idx_products_seller_id;
DROP INDEX IF EXISTS idx_transactions_user_id;
DROP INDEX IF EXISTS idx_transactions_approved_by;
DROP INDEX IF EXISTS idx_transactions_product_id;
