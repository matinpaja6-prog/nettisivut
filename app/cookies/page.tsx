import InfoPage, { type InfoPageCopy } from "@/app/components/InfoPage";
import type { Locale } from "@/lib/i18n";

const copy: Record<Locale, InfoPageCopy> = {
  fi: {
    kicker: "Tietosuoja",
    title: "Evästeet",
    lead: "Maskines käyttää välttämättömiä evästeitä ja selaimen paikallista tallennusta, jotta kirjautuminen, kielivalinta, turvallisuus ja palvelun perustoiminnot toimivat.",
    cards: [
      { title: "Välttämättömät", text: "Kirjautuminen, istunto, kieli ja palvelun turvallisuus tarvitsevat teknistä tallennusta." },
      { title: "Käyttökokemus", text: "Muistamme valintoja, jotta sivu latautuu sujuvammin ja näyttää oikealta myös seuraavalla käynnillä." },
      { title: "Ei tietojen myyntiä", text: "Evästeitä ei käytetä henkilötietojen myymiseen." }
    ],
    sections: [
      { title: "Mihin evästeitä käytetään?", body: ["Evästeet ja paikallinen tallennus auttavat pitämään palvelun käytettävänä ja turvallisena."], bullets: ["kirjautumisen ja istunnon ylläpito", "kielivalinnan muistaminen", "admin-paneelissa hallittavan ulkoasun lataaminen nopeasti", "väärinkäytösten estäminen ja tekninen vianhaku"] },
      { title: "Voiko evästeet estää?", body: ["Selaimen asetuksista voi rajoittaa evästeitä, mutta välttämättömien evästeiden estäminen voi rikkoa kirjautumisen, viestit tai muut palvelun perustoiminnot."] },
      { title: "Lisätiedot", body: ["Henkilötietojen käsittelystä kerrotaan tarkemmin tietosuojaselosteessa. Käyttöehdoissa kuvataan palvelun käytön säännöt."] }
    ],
    actions: [{ href: "/privacy", label: "Tietosuoja", primary: true }, { href: "/terms", label: "Käyttöehdot" }],
    summaryLabel: "Evästeet - yhteenveto"
  },
  en: {
    kicker: "Privacy",
    title: "Cookies",
    lead: "Maskines uses essential cookies and browser local storage so login, language selection, security and core service features work.",
    cards: [
      { title: "Essential", text: "Login, session, language and service security require technical storage." },
      { title: "User experience", text: "We remember choices so the page loads more smoothly and looks right on the next visit too." },
      { title: "No data sale", text: "Cookies are not used to sell personal data." }
    ],
    sections: [
      { title: "What are cookies used for?", body: ["Cookies and local storage help keep the service usable and secure."], bullets: ["maintaining login and session", "remembering language selection", "quickly loading the appearance managed in the admin panel", "preventing abuse and technical troubleshooting"] },
      { title: "Can cookies be blocked?", body: ["You can limit cookies in your browser settings, but blocking essential cookies may break login, messages or other core service features."] },
      { title: "More information", body: ["Personal data processing is described in more detail in the privacy policy. The terms of use describe the rules for using the service."] }
    ],
    actions: [{ href: "/privacy", label: "Privacy", primary: true }, { href: "/terms", label: "Terms" }],
    summaryLabel: "Cookies - summary"
  },
  sv: {
    kicker: "Dataskydd",
    title: "Cookies",
    lead: "Maskines använder nödvändiga cookies och lokal lagring i webbläsaren så att inloggning, språkval, säkerhet och tjänstens grundfunktioner fungerar.",
    cards: [
      { title: "Nödvändiga", text: "Inloggning, session, språk och tjänstens säkerhet kräver teknisk lagring." },
      { title: "Användarupplevelse", text: "Vi minns val så att sidan laddas smidigare och visas rätt även vid nästa besök." },
      { title: "Ingen försäljning av data", text: "Cookies används inte för att sälja personuppgifter." }
    ],
    sections: [
      { title: "Vad används cookies till?", body: ["Cookies och lokal lagring hjälper till att hålla tjänsten användbar och säker."], bullets: ["upprätthålla inloggning och session", "minnas språkval", "snabbt ladda utseendet som hanteras i adminpanelen", "förhindra missbruk och teknisk felsökning"] },
      { title: "Kan cookies blockeras?", body: ["Du kan begränsa cookies i webbläsarens inställningar, men blockering av nödvändiga cookies kan störa inloggning, meddelanden eller andra grundfunktioner."] },
      { title: "Mer information", body: ["Behandling av personuppgifter beskrivs mer detaljerat i integritetspolicyn. Användarvillkoren beskriver reglerna för användning av tjänsten."] }
    ],
    actions: [{ href: "/privacy", label: "Integritet", primary: true }, { href: "/terms", label: "Villkor" }],
    summaryLabel: "Cookies - sammanfattning"
  }
};

export default function CookiesPage() {
  return <InfoPage copy={copy} />;
}
