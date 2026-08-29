import "server-only";

import { normalizeEmailLocale, type EmailLocale } from "@/lib/email-template";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const translations: Record<Exclude<EmailLocale, "fi">, Array<[string, string]>> = {
  en: [
    ["Kuitti yritysvahvistuksesta", "Company verification receipt"], ["MAKSUN VAHVISTUS", "PAYMENT CONFIRMATION"],
    ["Kiitos maksustasi", "Thank you for your payment"], ["Maksupäivä", "Payment date"],
    ["Avaa Stripen kuitti", "Open Stripe receipt"], ["Yritysvahvistuksesi on vastaanotettu ja yritystietojen tarkistus voi alkaa.", "Your company verification request has been received and the review can begin."],
    ["TILAUSVAHVISTUS", "ORDER CONFIRMATION"], ["UUSI MAKSETTU TILAUS", "NEW PAID ORDER"],
    ["Maksu on vahvistettu", "Payment confirmed"], ["MAKSU VAHVISTETTU", "PAYMENT CONFIRMED"],
    ["Kiitos tilauksestasi. Maksu on vahvistettu ja tilauksesi on välitetty myyjälle käsiteltäväksi.", "Thank you for your order. Your payment is confirmed and the order has been sent to the seller for processing."],
    ["Kiitos tilauksestasi. Maksu on vahvistettu.", "Thank you for your order. Your payment is confirmed."],
    ["Olet saanut uuden maksetun tilauksen.", "You have received a new paid order."],
    ["MYYJÄ JA KUITIN ANTAJA", "SELLER AND RECEIPT ISSUER"], ["KUITTI", "RECEIPT"],
    ["Ostajayrityksen tiedot", "Buyer company details"], ["Ostajan tiedot", "Buyer details"],
    ["Tilatut tuotteet", "Ordered products"], ["TOIMITUSTIEDOT", "DELIVERY DETAILS"],
    ["Toimitustiedot", "Delivery details"], ["Toimitustapa", "Delivery method"],
    ["Tuotteet ennen alennuksia", "Products before discounts"], ["Tuotteet", "Products"],
    ["Alennukset", "Discounts"], ["Toimitusmaksu", "Delivery fee"],
    ["Sisältyvä ALV", "VAT included"], ["Maksettu yhteensä", "Total paid"],
    ["Veroton summa", "Net amount"], ["ALV yhteensä", "Total VAT"],
    ["Maksun tila", "Payment status"], ["Maksettu", "Paid"], ["Maksunvälittäjä", "Payment processor"],
    ["Tilausnumero", "Order number"], ["Tilausaika", "Order time"], ["Tilaus", "Order"],
    ["Myyjä", "Seller"], ["Yritys", "Company"], ["Y-tunnus", "Business ID"],
    ["ALV-tunniste", "VAT ID"], ["Sähköposti", "Email"], ["Puhelin", "Phone"],
    ["Osoite", "Address"], ["Yhteyshenkilö", "Contact person"], ["Verkkosivu", "Website"],
    ["Yksityinen", "Private customer"], ["Ostajatyyppi", "Buyer type"], ["Nimi", "Name"],
    ["Nouto yritykseltä", "Pickup from seller"], ["noutopiste", "pickup point"],
    ["Avaa tilaus hallintapaneelissa", "Open order in dashboard"],
    ["Seuraa lähetystä", "Track shipment"], ["Seurantakoodi", "Tracking code"],
    ["on lähetetty", "has been shipped"], ["on valmis noudettavaksi", "is ready for pickup"],
    ["Ota tarvittaessa yhteyttä myyjään ennen noutoa.", "Contact the seller before pickup if needed."],
    ["Saat Postilta erillisen saapumisilmoituksen, kun lähetys on noudettavissa.", "Posti will send a separate arrival notice when the parcel is ready for pickup."],
    ["Hei ", "Hello "]
  ],
  sv: [
    ["Kuitti yritysvahvistuksesta", "Kvitto för företagsverifiering"], ["MAKSUN VAHVISTUS", "BETALNINGSBEKRÄFTELSE"],
    ["Kiitos maksustasi", "Tack för din betalning"], ["Maksupäivä", "Betalningsdatum"],
    ["Avaa Stripen kuitti", "Öppna Stripe-kvittot"], ["Yritysvahvistuksesi on vastaanotettu ja yritystietojen tarkistus voi alkaa.", "Din begäran om företagsverifiering har tagits emot och granskningen kan börja."],
    ["TILAUSVAHVISTUS", "ORDERBEKRÄFTELSE"], ["UUSI MAKSETTU TILAUS", "NY BETALD BESTÄLLNING"],
    ["Maksu on vahvistettu", "Betalningen är bekräftad"], ["MAKSU VAHVISTETTU", "BETALNINGEN ÄR BEKRÄFTAD"],
    ["Kiitos tilauksestasi. Maksu on vahvistettu ja tilauksesi on välitetty myyjälle käsiteltäväksi.", "Tack för din beställning. Betalningen är bekräftad och beställningen har skickats till säljaren."],
    ["Kiitos tilauksestasi. Maksu on vahvistettu.", "Tack för din beställning. Betalningen är bekräftad."],
    ["Olet saanut uuden maksetun tilauksen.", "Du har fått en ny betald beställning."],
    ["MYYJÄ JA KUITIN ANTAJA", "SÄLJARE OCH KVITTOUTFÄRDARE"], ["KUITTI", "KVITTO"],
    ["Ostajayrityksen tiedot", "Köparföretagets uppgifter"], ["Ostajan tiedot", "Köparens uppgifter"],
    ["Tilatut tuotteet", "Beställda produkter"], ["TOIMITUSTIEDOT", "LEVERANSUPPGIFTER"],
    ["Toimitustiedot", "Leveransuppgifter"], ["Toimitustapa", "Leveranssätt"],
    ["Tuotteet ennen alennuksia", "Produkter före rabatter"], ["Tuotteet", "Produkter"],
    ["Alennukset", "Rabatter"], ["Toimitusmaksu", "Leveransavgift"], ["Sisältyvä ALV", "Moms ingår"],
    ["Maksettu yhteensä", "Totalt betalt"], ["Maksun tila", "Betalningsstatus"], ["Maksettu", "Betald"],
    ["Tilausnumero", "Beställningsnummer"], ["Tilausaika", "Beställningstid"], ["Tilaus", "Beställning"],
    ["Myyjä", "Säljare"], ["Yritys", "Företag"], ["Y-tunnus", "Företags-ID"],
    ["Sähköposti", "E-post"], ["Puhelin", "Telefon"], ["Osoite", "Adress"], ["Nimi", "Namn"],
    ["Avaa tilaus hallintapaneelissa", "Öppna beställningen i kontrollpanelen"],
    ["Seuraa lähetystä", "Spåra försändelsen"], ["Seurantakoodi", "Spårningskod"],
    ["on lähetetty", "har skickats"], ["on valmis noudettavaksi", "är klar för avhämtning"],
    ["Hei ", "Hej "]
  ],
  no: [
    ["Kuitti yritysvahvistuksesta", "Kvittering for bedriftsverifisering"], ["MAKSUN VAHVISTUS", "BETALINGSBEKREFTELSE"],
    ["Kiitos maksustasi", "Takk for betalingen"], ["Maksupäivä", "Betalingsdato"],
    ["Avaa Stripen kuitti", "Åpne Stripe-kvitteringen"], ["Yritysvahvistuksesi on vastaanotettu ja yritystietojen tarkistus voi alkaa.", "Forespørselen om bedriftsverifisering er mottatt, og gjennomgangen kan begynne."],
    ["TILAUSVAHVISTUS", "ORDREBEKREFTELSE"], ["UUSI MAKSETTU TILAUS", "NY BETALT ORDRE"],
    ["Maksu on vahvistettu", "Betalingen er bekreftet"], ["MAKSU VAHVISTETTU", "BETALINGEN ER BEKREFTET"],
    ["Kiitos tilauksestasi. Maksu on vahvistettu ja tilauksesi on välitetty myyjälle käsiteltäväksi.", "Takk for bestillingen. Betalingen er bekreftet, og ordren er sendt til selgeren."],
    ["Kiitos tilauksestasi. Maksu on vahvistettu.", "Takk for bestillingen. Betalingen er bekreftet."],
    ["Olet saanut uuden maksetun tilauksen.", "Du har mottatt en ny betalt ordre."],
    ["MYYJÄ JA KUITIN ANTAJA", "SELGER OG KVITTERINGSUTSTEDER"], ["KUITTI", "KVITTERING"],
    ["Ostajayrityksen tiedot", "Kjøperbedriftens opplysninger"], ["Ostajan tiedot", "Kjøperopplysninger"],
    ["Tilatut tuotteet", "Bestilte produkter"], ["TOIMITUSTIEDOT", "LEVERINGSINFORMASJON"],
    ["Toimitustiedot", "Leveringsinformasjon"], ["Toimitustapa", "Leveringsmåte"],
    ["Tuotteet ennen alennuksia", "Produkter før rabatter"], ["Tuotteet", "Produkter"],
    ["Alennukset", "Rabatter"], ["Toimitusmaksu", "Leveringsgebyr"], ["Sisältyvä ALV", "MVA inkludert"],
    ["Maksettu yhteensä", "Totalt betalt"], ["Maksun tila", "Betalingsstatus"], ["Maksettu", "Betalt"],
    ["Tilausnumero", "Ordrenummer"], ["Tilausaika", "Ordretidspunkt"], ["Tilaus", "Ordre"],
    ["Myyjä", "Selger"], ["Yritys", "Bedrift"], ["Y-tunnus", "Organisasjonsnummer"],
    ["Sähköposti", "E-post"], ["Puhelin", "Telefon"], ["Osoite", "Adresse"], ["Nimi", "Navn"],
    ["Avaa tilaus hallintapaneelissa", "Åpne ordren i kontrollpanelet"],
    ["Seuraa lähetystä", "Spor forsendelsen"], ["Seurantakoodi", "Sporingskode"],
    ["on lähetetty", "er sendt"], ["on valmis noudettavaksi", "er klar for henting"],
    ["Hei ", "Hei "]
  ]
};

