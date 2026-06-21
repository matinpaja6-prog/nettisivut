"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type RefObject
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Barcode,
  BatteryCharging,
  Camera,
  ChevronDown,
  Check,
  ClipboardList,
  Cog,
  CircleDot,
  Droplets,
  Euro,
  FileText,
  Flame,
  FolderTree,
  Layers3,
  MapPin,
  PackagePlus,
  Send,
  Search,
  ShieldCheck,
  Star,
  Tags,
  Trash2,
  Truck,
  Wrench,
  X,
  Zap,
  type LucideIcon
} from "lucide-react";

import { useTaxonomy } from "@/app/components/TaxonomyProvider";
import { useLanguage, type Locale } from "@/lib/i18n";
import { subcategoryGroups, type ListingInput } from "@/lib/listings";
import { listingPath, listingUrlId } from "@/lib/routes";
import type {
  CompanySeller,
  UserProfile
} from "@/lib/supabase";
import { buildVehicleCategoriesFromTaxonomy } from "@/lib/taxonomy";
import styles from "./sell-first.module.css";

type ListingMode = "multiple" | "single";
type DeliveryMethod = "both" | "shipping" | "pickup";

type SellStep = {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
};

type SelectOption = {
  value: string;
  label: string;
};

type ListingFeedbackPrompt = {
  listingId: string;
  returnHref: string;
  listingMode: ListingMode;
  vehicleType: string;
  category: string;
  subcategory: string;
};

function buildListingLocation(cityOrLocation: string, fallbackCity: string, fallbackCountry: string) {
  const location = cityOrLocation.trim() || fallbackCity.trim();
  const country = fallbackCountry.trim();

  if (!location) return country || "Ei maaritetty";
  if (!country) return location;

  const normalizedLocation = location.toLocaleLowerCase("fi-FI");
  const normalizedCountry = country.toLocaleLowerCase("fi-FI");
  const locationParts = normalizedLocation.split(",").map((part) => part.trim());

  if (normalizedLocation === normalizedCountry || locationParts.includes(normalizedCountry)) {
    return location;
  }

  return `${location}, ${country}`;
}

const deliveryMethodOptions: Array<{ value: DeliveryMethod; label: string }> = [
  { value: "both", label: "Lähetys ja nouto" },
  { value: "shipping", label: "Lähetys" },
  { value: "pickup", label: "Nouto" }
];

const conditionOptions: SelectOption[] = [
  { value: "Uusi", label: "Uusi" },
  { value: "Hyvä", label: "Hyvä" },
  { value: "Käytetty", label: "Käytetty" },
  { value: "Korjattava", label: "Korjattava" }
];

const sellTranslations: Record<Exclude<Locale, "fi">, Record<string, string>> = {
  en: {
    "Lähetys ja nouto": "Shipping and pickup",
    "Lähetys": "Shipping",
    "Nouto": "Pickup",
    "Toimitustapa": "Delivery method",
    "Lisää tuotetiedot": "Add product details",
    "Varaosanumero / OEM-numero (vapaaehtoinen)": "Part number / OEM number (optional)",
    "Lisää jos tiedossa": "Add if known",
    "Vedä ja pudota kuvat tähän": "Drag and drop images here",
    "tai": "or",
    "Valitse kuvat": "Choose images",
    "PNG, JPG tai WEBP · isot kuvat muunnetaan automaattisesti 1080p-kokoon": "PNG, JPG or WEBP · large images are automatically converted to 1080p",
    "Kuvavinkit": "Photo tips",
    "Hyvä valaistus": "Good lighting",
    "Käytä luonnonvaloa tai kirkasta sisävaloa.": "Use natural light or bright indoor lighting.",
    "Tarkka ja selkeä": "Sharp and clear",
    "Varmista, että kuva on terävä ja hyvälaatuinen.": "Make sure the image is sharp and high quality.",
    "Näytä kaikki kulmat": "Show all angles",
    "Lisää useampi kuva eri suunnista.": "Add several photos from different angles.",
    "Otsikko ja kuvaus": "Title and description",
    "Otsikko": "Title",
    "Tämä on otsikko jos et itse otsikoi:": "This title is used if you do not write one:",
    "Kuvaus": "Description",
    "Kerro kunto, ominaisuudet, sopivuus ja muut tärkeät tiedot...": "Describe condition, features, compatibility and other important details...",
    "Vinkit hyvään kuvaukseen": "Tips for a good description",
    "Kerro tärkeimmät ominaisuudet": "Mention the most important features",
    "Mainitse kunto": "Mention condition",
    "Lisää sopivuustiedot": "Add compatibility details",
    "Ole rehellinen ja tarkka": "Be honest and accurate",
    "Tyyppi": "Type",
    "Yksittäinen ilmoitus": "Single listing",
    "Useampi ilmoitus": "Multiple listings",
    "Hinta": "Price",
    "Ei lisatty": "Not added",
    "Kunto": "Condition",
    "Kuvat": "Images",
    "kpl": "pcs",
    "Myyjä": "Seller",
    "Valitsematta": "Not selected",
    "Ajoneuvo": "Vehicle",
    "Tekniikka": "Technical details",
    "Kategoria": "Category",
    "Sijainti": "Location",
    "Varaosanumero": "Part number",
    "Tarkista vielä tärkeimmät tiedot ennen kuin ilmoitus lähtee ostajille näkyviin.": "Review the most important details before the listing becomes visible to buyers.",
    "Kuvausta ei ole viela lisatty.": "No description added yet."
  },
  sv: {
    "Lähetys ja nouto": "Frakt och avhämtning",
    "Lähetys": "Frakt",
    "Nouto": "Avhämtning",
    "Toimitustapa": "Leveranssätt",
    "Lisää tuotetiedot": "Lägg till produktuppgifter",
    "Varaosanumero / OEM-numero (vapaaehtoinen)": "Reservdelsnummer / OEM-nummer (valfritt)",
    "Lisää jos tiedossa": "Lägg till om känt",
    "Vedä ja pudota kuvat tähän": "Dra och släpp bilderna här",
    "tai": "eller",
    "Valitse kuvat": "Välj bilder",
    "PNG, JPG tai WEBP · isot kuvat muunnetaan automaattisesti 1080p-kokoon": "PNG, JPG eller WEBP · stora bilder konverteras automatiskt till 1080p",
    "Kuvavinkit": "Bildtips",
    "Hyvä valaistus": "Bra belysning",
    "Käytä luonnonvaloa tai kirkasta sisävaloa.": "Använd naturligt ljus eller stark inomhusbelysning.",
    "Tarkka ja selkeä": "Skarp och tydlig",
    "Varmista, että kuva on terävä ja hyvälaatuinen.": "Se till att bilden är skarp och av god kvalitet.",
    "Näytä kaikki kulmat": "Visa alla vinklar",
    "Lisää useampi kuva eri suunnista.": "Lägg till flera bilder från olika vinklar.",
    "Otsikko ja kuvaus": "Rubrik och beskrivning",
    "Otsikko": "Rubrik",
    "Tämä on otsikko jos et itse otsikoi:": "Den här rubriken används om du inte skriver en egen:",
    "Kuvaus": "Beskrivning",
    "Kerro kunto, ominaisuudet, sopivuus ja muut tärkeät tiedot...": "Beskriv skick, egenskaper, kompatibilitet och andra viktiga uppgifter...",
    "Vinkit hyvään kuvaukseen": "Tips för en bra beskrivning",
    "Kerro tärkeimmät ominaisuudet": "Berätta de viktigaste egenskaperna",
    "Mainitse kunto": "Nämn skicket",
    "Lisää sopivuustiedot": "Lägg till kompatibilitetsuppgifter",
    "Ole rehellinen ja tarkka": "Var ärlig och noggrann",
    "Tyyppi": "Typ",
    "Yksittäinen ilmoitus": "Enskild annons",
    "Useampi ilmoitus": "Flera annonser",
    "Hinta": "Pris",
    "Ei lisatty": "Inte tillagt",
    "Kunto": "Skick",
    "Kuvat": "Bilder",
    "kpl": "st",
    "Myyjä": "Säljare",
    "Valitsematta": "Inte valt",
    "Ajoneuvo": "Fordon",
    "Tekniikka": "Teknik",
    "Kategoria": "Kategori",
    "Sijainti": "Plats",
    "Varaosanumero": "Reservdelsnummer",
    "Tarkista vielä tärkeimmät tiedot ennen kuin ilmoitus lähtee ostajille näkyviin.": "Granska de viktigaste uppgifterna innan annonsen visas för köpare.",
    "Kuvausta ei ole viela lisatty.": "Ingen beskrivning har lagts till ännu."
  },
  no: {
    "Lähetys ja nouto": "Frakt og henting",
    "Lähetys": "Frakt",
    "Nouto": "Henting",
    "Toimitustapa": "Leveringsmåte",
    "Lisää tuotetiedot": "Legg til produktdetaljer",
    "Varaosanumero / OEM-numero (vapaaehtoinen)": "Delenummer / OEM-nummer (valgfritt)",
    "Lisää jos tiedossa": "Legg til hvis kjent",
    "Vedä ja pudota kuvat tähän": "Dra og slipp bildene her",
    "tai": "eller",
    "Valitse kuvat": "Velg bilder",
    "PNG, JPG tai WEBP · isot kuvat muunnetaan automaattisesti 1080p-kokoon": "PNG, JPG eller WEBP · store bilder konverteres automatisk til 1080p",
    "Kuvavinkit": "Bildetips",
    "Hyvä valaistus": "God belysning",
    "Käytä luonnonvaloa tai kirkasta sisävaloa.": "Bruk naturlig lys eller sterkt innelys.",
    "Tarkka ja selkeä": "Skarpt og tydelig",
    "Varmista, että kuva on terävä ja hyvälaatuinen.": "Sørg for at bildet er skarpt og av god kvalitet.",
    "Näytä kaikki kulmat": "Vis alle vinkler",
    "Lisää useampi kuva eri suunnista.": "Legg til flere bilder fra ulike vinkler.",
    "Otsikko ja kuvaus": "Tittel og beskrivelse",
    "Otsikko": "Tittel",
    "Tämä on otsikko jos et itse otsikoi:": "Denne tittelen brukes hvis du ikke skriver en selv:",
    "Kuvaus": "Beskrivelse",
    "Kerro kunto, ominaisuudet, sopivuus ja muut tärkeät tiedot...": "Beskriv tilstand, egenskaper, kompatibilitet og andre viktige detaljer...",
    "Vinkit hyvään kuvaukseen": "Tips for en god beskrivelse",
    "Kerro tärkeimmät ominaisuudet": "Fortell de viktigste egenskapene",
    "Mainitse kunto": "Nevn tilstanden",
    "Lisää sopivuustiedot": "Legg til kompatibilitetsinformasjon",
    "Ole rehellinen ja tarkka": "Vær ærlig og nøyaktig",
    "Tyyppi": "Type",
    "Yksittäinen ilmoitus": "Enkelt annonse",
    "Useampi ilmoitus": "Flere annonser",
    "Hinta": "Pris",
    "Ei lisatty": "Ikke lagt til",
    "Kunto": "Tilstand",
    "Kuvat": "Bilder",
    "kpl": "stk",
    "Myyjä": "Selger",
    "Valitsematta": "Ikke valgt",
    "Ajoneuvo": "Kjøretøy",
    "Tekniikka": "Teknikk",
    "Kategoria": "Kategori",
    "Sijainti": "Sted",
    "Varaosanumero": "Delenummer",
    "Tarkista vielä tärkeimmät tiedot ennen kuin ilmoitus lähtee ostajille näkyviin.": "Kontroller de viktigste opplysningene før annonsen blir synlig for kjøpere.",
    "Kuvausta ei ole viela lisatty.": "Ingen beskrivelse lagt til ennå."
  },
  et: {
    "Lähetys ja nouto": "Saatmine ja järeletulemine",
    "Lähetys": "Saatmine",
    "Nouto": "Järeletulemine",
    "Toimitustapa": "Tarneviis",
    "Lisää tuotetiedot": "Lisa tooteandmed",
    "Varaosanumero / OEM-numero (vapaaehtoinen)": "Varuosa number / OEM-number (valikuline)",
    "Lisää jos tiedossa": "Lisa, kui teada",
    "Vedä ja pudota kuvat tähän": "Lohista pildid siia",
    "tai": "või",
    "Valitse kuvat": "Vali pildid",
    "PNG, JPG tai WEBP · isot kuvat muunnetaan automaattisesti 1080p-kokoon": "PNG, JPG või WEBP · suured pildid teisendatakse automaatselt 1080p suuruseks",
    "Kuvavinkit": "Pildinõuanded",
    "Hyvä valaistus": "Hea valgustus",
    "Käytä luonnonvaloa tai kirkasta sisävaloa.": "Kasuta loomulikku valgust või eredat sisevalgust.",
    "Tarkka ja selkeä": "Terav ja selge",
    "Varmista, että kuva on terävä ja hyvälaatuinen.": "Veendu, et pilt oleks terav ja kvaliteetne.",
    "Näytä kaikki kulmat": "Näita kõiki nurki",
    "Lisää useampi kuva eri suunnista.": "Lisa mitu pilti eri suundadest.",
    "Otsikko ja kuvaus": "Pealkiri ja kirjeldus",
    "Otsikko": "Pealkiri",
    "Tämä on otsikko jos et itse otsikoi:": "Seda pealkirja kasutatakse, kui sa ise pealkirja ei kirjuta:",
    "Kuvaus": "Kirjeldus",
    "Kerro kunto, ominaisuudet, sopivuus ja muut tärkeät tiedot...": "Kirjelda seisukorda, omadusi, sobivust ja muud olulist infot...",
    "Vinkit hyvään kuvaukseen": "Hea kirjelduse nõuanded",
    "Kerro tärkeimmät ominaisuudet": "Too välja olulisemad omadused",
    "Mainitse kunto": "Maini seisukorda",
    "Lisää sopivuustiedot": "Lisa sobivuse info",
    "Ole rehellinen ja tarkka": "Ole aus ja täpne",
    "Tyyppi": "Tüüp",
    "Yksittäinen ilmoitus": "Üks kuulutus",
    "Useampi ilmoitus": "Mitu kuulutust",
    "Hinta": "Hind",
    "Ei lisatty": "Lisamata",
    "Kunto": "Seisukord",
    "Kuvat": "Pildid",
    "kpl": "tk",
    "Myyjä": "Müüja",
    "Valitsematta": "Valimata",
    "Ajoneuvo": "Sõiduk",
    "Tekniikka": "Tehnika",
    "Kategoria": "Kategooria",
    "Sijainti": "Asukoht",
    "Varaosanumero": "Varuosa number",
    "Tarkista vielä tärkeimmät tiedot ennen kuin ilmoitus lähtee ostajille näkyviin.": "Kontrolli tähtsaimad andmed enne, kui kuulutus ostjatele nähtavaks muutub.",
    "Kuvausta ei ole viela lisatty.": "Kirjeldust pole veel lisatud."
  }
};

const extraSellTranslations: Record<Exclude<Locale, "fi">, Record<string, string>> = {
  en: {
    "Luo myynti-ilmoitus": "Create sales listing",
    "Valitse ilmoitustyyppi": "Choose listing type",
    "Valitse, haluatko listata useita osia samasta ajoneuvosta vai yksittäisen osan.": "Choose whether to list several parts from the same vehicle or one individual part.",
    "Useampi osa samasta ajoneuvosta": "Several parts from one vehicle",
    "Useampi ilmoitus": "Multiple listings",
    "Yksittäinen ilmoitus": "Single listing",
    "Listaa vain saman ajoneuvon osia samalla kertaa.": "List only parts from the same vehicle at the same time.",
    "Säästä aikaa ja hallitse kaikkia osia yhdessä paikassa.": "Save time and manage all parts in one place.",
    "Myy yksi osa kerrallaan.": "Sell one part at a time.",
    "Sopii yksittäisille osille tai harvinaisille tuotteille.": "Best for individual parts or rare products.",
    "Ajoneuvon tiedot": "Vehicle details",
    "Täytä ajoneuvon tiedot": "Fill in vehicle details",
    "Valitse ajoneuvoluokka": "Choose vehicle class",
    "Moottorikelkka": "Snowmobile",
    "Kelkat, telastot, moottorit": "Sleds, tracks, engines",
    "Mönkijä": "ATV",
    "ATV ja UTV osat": "ATV and UTV parts",
    "Motocross": "Motocross",
    "Crossi ja enduro": "Motocross and enduro",
    "Mopo": "Moped",
    "Mopot ja piikit": "Mopeds and 125cc bikes",
    "Tyyppi": "Type",
    "Merkki": "Brand",
    "Malli": "Model",
    "Vuosimalli": "Model year",
    "Moottorin koko (cc)": "Engine size (cc)",
    "Moottori / moottorityyppi": "Engine / engine type",
    "Valitse tyyppi": "Choose type",
    "Valitse merkki": "Choose brand",
    "Valitse malli": "Choose model",
    "Valitse vuosimalli": "Choose model year",
    "Valitse cc": "Choose cc",
    "Valitse moottorityyppi": "Choose engine type",
    "Kirjoita tyyppi": "Type manually",
    "Kirjoita merkki": "Type brand",
    "Kirjoita malli": "Type model",
    "Kirjoita vuosimalli": "Type model year",
    "Kirjoita cc": "Type cc",
    "Kirjoita moottori": "Type engine",
    "Mopo - mopo": "Moped - moped",
    "Skootteri - mopo": "Scooter - moped",
    "Supermoto - mopo": "Supermoto - moped",
    "Enduro - mopo": "Enduro - moped",
    "Manki / monkey - mopo": "Monkey bike - moped",
    "Piikki 125 - mopo": "125cc bike - moped",
    "Jatka": "Continue",
    "Edellinen": "Previous",
    "Seuraava": "Next",
    "Nollaa": "Reset",
    "Muu": "Other",
    "Siirry vaiheeseen": "Go to step",
    "Ilmoitustyyppi": "Listing type",
    "Ilmoitus": "Listing",
    "Ilmoituksen tyyppi": "Listing type",
    "Valitse myyntityyppi": "Choose selling type",
    "Kategoria ja hinta": "Category and price",
    "Valitse kategoria ja hinta": "Choose category and price",
    "Valitse kategoriointi": "Choose categorization",
    "Valitse tuotteen kategoria ja lisää hinta.": "Choose the product category and add a price.",
    "Valitse yhteinen kategoriointi ilmoituksille.": "Choose shared categorization for the listings.",
    "Kunto & sijainti": "Condition & location",
    "Kunto ja sijainti": "Condition and location",
    "Valitse kunto ja paikka": "Choose condition and location",
    "Kuntoluokitus": "Condition rating",
    "Kuvat": "Photos",
    "Lisää tuotteen kuvat": "Add product photos",
    "Otsikko ja kuvaus": "Title and description",
    "Lisää otsikko ja kuvaus": "Add title and description",
    "Julkaise": "Publish",
    "Tarkista ja julkaise": "Review and publish",
    "Tarkista tiedot ennen julkaisua.": "Review the details before publishing.",
    "Julkaistaan...": "Publishing...",
    "Seuraava osa": "Next part",
    "Toimitukseen": "To delivery",
    "Julkaisuun": "To publishing",
    "Kategorisoi tuote": "Categorize product",
    "Kategorisoi tuotteesi": "Categorize your product",
    "Pääkategoria": "Main category",
    "Alakategoria": "Subcategory",
    "Tarkempi kategoria": "Detailed category",
    "Ei kategorioita": "No categories",
    "Valitse pääkategoria": "Choose main category",
    "Valitse alakategoria": "Choose subcategory",
    "Hinta (€)": "Price (€)",
    "Tarkat tiedot rakentavat luottamusta ja auttavat myymään nopeammin.": "Accurate details build trust and help you sell faster.",
    "Esim. Ski-Doo variaattori 850 E-TEC": "E.g. Ski-Doo variator 850 E-TEC",
    "Ilmoitus valmis julkaistavaksi": "Listing ready to publish",
    "Ilmoitukset valmiina julkaisuun": "Listings ready to publish",
    "Ilmoituksen myyjä": "Listing seller",
    "Voit valita erillisen myyjän. Jos et valitse, ilmoitus julkaistaan yrityksen tiedoilla.": "You can choose a separate seller. If you do not choose one, the listing is published with the company details.",
    "Yrityksen tiedot": "Company details",
    "Erillisiä myyjiä ei ole lisätty. Ilmoitus julkaistaan yrityksen tiedoilla.": "No separate sellers have been added. The listing will be published with the company details.",
    "Ilmoituksen pikatiedot": "Listing quick details",
    "Ilmoituksen yhteenveto": "Listing summary",
    "Yksittäinen ilmoitus valmis julkaistavaksi": "Single listing ready to publish",
    "Multi-ilmoitukset valmiina julkaisuun": "Multiple listings ready to publish",
    "Tarkista vielä otsikot, hinnat, kuvat ja sijainti ennen julkaisua.": "Review the titles, prices, photos and location before publishing.",
    "euroa": "euros",
    "Uusi": "New",
    "Hyvä": "Good",
    "Käytetty": "Used",
    "Korjattava": "Needs repair",
    "ATV - mönkijä": "ATV - quad",
    "UTV - mönkijä": "UTV - quad",
    "Sport - mönkijä": "Sport - quad",
    "Työ - mönkijä": "Utility - quad",
    "Maasto - mönkijä": "Off-road - quad",
    "6x6 - mönkijä": "6x6 - quad",
    "Lasten - mönkijä": "Kids - quad",
    "Motocross - crossi": "Motocross - dirt bike",
    "Enduro - crossi": "Enduro - dirt bike",
    "Supermoto - crossi": "Supermoto - dirt bike",
    "Trial - crossi": "Trial - dirt bike",
    "Pitbike - crossi": "Pit bike - dirt bike",
    "Minicross - crossi": "Mini cross - dirt bike",
    "Crossover - moottorikelkka": "Crossover snowmobile",
    "Deep snow - moottorikelkka": "Deep snow snowmobile",
    "Sport - moottorikelkka": "Sport snowmobile",
    "Touring - moottorikelkka": "Touring snowmobile",
    "Työ - moottorikelkka": "Utility snowmobile",
    "Watercross - moottorikelkka": "Watercross snowmobile",
    "Moottori & voimansiirto": "Engine & drivetrain",
    "Kokonainen moottori": "Complete engine"
  },
  sv: {
    "Luo myynti-ilmoitus": "Skapa försäljningsannons",
    "Valitse ilmoitustyyppi": "Välj annonstyp",
    "Valitse, haluatko listata useita osia samasta ajoneuvosta vai yksittäisen osan.": "Välj om du vill lista flera delar från samma fordon eller en enskild del.",
    "Useampi osa samasta ajoneuvosta": "Flera delar från samma fordon",
    "Useampi ilmoitus": "Flera annonser",
    "Yksittäinen ilmoitus": "Enskild annons",
    "Listaa vain saman ajoneuvon osia samalla kertaa.": "Lista bara delar från samma fordon åt gången.",
    "Säästä aikaa ja hallitse kaikkia osia yhdessä paikassa.": "Spara tid och hantera alla delar på ett ställe.",
    "Myy yksi osa kerrallaan.": "Sälj en del åt gången.",
    "Sopii yksittäisille osille tai harvinaisille tuotteille.": "Passar enskilda delar eller sällsynta produkter.",
    "Ajoneuvon tiedot": "Fordonsuppgifter",
    "Täytä ajoneuvon tiedot": "Fyll i fordonsuppgifter",
    "Valitse ajoneuvoluokka": "Välj fordonsklass",
    "Moottorikelkka": "Snöskoter",
    "Kelkat, telastot, moottorit": "Skotrar, boggier, motorer",
    "Mönkijä": "Fyrhjuling",
    "ATV ja UTV osat": "ATV- och UTV-delar",
    "Motocross": "Motocross",
    "Crossi ja enduro": "Cross och enduro",
    "Mopo": "Moped",
    "Mopot ja piikit": "Mopeder och 125:or",
    "Tyyppi": "Typ",
    "Merkki": "Märke",
    "Malli": "Modell",
    "Vuosimalli": "Årsmodell",
    "Moottorin koko (cc)": "Motorstorlek (cc)",
    "Moottori / moottorityyppi": "Motor / motortyp",
    "Valitse tyyppi": "Välj typ",
    "Valitse merkki": "Välj märke",
    "Valitse malli": "Välj modell",
    "Valitse vuosimalli": "Välj årsmodell",
    "Valitse cc": "Välj cc",
    "Valitse moottorityyppi": "Välj motortyp",
    "Kirjoita tyyppi": "Skriv typ",
    "Kirjoita merkki": "Skriv märke",
    "Kirjoita malli": "Skriv modell",
    "Kirjoita vuosimalli": "Skriv årsmodell",
    "Kirjoita cc": "Skriv cc",
    "Kirjoita moottori": "Skriv motor",
    "Mopo - mopo": "Moped - moped",
    "Skootteri - mopo": "Skoter - moped",
    "Supermoto - mopo": "Supermoto - moped",
    "Enduro - mopo": "Enduro - moped",
    "Manki / monkey - mopo": "Monkey - moped",
    "Piikki 125 - mopo": "125:a - moped",
    "Jatka": "Fortsätt",
    "Edellinen": "Föregående",
    "Seuraava": "Nästa",
    "Nollaa": "Återställ",
    "Muu": "Annat",
    "Siirry vaiheeseen": "Gå till steg",
    "Ilmoitustyyppi": "Annonstyp",
    "Ilmoitus": "Annons",
    "Ilmoituksen tyyppi": "Annonstyp",
    "Valitse myyntityyppi": "Välj försäljningstyp",
    "Kategoria ja hinta": "Kategori och pris",
    "Valitse kategoria ja hinta": "Välj kategori och pris",
    "Valitse kategoriointi": "Välj kategorisering",
    "Valitse tuotteen kategoria ja lisää hinta.": "Välj produktkategori och lägg till pris.",
    "Valitse yhteinen kategoriointi ilmoituksille.": "Välj gemensam kategorisering för annonserna.",
    "Kunto & sijainti": "Skick & plats",
    "Kunto ja sijainti": "Skick och plats",
    "Valitse kunto ja paikka": "Välj skick och plats",
    "Kuntoluokitus": "Skickklassning",
    "Kuvat": "Bilder",
    "Lisää tuotteen kuvat": "Lägg till produktbilder",
    "Otsikko ja kuvaus": "Rubrik och beskrivning",
    "Lisää otsikko ja kuvaus": "Lägg till rubrik och beskrivning",
    "Julkaise": "Publicera",
    "Tarkista ja julkaise": "Granska och publicera",
    "Tarkista tiedot ennen julkaisua.": "Granska uppgifterna innan publicering.",
    "Julkaistaan...": "Publicerar...",
    "Seuraava osa": "Nästa del",
    "Toimitukseen": "Till leverans",
    "Julkaisuun": "Till publicering",
    "Kategorisoi tuote": "Kategorisera produkten",
    "Kategorisoi tuotteesi": "Kategorisera din produkt",
    "Pääkategoria": "Huvudkategori",
    "Alakategoria": "Underkategori",
    "Tarkempi kategoria": "Mer specifik kategori",
    "Ei kategorioita": "Inga kategorier",
    "Valitse pääkategoria": "Välj huvudkategori",
    "Valitse alakategoria": "Välj underkategori",
    "Hinta (€)": "Pris (€)",
    "Tarkat tiedot rakentavat luottamusta ja auttavat myymään nopeammin.": "Noggranna uppgifter bygger förtroende och hjälper dig att sälja snabbare.",
    "Esim. Ski-Doo variaattori 850 E-TEC": "T.ex. Ski-Doo variator 850 E-TEC",
    "Ilmoitus valmis julkaistavaksi": "Annonsen är redo att publiceras",
    "Ilmoitukset valmiina julkaisuun": "Annonserna är redo att publiceras",
    "Ilmoituksen myyjä": "Annonsens säljare",
    "Voit valita erillisen myyjän. Jos et valitse, ilmoitus julkaistaan yrityksen tiedoilla.": "Du kan välja en separat säljare. Om du inte väljer någon publiceras annonsen med företagets uppgifter.",
    "Yrityksen tiedot": "Företagets uppgifter",
    "Erillisiä myyjiä ei ole lisätty. Ilmoitus julkaistaan yrityksen tiedoilla.": "Inga separata säljare har lagts till. Annonsen publiceras med företagets uppgifter.",
    "Ilmoituksen pikatiedot": "Annonsens snabbuppgifter",
    "Ilmoituksen yhteenveto": "Annonssammanfattning",
    "Yksittäinen ilmoitus valmis julkaistavaksi": "Enskild annons redo att publiceras",
    "Multi-ilmoitukset valmiina julkaisuun": "Flera annonser redo att publiceras",
    "Tarkista vielä otsikot, hinnat, kuvat ja sijainti ennen julkaisua.": "Granska rubriker, priser, bilder och plats innan publicering.",
    "euroa": "euro",
    "Uusi": "Ny",
    "Hyvä": "Bra",
    "Käytetty": "Begagnad",
    "Korjattava": "Behöver repareras",
    "ATV - mönkijä": "ATV - fyrhjuling",
    "UTV - mönkijä": "UTV - fyrhjuling",
    "Sport - mönkijä": "Sport - fyrhjuling",
    "Työ - mönkijä": "Arbete - fyrhjuling",
    "Maasto - mönkijä": "Terräng - fyrhjuling",
    "6x6 - mönkijä": "6x6 - fyrhjuling",
    "Lasten - mönkijä": "Barn - fyrhjuling",
    "Motocross - crossi": "Motocross - cross",
    "Enduro - crossi": "Enduro - cross",
    "Supermoto - crossi": "Supermoto - cross",
    "Trial - crossi": "Trial - cross",
    "Pitbike - crossi": "Pitbike - cross",
    "Minicross - crossi": "Minicross - cross",
    "Crossover - moottorikelkka": "Crossover-snöskoter",
    "Deep snow - moottorikelkka": "Djupsnöskoter",
    "Sport - moottorikelkka": "Sportsnöskoter",
    "Touring - moottorikelkka": "Touringsnöskoter",
    "Työ - moottorikelkka": "Arbetssnöskoter",
    "Watercross - moottorikelkka": "Watercross-snöskoter",
    "Moottori & voimansiirto": "Motor & drivlina",
    "Kokonainen moottori": "Komplett motor"
  },
  no: {
    "Luo myynti-ilmoitus": "Opprett salgsannonse",
    "Valitse ilmoitustyyppi": "Velg annonsetype",
    "Valitse, haluatko listata useita osia samasta ajoneuvosta vai yksittäisen osan.": "Velg om du vil liste flere deler fra samme kjøretøy eller én enkelt del.",
    "Useampi osa samasta ajoneuvosta": "Flere deler fra samme kjøretøy",
    "Useampi ilmoitus": "Flere annonser",
    "Yksittäinen ilmoitus": "Enkelt annonse",
    "Listaa vain saman ajoneuvon osia samalla kertaa.": "List bare deler fra samme kjøretøy om gangen.",
    "Säästä aikaa ja hallitse kaikkia osia yhdessä paikassa.": "Spar tid og håndter alle deler på ett sted.",
    "Myy yksi osa kerrallaan.": "Selg én del om gangen.",
    "Sopii yksittäisille osille tai harvinaisille tuotteille.": "Passer for enkeltdeler eller sjeldne produkter.",
    "Ajoneuvon tiedot": "Kjøretøydetaljer",
    "Täytä ajoneuvon tiedot": "Fyll inn kjøretøydetaljer",
    "Valitse ajoneuvoluokka": "Velg kjøretøyklasse",
    "Moottorikelkka": "Snøscooter",
    "Kelkat, telastot, moottorit": "Scootere, beltesystem, motorer",
    "Mönkijä": "ATV",
    "ATV ja UTV osat": "ATV- og UTV-deler",
    "Motocross": "Motocross",
    "Crossi ja enduro": "Cross og enduro",
    "Mopo": "Moped",
    "Mopot ja piikit": "Mopeder og 125cc",
    "Tyyppi": "Type",
    "Merkki": "Merke",
    "Malli": "Modell",
    "Vuosimalli": "Årsmodell",
    "Moottorin koko (cc)": "Motorstørrelse (cc)",
    "Moottori / moottorityyppi": "Motor / motortype",
    "Valitse tyyppi": "Velg type",
    "Valitse merkki": "Velg merke",
    "Valitse malli": "Velg modell",
    "Valitse vuosimalli": "Velg årsmodell",
    "Valitse cc": "Velg cc",
    "Valitse moottorityyppi": "Velg motortype",
    "Kirjoita tyyppi": "Skriv type",
    "Kirjoita merkki": "Skriv merke",
    "Kirjoita malli": "Skriv modell",
    "Kirjoita vuosimalli": "Skriv årsmodell",
    "Kirjoita cc": "Skriv cc",
    "Kirjoita moottori": "Skriv motor",
    "Mopo - mopo": "Moped - moped",
    "Skootteri - mopo": "Scooter - moped",
    "Supermoto - mopo": "Supermoto - moped",
    "Enduro - mopo": "Enduro - moped",
    "Manki / monkey - mopo": "Monkey - moped",
    "Piikki 125 - mopo": "125cc - moped",
    "Jatka": "Fortsett",
    "Edellinen": "Forrige",
    "Seuraava": "Neste",
    "Nollaa": "Nullstill",
    "Muu": "Annet",
    "Siirry vaiheeseen": "Gå til steg",
    "Ilmoitustyyppi": "Annonsetype",
    "Ilmoitus": "Annonse",
    "Ilmoituksen tyyppi": "Annonsetype",
    "Valitse myyntityyppi": "Velg salgstype",
    "Kategoria ja hinta": "Kategori og pris",
    "Valitse kategoria ja hinta": "Velg kategori og pris",
    "Valitse kategoriointi": "Velg kategorisering",
    "Valitse tuotteen kategoria ja lisää hinta.": "Velg produktkategori og legg til pris.",
    "Valitse yhteinen kategoriointi ilmoituksille.": "Velg felles kategorisering for annonsene.",
    "Kunto & sijainti": "Tilstand og sted",
    "Kunto ja sijainti": "Tilstand og sted",
    "Valitse kunto ja paikka": "Velg tilstand og sted",
    "Kuntoluokitus": "Tilstandsklassifisering",
    "Kuvat": "Bilder",
    "Lisää tuotteen kuvat": "Legg til produktbilder",
    "Otsikko ja kuvaus": "Tittel og beskrivelse",
    "Lisää otsikko ja kuvaus": "Legg til tittel og beskrivelse",
    "Julkaise": "Publiser",
    "Tarkista ja julkaise": "Kontroller og publiser",
    "Tarkista tiedot ennen julkaisua.": "Kontroller opplysningene før publisering.",
    "Julkaistaan...": "Publiserer...",
    "Seuraava osa": "Neste del",
    "Toimitukseen": "Til levering",
    "Julkaisuun": "Til publisering",
    "Kategorisoi tuote": "Kategoriser produkt",
    "Kategorisoi tuotteesi": "Kategoriser produktet ditt",
    "Pääkategoria": "Hovedkategori",
    "Alakategoria": "Underkategori",
    "Tarkempi kategoria": "Mer detaljert kategori",
    "Ei kategorioita": "Ingen kategorier",
    "Valitse pääkategoria": "Velg hovedkategori",
    "Valitse alakategoria": "Velg underkategori",
    "Hinta (€)": "Pris (€)",
    "Tarkat tiedot rakentavat luottamusta ja auttavat myymään nopeammin.": "Nøyaktige opplysninger bygger tillit og hjelper deg å selge raskere.",
    "Esim. Ski-Doo variaattori 850 E-TEC": "F.eks. Ski-Doo variator 850 E-TEC",
    "Ilmoitus valmis julkaistavaksi": "Annonsen er klar til publisering",
    "Ilmoitukset valmiina julkaisuun": "Annonsene er klare til publisering",
    "Ilmoituksen myyjä": "Annonsens selger",
    "Voit valita erillisen myyjän. Jos et valitse, ilmoitus julkaistaan yrityksen tiedoilla.": "Du kan velge en egen selger. Hvis du ikke velger en, publiseres annonsen med bedriftens opplysninger.",
    "Yrityksen tiedot": "Bedriftens opplysninger",
    "Erillisiä myyjiä ei ole lisätty. Ilmoitus julkaistaan yrityksen tiedoilla.": "Ingen egne selgere er lagt til. Annonsen publiseres med bedriftens opplysninger.",
    "Ilmoituksen pikatiedot": "Annonsens hurtiginfo",
    "Ilmoituksen yhteenveto": "Annonseoversikt",
    "Yksittäinen ilmoitus valmis julkaistavaksi": "Enkeltannonse klar til publisering",
    "Multi-ilmoitukset valmiina julkaisuun": "Flere annonser klare til publisering",
    "Tarkista vielä otsikot, hinnat, kuvat ja sijainti ennen julkaisua.": "Kontroller titler, priser, bilder og sted før publisering.",
    "euroa": "euro",
    "Uusi": "Ny",
    "Hyvä": "God",
    "Käytetty": "Brukt",
    "Korjattava": "Må repareres",
    "ATV - mönkijä": "ATV - firehjuling",
    "UTV - mönkijä": "UTV - firehjuling",
    "Sport - mönkijä": "Sport - firehjuling",
    "Työ - mönkijä": "Arbeid - firehjuling",
    "Maasto - mönkijä": "Terreng - firehjuling",
    "6x6 - mönkijä": "6x6 - firehjuling",
    "Lasten - mönkijä": "Barn - firehjuling",
    "Motocross - crossi": "Motocross - cross",
    "Enduro - crossi": "Enduro - cross",
    "Supermoto - crossi": "Supermoto - cross",
    "Trial - crossi": "Trial - cross",
    "Pitbike - crossi": "Pitbike - cross",
    "Minicross - crossi": "Minicross - cross",
    "Crossover - moottorikelkka": "Crossover-snøscooter",
    "Deep snow - moottorikelkka": "Dypsnø-snøscooter",
    "Sport - moottorikelkka": "Sportssnøscooter",
    "Touring - moottorikelkka": "Touringsnøscooter",
    "Työ - moottorikelkka": "Arbeidssnøscooter",
    "Watercross - moottorikelkka": "Watercross-snøscooter",
    "Moottori & voimansiirto": "Motor og drivverk",
    "Kokonainen moottori": "Komplett motor"
  },
  et: {
    "Luo myynti-ilmoitus": "Loo müügikuulutus",
    "Valitse ilmoitustyyppi": "Vali kuulutuse tüüp",
    "Valitse, haluatko listata useita osia samasta ajoneuvosta vai yksittäisen osan.": "Vali, kas lisad mitu osa samast sõidukist või ühe üksiku osa.",
    "Useampi osa samasta ajoneuvosta": "Mitu osa samast sõidukist",
    "Useampi ilmoitus": "Mitu kuulutust",
    "Yksittäinen ilmoitus": "Üks kuulutus",
    "Listaa vain saman ajoneuvon osia samalla kertaa.": "Lisa korraga ainult sama sõiduki osi.",
    "Säästä aikaa ja hallitse kaikkia osia yhdessä paikassa.": "Säästa aega ja halda kõiki osi ühes kohas.",
    "Myy yksi osa kerrallaan.": "Müü üks osa korraga.",
    "Sopii yksittäisille osille tai harvinaisille tuotteille.": "Sobib üksikutele osadele või haruldastele toodetele.",
    "Ajoneuvon tiedot": "Sõiduki andmed",
    "Täytä ajoneuvon tiedot": "Täida sõiduki andmed",
    "Valitse ajoneuvoluokka": "Vali sõidukiklass",
    "Moottorikelkka": "Mootorsaan",
    "Kelkat, telastot, moottorit": "Saanid, roomikud, mootorid",
    "Mönkijä": "ATV",
    "ATV ja UTV osat": "ATV ja UTV osad",
    "Motocross": "Motokross",
    "Crossi ja enduro": "Kross ja enduro",
    "Mopo": "Mopeed",
    "Mopot ja piikit": "Mopeedid ja 125cc rattad",
    "Tyyppi": "Tüüp",
    "Merkki": "Mark",
    "Malli": "Mudel",
    "Vuosimalli": "Aasta",
    "Moottorin koko (cc)": "Mootori suurus (cc)",
    "Moottori / moottorityyppi": "Mootor / mootoritüüp",
    "Valitse tyyppi": "Vali tüüp",
    "Valitse merkki": "Vali mark",
    "Valitse malli": "Vali mudel",
    "Valitse vuosimalli": "Vali aasta",
    "Valitse cc": "Vali cc",
    "Valitse moottorityyppi": "Vali mootoritüüp",
    "Kirjoita tyyppi": "Sisesta tüüp",
    "Kirjoita merkki": "Sisesta mark",
    "Kirjoita malli": "Sisesta mudel",
    "Kirjoita vuosimalli": "Sisesta aasta",
    "Kirjoita cc": "Sisesta cc",
    "Kirjoita moottori": "Sisesta mootor",
    "Mopo - mopo": "Mopeed - mopeed",
    "Skootteri - mopo": "Roller - mopeed",
    "Supermoto - mopo": "Supermoto - mopeed",
    "Enduro - mopo": "Enduro - mopeed",
    "Manki / monkey - mopo": "Monkey - mopeed",
    "Piikki 125 - mopo": "125cc - mopeed",
    "Jatka": "Jätka",
    "Edellinen": "Eelmine",
    "Seuraava": "Järgmine",
    "Nollaa": "Lähtesta",
    "Muu": "Muu",
    "Siirry vaiheeseen": "Mine sammu",
    "Ilmoitustyyppi": "Kuulutuse tüüp",
    "Ilmoitus": "Kuulutus",
    "Ilmoituksen tyyppi": "Kuulutuse tüüp",
    "Valitse myyntityyppi": "Vali müügitüüp",
    "Kategoria ja hinta": "Kategooria ja hind",
    "Valitse kategoria ja hinta": "Vali kategooria ja hind",
    "Valitse kategoriointi": "Vali kategoriseerimine",
    "Valitse tuotteen kategoria ja lisää hinta.": "Vali tootekategooria ja lisa hind.",
    "Valitse yhteinen kategoriointi ilmoituksille.": "Vali kuulutustele ühine kategoriseerimine.",
    "Kunto & sijainti": "Seisukord ja asukoht",
    "Kunto ja sijainti": "Seisukord ja asukoht",
    "Valitse kunto ja paikka": "Vali seisukord ja asukoht",
    "Kuntoluokitus": "Seisukorra hinnang",
    "Kuvat": "Pildid",
    "Lisää tuotteen kuvat": "Lisa tootepildid",
    "Otsikko ja kuvaus": "Pealkiri ja kirjeldus",
    "Lisää otsikko ja kuvaus": "Lisa pealkiri ja kirjeldus",
    "Julkaise": "Avalda",
    "Tarkista ja julkaise": "Kontrolli ja avalda",
    "Tarkista tiedot ennen julkaisua.": "Kontrolli andmed enne avaldamist üle.",
    "Julkaistaan...": "Avaldatakse...",
    "Seuraava osa": "Järgmine osa",
    "Toimitukseen": "Tarne juurde",
    "Julkaisuun": "Avaldamise juurde",
    "Kategorisoi tuote": "Kategoriseeri toode",
    "Kategorisoi tuotteesi": "Kategoriseeri oma toode",
    "Pääkategoria": "Põhikategooria",
    "Alakategoria": "Alamkategooria",
    "Tarkempi kategoria": "Täpsem kategooria",
    "Ei kategorioita": "Kategooriaid pole",
    "Valitse pääkategoria": "Vali põhikategooria",
    "Valitse alakategoria": "Vali alamkategooria",
    "Hinta (€)": "Hind (€)",
    "Tarkat tiedot rakentavat luottamusta ja auttavat myymään nopeammin.": "Täpsed andmed loovad usaldust ja aitavad kiiremini müüa.",
    "Esim. Ski-Doo variaattori 850 E-TEC": "Nt Ski-Doo variaator 850 E-TEC",
    "Ilmoitus valmis julkaistavaksi": "Kuulutus on avaldamiseks valmis",
    "Ilmoitukset valmiina julkaisuun": "Kuulutused on avaldamiseks valmis",
    "Ilmoituksen myyjä": "Kuulutuse müüja",
    "Voit valita erillisen myyjän. Jos et valitse, ilmoitus julkaistaan yrityksen tiedoilla.": "Saad valida eraldi müüja. Kui sa ei vali, avaldatakse kuulutus ettevõtte andmetega.",
    "Yrityksen tiedot": "Ettevõtte andmed",
    "Erillisiä myyjiä ei ole lisätty. Ilmoitus julkaistaan yrityksen tiedoilla.": "Eraldi müüjaid pole lisatud. Kuulutus avaldatakse ettevõtte andmetega.",
    "Ilmoituksen pikatiedot": "Kuulutuse kiirinfo",
    "Ilmoituksen yhteenveto": "Kuulutuse kokkuvõte",
    "Yksittäinen ilmoitus valmis julkaistavaksi": "Üks kuulutus on avaldamiseks valmis",
    "Multi-ilmoitukset valmiina julkaisuun": "Mitu kuulutust on avaldamiseks valmis",
    "Tarkista vielä otsikot, hinnat, kuvat ja sijainti ennen julkaisua.": "Kontrolli enne avaldamist pealkirjad, hinnad, pildid ja asukoht üle.",
    "euroa": "eurot",
    "Uusi": "Uus",
    "Hyvä": "Hea",
    "Käytetty": "Kasutatud",
    "Korjattava": "Vajab remonti",
    "ATV - mönkijä": "ATV - nelik",
    "UTV - mönkijä": "UTV - nelik",
    "Sport - mönkijä": "Sport - nelik",
    "Työ - mönkijä": "Töö - nelik",
    "Maasto - mönkijä": "Maastik - nelik",
    "6x6 - mönkijä": "6x6 - nelik",
    "Lasten - mönkijä": "Laste - nelik",
    "Motocross - crossi": "Motokross - kross",
    "Enduro - crossi": "Enduro - kross",
    "Supermoto - crossi": "Supermoto - kross",
    "Trial - crossi": "Trial - kross",
    "Pitbike - crossi": "Pitbike - kross",
    "Minicross - crossi": "Minicross - kross",
    "Crossover - moottorikelkka": "Crossover-mootorsaan",
    "Deep snow - moottorikelkka": "Sügava lume mootorsaan",
    "Sport - moottorikelkka": "Sport-mootorsaan",
    "Touring - moottorikelkka": "Touring-mootorsaan",
    "Työ - moottorikelkka": "Töö-mootorsaan",
    "Watercross - moottorikelkka": "Watercross-mootorsaan",
    "Moottori & voimansiirto": "Mootor ja jõuülekanne",
    "Kokonainen moottori": "Komplektne mootor"
  }
};

