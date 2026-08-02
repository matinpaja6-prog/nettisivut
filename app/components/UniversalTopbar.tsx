"use client";

import { Award, Bell, Car, ChevronDown, ChevronRight, ClipboardList, DoorOpen, Heart, Home, LockKeyhole, Mail, Menu, MessageCircle, Search, Settings, Star, UserRound, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import {
  CHAT_NOTIFICATIONS_CHANGED_EVENT,
  PROFILE_AVATAR_CHANGED_EVENT,
  deleteAlertNotification,
  dismissPurchaseReviewRequest,
  getAlertNotifications,
  getCurrentUserIsAdmin,
  getSafeAuthUser,
  getUnreadConversationSummaries,
  getPublicSellerLevelStats,
  getPendingPurchaseReviewRequests,
  isConversationLastMessageUnread,
  markConversationRead,
  markNotificationsSeen,
  markPurchaseReviewRequestsSeen,
  readChatLastRead,
  supabase,
  type AlertNotification,
  type ConversationSummary,
  type ProfileAvatarChangedDetail,
  type PurchaseReviewRequest,
  type SellerLevelStats,
} from "@/lib/supabase";
import { calculateSellerLevel } from "@/lib/seller-level";
import { goBackOrFallback } from "@/lib/go-back";
import { useLanguage, type Locale } from "@/lib/i18n";
import { canonicalPathFromLocalized, listingPath, listingUrlId, pagePath, profilePath, profileRootPath } from "@/lib/routes";
import { useTaxonomy } from "./TaxonomyProvider";
import LanguageSwitcher from "./LanguageSwitcher";

const SEEN_TOPBAR_NOTIFICATIONS_STORAGE_KEY = "universalTopbarSeenNotifications";
const NOTIFICATION_REFRESH_DEBOUNCE_MS = 120;
const OPEN_CATEGORY_DRAWER_STORAGE_KEY = "maskinesOpenCategoryDrawer";
const OPEN_CATEGORY_DRAWER_STEP_STORAGE_KEY = "maskinesOpenCategoryDrawerStep";
const HOME_RESET_SESSION_STORAGE_KEYS = [
  "home_return_state_v1",
  "home_return_pending_v1",
  "maskinesOpenHomeFilters",
  OPEN_CATEGORY_DRAWER_STORAGE_KEY,
  OPEN_CATEGORY_DRAWER_STEP_STORAGE_KEY
];
type TopbarDropdownKey = "parts" | "brands" | "models" | null;

const TOPBAR_MODEL_GROUPS = [
  {
    vehicleType: "Moottorikelkka",
    label: "Moottorikelkat",
    brands: [
      { brand: "Lynx", models: ["Rave", "Xtrim", "Adventure", "Xterrain", "Boondocker", "Shredder"] },
      { brand: "Ski-Doo", models: ["MXZ", "Renegade", "Summit", "Backcountry", "Freeride"] },
      { brand: "Polaris", models: ["Indy", "Rush", "Switchback", "RMK", "Khaos", "Assault"] },
      { brand: "Arctic Cat", models: ["ZR", "M", "Riot", "Norseman", "Crossfire"] }
    ]
  },
  {
    vehicleType: "Mönkijä",
    label: "Mönkijät",
    brands: [
      { brand: "Can-Am", models: ["Outlander", "Renegade", "Commander", "Maverick"] },
      { brand: "Polaris", models: ["Sportsman", "Scrambler", "Ranger", "RZR"] },
      { brand: "Yamaha", models: ["Raptor 700", "YFM700R", "Grizzly", "Kodiak", "YFZ450R"] },
      { brand: "Honda", models: ["TRX", "FourTrax", "Foreman", "Rincon"] },
      { brand: "CFMOTO", models: ["CForce", "UForce", "ZForce"] }
    ]
  },
  {
    vehicleType: "Motocross",
    label: "Motocross",
    brands: [
      { brand: "KTM", models: ["SX", "SX-F", "EXC", "EXC-F"] },
      { brand: "Yamaha", models: ["YZ125", "YZ250", "YZ250F", "YZ450F", "WR450F"] },
      { brand: "Honda", models: ["CRF250R", "CRF450R", "CRF250X", "CRF450X"] },
      { brand: "Kawasaki", models: ["KX250", "KX450", "KX250F", "KX450F"] },
      { brand: "Husqvarna", models: ["TC", "FC", "TE", "FE"] },
      { brand: "GasGas", models: ["MC", "MC-F", "EC", "EC-F"] }
    ]
  },
  {
    vehicleType: "Mopo",
    label: "Mopot",
    brands: [
      { brand: "Yamaha", models: ["BWS Naked", "BWS Original", "Zuma", "BWS Next Generation", "BWS 10", "BWS 12", "Aerox", "DT", "Slider", "Neos"] },
      { brand: "Derbi", models: ["Senda", "DRD", "Xtreme", "Racing"] },
      { brand: "Rieju", models: ["MRT", "RR", "SMX", "MRX"] },
      { brand: "Aprilia", models: ["SR", "RX", "SX", "RS"] },
      { brand: "Beta", models: ["RR", "Ark", "Track"] },
      { brand: "MBK", models: ["Booster Naked", "Booster Spirit 10", "Booster Spirit 12", "Booster Next Generation", "Nitro", "Stunt", "X-Limit"] }
    ]
  }
] as const;

function getAuthUserDisplayName(user: User | null) {
  if (!user) return "";

  const metadata = user.user_metadata ?? {};
  const firstAndLastName =
    `${String(metadata.first_name ?? "")} ${String(metadata.last_name ?? "")}`.trim();

  return [
    metadata.company_name,
    firstAndLastName,
    metadata.full_name,
    metadata.name
  ]
    .map((value) => String(value ?? "").trim())
    .find((value) => value && value.toLowerCase() !== user.email?.toLowerCase()) ?? "";
}

type TopbarProfile = {
  avatar_url: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  name: string | null;
  company_name: string | null;
};

async function getTopbarProfile(userId: string): Promise<TopbarProfile | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_url,first_name,last_name,full_name,name,company_name")
      .eq("id", userId)
      .maybeSingle<TopbarProfile>();

    return error ? null : data;
  } catch {
    return null;
  }
}

function getTopbarProfileDisplayName(
  profile: TopbarProfile | null,
  fallbackEmail?: string | null,
  fallbackName?: string | null
) {
  const firstAndLastName =
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();

  return [
    profile?.company_name,
    firstAndLastName,
    profile?.full_name,
    profile?.name,
    fallbackName
  ]
    .map((value) => String(value ?? "").trim())
    .find((value) => value && value.toLowerCase() !== fallbackEmail?.toLowerCase())
    || fallbackEmail
    || "";
}

