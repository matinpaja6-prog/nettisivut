import {
  Fragment,
  useEffect,
  useRef
} from "react";

import type { Locale } from "@/lib/i18n";
import MessageBubble from "./MessageBubble";

type Message = {
  id: string;
  content?: string;
  image?: string;
  own?: boolean;
  created_at?: string;
  read?: boolean;
};

type Props = {
  messages: Message[];
  locale: Locale;
  otherAvatarUrl?: string | null;
  otherName?: string;
};

const dateDividerCopy = {
  fi: {
    messages: "VIESTIT",
    today: "TÄNÄÄN",
    yesterday: "EILEN"
  },
  no: {
    messages: "MELDINGER",
    today: "I DAG",
    yesterday: "I GÅR"
  }
} as const;

const dateLocales: Record<Locale, string> = {
  fi: "fi-FI",
  en: "en-GB",
  sv: "sv-SE",
  no: "nb-NO"
};

function getLocalDateKey(value?: string) {
  const date = new Date(value || "");

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateDivider(value: string | undefined, locale: Locale) {
  const copy = dateDividerCopy[locale === "no" ? "no" : "fi"];
  const date = new Date(value || "");

  if (Number.isNaN(date.getTime())) {
    return copy.messages;
  }

  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const messageDayStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const dayDiff = Math.round(
    (todayStart.getTime() - messageDayStart.getTime()) / 86_400_000
  );

  if (dayDiff === 0) {
    return copy.today;
  }

  if (dayDiff === 1) {
    return copy.yesterday;
  }

  return new Intl.DateTimeFormat(
    dateLocales[locale],
    {
      day: "numeric",
      month: "long",
      year: date.getFullYear() === now.getFullYear() ? undefined : "numeric"
    }
  ).format(date).toLocaleUpperCase(dateLocales[locale]);
}

export default function ChatWindow({
  messages,
  locale,
  otherAvatarUrl,
  otherName = ""
}: Props) {

  const bottomRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "end"
    });
  }, [messages]);

  return (
    <div
      className="chat-window chat-window-redesign"
      data-no-auto-translate={locale === "no" ? "true" : undefined}
    >
      <div className="messages">
        {messages.map((message, index) => {
          const currentDateKey = getLocalDateKey(message.created_at);
          const previousDateKey =
            index > 0 ? getLocalDateKey(messages[index - 1]?.created_at) : "";
          const showDateDivider = index === 0 || currentDateKey !== previousDateKey;

          return (
            <Fragment key={message.id}>
              {showDateDivider && (
                <div className="date-divider">
                  <span>{formatDateDivider(message.created_at, locale)}</span>
                </div>
              )}
              <MessageBubble
                content={message.content}
                image={message.image}
                own={message.own}
                createdAt={message.created_at}
                read={message.read}
                otherAvatarUrl={otherAvatarUrl}
                otherName={otherName}
                locale={locale}
              />
            </Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <style jsx>{`
        .chat-window {
          height: 100%;
          overflow-y: auto;
          padding: 26px clamp(18px, 4vw, 54px) 18px;
          width: 100%;
          background:
            radial-gradient(520px 320px at 68% 28%, rgba(26, 85, 118, 0.16), transparent 72%),
            linear-gradient(180deg, #061522 0%, #061522 100%);
        }

        .messages {
          width: 100%;
          max-width: none;
          margin: 0;

          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .date-divider {
          align-items: center;
          color: rgba(160, 176, 194, 0.7);
          display: grid;
          font-size: 11px;
          font-weight: 900;
          gap: 14px;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          letter-spacing: 0.12em;
          margin: 0 0 12px;
          text-align: center;
        }

        .date-divider::before,
        .date-divider::after {
          background: linear-gradient(90deg, transparent, rgba(77, 105, 133, 0.52), transparent);
          content: "";
          height: 1px;
        }

        .date-divider span {
          background: rgba(7, 21, 36, 0.82);
          border: 1px solid rgba(69, 98, 128, 0.42);
          border-radius: 999px;
          padding: 7px 18px;
        }

        @media (max-width: 640px) {
          .chat-window {
            padding: 18px 10px 14px;
          }
        }
      `}</style>
    </div>
  );
}
