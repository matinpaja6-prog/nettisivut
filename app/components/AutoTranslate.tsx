"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generatedUiTranslations } from "@/lib/generated-ui-translations";
import { isLocale, translations, type Locale } from "@/lib/i18n";

type AttrName = "placeholder" | "title" | "aria-label";

type AttrEntry = {
  element: HTMLElement;
  attr: AttrName;
  text: string;
};

const ATTRS: AttrName[] = ["placeholder", "title", "aria-label"];
const TRANSLATION_CACHE_VERSION = "v9";

const staticUiTranslations: Record<Exclude<Locale, "fi">, Record<string, string>> = {
  en: {
    "Ilmoituksen tyyppi": "Listing type",
    "Valitse myyntityyppi": "Choose listing type",
    "Ajoneuvon tiedot": "Vehicle details",
    "Täytä ajoneuvon tiedot": "Fill in vehicle details",
    "Kategoria ja hinta": "Category and price",
    "Valitse kategoria ja hinta": "Choose category and price",
    "Kunto & sijainti": "Condition & location",
    "Valitse kunto ja paikka": "Choose condition and location",
    "Kuvat": "Images",
    "Lisää tuotteen kuvat": "Add product images",
    "Otsikko ja kuvaus": "Title and description",
    "Lisää otsikko ja kuvaus": "Add title and description",
    "Julkaise": "Publish",
    "Tarkista ja julkaise": "Review and publish",
    "Luo myynti-ilmoitus": "Create sales listing",
    "Valitse ilmoitustyyppi": "Choose listing type",
    "Valitse, haluatko listata useita osia samasta ajoneuvosta vai yksittäisen osan.": "Choose whether to list several parts from the same vehicle or one individual part.",
    "Useampi osa samasta ajoneuvosta": "Several parts from one vehicle",
    "Yksittäinen ilmoitus": "Single listing",
    "Listaa vain saman ajoneuvon osia samalla kertaa.": "List only parts from the same vehicle at the same time.",
    "Säästä aikaa ja hallitse kaikkia osia yhdessä paikassa.": "Save time and manage all parts in one place.",
    "Myy yksi osa kerrallaan.": "Sell one part at a time.",
    "Sopii yksittäisille osille tai harvinaisille tuotteille.": "Best for individual parts or rare products.",
    "Nollaa": "Reset",
    "Jatka": "Continue",
    "Aktiivista ilmoitusta": "Active listings",
    "Aktiiviset": "Active",
    "Piilotetut": "Hidden",
    "Kaikki": "All",
    "Myynti": "Sales",
    "Katselukerrat": "Views",
    "Viestit": "Messages",
    "uutta": "new",
    "myyntiä": "sales",
    "lukematta": "unread",
    "keskustelua": "conversations",
    "viim. 7 päivää": "last 7 days",
    "viim. 24 h": "last 24 h",
    "viim. 30 päivää": "last 30 days",
    "kaikkina aikoina": "all time",
    "Ajoneuvoa": "Vehicles",
    "ajoneuvoa": "vehicles",
    "Suosikkia": "Favorites",
    "suosikkia": "favorites",
    "Viimeksi päivitetty": "Last updated",
    "Ajoneuvotallisi": "Your garage",
    "Oma Talli": "My Garage",
    "Tallenna ajoneuvosi ja katso niihin sopivat osat yhdellä klikkauksella.": "Save your vehicles and find matching parts with one click.",
    "Valitse ajoneuvo ja näe siihin sopivat ilmoitukset.": "Select a vehicle to see matching listings.",
    "Valitse ajoneuvo ja näe siihen sopivat ilmoitukset.": "Select a vehicle to see matching listings.",
    "Lisää ajoneuvo": "Add vehicle",
    "Näytä sopivat osat": "Show matching parts",
    "Ilmoituksen tiedot": "Listing details",
    "Näytä ilmoitus": "View listing",
    "Avaa ilmoitus": "Open listing",
    "Poista keskustelu": "Delete conversation",
    "Profiili": "Profile",
    "Näytä myyjän profiili": "View seller profile",
    "Myyjä": "Seller",
    "Myyjät": "Sellers",
    "Turvallista kaupankäyntiä": "Safe trading",
    "Älä jaa henkilötietojasi tai tee kauppoja alustan ulkopuolella.": "Do not share personal details or complete deals outside the platform.",
    "Lue lisää turvallisista kaupoista.": "Read more about safe trading.",
    "Tallessa": "Saved",
    "Saved listings": "Saved listings",
    "Kaikki suosikit yhdessä paikassa, valmiina kun palaat vertailemaan.": "All favorites in one place, ready when you come back to compare.",
    "ilmoitusta": "listings",
    "Ei ilmoituksia näytettäväksi": "No listings to show",
    "Paina ilmoituksen sydäntä, niin se näkyy täällä myöhemmin.": "Press the heart on a listing and it will appear here later.",
    "Katso kaikki ›": "View all ›",
    "Search Alerts": "Search Alerts",
    "Hakuvahti": "Search alert",
    "Hakuvahteja": "Search alerts",
    "Ilmoitukset": "Notifications",
    "aktiivista": "active",
    "valmiina": "ready",
    "Päällä": "On",
    "Tallennetut hakuehdot": "Saved search criteria",
    "Kaikki vahdit": "All alerts",
    "Ei hakuvahteja vielä": "No search alerts yet",
    "Luo ensimmäinen hakuvahti, niin ilmoitamme kun sopiva ilmoitus vastaa hakuehtojasi.": "Create your first search alert and we will notify you when a matching listing appears.",
    "Luo ensimmäinen hakuvahti": "Create first search alert",
    "Profiilin tiedot": "Profile details",
    "Julkinen profiili": "Public profile",
    "Osoitetiedot": "Address details",
    "Tilin turvallisuus": "Account security",
    "Poista tili": "Delete account",
    "Yksityiset tiedot": "Private details",
    "Henkilökohtaiset tiedot": "Private details",
    "Nämä käytetään tilin hallintaan.": "These are used for account management.",
    "Etunimi": "First name",
    "Sukunimi": "Last name",
    "Puhelinnumero": "Phone number",
    "Syntymäaika": "Date of birth",
    "Julkinen myyjäprofiili": "Public seller profile",
    "Nimi, ID, tarkka osoite ja esittely näkyvät julkisesti.": "Name, ID, exact address and your intro are shown publicly.",
    "Näyttönimi": "Public name",
    "Tietoa minusta": "About seller",
    "Hallinnoi osoitetietojasi.": "Manage your address details.",
    "Tilin sähköposti": "Account email",
    "Vaihda salasana": "Change password",
    "Yrityksen vahvistus": "Company verification",
    "Vahvista yritys": "Verify company",
    "Vahvistettu yritys": "Verified company",
    "Vahvistettu yritys -merkintä.": "Verified company badge.",
    "Vahvista yritystili": "Verify company account",
    "Lähetä yrityksesi tiedot tarkistettavaksi.": "Send your company details for review.",
    "Käsittelyaika on yleensä 0-2 päivää.": "Processing usually takes 0-2 days.",
    "Kun admin hyväksyy pyynnön, profiilissasi näkyy vihreä Vahvistettu yritys -merkintä.": "When an admin approves the request, your profile will show a green Verified company badge.",
    "Lähetä pyyntö": "Send request",
    "Kirjaudu sisään": "Log in",
    "Rekisteröidy": "Register",
    "Eikö sinulla ole tiliä?": "Don't have an account?",
    "Onko sinulla tili?": "Already have an account?",
    "Tai jatka": "Or continue",
    "Tätä Gmail-tiliä ei ole rekisteröity. Rekisteröidy ensin.": "This Gmail account is not registered. Register first.",
    "Tilin poistaminen": "Delete account",
    "Tämä poistaa tilin pysyvästi. Kysymme vielä viimeisen varmistuksen ennen kuin poisto tehdään.": "This permanently deletes the account. We will ask for one final confirmation before deleting it.",
    "Jatka poistoon": "Continue deletion",
    "Peruuta": "Cancel",
    "Poistetaanko tili pysyvästi?": "Delete account permanently?",
    "Tätä toimintoa ei voi perua. Tilisi, profiilisi ja kirjautumisoikeutesi poistetaan.": "This action cannot be undone. Your account, profile and login access will be deleted.",
    "Puhelinnumero varataan 3 kuukaudeksi.": "Phone number is reserved for 3 months.",
    "Poiston jälkeen tiliä ei voi palauttaa.": "The account cannot be restored after deletion.",
    "Kyllä, poista pysyvästi": "Yes, delete permanently",
    "Takaisin": "Back",
    "Jos tilillä on puhelinnumero, sitä ei voi liittää uuteen tiliin 3 kuukauteen poiston jälkeen.": "If the account has a phone number, it cannot be linked to a new account for 3 months after deletion.",
    "Vaihda puhelinnumero": "Change phone number",
    "Puhelinnumero tallennetaan profiiliisi ilman SMS-vahvistusta.": "The phone number is saved to your profile without SMS verification.",
    "Tallenna": "Save",
    "Ajoneuvotyyppi": "Vehicle type",
    "Tyyppi": "Type",
    "Kaikki tyypit": "All types",
    "Merkki": "Brand",
    "Malli": "Model",
    "Kaikki merkit": "All brands",
    "Valitse ensin merkki": "Select brand first",
    "Vuosimalli": "Model year",
    "Vuosi tai kirjoita itse": "Year or type manually",
    "Moottorin koko (cc)": "Engine size (cc)",
    "Moottori": "Engine",
    "Tyhjennä": "Clear",
    "Jatka osiin": "Continue to parts",
    "Näytä tulokset": "Show results",
    "Ajoneuvo": "Vehicle",
    "Brand and model": "Brand and model",
    "Vuosi": "Year",
    "Kunto": "Condition",
    "Toimitus": "Delivery",
    "Lähetys ja nouto": "Shipping and pickup",
    "Päivitetty": "Updated",
    "Sijainti": "Location",
    "Jäsenenä vuodesta": "Member since",
    "Ei arvioita": "No reviews",
    "arviota": "reviews",
    "Onnistunutta kauppaa": "Successful deals",
    "Lähetä viesti": "Send message",
    "Näytä numero": "Show number",
    "Näytä profiili": "View profile"
  },
  sv: {},
  no: {},
  et: {}
};

