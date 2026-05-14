"use client";

import { useRef, useState } from "react";
import {
  ImagePlus,
  Send
} from "lucide-react";

type Props = {
  onSend: (
    message: string,
    image?: string
  ) => void;
};

export default function MessageInput({
  onSend
}: Props) {
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!message.trim() && !preview)
      return;

    onSend(message, preview || undefined);

    setMessage("");
    setPreview(null);
  }

  function handleImage(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setPreview(reader.result as string);
    };

    reader.readAsDataURL(file);
  }

  return (
    <div className="wrapper">
      {preview && (
        <div className="preview">
          <img src={preview} alt="" />

          <button
            onClick={() => setPreview(null)}
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <button
          type="button"
          className="attach"
          onClick={() =>
            fileInputRef.current?.click()
          }
        >
          <ImagePlus size={20} />
        </button>

        <input
          type="file"
          hidden
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImage}
        />

        <input
          value={message}
          onChange={(e) =>
            setMessage(e.target.value)
          }
          placeholder="Kirjoita viesti..."
        />

        <button
          type="submit"
          className="send"
        >
          <Send size={18} />
        </button>
      </form>

      <style jsx>{`
        .wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .preview {
          position: relative;
          width: fit-content;
        }

        .preview img {
          width: 120px;
          height: 120px;
          object-fit: cover;
          border-radius: 18px;
          border: 1px solid rgba(132, 190, 213, 0.34);
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.28);
        }

        .preview button {
          position: absolute;
          top: -8px;
          right: -8px;

          width: 24px;
          height: 24px;

          border: none;
          border-radius: 50%;

          background: #061827;
          color: white;

          cursor: pointer;
        }

        form {
          display: flex;
          align-items: center;
          gap: 12px;

          background:
            linear-gradient(180deg, rgba(225, 239, 248, 0.98), rgba(194, 213, 226, 0.98));

          border: 1px solid rgba(255, 255, 255, 0.62);

          border-radius: 18px;

          padding: 10px 12px;

          box-shadow:
            0 18px 44px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.76);
        }

        .attach {
          width: 42px;
          height: 42px;

          border: none;
          border-radius: 14px;

          background:
            linear-gradient(180deg, #ffffff, #dfeaf3);

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;

          color: #0a304d;

          transition: 0.2s;
        }

        .attach:hover {
          background: #ff8418;
          color: #ffffff;
          transform: translateY(-1px);
        }

        input[type="text"],
        input:not([type]) {
          flex: 1;

          border: none;
          background: transparent;

          font-size: 15px;
          font-weight: 700;
          color: #071f34;

          outline: none;
        }

        input[type="text"]::placeholder,
        input:not([type])::placeholder {
          color: #617586;
          opacity: 1;
        }

        .send {
          width: 42px;
          height: 42px;

          border: none;
          border-radius: 14px;

          background: linear-gradient(
            135deg,
            #ff9b24,
            #ff650a
          );

          color: white;

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;

          transition: 0.2s;
        }

        .send:hover {
          transform: translateY(-1px) scale(1.03);
          box-shadow: 0 12px 26px rgba(255, 111, 10, 0.36);
        }
      `}</style>
    </div>
  );
}
