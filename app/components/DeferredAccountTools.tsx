"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { getSafeAuthSession, supabase } from "@/lib/supabase";
import { usePathname } from "@/lib/navigation";
import { canonicalPathFromLocalized } from "@/lib/routes";
import { useLanguage } from "@/lib/i18n";

const FloatingChat = dynamic(() => import("./FloatingChat"), { ssr: false });
const RequiredReviewGate = dynamic(() => import("./RequiredReviewGate"), { ssr: false });

// Guests need neither the conversation renderer nor the review form bundle.
// Auth changes load account tools immediately; guest chat loads on first use.
export default function DeferredAccountTools() {
  const [signedIn, setSignedIn] = useState(false);
  const [chatRequested, setChatRequested] = useState(false);
  const pathname = canonicalPathFromLocalized(usePathname() || "/");
  const { t } = useLanguage();
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authChanged = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      authChanged = true;
      if (active) { setSignedIn(Boolean(session?.user)); setChatRequested(false); }
    });
    void getSafeAuthSession().then(session => {
      if (active && !authChanged) setSignedIn(Boolean(session?.user));
    }).catch(() => {});
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const hidden = ["/admin", "/auth", "/messages", "/profile", "/privacy", "/terms"].some(prefix => pathname.startsWith(prefix));
  return <>
    {signedIn && <RequiredReviewGate />}
    {!hidden && (signedIn || chatRequested ? <FloatingChat initialOpen={chatRequested} />
      : <button type="button" className="rebuilt-chat-button deferred-chat-button" data-chat-open="false"
        aria-label={t.messages} onClick={() => setChatRequested(true)}><MessageCircle size={22} /></button>)}
  </>;
}
