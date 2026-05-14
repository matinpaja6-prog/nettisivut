"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  ArrowLeft,
  ChevronRight,
  Mail,
  MapPin,
  ShieldCheck,
  Phone,
  Heart,
  LockKeyhole,
  Share2,
  UserRound
} from "lucide-react";

import {
  fallbackListings,
  formatPrice,
  getListingPartNumber,
  type Listing
} from "@/lib/listings";
import { getLocalizedListingText } from "@/lib/listing-translations";
import { useLanguage, translateCategory, type Locale } from "@/lib/i18n";

import { trackListingView, setRecoUserId } from "@/lib/recommendations";

import {
  getSavedListingIds,
  getListingById,
  incrementListingView,
  saveListing,
  supabase,
  trackUserActivity,
  unsaveListing
} from "@/lib/supabase";

const listingUiText = {
  fi: {
    loading: "Ladataan...",
    notFound: "Ei löytynyt",
    linkCopied: "Linkki kopioitu!",
    back: "Takaisin",
    forSale: "Myynnissä",
    part: "Varaosa",
    updated: "Päivitetty",
    imageSingular: "kuva",
    imagePlural: "kuvaa",
    share: "Jaa",
    saved: "Tallennettu",
    save: "Tallenna",
    description: "Kuvaus",
    noDescription: "Ei kuvausta.",
    vehicle: "Ajoneuvo",
    partNumber: "Varaosanumero",
    brand: "Merkki",
    model: "Malli",
    year: "Vuosimalli",
    condition: "Kunto",
    location: "Sijainti",
    notSpecified: "Ei ilmoitettu",
    seller: "Myyjä",
    fallbackSeller: "Myyjä",
    verified: "Tunnistettu",
    sellers: "Myyjät",
    openSellerProfile: (name: string) => `Avaa myyjän ${name} julkinen profiili`,
    viewProfile: "Katso profiili",
    contactHeading: "Kysyttävää kohteesta?",
    sendMessage: "Lähetä viesti",
    fetchingPhone: "Haetaan numeroa...",
    showPhone: "Näytä numero",
    missingPhone: "Numero puuttuu",
    loginContact: "Kirjaudu nähdäksesi yhteystiedot"
  },
  en: {
    loading: "Loading...",
    notFound: "Not found",
    linkCopied: "Link copied!",
    back: "Back",
    forSale: "For sale",
    part: "Part",
    updated: "Updated",
    imageSingular: "image",
    imagePlural: "images",
    share: "Share",
    saved: "Saved",
    save: "Save",
    description: "Description",
    noDescription: "No description.",
    vehicle: "Vehicle",
    partNumber: "Part number",
    brand: "Brand",
    model: "Model",
    year: "Year",
    condition: "Condition",
    location: "Location",
    notSpecified: "Not specified",
    seller: "Seller",
    fallbackSeller: "Seller",
    verified: "Verified",
    sellers: "Sellers",
    openSellerProfile: (name: string) => `Open ${name}'s public seller profile`,
    viewProfile: "View profile",
    contactHeading: "Questions about this listing?",
    sendMessage: "Send message",
    fetchingPhone: "Fetching number...",
    showPhone: "Show number",
    missingPhone: "Number missing",
    loginContact: "Log in to see contact details"
  },
  sv: {
    loading: "Laddar...",
    notFound: "Hittades inte",
    linkCopied: "Länken kopierad!",
    back: "Tillbaka",
    forSale: "Till salu",
    part: "Reservdel",
    updated: "Uppdaterad",
    imageSingular: "bild",
    imagePlural: "bilder",
    share: "Dela",
    saved: "Sparad",
    save: "Spara",
    description: "Beskrivning",
    noDescription: "Ingen beskrivning.",
    vehicle: "Fordon",
    partNumber: "Artikelnummer",
    brand: "Märke",
    model: "Modell",
    year: "Årsmodell",
    condition: "Skick",
    location: "Plats",
    notSpecified: "Ej angivet",
    seller: "Säljare",
    fallbackSeller: "Säljare",
    verified: "Verifierad",
    sellers: "Säljare",
    openSellerProfile: (name: string) => `Öppna ${name}s offentliga säljarprofil`,
    viewProfile: "Visa profil",
    contactHeading: "Frågor om annonsen?",
    sendMessage: "Skicka meddelande",
    fetchingPhone: "Hämtar nummer...",
    showPhone: "Visa nummer",
    missingPhone: "Nummer saknas",
    loginContact: "Logga in för att se kontaktuppgifter"
  },
  no: {
    loading: "Laster...",
    notFound: "Ikke funnet",
    linkCopied: "Lenken er kopiert!",
    back: "Tilbake",
    forSale: "Til salgs",
    part: "Del",
    updated: "Oppdatert",
    imageSingular: "bilde",
    imagePlural: "bilder",
    share: "Del",
    saved: "Lagret",
    save: "Lagre",
    description: "Beskrivelse",
    noDescription: "Ingen beskrivelse.",
    vehicle: "Kjøretøy",
    partNumber: "Delenummer",
    brand: "Merke",
    model: "Modell",
    year: "Årsmodell",
    condition: "Tilstand",
    location: "Sted",
    notSpecified: "Ikke oppgitt",
    seller: "Selger",
    fallbackSeller: "Selger",
    verified: "Verifisert",
    sellers: "Selgere",
    openSellerProfile: (name: string) => `Åpne den offentlige selgerprofilen til ${name}`,
    viewProfile: "Vis profil",
    contactHeading: "Spørsmål om annonsen?",
    sendMessage: "Send melding",
    fetchingPhone: "Henter nummer...",
    showPhone: "Vis nummer",
    missingPhone: "Nummer mangler",
    loginContact: "Logg inn for å se kontaktopplysninger"
  },
  et: {
    loading: "Laadin...",
    notFound: "Ei leitud",
    linkCopied: "Link kopeeritud!",
    back: "Tagasi",
    forSale: "Müügis",
    part: "Varuosa",
    updated: "Uuendatud",
    imageSingular: "pilt",
    imagePlural: "pilti",
    share: "Jaga",
    saved: "Salvestatud",
    save: "Salvesta",
    description: "Kirjeldus",
    noDescription: "Kirjeldus puudub.",
    vehicle: "Sõiduk",
    partNumber: "Varuosanumber",
    brand: "Mark",
    model: "Mudel",
    year: "Aasta",
    condition: "Seisukord",
    location: "Asukoht",
    notSpecified: "Pole märgitud",
    seller: "Müüja",
    fallbackSeller: "Müüja",
    verified: "Kinnitatud",
    sellers: "Müüjad",
    openSellerProfile: (name: string) => `Ava müüja ${name} avalik profiil`,
    viewProfile: "Vaata profiili",
    contactHeading: "Küsimusi kuulutuse kohta?",
    sendMessage: "Saada sõnum",
    fetchingPhone: "Laadin numbrit...",
    showPhone: "Näita numbrit",
    missingPhone: "Number puudub",
    loginContact: "Kontaktandmete nägemiseks logi sisse"
  }
} satisfies Record<Locale, Record<string, string | ((name: string) => string)>>;

