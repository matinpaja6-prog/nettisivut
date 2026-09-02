# Maskines: CSS, SEO ja analytiikka 3.9.2026

Paikalliset muutokset ja todennus. Ei Railway-julkaisua, Railway-asetuksia, uusia SQL-ajoja, maksuja tai myyjien ilmoitusten muokkaamista. Käyttäjän GA4-tunnus lisättiin vain paikalliseen ympäristöön. Aiemmat käyttöliittymätoiveet säilyvät: ei etusivun ylimääräistä esittelytekstiä tai ilmoituksen Kunto–Toimitus–OEM-yhteenvetolaatikkoa; vierailijan mobiilinavigaatio on Etusivu / Luo ilmoitus / Kirjaudu / Suodata.

## 1. CSS: pienempi aloituskuorma

Profiilin, julkisen myyjän, kirjautumisen, ilmoituslomakkeen ja tallin tiukasti reittijuureen sidotut säännöt erotettiin viideksi ominaisuuspaketiksi. Vain kyseiset komponentit tuovat ne käyttöön. Komponenttitason tuonti kattaa myös lokalisoidut aliasosoitteet. Etusivu ei enää tuo näitä kaikkia tyylejä alussa.

Alkuperäiset 27 legacy-lähdetiedostoa ja themes.css säilyvät. PostCSS-pohjainen generaattori säilyttää jokaisen säännön/deklaraation kerran, järjestyksen kunkin paketin sisällä sekä mediaehdot ja spesifisyyden. Pakettien erottaminen voi muuttaa niiden keskinäistä järjestystä; tämän vuoksi visuaaliset testit ovat edelleen tarpeen. Epäselvät ja globaalit säännöt jäivät yhteiseen pakettiin. Uusi kokoelmanäkymä käyttää omaa pientä CSS-moduulia.

Muokkausohje: app/styles/README.md. Generointi: npm run css:build; predev/prebuild tekevät saman. Generoitua CSS:ää ei muokata käsin. Yhteinen CSS on edelleen suuri: tämä on toimiva viiden alueen erottelu, ei kaikkien legacy-tyylien täydellinen uudelleenkirjoitus.

## 2. Paikallisen tuotantokoonnin kokomittaus

Vertailu edellisen korjauskierroksen report-fixes-delivered.json-tiedostoon. Luvut ovat tavuja, gzip on laskettu vastauksen sisällöstä. Ei verkkokuristusta eikä oikeiden käyttäjien CWV-mittausta.

| Etusivun resurssi | Ennen | Nyt | Gzip ennen → nyt |
| --- | ---: | ---: | ---: |
| HTML | 243 357 | 240 923 | 27 775 → 27 344 |
| Alun JavaScript | 1 929 373 | 1 909 004 | 566 910 → 562 380 |
| Ulkoinen CSS | 2 020 386 | 1 505 058 | 303 331 → 221 111 |

CSS-tavujen vähennys on noin 25,5 %, gzip-vertailussa noin 27,1 %. Tämä EI tarkoita sivuston olevan 25,5 % nopeampi. Etusivun koko HTML-vastauksen kolme paikallista aikaa olivat 775 / 551 / 525 ms; ne eivät ole TTFB, LCP tai INP.

Uusi /varaosat/lynx-kokoelmasivu: HTML 174 282 tavua, JavaScript 1 557 201 tavua, CSS 1 120 512 tavua (gzip 22 273 / 460 531 / 163 972). Kokoelmasivu ei enää lataa HomeClientin raskasta suodatuskäyttöliittymää. Hakurajaus siirtää varsinaiseen hakuun säilyttäen hakusanan ja osaston.

Raakatulokset: output/performance/css-seo-final-home.json ja css-seo-final-collection.json. Mittaus ei sisällä kaikkea myöhemmin ladattavaa JavaScriptiä, kuvia tai Google-tagia.

## 3. SEO: sisältö, osumat ja indeksointi

