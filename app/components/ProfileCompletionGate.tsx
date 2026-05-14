"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import {
  awardReferralPoints,
  getProfile,
  getReferrerIdByCode,
  isProfileCompleted,
  supabase,
  type UserProfile
} from "@/lib/supabase";

const REFERRAL_STORAGE_KEY = "pending_referral_code";

async function tryClaimPendingReferral(userId: string) {
  if (typeof window === "undefined") return;
  let code: string | null = null;
  try {
    code = localStorage.getItem(REFERRAL_STORAGE_KEY);
  } catch {}
  if (!code) return;

  console.log("[Referral] (gate) checking pending code:", code);
  const referrerId = await getReferrerIdByCode(code);
  if (!referrerId || referrerId === userId) {
    try { localStorage.removeItem(REFERRAL_STORAGE_KEY); } catch {}
    return;
  }
  const result = await awardReferralPoints(referrerId, userId, 100);
  console.log("[Referral] (gate) award result:", result);
  if (result.success || result.error === "already_referred") {
    try { localStorage.removeItem(REFERRAL_STORAGE_KEY); } catch {}
  }
}

/**
 * Global gate that forces logged-in users with incomplete profiles
 * to finish their profile on /auth before doing anything else.
 *
 * Allowed routes while profile incomplete:
 *  - /auth          (where the profile completion form lives)
 *  - /              root - redirect handled below to /auth
 *
 * All other routes redirect to /auth.
 */

const ALLOWED_PATHS = ["/auth", "/profile", "/privacy"];

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
      const { data: sessionData } = await supabase!.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        if (!cancelled) {
          setNeedsProfile(false);
          setChecked(true);
        }
        return;
      }

      // Always try to claim referral on every auth state change / page load
      void tryClaimPendingReferral(user.id);

      const { data: profile } = await getProfile(user.id);
      const incomplete = !isProfileCompleted(profile as UserProfile | null);

      if (cancelled) return;

      setNeedsProfile(incomplete);
      setChecked(true);

      if (incomplete && !ALLOWED_PATHS.some((p) => pathname.startsWith(p))) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Render nothing — this is a navigation guard.
  // We could render an overlay if redirect is delayed:
  if (!checked) return null;
  if (!needsProfile) return null;
  if (ALLOWED_PATHS.some((p) => pathname.startsWith(p))) return null;

  // Fallback overlay in case redirect hasn't happened yet
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 26, 58, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 18,
          padding: 28,
          maxWidth: 420,
          textAlign: "center",
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)"
        }}
      >
        <LockKeyhole size={36} style={{ color: "#087995", marginBottom: 12 }} />
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900 }}>
          Viimeistele profiilisi
        </h2>
        <p style={{ margin: "0 0 18px", color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
          Täytä profiilisi tiedot ennen kuin voit jatkaa palvelun käyttöä.
        </p>
        <button
          type="button"
          onClick={() => router.replace("/auth")}
          style={{
            background: "linear-gradient(135deg, #065f75 0%, #087995 100%)",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "12px 22px",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer"
          }}
        >
          Jatka profiiliin
        </button>
      </div>
    </div>
  );
}
