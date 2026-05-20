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
        background: "rgba(1, 5, 12, 0.78)",
        backdropFilter: "blur(12px) saturate(1.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20
      }}
    >
      <div
        style={{
          background:
            "radial-gradient(420px 220px at 100% 0%, rgba(255, 122, 26, 0.14), transparent 72%), linear-gradient(145deg, rgba(13, 29, 46, 0.98), rgba(7, 17, 29, 0.99))",
          border: "1px solid rgba(255, 122, 26, 0.38)",
          borderRadius: 8,
          padding: 30,
          maxWidth: 420,
          textAlign: "center",
          boxShadow: "0 30px 80px rgba(0, 7, 18, 0.52), inset 0 1px 0 rgba(255,255,255,0.06)",
          color: "#f4f8fc"
        }}
      >
        <span
          style={{
            width: 54,
            height: 54,
            margin: "0 auto 14px",
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            background: "linear-gradient(135deg, #ff9d2e 0%, #ff7a1a 58%, #e65c00 100%)",
            boxShadow: "0 16px 36px rgba(255, 122, 26, 0.28), inset 0 1px 0 rgba(255,255,255,0.18)"
          }}
        >
          <LockKeyhole size={28} />
        </span>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 950, color: "#fff" }}>
          Viimeistele profiilisi
        </h2>
        <p style={{ margin: "0 0 20px", color: "rgba(215, 226, 238, 0.82)", fontSize: 14, lineHeight: 1.5 }}>
          Täytä profiilisi tiedot ennen kuin voit jatkaa palvelun käyttöä.
        </p>
        <button
          type="button"
          onClick={() => router.replace("/auth")}
          style={{
            background: "linear-gradient(135deg, #ff9d2e 0%, #ff7a1a 58%, #e65c00 100%)",
            color: "white",
            border: "1px solid rgba(255, 218, 184, 0.7)",
            borderRadius: 8,
            padding: "12px 22px",
            fontWeight: 950,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 16px 36px rgba(255, 122, 26, 0.26), inset 0 1px 0 rgba(255,255,255,0.16)"
          }}
        >
          Jatka profiiliin
        </button>
      </div>
    </div>
  );
}
