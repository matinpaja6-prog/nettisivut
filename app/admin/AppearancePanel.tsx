"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Maximize2,
  Minimize2,
  Monitor,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Smartphone,
  Upload
} from "lucide-react";
import {
  DEFAULT_APPEARANCE,
  fetchSiteAppearance,
  saveSiteAppearance,
  uploadHeroImage,
  type SiteAppearance
} from "@/lib/site-appearance";
import styles from "./admin.module.css";

type Props = {
  onToastAction: (kind: "ok" | "err", text: string) => void;
};

const APPEARANCE_CACHE_KEY = "arctic-appearance-cache-v1";

const QUICK_LINKS: { value: string; label: string }[] = [
  { value: "/", label: "Etusivu" },
  { value: "/profile", label: "Profiili" },
  { value: "/garage", label: "Talli" },
  { value: "/saved", label: "Tallennetut" },
  { value: "/messages", label: "Viestit" },
  { value: "/rewards", label: "Palkinnot" },
  { value: "/shop", label: "Kauppa" },
  { value: "/sell", label: "Myy" },
  { value: "/notifications", label: "Ilmoitukset" },
  { value: "/legal/privacy", label: "Tietosuoja" },
  { value: "/legal/terms", label: "Käyttöehdot" }
];

const APPEARANCE_PRESETS: {
  name: string;
  description: string;
  colors: Pick<
    SiteAppearance,
    | "primary_color"
    | "accent_color"
    | "background_color"
    | "surface_color"
    | "card_color"
    | "topbar_color"
    | "text_color"
    | "muted_color"
    | "line_color"
  >;
}[] = [
  {
    name: "Maskines tumma",
    description: "Nykyinen selkeä tumma teema",
    colors: {
      primary_color: "#38bdf8",
      accent_color: "#67e8f9",
      background_color: "#0b1118",
      surface_color: "#0e1721",
      card_color: "#0e1721",
      topbar_color: "#040d1f",
      text_color: "#f4f8fc",
      muted_color: "#9aaabe",
      line_color: "#1a2a3e"
    }
  },
  {
    name: "Jääsininen",
    description: "Vähemmän oranssia, raikkaampi hallintatuntuma",
    colors: {
      primary_color: "#38bdf8",
      accent_color: "#ff8a24",
      background_color: "#071421",
      surface_color: "#0c2033",
      card_color: "#0d2538",
      topbar_color: "#06111d",
      text_color: "#f4fbff",
      muted_color: "#a9c0d4",
      line_color: "#24445f"
    }
  },
  {
    name: "Kontrasti",
    description: "Selkeät rajat ja kirkkaampi teksti",
    colors: {
      primary_color: "#0891b2",
      accent_color: "#4cc9f0",
      background_color: "#050b13",
      surface_color: "#0b1828",
      card_color: "#102033",
      topbar_color: "#020711",
      text_color: "#ffffff",
      muted_color: "#b7c7d7",
      line_color: "#31506c"
    }
  }
];

function applyToIframe(doc: Document | null | undefined, a: SiteAppearance) {
  if (!doc) return;
  const root = doc.documentElement;
  const hero = a.hero_image_url || DEFAULT_APPEARANCE.hero_image_url;
  root.style.setProperty("--hero-bg-url", `url("${hero}")`);
  if (a.primary_color) {
    root.style.setProperty("--orange", a.primary_color);
    root.style.setProperty("--blue", a.primary_color);
    root.style.setProperty("--brand-primary", a.primary_color);
  }
  if (a.accent_color) {
    root.style.setProperty("--orange-2", a.accent_color);
    root.style.setProperty("--blue-2", a.accent_color);
    root.style.setProperty("--brand-accent", a.accent_color);
  }
  if (a.background_color) {
    root.style.setProperty("--bg", a.background_color);
    root.style.setProperty("--site-bg", a.background_color);
    root.style.setProperty("--app-page-bg", "none");
  }
  if (a.surface_color) {
    root.style.setProperty("--bg-2", a.surface_color);
    root.style.setProperty("--surface", a.surface_color);
    root.style.setProperty("--surface-2", a.surface_color);
    root.style.setProperty("--brand-dark-surface", a.surface_color);
  }
  if (a.card_color) {
    root.style.setProperty("--site-card", a.card_color);
    root.style.setProperty("--listing-card-bg", a.card_color);
  }
  if (a.text_color) {
    root.style.setProperty("--text", a.text_color);
    root.style.setProperty("--brand-text-on-dark", a.text_color);
  }
  if (a.muted_color) {
    root.style.setProperty("--muted", a.muted_color);
    root.style.setProperty("--brand-muted-on-dark", a.muted_color);
  }
  if (a.line_color) {
    root.style.setProperty("--line", a.line_color);
  }
  if (a.topbar_color) {
    root.style.setProperty("--site-topbar", a.topbar_color);
  }
  if (a.hero_overlay) {
    root.style.setProperty("--hero-overlay", a.hero_overlay);
  }
}

