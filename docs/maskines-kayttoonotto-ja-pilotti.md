# Maskines: käyttöönotto ja pilotti

Päivitetty 3.9.2026. Ei Railway-julkaisua. Tämä on toteutus- ja hyväksymislista, ei väite toteutuneesta pilotista, tuotannon nopeutuksesta tai ammattimaisesta kielentarkistuksesta. Uusin CSS/SEO/analytiikan todennus: [jatkoraportti](maskines-css-seo-analytiikka-2026-09-03.md).

## 1. Tietokanta

Käyttäjän 2.9.2026 toimittama tietokantatulos vahvistaa seitsemän hakuindeksin valid=true / ready=true sekä maskines_search_listings(jsonb)-funktion olemassaolon. Uusi julkinen GET-testi vahvisti 45 ilmoituksesta 14 tarkistusta: sivutus, tarkka määrä, yhdistetty merkki/malli/vuosi, neljän kielen haku, OEM, tyhjä tulos, hintaraja ja ilmoitustyypit. Kirjautuneen RLS on testattu eristetyssä PostgreSQL-moottorissa, ei oikealla käyttäjätilillä tuotannossa.

Myöhempi 3.9.2026 tarkistus vahvisti myös laskennallisen maskines_price_numeric-kentän. Tekstimuotoinen price ei enää määrää hintajärjestystä. API-projektio korjattiin ja julkinen lukutesti läpäisi 21 tarkistusta. NEXT_PUBLIC_MARKETPLACE_DB_FILTERS=true on paikallisessa .env.local-tiedostossa. Aiempi tieto puuttuvasta numerohintakentästä ja käytöstä poistetusta lipusta on vanhentunut.

Nykyisessä tietokannassa ei tarvita uutta SQL-ajoa näiden CSS/SEO/GA4-muutosten vuoksi. Jo asennettuja indeksejä tai hakufunktioita ei tarvitse ajaa uudelleen. Kirjautuneen oikean hyväksyntätilin koko käyttöpolku on vielä tarkistettava.

Alla alkuperäinen menettely uusille ympäristöille:

1. Lisää suora tai session-pooler PostgreSQL-yhteys paikalliseen MASKINES_DATABASE_URL-muuttujaan. Älä käytä transaction-pooleria (6543), NEXT_PUBLIC-muuttujaa tai lähetä salasanaa keskusteluun.
2. Aja pnpm db:search-indexes. Oletus tekee vain tarkistukset, ei DDL-muutoksia.
3. Tarkista kohdeprojekti, puuttuvat sarakkeet, pg_trgm-skeema ja jo olemassa olevien indeksien määrittely/validiteetti. Skripti pysähtyy ristiriitaan; se ei poista indeksejä.
4. Aja pnpm db:search-indexes --apply. Skripti ei lähetä BEGIN-komentoa eikä yhdistä indeksejä samaan SQL-kyselyyn. Keskeytyneen CONCURRENTLY-ajon invalid-indeksi pitää käsitellä erikseen.
5. Asenna erikseen supabase/maintenance/public-listing-advanced-search.sql ja public-listing-numeric-price.sql. Ne käyttävät SECURITY INVOKER -oikeuksia, eivät ohita RLS:ää eivätkä muuta ilmoituksia.
6. Tarkista anonyymin ja kirjautuneen haku, suodatinyhdistelmät, tarkka tulosmäärä, sivutus sekä piilotetut/myydyt/loppuneet tuotteet.
7. Uudessa ympäristössä aseta hyväksynnän jälkeen NEXT_PUBLIC_MARKETPLACE_DB_FILTERS=true ja tee uusi koonti. Paikallisessa ympäristössä arvo on jo true. Palautus: arvo false ja uusi koonti; SQL-funktioita/indeksejä ei tarvitse poistaa.

Kaikille käyttöliittymän erikoissuodattimille on tietokantapredikaatti. Vapaan tekstin haku käyttää olemassa olevaa sanasto/OEM-hakua; vanhan selaimen vapaamuotoista yhteensopivuuslaajennusta ei väitetä identtiseksi. Tarkista oikealla aineistolla erityisesti mallivariantit ja vanhat kategoriat. “Lähimpänä sinua” on yhä ladattujen osumien tekstipohjainen järjestys, ei koko kannan maantieteellinen etäisyyslaskenta.