staticUiTranslations.sv = {
  "Ilmoituksen tyyppi": "Annonstyp",
  "Valitse myyntityyppi": "Välj försäljningstyp",
  "Ajoneuvon tiedot": "Fordonsuppgifter",
  "Täytä ajoneuvon tiedot": "Fyll i fordonsuppgifter",
  "Kategoria ja hinta": "Kategori och pris",
  "Kunto & sijainti": "Skick & plats",
  "Julkaise": "Publicera",
  "Luo myynti-ilmoitus": "Skapa försäljningsannons",
  "Useampi osa samasta ajoneuvosta": "Flera delar från samma fordon",
  "Useampi ilmoitus": "Flera annonser",
  "Yksittäinen ilmoitus": "Enskild annons",
  "Nollaa": "Återställ",
  "Jatka": "Fortsätt",
  "Aktiiviset": "Aktiva",
  "Piilotetut": "Dolda",
  "Kaikki": "Alla",
  "Viestit": "Meddelanden",
  "Ajoneuvoa": "Fordon",
  "ajoneuvoa": "fordon",
  "Suosikkia": "Favoriter",
  "suosikkia": "favoriter",
  "Viimeksi päivitetty": "Senast uppdaterad",
  "Oma Talli": "Mitt garage",
  "Lisää ajoneuvo": "Lägg till fordon",
  "Näytä sopivat osat": "Visa matchande delar",
  "Ilmoituksen tiedot": "Annonsuppgifter",
  "Avaa ilmoitus": "Öppna annons",
  "Poista keskustelu": "Ta bort konversation",
  "Profiili": "Profil",
  "Myyjä": "Säljare",
  "Myyjät": "Säljare",
  "Tallessa": "Sparat",
  "Ei ilmoituksia näytettäväksi": "Inga annonser att visa",
  "Tallennetut hakuehdot": "Sparade sökvillkor",
  "Ei hakuvahteja vielä": "Inga sökbevakningar ännu",
  "Profiilin tiedot": "Profiluppgifter",
  "Julkinen profiili": "Offentlig profil",
  "Osoitetiedot": "Adressuppgifter",
  "Tilin turvallisuus": "Kontosäkerhet",
  "Poista tili": "Ta bort konto",
  "Etunimi": "Förnamn",
  "Sukunimi": "Efternamn",
  "Puhelinnumero": "Telefonnummer",
  "Syntymäaika": "Födelsedatum",
  "Vaihda salasana": "Byt lösenord",
  "Yrityksen vahvistus": "Företagsverifiering",
  "Vahvista yritys": "Verifiera företag",
  "Vahvistettu yritys": "Verifierat företag",
  "Vahvista yritystili": "Verifiera företagskonto",
  "Lähetä pyyntö": "Skicka begäran",
  "Kirjaudu sisään": "Logga in",
  "Rekisteröidy": "Registrera",
  "Eikö sinulla ole tiliä?": "Har du inget konto?",
  "Onko sinulla tili?": "Har du redan ett konto?",
  "Tai jatka": "Eller fortsätt",
  "Tilin poistaminen": "Ta bort konto",
  "Jatka poistoon": "Fortsätt radera",
  "Peruuta": "Avbryt",
  "Poistetaanko tili pysyvästi?": "Ta bort kontot permanent?",
  "Kyllä, poista pysyvästi": "Ja, ta bort permanent",
  "Takaisin": "Tillbaka",
  "Vaihda puhelinnumero": "Byt telefonnummer",
  "Tallenna": "Spara",
  "Ajoneuvotyyppi": "Fordonstyp",
  "Tyyppi": "Typ",
  "Kaikki tyypit": "Alla typer",
  "Merkki": "Märke",
  "Malli": "Modell",
  "Vuosimalli": "Årsmodell",
  "Moottorin koko (cc)": "Motorstorlek (cc)",
  "Moottori": "Motor",
  "Tyhjennä": "Rensa",
  "Jatka osiin": "Fortsätt till delar",
  "Näytä tulokset": "Visa resultat",
  "Ajoneuvo": "Fordon",
  "Vuosi": "År",
  "Kunto": "Skick",
  "Toimitus": "Leverans",
  "Lähetys ja nouto": "Frakt och upphämtning",
  "Päivitetty": "Uppdaterad",
  "Sijainti": "Plats",
  "Jäsenenä vuodesta": "Medlem sedan",
  "Ei arvioita": "Inga recensioner",
  "Lähetä viesti": "Skicka meddelande",
  "Näytä numero": "Visa nummer"
};

