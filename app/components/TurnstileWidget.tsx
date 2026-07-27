"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type TurnstileWidgetProps = {
  action: string;
  onToken: (token: string) => void;
  resetKey?: number;
  className?: string;
};

export default function TurnstileWidget({
  action,
  onToken,
  resetKey = 0,
  className
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);
  const [widgetError, setWidgetError] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (window.turnstile) {
      setScriptReady(true);
      return;
    }

    // The shared Turnstile script may already be loading (or may have been
    // restored from the browser cache) before Next.js fires this component's
    // Script callbacks. Observe the global API as well so the widget renders
    // immediately whenever it becomes available.
    const startedAt = Date.now();
    const readyPoll = window.setInterval(() => {
      if (window.turnstile) {
        window.clearInterval(readyPoll);
        setScriptReady(true);
      } else if (Date.now() - startedAt > 10_000) {
        window.clearInterval(readyPoll);
        setWidgetError("Bottitarkistus ei latautunut. Päivitä sivu ja yritä uudelleen.");
      }
    }, 50);

    return () => window.clearInterval(readyPoll);
  }, []);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const removeWidget = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.remove(widgetIdRef.current);
    }
    widgetIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!scriptReady || !siteKey || !containerRef.current || !window.turnstile) return;

    removeWidget();
    setWidgetError("");
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "auto",
      size: "flexible",
      appearance: "always",
      retry: "auto",
      "refresh-expired": "auto",
      callback: (token: string) => {
        setWidgetError("");
        onTokenRef.current(token);
      },
      "expired-callback": () => {
        setWidgetError("Bottitarkistus vanheni. Tee tarkistus uudelleen.");
        onTokenRef.current("");
      },
      "error-callback": (errorCode: string) => {
        onTokenRef.current("");
        setWidgetError(
          errorCode === "110200"
            ? "Bottitarkistusta ei ole sallittu tällä verkkotunnuksella. Lisää localhost Cloudflaren Hostname Management -kohtaan."
            : "Bottitarkistus ei latautunut. Päivitä sivu ja yritä uudelleen."
        );
        return false;
      }
    });

    return removeWidget;
  }, [action, removeWidget, resetKey, scriptReady, siteKey]);

  if (!siteKey) {
    return <p role="alert">Bottitarkistuksen sivustoavain puuttuu.</p>;
  }

  return (
    <div className={className}>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} aria-label="Bottitarkistus" />
      {!scriptReady && !widgetError ? (
        <p className="turnstile-loading" role="status">Ladataan bottitarkistusta...</p>
      ) : null}
      {widgetError ? <p role="alert">{widgetError}</p> : null}
    </div>
  );
}
