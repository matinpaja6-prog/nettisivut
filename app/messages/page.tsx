"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

import {
  ArrowLeft,
  ExternalLink,
  LockKeyhole,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  UserRound,
  X
} from "lucide-react";

import {
  CHAT_NOTIFICATIONS_CHANGED_EVENT,
  getConversationSummaries,
  getMessagesForConversationAfter,
  getMessagesForConversation,
  isConversationLastMessageUnread,
  markConversationRead,
  readChatLastRead,
  sendChatMessage,
  supabase,
  type ChatMessage,
  type ConversationSummary
} from "@/lib/supabase";

import { formatPrice } from "@/lib/listings";
import { playNotificationSound } from "@/lib/notification-sound";
import { readCachedResource, writeCachedResource } from "@/lib/client-resource-cache";
import { listingPath, profilePath } from "@/lib/routes";
import ChatWindow from "@/app/components/chat/ChatWindow";
import MessageInput from "@/app/components/chat/MessageInput";

type UiMessage = {
  id: string;
  content?: string;
  image?: string;
  own?: boolean;
  sender_id?: string;
  created_at?: string;
  read?: boolean;
};

type MessageFilter =
  | "all"
  | "buyers"
  | "sellers";

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

function getClientErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(error ?? "Tuntematon virhe");
}