Object.assign(extraSellTranslations.en, {
  "Ensimmäinen ilmoitus julkaistu": "First listing published",
  "Arvioi ilmoituksen luonti": "Rate the listing creation",
  "Anna nopea arvio kategoriasta, tiedoista ja kuvien lisäämisestä. Näet ilmoituksen heti tämän jälkeen.": "Give a quick rating for the category, details and photo upload. You will see the listing right after this.",
  "Kategorian valinta": "Category selection",
  "Tuotetietojen lisääminen": "Adding product details",
  "Kuvien lisääminen": "Adding photos",
  "Kokonaisuus": "Overall",
  "Kommentti ylläpidolle (vapaaehtoinen)": "Comment for support (optional)",
  "Mikä toimi hyvin tai mikä tuntui hankalalta?": "What worked well or felt difficult?",
  "Ohita": "Skip",
  "Tallennetaan...": "Saving...",
  "Lähetä arvio": "Send rating",
  "Anna ainakin kokonaisarvio tähdillä.": "Give at least an overall star rating.",
  "Arvion tallennus epäonnistui.": "Saving the rating failed."
});

Object.assign(extraSellTranslations.sv, {
  "Ensimmäinen ilmoitus julkaistu": "Första annonsen publicerad",
  "Arvioi ilmoituksen luonti": "Betygsätt skapandet av annonsen",
  "Anna nopea arvio kategoriasta, tiedoista ja kuvien lisäämisestä. Näet ilmoituksen heti tämän jälkeen.": "Ge ett snabbt betyg för kategori, uppgifter och bilduppladdning. Du ser annonsen direkt efter detta.",
  "Kategorian valinta": "Kategorival",
  "Tuotetietojen lisääminen": "Lägga till produktuppgifter",
  "Kuvien lisääminen": "Lägga till bilder",
  "Kokonaisuus": "Helhet",
  "Kommentti ylläpidolle (vapaaehtoinen)": "Kommentar till supporten (valfritt)",
  "Mikä toimi hyvin tai mikä tuntui hankalalta?": "Vad fungerade bra eller kändes svårt?",
  "Ohita": "Hoppa över",
  "Tallennetaan...": "Sparar...",
  "Lähetä arvio": "Skicka betyg",
  "Anna ainakin kokonaisarvio tähdillä.": "Ge åtminstone ett helhetsbetyg med stjärnor.",
  "Arvion tallennus epäonnistui.": "Det gick inte att spara betyget."
});

Object.assign(extraSellTranslations.no, {
  "Ensimmäinen ilmoitus julkaistu": "Første annonse publisert",
  "Arvioi ilmoituksen luonti": "Vurder opprettelsen av annonsen",
  "Anna nopea arvio kategoriasta, tiedoista ja kuvien lisäämisestä. Näet ilmoituksen heti tämän jälkeen.": "Gi en rask vurdering av kategori, opplysninger og bildeopplasting. Du ser annonsen rett etter dette.",
  "Kategorian valinta": "Kategorivalg",
  "Tuotetietojen lisääminen": "Legge til produktopplysninger",
  "Kuvien lisääminen": "Legge til bilder",
  "Kokonaisuus": "Helhet",
  "Kommentti ylläpidolle (vapaaehtoinen)": "Kommentar til support (valgfritt)",
  "Mikä toimi hyvin tai mikä tuntui hankalalta?": "Hva fungerte bra eller føltes vanskelig?",
  "Ohita": "Hopp over",
  "Tallennetaan...": "Lagrer...",
  "Lähetä arvio": "Send vurdering",
  "Anna ainakin kokonaisarvio tähdillä.": "Gi minst en samlet stjernevurdering.",
  "Arvion tallennus epäonnistui.": "Kunne ikke lagre vurderingen."
});

Object.assign(extraSellTranslations.et, {
  "Ensimmäinen ilmoitus julkaistu": "Esimene kuulutus avaldatud",
  "Arvioi ilmoituksen luonti": "Hinda kuulutuse loomist",
  "Anna nopea arvio kategoriasta, tiedoista ja kuvien lisäämisestä. Näet ilmoituksen heti tämän jälkeen.": "Anna kiire hinnang kategooriale, andmetele ja piltide lisamisele. Näed kuulutust kohe pärast seda.",
  "Kategorian valinta": "Kategooria valik",
  "Tuotetietojen lisääminen": "Tooteandmete lisamine",
  "Kuvien lisääminen": "Piltide lisamine",
  "Kokonaisuus": "Üldhinnang",
  "Kommentti ylläpidolle (vapaaehtoinen)": "Kommentaar toele (valikuline)",
  "Mikä toimi hyvin tai mikä tuntui hankalalta?": "Mis toimis hästi või tundus keeruline?",
  "Ohita": "Jäta vahele",
  "Tallennetaan...": "Salvestatakse...",
  "Lähetä arvio": "Saada hinnang",
  "Anna ainakin kokonaisarvio tähdillä.": "Anna vähemalt üldine tärnihinnang.",
  "Arvion tallennus epäonnistui.": "Hinnangu salvestamine ebaõnnestus."
});

Object.assign(extraSellTranslations.en, {
  "Monikategoriointi": "Multi-categorization",
  "Valitse koko ajoneuvo tai poimi myytÃ¤vÃ¤t osat pÃ¤Ã¤kategorian ja alakategorian kautta.": "Select the whole vehicle or pick the parts for sale through main and subcategories.",
  "valittu": "selected",
  "valittua": "selected",
  "osa": "part",
  "osaa": "parts",
  "nÃ¤kyy": "shown",
  "pÃ¤Ã¤kategoriaa valittu": "main categories selected",
  "Myyn koko ajoneuvon": "I am selling the whole vehicle",
  "valitsee kaikki ajoneuvon osakategoriat kerralla.": "selects all vehicle part categories at once.",
  "Kategoriat ja osat": "Categories and parts",
  "Hae kategoriaa tai osaa": "Search category or part",
  "Ei osumia": "No matches",
  "Kokeile toista hakusanaa.": "Try another search term.",
  "Valittuja kategorioita": "Selected categories",
  "Ilmoituksesi nÃ¤kyy": "Your listing appears in",
  "kategoriassa": "categories",
  "NÃ¤ytÃ¤ valitut": "Show selected",
  "Piilota valitut": "Hide selected",
  "Ei valittuja kategorioita": "No selected categories",
  "Valitse osia listasta, niin ne nÃ¤kyvÃ¤t tÃ¤ssÃ¤.": "Select parts from the list and they will appear here.",
  "LisÃ¤Ã¤ myytÃ¤vÃ¤t osat": "Add the parts for sale",
  "ilmoitusta tÃ¤ytetty": "listings completed",
  "valittua tuotetta": "selected products",
  "Osanumero / OEM": "Part number / OEM",
  "Kirjoita osanumero": "Enter part number",
  "LisÃ¤tiedot": "Additional details",
  "Kirjoita lisÃ¤tiedot, viat, sopivuus tai muut huomiot": "Write details, defects, compatibility or other notes",
  "Kirjoita telamaton mitat, kunto, sopivuus ja muut huomiot": "Write track mat dimensions, condition, compatibility and other notes",
  "LisÃ¤Ã¤ kuvat": "Add photos",
  "Ei valittuja osia": "No selected parts",
  "Palaa kategoriaan ja valitse myytÃ¤vÃ¤t osat tai koko ajoneuvo.": "Go back to categories and select the parts for sale or the whole vehicle.",
  "Ehdotus": "Suggestion",
  "Haetaan...": "Loading...",
  "Poista ilmoitus": "Remove listing",
  "Poista kuva": "Remove image",
  "Sijainti ja toimitus": "Location and delivery",
  "Kaupunki tai paikkakunta": "City or town"
});

Object.assign(extraSellTranslations.sv, {
  "Monikategoriointi": "Multikategorisering",
  "Valitse koko ajoneuvo tai poimi myytÃ¤vÃ¤t osat pÃ¤Ã¤kategorian ja alakategorian kautta.": "Välj hela fordonet eller plocka delarna som säljs via huvudkategori och underkategori.",
  "valittu": "valt",
  "valittua": "valda",
  "osa": "del",
  "osaa": "delar",
  "nÃ¤kyy": "visas",
  "pÃ¤Ã¤kategoriaa valittu": "huvudkategorier valda",
  "Myyn koko ajoneuvon": "Jag säljer hela fordonet",
  "valitsee kaikki ajoneuvon osakategoriat kerralla.": "väljer alla fordonsdelkategorier på en gång.",
  "Kategoriat ja osat": "Kategorier och delar",
  "Hae kategoriaa tai osaa": "Sök kategori eller del",
  "Ei osumia": "Inga träffar",
  "Kokeile toista hakusanaa.": "Prova ett annat sökord.",
  "Valittuja kategorioita": "Valda kategorier",
  "Ilmoituksesi nÃ¤kyy": "Din annons visas i",
  "kategoriassa": "kategorier",
  "NÃ¤ytÃ¤ valitut": "Visa valda",
  "Piilota valitut": "Dölj valda",
  "Ei valittuja kategorioita": "Inga valda kategorier",
  "Valitse osia listasta, niin ne nÃ¤kyvÃ¤t tÃ¤ssÃ¤.": "Välj delar i listan så visas de här.",
  "LisÃ¤Ã¤ myytÃ¤vÃ¤t osat": "Lägg till delarna som säljs",
  "ilmoitusta tÃ¤ytetty": "annonser ifyllda",
  "valittua tuotetta": "valda produkter",
  "Osanumero / OEM": "Reservdelsnummer / OEM",
  "Kirjoita osanumero": "Skriv reservdelsnummer",
  "LisÃ¤tiedot": "Ytterligare uppgifter",
  "Kirjoita lisÃ¤tiedot, viat, sopivuus tai muut huomiot": "Skriv ytterligare uppgifter, fel, kompatibilitet eller andra kommentarer",
  "Kirjoita telamaton mitat, kunto, sopivuus ja muut huomiot": "Skriv mattans mått, skick, kompatibilitet och andra kommentarer",
  "LisÃ¤Ã¤ kuvat": "Lägg till bilder",
  "Ei valittuja osia": "Inga valda delar",
  "Palaa kategoriaan ja valitse myytÃ¤vÃ¤t osat tai koko ajoneuvo.": "Gå tillbaka till kategorin och välj delarna som säljs eller hela fordonet.",
  "Ehdotus": "Förslag",
  "Haetaan...": "Hämtar...",
  "Poista ilmoitus": "Ta bort annons",
  "Poista kuva": "Ta bort bild",
  "Sijainti ja toimitus": "Plats och leverans",
  "Kaupunki tai paikkakunta": "Stad eller ort"
});

Object.assign(extraSellTranslations.no, {
  "Monikategoriointi": "Multikategorisering",
  "Valitse koko ajoneuvo tai poimi myytÃ¤vÃ¤t osat pÃ¤Ã¤kategorian ja alakategorian kautta.": "Velg hele kjøretøyet eller plukk delene som selges via hovedkategori og underkategori.",
  "valittu": "valgt",
  "valittua": "valgte",
  "osa": "del",
  "osaa": "deler",
  "nÃ¤kyy": "vises",
  "pÃ¤Ã¤kategoriaa valittu": "hovedkategorier valgt",
  "Myyn koko ajoneuvon": "Jeg selger hele kjøretøyet",
  "valitsee kaikki ajoneuvon osakategoriat kerralla.": "velger alle kjøretøyets delkategorier samtidig.",
  "Kategoriat ja osat": "Kategorier og deler",
  "Hae kategoriaa tai osaa": "Søk kategori eller del",
  "Ei osumia": "Ingen treff",
  "Kokeile toista hakusanaa.": "Prøv et annet søkeord.",
  "Valittuja kategorioita": "Valgte kategorier",
  "Ilmoituksesi nÃ¤kyy": "Annonsen din vises i",
  "kategoriassa": "kategorier",
  "NÃ¤ytÃ¤ valitut": "Vis valgte",
  "Piilota valitut": "Skjul valgte",
  "Ei valittuja kategorioita": "Ingen valgte kategorier",
  "Valitse osia listasta, niin ne nÃ¤kyvÃ¤t tÃ¤ssÃ¤.": "Velg deler fra listen, så vises de her.",
  "LisÃ¤Ã¤ myytÃ¤vÃ¤t osat": "Legg til delene som selges",
  "ilmoitusta tÃ¤ytetty": "annonser utfylt",
  "valittua tuotetta": "valgte produkter",
  "Osanumero / OEM": "Delenummer / OEM",
  "Kirjoita osanumero": "Skriv delenummer",
  "LisÃ¤tiedot": "Tilleggsinformasjon",
  "Kirjoita lisÃ¤tiedot, viat, sopivuus tai muut huomiot": "Skriv tilleggsinformasjon, feil, kompatibilitet eller andre merknader",
  "Kirjoita telamaton mitat, kunto, sopivuus ja muut huomiot": "Skriv beltemattens mål, tilstand, kompatibilitet og andre merknader",
  "LisÃ¤Ã¤ kuvat": "Legg til bilder",
  "Ei valittuja osia": "Ingen valgte deler",
  "Palaa kategoriaan ja valitse myytÃ¤vÃ¤t osat tai koko ajoneuvo.": "Gå tilbake til kategorien og velg delene som selges eller hele kjøretøyet.",
  "Ehdotus": "Forslag",
  "Haetaan...": "Henter...",
  "Poista ilmoitus": "Fjern annonse",
  "Poista kuva": "Fjern bilde",
  "Sijainti ja toimitus": "Sted og levering",
  "Kaupunki tai paikkakunta": "By eller sted"
});

Object.assign(extraSellTranslations.et, {
  "Monikategoriointi": "Mitme kategooria valik",
  "Valitse koko ajoneuvo tai poimi myytÃ¤vÃ¤t osat pÃ¤Ã¤kategorian ja alakategorian kautta.": "Vali kogu sõiduk või vali müüdavad osad põhi- ja alamkategooria kaudu.",
  "valittu": "valitud",
  "valittua": "valitud",
  "osa": "osa",
  "osaa": "osa",
  "nÃ¤kyy": "kuvatakse",
  "pÃ¤Ã¤kategoriaa valittu": "põhikategooriat valitud",
  "Myyn koko ajoneuvon": "Müün kogu sõiduki",
  "valitsee kaikki ajoneuvon osakategoriat kerralla.": "valib kõik sõiduki osakategooriad korraga.",
  "Kategoriat ja osat": "Kategooriad ja osad",
  "Hae kategoriaa tai osaa": "Otsi kategooriat või osa",
  "Ei osumia": "Tulemusi pole",
  "Kokeile toista hakusanaa.": "Proovi teist otsingusõna.",
  "Valittuja kategorioita": "Valitud kategooriad",
  "Ilmoituksesi nÃ¤kyy": "Sinu kuulutus kuvatakse",
  "kategoriassa": "kategoorias",
  "NÃ¤ytÃ¤ valitut": "Näita valituid",
  "Piilota valitut": "Peida valitud",
  "Ei valittuja kategorioita": "Valitud kategooriaid pole",
  "Valitse osia listasta, niin ne nÃ¤kyvÃ¤t tÃ¤ssÃ¤.": "Vali loendist osad ja need kuvatakse siin.",
  "LisÃ¤Ã¤ myytÃ¤vÃ¤t osat": "Lisa müüdavad osad",
  "ilmoitusta tÃ¤ytetty": "kuulutust täidetud",
  "valittua tuotetta": "valitud toodet",
  "Osanumero / OEM": "Osanumber / OEM",
  "Kirjoita osanumero": "Sisesta osanumber",
  "LisÃ¤tiedot": "Lisainfo",
  "Kirjoita lisÃ¤tiedot, viat, sopivuus tai muut huomiot": "Sisesta lisainfo, vead, sobivus või muud märkused",
  "Kirjoita telamaton mitat, kunto, sopivuus ja muut huomiot": "Sisesta roomikumati mõõdud, seisukord, sobivus ja muud märkused",
  "LisÃ¤Ã¤ kuvat": "Lisa pildid",
  "Ei valittuja osia": "Valitud osi pole",
  "Palaa kategoriaan ja valitse myytÃ¤vÃ¤t osat tai koko ajoneuvo.": "Mine tagasi kategooriasse ja vali müüdavad osad või kogu sõiduk.",
  "Ehdotus": "Soovitus",
  "Haetaan...": "Laaditakse...",
  "Poista ilmoitus": "Eemalda kuulutus",
  "Poista kuva": "Eemalda pilt",
  "Sijainti ja toimitus": "Asukoht ja tarne",
  "Kaupunki tai paikkakunta": "Linn või asula"
});

