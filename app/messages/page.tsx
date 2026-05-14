"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n";

import {
  ArrowRight,
  ArrowLeft,
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

      <header className="auth-topbar messages-topbar">
        <Link
          className="back-link messages-back"
          href="/"
        >
          <ArrowLeft size={18} />
          {t.back}
        </Link>
        <LanguageSwitcher />
        <img
          className="arctic-topbar-logo"
          src="/arctic-parts-logo.jpg"
          alt="Arctic Parts"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />

      </header>

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

    </main>

  );

}
