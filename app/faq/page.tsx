"use client";

import {
  AlertTriangle,
  BarChart3,
  Box,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Edit3,
  Headphones,
  Mail,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  SquarePlus,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useLanguage } from "@/lib/i18n";
import { pagePath } from "@/lib/routes";

type TopicId = "buyer" | "seller" | "safety" | "general";

type HelpItem = {
  id: string;
  topic: TopicId;
  title: string;
  text: string;
  icon: LucideIcon;
  answer: string[];
};

type FaqItem = {
  id: string;
  topic: TopicId;
  question: string;
  answer: string;
};

const topicsFi: Array<{
  id: TopicId;
  title: string;
  text: string;
  icon: LucideIcon;
  tone: "orange" | "green" | "blue" | "amber";
}> = [
  {
    id: "buyer",
    title: "Ostajalle",
    text: "Löydä oikea osa ja varmista sopivuus ennen kauppaa.",
    icon: ShoppingCart,
    tone: "orange"
  },
  {
    id: "seller",
    title: "Myyjälle",
    text: "Tee ilmoitus, johon ostajan on helppo tarttua.",
    icon: Plus,
    tone: "green"
  },
  {
    id: "safety",
    title: "Turvallinen kauppa",
    text: "Tunnista riskit ja sovi kaupasta selkeästi.",
    icon: ShieldCheck,
    tone: "blue"
  },
  {
    id: "general",
    title: "Yleistä",
    text: "Nopeat vastaukset Maskinesin käyttöön.",
    icon: CircleHelp,
    tone: "amber"
  }
];

const buyerGuidesFi: HelpItem[] = [
  {
    id: "find-parts",
    topic: "buyer",
    title: "Löydä oikea varaosa",
    text: "Rajaa haku ajoneuvon ja osan mukaan.",
    icon: Search,
    answer: [
      "Aloita ajoneuvolajista ja rajaa haku tyypin, merkin, mallin sekä vuosimallin mukaan.",
      "Hae osan nimellä tai OEM-numerolla. Esimerkiksi \"Ski-Doo 850 variaattori\" antaa tarkemmat tulokset kuin pelkkä \"variaattori\".",
      "Tarkista ilmoituksesta kunto, osanumero, mitat ja sijainti. Pelkkä saman näköinen osa ei aina tarkoita, että se sopii."
    ]
  },
  {
    id: "contact-seller",
    topic: "buyer",
    title: "Varmista osan sopivuus",
    text: "Kysy nämä ennen kuin sovit kaupasta.",
    icon: MessageCircle,
    answer: [
      "Kerro myyjälle oman ajoneuvosi tarkka merkki, malli, vuosimalli ja tarvittaessa moottoriversio.",
      "Vertaa OEM-numeroa, kiinnityspisteitä ja mittoja. Pyydä lähikuvat liittimistä, kierteistä ja kuluvista pinnoista.",
      "Kysy suoraan vioista, korjauksista ja siitä, mistä ajoneuvosta osa on irrotettu. Tallenna sovitut asiat Maskines-viesteihin."
    ]
  },
  {
    id: "buy-safely",
    topic: "buyer",
    title: "Sovi kauppa selkeästi",
    text: "Hinta, maksu ja toimitus ilman arvailua.",
    icon: CreditCard,
    answer: [
      "Vahvista ennen maksua, mitä kauppaan kuuluu: tarkka osa, mahdolliset tarvikkeet, kokonaishinta ja toimituskulut.",
      "Arvokas tai vaikeasti tunnistettava osa kannattaa tarkistaa noudettaessa. Lähetykselle kannattaa pyytää seuranta ja riittävä pakkaus.",
      "Maskines ei vastaanota eikä välitä kauppasummaa. Ostaja ja myyjä sopivat maksutavan itse, joten valitse tapa, jonka ehdot tunnet."
    ]
  },
  {
    id: "track-order",
    topic: "buyer",
    title: "Kun osa lähetetään",
    text: "Seuranta, vastaanotto ja tarkastus.",
    icon: Box,
    answer: [
      "Pyydä myyjää lähettämään seurantakoodi ja kuva valmiiksi pakatusta lähetyksestä.",
      "Tarkista paketin kunto heti vastaanottaessa. Kuvaa vaurioitunut pakkaus ennen avaamista ja kuvaa myös osa.",
      "Jos lähetys ei liiku tai sisältö poikkeaa sovitusta, ota ensin yhteys myyjään ja tarvittaessa kuljetusyhtiöön."
    ]
  }
];

