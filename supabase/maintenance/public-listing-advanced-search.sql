-- Opt-in database search. Apply separately after review; no production execution implied.
-- SECURITY INVOKER keeps listings/profiles/products RLS and caller privileges intact.
CREATE OR REPLACE FUNCTION public.maskines_search_norm(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
  SELECT trim(regexp_replace(lower(regexp_replace(normalize(coalesce(value,''), NFD), U&'[\0300-\036f]', '', 'g')), '[^a-z0-9]+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.maskines_search_description(description text, label text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, public AS $$
  SELECT coalesce((SELECT trim(substr(line,position(':' IN line)+1))
    FROM regexp_split_to_table(coalesce(description,''), E'\n') AS line
    WHERE public.maskines_search_norm(split_part(line,':',1)) = public.maskines_search_norm(label)
    LIMIT 1),'')
$$;

CREATE OR REPLACE FUNCTION public.maskines_search_category(category text, subcategory text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
 SELECT CASE
 WHEN category='Moottori & voimansiirto' THEN CASE WHEN subcategory IN ('Kokonainen voimansiirto','Variaattorin hihnat','Ketjukotelot','Ketjut & hihnat') OR subcategory LIKE 'Kytkimet /%' OR subcategory LIKE 'Variaattorit /%' THEN 'Voimansiirto' ELSE 'Moottori' END
 WHEN category='Alusta & telasto' THEN CASE WHEN subcategory LIKE 'Renkaat & vanteet /%' THEN 'Renkaat & vanteet' WHEN subcategory IN ('Kokonainen telasto','Telamatot') OR subcategory LIKE 'Telasto /%' THEN 'Telasarjat' ELSE 'Jousitus & ohjaus' END
 WHEN category='Ohjaus & hallintalaitteet' THEN CASE WHEN subcategory LIKE 'Jarrut /%' THEN 'Jarrut' ELSE 'Jousitus & ohjaus' END
 WHEN category='Sähköjärjestelmät' THEN 'Sähköjärjestelmä'
 WHEN category='Moottori' AND (subcategory LIKE 'Vaihteisto /%' OR subcategory LIKE 'Kytkin /%') THEN 'Voimansiirto'
 WHEN category='Moottori' AND subcategory LIKE 'Imu- & polttoaineosat /%' THEN 'Polttoainejärjestelmä'
 WHEN category='Moottori' AND subcategory LIKE 'Jäähdytysjärjestelmä /%' THEN 'Jäähdytysjärjestelmä'
 WHEN category='Moottori' AND subcategory LIKE 'Pakoputkisto /%' THEN 'Pakoputkisto'
 WHEN category='Jäähdytys & polttoaine' THEN CASE WHEN subcategory IN ('Kokonainen jäähdytysjärjestelmä','Jäähdyttimet','Vesipumput','Letkut') THEN 'Jäähdytysjärjestelmä' ELSE 'Polttoainejärjestelmä' END
 WHEN category='Runko & katteet' THEN 'Runko & koriosat'
 ELSE category END
$$;

CREATE OR REPLACE FUNCTION public.maskines_search_test(doc jsonb, predicate jsonb, depth integer DEFAULT 0)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, public AS $$
DECLARE p jsonb; hay text; needle text; raw_value text; operation text; values_array jsonb;
BEGIN
 IF depth > 8 OR jsonb_typeof(predicate) <> 'object' THEN RETURN false; END IF;
 IF predicate ? 'all' THEN
   IF jsonb_typeof(predicate->'all') <> 'array' THEN RETURN false; END IF;
   FOR p IN SELECT value FROM jsonb_array_elements(predicate->'all') LOOP
     IF NOT public.maskines_search_test(doc,p,depth+1) THEN RETURN false; END IF;
   END LOOP; RETURN true;
 ELSIF predicate ? 'any' THEN
   IF jsonb_typeof(predicate->'any') <> 'array' THEN RETURN false; END IF;
   FOR p IN SELECT value FROM jsonb_array_elements(predicate->'any') LOOP
     IF public.maskines_search_test(doc,p,depth+1) THEN RETURN true; END IF;
   END LOOP; RETURN false;
 ELSIF predicate ? 'not' THEN RETURN NOT public.maskines_search_test(doc,predicate->'not',depth+1);
 END IF;
 IF NOT doc ? (predicate->>'field') THEN RETURN false; END IF;
 raw_value := doc->>(predicate->>'field');
 hay := public.maskines_search_norm(raw_value);
 needle := public.maskines_search_norm(predicate->>'value');
 operation := predicate->>'op';
 IF operation = 'equal' THEN RETURN hay=needle;
 ELSIF operation = 'compact' THEN RETURN position(replace(needle,' ','') IN replace(hay,' ',''))>0;
 ELSIF operation = 'words' THEN
   RETURN NOT EXISTS (SELECT 1 FROM regexp_split_to_table(needle,' +') word WHERE position(word IN hay)=0);
 ELSIF operation IN ('min','max') THEN
   IF coalesce(raw_value,'') !~ '^[0-9]+([.][0-9]+)?$' OR coalesce(predicate->>'value','') !~ '^[0-9]+([.][0-9]+)?$' THEN RETURN false; END IF;
   RETURN CASE WHEN operation='min' THEN raw_value::numeric >= (predicate->>'value')::numeric ELSE raw_value::numeric <= (predicate->>'value')::numeric END;
 ELSIF operation IN ('any_token','all_tokens','location') THEN
   values_array := predicate->'value';
   IF jsonb_typeof(values_array) <> 'array' THEN RETURN false; END IF;
   IF operation='location' THEN
     RETURN EXISTS (SELECT 1 FROM jsonb_array_elements_text(values_array) term WHERE position(' '||public.maskines_search_norm(term)||' ' IN ' '||hay||' ')>0);
   END IF;
   IF operation='all_tokens' THEN
     RETURN NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(values_array) term WHERE NOT EXISTS (
       SELECT 1 FROM regexp_split_to_table(coalesce(raw_value,''),',') token WHERE public.maskines_search_norm(token)=public.maskines_search_norm(term)));
   END IF;
   RETURN EXISTS (SELECT 1 FROM jsonb_array_elements_text(values_array) term JOIN regexp_split_to_table(coalesce(raw_value,''),',') token ON public.maskines_search_norm(token)=public.maskines_search_norm(term));
 END IF;
 RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.maskines_search_document(row_data jsonb, seller jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog, public AS $$
DECLARE d text := coalesce(row_data->>'description',''); meta jsonb := coalesce(row_data#>'{translations,_meta}','{}');
  search text; model_search text; gear_search text; vehicle text; kind text; cc numeric; company boolean;
BEGIN
 search := concat_ws(' ',row_data->>'title',d,row_data->>'brand',row_data->>'model',row_data->>'part_model',row_data->>'engine_cc',row_data->>'engine_model',row_data->>'part_number',row_data->>'category',row_data->>'subcategory',row_data->>'location');
 model_search := concat_ws(' ',row_data->>'brand',row_data->>'model',row_data->>'part_model',row_data->>'title',d);
 gear_search := concat_ws(' ',row_data->>'category',row_data->>'subcategory',meta->>'riding_gear_size',meta->>'riding_gear_target',model_search);
 vehicle := public.maskines_search_norm(row_data->>'vehicle_type');
 vehicle := CASE vehicle WHEN 'mopot' THEN 'mopo' WHEN 'moottorikelkat' THEN 'moottorikelkka' WHEN 'monkijat' THEN 'monkija' WHEN 'moottoripyorat' THEN 'moottoripyora' ELSE vehicle END;
 IF vehicle NOT IN ('mopo','moottorikelkka','monkija','motocross','moottoripyora') THEN
   cc := nullif(regexp_replace(coalesce(row_data->>'engine_cc',''),'[^0-9]','','g'),'')::numeric;
   vehicle := CASE
     WHEN public.maskines_search_norm(search) ~ '(moottorikelkka|kelkka|snowmobile)' THEN 'moottorikelkka'
     WHEN public.maskines_search_norm(search) ~ '(monkija|atv|outlander|sportsman)' THEN 'monkija'
     WHEN public.maskines_search_norm(search) ~ '(motocross|yz|crf|sx)' THEN 'motocross'
     WHEN public.maskines_search_norm(search) ~ '(mopo|moped|bws)' OR (cc>0 AND cc<=50) THEN 'mopo'
     ELSE vehicle END;
 END IF;
 kind := CASE WHEN meta->>'marketplace_kind'='vehicle' OR lower(trim(row_data->>'category')) IN ('ajoneuvo','ajoneuvot','kokonainen ajoneuvo') THEN 'vehicles'
   WHEN public.maskines_search_norm(row_data->>'category') LIKE '%ajovaruste%' THEN 'gear' ELSE 'parts' END;
 company := coalesce(seller->>'account_type'='company',false) OR coalesce(trim(row_data->>'company_name'),'')<>'';
 RETURN row_data || jsonb_build_object(
   'kind',kind,'vehicle_type',vehicle,'search',search,'model_search',model_search,'gear_search',gear_search,
   'category',public.maskines_search_category(row_data->>'category',row_data->>'subcategory'),
   'subcategory',trim(regexp_replace(coalesce(row_data->>'subcategory',''),'^.*/','')),
   'year',substring(row_data->>'year' FROM '(?:19|20)[0-9]{2}'),
   'vehicle_subtype',concat_ws(' ',row_data->>'vehicle_subtype',meta->>'vehicle_subtype',public.maskines_search_description(d,'Ajoneuvotyyppi'),search),
   'mileage',nullif(regexp_replace(public.maskines_search_description(d,'Ajokilometrit'),'[^0-9]','','g'),''),
   'hours',nullif(regexp_replace(public.maskines_search_description(d,'Käyttötunnit'),'[^0-9]','','g'),''),
   'registration',public.maskines_search_description(d,'Rekisteritunnus'),
   'engine_kind',public.maskines_search_description(d,'Moottorin tyyppi'),
   'drive_type',public.maskines_search_description(d,'Vetotapa'),
   'road_legal',public.maskines_search_description(d,'Tieliikennekelpoisuus'),
   'accessories',public.maskines_search_description(d,'Lisävarusteet'),
   'colors',public.maskines_search_description(d,'Ajoneuvon väri'),
   'vat_deductible',coalesce(meta->>'vat_deductible','false'),'tax_free',coalesce(meta->>'tax_free','false'),
   'seller_type',CASE WHEN company THEN 'company' ELSE 'private' END,
   'verified_company',company AND coalesce(seller->>'company_verified_at','')<>'');
END $$;

CREATE OR REPLACE FUNCTION public.maskines_search_listings(search_filter jsonb)
RETURNS SETOF public.listings LANGUAGE sql STABLE SECURITY INVOKER AS $$
 -- A single SQL SELECT (without SET clauses) permits PostgREST filters,
 -- ordering and LIMIT to be pushed into the query instead of materializing
 -- the full catalog in a PL/pgSQL set-returning function.
 SELECT l.* FROM public.listings l
 LEFT JOIN public.profiles p ON p.id=l.seller_id
 WHERE l.is_sold=false AND l.is_hidden=false
 AND search_filter IS NOT NULL AND octet_length(search_filter::text)<=100000 AND jsonb_typeof(search_filter)='object'
 AND NOT EXISTS (SELECT 1 FROM public.products product WHERE product.id::text=l.translations#>>'{_meta,commerce_product_id}' AND (product.active=false OR product.stock_quantity<=0))
 AND public.maskines_search_test(public.maskines_search_document(to_jsonb(l),jsonb_build_object('account_type',p.account_type,'company_verified_at',p.company_verified_at)),search_filter)
$$;
REVOKE ALL ON FUNCTION public.maskines_search_listings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maskines_search_listings(jsonb) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
