"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  awardReferralPoints,
  getSafeAuthSession,
  getProfile,
  getReferrerIdByCode,
  isProfileCompleted,
  supabase,
  type UserProfile
} from "@/lib/supabase";

const REFERRAL_STORAGE_KEY = "pending_referral_code";
const ALLOWED_PATHS = ["/auth", "/profile", "/privacy"];

async function tryClaimPendingReferral(userId: string) {
  if (typeof window === "undefined") return;
  let code: string | null = null;
  try {
    code = localStorage.getItem(REFERRAL_STORAGE_KEY);
  } catch {}
  if (!code) return;

  const referrerId = await getReferrerIdByCode(code);
  if (!referrerId || referrerId === userId) {
    try { localStorage.removeItem(REFERRAL_STORAGE_KEY); } catch {}
    return;
  }

  const result = await awardReferralPoints(referrerId, userId, 100);
  if (result.success || result.error === "already_referred") {
    try { localStorage.removeItem(REFERRAL_STORAGE_KEY); } catch {}
  }
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

      void tryClaimPendingReferral(user.id);

      const { data: profile } = await getProfile(user.id);
      const incomplete = !isProfileCompleted(profile as UserProfile | null);

      if (cancelled) return;

      setNeedsProfile(incomplete);
      setChecked(true);

      if (incomplete && !ALLOWED_PATHS.some((path) => pathname.startsWith(path))) {
        router.replace("/auth");
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
