-- Add CellFin to the payment_method_type enum (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_method_type' AND e.enumlabel = 'cellfin'
  ) THEN
    ALTER TYPE public.payment_method_type ADD VALUE 'cellfin';
  END IF;
END$$;

-- Seed CellFin toggle (as a BD wallet — supports both manual & auto flows).
INSERT INTO public.gateway_provider_toggles (provider, category, label) VALUES
  ('cellfin','bd','CellFin (Islami Bank)')
ON CONFLICT (provider) DO NOTHING;