const emptySellerLevelStats: SellerLevelStats = {
  listings_created: 0,
  single_listings_created: 0,
  multi_listings_created: 0,
  sold_count: 0,
  reviews_given: 0,
  reviews_received: 0,
  phone_verified: false
};

const topbarText: Record<Locale, {
  home: string;
  garage: string;
  searchAlerts: string;
  about: string;
  help: string;
  resetHome: string;
  back: string;
  brandHome: string;
  primaryNavigation: string;
  closeProfileMenu: string;
  openProfileMenu: string;
  advancedPartsSearch: string;
  ownProfile: string;
  fallbackProfile: string;
  sellerLevel: string;
  level: string;
  maxLevel: string;
  xpToNextLevel: (xp: number) => string;
  quickActions: string;
  notificationsHelp: string;
  markAllRead: string;
  defaultUser: string;
  delete: string;
  deleteNotification: string;
  settings: string;
  showAllMessages: string;
  manageAccount: string;
  followed: string;
  searchAlert: string;
  minutesAgo: (minutes: number) => string;
  hoursAgo: (hours: number) => string;
  daysAgo: (days: number) => string;
}> = {
  fi: {
    home: "Etusivu",
    garage: "Oma talli",
    searchAlerts: "Hakuvahti",
    about: "Tietoa meistä",
    help: "Ohjeet",
    resetHome: "Maskines – nollaa etusivu",
    back: "Takaisin edelliselle sivulle",
    brandHome: "Maskines – etusivulle",
    primaryNavigation: "Päänavigaatio",
    closeProfileMenu: "Sulje profiilivalikko",
    openProfileMenu: "Avaa profiilivalikko",
    advancedPartsSearch: "Avaa tarkempi varaosahaku",
    ownProfile: "Oma profiili",
    fallbackProfile: "Profiili",
    sellerLevel: "Myyjälevel",
    level: "Taso",
    maxLevel: "Maksimitaso",
    xpToNextLevel: (xp) => `${xp} XP seuraavaan tasoon`,
    quickActions: "Pikatoiminnot",
    notificationsHelp: "Pysy ajan tasalla tärkeistä viesteistä.",
    markAllRead: "Merkitse kaikki luetuiksi",
    defaultUser: "Käyttäjä",
    delete: "Poista",
    deleteNotification: "Poista ilmoitus",
    settings: "Asetukset",
    showAllMessages: "Näytä kaikki viestit",
    manageAccount: "Hallinnoi tiliäsi",
    followed: "Seuratut",
    searchAlert: "Hakuvahti",
    minutesAgo: (minutes) => `${minutes} min sitten`,
    hoursAgo: (hours) => `${hours} h sitten`,
    daysAgo: (days) => `${days} pv sitten`
  },
  en: {
    home: "Home",
    garage: "My garage",
    searchAlerts: "Search alerts",
    about: "About us",
    help: "Help",
    resetHome: "Maskines – reset homepage",
    back: "Back to the previous page",
    brandHome: "Maskines – go to homepage",
    primaryNavigation: "Main navigation",
    closeProfileMenu: "Close profile menu",
    openProfileMenu: "Open profile menu",
    advancedPartsSearch: "Open advanced parts search",
    ownProfile: "My profile",
    fallbackProfile: "Profile",
    sellerLevel: "Seller level",
    level: "Level",
    maxLevel: "Max level",
    xpToNextLevel: (xp) => `${xp} XP to next level`,
    quickActions: "Quick actions",
    notificationsHelp: "Stay up to date with important messages.",
    markAllRead: "Mark all as read",
    defaultUser: "User",
    delete: "Delete",
    deleteNotification: "Delete notification",
    settings: "Page settings",
    showAllMessages: "Show all messages",
    manageAccount: "Manage your account",
    followed: "Following",
    searchAlert: "Search alert",
    minutesAgo: (minutes) => `${minutes} min ago`,
    hoursAgo: (hours) => `${hours} h ago`,
    daysAgo: (days) => `${days} d ago`
  },
  sv: {
    home: "Startsida",
    garage: "Mitt garage",
    searchAlerts: "Sökbevakningar",
    about: "Om oss",
    help: "Hjälp",
    resetHome: "Maskines – återställ startsidan",
    back: "Tillbaka till föregående sida",
    brandHome: "Maskines – gå till startsidan",
    primaryNavigation: "Huvudnavigering",
    closeProfileMenu: "Stäng profilmenyn",
    openProfileMenu: "Öppna profilmenyn",
    advancedPartsSearch: "Öppna detaljerad reservdelssökning",
    ownProfile: "Min profil",
    fallbackProfile: "Profil",
    sellerLevel: "Säljarnivå",
    level: "Nivå",
    maxLevel: "Maxnivå",
    xpToNextLevel: (xp) => `${xp} XP till nästa nivå`,
    quickActions: "Snabbåtgärder",
    notificationsHelp: "Håll dig uppdaterad om viktiga meddelanden.",
    markAllRead: "Markera alla som lästa",
    defaultUser: "Användare",
    delete: "Ta bort",
    deleteNotification: "Ta bort avisering",
    settings: "Sidinställningar",
    showAllMessages: "Visa alla meddelanden",
    manageAccount: "Hantera ditt konto",
    followed: "Följer",
    searchAlert: "Sökbevakning",
    minutesAgo: (minutes) => `${minutes} min sedan`,
    hoursAgo: (hours) => `${hours} h sedan`,
    daysAgo: (days) => `${days} d sedan`
  },
  no: {
    home: "Hjem",
    garage: "Min garasje",
    searchAlerts: "Søkevarsler",
    about: "Om oss",
    help: "Hjelp",
    resetHome: "Maskines – tilbakestill startsiden",
    back: "Tilbake til forrige side",
    brandHome: "Maskines – gå til startsiden",
    primaryNavigation: "Hovednavigasjon",
    closeProfileMenu: "Lukk profilmenyen",
    openProfileMenu: "Åpne profilmenyen",
    advancedPartsSearch: "Åpne avansert delesøk",
    ownProfile: "Min profil",
    fallbackProfile: "Profil",
    sellerLevel: "Selgernivå",
    level: "Nivå",
    maxLevel: "Maksnivå",
    xpToNextLevel: (xp) => `${xp} XP til neste nivå`,
    quickActions: "Hurtighandlinger",
    notificationsHelp: "Hold deg oppdatert på viktige meldinger.",
    markAllRead: "Merk alle som lest",
    defaultUser: "Bruker",
    delete: "Fjern",
    deleteNotification: "Fjern varsel",
    settings: "Sideinnstillinger",
    showAllMessages: "Vis alle meldinger",
    manageAccount: "Administrer kontoen din",
    followed: "Følger",
    searchAlert: "Søkevarsel",
    minutesAgo: (minutes) => `${minutes} min siden`,
    hoursAgo: (hours) => `${hours} t siden`,
    daysAgo: (days) => `${days} d siden`
  },
};

