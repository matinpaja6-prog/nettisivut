"use client";
import UiText from "@/app/components/UiText";

import Link from "@/app/components/LocalizedLink";
import { useSearchParams } from "next/navigation";

import { useEffect, useState } from "react";

import styles from "@/app/commerce.module.css";
import { getSafeAuthSession } from "@/lib/supabase";

export default function StripeReturnPage() {
  const refresh = useSearchParams().get("refresh") === "1";
  const [status, setStatus] = useState("Päivitetään Stripe-tilan tiedot…");
  const [error, setError] = useState("");

  useEffect(() => {
    getSafeAuthSession().then(async (session) => {
      if (!session) throw new Error("Kirjaudu uudelleen yritystilille.");
      const endpoint = refresh ? "/api/commerce/stripe/connect" : "/api/commerce/stripe/status";
      const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: "{}" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Stripe-tilan päivitys epäonnistui.");
      if (refresh && body.url) { window.location.assign(body.url); return; }
      setStatus(body.ready ? "Stripe-maksut ovat valmiina." : "Stripe tarvitsee vielä lisätietoja. Voit jatkaa onboardingia hallintapaneelista.");
    }).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [refresh]);

  return <main className={styles.page}><div className={styles.shell}><section className={styles.panel} style={{ maxWidth: 680, margin: "0 auto" }}><div className={styles.eyebrow}><UiText text={"Stripe Connect"} /></div><h1><UiText text={"Paluu Maskinesiin"} /></h1>{error ? <p className={styles.error}>{error}</p> : <p className={styles.notice}>{status}</p>}<Link className={styles.button} href="/yritys"><UiText text={"Yrityksen hallintapaneeliin"} /></Link></section></div></main>;
}
