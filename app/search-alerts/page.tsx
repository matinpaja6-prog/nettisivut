"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BellOff,
  BellPlus,
  Check,
  Pencil,
  Search,
  Trash2,
  X
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
import { categories, type Category } from "@/lib/listings";
import { useLanguage } from "@/lib/i18n";

const VEHICLE_TYPES = ["Moottorikelkka", "Mönkijä", "Auto", "Mopo"];

const VEHICLE_BRANDS: Record<string, string[]> = {
  Moottorikelkka: ["Arctic Cat", "Lynx", "Polaris", "Ski-Doo", "Yamaha"],
  Mönkijä:        ["Can-Am", "CFMOTO", "Honda", "Kawasaki", "Polaris", "Yamaha"],
  Auto:           ["Audi", "BMW", "Ford", "Mercedes-Benz", "Toyota", "Volkswagen", "Volvo"],
  Mopo:           ["Aprilia", "Derbi", "Honda", "Husqvarna", "KTM", "Rieju", "Yamaha"]
};

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

export default function SearchAlertsPage() {
  const { t } = useLanguage();
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
    if (!userId) return;
    setLoading(true);
    const [alertsRes, notifsRes] = await Promise.all([
      getSearchAlerts(userId),
      getAlertNotifications(userId)
    ]);
    setAlerts(alertsRes.data);
    setNotifications(notifsRes.data);
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
        <Link href="/" className="sa-back">
          <ArrowLeft size={15} />
          {t.saHome}
        </Link>
      </header>

      <div className="sa-layout">

        {/* Page header */}
        <div className="sa-hero">
          <div className="sa-hero-icon"><Bell size={26} /></div>
          <div>
            <h1>{t.saTitle}</h1>
            <p>
              {t.saSubtitle}
              {activeCount > 0 && <strong> {activeCount} {t.saActive}.</strong>}
            </p>
          </div>
          <button
            className={`sa-new-btn${showForm ? " sa-new-btn-cancel" : ""}`}
            onClick={() => { setShowForm(v => !v); setError(""); }}
          >
            {showForm ? <X size={16} /> : <BellPlus size={16} />}
            {showForm ? t.saCancel : t.saNew}
          </button>
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
                  {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="sa-field">
                <label>{t.saCategory}</label>
                <select
                  value={form.category}
                  onChange={e => { setForm({ ...form, category: e.target.value, subcategory: "" }); setError(""); }}
                >
                  <option value="">{t.saAllCategories}</option>
                  {Object.keys(categories)
                    .filter(k => k !== "Kaikki")
                    .map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              {form.category && (categories[form.category as Category] as readonly string[]).length > 0 && (
                <div className="sa-field">
                  <label>Alakategoria</label>
                  <select
                    value={form.subcategory}
                    onChange={e => updateFormField("subcategory", e.target.value)}
                  >
                    <option value="">Kaikki</option>
                    {(categories[form.category as Category] as readonly string[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="sa-field">
                <label>{t.saBrand}</label>
                {form.vehicle_type && VEHICLE_BRANDS[form.vehicle_type] ? (
                  <select
                    value={form.brand}
                    onChange={e => updateFormField("brand", e.target.value)}
                  >
                    <option value="">{t.saAllClasses.replace("luokat", "merkit").replace("klasser", "märken").replace("classes", "brands").replace("klasser", "merker")}</option>
                    {VEHICLE_BRANDS[form.vehicle_type].map(b => <option key={b} value={b}>{b}</option>)}
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
        <div className="sa-list">
          {loading ? (
            <div className="sa-empty">
              <div className="sa-empty-icon"><Bell size={32} /></div>
              <p>Ladataan...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="sa-empty">
              <div className="sa-empty-icon"><BellOff size={36} /></div>
              <h3>{t.saEmpty}</h3>
              <p>{t.saEmptyDesc}</p>
            </div>
          ) : (
            alerts.map(alert => (
              <div key={alert.id} className={`sa-card${alert.is_active ? "" : " sa-card-off"}${notifsForAlert(alert.id).length > 0 ? " sa-card-has-notif" : ""}`}>
                <div className="sa-card-icon">
                  {alert.is_active ? <Bell size={18} /> : <BellOff size={18} />}
                </div>
                <div className="sa-card-body">
                  <div className="sa-card-label">{alert.label}</div>
                  <div className="sa-card-tags">
                    {alert.vehicle_type && <span className="sa-tag sa-tag-blue">{alert.vehicle_type}</span>}
                    {alert.brand && <span className="sa-tag sa-tag-blue">{alert.brand}</span>}
                    {alert.category && <span className="sa-tag sa-tag-purple">{alert.category}</span>}
                    {alert.subcategory && <span className="sa-tag sa-tag-purple">{alert.subcategory}</span>}
                    {alert.condition && <span className="sa-tag sa-tag-purple">{alert.condition}</span>}
                    {(alert.year_min || alert.year_max) && (
                      <span className="sa-tag sa-tag-gray">
                        {alert.year_min && alert.year_max
                          ? `${alert.year_min}–${alert.year_max}`
                          : alert.year_min ? `alkaen ${alert.year_min}` : `asti ${alert.year_max}`}
                      </span>
                    )}
                    {alert.query && <span className="sa-tag sa-tag-gray">🔍 {alert.query}</span>}
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
                          {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </div>
                      <div className="sa-field">
                        <label>{t.saCategory}</label>
                        <select value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value, subcategory: ""})}>
                          <option value="">{t.saAllCategories}</option>
                          {Object.keys(categories).filter(k => k !== "Kaikki").map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      {editForm.category && (categories[editForm.category as Category] as readonly string[]).length > 0 && (
                        <div className="sa-field">
                          <label>Alakategoria</label>
                          <select value={editForm.subcategory} onChange={e => setEditForm({...editForm, subcategory: e.target.value})}>
                            <option value="">Kaikki</option>
                            {(categories[editForm.category as Category] as readonly string[]).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="sa-field">
                        <label>{t.saBrand}</label>
                        {editForm.vehicle_type && VEHICLE_BRANDS[editForm.vehicle_type] ? (
                          <select
                            value={editForm.brand}
                            onChange={e => setEditForm({...editForm, brand: e.target.value})}
                          >
                            <option value="">— Kaikki merkit —</option>
                            {VEHICLE_BRANDS[editForm.vehicle_type].map(b => <option key={b} value={b}>{b}</option>)}
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
            ))
          )}
        </div>

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
          background: #1d4ed8;
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
        .sa-hero p strong { color: #1d4ed8; }
        .sa-new-btn {
          margin-left: auto;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 7px;
          height: 40px;
          padding: 0 18px;
          background: #1d4ed8;
          color: white;
          border: none;
          border-radius: 11px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .sa-new-btn:hover { background: #1e40af; }
        .sa-new-btn-cancel { background: #64748b; }
        .sa-new-btn-cancel:hover { background: #475569; }

        /* Form card */
        .sa-form-card {
          background: white;
          border: 1.5px solid #3b82f6;
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
          border-color: #3b82f6;
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
          background: #1d4ed8;
          color: white;
          border: none;
          border-radius: 11px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }
        .sa-save-btn:hover { background: #1e40af; }
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
          background: #eff6ff;
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
        .sa-tag-blue { background: #dbeafe; color: #1d4ed8; }
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
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          color: #1d4ed8;
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
        .sa-card-has-notif .sa-card-icon { background: #dbeafe; color: #1d4ed8; }
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
          color: #3b82f6;
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
          color: #1d4ed8;
        }
        /* Make card layout full-width when it has notifications */
        .sa-card-has-notif { flex-wrap: wrap; }
        .sa-card-has-notif .sa-card-body { flex: 1; }
        .sa-card-has-notif .sa-notif-list { width: 100%; }

        @media (max-width: 600px) {
          .sa-form-grid { grid-template-columns: 1fr; }
          .sa-hero { flex-wrap: wrap; }
          .sa-new-btn { margin-left: 0; width: 100%; justify-content: center; }
          .sa-topbar { padding: 0 16px; }
          .sa-layout { padding: 20px 16px 40px; }
        }
      `}</style>

    </main>
  );
}
