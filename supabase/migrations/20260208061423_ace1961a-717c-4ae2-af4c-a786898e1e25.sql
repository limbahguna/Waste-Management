-- Fix the sync functions with proper search_path

CREATE OR REPLACE FUNCTION public.sync_product_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  -- Sync Price
  IF NEW.price IS NOT NULL THEN NEW.price_per_kg := NEW.price; END IF;
  IF NEW.price_per_kg IS NOT NULL THEN NEW.price := NEW.price_per_kg; END IF;
  
  -- Sync Stock
  IF NEW.stock IS NOT NULL THEN NEW.stock_kg := NEW.stock; END IF;
  IF NEW.stock_kg IS NOT NULL THEN NEW.stock := NEW.stock_kg; END IF;

  -- Sync Image
  IF NEW.image IS NOT NULL THEN NEW.image_url := NEW.image; END IF;
  IF NEW.image_url IS NOT NULL THEN NEW.image := NEW.image_url; END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_transaction_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  -- Sync Tipe Limbah
  IF NEW.waste_type IS NOT NULL THEN NEW.type := NEW.waste_type; END IF;
  IF NEW.type IS NOT NULL THEN NEW.waste_type := NEW.type; END IF;
  
  -- Sync Berat
  IF NEW.weight IS NOT NULL THEN NEW.weight_kg := NEW.weight; END IF;
  IF NEW.weight_kg IS NOT NULL THEN NEW.weight := NEW.weight_kg; END IF;

  -- Sync Foto
  IF NEW.photo_url IS NOT NULL THEN NEW.image_url := NEW.photo_url; END IF;
  IF NEW.image_url IS NOT NULL THEN NEW.photo_url := NEW.image_url; END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_image_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.image_url := NEW.image;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  insert into public.profiles (id, full_name, role, points)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    coalesce(new.raw_user_meta_data->>'role', 'public'),
    0
  );
  return new;
end;
$function$;