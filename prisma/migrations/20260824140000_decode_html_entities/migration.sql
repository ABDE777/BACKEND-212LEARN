-- Reverse the over-eager input escaping that stored user text with HTML
-- entities (apostrophes as &#x27;, quotes as &quot;, ampersands as &amp;).
-- The xssSanitizer middleware no longer encodes these; this fixes existing rows.
--
-- Safe & re-runnable: only rows containing '&' are touched, and after decoding
-- they no longer contain the entity sequences, so a second pass is a no-op.
-- Decode order reverses the encode order: specific entities first, &amp; last.

DO $do$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying')
      AND column_name NOT IN ('passwordHash', 'restoreOtp')
  LOOP
    EXECUTE format(
      $q$UPDATE public.%I
         SET %I = replace(replace(replace(%I, '&#x27;', ''''), '&quot;', '"'), '&amp;', '&')
         WHERE %I LIKE '%%&%%'$q$,
      r.table_name, r.column_name, r.column_name, r.column_name
    );
  END LOOP;
END
$do$;