function TopbarMaskinesLogo() {
  return (
    <Image
      className="universal-home-brand-logo"
      src="/maskines-share-logo.png"
      alt="Maskines"
      width={96}
      height={96}
      sizes="96px"
      priority
    />
  );
}

function BackChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="universal-page-back-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.2"
      />
    </svg>
  );
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function UniversalTopbar() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  // usePathname is reactive during client-side navigation. Reading
  // window.location here can still return the previous URL in the render that
  // follows router.push, leaving the old navigation item highlighted.
  const canonicalPathname = canonicalPathFromLocalized(pathname);
  const isAuthRoute = canonicalPathname === "/auth";
  const { t, locale } = useLanguage();
  const taxonomy = useTaxonomy();
  const ui = topbarText[locale] ?? topbarText.fi;
  const ownProfileLabel = ui.ownProfile;
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarChangeVersionRef = useRef(0);
  const [profileInitial, setProfileInitial] = useState("?");
  const [profileDisplayName, setProfileDisplayName] = useState(ui.fallbackProfile);
  const [reviewRequests, setReviewRequests] = useState<PurchaseReviewRequest[]>([]);
  const [alertNotifications, setAlertNotifications] = useState<AlertNotification[]>([]);
  const [unreadConversations, setUnreadConversations] = useState<ConversationSummary[]>([]);
  const [seenNotificationKeys, setSeenNotificationKeys] = useState<Set<string>>(new Set());
  const [notificationRefreshNonce, setNotificationRefreshNonce] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [sellerLevelStats, setSellerLevelStats] = useState<SellerLevelStats>(emptySellerLevelStats);
  const [topbarDropdownOpen, setTopbarDropdownOpen] = useState<TopbarDropdownKey>(null);
  const [topbarDropdownRect, setTopbarDropdownRect] = useState<DOMRect | null>(null);
  const [authSurfaceActive, setAuthSurfaceActive] = useState(isAuthRoute);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuOverlayRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const topbarDropdownRef = useRef<HTMLDivElement>(null);
  const topbarDropdownPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthRoute) {
      setAuthSurfaceActive(false);
      return;
    }

    const syncAuthSurface = () => {
      const browserPath = canonicalPathFromLocalized(window.location.pathname || "/");
      const hasAuthSurface = Boolean(document.querySelector("main.simple-auth-page"));
      setAuthSurfaceActive(browserPath === "/auth" && hasAuthSurface);
    };

    syncAuthSurface();

    const observer = new MutationObserver(syncAuthSurface);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [isAuthRoute, pathname]);

  const partNavigationItems = useMemo(
    () => taxonomy.categories.map((category) => category.key).filter(Boolean),
    [taxonomy]
  );

  const brandNavigationGroups = useMemo(
    () =>
      taxonomy.vehicles
        .map((vehicle) => ({
          vehicleType: vehicle.key,
          label: vehicle.pillLabel || vehicle.label || vehicle.key,
          brands: vehicle.brands.filter(Boolean)
        }))
        .filter((group) => group.brands.length > 0),
    [taxonomy]
  );

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }
    const client = supabase;
    let cancelled = false;
    let syncGeneration = 0;
    let syncedUserId: string | null = null;

    async function syncUser(
      nextUserId: string | null,
      fallbackEmail?: string | null,
      fallbackName?: string | null
    ) {
      if (cancelled) return;
      const generation = ++syncGeneration;
      const userChanged = syncedUserId !== nextUserId;
      syncedUserId = nextUserId;
      setUserId(nextUserId);

      if (!nextUserId) {
        setAvatarUrl(null);
        setProfileInitial("?");
        setProfileDisplayName(ui.fallbackProfile);
        setIsAdmin(false);
        setSellerLevelStats(emptySellerLevelStats);
        setProfileOpen(false);
        setNotificationOpen(false);
        return;
      }

      if (userChanged) {
        setAvatarUrl(null);
      }

      const avatarChangeVersion = avatarChangeVersionRef.current;
      const profile = await getTopbarProfile(nextUserId);
      if (cancelled || generation !== syncGeneration) return;
      if (profile && avatarChangeVersion === avatarChangeVersionRef.current) {
        setAvatarUrl(profile.avatar_url ?? null);
      }
      const displayName = getTopbarProfileDisplayName(
        profile,
        fallbackEmail,
        fallbackName
      );
      setProfileInitial(displayName.trim().charAt(0).toUpperCase() || "?");
      setProfileDisplayName(displayName.trim() || ui.fallbackProfile);
      getCurrentUserIsAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
      getPublicSellerLevelStats(nextUserId)
        .then(({ data }) => {
          if (!cancelled) setSellerLevelStats(data);
        })
        .catch(() => {
          if (!cancelled) setSellerLevelStats(emptySellerLevelStats);
        });
    }

    getSafeAuthUser()
      .then(async (user) => {
        await syncUser(
          user?.id ?? null,
          user?.email ?? null,
          getAuthUserDisplayName(user)
        );
      })
      .catch(() => {
        if (!cancelled) void syncUser(null, null);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setAuthChecked(true);
      const nextUser = session?.user ?? null;

      window.setTimeout(() => {
        void syncUser(
          nextUser?.id ?? null,
          nextUser?.email ?? null,
          getAuthUserDisplayName(nextUser)
        );
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [ui.fallbackProfile]);

  useEffect(() => {
    if (!userId) return;

    const activeUserId = userId;
    let cancelled = false;

    async function refreshOwnProfile() {
      const avatarChangeVersion = avatarChangeVersionRef.current;
      const profile = await getTopbarProfile(activeUserId);
      if (cancelled || !profile) return;

      if (avatarChangeVersion === avatarChangeVersionRef.current) {
        if (profile.avatar_url) {
          const separator = profile.avatar_url.includes("?") ? "&" : "?";
          setAvatarUrl(`${profile.avatar_url}${separator}avatar=${Date.now()}`);
        } else {
          setAvatarUrl(null);
        }
      }

      const displayName = getTopbarProfileDisplayName(profile);
      if (displayName) {
        setProfileInitial(displayName.charAt(0).toUpperCase());
        setProfileDisplayName(displayName);
      }
    }

    function refreshOnVisible() {
      if (document.visibilityState === "visible") {
        void refreshOwnProfile();
      }
    }

    window.addEventListener("focus", refreshOwnProfile);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshOwnProfile);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    function onProfileAvatarChanged(event: Event) {
      const detail = (event as CustomEvent<ProfileAvatarChangedDetail>).detail;
      if (!detail || detail.userId !== userId) return;

      avatarChangeVersionRef.current += 1;

      if (!detail.avatarUrl) {
        setAvatarUrl(null);
        return;
      }

      const separator = detail.avatarUrl.includes("?") ? "&" : "?";
      setAvatarUrl(`${detail.avatarUrl}${separator}avatar=${detail.version}`);
    }

    window.addEventListener(
      PROFILE_AVATAR_CHANGED_EVENT,
      onProfileAvatarChanged
    );

    return () => {
      window.removeEventListener(
        PROFILE_AVATAR_CHANGED_EVENT,
        onProfileAvatarChanged
      );
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setSeenNotificationKeys(new Set());
      return;
    }

    try {
      const stored = localStorage.getItem(`${SEEN_TOPBAR_NOTIFICATIONS_STORAGE_KEY}:${userId}`);
      const parsed = stored ? JSON.parse(stored) : [];
      setSeenNotificationKeys(new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []));
    } catch {
      setSeenNotificationKeys(new Set());
    }

  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId) {
      setReviewRequests([]);
      setAlertNotifications([]);
      setUnreadConversations([]);
      return;
    }

    const activeUserId = userId;
    const client = supabase;
    let cancelled = false;
    let refreshTimer: number | null = null;

    async function refreshNotifications() {
      try {
        const [{ data: reviews }, { data: alerts }, { data: conversations }] = await Promise.all([
          getPendingPurchaseReviewRequests(activeUserId),
          getAlertNotifications(activeUserId),
          getUnreadConversationSummaries(activeUserId),
        ]);

        if (cancelled) return;

        const lastRead = readChatLastRead();
        const unread = uniqueById(conversations ?? []).filter((conversation) => {
          return isConversationLastMessageUnread(
            conversation,
            activeUserId,
            lastRead
          );
        });

        setReviewRequests(uniqueById(reviews ?? []));
        setAlertNotifications(uniqueById(alerts ?? []));
        setUnreadConversations(unread);
      } catch {
        // Keep the last visible state if a realtime refresh races with a temporary network error.
      }
    }

    function scheduleRefreshNotifications() {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshNotifications();
      }, NOTIFICATION_REFRESH_DEBOUNCE_MS);
    }

    void refreshNotifications();
    const messagesChannel = client
      .channel(`universal-topbar-notifications-${activeUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${activeUserId}` },
        scheduleRefreshNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `sender_id=eq.${activeUserId}` },
        scheduleRefreshNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alert_notifications", filter: `user_id=eq.${activeUserId}` },
        scheduleRefreshNotifications
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "purchase_review_requests", filter: `buyer_id=eq.${activeUserId}` },
        scheduleRefreshNotifications
      )
      .subscribe();

    function onReviewDismissed() {
      refreshNotifications();
    }

    function onChatNotificationsChanged() {
      refreshNotifications();
    }

    window.addEventListener("review-request-dismissed", onReviewDismissed);
    window.addEventListener(CHAT_NOTIFICATIONS_CHANGED_EVENT, onChatNotificationsChanged);
    window.addEventListener("storage", onChatNotificationsChanged);
    return () => {
      cancelled = true;
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      window.removeEventListener("review-request-dismissed", onReviewDismissed);
      window.removeEventListener(CHAT_NOTIFICATIONS_CHANGED_EVENT, onChatNotificationsChanged);
      window.removeEventListener("storage", onChatNotificationsChanged);
      client.removeChannel(messagesChannel);
    };
  }, [notificationRefreshNonce, userId]);

  useEffect(() => {
    if (!notificationOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!notificationMenuRef.current?.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setNotificationOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationOpen]);

  useEffect(() => {
    if (!profileOpen) return;

    function closeOnOutsideClick(event: PointerEvent | MouseEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        !profileMenuRef.current?.contains(target) &&
        !profileMenuOverlayRef.current?.contains(target)
      ) {
        setProfileOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!topbarDropdownOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !topbarDropdownRef.current?.contains(target) &&
        !topbarDropdownPortalRef.current?.contains(target)
      ) {
        setTopbarDropdownOpen(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setTopbarDropdownOpen(null);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [topbarDropdownOpen]);

  async function handleSignOut() {
    setProfileOpen(false);
    setNotificationOpen(false);
    setUserId(null);
    setAvatarUrl(null);
    setProfileInitial("?");
    setIsAdmin(false);
    setAuthChecked(true);
    await supabase?.auth.signOut();
    router.push("/");
  }

  const visibleReviewRequests = reviewRequests;
  const visibleAlertNotifications = alertNotifications;
  const visibleUnreadConversations = unreadConversations;
  const unreadReviewRequests = visibleReviewRequests.filter((request) => !request.seen_at && !seenNotificationKeys.has(`review:${request.id}`));
  const unreadAlertNotifications = visibleAlertNotifications.filter((notification) => !notification.seen && !seenNotificationKeys.has(`alert:${notification.id}`));
  const unreadConversationsForBadge = visibleUnreadConversations.filter((conversation) => !seenNotificationKeys.has(`conversation:${conversation.id}`));
  const notificationItemCount =
    unreadReviewRequests.length +
    unreadAlertNotifications.length +
    unreadConversationsForBadge.length;
  const hasNotifications = notificationItemCount > 0;
  const hasNotificationItems =
    visibleReviewRequests.length + visibleAlertNotifications.length + visibleUnreadConversations.length > 0;
  const isHomePage = canonicalPathname === "/";
  const isAuthPage = isAuthRoute && authSurfaceActive;
  const controlsLocked = !authChecked;
  const sellerLevel = calculateSellerLevel(sellerLevelStats);
  const sellerLevelTooltip = sellerLevel.maxLevel
    ? `${ui.maxLevel} - ${ui.level} ${sellerLevel.level}`
    : `${sellerLevel.currentLevelXp}/${sellerLevel.xpForNextLevel} XP - ${ui.level} ${sellerLevel.level}`;
  function isActiveRoute(href: string) {
    if (href === "/") return canonicalPathname === "/";
    return canonicalPathname === href || canonicalPathname.startsWith(`${href}/`);
  }

  const authHref = pagePath("auth", locale);
  const messagesHref = pagePath("messages", locale);
  const profileHref = profileRootPath(locale);
  const myListingsHref = pagePath("my-listings", locale);
  const garagePageHref = pagePath("garage", locale);
  const savedHref = pagePath("saved", locale);
  const followedHref = pagePath("followed", locale);
  const searchAlertsPageHref = pagePath("search-alerts", locale);
  const settingsHref = pagePath("settings", locale);
  const aboutHref = pagePath("about", locale);
  const faqHref = pagePath("faq", locale);
  const garageHref =
    authChecked && !userId
      ? `${authHref}?mode=login&next=${encodeURIComponent(garagePageHref)}`
      : garagePageHref;
  const searchAlertsHref =
    authChecked && !userId
      ? `${authHref}?mode=login&next=${encodeURIComponent(searchAlertsPageHref)}`
      : searchAlertsPageHref;

  useEffect(() => {
    if (!authChecked) return;

    [
      garageHref,
      searchAlertsHref,
      aboutHref,
      faqHref,
      authHref
    ].forEach((href) => router.prefetch(href));
  }, [
    aboutHref,
    authChecked,
    authHref,
    faqHref,
    garageHref,
    router,
    searchAlertsHref
  ]);

  function toggleNotifications() {
    setProfileOpen(false);
    setNotificationOpen((open) => {
      if (!open) setNotificationRefreshNonce((value) => value + 1);
      return !open;
    });
  }

  function formatNotificationTime(value: string | null | undefined) {
    if (!value) return "";
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return "";
    const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
    if (minutes < 60) return ui.minutesAgo(minutes);
    const hours = Math.round(minutes / 60);
    if (hours < 24) return ui.hoursAgo(hours);
    const days = Math.round(hours / 24);
    return ui.daysAgo(days);
  }

  const rememberSeenNotificationKeys = useCallback((keys: string[]) => {
    const activeUserId = userId;
    if (!activeUserId || keys.length === 0) return;

    setSeenNotificationKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => next.add(key));
      try {
        localStorage.setItem(`${SEEN_TOPBAR_NOTIFICATIONS_STORAGE_KEY}:${activeUserId}`, JSON.stringify([...next]));
      } catch {
        /* ok */
      }
      return next;
    });
  }, [userId]);

  const acknowledgeVisibleNotificationItems = useCallback(() => {
    const activeUserId = userId;
    if (!activeUserId || notificationItemCount === 0) return;

    visibleUnreadConversations.forEach((conversation) => {
      const lastMessageAt = conversation.last_message?.created_at
        ? new Date(conversation.last_message.created_at).getTime() + 1
        : Date.now();
      const readAt = Math.max(Date.now(), lastMessageAt);
      void markConversationRead(conversation.id, activeUserId, readAt);
    });

    if (unreadAlertNotifications.length > 0) {
      void markNotificationsSeen(activeUserId).then(() => {
        setAlertNotifications((prev) =>
          prev.map((notification) =>
            unreadAlertNotifications.some((visible) => visible.id === notification.id)
              ? { ...notification, seen: true }
              : notification
          )
        );
      });
    }

    if (unreadReviewRequests.length > 0) {
      const seenAt = new Date().toISOString();
      void markPurchaseReviewRequestsSeen(
        unreadReviewRequests.map((request) => request.id),
        activeUserId
      ).then(({ error }) => {
        if (error) return;
        setReviewRequests((prev) =>
          prev.map((request) =>
            unreadReviewRequests.some((visible) => visible.id === request.id)
              ? { ...request, seen_at: seenAt }
              : request
          )
        );
      });
    }

    rememberSeenNotificationKeys([
      ...unreadReviewRequests.map((request) => `review:${request.id}`),
      ...unreadAlertNotifications.map((notification) => `alert:${notification.id}`),
      ...visibleUnreadConversations.map((conversation) => `conversation:${conversation.id}`),
    ]);
  }, [
    notificationItemCount,
    rememberSeenNotificationKeys,
    unreadAlertNotifications,
    unreadReviewRequests,
    userId,
    visibleUnreadConversations,
  ]);

  function markAllNotificationItemsRead() {
    acknowledgeVisibleNotificationItems();
  }

  function toggleProfileMenu() {
    setNotificationOpen(false);
    setProfileOpen((open) => !open);
  }

  function openCategoryDrawerAtStep(step: 2 | 3) {
    setNotificationOpen(false);
    setProfileOpen(false);

    if (canonicalPathname.startsWith("/seller/") || canonicalPathname.startsWith("/profile/")) {
      window.dispatchEvent(new CustomEvent("seller-profile-open-filters"));
      return;
    }

    if (canonicalPathname === "/") {
      window.dispatchEvent(new CustomEvent("open-category-drawer", { detail: { step } }));
      return;
    }

    try {
      sessionStorage.setItem(OPEN_CATEGORY_DRAWER_STORAGE_KEY, "1");
      sessionStorage.setItem(OPEN_CATEGORY_DRAWER_STEP_STORAGE_KEY, String(step));
    } catch {
      /* ok */
    }

    router.push("/");
  }

  function openMobileCategorySearch() {
    openCategoryDrawerAtStep(2);
  }

  function homeFilterHref(filters: {
    category?: string;
    brand?: string;
    model?: string;
    vehicleType?: string;
  }) {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.vehicleType) params.set("vehicleType", filters.vehicleType);
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.model) params.set("model", filters.model);
    const query = params.toString();
    return query ? `/?${query}` : "/";
  }

  function toggleTopbarDropdown(next: Exclude<TopbarDropdownKey, null>, anchor: HTMLElement) {
    setTopbarDropdownRect(anchor.getBoundingClientRect());
    setTopbarDropdownOpen((current) => (current === next ? null : next));
  }

  const topbarDropdownWidth =
    topbarDropdownOpen === "models" ? 460 : 320;

  const topbarDropdownPortal =
    topbarDropdownOpen && topbarDropdownRect
      ? createPortal(
          <div
            ref={topbarDropdownPortalRef}
            className={`universal-nav-menu universal-nav-menu-portal${
              topbarDropdownOpen === "brands" ? " universal-nav-menu-wide" : ""
            }${topbarDropdownOpen === "models" ? " universal-nav-menu-wide universal-nav-menu-models" : ""}`}
            role="menu"
            style={{
              left:
                typeof window === "undefined"
                  ? topbarDropdownRect.left
                  : Math.max(8, Math.min(topbarDropdownRect.left, window.innerWidth - topbarDropdownWidth - 8)),
              top: topbarDropdownRect.bottom + 10
            }}
          >
            {topbarDropdownOpen === "parts" ? (
              <>
                <div className="universal-nav-menu-grid">
                  {partNavigationItems.map((categoryName) => (
                    <Link
                      key={categoryName}
                      href={homeFilterHref({ category: categoryName })}
                      className="universal-nav-menu-item"
                      role="menuitem"
                      onClick={() => setTopbarDropdownOpen(null)}
                    >
                      {categoryName}
                    </Link>
                  ))}
                </div>
                <button
                  type="button"
                  className="universal-nav-menu-secondary"
                  data-no-auto-translate
                  translate="no"
                  onClick={() => {
                    setTopbarDropdownOpen(null);
                    openCategoryDrawerAtStep(2);
                  }}
                >
                  {ui.advancedPartsSearch}
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </>
            ) : null}

            {topbarDropdownOpen === "brands"
              ? brandNavigationGroups.map((group) => (
                  <section key={group.vehicleType} className="universal-nav-menu-section">
                    <strong>{group.label}</strong>
                    <div className="universal-nav-menu-grid">
                      {group.brands.map((brand) => (
                        <Link
                          key={`${group.vehicleType}-${brand}`}
                          href={homeFilterHref({ vehicleType: group.vehicleType, brand })}
                          className="universal-nav-menu-item"
                          role="menuitem"
                          onClick={() => setTopbarDropdownOpen(null)}
                        >
                          {brand}
                        </Link>
                      ))}
                    </div>
                  </section>
                ))
              : null}

            {topbarDropdownOpen === "models"
              ? (
                  <div className="universal-model-mega">
                    {TOPBAR_MODEL_GROUPS.map((vehicleGroup) => (
                      <section key={vehicleGroup.vehicleType} className="universal-model-card">
                        <strong>{vehicleGroup.label}</strong>
                        {vehicleGroup.brands.map((brandGroup) => (
                          <div key={`${vehicleGroup.vehicleType}-${brandGroup.brand}`} className="universal-model-brand-row">
                            <span>{brandGroup.brand}</span>
                            <div className="universal-model-chip-grid">
                              {brandGroup.models.map((model) => (
                                <Link
                                  key={`${vehicleGroup.vehicleType}-${brandGroup.brand}-${model}`}
                                  href={homeFilterHref({
                                    vehicleType: vehicleGroup.vehicleType,
                                    brand: brandGroup.brand,
                                    model
                                  })}
                                  className="universal-nav-menu-item universal-model-chip"
                                  role="menuitem"
                                  onClick={() => setTopbarDropdownOpen(null)}
                                >
                                  {model}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                )
              : null}
          </div>,
          document.body
        )
      : null;

  function handleBackNavigation() {
    goBackOrFallback(router, "/");
  }

  function handleHomeReset(event: ReactMouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    setProfileOpen(false);
    setNotificationOpen(false);
    setTopbarDropdownOpen(null);

    try {
      HOME_RESET_SESSION_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
    } catch {
      // Session storage can be unavailable in private/browser-restricted contexts.
    }

    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.location.replace("/");
  }

  const primaryNavigation = (
    <div className="universal-home-navigation universal-primary-navigation">
      {isHomePage ? (
        <Link href="/" className="universal-home-brand" aria-label={ui.resetHome} onClick={handleHomeReset}>
          <TopbarMaskinesLogo />
          <span className="universal-home-brand-copy" aria-hidden="true">
            <strong>MASKINES</strong>
            <small>MARKETPLACE</small>
          </span>
        </Link>
      ) : (
        <div className="universal-home-brand universal-page-back-brand" aria-hidden="false">
          <button
            type="button"
            className="universal-page-back-button"
            aria-label={ui.back}
            onClick={handleBackNavigation}
          >
            <BackChevronIcon />
          </button>
          <Link
            href="/"
            className="universal-page-brand-home"
            aria-label={ui.brandHome}
            onClick={handleHomeReset}
          >
            <span className="universal-home-brand-copy" aria-hidden="true">
              <strong>MASKINES</strong>
              <small>MARKETPLACE</small>
            </span>
          </Link>
        </div>
      )}
      {!isAuthPage && (
      <nav className="universal-home-primary-nav" aria-label={ui.primaryNavigation} ref={topbarDropdownRef}>
        {isHomePage ? (
          <>
            <Link href="/" className="is-active">
              <Home size={18} aria-hidden="true" />
              {ui.home}
            </Link>
            <Link href={garageHref}>{ui.garage}</Link>
            <Link href={searchAlertsHref}>{ui.searchAlerts}</Link>
            <Link href={aboutHref}>{ui.about}</Link>
            <Link href={faqHref} className={`universal-contact-cta${isActiveRoute("/faq") ? " is-active" : ""}`}>{ui.help}</Link>
          </>
        ) : (
          <>
            <Link href="/" className={isActiveRoute("/") ? "is-active" : ""}>
              <Home size={18} aria-hidden="true" />
              {ui.home}
            </Link>
            <Link href={garageHref} className={isActiveRoute("/garage") ? "is-active" : ""}>{ui.garage}</Link>
            <Link href={searchAlertsHref} className={isActiveRoute("/search-alerts") ? "is-active" : ""}>{ui.searchAlerts}</Link>
            <Link href={aboutHref} className={isActiveRoute("/about") ? "is-active" : ""}>{ui.about}</Link>
            <Link href={faqHref} className={`universal-contact-cta${isActiveRoute("/faq") ? " is-active" : ""}`}>{ui.help}</Link>
          </>
        )}
      </nav>
      )}
    </div>
  );

  function dismissConversationNotification(conversation: ConversationSummary) {
    const lastMessageAt = conversation.last_message?.created_at
      ? new Date(conversation.last_message.created_at).getTime() + 1
      : Date.now();
    const readAt = Math.max(Date.now(), lastMessageAt);

    setUnreadConversations((prev) => prev.filter((item) => item.id !== conversation.id));
    if (userId) {
      void markConversationRead(conversation.id, userId, readAt);
    }
  }

  function rememberDismissedNotificationKey(key: string) {
    if (!userId) return;

    setSeenNotificationKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem(
          `${SEEN_TOPBAR_NOTIFICATIONS_STORAGE_KEY}:${userId}`,
          JSON.stringify([...next])
        );
      } catch {
        /* ok */
      }
      return next;
    });
  }

  function dismissReviewNotification(request: PurchaseReviewRequest) {
    setReviewRequests((prev) => prev.filter((item) => item.id !== request.id));
    rememberDismissedNotificationKey(`review:${request.id}`);

    void dismissPurchaseReviewRequest(request.id).then(({ error }) => {
      if (error) {
        console.warn("Review notification delete failed:", error);
        setNotificationRefreshNonce((value) => value + 1);
      }
    });

    window.dispatchEvent(new CustomEvent("review-request-dismissed", { detail: request.id }));
  }

  function dismissAlertNotification(notification: AlertNotification) {
    setAlertNotifications((prev) =>
      prev.filter((item) => item.id !== notification.id)
    );

    rememberDismissedNotificationKey(`alert:${notification.id}`);

    void deleteAlertNotification(notification.id).then(({ error }) => {
      if (error) {
        console.warn("Alert notification delete failed:", error);
        setNotificationRefreshNonce((value) => value + 1);
      }
    });
  }

  useEffect(() => {
    if (!notificationOpen) return;
    acknowledgeVisibleNotificationItems();
  }, [acknowledgeVisibleNotificationItems, notificationOpen]);

  const profileMenuPortal = profileOpen && typeof document !== "undefined"
    ? createPortal(
      <>
        <button
          type="button"
          className="universal-profile-menu-backdrop"
          aria-label={ui.closeProfileMenu}
          data-no-auto-translate
          translate="no"
          onClick={() => setProfileOpen(false)}
          onPointerDown={(event) => {
            event.stopPropagation();
            setProfileOpen(false);
          }}
          onTouchStart={(event) => {
            event.stopPropagation();
            setProfileOpen(false);
          }}
        />
        <div
          ref={profileMenuOverlayRef}
          className="universal-profile-menu universal-profile-menu-portal"
          role="menu"
          data-no-auto-translate
          translate="no"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="universal-profile-menu-close"
            aria-label={ui.closeProfileMenu}
            onClick={() => setProfileOpen(false)}
          >
            <X size={17} strokeWidth={2.5} aria-hidden="true" />
          </button>
          {userId ? (
            <>
              <div className="universal-profile-menu-head" aria-hidden="true">
                <span className={`universal-profile-menu-avatar ${avatarUrl ? "has-photo" : "no-photo"}`}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarUrl(null)}
                    />
                  ) : (
                    <span className="profile-avatar-initial">{profileInitial}</span>
                  )}
                </span>
                <span className="universal-profile-menu-title">
                  <strong data-person-name data-no-auto-translate translate="no">{profileDisplayName}</strong>
                  <small>{ui.manageAccount}</small>
                </span>
              </div>
              <div className="universal-profile-level-card" aria-label={sellerLevelTooltip}>
                <span className="universal-profile-level-badge" aria-hidden="true">
                  {sellerLevel.level}
                </span>
                <span className="universal-profile-level-copy">
                  <span className="universal-profile-level-head">
                    <strong>{ui.level} {sellerLevel.level}</strong>
                    <small>
                      {sellerLevel.maxLevel ? ui.maxLevel : ui.xpToNextLevel(sellerLevel.nextLevelXp)}
                    </small>
                  </span>
                  <span className="universal-profile-level-track" aria-hidden="true">
                    <span style={{ width: `${sellerLevel.progressPercent}%` }} />
                  </span>
                </span>
              </div>
              <Link href="/" className={`universal-profile-menu-link${isActiveRoute("/") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                <Home size={16} /> {t.home}
              </Link>
              <Link href={profileHref} className={`universal-profile-menu-link${isActiveRoute("/profile") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                <UserRound size={16} /> {ownProfileLabel}
              </Link>
              <Link href={myListingsHref} className={`universal-profile-menu-link${isActiveRoute("/my-listings") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                <ClipboardList size={16} /> {t.myListings}
              </Link>
              <Link href={garageHref} className={`universal-profile-menu-link${isActiveRoute("/garage") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                <Car size={16} /> {t.garageTitle}
              </Link>
              <Link href={messagesHref} className={`universal-profile-menu-link${isActiveRoute("/messages") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                <Mail size={16} /> {t.messages}
              </Link>
              <Link href={savedHref} className={`universal-profile-menu-link${isActiveRoute("/saved") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                <Heart size={16} /> {t.savedListings}
              </Link>
              <Link href={followedHref} className={`universal-profile-menu-link${isActiveRoute("/followed") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                <Users size={16} /> {ui.followed}
              </Link>
              <Link href={searchAlertsHref} className={`universal-profile-menu-link${isActiveRoute("/search-alerts") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                <Bell size={16} /> {ui.searchAlert}
              </Link>
              <Link href={settingsHref} className={`universal-profile-menu-link${isActiveRoute("/settings") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                <Settings size={16} /> {ui.settings}
              </Link>
              {isAdmin && (
                <Link href="/admin" className={`universal-profile-menu-link admin${isActiveRoute("/admin") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                  <Menu size={16} /> Admin
                </Link>
              )}
              <div className="universal-profile-menu-divider" />
              <button type="button" className="universal-profile-menu-link danger" role="menuitem" onClick={handleSignOut}>
                <DoorOpen size={16} /> {t.signOut}
              </button>
            </>
          ) : (
            <>
              <Link href={authHref} className="universal-profile-menu-link" role="menuitem" onClick={() => setProfileOpen(false)}>
                <LockKeyhole size={16} /> {t.login}
              </Link>
            </>
          )}
        </div>
      </>,
      document.body
    )
    : null;

  if (isAuthRoute) return null;

  return (
    <>
    {profileMenuPortal}
    {topbarDropdownPortal}
    <header
      className={`universal-app-topbar${isHomePage ? " universal-home-topbar" : ""}${isAuthPage ? " universal-auth-topbar" : ""}`}
      data-no-auto-translate
      translate="no"
    >
      {primaryNavigation}
      <nav className={`universal-topbar-actions${!userId ? " universal-topbar-actions-guest" : ""}`} aria-label={ui.quickActions}>
        {!isAuthPage ? (
          <div className="universal-language-wrap">
            <LanguageSwitcher />
          </div>
        ) : null}
        {!isAuthPage && (!userId ? (
          <Link href={authHref} className="rebuilt-login-button rebuilt-login-button-guest">
            <LockKeyhole size={17} aria-hidden="true" />
            <strong>{t.login}</strong>
          </Link>
        ) : (
          <>
            <Link href="/sell" className="universal-create-button">
              <span className="universal-create-plus" aria-hidden="true">
                <svg viewBox="0 0 16 16" focusable="false">
                  <path d="M8 3v10M3 8h10" />
                </svg>
              </span>
              <strong>{t.createListing}</strong>
            </Link>
            {false && userId ? (
              <Link
                href={profilePath(userId, profileDisplayName, locale)}
                className="universal-level-pill"
                title={sellerLevelTooltip}
                aria-label={sellerLevelTooltip}
              >
                <span className="universal-level-pill-badge" aria-hidden="true">
                  <span>{ui.level}</span>
                  <strong>{sellerLevel.level}</strong>
                </span>
                <span className="universal-level-pill-head">
                  <span>
                    <Award size={13} aria-hidden="true" />
                    {ui.sellerLevel}
                  </span>
                  <strong>{ui.level} {sellerLevel.level}</strong>
                </span>
                <span className="universal-level-pill-track" aria-hidden="true">
                  <span style={{ width: `${sellerLevel.progressPercent}%` }} />
                </span>
                <small>
                  {sellerLevel.maxLevel
                    ? ui.maxLevel
                    : ui.xpToNextLevel(sellerLevel.nextLevelXp)}
                </small>
              </Link>
            ) : null}
            <div className="universal-notification-wrap" ref={notificationMenuRef}>
              <button
                type="button"
                className={`universal-icon-button universal-notification-button${notificationOpen ? " is-open" : ""}`}
                aria-label={t.notifications}
                aria-haspopup="menu"
                aria-expanded={notificationOpen}
                aria-controls="universal-notification-menu"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleNotifications();
                }}
              >
                <Bell size={17} aria-hidden="true" />
                {hasNotifications ? (
                  <span className="universal-notification-badge">
                    {notificationItemCount > 9 ? "9+" : notificationItemCount}
                  </span>
                ) : null}
              </button>

          {notificationOpen && (
            <div id="universal-notification-menu" className="universal-notification-menu" role="menu">
              <div className="universal-notification-head">
                <span className="universal-notification-head-icon" aria-hidden="true">
                  <Bell size={24} />
                </span>
                <span className="universal-notification-head-copy">
                  <strong>{t.notifications}</strong>
                  <small>{ui.notificationsHelp}</small>
                </span>
                {hasNotifications ? (
                  <button
                    type="button"
                    className="universal-notification-read-all"
                    onClick={markAllNotificationItemsRead}
                  >
                    {ui.markAllRead}
                  </button>
                ) : null}
              </div>

              {!hasNotificationItems ? (
                <p className="universal-notification-empty">{t.noNotifications}</p>
              ) : null}

              <div className="universal-notification-body">
              {visibleUnreadConversations.length > 0 ? (
                <div className="universal-notification-group">
                  <span>{t.messages}</span>
                  {visibleUnreadConversations.map((conversation) => {
                    const other = conversation.other_profile;
                    const name = other?.full_name || other?.name || `${other?.first_name ?? ""} ${other?.last_name ?? ""}`.trim() || ui.defaultUser;
                    return (
                      <div key={conversation.id} className="universal-notification-item-wrap">
                        <span className="universal-notification-dot is-unread" aria-hidden="true" />
                        <Link
                          href={`${messagesHref}/${conversation.listing_id}?conversation=${conversation.id}`}
                          className="universal-notification-item"
                          role="menuitem"
                          onClick={() => {
                            const lastMessageAt =
                              conversation.last_message?.created_at
                                ? new Date(conversation.last_message.created_at).getTime() + 1
                                : Date.now();
                            const readAt =
                              Math.max(Date.now(), lastMessageAt);

                            setUnreadConversations((prev) =>
                              prev.filter((item) =>
                                item.id !== conversation.id
                              )
                            );
                            if (userId) {
                              void markConversationRead(
                                conversation.id,
                                userId,
                                readAt
                              );
                            }
                            setNotificationOpen(false);
                          }}
                        >
                          <span className="universal-notification-item-icon"><MessageCircle size={15} /></span>
                          <span>
                            <strong>{name}</strong>
                            <small>{conversation.last_message?.content?.slice(0, 58) ?? ""}</small>
                          </span>
                          <time>{formatNotificationTime(conversation.last_message?.created_at || conversation.updated_at || conversation.created_at)}</time>
                          <ChevronRight size={22} aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          className="universal-notif-dismiss"
                          title={ui.delete}
                          aria-label={ui.deleteNotification}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dismissConversationNotification(conversation);
                          }}
                        ><X size={11} /></button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {visibleReviewRequests.length > 0 ? (
                <div className="universal-notification-group">
                  <span>{t.reviews}</span>
                  {visibleReviewRequests.map((request) => {
                    const isUnread = !request.seen_at && !seenNotificationKeys.has(`review:${request.id}`);
                    return (
                      <div key={request.id} className="universal-notification-item-wrap">
                        {isUnread ? <span className="universal-notification-dot is-unread" aria-hidden="true" /> : <span />}
                        <button
                          type="button"
                          className="universal-notification-item"
                          role="menuitem"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent("open-purchase-review", { detail: { requestId: request.id } }));
                            setNotificationOpen(false);
                          }}
                        >
                          <span className="universal-notification-item-icon"><Star size={15} /></span>
                          <span>
                            <strong>{t.reviewSeller}</strong>
                            <small>{request.listing_title}</small>
                          </span>
                          <time>{formatNotificationTime(request.created_at)}</time>
                          <ChevronRight size={22} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="universal-notif-dismiss"
                          title={t.dismiss}
                          aria-label={ui.deleteNotification}
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissReviewNotification(request);
                          }}
                        ><X size={11} /></button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {visibleAlertNotifications.length > 0 ? (
                <div className="universal-notification-group">
                  <span>{t.saTitle}</span>
                  {visibleAlertNotifications.map((notification) => {
                    const isUnread = !notification.seen && !seenNotificationKeys.has(`alert:${notification.id}`);
                    return (
                      <div key={notification.id} className="universal-notification-item-wrap">
                        {isUnread ? <span className="universal-notification-dot is-unread" aria-hidden="true" /> : <span />}
                        <Link
                          href={listingPath(listingUrlId(notification), locale)}
                          className="universal-notification-item"
                          role="menuitem"
                          onClick={() => setNotificationOpen(false)}
                        >
                          <span className="universal-notification-item-icon"><Bell size={15} /></span>
                          <span>
                            <strong>{notification.alert_label}</strong>
                            <small>{notification.listing_title}</small>
                          </span>
                          <time>{formatNotificationTime(notification.created_at)}</time>
                          <ChevronRight size={22} aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          className="universal-notif-dismiss"
                          title={t.dismiss}
                          aria-label={ui.deleteNotification}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dismissAlertNotification(notification);
                          }}
                        ><X size={11} /></button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              </div>
              <Link
                href={messagesHref}
                className="universal-notification-footer"
                role="menuitem"
                onClick={() => setNotificationOpen(false)}
              >
                <MessageCircle size={20} aria-hidden="true" />
                <strong>{ui.showAllMessages}</strong>
                <ChevronRight size={20} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
        <button
          type="button"
          className="universal-mobile-search-button"
          aria-label={t.searchPlaceholder}
          onClick={openMobileCategorySearch}
        >
          <Search size={16} aria-hidden="true" />
          <span>{locale === "fi" ? "Hae" : t.searchLabel}</span>
        </button>
        <div
          className="universal-profile-menu-wrap"
          ref={profileMenuRef}
        >
          <button
            type="button"
            className={`rebuilt-profile-button${profileOpen ? " is-open" : ""}`}
            aria-label={profileOpen ? ui.closeProfileMenu : ui.openProfileMenu}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleProfileMenu();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleProfileMenu();
              }
            }}
          >
            <span
              className={`universal-profile-avatar ${avatarUrl ? "has-photo" : "no-photo"}`}
              aria-hidden="true"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarUrl(null)}
                />
              ) : (
                <span className="profile-avatar-initial">{profileInitial}</span>
              )}
            </span>
            <span className="rebuilt-profile-button-copy">
              <strong>{t.profile}</strong>
              <span className="rebuilt-profile-xp-row" aria-hidden="true">
                <small>{sellerLevel.level}</small>
                <span className="rebuilt-profile-xp-track">
                  <span style={{ width: `${sellerLevel.progressPercent}%` }} />
                </span>
              </span>
            </span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
          </>
        ))}
      </nav>
    </header>
    </>
  );
}
