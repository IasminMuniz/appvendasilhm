CREATE POLICY "Authenticated read quote pdfs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'quote-pdfs');
CREATE POLICY "Authenticated upload quote pdfs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'quote-pdfs');
CREATE POLICY "Authenticated update quote pdfs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'quote-pdfs') WITH CHECK (bucket_id = 'quote-pdfs');
CREATE POLICY "Authenticated delete quote pdfs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'quote-pdfs');