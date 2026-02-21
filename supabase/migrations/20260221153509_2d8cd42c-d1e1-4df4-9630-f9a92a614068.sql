
-- Add producer_id column for tracking which producer accepted an offer
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS producer_id UUID NULL;

-- Add approved_at timestamp
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE NULL;
