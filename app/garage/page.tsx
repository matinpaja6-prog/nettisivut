"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  CalendarDays,
  Car,
  ChevronDown,
  ChevronRight,
  LockKeyhole,
  MapPin,
  MoreVertical,
  Plus,
  Star,
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
import { readCachedResource, writeCachedResource } from "@/lib/client-resource-cache";
import { listingPath, listingUrlId } from "@/lib/routes";

type VehicleClass = "Moottorikelkka" | "Mönkijä" | "Motocross" | "Mopo";

const vehicleClasses: VehicleClass[] = ["Moottorikelkka", "Mönkijä", "Motocross", "Mopo"];
const otherMakeValue = "__other_make__";
const otherModelValue = "__other_model__";
const otherYearValue = "__other_year__";
const currentVehicleYear = new Date().getFullYear() + 1;
const garageYearOptions = Array.from(
  { length: currentVehicleYear - 1970 + 1 },
  (_, index) => String(currentVehicleYear - index)
);

const classBrands: Record<string, string[]> = {
  Moottorikelkka: ["Lynx", "Ski-Doo", "Polaris", "Arctic Cat", "Yamaha"],
  [vehicleClasses[1]]: ["Can-Am", "Polaris", "Yamaha", "Honda", "CFMOTO", "Kawasaki"],
  Motocross: ["KTM", "Yamaha", "Honda", "Kawasaki", "Husqvarna", "Suzuki", "GasGas", "Beta", "Sherco", "TM"],
  Mopo: ["Yamaha", "Honda", "Derbi", "Rieju", "KTM", "Aprilia", "Husqvarna"]
};

const classModelPlaceholders: Record<string, string> = {
  Moottorikelkka: "esim. RMK 800 / 600 ACE",
  [vehicleClasses[1]]: "esim. Outlander 650",
  Motocross: "esim. SX 125 / CRF 250 / YZ 450",
  Mopo: "esim. DT 50 / SX 50"
};

const garageBrandOptions: Record<string, string[]> = {
  Moottorikelkka: ["Lynx", "Ski-Doo", "Polaris", "Arctic Cat", "Yamaha", "Taiga"],
  [vehicleClasses[1]]: ["Can-Am", "Polaris", "Yamaha", "Honda", "CFMOTO", "Suzuki", "Kawasaki", "Arctic Cat", "TGB", "Kymco", "Linhai", "Segway", "Hisun"],
  Motocross: ["KTM", "Yamaha", "Honda", "Kawasaki", "Husqvarna", "Suzuki", "GasGas", "Beta", "Sherco", "TM", "Fantic"],
  Mopo: ["Yamaha", "MBK", "Derbi", "Rieju", "Aprilia", "Peugeot", "Piaggio", "Gilera", "Beta", "KTM", "Honda", "Suzuki", "Kymco", "Keeway", "CPI", "Generic", "Malaguti", "Motorhispania", "Sherco", "Tunturi", "Puch", "Solifer"]
};

