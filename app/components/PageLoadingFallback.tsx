import Image from "next/image";

export default function PageLoadingFallback() {
  return (
    <main className="route-loading-shell" aria-busy="true" aria-label="Ladataan sivua">
      <span className="route-loading-brand" aria-hidden="true">
        <Image className="maskines-loading-logo maskines-loading-logo-light" src="/maskines-brand-mark-clean-v4.png" alt="" width={180} height={141} priority unoptimized />
        <Image className="maskines-loading-logo maskines-loading-logo-dark" src="/maskines-brand-mark-dark-clean-v4.png" alt="" width={180} height={141} priority unoptimized />
      </span>
    </main>
  );
}
