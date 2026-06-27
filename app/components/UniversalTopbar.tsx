"use client";

import { Award, Bell, Car, ChevronDown, ChevronRight, ClipboardList, DoorOpen, Heart, Home, LockKeyhole, Mail, Menu, MessageCircle, Plus, Search, Star, Store, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import {
  CHAT_NOTIFICATIONS_CHANGED_EVENT,
  deleteAlertNotification,
  dismissPurchaseReviewRequest,
  getAlertNotifications,
  getCurrentUserIsAdmin,
  getGarageVehicles,
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
  type GarageVehicle,
  type PurchaseReviewRequest,
  type SellerLevelStats,
  type UserProfile,
} from "@/lib/supabase";
import { calculateSellerLevel } from "@/lib/seller-level";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { useLanguage, type Locale } from "@/lib/i18n";
import { canonicalPathFromLocalized, listingPath, listingUrlId, pagePath, profilePath, profileRootPath } from "@/lib/routes";
import LanguageSwitcher from "./LanguageSwitcher";

const SEEN_TOPBAR_NOTIFICATIONS_STORAGE_KEY = "universalTopbarSeenNotifications";
const NOTIFICATION_REFRESH_DEBOUNCE_MS = 120;
const OPEN_CATEGORY_DRAWER_STORAGE_KEY = "maskinesOpenCategoryDrawer";
const OPEN_CATEGORY_DRAWER_STEP_STORAGE_KEY = "maskinesOpenCategoryDrawerStep";

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
  showAllMessages: string;
  manageAccount: string;
  followed: string;
  searchAlert: string;
  minutesAgo: (minutes: number) => string;
  hoursAgo: (hours: number) => string;
  daysAgo: (days: number) => string;
}> = {
  fi: {
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
    showAllMessages: "Näytä kaikki viestit",
    manageAccount: "Hallinnoi tiliäsi",
    followed: "Seuratut",
    searchAlert: "Hakuvahti",
    minutesAgo: (minutes) => `${minutes} min sitten`,
    hoursAgo: (hours) => `${hours} h sitten`,
    daysAgo: (days) => `${days} pv sitten`
  },
  en: {
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
    showAllMessages: "Show all messages",
    manageAccount: "Manage your account",
    followed: "Following",
    searchAlert: "Search alert",
    minutesAgo: (minutes) => `${minutes} min ago`,
    hoursAgo: (hours) => `${hours} h ago`,
    daysAgo: (days) => `${days} d ago`
  },
  sv: {
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
    showAllMessages: "Visa alla meddelanden",
    manageAccount: "Hantera ditt konto",
    followed: "Följer",
    searchAlert: "Sökbevakning",
    minutesAgo: (minutes) => `${minutes} min sedan`,
    hoursAgo: (hours) => `${hours} h sedan`,
    daysAgo: (days) => `${days} d sedan`
  },
  no: {
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
    showAllMessages: "Vis alle meldinger",
    manageAccount: "Administrer kontoen din",
    followed: "Følger",
    searchAlert: "Søkevarsel",
    minutesAgo: (minutes) => `${minutes} min siden`,
    hoursAgo: (hours) => `${hours} t siden`,
    daysAgo: (days) => `${days} d siden`
  },
  et: {
    ownProfile: "Minu profiil",
    fallbackProfile: "Profiil",
    sellerLevel: "Müüja tase",
    level: "Tase",
    maxLevel: "Maksimaalne tase",
    xpToNextLevel: (xp) => `${xp} XP järgmise tasemeni`,
    quickActions: "Kiirtoimingud",
    notificationsHelp: "Hoia end oluliste sõnumitega kursis.",
    markAllRead: "Märgi kõik loetuks",
    defaultUser: "Kasutaja",
    delete: "Eemalda",
    deleteNotification: "Eemalda teavitus",
    showAllMessages: "Näita kõiki sõnumeid",
    manageAccount: "Halda oma kontot",
    followed: "Jälgitavad",
    searchAlert: "Otsinguvalvur",
    minutesAgo: (minutes) => `${minutes} min tagasi`,
    hoursAgo: (hours) => `${hours} h tagasi`,
    daysAgo: (days) => `${days} p tagasi`
  }
};