const garageBrandModels: Record<string, Record<string, string[]>> = {
  Moottorikelkka: {
    Lynx: ["Rave RS", "Rave Racing", "Rave", "Rave RE", "Xtrim", "Xterrain", "Boondocker", "Shredder", "Commander", "Adventure", "49 Ranger", "69 Ranger", "Yeti", "GLX"],
    "Ski-Doo": ["MXZ RS", "MXZ", "MXZ X-RS", "Summit", "Freeride", "Renegade", "Backcountry", "Expedition", "Skandic", "Tundra", "Grand Touring", "Formula", "Mach Z"],
    Polaris: ["IQR", "600R", "XCR", "Indy XC", "Indy", "Indy VR1", "RMK", "Pro RMK", "SKS", "Switchback", "Voyageur", "Titan", "Matryx", "Rush", "Assault", "Widetrak"],
    "Arctic Cat": ["ZR 600 R-XC", "ZR 6000 R XC", "ZR", "ZR 600", "M", "M 8000", "Riot", "Norseman", "Pantera", "Blast", "Bearcat", "Thundercat", "F", "Crossfire"],
    Yamaha: ["SR Viper", "Sidewinder", "Apex", "Nytro", "Phazer", "Venture", "Viking", "RS Vector", "RX-1"],
    Taiga: ["Nomad", "Ekko", "Atlas"]
  },
  [vehicleClasses[1]]: {
    "Can-Am": ["Outlander", "Renegade", "Commander", "Maverick", "Traxter", "DS"],
    Polaris: ["Sportsman", "Scrambler", "Ranger", "RZR", "General", "Trail Boss", "Phoenix", "Outlaw"],
    Yamaha: ["Grizzly", "Kodiak", "YFZ", "Raptor", "Wolverine", "Viking", "Banshee", "Blaster", "Warrior"],
    Honda: ["TRX", "FourTrax", "Foreman", "Rancher", "Rubicon", "Rincon", "Pioneer", "Talon"],
    CFMOTO: ["CFORCE", "UFORCE", "ZFORCE", "Gladiator", "CForce X", "UForce XL"],
    Suzuki: ["KingQuad", "LT-Z", "LT-R", "Eiger", "Ozark", "Vinson"],
    Kawasaki: ["Brute Force", "KFX", "KVF", "KLF", "Mule", "Teryx", "Prairie"],
    "Arctic Cat": ["Alterra", "TRV", "DVX", "Prowler", "Wildcat"],
    TGB: ["Blade", "Target", "Landmax"],
    Kymco: ["MXU", "Maxxer", "UXV"],
    Linhai: ["M", "LH", "T-Boss"],
    Segway: ["Snarler", "Fugleman", "Villain"],
    Hisun: ["Tactic", "Forge", "Sector", "Strike"]
  },
  Motocross: {
    KTM: ["SX", "SX-F", "EXC", "EXC-F", "XC", "XC-F", "XC-W", "SMR", "Duke", "Adventure"],
    Yamaha: ["YZ", "YZ-F", "WR", "TTR", "PW", "Tenere", "XT"],
    Honda: ["CR", "CRF", "CRF-R", "CRF-X", "XR", "Africa Twin", "CB"],
    Kawasaki: ["KX", "KX-F", "KLX", "KDX", "KLR", "KLE", "Ninja"],
    Husqvarna: ["TC", "FC", "TE", "FE", "TX", "FX", "SM"],
    Suzuki: ["RM", "RM-Z", "DR-Z", "DR", "RMX", "TS", "LT"],
    GasGas: ["MC", "MC-F", "EC", "EC-F", "EX", "EX-F", "TXT"],
    Beta: ["RR", "RR Racing", "Xtrainer", "RX", "Evo"],
    Sherco: ["SE", "SEF", "ST", "SC", "Factory"],
    TM: ["MX", "EN", "SMR", "Fi", "ES"],
    Fantic: ["XX", "XE", "XEF", "Caballero"]
  },
  Mopo: {
    Yamaha: ["DT", "Aerox", "BW's", "BWS", "Booster", "Jog", "Slider", "Neos", "TZR", "WR", "Why"],
    MBK: ["Booster", "Nitro", "Ovetto", "X-Limit", "Stunt", "Rocket"],
    Derbi: ["Senda", "DRD", "Xtreme", "Racing", "GPR", "Atlantis", "Variant", "Terra"],
    Rieju: ["MRT", "MRX", "RRX", "RS", "RS2", "SMX", "Tango", "Spike"],
    Aprilia: ["SX", "RX", "RS", "SR", "Rally", "Sonic", "Mojito", "Tuono", "Pegaso"],
    Peugeot: ["Speedfight", "Trekker", "Vivacity", "Ludix", "Kisbee", "XPS", "XP6", "Jetforce", "Elyseo"],
    Piaggio: ["Zip", "Typhoon", "NRG", "Liberty", "Sfera", "Fly", "Vespa Primavera", "Vespa Sprint"],
    Gilera: ["Runner", "SMT", "RCR", "Stalker", "DNA", "Ice", "Storm"],
    Beta: ["RR", "RR Motard", "Ark", "Track", "Chrono"],
    KTM: ["SX", "EXC", "Duke", "RC", "SMC"],
    Honda: ["Monkey", "Dax", "MTX", "NSR", "Vision", "Zoomer", "X8R", "SFX"],
    Suzuki: ["PV", "S", "TS", "Katana", "Street Magic", "Address"],
    Kymco: ["Agility", "Super 8", "People", "Vitality", "Dink"],
    Keeway: ["RY6", "F-Act", "Matrix", "TX", "X-Ray"],
    CPI: ["SM", "SX", "Oliver", "Aragon", "Popcorn"],
    Generic: ["Trigger", "XOR", "Ideo", "Race"],
    Malaguti: ["F12", "F15", "XSM", "XTM", "Phantom"],
    Motorhispania: ["RYZ", "Furia", "RX", "Duna"],
    Sherco: ["SM", "SE", "HRD"],
    Tunturi: ["Tiger", "City", "Super Sport", "Pappa", "Sport"],
    Puch: ["Maxi", "Monza", "Cobra", "Ranger"],
    Solifer: ["SM", "SFR", "Export", "Suzuki PV"]
  }
};

