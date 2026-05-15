import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./styles/auth.css";
import "./styles/garage.css";
import "./styles/legal.css";
import "./styles/messages.css";
import "./styles/my-listings.css";
import "./styles/saved.css";
import "./styles/sell.css";
import "./styles/listing-detail.css";
import "./styles/profile.css";
import OnlinePresence from "./components/OnlinePresence";
import Footer from "./components/Footer";
import FloatingChat from "./components/FloatingChat";
import RequiredReviewGate from "./components/RequiredReviewGate";
import ProfileCompletionGate from "./components/ProfileCompletionGate";
import SiteVisitTracker from "./components/SiteVisitTracker";
import UniversalTopbar from "./components/UniversalTopbar";
import AutoTranslate from "./components/AutoTranslate";

export const metadata: Metadata = {
  title: "Arctic Parts",
  description: "Arctic Parts on paikallinen ajoneuvojen varaosien myyntialusta."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#040d1f"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <OnlinePresence />
        <SiteVisitTracker />
        <AutoTranslate />
        <ProfileCompletionGate />
        <UniversalTopbar />
        {children}
        <RequiredReviewGate />
        <FloatingChat />
        <Footer />
      </body>
    </html>
  );
}