const sellerGuidesFi: HelpItem[] = [
  {
    id: "create-listing",
    topic: "seller",
    title: "Tee löydettävä ilmoitus",
    text: "Oikea ajoneuvo, osa ja otsikko.",
    icon: SquarePlus,
    answer: [
      "Valitse ajoneuvolaji, tyyppi, merkki, malli ja osakategoria mahdollisimman tarkasti. Näitä tietoja käytetään haun rajauksissa.",
      "Kirjoita otsikkoon osa ja tärkein sopivuustieto, esimerkiksi \"KTM 125 EXC 2020 takaiskari\".",
      "Lisää realistinen hinta, sijainti, kunto, OEM-numero ja tiedossa olevat yhteensopivat vuosimallit."
    ]
  },
  {
    id: "many-parts",
    topic: "seller",
    title: "Kuvat ja kuntotiedot",
    text: "Näytä ostajalle myös käytön jäljet.",
    icon: BarChart3,
    answer: [
      "Kuvaa osa päivänvalossa useasta suunnasta. Ensimmäisen kuvan pitää näyttää myytävä osa kokonaan.",
      "Lisää lähikuva osanumerosta, liittimistä, kiinnityksistä ja kulumista. Älä rajaa vikaa kuvan ulkopuolelle.",
      "Kerro kuvauksessa rehellisesti halkeamat, välykset, hitsaukset, puuttuvat osat ja se, onko toimintaa testattu."
    ]
  },
  {
    id: "edit-listing",
    topic: "seller",
    title: "Myy useita osia",
    text: "Pidä jokainen osa ja hinta selkeänä.",
    icon: Edit3,
    answer: [
      "Käytä usean ilmoituksen toimintoa, kun purat samasta ajoneuvosta monta erikseen myytävää osaa.",
      "Anna jokaiselle osalle oma nimi, hinta, kunto ja sitä vastaavat kuvat. Älä niputa eri osien tietoja yhteen.",
      "Samat ajoneuvotiedot voidaan hyödyntää kaikissa erän ilmoituksissa, mutta tarkista jokainen osa ennen julkaisua."
    ]
  },
  {
    id: "manage-sales",
    topic: "seller",
    title: "Pidä myynti ajan tasalla",
    text: "Vastaa, päivitä ja merkitse myydyksi.",
    icon: PackageCheck,
    answer: [
      "Vastaa sopivuus- ja kuntokysymyksiin samoilla tiedoilla, jotka pystyt myös näyttämään kuvista tai osanumerosta.",
      "Päivitä hintaa, kuvia ja kuvausta, jos saat ilmoituksen jälkeen uutta tietoa osasta.",
      "Merkitse osa myydyksi heti kaupan valmistuttua. Näin ostajat eivät kysy tuotteesta, jota ei enää ole."
    ]
  }
];

const safetyGuidesFi: HelpItem[] = [
  {
    id: "safe-payment",
    topic: "safety",
    title: "Tarkista ennen maksua",
    text: "Pieni tarkistus voi estää ison vahingon.",
    icon: ShieldCheck,
    answer: [
      "Vertaa ilmoituksen kuvia, kuvausta, hintaa ja myyjän vastauksia. Selvästi markkinahintaa halvempi osa vaatii tavallista tarkemman selvityksen.",
      "Varmista myyjän nimi, puhelinnumero, paikkakunta ja se, että hän pystyy ottamaan pyydetyn lisäkuvan osasta.",
      "Älä maksa kiireen tai painostuksen vuoksi. Kalliissa kaupassa nouto tai ostajansuojaa tarjoava maksutapa pienentää riskiä."
    ]
  },
  {
    id: "suspicious-listing",
    topic: "safety",
    title: "Tunnista epäilyttävä toiminta",
    text: "Keskeytä kauppa, jos tiedot eivät täsmää.",
    icon: AlertTriangle,
    answer: [
      "Varoitusmerkkejä ovat kopioidut kuvat, epäselvä omistajuus, vaihtuvat maksutiedot ja kieltäytyminen lisäkuvista tai noudosta.",
      "Keskeytä maksaminen ja säilytä ilmoituksen linkki, viestit, maksutiedot sekä kuvakaappaukset.",
      "Lähetä tiedot Maskinesin tukeen. Voimme tarkistaa käyttäjän ja ilmoituksen, mutta emme ratkaise osapuolten välistä maksuriitaa."
    ]
  }
];

