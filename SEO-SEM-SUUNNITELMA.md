# Maskines – SEO- ja SEM-suunnitelma

## Toteutettu tekninen perusta

- Kanoniset ilmoitusosoitteet ovat muotoa `/{merkki}/{malli}/{ilmoitus-id}`, kun merkki ja malli on tallennettu.
- Vanhoista `/ilmoitukset/{id}`-osoitteista tehdään pysyvä 308-uudelleenohjaus kanoniseen osoitteeseen.
- Etusivu säilyy juuriosoitteessa `/`. Suodatus avautuu etusivulla eikä muodosta erillistä indeksoitavaa URL-osoitetta.
- Yrityshakemiston kanoninen osoite on `/yritykset`; vanha `/liikkeet` ohjataan pysyvästi.
- Ilmoituskortit, XML-syöte, sitemap, hakuehdotukset ja JSON-LD käyttävät kanonisia ilmoitusosoitteita.
- Dynaaminen sitemap, robots.txt, canonical-, Open Graph- ja Twitter-metatiedot sekä Product-, Offer-, BreadcrumbList-, Organization-, WebSite- ja ItemList-rakenteet ovat käytössä.
- Myydyt, piilotetut ja poistetut ilmoitukset eivät jää indeksoitaviksi.
- GA4-, Google Ads- ja Search Console -valmius käyttää ympäristömuuttujia. Consent Mode v2:n oletus on `denied`, ja tila päivitetään käyttäjän evästevalinnasta.
- Mittaus lähettää sivunäkymät, ilmoituksen `view_item`-tapahtuman ja keskitetyn `add_to_cart`-tapahtuman, kun mittaustunnus on asetettu.

## Avainsana–sivu-kartta

Hakumääriä ei ole arvioitu ilman Search Console- tai avainsanatyökaludataa.

| Sivu | Hakutarkoitus | Päähakuteema | Tukiteemat | CTA |
|---|---|---|---|---|
| `/` | Kaupallinen | pienkoneiden varaosat ja ajoneuvot | käytetyt varaosat, ajoneuvomarkkinapaikka | Selaa ilmoituksia |
| `/varaosat` | Transaktionaalinen | ajoneuvojen varaosat | käytetyt varaosat, OEM-osat, osanumerohaku | Etsi varaosa |
| `/ajoneuvot` | Transaktionaalinen | käytetyt pienkoneet | moottorikelkat, mönkijät, motocross-pyörät, mopot | Katso ajoneuvot |
| `/yritykset` | Kaupallinen | varaosa- ja ajoneuvoyritykset | paikalliset liikkeet, vahvistetut yritykset | Tutustu yrityksiin |
| `/{merkki}/{malli}/{id}` | Transaktionaalinen | ilmoituksen merkki, malli ja tuote | vuosimalli, osanumero, sijainti, hinta | Ota yhteyttä / Lisää ostoskoriin |
| SEO-kokoelmasivut | Kaupallinen | ajoneuvo- tai varaosakategoria | merkki- ja mallikohtaiset haut | Näytä ilmoitukset |

## Google Ads -rakenne

1. **Brändihaku – Maskines**: Maskines- ja kirjoitusasuvariantit. Laskeutumissivu `/`.
2. **Varaosat – korkea ostoaie**: ryhmät ajoneuvolajin, merkin sekä OEM-/osanumerohaun mukaan. Laskeutumissivut `/varaosat` ja tarkat kokoelmasivut.
3. **Ajoneuvot – korkea ostoaie**: moottorikelkat, mönkijät, motocross, mopot ja muut todelliset kategoriat. Laskeutumissivut `/ajoneuvot` ja tarkat kokoelmasivut.
4. **Yritykset**: paikalliset ja vahvistetut myyjät. Laskeutumissivu `/yritykset`.
5. **Dynaaminen remarketing / Performance Max**: vasta, kun Merchant Center -syöte, konversiot ja suostumussignaalit on validoitu.

### Responsiivisten hakumainosten lähtötekstit

Otsikoita:

- Varaosat ja ajoneuvot
- Löydä oikea varaosa
- Hae OEM-numerolla
- Käytetyt osat helposti
- Ajoneuvot eri puolilta Suomea
- Maskines-markkinapaikka
- Selaa uusimpia ilmoituksia
- Myy varaosasi Maskinesissa

Kuvauksia:

- Hae varaosia merkillä, mallilla tai osanumerolla ja tutustu myyjien ilmoituksiin.
- Selaa ajoneuvoja, varaosia ja ajovarusteita yhdessä pohjoismaisessa markkinapaikassa.
- Löydä yksityisten ja vahvistettujen yritysten ilmoitukset selkeillä hakuehdoilla.
- Julkaise oma ilmoituksesi ja tavoita pienkoneiden varaosista ja ajoneuvoista kiinnostuneet.

Negatiivisten avainsanojen lähtölista: `ilmainen`, `työpaikka`, `rekry`, `ohjekirja pdf`, `peli`, `lelu`, `kuva`, `taustakuva`. Lista pitää tarkistaa hakutermiraportista, jotta hyödyllisiä varaosahakuja ei estetä.

## Mittaus ja käyttöönotto

Tuotantoympäristöön lisättävät arvot:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `NEXT_PUBLIC_GOOGLE_ADS_ID`
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`

Seuraavat tapahtumat tulee viimeistellä todellisiin osto- ja yhteydenottovirtoihin: `search`, `begin_checkout`, `purchase`, `generate_lead`, `sign_up` ja `contact_seller`. `purchase` lähetetään vain kerran samalla `transaction_id`-arvolla.

## 30/60/90 päivän jatko

- **30 päivää:** vahvista Search Console, lähetä sitemap, validoi rich results, GA4 DebugView ja Consent Mode Tag Assistantilla. Kerää lähtötaso indeksoinnista, hauista ja konversioista.
- **60 päivää:** ryhmittele Search Console -kyselyt hakutarkoituksen mukaan, paranna eniten näyttökertoja saavia sivuja ja lisää vain hyödyllisiä kategoria- ja osto-opastekstejä.
- **90 päivää:** optimoi Ads hakutermien ja toteutuneiden konversioiden perusteella, rakenna tuotefeedi todellisista saatavuus- ja tuotetiedoista sekä arvioi Performance Max -testiä.

## Ulkoisia käyttöoikeuksia vaativat TODOt

- Google Search Console -omaisuuden vahvistus ja sitemap-lähetys.
- GA4- ja Google Ads -tunnusten luonti sekä konversioiden merkitseminen käyttöliittymässä.
- Merchant Center -tili ja tuotefeedin hyväksyntä, jos Shopping-mainonta otetaan käyttöön.
- Todelliseen dataan perustuva avainsanavolyymi-, kilpailu- ja budjettianalyysi.
