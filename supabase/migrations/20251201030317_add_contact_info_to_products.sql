/*
  # Add contact_info column to products table

  1. Changes
    - Add `contact_info` column to `products` table
      - Type: text (for storing WhatsApp number)
      - Nullable: allows existing products to not have contact info
      - This will be the primary contact method for buyers to reach sellers

  2. Notes
    - This column will store the seller's WhatsApp number
    - Falls back to profiles.phone if contact_info is not provided
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'contact_info'
  ) THEN
    ALTER TABLE products ADD COLUMN contact_info text;
  END IF;
END $$;