"use client";
import UiText from "@/app/components/UiText";

import { useEffect } from "react";
import Link from "@/app/components/LocalizedLink";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <span style={styles.badge}>!</span>
        <p style={styles.eyebrow}><UiText text={"Sivua ei voitu näyttää"} /></p>
        <h1 style={styles.title}><UiText text={"Lataaminen epäonnistui"} /></h1>
        <p style={styles.text}><UiText text={"Yritä ladata sivu uudelleen. Antamasi tiedot säilyvät mahdollisuuksien mukaan."} /></p>
        <div style={styles.actions}>
          <button type="button" style={styles.primaryButton} onClick={reset}><UiText text={"Yritä uudelleen"} /></button>
          <Link href="/" style={styles.secondaryButton}><UiText text={"Takaisin etusivulle"} /></Link>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "70vh", display: "grid", placeItems: "center", padding: "32px 18px", background: "#f3f6f8", color: "#0b2239" },
  card: { width: "min(620px, 100%)", padding: "44px 32px", border: "1px solid #d4dee7", borderRadius: 20, background: "#fff", boxShadow: "0 18px 48px rgba(11,34,57,.12)", textAlign: "center" },
  badge: { display: "grid", placeItems: "center", width: 58, height: 58, margin: "0 auto 18px", borderRadius: 18, background: "#fff0e5", color: "#ff6500", fontSize: 32, fontWeight: 900 },
  eyebrow: { margin: "0 0 8px", color: "#ff6500", fontSize: 13, fontWeight: 900, letterSpacing: ".11em", textTransform: "uppercase" },
  title: { margin: 0, fontSize: "clamp(28px, 5vw, 42px)", lineHeight: 1.08 },
  text: { maxWidth: 470, margin: "16px auto 26px", color: "#5d7183", lineHeight: 1.6 },
  actions: { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  primaryButton: { minHeight: 46, padding: "0 22px", border: 0, borderRadius: 10, background: "#ff6500", color: "#fff", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 22px", border: "1px solid #b8c7d3", borderRadius: 10, color: "#0b2239", fontWeight: 800, textDecoration: "none" },
};
