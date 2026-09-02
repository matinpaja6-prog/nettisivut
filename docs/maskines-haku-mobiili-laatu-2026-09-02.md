# Maskines: haku, mobiili, laatu ja mittaus 2.9.2026

**Päivitys 3.9.2026:** tämän muistion alempi käyttöönottotilanne on historiallinen. Numerohintafunktio on nyt kannassa, rajatun RPC-hintalajittelun 42846-virhe korjattu ja tietokantasuodatus otettu paikallisesti käyttöön. Uutta SQL-ajoa ei tarvita tähän korjaukseen. Ajantasainen luovutus: [raportin korjaukset](maskines-raportin-korjaukset-2026-09-03.md).

Rajaus: ehdotuslistan kohdat 1, 3, 4 ja 5 sekä puhelimen alapalkin vaihto. Kohta 2 (maksut) jätettiin käyttäjän pyynnöstä pois. Ei Railway-julkaisua tai Git-pushia. Aiemmat muutokset säilytettiin.

## Toteutettu paikallisesti

- Vierailijan alapalkki: Etusivu → Luo ilmoitus → Kirjaudu → Suodata. Kaikkien neljän kielen tekstit säilyvät. Kirjautuneen valikkoon ei lisätty Kirjaudu-painiketta eikä yläpalkin poistettua profiilia palautettu.
- Etusivun ensimmäinen aineisto rajattiin 48:sta 24:ään. Palvelimelta tullut tulosmäärä ja hakutapa kulkevat selaimelle, jotta samaa alkulistaa ei tarvitse hakea uudelleen. Tietokantatilan suodatinmäärää ei kysytä mobiilipaneelin ollessa suljettu. Näkyvä työpöytäsuodatin saa yhä määrän.
- Kahden ensimmäisen ilmoituskuvan lataus priorisoitiin; puhelimen kaksipalstaisen kortin kuvakokovihje korjattiin vastaamaan noin puolta ruudusta. Taustakuvan vihje on sama, ettei sama kuva lataudu eri kokoisena pelkän taustasumennuksen vuoksi.
- Suodattimien oletuksen 100000 käsittely yhtenäistettiin: se tarkoittaa rajaamatonta hintaa, ei piilotettua hintakattoa. Hakutapahtuma ja tulosotsikko käyttävät kokonaismäärää, eivät pelkästään ensimmäisen sivun pituutta.
- Selaimen vanhaan tulossuodatukseen lisättiin sama nelikielinen hakusanasto kuin tietokantahakuun. Selaintesti paljasti, että esimerkiksi carburetor löytyi tietokannasta mutta suomenkielinen tulossuodatus pudotti sen pois. Korjaus ei vaadi uuden tietokantalipun käyttöönottoa.
- Sanastoon lisättiin aineistosta puuttuvia osatermejä ja kuusi yksiselitteistä kokonaisen kuvausrivin käännöstä. OEM-numeroita, mittoja ja mallinumeroita ei saa vaihtaa, pudottaa tai lisätä. Keskeisen rajoituksen katoaminen hylkää tallennetun käännöksen. Tuntematonta vapaata kuvausta ei arvata.
- Ilmoituksen toimitustapa ja ajoneuvon alalaji luetaan alkuperäisistä rakenteisista tiedoista, eivät mahdollisesti käännetystä tekstistä.
- GA4-/Ads-esimerkkitunnukset hylätään. Google latautuu vasta kyseisen suostumusluokan hyväksynnällä. Analytiikkatapahtumat vaativat oikean GA4-tunnuksen sekä analytiikkasuostumuksen, ja kohdistuvat vain kyseiseen GA4-tunnukseen. Suostumuksen peruminen päivittää myös Googlen tilan.
- Search Console hyväksyy myös palvelinpuolen vahvistusmuuttujan. Sivukartta sisältää kieliversiot erillisinä URL-merkintöinä, vastavuoroisilla kielilinkeillä ja ilman URL-kaksoiskappaleita.

## Tietokannan käyttöönotto on vielä kesken

Seitsemän aiempaa indeksiä ja hakufunktio on vahvistettu käyttäjän tuloksilla. Julkinen, anonyymi GET-testi läpäisi 14 tarkistusta 45 ilmoituksesta. Yhdistetty merkki/malli/vuosi palautti kolme sopivaa ilmoitusta. Uutta hintakenttää ei vielä löydy APIsta.

Hinta on kannassa tekstiä, joten tavallinen hintasarake järjestää esimerkiksi 100, 1100, 20. Korjaus on **supabase/maintenance/public-listing-numeric-price.sql**: laskennallinen numeerinen kenttä lajitteluun ja hintarajoihin ennen sivutusta. Se ei muuta myyjien hintoja, saraketyyppiä tai maksusummia.