const faqItemsFi: FaqItem[] = [
  {
    id: "cost",
    topic: "general",
    question: "Maksaako Maskinesin käyttäminen?",
    answer:
      "Ilmoitusten selaaminen ja puhelinnumeron katsominen on maksutonta. Viestien lähettäminen ja omien ilmoitusten hallinta vaatii kirjautumisen. Mahdollisen maksullisen lisänäkyvyyden tai ilmoituspaikan hinta näytetään aina ennen vahvistamista."
  },
  {
    id: "buyer-free",
    topic: "buyer",
    question: "Miten varmistan, että osa sopii ajoneuvooni?",
    answer:
      "Vertaa OEM-numeroa, ajoneuvon tarkkaa mallia ja vuosimallia sekä osan mittoja ja liitäntöjä. Lähetä myyjälle tarvittaessa kuva vanhasta osasta. Lopullinen sopivuus kannattaa varmistaa ennen maksua, sillä saman mallisarjan osissa voi olla vuosimallikohtaisia eroja."
  },
  {
    id: "publish",
    topic: "seller",
    question: "Mitä hyvässä ilmoituksessa pitää olla?",
    answer:
      "Hyvä ilmoitus sisältää oikean ajoneuvo- ja osakategorian, selkeän otsikon, aidot kuvat, hinnan, sijainnin, kunnon, OEM-numeron sekä kaikki tiedossa olevat viat. Kerro myös, mistä ajoneuvosta osa on irrotettu ja onko sen toiminta testattu."
  },
  {
    id: "multi-parts",
    topic: "seller",
    question: "Voinko ilmoittaa monta osaa samasta ajoneuvosta?",
    answer:
      "Kyllä. Valitse usean ilmoituksen toiminto, lisää yhteiset ajoneuvotiedot kerran ja täytä jokaiselle osalle oma hinta, kunto, kuvaus ja kuvat. Näin jokainen osa löytyy hausta erillisenä ilmoituksena."
  },
  {
    id: "messages-payments",
    topic: "safety",
    question: "Kulkeeko maksu Maskinesin kautta?",
    answer:
      "Ei. Maskines toimii ilmoitus- ja yhteydenottopalveluna, eikä säilytä tai välitä kauppasummaa. Ostaja ja myyjä sopivat maksun, noudon ja toimituksen keskenään. Käytä maksutapaa, jonka ehdot ja mahdollisen ostajansuojan tunnet."
  },
  {
    id: "bad-part",
    topic: "buyer",
    question: "Mitä teen, jos osa ei vastaa sovittua?",
    answer:
      "Älä asenna tai muokkaa osaa ennen asian selvittämistä. Kuvaa pakkaus, osa, osanumero ja havaittu ero. Ota heti yhteys myyjään Maskines-viestillä ja ehdota ratkaisua. Jos asia ei ratkea, lähetä tuelle ilmoituksen linkki, kuvat ja viestihistoria."
  },
  {
    id: "seller-response",
    topic: "buyer",
    question: "Mitä teen, jos myyjä ei vastaa?",
    answer:
      "Anna myyjälle kohtuullinen aika vastata ja kokeile ilmoituksessa näkyvää puhelinnumeroa. Älä lähetä maksua ennen kuin osan saatavuus, sopivuus ja kaupan ehdot on vahvistettu. Jos ilmoitus vaikuttaa vanhentuneelta tai epäilyttävältä, ilmoita siitä tuelle."
  },
  {
    id: "edit-or-sold",
    topic: "seller",
    question: "Miten muokkaan tai poistan ilmoituksen?",
    answer:
      "Avaa Oma talli tai Omat ilmoitukset, valitse kyseinen ilmoitus ja avaa muokkaus. Päivitä muuttuneet tiedot heti. Kun osa on myyty, merkitse se myydyksi tai poista ilmoitus, jotta ostajat eivät ota turhaan yhteyttä."
  },
  {
    id: "report-listing",
    topic: "safety",
    question: "Miten ilmoitan epäilyttävästä ilmoituksesta?",
    answer:
      "Keskeytä kaupanteko ja ota talteen ilmoituksen linkki sekä olennaiset viestit. Lähetä ne Maskinesin yhteydenottosivun kautta tai osoitteeseen info@maskines.com. Kerro lyhyesti, mikä ilmoituksessa tai yhteydenpidossa herätti epäilyn."
  }
];

