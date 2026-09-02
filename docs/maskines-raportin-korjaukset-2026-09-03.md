# Raportin korjaukset 2.–3.9.2026

Lähde: output/pdf/Maskines_sivustoarvio_2026-09-02.pdf. Tämä muistio koskee paikallisia koodikorjauksia, ei julkaisua. Railwayhin ei julkaistu eikä maksuja tehty tai muutettu. Myyjien ilmoituksia ei kirjoitettu tietokantaan.

Jatko 3.9.2026: reittikohtainen CSS-erottelu, kokoelmasivujen SEO ja käyttäjän GA4-tunnuksen paikallinen asennus on toteutettu ja testattu. Alla oleva alkuperäinen avoimien kohtien lista kuvaa edellisen kierroksen tilannetta. Ajantasainen todennus ja jäljellä olevat ulkoiset tehtävät ovat [CSS/SEO/analytiikan jatkoraportissa](maskines-css-seo-analytiikka-2026-09-03.md).

## Korjatut asiat

- PostgREST-hakufunktion numerohinnan lajittelu: laskennallinen maskines_price_numeric lisätään nimenomaisesti rajattuun sarakevalintaan silloin, kun RPC järjestetään sen mukaan. Tämä korjaa virheen 42846 ilman select=* -ylilatausta tai uutta SQL-ajoa.
- Julkinen tietokantatesti läpäisee 21 tarkistusta. Mukana ovat molemmat hintajärjestykset, 24 ilmoituksen sivujen yhdistäminen, kokonaismäärä, yhdistelmäsuodatus, neljän kielen hakualias, OEM, tyhjä tulos ja julkiset näkyvyysrajaukset.
- NEXT_PUBLIC_MARKETPLACE_DB_FILTERS=true on asetettu vain paikalliseen .env.local-tiedostoon. Suodattimen kokonaismäärä tulee kannasta eikä ladatusta osasta. Selaimessa varaosapaneeli näyttää 42 eikä 21; kaikki ilmoitukset 45. Hinnat alkavat 20, 50, 60 ja 70 eurosta. Tietokannan valmiiksi järjestämää sivua ei lajitella uudelleen JavaScriptin tekstihintojen vähennyslaskulla.
- Hakutuloksissa on yksittäin poistettavat rajaukset ja tyhjennystoiminto. Merkin poisto tyhjentää myös siitä riippuvan mallin/tallirajauksen; hinnan poisto palauttaa rajaamattoman oletuksen. Sijainti näytetään luettavana eikä JSON-merkkijonona. Yleinen hintarajaus on työpöydän paneelin yläosassa.
- Raportin ehdottama erillinen Kunto–Toimitus–OEM-yhteenveto ja Kysy myyjältä -painike poistettiin käyttäjän myöhemmästä nimenomaisesta pyynnöstä. Alkuperäiset Perustiedot ja myyjän yhteystietolohko säilyvät.
- Ilmoituslomakkeessa on neljän kielen otsikkomalli, pääkuvaohje sekä muistutus testauksesta, sopivuudesta, kaupan sisällöstä ja toimituskuluista. Myyjän väitteitä tai vanhoja ilmoituksia ei muutettu.
- Mobiilikorttien tietotekstit nostettiin 12 pikseliin. Uudet rajauspainikkeet ovat vähintään 44 pikseliä korkeita. Tämä ei ole WCAG-sertifiointi.
- Vierailijan ja kirjautuneen yläpalkin Luo ilmoitus käyttää samaa komponenttia, pluskuvaketta ja tyylejä. Ilmoittamisen kirjautumissuoja säilyy.
- Keskustelun raskas käyttöliittymä ja arvostelulomake erotettiin aloituspaketista. Keskustelu latautuu kirjautuneelle tai vierailijan ensimmäisestä avauksesta; arvostelulomake vain kirjautuneelle. Suojauksia, oikeuksia tai palvelimen tarkistuksia ei korvata tällä latausoptimoinnilla.

## Todennus