1. Aja numeric-price-tiedosto kokonaisena Supabasen SQL-editorissa. Tämä tiedosto ei sisällä CONCURRENTLYä eikä vaadi erillisiä komentoja.
2. Aja `pnpm check:search`. Sen on päätyttävä PASS, ei BLOCKED. Skripti käyttää vain julkista avainta ja rajattuja GET-lukupyyntöjä.
3. Varmista kirjautuneen käyttöoikeudet erillisellä hyväksyntätilillä. Eristetty RLS-testi ei korvaa tätä.
4. Aseta vasta hyväksynnän jälkeen `NEXT_PUBLIC_MARKETPLACE_DB_FILTERS=true`, käynnistä kehityspalvelin uudelleen ja tee uusi koonti. Julkaisu erikseen käyttäjän luvalla.

Suoraa PostgreSQL-yhteyttä ei ollut käytettävissä. Uutta SQL:ää ei väitetä ajetuksi, eikä lippua kytketty keskeneräisen kannan päälle.

## Paikallinen mittaus

Mittari on kolmen paikallisen HTTP-lukupyynnön HTML sekä sen viittaamien alku-JavaScript-/CSS-tiedostojen rungot. Gzip-koot lasketaan rungosta; nämä eivät ole selaimen verkkopaneelin siirtokokoja. Kylmää mobiiliverkkoa tai CPU-hidastusta ei simuloitu.

Ennen-mittaus: HTML 327461 tavua (gzip 38921), JavaScript 1977805 tavua (gzip 575788), CSS 2019182 tavua (gzip 303010), kuvien esilatauksia 0. Viimeisimmän koonnin mittauksessa HTML 281613 tavua (gzip 34016), JavaScript 1983141 tavua (gzip 578001), CSS ennallaan ja kuvien esilatauksia 2. HTML pieneni; JavaScript kasvoi hieman ja CSS ei pienentynyt. Tarkat tiedot ovat output/performance/before.json ja after.json.

Paikallinen pieni HTML ei todista tuotannon LCP-/INP-/CLS-parannusta. Laajat CSS- ja JavaScript-paketit ovat edelleen jatko-optimoinnin kohde; legacy-tyylejä ei poistettu sokkona. Localhostin Web Vitals -diagnostiikka näkyy DOMin maskinesLocalVitals-datassa ilman Googlea, tunnisteita, verkkolähetystä tai tallennusta. Se ei tallennu tuotannon sivuille.

## Todennus ja rajat

- `pnpm test:search-quality`: eristetyt haku-, navigaatio-, käännös-, SEO-, suostumus- ja PostgreSQL-testit. Ei oikeita maksuja tai ulkoisia kirjoituksia.
- TypeScript, kohdistettu ESLint ja paikallinen Next-tuotantokoonti.
- `MASKINES_TEST_URL=http://localhost:3100 node scripts/test-local-language-pages.mjs`: neljä kieltä, canonical/hreflang, kielialias sekä kirjautumisen noindex.
- Paikallinen tuotantotesti käynnistetään `next start -H localhost -p 3100`. Next 15:n localhost-normalisointi teki `-H 127.0.0.1` -koekäynnistyksessä kieliuudelleenkirjoituksesta toisen HTTP-pyynnön ja hukutti palvelimen kieliotsakkeen. Localhost-isännällä kaikki neljä palvelinrenderöityä kieltä läpäisivät testin. Tämä ei ole näyttö Railwayn toiminnasta.
- Selaimessa tarkistettiin neljän kielen alapalkki, suodattimen avaaminen, oikeankielisen kirjautumissivun avaaminen, carburetor-haun yksi oikea osuma sekä tyhjän haun palaute. 320/390 pikselin puhelimessa ja 1280 pikselin työpöydällä ei havaittu vaakaylivuotoa; työpöydän alavalikko pysyi piilossa. Kirjautumistunnuksia ei syötetty eikä ilmoituksia muutettu.
- Lopullisen paikallisen tuotantokoosteen nelikielinen HTML-testi läpäisi. Oikea /sitemap.xml palautti 1863 yksilöllistä URL-merkintää; jokaisen kielilinkin vastavuoroisuus tarkistettiin XML-tuloksesta.
- Julkisten ilmoitusten tarkistuspaketti: 45 ilmoitusta / 135 kohdekieliversiota; 2 puuttuvaa tallennettua versiota, 121:ssä jokin tallennettu kenttä ennallaan, 24:ssä myös näytettävät otsikko ja kuvaus kokonaan ennallaan. Tämä ei tarkoita automaattisesti virhettä. Kaikki 135 odottavat ihmisen kielentarkistusta, eikä käyttäjien tekstejä kirjoitettu kantaan.

GA4-mittaustunnus, Search Consolen omistajuus/vahvistus ja myöhempi sallittu julkaisu tarvitaan oikeiden käyttäjien mittaukseen. DNS-vahvistetulle Search Console -verkkotunnukselle ei tarvita erillistä HTML-tunnistetta. Ammattimaista kielentarkistusta, pilottiosallistujia tai tuotannon nopeustuloksia ei keksitty.

Tekniset lähteet: [PostgREST computed fields](https://docs.postgrest.org/en/stable/references/api/computed_fields.html), [Next.js Image](https://nextjs.org/docs/app/api-reference/components/image), [Googlen kieliversioiden sivukarttaohje](https://developers.google.com/search/docs/specialty/international/localized-versions).
