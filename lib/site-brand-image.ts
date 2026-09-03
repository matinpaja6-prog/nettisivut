import { branding } from "./branding";

// Use the same current mark as the visible header. Page metadata replaces
// nested Open Graph/Twitter values, so home pages must include this explicitly.
export const siteBrandImage = {
  url: branding.logoSrc,
  width: 512,
  height: 401,
  alt: "Maskines-logo"
} as const;

// Keep the favicon URL stable so Google can recrawl its existing reference.
export const siteFavicon = "/maskines-favicon-v6.png";
