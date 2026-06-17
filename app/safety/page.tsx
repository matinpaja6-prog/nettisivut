import InfoPage from "@/app/components/InfoPage";

export default function SafetyPage() {
  return (
    <InfoPage
      kicker="Tuki"
      title="Turvallinen kauppa"
      lead="Turvallinen varaosakauppa syntyy selkeistä tiedoista, rauhallisesta viestittelystä ja siitä, että ostaja ja myyjä sopivat asiat kirjallisesti."
      cards={[
        { title: "Tarkista osa", text: "Varmista sopivuus, kunto, varaosanumero ja kuvat ennen maksua." },
        { title: "Sovi ehdot", text: "Kirjaa maksu, toimitus, nouto ja palautusmahdollisuus viesteihin." },
        { title: "Vältä painostus", text: "Kiire, oudot maksutavat ja palvelun ulkopuolelle ohjaaminen ovat varoitusmerkkejä." }
      ]}
      sections={[
        {
          title: "Ostajalle",
          body: ["Tarkista myyjän profiili ja pyydä tarvittaessa lisäkuvia osasta, kiinnityskohdista, sarjanumerosta tai kulumista."],
          bullets: ["älä maksa ennen kuin tiedot ovat selvät", "käytä jäljitettävää maksutapaa", "säilytä keskustelu ja kuitit", "nouda kallis osa mahdollisuuksien mukaan paikan päältä"]
        },
        {
          title: "Myyjälle",
          body: ["Kerro tuotteen todellinen kunto ja pakkaa lähetettävä osa niin, ettei se vaurioidu matkalla."],
          bullets: ["kuvaa viat avoimesti", "pidä hinta ja saatavuus ajan tasalla", "lähetä seurantatunnus ostajalle", "poista myyty ilmoitus tai merkitse se myydyksi"]
        },
        {
          title: "Ilmoita riskistä",
          body: ["Jos huomaat huijausyrityksen, varastetuksi epäillyn tuotteen tai käyttäjän, joka häiritsee muita, ota yhteyttä tukeen mahdollisimman tarkkojen tietojen kanssa."]
        }
      ]}
      actions={[{ href: "mailto:info@arcticparts.fi", label: "Ilmoita ongelmasta", primary: true }]}
    />
  );
}
