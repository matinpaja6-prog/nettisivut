"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  useParams,
  useSearchParams
} from "next/navigation";

import {
  UserRound
} from "lucide-react";

import ChatWindow from "@/app/components/chat/ChatWindow";
import MessageInput from "@/app/components/chat/MessageInput";

import {
  supabase,
  getListingById,
  markConversationRead,
  type ChatMessage
} from "@/lib/supabase";

type Message = {
  id: string;
  content?: string;
  image?: string;
  own?: boolean;
  sender_id?: string;
  created_at?: string;
};

type Conversation = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
};

type ParticipantProfile = {
  id: string;
  public_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  online?: boolean | null;
  last_seen?: string | null;
};

function formatUid(
  userId: string,
  profile?: ParticipantProfile | null
) {

  const id =
    profile?.public_id ||
    userId;

  if (!id) {
    return "Käyttäjä";
  }

  return profile?.public_id
    ? `Käyttäjä ${profile.public_id}`
    : "Käyttäjä";

}

function formatProfileName(
  profile?: ParticipantProfile | null
) {

  if (!profile) {
    return "";
  }

  return (
    profile.full_name ||
    profile.name ||
    profile.username ||
    `${profile.first_name ?? ""} ${
      profile.last_name ?? ""
    }`
      .replace(/\s+/g, " ")
      .trim()
  );

}

function formatChatUserName(
  userId: string,
  profile?: ParticipantProfile | null,
  fallbackName = ""
) {

  return (
    formatProfileName(profile) ||
    fallbackName ||
    formatUid(userId, profile)
  );

}

