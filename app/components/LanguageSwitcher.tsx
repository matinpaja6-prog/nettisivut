"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isLocale, useLanguage } from "@/lib/i18n";
import { translateLocalizedPath } from "@/lib/routes";

const LOCALES = [
  { code: "fi", label: "Suomi",   iso: "fi" },
  { code: "en", label: "English", iso: "gb" },
  { code: "sv", label: "Svenska", iso: "se" },
  { code: "no", label: "Norsk",   iso: "no" },
  { code: "et", label: "Eesti",   iso: "ee" },
] as const;

function Flag({ iso }: { iso: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        alignItems: "center",
        background: "#ffffff",
        border: "1px solid rgba(5, 11, 20, 0.08)",
        borderRadius: 4,
        boxSizing: "border-box",
        display: "inline-flex",
        flexShrink: 0,
        height: 18,
        justifyContent: "center",
        overflow: "hidden",
        pointerEvents: "none",
        width: 24
      }}
    >
      <img
        src={`https://flagcdn.com/24x18/${iso}.png`}
        width={24}
        height={18}
        alt=""
        style={{
          background: "#ffffff",
          border: 0,
          borderRadius: 0,
          display: "block",
          height: 18,
          objectFit: "cover",
          width: 24
        }}
      />
    </span>
  );
}

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });

  useEffect(() => { setMounted(true); }, []);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  function updateDropPosition() {
    if (!btnRef.current || typeof window === "undefined") return;
    const rect = btnRef.current.getBoundingClientRect();
    setDropPos({
      top: rect.bottom + 14,
      right: Math.max(8, window.innerWidth - rect.right)
    });
  }

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    updateDropPosition();
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateDropPosition);
    window.addEventListener("scroll", updateDropPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateDropPosition);
      window.removeEventListener("scroll", updateDropPosition, true);
    };
  }, [open]);

  function pick(code: string) {
    if (!isLocale(code)) return;
    setLocale(code);
    setOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("lang");
      url.pathname = translateLocalizedPath(url.pathname, code);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function openDropdown() {
    updateDropPosition();
    setOpen((o) => !o);
  }

  const dropdown = mounted && open ? createPortal(
      <div
        ref={menuRef}
        role="listbox"
        className="global-language-menu"
        style={{
          position: "fixed",
          top: dropPos.top,
          right: dropPos.right,
          zIndex: 999999,
          pointerEvents: "all"
        }}
      >
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            role="option"
            className={`global-language-option${l.code === locale ? " is-active" : ""}`}
            aria-selected={l.code === locale}
            onMouseDown={(e) => { e.preventDefault(); pick(l.code); }}
          >
            <Flag iso={l.iso} />
            {l.label}
          </button>
        ))}
      </div>,
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