function formatSidebarTime(value?: string) {

  const date = new Date(value || "");

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const dateStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const dayDiff = Math.floor(
    (todayStart.getTime() - dateStart.getTime()) /
    86_400_000
  );

  if (dayDiff <= 0) {
    return new Intl.DateTimeFormat(
      "fi-FI",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(date);
  }

  if (dayDiff === 1) {
    return "Eilen";
  }

  return formatDate(value);

}

function getInitials(name: string) {

  const parts =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const initials =
    parts.length > 1
      ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`
      : name.slice(0, 2);

  return initials.toUpperCase() || "?";

}

function getUnreadCount(
  conversation: ConversationSummary,
  userId: string,
  lastRead: Record<string, number>
) {
  return isConversationLastMessageUnread(
    conversation,
    userId,
    lastRead
  )
    ? 1
    : 0;

}

function mapMessage(
  message: ChatMessage,
  userId: string
): UiMessage {
  return {
    id: String(message.id),
    content: message.content || "",
    image: message.image || "",
    own: message.sender_id === userId,
    sender_id: message.sender_id,
    created_at: message.created_at,
    read: Boolean(message.read || message.read_at)
  };
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

function getOtherProfileHref(
  conversation: ConversationSummary,
  userId: string | null
) {
  if (!userId) return "#";

  const otherUserId =
    conversation.buyer_id === userId
      ? conversation.seller_id
      : conversation.buyer_id;

  if (!otherUserId) return "#";

  const otherProfile = conversation.other_profile;
  const otherName =
    otherProfile?.full_name ||
    otherProfile?.name ||
    `${otherProfile?.first_name ?? ""} ${otherProfile?.last_name ?? ""}`.trim();

  return `${profilePath(otherUserId, otherName)}?returnTo=${encodeURIComponent("/messages")}`;
}

function formatJoinedDate(value?: string | null) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

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

function formatLastSeen(value?: string | null) {
  if (!value) {
    return "Ei paikalla";
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Ei paikalla";
  }

  const now =
    new Date();
  const today =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
  const seenDay =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
  const dayDiff =
    Math.floor(
      (today.getTime() - seenDay.getTime()) /
      86_400_000
    );
  const time =
    new Intl.DateTimeFormat(
      "fi-FI",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(date);

  if (dayDiff <= 0) {
    return `Paikalla tänään klo ${time}`;
  }

  if (dayDiff === 1) {
    return `Paikalla eilen klo ${time}`;
  }

  return `Paikalla viimeksi ${formatDate(value)} klo ${time}`;
}

function isProfileActuallyOnline(
  profile?: ConversationSummary["other_profile"] | null
) {
  if (!profile?.online || !profile.last_seen) {
    return false;
  }

  const lastSeen =
    new Date(profile.last_seen).getTime();

  if (Number.isNaN(lastSeen)) {
    return false;
  }

  return Date.now() - lastSeen <= 90_000;
}

function notifyIncomingMessage(
  content?: string
) {
  playNotificationSound();

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

function archivedConversationsKey(userId: string) {
  return `archivedConversations:${userId}`;
}

function deletedConversationsKey(userId: string) {
  return `deletedConversations:${userId}`;
}

function readStoredConversationIds(key: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = JSON.parse(
      localStorage.getItem(key) || "[]"
    );

    return Array.isArray(stored)
      ? stored.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStoredConversationIds(key: string, ids: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    key,
    JSON.stringify(Array.from(new Set(ids)))
  );
}

function readHiddenConversationIds(userId: string) {
  return readStoredConversationIds(hiddenConversationsKey(userId));
}

function readArchivedConversationIds(userId: string) {
  return readStoredConversationIds(archivedConversationsKey(userId));
}

function readDeletedConversationIds(userId: string) {
  return readStoredConversationIds(deletedConversationsKey(userId));
}

export default function MessagesPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams =
    useSearchParams();
  const requestedConversationId =
    searchParams.get("conversation") ?? "";

  const [loading, setLoading] =
    useState(true);

  const [userId, setUserId] =
    useState("");

  const [conversations, setConversations] =
    useState<ConversationSummary[]>([]);

  const [selectedConversationId, setSelectedConversationId] =
    useState("");

  const [activeFilter, setActiveFilter] =
    useState<MessageFilter>("all");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [archivedConversationIds, setArchivedConversationIds] =
    useState<string[]>([]);

  const [deletedConversationIds, setDeletedConversationIds] =
    useState<string[]>([]);

  const [mobileConversationOpen, setMobileConversationOpen] =
    useState(false);

  const [messages, setMessages] =
    useState<UiMessage[]>([]);

  const messagesRef =
    useRef<UiMessage[]>([]);
  const lastMessageCreatedAtRef =
    useRef("");

  const [lastReadSnapshot, setLastReadSnapshot] =
    useState<Record<string, number>>({});

  useEffect(() => {
    messagesRef.current = messages;
    lastMessageCreatedAtRef.current =
      messages.at(-1)?.created_at ?? "";
  }, [messages]);

  useEffect(() => {
    const syncLastRead = () => {
      setLastReadSnapshot(
        readChatLastRead()
      );
    };

    syncLastRead();
    window.addEventListener(
      CHAT_NOTIFICATIONS_CHANGED_EVENT,
      syncLastRead
    );
    window.addEventListener(
      "storage",
      syncLastRead
    );

    return () => {
      window.removeEventListener(
        CHAT_NOTIFICATIONS_CHANGED_EVENT,
        syncLastRead
      );
      window.removeEventListener(
        "storage",
        syncLastRead
      );
    };
  }, []);

  const markConversationReadInState = useCallback((
    conversationId: string,
    readAt = new Date().toISOString()
  ) => {
    setLastReadSnapshot(
      readChatLastRead()
    );
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId &&
        conversation.last_message?.receiver_id === userId
          ? {
              ...conversation,
              last_message: {
                ...conversation.last_message,
                read: true,
                read_at:
                  conversation.last_message.read_at ??
                  readAt
              }
            }
          : conversation
      )
    );
  }, [userId]);

  const refreshConversations = useCallback(async () => {
    if (!userId) return;

    const { data } =
      await getConversationSummaries(
        userId
      );

    const next = data ?? [];
    setConversations(next);
    writeCachedResource(`conversations:${userId}`, next);
  }, [userId]);

  useEffect(() => {

    let stopped = false;
    let authResolved = false;

    async function loadMessagesForUser(nextUserId: string) {
      try {
        setUserId(nextUserId);

        const hiddenIds = readHiddenConversationIds(nextUserId);
        const archivedIds = readArchivedConversationIds(nextUserId);
        const deletedIds = Array.from(
          new Set([
            ...hiddenIds,
            ...readDeletedConversationIds(nextUserId)
          ])
        );
        setArchivedConversationIds(archivedIds);
        setDeletedConversationIds(deletedIds);

        const cacheKey = `conversations:${nextUserId}`;
        const cached = readCachedResource<ConversationSummary[]>(cacheKey);
        if (cached && !stopped) {
          setConversations(cached);
          setLoading(false);
        }

        const { data } =
          await getConversationSummaries(
            nextUserId
          );

        if (!stopped) {
          const next = data ?? [];
          setConversations(next);
          writeCachedResource(cacheKey, next);
        }
      } catch (error) {
        console.warn("Messages load failed:", getClientErrorMessage(error));
      } finally {
        if (!stopped) {
          setLoading(false);
        }
      }

    }

    async function bootMessages() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: sessionData } =
        await supabase.auth.getSession();
      const sessionUser =
        sessionData.session?.user ?? null;

      if (sessionUser) {
        authResolved = true;
        await loadMessagesForUser(sessionUser.id);
        return;
      }

      const {
        data: { user }
      } =
        await supabase.auth.getUser();

      if (user) {
        authResolved = true;
        await loadMessagesForUser(user.id);
        return;
      }

      window.setTimeout(() => {
        if (!stopped && !authResolved) {
          setLoading(false);
        }
      }, 900);
    }

    void bootMessages();

    const authSubscription =
      supabase?.auth.onAuthStateChange((_event, session) => {
        const nextUser =
          session?.user ?? null;

        authResolved = true;

        if (!nextUser) {
          setUserId("");
          setConversations([]);
          setMessages([]);
          setLoading(false);
          return;
        }

        setLoading(true);
        void loadMessagesForUser(nextUser.id);
      });

    return () => {
      stopped = true;
      authSubscription?.data.subscription.unsubscribe();
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
    let refreshTimer: number | null = null;

    const scheduleRefreshConversations = () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshConversations();
      }, 120);
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

            scheduleRefreshConversations();

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
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter:
              `sender_id=eq.${userId}`
          },
          () => {
            scheduleRefreshConversations();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter:
              `receiver_id=eq.${userId}`
          },
          () => {
            scheduleRefreshConversations();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter:
              `sender_id=eq.${userId}`
          },
          () => {
            scheduleRefreshConversations();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages"
          },
          () => {
            scheduleRefreshConversations();
          }
        )
        .subscribe();

    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      channel.unsubscribe();
    };

  }, [refreshConversations, userId]);

  const visibleConversations =
    useMemo(() => {
      const query =
        searchQuery.trim().toLowerCase();

      return conversations.filter((conversation) => {
        if (deletedConversationIds.includes(conversation.id)) {
          return false;
        }

        const archived =
          archivedConversationIds.includes(conversation.id);

        if (archived) {
          return false;
        }

        if (
          activeFilter === "buyers" &&
          conversation.seller_id !== userId
        ) {
          return false;
        }

        if (
          activeFilter === "sellers" &&
          conversation.buyer_id !== userId
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const name =
          formatName(conversation, userId).toLowerCase();
        const listingTitle =
          conversation.listing?.title?.toLowerCase() ?? "";
        const lastText =
          conversation.last_message?.content?.toLowerCase() ?? "";

        return (
          name.includes(query) ||
          listingTitle.includes(query) ||
          lastText.includes(query)
        );
      });
    }, [
      activeFilter,
      archivedConversationIds,
      conversations,
      deletedConversationIds,
      searchQuery,
      userId
    ]);

  const activeConversation =
    useMemo(
      () =>
        visibleConversations.find(
          (conversation) =>
            conversation.id === selectedConversationId
        ) ||
        visibleConversations[0] ||
        null,
      [
        visibleConversations,
        selectedConversationId
      ]
    );

  const totalVisibleCount =
    conversations.filter(
      (conversation) =>
        !deletedConversationIds.includes(conversation.id) &&
        !archivedConversationIds.includes(conversation.id)
    ).length;

  const otherUserId =
    activeConversation && userId
      ? activeConversation.buyer_id === userId
        ? activeConversation.seller_id
        : activeConversation.buyer_id
      : "";

  const activeName =
    activeConversation
      ? formatName(activeConversation, userId)
      : "";
  const activeProfileHref =
    activeConversation
      ? getOtherProfileHref(activeConversation, userId)
      : "#";
  const activeOtherOnline =
    isProfileActuallyOnline(
      activeConversation?.other_profile
    );

  useEffect(() => {
    if (
      !requestedConversationId ||
      !userId ||
      !conversations.some(
        (conversation) =>
          conversation.id === requestedConversationId
      )
    ) {
      return;
    }

    if (deletedConversationIds.includes(requestedConversationId)) {
      router.replace("/messages");
      setSelectedConversationId("");
      setMobileConversationOpen(false);
      return;
    }

    if (archivedConversationIds.includes(requestedConversationId)) {
      const next =
        archivedConversationIds.filter(
          (conversationId) =>
            conversationId !== requestedConversationId
        );

      setArchivedConversationIds(next);
      writeStoredConversationIds(
        archivedConversationsKey(userId),
        next
      );
    }

    setActiveFilter("all");
    setSelectedConversationId(requestedConversationId);
    setMobileConversationOpen(true);
  }, [
    archivedConversationIds,
    conversations,
    deletedConversationIds,
    requestedConversationId,
    router,
    userId
  ]);

  useEffect(() => {
    if (
      (
        selectedConversationId &&
        visibleConversations.some(
          (conversation) =>
            conversation.id === selectedConversationId
        )
      ) ||
      visibleConversations.length === 0
    ) {
      return;
    }

    setSelectedConversationId(
      visibleConversations[0].id
    );
  }, [
    visibleConversations,
    selectedConversationId
  ]);

  function deleteConversationForMe(conversationId: string) {
    if (!userId) {
      return;
    }

    const next =
      Array.from(
        new Set([
          ...deletedConversationIds,
          conversationId
        ])
      );

    setDeletedConversationIds(next);
    writeStoredConversationIds(
      deletedConversationsKey(userId),
      next
    );
    writeStoredConversationIds(
      hiddenConversationsKey(userId),
      next
    );

    const nextConversations =
      conversations.filter(
        (conversation) =>
          conversation.id !== conversationId
      );

    setConversations(nextConversations);
    writeCachedResource(
      `conversations:${userId}`,
      nextConversations
    );

    if (selectedConversationId === conversationId) {
      setSelectedConversationId("");
      setMessages([]);
      setMobileConversationOpen(false);
    }

    if (requestedConversationId === conversationId) {
      router.replace("/messages");
    }
  }

  const loadActiveConversationMessages =
    useCallback(async (
      conversation: ConversationSummary,
      markAsRead = true
    ) => {
      if (!userId) return;

      const { data } =
        await getMessagesForConversation(
          conversation.id
        );

      const nextMessages =
        (data ?? []).map((message) =>
          mapMessage(message, userId)
        );

      setMessages((current) => {
        const currentKey =
          current.map((message) =>
            `${message.id}:${message.read ? "1" : "0"}`
          ).join("|");
        const nextKey =
          nextMessages.map((message) =>
            `${message.id}:${message.read ? "1" : "0"}`
          ).join("|");

        return currentKey === nextKey
          ? current
          : nextMessages;
      });

      if (!markAsRead) return;

      const lastOtherMessage =
        [...(data ?? [])]
          .reverse()
          .find((message) =>
            message.sender_id !== userId
          );

      const readAt =
        lastOtherMessage?.created_at
          ? new Date(lastOtherMessage.created_at).getTime() + 1
          : Date.now();

      const readAtValue =
        Math.max(Date.now(), readAt);

      void markConversationRead(
        conversation.id,
        userId,
        readAtValue
      );
      markConversationReadInState(
        conversation.id,
        new Date(readAtValue).toISOString()
      );
    }, [
      markConversationReadInState,
      userId
    ]);

  const syncNewActiveConversationMessages =
    useCallback(async (
      conversation: ConversationSummary,
      markAsRead = true
    ) => {
      if (!userId) return;

      const afterCreatedAt =
        lastMessageCreatedAtRef.current;

      if (!afterCreatedAt) {
        await loadActiveConversationMessages(conversation, markAsRead);
        return;
      }

      const { data } =
        await getMessagesForConversationAfter(
          conversation.id,
          afterCreatedAt
        );

      if (!data?.length) return;

      const nextMessages =
        data.map((message) =>
          mapMessage(message, userId)
        );

      setMessages((current) => {
        const seen =
          new Set(current.map((message) => message.id));
        const merged =
          [...current];

        for (const message of nextMessages) {
          if (seen.has(message.id)) continue;
          seen.add(message.id);
          merged.push(message);
        }

        return merged.length === current.length
          ? current
          : merged;
      });

      if (!markAsRead) return;

      const lastOtherMessage =
        [...data]
          .reverse()
          .find((message) =>
            message.sender_id !== userId
          );

      if (!lastOtherMessage) return;

      const readAt =
        lastOtherMessage.created_at
          ? Math.max(
              Date.now(),
              new Date(lastOtherMessage.created_at).getTime() + 1
            )
          : Date.now();

      void markConversationRead(
        conversation.id,
        userId,
        readAt
      );
      markConversationReadInState(
        conversation.id,
        new Date(readAt).toISOString()
      );
    }, [
      loadActiveConversationMessages,
      markConversationReadInState,
      userId
    ]);

  useEffect(() => {
    if (
      !activeConversation ||
      !userId
    ) {
      setMessages([]);
      return;
    }

    let stopped = false;
    const conversation = activeConversation;

    loadActiveConversationMessages(conversation)
      .catch(() => undefined)
      .finally(() => {
        if (stopped) return;
      });

    return () => {
      stopped = true;
    };
  }, [
    activeConversation,
    loadActiveConversationMessages,
    userId
  ]);

  useEffect(() => {
    if (
      !supabase ||
      !activeConversation ||
      !userId
    ) {
      return;
    }

    const conversationId =
      activeConversation.id;

    const channel =
      supabase
        .channel(`messages-open-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload: { new: ChatMessage }) => {
            const nextMessage =
              mapMessage(payload.new, userId);

            setMessages((current) =>
              current.some(
                (message) =>
                  message.id === nextMessage.id
              )
                ? current
                : [
                    ...current,
                    nextMessage
                  ]
            );

            if (payload.new.receiver_id === userId) {
              const readAt =
                payload.new.created_at
                  ? Math.max(
                      Date.now(),
                      new Date(payload.new.created_at).getTime() + 1
                    )
                  : Date.now();

              void markConversationRead(
                conversationId,
                userId,
                readAt
              );
              markConversationReadInState(
                conversationId,
                new Date(readAt).toISOString()
              );
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload: { new: ChatMessage }) => {
            const updatedMessage =
              mapMessage(payload.new, userId);

            setMessages((current) =>
              current.map((message) =>
                message.id === updatedMessage.id
                  ? updatedMessage
                  : message
              )
            );

            refreshConversations();
          }
        )
        .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [
    activeConversation,
    markConversationReadInState,
    refreshConversations,
    userId
  ]);

  useEffect(() => {
    if (
      !activeConversation ||
      !userId ||
      !activeConversation.last_message?.id
    ) {
      return;
    }

    const lastMessageId =
      String(activeConversation.last_message.id);

    if (
      messagesRef.current.some((message) =>
        message.id === lastMessageId
      )
    ) {
      return;
    }

    void syncNewActiveConversationMessages(activeConversation);
  }, [
    activeConversation,
    syncNewActiveConversationMessages,
    userId
  ]);

  useEffect(() => {
    if (
      !activeConversation ||
      !userId
    ) {
      return;
    }

    const intervalId =
      window.setInterval(() => {
        if (document.visibilityState !== "visible") {
          return;
        }

        void syncNewActiveConversationMessages(
          activeConversation,
          true
        );
      }, 1000);

    const syncNow = () => {
      if (document.visibilityState !== "visible") return;
      void syncNewActiveConversationMessages(activeConversation, true);
    };

    window.addEventListener("focus", syncNow);
    document.addEventListener("visibilitychange", syncNow);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncNow);
      document.removeEventListener("visibilitychange", syncNow);
    };
  }, [
    activeConversation,
    syncNewActiveConversationMessages,
    userId
  ]);

  async function sendMessage(
    content: string,
    image?: string
  ) {
    if (
      !activeConversation ||
      !userId ||
      !otherUserId
    ) {
      return;
    }

    const text =
      content.trim();

    if (!text && !image) {
      return;
    }

    const { data } =
      await sendChatMessage({
        conversation_id:
          activeConversation.id,
        listing_id:
          activeConversation.listing_id,
        sender_id:
          userId,
        receiver_id:
          otherUserId,
        content:
          text,
        image:
          image || null
      });

    if (data) {
      setMessages((current) =>
        current.some((message) =>
          message.id === String(data.id)
        )
          ? current
          : [
              ...current,
              mapMessage(data, userId)
            ]
      );
    }
  }

  return (

    <main className={`messages-page messages-inbox-page${mobileConversationOpen ? " mobile-conversation-open" : ""}`}>
      <section className="messages-desktop-shell">

        <aside className="messages-sidebar" aria-label="Viestit">

          <div className="sidebar-heading">
            <h1>Viestit</h1>
          </div>

          <div className="message-tabs" aria-label="Viestisuodattimet">
            <button className={activeFilter === "all" ? "active" : ""} type="button" onClick={() => setActiveFilter("all")}>
              Kaikki <span>{loading ? "..." : totalVisibleCount}</span>
            </button>
            <button className={activeFilter === "buyers" ? "active" : ""} type="button" onClick={() => setActiveFilter("buyers")}>
              Ostajat
            </button>
            <button className={activeFilter === "sellers" ? "active" : ""} type="button" onClick={() => setActiveFilter("sellers")}>
              Myyjät
            </button>
          </div>

          <div className="message-search">
            <Search size={15} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Hae viesteistä tai käyttäjistä..."
            />
            <button type="button" aria-label="Suodattimet">
              <SlidersHorizontal size={15} />
            </button>
          </div>

          <div className="sidebar-list">
            {loading && [0, 1, 2, 3].map((item) => (
              <div className="sidebar-conversation sidebar-loading" key={item}>
                <div className="sidebar-avatar" />
                <div className="sidebar-copy">
                  <div><strong /></div>
                  <p />
                </div>
              </div>
            ))}

            {!loading && visibleConversations.map((conversation) => {
              const name = formatName(conversation, userId);
              const lastMessage = conversation.last_message;
              const unreadCount = getUnreadCount(
                conversation,
                userId,
                lastReadSnapshot
              );
              const isActive = conversation.id === activeConversation?.id;
              const otherOnline =
                isProfileActuallyOnline(conversation.other_profile);
              const lastText = lastMessage
                ? `${lastMessage.sender_id === userId ? "Sinä: " : ""}${lastMessage.content || "Kuva"}`
                : conversation.listing?.title || "Keskustelu aloitettu";
              const openConversation = () => {
                setSelectedConversationId(
                  conversation.id
                );
                setMobileConversationOpen(true);
                if (userId) {
                  const lastMessageAt =
                    conversation.last_message?.created_at
                      ? new Date(conversation.last_message.created_at).getTime() + 1
                      : Date.now();
                  const readAt =
                    Math.max(Date.now(), lastMessageAt);

                  void markConversationRead(
                    conversation.id,
                    userId,
                    readAt
                  );
                  markConversationReadInState(
                    conversation.id,
                    new Date(readAt).toISOString()
                  );
                }
              };

              return (
                <div
                  role="button"
                  tabIndex={0}
                  className={`sidebar-conversation${isActive ? " active" : ""}${unreadCount > 0 ? " has-notification" : ""}`}
                  onClick={openConversation}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " "
                    ) {
                      event.preventDefault();
                      openConversation();
                    }
                  }}
                  key={conversation.id}
                >
                  <div className="sidebar-avatar">
                    {conversation.other_profile?.avatar_url
                      ? (
                        <img
                          src={conversation.other_profile.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      )
                      : getInitials(name)}
                    {otherOnline && <span aria-hidden="true" />}
                  </div>

                  <div className="sidebar-copy">
                    <div>
                      <strong>{name}</strong>
                      <time>
                        {formatSidebarTime(
                          lastMessage?.created_at ||
                          conversation.updated_at ||
                          conversation.created_at
                        )}
                      </time>
                    </div>
                    <p>{lastText}</p>
                  </div>

                  {unreadCount > 0 && (
                    <span className="sidebar-unread">{unreadCount}</span>
                  )}

                  <div className="sidebar-actions" aria-label="Keskustelun toiminnot">
                    <button
                      type="button"
                      className="sidebar-delete-conversation"
                      aria-label="Poista keskustelu"
                      title="Poista keskustelu"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        deleteConversationForMe(conversation.id);
                      }}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}

            {!loading && userId && visibleConversations.length === 0 && (
              <div className="sidebar-empty">
                Ei keskusteluja vielä
              </div>
            )}
          </div>

        </aside>

        <section className="chat-wrapper" aria-label="Aktiivinen keskustelu">

          {loading ? (
            <div className="messages-empty messages-loading-panel">
              <span className="messages-empty-icon">
                <MessageCircle size={28} />
              </span>
              <h2>Ladataan viestejä...</h2>
              <p>Haetaan keskustelut ja luetuksi-tilat.</p>
            </div>
          ) : !userId ? (
            <div className="messages-login-panel">
              <LockKeyhole size={24} />
              <strong>Kirjaudu sisään nähdäksesi viestisi.</strong>
              <Link href="/auth">{t.login}</Link>
            </div>
          ) : activeConversation ? (
            <>
              <header className="header">
                <button
                  type="button"
                  className="mobile-chat-back"
                  aria-label="Takaisin keskusteluihin"
                  onClick={() => setMobileConversationOpen(false)}
                >
                  <ArrowLeft size={17} />
                </button>

                <div className="seller">
                  <div className={`avatar${activeOtherOnline ? " avatar-online" : ""}`}>
                    {activeConversation.other_profile?.avatar_url
                      ? (
                        <img
                          src={activeConversation.other_profile.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
                        />
                      )
                      : (
                        <span className="avatar-fallback">{getInitials(activeName)}</span>
                      )}
                    {activeOtherOnline && <span className="avatar-presence" aria-hidden="true" />}
                  </div>

                  <div className="seller-info">
                    <strong>{activeName}</strong>
                    <p className={`online-status${activeOtherOnline ? " online" : " offline"}`}>
                      {activeOtherOnline
                        ? "Paikalla"
                        : formatLastSeen(activeConversation.other_profile?.last_seen)}
                    </p>
                  </div>
                </div>

                <Link
                  href={activeProfileHref}
                  className="header-profile-link"
                  aria-label={`Avaa käyttäjän ${activeName} profiili`}
                  title="Avaa profiili"
                >
                  <UserRound size={16} aria-hidden="true" />
                  <span>Profiili</span>
                </Link>

              </header>

              <div className="chat-listing-strip">
                <div className="listing-thumb">
                  <img
                    src={activeConversation.listing?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3"}
                    alt=""
                  />
                </div>

                <div className="listing-summary">
                  <strong>{activeConversation.listing?.title || "Ilmoitus"}</strong>
                  <span>
                    {activeConversation.listing
                      ? formatPrice(activeConversation.listing.price)
                      : "Hinta sovittavissa"}
                  </span>
                </div>

                <Link
                  href={listingPath(activeConversation.listing_id)}
                  className="listing-open"
                >
                  Näytä ilmoitus
                  <ExternalLink size={14} />
                </Link>
              </div>

              <div className="messages-area inbox-preview-area">
                <ChatWindow
                  messages={messages}
                  otherAvatarUrl={activeConversation.other_profile?.avatar_url ?? null}
                  otherName={activeName}
                />
              </div>

              <div className="input-area inbox-open-area">
                <MessageInput
                  onSend={sendMessage}
                />
              </div>
            </>
          ) : (
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

        </section>

        {activeConversation && (
          <aside className="messages-info-panel" aria-label="Keskustelun tiedot">
            <section className="messages-info-card listing-info-card">
              <div className="messages-info-card-head">
                <h2>Ilmoituksen tiedot</h2>
                <button type="button" aria-label="Sulje tiedot">
                  <X size={17} />
                </button>
              </div>

              <div className="messages-info-listing">
                <img
                  src={activeConversation.listing?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3"}
                  alt=""
                />
                <div>
                  <strong>{activeConversation.listing?.title || "Ilmoitus"}</strong>
                  <span>
                    {activeConversation.listing
                      ? formatPrice(activeConversation.listing.price)
                      : "Hinta sovittavissa"}
                  </span>
                </div>
              </div>

              <Link
                href={listingPath(activeConversation.listing_id)}
                className="messages-info-primary"
              >
                Avaa ilmoitus
                <ExternalLink size={14} />
              </Link>

              <button
                type="button"
                className="messages-info-secondary"
                onClick={() => deleteConversationForMe(activeConversation.id)}
              >
                <Trash2 size={15} />
                Poista keskustelu
              </button>
            </section>

            <section className="messages-info-card seller-info-card">
              <h2>Myyjä</h2>

              <div className="messages-info-seller">
                <div className={`avatar${activeOtherOnline ? " avatar-online" : ""}`}>
                  {activeConversation.other_profile?.avatar_url
                    ? (
                      <img
                        src={activeConversation.other_profile.avatar_url}
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    )
                    : (
                      <span className="avatar-fallback">{getInitials(activeName)}</span>
                    )}
                </div>

                <div>
                  <strong>{activeName}</strong>
                  <span className={`seller-presence${activeOtherOnline ? " online" : " offline"}`}>
                    {activeOtherOnline
                      ? "Paikalla"
                      : formatLastSeen(activeConversation.other_profile?.last_seen)}
                  </span>
                  {activeConversation.other_review_count ? (
                    <small>
                      <Star size={13} />
                      {activeConversation.other_review_average?.toFixed(1)}
                      {" "}
                      ({activeConversation.other_review_count} arviota)
                    </small>
                  ) : (
                    <small>
                      <Star size={13} />
                      Ei arvioita vielä
                    </small>
                  )}
                  {activeConversation.other_profile?.created_at && (
                    <em>
                      Liittynyt {formatJoinedDate(activeConversation.other_profile.created_at)}
                    </em>
                  )}
                </div>
              </div>

              <Link href={activeProfileHref} className="messages-info-secondary">
                <UserRound size={15} />
                Näytä myyjän profiili
              </Link>
            </section>

            <section className="messages-info-card safety-info-card">
              <h2>
                <ShieldCheck size={17} />
                Turvallista kaupankäyntiä
              </h2>
              <p>
                Älä jaa henkilötietojasi tai tee kauppoja alustan ulkopuolella.
                <Link href="/terms"> Lue lisää</Link> turvallisista kaupoista.
              </p>
            </section>
          </aside>
        )}

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

        .messages-page {
          padding-top: 18px;
          background:
            radial-gradient(860px 340px at 88% 0%, rgba(255, 122, 26, 0.16), transparent 66%),
            radial-gradient(780px 320px at 10% -6%, rgba(64, 177, 255, 0.12), transparent 68%),
            linear-gradient(180deg, #030b15 0%, #071523 48%, #06111d 100%) !important;
        }

        .messages-shell {
          width: min(1284px, calc(100vw - 64px));
          gap: 16px;
        }

        .messages-hero {
          grid-template-columns: 126px minmax(0, 1fr) minmax(360px, 0.54fr);
          min-height: 242px;
          padding: 36px 44px 34px 38px;
          border-radius: 20px;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(740px 270px at 100% 22%, rgba(255, 122, 26, 0.16), transparent 68%),
            radial-gradient(620px 260px at 3% 0%, rgba(70, 154, 220, 0.2), transparent 70%),
            linear-gradient(145deg, rgba(17, 39, 61, 0.96), rgba(8, 22, 38, 0.98)) !important;
        }

        .messages-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background: repeating-radial-gradient(ellipse at 82% 50%, rgba(86, 151, 206, 0.14) 0 1px, transparent 1px 12px);
          opacity: 0.26;
          pointer-events: none;
          mask-image: linear-gradient(90deg, transparent 30%, #000 72%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 30%, #000 72%, transparent 100%);
        }

        .messages-hero > * {
          position: relative;
          z-index: 1;
        }

        .messages-hero-icon {
          width: 106px;
          height: 106px;
          border: 1px solid rgba(255, 160, 65, 0.78);
          border-radius: 18px;
          display: grid;
          place-items: center;
          color: #fff;
          background:
            radial-gradient(circle at 50% 36%, rgba(255, 255, 255, 0.16), transparent 34%),
            linear-gradient(145deg, #ff9c26, #f05f00 72%);
          box-shadow:
            0 22px 48px rgba(255, 112, 18, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
        }

        .messages-hero-icon svg {
          width: 58px;
          height: 58px;
          fill: currentColor;
          stroke-width: 0;
        }

        .messages-hero .eyebrow {
          color: #4f9fe8 !important;
          letter-spacing: 0.18em;
        }

        .messages-hero h1 {
          font-size: clamp(3rem, 4.8vw, 3.9rem);
          letter-spacing: 0;
        }

        .messages-hero-lead {
          max-width: 440px;
          font-size: 15.5px;
        }

        .messages-hero-copy {
          width: min(100%, 410px);
          gap: 0;
        }

        .messages-hero-copy span {
          min-height: 82px;
          align-items: center;
          padding: 18px 26px;
          border-radius: 14px;
          background: rgba(4, 16, 31, 0.64);
          font-size: 14px;
        }

        .messages-hero-copy span + span {
          margin-top: 2px;
        }

        .messages-stat-card {
          min-height: 128px;
          position: relative;
          padding: 24px 58px 22px 28px;
          border-radius: 14px;
        }

        .messages-stat-card::after {
          content: ">";
          position: absolute;
          right: 24px;
          top: 50%;
          transform: translateY(-50%) scaleY(1.55);
          color: rgba(180, 209, 235, 0.72);
          font-size: 28px;
          line-height: 1;
          font-weight: 300;
        }

        .messages-stat-chevron {
          display: none;
        }

        .messages-stat-icon {
          width: 64px;
          height: 64px;
          border-radius: 14px;
        }

        .messages-stat-label {
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .messages-stat-text strong {
          font-size: 30px;
        }

        .messages-stat-positive {
          color: #ff8a22 !important;
          text-transform: uppercase;
        }

        .conversation-card {
          grid-template-columns: 138px minmax(0, 1fr) 156px 58px;
          min-height: 156px;
          padding: 16px 24px 14px 20px;
          border-radius: 14px;
        }

        .conversation-image {
          width: 138px;
          border-radius: 12px;
        }

        .conversation-main {
          grid-template-columns: minmax(0, 1fr) 156px;
          grid-template-rows: auto auto auto auto;
          column-gap: 18px;
        }

        .conversation-head,
        .conversation-title-row {
          display: contents;
        }

        .conversation-head > div {
          grid-column: 1;
          grid-row: 1;
        }

        .conversation-head strong {
          color: rgba(178, 205, 228, 0.78);
          font-size: 16px;
        }

        .conversation-head time {
          grid-column: 2;
          grid-row: 1;
          justify-self: end;
          color: rgba(190, 214, 235, 0.82);
          font-size: 15px;
          font-weight: 900;
        }

        .conversation-title-row h2 {
          grid-column: 1;
          grid-row: 2;
          font-size: 24px;
          line-height: 1.16;
          white-space: normal;
        }

        .conversation-title-row small {
          grid-column: 2;
          grid-row: 2;
          justify-self: end;
          align-self: start;
          min-width: 90px;
          text-align: center;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #ff9a24, #ff6b16 62%, #ed5f00);
          color: #fff;
          box-shadow: 0 12px 28px rgba(255, 112, 18, 0.28);
          font-size: 20px;
          padding: 9px 16px;
        }

        .conversation-main p {
          grid-column: 1;
          grid-row: 3;
          font-size: 15px;
          font-weight: 800;
        }

        .conversation-open {
          grid-column: 1;
          grid-row: 4;
          min-width: 224px;
          justify-content: center;
          border-radius: 999px;
        }

        .conversation-delete {
          width: 58px;
          height: 58px;
          border-radius: 14px;
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

        .messages-page {
          padding: 18px 0 96px !important;
          background:
            radial-gradient(1040px 420px at 94% 0%, rgba(255, 122, 18, 0.16), transparent 64%),
            radial-gradient(840px 340px at 12% -8%, rgba(54, 143, 216, 0.14), transparent 66%),
            linear-gradient(180deg, #020912 0%, #061321 48%, #040c16 100%) !important;
          color: #eef6ff !important;
        }

        .messages-shell {
          width: min(1284px, calc(100vw - 64px)) !important;
          max-width: none !important;
          padding: 0 !important;
          gap: 16px !important;
        }

        .messages-hero {
          position: relative !important;
          display: grid !important;
          grid-template-columns: 126px minmax(0, 1fr) minmax(360px, 410px) !important;
          align-items: center !important;
          min-height: 242px !important;
          gap: 26px !important;
          overflow: hidden !important;
          padding: 36px 72px 34px 38px !important;
          border: 1px solid rgba(100, 145, 190, 0.42) !important;
          border-radius: 20px !important;
          background:
            radial-gradient(720px 260px at 98% 16%, rgba(255, 124, 22, 0.17), transparent 68%),
            radial-gradient(620px 260px at 2% 0%, rgba(80, 153, 218, 0.2), transparent 70%),
            linear-gradient(145deg, rgba(18, 42, 66, 0.94), rgba(7, 20, 35, 0.98)) !important;
          box-shadow:
            0 26px 72px rgba(0, 7, 20, 0.36),
            inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
        }

        .messages-hero::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          width: auto !important;
          background:
            repeating-radial-gradient(ellipse at 83% 50%, rgba(86, 151, 206, 0.18) 0 1px, transparent 1px 12px),
            radial-gradient(260px 220px at 98% 12%, rgba(255, 116, 24, 0.18), transparent 68%) !important;
          opacity: 0.5 !important;
          pointer-events: none !important;
          mask-image: linear-gradient(90deg, transparent 30%, #000 72%, transparent 100%) !important;
          -webkit-mask-image: linear-gradient(90deg, transparent 30%, #000 72%, transparent 100%) !important;
        }

        .messages-hero-icon {
          width: 106px !important;
          height: 106px !important;
          border-radius: 18px !important;
          border: 1px solid rgba(255, 160, 65, 0.78) !important;
          background:
            radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.18), transparent 33%),
            linear-gradient(145deg, #ff9c26, #f05f00 72%) !important;
          box-shadow:
            0 22px 48px rgba(255, 112, 18, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.28) !important;
        }

        .messages-hero-icon svg {
          width: 58px !important;
          height: 58px !important;
          fill: currentColor !important;
          stroke-width: 0 !important;
        }

        .messages-hero .eyebrow {
          color: #4f9fe8 !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          letter-spacing: 0.16em !important;
        }

        .messages-hero h1 {
          margin: 10px 0 8px !important;
          font-size: clamp(3rem, 4.8vw, 3.9rem) !important;
          line-height: 1 !important;
          letter-spacing: 0 !important;
        }

        .messages-hero-lead {
          max-width: 440px !important;
          color: rgba(226, 242, 255, 0.78) !important;
          font-size: 15.5px !important;
          font-weight: 700 !important;
        }

        .messages-hero-copy {
          width: min(100%, 410px) !important;
          max-width: none !important;
          gap: 2px !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          justify-self: end !important;
        }

        .messages-hero-copy span {
          min-height: 78px !important;
          align-items: center !important;
          padding: 18px 26px !important;
          border: 1px solid rgba(100, 145, 190, 0.36) !important;
          border-radius: 14px !important;
          background: rgba(4, 16, 31, 0.68) !important;
          color: rgba(244, 248, 252, 0.92) !important;
          font-size: 14px !important;
          font-weight: 750 !important;
        }

        .messages-hero-copy svg,
        .messages-stat-positive,
        .conversation-open {
          color: #ff8a22 !important;
        }

        .messages-stats {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 16px !important;
        }

        .messages-stat-card {
          position: relative !important;
          min-height: 128px !important;
          padding: 24px 58px 22px 28px !important;
          border-radius: 14px !important;
          border: 1px solid rgba(100, 145, 190, 0.38) !important;
          background:
            radial-gradient(360px 160px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            linear-gradient(145deg, rgba(16, 38, 60, 0.92), rgba(7, 20, 35, 0.98)) !important;
          box-shadow:
            0 18px 46px rgba(0, 7, 18, 0.26),
            inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
        }

        .messages-stat-card::after {
          content: ">" !important;
          position: absolute !important;
          right: 24px !important;
          top: 50% !important;
          transform: translateY(-50%) scaleY(1.55) !important;
          color: rgba(180, 209, 235, 0.72) !important;
          font-size: 28px !important;
          font-weight: 300 !important;
          line-height: 1 !important;
        }

        .messages-stat-icon {
          width: 64px !important;
          height: 64px !important;
          border: 1px solid rgba(255, 160, 65, 0.58) !important;
          border-radius: 14px !important;
          background: linear-gradient(135deg, #ff9a24, #ff6b16 62%, #ed5f00) !important;
          color: #fff !important;
          box-shadow: 0 16px 34px rgba(255, 112, 18, 0.28) !important;
        }

        .messages-stat-label {
          color: rgba(185, 207, 228, 0.8) !important;
          font-size: 13px !important;
          letter-spacing: 0.16em !important;
          text-transform: uppercase !important;
        }

        .messages-stat-text strong {
          font-size: 30px !important;
          color: #fff !important;
        }

        .conversation-list {
          gap: 6px !important;
        }

        .conversation-card {
          display: grid !important;
          grid-template-columns: 138px minmax(0, 1fr) 156px 58px !important;
          align-items: center !important;
          min-height: 156px !important;
          gap: 16px !important;
          padding: 16px 24px 14px 20px !important;
          border: 1px solid rgba(100, 145, 190, 0.34) !important;
          border-radius: 14px !important;
          background:
            radial-gradient(520px 190px at 86% 0%, rgba(255, 122, 26, 0.08), transparent 70%),
            linear-gradient(145deg, rgba(14, 34, 56, 0.94), rgba(7, 19, 34, 0.99)) !important;
          box-shadow:
            0 18px 48px rgba(0, 7, 18, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        }

        .conversation-image {
          width: 138px !important;
          height: 118px !important;
          border-radius: 12px !important;
        }

        .conversation-image img {
          width: 100% !important;
          height: 100% !important;
          border-radius: 11px !important;
          object-fit: cover !important;
        }

        .conversation-main {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 156px !important;
          grid-template-rows: auto auto auto auto !important;
          column-gap: 18px !important;
          row-gap: 6px !important;
          padding: 0 !important;
        }

        .conversation-head,
        .conversation-title-row {
          display: contents !important;
        }

        .conversation-head > div {
          grid-column: 1 !important;
          grid-row: 1 !important;
        }

        .conversation-head strong {
          color: rgba(178, 205, 228, 0.82) !important;
          font-size: 16px !important;
          font-weight: 900 !important;
        }

        .conversation-head time {
          position: static !important;
          grid-column: 2 !important;
          grid-row: 1 !important;
          justify-self: end !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: rgba(190, 214, 235, 0.86) !important;
          font-size: 15px !important;
          font-weight: 900 !important;
        }

        .conversation-title-row h2 {
          grid-column: 1 !important;
          grid-row: 2 !important;
          margin: 0 !important;
          padding: 0 !important;
          color: #fff !important;
          font-size: 24px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          line-height: 1.16 !important;
          white-space: normal !important;
        }

        .conversation-title-row small {
          grid-column: 2 !important;
          grid-row: 2 !important;
          justify-self: end !important;
          align-self: start !important;
          min-width: 90px !important;
          margin: 0 !important;
          padding: 9px 16px !important;
          border: 0 !important;
          border-radius: 10px !important;
          background: linear-gradient(135deg, #ff9a24, #ff6b16 62%, #ed5f00) !important;
          box-shadow: 0 12px 28px rgba(255, 112, 18, 0.28) !important;
          color: #fff !important;
          font-size: 20px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
          text-align: center !important;
        }

        .conversation-main p {
          grid-column: 1 !important;
          grid-row: 3 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: rgba(178, 205, 228, 0.82) !important;
          font-size: 15px !important;
          font-weight: 800 !important;
        }

        .conversation-open {
          grid-column: 1 !important;
          grid-row: 4 !important;
          display: inline-flex !important;
          width: 224px !important;
          min-height: 36px !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 10px !important;
          border: 1px solid rgba(255, 138, 34, 0.56) !important;
          border-radius: 999px !important;
          background: rgba(255, 122, 26, 0.08) !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          text-transform: uppercase !important;
        }

        .conversation-delete {
          position: static !important;
          width: 58px !important;
          height: 58px !important;
          align-self: start !important;
          justify-self: end !important;
          border-radius: 14px !important;
          border: 1px solid rgba(100, 145, 190, 0.36) !important;
          background: rgba(4, 16, 31, 0.72) !important;
          color: rgba(190, 214, 235, 0.78) !important;
        }

        @media (max-width: 900px) {
          .messages-shell {
            width: min(100% - 24px, 1284px) !important;
          }

          .messages-hero,
          .messages-stats {
            grid-template-columns: 1fr !important;
          }

          .messages-hero {
            padding: 22px !important;
          }

          .messages-hero-copy {
            justify-self: stretch !important;
            width: 100% !important;
          }

          .conversation-card {
            grid-template-columns: 96px minmax(0, 1fr) 44px !important;
            min-height: 0 !important;
            padding: 12px !important;
          }

          .conversation-image {
            width: 96px !important;
            height: 96px !important;
          }

          .conversation-main {
            grid-template-columns: minmax(0, 1fr) auto !important;
            row-gap: 5px !important;
          }

          .conversation-title-row h2 {
            font-size: 18px !important;
          }

          .conversation-title-row small {
            font-size: 15px !important;
            min-width: 72px !important;
            padding: 8px 12px !important;
          }

          .conversation-open {
            width: 184px !important;
          }

          .conversation-delete {
            width: 44px !important;
            height: 44px !important;
          }
        }

        @media (max-width: 560px) {
          .messages-page {
            padding-top: 12px !important;
          }

          .messages-hero {
            grid-template-columns: 1fr !important;
          }

          .messages-hero-icon {
            width: 82px !important;
            height: 82px !important;
          }

          .messages-hero h1 {
            font-size: 2.45rem !important;
          }

          .conversation-card {
            grid-template-columns: 84px minmax(0, 1fr) 40px !important;
            gap: 10px !important;
          }

          .conversation-image {
            width: 84px !important;
            height: 84px !important;
            grid-row: auto !important;
          }

          .conversation-main {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }

          .conversation-head,
          .conversation-title-row {
            display: grid !important;
          }

          .conversation-head time,
          .conversation-title-row small {
            justify-self: start !important;
          }

          .conversation-title-row h2,
          .conversation-head time,
          .conversation-title-row small,
          .conversation-main p,
          .conversation-open {
            grid-column: 1 !important;
            grid-row: auto !important;
          }

          .conversation-title-row h2 {
            font-size: 16px !important;
          }

          .conversation-main p {
            white-space: nowrap !important;
          }

          .conversation-open {
            width: 100% !important;
            min-height: 34px !important;
            font-size: 12px !important;
          }

          .conversation-delete {
            width: 40px !important;
            height: 40px !important;
            grid-column: auto !important;
            grid-row: auto !important;
          }
        }

        .messages-inbox-page {
          min-height: calc(100vh - 74px) !important;
          padding: 14px 16px 18px !important;
          background:
            radial-gradient(900px 420px at 68% 16%, rgba(24, 96, 156, 0.2), transparent 66%),
            linear-gradient(180deg, #07131f 0%, #05101b 100%) !important;
          color: #eef7ff !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1420px, calc(100vw - 32px)) !important;
          min-height: min(720px, calc(100vh - 106px)) !important;
          margin: 0 auto !important;
          display: grid !important;
          grid-template-columns: 320px minmax(0, 1fr) !important;
          gap: 14px !important;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper {
          border: 1px solid rgba(74, 104, 132, 0.45) !important;
          border-radius: 8px !important;
          background: rgba(5, 18, 30, 0.78) !important;
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.28) !important;
          overflow: hidden !important;
        }

        .messages-inbox-page .messages-sidebar {
          display: flex !important;
          flex-direction: column !important;
          min-height: 0 !important;
          padding: 14px 10px 10px !important;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 0 14px !important;
          color: #f6fbff !important;
          font-size: 22px !important;
          font-weight: 900 !important;
          letter-spacing: 0 !important;
        }

        .messages-inbox-page .message-tabs {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          overflow: hidden !important;
          border: 1px solid rgba(80, 111, 140, 0.42) !important;
          border-radius: 6px !important;
          background: rgba(5, 16, 27, 0.82) !important;
        }

        .messages-inbox-page .message-tabs button {
          height: 34px !important;
          border: 0 !important;
          border-right: 1px solid rgba(80, 111, 140, 0.34) !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: #a9b8c6 !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .message-tabs button:last-child {
          border-right: 0 !important;
        }

        .messages-inbox-page .message-tabs .active {
          color: #ff8a1c !important;
          background: linear-gradient(180deg, rgba(255, 122, 26, 0.16), rgba(255, 122, 26, 0.06)) !important;
        }

        .messages-inbox-page .message-tabs span,
        .messages-inbox-page .sidebar-unread {
          display: inline-grid !important;
          place-items: center !important;
          min-width: 18px !important;
          height: 18px !important;
          border-radius: 999px !important;
          background: #ff6b00 !important;
          color: #fff !important;
          font-size: 10px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .message-search {
          height: 36px !important;
          margin: 10px 0 8px !important;
          display: grid !important;
          grid-template-columns: auto minmax(0, 1fr) 34px !important;
          align-items: center !important;
          gap: 8px !important;
          padding-left: 10px !important;
          border: 1px solid rgba(80, 111, 140, 0.4) !important;
          border-radius: 6px !important;
          background: rgba(3, 13, 23, 0.86) !important;
          color: #7f93a6 !important;
          font-size: 11px !important;
          font-weight: 700 !important;
        }

        .messages-inbox-page .message-search span {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .message-search button {
          width: 34px !important;
          height: 34px !important;
          border: 0 !important;
          border-left: 1px solid rgba(80, 111, 140, 0.32) !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: #b8c8d8 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .sidebar-list {
          min-height: 0 !important;
          overflow-y: auto !important;
          display: grid !important;
        }

        .messages-inbox-page .sidebar-conversation {
          position: relative !important;
          min-height: 66px !important;
          display: grid !important;
          grid-template-columns: 42px minmax(0, 1fr) auto !important;
          align-items: center !important;
          gap: 9px !important;
          padding: 8px !important;
          border-bottom: 1px solid rgba(80, 111, 140, 0.22) !important;
          color: #dbe7f3 !important;
          text-decoration: none !important;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-left: 2px solid #ff7a00 !important;
          background: linear-gradient(90deg, rgba(255, 122, 26, 0.12), rgba(255, 122, 26, 0.02)) !important;
        }

        .messages-inbox-page .sidebar-avatar {
          position: relative !important;
          width: 36px !important;
          height: 36px !important;
          display: grid !important;
          place-items: center !important;
          border-radius: 999px !important;
          background: #f8fafc !important;
          color: #152334 !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          overflow: visible !important;
        }

        .messages-inbox-page .sidebar-avatar img {
          width: 100% !important;
          height: 100% !important;
          border-radius: 999px !important;
          object-fit: cover !important;
        }

        .messages-inbox-page .sidebar-avatar span {
          position: absolute !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 9px !important;
          height: 9px !important;
          border-radius: 999px !important;
          background: #22c55e !important;
          box-shadow: 0 0 0 2px #06111d !important;
        }

        .messages-inbox-page .sidebar-copy {
          min-width: 0 !important;
          display: grid !important;
          gap: 4px !important;
        }

        .messages-inbox-page .sidebar-copy div {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .messages-inbox-page .sidebar-copy strong,
        .messages-inbox-page .sidebar-copy p {
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .sidebar-copy strong {
          color: #f4f8fc !important;
          font-size: 12.5px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .sidebar-copy time {
          margin-left: auto !important;
          color: #8fa3b6 !important;
          font-size: 10px !important;
          font-weight: 800 !important;
        }

        .messages-inbox-page .sidebar-copy p {
          margin: 0 !important;
          color: #90a5b8 !important;
          font-size: 11px !important;
          font-weight: 700 !important;
        }

        .messages-inbox-page .archive-button {
          height: 34px !important;
          margin-top: 10px !important;
          border: 1px solid rgba(80, 111, 140, 0.42) !important;
          border-radius: 6px !important;
          background: rgba(4, 15, 26, 0.76) !important;
          color: #b9c8d8 !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .chat-wrapper {
          display: flex !important;
          flex-direction: column !important;
          min-height: 0 !important;
        }

        .messages-inbox-page .header {
          min-height: 54px !important;
          padding: 8px 12px !important;
          display: grid !important;
          grid-template-columns: 34px minmax(0, 1fr) !important;
          gap: 10px !important;
          background: rgba(5, 18, 30, 0.92) !important;
          border-bottom: 1px solid rgba(80, 111, 140, 0.34) !important;
        }

        .messages-inbox-page .back-button {
          width: 34px !important;
          height: 34px !important;
          display: grid !important;
          place-items: center !important;
          border: 1px solid rgba(80, 111, 140, 0.42) !important;
          border-radius: 6px !important;
          background: rgba(4, 15, 26, 0.8) !important;
          color: #9fb3c7 !important;
          text-decoration: none !important;
        }

        .messages-inbox-page .seller {
          display: grid !important;
          grid-template-columns: auto minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 10px !important;
          min-width: 0 !important;
          text-decoration: none !important;
        }

        .messages-inbox-page .avatar {
          width: 36px !important;
          height: 36px !important;
          border-radius: 999px !important;
          background: #f8fafc !important;
          display: grid !important;
          place-items: center !important;
          color: #1f2937 !important;
          overflow: visible !important;
          position: relative !important;
        }

        .messages-inbox-page .avatar img {
          width: 100% !important;
          height: 100% !important;
          border-radius: 999px !important;
          object-fit: cover !important;
        }

        .messages-inbox-page .seller-info strong {
          color: #f4f8fc !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          line-height: 1.1 !important;
        }

        .messages-inbox-page .online-status {
          margin: 2px 0 0 !important;
          color: #8fa3b6 !important;
          font-size: 10px !important;
          font-weight: 800 !important;
        }

        .messages-inbox-page .chat-listing-strip {
          display: grid !important;
          grid-template-columns: 78px minmax(0, 1fr) auto !important;
          align-items: center !important;
          gap: 12px !important;
          min-height: 86px !important;
          margin: 0 12px 8px !important;
          padding: 10px !important;
          border: 1px solid rgba(80, 111, 140, 0.32) !important;
          border-radius: 6px !important;
          background: rgba(6, 20, 34, 0.82) !important;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 72px !important;
          height: 58px !important;
          border-radius: 6px !important;
          object-fit: cover !important;
        }

        .messages-inbox-page .listing-summary {
          min-width: 0 !important;
          display: grid !important;
          gap: 5px !important;
        }

        .messages-inbox-page .listing-summary strong {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          color: #e7f1fb !important;
          font-size: 13px !important;
          font-weight: 800 !important;
        }

        .messages-inbox-page .listing-summary span {
          color: #fff !important;
          font-size: 18px !important;
          font-weight: 950 !important;
        }

        .messages-inbox-page .listing-open {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
          min-height: 34px !important;
          padding: 0 14px !important;
          border: 1px solid rgba(80, 111, 140, 0.44) !important;
          border-radius: 6px !important;
          background: rgba(18, 36, 55, 0.9) !important;
          color: #dce8f3 !important;
          font-size: 11px !important;
          font-weight: 850 !important;
          text-decoration: none !important;
        }

        .messages-inbox-page .inbox-preview-area {
          flex: 1 !important;
          min-height: 260px !important;
          display: flex !important;
          align-items: flex-start !important;
          justify-content: flex-start !important;
          padding: 16px 28px !important;
          background: rgba(6, 20, 34, 0.9) !important;
        }

        .messages-inbox-page .preview-message {
          max-width: min(420px, 80%) !important;
          padding: 11px 13px 8px !important;
          border: 1px solid rgba(126, 197, 240, 0.22) !important;
          border-radius: 12px 12px 12px 4px !important;
          background: rgba(20, 43, 67, 0.92) !important;
          color: #e8f4ff !important;
        }

        .messages-inbox-page .preview-message.own {
          margin-left: auto !important;
          border-radius: 12px 12px 4px 12px !important;
          background: linear-gradient(135deg, #ff8a1c 0%, #ff7418 62%, #f06608 100%) !important;
          color: #fff !important;
        }

        .messages-inbox-page .preview-message p {
          margin: 0 0 6px !important;
          color: inherit !important;
          font-size: 13px !important;
          font-weight: 850 !important;
        }

        .messages-inbox-page .preview-message span {
          display: block !important;
          text-align: right !important;
          color: rgba(255, 255, 255, 0.76) !important;
          font-size: 10px !important;
          font-weight: 850 !important;
        }

        .messages-inbox-page .input-area {
          padding: 12px !important;
          border-top: 1px solid rgba(80, 111, 140, 0.34) !important;
          background: rgba(5, 18, 30, 0.94) !important;
        }

        .messages-inbox-page .inbox-compose-preview {
          width: 100% !important;
          min-height: 42px !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 34px !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 0 4px 0 16px !important;
          border: 1px solid rgba(80, 120, 155, 0.52) !important;
          border-radius: 6px !important;
          background: linear-gradient(180deg, rgba(24, 44, 66, 0.92), rgba(14, 31, 51, 0.96)) !important;
          color: rgba(199, 218, 236, 0.72) !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          text-decoration: none !important;
        }

        .messages-inbox-page .inbox-compose-preview span {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .inbox-compose-preview svg {
          width: 34px !important;
          height: 34px !important;
          padding: 8px !important;
          border-radius: 6px !important;
          background: linear-gradient(135deg, #ff9824 0%, #ff7a08 52%, #f06400 100%) !important;
          color: #fff !important;
          box-shadow: 0 10px 20px rgba(255, 112, 10, 0.28) !important;
        }

        .messages-inbox-page .sidebar-empty,
        .messages-inbox-page .messages-login-panel {
          padding: 22px !important;
          color: #9fb3c7 !important;
          text-align: center !important;
          font-size: 13px !important;
          font-weight: 800 !important;
        }

        .messages-inbox-page .messages-login-panel {
          height: 100% !important;
          display: grid !important;
          place-items: center !important;
          align-content: center !important;
          gap: 12px !important;
        }

        .messages-inbox-page .messages-login-panel a {
          color: #ffb86c !important;
        }

        .messages-inbox-page .sidebar-loading .sidebar-avatar,
        .messages-inbox-page .sidebar-loading strong,
        .messages-inbox-page .sidebar-loading p {
          animation: messagePulse 1.4s ease-in-out infinite !important;
          background: linear-gradient(90deg, rgba(32, 56, 78, 0.8), rgba(57, 83, 106, 0.8), rgba(32, 56, 78, 0.8)) !important;
          border-radius: 999px !important;
          color: transparent !important;
        }

        .messages-inbox-page .sidebar-loading strong {
          display: block !important;
          height: 13px !important;
          width: 120px !important;
        }

        .messages-inbox-page .sidebar-loading p {
          height: 11px !important;
          width: 160px !important;
        }

        @media (max-width: 900px) {
          .messages-inbox-page {
            padding: 0 !important;
          }

          .messages-inbox-page .messages-desktop-shell {
            width: 100vw !important;
            min-height: calc(100vh - 70px) !important;
            grid-template-columns: 1fr !important;
          }

          .messages-inbox-page .messages-sidebar {
            border-radius: 0 !important;
          }

          .messages-inbox-page .chat-wrapper {
            display: none !important;
          }
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1240px, calc(100vw - 20px)) !important;
          min-height: min(760px, calc(100vh - 92px)) !important;
          grid-template-columns: 260px minmax(0, 1fr) !important;
          gap: 12px !important;
          margin: 0 auto !important;
        }

        .messages-inbox-page .mobile-chat-back {
          display: none !important;
        }

        .messages-inbox-page .chat-wrapper {
          display: flex !important;
          min-height: min(760px, calc(100vh - 92px)) !important;
          border-radius: 6px !important;
          background: #06131f !important;
        }

        .messages-inbox-page .messages-sidebar {
          min-height: min(760px, calc(100vh - 92px)) !important;
        }

        .messages-inbox-page .sidebar-conversation {
          border: 0 !important;
          border-bottom: 1px solid rgba(80, 111, 140, 0.22) !important;
          text-align: left !important;
          cursor: pointer !important;
        }

        .messages-inbox-page .header {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        .messages-inbox-page .messages-area,
        .messages-inbox-page .chat-window,
        .messages-inbox-page .chat-window .messages {
          background: #061522 !important;
        }

        .messages-inbox-page .chat-window {
          height: 100% !important;
          padding: 14px 10px 12px !important;
        }

        .messages-inbox-page .input-area {
          padding: 10px !important;
          background: #06131f !important;
        }

        .messages-inbox-page .input-area form {
          min-height: 58px !important;
          border-radius: 6px !important;
          background: #0b1d30 !important;
        }

        @media (max-width: 900px) {
          .messages-inbox-page {
            min-height: calc(100dvh - var(--topbar-h, 62px)) !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          .messages-inbox-page .messages-desktop-shell {
            width: 100% !important;
            min-height: calc(100dvh - var(--topbar-h, 62px)) !important;
            height: calc(100dvh - var(--topbar-h, 62px)) !important;
            display: block !important;
            margin: 0 !important;
          }

          .messages-inbox-page .messages-sidebar,
          .messages-inbox-page .chat-wrapper {
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            min-height: 100% !important;
            height: 100% !important;
          }

          .messages-inbox-page .messages-sidebar {
            display: flex !important;
            padding: 14px 10px 10px !important;
          }

          .messages-inbox-page .chat-wrapper {
            display: none !important;
          }

          .messages-inbox-page.mobile-conversation-open .messages-sidebar {
            display: none !important;
          }

          .messages-inbox-page.mobile-conversation-open .chat-wrapper {
            display: flex !important;
          }

          .messages-inbox-page .header {
            grid-template-columns: 38px minmax(0, 1fr) !important;
            min-height: 58px !important;
            padding: 8px 10px !important;
          }

          .messages-inbox-page .mobile-chat-back {
            align-items: center !important;
            align-self: center !important;
            background: rgba(4, 15, 26, 0.88) !important;
            border: 1px solid rgba(80, 111, 140, 0.42) !important;
            border-radius: 8px !important;
            color: #dbeafe !important;
            display: inline-flex !important;
            height: 36px !important;
            justify-content: center !important;
            padding: 0 !important;
            width: 36px !important;
          }

          .messages-inbox-page .chat-listing-strip {
            grid-template-columns: 58px minmax(0, 1fr) !important;
            gap: 10px !important;
            margin: 0 8px 8px !important;
            min-height: 72px !important;
            padding: 8px !important;
          }

          .messages-inbox-page .listing-thumb,
          .messages-inbox-page .listing-thumb img {
            width: 52px !important;
            height: 48px !important;
          }

          .messages-inbox-page .listing-summary span {
            font-size: 15px !important;
          }

          .messages-inbox-page .listing-open {
            grid-column: 1 / -1 !important;
            min-height: 32px !important;
            width: 100% !important;
          }

          .messages-inbox-page .inbox-preview-area {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            overflow: hidden !important;
            padding: 0 !important;
          }

          .messages-inbox-page .chat-window {
            height: 100% !important;
            padding: 12px 10px !important;
          }

          .messages-inbox-page .input-area {
            flex: 0 0 auto !important;
            padding: 8px !important;
            padding-bottom: calc(8px + env(safe-area-inset-bottom)) !important;
          }

          .messages-inbox-page .sidebar-heading h1 {
            font-size: 20px !important;
            margin-bottom: 12px !important;
          }

          .messages-inbox-page .sidebar-list {
            flex: 1 1 auto !important;
          }

          .messages-inbox-page .sidebar-conversation {
            min-height: 70px !important;
          }

          .messages-inbox-page .archive-button {
            flex: 0 0 auto !important;
          }
        }

        .messages-inbox-page {
          min-height: calc(100vh - var(--topbar-h, 0px)) !important;
          padding: 16px 0 26px !important;
          background:
            radial-gradient(780px 360px at 82% -18%, rgba(255, 126, 22, 0.09), transparent 64%),
            radial-gradient(560px 300px at 12% 8%, rgba(63, 124, 173, 0.1), transparent 70%),
            linear-gradient(180deg, #07111d 0%, #06111c 48%, #05101a 100%) !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1470px, calc(100vw - 32px)) !important;
          min-height: min(768px, calc(100vh - var(--topbar-h, 62px) - 32px)) !important;
          display: grid !important;
          grid-template-columns: 270px minmax(0, 1fr) !important;
          gap: 18px !important;
          margin: 0 auto !important;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper {
          border: 1px solid rgba(54, 83, 111, 0.58) !important;
          background: rgba(5, 18, 30, 0.82) !important;
          box-shadow: 0 22px 70px rgba(0, 8, 20, 0.28) !important;
          backdrop-filter: blur(12px) saturate(1.04) !important;
        }

        .messages-inbox-page .messages-sidebar {
          min-height: inherit !important;
          padding: 15px 14px 14px !important;
          border-radius: 8px !important;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 0 14px !important;
          color: #f7fbff !important;
          font-size: 20px !important;
          line-height: 1.05 !important;
          letter-spacing: 0 !important;
        }

        .messages-inbox-page .message-tabs {
          height: 36px !important;
          margin-bottom: 10px !important;
          border-color: rgba(58, 89, 118, 0.72) !important;
          border-radius: 6px !important;
          background: rgba(4, 15, 26, 0.56) !important;
        }

        .messages-inbox-page .message-tabs button {
          border-radius: 0 !important;
          color: #b9c9d8 !important;
          font-size: 10px !important;
          font-weight: 850 !important;
        }

        .messages-inbox-page .message-tabs button.active {
          color: #ff8618 !important;
          background: linear-gradient(180deg, rgba(255, 126, 22, 0.17), rgba(255, 126, 22, 0.06)) !important;
          box-shadow: inset 0 -2px 0 #ff7a12 !important;
        }

        .messages-inbox-page .message-tabs button span,
        .messages-inbox-page .sidebar-unread {
          background: linear-gradient(135deg, #ff9822, #ff6f0c) !important;
          color: #ffffff !important;
          box-shadow: 0 8px 18px rgba(255, 112, 12, 0.25) !important;
        }

        .messages-inbox-page .message-search {
          display: grid !important;
          grid-template-columns: 18px minmax(0, 1fr) 34px !important;
          align-items: center !important;
          gap: 8px !important;
          height: 38px !important;
          margin-bottom: 8px !important;
          border-color: rgba(56, 86, 114, 0.58) !important;
          border-radius: 6px !important;
          background: rgba(3, 13, 23, 0.9) !important;
        }

        .messages-inbox-page .message-search input {
          min-width: 0 !important;
          width: 100% !important;
          height: 100% !important;
          border: 0 !important;
          background: transparent !important;
          color: #dce9f6 !important;
          font-size: 11px !important;
          font-weight: 750 !important;
          outline: none !important;
        }

        .messages-inbox-page .message-search input::placeholder {
          color: #8fa4b7 !important;
          opacity: 1 !important;
        }

        .messages-inbox-page .sidebar-list {
          gap: 0 !important;
          padding-right: 0 !important;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 58px !important;
          grid-template-columns: 38px minmax(0, 1fr) 22px !important;
          gap: 8px !important;
          padding: 7px 6px !important;
          border-bottom: 1px solid rgba(49, 76, 102, 0.38) !important;
          border-left: 2px solid transparent !important;
          border-radius: 6px !important;
          background: transparent !important;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-left-color: #ff7a12 !important;
          background: linear-gradient(90deg, rgba(255, 122, 18, 0.15), rgba(255, 122, 18, 0.02)) !important;
          box-shadow: inset 0 0 0 1px rgba(255, 122, 18, 0.08) !important;
        }

        .messages-inbox-page .sidebar-avatar {
          width: 34px !important;
          height: 34px !important;
          border: 1px solid rgba(224, 238, 250, 0.9) !important;
          box-shadow: 0 0 0 2px rgba(5, 18, 30, 0.95) !important;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 12px !important;
        }

        .messages-inbox-page .sidebar-copy time {
          font-size: 9.5px !important;
        }

        .messages-inbox-page .sidebar-copy p {
          color: #8fa5b8 !important;
          font-size: 10.5px !important;
        }

        .messages-inbox-page .archive-button {
          height: 30px !important;
          margin-top: 9px !important;
          border-color: rgba(56, 86, 114, 0.58) !important;
          background: rgba(3, 13, 23, 0.7) !important;
        }

        .messages-inbox-page .chat-wrapper {
          min-height: inherit !important;
          overflow: hidden !important;
          border-radius: 8px !important;
        }

        .messages-inbox-page .header {
          min-height: 52px !important;
          padding: 8px 14px !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          align-items: center !important;
          gap: 16px !important;
          background: linear-gradient(180deg, rgba(5, 18, 30, 0.98), rgba(4, 15, 26, 0.96)) !important;
          border-bottom: 1px solid rgba(50, 78, 105, 0.52) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .seller {
          grid-template-columns: 38px minmax(0, 1fr) !important;
          gap: 10px !important;
        }

        .messages-inbox-page .avatar {
          width: 36px !important;
          height: 36px !important;
          box-shadow: 0 0 0 2px rgba(5, 18, 30, 0.95) !important;
        }

        .messages-inbox-page .seller-info strong {
          font-size: 13px !important;
          letter-spacing: 0 !important;
        }

        .messages-inbox-page .online-status.online {
          color: #7fe7ad !important;
        }

        .messages-inbox-page .chat-actions {
          display: flex !important;
          align-items: center !important;
          gap: 14px !important;
        }

        .messages-inbox-page .chat-action-menu-wrap {
          position: relative !important;
        }

        .messages-inbox-page .chat-actions button {
          width: 24px !important;
          height: 24px !important;
          display: inline-grid !important;
          place-items: center !important;
          border: 0 !important;
          border-radius: 6px !important;
          background: transparent !important;
          color: #b6c8d8 !important;
          padding: 0 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .chat-actions button:hover {
          background: rgba(126, 197, 240, 0.1) !important;
          color: #ffffff !important;
        }

        .messages-inbox-page .chat-action-menu {
          position: absolute !important;
          right: 0 !important;
          top: calc(100% + 8px) !important;
          z-index: 30 !important;
          width: 190px !important;
          padding: 6px !important;
          border: 1px solid rgba(65, 94, 121, 0.68) !important;
          border-radius: 8px !important;
          background: rgba(7, 20, 34, 0.98) !important;
          box-shadow: 0 18px 42px rgba(0, 7, 18, 0.38) !important;
        }

        .messages-inbox-page .chat-action-menu button {
          width: 100% !important;
          height: 34px !important;
          display: flex !important;
          justify-content: flex-start !important;
          gap: 8px !important;
          padding: 0 9px !important;
          color: #dce9f6 !important;
          font-size: 11px !important;
          font-weight: 800 !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .chat-action-menu button.danger {
          color: #ff8d8d !important;
        }

        .messages-inbox-page .conversation-details {
          min-height: inherit !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
          overflow-y: auto !important;
        }

        .messages-inbox-page .details-card {
          display: grid !important;
          gap: 14px !important;
          padding: 16px 14px !important;
          border: 1px solid rgba(54, 83, 111, 0.58) !important;
          border-radius: 7px !important;
          background: #071522 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .details-card h2 {
          margin: 0 !important;
          color: #f7fbff !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          letter-spacing: 0 !important;
        }

        .messages-inbox-page .details-listing,
        .messages-inbox-page .details-seller {
          display: grid !important;
          grid-template-columns: 76px minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 12px !important;
        }

        .messages-inbox-page .details-listing img {
          width: 76px !important;
          height: 64px !important;
          border-radius: 5px !important;
          object-fit: cover !important;
        }

        .messages-inbox-page .details-listing strong,
        .messages-inbox-page .details-seller strong {
          display: block !important;
          color: #f4f8fc !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          line-height: 1.3 !important;
        }

        .messages-inbox-page .details-listing span {
          display: block !important;
          margin-top: 8px !important;
          color: #ffffff !important;
          font-size: 21px !important;
          font-weight: 950 !important;
        }

        .messages-inbox-page .details-seller {
          grid-template-columns: 52px minmax(0, 1fr) !important;
          min-height: 56px !important;
        }

        .messages-inbox-page .details-seller .avatar {
          width: 50px !important;
          height: 50px !important;
        }

        .messages-inbox-page .details-seller span {
          color: #7fe7ad !important;
          font-size: 11px !important;
          font-weight: 800 !important;
        }

        .messages-inbox-page .details-card dl {
          display: grid !important;
          gap: 8px !important;
          margin: 0 !important;
        }

        .messages-inbox-page .details-card dl div {
          display: flex !important;
          justify-content: space-between !important;
          gap: 12px !important;
        }

        .messages-inbox-page .details-card dt,
        .messages-inbox-page .details-card dd {
          margin: 0 !important;
          font-size: 11px !important;
          font-weight: 850 !important;
        }

        .messages-inbox-page .details-card dt {
          color: #91a8bb !important;
        }

        .messages-inbox-page .details-card dd {
          color: #f2f7fc !important;
          text-align: right !important;
        }

        .messages-inbox-page .details-button,
        .messages-inbox-page .details-card > button {
          min-height: 36px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          width: 100% !important;
          border: 1px solid rgba(63, 96, 126, 0.74) !important;
          border-radius: 5px !important;
          background: #081a2b !important;
          color: #dce9f6 !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          text-decoration: none !important;
        }

        .messages-inbox-page .details-card > button.danger {
          color: #ff8d8d !important;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 72px !important;
          margin: 0 !important;
          padding: 10px 14px !important;
          grid-template-columns: 78px minmax(0, 1fr) auto !important;
          gap: 12px !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(50, 78, 105, 0.52) !important;
          border-radius: 0 !important;
          background: rgba(6, 20, 34, 0.78) !important;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 76px !important;
          height: 56px !important;
          border-radius: 6px !important;
        }

        .messages-inbox-page .listing-summary strong {
          font-size: 12px !important;
          font-weight: 780 !important;
        }

        .messages-inbox-page .listing-summary span {
          font-size: 18px !important;
          font-weight: 820 !important;
        }

        .messages-inbox-page .listing-open {
          min-height: 32px !important;
          padding: 0 13px !important;
          border-color: rgba(65, 94, 121, 0.66) !important;
          border-radius: 5px !important;
          background: rgba(22, 41, 59, 0.92) !important;
          font-size: 10.5px !important;
        }

        .messages-inbox-page .inbox-preview-area {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          padding: 0 !important;
          background: #061522 !important;
          overflow: hidden !important;
        }

        .messages-inbox-page .chat-window {
          width: 100% !important;
          height: 100% !important;
          padding: 14px 18px 12px !important;
          background:
            radial-gradient(640px 260px at 54% 0%, rgba(17, 54, 82, 0.22), transparent 72%),
            #061522 !important;
        }

        .messages-inbox-page .chat-window .messages {
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          gap: 18px !important;
        }

        .messages-inbox-page .chat-window .row {
          width: 100% !important;
          min-height: 48px !important;
          display: flex !important;
          align-items: flex-start !important;
          gap: 10px !important;
          padding: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .chat-window .own-row {
          justify-content: flex-end !important;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          display: grid !important;
          gap: 7px !important;
          max-width: min(440px, 78%) !important;
          min-width: 72px !important;
          padding: 11px 13px 8px !important;
          border: 0 !important;
          border-radius: 7px !important;
          overflow: hidden !important;
          color: #ffffff !important;
        }

        .messages-inbox-page .chat-window .own {
          margin-left: auto !important;
          border-bottom-right-radius: 4px !important;
          background: linear-gradient(180deg, #ff861a 0%, #ff760f 58%, #ff6a00 100%) !important;
          box-shadow: 0 14px 30px rgba(255, 102, 0, 0.28) !important;
        }

        .messages-inbox-page .chat-window .other {
          border-bottom-left-radius: 4px !important;
          background: linear-gradient(180deg, #172434 0%, #132231 100%) !important;
          box-shadow: 0 14px 30px rgba(0, 8, 20, 0.3) !important;
          color: #e8f4ff !important;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          margin: 0 !important;
          color: inherit !important;
          font-size: 12.5px !important;
          font-weight: 650 !important;
          line-height: 1.45 !important;
          overflow-wrap: anywhere !important;
        }

        .messages-inbox-page .chat-window .message-meta {
          min-height: 14px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-self: end !important;
          gap: 5px !important;
          color: rgba(255, 255, 255, 0.84) !important;
          font-size: 10.5px !important;
          font-weight: 750 !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .chat-window .other .message-meta {
          color: rgba(210, 231, 247, 0.68) !important;
        }

        .messages-inbox-page .chat-window .read-state {
          min-width: 15px !important;
          height: 14px !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          color: rgba(255, 255, 255, 0.86) !important;
        }

        .messages-inbox-page .chat-window .read-state span {
          display: none !important;
        }

        .messages-inbox-page .chat-window .message-avatar {
          width: 34px !important;
          height: 34px !important;
          align-self: flex-end !important;
          border: 1px solid rgba(226, 244, 255, 0.82) !important;
          box-shadow:
            0 0 0 2px rgba(3, 14, 30, 0.96),
            0 12px 24px rgba(0, 8, 22, 0.32) !important;
        }

        .messages-inbox-page .input-area {
          padding: 10px !important;
          border-top: 1px solid rgba(50, 78, 105, 0.52) !important;
          background: rgba(5, 18, 30, 0.98) !important;
        }

        .messages-inbox-page .input-area form {
          min-height: 52px !important;
          grid-template-columns: 26px 26px 26px minmax(0, 1fr) 42px !important;
          grid-template-rows: 42px !important;
          align-items: center !important;
          gap: 7px !important;
          padding: 5px 6px !important;
          border-color: rgba(50, 78, 105, 0.54) !important;
          border-radius: 6px !important;
          background: rgba(7, 22, 36, 0.98) !important;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          grid-column: 4 !important;
          grid-row: 1 !important;
          height: 38px !important;
          padding: 0 12px !important;
          border-radius: 5px !important;
          background: #ffffff !important;
          color: #152334 !important;
        }

        .messages-inbox-page .input-area input::placeholder {
          color: #6c7a89 !important;
        }

        .messages-inbox-page .input-area .tools {
          display: contents !important;
        }

        .messages-inbox-page .input-area .tool {
          width: 26px !important;
          height: 26px !important;
          color: #b9c8d8 !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(1) {
          grid-column: 1 !important;
          grid-row: 1 !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(2) {
          grid-column: 2 !important;
          grid-row: 1 !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(3) {
          grid-column: 3 !important;
          grid-row: 1 !important;
        }

        .messages-inbox-page .input-area .send {
          grid-column: 5 !important;
          grid-row: 1 !important;
          width: 42px !important;
          height: 42px !important;
          border-radius: 7px !important;
          background: linear-gradient(135deg, #ff9822, #ff7613 58%, #f06400) !important;
          box-shadow: 0 14px 30px rgba(255, 112, 12, 0.32) !important;
        }

        @media (max-width: 900px) {
          .messages-inbox-page {
            min-height: calc(100dvh - var(--topbar-h, 62px)) !important;
            padding: 0 !important;
          }

          .messages-inbox-page .messages-desktop-shell {
            width: 100% !important;
            min-height: calc(100dvh - var(--topbar-h, 62px)) !important;
            height: calc(100dvh - var(--topbar-h, 62px)) !important;
            display: block !important;
          }

          .messages-inbox-page .conversation-details {
            display: none !important;
          }

          .messages-inbox-page .messages-sidebar,
          .messages-inbox-page .chat-wrapper {
            height: 100% !important;
            min-height: 100% !important;
            border-radius: 0 !important;
            border-left: 0 !important;
            border-right: 0 !important;
          }

          .messages-inbox-page .messages-sidebar {
            padding: 14px 10px 10px !important;
          }

          .messages-inbox-page .header {
            grid-template-columns: 38px minmax(0, 1fr) auto !important;
            min-height: 58px !important;
            gap: 10px !important;
            padding: 8px 10px !important;
          }

          .messages-inbox-page .mobile-chat-back {
            display: inline-flex !important;
          }

          .messages-inbox-page .chat-actions {
            gap: 6px !important;
          }

          .messages-inbox-page .chat-actions button {
            width: 22px !important;
            height: 22px !important;
          }

          .messages-inbox-page .chat-listing-strip {
            grid-template-columns: 58px minmax(0, 1fr) !important;
            padding: 8px !important;
          }

          .messages-inbox-page .listing-open {
            grid-column: 1 / -1 !important;
          }

          .messages-inbox-page .input-area form {
            grid-template-columns: 24px 24px 24px minmax(0, 1fr) 38px !important;
            grid-template-rows: 38px !important;
          }

          .messages-inbox-page .input-area input[type="text"],
          .messages-inbox-page .input-area input:not([type]) {
            height: 34px !important;
          }

          .messages-inbox-page .input-area .send {
            width: 38px !important;
            height: 38px !important;
          }
        }

        @media (max-width: 420px) {
          .messages-inbox-page .message-tabs button {
            font-size: 10px !important;
          }

          .messages-inbox-page .sidebar-conversation {
            grid-template-columns: 40px minmax(0, 1fr) auto !important;
            gap: 8px !important;
            padding: 8px 6px !important;
          }

          .messages-inbox-page .sidebar-avatar,
          .messages-inbox-page .avatar {
            width: 34px !important;
            height: 34px !important;
          }
        }

        .messages-inbox-page {
          min-height: calc(100vh - var(--topbar-h, 0px)) !important;
          padding: 0 !important;
          overflow: hidden !important;
          background:
            radial-gradient(520px 260px at 62% 0%, rgba(15, 62, 94, 0.2), transparent 70%),
            linear-gradient(180deg, #06111d 0%, #05101a 100%) !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(760px, 100vw) !important;
          height: calc(100vh - var(--topbar-h, 0px)) !important;
          min-height: 600px !important;
          display: grid !important;
          grid-template-columns: 260px minmax(0, 1fr) !important;
          gap: 20px !important;
          margin: 0 !important;
          padding: 16px 8px 8px 16px !important;
        }

        .messages-inbox-page .messages-sidebar {
          height: 100% !important;
          min-height: 0 !important;
          padding: 5px 0 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 0 15px 2px !important;
          color: #f5f9ff !important;
          font-size: 18px !important;
          font-weight: 950 !important;
        }

        .messages-inbox-page .message-tabs {
          height: 32px !important;
          margin-bottom: 10px !important;
          overflow: hidden !important;
          border: 1px solid rgba(57, 90, 119, 0.62) !important;
          border-radius: 5px !important;
          background: rgba(4, 15, 26, 0.7) !important;
        }

        .messages-inbox-page .message-tabs button {
          min-width: 0 !important;
          padding: 0 8px !important;
          border: 0 !important;
          border-right: 1px solid rgba(57, 90, 119, 0.34) !important;
          border-radius: 0 !important;
          color: #c1cedc !important;
          font-size: 10px !important;
          font-weight: 850 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .message-tabs button:last-child {
          border-right: 0 !important;
        }

        .messages-inbox-page .message-tabs button.active {
          color: #ff8518 !important;
          background: linear-gradient(180deg, rgba(255, 119, 15, 0.18), rgba(255, 119, 15, 0.05)) !important;
          box-shadow: inset 0 -2px 0 #ff7a12 !important;
        }

        .messages-inbox-page .message-tabs button span,
        .messages-inbox-page .sidebar-unread {
          min-width: 17px !important;
          height: 17px !important;
          padding: 0 5px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 999px !important;
          background: #ff7412 !important;
          color: #fff !important;
          font-size: 10px !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .message-search {
          height: 34px !important;
          margin-bottom: 9px !important;
          padding: 0 0 0 10px !important;
          border: 1px solid rgba(57, 90, 119, 0.58) !important;
          border-radius: 5px !important;
          background: rgba(4, 15, 26, 0.76) !important;
        }

        .messages-inbox-page .message-search input {
          font-size: 10.5px !important;
          font-weight: 750 !important;
        }

        .messages-inbox-page .message-search button {
          width: 34px !important;
          height: 34px !important;
          border-left: 1px solid rgba(57, 90, 119, 0.44) !important;
        }

        .messages-inbox-page .sidebar-list {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          display: block !important;
        }

        .messages-inbox-page .sidebar-conversation {
          width: 100% !important;
          min-height: 54px !important;
          display: grid !important;
          grid-template-columns: 38px minmax(0, 1fr) 20px !important;
          align-items: center !important;
          gap: 9px !important;
          padding: 7px 7px !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(51, 78, 103, 0.34) !important;
          border-left: 2px solid transparent !important;
          border-radius: 0 !important;
          background: transparent !important;
          text-align: left !important;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-left-color: #ff7412 !important;
          background: linear-gradient(90deg, rgba(255, 116, 18, 0.18), rgba(255, 116, 18, 0.02)) !important;
        }

        .messages-inbox-page .sidebar-avatar {
          width: 34px !important;
          height: 34px !important;
          border: 1px solid rgba(234, 246, 255, 0.9) !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .sidebar-copy {
          gap: 3px !important;
        }

        .messages-inbox-page .sidebar-copy strong {
          color: #f5f9ff !important;
          font-size: 12px !important;
          font-weight: 850 !important;
        }

        .messages-inbox-page .sidebar-copy time {
          color: #97a8b8 !important;
          font-size: 9.5px !important;
          font-weight: 750 !important;
        }

        .messages-inbox-page .sidebar-copy p {
          color: #9aaaba !important;
          font-size: 10.5px !important;
          font-weight: 650 !important;
        }

        .messages-inbox-page .archive-button {
          height: 28px !important;
          margin: 7px 0 0 !important;
          border: 1px solid rgba(57, 90, 119, 0.58) !important;
          border-radius: 5px !important;
          background: rgba(4, 15, 26, 0.74) !important;
          color: #c9d5e1 !important;
          font-size: 10.5px !important;
          font-weight: 800 !important;
        }

        .messages-inbox-page .chat-wrapper {
          height: 100% !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          border: 0 !important;
          border-left: 1px solid rgba(42, 68, 94, 0.42) !important;
          border-radius: 0 !important;
          background:
            radial-gradient(520px 260px at 58% 8%, rgba(12, 55, 88, 0.22), transparent 68%),
            linear-gradient(180deg, rgba(5, 17, 29, 0.84), rgba(5, 16, 27, 0.88)) !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
        }

        .messages-inbox-page .header {
          min-height: 42px !important;
          padding: 0 0 10px !important;
          display: grid !important;
          grid-template-columns: 34px minmax(0, 1fr) auto !important;
          align-items: center !important;
          gap: 8px !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .mobile-chat-back {
          width: 30px !important;
          height: 30px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 1px solid rgba(57, 90, 119, 0.58) !important;
          border-radius: 5px !important;
          background: rgba(4, 15, 26, 0.72) !important;
          color: #dce8f4 !important;
        }

        .messages-inbox-page .seller {
          grid-template-columns: 34px minmax(0, 1fr) !important;
          gap: 8px !important;
        }

        .messages-inbox-page .avatar {
          width: 34px !important;
          height: 34px !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .seller-info strong {
          color: #f5f9ff !important;
          font-size: 12.5px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .online-status {
          color: #8da0b2 !important;
          font-size: 9.5px !important;
          font-weight: 750 !important;
        }

        .messages-inbox-page .online-status.online {
          color: #6fe7a4 !important;
        }

        .messages-inbox-page .chat-actions {
          gap: 12px !important;
        }

        .messages-inbox-page .chat-actions button {
          width: 20px !important;
          height: 20px !important;
          color: #c7d4e2 !important;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 70px !important;
          margin: 0 0 14px !important;
          padding: 8px !important;
          display: grid !important;
          grid-template-columns: 78px minmax(0, 1fr) auto !important;
          gap: 11px !important;
          align-items: center !important;
          border: 1px solid rgba(42, 68, 94, 0.46) !important;
          border-radius: 5px !important;
          background: rgba(5, 18, 30, 0.66) !important;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 76px !important;
          height: 56px !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .listing-summary strong {
          color: #f5f9ff !important;
          font-size: 12px !important;
          font-weight: 750 !important;
        }

        .messages-inbox-page .listing-summary span {
          margin-top: 4px !important;
          color: #fff !important;
          font-size: 17px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .listing-open {
          min-height: 34px !important;
          padding: 0 12px !important;
          border: 1px solid rgba(57, 90, 119, 0.58) !important;
          border-radius: 5px !important;
          background: rgba(14, 32, 51, 0.9) !important;
          color: #dce8f4 !important;
          font-size: 10.5px !important;
          font-weight: 800 !important;
        }

        .messages-inbox-page .inbox-preview-area {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .messages-area.inbox-preview-area,
        body .messages-inbox-page .messages-area.inbox-preview-area,
        body > main.messages-inbox-page .messages-area.inbox-preview-area {
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          background: transparent !important;
          background-image: none !important;
          color: #e8f2fc !important;
        }

        .messages-inbox-page .chat-window {
          width: 100% !important;
          height: 100% !important;
          padding: 2px 8px 12px 0 !important;
          background: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .chat-window .messages {
          width: 100% !important;
          max-width: none !important;
          gap: 18px !important;
          padding: 0 !important;
          background: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .chat-window .row {
          padding: 0 6px 0 0 !important;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          max-width: min(380px, 78%) !important;
          padding: 10px 12px 8px !important;
          border-radius: 6px !important;
        }

        .messages-inbox-page .chat-window .own {
          background: linear-gradient(180deg, #ff8619, #ff730c) !important;
          box-shadow: 0 16px 34px rgba(255, 112, 12, 0.28) !important;
        }

        .messages-inbox-page .chat-window .other {
          background: linear-gradient(180deg, #172637, #142332) !important;
          box-shadow: 0 14px 28px rgba(0, 7, 18, 0.28) !important;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 12px !important;
          line-height: 1.42 !important;
        }

        .messages-inbox-page .input-area {
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
        }

        .messages-inbox-page .input-area form {
          min-height: 52px !important;
          grid-template-columns: 34px 34px minmax(0, 1fr) 42px !important;
          grid-template-rows: 44px !important;
          gap: 0 !important;
          padding: 4px !important;
          border: 1px solid rgba(57, 90, 119, 0.58) !important;
          border-radius: 6px !important;
          background: rgba(5, 18, 30, 0.76) !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(1) {
          grid-column: 1 !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(2) {
          display: none !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(3) {
          grid-column: 2 !important;
        }

        .messages-inbox-page .input-area .tool {
          width: 34px !important;
          height: 44px !important;
          color: #b8c8d8 !important;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          grid-column: 3 !important;
          height: 44px !important;
          padding: 0 12px !important;
          background: transparent !important;
          color: #e9f2fb !important;
          font-size: 12px !important;
          font-weight: 650 !important;
        }

        .messages-inbox-page .input-area input::placeholder {
          color: #8193a4 !important;
        }

        .messages-inbox-page .input-area .send {
          grid-column: 4 !important;
          width: 34px !important;
          height: 34px !important;
          border-radius: 6px !important;
          background: linear-gradient(135deg, #247cff, #1f65d8) !important;
          box-shadow: 0 12px 26px rgba(31, 101, 216, 0.3) !important;
        }

        @media (min-width: 981px) {
          .messages-inbox-page .messages-desktop-shell {
            width: min(760px, calc(100vw - 28px)) !important;
          }
        }

        .messages-inbox-page {
          position: relative !important;
          isolation: isolate !important;
          background:
            linear-gradient(135deg, rgba(255, 122, 18, 0.05) 0%, transparent 18%),
            linear-gradient(180deg, rgba(5, 18, 30, 0.94) 0%, rgba(7, 21, 30, 0.98) 56%, #050e17 100%) !important;
        }

        .messages-inbox-page::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: -1 !important;
          pointer-events: none !important;
          background:
            linear-gradient(90deg, rgba(126, 197, 240, 0.035) 1px, transparent 1px),
            linear-gradient(180deg, rgba(126, 197, 240, 0.028) 1px, transparent 1px),
            linear-gradient(120deg, transparent 0%, rgba(255, 122, 18, 0.055) 44%, transparent 72%),
            linear-gradient(180deg, rgba(8, 33, 52, 0.42), transparent 48%) !important;
          background-size:
            42px 42px,
            42px 42px,
            100% 100%,
            100% 100% !important;
          opacity: 0.9 !important;
        }

        .messages-inbox-page::after {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          z-index: -1 !important;
          pointer-events: none !important;
          background:
            linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.22) 100%),
            repeating-linear-gradient(
              0deg,
              rgba(255, 255, 255, 0.018) 0,
              rgba(255, 255, 255, 0.018) 1px,
              transparent 1px,
              transparent 5px
            ) !important;
          mix-blend-mode: screen !important;
          opacity: 0.34 !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(750px, calc(100vw - 22px)) !important;
          min-height: min(642px, calc(100vh - var(--topbar-h, 0px) - 14px)) !important;
          height: min(642px, calc(100vh - var(--topbar-h, 0px) - 14px)) !important;
          grid-template-columns: 266px minmax(0, 1fr) !important;
          gap: 16px !important;
          padding: 14px 8px 8px 14px !important;
        }

        .messages-inbox-page .messages-sidebar {
          color: #f6fbff !important;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 0 13px 2px !important;
          text-shadow: 0 10px 30px rgba(0, 0, 0, 0.32) !important;
        }

        .messages-inbox-page .message-tabs,
        .messages-inbox-page .message-search,
        .messages-inbox-page .archive-button {
          background: rgba(3, 13, 23, 0.72) !important;
          border-color: rgba(68, 104, 134, 0.58) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
        }

        .messages-inbox-page .message-tabs {
          border-radius: 5px !important;
        }

        .messages-inbox-page .message-tabs button.active {
          background:
            linear-gradient(180deg, rgba(255, 128, 26, 0.22), rgba(255, 128, 26, 0.07)) !important;
          color: #ff8a1d !important;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 56px !important;
          border-bottom-color: rgba(48, 78, 104, 0.34) !important;
        }

        .messages-inbox-page .sidebar-conversation.active {
          background:
            linear-gradient(90deg, rgba(255, 116, 18, 0.18), rgba(255, 116, 18, 0.03)),
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent) !important;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.035) !important;
        }

        .messages-inbox-page .chat-wrapper {
          border-left-color: rgba(58, 89, 116, 0.5) !important;
          background:
            linear-gradient(90deg, rgba(255, 122, 18, 0.026), transparent 26%),
            linear-gradient(180deg, rgba(4, 15, 26, 0.6), rgba(4, 14, 24, 0.84)) !important;
        }

        .messages-inbox-page .header {
          background:
            linear-gradient(180deg, rgba(5, 18, 31, 0.86), rgba(5, 18, 31, 0.44)) !important;
          border-bottom: 1px solid rgba(58, 89, 116, 0.34) !important;
          margin-bottom: 7px !important;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 72px !important;
          margin: 0 0 12px !important;
          background:
            linear-gradient(180deg, rgba(8, 26, 43, 0.78), rgba(5, 18, 31, 0.72)) !important;
          border-color: rgba(58, 89, 116, 0.5) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.035),
            0 18px 44px rgba(0, 6, 18, 0.16) !important;
        }

        .messages-inbox-page .chat-window {
          padding: 2px 8px 10px 0 !important;
        }

        .messages-inbox-page .chat-window .messages {
          gap: 17px !important;
        }

        .messages-inbox-page .chat-window .own {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 36%),
            linear-gradient(180deg, #ff8619 0%, #ff730c 100%) !important;
          box-shadow:
            0 18px 38px rgba(255, 112, 12, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
        }

        .messages-inbox-page .chat-window .other {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 38%),
            linear-gradient(180deg, #172637 0%, #142332 100%) !important;
          box-shadow:
            0 14px 30px rgba(0, 7, 18, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
        }

        .messages-inbox-page .input-area form {
          background:
            linear-gradient(180deg, rgba(8, 25, 41, 0.84), rgba(5, 18, 31, 0.82)) !important;
          border-color: rgba(68, 104, 134, 0.56) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035) !important;
        }

        .messages-inbox-page .input-area .send {
          background: linear-gradient(135deg, #2a83ff, #1f63d5) !important;
        }

        .messages-inbox-page {
          padding: 20px 16px !important;
          background:
            radial-gradient(900px 520px at 78% -12%, rgba(37, 100, 152, 0.16), transparent 68%),
            radial-gradient(720px 420px at 8% 8%, rgba(255, 122, 18, 0.07), transparent 62%),
            linear-gradient(180deg, #040d18 0%, #06121f 48%, #050d17 100%) !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1440px, calc(100vw - 32px)) !important;
          height: min(920px, calc(100vh - var(--topbar-h, 0px) - 40px)) !important;
          min-height: 760px !important;
          grid-template-columns: minmax(380px, 462px) minmax(0, 1fr) !important;
          gap: 8px !important;
          padding: 0 !important;
          margin: 0 auto !important;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper {
          border: 1px solid rgba(79, 111, 143, 0.48) !important;
          border-radius: 22px !important;
          background:
            radial-gradient(700px 300px at 20% 0%, rgba(32, 74, 112, 0.17), transparent 70%),
            linear-gradient(180deg, rgba(7, 19, 33, 0.94), rgba(4, 14, 25, 0.96)) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.045),
            0 28px 80px rgba(0, 8, 22, 0.28) !important;
        }

        .messages-inbox-page .messages-sidebar {
          padding: 34px 16px 20px !important;
          display: flex !important;
          flex-direction: column !important;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 0 30px 7px !important;
          font-size: 32px !important;
          line-height: 1 !important;
          font-weight: 950 !important;
        }

        .messages-inbox-page .message-tabs {
          height: 58px !important;
          margin-bottom: 32px !important;
          border-radius: 13px !important;
          background: rgba(9, 25, 43, 0.82) !important;
        }

        .messages-inbox-page .message-tabs button {
          font-size: 15px !important;
          font-weight: 850 !important;
          padding: 0 18px !important;
        }

        .messages-inbox-page .message-tabs button.active {
          border: 1px solid rgba(255, 119, 15, 0.72) !important;
          border-radius: 12px !important;
          background:
            radial-gradient(120px 70px at 50% 100%, rgba(255, 122, 18, 0.24), transparent 72%),
            linear-gradient(180deg, rgba(92, 50, 25, 0.86), rgba(47, 31, 26, 0.92)) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 14px 32px rgba(255, 112, 12, 0.12) !important;
        }

        .messages-inbox-page .message-tabs button span {
          min-width: 30px !important;
          height: 30px !important;
          margin-left: 10px !important;
          font-size: 15px !important;
        }

        .messages-inbox-page .message-search {
          height: 62px !important;
          margin-bottom: 26px !important;
          grid-template-columns: 38px minmax(0, 1fr) 56px !important;
          border-radius: 12px !important;
          background: rgba(6, 20, 35, 0.88) !important;
        }

        .messages-inbox-page .message-search svg {
          width: 24px !important;
          height: 24px !important;
        }

        .messages-inbox-page .message-search input {
          font-size: 17px !important;
          font-weight: 600 !important;
        }

        .messages-inbox-page .message-search button {
          width: 56px !important;
          height: 62px !important;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 118px !important;
          grid-template-columns: 82px minmax(0, 1fr) 42px !important;
          gap: 18px !important;
          padding: 18px 18px !important;
          margin-bottom: 14px !important;
          border: 1px solid rgba(63, 92, 122, 0.34) !important;
          border-left: 2px solid transparent !important;
          border-radius: 9px !important;
          background: rgba(5, 17, 30, 0.54) !important;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-left-color: #ff7412 !important;
          border-color: rgba(255, 122, 18, 0.6) rgba(63, 92, 122, 0.42) rgba(63, 92, 122, 0.42) #ff7412 !important;
          background:
            radial-gradient(190px 110px at 15% 50%, rgba(255, 122, 18, 0.22), transparent 70%),
            linear-gradient(90deg, rgba(75, 53, 39, 0.86), rgba(16, 31, 47, 0.8)) !important;
        }

        .messages-inbox-page .sidebar-avatar {
          width: 72px !important;
          height: 72px !important;
        }

        .messages-inbox-page .sidebar-avatar span {
          width: 16px !important;
          height: 16px !important;
        }

        .messages-inbox-page .sidebar-copy {
          gap: 11px !important;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 21px !important;
          font-weight: 950 !important;
        }

        .messages-inbox-page .sidebar-copy time {
          font-size: 18px !important;
          font-weight: 650 !important;
        }

        .messages-inbox-page .sidebar-copy p {
          font-size: 18px !important;
          font-weight: 600 !important;
        }

        .messages-inbox-page .sidebar-unread {
          min-width: 32px !important;
          height: 32px !important;
          font-size: 17px !important;
        }

        .messages-inbox-page .archive-button {
          height: 76px !important;
          margin-top: auto !important;
          border-radius: 12px !important;
          background: linear-gradient(180deg, rgba(18, 43, 68, 0.94), rgba(9, 28, 48, 0.96)) !important;
          font-size: 18px !important;
          font-weight: 900 !important;
          gap: 12px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .messages-inbox-page .chat-wrapper {
          padding: 24px 24px 16px !important;
          border-left: 1px solid rgba(79, 111, 143, 0.48) !important;
        }

        .messages-inbox-page .header {
          min-height: 82px !important;
          margin: 0 0 18px !important;
          padding: 0 !important;
          grid-template-columns: 56px 76px minmax(0, 1fr) auto !important;
          gap: 16px !important;
          border: 0 !important;
          background: transparent !important;
        }

        .messages-inbox-page .mobile-chat-back {
          width: 56px !important;
          height: 56px !important;
          border-radius: 14px !important;
        }

        .messages-inbox-page .seller {
          display: contents !important;
        }

        .messages-inbox-page .avatar {
          width: 66px !important;
          height: 66px !important;
        }

        .messages-inbox-page .seller-info {
          align-self: center !important;
        }

        .messages-inbox-page .seller-info strong {
          font-size: 26px !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .online-status {
          margin-top: 8px !important;
          font-size: 18px !important;
          font-weight: 850 !important;
        }

        .messages-inbox-page .chat-actions {
          gap: 16px !important;
        }

        .messages-inbox-page .chat-actions button {
          width: 52px !important;
          height: 52px !important;
          border: 1px solid rgba(68, 102, 134, 0.56) !important;
          border-radius: 14px !important;
          background: linear-gradient(180deg, rgba(18, 43, 68, 0.9), rgba(9, 28, 48, 0.92)) !important;
        }

        .messages-inbox-page .chat-actions button svg {
          width: 25px !important;
          height: 25px !important;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 148px !important;
          grid-template-columns: 170px minmax(0, 1fr) 214px !important;
          gap: 24px !important;
          margin: 0 0 28px !important;
          padding: 16px !important;
          border-radius: 14px !important;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 156px !important;
          height: 116px !important;
          border-radius: 8px !important;
        }

        .messages-inbox-page .listing-summary strong {
          font-size: 22px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .listing-summary span {
          margin-top: 16px !important;
          font-size: 36px !important;
        }

        .messages-inbox-page .listing-open {
          min-height: 70px !important;
          border-radius: 12px !important;
          font-size: 18px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .chat-window {
          padding: 0 0 14px !important;
        }

        .messages-inbox-page .chat-window .date-divider {
          margin: 10px 0 28px !important;
          font-size: 15px !important;
        }

        .messages-inbox-page .chat-window .date-divider span {
          padding: 8px 20px !important;
        }

        .messages-inbox-page .chat-window .messages {
          gap: 22px !important;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-width: 210px !important;
          max-width: min(560px, 72%) !important;
          padding: 24px 24px 18px !important;
          border-radius: 14px !important;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 19px !important;
          font-weight: 800 !important;
          line-height: 1.4 !important;
        }

        .messages-inbox-page .chat-window .message-meta {
          font-size: 17px !important;
          margin-top: 10px !important;
        }

        .messages-inbox-page .input-area form {
          min-height: 112px !important;
          grid-template-columns: 76px minmax(0, 1fr) 76px 76px !important;
          grid-template-rows: 76px !important;
          gap: 16px !important;
          padding: 18px 22px !important;
          border-radius: 14px !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(1) {
          grid-column: 1 !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(3) {
          grid-column: 3 !important;
        }

        .messages-inbox-page .input-area .tool {
          width: 58px !important;
          height: 58px !important;
          border-radius: 14px !important;
          background: rgba(17, 41, 66, 0.78) !important;
        }

        .messages-inbox-page .input-area .tool svg {
          width: 30px !important;
          height: 30px !important;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          grid-column: 2 !important;
          height: 72px !important;
          padding: 0 26px !important;
          border: 1px solid rgba(83, 118, 151, 0.7) !important;
          border-radius: 12px !important;
          font-size: 22px !important;
        }

        .messages-inbox-page .input-area .send {
          grid-column: 4 !important;
          width: 68px !important;
          height: 68px !important;
          border-radius: 14px !important;
        }

        .messages-inbox-page .input-area .send svg {
          width: 34px !important;
          height: 34px !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1220px, calc(100vw - 24px)) !important;
          height: min(760px, calc(100vh - var(--topbar-h, 0px) - 28px)) !important;
          min-height: 640px !important;
          grid-template-columns: minmax(320px, 400px) minmax(0, 1fr) !important;
          gap: 10px !important;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper {
          border-radius: 18px !important;
        }

        .messages-inbox-page .messages-sidebar {
          padding: 28px 14px 18px !important;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin-bottom: 24px !important;
          font-size: 28px !important;
        }

        .messages-inbox-page .message-tabs {
          height: 50px !important;
          margin-bottom: 26px !important;
          border-radius: 11px !important;
        }

        .messages-inbox-page .message-tabs button {
          position: relative !important;
          overflow: visible !important;
          padding: 0 14px !important;
          font-size: 14px !important;
        }

        .messages-inbox-page .message-tabs button.active {
          border-radius: 10px !important;
        }

        .messages-inbox-page .message-tabs button span {
          position: absolute !important;
          right: 12px !important;
          bottom: -12px !important;
          min-width: 28px !important;
          height: 28px !important;
          margin: 0 !important;
          border: 2px solid rgba(255, 255, 255, 0.96) !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          box-shadow: 0 10px 22px rgba(255, 112, 12, 0.34) !important;
        }

        .messages-inbox-page .message-search {
          height: 52px !important;
          margin-bottom: 22px !important;
          grid-template-columns: 34px minmax(0, 1fr) 50px !important;
        }

        .messages-inbox-page .message-search input {
          font-size: 15px !important;
        }

        .messages-inbox-page .message-search button {
          width: 50px !important;
          height: 52px !important;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 94px !important;
          grid-template-columns: 64px minmax(0, 1fr) 36px !important;
          gap: 14px !important;
          padding: 14px !important;
          margin-bottom: 12px !important;
        }

        .messages-inbox-page .sidebar-avatar {
          width: 58px !important;
          height: 58px !important;
        }

        .messages-inbox-page .sidebar-avatar span {
          width: 14px !important;
          height: 14px !important;
        }

        .messages-inbox-page .sidebar-copy {
          gap: 8px !important;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 18px !important;
        }

        .messages-inbox-page .sidebar-copy time {
          font-size: 15px !important;
        }

        .messages-inbox-page .sidebar-copy p {
          font-size: 15px !important;
        }

        .messages-inbox-page .sidebar-unread {
          min-width: 28px !important;
          height: 28px !important;
          font-size: 15px !important;
        }

        .messages-inbox-page .archive-button {
          height: 62px !important;
          border-radius: 11px !important;
          font-size: 16px !important;
        }

        .messages-inbox-page .chat-wrapper {
          padding: 18px 18px 14px !important;
        }

        .messages-inbox-page .header {
          min-height: 66px !important;
          grid-template-columns: 48px 60px minmax(0, 1fr) auto !important;
          gap: 12px !important;
          margin-bottom: 14px !important;
        }

        .messages-inbox-page .mobile-chat-back {
          width: 46px !important;
          height: 46px !important;
          border-radius: 12px !important;
        }

        .messages-inbox-page .avatar {
          width: 56px !important;
          height: 56px !important;
        }

        .messages-inbox-page .seller-info strong {
          font-size: 22px !important;
        }

        .messages-inbox-page .online-status {
          margin-top: 6px !important;
          font-size: 16px !important;
        }

        .messages-inbox-page .chat-actions {
          gap: 12px !important;
        }

        .messages-inbox-page .chat-actions button {
          width: 44px !important;
          height: 44px !important;
          border-radius: 12px !important;
        }

        .messages-inbox-page .chat-actions button svg {
          width: 21px !important;
          height: 21px !important;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 118px !important;
          grid-template-columns: 132px minmax(0, 1fr) 180px !important;
          gap: 18px !important;
          margin-bottom: 24px !important;
          padding: 14px !important;
          border-radius: 13px !important;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 122px !important;
          height: 90px !important;
        }

        .messages-inbox-page .listing-summary strong {
          font-size: 19px !important;
        }

        .messages-inbox-page .listing-summary span {
          margin-top: 12px !important;
          font-size: 30px !important;
        }

        .messages-inbox-page .listing-open {
          min-height: 58px !important;
          border-radius: 11px !important;
          font-size: 16px !important;
        }

        .messages-inbox-page .chat-window .date-divider {
          margin: 8px 0 24px !important;
          font-size: 13px !important;
        }

        .messages-inbox-page .chat-window .date-divider span {
          padding: 7px 18px !important;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-width: 170px !important;
          max-width: min(470px, 72%) !important;
          padding: 20px 20px 16px !important;
          border-radius: 13px !important;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 16px !important;
        }

        .messages-inbox-page .chat-window .message-meta {
          font-size: 14px !important;
          margin-top: 8px !important;
        }

        .messages-inbox-page .input-area form {
          min-height: 86px !important;
          grid-template-columns: 58px minmax(0, 1fr) 58px 58px !important;
          grid-template-rows: 58px !important;
          gap: 12px !important;
          padding: 14px 16px !important;
          border-radius: 13px !important;
        }

        .messages-inbox-page .input-area .tool {
          width: 48px !important;
          height: 48px !important;
          border-radius: 12px !important;
        }

        .messages-inbox-page .input-area .tool svg {
          width: 25px !important;
          height: 25px !important;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          height: 56px !important;
          padding: 0 22px !important;
          border-radius: 11px !important;
          font-size: 19px !important;
        }

        .messages-inbox-page .input-area .send {
          width: 56px !important;
          height: 56px !important;
          border-radius: 12px !important;
        }

        .messages-inbox-page .input-area .send svg {
          width: 29px !important;
          height: 29px !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1060px, calc(100vw - 28px)) !important;
          height: min(650px, calc(100vh - var(--topbar-h, 0px) - 32px)) !important;
          min-height: 560px !important;
          grid-template-columns: minmax(300px, 360px) minmax(0, 1fr) !important;
          gap: 10px !important;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper {
          border-radius: 16px !important;
        }

        .messages-inbox-page .messages-sidebar {
          padding: 24px 13px 16px !important;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin-bottom: 22px !important;
          font-size: 25px !important;
        }

        .messages-inbox-page .message-tabs {
          height: 46px !important;
          margin-bottom: 22px !important;
        }

        .messages-inbox-page .message-tabs button {
          padding: 0 12px !important;
          font-size: 13px !important;
        }

        .messages-inbox-page .message-tabs button span {
          right: 10px !important;
          bottom: -10px !important;
          min-width: 25px !important;
          height: 25px !important;
          font-size: 13px !important;
        }

        .messages-inbox-page .message-search {
          height: 48px !important;
          margin-bottom: 20px !important;
          grid-template-columns: 31px minmax(0, 1fr) 46px !important;
        }

        .messages-inbox-page .message-search input {
          font-size: 14px !important;
        }

        .messages-inbox-page .message-search button {
          width: 46px !important;
          height: 48px !important;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 82px !important;
          grid-template-columns: 56px minmax(0, 1fr) 32px !important;
          gap: 12px !important;
          padding: 12px !important;
          margin-bottom: 10px !important;
        }

        .messages-inbox-page .sidebar-avatar {
          width: 50px !important;
          height: 50px !important;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 16px !important;
        }

        .messages-inbox-page .sidebar-copy time,
        .messages-inbox-page .sidebar-copy p {
          font-size: 13px !important;
        }

        .messages-inbox-page .archive-button {
          height: 54px !important;
          font-size: 14px !important;
        }

        .messages-inbox-page .chat-wrapper {
          padding: 16px 16px 12px !important;
        }

        .messages-inbox-page .header {
          min-height: 56px !important;
          grid-template-columns: 42px 52px minmax(0, 1fr) auto !important;
          gap: 10px !important;
          margin-bottom: 12px !important;
        }

        .messages-inbox-page .mobile-chat-back {
          width: 40px !important;
          height: 40px !important;
        }

        .messages-inbox-page .avatar {
          width: 48px !important;
          height: 48px !important;
        }

        .messages-inbox-page .seller-info strong {
          font-size: 19px !important;
        }

        .messages-inbox-page .online-status {
          font-size: 14px !important;
        }

        .messages-inbox-page .chat-actions button {
          width: 38px !important;
          height: 38px !important;
        }

        .messages-inbox-page .chat-actions button svg {
          width: 19px !important;
          height: 19px !important;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 98px !important;
          grid-template-columns: 104px minmax(0, 1fr) 158px !important;
          gap: 14px !important;
          margin-bottom: 18px !important;
          padding: 12px !important;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 96px !important;
          height: 72px !important;
        }

        .messages-inbox-page .listing-summary strong {
          font-size: 17px !important;
        }

        .messages-inbox-page .listing-summary span {
          margin-top: 8px !important;
          font-size: 26px !important;
        }

        .messages-inbox-page .listing-open {
          min-height: 50px !important;
          font-size: 14px !important;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-width: 150px !important;
          max-width: min(390px, 72%) !important;
          padding: 16px 17px 13px !important;
          border-radius: 12px !important;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 14px !important;
        }

        .messages-inbox-page .chat-window .message-meta {
          font-size: 12.5px !important;
        }

        .messages-inbox-page .input-area form {
          min-height: 72px !important;
          grid-template-columns: 48px minmax(0, 1fr) 48px 48px !important;
          grid-template-rows: 48px !important;
          gap: 10px !important;
          padding: 11px 12px !important;
        }

        .messages-inbox-page .input-area .tool {
          width: 40px !important;
          height: 40px !important;
        }

        .messages-inbox-page .input-area .tool svg {
          width: 21px !important;
          height: 21px !important;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          height: 46px !important;
          padding: 0 18px !important;
          font-size: 16px !important;
        }

        .messages-inbox-page .input-area .send {
          width: 46px !important;
          height: 46px !important;
        }

        .messages-inbox-page .input-area .send svg {
          width: 25px !important;
          height: 25px !important;
        }

        .messages-inbox-page {
          min-height: calc(100vh - var(--topbar-h, 0px)) !important;
          padding: 12px 16px 14px !important;
          overflow: hidden !important;
          background:
            radial-gradient(860px 420px at 52% 8%, rgba(20, 67, 102, 0.18), transparent 68%),
            linear-gradient(180deg, #050f1a 0%, #06121d 56%, #040b13 100%) !important;
        }

        .messages-inbox-page .messages-page-back {
          width: min(1380px, calc(100vw - 32px)) !important;
          height: 34px !important;
          margin: 0 auto 10px !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          color: #f3f8ff !important;
          font-size: 12px !important;
          font-weight: 850 !important;
          text-decoration: none !important;
        }

        .messages-inbox-page .messages-page-back svg {
          color: #ff7a12 !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1380px, calc(100vw - 32px)) !important;
          height: min(650px, calc(100vh - var(--topbar-h, 0px) - 58px)) !important;
          min-height: 560px !important;
          display: grid !important;
          grid-template-columns: 345px minmax(0, 1fr) 275px !important;
          gap: 10px !important;
          margin: 0 auto !important;
          padding: 0 !important;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper,
        .messages-inbox-page .messages-info-panel {
          min-height: 0 !important;
          height: 100% !important;
          border: 1px solid rgba(51, 82, 110, 0.54) !important;
          border-radius: 6px !important;
          background:
            radial-gradient(520px 220px at 12% 0%, rgba(20, 63, 96, 0.14), transparent 70%),
            rgba(5, 17, 29, 0.9) !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .messages-sidebar {
          padding: 18px 14px 12px !important;
        }

        .messages-inbox-page .sidebar-heading {
          display: flex !important;
          align-items: baseline !important;
          gap: 9px !important;
          margin-bottom: 16px !important;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 !important;
          font-size: 24px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .sidebar-heading::after {
          content: "Kaikki keskustelut" !important;
          color: #8ca0b4 !important;
          font-size: 11px !important;
          font-weight: 650 !important;
        }

        .messages-inbox-page .message-tabs {
          height: 34px !important;
          margin-bottom: 14px !important;
          border-radius: 5px !important;
          background: rgba(5, 18, 31, 0.78) !important;
        }

        .messages-inbox-page .message-tabs button {
          padding: 0 16px !important;
          font-size: 11px !important;
          font-weight: 850 !important;
        }

        .messages-inbox-page .message-tabs button.active {
          border: 1px solid rgba(255, 122, 18, 0.72) !important;
          border-radius: 4px !important;
          background: linear-gradient(180deg, rgba(255, 122, 18, 0.24), rgba(255, 122, 18, 0.08)) !important;
        }

        .messages-inbox-page .message-tabs button span {
          position: static !important;
          min-width: 22px !important;
          height: 22px !important;
          margin-left: 7px !important;
          border: 0 !important;
          font-size: 11px !important;
        }

        .messages-inbox-page .message-search {
          height: 40px !important;
          margin-bottom: 12px !important;
          grid-template-columns: 30px minmax(0, 1fr) 38px !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .message-search input {
          font-size: 11px !important;
        }

        .messages-inbox-page .message-search button {
          width: 38px !important;
          height: 40px !important;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 58px !important;
          grid-template-columns: 44px minmax(0, 1fr) 28px !important;
          gap: 10px !important;
          margin-bottom: 7px !important;
          padding: 9px 10px !important;
          border-radius: 5px !important;
          background: rgba(4, 15, 26, 0.58) !important;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-left-color: #ff7412 !important;
          background:
            linear-gradient(90deg, rgba(255, 116, 18, 0.18), rgba(255, 116, 18, 0.04)),
            rgba(14, 27, 40, 0.86) !important;
        }

        .messages-inbox-page .sidebar-avatar {
          width: 38px !important;
          height: 38px !important;
        }

        .messages-inbox-page .sidebar-copy {
          gap: 4px !important;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 12.5px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .sidebar-copy time,
        .messages-inbox-page .sidebar-copy p {
          font-size: 10.5px !important;
        }

        .messages-inbox-page .sidebar-unread {
          min-width: 22px !important;
          height: 22px !important;
          font-size: 11px !important;
        }

        .messages-inbox-page .archive-button {
          height: 38px !important;
          font-size: 12px !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .chat-wrapper {
          padding: 14px 14px 10px !important;
        }

        .messages-inbox-page .header {
          min-height: 52px !important;
          grid-template-columns: 44px 48px minmax(0, 1fr) auto !important;
          gap: 10px !important;
          margin-bottom: 8px !important;
        }

        .messages-inbox-page .mobile-chat-back {
          width: 34px !important;
          height: 34px !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .avatar {
          width: 44px !important;
          height: 44px !important;
        }

        .messages-inbox-page .seller-info strong {
          font-size: 17px !important;
        }

        .messages-inbox-page .online-status {
          margin-top: 5px !important;
          font-size: 11px !important;
        }

        .messages-inbox-page .chat-actions {
          gap: 7px !important;
        }

        .messages-inbox-page .chat-actions button {
          width: 32px !important;
          height: 32px !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .chat-actions button svg {
          width: 16px !important;
          height: 16px !important;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 82px !important;
          grid-template-columns: 76px minmax(0, 1fr) 130px !important;
          gap: 12px !important;
          margin-bottom: 12px !important;
          padding: 10px !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 66px !important;
          height: 54px !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .listing-summary strong {
          font-size: 12px !important;
        }

        .messages-inbox-page .listing-summary span {
          margin-top: 5px !important;
          font-size: 18px !important;
        }

        .messages-inbox-page .listing-open {
          min-height: 36px !important;
          border-radius: 5px !important;
          font-size: 11px !important;
        }

        .messages-inbox-page .chat-window .date-divider {
          margin: 2px 0 14px !important;
          font-size: 10px !important;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-width: 130px !important;
          max-width: min(360px, 74%) !important;
          padding: 12px 13px 9px !important;
          border-radius: 7px !important;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 12px !important;
        }

        .messages-inbox-page .chat-window .message-meta {
          font-size: 10.5px !important;
          margin-top: 4px !important;
        }

        .messages-inbox-page .input-area form {
          min-height: 52px !important;
          grid-template-columns: 34px minmax(0, 1fr) 34px 34px !important;
          grid-template-rows: 34px !important;
          gap: 8px !important;
          padding: 8px !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .input-area .tool {
          width: 30px !important;
          height: 30px !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .input-area .tool svg {
          width: 16px !important;
          height: 16px !important;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          height: 34px !important;
          padding: 0 12px !important;
          border-radius: 5px !important;
          font-size: 12px !important;
        }

        .messages-inbox-page .input-area .send {
          width: 34px !important;
          height: 34px !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .input-area .send svg {
          width: 18px !important;
          height: 18px !important;
        }

        .messages-inbox-page .messages-info-panel {
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
          padding: 10px !important;
          overflow-y: auto !important;
        }

        .messages-inbox-page .messages-info-card {
          display: grid !important;
          gap: 12px !important;
          padding: 14px !important;
          border: 1px solid rgba(51, 82, 110, 0.54) !important;
          border-radius: 6px !important;
          background: rgba(6, 19, 32, 0.82) !important;
        }

        .messages-inbox-page .messages-info-card h2 {
          margin: 0 !important;
          color: #f5f9ff !important;
          font-size: 14px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .messages-info-card-head {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
        }

        .messages-inbox-page .messages-info-card-head button {
          width: 24px !important;
          height: 24px !important;
          border: 0 !important;
          background: transparent !important;
          color: #cbd7e4 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .messages-info-listing,
        .messages-inbox-page .messages-info-seller {
          display: grid !important;
          grid-template-columns: 66px minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 12px !important;
        }

        .messages-inbox-page .messages-info-listing img {
          width: 66px !important;
          height: 56px !important;
          border-radius: 5px !important;
          object-fit: cover !important;
        }

        .messages-inbox-page .messages-info-listing strong,
        .messages-inbox-page .messages-info-seller strong {
          display: block !important;
          color: #f5f9ff !important;
          font-size: 13px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .messages-info-listing span {
          display: block !important;
          margin-top: 7px !important;
          color: #fff !important;
          font-size: 19px !important;
          font-weight: 950 !important;
        }

        .messages-inbox-page .messages-info-primary,
        .messages-inbox-page .messages-info-secondary {
          min-height: 36px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          border: 1px solid rgba(64, 96, 126, 0.58) !important;
          border-radius: 5px !important;
          color: #f5f9ff !important;
          font-size: 11px !important;
          font-weight: 850 !important;
          text-decoration: none !important;
          background: rgba(8, 25, 42, 0.84) !important;
        }

        .messages-inbox-page .messages-info-primary {
          border-color: rgba(255, 130, 30, 0.58) !important;
          background: linear-gradient(135deg, #ff8518, #ff6900) !important;
        }

        .messages-inbox-page .messages-info-seller {
          grid-template-columns: 50px minmax(0, 1fr) !important;
        }

        .messages-inbox-page .messages-info-seller .avatar {
          width: 46px !important;
          height: 46px !important;
        }

        .messages-inbox-page .seller-presence {
          display: block !important;
          margin-top: 3px !important;
          color: #65e69c !important;
          font-size: 10px !important;
          font-weight: 850 !important;
        }

        .messages-inbox-page .messages-info-seller small,
        .messages-inbox-page .messages-info-seller em {
          display: flex !important;
          align-items: center !important;
          gap: 5px !important;
          margin-top: 6px !important;
          color: #c0ccda !important;
          font-size: 10px !important;
          font-style: normal !important;
          font-weight: 700 !important;
        }

        .messages-inbox-page .messages-info-seller small svg {
          color: #ff991f !important;
          fill: currentColor !important;
        }

        .messages-inbox-page .safety-info-card h2 {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .messages-inbox-page .safety-info-card h2 svg {
          color: #ff7a12 !important;
        }

        .messages-inbox-page .safety-info-card p {
          margin: 0 !important;
          color: #aab9c8 !important;
          font-size: 11px !important;
          line-height: 1.55 !important;
        }

        .messages-inbox-page .safety-info-card a {
          color: #ff8a1d !important;
          font-weight: 850 !important;
        }

        .messages-inbox-page .message-tabs button.active {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
          padding: 0 10px !important;
        }

        .messages-inbox-page .message-tabs button span {
          position: static !important;
          transform: none !important;
          flex: 0 0 auto !important;
          min-width: 20px !important;
          height: 20px !important;
          margin: 0 !important;
          padding: 0 6px !important;
          border: 0 !important;
          font-size: 11px !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .input-area form {
          grid-template-columns: minmax(0, 1fr) 36px 36px 42px !important;
          grid-template-rows: 42px !important;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          grid-column: 1 !important;
          grid-row: 1 !important;
          height: 42px !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(1) {
          grid-column: 2 !important;
          grid-row: 1 !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(2) {
          display: none !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(3) {
          grid-column: 3 !important;
          grid-row: 1 !important;
          display: inline-flex !important;
        }

        .messages-inbox-page .input-area .send {
          grid-column: 4 !important;
          grid-row: 1 !important;
        }

        .messages-inbox-page .seller-presence.offline {
          color: #8ea1b4 !important;
        }

        .messages-inbox-page {
          min-height: calc(100dvh - var(--topbar-h, 0px)) !important;
          padding: 10px 18px 18px !important;
          overflow: hidden !important;
        }

        .messages-inbox-page .messages-page-back {
          height: 26px !important;
          margin: 0 auto 8px !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1380px, calc(100vw - 36px)) !important;
          height: calc(100dvh - var(--topbar-h, 0px) - 54px) !important;
          min-height: 0 !important;
          grid-template-columns: 345px minmax(560px, 1fr) 275px !important;
          gap: 10px !important;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper,
        .messages-inbox-page .messages-info-panel {
          height: 100% !important;
          min-height: 0 !important;
        }

        .messages-inbox-page .messages-sidebar {
          padding: 18px 14px 12px !important;
        }

        .messages-inbox-page .message-tabs {
          height: 38px !important;
          overflow: visible !important;
        }

        .messages-inbox-page .message-tabs button {
          overflow: visible !important;
        }

        .messages-inbox-page .message-tabs button.active {
          position: relative !important;
        }

        .messages-inbox-page .message-tabs button span {
          position: absolute !important;
          right: 8px !important;
          top: 50% !important;
          bottom: auto !important;
          transform: translateY(-50%) !important;
          min-width: 22px !important;
          height: 22px !important;
          margin: 0 !important;
          border: 0 !important;
          box-shadow: 0 8px 18px rgba(255, 112, 12, 0.28) !important;
        }

        .messages-inbox-page .chat-wrapper {
          padding: 14px !important;
        }

        .messages-inbox-page .inbox-preview-area {
          flex: 1 1 auto !important;
          min-height: 0 !important;
        }

        .messages-inbox-page .chat-window {
          height: 100% !important;
          padding-bottom: 8px !important;
        }

        .messages-inbox-page .input-area {
          flex: 0 0 auto !important;
        }

        .messages-inbox-page .input-area form {
          min-height: 58px !important;
          grid-template-columns: 40px minmax(0, 1fr) 40px 44px !important;
          grid-template-rows: 40px !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 8px !important;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          height: 40px !important;
          font-size: 13px !important;
        }

        .messages-inbox-page .input-area .tool {
          width: 36px !important;
          height: 36px !important;
        }

        .messages-inbox-page .input-area .send {
          width: 40px !important;
          height: 40px !important;
          background: linear-gradient(135deg, #2f83ff, #1f63d5) !important;
        }

        .messages-inbox-page .input-area .send svg {
          width: 22px !important;
          height: 22px !important;
        }

        @media (max-width: 1100px) {
          .messages-inbox-page .messages-desktop-shell {
            grid-template-columns: 300px minmax(0, 1fr) !important;
          }

          .messages-inbox-page .messages-info-panel {
            display: none !important;
          }
        }

        .messages-inbox-page .message-tabs button.active {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
          padding: 0 10px !important;
          position: relative !important;
        }

        .messages-inbox-page .message-tabs button span {
          position: static !important;
          inset: auto !important;
          transform: none !important;
          flex: 0 0 auto !important;
          min-width: 20px !important;
          height: 20px !important;
          margin: 0 !important;
          padding: 0 6px !important;
          border: 0 !important;
          font-size: 11px !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .input-area form {
          grid-template-columns: minmax(0, 1fr) 36px 36px 42px !important;
          grid-template-rows: 42px !important;
          min-height: 58px !important;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          grid-column: 1 !important;
          grid-row: 1 !important;
          height: 42px !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(1) {
          grid-column: 2 !important;
          grid-row: 1 !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(2) {
          display: none !important;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(3) {
          grid-column: 3 !important;
          grid-row: 1 !important;
          display: inline-flex !important;
        }

        .messages-inbox-page .input-area .send {
          grid-column: 4 !important;
          grid-row: 1 !important;
        }

        .messages-inbox-page .seller-presence.offline {
          color: #8ea1b4 !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          height: calc(100dvh - var(--topbar-h, 0px) - 28px) !important;
        }

        .messages-inbox-page .header {
          grid-template-columns: 48px minmax(0, 1fr) auto !important;
        }

        .messages-inbox-page .seller {
          display: grid !important;
          grid-template-columns: 44px minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 10px !important;
        }

        .messages-inbox-page .mobile-chat-back,
        .messages-inbox-page .messages-page-back {
          display: none !important;
        }

        .messages-inbox-page .header {
          grid-template-columns: minmax(0, 1fr) !important;
          align-items: center !important;
        }

        .messages-inbox-page .seller {
          display: grid !important;
          grid-template-columns: 46px minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 10px !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        .messages-inbox-page .seller-info {
          min-width: 0 !important;
        }

        .messages-inbox-page .seller-info strong {
          display: block !important;
          max-width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          line-height: 1.1 !important;
        }

        .messages-inbox-page .online-status,
        .messages-inbox-page .seller-presence {
          max-width: 100% !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .chat-actions,
        .messages-inbox-page .chat-action-menu-wrap {
          display: none !important;
        }

        .messages-inbox-page .header {
          background: transparent !important;
          background-image: none !important;
          border: 0 !important;
          border-bottom: 0 !important;
          box-shadow: none !important;
          margin-bottom: 10px !important;
          padding: 0 !important;
        }

        body .messages-inbox-page .chat-wrapper > header.header,
        html body .messages-inbox-page .chat-wrapper > header.header,
        main.messages-inbox-page .chat-wrapper > header.header {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          border-top: 0 !important;
          border-right: 0 !important;
          border-bottom: 0 !important;
          border-left: 0 !important;
          box-shadow: none !important;
          outline: 0 !important;
        }

        body .messages-inbox-page .chat-wrapper > header.header::before,
        body .messages-inbox-page .chat-wrapper > header.header::after,
        html body .messages-inbox-page .chat-wrapper > header.header::before,
        html body .messages-inbox-page .chat-wrapper > header.header::after {
          content: none !important;
          display: none !important;
        }

        body .messages-inbox-page .chat-wrapper > header.header .seller,
        html body .messages-inbox-page .chat-wrapper > header.header .seller {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          box-shadow: none !important;
          outline: 0 !important;
        }

        .messages-inbox-page .chat-window .messages {
          gap: 18px !important;
        }

        .messages-inbox-page .chat-window .row {
          align-items: flex-start !important;
          gap: 8px !important;
        }

        .messages-inbox-page .chat-window .message-avatar {
          align-self: flex-start !important;
          width: 26px !important;
          height: 26px !important;
          margin-top: 2px !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-width: 130px !important;
          max-width: min(440px, 78%) !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 8px !important;
          padding: 13px 15px 10px !important;
          border: 0 !important;
          border-radius: 8px !important;
        }

        .messages-inbox-page .chat-window .own {
          min-height: 60px !important;
          min-width: 210px !important;
          margin-left: auto !important;
          border-bottom-right-radius: 5px !important;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.1), transparent 35%),
            linear-gradient(180deg, #ff7f14 0%, #ff6900 100%) !important;
          box-shadow: 0 18px 38px rgba(255, 105, 0, 0.25) !important;
        }

        .messages-inbox-page .chat-window .other {
          border-bottom-left-radius: 5px !important;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 42%),
            linear-gradient(180deg, #152433 0%, #111f2e 100%) !important;
          box-shadow: 0 14px 30px rgba(0, 8, 20, 0.26) !important;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          color: inherit !important;
          font-size: 12px !important;
          font-weight: 650 !important;
          grid-column: 1 / -1 !important;
          line-height: 1.5 !important;
        }

        .messages-inbox-page .chat-window .message-meta {
          margin-top: 0 !important;
          font-size: 10.5px !important;
          font-weight: 750 !important;
          opacity: 0.82 !important;
        }

        .messages-inbox-page .chat-window .outside-time {
          align-self: flex-end !important;
          margin: 0 0 4px -2px !important;
          color: rgba(160, 176, 194, 0.72) !important;
          font-size: 10.5px !important;
          font-weight: 750 !important;
          line-height: 1 !important;
          white-space: nowrap !important;
        }

        body .messages-inbox-page.messages-page {
          min-height: calc(100dvh - var(--topbar-h, 56px)) !important;
          height: calc(100dvh - var(--topbar-h, 56px)) !important;
          padding: 18px 28px 20px !important;
          overflow: hidden !important;
          background: #10232d !important;
          color: #f4f8fc !important;
        }

        .messages-inbox-page *,
        .messages-inbox-page *::before,
        .messages-inbox-page *::after {
          box-sizing: border-box !important;
          letter-spacing: 0 !important;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1380px, calc(100vw - 56px)) !important;
          height: calc(100dvh - var(--topbar-h, 56px) - 38px) !important;
          min-height: 0 !important;
          display: grid !important;
          grid-template-columns: 345px minmax(540px, 1fr) 275px !important;
          gap: 10px !important;
          margin: 0 auto !important;
          padding: 0 !important;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper,
        .messages-inbox-page .messages-info-panel {
          min-width: 0 !important;
          min-height: 0 !important;
          height: 100% !important;
          border: 1px solid #294760 !important;
          border-radius: 6px !important;
          background: #061522 !important;
          box-shadow: none !important;
          overflow: hidden !important;
        }

        .messages-inbox-page .messages-sidebar {
          display: flex !important;
          flex-direction: column !important;
          padding: 22px 14px 14px !important;
        }

        .messages-inbox-page .sidebar-heading {
          display: flex !important;
          align-items: baseline !important;
          gap: 8px !important;
          margin: 0 0 16px !important;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 !important;
          color: #f6f9fd !important;
          font-size: 24px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .sidebar-heading::after {
          content: "Kaikki keskustelut" !important;
          color: #93a6b7 !important;
          font-size: 11px !important;
          font-weight: 800 !important;
        }

        .messages-inbox-page .message-tabs {
          flex: 0 0 auto !important;
          height: 38px !important;
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          margin: 0 0 26px !important;
          overflow: hidden !important;
          border: 1px solid #294760 !important;
          border-radius: 5px !important;
          background: #071a2b !important;
        }

        .messages-inbox-page .message-tabs button {
          min-width: 0 !important;
          height: 36px !important;
          padding: 0 8px !important;
          border: 0 !important;
          border-right: 1px solid #243d55 !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: #b5c2cf !important;
          box-shadow: none !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .message-tabs button:last-child {
          border-right: 0 !important;
        }

        .messages-inbox-page .message-tabs button.active {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
          border: 1px solid #ff7a12 !important;
          border-radius: 4px !important;
          background: #2b1d16 !important;
          color: #ff901f !important;
        }

        .messages-inbox-page .message-tabs button span,
        .messages-inbox-page .sidebar-unread {
          position: static !important;
          display: inline-grid !important;
          place-items: center !important;
          min-width: 20px !important;
          height: 20px !important;
          margin: 0 !important;
          padding: 0 6px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: #ff7412 !important;
          color: #ffffff !important;
          box-shadow: none !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
          transform: none !important;
        }

        .messages-inbox-page .message-search {
          flex: 0 0 auto !important;
          height: 40px !important;
          display: grid !important;
          grid-template-columns: 32px minmax(0, 1fr) 38px !important;
          align-items: center !important;
          gap: 0 !important;
          margin: 0 0 12px !important;
          padding: 0 0 0 10px !important;
          border: 1px solid #294760 !important;
          border-radius: 5px !important;
          background: #092034 !important;
          color: #a9b9c9 !important;
        }

        .messages-inbox-page .message-search svg {
          width: 20px !important;
          height: 20px !important;
          color: #94a9bb !important;
        }

        .messages-inbox-page .message-search input {
          min-width: 0 !important;
          height: 38px !important;
          border: 0 !important;
          background: transparent !important;
          color: #f4f8fc !important;
          outline: 0 !important;
          font-size: 11px !important;
          font-weight: 800 !important;
        }

        .messages-inbox-page .message-search input::placeholder {
          color: #8ea1b4 !important;
          opacity: 1 !important;
        }

        .messages-inbox-page .message-search button {
          width: 38px !important;
          height: 38px !important;
          border: 0 !important;
          border-left: 1px solid #294760 !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: #c6d4e2 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .sidebar-list {
          min-height: 0 !important;
          display: flex !important;
          flex: 1 1 auto !important;
          flex-direction: column !important;
          gap: 7px !important;
          overflow-y: auto !important;
          padding: 0 1px 8px !important;
        }

        .messages-inbox-page .sidebar-conversation {
          position: relative !important;
          min-height: 58px !important;
          width: 100% !important;
          display: grid !important;
          grid-template-columns: 44px minmax(0, 1fr) auto !important;
          align-items: center !important;
          gap: 10px !important;
          margin: 0 !important;
          padding: 9px 8px !important;
          border: 1px solid transparent !important;
          border-radius: 5px !important;
          background: transparent !important;
          color: inherit !important;
          box-shadow: none !important;
          text-align: left !important;
        }

        .messages-inbox-page .sidebar-conversation:hover {
          border-color: rgba(255, 122, 18, 0.42) !important;
          background: rgba(255, 122, 18, 0.06) !important;
          transform: none !important;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-color: #ff7412 !important;
          background: #2a2424 !important;
        }

        .messages-inbox-page .sidebar-avatar {
          position: relative !important;
          width: 42px !important;
          height: 42px !important;
          display: grid !important;
          place-items: center !important;
          overflow: visible !important;
          border: 2px solid #eef8ff !important;
          border-radius: 999px !important;
          background: #f8fbff !important;
          color: #0e2434 !important;
          box-shadow: 0 0 0 2px #061522 !important;
          font-size: 11px !important;
          font-weight: 950 !important;
        }

        .messages-inbox-page .sidebar-avatar img {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          border-radius: inherit !important;
          object-fit: cover !important;
        }

        .messages-inbox-page .sidebar-avatar span,
        .messages-inbox-page .avatar-presence {
          position: absolute !important;
          right: -2px !important;
          bottom: -2px !important;
          width: 14px !important;
          height: 14px !important;
          border: 2px solid #061522 !important;
          border-radius: 999px !important;
          background: #24e275 !important;
        }

        .messages-inbox-page .sidebar-copy {
          min-width: 0 !important;
          display: grid !important;
          gap: 5px !important;
        }

        .messages-inbox-page .sidebar-copy > div {
          min-width: 0 !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 10px !important;
          align-items: center !important;
        }

        .messages-inbox-page .sidebar-copy strong {
          overflow: hidden !important;
          color: #f7fbff !important;
          font-size: 12.5px !important;
          font-weight: 950 !important;
          line-height: 1.2 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .sidebar-copy time {
          color: #9bacbd !important;
          font-size: 10.5px !important;
          font-weight: 850 !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .sidebar-copy p {
          overflow: hidden !important;
          margin: 0 !important;
          color: #a8b8c8 !important;
          font-size: 10.5px !important;
          font-weight: 750 !important;
          line-height: 1.3 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .archive-button {
          flex: 0 0 auto !important;
          width: 100% !important;
          min-height: 38px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 9px !important;
          border: 1px solid #335473 !important;
          border-radius: 5px !important;
          background: #102f4b !important;
          color: #d7e4f1 !important;
          box-shadow: none !important;
          font-size: 12px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .chat-wrapper {
          display: flex !important;
          flex-direction: column !important;
          padding: 14px !important;
        }

        .messages-inbox-page .header {
          flex: 0 0 auto !important;
          min-height: 52px !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 0 10px !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .mobile-chat-back {
          display: none !important;
        }

        .messages-inbox-page .seller {
          min-width: 0 !important;
          display: grid !important;
          grid-template-columns: 46px minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 10px !important;
          width: 100% !important;
        }

        .messages-inbox-page .avatar {
          position: relative !important;
          width: 46px !important;
          height: 46px !important;
          display: grid !important;
          place-items: center !important;
          overflow: visible !important;
          border: 2px solid #effaff !important;
          border-radius: 999px !important;
          background: #f8fbff !important;
          color: #0e2434 !important;
          box-shadow: 0 0 0 2px #061522 !important;
          font-size: 12px !important;
          font-weight: 950 !important;
        }

        .messages-inbox-page .avatar img,
        .messages-inbox-page .avatar-fallback {
          width: 100% !important;
          height: 100% !important;
          display: grid !important;
          place-items: center !important;
          border-radius: inherit !important;
          object-fit: cover !important;
        }

        .messages-inbox-page .seller-info {
          min-width: 0 !important;
        }

        .messages-inbox-page .seller-info strong {
          display: block !important;
          overflow: hidden !important;
          color: #f7fbff !important;
          font-size: 17px !important;
          font-weight: 950 !important;
          line-height: 1.1 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .online-status,
        .messages-inbox-page .seller-presence {
          display: block !important;
          overflow: hidden !important;
          margin: 5px 0 0 !important;
          color: #59e896 !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          line-height: 1.15 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .online-status.offline,
        .messages-inbox-page .seller-presence.offline {
          color: #8ea1b4 !important;
        }

        .messages-inbox-page .chat-listing-strip {
          flex: 0 0 auto !important;
          min-height: 82px !important;
          display: grid !important;
          grid-template-columns: 76px minmax(0, 1fr) auto !important;
          align-items: center !important;
          gap: 12px !important;
          margin: 0 0 14px !important;
          padding: 10px !important;
          border: 1px solid #294760 !important;
          border-radius: 5px !important;
          background: #082036 !important;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 66px !important;
          height: 56px !important;
          display: block !important;
          overflow: hidden !important;
          border-radius: 5px !important;
        }

        .messages-inbox-page .listing-thumb img {
          object-fit: cover !important;
        }

        .messages-inbox-page .listing-summary {
          min-width: 0 !important;
        }

        .messages-inbox-page .listing-summary strong {
          display: block !important;
          overflow: hidden !important;
          color: #f7fbff !important;
          font-size: 12px !important;
          font-weight: 950 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .listing-summary span {
          display: block !important;
          margin-top: 8px !important;
          color: #ffffff !important;
          font-size: 18px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .listing-open {
          min-height: 36px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          padding: 0 14px !important;
          border: 1px solid #335473 !important;
          border-radius: 5px !important;
          background: #102f4b !important;
          color: #f3f8ff !important;
          text-decoration: none !important;
          white-space: nowrap !important;
          font-size: 11px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .messages-area {
          min-height: 0 !important;
          flex: 1 1 auto !important;
          overflow: hidden !important;
        }

        .messages-inbox-page .chat-window {
          height: 100% !important;
          padding: 0 16px 14px !important;
          background: transparent !important;
          overflow-y: auto !important;
        }

        .messages-inbox-page .chat-window .messages {
          min-height: 100% !important;
          gap: 18px !important;
          justify-content: flex-start !important;
          padding-top: 0 !important;
        }

        .messages-inbox-page .chat-window .date-divider {
          margin: 0 0 14px !important;
          color: #788da2 !important;
          font-size: 10px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
        }

        .messages-inbox-page .chat-window .date-divider span {
          border: 1px solid #294760 !important;
          border-radius: 999px !important;
          background: #071a2b !important;
          padding: 7px 18px !important;
        }

        .messages-inbox-page .chat-window .date-divider::before,
        .messages-inbox-page .chat-window .date-divider::after {
          background: #172d40 !important;
        }

        .messages-inbox-page .chat-window .row {
          align-items: flex-start !important;
          gap: 8px !important;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          max-width: min(440px, 78%) !important;
          min-width: 130px !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 8px !important;
          border: 0 !important;
          border-radius: 8px !important;
          padding: 13px 15px 10px !important;
        }

        .messages-inbox-page .chat-window .own {
          min-width: 210px !important;
          min-height: 63px !important;
          margin-left: auto !important;
          border-bottom-right-radius: 5px !important;
          background: linear-gradient(180deg, #ff8118 0%, #ff6900 100%) !important;
          box-shadow: 0 20px 40px rgba(255, 105, 0, 0.28) !important;
          color: #ffffff !important;
        }

        .messages-inbox-page .chat-window .other {
          border-bottom-left-radius: 5px !important;
          background: #101f2e !important;
          box-shadow: 0 14px 30px rgba(0, 8, 20, 0.24) !important;
          color: #eaf3fc !important;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          grid-column: 1 / -1 !important;
          margin: 0 !important;
          color: inherit !important;
          font-size: 12px !important;
          font-weight: 750 !important;
          line-height: 1.5 !important;
        }

        .messages-inbox-page .chat-window .message-meta,
        .messages-inbox-page .chat-window .outside-time {
          font-size: 10.5px !important;
          font-weight: 850 !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .chat-window .message-meta {
          justify-self: end !important;
          margin: 0 !important;
          color: rgba(255, 255, 255, 0.86) !important;
        }

        .messages-inbox-page .chat-window .outside-time {
          align-self: flex-end !important;
          margin: 0 0 4px -2px !important;
          color: #7f93a6 !important;
        }

        .messages-inbox-page .input-area {
          flex: 0 0 auto !important;
          padding-top: 8px !important;
        }

        .messages-inbox-page .input-area .wrapper {
          gap: 8px !important;
        }

        .messages-inbox-page .input-area form {
          min-height: 54px !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 38px 38px 42px !important;
          grid-template-rows: 42px !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 6px 8px !important;
          border: 1px solid #294760 !important;
          border-radius: 5px !important;
          background: #092034 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .input-area form > input[type="file"] {
          display: none !important;
        }

        .messages-inbox-page .input-area form > input:not([type="file"]) {
          grid-column: 1 !important;
          grid-row: 1 !important;
          width: 100% !important;
          height: 42px !important;
          min-width: 0 !important;
          padding: 0 12px !important;
          border: 1px solid #335473 !important;
          border-radius: 5px !important;
          background: #071a2b !important;
          color: #f3f8ff !important;
          box-shadow: none !important;
          font-size: 12px !important;
          font-weight: 800 !important;
        }

        .messages-inbox-page .input-area form > input:not([type="file"])::placeholder {
          color: #8ea1b4 !important;
          opacity: 1 !important;
        }

        .messages-inbox-page .input-area .tools {
          display: contents !important;
        }

        .messages-inbox-page .input-area .tool {
          width: 34px !important;
          height: 34px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 0 !important;
          border-radius: 5px !important;
          background: #102f4b !important;
          color: #aac2d7 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .input-area .tools .tool:nth-child(1) {
          grid-column: 2 !important;
          grid-row: 1 !important;
        }

        .messages-inbox-page .input-area .tools .tool:nth-child(2) {
          display: none !important;
        }

        .messages-inbox-page .input-area .tools .tool:nth-child(3) {
          grid-column: 3 !important;
          grid-row: 1 !important;
        }

        .messages-inbox-page .input-area .send {
          display: flex !important;
          grid-column: 4 !important;
          grid-row: 1 !important;
          width: 42px !important;
          height: 42px !important;
          min-width: 42px !important;
          border: 1px solid #69a2ff !important;
          border-radius: 5px !important;
          background: linear-gradient(135deg, #347fff 0%, #245fdf 100%) !important;
          color: #ffffff !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .input-area .send svg {
          width: 22px !important;
          height: 22px !important;
        }

        .messages-inbox-page .messages-info-panel {
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
          padding: 10px !important;
          overflow-y: auto !important;
        }

        .messages-inbox-page .messages-info-card {
          display: grid !important;
          gap: 12px !important;
          padding: 14px !important;
          border: 1px solid #294760 !important;
          border-radius: 6px !important;
          background: #061522 !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .messages-info-card h2 {
          margin: 0 !important;
          color: #f7fbff !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          line-height: 1.2 !important;
        }

        .messages-inbox-page .messages-info-card-head {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
        }

        .messages-inbox-page .messages-info-card-head button {
          width: 24px !important;
          height: 24px !important;
          min-height: 0 !important;
          border: 0 !important;
          border-radius: 5px !important;
          background: transparent !important;
          color: #bdcddd !important;
          box-shadow: none !important;
        }

        .messages-inbox-page .messages-info-listing,
        .messages-inbox-page .messages-info-seller {
          min-width: 0 !important;
          display: grid !important;
          grid-template-columns: 66px minmax(0, 1fr) !important;
          align-items: center !important;
          gap: 12px !important;
        }

        .messages-inbox-page .messages-info-listing img {
          width: 66px !important;
          height: 56px !important;
          display: block !important;
          border-radius: 5px !important;
          object-fit: cover !important;
        }

        .messages-inbox-page .messages-info-listing strong,
        .messages-inbox-page .messages-info-seller strong {
          display: block !important;
          overflow: hidden !important;
          color: #f7fbff !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          line-height: 1.25 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .messages-info-listing span {
          display: block !important;
          margin-top: 8px !important;
          color: #ffffff !important;
          font-size: 19px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .messages-info-primary,
        .messages-inbox-page .messages-info-secondary {
          min-height: 36px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          padding: 0 12px !important;
          border: 1px solid #335473 !important;
          border-radius: 5px !important;
          background: #092034 !important;
          color: #f3f8ff !important;
          box-shadow: none !important;
          text-decoration: none !important;
          font-size: 11px !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .messages-info-primary {
          border-color: #ff8c28 !important;
          background: linear-gradient(135deg, #ff871a 0%, #ff6900 100%) !important;
          color: #ffffff !important;
        }

        .messages-inbox-page .messages-info-seller {
          grid-template-columns: 50px minmax(0, 1fr) !important;
        }

        .messages-inbox-page .messages-info-seller .avatar {
          width: 48px !important;
          height: 48px !important;
        }

        .messages-inbox-page .messages-info-seller small,
        .messages-inbox-page .messages-info-seller em {
          display: flex !important;
          align-items: center !important;
          gap: 5px !important;
          margin-top: 6px !important;
          overflow: hidden !important;
          color: #bdc9d6 !important;
          font-size: 10px !important;
          font-style: normal !important;
          font-weight: 800 !important;
          line-height: 1.2 !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .messages-info-seller small svg,
        .messages-inbox-page .safety-info-card h2 svg {
          color: #ff8a1d !important;
          fill: currentColor !important;
        }

        .messages-inbox-page .safety-info-card h2 {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        .messages-inbox-page .safety-info-card p {
          margin: 0 !important;
          color: #aab9c8 !important;
          font-size: 11px !important;
          font-weight: 650 !important;
          line-height: 1.55 !important;
        }

        .messages-inbox-page .safety-info-card a {
          color: #ff8a1d !important;
          font-weight: 900 !important;
        }

        .messages-inbox-page .messages-login-panel,
        .messages-inbox-page .messages-empty {
          min-height: 100% !important;
          display: grid !important;
          place-content: center !important;
          justify-items: center !important;
          gap: 12px !important;
          color: #d8e6f3 !important;
          text-align: center !important;
        }

        @media (max-width: 1180px) {
          .messages-inbox-page .messages-desktop-shell {
            grid-template-columns: 320px minmax(0, 1fr) !important;
          }

          .messages-inbox-page .messages-info-panel {
            display: none !important;
          }
        }

        @media (max-width: 760px) {
          body .messages-inbox-page.messages-page {
            height: calc(100dvh - var(--topbar-h, 56px)) !important;
            padding: 10px !important;
          }

          .messages-inbox-page .messages-desktop-shell {
            width: 100% !important;
            height: calc(100dvh - var(--topbar-h, 56px) - 20px) !important;
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .messages-inbox-page .messages-sidebar,
          .messages-inbox-page .chat-wrapper {
            grid-column: 1 !important;
            grid-row: 1 !important;
          }

          .messages-inbox-page .chat-wrapper {
            display: none !important;
          }

          .messages-inbox-page.mobile-conversation-open .messages-sidebar {
            display: none !important;
          }

          .messages-inbox-page.mobile-conversation-open .chat-wrapper {
            display: flex !important;
          }

          .messages-inbox-page .messages-sidebar {
            padding: 18px 12px 12px !important;
          }

          .messages-inbox-page .message-tabs {
            margin-bottom: 14px !important;
          }

          .messages-inbox-page .header {
            gap: 10px !important;
          }

          .messages-inbox-page .mobile-chat-back {
            display: none !important;
          }

          .messages-inbox-page .chat-listing-strip {
            grid-template-columns: 58px minmax(0, 1fr) !important;
          }

          .messages-inbox-page .listing-thumb,
          .messages-inbox-page .listing-thumb img {
            width: 52px !important;
            height: 46px !important;
          }

          .messages-inbox-page .listing-open {
            grid-column: 1 / -1 !important;
            width: 100% !important;
          }

          .messages-inbox-page .chat-window {
            padding: 0 4px 12px !important;
          }

          .messages-inbox-page .chat-window .own,
          .messages-inbox-page .chat-window .other {
            max-width: 86% !important;
          }

          .messages-inbox-page .input-area form {
            grid-template-columns: minmax(0, 1fr) 34px 34px 38px !important;
            gap: 6px !important;
            padding: 6px !important;
          }

          .messages-inbox-page .input-area form > input:not([type="file"]) {
            height: 40px !important;
          }

          .messages-inbox-page .input-area .tool {
            width: 32px !important;
            height: 32px !important;
          }

          .messages-inbox-page .input-area .send {
            width: 38px !important;
            min-width: 38px !important;
            height: 40px !important;
          }

          .messages-inbox-page .input-area {
            margin: 0 -10px -10px !important;
            padding: 8px 10px calc(10px + env(safe-area-inset-bottom, 0px)) !important;
            background: #061522 !important;
            border-top: 1px solid rgba(80, 120, 155, 0.42) !important;
          }

          .messages-inbox-page .input-area form {
            width: 100% !important;
          }
        }

        .messages-inbox-page .messages-area.inbox-preview-area {
          position: relative !important;
          border-top: 1px solid rgba(35, 62, 84, 0.58) !important;
          background:
            radial-gradient(520px 260px at 72% 24%, rgba(19, 60, 88, 0.16), transparent 70%),
            #061522 !important;
        }

        .messages-inbox-page .messages-area.inbox-preview-area::before {
          content: "" !important;
          position: absolute !important;
          inset: 0 !important;
          pointer-events: none !important;
          background:
            linear-gradient(90deg, rgba(6, 21, 34, 0.9), transparent 18%, transparent 82%, rgba(6, 21, 34, 0.9)) !important;
        }

        .messages-inbox-page .chat-window {
          position: relative !important;
          z-index: 1 !important;
          padding: 22px 28px 16px !important;
        }

        .messages-inbox-page .chat-window .messages {
          gap: 20px !important;
        }

        .messages-inbox-page .chat-window .message-avatar {
          display: none !important;
        }

        .messages-inbox-page .chat-window .row {
          min-height: auto !important;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-height: 62px !important;
          border-radius: 8px !important;
          padding: 14px 16px 10px !important;
        }

        .messages-inbox-page .chat-window .own {
          width: min(520px, 74%) !important;
          min-width: min(360px, 74%) !important;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 34%),
            linear-gradient(180deg, #ff8318 0%, #ff6900 100%) !important;
          box-shadow:
            0 24px 44px rgba(255, 105, 0, 0.28),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset !important;
        }

        .messages-inbox-page .chat-window .other {
          width: fit-content !important;
          min-width: 132px !important;
          max-width: min(360px, 74%) !important;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 44%),
            #101f2e !important;
          box-shadow:
            0 16px 32px rgba(0, 8, 20, 0.28),
            0 0 0 1px rgba(255, 255, 255, 0.025) inset !important;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          align-self: start !important;
          grid-column: 1 / -1 !important;
          padding-right: 0 !important;
          font-size: 12px !important;
          font-weight: 760 !important;
          line-height: 1.45 !important;
        }

        .messages-inbox-page .chat-window .message-meta {
          grid-column: 2 !important;
          align-self: end !important;
          justify-self: end !important;
          gap: 5px !important;
          margin-top: 2px !important;
        }

        .messages-inbox-page .chat-window .read-state {
          width: 14px !important;
          min-width: 14px !important;
          height: 14px !important;
        }

        .messages-inbox-page .chat-window .read-state svg {
          width: 14px !important;
          height: 14px !important;
        }

        .messages-inbox-page .chat-window .outside-time {
          align-self: center !important;
          margin: 0 0 0 0 !important;
          color: #7f93a6 !important;
        }

        .messages-inbox-page .chat-wrapper {
          background: #061522 !important;
        }

        .messages-inbox-page .chat-listing-strip {
          margin-bottom: 0 !important;
        }

        .messages-inbox-page .input-area {
          border-top: 1px solid rgba(35, 62, 84, 0.58) !important;
          padding-top: 8px !important;
        }

        @media (max-width: 760px) {
          .messages-inbox-page .chat-window {
            padding: 18px 10px 14px !important;
          }

          .messages-inbox-page .chat-window .own {
            width: min(320px, 88%) !important;
            min-width: min(240px, 88%) !important;
          }

          .messages-inbox-page .chat-window .other {
            max-width: min(320px, 88%) !important;
          }
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          width: fit-content !important;
          min-width: 0 !important;
          max-width: min(420px, 78%) !important;
          min-height: 0 !important;
        }

        .messages-inbox-page .chat-window .own {
          margin-left: 0 !important;
        }

        .messages-inbox-page .chat-window .own-row {
          justify-content: flex-end !important;
        }

        @media (max-width: 760px) {
          .messages-inbox-page .chat-window .own,
          .messages-inbox-page .chat-window .other {
            max-width: 88% !important;
          }
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          gap: 6px !important;
          max-width: min(380px, 76%) !important;
          padding: 9px 11px 7px !important;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 11px !important;
          line-height: 1.35 !important;
        }

        .messages-inbox-page .chat-window .message-meta {
          font-size: 10px !important;
          gap: 4px !important;
          margin-top: 0 !important;
        }

        .messages-inbox-page .chat-window .read-state,
        .messages-inbox-page .chat-window .read-state svg {
          height: 13px !important;
        }

        .messages-inbox-page .chat-window .read-state {
          width: 18px !important;
          min-width: 18px !important;
          gap: 0 !important;
        }

        .messages-inbox-page .chat-window .read-state svg {
          width: 13px !important;
          min-width: 13px !important;
        }

        .messages-inbox-page .chat-window .read-check-second {
          margin-left: -5px !important;
        }

        .messages-inbox-page .chat-window .read-state {
          color: rgba(255, 255, 255, 0.86) !important;
        }

        .messages-inbox-page .chat-window .message-meta.is-read .read-state {
          color: #38a7ff !important;
        }

        .messages-inbox-page .chat-window .own {
          align-items: end !important;
          column-gap: 8px !important;
          grid-template-columns: auto auto !important;
        }

        .messages-inbox-page .chat-window .own p {
          grid-column: 1 !important;
          line-height: 1.3 !important;
        }

        .messages-inbox-page .chat-window .own .message-meta {
          grid-column: 2 !important;
          align-self: end !important;
          margin-left: 1px !important;
        }

        .messages-inbox-page .chat-window .read-state {
          width: 16px !important;
          min-width: 16px !important;
          height: 12px !important;
          gap: 1px !important;
          position: relative !important;
          transform: translateY(-1px) !important;
        }

        .messages-inbox-page .chat-window .read-tick {
          border-bottom: 1.55px solid currentColor !important;
          border-right: 1.55px solid currentColor !important;
          display: block !important;
          flex: 0 0 auto !important;
          height: 7px !important;
          position: absolute !important;
          top: 1px !important;
          transform: rotate(45deg) !important;
          width: 4.2px !important;
        }

        .messages-inbox-page .chat-window .read-tick:first-of-type {
          left: 2px !important;
        }

        .messages-inbox-page .chat-window .read-tick:nth-of-type(2) {
          left: 7px !important;
        }

        .messages-inbox-page .chat-window .read-state svg {
          width: 12px !important;
          min-width: 12px !important;
          height: 12px !important;
        }

        .messages-inbox-page .chat-window .read-check-second {
          margin-left: -4px !important;
        }

        .messages-inbox-page .chat-window .message-meta.is-read .read-state,
        .messages-inbox-page .chat-window .read-state.is-read {
          color: #009dff !important;
          filter: none !important;
        }

        .messages-inbox-page .chat-window .message-meta {
          color: rgba(232, 244, 255, 0.72) !important;
          font-size: 10.5px !important;
          font-variant-numeric: tabular-nums !important;
          font-weight: 760 !important;
          gap: 4px !important;
          min-height: 15px !important;
        }

        .messages-inbox-page .chat-window .read-state {
          color: rgba(232, 244, 255, 0.72) !important;
          height: 15px !important;
          min-width: 23px !important;
          width: 23px !important;
          transform: translateY(-1px) !important;
        }

        .messages-inbox-page .chat-window .read-tick {
          border-bottom: 2.15px solid currentColor !important;
          border-radius: 0 0 1px 0 !important;
          border-right: 2.15px solid currentColor !important;
          height: 10px !important;
          top: 0 !important;
          width: 5.5px !important;
        }

        .messages-inbox-page .chat-window .read-tick:first-of-type {
          left: 5px !important;
        }

        .messages-inbox-page .chat-window .read-tick:nth-of-type(2) {
          left: 12px !important;
        }

        .messages-inbox-page .chat-window .read-state span {
          display: none !important;
        }

        @media (max-width: 760px) {
          .messages-inbox-page .chat-window .own,
          .messages-inbox-page .chat-window .other {
            max-width: 88% !important;
            padding: 8px 10px 7px !important;
          }
        }

        .messages-inbox-page .sidebar-conversation {
          grid-template-columns: 42px minmax(0, 1fr) auto !important;
          min-height: 62px !important;
          padding: 8px 40px 8px 8px !important;
          border-radius: 7px !important;
          transition:
            background 0.14s ease,
            border-color 0.14s ease,
            box-shadow 0.14s ease !important;
        }

        .messages-inbox-page .sidebar-conversation.has-notification {
          border-color: rgba(255, 122, 18, 0.82) !important;
          background:
            linear-gradient(90deg, rgba(255, 122, 18, 0.16), rgba(255, 122, 18, 0.04)),
            rgba(14, 22, 33, 0.72) !important;
          box-shadow: inset 3px 0 0 #ff7a12 !important;
        }

        .messages-inbox-page .sidebar-conversation.has-notification:hover {
          background:
            linear-gradient(90deg, rgba(255, 122, 18, 0.22), rgba(255, 122, 18, 0.07)),
            rgba(18, 30, 43, 0.86) !important;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-color: #ff7a12 !important;
          background:
            linear-gradient(90deg, rgba(255, 122, 18, 0.17), rgba(255, 122, 18, 0.06)),
            #171c24 !important;
        }

        .messages-inbox-page .sidebar-copy {
          gap: 4px !important;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 14px !important;
          line-height: 1.05 !important;
        }

        .messages-inbox-page .sidebar-copy time {
          color: #9db2c5 !important;
          font-size: 11px !important;
          font-weight: 850 !important;
        }

        .messages-inbox-page .sidebar-copy p {
          color: #aebfce !important;
          font-size: 11.5px !important;
          line-height: 1.2 !important;
        }

        .messages-inbox-page .sidebar-unread {
          position: absolute !important;
          right: 13px !important;
          bottom: 9px !important;
          min-width: 18px !important;
          height: 18px !important;
          padding: 0 5px !important;
          background: #ff7412 !important;
          font-size: 10px !important;
        }

        .messages-inbox-page .sidebar-dismiss-notification {
          position: absolute !important;
          top: 7px !important;
          right: 8px !important;
          z-index: 2 !important;
          width: 22px !important;
          height: 22px !important;
          display: inline-grid !important;
          place-items: center !important;
          border: 1px solid rgba(255, 255, 255, 0.13) !important;
          border-radius: 999px !important;
          background: rgba(4, 14, 24, 0.78) !important;
          color: rgba(238, 247, 255, 0.84) !important;
          cursor: pointer !important;
          opacity: 0.78 !important;
          transition:
            opacity 0.14s ease,
            background 0.14s ease,
            color 0.14s ease,
            border-color 0.14s ease !important;
        }

        .messages-inbox-page .sidebar-dismiss-notification:hover,
        .messages-inbox-page .sidebar-dismiss-notification:focus-visible {
          opacity: 1 !important;
          border-color: rgba(255, 122, 18, 0.72) !important;
          background: #ff7412 !important;
          color: #ffffff !important;
          outline: 0 !important;
        }

        .messages-inbox-page .sidebar-conversation {
          cursor: pointer !important;
          padding-right: 66px !important;
        }

        .messages-inbox-page .sidebar-conversation:focus-visible {
          outline: 2px solid rgba(255, 122, 18, 0.76) !important;
          outline-offset: 2px !important;
        }

        .messages-inbox-page .sidebar-actions {
          align-items: center !important;
          display: inline-flex !important;
          gap: 8px !important;
          position: absolute !important;
          right: 7px !important;
          top: 7px !important;
          z-index: 4 !important;
        }

        .messages-inbox-page .sidebar-profile-link {
          align-items: center !important;
          appearance: none !important;
          background: rgba(4, 14, 24, 0.62) !important;
          border: 1px solid rgba(80, 120, 155, 0.34) !important;
          border-radius: 6px !important;
          color: #f5f8fb !important;
          cursor: pointer !important;
          display: inline-flex !important;
          gap: 6px !important;
          height: 30px !important;
          justify-content: center !important;
          line-height: 1 !important;
          padding: 0 10px !important;
          text-decoration: none !important;
          transition:
            background 0.14s ease,
            border-color 0.14s ease,
            color 0.14s ease,
            transform 0.14s ease !important;
          width: auto !important;
        }

        .messages-inbox-page .sidebar-profile-link svg {
          color: #ff9a24 !important;
          flex: 0 0 auto !important;
        }

        .messages-inbox-page .sidebar-profile-link span {
          display: inline !important;
          font-size: 11px !important;
          font-weight: 850 !important;
          letter-spacing: 0 !important;
          line-height: 1 !important;
        }

        .messages-inbox-page .sidebar-delete-conversation {
          align-items: center !important;
          appearance: none !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: #ff4d4d !important;
          cursor: pointer !important;
          display: inline-flex !important;
          height: 18px !important;
          justify-content: center !important;
          line-height: 1 !important;
          padding: 0 !important;
          width: 18px !important;
        }

        .messages-inbox-page .sidebar-delete-conversation svg {
          height: 12px !important;
          width: 12px !important;
        }

        .messages-inbox-page .sidebar-profile-link:hover,
        .messages-inbox-page .sidebar-profile-link:focus-visible {
          background: rgba(255, 122, 18, 0.18) !important;
          border-color: rgba(255, 122, 18, 0.72) !important;
          color: #ff9a3c !important;
          outline: 0 !important;
        }

        .messages-inbox-page .sidebar-delete-conversation:hover,
        .messages-inbox-page .sidebar-delete-conversation:focus-visible {
          background: transparent !important;
          border-color: transparent !important;
          color: #ff2f2f !important;
          outline: 0 !important;
        }

        .messages-inbox-page .sidebar-conversation .sidebar-unread {
          right: 12px !important;
          top: 38px !important;
          bottom: auto !important;
        }

        .messages-inbox-page .header-profile-link {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 999px !important;
          color: #ff9a24 !important;
          display: inline-flex !important;
          flex: 0 0 auto !important;
          gap: 6px !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          margin-left: auto !important;
          min-height: 30px !important;
          padding: 0 4px !important;
          text-decoration: none !important;
          transition:
            background 0.14s ease,
            color 0.14s ease !important;
        }

        .messages-inbox-page .header-profile-link svg {
          color: #ff9a24 !important;
          height: 15px !important;
          width: 15px !important;
        }

        .messages-inbox-page .header-profile-link:hover,
        .messages-inbox-page .header-profile-link:focus-visible {
          background: rgba(255, 122, 18, 0.13) !important;
          color: #ffffff !important;
          outline: 0 !important;
        }

        @media (max-width: 640px) {
          .messages-inbox-page .header-profile-link span {
            display: none !important;
          }

          .messages-inbox-page .header-profile-link {
            height: 32px !important;
            justify-content: center !important;
            padding: 0 !important;
            width: 32px !important;
          }
        }

        /* Image messages: show the uploaded image as the message, not as a tiny thumbnail inside an orange bubble. */
        .messages-inbox-page .chat-window .row:has(.message-image-button) {
          min-height: 0 !important;
          padding: 5px 0 !important;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button),
        .messages-inbox-page .chat-window .other:has(.message-image-button),
        .messages-inbox-page .chat-window .image-only {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 6px !important;
          max-width: min(430px, 72%) !important;
          min-width: min(220px, 54vw) !important;
          padding: 6px !important;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 48%),
            rgba(9, 24, 40, 0.9) !important;
          border: 1px solid rgba(98, 145, 187, 0.34) !important;
          border-radius: 10px !important;
          box-shadow:
            0 16px 34px rgba(0, 7, 18, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.045) !important;
          color: rgba(230, 242, 255, 0.86) !important;
          overflow: visible !important;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) {
          border-color: rgba(255, 185, 116, 0.48) !important;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.09), transparent 36%),
            linear-gradient(180deg, #ff851a 0%, #ff6900 100%) !important;
          box-shadow:
            0 18px 38px rgba(255, 105, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.14) !important;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) {
          justify-items: end !important;
          margin-left: auto !important;
        }

        .messages-inbox-page .chat-window .other:has(.message-image-button) {
          justify-items: start !important;
          margin-right: auto !important;
        }

        .messages-inbox-page .chat-window .message-image-button {
          appearance: none !important;
          background: rgba(4, 15, 28, 0.72) !important;
          border: 0 !important;
          border-radius: 8px !important;
          box-shadow: none !important;
          cursor: zoom-in !important;
          display: block !important;
          line-height: 0 !important;
          overflow: hidden !important;
          padding: 0 !important;
          width: min(320px, 58vw) !important;
        }

        .messages-inbox-page .chat-window .message-image {
          background:
            radial-gradient(180px 120px at 50% 20%, rgba(255, 122, 18, 0.1), transparent 72%),
            #071826 !important;
          border: 0 !important;
          border-radius: 8px !important;
          box-shadow: none !important;
          display: block !important;
          height: auto !important;
          max-height: 300px !important;
          max-width: none !important;
          min-height: 130px !important;
          object-fit: contain !important;
          width: 100% !important;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) p,
        .messages-inbox-page .chat-window .other:has(.message-image-button) p {
          background: rgba(3, 13, 23, 0.48) !important;
          border: 0 !important;
          border-radius: 7px !important;
          color: #eef7ff !important;
          padding: 7px 8px !important;
          width: 100% !important;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) p {
          background: transparent !important;
          color: #ffffff !important;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) .message-meta {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 999px !important;
          color: rgba(255, 244, 232, 0.94) !important;
          display: inline-flex !important;
          gap: 5px !important;
          justify-self: end !important;
          margin-top: 0 !important;
          min-height: 16px !important;
          padding: 0 !important;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) .read-state {
          height: 12px !important;
          min-width: 18px !important;
          opacity: 1 !important;
          transform: translateY(-1px) !important;
          width: 18px !important;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) .read-tick {
          border-bottom-width: 1.65px !important;
          border-right-width: 1.65px !important;
          height: 7px !important;
          width: 4px !important;
        }

        .messages-inbox-page .chat-window .read-state {
          color: rgba(255, 246, 232, 0.96) !important;
          height: 14px !important;
          min-width: 18px !important;
          opacity: 1 !important;
          position: relative !important;
          transform: translate(5px, -1px) !important;
          width: 18px !important;
        }

        .messages-inbox-page .chat-window .read-check-icon {
          display: block !important;
          height: 13px !important;
          overflow: visible !important;
          width: 17px !important;
        }

        .messages-inbox-page .chat-window .read-check-icon path {
          fill: none !important;
          stroke: currentColor !important;
          stroke-linecap: round !important;
          stroke-linejoin: round !important;
          stroke-width: 2.05 !important;
        }

        .messages-inbox-page .chat-window .message-meta.is-read .read-state,
        .messages-inbox-page .chat-window .read-state.is-read {
          color: #009dff !important;
        }

        .messages-inbox-page .chat-window .read-tick {
          border-bottom: 2px solid currentColor !important;
          border-radius: 0 0 1px 0 !important;
          border-right: 2px solid currentColor !important;
          height: 9px !important;
          position: absolute !important;
          top: 0 !important;
          transform: rotate(43deg) !important;
          transform-origin: center !important;
          width: 5px !important;
        }

        .messages-inbox-page .chat-window .read-tick:first-of-type {
          left: 2px !important;
        }

        .messages-inbox-page .chat-window .read-tick:nth-of-type(2) {
          left: 8px !important;
        }

        .messages-inbox-page .chat-window .message-image-button:hover .message-image {
          transform: none !important;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .own:has(.message-image-button),
        .messages-inbox-page .chat-window .image-only.own {
          box-shadow: none !important;
        }

        .messages-inbox-page .message-tabs {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }

        .messages-inbox-page .message-tabs button {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          min-width: 0 !important;
          white-space: nowrap !important;
        }

        .messages-inbox-page .message-tabs button span {
          flex: 0 0 auto !important;
        }

        .messages-inbox-page .chat-window .message-meta.is-read .read-state,
        .messages-inbox-page .chat-window .read-state.is-read {
          color: #00b7ff !important;
          filter: none !important;
          height: 14px !important;
          min-width: 18px !important;
          width: 18px !important;
        }

        .messages-inbox-page .chat-window .message-meta.is-read .read-tick,
        .messages-inbox-page .chat-window .read-state.is-read .read-tick {
          border-bottom-width: 2px !important;
          border-right-width: 2px !important;
          height: 9px !important;
          width: 5px !important;
        }

        @media (max-width: 640px) {
          .messages-inbox-page .chat-window .own:has(.message-image-button),
          .messages-inbox-page .chat-window .other:has(.message-image-button),
          .messages-inbox-page .chat-window .image-only {
            max-width: 84% !important;
            min-width: min(210px, 74vw) !important;
          }

          .messages-inbox-page .chat-window .message-image-button {
            width: min(280px, 76vw) !important;
          }

          .messages-inbox-page .chat-window .message-image {
            max-height: 260px !important;
            min-height: 120px !important;
          }
        }
      `}</style>

    </main>

  );

}

