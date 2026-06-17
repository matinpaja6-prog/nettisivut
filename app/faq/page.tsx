import InfoPage from "@/app/components/InfoPage";

export default function FaqPage() {
  return (
    <InfoPage
      kicker="Tuki"
      title="UKK"
      lead="Usein kysytyt kysymykset Maskinesin käytöstä, ilmoituksista, viesteistä ja turvallisesta kaupankäynnistä."
      cards={[
        { title: "Ilmoittaminen", text: "Hyvä ilmoitus sisältää osan kunnon, sopivuuden, kuvat, hinnan ja sijainnin." },
        { title: "Ostaminen", text: "Varmista osan yhteensopivuus ja sovi maksu sekä toimitus myyjän kanssa kirjallisesti." },
        { title: "Tili", text: "Profiilin tiedot auttavat ostajia luottamaan myyjään ja helpottavat yhteydenpitoa." }
      ]}
      sections={[
        {
          title: "Onko Maskines kaupan osapuoli?",
          body: ["Ei. Maskines tarjoaa alustan ostajille ja myyjille. Ostaja ja myyjä sopivat itse maksusta, toimituksesta, noudosta, palautuksista ja reklamaatioista."]
        },
        {
          title: "Miten teen hyvän ilmoituksen?",
          body: ["Kirjoita selkeä otsikko, lisää hyvät kuvat ja kerro osa mahdollisimman tarkasti."],
          bullets: ["ajoneuvotyyppi, merkki, malli ja vuosimalli", "osan kunto ja mahdolliset viat", "alkuperäinen varaosanumero, jos se on tiedossa", "toimitus- tai noutomahdollisuus"]
        },
        {
          title: "Mitä teen, jos ilmoitus vaikuttaa epäilyttävältä?",
          body: ["Älä lähetä rahaa kiireen tai painostuksen perusteella. Pyydä lisäkuvia, varmista myyjän tiedot ja ota yhteyttä tukeen, jos jokin tuntuu väärältä."]
        },
        {
          title: "Voiko yritys käyttää palvelua?",
          body: ["Kyllä. Yritykset voivat käyttää palvelua varaosien myyntiin ja näkyvyyden kasvattamiseen. Yritystilin tietojen tulee olla oikein ja ajan tasalla."]
        }
      ]}
    />
  );
}