const topicsNo: typeof topicsFi = [
  {
    id: "buyer",
    title: "For kjøpere",
    text: "Finn riktig del og kontroller at den passer før kjøpet.",
    icon: ShoppingCart,
    tone: "orange"
  },
  {
    id: "seller",
    title: "For selgere",
    text: "Lag en annonse som gjør det enkelt for kjøperen å ta kontakt.",
    icon: Plus,
    tone: "green"
  },
  {
    id: "safety",
    title: "Trygg handel",
    text: "Gjenkjenn risiko og avtal handelen tydelig.",
    icon: ShieldCheck,
    tone: "blue"
  },
  {
    id: "general",
    title: "Generelt",
    text: "Raske svar om hvordan du bruker Maskines.",
    icon: CircleHelp,
    tone: "amber"
  }
];

const buyerGuidesNo: HelpItem[] = [
  {
    id: "find-parts",
    topic: "buyer",
    title: "Finn riktig reservedel",
    text: "Avgrens søket etter kjøretøy og del.",
    icon: Search,
    answer: [
      "Begynn med kjøretøygruppen, og avgrens søket etter type, merke, modell og årsmodell.",
      "Søk etter delens navn eller OEM-nummer. For eksempel gir «Ski-Doo 850 variator» mer presise treff enn bare «variator».",
      "Kontroller tilstand, delenummer, mål og plassering i annonsen. At en del ser lik ut, betyr ikke alltid at den passer."
    ]
  },
  {
    id: "contact-seller",
    topic: "buyer",
    title: "Kontroller at delen passer",
    text: "Spør om dette før du avtaler kjøpet.",
    icon: MessageCircle,
    answer: [
      "Oppgi nøyaktig merke, modell og årsmodell på kjøretøyet ditt, og eventuelt motorversjon.",
      "Sammenlign OEM-nummeret, festepunktene og målene. Be om nærbilder av kontakter, gjenger og sliteflater.",
      "Spør konkret om feil, reparasjoner og hvilket kjøretøy delen er demontert fra. Ta vare på det dere avtaler i Maskines-meldingene."
    ]
  },
  {
    id: "buy-safely",
    topic: "buyer",
    title: "Avtal handelen tydelig",
    text: "Pris, betaling og levering uten uklarheter.",
    icon: CreditCard,
    answer: [
      "Bekreft før betaling hva handelen omfatter: den nøyaktige delen, eventuelt tilbehør, totalpris og fraktkostnader.",
      "En verdifull eller vanskelig identifiserbar del bør kontrolleres ved henting. Ved sending bør du be om sporing og forsvarlig emballasje.",
      "Maskines mottar eller formidler ikke kjøpesummen. Kjøper og selger avtaler betalingsmåten selv, så velg en metode du kjenner vilkårene for."
    ]
  },
  {
    id: "track-order",
    topic: "buyer",
    title: "Når delen sendes",
    text: "Sporing, mottak og kontroll.",
    icon: Box,
    answer: [
      "Be selgeren sende sporingsnummeret og et bilde av den ferdig innpakkede forsendelsen.",
      "Kontroller pakkens tilstand med en gang du mottar den. Fotografer skadet emballasje før du åpner pakken, og fotografer også delen.",
      "Hvis forsendelsen ikke beveger seg eller innholdet avviker fra avtalen, kontakter du først selgeren og deretter transportselskapet ved behov."
    ]
  }
];

