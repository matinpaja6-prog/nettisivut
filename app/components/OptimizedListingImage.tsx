"use client";

import type { TouchEventHandler } from "react";
import { useEffect, useMemo, useState } from "react";

export const fallbackListingImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dbeafe"/><stop offset="1" stop-color="#bfdbfe"/></linearGradient></defs><rect width="1200" height="700" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1e3a8a" font-family="Segoe UI,Arial,sans-serif" font-size="36">Kuva ei saatavilla</text></svg>`
  );

type OptimizedListingImageProps = {
  src?: string | null;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  decorative?: boolean;
  onTouchStart?: TouchEventHandler<HTMLImageElement>;
  onTouchEnd?: TouchEventHandler<HTMLImageElement>;
};

export default function OptimizedListingImage({
  src,
  alt,
  priority = false,
  sizes = "(max-width: 640px) 92vw, (max-width: 1100px) 45vw, 320px",
  className,
  decorative = false,
  onTouchStart,
  onTouchEnd
}: OptimizedListingImageProps) {
  const normalizedSrc = useMemo(() => src?.trim() || fallbackListingImage, [src]);
  const [currentSrc, setCurrentSrc] = useState(normalizedSrc);

  useEffect(() => {
    setCurrentSrc(normalizedSrc);
  }, [normalizedSrc]);

  return (
    <img
      src={currentSrc}
      alt={decorative ? "" : alt}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      aria-hidden={decorative || undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onError={() => setCurrentSrc(fallbackListingImage)}
    />
  );
}
