"use client";

import { ArrowLeft, Award, Bell, Car, ChevronDown, ClipboardList, DoorOpen, Heart, Home, LockKeyhole, Mail, Menu, MessageCircle, Plus, Star, Store, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  deleteAlertNotification,
  dismissPurchaseReviewRequest,
  getAlertNotifications,
  getConversationSummaries,
  getCurrentUserIsAdmin,
  getPendingPurchaseReviewRequests,
  supabase,
  type AlertNotification,
  type ConversationSummary,
  type PurchaseReviewRequest,
  type UserProfile,
} from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";

export default function UniversalTopbar() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { t } = useLanguage();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileInitial, setProfileInitial] = useState("?");
  const [reviewRequests, setReviewRequests] = useState<PurchaseReviewRequest[]>([]);
  const [alertNotifications, setAlertNotifications] = useState<AlertNotification[]>([]);
  const [unreadConversations, setUnreadConversations] = useState<ConversationSummary[]>([]);
  const [seenNotificationKeys, setSeenNotificationKeys] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    client.auth.getUser().then(async ({ data }) => {
      const nextUserId = data?.user?.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        setAvatarUrl(null);
        setProfileInitial("?");
        return;
      }

      const { data: profile } = await client
        .from("profiles")
        .select("avatar_url,is_completed,account_type,first_name,last_name,full_name,name,company_name,business_id,email,phone,address,postal_code,city,country,birth_date,phone_verified_at")
        .eq("id", nextUserId)
        .maybeSingle<Pick<UserProfile, "avatar_url" | "is_completed" | "account_type" | "first_name" | "last_name" | "full_name" | "name" | "company_name" | "business_id" | "email" | "phone" | "address" | "postal_code" | "city" | "country" | "birth_date" | "phone_verified_at">>();
      setAvatarUrl(profile?.avatar_url ?? null);
      const displayName =
        profile?.company_name ||
        profile?.full_name ||
        profile?.name ||
        `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
        data?.user?.email ||
        "";
      setProfileInitial(displayName.trim().charAt(0).toUpperCase() || "?");
      getCurrentUserIsAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
    });
  }, []);

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

    async function refreshNotifications() {
      const [{ data: reviews }, { data: alerts }, { data: conversations }] = await Promise.all([
        getPendingPurchaseReviewRequests(activeUserId),
        getAlertNotifications(activeUserId),
        getConversationSummaries(activeUserId),
      ]);

      if (cancelled) return;

      const STORAGE_KEY = "chatLastRead";
      let lastRead: Record<string, number> = {};
      try { lastRead = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { /* ok */ }
      const unread = (conversations ?? []).filter((conversation) => {
        const message = conversation.last_message;
        if (!message || message.sender_id === activeUserId) return false;
        return new Date(message.created_at).getTime() > (lastRead[conversation.id] ?? 0);
      });

      setReviewRequests(reviews ?? []);
      setAlertNotifications((alerts ?? []).filter((alert) => !alert.seen));
      setUnreadConversations(unread);

    }

    refreshNotifications();
    const interval = window.setInterval(refreshNotifications, 30000);
    const messagesChannel = client
      .channel("universal-topbar-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${activeUserId}` },
        refreshNotifications
      )
      .subscribe();

    function onReviewDismissed() {
      refreshNotifications();
    }

    window.addEventListener("review-request-dismissed", onReviewDismissed);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("review-request-dismissed", onReviewDismissed);
      client.removeChannel(messagesChannel);
    };
  }, [userId]);

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
    await supabase?.auth.signOut();
    router.push("/");
  }

  const notificationItemCount =
    reviewRequests.filter((request) => !seenNotificationKeys.has(`review:${request.id}`)).length +
    alertNotifications.filter((notification) => !seenNotificationKeys.has(`alert:${notification.id}`)).length +
    unreadConversations.filter((conversation) => !seenNotificationKeys.has(`conversation:${conversation.id}`)).length;
  const hasNotifications = notificationItemCount > 0;
  const hasNotificationItems =
    reviewRequests.length +
    alertNotifications.length +
    unreadConversations.length > 0;
  const isHomePage = pathname === "/";
  const hideUniversalTopbar =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin");

  function openCategories() {
    window.dispatchEvent(new CustomEvent("open-category-drawer"));
  }

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  function toggleNotifications() {
    setNotificationOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        setSeenNotificationKeys((prev) => {
          const next = new Set(prev);
          reviewRequests.forEach((request) => next.add(`review:${request.id}`));
          alertNotifications.forEach((notification) => next.add(`alert:${notification.id}`));
          unreadConversations.forEach((conversation) => next.add(`conversation:${conversation.id}`));
          return next;
        });
      }
      return nextOpen;
    });
  }

  if (hideUniversalTopbar) {
    return null;
  }

  return (
    <header className="universal-app-topbar">
      {!isHomePage ? (
        <button type="button" className="universal-return-button" onClick={goBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          <strong>Takaisin</strong>
        </button>
      ) : null}
      <nav className="universal-topbar-actions" aria-label="Pikatoiminnot">
        <Link href="/sell" className="universal-create-button">
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
                <strong>Ilmoitukset</strong>
                {hasNotificationItems ? <span>{reviewRequests.length + alertNotifications.length + unreadConversations.length}</span> : null}
              </div>

              {!hasNotificationItems ? (
                <p className="universal-notification-empty">{t.noNotifications}</p>
              ) : null}

              <div className="universal-notification-body">
              {unreadConversations.length > 0 ? (
                <div className="universal-notification-group">
                  <span>{t.messages}</span>
                  {unreadConversations.map((conversation) => {
                    const other = conversation.other_profile;
                    const name = other?.full_name || other?.name || `${other?.first_name ?? ""} ${other?.last_name ?? ""}`.trim() || "Käyttäjä";
                    return (
                      <div key={conversation.id} className="universal-notification-item-wrap">
                        <Link
                          href={`/messages?conv=${conversation.id}`}
                          className="universal-notification-item"
                          role="menuitem"
                          onClick={() => setNotificationOpen(false)}
                        >
                          <span className="universal-notification-item-icon"><MessageCircle size={15} /></span>
                          <span>
                            <strong>{name}</strong>
                            <small>{conversation.last_message?.content?.slice(0, 58) ?? ""}</small>
                          </span>
                        </Link>
                        <button
                          type="button"
                          className="universal-notif-dismiss"
                          title="Poista"
                          onClick={(e) => { e.stopPropagation(); setUnreadConversations(prev => prev.filter(c => c.id !== conversation.id)); }}
                        ><X size={11} /></button>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {reviewRequests.length > 0 ? (
                <div className="universal-notification-group">
                  <span>{t.reviews}</span>
                  {reviewRequests.map((request) => (
                    <div key={request.id} className="universal-notification-item-wrap">
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

              {alertNotifications.length > 0 ? (
                <div className="universal-notification-group">
                  <span>{t.saTitle}</span>
                  {alertNotifications.map((notification) => (
                    <div key={notification.id} className="universal-notification-item-wrap">
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
            </div>
          )}
        </div>
        <div className="universal-profile-menu-wrap" ref={profileMenuRef}>
          <button
            type="button"
            className={`universal-profile-button${profileOpen ? " is-open" : ""}`}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className="universal-profile-avatar" aria-hidden="true">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="profile-avatar-initial">{profileInitial}</span>
              )}
            </span>
            <strong>Profiili</strong>
            <ChevronDown size={14} aria-hidden="true" />
          </button>

          {profileOpen && (
            <div className="universal-profile-menu" role="menu">
              {userId ? (
                <>
                  {!isHomePage ? (
                    <Link href="/" className="universal-profile-menu-link" role="menuitem" onClick={() => setProfileOpen(false)}>
                      <Home size={16} /> {t.home}
                    </Link>
                  ) : null}
                  <Link href="/profile" className="universal-profile-menu-link" role="menuitem" onClick={() => setProfileOpen(false)}>
                    <User size={16} /> {t.editProfile}
                  </Link>
                  <Link href="/my-listings" className="universal-profile-menu-link" role="menuitem" onClick={() => setProfileOpen(false)}>
                    <ClipboardList size={16} /> {t.myListings}
                  </Link>
                  <Link href="/garage" className="universal-profile-menu-link" role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Car size={16} /> {t.garageTitle}
                  </Link>
                  <Link href="/messages" className="universal-profile-menu-link" role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Mail size={16} /> {t.messages}
                  </Link>
                  <Link href="/saved" className="universal-profile-menu-link" role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Heart size={16} /> {t.savedListings}
                  </Link>
                  <Link href="/rewards" className="universal-profile-menu-link" role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Award size={16} /> {t.rewards}
                  </Link>
                  <Link href="/shop" className="universal-profile-menu-link" role="menuitem" onClick={() => setProfileOpen(false)}>
                    <Store size={16} /> {t.shop}
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="universal-profile-menu-link admin" role="menuitem" onClick={() => setProfileOpen(false)}>
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
        <LanguageSwitcher />
        {isHomePage ? (
          <button
            type="button"
            className="universal-category-button"
            aria-label="Avaa kategoriat"
            onClick={openCategories}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        ) : null}
      </nav>
    </header>
  );
}
