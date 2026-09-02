"use client";

import { useEffect, useRef, type TouchEventHandler } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import OptimizedListingImage from "./OptimizedListingImage";
import type { Locale } from "@/lib/i18n";
import styles from "./ListingImagePreview.module.css";

type Props = {
  src: string;
  alt: string;
  locale: Locale;
  imageNumber: number;
  imageCount: number;
  onClose: () => void;
  onNavigate: (direction: 1 | -1) => void;
  onTouchStart: TouchEventHandler<HTMLImageElement>;
  onTouchEnd: TouchEventHandler<HTMLImageElement>;
};

const copy = {
  fi: { gallery: "Ilmoituksen kuvat", close: "Sulje kuvan esikatselu", previous: "Edellinen kuva", next: "Seuraava kuva", image: "Kuva" },
  en: { gallery: "Listing photos", close: "Close image preview", previous: "Previous image", next: "Next image", image: "Image" },
  sv: { gallery: "Annonsbilder", close: "Stäng bildförhandsvisningen", previous: "Föregående bild", next: "Nästa bild", image: "Bild" },
  no: { gallery: "Annonsebilder", close: "Lukk bildeforhåndsvisningen", previous: "Forrige bilde", next: "Neste bilde", image: "Bilde" }
};

export default function ListingImagePreview({ src, alt, locale, imageNumber, imageCount, onClose, onNavigate, onTouchStart, onTouchEnd }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const t = copy[locale];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const root = document.documentElement;
    const body = document.body;
    const previous = { rootOverflow: root.style.overflow, bodyOverflow: body.style.overflow, rootOverscroll: root.style.overscrollBehavior, bodyOverscroll: body.style.overscrollBehavior };
    root.style.overflow = body.style.overflow = "hidden";
    root.style.overscrollBehavior = body.style.overscrollBehavior = "none";
    // The native top layer stays above every header/chat stacking context and
    // makes the rest of the page inert, including keyboard navigation.
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      root.style.overflow = previous.rootOverflow;
      body.style.overflow = previous.bodyOverflow;
      root.style.overscrollBehavior = previous.rootOverscroll;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} className={styles.dialog} data-listing-image-preview aria-label={t.gallery}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => { if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      } }}
      onKeyDown={event => {
        if (imageCount > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          event.preventDefault(); onNavigate(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}>
      <div className={styles.toolbar}>
        <span className={styles.caption} title={alt}>{alt}</span>
        <span className={styles.counter} aria-live="polite">{t.image} {imageNumber}/{imageCount}</span>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label={t.close}><X size={24} /></button>
      </div>
      <div className={styles.frame}>
        <OptimizedListingImage src={src} alt={alt} className={styles.photo} priority sizes="(max-width: 720px) 94vw, 90vw" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />
        {imageCount > 1 && <>
          <button type="button" className={`${styles.arrow} ${styles.previous}`} onClick={() => onNavigate(-1)} aria-label={t.previous}><ChevronLeft size={26} /></button>
          <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => onNavigate(1)} aria-label={t.next}><ChevronRight size={26} /></button>
        </>}
      </div>
    </dialog>, document.body
  );
}
