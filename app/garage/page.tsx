"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Car,
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  MapPin,
  Plus,
  Trash2,
  Wrench,
  X
} from "lucide-react";

import {
  addGarageVehicle,
  deleteGarageVehicle,
  getGarageVehicles,
  getListingsByVehicle,
  supabase,
  type GarageVehicle
} from "@/lib/supabase";

import { formatPrice, type Listing } from "@/lib/listings";
import { getLocalizedListingText } from "@/lib/listing-translations";
import { useLanguage, translateCategory } from "@/lib/i18n";

type VehicleClass = "Moottorikelkka" | "Mönkijä" | "Motocross" | "Mopo";

const vehicleClasses: VehicleClass[] = ["Moottorikelkka", "Mönkijä", "Motocross", "Mopo"];
const otherMakeValue = "__other_make__";

const classBrands: Record<VehicleClass, string[]> = {
  Moottorikelkka: ["Lynx", "Ski-Doo", "Polaris", "Arctic Cat", "Yamaha"],
  Mönkijä: ["Can-Am", "Polaris", "Yamaha", "Honda", "CFMOTO", "Kawasaki"],
  Motocross: ["KTM", "Yamaha", "Honda", "Kawasaki", "Husqvarna", "Suzuki", "GasGas", "Beta", "Sherco", "TM"],
  Mopo: ["Yamaha", "Honda", "Derbi", "Rieju", "KTM", "Aprilia", "Husqvarna"]
};

const classModelPlaceholders: Record<VehicleClass, string> = {
  Moottorikelkka: "esim. RMK 800 / 600 ACE",
  Mönkijä: "esim. Outlander 650",
  Motocross: "esim. SX 125 / CRF 250 / YZ 450",
  Mopo: "esim. DT 50 / SX 50"
};

const classIcons: Record<VehicleClass, string> = {
  Moottorikelkka: "🏔️",
  Mönkijä: "🏕️",
  Motocross: "🏍️",
  Mopo: "🛵"
};

const VEHICLE_PHOTOS: Record<VehicleClass, string> = {
  Moottorikelkka: "/vehicles/moottorikelkka.png",
  "Mönkijä": "/vehicles/monkija.png",
  Motocross: "/vehicles/motocross.png",
  Mopo: "/vehicles/mopot.png",
};

function normalizeVehicleClass(value?: string | null): VehicleClass | "" {
  if (value === "Auto") return "Motocross";
  return vehicleClasses.includes(value as VehicleClass) ? (value as VehicleClass) : "";
}

