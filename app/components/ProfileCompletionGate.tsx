"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "@/lib/navigation";
import {
  getSafeAuthSession,
  getProfile,
  isProfileCompleted,
  supabase,
  type UserProfile
} from "@/lib/supabase";
import {
  canonicalPathFromLocalized,
  pagePath,
  profileRootPath
} from "@/lib/routes";

const ALLOWED_CANONICAL_PATHS = ["/auth", "/profile", "/privacy"];

function isProfileCompletionAllowedPath(pathname: string) {
  const canonicalPath = canonicalPathFromLocalized(pathname);

  if (ALLOWED_CANONICAL_PATHS.some((path) => canonicalPath.startsWith(path))) {
    return true;
  }

  return ["fi", "en", "sv", "no"].some((locale) =>
    pathname.startsWith(pagePath("auth", locale)) ||
    pathname.startsWith(profileRootPath(locale)) ||
    pathname.startsWith(pagePath("privacy", locale))
  );
}

export default function ProfileCompletionGate() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [needsProfile, setNeedsProfile] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setChecked(true);
      return;
    }

    let cancelled = false;

    async function check() {
      const user = (await getSafeAuthSession())?.user;

      if (!user) {
        if (!cancelled) {
          setNeedsProfile(false);
          setChecked(true);
        }
        return;
      }

      const { data: profile } = await getProfile(user.id);
      const incomplete = !isProfileCompleted(profile as UserProfile | null);

      if (cancelled) return;

      setNeedsProfile(incomplete);
      setChecked(true);

      if (incomplete && !isProfileCompletionAllowedPath(pathname)) {
        router.replace(pagePath("auth"));
      }
    }

    void check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void check();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Silent navigation guard: no overlay/text, so profile-completion copy cannot flash.
  void checked;
  void needsProfile;
  return null;
}
