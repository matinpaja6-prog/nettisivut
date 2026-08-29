export type UserSettings = {
  notificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
  theme: UserTheme;
};

export type UserTheme = "dark" | "light" | "system";

export const USER_SETTINGS_STORAGE_KEY = "maskines-user-settings-v1";
export const USER_SETTINGS_EVENT = "maskines-user-settings-changed";

export const defaultUserSettings: UserSettings = {
  notificationsEnabled: true,
  notificationSoundEnabled: true,
  theme: "dark"
};

function normalizeSettings(value: unknown): UserSettings {
  const raw = value && typeof value === "object"
    ? value as Partial<UserSettings> & { backgroundColor?: string }
    : {};
  const legacyTheme = raw.backgroundColor && isLightColor(raw.backgroundColor) ? "light" : "dark";
  return {
    notificationsEnabled: raw.notificationsEnabled ?? defaultUserSettings.notificationsEnabled,
    notificationSoundEnabled: raw.notificationSoundEnabled ?? defaultUserSettings.notificationSoundEnabled,
    theme: raw.theme === "light" || raw.theme === "dark" || raw.theme === "system" ? raw.theme : legacyTheme
  };
}

export function readUserSettings(): UserSettings {
  if (typeof window === "undefined") return defaultUserSettings;

  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(USER_SETTINGS_STORAGE_KEY) ?? "{}"));
  } catch {
    return defaultUserSettings;
  }
}

export function saveUserSettings(nextSettings: UserSettings) {
  if (typeof window === "undefined") return;

  localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  window.dispatchEvent(new CustomEvent(USER_SETTINGS_EVENT, { detail: nextSettings }));
}

export function applyUserTheme(theme: UserTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const resolvedTheme = theme === "system"
    ? typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark"
    : theme;
  const isLight = resolvedTheme === "light";
  const palette = isLight
    ? {
        background: "#f0f2f3",
        surface: "#fcfcfb",
        surfaceRaised: "#f5f6f6",
        surfaceSoft: "#e8ecee",
        text: "#16232c",
        muted: "#5f707c",
        soft: "#344854",
        line: "#cbd3d7",
        topbar: "#fcfcfb",
        panelBorder: "#cbd3d7",
        divider: "#dfe4e6"
      }
    : {
        background: "#0b1118",
        // Keep every dark-theme sheet on the same navy surface.  These
        // values feed cards, side panels, forms and modal surfaces across
        // the whole application, so individual pages no longer drift to
        // slightly different blue/grey shades.
        surface: "#061a2c",
        surfaceRaised: "#061a2c",
        surfaceSoft: "#061a2c",
        text: "#f4f8fc",
        muted: "#9aaabe",
        soft: "#c9d5e2",
        line: "rgba(151, 178, 205, 0.22)",
        topbar: "#06131f",
        panelBorder: "rgba(151, 178, 205, 0.2)",
        divider: "rgba(151, 178, 205, 0.12)"
      };

  root.dataset.theme = resolvedTheme;
  root.dataset.userBackgroundTone = resolvedTheme;
  root.dataset.themePreference = theme;
  root.style.colorScheme = resolvedTheme;
  root.style.setProperty("--maskines-page-background", palette.background);
  root.style.setProperty("--maskines-page-text", palette.text);
  root.style.setProperty("--maskines-page-muted", palette.muted);
  root.style.setProperty("--maskines-settings-panel-bg", palette.surface);
  root.style.setProperty("--maskines-settings-panel-border", palette.panelBorder);
  root.style.setProperty("--maskines-settings-divider", palette.divider);
  root.style.setProperty("--bg", palette.background);
  root.style.setProperty("--bg-2", palette.surface);
  root.style.setProperty("--surface", palette.surface);
  root.style.setProperty("--surface-2", palette.surfaceRaised);
  root.style.setProperty("--surface-3", palette.surfaceSoft);
  root.style.setProperty("--text", palette.text);
  root.style.setProperty("--muted", palette.muted);
  root.style.setProperty("--soft", palette.soft);
  root.style.setProperty("--line", palette.line);
  root.style.setProperty("--site-bg", palette.background);
  root.style.setProperty("--site-card", palette.surface);
  root.style.setProperty("--listing-card-bg", palette.surface);
  root.style.setProperty("--app-sheet-surface", palette.surface);
  root.style.setProperty("--app-sheet-surface-raised", palette.surfaceRaised);
  root.style.setProperty("--app-sheet-border", palette.line);
  root.style.setProperty("--site-topbar", palette.topbar);
  root.style.setProperty("--brand-dark", palette.background);
  root.style.setProperty("--brand-dark-surface", palette.surface);
  root.style.setProperty("--brand-dark-surface-strong", palette.surfaceRaised);
  root.style.setProperty("--brand-text-on-dark", palette.text);
  root.style.setProperty("--brand-muted-on-dark", palette.muted);
  root.style.setProperty("--orange", "#ff7a1a");
  root.style.setProperty("--orange-2", "#ff8a24");
  root.style.setProperty("--brand-primary", "#ff7a1a");
  root.style.setProperty("--brand-accent", "#ff8a24");
  root.style.setProperty("--app-page-bg", "none");
}

function isLightColor(color: string) {
  const match = color.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return false;

  const hex = match[1];
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62;
}

export function userNotificationsEnabled() {
  return readUserSettings().notificationsEnabled;
}

export function userNotificationSoundEnabled() {
  const settings = readUserSettings();
  return settings.notificationsEnabled && settings.notificationSoundEnabled;
}
