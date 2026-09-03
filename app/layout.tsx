import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import "./styles/generated/shared.css";
import "./styles/marketplace-improvements.css";
import OnlinePresence from "./components/OnlinePresence";
import Footer from "./components/Footer";
import DeferredAccountTools from "./components/DeferredAccountTools";
import BottomNav from "./components/BottomNav";
import SiteAppearance from "./components/SiteAppearance";
import ProfileCompletionGate from "./components/ProfileCompletionGate";
import SiteVisitTracker from "./components/SiteVisitTracker";
import UniversalTopbar from "./components/UniversalTopbar";
import TaxonomyProvider from "./components/TaxonomyProvider";
import InstantNavigation from "./components/InstantNavigation";
import NavigationHistory from "./components/NavigationHistory";
import AuthRouteGuard from "./components/AuthRouteGuard";
import LanguageProvider from "./components/LanguageProvider";
import { getServerLocale, getServerPathname } from "@/lib/server-locale";
import GlobalNavigationSpinner from "./components/GlobalNavigationSpinner";
import CookieConsentGate from "./components/CookieConsentGate";
import GoogleMeasurement from "./components/GoogleMeasurement";
import CurrencyProvider from "./components/CurrencyProvider";
import { languagePaths } from "@/lib/routes";
import { PUBLIC_SITE_URL } from "@/lib/site-url";
import { siteBrandImage, siteFavicon } from "@/lib/site-brand-image";
import { googleVerification } from "@/lib/measurement-config";
import { validateSeoCollectionRoute } from "@/lib/server-seo-collections";

const searchConsoleVerification = googleVerification(process.env.GOOGLE_SITE_VERIFICATION) || googleVerification(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION);

const baseMetadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  applicationName: "Maskines",
  robots: {
    index: true,
    follow: true
  },
  title: {
    default: "Maskines | Varaosat ja ajoneuvot",
    template: "%s | Maskines"
  },
  description:
    "Pohjoismainen markkinapaikka pienkoneiden varaosille ja ajoneuvoille. Osta ja myy varaosia ja ajoneuvoja: moottorikelkkoja, mönkijöitä, motocross-pyöriä ja mopoja.",
  keywords: [
    "Maskines",
    "moottorikelkan varaosat",
    "mönkijän varaosat",
    "motocross varaosat",
    "mopon varaosat",
    "käytetyt varaosat",
    "varaosatori",
    "käytetyt ajoneuvot",
    "moottorikelkat myynnissä",
    "mönkijät myynnissä"
  ],
  icons: {
    icon: [
      { url: siteFavicon, sizes: "192x192", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48 256x256", type: "image/x-icon" }
    ],
    shortcut: siteFavicon,
    apple: [{ url: siteFavicon, sizes: "192x192", type: "image/png" }]
  },
  ...(searchConsoleVerification
    ? { verification: { google: searchConsoleVerification } }
    : {}),
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "fi_FI",
    siteName: "Maskines",
    title: "Maskines | Pienkoneiden ajoneuvot ja varaosat",
    description:
      "Pohjoismainen markkinapaikka moottorikelkoille, mönkijöille, motocross-pyörille, mopoille ja niiden varaosille.",
    url: "/",
    images: [siteBrandImage]
  },
  twitter: {
    card: "summary_large_image",
    title: "Maskines | Pienkoneiden ajoneuvot ja varaosat",
    description:
      "Osta ja myy pienkoneiden ajoneuvoja ja varaosia moottorikelkkoihin, mönkijöihin, motocross-pyöriin ja mopoihin.",
    images: [siteBrandImage.url]
  }
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const pathname = await getServerPathname();
  const copy = {
    fi: ["Maskines | Varaosat ja ajoneuvot", "Pohjoismainen markkinapaikka pienkoneiden varaosille ja ajoneuvoille."],
    en: ["Maskines | Parts and vehicles", "The Nordic marketplace for small vehicles and spare parts."],
    sv: ["Maskines | Reservdelar och fordon", "Den nordiska marknadsplatsen för småfordon och reservdelar."],
    no: ["Maskines | Reservedeler og kjøretøy", "Den nordiske markedsplassen for små kjøretøy og reservedeler."]
  }[locale];
  return {
    ...baseMetadata,
    title: { default: copy[0], template: "%s | Maskines" },
    description: copy[1],
    alternates: { canonical: pathname, languages: languagePaths(pathname) },
    openGraph: { ...baseMetadata.openGraph, title: copy[0], description: copy[1], url: pathname, locale: {fi:"fi_FI",en:"en_GB",sv:"sv_SE",no:"nb_NO"}[locale] },
    twitter: { ...baseMetadata.twitter, title: copy[0], description: copy[1] }
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#040d1f"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  await validateSeoCollectionRoute(await getServerPathname());
  const earlyChunkRecovery = `
    (function () {
      var retryKey = 'maskines-chunk-retry-v1';
      var stableUrl = new URL(location.href);
      stableUrl.searchParams.delete('_refresh');
      var currentPage = stableUrl.pathname + stableUrl.search;

      function errorText(value) {
        if (!value) return '';
        if (typeof value === 'string') return value;
        return String(value.message || value.reason || value);
      }

      function recover(value) {
        var message = errorText(value);
        if (!/ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module/i.test(message)) return;
        if (sessionStorage.getItem(retryKey) === currentPage) return;
        sessionStorage.setItem(retryKey, currentPage);
        var url = new URL(location.href);
        url.searchParams.set('_refresh', Date.now().toString());
        location.replace(url.toString());
      }

      addEventListener('error', function (event) { recover(event.error || event.message); });
      addEventListener('unhandledrejection', function (event) { recover(event.reason); });
      setTimeout(function () {
        if (sessionStorage.getItem(retryKey) === currentPage) sessionStorage.removeItem(retryKey);
      }, 12000);
    })();
  `;

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
          if (userSettings && (userSettings.theme === 'dark' || userSettings.theme === 'light' || userSettings.theme === 'system')) {
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
        var resolvedUserTheme = userTheme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
          : userTheme;
        var lightTheme = resolvedUserTheme === 'light';
        var userBackground = lightTheme ? '#f0f2f3' : '#0b1118';
        var userSurface = lightTheme ? '#fcfcfb' : '#061a2c';
        var userRaised = lightTheme ? '#f5f6f6' : '#061a2c';
        var userSoft = lightTheme ? '#e8ecee' : '#061a2c';
        var userText = lightTheme ? '#16232c' : '#f4f8fc';
        var userMuted = lightTheme ? '#5f707c' : '#9aaabe';
        var userLine = lightTheme ? '#cbd3d7' : 'rgba(151, 178, 205, 0.22)';
        document.documentElement.dataset.theme = resolvedUserTheme;
        document.documentElement.dataset.userBackgroundTone = resolvedUserTheme;
        document.documentElement.dataset.themePreference = userTheme;
        document.documentElement.style.colorScheme = resolvedUserTheme;
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

  const earlyFirstVisitReset = `
    (function () {
      try {
        var url = new URL(window.location.href);
        if (url.searchParams.get('newVisitor') !== '1') return;

        localStorage.removeItem('locale');
        localStorage.removeItem('maskines-cookie-consent-v2');
        localStorage.removeItem('maskines-user-settings-v1');

        document.cookie = 'locale=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax';
        document.cookie = 'maskines_cookie_consent_v2=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax; Secure';

        url.searchParams.delete('newVisitor');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch (e) {}
    })();
  `;

  return (
    <html lang={locale === "no" ? "nb" : locale} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: "html,body{background-color:#0b1118}" }} />
        <script dangerouslySetInnerHTML={{ __html: earlyChunkRecovery }} />
        <script dangerouslySetInnerHTML={{ __html: earlyFirstVisitReset }} />
        <script dangerouslySetInnerHTML={{ __html: earlyAppearance }} />
      </head>
      <body suppressHydrationWarning>
        <LanguageProvider initialLocale={locale}>
        <CurrencyProvider>
        <CookieConsentGate>
          <Suspense fallback={null}>
            <GoogleMeasurement />
          </Suspense>
          <TaxonomyProvider>
            <InstantNavigation />
            <GlobalNavigationSpinner />
            <AuthRouteGuard />
            <Suspense fallback={null}>
              <NavigationHistory />
            </Suspense>
            <SiteAppearance />
            <OnlinePresence />
            <SiteVisitTracker />
            <ProfileCompletionGate />
            <UniversalTopbar />
            {children}
            <DeferredAccountTools />
            <BottomNav />
            <Footer />
          </TaxonomyProvider>
        </CookieConsentGate>
        </CurrencyProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
