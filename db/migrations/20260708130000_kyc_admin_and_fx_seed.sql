-- =============================================================
-- Admin visibility into KYC bucket + seed common FX pairs.
-- =============================================================

-- 1) Storage: allow super_admin to read/list every KYC object.
--    The bucket owner policies keep merchants scoped to their own folder;
--    this second policy is additive and lets admins render docs inline.
GRANT USAGE ON SCHEMA public TO supabase_storage_admin;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO supabase_storage_admin;

SET ROLE supabase_storage_admin;

DROP POLICY IF EXISTS "kyc admin read" ON storage.objects;
CREATE POLICY "kyc admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc' AND public.has_role(auth.uid(), 'super_admin'));

RESET ROLE;

-- 2) Seed a broad FX table (base -> BDT) so merchants see all currencies.
INSERT INTO public.fx_rates (base_currency, quote_currency, rate) VALUES
  ('USD','BDT',120.00), ('EUR','BDT',130.00), ('GBP','BDT',152.00),
  ('AUD','BDT',78.00),  ('CAD','BDT',87.00),  ('CHF','BDT',132.00),
  ('CNY','BDT',16.50),  ('JPY','BDT',0.75),   ('SGD','BDT',88.00),
  ('HKD','BDT',15.30),  ('INR','BDT',1.42),   ('PKR','BDT',0.42),
  ('LKR','BDT',0.39),   ('NPR','BDT',0.88),   ('AED','BDT',32.60),
  ('SAR','BDT',31.90),  ('QAR','BDT',32.80),  ('KWD','BDT',390.00),
  ('OMR','BDT',311.00), ('BHD','BDT',318.00), ('MYR','BDT',25.30),
  ('THB','BDT',3.30),   ('IDR','BDT',0.0075), ('KRW','BDT',0.088),
  ('TRY','BDT',3.60),   ('ZAR','BDT',6.60),   ('BRL','BDT',22.00),
  ('MXN','BDT',6.00),   ('NZD','BDT',73.00),  ('SEK','BDT',11.20),
  ('NOK','BDT',11.10),  ('DKK','BDT',17.40),  ('RUB','BDT',1.30),
  ('EGP','BDT',2.45),   ('PHP','BDT',2.10),   ('VND','BDT',0.0048)
ON CONFLICT (base_currency, quote_currency) DO NOTHING;
