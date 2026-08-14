"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PageLoadingFallback from "@/app/components/PageLoadingFallback";
import { useLanguage, type Locale } from "@/lib/i18n";

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
import { userNotificationsEnabled } from "@/lib/user-settings";
import { readCachedResource, writeCachedResource } from "@/lib/client-resource-cache";
import { listingPath, listingUrlId, pagePath, profilePath } from "@/lib/routes";
import { MESSAGES_MOBILE_BACK_EVENT } from "@/lib/messages-navigation";
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

type SellerListingGroup = {
  listingId: string;
  conversations: ConversationSummary[];
  latestConversation: ConversationSummary;
  unreadCount: number;
};

type SidebarEntry =
  | {
      kind: "listing";
      group: SellerListingGroup;
    }
  | {
      kind: "conversation";
      conversation: ConversationSummary;
    };

type MessagesUi = {
  unknownError: string;
  yesterday: string;
  defaultUser: string;
  offline: string;
  lastSeenToday: (time: string) => string;
  lastSeenYesterday: (time: string) => string;
  lastSeen: (date: string, time: string) => string;
  newMessage: string;
  image: string;
  messages: string;
  allConversations: string;
  messageFilters: string;
  all: string;
  buyers: string;
  sellers: string;
  searchPlaceholder: string;
  filters: string;
  conversationStarted: string;
  youPrefix: string;
  conversationActions: string;
  deleteConversation: string;
  noConversations: string;
  activeConversation: string;
  loginPrompt: string;
  backToConversations: string;
  online: string;
  openUserProfile: (name: string) => string;
  openProfile: string;
  profile: string;
  listing: string;
  negotiablePrice: string;
  listingRemoved: string;
  showListing: string;
  selectConversation: string;
  continueConversation: string;
  messagesWillAppear: string;
  browseListings: string;
  conversationDetails: string;
  listingDetails: string;
  closeDetails: string;
  openListing: string;
  seller: string;
  reviews: (count: number) => string;
  noReviews: string;
  joined: string;
  viewSellerProfile: string;
  safeTrading: string;
  safetyText: string;
  readMore: string;
  safetySuffix: string;
};

const messagesUi: Record<"fi" | "no", MessagesUi> = {
  fi: {
    unknownError: "Tuntematon virhe",
    yesterday: "Eilen",
    defaultUser: "Käyttäjä",
    offline: "Ei paikalla",
    lastSeenToday: (time) => `Paikalla tänään klo ${time}`,
    lastSeenYesterday: (time) => `Paikalla eilen klo ${time}`,
    lastSeen: (date, time) => `Paikalla viimeksi ${date} klo ${time}`,
    newMessage: "Uusi viesti",
    image: "Kuva",
    messages: "Viestit",
    allConversations: "Kaikki keskustelut",
    messageFilters: "Viestisuodattimet",
    all: "Kaikki",
    buyers: "Ostajat",
    sellers: "Myyjät",
    searchPlaceholder: "Hae viesteistä tai käyttäjistä...",
    filters: "Suodattimet",
    conversationStarted: "Keskustelu aloitettu",
    youPrefix: "Sinä: ",
    conversationActions: "Keskustelun toiminnot",
    deleteConversation: "Poista keskustelu",
    noConversations: "Ei keskusteluja vielä",
    activeConversation: "Aktiivinen keskustelu",
    loginPrompt: "Kirjaudu sisään nähdäksesi viestisi.",
    backToConversations: "Takaisin keskusteluihin",
    online: "Paikalla",
    openUserProfile: (name) => `Avaa käyttäjän ${name} profiili`,
    openProfile: "Avaa profiili",
    profile: "Profiili",
    listing: "Ilmoitus",
    negotiablePrice: "Hinta sovittavissa",
    listingRemoved: "Ilmoitus poistettu",
    showListing: "Näytä ilmoitus",
    selectConversation: "Valitse keskustelu",
    continueConversation: "Avaa viesti vasemmalta jatkaaksesi keskustelua.",
    messagesWillAppear: "Kun saat viestejä ilmoituksiisi, ne näkyvät täällä.",
    browseListings: "Selaa ilmoituksia",
    conversationDetails: "Keskustelun tiedot",
    listingDetails: "Ilmoituksen tiedot",
    closeDetails: "Sulje tiedot",
    openListing: "Avaa ilmoitus",
    seller: "Myyjä",
    reviews: (count) => `${count} arviota`,
    noReviews: "Ei arvioita vielä",
    joined: "Liittynyt",
    viewSellerProfile: "Näytä myyjän profiili",
    safeTrading: "Turvallista kaupankäyntiä",
    safetyText: "Älä jaa henkilötietojasi tai tee kauppoja alustan ulkopuolella.",
    readMore: "Lue lisää",
    safetySuffix: "turvallisista kaupoista."
  },
  no: {
    unknownError: "Ukjent feil",
    yesterday: "I går",
    defaultUser: "Bruker",
    offline: "Ikke pålogget",
    lastSeenToday: (time) => `Sist pålogget i dag kl. ${time}`,
    lastSeenYesterday: (time) => `Sist pålogget i går kl. ${time}`,
    lastSeen: (date, time) => `Sist pålogget ${date} kl. ${time}`,
    newMessage: "Ny melding",
    image: "Bilde",
    messages: "Meldinger",
    allConversations: "Alle samtaler",
    messageFilters: "Meldingsfiltre",
    all: "Alle",
    buyers: "Kjøpere",
    sellers: "Selgere",
    searchPlaceholder: "Søk i meldinger eller etter brukere...",
    filters: "Filtre",
    conversationStarted: "Samtale startet",
    youPrefix: "Du: ",
    conversationActions: "Samtalehandlinger",
    deleteConversation: "Slett samtalen",
    noConversations: "Ingen samtaler ennå",
    activeConversation: "Aktiv samtale",
    loginPrompt: "Logg inn for å se meldingene dine.",
    backToConversations: "Tilbake til samtalene",
    online: "Pålogget",
    openUserProfile: (name) => `Åpne profilen til ${name}`,
    openProfile: "Åpne profil",
    profile: "Profil",
    listing: "Annonse",
    negotiablePrice: "Pris etter avtale",
    listingRemoved: "Annonsen er fjernet",
    showListing: "Vis annonsen",
    selectConversation: "Velg en samtale",
    continueConversation: "Åpne en melding til venstre for å fortsette samtalen.",
    messagesWillAppear: "Når du får meldinger om annonsene dine, vises de her.",
    browseListings: "Bla gjennom annonser",
    conversationDetails: "Samtaledetaljer",
    listingDetails: "Annonsedetaljer",
    closeDetails: "Lukk detaljer",
    openListing: "Åpne annonsen",
    seller: "Selger",
    reviews: (count) => `${count} anmeldelser`,
    noReviews: "Ingen anmeldelser ennå",
    joined: "Medlem siden",
    viewSellerProfile: "Vis selgerprofil",
    safeTrading: "Trygg handel",
    safetyText: "Ikke del personopplysninger eller gjennomfør handelen utenfor plattformen.",
    readMore: "Les mer",
    safetySuffix: "om trygg handel."
  }
};

const dateLocales: Record<Locale, string> = {
  fi: "fi-FI",
  en: "en-GB",
  sv: "sv-SE",
  no: "nb-NO"
};

function getMessagesUi(locale: Locale) {
  return messagesUi[locale === "no" ? "no" : "fi"];
}

function conversationCountLabel(count: number, locale: Locale) {
  if (locale === "sv") return `${count} ${count === 1 ? "konversation" : "konversationer"}`;
  if (locale === "en") return `${count} ${count === 1 ? "conversation" : "conversations"}`;
  if (locale === "no") return `${count} ${count === 1 ? "samtale" : "samtaler"}`;
  return `${count} ${count === 1 ? "keskustelu" : "keskustelua"}`;
}

function backToListingsLabel(locale: Locale) {
  if (locale === "sv") return "Tillbaka till annonserna";
  if (locale === "en") return "Back to listings";
  if (locale === "no") return "Tilbake til annonsene";
  return "Takaisin ilmoituksiin";
}

function formatDate(value: string | undefined, locale: Locale) {

  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    dateLocales[locale],
    {
      day: "numeric",
      month: "numeric",
      year: "numeric"
    }
  ).format(date);

}

function conversationExpiryTime(value?: string | null) {
  if (!value) return null;

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function getClientErrorMessage(error: unknown, locale: Locale = "fi") {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(error ?? getMessagesUi(locale).unknownError);
}

function formatSidebarTime(value: string | undefined, locale: Locale) {

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
      dateLocales[locale],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(date);
  }

  if (dayDiff === 1) {
    return getMessagesUi(locale).yesterday;
  }

  return formatDate(value, locale);

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
  userId: string,
  locale: Locale
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

  return getMessagesUi(locale).defaultUser;

}

function getOtherProfileHref(
  conversation: ConversationSummary,
  userId: string | null,
  locale?: string | null
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

  return profilePath(otherUserId, otherName, locale);
}

function formatJoinedDate(value: string | null | undefined, locale: Locale) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    dateLocales[locale],
    {
      day: "numeric",
      month: "numeric",
      year: "numeric"
    }
  ).format(date);
}