const supplementalTranslations: Record<Exclude<EmailLocale, "fi">, Array<[string, string]>> = {
  en: [
    ["Uusi maksettu tilaus", "New paid order"], ["OSTAJAN TIEDOT", "BUYER DETAILS"], ["OSTAJAYRITYS", "BUYER COMPANY"],
    ["TUOTTEET", "PRODUCTS"], ["TOIMITUS", "DELIVERY"], ["PDF-liite on mukana tässä viestissä.", "The PDF receipt is attached to this email."],
    ["Vastaa viestiin ottaaksesi yhteyttä myyjään.", "Reply to this email to contact the seller."],
    ["Olemme vastaanottaneet tilauksesi ja maksu on vahvistettu.", "We have received your order and confirmed the payment."],
    ["Virallinen myyjäkohtainen kuitti on tämän viestin PDF-liitteenä.", "The official seller-specific receipt is attached to this email as a PDF."],
    ["Tuotteen myyjä ja kuitin antaja on yllä mainittu yritys.", "The company named above is the seller and issuer of the receipt."],
    ["Stripe toimii maksunvälittäjänä. Maskines toimii markkinapaikkana ja välittää tämän sähköpostin.", "Stripe processes the payment. Maskines operates as the marketplace and delivers this email."],
    ["Posti - toimitus noutopisteeseen", "Posti - delivery to a pickup point"], ["osoite sovitaan myyjän kanssa", "arrange the address with the seller"],
    ["Yrityksen nouto-ohjeet", "Seller pickup instructions"], ["Myyjän osoite", "Seller address"], ["Yrityksen osoite", "Company address"],
    ["Nouto-ohjeet tilaukselle", "Pickup instructions for order"], ["NOUTO-OHJEET", "PICKUP INSTRUCTIONS"],
    ["Tässä ovat maksetun tilauksesi nouto-ohjeet.", "Here are the pickup instructions for your paid order."],
    ["Ei ilmoitettu", "Not provided"], ["PDF-liitteenä", "attached as a PDF"], ["PDF-kuitti", "PDF receipt"],
    ["Myyjän osuus", "Seller total"], ["Loppusumma", "Final total"], ["Hallintapaneeli", "Dashboard"],
    ["Maksunvälittäjä Stripe", "Payment processor: Stripe"], ["Toimitus", "Delivery"], ["Nouto", "Pickup"],
    ["Marginaalivero - Käytetyt tavarat", "Margin scheme - Second-hand goods"], ["on tämän viestin liitteenä.", "is attached to this email."],
    ["ja tilauksesi on välitetty", "and your order has been sent"], ["käsiteltäväksi", "for processing"],
    ["tai kuitit ovat", "or receipts are"], ["myyjille", "to the sellers"], ["liitteenä", "attached"],
    ["Kuitti", "Receipt"], ["kpl", "pcs"], ["ALV", "VAT"]
  ],
  sv: [
    ["Uusi maksettu tilaus", "Ny betald beställning"], ["OSTAJAN TIEDOT", "KÖPARENS UPPGIFTER"], ["OSTAJAYRITYS", "KÖPARFÖRETAG"],
    ["TUOTTEET", "PRODUKTER"], ["TOIMITUS", "LEVERANS"], ["PDF-liite on mukana tässä viestissä.", "PDF-kvittot bifogas till detta meddelande."],
    ["Vastaa viestiin ottaaksesi yhteyttä myyjään.", "Svara på meddelandet för att kontakta säljaren."],
    ["Olemme vastaanottaneet tilauksesi ja maksu on vahvistettu.", "Vi har tagit emot din beställning och betalningen är bekräftad."],
    ["Virallinen myyjäkohtainen kuitti on tämän viestin PDF-liitteenä.", "Det officiella säljarspecifika kvittot bifogas som PDF."],
    ["Tuotteen myyjä ja kuitin antaja on yllä mainittu yritys.", "Företaget ovan är säljare och kvittoutfärdare."],
    ["Stripe toimii maksunvälittäjänä. Maskines toimii markkinapaikkana ja välittää tämän sähköpostin.", "Stripe förmedlar betalningen. Maskines fungerar som marknadsplats och skickar detta meddelande."],
    ["Posti - toimitus noutopisteeseen", "Posti - leverans till ett utlämningsställe"], ["osoite sovitaan myyjän kanssa", "adressen avtalas med säljaren"],
    ["Yrityksen nouto-ohjeet", "Säljarens hämtningsanvisningar"], ["Myyjän osoite", "Säljarens adress"], ["Yrityksen osoite", "Företagets adress"],
    ["Nouto-ohjeet tilaukselle", "Hämtningsanvisningar för beställning"], ["NOUTO-OHJEET", "HÄMTNINGSANVISNINGAR"],
    ["Tässä ovat maksetun tilauksesi nouto-ohjeet.", "Här är hämtningsanvisningarna för din betalda beställning."],
    ["Ei ilmoitettu", "Inte angivet"], ["PDF-liitteenä", "bifogat som PDF"], ["PDF-kuitti", "PDF-kvitto"],
    ["Myyjän osuus", "Säljarens andel"], ["Loppusumma", "Slutsumma"], ["Hallintapaneeli", "Kontrollpanel"],
    ["Maksunvälittäjä Stripe", "Betalningsförmedlare: Stripe"], ["Toimitus", "Leverans"], ["Nouto", "Hämtning"],
    ["Marginaalivero - Käytetyt tavarat", "Vinstmarginalbeskattning - Begagnade varor"], ["on tämän viestin liitteenä.", "bifogas till detta meddelande."],
    ["ja tilauksesi on välitetty", "och din beställning har skickats"], ["käsiteltäväksi", "för behandling"],
    ["tai kuitit ovat", "eller kvittona är"], ["myyjille", "till säljarna"], ["liitteenä", "bifogat"],
    ["Kuitti", "Kvitto"], ["kpl", "st"], ["ALV", "Moms"]
  ],
  no: [
    ["Uusi maksettu tilaus", "Ny betalt ordre"], ["OSTAJAN TIEDOT", "KJØPEROPPLYSNINGER"], ["OSTAJAYRITYS", "KJØPERBEDRIFT"],
    ["TUOTTEET", "PRODUKTER"], ["TOIMITUS", "LEVERING"], ["PDF-liite on mukana tässä viestissä.", "PDF-kvitteringen er vedlagt denne e-posten."],
    ["Vastaa viestiin ottaaksesi yhteyttä myyjään.", "Svar på e-posten for å kontakte selgeren."],
    ["Olemme vastaanottaneet tilauksesi ja maksu on vahvistettu.", "Vi har mottatt bestillingen din, og betalingen er bekreftet."],
    ["Virallinen myyjäkohtainen kuitti on tämän viestin PDF-liitteenä.", "Den offisielle selgerspesifikke kvitteringen er vedlagt som PDF."],
    ["Tuotteen myyjä ja kuitin antaja on yllä mainittu yritys.", "Bedriften ovenfor er selger og utsteder av kvitteringen."],
    ["Stripe toimii maksunvälittäjänä. Maskines toimii markkinapaikkana ja välittää tämän sähköpostin.", "Stripe behandler betalingen. Maskines fungerer som markedsplass og sender denne e-posten."],
    ["Posti - toimitus noutopisteeseen", "Posti - levering til hentested"], ["osoite sovitaan myyjän kanssa", "adressen avtales med selgeren"],
    ["Yrityksen nouto-ohjeet", "Selgerens henteinstruksjoner"], ["Myyjän osoite", "Selgerens adresse"], ["Yrityksen osoite", "Bedriftens adresse"],
    ["Nouto-ohjeet tilaukselle", "Henteinstruksjoner for ordre"], ["NOUTO-OHJEET", "HENTEINSTRUKSJONER"],
    ["Tässä ovat maksetun tilauksesi nouto-ohjeet.", "Her er henteinstruksjonene for den betalte ordren din."],
    ["Ei ilmoitettu", "Ikke oppgitt"], ["PDF-liitteenä", "vedlagt som PDF"], ["PDF-kuitti", "PDF-kvittering"],
    ["Myyjän osuus", "Selgerens andel"], ["Loppusumma", "Sluttsum"], ["Hallintapaneeli", "Kontrollpanel"],
    ["Maksunvälittäjä Stripe", "Betalingsformidler: Stripe"], ["Toimitus", "Levering"], ["Nouto", "Henting"],
    ["Marginaalivero - Käytetyt tavarat", "Avanseordning - Brukte varer"], ["on tämän viestin liitteenä.", "er vedlagt denne e-posten."],
    ["ja tilauksesi on välitetty", "og bestillingen din er sendt"], ["käsiteltäväksi", "til behandling"],
    ["tai kuitit ovat", "eller kvitteringene er"], ["myyjille", "til selgerne"], ["liitteenä", "vedlagt"],
    ["Kuitti", "Kvittering"], ["kpl", "stk."], ["ALV", "MVA"]
  ]
};

