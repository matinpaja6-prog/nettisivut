"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, Car, Home, LockKeyhole, MessageCircle, Plus, Search, SlidersHorizontal, UserRound, Wrench } from "lucide-react";
import {
  CHAT_NOTIFICATIONS_CHANGED_EVENT,
  getPendingPurchaseReviewRequests,
  getAlertNotifications,
  getGarageVehicles,
  getSafeAuthUser,
  getUnreadConversationSummaries,
  isConversationLastMessageUnread,
  markConversationRead,
  markNotificationsSeen,
  readChatLastRead,
  supabase,
  type AlertNotification,
  type ConversationSummary,
  type GarageVehicle,
  type PurchaseReviewRequest,
} from "@/lib/supabase";
import { useLanguage, type Locale } from "@/lib/i18n";
import { canonicalPathFromLocalized, listingPath, listingUrlId, pagePath, profileRootPath } from "@/lib/routes";

type BottomNavCopy = {
  primaryNavigation: string;
  home: string;
  notifications: string;
  createListing: string;
  messages: string;
  profile: string;
  login: string;
  filterParts: string;
  filter: string;
  garage: string;
  closeGarage: string;
  garageVehicleHint: string;
  garageEmptyHint: string;
  signIn: string;
  addVehicle: string;
  buyParts: string;
  sellPart: string;
  openGarage: string;
  contact: string;
  contactMaskines: string;
  followed: string;
};

const BOTTOM_NAV_COPY = {
  fi: {
    primaryNavigation: "Päänavigaatio",
    home: "Etusivu",
    notifications: "Ilmoitukset",
    createListing: "Luo ilmoitus",
    messages: "Viestit",
    profile: "Profiili",
    login: "Kirjaudu",
    filterParts: "Suodata varaosia",
    filter: "Suodata",
    garage: "Oma talli",
    closeGarage: "Sulje Oma talli",
    garageVehicleHint: "Valitse ajoneuvo ja jatka suoraan osiin",
    garageEmptyHint: "Lisää ajoneuvo, niin osat löytyvät nopeammin",
    signIn: "Kirjaudu sisään",
    addVehicle: "Lisää ajoneuvo",
    buyParts: "Osta osia",
    sellPart: "Myy osa",
    openGarage: "Avaa koko talli",
    contact: "Ota yhteyttä",
    contactMaskines: "Ota yhteyttä Maskinesiin",
    followed: "Seuratut",
  },
  en: {
    primaryNavigation: "Main navigation",
    home: "Home",
    notifications: "Notifications",
    createListing: "Create listing",
    messages: "Messages",
    profile: "Profile",
    login: "Log in",
    filterParts: "Filter spare parts",
    filter: "Filter",
    garage: "My garage",
    closeGarage: "Close My garage",
    garageVehicleHint: "Choose a vehicle and go straight to its parts",
    garageEmptyHint: "Add a vehicle to find parts faster",
    signIn: "Log in",
    addVehicle: "Add vehicle",
    buyParts: "Buy parts",
    sellPart: "Sell a part",
    openGarage: "Open full garage",
    contact: "Contact",
    contactMaskines: "Contact Maskines",
    followed: "Following",
  },
  sv: {
    primaryNavigation: "Huvudnavigering",
    home: "Hem",
    notifications: "Notiser",
    createListing: "Skapa annons",
    messages: "Meddelanden",
    profile: "Profil",
    login: "Logga in",
    filterParts: "Filtrera reservdelar",
    filter: "Filtrera",
    garage: "Mitt garage",
    closeGarage: "Stäng Mitt garage",
    garageVehicleHint: "Välj ett fordon och gå direkt till delarna",
    garageEmptyHint: "Lägg till ett fordon för att hitta delar snabbare",
    signIn: "Logga in",
    addVehicle: "Lägg till fordon",
    buyParts: "Köp delar",
    sellPart: "Sälj en del",
    openGarage: "Öppna hela garaget",
    contact: "Kontakta",
    contactMaskines: "Kontakta Maskines",
    followed: "Profiler du följer",
  },
  no: {
    primaryNavigation: "Hovednavigasjon",
    home: "Hjem",
    notifications: "Varsler",
    createListing: "Opprett annonse",
    messages: "Meldinger",
    profile: "Profil",
    login: "Logg inn",
    filterParts: "Filtrer reservedeler",
    filter: "Filtrer",
    garage: "Min garasje",
    closeGarage: "Lukk garasjen",
    garageVehicleHint: "Velg et kjøretøy og gå rett til delene",
    garageEmptyHint: "Legg til et kjøretøy, så finner du deler raskere",
    signIn: "Logg inn",
    addVehicle: "Legg til kjøretøy",
    buyParts: "Kjøp deler",
    sellPart: "Selg en del",
    openGarage: "Åpne hele garasjen",
    contact: "Kontakt",
    contactMaskines: "Kontakt Maskines",
    followed: "Profiler du følger",
  },
} satisfies Record<Locale, BottomNavCopy>;

