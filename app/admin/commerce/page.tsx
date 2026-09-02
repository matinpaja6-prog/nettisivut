"use client";
import UiText from "@/app/components/UiText";

import Link from "@/app/components/LocalizedLink";
import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "@/app/commerce.module.css";
import type { Company } from "@/lib/commerce/types";
import { getSafeAuthSession } from "@/lib/supabase";

type AdminData = {
  companies: Company[];
  products: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  webhookEvents: Array<Record<string, unknown>>;
};

const empty: AdminData = { companies: [], products: [], orders: [], webhookEvents: [] };
function money(value: unknown) { return new Intl.NumberFormat("fi-FI", { style: "currency", currency: "EUR" }).format(Number(value ?? 0) / 100); }

export default function CommerceAdminPage() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<AdminData>(empty);
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [internalNotes, setInternalNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/commerce/admin", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Admin-tietojen lataaminen epäonnistui.");
    setData(body);
  }, []);
  useEffect(() => {
    getSafeAuthSession().then(async (session) => {
      if (!session) throw new Error("Kirjaudu admin-tilille.");
      setToken(session.access_token); await load(session.access_token);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason))).finally(() => setLoading(false));
  }, [load]);

  const companies = useMemo(() => data.companies.filter((company) => filter === "all" || company.verification_status === filter), [data.companies, filter]);
  async function update(company: Company, verificationStatus: string) {
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/commerce/admin", {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, verificationStatus, verificationNotes: notes[company.id] ?? company.verification_notes ?? "", adminNotes: internalNotes[company.id] ?? company.admin_notes ?? "" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Päivitys epäonnistui.");
      setData((current) => ({ ...current, companies: current.companies.map((item) => item.id === company.id ? body.company : item) }));
      setMessage(`${company.name}: tila päivitettiin (${verificationStatus}).`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  if (loading) return <main className={styles.page}><div className={styles.empty}><UiText text={"Ladataan admin-näkymää…"} /></div></main>;
  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.hero}><div><div className={styles.eyebrow}><UiText text={"Maskines admin"} /></div><h1><UiText text={"Yritysten hallinta ja maksut"} /></h1><p className={styles.muted}><UiText text={"Yritysten tarkistus, tuotteet, tilaukset ja webhook-virheet."} /></p></div><Link className={styles.buttonSecondary} href="/admin"><UiText text={"Takaisin adminiin"} /></Link></header>
    {error && <p className={styles.error}>{error}</p>}{message && <p className={styles.success}>{message}</p>}
    <section className={styles.grid} style={{ marginBottom: 20 }}><div className={styles.panel}><strong><UiText text={"Yritykset"} /></strong><div className={styles.price}>{data.companies.length}</div></div><div className={styles.panel}><strong><UiText text={"Pending"} /></strong><div className={styles.price}>{data.companies.filter((company) => company.verification_status === "pending").length}</div></div><div className={styles.panel}><strong><UiText text={"Maskines-palvelumaksu"} /></strong><div className={styles.price}>1 %</div><small><UiText text={"Pidätetään direct charge -maksuista"} /></small></div><div className={styles.panel}><strong><UiText text={"Webhook-ongelmat"} /></strong><div className={styles.price}>{data.webhookEvents.length}</div></div></section>
    <section className={styles.panel}><div className={styles.row}><h2><UiText text={"Yritykset"} /></h2><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="pending"><UiText text={"Odottaa tarkistusta"} /></option><option value="approved"><UiText text={"Hyväksytyt"} /></option><option value="rejected"><UiText text={"Hylätyt"} /></option><option value="suspended"><UiText text={"Keskeytetyt"} /></option><option value="draft"><UiText text={"Luonnokset"} /></option><option value="all"><UiText text={"Kaikki"} /></option></select></div>
      <div className={styles.list}>{companies.length === 0 ? <p className={styles.empty}><UiText text={"Ei yrityksiä tällä rajauksella."} /></p> : companies.map((company) => <article className={styles.listItem} key={company.id}><div className={styles.row}><div><h3>{company.name || "Nimetön yritys"}</h3><p>{company.business_id} · {company.email} · {company.phone}</p></div><span className={company.verification_status === "approved" ? styles.badge : styles.badgeOrange}>{company.verification_status}</span></div><div className={styles.formGrid}><div><strong><UiText text={"Osoite"} /></strong><p>{company.address_line}<br />{company.postal_code} {company.city}, {company.country}</p></div><div><strong><UiText text={"Vastuuhenkilö"} /></strong><p>{company.contact_person}<br />{company.website}</p></div><div><strong><UiText text={"Stripe"} /></strong><p><UiText text={"Tiedot "} />{company.stripe_details_submitted ? "✓" : "–"}<UiText text={" · maksut "} />{company.stripe_charges_enabled ? "✓" : "–"}<UiText text={" · tilitykset "} />{company.stripe_payouts_enabled ? "✓" : "–"}</p>{company.stripe_requirements_due?.length > 0 && <small>{company.stripe_requirements_due.join(", ")}</small>}</div><div><strong><UiText text={"Kuvaus"} /></strong><p>{company.description}</p></div><label className={styles.fieldFull}><span><UiText text={"Yritykselle näkyvä tarkistusviesti / hylkäyksen syy"} /></span><textarea value={notes[company.id] ?? company.verification_notes ?? ""} onChange={(event) => setNotes({ ...notes, [company.id]: event.target.value })} /></label><label className={styles.fieldFull}><span><UiText text={"Sisäinen admin-muistiinpano (ei näy yritykselle)"} /></span><textarea value={internalNotes[company.id] ?? company.admin_notes ?? ""} onChange={(event) => setInternalNotes({ ...internalNotes, [company.id]: event.target.value })} /></label></div><div className={styles.wrap}><button className={styles.button} onClick={() => void update(company, "approved")}><UiText text={"Hyväksy"} /></button><button className={styles.buttonSecondary} onClick={() => void update(company, "rejected")}><UiText text={"Hylkää"} /></button><button className={styles.buttonDanger} onClick={() => void update(company, "suspended")}><UiText text={"Keskeytä myynti"} /></button><button className={styles.buttonSecondary} onClick={() => void update(company, "pending")}><UiText text={"Palauta jonoon"} /></button></div></article>)}</div>
    </section>
    <section className={styles.panel}><h2><UiText text={"Tuotteet"} /></h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th><UiText text={"Tuote"} /></th><th><UiText text={"Yritys-ID"} /></th><th><UiText text={"Hinta"} /></th><th><UiText text={"Saldo"} /></th><th><UiText text={"Toimitus"} /></th><th><UiText text={"Tila"} /></th></tr></thead><tbody>{data.products.map((product) => <tr key={String(product.id)}><td>{String(product.name)}</td><td>{String(product.company_id)}</td><td>{money(product.price_cents)}</td><td>{String(product.stock_quantity)}</td><td>{product.pickup_available ? "Nouto" : ""}{product.pickup_available && product.posti_enabled ? " + " : ""}{product.posti_enabled ? "Posti" : ""}</td><td>{product.active ? "Julkaistu" : "Luonnos"}</td></tr>)}</tbody></table></div></section>
    <section className={styles.panel}><h2><UiText text={"Tilaukset"} /></h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th><UiText text={"Tilaus"} /></th><th><UiText text={"Maksu"} /></th><th><UiText text={"Toimitus"} /></th><th><UiText text={"Summa"} /></th><th><UiText text={"Virhe"} /></th><th><UiText text={"Luotu"} /></th></tr></thead><tbody>{data.orders.map((order) => <tr key={String(order.id)}><td>{String(order.order_number)}</td><td>{String(order.payment_status)}</td><td>{String(order.shipping_method)} / {String(order.fulfillment_status)}</td><td>{money(order.total_cents)}</td><td>{String(order.payment_error ?? "")}</td><td>{new Date(String(order.created_at)).toLocaleString("fi-FI")}</td></tr>)}</tbody></table></div></section>
    <section className={styles.panel}><h2><UiText text={"Webhook-virheet ja keskeneräiset"} /></h2>{data.webhookEvents.length === 0 ? <p className={styles.success}><UiText text={"Ei avoimia webhook-ongelmia."} /></p> : <div className={styles.list}>{data.webhookEvents.map((event) => <div className={styles.listItem} key={String(event.id)}><strong>{String(event.type)}</strong> · {String(event.processing_status)}<p>{String(event.error_message ?? "Käsittely kesken")}</p><small>{String(event.stripe_event_id)} · {new Date(String(event.created_at)).toLocaleString("fi-FI")}</small></div>)}</div>}</section>
  </div></main>;
}