PostgreSQL ei salli CONCURRENTLY-indeksin luontia transaktiolohkossa: [CREATE INDEX](https://www.postgresql.org/docs/15/sql-createindex.html).

## 2. Maksut: ennen hyväksyntää

Tämä osio kuvaa aiempaa tarkastusta. Käyttäjä rajasi maksut pois nykyisestä muutospyynnöstä; tässä viimeisimmässä työssä ei tehty Stripe-kutsuja, maksutestejä eikä maksulogiikan muutoksia.

Nykyisellä live-avaimella tehtiin vain lukupyyntöjä: tili sallii maksut ja tilitykset. /api/commerce/stripe/webhook-reitille ei löytynyt rekisteröityä webhookia tältä Stripe-tililtä. Paikalliset STRIPE_WEBHOOK_SECRET ja STRIPE_CONNECT_WEBHOOK_SECRET puuttuvat. Tämä ei todista, ettei toisessa julkaisuympäristössä ole asetuksia.

Käytä hyväksyntätestiin Stripe-sandboxia/testiavaimia JA erillistä testitietokantaa. Pelkkä Stripe-testiavain tuotantotietokannan kanssa ei ole eristetty testi.

Testikierros:

- Luo testimyyjä ja testituote (saldo 1). Vahvista testi-Connect-tili.
- Testaa ostoskorin 0 → 1 → 0 -kierto, kahden myyjän erilliset maksut, virheellinen määrä sekä saldon ylitys.
- Maksa Stripe-testikortilla. Varmista tilaus, saldo, kuitti, ostajan/myyjän ilmoitukset ja vain kerran kirjattu webhook.
- Lähetä sama webhook uudelleen. Saldo ja kuitti eivät saa tuplaantua.
- Testaa viivästetty maksu: unpaid, onnistuminen, epäonnistuminen ja väärässä järjestyksessä tuleva failure.
- Merkitse noutovalmiiksi ja lähetetyksi. Postitoimitus vaatii seurantakoodin; jo lähetetyn tilauksen uudelleentallennus ei lähetä samaa sähköpostia uudelleen.
- Peruuta lähettämätön testitilaus. Tarkista oikea Connect-tili, palautussumma ja idempotency-avain. Lähetettyä tilausta ei voi peruuttaa tästä toiminnosta.
- Testaa osittainen/täysi palautus ja riitautus. Direct charge ei saa käynnistää alustan siirron peruutusta.
- Kaksi ostajaa yrittää viimeistä kappaletta yhtä aikaa. Hyväksy vasta, kun varastotransaktio estää kaksinkertaisen myynnin ja jälkikäsittely on todennettu.
- Tarkista maksamattoman ja loppuunmyydyn tuotteen näkymä eri selaimessa.

Paikallinen pnpm test:marketplace kattaa eristettyinä allekirjoitukset, tilojen käsittelyn, laskennan, toimituksen, palautuspyynnön ja käyttöoikeudet. Se EI ole Stripe-sandboxin, kuljetusyhtiön, sähköpostitoimituksen tai tuotannon varastokilpailun päästä päähän -testi.

Connectin live-webhook voi sisältää testitapahtumia; siksi koodiin lisättiin livemode-eristys: [Stripe Connect webhooks](https://docs.stripe.com/connect/webhooks).

## 3. Mittaus ja Search Console

Käyttäjän toimittama GA4-mittaustunnus G-BN07FPKVXJ on lisätty paikalliseen NEXT_PUBLIC_GA_MEASUREMENT_ID-muuttujaan ja tuotantokoonti on testattu paikallisesti. Railwayn asetuksia ei muutettu eikä julkaistu. Tuotantoseuranta tarvitsee myöhemmin hyväksytyn julkaisun ja saman tunnuksen koontiympäristöön. Search Console vaatii erikseen omistajuuden vahvistamisen; GA4-tunnus ei ole Search Consolen vahvistustunnus.

Toteutus hylkää esimerkkitunnukset, lataa Google-tagin vasta oikean suostumusluokan jälkeen ja osoittaa analytiikkatapahtumat nimenomaisesti GA4:ään. Selaintestissä oikea tagi latautui hyväksynnän jälkeen. Suostumuksen perumisen ja uudelleenlatauksen jälkeen Google-tagia ei ollut. Hakutapahtuman jonotus vahvistettiin paikallisesta diagnostiikasta; Google-tilin vastaanottoa ei ole vielä vahvistettu. Search Consolen HTML-vahvistukseen kelpaa GOOGLE_SITE_VERIFICATION tai NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION. DNS-vahvistetulle verkkotunnukselle HTML-tunnistetta ei tarvita. Google-tilin asetuksia ei muutettu.

Localhostin GA4-tapahtumissa on debug_mode=true. Tarkista ne Google Analyticsin DebugView'ssä. Debug-merkintä ei yksin poista testiliikennettä raporteista: kehittäjäliikenteen suodatin on erillinen Google-tilin asetus. Kokeile suodatinta ensin testaustilassa; aktiivisesti suodatettua dataa ei voi palauttaa. Localhostin SiteVisitTracker ei lähetä sivukäyntejä tuotannon omaan Supabase-laskuriin. [DebugView](https://support.google.com/analytics/answer/7201382), [kehittäjäliikenteen suodatus](https://support.google.com/analytics/answer/13296662).

Koodissa: consent-gate, web_vital (metric_id/name/value/delta/rating/navigation_type/language), haku, ilmoituskatselu, yhteydenotto, julkaisu, ostoskori, begin_checkout ja palvelimen paid-tilasta lähetettävä purchase. Oston transaction_id estää uudelleenlatauksen kaksoiskirjauksen. Ei sähköpostia, osoitetta, puhelinta tai Stripe-session salaisuutta tapahtumiin. Yksityisten reittien tunnisteet ja URL-kyselyparametrit poistetaan.

1. Varmista selaimen verkosta: ennen suostumusta ei Google-tagia; kieltäytymisen jälkeen ei analytiikkatapahtumia. Hyväksymisen jälkeen DebugView näyttää tapahtumat.
2. Rekisteröi tarvittavat GA4:n mukautetut määritteet/mitat (metric_name/value/id, language). Analysoi laiteluokat erikseen. [GA4 event parameters](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters).
3. Vie saman ajanjakson GA4 BigQuery -tapahtumat JSON-muodossa: event_name, event_timestamp, user_pseudo_id, event_params ja device.category. Säilytä vienti yksityisesti; älä lisää raakaa käyttäjädataa Gitiin.
4. Aja node scripts/report-measurements.mjs vienti.json. Raportti poistaa saman vitals-mittarin vanhat päivitykset, laskee p75:n ja purchase-sessioiden osuuden page_view-sessioista. Samalla transaktiolla ei lasketa useita ostoja.
5. Alle 100 havaintoa ryhmässä merkitään riittämättömäksi (oma raportointiraja, ei Googlen sääntö). INP:n puuttuminen ei tarkoita arvoa 0. Suostumuksen antaneet eivät edusta automaattisesti kaikkia käyttäjiä.
6. Kerää vertailukelpoiset ennen/jälkeen-jaksot samalla laite-, kieli- ja liikennelähdejaolla. Älä päättele tuotannon nopeutusprosenttia koontiajasta tai yhdestä Lighthouse-ajosta.

CWV-tavoitteet p75: LCP ≤ 2500 ms, INP ≤ 200 ms, CLS ≤ 0,1: [Web Vitals](https://web.dev/articles/vitals).
Oston mittauksen value, shipping, tax ja transaction_id: [GA4 ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce).

Search Console -kierros julkaisemisen jälkeen: vahvista omistajuus, lähetä /sitemap.xml, tarkista neljän kielen esimerkkisivut URL Inspectionilla, tarkista canonical/hreflang ja yksityisten sivujen noindex. Viikoittain vertaile indeksoituja sivuja, poissulkemisen syitä, näyttökertoja, klikkauksia ja kielikohtaisia hakusivuja. Ei vielä kerättyä Search Console -raporttia.

## 4. Pilotti: 10 myyjää / 20 ostajaa

Tila: **0 rekrytoitua, 0 suoritettua testikertaa**. Alla on valmis toteutussuunnitelma, ei keksittyjä osallistujia. Yhteydenottoja ei lähetetty. Tarvitaan vastuuhenkilö, suostuneet osallistujat, ajankohdat ja mahdollisen palkkion budjetti.

Jaa myyjät: 6 yksityistä + 4 yritystä; kohteiksi osat, ajoneuvot ja ajovarusteet. Jaa ostajat: 10 suomeksi, 5 englanniksi, 3 ruotsiksi ja 2 norjaksi. Mukaan ensimmäistä kertaa asioivia ja harrastajia. Vähintään 12 ostajatestiä oikealla puhelimella.

Kutsuluonnos (lähetetään vain sovituille vastaanottajille):

> Hei! Etsimme Maskinesin käytettävyystestiin varaosien/ajoneuvojen ostajia ja myyjiä. Testi kestää noin 20 minuuttia. Emme pyydä oikeaa maksua tai salasanoja. Osallistuminen on vapaaehtoista, ja voit lopettaa milloin tahansa. Haluaisitko osallistua? Mahdollisesta tallenteesta pyydetään erillinen lupa.

Myyjän tehtävät: luo ilmoitus oikeilla kuvilla, lisää OEM/malli/vuosimalli/kunto, tarkista esikatselu eri kielillä, muuta hintaa ja merkitse myydyksi. Yritys testaa toimitushinnat ja testimaksun vain testiympäristössä.

Ostajan tehtävät: etsi määrätty osa suomeksi ja omalla kielellä, rajaa merkki/malli/vuosi, tarkista yhteensopivuus alkuperäisestä sisällöstä, kysy myyjältä, lisää/poista ostoskoriin, käy testimaksupolku ja löydä tilaus/palautusohje.

Kirjaa jokaisesta tehtävästä osallistujatunnus (S01–S10/B01–B20), rooli, kieli, laite, alku/loppuaika, onnistui ilman apua kyllä/ei, virheen vaihe ja sanallinen palaute. Säilytä nimet ja yhteystiedot erillään testihavainnoista, ei repositoriossa.

Ennalta sovittavat hyväksymisrajat: vähintään 8/10 myyjää julkaisee ilman apua, 16/20 ostajaa löytää soveltuvan osan, 0 kriittistä maksu-/yksityisyys-/yhteensopivuusvirhettä. Nämä ovat pilotin tavoitteita, eivät mitattuja tuloksia. Kirjaa myös epäonnistumiset; älä vaihda mittaria jälkikäteen.

Ilmoituslaadun portti (tavoite 30 oikeaa ilmoitusta vähintään 10 eri myyjältä): otsikko merkki + malli + osa, osanumero kun saatavilla, sopivuuden varmuus ja rajaus, vuosimalli, todellinen kunto/viat, kokonaishinta ja toimituskulut, selkeä sijainti, 3 omaa terävää kuvaa mukaan lukien tunniste ja mahdollinen vaurio. Kuvia/ilmoituksia ei kopioida muiden sivustoilta eikä tekaista myyjiä.

## 5. Käännösten tarkistuspaketti

Ajo: node scripts/audit-listing-translations.mjs --packet. Lukee vain julkisia myymättömiä ilmoituksia (oletuskatto 500), ei käytä maksullista käännös-APIa eikä kirjoita tietokantaan.

2.9.2026 auditointi: 45 ilmoitusta / 135 kohdekieliversiota. 2 kieliversiossa puuttuu tekstiä ja 121:ssä jokin teksti on sama kuin alkuperäinen. Sama nimi/OEM ei itsessään ole käännösvirhe. Teknisen numerotarkistuksen hylkäyksiä 0; tämä EI todista kielellistä tai semanttista oikeellisuutta.

Paketti sisältää alkuperäisen sisällön, lähteen SHA-256-tunnisteen, jokaisen kohdekielen ehdotuksen, tarkistusliput sekä tyhjät reviewer/decision/notes-kentät. Kaikki 135 ovat pending. Asiantunteva kielentarkistaja tarkistaa merkityksen, kunnon, yhteensopivuuden, numeroiden/mittojen ja toimitusehtojen säilymisen. Käyttäjän muuttaessa alkuperäistä on tarkistettava uudelleen. Hyväksymättömiä käännöksiä ei nimetä ammattilaisen hyväksymiksi.

Viimeisin paketti 2.9.2026 sisältää myös käyttöliittymässä näytettävät tekstit (renderedTitle/renderedDescription). Sanastoa laajennettiin aineiston perusteella. 24/135 kieliversiossa sekä otsikko että kuvaus jäävät samoiksi kuin alkuperäinen; tämä ei yksin todista virhettä, koska erisnimiä ja OEM-koodeja ei pidä kääntää. Kaikki 135 odottavat edelleen ihmisen hyväksyntää. Rajoituksia kuten testaamaton, ei kuulu hintaan, ei sovi, vain nouto ja viallinen suojataan konservatiivisesti. Suoja ei ole täydellinen semanttinen tarkistin.

Numerosuoja on tiukennettu: 32 ei enää kelpaa 320:n osajonoksi ja toistuvia numeroita ei voi pudottaa. Käännöksen puuttuessa tai tarkistuksen epäonnistuessa alkuperäinen säilyy.
