"use client";

import { ArrowLeft, Award, Bell, Car, ChevronDown, ChevronRight, ClipboardList, DoorOpen, Heart, Home, LockKeyhole, Mail, Menu, MessageCircle, Plus, Star, Store, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CHAT_NOTIFICATIONS_CHANGED_EVENT,
  deleteAlertNotification,
  dismissPurchaseReviewRequest,
  getAlertNotifications,
  getCurrentUserIsAdmin,
  getUnreadConversationSummaries,
  getPublicSellerLevelStats,
  getPendingPurchaseReviewRequests,
  isConversationLastMessageUnread,
  markConversationRead,
  markNotificationsSeen,
  readChatLastRead,
  supabase,
  type AlertNotification,
  type ConversationSummary,
  type PurchaseReviewRequest,
  type SellerLevelStats,
  type UserProfile,
} from "@/lib/supabase";
import { calculateSellerLevel } from "@/lib/seller-level";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { goBackOrFallback } from "@/lib/go-back";
import { useLanguage } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

const SEEN_TOPBAR_NOTIFICATIONS_STORAGE_KEY = "universalTopbarSeenNotifications";
const HOME_RETURN_STATE_KEY = "home_return_state_v1";
const HOME_RETURN_PENDING_KEY = "home_return_pending_v1";
const NOTIFICATION_REFRESH_DEBOUNCE_MS = 120;
const emptySellerLevelStats: SellerLevelStats = {
  listings_created: 0,
  single_listings_created: 0,
  multi_listings_created: 0,
  sold_count: 0,
  reviews_given: 0,
  reviews_received: 0,
  phone_verified: false
};

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
  const { t } = useLanguage();
  const ownProfileLabel = "Oma profiili";
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileInitial, setProfileInitial] = useState("?");
  const [profileDisplayName, setProfileDisplayName] = useState("Profiili");
  const [reviewRequests, setReviewRequests] = useState<PurchaseReviewRequest[]>([]);
  const [alertNotifications, setAlertNotifications] = useState<AlertNotification[]>([]);
  const [unreadConversations, setUnreadConversations] = useState<ConversationSummary[]>([]);
  const [seenNotificationKeys, setSeenNotificationKeys] = useState<Set<string>>(new Set());
  const [notificationRefreshNonce, setNotificationRefreshNonce] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [sellerLevelStats, setSellerLevelStats] = useState<SellerLevelStats>(emptySellerLevelStats);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }
    const client = supabase;
    let cancelled = false;

    async function syncUser(nextUserId: string | null, fallbackEmail?: string | null) {
      if (cancelled) return;
      setUserId(nextUserId);

      if (!nextUserId) {
        setAvatarUrl(null);
        setProfileInitial("?");
        setProfileDisplayName("Profiili");
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
      const displayName =
        profile?.company_name ||
        profile?.full_name ||
        profile?.name ||
        `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
        fallbackEmail ||
        "";
      setProfileInitial(displayName.trim().charAt(0).toUpperCase() || "?");
      setProfileDisplayName(displayName.trim() || "Profiili");
      getCurrentUserIsAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
      getPublicSellerLevelStats(nextUserId)
        .then(({ data }) => {
          if (!cancelled) setSellerLevelStats(data);
        })
        .catch(() => {
          if (!cancelled) setSellerLevelStats(emptySellerLevelStats);
        });
    }

    client.auth.getUser().then(async ({ data }) => {
      await syncUser(data?.user?.id ?? null, data?.user?.email ?? null);
    }).finally(() => {
      if (!cancelled) setAuthChecked(true);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setAuthChecked(true);
      void syncUser(session?.user?.id ?? null, session?.user?.email ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

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
        setAlertNotifications(uniqueById(alerts ?? []).filter((alert) => !alert.seen));
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

    function closeOnOutsideClick(event: MouseEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);

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

  const visibleReviewRequests = reviewRequests.filter((request) => !seenNotificationKeys.has(`review:${request.id}`));
  const visibleAlertNotifications = alertNotifications.filter((notification) => !notification.seen && !seenNotificationKeys.has(`alert:${notification.id}`));
  const visibleUnreadConversations = unreadConversations;
  const notificationItemCount =
    visibleReviewRequests.length +
    visibleAlertNotifications.length +
    visibleUnreadConversations.length;
  const hasNotifications = notificationItemCount > 0;
  const hasNotificationItems =
    notificationItemCount > 0;
  const isHomePage = pathname === "/";
  const guestLocked = !authChecked || !userId;
  const sellerLevel = calculateSellerLevel(sellerLevelStats);
  const sellerLevelTooltip = sellerLevel.maxLevel
    ? `Maksimitaso - Taso ${sellerLevel.level}`
    : `${sellerLevel.currentLevelXp}/${sellerLevel.xpForNextLevel} XP - Taso ${sellerLevel.level}`;
  const hideUniversalTopbar =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/privacy");

  function goBack() {
    if (typeof window !== "undefined") {
      try {
        if (sessionStorage.getItem(HOME_RETURN_STATE_KEY)) {
          sessionStorage.setItem(HOME_RETURN_PENDING_KEY, "1");
        }
      } catch {
        // Session storage can be unavailable in private/browser-restricted contexts.
      }
    }

    goBackOrFallback(router);
  }

  function isActiveRoute(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function toggleNotifications() {
    if (guestLocked) return;
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
    if (minutes < 60) return `${minutes} min sitten`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h sitten`;
    const days = Math.round(hours / 24);
    return `${days} pv sitten`;
  }

  function markAllNotificationItemsRead() {
    const activeUserId = userId;
    if (!activeUserId) return;

    visibleUnreadConversations.forEach((conversation) => {
      const lastMessageAt = conversation.last_message?.created_at
        ? new Date(conversation.last_message.created_at).getTime() + 1
        : Date.now();
      const readAt = Math.max(Date.now(), lastMessageAt);
      void markConversationRead(conversation.id, activeUserId, readAt);
    });

    if (visibleAlertNotifications.length > 0) {
      void markNotificationsSeen(activeUserId).then(() => {
        setAlertNotifications((prev) =>
          prev.map((notification) =>
            visibleAlertNotifications.some((visible) => visible.id === notification.id)
              ? { ...notification, seen: true }
              : notification
          )
        );
      });
    }

    setSeenNotificationKeys((prev) => {
      const next = new Set(prev);
      visibleReviewRequests.forEach((request) => next.add(`review:${request.id}`));
      visibleAlertNotifications.forEach((notification) => next.add(`alert:${notification.id}`));
      try {
        localStorage.setItem(`${SEEN_TOPBAR_NOTIFICATIONS_STORAGE_KEY}:${activeUserId}`, JSON.stringify([...next]));
      } catch {
        /* ok */
      }
      return next;
    });
    setUnreadConversations((prev) =>
      prev.filter((conversation) => !visibleUnreadConversations.some((visible) => visible.id === conversation.id))
    );
  }

  const homeNavigation = isHomePage ? (
    <div className="universal-home-navigation">
      <Link href="/" className="universal-home-brand" aria-label="Maskines">
        <strong>Maskines</strong>
        <span>Parts</span>
      </Link>
    </div>
  ) : null;

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

  if (hideUniversalTopbar) {
    return null;
  }

  if (pathname.startsWith("/terms")) {
    return (
      <header className="universal-app-topbar universal-terms-topbar">
        <button type="button" className="universal-return-button" onClick={goBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          <strong>Takaisin</strong>
        </button>
      </header>
    );
  }

  if (guestLocked) {
    return (
      <header className={`universal-app-topbar${isHomePage ? " universal-home-topbar" : ""}`}>
        {homeNavigation}
        {!isHomePage ? (
          <button type="button" className="universal-return-button" onClick={goBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            <strong>Takaisin</strong>
          </button>
        ) : null}
        <nav className="universal-topbar-actions universal-topbar-actions-guest" aria-label="Pikatoiminnot">
          <Link href="/auth" className={`rebuilt-login-button${isActiveRoute("/auth") ? " is-active" : ""}`}>
            <strong>{t.login}</strong>
          </Link>
        </nav>
      </header>
    );
  }

  return (
    <header className={`universal-app-topbar${isHomePage ? " universal-home-topbar" : ""}`}>
      {homeNavigation}
      {!isHomePage ? (
        <button type="button" className="universal-return-button" onClick={goBack} disabled={guestLocked}>
          <ArrowLeft size={16} aria-hidden="true" />
          <strong>Takaisin</strong>
        </button>
      ) : null}
      <nav className="universal-topbar-actions" aria-label="Pikatoiminnot">
        {false && isHomePage && userId ? (
          <Link
            href={`/seller/${userId}`}
            className="universal-level-pill"
            title={sellerLevelTooltip}
            aria-label={sellerLevelTooltip}
          >
            <span className="universal-level-pill-badge" aria-hidden="true">
              <span>Taso</span>
              <strong>{sellerLevel.level}</strong>
            </span>
            <span className="universal-level-pill-head">
              <span>
                <Award size={13} aria-hidden="true" />
                Myyjälevel
              </span>
              <strong>Taso {sellerLevel.level}</strong>
            </span>
            <span className="universal-level-pill-track" aria-hidden="true">
              <span style={{ width: `${sellerLevel.progressPercent}%` }} />
            </span>
            <small>
              {sellerLevel.maxLevel
                ? "Maksimitaso"
                : `${sellerLevel.nextLevelXp} XP seuraavaan tasoon`}
            </small>
          </Link>
        ) : null}
        <Link href="/sell" className={`universal-create-button${isActiveRoute("/sell") ? " is-active" : ""}`}>
          <Plus size={17} aria-hidden="true" />
          <strong>Luo ilmoitus</strong>
        </Link>
        <div className="universal-notification-wrap" ref={notificationMenuRef}>
          <button
            type="button"
            className={`universal-icon-button universal-notification-button${notificationOpen ? " is-open" : ""}`}
            aria-label="Ilmoitukset"
            aria-haspopup="menu"
            aria-expanded={notificationOpen}
            disabled={guestLocked}
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
                  <strong>Ilmoitukset</strong>
                  <small>Pysy ajan tasalla tärkeistä viesteistä.</small>
                </span>
                <button
                  type="button"
                  className="universal-notification-read-all"
                  onClick={markAllNotificationItemsRead}
                >
                  Merkitse kaikki luetuiksi
                </button>
                <span className="universal-notification-count">
                  {notificationItemCount}
                </span>
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
                    const name = other?.full_name || other?.name || `${other?.first_name ?? ""} ${other?.last_name ?? ""}`.trim() || "Käyttäjä";
                    return (
                      <div key={conversation.id} className="universal-notification-item-wrap">
                        <span className="universal-notification-dot is-unread" aria-hidden="true" />
                        <Link
                          href={`/messages/${conversation.listing_id}?conversation=${conversation.id}`}
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
                          title="Poista"
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
                  {visibleReviewRequests.map((request) => (
                    <div key={request.id} className="universal-notification-item-wrap">
                      <span className="universal-notification-dot is-unread" aria-hidden="true" />
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
                        onClick={(e) => {
                          e.stopPropagation();
                          void dismissPurchaseReviewRequest(request.id);
                          setReviewRequests(prev => prev.filter(r => r.id !== request.id));
                          window.dispatchEvent(new CustomEvent("review-request-dismissed", { detail: request.id }));
                        }}
                      ><X size={11} /></button>
                    </div>
                  ))}
                </div>
              ) : null}

              {visibleAlertNotifications.length > 0 ? (
                <div className="universal-notification-group">
                  <span>{t.saTitle}</span>
                  {visibleAlertNotifications.map((notification) => (
                    <div key={notification.id} className="universal-notification-item-wrap">
                      <span className="universal-notification-dot is-unread" aria-hidden="true" />
                      <Link
                        href={`/listing/${notification.listing_id}`}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          void deleteAlertNotification(notification.id);
                          setAlertNotifications(prev => prev.filter(n => n.id !== notification.id));
                        }}
                      ><X size={11} /></button>
                    </div>
                  ))}
                </div>
              ) : null}
              </div>
              <Link
                href="/messages"
                className="universal-notification-footer"
                role="menuitem"
                onClick={() => setNotificationOpen(false)}
              >
                <MessageCircle size={20} aria-hidden="true" />
                <strong>Näytä kaikki viestit</strong>
                <ChevronRight size={20} aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
        <div className="universal-profile-menu-wrap" ref={profileMenuRef}>
          <button
            type="button"
            className={`rebuilt-profile-button${profileOpen ? " is-open" : ""}`}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setNotificationOpen(false);
              setProfileOpen((open) => !open);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setNotificationOpen(false);
                setProfileOpen((open) => !open);
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

          {profileOpen && (
            <div className="universal-profile-menu" role="menu">
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
                      <small>Hallinnoi tiliäsi</small>
                    </span>
                  </div>
                  <div className="universal-profile-level-card" aria-label={sellerLevelTooltip}>
                    <span className="universal-profile-level-badge" aria-hidden="true">
                      {sellerLevel.level}
                    </span>
                    <span className="universal-profile-level-copy">
                      <span className="universal-profile-level-head">
                        <strong>Taso {sellerLevel.level}</strong>
                        <small>
                          {sellerLevel.maxLevel ? "Maksimitaso" : `${sellerLevel.nextLevelXp} XP seuraavaan tasoon`}
                        </small>
                      </span>
                      <span className="universal-profile-level-track" aria-hidden="true">
                        <span style={{ width: `${sellerLevel.progressPercent}%` }} />
                      </span>
                    </span>
                  </div>
                  {!isHomePage ? (
                    <Link href="/" className={`universal-profile-menu-link${isActiveRoute("/") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                      <Home size={16} /> {t.home}
                    </Link>
                  ) : null}
                  <Link href="/profile" className={`universal-profile-menu-link${isActiveRoute("/profile") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                    <UserRound size={16} /> {ownProfileLabel}
                  </Link>
                  <Link href="/my-listings" className={`universal-profile-menu-link${isActiveRoute("/my-listings") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                    <ClipboardList size={16} /> {t.myListings}
                  </Link>
                  <Link href="/garage" className={`universal-profile-menu-link${isActiveRoute("/garage") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Car size={16} /> {t.garageTitle}
                  </Link>
                  <Link href="/messages" className={`universal-profile-menu-link${isActiveRoute("/messages") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Mail size={16} /> {t.messages}
                  </Link>
                  <Link href="/saved" className={`universal-profile-menu-link${isActiveRoute("/saved") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Heart size={16} /> {t.savedListings}
                  </Link>
                  <Link href="/followed" className={`universal-profile-menu-link${isActiveRoute("/followed") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Users size={16} /> Seuratut
                  </Link>
                  <Link href="/search-alerts" className={`universal-profile-menu-link${isActiveRoute("/search-alerts") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Bell size={16} /> Hakuvahti
                  </Link>
                  {FEATURE_FLAGS.rewardsAndShop ? (
                    <>
                      <Link href="/rewards" className={`universal-profile-menu-link${isActiveRoute("/rewards") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
                        <Award size={16} /> {t.rewards}
                      </Link>
                      <Link href="/shop" className={`universal-profile-menu-link${isActiveRoute("/shop") ? " is-active" : ""}`} role="menuitem" onClick={() => setProfileOpen(false)}>
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
                <Link href="/auth" className="universal-profile-menu-link" role="menuitem" onClick={() => setProfileOpen(false)}>
                  <LockKeyhole size={16} /> {t.login}
                </Link>
              )}
            </div>
          )}
        </div>
        <div className={`universal-language-wrap${guestLocked ? " universal-guest-disabled" : ""}`} aria-disabled={guestLocked}>
          <LanguageSwitcher />
        </div>
        {!isHomePage ? (
          <Link
            href="/"
            className="universal-icon-button universal-home-button"
            aria-label={t.home}
            title={t.home}
            onClick={() => {
              setProfileOpen(false);
              setNotificationOpen(false);
            }}
          >
            <Home size={17} aria-hidden="true" />
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
