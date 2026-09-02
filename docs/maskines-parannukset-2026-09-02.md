# Maskines – paikalliset parannukset 2.9.2026

Ei Railway-julkaisua, git-pushia, tuotantotietojen muokkausta tai tietokantamigraation ajoa.

## Toteutettu

- Kieliosoitteet: suomi /, englanti /en, ruotsi /sv ja norja /no. /eng toimii englannin aliasosoitteena. Myös vanha ?lang= ohjataan kieliosoitteeseen.
- URL määrää kielen palvelimella ja selaimessa, ei aikaisempi kielieväste. Sisäiset linkit ja navigointi säilyttävät kielen. Kielen vaihto käyttää sivun kielivastinetta myös syvillä hakukategoriasivuilla.
- Kielikohtaiset HTML-lang, canonical- ja hreflang-tiedot; ilmoitus- ja sivukarttavastineet. Yksityiset sivut pysyvät noindex-sivuina, API/admin-polkuja ei voi kiertää kieliprefiksillä.
- Käyttöliittymän 1 447 staattista tekstikohtaa 37 tiedostossa siirrettiin Reactin renderöimiin sanastokäännöksiin. Vanha koko sivun DOM-automaattikääntäjä poistettiin käytöstä. Tuntematon teksti säilyy alkuperäisenä; kaikkia sisältöjä ei väitetä täydellisesti käännetyiksi.
- Ilmoitusten varaosasanasto, kaasutin/kassutin-virheen torjunta, numeroiden/OEM-tunnisteiden säilymisen tarkistus, alkuperäisen ilmoituksen näyttö ja käännösvirheen ilmoittamislinkki.
- Pelkkä selaaminen ei enää käynnistä ilmoitusten käännöspyyntöjä. Puuttuva avain tai palveluvirhe ei korvaa tallennettuja käännöksiä alkuperäisen kopioilla. SEO-metatiedot eivät tee Google-käännöspyyntöjä.
- Etusivun ensimmäinen tietohaku 240 -> 48 ilmoitusta. Palvelimen toimittamaa ensimmäistä erää käytetään uudelleen. Hakusanat, merkki, malli, vuosi ja hintarajat rajataan tietokannassa; seuraavat haut ovat rajattuja eriä. Erikoissuodattimien yhteensopivuuslogiikka tarkentaa tuloksia edelleen selaimessa.
- Koko ilmoituskannan kertalataus kahden kirjoitetun merkin jälkeen poistettu sekä etusivulta että yläpalkista. Yläpalkin ehdotuksia haetaan enintään 24 kerrallaan. Haku tunnistaa myös sanaston englanninkielisiä varaosatermejä, ID:t ja erotinmerkeiltään poikkeavat OEM-numerot. Vanhentuvien pyyntöjen tulokset eivät saa korvata uutta hakua.
- Suodatinpaneelia ei rakenneta palvelimella turhaan puhelinta varten. Mallilista avautuu vasta merkin valinnan jälkeen. Aktiiviset suodattimet ja tyhjennys säilyvät.
- Etusivun oletusjärjestys on uusimmat ensin. Hakukentän teksti on lyhyempi. Kirjautumispainikkeessa on käyttäjäkuvake. Vieraskäyttäjän mobiilivalikossa on Luo ilmoitus, joka jatkaa kirjautumisen kautta myyntiin.
- Mobiilikorttien vuosimalli, sijainti ja päivämäärä ovat luettavampia ja kortti joustaa sisällön mukaan. Osastovälilehtien keskitys ja vain ei-tyhjän ostoskorin kuvake säilytettiin.
- Sivun zoomaus sallitaan ja näppäimistökohdistus on näkyvä.
- Tarpeeton SourceFog-sisältö ja ennakoiva usean sivun lataus poistettiin. Linkkien esilataus tapahtuu käyttäjän osoittaessa linkkiä, ei kaikkien korttien tullessa näkyviin.
- Yksityismyyjälle ei näytetä puuttuvaa Y-tunnusta. Myytyjen ilmoitusten lukua ei nimetä varmennetuiksi onnistuneiksi kaupoiksi.
- Web Vitals- ja ostopolun mittauskytkennät (haku, ilmoituksen katselu, yhteydenotto, julkaisu, ostoskori ja maksuvaihe). Analytiikkatapahtumat edellyttävät suostumusta. Google-tagia ei ladata ilman analytiikka- tai personointisuostumusta. Sivukatselun URL:sta jätetään kyselyparametrit pois.

