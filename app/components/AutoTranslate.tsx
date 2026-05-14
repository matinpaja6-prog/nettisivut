"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isLocale, type Locale } from "@/lib/i18n";

type AttrName = "placeholder" | "title" | "aria-label";

type AttrEntry = {
  element: HTMLElement;
  attr: AttrName;
  text: string;
};

const ATTRS: AttrName[] = ["placeholder", "title", "aria-label"];
const SKIP_SELECTOR = [
  "script",
  "style",
  "noscript",
  "code",
  "pre",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[data-no-auto-translate]",
  "[data-global-language-menu]"
].join(",");

function shouldTranslateText(text: string) {
  const trimmed = text.trim();

  if (trimmed.length < 2 || trimmed.length > 500) return false;
  if (!/[A-Za-zÀ-ž]/.test(trimmed)) return false;
  if (/^[\d\s.,:;!?€$%+\-/–—()|]+$/.test(trimmed)) return false;
  if (/^(https?:\/\/|www\.|\S+@\S+\.\S+)/i.test(trimmed)) return false;

  return true;
}

export default function AutoTranslate() {
  const [locale, setLocale] = useState<Locale>("fi");
  const translationCache = useRef<Map<string, string>>(new Map());
  const originalTextNodes = useRef<WeakMap<Text, string>>(new WeakMap());
  const pendingRequest = useRef<number | null>(null);
  const translating = useRef(false);

  useEffect(() => {
    const urlLocale = new URLSearchParams(window.location.search).get("lang");
    const storedLocale = localStorage.getItem("locale");
    const initialLocale = isLocale(urlLocale) ? urlLocale : isLocale(storedLocale) ? storedLocale : "fi";

    setLocale(initialLocale);

    function handleLocaleChange(event: Event) {
      const nextLocale = (event as CustomEvent<Locale>).detail;
      if (isLocale(nextLocale)) {
        setLocale(nextLocale);
      }
    }

    window.addEventListener("localechange", handleLocaleChange);
    return () => window.removeEventListener("localechange", handleLocaleChange);
  }, []);

  const storageKey = useMemo(() => `auto-ui-translations:${locale}`, [locale]);

  useEffect(() => {
    translationCache.current.clear();

    if (locale === "fi") return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === "string") {
            translationCache.current.set(key, value);
          }
        }
      }
    } catch {
      translationCache.current.clear();
    }
  }, [locale, storageKey]);

  const collect = useCallback(() => {
    const textNodes: Text[] = [];
    const attrs: AttrEntry[] = [];
    const texts = new Set<string>();

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;

        const original = originalTextNodes.current.get(node as Text) ?? node.textContent ?? "";
        return shouldTranslateText(original) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const parent = node.parentElement;
      if (!parent) continue;

      if (!originalTextNodes.current.has(node)) {
        originalTextNodes.current.set(node, node.textContent ?? "");
      }

      const original = originalTextNodes.current.get(node) ?? "";
      if (!shouldTranslateText(original)) continue;

      textNodes.push(node);
      texts.add(original.trim());
    }

    for (const element of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (element.closest(SKIP_SELECTOR)) continue;

      for (const attr of ATTRS) {
        const current = element.getAttribute(attr);
        if (!current || !shouldTranslateText(current)) continue;

        const originalAttr = `data-auto-translate-original-${attr}`;
        const original = element.getAttribute(originalAttr) || current;
        element.setAttribute(originalAttr, original);

        attrs.push({ element, attr, text: original });
        texts.add(original.trim());
      }
    }

    return { textNodes, attrs, texts: Array.from(texts) };
  }, []);

  const saveCache = useCallback(() => {
    if (locale === "fi") return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(translationCache.current)));
    } catch {
      // localStorage can be full or unavailable. Translation still works for this session.
    }
  }, [locale, storageKey]);

  const applyTranslations = useCallback(
    (textNodes: Text[], attrs: AttrEntry[]) => {
      if (locale === "fi") {
        for (const node of textNodes) {
          const original = originalTextNodes.current.get(node);
          if (original) node.textContent = original;
        }

        for (const { element, attr } of attrs) {
          const original = element.getAttribute(`data-auto-translate-original-${attr}`);
          if (original) element.setAttribute(attr, original);
        }

        return;
      }

      for (const node of textNodes) {
        const original = (originalTextNodes.current.get(node) ?? node.textContent ?? "").trim();
        const translated = translationCache.current.get(original);
        if (translated) node.textContent = node.textContent?.replace(original, translated) ?? translated;
      }

      for (const { element, attr, text } of attrs) {
        const translated = translationCache.current.get(text.trim());
        if (translated) element.setAttribute(attr, translated);
      }
    },
    [locale]
  );

  const translatePage = useCallback(async () => {
    if (translating.current) return;
    translating.current = true;

    try {
      const { textNodes, attrs, texts } = collect();

      if (locale === "fi") {
        applyTranslations(textNodes, attrs);
        return;
      }

      const missing = texts.filter((text) => !translationCache.current.has(text));

      if (missing.length > 0) {
        const response = await fetch("/api/translate-ui", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetLocale: locale, texts: missing })
        });

        if (response.ok) {
          const data = (await response.json()) as { translations?: Record<string, string> };
          for (const [source, translated] of Object.entries(data.translations ?? {})) {
            translationCache.current.set(source, translated);
          }
          saveCache();
        }
      }

      applyTranslations(textNodes, attrs);
    } finally {
      translating.current = false;
    }
  }, [applyTranslations, collect, locale, saveCache]);

  useEffect(() => {
    function scheduleTranslate() {
      if (pendingRequest.current) {
        window.clearTimeout(pendingRequest.current);
      }
      pendingRequest.current = window.setTimeout(() => {
        void translatePage();
      }, 120);
    }

    scheduleTranslate();

    const observer = new MutationObserver(() => scheduleTranslate());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS
    });

    return () => {
      observer.disconnect();
      if (pendingRequest.current) {
        window.clearTimeout(pendingRequest.current);
      }
    };
  }, [locale, translatePage]);

  return null;
}
