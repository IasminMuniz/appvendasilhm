ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ultima_interacao timestamp with time zone;

UPDATE public.leads
SET ultima_interacao = COALESCE(last_activity_at, updated_at, created_at);

CREATE OR REPLACE FUNCTION public.sync_lead_ultima_interacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.ultima_interacao := COALESCE(NEW.last_activity_at, NEW.ultima_interacao, now());
    NEW.last_activity_at := COALESCE(NEW.last_activity_at, NEW.ultima_interacao);
  ELSE
    IF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at THEN
      NEW.ultima_interacao := COALESCE(NEW.last_activity_at, now());
    ELSE
      NEW.ultima_interacao := now();
      NEW.last_activity_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_ultima_interacao ON public.leads;
CREATE TRIGGER trg_leads_ultima_interacao
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_ultima_interacao();