- Next-tuotantokoonti, TypeScript ja kohdistettu ESLint.
- scripts/test-report-fixes.mjs: rajattu hintaprojektio, suodatinpoistojen riippuvuudet, sijainnin esitysmuoto, yhtenäinen myyntipainike, viivästettyjen tilitoimintojen vierailija/kirjautuminen/uloskirjautuminen ja myöhäisen istuntovastauksen kilpailutilanne.
- scripts/test-database-search.mjs: 46 erikoissuodatuskoetta, tekstiä sisältävä hintasarake, anonyymin ja kirjautuneen roolin RLS eristetyssä PostgreSQL:ssä, piilotetut/myydyt/loppuneet ilmoitukset, sivutus ja indeksit. Tämä ei ole oikean tuotantotilin koko käyttöpolun testi.
- scripts/test-public-database-search.mjs --remote-read-only: oikea julkinen API, vain anonyymit rajatut GET-lukupyynnöt, ei palveluavainta eikä kirjoituksia.
- Nelikielinen paikallinen HTML-, canonical-, hreflang- ja kirjautumisen noindex-testi.
- CSS:n alkuperäiset 27 legacy-kerrosta ja niiden järjestys säilyvät; verify-legacy-css.mjs tarkistaa tämän.
- Selaimessa: hintahaku, oikea 42 varaosan paneelimäärä, carburetor-haun yksi osuma ja sen poisto takaisin 45 tulokseen, myyntipainike sekä 320 pikselin etusivu ilman vaakaylivuotoa. Enintään 100 euron hintarajaus näyttää 11 tulosta sekä paneelissa että hakutuloksissa.

## Edellisen kierroksen avoimet asiat – historiallinen tilanne

Viimeinen koontimittaus on output/performance/report-fixes-delivered.json. Vertailu raportin after.json-tiedostoon: HTML 281613 → 243357 tavua (laskennallinen gzip 34016 → 27775), alku-JavaScript 1983141 → 1929373 tavua (gzip 578001 → 566910), ulkoinen CSS 2019182 → 2020386 tavua (gzip 303010 → 303331). HTML ja alku-JavaScript pienenivät; ulkoinen CSS kasvoi hieman uusien käyttöliittymätyylien myötä. Nämä ovat paikallisia tiedostokokoja, eivät tuotannon nopeutusprosentteja tai mobiiliverkon/CWV:n mittaustuloksia.

1. Ulkoinen CSS on edelleen suuri. Tässä erotettiin myöhemmin tarvittavaa JavaScriptiä ja sen mukana tulevia keskustelutyylejä; koko legacy-CSS:n reittikohtainen jakaminen sekä hitaalla mobiiliverkolla tehtävä profilointi ovat jatkotyötä. Pelkkä tiedostojen pilkkominen ei tarkoita pienempää siirtokuormaa.
2. GA4-tunnus ja Google-tilin/Search Consolen vahvistus eivät ole käytettävissä. Suostumus- ja tapahtumakoodi on testattu eristetysti, ei tuotannon Google-tililtä. Tuotannon CWV:tä tai konversiota ei väitetä mitatuksi.
3. Ohuet/päällekkäiset SEO-kokoelmat vaativat sisältökohtaisen tarkistuksen. Sivukartan URL-määrä ei kuvaa ilmoitusten määrää; kokoelmia ei poistettu automaattisesti mielivaltaisella rajalla.
4. Oikeat käyttäjäpilotit, parempi tarjonta, myyjien puuttuvat tuotetiedot ja ammattilaisen kielentarkistus edellyttävät ihmisiä. Ohjeistus on lisätty, mutta sisältöä tai hyväksyntöjä ei keksitty.
5. Kirjautuneen oikean käyttäjän koko ostaja-/myyjäpolku on vielä tarkistettava hyväksyntätilillä. Maksut/Stripe eivät kuulu tähän korjauskierrokseen.

## Julkaisu myöhemmin

Uutta SQL:ää ei tarvita tämän 42846-korjauksen vuoksi: aiemmin asennettu numerohintafunktio toimii. Tulevassa julkaisuympäristössä on varmistettava samat SQL-funktiot ja asetettava NEXT_PUBLIC_MARKETPLACE_DB_FILTERS=true **ennen koontia**. Tässä ei muutettu Railwayn asetuksia eikä tehty julkaisua.

Tekniset viitteet: [PostgREST computed fields](https://docs.postgrest.org/en/stable/references/api/computed_fields.html), [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading).
