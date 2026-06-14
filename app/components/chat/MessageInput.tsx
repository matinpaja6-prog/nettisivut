"use client";

import { useRef, useState } from "react";
import {
  Camera,
  Paperclip,
  Send,
  Smile,
  X
} from "lucide-react";
import { resizeMessageImageTo1080p } from "./image-processing";

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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const emojis = [
    "😀",
    "😁",
    "😂",
    "🙂",
    "👍",
    "👌",
    "🙏",
    "🔥",
    "❤️",
    "✅",
    "💰",
    "📦",
    "🚚",
    "🔧",
    "🏁",
    "❄️"
  ];

  function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if ((!message.trim() && !preview) || imageLoading)
      return;

    onSend(message, preview || undefined);

    setMessage("");
    setPreview(null);
    setEmojiOpen(false);
  }

  async function readImageFile(file: File | undefined | null) {
    if (!file || !file.type.startsWith("image/")) return;

    setImageLoading(true);

    try {
      setPreview(await resizeMessageImageTo1080p(file));
    } finally {
      setImageLoading(false);
    }
  }

  function handleImage(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    void readImageFile(e.target.files?.[0]);
    e.target.value = "";
  }

  function handleDragEnter(
    e: React.DragEvent<HTMLDivElement>
  ) {
    if (!hasImageFile(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingImage(true);
  }

  function handleDragOver(
    e: React.DragEvent<HTMLDivElement>
  ) {
    if (!hasImageFile(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDraggingImage(true);
  }

  function handleDragLeave(
    e: React.DragEvent<HTMLDivElement>
  ) {
    if (!hasImageFile(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingImage(false);
    }
  }

  function handleDrop(
    e: React.DragEvent<HTMLDivElement>
  ) {
    if (!hasImageFile(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingImage(false);
    void readImageFile([...e.dataTransfer.files].find((file) => file.type.startsWith("image/")));
  }

  return (
    <div
      className={`wrapper${isDraggingImage ? " isDraggingImage" : ""}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {imageLoading && (
        <div className="preview loadingPreview">
          <div className="loadingThumb" />

          <div className="previewText">
            <strong>Kuva kasitellaan</strong>
            <span>Muunnetaan 1080p-kokoon</span>
          </div>
        </div>
      )}

      {preview && !imageLoading && (
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

      {emojiOpen && (
        <div className="emojiPicker" aria-label="Emojit">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() =>
                setMessage((current) => `${current}${emoji}`)
              }
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
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

        <div className="tools">
          <button
            type="button"
            className="tool"
            aria-label="Liitä tiedosto"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <Paperclip size={15} />
          </button>

          <button
            type="button"
            className="tool"
            aria-label="Lisää kuva"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <Camera size={15} />
          </button>

          <button
            type="button"
            className="tool"
            aria-label="Emoji"
            onClick={() =>
              setEmojiOpen((open) => !open)
            }
          >
            <Smile size={15} />
          </button>
        </div>

        <button
          type="submit"
          className="send"
          disabled={imageLoading}
        >
          <Send size={18} />
        </button>
      </form>

      <style jsx>{`
        .wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
        }

        .wrapper::after {
          align-items: center;
          background:
            radial-gradient(180px 70px at 50% 0%, rgba(255, 122, 26, 0.18), transparent 72%),
            rgba(5, 18, 32, 0.86);
          border: 1px dashed rgba(255, 154, 60, 0.72);
          border-radius: 10px;
          color: #ffffff;
          content: "Pudota kuva viestiin";
          display: flex;
          font-size: 12px;
          font-weight: 900;
          inset: 0;
          justify-content: center;
          opacity: 0;
          pointer-events: none;
          position: absolute;
          transition: opacity 0.14s ease;
          z-index: 3;
        }

        .wrapper.isDraggingImage::after {
          opacity: 1;
        }

        .wrapper.isDraggingImage form {
          border-color: rgba(255, 154, 60, 0.92);
          box-shadow: 0 0 0 3px rgba(255, 122, 26, 0.12);
        }

        .loadingPreview {
          pointer-events: none;
        }

        .loadingThumb {
          background:
            linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.18), rgba(255,255,255,0.06)),
            rgba(255, 255, 255, 0.06);
          background-size: 180% 100%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          height: 44px;
          width: 56px;
          animation: loadingImage 1.1s ease-in-out infinite;
        }

        @keyframes loadingImage {
          from {
            background-position: 120% 0;
          }

          to {
            background-position: -80% 0;
          }
        }

        .preview {
          position: relative;
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          width: min(360px, 100%);
          padding: 8px 10px 8px 8px;
          border: 1px solid rgba(255, 154, 60, 0.36);
          border-radius: 14px;
          background:
            linear-gradient(180deg, rgba(18, 43, 67, 0.98), rgba(9, 26, 44, 0.98));
          box-shadow: 0 10px 26px rgba(0, 8, 20, 0.2);
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
          color: #ffffff;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.1;
        }

        .previewText span {
          color: rgba(218, 234, 249, 0.72);
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

        .emojiPicker {
          align-self: flex-start;
          display: grid;
          grid-template-columns: repeat(8, 30px);
          gap: 5px;
          padding: 8px;
          border: 1px solid rgba(80, 120, 155, 0.52);
          border-radius: 8px;
          background: rgba(7, 20, 34, 0.98);
          box-shadow: 0 18px 38px rgba(0, 8, 20, 0.34);
        }

        .emojiPicker button {
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          font-size: 17px;
          line-height: 1;
        }

        .emojiPicker button:hover {
          background: rgba(126, 197, 240, 0.12);
        }

        form {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 38px;
          grid-template-rows: minmax(40px, auto) 24px;
          align-items: end;
          gap: 4px 10px;
          background: linear-gradient(180deg, rgba(11, 28, 46, 0.95), rgba(7, 21, 36, 0.98));
          border: 1px solid rgba(80, 120, 155, 0.52);
          border-radius: 6px;
          padding: 9px 8px 7px 12px;
          box-shadow: none;
        }

        input[type="text"],
        input:not([type]) {
          grid-column: 1 / -1;
          grid-row: 1;
          min-width: 0;
          width: 100%;
          height: 32px;
          padding: 0 4px;

          border: 0;
          border-radius: 0;
          background: transparent;

          font-size: 12px;
          font-weight: 700;
          color: #f4f8fc;

          outline: none;
          box-shadow: none;
        }

        input[type="text"]::placeholder,
        input:not([type])::placeholder {
          color: rgba(199, 218, 236, 0.72);
          opacity: 1;
        }

        .tools {
          grid-column: 1;
          grid-row: 2;
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 22px;
        }

        .tool {
          width: 20px;
          height: 20px;
          border: 0;
          border-radius: 5px;
          background: transparent;
          color: rgba(202, 221, 238, 0.82);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: color 0.15s ease, background 0.15s ease;
        }

        .tool:hover {
          background: rgba(126, 197, 240, 0.1);
          color: #ffffff;
        }

        .send {
          grid-column: 2;
          grid-row: 2;
          width: 30px;
          min-width: 30px;
          height: 30px;

          border: 1px solid rgba(255, 190, 124, 0.42);
          border-radius: 6px;

          background: linear-gradient(135deg, #247cff 0%, #1d6ee8 55%, #165bd0 100%);

          color: white;
          box-shadow:
            0 12px 26px rgba(29, 110, 232, 0.32),
            inset 0 1px 0 rgba(255, 255, 255, 0.24);

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;

          transition: 0.2s;
        }

        .send:hover {
          transform: translateY(-1px) scale(1.03);
          box-shadow: 0 18px 34px rgba(29, 110, 232, 0.34);
        }

        @media (max-width: 640px) {
          form {
            grid-template-columns: minmax(0, 1fr) 34px;
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
}

function hasImageFile(dataTransfer: DataTransfer) {
  return [...dataTransfer.items].some((item) =>
    item.kind === "file" && item.type.startsWith("image/")
  );
}
