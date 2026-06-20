"use client";

/**
 * ============================================================================
 * AppHeader — uudelleenkäytettävä yläpalkki
 * ============================================================================
 *
 * Mockupin mukainen tumma yläpalkki:
 *   • Logo + tagline (vasemmalla)
 *   • Hakukenttä keskellä (Ctrl+K)
 *   • Ilmoitukset-kello + Viestit-pala + Käyttäjäpilli oikealla
 *
 * Käyttö:
 *   ```tsx
 *   import AppHeader from "@/app/components/AppHeader";
 *
 *   <AppHeader />            // perustila
 *   <AppHeader variant="dark" /> // tumma
 *   ```
 *
 * Logon ja värit voi vaihtaa muokkaamalla `lib/branding.ts`.
 */

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Bell, MessageSquare, Search, User as UserIcon, ChevronDown } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { getSafeAuthUser, supabase } from "@/lib/supabase";
import { branding } from "@/lib/branding";
import { useLanguage } from "@/lib/i18n";
import { pagePath, profileRootPath } from "@/lib/routes";

import styles from "./AppHeader.module.css";

type Props = {
  /** "light" = vaalea, "dark" = tumma. Default: dark */
  variant?: "light" | "dark";
  /** Käyttäjä — jos null, näytetään Kirjaudu-painike */
  user?: User | null;
  /** Hakukenttä piiloon */
  hideSearch?: boolean;
  /** Hakukentän alkuarvo */
  searchValue?: string;
  /** Hakukentän muutos */
  onSearchChange?: (value: string) => void;
  /** Hakukentän submit (Enter) */
  onSearchSubmit?: (value: string) => void;
  /** Lukemattomien ilmoitusten määrä */
  notificationCount?: number;
  /** Lukemattomien viestien määrä */
  messageCount?: number;
};

export default function AppHeader({
  variant = "dark",
  user: userProp,
  hideSearch = false,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  notificationCount = 0,
  messageCount = 0
}: Props) {
  const { locale } = useLanguage();
  const [user, setUser] = useState<User | null>(userProp ?? null);
  const [localSearch, setLocalSearch] = useState(searchValue ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  // Hae käyttäjä jos ei annettu propsina
  useEffect(() => {
    if (userProp !== undefined) {
      setUser(userProp);
      return;
    }
    if (!supabase) return;
    getSafeAuthUser()
      .then((currentUser) => setUser(currentUser))
      .catch(() => setUser(null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, [userProp]);

  // Ctrl+K → fokus hakuun
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Synkronoi controlled search
  useEffect(() => {
    if (searchValue !== undefined) setLocalSearch(searchValue);
  }, [searchValue]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit?.(localSearch);
  };

  return (
    <header className={`${styles.appHeader} ${variant === "dark" ? styles.dark : styles.light}`}>
      <div className={styles.inner}>
        {/* Logo */}
        <Link href="/" className={styles.brand}>
          {branding.useLogoImage && branding.logoSrc ? (
            <Image
              src={branding.logoSrc}
              alt={branding.siteName}
              width={40}
              height={40}
              className={styles.brandImage}
            />
          ) : (
            <div className={styles.brandMark} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
              </svg>
            </div>
          )}
          <div className={styles.brandText}>
            <span className={styles.brandName}>
              <strong>{branding.logoLeft}</strong>
              <span>{branding.logoRight}</span>
            </span>
            <span className={styles.brandTagline}>{branding.tagline}</span>
          </div>
        </Link>

        {/* Haku */}
        {!hideSearch && (
          <form className={styles.searchBar} onSubmit={handleSearchSubmit}>
            <Search size={16} className={styles.searchIcon} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Etsi osia, ilmoituksia tai käyttäjiä..."
              className={styles.searchInput}
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                onSearchChange?.(e.target.value);
              }}
            />
            <kbd className={styles.kbd}>CTRL K</kbd>
          </form>
        )}

        {/* Oikea puoli */}
        <div className={styles.right}>
          {/* Ilmoitukset */}
          <Link href={pagePath("search-alerts", locale)} className={styles.iconBtn} aria-label="Ilmoitukset">
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className={styles.badge}>{notificationCount > 9 ? "9+" : notificationCount}</span>
            )}
          </Link>

          {/* Viestit */}
          <Link href={pagePath("messages", locale)} className={styles.iconBtn} aria-label="Viestit">
            <MessageSquare size={18} />
            {messageCount > 0 && (
              <span className={styles.badge}>{messageCount > 9 ? "9+" : messageCount}</span>
            )}
          </Link>

          {/* Käyttäjä */}
          {user ? (
            <Link href={profileRootPath(locale)} className={styles.userPill}>
              <span className={styles.userPillAvatar}>
                <UserIcon size={14} />
              </span>
              <span className={styles.userPillEmail}>{user.email ?? "Profiili"}</span>
              <ChevronDown size={14} className={styles.userPillChevron} />
            </Link>
          ) : (
            <Link href={pagePath("auth", locale)} className={styles.loginBtn}>
              Kirjaudu
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