staticUiTranslations.no = {
  "Ilmoituksen tyyppi": "Annonsetype",
  "Valitse myyntityyppi": "Velg salgstype",
  "Ajoneuvon tiedot": "Kjøretøydetaljer",
  "Täytä ajoneuvon tiedot": "Fyll inn kjøretøydetaljer",
  "Kategoria ja hinta": "Kategori og pris",
  "Kunto & sijainti": "Tilstand og sted",
  "Julkaise": "Publiser",
  "Luo myynti-ilmoitus": "Opprett salgsannonse",
  "Useampi osa samasta ajoneuvosta": "Flere deler fra samme kjøretøy",
  "Useampi ilmoitus": "Flere annonser",
  "Yksittäinen ilmoitus": "Én annonse",
  "Nollaa": "Nullstill",
  "Jatka": "Fortsett",
  "Aktiiviset": "Aktive",
  "Piilotetut": "Skjulte",
  "Kaikki": "Alle",
  "Viestit": "Meldinger",
  "Ajoneuvoa": "Kjøretøy",
  "ajoneuvoa": "kjøretøy",
  "Suosikkia": "Favoritter",
  "suosikkia": "favoritter",
  "Viimeksi päivitetty": "Sist oppdatert",
  "Oma Talli": "Min garasje",
  "Lisää ajoneuvo": "Legg til kjøretøy",
  "Näytä sopivat osat": "Vis matchende deler",
  "Ilmoituksen tiedot": "Annonsedetaljer",
  "Avaa ilmoitus": "Åpne annonse",
  "Poista keskustelu": "Slett samtale",
  "Profiili": "Profil",
  "Myyjä": "Selger",
  "Myyjät": "Selgere",
  "Tallessa": "Lagret",
  "Ei ilmoituksia näytettäväksi": "Ingen annonser å vise",
  "Tallennetut hakuehdot": "Lagrede søkekriterier",
  "Ei hakuvahteja vielä": "Ingen søkevarsler ennå",
  "Profiilin tiedot": "Profildetaljer",
  "Julkinen profiili": "Offentlig profil",
  "Osoitetiedot": "Adresseopplysninger",
  "Tilin turvallisuus": "Kontosikkerhet",
  "Poista tili": "Slett konto",
  "Etunimi": "Fornavn",
  "Sukunimi": "Etternavn",
  "Puhelinnumero": "Telefonnummer",
  "Syntymäaika": "Fødselsdato",
  "Vaihda salasana": "Bytt passord",
  "Yrityksen vahvistus": "Bedriftsverifisering",
  "Vahvista yritys": "Verifiser bedrift",
  "Vahvistettu yritys": "Verifisert bedrift",
  "Vahvista yritystili": "Verifiser bedriftskonto",
  "Lähetä pyyntö": "Send forespørsel",
  "Kirjaudu sisään": "Logg inn",
  "Rekisteröidy": "Registrer deg",
  "Eikö sinulla ole tiliä?": "Har du ikke konto?",
  "Onko sinulla tili?": "Har du allerede konto?",
  "Tai jatka": "Eller fortsett",
  "Tilin poistaminen": "Slett konto",
  "Jatka poistoon": "Fortsett sletting",
  "Peruuta": "Avbryt",
  "Poistetaanko tili pysyvästi?": "Slette kontoen permanent?",
  "Kyllä, poista pysyvästi": "Ja, slett permanent",
  "Takaisin": "Tilbake",
  "Vaihda puhelinnumero": "Endre telefonnummer",
  "Tallenna": "Lagre",
  "Ajoneuvotyyppi": "Kjøretøytype",
  "Tyyppi": "Type",
  "Kaikki tyypit": "Alle typer",
  "Merkki": "Merke",
  "Malli": "Modell",
  "Vuosimalli": "Årsmodell",
  "Moottorin koko (cc)": "Motorstørrelse (cc)",
  "Moottori": "Motor",
  "Tyhjennä": "Tøm",
  "Jatka osiin": "Fortsett til deler",
  "Näytä tulokset": "Vis resultater",
  "Ajoneuvo": "Kjøretøy",
  "Vuosi": "År",
  "Kunto": "Tilstand",
  "Toimitus": "Levering",
  "Lähetys ja nouto": "Frakt og henting",
  "Päivitetty": "Oppdatert",
  "Sijainti": "Sted",
  "Jäsenenä vuodesta": "Medlem siden",
  "Ei arvioita": "Ingen anmeldelser",
  "Lähetä viesti": "Send melding",
  "Näytä numero": "Vis nummer"
};

