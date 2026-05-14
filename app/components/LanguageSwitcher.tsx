"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isLocale, useLanguage } from "@/lib/i18n";

const LOCALES = [
  { code: "fi", label: "Suomi",   iso: "fi" },
  { code: "en", label: "English", iso: "gb" },
  { code: "sv", label: "Svenska", iso: "se" },
  { code: "no", label: "Norsk",   iso: "no" },
  { code: "et", label: "Eesti",   iso: "ee" },
] as const;

function Flag({ iso }: { iso: string }) {
  return (
    <img
      src={`https://flagcdn.com/24x18/${iso}.png`}
      width={22}
      height={16}
      alt=""
      style={{ borderRadius: 3, objectFit: "cover", flexShrink: 0, display: "block", pointerEvents: "none" }}
    />
  );
}

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });

  useEffect(() => { setMounted(true); }, []);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  function pick(code: string) {
    if (!isLocale(code)) return;
    setLocale(code);
    setOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", code);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function openDropdown() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  }

  const dropdown = mounted && open ? createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 999998 }}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        role="listbox"
        style={{
          position: "fixed",
          top: dropPos.top,
          right: dropPos.right,
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 18px 48px rgba(15,23,42,0.22)",
          padding: "6px 0",
          minWidth: 152,
          zIndex: 999999,
          overflow: "hidden",
          pointerEvents: "all"
        }}
      >
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            role="option"
            aria-selected={l.code === locale}
            onMouseDown={(e) => { e.preventDefault(); pick(l.code); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "9px 14px",
              background: l.code === locale ? "rgba(255,107,22,0.09)" : "transparent",
              border: 0,
              cursor: "pointer",
              textAlign: "left",
              fontWeight: l.code === locale ? 800 : 600,
              fontSize: 13,
              color: "#0b1a3a",
              pointerEvents: "all"
            }}
          >
            <Flag iso={l.iso} />
            {l.label}
          </button>
        ))}
      </div>
    </>,
    document.body
  ) : null;

  return (
    <div style={{ position: "relative" }} data-global-language-menu>
      <button
        ref={btnRef}
        type="button"
        className="language-switcher"
        onClick={openDropdown}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 34, padding: 0, cursor: "pointer" }}
      >
        <Flag iso={current.iso} />
      </button>
      {dropdown}
    </div>
  );
}