function decodeMojibake(text: string) {
  if (!/[ÃÂ]/.test(text)) return text;

  let current = text;

  for (let round = 0; round < 3; round += 1) {
    try {
      const bytes = Uint8Array.from(current, (char) => char.charCodeAt(0));
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }

  return current;
}

function encodeMojibake(text: string) {
  try {
    return unescape(encodeURIComponent(text));
  } catch {
    return text;
  }
}

function translateSell(locale: Locale, text: string) {
  const normalizedText = decodeMojibake(text);
  if (locale === "fi") return normalizedText;

  const candidates = Array.from(new Set([
    text,
    normalizedText,
    encodeMojibake(text),
    encodeMojibake(normalizedText),
    encodeMojibake(encodeMojibake(normalizedText))
  ]));

  for (const candidate of candidates) {
    const translation = sellTranslations[locale][candidate] ?? extraSellTranslations[locale][candidate];
    if (translation) return decodeMojibake(translation);
  }

  return normalizedText;
}

type UploadedImage = {
  id: string;
  url: string;
  file: File;
  name: string;
  width: number;
  height: number;
  size: number;
};

type VehicleDetails = {
  vehicleSubtype: string;
  brand: string;
  model: string;
  year: string;
  engineCc: string;
  engineType: string;
};

type VehicleDetailKey = keyof VehicleDetails;

type PriceSuggestion = {
  avg: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  count: number;
  label: string;
};

type MultiPartSelection = {
  id: string;
  category: string;
  group: string;
  detail: string;
  title: string;
  price: string;
  condition: string;
  partNumber: string;
  description: string;
  images: UploadedImage[];
};

type MultiPartOption = Omit<MultiPartSelection, "title" | "price" | "condition" | "partNumber" | "description" | "images">;

type MultiPartGroup = {
  name: string;
  parts: MultiPartOption[];
};

type MultiPartSection = {
  name: string;
  groups: MultiPartGroup[];
  parts: MultiPartOption[];
};

type SellDraftImage = Omit<UploadedImage, "url">;

type SellDraftPart = Omit<MultiPartSelection, "images"> & {
  images: SellDraftImage[];
};

type SellDraftState = {
  version: 1;
  mode: ListingMode;
  currentStep: number;
  vehicleTypeKey: string;
  vehicleDetails: VehicleDetails;
  customVehicleFields: Partial<Record<VehicleDetailKey, boolean>>;
  category: string;
  categoryGroup: string;
  subcategory: string;
  condition: string;
  uploadedImages: SellDraftImage[];
  partNumber: string;
  listingPrice: string;
  multiParts: Record<string, SellDraftPart>;
  activeMultiListingIndex: number;
  expandedMultiCategories: Record<string, boolean>;
  expandedMultiSections: Record<string, boolean>;
  expandedMultiGroups: Record<string, boolean>;
  multiPartSearch: string;
  showSelectedMultiParts: boolean;
  expandedListingGroups: Record<string, boolean>;
  openMultiListingPartId: string | null;
  listingLocation: string;
  listingLocationTouched: boolean;
  deliveryMethod: DeliveryMethod;
  listingTitle: string;
  listingDescription: string;
  selectedCompanySellerId: string;
  savedAt: number;
};

const sellDraftDbName = "maskines-sell-drafts";
const sellDraftStoreName = "drafts";
const sellDraftKey = "current";

function openSellDraftDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB ei ole saatavilla."));
      return;
    }

    const request = indexedDB.open(sellDraftDbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(sellDraftStoreName);
    };
    request.onerror = () => reject(request.error ?? new Error("Luonnoksen avaaminen epaonnistui."));
    request.onsuccess = () => resolve(request.result);
  });
}

async function readSellDraft() {
  const db = await openSellDraftDb();

  return new Promise<SellDraftState | null>((resolve, reject) => {
    const transaction = db.transaction(sellDraftStoreName, "readonly");
    const request = transaction.objectStore(sellDraftStoreName).get(sellDraftKey);

    request.onerror = () => reject(request.error ?? new Error("Luonnoksen lukeminen epaonnistui."));
    request.onsuccess = () => resolve((request.result as SellDraftState | undefined) ?? null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Luonnoksen lukeminen epaonnistui."));
    };
  });
}

async function writeSellDraft(draft: SellDraftState) {
  const db = await openSellDraftDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(sellDraftStoreName, "readwrite");
    transaction.objectStore(sellDraftStoreName).put(draft, sellDraftKey);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Luonnoksen tallennus epaonnistui."));
    };
  });
}

async function deleteSellDraft() {
  const db = await openSellDraftDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(sellDraftStoreName, "readwrite");
    transaction.objectStore(sellDraftStoreName).delete(sellDraftKey);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Luonnoksen poistaminen epaonnistui."));
    };
  });
}

function toDraftImage(image: UploadedImage): SellDraftImage {
  return {
    id: image.id,
    file: image.file,
    name: image.name,
    width: image.width,
    height: image.height,
    size: image.size
  };
}

const singleSteps: SellStep[] = [
  { number: 1, title: "Ilmoituksen tyyppi", description: "Valitse myyntityyppi", icon: Tags },
  { number: 2, title: "Ajoneuvon tiedot", description: "Täytä ajoneuvon tiedot", icon: FileText },
  { number: 3, title: "Kategoria ja hinta", description: "Valitse kategoria ja hinta", icon: Layers3 },
  { number: 4, title: "Kunto & sijainti", description: "Valitse kunto ja paikka", icon: MapPin },
  { number: 5, title: "Kuvat", description: "Lisää tuotteen kuvat", icon: Camera },
  { number: 6, title: "Otsikko ja kuvaus", description: "Lisää otsikko ja kuvaus", icon: ClipboardList },
  { number: 7, title: "Julkaise", description: "Tarkista ja julkaise", icon: Send }
];

const multipleSteps: SellStep[] = [
  { number: 1, title: "Ilmoituksen tyyppi", description: "Valitse myyntityyppi", icon: Tags },
  { number: 2, title: "Ajoneuvon tiedot", description: "Täytä ajoneuvon tiedot", icon: FileText },
  { number: 3, title: "Kategoria ja hinta", description: "Valitse kategoriointi", icon: Layers3 },
  { number: 4, title: "Ilmoitukset", description: "Lisää myytävät osat", icon: PackagePlus },
  { number: 5, title: "Toimitus", description: "Valitse sijainti ja toimitus", icon: Truck },
  { number: 6, title: "Julkaise", description: "Tarkista ja julkaise", icon: Send }
];

const modeCards: Array<{
  value: ListingMode;
  title: string;
  text: string[];
  icon: typeof Layers3;
}> = [
  {
    value: "multiple",
    title: "Useampi osa samasta ajoneuvosta",
    text: [
      "Listaa vain saman ajoneuvon osia samalla kertaa.",
      "Säästä aikaa ja hallitse kaikkia osia yhdessä paikassa."
    ],
    icon: Layers3
  },
  {
    value: "single",
    title: "Yksittäinen ilmoitus",
    text: [
      "Myy yksi osa kerrallaan.",
      "Sopii yksittäisille osille tai harvinaisille tuotteille."
    ],
    icon: Tags
  }
];

const vehicleCards = [
  {
    key: "Moottorikelkka",
    title: "Moottorikelkka",
    description: "Kelkat, telastot, moottorit",
    image: "/vehicles/selector-snowmobile-3d.png",
    brands: ["Lynx", "Ski-Doo", "Polaris", "Arctic Cat"]
  },
  {
    key: "Mönkijä",
    title: "Mönkijä",
    description: "ATV ja UTV osat",
    image: "/vehicles/selector-atv-3d.png",
    brands: ["Can-Am", "Polaris", "Yamaha", "Honda"]
  },
  {
    key: "Motocross",
    title: "Motocross",
    description: "Crossi ja enduro",
    image: "/vehicles/selector-motocross-3d.png",
    brands: ["KTM", "Yamaha", "Honda", "Husqvarna"]
  },
  {
    key: "Mopo",
    title: "Mopo",
    description: "Mopot ja piikit",
    image: "/vehicles/selector-moped-3d.png",
    brands: ["Yamaha", "Derbi", "Rieju", "Aprilia"]
  }
];

const wholeVehicleLabels: Record<string, string> = {
  Moottorikelkka: "Kokokelkka",
  "Mönkijä": "Kokomönkijä",
  Motocross: "Kokocrossi",
  Mopo: "Kokomopo"
};

const vehicleYearOptions = Array.from({ length: 27 }, (_, index) =>
  String(2026 - index)
);

function normalizeSellVehicleType(value?: string | null) {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o");

  if (normalized === "auto" || normalized === "motocross") return "Motocross";
  if (normalized === "mopo" || normalized === "mopot") return "Mopo";
  if (normalized === "monkija" || normalized === "monkijat") return "Mönkijä";
  if (normalized === "moottorikelkka" || normalized === "moottorikelkat") return "Moottorikelkka";

  return "Moottorikelkka";
}

function isTrackMatText(value?: string | null) {
  return (value ?? "").trim().toLowerCase().includes("telamat");
}

function listingNeedsTrackMatDimensions(payload: ListingInput) {
  return [
    payload.vehicle_type,
    payload.category,
    payload.subcategory
  ].some(isTrackMatText);
}

function descriptionHasTrackMatDimensions(description: string) {
  const normalized = description.toLowerCase().replace(",", ".");
  const keywordMatches = normalized.match(/(?:pituus|leveys|korkeus|harja|lappu)\D{0,24}\d+/g) ?? [];
  const unitMatches = normalized.match(/\d+(?:\.\d+)?\s*(?:mm|cm|m|tuumaa|")/g) ?? [];
  const mitatMatch = normalized.match(/mitat?\D{0,24}((?:\d+(?:\.\d+)?\D{0,8}){2,})/);

  return (
    /\d+(?:\.\d+)?\s*(?:x|\*|×|\/)\s*\d+(?:\.\d+)?/.test(normalized) ||
    keywordMatches.length >= 2 ||
    unitMatches.length >= 2 ||
    Boolean(mitatMatch)
  );
}

const vehicleDetailPresets: Record<
  string,
  Omit<VehicleDetails, "brand"> & {
    typeOptions: string[];
    models: string[];
    engineCcs: string[];
    engineTypes: string[];
  }
> = {
  Moottorikelkka: {
    vehicleSubtype: "Sport - moottorikelkka",
    model: "MXZ X-RS 600 E-TEC",
    year: "2020",
    engineCc: "850",
    engineType: "E-TEC",
    typeOptions: [
      "Crossover - moottorikelkka",
      "Deep snow - moottorikelkka",
      "Sport - moottorikelkka",
      "Touring - moottorikelkka",
      "Työ - moottorikelkka",
      "Watercross - moottorikelkka"
    ],
    models: ["MXZ RS 600", "MXZ X-RS 600 E-TEC", "Rave RS", "Rave RE", "IQR 600", "ZR 600 R-XC"],
    engineCcs: ["440", "500", "600", "650", "800", "850", "900", "1000"],
    engineTypes: ["Rotax 600RS", "E-TEC", "Patriot", "Cleanfire", "C-TEC2", "4-tahti", "Turbo"]
  },
  Mönkijä: {
    vehicleSubtype: "ATV - mönkijä",
    model: "Outlander",
    year: "2020",
    engineCc: "850",
    engineType: "Rotax",
    typeOptions: [
      "ATV - mönkijä",
      "UTV - mönkijä",
      "Sport - mönkijä",
      "Työ - mönkijä",
      "Maasto - mönkijä",
      "6x6 - mönkijä",
      "Lasten - mönkijä"
    ],
    models: ["Outlander", "Renegade", "Sportsman", "Grizzly", "TRX", "CFORCE"],
    engineCcs: ["450", "500", "570", "700", "850", "1000"],
    engineTypes: ["Rotax", "EFI", "SOHC", "DOHC", "4-tahti"]
  },
  Motocross: {
    vehicleSubtype: "Motocross - crossi",
    model: "SX-F",
    year: "2020",
    engineCc: "250",
    engineType: "4-tahti",
    typeOptions: [
      "Motocross - crossi",
      "Enduro - crossi",
      "Supermoto - crossi",
      "Trial - crossi",
      "Pitbike - crossi",
      "Minicross - crossi"
    ],
    models: ["SX-F", "EXC-F", "YZ-F", "CRF", "FC", "KX"],
    engineCcs: ["125", "250", "300", "350", "450", "500"],
    engineTypes: ["2-tahti", "4-tahti", "TPI", "EFI"]
  },
  Mopo: {
    vehicleSubtype: "Mopo - mopo",
    model: "DT",
    year: "2020",
    engineCc: "50",
    engineType: "2-tahti",
    typeOptions: [
      "Mopo - mopo",
      "Skootteri - mopo",
      "Supermoto - mopo",
      "Enduro - mopo",
      "Manki / monkey - mopo",
      "Piikki 125 - mopo"
    ],
    models: ["DT", "Senda", "MRT", "RX", "SX", "RS"],
    engineCcs: ["50", "70", "80", "125"],
    engineTypes: ["2-tahti", "4-tahti", "AM6", "Derbi D50B0"]
  }
};

const vehicleBrandModels: Record<string, Record<string, string[]>> = {
  Moottorikelkka: {
    Lynx: ["Rave RS", "Rave Racing", "Rave RE", "Xterrain", "Boondocker", "Commander", "49 Ranger", "Adventure"],
    "Ski-Doo": ["MXZ RS", "MXZ X-RS", "Summit", "Freeride", "Renegade", "Backcountry", "Expedition"],
    Polaris: ["IQR", "600R", "XCR", "Indy XC", "Indy VR1", "RMK", "Switchback", "Voyageur", "Titan", "Matryx"],
    "Arctic Cat": ["ZR 600 R-XC", "ZR 6000 R XC", "ZR 600", "M 8000", "Riot", "Norseman", "Pantera", "Blast"]
  },
  "Mönkijä": {
    "Can-Am": ["Outlander", "Renegade", "Commander", "Maverick", "Traxter", "DS"],
    Polaris: ["Sportsman", "Scrambler", "Ranger", "RZR", "General", "Trail Boss"],
    Yamaha: ["Grizzly", "Kodiak", "YFZ", "Raptor", "Wolverine", "Viking"],
    Honda: ["TRX", "Foreman", "Rincon", "Rubicon", "FourTrax", "Pioneer"],
    CFMOTO: ["CFORCE", "UFORCE", "ZFORCE", "Gladiator", "CForce X", "UForce XL"]
  },
  Motocross: {
    KTM: ["SX", "SX-F", "EXC", "EXC-F", "XC", "XC-F"],
    Yamaha: ["YZ", "YZ-F", "WR", "TTR", "PW", "Tenere"],
    Honda: ["CR", "CRF", "CRF-R", "CRF-X", "XR", "Africa Twin"],
    Kawasaki: ["KX", "KX-F", "KLX", "KDX", "KLR", "KLE"],
    Husqvarna: ["TC", "FC", "TE", "FE", "TX", "FX"],
    Suzuki: ["RM", "RM-Z", "DR-Z", "DR", "RMX", "TS"],
    GasGas: ["MC", "MC-F", "EC", "EC-F", "EX", "EX-F"],
    Beta: ["RR", "RR Racing", "Xtrainer", "RX", "Evo"],
    Sherco: ["SE", "SEF", "ST", "SC", "Factory"],
    TM: ["MX", "EN", "SMR", "Fi", "ES"]
  },
  Mopo: {
    Yamaha: ["DT", "Aerox", "TZR", "WR", "Slider", "Neos"],
    Honda: ["Monkey", "Dax", "MTX", "NSR", "Vision", "Zoomer"],
    Derbi: ["Senda", "DRD", "Xtreme", "Racing", "GPR", "Variant"],
    Rieju: ["MRT", "MRX", "RRX", "RS", "SMX", "Tango"],
    KTM: ["SX", "EXC", "Duke", "RC", "SMC"],
    Aprilia: ["SX", "RX", "RS", "SR", "Tuono", "Pegaso"]
  }
};

const vehicleModelEngines: Record<string, Record<string, Record<string, string[]>>> = {
  Moottorikelkka: {
    Lynx: {
      "Rave RS": ["Rotax 600RS", "Rotax 600R E-TEC"],
      "Rave Racing": ["Rotax 440", "Rotax 600 H.O.", "Rotax 600RS"],
      "Rave RE": ["Rotax 600R E-TEC", "Rotax 850 E-TEC"],
      Xterrain: ["Rotax 600R E-TEC", "Rotax 850 E-TEC", "Rotax 900 ACE Turbo R"],
      Boondocker: ["Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo R"],
      Commander: ["Rotax 600R E-TEC", "Rotax 900 ACE", "Rotax 900 ACE Turbo"],
      "49 Ranger": ["Rotax 600R E-TEC", "Rotax 900 ACE"],
      Adventure: ["Rotax 600 ACE", "Rotax 900 ACE"]
    },
    "Ski-Doo": {
      "MXZ RS": ["Rotax 600RS"],
      Summit: ["Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo R"],
      Freeride: ["Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo R"],
      "MXZ X-RS": ["Rotax 600R E-TEC", "Rotax 850 E-TEC"],
      Renegade: ["Rotax 600R E-TEC", "Rotax 850 E-TEC", "Rotax 900 ACE Turbo R"],
      Backcountry: ["Rotax 600R E-TEC", "Rotax 850 E-TEC"],
      Expedition: ["Rotax 600 ACE", "Rotax 900 ACE", "Rotax 900 ACE Turbo"]
    },
    Polaris: {
      IQR: ["Liberty 440", "Liberty 600 HO", "Cleanfire 600"],
      "600R": ["Patriot 600R"],
      XCR: ["Liberty 440", "Cleanfire 600", "Patriot 650", "Patriot 850"],
      "Indy XC": ["Patriot 600R", "Patriot 650", "Patriot 850"],
      "Indy VR1": ["Patriot 650", "Patriot 850"],
      RMK: ["Patriot 650", "Patriot 850", "Patriot Boost"],
      Switchback: ["Patriot 650", "Patriot 850"],
      Voyageur: ["Patriot 550", "Patriot 650"],
      Titan: ["Patriot 800", "Patriot 850"],
      Matryx: ["Patriot 650", "Patriot 850", "Patriot Boost"]
    },
    "Arctic Cat": {
      "ZR 600 R-XC": ["C-TEC2 600"],
      "ZR 6000 R XC": ["C-TEC2 600"],
      "ZR 600": ["C-TEC2 600"],
      "M 8000": ["C-TEC2 800"],
      Riot: ["C-TEC2 600", "C-TEC2 800"],
      Norseman: ["C-TEC2 600", "Yamaha 998 Turbo"],
      Pantera: ["Yamaha 998 Turbo", "C-TEC2 7000"],
      Blast: ["C-TEC2 4000"]
    }
  },
  "Mönkijä": {
    "Can-Am": {
      Outlander: ["Rotax 450", "Rotax 570", "Rotax 650", "Rotax 850", "Rotax 1000R"],
      Renegade: ["Rotax 650", "Rotax 850", "Rotax 1000R"],
      Commander: ["Rotax 700", "Rotax 1000R"],
      Maverick: ["Rotax ACE 900", "Rotax 1000R", "Rotax 200 Turbo"],
      Traxter: ["Rotax V-Twin HD7", "Rotax V-Twin HD9", "Rotax V-Twin HD10"],
      DS: ["Rotax 450"]
    },
    Polaris: {
      Sportsman: ["ProStar 450", "ProStar 570", "ProStar 850", "ProStar XP 1000"],
      Scrambler: ["ProStar 850", "ProStar XP 1000"],
      Ranger: ["ProStar 570", "ProStar 1000", "ProStar XP 1000"],
      RZR: ["ProStar 900", "ProStar 1000", "ProStar Turbo R"],
      General: ["ProStar 1000", "ProStar XP 1000"],
      "Trail Boss": ["ProStar 570", "ProStar 850", "ProStar XP 1000"]
    },
    Yamaha: {
      Grizzly: ["Yamaha 686", "Yamaha 708"],
      Kodiak: ["Yamaha 421", "Yamaha 686", "Yamaha 708"],
      YFZ: ["Yamaha 449"],
      Raptor: ["Yamaha 686"],
      Wolverine: ["Yamaha 708", "Yamaha 847", "Yamaha 999"],
      Viking: ["Yamaha 686"]
    },
    Honda: {
      TRX: ["Honda 229", "Honda 420", "Honda 518", "Honda 675"],
      Foreman: ["Honda 518"],
      Rincon: ["Honda 675"],
      Rubicon: ["Honda 518"],
      FourTrax: ["Honda 420", "Honda 518"],
      Pioneer: ["Honda 475", "Honda 999"]
    },
    CFMOTO: {
      CFORCE: ["CFMOTO 400", "CFMOTO 450", "CFMOTO 520", "CFMOTO 625", "CFMOTO 850", "CFMOTO 1000"],
      UFORCE: ["CFMOTO 600", "CFMOTO 800", "CFMOTO 1000"],
      ZFORCE: ["CFMOTO 800", "CFMOTO 950", "CFMOTO 1000"],
      Gladiator: ["CFMOTO 450", "CFMOTO 520", "CFMOTO 625", "CFMOTO 850", "CFMOTO 1000"],
      "CForce X": ["CFMOTO 625", "CFMOTO 850", "CFMOTO 1000"],
      "UForce XL": ["CFMOTO 1000"]
    }
  },
  Motocross: {
    KTM: {
      SX: ["KTM SX 125", "KTM SX 250"],
      "SX-F": ["KTM SX-F 250", "KTM SX-F 350", "KTM SX-F 450"],
      EXC: ["KTM EXC 125", "KTM EXC 250", "KTM EXC 300"],
      "EXC-F": ["KTM EXC-F 250", "KTM EXC-F 350", "KTM EXC-F 450", "KTM EXC-F 500"],
      XC: ["KTM XC 125", "KTM XC 250", "KTM XC 300"],
      "XC-F": ["KTM XC-F 250", "KTM XC-F 350", "KTM XC-F 450"]
    },
    Yamaha: {
      YZ: ["Yamaha YZ125", "Yamaha YZ250"],
      "YZ-F": ["Yamaha YZ250F", "Yamaha YZ450F"],
      WR: ["Yamaha WR250F", "Yamaha WR450F"],
      TTR: ["Yamaha TT-R125", "Yamaha TT-R230"],
      PW: ["Yamaha PW50", "Yamaha PW80"],
      Tenere: ["Yamaha CP2 689"]
    },
    Honda: {
      CR: ["Honda CR125", "Honda CR250"],
      CRF: ["Honda CRF250", "Honda CRF450"],
      "CRF-R": ["Honda CRF250R", "Honda CRF450R"],
      "CRF-X": ["Honda CRF250X", "Honda CRF450X"],
      XR: ["Honda XR250", "Honda XR400", "Honda XR650"],
      "Africa Twin": ["Honda CRF1000L", "Honda CRF1100L"]
    },
    Kawasaki: {
      KX: ["Kawasaki KX125", "Kawasaki KX250"],
      "KX-F": ["Kawasaki KX250F", "Kawasaki KX450F"],
      KLX: ["Kawasaki KLX250", "Kawasaki KLX300", "Kawasaki KLX450R"],
      KDX: ["Kawasaki KDX200", "Kawasaki KDX220"],
      KLR: ["Kawasaki KLR650"],
      KLE: ["Kawasaki KLE500"]
    },
    Husqvarna: {
      TC: ["Husqvarna TC125", "Husqvarna TC250"],
      FC: ["Husqvarna FC250", "Husqvarna FC350", "Husqvarna FC450"],
      TE: ["Husqvarna TE150", "Husqvarna TE250", "Husqvarna TE300"],
      FE: ["Husqvarna FE250", "Husqvarna FE350", "Husqvarna FE450", "Husqvarna FE501"],
      TX: ["Husqvarna TX300"],
      FX: ["Husqvarna FX350", "Husqvarna FX450"]
    },
    Suzuki: {
      RM: ["Suzuki RM125", "Suzuki RM250"],
      "RM-Z": ["Suzuki RM-Z250", "Suzuki RM-Z450"],
      "DR-Z": ["Suzuki DR-Z400"],
      DR: ["Suzuki DR350", "Suzuki DR650"],
      RMX: ["Suzuki RMX250"],
      TS: ["Suzuki TS125"]
    },
    GasGas: {
      MC: ["GasGas MC125", "GasGas MC250"],
      "MC-F": ["GasGas MC 250F", "GasGas MC 350F", "GasGas MC 450F"],
      EC: ["GasGas EC250", "GasGas EC300"],
      "EC-F": ["GasGas EC 250F", "GasGas EC 350F"],
      EX: ["GasGas EX250", "GasGas EX300"],
      "EX-F": ["GasGas EX 250F", "GasGas EX 350F", "GasGas EX 450F"]
    }
  },
  Mopo: {
    Yamaha: {
      DT: ["Minarelli AM6"],
      Aerox: ["Minarelli horizontal"],
      TZR: ["Minarelli AM6"],
      WR: ["Minarelli AM6"],
      Slider: ["Minarelli vertical"],
      Neos: ["Minarelli horizontal"]
    },
    Honda: {
      Monkey: ["Honda horizontal 50", "Honda horizontal 125"],
      Dax: ["Honda horizontal 50", "Honda horizontal 125"],
      MTX: ["Honda AD06", "Honda MTX 80"],
      NSR: ["Honda NSR 50", "Honda NSR 125"],
      Vision: ["Honda AF"],
      Zoomer: ["Honda GET"]
    },
    Derbi: {
      Senda: ["Derbi D50B0", "Derbi EBS"],
      DRD: ["Derbi D50B0", "Derbi EBS"],
      Xtreme: ["Derbi D50B0"],
      Racing: ["Derbi D50B0"],
      GPR: ["Derbi D50B0", "Derbi EBS"],
      Variant: ["Piaggio Hi-Per2"]
    },
    Rieju: {
      MRT: ["Minarelli AM6"],
      MRX: ["Minarelli AM6"],
      RRX: ["Minarelli AM6"],
      RS: ["Minarelli AM6"],
      SMX: ["Minarelli AM6"],
      Tango: ["Minarelli AM6"]
    },
    KTM: {
      SX: ["Minarelli AM6", "KTM SX 50", "KTM SX 65"],
      EXC: ["Minarelli AM6", "KTM EXC 125"],
      Duke: ["KTM LC4", "KTM 125 Duke"],
      RC: ["KTM 125 RC"],
      SMC: ["KTM LC4"]
    },
    Aprilia: {
      SX: ["Derbi D50B0", "Minarelli AM6"],
      RX: ["Derbi D50B0", "Minarelli AM6"],
      RS: ["Derbi D50B0", "Minarelli AM6"],
      SR: ["Piaggio Hi-Per2", "Minarelli horizontal"],
      Tuono: ["Minarelli AM6"],
      Pegaso: ["Rotax 655"]
    }
  }
};

const genericEngineTypeOptions = new Set(["2-tahti", "4-tahti", "EFI", "SOHC", "DOHC", "TPI", "Turbo"]);

const commonBrandModelsByVehicle: Record<string, Record<string, string[]>> = {
  snowmobile: {
    Lynx: ["Rave RS", "Rave Racing", "Rave", "Rave RE", "Xtrim", "Xterrain", "Boondocker", "Shredder", "Commander", "Adventure", "49 Ranger", "69 Ranger", "Yeti", "GLX"],
    "Ski-Doo": ["MXZ RS", "MXZ", "MXZ X-RS", "Summit", "Freeride", "Renegade", "Backcountry", "Expedition", "Skandic", "Tundra", "Grand Touring", "Formula", "Mach Z"],
    Polaris: ["IQR", "600R", "XCR", "Indy XC", "Indy", "Indy VR1", "RMK", "Pro RMK", "SKS", "Switchback", "Voyageur", "Titan", "Matryx", "Rush", "Assault", "Widetrak"],
    "Arctic Cat": ["ZR 600 R-XC", "ZR 6000 R XC", "ZR", "ZR 600", "M", "M 8000", "Riot", "Norseman", "Pantera", "Blast", "Bearcat", "Thundercat", "F", "Crossfire"],
    Yamaha: ["SR Viper", "Sidewinder", "Apex", "Nytro", "Phazer", "Venture", "Viking", "RS Vector", "RX-1"],
    Taiga: ["Nomad", "Ekko", "Atlas"]
  },
  atv: {
    "Can-Am": ["Outlander", "Renegade", "Commander", "Maverick", "Traxter", "DS"],
    Polaris: ["Sportsman", "Scrambler", "Ranger", "RZR", "General", "Trail Boss", "Phoenix", "Outlaw"],
    Yamaha: ["Grizzly", "Kodiak", "YFZ", "Raptor", "Wolverine", "Viking", "Banshee", "Blaster", "Warrior"],
    Honda: ["TRX", "FourTrax", "Foreman", "Rancher", "Rubicon", "Rincon", "Pioneer", "Talon"],
    CFMOTO: ["CFORCE", "UFORCE", "ZFORCE", "Gladiator", "CForce X", "UForce XL"],
    Suzuki: ["KingQuad", "LT-Z", "LT-R", "Eiger", "Ozark", "Vinson"],
    Kawasaki: ["Brute Force", "KFX", "KVF", "KLF", "Mule", "Teryx", "Prairie"],
    "Arctic Cat": ["Alterra", "TRV", "DVX", "Prowler", "Wildcat"],
    TGB: ["Blade", "Target", "Landmax"],
    Kymco: ["MXU", "Maxxer", "UXV"],
    Linhai: ["M", "LH", "T-Boss"],
    Segway: ["Snarler", "Fugleman", "Villain"],
    Hisun: ["Tactic", "Forge", "Sector", "Strike"]
  },
  motocross: {
    KTM: ["SX", "SX-F", "EXC", "EXC-F", "XC", "XC-F", "XC-W", "SMR", "Duke", "Adventure"],
    Yamaha: ["YZ", "YZ-F", "WR", "TTR", "PW", "Tenere", "XT"],
    Honda: ["CR", "CRF", "CRF-R", "CRF-X", "XR", "Africa Twin", "CB"],
    Kawasaki: ["KX", "KX-F", "KLX", "KDX", "KLR", "KLE", "Ninja"],
    Husqvarna: ["TC", "FC", "TE", "FE", "TX", "FX", "SM"],
    Suzuki: ["RM", "RM-Z", "DR-Z", "DR", "RMX", "TS", "LT"],
    GasGas: ["MC", "MC-F", "EC", "EC-F", "EX", "EX-F", "TXT"],
    Beta: ["RR", "RR Racing", "Xtrainer", "RX", "Evo"],
    Sherco: ["SE", "SEF", "ST", "SC", "Factory"],
    TM: ["MX", "EN", "SMR", "Fi", "ES"],
    Fantic: ["XX", "XE", "XEF", "Caballero"]
  },
  moped: {
    Yamaha: ["DT", "Aerox", "BW's", "BWS", "Booster", "Jog", "Slider", "Neos", "TZR", "WR", "Why"],
    MBK: ["Booster", "Nitro", "Ovetto", "X-Limit", "Stunt", "Rocket"],
    Derbi: ["Senda", "DRD", "Xtreme", "Racing", "GPR", "Atlantis", "Variant", "Terra"],
    Rieju: ["MRT", "MRX", "RRX", "RS", "RS2", "SMX", "Tango", "Spike"],
    Aprilia: ["SX", "RX", "RS", "SR", "Rally", "Sonic", "Mojito", "Tuono", "Pegaso"],
    Peugeot: ["Speedfight", "Trekker", "Vivacity", "Ludix", "Kisbee", "XPS", "XP6", "Jetforce", "Elyseo"],
    Piaggio: ["Zip", "Typhoon", "NRG", "Liberty", "Sfera", "Fly", "Vespa Primavera", "Vespa Sprint"],
    Gilera: ["Runner", "SMT", "RCR", "Stalker", "DNA", "Ice", "Storm"],
    Beta: ["RR", "RR Motard", "Ark", "Track", "Chrono"],
    KTM: ["SX", "EXC", "Duke", "RC", "SMC"],
    Honda: ["Monkey", "Dax", "MTX", "NSR", "Vision", "Zoomer", "X8R", "SFX"],
    Suzuki: ["PV", "S", "TS", "Katana", "Street Magic", "Address"],
    Kymco: ["Agility", "Super 8", "People", "Vitality", "Dink"],
    Keeway: ["RY6", "F-Act", "Matrix", "TX", "X-Ray"],
    CPI: ["SM", "SX", "Oliver", "Aragon", "Popcorn"],
    Generic: ["Trigger", "XOR", "Ideo", "Race"],
    Malaguti: ["F12", "F15", "XSM", "XTM", "Phantom"],
    Motorhispania: ["RYZ", "Furia", "RX", "Duna"],
    Sherco: ["SM", "SE", "HRD"],
    "Tunturi": ["Tiger", "City", "Super Sport", "Pappa", "Sport"],
    "Puch": ["Maxi", "Monza", "Cobra", "Ranger"],
    "Solifer": ["SM", "SFR", "Export", "Suzuki PV"]
  }
};

const commonModelEnginesByVehicle: Record<string, Record<string, Record<string, string[]>>> = {
  moped: {
    Yamaha: {
      DT: ["Minarelli AM6"],
      Aerox: ["Minarelli horizontal AC", "Minarelli horizontal LC"],
      "BW's": ["Minarelli vertical AC"],
      BWS: ["Minarelli vertical AC"],
      Booster: ["Minarelli vertical AC"],
      Jog: ["Minarelli horizontal AC", "Minarelli vertical AC"],
      Slider: ["Minarelli vertical AC"],
      Neos: ["Minarelli horizontal AC"],
      TZR: ["Minarelli AM6"],
      WR: ["Minarelli AM6"],
      Why: ["Minarelli horizontal AC"]
    },
    MBK: {
      Booster: ["Minarelli vertical AC"],
      Nitro: ["Minarelli horizontal LC"],
      Ovetto: ["Minarelli horizontal AC"],
      "X-Limit": ["Minarelli AM6"],
      Stunt: ["Minarelli vertical AC"],
      Rocket: ["Minarelli vertical AC"]
    },
    Derbi: {
      Senda: ["Derbi D50B0", "Derbi EBS", "Derbi EBE"],
      DRD: ["Derbi D50B0", "Derbi EBS"],
      Xtreme: ["Derbi D50B0", "Derbi EBS"],
      Racing: ["Derbi D50B0", "Derbi EBS"],
      GPR: ["Derbi D50B0", "Derbi EBS", "Derbi EBE"],
      Atlantis: ["Piaggio Hi-Per2", "Derbi EBS"],
      Variant: ["Piaggio Hi-Per2"],
      Terra: ["Derbi D50B0"]
    },
    Rieju: {
      MRT: ["Minarelli AM6"],
      MRX: ["Minarelli AM6"],
      RRX: ["Minarelli AM6"],
      RS: ["Minarelli AM6"],
      RS2: ["Minarelli AM6"],
      SMX: ["Minarelli AM6"],
      Tango: ["Minarelli AM6"],
      Spike: ["Minarelli AM6"]
    },
    Aprilia: {
      SX: ["Derbi D50B0", "Minarelli AM6"],
      RX: ["Derbi D50B0", "Minarelli AM6"],
      RS: ["Derbi D50B0", "Minarelli AM6"],
      SR: ["Piaggio Hi-Per2 AC", "Piaggio Hi-Per2 LC", "Minarelli horizontal AC", "Minarelli horizontal LC", "Morini"],
      Rally: ["Minarelli horizontal AC", "Piaggio Hi-Per2 AC"],
      Sonic: ["Minarelli horizontal AC", "Minarelli horizontal LC"],
      Mojito: ["Piaggio Hi-Per2 AC"],
      Tuono: ["Minarelli AM6"],
      Pegaso: ["Rotax 655"]
    },
    Peugeot: {
      Speedfight: ["Peugeot horizontal AC", "Peugeot horizontal LC"],
      Trekker: ["Peugeot horizontal AC"],
      Vivacity: ["Peugeot horizontal AC"],
      Ludix: ["Peugeot horizontal AC", "Peugeot horizontal LC"],
      Kisbee: ["Peugeot 4T", "GY6 139QMB"],
      XPS: ["Minarelli AM6"],
      XP6: ["Minarelli AM6"],
      Jetforce: ["Peugeot horizontal LC", "Peugeot TSDI"],
      Elyseo: ["Peugeot horizontal AC"]
    },
    Piaggio: {
      Zip: ["Piaggio Hi-Per2 AC", "Piaggio Hi-Per2 LC", "Piaggio 4T"],
      Typhoon: ["Piaggio Hi-Per2 AC"],
      NRG: ["Piaggio Hi-Per2 LC"],
      Liberty: ["Piaggio Hi-Per2 AC", "Piaggio 4T"],
      Sfera: ["Piaggio Hi-Per2 AC"],
      Fly: ["Piaggio Hi-Per2 AC", "Piaggio 4T"],
      "Vespa Primavera": ["Piaggio Hi-Per2 AC", "Piaggio iGet"],
      "Vespa Sprint": ["Piaggio Hi-Per2 AC", "Piaggio iGet"]
    },
    Gilera: {
      Runner: ["Piaggio Hi-Per2 LC", "Piaggio PureJet"],
      SMT: ["Derbi D50B0"],
      RCR: ["Derbi D50B0"],
      Stalker: ["Piaggio Hi-Per2 AC"],
      DNA: ["Piaggio Hi-Per2 LC"],
      Ice: ["Piaggio Hi-Per2 AC"],
      Storm: ["Piaggio Hi-Per2 AC"]
    },
    Beta: {
      RR: ["Minarelli AM6"],
      "RR Motard": ["Minarelli AM6"],
      Ark: ["Minarelli horizontal AC", "Minarelli horizontal LC"],
      Track: ["Minarelli horizontal AC"],
      Chrono: ["Minarelli horizontal AC"]
    },
    Honda: {
      Monkey: ["Honda horizontal 50", "Honda horizontal 125"],
      Dax: ["Honda horizontal 50", "Honda horizontal 125"],
      MTX: ["Honda AD06", "Honda MTX 80"],
      NSR: ["Honda NSR 50", "Honda NSR 125"],
      Vision: ["Honda AF"],
      Zoomer: ["Honda GET"],
      X8R: ["Honda AF"],
      SFX: ["Honda AF"]
    },
    Kymco: {
      Agility: ["GY6 139QMB", "Kymco 4T"],
      "Super 8": ["GY6 139QMB", "Kymco 2T"],
      People: ["Kymco 2T", "Kymco 4T"],
      Vitality: ["Kymco 2T"],
      Dink: ["Kymco 2T", "Kymco 4T"]
    },
    Keeway: {
      RY6: ["Minarelli horizontal copy AC"],
      "F-Act": ["Minarelli horizontal copy AC"],
      Matrix: ["Minarelli horizontal copy AC"],
      TX: ["Minarelli AM6 copy"],
      "X-Ray": ["Minarelli AM6 copy"]
    },
    CPI: {
      SM: ["Minarelli AM6 copy"],
      SX: ["Minarelli AM6 copy"],
      Oliver: ["Minarelli horizontal copy AC"],
      Aragon: ["Minarelli horizontal copy AC"],
      Popcorn: ["Minarelli horizontal copy AC"]
    },
    Generic: {
      Trigger: ["Minarelli AM6 copy"],
      XOR: ["Minarelli horizontal copy AC"],
      Ideo: ["Minarelli horizontal copy AC"],
      Race: ["Minarelli AM6 copy"]
    },
    Malaguti: {
      F12: ["Minarelli horizontal AC", "Minarelli horizontal LC"],
      F15: ["Minarelli horizontal LC"],
      XSM: ["Minarelli AM6"],
      XTM: ["Minarelli AM6"],
      Phantom: ["Minarelli horizontal AC", "Minarelli horizontal LC"]
    },
    Motorhispania: {
      RYZ: ["Minarelli AM6"],
      Furia: ["Minarelli AM6"],
      RX: ["Minarelli AM6"],
      Duna: ["Minarelli AM6"]
    },
    Sherco: {
      SM: ["Minarelli AM6"],
      SE: ["Minarelli AM6"],
      HRD: ["Minarelli AM6"]
    }
  },
  snowmobile: {
    Lynx: {
      "Rave RS": ["Rotax 600RS", "Rotax 600R E-TEC"],
      "Rave Racing": ["Rotax 440", "Rotax 600 H.O.", "Rotax 600RS"],
      Rave: ["Rotax 600 E-TEC", "Rotax 600R E-TEC", "Rotax 850 E-TEC"],
      "Rave RE": ["Rotax 600R E-TEC", "Rotax 850 E-TEC"],
      Xtrim: ["Rotax 600 E-TEC", "Rotax 600R E-TEC", "Rotax 900 ACE"],
      Xterrain: ["Rotax 600R E-TEC", "Rotax 850 E-TEC", "Rotax 900 ACE Turbo R"],
      Boondocker: ["Rotax 800R E-TEC", "Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo R"],
      Shredder: ["Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo R"],
      Commander: ["Rotax 600 E-TEC", "Rotax 600R E-TEC", "Rotax 900 ACE", "Rotax 900 ACE Turbo"],
      Adventure: ["Rotax 600 ACE", "Rotax 900 ACE"],
      "49 Ranger": ["Rotax 600 ACE", "Rotax 600R E-TEC", "Rotax 900 ACE"],
      "69 Ranger": ["Rotax 600 ACE", "Rotax 900 ACE"],
      Yeti: ["Rotax 550F", "Rotax 600 ACE"],
      GLX: ["Rotax 503", "Rotax 583", "Rotax 643"]
    },
    "Ski-Doo": {
      "MXZ RS": ["Rotax 600RS"],
      MXZ: ["Rotax 600 E-TEC", "Rotax 600R E-TEC", "Rotax 850 E-TEC"],
      "MXZ X-RS": ["Rotax 600R E-TEC", "Rotax 850 E-TEC"],
      Summit: ["Rotax 800R E-TEC", "Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo R"],
      Freeride: ["Rotax 800R E-TEC", "Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo R"],
      Renegade: ["Rotax 600R E-TEC", "Rotax 850 E-TEC", "Rotax 900 ACE Turbo R"],
      Backcountry: ["Rotax 600R E-TEC", "Rotax 850 E-TEC"],
      Expedition: ["Rotax 600 ACE", "Rotax 900 ACE", "Rotax 900 ACE Turbo"],
      Skandic: ["Rotax 600 ACE", "Rotax 900 ACE", "Rotax 600R E-TEC"],
      Tundra: ["Rotax 550F", "Rotax 600 ACE"],
      "Grand Touring": ["Rotax 600 ACE", "Rotax 900 ACE", "Rotax 900 ACE Turbo"],
      Formula: ["Rotax 583", "Rotax 670"],
      "Mach Z": ["Rotax 809", "Rotax 1000 SDI"]
    },
    Polaris: {
      IQR: ["Liberty 440", "Liberty 600 HO", "Cleanfire 600"],
      "600R": ["Patriot 600R"],
      XCR: ["Liberty 440", "Cleanfire 600", "Patriot 650", "Patriot 850"],
      "Indy XC": ["Patriot 600R", "Patriot 650", "Patriot 850"],
      Indy: ["Patriot 550", "Patriot 650", "Patriot 850"],
      "Indy VR1": ["Patriot 650", "Patriot 850"],
      RMK: ["Patriot 650", "Patriot 850", "Patriot Boost"],
      "Pro RMK": ["Patriot 650", "Patriot 850", "Patriot Boost"],
      SKS: ["Patriot 800", "Patriot 850"],
      Switchback: ["Patriot 650", "Patriot 850"],
      Voyageur: ["Patriot 550", "Patriot 650"],
      Titan: ["Patriot 800", "Patriot 850"],
      Matryx: ["Patriot 650", "Patriot 850", "Patriot Boost"],
      Rush: ["Cleanfire 600", "Patriot 650", "Patriot 850"],
      Assault: ["Patriot 800", "Patriot 850"],
      Widetrak: ["Fuji 500", "Liberty 600"]
    },
    "Arctic Cat": {
      "ZR 600 R-XC": ["C-TEC2 600"],
      "ZR 6000 R XC": ["C-TEC2 600"],
      ZR: ["Suzuki 600", "C-TEC2 600", "C-TEC2 800", "Yamaha 998 Turbo"],
      "ZR 600": ["C-TEC2 600"],
      "M 8000": ["C-TEC2 800"],
      Riot: ["C-TEC2 600", "C-TEC2 800"],
      Thundercat: ["Yamaha 998 Turbo"],
      F: ["Suzuki 500", "Suzuki 600", "Suzuki 700"],
      Crossfire: ["Suzuki 600", "Suzuki 700", "Suzuki 800"]
    },
    Yamaha: {
      "SR Viper": ["Yamaha Genesis 1049"],
      Sidewinder: ["Yamaha Genesis 998 Turbo"],
      Apex: ["Yamaha Genesis 998"],
      Nytro: ["Yamaha Genesis 1049"],
      Phazer: ["Yamaha 499 twin"],
      Venture: ["Yamaha Genesis 1049", "Yamaha 499 twin"],
      Viking: ["Yamaha 540 fan", "Yamaha Genesis 1049"],
      "RS Vector": ["Yamaha Genesis 973"],
      "RX-1": ["Yamaha Genesis 998"]
    }
  },
  atv: {
    "Can-Am": {
      Outlander: ["Rotax 400", "Rotax 450", "Rotax 500", "Rotax 570", "Rotax 650", "Rotax 800", "Rotax 850", "Rotax 1000R"],
      Renegade: ["Rotax 500", "Rotax 570", "Rotax 800", "Rotax 850", "Rotax 1000R"],
      Commander: ["Rotax 700", "Rotax 800R", "Rotax 1000R"],
      Maverick: ["Rotax ACE 900", "Rotax 1000R", "Rotax 200 Turbo"],
      Traxter: ["Rotax V-Twin HD7", "Rotax V-Twin HD9", "Rotax V-Twin HD10"],
      DS: ["Rotax 250", "Rotax 450", "Rotax 650"]
    },
    Polaris: {
      Sportsman: ["ProStar 450", "ProStar 500", "ProStar 570", "ProStar 850", "ProStar XP 1000"],
      Scrambler: ["ProStar 500", "ProStar 850", "ProStar XP 1000"],
      Ranger: ["ProStar 570", "ProStar 900", "ProStar 1000", "ProStar XP 1000"],
      RZR: ["ProStar 800", "ProStar 900", "ProStar 1000", "ProStar Turbo R"],
      General: ["ProStar 1000", "ProStar XP 1000"],
      "Trail Boss": ["ProStar 570", "ProStar 850", "ProStar XP 1000"],
      Phoenix: ["Polaris 200"],
      Outlaw: ["Polaris 50", "Polaris 90", "Polaris 525"]
    },
    Yamaha: {
      Grizzly: ["Yamaha 660", "Yamaha 686", "Yamaha 708"],
      Kodiak: ["Yamaha 421", "Yamaha 686", "Yamaha 708"],
      YFZ: ["Yamaha 449"],
      Raptor: ["Yamaha 350", "Yamaha 660", "Yamaha 686"],
      Wolverine: ["Yamaha 708", "Yamaha 847", "Yamaha 999"],
      Viking: ["Yamaha 686"],
      Banshee: ["Yamaha 347 twin"],
      Blaster: ["Yamaha 195"],
      Warrior: ["Yamaha 348"]
    },
    Honda: {
      TRX: ["Honda 229", "Honda 250", "Honda 397", "Honda 420", "Honda 450", "Honda 518", "Honda 675"],
      FourTrax: ["Honda 250", "Honda 300", "Honda 350", "Honda 420", "Honda 518"],
      Foreman: ["Honda 450", "Honda 500", "Honda 518"],
      Rancher: ["Honda 350", "Honda 420"],
      Rubicon: ["Honda 500", "Honda 518"],
      Rincon: ["Honda 675"],
      Pioneer: ["Honda 475", "Honda 999"],
      Talon: ["Honda 999"]
    },
    CFMOTO: {
      CFORCE: ["CFMOTO 400", "CFMOTO 450", "CFMOTO 520", "CFMOTO 625", "CFMOTO 800", "CFMOTO 850", "CFMOTO 1000"],
      UFORCE: ["CFMOTO 600", "CFMOTO 800", "CFMOTO 1000"],
      ZFORCE: ["CFMOTO 800", "CFMOTO 950", "CFMOTO 1000"],
      Gladiator: ["CFMOTO 450", "CFMOTO 520", "CFMOTO 625", "CFMOTO 850", "CFMOTO 1000"],
      "CForce X": ["CFMOTO 625", "CFMOTO 850", "CFMOTO 1000"],
      "UForce XL": ["CFMOTO 1000"]
    },
    Suzuki: {
      KingQuad: ["Suzuki 400", "Suzuki 450", "Suzuki 500", "Suzuki 700", "Suzuki 750"],
      "LT-Z": ["Suzuki 400"],
      "LT-R": ["Suzuki 450"],
      Eiger: ["Suzuki 376"],
      Ozark: ["Suzuki 246"],
      Vinson: ["Suzuki 500"]
    },
    Kawasaki: {
      "Brute Force": ["Kawasaki 650 V-Twin", "Kawasaki 750 V-Twin"],
      KFX: ["Kawasaki 400", "Kawasaki 450", "Kawasaki 700"],
      KVF: ["Kawasaki 360", "Kawasaki 650", "Kawasaki 750"],
      KLF: ["Kawasaki 220", "Kawasaki 300"],
      Mule: ["Kawasaki 401", "Kawasaki 617", "Kawasaki 812"],
      Teryx: ["Kawasaki 783 V-Twin"],
      Prairie: ["Kawasaki 360", "Kawasaki 650", "Kawasaki 700"]
    }
  }
};

function uniqueOptions(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getVehiclePreset(vehicleKey: string) {
  return vehicleDetailPresets[vehicleKey] ?? vehicleDetailPresets.Mönkijä;
}

function getCommonVehicleKey(vehicleKey: string) {
  const normalized = vehicleKey.toLowerCase();
  if (normalized.includes("moottorikelkka")) return "snowmobile";
  if (normalized.includes("nkij")) return "atv";
  if (normalized.includes("motocross")) return "motocross";
  if (normalized.includes("mopo")) return "moped";
  return normalized;
}

function getBrandModelOptions(vehicleKey: string, brand: string, fallbackModels: string[]) {
  const brandModels = getVehicleMap(vehicleBrandModels, vehicleKey)?.[brand];
  const commonModels = commonBrandModelsByVehicle[getCommonVehicleKey(vehicleKey)]?.[brand];
  const combinedModels = uniqueOptions([...(brandModels ?? []), ...(commonModels ?? [])]);
  return combinedModels.length ? combinedModels : fallbackModels;
}

function getVehicleMap<T>(map: Record<string, T>, vehicleKey: string) {
  return map[vehicleKey] ?? map[vehicleKey.replace("?", "\\u00f6").replace("?", "\\u00e4")];
}

function getModelEngineOptions(
  vehicleKey: string,
  brand: string,
  model: string,
  fallbackEngineTypes: string[]
) {
  const vehicleEngines = getVehicleMap(vehicleModelEngines, vehicleKey);
  const brandEngines = vehicleEngines?.[brand];
  const modelEngines = brandEngines?.[model];
  const commonVehicleEngines = commonModelEnginesByVehicle[getCommonVehicleKey(vehicleKey)];
  const commonBrandEngines = commonVehicleEngines?.[brand];
  const commonModelEngines = commonBrandEngines?.[model];

  const exactModelEngines = uniqueOptions([...(modelEngines ?? []), ...(commonModelEngines ?? [])]);
  if (exactModelEngines.length) return exactModelEngines;

  const brandFallback = uniqueOptions(
    [
      ...Object.values(brandEngines ?? {}).flat(),
      ...Object.values(commonBrandEngines ?? {}).flat()
    ]
  );

  if (brandFallback.length) return brandFallback;

  return fallbackEngineTypes.filter((option) => !genericEngineTypeOptions.has(option));
}

function buildEmptyVehicleDetails(): VehicleDetails {
  return {
    vehicleSubtype: "",
    brand: "",
    model: "",
    year: "",
    engineCc: "",
    engineType: ""
  };
}

const maxUploadImageSide = 1080;
const compressedImageQuality = 0.84;
const listingImageWatermarkText = "maskines";
const fallbackListingImage =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80";
const listingImageBucket = "listing-images";

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Kuvan pakkaus epäonnistui."));
      },
      type,
      quality
    );
  });
}

