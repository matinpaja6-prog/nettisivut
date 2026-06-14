/**
 * ============================================================================
 * BRÄNDIASETUKSET — vaihda nimi, logo ja värit yhdestä paikasta
 * ============================================================================
 *
 * Tämä on KESKITETTY tiedosto. Kun lopullinen logo ja brändiväri on selvillä
 * (ennen julkaisua), muokkaa vain alla olevia arvoja — koko sivusto päivittyy
 * automaattisesti.
 *
 * Käytössä:
 *   • AppHeader (yläpalkki)
 *   • CSS-muuttujat (--brand-primary jne.) globals.css:ssä
 *   • Sivun otsikko (`<title>`) ja meta-kuvaus
 */

export const branding = {
  /** Näkyvä sivuston nimi headerissa ja titleissä */
  siteName: "Maskines",

  /** Logon vasen osa (paksumpi) — valinnainen, jos haluat kaksiosaisen nimen */
  logoLeft: "Maskines",
  logoRight: "",

  /** Slogan / tagline yläpalkissa logon alla */
  tagline: "Käytettyjen moottorinosien tori",

  /** Logokuvan polku (public/-kansiosta). Jätä tyhjäksi jos käytät tekstilogoa */
  logoSrc: "/arctic-parts-logo.jpg",

  /** Näytetäänkö logokuva vai pelkkä teksti? */
  useLogoImage: false,

  /**
   * Brändivärit
   * - primary: päävaarallinen (napit, linkit, korostukset)
   * - primaryDark: tumma sävy (gradientit, hover)
   * - accent: toissijainen korostus
   * - dark: tumma taustaväri (admin / hallintapaneelit)
   */
  colors: {
    primary: "#0ea5e9",
    primaryDark: "#0369a1",
    accent: "#22d3ee",
    dark: "#0b1a2f",
    darkSurface: "#102640",
    darkSurfaceStrong: "#0c1e36"
  }
} as const;

export type BrandingConfig = typeof branding;
