
-- Add pickup_date column to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS pickup_date date;
