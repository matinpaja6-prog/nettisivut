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
  logoSrc: "/maskines-brand-mark-clean-v4.png",

  /** Näytetäänkö logokuva vai pelkkä teksti? */
  useLogoImage: true,

  /**
   * Brändivärit
   * - primary: päävaarallinen (napit, linkit, korostukset)
   * - primaryDark: tumma sävy (gradientit, hover)
   * - accent: toissijainen korostus
   * - dark: tumma taustaväri (admin / hallintapaneelit)
   */
  colors: {
    primary: "#ff7417",
    primaryDark: "#d95500",
    accent: "#ff941f",
    dark: "#0b1a2f",
    darkSurface: "#102640",
    darkSurfaceStrong: "#0c1e36"
  }
} as const;

export type BrandingConfig = typeof branding;
