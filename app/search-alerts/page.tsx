"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  BellOff,
  BellPlus,
  Check,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Zap
} from "lucide-react";

import {
  createSearchAlert,
  deleteSearchAlert,
  getAlertNotifications,
  getListingsMatchingAlert,
  getSearchAlerts,
  markNotificationsSeen,
  supabase,
  toggleSearchAlert,
  updateSearchAlert,
  type AlertNotification,
  type SearchAlert
} from "@/lib/supabase";
import type { Listing } from "@/lib/listings";
import { useLanguage } from "@/lib/i18n";
import {
  buildVehicleCategoriesFromTaxonomy,
  categoriesAsRecord,
  vehicleBrandsRecord
} from "@/lib/taxonomy";
import { useTaxonomy } from "@/app/components/TaxonomyProvider";
import { readCachedResource, writeCachedResource } from "@/lib/client-resource-cache";
import { goBackOrFallback } from "@/lib/go-back";

const CONDITIONS = ["Uusi", "Erinomainen", "Hyvä", "Tyydyttävä"];
const CUR_YEAR = new Date().getFullYear();

const EMPTY_FORM = {
  label: "",
  vehicle_type: "",
  category: "",
  subcategory: "",
  query: "",
  brand: "",
  year_min: "",
  year_max: "",
  condition: "",
  max_price: ""
};

function getLastCategoryPart(value?: string | null) {
  return value?.split("/").map(part => part.trim()).filter(Boolean).at(-1) ?? "";
}

function getAlertCategoryLabel(alert: SearchAlert) {
  return getLastCategoryPart(alert.subcategory) || getLastCategoryPart(alert.category);
}

