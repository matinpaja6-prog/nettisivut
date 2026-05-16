"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award, Check, CheckCircle2, Copy, Gift, ListChecks, LockKeyhole, Share2, Sparkles, Store, Users } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n";
import {
  claimQuest,
  getListingSlotUsage,
  getMyReferralStats,
  getProfileExtraSlots,
  getQuestProgress,
  supabase,
  type QuestProgress,
  type Referral
} from "@/lib/supabase";
import {
  BASE_LISTING_SLOT_LIMIT,
  getListingSlotLimit,
  readListingSlotPurchases,
  type ListingSlotPurchase
} from "@/lib/listing-slots";

type ReferralWithName = Referral & { referred_name?: string | null };

type QuestDef = {
  id: string;
  title: string;
  desc: string;
  points: number;
  emoji: string;
  type: "boolean" | "count";
  field: keyof QuestProgress;
  required?: number;
};

const QUEST_TR: Record<string, Record<string, { title: string; desc: string }>> = {
  fi: {
    profile_complete:      { title: "Täytä profiili",            desc: "Täytä kaikki profiilin tiedot" },
    phone_verified:        { title: "Vahvista puhelinnumero",    desc: "Vahvista puhelinnumero tekstiviestillä" },
    first_listing:         { title: "Tee ensimmäinen ilmoitus",  desc: "Julkaise ensimmäinen myyntiilmoituksesi" },
    listings_5:            { title: "Julkaise 5 ilmoitusta",     desc: "Aktiivinen myyjä — 5 ilmoitusta" },
    listings_25:           { title: "Julkaise 25 ilmoitusta",    desc: "Tehomyyjä — 25 ilmoitusta" },
    first_review_given:    { title: "Anna ensimmäinen arvio",    desc: "Arvioi ostamasi myyjä" },
    reviews_given_10:      { title: "Anna 10 arviota",           desc: "Auta yhteisöä — 10 arviota annettu" },
    first_review_received: { title: "Saa ensimmäinen arvio",     desc: "Saa ensimmäinen arvio myyjänä" },
    reviews_received_10:   { title: "Saa 10 arviota",            desc: "Luotettu myyjä — 10 arviota saatu" },
    referrals_5:           { title: "Kutsu 5 kaveria",           desc: "Kutsuminen kannattaa — 5 rekisteröitynyt" }
  },
  en: {
    profile_complete:      { title: "Complete profile",         desc: "Fill in all profile information" },
    phone_verified:        { title: "Verify phone number",      desc: "Verify your phone number by SMS" },
    first_listing:         { title: "Create first listing",     desc: "Publish your first sales listing" },
    listings_5:            { title: "Publish 5 listings",       desc: "Active seller — 5 listings" },
    listings_25:           { title: "Publish 25 listings",      desc: "Power seller — 25 listings" },
    first_review_given:    { title: "Give first review",        desc: "Review a seller you bought from" },
    reviews_given_10:      { title: "Give 10 reviews",          desc: "Help the community — 10 reviews given" },
    first_review_received: { title: "Receive first review",     desc: "Get your first review as a seller" },
    reviews_received_10:   { title: "Receive 10 reviews",       desc: "Trusted seller — 10 reviews received" },
    referrals_5:           { title: "Invite 5 friends",         desc: "Referrals pay off — 5 registered" }
  },
  sv: {
    profile_complete:      { title: "Fyll i profil",            desc: "Fyll i all profilinformation" },
    phone_verified:        { title: "Verifiera telefonnummer",  desc: "Verifiera ditt telefonnummer via SMS" },
    first_listing:         { title: "Skapa första annons",      desc: "Publicera din första försäljningsannons" },
    listings_5:            { title: "Publicera 5 annonser",     desc: "Aktiv säljare — 5 annonser" },
    listings_25:           { title: "Publicera 25 annonser",    desc: "Storsäljare — 25 annonser" },
    first_review_given:    { title: "Ge första recension",      desc: "Recensera en säljare du köpt från" },
    reviews_given_10:      { title: "Ge 10 recensioner",        desc: "Hjälp gemenskapen — 10 recensioner" },
    first_review_received: { title: "Få första recension",      desc: "Få din första recension som säljare" },
    reviews_received_10:   { title: "Få 10 recensioner",        desc: "Betrodd säljare — 10 recensioner" },
    referrals_5:           { title: "Bjud in 5 vänner",         desc: "Det lönar sig — 5 registrerade" }
  },
  no: {
    profile_complete:      { title: "Fyll ut profil",           desc: "Fyll ut all profilinformasjon" },
    phone_verified:        { title: "Bekreft telefonnummer",    desc: "Bekreft telefonnummeret ditt via SMS" },
    first_listing:         { title: "Opprett første annonse",   desc: "Publiser din første salgsannonse" },
    listings_5:            { title: "Publiser 5 annonser",      desc: "Aktiv selger — 5 annonser" },
    listings_25:           { title: "Publiser 25 annonser",     desc: "Superselger — 25 annonser" },
    first_review_given:    { title: "Gi første anmeldelse",     desc: "Anmeld en selger du har kjøpt fra" },
    reviews_given_10:      { title: "Gi 10 anmeldelser",        desc: "Hjelp fellesskapet — 10 anmeldelser" },
    first_review_received: { title: "Motta første anmeldelse",  desc: "Få din første anmeldelse som selger" },
    reviews_received_10:   { title: "Motta 10 anmeldelser",     desc: "Pålitelig selger — 10 anmeldelser" },
    referrals_5:           { title: "Inviter 5 venner",         desc: "Det lønner seg — 5 registrert" }
  },
  et: {
    profile_complete:      { title: "Täida profiil",            desc: "Täida kõik profiili andmed" },
    phone_verified:        { title: "Kinnita telefoninumber",   desc: "Kinnita telefoninumber SMS-iga" },
    first_listing:         { title: "Loo esimene kuulutus",     desc: "Avalda oma esimene müügikuulutus" },
    listings_5:            { title: "Avalda 5 kuulutust",       desc: "Aktiivne müüja — 5 kuulutust" },
    listings_25:           { title: "Avalda 25 kuulutust",      desc: "Supermüüja — 25 kuulutust" },
    first_review_given:    { title: "Anna esimene hinnang",     desc: "Hinda müüjat, kellelt ostsid" },
    reviews_given_10:      { title: "Anna 10 hinnangut",        desc: "Aita kogukonda — 10 hinnangut" },
    first_review_received: { title: "Saa esimene hinnang",      desc: "Saa oma esimene hinnang müüjana" },
    reviews_received_10:   { title: "Saa 10 hinnangut",         desc: "Usaldusväärne müüja — 10 hinnangut" },
    referrals_5:           { title: "Kutsu 5 sõpra",            desc: "Kutsumine tasub end ära — 5 registreerunud" }
  }
};

