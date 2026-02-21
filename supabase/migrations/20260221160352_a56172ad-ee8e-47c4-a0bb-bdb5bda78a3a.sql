
-- Fix handle_new_user to always assign 'public' role, ignoring client metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, full_name, role, points)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    'public',  -- Always default to 'public', never trust client input
    0
  );
  return new;
end;
$$;