function formatLastSeen(value: string | null | undefined, locale: Locale) {
  const copy = getMessagesUi(locale);

  if (!value) {
    return copy.offline;
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return copy.offline;
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
      dateLocales[locale],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(date);

  if (dayDiff <= 0) {
    return copy.lastSeenToday(time);
  }

  if (dayDiff === 1) {
    return copy.lastSeenYesterday(time);
  }

  return copy.lastSeen(formatDate(value, locale), time);
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
  content: string | undefined,
  locale: Locale
) {
  const copy = getMessagesUi(locale);
  playNotificationSound();
  if (!userNotificationsEnabled()) return;

  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return;
  }

  const showNotification = () => {
    new Notification(
      copy.newMessage,
      {
        body:
          content ||
          copy.image
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

function restoreStoredConversation(userId: string, conversationId: string) {
  if (!conversationId) {
    return;
  }

  const hiddenIds =
    readHiddenConversationIds(userId);
  const deletedIds =
    readDeletedConversationIds(userId);

  const nextHiddenIds =
    hiddenIds.filter((id) => id !== conversationId);
  const nextDeletedIds =
    deletedIds.filter((id) => id !== conversationId);

  if (nextHiddenIds.length !== hiddenIds.length) {
    writeStoredConversationIds(
      hiddenConversationsKey(userId),
      nextHiddenIds
    );
  }

  if (nextDeletedIds.length !== deletedIds.length) {
    writeStoredConversationIds(
      deletedConversationsKey(userId),
      nextDeletedIds
    );
  }
}

function MessagesPageContent() {
  const { t, locale } = useLanguage();
  const ui = getMessagesUi(locale);
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

  const [selectedSellerListingId, setSelectedSellerListingId] =
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
    if (!userId || conversations.length === 0) return;

    const now = Date.now();
    const nextExpiry =
      conversations.reduce<number | null>((nearest, conversation) => {
        const expiresAt = conversationExpiryTime(conversation.expires_at);
        if (expiresAt === null) return nearest;
        return nearest === null
          ? expiresAt
          : Math.min(nearest, expiresAt);
      }, null);

    if (nextExpiry === null) return;

    const refreshTimer = window.setTimeout(() => {
      void refreshConversations();
    }, Math.max(0, nextExpiry - now + 250));

    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [
    conversations,
    refreshConversations,
    userId
  ]);

  useEffect(() => {

    let stopped = false;
    let authResolved = false;

    async function loadMessagesForUser(nextUserId: string) {
      try {
        setUserId(nextUserId);

        restoreStoredConversation(
          nextUserId,
          requestedConversationId
        );

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
        const cachedHasRequestedConversation =
          !requestedConversationId ||
          cached?.some(
            (conversation) =>
              conversation.id === requestedConversationId
          );

        if (cached && cachedHasRequestedConversation && !stopped) {
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
                payload.new.content || "",
                locale
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

  }, [locale, refreshConversations, userId]);

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
          formatName(conversation, userId, locale).toLowerCase();
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
      locale,
      userId
    ]);

  const activeConversation =
    useMemo(
      () =>
        selectedConversationId
          ? visibleConversations.find(
              (conversation) =>
                conversation.id === selectedConversationId
            ) ?? null
          : null,
      [
        visibleConversations,
        selectedConversationId
      ]
    );

  const sellerListingGroups = useMemo(() => {
    const groups = new Map<string, SellerListingGroup>();

    for (const conversation of visibleConversations) {
      if (conversation.seller_id !== userId) continue;

      const listingId = conversation.listing_id;
      const existing = groups.get(listingId);
      const unreadCount = getUnreadCount(
        conversation,
        userId,
        lastReadSnapshot
      );

      if (existing) {
        existing.conversations.push(conversation);
        existing.unreadCount += unreadCount;
        continue;
      }

      groups.set(listingId, {
        listingId,
        conversations: [conversation],
        latestConversation: conversation,
        unreadCount
      });
    }

    return Array.from(groups.values());
  }, [lastReadSnapshot, userId, visibleConversations]);

  const sidebarEntries = useMemo(() => {
    const entries: SidebarEntry[] = [];
    const addedListingIds = new Set<string>();

    for (const conversation of visibleConversations) {
      if (conversation.seller_id === userId) {
        if (addedListingIds.has(conversation.listing_id)) continue;
        const group = sellerListingGroups.find(
          (item) => item.listingId === conversation.listing_id
        );
        if (group) {
          entries.push({ kind: "listing", group });
          addedListingIds.add(conversation.listing_id);
        }
        continue;
      }

      entries.push({ kind: "conversation", conversation });
    }

    return entries;
  }, [sellerListingGroups, userId, visibleConversations]);

  const selectedSellerListingGroup =
    sellerListingGroups.find(
      (group) => group.listingId === selectedSellerListingId
    ) ?? null;

  const activeConversationExpiryTime =
    conversationExpiryTime(activeConversation?.expires_at);
  const activeConversationClosed =
    activeConversationExpiryTime !== null &&
    activeConversationExpiryTime <= Date.now();
  const activeConversationRetained = Boolean(
    activeConversation?.listing_deleted_at &&
    activeConversationExpiryTime !== null &&
    activeConversationExpiryTime > Date.now()
  );
  const activeConversationExpiryLabel =
    activeConversationExpiryTime !== null
      ? new Intl.DateTimeFormat(
          locale === "sv"
            ? "sv-SE"
            : locale === "en"
              ? "en-GB"
              : locale === "no"
                ? "nb-NO"
                : "fi-FI",
          {
            dateStyle: "medium",
            timeStyle: "short"
          }
        ).format(activeConversationExpiryTime)
      : "";

  const closedConversationTitle =
    locale === "sv"
      ? "Konversationen har löpt ut"
      : locale === "en"
        ? "The conversation has expired"
        : locale === "no"
          ? "Samtalen har utløpt"
          : "Keskustelu on vanhentunut";

  const closedConversationMessage =
    locale === "sv"
      ? "Meddelandeperioden på 20 dagar har löpt ut. Konversationen tas bort automatiskt."
      : locale === "en"
        ? "The 20-day messaging period has ended. The conversation is removed automatically."
        : locale === "no"
          ? "Meldingsperioden på 20 dager er avsluttet. Samtalen fjernes automatisk."
          : "Keskustelun 20 päivän viestiaika on päättynyt. Keskustelu poistetaan automaattisesti.";

  const retainedConversationMessage =
    locale === "sv"
      ? `Du kan fortsätta skicka meddelanden till ${activeConversationExpiryLabel}. Därefter tas konversationen bort automatiskt.`
      : locale === "en"
        ? `You can continue messaging until ${activeConversationExpiryLabel}. The conversation will then be removed automatically.`
        : locale === "no"
          ? `Du kan fortsette å sende meldinger frem til ${activeConversationExpiryLabel}. Deretter fjernes samtalen automatisk.`
          : `Voit jatkaa viestittelyä ${activeConversationExpiryLabel} asti. Sen jälkeen keskustelu poistetaan automaattisesti.`;

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
      ? formatName(activeConversation, userId, locale)
      : "";
  const activeProfileHref =
    activeConversation
      ? getOtherProfileHref(activeConversation, userId, locale)
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
      const next =
        deletedConversationIds.filter(
          (conversationId) =>
            conversationId !== requestedConversationId
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

    const requestedConversation = conversations.find(
      (conversation) => conversation.id === requestedConversationId
    );

    setActiveFilter("all");
    setSelectedSellerListingId(
      requestedConversation?.seller_id === userId
        ? requestedConversation.listing_id
        : ""
    );
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

  function closeMobileConversation() {
    setMobileConversationOpen(false);

    if (requestedConversationId) {
      router.replace("/messages");
    }
  }

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
  ): Promise<string | null> {
    if (
      !activeConversation ||
      activeConversationClosed ||
      !userId ||
      !otherUserId
    ) {
      return locale === "sv"
        ? "Konversationen är inte tillgänglig för meddelanden."
        : locale === "en"
          ? "This conversation is not available for messaging."
          : locale === "no"
            ? "Denne samtalen er ikke tilgjengelig for meldinger."
            : "Tähän keskusteluun ei voi lähettää viestejä.";
    }

    const text =
      content.trim();

    if (!text && !image) {
      return null;
    }

    const { data, error } =
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

    if (error || !data) {
      return getClientErrorMessage(
        error ??
          new Error(
            locale === "sv"
              ? "Meddelandet kunde inte skickas."
              : locale === "en"
                ? "The message could not be sent."
                : locale === "no"
                  ? "Meldingen kunne ikke sendes."
                  : "Viestin lähetys epäonnistui."
          ),
        locale
      );
    }

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

    return null;
  }

  function selectMessageFilter(filter: MessageFilter) {
    setActiveFilter(filter);
    setSelectedSellerListingId("");
    setSelectedConversationId("");
    setMessages([]);
    setMobileConversationOpen(false);
  }

  function openConversation(conversation: ConversationSummary) {
    setSelectedConversationId(conversation.id);
    setMobileConversationOpen(true);

    if (!userId) return;

    const lastMessageAt = conversation.last_message?.created_at
      ? new Date(conversation.last_message.created_at).getTime() + 1
      : Date.now();
    const readAt = Math.max(Date.now(), lastMessageAt);

    void markConversationRead(conversation.id, userId, readAt);
    markConversationReadInState(
      conversation.id,
      new Date(readAt).toISOString()
    );
  }

  function openSellerListing(group: SellerListingGroup) {
    setSelectedSellerListingId(group.listingId);
    setSelectedConversationId("");
    setMessages([]);
    setMobileConversationOpen(false);

    if (requestedConversationId) {
      router.replace("/messages");
    }
  }

  useEffect(() => {
    const handleMobileHeaderBack = (event: Event) => {
      if (mobileConversationOpen) {
        event.preventDefault();
        setMobileConversationOpen(false);

        if (requestedConversationId) {
          router.replace("/messages");
        }
        return;
      }

      if (!selectedSellerListingGroup) {
        return;
      }

      event.preventDefault();
      setSelectedSellerListingId("");
      setSelectedConversationId("");
      setMessages([]);
    };

    window.addEventListener(
      MESSAGES_MOBILE_BACK_EVENT,
      handleMobileHeaderBack
    );

    return () => {
      window.removeEventListener(
        MESSAGES_MOBILE_BACK_EVENT,
        handleMobileHeaderBack
      );
    };
  }, [
    mobileConversationOpen,
    requestedConversationId,
    router,
    selectedSellerListingGroup
  ]);

  function closeSellerListing() {
    setSelectedSellerListingId("");
    setSelectedConversationId("");
    setMessages([]);
    setMobileConversationOpen(false);

    if (requestedConversationId) {
      router.replace("/messages");
    }
  }

  function renderConversationRow(conversation: ConversationSummary) {
    const name = formatName(conversation, userId, locale);
    const lastMessage = conversation.last_message;
    const unreadCount = getUnreadCount(
      conversation,
      userId,
      lastReadSnapshot
    );
    const isActive = conversation.id === activeConversation?.id;
    const otherOnline = isProfileActuallyOnline(conversation.other_profile);
    const lastText = lastMessage
      ? `${lastMessage.sender_id === userId ? ui.youPrefix : ""}${lastMessage.content || ui.image}`
      : conversation.listing?.title || ui.conversationStarted;

    return (
      <div
        role="button"
        tabIndex={0}
        className={`sidebar-conversation${isActive ? " active" : ""}${unreadCount > 0 ? " has-notification" : ""}`}
        onClick={() => openConversation(conversation)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openConversation(conversation);
          }
        }}
        key={conversation.id}
      >
        <div className="sidebar-avatar">
          {conversation.other_profile?.avatar_url ? (
            <img
              src={conversation.other_profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : getInitials(name)}
          {otherOnline && <span aria-hidden="true" />}
        </div>

        <div className="sidebar-copy">
          <div>
            <strong>{name}</strong>
            <time>
              {formatSidebarTime(
                lastMessage?.created_at ||
                  conversation.updated_at ||
                  conversation.created_at,
                locale
              )}
            </time>
          </div>
          <p>{lastText}</p>
        </div>

        {unreadCount > 0 && (
          <span className="sidebar-unread">{unreadCount}</span>
        )}

        <div className="sidebar-actions" aria-label={ui.conversationActions}>
          <button
            type="button"
            className="sidebar-delete-conversation"
            aria-label={ui.deleteConversation}
            title={ui.deleteConversation}
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
  }

  function renderSellerListingRow(group: SellerListingGroup) {
    const conversation = group.latestConversation;
    const listingTitle = conversation.listing?.title || ui.listing;

    return (
      <div
        role="button"
        tabIndex={0}
        className={`sidebar-conversation sidebar-listing-group${group.unreadCount > 0 ? " has-notification" : ""}`}
        onClick={() => openSellerListing(group)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openSellerListing(group);
          }
        }}
        key={`listing-${group.listingId}`}
      >
        <div className="sidebar-avatar sidebar-listing-avatar">
          {conversation.listing?.image_url ? (
            <img src={conversation.listing.image_url} alt="" />
          ) : (
            <MessageCircle size={20} aria-hidden="true" />
          )}
        </div>

        <div className="sidebar-copy">
          <div>
            <strong>{listingTitle}</strong>
            <time>
              {formatSidebarTime(
                conversation.last_message?.created_at ||
                  conversation.updated_at ||
                  conversation.created_at,
                locale
              )}
            </time>
          </div>
          <p className="listing-conversation-count">
            {conversationCountLabel(group.conversations.length, locale)}
          </p>
        </div>

        {group.unreadCount > 0 && (
          <span className="sidebar-unread">{group.unreadCount}</span>
        )}
      </div>
    );
  }

  return (

    <main
      className={`messages-page messages-inbox-page${mobileConversationOpen ? " mobile-conversation-open" : ""}`}
      data-no-auto-translate={locale === "no" ? "true" : undefined}
    >
      <section className="messages-desktop-shell">

        <aside className="messages-sidebar" aria-label={ui.messages}>

          <div className="sidebar-heading" data-all-conversations={ui.allConversations}>
            <h1>{ui.messages}</h1>
          </div>

          {selectedSellerListingGroup ? (
            <div className="seller-listing-drilldown-header">
              <button
                type="button"
                className="seller-listing-back"
                onClick={closeSellerListing}
                aria-label={backToListingsLabel(locale)}
                title={backToListingsLabel(locale)}
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </button>
              <div className="sidebar-listing-avatar">
                {selectedSellerListingGroup.latestConversation.listing?.image_url ? (
                  <img
                    src={selectedSellerListingGroup.latestConversation.listing.image_url}
                    alt=""
                  />
                ) : (
                  <MessageCircle size={19} aria-hidden="true" />
                )}
              </div>
              <div>
                <strong>
                  {selectedSellerListingGroup.latestConversation.listing?.title || ui.listing}
                </strong>
                <span>
                  {conversationCountLabel(
                    selectedSellerListingGroup.conversations.length,
                    locale
                  )}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="message-tabs" aria-label={ui.messageFilters}>
                <button className={activeFilter === "all" ? "active" : ""} type="button" onClick={() => selectMessageFilter("all")}>
                  {ui.all} <span>{loading ? "..." : totalVisibleCount}</span>
                </button>
                <button className={activeFilter === "buyers" ? "active" : ""} type="button" onClick={() => selectMessageFilter("buyers")}>
                  {ui.buyers}
                </button>
                <button className={activeFilter === "sellers" ? "active" : ""} type="button" onClick={() => selectMessageFilter("sellers")}>
                  {ui.sellers}
                </button>
              </div>

              <div className="message-search">
                <Search size={15} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={ui.searchPlaceholder}
                />
                <button type="button" aria-label={ui.filters}>
                  <SlidersHorizontal size={15} />
                </button>
              </div>
            </>
          )}

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

            {!loading && (
              selectedSellerListingGroup
                ? selectedSellerListingGroup.conversations.map(renderConversationRow)
                : sidebarEntries.map((entry) =>
                    entry.kind === "listing"
                      ? renderSellerListingRow(entry.group)
                      : renderConversationRow(entry.conversation)
                  )
            )}

            {!loading && userId && visibleConversations.length === 0 && (
              <div className="sidebar-empty">
                {ui.noConversations}
              </div>
            )}
          </div>

        </aside>

        <section className="chat-wrapper" aria-label={ui.activeConversation}>

          {loading ? (
            <div className="messages-empty messages-loading-panel" aria-busy="true" />
          ) : !userId ? (
            <div className="messages-login-panel">
              <LockKeyhole size={24} />
              <strong>{ui.loginPrompt}</strong>
              <Link href={pagePath("auth", locale)}>{t.login}</Link>
            </div>
          ) : activeConversation ? (
            <>
              <header className="header">
                <button
                  type="button"
                  className="mobile-chat-back"
                  aria-label={ui.backToConversations}
                  onClick={closeMobileConversation}
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
                        ? ui.online
                        : formatLastSeen(activeConversation.other_profile?.last_seen, locale)}
                    </p>
                  </div>
                </div>

                <Link
                  href={activeProfileHref}
                  className="header-profile-link"
                  aria-label={ui.openUserProfile(activeName)}
                  title={ui.openProfile}
                >
                  <UserRound size={16} aria-hidden="true" />
                  <span>{ui.profile}</span>
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
                  <strong>{activeConversation.listing?.title || ui.listing}</strong>
                  <span>
                    {activeConversation.listing
                      ? formatPrice(activeConversation.listing.price)
                      : ui.negotiablePrice}
                  </span>
                </div>

                {activeConversation.listing_deleted_at ? (
                  <span className="listing-open" aria-label={ui.listingRemoved}>
                    {ui.listingRemoved}
                  </span>
                ) : (
                  <Link
                    href={listingPath(listingUrlId(activeConversation.listing ?? { id: activeConversation.listing_id }), locale)}
                    className="listing-open"
                  >
                    {ui.showListing}
                    <ExternalLink size={14} />
                  </Link>
                )}
              </div>

              <div className="messages-area inbox-preview-area">
                <ChatWindow
                  messages={messages}
                  otherAvatarUrl={activeConversation.other_profile?.avatar_url ?? null}
                  otherName={activeName}
                  locale={locale}
                />
              </div>

              <div className="input-area inbox-open-area">
                {activeConversationClosed ? (
                  <div className="conversation-closed-notice" role="status">
                    <strong>{closedConversationTitle}</strong>
                    <span>{closedConversationMessage}</span>
                  </div>
                ) : (
                  <>
                    {activeConversationRetained && (
                      <div className="conversation-retention-notice" role="status">
                        <strong>
                          {locale === "sv"
                            ? "Annonsen har tagits bort"
                            : locale === "en"
                              ? "The listing has been removed"
                              : locale === "no"
                                ? "Annonsen er fjernet"
                                : "Ilmoitus on poistettu"}
                        </strong>
                        <span>{retainedConversationMessage}</span>
                      </div>
                    )}
                    <MessageInput
                      onSend={sendMessage}
                      locale={locale}
                    />
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="messages-empty">
              <span className="messages-empty-icon">
                <MessageCircle size={28} />
              </span>
              {visibleConversations.length > 0 ? (
                <>
                  <h2>{ui.selectConversation}</h2>
                  <p>{ui.continueConversation}</p>
                </>
              ) : (
                <>
                  <h2>{ui.noConversations}.</h2>
                  <p>{ui.messagesWillAppear}</p>
                  <Link href="/" className="messages-empty-cta">
                    <Plus size={16} />
                    {ui.browseListings}
                  </Link>
                </>
              )}
            </div>
          )}

        </section>

        {activeConversation && (
          <aside className="messages-info-panel" aria-label={ui.conversationDetails}>
            <section className="messages-info-card listing-info-card">
              <div className="messages-info-card-head">
                <h2>{ui.listingDetails}</h2>
                <button type="button" aria-label={ui.closeDetails}>
                  <X size={17} />
                </button>
              </div>

              <div className="messages-info-listing">
                <img
                  src={activeConversation.listing?.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3"}
                  alt=""
                />
                <div>
                  <strong>{activeConversation.listing?.title || ui.listing}</strong>
                  <span>
                    {activeConversation.listing
                      ? formatPrice(activeConversation.listing.price)
                      : ui.negotiablePrice}
                  </span>
                </div>
              </div>

              {activeConversation.listing_deleted_at ? (
                <span className="messages-info-primary" aria-label={ui.listingRemoved}>
                  {ui.listingRemoved}
                </span>
              ) : (
                <Link
                  href={listingPath(listingUrlId(activeConversation.listing ?? { id: activeConversation.listing_id }), locale)}
                  className="messages-info-primary"
                >
                  {ui.openListing}
                  <ExternalLink size={14} />
                </Link>
              )}

              <button
                type="button"
                className="messages-info-secondary"
                onClick={() => deleteConversationForMe(activeConversation.id)}
              >
                <Trash2 size={15} />
                {ui.deleteConversation}
              </button>
            </section>

            <section className="messages-info-card seller-info-card">
              <h2>{ui.seller}</h2>

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
                      ? ui.online
                      : formatLastSeen(activeConversation.other_profile?.last_seen, locale)}
                  </span>
                  {activeConversation.other_review_count ? (
                    <small>
                      <Star size={13} />
                      {activeConversation.other_review_average?.toFixed(1)}
                      {" "}
                      ({ui.reviews(activeConversation.other_review_count)})
                    </small>
                  ) : (
                    <small>
                      <Star size={13} />
                      {ui.noReviews}
                    </small>
                  )}
                  {activeConversation.other_profile?.created_at && (
                    <em>
                      {ui.joined} {formatJoinedDate(activeConversation.other_profile.created_at, locale)}
                    </em>
                  )}
                </div>
              </div>

              <Link href={activeProfileHref} className="messages-info-secondary">
                <UserRound size={15} />
                {ui.viewSellerProfile}
              </Link>
            </section>

            <section className="messages-info-card safety-info-card">
              <h2>
                <ShieldCheck size={17} />
                {ui.safeTrading}
              </h2>
              <p>
                {ui.safetyText}
                {" "}
                <Link href={pagePath("terms", locale)}>{ui.readMore}</Link>
                {" "}
                {ui.safetySuffix}
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
            #0b1118;
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
          color: #ffb45f;
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
          color: rgba(226, 244, 255, 0.72);
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
          color: rgba(244, 248, 252, 0.9);
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
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%);
          box-shadow: 0 14px 28px rgba(255, 122, 26, 0.22);
        }

        .messages-stat-text {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .messages-stat-label {
          color: rgba(226, 244, 255, 0.62);
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
          color: #ffb45f;
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
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%);
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
          color: rgba(226, 244, 255, 0.72);
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
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 58%, #e65300 100%);
          color: #fff;
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
          color: #ffb45f;
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
            linear-gradient(180deg, #030b15 0%, #071523 48%, #06111d 100%);
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
            linear-gradient(145deg, rgba(17, 39, 61, 0.96), rgba(8, 22, 38, 0.98));
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
          color: #4f9fe8;
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
          color: #ff8a22;
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
          padding: 18px 0 96px;
          background:
            radial-gradient(1040px 420px at 94% 0%, rgba(255, 122, 18, 0.16), transparent 64%),
            radial-gradient(840px 340px at 12% -8%, rgba(54, 143, 216, 0.14), transparent 66%),
            linear-gradient(180deg, #020912 0%, #061321 48%, #040c16 100%);
          color: #eef6ff;
        }

        .messages-shell {
          width: min(1284px, calc(100vw - 64px));
          max-width: none;
          padding: 0;
          gap: 16px;
        }

        .messages-hero {
          position: relative;
          display: grid;
          grid-template-columns: 126px minmax(0, 1fr) minmax(360px, 410px);
          align-items: center;
          min-height: 242px;
          gap: 26px;
          overflow: hidden;
          padding: 36px 72px 34px 38px;
          border: 1px solid rgba(100, 145, 190, 0.42);
          border-radius: 20px;
          background:
            radial-gradient(720px 260px at 98% 16%, rgba(255, 124, 22, 0.17), transparent 68%),
            radial-gradient(620px 260px at 2% 0%, rgba(80, 153, 218, 0.2), transparent 70%),
            linear-gradient(145deg, rgba(18, 42, 66, 0.94), rgba(7, 20, 35, 0.98));
          box-shadow:
            0 26px 72px rgba(0, 7, 20, 0.36),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .messages-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          width: auto;
          background:
            repeating-radial-gradient(ellipse at 83% 50%, rgba(86, 151, 206, 0.18) 0 1px, transparent 1px 12px),
            radial-gradient(260px 220px at 98% 12%, rgba(255, 116, 24, 0.18), transparent 68%);
          opacity: 0.5;
          pointer-events: none;
          mask-image: linear-gradient(90deg, transparent 30%, #000 72%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 30%, #000 72%, transparent 100%);
        }

        .messages-hero-icon {
          width: 106px;
          height: 106px;
          border-radius: 18px;
          border: 1px solid rgba(255, 160, 65, 0.78);
          background:
            radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.18), transparent 33%),
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
          color: #4f9fe8;
          font-size: 13px;
          font-weight: 950;
          letter-spacing: 0.16em;
        }

        .messages-hero h1 {
          margin: 10px 0 8px;
          font-size: clamp(3rem, 4.8vw, 3.9rem);
          line-height: 1;
          letter-spacing: 0;
        }

        .messages-hero-lead {
          max-width: 440px;
          color: rgba(226, 242, 255, 0.78);
          font-size: 15.5px;
          font-weight: 700;
        }

        .messages-hero-copy {
          width: min(100%, 410px);
          max-width: none;
          gap: 2px;
          padding: 0;
          border: 0;
          background: transparent;
          justify-self: end;
        }

        .messages-hero-copy span {
          min-height: 78px;
          align-items: center;
          padding: 18px 26px;
          border: 1px solid rgba(100, 145, 190, 0.36);
          border-radius: 14px;
          background: rgba(4, 16, 31, 0.68);
          color: rgba(244, 248, 252, 0.92);
          font-size: 14px;
          font-weight: 750;
        }

        .messages-hero-copy svg,
        .messages-stat-positive,
        .conversation-open {
          color: #ff8a22;
        }

        .messages-stats {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .messages-stat-card {
          position: relative;
          min-height: 128px;
          padding: 24px 58px 22px 28px;
          border-radius: 14px;
          border: 1px solid rgba(100, 145, 190, 0.38);
          background:
            radial-gradient(360px 160px at 100% 0%, rgba(255, 122, 26, 0.1), transparent 70%),
            linear-gradient(145deg, rgba(16, 38, 60, 0.92), rgba(7, 20, 35, 0.98));
          box-shadow:
            0 18px 46px rgba(0, 7, 18, 0.26),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .messages-stat-card::after {
          content: ">";
          position: absolute;
          right: 24px;
          top: 50%;
          transform: translateY(-50%) scaleY(1.55);
          color: rgba(180, 209, 235, 0.72);
          font-size: 28px;
          font-weight: 300;
          line-height: 1;
        }

        .messages-stat-icon {
          width: 64px;
          height: 64px;
          border: 1px solid rgba(255, 160, 65, 0.58);
          border-radius: 14px;
          background: linear-gradient(135deg, #ff9a24, #ff6b16 62%, #ed5f00);
          color: #fff;
          box-shadow: 0 16px 34px rgba(255, 112, 18, 0.28);
        }

        .messages-stat-label {
          color: rgba(185, 207, 228, 0.8);
          font-size: 13px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .messages-stat-text strong {
          font-size: 30px;
          color: #fff;
        }

        .conversation-list {
          gap: 6px;
        }

        .conversation-card {
          display: grid;
          grid-template-columns: 138px minmax(0, 1fr) 156px 58px;
          align-items: center;
          min-height: 156px;
          gap: 16px;
          padding: 16px 24px 14px 20px;
          border: 1px solid rgba(100, 145, 190, 0.34);
          border-radius: 14px;
          background:
            radial-gradient(520px 190px at 86% 0%, rgba(255, 122, 26, 0.08), transparent 70%),
            linear-gradient(145deg, rgba(14, 34, 56, 0.94), rgba(7, 19, 34, 0.99));
          box-shadow:
            0 18px 48px rgba(0, 7, 18, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .conversation-image {
          width: 138px;
          height: 118px;
          border-radius: 12px;
        }

        .conversation-image img {
          width: 100%;
          height: 100%;
          border-radius: 11px;
          object-fit: cover;
        }

        .conversation-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 156px;
          grid-template-rows: auto auto auto auto;
          column-gap: 18px;
          row-gap: 6px;
          padding: 0;
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
          color: rgba(178, 205, 228, 0.82);
          font-size: 16px;
          font-weight: 900;
        }

        .conversation-head time {
          position: static;
          grid-column: 2;
          grid-row: 1;
          justify-self: end;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: rgba(190, 214, 235, 0.86);
          font-size: 15px;
          font-weight: 900;
        }

        .conversation-title-row h2 {
          grid-column: 1;
          grid-row: 2;
          margin: 0;
          padding: 0;
          color: #fff;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: 0;
          line-height: 1.16;
          white-space: normal;
        }

        .conversation-title-row small {
          grid-column: 2;
          grid-row: 2;
          justify-self: end;
          align-self: start;
          min-width: 90px;
          margin: 0;
          padding: 9px 16px;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #ff9a24, #ff6b16 62%, #ed5f00);
          box-shadow: 0 12px 28px rgba(255, 112, 18, 0.28);
          color: #fff;
          font-size: 20px;
          font-weight: 950;
          line-height: 1;
          text-align: center;
        }

        .conversation-main p {
          grid-column: 1;
          grid-row: 3;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          color: rgba(178, 205, 228, 0.82);
          font-size: 15px;
          font-weight: 800;
        }

        .conversation-open {
          grid-column: 1;
          grid-row: 4;
          display: inline-flex;
          width: 224px;
          min-height: 36px;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid rgba(255, 138, 34, 0.56);
          border-radius: 999px;
          background: rgba(255, 122, 26, 0.08);
          font-size: 14px;
          font-weight: 950;
          text-transform: uppercase;
        }

        .conversation-delete {
          position: static;
          width: 58px;
          height: 58px;
          align-self: start;
          justify-self: end;
          border-radius: 14px;
          border: 1px solid rgba(100, 145, 190, 0.36);
          background: rgba(4, 16, 31, 0.72);
          color: rgba(190, 214, 235, 0.78);
        }

        @media (max-width: 900px) {
          .messages-shell {
            width: min(100% - 24px, 1284px);
          }

          .messages-hero,
          .messages-stats {
            grid-template-columns: 1fr;
          }

          .messages-hero {
            padding: 22px;
          }

          .messages-hero-copy {
            justify-self: stretch;
            width: 100%;
          }

          .conversation-card {
            grid-template-columns: 96px minmax(0, 1fr) 44px;
            min-height: 0;
            padding: 12px;
          }

          .conversation-image {
            width: 96px;
            height: 96px;
          }

          .conversation-main {
            grid-template-columns: minmax(0, 1fr) auto;
            row-gap: 5px;
          }

          .conversation-title-row h2 {
            font-size: 18px;
          }

          .conversation-title-row small {
            font-size: 15px;
            min-width: 72px;
            padding: 8px 12px;
          }

          .conversation-open {
            width: 184px;
          }

          .conversation-delete {
            width: 44px;
            height: 44px;
          }
        }

        @media (max-width: 560px) {
          .messages-page {
            padding-top: 12px;
          }

          .messages-hero {
            grid-template-columns: 1fr;
          }

          .messages-hero-icon {
            width: 82px;
            height: 82px;
          }

          .messages-hero h1 {
            font-size: 2.45rem;
          }

          .conversation-card {
            grid-template-columns: 84px minmax(0, 1fr) 40px;
            gap: 10px;
          }

          .conversation-image {
            width: 84px;
            height: 84px;
            grid-row: auto;
          }

          .conversation-main {
            display: grid;
            grid-template-columns: 1fr;
          }

          .conversation-head,
          .conversation-title-row {
            display: grid;
          }

          .conversation-head time,
          .conversation-title-row small {
            justify-self: start;
          }

          .conversation-title-row h2,
          .conversation-head time,
          .conversation-title-row small,
          .conversation-main p,
          .conversation-open {
            grid-column: 1;
            grid-row: auto;
          }

          .conversation-title-row h2 {
            font-size: 16px;
          }

          .conversation-main p {
            white-space: nowrap;
          }

          .conversation-open {
            width: 100%;
            min-height: 34px;
            font-size: 12px;
          }

          .conversation-delete {
            width: 40px;
            height: 40px;
            grid-column: auto;
            grid-row: auto;
          }
        }

        .messages-inbox-page {
          min-height: calc(100vh - 74px);
          padding: 14px 16px 18px;
          background: var(--site-bg, var(--bg, #0b1118));
          color: #eef7ff;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1420px, calc(100vw - 32px));
          min-height: min(720px, calc(100vh - 106px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr);
          gap: 14px;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper {
          border: 1px solid rgba(74, 104, 132, 0.45);
          border-radius: 8px;
          background: rgba(5, 18, 30, 0.78);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.28);
          overflow: hidden;
        }

        .messages-inbox-page .messages-sidebar {
          display: flex;
          flex-direction: column;
          min-height: 0;
          padding: 14px 10px 10px;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 0 14px;
          color: #f6fbff;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0;
        }

        .messages-inbox-page .message-tabs {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          overflow: hidden;
          border: 1px solid rgba(80, 111, 140, 0.42);
          border-radius: 6px;
          background: rgba(5, 16, 27, 0.82);
        }

        .messages-inbox-page .message-tabs button {
          height: 34px;
          border: 0;
          border-right: 1px solid rgba(80, 111, 140, 0.34);
          border-radius: 0;
          background: transparent;
          color: #a9b8c6;
          font-size: 11px;
          font-weight: 800;
          box-shadow: none;
        }

        .messages-inbox-page .message-tabs button:last-child {
          border-right: 0;
        }

        .messages-inbox-page .message-tabs .active {
          color: #ff8a1c;
          background: linear-gradient(180deg, rgba(255, 122, 26, 0.16), rgba(255, 122, 26, 0.06));
        }

        .messages-inbox-page .message-tabs span,
        .messages-inbox-page .sidebar-unread {
          display: inline-grid;
          place-items: center;
          min-width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #ff6b00;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
        }

        .messages-inbox-page .message-search {
          height: 36px;
          margin: 10px 0 8px;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) 34px;
          align-items: center;
          gap: 8px;
          padding-left: 10px;
          border: 1px solid rgba(80, 111, 140, 0.4);
          border-radius: 6px;
          background: rgba(3, 13, 23, 0.86);
          color: #7f93a6;
          font-size: 11px;
          font-weight: 700;
        }

        .messages-inbox-page .message-search span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .message-search button {
          width: 34px;
          height: 34px;
          border: 0;
          border-left: 1px solid rgba(80, 111, 140, 0.32);
          border-radius: 0;
          background: transparent;
          color: #b8c8d8;
          box-shadow: none;
        }

        .messages-inbox-page .sidebar-list {
          min-height: 0;
          overflow-y: auto;
          display: grid;
        }

        .messages-inbox-page .sidebar-conversation {
          position: relative;
          min-height: 66px;
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          padding: 8px;
          border-bottom: 1px solid rgba(80, 111, 140, 0.22);
          color: #dbe7f3;
          text-decoration: none;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-left: 2px solid #ff7a00;
          background: linear-gradient(90deg, rgba(255, 122, 26, 0.12), rgba(255, 122, 26, 0.02));
        }

        .messages-inbox-page .sidebar-avatar {
          position: relative;
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #f8fafc;
          color: #152334;
          font-size: 13px;
          font-weight: 950;
          overflow: visible;
        }

        .messages-inbox-page .sidebar-avatar img {
          width: 100%;
          height: 100%;
          border-radius: 999px;
          object-fit: cover;
        }

        .messages-inbox-page .sidebar-avatar span {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 0 2px #06111d;
        }

        .messages-inbox-page .sidebar-copy {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .messages-inbox-page .sidebar-copy div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .messages-inbox-page .sidebar-copy strong,
        .messages-inbox-page .sidebar-copy p {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .sidebar-copy strong {
          color: #f4f8fc;
          font-size: 12.5px;
          font-weight: 900;
        }

        .messages-inbox-page .sidebar-copy time {
          margin-left: auto;
          color: #8fa3b6;
          font-size: 10px;
          font-weight: 800;
        }

        .messages-inbox-page .sidebar-copy p {
          margin: 0;
          color: #90a5b8;
          font-size: 11px;
          font-weight: 700;
        }

        .messages-inbox-page .archive-button {
          height: 34px;
          margin-top: 10px;
          border: 1px solid rgba(80, 111, 140, 0.42);
          border-radius: 6px;
          background: rgba(4, 15, 26, 0.76);
          color: #b9c8d8;
          font-size: 11px;
          font-weight: 800;
          box-shadow: none;
        }

        .messages-inbox-page .chat-wrapper {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .messages-inbox-page .header {
          min-height: 54px;
          padding: 8px 12px;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 10px;
          background: rgba(5, 18, 30, 0.92);
          border-bottom: 1px solid rgba(80, 111, 140, 0.34);
        }

        .messages-inbox-page .back-button {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(80, 111, 140, 0.42);
          border-radius: 6px;
          background: rgba(4, 15, 26, 0.8);
          color: #9fb3c7;
          text-decoration: none;
        }

        .messages-inbox-page .seller {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          min-width: 0;
          text-decoration: none;
        }

        .messages-inbox-page .avatar {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          background: #f8fafc;
          display: grid;
          place-items: center;
          color: #1f2937;
          overflow: visible;
          position: relative;
        }

        .messages-inbox-page .avatar img {
          width: 100%;
          height: 100%;
          border-radius: 999px;
          object-fit: cover;
        }

        .messages-inbox-page .seller-info strong {
          color: #f4f8fc;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.1;
        }

        .messages-inbox-page .online-status {
          margin: 2px 0 0;
          color: #8fa3b6;
          font-size: 10px;
          font-weight: 800;
        }

        .messages-inbox-page .chat-listing-strip {
          display: grid;
          grid-template-columns: 78px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          min-height: 86px;
          margin: 0 12px 8px;
          padding: 10px;
          border: 1px solid rgba(80, 111, 140, 0.32);
          border-radius: 6px;
          background: rgba(6, 20, 34, 0.82);
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 72px;
          height: 58px;
          border-radius: 6px;
          object-fit: cover;
        }

        .messages-inbox-page .listing-summary {
          min-width: 0;
          display: grid;
          gap: 5px;
        }

        .messages-inbox-page .listing-summary strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #e7f1fb;
          font-size: 13px;
          font-weight: 800;
        }

        .messages-inbox-page .listing-summary span {
          color: #fff;
          font-size: 18px;
          font-weight: 950;
        }

        .messages-inbox-page .listing-open {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 34px;
          padding: 0 14px;
          border: 1px solid rgba(80, 111, 140, 0.44);
          border-radius: 6px;
          background: rgba(18, 36, 55, 0.9);
          color: #dce8f3;
          font-size: 11px;
          font-weight: 850;
          text-decoration: none;
        }

        .messages-inbox-page .inbox-preview-area {
          flex: 1;
          min-height: 260px;
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          padding: 16px 28px;
          background: rgba(6, 20, 34, 0.9);
        }

        .messages-inbox-page .preview-message {
          max-width: min(420px, 80%);
          padding: 11px 13px 8px;
          border: 1px solid rgba(126, 197, 240, 0.22);
          border-radius: 12px 12px 12px 4px;
          background: rgba(20, 43, 67, 0.92);
          color: #e8f4ff;
        }

        .messages-inbox-page .preview-message.own {
          margin-left: auto;
          border-radius: 12px 12px 4px 12px;
          background: linear-gradient(135deg, #ff8a1c 0%, #ff7418 62%, #f06608 100%);
          color: #fff;
        }

        .messages-inbox-page .preview-message p {
          margin: 0 0 6px;
          color: inherit;
          font-size: 13px;
          font-weight: 850;
        }

        .messages-inbox-page .preview-message span {
          display: block;
          text-align: right;
          color: rgba(255, 255, 255, 0.76);
          font-size: 10px;
          font-weight: 850;
        }

        .messages-inbox-page .input-area {
          padding: 12px;
          border-top: 1px solid rgba(80, 111, 140, 0.34);
          background: rgba(5, 18, 30, 0.94);
        }

        .messages-inbox-page .inbox-compose-preview {
          width: 100%;
          min-height: 42px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 34px;
          align-items: center;
          gap: 8px;
          padding: 0 4px 0 16px;
          border: 1px solid rgba(80, 120, 155, 0.52);
          border-radius: 6px;
          background: linear-gradient(180deg, rgba(24, 44, 66, 0.92), rgba(14, 31, 51, 0.96));
          color: rgba(199, 218, 236, 0.72);
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
        }

        .messages-inbox-page .inbox-compose-preview span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .inbox-compose-preview svg {
          width: 34px;
          height: 34px;
          padding: 8px;
          border-radius: 6px;
          background: linear-gradient(135deg, #ff9824 0%, #ff7a08 52%, #f06400 100%);
          color: #fff;
          box-shadow: 0 10px 20px rgba(255, 112, 10, 0.28);
        }

        .messages-inbox-page .sidebar-empty,
        .messages-inbox-page .messages-login-panel {
          padding: 22px;
          color: #9fb3c7;
          text-align: center;
          font-size: 13px;
          font-weight: 800;
        }

        .messages-inbox-page .messages-login-panel {
          height: 100%;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 12px;
        }

        .messages-inbox-page .messages-login-panel a {
          color: #ffb86c;
        }

        .messages-inbox-page .sidebar-loading .sidebar-avatar,
        .messages-inbox-page .sidebar-loading strong,
        .messages-inbox-page .sidebar-loading p {
          animation: messagePulse 1.4s ease-in-out infinite;
          background: linear-gradient(90deg, rgba(32, 56, 78, 0.8), rgba(57, 83, 106, 0.8), rgba(32, 56, 78, 0.8));
          border-radius: 999px;
          color: transparent;
        }

        .messages-inbox-page .sidebar-loading strong {
          display: block;
          height: 13px;
          width: 120px;
        }

        .messages-inbox-page .sidebar-loading p {
          height: 11px;
          width: 160px;
        }

        @media (max-width: 900px) {
          .messages-inbox-page {
            padding: 0;
          }

          .messages-inbox-page .messages-desktop-shell {
            width: 100vw;
            min-height: calc(100vh - 70px);
            grid-template-columns: 1fr;
          }

          .messages-inbox-page .messages-sidebar {
            border-radius: 0;
          }

          .messages-inbox-page .chat-wrapper {
            display: none;
          }
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1240px, calc(100vw - 20px));
          min-height: min(760px, calc(100vh - 92px));
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 12px;
          margin: 0 auto;
        }

        .messages-inbox-page .mobile-chat-back {
          display: none;
        }

        .messages-inbox-page .chat-wrapper {
          display: flex;
          min-height: min(760px, calc(100vh - 92px));
          border-radius: 6px;
          background: #06131f;
        }

        .messages-inbox-page .messages-sidebar {
          min-height: min(760px, calc(100vh - 92px));
        }

        .messages-inbox-page .sidebar-conversation {
          border: 0;
          border-bottom: 1px solid rgba(80, 111, 140, 0.22);
          text-align: left;
          cursor: pointer;
        }

        .messages-inbox-page .header {
          grid-template-columns: minmax(0, 1fr);
        }

        .messages-inbox-page .messages-area,
        .messages-inbox-page .chat-window,
        .messages-inbox-page .chat-window .messages {
          background: #061522;
        }

        .messages-inbox-page .chat-window {
          height: 100%;
          padding: 14px 10px 12px;
        }

        .messages-inbox-page .input-area {
          padding: 10px;
          background: #06131f;
        }

        .messages-inbox-page .input-area form {
          min-height: 58px;
          border-radius: 6px;
          background: #0b1d30;
        }

        @media (max-width: 900px) {
          .messages-inbox-page {
            min-height: calc(100dvh - var(--topbar-h, 62px));
            padding: 0;
            overflow: hidden;
          }

          .messages-inbox-page .messages-desktop-shell {
            width: 100%;
            min-height: calc(100dvh - var(--topbar-h, 62px));
            height: calc(100dvh - var(--topbar-h, 62px));
            display: block;
            margin: 0;
          }

          .messages-inbox-page .messages-sidebar,
          .messages-inbox-page .chat-wrapper {
            border: 0;
            border-radius: 0;
            box-shadow: none;
            min-height: 100%;
            height: 100%;
          }

          .messages-inbox-page .messages-sidebar {
            display: flex;
            padding: 14px 10px 10px;
          }

          .messages-inbox-page .chat-wrapper {
            display: none;
          }

          .messages-inbox-page.mobile-conversation-open .messages-sidebar {
            display: none;
          }

          .messages-inbox-page.mobile-conversation-open .chat-wrapper {
            display: flex;
          }

          .messages-inbox-page .header {
            grid-template-columns: 38px minmax(0, 1fr);
            min-height: 58px;
            padding: 8px 10px;
          }

          .messages-inbox-page .mobile-chat-back {
            align-items: center;
            align-self: center;
            background: rgba(4, 15, 26, 0.88);
            border: 1px solid rgba(80, 111, 140, 0.42);
            border-radius: 8px;
            color: #dbeafe;
            display: inline-flex;
            height: 36px;
            justify-content: center;
            padding: 0;
            width: 36px;
          }

          .messages-inbox-page .chat-listing-strip {
            grid-template-columns: 58px minmax(0, 1fr);
            gap: 10px;
            margin: 0 8px 8px;
            min-height: 72px;
            padding: 8px;
          }

          .messages-inbox-page .listing-thumb,
          .messages-inbox-page .listing-thumb img {
            width: 52px;
            height: 48px;
          }

          .messages-inbox-page .listing-summary span {
            font-size: 15px;
          }

          .messages-inbox-page .listing-open {
            grid-column: 1 / -1;
            min-height: 32px;
            width: 100%;
          }

          .messages-inbox-page .inbox-preview-area {
            flex: 1 1 auto;
            min-height: 0;
            overflow: hidden;
            padding: 0;
          }

          .messages-inbox-page .chat-window {
            height: 100%;
            padding: 12px 10px;
          }

          .messages-inbox-page .input-area {
            flex: 0 0 auto;
            padding: 8px;
            padding-bottom: calc(8px + env(safe-area-inset-bottom));
          }

          .messages-inbox-page .sidebar-heading h1 {
            font-size: 20px;
            margin-bottom: 12px;
          }

          .messages-inbox-page .sidebar-list {
            flex: 1 1 auto;
          }

          .messages-inbox-page .sidebar-conversation {
            min-height: 70px;
          }

          .messages-inbox-page .archive-button {
            flex: 0 0 auto;
          }
        }

        .messages-inbox-page {
          min-height: calc(100vh - var(--topbar-h, 0px));
          padding: 16px 0 26px;
          background:
            radial-gradient(780px 360px at 82% -18%, rgba(255, 126, 22, 0.09), transparent 64%),
            radial-gradient(560px 300px at 12% 8%, rgba(63, 124, 173, 0.1), transparent 70%),
            linear-gradient(180deg, #07111d 0%, #06111c 48%, #05101a 100%);
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1470px, calc(100vw - 32px));
          min-height: min(768px, calc(100vh - var(--topbar-h, 62px) - 32px));
          display: grid;
          grid-template-columns: 270px minmax(0, 1fr);
          gap: 18px;
          margin: 0 auto;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper {
          border: 1px solid rgba(54, 83, 111, 0.58);
          background: rgba(5, 18, 30, 0.82);
          box-shadow: 0 22px 70px rgba(0, 8, 20, 0.28);
          backdrop-filter: blur(12px) saturate(1.04);
        }

        .messages-inbox-page .messages-sidebar {
          min-height: inherit;
          padding: 15px 14px 14px;
          border-radius: 8px;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 0 14px;
          color: #f7fbff;
          font-size: 20px;
          line-height: 1.05;
          letter-spacing: 0;
        }

        .messages-inbox-page .message-tabs {
          height: 36px;
          margin-bottom: 10px;
          border-color: rgba(58, 89, 118, 0.72);
          border-radius: 6px;
          background: rgba(4, 15, 26, 0.56);
        }

        .messages-inbox-page .message-tabs button {
          border-radius: 0;
          color: #b9c9d8;
          font-size: 10px;
          font-weight: 850;
        }

        .messages-inbox-page .message-tabs button.active {
          color: #ff8618;
          background: linear-gradient(180deg, rgba(255, 126, 22, 0.17), rgba(255, 126, 22, 0.06));
          box-shadow: inset 0 -2px 0 #ff7a12;
        }

        .messages-inbox-page .message-tabs button span,
        .messages-inbox-page .sidebar-unread {
          background: linear-gradient(135deg, #ff9822, #ff6f0c);
          color: #ffffff;
          box-shadow: 0 8px 18px rgba(255, 112, 12, 0.25);
        }

        .messages-inbox-page .message-search {
          display: grid;
          grid-template-columns: 18px minmax(0, 1fr) 34px;
          align-items: center;
          gap: 8px;
          height: 38px;
          margin-bottom: 8px;
          border-color: rgba(56, 86, 114, 0.58);
          border-radius: 6px;
          background: rgba(3, 13, 23, 0.9);
        }

        .messages-inbox-page .message-search input {
          min-width: 0;
          width: 100%;
          height: 100%;
          border: 0;
          background: transparent;
          color: #dce9f6;
          font-size: 11px;
          font-weight: 750;
          outline: none;
        }

        .messages-inbox-page .message-search input::placeholder {
          color: #8fa4b7;
          opacity: 1;
        }

        .messages-inbox-page .sidebar-list {
          gap: 0;
          padding-right: 0;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 58px;
          grid-template-columns: 38px minmax(0, 1fr) 22px;
          gap: 8px;
          padding: 7px 6px;
          border-bottom: 1px solid rgba(49, 76, 102, 0.38);
          border-left: 2px solid transparent;
          border-radius: 6px;
          background: transparent;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-left-color: #ff7a12;
          background: linear-gradient(90deg, rgba(255, 122, 18, 0.15), rgba(255, 122, 18, 0.02));
          box-shadow: inset 0 0 0 1px rgba(255, 122, 18, 0.08);
        }

        .messages-inbox-page .sidebar-avatar {
          width: 34px;
          height: 34px;
          border: 1px solid rgba(224, 238, 250, 0.9);
          box-shadow: 0 0 0 2px rgba(5, 18, 30, 0.95);
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 12px;
        }

        .messages-inbox-page .sidebar-copy time {
          font-size: 9.5px;
        }

        .messages-inbox-page .sidebar-copy p {
          color: #8fa5b8;
          font-size: 10.5px;
        }

        .messages-inbox-page .archive-button {
          height: 30px;
          margin-top: 9px;
          border-color: rgba(56, 86, 114, 0.58);
          background: rgba(3, 13, 23, 0.7);
        }

        .messages-inbox-page .chat-wrapper {
          min-height: inherit;
          overflow: hidden;
          border-radius: 8px;
        }

        .messages-inbox-page .header {
          min-height: 52px;
          padding: 8px 14px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
          gap: 16px;
          background: linear-gradient(180deg, rgba(5, 18, 30, 0.98), rgba(4, 15, 26, 0.96));
          border-bottom: 1px solid rgba(50, 78, 105, 0.52);
          border-radius: 0;
          box-shadow: none;
        }

        .messages-inbox-page .seller {
          grid-template-columns: 38px minmax(0, 1fr);
          gap: 10px;
        }

        .messages-inbox-page .avatar {
          width: 36px;
          height: 36px;
          box-shadow: 0 0 0 2px rgba(5, 18, 30, 0.95);
        }

        .messages-inbox-page .seller-info strong {
          font-size: 13px;
          letter-spacing: 0;
        }

        .messages-inbox-page .online-status.online {
          color: #7fe7ad;
        }

        .messages-inbox-page .chat-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .messages-inbox-page .chat-action-menu-wrap {
          position: relative;
        }

        .messages-inbox-page .chat-actions button {
          width: 24px;
          height: 24px;
          display: inline-grid;
          place-items: center;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #b6c8d8;
          padding: 0;
          box-shadow: none;
        }

        .messages-inbox-page .chat-actions button:hover {
          background: rgba(126, 197, 240, 0.1);
          color: #ffffff;
        }

        .messages-inbox-page .chat-action-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          z-index: 30;
          width: 190px;
          padding: 6px;
          border: 1px solid rgba(65, 94, 121, 0.68);
          border-radius: 8px;
          background: rgba(7, 20, 34, 0.98);
          box-shadow: 0 18px 42px rgba(0, 7, 18, 0.38);
        }

        .messages-inbox-page .chat-action-menu button {
          width: 100%;
          height: 34px;
          display: flex;
          justify-content: flex-start;
          gap: 8px;
          padding: 0 9px;
          color: #dce9f6;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .messages-inbox-page .chat-action-menu button.danger {
          color: #ff8d8d;
        }

        .messages-inbox-page .conversation-details {
          min-height: inherit;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }

        .messages-inbox-page .details-card {
          display: grid;
          gap: 14px;
          padding: 16px 14px;
          border: 1px solid rgba(54, 83, 111, 0.58);
          border-radius: 7px;
          background: #071522;
          box-shadow: none;
        }

        .messages-inbox-page .details-card h2 {
          margin: 0;
          color: #f7fbff;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0;
        }

        .messages-inbox-page .details-listing,
        .messages-inbox-page .details-seller {
          display: grid;
          grid-template-columns: 76px minmax(0, 1fr);
          align-items: center;
          gap: 12px;
        }

        .messages-inbox-page .details-listing img {
          width: 76px;
          height: 64px;
          border-radius: 5px;
          object-fit: cover;
        }

        .messages-inbox-page .details-listing strong,
        .messages-inbox-page .details-seller strong {
          display: block;
          color: #f4f8fc;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.3;
        }

        .messages-inbox-page .details-listing span {
          display: block;
          margin-top: 8px;
          color: #ffffff;
          font-size: 21px;
          font-weight: 950;
        }

        .messages-inbox-page .details-seller {
          grid-template-columns: 52px minmax(0, 1fr);
          min-height: 56px;
        }

        .messages-inbox-page .details-seller .avatar {
          width: 50px;
          height: 50px;
        }

        .messages-inbox-page .details-seller span {
          color: #7fe7ad;
          font-size: 11px;
          font-weight: 800;
        }

        .messages-inbox-page .details-card dl {
          display: grid;
          gap: 8px;
          margin: 0;
        }

        .messages-inbox-page .details-card dl div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .messages-inbox-page .details-card dt,
        .messages-inbox-page .details-card dd {
          margin: 0;
          font-size: 11px;
          font-weight: 850;
        }

        .messages-inbox-page .details-card dt {
          color: #91a8bb;
        }

        .messages-inbox-page .details-card dd {
          color: #f2f7fc;
          text-align: right;
        }

        .messages-inbox-page .details-button,
        .messages-inbox-page .details-card > button {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          border: 1px solid rgba(63, 96, 126, 0.74);
          border-radius: 5px;
          background: #081a2b;
          color: #dce9f6;
          font-size: 11px;
          font-weight: 900;
          text-decoration: none;
        }

        .messages-inbox-page .details-card > button.danger {
          color: #ff8d8d;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 72px;
          margin: 0;
          padding: 10px 14px;
          grid-template-columns: 78px minmax(0, 1fr) auto;
          gap: 12px;
          border: 0;
          border-bottom: 1px solid rgba(50, 78, 105, 0.52);
          border-radius: 0;
          background: rgba(6, 20, 34, 0.78);
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 76px;
          height: 56px;
          border-radius: 6px;
        }

        .messages-inbox-page .listing-summary strong {
          font-size: 12px;
          font-weight: 780;
        }

        .messages-inbox-page .listing-summary span {
          font-size: 18px;
          font-weight: 820;
        }

        .messages-inbox-page .listing-open {
          min-height: 32px;
          padding: 0 13px;
          border-color: rgba(65, 94, 121, 0.66);
          border-radius: 5px;
          background: rgba(22, 41, 59, 0.92);
          font-size: 10.5px;
        }

        .messages-inbox-page .inbox-preview-area {
          flex: 1 1 auto;
          min-height: 0;
          padding: 0;
          background: #061522;
          overflow: hidden;
        }

        .messages-inbox-page .chat-window {
          width: 100%;
          height: 100%;
          padding: 14px 18px 12px;
          background:
            radial-gradient(640px 260px at 54% 0%, rgba(17, 54, 82, 0.22), transparent 72%),
            #061522;
        }

        .messages-inbox-page .chat-window .messages {
          width: 100%;
          max-width: none;
          margin: 0;
          gap: 18px;
        }

        .messages-inbox-page .chat-window .row {
          width: 100%;
          min-height: 48px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 0;
          background: transparent;
          box-shadow: none;
        }

        .messages-inbox-page .chat-window .own-row {
          justify-content: flex-end;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          display: grid;
          gap: 7px;
          max-width: min(440px, 78%);
          min-width: 72px;
          padding: 11px 13px 8px;
          border: 0;
          border-radius: 7px;
          overflow: hidden;
          color: #ffffff;
        }

        .messages-inbox-page .chat-window .own {
          margin-left: auto;
          border-bottom-right-radius: 4px;
          background: linear-gradient(180deg, #ff861a 0%, #ff760f 58%, #ff6a00 100%);
          box-shadow: 0 14px 30px rgba(255, 102, 0, 0.28);
        }

        .messages-inbox-page .chat-window .other {
          border-bottom-left-radius: 4px;
          background: linear-gradient(180deg, #172434 0%, #132231 100%);
          box-shadow: 0 14px 30px rgba(0, 8, 20, 0.3);
          color: #e8f4ff;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          margin: 0;
          color: inherit;
          font-size: 12.5px;
          font-weight: 650;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .messages-inbox-page .chat-window .message-meta {
          min-height: 14px;
          display: inline-flex;
          align-items: center;
          justify-self: end;
          gap: 5px;
          color: rgba(255, 255, 255, 0.84);
          font-size: 10.5px;
          font-weight: 750;
          line-height: 1;
        }

        .messages-inbox-page .chat-window .other .message-meta {
          color: rgba(210, 231, 247, 0.68);
        }

        .messages-inbox-page .chat-window .read-state {
          min-width: 15px;
          height: 14px;
          padding: 0;
          border: 0;
          background: transparent;
          color: rgba(255, 255, 255, 0.86);
        }

        .messages-inbox-page .chat-window .read-state span {
          display: none;
        }

        .messages-inbox-page .chat-window .message-avatar {
          width: 34px;
          height: 34px;
          align-self: flex-end;
          border: 1px solid rgba(226, 244, 255, 0.82);
          box-shadow:
            0 0 0 2px rgba(3, 14, 30, 0.96),
            0 12px 24px rgba(0, 8, 22, 0.32);
        }

        .messages-inbox-page .input-area {
          padding: 10px;
          border-top: 1px solid rgba(50, 78, 105, 0.52);
          background: rgba(5, 18, 30, 0.98);
        }

        .messages-inbox-page .input-area form {
          min-height: 52px;
          grid-template-columns: 26px 26px 26px minmax(0, 1fr) 42px;
          grid-template-rows: 42px;
          align-items: center;
          gap: 7px;
          padding: 5px 6px;
          border-color: rgba(50, 78, 105, 0.54);
          border-radius: 6px;
          background: rgba(7, 22, 36, 0.98);
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          grid-column: 4;
          grid-row: 1;
          height: 38px;
          padding: 0 12px;
          border-radius: 5px;
          background: #ffffff;
          color: #152334;
        }

        .messages-inbox-page .input-area input::placeholder {
          color: #6c7a89;
        }

        .messages-inbox-page .input-area .tools {
          display: contents;
        }

        .messages-inbox-page .input-area .tool {
          width: 26px;
          height: 26px;
          color: #b9c8d8;
          border-radius: 5px;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(1) {
          grid-column: 1;
          grid-row: 1;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(2) {
          grid-column: 2;
          grid-row: 1;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(3) {
          grid-column: 3;
          grid-row: 1;
        }

        .messages-inbox-page .input-area .send {
          grid-column: 5;
          grid-row: 1;
          width: 42px;
          height: 42px;
          border-radius: 7px;
          background: linear-gradient(135deg, #ff9822, #ff7613 58%, #f06400);
          box-shadow: 0 14px 30px rgba(255, 112, 12, 0.32);
        }

        @media (max-width: 900px) {
          .messages-inbox-page {
            min-height: calc(100dvh - var(--topbar-h, 62px));
            padding: 0;
          }

          .messages-inbox-page .messages-desktop-shell {
            width: 100%;
            min-height: calc(100dvh - var(--topbar-h, 62px));
            height: calc(100dvh - var(--topbar-h, 62px));
            display: block;
          }

          .messages-inbox-page .conversation-details {
            display: none;
          }

          .messages-inbox-page .messages-sidebar,
          .messages-inbox-page .chat-wrapper {
            height: 100%;
            min-height: 100%;
            border-radius: 0;
            border-left: 0;
            border-right: 0;
          }

          .messages-inbox-page .messages-sidebar {
            padding: 14px 10px 10px;
          }

          .messages-inbox-page .header {
            grid-template-columns: 38px minmax(0, 1fr) auto;
            min-height: 58px;
            gap: 10px;
            padding: 8px 10px;
          }

          .messages-inbox-page .mobile-chat-back {
            display: inline-flex;
          }

          .messages-inbox-page .chat-actions {
            gap: 6px;
          }

          .messages-inbox-page .chat-actions button {
            width: 22px;
            height: 22px;
          }

          .messages-inbox-page .chat-listing-strip {
            grid-template-columns: 58px minmax(0, 1fr);
            padding: 8px;
          }

          .messages-inbox-page .listing-open {
            grid-column: 1 / -1;
          }

          .messages-inbox-page .input-area form {
            grid-template-columns: 24px 24px 24px minmax(0, 1fr) 38px;
            grid-template-rows: 38px;
          }

          .messages-inbox-page .input-area input[type="text"],
          .messages-inbox-page .input-area input:not([type]) {
            height: 34px;
          }

          .messages-inbox-page .input-area .send {
            width: 38px;
            height: 38px;
          }
        }

        @media (max-width: 420px) {
          .messages-inbox-page .message-tabs button {
            font-size: 10px;
          }

          .messages-inbox-page .sidebar-conversation {
            grid-template-columns: 40px minmax(0, 1fr) auto;
            gap: 8px;
            padding: 8px 6px;
          }

          .messages-inbox-page .sidebar-avatar,
          .messages-inbox-page .avatar {
            width: 34px;
            height: 34px;
          }
        }

        .messages-inbox-page {
          min-height: calc(100vh - var(--topbar-h, 0px));
          padding: 0;
          overflow: hidden;
          background: var(--site-bg, var(--bg, #0b1118));
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(760px, 100vw);
          height: calc(100vh - var(--topbar-h, 0px));
          min-height: 600px;
          display: grid;
          grid-template-columns: 260px minmax(0, 1fr);
          gap: 20px;
          margin: 0;
          padding: 16px 8px 8px 16px;
        }

        .messages-inbox-page .messages-sidebar {
          height: 100%;
          min-height: 0;
          padding: 5px 0 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 0 15px 2px;
          color: #f5f9ff;
          font-size: 18px;
          font-weight: 950;
        }

        .messages-inbox-page .message-tabs {
          height: 32px;
          margin-bottom: 10px;
          overflow: hidden;
          border: 1px solid rgba(57, 90, 119, 0.62);
          border-radius: 5px;
          background: rgba(4, 15, 26, 0.7);
        }

        .messages-inbox-page .message-tabs button {
          min-width: 0;
          padding: 0 8px;
          border: 0;
          border-right: 1px solid rgba(57, 90, 119, 0.34);
          border-radius: 0;
          color: #c1cedc;
          font-size: 10px;
          font-weight: 850;
          box-shadow: none;
        }

        .messages-inbox-page .message-tabs button:last-child {
          border-right: 0;
        }

        .messages-inbox-page .message-tabs button.active {
          color: #ff8518;
          background: linear-gradient(180deg, rgba(255, 119, 15, 0.18), rgba(255, 119, 15, 0.05));
          box-shadow: inset 0 -2px 0 #ff7a12;
        }

        .messages-inbox-page .message-tabs button span,
        .messages-inbox-page .sidebar-unread {
          min-width: 17px;
          height: 17px;
          padding: 0 5px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #ff7412;
          color: #fff;
          font-size: 10px;
          line-height: 1;
        }

        .messages-inbox-page .message-search {
          height: 34px;
          margin-bottom: 9px;
          padding: 0 0 0 10px;
          border: 1px solid rgba(57, 90, 119, 0.58);
          border-radius: 5px;
          background: rgba(4, 15, 26, 0.76);
        }

        .messages-inbox-page .message-search input {
          font-size: 10.5px;
          font-weight: 750;
        }

        .messages-inbox-page .message-search button {
          width: 34px;
          height: 34px;
          border-left: 1px solid rgba(57, 90, 119, 0.44);
        }

        .messages-inbox-page .sidebar-list {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          display: block;
        }

        .messages-inbox-page .sidebar-conversation {
          width: 100%;
          min-height: 54px;
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr) 20px;
          align-items: center;
          gap: 9px;
          padding: 7px 7px;
          border: 0;
          border-bottom: 1px solid rgba(51, 78, 103, 0.34);
          border-left: 2px solid transparent;
          border-radius: 0;
          background: transparent;
          text-align: left;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-left-color: #ff7412;
          background: linear-gradient(90deg, rgba(255, 116, 18, 0.18), rgba(255, 116, 18, 0.02));
        }

        .messages-inbox-page .sidebar-avatar {
          width: 34px;
          height: 34px;
          border: 1px solid rgba(234, 246, 255, 0.9);
          box-shadow: none;
        }

        .messages-inbox-page .sidebar-copy {
          gap: 3px;
        }

        .messages-inbox-page .sidebar-copy strong {
          color: #f5f9ff;
          font-size: 12px;
          font-weight: 850;
        }

        .messages-inbox-page .sidebar-copy time {
          color: #97a8b8;
          font-size: 9.5px;
          font-weight: 750;
        }

        .messages-inbox-page .sidebar-copy p {
          color: #9aaaba;
          font-size: 10.5px;
          font-weight: 650;
        }

        .messages-inbox-page .archive-button {
          height: 28px;
          margin: 7px 0 0;
          border: 1px solid rgba(57, 90, 119, 0.58);
          border-radius: 5px;
          background: rgba(4, 15, 26, 0.74);
          color: #c9d5e1;
          font-size: 10.5px;
          font-weight: 800;
        }

        .messages-inbox-page .chat-wrapper {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 0;
          border-left: 1px solid rgba(42, 68, 94, 0.42);
          border-radius: 0;
          background:
            radial-gradient(520px 260px at 58% 8%, rgba(12, 55, 88, 0.22), transparent 68%),
            linear-gradient(180deg, rgba(5, 17, 29, 0.84), rgba(5, 16, 27, 0.88));
          box-shadow: none;
          backdrop-filter: none;
        }

        .messages-inbox-page .header {
          min-height: 42px;
          padding: 0 0 10px;
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          border: 0;
          background: transparent;
          box-shadow: none;
        }

        .messages-inbox-page .mobile-chat-back {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(57, 90, 119, 0.58);
          border-radius: 5px;
          background: rgba(4, 15, 26, 0.72);
          color: #dce8f4;
        }

        .messages-inbox-page .seller {
          grid-template-columns: 34px minmax(0, 1fr);
          gap: 8px;
        }

        .messages-inbox-page .avatar {
          width: 34px;
          height: 34px;
          box-shadow: none;
        }

        .messages-inbox-page .seller-info strong {
          color: #f5f9ff;
          font-size: 12.5px;
          font-weight: 900;
        }

        .messages-inbox-page .online-status {
          color: #8da0b2;
          font-size: 9.5px;
          font-weight: 750;
        }

        .messages-inbox-page .online-status.online {
          color: #6fe7a4;
        }

        .messages-inbox-page .chat-actions {
          gap: 12px;
        }

        .messages-inbox-page .chat-actions button {
          width: 20px;
          height: 20px;
          color: #c7d4e2;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 70px;
          margin: 0 0 14px;
          padding: 8px;
          display: grid;
          grid-template-columns: 78px minmax(0, 1fr) auto;
          gap: 11px;
          align-items: center;
          border: 1px solid rgba(42, 68, 94, 0.46);
          border-radius: 5px;
          background: rgba(5, 18, 30, 0.66);
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 76px;
          height: 56px;
          border-radius: 5px;
        }

        .messages-inbox-page .listing-summary strong {
          color: #f5f9ff;
          font-size: 12px;
          font-weight: 750;
        }

        .messages-inbox-page .listing-summary span {
          margin-top: 4px;
          color: #fff;
          font-size: 17px;
          font-weight: 900;
        }

        .messages-inbox-page .listing-open {
          min-height: 34px;
          padding: 0 12px;
          border: 1px solid rgba(57, 90, 119, 0.58);
          border-radius: 5px;
          background: rgba(14, 32, 51, 0.9);
          color: #dce8f4;
          font-size: 10.5px;
          font-weight: 800;
        }

        .messages-inbox-page .inbox-preview-area {
          flex: 1 1 auto;
          min-height: 0;
          padding: 0;
          overflow: hidden;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .messages-inbox-page .messages-area.inbox-preview-area,
        body .messages-inbox-page .messages-area.inbox-preview-area,
        body > main.messages-inbox-page .messages-area.inbox-preview-area {
          border: 0;
          outline: 0;
          box-shadow: none;
          background: transparent;
          background-image: none;
          color: #e8f2fc;
        }

        .messages-inbox-page .chat-window {
          width: 100%;
          height: 100%;
          padding: 2px 8px 12px 0;
          background: transparent;
          background-image: none;
          border: 0;
          box-shadow: none;
        }

        .messages-inbox-page .chat-window .messages {
          width: 100%;
          max-width: none;
          gap: 18px;
          padding: 0;
          background: transparent;
          background-image: none;
          border: 0;
          box-shadow: none;
        }

        .messages-inbox-page .chat-window .row {
          padding: 0 6px 0 0;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          max-width: min(380px, 78%);
          padding: 10px 12px 8px;
          border-radius: 6px;
        }

        .messages-inbox-page .chat-window .own {
          background: linear-gradient(180deg, #ff8619, #ff730c);
          box-shadow: 0 16px 34px rgba(255, 112, 12, 0.28);
        }

        .messages-inbox-page .chat-window .other {
          background: linear-gradient(180deg, #172637, #142332);
          box-shadow: 0 14px 28px rgba(0, 7, 18, 0.28);
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 12px;
          line-height: 1.42;
        }

        .messages-inbox-page .input-area {
          padding: 0;
          border: 0;
          background: transparent;
        }

        .messages-inbox-page .input-area form {
          min-height: 52px;
          grid-template-columns: 34px 34px minmax(0, 1fr) 42px;
          grid-template-rows: 44px;
          gap: 0;
          padding: 4px;
          border: 1px solid rgba(57, 90, 119, 0.58);
          border-radius: 6px;
          background: rgba(5, 18, 30, 0.76);
        }

        .messages-inbox-page .input-area .tool:nth-of-type(1) {
          grid-column: 1;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(2) {
          display: none;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(3) {
          grid-column: 2;
        }

        .messages-inbox-page .input-area .tool {
          width: 34px;
          height: 44px;
          color: #b8c8d8;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          grid-column: 3;
          height: 44px;
          padding: 0 12px;
          background: transparent;
          color: #e9f2fb;
          font-size: 12px;
          font-weight: 650;
        }

        .messages-inbox-page .input-area input::placeholder {
          color: #8193a4;
        }

        .messages-inbox-page .input-area .send {
          grid-column: 4;
          width: 34px;
          height: 34px;
          border-radius: 6px;
          background: linear-gradient(135deg, #247cff, #1f65d8);
          box-shadow: 0 12px 26px rgba(31, 101, 216, 0.3);
        }

        @media (min-width: 981px) {
          .messages-inbox-page .messages-desktop-shell {
            width: min(760px, calc(100vw - 28px));
          }
        }

        .messages-inbox-page {
          position: relative;
          isolation: isolate;
          background:
            linear-gradient(135deg, rgba(255, 122, 18, 0.05) 0%, transparent 18%),
            linear-gradient(180deg, rgba(5, 18, 30, 0.94) 0%, rgba(7, 21, 30, 0.98) 56%, #050e17 100%);
        }

        .messages-inbox-page::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(126, 197, 240, 0.035) 1px, transparent 1px),
            linear-gradient(180deg, rgba(126, 197, 240, 0.028) 1px, transparent 1px),
            linear-gradient(120deg, transparent 0%, rgba(255, 122, 18, 0.055) 44%, transparent 72%),
            linear-gradient(180deg, rgba(8, 33, 52, 0.42), transparent 48%);
          background-size:
            42px 42px,
            42px 42px,
            100% 100%,
            100% 100%;
          opacity: 0.9;
        }

        .messages-inbox-page::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.22) 100%),
            repeating-linear-gradient(
              0deg,
              rgba(255, 255, 255, 0.018) 0,
              rgba(255, 255, 255, 0.018) 1px,
              transparent 1px,
              transparent 5px
            );
          mix-blend-mode: screen;
          opacity: 0.34;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(750px, calc(100vw - 22px));
          min-height: min(642px, calc(100vh - var(--topbar-h, 0px) - 14px));
          height: min(642px, calc(100vh - var(--topbar-h, 0px) - 14px));
          grid-template-columns: 266px minmax(0, 1fr);
          gap: 16px;
          padding: 14px 8px 8px 14px;
        }

        .messages-inbox-page .messages-sidebar {
          color: #f6fbff;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 0 13px 2px;
          text-shadow: 0 10px 30px rgba(0, 0, 0, 0.32);
        }

        .messages-inbox-page .message-tabs,
        .messages-inbox-page .message-search,
        .messages-inbox-page .archive-button {
          background: rgba(3, 13, 23, 0.72);
          border-color: rgba(68, 104, 134, 0.58);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
        }

        .messages-inbox-page .message-tabs {
          border-radius: 5px;
        }

        .messages-inbox-page .message-tabs button.active {
          background:
            linear-gradient(180deg, rgba(255, 128, 26, 0.22), rgba(255, 128, 26, 0.07));
          color: #ff8a1d;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 56px;
          border-bottom-color: rgba(48, 78, 104, 0.34);
        }

        .messages-inbox-page .sidebar-conversation.active {
          background:
            linear-gradient(90deg, rgba(255, 116, 18, 0.18), rgba(255, 116, 18, 0.03)),
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.035);
        }

        .messages-inbox-page .chat-wrapper {
          border-left-color: rgba(58, 89, 116, 0.5);
          background:
            linear-gradient(90deg, rgba(255, 122, 18, 0.026), transparent 26%),
            linear-gradient(180deg, rgba(4, 15, 26, 0.6), rgba(4, 14, 24, 0.84));
        }

        .messages-inbox-page .header {
          background:
            linear-gradient(180deg, rgba(5, 18, 31, 0.86), rgba(5, 18, 31, 0.44));
          border-bottom: 1px solid rgba(58, 89, 116, 0.34);
          margin-bottom: 7px;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 72px;
          margin: 0 0 12px;
          background:
            linear-gradient(180deg, rgba(8, 26, 43, 0.78), rgba(5, 18, 31, 0.72));
          border-color: rgba(58, 89, 116, 0.5);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.035),
            0 18px 44px rgba(0, 6, 18, 0.16);
        }

        .messages-inbox-page .chat-window {
          padding: 2px 8px 10px 0;
        }

        .messages-inbox-page .chat-window .messages {
          gap: 17px;
        }

        .messages-inbox-page .chat-window .own {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 36%),
            linear-gradient(180deg, #ff8619 0%, #ff730c 100%);
          box-shadow:
            0 18px 38px rgba(255, 112, 12, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .messages-inbox-page .chat-window .other {
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 38%),
            linear-gradient(180deg, #172637 0%, #142332 100%);
          box-shadow:
            0 14px 30px rgba(0, 7, 18, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.035);
        }

        .messages-inbox-page .input-area form {
          background:
            linear-gradient(180deg, rgba(8, 25, 41, 0.84), rgba(5, 18, 31, 0.82));
          border-color: rgba(68, 104, 134, 0.56);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
        }

        .messages-inbox-page .input-area .send {
          background: linear-gradient(135deg, #2a83ff, #1f63d5);
        }

        .messages-inbox-page {
          padding: 20px 16px;
          background:
            radial-gradient(900px 520px at 78% -12%, rgba(37, 100, 152, 0.16), transparent 68%),
            radial-gradient(720px 420px at 8% 8%, rgba(255, 122, 18, 0.07), transparent 62%),
            linear-gradient(180deg, #040d18 0%, #06121f 48%, #050d17 100%);
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1440px, calc(100vw - 32px));
          height: min(920px, calc(100vh - var(--topbar-h, 0px) - 40px));
          min-height: 760px;
          grid-template-columns: minmax(380px, 462px) minmax(0, 1fr);
          gap: 8px;
          padding: 0;
          margin: 0 auto;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper {
          border: 1px solid rgba(79, 111, 143, 0.48);
          border-radius: 22px;
          background:
            radial-gradient(700px 300px at 20% 0%, rgba(32, 74, 112, 0.17), transparent 70%),
            linear-gradient(180deg, rgba(7, 19, 33, 0.94), rgba(4, 14, 25, 0.96));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.045),
            0 28px 80px rgba(0, 8, 22, 0.28);
        }

        .messages-inbox-page .messages-sidebar {
          padding: 34px 16px 20px;
          display: flex;
          flex-direction: column;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0 0 30px 7px;
          font-size: 32px;
          line-height: 1;
          font-weight: 950;
        }

        .messages-inbox-page .message-tabs {
          height: 58px;
          margin-bottom: 32px;
          border-radius: 13px;
          background: rgba(9, 25, 43, 0.82);
        }

        .messages-inbox-page .message-tabs button {
          font-size: 15px;
          font-weight: 850;
          padding: 0 18px;
        }

        .messages-inbox-page .message-tabs button.active {
          border: 1px solid rgba(255, 119, 15, 0.72);
          border-radius: 12px;
          background:
            radial-gradient(120px 70px at 50% 100%, rgba(255, 122, 18, 0.24), transparent 72%),
            linear-gradient(180deg, rgba(92, 50, 25, 0.86), rgba(47, 31, 26, 0.92));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 14px 32px rgba(255, 112, 12, 0.12);
        }

        .messages-inbox-page .message-tabs button span {
          min-width: 30px;
          height: 30px;
          margin-left: 10px;
          font-size: 15px;
        }

        .messages-inbox-page .message-search {
          height: 62px;
          margin-bottom: 26px;
          grid-template-columns: 38px minmax(0, 1fr) 56px;
          border-radius: 12px;
          background: rgba(6, 20, 35, 0.88);
        }

        .messages-inbox-page .message-search svg {
          width: 24px;
          height: 24px;
        }

        .messages-inbox-page .message-search input {
          font-size: 17px;
          font-weight: 600;
        }

        .messages-inbox-page .message-search button {
          width: 56px;
          height: 62px;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 118px;
          grid-template-columns: 82px minmax(0, 1fr) 42px;
          gap: 18px;
          padding: 18px 18px;
          margin-bottom: 14px;
          border: 1px solid rgba(63, 92, 122, 0.34);
          border-left: 2px solid transparent;
          border-radius: 9px;
          background: rgba(5, 17, 30, 0.54);
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-left-color: #ff7412;
          border-color: rgba(255, 122, 18, 0.6) rgba(63, 92, 122, 0.42) rgba(63, 92, 122, 0.42) #ff7412;
          background:
            radial-gradient(190px 110px at 15% 50%, rgba(255, 122, 18, 0.22), transparent 70%),
            linear-gradient(90deg, rgba(75, 53, 39, 0.86), rgba(16, 31, 47, 0.8));
        }

        .messages-inbox-page .sidebar-avatar {
          width: 72px;
          height: 72px;
        }

        .messages-inbox-page .sidebar-avatar span {
          width: 16px;
          height: 16px;
        }

        .messages-inbox-page .sidebar-copy {
          gap: 11px;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 21px;
          font-weight: 950;
        }

        .messages-inbox-page .sidebar-copy time {
          font-size: 18px;
          font-weight: 650;
        }

        .messages-inbox-page .sidebar-copy p {
          font-size: 18px;
          font-weight: 600;
        }

        .messages-inbox-page .sidebar-unread {
          min-width: 32px;
          height: 32px;
          font-size: 17px;
        }

        .messages-inbox-page .archive-button {
          height: 76px;
          margin-top: auto;
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(18, 43, 68, 0.94), rgba(9, 28, 48, 0.96));
          font-size: 18px;
          font-weight: 900;
          gap: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .messages-inbox-page .chat-wrapper {
          padding: 24px 24px 16px;
          border-left: 1px solid rgba(79, 111, 143, 0.48);
        }

        .messages-inbox-page .header {
          min-height: 82px;
          margin: 0 0 18px;
          padding: 0;
          grid-template-columns: 56px 76px minmax(0, 1fr) auto;
          gap: 16px;
          border: 0;
          background: transparent;
        }

        .messages-inbox-page .mobile-chat-back {
          width: 56px;
          height: 56px;
          border-radius: 14px;
        }

        .messages-inbox-page .seller {
          display: contents;
        }

        .messages-inbox-page .avatar {
          width: 66px;
          height: 66px;
        }

        .messages-inbox-page .seller-info {
          align-self: center;
        }

        .messages-inbox-page .seller-info strong {
          font-size: 26px;
          line-height: 1;
        }

        .messages-inbox-page .online-status {
          margin-top: 8px;
          font-size: 18px;
          font-weight: 850;
        }

        .messages-inbox-page .chat-actions {
          gap: 16px;
        }

        .messages-inbox-page .chat-actions button {
          width: 52px;
          height: 52px;
          border: 1px solid rgba(68, 102, 134, 0.56);
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(18, 43, 68, 0.9), rgba(9, 28, 48, 0.92));
        }

        .messages-inbox-page .chat-actions button svg {
          width: 25px;
          height: 25px;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 148px;
          grid-template-columns: 170px minmax(0, 1fr) 214px;
          gap: 24px;
          margin: 0 0 28px;
          padding: 16px;
          border-radius: 14px;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 156px;
          height: 116px;
          border-radius: 8px;
        }

        .messages-inbox-page .listing-summary strong {
          font-size: 22px;
          font-weight: 900;
        }

        .messages-inbox-page .listing-summary span {
          margin-top: 16px;
          font-size: 36px;
        }

        .messages-inbox-page .listing-open {
          min-height: 70px;
          border-radius: 12px;
          font-size: 18px;
          font-weight: 900;
        }

        .messages-inbox-page .chat-window {
          padding: 0 0 14px;
        }

        .messages-inbox-page .chat-window .date-divider {
          margin: 10px 0 28px;
          font-size: 15px;
        }

        .messages-inbox-page .chat-window .date-divider span {
          padding: 8px 20px;
        }

        .messages-inbox-page .chat-window .messages {
          gap: 22px;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-width: 210px;
          max-width: min(560px, 72%);
          padding: 24px 24px 18px;
          border-radius: 14px;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 19px;
          font-weight: 800;
          line-height: 1.4;
        }

        .messages-inbox-page .chat-window .message-meta {
          font-size: 17px;
          margin-top: 10px;
        }

        .messages-inbox-page .input-area form {
          min-height: 112px;
          grid-template-columns: 76px minmax(0, 1fr) 76px 76px;
          grid-template-rows: 76px;
          gap: 16px;
          padding: 18px 22px;
          border-radius: 14px;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(1) {
          grid-column: 1;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(3) {
          grid-column: 3;
        }

        .messages-inbox-page .input-area .tool {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          background: rgba(17, 41, 66, 0.78);
        }

        .messages-inbox-page .input-area .tool svg {
          width: 30px;
          height: 30px;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          grid-column: 2;
          height: 72px;
          padding: 0 26px;
          border: 1px solid rgba(83, 118, 151, 0.7);
          border-radius: 12px;
          font-size: 22px;
        }

        .messages-inbox-page .input-area .send {
          grid-column: 4;
          width: 68px;
          height: 68px;
          border-radius: 14px;
        }

        .messages-inbox-page .input-area .send svg {
          width: 34px;
          height: 34px;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1220px, calc(100vw - 24px));
          height: min(760px, calc(100vh - var(--topbar-h, 0px) - 28px));
          min-height: 640px;
          grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
          gap: 10px;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper {
          border-radius: 18px;
        }

        .messages-inbox-page .messages-sidebar {
          padding: 28px 14px 18px;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin-bottom: 24px;
          font-size: 28px;
        }

        .messages-inbox-page .message-tabs {
          height: 50px;
          margin-bottom: 26px;
          border-radius: 11px;
        }

        .messages-inbox-page .message-tabs button {
          position: relative;
          overflow: visible;
          padding: 0 14px;
          font-size: 14px;
        }

        .messages-inbox-page .message-tabs button.active {
          border-radius: 10px;
        }

        .messages-inbox-page .message-tabs button span {
          position: absolute;
          right: 12px;
          bottom: -12px;
          min-width: 28px;
          height: 28px;
          margin: 0;
          border: 2px solid rgba(255, 255, 255, 0.96);
          font-size: 14px;
          font-weight: 950;
          box-shadow: 0 10px 22px rgba(255, 112, 12, 0.34);
        }

        .messages-inbox-page .message-search {
          height: 52px;
          margin-bottom: 22px;
          grid-template-columns: 34px minmax(0, 1fr) 50px;
        }

        .messages-inbox-page .message-search input {
          font-size: 15px;
        }

        .messages-inbox-page .message-search button {
          width: 50px;
          height: 52px;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 94px;
          grid-template-columns: 64px minmax(0, 1fr) 36px;
          gap: 14px;
          padding: 14px;
          margin-bottom: 12px;
        }

        .messages-inbox-page .sidebar-avatar {
          width: 58px;
          height: 58px;
        }

        .messages-inbox-page .sidebar-avatar span {
          width: 14px;
          height: 14px;
        }

        .messages-inbox-page .sidebar-copy {
          gap: 8px;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 18px;
        }

        .messages-inbox-page .sidebar-copy time {
          font-size: 15px;
        }

        .messages-inbox-page .sidebar-copy p {
          font-size: 15px;
        }

        .messages-inbox-page .sidebar-unread {
          min-width: 28px;
          height: 28px;
          font-size: 15px;
        }

        .messages-inbox-page .archive-button {
          height: 62px;
          border-radius: 11px;
          font-size: 16px;
        }

        .messages-inbox-page .chat-wrapper {
          padding: 18px 18px 14px;
        }

        .messages-inbox-page .header {
          min-height: 66px;
          grid-template-columns: 48px 60px minmax(0, 1fr) auto;
          gap: 12px;
          margin-bottom: 14px;
        }

        .messages-inbox-page .mobile-chat-back {
          width: 46px;
          height: 46px;
          border-radius: 12px;
        }

        .messages-inbox-page .avatar {
          width: 56px;
          height: 56px;
        }

        .messages-inbox-page .seller-info strong {
          font-size: 22px;
        }

        .messages-inbox-page .online-status {
          margin-top: 6px;
          font-size: 16px;
        }

        .messages-inbox-page .chat-actions {
          gap: 12px;
        }

        .messages-inbox-page .chat-actions button {
          width: 44px;
          height: 44px;
          border-radius: 12px;
        }

        .messages-inbox-page .chat-actions button svg {
          width: 21px;
          height: 21px;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 118px;
          grid-template-columns: 132px minmax(0, 1fr) 180px;
          gap: 18px;
          margin-bottom: 24px;
          padding: 14px;
          border-radius: 13px;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 122px;
          height: 90px;
        }

        .messages-inbox-page .listing-summary strong {
          font-size: 19px;
        }

        .messages-inbox-page .listing-summary span {
          margin-top: 12px;
          font-size: 30px;
        }

        .messages-inbox-page .listing-open {
          min-height: 58px;
          border-radius: 11px;
          font-size: 16px;
        }

        .messages-inbox-page .chat-window .date-divider {
          margin: 8px 0 24px;
          font-size: 13px;
        }

        .messages-inbox-page .chat-window .date-divider span {
          padding: 7px 18px;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-width: 170px;
          max-width: min(470px, 72%);
          padding: 20px 20px 16px;
          border-radius: 13px;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 16px;
        }

        .messages-inbox-page .chat-window .message-meta {
          font-size: 14px;
          margin-top: 8px;
        }

        .messages-inbox-page .input-area form {
          min-height: 86px;
          grid-template-columns: 58px minmax(0, 1fr) 58px 58px;
          grid-template-rows: 58px;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 13px;
        }

        .messages-inbox-page .input-area .tool {
          width: 48px;
          height: 48px;
          border-radius: 12px;
        }

        .messages-inbox-page .input-area .tool svg {
          width: 25px;
          height: 25px;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          height: 56px;
          padding: 0 22px;
          border-radius: 11px;
          font-size: 19px;
        }

        .messages-inbox-page .input-area .send {
          width: 56px;
          height: 56px;
          border-radius: 12px;
        }

        .messages-inbox-page .input-area .send svg {
          width: 29px;
          height: 29px;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1060px, calc(100vw - 28px));
          height: min(650px, calc(100vh - var(--topbar-h, 0px) - 32px));
          min-height: 560px;
          grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
          gap: 10px;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper {
          border-radius: 16px;
        }

        .messages-inbox-page .messages-sidebar {
          padding: 24px 13px 16px;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin-bottom: 22px;
          font-size: 25px;
        }

        .messages-inbox-page .message-tabs {
          height: 46px;
          margin-bottom: 22px;
        }

        .messages-inbox-page .message-tabs button {
          padding: 0 12px;
          font-size: 13px;
        }

        .messages-inbox-page .message-tabs button span {
          right: 10px;
          bottom: -10px;
          min-width: 25px;
          height: 25px;
          font-size: 13px;
        }

        .messages-inbox-page .message-search {
          height: 48px;
          margin-bottom: 20px;
          grid-template-columns: 31px minmax(0, 1fr) 46px;
        }

        .messages-inbox-page .message-search input {
          font-size: 14px;
        }

        .messages-inbox-page .message-search button {
          width: 46px;
          height: 48px;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 82px;
          grid-template-columns: 56px minmax(0, 1fr) 32px;
          gap: 12px;
          padding: 12px;
          margin-bottom: 10px;
        }

        .messages-inbox-page .sidebar-avatar {
          width: 50px;
          height: 50px;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 16px;
        }

        .messages-inbox-page .sidebar-copy time,
        .messages-inbox-page .sidebar-copy p {
          font-size: 13px;
        }

        .messages-inbox-page .archive-button {
          height: 54px;
          font-size: 14px;
        }

        .messages-inbox-page .chat-wrapper {
          padding: 16px 16px 12px;
        }

        .messages-inbox-page .header {
          min-height: 56px;
          grid-template-columns: 42px 52px minmax(0, 1fr) auto;
          gap: 10px;
          margin-bottom: 12px;
        }

        .messages-inbox-page .mobile-chat-back {
          width: 40px;
          height: 40px;
        }

        .messages-inbox-page .avatar {
          width: 48px;
          height: 48px;
        }

        .messages-inbox-page .seller-info strong {
          font-size: 19px;
        }

        .messages-inbox-page .online-status {
          font-size: 14px;
        }

        .messages-inbox-page .chat-actions button {
          width: 38px;
          height: 38px;
        }

        .messages-inbox-page .chat-actions button svg {
          width: 19px;
          height: 19px;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 98px;
          grid-template-columns: 104px minmax(0, 1fr) 158px;
          gap: 14px;
          margin-bottom: 18px;
          padding: 12px;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 96px;
          height: 72px;
        }

        .messages-inbox-page .listing-summary strong {
          font-size: 17px;
        }

        .messages-inbox-page .listing-summary span {
          margin-top: 8px;
          font-size: 26px;
        }

        .messages-inbox-page .listing-open {
          min-height: 50px;
          font-size: 14px;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-width: 150px;
          max-width: min(390px, 72%);
          padding: 16px 17px 13px;
          border-radius: 12px;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 14px;
        }

        .messages-inbox-page .chat-window .message-meta {
          font-size: 12.5px;
        }

        .messages-inbox-page .input-area form {
          min-height: 72px;
          grid-template-columns: 48px minmax(0, 1fr) 48px 48px;
          grid-template-rows: 48px;
          gap: 10px;
          padding: 11px 12px;
        }

        .messages-inbox-page .input-area .tool {
          width: 40px;
          height: 40px;
        }

        .messages-inbox-page .input-area .tool svg {
          width: 21px;
          height: 21px;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          height: 46px;
          padding: 0 18px;
          font-size: 16px;
        }

        .messages-inbox-page .input-area .send {
          width: 46px;
          height: 46px;
        }

        .messages-inbox-page .input-area .send svg {
          width: 25px;
          height: 25px;
        }

        .messages-inbox-page {
          min-height: calc(100vh - var(--topbar-h, 0px));
          padding: 12px 16px 14px;
          overflow: hidden;
          background:
            radial-gradient(860px 420px at 52% 8%, rgba(20, 67, 102, 0.18), transparent 68%),
            linear-gradient(180deg, #050f1a 0%, #06121d 56%, #040b13 100%);
        }

        .messages-inbox-page .messages-page-back {
          width: min(1380px, calc(100vw - 32px));
          height: 34px;
          margin: 0 auto 10px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #f3f8ff;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none;
        }

        .messages-inbox-page .messages-page-back svg {
          color: #ff7a12;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1380px, calc(100vw - 32px));
          height: min(650px, calc(100vh - var(--topbar-h, 0px) - 58px));
          min-height: 560px;
          display: grid;
          grid-template-columns: 345px minmax(0, 1fr) 275px;
          gap: 10px;
          margin: 0 auto;
          padding: 0;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper,
        .messages-inbox-page .messages-info-panel {
          min-height: 0;
          height: 100%;
          border: 1px solid rgba(51, 82, 110, 0.54);
          border-radius: 6px;
          background:
            radial-gradient(520px 220px at 12% 0%, rgba(20, 63, 96, 0.14), transparent 70%),
            rgba(5, 17, 29, 0.9);
          box-shadow: none;
        }

        .messages-inbox-page .messages-sidebar {
          padding: 18px 14px 12px;
        }

        .messages-inbox-page .sidebar-heading {
          display: flex;
          align-items: baseline;
          gap: 9px;
          margin-bottom: 16px;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 950;
          line-height: 1;
        }

        .messages-inbox-page .sidebar-heading::after {
          content: attr(data-all-conversations);
          color: #8ca0b4;
          font-size: 11px;
          font-weight: 650;
        }

        .messages-inbox-page .message-tabs {
          height: 34px;
          margin-bottom: 14px;
          border-radius: 5px;
          background: rgba(5, 18, 31, 0.78);
        }

        .messages-inbox-page .message-tabs button {
          padding: 0 16px;
          font-size: 11px;
          font-weight: 850;
        }

        .messages-inbox-page .message-tabs button.active {
          border: 1px solid rgba(255, 122, 18, 0.72);
          border-radius: 4px;
          background: linear-gradient(180deg, rgba(255, 122, 18, 0.24), rgba(255, 122, 18, 0.08));
        }

        .messages-inbox-page .message-tabs button span {
          position: static;
          min-width: 22px;
          height: 22px;
          margin-left: 7px;
          border: 0;
          font-size: 11px;
        }

        .messages-inbox-page .message-search {
          height: 40px;
          margin-bottom: 12px;
          grid-template-columns: 30px minmax(0, 1fr) 38px;
          border-radius: 5px;
        }

        .messages-inbox-page .message-search input {
          font-size: 11px;
        }

        .messages-inbox-page .message-search button {
          width: 38px;
          height: 40px;
        }

        .messages-inbox-page .sidebar-conversation {
          min-height: 58px;
          grid-template-columns: 44px minmax(0, 1fr) 28px;
          gap: 10px;
          margin-bottom: 7px;
          padding: 9px 10px;
          border-radius: 5px;
          background: rgba(4, 15, 26, 0.58);
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-left-color: #ff7412;
          background:
            linear-gradient(90deg, rgba(255, 116, 18, 0.18), rgba(255, 116, 18, 0.04)),
            rgba(14, 27, 40, 0.86);
        }

        .messages-inbox-page .sidebar-avatar {
          width: 38px;
          height: 38px;
        }

        .messages-inbox-page .sidebar-copy {
          gap: 4px;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 12.5px;
          font-weight: 900;
        }

        .messages-inbox-page .sidebar-copy time,
        .messages-inbox-page .sidebar-copy p {
          font-size: 10.5px;
        }

        .messages-inbox-page .sidebar-unread {
          min-width: 22px;
          height: 22px;
          font-size: 11px;
        }

        .messages-inbox-page .archive-button {
          height: 38px;
          font-size: 12px;
          border-radius: 5px;
        }

        .messages-inbox-page .chat-wrapper {
          padding: 14px 14px 10px;
        }

        .messages-inbox-page .header {
          min-height: 52px;
          grid-template-columns: 44px 48px minmax(0, 1fr) auto;
          gap: 10px;
          margin-bottom: 8px;
        }

        .messages-inbox-page .mobile-chat-back {
          width: 34px;
          height: 34px;
          border-radius: 5px;
        }

        .messages-inbox-page .avatar {
          width: 44px;
          height: 44px;
        }

        .messages-inbox-page .seller-info strong {
          font-size: 17px;
        }

        .messages-inbox-page .online-status {
          margin-top: 5px;
          font-size: 11px;
        }

        .messages-inbox-page .chat-actions {
          gap: 7px;
        }

        .messages-inbox-page .chat-actions button {
          width: 32px;
          height: 32px;
          border-radius: 5px;
        }

        .messages-inbox-page .chat-actions button svg {
          width: 16px;
          height: 16px;
        }

        .messages-inbox-page .chat-listing-strip {
          min-height: 82px;
          grid-template-columns: 76px minmax(0, 1fr) 130px;
          gap: 12px;
          margin-bottom: 12px;
          padding: 10px;
          border-radius: 5px;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 66px;
          height: 54px;
          border-radius: 5px;
        }

        .messages-inbox-page .listing-summary strong {
          font-size: 12px;
        }

        .messages-inbox-page .listing-summary span {
          margin-top: 5px;
          font-size: 18px;
        }

        .messages-inbox-page .listing-open {
          min-height: 36px;
          border-radius: 5px;
          font-size: 11px;
        }

        .messages-inbox-page .chat-window .date-divider {
          margin: 2px 0 14px;
          font-size: 10px;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-width: 130px;
          max-width: min(360px, 74%);
          padding: 12px 13px 9px;
          border-radius: 7px;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 12px;
        }

        .messages-inbox-page .chat-window .message-meta {
          font-size: 10.5px;
          margin-top: 4px;
        }

        .messages-inbox-page .input-area form {
          min-height: 52px;
          grid-template-columns: 34px minmax(0, 1fr) 34px 34px;
          grid-template-rows: 34px;
          gap: 8px;
          padding: 8px;
          border-radius: 5px;
        }

        .messages-inbox-page .input-area .tool {
          width: 30px;
          height: 30px;
          border-radius: 5px;
        }

        .messages-inbox-page .input-area .tool svg {
          width: 16px;
          height: 16px;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          height: 34px;
          padding: 0 12px;
          border-radius: 5px;
          font-size: 12px;
        }

        .messages-inbox-page .input-area .send {
          width: 34px;
          height: 34px;
          border-radius: 5px;
        }

        .messages-inbox-page .input-area .send svg {
          width: 18px;
          height: 18px;
        }

        .messages-inbox-page .messages-info-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 10px;
          overflow-y: auto;
        }

        .messages-inbox-page .messages-info-card {
          display: grid;
          gap: 12px;
          padding: 14px;
          border: 1px solid rgba(51, 82, 110, 0.54);
          border-radius: 6px;
          background: rgba(6, 19, 32, 0.82);
        }

        .messages-inbox-page .messages-info-card h2 {
          margin: 0;
          color: #f5f9ff;
          font-size: 14px;
          font-weight: 900;
        }

        .messages-inbox-page .messages-info-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .messages-inbox-page .messages-info-card-head button {
          width: 24px;
          height: 24px;
          border: 0;
          background: transparent;
          color: #cbd7e4;
          box-shadow: none;
        }

        .messages-inbox-page .messages-info-listing,
        .messages-inbox-page .messages-info-seller {
          display: grid;
          grid-template-columns: 66px minmax(0, 1fr);
          align-items: center;
          gap: 12px;
        }

        .messages-inbox-page .messages-info-listing img {
          width: 66px;
          height: 56px;
          border-radius: 5px;
          object-fit: cover;
        }

        .messages-inbox-page .messages-info-listing strong,
        .messages-inbox-page .messages-info-seller strong {
          display: block;
          color: #f5f9ff;
          font-size: 13px;
          font-weight: 900;
        }

        .messages-inbox-page .messages-info-listing span {
          display: block;
          margin-top: 7px;
          color: #fff;
          font-size: 19px;
          font-weight: 950;
        }

        .messages-inbox-page .messages-info-primary,
        .messages-inbox-page .messages-info-secondary {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(64, 96, 126, 0.58);
          border-radius: 5px;
          color: #f5f9ff;
          font-size: 11px;
          font-weight: 850;
          text-decoration: none;
          background: rgba(8, 25, 42, 0.84);
        }

        .messages-inbox-page .messages-info-primary {
          border-color: rgba(255, 130, 30, 0.58);
          background: linear-gradient(135deg, #ff8518, #ff6900);
        }

        .messages-inbox-page .messages-info-seller {
          grid-template-columns: 50px minmax(0, 1fr);
        }

        .messages-inbox-page .messages-info-seller .avatar {
          width: 46px;
          height: 46px;
        }

        .messages-inbox-page .seller-presence {
          display: block;
          margin-top: 3px;
          color: #65e69c;
          font-size: 10px;
          font-weight: 850;
        }

        .messages-inbox-page .messages-info-seller small,
        .messages-inbox-page .messages-info-seller em {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 6px;
          color: #c0ccda;
          font-size: 10px;
          font-style: normal;
          font-weight: 700;
        }

        .messages-inbox-page .messages-info-seller small svg {
          color: #ff991f;
          fill: currentColor;
        }

        .messages-inbox-page .safety-info-card h2 {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .messages-inbox-page .safety-info-card h2 svg {
          color: #ff7a12;
        }

        .messages-inbox-page .safety-info-card p {
          margin: 0;
          color: #aab9c8;
          font-size: 11px;
          line-height: 1.55;
        }

        .messages-inbox-page .safety-info-card a {
          color: #ff8a1d;
          font-weight: 850;
        }

        .messages-inbox-page .message-tabs button.active {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 10px;
        }

        .messages-inbox-page .message-tabs button span {
          position: static;
          transform: none;
          flex: 0 0 auto;
          min-width: 20px;
          height: 20px;
          margin: 0;
          padding: 0 6px;
          border: 0;
          font-size: 11px;
          line-height: 1;
        }

        .messages-inbox-page .input-area form {
          grid-template-columns: minmax(0, 1fr) 36px 36px 42px;
          grid-template-rows: 42px;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          grid-column: 1;
          grid-row: 1;
          height: 42px;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(1) {
          grid-column: 2;
          grid-row: 1;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(2) {
          display: none;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(3) {
          grid-column: 3;
          grid-row: 1;
          display: inline-flex;
        }

        .messages-inbox-page .input-area .send {
          grid-column: 4;
          grid-row: 1;
        }

        .messages-inbox-page .seller-presence.offline {
          color: #8ea1b4;
        }

        .messages-inbox-page {
          min-height: calc(100dvh - var(--topbar-h, 0px));
          padding: 10px 18px 18px;
          overflow: hidden;
        }

        .messages-inbox-page .messages-page-back {
          height: 26px;
          margin: 0 auto 8px;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1380px, calc(100vw - 36px));
          height: calc(100dvh - var(--topbar-h, 0px) - 54px);
          min-height: 0;
          grid-template-columns: 345px minmax(560px, 1fr) 275px;
          gap: 10px;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper,
        .messages-inbox-page .messages-info-panel {
          height: 100%;
          min-height: 0;
        }

        .messages-inbox-page .messages-sidebar {
          padding: 18px 14px 12px;
        }

        .messages-inbox-page .message-tabs {
          height: 38px;
          overflow: visible;
        }

        .messages-inbox-page .message-tabs button {
          overflow: visible;
        }

        .messages-inbox-page .message-tabs button.active {
          position: relative;
        }

        .messages-inbox-page .message-tabs button span {
          position: absolute;
          right: 8px;
          top: 50%;
          bottom: auto;
          transform: translateY(-50%);
          min-width: 22px;
          height: 22px;
          margin: 0;
          border: 0;
          box-shadow: 0 8px 18px rgba(255, 112, 12, 0.28);
        }

        .messages-inbox-page .chat-wrapper {
          padding: 14px;
        }

        .messages-inbox-page .inbox-preview-area {
          flex: 1 1 auto;
          min-height: 0;
        }

        .messages-inbox-page .chat-window {
          height: 100%;
          padding-bottom: 8px;
        }

        .messages-inbox-page .input-area {
          flex: 0 0 auto;
        }

        .messages-inbox-page .input-area form {
          min-height: 58px;
          grid-template-columns: 40px minmax(0, 1fr) 40px 44px;
          grid-template-rows: 40px;
          align-items: center;
          gap: 8px;
          padding: 8px;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          height: 40px;
          font-size: 13px;
        }

        .messages-inbox-page .input-area .tool {
          width: 36px;
          height: 36px;
        }

        .messages-inbox-page .input-area .send {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #2f83ff, #1f63d5);
        }

        .messages-inbox-page .input-area .send svg {
          width: 22px;
          height: 22px;
        }

        @media (max-width: 1100px) {
          .messages-inbox-page .messages-desktop-shell {
            grid-template-columns: 300px minmax(0, 1fr);
          }

          .messages-inbox-page .messages-info-panel {
            display: none;
          }
        }

        .messages-inbox-page .message-tabs button.active {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 10px;
          position: relative;
        }

        .messages-inbox-page .message-tabs button span {
          position: static;
          inset: auto;
          transform: none;
          flex: 0 0 auto;
          min-width: 20px;
          height: 20px;
          margin: 0;
          padding: 0 6px;
          border: 0;
          font-size: 11px;
          line-height: 1;
        }

        .messages-inbox-page .input-area form {
          grid-template-columns: minmax(0, 1fr) 36px 36px 42px;
          grid-template-rows: 42px;
          min-height: 58px;
        }

        .messages-inbox-page .input-area input[type="text"],
        .messages-inbox-page .input-area input:not([type]) {
          grid-column: 1;
          grid-row: 1;
          height: 42px;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(1) {
          grid-column: 2;
          grid-row: 1;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(2) {
          display: none;
        }

        .messages-inbox-page .input-area .tool:nth-of-type(3) {
          grid-column: 3;
          grid-row: 1;
          display: inline-flex;
        }

        .messages-inbox-page .input-area .send {
          grid-column: 4;
          grid-row: 1;
        }

        .messages-inbox-page .seller-presence.offline {
          color: #8ea1b4;
        }

        .messages-inbox-page .messages-desktop-shell {
          height: calc(100dvh - var(--topbar-h, 0px) - 28px);
        }

        .messages-inbox-page .header {
          grid-template-columns: 48px minmax(0, 1fr) auto;
        }

        .messages-inbox-page .seller {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          align-items: center;
          gap: 10px;
        }

        .messages-inbox-page .mobile-chat-back,
        .messages-inbox-page .messages-page-back {
          display: none;
        }

        .messages-inbox-page .header {
          grid-template-columns: minmax(0, 1fr);
          align-items: center;
        }

        .messages-inbox-page .seller {
          display: grid;
          grid-template-columns: 46px minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          min-width: 0;
          width: 100%;
        }

        .messages-inbox-page .seller-info {
          min-width: 0;
        }

        .messages-inbox-page .seller-info strong {
          display: block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1.1;
        }

        .messages-inbox-page .online-status,
        .messages-inbox-page .seller-presence {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .chat-actions,
        .messages-inbox-page .chat-action-menu-wrap {
          display: none;
        }

        .messages-inbox-page .header {
          background: transparent;
          background-image: none;
          border: 0;
          border-bottom: 0;
          box-shadow: none;
          margin-bottom: 10px;
          padding: 0;
        }

        body .messages-inbox-page .chat-wrapper > header.header,
        html body .messages-inbox-page .chat-wrapper > header.header,
        main.messages-inbox-page .chat-wrapper > header.header {
          background: transparent;
          background-color: transparent;
          background-image: none;
          border: 0;
          border-top: 0;
          border-right: 0;
          border-bottom: 0;
          border-left: 0;
          box-shadow: none;
          outline: 0;
        }

        body .messages-inbox-page .chat-wrapper > header.header::before,
        body .messages-inbox-page .chat-wrapper > header.header::after,
        html body .messages-inbox-page .chat-wrapper > header.header::before,
        html body .messages-inbox-page .chat-wrapper > header.header::after {
          content: none;
          display: none;
        }

        body .messages-inbox-page .chat-wrapper > header.header .seller,
        html body .messages-inbox-page .chat-wrapper > header.header .seller {
          background: transparent;
          background-color: transparent;
          background-image: none;
          border: 0;
          box-shadow: none;
          outline: 0;
        }

        .messages-inbox-page .chat-window .messages {
          gap: 18px;
        }

        .messages-inbox-page .chat-window .row {
          align-items: flex-start;
          gap: 8px;
        }

        .messages-inbox-page .chat-window .message-avatar {
          align-self: flex-start;
          width: 26px;
          height: 26px;
          margin-top: 2px;
          border: 0;
          box-shadow: none;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-width: 130px;
          max-width: min(440px, 78%);
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          padding: 13px 15px 10px;
          border: 0;
          border-radius: 8px;
        }

        .messages-inbox-page .chat-window .own {
          min-height: 60px;
          min-width: 210px;
          margin-left: auto;
          border-bottom-right-radius: 5px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.1), transparent 35%),
            linear-gradient(180deg, #ff7f14 0%, #ff6900 100%);
          box-shadow: 0 18px 38px rgba(255, 105, 0, 0.25);
        }

        .messages-inbox-page .chat-window .other {
          border-bottom-left-radius: 5px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 42%),
            linear-gradient(180deg, #152433 0%, #111f2e 100%);
          box-shadow: 0 14px 30px rgba(0, 8, 20, 0.26);
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          color: inherit;
          font-size: 12px;
          font-weight: 650;
          grid-column: 1 / -1;
          line-height: 1.5;
        }

        .messages-inbox-page .chat-window .message-meta {
          margin-top: 0;
          font-size: 10.5px;
          font-weight: 750;
          opacity: 0.82;
        }

        .messages-inbox-page .chat-window .outside-time {
          align-self: flex-end;
          margin: 0 0 4px -2px;
          color: rgba(160, 176, 194, 0.72);
          font-size: 10.5px;
          font-weight: 750;
          line-height: 1;
          white-space: nowrap;
        }

        body .messages-inbox-page.messages-page {
          min-height: calc(100dvh - var(--topbar-h, 56px));
          height: calc(100dvh - var(--topbar-h, 56px));
          padding: 18px 28px 20px;
          overflow: hidden;
          background: #10232d;
          color: #f4f8fc;
        }

        .messages-inbox-page *,
        .messages-inbox-page *::before,
        .messages-inbox-page *::after {
          box-sizing: border-box;
          letter-spacing: 0;
        }

        .messages-inbox-page .messages-desktop-shell {
          width: min(1380px, calc(100vw - 56px));
          height: calc(100dvh - var(--topbar-h, 56px) - 38px);
          min-height: 0;
          display: grid;
          grid-template-columns: 345px minmax(540px, 1fr) 275px;
          gap: 10px;
          margin: 0 auto;
          padding: 0;
        }

        .messages-inbox-page .messages-sidebar,
        .messages-inbox-page .chat-wrapper,
        .messages-inbox-page .messages-info-panel {
          min-width: 0;
          min-height: 0;
          height: 100%;
          border: 1px solid #294760;
          border-radius: 6px;
          background: #061522;
          box-shadow: none;
          overflow: hidden;
        }

        .messages-inbox-page .messages-sidebar {
          display: flex;
          flex-direction: column;
          padding: 22px 14px 14px;
        }

        .messages-inbox-page .sidebar-heading {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin: 0 0 16px;
        }

        .messages-inbox-page .sidebar-heading h1 {
          margin: 0;
          color: #f6f9fd;
          font-size: 24px;
          font-weight: 950;
          line-height: 1;
        }

        .messages-inbox-page .sidebar-heading::after {
          content: attr(data-all-conversations);
          color: #93a6b7;
          font-size: 11px;
          font-weight: 800;
        }

        .messages-inbox-page .message-tabs {
          flex: 0 0 auto;
          height: 38px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 0 0 26px;
          overflow: hidden;
          border: 1px solid #294760;
          border-radius: 5px;
          background: #071a2b;
        }

        .messages-inbox-page .message-tabs button {
          min-width: 0;
          height: 36px;
          padding: 0 8px;
          border: 0;
          border-right: 1px solid #243d55;
          border-radius: 0;
          background: transparent;
          color: #b5c2cf;
          box-shadow: none;
          font-size: 11px;
          font-weight: 900;
          line-height: 1;
        }

        .messages-inbox-page .message-tabs button:last-child {
          border-right: 0;
        }

        .messages-inbox-page .message-tabs button.active {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid #ff7a12;
          border-radius: 4px;
          background: #07111d;
          color: #ffffff;
        }

        .messages-inbox-page .message-tabs button span,
        .messages-inbox-page .sidebar-unread {
          position: static;
          display: inline-grid;
          place-items: center;
          min-width: 20px;
          height: 20px;
          margin: 0;
          padding: 0 6px;
          border: 0;
          border-radius: 999px;
          background: #ff7412;
          color: #ffffff;
          box-shadow: none;
          font-size: 11px;
          font-weight: 950;
          line-height: 1;
          transform: none;
        }

        .messages-inbox-page .message-search {
          flex: 0 0 auto;
          height: 40px;
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) 38px;
          align-items: center;
          gap: 0;
          margin: 0 0 12px;
          padding: 0 0 0 10px;
          border: 1px solid #294760;
          border-radius: 5px;
          background: #092034;
          color: #a9b9c9;
        }

        .messages-inbox-page .message-search svg {
          width: 20px;
          height: 20px;
          color: #94a9bb;
        }

        .messages-inbox-page .message-search input {
          min-width: 0;
          height: 38px;
          border: 0;
          background: transparent;
          color: #f4f8fc;
          outline: 0;
          font-size: 11px;
          font-weight: 800;
        }

        .messages-inbox-page .message-search input::placeholder {
          color: #8ea1b4;
          opacity: 1;
        }

        .messages-inbox-page .message-search button {
          width: 38px;
          height: 38px;
          border: 0;
          border-left: 1px solid #294760;
          border-radius: 0;
          background: transparent;
          color: #c6d4e2;
          box-shadow: none;
        }

        .messages-inbox-page .sidebar-list {
          min-height: 0;
          display: flex;
          flex: 1 1 auto;
          flex-direction: column;
          gap: 7px;
          overflow-y: auto;
          padding: 0 1px 8px;
        }

        .messages-inbox-page .sidebar-conversation {
          position: relative;
          min-height: 58px;
          width: 100%;
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          margin: 0;
          padding: 9px 8px;
          border: 1px solid transparent;
          border-radius: 5px;
          background: transparent;
          color: inherit;
          box-shadow: none;
          text-align: left;
        }

        .messages-inbox-page .sidebar-conversation:hover {
          border-color: rgba(255, 122, 18, 0.42);
          background: rgba(255, 122, 18, 0.06);
          transform: none;
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-color: #ff7412;
          background: #2a2424;
        }

        .messages-inbox-page .sidebar-avatar {
          position: relative;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          overflow: visible;
          border: 2px solid #eef8ff;
          border-radius: 999px;
          background: #f8fbff;
          color: #0e2434;
          box-shadow: 0 0 0 2px #061522;
          font-size: 11px;
          font-weight: 950;
        }

        .messages-inbox-page .sidebar-avatar img {
          width: 100%;
          height: 100%;
          display: block;
          border-radius: inherit;
          object-fit: cover;
        }

        .messages-inbox-page .sidebar-avatar span,
        .messages-inbox-page .avatar-presence {
          position: absolute;
          right: -2px;
          bottom: -2px;
          width: 14px;
          height: 14px;
          border: 2px solid #061522;
          border-radius: 999px;
          background: #24e275;
        }

        .messages-inbox-page .sidebar-copy {
          min-width: 0;
          display: grid;
          gap: 5px;
        }

        .messages-inbox-page .sidebar-copy > div {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }

        .messages-inbox-page .sidebar-copy strong {
          overflow: hidden;
          color: #f7fbff;
          font-size: 12.5px;
          font-weight: 950;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .sidebar-copy time {
          color: #9bacbd;
          font-size: 10.5px;
          font-weight: 850;
          white-space: nowrap;
        }

        .messages-inbox-page .sidebar-copy p {
          overflow: hidden;
          margin: 0;
          color: #a8b8c8;
          font-size: 10.5px;
          font-weight: 750;
          line-height: 1.3;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .archive-button {
          flex: 0 0 auto;
          width: 100%;
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 1px solid #335473;
          border-radius: 5px;
          background: #102f4b;
          color: #d7e4f1;
          box-shadow: none;
          font-size: 12px;
          font-weight: 900;
        }

        .messages-inbox-page .chat-wrapper {
          display: flex;
          flex-direction: column;
          padding: 14px;
        }

        .messages-inbox-page .header {
          flex: 0 0 auto;
          min-height: 52px;
          display: flex;
          align-items: center;
          margin: 0 0 10px;
          padding: 0;
          border: 0;
          background: transparent;
          box-shadow: none;
        }

        .messages-inbox-page .mobile-chat-back {
          display: none;
        }

        .messages-inbox-page .seller {
          min-width: 0;
          display: grid;
          grid-template-columns: 46px minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          width: 100%;
        }

        .messages-inbox-page .avatar {
          position: relative;
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          overflow: visible;
          border: 2px solid #effaff;
          border-radius: 999px;
          background: #f8fbff;
          color: #0e2434;
          box-shadow: 0 0 0 2px #061522;
          font-size: 12px;
          font-weight: 950;
        }

        .messages-inbox-page .avatar img,
        .messages-inbox-page .avatar-fallback {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          border-radius: inherit;
          object-fit: cover;
        }

        .messages-inbox-page .seller-info {
          min-width: 0;
        }

        .messages-inbox-page .seller-info strong {
          display: block;
          overflow: hidden;
          color: #f7fbff;
          font-size: 17px;
          font-weight: 950;
          line-height: 1.1;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .online-status,
        .messages-inbox-page .seller-presence {
          display: block;
          overflow: hidden;
          margin: 5px 0 0;
          color: #59e896;
          font-size: 11px;
          font-weight: 900;
          line-height: 1.15;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .online-status.offline,
        .messages-inbox-page .seller-presence.offline {
          color: #8ea1b4;
        }

        .messages-inbox-page .chat-listing-strip {
          flex: 0 0 auto;
          min-height: 82px;
          display: grid;
          grid-template-columns: 76px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          margin: 0 0 14px;
          padding: 10px;
          border: 1px solid #294760;
          border-radius: 5px;
          background: #082036;
        }

        .messages-inbox-page .listing-thumb,
        .messages-inbox-page .listing-thumb img {
          width: 66px;
          height: 56px;
          display: block;
          overflow: hidden;
          border-radius: 5px;
        }

        .messages-inbox-page .listing-thumb img {
          object-fit: cover;
        }

        .messages-inbox-page .listing-summary {
          min-width: 0;
        }

        .messages-inbox-page .listing-summary strong {
          display: block;
          overflow: hidden;
          color: #f7fbff;
          font-size: 12px;
          font-weight: 950;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .listing-summary span {
          display: block;
          margin-top: 8px;
          color: #ffffff;
          font-size: 18px;
          font-weight: 950;
          line-height: 1;
        }

        .messages-inbox-page .listing-open {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 14px;
          border: 1px solid #335473;
          border-radius: 5px;
          background: #102f4b;
          color: #f3f8ff;
          text-decoration: none;
          white-space: nowrap;
          font-size: 11px;
          font-weight: 900;
        }

        .messages-inbox-page .messages-area {
          min-height: 0;
          flex: 1 1 auto;
          overflow: hidden;
        }

        .messages-inbox-page .chat-window {
          height: 100%;
          padding: 0 16px 14px;
          background: transparent;
          overflow-y: auto;
        }

        .messages-inbox-page .chat-window .messages {
          min-height: 100%;
          gap: 18px;
          justify-content: flex-start;
          padding-top: 0;
        }

        .messages-inbox-page .chat-window .date-divider {
          margin: 0 0 14px;
          color: #788da2;
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0;
        }

        .messages-inbox-page .chat-window .date-divider span {
          border: 1px solid #294760;
          border-radius: 999px;
          background: #071a2b;
          padding: 7px 18px;
        }

        .messages-inbox-page .chat-window .date-divider::before,
        .messages-inbox-page .chat-window .date-divider::after {
          background: #172d40;
        }

        .messages-inbox-page .chat-window .row {
          align-items: flex-start;
          gap: 8px;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          max-width: min(440px, 78%);
          min-width: 130px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          border: 0;
          border-radius: 8px;
          padding: 13px 15px 10px;
        }

        .messages-inbox-page .chat-window .own {
          min-width: 210px;
          min-height: 63px;
          margin-left: auto;
          border-bottom-right-radius: 5px;
          background: linear-gradient(180deg, #ff8118 0%, #ff6900 100%);
          box-shadow: 0 20px 40px rgba(255, 105, 0, 0.28);
          color: #ffffff;
        }

        .messages-inbox-page .chat-window .other {
          border-bottom-left-radius: 5px;
          background: #101f2e;
          box-shadow: 0 14px 30px rgba(0, 8, 20, 0.24);
          color: #eaf3fc;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          grid-column: 1 / -1;
          margin: 0;
          color: inherit;
          font-size: 12px;
          font-weight: 750;
          line-height: 1.5;
        }

        .messages-inbox-page .chat-window .message-meta,
        .messages-inbox-page .chat-window .outside-time {
          font-size: 10.5px;
          font-weight: 850;
          line-height: 1;
        }

        .messages-inbox-page .chat-window .message-meta {
          justify-self: end;
          margin: 0;
          color: rgba(255, 255, 255, 0.86);
        }

        .messages-inbox-page .chat-window .outside-time {
          align-self: flex-end;
          margin: 0 0 4px -2px;
          color: #7f93a6;
        }

        .messages-inbox-page .input-area {
          flex: 0 0 auto;
          padding-top: 8px;
        }

        .messages-inbox-page .input-area .wrapper {
          gap: 8px;
        }

        .messages-inbox-page .input-area form {
          min-height: 54px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 38px 38px 42px;
          grid-template-rows: 42px;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border: 1px solid #294760;
          border-radius: 5px;
          background: #092034;
          box-shadow: none;
        }

        .messages-inbox-page .input-area form > input[type="file"] {
          display: none;
        }

        .messages-inbox-page .input-area form > input:not([type="file"]) {
          grid-column: 1;
          grid-row: 1;
          width: 100%;
          height: 42px;
          min-width: 0;
          padding: 0 12px;
          border: 1px solid #335473;
          border-radius: 5px;
          background: #071a2b;
          color: #f3f8ff;
          box-shadow: none;
          font-size: 12px;
          font-weight: 800;
        }

        .messages-inbox-page .input-area form > input:not([type="file"])::placeholder {
          color: #8ea1b4;
          opacity: 1;
        }

        .messages-inbox-page .input-area .tools {
          display: contents;
        }

        .messages-inbox-page .input-area .tool {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 5px;
          background: #102f4b;
          color: #aac2d7;
          box-shadow: none;
        }

        .messages-inbox-page .input-area .tools .tool:nth-child(1) {
          grid-column: 2;
          grid-row: 1;
        }

        .messages-inbox-page .input-area .tools .tool:nth-child(2) {
          display: none;
        }

        .messages-inbox-page .input-area .tools .tool:nth-child(3) {
          grid-column: 3;
          grid-row: 1;
        }

        .messages-inbox-page .input-area .send {
          display: flex;
          grid-column: 4;
          grid-row: 1;
          width: 42px;
          height: 42px;
          min-width: 42px;
          border: 1px solid #69a2ff;
          border-radius: 5px;
          background: linear-gradient(135deg, #347fff 0%, #245fdf 100%);
          color: #ffffff;
          box-shadow: none;
        }

        .messages-inbox-page .input-area .send svg {
          width: 22px;
          height: 22px;
        }

        .messages-inbox-page .messages-info-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 10px;
          overflow-y: auto;
        }

        .messages-inbox-page .messages-info-card {
          display: grid;
          gap: 12px;
          padding: 14px;
          border: 1px solid #294760;
          border-radius: 6px;
          background: #061522;
          box-shadow: none;
        }

        .messages-inbox-page .messages-info-card h2 {
          margin: 0;
          color: #f7fbff;
          font-size: 14px;
          font-weight: 950;
          line-height: 1.2;
        }

        .messages-inbox-page .messages-info-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .messages-inbox-page .messages-info-card-head button {
          width: 24px;
          height: 24px;
          min-height: 0;
          border: 0;
          border-radius: 5px;
          background: transparent;
          color: #bdcddd;
          box-shadow: none;
        }

        .messages-inbox-page .messages-info-listing,
        .messages-inbox-page .messages-info-seller {
          min-width: 0;
          display: grid;
          grid-template-columns: 66px minmax(0, 1fr);
          align-items: center;
          gap: 12px;
        }

        .messages-inbox-page .messages-info-listing img {
          width: 66px;
          height: 56px;
          display: block;
          border-radius: 5px;
          object-fit: cover;
        }

        .messages-inbox-page .messages-info-listing strong,
        .messages-inbox-page .messages-info-seller strong {
          display: block;
          overflow: hidden;
          color: #f7fbff;
          font-size: 13px;
          font-weight: 950;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .messages-info-listing span {
          display: block;
          margin-top: 8px;
          color: #ffffff;
          font-size: 19px;
          font-weight: 950;
          line-height: 1;
        }

        .messages-inbox-page .messages-info-primary,
        .messages-inbox-page .messages-info-secondary {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 12px;
          border: 1px solid #335473;
          border-radius: 5px;
          background: #092034;
          color: #f3f8ff;
          box-shadow: none;
          text-decoration: none;
          font-size: 11px;
          font-weight: 900;
        }

        .messages-inbox-page .messages-info-primary {
          border-color: #ff8c28;
          background: linear-gradient(135deg, #ff871a 0%, #ff6900 100%);
          color: #ffffff;
        }

        .messages-inbox-page .messages-info-seller {
          grid-template-columns: 50px minmax(0, 1fr);
        }

        .messages-inbox-page .messages-info-seller .avatar {
          width: 48px;
          height: 48px;
        }

        .messages-inbox-page .messages-info-seller small,
        .messages-inbox-page .messages-info-seller em {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 6px;
          overflow: hidden;
          color: #bdc9d6;
          font-size: 10px;
          font-style: normal;
          font-weight: 800;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .messages-info-seller small svg,
        .messages-inbox-page .safety-info-card h2 svg {
          color: #ff8a1d;
          fill: currentColor;
        }

        .messages-inbox-page .safety-info-card h2 {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .messages-inbox-page .safety-info-card p {
          margin: 0;
          color: #aab9c8;
          font-size: 11px;
          font-weight: 650;
          line-height: 1.55;
        }

        .messages-inbox-page .safety-info-card a {
          color: #ff8a1d;
          font-weight: 900;
        }

        .messages-inbox-page .messages-login-panel,
        .messages-inbox-page .messages-empty {
          min-height: 100%;
          display: grid;
          place-content: center;
          justify-items: center;
          gap: 12px;
          color: #d8e6f3;
          text-align: center;
        }

        @media (max-width: 1180px) {
          .messages-inbox-page .messages-desktop-shell {
            grid-template-columns: 320px minmax(0, 1fr);
          }

          .messages-inbox-page .messages-info-panel {
            display: none;
          }
        }

        @media (max-width: 760px) {
          body .messages-inbox-page.messages-page {
            height: calc(100dvh - var(--topbar-h, 56px));
            padding: 10px;
          }

          .messages-inbox-page .messages-desktop-shell {
            width: 100%;
            height: calc(100dvh - var(--topbar-h, 56px) - 20px);
            grid-template-columns: minmax(0, 1fr);
          }

          .messages-inbox-page .messages-sidebar,
          .messages-inbox-page .chat-wrapper {
            grid-column: 1;
            grid-row: 1;
          }

          .messages-inbox-page .chat-wrapper {
            display: none;
          }

          .messages-inbox-page.mobile-conversation-open .messages-sidebar {
            display: none;
          }

          .messages-inbox-page.mobile-conversation-open .chat-wrapper {
            display: flex;
          }

          .messages-inbox-page .messages-sidebar {
            padding: 18px 12px 12px;
          }

          .messages-inbox-page .message-tabs {
            margin-bottom: 14px;
          }

          .messages-inbox-page .header {
            gap: 10px;
          }

          .messages-inbox-page .mobile-chat-back {
            display: none;
          }

          .messages-inbox-page .chat-listing-strip {
            grid-template-columns: 58px minmax(0, 1fr);
          }

          .messages-inbox-page .listing-thumb,
          .messages-inbox-page .listing-thumb img {
            width: 52px;
            height: 46px;
          }

          .messages-inbox-page .listing-open {
            grid-column: 1 / -1;
            width: 100%;
          }

          .messages-inbox-page .chat-window {
            padding: 0 4px 12px;
          }

          .messages-inbox-page .chat-window .own,
          .messages-inbox-page .chat-window .other {
            max-width: 86%;
          }

          .messages-inbox-page .input-area form {
            grid-template-columns: minmax(0, 1fr) 34px 34px 38px;
            gap: 6px;
            padding: 6px;
          }

          .messages-inbox-page .input-area form > input:not([type="file"]) {
            height: 40px;
          }

          .messages-inbox-page .input-area .tool {
            width: 32px;
            height: 32px;
          }

          .messages-inbox-page .input-area .send {
            width: 38px;
            min-width: 38px;
            height: 40px;
          }

          .messages-inbox-page .input-area {
            margin: 0 -10px -10px;
            padding: 8px 10px calc(10px + env(safe-area-inset-bottom, 0px));
            background: #061522;
            border-top: 1px solid rgba(80, 120, 155, 0.42);
          }

          .messages-inbox-page .input-area form {
            width: 100%;
          }
        }

        .messages-inbox-page .messages-area.inbox-preview-area {
          position: relative;
          border-top: 1px solid rgba(35, 62, 84, 0.58);
          background:
            radial-gradient(520px 260px at 72% 24%, rgba(19, 60, 88, 0.16), transparent 70%),
            #061522;
        }

        .messages-inbox-page .messages-area.inbox-preview-area::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(6, 21, 34, 0.9), transparent 18%, transparent 82%, rgba(6, 21, 34, 0.9));
        }

        .messages-inbox-page .chat-window {
          position: relative;
          z-index: 1;
          padding: 22px 28px 16px;
        }

        .messages-inbox-page .chat-window .messages {
          gap: 20px;
        }

        .messages-inbox-page .chat-window .message-avatar {
          display: none;
        }

        .messages-inbox-page .chat-window .row {
          min-height: auto;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          min-height: 62px;
          border-radius: 8px;
          padding: 14px 16px 10px;
        }

        .messages-inbox-page .chat-window .own {
          width: min(520px, 74%);
          min-width: min(360px, 74%);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 34%),
            linear-gradient(180deg, #ff8318 0%, #ff6900 100%);
          box-shadow:
            0 24px 44px rgba(255, 105, 0, 0.28),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset;
        }

        .messages-inbox-page .chat-window .other {
          width: fit-content;
          min-width: 132px;
          max-width: min(360px, 74%);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 44%),
            #101f2e;
          box-shadow:
            0 16px 32px rgba(0, 8, 20, 0.28),
            0 0 0 1px rgba(255, 255, 255, 0.025) inset;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          align-self: start;
          grid-column: 1 / -1;
          padding-right: 0;
          font-size: 12px;
          font-weight: 760;
          line-height: 1.45;
        }

        .messages-inbox-page .chat-window .message-meta {
          grid-column: 2;
          align-self: end;
          justify-self: end;
          gap: 5px;
          margin-top: 2px;
        }

        .messages-inbox-page .chat-window .read-state {
          width: 14px;
          min-width: 14px;
          height: 14px;
        }

        .messages-inbox-page .chat-window .read-state svg {
          width: 14px;
          height: 14px;
        }

        .messages-inbox-page .chat-window .outside-time {
          align-self: center;
          margin: 0 0 0 0;
          color: #7f93a6;
        }

        .messages-inbox-page .chat-wrapper {
          background: #061522;
        }

        .messages-inbox-page .chat-listing-strip {
          margin-bottom: 0;
        }

        .messages-inbox-page .input-area {
          border-top: 1px solid rgba(35, 62, 84, 0.58);
          padding-top: 8px;
        }

        @media (max-width: 760px) {
          .messages-inbox-page .chat-window {
            padding: 18px 10px 14px;
          }

          .messages-inbox-page .chat-window .own {
            width: min(320px, 88%);
            min-width: min(240px, 88%);
          }

          .messages-inbox-page .chat-window .other {
            max-width: min(320px, 88%);
          }
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          width: fit-content;
          min-width: 0;
          max-width: min(420px, 78%);
          min-height: 0;
        }

        .messages-inbox-page .chat-window .own {
          margin-left: 0;
        }

        .messages-inbox-page .chat-window .own-row {
          justify-content: flex-end;
        }

        @media (max-width: 760px) {
          .messages-inbox-page .chat-window .own,
          .messages-inbox-page .chat-window .other {
            max-width: 88%;
          }
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .other {
          gap: 6px;
          max-width: min(380px, 76%);
          padding: 9px 11px 7px;
        }

        .messages-inbox-page .chat-window .own p,
        .messages-inbox-page .chat-window .other p {
          font-size: 11px;
          line-height: 1.35;
        }

        .messages-inbox-page .chat-window .message-meta {
          font-size: 10px;
          gap: 4px;
          margin-top: 0;
        }

        .messages-inbox-page .chat-window .read-state,
        .messages-inbox-page .chat-window .read-state svg {
          height: 13px;
        }

        .messages-inbox-page .chat-window .read-state {
          width: 18px;
          min-width: 18px;
          gap: 0;
        }

        .messages-inbox-page .chat-window .read-state svg {
          width: 13px;
          min-width: 13px;
        }

        .messages-inbox-page .chat-window .read-check-second {
          margin-left: -5px;
        }

        .messages-inbox-page .chat-window .read-state {
          color: rgba(255, 255, 255, 0.86);
        }

        .messages-inbox-page .chat-window .message-meta.is-read .read-state {
          color: #38a7ff;
        }

        .messages-inbox-page .chat-window .own {
          align-items: end;
          column-gap: 8px;
          grid-template-columns: auto auto;
        }

        .messages-inbox-page .chat-window .own p {
          grid-column: 1;
          line-height: 1.3;
        }

        .messages-inbox-page .chat-window .own .message-meta {
          grid-column: 2;
          align-self: end;
          margin-left: 1px;
        }

        .messages-inbox-page .chat-window .read-state {
          width: 16px;
          min-width: 16px;
          height: 12px;
          gap: 1px;
          position: relative;
          transform: translateY(-1px);
        }

        .messages-inbox-page .chat-window .read-tick {
          border-bottom: 1.55px solid currentColor;
          border-right: 1.55px solid currentColor;
          display: block;
          flex: 0 0 auto;
          height: 7px;
          position: absolute;
          top: 1px;
          transform: rotate(45deg);
          width: 4.2px;
        }

        .messages-inbox-page .chat-window .read-tick:first-of-type {
          left: 2px;
        }

        .messages-inbox-page .chat-window .read-tick:nth-of-type(2) {
          left: 7px;
        }

        .messages-inbox-page .chat-window .read-state svg {
          width: 12px;
          min-width: 12px;
          height: 12px;
        }

        .messages-inbox-page .chat-window .read-check-second {
          margin-left: -4px;
        }

        .messages-inbox-page .chat-window .message-meta.is-read .read-state,
        .messages-inbox-page .chat-window .read-state.is-read {
          color: #009dff;
          filter: none;
        }

        .messages-inbox-page .chat-window .message-meta {
          color: rgba(232, 244, 255, 0.72);
          font-size: 10.5px;
          font-variant-numeric: tabular-nums;
          font-weight: 760;
          gap: 4px;
          min-height: 15px;
        }

        .messages-inbox-page .chat-window .read-state {
          color: rgba(232, 244, 255, 0.72);
          height: 15px;
          min-width: 23px;
          width: 23px;
          transform: translateY(-1px);
        }

        .messages-inbox-page .chat-window .read-tick {
          border-bottom: 2.15px solid currentColor;
          border-radius: 0 0 1px 0;
          border-right: 2.15px solid currentColor;
          height: 10px;
          top: 0;
          width: 5.5px;
        }

        .messages-inbox-page .chat-window .read-tick:first-of-type {
          left: 5px;
        }

        .messages-inbox-page .chat-window .read-tick:nth-of-type(2) {
          left: 12px;
        }

        .messages-inbox-page .chat-window .read-state span {
          display: none;
        }

        @media (max-width: 760px) {
          .messages-inbox-page .chat-window .own,
          .messages-inbox-page .chat-window .other {
            max-width: 88%;
            padding: 8px 10px 7px;
          }
        }

        .messages-inbox-page .sidebar-conversation {
          grid-template-columns: 42px minmax(0, 1fr) auto;
          min-height: 62px;
          padding: 8px 40px 8px 8px;
          border-radius: 7px;
          transition:
            background 0.14s ease,
            border-color 0.14s ease,
            box-shadow 0.14s ease;
        }

        .messages-inbox-page .sidebar-listing-group {
          grid-template-columns: 50px minmax(0, 1fr) auto;
          padding-right: 42px;
        }

        .messages-inbox-page .sidebar-avatar.sidebar-listing-avatar,
        .messages-inbox-page .seller-listing-drilldown-header .sidebar-listing-avatar {
          width: 48px;
          height: 44px;
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          overflow: hidden;
          border: 1px solid #36536b;
          border-radius: 6px;
          background: #10283b;
          color: #ff8b2b;
          box-shadow: none;
        }

        .messages-inbox-page .sidebar-listing-avatar img {
          width: 100%;
          height: 100%;
          display: block;
          border-radius: 5px;
          object-fit: cover;
        }

        .messages-inbox-page .listing-conversation-count {
          color: #ffad67;
          font-weight: 850;
        }

        .messages-inbox-page .seller-listing-drilldown-header {
          min-height: 64px;
          display: grid;
          grid-template-columns: 32px 48px minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          margin: 0 0 12px;
          padding: 8px 6px 12px;
          border-bottom: 1px solid #294760;
        }

        .messages-inbox-page .seller-listing-back {
          width: 30px;
          height: 30px;
          display: inline-grid;
          place-items: center;
          padding: 0;
          border: 1px solid rgba(255, 122, 18, 0.45);
          border-radius: 999px;
          background: rgba(255, 122, 18, 0.12);
          color: #ff9a42;
          box-shadow: none;
        }

        .messages-inbox-page .seller-listing-back:hover,
        .messages-inbox-page .seller-listing-back:focus-visible {
          border-color: #ff7a12;
          background: #ff7a12;
          color: #ffffff;
          outline: 0;
        }

        .messages-inbox-page .seller-listing-drilldown-header > div:last-child {
          min-width: 0;
          display: grid;
          gap: 5px;
        }

        .messages-inbox-page .seller-listing-drilldown-header strong,
        .messages-inbox-page .seller-listing-drilldown-header span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .messages-inbox-page .seller-listing-drilldown-header strong {
          color: #f7fbff;
          font-size: 13px;
          font-weight: 950;
        }

        .messages-inbox-page .seller-listing-drilldown-header span {
          color: #ffad67;
          font-size: 11px;
          font-weight: 850;
        }

        .messages-inbox-page .sidebar-conversation.has-notification {
          border-color: rgba(255, 122, 18, 0.82);
          background:
            linear-gradient(90deg, rgba(255, 122, 18, 0.16), rgba(255, 122, 18, 0.04)),
            rgba(14, 22, 33, 0.72);
          box-shadow: inset 3px 0 0 #ff7a12;
        }

        .messages-inbox-page .sidebar-conversation.has-notification:hover {
          background:
            linear-gradient(90deg, rgba(255, 122, 18, 0.22), rgba(255, 122, 18, 0.07)),
            rgba(18, 30, 43, 0.86);
        }

        .messages-inbox-page .sidebar-conversation.active {
          border-color: #ff7a12;
          background:
            linear-gradient(90deg, rgba(255, 122, 18, 0.17), rgba(255, 122, 18, 0.06)),
            #171c24;
        }

        .messages-inbox-page .sidebar-copy {
          gap: 4px;
        }

        .messages-inbox-page .sidebar-copy strong {
          font-size: 14px;
          line-height: 1.05;
        }

        .messages-inbox-page .sidebar-copy time {
          color: #9db2c5;
          font-size: 11px;
          font-weight: 850;
        }

        .messages-inbox-page .sidebar-copy p {
          color: #aebfce;
          font-size: 11.5px;
          line-height: 1.2;
        }

        .messages-inbox-page .sidebar-unread {
          position: absolute;
          right: 13px;
          bottom: 9px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          background: #ff7412;
          font-size: 10px;
        }

        .messages-inbox-page .sidebar-dismiss-notification {
          position: absolute;
          top: 7px;
          right: 8px;
          z-index: 2;
          width: 22px;
          height: 22px;
          display: inline-grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 999px;
          background: rgba(4, 14, 24, 0.78);
          color: rgba(238, 247, 255, 0.84);
          cursor: pointer;
          opacity: 0.78;
          transition:
            opacity 0.14s ease,
            background 0.14s ease,
            color 0.14s ease,
            border-color 0.14s ease;
        }

        .messages-inbox-page .sidebar-dismiss-notification:hover,
        .messages-inbox-page .sidebar-dismiss-notification:focus-visible {
          opacity: 1;
          border-color: rgba(255, 122, 18, 0.72);
          background: #ff7412;
          color: #ffffff;
          outline: 0;
        }

        .messages-inbox-page .sidebar-conversation {
          cursor: pointer;
          padding-right: 66px;
        }

        .messages-inbox-page .sidebar-conversation:focus-visible {
          outline: 2px solid rgba(255, 122, 18, 0.76);
          outline-offset: 2px;
        }

        .messages-inbox-page .sidebar-actions {
          align-items: center;
          display: inline-flex;
          gap: 8px;
          position: absolute;
          right: 7px;
          top: 7px;
          z-index: 4;
        }

        .messages-inbox-page .sidebar-profile-link {
          align-items: center;
          appearance: none;
          background: rgba(4, 14, 24, 0.62);
          border: 1px solid rgba(80, 120, 155, 0.34);
          border-radius: 6px;
          color: #f5f8fb;
          cursor: pointer;
          display: inline-flex;
          gap: 6px;
          height: 30px;
          justify-content: center;
          line-height: 1;
          padding: 0 10px;
          text-decoration: none;
          transition:
            background 0.14s ease,
            border-color 0.14s ease,
            color 0.14s ease,
            transform 0.14s ease;
          width: auto;
        }

        .messages-inbox-page .sidebar-profile-link svg {
          color: #ff9a24;
          flex: 0 0 auto;
        }

        .messages-inbox-page .sidebar-profile-link span {
          display: inline;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0;
          line-height: 1;
        }

        .messages-inbox-page .sidebar-delete-conversation {
          align-items: center;
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          color: #ff4d4d;
          cursor: pointer;
          display: inline-flex;
          height: 18px;
          justify-content: center;
          line-height: 1;
          padding: 0;
          width: 18px;
        }

        .messages-inbox-page .sidebar-delete-conversation svg {
          height: 12px;
          width: 12px;
        }

        .messages-inbox-page .sidebar-profile-link:hover,
        .messages-inbox-page .sidebar-profile-link:focus-visible {
          background: rgba(255, 122, 18, 0.18);
          border-color: rgba(255, 122, 18, 0.72);
          color: #ff9a3c;
          outline: 0;
        }

        .messages-inbox-page .sidebar-delete-conversation:hover,
        .messages-inbox-page .sidebar-delete-conversation:focus-visible {
          background: transparent;
          border-color: transparent;
          color: #ff2f2f;
          outline: 0;
        }

        .messages-inbox-page .sidebar-conversation .sidebar-unread {
          right: 12px;
          top: 38px;
          bottom: auto;
        }

        .messages-inbox-page .header-profile-link {
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 999px;
          color: #ff9a24;
          display: inline-flex;
          flex: 0 0 auto;
          gap: 6px;
          font-size: 11px;
          font-weight: 900;
          margin-left: auto;
          min-height: 30px;
          padding: 0 4px;
          text-decoration: none;
          transition:
            background 0.14s ease,
            color 0.14s ease;
        }

        .messages-inbox-page .header-profile-link svg {
          color: #ff9a24;
          height: 15px;
          width: 15px;
        }

        .messages-inbox-page .header-profile-link:hover,
        .messages-inbox-page .header-profile-link:focus-visible {
          background: rgba(255, 122, 18, 0.13);
          color: #ffffff;
          outline: 0;
        }

        @media (max-width: 640px) {
          .messages-inbox-page .header-profile-link span {
            display: none;
          }

          .messages-inbox-page .header-profile-link {
            height: 32px;
            justify-content: center;
            padding: 0;
            width: 32px;
          }
        }

        /* Image messages: show the uploaded image as the message, not as a tiny thumbnail inside an orange bubble. */
        .messages-inbox-page .chat-window .row:has(.message-image-button) {
          min-height: 0;
          padding: 5px 0;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button),
        .messages-inbox-page .chat-window .other:has(.message-image-button),
        .messages-inbox-page .chat-window .image-only {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 6px;
          max-width: min(430px, 72%);
          min-width: min(220px, 54vw);
          padding: 6px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 48%),
            rgba(9, 24, 40, 0.9);
          border: 1px solid rgba(98, 145, 187, 0.34);
          border-radius: 10px;
          box-shadow:
            0 16px 34px rgba(0, 7, 18, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.045);
          color: rgba(230, 242, 255, 0.86);
          overflow: visible;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) {
          border-color: rgba(255, 185, 116, 0.48);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.09), transparent 36%),
            linear-gradient(180deg, #ff851a 0%, #ff6900 100%);
          box-shadow:
            0 18px 38px rgba(255, 105, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) {
          justify-items: end;
          margin-left: auto;
        }

        .messages-inbox-page .chat-window .other:has(.message-image-button) {
          justify-items: start;
          margin-right: auto;
        }

        .messages-inbox-page .chat-window .message-image-button {
          appearance: none;
          background: rgba(4, 15, 28, 0.72);
          border: 0;
          border-radius: 8px;
          box-shadow: none;
          cursor: zoom-in;
          display: block;
          line-height: 0;
          overflow: hidden;
          padding: 0;
          width: min(320px, 58vw);
        }

        .messages-inbox-page .chat-window .message-image {
          background:
            radial-gradient(180px 120px at 50% 20%, rgba(255, 122, 18, 0.1), transparent 72%),
            #071826;
          border: 0;
          border-radius: 8px;
          box-shadow: none;
          display: block;
          height: auto;
          max-height: 300px;
          max-width: none;
          min-height: 130px;
          object-fit: contain;
          width: 100%;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) p,
        .messages-inbox-page .chat-window .other:has(.message-image-button) p {
          background: rgba(3, 13, 23, 0.48);
          border: 0;
          border-radius: 7px;
          color: #eef7ff;
          padding: 7px 8px;
          width: 100%;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) p {
          background: transparent;
          color: #ffffff;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) .message-meta {
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 999px;
          color: rgba(255, 244, 232, 0.94);
          display: inline-flex;
          gap: 5px;
          justify-self: end;
          margin-top: 0;
          min-height: 16px;
          padding: 0;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) .read-state {
          height: 12px;
          min-width: 18px;
          opacity: 1;
          transform: translateY(-1px);
          width: 18px;
        }

        .messages-inbox-page .chat-window .own:has(.message-image-button) .read-tick {
          border-bottom-width: 1.65px;
          border-right-width: 1.65px;
          height: 7px;
          width: 4px;
        }

        .messages-inbox-page .chat-window .read-state {
          color: rgba(255, 246, 232, 0.96);
          height: 14px;
          min-width: 18px;
          opacity: 1;
          position: relative;
          transform: translate(5px, -1px);
          width: 18px;
        }

        .messages-inbox-page .chat-window .read-check-icon {
          display: block;
          height: 13px;
          overflow: visible;
          width: 17px;
        }

        .messages-inbox-page .chat-window .read-check-icon path {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2.05;
        }

        .messages-inbox-page .chat-window .message-meta.is-read .read-state,
        .messages-inbox-page .chat-window .read-state.is-read {
          color: #009dff;
        }

        .messages-inbox-page .chat-window .read-tick {
          border-bottom: 2px solid currentColor;
          border-radius: 0 0 1px 0;
          border-right: 2px solid currentColor;
          height: 9px;
          position: absolute;
          top: 0;
          transform: rotate(43deg);
          transform-origin: center;
          width: 5px;
        }

        .messages-inbox-page .chat-window .read-tick:first-of-type {
          left: 2px;
        }

        .messages-inbox-page .chat-window .read-tick:nth-of-type(2) {
          left: 8px;
        }

        .messages-inbox-page .chat-window .message-image-button:hover .message-image {
          transform: none;
        }

        .messages-inbox-page .chat-window .own,
        .messages-inbox-page .chat-window .own:has(.message-image-button),
        .messages-inbox-page .chat-window .image-only.own {
          box-shadow: none;
        }

        .messages-inbox-page .message-tabs {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .messages-inbox-page .message-tabs button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-width: 0;
          white-space: nowrap;
        }

        .messages-inbox-page .message-tabs button span {
          flex: 0 0 auto;
        }

        body .messages-inbox-page.messages-page {
          background: var(--site-bg, var(--bg, #0b1118));
          background-image: none;
        }

        .messages-inbox-page .chat-window .message-meta.is-read .read-state,
        .messages-inbox-page .chat-window .read-state.is-read {
          color: #00b7ff;
          filter: none;
          height: 14px;
          min-width: 18px;
          width: 18px;
        }

        .messages-inbox-page .chat-window .message-meta.is-read .read-tick,
        .messages-inbox-page .chat-window .read-state.is-read .read-tick {
          border-bottom-width: 2px;
          border-right-width: 2px;
          height: 9px;
          width: 5px;
        }

        @media (max-width: 640px) {
          .messages-inbox-page .chat-window .own:has(.message-image-button),
          .messages-inbox-page .chat-window .other:has(.message-image-button),
          .messages-inbox-page .chat-window .image-only {
            max-width: 84%;
            min-width: min(210px, 74vw);
          }

          .messages-inbox-page .chat-window .message-image-button {
            width: min(280px, 76vw);
          }

          .messages-inbox-page .chat-window .message-image {
            max-height: 260px;
            min-height: 120px;
          }
        }
      `}</style>

    </main>

  );

}

export default function MessagesPage() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <MessagesPageContent />
    </Suspense>
  );
}

