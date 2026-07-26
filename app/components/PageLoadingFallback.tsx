export default function PageLoadingFallback() {
  return (
    <main className="route-loading-shell" aria-busy="true" aria-label="Ladataan sivua">
      <div className="route-loading-card">
        <span className="route-loading-kicker" />
        <span className="route-loading-title" />
        <span className="route-loading-copy" />
        <span className="route-loading-copy route-loading-copy-short" />
        <div className="route-loading-grid" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </main>
  );
}
