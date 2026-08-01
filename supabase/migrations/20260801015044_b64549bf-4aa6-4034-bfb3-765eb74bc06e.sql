
-- 1. Responsável comercial no perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Hierarquia: responsável direto OU equipe
CREATE OR REPLACE FUNCTION public.supervises(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _target AND p.supervisor_id = _viewer
  ) OR EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = _target
      AND (t.supervisor_id = _viewer OR t.manager_id = _viewer)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

-- Somente admin enxerga tudo; gerente/supervisor apenas sua equipe
CREATE OR REPLACE FUNCTION public.can_access(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _target
     OR public.is_admin(_viewer)
     OR public.supervises(_viewer, _target)
$$;

-- 3. Clientes: leitura conforme hierarquia
DROP POLICY IF EXISTS "customers readable by authenticated" ON public.customers;
CREATE POLICY "customers select hierarchy" ON public.customers FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), COALESCE(owner_id, seller_id)));

-- 4. Interações: leitura conforme hierarquia
DROP POLICY IF EXISTS "interactions readable" ON public.customer_interactions;
CREATE POLICY "interactions select hierarchy" ON public.customer_interactions FOR SELECT TO authenticated
  USING (
    public.can_access(auth.uid(), user_id)
    OR EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.can_access(auth.uid(), COALESCE(c.owner_id, c.seller_id)))
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND public.can_access(auth.uid(), l.owner_id))
  );

-- 5. Histórico de carteira: leitura conforme hierarquia
DROP POLICY IF EXISTS "owner history readable" ON public.customer_owner_history;
CREATE POLICY "owner history select hierarchy" ON public.customer_owner_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND public.can_access(auth.uid(), COALESCE(c.owner_id, c.seller_id))));

-- 6. Perfis: próprio + hierarquia
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "profiles select hierarchy" ON public.profiles FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), id));

CREATE POLICY "profiles admin manage" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 7. Perfis de acesso (user_roles): leitura hierárquica, gestão só admin
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "roles select hierarchy" ON public.user_roles FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), user_id));
CREATE POLICY "roles admin insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "roles admin update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "roles admin delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 8. Equipes: leitura restrita a membros/responsáveis/admin
DROP POLICY IF EXISTS "teams readable" ON public.teams;
CREATE POLICY "teams select hierarchy" ON public.teams FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR supervisor_id = auth.uid() OR manager_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "team members readable" ON public.team_members;
CREATE POLICY "team members select hierarchy" ON public.team_members FOR SELECT TO authenticated
  USING (public.can_access(auth.uid(), user_id));

-- 9. Configurações do sistema: apenas admin (gestor não altera)
DROP POLICY IF EXISTS "integrations readable" ON public.integrations;
CREATE POLICY "integrations select admin or leader" ON public.integrations FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_leader(auth.uid()));

-- 10. Eventos internos: controle de entrega para webhooks
ALTER TABLE public.commercial_events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.commercial_events ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.commercial_events ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.commercial_events ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
CREATE INDEX IF NOT EXISTS commercial_events_type_idx ON public.commercial_events (event_type, created_at DESC);

-- 11. Clientes inativos: detecção e geração de evento
CREATE OR REPLACE FUNCTION public.detect_inactive_customers(_days integer DEFAULT 90)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inserted integer := 0;
BEGIN
  WITH candidates AS (
    SELECT c.id, c.name, COALESCE(c.owner_id, c.seller_id) AS responsavel,
           COALESCE(c.last_activity_at, c.updated_at, c.created_at) AS ultima
    FROM public.customers c
    WHERE c.status <> 'inativo'
      AND COALESCE(c.last_activity_at, c.updated_at, c.created_at) < now() - make_interval(days => _days)
      AND NOT EXISTS (
        SELECT 1 FROM public.commercial_events e
        WHERE e.entity_id = c.id AND e.event_type = 'CLIENTE_INATIVO'
          AND e.created_at > now() - make_interval(days => _days)
      )
  ), ins AS (
    INSERT INTO public.commercial_events (event_type, entity_type, entity_id, payload, created_by)
    SELECT 'CLIENTE_INATIVO', 'customer', cd.id,
           jsonb_build_object('cliente_id', cd.id, 'cliente_nome', cd.name,
                              'responsavel_id', cd.responsavel, 'ultima_movimentacao', cd.ultima,
                              'dias_sem_movimentacao', _days),
           cd.responsavel
    FROM candidates cd
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;
  RETURN inserted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.detect_inactive_customers(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_inactive_customers(integer) TO authenticated, service_role;
