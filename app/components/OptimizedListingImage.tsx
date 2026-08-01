"use client";

import Image from "next/image";
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
    <Image
      src={currentSrc}
      alt={decorative ? "" : alt}
      width={640}
      height={400}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      // The local dev server may not be allowed to proxy remote Supabase
      // images. Let the browser fetch them directly on localhost; production
      // continues to use Next.js image optimization.
      unoptimized={process.env.NODE_ENV === "development" || currentSrc.startsWith("data:")}
      className={className}
      aria-hidden={decorative || undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onError={() => setCurrentSrc(fallbackListingImage)}
    />
  );
}
