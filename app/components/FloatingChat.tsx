"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  MessageCircle,
  Send,
  X
} from "lucide-react";
import {
  getConversationSummaries,
  getMessagesForConversation,
  markConversationRead,
  sendChatMessage,
  supabase,
  type ChatMessage,
  type ConversationSummary
} from "@/lib/supabase";
import { useLanguage, translateCategory } from "@/lib/i18n";

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

const STORAGE_KEY = "chatLastRead";
const HIDDEN_KEY = "chatHiddenConvs";

function getHidden(): string[] {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]"); } catch { return []; }
}
function addHidden(convId: string) {
  const list = getHidden();
  if (!list.includes(convId)) { list.push(convId); localStorage.setItem(HIDDEN_KEY, JSON.stringify(list)); }
}

function getLastRead(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function markRead(convId: string, userId?: string | null) {
  const data = getLastRead();
  data[convId] = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (userId) {
    void markConversationRead(convId, userId, data[convId]);
  }
}

/* ======================================================
   COMPONENT
====================================================== */

import { usePathname } from "next/navigation";

export default function FloatingChat() {
  const pathname = usePathname();
  const { locale, t } = useLanguage();
  const [userId, setUserId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConv, setActiveConv] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [hiddenConvs, setHiddenConvs] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* --- auth --- */
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
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
    else { setConversations([]); setUnread(0); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* --- unread count --- */
  function recalcUnread(convs: ConversationSummary[]) {
    const lastRead = getLastRead();
    let count = 0;
    for (const c of convs) {
      const msg = c.last_message;
      if (!msg) continue;
      if (msg.sender_id === userId) continue;
      const lastReadTime = lastRead[c.id] ?? 0;
      if (new Date(msg.created_at).getTime() > lastReadTime) count++;
    }
    setUnread(count);
  }

  /* --- realtime: new messages refresh conv list --- */
  useEffect(() => {
    if (!supabase || !userId) return;
    const channelName = `floating-chat-convs-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => loadConversations()
      )
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* --- load messages for active conversation --- */
  useEffect(() => {
    if (!activeConv) return;
    getMessagesForConversation(activeConv.id).then(({ data }) => setMessages(data));
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
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
          markRead(activeConv.id, userId);
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
    if (!text.trim() || !activeConv || !userId || sending) return;
    const otherId =
      activeConv.buyer_id === userId ? activeConv.seller_id : activeConv.buyer_id;
    setSending(true);
    await sendChatMessage({
      conversation_id: activeConv.id,
      listing_id: activeConv.listing_id,
      sender_id: userId,
      receiver_id: otherId,
      content: text.trim()
    });
    setText("");
    setSending(false);
  }

  /* --- load hidden on mount --- */
  useEffect(() => { setHiddenConvs(getHidden()); }, []);

  function dismissConv(e: React.MouseEvent, convId: string) {
    e.stopPropagation();
    addHidden(convId);
    setHiddenConvs(prev => [...prev, convId]);
  }

  /* --- don't render if not logged in --- */
  if (!userId || pathname?.startsWith("/admin")) return null;

  /* ======================================================
     UI
  ====================================================== */
  return (
    <>
      {/* floating button */}
      <button
        className="fc-btn"
        onClick={() => { setOpen((o) => !o); if (!open) loadConversations(); }}
        aria-label={t.messages}
      >
        <MessageCircle size={22} />
        {unread > 0 && (
          <span className="fc-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* panel */}
      {open && (
        <div className="fc-panel">
          {/* header */}
          <div className="fc-header">
            {activeConv ? (
              <button className="fc-back" onClick={() => setActiveConv(null)}>
                <ChevronLeft size={18} />
              </button>
            ) : null}
            <span className="fc-title">
              {activeConv ? getOtherName(activeConv, userId, t.messages) : t.messages}
            </span>
            <div className="fc-header-actions">
              {!activeConv && (
                <Link href="/messages" className="fc-all-link" onClick={() => setOpen(false)}>
                  {t.all ?? "All"}
                </Link>
              )}
              <button className="fc-close" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* conversation list */}
          {!activeConv && (
            <div className="fc-list">
              {conversations.length === 0 ? (
                <p className="fc-empty">{t.noMessages ?? "No messages yet."}</p>
              ) : (
                conversations
                  .filter(c => !hiddenConvs.includes(c.id))
                  .map((c) => {
                  const lastRead = getLastRead();
                  const isUnread =
                    c.last_message &&
                    c.last_message.sender_id !== userId &&
                    new Date(c.last_message.created_at).getTime() > (lastRead[c.id] ?? 0);
                  return (
                    <div key={c.id} className="fc-conv-row">
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
                          <span className="fc-conv-last">{c.listing?.title ?? translateCategory(locale, c.last_message?.content ?? "") ?? ""}</span>
                        </div>
                        <span className="fc-conv-time">{timeAgo(c.last_message?.created_at, {
                            now: t.timeNow ?? "now",
                            min: t.timeMin ?? "min",
                            h: t.timeH ?? "h",
                            d: t.timeD ?? "d"
                          })}</span>
                        {isUnread && <span className="fc-unread-dot" />}
                      </button>
                      <button
                        className="fc-conv-dismiss"
                        onClick={(e) => dismissConv(e, c.id)}
                        title={t.hide ?? "Hide"}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* messages view */}
          {activeConv && (
            <>
              {activeConv.listing && (
                <Link
                  href={`/listing/${activeConv.listing_id}`}
                  className="fc-listing-bar"
                  onClick={() => setOpen(false)}
                >
                  <img src={activeConv.listing.image_url} alt="" className="fc-listing-img" />
                  <div>
                    <div className="fc-listing-title">{activeConv.listing.title}</div>
                    <div className="fc-listing-price">
                      {activeConv.listing.price?.toLocaleString("fi-FI")} €
                    </div>
                  </div>
                </Link>
              )}

              <div className="fc-messages">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`fc-msg${m.sender_id === userId ? " fc-msg-mine" : " fc-msg-other"}`}
                  >
                    {m.content}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="fc-input-row">
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
                  disabled={!text.trim() || sending}
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        .fc-btn {
          position: fixed !important;
          bottom: 28px !important;
          right: 28px !important;
          width: 58px !important;
          height: 58px !important;
          border-radius: 50% !important;
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 52%, #e65300 100%) !important;
          color: white !important;
          border: none !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 8px 26px rgba(255,107,22,0.46), 0 2px 8px rgba(0,0,0,0.18) !important;
          z-index: 9999 !important;
          transition: transform 0.15s, box-shadow 0.15s !important;
        }
        .fc-btn:hover {
          transform: scale(1.1) !important;
          box-shadow: 0 12px 36px rgba(255,107,22,0.56) !important;
        }
        .fc-badge {
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
          width: 340px;
          max-height: 520px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 16px 60px rgba(15,23,42,0.2), 0 2px 10px rgba(15,23,42,0.08);
          border: 1px solid rgba(15,23,42,0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 9998;
        }
        .fc-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          flex-shrink: 0;
        }
        .fc-back {
          background: none;
          border: none;
          cursor: pointer;
          color: #64748b;
          padding: 2px;
          display: flex;
          align-items: center;
        }
        .fc-title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          flex: 1;
        }
        .fc-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .fc-all-link {
          font-size: 12px;
          font-weight: 700;
          color: #3b82f6;
        }
        .fc-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;
        }
        .fc-list {
          overflow-y: auto;
          flex: 1;
        }
        .fc-empty {
          padding: 24px;
          text-align: center;
          color: #94a3b8;
          font-size: 14px;
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
        .fc-conv-unread { background: #eff6ff; }
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
          background: #3b82f6;
        }
        .fc-listing-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
          flex-shrink: 0;
          text-decoration: none;
        }
        .fc-listing-img {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .fc-listing-title {
          font-size: 12px;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }
        .fc-listing-price {
          font-size: 12px;
          color: #2563eb;
          font-weight: 700;
        }
        .fc-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .fc-msg {
          max-width: 75%;
          padding: 8px 12px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.4;
          word-break: break-word;
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
        .fc-input-row {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid #f1f5f9;
          flex-shrink: 0;
        }
        .fc-input {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }
        .fc-input:focus { border-color: #3b82f6; }
        .fc-send {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #1d4ed8;
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

        @media (max-width: 768px) {
          .fc-btn {
            display: none !important;
          }
          .fc-panel {
            display: none !important;
          }
        }

        @media (max-width: 480px) {
          .fc-panel {
            width: calc(100vw - 24px);
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
      `}</style>
    </>
  );
}