const classIcons: Record<string, string> = {
  Moottorikelkka: "🏔️",
  [vehicleClasses[1]]: "🏕️",
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
    model: "",
    year: String(new Date().getFullYear()),
    nickname: ""
  });
  const [customVehicleFields, setCustomVehicleFields] = useState({
    make: false,
    model: false,
    year: false
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [selectedVehicle, setSelectedVehicle] =
    useState<GarageVehicle | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<GarageVehicle | null>(null);
  const [vehicleListings, setVehicleListings] =
    useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] =
    useState(false);
  const classLabels: Record<string, string> = {
    Moottorikelkka: t.garageSnowmobile,
    [vehicleClasses[1]]: t.garageAtv,
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

  const newestVehicleDate = vehicles
    .map((vehicle) => new Date(vehicle.created_at))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const latestUpdatedLabel = newestVehicleDate
    ? newestVehicleDate.toLocaleDateString(locale, { day: "numeric", month: "numeric", year: "numeric" })
    : "-";
  const shouldShowForm = showForm;

  const selectedVehicleClass = form.vehicle_class as VehicleClass;
  const brandOptions = form.vehicle_class ? garageBrandOptions[selectedVehicleClass] : [];
  const modelOptions =
    form.vehicle_class && form.make
      ? garageBrandModels[selectedVehicleClass]?.[form.make] ?? []
      : [];

  useEffect(() => {
    if (!user) return;
    const cacheKey = `garage-vehicles:${user.id}`;
    const cached = readCachedResource<GarageVehicle[]>(cacheKey);
    if (cached) setVehicles(cached);

    getGarageVehicles(user.id).then(({ data }) => {
      const next = data ?? [];
      setVehicles(next);
      writeCachedResource(cacheKey, next);
    });
  }, [user]);

  async function handleAdd() {
    if (!user) return;
    const make = form.make.trim();
    const model = form.model.trim();
    const year = Number(form.year);
    if (!make || !model) {
      setFormError(t.garageErrorRequired);
      return;
    }
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) {
      setFormError(t.garageErrorYear);
      return;
    }
    setSaving(true);
    setFormError("");
    const { data, error } = await addGarageVehicle({
      user_id: user.id,
      vehicle_class: form.vehicle_class || null,
      make,
      model,
      year,
      nickname: form.nickname.trim() || null
    });
    setSaving(false);
    if (error || !data) {
      setFormError(t.garageSaveFailed);
      return;
    }
    setVehicles((prev) => {
      const next = [data, ...prev];
      writeCachedResource(`garage-vehicles:${user.id}`, next);
      return next;
    });
    setForm({ vehicle_class: "", make: "", model: "", year: String(new Date().getFullYear()), nickname: "" });
    setCustomVehicleFields({ make: false, model: false, year: false });
    setFormStep("class");
    setShowForm(false);
  }

  async function handleDelete(vehicleId: string) {
    await deleteGarageVehicle(vehicleId);
    setVehicles((prev) => {
      const next = prev.filter((v) => v.id !== vehicleId);
      if (user) writeCachedResource(`garage-vehicles:${user.id}`, next);
      return next;
    });
    if (selectedVehicle?.id === vehicleId) {
      setSelectedVehicle(null);
      setVehicleListings([]);
    }
    setDeleteTarget(null);
  }

  async function handleSelectVehicle(vehicle: GarageVehicle) {
    if (selectedVehicle?.id === vehicle.id) {
      setSelectedVehicle(null);
      setVehicleListings([]);
      return;
    }
    setSelectedVehicle(vehicle);
    const cacheKey = `garage-listings:${vehicle.id}`;
    const cached = readCachedResource<Listing[]>(cacheKey);
    if (cached) {
      setVehicleListings(cached);
      setListingsLoading(false);
    } else {
      setListingsLoading(true);
    }
    const { data } = await getListingsByVehicle(vehicle.make, vehicle.model);
    const next = data ?? [];
    setVehicleListings(next);
    writeCachedResource(cacheKey, next);
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
      <div className="garage-container">

        <div className="garage-heading">
          <div className="garage-heading-icon"><Wrench size={28} /></div>
          <div>
            <h1>{t.garageTitle}</h1>
            <p>{t.garageSubtitle}</p>
          </div>
          <div className="garage-heading-metrics" aria-label={t.garageTitle}>
            <div className="garage-heading-metric">
              <Car size={24} aria-hidden="true" />
              <div>
                <strong>{vehicles.length}</strong>
                <span>AJONEUVOA</span>
              </div>
            </div>
            <div className="garage-heading-metric">
              <Star size={26} aria-hidden="true" />
              <div>
                <strong>0</strong>
                <span>SUOSIKKIA</span>
              </div>
            </div>
            <div className="garage-heading-metric garage-heading-metric-wide">
              <CalendarDays size={26} aria-hidden="true" />
              <div>
                <strong>{latestUpdatedLabel}</strong>
                <span>VIIMEKSI PÄIVITETTY</span>
              </div>
            </div>
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
                <span className="garage-toolbar-accent" aria-hidden="true" />
                <strong>{t.garageVehiclesTitle}</strong>
                <span>{t.garageVehiclesDesc}</span>
              </div>
              <button
                className="garage-add-btn"
                onClick={() => { setShowForm(!showForm); setFormError(""); setFormStep("class"); }}
              >
                {showForm ? <X size={16} /> : <Plus size={16} />}
                <span>{showForm ? t.garageCancel : t.garageAddVehicle}</span>
                {!showForm && <ChevronRight className="garage-add-btn-chevron" size={18} aria-hidden="true" />}
              </button>
            </div>

            {vehicles.length === 0 && (
              <div className="garage-empty">
                <Wrench size={48} />
                <p>{t.garageEmpty}</p>
              </div>
            )}

            {shouldShowForm && (
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
                              setForm({ ...form, vehicle_class: cls, make: "", model: "" });
                              setCustomVehicleFields({ make: false, model: false, year: false });
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
                        {customVehicleFields.make ? (
                          <input
                            value={form.make}
                            onChange={(e) => setForm({ ...form, make: e.target.value, model: "" })}
                            placeholder={t.garageMakeOtherPlaceholder}
                            autoFocus
                          />
                        ) : (
                        <select
                          value={form.make}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === otherMakeValue) {
                              setCustomVehicleFields((prev) => ({ ...prev, make: true, model: true }));
                              setForm({ ...form, make: "", model: "" });
                              return;
                            }
                            setForm({ ...form, make: value, model: "" });
                          }}
                        >
                          <option value="">—</option>
                          {brandOptions.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                          <option value={otherMakeValue}>{t.garageMakeOther}</option>
                        </select>
                        )}
                      </div>
                      <div className="garage-field">
                        <label>{t.garageModel} *</label>
                        {customVehicleFields.model || !modelOptions.length ? (
                        <input
                          value={form.model}
                          onChange={(e) => setForm({ ...form, model: e.target.value })}
                          placeholder={form.vehicle_class ? classModelPlaceholders[form.vehicle_class as VehicleClass] : ""}
                          autoFocus={customVehicleFields.model}
                        />
                        ) : (
                          <select
                            value={form.model}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === otherModelValue) {
                                setCustomVehicleFields((prev) => ({ ...prev, model: true }));
                                setForm({ ...form, model: "" });
                                return;
                              }
                              setForm({ ...form, model: value });
                            }}
                          >
                            <option value="">-</option>
                            {modelOptions.map((model) => (
                              <option key={model} value={model}>{model}</option>
                            ))}
                            <option value={otherModelValue}>Muu</option>
                          </select>
                        )}
                      </div>
                      <div className="garage-field">
                        <label>{t.garageYear} *</label>
                        {customVehicleFields.year ? (
                        <input
                          type="number"
                          value={form.year}
                          onChange={(e) => setForm({ ...form, year: e.target.value })}
                          placeholder="Kirjoita vuosimalli"
                          min={1900}
                          max={new Date().getFullYear() + 1}
                          autoFocus
                        />
                        ) : (
                          <select
                            value={form.year}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === otherYearValue) {
                                setCustomVehicleFields((prev) => ({ ...prev, year: true }));
                                setForm({ ...form, year: "" });
                                return;
                              }
                              setForm({ ...form, year: value });
                            }}
                          >
                            <option value="">-</option>
                            {garageYearOptions.map((year) => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                            <option value={otherYearValue}>Muu</option>
                          </select>
                        )}
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

            <div className="garage-vehicles">
              {vehicles.map((vehicle) => {
                const isSelected = selectedVehicle?.id === vehicle.id;
                const vehicleClass = normalizeVehicleClass(vehicle.vehicle_class);
                return (
                  <div key={vehicle.id} className="garage-vehicle-wrap">
                    <div
                      className={`garage-vehicle-card ${isSelected ? "selected" : ""}`}
                    >
                      <MoreVertical className="garage-vehicle-menu" size={24} aria-hidden="true" />
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
                              className="garage-vehicle-primary-image"
                              src={VEHICLE_PHOTOS[vehicleClass]}
                              alt={classIcons[vehicleClass]}
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
                            <span className="garage-vehicle-type-mark" aria-hidden="true" />
                            {vehicleClass ? classLabels[vehicleClass] : t.garageDefaultVehicle}
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
                            <span className="garage-vehicle-year">
                              <CalendarDays size={18} aria-hidden="true" />
                              {vehicle.year}
                            </span>
                            <span className="garage-vehicle-class-tag">
                              <span aria-hidden="true" />
                              {t.garageShowParts}
                              <ChevronRight size={18} aria-hidden="true" />
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
                        onClick={() => setDeleteTarget(vehicle)}
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
                                  href={listingPath(listingUrlId(listing), locale)}
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

            {deleteTarget && (
              <div
                className="garage-delete-backdrop"
                role="dialog"
                aria-modal="true"
                aria-labelledby="garage-delete-title"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setDeleteTarget(null);
                }}
              >
                <div className="garage-delete-dialog">
                  <button
                    type="button"
                    className="garage-delete-close"
                    onClick={() => setDeleteTarget(null)}
                    aria-label="Sulje"
                  >
                    <X size={18} />
                  </button>
                  <div className="garage-delete-icon">
                    <Trash2 size={24} aria-hidden="true" />
                  </div>
                  <h3 id="garage-delete-title">Poistetaanko ajoneuvo tallista?</h3>
                  <p>
                    {deleteTarget.make} {deleteTarget.model} poistetaan omasta tallista.
                    Ilmoitukset eivät poistu.
                  </p>
                  <div className="garage-delete-actions">
                    <button
                      type="button"
                      className="garage-delete-cancel"
                      onClick={() => setDeleteTarget(null)}
                    >
                      Peruuta
                    </button>
                    <button
                      type="button"
                      className="garage-delete-confirm"
                      onClick={() => handleDelete(deleteTarget.id)}
                    >
                      Poista
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .garage-page {
          min-height: 100vh;
          background: #101c22 !important;
          color: #f8fbff !important;
        }

        .garage-loading {
          display: grid;
          place-items: center;
          min-height: 100vh;
          color: #64748b;
          font-size: 15px;
        }

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
            radial-gradient(520px 180px at 78% 0%, rgba(15, 70, 122, 0.24), transparent 70%),
            linear-gradient(135deg, rgba(8, 21, 42, 0.94), rgba(7, 18, 34, 0.96)) !important;
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
          background:
            radial-gradient(520px 180px at 78% 0%, rgba(15, 70, 122, 0.2), transparent 70%),
            linear-gradient(135deg, rgba(8, 21, 42, 0.94), rgba(7, 18, 34, 0.96));
          border: 1px solid rgba(71, 112, 153, 0.52);
          border-radius: 16px;
          padding: 24px 28px;
          box-shadow: 0 4px 20px rgba(15,23,42,0.06);
          color: #f8fbff;
          font-size: 15px;
        }

        .garage-login-btn {
          margin-left: auto;
          padding: 10px 22px;
          border-radius: 12px;
          background: #ff8a24;
          color: white;
          font-weight: 700;
          font-size: 14px;
          transition: background 0.2s;
        }

        .garage-login-btn:hover { background: #e65c00; }

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
          background: #e65c00;
          transform: translateY(-1px);
        }

        .garage-form {
          background:
            radial-gradient(420px 180px at 88% 0%, rgba(255,122,26,0.14), transparent 68%),
            radial-gradient(360px 160px at 12% 0%, rgba(64,216,255,0.12), transparent 70%),
            linear-gradient(135deg, rgba(14,31,49,0.98), rgba(7,17,29,0.98)) !important;
          border: 1px solid rgba(126, 197, 240, 0.24) !important;
          border-radius: 22px !important;
          padding: 22px 24px;
          margin-bottom: 20px;
          box-shadow: 0 24px 64px rgba(0,7,18,0.34), inset 0 1px 0 rgba(255,255,255,0.06) !important;
        }

        .garage-form h3 {
          margin: 0 0 16px;
          font-size: 18px;
          font-weight: 950;
          color: #f8fbff;
          letter-spacing: 0;
        }

        .garage-form-hint {
          margin: 0 0 14px;
          font-size: 13px;
          color: #b8c7d6;
        }

        .garage-class-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 8px;
        }

        .garage-class-btn {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          min-height: 68px;
          padding: 12px 14px;
          border-radius: 16px !important;
          border: 1px solid rgba(126, 197, 240, 0.24);
          background:
            linear-gradient(135deg, rgba(10,33,54,0.96), rgba(7,22,37,0.96)) !important;
          cursor: pointer;
          font-size: 14px;
          font-weight: 950;
          color: #f8fbff;
          transition: all 0.2s;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .garage-class-btn:hover {
          border-color: rgba(255,107,22,0.58);
          background:
            linear-gradient(135deg, rgba(255,122,26,0.18), rgba(9,34,56,0.98)) !important;
          transform: translateY(-2px);
          box-shadow: 0 16px 34px rgba(0,7,18,0.32);
        }

        .garage-class-icon {
          width: 44px;
          height: 44px;
          border-radius: 13px;
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
          background: rgba(7, 22, 37, 0.82);
          border: 1px solid rgba(126, 197, 240, 0.24);
          border-radius: 999px;
          color: #d9e8f6;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          padding: 9px 14px;
          margin-bottom: 16px;
          transition: color 0.2s;
        }

        .garage-back-step:hover { color: #ff9a3d; }

        .garage-selected-class {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(7, 22, 37, 0.82) !important;
          border: 1px solid rgba(126, 197, 240, 0.24) !important;
          border-radius: 999px !important;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 950;
          color: #f8fbff;
          margin-bottom: 16px;
        }

        .garage-field select {
          height: 44px;
          padding: 0 13px;
          border-radius: 13px !important;
          border: 1px solid rgba(126, 197, 240, 0.34) !important;
          background: #061726 !important;
          font-size: 14px;
          color: #f8fbff;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
          cursor: pointer;
        }

        .garage-field select:focus {
          border-color: #ff7a1a;
          background: #061726;
        }

        .garage-field select option {
          background: #061726;
          color: #f8fbff;
        }

        .garage-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 18px;
          margin-bottom: 18px;
        }

        .garage-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .garage-field label {
          font-size: 13px;
          font-weight: 900;
          color: #0aa6c7 !important;
        }

        .garage-field input {
          height: 44px;
          padding: 0 13px;
          border-radius: 13px !important;
          border: 1px solid rgba(126, 197, 240, 0.34) !important;
          background: #061726 !important;
          font-size: 14px;
          color: #f8fbff;
          outline: none;
          transition: border-color 0.2s;
        }

        .garage-custom-make-input {
          margin-top: 8px;
        }

        .garage-field input:focus {
          border-color: #ff7a1a;
          background: #061726;
        }

        .garage-form-error {
          color: #dc2626;
          font-size: 13px;
          margin: 0 0 16px;
        }

        .garage-save-btn {
          height: 46px;
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

        .garage-save-btn:hover:not(:disabled) { background: #e65c00; }
        .garage-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .garage-empty {
          text-align: center;
          padding: 38px 22px;
          color: #b8c7d6;
          border: 1px dashed rgba(126, 197, 240, 0.28);
          border-radius: 18px;
          background:
            linear-gradient(135deg, rgba(8, 21, 42, 0.72), rgba(7, 18, 34, 0.78));
        }

        .garage-empty p {
          margin: 16px 0 0;
          font-size: 15px;
        }

        .garage-delete-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(1, 9, 18, 0.74);
          backdrop-filter: blur(10px);
        }

        .garage-delete-dialog {
          position: relative;
          width: min(430px, 100%);
          overflow: hidden;
          border-radius: 22px;
          border: 1px solid rgba(126, 197, 240, 0.34);
          background:
            radial-gradient(360px 160px at 100% 0%, rgba(255, 122, 26, 0.2), transparent 70%),
            radial-gradient(280px 150px at 0% 0%, rgba(64, 216, 255, 0.12), transparent 68%),
            linear-gradient(145deg, #071827, #0b2235 58%, #081522);
          box-shadow: 0 32px 90px rgba(0, 7, 18, 0.58), inset 0 1px 0 rgba(255,255,255,0.08);
          padding: 30px;
          color: #f8fbff;
        }

        .garage-delete-close {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          border: 1px solid rgba(126, 197, 240, 0.28);
          background: rgba(7, 20, 34, 0.72);
          color: #c8d7e6;
          cursor: pointer;
        }

        .garage-delete-icon {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          border: 1px solid rgba(255, 138, 28, 0.42);
          background: linear-gradient(135deg, rgba(255, 138, 28, 0.22), rgba(255, 107, 22, 0.08));
          color: #ff9a3d;
          margin-bottom: 18px;
        }

        .garage-delete-dialog h3 {
          margin: 0 42px 10px 0;
          font-size: clamp(22px, 3vw, 28px);
          line-height: 1.08;
          font-weight: 950;
          letter-spacing: 0;
        }

        .garage-delete-dialog p {
          margin: 0;
          max-width: 34ch;
          color: #b8c7d6;
          line-height: 1.55;
          font-size: 15px;
          font-weight: 750;
        }

        .garage-delete-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 26px;
        }

        .garage-delete-actions button {
          min-width: 112px;
          height: 46px;
          border-radius: 14px;
          font-weight: 950;
          cursor: pointer;
        }

        .garage-delete-cancel {
          border: 1px solid rgba(126, 197, 240, 0.28);
          background: rgba(9, 28, 45, 0.86);
          color: #d9e8f6;
        }

        .garage-delete-confirm {
          border: 1px solid rgba(255, 199, 148, 0.58);
          background: linear-gradient(135deg, #ff8a1c 0%, #ff6b16 46%, #e65300 100%);
          color: #fff;
          box-shadow: 0 14px 32px rgba(255, 107, 22, 0.28);
        }

        .garage-delete-close:hover,
        .garage-delete-cancel:hover {
          border-color: rgba(255, 138, 28, 0.48);
        }

        .garage-delete-confirm:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 38px rgba(255, 107, 22, 0.36);
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
            radial-gradient(420px 180px at 88% 0%, rgba(255,122,26,0.18), transparent 68%),
            radial-gradient(360px 160px at 12% 0%, rgba(64,216,255,0.12), transparent 70%),
            linear-gradient(135deg, rgba(14,31,49,0.98), rgba(7,17,29,0.98)) !important;
          border: 1px solid rgba(126, 197, 240, 0.22) !important;
          border-radius: 24px !important;
          padding: 20px 22px;
          box-shadow: 0 26px 74px rgba(0,7,18,0.34), inset 0 1px 0 rgba(255,255,255,0.06) !important;
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
          background: linear-gradient(180deg, #ff9a3d, #ff6b16);
        }

        .garage-vehicle-card.selected {
          border-color: rgba(255,122,26,0.52) !important;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          box-shadow: 0 28px 78px rgba(0,7,18,0.4), 0 0 0 1px rgba(255,122,26,0.14) !important;
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
        }

        .garage-vehicle-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255,122,26,0.42) !important;
          box-shadow: 0 30px 86px rgba(0,7,18,0.42), 0 0 0 1px rgba(255,122,26,0.12) !important;
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
          background: linear-gradient(145deg, rgba(3,12,24,0.92), rgba(16,35,55,0.96));
          display: grid;
          place-items: center;
          color: #ffffff;
          flex-shrink: 0;
          border: 1px solid rgba(151,178,205,0.2);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 26px rgba(0,7,18,0.28);
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
          color: #ffb45f;
          font-weight: 950;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .garage-vehicle-nickname {
          font-size: 12px;
          font-weight: 900;
          color: rgba(226,244,255,0.66);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .garage-vehicle-name {
          font-size: 19px;
          font-weight: 950;
          color: #ffffff;
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
          color: rgba(226,244,255,0.72);
          font-weight: 800;
        }

        .garage-vehicle-class-tag {
          font-size: 11px;
          font-weight: 900;
          background: rgba(255,122,26,0.14);
          color: #ffd1a3;
          border-radius: 999px;
          padding: 4px 10px;
          border: 1px solid rgba(255,122,26,0.32);
        }

        .garage-vehicle-arrow {
          margin-left: auto;
          margin-right: 12px;
          color: #ffb45f;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(255,122,26,0.12);
          border: 1px solid rgba(255,122,26,0.24);
        }

        .garage-vehicle-delete {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          border: 1px solid rgba(255,113,113,0.24);
          background: rgba(220,38,38,0.1);
          color: #ff8c8c;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .garage-vehicle-delete:hover {
          background: rgba(220,38,38,0.18);
          border-color: rgba(255,113,113,0.42);
          color: #ffffff;
        }

        .garage-parts-panel {
          background:
            radial-gradient(520px 180px at 78% 0%, rgba(15, 70, 122, 0.2), transparent 70%),
            linear-gradient(135deg, rgba(8, 21, 42, 0.94), rgba(7, 18, 34, 0.96)) !important;
          border: 1px solid rgba(71, 112, 153, 0.52);
          border-top: none;
          border-bottom-left-radius: 18px;
          border-bottom-right-radius: 18px;
          padding: 20px 22px;
          box-shadow: 0 20px 54px rgba(0,7,18,0.28), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .garage-parts-header h3 {
          margin: 0 0 16px;
          font-size: 15px;
          font-weight: 900;
          color: #ffffff;
          background: transparent !important;
        }

        .garage-parts-loading,
        .garage-parts-empty {
          color: rgba(226,244,255,0.7);
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
          background:
            linear-gradient(135deg, rgba(10,33,54,0.96), rgba(7,22,37,0.96)) !important;
          border-radius: 14px;
          border: 1px solid rgba(126, 197, 240, 0.22);
          overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
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
          color: #ff7a1a;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .garage-part-title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #f8fbff;
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
          color: #f8fbff;
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

        /* Reference-style Oma Talli surface */
        .garage-page {
          min-height: 100vh;
          padding: 24px 0 84px;
          background: #101c22;
          color: #eef7ff;
        }

        .garage-container {
          max-width: 1180px;
          padding: 0 22px;
        }

        .garage-heading {
          min-height: 218px;
          margin-bottom: 22px;
          padding: 34px 36px;
          border-radius: 24px !important;
          border: 1px solid rgba(71, 112, 153, 0.62) !important;
          background:
            radial-gradient(520px 180px at 78% 0%, rgba(15, 70, 122, 0.24), transparent 70%),
            linear-gradient(135deg, rgba(8, 21, 42, 0.94), rgba(7, 18, 34, 0.96)) !important;
          box-shadow: 0 22px 62px rgba(0, 6, 18, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
          overflow: hidden;
        }

        .garage-heading::before {
          background:
            linear-gradient(90deg, rgba(2, 10, 22, 0.54), transparent 54%),
            radial-gradient(190px 140px at 12% 50%, rgba(255, 118, 18, 0.2), transparent 74%);
          z-index: 1;
        }

        .garage-heading::after {
          content: "";
          position: absolute;
          inset: 0;
          width: auto;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.04), transparent 32%),
            radial-gradient(420px 160px at 88% 0%, rgba(255, 122, 24, 0.1), transparent 70%);
          pointer-events: none;
          z-index: 2;
        }

        .garage-heading-icon {
          width: 88px;
          height: 88px;
          border-radius: 20px !important;
          background: linear-gradient(145deg, rgba(255, 154, 61, 0.22), rgba(13, 29, 46, 0.94)) !important;
          border: 1px solid rgba(255, 138, 28, 0.62) !important;
          color: #ffffff !important;
          box-shadow: 0 0 34px rgba(255, 107, 22, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
          z-index: 5;
        }

        .garage-heading-icon svg {
          width: 42px;
          height: 42px;
          filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.32));
        }

        .garage-heading > div:nth-child(2) {
          position: relative;
          z-index: 5;
          max-width: 520px;
        }

        .garage-heading h1 {
          margin: 0 0 10px;
          color: #ffffff;
          font-size: 46px;
          font-weight: 950;
          line-height: 1;
          letter-spacing: 0;
          text-shadow: 0 16px 38px rgba(0, 6, 18, 0.48);
        }

        .garage-heading p {
          max-width: 430px;
          color: rgba(224, 234, 243, 0.9);
          font-size: 16px;
          font-weight: 800;
          line-height: 1.45;
        }

        .garage-heading-vehicle {
          position: absolute;
          right: 116px;
          bottom: -44px;
          width: 540px;
          max-width: 48%;
          height: auto;
          object-fit: contain;
          filter: saturate(1.05) contrast(1.08) drop-shadow(0 28px 38px rgba(0, 7, 18, 0.58));
          pointer-events: none;
          z-index: 3;
        }

        .garage-heading-stats {
          position: relative;
          z-index: 5;
          min-width: 118px;
          min-height: 58px;
          border-radius: 14px !important;
          border: 1px solid rgba(255, 214, 178, 0.32);
          background: linear-gradient(150deg, rgba(255, 255, 255, 0.16), rgba(48, 36, 44, 0.72));
          backdrop-filter: blur(16px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 18px 42px rgba(0, 6, 18, 0.28);
        }

        .garage-heading-stats span {
          font-size: 28px;
        }

        .garage-heading-stats small {
          color: rgba(239, 246, 252, 0.9);
          font-size: 12px;
          font-weight: 850;
        }

        .garage-toolbar {
          min-height: 94px;
          margin-bottom: 18px;
          padding: 18px 26px 18px 38px;
          border-radius: 22px;
          border: 1px solid rgba(105, 159, 216, 0.33);
          background:
            radial-gradient(520px 180px at 78% 0%, rgba(15, 70, 122, 0.26), transparent 70%),
            linear-gradient(135deg, rgba(8, 21, 42, 0.94), rgba(7, 18, 34, 0.96));
          box-shadow: 0 22px 62px rgba(0, 6, 18, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }

        .garage-toolbar-copy {
          gap: 8px;
          position: relative;
        }

        .garage-toolbar-accent {
          left: -18px;
          top: 2px;
          bottom: 2px;
          width: 4px;
          background: linear-gradient(180deg, #ffad2d, #ff6916);
          box-shadow: 0 0 16px rgba(255, 122, 24, 0.45);
        }

        .garage-toolbar-copy strong {
          color: #ffffff;
          font-size: 22px;
          letter-spacing: 0;
        }

        .garage-toolbar-copy span:last-child {
          color: rgba(205, 218, 232, 0.8);
          font-size: 14px;
        }

        .garage-add-btn {
          min-width: 202px;
          height: 54px;
          padding: 0 0 0 24px;
          justify-content: space-between;
          gap: 16px;
          border-radius: 16px !important;
          border: 1px solid rgba(255, 197, 142, 0.72) !important;
          background: linear-gradient(135deg, #ffab20 0%, #ff7418 42%, #ff4d00 100%) !important;
          box-shadow: 0 0 28px rgba(255, 107, 22, 0.42), 0 18px 40px rgba(255, 107, 22, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.28) !important;
          font-size: 15px;
          font-weight: 950;
          overflow: hidden;
        }

        .garage-add-btn > span {
          flex: 1;
          text-align: center;
        }

        .garage-add-btn-chevron {
          box-sizing: content-box;
          align-self: stretch;
          width: 32px;
          height: auto;
          padding: 0 14px;
          border-left: 1px solid rgba(255, 220, 186, 0.28);
        }

        .garage-vehicles {
          gap: 18px;
        }

        .garage-vehicle-card {
          min-height: 168px;
          padding: 18px 24px 18px 18px;
          border-radius: 22px !important;
          border: 1px solid rgba(255, 122, 24, 0.46) !important;
          background:
            radial-gradient(520px 180px at 78% 0%, rgba(15, 70, 122, 0.22), transparent 70%),
            linear-gradient(135deg, rgba(8, 21, 42, 0.94), rgba(7, 18, 34, 0.96)) !important;
          box-shadow: 0 22px 62px rgba(0, 6, 18, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
          overflow: hidden;
        }

        .garage-vehicle-card::before {
          width: 4px;
          background: linear-gradient(180deg, #ffad2d, #ff6916);
          box-shadow: 0 0 28px rgba(255, 122, 24, 0.68);
          z-index: 2;
        }

        .garage-vehicle-menu {
          position: absolute;
          top: 28px;
          right: 26px;
          color: rgba(180, 199, 220, 0.78);
          z-index: 3;
        }

        .garage-vehicle-info {
          gap: 26px;
          min-width: 0;
        }

        .garage-vehicle-icon {
          width: 210px;
          height: 118px;
          border: 1px solid rgba(126, 197, 240, 0.28) !important;
          border-radius: 16px !important;
          background: #061726 !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05) !important;
          overflow: hidden;
        }

        .garage-vehicle-primary-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          border-radius: 15px;
          filter: saturate(1.07) contrast(1.08);
        }

        .garage-vehicle-details {
          gap: 12px;
          min-width: 0;
        }

        .garage-vehicle-type {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: rgba(190, 202, 220, 0.94) !important;
          font-size: 14px;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        .garage-vehicle-type-mark {
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 15px solid #ff7418;
          filter: drop-shadow(0 0 8px rgba(255, 122, 24, 0.55));
        }

        .garage-vehicle-name {
          color: #ffffff;
          font-size: 34px;
          line-height: 1.02;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .garage-vehicle-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }

        .garage-vehicle-year {
          color: rgba(210, 222, 236, 0.88) !important;
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
        }

        .garage-vehicle-year svg {
          display: none;
        }

        .garage-vehicle-class-tag {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px !important;
          border-radius: 999px !important;
          border: 1px solid rgba(255, 157, 60, 0.46) !important;
          background: rgba(6, 17, 33, 0.56) !important;
          color: #ff9d2e !important;
          font-size: 15px;
          font-weight: 950;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          text-shadow: 0 0 18px rgba(255, 122, 24, 0.24);
        }

        .garage-vehicle-class-tag > span {
          display: none;
        }

        .garage-vehicle-arrow {
          width: 56px;
          height: 56px;
          margin-left: auto;
          margin-right: 22px;
          border-radius: 999px !important;
          border: 1px solid rgba(215, 232, 248, 0.5);
          background: rgba(8, 17, 31, 0.68);
          color: #ffffff;
          box-shadow: 0 0 28px rgba(255, 122, 24, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .garage-vehicle-arrow svg {
          width: 25px;
          height: 25px;
        }

        .garage-vehicle-delete {
          width: 46px;
          height: 46px;
          margin-right: 10px;
          border-radius: 999px !important;
          border: 1px solid rgba(215, 232, 248, 0.42) !important;
          background: rgba(6, 17, 33, 0.72) !important;
          color: rgba(226, 236, 247, 0.9) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
        }

        .garage-vehicle-delete svg {
          width: 19px;
          height: 19px;
        }

        @media (max-width: 960px) {
          .garage-heading {
            min-height: 250px;
            padding: 34px 24px;
          }

          .garage-heading-icon {
            width: 82px;
            height: 82px;
          }

          .garage-heading-icon svg {
            width: 40px;
            height: 40px;
          }

          .garage-heading h1 {
            font-size: 40px;
          }

          .garage-heading p {
            font-size: 16px;
          }

          .garage-heading-vehicle {
            right: -58px;
            bottom: -12px;
            width: 380px;
            max-width: none;
            opacity: 0.62;
          }

          .garage-vehicle-info {
            display: grid;
            grid-template-columns: 156px minmax(0, 1fr) 56px;
            gap: 18px;
          }

          .garage-vehicle-icon {
            width: 156px;
            height: 122px;
          }

          .garage-vehicle-name {
            font-size: 30px;
          }

          .garage-vehicle-year {
            font-size: 18px;
          }

          .garage-vehicle-class-tag {
            font-size: 16px;
          }

          .garage-vehicle-arrow {
            width: 54px;
            height: 54px;
            margin-right: 8px;
          }

          .garage-vehicle-delete {
            width: 50px;
            height: 50px;
          }
        }

        @media (max-width: 640px) {
          .garage-page {
            padding-top: 22px;
          }

          .garage-container {
            padding: 0 14px;
          }

          .garage-heading {
            min-height: 328px;
            grid-template-columns: 72px minmax(0, 1fr);
            gap: 18px;
            padding: 26px 20px;
          }

          .garage-heading h1 {
            font-size: 34px;
          }

          .garage-heading-vehicle {
            right: -94px;
            bottom: -8px;
            width: 370px;
            opacity: 0.54;
          }

          .garage-heading-stats {
            grid-column: 1 / -1;
            width: 100%;
            min-height: 58px;
            grid-template-columns: auto auto;
          }

          .garage-toolbar {
            padding: 24px;
          }

          .garage-add-btn {
            width: 100%;
            min-width: 0;
          }

          .garage-vehicle-card {
            min-height: 0;
            padding: 18px;
          }

          .garage-vehicle-info {
            grid-template-columns: 106px minmax(0, 1fr);
            gap: 14px;
          }

          .garage-vehicle-icon {
            width: 106px;
            height: 94px;
          }

          .garage-vehicle-primary-image {
            border-radius: 14px;
          }

          .garage-vehicle-type {
            font-size: 11px;
          }

          .garage-vehicle-name {
            font-size: 24px;
          }

          .garage-vehicle-year {
            font-size: 16px;
          }

          .garage-vehicle-class-tag {
            font-size: 14px;
            padding: 8px 12px !important;
          }

          .garage-vehicle-arrow {
            grid-column: 1 / -1;
            justify-self: end;
            width: 48px;
            height: 48px;
            margin: 0;
          }

          .garage-vehicle-delete {
            position: absolute;
            right: 18px;
            top: 18px;
            width: 48px;
            height: 48px;
            margin: 0;
            transform: none;
          }
        }
      `}</style>

    </main>
  );
}
