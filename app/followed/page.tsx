"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  MapPin,
  Search,
  UserCheck,
  UserMinus,
  Users
} from "lucide-react";

import {
  getMyProfileFollows,
  supabase,
  unfollowProfile,
  type ProfileFollowListItem
} from "@/lib/supabase";
import { useLanguage, type Locale } from "@/lib/i18n";
import { profilePath } from "@/lib/routes";

type FollowedTab = "following" | "followers";

const followedText: Record<Locale, {
  loadError: string;
  removeError: string;
  loading: string;
  loginTitle: string;
  loginLead: string;
  loginAction: string;
  eyebrow: string;
  title: string;
  lead: string;
  followingStat: string;
  followersStat: string;
  tabsLabel: string;
  followingTab: string;
  followersTab: string;
  emptyFollowingTitle: string;
  emptyFollowersTitle: string;
  emptyFollowingLead: string;
  emptyFollowersLead: string;
  browseListings: string;
  companyProfile: string;
  sellerProfile: string;
  mutual: string;
  unfollow: string;
  openProfile: string;
}> = {
  fi: {
    loadError: "Seurattujen profiilien lataaminen epäonnistui. Yritä hetken kuluttua uudelleen.",
    removeError: "Seurannan poistaminen epäonnistui. Yritä uudelleen.",
    loading: "Ladataan seurattuja profiileja...",
    loginTitle: "Seuratut profiilit",
    loginLead: "Kirjaudu sisään nähdäksesi seuraamasi profiilit ja omat seuraajasi.",
    loginAction: "Kirjaudu sisään",
    eyebrow: "Profiilit",
    title: "Seuratut",
    lead: "Hallitse seuraamiasi myyjiä ja katso, ketkä seuraavat profiiliasi.",
    followingStat: "seurattua",
    followersStat: "seuraajaa",
    tabsLabel: "Seuratut profiilit",
    followingTab: "Seuratut profiilit",
    followersTab: "Seuraajasi",
    emptyFollowingTitle: "Et seuraa vielä profiileja",
    emptyFollowersTitle: "Sinulla ei ole vielä seuraajia",
    emptyFollowingLead: "Voit seurata kiinnostavia myyjiä suoraan heidän profiilisivultaan.",
    emptyFollowersLead: "Kun joku seuraa profiiliasi, näet hänet tässä listassa.",
    browseListings: "Selaa ilmoituksia",
    companyProfile: "Yritysprofiili",
    sellerProfile: "Myyjäprofiili",
    mutual: "Seuraat myös",
    unfollow: "Lopeta seuraaminen",
    openProfile: "Avaa profiili"
  },
  en: {
    loadError: "Followed profiles could not be loaded. Please try again shortly.",
    removeError: "Could not remove the follow. Please try again.",
    loading: "Loading followed profiles...",
    loginTitle: "Followed profiles",
    loginLead: "Log in to see the profiles you follow and your own followers.",
    loginAction: "Log in",
    eyebrow: "Profiles",
    title: "Following",
    lead: "Manage the sellers you follow and see who follows your profile.",
    followingStat: "following",
    followersStat: "followers",
    tabsLabel: "Followed profiles",
    followingTab: "Followed profiles",
    followersTab: "Your followers",
    emptyFollowingTitle: "You do not follow any profiles yet",
    emptyFollowersTitle: "You do not have followers yet",
    emptyFollowingLead: "You can follow interesting sellers directly from their profile page.",
    emptyFollowersLead: "When someone follows your profile, you will see them in this list.",
    browseListings: "Browse listings",
    companyProfile: "Company profile",
    sellerProfile: "Seller profile",
    mutual: "You also follow",
    unfollow: "Unfollow",
    openProfile: "Open profile"
  },
  sv: {
    loadError: "Det gick inte att ladda följda profiler. Försök igen om en stund.",
    removeError: "Det gick inte att sluta följa. Försök igen.",
    loading: "Laddar följda profiler...",
    loginTitle: "Följda profiler",
    loginLead: "Logga in för att se profilerna du följer och dina egna följare.",
    loginAction: "Logga in",
    eyebrow: "Profiler",
    title: "Följer",
    lead: "Hantera säljare du följer och se vilka som följer din profil.",
    followingStat: "följda",
    followersStat: "följare",
    tabsLabel: "Följda profiler",
    followingTab: "Följda profiler",
    followersTab: "Dina följare",
    emptyFollowingTitle: "Du följer inga profiler ännu",
    emptyFollowersTitle: "Du har inga följare ännu",
    emptyFollowingLead: "Du kan följa intressanta säljare direkt från deras profilsida.",
    emptyFollowersLead: "När någon följer din profil ser du personen i den här listan.",
    browseListings: "Bläddra bland annonser",
    companyProfile: "Företagsprofil",
    sellerProfile: "Säljarprofil",
    mutual: "Du följer också",
    unfollow: "Sluta följa",
    openProfile: "Öppna profil"
  },
  no: {
    loadError: "Kunne ikke laste fulgte profiler. Prøv igjen om litt.",
    removeError: "Kunne ikke slutte å følge. Prøv igjen.",
    loading: "Laster fulgte profiler...",
    loginTitle: "Fulgte profiler",
    loginLead: "Logg inn for å se profilene du følger og dine egne følgere.",
    loginAction: "Logg inn",
    eyebrow: "Profiler",
    title: "Følger",
    lead: "Administrer selgere du følger og se hvem som følger profilen din.",
    followingStat: "fulgte",
    followersStat: "følgere",
    tabsLabel: "Fulgte profiler",
    followingTab: "Fulgte profiler",
    followersTab: "Dine følgere",
    emptyFollowingTitle: "Du følger ingen profiler ennå",
    emptyFollowersTitle: "Du har ingen følgere ennå",
    emptyFollowingLead: "Du kan følge interessante selgere direkte fra profilsiden deres.",
    emptyFollowersLead: "Når noen følger profilen din, ser du dem i denne listen.",
    browseListings: "Bla gjennom annonser",
    companyProfile: "Bedriftsprofil",
    sellerProfile: "Selgerprofil",
    mutual: "Du følger også",
    unfollow: "Slutt å følge",
    openProfile: "Åpne profil"
  },
  et: {
    loadError: "Jälgitavate profiilide laadimine ebaõnnestus. Proovi hetke pärast uuesti.",
    removeError: "Jälgimise eemaldamine ebaõnnestus. Proovi uuesti.",
    loading: "Jälgitavate profiilide laadimine...",
    loginTitle: "Jälgitavad profiilid",
    loginLead: "Logi sisse, et näha profiile, mida jälgid, ja oma jälgijaid.",
    loginAction: "Logi sisse",
    eyebrow: "Profiilid",
    title: "Jälgitavad",
    lead: "Halda müüjaid, keda jälgid, ja vaata, kes sinu profiili jälgivad.",
    followingStat: "jälgitavat",
    followersStat: "jälgijat",
    tabsLabel: "Jälgitavad profiilid",
    followingTab: "Jälgitavad profiilid",
    followersTab: "Sinu jälgijad",
    emptyFollowingTitle: "Sa ei jälgi veel ühtegi profiili",
    emptyFollowersTitle: "Sul ei ole veel jälgijaid",
    emptyFollowingLead: "Saad huvitavaid müüjaid jälgida otse nende profiililehelt.",
    emptyFollowersLead: "Kui keegi sinu profiili jälgib, näed teda selles nimekirjas.",
    browseListings: "Sirvi kuulutusi",
    companyProfile: "Ettevõtte profiil",
    sellerProfile: "Müüja profiil",
    mutual: "Jälgid samuti",
    unfollow: "Lõpeta jälgimine",
    openProfile: "Ava profiil"
  }
};

