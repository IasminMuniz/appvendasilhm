-- Correção de lançamentos pedida pela dona da loja (25/11/2026):
-- os R$ 300 lançados como Pró-labore eram dinheiro dela colocado na loja, não retirada.
-- 1) Registra o investimento inicial de R$ 1.500 como aporte (uma vez só).
-- 2) Apaga a despesa de Pró-labore de R$ 300.
DO $$
DECLARE
  _owner uuid;
BEGIN
  SELECT created_by INTO _owner FROM public.expenses
   WHERE category = 'Pró-labore' AND amount = 300
   ORDER BY created_at LIMIT 1;
  IF _owner IS NULL THEN
    SELECT user_id INTO _owner FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  END IF;

  IF _owner IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.capital_contributions WHERE description = 'Investimento inicial'
  ) THEN
    INSERT INTO public.capital_contributions (contribution_date, amount, description, created_by)
    VALUES (
      COALESCE((SELECT MIN(purchase_date) FROM public.purchases), CURRENT_DATE),
      1500,
      'Investimento inicial',
      _owner
    );
  END IF;

  DELETE FROM public.expenses WHERE category = 'Pró-labore' AND amount = 300;
END $$;