export default function SearchAlertsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const taxonomy = useTaxonomy();
  const vehicleTypes = useMemo(
    () => taxonomy.vehicles.map((vehicle) => vehicle.key),
    [taxonomy]
  );
  const vehicleBrands = useMemo(() => vehicleBrandsRecord(taxonomy), [taxonomy]);
  const allCategories = useMemo(() => categoriesAsRecord(taxonomy), [taxonomy]);
  const categoriesByVehicle = useMemo(() => {
    const out: Record<string, Record<string, string[]>> = {};
    for (const vehicle of taxonomy.vehicles) {
      out[vehicle.key] = buildVehicleCategoriesFromTaxonomy(taxonomy, vehicle.key);
    }
    return out;
  }, [taxonomy]);
  const [userId, setUserId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateFormField<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  /* ---- auth ---- */
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* ---- load ---- */
  const load = useCallback(async () => {
    if (!userId) {
      setAlerts([]);
      setNotifications([]);
      setLoading(false);
      return;
    }
    const cacheKey = `search-alerts:${userId}`;
    const cached = readCachedResource<{
      alerts: SearchAlert[];
      notifications: AlertNotification[];
    }>(cacheKey);
    if (cached) {
      setAlerts(cached.alerts);
      setNotifications(cached.notifications);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const [alertsRes, notifsRes] = await Promise.all([
      getSearchAlerts(userId),
      getAlertNotifications(userId)
    ]);
    setAlerts(alertsRes.data);
    setNotifications(notifsRes.data);
    writeCachedResource(cacheKey, {
      alerts: alertsRes.data,
      notifications: notifsRes.data
    });
    await markNotificationsSeen(userId);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  /* ---- create ---- */
  async function handleCreate() {
    const label = form.label.trim();

    if (!userId) {
      setError(t.saLoginRequired);
      return;
    }

    if (!label) {
      setError(t.saName.replace(" *", "") + " puuttuu.");
      return;
    }

    setSaving(true);
    setError("");
    const { error: err } = await createSearchAlert({
      user_id: userId,
      label,
      vehicle_type: form.vehicle_type || null,
      category: form.category || null,
      subcategory: form.subcategory || null,
      query: form.query.trim() || null,
      brand: form.brand.trim() || null,
      year_min: form.year_min ? Number(form.year_min) : null,
      year_max: form.year_max ? Number(form.year_max) : null,
      condition: form.condition || null,
      max_price: form.max_price ? Number(form.max_price) : null
    });
    if (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      setError(`Tallennus epäonnistui: ${msg}`);
      console.error("createSearchAlert error:", err);
    }
    else { setForm(EMPTY_FORM); setShowForm(false); await load(); }
    setSaving(false);
  }

  /* ---- toggle ---- */
  async function handleToggle(id: string, current: boolean) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a));
    await toggleSearchAlert(id, !current);
  }

  /* ---- delete ---- */
  async function handleDelete(id: string) {
    await deleteSearchAlert(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  const activeCount = alerts.filter(a => a.is_active).length;
  const unreadNotificationCount = notifications.filter(n => !n.seen).length;

  function notifsForAlert(alertId: string) {
    return notifications.filter(n => n.alert_id === alertId);
  }

  const [expanded, setExpanded] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, Listing[]>>({});
  const [matchLoading, setMatchLoading] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const formCategories =
    (form.vehicle_type && categoriesByVehicle[form.vehicle_type]) || allCategories;
  const editCategories =
    (editForm.vehicle_type && categoriesByVehicle[editForm.vehicle_type]) || allCategories;

  function startEdit(alert: SearchAlert) {
    setEditingId(alert.id);
    setEditError("");
    setEditForm({
      label:        alert.label,
      vehicle_type: alert.vehicle_type ?? "",
      category:     alert.category ?? "",
      subcategory:  alert.subcategory ?? "",
      query:        alert.query ?? "",
      brand:        alert.brand ?? "",
      year_min:     alert.year_min?.toString() ?? "",
      year_max:     alert.year_max?.toString() ?? "",
      condition:    alert.condition ?? "",
      max_price:    alert.max_price?.toString() ?? ""
    });
  }

  async function handleUpdate() {
    if (!editingId || !editForm.label.trim()) return;
    setEditSaving(true);
    setEditError("");
    const { error: err } = await updateSearchAlert(editingId, {
      label:        editForm.label.trim(),
      vehicle_type: editForm.vehicle_type || null,
      category:     editForm.category || null,
      subcategory:  editForm.subcategory || null,
      query:        editForm.query.trim() || null,
      brand:        editForm.brand.trim() || null,
      year_min:     editForm.year_min ? Number(editForm.year_min) : null,
      year_max:     editForm.year_max ? Number(editForm.year_max) : null,
      condition:    editForm.condition || null,
      max_price:    editForm.max_price ? Number(editForm.max_price) : null
    });
    if (err) { setEditError((err as {message?:string})?.message ?? String(err)); }
    else {
      setAlerts(prev => prev.map(a => a.id === editingId ? {
        ...a,
        label:        editForm.label.trim(),
        vehicle_type: editForm.vehicle_type || null,
        category:     editForm.category || null,
        subcategory:  editForm.subcategory || null,
        query:        editForm.query.trim() || null,
        brand:        editForm.brand.trim() || null,
        year_min:     editForm.year_min ? Number(editForm.year_min) : null,
        year_max:     editForm.year_max ? Number(editForm.year_max) : null,
        condition:    editForm.condition || null,
        max_price:    editForm.max_price ? Number(editForm.max_price) : null
      } : a));
      setEditingId(null);
    }
    setEditSaving(false);
  }

  async function toggleMatches(alert: SearchAlert) {
    if (expanded === alert.id) { setExpanded(null); return; }
    setExpanded(alert.id);
    if (!matches[alert.id]) {
      setMatchLoading(alert.id);
      const { data } = await getListingsMatchingAlert(alert);
      setMatches(prev => ({ ...prev, [alert.id]: data }));
      setMatchLoading(null);
    }
  }

  return (
    <main className="sa-page">

      <header className="sa-topbar">
        <button type="button" className="sa-back" onClick={() => goBackOrFallback(router)}>
          <ArrowLeft size={15} />
          {t.saHome}
        </button>
      </header>

      <div className="sa-layout">

        {/* Page header */}
        <div className="sa-hero">
          <div className="sa-hero-icon"><Bell size={26} /></div>
          <div className="sa-hero-copy">
            <h1>{t.saTitle}</h1>
            <p>
              {t.saSubtitle}
              {activeCount > 0 && <strong> {activeCount} {t.saActive}.</strong>}
            </p>
            <button
              className={`sa-new-btn${showForm ? " sa-new-btn-cancel" : ""}`}
              onClick={() => { setShowForm(v => !v); setError(""); }}
            >
              {showForm ? <X size={16} /> : <BellPlus size={16} />}
              {showForm ? t.saCancel : t.saNew}
            </button>
          </div>
          <div className="sa-hero-stats" aria-label="Hakuvahdin tilastot">
            <div className="sa-hero-stat">
              <span><Bell size={18} /></span>
              <small>Hakuvahteja</small>
              <strong>{activeCount}</strong>
              <em>aktiivista</em>
            </div>
            <div className="sa-hero-stat">
              <span><Zap size={19} /></span>
              <small>Ilmoitukset</small>
              <strong>{unreadNotificationCount > 0 ? unreadNotificationCount : "Päällä"}</strong>
              <em>{unreadNotificationCount > 0 ? "uutta" : "valmiina"}</em>
            </div>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="sa-form-card">
            <h2 className="sa-form-title">{t.saFormTitle}</h2>
            <div className="sa-form-grid">
              <div className="sa-field sa-field-wide">
                <label>{t.saName}</label>
                <input
                  value={form.label}
                  onChange={e => updateFormField("label", e.target.value)}
                  placeholder={t.saNamePlaceholder}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="sa-field">
                <label>{t.saVehicleClass}</label>
                <select
                  value={form.vehicle_type}
                  onChange={e => { setForm({ ...form, vehicle_type: e.target.value, category: "", brand: "" }); setError(""); }}
                >
                  <option value="">{t.saAllClasses}</option>
                  {vehicleTypes.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="sa-field">
                <label>{t.saCategory}</label>
                <select
                  value={form.category}
                  onChange={e => { setForm({ ...form, category: e.target.value, subcategory: "" }); setError(""); }}
                >
                  <option value="">{t.saAllCategories}</option>
                  {Object.keys(formCategories)
                    .map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              {form.category && (formCategories[form.category] ?? []).length > 0 && (
                <div className="sa-field">
                  <label>Alakategoria</label>
                  <select
                    value={form.subcategory}
                    onChange={e => updateFormField("subcategory", e.target.value)}
                  >
                    <option value="">Kaikki</option>
                    {(formCategories[form.category] ?? []).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sa-field">
                <label>{t.saBrand}</label>
                {form.vehicle_type && vehicleBrands[form.vehicle_type] ? (
                  <select
                    value={form.brand}
                    onChange={e => updateFormField("brand", e.target.value)}
                  >
                    <option value="">{t.saAllClasses.replace("luokat", "merkit").replace("klasser", "märken").replace("classes", "brands").replace("klasser", "merker")}</option>
                    {vehicleBrands[form.vehicle_type].filter((b) => b !== "Kaikki").map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                ) : (
                  <input
                    value={form.brand}
                    onChange={e => updateFormField("brand", e.target.value)}
                    placeholder={t.saBrandPlaceholder}
                  />
                )}
              </div>
              <div className="sa-field">
                <label>{t.saKeywords}</label>
                <input
                  value={form.query}
                  onChange={e => updateFormField("query", e.target.value)}
                  placeholder={t.saKeywordsPlaceholder}
                />
              </div>
              <div className="sa-field">
                <label>{t.saYearFrom}</label>
                <input
                  type="number"
                  min={1950}
                  max={CUR_YEAR}
                  value={form.year_min}
                  onChange={e => updateFormField("year_min", e.target.value)}
                  placeholder="2010"
                />
              </div>
              <div className="sa-field">
                <label>{t.saYearTo}</label>
                <input
                  type="number"
                  min={1950}
                  max={CUR_YEAR}
                  value={form.year_max}
                  onChange={e => updateFormField("year_max", e.target.value)}
                  placeholder={`${CUR_YEAR}`}
                />
              </div>
              <div className="sa-field">
                <label>{t.saCondition}</label>
                <select
                  value={form.condition}
                  onChange={e => updateFormField("condition", e.target.value)}
                >
                  <option value="">{t.saAllConditions}</option>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="sa-field">
                <label>{t.saMaxPrice}</label>
                <input
                  type="number"
                  min={0}
                  value={form.max_price}
                  onChange={e => updateFormField("max_price", e.target.value)}
                  placeholder="500"
                />
              </div>
            </div>
            {error && <p className="sa-error" style={{color:"#ef4444",fontWeight:600,margin:"8px 0"}}>{error}</p>}
            <div className="sa-form-actions">
              <button type="button" className="sa-save-btn" onClick={handleCreate} disabled={saving}>
                <Check size={15} />
                {saving ? t.saSaving : t.saSave}
              </button>
              <p className="sa-form-note">
                {t.saNote}
              </p>
            </div>
          </div>
        )}

        {/* Alerts list */}
        <section className="sa-saved-panel">
          <div className="sa-saved-head">
            <div className="sa-saved-search"><Search size={24} /></div>
            <div>
              <h2>Tallennetut hakuehdot</h2>
              <p>Hallinnoi tallennettuja hakuehtojasi ja saat ilmoitukset niistä.</p>
            </div>
            <button
              className="sa-add-condition"
              onClick={() => { setShowForm(true); setError(""); }}
            >
              <Plus size={18} />
              Lisää hakuvahti
            </button>
          </div>

          <div className="sa-saved-workspace">
            <nav className="sa-side-rail" aria-label="Hakuvahdin osiot">
              <button
                className="is-active sa-rail-create"
                aria-label="Kaikki hakuvahdit"
                onClick={() => { setShowForm(true); setError(""); }}
              >
                <Search size={20} />
                <span>Kaikki vahdit</span>
              </button>
            </nav>

            <div className="sa-list">
              {loading ? (
                <div className="sa-empty">
                  <div className="sa-empty-icon"><Bell size={32} /></div>
                  <p>Ladataan...</p>
                </div>
              ) : alerts.length === 0 ? (
                <div className="sa-empty">
                  <div className="sa-empty-icon"><BellOff size={36} /></div>
                  <h3>Ei hakuvahteja vielä</h3>
                  <p>Luo ensimmäinen hakuvahti, niin ilmoitamme kun sopiva ilmoitus vastaa hakuehtojasi.</p>
                  <button
                    className="sa-empty-btn"
                    onClick={() => { setShowForm(true); setError(""); }}
                  >
                    Luo ensimmäinen hakuvahti
                  </button>
                </div>
              ) : (
                alerts.map(alert => {
                  const categoryLabel = getAlertCategoryLabel(alert);
                  return (
              <div key={alert.id} className={`sa-card${alert.is_active ? "" : " sa-card-off"}${notifsForAlert(alert.id).length > 0 ? " sa-card-has-notif" : ""}`}>
                <div className="sa-card-icon">
                  {alert.is_active ? <Bell size={18} /> : <BellOff size={18} />}
                </div>
                <div className="sa-card-body">
                  <div className="sa-card-label">{alert.label}</div>
                  <div className="sa-card-tags">
                    {alert.vehicle_type && <span className="sa-tag sa-tag-blue">{alert.vehicle_type}</span>}
                    {alert.brand && <span className="sa-tag sa-tag-blue">{alert.brand}</span>}
                    {categoryLabel && <span className="sa-tag sa-tag-purple">{categoryLabel}</span>}
                    {alert.condition && <span className="sa-tag sa-tag-purple">{alert.condition}</span>}
                    {(alert.year_min || alert.year_max) && (
                      <span className="sa-tag sa-tag-gray">
                        {alert.year_min && alert.year_max
                          ? `${alert.year_min}–${alert.year_max}`
                          : alert.year_min ? `alkaen ${alert.year_min}` : `asti ${alert.year_max}`}
                      </span>
                    )}
                    {alert.query && <span className="sa-tag sa-tag-gray">Haku: {alert.query}</span>}
                    {alert.max_price != null && <span className="sa-tag sa-tag-green">max {alert.max_price} €</span>}
                  </div>
                </div>
                {notifsForAlert(alert.id).length > 0 && (
                  <div className="sa-notif-list">
                    <div className="sa-notif-header">{t.saHits} — {notifsForAlert(alert.id).length} {t.saFoundSuffix}</div>
                    {notifsForAlert(alert.id).map(n => (
                      <a key={n.id} href={`/listing/${n.listing_id}`} className="sa-notif-item">
                        {n.listing_image_url && <img src={n.listing_image_url} alt="" className="sa-notif-img" />}
                        <div className="sa-notif-info">
                          <span className="sa-notif-title">{n.listing_title}</span>
                          {n.listing_price != null && <span className="sa-notif-price">{n.listing_price.toLocaleString("fi-FI")} €</span>}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
                <div className="sa-card-actions">
                  <button
                    className="sa-search-btn"
                    onClick={() => toggleMatches(alert)}
                    title={t.saMatches}
                  >
                    <Search size={14} />
                    {expanded === alert.id ? t.saClose : t.saMatches}
                  </button>
                  <button
                    className="sa-edit-btn"
                    onClick={() => editingId === alert.id ? setEditingId(null) : startEdit(alert)}
                    title={t.saEdit}
                  >
                    {editingId === alert.id ? <X size={14} /> : <Pencil size={14} />}
                  </button>
                  <button
                    className={`sa-toggle${alert.is_active ? " sa-toggle-on" : " sa-toggle-off"}`}
                    onClick={() => handleToggle(alert.id, alert.is_active)}
                    title={alert.is_active ? t.saDisable : t.saEnable}
                  >
                    <span className="sa-toggle-knob" />
                  </button>
                  <button
                    className="sa-delete-btn"
                    onClick={() => handleDelete(alert.id)}
                    title={t.saDelete}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {editingId === alert.id && (
                  <div className="sa-edit-panel">
                    <div className="sa-form-grid">
                      <div className="sa-field sa-field-wide">
                        <label>{t.saName}</label>
                        <input value={editForm.label} onChange={e => setEditForm({...editForm, label: e.target.value})} />
                      </div>
                      <div className="sa-field">
                        <label>{t.saVehicleClass}</label>
                        <select value={editForm.vehicle_type} onChange={e => setEditForm({...editForm, vehicle_type: e.target.value, category: "", brand: ""})}>
                          <option value="">{t.saAllClasses}</option>
                          {vehicleTypes.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div className="sa-field">
                        <label>{t.saCategory}</label>
                        <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value, subcategory: ""})}>
                          <option value="">{t.saAllCategories}</option>
                          {Object.keys(editCategories).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      {editForm.category && (editCategories[editForm.category] ?? []).length > 0 && (
                        <div className="sa-field">
                          <label>Alakategoria</label>
                          <select value={editForm.subcategory} onChange={e => setEditForm({...editForm, subcategory: e.target.value})}>
                            <option value="">Kaikki</option>
                            {(editCategories[editForm.category] ?? []).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="sa-field">
                        <label>{t.saBrand}</label>
                        {editForm.vehicle_type && vehicleBrands[editForm.vehicle_type] ? (
                          <select
                            value={editForm.brand}
                            onChange={e => setEditForm({...editForm, brand: e.target.value})}
                          >
                            <option value="">— Kaikki merkit —</option>
                            {vehicleBrands[editForm.vehicle_type].filter((b) => b !== "Kaikki").map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        ) : (
                          <input value={editForm.brand} placeholder={t.saBrandPlaceholder} onChange={e => setEditForm({...editForm, brand: e.target.value})} />
                        )}
                      </div>
                      <div className="sa-field">
                        <label>{t.saKeywords}</label>
                        <input value={editForm.query} placeholder={t.saKeywordsPlaceholder} onChange={e => setEditForm({...editForm, query: e.target.value})} />
                      </div>
                      <div className="sa-field">
                        <label>{t.saYearFrom}</label>
                        <input type="number" min={1950} max={CUR_YEAR} value={editForm.year_min} onChange={e => setEditForm({...editForm, year_min: e.target.value})} />
                      </div>
                      <div className="sa-field">
                        <label>{t.saYearTo}</label>
                        <input type="number" min={1950} max={CUR_YEAR} value={editForm.year_max} onChange={e => setEditForm({...editForm, year_max: e.target.value})} />
                      </div>
                      <div className="sa-field">
                        <label>{t.saCondition}</label>
                        <select value={editForm.condition} onChange={e => setEditForm({...editForm, condition: e.target.value})}>
                          <option value="">{t.saAllConditions}</option>
                          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="sa-field">
                        <label>{t.saMaxPrice}</label>
                        <input type="number" min={0} value={editForm.max_price} onChange={e => setEditForm({...editForm, max_price: e.target.value})} />
                      </div>
                    </div>
                    {editError && <p className="sa-error">{editError}</p>}
                    <div className="sa-form-actions">
                      <button type="button" className="sa-save-btn" onClick={handleUpdate} disabled={editSaving}>
                        <Check size={15} />
                        {editSaving ? t.saSaving : t.saSave}
                      </button>
                    </div>
                  </div>
                )}
                {expanded === alert.id && (
                  <div className="sa-matches">
                    {matchLoading === alert.id ? (
                      <div className="sa-matches-empty">{t.saLoading}</div>
                    ) : (matches[alert.id]?.length ?? 0) === 0 ? (
                      <div className="sa-matches-empty">{t.saNoMatches}</div>
                    ) : (
                      <>
                        <div className="sa-notif-header">{t.saFound} {matches[alert.id].length} {t.saFoundSuffix}</div>
                        {matches[alert.id].map(l => (
                          <a key={l.id} href={`/listing/${l.id}`} className="sa-notif-item">
                            {l.image_url && <img src={l.image_url} alt="" className="sa-notif-img" />}
                            <div className="sa-notif-info">
                              <span className="sa-notif-title">{l.title}</span>
                              {l.price != null && <span className="sa-notif-price">{l.price.toLocaleString("fi-FI")} €</span>}
                            </div>
                          </a>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

      </div>

      <style>{`
        .sa-page { min-height: 100vh; background: #f8fafc; }

        .sa-topbar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 0 32px;
          height: 58px;
          background: white;
          border-bottom: 1px solid #e8edf5;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .sa-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 15px;
          color: #0f172a;
          text-decoration: none;
          margin-right: auto;
        }
        .sa-brand-mark {
          width: 28px;
          height: 28px;
          background: #ff8a24;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .sa-back {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-decoration: none;
          transition: color 0.12s;
        }
        .sa-back:hover { color: #0f172a; }

        .sa-layout {
          max-width: 720px;
          margin: 0 auto;
          padding: 36px 24px 60px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Hero */
        .sa-hero {
          display: flex;
          align-items: center;
          gap: 16px;
          background: white;
          border: 1px solid #e8edf5;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(15,23,42,0.05);
        }
        .sa-hero-icon {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, #2563eb, #7c3aed);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sa-hero h1 {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px;
        }
        .sa-hero p {
          font-size: 13px;
          color: #64748b;
          margin: 0;
        }
        .sa-hero p strong { color: #ff8a24; }
        .sa-new-btn {
          margin-left: auto;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 7px;
          height: 40px;
          padding: 0 18px;
          background: #ff8a24;
          color: white;
          border: none;
          border-radius: 11px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .sa-new-btn:hover { background: #e65c00; }
        .sa-new-btn-cancel { background: #64748b; }
        .sa-new-btn-cancel:hover { background: #475569; }

        /* Form card */
        .sa-form-card {
          background: white;
          border: 1.5px solid #ff7a1a;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(59,130,246,0.1);
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .sa-form-title {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .sa-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .sa-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .sa-field-wide { grid-column: 1 / -1; }
        .sa-field label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #94a3b8;
        }
        .sa-field input,
        .sa-field select {
          height: 40px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 12px;
          font-size: 13.5px;
          font-weight: 500;
          color: #0f172a;
          background: #f8fafc;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .sa-field input:focus,
        .sa-field select:focus {
          border-color: #ff7a1a;
          background: white;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        .sa-error {
          font-size: 13px;
          color: #ef4444;
          margin: 0;
          font-weight: 600;
        }
        .sa-form-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .sa-save-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 42px;
          padding: 0 22px;
          background: #ff8a24;
          color: white;
          border: none;
          border-radius: 11px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }
        .sa-save-btn:hover { background: #e65c00; }
        .sa-save-btn:disabled { background: #94a3b8; cursor: not-allowed; }
        .sa-form-note {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
          font-weight: 500;
        }

        /* Alert list */
        .sa-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sa-empty {
          background: white;
          border: 1px solid #e8edf5;
          border-radius: 20px;
          padding: 48px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
          color: #94a3b8;
        }
        .sa-empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sa-empty h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
        .sa-empty p { font-size: 13px; margin: 0; max-width: 300px; }

        /* Alert card */
        .sa-card {
          background: white;
          border: 1px solid #e8edf5;
          border-radius: 16px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 2px 8px rgba(15,23,42,0.04);
          transition: box-shadow 0.15s, opacity 0.15s;
        }
        .sa-card:hover { box-shadow: 0 4px 16px rgba(15,23,42,0.08); }
        .sa-card-off { opacity: 0.55; }
        .sa-card-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: rgba(255, 122, 26, 0.14);
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sa-card-off .sa-card-icon { background: #f1f5f9; color: #94a3b8; }
        .sa-card-body { flex: 1; min-width: 0; }
        .sa-card-label {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sa-card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .sa-tag {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 999px;
        }
        .sa-tag-blue { background: #dbeafe; color: #ff8a24; }
        .sa-tag-purple { background: #ede9fe; color: #6d28d9; }
        .sa-tag-gray { background: #f1f5f9; color: #475569; }
        .sa-tag-green { background: #dcfce7; color: #15803d; }

        /* Toggle switch */
        .sa-card-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .sa-toggle {
          width: 44px;
          height: 24px;
          border-radius: 999px;
          border: none;
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .sa-toggle-on { background: #2563eb; }
        .sa-toggle-off { background: #cbd5e1; }
        .sa-toggle-knob {
          position: absolute;
          top: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          transition: left 0.2s;
        }
        .sa-toggle-on .sa-toggle-knob { left: 23px; }
        .sa-toggle-off .sa-toggle-knob { left: 3px; }
        .sa-delete-btn {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: 1px solid #fee2e2;
          background: #fef2f2;
          color: #ef4444;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.12s;
        }
        .sa-delete-btn:hover { background: #fee2e2; }
        .sa-search-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 30px;
          padding: 0 12px;
          background: rgba(255, 122, 26, 0.14);
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          color: #ff8a24;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.12s;
        }
        .sa-search-btn:hover { background: #dbeafe; }
        .sa-edit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          flex-shrink: 0;
          padding: 0;
        }
        .sa-edit-btn:hover { background: #fef9c3; color: #ca8a04; border-color: #fde68a; }
        .sa-edit-panel {
          width: 100%;
          margin-top: 12px;
          padding: 16px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 14px;
        }
        .sa-matches {
          width: 100%;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e8edf5;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sa-matches-empty {
          padding: 12px;
          color: #94a3b8;
          font-size: 13px;
          text-align: center;
        }
        .sa-card { flex-wrap: wrap; }

        /* Notifications per alert */
        .sa-card-has-notif {
          border-color: #bfdbfe;
          background: #f0f7ff;
        }
        .sa-card-has-notif .sa-card-icon { background: #dbeafe; color: #ff8a24; }
        .sa-notif-list {
          grid-column: 1 / -1;
          margin-top: 10px;
          border-top: 1px solid #e0eefe;
          padding-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sa-notif-header {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #ff7a1a;
          margin-bottom: 4px;
        }
        .sa-notif-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          text-decoration: none;
          transition: border-color 0.12s, box-shadow 0.12s;
        }
        .sa-notif-item:hover { border-color: #93c5fd; box-shadow: 0 2px 8px rgba(59,130,246,0.1); }
        .sa-notif-img {
          width: 44px;
          height: 44px;
          border-radius: 7px;
          object-fit: cover;
          flex-shrink: 0;
        }
        .sa-notif-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .sa-notif-title {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sa-notif-price {
          font-size: 13px;
          font-weight: 800;
          color: #ff8a24;
        }
        /* Make card layout full-width when it has notifications */
        .sa-card-has-notif { flex-wrap: wrap; }
        .sa-card-has-notif .sa-card-body { flex: 1; }
        .sa-card-has-notif .sa-notif-list { width: 100%; }

        body:has(.sa-page) .universal-app-topbar {
          background: rgba(2, 9, 18, 0.94) !important;
          border-bottom: 1px solid rgba(126, 197, 240, 0.18) !important;
          box-shadow: none !important;
        }
        body:has(.sa-page) .universal-app-topbar::after {
          display: none !important;
        }
        body:has(.sa-page) .universal-return-button {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          min-height: 54px !important;
          padding: 0 !important;
        }
        body:has(.sa-page) .universal-return-button strong {
          display: none !important;
        }
        body:has(.sa-page) .universal-return-button svg {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          color: #ff7a1a !important;
          height: 38px !important;
          padding: 0 !important;
          stroke-width: 3 !important;
          width: 38px !important;
        }

        .sa-page {
          min-height: calc(100vh - var(--topbar-h, 76px)) !important;
          background:
            radial-gradient(920px 520px at 50% 0%, rgba(10, 46, 76, 0.46), transparent 68%),
            radial-gradient(780px 480px at 52% 58%, rgba(8, 42, 70, 0.48), transparent 72%),
            linear-gradient(180deg, #020914 0%, #04111e 48%, #061827 100%) !important;
          color: #ffffff !important;
          padding: 0 0 110px !important;
        }
        .sa-topbar {
          display: none !important;
        }
        .sa-layout {
          width: min(1120px, calc(100vw - 48px)) !important;
          max-width: none !important;
          margin: 0 auto !important;
          padding: 78px 0 0 !important;
          gap: 34px !important;
        }

        .sa-hero,
        .sa-card,
        .sa-form-card,
        .sa-empty {
          background:
            radial-gradient(520px 220px at 0% 0%, rgba(255, 122, 26, 0.12), transparent 68%),
            radial-gradient(760px 300px at 100% 0%, rgba(18, 82, 128, 0.34), transparent 72%),
            linear-gradient(135deg, rgba(9, 32, 53, 0.96), rgba(4, 21, 38, 0.98)) !important;
          border: 1px solid rgba(126, 197, 240, 0.25) !important;
          border-radius: 26px !important;
          box-shadow:
            0 28px 70px rgba(0, 7, 18, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.07) !important;
          color: #ffffff !important;
        }

        .sa-hero {
          display: grid !important;
          grid-template-columns: auto minmax(0, 1fr) 1px auto !important;
          align-items: center !important;
          gap: 24px !important;
          min-height: 136px !important;
          padding: 28px 34px 28px 38px !important;
        }
        .sa-hero::before {
          content: "" !important;
          align-self: stretch !important;
          background: rgba(126, 197, 240, 0.17) !important;
          grid-column: 3 !important;
          grid-row: 1 !important;
          height: 86px !important;
          width: 1px !important;
        }
        .sa-hero > div:not(.sa-hero-icon) {
          min-width: 0 !important;
        }
        .sa-hero-icon,
        .sa-card-icon,
        .sa-empty-icon {
          background:
            radial-gradient(circle at 28% 20%, rgba(255, 255, 255, 0.38), transparent 34%),
            linear-gradient(135deg, #ff9a24 0%, #ff7816 52%, #ec5c00 100%) !important;
          border: 1px solid rgba(255, 210, 168, 0.46) !important;
          box-shadow:
            0 18px 36px rgba(255, 107, 22, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.28) !important;
          color: #ffffff !important;
        }
        .sa-hero-icon {
          border-radius: 18px !important;
          height: 74px !important;
          width: 74px !important;
        }
        .sa-hero-icon svg {
          height: 32px !important;
          stroke-width: 2.4 !important;
          width: 32px !important;
        }
        .sa-hero h1 {
          color: #ffffff !important;
          font-size: 30px !important;
          font-weight: 950 !important;
          line-height: 1.05 !important;
          margin: 0 0 12px !important;
          text-shadow: 0 8px 22px rgba(0, 0, 0, 0.34) !important;
        }
        .sa-hero p {
          color: rgba(232, 240, 248, 0.94) !important;
          font-size: 17px !important;
          font-weight: 650 !important;
          line-height: 1.45 !important;
          margin: 0 !important;
        }
        .sa-hero p strong {
          color: #ff7a1a !important;
          font-weight: 950 !important;
        }
        .sa-new-btn,
        .sa-save-btn,
        .sa-search-btn {
          background: linear-gradient(135deg, #ff9a24 0%, #ff7414 52%, #ec5c00 100%) !important;
          border: 1px solid rgba(255, 210, 168, 0.48) !important;
          border-radius: 18px !important;
          box-shadow:
            0 16px 32px rgba(255, 107, 22, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.26) !important;
          color: #ffffff !important;
          font-size: 20px !important;
          font-weight: 950 !important;
          height: 56px !important;
          padding: 0 24px !important;
        }
        .sa-new-btn {
          grid-column: 4 !important;
          grid-row: 1 !important;
          justify-self: end !important;
          margin-left: 0 !important;
          min-width: 218px !important;
        }
        .sa-new-btn svg,
        .sa-search-btn svg {
          height: 22px !important;
          width: 22px !important;
        }

        .sa-list {
          gap: 20px !important;
        }
        .sa-card {
          align-items: center !important;
          display: grid !important;
          gap: 22px !important;
          grid-template-columns: 56px minmax(320px, 436px) 1fr !important;
          min-height: 178px !important;
          padding: 26px 26px !important;
        }
        .sa-card-icon {
          border-radius: 13px !important;
          grid-column: 1 !important;
          grid-row: 1 !important;
          height: 56px !important;
          justify-self: center !important;
          width: 56px !important;
        }
        .sa-card-icon svg {
          height: 26px !important;
          width: 26px !important;
        }
        .sa-card::before {
          content: "" !important;
          background: rgba(126, 197, 240, 0.16) !important;
          grid-column: 1 !important;
          grid-row: 1 !important;
          height: 112px !important;
          justify-self: end !important;
          margin-right: -8px !important;
          width: 1px !important;
        }
        .sa-card-body {
          background: rgba(3, 12, 22, 0.46) !important;
          border: 1px solid rgba(126, 197, 240, 0.22) !important;
          border-radius: 19px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
          grid-column: 2 !important;
          grid-row: 1 !important;
          min-height: 142px !important;
          padding: 22px 24px !important;
        }
        .sa-card-label {
          color: #ffffff !important;
          font-size: 27px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          margin: 0 0 18px !important;
        }
        .sa-card-tags {
          gap: 10px !important;
        }
        .sa-tag {
          background:
            radial-gradient(120px 42px at 20% 0%, rgba(255, 255, 255, 0.2), transparent 64%),
            linear-gradient(180deg, rgba(55, 70, 83, 0.98), rgba(28, 42, 55, 0.98)) !important;
          border: 1px solid rgba(207, 226, 240, 0.28) !important;
          border-radius: 999px !important;
          box-shadow:
            0 7px 16px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 900 !important;
          padding: 7px 15px !important;
        }
        .sa-card-actions {
          align-items: center !important;
          display: flex !important;
          gap: 16px !important;
          grid-column: 3 !important;
          grid-row: 1 !important;
          justify-content: center !important;
        }
        .sa-search-btn {
          border-radius: 15px !important;
          font-size: 16px !important;
          height: 56px !important;
          min-width: 166px !important;
          padding: 0 20px !important;
        }
        .sa-edit-btn,
        .sa-delete-btn {
          background: rgba(15, 37, 58, 0.72) !important;
          border: 1px solid rgba(126, 197, 240, 0.28) !important;
          border-radius: 50% !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
          color: #ffffff !important;
          height: 54px !important;
          width: 54px !important;
        }
        .sa-edit-btn svg,
        .sa-delete-btn svg {
          height: 24px !important;
          width: 24px !important;
        }
        .sa-toggle {
          background: rgba(64, 87, 106, 0.86) !important;
          border: 0 !important;
          border-radius: 999px !important;
          height: 39px !important;
          padding: 0 !important;
          width: 63px !important;
        }
        .sa-toggle-on {
          background: rgba(64, 87, 106, 0.86) !important;
        }
        .sa-toggle-knob {
          background: #f8fafc !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.32) !important;
          height: 34px !important;
          top: 2px !important;
          width: 34px !important;
        }
        .sa-toggle-on .sa-toggle-knob { left: 3px !important; }
        .sa-toggle-off .sa-toggle-knob { left: 26px !important; opacity: 0.5 !important; }

        .sa-form-card {
          padding: 30px !important;
        }
        .sa-field label,
        .sa-form-title,
        .sa-form-note,
        .sa-empty p,
        .sa-empty h3 {
          color: #ffffff !important;
        }
        .sa-field input,
        .sa-field select {
          background: rgba(3, 12, 22, 0.62) !important;
          border: 1px solid rgba(126, 197, 240, 0.26) !important;
          color: #ffffff !important;
        }

        @media (max-width: 920px) {
          .sa-layout {
            width: min(100% - 28px, 640px) !important;
            padding-top: 28px !important;
          }
          .sa-hero {
            grid-template-columns: auto 1fr !important;
            min-height: auto !important;
            padding: 24px !important;
          }
          .sa-hero::before {
            display: none !important;
          }
          .sa-new-btn {
            grid-column: 1 / -1 !important;
            justify-self: stretch !important;
            min-width: 0 !important;
          }
          .sa-card {
            grid-template-columns: auto 1fr !important;
            min-height: auto !important;
          }
          .sa-card::before {
            display: none !important;
          }
          .sa-card-body {
            grid-column: 2 !important;
            min-height: 0 !important;
          }
          .sa-card-actions {
            grid-column: 1 / -1 !important;
            justify-content: flex-start !important;
            padding-left: 96px !important;
          }
        }

        @media (max-width: 600px) {
          .sa-form-grid { grid-template-columns: 1fr; }
          .sa-hero { flex-wrap: wrap; }
          .sa-new-btn { margin-left: 0; width: 100%; justify-content: center; }
          .sa-topbar { padding: 0 16px; }
          .sa-layout { padding: 20px 16px 40px; }
          .sa-layout {
            width: 100% !important;
            padding: 18px 14px 56px !important;
          }
          .sa-hero {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
            padding: 22px !important;
          }
          .sa-hero-icon {
            height: 72px !important;
            width: 72px !important;
          }
          .sa-hero h1 {
            font-size: 28px !important;
          }
          .sa-hero p {
            font-size: 16px !important;
          }
          .sa-card {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
            padding: 22px !important;
          }
          .sa-card-icon {
            justify-self: start !important;
          }
          .sa-card-body {
            grid-column: 1 !important;
            padding: 20px !important;
          }
          .sa-card-actions {
            grid-column: 1 !important;
            justify-content: flex-start !important;
            padding-left: 0 !important;
            flex-wrap: wrap !important;
          }
          .sa-card-label {
            font-size: 26px !important;
          }
          .sa-tag {
            font-size: 15px !important;
          }
        }

        /* Compact reference layout */
        .sa-page {
          background:
            radial-gradient(760px 280px at 62% -12%, rgba(255, 92, 0, 0.12), transparent 58%),
            radial-gradient(620px 360px at 58% 42%, rgba(15, 72, 116, 0.26), transparent 70%),
            linear-gradient(180deg, #020815 0%, #04101c 58%, #051522 100%) !important;
          overflow-x: hidden !important;
        }

        .sa-layout {
          width: min(912px, calc(100vw - 56px)) !important;
          padding-top: 22px !important;
          gap: 22px !important;
        }

        .sa-hero {
          background:
            radial-gradient(300px 180px at 8% 42%, rgba(255, 112, 10, 0.14), transparent 68%),
            radial-gradient(540px 160px at 62% 0%, rgba(28, 95, 151, 0.22), transparent 70%),
            linear-gradient(135deg, rgba(8, 38, 68, 0.98), rgba(3, 19, 39, 0.98)) !important;
          border: 1px solid rgba(90, 149, 201, 0.48) !important;
          border-radius: 18px !important;
          box-shadow:
            0 18px 50px rgba(0, 6, 18, 0.36),
            inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
          display: grid !important;
          grid-template-columns: auto minmax(0, 1fr) 1px auto 136px !important;
          gap: 26px !important;
          min-height: 174px !important;
          overflow: hidden !important;
          padding: 26px 24px 26px 47px !important;
          position: relative !important;
          width: 100% !important;
        }

        .sa-hero::after {
          background:
            repeating-radial-gradient(ellipse at center, rgba(255, 118, 10, 0.26) 0 1px, transparent 1px 11px);
          border-radius: 999px !important;
          content: "" !important;
          height: 126px !important;
          left: 24px !important;
          opacity: 0.5 !important;
          position: absolute !important;
          top: 18px !important;
          width: 126px !important;
        }

        .sa-hero::before {
          background: rgba(111, 160, 205, 0.28) !important;
          grid-column: 3 !important;
          height: 86px !important;
        }

        .sa-hero-icon {
          border-radius: 18px !important;
          height: 78px !important;
          width: 78px !important;
          z-index: 1 !important;
        }

        .sa-hero h1 {
          font-size: 29px !important;
          margin-bottom: 7px !important;
        }

        .sa-hero p {
          font-size: 15px !important;
          max-width: 310px !important;
        }

        .sa-new-btn,
        .sa-add-condition {
          background: linear-gradient(180deg, #ff951e 0%, #ff6f00 54%, #ef5700 100%) !important;
          border: 1px solid rgba(255, 166, 71, 0.62) !important;
          border-radius: 18px !important;
          box-shadow:
            0 16px 34px rgba(255, 89, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.24) !important;
          color: #fff !important;
        }

        .sa-new-btn {
          font-size: 14px !important;
          grid-column: 4 !important;
          height: 47px !important;
          min-width: 179px !important;
          padding: 0 24px !important;
        }

        .sa-new-btn svg {
          height: 17px !important;
          width: 17px !important;
        }

        .sa-hero-stat {
          align-items: center !important;
          align-self: center !important;
          background:
            radial-gradient(circle at 50% 50%, rgba(16, 45, 78, 0.8), rgba(4, 18, 36, 0.82) 68%),
            repeating-radial-gradient(circle at center, rgba(255, 122, 10, 0.28) 0 1px, transparent 1px 9px) !important;
          border-radius: 999px !important;
          color: #fff !important;
          display: grid !important;
          gap: 2px !important;
          grid-column: 5 !important;
          height: 106px !important;
          justify-items: center !important;
          place-content: center !important;
          position: relative !important;
          width: 106px !important;
        }

        .sa-hero-stat span {
          align-items: center !important;
          background: #ff7a0b !important;
          border-radius: 999px !important;
          color: #fff !important;
          display: inline-flex !important;
          height: 15px !important;
          justify-content: center !important;
          width: 15px !important;
        }

        .sa-hero-stat strong {
          color: #fff !important;
          font-size: 26px !important;
          font-weight: 950 !important;
          line-height: 0.95 !important;
        }

        .sa-hero-stat small {
          color: rgba(239, 247, 255, 0.86) !important;
          font-size: 10px !important;
          font-weight: 850 !important;
        }

        .sa-saved-panel {
          background:
            radial-gradient(480px 230px at 70% 0%, rgba(21, 88, 146, 0.24), transparent 70%),
            linear-gradient(135deg, rgba(8, 37, 64, 0.98), rgba(3, 18, 35, 0.99)) !important;
          border: 1px solid rgba(90, 149, 201, 0.5) !important;
          border-radius: 18px !important;
          box-shadow: 0 22px 56px rgba(0, 6, 18, 0.34), inset 0 1px 0 rgba(255,255,255,0.07) !important;
          padding: 21px 20px 27px !important;
        }

        .sa-saved-head {
          align-items: center !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 68px minmax(0, 1fr) auto !important;
          margin-bottom: 18px !important;
          padding: 0 4px 0 2px !important;
        }

        .sa-saved-search {
          align-items: center !important;
          background: rgba(8, 36, 65, 0.88) !important;
          border: 1px solid rgba(96, 155, 207, 0.28) !important;
          border-radius: 13px !important;
          color: #a8c7ee !important;
          display: inline-flex !important;
          height: 54px !important;
          justify-content: center !important;
          width: 54px !important;
        }

        .sa-saved-head h2 {
          color: #fff !important;
          font-size: 20px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          margin: 0 0 4px !important;
        }

        .sa-saved-head p {
          color: rgba(221, 235, 249, 0.78) !important;
          font-size: 13px !important;
          font-weight: 650 !important;
          margin: 0 !important;
        }

        .sa-add-condition {
          align-items: center !important;
          cursor: pointer !important;
          display: inline-flex !important;
          font-size: 14px !important;
          font-weight: 900 !important;
          gap: 9px !important;
          height: 42px !important;
          justify-content: center !important;
          padding: 0 22px !important;
          white-space: nowrap !important;
        }

        .sa-saved-workspace {
          display: grid !important;
          gap: 27px !important;
          grid-template-columns: 156px minmax(0, 1fr) !important;
        }

        .sa-side-rail {
          align-items: center !important;
          align-self: start !important;
          background: rgba(5, 27, 51, 0.88) !important;
          border: 1px solid rgba(90, 149, 201, 0.22) !important;
          border-radius: 12px !important;
          display: grid !important;
          overflow: hidden !important;
          padding: 0 !important;
          position: relative !important;
        }

        .sa-side-rail::before {
          background: linear-gradient(180deg, #ff8c1b, #ff6100) !important;
          content: "" !important;
          height: 48px !important;
          left: -21px !important;
          position: absolute !important;
          top: 4px !important;
          width: 22px !important;
        }

        .sa-side-rail button {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          color: #7fb0e9 !important;
          cursor: pointer !important;
          display: inline-flex !important;
          height: 52px !important;
          justify-content: center !important;
          width: 100% !important;
        }

        .sa-side-rail .sa-rail-create {
          gap: 8px !important;
          justify-content: flex-start !important;
          padding: 0 14px !important;
          text-align: left !important;
        }

        .sa-side-rail .sa-rail-create span {
          font-size: 12px !important;
          font-weight: 900 !important;
          line-height: 1.05 !important;
          white-space: normal !important;
        }

        .sa-side-rail button.is-active {
          background: linear-gradient(135deg, rgba(255, 138, 28, 0.9), rgba(82, 36, 38, 0.72)) !important;
          box-shadow: 0 10px 24px rgba(255, 95, 0, 0.22) !important;
          color: #fff !important;
        }

        .sa-list {
          gap: 13px !important;
        }

        .sa-card {
          background:
            radial-gradient(420px 180px at 80% 12%, rgba(15, 75, 126, 0.24), transparent 74%),
            linear-gradient(135deg, rgba(6, 31, 56, 0.94), rgba(3, 18, 35, 0.96)) !important;
          border: 1px solid rgba(90, 149, 201, 0.42) !important;
          border-radius: 18px !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 1px auto !important;
          min-height: 151px !important;
          padding: 20px 13px 20px 25px !important;
        }

        .sa-card > .sa-card-icon {
          display: none !important;
        }

        .sa-card::before {
          background: rgba(111, 160, 205, 0.26) !important;
          grid-column: 2 !important;
          height: 124px !important;
          margin: 0 !important;
        }

        .sa-card-body {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          grid-column: 1 !important;
          min-height: 0 !important;
          padding: 0 !important;
        }

        .sa-card-label {
          font-size: 22px !important;
          margin: 0 0 18px !important;
        }

        .sa-card-tags {
          gap: 9px !important;
          max-width: 390px !important;
        }

        .sa-tag {
          background: linear-gradient(180deg, rgba(30, 58, 88, 0.95), rgba(15, 36, 62, 0.98)) !important;
          border: 1px solid rgba(165, 205, 241, 0.32) !important;
          font-size: 13px !important;
          padding: 7px 13px !important;
        }

        .sa-card-actions {
          gap: 18px !important;
          grid-column: 3 !important;
          justify-content: end !important;
          min-width: 308px !important;
          padding-left: 8px !important;
        }

        .sa-search-btn {
          border-radius: 12px !important;
          font-size: 14px !important;
          height: 44px !important;
          min-width: 124px !important;
          padding: 0 16px !important;
        }

        .sa-search-btn svg {
          height: 18px !important;
          width: 18px !important;
        }

        .sa-edit-btn,
        .sa-delete-btn {
          background: rgba(10, 35, 61, 0.72) !important;
          border: 1px solid rgba(123, 175, 220, 0.28) !important;
          height: 45px !important;
          width: 45px !important;
        }

        .sa-edit-btn svg,
        .sa-delete-btn svg {
          height: 19px !important;
          width: 19px !important;
        }

        .sa-toggle {
          height: 26px !important;
          overflow: visible !important;
          position: relative !important;
          width: 43px !important;
        }

        .sa-toggle::after {
          bottom: -19px !important;
          color: rgba(235, 244, 252, 0.78) !important;
          content: "Päällä" !important;
          font-size: 10px !important;
          font-weight: 800 !important;
          left: 50% !important;
          position: absolute !important;
          transform: translateX(-50%) !important;
          white-space: nowrap !important;
        }

        .sa-toggle-off::after {
          content: "Pois" !important;
        }

        .sa-toggle-knob {
          height: 22px !important;
          top: 2px !important;
          width: 22px !important;
        }

        .sa-toggle-on .sa-toggle-knob {
          left: 19px !important;
        }

        .sa-toggle-off .sa-toggle-knob {
          left: 2px !important;
        }

        .sa-form-card {
          border-radius: 18px !important;
          padding: 22px !important;
        }

        .sa-empty {
          min-height: 151px !important;
          padding: 26px !important;
        }

        @media (max-width: 920px) {
          .sa-layout {
            width: min(100% - 28px, 720px) !important;
          }

          .sa-hero {
            grid-template-columns: auto minmax(0, 1fr) !important;
            padding: 24px !important;
          }

          .sa-hero-stat,
          .sa-new-btn {
            grid-column: auto !important;
            grid-row: auto !important;
          }

          .sa-hero-stat {
            height: 88px !important;
            width: 88px !important;
          }

          .sa-new-btn {
            justify-self: start !important;
          }

          .sa-saved-head {
            grid-template-columns: 54px minmax(0, 1fr) !important;
          }

          .sa-add-condition {
            grid-column: 1 / -1 !important;
            justify-self: start !important;
          }

          .sa-saved-workspace {
            grid-template-columns: 1fr !important;
          }

          .sa-side-rail {
            display: flex !important;
            width: max-content !important;
          }

          .sa-card {
            grid-template-columns: 1fr !important;
          }

          .sa-card::before {
            display: none !important;
          }

          .sa-card-actions {
            grid-column: 1 !important;
            justify-content: flex-start !important;
            min-width: 0 !important;
            padding-left: 0 !important;
          }
        }

        @media (max-width: 600px) {
          .sa-layout {
            width: 100% !important;
          }

          .sa-hero {
            grid-template-columns: 1fr !important;
            min-height: 0 !important;
          }

          .sa-hero::after {
            left: 14px !important;
          }

          .sa-hero-icon {
            height: 66px !important;
            width: 66px !important;
          }

          .sa-hero h1 {
            font-size: 25px !important;
          }

          .sa-new-btn,
          .sa-add-condition {
            width: 100% !important;
          }

          .sa-saved-panel {
            padding: 18px 14px 22px !important;
          }

          .sa-saved-head {
            grid-template-columns: 1fr !important;
          }

          .sa-card {
            padding: 19px !important;
          }

          .sa-card-actions {
            gap: 12px !important;
          }
        }

        /* Final Finnish search-alert dashboard */
        body:has(.sa-page) {
          background: #020815 !important;
        }

        .sa-page {
          background:
            radial-gradient(720px 360px at 70% -10%, rgba(255, 111, 0, 0.13), transparent 58%),
            radial-gradient(680px 360px at 58% 48%, rgba(15, 75, 125, 0.28), transparent 68%),
            linear-gradient(180deg, #020714 0%, #03101d 52%, #051524 100%) !important;
          color: #f8fbff !important;
        }

        .sa-layout {
          width: min(952px, calc(100vw - 48px)) !important;
          gap: 16px !important;
          padding-top: 22px !important;
        }

        .sa-hero,
        .sa-saved-panel,
        .sa-form-card {
          border-radius: 18px !important;
          overflow: hidden !important;
        }

        .sa-hero {
          align-items: center !important;
          background:
            radial-gradient(260px 190px at 10% 46%, rgba(255, 114, 0, 0.16), transparent 66%),
            radial-gradient(540px 230px at 72% 0%, rgba(24, 85, 141, 0.28), transparent 72%),
            linear-gradient(135deg, rgba(8, 32, 58, 0.98), rgba(3, 17, 34, 0.99)) !important;
          border: 1px solid rgba(101, 153, 207, 0.46) !important;
          box-shadow: 0 20px 54px rgba(0, 6, 18, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
          display: grid !important;
          grid-template-columns: 132px minmax(0, 1fr) 1px minmax(310px, 390px) !important;
          gap: 26px !important;
          min-height: 216px !important;
          padding: 30px 36px !important;
          position: relative !important;
        }

        .sa-hero::after {
          background:
            radial-gradient(circle, rgba(255, 120, 10, 0.24) 1px, transparent 2px),
            radial-gradient(circle at center, rgba(255, 120, 10, 0.22), transparent 56%) !important;
          background-size: 14px 14px, auto !important;
          height: 160px !important;
          left: 26px !important;
          opacity: 0.62 !important;
          top: 22px !important;
          width: 160px !important;
          z-index: 0 !important;
        }

        .sa-hero::before {
          background: rgba(104, 151, 199, 0.24) !important;
          grid-column: 3 !important;
          height: 146px !important;
          width: 1px !important;
        }

        .sa-hero-icon {
          border-radius: 999px !important;
          height: 84px !important;
          justify-self: center !important;
          width: 84px !important;
          z-index: 1 !important;
        }

        .sa-hero-icon::before {
          border: 1px solid rgba(255, 126, 16, 0.34);
          border-radius: 999px;
          content: "";
          height: 128px;
          position: absolute;
          width: 128px;
        }

        .sa-hero h1 {
          font-size: 30px !important;
          letter-spacing: 0 !important;
          margin-bottom: 10px !important;
        }

        .sa-hero p {
          color: rgba(216, 229, 243, 0.82) !important;
          font-size: 15px !important;
          line-height: 1.45 !important;
          max-width: 280px !important;
        }

        .sa-new-btn {
          align-self: end !important;
          border-radius: 8px !important;
          font-size: 14px !important;
          grid-column: 2 !important;
          grid-row: 1 !important;
          height: 43px !important;
          justify-self: start !important;
          margin-top: 96px !important;
          min-width: 163px !important;
          padding: 0 20px !important;
          z-index: 2 !important;
        }

        .sa-hero-stats {
          display: grid !important;
          gap: 18px !important;
          grid-column: 4 !important;
          grid-template-columns: 1fr 1fr !important;
          min-width: 0 !important;
        }

        .sa-hero-stat {
          align-items: center !important;
          background:
            radial-gradient(160px 110px at 50% 0%, rgba(255, 119, 0, 0.13), transparent 68%),
            linear-gradient(180deg, rgba(8, 30, 55, 0.82), rgba(3, 16, 31, 0.88)) !important;
          border: 1px solid rgba(95, 147, 200, 0.33) !important;
          border-radius: 14px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
          color: #fff !important;
          display: grid !important;
          gap: 6px !important;
          height: 155px !important;
          justify-items: center !important;
          padding: 16px 14px !important;
          place-content: center !important;
          position: relative !important;
          width: auto !important;
        }

        .sa-hero-stat span {
          align-items: center !important;
          background: transparent !important;
          border: 1px solid rgba(255, 128, 13, 0.78) !important;
          border-radius: 999px !important;
          box-shadow: 0 0 22px rgba(255, 102, 0, 0.38), inset 0 0 18px rgba(255, 113, 0, 0.2) !important;
          color: #ff8b1a !important;
          display: inline-flex !important;
          height: 58px !important;
          justify-content: center !important;
          width: 58px !important;
        }

        .sa-hero-stat small,
        .sa-hero-stat em {
          color: rgba(225, 235, 247, 0.82) !important;
          font-size: 12px !important;
          font-style: normal !important;
          font-weight: 800 !important;
          line-height: 1.1 !important;
          text-align: center !important;
        }

        .sa-hero-stat strong {
          color: #fff !important;
          font-size: clamp(22px, 2.1vw, 25px) !important;
          font-weight: 950 !important;
          line-height: 1 !important;
          max-width: 100% !important;
          overflow-wrap: anywhere !important;
          text-align: center !important;
        }

        .sa-saved-panel {
          background:
            radial-gradient(520px 230px at 74% 0%, rgba(255, 116, 0, 0.11), transparent 66%),
            radial-gradient(520px 260px at 62% 54%, rgba(17, 77, 128, 0.24), transparent 72%),
            linear-gradient(135deg, rgba(8, 31, 55, 0.98), rgba(4, 18, 34, 0.99)) !important;
          border-color: rgba(255, 111, 0, 0.46) !important;
          box-shadow: 0 22px 58px rgba(0, 6, 18, 0.38), inset 0 1px 0 rgba(255,255,255,0.07) !important;
          padding: 22px 26px 28px !important;
        }

        .sa-saved-head h2 {
          font-size: 22px !important;
        }

        .sa-saved-head p {
          color: rgba(214, 227, 241, 0.76) !important;
          font-size: 13px !important;
        }

        .sa-saved-workspace {
          grid-template-columns: 258px minmax(0, 1fr) !important;
          gap: 20px !important;
        }

        .sa-side-rail {
          border-radius: 12px !important;
        }

        .sa-side-rail button,
        .sa-side-rail .sa-rail-create,
        .sa-side-rail .sa-rail-settings {
          align-items: center !important;
          border-bottom: 1px solid rgba(112, 157, 204, 0.15) !important;
          display: grid !important;
          gap: 16px !important;
          grid-template-columns: 56px minmax(0, 1fr) 16px !important;
          height: 82px !important;
          justify-content: initial !important;
          padding: 0 18px !important;
          text-align: left !important;
        }

        .sa-side-rail button::after {
          color: #ff7a0b;
          content: "›";
          font-size: 30px;
          line-height: 1;
        }

        .sa-side-rail button svg {
          background: rgba(255, 119, 0, 0.1);
          border: 1px solid rgba(255, 128, 13, 0.58);
          border-radius: 999px;
          box-shadow: 0 0 22px rgba(255, 105, 0, 0.25);
          color: #ff8a18;
          height: 52px;
          padding: 13px;
          width: 52px;
        }

        .sa-side-rail button span {
          color: #f8fbff !important;
          font-size: 14px !important;
          font-weight: 850 !important;
          line-height: 1.2 !important;
        }

        .sa-list,
        .sa-empty {
          min-height: 208px !important;
        }

        .sa-empty {
          background:
            radial-gradient(220px 100px at 50% 18%, rgba(255, 122, 10, 0.16), transparent 70%),
            radial-gradient(520px 180px at 60% 0%, rgba(18, 82, 128, 0.22), transparent 72%),
            linear-gradient(135deg, rgba(8, 31, 55, 0.88), rgba(4, 18, 34, 0.9)) !important;
          border: 1px solid rgba(91, 142, 194, 0.36) !important;
          border-radius: 14px !important;
          padding: 34px 26px !important;
        }

        .sa-empty h3 {
          color: #fff !important;
          font-size: 22px !important;
          font-weight: 950 !important;
        }

        .sa-empty p {
          color: rgba(216, 229, 243, 0.76) !important;
          max-width: 470px !important;
        }

        .sa-empty-icon {
          border-radius: 999px !important;
          height: 78px !important;
          width: 78px !important;
        }

        .sa-empty::after {
          background: linear-gradient(180deg, #ff951e 0%, #ff6f00 54%, #ef5700 100%);
          border: 1px solid rgba(255, 166, 71, 0.62);
          border-radius: 8px;
          box-shadow: 0 16px 34px rgba(255, 89, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.22);
          color: #fff;
          content: "Luo hakuvahti";
          display: inline-flex;
          font-size: 14px;
          font-weight: 900;
          height: 40px;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
          padding: 0 24px;
        }

        .sa-toggle::after {
          content: "Päällä" !important;
        }

        .sa-toggle-off::after {
          content: "Pois" !important;
        }

        .sa-card {
          border-radius: 14px !important;
        }

        .sa-card-body {
          border-radius: 12px !important;
        }

        .sa-card-label {
          overflow-wrap: anywhere !important;
          white-space: normal !important;
        }

        @media (max-width: 920px) {
          .sa-layout {
            width: min(100% - 28px, 720px) !important;
          }

          .sa-hero {
            grid-template-columns: 86px minmax(0, 1fr) !important;
            padding: 24px !important;
          }

          .sa-hero::before {
            display: none !important;
          }

          .sa-new-btn {
            grid-column: 1 / -1 !important;
            margin-top: 0 !important;
            width: 100% !important;
          }

          .sa-hero-stats {
            grid-column: 1 / -1 !important;
          }

          .sa-saved-workspace {
            grid-template-columns: 1fr !important;
          }

          .sa-side-rail {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            width: 100% !important;
          }
        }

        @media (max-width: 600px) {
          .sa-layout {
            width: 100% !important;
            padding: 16px 14px 54px !important;
          }

          .sa-hero {
            grid-template-columns: 1fr !important;
            padding: 22px !important;
          }

          .sa-hero-icon {
            justify-self: start !important;
          }

          .sa-hero p {
            max-width: none !important;
          }

          .sa-hero-stats,
          .sa-side-rail {
            grid-template-columns: 1fr !important;
          }

          .sa-hero-stat {
            height: 132px !important;
          }

          .sa-saved-panel {
            padding: 18px 14px 22px !important;
          }

          .sa-saved-head {
            grid-template-columns: 54px minmax(0, 1fr) !important;
          }

          .sa-add-condition {
            grid-column: 1 / -1 !important;
          }
        }

        html body .sa-page.sa-page {
          background:
            radial-gradient(720px 360px at 70% -10%, rgba(255, 111, 0, 0.13), transparent 58%),
            radial-gradient(680px 360px at 58% 48%, rgba(15, 75, 125, 0.28), transparent 68%),
            linear-gradient(180deg, #020714 0%, #03101d 52%, #051524 100%) !important;
        }

        .sa-hero-copy {
          grid-column: 2 !important;
          min-width: 0 !important;
          position: relative !important;
          z-index: 2 !important;
        }

        .sa-hero.sa-hero {
          align-self: stretch !important;
          max-width: none !important;
          min-width: 100% !important;
          width: 100% !important;
        }

        .sa-hero-copy .sa-new-btn {
          display: inline-flex !important;
          grid-column: auto !important;
          grid-row: auto !important;
          justify-self: start !important;
          margin: 18px 0 0 !important;
          width: auto !important;
        }

        .sa-hero-stats {
          align-items: stretch !important;
          grid-column: 4 !important;
          grid-row: 1 !important;
        }

        .sa-hero-stats .sa-hero-stat {
          grid-column: auto !important;
          grid-row: auto !important;
          height: 155px !important;
          min-width: 0 !important;
          width: 100% !important;
        }

        @media (max-width: 920px) {
          .sa-hero-copy {
            grid-column: 2 !important;
          }

          .sa-hero-stats {
            grid-column: 1 / -1 !important;
            grid-row: auto !important;
          }
        }

        @media (max-width: 600px) {
          .sa-hero-copy {
            grid-column: 1 !important;
          }
        }

        @media (max-width: 600px) {
          .sa-layout {
            box-sizing: border-box !important;
            padding: 16px 0 54px !important;
            width: calc(100vw - 28px) !important;
          }

          .sa-hero.sa-hero {
            box-sizing: border-box !important;
            grid-template-columns: minmax(0, 1fr) !important;
            min-width: 0 !important;
            overflow: hidden !important;
            width: 100% !important;
          }

          .sa-hero-stats {
            grid-template-columns: minmax(0, 1fr) !important;
            width: 100% !important;
          }

          .sa-hero-copy,
          .sa-hero-copy h1,
          .sa-hero-copy p {
            max-width: 100% !important;
            overflow-wrap: anywhere !important;
            white-space: normal !important;
          }

          .sa-hero-copy .sa-new-btn {
            max-width: 100% !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 920px) {
          .sa-layout {
            box-sizing: border-box !important;
            overflow-x: hidden !important;
            width: min(720px, calc(100vw - 28px)) !important;
          }

          .sa-hero.sa-hero {
            box-sizing: border-box !important;
            grid-template-columns: minmax(0, 1fr) !important;
            min-width: 0 !important;
            overflow: hidden !important;
          }

          .sa-hero-copy {
            grid-column: 1 !important;
          }

          .sa-hero-copy p {
            max-width: 100% !important;
            overflow-wrap: anywhere !important;
            white-space: normal !important;
          }

          .sa-hero-stats {
            grid-column: 1 !important;
            grid-template-columns: minmax(0, 1fr) !important;
            width: 100% !important;
          }
        }

        /* Exact compact reference pass */
        html body .sa-page.sa-page {
          background:
            radial-gradient(520px 260px at 50% -80px, rgba(15, 64, 112, 0.28), transparent 72%),
            radial-gradient(420px 280px at 60% 45%, rgba(13, 57, 98, 0.22), transparent 70%),
            linear-gradient(180deg, #020817 0%, #03101f 100%) !important;
          min-height: calc(100vh - var(--topbar-h, 56px)) !important;
          padding-bottom: 34px !important;
        }

        .sa-layout.sa-layout {
          box-sizing: border-box !important;
          gap: 14px !important;
          padding-top: 6px !important;
          width: min(674px, calc(100vw - 70px)) !important;
        }

        .sa-hero.sa-hero {
          background:
            radial-gradient(180px 140px at 11% 50%, rgba(255, 126, 10, 0.14), transparent 68%),
            linear-gradient(135deg, rgba(9, 37, 72, 0.96), rgba(5, 22, 47, 0.98)) !important;
          border: 1px solid rgba(66, 111, 166, 0.36) !important;
          border-radius: 16px !important;
          box-shadow: 0 18px 48px rgba(0, 6, 18, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
          display: grid !important;
          gap: 20px !important;
          grid-template-columns: 126px minmax(0, 1fr) 1px 228px !important;
          min-height: 160px !important;
          min-width: 0 !important;
          padding: 26px 26px 24px !important;
          width: 100% !important;
        }

        .sa-hero::before {
          background: rgba(101, 144, 190, 0.2) !important;
          display: block !important;
          grid-column: 3 !important;
          height: 108px !important;
          width: 1px !important;
        }

        .sa-hero::after {
          background:
            radial-gradient(circle, rgba(255, 123, 12, 0.32) 1px, transparent 1.8px),
            radial-gradient(circle at center, rgba(255, 120, 10, 0.18), transparent 64%) !important;
          background-size: 13px 13px, auto !important;
          height: 118px !important;
          left: 38px !important;
          opacity: 0.72 !important;
          top: 22px !important;
          width: 118px !important;
        }

        .sa-hero-icon.sa-hero-icon {
          border-radius: 999px !important;
          height: 76px !important;
          justify-self: center !important;
          width: 76px !important;
        }

        .sa-hero-icon::before {
          height: 108px !important;
          width: 108px !important;
        }

        .sa-hero-copy {
          align-self: center !important;
          grid-column: 2 !important;
        }

        .sa-hero h1 {
          font-size: 20px !important;
          line-height: 1.1 !important;
          margin: 0 0 6px !important;
        }

        .sa-hero p {
          color: rgba(223, 233, 246, 0.78) !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          line-height: 1.35 !important;
          max-width: 220px !important;
        }

        .sa-hero-copy .sa-new-btn {
          border-radius: 6px !important;
          font-size: 11px !important;
          gap: 7px !important;
          height: 30px !important;
          margin-top: 12px !important;
          min-width: 105px !important;
          padding: 0 13px !important;
        }

        .sa-hero-copy .sa-new-btn svg {
          height: 13px !important;
          width: 13px !important;
        }

        .sa-hero-stats {
          align-self: center !important;
          display: grid !important;
          gap: 14px !important;
          grid-column: 4 !important;
          grid-template-columns: 1fr 1fr !important;
        }

        .sa-hero-stats .sa-hero-stat {
          background:
            radial-gradient(120px 90px at 50% 0%, rgba(255, 118, 0, 0.1), transparent 68%),
            linear-gradient(180deg, rgba(8, 34, 66, 0.72), rgba(4, 18, 38, 0.84)) !important;
          border: 1px solid rgba(77, 126, 180, 0.34) !important;
          border-radius: 9px !important;
          height: 92px !important;
          padding: 8px !important;
        }

        .sa-hero-stats .sa-hero-stat span {
          height: 36px !important;
          width: 36px !important;
        }

        .sa-hero-stats .sa-hero-stat span svg {
          height: 15px !important;
          width: 15px !important;
        }

        .sa-hero-stats .sa-hero-stat small,
        .sa-hero-stats .sa-hero-stat em {
          color: rgba(214, 226, 241, 0.74) !important;
          font-size: 9px !important;
          font-weight: 750 !important;
        }

        .sa-hero-stats .sa-hero-stat strong {
          font-size: 19px !important;
        }

        .sa-saved-panel.sa-saved-panel {
          background: linear-gradient(135deg, rgba(7, 31, 61, 0.9), rgba(4, 19, 40, 0.96)) !important;
          border: 1px solid rgba(54, 99, 154, 0.28) !important;
          border-radius: 13px !important;
          box-shadow: 0 18px 46px rgba(0, 6, 18, 0.35), inset 0 1px 0 rgba(255,255,255,0.04) !important;
          min-height: 242px !important;
          padding: 18px 18px 15px !important;
        }

        .sa-saved-head {
          display: block !important;
          margin: 0 0 12px !important;
          padding: 0 !important;
        }

        .sa-saved-search,
        .sa-add-condition {
          display: none !important;
        }

        .sa-saved-head h2 {
          font-size: 13px !important;
          line-height: 1.1 !important;
          margin: 0 !important;
        }

        .sa-saved-head p {
          display: none !important;
        }

        .sa-saved-workspace {
          display: grid !important;
          gap: 13px !important;
          grid-template-columns: 134px minmax(0, 1fr) !important;
        }

        .sa-side-rail {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          display: grid !important;
          gap: 8px !important;
          overflow: visible !important;
          padding: 0 13px 0 0 !important;
          position: relative !important;
        }

        .sa-side-rail::after {
          background: rgba(84, 128, 177, 0.18);
          content: "";
          height: 210px;
          position: absolute;
          right: 0;
          top: 0;
          width: 1px;
        }

        .sa-side-rail::before {
          display: none !important;
        }

        .sa-side-rail button,
        .sa-side-rail .sa-rail-create,
        .sa-side-rail .sa-rail-settings {
          background: transparent !important;
          border: 0 !important;
          border-radius: 7px !important;
          box-shadow: none !important;
          color: rgba(219, 232, 246, 0.82) !important;
          display: grid !important;
          gap: 10px !important;
          grid-template-columns: 20px minmax(0, 1fr) !important;
          height: 33px !important;
          padding: 0 12px !important;
        }

        .sa-side-rail button.is-active {
          background: rgba(255, 112, 0, 0.09) !important;
          border: 1px solid rgba(255, 122, 11, 0.62) !important;
          box-shadow: inset 3px 0 0 #ff7a0b, 0 0 18px rgba(255, 107, 0, 0.12) !important;
        }

        .sa-side-rail button::after {
          content: none !important;
        }

        .sa-side-rail button svg {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: #ff7a0b !important;
          height: 16px !important;
          padding: 0 !important;
          width: 16px !important;
        }

        .sa-side-rail button:not(.is-active) svg {
          color: #9ab5d1 !important;
        }

        .sa-side-rail button span {
          color: inherit !important;
          font-size: 10px !important;
          font-weight: 850 !important;
        }

        .sa-list {
          min-height: 213px !important;
        }

        .sa-empty {
          background:
            radial-gradient(190px 120px at 50% 12%, rgba(255, 116, 0, 0.1), transparent 72%),
            linear-gradient(135deg, rgba(4, 20, 42, 0.98), rgba(2, 12, 28, 0.99)) !important;
          border: 1px solid rgba(255, 122, 11, 0.82) !important;
          border-radius: 9px !important;
          box-shadow:
            0 0 0 1px rgba(255, 122, 11, 0.08),
            0 18px 42px rgba(0, 6, 18, 0.28),
            inset 0 1px 0 rgba(255, 173, 84, 0.12) !important;
          gap: 7px !important;
          min-height: 213px !important;
          padding: 28px 20px !important;
        }

        .sa-list .sa-empty.sa-empty {
          background:
            radial-gradient(190px 120px at 50% 12%, rgba(255, 116, 0, 0.1), transparent 72%),
            linear-gradient(135deg, #04162d 0%, #020c1c 100%) !important;
          border-color: rgba(255, 122, 11, 0.86) !important;
        }

        .sa-empty-icon {
          background: rgba(255, 112, 0, 0.1) !important;
          border: 1px solid rgba(255, 122, 11, 0.42) !important;
          box-shadow: 0 0 28px rgba(255, 107, 0, 0.13) !important;
          color: #ff8a18 !important;
          height: 64px !important;
          opacity: 0.9 !important;
          width: 64px !important;
        }

        .sa-empty h3 {
          font-size: 16px !important;
          margin-top: 2px !important;
        }

        .sa-empty p {
          color: rgba(207, 221, 237, 0.72) !important;
          font-size: 10px !important;
          line-height: 1.35 !important;
          max-width: 260px !important;
        }

        .sa-empty::after {
          content: none !important;
        }

        .sa-empty-btn {
          align-items: center;
          background: linear-gradient(180deg, #ff941b, #ff6a00);
          border: 1px solid rgba(255, 158, 55, 0.55);
          border-radius: 6px;
          box-shadow: 0 12px 26px rgba(255, 99, 0, 0.22), inset 0 1px 0 rgba(255,255,255,0.2);
          color: #fff;
          cursor: pointer;
          display: inline-flex;
          font-size: 11px;
          font-weight: 850;
          height: 28px;
          justify-content: center;
          margin-top: 5px;
          padding: 0 15px;
        }

        @media (max-width: 640px) {
          .sa-layout.sa-layout {
            width: min(674px, calc(100vw - 24px)) !important;
          }

          .sa-hero.sa-hero {
            grid-template-columns: 86px minmax(0, 1fr) !important;
            gap: 16px !important;
            padding: 22px !important;
          }

          .sa-hero::before {
            display: none !important;
          }

          .sa-hero-icon.sa-hero-icon {
            height: 68px !important;
            width: 68px !important;
          }

          .sa-hero-copy {
            grid-column: 2 !important;
          }

          .sa-hero-stats {
            grid-column: 1 / -1 !important;
            grid-template-columns: 1fr 1fr !important;
          }

          .sa-saved-workspace {
            grid-template-columns: 1fr !important;
          }

          .sa-side-rail {
            grid-template-columns: 1fr 1fr 1fr !important;
            padding: 0 !important;
          }

          .sa-side-rail::after {
            display: none !important;
          }
        }

        @media (min-width: 641px) and (max-width: 920px) {
          .sa-saved-workspace {
            grid-template-columns: 134px minmax(0, 1fr) !important;
          }

          .sa-side-rail {
            display: grid !important;
            grid-template-columns: 1fr !important;
            padding: 0 13px 0 0 !important;
            width: auto !important;
          }

          .sa-side-rail::after {
            display: block !important;
          }
        }

        @media (max-width: 460px) {
          .sa-hero.sa-hero {
            grid-template-columns: 1fr !important;
          }

          .sa-hero-copy {
            grid-column: 1 !important;
          }

          .sa-hero-stats,
          .sa-side-rail {
            grid-template-columns: 1fr !important;
          }
        }

        /* Search alert polish pass: roomier desktop layout and non-overlapping stat cards. */
        .sa-layout.sa-layout {
          gap: 28px !important;
          padding-top: 22px !important;
          width: min(860px, calc(100vw - 96px)) !important;
        }

        .sa-hero.sa-hero {
          border-color: rgba(93, 145, 199, 0.42) !important;
          border-radius: 18px !important;
          gap: 30px !important;
          grid-template-columns: 126px minmax(0, 1fr) 1px minmax(310px, 340px) !important;
          min-height: 188px !important;
          padding: 28px 34px !important;
        }

        .sa-hero::after {
          left: 42px !important;
          top: 28px !important;
        }

        .sa-hero-icon.sa-hero-icon {
          height: 84px !important;
          width: 84px !important;
        }

        .sa-hero-icon::before {
          height: 118px !important;
          width: 118px !important;
        }

        .sa-hero h1 {
          font-size: 25px !important;
          line-height: 1.08 !important;
        }

        .sa-hero p {
          font-size: 13px !important;
          max-width: 270px !important;
        }

        .sa-hero-copy .sa-new-btn {
          font-size: 12px !important;
          height: 38px !important;
          min-width: 148px !important;
          padding: 0 17px !important;
        }

        .sa-hero-stats {
          gap: 16px !important;
          min-width: 0 !important;
        }

        .sa-hero-stats .sa-hero-stat {
          align-content: start !important;
          display: grid !important;
          gap: 9px !important;
          grid-template-rows: 44px 14px 30px 14px !important;
          height: 146px !important;
          justify-items: center !important;
          overflow: visible !important;
          padding: 14px 12px 13px !important;
          place-content: initial !important;
        }

        .sa-hero-stats .sa-hero-stat span {
          align-self: center !important;
          height: 44px !important;
          width: 44px !important;
        }

        .sa-hero-stats .sa-hero-stat span svg {
          height: 17px !important;
          width: 17px !important;
        }

        .sa-hero-stats .sa-hero-stat small,
        .sa-hero-stats .sa-hero-stat em {
          display: block !important;
          font-size: 9.5px !important;
          line-height: 1 !important;
          max-width: 100% !important;
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: nowrap !important;
        }

        .sa-hero-stats .sa-hero-stat small {
          color: rgba(214, 226, 241, 0.7) !important;
          text-transform: none !important;
        }

        .sa-hero-stats .sa-hero-stat em {
          color: rgba(214, 226, 241, 0.62) !important;
          font-weight: 800 !important;
        }

        .sa-hero-stats .sa-hero-stat strong {
          align-self: center !important;
          align-items: center !important;
          background: rgba(255, 255, 255, 0.055) !important;
          border: 1px solid rgba(255, 139, 26, 0.24) !important;
          border-radius: 999px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
          color: #ffffff !important;
          display: inline-flex !important;
          font-size: 18px !important;
          font-weight: 950 !important;
          height: 30px !important;
          justify-content: center !important;
          letter-spacing: 0 !important;
          line-height: 1 !important;
          max-width: 100% !important;
          min-width: 0 !important;
          overflow-wrap: normal !important;
          padding: 0 12px !important;
          text-shadow: none !important;
          white-space: nowrap !important;
        }

        .sa-saved-panel.sa-saved-panel {
          border-color: rgba(68, 119, 174, 0.38) !important;
          border-radius: 16px !important;
          min-height: 306px !important;
          padding: 24px 24px 22px !important;
        }

        .sa-saved-head h2 {
          font-size: 16px !important;
        }

        .sa-saved-workspace {
          gap: 20px !important;
          grid-template-columns: 150px minmax(0, 1fr) !important;
        }

        .sa-side-rail {
          gap: 12px !important;
          padding-right: 18px !important;
        }

        .sa-side-rail::after {
          height: 100% !important;
        }

        .sa-side-rail button,
        .sa-side-rail .sa-rail-create,
        .sa-side-rail .sa-rail-settings {
          gap: 11px !important;
          grid-template-columns: 18px minmax(0, 1fr) !important;
          height: 40px !important;
          padding: 0 14px !important;
        }

        .sa-side-rail button svg {
          height: 17px !important;
          width: 17px !important;
        }

        .sa-side-rail button span {
          font-size: 11.5px !important;
          line-height: 1.1 !important;
        }

        .sa-list,
        .sa-empty {
          min-height: 252px !important;
        }

        .sa-empty {
          gap: 12px !important;
          padding: 34px 28px !important;
        }

        .sa-empty h3 {
          font-size: 20px !important;
        }

        .sa-empty p {
          font-size: 12px !important;
          max-width: 360px !important;
        }

        .sa-empty-btn {
          font-size: 12px !important;
          height: 34px !important;
          padding: 0 20px !important;
        }

        @media (max-width: 820px) {
          .sa-layout.sa-layout {
            width: min(100% - 28px, 680px) !important;
          }

          .sa-hero.sa-hero {
            grid-template-columns: 88px minmax(0, 1fr) !important;
          }

          .sa-hero-stats {
            grid-column: 1 / -1 !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .sa-saved-workspace {
            grid-template-columns: 1fr !important;
          }

          .sa-side-rail {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            padding-right: 0 !important;
          }

          .sa-side-rail::after {
            display: none !important;
          }
        }

        @media (max-width: 520px) {
          .sa-layout.sa-layout {
            width: calc(100vw - 24px) !important;
          }

          .sa-hero.sa-hero {
            grid-template-columns: 1fr !important;
          }

          .sa-hero-copy,
          .sa-hero-stats {
            grid-column: 1 !important;
          }

          .sa-hero p {
            max-width: none !important;
          }

          .sa-hero-stats,
          .sa-side-rail {
            grid-template-columns: 1fr !important;
          }
        }

        /* Follow the admin appearance base/background color. Keep this last so it wins old page gradients. */
        body:has(.sa-page),
        html body:has(.sa-page) {
          background: var(--site-bg, var(--bg, #0b1118)) !important;
          background-image: none !important;
        }

        html body .sa-page.sa-page {
          background: var(--site-bg, var(--bg, #0b1118)) !important;
          background-image: none !important;
        }
      `}</style>

    </main>
  );
}