staticUiTranslations.et = {
  "Ilmoituksen tyyppi": "Kuulutuse tüüp",
  "Valitse myyntityyppi": "Vali müügitüüp",
  "Ajoneuvon tiedot": "Sõiduki andmed",
  "Täytä ajoneuvon tiedot": "Täida sõiduki andmed",
  "Kategoria ja hinta": "Kategooria ja hind",
  "Kunto & sijainti": "Seisukord ja asukoht",
  "Julkaise": "Avalda",
  "Luo myynti-ilmoitus": "Loo müügikuulutus",
  "Useampi osa samasta ajoneuvosta": "Mitu osa samast sõidukist",
  "Useampi ilmoitus": "Mitu kuulutust",
  "Yksittäinen ilmoitus": "Üks kuulutus",
  "Nollaa": "Lähtesta",
  "Jatka": "Jätka",
  "Aktiiviset": "Aktiivsed",
  "Piilotetut": "Peidetud",
  "Kaikki": "Kõik",
  "Viestit": "Sõnumid",
  "Ajoneuvoa": "Sõidukit",
  "ajoneuvoa": "sõidukit",
  "Suosikkia": "Lemmikut",
  "suosikkia": "lemmikut",
  "Viimeksi päivitetty": "Viimati uuendatud",
  "Oma Talli": "Minu garaaž",
  "Lisää ajoneuvo": "Lisa sõiduk",
  "Näytä sopivat osat": "Näita sobivaid osi",
  "Ilmoituksen tiedot": "Kuulutuse andmed",
  "Avaa ilmoitus": "Ava kuulutus",
  "Poista keskustelu": "Kustuta vestlus",
  "Profiili": "Profiil",
  "Myyjä": "Müüja",
  "Myyjät": "Müüjad",
  "Tallessa": "Salvestatud",
  "Ei ilmoituksia näytettäväksi": "Kuulutusi pole kuvada",
  "Tallennetut hakuehdot": "Salvestatud otsingutingimused",
  "Ei hakuvahteja vielä": "Otsinguvalvureid pole veel",
  "Profiilin tiedot": "Profiili andmed",
  "Julkinen profiili": "Avalik profiil",
  "Osoitetiedot": "Aadressiandmed",
  "Tilin turvallisuus": "Konto turvalisus",
  "Poista tili": "Kustuta konto",
  "Etunimi": "Eesnimi",
  "Sukunimi": "Perekonnanimi",
  "Puhelinnumero": "Telefoninumber",
  "Syntymäaika": "Sünniaeg",
  "Vaihda salasana": "Muuda parooli",
  "Yrityksen vahvistus": "Ettevõtte kinnitamine",
  "Vahvista yritys": "Kinnita ettevõte",
  "Vahvistettu yritys": "Kinnitatud ettevõte",
  "Vahvista yritystili": "Kinnita ettevõtte konto",
  "Lähetä pyyntö": "Saada taotlus",
  "Kirjaudu sisään": "Logi sisse",
  "Rekisteröidy": "Registreeru",
  "Eikö sinulla ole tiliä?": "Sul pole kontot?",
  "Onko sinulla tili?": "Kas sul on konto?",
  "Tai jatka": "Või jätka",
  "Tilin poistaminen": "Konto kustutamine",
  "Jatka poistoon": "Jätka kustutamist",
  "Peruuta": "Tühista",
  "Poistetaanko tili pysyvästi?": "Kustutada konto jäädavalt?",
  "Kyllä, poista pysyvästi": "Jah, kustuta jäädavalt",
  "Takaisin": "Tagasi",
  "Vaihda puhelinnumero": "Muuda telefoninumbrit",
  "Tallenna": "Salvesta",
  "Ajoneuvotyyppi": "Sõiduki tüüp",
  "Tyyppi": "Tüüp",
  "Kaikki tyypit": "Kõik tüübid",
  "Merkki": "Mark",
  "Malli": "Mudel",
  "Vuosimalli": "Aasta",
  "Moottorin koko (cc)": "Mootori suurus (cc)",
  "Moottori": "Mootor",
  "Tyhjennä": "Tühjenda",
  "Jatka osiin": "Jätka osadeni",
  "Näytä tulokset": "Näita tulemusi",
  "Ajoneuvo": "Sõiduk",
  "Vuosi": "Aasta",
  "Kunto": "Seisukord",
  "Toimitus": "Tarne",
  "Lähetys ja nouto": "Saatmine ja järeletulemine",
  "Päivitetty": "Uuendatud",
  "Sijainti": "Asukoht",
  "Jäsenenä vuodesta": "Liige alates",
  "Ei arvioita": "Arvustusi pole",
  "Lähetä viesti": "Saada sõnum",
  "Näytä numero": "Näita numbrit"
};
Object.assign(staticUiTranslations.en, {
  "AJONEUVOA": "VEHICLES",
  "SUOSIKKIA": "FAVORITES",
  "VIIMEKSI PÄIVITETTY": "LAST UPDATED",
  "VIIMEKSI PÃ„IVITETTY": "LAST UPDATED",
  "Kaikki keskustelut": "All conversations",
  "Ostajat": "Buyers",
  "Hae viesteistä tai käyttäjistä...": "Search messages or users...",
  "Hae viesteistÃ¤ tai kÃ¤yttÃ¤jistÃ¤...": "Search messages or users...",
  "Eilen": "Yesterday",
  "Paikalla eilen klo 23.06": "Online yesterday at 23:06",
  "Kirjoita viesti...": "Write a message...",
  "Valitsematta": "Not selected",
  "Ei lisatty": "Not added",
  "Ei lisätty": "Not added",
  "Kuvausta ei ole viela lisatty.": "No description added yet.",
  "Kuvausta ei ole vielä lisätty.": "No description added yet."
});