// Complete phrases used by addresses, totals and order-state messages. Keep
// these deterministic so receipts and transactional email do not depend on
// the optional online UI translator.
const transactionalTranslations: Record<Exclude<EmailLocale, "fi">, Array<[string, string]>> = {
  en: [
    ["Osoitetta ei ole tallennettu tähän tilaukseen.", "No address was saved for this order."],
    ["Myyjän osoite", "Seller address"], ["Yrityksen osoite", "Company address"],
    ["Veroton summa", "Net amount"], ["ALV yhteensä", "Total VAT"],
    ["Yhteensä", "Total"], ["Loppusumma", "Final total"],
    ["Päivämäärä", "Date"], ["Tilausvahvistus", "Order confirmation"],
    ["Suomi", "Finland"], ["Ruotsi", "Sweden"], ["Norja", "Norway"],
    ["Valmis noudettavaksi", "Ready for pickup"], ["Lähetetty", "Shipped"],
    ["Käsittelyssä", "Processing"], ["Toimitettu", "Delivered"],
    ["Pyydä palautusta", "Request a return"]
  ],
  sv: [
    ["Osoitetta ei ole tallennettu tähän tilaukseen.", "Ingen adress har sparats för beställningen."],
    ["Myyjän osoite", "Säljarens adress"], ["Yrityksen osoite", "Företagets adress"],
    ["Veroton summa", "Belopp exklusive moms"], ["ALV yhteensä", "Moms totalt"],
    ["ALV-tunniste", "Momsregistreringsnummer"], ["Maksunvälittäjä", "Betalningsförmedlare"],
    ["Yhteyshenkilö", "Kontaktperson"], ["Verkkosivu", "Webbplats"],
    ["Ostajatyyppi", "Kundtyp"], ["Yksityinen", "Privatkund"],
    ["Nouto yritykseltä", "Hämtning hos företaget"],
    ["Yhteensä", "Totalt"], ["Loppusumma", "Slutsumma"],
    ["Päivämäärä", "Datum"], ["Tilausvahvistus", "Orderbekräftelse"],
    ["Suomi", "Finland"], ["Ruotsi", "Sverige"], ["Norja", "Norge"],
    ["Valmis noudettavaksi", "Klar för avhämtning"], ["Lähetetty", "Skickad"],
    ["Käsittelyssä", "Behandlas"], ["Toimitettu", "Levererad"],
    ["Pyydä palautusta", "Begär retur"]
  ],
  no: [
    ["Osoitetta ei ole tallennettu tähän tilaukseen.", "Ingen adresse ble lagret for bestillingen."],
    ["Myyjän osoite", "Selgerens adresse"], ["Yrityksen osoite", "Bedriftens adresse"],
    ["Veroton summa", "Beløp ekskl. MVA"], ["ALV yhteensä", "MVA totalt"],
    ["ALV-tunniste", "MVA-nummer"], ["Maksunvälittäjä", "Betalingsformidler"],
    ["Yhteyshenkilö", "Kontaktperson"], ["Verkkosivu", "Nettsted"],
    ["Ostajatyyppi", "Kundetype"], ["Yksityinen", "Privatkunde"],
    ["Nouto yritykseltä", "Henting hos bedriften"],
    ["Yhteensä", "Totalt"], ["Loppusumma", "Sluttsum"],
    ["Päivämäärä", "Dato"], ["Tilausvahvistus", "Ordrebekreftelse"],
    ["Suomi", "Finland"], ["Ruotsi", "Sverige"], ["Norja", "Norge"],
    ["Valmis noudettavaksi", "Klar for henting"], ["Lähetetty", "Sendt"],
    ["Käsittelyssä", "Behandles"], ["Toimitettu", "Levert"],
    ["Pyydä palautusta", "Be om retur"]
  ]
};

