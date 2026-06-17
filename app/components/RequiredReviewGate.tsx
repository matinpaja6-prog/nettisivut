"use client";

import { FormEvent, useEffect, useState } from "react";
import { Star } from "lucide-react";

import {
  createSellerReviewForRequest,
  getSafeAuthUser,
  getPendingPurchaseReviewRequests,
  getProfile,
  supabase,
  type PurchaseReviewRequest
} from "@/lib/supabase";
import { useLanguage, type Locale } from "@/lib/i18n";

const reviewGateText: Record<Locale, {
  unknownError: string;
  timeoutError: string;
  defaultUser: string;
  commentRequired: string;
  saveFailed: string;
  close: string;
  title: string;
  introStart: string;
  introEnd: string;
  rating: string;
  starLabel: (value: number) => string;
  commentLabel: string;
  commentPlaceholder: string;
  saving: string;
  submit: string;
}> = {
  fi: {
    unknownError: "Tuntematon virhe.",
    timeoutError: "Supabase ei vastannut ajoissa. Tarkista SQL ja kokeile uudestaan.",
    defaultUser: "Käyttäjä",
    commentRequired: "Kirjoita lyhyt arvostelu kaupasta.",
    saveFailed: "Arvostelun tallennus epäonnistui",
    close: "Sulje",
    title: "Anna arvio myyjästä",
    introStart: "Ostit tuotteen",
    introEnd: "Voit antaa arvostelun nyt tai sulkea tämän ja tehdä sen myöhemmin ilmoituskellosta.",
    rating: "Arvosana",
    starLabel: (value) => `${value} tähteä`,
    commentLabel: "Kerro lyhyesti miten kauppa sujui",
    commentPlaceholder: "Esim. Kauppa sujui hyvin ja tuote oli kuvauksen mukainen.",
    saving: "Tallennetaan...",
    submit: "Lähetä arvostelu"
  },
  en: {
    unknownError: "Unknown error.",
    timeoutError: "Supabase did not respond in time. Check the SQL and try again.",
    defaultUser: "User",
    commentRequired: "Write a short review about the trade.",
    saveFailed: "Saving the review failed",
    close: "Close",
    title: "Review the seller",
    introStart: "You bought",
    introEnd: "You can leave the review now, or close this and do it later from the notification bell.",
    rating: "Rating",
    starLabel: (value) => `${value} stars`,
    commentLabel: "Briefly describe how the trade went",
    commentPlaceholder: "For example: The trade went well and the product matched the description.",
    saving: "Saving...",
    submit: "Send review"
  },
  sv: {
    unknownError: "Okänt fel.",
    timeoutError: "Supabase svarade inte i tid. Kontrollera SQL och försök igen.",
    defaultUser: "Användare",
    commentRequired: "Skriv en kort recension om affären.",
    saveFailed: "Det gick inte att spara recensionen",
    close: "Stäng",
    title: "Ge säljaren ett omdöme",
    introStart: "Du köpte",
    introEnd: "Du kan ge omdömet nu eller stänga detta och göra det senare via notifieringsklockan.",
    rating: "Betyg",
    starLabel: (value) => `${value} stjärnor`,
    commentLabel: "Beskriv kort hur affären gick",
    commentPlaceholder: "Till exempel: Affären gick bra och produkten motsvarade beskrivningen.",
    saving: "Sparar...",
    submit: "Skicka omdöme"
  },
  no: {
    unknownError: "Ukjent feil.",
    timeoutError: "Supabase svarte ikke i tide. Kontroller SQL og prøv igjen.",
    defaultUser: "Bruker",
    commentRequired: "Skriv en kort vurdering av handelen.",
    saveFailed: "Kunne ikke lagre vurderingen",
    close: "Lukk",
    title: "Gi vurdering av selgeren",
    introStart: "Du kjøpte",
    introEnd: "Du kan gi vurderingen nå, eller lukke dette og gjøre det senere fra varselklokken.",
    rating: "Vurdering",
    starLabel: (value) => `${value} stjerner`,
    commentLabel: "Fortell kort hvordan handelen gikk",
    commentPlaceholder: "For eksempel: Handelen gikk bra og produktet var som beskrevet.",
    saving: "Lagrer...",
    submit: "Send vurdering"
  },
  et: {
    unknownError: "Tundmatu viga.",
    timeoutError: "Supabase ei vastanud õigel ajal. Kontrolli SQL-i ja proovi uuesti.",
    defaultUser: "Kasutaja",
    commentRequired: "Kirjuta tehingu kohta lühike arvustus.",
    saveFailed: "Arvustuse salvestamine ebaõnnestus",
    close: "Sulge",
    title: "Hinda müüjat",
    introStart: "Ostsid toote",
    introEnd: "Saad arvustuse anda kohe või selle sulgeda ja teha hiljem teavituskellast.",
    rating: "Hinnang",
    starLabel: (value) => `${value} tärni`,
    commentLabel: "Kirjelda lühidalt, kuidas tehing sujus",
    commentPlaceholder: "Näiteks: Tehing sujus hästi ja toode vastas kirjeldusele.",
    saving: "Salvestamine...",
    submit: "Saada arvustus"
  }
};

function getErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return fallback;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
) {
  let timeoutId: number | undefined;

  const timeoutPromise =
    new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(
          new Error(
            timeoutMessage
          )
        );
      }, timeoutMs);
    });

  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });
}

export default function RequiredReviewGate() {
  const { locale } = useLanguage();
  const text = reviewGateText[locale] ?? reviewGateText.fi;
  const [userId, setUserId] = useState("");
  const [reviewerName, setReviewerName] = useState(text.defaultUser);
  const [requests, setRequests] = useState<PurchaseReviewRequest[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    async function loadUser() {
      const user = await getSafeAuthUser();

      if (!mounted) return;

      const nextUserId = user?.id ?? "";
      setUserId(nextUserId);

      if (!nextUserId) {
        setRequests([]);
        return;
      }

      const [{ data: pending }, { data: profile }] =
        await Promise.all([
          getPendingPurchaseReviewRequests(nextUserId),
          getProfile(nextUserId)
        ]);

      if (!mounted) return;

      setRequests(pending ?? []);
      if (profile?.full_name) {
        setReviewerName(profile.full_name);
      }
    }

    loadUser();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      void loadUser();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function openRequestedReview(event: Event) {
      const requestId =
        (event as CustomEvent<{ requestId?: string }>).detail?.requestId ?? "";

      if (requestId) {
        setSelectedRequestId(requestId);
        setStatus("");
      }
    }

    window.addEventListener(
      "open-purchase-review",
      openRequestedReview
    );

    return () => {
      window.removeEventListener(
        "open-purchase-review",
        openRequestedReview
      );
    };
  }, []);

  const request =
    selectedRequestId
      ? requests.find((item) => item.id === selectedRequestId) ?? null
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!request || !userId || comment.trim().length < 2) {
      setStatus(text.commentRequired);
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const { error } =
        await withTimeout(
        createSellerReviewForRequest(
          request.id,
          {
            seller_id: request.seller_id,
            reviewer_id: userId,
            reviewer_name: reviewerName,
            rating,
            comment: comment.trim()
          }
        ),
        12000,
        text.timeoutError
      );

      if (error) {
        setStatus(
          `${text.saveFailed}: ${getErrorMessage(error, text.unknownError)}`
        );
        setSaving(false);
        return;
      }
    } catch (error) {
      setStatus(
        `${text.saveFailed}: ${getErrorMessage(error, text.unknownError)}`
      );
      setSaving(false);
      return;
    }

    setRequests((current) =>
      current.filter((item) => item.id !== request.id)
    );
    setSelectedRequestId("");
    setComment("");
    setRating(5);
    setSaving(false);
  }

  if (!request) {
    return null;
  }

  return (
    <div className="review-gate" role="dialog" aria-modal="true">
      <form className="review-gate-card" onSubmit={handleSubmit}>
        <button
          type="button"
          className="review-gate-close"
          aria-label={text.close}
          onClick={() => setSelectedRequestId("")}
        >
          ×
        </button>

        <div className="review-gate-icon">
          <Star size={28} />
        </div>
        <h2>{text.title}</h2>
        <p>
          {text.introStart} <strong>{request.listing_title}</strong>. {text.introEnd}
        </p>

        <div className="review-gate-stars" aria-label={text.rating}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={value <= rating ? "active" : ""}
              aria-label={text.starLabel(value)}
              onClick={() => setRating(value)}
            >
              <Star size={24} />
            </button>
          ))}
        </div>

        <label>
          {text.commentLabel}
          <textarea
            minLength={2}
            required
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={text.commentPlaceholder}
          />
        </label>

        {status ? <span className="review-gate-status">{status}</span> : null}

        <button type="submit" disabled={saving}>
          {saving ? text.saving : text.submit}
        </button>
      </form>

      <style jsx>{`
        .review-gate {
          position: fixed;
          inset: 0;
          z-index: 10000;
          background: rgba(15, 23, 42, 0.72);
          display: grid;
          place-items: center;
          padding: 22px;
          backdrop-filter: blur(10px);
        }

        .review-gate-card {
          width: min(520px, 100%);
          border-radius: 22px;
          background: linear-gradient(180deg, #ffffff 0%, #eef7fd 100%) !important;
          border: 1px solid rgba(100, 116, 139, 0.18) !important;
          box-shadow: 0 32px 100px rgba(15, 23, 42, 0.35) !important;
          padding: 28px;
          display: grid;
          gap: 16px;
          color: #071827 !important;
          position: relative;
        }

        .review-gate-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #0f172a;
          cursor: pointer;
          font-size: 24px;
          line-height: 1;
        }

        .review-gate-icon {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: #dbeafe;
          color: #ff7a1a;
          display: grid;
          place-items: center;
        }

        .review-gate-card h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 950;
          line-height: 1.15;
          color: #071827 !important;
        }

        .review-gate-card p {
          margin: 0;
          color: #25445c !important;
          font-weight: 650;
          line-height: 1.5;
        }

        .review-gate-card p strong {
          color: #071827 !important;
          font-weight: 950 !important;
        }

        .review-gate-stars {
          display: flex;
          gap: 6px;
        }

        .review-gate-stars button {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #94a3b8;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .review-gate-stars button.active {
          background: rgba(255, 122, 26, 0.14);
          border-color: #bfdbfe;
          color: #ff7a1a;
        }

        .review-gate-card label {
          display: grid;
          gap: 8px;
          font-size: 13px;
          font-weight: 850;
          color: #17344a !important;
        }

        .review-gate-card textarea {
          min-height: 120px;
          resize: vertical;
          border-radius: 14px;
          border: 1.5px solid rgba(126, 156, 179, 0.42) !important;
          background: #d9e8f3 !important;
          padding: 12px;
          font: inherit;
          color: #071827 !important;
          outline: none;
        }

        .review-gate-card textarea::placeholder {
          color: #3b5568 !important;
          opacity: 1 !important;
        }

        .review-gate-card textarea:focus {
          border-color: #2563eb !important;
          background: #ffffff !important;
        }

        .review-gate-status {
          color: #dc2626;
          font-size: 13px;
          font-weight: 800;
        }

        .review-gate-card > button[type="submit"] {
          height: 46px;
          border-radius: 14px;
          border: 0;
          background: #ff7a1a;
          color: #ffffff;
          font-weight: 950;
          cursor: pointer;
        }

        .review-gate-card > button[type="submit"]:disabled {
          background: #94a3b8;
          cursor: wait;
        }
      `}</style>
    </div>
  );
}