Object.assign(staticUiTranslations.sv, {
  "AJONEUVOA": "FORDON",
  "SUOSIKKIA": "FAVORITER",
  "VIIMEKSI PÄIVITETTY": "SENAST UPPDATERAD",
  "VIIMEKSI PÃ„IVITETTY": "SENAST UPPDATERAD",
  "Kaikki keskustelut": "Alla konversationer",
  "Ostajat": "Köpare",
  "Hae viesteistä tai käyttäjistä...": "Sök i meddelanden eller användare...",
  "Hae viesteistÃ¤ tai kÃ¤yttÃ¤jistÃ¤...": "Sök i meddelanden eller användare...",
  "Eilen": "Igår",
  "Paikalla eilen klo 23.06": "Online igår kl. 23.06",
  "Kirjoita viesti...": "Skriv ett meddelande...",
  "Valitsematta": "Inte valt",
  "Ei lisatty": "Inte tillagt",
  "Ei lisätty": "Inte tillagt",
  "Kuvausta ei ole viela lisatty.": "Ingen beskrivning har lagts till ännu.",
  "Kuvausta ei ole vielä lisätty.": "Ingen beskrivning har lagts till ännu."
});

Object.assign(staticUiTranslations.no, {
  "AJONEUVOA": "KJØRETØY",
  "SUOSIKKIA": "FAVORITTER",
  "VIIMEKSI PÄIVITETTY": "SIST OPPDATERT",
  "VIIMEKSI PÃ„IVITETTY": "SIST OPPDATERT",
  "Kaikki keskustelut": "Alle samtaler",
  "Ostajat": "Kjøpere",
  "Hae viesteistä tai käyttäjistä...": "Søk i meldinger eller brukere...",
  "Hae viesteistÃ¤ tai kÃ¤yttÃ¤jistÃ¤...": "Søk i meldinger eller brukere...",
  "Eilen": "I går",
  "Paikalla eilen klo 23.06": "Online i går kl. 23.06",
  "Kirjoita viesti...": "Skriv en melding...",
  "Valitsematta": "Ikke valgt",
  "Ei lisatty": "Ikke lagt til",
  "Ei lisätty": "Ikke lagt til",
  "Kuvausta ei ole viela lisatty.": "Ingen beskrivelse lagt til ennå.",
  "Kuvausta ei ole vielä lisätty.": "Ingen beskrivelse lagt til ennå."
});