export async function resolveRecipientEmailLocale(
  userId?: string | null,
  country?: string | null,
  fallbackLocale?: string | null
): Promise<EmailLocale> {
  const countryFallback: EmailLocale = country?.toUpperCase() === "SE"
    ? "sv"
    : country?.toUpperCase() === "NO"
      ? "no"
      : country?.toUpperCase() === "FI"
        ? "fi"
        : "fi";
  const explicitFallback = fallbackLocale === "fi" || fallbackLocale === "en" ||
    fallbackLocale === "sv" || fallbackLocale === "no"
    ? normalizeEmailLocale(fallbackLocale)
    : null;
  if (!userId) return explicitFallback ?? countryFallback;

  const admin = getSupabaseAdmin();
  const [{ data: auth }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("preferred_locale").eq("id", userId).maybeSingle<{ preferred_locale: string | null }>()
  ]);
  return normalizeEmailLocale(
    profile?.preferred_locale ?? auth.user?.user_metadata?.locale ?? explicitFallback ?? countryFallback
  );
}

export async function resolveBuyerOrderEmailLocale(
  userId?: string | null,
  country?: string | null,
  checkoutLocale?: string | null
): Promise<EmailLocale> {
  if (checkoutLocale === "fi" || checkoutLocale === "en" ||
      checkoutLocale === "sv" || checkoutLocale === "no") {
    return normalizeEmailLocale(checkoutLocale);
  }
  return resolveRecipientEmailLocale(userId, country);
}

export function localizeCommerceEmail(locale: EmailLocale, input: { subject: string; text: string; html: string }) {
  if (locale === "fi") return input;
  const pairs = [
    ...translations[locale],
    ...supplementalTranslations[locale],
    ...transactionalTranslations[locale]
  ]
    .sort(([left], [right]) => right.length - left.length);
  const replace = (value: string) => pairs.reduce((current, [source, target]) => current.replaceAll(source, target), value);
  return { subject: replace(input.subject), text: replace(input.text), html: replace(input.html) };
}