const sellerGuidesNo: HelpItem[] = [
  {
    id: "create-listing",
    topic: "seller",
    title: "Lag en annonse som er lett å finne",
    text: "Riktig kjøretøy, del og overskrift.",
    icon: SquarePlus,
    answer: [
      "Velg kjøretøygruppe, type, merke, modell og delkategori så presist som mulig. Disse opplysningene brukes i søkefiltrene.",
      "Skriv delen og den viktigste informasjonen om kompatibilitet i overskriften, for eksempel «KTM 125 EXC 2020 bakdemper».",
      "Legg til en realistisk pris, plassering, tilstand, OEM-nummer og alle kompatible årsmodeller du kjenner til."
    ]
  },
  {
    id: "many-parts",
    topic: "seller",
    title: "Bilder og opplysninger om tilstand",
    text: "Vis også kjøperen spor etter bruk.",
    icon: BarChart3,
    answer: [
      "Fotografer delen i dagslys fra flere vinkler. Det første bildet skal vise hele delen som er til salgs.",
      "Legg til nærbilder av delenummer, kontakter, fester og slitasje. Ikke skjul en feil ved å beskjære den ut av bildet.",
      "Opplys ærlig om sprekker, slark, sveising, manglende deler og om funksjonen er testet."
    ]
  },
  {
    id: "edit-listing",
    topic: "seller",
    title: "Selg flere deler",
    text: "Hold hver del og pris tydelig adskilt.",
    icon: Edit3,
    answer: [
      "Bruk funksjonen for flere annonser når du demonterer mange deler fra samme kjøretøy og selger dem enkeltvis.",
      "Gi hver del et eget navn, pris, tilstand og tilhørende bilder. Ikke bland opplysninger om ulike deler.",
      "De samme kjøretøyopplysningene kan brukes i alle annonsene i partiet, men kontroller hver del før publisering."
    ]
  },
  {
    id: "manage-sales",
    topic: "seller",
    title: "Hold salget oppdatert",
    text: "Svar, oppdater og marker som solgt.",
    icon: PackageCheck,
    answer: [
      "Svar på spørsmål om kompatibilitet og tilstand med opplysninger du også kan dokumentere med bilder eller delenummer.",
      "Oppdater pris, bilder og beskrivelse hvis du får ny informasjon om delen etter at annonsen er publisert.",
      "Marker delen som solgt med en gang handelen er fullført. Da slipper kjøpere å spørre om en vare som ikke lenger er tilgjengelig."
    ]
  }
];

const safetyGuidesNo: HelpItem[] = [
  {
    id: "safe-payment",
    topic: "safety",
    title: "Kontroller før betaling",
    text: "En liten kontroll kan forhindre et stort tap.",
    icon: ShieldCheck,
    answer: [
      "Sammenlign bildene, beskrivelsen, prisen og selgerens svar. En del som er klart billigere enn markedsprisen, krever ekstra grundig kontroll.",
      "Kontroller selgerens navn, telefonnummer og sted, og at selgeren kan ta et nytt bilde av delen slik du ber om.",
      "Ikke betal på grunn av hastverk eller press. Ved dyre kjøp reduserer henting eller en betalingsmåte med kjøperbeskyttelse risikoen."
    ]
  },
  {
    id: "suspicious-listing",
    topic: "safety",
    title: "Gjenkjenn mistenkelig aktivitet",
    text: "Avbryt handelen hvis opplysningene ikke stemmer.",
    icon: AlertTriangle,
    answer: [
      "Varseltegn er kopierte bilder, uklart eierskap, betalingsopplysninger som endres, og at selgeren nekter å sende flere bilder eller avtale henting.",
      "Stans betalingen, og ta vare på lenken til annonsen, meldingene, betalingsopplysningene og skjermbilder.",
      "Send opplysningene til Maskines kundestøtte. Vi kan kontrollere brukeren og annonsen, men vi avgjør ikke betalingstvister mellom partene."
    ]
  }
];

