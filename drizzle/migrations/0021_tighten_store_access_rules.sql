CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- Financeiro da loja: só administradores/gerentes ou quem criou
DROP POLICY IF EXISTS "contributions read" ON public.capital_contributions;
CREATE POLICY "contributions read" ON public.capital_contributions FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_leader(auth.uid()));

DROP POLICY IF EXISTS "expenses read" ON public.expenses;
CREATE POLICY "expenses read" ON public.expenses FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_leader(auth.uid()));

DROP POLICY IF EXISTS "purchases read" ON public.purchases;
CREATE POLICY "purchases read" ON public.purchases FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_leader(auth.uid()));

DROP POLICY IF EXISTS "purchase items read" ON public.purchase_items;
CREATE POLICY "purchase items read" ON public.purchase_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchases p WHERE p.id = purchase_items.purchase_id
    AND (p.created_by = auth.uid() OR public.is_leader(auth.uid()))));

DROP POLICY IF EXISTS "suppliers read" ON public.suppliers;
CREATE POLICY "suppliers read" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Pagamentos de vendas: quem tem acesso à venda
DROP POLICY IF EXISTS "order payments read" ON public.order_payments;
DROP POLICY IF EXISTS "order payments write" ON public.order_payments;
CREATE POLICY "order payments read" ON public.order_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_payments.order_id
    AND public.can_access(auth.uid(), o.seller_id)));
CREATE POLICY "order payments write" ON public.order_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_payments.order_id
    AND public.can_access(auth.uid(), o.seller_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_payments.order_id
    AND public.can_access(auth.uid(), o.seller_id)));

-- Catálogo: somente equipe com papel atribuído
DROP POLICY IF EXISTS "price history readable by authenticated" ON public.product_price_history;
CREATE POLICY "price history readable by authenticated" ON public.product_price_history FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "discount policies readable" ON public.discount_policies;
CREATE POLICY "discount policies readable" ON public.discount_policies FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "product images readable" ON public.product_images;
CREATE POLICY "product images readable" ON public.product_images FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "product docs readable" ON public.product_documents;
CREATE POLICY "product docs readable" ON public.product_documents FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Configurações da loja: só administradores/gerentes alteram
DROP POLICY IF EXISTS "store settings update" ON public.store_settings;
DROP POLICY IF EXISTS "store settings insert" ON public.store_settings;
CREATE POLICY "store settings update" ON public.store_settings FOR UPDATE TO authenticated
  USING (public.is_leader(auth.uid())) WITH CHECK (public.is_leader(auth.uid()));
CREATE POLICY "store settings insert" ON public.store_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_leader(auth.uid()));

-- Arquivos
DROP POLICY IF EXISTS "product assets readable" ON storage.objects;
CREATE POLICY "product assets readable" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-assets' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read quote pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload quote pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update quote pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete quote pdfs" ON storage.objects;
CREATE POLICY "Authenticated read quote pdfs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'quote-pdfs' AND EXISTS (SELECT 1 FROM public.quotes q
    WHERE q.id::text = (storage.foldername(name))[1] AND public.can_access(auth.uid(), q.seller_id)));
CREATE POLICY "Authenticated upload quote pdfs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quote-pdfs' AND EXISTS (SELECT 1 FROM public.quotes q
    WHERE q.id::text = (storage.foldername(name))[1] AND public.can_access(auth.uid(), q.seller_id)));
CREATE POLICY "Authenticated update quote pdfs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'quote-pdfs' AND EXISTS (SELECT 1 FROM public.quotes q
    WHERE q.id::text = (storage.foldername(name))[1] AND public.can_access(auth.uid(), q.seller_id)))
  WITH CHECK (bucket_id = 'quote-pdfs' AND EXISTS (SELECT 1 FROM public.quotes q
    WHERE q.id::text = (storage.foldername(name))[1] AND public.can_access(auth.uid(), q.seller_id)));
CREATE POLICY "Authenticated delete quote pdfs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'quote-pdfs' AND EXISTS (SELECT 1 FROM public.quotes q
    WHERE q.id::text = (storage.foldername(name))[1] AND public.can_access(auth.uid(), q.seller_id)));