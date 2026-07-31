CREATE POLICY "product assets readable" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-assets');
CREATE POLICY "product assets admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-assets' AND public.role_has(auth.uid(),'admin'));
CREATE POLICY "product assets admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-assets' AND public.role_has(auth.uid(),'admin'));
CREATE POLICY "product assets admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-assets' AND public.role_has(auth.uid(),'admin'));