const faqItemsNo: FaqItem[] = [
  {
    id: "cost",
    topic: "general",
    question: "Koster det å bruke Maskines?",
    answer:
      "Det er gratis å bla i annonser og se telefonnummer. Du må logge inn for å sende meldinger og administrere egne annonser. Prisen for eventuell betalt ekstra synlighet eller annonseplass vises alltid før du bekrefter."
  },
  {
    id: "buyer-free",
    topic: "buyer",
    question: "Hvordan kontrollerer jeg at delen passer til kjøretøyet mitt?",
    answer:
      "Sammenlign OEM-nummeret, nøyaktig kjøretøymodell og årsmodell samt delens mål og tilkoblinger. Send selgeren et bilde av den gamle delen ved behov. Kontroller kompatibiliteten før betaling, fordi deler i samme modellserie kan variere mellom årsmodeller."
  },
  {
    id: "publish",
    topic: "seller",
    question: "Hva bør en god annonse inneholde?",
    answer:
      "En god annonse inneholder riktig kjøretøy- og delkategori, en tydelig overskrift, ekte bilder, pris, plassering, tilstand, OEM-nummer og alle kjente feil. Opplys også hvilket kjøretøy delen er demontert fra, og om funksjonen er testet."
  },
  {
    id: "multi-parts",
    topic: "seller",
    question: "Kan jeg legge ut flere deler fra samme kjøretøy?",
    answer:
      "Ja. Velg funksjonen for flere annonser, legg inn de felles kjøretøyopplysningene én gang, og fyll ut egen pris, tilstand, beskrivelse og bilder for hver del. Da vises hver del som en egen annonse i søket."
  },
  {
    id: "messages-payments",
    topic: "safety",
    question: "Går betalingen gjennom Maskines?",
    answer:
      "Nei. Maskines er en tjeneste for annonser og kontakt, og oppbevarer eller formidler ikke kjøpesummen. Kjøper og selger avtaler betaling, henting og levering seg imellom. Bruk en betalingsmåte der du kjenner vilkårene og eventuell kjøperbeskyttelse."
  },
  {
    id: "bad-part",
    topic: "buyer",
    question: "Hva gjør jeg hvis delen ikke er som avtalt?",
    answer:
      "Ikke monter eller endre delen før saken er avklart. Fotografer emballasjen, delen, delenummeret og avviket. Kontakt selgeren umiddelbart via Maskines-meldinger og foreslå en løsning. Hvis saken ikke løses, sender du kundestøtten lenken til annonsen, bildene og meldingshistorikken."
  },
  {
    id: "seller-response",
    topic: "buyer",
    question: "Hva gjør jeg hvis selgeren ikke svarer?",
    answer:
      "Gi selgeren rimelig tid til å svare, og prøv telefonnummeret i annonsen. Ikke send betaling før delens tilgjengelighet, kompatibilitet og vilkårene for handelen er bekreftet. Rapporter annonsen til kundestøtten hvis den virker utdatert eller mistenkelig."
  },
  {
    id: "edit-or-sold",
    topic: "seller",
    question: "Hvordan redigerer eller sletter jeg en annonse?",
    answer:
      "Åpne Min garasje eller Mine annonser, velg den aktuelle annonsen og åpne redigeringen. Oppdater endrede opplysninger med en gang. Når delen er solgt, markerer du den som solgt eller sletter annonsen, slik at kjøpere ikke tar unødvendig kontakt."
  },
  {
    id: "report-listing",
    topic: "safety",
    question: "Hvordan rapporterer jeg en mistenkelig annonse?",
    answer:
      "Avbryt handelen, og ta vare på lenken til annonsen og relevante meldinger. Send dem via kontaktsiden til Maskines eller til info@maskines.com. Forklar kort hva ved annonsen eller kontakten som gjorde deg mistenksom."
  }
];

const pageText = {
  fi: {
    kicker: "Maskines ohjekeskus",
    title: "Ohjeet",
    intro: "Käytännön ohjeet varaosan löytämiseen, myymiseen ja turvalliseen kaupankäyntiin.",
    chooseTopic: "Valitse aihe",
    buyerGuidesTitle: "Ostajan ohjeet",
    sellerGuidesTitle: "Myyjän ohjeet",
    safetyGuidesTitle: "Turvallisen kaupan ohjeet",
    frequentlyAsked: "Usein kysytyt kysymykset",
    supportTitle: "Tarvitsetko apua?",
    supportText: "Kerro ilmoituksen linkki ja mitä olit tekemässä, niin pääsemme nopeammin asiaan.",
    contactTitle: "Ota yhteyttä",
    contactText: "Lähetä viesti",
    email: "Sähköposti"
  },
  no: {
    kicker: "Maskines hjelpesenter",
    title: "Hjelp",
    intro: "Praktiske veiledninger for å finne og selge reservedeler og handle trygt.",
    chooseTopic: "Velg tema",
    buyerGuidesTitle: "Veiledning for kjøpere",
    sellerGuidesTitle: "Veiledning for selgere",
    safetyGuidesTitle: "Veiledning for trygg handel",
    frequentlyAsked: "Ofte stilte spørsmål",
    supportTitle: "Trenger du hjelp?",
    supportText: "Send lenken til annonsen og fortell hva du prøvde å gjøre, så kan vi hjelpe deg raskere.",
    contactTitle: "Kontakt oss",
    contactText: "Send en melding",
    email: "E-post"
  }
} as const;

const faqContent = {
  fi: {
    ...pageText.fi,
    topics: topicsFi,
    buyerGuides: buyerGuidesFi,
    sellerGuides: sellerGuidesFi,
    safetyGuides: safetyGuidesFi,
    faqItems: faqItemsFi
  },
  no: {
    ...pageText.no,
    topics: topicsNo,
    buyerGuides: buyerGuidesNo,
    sellerGuides: sellerGuidesNo,
    safetyGuides: safetyGuidesNo,
    faqItems: faqItemsNo
  }
} as const;

