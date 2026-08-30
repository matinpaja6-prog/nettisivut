"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "@/app/commerce.module.css";
import type { Company } from "@/lib/commerce/types";
import { getSafeAuthSession } from "@/lib/supabase";

type AdminData = {
  companies: Company[];
  products: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  webhookEvents: Array<Record<string, unknown>>;
  paymentFeeAdjustments: Array<Record<string, unknown>>;
};

const empty: AdminData = { companies: [], products: [], orders: [], webhookEvents: [], paymentFeeAdjustments: [] };
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
  const debtors = useMemo(() => data.companies
    .filter((company) => company.payment_fee_debt_cents > 0)
    .sort((a, b) => b.payment_fee_debt_cents - a.payment_fee_debt_cents), [data.companies]);
  const totalPaymentFeeDebt = useMemo(() => debtors.reduce((sum, company) => sum + company.payment_fee_debt_cents, 0), [debtors]);
  const adjustmentsByCompany = useMemo(() => {
    const grouped = new Map<string, Array<Record<string, unknown>>>();
    for (const adjustment of data.paymentFeeAdjustments) {
      const companyId = String(adjustment.company_id ?? "");
      grouped.set(companyId, [...(grouped.get(companyId) ?? []), adjustment]);
    }
    return grouped;
  }, [data.paymentFeeAdjustments]);
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

  if (loading) return <main className={styles.page}><div className={styles.empty}>Ladataan admin-näkymää…</div></main>;
  return <main className={styles.page}><div className={styles.shell}>
    <header className={styles.hero}><div><div className={styles.eyebrow}>Maskines admin</div><h1>Yritysten hallinta ja maksut</h1><p className={styles.muted}>Yritysten tarkistus, tuotteet, tilaukset ja webhook-virheet.</p></div><Link className={styles.buttonSecondary} href="/admin">Takaisin adminiin</Link></header>
    {error && <p className={styles.error}>{error}</p>}{message && <p className={styles.success}>{message}</p>}
    <section className={styles.grid} style={{ marginBottom: 20 }}><div className={styles.panel}><strong>Yritykset</strong><div className={styles.price}>{data.companies.length}</div></div><div className={styles.panel}><strong>Pending</strong><div className={styles.price}>{data.companies.filter((company) => company.verification_status === "pending").length}</div></div><div className={styles.panel}><strong>Maksukuluvelalliset</strong><div className={styles.price}>{debtors.length}</div><small>{money(totalPaymentFeeDebt)} avoinna</small></div><div className={styles.panel}><strong>Webhook-ongelmat</strong><div className={styles.price}>{data.webhookEvents.length}</div></div></section>
    <section className={`${styles.panel} ${styles.adminPaymentDebtPanel}`}>
      <div className={styles.row}><div><div className={styles.eyebrow}>Maksut ja tilitykset</div><h2>Maksukuluvelat</h2><p className={styles.muted}>Yrityksen peruuttamien tilausten palautumattomat Stripe-kulut. Avoin saldo vähennetään automaattisesti yrityksen seuraavista tilityksistä.</p></div><span className={debtors.length > 0 ? styles.badgeOrange : styles.badge}>{debtors.length > 0 ? `${money(totalPaymentFeeDebt)} avoinna` : "Ei avoimia velkoja"}</span></div>
      {debtors.length === 0 ? <p className={styles.success}>Yhdelläkään yrityksellä ei ole avointa maksukulusaldon velkaa.</p> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Yritys</th><th>Y-tunnus</th><th>Avoin velka</th><th>Kulukirjauksia</th><th>Viimeisin peruttu tilaus</th><th>Kirjattu</th></tr></thead><tbody>{debtors.map((company) => { const companyAdjustments = adjustmentsByCompany.get(company.id) ?? []; const latest = companyAdjustments[0]; const order = latest?.order as Record<string, unknown> | null | undefined; return <tr key={company.id}><td><strong>{company.name}</strong><small className={styles.tableNote}>{company.email}</small></td><td>{company.business_id}</td><td><strong className={styles.adminPaymentDebtAmount}>{money(company.payment_fee_debt_cents)}</strong></td><td>{companyAdjustments.length}</td><td>{order?.order_number ? <><strong>{String(order.order_number)}</strong><small className={styles.tableNote}>{money(order.total_cents)}</small></> : "—"}</td><td>{latest?.created_at ? new Date(String(latest.created_at)).toLocaleString("fi-FI") : "—"}</td></tr>; })}</tbody></table></div>}
      {data.paymentFeeAdjustments.length > 0 && <details className={styles.adminPaymentDebtHistory}><summary>Näytä maksukulukirjausten historia ({data.paymentFeeAdjustments.length})</summary><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Yritys</th><th>Tilaus</th><th>Kulu</th><th>Stripe-palautus</th><th>Aika</th></tr></thead><tbody>{data.paymentFeeAdjustments.map((adjustment) => { const company = data.companies.find((candidate) => candidate.id === String(adjustment.company_id)); const order = adjustment.order as Record<string, unknown> | null | undefined; return <tr key={String(adjustment.id)}><td>{company?.name ?? String(adjustment.company_id)}</td><td>{String(order?.order_number ?? adjustment.order_id)}</td><td><strong>{money(adjustment.amount_cents)}</strong></td><td><code>{String(adjustment.stripe_refund_id)}</code></td><td>{new Date(String(adjustment.created_at)).toLocaleString("fi-FI")}</td></tr>; })}</tbody></table></div></details>}
    </section>
    <section className={styles.panel}><div className={styles.row}><h2>Yritykset</h2><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="pending">Odottaa tarkistusta</option><option value="approved">Hyväksytyt</option><option value="rejected">Hylätyt</option><option value="suspended">Keskeytetyt</option><option value="draft">Luonnokset</option><option value="all">Kaikki</option></select></div>
      <div className={styles.list}>{companies.length === 0 ? <p className={styles.empty}>Ei yrityksiä tällä rajauksella.</p> : companies.map((company) => <article className={styles.listItem} key={company.id}><div className={styles.row}><div><h3>{company.name || "Nimetön yritys"}</h3><p>{company.business_id} · {company.email} · {company.phone}</p></div><span className={company.verification_status === "approved" ? styles.badge : styles.badgeOrange}>{company.verification_status}</span></div><div className={styles.formGrid}><div><strong>Osoite</strong><p>{company.address_line}<br />{company.postal_code} {company.city}, {company.country}</p></div><div><strong>Vastuuhenkilö</strong><p>{company.contact_person}<br />{company.website}</p></div><div><strong>Stripe</strong><p>Tiedot {company.stripe_details_submitted ? "✓" : "–"} · maksut {company.stripe_charges_enabled ? "✓" : "–"} · tilitykset {company.stripe_payouts_enabled ? "✓" : "–"}</p>{company.stripe_requirements_due?.length > 0 && <small>{company.stripe_requirements_due.join(", ")}</small>}</div><div><strong>Kuvaus</strong><p>{company.description}</p></div><label className={styles.fieldFull}><span>Yritykselle näkyvä tarkistusviesti / hylkäyksen syy</span><textarea value={notes[company.id] ?? company.verification_notes ?? ""} onChange={(event) => setNotes({ ...notes, [company.id]: event.target.value })} /></label><label className={styles.fieldFull}><span>Sisäinen admin-muistiinpano (ei näy yritykselle)</span><textarea value={internalNotes[company.id] ?? company.admin_notes ?? ""} onChange={(event) => setInternalNotes({ ...internalNotes, [company.id]: event.target.value })} /></label></div><div className={styles.wrap}><button className={styles.button} onClick={() => void update(company, "approved")}>Hyväksy</button><button className={styles.buttonSecondary} onClick={() => void update(company, "rejected")}>Hylkää</button><button className={styles.buttonDanger} onClick={() => void update(company, "suspended")}>Keskeytä myynti</button><button className={styles.buttonSecondary} onClick={() => void update(company, "pending")}>Palauta jonoon</button></div></article>)}</div>
    </section>
    <section className={styles.panel}><h2>Tuotteet</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Tuote</th><th>Yritys-ID</th><th>Hinta</th><th>Saldo</th><th>Toimitus</th><th>Tila</th></tr></thead><tbody>{data.products.map((product) => <tr key={String(product.id)}><td>{String(product.name)}</td><td>{String(product.company_id)}</td><td>{money(product.price_cents)}</td><td>{String(product.stock_quantity)}</td><td>{product.pickup_available ? "Nouto" : ""}{product.pickup_available && product.posti_enabled ? " + " : ""}{product.posti_enabled ? "Posti" : ""}</td><td>{product.active ? "Julkaistu" : "Luonnos"}</td></tr>)}</tbody></table></div></section>
    <section className={styles.panel}><h2>Tilaukset</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Tilaus</th><th>Maksu</th><th>Toimitus</th><th>Summa</th><th>Virhe</th><th>Luotu</th></tr></thead><tbody>{data.orders.map((order) => <tr key={String(order.id)}><td>{String(order.order_number)}</td><td>{String(order.payment_status)}</td><td>{String(order.shipping_method)} / {String(order.fulfillment_status)}</td><td>{money(order.total_cents)}</td><td>{String(order.payment_error ?? "")}</td><td>{new Date(String(order.created_at)).toLocaleString("fi-FI")}</td></tr>)}</tbody></table></div></section>
    <section className={styles.panel}><h2>Webhook-virheet ja keskeneräiset</h2>{data.webhookEvents.length === 0 ? <p className={styles.success}>Ei avoimia webhook-ongelmia.</p> : <div className={styles.list}>{data.webhookEvents.map((event) => <div className={styles.listItem} key={String(event.id)}><strong>{String(event.type)}</strong> · {String(event.processing_status)}<p>{String(event.error_message ?? "Käsittely kesken")}</p><small>{String(event.stripe_event_id)} · {new Date(String(event.created_at)).toLocaleString("fi-FI")}</small></div>)}</div>}</section>
  </div></main>;
}