function profileLocation(profile: ProfileFollowListItem) {
  return [profile.city, profile.country].filter(Boolean).join(", ");
}

function profileInitial(profile: ProfileFollowListItem) {
  return profile.display_name.trim().charAt(0).toUpperCase() || "?";
}

export default function FollowedProfilesPage() {
  const { locale } = useLanguage();
  const text = followedText[locale] ?? followedText.fi;
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<ProfileFollowListItem[]>([]);
  const [activeTab, setActiveTab] = useState<FollowedTab>("following");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");
    const { data, error } = await getMyProfileFollows();
    setRows(data);
    if (error) {
      setLoadError(text.loadError);
    }
    setLoading(false);
  }, [text.loadError, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function refresh() {
      void load();
    }

    window.addEventListener("profile-follow-changed", refresh);
    return () => window.removeEventListener("profile-follow-changed", refresh);
  }, [load]);

  const following = useMemo(
    () => rows.filter((row) => row.direction === "following"),
    [rows]
  );
  const followers = useMemo(
    () => rows.filter((row) => row.direction === "follower"),
    [rows]
  );
  const followingIds = useMemo(
    () => new Set(following.map((row) => row.profile_id)),
    [following]
  );
  const visibleProfiles = activeTab === "following" ? following : followers;

  async function handleUnfollow(profileId: string) {
    setRemovingId(profileId);
    const { error } = await unfollowProfile(profileId);
    if (!error) {
      setRows((current) =>
        current.filter((row) => !(row.direction === "following" && row.profile_id === profileId))
      );
      window.dispatchEvent(new CustomEvent("profile-follow-changed"));
    } else {
      setLoadError(text.removeError);
    }
    setRemovingId(null);
  }

  if (!authChecked || loading) {
    return (
      <main className="followed-page">
        <div className="followed-container">
          <div className="followed-loading">{text.loading}</div>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="followed-page">
        <div className="followed-container">
          <section className="followed-login">
            <Users size={30} />
            <h1>{text.loginTitle}</h1>
            <p>{text.loginLead}</p>
            <Link href="/auth">
              {text.loginAction}
              <ArrowRight size={16} />
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="followed-page">
      <div className="followed-container">
        <header className="followed-hero">
          <div className="followed-hero-main">
            <span className="followed-hero-icon">
              <Users size={25} />
            </span>
            <div>
              <span className="followed-eyebrow">{text.eyebrow}</span>
              <h1>{text.title}</h1>
              <p>{text.lead}</p>
            </div>
          </div>
          <div className="followed-hero-stats">
            <span>
              <Users size={18} />
              <strong>{following.length}</strong>
              <small>{text.followingStat}</small>
            </span>
            <span>
              <UserCheck size={18} />
              <strong>{followers.length}</strong>
              <small>{text.followersStat}</small>
            </span>
          </div>
        </header>

        <div className="followed-toolbar">
          <div className="followed-tabs" role="tablist" aria-label={text.tabsLabel}>
            <button
              type="button"
              className={activeTab === "following" ? "is-active" : ""}
              role="tab"
              aria-selected={activeTab === "following"}
              onClick={() => setActiveTab("following")}
            >
              {text.followingTab}
              <span>{following.length}</span>
            </button>
            <button
              type="button"
              className={activeTab === "followers" ? "is-active" : ""}
              role="tab"
              aria-selected={activeTab === "followers"}
              onClick={() => setActiveTab("followers")}
            >
              {text.followersTab}
              <span>{followers.length}</span>
            </button>
          </div>
        </div>

        {loadError && (
          <p className="followed-error">
            <AlertCircle size={17} />
            {loadError}
          </p>
        )}

        {visibleProfiles.length === 0 ? (
          <section className="followed-empty">
            <span className="followed-empty-icon">
              <Search size={36} />
            </span>
            <h2>{activeTab === "following" ? text.emptyFollowingTitle : text.emptyFollowersTitle}</h2>
            <p>
              {activeTab === "following"
                ? text.emptyFollowingLead
                : text.emptyFollowersLead}
            </p>
            {activeTab === "following" && (
              <Link href="/">
                {text.browseListings}
                <ArrowRight size={16} />
              </Link>
            )}
          </section>
        ) : (
          <div className="followed-grid">
            {visibleProfiles.map((profile) => (
              <article className="followed-card" key={`${profile.direction}:${profile.profile_id}`}>
                <Link className="followed-card-main" href={profilePath(profile.profile_id, profile.display_name, locale)}>
                  <span className="followed-avatar">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="" />
                    ) : (
                      <strong>{profileInitial(profile)}</strong>
                    )}
                  </span>
                  <span className="followed-card-copy">
                    <strong>{profile.display_name}</strong>
                    <small>
                      {profile.account_type === "company" ? <Building2 size={13} /> : <UserCheck size={13} />}
                      {profile.account_type === "company" ? text.companyProfile : text.sellerProfile}
                    </small>
                    {profileLocation(profile) && (
                      <small>
                        <MapPin size={13} />
                        {profileLocation(profile)}
                      </small>
                    )}
                  </span>
                </Link>

                <div className="followed-card-footer">
                  {activeTab === "followers" && followingIds.has(profile.profile_id) ? (
                    <span className="followed-mutual">
                      <UserCheck size={14} />
                      {text.mutual}
                    </span>
                  ) : (
                    <span />
                  )}
                  {activeTab === "following" ? (
                    <button
                      type="button"
                      disabled={removingId === profile.profile_id}
                      onClick={() => void handleUnfollow(profile.profile_id)}
                    >
                      <UserMinus size={15} />
                      {text.unfollow}
                    </button>
                  ) : (
                    <Link href={profilePath(profile.profile_id, profile.display_name, locale)}>
                      {text.openProfile}
                      <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