- Neljän kielen kokoelmasivut käyttävät yhtä palvelinrenderöityä toteutusta. Näkyvä otsikko, tulosmäärä, murupolku, ilmoituskortit ja JSON-LD ItemList kuvaavat samaa sisältöä.
- Sanan moottori haku ei enää osu pelkästään sanan moottorikelkka osaan. Auditoinnissa moottori-kokoelman määrä muuttui 42:sta 9:ään. Kyseessä voivat olla myös moottoriin liittyvät osat, ei väite yhdeksästä kokonaisesta moottorista.
- Automaattilaskeutumissivuille otettiin toimituksellinen kolmen ilmoituksen vähimmäisraja. Se EI ole Googlen sääntö. Yhden tai kahden ilmoituksen kokoelma pysyy käyttäjälle toimivana, mutta saa noindex/follow-asetuksen ja jää sivukartasta pois. Yksittäisiä julkisia ilmoituksia ei tämän vuoksi poisteta indeksistä.
- Täsmälleen saman ilmoitusjoukon kokoelmille valitaan vakaa ensisijainen osoite. Päällekkäinen sivu osoittaa siihen canonicalilla; sitä ei samalla merkitä ristiriitaisesti noindexiksi. Käännösten slug-törmäyksillä on yksi omistaja; sivukartta ja hreflang noudattavat samaa sääntöä.
- Olemattomat kokoelmaosoitteet palauttavat oikean HTTP 404:n ja noindexin kaikilla neljällä kielellä. Tarkistus tehdään ennen juuritason latausnäkymän streamausta; globaalin metadatan streamausta ei poistettu käytöstä. Vanhat tunnistetut litteät aliaspolut ohjataan pysyvästi omaan hierarkkiseen polkuunsa.

Julkinen, vain lukeva auditointi: 45 ilmoitusta, 404 suomenkielistä ehdokaskokoelmaa: 40 indeksoitavaa ensisijaista, 336 pienen tarjonnan sivua ja 28 päällekkäistä riittävän tarjonnan sivua. Tämä ei tarkoita 404 virhesivua. Lopullisen paikallisen sivukartan testissä 438 yksilöllistä URL-osoitetta, mukaan lukien kielet, ilmoitukset, profiilit ja infosivut. Tulokset kuvaavat tarkistushetken aineistoa.

Kokoelmien tarkistus odottaa julkisen aineiston ennen ensimmäistä vastausta; sivu ja metadata jakavat saman pyyntökohtaisen React.cache-luvun. Aineiston kasvaessa kokoelmalaskennan skaalaus ja palvelinvälimuisti on arvioitava erikseen.

## 4. GA4: paikallinen asennus ja suostumustesti

NEXT_PUBLIC_GA_MEASUREMENT_ID=G-BN07FPKVXJ on paikallisessa .env.local-tiedostossa. Tämä on julkinen mittaustunnus, ei API-salaisuus.

Jatkokorjaus 3.9.2026, kun käyttäjän DebugView jäi tyhjäksi: gtag-jonottaja käytti rest-parametrien Array-taulukkoa. Googlen gtag.js käsittelee komentorajapintana Arguments-oliot, kun taas taulukot ovat dataLayer-metodikutsuja. Jonottaja muutettiin Googlen dokumentoimaan dataLayer.push(arguments)-muotoon. Uusi regressiotesti epäonnistui ennen korjausta ja läpäisi korjauksen jälkeen; myös suostumustestit, TypeScript ja kohdistettu ESLint läpäisivät. Aiempi lataus/jonotustesti ei tunnistanut tätä muotovirhettä. Jo auki oleva sivu tarvitsee täyden uudelleenlatauksen, koska HMR voi säilyttää vanhan window.gtag-funktion. Google-tilin vastaanotto on silti vahvistettava DebugView'stä. [Googlen gtag-asennusohje](https://developers.google.com/tag-platform/gtagjs).

Selaimessa localhost:3000:

1. Vain välttämättömät: gaConfigured=true, analyticsConsent=false, Google-skriptejä 0.
2. Kaikki evästeet: oikean G-BN07FPKVXJ-tagin skripti latautui (load-tapahtuma). Paikalliset tapahtumat saavat debug_mode=true.
3. Kokoelmasivun mobiilisuodatin avasi haun /?q=lynx&market=parts, paneelin määrä 18 ja hakusana lynx säilyivät. Paikallinen diagnostiikka vahvisti search-tapahtuman jonotuksen.
4. Suostumus palautettiin alkuperäiseen Vain välttämättömät -tilaan. Uudelleenlatauksen jälkeen Google-skriptejä jälleen 0.