const conditionLabels: Record<Locale, Record<string, string>> = {
  fi: {},
  en: { Hyvä: "Good", Uusi: "New", "Kuin uusi": "Like new", Tyydyttävä: "Fair", Heikko: "Poor" },
  sv: { Hyvä: "Bra", Uusi: "Ny", "Kuin uusi": "Som ny", Tyydyttävä: "Godtagbar", Heikko: "Dålig" },
  no: { Hyvä: "God", Uusi: "Ny", "Kuin uusi": "Som ny", Tyydyttävä: "Greit", Heikko: "Dårlig" },
  et: { Hyvä: "Hea", Uusi: "Uus", "Kuin uusi": "Nagu uus", Tyydyttävä: "Rahuldav", Heikko: "Kehv" }
};

const dateLocales: Record<Locale, string> = {
  fi: "fi-FI",
  en: "en-US",
  sv: "sv-SE",
  no: "nb-NO",
  et: "et-EE"
};

function formatDate(value: string, locale: Locale) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(dateLocales[locale], {
    day: "numeric",
    month: "numeric",
    year: "numeric"
  }).format(date);
}

function readSavedListingIds() {
  try {
    const savedListings = JSON.parse(
      localStorage.getItem("savedListings") || "[]"
    );

    return Array.isArray(savedListings)
      ? savedListings.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export default function ListingPage() {
  const params = useParams<{ id: string }>();
  const { locale } = useLanguage();
  const ui = listingUiText[locale];

  const [listing, setListing] =
    useState<Listing | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [activeImage, setActiveImage] =
    useState<string | null>(null);

  const [showPhone, setShowPhone] =
    useState(false);

  const [sellerPhone, setSellerPhone] =
    useState("");

  const [phoneLoading, setPhoneLoading] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setIsLoggedIn(Boolean(data.session?.user));
          setRecoUserId(data.session?.user?.id ?? null);
        }
      })
      .catch(() => {
        if (mounted) {
          setIsLoggedIn(false);
          setRecoUserId(null);
        }
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(Boolean(session?.user));
        setRecoUserId(session?.user?.id ?? null);
        if (!session?.user) {
          setShowPhone(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fallback =
      fallbackListings.find(
        (i) => i.id === params.id
      ) ?? null;

    getListingById(params.id)
      .then(({ data }) => {
        if (mounted) {
          const resolved = data ?? fallback;
          setListing(resolved);
          trackListingView(resolved);
          if (resolved) {
            void trackUserActivity({
              vehicle_type: resolved.vehicle_type,
              brand: resolved.brand,
              model: resolved.model,
              category: resolved.category
            });
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setListing(fallback);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (!params.id) {
      return;
    }

    const storageKey =
      `listing-viewed:${params.id}`;

    const viewedAt =
      typeof window !== "undefined"
        ? Number(sessionStorage.getItem(storageKey) || 0)
        : 0;

    if (
      typeof window !== "undefined" &&
      Date.now() - viewedAt < 5000
    ) {
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        storageKey,
        String(Date.now())
      );
    }

    void incrementListingView(params.id);
  }, [params.id]);

  const gallery = useMemo(() => {
    if (!listing) return [];

    return Array.from(
      new Set(
        [
          listing.image_url,
          ...(listing.image_urls ?? [])
        ].filter(Boolean)
      )
    );
  }, [listing]);

  useEffect(() => {
    if (gallery.length) {
      setActiveImage(gallery[0]);
    }
  }, [gallery]);

  useEffect(() => {
    if (!listing) return;

    setSaved(readSavedListingIds().includes(listing.id));
    getSavedListingIds()
      .then(({ data }) => {
        if (data.length > 0) {
          localStorage.setItem("savedListings", JSON.stringify(data));
          setSaved(data.includes(listing.id));
        }
      })
      .catch(() => undefined);
  }, [listing]);

  useEffect(() => {
    function syncSavedState() {
      if (!listing) return;
      setSaved(readSavedListingIds().includes(listing.id));
    }

    window.addEventListener("focus", syncSavedState);
    window.addEventListener("storage", syncSavedState);

    return () => {
      window.removeEventListener("focus", syncSavedState);
      window.removeEventListener("storage", syncSavedState);
    };
  }, [listing]);

  function toggleSave() {
    if (!listing) return;

    const savedListings = readSavedListingIds();
    const isCurrentlySaved =
      saved || savedListings.includes(listing.id);

    const updated = isCurrentlySaved
      ? savedListings.filter((id) => id !== listing.id)
      : [...savedListings, listing.id];

    localStorage.setItem(
      "savedListings",
      JSON.stringify(updated)
    );

    setSaved(updated.includes(listing.id));

    void (
      isCurrentlySaved
        ? unsaveListing(listing.id)
        : saveListing(listing.id)
    );
  }

  async function shareListing() {
    if (!listing) return;

    const url = window.location.href;
    const listingText = getLocalizedListingText(listing, locale);

    if (navigator.share) {
      try {
        await navigator.share({
          title: listingText.title,
          text: listingText.title,
          url
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      alert(ui.linkCopied);
    }
  }

  async function handleShowPhone() {
    if (!listing) return;

    if (listing.seller_phone) {
      setSellerPhone(listing.seller_phone);
      setShowPhone(true);
      return;
    }

    if (!supabase || !listing.seller_id) {
      setSellerPhone("");
      setShowPhone(true);
      return;
    }

    setPhoneLoading(true);

    const { data } =
      await supabase
        .from("profiles")
        .select("phone")
        .eq("id", listing.seller_id)
        .maybeSingle<{ phone?: string | null }>();

    const nextPhone =
      data?.phone || "";

    setSellerPhone(nextPhone);
    setListing({
      ...listing,
      seller_phone:
        nextPhone || null
    });
    setShowPhone(true);
    setPhoneLoading(false);
  }

  if (loading) {
    return (
      <div className="loading">
        {ui.loading}
      </div>
    );
  }

  if (!listing) {
    return <div>{ui.notFound}</div>;
  }

  const sellerProfileId =
    listing.seller_id || listing.user_id;
  const sellerHref =
    sellerProfileId
      ? `/seller/${sellerProfileId}?returnTo=${encodeURIComponent(`/listing/${params.id}`)}`
      : "#";
  const isCompanySeller =
    Boolean(listing.company_name);
  const sellerDisplayName =
    listing.company_name || listing.seller_name || ui.fallbackSeller;
  const companySellerNames =
    isCompanySeller &&
    listing.seller_name &&
    listing.seller_name !== listing.company_name
      ? listing.seller_name
      : "";
  const companySellerLabel =
    companySellerNames.includes(",") ? ui.sellers : ui.seller;
  const sellerInitial =
    (sellerDisplayName || "M").trim().slice(0, 1).toUpperCase();

  const vehicleTypeMap: Record<Locale, Record<string, string>> = {
    fi: {},
    en: { Moottorikelkka: "Snowmobile", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
    sv: { Moottorikelkka: "Snöskoter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
    no: { Moottorikelkka: "Snøscooter", Mönkijä: "ATV", Motocross: "Motocross", Mopot: "Moped" },
    et: { Moottorikelkka: "Mootorsaan", Mönkijä: "ATV", Motocross: "Motokross", Mopot: "Mopeed" }
  };
  const baseListingText = getLocalizedListingText(listing, locale);
  const listingPartNumber = getListingPartNumber(listing);
  const translateConditionLabel = (value: string | null | undefined) =>
    value ? conditionLabels[locale][value] ?? value : ui.notSpecified;
  const translateVehicleTypeLabel = (value: string | null | undefined) =>
    value ? vehicleTypeMap[locale]?.[value] ?? value : ui.notSpecified;
  const listingText = (() => {
    if (locale === "fi") return baseListingText;
    const leaf = listing.subcategory?.split("/").map((p) => p.trim()).filter(Boolean).at(-1);
    const isGenerated = leaf && listing.vehicle_type &&
      listing.title.trim().toLowerCase() === `${leaf} - ${listing.vehicle_type}`.trim().toLowerCase();
    if (!isGenerated) return baseListingText;
    const tSub = translateCategory(locale, listing.subcategory ?? "");
    const tLeaf = tSub.split("/").map((p) => p.trim()).filter(Boolean).at(-1) || translateCategory(locale, leaf);
    const tVehicle = vehicleTypeMap[locale]?.[listing.vehicle_type ?? ""] ?? listing.vehicle_type ?? "";
    return { ...baseListingText, title: `${tLeaf} - ${tVehicle}`.trim() };
  })();

  return (
    <main className="page listing-detail-page">

      <header className="topbar">
        <Link href="/" className="back">
          <ArrowLeft size={18} />
          {ui.back}
        </Link>
      </header>

      <div className="container">

        <section className="layout">

          {/* LEFT */}

          <div className="main">

            <div className="title-row">

              <div className="title-left">
                <div className="listing-kicker">
                  <span>{listing.condition ? translateConditionLabel(listing.condition) : ui.forSale}</span>
                  <span>{listing.category ? translateCategory(locale, listing.category) : ui.part}</span>
                  {listingPartNumber ? <span>OEM {listingPartNumber}</span> : null}
                </div>

                <h1>{listingText.title}</h1>

                <div className="sub-info">

                  {ui.updated}{" "}
                  {formatDate(
                    listing.created_at,
                    locale
                  )}

                  <span className="dot">
                    •
                  </span>

                  <span className="location">
                    {listing.location}
                    <MapPin size={14} />
                  </span>

                  <span className="dot">
                    •
                  </span>

                  <span className="listing-id">
                    ID {listing.id}
                  </span>

                </div>

              </div>


            </div>

            {/* IMAGE */}

            <div className="image-wrapper">

              {activeImage && (
                <img
                  src={activeImage}
                  className="main-img"
                  alt={listingText.title}
                />
              )}

              <div className="image-badge">
                {gallery.length} {gallery.length === 1 ? ui.imageSingular : ui.imagePlural}
              </div>
            </div>

            {/* PRICE + ACTIONS ROW */}

            <div className="price-actions-row">

              <div className="image-actions">

                <span className="price-display">
                  {formatPrice(listing.price)}
                </span>

                <button
                  onClick={shareListing}
                  className="icon-btn"
                  title={ui.share}
                >
                  <Share2 size={20} />
                </button>

                <button
                  onClick={toggleSave}
                  className={`icon-btn ${
                    saved ? "icon-saved" : ""
                  }`}
                  title={saved ? ui.saved : ui.save}
                >
                  <Heart
                    size={20}
                    fill={
                      saved
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>

              </div>

            </div>

            {/* THUMBS */}

            <div className="thumbs">

              {gallery.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  onClick={() =>
                    setActiveImage(url)
                  }
                  className={
                    activeImage === url
                      ? "active"
                      : ""
                  }
                />
              ))}

            </div>

            {/* DESCRIPTION */}

            <div className="description-card">

              <h2>{ui.description}</h2>

              <p>
                {(() => {
                  // Strip legacy "Ajoneuvo: ... Merkki: ... Malli: ... Vuosimalli: ..." prefix
                  const desc = listingText.description || "";
                  return desc
                    .replace(/^(?:Ajoneuvo:[^\n]*\n?)?(?:Merkki:[^\n]*\n?)?(?:Malli:[^\n]*\n?)?(?:Vuosimalli:[^\n]*\n?)?/i, "")
                    .replace(/Ajoneuvo:\s*\S+\s+Merkki:\s*[^\s]+(?:\s+\S+)?\s+Malli:\s*[^\s]+(?:\s+\S+)*?\s+Vuosimalli:\s*\d+\s*/i, "")
                    .trim() || ui.noDescription;
                })()}
              </p>

              <div className="listing-fact-grid">
                {listing.vehicle_type && (
                  <span>
                    <strong>{ui.vehicle}</strong>
                    {translateVehicleTypeLabel(listing.vehicle_type)}
                  </span>
                )}
                {listingPartNumber && (
                  <span>
                    <strong>{ui.partNumber}</strong>
                    {listingPartNumber}
                  </span>
                )}
                {listing.brand && (
                  <span>
                    <strong>{ui.brand}</strong>
                    {listing.brand}
                  </span>
                )}
                {listing.model && (
                  <span>
                    <strong>{ui.model}</strong>
                    {listing.model}
                  </span>
                )}
                {listing.year && (
                  <span>
                    <strong>{ui.year}</strong>
                    {listing.year}
                  </span>
                )}
                <span>
                  <strong>{ui.condition}</strong>
                  {translateConditionLabel(listing.condition)}
                </span>
                <span>
                  <strong>{ui.location}</strong>
                  {listing.location || ui.notSpecified}
                </span>
              </div>

            </div>

          </div>

          {/* RIGHT */}

          <aside className="sidebar">

            {/* SELLER */}

            <div className="seller-card">

              <div className="seller-card-header">
                <div className="seller-card-label">{ui.seller}</div>
                <Link href={sellerHref} className="seller-profile-btn">
                  {ui.viewProfile}
                  <ChevronRight size={14} />
                </Link>
              </div>

              <Link
                href={sellerHref}
                className="seller-card-body seller-card-link"
                aria-label={ui.openSellerProfile(sellerDisplayName)}
              >

                <div className="seller-avatar-detail">
                  {listing.seller_avatar_url
                    ? <img src={listing.seller_avatar_url} alt="" className="seller-avatar-img" referrerPolicy="no-referrer" />
                    : sellerInitial}
                </div>

                <div className="seller-info">

                  <div className="seller-name-row">
                    <strong>{sellerDisplayName}</strong>
                    {listing.seller_phone_verified && (
                      <span className="verified-chip"><ShieldCheck size={11} /> {ui.verified}</span>
                    )}
                  </div>

                  {isCompanySeller && (
                    <div className="seller-employee-name">
                      <UserRound size={13} />
                      <span>{companySellerLabel}</span>
                      {companySellerNames && <strong>{companySellerNames}</strong>}
                    </div>
                  )}

                  {listing.location && (
                    <div className="seller-location">{listing.location}</div>
                  )}

                </div>

                <ChevronRight className="seller-card-arrow" size={18} />

              </Link>

            </div>

            {/* CONTACT */}

            <div className="contact-card">

              <h3>
                {ui.contactHeading}
              </h3>

              {isLoggedIn ? (
                <>
                  <Link
                    href={`/messages/${listing.id}`}
                    className="message-btn"
                  >
                    <Mail size={20} />
                    {ui.sendMessage}
                  </Link>

                  {!showPhone ? (

                    <button
                      className="phone-btn"
                      onClick={handleShowPhone}
                      disabled={phoneLoading}
                    >
                      <Phone size={20} />
                      {phoneLoading
                        ? ui.fetchingPhone
                        : ui.showPhone}
                    </button>

                  ) : (

                    <a
                      href={`tel:${
                        sellerPhone ||
                        listing.seller_phone ||
                        ""
                      }`}
                      className="phone-number"
                    >
                      {sellerPhone ||
                        listing.seller_phone ||
                        ui.missingPhone}
                    </a>

                  )}
                </>
              ) : (
                <Link
                  href="/auth"
                  className="login-contact"
                >
                  <LockKeyhole size={20} />
                  {ui.loginContact}
                </Link>
              )}

            </div>

          </aside>

        </section>

      </div>

      <style jsx>{`

        .page {
          min-height: 100vh;
          background:
            radial-gradient(ellipse 900px 500px at 10% 0%, rgba(14, 165, 233, 0.18), transparent 60%),
            radial-gradient(ellipse 700px 400px at 90% 5%, rgba(34, 211, 238, 0.13), transparent 58%),
            radial-gradient(ellipse 600px 600px at 50% 80%, rgba(3, 105, 161, 0.12), transparent 65%),
            linear-gradient(160deg, #0b1a2f 0%, #0d2240 40%, #071526 100%);
        }

        .topbar {
          padding: 18px clamp(18px, 4vw, 52px);
          background: rgba(11, 26, 47, 0.72);
          border-bottom: 1px solid rgba(14, 165, 233, 0.18);
          backdrop-filter: blur(18px);
          box-shadow: 0 16px 50px rgba(0, 8, 24, 0.28);
        }

        .back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #7dd3fc;
          text-decoration: none;
          font-weight: 850;
          font-size: 16px;
          min-height: 42px;
          padding: 0 15px;
          border-radius: 999px;
          border: 1px solid rgba(14, 165, 233, 0.28);
          background: rgba(14, 165, 233, 0.08);
          transition: background 0.15s, border-color 0.15s;
        }

        .back:hover {
          background: rgba(14, 165, 233, 0.16);
          border-color: rgba(14, 165, 233, 0.5);
          color: #bae6fd;
        }

        .container {
          max-width: 1560px;
          margin: 0 auto;
          padding: 28px clamp(18px, 3vw, 36px) 58px;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(310px, 360px);
          gap: 28px;
          align-items: start;
        }

        .main {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid rgba(100, 116, 139, 0.14);
          border-radius: 28px;
          padding: 32px;
          box-shadow:
            0 28px 90px rgba(0, 8, 24, 0.42),
            0 0 0 1px rgba(14, 165, 233, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 26px;
        }

        .listing-kicker {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .listing-kicker span {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(100, 116, 139, 0.1);
          border: 1px solid rgba(100, 116, 139, 0.18);
          color: #374151;
          font-size: 12px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .title-left {
          flex: 1;
          min-width: 0;
        }

        .title-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
          flex-shrink: 0;
        }

        .title-actions {
          display: flex;
          gap: 8px;
        }

        .icon-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0f172a;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
        }

        .icon-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
        }

        .icon-btn.icon-saved {
          background: rgba(255, 122, 26, 0.12);
          border-color: rgba(255, 122, 26, 0.38);
          color: #e85a00;
        }

        .title-row h1 {
          font-size: clamp(1.5rem, 2.5vw, 2rem);
          line-height: 1.3;
          margin: 0;
          font-weight: 800;
          max-width: 100%;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .sub-info {
          margin-top: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(11, 26, 58, 0.7);
          font-size: 15px;
          font-weight: 750;
          flex-wrap: wrap;
        }

        .location {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .dot {
          font-size: 18px;
        }

        .listing-id {
          color: rgba(11, 26, 58, 0.6);
          font-size: 15px;
          font-weight: 750;
        }

        .image-wrapper {
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid rgba(100, 116, 139, 0.14);
          box-shadow: 0 22px 70px rgba(5, 24, 46, 0.12);
          position: relative;
          background: #e2e8f0;
        }

        .image-wrapper::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          box-shadow: inset 0 -90px 80px rgba(6, 26, 46, 0.18);
        }

        .image-badge {
          position: absolute;
          left: 16px;
          bottom: 16px;
          z-index: 2;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(100, 116, 139, 0.22);
          color: #374151;
          font-size: 13px;
          font-weight: 950;
          backdrop-filter: blur(10px);
        }

        .price-actions-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 16px;
        }

        .image-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .main-img {
          width: 100%;
          height: clamp(360px, 48vw, 560px);
          object-fit: cover;
          display: block;
        }

        .thumbs {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          margin-top: 20px;
        }

        .thumbs img {
          width: 100%;
          height: 80px;
          border-radius: 14px;
          object-fit: cover;
          cursor: pointer;
          border: 3px solid transparent;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
        }

        .thumbs img:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15);
        }

        .thumbs img.active {
          border-color: #64748b;
          box-shadow: 0 10px 28px rgba(100, 116, 139, 0.22);
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .price-display {
          font-size: 1.6rem;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1;
          padding: 0 6px 0 0;
        }

        .action-btn {
          height: 52px;
          padding: 0 24px;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.9));
          display: flex;
          align-items: center;
          gap: 12px;
          color: #0f172a;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
        }

        .action-btn:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0.95));
          box-shadow: 0 12px 36px rgba(15, 23, 42, 0.15);
        }

        .action-btn.saved {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15));
          border-color: rgba(16, 185, 129, 0.3);
          color: #059669;
        }

        .description-card {
          margin-top: 32px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid rgba(100, 116, 139, 0.12);
          border-radius: 24px;
          padding: 36px;
          box-shadow: 0 20px 70px rgba(5, 24, 46, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .description-card h2 {
          margin-top: 0;
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .description-card p {
          color: rgba(15, 23, 42, 0.75);
          line-height: 1.7;
          font-size: 16px;
          font-weight: 500;
        }

        .listing-fact-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 26px;
        }

        .listing-fact-grid span {
          display: grid;
          gap: 6px;
          border-radius: 16px;
          padding: 14px;
          background: rgba(218, 249, 255, 0.46);
          border: 1px solid rgba(8, 121, 149, 0.12);
          color: #547083;
          font-weight: 800;
        }

        .listing-fact-grid strong {
          color: #087995;
          font-size: 12px;
          text-transform: uppercase;
        }

        .sidebar {
          position: sticky;
          top: 20px;
        }

        .seller-card,
        .contact-card {
          background:
            radial-gradient(360px 140px at 100% 0%, rgba(201, 247, 255, 0.28), transparent 70%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 253, 255, 0.94));
          border: 1px solid rgba(8, 121, 149, 0.14);
          border-radius: 24px;
          padding: 28px;
          margin-bottom: 24px;
          box-shadow: 0 24px 80px rgba(5, 24, 46, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .seller-card {
          overflow: hidden;
          padding: 0;
          background:
            radial-gradient(380px 180px at 100% 0%, rgba(73, 199, 216, 0.36), transparent 66%),
            linear-gradient(145deg, #061827 0%, #0b3550 54%, #087995 100%);
          border-color: rgba(201, 247, 255, 0.24);
          color: #ffffff;
        }

        .seller-card h2,
        .contact-card h3 {
          margin: 0 0 20px;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
        }

        .seller-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 18px 0;
        }

        .seller-card-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(201, 247, 255, 0.72);
          margin: 0;
        }

        .seller-card-body {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 14px 14px 12px;
          min-height: 86px;
          padding: 13px 14px;
          position: relative;
        }

        .seller-card-link {
          border: 1px solid rgba(201, 247, 255, 0.2);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.08);
          color: inherit;
          text-decoration: none;
          transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
        }

        .seller-card-link:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(201, 247, 255, 0.34);
          transform: translateY(-1px);
        }

        .seller-avatar-detail {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: linear-gradient(145deg, #d9fbff 0%, #6ed2e4 45%, #0a4462 100%);
          border: 2px solid rgba(8, 121, 149, 0.22);
          box-shadow:
            0 0 0 2px #ffffff,
            0 6px 18px rgba(8, 121, 149, 0.18);
          color: #061a2e;
          font-size: 1.4rem;
          font-weight: 950;
          flex: none;
        }

        .seller-info {
          flex: 1;
          min-width: 0;
        }

        .seller-name-row {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .seller-name-row strong {
          font-size: 16px;
          font-weight: 800;
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .verified-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10.5px;
          font-weight: 700;
          color: #087995;
          background: rgba(8, 121, 149, 0.08);
          border: 1px solid rgba(8, 121, 149, 0.18);
          border-radius: 99px;
          padding: 2px 7px;
          white-space: nowrap;
        }

        .seller-card .verified-chip {
          color: #dffaff;
          background: rgba(201, 247, 255, 0.12);
          border-color: rgba(201, 247, 255, 0.26);
        }

        .seller-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          background: transparent;
          padding: 0;
          display: block;
          border-radius: 50%;
        }

        .seller-profile-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-height: 32px;
          padding: 0 10px 0 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(218, 249, 255, 0.9));
          border: 1px solid rgba(201, 247, 255, 0.42);
          color: #06445f;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
          text-decoration: none;
          transition: background 0.15s, border-color 0.15s, transform 0.15s;
          box-shadow:
            0 10px 24px rgba(0, 10, 24, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.72);
        }

        .seller-profile-btn:hover {
          background: #ffffff;
          border-color: rgba(201, 247, 255, 0.48);
          transform: translateY(-1px);
        }

        .seller-employee-name {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          color: rgba(223, 250, 255, 0.78);
          font-size: 12px;
          font-weight: 850;
          min-width: 0;
        }

        .seller-employee-name strong {
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .seller-location {
          margin-top: 5px;
          color: rgba(223, 250, 255, 0.72);
          font-size: 14px;
          font-weight: 750;
        }

        .seller-card-arrow {
          color: rgba(223, 250, 255, 0.76);
          flex: none;
        }

        .message-btn,
        .phone-btn,
        .phone-number,
        .login-contact {
          width: 100%;
          height: 66px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 850;
          text-decoration: none;
          margin-top: 16px;
          transition: all 0.2s ease;
        }

        .message-btn,
        .phone-btn,
        .login-contact {
          background: linear-gradient(135deg, #071827 0%, #0b5d82 48%, #49c7d8 100%);
          color: white;
          border: 1px solid rgba(201, 247, 255, 0.36);
          cursor: pointer;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        }

        .message-btn:hover,
        .phone-btn:hover,
        .login-contact:hover {
          transform: translateY(-1px);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.22);
        }

        .phone-number {
          background: linear-gradient(135deg, #087995 0%, #49c7d8 100%);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        }

        @media (max-width: 1100px) {

          .layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: static;
          }

          .title-row {
            flex-direction: column;
          }

          .title-row h1 {
            font-size: 2.7rem;
          }

          .main-img {
            height: 420px;
          }

        }

        @media (max-width: 640px) {

          .container {
            padding: 12px;
          }

          .main {
            padding: 18px;
          }

          .listing-fact-grid {
            grid-template-columns: 1fr;
          }

          .title-row h1 {
            font-size: 2rem;
          }

          .main-img {
            height: 260px;
          }

          .thumbs img {
            width: 90px;
            height: 70px;
          }

          .price-actions-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .action-buttons {
            width: 100%;
            justify-content: space-between;
          }

          .action-btn {
            flex: 1;
            justify-content: center;
          }

        }

      `}</style>
    </main>
  );
}