Object.assign(staticUiTranslations.et, {
  "AJONEUVOA": "SÕIDUKIT",
  "SUOSIKKIA": "LEMMIKUT",
  "VIIMEKSI PÄIVITETTY": "VIIMATI UUENDATUD",
  "VIIMEKSI PÃ„IVITETTY": "VIIMATI UUENDATUD",
  "Kaikki keskustelut": "Kõik vestlused",
  "Ostajat": "Ostjad",
  "Hae viesteistä tai käyttäjistä...": "Otsi sõnumitest või kasutajatest...",
  "Hae viesteistÃ¤ tai kÃ¤yttÃ¤jistÃ¤...": "Otsi sõnumitest või kasutajatest...",
  "Eilen": "Eile",
  "Paikalla eilen klo 23.06": "Võrgus eile kl 23.06",
  "Kirjoita viesti...": "Kirjuta sõnum...",
  "Valitsematta": "Valimata",
  "Ei lisatty": "Lisamata",
  "Ei lisätty": "Lisamata",
  "Kuvausta ei ole viela lisatty.": "Kirjeldust pole veel lisatud.",
  "Kuvausta ei ole vielä lisätty.": "Kirjeldust pole veel lisatud."
});

const translatedLocales: Array<Exclude<Locale, "fi">> = ["en", "sv", "no", "et"];

for (const locale of translatedLocales) {
  const sharedDictionary = Object.fromEntries(
    (Object.keys(translations.fi) as Array<keyof typeof translations.fi>).map((key) => [
      translations.fi[key],
      translations[locale][key]
    ])
  );

  staticUiTranslations[locale] = {
    ...generatedUiTranslations[locale],
    ...sharedDictionary,
    ...staticUiTranslations[locale]
  };
}

Object.assign(staticUiTranslations.en, {
  Maskines: "Maskines",
  maskines: "maskines",
  "Maskines.": "Maskines.",
  "© 2026 Maskines. Kaikki oikeudet pidätetään.": "© 2026 Maskines. All rights reserved.",
  Paanavigaatio: "Main navigation",
  "Ota yhteytta": "Contact us",
  "Select your region & language": "Select your region & language",
  Hae: "Search",
  Maa: "Country",
  "Haku:": "Search:",
  Missiomme: "Our mission",
  "Moottoritilavuus (cm³)": "Engine displacement (cm³)",
  "Kaikki moottorit": "All engines",
  "Pohjoismainen markkinapaikka pienkoneiden varaosille.\nOsta ja myy varaosia moottorikelkkoihin, mönkijöihin, motocross-pyöriin ja mopoihin helposti yhdessä paikassa.": "A Nordic marketplace for small-vehicle spare parts.\nBuy and sell parts for snowmobiles, ATVs, motocross bikes and mopeds easily in one place."
});
Object.assign(staticUiTranslations.sv, {
  Maskines: "Maskines",
  maskines: "maskines",
  "Maskines.": "Maskines.",
  "© 2026 Maskines. Kaikki oikeudet pidätetään.": "© 2026 Maskines. Alla rättigheter förbehållna.",
  Paanavigaatio: "Huvudnavigation",
  "Ota yhteytta": "Kontakta oss",
  "Select your region & language": "Välj region och språk",
  Hae: "Sök",
  Maa: "Land",
  "Haku:": "Sökning:",
  Missiomme: "Vårt uppdrag",
  "Moottoritilavuus (cm³)": "Motorvolym (cm³)",
  "Kaikki moottorit": "Alla motorer",
  "Pohjoismainen markkinapaikka pienkoneiden varaosille.\nOsta ja myy varaosia moottorikelkkoihin, mönkijöihin, motocross-pyöriin ja mopoihin helposti yhdessä paikassa.": "En nordisk marknadsplats för reservdelar till småfordon.\nKöp och sälj reservdelar till snöskotrar, fyrhjulingar, motocrosscyklar och mopeder enkelt på ett och samma ställe."
});
Object.assign(staticUiTranslations.no, {
  Maskines: "Maskines",
  maskines: "maskines",
  "Maskines.": "Maskines.",
  "© 2026 Maskines. Kaikki oikeudet pidätetään.": "© 2026 Maskines. Alle rettigheter forbeholdt.",
  Paanavigaatio: "Hovednavigasjon",
  "Ota yhteytta": "Kontakt oss",
  "Select your region & language": "Velg region og språk",
  Hae: "Søk",
  Maa: "Land",
  "Haku:": "Søk:",
  Missiomme: "Vårt oppdrag",
  "Moottoritilavuus (cm³)": "Motorvolum (cm³)",
  "Kaikki moottorit": "Alle motorer",
  "Pohjoismainen markkinapaikka pienkoneiden varaosille.\nOsta ja myy varaosia moottorikelkkoihin, mönkijöihin, motocross-pyöriin ja mopoihin helposti yhdessä paikassa.": "En nordisk markedsplass for reservedeler til småkjøretøy.\nKjøp og selg reservedeler til snøscootere, ATV-er, motocrossykler og mopeder enkelt på ett sted."
});
Object.assign(staticUiTranslations.et, {
  Maskines: "Maskines",
  maskines: "maskines",
  "Maskines.": "Maskines.",
  "© 2026 Maskines. Kaikki oikeudet pidätetään.": "© 2026 Maskines. Kõik õigused kaitstud.",
  Paanavigaatio: "Põhinavigeerimine",
  "Ota yhteytta": "Võta ühendust",
  "Ota yhteyttä Maskinesiin": "Võtke Maskinesiga ühendust",
  "Select your region & language": "Valige piirkond ja keel",
  Hae: "Otsi",
  Maa: "Riik",
  "Haku:": "Otsing:",
  Missiomme: "Meie missioon",
  Profiili: "Profiil",
  "Oma talli": "Minu garaaž",
  "Moottoritilavuus (cm³)": "Mootori töömaht (cm³)",
  "Kaikki moottorit": "Kõik mootorid",
  "Pohjoismainen markkinapaikka pienkoneiden varaosille.\nOsta ja myy varaosia moottorikelkkoihin, mönkijöihin, motocross-pyöriin ja mopoihin helposti yhdessä paikassa.": "Põhjamaine väikeste sõidukite varuosade turg.\nOsta ja müü mootorsaanide, ATV-de, motokrossirataste ja mopeedide varuosi mugavalt ühest kohast."
});

