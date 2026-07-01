
CREATE OR REPLACE FUNCTION public.check_fraud_block(
  _merchant_id UUID,
  _email TEXT,
  _phone TEXT,
  _ip TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.fraud_blocklist
    WHERE merchant_id = _merchant_id
      AND (
        (block_type = 'email' AND lower(value) = lower(coalesce(_email,'')))
     OR (block_type = 'phone' AND value = coalesce(_phone,''))
     OR (block_type = 'sender_number' AND value = coalesce(_phone,''))
     OR (block_type = 'ip' AND value = coalesce(_ip,''))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_fraud_block(UUID,TEXT,TEXT,TEXT) TO anon, authenticated;
