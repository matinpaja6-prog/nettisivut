import InfoPage from "@/app/components/InfoPage";

export default function CookiesPage() {
  return (
    <InfoPage
      kicker="Tietosuoja"
      title="Evästeet"
      lead="Maskines käyttää välttämättömiä evästeitä ja selaimen paikallista tallennusta, jotta kirjautuminen, kielivalinta, turvallisuus ja palvelun perustoiminnot toimivat."
      cards={[
        { title: "Välttämättömät", text: "Kirjautuminen, istunto, kieli ja palvelun turvallisuus tarvitsevat teknistä tallennusta." },
        { title: "Käyttökokemus", text: "Muistamme valintoja, jotta sivu latautuu sujuvammin ja näyttää oikealta myös seuraavalla käynnillä." },
        { title: "Ei tietojen myyntiä", text: "Evästeitä ei käytetä henkilötietojen myymiseen." }
      ]}
      sections={[
        {
          title: "Mihin evästeitä käytetään?",
          body: ["Evästeet ja paikallinen tallennus auttavat pitämään palvelun käytettävänä ja turvallisena."],
          bullets: ["kirjautumisen ja istunnon ylläpito", "kielivalinnan muistaminen", "admin-paneelissa hallittavan ulkoasun lataaminen nopeasti", "väärinkäytösten estäminen ja tekninen vianhaku"]
        },
        {
          title: "Voiko evästeet estää?",
          body: ["Selaimen asetuksista voi rajoittaa evästeitä, mutta välttämättömien evästeiden estäminen voi rikkoa kirjautumisen, viestit tai muut palvelun perustoiminnot."]
        },
        {
          title: "Lisätiedot",
          body: ["Henkilötietojen käsittelystä kerrotaan tarkemmin tietosuojaselosteessa. Käyttöehdoissa kuvataan palvelun käytön säännöt."]
        }
      ]}
      actions={[
        { href: "/privacy", label: "Tietosuoja", primary: true },
        { href: "/terms", label: "Käyttöehdot" }
      ]}
    />
  );
}
