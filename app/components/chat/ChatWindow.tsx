import {
  useEffect,
  useRef
} from "react";

import MessageBubble from "./MessageBubble";

type Message = {
  id: string;
  content?: string;
  image?: string;
  own?: boolean;
};

type Props = {
  messages: Message[];
};

export default function ChatWindow({
  messages
}: Props) {

  const bottomRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "end"
    });
  }, [messages]);

  return (
    <div className="chat-window">
      <div className="messages">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            content={message.content}
            image={message.image}
            own={message.own}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <style jsx>{`
        .chat-window {
          height: 100%;
          overflow-y: auto;

          padding: 28px;

          background:
            radial-gradient(circle at top left, rgba(255, 139, 31, 0.1), transparent 34%),
            linear-gradient(180deg, rgba(7, 33, 55, 0.98), rgba(4, 18, 31, 0.98));
        }

        .messages {
          max-width: 820px;
          margin: 0 auto;

          display: flex;
          flex-direction: column;
          gap: 14px;
        }
      `}</style>
    </div>
  );
}