export default function GaragePage() {
  const { t, locale } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<"class" | "details">("class");
  const [form, setForm] = useState({
    vehicle_class: "" as VehicleClass | "",
    make: "",
    makeOther: "",
    model: "",
    year: new Date().getFullYear(),
    nickname: ""
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [selectedVehicle, setSelectedVehicle] =
    useState<GarageVehicle | null>(null);
  const [vehicleListings, setVehicleListings] =
    useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] =
    useState(false);
  const classLabels: Record<VehicleClass, string> = {
    Moottorikelkka: t.garageSnowmobile,
    Mönkijä: t.garageAtv,
    Motocross: t.garageCar,
    Mopo: t.garageMoped
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    getGarageVehicles(user.id).then(({ data }) => {
      setVehicles(data ?? []);
    });
  }, [user]);

  async function handleAdd() {
    if (!user) return;
    const make = form.make === otherMakeValue ? form.makeOther.trim() : form.make.trim();
    if (!make || !form.model.trim()) {
      setFormError(t.garageErrorRequired);
      return;
    }
    if (form.year < 1900 || form.year > new Date().getFullYear() + 1) {
      setFormError(t.garageErrorYear);
      return;
    }
    setSaving(true);
    setFormError("");
    const { data, error } = await addGarageVehicle({
      user_id: user.id,
      vehicle_class: form.vehicle_class || null,
      make,
      model: form.model.trim(),
      year: form.year,
      nickname: form.nickname.trim() || null
    });
    setSaving(false);
    if (error || !data) {
      setFormError(t.garageSaveFailed);
      return;
    }
    setVehicles((prev) => [data, ...prev]);
    setForm({ vehicle_class: "", make: "", makeOther: "", model: "", year: new Date().getFullYear(), nickname: "" });
    setFormStep("class");
    setShowForm(false);
  }

  async function handleDelete(vehicleId: string) {
    if (!confirm(t.garageConfirmDelete)) return;
    await deleteGarageVehicle(vehicleId);
    setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    if (selectedVehicle?.id === vehicleId) {
      setSelectedVehicle(null);
      setVehicleListings([]);
    }
  }

  async function handleSelectVehicle(vehicle: GarageVehicle) {
    if (selectedVehicle?.id === vehicle.id) {
      setSelectedVehicle(null);
      setVehicleListings([]);
      return;
    }
    setSelectedVehicle(vehicle);
    setListingsLoading(true);
    const { data } = await getListingsByVehicle(vehicle.make, vehicle.model);
    setVehicleListings(data ?? []);
    setListingsLoading(false);
  }

  if (loading) {
    return (
      <main className="garage-page">
        <div className="garage-loading">{t.garageLoadingParts}</div>
      </main>
    );
  }

  return (
    <main className="garage-page">

      <header className="garage-topbar">
        <Link href="/" className="garage-back">
          <ArrowLeft size={16} />
          {t.garageHome}
        </Link>
        <img
          className="arctic-topbar-logo"
          src="/arctic-parts-logo.jpg"
          alt="Arctic Parts"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      </header>

      <div className="garage-container">

        <div className="garage-heading">
          <div className="garage-heading-icon"><Wrench size={28} /></div>
          <div>
            <h1>{t.garageTitle}</h1>
            <p>{t.garageSubtitle}</p>
          </div>
          <div className="garage-heading-stats" aria-label={t.garageTitle}>
            <span>{vehicles.length}</span>
            <small>{t.garageVehiclesCount}</small>
          </div>
        </div>

        {!user ? (
          <div className="garage-login-prompt">
            <LockKeyhole size={24} />
            <span>{t.garageLoginPrompt}</span>
            <Link href="/auth" className="garage-login-btn">{t.login}</Link>
          </div>
        ) : (
          <>
            <div className="garage-toolbar">
              <div className="garage-toolbar-copy">
                <strong>{t.garageVehiclesTitle}</strong>
                <span>{t.garageVehiclesDesc}</span>
              </div>
              <button
                className="garage-add-btn"
                onClick={() => { setShowForm(!showForm); setFormError(""); setFormStep("class"); }}
              >
                {showForm ? <X size={16} /> : <Plus size={16} />}
                {showForm ? t.garageCancel : t.garageAddVehicle}
              </button>
            </div>

            {showForm && (
              <div className="garage-form">
                <h3>{t.garageNewVehicle}</h3>

                {formStep === "class" ? (
                  <>
                    <p className="garage-form-hint">{t.garageSelectClass}</p>
                    <div className="garage-class-grid">
                      {vehicleClasses.map((cls) => {
                        return (
                          <button
                            key={cls}
                            type="button"
                            className="garage-class-btn"
                            onClick={() => {
                              setForm({ ...form, vehicle_class: cls, make: "", makeOther: "", model: "" });
                              setFormStep("details");
                            }}
                          >
                            <span className="garage-class-icon">
                              <img
                                src={VEHICLE_PHOTOS[cls]}
                                alt={classIcons[cls]}
                                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "15px", display: "block" }}
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              />
                            </span>
                            <span>{classLabels[cls]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="garage-back-step"
                      onClick={() => setFormStep("class")}
                    >
                      ← {t.garageSelectClass}
                    </button>
                    <div className="garage-selected-class">
                      <span>{classIcons[form.vehicle_class as VehicleClass]}</span>
                      <strong>{classLabels[form.vehicle_class as VehicleClass]}</strong>
                    </div>
                    <div className="garage-form-grid">
                      <div className="garage-field">
                        <label>{t.garageMake} *</label>
                        <select
                          value={form.make}
                          onChange={(e) => setForm({
                            ...form,
                            make: e.target.value,
                            makeOther: e.target.value === otherMakeValue ? form.makeOther : ""
                          })}
                        >
                          <option value="">—</option>
                          {form.vehicle_class && classBrands[form.vehicle_class as VehicleClass].map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                          <option value={otherMakeValue}>{t.garageMakeOther}</option>
                        </select>
                        {form.make === otherMakeValue && (
                          <input
                            className="garage-custom-make-input"
                            value={form.makeOther}
                            onChange={(e) => setForm({ ...form, makeOther: e.target.value })}
                            placeholder={t.garageMakeOtherPlaceholder}
                            autoFocus
                          />
                        )}
                      </div>
                      <div className="garage-field">
                        <label>{t.garageModel} *</label>
                        <input
                          value={form.model}
                          onChange={(e) => setForm({ ...form, model: e.target.value })}
                          placeholder={form.vehicle_class ? classModelPlaceholders[form.vehicle_class as VehicleClass] : ""}
                        />
                      </div>
                      <div className="garage-field">
                        <label>{t.garageYear} *</label>
                        <input
                          type="number"
                          value={form.year}
                          onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                          min={1970}
                          max={new Date().getFullYear() + 1}
                        />
                      </div>
                      <div className="garage-field">
                        <label>{t.garageNickname}</label>
                        <input
                          value={form.nickname}
                          onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                          placeholder={t.garageNicknamePlaceholder}
                        />
                      </div>
                    </div>
                    {formError && (
                      <p className="garage-form-error">{formError}</p>
                    )}
                    <button
                      className="garage-save-btn"
                      onClick={handleAdd}
                      disabled={saving}
                    >
                      {saving ? t.garageSaving : t.garageSave}
                    </button>
                  </>
                )}
              </div>
            )}

            {vehicles.length === 0 && !showForm && (
              <div className="garage-empty">
                <Wrench size={48} />
                <p>{t.garageEmpty}</p>
              </div>
            )}

            <div className="garage-vehicles">
              {vehicles.map((vehicle) => {
                const isSelected = selectedVehicle?.id === vehicle.id;
                const vehicleClass = normalizeVehicleClass(vehicle.vehicle_class);
                return (
                  <div key={vehicle.id} className="garage-vehicle-wrap">
                    <div
                      className={`garage-vehicle-card ${isSelected ? "selected" : ""}`}
                    >
                      <div
                        className="garage-vehicle-info"
                        onClick={() => handleSelectVehicle(vehicle)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && handleSelectVehicle(vehicle)}
                      >
                        <div className="garage-vehicle-icon">
                          {vehicleClass ? (
                            <img
                              src={VEHICLE_PHOTOS[vehicleClass]}
                              alt={classIcons[vehicleClass]}
                              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "17px", display: "block" }}
                              onError={e => { (e.currentTarget as HTMLImageElement).replaceWith(
                                Object.assign(document.createElement("span"), { textContent: classIcons[vehicleClass], style: "font-size:28px;line-height:1" })
                              ); }}
                            />
                          ) : (
                            <Car size={22} />
                          )}
                        </div>
                        <div className="garage-vehicle-details">
                          <span className="garage-vehicle-type">
                            {vehicleClass ? `${classIcons[vehicleClass]} ${classLabels[vehicleClass]}` : t.garageDefaultVehicle}
                          </span>
                          {vehicle.nickname && (
                            <span className="garage-vehicle-nickname">
                              {vehicle.nickname}
                            </span>
                          )}
                          <strong className="garage-vehicle-name">
                            {vehicle.make} {vehicle.model}
                          </strong>
                          <div className="garage-vehicle-meta">
                            <span className="garage-vehicle-year">{vehicle.year}</span>
                            <span className="garage-vehicle-class-tag">
                              {t.garageShowParts}
                            </span>
                          </div>
                        </div>
                        <div className="garage-vehicle-arrow">
                          {isSelected
                            ? <ChevronDown size={18} />
                            : <ChevronRight size={18} />}
                        </div>
                      </div>
                      <button
                        className="garage-vehicle-delete"
                        onClick={() => handleDelete(vehicle.id)}
                        title={t.garageConfirmDelete}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {isSelected && (
                      <div className="garage-parts-panel">
                        <div className="garage-parts-header">
                          <h3>
                            {t.garagePartsFor} —{" "}
                            {vehicle.make} {vehicle.model}
                          </h3>
                        </div>

                        {listingsLoading ? (
                          <p className="garage-parts-loading">
                            {t.garageLoadingParts}
                          </p>
                        ) : vehicleListings.length === 0 ? (
                          <p className="garage-parts-empty">
                            {t.garageNoParts}
                          </p>
                        ) : (
                          <div className="garage-parts-grid">
                            {vehicleListings.map((listing) => {
                              const listingText = getLocalizedListingText(listing, locale);

                              return (
                                <Link
                                  key={listing.id}
                                  href={`/listing/${listing.id}`}
                                  className="garage-part-card"
                                >
                                  <img
                                    src={listing.image_url}
                                    alt={listingText.title}
                                    className="garage-part-img"
                                  />
                                  <div className="garage-part-body">
                                    <span className="garage-part-category">
                                      {translateCategory(locale, listing.category ?? "")}
                                    </span>
                                    <h4 className="garage-part-title">
                                      {listingText.title}
                                    </h4>
                                    <div className="garage-part-meta">
                                      <MapPin size={13} />
                                      <span>{listing.location}</span>
                                    </div>
                                    <strong className="garage-part-price">
                                      {formatPrice(listing.price)}
                                    </strong>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <style>{`
        .garage-page {
          min-height: 100vh;
          background:
            radial-gradient(900px 440px at 12% -8%, rgba(64, 216, 255, 0.22), transparent 62%),
            radial-gradient(720px 360px at 92% 8%, rgba(255, 107, 22, 0.12), transparent 60%),
            linear-gradient(180deg, #031326 0%, #061a2e 46%, #082b54 100%) !important;
          color: #f8fbff !important;
        }

        .garage-loading {
          display: grid;
          place-items: center;
          min-height: 100vh;
          color: #64748b;
          font-size: 15px;
        }

        .garage-topbar {
          height: 66px;
          padding: 0 clamp(18px, 4vw, 48px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 20;
          background: linear-gradient(180deg, rgba(8,28,74,0.62), rgba(8,28,74,0));
          backdrop-filter: blur(10px);
        }

        .garage-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 900;
          font-size: 15px;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .garage-brand-mark {
          width: 30px;
          height: 30px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.22);
          color: #ffffff;
        }

        .garage-back {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.8);
          transition: color 0.2s;
        }

        .garage-back:hover { color: #ffffff; }

        .garage-container {
          max-width: 1120px;
          margin: 0 auto;
          padding: 48px clamp(18px, 4vw, 48px) 86px;
        }

        .garage-heading {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(135deg, rgba(255, 107, 22, 0.1), transparent 34%),
            radial-gradient(760px 260px at 88% 0%, rgba(64, 216, 255, 0.28), transparent 72%),
            linear-gradient(135deg, #09233f 0%, #0a526d 48%, #0d8ca5 100%) !important;
          border: 1px solid rgba(126, 197, 240, 0.32) !important;
          border-radius: 28px !important;
          padding: 30px !important;
          box-shadow: 0 26px 78px rgba(2, 18, 38, 0.32), inset 0 1px 0 rgba(255,255,255,0.14) !important;
        }

        .garage-heading::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.08), transparent 32%),
            radial-gradient(420px 160px at 88% 0%, rgba(201,247,255,0.24), transparent 70%);
          pointer-events: none;
        }

        .garage-heading-icon {
          width: 62px;
          height: 62px;
          border-radius: 20px;
          background: linear-gradient(145deg, #d9fbff 0%, #6ed2e4 45%, #0a4462 100%);
          display: grid;
          place-items: center;
          color: #061a2e;
          flex-shrink: 0;
          box-shadow: 0 18px 42px rgba(5, 24, 46, 0.34), inset 0 1px 0 rgba(255,255,255,0.75);
          position: relative;
          z-index: 1;
          border-radius: 20px !important;
        }

        .garage-heading h1 {
          margin: 0 0 6px;
          font-size: clamp(2rem, 4vw, 3.1rem);
          font-weight: 950;
          color: #ffffff;
          letter-spacing: -0.03em;
          text-shadow: 0 18px 42px rgba(5,24,46,0.42);
          position: relative;
          z-index: 1;
        }

        .garage-heading p {
          margin: 0;
          color: rgba(236, 252, 255, 0.94);
          font-size: 15px;
          font-weight: 750;
          position: relative;
          z-index: 1;
        }

        .garage-heading-stats {
          margin-left: auto;
          min-width: 118px;
          min-height: 76px;
          border-radius: 18px;
          border: 1px solid rgba(201,247,255,0.28);
          background: rgba(255,255,255,0.1);
          display: grid;
          place-items: center;
          align-content: center;
          color: #ffffff;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.16);
          position: relative;
          z-index: 1;
        }

        .garage-heading-stats span {
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
        }

        .garage-heading-stats small {
          color: rgba(236, 252, 255, 0.82);
          font-size: 12px;
          font-weight: 850;
        }

        .garage-login-prompt {
          display: flex;
          align-items: center;
          gap: 14px;
          background: white;
          border: 1px solid rgba(15,23,42,0.08);
          border-radius: 16px;
          padding: 24px 28px;
          box-shadow: 0 4px 20px rgba(15,23,42,0.06);
          color: #0f172a;
          font-size: 15px;
        }

        .garage-login-btn {
          margin-left: auto;
          padding: 10px 22px;
          border-radius: 12px;
          background: #1d4ed8;
          color: white;
          font-weight: 700;
          font-size: 14px;
          transition: background 0.2s;
        }

        .garage-login-btn:hover { background: #1e40af; }

        .garage-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
          padding: 16px 18px;
          border: 1px solid rgba(126, 197, 240, 0.18);
          border-radius: 20px;
          background: rgba(3, 19, 38, 0.62);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .garage-toolbar-copy {
          display: grid;
          gap: 2px;
        }

        .garage-toolbar-copy strong {
          color: #ffffff;
          font-size: 18px;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .garage-toolbar-copy span {
          color: rgba(226, 244, 255, 0.72);
          font-size: 13px;
          font-weight: 750;
        }

        .garage-add-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 42px;
          padding: 0 20px;
          border-radius: 14px;
          border: 1px solid rgba(201,247,255,0.42);
          background: linear-gradient(135deg, #061a2e, #087995 58%, #49c7d8);
          color: white;
          font-weight: 950;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s;
          box-shadow: 0 16px 36px rgba(8,121,149,0.28), inset 0 1px 0 rgba(255,255,255,0.22);
          border-radius: 14px !important;
        }

        .garage-add-btn:hover {
          background: #1e40af;
          transform: translateY(-1px);
        }

        .garage-form {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.98), rgba(239,250,254,0.96)) !important;
          border: 1px solid rgba(126, 197, 240, 0.34) !important;
          border-radius: 26px !important;
          padding: 30px 34px;
          margin-bottom: 24px;
          box-shadow: 0 28px 78px rgba(2,18,38,0.28), inset 0 1px 0 rgba(255,255,255,0.82) !important;
        }

        .garage-form h3 {
          margin: 0 0 20px;
          font-size: 20px;
          font-weight: 950;
          color: #061a2e;
          letter-spacing: -0.02em;
        }

        .garage-form-hint {
          margin: 0 0 16px;
          font-size: 14px;
          color: #64748b;
        }

        .garage-class-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 8px;
        }

        .garage-class-btn {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          gap: 14px;
          min-height: 92px;
          padding: 18px;
          border-radius: 18px !important;
          border: 1px solid rgba(8,121,149,0.18);
          background:
            linear-gradient(135deg, rgba(255,255,255,0.98), rgba(231,247,252,0.92)) !important;
          cursor: pointer;
          font-size: 16px;
          font-weight: 950;
          color: #061a2e;
          transition: all 0.2s;
          box-shadow: 0 12px 28px rgba(5,24,46,0.08);
        }

        .garage-class-btn:hover {
          border-color: rgba(255,107,22,0.58);
          background:
            linear-gradient(135deg, rgba(255,247,240,0.98), rgba(226,249,255,0.96)) !important;
          transform: translateY(-2px);
          box-shadow: 0 18px 38px rgba(5,24,46,0.14);
        }

        .garage-class-icon {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, #d9fbff, #6ed2e4);
          border: 1px solid rgba(8,121,149,0.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
          font-size: 28px;
          line-height: 1;
          flex-shrink: 0;
          overflow: hidden;
        }

        .garage-back-step {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(218,249,255,0.7);
          border: 1px solid rgba(8,121,149,0.18);
          border-radius: 999px;
          color: #0a516d;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          padding: 9px 14px;
          margin-bottom: 16px;
          transition: color 0.2s;
        }

        .garage-back-step:hover { color: #061a2e; }

        .garage-selected-class {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(218,249,255,0.7) !important;
          border: 1px solid rgba(8,121,149,0.18) !important;
          border-radius: 999px !important;
          padding: 9px 16px;
          font-size: 14px;
          font-weight: 950;
          color: #0a516d;
          margin-bottom: 20px;
        }

        .garage-field select {
          height: 48px;
          padding: 0 14px;
          border-radius: 14px !important;
          border: 1px solid rgba(8,121,149,0.2) !important;
          background: rgba(255,255,255,0.94) !important;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
          cursor: pointer;
        }

        .garage-field select:focus {
          border-color: #3b82f6;
          background: white;
        }

        .garage-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 20px;
        }

        .garage-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .garage-field label {
          font-size: 13px;
          font-weight: 900;
          color: #087995 !important;
        }

        .garage-field input {
          height: 48px;
          padding: 0 14px;
          border-radius: 14px !important;
          border: 1px solid rgba(8,121,149,0.2) !important;
          background: rgba(255,255,255,0.94) !important;
          font-size: 14px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.2s;
        }

        .garage-custom-make-input {
          margin-top: 8px;
        }

        .garage-field input:focus {
          border-color: #3b82f6;
          background: white;
        }

        .garage-form-error {
          color: #dc2626;
          font-size: 13px;
          margin: 0 0 16px;
        }

        .garage-save-btn {
          height: 48px;
          padding: 0 26px;
          border-radius: 14px !important;
          border: 1px solid rgba(255,199,148,0.58) !important;
          background: linear-gradient(135deg, #ff8a1c 0%, #ff6b16 46%, #e65300 100%) !important;
          color: white;
          font-weight: 950;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
          box-shadow: 0 16px 34px rgba(255,107,22,0.24) !important;
        }

        .garage-save-btn:hover:not(:disabled) { background: #1e40af; }
        .garage-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .garage-empty {
          text-align: center;
          padding: 54px 24px;
          color: #547083;
          border: 1px dashed rgba(8,121,149,0.28);
          border-radius: 22px;
          background: rgba(255,255,255,0.56);
        }

        .garage-empty p {
          margin: 16px 0 0;
          font-size: 15px;
        }

        .garage-vehicles {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .garage-vehicle-wrap {
          display: flex;
          flex-direction: column;
        }

        .garage-vehicle-card {
          display: flex;
          align-items: center;
          background:
            radial-gradient(360px 160px at 92% 0%, rgba(64,216,255,0.2), transparent 70%),
            linear-gradient(135deg, rgba(255,255,255,0.98), rgba(233,247,252,0.94)) !important;
          border: 1px solid rgba(126, 197, 240, 0.28) !important;
          border-radius: 24px !important;
          padding: 20px 22px;
          box-shadow: 0 26px 74px rgba(2,18,38,0.22) !important;
          transition: transform 0.18s, box-shadow 0.2s, border-color 0.2s;
          position: relative;
          overflow: hidden;
        }

        .garage-vehicle-card::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 5px;
          background: linear-gradient(180deg, #6ed2e4, #087995);
        }

        .garage-vehicle-card.selected {
          border-color: rgba(8,121,149,0.48);
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          box-shadow: 0 28px 78px rgba(5,24,46,0.16);
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
        }

        .garage-vehicle-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 30px 86px rgba(5,24,46,0.16);
        }

        .garage-vehicle-info {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          cursor: pointer;
        }

        .garage-vehicle-icon {
          width: 58px;
          height: 58px;
          border-radius: 18px !important;
          background: linear-gradient(145deg, #e8fbff, #b8eef7);
          display: grid;
          place-items: center;
          color: #061a2e;
          flex-shrink: 0;
          border: 1px solid rgba(8,121,149,0.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 26px rgba(8,121,149,0.14);
          overflow: hidden;
        }

        .garage-vehicle-icon span {
          font-size: 28px;
          line-height: 1;
        }

        .garage-vehicle-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .garage-vehicle-type {
          width: fit-content;
          font-size: 11px;
          color: #087995;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .garage-vehicle-nickname {
          font-size: 12px;
          font-weight: 900;
          color: #455d70;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .garage-vehicle-name {
          font-size: 19px;
          font-weight: 950;
          color: #061a2e;
          letter-spacing: -0.02em;
        }

        .garage-vehicle-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .garage-vehicle-year {
          font-size: 13px;
          color: #547083;
          font-weight: 800;
        }

        .garage-vehicle-class-tag {
          font-size: 11px;
          font-weight: 900;
          background: rgba(218,249,255,0.72);
          color: #087995;
          border-radius: 999px;
          padding: 4px 10px;
          border: 1px solid rgba(8,121,149,0.18);
        }

        .garage-vehicle-arrow {
          margin-left: auto;
          margin-right: 12px;
          color: #087995;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(218,249,255,0.62);
        }

        .garage-vehicle-delete {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          border: 1px solid rgba(220,38,38,0.15);
          background: rgba(255,255,255,0.78);
          color: #dc2626;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .garage-vehicle-delete:hover {
          background: rgba(220,38,38,0.12);
          border-color: rgba(220,38,38,0.3);
        }

        .garage-parts-panel {
          background: rgba(247,253,255,0.78);
          border: 1px solid rgba(8,121,149,0.44);
          border-top: none;
          border-bottom-left-radius: 16px;
          border-bottom-right-radius: 16px;
          padding: 24px;
          box-shadow: 0 24px 70px rgba(5,24,46,0.08);
        }

        .garage-parts-header h3 {
          margin: 0 0 20px;
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
        }

        .garage-parts-loading,
        .garage-parts-empty {
          color: #64748b;
          font-size: 14px;
          padding: 20px 0;
          text-align: center;
        }

        .garage-parts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
        }

        .garage-part-card {
          background: white;
          border-radius: 14px;
          border: 1px solid rgba(15,23,42,0.08);
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(15,23,42,0.06);
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          flex-direction: column;
        }

        .garage-part-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(15,23,42,0.12);
        }

        .garage-part-img {
          width: 100%;
          height: 140px;
          object-fit: cover;
        }

        .garage-part-body {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .garage-part-category {
          font-size: 11px;
          font-weight: 600;
          color: #3b82f6;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .garage-part-title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
        }

        .garage-part-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .garage-part-price {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 8px;
        }

        @media (max-width: 640px) {
          .garage-container {
            max-width: 100vw;
            overflow-x: hidden;
            padding-left: 12px;
            padding-right: 12px;
          }
          .garage-heading {
            align-items: flex-start;
            flex-wrap: wrap;
          }
          .garage-heading-stats {
            margin-left: 0;
            width: 100%;
            min-height: 58px;
            grid-template-columns: auto auto;
            gap: 8px;
          }
          .garage-toolbar {
            align-items: stretch;
            flex-direction: column;
          }
          .garage-add-btn {
            justify-content: center;
          }
          .garage-form-grid {
            grid-template-columns: 1fr;
          }
          .garage-vehicles,
          .garage-vehicle-wrap {
            width: 100%;
            min-width: 0;
          }
          .garage-vehicle-card {
            align-items: stretch;
            overflow: visible;
            padding: 16px 48px 16px 16px;
            width: 100%;
          }
          .garage-vehicle-info {
            display: grid;
            grid-template-columns: 58px minmax(0, 1fr) 34px;
            gap: 12px;
            min-width: 0;
            width: 100%;
          }
          .garage-vehicle-details,
          .garage-vehicle-name,
          .garage-vehicle-type,
          .garage-vehicle-nickname {
            min-width: 0;
          }
          .garage-vehicle-name {
            overflow: visible;
            overflow-wrap: anywhere;
            white-space: normal;
          }
          .garage-vehicle-arrow {
            margin-left: 0;
            margin-right: 0;
          }
          .garage-vehicle-delete {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 3;
          }
          .garage-parts-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

    </main>
  );
}