function TopbarMaskinesLogo() {
  return (
    <img className="universal-home-brand-logo" src="/maskines-icon.png" alt="Maskines" />
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
  const { t, locale } = useLanguage();
  const ui = topbarText[locale] ?? topbarText.fi;
  const ownProfileLabel = ui.ownProfile;
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [garageMenuOpen, setGarageMenuOpen] = useState(false);
  const [garageVehicles, setGarageVehicles] = useState<GarageVehicle[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuOverlayRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const garageMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }
    const client = supabase;
    let cancelled = false;

    async function syncUser(
      nextUserId: string | null,
      fallbackEmail?: string | null,
      fallbackName?: string | null
    ) {
      if (cancelled) return;
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

      const { data: profile } = await client
        .from("profiles")
        .select("avatar_url,is_completed,account_type,first_name,last_name,full_name,name,company_name,business_id,email,phone,address,postal_code,city,country,birth_date,phone_verified_at")
        .eq("id", nextUserId)
        .maybeSingle<Pick<UserProfile, "avatar_url" | "is_completed" | "account_type" | "first_name" | "last_name" | "full_name" | "name" | "company_name" | "business_id" | "email" | "phone" | "address" | "postal_code" | "city" | "country" | "birth_date" | "phone_verified_at">>();
      if (cancelled) return;
      setAvatarUrl(profile?.avatar_url ?? null);
      const firstAndLastName =
        `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
      const displayName =
        [
          profile?.company_name,
          firstAndLastName,
          profile?.full_name,
          profile?.name,
          fallbackName
        ]
          .map((value) => String(value ?? "").trim())
          .find((value) => value && value.toLowerCase() !== fallbackEmail?.toLowerCase()) ||
        fallbackEmail ||
        "";
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
        await syncUser(user?.id ?? null, user?.email ?? null, getAuthUserDisplayName(user));
      })
      .catch(() => {
        if (!cancelled) void syncUser(null, null);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setAuthChecked(true);
      void syncUser(
        session?.user?.id ?? null,
        session?.user?.email ?? null,
        getAuthUserDisplayName(session?.user ?? null)
      );
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [ui.fallbackProfile]);

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
    if (!garageMenuOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!garageMenuRef.current?.contains(target)) {
        setGarageMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setGarageMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [garageMenuOpen]);

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
  const canonicalPathname = canonicalPathFromLocalized(pathname);
  const isHomePage = canonicalPathname === "/";
  const controlsLocked = !authChecked;
  const notificationLocked = !authChecked || !userId;
  const sellerLevel = calculateSellerLevel(sellerLevelStats);
  const sellerLevelTooltip = sellerLevel.maxLevel
    ? `${ui.maxLevel} - ${ui.level} ${sellerLevel.level}`
    : `${sellerLevel.currentLevelXp}/${sellerLevel.xpForNextLevel} XP - ${ui.level} ${sellerLevel.level}`;
  function isActiveRoute(href: string) {
    if (href === "/") return canonicalPathname === "/";
    return canonicalPathname === href || canonicalPathname.startsWith(`${href}/`);
  }

  const authHref = pagePath("auth", locale);
  const sellHref = pagePath("sell", locale);
  const sellActionHref =
    userId
      ? sellHref
      : `${authHref}?mode=login&next=${encodeURIComponent(sellHref)}&reason=sell`;
  const messagesHref = pagePath("messages", locale);
  const profileHref = profileRootPath(locale);
  const myListingsHref = pagePath("my-listings", locale);
  const garageHref = pagePath("garage", locale);
  const savedHref = pagePath("saved", locale);
  const followedHref = pagePath("followed", locale);
  const searchAlertsHref = pagePath("search-alerts", locale);
  const rewardsHref = pagePath("rewards", locale);
  const shopHref = pagePath("shop", locale);
  const aboutHref = pagePath("about", locale);
  const faqHref = pagePath("faq", locale);

  function toggleNotifications() {
    if (notificationLocked) return;
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
    setGarageMenuOpen(false);
    setProfileOpen((open) => !open);
  }

  function openCategoryDrawerAtStep(step: 2 | 3) {
    setNotificationOpen(false);
    setProfileOpen(false);

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

  function handleBackNavigation() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  const primaryNavigation = (
    <div className="universal-home-navigation universal-primary-navigation">
      {isHomePage ? (
        <Link href="/" className="universal-home-brand" aria-label="Maskines">
          <TopbarMaskinesLogo />
        </Link>
      ) : (
        <button
          type="button"
          className="universal-page-back-button"
          aria-label="Takaisin edelliselle sivulle"
          onClick={handleBackNavigation}
        >
          <BackChevronIcon />
        </button>
      )}
      <nav className="universal-home-primary-nav" aria-label="Päänavigaatio">
        <button
          type="button"
          className="universal-nav-action"
          onClick={() => openCategoryDrawerAtStep(2)}
        >
          Varaosat
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="universal-nav-action"
          onClick={() => openCategoryDrawerAtStep(2)}
        >
          Merkit
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="universal-nav-action"
          onClick={() => openCategoryDrawerAtStep(2)}
        >
          Mallit
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        <Link href={sellActionHref} className={isActiveRoute("/sell") ? "is-active" : ""}>Myy osa</Link>
        <Link href={aboutHref} className={isActiveRoute("/about") ? "is-active" : ""}>Tietoa meistä</Link>
        <Link href={faqHref} className={`universal-contact-cta${isActiveRoute("/faq") ? " is-active" : ""}`}>Ohjeet</Link>
      </nav>
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
          aria-label="Sulje profiilivalikko"
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
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {userId ? (
            <>
              <div className="universal-profile-menu-head" aria-hidden="true">
                <span className="universal-profile-menu-avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="profile-avatar-initial">{profileInitial}</span>
                  )}
                </span>
                <span className="universal-profile-menu-title">
                  <strong>{profileDisplayName}</strong>
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
              {FEATURE_FLAGS.rewardsAndShop ? (
                <>
                  <Link href={rewardsHref} className={`universal-profile-menu-link${isActiveRoute("/rewards") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Award size={16} /> {t.rewards}
                  </Link>
                  <Link href={shopHref} className={`universal-profile-menu-link${isActiveRoute("/shop") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Store size={16} /> {t.shop}
                  </Link>
                </>
              ) : null}
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

  return (
    <>
    {profileMenuPortal}
    <header className={`universal-app-topbar${isHomePage ? " universal-home-topbar" : ""}`}>
      {primaryNavigation}
      <nav className="universal-topbar-actions" aria-label={ui.quickActions}>
        {!userId ? (
          <Link href={authHref} className="rebuilt-login-button rebuilt-login-button-guest">
            <LockKeyhole size={17} aria-hidden="true" />
            <strong>{t.login}</strong>
          </Link>
        ) : (
          <>
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
            <Link href={sellActionHref} className={`universal-create-button${isActiveRoute("/sell") ? " is-active" : ""}`}>
              <Plus size={17} aria-hidden="true" />
              <strong>{t.createListing}</strong>
            </Link>
            <div className="universal-notification-wrap" ref={notificationMenuRef}>
              <button
                type="button"
                className={`universal-icon-button universal-notification-button${notificationOpen ? " is-open" : ""}`}
                aria-label={t.notifications}
                aria-haspopup="menu"
                aria-expanded={notificationOpen}
                disabled={notificationLocked}
                onClick={toggleNotifications}
              >
                <Bell size={17} aria-hidden="true" />
                {hasNotifications ? (
                  <span className="universal-notification-badge">
                    {notificationItemCount > 9 ? "9+" : notificationItemCount}
                  </span>
                ) : null}
              </button>

          {notificationOpen && (
            <div className="universal-notification-menu" role="menu">
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
          aria-label="Hae varaosia"
          onClick={openMobileCategorySearch}
        >
          <Search size={16} aria-hidden="true" />
          <span>Hae</span>
        </button>
        <div
          className="universal-profile-menu-wrap"
          ref={profileMenuRef}
        >
          <button
            type="button"
            className={`rebuilt-profile-button${profileOpen ? " is-open" : ""}`}
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
            <span className="universal-profile-avatar" aria-hidden="true">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="profile-avatar-initial">{profileInitial}</span>
              )}
              <span className="universal-profile-avatar-lock">
                <LockKeyhole size={9} strokeWidth={3} />
              </span>
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
            <div className={`universal-language-wrap${controlsLocked ? " universal-guest-disabled" : ""}`} aria-disabled={controlsLocked}>
              <LanguageSwitcher />
            </div>
          </>
        )}
      </nav>
    </header>
    </>
  );
}