const NUMBER_LOCALES = {
  fi: "fi-FI",
  en: "en-GB",
  sv: "sv-SE",
  no: "nb-NO",
} satisfies Record<Locale, string>;

const OPEN_CATEGORY_DRAWER_STORAGE_KEY = "maskinesOpenCategoryDrawer";
const OPEN_CATEGORY_DRAWER_STEP_STORAGE_KEY = "maskinesOpenCategoryDrawerStep";
const OPEN_HOME_FILTERS_STORAGE_KEY = "maskinesOpenHomeFilters";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, activeLocale } = useLanguage();
  const canonicalPathname = canonicalPathFromLocalized(pathname || "/");
  const authHref = pagePath("auth", activeLocale);
  const sellHref = pagePath("sell", activeLocale);
  const messagesHref = pagePath("messages", activeLocale);
  const profileHref = profileRootPath(activeLocale);
  const garageHref = pagePath("garage", activeLocale);
  const searchAlertsHref = pagePath("search-alerts", activeLocale);
  const [notifCount, setNotifCount] = useState(0);
  const [reviewRequests, setReviewRequests] = useState<PurchaseReviewRequest[]>([]);
  const [alertNotifs, setAlertNotifs] = useState<AlertNotification[]>([]);
  const [unreadConvs, setUnreadConvs] = useState<ConversationSummary[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [garageVehicles, setGarageVehicles] = useState<GarageVehicle[]>([]);
  const [pageModalOpen, setPageModalOpen] = useState(false);
  const sellActionHref =
    userId
      ? sellHref
      : `${authHref}?mode=login&next=${encodeURIComponent(sellHref)}&reason=sell`;

  useEffect(() => {
    const updateModalState = () => {
      setPageModalOpen(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')));
    };

    updateModalState();
    const observer = new MutationObserver(updateModalState);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const closeTransientPanels = () => {
      setNotifOpen(false);
      setGarageOpen(false);
    };

    closeTransientPanels();
    window.addEventListener("pageshow", closeTransientPanels);

    return () => window.removeEventListener("pageshow", closeTransientPanels);
  }, [canonicalPathname]);

  useEffect(() => {
    const syncProfileMenuState = (event: Event) => {
      setProfileOpen(Boolean((event as CustomEvent<boolean>).detail));
    };

    window.addEventListener("maskines:profile-menu-state", syncProfileMenuState);
    return () => window.removeEventListener("maskines:profile-menu-state", syncProfileMenuState);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }

    getSafeAuthUser()
      .then((user) => {
        setUserId(user?.id ?? null);
        setAuthChecked(true);
      })
      .catch(() => {
        setUserId(null);
        setAuthChecked(true);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
      if (!session?.user) {
        setNotifOpen(false);
        setGarageOpen(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setGarageVehicles([]);
      return;
    }

    let cancelled = false;
    getGarageVehicles(userId)
      .then(({ data }) => {
        if (!cancelled) setGarageVehicles(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setGarageVehicles([]);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const fetchNotifs = async () => {
      const [{ data: reviews }, { data: alerts }] = await Promise.all([
        getPendingPurchaseReviewRequests(userId),
        getAlertNotifications(userId)
      ]);
      if (cancelled) return;
      setReviewRequests(reviews ?? []);
      setAlertNotifs(alerts ?? []);
      setNotifCount((reviews?.length ?? 0) + (alerts?.filter((a) => !a.seen).length ?? 0));
    };
    fetchNotifs();

    function onDismissed(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      setReviewRequests((prev) => prev.filter((r) => r.id !== id));
    }
    window.addEventListener("review-request-dismissed", onDismissed);
    const alertsChannel = supabase
      ?.channel(`bn-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alert_notifications", filter: `user_id=eq.${userId}` },
        fetchNotifs
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchase_review_requests", filter: `buyer_id=eq.${userId}` },
        fetchNotifs
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener("review-request-dismissed", onDismissed);
      if (alertsChannel) {
        supabase?.removeChannel(alertsChannel);
      }
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const refreshUnreadMessages = async () => {
      const { data } = await getUnreadConversationSummaries(userId);
      if (cancelled) return;

      const lastRead = readChatLastRead();
      const unread = (data ?? []).filter((conversation) =>
        isConversationLastMessageUnread(
          conversation,
          userId,
          lastRead
        )
      );

      setUnreadConvs(unread);
    };

    refreshUnreadMessages();

    const ch = supabase
      ?.channel(`bn-msg-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${userId}` }, refreshUnreadMessages)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `sender_id=eq.${userId}` }, refreshUnreadMessages)
      .subscribe();

    window.addEventListener(
      CHAT_NOTIFICATIONS_CHANGED_EVENT,
      refreshUnreadMessages
    );
    window.addEventListener(
      "storage",
      refreshUnreadMessages
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        CHAT_NOTIFICATIONS_CHANGED_EVENT,
        refreshUnreadMessages
      );
      window.removeEventListener(
        "storage",
        refreshUnreadMessages
      );
      if (ch) {
        supabase?.removeChannel(ch);
      }
    };
  }, [userId]);

  const copy = BOTTOM_NAV_COPY[locale];

  const buildVehicleSellHref = (vehicle: GarageVehicle) => {
    const vehicleType = vehicle.vehicle_class === "Auto"
      ? "Motocross"
      : vehicle.vehicle_class || "Moottorikelkka";
    const params = new URLSearchParams({
      make: vehicle.make,
      model: vehicle.model,
      year: String(vehicle.year ?? ""),
      vehicleType,
    });
    return `${sellHref}?${params.toString()}`;
  };

  const buildVehicleBuyHref = (vehicle: GarageVehicle) => {
    const params = new URLSearchParams({
      garageMake: vehicle.make,
      garageModel: vehicle.model,
      garageYear: String(vehicle.year ?? ""),
    });
    return `/?${params.toString()}`;
  };

  const openCategorySearch = () => {
    setNotifOpen(false);
    setGarageOpen(false);

    if (canonicalPathname.startsWith("/seller/") || canonicalPathname.startsWith("/profile/")) {
      window.dispatchEvent(new CustomEvent("seller-profile-open-filters"));
      return;
    }

    if (canonicalPathname === "/") {
      window.dispatchEvent(new CustomEvent("maskines-open-home-filters"));
      return;
    }

    try {
      sessionStorage.setItem(OPEN_HOME_FILTERS_STORAGE_KEY, "1");
      sessionStorage.removeItem(OPEN_CATEGORY_DRAWER_STORAGE_KEY);
      sessionStorage.removeItem(OPEN_CATEGORY_DRAWER_STEP_STORAGE_KEY);
    } catch {
      /* ok */
    }

    router.push("/");
  };

  function markConversationNotificationRead(conversation: ConversationSummary) {
    if (!userId) return;

    const lastMessageAt =
      conversation.last_message?.created_at
        ? new Date(conversation.last_message.created_at).getTime() + 1
        : Date.now();

    void markConversationRead(
      conversation.id,
      userId,
      Math.max(Date.now(), lastMessageAt)
    );
    setUnreadConvs((current) =>
      current.filter((item) =>
        item.id !== conversation.id
      )
    );
  }

  const goToLogin = () => {
    setNotifOpen(false);
    setGarageOpen(false);
    router.push(`${authHref}?mode=login`);
  };

  const toggleProfileMenu = () => {
    setNotifOpen(false);
    setGarageOpen(false);
    window.dispatchEvent(new Event("maskines:toggle-profile-menu"));
  };

  // Authentication uses full-screen cards and bottom sheets. Keep the mobile
  // navigation out of every auth state so it cannot cover PIN, MFA or password
  // reset controls.
  if (canonicalPathname === "/auth" || pageModalOpen || !authChecked) {
    return null;
  }

  if (!userId) {
    return (
      <nav
        id="maskines-bottom-nav-stable"
        className="bottom-nav bottom-nav-main bottom-nav-guest"
        data-device-bottom-nav="true"
        aria-label={copy.primaryNavigation}
        data-no-auto-translate
        translate="no"
      >
        <Link href="/" className={`bottom-nav-item${canonicalPathname === "/" && !profileOpen ? " active" : ""}`}>
          <span className="bottom-nav-icon"><Home size={22} /></span>
          <span className="bottom-nav-label">{copy.home}</span>
        </Link>

        <button
          type="button"
          className="bottom-nav-item bottom-nav-center-action"
          onClick={goToLogin}
          aria-label={copy.login}
        >
          <span className="bottom-nav-icon"><LockKeyhole size={24} /></span>
          <span className="bottom-nav-label">{copy.login}</span>
        </button>

        <button
          type="button"
          className="bottom-nav-item bottom-nav-search-action"
          onClick={openCategorySearch}
          aria-label={copy.filterParts}
        >
          <span className="bottom-nav-icon"><SlidersHorizontal size={22} /></span>
          <span className="bottom-nav-label">{copy.filter}</span>
        </button>
      </nav>
    );
  }

  return (
    <>
      <nav
        id="maskines-bottom-nav-stable"
        className="bottom-nav bottom-nav-main"
        data-device-bottom-nav="true"
        aria-label={copy.primaryNavigation}
        data-no-auto-translate
        translate="no"
      >
        <Link href="/" className={`bottom-nav-item${canonicalPathname === "/" && !profileOpen ? " active" : ""}`}>
          <span className="bottom-nav-icon"><Home size={22} /></span>
          <span className="bottom-nav-label">{copy.home}</span>
        </Link>

        <button
          type="button"
          className="bottom-nav-item bottom-nav-search-action"
          onClick={openCategorySearch}
          aria-label={copy.filterParts}
        >
          <span className="bottom-nav-icon"><SlidersHorizontal size={22} /></span>
          <span className="bottom-nav-label">{copy.filter}</span>
        </button>

        <Link href={sellActionHref} className={`bottom-nav-item bottom-nav-center-action${canonicalPathname.startsWith("/sell") ? " active" : ""}`} aria-label={copy.createListing}>
          <span className="bottom-nav-icon"><Plus size={24} /></span>
          <span className="bottom-nav-label">{userId ? copy.createListing : copy.login}</span>
        </Link>

        {userId ? (
        <Link href={messagesHref} className={`bottom-nav-item${canonicalPathname.startsWith("/messages") ? " active" : ""}`}>
          <span className="bottom-nav-icon">
            <MessageCircle size={22} />
          </span>
          <span className="bottom-nav-label">{copy.messages}</span>
        </Link>
        ) : (
        <button type="button" className="bottom-nav-item" onClick={goToLogin} aria-label={copy.login}>
          <span className="bottom-nav-icon"><LockKeyhole size={22} /></span>
          <span className="bottom-nav-label">{copy.login}</span>
        </button>
        )}

        <button
          type="button"
          className={`bottom-nav-item${profileOpen || canonicalPathname.startsWith("/profile") ? " active" : ""}`}
          aria-label={copy.profile}
          aria-expanded={profileOpen}
          data-profile-menu-toggle="true"
          onClick={toggleProfileMenu}
        >
          <span className="bottom-nav-icon"><UserRound size={22} /></span>
          <span className="bottom-nav-label">{copy.profile}</span>
        </button>
      </nav>

      <nav
        className="bottom-nav"
        aria-label={copy.primaryNavigation}
        data-no-auto-translate
        translate="no"
      >
        <Link href="/" className={`bottom-nav-item${canonicalPathname === "/" && !profileOpen ? " active" : ""}`}>
          <span className="bottom-nav-icon"><Home size={22} /></span>
          <span className="bottom-nav-label">{copy.home}</span>
        </Link>

        <button type="button" className={`bottom-nav-item${notifOpen ? " active" : ""}`} onClick={() => {
          if (!userId) {
            goToLogin();
            return;
          }
          setNotifOpen(true);
          if (userId) {
            unreadConvs.forEach(markConversationNotificationRead);
            markNotificationsSeen(userId).then(() => {
              setAlertNotifs((prev) => prev.map((a) => ({ ...a, seen: true })));
              setNotifCount(reviewRequests.length);
            });
          }
        }}>
          <span className="bottom-nav-icon">
            <Bell size={22} />
            {notifCount > 0 && <span className="bottom-nav-badge">{notifCount > 9 ? "9+" : notifCount}</span>}
          </span>
          <span className="bottom-nav-label">{copy.notifications}</span>
        </button>

        <Link href={sellActionHref} className={`bottom-nav-item bottom-nav-solid${canonicalPathname.startsWith("/sell") ? " active" : ""}`}>
          <span className="bottom-nav-icon"><Plus size={24} /></span>
          <span className="bottom-nav-label">{userId ? copy.createListing : copy.login}</span>
        </Link>

        {userId ? (
        <Link href={messagesHref} className={`bottom-nav-item${canonicalPathname.startsWith("/messages") ? " active" : ""}`}>
          <span className="bottom-nav-icon">
            <MessageCircle size={22} />
          </span>
          <span className="bottom-nav-label">{copy.contact}</span>
        </Link>
        ) : (
        <button type="button" className="bottom-nav-item" onClick={goToLogin} aria-label={copy.login}>
          <span className="bottom-nav-icon"><LockKeyhole size={22} /></span>
          <span className="bottom-nav-label">{copy.login}</span>
        </button>
        )}

        <Link
          href={profileHref}
          className={`bottom-nav-item${canonicalPathname.startsWith("/profile") ? " active" : ""}`}
          aria-label={copy.profile}
        >
          <span className="bottom-nav-icon"><UserRound size={22} /></span>
          <span className="bottom-nav-label">{copy.profile}</span>
        </Link>
      </nav>

      {garageOpen && (
        <>
          <button
            type="button"
            className="bn-garage-outside-close"
            aria-label={copy.closeGarage}
            data-no-auto-translate
            translate="no"
            onClick={() => setGarageOpen(false)}
          />
          <div
            className="bn-garage-panel"
            role="dialog"
            aria-label={copy.garage}
            data-no-auto-translate
            translate="no"
          >
            <div className="bn-garage-header">
              <div>
                <strong>{copy.garage}</strong>
                <span>{garageVehicles.length ? copy.garageVehicleHint : copy.garageEmptyHint}</span>
              </div>
              <button
                type="button"
                className="bn-garage-close"
                aria-label={copy.closeGarage}
                onClick={() => setGarageOpen(false)}
              >
                X
              </button>
            </div>

            {!userId ? (
              <Link href={authHref} className="bn-garage-empty-action" onClick={() => setGarageOpen(false)}>
                <LockKeyhole size={18} />
                {copy.signIn}
              </Link>
            ) : garageVehicles.length === 0 ? (
              <Link href={garageHref} className="bn-garage-empty-action" onClick={() => setGarageOpen(false)}>
                <Plus size={18} />
                {copy.addVehicle}
              </Link>
            ) : (
              <div className="bn-garage-list">
                {garageVehicles.slice(0, 4).map((vehicle) => (
                  <div key={vehicle.id} className="bn-garage-vehicle">
                    <Link href={garageHref} className="bn-garage-main" onClick={() => setGarageOpen(false)}>
                      <Car size={18} />
                      <span>
                        <strong>{vehicle.make} {vehicle.model}</strong>
                        <small>{vehicle.year}</small>
                      </span>
                    </Link>
                    <div className="bn-garage-actions">
                      <Link href={buildVehicleBuyHref(vehicle)} onClick={() => setGarageOpen(false)}>
                        <Search size={15} />
                        {copy.buyParts}
                      </Link>
                      <Link href={buildVehicleSellHref(vehicle)} onClick={() => setGarageOpen(false)}>
                        <Wrench size={15} />
                        {copy.sellPart}
                      </Link>
                    </div>
                  </div>
                ))}
                <Link href={garageHref} className="bn-garage-all" onClick={() => setGarageOpen(false)}>
                  {copy.openGarage}
                </Link>
              </div>
            )}
          </div>
        </>
      )}

      {notifOpen && (
        <div className="bn-notif-backdrop" onClick={() => setNotifOpen(false)}>
          <div className="bn-notif-panel" onClick={(e) => e.stopPropagation()}>
            <div className="bn-notif-header" data-no-auto-translate translate="no">
              <strong>{t.notifications}</strong>
              <button type="button" className="bn-notif-close" onClick={() => setNotifOpen(false)}>✕</button>
            </div>

            {reviewRequests.length === 0 && alertNotifs.filter((a) => !a.seen).length === 0 && unreadConvs.length === 0 && (
              <p className="bn-notif-empty" data-no-auto-translate translate="no">{t.noNotifications}</p>
            )}

            {unreadConvs.length > 0 && (
              <>
                <div className="bn-notif-group-label" data-no-auto-translate translate="no">{t.messages}</div>
                {unreadConvs.slice(0, 5).map((c) => {
                  const other = c.other_profile;
                  const name = other?.full_name || other?.name || `${other?.first_name ?? ""} ${other?.last_name ?? ""}`.trim() || "–";
                  return (
                    <Link
                      key={c.id}
                      href={`${messagesHref}/${c.listing_id}?conversation=${c.id}`}
                      className="bn-notif-item"
                      onClick={() => {
                        markConversationNotificationRead(c);
                        setUnreadConvs((prev) => prev.filter((item) => item.id !== c.id));
                        setNotifOpen(false);
                      }}
                    >
                      <span className="bn-notif-icon"><MessageCircle size={14} /></span>
                      <div>
                        <strong>{name}</strong>
                        <p>{c.last_message?.content?.slice(0, 60) ?? ""}</p>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}

            {reviewRequests.length > 0 && (
              <>
                <div className="bn-notif-group-label" data-no-auto-translate translate="no">{t.reviews}</div>
                {[...new Map(reviewRequests.map(r => [r.listing_id ?? r.id, r])).values()].slice(0, 4).map((r) => (
                  <button key={r.id} type="button" className="bn-notif-item"
                    onClick={() => { window.dispatchEvent(new CustomEvent("open-purchase-review", { detail: { requestId: r.id } })); setNotifOpen(false); }}>
                    <span className="bn-notif-icon">★</span>
                    <div>
                      <strong data-no-auto-translate translate="no">{t.reviewSeller}</strong>
                      <p>{r.listing_title}</p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {alertNotifs.filter((a) => !a.seen).length > 0 && (
              <>
                <div className="bn-notif-group-label" data-no-auto-translate translate="no">{t.saTitle}</div>
                {alertNotifs.filter((a) => !a.seen).slice(0, 6).map((n) => (
                  <Link key={n.id} href={listingPath(n, activeLocale)} className="bn-notif-item" onClick={() => setNotifOpen(false)}>
                    <span className="bn-notif-icon"><Bell size={14} /></span>
                    <div>
                      <strong>{n.listing_title}</strong>
                      <p>{n.listing_price ? `${n.listing_price.toLocaleString(NUMBER_LOCALES[locale])} €` : ""} · {n.alert_label}</p>
                    </div>
                  </Link>
                ))}
              </>
            )}

            <div className="bn-notif-footer" data-no-auto-translate translate="no">
              <Link href={searchAlertsHref} className="bn-notif-all" onClick={() => setNotifOpen(false)}>{t.saTitle} →</Link>
              <Link href={messagesHref} className="bn-notif-all" onClick={() => setNotifOpen(false)}>{t.messages} →</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