async function imageFileToBitmap(file: File) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Kuvan lukeminen epäonnistui."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawListingImageWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const shortSide = Math.min(width, height);
  const fontSize = Math.max(16, Math.round(shortSide * 0.032));
  const paddingX = Math.round(fontSize * 0.72);
  const paddingY = Math.round(fontSize * 0.42);
  const margin = Math.max(14, Math.round(shortSide * 0.025));

  context.save();
  context.font = `800 ${fontSize}px Arial, Helvetica, sans-serif`;
  context.textBaseline = "middle";

  const textWidth = context.measureText(listingImageWatermarkText).width;
  const boxWidth = Math.ceil(textWidth + paddingX * 2);
  const boxHeight = Math.ceil(fontSize + paddingY * 2);
  const x = width - boxWidth - margin;
  const y = height - boxHeight - margin;
  const radius = Math.min(12, Math.round(boxHeight * 0.28));

  context.globalAlpha = 0.72;
  context.fillStyle = "#06111d";
  context.beginPath();
  context.roundRect(x, y, boxWidth, boxHeight, radius);
  context.fill();

  context.globalAlpha = 0.95;
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(0, 0, 0, 0.45)";
  context.shadowBlur = Math.max(2, Math.round(fontSize * 0.16));
  context.fillText(
    listingImageWatermarkText,
    x + paddingX,
    y + boxHeight / 2
  );

  context.restore();
}

async function prepareUploadImage(file: File) {
  const source = await imageFileToBitmap(file);
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const scale = Math.min(1, maxUploadImageSide / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d", {
    alpha: file.type === "image/png"
  });

  if (!context) throw new Error("Kuvan käsittely epäonnistui.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, targetWidth, targetHeight);
  drawListingImageWatermark(context, targetWidth, targetHeight);

  if ("close" in source && typeof source.close === "function") {
    source.close();
  }

  const outputType = file.type === "image/png" ? "image/jpeg" : "image/webp";
  const blob = await canvasToBlob(canvas, outputType, compressedImageQuality);
  const extension = outputType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "kuva";
  const compressedFile = new File([blob], `${baseName}-1080p-maskines.${extension}`, {
    type: outputType,
    lastModified: Date.now()
  });

  return {
    file: compressedFile,
    width: targetWidth,
    height: targetHeight,
    originalWidth: sourceWidth,
    originalHeight: sourceHeight
  };
}

function splitCategoryPath(value: string) {
  return value
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildFirstLevelOptions(subcategories: string[]): SelectOption[] {
  const seen = new Set<string>();
  const options: SelectOption[] = [];

  for (const subcategory of subcategories) {
    const first = splitCategoryPath(subcategory)[0] ?? subcategory.trim();
    if (!first || seen.has(first)) continue;
    seen.add(first);
    options.push({ value: first, label: first });
  }

  return options;
}

function buildDetailOptions(
  subcategories: string[],
  selectedGroup: string
): SelectOption[] {
  const seen = new Set<string>();
  const options: SelectOption[] = [];

  for (const subcategory of subcategories) {
    const parts = splitCategoryPath(subcategory);
    if ((parts[0] ?? subcategory) !== selectedGroup) continue;

    const label = parts.length > 1 ? parts.slice(1).join(" / ") : selectedGroup;
    if (!subcategory || seen.has(subcategory)) continue;
    seen.add(subcategory);
    options.push({ value: subcategory, label });
  }

  if (options.length === 0 && selectedGroup) {
    options.push({ value: selectedGroup, label: selectedGroup });
  }

  return options;
}

function makeMultiPartId(category: string, subcategory: string) {
  return `${category}::${subcategory}`;
}

function normalizeMultiPartGroupName(category: string, subcategory: string) {
  const parts = splitCategoryPath(subcategory);
  const first = parts[0] ?? subcategory.trim();
  const normalized = subcategory.toLowerCase();

  if (normalized.includes("kokonainen moottori")) return "Moottorit";
  if (normalized.includes("kokonainen voimansiirto")) return "Voimansiirto";
  if (normalized.includes("kokonainen kytkin")) return "Kytkimet";
  if (normalized.includes("kokonainen variaattori")) return "Variaattorit";
  if (normalized.includes("kokonainen telasto")) return "Telasto";
  if (normalized.includes("kokonainen alusta")) return "Alusta";
  if (normalized.includes("kokonainen iskunvaimennussarja")) return "Iskunvaimentimet";
  if (normalized.includes("kokonainen ohjaus")) return "Ohjaus";
  if (normalized.includes("kokonainen jarruj")) return "Jarrut";
  if (normalized.includes("kokonainen sukset")) return "Sukset";
  if (normalized.includes("kokonainen sähkö")) return "Sähkö";
  if (normalized.includes("kokonainen jäähdytys")) return "Jäähdytys";
  if (normalized.includes("kokonainen polttoaine")) return "Polttoainejärjestelmä";
  if (normalized.includes("kokonainen pakoputkisto")) return "Pakoputkisto";
  if (normalized.includes("kokonainen runko")) return "Runko";
  if (normalized.includes("kokonainen katesarja")) return "Katteet";

  return first || category;
}

function normalizeVehicleLabelKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "");
}

function getWholeVehicleLabel(vehicleKey: string, vehicleTitle: string) {
  const direct = wholeVehicleLabels[vehicleKey] ?? wholeVehicleLabels[vehicleTitle];
  if (direct) return direct;

  const normalized = normalizeVehicleLabelKey(`${vehicleKey} ${vehicleTitle}`);
  if (normalized.includes("monkija")) return "Kokomönkijä";
  if (normalized.includes("motocross") || normalized.includes("cross")) return "Kokocrossi";
  if (normalized.includes("mopo")) return "Kokomopo";
  return "Kokokelkka";
}

function buildMultiPartOption(category: string, subcategory: string): MultiPartOption {
  const parts = splitCategoryPath(subcategory);
  const group = normalizeMultiPartGroupName(category, subcategory);
  const rawDetail = parts.length > 1 ? parts.slice(1).join(" / ") : subcategory.trim();
  const detail = rawDetail || group;

  return {
    id: makeMultiPartId(category, subcategory),
    category,
    group,
    detail
  };
}

function buildMultiPartGroups(parts: MultiPartOption[]): MultiPartGroup[] {
  const groupMap = new Map<string, MultiPartOption[]>();
  const seenParts = new Set<string>();

  for (const part of parts) {
    const partKey = `${part.group.toLowerCase()}::${part.detail.toLowerCase()}`;
    if (seenParts.has(partKey)) continue;
    seenParts.add(partKey);

    groupMap.set(part.group, [
      ...(groupMap.get(part.group) ?? []),
      part
    ]);
  }

  return Array.from(groupMap, ([name, groupParts]) => ({
    name,
    parts: groupParts
  }));
}

function buildMultiPartSections(
  categoryName: string,
  parts: MultiPartOption[]
): MultiPartSection[] {
  const configuredGroups = subcategoryGroups[categoryName];
  if (!configuredGroups || Object.keys(configuredGroups).length <= 1) return [];

  const partsById = new Map(parts.map((part) => [part.id, part]));
  const usedPartIds = new Set<string>();
  const usedSectionNames = new Set<string>();
  const sections: MultiPartSection[] = [];

  for (const [sectionName, subcategoryNames] of Object.entries(configuredGroups)) {
    const sectionPartNames = subcategoryNames.length > 0 ? subcategoryNames : [sectionName];
    const sectionParts = sectionPartNames
      .map((subcategoryName) => partsById.get(makeMultiPartId(categoryName, subcategoryName)))
      .filter((part): part is MultiPartOption => Boolean(part));

    if (sectionParts.length === 0) continue;

    for (const part of sectionParts) {
      usedPartIds.add(part.id);
    }

    if (usedSectionNames.has(sectionName.toLowerCase())) continue;
    usedSectionNames.add(sectionName.toLowerCase());

    sections.push({
      name: sectionName,
      groups: buildMultiPartGroups(sectionParts),
      parts: sectionParts
    });
  }

  const remainingParts = parts.filter((part) => !usedPartIds.has(part.id));
  for (const group of buildMultiPartGroups(remainingParts)) {
    if (usedSectionNames.has(group.name.toLowerCase())) {
      const existingSection = sections.find(
        (section) => section.name.toLowerCase() === group.name.toLowerCase()
      );
      if (existingSection) {
        const existingPartIds = new Set(existingSection.parts.map((part) => part.id));
        const nextParts = group.parts.filter((part) => !existingPartIds.has(part.id));
        existingSection.parts.push(...nextParts);
        existingSection.groups = buildMultiPartGroups(existingSection.parts);
      }
      continue;
    }
    usedSectionNames.add(group.name.toLowerCase());

    sections.push({
      name: group.name,
      groups: [group],
      parts: group.parts
    });
  }

  return sections;
}

function hasNestedMultiPartItems(groups: MultiPartGroup[]) {
  return (
    groups.length > 1 ||
    groups.some((group) => group.parts.some((part) => part.detail !== group.name))
  );
}

function getMultiCategoryIcon(name: string) {
  const normalized = name.toLowerCase();

  if (normalized.includes("moottor")) return <Cog size={18} aria-hidden="true" />;
  if (normalized.includes("kytkim") || normalized.includes("variaattor") || normalized.includes("voimansiir")) {
    return <Wrench size={18} aria-hidden="true" />;
  }
  if (normalized.includes("renka") || normalized.includes("vante")) return <CircleDot size={18} aria-hidden="true" />;
  if (normalized.includes("jäähdy") || normalized.includes("polttoaine")) return <Droplets size={18} aria-hidden="true" />;
  if (normalized.includes("akku")) return <BatteryCharging size={18} aria-hidden="true" />;
  if (normalized.includes("runko")) return <ShieldCheck size={18} aria-hidden="true" />;
  if (normalized.includes("sähkö")) return <Zap size={18} aria-hidden="true" />;
  if (normalized.includes("pakoput")) return <Flame size={18} aria-hidden="true" />;
  if (normalized.includes("ohjaus")) return <Tags size={18} aria-hidden="true" />;
  if (normalized.includes("alusta")) return <Star size={18} aria-hidden="true" />;
  return <Layers3 size={18} aria-hidden="true" />;
}

