# Maskines: PDF-arvion vahvistettujen puutteiden korjaukset

Paikallinen toteutus 2.9.2026. Lähtöaineisto: käyttäjän toimittama
`Maskines_verkkosivustoanalyysi_2026-09-02.pdf` ja sitä verrannut localhost-tarkistus.
Railway-julkaisua, pushia, tilien poistoja tai oikeita maksuja ei tehty.

## Toteutettu

1. **Hakuehdotusten todellinen tietokantavirhe.** Julkinen GET-tarkistus palautti
   PostgreSQL-virheen 42703: `listings.part_model does not exist`. Puuttuvaa
   valinnaista kenttää ei enää käytetä julkisen haun OR-ehdossa. Osa-/mallitietoja
   haetaan olemassa olevista otsikko- ja kuvauskentistä. Sanastoalias on sama
   paikallisissa ehdotuksissa ja palvelimen hakuehdoissa. Epäonnistunut kysely
   näytetään virheenä, ei harhaanjohtavasti nollana osumana. Hakuehdotusten
   24 ehdokkaan raja, viive ja vanhan pyynnön keskeytys säilyvät.
   GET-tarkistus korjauksen jälkeen: `carburetor`, `förgasare`, `forgasser`
   löytävät ilmoituksen 163; `420685756` löytää ilmoitukset 118 ja 109.

2. **Käännökset.** Tankki/penkki-kokonaisuuden puuttuva sana, saman moottoritermin
   toisto ja yksi täsmällisesti rajattu kuntokuvaus korjattu sanastoon. Malli-,
   mitta- ja OEM-tunnuksia ei muuteta. Tuntemattomia kuvauksia ei keksitä.
   Kuvien tekstit ja liittyvän ilmoituksen saavutettava nimi eivät sisällä enää
   näissä kohdissa suomenkielisiä käyttöliittymäsanoja muilla kielillä.

3. **Maksaminen.** UKK ja yrityskaupan tekstit erottavat Stripe-kassan tuotteet
   ilmoituksista, joissa ostaja ottaa yhteyttä myyjään. Yleinen lupaus Maskinesin
   ostajansuojasta poistettu. Maksupalvelua ei rinnasteta tuotetakuuseen.
   Palautustekstissä huomioidaan kuluttajan etäosto, poikkeukset ja lakisääteiset
   oikeudet; alkuperäispakkausta ei esitetä ehdottomana palautuksen edellytyksenä.
   Yrityksen julkaistujen ilmoitusten määrää ei kutsuta vahvistetuksi varastomääräksi.

4. **Yritystiedot ja tietosuoja.** Ruotsin ja norjan tietosuojasivut saivat omat
   kokonaiset tekstit. Yleinen GDPR-yhteensopivuusmerkintä poistettu; tämä työ ei
   ole oikeudellinen vaatimustenmukaisuusauditointi. Arctic Parts Oy:n nimi,
   Y-tunnus ja rekisteriosoite tarkistettu PRH:n julkisesta APIsta 2.9.2026.
   Osoite on tietosuojasivulla yrityksen rekisteriosoite, ei nouto-/palautusosoite.
   Alustan ylläpitäjän ja ilmoituksen myyjän roolit erotettu. Jos Arctic Parts Oy
   on ilmoituksen myyjä, yhtiölle kuuluvat myös kyseisen kaupan myyjän velvoitteet.
   Käännössanaston virheelliset `info@maskiner.com`-osoitteet korjattu ja lisätty
   suoja sille, ettei käyttöliittymäkäännös muuta yhteyssähköpostia.

5. **Otsikot.** Ilmoituksen tuotenimi tulee selainotsikkoon myös kehitystilassa.
   Maskines-pääte esiintyy kerran; puuttuvan ilmoituksen otsikko on oikealla
   kielellä ja noindex. Palvelimen sivu ja metadata jakavat saman lukupyynnön
   yhden renderöinnin aikana, eivät säilytä myytyä/piilotettua ilmoitusta
   pysyvässä välimuistissa. Etusivun ilmoituslistalla on H2 ja sivulla
   ruudunlukijan H1. Käyttäjän pyynnöstä näkyvä esittely- ja otsikkolohko poistettiin.

