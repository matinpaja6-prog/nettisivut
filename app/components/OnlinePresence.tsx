"use client";

import { useEffect } from "react";

import {
  ensureCurrentUserProfileName,
  getSafeAuthUser,
  supabase
} from "@/lib/supabase";

export default function OnlinePresence() {

  useEffect(() => {

    if (!supabase) {
      return;
    }

    const client = supabase;

    let userId = "";
    let stopped = false;
    let ensuredProfileName = false;

    async function getUserId() {

      const user =
        await getSafeAuthUser();

      if (!user) {
        return "";
      }

      return user.id;

    }

    async function markOnline() {

      const id =
        userId ||
        await getUserId();

      if (
        !id ||
        stopped
      ) {
        return;
      }

      userId = id;

      if (!ensuredProfileName) {
        ensuredProfileName = true;
        await ensureCurrentUserProfileName();
      }

      await client
        .from("profiles")
        .update({
          online: true,
          last_seen:
            new Date().toISOString()
        })
        .eq("id", id);

    }

    function markOffline() {

      if (!userId) {
        return;
      }

      client
        .from("profiles")
        .update({
          online: false,
          last_seen:
            new Date().toISOString()
        })
        .eq("id", userId)
        .then(() => undefined);

    }

    markOnline();

    const interval =
      window.setInterval(
        markOnline,
        20000
      );

    function handleVisibilityChange() {

      if (
        document.visibilityState ===
        "visible"
      ) {
        markOnline();
        return;
      }

      markOffline();

    }

    window.addEventListener(
      "beforeunload",
      markOffline
    );

    window.addEventListener(
      "focus",
      markOnline
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {

      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener(
        "beforeunload",
        markOffline
      );
      window.removeEventListener(
        "focus",
        markOnline
      );
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      markOffline();

    };

  }, []);

  return null;

}