const QUESTS: QuestDef[] = [
  { id: "profile_complete",      title: "Täytä profiili",            desc: "Täytä kaikki profiilin tiedot",           points: 100, emoji: "👤", type: "boolean", field: "profile_completed" },
  { id: "phone_verified",        title: "Vahvista puhelinnumero",    desc: "Vahvista oma tai yrityksen myyjän puhelinnumero tekstiviestillä", points: 100, emoji: "📱", type: "boolean", field: "phone_verified" },
  { id: "first_listing",         title: "Tee ensimmäinen ilmoitus",  desc: "Julkaise ensimmäinen myyntiilmoituksesi", points: 50,  emoji: "📝", type: "count",   field: "listings",         required: 1  },
  { id: "listings_5",            title: "Julkaise 5 ilmoitusta",     desc: "Aktiivinen myyjä — 5 ilmoitusta",         points: 250, emoji: "📦", type: "count",   field: "listings",         required: 5  },
  { id: "listings_25",           title: "Julkaise 25 ilmoitusta",    desc: "Tehomyyjä — 25 ilmoitusta",               points: 500, emoji: "🏪", type: "count",   field: "listings",         required: 25 },
  { id: "first_review_given",    title: "Anna ensimmäinen arvio",    desc: "Arvioi ostamasi myyjä",                   points: 50,  emoji: "⭐", type: "count",   field: "reviews_given",    required: 1  },
  { id: "reviews_given_10",      title: "Anna 10 arviota",           desc: "Auta yhteisöä — 10 arviota annettu",      points: 500, emoji: "🌟", type: "count",   field: "reviews_given",    required: 10 },
  { id: "first_review_received", title: "Saa ensimmäinen arvio",     desc: "Saa ensimmäinen arvio myyjänä",           points: 50,  emoji: "🎯", type: "count",   field: "reviews_received", required: 1  },
  { id: "reviews_received_10",   title: "Saa 10 arviota",            desc: "Luotettu myyjä — 10 arviota saatu",       points: 500, emoji: "🏆", type: "count",   field: "reviews_received", required: 10 },
  { id: "referrals_5",           title: "Kutsu 5 kaveria",           desc: "Kutsuminen kannattaa — 5 rekisteröitynyt", points: 200, emoji: "🤝", type: "count",   field: "referrals",        required: 5  }
];