function formatPresence(
  profile: ParticipantProfile | null,
  fallbackSeenAt = ""
) {

  if (isRecentlyOnline(profile)) {
    return "Paikalla";
  }

  const seenAt =
    profile?.last_seen ||
    fallbackSeenAt;

  const date =
    new Date(seenAt);

  if (
    !seenAt ||
    Number.isNaN(date.getTime())
  ) {
    return "Ei paikalla";
  }

  const time =
    new Intl.DateTimeFormat(
      "fi-FI",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(date);

  return `Viimeksi paikalla klo ${time}`;

}

function isRecentlyOnline(
  profile: ParticipantProfile | null
) {

  if (profile?.online !== true) {
    return false;
  }

  if (!profile.last_seen) {
    return true;
  }

  const lastSeen =
    new Date(profile.last_seen).getTime();

  if (Number.isNaN(lastSeen)) {
    return false;
  }

  return (
    Date.now() - lastSeen <
    1000 * 75
  );

}

function mapMessage(
  msg: ChatMessage,
  currentUserId: string
): Message {

  return {
    id: String(msg.id),
    content: msg.content || "",
    image: msg.image || "",
    own: msg.sender_id === currentUserId,
    sender_id: msg.sender_id,
    created_at: msg.created_at
  };

}

function notifyIncomingMessage(
  message: ChatMessage,
  senderLabel: string
) {

  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return;
  }

  const showNotification = () => {
    new Notification(
      `Uusi viesti: ${senderLabel}`,
      {
        body:
          message.content ||
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

export default function ChatPage() {

  const params =
    useParams<{ id: string }>();

  const searchParams =
    useSearchParams();

  const conversationParam =
    searchParams.get("conversation") ?? "";

  const listingId =
    Array.isArray(params?.id)
      ? params.id[0]
      : params?.id;

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [chatUserName,
  setChatUserName] =
    useState("Käyttäjä");

  const [chatAvatarUrl,
  setChatAvatarUrl] =
    useState<string | null>(null);

  const [receiverId,
  setReceiverId] =
    useState("");

  const [currentUserId,
  setCurrentUserId] =
    useState("");

  const [conversationId,
  setConversationId] =
    useState("");

  const [chatNotice, setChatNotice] =
    useState("");

  const [otherUserOnline, setOtherUserOnline] =
    useState(false);

  const [otherProfile, setOtherProfile] =
    useState<ParticipantProfile | null>(null);

  const [lastOtherMessageAt, setLastOtherMessageAt] =
    useState("");

  /* LOAD */

  useEffect(() => {

    async function loadData() {

      if (!listingId) {

        setLoading(false);
        return;

      }

      if (!supabase) {

        console.error(
          "Supabase missing"
        );

        setLoading(false);
        return;

      }

      try {

        /* USER */

        const authResult =
          await supabase.auth.getUser();

        const user =
          authResult.data.user;

        if (!user) {

          console.error(
            "No logged user"
          );

          setLoading(false);
          return;

        }

        setCurrentUserId(
          user.id
        );

        let targetListingId =
          listingId;

        let sellerId = "";

        let buyerId =
          String(user.id);

        let currentConversationId:
          string = "";

        if (conversationParam) {

          const {
            data: conversation,
            error: conversationError
          } = await supabase
            .from("conversations")
            .select("*")
            .eq(
              "id",
              conversationParam
            )
            .maybeSingle();

          if (
            conversationError ||
            !conversation
          ) {

            setChatNotice(
              "Keskustelua ei löytynyt."
            );

            setLoading(false);
            return;

          }

          const isParticipant =
            conversation.buyer_id === user.id ||
            conversation.seller_id === user.id;

          if (!isParticipant) {

            setChatNotice(
              "Tämä keskustelu ei kuulu tilillesi."
            );

            setLoading(false);
            return;

          }

          currentConversationId =
            String(conversation.id);

          targetListingId =
            String(conversation.listing_id);

          sellerId =
            String(conversation.seller_id);

          buyerId =
            String(conversation.buyer_id);

        }

        /* LISTING */

        const listingResult =
          await getListingById(
            targetListingId
          );

        const listing =
          listingResult?.data;

        if (!listing) {

          console.error(
            "Listing not found"
          );

          setLoading(false);
          return;

        }

        sellerId =
          sellerId ||
          String(
            listing.seller_id ||
            listing.user_id ||
            ""
          );

        /* CONVERSATION */

        if (!currentConversationId) {

          if (!sellerId) {

            setChatNotice(
              "Myyjän tunnusta ei löytynyt tälle ilmoitukselle."
            );

            setLoading(false);
            return;

          }

          if (buyerId === sellerId) {

            setChatUserName(
              "Oma ilmoitus"
            );

            setChatNotice(
              "Oman ilmoituksen keskustelu avautuu, kun ostaja lähettää viestin."
            );

            setLoading(false);
            return;

          }

          const {
            data: existingConversation
          }: {
            data:
              | Conversation
              | null
          } = await supabase
            .from("conversations")
            .select("id")
            .eq(
              "listing_id",
              targetListingId
            )
            .eq(
              "buyer_id",
              buyerId
            )
            .eq(
              "seller_id",
              sellerId
            )
            .maybeSingle();

          if (
            existingConversation
          ) {

            currentConversationId =
              existingConversation.id;

          } else {

            const conversationInsert =
              await supabase
                .from(
                  "conversations"
                )
                .insert({
                  listing_id:
                    targetListingId,

                  buyer_id:
                    buyerId,

                  seller_id:
                    sellerId
                })
                .select()
                .single();

            if (
              conversationInsert.error
            ) {

              console.error(
                "CONVERSATION ERROR:",
                conversationInsert.error
              );

            } else {

              currentConversationId =
                String(
                  conversationInsert
                    .data?.id || ""
                );

            }

          }

        }

        setConversationId(
          currentConversationId
        );

        /*
          ostaja näkee myyjän
          myyjä näkee ostajan
        */

        let otherUserId = "";

        if (
          user.id === sellerId
        ) {

          otherUserId =
            buyerId;

        } else {

          otherUserId =
            sellerId;

        }

        setReceiverId(
          otherUserId
        );

        /* PROFILE */

        if (otherUserId) {

          const profileResult =
            await supabase
              .from("profiles")
              .select(`
                id,
                public_id,
                first_name,
                last_name,
                full_name,
                name,
                username,
                avatar_url,
                online,
                last_seen
              `)
              .eq(
                "id",
                otherUserId
              )
              .maybeSingle();

          if (
            profileResult.error
          ) {

            console.error(
              "PROFILE ERROR:",
              profileResult.error
            );

          }

          const profile =
            profileResult.data;

          let nextProfile =
            profile as ParticipantProfile | null;

          if (
            otherUserId &&
            !formatProfileName(nextProfile)
          ) {

            const { data: publicProfile } =
              await supabase
                .from("public_profiles")
                .select("id,first_name,last_name,full_name,avatar_url")
                .eq("id", otherUserId)
                .maybeSingle<ParticipantProfile>();

            if (publicProfile) {
              nextProfile = {
                ...nextProfile,
                ...publicProfile
              };
            }

          }

          setOtherUserOnline(
            isRecentlyOnline(
              nextProfile
            )
          );

          setChatUserName(
            formatChatUserName(
              otherUserId,
              nextProfile,
              otherUserId === sellerId
                ? listing.seller_name || ""
                : ""
            )
          );

          setChatAvatarUrl(
            nextProfile?.avatar_url ||
            (
              otherUserId === sellerId
                ? listing.seller_avatar_url || null
                : null
            )
          );

          setOtherProfile(
            nextProfile
          );

        }

        /* LOAD MESSAGES */

        const messagesResult =
          await supabase
            .from("messages")
            .select("*")
            .eq(
              "conversation_id",
              currentConversationId
            )
            .order(
              "created_at",
              {
                ascending: true
              }
            );

        if (
          messagesResult.error
        ) {

          console.error(
            "LOAD MESSAGE ERROR:",
            messagesResult.error
          );

        }

        if (
          messagesResult.data
        ) {

          const messageRows =
            messagesResult.data as ChatMessage[];

          const formatted =
            messageRows.map(
              (msg) =>
                mapMessage(
                  msg,
                  user.id
                )
            );

          const lastMessageFromOther =
            [...messageRows]
              .reverse()
              .find(
                (msg) =>
                  msg.sender_id ===
                  otherUserId
              );

          if (lastMessageFromOther?.created_at) {
            setLastOtherMessageAt(
              lastMessageFromOther.created_at
            );

            setOtherProfile((prev) =>
              prev?.last_seen
                ? prev
                : {
                    ...(prev ?? {}),
                    id: otherUserId,
                    last_seen:
                      lastMessageFromOther.created_at
                  }
            );
          }

          setMessages(
            formatted
          );

        }

      } catch (err) {

        console.error(
          "LOAD ERROR:",
          err
        );

      } finally {

        setLoading(false);

      }

    }

    loadData();

  }, [
    conversationParam,
    listingId
  ]);

  /* REALTIME */

  useEffect(() => {

    if (
      !supabase ||
      !conversationId ||
      !currentUserId
    ) {
      return;
    }

    const client =
      supabase;

    const channel =
      client
        .channel(
          `chat-${conversationId}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",

            schema: "public",

            table: "messages",

            filter:
              `conversation_id=eq.${conversationId}`
          },

          (payload: {
            new: ChatMessage;
          }) => {

            const newMessage =
              payload.new;

            setMessages(
              (prev) => {

                const exists =
                  prev.some(
                    (m) =>
                      m.id ===
                      String(
                        newMessage.id
                      )
                  );

                if (exists) {
                  return prev;
                }

                return [
                  ...prev,
                  mapMessage(
                    newMessage,
                    currentUserId
                  )
                ];

              }
            );

            if (
              newMessage.sender_id !==
              currentUserId
            ) {
              setLastOtherMessageAt(
                newMessage.created_at
              );

              setOtherProfile((prev) => ({
                ...(prev ?? {}),
                id: newMessage.sender_id,
                last_seen:
                  prev?.last_seen ||
                  newMessage.created_at
              }));

              notifyIncomingMessage(
                newMessage,
                chatUserName
              );
            }

          }
        )
        .subscribe();

    let lastSeenMessageId = "";

    const pollMessages =
      async () => {

        const { data } =
          await client
            .from("messages")
            .select("*")
            .eq(
              "conversation_id",
              conversationId
            )
            .order(
              "created_at",
              {
                ascending: true
              }
            )
            .returns<ChatMessage[]>();

        if (!data) {
          return;
        }

        setMessages((prev) => {

          const previousIds =
            new Set(
              prev.map(
                (message) =>
                  message.id
              )
            );

          const incoming =
            data.filter(
              (message) =>
                !previousIds.has(
                  String(message.id)
                )
            );

          const lastIncoming =
            incoming.at(-1);

          if (
            lastIncoming &&
            lastIncoming.sender_id !== currentUserId
          ) {
            setLastOtherMessageAt(
              lastIncoming.created_at
            );

            setOtherProfile((profile) => ({
              ...(profile ?? {}),
              id: lastIncoming.sender_id,
              last_seen:
                profile?.last_seen ||
                lastIncoming.created_at
            }));
          }

          if (
            lastIncoming &&
            lastIncoming.sender_id !== currentUserId &&
            lastSeenMessageId !== String(lastIncoming.id)
          ) {
            lastSeenMessageId =
              String(lastIncoming.id);

            notifyIncomingMessage(
              lastIncoming,
              chatUserName
            );
          }

          if (!incoming.length) {
            return prev;
          }

          return data.map(
            (message) =>
              mapMessage(
                message,
                currentUserId
              )
          );

        });

      };

    const interval =
      window.setInterval(
        pollMessages,
        4000
      );

    return () => {

      window.clearInterval(interval);
      channel.unsubscribe();

    };

  }, [
    chatUserName,
    conversationId,
    currentUserId
  ]);

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      return;
    }

    const lastOtherMessage =
      messages
        .filter((message) => message.sender_id !== currentUserId)
        .at(-1);

    const lastReadAt =
      lastOtherMessage?.created_at
        ? new Date(lastOtherMessage.created_at).getTime() + 1
        : Date.now();

    void markConversationRead(
      conversationId,
      currentUserId,
      Math.max(Date.now(), lastReadAt)
    );
  }, [
    conversationId,
    currentUserId,
    messages
  ]);

  useEffect(() => {

    if (
      !supabase ||
      !receiverId
    ) {
      return;
    }

    const client =
      supabase;

    const loadPresence =
      async () => {

        const { data } =
          await client
            .from("profiles")
            .select(`
              id,
              public_id,
              first_name,
              last_name,
              full_name,
              name,
              username,
              online,
              last_seen
            `)
            .eq("id", receiverId)
            .maybeSingle<ParticipantProfile>();

        if (!data) {
          return;
        }

        let nextProfile =
          data;

        if (!formatProfileName(nextProfile)) {

          const { data: publicProfile } =
            await client
              .from("public_profiles")
              .select("id,first_name,last_name,full_name")
              .eq("id", receiverId)
              .maybeSingle<ParticipantProfile>();

          if (publicProfile) {
            nextProfile = {
              ...nextProfile,
              ...publicProfile
            };
          }

        }

        setOtherProfile((prev) => ({
          ...prev,
          ...nextProfile
        }));

        setOtherUserOnline(
          isRecentlyOnline(nextProfile)
        );

        setChatUserName((previousName) =>
          formatChatUserName(
            receiverId,
            nextProfile,
            previousName.startsWith("UID ") ||
            previousName === "Käyttäjä"
              ? ""
              : previousName
          )
        );

      };

    loadPresence();

    const channel =
      client
        .channel(
          `presence-profile-${receiverId}`
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter:
              `id=eq.${receiverId}`
          },
          (payload: {
            new: ParticipantProfile;
          }) => {
            const profile =
              payload.new;

            setOtherProfile((previousProfile) => {

              const nextProfile =
                {
                  ...previousProfile,
                  ...profile
                };

              setOtherUserOnline(
                isRecentlyOnline(nextProfile)
              );

              setChatUserName((previousName) =>
                formatChatUserName(
                  receiverId,
                  nextProfile,
                  previousName.startsWith("UID ") ||
                  previousName === "Käyttäjä"
                    ? ""
                    : previousName
                )
              );

              return nextProfile;

            });
          }
        )
        .subscribe();

    const interval =
      window.setInterval(
        loadPresence,
        15000
      );

    return () => {
      window.clearInterval(interval);
      channel.unsubscribe();
    };

  }, [receiverId]);

  /* SEND */

  async function sendMessage(
    content: string,
    image?: string
  ) {

    try {

      if (!supabase) {
        return;
      }

      if (
        !conversationId ||
        !receiverId ||
        chatNotice
      ) {
        return;
      }

      const text =
        content.trim();

      if (
        !text &&
        !image
      ) {
        return;
      }

      const { data, error } =
        await supabase
          .from("messages")
          .insert({

            conversation_id:
              conversationId,

            listing_id:
              listingId,

            sender_id:
              currentUserId,

            receiver_id:
              receiverId,

            content: text,

            image:
              image || null
          })
          .select()
          .single<ChatMessage>();

      if (error) {

        console.error(
          "SEND ERROR:",
          error
        );

        return;

      }

      if (data) {

        setMessages((prev) => {

          const exists =
            prev.some(
              (message) =>
                message.id ===
                String(data.id)
            );

          if (exists) {
            return prev;
          }

          return [
            ...prev,
            mapMessage(
              data,
              currentUserId
            )
          ];

        });

      }

      await supabase
        .from("conversations")
        .update({
          updated_at:
            new Date().toISOString()
        })
        .eq("id", conversationId);

    } catch (err) {

      console.error(
        "SEND ERROR:",
        err
      );

    }

  }

  return (

    <main className="page">

      <div className="chat-wrapper">

        <header className="header">

          <Link
            href={
              receiverId
                ? `/seller/${receiverId}`
                : "#"
            }
            className="seller"
          >

            <div className={`avatar${otherUserOnline ? " avatar-online" : ""}`}>
              {chatAvatarUrl
                ? (
                  <img
                    src={chatAvatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                )
                : (
                  <span className="avatar-fallback">
                    {(chatUserName || "?").trim().charAt(0).toUpperCase() || <UserRound size={22} />}
                  </span>
                )}
              {otherUserOnline && <span className="avatar-presence" aria-hidden="true" />}
            </div>

            <div className="seller-info">

              <strong>
                {chatUserName}
              </strong>

              <p
                className={
                  otherUserOnline
                    ? "online-status"
                    : "online-status offline"
                }
              >

                {otherUserOnline && (
                  <span className="online-dot" />
                )}

                {otherUserOnline
                  ? "Paikalla"
                  : formatPresence(
                      otherProfile,
                      lastOtherMessageAt
                    )}

              </p>

            </div>

          </Link>

        </header>

        <div className="messages-area">

          {
            !loading &&
            chatNotice
          ? (

            <div className="empty-state">

              <div className="empty-icon">
                💬
              </div>

              <h2>
                Ei keskustelua
              </h2>

              <p>
                {chatNotice}
              </p>

            </div>

          ) : !loading &&
            messages.length === 0
          ? (

            <div className="empty-state">

              <div className="empty-icon">
                💬
              </div>

              <h2>
                Aloita keskustelu
              </h2>

              <p>
                Lähetä ensimmäinen
                viesti.
              </p>

            </div>

          ) : (

            <ChatWindow
              messages={messages}
            />

          )}

        </div>

        {!chatNotice && (

        <div className="input-area">

          <MessageInput
            onSend={sendMessage}
          />

        </div>

        )}

      </div>

      <style jsx>{`

        .page {
          min-height: 100vh;

          background: #f4f7fb;

          display: flex;
          justify-content: center;
          align-items: center;

          padding: 26px;
        }

        .chat-wrapper {

          width: 100%;
          max-width: 980px;

          height:
            calc(100vh - 78px);

          background: linear-gradient(180deg, #0d3a5c, #0a2d49);

          border:
            1px solid #dbe5ef;

          border-radius: 18px;

          overflow: hidden;

          display: flex;
          flex-direction: column;

          box-shadow:
            0 24px 70px rgba(15, 23, 42, 0.12);
        }

        .header {

          min-height: 92px;

          display: flex;
          align-items: center;
          justify-content: flex-start;

          gap: 16px;

          padding: 14px 22px;

          background: #ffffff;

          border-bottom:
            1px solid
            rgba(147, 197, 253, 0.22);

          box-shadow: none;
        }

        .seller {

          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          justify-content: flex-start;

          gap: 12px;

          min-width: 0;
          flex: 0 1 auto;

          padding: 6px 12px 6px 0;

          border-radius: 14px;

          background: transparent;

          border:
            1px solid transparent;

          text-decoration: none;
          color: inherit;

          box-shadow: none;
        }

        .seller:hover,
        .seller:focus-visible {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(147, 197, 253, 0.24);
          outline: 0;
        }

        .avatar {

          width: 58px;
          height: 58px;

          flex: 0 0 auto;
          position: relative;

          border-radius: 14px;

          background: #e2e8f0;

          color: #334155;

          display: flex;
          align-items: center;
          justify-content: center;

          overflow: visible;

          box-shadow:
            0 0 0 1px #dbe5ef;

          transition:
            transform 200ms ease,
            box-shadow 200ms ease;
        }

        .seller:hover .avatar {
          transform: translateY(-1px);
          box-shadow:
            0 0 0 1px #cbd5e1;
        }

        .avatar img {

          width: 100%;
          height: 100%;

          object-fit: cover;

          display: block;

          border-radius: 13px;
        }

        .avatar-fallback {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #334155;
          text-shadow: none;
          line-height: 1;
        }

        .avatar-presence {
          position: absolute;
          right: -3px;
          bottom: -3px;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow:
            0 0 0 3px #ffffff;
        }

        .avatar-online {
          box-shadow:
            0 0 0 1px rgba(34, 197, 94, 0.42);
        }

        .seller:hover .avatar-online {
          box-shadow:
            0 0 0 1px rgba(34, 197, 94, 0.6);
        }

        .seller-info {

          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;

          min-width: 0;
          width: 100%;
        }

        .seller-info strong {

          font-size: 1.05rem;
          font-weight: 900;

          color: #ffffff;

          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .online-status {

          display: flex;
          align-items: center;

          gap: 7px;

          margin-top: 2px;

          font-size: 13px;
          font-weight: 700;

          color: #16a34a;

          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .online-status.offline {
          color: rgba(226, 244, 255, 0.72);
        }

        .online-dot {

          width: 8px;
          height: 8px;

          border-radius: 999px;

          background: #22c55e;
        }

        .messages-area {

          flex: 1;

          overflow: hidden;

          position: relative;
        }

        .input-area {

          padding: 16px 20px;

          background: #0d3a5c;

          border-top:
            1px solid
            rgba(147, 197, 253, 0.22);
        }

        .empty-state {

          height: 100%;

          display: flex;
          flex-direction: column;

          align-items: center;
          justify-content: center;

          text-align: center;

          color: #64748b;
        }

        .empty-icon {

          font-size: 56px;

          margin-bottom: 18px;
        }

        @media (max-width: 640px) {

          .page {
            padding: 0;
            align-items: stretch;
          }

          .chat-wrapper {
            min-height: 100vh;
            height: 100vh;
            border-radius: 0;
          }

          .header {
            min-height: 76px;
            padding: 12px 14px;
            gap: 10px;
          }

          .seller {
            padding: 6px 10px 6px 0;
            border-radius: 20px;
            gap: 10px;
            grid-template-columns: auto minmax(0, 1fr);
          }

          .avatar {
            width: 50px;
            height: 50px;
            border-radius: 16px;
          }

          .avatar-fallback {
            font-size: 18px;
          }

          .avatar-presence {
            width: 13px;
            height: 13px;
          }

          .seller-info strong {
            font-size: 1rem;
          }

          .online-status {
            font-size: 12px;
            white-space: nowrap;
          }

        }

      `}</style>

    </main>

  );

}
