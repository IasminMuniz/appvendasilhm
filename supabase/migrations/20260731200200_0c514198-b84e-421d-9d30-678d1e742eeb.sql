CREATE OR REPLACE FUNCTION public.role_has(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_leader(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.role_has(_user_id, 'admin') OR public.role_has(_user_id, 'gerente')
$$;

CREATE OR REPLACE FUNCTION public.supervises(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.user_id = _target
      AND (t.supervisor_id = _viewer OR t.manager_id = _viewer)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access(_viewer uuid, _target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT _viewer = _target OR public.is_leader(_viewer) OR public.supervises(_viewer, _target)
$$;