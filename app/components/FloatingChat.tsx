"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  MessageCircle,
  Send,
  X
} from "lucide-react";
import {
  CHAT_NOTIFICATIONS_CHANGED_EVENT,
  getConversationSummaries,
  getSafeAuthUser,
  getMessagesForConversation,
  isConversationLastMessageUnread,
  markConversationRead,
  readChatLastRead,
  rememberConversationReadLocally,
  sendChatMessage,
  supabase,
  type ChatMessage,
  type ConversationSummary
} from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n";
import { playNotificationSound } from "@/lib/notification-sound";
import { resizeMessageImageTo1080p } from "@/app/components/chat/image-processing";
import { listingPath, listingUrlId } from "@/lib/routes";

/* ======================================================
   HELPERS
====================================================== */

function getOtherName(conv: ConversationSummary, userId: string, unknown = "Unknown"): string {
  const p = conv.other_profile;
  if (!p) return unknown;
  return (
    p.full_name ||
    p.name ||
    `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
    p.username ||
    unknown
  );
}

function timeAgo(iso?: string | null, labels = { now: "just now", min: "min", h: "h", d: "d" }): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return labels.now;
  if (m < 60) return `${m} ${labels.min}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${labels.h}`;
  return `${Math.floor(h / 24)} ${labels.d}`;
}

type ChatMessageWithImageFields = ChatMessage & {
  image_url?: string | null;
  attachment_url?: string | null;
  file_url?: string | null;
};

function getMessageImage(message: ChatMessage): string | null {
  const imageMessage = message as ChatMessageWithImageFields;
  return (
    imageMessage.image ||
    imageMessage.image_url ||
    imageMessage.attachment_url ||
    imageMessage.file_url ||
    null
  );
}

function mergeUniqueMessages(
  current: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const seen = new Set<string>();
  const merged: ChatMessage[] = [];

  for (const message of [...current, ...incoming]) {
    const id = String(message.id);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(message);
  }

  return merged;
}

const DISMISSED_KEY = "chatDismissedConvsV2";

function getLastRead(): Record<string, number> {
  return readChatLastRead();
}

function getDismissedConvs(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveDismissedConvs(data: Record<string, number>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(data));
  } catch {}
}

function markRead(convId: string, userId?: string | null) {
  const readAt = Date.now();
  if (userId) {
    void markConversationRead(convId, userId, readAt);
  } else {
    rememberConversationReadLocally(convId, readAt);
  }
}

/* ======================================================
   COMPONENT
====================================================== */

import { usePathname, useRouter } from "next/navigation";

export default function FloatingChat() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [userId, setUserId] = useState<string | null>(null);

  // Älä renderöi admin-sivulla
  const isAdmin = pathname?.startsWith("/admin");
  const isAuthPage = pathname?.startsWith("/auth");
  const isMessagesPage = pathname?.startsWith("/messages");
  const isProfilePage = pathname?.startsWith("/profile");
  const isLegalPage =
    pathname?.startsWith("/privacy") ||
    pathname?.startsWith("/terms");
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [dismissedConvs, setDismissedConvs] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    setDismissedConvs(getDismissedConvs());
  }, []);

  /* --- auth --- */
  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }
    getSafeAuthUser()
      .then((user) => {
        setUserId(user?.id ?? null);
      })
      .catch(() => {
        setUserId(null);
      })
      .finally(() => {
        setAuthChecked(true);
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* --- load conversations --- */
  async function loadConversations() {
    if (!userId) return;
    const { data } = await getConversationSummaries(userId);
    setConversations(data);
    recalcUnread(data);
  }

  useEffect(() => {
    if (userId) loadConversations();
    else {
      setOpen(false);
      setActiveConv(null);
      setConversations([]);
      setMessages([]);
      setUnread(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* --- unread count --- */
  function recalcUnread(convs: ConversationSummary[]) {
    const lastRead = getLastRead();
    setUnread(
      convs.filter((conversation) =>
        isConversationLastMessageUnread(
          conversation,
          userId ?? "",
          lastRead
        )
      ).length
    );
  }

  /* --- realtime: new messages refresh conv list --- */
  useEffect(() => {
    if (!supabase || !userId) return;
    let lastSoundMessageId = "";
    const channelName = `floating-chat-convs-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`
        },
        (payload) => {
          loadConversations();
          const messageId = String((payload.new as ChatMessage).id);
          if (messageId !== lastSoundMessageId) {
            lastSoundMessageId = messageId;
            playNotificationSound();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${userId}`
        },
        () => {
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`
        },
        () => {
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `sender_id=eq.${userId}`
        },
        () => {
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        () => {
          loadConversations();
        }
      )
      .subscribe();
    const refresh = () => {
      void loadConversations();
    };

    window.addEventListener(
      CHAT_NOTIFICATIONS_CHANGED_EVENT,
      refresh
    );
    window.addEventListener(
      "storage",
      refresh
    );

    return () => {
      window.removeEventListener(
        CHAT_NOTIFICATIONS_CHANGED_EVENT,
        refresh
      );
      window.removeEventListener(
        "storage",
        refresh
      );
      supabase?.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* --- load messages for active conversation --- */
  useEffect(() => {
    if (!activeConv) return;
    getMessagesForConversation(activeConv.id).then(({ data }) =>
      setMessages(mergeUniqueMessages([], data ?? []))
    );
    markRead(activeConv.id, userId);
    recalcUnread(conversations);

    if (!supabase) return;
    const channelName = `chat-${activeConv.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConv.id}`
        },
        (payload) => {
          setMessages((prev) =>
            mergeUniqueMessages(prev, [payload.new as ChatMessage])
          );
          markRead(activeConv.id, userId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConv.id}`
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === updated.id
                ? {
                    ...message,
                    ...updated
                  }
                : message
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConv.id}`
        },
        (payload) => {
          const deletedId = String((payload.old as Partial<ChatMessage>).id);
          setMessages((prev) =>
            prev.filter((message) => message.id !== deletedId)
          );
        }
      )
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv?.id]);

  /* --- scroll to bottom --- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* --- send --- */
  async function handleSend() {
    if ((!text.trim() && !imagePreview) || !activeConv || !userId || sending || imageLoading) return;
    const otherId =
      activeConv.buyer_id === userId ? activeConv.seller_id : activeConv.buyer_id;
    const outgoingText = text.trim();
    const outgoingImage = imagePreview;

    setSending(true);
    const { data } = await sendChatMessage({
      conversation_id: activeConv.id,
      listing_id: activeConv.listing_id,
      sender_id: userId,
      receiver_id: otherId,
      content: outgoingText,
      image: outgoingImage
    });

    if (data) {
      setMessages((prev) =>
        mergeUniqueMessages(prev, [data])
      );
    }

    setText("");
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSending(false);
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageLoading(true);

    try {
      setImagePreview(await resizeMessageImageTo1080p(file));
    } finally {
      setImageLoading(false);
      event.target.value = "";
    }
  }

  function handleToggleChat() {
    setOpen((currentOpen) => {
      if (!currentOpen) {
        if (userId) void loadConversations();
      }
      return !currentOpen;
    });
  }

  function isConversationUnread(conversation: ConversationSummary, lastRead = getLastRead()) {
    return isConversationLastMessageUnread(
      conversation,
      userId ?? "",
      lastRead
    );
  }

  function markAllRead() {
    if (!userId) return;

    const lastRead = getLastRead();
    conversations.forEach((conversation) => {
      const lastMessageAt = conversation.last_message?.created_at
        ? new Date(conversation.last_message.created_at).getTime() + 1
        : Date.now();
      lastRead[conversation.id] = Math.max(Date.now(), lastMessageAt);
      void markConversationRead(conversation.id, userId, lastRead[conversation.id]);
    });

    setUnread(0);
  }

  function dismissConversation(event: React.MouseEvent, conversation: ConversationSummary) {
    event.preventDefault();
    event.stopPropagation();

    const lastMessageTime = conversation.last_message?.created_at
      ? new Date(conversation.last_message.created_at).getTime()
      : Date.now();

    setDismissedConvs((current) => {
      const next = { ...current, [conversation.id]: lastMessageTime };
      saveDismissedConvs(next);
      return next;
    });
  }

  if (isAdmin || isAuthPage || isMessagesPage || isProfilePage || isLegalPage) return null;

  const lastReadSnapshot = getLastRead();
  const visibleConversations = conversations.filter((conversation) => {
    const dismissedAt = dismissedConvs[conversation.id];
    if (!dismissedAt) return true;

    const lastMessageTime = conversation.last_message?.created_at
      ? new Date(conversation.last_message.created_at).getTime()
      : 0;
    return lastMessageTime > dismissedAt;
  });
  /* ======================================================
     UI
  ====================================================== */
  return (
    <>
      {/* floating button */}
      <button
        type="button"
        className="rebuilt-chat-button"
        aria-label={t.messages}
        data-chat-open={open ? "true" : "false"}
        onClick={handleToggleChat}
      >
        <MessageCircle size={22} />
        {unread > 0 && (
          <span className="rebuilt-chat-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* panel */}
      {open && (
        <div className="fc-panel">
          {/* header */}
          <div className={`fc-header${userId && !activeConv ? " fc-list-header" : ""}`}>
            {userId && activeConv ? (
              <button className="fc-back" onClick={() => setActiveConv(null)}>
                <ChevronLeft size={18} />
              </button>
            ) : userId ? (
              <span className="fc-head-icon" aria-hidden="true">
                <MessageCircle size={24} />
              </span>
            ) : null}
            <span className="fc-title">
              {userId && activeConv ? getOtherName(activeConv, userId, t.messages) : t.messages}
            </span>
            <div className="fc-header-actions">
              <button className="fc-close" onClick={() => {
                setOpen(false);
              }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {!userId && (
            <div className="fc-login-state">
              <MessageCircle size={24} />
              <strong>{authChecked ? t.login : "Ladataan..."}</strong>
              <span>{authChecked ? "Kirjaudu sisään nähdäksesi viestit." : "Tarkistetaan kirjautumista."}</span>
              {authChecked && (
                <button type="button" onClick={() => router.push("/auth")}>
                  {t.login}
                </button>
              )}
            </div>
          )}

          {/* conversation list */}
          {userId && !activeConv && (
            <div className="fc-list">
              {visibleConversations.length === 0 ? (
                <p className="fc-empty">{t.noMessages ?? "No messages yet."}</p>
              ) : (
                visibleConversations
                  .map((c) => {
                  const isUnread = isConversationUnread(c, lastReadSnapshot);
                  const title = c.last_message?.content || c.listing?.title || "Keskustelu";
                  return (
                    <div key={c.id} className="fc-conv-row">
                      <span className={`fc-row-dot${isUnread ? " is-unread" : ""}`} aria-hidden="true" />
                      <button
                        className={`fc-conv-item${isUnread ? " fc-conv-unread" : ""}`}
                        onClick={() => {
                          setActiveConv(c);
                          markRead(c.id);
                          recalcUnread(conversations);
                        }}
                      >
                        <div className="fc-conv-avatar">
                          {c.listing?.image_url
                            ? <img src={c.listing.image_url} alt="" className="fc-conv-avatar-img" />
                            : getOtherName(c, userId).charAt(0).toUpperCase()
                          }
                        </div>
                        <div className="fc-conv-info">
                          <span className="fc-conv-name">{getOtherName(c, userId)}</span>
                          <span className="fc-conv-last">{title}</span>
                        </div>
                        <span className="fc-conv-meta">
                          <span className="fc-conv-time">{timeAgo(c.last_message?.created_at, {
                              now: t.timeNow ?? "now",
                              min: t.timeMin ?? "min",
                              h: t.timeH ?? "h",
                              d: t.timeD ?? "d"
                            })}</span>
                          {isUnread && <span className="fc-unread-count">1</span>}
                          <ChevronRight size={24} aria-hidden="true" />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="fc-conv-dismiss"
                        aria-label="Piilota ilmoitus"
                        title="Piilota ilmoitus"
                        onClick={(event) => dismissConversation(event, c)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })
              )}
              {visibleConversations.length > 0 && (
                <div className="fc-list-footer">
                  <button type="button" className="fc-read-all" onClick={markAllRead}>
                    <span><Check size={16} /></span>
                    Mark all as read
                  </button>
                  <Link href="/messages" className="fc-view-all" onClick={() => setOpen(false)}>
                    View all messages
                    <ChevronRight size={18} />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* messages view */}
          {userId && activeConv && (
            <>
              {activeConv.listing && (
                <Link
                  href={listingPath(listingUrlId(activeConv.listing ?? { id: activeConv.listing_id }), locale)}
                  className="fc-listing-bar"
                  onClick={() => setOpen(false)}
                >
                  <img src={activeConv.listing.image_url} alt="" className="fc-listing-img" />
                  <div className="fc-listing-copy">
                    <div className="fc-listing-title">{activeConv.listing.title}</div>
                  </div>
                  {typeof activeConv.listing.price === "number" && (
                    <div className="fc-listing-price">
                      {activeConv.listing.price.toLocaleString("fi-FI")} €
                    </div>
                  )}
                </Link>
              )}

              <div className="fc-messages">
                {messages.map((m) => {
                  const messageImage = getMessageImage(m);
                  const hasText = Boolean(m.content?.trim());

                  return (
                    <div
                      key={m.id}
                      className={`fc-msg${m.sender_id === userId ? " fc-msg-mine" : " fc-msg-other"}${messageImage ? " fc-msg-has-image" : ""}${!hasText ? " fc-msg-image-only" : ""}`}
                    >
                      {messageImage && (
                        <img src={messageImage} alt="" className="fc-msg-image" />
                      )}
                      {hasText && <span>{m.content}</span>}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="fc-compose">
                {imagePreview && (
                  <div className="fc-image-preview">
                    <img src={imagePreview} alt="" />
                    <span>Kuva mukana</span>
                    <button
                      type="button"
                      aria-label="Poista kuva"
                      onClick={() => {
                        setImagePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
                {imageLoading && (
                  <div className="fc-image-preview fc-image-loading">
                    <span>Kuva latautuu...</span>
                  </div>
                )}

                <div className="fc-input-row">
                  <button
                    type="button"
                    className="fc-attach"
                    aria-label="Lisää kuva"
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      fileInputRef.current?.click();
                    }}
                  >
                    <ImagePlus size={17} />
                  </button>
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                  />
                  <input
                    className="fc-input"
                    placeholder="Kirjoita viesti..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  />
                  <button
                    className="fc-send"
                    onClick={handleSend}
                    disabled={(!text.trim() && !imagePreview) || sending || imageLoading}
                    aria-label="Lähetä viesti"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        .rebuilt-chat-button {
          position: fixed !important;
          bottom: 28px !important;
          right: 28px !important;
          min-width: 0 !important;
          width: 46px !important;
          height: 46px !important;
          border-radius: 50% !important;
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 52%, #e65300 100%) !important;
          color: white !important;
          border: 1px solid rgba(255, 220, 190, 0.72) !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          box-shadow: 0 8px 26px rgba(255,107,22,0.46), 0 2px 8px rgba(0,0,0,0.18) !important;
          pointer-events: auto !important;
          isolation: isolate !important;
          z-index: 2147483647 !important;
          transition: transform 0.15s, box-shadow 0.15s !important;
        }
        .rebuilt-chat-button:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 12px 36px rgba(255,107,22,0.56) !important;
        }
        .rebuilt-chat-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 20px;
          height: 20px;
          border-radius: 10px;
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          border: 2px solid white;
          pointer-events: none;
        }
        .fc-panel {
          position: fixed;
          bottom: 92px;
          right: 28px;
          width: 360px;
          max-height: 560px;
          background: #f7fbff;
          border-radius: 18px;
          box-shadow: 0 24px 70px rgba(2, 10, 20, 0.38), 0 2px 10px rgba(15,23,42,0.12);
          border: 1px solid rgba(203, 213, 225, 0.92);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          pointer-events: auto;
          isolation: isolate !important;
          z-index: 2147483646 !important;
        }
        .fc-header {
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 56px;
          padding: 10px 12px;
          background: #3f4a56;
          border-bottom: 1px solid rgba(15, 23, 42, 0.22);
          flex-shrink: 0;
        }
        .fc-back {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 9px;
          cursor: pointer;
          color: #eaf2fb;
          height: 30px;
          justify-content: center;
          padding: 0;
          display: flex;
          align-items: center;
          width: 30px;
        }
        .fc-title {
          font-size: 15px;
          font-weight: 900;
          color: #ffffff;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fc-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .fc-all-link {
          font-size: 12px;
          font-weight: 700;
          color: #ff7a1a;
        }
        .fc-close {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 9px;
          cursor: pointer;
          color: #eaf2fb;
          display: flex;
          align-items: center;
          height: 30px;
          justify-content: center;
          padding: 0;
          width: 30px;
        }
        .fc-list {
          overflow-y: auto;
          flex: 1;
        }
        .fc-empty {
          align-items: center;
          display: grid;
          justify-items: center;
          min-height: 150px;
          padding: 28px 24px;
          text-align: center;
          color: #94a3b8;
          font-size: 14px;
        }
        .fc-empty::before {
          content: "💬";
          align-items: center;
          background: rgba(255, 122, 26, 0.12);
          border: 1px solid rgba(255, 122, 26, 0.34);
          border-radius: 999px;
          color: #ff7a1a;
          display: inline-flex;
          font-size: 22px;
          height: 52px;
          justify-content: center;
          margin-bottom: 10px;
          width: 52px;
        }
        .fc-login-state {
          align-items: center;
          display: grid;
          gap: 10px;
          justify-items: center;
          padding: 30px 22px;
          text-align: center;
        }
        .fc-login-state svg {
          color: #ff7a1a;
        }
        .fc-login-state strong {
          color: #0f172a;
          font-size: 16px;
          font-weight: 900;
        }
        .fc-login-state span {
          color: #64748b;
          font-size: 13px;
          font-weight: 650;
          line-height: 1.35;
        }
        .fc-login-state button {
          background: linear-gradient(135deg, #ff9a24, #ff6b16);
          border: 0;
          border-radius: 10px;
          color: #ffffff;
          cursor: pointer;
          font-size: 13px;
          font-weight: 900;
          min-height: 38px;
          padding: 0 18px;
        }
        .fc-conv-row {
          display: flex;
          align-items: center;
          position: relative;
        }
        .fc-conv-row:hover .fc-conv-dismiss { opacity: 1; }
        .fc-conv-dismiss {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: none;
          background: #e2e8f0;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          cursor: pointer;
          transition: opacity 0.15s, background 0.12s;
          z-index: 2;
          flex-shrink: 0;
          padding: 0;
        }
        .fc-conv-dismiss:hover { background: #fecaca; color: #ef4444; }
        .fc-conv-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 16px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s;
          position: relative;
        }
        .fc-conv-item:hover { background: #f8fafc; }
        .fc-conv-unread { background: rgba(255, 122, 26, 0.14); }
        .fc-conv-unread:hover { background: #dbeafe; }
        .fc-conv-avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: white;
          font-size: 15px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
        }
        .fc-conv-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .fc-conv-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .fc-conv-name {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fc-conv-last {
          font-size: 12px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fc-conv-time {
          font-size: 11px;
          color: #94a3b8;
          flex-shrink: 0;
        }
        .fc-unread-dot {
          position: absolute;
          right: 14px;
          bottom: 14px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ff7a1a;
        }
        .fc-listing-bar {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px 12px;
          background: #ffffff;
          border-bottom: 1px solid #dbe5ef;
          flex-shrink: 0;
          text-decoration: none;
        }
        .fc-listing-img {
          width: 46px;
          height: 46px;
          border: 1px solid rgba(203, 213, 225, 0.95);
          border-radius: 9px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .fc-listing-copy {
          flex: 1;
          min-width: 0;
        }
        .fc-listing-title {
          font-size: 12.5px;
          font-weight: 850;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fc-listing-price {
          align-items: center;
          background: #fff1e8;
          border: 1px solid rgba(255, 122, 26, 0.28);
          border-radius: 999px;
          color: #f06a00;
          display: inline-flex;
          flex: 0 0 auto;
          font-size: 14px;
          font-weight: 950;
          justify-content: center;
          min-height: 30px;
          padding: 0 11px;
        }
        .fc-messages {
          flex: 1;
          overflow-y: auto;
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(241, 246, 251, 0.98));
          scrollbar-color: rgba(71, 85, 105, 0.36) transparent;
          scrollbar-width: thin;
        }
        .fc-messages::-webkit-scrollbar {
          width: 8px;
        }
        .fc-messages::-webkit-scrollbar-track {
          background: transparent;
        }
        .fc-messages::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(148, 163, 184, 0.58), rgba(71, 85, 105, 0.46));
          border: 2px solid rgba(247, 251, 255, 0.98);
          border-radius: 999px;
        }
        .fc-messages::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(255, 154, 36, 0.72), rgba(255, 107, 22, 0.68));
        }
        .fc-msg {
          max-width: 75%;
          padding: 8px 11px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.4;
          word-break: break-word;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
          display: grid;
          gap: 6px;
        }
        .fc-msg-mine {
          align-self: flex-end;
          background: linear-gradient(135deg, #ff9a24, #ff6b16);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .fc-msg-other {
          align-self: flex-start;
          background: #f1f5f9;
          color: #0f172a;
          border-bottom-left-radius: 4px;
        }
        .fc-msg-has-image {
          max-width: min(82%, 250px);
          padding: 6px;
        }
        .fc-msg-has-image span {
          display: block;
          padding: 2px 5px 4px;
        }
        .fc-msg-image-only {
          background: transparent;
          box-shadow: none;
          padding: 0;
        }
        .fc-msg-image {
          background:
            radial-gradient(160px 100px at 50% 20%, rgba(255, 122, 18, 0.1), transparent 72%),
            #071826;
          border: 1px solid rgba(226, 244, 255, 0.22);
          border-radius: 13px;
          display: block;
          max-height: 220px;
          max-width: 250px;
          min-height: 120px;
          min-width: 180px;
          object-fit: contain;
          width: 100%;
        }
        .fc-compose {
          background: #ffffff;
          border-top: 1px solid #dbe5ef;
          flex-shrink: 0;
          padding: 10px 12px 12px;
        }
        .fc-image-preview {
          align-items: center;
          background: #f8fafc;
          border: 1px solid #dbe5ef;
          border-radius: 12px;
          display: grid;
          gap: 8px;
          grid-template-columns: 42px minmax(0, 1fr) 28px;
          margin-bottom: 8px;
          padding: 7px;
        }
        .fc-image-preview img {
          border-radius: 8px;
          height: 42px;
          object-fit: cover;
          width: 42px;
        }
        .fc-image-preview span {
          color: #334155;
          font-size: 12px;
          font-weight: 850;
        }
        .fc-image-preview button {
          align-items: center;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 999px;
          color: #dc2626;
          cursor: pointer;
          display: inline-flex;
          height: 28px;
          justify-content: center;
          padding: 0;
          width: 28px;
        }
        .fc-image-loading {
          display: flex;
          grid-template-columns: none;
          min-height: 44px;
        }
        .fc-input-row {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0;
          border-top: 0;
          flex-shrink: 0;
        }
        .fc-attach {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #eef4fa;
          color: #435365;
          border: 1px solid #dbe5ef;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .fc-attach:hover {
          background: #e3edf7;
          color: #0f172a;
        }
        .fc-input {
          flex: 1;
          min-width: 0;
          border: 1px solid #d3deea;
          border-radius: 10px;
          background: #ffffff;
          color: #0f172a;
          height: 38px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 700;
          outline: none;
          transition: border-color 0.15s;
        }
        .fc-input::placeholder {
          color: #64748b;
          opacity: 1;
        }
        .fc-input:focus { border-color: #ff7a1a; }
        .fc-send {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #ff8a24;
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .fc-send:hover { background: linear-gradient(135deg, #ffad45, #ff7825); }
        .fc-send:disabled { background: #94a3b8; cursor: not-allowed; }

        .fc-panel {
          width: min(360px, calc(100vw - 28px)) !important;
          max-height: min(510px, calc(100dvh - 96px)) !important;
          padding: 14px !important;
          border-radius: 16px !important;
          border: 1px solid transparent !important;
          background: transparent !important;
          box-shadow: none !important;
          color: #f8fbff !important;
          gap: 0 !important;
        }

        .fc-list-header,
        .fc-header {
          background-color: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          border: 0 !important;
          min-height: 46px !important;
          padding: 0 0 10px !important;
          gap: 10px !important;
        }

        .fc-head-icon {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: #ff8a1f;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          flex: 0 0 auto;
        }

        .fc-title {
          color: #ffffff !important;
          font-size: clamp(18px, 2vw, 22px) !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
        }

        .fc-header-actions {
          gap: 6px !important;
          margin-left: auto;
        }

        .fc-filter-tabs {
          display: inline-grid;
          grid-template-columns: repeat(2, minmax(66px, 1fr));
          min-height: 34px;
          border: 1px solid rgba(151, 178, 205, 0.18);
          border-radius: 10px;
          overflow: hidden;
          background: rgba(6, 18, 32, 0.52);
        }

        .fc-filter-tabs button {
          border: 0;
          border-left: 1px solid rgba(151, 178, 205, 0.12);
          background: transparent;
          color: rgba(235, 244, 255, 0.9);
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
          padding: 0 10px;
        }

        .fc-filter-tabs button:first-child {
          border-left: 0;
        }

        .fc-filter-tabs button.active {
          color: #ff9828;
          background: rgba(255, 122, 26, 0.12);
          box-shadow: inset 0 0 0 1px rgba(255, 122, 26, 0.32);
        }

        .fc-settings,
        .fc-close,
        .fc-back {
          width: 34px !important;
          height: 34px !important;
          border-radius: 10px !important;
          border: 1px solid rgba(151, 178, 205, 0.18) !important;
          background: rgba(6, 18, 32, 0.58) !important;
          color: #eef6ff !important;
          display: grid !important;
          place-items: center !important;
          padding: 0 !important;
          cursor: pointer !important;
        }

        .fc-settings.is-active {
          border-color: rgba(255, 138, 31, 0.5) !important;
          color: #ff9828 !important;
          background: rgba(255, 122, 26, 0.13) !important;
        }

        .fc-close {
          border: 0 !important;
          background: transparent !important;
          color: #f8fbff !important;
        }

        .fc-settings-panel {
          display: grid;
          gap: 0;
          width: 100%;
          padding: 12px 0 0;
          border: 1px solid rgba(151, 178, 205, 0.24);
          border-width: 0;
          border-radius: 0;
          background: #071524 !important;
          box-shadow: 0 18px 44px rgba(0, 8, 18, 0.34) !important;
          color: #f8fbff;
        }

        .fc-list {
          border: 1px solid rgba(138, 161, 183, 0.34);
          border-radius: 14px;
          background: #071524 !important;
          box-shadow: 0 18px 44px rgba(0, 8, 18, 0.34);
          padding: 10px !important;
        }

        .fc-setting-row {
          background: none !important;
          box-shadow: none !important;
        }

        .fc-settings-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
          padding: 0 2px 10px;
          border-bottom: 1px solid rgba(151, 178, 205, 0.18);
        }

        .fc-settings-panel-head span {
          display: grid;
          gap: 3px;
        }

        .fc-settings-panel-head strong {
          color: #ffffff;
          font-size: 15px;
          font-weight: 950;
        }

        .fc-settings-panel-head small {
          color: rgba(202, 216, 232, 0.7);
          font-size: 11px;
          font-weight: 700;
        }

        .fc-settings-panel-head button {
          width: 26px;
          height: 26px;
          border: 0;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: rgba(255, 255, 255, 0.06);
          color: rgba(235, 244, 255, 0.82);
          cursor: pointer;
          padding: 0;
        }

        .fc-setting-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 40px;
          align-items: center;
          gap: 10px;
          min-height: 58px;
          padding: 8px 2px;
          border-top: 1px solid rgba(151, 178, 205, 0.12);
          cursor: pointer;
        }

        .fc-setting-row:first-of-type {
          border-top: 0;
        }

        .fc-setting-row input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .fc-setting-row.is-disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .fc-setting-copy {
          display: grid;
          gap: 2px;
          min-width: 0;
        }

        .fc-setting-copy strong {
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 900;
          line-height: 1.15;
        }

        .fc-setting-copy small {
          color: rgba(202, 216, 232, 0.72);
          font-size: 11px;
          font-weight: 750;
          line-height: 1.2;
        }

        .fc-setting-switch {
          width: 38px;
          height: 22px;
          border-radius: 999px;
          position: relative;
          background: rgba(151, 178, 205, 0.22);
          border: 1px solid rgba(151, 178, 205, 0.22);
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .fc-setting-switch::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: rgba(235, 244, 255, 0.92);
          transition: transform 0.15s ease;
        }

        .fc-setting-row input:checked + .fc-setting-copy + .fc-setting-switch {
          background: rgba(255, 122, 26, 0.28);
          border-color: rgba(255, 138, 31, 0.58);
        }

        .fc-setting-row input:checked + .fc-setting-copy + .fc-setting-switch::after {
          transform: translateX(16px);
          background: #ff9828;
        }

        .fc-list {
          display: grid !important;
          gap: 6px !important;
          max-height: min(420px, calc(100dvh - 180px)) !important;
          padding: 10px 0 0 !important;
          overflow-y: auto !important;
          scrollbar-color: rgba(151, 178, 205, 0.36) transparent;
          scrollbar-width: thin;
        }

        .fc-list::-webkit-scrollbar {
          width: 6px;
        }

        .fc-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .fc-list::-webkit-scrollbar-thumb {
          background: rgba(151, 178, 205, 0.32);
          border-radius: 999px;
        }

        .fc-panel-compact .fc-conv-row {
          min-height: 48px;
        }

        .fc-panel-compact .fc-conv-item {
          min-height: 46px !important;
          padding-block: 4px !important;
        }

        .fc-panel-compact .fc-conv-avatar {
          width: 40px !important;
          height: 34px !important;
        }

        .fc-conv-row {
          display: grid !important;
          grid-template-columns: 16px minmax(0, 1fr);
          align-items: center !important;
          gap: 8px !important;
          min-height: 58px;
          border-bottom: 0;
          position: relative;
        }

        .fc-conv-row:nth-child(2) .fc-conv-item {
          background: rgba(9, 30, 49, 0.72) !important;
          border-color: rgba(151, 178, 205, 0.16) !important;
        }

        .fc-row-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(151, 178, 205, 0.36);
          box-shadow: 0 0 0 4px rgba(151, 178, 205, 0.04);
        }

        .fc-row-dot.is-unread {
          background: #ff8a1f;
          box-shadow: 0 0 0 4px rgba(255, 138, 31, 0.1);
        }

        .fc-conv-item {
          display: grid !important;
          grid-template-columns: 48px minmax(0, 1fr) auto !important;
          align-items: center !important;
          gap: 10px !important;
          width: 100% !important;
          min-height: 56px !important;
          padding: 7px 9px 7px 8px !important;
          border: 1px solid rgba(151, 178, 205, 0.16) !important;
          border-radius: 12px !important;
          background: rgba(9, 30, 49, 0.72) !important;
          color: inherit !important;
        }

        .fc-conv-unread {
          background:
            radial-gradient(320px 110px at 100% 0%, rgba(255, 138, 31, 0.12), transparent 72%),
            rgba(11, 37, 60, 0.84) !important;
          border-color: rgba(255, 138, 31, 0.28) !important;
        }

        .fc-conv-item:hover,
        .fc-conv-unread:hover {
          background:
            radial-gradient(360px 120px at 100% 0%, rgba(48, 147, 255, 0.12), transparent 70%),
            rgba(9, 30, 49, 0.9) !important;
          border-color: rgba(151, 178, 205, 0.22) !important;
        }

        .fc-conv-avatar {
          width: 48px !important;
          height: 42px !important;
          border-radius: 9px !important;
          background: rgba(255, 255, 255, 0.08) !important;
          color: #ffffff !important;
          font-size: 17px !important;
          font-weight: 950 !important;
          border: 1px solid rgba(255, 138, 31, 0.42);
          box-shadow: 0 12px 26px rgba(0, 8, 18, 0.22);
        }

        .fc-conv-avatar-img {
          border-radius: inherit;
        }

        .fc-conv-info {
          gap: 4px !important;
        }

        .fc-conv-name {
          color: #ffffff !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
        }

        .fc-conv-last {
          color: rgba(202, 216, 232, 0.78) !important;
          font-size: 12.5px !important;
          font-weight: 750 !important;
          line-height: 1.28;
          white-space: normal !important;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
        }

        .fc-conv-meta {
          display: grid;
          grid-template-columns: auto auto auto;
          align-items: center;
          gap: 8px;
          color: #ffffff;
          justify-self: end;
        }

        .fc-conv-time {
          color: rgba(202, 216, 232, 0.78) !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          white-space: nowrap;
        }

        .fc-unread-count {
          min-width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          padding: 0 8px;
          color: #ffffff;
          background: linear-gradient(135deg, #ff9a24, #ff6b16);
          font-size: 11px;
          font-weight: 950;
          box-shadow: 0 10px 20px rgba(255, 122, 26, 0.22);
        }

        .fc-conv-meta svg {
          width: 17px;
          height: 17px;
          color: #ffffff;
        }

        .fc-unread-dot {
          display: none !important;
        }

        .fc-conv-dismiss {
          right: 8px !important;
          top: 8px !important;
          transform: none !important;
          width: 18px !important;
          height: 18px !important;
          background: transparent !important;
          color: #ff9828 !important;
          opacity: 0.72 !important;
        }

        .fc-conv-row:hover .fc-conv-dismiss {
          opacity: 1 !important;
        }

        .fc-list-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 2px;
          padding: 8px 0 0 10px;
          position: sticky;
          bottom: 0;
          background: transparent;
        }

        .fc-read-all,
        .fc-view-all {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 34px;
          border: 0;
          background: transparent;
          color: #ff9828;
          cursor: pointer;
          font-size: 12px;
          font-weight: 950;
          text-decoration: none;
        }

        .fc-read-all span {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(255, 122, 26, 0.1);
          color: #ff9828;
        }

        .fc-view-all {
          min-width: 160px;
          border: 1px solid rgba(151, 178, 205, 0.18);
          border-radius: 11px;
          color: #ffffff;
          background: rgba(6, 18, 32, 0.5);
        }

        .fc-empty {
          color: rgba(226, 244, 255, 0.72) !important;
          min-height: 170px !important;
          font-size: 14px !important;
          font-weight: 850 !important;
        }

        .fc-empty::before {
          content: none !important;
        }

        .fc-login-state strong {
          color: #ffffff !important;
        }

        .fc-login-state {
          border: 1px solid rgba(138, 161, 183, 0.34);
          border-radius: 14px;
          background: #071524;
        }

        .fc-login-state span {
          color: rgba(226, 244, 255, 0.72) !important;
        }

        .fc-listing-bar,
        .fc-compose {
          background: rgba(6, 18, 32, 0.62) !important;
          border-color: rgba(151, 178, 205, 0.18) !important;
        }

        .fc-listing-title,
        .fc-input {
          color: #ffffff !important;
        }

        .fc-messages {
          background: rgba(4, 15, 28, 0.42) !important;
        }

        /* Keep the floating chat visually unified: one navy surface, orange accents. */
        .fc-list,
        .fc-settings-panel,
        .fc-login-state,
        .fc-conv-item,
        .fc-conv-row:nth-child(2) .fc-conv-item,
        .fc-view-all,
        .fc-filter-tabs,
        .fc-settings,
        .fc-back,
        .fc-settings-panel-head button {
          background-color: #071524 !important;
          background-image: none !important;
          box-shadow: none !important;
        }

        .fc-panel {
          border-color: transparent !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .fc-list {
          border: 1px solid rgba(31, 73, 108, 0.84) !important;
          border-radius: 14px !important;
          background:
            radial-gradient(320px 160px at 100% 0%, rgba(19, 68, 105, 0.34), transparent 72%),
            linear-gradient(145deg, #071524, #06111e) !important;
          box-shadow: 0 20px 48px rgba(0, 8, 18, 0.34) !important;
        }

        .fc-list,
        .fc-login-state,
        .fc-conv-item,
        .fc-conv-row:nth-child(2) .fc-conv-item,
        .fc-view-all,
        .fc-filter-tabs,
        .fc-settings,
        .fc-back {
          border-color: rgba(31, 73, 108, 0.72) !important;
        }

        .fc-list-header,
        .fc-header,
        .fc-settings-panel-head,
        .fc-setting-row {
          border-color: rgba(255, 138, 31, 0.34) !important;
        }

        .fc-list-header,
        .fc-header {
          border: 0 !important;
        }

        .fc-filter-tabs button {
          border-color: rgba(31, 73, 108, 0.72) !important;
          background: #071524 !important;
          color: #d7e6f5 !important;
        }

        .fc-filter-tabs button.active,
        .fc-settings.is-active {
          border-color: rgba(255, 138, 31, 0.72) !important;
          background: rgba(255, 122, 26, 0.16) !important;
          color: #ff9828 !important;
        }

        .fc-setting-switch {
          border-color: #1f496c !important;
          background: #0d2942 !important;
        }

        .fc-setting-switch::after {
          background: #d7e6f5 !important;
        }

        .fc-row-dot {
          background: #ff8a1f !important;
          box-shadow: 0 0 0 4px rgba(255, 138, 31, 0.1) !important;
        }

        .fc-row-dot.is-unread {
          background: #ff8a1f !important;
          box-shadow: 0 0 0 4px rgba(255, 138, 31, 0.1) !important;
        }

        .fc-conv-unread {
          border-color: rgba(255, 138, 31, 0.42) !important;
          background: #071524 !important;
        }

        .fc-conv-item:hover,
        .fc-conv-unread:hover {
          border-color: rgba(255, 138, 31, 0.62) !important;
          background: #0a1d30 !important;
        }

        .fc-list-header,
        .fc-header {
          position: relative;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .fc-list-header::after,
        .fc-header::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: 0;
          width: 42px;
          height: 2px;
          border-radius: 999px;
          background: #ff8a1f;
        }

        .fc-close {
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: #d7e6f5 !important;
        }

        @media (max-width: 768px) {
          .rebuilt-chat-button {
            bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
            display: flex !important;
            height: 44px !important;
            min-width: 44px !important;
            padding: 0 !important;
            right: 14px !important;
            width: 44px !important;
            z-index: 2147483647 !important;
          }

          .rebuilt-chat-label {
            display: none !important;
          }

          .rebuilt-chat-button svg {
            height: 18px !important;
            width: 18px !important;
          }

          .rebuilt-chat-badge {
            min-width: 17px !important;
            height: 17px !important;
            font-size: 10px !important;
            top: -4px !important;
            right: -4px !important;
          }

          .fc-panel {
            bottom: calc(68px + env(safe-area-inset-bottom, 0px)) !important;
            display: flex !important;
            max-height: min(500px, calc(100dvh - 92px)) !important;
            padding: 12px !important;
            right: 12px !important;
            width: min(330px, calc(100vw - 24px)) !important;
            z-index: 2147483646 !important;
          }

          .fc-list-header,
          .fc-header {
            min-height: 42px !important;
            padding-bottom: 8px !important;
            gap: 6px !important;
          }

          .fc-head-icon {
            width: 32px;
            height: 32px;
          }

          .fc-title {
            font-size: 16px !important;
          }

          .fc-filter-tabs {
            grid-template-columns: repeat(2, minmax(48px, 1fr));
            min-height: 30px;
          }

          .fc-filter-tabs button {
            font-size: 11px;
            padding: 0 6px;
          }

          .fc-settings,
          .fc-close,
          .fc-back {
            width: 30px !important;
            height: 30px !important;
          }

          .fc-list {
            max-height: min(400px, calc(100dvh - 164px)) !important;
            padding-top: 8px !important;
          }

          .fc-conv-row {
            grid-template-columns: 14px minmax(0, 1fr);
            gap: 6px !important;
            min-height: 56px;
          }

          .fc-row-dot {
            width: 8px;
            height: 8px;
          }

          .fc-conv-item {
            grid-template-columns: 40px minmax(0, 1fr) auto !important;
            gap: 8px !important;
            min-height: 52px !important;
            padding: 6px 7px !important;
          }

          .fc-conv-avatar {
            width: 40px !important;
            height: 36px !important;
            border-radius: 8px !important;
            font-size: 14px !important;
          }

          .fc-conv-name {
            font-size: 12px !important;
          }

          .fc-conv-last,
          .fc-conv-time {
            font-size: 11px !important;
          }

          .fc-conv-meta {
            grid-template-columns: auto auto;
            gap: 7px;
          }

          .fc-conv-meta svg {
            display: none;
          }

          .fc-unread-count {
            min-width: 20px;
            height: 20px;
            font-size: 10px;
          }

          .fc-settings-panel {
            padding-top: 10px;
          }

          .fc-setting-row {
            min-height: 54px;
          }

          .fc-list-footer {
            padding: 10px 0 0;
            align-items: stretch;
            flex-direction: column;
          }

          .fc-read-all,
          .fc-view-all {
            min-height: 40px;
            font-size: 13px;
          }

          .fc-view-all {
            min-width: 0;
          }
        }

        @media (max-width: 480px) {
          .fc-panel {
            width: min(330px, calc(100vw - 24px));
            right: 12px;
            bottom: calc(82px + env(safe-area-inset-bottom, 0px));
            max-height: calc(100vh - 120px - env(safe-area-inset-bottom, 0px));
          }
        }

        @media (hover: none) {
          .fc-conv-dismiss {
            opacity: 1;
            background: #f1f5f9;
          }
        }

        html body .fc-panel > .fc-header,
        html body .fc-panel > .fc-list-header {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          border: 0 !important;
        }

        html body .fc-panel > .fc-header::after,
        html body .fc-panel > .fc-list-header::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: 0;
          width: 42px;
          height: 2px;
          border-radius: 999px;
          background: #ff8a1f;
        }

        html body .fc-panel > .fc-header .fc-close {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        html body .fc-panel {
          background: #071524 !important;
          background-color: #071524 !important;
          background-image: none !important;
          border: 1px solid rgba(31, 73, 108, 0.84) !important;
          box-shadow: 0 20px 48px rgba(0, 8, 18, 0.34) !important;
        }

        html body .fc-panel > .fc-list,
        html body .fc-panel > .fc-login-state {
          background: #071524 !important;
          background-color: #071524 !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        html body .fc-panel .fc-conv-item,
        html body .fc-panel .fc-conv-row:nth-child(2) .fc-conv-item {
          background: #071524 !important;
          background-color: #071524 !important;
          background-image: none !important;
          padding-right: 32px !important;
        }

        html body .fc-panel .fc-conv-dismiss {
          position: absolute !important;
          right: 8px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          z-index: 5 !important;
          display: grid !important;
          place-items: center !important;
          width: 20px !important;
          height: 20px !important;
          min-width: 20px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          color: #ff8a1f !important;
          cursor: pointer !important;
          opacity: 0.92 !important;
        }

        html body .fc-panel .fc-conv-dismiss:hover {
          background: rgba(255, 138, 31, 0.12) !important;
          color: #ffb15f !important;
          opacity: 1 !important;
        }

        html body .fc-panel .fc-conv-row {
          grid-template-columns: 16px minmax(0, 1fr) !important;
          overflow: visible !important;
        }

        html body .fc-panel .fc-row-dot {
          justify-self: center !important;
          width: 8px !important;
          height: 8px !important;
          margin: 0 !important;
          background: #ff8a1f !important;
          box-shadow: 0 0 0 3px rgba(255, 138, 31, 0.1) !important;
        }

        @media (max-width: 480px) {
          html body .fc-panel {
            width: min(330px, calc(100vw - 24px)) !important;
          }
        }
      `}</style>
    </>
  );
}