export default function RewardsPage() {
  const { locale, t } = useLanguage();
  const qtr = QUEST_TR[locale] ?? QUEST_TR.fi;
  const rw = {
    fi:  { eyebrow: "Palkinnot", h1: "Kutsu kavereita ja ansaitse pisteitä", introBefore: "Jaa henkilökohtainen kutsulinkkisi. Kun kaveri rekisteröityy linkkisi kautta, saat automaattisesti", introAfter: "Pisteillä voi tulevaisuudessa lunastaa etuja palvelussa.", loginPrompt: "Kirjaudu sisään nähdäksesi pisteesi ja kutsulinkkisi.", loginLink: "Kirjaudu", loading: "Ladataan...", claimSuccess: (p: number) => `✅ Sait ${p} pistettä!`, notCompleted: (p: number, r: number) => `Tehtävä ei ole vielä suoritettu (${p}/${r}).`, alreadyClaimed: "Tämä tehtävä on jo lunastettu.", claimError: (e: string) => `Virhe: ${e}`, shareTitle: "Liity Arctic Partsiin!", shareText: (u: string) => `Käytä kutsulinkkiäni: ${u}`, pointsTitle: "Pistetilisi", pointsSuffix: "pistettä", invitedUsers: "Kutsutut käyttäjät", listingSlots: "Ilmoituspaikat", shopBadge: "Pisteillä etuja", shopDesc: "Kaupassa voit käyttää pisteitä ilmoituspaikkoihin ja myöhemmin ostaa pisteitä oikealla rahalla.", openShop: "Avaa kauppa", refBadge: "+100 p / kaveri", refBefore: "Jaa tämä henkilökohtainen linkki. Jokaisesta sen kautta rekisteröityneestä saat automaattisesti", refAfter: "tilillesi.", copied: "Kopioitu!", copy: "Kopioi", shareLink: "Jaa linkki", waText: (u: string) => `Liity Arctic Partsiin kutsullani: ${u}`, emailSubject: "Liity Arctic Partsiin", emailBody: (u: string) => `Liity Arctic Partsiin kutsullani: ${u}`, email: "Sähköposti", noCode: "Kutsulinkki luodaan automaattisesti — palaa hetken kuluttua.", questsBadge: "Ansaitse pisteitä", questsDesc: "Suorita tehtäviä ja lunasta pisteet napilla. Jokainen tehtävä voidaan lunastaa vain kerran.", done: "Valmis", ongoing: "Kesken", claimed: "Lunastettu", claiming: "Lunastetaan...", claim: "Lunasta", inviteTitle: "Kutsumasi käyttäjät", noInvites: "Et ole vielä kutsunut ketään. Jaa linkkisi yllä ja ansaitse pisteitä!", unknownUser: "Käyttäjä" },
    en:  { eyebrow: "Rewards", h1: "Invite friends and earn points", introBefore: "Share your personal invite link. When a friend registers through your link, you automatically receive", introAfter: "Points can be redeemed for benefits in the future.", loginPrompt: "Log in to see your points and invite link.", loginLink: "Log in", loading: "Loading...", claimSuccess: (p: number) => `✅ You earned ${p} points!`, notCompleted: (p: number, r: number) => `Quest not yet completed (${p}/${r}).`, alreadyClaimed: "This quest has already been claimed.", claimError: (e: string) => `Error: ${e}`, shareTitle: "Join Arctic Parts!", shareText: (u: string) => `Use my invite link: ${u}`, pointsTitle: "Your points", pointsSuffix: "points", invitedUsers: "Invited users", listingSlots: "Listing slots", shopBadge: "Spend points", shopDesc: "In the shop you can use points for listing slots and later buy points with real money.", openShop: "Open shop", refBadge: "+100 p / friend", refBefore: "Share this personal link. For every user who registers through it you automatically receive", refAfter: "in your account.", copied: "Copied!", copy: "Copy", shareLink: "Share link", waText: (u: string) => `Join Arctic Parts with my invite: ${u}`, emailSubject: "Join Arctic Parts", emailBody: (u: string) => `Join Arctic Parts with my invite: ${u}`, email: "Email", noCode: "Invite link will be created automatically — check back in a moment.", questsBadge: "Earn points", questsDesc: "Complete quests and claim points. Each quest can only be claimed once.", done: "Done", ongoing: "In progress", claimed: "Claimed", claiming: "Claiming...", claim: "Claim", inviteTitle: "Your referred users", noInvites: "You haven't invited anyone yet. Share your link above and earn points!", unknownUser: "User" },
    sv:  { eyebrow: "Belöningar", h1: "Bjud in vänner och tjäna poäng", introBefore: "Dela din personliga inbjudningslänk. När en vän registrerar sig via din länk får du automatiskt", introAfter: "Poäng kan lösas in mot förmåner i framtiden.", loginPrompt: "Logga in för att se dina poäng och inbjudningslänk.", loginLink: "Logga in", loading: "Laddar...", claimSuccess: (p: number) => `✅ Du fick ${p} poäng!`, notCompleted: (p: number, r: number) => `Uppdraget är inte klart ännu (${p}/${r}).`, alreadyClaimed: "Det här uppdraget har redan lösts in.", claimError: (e: string) => `Fel: ${e}`, shareTitle: "Gå med i Arctic Parts!", shareText: (u: string) => `Använd min inbjudningslänk: ${u}`, pointsTitle: "Dina poäng", pointsSuffix: "poäng", invitedUsers: "Inbjudna användare", listingSlots: "Annonsplatser", shopBadge: "Spendera poäng", shopDesc: "I butiken kan du använda poäng för annonsplatser och senare köpa poäng med riktiga pengar.", openShop: "Öppna butiken", refBadge: "+100 p / vän", refBefore: "Dela den här personliga länken. För varje användare som registrerar sig via den får du automatiskt", refAfter: "på ditt konto.", copied: "Kopierat!", copy: "Kopiera", shareLink: "Dela länk", waText: (u: string) => `Gå med i Arctic Parts med min inbjudan: ${u}`, emailSubject: "Gå med i Arctic Parts", emailBody: (u: string) => `Gå med i Arctic Parts med min inbjudan: ${u}`, email: "E-post", noCode: "Inbjudningslänk skapas automatiskt — kom tillbaka om en stund.", questsBadge: "Tjäna poäng", questsDesc: "Slutför uppdrag och lös in poäng. Varje uppdrag kan bara lösas in en gång.", done: "Klar", ongoing: "Pågår", claimed: "Inlöst", claiming: "Löser in...", claim: "Lös in", inviteTitle: "Dina inbjudna användare", noInvites: "Du har inte bjudit in någon ännu. Dela din länk ovan och tjäna poäng!", unknownUser: "Användare" },
    no:  { eyebrow: "Belønninger", h1: "Inviter venner og tjen poeng", introBefore: "Del din personlige invitasjonslenke. Når en venn registrerer seg via lenken din, får du automatisk", introAfter: "Poeng kan i fremtiden løses inn mot fordeler.", loginPrompt: "Logg inn for å se poengene dine og invitasjonslenken.", loginLink: "Logg inn", loading: "Laster...", claimSuccess: (p: number) => `✅ Du fikk ${p} poeng!`, notCompleted: (p: number, r: number) => `Oppdraget er ikke fullført ennå (${p}/${r}).`, alreadyClaimed: "Dette oppdraget er allerede innløst.", claimError: (e: string) => `Feil: ${e}`, shareTitle: "Bli med i Arctic Parts!", shareText: (u: string) => `Bruk invitasjonslenken min: ${u}`, pointsTitle: "Poengene dine", pointsSuffix: "poeng", invitedUsers: "Inviterte brukere", listingSlots: "Annonseplasser", shopBadge: "Bruk poeng", shopDesc: "I butikken kan du bruke poeng til annonseplasser og senere kjøpe poeng med ekte penger.", openShop: "Åpne butikken", refBadge: "+100 p / venn", refBefore: "Del denne personlige lenken. For hver bruker som registrerer seg via den, får du automatisk", refAfter: "på kontoen.", copied: "Kopiert!", copy: "Kopier", shareLink: "Del lenke", waText: (u: string) => `Bli med i Arctic Parts med invitasjonen min: ${u}`, emailSubject: "Bli med i Arctic Parts", emailBody: (u: string) => `Bli med i Arctic Parts med invitasjonen min: ${u}`, email: "E-post", noCode: "Invitasjonslenke opprettes automatisk — kom tilbake om litt.", questsBadge: "Tjen poeng", questsDesc: "Fullfør oppdrag og løs inn poeng. Hvert oppdrag kan bare løses inn én gang.", done: "Ferdig", ongoing: "Pågår", claimed: "Innløst", claiming: "Løser inn...", claim: "Løs inn", inviteTitle: "Dine inviterte brukere", noInvites: "Du har ikke invitert noen ennå. Del lenken din ovenfor og tjen poeng!", unknownUser: "Bruker" },
    et:  { eyebrow: "Auhinnad", h1: "Kutsu sõpru ja teeni punkte", introBefore: "Jaga oma isiklikku kutsumislinki. Kui sõber registreerub sinu lingi kaudu, saad automaatselt", introAfter: "Punktidega saad tulevikus hüvesid lunastada.", loginPrompt: "Logi sisse, et näha oma punkte ja kutsumislinki.", loginLink: "Logi sisse", loading: "Laadimine...", claimSuccess: (p: number) => `✅ Said ${p} punkti!`, notCompleted: (p: number, r: number) => `Ülesanne pole veel lõpetatud (${p}/${r}).`, alreadyClaimed: "See ülesanne on juba lunastatud.", claimError: (e: string) => `Viga: ${e}`, shareTitle: "Liitu Arctic Partsiga!", shareText: (u: string) => `Kasuta minu kutsumislinki: ${u}`, pointsTitle: "Sinu punktid", pointsSuffix: "punkti", invitedUsers: "Kutsutud kasutajad", listingSlots: "Kuulutuse kohad", shopBadge: "Kuluta punkte", shopDesc: "Poes saad kasutada punkte kuulutuskohtade jaoks ja hiljem osta punkte päris rahaga.", openShop: "Ava pood", refBadge: "+100 p / sõber", refBefore: "Jaga seda isiklikku linki. Iga selle kaudu registreeruva kasutaja eest saad automaatselt", refAfter: "oma kontole.", copied: "Kopeeritud!", copy: "Kopeeri", shareLink: "Jaga linki", waText: (u: string) => `Liitu Arctic Partsiga minu kutsega: ${u}`, emailSubject: "Liitu Arctic Partsiga", emailBody: (u: string) => `Liitu Arctic Partsiga minu kutsega: ${u}`, email: "E-post", noCode: "Kutsumislink luuakse automaatselt — tule tagasi hetke pärast.", questsBadge: "Teeni punkte", questsDesc: "Täida ülesandeid ja lunasta punkte nupuga. Iga ülesannet saab lunastada ainult üks kord.", done: "Valmis", ongoing: "Pooleli", claimed: "Lunastatud", claiming: "Lunastamine...", claim: "Lunasta", inviteTitle: "Sinu kutsutud kasutajad", noInvites: "Sa pole veel kedagi kutsunud. Jaga linki ülal ja teeni punkte!", unknownUser: "Kasutaja" }
  }[locale] ?? { eyebrow: t.rewards, h1: "", introBefore: "", introAfter: "", loginPrompt: "", loginLink: t.login, loading: "...", claimSuccess: (p: number) => `+${p}`, notCompleted: (p: number, r: number) => `${p}/${r}`, alreadyClaimed: "", claimError: (e: string) => e, shareTitle: "", shareText: (u: string) => u, pointsTitle: "", pointsSuffix: "p", invitedUsers: "", listingSlots: "", shopBadge: "", shopDesc: "", openShop: "", refBadge: "", refBefore: "", refAfter: "", copied: "", copy: "", shareLink: "", waText: (u: string) => u, emailSubject: "", emailBody: (u: string) => u, email: "", noCode: "", questsBadge: "", questsDesc: "", done: "", ongoing: "", claimed: "", claiming: "", claim: "", inviteTitle: "", noInvites: "", unknownUser: "" };
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralWithName[]>([]);
  const [copied, setCopied] = useState(false);
  const [questProgress, setQuestProgress] = useState<QuestProgress | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [listingSlotUsed, setListingSlotUsed] = useState(0);
  const [slotPurchases, setSlotPurchases] = useState<ListingSlotPurchase[]>([]);
  const [dbExtraSlots, setDbExtraSlots] = useState(0);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
  }, []);

  async function reloadAll(uid: string) {
    setLoading(true);
    try {
      const [stats, progress, slotUsage, extras] = await Promise.all([
        getMyReferralStats(uid),
        getQuestProgress(uid),
        getListingSlotUsage(uid),
        getProfileExtraSlots(uid)
      ]);
      setPoints(stats.points);
      setReferralCode(stats.referralCode);
      setReferrals(stats.referrals);
      setQuestProgress(progress);
      setListingSlotUsed(slotUsage.data);
      setSlotPurchases(readListingSlotPurchases(uid));
      setDbExtraSlots(extras);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void reloadAll(user.id);
  }, [user]);

  async function handleClaim(questId: string) {
    if (!user || claimingId) return;
    setClaimingId(questId);
    setClaimMessage(null);
    const result = await claimQuest(questId);
    if (result.success) {
      setQuestProgress((prev) => {
        if (!prev || prev.claimed.includes(questId)) return prev;
        return {
          ...prev,
          claimed: [...prev.claimed, questId]
        };
      });
      setPoints((prev) => prev + (result.points ?? 0));
      setClaimMessage(rw.claimSuccess(result.points ?? 0));
    } else if (result.error === "not_completed") {
      setClaimMessage(rw.notCompleted(result.progress ?? 0, result.required ?? 1));
    } else if (result.error === "already_claimed") {
      setQuestProgress((prev) => {
        if (!prev || prev.claimed.includes(questId)) return prev;
        return {
          ...prev,
          claimed: [...prev.claimed, questId]
        };
      });
      setClaimMessage(rw.alreadyClaimed);
    } else {
      setClaimMessage(rw.claimError(result.error ?? ""));
    }
    setClaimingId(null);
    setTimeout(() => setClaimMessage(null), 3500);
  }

  const referralUrl =
    typeof window !== "undefined" && referralCode
      ? `${window.location.origin}/auth?ref=${referralCode}`
      : "";

  function handleCopy() {
    if (!referralUrl) return;
    try {
      navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function handleShare() {
    if (!referralUrl) return;
    if (navigator.share) {
      navigator.share({
        title: rw.shareTitle,
        text: rw.shareText(""),
        url: referralUrl
      }).catch(() => handleCopy());
    } else {
      handleCopy();
    }
  }

  const listingSlotLimit = user
    ? getListingSlotLimit(user.id, slotPurchases, dbExtraSlots)
    : BASE_LISTING_SLOT_LIMIT;

  return (
    <main className="auth-page">
      <header className="auth-topbar">
        <Link className="back-link" href="/">
          <ArrowLeft size={18} />
          {t.back}
        </Link>
        <LanguageSwitcher />
      </header>

      <section className="profile-workspace shop-workspace">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              <Award size={16} />
              {rw.eyebrow}
            </span>
            <h1>{rw.h1}</h1>
          </div>
          <p>
            {rw.introBefore} <strong>+100 p</strong>. {rw.introAfter}
          </p>
        </div>

        {!user && (
          <div className="profile-alert">
            <LockKeyhole size={20} />
            <span>{rw.loginPrompt}</span>
            <Link href="/auth">{rw.loginLink}</Link>
          </div>
        )}

        {user && loading && (
          <div className="profile-alert">
            <span>{rw.loading}</span>
          </div>
        )}

        {user && !loading && (
          <>
            {/* Points hero card */}
            <div className="rewards-hero">
              <div className="rewards-hero-points">
                <Sparkles size={28} />
                <div>
                  <span>{rw.pointsTitle}</span>
                  <strong>{points.toLocaleString()} {rw.pointsSuffix}</strong>
                </div>
              </div>
              <div className="rewards-hero-stats">
                <div>
                  <Users size={18} />
                  <span>{rw.invitedUsers}</span>
                  <strong>{referrals.length}</strong>
                </div>
                <div>
                  <Gift size={18} />
                  <span>{rw.listingSlots}</span>
                  <strong>{listingSlotUsed} / {listingSlotLimit}</strong>
                </div>
              </div>
            </div>

            <div className="rewards-card rewards-shop-cta">
              <div className="rewards-card-head">
                <Store size={20} />
                <h2>{t.shop}</h2>
                <span className="rewards-points-badge">{rw.shopBadge}</span>
              </div>
              <p className="rewards-muted">{rw.shopDesc}</p>
              <Link href="/shop" className="rewards-primary-btn">
                <Store size={16} />
                {rw.openShop}
              </Link>
            </div>

            {/* Referral link card */}
            <div className="rewards-card">
              <div className="rewards-card-head">
                <Share2 size={20} />
                <h2>{rw.shareLink}</h2>
                <span className="rewards-points-badge">{rw.refBadge}</span>
              </div>
              <p className="rewards-muted">
                {rw.refBefore} <strong>100 p</strong> {rw.refAfter}
              </p>
              {referralCode ? (
                <>
                  <div className="rewards-link-row">
                    <input readOnly value={referralUrl} />
                    <button type="button" onClick={handleCopy} className="rewards-copy-btn">
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? rw.copied : rw.copy}
                    </button>
                  </div>
                  <div className="rewards-share-actions">
                    <button type="button" onClick={handleShare} className="rewards-primary-btn">
                      <Share2 size={16} />
                      {rw.shareLink}
                    </button>
                    <a
                      className="rewards-secondary-btn"
                      href={`https://wa.me/?text=${encodeURIComponent(rw.waText(referralUrl))}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                    <a
                      className="rewards-secondary-btn"
                      href={`mailto:?subject=${encodeURIComponent(rw.emailSubject)}&body=${encodeURIComponent(rw.emailBody(referralUrl))}`}
                    >
                      {rw.email}
                    </a>
                  </div>
                </>
              ) : (
                <p className="rewards-muted">{rw.noCode}</p>
              )}
            </div>

            {/* Quest list */}
            <div className="rewards-card">
              <div className="rewards-card-head">
                <ListChecks size={20} />
                <h2>{t.rewards}</h2>
                <span className="rewards-points-badge">{rw.questsBadge}</span>
              </div>
              <p className="rewards-muted">{rw.questsDesc}</p>

              {claimMessage && (
                <div className="quest-toast">{claimMessage}</div>
              )}

              <div className="quest-list">
                {QUESTS.map((q) => {
                  const claimed = questProgress?.claimed?.includes(q.id) ?? false;
                  const value = questProgress ? questProgress[q.field] : 0;
                  const completed =
                    q.type === "boolean"
                      ? Boolean(value)
                      : (typeof value === "number" ? value : 0) >= (q.required ?? 1);
                  const current =
                    q.type === "count" && typeof value === "number" ? value : completed ? 1 : 0;
                  const target = q.type === "count" ? (q.required ?? 1) : 1;
                  const percent = Math.min(100, Math.round((current / target) * 100));

                  return (
                    <div
                      key={q.id}
                      className={
                        claimed
                          ? "quest-item claimed"
                          : completed
                          ? "quest-item completed"
                          : "quest-item"
                      }
                    >
                      <span className="quest-emoji">{q.emoji}</span>
                      <div className="quest-info">
                        <strong>{qtr[q.id]?.title ?? q.title}</strong>
                        <span>{qtr[q.id]?.desc ?? q.desc}</span>
                        <div className="quest-progress">
                          <div className="quest-progress-bar">
                            <div
                              className="quest-progress-fill"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="quest-progress-text">
                            {q.type === "count"
                              ? `${Math.min(current, target)} / ${target}`
                              : completed
                              ? rw.done
                              : rw.ongoing}
                          </span>
                        </div>
                      </div>
                      <div className="quest-action">
                        <span className="quest-points">+{q.points} p</span>
                        {claimed ? (
                          <span className="quest-claimed-badge">
                            <CheckCircle2 size={14} /> {rw.claimed}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="quest-claim-btn"
                            disabled={!completed || claimingId === q.id}
                            onClick={() => handleClaim(q.id)}
                          >
                            {claimingId === q.id ? rw.claiming : completed ? rw.claim : rw.ongoing}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Referral history */}
            <div className="rewards-card">
              <div className="rewards-card-head">
                <Users size={20} />
                <h2>{rw.inviteTitle}</h2>
              </div>
              {referrals.length === 0 ? (
                <p className="rewards-muted">{rw.noInvites}</p>
              ) : (
                <ul className="rewards-history">
                  {referrals.map((r) => (
                    <li key={r.id}>
                      <span className="rewards-history-name">
                        {r.referred_name || rw.unknownUser}
                      </span>
                      <span className="rewards-history-date">
                        {new Date(r.created_at).toLocaleDateString(locale)}
                      </span>
                      <span className="rewards-history-points">
                        +{r.points_awarded} p
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
