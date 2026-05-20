"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

import {
  ArrowRight,
  Clock3,
  Inbox,
  LockKeyhole,
  MessageCircle,
  Plus,
  ShieldCheck,
  Trash2,
  UserCircle2
} from "lucide-react";

import {
  getConversationSummaries,
  supabase,
  type ConversationSummary
} from "@/lib/supabase";

import { formatPrice } from "@/lib/listings";

function formatDate(value?: string) {

  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "fi-FI",
    {
      day: "numeric",
      month: "numeric",
      year: "numeric"
    }
  ).format(date);

}

function formatName(
  conversation: ConversationSummary,
  userId: string
) {

  const profile =
    conversation.other_profile;

  const fullName =
    profile
      ? (
          profile.full_name ||
          profile.name ||
          profile.username ||
          `${profile.first_name ?? ""} ${
            profile.last_name ?? ""
          }`
            .replace(/\s+/g, " ")
            .trim()
        )
      : "";

  if (fullName) {
    return fullName;
  }

  if (
    conversation.buyer_id === userId &&
    conversation.listing?.seller_name
  ) {
    return conversation.listing.seller_name;
  }

  return "Käyttäjä";

}

function notifyIncomingMessage(
  content?: string
) {

  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return;
  }

  const showNotification = () => {
    new Notification(
      "Uusi viesti",
      {
        body:
          content ||
          "Kuva"
      }
    );
  };

  if (Notification.permission === "granted") {
    showNotification();
    return;
  }

  if (Notification.permission === "default") {
    Notification
      .requestPermission()
      .then((permission) => {
        if (permission === "granted") {
          showNotification();
        }
      });
  }

}

function hiddenConversationsKey(userId: string) {
  return `hiddenConversations:${userId}`;
}