export default function FaqPage() {
  const { locale } = useLanguage();
  const [activeTopic, setActiveTopic] = useState<TopicId>("buyer");
  const copy = faqContent[locale === "no" ? "no" : "fi"];
  const primaryGuideItems =
    activeTopic === "seller"
      ? copy.sellerGuides
      : activeTopic === "safety"
        ? copy.safetyGuides
        : copy.buyerGuides;
  const primaryGuideTitle =
    activeTopic === "seller"
      ? copy.sellerGuidesTitle
      : activeTopic === "safety"
        ? copy.safetyGuidesTitle
        : copy.buyerGuidesTitle;
  const secondaryGuideItems = activeTopic === "seller" ? copy.buyerGuides : copy.sellerGuides;
  const secondaryGuideTitle = activeTopic === "seller" ? copy.buyerGuidesTitle : copy.sellerGuidesTitle;

  const visibleFaqs = useMemo(() => {
    return copy.faqItems.filter((item) => {
      return activeTopic === "general" ? true : item.topic === activeTopic || item.topic === "general";
    });
  }, [activeTopic, copy.faqItems]);

  function chooseTopic(topic: TopicId) {
    setActiveTopic(topic);
    document.getElementById("ohjeet")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main
      className="help-page"
      data-no-auto-translate={locale === "no" ? "true" : undefined}
      translate={locale === "no" ? "no" : undefined}
    >
      <section className="help-hero">
        <div className="help-shell help-hero-inner">
          <div>
            <span className="help-kicker">{copy.kicker}</span>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
          </div>
        </div>
      </section>

      <section className="help-body">
        <div className="help-shell">
          <h2>{copy.chooseTopic}</h2>
          <div className="help-topic-grid">
            {copy.topics.map((topic) => {
              const Icon = topic.icon;
              const selected = activeTopic === topic.id;

              return (
                <button
                  className="help-topic-card"
                  data-active={selected ? "true" : "false"}
                  data-topic={topic.id}
                  data-tone={topic.tone}
                  key={topic.id}
                  type="button"
                  onClick={() => chooseTopic(topic.id)}
                >
                  <span className="help-topic-icon">
                    <Icon size={26} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{topic.title}</strong>
                    <small>{topic.text}</small>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <div className="help-columns" id="ohjeet">
            <HelpColumn
              title={primaryGuideTitle}
              items={primaryGuideItems}
            />
            <HelpColumn
              title={secondaryGuideTitle}
              items={secondaryGuideItems}
            />
            <section className="help-column">
              <h3>{copy.frequentlyAsked}</h3>
              <div className="help-faq-list">
                {visibleFaqs.map((item) => {
                  return (
                    <details className="help-faq-item" key={item.id}>
                      <summary data-faq-id={item.id}>
                        <span>{item.question}</span>
                        <ChevronRight size={17} aria-hidden="true" />
                      </summary>
                      <p>{item.answer}</p>
                    </details>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="help-support">
            <div className="help-support-main">
              <span>
                <Headphones size={28} aria-hidden="true" />
              </span>
              <div>
                <strong>{copy.supportTitle}</strong>
                <small>{copy.supportText}</small>
              </div>
            </div>
            <Link href={pagePath("contact", locale)}>
              <MessageCircle size={25} aria-hidden="true" />
              <span>
                <strong>{copy.contactTitle}</strong>
                <small>{copy.contactText}</small>
              </span>
            </Link>
            <a href="mailto:info@maskines.com">
              <Mail size={25} aria-hidden="true" />
              <span>
                <strong>{copy.email}</strong>
                <small>info@maskines.com</small>
              </span>
            </a>
          </section>
        </div>
      </section>
    </main>
  );
}

function HelpColumn({
  title,
  items
}: {
  title: string;
  items: HelpItem[];
}) {
  return (
    <section className="help-column">
      <h3>{title}</h3>
      <div className="help-guide-list">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <details className="help-guide-entry" key={item.title}>
              <summary
                className="help-guide-item"
              >
                <Icon size={19} aria-hidden="true" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.text}</small>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </summary>
              <ol className="help-guide-answer">
                {item.answer.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </details>
          );
        })}
      </div>
    </section>
  );
}
