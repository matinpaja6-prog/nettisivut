"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
            <h1 style={{ margin: "0 0 12px", fontSize: 34 }}>Sivu ladattiin uudelleen</h1>
            <p style={{ color: "#b9c8d8", lineHeight: 1.5 }}>
              Tapahtui tilapainen latausvirhe. Yrita uudelleen.
            </p>
            <button
              onClick={reset}
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
              Lataa uudelleen
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