Skriptin latautuminen ja tapahtumajono eivät yksin todista Googlen vastaanottoa. Jatkotarkistuksessa erillinen puhdas Chrome lähetti sivustolta `page_view`-, `web_vital`- ja `maskines_debug_check`-tapahtumia tunnukselle G-BN07FPKVXJ. Googlen region1.google-analytics.com/g/collect vastasi HTTP 204. Payloadissa oli debug_mode=true ja myönnetty analytiikkasuostumus. Chrome raportoi osalle beacon-pyynnöistä myös ERR_ABORTED, joten pelkästä verkkovastauksesta ei päätelty tilin käsittelyä. Käyttäjän tämän jälkeen toimittama DebugView-kuva vahvisti **kolmen web_vital-tapahtuman vastaanoton**. Sivunäyttöjä, hakutapahtumia ja nimettyä testitapahtumaa ei näkynyt kyseisessä kuvassa; kaikkien tapahtumien päästä päähän -hyväksyntää ei väitetä tehdyksi.

Tarkistusskripti: scripts/check-local-ga-delivery.mjs. Oletuksena Google-keruupyynnöt siepataan paikallisesti: tällainen ajo ei todista oikeaa toimitusta. Vain --allow-google sallii aidot testitapahtumat. Skripti käyttää väliaikaista kirjautumatonta Chrome-profiilia ja estää sovelluksen/tietokannan kirjoituspyynnöt. Se tulostaa vain rajatut tunnus-, tapahtuma-, debug-, suostumus- ja HTTP-tiedot, ei raakaa asiakastunnusta, evästeitä tai salasanoja. Ilman suostumusta testissä ei ladattu Google-skriptiä eikä lähetetty tapahtumia.

Localhostin debug-merkintä ei itsessään sulje tapahtumia raporteista. Kehittäjäliikenteen suodatin on erillinen tiliasetus; testaa ensin testaustilassa ennen aktiivista, peruuttamatonta datan suodatusta. Google-tilin asetuksia ei muutettu. Käyttäjän datastriimikuvassa tunnus vastasi paikallista asetusta, eikä uutta API-salaisuutta tarvita.

Oma SiteVisitTracker ei lähetä localhostin käyntejä tuotannon Supabase-laskuriin. Se tarkistaa suostumuksen uudelleen myös asynkronisen istuntopyynnön jälkeen. Google-lähetykset säilyttävät erillisen analytiikkasuostumuksen ja kohdistuksen GA4-tunnukseen. Paikallinen DOM-diagnostiikka ei tallennu selaimen pysyvään muistiin eikä aktivoidu tuotantodomainilla.

## 5. Läpäisseet tarkistukset

- Next-tuotantokoonti, TypeScript ja koonnin lint-tarkistus.
- test-feature-css, verify-legacy-css, test-seo-collections, test-visit-consent, test-search-performance-quality.
- test-database-search: 46 erikoissuodatustarkistusta ja tuotannon muotoinen tekstihintasarake sekä anonyymin/kirjautuneen RLS eristetyssä PostgreSQL-moottorissa. Ei oikean kirjautuneen tuotantotilin testi.
- test-marketplace-regressions, test-report-fixes, test-listing-seo, test-pdf-fixes.
- test-local-language-pages: neljän kielen HTML, canonical, hreflang, /eng-ohjaus, paikallistettu kirjautumisviesti ja noindex, osastojen kielipolut.
- test-local-seo-collections: neljän kielen 18 Lynx-korttia ja vastaava JSON-LD, ohuen sivun noindex, päällekkäisen canonical, oikeat 404:t myös selain-User-Agentilla, moottori-osumat sekä yksilöllinen sivukartta ja yhtenäinen määritetty domain.
- Selaimessa ennen/jälkeen: etusivun 527 näkyvän elementin 15 laskettua tyylipiirrettä ilman eroja. Kirjautumisen 87 elementtiä ilman eroja. Tarkistus kattoi myös kirjautumissivulta etusivulle palaamisen.
- Selaimessa 320 px: etusivu, tumma kirjautuminen ja tumma kokoelmasivu ilman vaakaylivuotoa. 390 px: vaalea kokoelmasivu ja julkinen myyjän aliasprofiili /profiili/arcticparts ilman vaakaylivuotoa. Alkuperäinen vaalea teema palautettiin.

