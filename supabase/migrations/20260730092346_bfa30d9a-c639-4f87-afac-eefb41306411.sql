-- Alterar has_role para SECURITY INVOKER (evita alerta de SECURITY DEFINER)
-- As políticas só usam public.has_role(auth.uid(), 'admin'), ou seja, o próprio usuário,
-- e a tabela user_roles já permite que cada usuário leia seus próprios papéis.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Garantir que usuários autenticados possam usar has_role nas políticas de RLS
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- handle_new_user é uma trigger function: não deve ser chamada diretamente
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- update_updated_at_column também é uma trigger function
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;