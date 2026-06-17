import InfoPage, { type InfoPageCopy } from "@/app/components/InfoPage";
import type { Locale } from "@/lib/i18n";

const copy: Record<Locale, InfoPageCopy> = {
  fi: {
    kicker: "Tuki",
    title: "UKK",
    lead: "Usein kysytyt kysymykset Maskinesin käytöstä, ilmoituksista, viesteistä ja turvallisesta kaupankäynnistä.",
    cards: [
      { title: "Ilmoittaminen", text: "Hyvä ilmoitus sisältää osan kunnon, sopivuuden, kuvat, hinnan ja sijainnin." },
      { title: "Ostaminen", text: "Varmista osan yhteensopivuus ja sovi maksu sekä toimitus myyjän kanssa kirjallisesti." },
      { title: "Tili", text: "Profiilin tiedot auttavat ostajia luottamaan myyjään ja helpottavat yhteydenpitoa." }
    ],
    sections: [
      { title: "Onko Maskines kaupan osapuoli?", body: ["Ei. Maskines tarjoaa alustan ostajille ja myyjille. Ostaja ja myyjä sopivat itse maksusta, toimituksesta, noudosta, palautuksista ja reklamaatioista."] },
      { title: "Miten teen hyvän ilmoituksen?", body: ["Kirjoita selkeä otsikko, lisää hyvät kuvat ja kerro osa mahdollisimman tarkasti."], bullets: ["ajoneuvotyyppi, merkki, malli ja vuosimalli", "osan kunto ja mahdolliset viat", "alkuperäinen varaosanumero, jos se on tiedossa", "toimitus- tai noutomahdollisuus"] },
      { title: "Mitä teen, jos ilmoitus vaikuttaa epäilyttävältä?", body: ["Älä lähetä rahaa kiireen tai painostuksen perusteella. Pyydä lisäkuvia, varmista myyjän tiedot ja ota yhteyttä tukeen, jos jokin tuntuu väärältä."] },
      { title: "Voiko yritys käyttää palvelua?", body: ["Kyllä. Yritykset voivat käyttää palvelua varaosien myyntiin ja näkyvyyden kasvattamiseen. Yritystilin tietojen tulee olla oikein ja ajan tasalla."] }
    ],
    summaryLabel: "UKK - yhteenveto"
  },
  en: {
    kicker: "Support",
    title: "FAQ",
    lead: "Frequently asked questions about using Maskines, listings, messages and safe trading.",
    cards: [
      { title: "Listing", text: "A good listing includes the part condition, fitment, photos, price and location." },
      { title: "Buying", text: "Confirm part compatibility and agree payment and delivery with the seller in writing." },
      { title: "Account", text: "Profile details help buyers trust the seller and make contact easier." }
    ],
    sections: [
      { title: "Is Maskines a party to the trade?", body: ["No. Maskines provides a platform for buyers and sellers. Buyer and seller agree payment, delivery, pickup, returns and complaints themselves."] },
      { title: "How do I make a good listing?", body: ["Write a clear title, add good photos and describe the part as accurately as possible."], bullets: ["vehicle type, make, model and model year", "part condition and possible defects", "original part number if known", "delivery or pickup option"] },
      { title: "What should I do if a listing looks suspicious?", body: ["Do not send money because of urgency or pressure. Ask for more photos, verify the seller details and contact support if something feels wrong."] },
      { title: "Can a company use the service?", body: ["Yes. Companies can use the service to sell spare parts and increase visibility. Business account details must be correct and up to date."] }
    ],
    summaryLabel: "FAQ - summary"
  },
  sv: {
    kicker: "Support",
    title: "Vanliga frågor",
    lead: "Vanliga frågor om att använda Maskines, annonser, meddelanden och trygg handel.",
    cards: [
      { title: "Annonsering", text: "En bra annons innehåller delens skick, passform, bilder, pris och plats." },
      { title: "Köp", text: "Kontrollera delens kompatibilitet och kom överens skriftligt med säljaren om betalning och leverans." },
      { title: "Konto", text: "Profiluppgifter hjälper köpare att lita på säljaren och gör kontakten enklare." }
    ],
    sections: [
      { title: "Är Maskines part i affären?", body: ["Nej. Maskines erbjuder en plattform för köpare och säljare. Köpare och säljare avtalar själva om betalning, leverans, hämtning, returer och reklamationer."] },
      { title: "Hur gör jag en bra annons?", body: ["Skriv en tydlig rubrik, lägg till bra bilder och beskriv delen så noggrant som möjligt."], bullets: ["fordonstyp, märke, modell och årsmodell", "delens skick och eventuella fel", "originalreservdelsnummer om det är känt", "möjlighet till leverans eller hämtning"] },
      { title: "Vad gör jag om en annons verkar misstänkt?", body: ["Skicka inte pengar på grund av brådska eller press. Be om fler bilder, kontrollera säljarens uppgifter och kontakta supporten om något känns fel."] },
      { title: "Kan ett företag använda tjänsten?", body: ["Ja. Företag kan använda tjänsten för att sälja reservdelar och öka synligheten. Företagskontots uppgifter ska vara korrekta och uppdaterade."] }
    ],
    summaryLabel: "Vanliga frågor - sammanfattning"
  },
  no: {
    kicker: "Støtte",
    title: "Ofte stilte spørsmål",
    lead: "Ofte stilte spørsmål om bruk av Maskines, annonser, meldinger og trygg handel.",
    cards: [
      { title: "Annonsering", text: "En god annonse inneholder delens tilstand, passform, bilder, pris og sted." },
      { title: "Kjøp", text: "Kontroller at delen passer og avtal betaling og levering skriftlig med selgeren." },
      { title: "Konto", text: "Profilopplysninger hjelper kjøpere å stole på selgeren og gjør kontakt enklere." }
    ],
    sections: [
      { title: "Er Maskines part i handelen?", body: ["Nei. Maskines tilbyr en plattform for kjøpere og selgere. Kjøper og selger avtaler selv betaling, levering, henting, returer og reklamasjoner."] },
      { title: "Hvordan lager jeg en god annonse?", body: ["Skriv en tydelig tittel, legg til gode bilder og beskriv delen så nøyaktig som mulig."], bullets: ["kjøretøytype, merke, modell og årsmodell", "delens tilstand og eventuelle feil", "originalt delenummer hvis det er kjent", "mulighet for levering eller henting"] },
      { title: "Hva gjør jeg hvis en annonse virker mistenkelig?", body: ["Ikke send penger på grunn av hastverk eller press. Be om flere bilder, kontroller selgerens opplysninger og kontakt støtte hvis noe føles feil."] },
      { title: "Kan en bedrift bruke tjenesten?", body: ["Ja. Bedrifter kan bruke tjenesten til å selge reservedeler og øke synligheten. Opplysningene på bedriftskontoen må være riktige og oppdaterte."] }
    ],
    summaryLabel: "Ofte stilte spørsmål - sammendrag"
  },
  et: {
    kicker: "Tugi",
    title: "KKK",
    lead: "Korduma kippuvad küsimused Maskinesi kasutamise, kuulutuste, sõnumite ja turvalise kauplemise kohta.",
    cards: [
      { title: "Kuulutamine", text: "Hea kuulutus sisaldab osa seisukorda, sobivust, pilte, hinda ja asukohta." },
      { title: "Ostmine", text: "Kontrolli osa sobivust ning lepi makse ja tarne müüjaga kirjalikult kokku." },
      { title: "Konto", text: "Profiiliandmed aitavad ostjatel müüjat usaldada ja lihtsustavad ühenduse võtmist." }
    ],
    sections: [
      { title: "Kas Maskines on tehingu osapool?", body: ["Ei. Maskines pakub ostjatele ja müüjatele platvormi. Ostja ja müüja lepivad makse, tarne, kättesaamise, tagastused ja pretensioonid ise kokku."] },
      { title: "Kuidas teha hea kuulutus?", body: ["Kirjuta selge pealkiri, lisa head pildid ja kirjelda osa võimalikult täpselt."], bullets: ["sõidukitüüp, mark, mudel ja mudeliaasta", "osa seisukord ja võimalikud vead", "originaalvaruosa number, kui see on teada", "tarne- või kättesaamisvõimalus"] },
      { title: "Mida teha, kui kuulutus tundub kahtlane?", body: ["Ära saada raha kiirustamise või surve tõttu. Küsi lisapilte, kontrolli müüja andmeid ja võta toega ühendust, kui miski tundub vale."] },
      { title: "Kas ettevõte saab teenust kasutada?", body: ["Jah. Ettevõtted saavad teenust kasutada varuosade müügiks ja nähtavuse kasvatamiseks. Ettevõttekonto andmed peavad olema õiged ja ajakohased."] }
    ],
    summaryLabel: "KKK - kokkuvõte"
  }
};

export default function FaqPage() {
  return <InfoPage copy={copy} />;
}
