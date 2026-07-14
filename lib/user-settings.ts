import { DEFAULT_APPEARANCE } from "@/lib/site-appearance";

export type UserSettings = {
  notificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
  backgroundColor: string;
};

export const USER_SETTINGS_STORAGE_KEY = "maskines-user-settings-v1";
export const USER_SETTINGS_EVENT = "maskines-user-settings-changed";

export const defaultUserSettings: UserSettings = {
  notificationsEnabled: true,
  notificationSoundEnabled: true,
  backgroundColor: DEFAULT_APPEARANCE.background_color ?? "#0b1118"
};

function normalizeSettings(value: unknown): UserSettings {
  const raw = value && typeof value === "object" ? value as Partial<UserSettings> : {};
  return {
    notificationsEnabled: raw.notificationsEnabled ?? defaultUserSettings.notificationsEnabled,
    notificationSoundEnabled: raw.notificationSoundEnabled ?? defaultUserSettings.notificationSoundEnabled,
    backgroundColor: raw.backgroundColor || defaultUserSettings.backgroundColor
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

export function applyUserBackgroundColor(color: string) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const isLight = isLightColor(color);
  const textColor = isLight ? "#101820" : "#f4f8fc";
  const mutedColor = isLight ? "#506172" : "#9aaabe";

  root.dataset.userBackgroundTone = isLight ? "light" : "dark";
  root.style.setProperty("--maskines-page-background", color);
  root.style.setProperty("--maskines-page-text", textColor);
  root.style.setProperty("--maskines-page-muted", mutedColor);
  root.style.setProperty("--maskines-settings-panel-bg", "rgba(14, 23, 33, 0.92)");
  root.style.setProperty("--maskines-settings-panel-border", "rgba(151, 178, 205, 0.18)");
  root.style.setProperty("--maskines-settings-divider", "rgba(151, 178, 205, 0.12)");
  root.style.setProperty("--bg", color);
  root.style.setProperty("--site-bg", color);
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
