ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS latitude numeric DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS longitude numeric DEFAULT NULL;