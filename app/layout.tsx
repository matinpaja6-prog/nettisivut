import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import "./styles/legacy.css";
import "./styles/themes.css";
import OnlinePresence from "./components/OnlinePresence";
import Footer from "./components/Footer";
import FloatingChat from "./components/FloatingChat";
import BottomNav from "./components/BottomNav";
import SiteAppearance from "./components/SiteAppearance";
import RequiredReviewGate from "./components/RequiredReviewGate";
import ProfileCompletionGate from "./components/ProfileCompletionGate";
import SiteVisitTracker from "./components/SiteVisitTracker";
import UniversalTopbar from "./components/UniversalTopbar";
import TaxonomyProvider from "./components/TaxonomyProvider";
import VisitorLanguageGate from "./components/VisitorLanguageGate";
import InstantNavigation from "./components/InstantNavigation";
import NavigationHistory from "./components/NavigationHistory";
import AuthRouteGuard from "./components/AuthRouteGuard";
import AutoTranslate from "./components/AutoTranslate";
import SourceFog from "./components/SourceFog";
import GlobalNavigationSpinner from "./components/GlobalNavigationSpinner";
import CookieConsentGate from "./components/CookieConsentGate";
import { PUBLIC_SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  applicationName: "Maskines",
  robots: {
    index: true,
    follow: true
  },
  title: {
    default: "Maskines | Moottorikelkkojen, mönkijöiden, motocrossien ja mopojen varaosat",
    template: "%s | Maskines"
  },
  description:
    "Osta ja myy käytettyjä varaosia moottorikelkkoihin, mönkijöihin, motocross-pyöriin ja mopoihin. Rajaa osat ajoneuvon, merkin, mallin, vuosimallin ja kategorian mukaan.",
  keywords: [
    "Maskines",
    "moottorikelkan varaosat",
    "mönkijän varaosat",
    "motocross varaosat",
    "mopon varaosat",
    "käytetyt varaosat",
    "varaosatori"
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/maskines-share-logo.png", sizes: "1200x1200", type: "image/png" }
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "fi_FI",
    siteName: "Maskines",
    title: "Maskines | Käytetyt ajoneuvojen varaosat",
    description:
      "Käytettyjen varaosien kauppapaikka moottorikelkoille, mönkijöille, motocross-pyörille ja mopoille.",
    url: "/",
    images: [
      {
        url: "/maskines-share-logo.png",
        width: 1200,
        height: 1200,
        alt: "Maskines-logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Maskines | Käytetyt ajoneuvojen varaosat",
    description:
      "Osta ja myy varaosia moottorikelkkoihin, mönkijöihin, motocross-pyöriin ja mopoihin.",
    images: ["/maskines-share-logo.png"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#040d1f"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Synchronous appearance restore: runs before first paint to avoid the
  // 1–2s flash of the default hero/colors after a hard refresh.
  const earlyAppearance = `
    (function () {
      try {
        var raw = localStorage.getItem('arctic-appearance-cache-v1');
        var a = raw ? JSON.parse(raw) : {};
        if (!a || typeof a !== 'object') a = {};
        var r = document.documentElement.style;
        if (a.hero_image_url) r.setProperty('--hero-bg-url', 'url("' + a.hero_image_url + '")');
        if (a.primary_color) {
          r.setProperty('--orange', a.primary_color);
          r.setProperty('--blue', a.primary_color);
          r.setProperty('--brand-primary', a.primary_color);
        }
        if (a.accent_color) {
          r.setProperty('--orange-2', a.accent_color);
          r.setProperty('--blue-2', a.accent_color);
          r.setProperty('--brand-accent', a.accent_color);
        }
        if (a.background_color) {
          r.setProperty('--bg', a.background_color);
          r.setProperty('--site-bg', a.background_color);
          r.setProperty('--app-page-bg', 'none');
        }
        if (a.surface_color) {
          r.setProperty('--bg-2', a.surface_color);
          r.setProperty('--surface', a.surface_color);
          r.setProperty('--surface-2', a.surface_color);
          r.setProperty('--brand-dark-surface', a.surface_color);
        }
        if (a.card_color) {
          var rawCardColor = String(a.card_color).trim().toLowerCase();
          var legacyCardColors = {
            '#000000': true,
            '#020711': true,
            '#040d1f': true,
            '#050b13': true,
            '#06111d': true,
            '#08111d': true,
            '#0b1118': true,
            '#0e1721': true
          };
          var cardColor = legacyCardColors[rawCardColor] ? '#071321' : a.card_color;
          r.setProperty('--app-sheet-surface', cardColor);
          r.setProperty('--site-card', cardColor);
          r.setProperty('--listing-card-bg', cardColor);
        }
        if (a.text_color) {
          r.setProperty('--text', a.text_color);
          r.setProperty('--brand-text-on-dark', a.text_color);
        }
        if (a.muted_color) {
          r.setProperty('--muted', a.muted_color);
          r.setProperty('--brand-muted-on-dark', a.muted_color);
        }
        if (a.line_color) r.setProperty('--line', a.line_color);
        if (a.topbar_color) r.setProperty('--site-topbar', a.topbar_color);
        if (a.hero_overlay) r.setProperty('--hero-overlay', a.hero_overlay);

        var userTheme = 'dark';
        var rawUserSettings = localStorage.getItem('maskines-user-settings-v1');
        if (rawUserSettings) {
          var userSettings = JSON.parse(rawUserSettings);
          if (userSettings && (userSettings.theme === 'dark' || userSettings.theme === 'light')) {
            userTheme = userSettings.theme;
          } else if (userSettings && userSettings.backgroundColor) {
            var legacyColor = String(userSettings.backgroundColor).replace('#', '');
            if (/^[0-9a-f]{6}$/i.test(legacyColor)) {
              var legacyRed = parseInt(legacyColor.slice(0, 2), 16) / 255;
              var legacyGreen = parseInt(legacyColor.slice(2, 4), 16) / 255;
              var legacyBlue = parseInt(legacyColor.slice(4, 6), 16) / 255;
              userTheme = 0.2126 * legacyRed + 0.7152 * legacyGreen + 0.0722 * legacyBlue > 0.62 ? 'light' : 'dark';
            }
          }
        }
        var lightTheme = userTheme === 'light';
        var userBackground = lightTheme ? '#f0f2f3' : '#0b1118';
        var userSurface = lightTheme ? '#fcfcfb' : '#061a2c';
        var userRaised = lightTheme ? '#f5f6f6' : '#061a2c';
        var userSoft = lightTheme ? '#e8ecee' : '#061a2c';
        var userText = lightTheme ? '#16232c' : '#f4f8fc';
        var userMuted = lightTheme ? '#5f707c' : '#9aaabe';
        var userLine = lightTheme ? '#cbd3d7' : 'rgba(151, 178, 205, 0.22)';
        document.documentElement.dataset.theme = userTheme;
        document.documentElement.dataset.userBackgroundTone = userTheme;
        document.documentElement.style.colorScheme = userTheme;
        r.setProperty('--maskines-page-background', userBackground);
        r.setProperty('--maskines-page-text', userText);
        r.setProperty('--maskines-page-muted', userMuted);
        r.setProperty('--bg', userBackground);
        r.setProperty('--bg-2', userSurface);
        r.setProperty('--surface', userSurface);
        r.setProperty('--surface-2', userRaised);
        r.setProperty('--surface-3', userSoft);
        r.setProperty('--text', userText);
        r.setProperty('--muted', userMuted);
        r.setProperty('--line', userLine);
        r.setProperty('--site-bg', userBackground);
        r.setProperty('--site-card', userSurface);
        r.setProperty('--listing-card-bg', userSurface);
        r.setProperty('--app-sheet-surface', userSurface);
        r.setProperty('--app-sheet-surface-raised', userRaised);
        r.setProperty('--app-sheet-border', userLine);
        r.setProperty('--site-topbar', lightTheme ? '#fcfcfb' : '#06131f');
        r.setProperty('--orange', '#ff7a1a');
        r.setProperty('--orange-2', '#ff8a24');
        r.setProperty('--brand-primary', '#ff7a1a');
        r.setProperty('--brand-accent', '#ff8a24');
        r.setProperty('--app-page-bg', 'none');
      } catch (e) {}
    })();
  `;

  const earlyLocale = `
    (function () {
      try {
        function isValidLocale(value) {
          return value === "fi" || value === "en" || value === "sv" || value === "no";
        }

        function removeInvalidVisitorLanguageKeys() {
          var keys = Object.keys(localStorage);
          for (var i = 0; i < keys.length; i += 1) {
            var key = keys[i];
            if (typeof key === "string" && key.indexOf("visitor-language:") === 0) {
              var value = localStorage.getItem(key);
              if (!isValidLocale(value)) {
                localStorage.removeItem(key);
              }
            }
          }
        }

        function getStoredLocale() {
          try {
            var value = localStorage.getItem("locale");
            return isValidLocale(value) ? value : "";
          } catch {
            return "";
          }
        }

        function getCookieLocale() {
          var match = document.cookie.match(/(?:^|;\\s*)locale=([^;]+)/);
          return match ? decodeURIComponent(match[1] || "") : "";
        }

        removeInvalidVisitorLanguageKeys();

        var cookieLocale = getCookieLocale();
        if (!isValidLocale(cookieLocale)) {
          document.cookie = "locale=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
          cookieLocale = "";
        }

        var storedLocale = getStoredLocale();
        if (!isValidLocale(storedLocale)) {
          localStorage.removeItem("locale");
        }

        var queryLocale = new URLSearchParams(window.location.search).get("lang") || "";
        var locale = isValidLocale(queryLocale)
          ? queryLocale
          : isValidLocale(storedLocale)
            ? storedLocale
            : (cookieLocale || "fi");
        document.documentElement.lang = locale;
        document.documentElement.setAttribute('data-i18n-target', locale);
      } catch (e) {}
    })();
  `;

  const earlyFirstVisitReset = `
    (function () {
      try {
        var url = new URL(window.location.href);
        if (url.searchParams.get('newVisitor') !== '1') return;

        localStorage.removeItem('locale');
        localStorage.removeItem('maskines-cookie-consent-v2');
        localStorage.removeItem('maskines-user-settings-v1');

        var keys = Object.keys(localStorage);
        for (var i = 0; i < keys.length; i += 1) {
          if (keys[i].indexOf('visitor-language:') === 0) {
            localStorage.removeItem(keys[i]);
          }
        }

        document.cookie = 'locale=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax';
        document.cookie = 'maskines_cookie_consent_v2=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax; Secure';
        document.documentElement.removeAttribute('data-visitor-language-ready');

        url.searchParams.delete('newVisitor');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch (e) {}
    })();
  `;

  return (
    <html lang="fi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: earlyFirstVisitReset }} />
        <script dangerouslySetInnerHTML={{ __html: earlyLocale }} />
        <script dangerouslySetInnerHTML={{ __html: earlyAppearance }} />
        <SourceFog />
      </head>
      <body suppressHydrationWarning>
        <CookieConsentGate>
          <TaxonomyProvider>
            <InstantNavigation />
            <GlobalNavigationSpinner />
            <AuthRouteGuard />
            <Suspense fallback={null}>
              <NavigationHistory />
            </Suspense>
            <VisitorLanguageGate />
            <AutoTranslate />
            <SiteAppearance />
            <OnlinePresence />
            <SiteVisitTracker />
            <ProfileCompletionGate />
            <UniversalTopbar />
            {children}
            <RequiredReviewGate />
            <FloatingChat />
            <BottomNav />
            <Footer />
          </TaxonomyProvider>
        </CookieConsentGate>
      </body>
    </html>
  );
}
