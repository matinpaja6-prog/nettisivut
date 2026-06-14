"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
  useSearchParams
} from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  getListingById,
  getOrCreateConversationForListing,
  supabase
} from "@/lib/supabase";

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

export default function StartListingConversationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] =
    useState("");

  useEffect(() => {
    let stopped = false;

    async function openConversation() {
      const existingConversationId =
        searchParams.get("conversation");

      if (existingConversationId) {
        router.replace(
          `/messages?conversation=${encodeURIComponent(existingConversationId)}`
        );
        return;
      }

      const listingId =
        getParamValue(params.id);

      if (!listingId) {
        setError("Ilmoitusta ei löytynyt.");
        return;
      }

      if (!supabase) {
        setError("Viestit eivät ole juuri nyt käytettävissä.");
        return;
      }

      const {
        data: { user }
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data: listing, error: listingError } =
        await getListingById(listingId);

      if (
        stopped ||
        listingError ||
        !listing
      ) {
        setError("Ilmoitusta ei löytynyt.");
        return;
      }

      const sellerId =
        listing.seller_id ||
        listing.user_id ||
        "";

      if (!sellerId) {
        setError("Myyjää ei löytynyt tälle ilmoitukselle.");
        return;
      }

      const { data: conversation, error: conversationError } =
        await getOrCreateConversationForListing({
          listing_id:
            listing.id,
          buyer_id:
            user.id,
          seller_id:
            sellerId
        });

      if (
        stopped ||
        conversationError ||
        !conversation
      ) {
        setError(
          conversationError instanceof Error
            ? conversationError.message
            : "Keskustelua ei voitu avata."
        );
        return;
      }

      router.replace(
        `/messages?conversation=${encodeURIComponent(conversation.id)}`
      );
    }

    openConversation();

    return () => {
      stopped = true;
    };
  }, [
    params.id,
    router,
    searchParams
  ]);

  return (
    <main className="messages-page messages-start-page">
      <section className="messages-start-card">
        {error ? (
          <>
            <h1>Keskustelua ei voitu avata</h1>
            <p>{error}</p>
            <Link href="/messages">
              Avaa viestit
            </Link>
          </>
        ) : (
          <>
            <Loader2
              size={24}
              className="messages-start-spinner"
              aria-hidden="true"
            />
            <h1>Avataan keskustelua</h1>
          </>
        )}
      </section>

      <style jsx>{`
        .messages-start-page {
          min-height: calc(100dvh - var(--topbar-h, 56px));
          display: grid;
          place-items: center;
          padding: 24px;
          background: #10232d;
          color: #f6fbff;
        }

        .messages-start-card {
          width: min(420px, 100%);
          display: grid;
          justify-items: center;
          gap: 12px;
          padding: 26px;
          border: 1px solid rgba(57, 92, 120, 0.78);
          border-radius: 8px;
          background: #061522;
          text-align: center;
        }

        h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 950;
        }

        p {
          margin: 0;
          color: #aebdca;
          font-size: 13px;
          line-height: 1.45;
        }

        a {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          border-radius: 5px;
          background: linear-gradient(135deg, #ff8518, #ff6900);
          color: #ffffff;
          font-size: 12px;
          font-weight: 900;
          text-decoration: none;
        }

        .messages-start-spinner {
          animation: spin 0.8s linear infinite;
          color: #ff8518;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}
