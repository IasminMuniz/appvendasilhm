
REVOKE EXECUTE ON FUNCTION public.can_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.supervises(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_leader(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.role_has(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.detect_inactive_customers(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.supervises(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_leader(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.role_has(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.detect_inactive_customers(integer) TO service_role;