export default function SellPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taxonomy = useTaxonomy();
  const { locale } = useLanguage();
  const st = useCallback((text: string) => translateSell(locale, text), [locale]);
  const formatSelectedCount = useCallback(
    (count: number) => `${count} ${st(count === 1 ? "valittu" : "valittua")}`,
    [st]
  );
  const formatPartCount = useCallback(
    (count: number) => `${count} ${st(count === 1 ? "osa" : "osaa")}`,
    [st]
  );
  const translateCategoryText = useCallback((text: string) => {
    const parts = splitCategoryPath(text);
    if (parts.length > 1) return parts.map((part) => st(part)).join(" / ");
    return st(text);
  }, [st]);
  const garagePrefillAppliedRef = useRef(false);
  const shellRef = useRef<HTMLElement | null>(null);
  const vehicleContentRef = useRef<HTMLElement | null>(null);
  const skipInitialStepScrollRef = useRef(true);
  const vehicleAutoAdvancedFieldsRef = useRef<Partial<Record<VehicleDetailKey, boolean>>>({});
  const categoryEntryAutoOpenRef = useRef(false);
  const [mode, setMode] = useState<ListingMode>("single");
  const [currentStep, setCurrentStep] = useState(1);
  const [vehicleType, setVehicleType] = useState(vehicleCards[1]);
  const [vehicleDetails, setVehicleDetails] = useState<VehicleDetails>(
    () => buildEmptyVehicleDetails()
  );
  const [customVehicleFields, setCustomVehicleFields] = useState<
    Partial<Record<VehicleDetailKey, boolean>>
  >({});
  const [openVehiclePresetField, setOpenVehiclePresetField] = useState<VehicleDetailKey | null>(null);
  const [category, setCategory] = useState("");
  const [categoryGroup, setCategoryGroup] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [condition, setCondition] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [previewImage, setPreviewImage] = useState<UploadedImage | null>(null);
  const [partNumber, setPartNumber] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [singlePriceSuggestion, setSinglePriceSuggestion] = useState<PriceSuggestion | null>(null);
  const [singlePriceSuggestionLoading, setSinglePriceSuggestionLoading] = useState(false);
  const [multiParts, setMultiParts] = useState<Record<string, MultiPartSelection>>({});
  const [activeMultiListingIndex, setActiveMultiListingIndex] = useState(0);
  const [multiPriceSuggestions, setMultiPriceSuggestions] = useState<Record<string, PriceSuggestion>>({});
  const [multiPriceSuggestionsLoading, setMultiPriceSuggestionsLoading] = useState(false);
  const [expandedMultiCategories, setExpandedMultiCategories] = useState<Record<string, boolean>>({});
  const [expandedMultiSections, setExpandedMultiSections] = useState<Record<string, boolean>>({});
  const [expandedMultiGroups, setExpandedMultiGroups] = useState<Record<string, boolean>>({});
  const [multiPartSearch, setMultiPartSearch] = useState("");
  const [showSelectedMultiParts, setShowSelectedMultiParts] = useState(false);
  const [expandedListingGroups, setExpandedListingGroups] = useState<Record<string, boolean>>({});
  const [openMultiListingPartId, setOpenMultiListingPartId] = useState<string | null>(null);
  const [listingLocation, setListingLocation] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("both");
  const [listingTitle, setListingTitle] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [publishError, setPublishError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState<ListingFeedbackPrompt | null>(null);
  const [categoryAutoOpenTarget, setCategoryAutoOpenTarget] = useState<{
    field: "category" | "group" | "detail";
    nonce: number;
  } | null>(null);
  const [accountProfile, setAccountProfile] = useState<UserProfile | null>(null);
  const [companySellers, setCompanySellers] = useState<CompanySeller[]>([]);
  const [selectedCompanySellerId, setSelectedCompanySellerId] = useState("");
  const uploadedImagesRef = useRef<UploadedImage[]>([]);
  const multiPartsRef = useRef<Record<string, MultiPartSelection>>({});
  const draftHydratedRef = useRef(false);
  const draftClearedOrPublishedRef = useRef(false);
  const vehicleFieldRefs = useRef<Partial<Record<VehicleDetailKey, HTMLInputElement | null>>>({});
  const listingLocationInputRef = useRef<HTMLInputElement | null>(null);
  const listingLocationTouchedRef = useRef(false);
  const steps =
    useMemo(
      () =>
        mode === "single"
          ? singleSteps
          : multipleSteps,
      [mode]
    );
  const vehicleCategories = useMemo(
    () => buildVehicleCategoriesFromTaxonomy(taxonomy, vehicleType.key),
    [taxonomy, vehicleType.key]
  );
  const taxonomyBrandOptions = useMemo(
    () => {
      const taxonomyBrands =
        taxonomy.vehicles.find((vehicle) => vehicle.key === vehicleType.key)?.brands ?? [];
      const commonBrands =
        Object.keys(commonBrandModelsByVehicle[getCommonVehicleKey(vehicleType.key)] ?? {});

      return uniqueOptions([
        ...taxonomyBrands,
        ...vehicleType.brands,
        ...commonBrands
      ]);
    },
    [taxonomy, vehicleType]
  );
  const vehiclePreset = getVehiclePreset(vehicleType.key);
  const modelOptions = useMemo(
    () =>
      getBrandModelOptions(
        vehicleType.key,
        vehicleDetails.brand,
        vehiclePreset.models
      ),
    [vehicleDetails.brand, vehiclePreset.models, vehicleType.key]
  );
  const engineTypeOptions = useMemo(
    () =>
      getModelEngineOptions(
        vehicleType.key,
        vehicleDetails.brand,
        vehicleDetails.model,
        vehiclePreset.engineTypes
      ),
    [vehicleDetails.brand, vehicleDetails.model, vehiclePreset.engineTypes, vehicleType.key]
  );
  const categoryOptions = useMemo(
    () => Object.keys(vehicleCategories),
    [vehicleCategories]
  );
  const selectedCategory =
    categoryOptions.includes(category)
      ? category
      : categoryOptions[0] ?? "";
  const selectedSubcategories = useMemo(
    () =>
      selectedCategory
        ? vehicleCategories[selectedCategory] ?? []
        : [],
    [selectedCategory, vehicleCategories]
  );
  const categoryGroupOptions = useMemo(
    () => buildFirstLevelOptions(selectedSubcategories),
    [selectedSubcategories]
  );
  const selectedCategoryGroup =
    categoryGroupOptions.some((option) => option.value === categoryGroup)
      ? categoryGroup
      : categoryGroupOptions[0]?.value ?? "";
  const detailCategoryOptions = useMemo(
    () => buildDetailOptions(selectedSubcategories, selectedCategoryGroup),
    [selectedSubcategories, selectedCategoryGroup]
  );
  const selectedDetailCategory =
    detailCategoryOptions.some((option) => option.value === subcategory)
      ? subcategory
      : detailCategoryOptions[0]?.value ?? "";
  const selectedSinglePartNeedsTrackMatDimensions = [
    selectedCategory,
    selectedCategoryGroup,
    selectedDetailCategory
  ].some(isTrackMatText);
  const isCompanyAccount = accountProfile?.account_type === "company";
  const selectedCompanySeller =
    companySellers.find((seller) => seller.id === selectedCompanySellerId) ?? null;
  const profileCity = accountProfile?.city?.trim() ?? "";
  const profileCountry = accountProfile?.country?.trim() ?? "";
  const multiPartTree = useMemo(
    () =>
      categoryOptions.map((categoryName) => {
        const subcategories = vehicleCategories[categoryName] ?? [];
        const parts = subcategories.map((item) => buildMultiPartOption(categoryName, item));
        const groups = buildMultiPartGroups(parts);

        return {
          name: categoryName,
          sections: buildMultiPartSections(categoryName, parts),
          groups,
          parts
        };
      }),
    [categoryOptions, vehicleCategories]
  );
  const visibleMultiPartTree = useMemo(
    () => {
      const query = multiPartSearch.trim().toLowerCase();
      if (!query) return multiPartTree;

      return multiPartTree
        .map((categoryItem) => {
          const categoryMatches = categoryItem.name.toLowerCase().includes(query);
          const groups = categoryItem.groups
            .map((groupItem) => {
              const groupMatches = groupItem.name.toLowerCase().includes(query);
              const parts =
                categoryMatches || groupMatches
                  ? groupItem.parts
                  : groupItem.parts.filter((part) => part.detail.toLowerCase().includes(query));

              return {
                ...groupItem,
                parts
              };
            })
            .filter((groupItem) => groupItem.parts.length > 0);
          const sections = categoryItem.sections
            .map((sectionItem) => {
              const sectionMatches = sectionItem.name.toLowerCase().includes(query);
              const sectionGroups = sectionItem.groups
                .map((groupItem) => {
                  const groupMatches = groupItem.name.toLowerCase().includes(query);
                  const parts =
                    categoryMatches || sectionMatches || groupMatches
                      ? groupItem.parts
                      : groupItem.parts.filter((part) => part.detail.toLowerCase().includes(query));

                  return {
                    ...groupItem,
                    parts
                  };
                })
                .filter((groupItem) => groupItem.parts.length > 0);

              return {
                ...sectionItem,
                groups: sectionGroups,
                parts: sectionGroups.flatMap((groupItem) => groupItem.parts)
              };
            })
            .filter((sectionItem) => sectionItem.parts.length > 0);

          return {
            ...categoryItem,
            sections,
            groups,
            parts:
              sections.length > 0
                ? sections.flatMap((sectionItem) => sectionItem.parts)
                : groups.flatMap((groupItem) => groupItem.parts)
          };
        })
        .filter((categoryItem) => categoryItem.parts.length > 0);
    },
    [multiPartSearch, multiPartTree]
  );
  const openMultiCategoryName =
    Object.keys(expandedMultiCategories).find((categoryName) => expandedMultiCategories[categoryName]) ?? "";
  const displayedMultiPartTree = useMemo(
    () => {
      if (!openMultiCategoryName) return visibleMultiPartTree;

      const openIndex = visibleMultiPartTree.findIndex(
        (categoryItem) => categoryItem.name === openMultiCategoryName
      );
      if (openIndex === -1) return visibleMultiPartTree;

      return visibleMultiPartTree.slice(openIndex, openIndex + 2);
    },
    [openMultiCategoryName, visibleMultiPartTree]
  );
  const selectedMultiPartList = useMemo(
    () => Object.values(multiParts),
    [multiParts]
  );
  const activeMultiListingPart =
    selectedMultiPartList[
      Math.min(activeMultiListingIndex, Math.max(selectedMultiPartList.length - 1, 0))
    ] ?? null;
  const multiPriceSuggestionKey = useMemo(
    () =>
      JSON.stringify(
        selectedMultiPartList.map((part) => ({
          id: part.id,
          category: part.category,
          subcategory: part.detail
        }))
      ),
    [selectedMultiPartList]
  );
  const selectedMultiPartGroups = useMemo(
    () => {
      const groups = new Map<string, MultiPartSelection[]>();

      for (const part of selectedMultiPartList) {
        const groupName = part.group || part.category;
        groups.set(groupName, [
          ...(groups.get(groupName) ?? []),
          part
        ]);
      }

      return Array.from(groups, ([name, parts]) => ({
        name,
        parts
      }));
    },
    [selectedMultiPartList]
  );
  const selectedMultiPartCategories = useMemo(
    () => {
      const categories = new Map<string, Map<string, MultiPartSelection[]>>();

      for (const part of selectedMultiPartList) {
        const categoryName = part.category || "Muut";
        const groupName = part.group || categoryName;
        const groups = categories.get(categoryName) ?? new Map<string, MultiPartSelection[]>();

        groups.set(groupName, [
          ...(groups.get(groupName) ?? []),
          part
        ]);
        categories.set(categoryName, groups);
      }

      return Array.from(categories, ([name, groups]) => ({
        name,
        groups: Array.from(groups, ([groupName, parts]) => ({
          name: groupName,
          parts
        })),
        parts: Array.from(groups.values()).flat()
      }));
    },
    [selectedMultiPartList]
  );
  const wholeVehicleOption = useMemo<MultiPartOption>(
    () => {
      const label = getWholeVehicleLabel(vehicleType.key, vehicleType.title);

      return {
        id: makeMultiPartId("Kokonainen ajoneuvo", label),
        category: "Kokonainen ajoneuvo",
        group: label,
        detail: label
      };
    },
    [vehicleType.key, vehicleType.title]
  );
  const allMultiPartOptions = multiPartTree.flatMap((item) => item.parts);
  const allMultiPartsSelected =
    allMultiPartOptions.length > 0 &&
    allMultiPartOptions.every((part) => Boolean(multiParts[part.id]));
  const selectedMultiCategoryCount = multiPartTree.filter((item) =>
    item.parts.some((part) => Boolean(multiParts[part.id]))
  ).length;
  const currentStepInfo =
    steps.find((step) => step.number === currentStep) ?? steps[0];
  const isLastStep =
    currentStep === steps.length;

  const createImageFromDraft = useCallback((image: SellDraftImage): UploadedImage => ({
    ...image,
    url: URL.createObjectURL(image.file)
  }), []);

  const revokeCurrentImageUrls = useCallback(() => {
    uploadedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
    Object.values(multiPartsRef.current).forEach((part) => {
      part.images.forEach((image) => URL.revokeObjectURL(image.url));
    });
    setPreviewImage(null);
  }, []);

  const hasDraftContent = useCallback(() => {
    if (currentStep > 1 || mode !== "single") return true;
    if (vehicleType.key !== vehicleCards[1].key) return true;
    if (Object.values(vehicleDetails).some((value) => value.trim())) return true;
    if (category || categoryGroup || subcategory || condition) return true;
    if (partNumber || listingPrice || listingLocation || listingTitle || listingDescription) return true;
    if (deliveryMethod !== "both" || selectedCompanySellerId) return true;
    if (uploadedImages.length > 0 || Object.keys(multiParts).length > 0) return true;
    return false;
  }, [
    category,
    categoryGroup,
    condition,
    currentStep,
    deliveryMethod,
    listingDescription,
    listingLocation,
    listingPrice,
    listingTitle,
    mode,
    multiParts,
    partNumber,
    selectedCompanySellerId,
    subcategory,
    uploadedImages.length,
    vehicleDetails,
    vehicleType.key
  ]);

  const buildDraftState = useCallback((): SellDraftState => ({
    version: 1,
    mode,
    currentStep,
    vehicleTypeKey: vehicleType.key,
    vehicleDetails,
    customVehicleFields,
    category,
    categoryGroup,
    subcategory,
    condition,
    uploadedImages: uploadedImages.map(toDraftImage),
    partNumber,
    listingPrice,
    multiParts: Object.fromEntries(
      Object.entries(multiParts).map(([id, part]) => [
        id,
        {
          ...part,
          images: part.images.map(toDraftImage)
        }
      ])
    ),
    activeMultiListingIndex,
    expandedMultiCategories,
    expandedMultiSections,
    expandedMultiGroups,
    multiPartSearch,
    showSelectedMultiParts,
    expandedListingGroups,
    openMultiListingPartId,
    listingLocation,
    listingLocationTouched: listingLocationTouchedRef.current,
    deliveryMethod,
    listingTitle,
    listingDescription,
    selectedCompanySellerId,
    savedAt: Date.now()
  }), [
    activeMultiListingIndex,
    category,
    categoryGroup,
    condition,
    currentStep,
    customVehicleFields,
    deliveryMethod,
    expandedListingGroups,
    expandedMultiCategories,
    expandedMultiGroups,
    expandedMultiSections,
    listingDescription,
    listingLocation,
    listingPrice,
    listingTitle,
    mode,
    multiPartSearch,
    multiParts,
    openMultiListingPartId,
    partNumber,
    selectedCompanySellerId,
    showSelectedMultiParts,
    subcategory,
    uploadedImages,
    vehicleDetails,
    vehicleType.key
  ]);

  const scrollStepToTop = useCallback(() => {
    if (typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = currentStep === 1
          ? shellRef.current
          : vehicleContentRef.current ?? shellRef.current;
        const top = target
          ? target.getBoundingClientRect().top + window.scrollY
          : 0;

        window.scrollTo({
          top: Math.max(0, top - 8),
          behavior: "auto"
        });
      });
    });
  }, [currentStep]);

  useEffect(() => {
    if (skipInitialStepScrollRef.current) {
      skipInitialStepScrollRef.current = false;
      return;
    }

    scrollStepToTop();
  }, [currentStep, activeMultiListingIndex, scrollStepToTop]);

  useEffect(() => {
    setActiveMultiListingIndex((index) => {
      if (selectedMultiPartList.length === 0) return 0;
      return Math.min(index, selectedMultiPartList.length - 1);
    });
  }, [selectedMultiPartList.length]);

  useEffect(() => {
    setOpenMultiListingPartId((current) =>
      current && selectedMultiPartList.some((part) => part.id === current)
        ? current
        : selectedMultiPartList[0]?.id ?? null
    );
  }, [selectedMultiPartList]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateDraft() {
      try {
        const draft = await readSellDraft();
        if (cancelled || !draft || draft.version !== 1) return;

        garagePrefillAppliedRef.current = true;
        listingLocationTouchedRef.current = draft.listingLocationTouched;
        setMode(draft.mode);
        setCurrentStep(Math.max(1, Math.min(draft.currentStep, draft.mode === "single" ? singleSteps.length : multipleSteps.length)));
        setVehicleType(vehicleCards.find((vehicle) => vehicle.key === draft.vehicleTypeKey) ?? vehicleCards[1]);
        setVehicleDetails(draft.vehicleDetails);
        setCustomVehicleFields(draft.customVehicleFields);
        vehicleAutoAdvancedFieldsRef.current = draft.customVehicleFields;
        setCategory(draft.category);
        setCategoryGroup(draft.categoryGroup);
        setSubcategory(draft.subcategory);
        setCondition(draft.condition);
        setUploadedImages(draft.uploadedImages.map(createImageFromDraft));
        setPartNumber(draft.partNumber);
        setListingPrice(draft.listingPrice);
        setMultiParts(
          Object.fromEntries(
            Object.entries(draft.multiParts).map(([id, part]) => [
              id,
              {
                ...part,
                images: part.images.map(createImageFromDraft)
              }
            ])
          )
        );
        setActiveMultiListingIndex(draft.activeMultiListingIndex);
        setExpandedMultiCategories(draft.expandedMultiCategories);
        setExpandedMultiSections(draft.expandedMultiSections);
        setExpandedMultiGroups(draft.expandedMultiGroups);
        setMultiPartSearch(draft.multiPartSearch);
        setShowSelectedMultiParts(draft.showSelectedMultiParts);
        setExpandedListingGroups(draft.expandedListingGroups);
        setOpenMultiListingPartId(draft.openMultiListingPartId);
        setListingLocation(draft.listingLocation);
        setDeliveryMethod(draft.deliveryMethod);
        setListingTitle(draft.listingTitle);
        setListingDescription(draft.listingDescription);
        setSelectedCompanySellerId(draft.selectedCompanySellerId);
      } catch {
        /* Draft restore is best-effort. */
      } finally {
        if (!cancelled) draftHydratedRef.current = true;
      }
    }

    void hydrateDraft();

    return () => {
      cancelled = true;
    };
  }, [createImageFromDraft]);

  useEffect(() => {
    if (!draftHydratedRef.current || draftClearedOrPublishedRef.current) return;

    const timeout = window.setTimeout(() => {
      if (!hasDraftContent()) return;
      void writeSellDraft(buildDraftState()).catch(() => undefined);
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [buildDraftState, hasDraftContent]);

  useEffect(() => {
    function saveDraftBeforeLeaving() {
      if (!draftHydratedRef.current || draftClearedOrPublishedRef.current || !hasDraftContent()) return;
      void writeSellDraft(buildDraftState()).catch(() => undefined);
    }

    window.addEventListener("pagehide", saveDraftBeforeLeaving);
    return () => window.removeEventListener("pagehide", saveDraftBeforeLeaving);
  }, [buildDraftState, hasDraftContent]);

  useEffect(() => {
    if (garagePrefillAppliedRef.current) return;

    const make = searchParams.get("make")?.trim() ?? "";
    const model = searchParams.get("model")?.trim() ?? "";
    const year = searchParams.get("year")?.trim() ?? "";
    const vehicleTypeParam = searchParams.get("vehicleType")?.trim() ?? "";

    if (!make && !model && !year && !vehicleTypeParam) return;

    garagePrefillAppliedRef.current = true;
    const normalizedVehicleType = normalizeSellVehicleType(vehicleTypeParam);
    const nextVehicle = vehicleCards.find((vehicle) => vehicle.key === normalizedVehicleType) ?? vehicleCards[0];

    setMode("single");
    setVehicleType(nextVehicle);
    vehicleAutoAdvancedFieldsRef.current = {};
    setVehicleDetails({
      vehicleSubtype: "",
      brand: make,
      model,
      year,
      engineCc: "",
      engineType: ""
    });
    setCustomVehicleFields({});
    setCategory("");
    setCategoryGroup("");
    setSubcategory("");
    setCurrentStep(3);
    setCategoryAutoOpenTarget({ field: "category", nonce: Date.now() });
  }, [searchParams]);

  useEffect(() => {
    const engineModel = vehicleDetails.engineType.trim();
    const engineCc = vehicleDetails.engineCc.trim();

    if (
      mode !== "single" ||
      currentStep < 3 ||
      !selectedCategory ||
      !selectedDetailCategory ||
      (!engineModel && !engineCc)
    ) {
      setSinglePriceSuggestion(null);
      setSinglePriceSuggestionLoading(false);
      return;
    }

    let cancelled = false;
    setSinglePriceSuggestionLoading(true);

    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          category: selectedCategory,
          subcategory: selectedDetailCategory,
          engine_model: engineModel,
          engine_cc: engineCc,
          year: vehicleDetails.year.trim()
        });
        const response = await fetch(`/api/price-suggestion?${params.toString()}`);
        const payload = await response.json() as { suggestion?: PriceSuggestion | null };

        if (!cancelled) {
          setSinglePriceSuggestion(payload.suggestion ?? null);
        }
      } catch {
        if (!cancelled) setSinglePriceSuggestion(null);
      } finally {
        if (!cancelled) setSinglePriceSuggestionLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    currentStep,
    mode,
    selectedCategory,
    selectedDetailCategory,
    vehicleDetails.engineCc,
    vehicleDetails.engineType,
    vehicleDetails.year
  ]);

  useEffect(() => {
    const engineModel = vehicleDetails.engineType.trim();
    const engineCc = vehicleDetails.engineCc.trim();

    if (
      mode !== "multiple" ||
      currentStep < 4 ||
      !multiPriceSuggestionKey ||
      (!engineModel && !engineCc)
    ) {
      setMultiPriceSuggestions({});
      setMultiPriceSuggestionsLoading(false);
      return;
    }

    const targets = JSON.parse(multiPriceSuggestionKey) as Array<{
      id: string;
      category: string;
      subcategory: string;
    }>;

    if (targets.length === 0) {
      setMultiPriceSuggestions({});
      setMultiPriceSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    setMultiPriceSuggestionsLoading(true);

    const timeout = window.setTimeout(async () => {
      try {
        const suggestionEntries = await Promise.all(
          targets.map(async (target) => {
            const params = new URLSearchParams({
              category: target.category,
              subcategory: target.subcategory,
              engine_model: engineModel,
              engine_cc: engineCc,
              year: vehicleDetails.year.trim()
            });
            const response = await fetch(`/api/price-suggestion?${params.toString()}`);
            const payload = await response.json() as { suggestion?: PriceSuggestion | null };
            return [target.id, payload.suggestion ?? null] as const;
          })
        );

        if (!cancelled) {
          setMultiPriceSuggestions(
            Object.fromEntries(
              suggestionEntries.filter((entry): entry is readonly [string, PriceSuggestion] => Boolean(entry[1]))
            )
          );
        }
      } catch {
        if (!cancelled) setMultiPriceSuggestions({});
      } finally {
        if (!cancelled) setMultiPriceSuggestionsLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [
    currentStep,
    mode,
    multiPriceSuggestionKey,
    vehicleDetails.engineCc,
    vehicleDetails.engineType,
    vehicleDetails.year
  ]);

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => {
    multiPartsRef.current = multiParts;
  }, [multiParts]);

  useEffect(() => {
    if (accountProfile || currentStep < 4) return;

    let cancelled = false;

    async function loadAccountContext() {
      const {
        getCompanySellers,
        getSafeAuthUser,
        getProfile,
        supabase
      } = await import("@/lib/supabase");

      if (!supabase) return;

      const user = await getSafeAuthUser();

      if (!user || cancelled) return;

      const { data: profile } = await getProfile(user.id);
      if (cancelled) return;

      setAccountProfile(profile);

      if (profile?.account_type !== "company") {
        setCompanySellers([]);
        setSelectedCompanySellerId("");
        return;
      }

      const { data: sellers } = await getCompanySellers(profile.id);
      if (cancelled) return;

      const nextSellers = sellers ?? [];
      setCompanySellers(nextSellers);
      setSelectedCompanySellerId((current) =>
        nextSellers.some((seller) => seller.id === current)
          ? current
          : ""
      );
    }

    void loadAccountContext();

    return () => {
      cancelled = true;
    };
  }, [accountProfile, currentStep]);

  useEffect(() => {
    return () => {
      revokeCurrentImageUrls();
    };
  }, [revokeCurrentImageUrls]);

  useEffect(() => {
    if (!profileCity || listingLocationTouchedRef.current) return;

    setListingLocation((current) => current.trim() ? current : profileCity);
  }, [profileCity]);

  useEffect(() => {
    if (currentStep !== 3 || mode !== "single") {
      categoryEntryAutoOpenRef.current = false;
      return;
    }

    if (categoryEntryAutoOpenRef.current || selectedCategory || categoryOptions.length === 0) return;

    categoryEntryAutoOpenRef.current = true;
    setCategoryAutoOpenTarget({ field: "category", nonce: Date.now() });
  }, [categoryOptions.length, currentStep, mode, selectedCategory]);

  function updateListingLocation(value: string) {
    listingLocationTouchedRef.current = true;
    setListingLocation(value);
  }

  async function addImageFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const preparedImages = await Promise.all(
      imageFiles.map(async (file) => {
        try {
          const prepared = await prepareUploadImage(file);
          return {
            id: `${prepared.file.name}-${prepared.file.lastModified}-${crypto.randomUUID()}`,
            url: URL.createObjectURL(prepared.file),
            file: prepared.file,
            name: prepared.file.name,
            width: prepared.width,
            height: prepared.height,
            size: prepared.file.size
          };
        } catch {
          return null;
        }
      })
    );

    const validImages = preparedImages.filter((image): image is UploadedImage => Boolean(image));

    if (validImages.length !== preparedImages.length) {
      setPublishError("Kuvan kasittely epaonnistui. Kokeile toista JPG-, PNG- tai WEBP-kuvaa.");
    }

    setUploadedImages((current) => [
      ...current,
      ...validImages
    ]);
  }

  function removeUploadedImage(imageId: string) {
    setUploadedImages((current) => {
      const imageToRemove = current.find((image) => image.id === imageId);
      if (imageToRemove) URL.revokeObjectURL(imageToRemove.url);
      if (previewImage?.id === imageId) setPreviewImage(null);
      return current.filter((image) => image.id !== imageId);
    });
  }

  function updateVehicleDetail(key: keyof VehicleDetails, value: string) {
    setVehicleDetails((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateVehicleBrand(value: string) {
    setVehicleDetails((current) => ({
      ...current,
      brand: value,
      model: "",
      engineType: ""
    }));
  }

  function updateVehicleModel(value: string) {
    setVehicleDetails((current) => ({
      ...current,
      model: value,
      engineType: ""
    }));
  }

  function updateVehicleCustomMode(key: VehicleDetailKey, customMode: boolean) {
    setCustomVehicleFields((current) => {
      const next = {
        ...current,
        [key]: customMode
      };

      if (key === "brand" && customMode) {
        next.model = true;
        next.engineType = true;
      }

      if (key === "brand" && !customMode) {
        next.model = false;
        next.engineType = false;
      }

      return next;
    });

    if (key === "brand" && customMode) {
      setVehicleDetails((current) => ({
        ...current,
        model: "",
        engineType: ""
      }));
    }

    if (key === "brand" && !customMode) {
      setVehicleDetails((current) => ({
        ...current,
        model: "",
        engineType: ""
      }));
    }
  }

  function focusVehicleField(key: VehicleDetailKey) {
    setOpenVehiclePresetField(key);
    window.setTimeout(() => {
      const field = vehicleFieldRefs.current[key];
      if (!field) return;
      field.scrollIntoView({ block: "center", behavior: "smooth" });
      field.focus();
      field.select();
    }, 80);
  }

  function setVehiclePresetFieldOpen(key: VehicleDetailKey, open: boolean) {
    setOpenVehiclePresetField((current) => {
      if (open) return key;
      return current === key ? null : current;
    });
  }

  function completeVehicleField(currentKey: VehicleDetailKey, nextKey?: VehicleDetailKey) {
    if (!nextKey) return;
    if (vehicleAutoAdvancedFieldsRef.current[currentKey]) return;

    vehicleAutoAdvancedFieldsRef.current = {
      ...vehicleAutoAdvancedFieldsRef.current,
      [currentKey]: true
    };
    focusVehicleField(nextKey);
  }

  function updateStepThreeSelection(update: () => void) {
    update();
  }

  function advanceCategoryField(nextField: "group" | "detail") {
    setCategoryAutoOpenTarget({ field: nextField, nonce: Date.now() });
  }

  function toggleMultiPart(option: MultiPartOption) {
    setMultiParts((current) => {
      const next = { ...current };

      if (next[option.id]) {
        delete next[option.id];
      } else {
        next[option.id] = {
          ...option,
          title: "",
          price: "",
          condition: "",
          partNumber: "",
          description: "",
          images: []
        };
      }

      return next;
    });
  }

  function toggleMultiPartBatch(options: MultiPartOption[]) {
    if (options.length === 0) return;

    setMultiParts((current) => {
      const next = { ...current };
      const allSelected = options.every((option) => Boolean(next[option.id]));

      for (const option of options) {
        if (allSelected) {
          delete next[option.id];
        } else if (!next[option.id]) {
          next[option.id] = {
            ...option,
            title: "",
            price: "",
            condition: "",
            partNumber: "",
            description: "",
            images: []
          };
        }
      }

      return next;
    });
  }

  function toggleMultiGroup(categoryName: string, groupName: string) {
    const groupKey = `${categoryName}::${groupName}`;
    setCategory(categoryName);
    setCategoryGroup(groupName);
    setExpandedMultiCategories({ [categoryName]: true });
    setExpandedMultiGroups((current) =>
      current[groupKey] ? {} : { [groupKey]: true }
    );
  }

  function toggleMultiSection(categoryName: string, sectionName: string) {
    const sectionKey = `${categoryName}::${sectionName}`;
    setCategory(categoryName);
    setCategoryGroup(sectionName);
    setExpandedMultiCategories({ [categoryName]: true });
    setExpandedMultiSections((current) =>
      current[sectionKey] ? {} : { [sectionKey]: true }
    );
    setExpandedMultiGroups({});
  }

  function getOpenMultiSectionName(categoryName: string) {
    const prefix = `${categoryName}::`;
    const openKey = Object.keys(expandedMultiSections).find(
      (sectionKey) => sectionKey.startsWith(prefix) && expandedMultiSections[sectionKey]
    );

    return openKey ? openKey.slice(prefix.length) : "";
  }

  function toggleMultiCategory(categoryName: string) {
    setCategory(categoryName);
    setExpandedMultiCategories((current) =>
      current[categoryName] ? {} : { [categoryName]: true }
    );
    setExpandedMultiSections({});
    setExpandedMultiGroups({});
  }

  function renderMultiGroup(categoryName: string, groupItem: MultiPartGroup) {
    const groupSelectedCount = groupItem.parts.filter((part) => multiParts[part.id]).length;
    const groupChecked = groupSelectedCount > 0;
    const groupKey = `${categoryName}::${groupItem.name}`;
    const visibleGroupParts =
      groupItem.parts.length > 1
        ? groupItem.parts.filter((part) => part.detail !== groupItem.name)
        : groupItem.parts;
    const groupHasDetails =
      visibleGroupParts.length > 1 &&
      visibleGroupParts.some((part) => part.detail !== groupItem.name);
    const groupCanBatchSelect = groupItem.parts.length <= 1 || !groupHasDetails;
    const groupOpen = groupHasDetails && Boolean(expandedMultiGroups[groupKey]);
    const groupLabel =
      groupItem.parts.length === 1
        ? groupItem.parts[0].detail
        : groupItem.name;

    return (
      <div
        key={groupItem.name}
        className={`${styles.multiGroupAccordion} ${groupOpen ? styles.multiGroupOpen : ""}`}
      >
        <button
          type="button"
          className={`${styles.multiChoiceRow} ${groupHasDetails ? "" : styles.multiChoiceLeaf}`}
          onClick={() => {
            if (groupHasDetails) {
              toggleMultiGroup(categoryName, groupItem.name);
            } else {
              toggleMultiPartBatch(groupItem.parts);
            }
            setSubcategory("");
          }}
        >
          {groupCanBatchSelect ? (
            <span
              role="checkbox"
              aria-checked={groupChecked}
              tabIndex={0}
              className={`${styles.multiCheck} ${groupChecked ? styles.multiCheckOn : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleMultiPartBatch(groupItem.parts);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                toggleMultiPartBatch(groupItem.parts);
              }}
            >
              {groupChecked ? <Check size={15} aria-hidden="true" /> : null}
            </span>
          ) : (
            <span className={styles.multiChoiceIcon}>
              {getMultiCategoryIcon(groupItem.name)}
            </span>
          )}
          <span className={styles.multiChoiceText}>
            <strong>{translateCategoryText(groupLabel)}</strong>
            <small>{groupSelectedCount > 0 ? formatSelectedCount(groupSelectedCount) : formatPartCount(groupItem.parts.length)}</small>
          </span>
          {groupHasDetails ? <ChevronDown size={17} aria-hidden="true" /> : null}
        </button>

        {groupOpen ? (
          <div className={styles.multiGroupDetails}>
            {visibleGroupParts.map((part) => {
              const partChecked = Boolean(multiParts[part.id]);
              const wholePart = part.detail.toLowerCase().includes("kokonainen");

              return (
                <button
                  key={part.id}
                  type="button"
                  className={`${styles.multiDetailRow} ${wholePart ? styles.multiDetailWhole : ""} ${partChecked ? styles.multiDetailSelected : ""}`}
                  onClick={() => toggleMultiPart(part)}
                >
                  <span className={`${styles.multiCheck} ${partChecked ? styles.multiCheckOn : ""}`}>
                    {partChecked ? <Check size={14} aria-hidden="true" /> : null}
                  </span>
                  <span>{translateCategoryText(part.detail)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  function toggleWholeVehicleParts() {
    const allParts = multiPartTree.flatMap((categoryItem) => categoryItem.parts);
    if (allParts.length === 0) return;

    setMultiParts((current) => {
      const allSelected = allParts.every((part) => Boolean(current[part.id]));

      if (allSelected) return {};

      const next: Record<string, MultiPartSelection> = {};
      for (const part of allParts) {
        next[part.id] = current[part.id] ?? {
          ...part,
          title: "",
          price: "",
          condition: "",
          partNumber: "",
          description: "",
          images: []
        };
      }

      return next;
    });
  }

  function updateMultiPartPrice(id: string, price: string) {
    setMultiParts((current) => {
      const part = current[id];
      if (!part) return current;

      return {
        ...current,
        [id]: {
          ...part,
          price
        }
      };
    });
  }

  function updateMultiPartField(
    id: string,
    field: "title" | "condition" | "partNumber" | "description",
    value: string
  ) {
    setMultiParts((current) => {
      const part = current[id];
      if (!part) return current;

      return {
        ...current,
        [id]: {
          ...part,
          [field]: value
        }
      };
    });
  }

  function removeMultiPartSelection(id: string) {
    setMultiParts((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function addMultiPartImages(id: string, files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const preparedImages = await Promise.all(
      imageFiles.map(async (file) => {
        try {
          const prepared = await prepareUploadImage(file);
          return {
            id: `${id}-${prepared.file.name}-${prepared.file.lastModified}-${crypto.randomUUID()}`,
            url: URL.createObjectURL(prepared.file),
            file: prepared.file,
            name: prepared.file.name,
            width: prepared.width,
            height: prepared.height,
            size: prepared.file.size
          };
        } catch {
          return null;
        }
      })
    );

    const validImages = preparedImages.filter((image): image is UploadedImage => Boolean(image));

    if (validImages.length !== preparedImages.length) {
      setPublishError("Kuvan kasittely epaonnistui. Kokeile toista JPG-, PNG- tai WEBP-kuvaa.");
    }

    setMultiParts((current) => {
      const part = current[id];
      if (!part) return current;

      return {
        ...current,
        [id]: {
          ...part,
          images: [
            ...part.images,
            ...validImages
          ]
        }
      };
    });
  }

  function removeMultiPartImage(partId: string, imageId: string) {
    setMultiParts((current) => {
      const part = current[partId];
      if (!part) return current;

      const imageToRemove = part.images.find((image) => image.id === imageId);
      if (imageToRemove) URL.revokeObjectURL(imageToRemove.url);
      if (previewImage?.id === imageId) setPreviewImage(null);

      return {
        ...current,
        [partId]: {
          ...part,
          images: part.images.filter((image) => image.id !== imageId)
        }
      };
    });
  }

  function continueToNextStep() {
    try {
      sessionStorage.setItem("sell-listing-mode", mode);
    } catch {
      /* optional */
    }
    setCurrentStep(2);
  }

  function resetSellDraft() {
    draftClearedOrPublishedRef.current = true;
    setShowResetConfirm(false);
    revokeCurrentImageUrls();
    setMode("single");
    setCurrentStep(1);
    setVehicleType(vehicleCards[1]);
    setVehicleDetails(buildEmptyVehicleDetails());
    setCustomVehicleFields({});
    vehicleAutoAdvancedFieldsRef.current = {};
    categoryEntryAutoOpenRef.current = false;
    setOpenVehiclePresetField(null);
    setCategory("");
    setCategoryGroup("");
    setSubcategory("");
    setCondition("");
    setUploadedImages([]);
    setPartNumber("");
    setListingPrice("");
    setSinglePriceSuggestion(null);
    setSinglePriceSuggestionLoading(false);
    setMultiParts({});
    setActiveMultiListingIndex(0);
    setMultiPriceSuggestions({});
    setMultiPriceSuggestionsLoading(false);
    setExpandedMultiCategories({});
    setExpandedMultiSections({});
    setExpandedMultiGroups({});
    setMultiPartSearch("");
    setShowSelectedMultiParts(false);
    setExpandedListingGroups({});
    setOpenMultiListingPartId(null);
    setListingLocation("");
    listingLocationTouchedRef.current = false;
    setDeliveryMethod("both");
    setListingTitle("");
    setListingDescription("");
    setPublishError("");
    setIsPublishing(false);
    setCategoryAutoOpenTarget(null);
    setSelectedCompanySellerId("");
    garagePrefillAppliedRef.current = true;

    void deleteSellDraft()
      .catch(() => undefined)
      .finally(() => {
        draftClearedOrPublishedRef.current = false;
      });
  }

  function goToNextStep() {
    setPublishError("");

    if (
      mode === "multiple" &&
      currentStep === 4 &&
      selectedMultiPartList.length > 0 &&
      activeMultiListingIndex < selectedMultiPartList.length - 1
    ) {
      setActiveMultiListingIndex((index) => Math.min(index + 1, selectedMultiPartList.length - 1));
      return;
    }

    if (mode === "multiple" && currentStep === 3) {
      setActiveMultiListingIndex(0);
    }

    setCurrentStep((step) =>
      Math.min(step + 1, steps.length)
    );
  }

  function goToPreviousStep() {
    setPublishError("");

    if (mode === "multiple" && currentStep === 4 && activeMultiListingIndex > 0) {
      setActiveMultiListingIndex((index) => Math.max(index - 1, 0));
      return;
    }

    setCurrentStep((step) =>
      Math.max(step - 1, 1)
    );
  }

  function getPublishPrice(rawPrice: string) {
    const price = Number.parseInt(rawPrice.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(price) ? price : 0;
  }

  function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (error && typeof error === "object" && "message" in error) {
      return String((error as { message?: unknown }).message ?? "Julkaisu epaonnistui.");
    }
    return "Julkaisu epaonnistui. Yrita hetken paasta uudelleen.";
  }

  async function uploadListingImages(images: UploadedImage[]) {
    if (images.length === 0) return [fallbackListingImage];

    const { getSafeAuthUser, supabase } = await import("@/lib/supabase");

    if (!supabase) {
      throw new Error("Supabase ei ole konfiguroitu.");
    }

    const user = await getSafeAuthUser();

    if (!user) {
      throw new Error("Et ole kirjautunut.");
    }

    const uploadedUrls: string[] = [];

    for (const image of images) {
      const uploadFile =
        /-maskines\.(jpe?g|png|webp)$/i.test(image.file.name)
          ? image.file
          : (await prepareUploadImage(image.file)).file;
      const extension =
        uploadFile.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ||
        (uploadFile.type === "image/png" ? "png" : "webp");
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(listingImageBucket)
        .upload(path, uploadFile, {
          cacheControl: "31536000",
          contentType: uploadFile.type || "image/webp",
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from(listingImageBucket)
        .getPublicUrl(path);

      if (data.publicUrl) {
        uploadedUrls.push(data.publicUrl);
      }
    }

    return uploadedUrls.length > 0 ? uploadedUrls : [fallbackListingImage];
  }

  function getAutomaticListingTitle(part?: MultiPartSelection) {
    const partTitle = part
      ? part.detail || part.group || part.category
      : selectedDetailCategory || selectedCategoryGroup || selectedCategory;
    const vehicleTitle = [
      vehicleDetails.brand.trim(),
      vehicleDetails.model.trim()
    ].filter(Boolean).join(" ");
    const fallbackTitle = [
      vehicleTitle,
      partTitle.trim()
    ].filter(Boolean).join(" ");

    return fallbackTitle.trim() || "Ilmoitus";
  }

  function getTranslatedAutomaticListingTitle(part?: MultiPartSelection) {
    const partTitle = part
      ? part.detail || part.group || part.category
      : selectedDetailCategory || selectedCategoryGroup || selectedCategory;
    const translatedPartTitle = partTitle ? translateCategoryText(partTitle.trim()) : "";
    const vehicleTitle = [
      vehicleDetails.brand.trim(),
      vehicleDetails.model.trim()
    ].filter(Boolean).join(" ");
    const fallbackTitle = [
      vehicleTitle,
      translatedPartTitle
    ].filter(Boolean).join(" ");

    return fallbackTitle.trim() || st("Ilmoitus");
  }

  function getDeliveryMethodLabel(method: DeliveryMethod = deliveryMethod) {
    return deliveryMethodOptions.find((option) => option.value === method)?.label ?? "L\u00e4hetys ja nouto";
  }

  function appendDeliveryMethod(description: string) {
    return [
      description.trim(),
      vehicleDetails.vehicleSubtype.trim()
        ? `Ajoneuvotyyppi: ${vehicleDetails.vehicleSubtype.trim()}`
        : "",
      `Toimitustapa: ${getDeliveryMethodLabel()}`
    ].filter(Boolean).join("\n\n");
  }

  function renderDeliveryMethodSelector() {
    return (
      <div className={styles.deliveryMethodField}>
        <span>{st("Toimitustapa")}</span>
        <div className={styles.deliveryMethodSelectShell}>
          <select
            value={deliveryMethod}
            onChange={(event) => setDeliveryMethod(event.target.value as DeliveryMethod)}
            aria-label={st("Toimitustapa")}
          >
            {deliveryMethodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {st(option.label)}
              </option>
            ))}
          </select>
          <ChevronDown size={18} aria-hidden="true" />
        </div>
      </div>
    );
  }

  function buildListingPayload(part?: MultiPartSelection, imageUrls?: string[]): ListingInput {
    const price = getPublishPrice(part?.price ?? listingPrice);
    const title = part
      ? part.title.trim() || getAutomaticListingTitle(part)
      : listingTitle.trim() || getAutomaticListingTitle();
    const baseDescription =
      mode === "multiple"
        ? part?.description.trim() || `Myynnissa ${part?.detail ?? "varaosa"}. Tarkemmat tiedot saat myyjalta viestilla.`
        : listingDescription.trim();
    const description = appendDeliveryMethod(baseDescription);
    const resolvedImageUrls =
      imageUrls && imageUrls.length > 0 ? imageUrls : [fallbackListingImage];

    return {
      title,
      original_language: "fi",
      translations: null,
      listing_mode: mode,
      price,
      vehicle_type: vehicleType.title,
      brand: vehicleDetails.brand.trim(),
      model: vehicleDetails.model.trim(),
      year: vehicleDetails.year.trim(),
      engine_cc: vehicleDetails.engineCc.trim(),
      engine_model: vehicleDetails.engineType.trim(),
      category: part?.category ?? selectedCategory,
      subcategory: part?.detail ?? selectedDetailCategory,
      part_number: mode === "single" ? partNumber.trim() || null : part?.partNumber.trim() || null,
      location: buildListingLocation(listingLocation, profileCity, profileCountry),
      condition: part?.condition ?? condition,
      description,
      image_url: resolvedImageUrls[0],
      image_urls: resolvedImageUrls,
      seller_name: isCompanyAccount ? selectedCompanySeller?.name.trim() ?? "" : "",
      seller_email: "",
      seller_phone: isCompanyAccount ? selectedCompanySeller?.phone.trim() || null : null,
      company_name: isCompanyAccount ? accountProfile?.company_name ?? null : null,
      seller_avatar_url: null,
      user_id: null,
      view_count: 0,
      vehicle_subtype: vehicleDetails.vehicleSubtype.trim(),
      is_sold: false,
      is_hidden: false,
      sold_price: null,
      sold_at: null
    };
  }

  function validateListingPayload(payload: ListingInput, imageCount: number) {
    if (payload.title.trim().length < 3) return "Lisää vähintään 3 merkin otsikko.";
    if (!String(payload.category ?? "").trim()) return "Valitse kategoria ennen julkaisua.";
    if (!String(payload.condition ?? "").trim()) return "Valitse kuntoluokitus ennen julkaisua.";
    if (payload.price <= 0) return "Lisää ilmoitukselle hinta. Hinnan täytyy olla vähintään 1 euro.";
    if (imageCount <= 0) return "Lisää vähintään yksi kuva jokaiseen julkaistavaan ilmoitukseen.";
    if (listingNeedsTrackMatDimensions(payload)) {
      void descriptionHasTrackMatDimensions(payload.description);
    }
    return "";
  }

  async function moderateListing(payload: ListingInput) {
    const response = await fetch("/api/moderate-listing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: payload.title,
        description: payload.description,
        price: payload.price,
        location: payload.location
      })
    });

    if (!response.ok) return "";

    const result = (await response.json()) as {
      allowed?: boolean;
      reasons?: string[];
    };

    return result.allowed === false
      ? result.reasons?.[0] ?? "Ilmoitus ei lapaisse sisaltotarkistusta."
      : "";
  }

  async function publishListings() {
    if (isPublishing) return;

    setPublishError("");
    setIsPublishing(true);

    try {
      const listingParts =
        mode === "multiple"
          ? selectedMultiPartList.filter((part) =>
              getPublishPrice(part.price) > 0 &&
              part.condition.trim().length > 0 &&
              part.images.length > 0
            )
          : [undefined];
      const draftPayloads =
        listingParts.map((part) => buildListingPayload(part));

      if (draftPayloads.length === 0) {
        setPublishError(
          mode === "multiple"
            ? "Yhtään julkaisukelpoista ilmoitusta ei löytynyt. Lisää julkaistaville osille hinta, kunto ja vähintään yksi kuva."
            : "Valitse vähintään yksi myytävä osa ennen julkaisua."
        );
        return;
      }

      for (let index = 0; index < draftPayloads.length; index += 1) {
        const payload = draftPayloads[index];
        const part = listingParts[index];
        const imageCount = part ? part.images.length : uploadedImages.length;
        if (!payload) continue;

        const validationError = validateListingPayload(payload, imageCount);
        if (validationError) {
          setPublishError(validationError);
          return;
        }

        const moderationError = await moderateListing(payload);
        if (moderationError) {
          setPublishError(moderationError);
          return;
        }
      }

      let firstListingId = "";
      let firstListingUrlId: string | number = "";
      let firstListingFeedbackMeta: Omit<ListingFeedbackPrompt, "listingId" | "returnHref"> | null = null;
      const { createListing } = await import("@/lib/supabase");

      for (const part of listingParts) {
        const imageUrls = await uploadListingImages(
          part ? part.images : uploadedImages
        );
        const payload = buildListingPayload(part, imageUrls);
        const { data, error } = await createListing(payload);
        if (error || !data) {
          setPublishError(getErrorMessage(error));
          return;
        }

        firstListingId ||= data.id;
        firstListingUrlId ||= listingUrlId(data);
        if (!firstListingFeedbackMeta) {
          firstListingFeedbackMeta = {
            listingMode: mode,
            vehicleType: payload.vehicle_type || vehicleType.title,
            category: payload.category || "",
            subcategory: payload.subcategory || ""
          };
        }
      }

      draftClearedOrPublishedRef.current = true;
      await deleteSellDraft().catch(() => undefined);
      const returnHref = firstListingId ? listingPath(firstListingUrlId || firstListingId) : "/my-listings";

      try {
        const { shouldAskListingCreationFeedback } = await import("@/lib/supabase");
        const { data } = await shouldAskListingCreationFeedback();
        if (data?.hasFeedback === false && firstListingId && firstListingFeedbackMeta) {
          setFeedbackPrompt({
            listingId: firstListingId,
            returnHref,
            ...firstListingFeedbackMeta
          });
          return;
        }
      } catch {
        /* Publishing succeeded; feedback is optional and must not block the redirect. */
      }

      router.push(returnHref);
    } catch (error) {
      setPublishError(getErrorMessage(error));
    } finally {
      setIsPublishing(false);
    }
  }

  function handlePrimaryAction() {
    if (isLastStep) {
      void publishListings();
      return;
    }

    goToNextStep();
  }

  function getPrimaryActionLabel() {
    if (isPublishing) return st("Julkaistaan...");
    if (isLastStep) return st("Julkaise");
    if (mode === "multiple" && currentStep === 4) {
      return activeMultiListingIndex < selectedMultiPartList.length - 1
        ? st("Seuraava osa")
        : st("Toimitukseen");
    }
    if (mode === "multiple" && currentStep === 5) {
      return st("Julkaisuun");
    }
    return st("Seuraava");
  }

  function getStepLead() {
    if (currentStep === 2) return st("Valitse ajoneuvoluokka");
    if (currentStep === 3) return mode === "single"
      ? st("Valitse tuotteen kategoria ja lisää hinta.")
      : st("Valitse yhteinen kategoriointi ilmoituksille.");
    if (false && mode === "multiple" && currentStep === 4) {
      return (
        <div className={styles.listingStack}>
          {selectedMultiPartList.length > 0 ? (
            selectedMultiPartGroups.map((groupItem) => {
              const groupOpen = expandedListingGroups[groupItem.name] ?? true;

              return (
                <section className={styles.multiListingGroup} key={groupItem.name}>
                  <button
                    type="button"
                    className={styles.multiListingGroupHeader}
                    onClick={() =>
                      setExpandedListingGroups((current) => ({
                        ...current,
                        [groupItem.name]: !(current[groupItem.name] ?? true)
                      }))
                    }
                    aria-expanded={groupOpen}
                  >
                    <span>
                      <strong>{groupItem.name}</strong>
                      <small>{groupItem.parts.length} valittua tuotetta</small>
                    </span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>

                  {groupOpen ? (
                    <div className={styles.multiListingTable}>
                      {groupItem.parts.map((part, index) => (
                        <details className={styles.multiListingRow} key={part.id}>
                          <summary>
                            <span className={styles.multiDragDots} aria-hidden="true">::</span>
                            <strong>{index + 1}</strong>
                            <input value={part.detail} readOnly aria-label="Tuote" />
                            <input
                              inputMode="numeric"
                              placeholder="Hinta"
                              value={part.price}
                              onChange={(event) => updateMultiPartPrice(part.id, event.target.value)}
                              aria-label="Hinta"
                            />
                            <select
                              value={part.condition}
                              onChange={(event) => updateMultiPartField(part.id, "condition", event.target.value)}
                              aria-label="Kunto"
                            >
                              <option value="">Kuntoluokitus</option>
                              <option>Uusi</option>
                              <option>Hyvä</option>
                              <option>Käytetty</option>
                              <option>Korjattava</option>
                            </select>
                          </summary>

                          <div className={styles.multiListingDetails}>
                            <label>
                              <span>Osanumero / OEM</span>
                              <input
                                value={part.partNumber}
                                onChange={(event) => updateMultiPartField(part.id, "partNumber", event.target.value)}
                                placeholder="Kirjoita osanumero"
                              />
                            </label>

                            <div className={styles.multiPartPhotos}>
                              <label className={styles.multiPartPhotoAdd}>
                                <Camera size={17} aria-hidden="true" />
                                <span>Lisää kuvat</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  onChange={(event) => {
                                    if (event.target.files) void addMultiPartImages(part.id, event.target.files);
                                    event.target.value = "";
                                  }}
                                />
                              </label>

                              {part.images.map((image) => (
                                <button
                                  type="button"
                                  key={image.id}
                                  className={styles.multiPartPhoto}
                                  onClick={() => setPreviewImage(image)}
                                >
                                  <img src={image.url} alt={image.name} />
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className={styles.multiPartPhotoRemove}
                                    aria-label={`Poista kuva ${image.name}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      removeMultiPartImage(part.id, image.id);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key !== "Enter" && event.key !== " ") return;
                                      event.preventDefault();
                                      event.stopPropagation();
                                      removeMultiPartImage(part.id, image.id);
                                    }}
                                  >
                                    <X size={13} aria-hidden="true" />
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })
          ) : (
            <div className={styles.multiListingEmpty}>
              <strong>Ei valittuja osia</strong>
              <span>Palaa kategoriaan ja valitse myytävät osat tai koko ajoneuvo.</span>
            </div>
          )}
        </div>
      );
    }

    if (false && mode === "multiple" && currentStep === 4) {
      return "Lisää jokainen myytävä osa omaksi ilmoituksekseen.";
    }
    if (currentStepInfo.title === "Julkaise") return st("Tarkista tiedot ennen julkaisua.");
    return st(currentStepInfo.description);
  }

  function renderMultiListingPartRows(parts: MultiPartSelection[]) {
    return (
      <div className={styles.multiListingTable}>
        <div className={styles.multiListingTableHead} aria-hidden="true">
          <span />
          <span />
          <span />
          <span>Nimi</span>
          <span>Hinta (€)</span>
          <span>Kunto</span>
          <span />
        </div>
        {parts.map((part, index) => {
          const translatedAutomaticTitle = getTranslatedAutomaticListingTitle(part);
          const partNeedsTrackMatDimensions = [part.category, part.group, part.detail].some(isTrackMatText);

          return (
            <article
              className={`${styles.multiListingRow} ${openMultiListingPartId === part.id ? styles.multiListingRowOpen : ""}`}
              key={part.id}
            >
              <div
                className={styles.multiListingSummary}
                onClick={() => setOpenMultiListingPartId((current) => (current === part.id ? null : part.id))}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setOpenMultiListingPartId((current) => (current === part.id ? null : part.id));
                }}
                role="button"
                tabIndex={0}
                aria-expanded={openMultiListingPartId === part.id}
              >
                <span className={styles.multiRowArrow} aria-hidden="true">
                  <ChevronDown size={17} />
                </span>
              <span className={styles.multiDragDots} aria-hidden="true">::</span>
              <strong className={styles.multiListingIndex}>{index + 1}</strong>
              <span className={styles.multiPartIdentity}>
                <b>{part.title || translatedAutomaticTitle}</b>
                <small>{translateCategoryText(part.category)} &gt; {translateCategoryText(part.group)}</small>
              </span>
              <span className={styles.multiPriceCell}>
                <input
                  inputMode="numeric"
                  placeholder={st("Hinta")}
                  value={part.price}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateMultiPartPrice(part.id, event.target.value)}
                  aria-label={st("Hinta")}
                />
                {multiPriceSuggestions[part.id] ? (
                  <button
                    type="button"
                    className={styles.multiPriceSuggestion}
                    onClick={(event) => {
                      event.stopPropagation();
                      updateMultiPartPrice(part.id, String(multiPriceSuggestions[part.id].avg));
                    }}
                  >
                    {st("Ehdotus")} {formatSuggestionPrice(multiPriceSuggestions[part.id].avg)}
                  </button>
                ) : multiPriceSuggestionsLoading ? (
                  <small className={styles.multiPriceSuggestionMuted}>{st("Haetaan...")}</small>
                ) : null}
              </span>
              <ConditionSelect
                compact
                value={part.condition}
                onChange={(value) => updateMultiPartField(part.id, "condition", value)}
              />
              <span className={styles.multiListingActions}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removeMultiPartSelection(part.id);
                  }}
                  aria-label={st("Poista ilmoitus")}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </span>
              </div>

              {openMultiListingPartId === part.id ? (
              <div className={styles.multiListingDetails}>
                <label>
                  <span>{st("Otsikko")}</span>
                  <input
                    value={part.title}
                    onChange={(event) => updateMultiPartField(part.id, "title", event.target.value)}
                    placeholder={translatedAutomaticTitle}
                  />
                  <small className={styles.automaticTitleHint}>
                    {st("TÃ¤mÃ¤ on otsikko jos et itse otsikoi:")} {translatedAutomaticTitle}
                  </small>
                </label>
                <label>
                  <span>{st("Osanumero / OEM")}</span>
                  <input
                    value={part.partNumber}
                    onChange={(event) => updateMultiPartField(part.id, "partNumber", event.target.value)}
                    placeholder={st("Kirjoita osanumero")}
                  />
                </label>
                <label className={styles.multiListingWideField}>
                  <span>{st("Lisätiedot")}</span>
                  <textarea
                    value={part.description}
                    onChange={(event) => updateMultiPartField(part.id, "description", event.target.value)}
                    placeholder={
                      partNeedsTrackMatDimensions
                        ? st("Kirjoita telamaton mitat, kunto, sopivuus ja muut huomiot")
                        : st("Kirjoita lisätiedot, viat, sopivuus tai muut huomiot")
                    }
                  />
                </label>

                <div className={styles.multiPartPhotos}>
                  <label className={styles.multiPartPhotoAdd}>
                    <Camera size={17} aria-hidden="true" />
                    <span>{st("Lisää kuvat")}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => {
                        if (event.target.files) void addMultiPartImages(part.id, event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>

                  {part.images.map((image) => (
                    <button
                      type="button"
                      key={image.id}
                      className={styles.multiPartPhoto}
                      onClick={() => setPreviewImage(image)}
                    >
                      <img src={image.url} alt={image.name} />
                      <span
                        role="button"
                        tabIndex={0}
                        className={styles.multiPartPhotoRemove}
                        aria-label={`${st("Poista kuva")} ${image.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeMultiPartImage(part.id, image.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          event.stopPropagation();
                          removeMultiPartImage(part.id, image.id);
                        }}
                      >
                        <X size={13} aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              ) : null}
            </article>
          );
        })}
      </div>
    );
  }

  function renderActiveMultiListingPart() {
    const part = activeMultiListingPart;

    if (!part) {
      return (
        <div className={styles.multiListingEmpty}>
          <strong>{st("Ei valittuja osia")}</strong>
          <span>{st("Palaa kategoriaan ja valitse myytävät osat tai koko ajoneuvo.")}</span>
        </div>
      );
    }

    const activeIndex = Math.min(activeMultiListingIndex, selectedMultiPartList.length - 1);
    const listingProgressLabel = `${activeIndex + 1}/${selectedMultiPartList.length} ${st("ilmoitusta täytetty")}`;
    const translatedAutomaticTitle = getTranslatedAutomaticListingTitle(part);
    const partNeedsTrackMatDimensions = [part.category, part.group, part.detail].some(isTrackMatText);

    return (
      <div className={`${styles.listingStack} ${styles.multiListingWizard}`}>
        <section className={styles.multiListingCategory}>
          <div className={`${styles.multiListingCategoryHeader} ${styles.multiListingStaticHeader}`}>
            <span className={styles.multiListingHeaderTitle}>
              <span className={styles.multiListingHeaderIcon}>{getMultiCategoryIcon(part.category)}</span>
              <strong>{translateCategoryText(part.category)}</strong>
              <small>{listingProgressLabel}</small>
            </span>
            <span
              className={styles.multiListingProgress}
              aria-hidden="true"
              style={{ ["--progress" as string]: `${((activeIndex + 1) / selectedMultiPartList.length) * 100}%` }}
            />
          </div>

          <div className={styles.multiListingCategoryBody}>
            <section className={styles.multiListingGroup}>
              <div className={`${styles.multiListingGroupHeader} ${styles.multiListingStaticHeader}`}>
                <span className={styles.multiListingGroupTitle}>
                  <strong>{translateCategoryText(part.group)}</strong>
                  <small>{translateCategoryText(part.detail)}</small>
                </span>
              </div>

              <article className={`${styles.multiListingRow} ${styles.multiListingSinglePart}`}>
                <div className={styles.multiListingSummary}>
                  <span className={styles.multiRowArrow} aria-hidden="true">
                    <ChevronDown size={17} />
                  </span>
                  <strong className={styles.multiListingIndex}>{activeIndex + 1}</strong>
                  <span className={styles.multiPartIdentity}>
                    <b>{part.title || translatedAutomaticTitle}</b>
                    <small>{translateCategoryText(part.category)} &gt; {translateCategoryText(part.group)}</small>
                  </span>
                  <span className={styles.multiPriceCell}>
                    <input
                      inputMode="numeric"
                      placeholder={st("Hinta")}
                      value={part.price}
                      onChange={(event) => updateMultiPartPrice(part.id, event.target.value)}
                      aria-label={st("Hinta")}
                    />
                    {multiPriceSuggestions[part.id] ? (
                      <button
                        type="button"
                        className={styles.multiPriceSuggestion}
                        onClick={() => updateMultiPartPrice(part.id, String(multiPriceSuggestions[part.id].avg))}
                      >
                        {st("Ehdotus")} {formatSuggestionPrice(multiPriceSuggestions[part.id].avg)}
                      </button>
                    ) : multiPriceSuggestionsLoading ? (
                      <small className={styles.multiPriceSuggestionMuted}>{st("Haetaan...")}</small>
                    ) : null}
                  </span>
                  <ConditionSelect
                    compact
                    value={part.condition}
                    onChange={(value) => updateMultiPartField(part.id, "condition", value)}
                    translateText={st}
                  />
                  <span className={styles.multiListingActions}>
                    <button
                      type="button"
                      onClick={() => removeMultiPartSelection(part.id)}
                      aria-label={st("Poista ilmoitus")}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </span>
                </div>

                <div className={styles.multiListingDetails}>
                  <label>
                    <span>{st("Otsikko")}</span>
                    <input
                      value={part.title}
                      onChange={(event) => updateMultiPartField(part.id, "title", event.target.value)}
                      placeholder={translatedAutomaticTitle}
                    />
                    <small className={styles.automaticTitleHint}>
                      {st("TÃ¤mÃ¤ on otsikko jos et itse otsikoi:")} {translatedAutomaticTitle}
                    </small>
                  </label>
                  <label>
                    <span>{st("Osanumero / OEM")}</span>
                    <input
                      value={part.partNumber}
                      onChange={(event) => updateMultiPartField(part.id, "partNumber", event.target.value)}
                      placeholder={st("Kirjoita osanumero")}
                    />
                  </label>
                  <label className={styles.multiListingWideField}>
                    <span>{st("Lisätiedot")}</span>
                    <textarea
                      value={part.description}
                      onChange={(event) => updateMultiPartField(part.id, "description", event.target.value)}
                      placeholder={
                        partNeedsTrackMatDimensions
                          ? st("Kirjoita telamaton mitat, kunto, sopivuus ja muut huomiot")
                          : st("Kirjoita lisätiedot, viat, sopivuus tai muut huomiot")
                      }
                    />
                  </label>

                  <div className={styles.multiPartPhotos}>
                    <label className={styles.multiPartPhotoAdd}>
                      <Camera size={17} aria-hidden="true" />
                      <span>{st("Lisää kuvat")}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          if (event.target.files) void addMultiPartImages(part.id, event.target.files);
                          event.target.value = "";
                        }}
                      />
                    </label>

                    {part.images.map((image) => (
                      <button
                        type="button"
                        key={image.id}
                        className={styles.multiPartPhoto}
                        onClick={() => setPreviewImage(image)}
                      >
                        <img src={image.url} alt={image.name} />
                        <span
                          role="button"
                          tabIndex={0}
                          className={styles.multiPartPhotoRemove}
                          aria-label={`${st("Poista kuva")} ${image.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeMultiPartImage(part.id, image.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            event.stopPropagation();
                            removeMultiPartImage(part.id, image.id);
                          }}
                        >
                          <X size={13} aria-hidden="true" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            </section>
          </div>
        </section>
      </div>
    );
  }

  function renderMultiListingCategories() {
    return (
      <div className={styles.listingStack}>
        {selectedMultiPartList.length > 0 ? (
          selectedMultiPartCategories.map((categoryItem) => {
            const categoryKey = `category::${categoryItem.name}`;
            const categoryOpen = expandedListingGroups[categoryKey] ?? true;

            return (
              <section className={styles.multiListingCategory} key={categoryItem.name}>
                <button
                  type="button"
                  className={styles.multiListingCategoryHeader}
                  onClick={() =>
                    setExpandedListingGroups((current) => ({
                      ...current,
                      [categoryKey]: !(current[categoryKey] ?? true)
                    }))
                  }
                  aria-expanded={categoryOpen}
                >
                  <span className={styles.multiListingHeaderTitle}>
                    <span className={styles.multiListingHeaderIcon}>{getMultiCategoryIcon(categoryItem.name)}</span>
                    <strong>{categoryItem.name}</strong>
                    <small>{categoryItem.parts.length} osaa</small>
                  </span>
                  <ChevronDown size={18} aria-hidden="true" />
                </button>

                {categoryOpen ? (
                  <div className={styles.multiListingCategoryBody}>
                    {categoryItem.groups.map((groupItem) => {
                      const groupKey = `${categoryItem.name}::${groupItem.name}`;
                      const groupOpen = expandedListingGroups[groupKey] ?? true;

                      return (
                        <section className={styles.multiListingGroup} key={groupKey}>
                          <button
                            type="button"
                            className={styles.multiListingGroupHeader}
                            onClick={() =>
                              setExpandedListingGroups((current) => ({
                                ...current,
                                [groupKey]: !(current[groupKey] ?? true)
                              }))
                            }
                            aria-expanded={groupOpen}
                          >
                            <span className={styles.multiListingGroupTitle}>
                              <strong>{groupItem.name}</strong>
                              <small>{groupItem.parts.length} osaa</small>
                            </span>
                            <ChevronDown size={18} aria-hidden="true" />
                          </button>
                          {groupOpen ? (
                            <>
                              {renderMultiListingPartRows(groupItem.parts)}
                            </>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })
        ) : (
          <div className={styles.multiListingEmpty}>
            <strong>Ei valittuja osia</strong>
            <span>Palaa kategoriaan ja valitse myytävät osat tai koko ajoneuvo.</span>
          </div>
        )}
      </div>
    );
  }

  function renderMultiDeliveryStep() {
    return (
      <section className={styles.multiListingMetaPanel} aria-label={st("Sijainti ja toimitus")}>
        <PlainIconInput
          label={st("Sijainti")}
          icon={MapPin}
          placeholder={st("Kaupunki tai paikkakunta")}
          value={listingLocation}
          onChange={updateListingLocation}
        />
        {renderDeliveryMethodSelector()}
      </section>
    );
  }

  function renderCurrentStep() {
    if (currentStep === 2) {
      return (
        <div className={styles.vehicleWorkspace}>
          <div className={styles.vehicleTypeGrid}>
            {vehicleCards.map((vehicle) => {
              const active = vehicle.key === vehicleType.key;

              return (
                <button
                  key={vehicle.key}
                  type="button"
                  className={`${styles.vehicleTypeCard} ${active ? styles.vehicleTypeActive : ""}`}
                  onClick={() => {
                    setVehicleType(vehicle);
                    setVehicleDetails(buildEmptyVehicleDetails());
                    setCustomVehicleFields({});
                    vehicleAutoAdvancedFieldsRef.current = {};
                    setCategory("");
                    setCategoryGroup("");
                    setSubcategory("");
                    focusVehicleField("vehicleSubtype");
                  }}
                >
                  <img src={vehicle.image} alt="" />
                  <strong>{st(vehicle.title)}</strong>
                  <small>{st(vehicle.description)}</small>
                </button>
              );
            })}
          </div>

          <form className={styles.vehicleForm}>
            <PresetField
              fieldKey="vehicleSubtype"
              label={st("Tyyppi")}
              value={vehicleDetails.vehicleSubtype}
              options={vehiclePreset.typeOptions}
              open={openVehiclePresetField === "vehicleSubtype"}
              onOpenChange={(open) => setVehiclePresetFieldOpen("vehicleSubtype", open)}
              onChange={(value) => updateVehicleDetail("vehicleSubtype", value)}
              customMode={Boolean(customVehicleFields.vehicleSubtype)}
              onCustomModeChange={(customMode) => updateVehicleCustomMode("vehicleSubtype", customMode)}
              onComplete={() => completeVehicleField("vehicleSubtype", "brand")}
              inputRef={(element) => {
                vehicleFieldRefs.current.vehicleSubtype = element;
              }}
              placeholder={st("Valitse tyyppi")}
              customPlaceholder={st("Kirjoita tyyppi")}
              translateText={st}
            />
            <PresetField
              fieldKey="brand"
              label={st("Merkki")}
              value={vehicleDetails.brand}
              options={taxonomyBrandOptions}
              open={openVehiclePresetField === "brand"}
              onOpenChange={(open) => setVehiclePresetFieldOpen("brand", open)}
              onChange={updateVehicleBrand}
              customMode={Boolean(customVehicleFields.brand)}
              onCustomModeChange={(customMode) => updateVehicleCustomMode("brand", customMode)}
              onComplete={() => completeVehicleField("brand", "model")}
              inputRef={(element) => {
                vehicleFieldRefs.current.brand = element;
              }}
              placeholder={st("Valitse merkki")}
              customPlaceholder={st("Kirjoita merkki")}
              translateText={st}
            />
            <PresetField
              fieldKey="model"
              label={st("Malli")}
              value={vehicleDetails.model}
              options={modelOptions}
              open={openVehiclePresetField === "model"}
              onOpenChange={(open) => setVehiclePresetFieldOpen("model", open)}
              onChange={updateVehicleModel}
              customMode={Boolean(customVehicleFields.model)}
              onCustomModeChange={(customMode) => updateVehicleCustomMode("model", customMode)}
              onComplete={() => completeVehicleField("model", "year")}
              inputRef={(element) => {
                vehicleFieldRefs.current.model = element;
              }}
              placeholder={st("Valitse malli")}
              customPlaceholder={st("Kirjoita malli")}
              translateText={st}
            />
            <PresetField
              fieldKey="year"
              label={st("Vuosimalli")}
              value={vehicleDetails.year}
              options={vehicleYearOptions}
              open={openVehiclePresetField === "year"}
              onOpenChange={(open) => setVehiclePresetFieldOpen("year", open)}
              onChange={(value) => updateVehicleDetail("year", value)}
              customMode={Boolean(customVehicleFields.year)}
              onCustomModeChange={(customMode) => updateVehicleCustomMode("year", customMode)}
              onComplete={() => completeVehicleField("year", "engineCc")}
              inputRef={(element) => {
                vehicleFieldRefs.current.year = element;
              }}
              placeholder={st("Valitse vuosimalli")}
              customPlaceholder={st("Kirjoita vuosimalli")}
              translateText={st}
            />
            <PresetField
              fieldKey="engineCc"
              label={st("Moottorin koko (cc)")}
              value={vehicleDetails.engineCc}
              options={vehiclePreset.engineCcs}
              open={openVehiclePresetField === "engineCc"}
              onOpenChange={(open) => setVehiclePresetFieldOpen("engineCc", open)}
              onChange={(value) => updateVehicleDetail("engineCc", value)}
              customMode={Boolean(customVehicleFields.engineCc)}
              onCustomModeChange={(customMode) => updateVehicleCustomMode("engineCc", customMode)}
              onComplete={() => completeVehicleField("engineCc", "engineType")}
              inputRef={(element) => {
                vehicleFieldRefs.current.engineCc = element;
              }}
              placeholder={st("Valitse cc")}
              customPlaceholder={st("Kirjoita cc")}
              translateText={st}
            />
            <PresetField
              fieldKey="engineType"
              label={st("Moottori / moottorityyppi")}
              value={vehicleDetails.engineType}
              options={engineTypeOptions}
              open={openVehiclePresetField === "engineType"}
              onOpenChange={(open) => setVehiclePresetFieldOpen("engineType", open)}
              onChange={(value) => updateVehicleDetail("engineType", value)}
              customMode={Boolean(customVehicleFields.engineType)}
              onCustomModeChange={(customMode) => updateVehicleCustomMode("engineType", customMode)}
              onComplete={() => completeVehicleField("engineType")}
              inputRef={(element) => {
                vehicleFieldRefs.current.engineType = element;
              }}
              placeholder={st("Valitse moottorityyppi")}
              customPlaceholder={st("Kirjoita moottori")}
              translateText={st}
            />
          </form>
        </div>
      );
    }

    if (currentStep === 3) {
      if (mode === "multiple") {
        return (
          <div className={styles.multiCategoryStep}>
            <section className={styles.multiCategoryPanel} aria-label={st("Monikategoriointi")}>
              <header className={styles.multiCategoryHeader}>
                <div>
                  <h2>{st("Monikategoriointi")}</h2>
                  <p>{st("Valitse koko ajoneuvo tai poimi myytävät osat pääkategorian ja alakategorian kautta.")}</p>
                </div>
                <span>{formatSelectedCount(selectedMultiPartList.length)}</span>
              </header>

              <button
                type="button"
                className={`${styles.multiWholeVehicleCard} ${allMultiPartsSelected ? styles.multiWholeVehicleSelected : ""}`}
                onClick={toggleWholeVehicleParts}
                aria-pressed={allMultiPartsSelected}
              >
                <span className={`${styles.multiCheck} ${allMultiPartsSelected ? styles.multiCheckOn : ""}`}>
                  {allMultiPartsSelected ? <Check size={16} aria-hidden="true" /> : null}
                </span>
                <span>
                  <strong>{st("Myyn koko ajoneuvon")}</strong>
                  <small>{translateCategoryText(wholeVehicleOption.detail)}: {st("valitsee kaikki ajoneuvon osakategoriat kerralla.")}</small>
                </span>
              </button>

              <div className={styles.multiTreePanel}>
                <div className={styles.multiColumnHead}>
                  <strong>{st("Kategoriat ja osat")}</strong>
                  <span>{selectedMultiCategoryCount} / {multiPartTree.length} {st("pääkategoriaa valittu")}</span>
                </div>

                <div className={styles.multiTreeTools}>
                  <label className={styles.multiTreeSearch}>
                    <Search size={16} aria-hidden="true" />
                    <input
                      type="search"
                      value={multiPartSearch}
                      onChange={(event) => setMultiPartSearch(event.target.value)}
                      placeholder={st("Hae kategoriaa tai osaa")}
                    />
                  </label>
                  <span>{displayedMultiPartTree.length} / {multiPartTree.length} {st("näkyy")}</span>
                </div>

                <div className={styles.multiTreeList}>
                  {displayedMultiPartTree.map((categoryItem) => {
                    const categorySelectedCount = categoryItem.parts.filter((part) => multiParts[part.id]).length;
                    const categoryChecked = categorySelectedCount > 0;
                    const categoryOpen = Boolean(expandedMultiCategories[categoryItem.name]);
                    const categoryCanBatchSelect = categoryItem.parts.length <= 1;

                    return (
                      <div
                        key={categoryItem.name}
                        className={`${styles.multiCategoryAccordion} ${categoryOpen ? styles.multiCategoryOpen : ""}`}
                      >
                        <button
                          type="button"
                          className={`${styles.multiChoiceRow} ${categoryOpen ? styles.multiChoiceActive : ""}`}
                          onClick={() => toggleMultiCategory(categoryItem.name)}
                        >
                          {categoryCanBatchSelect ? (
                            <span
                              role="checkbox"
                              aria-checked={categoryChecked}
                              tabIndex={0}
                              className={`${styles.multiCheck} ${categoryChecked ? styles.multiCheckOn : ""}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleMultiPartBatch(categoryItem.parts);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                event.stopPropagation();
                                toggleMultiPartBatch(categoryItem.parts);
                              }}
                            >
                              {categoryChecked ? <Check size={15} aria-hidden="true" /> : null}
                            </span>
                          ) : (
                            <span className={styles.multiChoiceIcon}>
                              {getMultiCategoryIcon(categoryItem.name)}
                            </span>
                          )}
                          <span className={styles.multiChoiceText}>
                            <strong>{translateCategoryText(categoryItem.name)}</strong>
                            <small>{categorySelectedCount > 0 ? formatSelectedCount(categorySelectedCount) : formatPartCount(categoryItem.parts.length)}</small>
                          </span>
                          <ChevronDown size={17} aria-hidden="true" />
                        </button>

                        {categoryOpen ? (
                          <div className={styles.multiCategoryGroups}>
                            {categoryItem.sections.length > 0
                              ? categoryItem.sections
                                .filter((sectionItem) => {
                                  const openSectionName = getOpenMultiSectionName(categoryItem.name);
                                  return !openSectionName || sectionItem.name === openSectionName;
                                })
                                .map((sectionItem) => {
                                const sectionSelectedCount = sectionItem.parts.filter((part) => multiParts[part.id]).length;
                                const sectionChecked = sectionSelectedCount > 0;
                                const sectionKey = `${categoryItem.name}::${sectionItem.name}`;
                                const sectionHasChildren = hasNestedMultiPartItems(sectionItem.groups);
                                const sectionCanBatchSelect = sectionItem.parts.length <= 1 || !sectionHasChildren;
                                const shouldFlattenSection =
                                  sectionItem.groups.length === 1 &&
                                  sectionItem.groups[0].name === sectionItem.name;
                                const sectionOpen = sectionHasChildren && Boolean(expandedMultiSections[sectionKey]);

                                if (shouldFlattenSection) {
                                  return renderMultiGroup(categoryItem.name, sectionItem.groups[0]);
                                }

                                return (
                                  <div
                                    key={sectionItem.name}
                                    className={`${styles.multiSectionAccordion} ${sectionOpen ? styles.multiSectionOpen : ""}`}
                                  >
                                    <button
                                      type="button"
                                      className={`${styles.multiChoiceRow} ${sectionHasChildren ? "" : styles.multiChoiceLeaf}`}
                                      onClick={() => {
                                        if (sectionHasChildren) {
                                          toggleMultiSection(categoryItem.name, sectionItem.name);
                                        } else {
                                          toggleMultiPartBatch(sectionItem.parts);
                                        }
                                      }}
                                    >
                                      {sectionCanBatchSelect ? (
                                        <span
                                          role="checkbox"
                                          aria-checked={sectionChecked}
                                          tabIndex={0}
                                          className={`${styles.multiCheck} ${sectionChecked ? styles.multiCheckOn : ""}`}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            toggleMultiPartBatch(sectionItem.parts);
                                          }}
                                          onKeyDown={(event) => {
                                            if (event.key !== "Enter" && event.key !== " ") return;
                                            event.preventDefault();
                                            event.stopPropagation();
                                            toggleMultiPartBatch(sectionItem.parts);
                                          }}
                                        >
                                          {sectionChecked ? <Check size={15} aria-hidden="true" /> : null}
                                        </span>
                                      ) : (
                                        <span className={styles.multiChoiceIcon}>
                                          {getMultiCategoryIcon(sectionItem.name)}
                                        </span>
                                      )}
                                      <span className={styles.multiChoiceText}>
                                        <strong>{translateCategoryText(sectionItem.name)}</strong>
                                        <small>{sectionSelectedCount > 0 ? formatSelectedCount(sectionSelectedCount) : formatPartCount(sectionItem.parts.length)}</small>
                                      </span>
                                      {sectionHasChildren ? <ChevronDown size={17} aria-hidden="true" /> : null}
                                    </button>

                                    {sectionOpen ? (
                                      <div className={styles.multiSectionGroups}>
                                        {sectionItem.groups.map((groupItem) => renderMultiGroup(categoryItem.name, groupItem))}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })
                              : categoryItem.groups.map((groupItem) => renderMultiGroup(categoryItem.name, groupItem))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {displayedMultiPartTree.length === 0 ? (
                    <div className={styles.multiTreeEmpty}>
                      <strong>{st("Ei osumia")}</strong>
                      <span>{st("Kokeile toista hakusanaa.")}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <footer className={styles.multiSelectedBar}>
                <div>
                  <ClipboardList size={22} aria-hidden="true" />
                  <span>
                    <strong>{st("Valittuja kategorioita")}: {selectedMultiPartList.length}</strong>
                    <small>{st("Ilmoituksesi näkyy")} {selectedMultiPartList.length} {st("kategoriassa")}</small>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSelectedMultiParts((current) => !current)}
                  aria-expanded={showSelectedMultiParts}
                  aria-controls="selected-multi-parts"
                >
                  {st(showSelectedMultiParts ? "Piilota valitut" : "Näytä valitut")}
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
              </footer>
              {showSelectedMultiParts ? (
                <div id="selected-multi-parts" className={styles.multiSelectedList}>
                  {selectedMultiPartList.length > 0 ? (
                    selectedMultiPartList.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        className={styles.multiSelectedItem}
                        onClick={() => toggleMultiPart(part)}
                      >
                        <span>
                          <strong>{translateCategoryText(part.detail)}</strong>
                          <small>{translateCategoryText(part.category)} / {translateCategoryText(part.group)}</small>
                        </span>
                        <X size={15} aria-hidden="true" />
                      </button>
                    ))
                  ) : (
                    <div className={styles.multiSelectedEmpty}>
                      <strong>{st("Ei valittuja kategorioita")}</strong>
                      <span>{st("Valitse osia listasta, niin ne näkyvät tässä.")}</span>
                    </div>
                  )}
                </div>
              ) : null}

            </section>
          </div>
        );
      }

      return (
        <div className={styles.categoryStep}>
          <section className={styles.categoryPanel} aria-label={st("Kategorisoi tuote")}>
            <h2>{st("Kategorisoi tuotteesi")}</h2>
            <div className={styles.categorySelectGrid}>
              <CategorySelect
                label={st("Pääkategoria")}
                icon={Layers3}
                value={selectedCategory}
                onChange={(value) => {
                  updateStepThreeSelection(() => {
                    setCategory(value);
                    setCategoryGroup("");
                    setSubcategory("");
                    advanceCategoryField("group");
                  });
                }}
                options={categoryOptions.map((value) => ({ value, label: value }))}
                placeholder={st("Ei kategorioita")}
                translateText={translateCategoryText}
                autoOpenNonce={categoryAutoOpenTarget?.field === "category" ? categoryAutoOpenTarget.nonce : 0}
                open={categoryAutoOpenTarget?.field === "category"}
                onOpenChange={(open) => {
                  if (open) {
                    setCategoryAutoOpenTarget({ field: "category", nonce: Date.now() });
                    return;
                  }

                  setCategoryAutoOpenTarget((current) =>
                    current?.field === "category" ? null : current
                  );
                }}
              />
              <CategorySelect
                label={st("Alakategoria")}
                icon={FolderTree}
                value={selectedCategoryGroup}
                onChange={(value) => {
                  updateStepThreeSelection(() => {
                    setCategoryGroup(value);
                    setSubcategory("");
                    advanceCategoryField("detail");
                  });
                }}
                options={categoryGroupOptions}
                autoOpenNonce={categoryAutoOpenTarget?.field === "group" ? categoryAutoOpenTarget.nonce : 0}
                open={categoryAutoOpenTarget?.field === "group"}
                onOpenChange={(open) => {
                  if (open) {
                    setCategoryAutoOpenTarget({ field: "group", nonce: Date.now() });
                    return;
                  }

                  setCategoryAutoOpenTarget((current) =>
                    current?.field === "group" ? null : current
                  );
                }}
                placeholder={st("Valitse pääkategoria")}
                translateText={translateCategoryText}
              />
              <CategorySelect
                label={st("Tarkempi kategoria")}
                icon={Tags}
                value={selectedDetailCategory}
                onChange={(value) => {
                  updateStepThreeSelection(() => {
                    setSubcategory(value);
                    setCategoryAutoOpenTarget(null);
                  });
                }}
                options={detailCategoryOptions}
                autoOpenNonce={categoryAutoOpenTarget?.field === "detail" ? categoryAutoOpenTarget.nonce : 0}
                open={categoryAutoOpenTarget?.field === "detail"}
                onOpenChange={(open) => {
                  if (open) {
                    setCategoryAutoOpenTarget({ field: "detail", nonce: Date.now() });
                    return;
                  }

                  setCategoryAutoOpenTarget((current) =>
                    current?.field === "detail" ? null : current
                  );
                }}
                placeholder={st("Valitse alakategoria")}
                translateText={translateCategoryText}
              />
            </div>
          </section>

          <section className={styles.productDetailsPanel} aria-label={st("Lisää tuotetiedot")}>
            <h2>{st("Lisää tuotetiedot")}</h2>
            <div className={styles.productDetailsGrid}>
              <DetailInput
                label={st("Varaosanumero / OEM-numero (vapaaehtoinen)")}
                icon={Barcode}
                placeholder={st("Lisää jos tiedossa")}
                value={partNumber}
                onChange={setPartNumber}
              />
              <DetailInput
                label={st("Hinta (€)")}
                icon={Euro}
                inputMode="numeric"
                value={listingPrice}
                onChange={setListingPrice}
              />
              {singlePriceSuggestion ? (
                <PriceSuggestionCard
                  suggestion={singlePriceSuggestion}
                  onApply={() => setListingPrice(String(singlePriceSuggestion.avg))}
                />
              ) : singlePriceSuggestionLoading ? (
                <div className={styles.priceSuggestionCard}>
                  <span>Haetaan hintaehdotusta...</span>
                </div>
              ) : null}
            </div>
          </section>

        </div>
      );
    }

    if (mode === "multiple" && currentStep === 4) {
      return renderActiveMultiListingPart();

      return (
        <div className={styles.listingStack}>
          {selectedMultiPartList.length > 0 ? (
            selectedMultiPartGroups.map((groupItem) => {
              const groupOpen = expandedListingGroups[groupItem.name] ?? true;

              return (
                <section className={styles.multiListingGroup} key={groupItem.name}>
                  <button
                    type="button"
                    className={styles.multiListingGroupHeader}
                    onClick={() =>
                      setExpandedListingGroups((current) => ({
                        ...current,
                        [groupItem.name]: !(current[groupItem.name] ?? true)
                      }))
                    }
                    aria-expanded={groupOpen}
                  >
                    <span>
                      <strong>{groupItem.name}</strong>
                      <small>{groupItem.parts.length} valittua tuotetta</small>
                    </span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </button>

                  {groupOpen ? (
                    <div className={styles.multiListingTable}>
                      {groupItem.parts.map((part, index) => {
                        const translatedAutomaticTitle = getTranslatedAutomaticListingTitle(part);

                        return (
                          <details className={styles.multiListingRow} key={part.id}>
                            <summary>
                              <span className={styles.multiDragDots} aria-hidden="true">::</span>
                              <strong>{index + 1}</strong>
                              <span className={styles.multiPartIdentity}>
                                <b>{part.title || translatedAutomaticTitle}</b>
                                <small>{part.category} / {part.group}</small>
                              </span>
                              <input
                                inputMode="numeric"
                                placeholder="Hinta"
                                value={part.price}
                                onChange={(event) => updateMultiPartPrice(part.id, event.target.value)}
                                aria-label="Hinta"
                              />
                              <select
                                value={part.condition}
                                onChange={(event) => updateMultiPartField(part.id, "condition", event.target.value)}
                                aria-label="Kunto"
                                >
                                  <option value="">Kuntoluokitus</option>
                                  <option>Uusi</option>
                                  <option>Hyvä</option>
                                <option>Käytetty</option>
                                <option>Korjattava</option>
                              </select>
                            </summary>

                            <div className={styles.multiListingDetails}>
                              <label>
                                <span>Otsikko</span>
                                <input
                                  value={part.title}
                                  onChange={(event) => updateMultiPartField(part.id, "title", event.target.value)}
                                  placeholder={translatedAutomaticTitle}
                                />
                                <small className={styles.automaticTitleHint}>
                                  {st("Tämä on otsikko jos et itse otsikoi:")} {translatedAutomaticTitle}
                                </small>
                              </label>
                              <label>
                                <span>Osanumero / OEM</span>
                                <input
                                  value={part.partNumber}
                                  onChange={(event) => updateMultiPartField(part.id, "partNumber", event.target.value)}
                                  placeholder="Kirjoita osanumero"
                                />
                              </label>
                              <label className={styles.multiListingWideField}>
                                <span>Lisätiedot</span>
                                <textarea
                                  value={part.description}
                                  onChange={(event) => updateMultiPartField(part.id, "description", event.target.value)}
                                  placeholder="Kirjoita lisätiedot, viat, sopivuus tai muut huomiot"
                                />
                              </label>

                              <div className={styles.multiPartPhotos}>
                                <label className={styles.multiPartPhotoAdd}>
                                  <Camera size={17} aria-hidden="true" />
                                  <span>Lisää kuvat</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(event) => {
                                      if (event.target.files) void addMultiPartImages(part.id, event.target.files);
                                      event.target.value = "";
                                    }}
                                  />
                                </label>

                                {part.images.map((image) => (
                                  <button
                                    type="button"
                                    key={image.id}
                                    className={styles.multiPartPhoto}
                                    onClick={() => setPreviewImage(image)}
                                  >
                                    <img src={image.url} alt={image.name} />
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      className={styles.multiPartPhotoRemove}
                                      aria-label={`Poista kuva ${image.name}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        removeMultiPartImage(part.id, image.id);
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key !== "Enter" && event.key !== " ") return;
                                        event.preventDefault();
                                        event.stopPropagation();
                                        removeMultiPartImage(part.id, image.id);
                                      }}
                                    >
                                      <X size={13} aria-hidden="true" />
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })
          ) : (
            <div className={styles.multiListingEmpty}>
              <strong>Ei valittuja osia</strong>
              <span>Palaa kategoriaan ja valitse myytävät osat tai koko ajoneuvo.</span>
            </div>
          )}
        </div>
      );

      return (
        <div className={styles.listingStack}>
          {selectedMultiPartList.length > 0 ? (
            selectedMultiPartList.map((part, index) => (
              <div className={styles.multiListingRow} key={part.id}>
                <strong>Ilmoitus {index + 1}</strong>
                <input defaultValue={part.detail} placeholder="Otsikko" />
                <input
                  inputMode="numeric"
                  placeholder="Hinta (€)"
                  value={part.price}
                  onChange={(event) => updateMultiPartPrice(part.id, event.target.value)}
                />
                <select defaultValue="">
                  <option value="">Kuntoluokitus</option>
                  <option>Uusi</option>
                  <option>Hyvä</option>
                  <option>Käytetty</option>
                  <option>Korjattava</option>
                </select>
              </div>
            ))
          ) : (
            <div className={styles.multiListingEmpty}>
              <strong>Ei valittuja osia</strong>
              <span>Palaa kategoriaan ja valitse myytävät osat tai koko ajoneuvo.</span>
            </div>
          )}
        </div>
      );
    }

    if (mode === "multiple" && currentStep === 5) {
      return renderMultiDeliveryStep();
    }

    if (mode === "single" && currentStep === 4) {
      return (
        <div className={styles.conditionStep}>
          <section className={styles.conditionPanel} aria-label={st("Kunto ja sijainti")}>
            <h2>{st("Kunto")}</h2>
            <div className={styles.conditionGrid}>
              <ConditionSelect
                label={st("Kunto")}
                value={condition}
                onChange={(value) => {
                  setCondition(value);
                  window.setTimeout(() => listingLocationInputRef.current?.focus(), 60);
                }}
                translateText={st}
              />
              <PlainIconInput
                label="Sijainti"
                icon={MapPin}
                placeholder={profileCity || "Kaupunki tai paikkakunta"}
                value={listingLocation}
                onChange={updateListingLocation}
                inputRef={listingLocationInputRef}
              />
              {renderDeliveryMethodSelector()}
            </div>
          </section>

          <aside className={styles.conditionTip}>
            <div>
              <strong>{st("Ole rehellinen ja tarkka")}</strong>
              <p>{st("Tarkat tiedot rakentavat luottamusta ja auttavat myymään nopeammin.")}</p>
            </div>
          </aside>
        </div>
      );
    }

    if (mode === "single" && currentStep === 5) {
      return (
        <div className={styles.photosStep}>
          <label
            className={styles.photoDropzone}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addImageFiles(event.dataTransfer.files);
            }}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => {
                if (event.target.files) addImageFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
            <span className={styles.photoUploadIcon} aria-hidden="true">
              <Camera size={30} />
            </span>
            <strong>{st("Ved\u00e4 ja pudota kuvat t\u00e4h\u00e4n")}</strong>
            <small>{st("tai")}</small>
            <span className={styles.photoChooseButton}>{st("Valitse kuvat")}</span>
            <em>{st("PNG, JPG tai WEBP \u00b7 isot kuvat muunnetaan automaattisesti 1080p-kokoon")}</em>
          </label>

          {uploadedImages.length > 0 ? (
            <div className={styles.photoPreviewGrid} aria-label="Lisätyt kuvat">
              {uploadedImages.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className={styles.photoPreviewTile}
                  onClick={() => setPreviewImage(image)}
                  aria-label={`Avaa kuva ${image.name} isompana`}
                >
                  <img src={image.url} alt={image.name} />
                  <span
                    role="button"
                    tabIndex={0}
                    className={styles.photoRemoveButton}
                    aria-label={`Poista kuva ${image.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeUploadedImage(image.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      removeUploadedImage(image.id);
                    }}
                  >
                    <X size={14} aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <section className={styles.photoTips} aria-label={st("Kuvavinkit")}>
            <div>
              <strong>{st("Hyv\u00e4 valaistus")}</strong>
              <p>{st("K\u00e4yt\u00e4 luonnonvaloa tai kirkasta sis\u00e4valoa.")}</p>
            </div>
            <div>
              <Check size={20} aria-hidden="true" />
              <strong>{st("Tarkka ja selke\u00e4")}</strong>
              <p>{st("Varmista, ett\u00e4 kuva on ter\u00e4v\u00e4 ja hyv\u00e4laatuinen.")}</p>
            </div>
            <div>
              <Camera size={20} aria-hidden="true" />
              <strong>{st("N\u00e4yt\u00e4 kaikki kulmat")}</strong>
              <p>{st("Lis\u00e4\u00e4 useampi kuva eri suunnista.")}</p>
            </div>
          </section>
        </div>
      );
    }

    if (mode === "single" && currentStep === 6) {
      return (
        <section className={styles.detailsPanel} aria-label={st("Otsikko ja kuvaus")}>
          <label className={styles.detailsField}>
            <span>
              <strong>{st("Otsikko")}</strong>
              <em>{listingTitle.length} / 80</em>
            </span>
            <input
              maxLength={80}
              value={listingTitle}
              onChange={(event) => setListingTitle(event.target.value)}
              placeholder={st("Esim. Ski-Doo variaattori 850 E-TEC")}
            />
            <small className={styles.automaticTitleHint}>
              {st("T\u00e4m\u00e4 on otsikko jos et itse otsikoi:")} {getTranslatedAutomaticListingTitle()}
            </small>
          </label>

          <label className={styles.detailsField}>
            <span>
              <strong>{st("Kuvaus")}</strong>
              <em>{listingDescription.length} / 5000</em>
            </span>
            <textarea
              maxLength={5000}
              value={listingDescription}
              onChange={(event) => setListingDescription(event.target.value)}
              placeholder={
                selectedSinglePartNeedsTrackMatDimensions
                  ? "Kirjoita telamaton mitat, kunto, sopivuus ja muut tärkeät tiedot..."
                  : st("Kerro kunto, ominaisuudet, sopivuus ja muut t\u00e4rke\u00e4t tiedot...")
              }
            />
          </label>

          <section className={styles.descriptionTips} aria-label={st("Vinkit hyv\u00e4\u00e4n kuvaukseen")}>
            <h2>
              {st("Vinkit hyv\u00e4\u00e4n kuvaukseen")}
            </h2>
            <div>
              <span><Check size={18} aria-hidden="true" /> {st("Kerro t\u00e4rkeimm\u00e4t ominaisuudet")}</span>
              <span><Check size={18} aria-hidden="true" /> {st("Mainitse kunto")}</span>
              {selectedSinglePartNeedsTrackMatDimensions ? (
                <span><Check size={18} aria-hidden="true" /> Kirjoita telamaton mitat</span>
              ) : null}
              <span><Check size={18} aria-hidden="true" /> {st("Lis\u00e4\u00e4 sopivuustiedot")}</span>
              <span><Check size={18} aria-hidden="true" /> {st("Ole rehellinen ja tarkka")}</span>
            </div>
          </section>
        </section>
      );
    }

    const vehicleSummary = uniqueOptions([
      vehicleType.title,
      vehicleDetails.vehicleSubtype,
      vehicleDetails.brand,
      vehicleDetails.model,
      vehicleDetails.year
    ]).map((part) => st(part)).join(" ");
    const technicalSummary = uniqueOptions([
      vehicleDetails.engineCc ? `${vehicleDetails.engineCc} cc` : "",
      vehicleDetails.engineType
    ]).join(" / ");
    const categorySummary = uniqueOptions([
      selectedCategory,
      selectedCategoryGroup,
      selectedDetailCategory
    ]).map((part) => translateCategoryText(part)).join(" / ");
    const publishStats = [
      { label: st("Tyyppi"), value: mode === "single" ? st("Yksitt\u00e4inen ilmoitus") : st("Useampi ilmoitus") },
      { label: st("Hinta"), value: listingPrice.trim() ? `${listingPrice.trim()} ${st("euroa")}` : st("Ei lisatty") },
      { label: st("Kunto"), value: condition ? st(condition) : st("Ei lisatty") },
      { label: st("Kuvat"), value: `${uploadedImages.length} ${st("kpl")}` },
      ...(isCompanyAccount
        ? [{ label: st("Myyj\u00e4"), value: selectedCompanySeller?.name ?? st("Valitsematta") }]
        : [])
    ];
    const publishRows = [
      { label: st("Ajoneuvo"), value: vehicleSummary || st("Ei lisatty") },
      { label: st("Tekniikka"), value: technicalSummary || st("Ei lisatty") },
      { label: st("Kategoria"), value: categorySummary || st("Ei lisatty") },
      { label: st("Sijainti"), value: buildListingLocation(listingLocation, profileCity, profileCountry) || st("Ei lisatty") },
      { label: st("Toimitustapa"), value: st(getDeliveryMethodLabel()) },
      { label: st("Varaosanumero"), value: partNumber.trim() || st("Ei lisatty") }
    ];

    return (
      <div className={styles.publishPanel}>
        <div className={styles.publishHero}>
          <span className={styles.publishIcon} aria-hidden="true">
            <ShieldCheck size={30} />
          </span>
          <div>
            <strong>{mode === "single" ? st("Ilmoitus valmis julkaistavaksi") : st("Ilmoitukset valmiina julkaisuun")}</strong>
            <p>{st("Tarkista viel\u00e4 t\u00e4rkeimm\u00e4t tiedot ennen kuin ilmoitus l\u00e4htee ostajille n\u00e4kyviin.")}</p>
          </div>
        </div>

        {isCompanyAccount ? (
          <section className={styles.companySellerPanel} aria-label={st("Ilmoituksen myyjä")}>
            <div>
              <strong>{st("Ilmoituksen myyjä")}</strong>
              <p>{st("Voit valita erillisen myyjän. Jos et valitse, ilmoitus julkaistaan yrityksen tiedoilla.")}</p>
            </div>
            {companySellers.length > 0 ? (
              <label className={styles.companySellerSelect}>
                <span>{st("Myyjä")}</span>
                <select
                  value={selectedCompanySellerId}
                  onChange={(event) => setSelectedCompanySellerId(event.target.value)}
                >
                  <option value="">{st("Yrityksen tiedot")}</option>
                  {companySellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name} - {seller.phone}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className={styles.companySellerMissing}>
                {st("Erillisiä myyjiä ei ole lisätty. Ilmoitus julkaistaan yrityksen tiedoilla.")}
              </div>
            )}
          </section>
        ) : null}

        <div className={styles.publishStats} aria-label={st("Ilmoituksen pikatiedot")}>
          {publishStats.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <section className={styles.publishSummary} aria-label={st("Ilmoituksen yhteenveto")}>
          <div className={styles.publishTitleBlock}>
            <span>{st("Otsikko")}</span>
            <strong>{listingTitle.trim() || getTranslatedAutomaticListingTitle()}</strong>
            <p>{listingDescription.trim() || st("Kuvausta ei ole viela lisatty.")}</p>
          </div>

          <div className={styles.publishRows}>
            {publishRows.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>
        <strong>{mode === "single" ? st("Yksittäinen ilmoitus valmis julkaistavaksi") : st("Multi-ilmoitukset valmiina julkaisuun")}</strong>
        <p>{st("Tarkista vielä otsikot, hinnat, kuvat ja sijainti ennen julkaisua.")}</p>
      </div>
    );
  }

  return (
    <main className={styles.page} aria-label={st("Luo myynti-ilmoitus")}>
      <section className={styles.shell} ref={shellRef}>
        <aside className={`${styles.stepper} ${styles.stepperCompact}`} aria-label="Ilmoituksen vaiheet">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const active = step.number === currentStep;
            const completed = step.number < currentStep;
            const canNavigate = true;

            return (
              <div
                key={step.number}
                className={`${styles.step} ${active ? styles.stepActive : ""} ${completed ? styles.stepCompleted : ""}`}
              >
                <button
                  type="button"
                  className={styles.stepNumber}
                  onClick={() => {
                    if (canNavigate) setCurrentStep(step.number);
                  }}
                  disabled={!canNavigate}
                  aria-label={`Siirry vaiheeseen ${step.number}: ${step.title}`}
                >
                  {step.number}
                </button>
                {index < steps.length - 1 ? <span className={styles.stepConnector} aria-hidden="true" /> : null}
                <button
                  type="button"
                  className={styles.stepBody}
                  onClick={() => {
                    if (canNavigate) setCurrentStep(step.number);
                  }}
                  disabled={!canNavigate}
                >
                  <Icon size={22} aria-hidden="true" />
                  <strong>{st(step.title)}</strong>
                  <small>{st(step.description)}</small>
                </button>
              </div>
            );
          })}
          <button
            type="button"
            className={styles.resetDraftButton}
            onClick={() => setShowResetConfirm(true)}
          >
            <X size={15} aria-hidden="true" />
            <span>{st("Nollaa")}</span>
          </button>
        </aside>

        <nav
          className={styles.mobileSteps}
          aria-label="Ilmoituksen vaiheet"
        >
          <div className={styles.mobileStepSummary}>
            <span>{currentStepInfo.number}</span>
            <div>
              <strong>{st(currentStepInfo.title)}</strong>
              <small>{st(currentStepInfo.description)}</small>
            </div>
            <em>{currentStep}/{steps.length}</em>
          </div>
          <i
            className={styles.mobileStepProgress}
            aria-hidden="true"
            style={{ ["--progress" as string]: `${(currentStep / steps.length) * 100}%` }}
          />
          <div className={styles.mobileStepJumpList}>
          {steps.map((step) => (
            <button
              key={step.number}
              type="button"
              className={step.number === currentStep ? styles.mobileStepActive : ""}
              onClick={() => setCurrentStep(step.number)}
              aria-label={`${st("Siirry vaiheeseen")} ${step.number}: ${st(step.title)}`}
            >
              <span>{step.number}</span>
              <small>{st(step.title)}</small>
            </button>
          ))}
            <button
              type="button"
              className={styles.resetDraftButton}
              onClick={() => setShowResetConfirm(true)}
            >
              <X size={14} aria-hidden="true" />
              <span>{st("Nollaa")}</span>
            </button>
          </div>
        </nav>

        {currentStep === 1 ? (
          <section className={styles.content}>
            <header className={styles.header}>
              <h1>{st("Luo myynti-ilmoitus")}</h1>
              <h2>{st("Valitse ilmoitustyyppi")}</h2>
              <p>{st("Valitse, haluatko listata useita osia samasta ajoneuvosta vai yksittäisen osan.")}</p>
            </header>

            <div className={styles.modeGrid} role="radiogroup" aria-label={st("Ilmoitustyyppi")}>
              {modeCards.map((card) => {
                const Icon = card.icon;
                const active = mode === card.value;

                return (
                  <button
                    key={card.value}
                    type="button"
                    className={`${styles.modeCard} ${active ? styles.modeCardSelected : ""}`}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(card.value)}
                  >
                    {active ? (
                      <span className={styles.modeCheck} aria-hidden="true">
                        <Check size={24} />
                      </span>
                    ) : null}
                    <span className={styles.modeIcon} aria-hidden="true">
                      <Icon size={50} strokeWidth={1.9} />
                    </span>
                    <strong>{st(card.title)}</strong>
                    <i aria-hidden="true" />
                    <span className={styles.modeCopy}>
                      {card.text.map((line) => (
                        <span key={line}>{st(line)}</span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>

            <button type="button" className={styles.continueButton} onClick={continueToNextStep}>
              <span>{st("Jatka")}</span>
              <ArrowRight size={30} aria-hidden="true" />
            </button>

          </section>
        ) : (
          <section className={styles.vehicleContent} ref={vehicleContentRef}>
            <header className={styles.vehicleHeader}>
              <h1><span>{currentStepInfo.number}.</span> {st(currentStepInfo.title)}</h1>
              <p>{getStepLead()}</p>
            </header>

            {renderCurrentStep()}

            {publishError ? (
              <div className={styles.publishError} role="alert">
                {publishError}
              </div>
            ) : null}

            <div className={styles.vehicleActions}>
              <button type="button" className={styles.backButton} onClick={goToPreviousStep}>
                <ArrowLeft size={22} aria-hidden="true" />
                <span>{st("Edellinen")}</span>
              </button>
              <button
                type="button"
                className={`${styles.nextButton} ${isLastStep ? styles.publishButton : ""}`}
                onClick={handlePrimaryAction}
                disabled={isPublishing}
              >
                <span>{getPrimaryActionLabel()}</span>
                <ArrowRight size={22} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}
      </section>
      {previewImage ? (
        <div className={styles.photoLightbox} role="dialog" aria-modal="true" aria-label={previewImage.name}>
          <button
            type="button"
            className={styles.photoLightboxClose}
            onClick={() => setPreviewImage(null)}
            aria-label="Sulje kuva"
          >
            <X size={24} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.photoLightboxBackdrop}
            onClick={() => setPreviewImage(null)}
            aria-label="Sulje esikatselu"
          />
          <img src={previewImage.url} alt={previewImage.name} />
        </div>
      ) : null}
      {showResetConfirm ? (
        <div className={styles.resetConfirmOverlay} role="presentation">
          <section className={styles.resetConfirmDialog} role="dialog" aria-modal="true" aria-labelledby="reset-draft-title">
            <button
              type="button"
              className={styles.resetConfirmClose}
              onClick={() => setShowResetConfirm(false)}
              aria-label="Sulje"
            >
              <X size={18} aria-hidden="true" />
            </button>
            <div className={styles.resetConfirmIcon} aria-hidden="true">
              <X size={20} />
            </div>
            <div>
              <h2 id="reset-draft-title">Nollataanko luonnos?</h2>
              <p>Kaikki tämän myynti-ilmoituksen tiedot ja kuvat poistetaan, eikä niitä palauteta automaattisesti.</p>
            </div>
            <div className={styles.resetConfirmActions}>
              <button type="button" onClick={() => setShowResetConfirm(false)}>
                Peruuta
              </button>
              <button type="button" className={styles.resetConfirmPrimary} onClick={resetSellDraft}>
                Nollaa luonnos
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {feedbackPrompt ? (
        <ListingCreationFeedbackModal
          prompt={feedbackPrompt}
          translate={st}
          onDone={() => {
            const href = feedbackPrompt.returnHref;
            setFeedbackPrompt(null);
            router.push(href);
          }}
        />
      ) : null}
    </main>
  );
}

function ListingCreationFeedbackModal({
  prompt,
  translate,
  onDone
}: {
  prompt: ListingFeedbackPrompt;
  translate: (text: string) => string;
  onDone: () => void;
}) {
  const [ratings, setRatings] = useState({
    categoryRating: 1,
    detailsRating: 1,
    photosRating: 1,
    overallRating: 1
  });
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = ratings.overallRating > 0;
  const tt = translate;

  async function save(skipped = false) {
    if (saving) return;
    if (!skipped && !canSubmit) {
      setError(tt("Anna ainakin kokonaisarvio tähdillä."));
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { saveListingCreationFeedback } = await import("@/lib/supabase");
      const { error: saveError } = await saveListingCreationFeedback({
        listingId: prompt.listingId,
        listingMode: prompt.listingMode,
        vehicleType: prompt.vehicleType,
        category: prompt.category,
        subcategory: prompt.subcategory,
        categoryRating: ratings.categoryRating || undefined,
        detailsRating: ratings.detailsRating || undefined,
        photosRating: ratings.photosRating || undefined,
        overallRating: ratings.overallRating || undefined,
        comment,
        skipped
      });

      if (saveError) {
        console.error("Listing feedback save failed", saveError);
      }

      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.feedbackOverlay} role="presentation">
      <section className={styles.feedbackModal} role="dialog" aria-modal="true" aria-labelledby="listing-feedback-title">
        <div className={styles.feedbackIcon} aria-hidden="true">
          <Star size={26} />
        </div>
        <span>{tt("Ensimmäinen ilmoitus julkaistu")}</span>
        <h2 id="listing-feedback-title">{tt("Arvioi ilmoituksen luonti")}</h2>
        <p>{tt("Anna nopea arvio kategoriasta, tiedoista ja kuvien lisäämisestä. Näet ilmoituksen heti tämän jälkeen.")}</p>

        <div className={styles.feedbackRatingGrid}>
          <FeedbackRating
            label={tt("Kategorian valinta")}
            value={ratings.categoryRating}
            onChange={(value) => setRatings((current) => ({ ...current, categoryRating: value }))}
          />
          <FeedbackRating
            label={tt("Tuotetietojen lisääminen")}
            value={ratings.detailsRating}
            onChange={(value) => setRatings((current) => ({ ...current, detailsRating: value }))}
          />
          <FeedbackRating
            label={tt("Kuvien lisääminen")}
            value={ratings.photosRating}
            onChange={(value) => setRatings((current) => ({ ...current, photosRating: value }))}
          />
          <FeedbackRating
            label={tt("Kokonaisuus")}
            value={ratings.overallRating}
            onChange={(value) => setRatings((current) => ({ ...current, overallRating: value }))}
          />
        </div>

        <label className={styles.feedbackComment}>
          <span>{tt("Kommentti ylläpidolle (vapaaehtoinen)")}</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={700}
            placeholder={tt("Mikä toimi hyvin tai mikä tuntui hankalalta?")}
          />
        </label>

        {error ? <div className={styles.feedbackError}>{error}</div> : null}

        <div className={styles.feedbackActions}>
          <button type="button" onClick={() => void save(true)} disabled={saving}>
            {tt("Ohita")}
          </button>
          <button type="button" onClick={() => void save(false)} disabled={saving || !canSubmit}>
            {saving ? tt("Tallennetaan...") : tt("Lähetä arvio")}
          </button>
        </div>
      </section>
    </div>
  );
}

function FeedbackRating({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles.feedbackRating}>
      <span>{label}</span>
      <div>
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            className={rating <= value ? styles.feedbackStarActive : ""}
            onClick={() => onChange(rating === value ? Math.max(1, rating - 1) : rating)}
            aria-label={`${label}: ${rating} tähteä`}
          >
            <Star size={22} fill="currentColor" />
          </button>
        ))}
      </div>
    </div>
  );
}

function PresetField({
  fieldKey,
  label,
  value,
  options,
  placeholder,
  customPlaceholder,
  customMode,
  onCustomModeChange,
  onChange,
  onComplete,
  inputRef,
  open,
  onOpenChange,
  translateText = (text: string) => text
}: {
  fieldKey: VehicleDetailKey;
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  customPlaceholder: string;
  customMode: boolean;
  onCustomModeChange: (customMode: boolean) => void;
  onChange: (value: string) => void;
  onComplete: () => void;
  inputRef: (element: HTMLInputElement | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  translateText?: (text: string) => string;
}) {
  const cleanOptions = uniqueOptions(options);
  const otherLabel = "Muu";
  const isKnownValue = cleanOptions.includes(value);
  const effectiveCustomMode = customMode || Boolean(value && !isKnownValue);
  const presetOptions = useMemo(
    () => cleanOptions.filter((option) => option !== otherLabel),
    [cleanOptions]
  );
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const innerInputRef = useRef<HTMLInputElement | null>(null);
  const displayValue = effectiveCustomMode ? value : translateText(value);

  useEffect(() => {
    return () => {
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  function scheduleComplete(nextValue: string) {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    if (!nextValue.trim()) return;
    completeTimerRef.current = setTimeout(() => {
      onComplete();
      completeTimerRef.current = null;
    }, 850);
  }

  function selectOption(option: string) {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    onCustomModeChange(false);
    onChange(option);
    onOpenChange(false);
    window.setTimeout(() => {
      onOpenChange(false);
      onComplete();
    }, 40);
    window.setTimeout(() => onOpenChange(false), 140);
  }

  function selectOther() {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    onCustomModeChange(true);
    onOpenChange(false);
    onChange("");
    window.setTimeout(() => {
      innerInputRef.current?.focus();
    }, 60);
  }

  function toggleOptions() {
    onOpenChange(!open);
  }

  return (
    <label className={styles.presetField} data-preset-key={fieldKey} data-preset-label={label}>
      <span>{label}</span>
      <span
        className={`${styles.presetSelectShell} ${open ? styles.presetSelectOpen : ""} ${effectiveCustomMode ? styles.presetSelectCustom : ""}`}
      >
        <input
          ref={(element) => {
            innerInputRef.current = element;
            inputRef(element);
          }}
          value={displayValue}
          onFocus={() => {
            if (!effectiveCustomMode) onOpenChange(true);
          }}
          onClick={() => {
            if (!effectiveCustomMode) onOpenChange(true);
          }}
          onBlur={() => {
            window.setTimeout(() => onOpenChange(false), 120);
          }}
          onChange={(event) => {
            if (!effectiveCustomMode) return;
            onChange(event.target.value);
            scheduleComplete(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              onOpenChange(true);
            }
            if (event.key === "Enter" && effectiveCustomMode && value.trim()) {
              event.preventDefault();
              onOpenChange(false);
              onComplete();
            }
            if (event.key === "Escape") {
              onOpenChange(false);
            }
          }}
          readOnly={!effectiveCustomMode}
          placeholder={effectiveCustomMode ? customPlaceholder : placeholder}
        />
        <button
          type="button"
          className={styles.presetSelectToggle}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleOptions}
          aria-label={`Avaa ${label.toLowerCase()} valikko`}
        >
          <ChevronDown size={17} aria-hidden="true" />
        </button>
        {open ? (
          <div
            className={styles.presetOptionList}
            data-sell-preset-options="true"
            data-sell-preset-version="dark-2"
            role="listbox"
            style={{
              background: "#061726",
              backgroundColor: "#061726",
              borderColor: "rgba(143, 194, 243, 0.36)",
              color: "#dce8f7"
            }}
          >
            {presetOptions.map((option) => {
              const active = option === value && isKnownValue;

              return (
                <button
                  key={option}
                  type="button"
                  data-sell-preset-option="true"
                  data-active={active ? "true" : "false"}
                  className={active ? styles.presetOptionActive : ""}
                  style={{
                    background: active ? "#8fc2f3" : "#061726",
                    backgroundColor: active ? "#8fc2f3" : "#061726",
                    color: active ? "#04111f" : "#dce8f7"
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectOption(option);
                  }}
                >
                  {translateText(option)}
                </button>
              );
            })}
            <button
              type="button"
              data-sell-preset-option="true"
              data-active={effectiveCustomMode ? "true" : "false"}
              className={effectiveCustomMode ? styles.presetOptionActive : styles.presetOptionOther}
              style={{
                background: effectiveCustomMode ? "#8fc2f3" : "#061726",
                backgroundColor: effectiveCustomMode ? "#8fc2f3" : "#061726",
                color: effectiveCustomMode ? "#04111f" : "#f7b56e"
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                selectOther();
              }}
            >
              {translateText(otherLabel)}
            </button>
          </div>
        ) : null}
      </span>
    </label>
  );
}

function getConditionDotClass(conditionValue: string) {
  const conditionKey =
    conditionValue === "Uusi"
      ? "New"
      : conditionValue === "Hyvä"
        ? "Good"
        : conditionValue === "Käytetty"
          ? "Used"
          : conditionValue === "Korjattava"
            ? "Repair"
            : "Empty";

  return styles[`conditionDot${conditionKey}` as keyof typeof styles];
}

function ConditionSelect({
  compact = false,
  label = "Kunto",
  onChange,
  value,
  translateText = (text: string) => text
}: {
  compact?: boolean;
  label?: string;
  onChange: (value: string) => void;
  value: string;
  translateText?: (text: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const pointerSelectionRef = useRef<string | null>(null);
  const selectedOption = conditionOptions.find((option) => option.value === value);
  const displayValue = translateText(selectedOption?.label ?? "Kuntoluokitus");

  function chooseOption(nextValue: string) {
    setOpen(false);
    onChange(nextValue);
  }

  return (
    <label
      className={`${styles.categorySelectField} ${compact ? styles.conditionSelectCompact : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      {!compact ? <span>{label}</span> : null}
      <span
        className={`${styles.categorySelectShell} ${styles.conditionSelectShell} ${open ? styles.categorySelectOpen : ""}`}
        data-sell-condition-select="true"
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 80);
        }}
      >
        <span className={styles.categorySelectIcon}>
          <span className={`${styles.conditionSelectDot} ${getConditionDotClass(value)}`} />
        </span>
        <button
          type="button"
          className={`${styles.categorySelectButton} ${value ? "" : styles.categorySelectPlaceholder}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {displayValue}
        </button>
        <ChevronDown size={20} aria-hidden="true" />
        {open ? (
          <div
            className={styles.categorySelectMenu}
            data-sell-condition-menu="true"
            role="listbox"
            style={{
              background: "#061726",
              backgroundColor: "#061726",
              color: "#dce8f7"
            }}
          >
            {conditionOptions.map((option) => {
              const active = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={active ? styles.categorySelectOptionActive : styles.categorySelectOption}
                  data-active={active ? "true" : "false"}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    pointerSelectionRef.current = option.value;
                    chooseOption(option.value);
                    event.currentTarget.blur();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (pointerSelectionRef.current === option.value) {
                      pointerSelectionRef.current = null;
                      return;
                    }
                    chooseOption(option.value);
                    event.currentTarget.blur();
                  }}
                  role="option"
                  aria-selected={active}
                >
                  <span className={`${styles.conditionSelectDot} ${getConditionDotClass(option.value)}`} />
                  <span>{translateText(option.label)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </span>
    </label>
  );
}

function CategorySelect({
  label,
  icon: Icon,
  value,
  options,
  placeholder,
  autoOpenNonce,
  open: controlledOpen,
  onOpenChange,
  onChange,
  translateText = (text: string) => text
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  options: SelectOption[];
  placeholder: string;
  autoOpenNonce?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (value: string) => void;
  translateText?: (text: string) => string;
}) {
  const hasOptions = options.length > 0;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const pointerSelectionRef = useRef<string | null>(null);
  const open = controlledOpen ?? uncontrolledOpen;
  const selectedOption = options.find((option) => option.value === value);
  const displayValue = hasOptions ? translateText(selectedOption?.label ?? placeholder) : placeholder;

  const setSelectOpen = useCallback((nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
      return;
    }

    setUncontrolledOpen(nextOpen);
  }, [onOpenChange]);

  useEffect(() => {
    if (!autoOpenNonce || !hasOptions || open) return;
    setSelectOpen(true);
  }, [autoOpenNonce, hasOptions, open, setSelectOpen]);

  function chooseOption(nextValue: string) {
    setSelectOpen(false);
    onChange(nextValue);
  }

  return (
    <label
      className={styles.categorySelectField}
      onClick={(event) => event.stopPropagation()}
    >
      <span>{label}</span>
      <span
        className={`${styles.categorySelectShell} ${open ? styles.categorySelectOpen : ""}`}
        data-sell-category-select="true"
        onBlur={() => {
          window.setTimeout(() => setSelectOpen(false), 120);
        }}
      >
        <span className={styles.categorySelectIcon}>
          {value ? getMultiCategoryIcon(value) : <Icon size={22} aria-hidden="true" />}
        </span>
        <button
          type="button"
          className={`${styles.categorySelectButton} ${value ? "" : styles.categorySelectPlaceholder}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (hasOptions) setSelectOpen(!open);
          }}
          disabled={!hasOptions}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {displayValue}
        </button>
        <ChevronDown size={20} aria-hidden="true" />
        {open && hasOptions ? (
          <div
            className={styles.categorySelectMenu}
            data-sell-category-menu="true"
            data-option-count={options.length}
            role="listbox"
            style={{
              background: "#061726",
              backgroundColor: "#061726",
              backgroundClip: "padding-box",
              boxShadow: "inset 0 0 0 9999px #061726, 0 22px 54px rgba(0, 0, 0, 0.5)",
              color: "#dce8f7"
            }}
          >
            {options.map((option) => {
              const active = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={active ? styles.categorySelectOptionActive : styles.categorySelectOption}
                  data-sell-category-option="true"
                  data-active={active ? "true" : "false"}
                  style={{
                    background: active ? "rgba(56, 189, 248, 0.16)" : "#061726",
                    backgroundColor: active ? "rgba(56, 189, 248, 0.16)" : "#061726",
                    color: "#dce8f7"
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    pointerSelectionRef.current = option.value;
                    chooseOption(option.value);
                    event.currentTarget.blur();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (pointerSelectionRef.current === option.value) {
                      pointerSelectionRef.current = null;
                      return;
                    }
                    chooseOption(option.value);
                    event.currentTarget.blur();
                  }}
                  role="option"
                  aria-selected={active}
                >
                  <span className={styles.categorySelectOptionIcon}>
                    {getMultiCategoryIcon(option.value)}
                  </span>
                  <span>{translateText(option.label)}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </span>
    </label>
  );
}

function formatSuggestionPrice(value: number) {
  return `${new Intl.NumberFormat("fi-FI", {
    maximumFractionDigits: 0
  }).format(value)} €`;
}

function PriceSuggestionCard({
  suggestion,
  onApply
}: {
  suggestion: PriceSuggestion;
  onApply: () => void;
}) {
  return (
    <div className={styles.priceSuggestionCard}>
      <span>Hintaehdotus</span>
      <strong>{formatSuggestionPrice(suggestion.avg)}</strong>
      <small>
        Tyypillinen väli {formatSuggestionPrice(suggestion.q1)}-{formatSuggestionPrice(suggestion.q3)} · {suggestion.count} hintaa
      </small>
      <em>{suggestion.label}</em>
      <button type="button" onClick={onApply}>
        Käytä ehdotusta
      </button>
    </div>
  );
}

function DetailInput({
  label,
  icon: Icon,
  placeholder,
  inputMode,
  value,
  onChange
}: {
  label: string;
  icon: LucideIcon;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.detailInputField}>
      <span>{label}</span>
      <span className={styles.detailInputShell}>
        <Icon size={24} aria-hidden="true" />
        <input
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

function PlainIconInput({
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
  inputRef
}: {
  label: string;
  icon: LucideIcon;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className={styles.plainIconField}>
      <span>{label}</span>
      <span className={styles.plainIconShell}>
        <Icon size={22} aria-hidden="true" />
        <input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}