const SKIP_SELECTOR = [
  "script",
  "style",
  "noscript",
  "code",
  "pre",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[data-no-auto-translate]",
  "[data-global-language-menu]"
].join(",");

function shouldTranslateText(text: string) {
  const trimmed = text.trim();

  if (trimmed.length < 2 || trimmed.length > 500) return false;
  if (!/[A-Za-zÀ-ž]/.test(trimmed)) return false;
  if (/^[\d\s.,:;!?€$%+\-/–—()|]+$/.test(trimmed)) return false;
  if (/^(https?:\/\/|www\.|\S+@\S+\.\S+)/i.test(trimmed)) return false;

  return true;
}

function getStaticTranslation(locale: Locale, text: string) {
  if (locale === "fi") return null;

  const trimmed = text.trim();
  const direct = staticUiTranslations[locale][trimmed];
  if (direct) return direct;

  let replaced = trimmed;
  let changed = false;
  const entries = Object.entries(staticUiTranslations[locale])
    .filter(([source]) => source.trim().length >= 4)
    .sort(([a], [b]) => b.length - a.length);

  for (const [source, translated] of entries) {
    let cursor = 0;
    let nextValue = "";
    let sourceChanged = false;

    while (cursor < replaced.length) {
      const index = replaced.indexOf(source, cursor);
      if (index < 0) break;

      const previous = index > 0 ? replaced[index - 1] : "";
      const next = replaced[index + source.length] ?? "";
      const sourceStartsWithWord = /[\p{L}\p{N}]/u.test(source[0] ?? "");
      const sourceEndsWithWord = /[\p{L}\p{N}]/u.test(source[source.length - 1] ?? "");
      const hasWordBefore = previous ? /[\p{L}\p{N}]/u.test(previous) : false;
      const hasWordAfter = next ? /[\p{L}\p{N}]/u.test(next) : false;

      if ((sourceStartsWithWord && hasWordBefore) || (sourceEndsWithWord && hasWordAfter)) {
        nextValue += replaced.slice(cursor, index + source.length);
      } else {
        nextValue += replaced.slice(cursor, index) + translated;
        sourceChanged = true;
      }
      cursor = index + source.length;
    }

    if (sourceChanged) {
      replaced = nextValue + replaced.slice(cursor);
      changed = true;
    }
  }

  return changed ? replaced : null;
}

