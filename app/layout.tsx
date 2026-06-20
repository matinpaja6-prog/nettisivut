import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import "./styles/header.css";
import "./styles/home.css";
import "./styles/seller.css";
import "./styles/workspace.css";
import "./styles/chrome.css";
import "./styles/auth.css";
import "./styles/garage.css";
import "./styles/legal.css";
import "./styles/messages.css";
import "./styles/my-listings.css";
import "./styles/saved.css";
import "./styles/followed.css";
import "./styles/sell.css";
import "./styles/listing-detail.css";
import "./styles/profile.css";
import "./styles/shop.css";
import "./styles/final-clean.css";
import "./styles/topbar-final.css";
import "./styles/seller-profile-final.css";
import "./styles/profile-cards-final.css";
import "./styles/profile-reference.css";
import "./styles/profile-absolute-final.css";
import "./styles/auth-final.css";
import "./styles/profile-symmetry-final.css";
import "./styles/mobile-final.css";
import "./styles/seller-phone-reference.css";
import "./styles/info-pages.css";
import OnlinePresence from "./components/OnlinePresence";
import Footer from "./components/Footer";
import FloatingChat from "./components/FloatingChat";
import SiteAppearance from "./components/SiteAppearance";
import RequiredReviewGate from "./components/RequiredReviewGate";
import ProfileCompletionGate from "./components/ProfileCompletionGate";
import SiteVisitTracker from "./components/SiteVisitTracker";
import UniversalTopbar from "./components/UniversalTopbar";
import TaxonomyProvider from "./components/TaxonomyProvider";
import VisitorLanguageGate from "./components/VisitorLanguageGate";
import GlobalNavigationSpinner from "./components/GlobalNavigationSpinner";
import InstantNavigation from "./components/InstantNavigation";
import NavigationHistory from "./components/NavigationHistory";
import AutoTranslate from "./components/AutoTranslate";

export const metadata: Metadata = {
  metadataBase: new URL("https://maskines.com"),
  applicationName: "Maskines",
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
      { url: "/maskines-icon.png", sizes: "512x512", type: "image/png" }
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
        url: "/hero-bg.png",
        width: 1200,
        height: 630,
        alt: "Maskines varaosakauppa"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Maskines | Käytetyt ajoneuvojen varaosat",
    description:
      "Osta ja myy varaosia moottorikelkkoihin, mönkijöihin, motocross-pyöriin ja mopoihin.",
    images: ["/hero-bg.png"]
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
        if (!raw) return;
        var a = JSON.parse(raw);
        if (!a || typeof a !== 'object') return;
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
          r.setProperty('--site-card', a.card_color);
          r.setProperty('--listing-card-bg', a.card_color);
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
      } catch (e) {}
    })();
  `;

  return (
    <html lang="fi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: earlyAppearance }} />
      </head>
      <body suppressHydrationWarning>
        <TaxonomyProvider>
          <InstantNavigation />
          <Suspense fallback={null}>
            <NavigationHistory />
          </Suspense>
          <GlobalNavigationSpinner />
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
          <Footer />
        </TaxonomyProvider>
      </body>
    </html>
  );
}
