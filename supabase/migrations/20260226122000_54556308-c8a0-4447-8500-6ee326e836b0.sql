ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS technical_data jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS eco_partner_message text DEFAULT NULL;