## Tarkistus

- scripts/test-marketplace-regressions.mjs: reitit, käännösregressiot, OEM/ID-haku, kielievästeen ohitus, API-eristys, noindex, ostoskorin tyhjä–täysi–tyhjä-kierto ja kuormituksen suojaukset.
- scripts/test-listing-seo.mjs: sivukartta, canonical/hreflang, vanhat ilmoitusosoitteet, piilotettujen/myytyjen ilmoitusten poistumiskäytös ja yrityshakemiston näkyvyysraja.
- scripts/test-local-language-pages.mjs: oikeat HTTP-vastaukset neljälle kielelle, vanhan evästeen ohitus, canonical/hreflang, /eng-alias, kirjautumisen noindex ja osasto-osoitteet.
- TypeScript, ESLint ja paikallinen tuotantokoonti läpäisty. HTTP-testit läpäisty sekä kehityspalvelimella että `next start -p 3001 -H localhost` -tuotantopalvelimella.
- Testiympäristöhuomio: Next 15.5.21 normalisoi middleware-URL:ssa 127.0.0.1:n localhostiksi. Tuotantopalvelimen pakotettu `-H 127.0.0.1` teki tästä sisäisestä rewritesta uuden HTTP-pyynnön ja hukutti kieliheaderin. Paikallinen tuotantotesti käynnistettiin siksi `-H localhost` -asetuksella; tähän ei lisätty evästeeseen tai asiakkaan lähettämään headeriin luottavaa kiertotietä.
- Selainkokeet: 320 ja 390 px puhelinnäkymät sekä 1440 px työpöytänäkymä, englanninkielinen kaasutin-haku, ilmoituksen kielenvaihto, suorat kieliosoitteet ja myyntiin ohjaava vieraskäyttäjän linkki.
- Kapeimmassa kokeessa ei vaakaylivuotoa, leikattuja korttien päivämääriä eikä suljetun suodatinpaneelin DOM-sisältöä. Suodattimien avaus/sulkeminen ja kirjautumissivun päätekstit tarkistettu. Selaimen testikoko palautettu normaaliksi.

## Aiemmin lykättyjen töiden jatkototeutus

