import InfoPage from "@/app/components/InfoPage";

export default function ContactPage() {
  return (
    <InfoPage
      kicker="Ota yhteyttä"
      title="Yhteys Maskinesiin"
      lead="Autamme palvelun käyttöön, ilmoituksiin, käyttäjätiliin ja turvallisuuteen liittyvissä asioissa. Laita viesti, niin katsotaan asia kuntoon."
      actions={[
        { href: "mailto:info@arcticparts.fi", label: "info@arcticparts.fi", primary: true },
        { href: "https://www.instagram.com/maskines1/", label: "Instagram", external: true },
        { href: "https://www.facebook.com/profile.php?id=61590753577719&locale=fi_FI", label: "Facebook", external: true }
      ]}
      cards={[
        { title: "Tuki", text: "Kysymykset kirjautumisesta, ilmoituksista, profiilista ja viesteistä." },
        { title: "Turvallisuus", text: "Ilmoita epäilyttävästä ilmoituksesta, viestistä tai maksupyyntöön liittyvästä riskistä." },
        { title: "Yritykset", text: "Yritystilit, varaosavarastot ja näkyvyyteen liittyvät kysymykset." }
      ]}
      sections={[
        {
          title: "Mitä viestiin kannattaa laittaa?",
          body: ["Saat nopeamman vastauksen, kun kerrot heti mihin ilmoitukseen, tiliin tai toimintoon asia liittyy."],
          bullets: ["oma sähköpostiosoite", "ilmoituksen linkki tai otsikko", "kuvaus ongelmasta", "mahdollinen kuvakaappaus"]
        },
        {
          title: "Sosiaalinen media",
          body: [
            "Instagramissa ja Facebookissa kerromme palvelun etenemisestä, uusista ominaisuuksista ja ajankohtaisista asioista. Kiireellisissä tuki- ja tietosuoja-asioissa sähköposti on varmin kanava."
          ]
        }
      ]}
    />
  );
}