export default function AutoTranslate() {
  const [locale, setLocale] = useState<Locale>("fi");
  const translationCache = useRef<Map<string, string>>(new Map());
  const originalTextNodes = useRef<WeakMap<Text, string>>(new WeakMap());
  const originalAttributes = useRef<WeakMap<HTMLElement, Partial<Record<AttrName, string>>>>(
    new WeakMap()
  );
  const loadedCacheLocale = useRef<Locale | null>(null);
  const appliedLocale = useRef<Locale>("fi");
  const translationActivated = useRef(false);
  const pendingRequest = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);
  const translating = useRef(false);

  useEffect(() => {
    const urlLocale = new URLSearchParams(window.location.search).get("lang");
    const storedLocale = localStorage.getItem("locale");
    const initialLocale = isLocale(urlLocale) ? urlLocale : isLocale(storedLocale) ? storedLocale : "fi";

    setLocale(initialLocale);

    function handleLocaleChange(event: Event) {
      const nextLocale = (event as CustomEvent<Locale>).detail;
      if (isLocale(nextLocale)) {
        setLocale(nextLocale);
      }
    }

    window.addEventListener("localechange", handleLocaleChange);
    return () => window.removeEventListener("localechange", handleLocaleChange);
  }, []);

  const storageKey = `auto-ui-translations:${TRANSLATION_CACHE_VERSION}:${locale}`;

  const collect = useCallback(() => {
    const textNodes: Text[] = [];
    const attrs: AttrEntry[] = [];
    const texts = new Set<string>();

    const getOriginalText = (node: Text) => {
      const current = node.textContent ?? "";
      const stored = originalTextNodes.current.get(node);

      if (stored === undefined) {
        originalTextNodes.current.set(node, current);
        return current;
      }

      if (appliedLocale.current === locale) {
        const translated = locale === "fi" ? null : translationCache.current.get(stored.trim());
        const expected = translated
          ? `${stored.match(/^\s*/)?.[0] ?? ""}${translated}${stored.match(/\s*$/)?.[0] ?? ""}`
          : stored;

        if (current !== stored && current !== expected) {
          originalTextNodes.current.set(node, current);
          return current;
        }
      }

      return stored;
    };

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;

        const original = getOriginalText(node as Text);
        return shouldTranslateText(original) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const parent = node.parentElement;
      if (!parent) continue;

      const original = getOriginalText(node);
      if (!shouldTranslateText(original)) continue;

      textNodes.push(node);
      texts.add(original.trim());
    }

    for (const element of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (element.closest(SKIP_SELECTOR)) continue;

      for (const attr of ATTRS) {
        const current = element.getAttribute(attr);
        if (!current || !shouldTranslateText(current)) continue;

        const stored = originalAttributes.current.get(element) ?? {};
        let original = stored[attr];

        if (original === undefined) {
          original = current;
          originalAttributes.current.set(element, stored);
        } else if (appliedLocale.current === locale) {
          const expected = locale === "fi"
            ? original
            : translationCache.current.get(original.trim()) ?? original;

          if (current !== original && current !== expected) {
            original = current;
          }
        }

        stored[attr] = original;
        originalAttributes.current.set(element, stored);

        attrs.push({ element, attr, text: original });
        texts.add(original.trim());
      }
    }

    return { textNodes, attrs, texts: Array.from(texts) };
  }, [locale]);

  const saveCache = useCallback(() => {
    if (locale === "fi") return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(translationCache.current)));
    } catch {
      // localStorage can be full or unavailable. Translation still works for this session.
    }
  }, [locale, storageKey]);

  const applyTranslations = useCallback(
    (textNodes: Text[], attrs: AttrEntry[]) => {
      if (locale === "fi") {
        for (const node of textNodes) {
          const original = originalTextNodes.current.get(node);
          if (original && node.textContent !== original) node.textContent = original;
        }

        for (const { element, attr } of attrs) {
          const original = originalAttributes.current.get(element)?.[attr];
          if (original && element.getAttribute(attr) !== original) element.setAttribute(attr, original);
        }

        return;
      }

      for (const node of textNodes) {
        const originalText = originalTextNodes.current.get(node) ?? node.textContent ?? "";
        const original = originalText.trim();
        const translated = translationCache.current.get(original);
        if (translated) {
          const leadingWhitespace = originalText.match(/^\s*/)?.[0] ?? "";
          const trailingWhitespace = originalText.match(/\s*$/)?.[0] ?? "";
          const nextText = `${leadingWhitespace}${translated}${trailingWhitespace}`;
          if (node.textContent !== nextText) node.textContent = nextText;
        }
      }

      for (const { element, attr, text } of attrs) {
        const translated = translationCache.current.get(text.trim());
        if (translated && element.getAttribute(attr) !== translated) element.setAttribute(attr, translated);
      }
    },
    [locale]
  );

  const translatePage = useCallback(async () => {
    if (translating.current) return;
    translating.current = true;

    try {
      if (loadedCacheLocale.current !== locale) {
        translationCache.current.clear();
        loadedCacheLocale.current = locale;

        if (locale !== "fi") {
          try {
            const saved = localStorage.getItem(storageKey);
            const parsed = saved ? JSON.parse(saved) as Record<string, string> : {};
            for (const [key, value] of Object.entries(parsed)) {
              if (typeof value === "string") translationCache.current.set(key, value);
            }
          } catch {
            translationCache.current.clear();
          }
        }
      }

      const { textNodes, attrs, texts } = collect();

      for (const text of texts) {
        if (translationCache.current.has(text)) continue;

        const staticTranslation = getStaticTranslation(locale, text);
        if (staticTranslation) {
          translationCache.current.set(text, staticTranslation);
        }
      }

      const missingTexts = locale === "fi"
        ? []
        : texts.filter((text) => !translationCache.current.has(text));

      for (let offset = 0; offset < missingTexts.length; offset += 80) {
        const batch = missingTexts.slice(offset, offset + 80);

        try {
          const response = await fetch("/api/translate-ui", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ targetLocale: locale, texts: batch })
          });

          if (!response.ok) continue;
          const payload = await response.json() as { translations?: Record<string, unknown> };

          for (const source of batch) {
            const translated = payload.translations?.[source];
            if (typeof translated === "string" && translated.trim()) {
              translationCache.current.set(source, translated.trim());
            }
          }
        } catch {
          // Keep the original visible if the translation service is temporarily unavailable.
        }
      }

      applyTranslations(textNodes, attrs);
      appliedLocale.current = locale;
      saveCache();

    } finally {
      translating.current = false;
      document.documentElement.setAttribute("data-i18n-ready", locale);
      if (
        document.documentElement.hasAttribute("data-visitor-language-ready") &&
        document.documentElement.lang === locale
      ) {
        if (revealTimer.current) window.clearTimeout(revealTimer.current);
        revealTimer.current = window.setTimeout(() => {
          if (document.documentElement.lang === locale) {
            document.documentElement.removeAttribute("data-i18n-pending");
          }
        }, 120);
      }
    }
  }, [applyTranslations, collect, locale, saveCache, storageKey]);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    let startTimer: number | null = null;

    function scheduleTranslate() {
      if (pendingRequest.current) {
        window.clearTimeout(pendingRequest.current);
      }
      pendingRequest.current = window.setTimeout(() => {
        void translatePage();
      }, 50);
    }

    function startTranslation() {
      translationActivated.current = true;
      void translatePage();
      observer = new MutationObserver(() => {
        if (revealTimer.current) window.clearTimeout(revealTimer.current);
        if (!translating.current) scheduleTranslate();
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ATTRS
      });
    }

    function queueStart() {
      // AutoTranslate edits React-owned text nodes directly. Give the App
      // Router time to hydrate the complete page before touching the DOM;
      // otherwise a remembered non-Finnish locale can translate server HTML
      // while React is still comparing it, causing a hydration failure.
      startTimer = window.setTimeout(startTranslation, 750);
    }

    function handleVisitorLanguageReady() {
      if (translationActivated.current) void translatePage();
    }

    window.addEventListener("visitorlanguageready", handleVisitorLanguageReady);

    if (document.readyState === "complete") {
      queueStart();
    } else {
      window.addEventListener("load", queueStart, { once: true });
    }

    return () => {
      window.removeEventListener("load", queueStart);
      window.removeEventListener("visitorlanguageready", handleVisitorLanguageReady);
      observer?.disconnect();
      if (startTimer) window.clearTimeout(startTimer);
      if (pendingRequest.current) {
        window.clearTimeout(pendingRequest.current);
      }
      if (revealTimer.current) window.clearTimeout(revealTimer.current);
    };
  }, [locale, translatePage]);

  return null;
}
