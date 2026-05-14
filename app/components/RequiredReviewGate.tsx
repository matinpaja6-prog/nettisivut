"use client";

import { FormEvent, useEffect, useState } from "react";
import { Star } from "lucide-react";

import {
  createSellerReviewForRequest,
  getPendingPurchaseReviewRequests,
  getProfile,
  supabase,
  type PurchaseReviewRequest
} from "@/lib/supabase";

function getErrorMessage(error: unknown) {
  if (!error) return "Tuntematon virhe.";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Tuntematon virhe.";
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
) {
  let timeoutId: number | undefined;

  const timeoutPromise =
    new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(
          new Error(
            "Supabase ei vastannut ajoissa. Tarkista SQL ja kokeile uudestaan."
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
  const [userId, setUserId] = useState("");
  const [reviewerName, setReviewerName] = useState("Käyttäjä");
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
      const {
        data: { user }
      } = await supabase!.auth.getUser();

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
      setStatus("Kirjoita lyhyt arvostelu kaupasta.");
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
        12000
      );

      if (error) {
        setStatus(
          `Arvostelun tallennus epäonnistui: ${getErrorMessage(error)}`
        );
        setSaving(false);
        return;
      }
    } catch (error) {
      setStatus(
        `Arvostelun tallennus epäonnistui: ${getErrorMessage(error)}`
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
          aria-label="Sulje"
          onClick={() => setSelectedRequestId("")}
        >
          ×
        </button>

        <div className="review-gate-icon">
          <Star size={28} />
        </div>
        <h2>Anna arvio myyjästä</h2>
        <p>
          Ostit tuotteen <strong>{request.listing_title}</strong>. Voit antaa
          arvostelun nyt tai sulkea tämän ja tehdä sen myöhemmin ilmoituskellosta.
        </p>

        <div className="review-gate-stars" aria-label="Arvosana">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={value <= rating ? "active" : ""}
              aria-label={`${value} tähteä`}
              onClick={() => setRating(value)}
            >
              <Star size={24} />
            </button>
          ))}
        </div>

        <label>
          Kerro lyhyesti miten kauppa sujui
          <textarea
            minLength={2}
            required
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Esim. Kauppa sujui hyvin ja tuote oli kuvauksen mukainen."
          />
        </label>

        {status ? <span className="review-gate-status">{status}</span> : null}

        <button type="submit" disabled={saving}>
          {saving ? "Tallennetaan..." : "Lähetä arvostelu"}
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
          color: #1d4ed8;
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
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
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
          background: #1d4ed8;
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
