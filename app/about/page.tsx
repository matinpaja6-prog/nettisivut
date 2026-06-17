import InfoPage from "@/app/components/InfoPage";

export default function AboutPage() {
  return (
    <InfoPage
      kicker="Yritys"
      title="Meistä"
      lead="Maskines on pohjoisen ajoneuvoharrastajille rakennettu varaosamarketpaikka, jossa moottorikelkkojen, mönkijöiden, motocross-pyörien ja mopojen osat löytyvät yhdestä paikasta."
      cards={[
        { title: "Selkeä varaosahaku", text: "Ajoneuvo, merkki, malli, vuosimalli ja kategoria auttavat ostajaa löytämään oikean osan nopeasti." },
        { title: "Käyttäjältä käyttäjälle", text: "Palvelu yhdistää harrastajat, purkuosien myyjät ja yritykset ilman turhaa välikättä." },
        { title: "Pohjoisen olosuhteisiin", text: "Painopiste on lajeissa ja ajoneuvoissa, joissa oikea osa voi pelastaa koko ajokauden." }
      ]}
      sections={[
        {
          title: "Miksi Maskines on olemassa?",
          body: [
            "Varaosien ostaminen ja myyminen on usein hajallaan keskusteluryhmissä, viesteissä ja vanhoissa ilmoituskanavissa. Maskines kokoaa osat yhteen ja tekee ilmoittamisesta selkeämpää.",
            "Tavoitteena on, että hyvä osa ei jää varaston perälle ja ostaja saa tarvitsemansa tiedot ennen yhteydenottoa."
          ]
        },
        {
          title: "Mitä palvelussa voi myydä?",
          body: ["Palvelu on tehty erityisesti käytetyille ja uusille varaosille, tarvikkeille sekä ajoneuvoihin liittyville osille."],
          bullets: ["moottorikelkan osat", "mönkijän osat", "motocross- ja enduro-osat", "mopojen osat ja tarvikkeet"]
        },
        {
          title: "Miten pidämme palvelun siistinä?",
          body: [
            "Ilmoituksissa korostetaan kuvia, yhteensopivuutta, kuntoa ja selkeitä myyjän tietoja. Epäselvä, harhaanjohtava tai sääntöjen vastainen sisältö voidaan poistaa.",
            "Kehitämme palvelua käytännön palautteen perusteella, jotta ostaminen ja myyminen pysyy nopeana myös mobiilissa."
          ]
        }
      ]}
    />
  );
}
