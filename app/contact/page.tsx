import InfoPage, { type InfoPageCopy } from "@/app/components/InfoPage";
import type { Locale } from "@/lib/i18n";

const sharedActions = [
  { href: "mailto:info@arcticparts.fi", label: "info@arcticparts.fi", primary: true },
  { href: "https://www.instagram.com/maskines1/", label: "Instagram", external: true },
  { href: "https://www.facebook.com/profile.php?id=61590753577719&locale=fi_FI", label: "Facebook", external: true }
];

const copy: Record<Locale, InfoPageCopy> = {
  fi: {
    kicker: "Ota yhteyttä",
    title: "Yhteys Maskinesiin",
    lead: "Autamme palvelun käyttöön, ilmoituksiin, käyttäjätiliin ja turvallisuuteen liittyvissä asioissa. Laita viesti, niin katsotaan asia kuntoon.",
    actions: sharedActions,
    cards: [
      { title: "Tuki", text: "Kysymykset kirjautumisesta, ilmoituksista, profiilista ja viesteistä." },
      { title: "Turvallisuus", text: "Ilmoita epäilyttävästä ilmoituksesta, viestistä tai maksupyyntöön liittyvästä riskistä." },
      { title: "Yritykset", text: "Yritystilit, varaosavarastot ja näkyvyyteen liittyvät kysymykset." }
    ],
    sections: [
      {
        title: "Mitä viestiin kannattaa laittaa?",
        body: ["Saat nopeamman vastauksen, kun kerrot heti mihin ilmoitukseen, tiliin tai toimintoon asia liittyy."],
        bullets: ["oma sähköpostiosoite", "ilmoituksen linkki tai otsikko", "kuvaus ongelmasta", "mahdollinen kuvakaappaus"]
      },
      {
        title: "Sosiaalinen media",
        body: ["Instagramissa ja Facebookissa kerromme palvelun etenemisestä, uusista ominaisuuksista ja ajankohtaisista asioista. Kiireellisissä tuki- ja tietosuoja-asioissa sähköposti on varmin kanava."]
      }
    ],
    summaryLabel: "Yhteys Maskinesiin - yhteenveto"
  },
  en: {
    kicker: "Contact",
    title: "Contact Maskines",
    lead: "We help with questions about using the service, listings, user accounts and safety. Send us a message and we will sort it out.",
    actions: sharedActions,
    cards: [
      { title: "Support", text: "Questions about login, listings, profiles and messages." },
      { title: "Safety", text: "Report a suspicious listing, message or payment-related risk." },
      { title: "Companies", text: "Questions about business accounts, parts inventories and visibility." }
    ],
    sections: [
      {
        title: "What should you include in the message?",
        body: ["You will get a faster answer when you tell us right away which listing, account or feature the issue concerns."],
        bullets: ["your email address", "listing link or title", "description of the issue", "possible screenshot"]
      },
      {
        title: "Social media",
        body: ["On Instagram and Facebook we share service updates, new features and current news. For urgent support and privacy matters, email is the most reliable channel."]
      }
    ],
    summaryLabel: "Contact Maskines - summary"
  },
  sv: {
    kicker: "Kontakt",
    title: "Kontakta Maskines",
    lead: "Vi hjälper med frågor om tjänsten, annonser, användarkonton och säkerhet. Skicka ett meddelande så reder vi ut saken.",
    actions: sharedActions,
    cards: [
      { title: "Support", text: "Frågor om inloggning, annonser, profil och meddelanden." },
      { title: "Säkerhet", text: "Anmäl en misstänkt annons, ett meddelande eller en risk kopplad till betalning." },
      { title: "Företag", text: "Frågor om företagskonton, reservdelslager och synlighet." }
    ],
    sections: [
      {
        title: "Vad bör du skriva i meddelandet?",
        body: ["Du får snabbare svar när du direkt berättar vilken annons, vilket konto eller vilken funktion ärendet gäller."],
        bullets: ["din e-postadress", "annonsens länk eller rubrik", "beskrivning av problemet", "eventuell skärmbild"]
      },
      {
        title: "Sociala medier",
        body: ["På Instagram och Facebook berättar vi om tjänstens utveckling, nya funktioner och aktuella nyheter. Vid brådskande support- och dataskyddsärenden är e-post den säkraste kanalen."]
      }
    ],
    summaryLabel: "Kontakta Maskines - sammanfattning"
  },
  no: {
    kicker: "Kontakt",
    title: "Kontakt Maskines",
    lead: "Vi hjelper med spørsmål om bruk av tjenesten, annonser, brukerkontoer og sikkerhet. Send en melding, så finner vi ut av det.",
    actions: sharedActions,
    cards: [
      { title: "Støtte", text: "Spørsmål om innlogging, annonser, profil og meldinger." },
      { title: "Sikkerhet", text: "Rapporter en mistenkelig annonse, melding eller risiko knyttet til betaling." },
      { title: "Bedrifter", text: "Spørsmål om bedriftskontoer, reservedelslager og synlighet." }
    ],
    sections: [
      {
        title: "Hva bør meldingen inneholde?",
        body: ["Du får raskere svar når du med en gang forteller hvilken annonse, konto eller funksjon saken gjelder."],
        bullets: ["din e-postadresse", "annonsekobling eller tittel", "beskrivelse av problemet", "eventuelt skjermbilde"]
      },
      {
        title: "Sosiale medier",
        body: ["På Instagram og Facebook deler vi fremdrift, nye funksjoner og aktuelle nyheter. Ved hastesaker om støtte og personvern er e-post den sikreste kanalen."]
      }
    ],
    summaryLabel: "Kontakt Maskines - sammendrag"
  },
  et: {
    kicker: "Võta ühendust",
    title: "Kontakt Maskinesiga",
    lead: "Aitame teenuse kasutamise, kuulutuste, kasutajakonto ja turvalisusega seotud küsimustes. Saada sõnum ja vaatame asja korda.",
    actions: sharedActions,
    cards: [
      { title: "Tugi", text: "Küsimused sisselogimise, kuulutuste, profiili ja sõnumite kohta." },
      { title: "Turvalisus", text: "Teata kahtlasest kuulutusest, sõnumist või makseriskist." },
      { title: "Ettevõtted", text: "Küsimused ärikontode, varuosalao ja nähtavuse kohta." }
    ],
    sections: [
      {
        title: "Mida tasub sõnumisse lisada?",
        body: ["Saad kiirema vastuse, kui ütled kohe, millise kuulutuse, konto või funktsiooniga asi seotud on."],
        bullets: ["oma e-posti aadress", "kuulutuse link või pealkiri", "probleemi kirjeldus", "võimalik kuvatõmmis"]
      },
      {
        title: "Sotsiaalmeedia",
        body: ["Instagramis ja Facebookis jagame infot teenuse arengu, uute funktsioonide ja aktuaalsete teemade kohta. Kiiretes tugi- ja privaatsusasjades on e-post kindlaim kanal."]
      }
    ],
    summaryLabel: "Kontakt Maskinesiga - kokkuvõte"
  }
};

export default function ContactPage() {
  return <InfoPage copy={copy} />;
}
