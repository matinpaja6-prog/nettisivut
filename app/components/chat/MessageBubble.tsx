"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import {
  X
} from "lucide-react";

type Props = {
  content?: string;
  image?: string;
  own?: boolean;
  createdAt?: string;
  read?: boolean;
  otherAvatarUrl?: string | null;
  otherName?: string;
};

export default function MessageBubble({
  content,
  image,
  own,
  createdAt,
  read,
  otherAvatarUrl,
  otherName = ""
}: Props) {
  const [expandedImage, setExpandedImage] =
    useState(false);
  const [zoomed, setZoomed] =
    useState(false);
  const [zoomOrigin, setZoomOrigin] =
    useState({ x: 50, y: 50 });
  const lightboxScrollerRef =
    useRef<HTMLDivElement>(null);
  const lightboxImageRef =
    useRef<HTMLImageElement>(null);
  const time =
    formatMessageTime(createdAt);
  const hasText =
    Boolean(content?.trim());
  const isImageOnly =
    Boolean(image) && !hasText;
  const canUsePortal =
    typeof document !== "undefined";
  const otherInitials =
    getInitials(otherName);

  useEffect(() => {
    if (!expandedImage) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expandedImage]);

  useEffect(() => {
    if (!expandedImage) {
      setZoomed(false);
      setZoomOrigin({ x: 50, y: 50 });
    }
  }, [expandedImage]);

  useEffect(() => {
    if (!zoomed) return;

    window.requestAnimationFrame(() => {
      const scroller =
        lightboxScrollerRef.current;
      const imageElement =
        lightboxImageRef.current;

      if (!scroller || !imageElement) return;

      const targetLeft =
        imageElement.offsetLeft +
        imageElement.offsetWidth * (zoomOrigin.x / 100) -
        scroller.clientWidth / 2;
      const targetTop =
        imageElement.offsetTop +
        imageElement.offsetHeight * (zoomOrigin.y / 100) -
        scroller.clientHeight / 2;

      scroller.scrollTo({
        left: Math.max(0, targetLeft),
        top: Math.max(0, targetTop),
        behavior: "smooth"
      });
    });
  }, [zoomOrigin, zoomed]);

  function handleLightboxImageClick(
    event: React.MouseEvent<HTMLImageElement>
  ) {
    event.stopPropagation();

    if (zoomed) {
      setZoomed(false);
      setZoomOrigin({ x: 50, y: 50 });
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();
    const x =
      ((event.clientX - rect.left) / rect.width) * 100;
    const y =
      ((event.clientY - rect.top) / rect.height) * 100;

    setZoomOrigin({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y))
    });
    setZoomed(true);
  }

  function handleLightboxBackgroundClick(
    event: React.MouseEvent<HTMLDivElement>
  ) {
    if (event.target === event.currentTarget) {
      setExpandedImage(false);
    }
  }

  return (
    <div className={`row ${own ? "own-row" : ""}`}>
      {!own && (
        <span
          className="message-avatar"
        >
          {otherAvatarUrl
            ? (
              <img
                src={otherAvatarUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            )
            : (
              <span>{otherInitials}</span>
            )}
          <i aria-hidden="true" />
        </span>
      )}

      <div className={`${own ? "own" : "other"}${isImageOnly ? " image-only" : ""}`}>
        {image && (
          <button
            type="button"
            className="message-image-button"
            aria-label="Avaa kuva suurempana"
            onClick={() => setExpandedImage(true)}
          >
            <img
              src={image}
              alt=""
              className="message-image"
            />
          </button>
        )}

        {hasText && (
          <p>{content}</p>
        )}

        {(time || own) && own && (
          <span className={`message-meta${read ? " is-read" : ""}`}>
            {time && <time>{time}</time>}
            {own && (
              <span
                className={`read-state${read ? " is-read" : ""}`}
                aria-label={read ? "Nähty" : "Lähetetty"}
                title={read ? "Nähty" : "Lähetetty"}
              >
                <svg
                  className="read-check-icon"
                  viewBox="0 0 18 14"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M1.6 7.4 4.4 10.2 10.4 3.6" />
                  <path d="M7.3 7.4 10.1 10.2 16.1 3.6" />
                </svg>
              </span>
            )}
          </span>
        )}
      </div>

      {!own && time && (
        <span className="outside-time">{time}</span>
      )}

      {image && expandedImage && canUsePortal && createPortal(
        <div
          className={`image-lightbox${zoomed ? " is-zoomed" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Kuva suurempana"
          onClick={() => setExpandedImage(false)}
        >
          <button
            type="button"
            className="image-lightbox-close"
            aria-label="Sulje kuva"
            onClick={() => setExpandedImage(false)}
          >
            <X size={18} />
          </button>
          <div
            ref={lightboxScrollerRef}
            className="image-lightbox-scroll"
            onClick={handleLightboxBackgroundClick}
          >
            <img
              ref={lightboxImageRef}
              src={image}
              alt=""
              className="image-lightbox-image"
              onClick={handleLightboxImageClick}
              style={zoomed
                ? {
                    height: "auto",
                    maxHeight: "none",
                    maxWidth: "none",
                    objectFit: "contain",
                    transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                    width: "min(1800px, 180dvw)"
                  }
                : {
                    height: "auto",
                    maxHeight: "calc(100dvh - 56px)",
                    maxWidth: "min(calc(100dvw - 36px), 1100px)",
                    objectFit: "contain",
                    width: "auto"
                  }}
            />
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        .row {
          align-items: flex-start;
          background: transparent;
          box-shadow: none;
          display: flex;
          gap: 9px;
          min-height: 0;
          padding: 0;
          width: 100%;
        }

        .own-row {
          justify-content: flex-end;
        }

        .message-avatar {
          align-self: flex-end;
          border: 1px solid rgba(226, 244, 255, 0.82);
          border-radius: 999px;
          box-shadow:
            0 0 0 2px rgba(3, 14, 30, 0.96),
            0 12px 24px rgba(0, 8, 22, 0.32);
          color: #152334;
          display: none;
          flex: 0 0 auto;
          height: 26px;
          margin-top: 2px;
          place-items: center;
          position: relative;
          text-decoration: none;
          width: 26px;
        }

        .message-avatar img,
        .message-avatar span {
          align-items: center;
          background: #f8fafc;
          border-radius: 999px;
          display: flex;
          font-size: 8.5px;
          font-weight: 950;
          height: 100%;
          justify-content: center;
          object-fit: cover;
          overflow: hidden;
          width: 100%;
        }

        .message-avatar i {
          display: none;
        }

        .own,
        .other {
          border: 0;
          border-radius: 8px;
          box-shadow: none;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 6px;
          max-width: min(380px, 76%);
          min-width: 0;
          overflow: hidden;
          padding: 9px 11px 7px;
          width: fit-content;
        }

        .image-only {
          background: transparent;
          border-color: transparent;
          box-shadow: none;
          max-width: min(320px, 78%);
          min-width: min(220px, 62vw);
          overflow: visible;
          padding: 0;
        }

        .own.image-only,
        .other.image-only {
          background: transparent;
          border-color: transparent;
          box-shadow: none;
          display: grid;
          gap: 7px;
        }

        .own.image-only {
          justify-items: end;
        }

        .other.image-only {
          justify-items: start;
        }

        .own {
          align-items: end;
          column-gap: 8px;
          grid-template-columns: auto auto;
          min-height: 0;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.09), transparent 36%),
            linear-gradient(180deg, #ff851a 0%, #ff6900 100%);
          border-bottom-right-radius: 5px;
          box-shadow: none;
          color: #ffffff;
        }

        .other {
          width: fit-content;
          max-width: min(420px, 78%);
          min-height: 0;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 42%),
            linear-gradient(180deg, #142434 0%, #101f2e 100%);
          border-bottom-left-radius: 5px;
          box-shadow:
            0 16px 32px rgba(0, 8, 20, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
          color: #e8f4ff;
        }

        p {
          color: inherit;
          font-size: 11px;
          font-weight: 760;
          grid-column: 1 / -1;
          line-height: 1.45;
          margin: 0;
          overflow-wrap: anywhere;
          padding: 0;
        }

        .own p {
          grid-column: 1;
          line-height: 1.3;
          white-space: normal;
        }

        .own .message-meta {
          grid-column: 2;
          align-self: end;
          margin-left: 7px;
        }

        .message-meta {
          align-items: center;
          color: rgba(232, 244, 255, 0.72);
          display: inline-flex;
          font-size: 10.5px;
          font-variant-numeric: tabular-nums;
          font-weight: 760;
          gap: 4px;
          justify-self: end;
          line-height: 1;
          margin-top: 2px;
          min-height: 15px;
          white-space: nowrap;
        }

        .outside-time {
          align-self: flex-end;
          color: rgba(160, 176, 194, 0.72);
          flex: 0 0 auto;
          font-size: 10.5px;
          font-weight: 850;
          line-height: 1;
          margin: 0 0 0 0;
          white-space: nowrap;
        }

        .other .message-meta {
          color: rgba(210, 231, 247, 0.68);
        }

        .read-state {
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 999px;
          color: rgba(255, 246, 232, 0.96);
          display: inline-flex;
          gap: 0;
          height: 14px;
          justify-content: center;
          line-height: 1;
          min-width: 18px;
          padding: 0;
          position: relative;
          transform: translate(5px, -1px);
          width: 18px;
        }

        .read-check-icon {
          display: block;
          flex: 0 0 auto;
          height: 13px;
          overflow: visible;
          width: 17px;
        }

        .read-check-icon path {
          fill: none;
          stroke: currentColor;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 2.05;
        }

        .message-meta.is-read .read-state,
        .read-state.is-read {
          background: transparent;
          border-color: transparent;
          color: #00b7ff;
          filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.72));
          padding-right: 0;
        }

        .message-meta.is-read .read-check-icon path,
        .read-state.is-read .read-check-icon path {
          stroke: #00b7ff;
        }

        .message-image {
          background:
            radial-gradient(180px 120px at 50% 20%, rgba(255, 122, 18, 0.1), transparent 72%),
            #071826;
          border: 1px solid rgba(226, 244, 255, 0.2);
          border-radius: 14px;
          box-shadow: 0 18px 42px rgba(0, 7, 18, 0.34);
          display: block;
          height: auto;
          max-height: 300px;
          max-width: none;
          min-height: 130px;
          object-fit: contain;
          transition: border-color 0.15s ease, transform 0.15s ease;
          width: 100%;
        }

        .message-image-button {
          appearance: none;
          background: rgba(4, 15, 28, 0.72);
          border: 1px solid rgba(226, 244, 255, 0.2);
          border-radius: 15px;
          box-shadow:
            0 18px 42px rgba(0, 7, 18, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          cursor: zoom-in;
          display: block;
          line-height: 0;
          overflow: hidden;
          padding: 0;
          text-align: inherit;
          width: min(320px, 62vw);
        }

        .message-image-button:hover .message-image {
          border-color: rgba(255, 255, 255, 0.34);
          transform: none;
        }

        .image-only .message-meta {
          background: rgba(255, 116, 18, 0.14);
          border: 1px solid rgba(255, 158, 68, 0.38);
          border-radius: 999px;
          color: rgba(255, 244, 232, 0.94);
          gap: 5px;
          margin-top: 0;
          min-height: 22px;
          padding: 0 8px;
        }

        .image-only .read-state {
          color: #ffffff;
          height: 16px;
          min-width: 24px;
          opacity: 0.95;
          width: 24px;
        }

        .image-lightbox {
          backdrop-filter: blur(10px);
          background: rgba(2, 9, 18, 0.88);
          inset: 0;
          overflow: hidden;
          position: fixed;
          z-index: 1000;
        }

        .image-lightbox-scroll {
          align-items: center;
          display: flex;
          height: 100dvh;
          justify-content: center;
          overflow: hidden;
          padding: 24px 72px;
          width: 100dvw;
        }

        .image-lightbox.is-zoomed .image-lightbox-scroll {
          align-items: flex-start;
          cursor: grab;
          justify-content: flex-start;
          overflow: auto;
          overscroll-behavior: contain;
          padding: 32px 72px 72px;
        }

        .image-lightbox-image {
          border: 1px solid rgba(226, 244, 255, 0.18);
          border-radius: 10px;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.46);
          display: block;
          height: auto;
          max-height: calc(100dvh - 56px);
          max-width: min(calc(100dvw - 36px), 1100px);
          object-fit: contain;
          transform: translateZ(0);
          transition: width 180ms ease, max-width 180ms ease, max-height 180ms ease;
          width: auto;
        }

        .image-lightbox.is-zoomed .image-lightbox-image {
          cursor: zoom-out;
          flex: 0 0 auto;
          max-height: none;
          max-width: none;
        }

        .image-lightbox-close {
          background: rgba(8, 24, 40, 0.86);
          border: 1px solid rgba(226, 244, 255, 0.2);
          border-radius: 999px;
          color: #ffffff;
          cursor: pointer;
          font-size: 18px;
          font-weight: 900;
          height: 40px;
          line-height: 1;
          position: fixed;
          right: 24px;
          top: 24px;
          width: 40px;
          z-index: 1001;
        }

        @media (max-width: 640px) {
          .own,
          .other,
          .image-only {
            max-width: 88%;
          }

          .message-image {
            max-height: 260px;
            min-height: 120px;
          }

          .message-image-button {
            width: min(280px, 78vw);
          }

          .image-lightbox {
            padding: 0;
          }

          .image-lightbox-scroll {
            padding: 18px;
          }

          .image-lightbox.is-zoomed .image-lightbox-scroll {
            padding: 20px 18px 56px;
          }

          .image-lightbox-image {
            max-height: calc(100dvh - 56px);
            max-width: calc(100dvw - 36px);
          }

          .image-lightbox-close {
            right: 12px;
            top: 12px;
          }
        }
      `}</style>
    </div>
  );
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

function formatMessageTime(
  value?: string
) {
  const date = new Date(value || "");

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "fi-FI",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}
