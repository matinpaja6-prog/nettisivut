"use client";
import UiText from "@/app/components/UiText";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/lib/navigation";
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
import { listingPath, listingUrlId } from "@/lib/routes";

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
  const { t, locale } = useLanguage();
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
              <small><UiText text={"Hakuvahteja"} /></small>
              <strong>{activeCount}</strong>
              <em><UiText text={"aktiivista"} /></em>
            </div>
            <div className="sa-hero-stat">
              <span><Zap size={19} /></span>
              <small><UiText text={"Ilmoitukset"} /></small>
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
                  <label><UiText text={"Alakategoria"} /></label>
                  <select
                    value={form.subcategory}
                    onChange={e => updateFormField("subcategory", e.target.value)}
                  >
                    <option value=""><UiText text={"Kaikki"} /></option>
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
              <h2><UiText text={"Tallennetut hakuehdot"} /></h2>
              <p><UiText text={"Hallinnoi tallennettuja hakuehtojasi ja saat ilmoitukset niistä."} /></p>
            </div>
            <button
              className="sa-add-condition"
              onClick={() => { setShowForm(true); setError(""); }}
            >
              <Plus size={18} /><UiText text={"Lisää hakuvahti"} /></button>
          </div>

          <div className="sa-saved-workspace">
            <nav className="sa-side-rail" aria-label="Hakuvahdin osiot">
              <button
                className="is-active sa-rail-create"
                aria-label="Kaikki hakuvahdit"
                onClick={() => { setShowForm(true); setError(""); }}
              >
                <Search size={20} />
                <span><UiText text={"Kaikki vahdit"} /></span>
              </button>
            </nav>

            <div className="sa-list">
              {loading ? (
                <div className="sa-empty" aria-busy="true" />
              ) : alerts.length === 0 ? (
                <div className="sa-empty">
                  <div className="sa-empty-icon"><BellOff size={36} /></div>
                  <h3><UiText text={"Ei hakuvahteja vielä"} /></h3>
                  <p><UiText text={"Luo ensimmäinen hakuvahti, niin ilmoitamme kun sopiva ilmoitus vastaa hakuehtojasi."} /></p>
                  <button
                    className="sa-empty-btn"
                    onClick={() => { setShowForm(true); setError(""); }}
                  ><UiText text={"Luo ensimmäinen hakuvahti"} /></button>
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
                    {alert.query && <span className="sa-tag sa-tag-gray"><UiText text={"Haku: "} />{alert.query}</span>}
                    {alert.max_price != null && <span className="sa-tag sa-tag-green"><UiText text={"max "} />{alert.max_price} €</span>}
                  </div>
                </div>
                {notifsForAlert(alert.id).length > 0 && (
                  <div className="sa-notif-list">
                    <div className="sa-notif-header">{t.saHits} — {notifsForAlert(alert.id).length} {t.saFoundSuffix}</div>
                    {notifsForAlert(alert.id).map(n => (
                      <a key={n.id} href={listingPath(n, locale)} className="sa-notif-item">
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
                          <label><UiText text={"Alakategoria"} /></label>
                          <select value={editForm.subcategory} onChange={e => setEditForm({...editForm, subcategory: e.target.value})}>
                            <option value=""><UiText text={"Kaikki"} /></option>
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
                            <option value=""><UiText text={"— Kaikki merkit —"} /></option>
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
                      <div className="sa-matches-empty" aria-busy="true" />
                    ) : (matches[alert.id]?.length ?? 0) === 0 ? (
                      <div className="sa-matches-empty">{t.saNoMatches}</div>
                    ) : (
                      <>
                        <div className="sa-notif-header">{t.saFound} {matches[alert.id].length} {t.saFoundSuffix}</div>
                        {matches[alert.id].map(l => (
                          <a key={l.id} href={listingPath(l, locale)} className="sa-notif-item">
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
          background: rgba(2, 9, 18, 0.94);
          border-bottom: 1px solid rgba(126, 197, 240, 0.18);
          box-shadow: none;
        }
        body:has(.sa-page) .universal-app-topbar::after {
          display: none;
        }
        body:has(.sa-page) .universal-return-button {
          background: transparent;
          border: 0;
          box-shadow: none;
          min-height: 54px;
          padding: 0;
        }
        body:has(.sa-page) .universal-return-button strong {
          display: none;
        }
        body:has(.sa-page) .universal-return-button svg {
          background: transparent;
          border: 0;
          box-shadow: none;
          color: #ff7a1a;
          height: 38px;
          padding: 0;
          stroke-width: 3;
          width: 38px;
        }

        .sa-page {
          min-height: calc(100vh - var(--topbar-h, 76px));
          background:
            radial-gradient(920px 520px at 50% 0%, rgba(10, 46, 76, 0.46), transparent 68%),
            radial-gradient(780px 480px at 52% 58%, rgba(8, 42, 70, 0.48), transparent 72%),
            linear-gradient(180deg, #020914 0%, #04111e 48%, #061827 100%);
          color: #ffffff;
          padding: 0 0 110px;
        }
        .sa-topbar {
          display: none;
        }
        .sa-layout {
          width: min(1120px, calc(100vw - 48px));
          max-width: none;
          margin: 0 auto;
          padding: 78px 0 0;
          gap: 34px;
        }

        .sa-hero,
        .sa-card,
        .sa-form-card,
        .sa-empty {
          background:
            radial-gradient(520px 220px at 0% 0%, rgba(255, 122, 26, 0.12), transparent 68%),
            radial-gradient(760px 300px at 100% 0%, rgba(18, 82, 128, 0.34), transparent 72%),
            linear-gradient(135deg, rgba(9, 32, 53, 0.96), rgba(4, 21, 38, 0.98));
          border: 1px solid rgba(126, 197, 240, 0.25);
          border-radius: 26px;
          box-shadow:
            0 28px 70px rgba(0, 7, 18, 0.38),
            inset 0 1px 0 rgba(255, 255, 255, 0.07);
          color: #ffffff;
        }

        .sa-hero {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) 1px auto;
          align-items: center;
          gap: 24px;
          min-height: 136px;
          padding: 28px 34px 28px 38px;
        }
        .sa-hero::before {
          content: "";
          align-self: stretch;
          background: rgba(126, 197, 240, 0.17);
          grid-column: 3;
          grid-row: 1;
          height: 86px;
          width: 1px;
        }
        .sa-hero > div:not(.sa-hero-icon) {
          min-width: 0;
        }
        .sa-hero-icon,
        .sa-card-icon,
        .sa-empty-icon {
          background:
            radial-gradient(circle at 28% 20%, rgba(255, 255, 255, 0.38), transparent 34%),
            linear-gradient(135deg, #ff9a24 0%, #ff7816 52%, #ec5c00 100%);
          border: 1px solid rgba(255, 210, 168, 0.46);
          box-shadow:
            0 18px 36px rgba(255, 107, 22, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
          color: #ffffff;
        }
        .sa-hero-icon {
          border-radius: 18px;
          height: 74px;
          width: 74px;
        }
        .sa-hero-icon svg {
          height: 32px;
          stroke-width: 2.4;
          width: 32px;
        }
        .sa-hero h1 {
          color: #ffffff;
          font-size: 30px;
          font-weight: 950;
          line-height: 1.05;
          margin: 0 0 12px;
          text-shadow: 0 8px 22px rgba(0, 0, 0, 0.34);
        }
        .sa-hero p {
          color: rgba(232, 240, 248, 0.94);
          font-size: 17px;
          font-weight: 650;
          line-height: 1.45;
          margin: 0;
        }
        .sa-hero p strong {
          color: #ff7a1a;
          font-weight: 950;
        }
        .sa-new-btn,
        .sa-save-btn,
        .sa-search-btn {
          background: linear-gradient(135deg, #ff9a24 0%, #ff7414 52%, #ec5c00 100%);
          border: 1px solid rgba(255, 210, 168, 0.48);
          border-radius: 18px;
          box-shadow:
            0 16px 32px rgba(255, 107, 22, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.26);
          color: #ffffff;
          font-size: 20px;
          font-weight: 950;
          height: 56px;
          padding: 0 24px;
        }
        .sa-new-btn {
          grid-column: 4;
          grid-row: 1;
          justify-self: end;
          margin-left: 0;
          min-width: 218px;
        }
        .sa-new-btn svg,
        .sa-search-btn svg {
          height: 22px;
          width: 22px;
        }

        .sa-list {
          gap: 20px;
        }
        .sa-card {
          align-items: center;
          display: grid;
          gap: 22px;
          grid-template-columns: 56px minmax(320px, 436px) 1fr;
          min-height: 178px;
          padding: 26px 26px;
        }
        .sa-card-icon {
          border-radius: 13px;
          grid-column: 1;
          grid-row: 1;
          height: 56px;
          justify-self: center;
          width: 56px;
        }
        .sa-card-icon svg {
          height: 26px;
          width: 26px;
        }
        .sa-card::before {
          content: "";
          background: rgba(126, 197, 240, 0.16);
          grid-column: 1;
          grid-row: 1;
          height: 112px;
          justify-self: end;
          margin-right: -8px;
          width: 1px;
        }
        .sa-card-body {
          background: rgba(3, 12, 22, 0.46);
          border: 1px solid rgba(126, 197, 240, 0.22);
          border-radius: 19px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          grid-column: 2;
          grid-row: 1;
          min-height: 142px;
          padding: 22px 24px;
        }
        .sa-card-label {
          color: #ffffff;
          font-size: 27px;
          font-weight: 950;
          letter-spacing: 0;
          margin: 0 0 18px;
        }
        .sa-card-tags {
          gap: 10px;
        }
        .sa-tag {
          background:
            radial-gradient(120px 42px at 20% 0%, rgba(255, 255, 255, 0.2), transparent 64%),
            linear-gradient(180deg, rgba(55, 70, 83, 0.98), rgba(28, 42, 55, 0.98));
          border: 1px solid rgba(207, 226, 240, 0.28);
          border-radius: 999px;
          box-shadow:
            0 7px 16px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          color: #ffffff;
          font-size: 15px;
          font-weight: 900;
          padding: 7px 15px;
        }
        .sa-card-actions {
          align-items: center;
          display: flex;
          gap: 16px;
          grid-column: 3;
          grid-row: 1;
          justify-content: center;
        }
        .sa-search-btn {
          border-radius: 15px;
          font-size: 16px;
          height: 56px;
          min-width: 166px;
          padding: 0 20px;
        }
        .sa-edit-btn,
        .sa-delete-btn {
          background: rgba(15, 37, 58, 0.72);
          border: 1px solid rgba(126, 197, 240, 0.28);
          border-radius: 50%;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          color: #ffffff;
          height: 54px;
          width: 54px;
        }
        .sa-edit-btn svg,
        .sa-delete-btn svg {
          height: 24px;
          width: 24px;
        }
        .sa-toggle {
          background: rgba(64, 87, 106, 0.86);
          border: 0;
          border-radius: 999px;
          height: 39px;
          padding: 0;
          width: 63px;
        }
        .sa-toggle-on {
          background: rgba(64, 87, 106, 0.86);
        }
        .sa-toggle-knob {
          background: #f8fafc;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.32);
          height: 34px;
          top: 2px;
          width: 34px;
        }
        .sa-toggle-on .sa-toggle-knob { left: 3px; }
        .sa-toggle-off .sa-toggle-knob { left: 26px; opacity: 0.5; }

        .sa-form-card {
          padding: 30px;
        }
        .sa-field label,
        .sa-form-title,
        .sa-form-note,
        .sa-empty p,
        .sa-empty h3 {
          color: #ffffff;
        }
        .sa-field input,
        .sa-field select {
          background: rgba(3, 12, 22, 0.62);
          border: 1px solid rgba(126, 197, 240, 0.26);
          color: #ffffff;
        }

        @media (max-width: 920px) {
          .sa-layout {
            width: min(100% - 28px, 640px);
            padding-top: 28px;
          }
          .sa-hero {
            grid-template-columns: auto 1fr;
            min-height: auto;
            padding: 24px;
          }
          .sa-hero::before {
            display: none;
          }
          .sa-new-btn {
            grid-column: 1 / -1;
            justify-self: stretch;
            min-width: 0;
          }
          .sa-card {
            grid-template-columns: auto 1fr;
            min-height: auto;
          }
          .sa-card::before {
            display: none;
          }
          .sa-card-body {
            grid-column: 2;
            min-height: 0;
          }
          .sa-card-actions {
            grid-column: 1 / -1;
            justify-content: flex-start;
            padding-left: 96px;
          }
        }

        @media (max-width: 600px) {
          .sa-form-grid { grid-template-columns: 1fr; }
          .sa-hero { flex-wrap: wrap; }
          .sa-new-btn { margin-left: 0; width: 100%; justify-content: center; }
          .sa-topbar { padding: 0 16px; }
          .sa-layout { padding: 20px 16px 40px; }
          .sa-layout {
            width: 100%;
            padding: 18px 14px 56px;
          }
          .sa-hero {
            grid-template-columns: 1fr;
            gap: 18px;
            padding: 22px;
          }
          .sa-hero-icon {
            height: 72px;
            width: 72px;
          }
          .sa-hero h1 {
            font-size: 28px;
          }
          .sa-hero p {
            font-size: 16px;
          }
          .sa-card {
            grid-template-columns: 1fr;
            gap: 18px;
            padding: 22px;
          }
          .sa-card-icon {
            justify-self: start;
          }
          .sa-card-body {
            grid-column: 1;
            padding: 20px;
          }
          .sa-card-actions {
            grid-column: 1;
            justify-content: flex-start;
            padding-left: 0;
            flex-wrap: wrap;
          }
          .sa-card-label {
            font-size: 26px;
          }
          .sa-tag {
            font-size: 15px;
          }
        }

        /* Compact reference layout */
        .sa-page {
          background:
            radial-gradient(760px 280px at 62% -12%, rgba(255, 92, 0, 0.12), transparent 58%),
            radial-gradient(620px 360px at 58% 42%, rgba(15, 72, 116, 0.26), transparent 70%),
            linear-gradient(180deg, #020815 0%, #04101c 58%, #051522 100%);
          overflow-x: hidden;
        }

        .sa-layout {
          width: min(912px, calc(100vw - 56px));
          padding-top: 22px;
          gap: 22px;
        }

        .sa-hero {
          background:
            radial-gradient(300px 180px at 8% 42%, rgba(255, 112, 10, 0.14), transparent 68%),
            radial-gradient(540px 160px at 62% 0%, rgba(28, 95, 151, 0.22), transparent 70%),
            linear-gradient(135deg, rgba(8, 38, 68, 0.98), rgba(3, 19, 39, 0.98));
          border: 1px solid rgba(90, 149, 201, 0.48);
          border-radius: 18px;
          box-shadow:
            0 18px 50px rgba(0, 6, 18, 0.36),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) 1px auto 136px;
          gap: 26px;
          min-height: 174px;
          overflow: hidden;
          padding: 26px 24px 26px 47px;
          position: relative;
          width: 100%;
        }

        .sa-hero::after {
          background:
            repeating-radial-gradient(ellipse at center, rgba(255, 118, 10, 0.26) 0 1px, transparent 1px 11px);
          border-radius: 999px;
          content: "";
          height: 126px;
          left: 24px;
          opacity: 0.5;
          position: absolute;
          top: 18px;
          width: 126px;
        }

        .sa-hero::before {
          background: rgba(111, 160, 205, 0.28);
          grid-column: 3;
          height: 86px;
        }

        .sa-hero-icon {
          border-radius: 18px;
          height: 78px;
          width: 78px;
          z-index: 1;
        }

        .sa-hero h1 {
          font-size: 29px;
          margin-bottom: 7px;
        }

        .sa-hero p {
          font-size: 15px;
          max-width: 310px;
        }

        .sa-new-btn,
        .sa-add-condition {
          background: linear-gradient(180deg, #ff951e 0%, #ff6f00 54%, #ef5700 100%);
          border: 1px solid rgba(255, 166, 71, 0.62);
          border-radius: 18px;
          box-shadow:
            0 16px 34px rgba(255, 89, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.24);
          color: #fff;
        }

        .sa-new-btn {
          font-size: 14px;
          grid-column: 4;
          height: 47px;
          min-width: 179px;
          padding: 0 24px;
        }

        .sa-new-btn svg {
          height: 17px;
          width: 17px;
        }

        .sa-hero-stat {
          align-items: center;
          align-self: center;
          background:
            radial-gradient(circle at 50% 50%, rgba(16, 45, 78, 0.8), rgba(4, 18, 36, 0.82) 68%),
            repeating-radial-gradient(circle at center, rgba(255, 122, 10, 0.28) 0 1px, transparent 1px 9px);
          border-radius: 999px;
          color: #fff;
          display: grid;
          gap: 2px;
          grid-column: 5;
          height: 106px;
          justify-items: center;
          place-content: center;
          position: relative;
          width: 106px;
        }

        .sa-hero-stat span {
          align-items: center;
          background: #ff7a0b;
          border-radius: 999px;
          color: #fff;
          display: inline-flex;
          height: 15px;
          justify-content: center;
          width: 15px;
        }

        .sa-hero-stat strong {
          color: #fff;
          font-size: 26px;
          font-weight: 950;
          line-height: 0.95;
        }

        .sa-hero-stat small {
          color: rgba(239, 247, 255, 0.86);
          font-size: 10px;
          font-weight: 850;
        }

        .sa-saved-panel {
          background:
            radial-gradient(480px 230px at 70% 0%, rgba(21, 88, 146, 0.24), transparent 70%),
            linear-gradient(135deg, rgba(8, 37, 64, 0.98), rgba(3, 18, 35, 0.99));
          border: 1px solid rgba(90, 149, 201, 0.5);
          border-radius: 18px;
          box-shadow: 0 22px 56px rgba(0, 6, 18, 0.34), inset 0 1px 0 rgba(255,255,255,0.07);
          padding: 21px 20px 27px;
        }

        .sa-saved-head {
          align-items: center;
          display: grid;
          gap: 16px;
          grid-template-columns: 68px minmax(0, 1fr) auto;
          margin-bottom: 18px;
          padding: 0 4px 0 2px;
        }

        .sa-saved-search {
          align-items: center;
          background: rgba(8, 36, 65, 0.88);
          border: 1px solid rgba(96, 155, 207, 0.28);
          border-radius: 13px;
          color: #a8c7ee;
          display: inline-flex;
          height: 54px;
          justify-content: center;
          width: 54px;
        }

        .sa-saved-head h2 {
          color: #fff;
          font-size: 20px;
          font-weight: 950;
          letter-spacing: 0;
          margin: 0 0 4px;
        }

        .sa-saved-head p {
          color: rgba(221, 235, 249, 0.78);
          font-size: 13px;
          font-weight: 650;
          margin: 0;
        }

        .sa-add-condition {
          align-items: center;
          cursor: pointer;
          display: inline-flex;
          font-size: 14px;
          font-weight: 900;
          gap: 9px;
          height: 42px;
          justify-content: center;
          padding: 0 22px;
          white-space: nowrap;
        }

        .sa-saved-workspace {
          display: grid;
          gap: 27px;
          grid-template-columns: 156px minmax(0, 1fr);
        }

        .sa-side-rail {
          align-items: center;
          align-self: start;
          background: rgba(5, 27, 51, 0.88);
          border: 1px solid rgba(90, 149, 201, 0.22);
          border-radius: 12px;
          display: grid;
          overflow: hidden;
          padding: 0;
          position: relative;
        }

        .sa-side-rail::before {
          background: linear-gradient(180deg, #ff8c1b, #ff6100);
          content: "";
          height: 48px;
          left: -21px;
          position: absolute;
          top: 4px;
          width: 22px;
        }

        .sa-side-rail button {
          align-items: center;
          background: transparent;
          border: 0;
          color: #7fb0e9;
          cursor: pointer;
          display: inline-flex;
          height: 52px;
          justify-content: center;
          width: 100%;
        }

        .sa-side-rail .sa-rail-create {
          gap: 8px;
          justify-content: flex-start;
          padding: 0 14px;
          text-align: left;
        }

        .sa-side-rail .sa-rail-create span {
          font-size: 12px;
          font-weight: 900;
          line-height: 1.05;
          white-space: normal;
        }

        .sa-side-rail button.is-active {
          background: linear-gradient(135deg, rgba(255, 138, 28, 0.9), rgba(82, 36, 38, 0.72));
          box-shadow: 0 10px 24px rgba(255, 95, 0, 0.22);
          color: #fff;
        }

        .sa-list {
          gap: 13px;
        }

        .sa-card {
          background:
            radial-gradient(420px 180px at 80% 12%, rgba(15, 75, 126, 0.24), transparent 74%),
            linear-gradient(135deg, rgba(6, 31, 56, 0.94), rgba(3, 18, 35, 0.96));
          border: 1px solid rgba(90, 149, 201, 0.42);
          border-radius: 18px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 1px auto;
          min-height: 151px;
          padding: 20px 13px 20px 25px;
        }

        .sa-card > .sa-card-icon {
          display: none;
        }

        .sa-card::before {
          background: rgba(111, 160, 205, 0.26);
          grid-column: 2;
          height: 124px;
          margin: 0;
        }

        .sa-card-body {
          background: transparent;
          border: 0;
          box-shadow: none;
          grid-column: 1;
          min-height: 0;
          padding: 0;
        }

        .sa-card-label {
          font-size: 22px;
          margin: 0 0 18px;
        }

        .sa-card-tags {
          gap: 9px;
          max-width: 390px;
        }

        .sa-tag {
          background: linear-gradient(180deg, rgba(30, 58, 88, 0.95), rgba(15, 36, 62, 0.98));
          border: 1px solid rgba(165, 205, 241, 0.32);
          font-size: 13px;
          padding: 7px 13px;
        }

        .sa-card-actions {
          gap: 18px;
          grid-column: 3;
          justify-content: end;
          min-width: 308px;
          padding-left: 8px;
        }

        .sa-search-btn {
          border-radius: 12px;
          font-size: 14px;
          height: 44px;
          min-width: 124px;
          padding: 0 16px;
        }

        .sa-search-btn svg {
          height: 18px;
          width: 18px;
        }

        .sa-edit-btn,
        .sa-delete-btn {
          background: rgba(10, 35, 61, 0.72);
          border: 1px solid rgba(123, 175, 220, 0.28);
          height: 45px;
          width: 45px;
        }

        .sa-edit-btn svg,
        .sa-delete-btn svg {
          height: 19px;
          width: 19px;
        }

        .sa-toggle {
          height: 26px;
          overflow: visible;
          position: relative;
          width: 43px;
        }

        .sa-toggle::after {
          bottom: -19px;
          color: rgba(235, 244, 252, 0.78);
          content: "Päällä";
          font-size: 10px;
          font-weight: 800;
          left: 50%;
          position: absolute;
          transform: translateX(-50%);
          white-space: nowrap;
        }

        .sa-toggle-off::after {
          content: "Pois";
        }

        .sa-toggle-knob {
          height: 22px;
          top: 2px;
          width: 22px;
        }

        .sa-toggle-on .sa-toggle-knob {
          left: 19px;
        }

        .sa-toggle-off .sa-toggle-knob {
          left: 2px;
        }

        .sa-form-card {
          border-radius: 18px;
          padding: 22px;
        }

        .sa-empty {
          min-height: 151px;
          padding: 26px;
        }

        @media (max-width: 920px) {
          .sa-layout {
            width: min(100% - 28px, 720px);
          }

          .sa-hero {
            grid-template-columns: auto minmax(0, 1fr);
            padding: 24px;
          }

          .sa-hero-stat,
          .sa-new-btn {
            grid-column: auto;
            grid-row: auto;
          }

          .sa-hero-stat {
            height: 88px;
            width: 88px;
          }

          .sa-new-btn {
            justify-self: start;
          }

          .sa-saved-head {
            grid-template-columns: 54px minmax(0, 1fr);
          }

          .sa-add-condition {
            grid-column: 1 / -1;
            justify-self: start;
          }

          .sa-saved-workspace {
            grid-template-columns: 1fr;
          }

          .sa-side-rail {
            display: flex;
            width: max-content;
          }

          .sa-card {
            grid-template-columns: 1fr;
          }

          .sa-card::before {
            display: none;
          }

          .sa-card-actions {
            grid-column: 1;
            justify-content: flex-start;
            min-width: 0;
            padding-left: 0;
          }
        }

        @media (max-width: 600px) {
          .sa-layout {
            width: 100%;
          }

          .sa-hero {
            grid-template-columns: 1fr;
            min-height: 0;
          }

          .sa-hero::after {
            left: 14px;
          }

          .sa-hero-icon {
            height: 66px;
            width: 66px;
          }

          .sa-hero h1 {
            font-size: 25px;
          }

          .sa-new-btn,
          .sa-add-condition {
            width: 100%;
          }

          .sa-saved-panel {
            padding: 18px 14px 22px;
          }

          .sa-saved-head {
            grid-template-columns: 1fr;
          }

          .sa-card {
            padding: 19px;
          }

          .sa-card-actions {
            gap: 12px;
          }
        }

        /* Final Finnish search-alert dashboard */
        body:has(.sa-page) {
          background: #020815;
        }

        .sa-page {
          background:
            radial-gradient(720px 360px at 70% -10%, rgba(255, 111, 0, 0.13), transparent 58%),
            radial-gradient(680px 360px at 58% 48%, rgba(15, 75, 125, 0.28), transparent 68%),
            linear-gradient(180deg, #020714 0%, #03101d 52%, #051524 100%);
          color: #f8fbff;
        }

        .sa-layout {
          width: min(952px, calc(100vw - 48px));
          gap: 16px;
          padding-top: 22px;
        }

        .sa-hero,
        .sa-saved-panel,
        .sa-form-card {
          border-radius: 18px;
          overflow: hidden;
        }

        .sa-hero {
          align-items: center;
          background:
            radial-gradient(260px 190px at 10% 46%, rgba(255, 114, 0, 0.16), transparent 66%),
            radial-gradient(540px 230px at 72% 0%, rgba(24, 85, 141, 0.28), transparent 72%),
            linear-gradient(135deg, rgba(8, 32, 58, 0.98), rgba(3, 17, 34, 0.99));
          border: 1px solid rgba(101, 153, 207, 0.46);
          box-shadow: 0 20px 54px rgba(0, 6, 18, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          display: grid;
          grid-template-columns: 132px minmax(0, 1fr) 1px minmax(310px, 390px);
          gap: 26px;
          min-height: 216px;
          padding: 30px 36px;
          position: relative;
        }

        .sa-hero::after {
          background:
            radial-gradient(circle, rgba(255, 120, 10, 0.24) 1px, transparent 2px),
            radial-gradient(circle at center, rgba(255, 120, 10, 0.22), transparent 56%);
          background-size: 14px 14px, auto;
          height: 160px;
          left: 26px;
          opacity: 0.62;
          top: 22px;
          width: 160px;
          z-index: 0;
        }

        .sa-hero::before {
          background: rgba(104, 151, 199, 0.24);
          grid-column: 3;
          height: 146px;
          width: 1px;
        }

        .sa-hero-icon {
          border-radius: 999px;
          height: 84px;
          justify-self: center;
          width: 84px;
          z-index: 1;
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
          font-size: 30px;
          letter-spacing: 0;
          margin-bottom: 10px;
        }

        .sa-hero p {
          color: rgba(216, 229, 243, 0.82);
          font-size: 15px;
          line-height: 1.45;
          max-width: 280px;
        }

        .sa-new-btn {
          align-self: end;
          border-radius: 8px;
          font-size: 14px;
          grid-column: 2;
          grid-row: 1;
          height: 43px;
          justify-self: start;
          margin-top: 96px;
          min-width: 163px;
          padding: 0 20px;
          z-index: 2;
        }

        .sa-hero-stats {
          display: grid;
          gap: 18px;
          grid-column: 4;
          grid-template-columns: 1fr 1fr;
          min-width: 0;
        }

        .sa-hero-stat {
          align-items: center;
          background:
            radial-gradient(160px 110px at 50% 0%, rgba(255, 119, 0, 0.13), transparent 68%),
            linear-gradient(180deg, rgba(8, 30, 55, 0.82), rgba(3, 16, 31, 0.88));
          border: 1px solid rgba(95, 147, 200, 0.33);
          border-radius: 14px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
          color: #fff;
          display: grid;
          gap: 6px;
          height: 155px;
          justify-items: center;
          padding: 16px 14px;
          place-content: center;
          position: relative;
          width: auto;
        }

        .sa-hero-stat span {
          align-items: center;
          background: transparent;
          border: 1px solid rgba(255, 128, 13, 0.78);
          border-radius: 999px;
          box-shadow: 0 0 22px rgba(255, 102, 0, 0.38), inset 0 0 18px rgba(255, 113, 0, 0.2);
          color: #ff8b1a;
          display: inline-flex;
          height: 58px;
          justify-content: center;
          width: 58px;
        }

        .sa-hero-stat small,
        .sa-hero-stat em {
          color: rgba(225, 235, 247, 0.82);
          font-size: 12px;
          font-style: normal;
          font-weight: 800;
          line-height: 1.1;
          text-align: center;
        }

        .sa-hero-stat strong {
          color: #fff;
          font-size: clamp(22px, 2.1vw, 25px);
          font-weight: 950;
          line-height: 1;
          max-width: 100%;
          overflow-wrap: anywhere;
          text-align: center;
        }

        .sa-saved-panel {
          background:
            radial-gradient(520px 230px at 74% 0%, rgba(255, 116, 0, 0.11), transparent 66%),
            radial-gradient(520px 260px at 62% 54%, rgba(17, 77, 128, 0.24), transparent 72%),
            linear-gradient(135deg, rgba(8, 31, 55, 0.98), rgba(4, 18, 34, 0.99));
          border-color: rgba(255, 111, 0, 0.46);
          box-shadow: 0 22px 58px rgba(0, 6, 18, 0.38), inset 0 1px 0 rgba(255,255,255,0.07);
          padding: 22px 26px 28px;
        }

        .sa-saved-head h2 {
          font-size: 22px;
        }

        .sa-saved-head p {
          color: rgba(214, 227, 241, 0.76);
          font-size: 13px;
        }

        .sa-saved-workspace {
          grid-template-columns: 258px minmax(0, 1fr);
          gap: 20px;
        }

        .sa-side-rail {
          border-radius: 12px;
        }

        .sa-side-rail button,
        .sa-side-rail .sa-rail-create,
        .sa-side-rail .sa-rail-settings {
          align-items: center;
          border-bottom: 1px solid rgba(112, 157, 204, 0.15);
          display: grid;
          gap: 16px;
          grid-template-columns: 56px minmax(0, 1fr) 16px;
          height: 82px;
          justify-content: initial;
          padding: 0 18px;
          text-align: left;
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
          color: #f8fbff;
          font-size: 14px;
          font-weight: 850;
          line-height: 1.2;
        }

        .sa-list,
        .sa-empty {
          min-height: 208px;
        }

        .sa-empty {
          background:
            radial-gradient(220px 100px at 50% 18%, rgba(255, 122, 10, 0.16), transparent 70%),
            radial-gradient(520px 180px at 60% 0%, rgba(18, 82, 128, 0.22), transparent 72%),
            linear-gradient(135deg, rgba(8, 31, 55, 0.88), rgba(4, 18, 34, 0.9));
          border: 1px solid rgba(91, 142, 194, 0.36);
          border-radius: 14px;
          padding: 34px 26px;
        }

        .sa-empty h3 {
          color: #fff;
          font-size: 22px;
          font-weight: 950;
        }

        .sa-empty p {
          color: rgba(216, 229, 243, 0.76);
          max-width: 470px;
        }

        .sa-empty-icon {
          border-radius: 999px;
          height: 78px;
          width: 78px;
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
          content: "Päällä";
        }

        .sa-toggle-off::after {
          content: "Pois";
        }

        .sa-card {
          border-radius: 14px;
        }

        .sa-card-body {
          border-radius: 12px;
        }

        .sa-card-label {
          overflow-wrap: anywhere;
          white-space: normal;
        }

        @media (max-width: 920px) {
          .sa-layout {
            width: min(100% - 28px, 720px);
          }

          .sa-hero {
            grid-template-columns: 86px minmax(0, 1fr);
            padding: 24px;
          }

          .sa-hero::before {
            display: none;
          }

          .sa-new-btn {
            grid-column: 1 / -1;
            margin-top: 0;
            width: 100%;
          }

          .sa-hero-stats {
            grid-column: 1 / -1;
          }

          .sa-saved-workspace {
            grid-template-columns: 1fr;
          }

          .sa-side-rail {
            display: grid;
            grid-template-columns: 1fr 1fr;
            width: 100%;
          }
        }

        @media (max-width: 600px) {
          .sa-layout {
            width: 100%;
            padding: 16px 14px 54px;
          }

          .sa-hero {
            grid-template-columns: 1fr;
            padding: 22px;
          }

          .sa-hero-icon {
            justify-self: start;
          }

          .sa-hero p {
            max-width: none;
          }

          .sa-hero-stats,
          .sa-side-rail {
            grid-template-columns: 1fr;
          }

          .sa-hero-stat {
            height: 132px;
          }

          .sa-saved-panel {
            padding: 18px 14px 22px;
          }

          .sa-saved-head {
            grid-template-columns: 54px minmax(0, 1fr);
          }

          .sa-add-condition {
            grid-column: 1 / -1;
          }
        }

        html body .sa-page.sa-page {
          background:
            radial-gradient(720px 360px at 70% -10%, rgba(255, 111, 0, 0.13), transparent 58%),
            radial-gradient(680px 360px at 58% 48%, rgba(15, 75, 125, 0.28), transparent 68%),
            linear-gradient(180deg, #020714 0%, #03101d 52%, #051524 100%);
        }

        .sa-hero-copy {
          grid-column: 2;
          min-width: 0;
          position: relative;
          z-index: 2;
        }

        .sa-hero.sa-hero {
          align-self: stretch;
          max-width: none;
          min-width: 100%;
          width: 100%;
        }

        .sa-hero-copy .sa-new-btn {
          display: inline-flex;
          grid-column: auto;
          grid-row: auto;
          justify-self: start;
          margin: 18px 0 0;
          width: auto;
        }

        .sa-hero-stats {
          align-items: stretch;
          grid-column: 4;
          grid-row: 1;
        }

        .sa-hero-stats .sa-hero-stat {
          grid-column: auto;
          grid-row: auto;
          height: 155px;
          min-width: 0;
          width: 100%;
        }

        @media (max-width: 920px) {
          .sa-hero-copy {
            grid-column: 2;
          }

          .sa-hero-stats {
            grid-column: 1 / -1;
            grid-row: auto;
          }
        }

        @media (max-width: 600px) {
          .sa-hero-copy {
            grid-column: 1;
          }
        }

        @media (max-width: 600px) {
          .sa-layout {
            box-sizing: border-box;
            padding: 16px 0 54px;
            width: calc(100vw - 28px);
          }

          .sa-hero.sa-hero {
            box-sizing: border-box;
            grid-template-columns: minmax(0, 1fr);
            min-width: 0;
            overflow: hidden;
            width: 100%;
          }

          .sa-hero-stats {
            grid-template-columns: minmax(0, 1fr);
            width: 100%;
          }

          .sa-hero-copy,
          .sa-hero-copy h1,
          .sa-hero-copy p {
            max-width: 100%;
            overflow-wrap: anywhere;
            white-space: normal;
          }

          .sa-hero-copy .sa-new-btn {
            max-width: 100%;
            min-width: 0;
          }
        }

        @media (max-width: 920px) {
          .sa-layout {
            box-sizing: border-box;
            overflow-x: hidden;
            width: min(720px, calc(100vw - 28px));
          }

          .sa-hero.sa-hero {
            box-sizing: border-box;
            grid-template-columns: minmax(0, 1fr);
            min-width: 0;
            overflow: hidden;
          }

          .sa-hero-copy {
            grid-column: 1;
          }

          .sa-hero-copy p {
            max-width: 100%;
            overflow-wrap: anywhere;
            white-space: normal;
          }

          .sa-hero-stats {
            grid-column: 1;
            grid-template-columns: minmax(0, 1fr);
            width: 100%;
          }
        }

        /* Exact compact reference pass */
        html body .sa-page.sa-page {
          background:
            radial-gradient(520px 260px at 50% -80px, rgba(15, 64, 112, 0.28), transparent 72%),
            radial-gradient(420px 280px at 60% 45%, rgba(13, 57, 98, 0.22), transparent 70%),
            linear-gradient(180deg, #020817 0%, #03101f 100%);
          min-height: calc(100vh - var(--topbar-h, 56px));
          padding-bottom: 34px;
        }

        .sa-layout.sa-layout {
          box-sizing: border-box;
          gap: 14px;
          padding-top: 6px;
          width: min(674px, calc(100vw - 70px));
        }

        .sa-hero.sa-hero {
          background:
            radial-gradient(180px 140px at 11% 50%, rgba(255, 126, 10, 0.14), transparent 68%),
            linear-gradient(135deg, rgba(9, 37, 72, 0.96), rgba(5, 22, 47, 0.98));
          border: 1px solid rgba(66, 111, 166, 0.36);
          border-radius: 16px;
          box-shadow: 0 18px 48px rgba(0, 6, 18, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          display: grid;
          gap: 20px;
          grid-template-columns: 126px minmax(0, 1fr) 1px 228px;
          min-height: 160px;
          min-width: 0;
          padding: 26px 26px 24px;
          width: 100%;
        }

        .sa-hero::before {
          background: rgba(101, 144, 190, 0.2);
          display: block;
          grid-column: 3;
          height: 108px;
          width: 1px;
        }

        .sa-hero::after {
          background:
            radial-gradient(circle, rgba(255, 123, 12, 0.32) 1px, transparent 1.8px),
            radial-gradient(circle at center, rgba(255, 120, 10, 0.18), transparent 64%);
          background-size: 13px 13px, auto;
          height: 118px;
          left: 38px;
          opacity: 0.72;
          top: 22px;
          width: 118px;
        }

        .sa-hero-icon.sa-hero-icon {
          border-radius: 999px;
          height: 76px;
          justify-self: center;
          width: 76px;
        }

        .sa-hero-icon::before {
          height: 108px;
          width: 108px;
        }

        .sa-hero-copy {
          align-self: center;
          grid-column: 2;
        }

        .sa-hero h1 {
          font-size: 20px;
          line-height: 1.1;
          margin: 0 0 6px;
        }

        .sa-hero p {
          color: rgba(223, 233, 246, 0.78);
          font-size: 12px;
          font-weight: 700;
          line-height: 1.35;
          max-width: 220px;
        }

        .sa-hero-copy .sa-new-btn {
          border-radius: 6px;
          font-size: 11px;
          gap: 7px;
          height: 30px;
          margin-top: 12px;
          min-width: 105px;
          padding: 0 13px;
        }

        .sa-hero-copy .sa-new-btn svg {
          height: 13px;
          width: 13px;
        }

        .sa-hero-stats {
          align-self: center;
          display: grid;
          gap: 14px;
          grid-column: 4;
          grid-template-columns: 1fr 1fr;
        }

        .sa-hero-stats .sa-hero-stat {
          background:
            radial-gradient(120px 90px at 50% 0%, rgba(255, 118, 0, 0.1), transparent 68%),
            linear-gradient(180deg, rgba(8, 34, 66, 0.72), rgba(4, 18, 38, 0.84));
          border: 1px solid rgba(77, 126, 180, 0.34);
          border-radius: 9px;
          height: 92px;
          padding: 8px;
        }

        .sa-hero-stats .sa-hero-stat span {
          height: 36px;
          width: 36px;
        }

        .sa-hero-stats .sa-hero-stat span svg {
          height: 15px;
          width: 15px;
        }

        .sa-hero-stats .sa-hero-stat small,
        .sa-hero-stats .sa-hero-stat em {
          color: rgba(214, 226, 241, 0.74);
          font-size: 9px;
          font-weight: 750;
        }

        .sa-hero-stats .sa-hero-stat strong {
          font-size: 19px;
        }

        .sa-saved-panel.sa-saved-panel {
          background: linear-gradient(135deg, rgba(7, 31, 61, 0.9), rgba(4, 19, 40, 0.96));
          border: 1px solid rgba(54, 99, 154, 0.28);
          border-radius: 13px;
          box-shadow: 0 18px 46px rgba(0, 6, 18, 0.35), inset 0 1px 0 rgba(255,255,255,0.04);
          min-height: 242px;
          padding: 18px 18px 15px;
        }

        .sa-saved-head {
          display: block;
          margin: 0 0 12px;
          padding: 0;
        }

        .sa-saved-search,
        .sa-add-condition {
          display: none;
        }

        .sa-saved-head h2 {
          font-size: 13px;
          line-height: 1.1;
          margin: 0;
        }

        .sa-saved-head p {
          display: none;
        }

        .sa-saved-workspace {
          display: grid;
          gap: 13px;
          grid-template-columns: 134px minmax(0, 1fr);
        }

        .sa-side-rail {
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          display: grid;
          gap: 8px;
          overflow: visible;
          padding: 0 13px 0 0;
          position: relative;
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
          display: none;
        }

        .sa-side-rail button,
        .sa-side-rail .sa-rail-create,
        .sa-side-rail .sa-rail-settings {
          background: transparent;
          border: 0;
          border-radius: 7px;
          box-shadow: none;
          color: rgba(219, 232, 246, 0.82);
          display: grid;
          gap: 10px;
          grid-template-columns: 20px minmax(0, 1fr);
          height: 33px;
          padding: 0 12px;
        }

        .sa-side-rail button.is-active {
          background: rgba(255, 112, 0, 0.09);
          border: 1px solid rgba(255, 122, 11, 0.62);
          box-shadow: inset 3px 0 0 #ff7a0b, 0 0 18px rgba(255, 107, 0, 0.12);
        }

        .sa-side-rail button::after {
          content: none;
        }

        .sa-side-rail button svg {
          background: transparent;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          color: #ff7a0b;
          height: 16px;
          padding: 0;
          width: 16px;
        }

        .sa-side-rail button:not(.is-active) svg {
          color: #9ab5d1;
        }

        .sa-side-rail button span {
          color: inherit;
          font-size: 10px;
          font-weight: 850;
        }

        .sa-list {
          min-height: 213px;
        }

        .sa-empty {
          background:
            radial-gradient(190px 120px at 50% 12%, rgba(255, 116, 0, 0.1), transparent 72%),
            linear-gradient(135deg, rgba(4, 20, 42, 0.98), rgba(2, 12, 28, 0.99));
          border: 1px solid rgba(255, 122, 11, 0.82);
          border-radius: 9px;
          box-shadow:
            0 0 0 1px rgba(255, 122, 11, 0.08),
            0 18px 42px rgba(0, 6, 18, 0.28),
            inset 0 1px 0 rgba(255, 173, 84, 0.12);
          gap: 7px;
          min-height: 213px;
          padding: 28px 20px;
        }

        .sa-list .sa-empty.sa-empty {
          background:
            radial-gradient(190px 120px at 50% 12%, rgba(255, 116, 0, 0.1), transparent 72%),
            linear-gradient(135deg, #04162d 0%, #020c1c 100%);
          border-color: rgba(255, 122, 11, 0.86);
        }

        .sa-empty-icon {
          background: rgba(255, 112, 0, 0.1);
          border: 1px solid rgba(255, 122, 11, 0.42);
          box-shadow: 0 0 28px rgba(255, 107, 0, 0.13);
          color: #ff8a18;
          height: 64px;
          opacity: 0.9;
          width: 64px;
        }

        .sa-empty h3 {
          font-size: 16px;
          margin-top: 2px;
        }

        .sa-empty p {
          color: rgba(207, 221, 237, 0.72);
          font-size: 10px;
          line-height: 1.35;
          max-width: 260px;
        }

        .sa-empty::after {
          content: none;
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
            width: min(674px, calc(100vw - 24px));
          }

          .sa-hero.sa-hero {
            grid-template-columns: 86px minmax(0, 1fr);
            gap: 16px;
            padding: 22px;
          }

          .sa-hero::before {
            display: none;
          }

          .sa-hero-icon.sa-hero-icon {
            height: 68px;
            width: 68px;
          }

          .sa-hero-copy {
            grid-column: 2;
          }

          .sa-hero-stats {
            grid-column: 1 / -1;
            grid-template-columns: 1fr 1fr;
          }

          .sa-saved-workspace {
            grid-template-columns: 1fr;
          }

          .sa-side-rail {
            grid-template-columns: 1fr 1fr 1fr;
            padding: 0;
          }

          .sa-side-rail::after {
            display: none;
          }
        }

        @media (min-width: 641px) and (max-width: 920px) {
          .sa-saved-workspace {
            grid-template-columns: 134px minmax(0, 1fr);
          }

          .sa-side-rail {
            display: grid;
            grid-template-columns: 1fr;
            padding: 0 13px 0 0;
            width: auto;
          }

          .sa-side-rail::after {
            display: block;
          }
        }

        @media (max-width: 460px) {
          .sa-hero.sa-hero {
            grid-template-columns: 1fr;
          }

          .sa-hero-copy {
            grid-column: 1;
          }

          .sa-hero-stats,
          .sa-side-rail {
            grid-template-columns: 1fr;
          }
        }

        /* Search alert polish pass: roomier desktop layout and non-overlapping stat cards. */
        .sa-layout.sa-layout {
          gap: 28px;
          padding-top: 22px;
          width: min(860px, calc(100vw - 96px));
        }

        .sa-hero.sa-hero {
          border-color: rgba(93, 145, 199, 0.42);
          border-radius: 18px;
          gap: 30px;
          grid-template-columns: 126px minmax(0, 1fr) 1px minmax(310px, 340px);
          min-height: 188px;
          padding: 28px 34px;
        }

        .sa-hero::after {
          left: 42px;
          top: 28px;
        }

        .sa-hero-icon.sa-hero-icon {
          height: 84px;
          width: 84px;
        }

        .sa-hero-icon::before {
          height: 118px;
          width: 118px;
        }

        .sa-hero h1 {
          font-size: 25px;
          line-height: 1.08;
        }

        .sa-hero p {
          font-size: 13px;
          max-width: 270px;
        }

        .sa-hero-copy .sa-new-btn {
          font-size: 12px;
          height: 38px;
          min-width: 148px;
          padding: 0 17px;
        }

        .sa-hero-stats {
          gap: 16px;
          min-width: 0;
        }

        .sa-hero-stats .sa-hero-stat {
          align-content: start;
          display: grid;
          gap: 9px;
          grid-template-rows: 44px 14px 30px 14px;
          height: 146px;
          justify-items: center;
          overflow: visible;
          padding: 14px 12px 13px;
          place-content: initial;
        }

        .sa-hero-stats .sa-hero-stat span {
          align-self: center;
          height: 44px;
          width: 44px;
        }

        .sa-hero-stats .sa-hero-stat span svg {
          height: 17px;
          width: 17px;
        }

        .sa-hero-stats .sa-hero-stat small,
        .sa-hero-stats .sa-hero-stat em {
          display: block;
          font-size: 9.5px;
          line-height: 1;
          max-width: 100%;
          overflow: visible;
          text-overflow: clip;
          white-space: nowrap;
        }

        .sa-hero-stats .sa-hero-stat small {
          color: rgba(214, 226, 241, 0.7);
          text-transform: none;
        }

        .sa-hero-stats .sa-hero-stat em {
          color: rgba(214, 226, 241, 0.62);
          font-weight: 800;
        }

        .sa-hero-stats .sa-hero-stat strong {
          align-self: center;
          align-items: center;
          background: rgba(255, 255, 255, 0.055);
          border: 1px solid rgba(255, 139, 26, 0.24);
          border-radius: 999px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          color: #ffffff;
          display: inline-flex;
          font-size: 18px;
          font-weight: 950;
          height: 30px;
          justify-content: center;
          letter-spacing: 0;
          line-height: 1;
          max-width: 100%;
          min-width: 0;
          overflow-wrap: normal;
          padding: 0 12px;
          text-shadow: none;
          white-space: nowrap;
        }

        .sa-saved-panel.sa-saved-panel {
          border-color: rgba(68, 119, 174, 0.38);
          border-radius: 16px;
          min-height: 306px;
          padding: 24px 24px 22px;
        }

        .sa-saved-head h2 {
          font-size: 16px;
        }

        .sa-saved-workspace {
          gap: 20px;
          grid-template-columns: 150px minmax(0, 1fr);
        }

        .sa-side-rail {
          gap: 12px;
          padding-right: 18px;
        }

        .sa-side-rail::after {
          height: 100%;
        }

        .sa-side-rail button,
        .sa-side-rail .sa-rail-create,
        .sa-side-rail .sa-rail-settings {
          gap: 11px;
          grid-template-columns: 18px minmax(0, 1fr);
          height: 40px;
          padding: 0 14px;
        }

        .sa-side-rail button svg {
          height: 17px;
          width: 17px;
        }

        .sa-side-rail button span {
          font-size: 11.5px;
          line-height: 1.1;
        }

        .sa-list,
        .sa-empty {
          min-height: 252px;
        }

        .sa-empty {
          gap: 12px;
          padding: 34px 28px;
        }

        .sa-empty h3 {
          font-size: 20px;
        }

        .sa-empty p {
          font-size: 12px;
          max-width: 360px;
        }

        .sa-empty-btn {
          font-size: 12px;
          height: 34px;
          padding: 0 20px;
        }

        @media (max-width: 820px) {
          .sa-layout.sa-layout {
            width: min(100% - 28px, 680px);
          }

          .sa-hero.sa-hero {
            grid-template-columns: 88px minmax(0, 1fr);
          }

          .sa-hero-stats {
            grid-column: 1 / -1;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sa-saved-workspace {
            grid-template-columns: 1fr;
          }

          .sa-side-rail {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            padding-right: 0;
          }

          .sa-side-rail::after {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .sa-layout.sa-layout {
            width: calc(100vw - 24px);
          }

          .sa-hero.sa-hero {
            grid-template-columns: 1fr;
          }

          .sa-hero-copy,
          .sa-hero-stats {
            grid-column: 1;
          }

          .sa-hero p {
            max-width: none;
          }

          .sa-hero-stats,
          .sa-side-rail {
            grid-template-columns: 1fr;
          }
        }

        /* Follow the admin appearance base/background color. Keep this last so it wins old page gradients. */
        body:has(.sa-page),
        html body:has(.sa-page) {
          background: var(--site-bg, var(--bg, #0b1118));
          background-image: none;
        }

        html body .sa-page.sa-page {
          background: var(--site-bg, var(--bg, #0b1118));
          background-image: none;
        }
      `}</style>

    </main>
  );
}
