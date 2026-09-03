# Hakulöydettävyys ja etusivun brändikuva

## Toteutus

- Merkki ja malli tulevat oikeista julkisista ilmoituksista; uusia merkkejä ei tarvitse kovakoodata.
- Osavalmistajan/tuotesarjan ja osan yhdistelmät, esimerkiksi Yamaha DT Voca putki, muodostuvat otsikosta tunnistetusta valmistajasta tai osan mallikentästä sekä todellisesta osaluokasta.
- Yksikkö-, monikko- ja arkikieliset osanimet hyödyntävät olemassa olevaa osasanastoa. Niille ei luoda erillisiä sivuja pelkkien sanamuotojen vuoksi.
- Hakuryhmien jäsenyys ei päättele sopivuutta tai valmistajaa kuvauksen irrallisista maininnoista. Pakoputken tiiviste ei kuulu putkihakuun.
- Varaosa- ja ajoneuvo-osastoilla on palvelimella tuotettu linkkihakemisto kaikkiin julkaistuihin hakuryhmiin; kielikohtaiset päällekkäisyydet poistetaan.
- Ilmoitusotsikossa ajoneuvon ja varsinaisen tuotteen nimi tulee ennen pitkiä luokkia ja OEM-numeroita.
- Etusivun Open Graph ja Twitter määrittelevät kuvan itse, jotta Nextin sisäkkäisten metatietojen korvaaminen ei pudota logoa pois. Nykyinen näkyvä logo on myös Organization.logo ja WebPage.primaryImageOfPage.
- Nykyinen favicon-osoite säilyy vakaana. Ilmoitussivujen omat kuvat ja indeksoitavuus säilyvät.

## Julkaisurajat

Kolmen ilmoituksen toimituksellinen vähimmäisraja hakuryhmille säilyy. Yksittäinen ilmoitus voi päästä Googleen myös yksin: esimerkiksi yhden Voca-putken vuoksi ei julkaista kymmeniä lähes samanlaisia indeksoitavia hakuryhmiä. Samat hakutulokset yhdistetään yhdellä canonical-osoitteella. Tyhjät/tuntemattomat yhdistelmät palauttavat 404:n, eikä niitä lisätä sivustokarttaan.

Tuotantotietokannassa osan mallikenttä voi puuttua; julkinen tarkistusskripti käsittelee tämän kuten sovelluksen nykyinen tietokerros. Tietokantaan ei lisätty kenttiä eikä ilmoituksia muokattu. Valmistajanimet voidaan tunnistaa olemassa olevista ilmoitusotsikoista.

Google valitsee lopulliset otsikot, kuvat, indeksoinnin ja hakusijoitukset. Näillä muutoksilla ei luvata näkyvyyttä kaikilla hakusanoilla eikä Google-tuloksen välitöntä muutosta.

## Tarkistukset

- `scripts/test-seo-collections.mjs`: valmistaja–malli–osa, sanamuodot, osuvuus, tyhjät/pienet/duplikaatit ja neljä kieltä.
- `scripts/test-home-brand-seo.mjs`: oikea logo ja kuvakoko, etusivun metatiedot sekä ensisijainen kuva neljällä kielellä.
- `scripts/test-listing-seo.mjs`: ilmoitusten canonical, sivustokartta ja vanhojen osoitteiden uudelleenohjaukset.
- `scripts/test-local-seo-collections.mjs`: palvelin-HTML, kielet, oikeat tilakoodit ja sivustokartta.
- `scripts/test-public-seo-discovery.mjs`: etusivun kuvat, kaikki hakemiston linkit ja todellinen Yamaha DT Voca -ilmoitus. Tuotantotarkistus vaatii `MASKINES_TEST_URL=https://maskines.com` sekä `--remote-read-only`.
