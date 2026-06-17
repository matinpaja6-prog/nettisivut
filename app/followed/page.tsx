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
import { profilePath } from "@/lib/routes";

type FollowedTab = "following" | "followers";

function profileLocation(profile: ProfileFollowListItem) {
  return [profile.city, profile.country].filter(Boolean).join(", ");
}

function profileInitial(profile: ProfileFollowListItem) {
  return profile.display_name.trim().charAt(0).toUpperCase() || "?";
}

export default function FollowedProfilesPage() {
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
      setLoadError("Seurattujen profiilien lataaminen epäonnistui. Yritä hetken kuluttua uudelleen.");
    }
    setLoading(false);
  }, [userId]);

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
      setLoadError("Seurannan poistaminen epäonnistui. Yritä uudelleen.");
    }
    setRemovingId(null);
  }

  if (!authChecked || loading) {
    return (
      <main className="followed-page">
        <div className="followed-container">
          <div className="followed-loading">Ladataan seurattuja profiileja...</div>
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
            <h1>Seuratut profiilit</h1>
            <p>Kirjaudu sisään nähdäksesi seuraamasi profiilit ja omat seuraajasi.</p>
            <Link href="/auth">
              Kirjaudu sisään
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
              <span className="followed-eyebrow">Profiilit</span>
              <h1>Seuratut</h1>
              <p>Hallitse seuraamiasi myyjiä ja katso, ketkä seuraavat profiiliasi.</p>
            </div>
          </div>
          <div className="followed-hero-stats">
            <span>
              <Users size={18} />
              <strong>{following.length}</strong>
              <small>seurattua</small>
            </span>
            <span>
              <UserCheck size={18} />
              <strong>{followers.length}</strong>
              <small>seuraajaa</small>
            </span>
          </div>
        </header>

        <div className="followed-toolbar">
          <div className="followed-tabs" role="tablist" aria-label="Seuratut profiilit">
            <button
              type="button"
              className={activeTab === "following" ? "is-active" : ""}
              role="tab"
              aria-selected={activeTab === "following"}
              onClick={() => setActiveTab("following")}
            >
              Seuratut profiilit
              <span>{following.length}</span>
            </button>
            <button
              type="button"
              className={activeTab === "followers" ? "is-active" : ""}
              role="tab"
              aria-selected={activeTab === "followers"}
              onClick={() => setActiveTab("followers")}
            >
              Seuraajasi
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
            <h2>{activeTab === "following" ? "Et seuraa vielä profiileja" : "Sinulla ei ole vielä seuraajia"}</h2>
            <p>
              {activeTab === "following"
                ? "Voit seurata kiinnostavia myyjiä suoraan heidän profiilisivultaan."
                : "Kun joku seuraa profiiliasi, näet hänet tässä listassa."}
            </p>
            {activeTab === "following" && (
              <Link href="/">
                Selaa ilmoituksia
                <ArrowRight size={16} />
              </Link>
            )}
          </section>
        ) : (
          <div className="followed-grid">
            {visibleProfiles.map((profile) => (
              <article className="followed-card" key={`${profile.direction}:${profile.profile_id}`}>
                <Link className="followed-card-main" href={profilePath(profile.profile_id, profile.display_name)}>
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
                      {profile.account_type === "company" ? "Yritysprofiili" : "Myyjäprofiili"}
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
                      Seuraat myös
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
                      Lopeta seuraaminen
                    </button>
                  ) : (
                    <Link href={profilePath(profile.profile_id, profile.display_name)}>
                      Avaa profiili
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