function applyToCurrentPage(a: SiteAppearance) {
  if (typeof document === "undefined") return;
  applyToIframe(document, a);
  try {
    localStorage.setItem(APPEARANCE_CACHE_KEY, JSON.stringify(a));
  } catch {
    /* ignore */
  }
}

function normalizePath(input: string): string {
  if (!input) return "/";
  const trimmed = input.trim();
  if (!trimmed) return "/";
  // Strip origin if user pastes a full URL.
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const u = new URL(trimmed);
      return u.pathname + u.search + u.hash;
    }
  } catch {
    /* ignore */
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export default function AppearancePanel({ onToastAction: onToast }: Props) {
  const [form, setForm] = useState<SiteAppearance>(DEFAULT_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewPath, setPreviewPath] = useState("/");
  const [addressBar, setAddressBar] = useState("/");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [fullscreen, setFullscreen] = useState(false);
  const [history, setHistory] = useState<string[]>(["/"]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const a = await fetchSiteAppearance();
      if (!cancelled) {
        setForm(a);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPreview = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    applyToIframe(doc, form);
  }, [form]);

  useEffect(() => {
    applyPreview();
    applyToCurrentPage(form);
  }, [applyPreview]);

  // Track navigation inside the iframe so the address bar reflects clicks.
  useEffect(() => {
    const id = window.setInterval(() => {
      try {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        const path = win.location.pathname + win.location.search + win.location.hash;
        if (path && path !== previewPath) {
          setPreviewPath(path);
          setAddressBar(path);
          setHistory((h) => {
            const trimmed = h.slice(0, historyIdx + 1);
            if (trimmed[trimmed.length - 1] === path) return trimmed;
            return [...trimmed, path];
          });
          setHistoryIdx((i) => i + 1);
        }
      } catch {
        /* cross-origin or not yet loaded */
      }
    }, 600);
    return () => window.clearInterval(id);
  }, [previewPath, historyIdx]);

  function navigateTo(path: string, pushHistory = true) {
    const target = normalizePath(path);
    setPreviewPath(target);
    setAddressBar(target);
    if (pushHistory) {
      setHistory((h) => {
        const trimmed = h.slice(0, historyIdx + 1);
        if (trimmed[trimmed.length - 1] === target) return trimmed;
        return [...trimmed, target];
      });
      setHistoryIdx((i) => i + 1);
    }
  }

  function goBack() {
    if (historyIdx <= 0) return;
    const idx = historyIdx - 1;
    setHistoryIdx(idx);
    const target = history[idx];
    setPreviewPath(target);
    setAddressBar(target);
  }

  function goForward() {
    if (historyIdx >= history.length - 1) return;
    const idx = historyIdx + 1;
    setHistoryIdx(idx);
    const target = history[idx];
    setPreviewPath(target);
    setAddressBar(target);
  }

  function reload() {
    const win = iframeRef.current?.contentWindow;
    try {
      win?.location.reload();
    } catch {
      // fallback: re-set src
      setPreviewPath((p) => p + (p.includes("?") ? "&" : "?") + "_r=" + Date.now());
    }
  }

  function handleAddressSubmit(e: FormEvent) {
    e.preventDefault();
    navigateTo(addressBar);
  }

  function update<K extends keyof SiteAppearance>(key: K, value: SiteAppearance[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      applyToCurrentPage(next);
      applyToIframe(iframeRef.current?.contentDocument, next);
      return next;
    });
  }

  function applyPreset(colors: (typeof APPEARANCE_PRESETS)[number]["colors"]) {
    setForm((prev) => {
      const next = { ...prev, ...colors };
      applyToCurrentPage(next);
      applyToIframe(iframeRef.current?.contentDocument, next);
      return next;
    });
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const { url, error } = await uploadHeroImage(file);
    setUploading(false);
    if (error || !url) {
      onToast("err", "Hero-kuvan lataus epäonnistui.");
      return;
    }
    update("hero_image_url", url);
    onToast("ok", "Hero-kuva ladattu. Muista tallentaa muutokset.");
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await saveSiteAppearance(form);
    setSaving(false);
    if (error) {
      const msg = (error as { message?: string })?.message ?? "Tuntematon virhe";
      onToast("err", `Tallennus epäonnistui: ${msg}`);
      return;
    }
    onToast("ok", "Ulkoasu tallennettu.");
  }

  function handleReset() {
    setForm(DEFAULT_APPEARANCE);
  }

  const previewSrc = useMemo(() => previewPath, [previewPath]);
  const canBack = historyIdx > 0;
  const canFwd = historyIdx < history.length - 1;

  if (loading) {
    return (
      <section className={styles.section}>
        <header className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            <Palette size={18} /> Ulkoasu
          </h2>
        </header>
        <p className={styles.empty}>Ladataan…</p>
      </section>
    );
  }

  return (
    <section
      className={`${styles.section} ${fullscreen ? styles.appearanceFullscreen : ""}`}
    >
      <header className={styles.sectionHead}>
        <div>
          <h2 className={styles.sectionTitle}>
            <Palette size={18} /> Ulkoasu
          </h2>
          <p className={styles.sectionSubtitle}>
            Selaa sivustoa esikatselussa, säädä värejä reaaliajassa, tallenna kun on hyvä.
          </p>
        </div>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => setFullscreen((v) => !v)}
        >
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          {fullscreen ? "Pienennä" : "Koko ruutu"}
        </button>
      </header>

      <div className={styles.appearanceHeroEditor}>
        <div>
          <span className={styles.appearanceHeroKicker}>Nopeat valinnat</span>
          <strong>Säädä koko sivuston ilme yhdestä paikasta</strong>
          <p>Valitse valmis pohja tai hienosäädä värit alta. Esikatselu päivittyy heti.</p>
        </div>
        <div className={styles.appearancePresetGrid}>
          {APPEARANCE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={styles.appearancePresetBtn}
              onClick={() => applyPreset(preset.colors)}
            >
              <span className={styles.appearancePresetSwatches}>
                <i style={{ background: preset.colors.primary_color ?? undefined }} />
                <i style={{ background: preset.colors.background_color ?? undefined }} />
                <i style={{ background: preset.colors.card_color ?? undefined }} />
              </span>
              <strong>{preset.name}</strong>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.appearanceWorkspace}>
        {/* Controls */}
        <div className={styles.appearanceControls}>
          <div className={styles.appearanceCard}>
            <div className={styles.appearanceLabel}>Etusivun hero-kuva</div>
            <div
              className={styles.appearancePreview}
              style={{ backgroundImage: form.hero_image_url ? `url(${form.hero_image_url})` : "none" }}
              aria-hidden="true"
            >
              {!form.hero_image_url && <span>Ei kuvaa</span>}
            </div>
            <input
              type="text"
              value={form.hero_image_url ?? ""}
              onChange={(e) => update("hero_image_url", e.target.value)}
              placeholder="https://… tai /hero-bg.png"
              className={styles.appearanceInput}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={styles.appearanceUploadBtn}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={15} />
              {uploading ? "Ladataan…" : "Lataa uusi kuva"}
            </button>
          </div>

          <div className={styles.appearanceCard}>
            <div className={styles.appearanceLabel}>Brändivärit</div>
            <ColorRow
              label="Pääväri"
              value={form.primary_color ?? DEFAULT_APPEARANCE.primary_color ?? "#38bdf8"}
              onChange={(v) => update("primary_color", v)}
            />
            <ColorRow
              label="Korostusväri"
              value={form.accent_color ?? DEFAULT_APPEARANCE.accent_color ?? "#67e8f9"}
              onChange={(v) => update("accent_color", v)}
            />
          </div>

          <div className={styles.appearanceCard}>
            <div className={styles.appearanceLabel}>Sivuston taustat</div>
            <ColorRow
              label="Sivuston tausta"
              value={form.background_color ?? DEFAULT_APPEARANCE.background_color ?? "#0b1118"}
              onChange={(v) => update("background_color", v)}
            />
            <ColorRow
              label="Myynti-ilmoitusten tausta"
              value={form.card_color ?? DEFAULT_APPEARANCE.card_color ?? "#0e1721"}
              onChange={(v) => update("card_color", v)}
            />
            <ColorRow
              label="Pinnat"
              value={form.surface_color ?? DEFAULT_APPEARANCE.surface_color ?? "#0e1721"}
              onChange={(v) => update("surface_color", v)}
            />
            <ColorRow
              label="Yläpalkki"
              value={form.topbar_color ?? DEFAULT_APPEARANCE.topbar_color ?? "#040d1f"}
              onChange={(v) => update("topbar_color", v)}
            />
          </div>

          <div className={styles.appearanceCard}>
            <div className={styles.appearanceLabel}>Tekstit ja viivat</div>
            <ColorRow
              label="Pääteksti"
              value={form.text_color ?? DEFAULT_APPEARANCE.text_color ?? "#f4f8fc"}
              onChange={(v) => update("text_color", v)}
            />
            <ColorRow
              label="Vaalea teksti"
              value={form.muted_color ?? DEFAULT_APPEARANCE.muted_color ?? "#9aaabe"}
              onChange={(v) => update("muted_color", v)}
            />
            <ColorRow
              label="Erotinviivat"
              value={form.line_color ?? DEFAULT_APPEARANCE.line_color ?? "#1a2a3e"}
              onChange={(v) => update("line_color", v)}
            />
          </div>

          <div className={styles.appearanceActions}>
            <button type="button" className={styles.secondaryBtn} onClick={handleReset}>
              <RotateCcw size={15} /> Palauta oletukset
            </button>
            <button type="button" className={styles.primaryBtn} onClick={handleSave} disabled={saving}>
              <Save size={15} />
              {saving ? "Tallennetaan…" : "Tallenna muutokset"}
            </button>
          </div>
        </div>

        {/* Live preview */}
        <div className={styles.appearancePreviewPane}>
          <div className={styles.appearancePreviewToolbar}>
            <div className={styles.appearanceNavBtns}>
              <button
                type="button"
                onClick={goBack}
                disabled={!canBack}
                aria-label="Takaisin"
                title="Takaisin"
              >
                <ArrowLeft size={15} />
              </button>
              <button
                type="button"
                onClick={goForward}
                disabled={!canFwd}
                aria-label="Eteenpäin"
                title="Eteenpäin"
              >
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                onClick={reload}
                aria-label="Päivitä"
                title="Päivitä"
              >
                <RefreshCw size={15} />
              </button>
            </div>

            <form className={styles.appearanceAddressForm} onSubmit={handleAddressSubmit}>
              <input
                type="text"
                value={addressBar}
                onChange={(e) => setAddressBar(e.target.value)}
                placeholder="/polku"
                className={styles.appearanceAddressInput}
                spellCheck={false}
              />
            </form>

            <select
              className={styles.appearancePageSelect}
              value=""
              onChange={(e) => {
                if (e.target.value) navigateTo(e.target.value);
              }}
            >
              <option value="">Pikalinkit…</option>
              {QUICK_LINKS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            <div className={styles.appearanceDeviceToggle}>
              <button
                type="button"
                className={device === "desktop" ? styles.appearanceDeviceActive : ""}
                onClick={() => setDevice("desktop")}
                aria-label="Työpöytä"
                title="Työpöytä"
              >
                <Monitor size={15} />
              </button>
              <button
                type="button"
                className={device === "mobile" ? styles.appearanceDeviceActive : ""}
                onClick={() => setDevice("mobile")}
                aria-label="Mobiili"
                title="Mobiili"
              >
                <Smartphone size={15} />
              </button>
            </div>

            <a
              className={styles.appearanceOpenLink}
              href={previewPath}
              target="_blank"
              rel="noreferrer"
              title="Avaa uudessa välilehdessä"
            >
              <ExternalLink size={15} />
            </a>
          </div>

          <div
            className={`${styles.appearancePreviewFrameWrap} ${
              device === "mobile" ? styles.appearancePreviewMobile : ""
            }`}
          >
            <iframe
              ref={iframeRef}
              src={previewSrc}
              title="Esikatselu"
              className={styles.appearancePreviewFrame}
              onLoad={applyPreview}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ColorRow({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={styles.appearanceColorRow}>
      <span>{label}</span>
      <span className={styles.appearanceColorInputs}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={styles.appearanceInput}
        />
      </span>
    </label>
  );
}
