"use client";

import { useRef, useState } from "react";
import {
  ImagePlus,
  Send,
  X
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

          <div className="previewText">
            <strong>Kuva valittu</strong>
            <span>Lähetä viestin mukana</span>
          </div>

          <button
            type="button"
            aria-label="Poista kuva"
            onClick={() => setPreview(null)}
          >
            <X size={14} />
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
          gap: 8px;
        }

        .preview {
          position: relative;
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          width: min(360px, 100%);
          padding: 8px 10px 8px 8px;
          border: 1px solid rgba(255, 122, 26, 0.38);
          border-radius: 14px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(244, 248, 252, 0.96));
          box-shadow: 0 10px 26px rgba(0, 8, 20, 0.12);
        }

        .preview img {
          width: 56px;
          height: 56px;
          object-fit: cover;
          border-radius: 10px;
          border: 1px solid rgba(203, 213, 225, 0.9);
          box-shadow: none;
        }

        .previewText {
          display: flex;
          flex-direction: column;
          min-width: 0;
          gap: 2px;
        }

        .previewText strong {
          color: #0f172a;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.1;
        }

        .previewText span {
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .preview button {
          width: 30px;
          height: 30px;
          border: 1px solid rgba(239, 68, 68, 0.22);
          border-radius: 999px;
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
        }

        .preview button:hover {
          background: #ef4444;
          color: #ffffff;
          transform: translateY(-1px);
        }

        form {
          display: flex;
          align-items: center;
          gap: 7px;
          background: #ffffff;
          border: 1px solid #dbe5ef;
          border-radius: 10px;
          padding: 6px;
          box-shadow: none;
        }

        .attach {
          width: 38px;
          height: 38px;

          border: none;
          border-radius: 8px;

          background: #f1f5f9;

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;

          color: #475569;

          transition: 0.2s;
        }

        .attach:hover {
          background: #e2e8f0;
          color: #0f172a;
          transform: translateY(-1px);
        }

        input[type="text"],
        input:not([type]) {
          flex: 1;
          min-width: 0;
          height: 38px;
          padding: 0 12px;

          border: 1px solid #dbe5ef;
          border-radius: 8px;
          background: #ffffff;

          font-size: 14px;
          font-weight: 650;
          color: #0f172a;

          outline: none;
        }

        input[type="text"]::placeholder,
        input:not([type])::placeholder {
          color: #617586;
          opacity: 1;
        }

        .send {
          width: 38px;
          height: 38px;

          border: none;
          border-radius: 8px;

          background: #ff7a1a;

          color: white;

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;

          transition: 0.2s;
        }

        .send:hover {
          transform: translateY(-1px) scale(1.03);
          box-shadow: 0 10px 22px rgba(255, 122, 26, 0.24);
        }
      `}</style>
    </div>
  );
}
