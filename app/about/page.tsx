import InfoPage, { type InfoPageCopy } from "@/app/components/InfoPage";
import type { Locale } from "@/lib/i18n";

const copy: Record<Locale, InfoPageCopy> = {
  fi: {
    kicker: "Yritys",
    title: "Meistä",
    lead: "Maskines on pohjoisen ajoneuvoharrastajille rakennettu varaosamarketpaikka, jossa moottorikelkkojen, mönkijöiden, motocross-pyörien ja mopojen osat löytyvät yhdestä paikasta.",
    cards: [
      { title: "Selkeä varaosahaku", text: "Ajoneuvo, merkki, malli, vuosimalli ja kategoria auttavat ostajaa löytämään oikean osan nopeasti." },
      { title: "Käyttäjältä käyttäjälle", text: "Palvelu yhdistää harrastajat, purkuosien myyjät ja yritykset ilman turhaa välikättä." },
      { title: "Pohjoisen olosuhteisiin", text: "Painopiste on lajeissa ja ajoneuvoissa, joissa oikea osa voi pelastaa koko ajokauden." }
    ],
    sections: [
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
    ],
    summaryLabel: "Meistä - yhteenveto"
  },
  en: {
    kicker: "Company",
    title: "About us",
    lead: "Maskines is a parts marketplace built for northern vehicle enthusiasts, bringing snowmobile, ATV, motocross bike and moped parts into one place.",
    cards: [
      { title: "Clear parts search", text: "Vehicle type, make, model, model year and category help buyers find the right part quickly." },
      { title: "User to user", text: "The service connects enthusiasts, dismantlers and companies without unnecessary middlemen." },
      { title: "For northern conditions", text: "The focus is on sports and vehicles where the right part can save the whole season." }
    ],
    sections: [
      {
        title: "Why does Maskines exist?",
        body: [
          "Buying and selling parts is often scattered across discussion groups, messages and old classifieds channels. Maskines gathers the parts together and makes listing clearer.",
          "The goal is that a good part does not stay forgotten in storage and the buyer gets the information they need before making contact."
        ]
      },
      {
        title: "What can be sold in the service?",
        body: ["The service is made especially for used and new spare parts, accessories and vehicle-related parts."],
        bullets: ["snowmobile parts", "ATV parts", "motocross and enduro parts", "moped parts and accessories"]
      },
      {
        title: "How do we keep the service clean?",
        body: [
          "Listings emphasize photos, compatibility, condition and clear seller information. Unclear, misleading or rule-breaking content can be removed.",
          "We improve the service based on practical feedback so buying and selling stays fast on mobile too."
        ]
      }
    ],
    summaryLabel: "About us - summary"
  },
  sv: {
    kicker: "Företag",
    title: "Om oss",
    lead: "Maskines är en reservdelsmarknad byggd för nordliga fordonsentusiaster, där delar till snöskotrar, fyrhjulingar, motocrosscyklar och mopeder finns på ett ställe.",
    cards: [
      { title: "Tydlig reservdelssökning", text: "Fordon, märke, modell, årsmodell och kategori hjälper köparen att snabbt hitta rätt del." },
      { title: "Från användare till användare", text: "Tjänsten kopplar samman entusiaster, demonteringsdelssäljare och företag utan onödiga mellanhänder." },
      { title: "För nordliga förhållanden", text: "Fokus ligger på grenar och fordon där rätt del kan rädda hela säsongen." }
    ],
    sections: [
      {
        title: "Varför finns Maskines?",
        body: [
          "Köp och försäljning av reservdelar är ofta utspritt i diskussionsgrupper, meddelanden och gamla annonskanaler. Maskines samlar delarna och gör annonseringen tydligare.",
          "Målet är att en bra del inte blir kvar längst in på lagret och att köparen får den information som behövs före kontakt."
        ]
      },
      {
        title: "Vad kan man sälja i tjänsten?",
        body: ["Tjänsten är särskilt gjord för begagnade och nya reservdelar, tillbehör samt fordonsrelaterade delar."],
        bullets: ["snöskoterdelar", "fyrhjulingsdelar", "motocross- och endurodelar", "mopeddelar och tillbehör"]
      },
      {
        title: "Hur håller vi tjänsten tydlig?",
        body: [
          "I annonser betonas bilder, kompatibilitet, skick och tydliga säljaruppgifter. Otydligt, vilseledande eller regelstridigt innehåll kan tas bort.",
          "Vi utvecklar tjänsten utifrån praktisk respons så att köp och försäljning är smidigt även på mobilen."
        ]
      }
    ],
    summaryLabel: "Om oss - sammanfattning"
  },
  no: {
    kicker: "Selskap",
    title: "Om oss",
    lead: "Maskines er en reservedelsmarkedsplass laget for nordlige kjøretøyentusiaster, der deler til snøscootere, ATV-er, motocrossykler og mopeder finnes på ett sted.",
    cards: [
      { title: "Tydelig delesøk", text: "Kjøretøy, merke, modell, årsmodell og kategori hjelper kjøperen med å finne riktig del raskt." },
      { title: "Fra bruker til bruker", text: "Tjenesten kobler entusiaster, deleselgere og bedrifter uten unødvendige mellomledd." },
      { title: "For nordlige forhold", text: "Fokuset er på grener og kjøretøy der riktig del kan redde hele sesongen." }
    ],
    sections: [
      {
        title: "Hvorfor finnes Maskines?",
        body: [
          "Kjøp og salg av reservedeler er ofte spredt i diskusjonsgrupper, meldinger og gamle annonsekanaler. Maskines samler delene og gjør annonsering tydeligere.",
          "Målet er at en god del ikke blir liggende bakerst på lageret, og at kjøperen får informasjonen som trengs før kontakt."
        ]
      },
      {
        title: "Hva kan selges i tjenesten?",
        body: ["Tjenesten er laget spesielt for brukte og nye reservedeler, tilbehør og kjøretøyrelaterte deler."],
        bullets: ["snøscooterdeler", "ATV-deler", "motocross- og endurodeler", "mopeddeler og tilbehør"]
      },
      {
        title: "Hvordan holder vi tjenesten ryddig?",
        body: [
          "I annonser vektlegges bilder, kompatibilitet, tilstand og tydelig selgerinformasjon. Uklart, villedende eller regelstridig innhold kan fjernes.",
          "Vi utvikler tjenesten basert på praktiske tilbakemeldinger, slik at kjøp og salg også er raskt på mobil."
        ]
      }
    ],
    summaryLabel: "Om oss - sammendrag"
  },
  et: {
    kicker: "Ettevõte",
    title: "Meist",
    lead: "Maskines on põhjamaistele sõidukihuvilistele loodud varuosade turg, kus mootorsaanide, ATV-de, motokrossirataste ja mopeedide osad on ühes kohas.",
    cards: [
      { title: "Selge varuosaotsing", text: "Sõiduk, mark, mudel, mudeliaasta ja kategooria aitavad ostjal õige osa kiiresti leida." },
      { title: "Kasutajalt kasutajale", text: "Teenus ühendab huvilised, lammutusosade müüjad ja ettevõtted ilma tarbetute vahendajateta." },
      { title: "Põhjamaa oludesse", text: "Fookus on aladel ja sõidukitel, kus õige osa võib päästa kogu sõiduhooaja." }
    ],
    sections: [
      {
        title: "Miks Maskines olemas on?",
        body: [
          "Varuosade ost ja müük on sageli laiali arutelugruppides, sõnumites ja vanades kuulutuskanalites. Maskines koondab osad kokku ja teeb kuulutamise selgemaks.",
          "Eesmärk on, et hea osa ei jääks lao tagumisse nurka ning ostja saaks enne ühendust võtmist vajaliku info."
        ]
      },
      {
        title: "Mida saab teenuses müüa?",
        body: ["Teenus on loodud eriti kasutatud ja uute varuosade, tarvikute ning sõidukitega seotud osade jaoks."],
        bullets: ["mootorsaani osad", "ATV osad", "motokrossi- ja enduroosad", "mopeediosad ja tarvikud"]
      },
      {
        title: "Kuidas hoiame teenuse korras?",
        body: [
          "Kuulutustes rõhutame pilte, sobivust, seisukorda ja selgeid müüjaandmeid. Ebaselge, eksitav või reeglitevastane sisu võidakse eemaldada.",
          "Arendame teenust praktilise tagasiside põhjal, et ostmine ja müümine oleks kiire ka mobiilis."
        ]
      }
    ],
    summaryLabel: "Meist - kokkuvõte"
  }
};

export default function AboutPage() {
  return <InfoPage copy={copy} />;
}
