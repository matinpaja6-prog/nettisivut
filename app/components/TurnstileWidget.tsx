"use client";
import UiText from "@/app/components/UiText";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const TURNSTILE_NORMAL_WIDTH = 300;
const TURNSTILE_NORMAL_HEIGHT = 65;

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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [scriptReady, setScriptReady] = useState(false);
  const [widgetError, setWidgetError] = useState("");
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
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

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateWidth = () => {
      const nextWidth = frame.getBoundingClientRect().width;
      if (nextWidth > 0) {
        setContainerWidth((currentWidth) =>
          currentWidth !== null && Math.abs(currentWidth - nextWidth) < 1
            ? currentWidth
            : nextWidth
        );
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(frame);

    return () => resizeObserver.disconnect();
  }, []);

  const removeWidget = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.remove(widgetIdRef.current);
    }
    widgetIdRef.current = null;
  }, []);

  useEffect(() => {
    if (
      !scriptReady ||
      !siteKey ||
      containerWidth === null ||
      !containerRef.current ||
      !window.turnstile
    ) return;

    removeWidget();
    setWidgetError("");
    const widgetSize = containerWidth < TURNSTILE_NORMAL_WIDTH ? "normal" : "flexible";
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "auto",
      size: widgetSize,
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
  }, [action, containerWidth, removeWidget, resetKey, scriptReady, siteKey]);

  if (!siteKey) {
    return <p role="alert"><UiText text={"Bottitarkistuksen sivustoavain puuttuu."} /></p>;
  }

  const widgetScale = containerWidth === null
    ? 1
    : Math.min(1, containerWidth / TURNSTILE_NORMAL_WIDTH);
  const isScaled = widgetScale < 1;
  const frameStyle = {
    "--turnstile-scale": widgetScale,
    height: `${TURNSTILE_NORMAL_HEIGHT * widgetScale}px`
  } as CSSProperties;

  return (
    <div className={["turnstile-widget", className].filter(Boolean).join(" ")}>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
      />
      <div
        ref={frameRef}
        className="turnstile-frame"
        data-scaled={isScaled || undefined}
        style={frameStyle}
      >
        <div
          ref={containerRef}
          className="turnstile-container"
          aria-label="Bottitarkistus"
        />
      </div>
      {!scriptReady && !widgetError ? (
        <p className="turnstile-loading" role="status"><UiText text={"Ladataan bottitarkistusta..."} /></p>
      ) : null}
      {widgetError ? <p role="alert">{widgetError}</p> : null}
    </div>
  );
}