Tämä on tekninen ja agentin tekemä käytettävyystarkistus, ei oikeilla ihmisillä toteutettu käyttäjäpilotti.

## 6. Vielä ulkoisesti tehtävää

Sivunäyttöjen, hakujen ja liiketoimintatapahtumien kattava DebugView-vahvistus, myöhempi hyväksytty julkaisu, oikeiden käyttäjien CWV- ja konversioaineisto, Search Consolen omistajuus/indeksointiseuranta, 10 myyjän / 20 ostajan pilotti sekä asiantunteva kielentarkistus ovat tekemättä. Nopeusmittausten tekninen vastaanotto on nyt vahvistettu käyttäjän DebugView-kuvasta; kolme kehitysympäristön tapahtumaa ei ole oikeiden käyttäjien CWV-aineisto. Osallistujia, palautetta, mittauksia tai hyväksyntöjä ei keksitty. Kirjautuneiden profiili-, talli- ja myyntipolkujen visuaalinen hyväksyntä tarvitsee oikean hyväksyntätilin; niiden CSS-erottelu on tarkistettu rakenteellisesti, ei kokonaisena kirjautuneen selaintestinä.

Julkaisun yhteydessä on asetettava oikea NEXT_PUBLIC_SITE_URL=https://maskines.com, GA4-tunnus ja tietokantasuodatinlippu ennen koontia. Paikallinen site URL on tarkoituksella localhost; sen sivukarttaa ei lähetetä Search Consoleen. Tässä ei muutettu Railwayta. Uusia SQL-komentoja ei tarvita tämän jatkotyön vuoksi.

Viitteet: [Googlen canonical-ohje](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [Next.js loading ja HTTP-vastaukset](https://nextjs.org/docs/app/api-reference/file-conventions/loading), [GA4 DebugView](https://support.google.com/analytics/answer/7201382), [kehittäjäliikenteen suodatin](https://support.google.com/analytics/answer/13296662).

## 7. Kuvankatselu ja ajoneuvoilmoituksen otsikkotiedot

Ilmoituksen suurennettu kuva siirrettiin omaan CSS-moduulia käyttävään natiiviin dialogiin. Portaalin ja selaimen top layer -kerroksen ansiosta yläpalkki ja chat eivät peitä katselua. Vaalea teema käyttää vaaleaa taustaa ja valkoista kehystä, tumma omaa tummaa pintaa. Kuva mahtuu näyttöön alkuperäisessä kuvasuhteessaan ilman rajaamista tai venyttämistä. Sulkemispainike on vähintään 44 × 44 px. Esc, taustan napsautus, kuvanuolet, näppäimistön nuolinäppäimet ja aiempi pyyhkäisytoiminto säilyvät; suljettaessa vieritys ja kohdistus palautuvat.

scripts/test-local-listing-preview.mjs läpäisi vaalean teeman koot 1280×720, 1920×1080, 390×844, 320×568 ja 844×390 sekä tumman teeman koot 1280×720 ja 390×844. Testi tarkisti kuvasuhteen, dialogin/kuvan/sulkemispainikkeen näkymisen, natiivin modaalikerroksen, vierityslukon/palautuksen, kohdistuksen, Esc-/painike-/taustasulkemisen sekä oikean julkisen monikuvailmoituksen kuvien vaihdon. Se ei kirjoittanut ilmoituksia tai laskureita tietokantaan. Tämän korjauksen Next-tuotantokoonti läpäisi.

Ajoneuvoilmoituksen otsikon alla ajoneuvotyypin korvaavat ilmoitetut kilometrit ja/tai käyttötunnit. Molemmat täytetyt arvot näytetään; ilman arvoja tyyppi säilyy. Varaosailmoituksen kategoria ei muutu. Samat alkuperäisestä ilmoituksesta luettavat arvot ja yksiköt säilyvät myös Perustiedoissa. Käyttäjän Polaris RMK 2022 -ilmoituksessa todettiin selaimessa arvo 2300 km. scripts/test-listing-title-facts.mjs testaa km-, tunti-, molemmat-, nolla-, puuttuva-, varaosa- ja kielitapaukset, ja sisältyy test-report-fixes-ajoon. Otsikkomuutoksen TypeScript- ja ESLint-tarkistus läpäisivät. Uutta SQL:ää tai Railway-julkaisua ei tehty.
