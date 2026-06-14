"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Award, Bell, Car, ClipboardList, DoorOpen, Heart, Home, LockKeyhole, Mail, MessageCircle, Plus, Store, UserRound, Users } from "lucide-react";
import {
  CHAT_NOTIFICATIONS_CHANGED_EVENT,
  getPendingPurchaseReviewRequests,
  getAlertNotifications,
  getUnreadConversationSummaries,
  isConversationLastMessageUnread,
  markConversationRead,
  markNotificationsSeen,
  readChatLastRead,
  supabase,
  type AlertNotification,
  type ConversationSummary,
  type PurchaseReviewRequest,
} from "@/lib/supabase";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { useLanguage } from "@/lib/i18n";

const LOCALES = [
  { code: "fi", label: "Suomi", iso: "fi" },
  { code: "en", label: "English", iso: "gb" },
  { code: "sv", label: "Svenska", iso: "se" },
  { code: "no", label: "Norsk", iso: "no" },
  { code: "et", label: "Eesti", iso: "ee" },
];

function FlagImg({ iso }: { iso: string }) {
  return (
    <img
      src={`https://flagcdn.com/24x18/${iso}.png`}
      width={22}
      height={16}
      alt=""
      style={{ borderRadius: 3, objectFit: "cover", flexShrink: 0 }}
    />
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useLanguage();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [reviewRequests, setReviewRequests] = useState<PurchaseReviewRequest[]>([]);
  const [alertNotifs, setAlertNotifs] = useState<AlertNotification[]>([]);
  const [unreadConvs, setUnreadConvs] = useState<ConversationSummary[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

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
      setUnreadMessages(unread.length);
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

  const labels: Record<string, string[]> = {
    fi: ["Etusivu", "Ilmoitukset", "Luo", "Viestit", "Profiili"],
    en: ["Home", "Alerts", "New", "Messages", "Profile"],
    sv: ["Hem", "Notiser", "Ny", "Meddelanden", "Profil"],
    no: ["Hjem", "Varsler", "Ny", "Meldinger", "Profil"],
    et: ["Avaleht", "Teated", "Uus", "Sõnumid", "Profiil"],
  };
  const [l0, l1, l2, l3, l4] = labels[locale] ?? labels.fi;

  const handleSignOut = async () => {
    setProfileOpen(false);
    await supabase?.auth.signOut();
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
    setUnreadMessages((count) => Math.max(0, count - 1));
  }

  const selectLocale = (nextLocale: Parameters<typeof setLocale>[0]) => {
    setLocale(nextLocale);
    setProfileOpen(false);
  };

  return (
    <>
      <nav className="bottom-nav" aria-label="Päänavigaatio">
        <Link href="/" className={`bottom-nav-item${pathname === "/" ? " active" : ""}`}>
          <span className="bottom-nav-icon"><Home size={22} /></span>
          <span className="bottom-nav-label">{l0}</span>
        </Link>

        <button type="button" className={`bottom-nav-item${notifOpen ? " active" : ""}`} onClick={() => {
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
          <span className="bottom-nav-label">{l1}</span>
        </button>

        <Link href="/sell" className={`bottom-nav-item bottom-nav-solid${pathname.startsWith("/sell") ? " active" : ""}`}>
          <span className="bottom-nav-icon"><Plus size={24} /></span>
          <span className="bottom-nav-label">{l2}</span>
        </Link>

        <Link href="/messages" className={`bottom-nav-item${pathname.startsWith("/messages") ? " active" : ""}`}>
          <span className="bottom-nav-icon">
            <MessageCircle size={22} />
            {unreadMessages > 0 && <span className="bottom-nav-badge">{unreadMessages > 9 ? "9+" : unreadMessages}</span>}
          </span>
          <span className="bottom-nav-label">{l3}</span>
        </Link>

        <button type="button"
          className={`bottom-nav-item${pathname.startsWith("/profile") || pathname.startsWith("/my-listings") ? " active" : ""}`}
          onClick={() => setProfileOpen(true)}>
          <span className="bottom-nav-icon"><UserRound size={22} /></span>
          <span className="bottom-nav-label">{l4}</span>
        </button>
      </nav>

      {profileOpen && (
        <div className="bn-sheet-backdrop" onClick={() => setProfileOpen(false)}>
          <div ref={sheetRef} className="bn-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bn-sheet-handle" />

            {userId ? (
              <>
                <Link href="/profile"    className="bn-sheet-link" onClick={() => setProfileOpen(false)}><UserRound size={18} />{t.editProfile}</Link>
                <Link href="/my-listings" className="bn-sheet-link" onClick={() => setProfileOpen(false)}><ClipboardList size={18} />{t.myListings}</Link>
                <Link href="/garage"     className="bn-sheet-link" onClick={() => setProfileOpen(false)}><Car size={18} />{t.garageTitle}</Link>
                <Link href="/messages"   className="bn-sheet-link" onClick={() => setProfileOpen(false)}><Mail size={18} />{t.messages}</Link>
                <Link href="/saved"      className="bn-sheet-link" onClick={() => setProfileOpen(false)}><Heart size={18} />{t.savedListings}</Link>
                <Link href="/followed"   className="bn-sheet-link" onClick={() => setProfileOpen(false)}><Users size={18} />Seuratut</Link>
                {FEATURE_FLAGS.rewardsAndShop ? (
                  <>
                    <Link href="/rewards"    className="bn-sheet-link" onClick={() => setProfileOpen(false)}><Award size={18} />{t.rewards}</Link>
                    <Link href="/shop"      className="bn-sheet-link" onClick={() => setProfileOpen(false)}><Store size={18} />{t.shop}</Link>
                  </>
                ) : null}
                <div className="bn-sheet-divider" />
                <div className="bn-sheet-lang">
                  {LOCALES.map((loc) => (
                    <button key={loc.code} type="button"
                      className={`bn-lang-btn${locale === loc.code ? " active" : ""}`}
                      data-locale-option={loc.code}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectLocale(loc.code as Parameters<typeof setLocale>[0]);
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectLocale(loc.code as Parameters<typeof setLocale>[0]);
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectLocale(loc.code as Parameters<typeof setLocale>[0]);
                      }}>
                      <FlagImg iso={loc.iso} />
                      {loc.label}
                    </button>
                  ))}
                </div>
                <div className="bn-sheet-divider" />
                <button type="button" className="bn-sheet-signout" onClick={handleSignOut}><DoorOpen size={18} />{t.signOut}</button>
              </>
            ) : (
              <>
                <Link href="/auth" className="bn-sheet-link" onClick={() => setProfileOpen(false)}><LockKeyhole size={18} />{t.login}</Link>
                <div className="bn-sheet-lang">
                  {LOCALES.map((loc) => (
                    <button key={loc.code} type="button"
                      className={`bn-lang-btn${locale === loc.code ? " active" : ""}`}
                      data-locale-option={loc.code}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectLocale(loc.code as Parameters<typeof setLocale>[0]);
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectLocale(loc.code as Parameters<typeof setLocale>[0]);
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectLocale(loc.code as Parameters<typeof setLocale>[0]);
                      }}>
                      <FlagImg iso={loc.iso} />
                      {loc.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {notifOpen && (
        <div className="bn-notif-backdrop" onClick={() => setNotifOpen(false)}>
          <div className="bn-notif-panel" onClick={(e) => e.stopPropagation()}>
            <div className="bn-notif-header">
              <strong>{t.notifications}</strong>
              <button type="button" className="bn-notif-close" onClick={() => setNotifOpen(false)}>✕</button>
            </div>

            {reviewRequests.length === 0 && alertNotifs.filter((a) => !a.seen).length === 0 && unreadConvs.length === 0 && (
              <p className="bn-notif-empty">{t.noNotifications}</p>
            )}

            {unreadConvs.length > 0 && (
              <>
                <div className="bn-notif-group-label">{t.messages}</div>
                {unreadConvs.slice(0, 5).map((c) => {
                  const other = c.other_profile;
                  const name = other?.full_name || other?.name || `${other?.first_name ?? ""} ${other?.last_name ?? ""}`.trim() || "–";
                  return (
                    <Link
                      key={c.id}
                      href={`/messages/${c.listing_id}?conversation=${c.id}`}
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
                <div className="bn-notif-group-label">{t.reviews}</div>
                {[...new Map(reviewRequests.map(r => [r.listing_id ?? r.id, r])).values()].slice(0, 4).map((r) => (
                  <button key={r.id} type="button" className="bn-notif-item"
                    onClick={() => { window.dispatchEvent(new CustomEvent("open-purchase-review", { detail: { requestId: r.id } })); setNotifOpen(false); }}>
                    <span className="bn-notif-icon">★</span>
                    <div>
                      <strong>{t.reviewSeller}</strong>
                      <p>{r.listing_title}</p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {alertNotifs.filter((a) => !a.seen).length > 0 && (
              <>
                <div className="bn-notif-group-label">{t.saTitle}</div>
                {alertNotifs.filter((a) => !a.seen).slice(0, 6).map((n) => (
                  <Link key={n.id} href={`/listing/${n.listing_id}`} className="bn-notif-item" onClick={() => setNotifOpen(false)}>
                    <span className="bn-notif-icon"><Bell size={14} /></span>
                    <div>
                      <strong>{n.listing_title}</strong>
                      <p>{n.listing_price ? `${n.listing_price.toLocaleString("fi-FI")} €` : ""} · {n.alert_label}</p>
                    </div>
                  </Link>
                ))}
              </>
            )}

            <div className="bn-notif-footer">
              <Link href="/search-alerts" className="bn-notif-all" onClick={() => setNotifOpen(false)}>{t.saTitle} →</Link>
              <Link href="/messages" className="bn-notif-all" onClick={() => setNotifOpen(false)}>{t.messages} →</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