- Legacy-CSS jaettu 27 järjestettyyn tiedostoon. PostCSS-pohjainen sisältötiiviste vahvistaa kaikkien alkuperäisten sääntöjen ja kaskadijärjestyksen säilymisen. Selaimen 11 elementin computed-style-vertailu oli identtinen. Tämä on rakenteellinen muutos, ei väite pienemmästä CSS-siirtomäärästä.
- Kaikille käyttöliittymän erikoissuodattimille on tietokantapredikaatit ja RLS:n säilyttävä SQL RPC. Tulosmäärä ja sivutus tapahtuvat suodatuksen jälkeen tietokannassa. Käyttöönotto on opt-in ja pois päältä, kunnes SQL on asennettu.
- Paikallisessa PostgreSQL-moottorissa läpäisty 46 myönteistä/kielteistä suodatinkoetta sekä varusteiden, sijaintien, taksonomian, tallin, sivutuksen, RLS:n ja loppuneiden tuotteiden testit. Seitsemän CONCURRENTLY-indeksiä luotiin erillisillä komennoilla ja todettiin valid/ready.
- Indeksien ajoskripti tarkistaa kohdeprojektin, yhteystyypin, TLS:n, sarakkeet, pg_trgm:n sekä olemassa olevien indeksien määrittelyt. Oletus on vain tarkistus. Tuotantoon SQL:ää ei ajettu.
- Stripe-webhook: test/live-eristys, myöhäinen failure ei ylikirjoita maksettua/palautettua tilausta, Connect-riitautus haetaan oikealta tililtä, failed-tapahtuman uusintakäsittelyllä ehdollinen tilanvaihto ja valmistumisen tietokantavirhe huomioidaan. Ostoskorin virheelliset ja yhdistettynä liian suuret määrät hylätään.
- Allekirjoitetut webhookit, palautukset, toimitukset, tilauksen omistajuus, loppuunmyynti, määrät ja toimitushinnat testattu eristetyillä tietueilla. Ei oikeita maksuja, palautuksia, sähköposteja tai toimituksia.
- Vitals-mittareille tunniste ja delta, oston suostumus- ja duplikaattisuojaus sekä yksityisten URL-tunnisteiden poisto. GA4-vientiraportti laskee p75:n ja istuntokonversion eikä päättele tuloksia puuttuvista havainnoista.
- Käännösten numerosuoja torjuu 32 → 320 -virheen sekä numeroiden pudottamisen. Tuotannon julkiseen aineistoon tehtiin vain lukuja: 45 ilmoitusta / 135 kieliversiota. Kielentarkistajalle muodostettiin lähdetekstit, lähteen tiivisteet ja avoimet tarkistuskohdat sisältävä paketti.
- Pilotin kutsu, 10/20-osallistujajako, testitehtävät, havaintopohja, hyväksymisrajat ja ilmoituslaadun portti on dokumentoitu. Osallistujia ei rekrytoitu.
- pnpm test:marketplace, ESLint ja uusi tuotantokoonti läpäisty. HTTP-testit läpäisty myös uudella tuotantokoosteella. Selain tarkistettu 320/390/1440 px koossa: ei vaakaylivuotoa, suodatin avautuu/sulkeutuu, ei uusia selainvirheitä. Etusivun First Load JS tässä koonnissa 452 kB; tästä ei johdeta tuotannon nopeusprosenttia.

Tarkat käyttöönotto- ja hyväksymisohjeet: [maskines-kayttoonotto-ja-pilotti.md](./maskines-kayttoonotto-ja-pilotti.md).

## Ulkoista pääsyä tai oikeita havaintoja edelleen vaativat tehtävät

- Hakua nopeuttava supabase/maintenance/public-listing-search-indexes.sql on valmisteltu automaattisten migraatioiden ulkopuolelle, mutta sitä EI ole ajettu. Se on tarkistettava ja ajettava erikseen tietokantaan ilman transaktiota.
- Oikeiden käyttäjien Core Web Vitals- ja konversiotulokset vaativat myöhemmän julkaisun, toimivan analytiikkatunnuksen, suostumukset ja riittävästi havaintoja. Tässä ei ole mitattua tuotannon nopeutusprosenttia.
- Stripe-maksu, palautus, toimitus ja loppuunmyydyn tuotteen koko ostopolku on testattava erillisessä testitilassa. Oikeaa maksua ei tehty.
- 10 myyjän / 20 ostajan pilotti, laadukkaiden ilmoitusten hankinta ja Search Consolen seuranta ovat erillisiä käytännön tehtäviä.
- Legacy-CSS:n järjestely ja erikoissuodattimien tietokantaversio on toteutettu ja testattu paikallisesti. Tietokantaversion tuotantoasennus on vielä tekemättä.
- Sanastokäännökset eivät korvaa kaikkien käyttäjien kirjoittamien kuvausten ammattimaista kielentarkistusta. Puuttuville ja epäilyttäville käännöksille näytetään alkuperäinen sisältö.