6. **Navigaatio.** Vierailijalle näkyy työpöydällä ilmoituksen luonti.
   Puhelimen vierailijavalikossa ovat Etusivu, Luo ilmoitus, Kirjaudu ja Suodata
   (kunkin kielen tekstit). Profiili kuuluu kirjautuneen valikkoon. Yläreunan
   erillinen vierailijan profiilikuvake poistettiin käyttäjän pyynnöstä.
   Suljettu kelluva chat ei peitä kortteja puhelimen alavalikon kanssa.

7. **Ilmoituslaadun ohjaus.** Yksittäisen ilmoituksen kuvausvaiheessa on
   nelikielinen tarkistuslista: OEM, yhteensopivuus ja vuosimallit, testaus/kunto,
   viat, kaupan sisältö, tunniste-/vauriokuvat ja toimituskulut. Listaa ei nimetä
   automaattiseksi laadunvarmistukseksi eikä se todista käyttäjän tietoja oikeiksi.

## Tarkistus

- `pnpm test:marketplace`: reitit, kielivalinta, sanasto/OEM, ostoskori, SEO,
  uudet PDF-regressiot, eristetyt maksut/palautukset/toimitukset, PostgreSQL/RLS,
  suostumus/mittaus ja alkuperäisen CSS-kaskadin säilyminen.
- `node scripts/check-public-search.mjs --remote-read-only`: vain julkiset
  lukupyynnöt Supabaseen. Ei palveluroolin avainta eikä tietokantakirjoituksia.
- `node scripts/test-local-language-pages.mjs`: neljän kielen HTTP-sivut,
  canonical/hreflang, kielialias ja kirjautumisen noindex.
- TypeScript-, ESLint- ja tuotantokoostetarkistus sekä paikalliset selainkokeet.
  Koosteen koko tai paikallinen havainto ei ole tuotannon nopeutusprosentti.

## Eivät ole vielä valmiita

- Käyttäjä on sittemmin asentanut seitsemän hakuindeksiä ja erikoissuodatin-RPC:n.
  Hintajärjestyksen uusi public-listing-numeric-price.sql odottaa vielä ajoa.
  Suodatinlippu ei ole käytössä ennen tämän SQL:n ja hyväksyntätestien valmistumista.
- Stripen testiavaimet ja webhookien allekirjoitussalaisuudet puuttuvat
  paikallisesta kokoonpanosta. Oikean maksun, palautuksen ja toimituksen
  päästä päähän -testiä ei tehty. Eristettyjen testien läpäisy ei korvaa sitä.
- Tuotannon CWV/konversiot, analytiikkatunnus ja Search Console vaativat
  asianmukaiset asetukset, suostumukset, myöhemmän julkaisun ja havaintoja.
- 10 myyjän / 20 ostajan pilotti ja oikean tarjonnan hankinta tarvitsevat
  osallistujat ja käytännön toteutuksen. Ei tekaistuja käyttäjiä tai ilmoituksia.
- Kaikkien käyttäjäkuvausten ammattilaisen kielentarkistus on edelleen avoin.
  Käännösten hyväksyntää ei väärennetty. CSV-tuonti ja ulkoiset varastosynkronoinnit
  ovat erillisiä uusia toimintoja, eivät tässä korjattuja ohjelmavirheitä.
- Koko legacy-CSS:n sisällöllinen uudistus ja kaikkien suodattimien käyttöönotto
  tietokannassa ovat jatkotyötä. Nykyistä kaskadia ei rikottu.
- PDF:n epäily testiyrityksestä ei oikeuta tilin poistamiseen ilman varmennusta.
  Piilotettua yrityshakemistoa ei avattu eikä käyttäjätietoja poistettu.

## Lähteet

- PRH, Arctic Parts Oy, Y-tunnus 3576714-8:
  https://avoindata.prh.fi/opendata-ytj-api/v3/companies?businessId=3576714-8
- Stripe, direct charges: https://docs.stripe.com/connect/direct-charges
- KKV, verkkokaupan peruuttamisoikeus:
  https://www.kkv.fi/kuluttaja-asiat/verkkokauppa/peruuttamisoikeus-verkkokaupassa/