function readHiddenConversationIds(userId: string) {
  try {
    const hidden = JSON.parse(
      localStorage.getItem(hiddenConversationsKey(userId)) || "[]"
    );

    return Array.isArray(hidden)
      ? hidden.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export default function MessagesPage() {
  const { t } = useLanguage();

  const [loading, setLoading] =
    useState(true);

  const [userId, setUserId] =
    useState("");

  const [conversations, setConversations] =
    useState<ConversationSummary[]>([]);

  useEffect(() => {

    let stopped = false;

    async function loadMessages() {
      try {
        if (!supabase) {
          return;
        }

        const {
          data: { user }
        } =
          await supabase.auth.getUser();

        if (!user) {
          return;
        }

        setUserId(user.id);

        const hiddenIds = readHiddenConversationIds(user.id);
        const { data } =
          await getConversationSummaries(
            user.id
          );

        if (!stopped) {
          setConversations(
            (data ?? []).filter(
              (conversation) =>
                !hiddenIds.includes(conversation.id)
            )
          );
        }
      } catch (error) {
        console.error("Messages load failed:", error);
      } finally {
        if (!stopped) {
          setLoading(false);
        }
      }

    }

    loadMessages();

    return () => {
      stopped = true;
    };

  }, []);

  useEffect(() => {

    if (
      !supabase ||
      !userId
    ) {
      return;
    }

    const client =
      supabase;

    let lastNotifiedMessageId = "";

    const refreshConversations =
      async () => {

        const { data } =
          await getConversationSummaries(
            userId
          );

        setConversations(
          (data ?? []).filter(
            (conversation) =>
              !readHiddenConversationIds(userId).includes(conversation.id)
          )
        );

      };

    const channel =
      client
        .channel(
          `messages-page-${userId}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter:
              `receiver_id=eq.${userId}`
          },
          (payload: {
            new: {
              id: string;
              content?: string | null;
            };
          }) => {

            refreshConversations();

            if (
              lastNotifiedMessageId !==
              String(payload.new.id)
            ) {
              lastNotifiedMessageId =
                String(payload.new.id);

              notifyIncomingMessage(
                payload.new.content || ""
              );
            }

          }
        )
        .subscribe();

    const interval =
      window.setInterval(
        refreshConversations,
        5000
      );

    return () => {
      window.clearInterval(interval);
      channel.unsubscribe();
    };

  }, [userId]);

  function hideConversation(
    event: React.MouseEvent,
    conversationId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    const current = readHiddenConversationIds(userId);
    const next = current.includes(conversationId)
      ? current
      : [...current, conversationId];

    localStorage.setItem(
      hiddenConversationsKey(userId),
      JSON.stringify(next)
    );

    setConversations((prev) =>
      prev.filter((conversation) => conversation.id !== conversationId)
    );
  }

  const latestConversationDate =
    conversations[0]?.last_message?.created_at ||
    conversations[0]?.updated_at ||
    conversations[0]?.created_at;

  return (

    <main className="messages-page">
      <section className="messages-shell">

        <div className="messages-hero">

          <div className="messages-hero-main">
            <span className="eyebrow">
              <MessageCircle size={16} />
              {t.messages}
            </span>

            <h1>
              Keskustelut
            </h1>

            <p className="messages-hero-lead">
              Täältä näet kaikki saamasi viestit ja keskustelut ostajien kanssa.
            </p>
          </div>

          <div className="messages-hero-copy">
            <span>
              <ShieldCheck size={16} />
              Jokainen ilmoitus avaa oman ostajan ja myyjän välisen keskustelun.
            </span>
            <span>
              <LockKeyhole size={16} />
              Keskustelut ovat sidottu ilmoituksiin
            </span>
          </div>

        </div>

        <div className="messages-stats" aria-label="Viestien yhteenveto">
          <div className="messages-stat-card">
            <span className="messages-stat-icon messages-stat-icon-cyan">
              <Inbox size={20} />
            </span>
            <div className="messages-stat-text">
              <span className="messages-stat-label">Keskustelut</span>
              <strong>{loading ? "..." : conversations.length}</strong>
              <small>Avoimia keskusteluja</small>
            </div>
          </div>
          <div className="messages-stat-card">
            <span className="messages-stat-icon messages-stat-icon-mint">
              <Clock3 size={20} />
            </span>
            <div className="messages-stat-text">
              <span className="messages-stat-label">Viimeisin</span>
              <strong>{latestConversationDate ? formatDate(latestConversationDate) : "–"}</strong>
              <small>{latestConversationDate ? "Viimeisin viesti" : "Ei viimeisintä viestiä"}</small>
            </div>
          </div>
          <div className="messages-stat-card">
            <span className="messages-stat-icon messages-stat-icon-violet">
              <UserCircle2 size={20} />
            </span>
            <div className="messages-stat-text">
              <span className="messages-stat-label">Tila</span>
              <strong>{userId ? "Aktiivinen" : "Kirjaudu"}</strong>
              <small>{userId ? <>Tili on <span className="messages-stat-positive">aktiivinen</span></> : "Kirjautuminen vaaditaan"}</small>
            </div>
          </div>
        </div>

        {!loading && !userId && (

          <div className="profile-alert messages-state-card">

            <LockKeyhole size={20} />

            <span>
              Kirjaudu sisään nähdäksesi
              viestisi.
            </span>

            <Link href="/auth">
              {t.login}
            </Link>

          </div>

        )}

        {loading && (
          <div className="conversation-list">
            {[0, 1, 2].map((item) => (
              <div className="conversation-card conversation-skeleton" key={item}>
                <span />
                <div>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading &&
          userId &&
          conversations.length === 0 && (

          <div className="messages-empty">

            <span className="messages-empty-icon">
              <MessageCircle size={28} />
            </span>

            <h2>Ei keskusteluja vielä.</h2>
            <p>Kun saat viestejä ilmoituksiisi, ne näkyvät täällä.</p>

            <Link href="/" className="messages-empty-cta">
              <Plus size={16} />
              Selaa ilmoituksia
            </Link>

          </div>

        )}

        <div className="conversation-list">

          {conversations.map(
            (conversation) => {

              const lastMessage =
                conversation.last_message;

              const isOwnLastMessage =
                lastMessage?.sender_id === userId;

              return (

                <article
                  className="conversation-card"
                  key={conversation.id}
                >

                  <Link
                    className="conversation-image"
                    href={`/listing/${conversation.listing_id}`}
                    aria-label={`Avaa ilmoitus ${conversation.listing?.title ?? ""}`}
                  >
                    <img
                      src={
                        conversation.listing
                          ?.image_url ||
                        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3"
                      }
                      alt={
                        conversation.listing
                          ?.title ?? ""
                      }
                    />
                  </Link>

                  <Link
                    className="conversation-main"
                    href={`/messages/${conversation.listing_id}?conversation=${conversation.id}`}
                  >

                    <div className="conversation-head">

                      <div>
                        <strong>
                          {formatName(
                            conversation,
                            userId
                          )}
                        </strong>

                      </div>

                      <time>
                        {formatDate(
                          lastMessage
                            ?.created_at ||
                            conversation.updated_at ||
                            conversation.created_at
                        )}
                      </time>

                    </div>

                    <div className="conversation-title-row">
                      <h2>
                        {conversation.listing
                          ?.title ||
                          "Ilmoitus"}
                      </h2>

                      {conversation.listing && (
                        <small>
                          {formatPrice(
                            conversation.listing.price
                          )}
                        </small>
                      )}
                    </div>

                    <p>
                      {lastMessage
                        ? `${
                            isOwnLastMessage
                              ? "Sinä: "
                              : ""
                          }${
                            lastMessage.content ||
                            "Kuva"
                          }`
                        : "Keskustelu aloitettu"}
                    </p>

                    <span className="conversation-open">
                      Avaa keskustelu
                      <ArrowRight size={15} />
                    </span>

                  </Link>

                  <button
                    type="button"
                    className="conversation-delete"
                    aria-label="Piilota keskustelu"
                    onClick={(event) =>
                      hideConversation(event, conversation.id)
                    }
                  >
                    <Trash2 size={18} />
                  </button>

                </article>

              );

            }
          )}

        </div>

      </section>

      <style>{`
        .messages-page {
          min-height: 100vh;
          padding: clamp(18px, 3vw, 34px) 0 88px;
          background:
            radial-gradient(760px 320px at 90% -8%, rgba(255, 122, 26, 0.12), transparent 62%),
            radial-gradient(680px 300px at 8% 0%, rgba(64, 216, 255, 0.08), transparent 68%),
            #0b1118 !important;
          color: #f4f8fc;
        }

        .messages-shell {
          width: min(1240px, calc(100vw - 32px));
          margin: 0 auto;
          display: grid;
          gap: 16px;
        }

        .messages-hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 0.72fr);
          align-items: center;
          gap: clamp(18px, 4vw, 38px);
          padding: clamp(22px, 4vw, 34px);
          border: 1px solid rgba(151, 178, 205, 0.18);
          border-radius: 24px;
          background:
            radial-gradient(720px 260px at 96% 0%, rgba(255, 122, 26, 0.18), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.96), rgba(7, 17, 29, 0.98));
          box-shadow: 0 24px 70px rgba(0, 7, 18, 0.34), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .messages-hero-main {
          min-width: 0;
        }

        .messages-hero .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: #ffb45f !important;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .messages-hero h1 {
          margin: 0;
          color: #fff;
          font-size: clamp(2.1rem, 5vw, 3.5rem);
          font-weight: 950;
          letter-spacing: -0.04em;
          line-height: 0.98;
        }

        .messages-hero-lead {
          max-width: 560px;
          margin: 10px 0 0;
          color: rgba(226, 244, 255, 0.72) !important;
          font-size: 14px;
          font-weight: 750;
          line-height: 1.5;
        }

        .messages-hero-copy {
          display: grid;
          gap: 10px;
          align-content: center;
          justify-self: end;
          width: min(100%, 430px);
        }

        .messages-hero-copy span {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border: 1px solid rgba(151, 178, 205, 0.16);
          border-radius: 14px;
          background: rgba(3, 12, 24, 0.42);
          color: rgba(244, 248, 252, 0.9) !important;
          font-size: 13px;
          font-weight: 750;
          line-height: 1.35;
        }

        .messages-hero-copy svg {
          flex: 0 0 auto;
          color: #ffb45f;
          margin-top: 1px;
        }

        .messages-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .messages-stat-card {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          padding: 16px;
          border: 1px solid rgba(151, 178, 205, 0.18);
          border-radius: 18px;
          background:
            radial-gradient(360px 160px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.9), rgba(7, 17, 29, 0.96));
          box-shadow: 0 18px 46px rgba(0, 7, 18, 0.24), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .messages-stat-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          color: #fff;
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%) !important;
          box-shadow: 0 14px 28px rgba(255, 122, 26, 0.22);
        }

        .messages-stat-text {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .messages-stat-label {
          color: rgba(226, 244, 255, 0.62) !important;
          font-size: 12px;
          font-weight: 900;
        }

        .messages-stat-text strong {
          color: #fff;
          font-size: 20px;
          font-weight: 950;
          line-height: 1.1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-stat-text small {
          color: rgba(226, 244, 255, 0.68);
          font-size: 12px;
          font-weight: 750;
          line-height: 1.25;
        }

        .messages-stat-positive {
          color: #ffb45f !important;
          font-weight: 950;
        }

        .messages-empty,
        .messages-state-card {
          min-height: 240px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 12px;
          text-align: center;
          padding: 34px;
          border: 1px dashed rgba(151, 178, 205, 0.24);
          border-radius: 22px;
          background:
            radial-gradient(460px 200px at 50% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            rgba(13, 29, 46, 0.52);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }

        .messages-empty-icon {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          color: #fff;
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%) !important;
          box-shadow: 0 16px 34px rgba(255, 122, 26, 0.24);
        }

        .messages-empty h2 {
          margin: 0;
          color: #fff;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .messages-empty p {
          margin: 0;
          color: rgba(226, 244, 255, 0.72) !important;
          font-size: 14px;
          font-weight: 750;
        }

        .messages-empty-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          margin-top: 4px;
          padding: 0 16px;
          border-radius: 13px;
          border: 1px solid rgba(255, 210, 165, 0.58);
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%) !important;
          color: #fff !important;
          font-weight: 950;
          text-decoration: none;
          box-shadow: 0 16px 34px rgba(255, 122, 26, 0.22);
        }

        .conversation-list {
          display: grid;
          gap: 14px;
        }

        .conversation-card {
          display: grid;
          grid-template-columns: 112px minmax(0, 1fr) 42px;
          align-items: center;
          gap: 16px;
          padding: 14px;
          border: 1px solid rgba(151, 178, 205, 0.18);
          border-radius: 18px;
          background:
            radial-gradient(420px 160px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            linear-gradient(145deg, rgba(13, 29, 46, 0.94), rgba(7, 17, 29, 0.98));
          box-shadow: 0 18px 50px rgba(0, 7, 18, 0.24), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .conversation-image {
          width: 112px;
          aspect-ratio: 4 / 3;
          border-radius: 14px;
          overflow: hidden;
          background: rgba(3, 12, 24, 0.72);
          border: 1px solid rgba(151, 178, 205, 0.14);
        }

        .conversation-image img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .conversation-main {
          min-width: 0;
          display: grid;
          gap: 8px;
          color: inherit;
          text-decoration: none;
        }

        .conversation-head,
        .conversation-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          min-width: 0;
        }

        .conversation-head strong,
        .conversation-title-row h2 {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .conversation-head strong {
          display: block;
          color: #fff;
          font-size: 14px;
          font-weight: 950;
        }

        .conversation-head time,
        .conversation-main p {
          color: rgba(226, 244, 255, 0.66);
          font-size: 13px;
          font-weight: 750;
        }

        .conversation-title-row h2 {
          margin: 0;
          color: #fff;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .conversation-title-row small {
          flex: 0 0 auto;
          border: 1px solid rgba(56, 189, 248, 0.34);
          border-radius: 999px;
          background: rgba(14, 165, 233, 0.14);
          color: #7dd3fc;
          font-size: 12px;
          font-weight: 950;
          padding: 6px 9px;
        }

        .conversation-main p {
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .conversation-open {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          width: fit-content;
          color: #ffb45f !important;
          font-size: 13px;
          font-weight: 950;
        }

        .conversation-delete {
          width: 40px;
          height: 40px;
          border-radius: 13px;
          border: 1px solid rgba(255, 113, 113, 0.24);
          background: rgba(220, 38, 38, 0.1);
          color: #ff8c8c;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .conversation-delete:hover {
          background: rgba(220, 38, 38, 0.18);
          border-color: rgba(255, 113, 113, 0.42);
          color: #fff;
        }

        .conversation-skeleton span,
        .conversation-skeleton i {
          border-radius: 12px;
          background: linear-gradient(90deg, rgba(151,178,205,0.08), rgba(151,178,205,0.16), rgba(151,178,205,0.08));
          background-size: 220% 100%;
          animation: messagesPulse 1.4s ease-in-out infinite;
        }

        .conversation-skeleton > span {
          width: 112px;
          aspect-ratio: 4 / 3;
        }

        .conversation-skeleton div {
          display: grid;
          gap: 9px;
        }

        .conversation-skeleton i {
          display: block;
          height: 16px;
        }

        .conversation-skeleton i:nth-child(1) { width: 42%; }
        .conversation-skeleton i:nth-child(2) { width: 70%; }
        .conversation-skeleton i:nth-child(3) { width: 54%; }

        @keyframes messagesPulse {
          0% { background-position: 0% 50%; }
          100% { background-position: -220% 50%; }
        }

        @media (max-width: 860px) {
          .messages-page {
            padding-top: 14px;
          }

          .messages-shell {
            width: min(100% - 24px, 1240px);
          }

          .messages-hero {
            grid-template-columns: 1fr;
            border-radius: 20px;
            padding: 20px;
          }

          .messages-hero-copy {
            justify-self: stretch;
            width: 100%;
          }

          .messages-stats {
            grid-template-columns: 1fr;
          }

          .conversation-card {
            grid-template-columns: 82px minmax(0, 1fr) 38px;
            gap: 12px;
            padding: 12px;
          }

          .conversation-image,
          .conversation-skeleton > span {
            width: 82px;
          }

          .conversation-title-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 7px;
          }
        }

        @media (max-width: 560px) {
          .conversation-card {
            align-items: start;
            grid-template-columns: 74px minmax(0, 1fr) auto;
            gap: 10px;
            padding: 12px;
          }

          .conversation-image,
          .conversation-skeleton > span {
            grid-row: 2 / 5;
            width: 74px;
          }

          .conversation-main {
            display: contents;
          }

          .conversation-head {
            align-items: center;
            grid-column: 1 / -1;
            grid-row: 1;
            width: 100%;
          }

          .conversation-head strong,
          .conversation-head time {
            min-width: 0;
          }

          .conversation-title-row {
            grid-column: 2 / -1;
            grid-row: 2;
            min-width: 0;
          }

          .conversation-title-row h2 {
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            display: -webkit-box;
            font-size: 16px;
            line-clamp: 2;
            line-height: 1.15;
            max-width: 100%;
            overflow: hidden;
            overflow-wrap: anywhere;
            text-overflow: clip;
            white-space: normal;
          }

          .conversation-title-row small {
            justify-self: start;
          }

          .conversation-main p {
            grid-column: 2 / -1;
            grid-row: 3;
            overflow: visible;
            white-space: normal;
            word-break: break-word;
          }

          .conversation-open {
            grid-column: 2 / 3;
            grid-row: 4;
          }

          .conversation-main::after {
            display: none;
          }

          .conversation-delete {
            grid-column: 3;
            grid-row: 4;
            justify-self: end;
            width: 34px;
            height: 34px;
          }
        }
      `}</style>

    </main>

  );

}
