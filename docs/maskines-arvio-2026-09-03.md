# Nykyversion kokonaisarvio 3.9.2026

PDF: `output/pdf/Maskines_kokonaisarvio_2026-09-03.pdf`.

11 sivua, 14 laadullisesti arvioitua osa-aluetta, kokonaisarvio 6,7/10.
Raportin kaikki sivut renderöitiin ja tarkistettiin visuaalisesti. Lähteet ovat
klikattavia. Arvosanat eivät ole Lighthouse-pisteitä tai tuotannon mittaustuloksia.

## Käyttäjän työn aikana pyytämä muutos

Koko käännöshuomautuslaatikko poistettiin ilmoituksilta: varoitus,
alkuperäisen ilmoituksen avaus ja käännösvirheen ilmoituslinkki. Käyttöliittymän
komponentti ja sen käyttökohdat poistettiin, ei pelkkää CSS-piilotusta.
Ilmoituskuvaukset ja käännöslogiikka säilytettiin.

`test-local-translation-note-removal.mjs` läpäisi sekä kehitys- että paikallisen
tuotantoversion tarkistukset: 2 ilmoitustyyppiä x 4 kieltä x 2 teemaa x 2 leveyttä
= 32 yhdistelmää. Laatikoita ei ollut DOM:ssa ja kuvaus säilyi. Sivun JavaScript-
virheitä ei havaittu. Luodut väliaikaiset teemakorjauksen tyylit poistettiin myös.

## Viimeiset tarkistukset muutoksen jälkeen

- Tuotantokoonti: käännös, tyyppitarkistus, lint ja 79 staattisen sivun generointi läpi.
- Kielisivut: `/`, `/en`, `/sv`, `/no`, canonical, hreflang, alias- ja kirjautumispolut läpi.
- SEO-kokoelmat: neljä kieltä, 18 korttia, ohuet/duplikaatit/puuttuvat sivut ja 438 URL:n sivukartta läpi.
- `test-report-fixes.mjs` sekä sen otsikon km/h-tarkistukset läpi.
- Uudet tuotantokoonnin resurssimittaukset tallennettu `output/performance/final-audit-*.json`.

## Tärkeä toistotestin korjaus

`output/site-audit-2026-09-03/audit.json` sisältää alkuperäisen
`productionLocale`-havainnon palvelimelta, joka sidottiin osoitteeseen 127.0.0.1.
Nextin localhost-uudelleenkirjoitus aiheutti kyseisessä testiympäristössä
poikkeaman. Sen jälkeen palvelin käynnistettiin osoitteella `--hostname localhost`
ja pyynnöt tehtiin samaan osoitteeseen. Kielitestit läpäisivät tämän jälkeen sekä
ennen että jälkeen käännöslaatikon poiston. Alkuperäinen poikkeama EI ole
vahvistettu sivuston kieli-SEO- tai 404-vika. Raportti käyttää toistotestin tulosta.

## Rajaus

Ei Railway-julkaisua, tietokantaan kirjoittamista, oikeita maksuja tai käyttäjien
kontaktointia. GA:n web_vital-vastaanoton näyttö on käyttäjän DebugView-kuva;
koko tapahtumaputken vastaanottoa ei vahvistettu tässä tarkastuksessa.
Ei kattavaa tietoturva- tai saavutettavuusauditointia. Raportin muut parannukset
ovat jatkotoimia, eivät tässä toteutettuja muutoksia.
