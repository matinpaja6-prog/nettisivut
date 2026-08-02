"use client";

export default function GlobalError({
  reset: _reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  function reloadPage() {
    window.location.reload();
  }

  return (
    <html lang="fi">
      <body>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#061426",
            color: "#fff",
            fontFamily: "Arial, sans-serif",
            padding: 24
          }}
        >
          <section style={{ maxWidth: 520 }}>
            <h1 style={{ margin: "0 0 12px", fontSize: 34 }}>Sivun lataaminen keskeytyi</h1>
            <p style={{ color: "#b9c8d8", lineHeight: 1.5 }}>
              Tapahtui tilapäinen latausvirhe. Yritä uudelleen.
            </p>
            <button
              onClick={reloadPage}
              style={{
                marginTop: 18,
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 10,
                background: "#ff7a1a",
                color: "#fff",
                fontWeight: 700,
                padding: "12px 18px",
                cursor: "pointer"
              }}
            >
              Yritä uudelleen
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
