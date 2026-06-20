"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import {
  getListingById,
  getOrCreateConversationForListing,
  supabase
} from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n";
import { pagePath } from "@/lib/routes";

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function StartListingConversationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLanguage();
  const messagesHref = pagePath("messages", locale);

  useEffect(() => {
    let stopped = false;

    function fallbackToMessages() {
      if (!stopped) router.replace(messagesHref);
    }

    async function openConversation() {
      const existingConversationId = searchParams.get("conversation");

      if (existingConversationId) {
        router.replace(`${messagesHref}?conversation=${encodeURIComponent(existingConversationId)}`);
        return;
      }

      const listingId = getParamValue(params.id);
      if (!listingId || !supabase) {
        fallbackToMessages();
        return;
      }

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (stopped) return;

      if (!user) {
        router.replace(pagePath("auth", locale));
        return;
      }

      const { data: listing, error: listingError } = await getListingById(listingId);

      if (stopped) return;

      if (listingError || !listing) {
        fallbackToMessages();
        return;
      }

      const sellerId = listing.seller_id || listing.user_id || "";
      if (!sellerId) {
        fallbackToMessages();
        return;
      }

      const { data: conversation, error: conversationError } =
        await getOrCreateConversationForListing({
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: sellerId
        });

      if (stopped) return;

      if (conversationError || !conversation) {
        fallbackToMessages();
        return;
      }

      router.replace(`${messagesHref}?conversation=${encodeURIComponent(conversation.id)}`);
    }

    void openConversation();

    return () => {
      stopped = true;
    };
  }, [locale, messagesHref, params.id, router, searchParams]);

  return null;
}
