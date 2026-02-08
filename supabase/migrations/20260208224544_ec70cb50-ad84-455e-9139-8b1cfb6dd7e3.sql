-- Update David's test account to producer role for testing AI Scan
UPDATE profiles 
SET role = 'producer' 
WHERE id = '20f49f4b-e3e7-4fa7-88fe-d1477a1fffba';

-- Also update the other David account in case that's the one being used
UPDATE profiles 
SET role = 'producer' 
WHERE id = 'e918ccf2-212a-4178-aab5-fb41672f3310';