
CREATE POLICY "events update delivery status" ON public.commercial_events
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
