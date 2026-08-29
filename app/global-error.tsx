"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fi">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#f3f6f8", color: "#0b2239" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
          <section style={{ width: "min(620px, 100%)", boxSizing: "border-box", padding: "46px 30px", border: "1px solid #d4dee7", borderRadius: 20, background: "#fff", boxShadow: "0 18px 48px rgba(11,34,57,.12)", textAlign: "center" }}>
            <div style={{ width: 58, height: 58, display: "grid", placeItems: "center", margin: "0 auto 18px", borderRadius: 18, background: "#fff0e5", color: "#ff6500", fontSize: 32, fontWeight: 900 }}>!</div>
            <p style={{ margin: "0 0 8px", color: "#ff6500", fontSize: 13, fontWeight: 900, letterSpacing: ".11em", textTransform: "uppercase" }}>Maskines</p>
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 6vw, 42px)" }}>Sivun lataaminen epäonnistui</h1>
            <p style={{ margin: "16px auto 26px", maxWidth: 470, color: "#5d7183", lineHeight: 1.6 }}>Päivitä sivu tai yritä hetken kuluttua uudelleen.</p>
            <button type="button" onClick={reset} style={{ minHeight: 46, padding: "0 24px", border: 0, borderRadius: 10, background: "#ff6500", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Lataa sivu uudelleen</button>
          </section>
        </main>
      </body>
    </html>
  );
}
