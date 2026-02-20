
-- Add RLS policies for the 'products' storage bucket

-- Allow public read access (marketplace images are public)
CREATE POLICY "Public can view product files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'products');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload product files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');

-- Allow users to update only their own uploaded files
CREATE POLICY "Users can update own product files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'products' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete only their own uploaded files
CREATE POLICY "Users can delete own product files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'products' AND auth.uid()::text = (storage.foldername(name))[1]);
