"use client";
import { useState, useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { displayCategoryForVehicle, subcategoryGroups } from "@/lib/listings";
import { useLanguage, translateCategory } from "@/lib/i18n";
import {
  X, ChevronRight, ChevronLeft, Wrench,
  Settings2, Zap, Thermometer, Droplets, Shield, Activity,
  Navigation, Circle, MoreHorizontal, Check,
  Battery, Box, Boxes, Cable, CircleDot, Cog, Component,
  Cylinder, Disc3, Fan, Fuel, Gauge, Layers, Nut, Package, ChevronDown,
  Snowflake, CalendarDays, ListFilter, Search, RotateCcw, BarChart3, Tag, WrenchIcon, CarFront
} from "lucide-react";

/* ── types ─────────────────────────────────────────── */
export type VehicleType = string;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vehicleType: VehicleType | "";
  vehicleSubtype: string;
  brand: string;
  model: string;
  year: string;
  engineCc: string;
  engineModel: string;
  category: string;
  subcategory: string;
  openAtStep?: number;
  onApply: (filters: {
    vehicleType: VehicleType | "";
    vehicleSubtype: string;
    brand: string;
    model: string;
    year: string;
    engineCc: string;
    engineModel: string;
    category: string;
    subcategory: string;
  }) => void;
  vehicleBrands: Record<string, string[]>;
  vehicleCategories: Record<string, Record<string, readonly string[]>>;
  partsCategories: Record<string, readonly string[]>;
}

/* ── icon maps ──────────────────────────────────────── */
const categoryIcons: Record<string, ReactNode> = {
  "Moottori & voimansiirto": <Settings2 size={20} />,
  Moottori:              <Wrench size={20} />,
  Voimansiirto:          <Settings2 size={20} />,
  "Voimansiirron osat":  <Settings2 size={20} />,
  "Alusta & telasto":    <Activity size={20} />,
  Telasto:               <Circle size={20} />,
  "Telaston osat":       <Circle size={20} />,
  Jousitus:              <Activity size={20} />,
  "Jousituksen osat":    <Activity size={20} />,
  "Ohjaus & hallintalaitteet": <Navigation size={20} />,
  Ohjaus:                <Navigation size={20} />,
  "Ohjaus akseli":       <Navigation size={20} />,
  "Ohjauksen osat":      <Navigation size={20} />,
  Sähköjärjestelmät:     <Zap size={20} />,
  Sähkö:                 <Zap size={20} />,
  "Sähkö osat":          <Zap size={20} />,
  "Jäähdytys & polttoaine": <Droplets size={20} />,
  Jäähdytys:             <Thermometer size={20} />,
  Polttoaine:            <Droplets size={20} />,
  Polttoainejärjestelmä: <Droplets size={20} />,
  Pakoputkisto:          <Wrench size={20} />,
  Runko:                 <Shield size={20} />,
  "Runko & katteet":     <Shield size={20} />,
  Jarrut:                <Circle size={20} />,
  Alusta:                <Activity size={20} />,
  Sisusta:               <Shield size={20} />,
  Muut:                  <MoreHorizontal size={20} />,
};

const defaultPartIcon = <Package size={20} />;

const partIcons: Record<string, ReactNode> = {
  "Kokonainen moottori": <Cog size={20} />,
  "Kokonainen voimansiirto": <Settings2 size={20} />,
  Moottorit: <Cog size={20} />,
  Sylinterit: <Cylinder size={20} />,
  "Sylinterin kannet": <Layers size={20} />,
  Männät: <CircleDot size={20} />,
  Kampiakselit: <Gauge size={20} />,
  "Moottorin lohkot": <Box size={20} />,
  "Laakerit & tiivisteet": <Nut size={20} />,
  Kytkimet: <Disc3 size={20} />,
  "Kokonainen kytkin": <Disc3 size={20} />,
  "Kytkin kitit": <Boxes size={20} />,
  Jouset: <Activity size={20} />,
  Painovarret: <Gauge size={20} />,
  Variaattorit: <Disc3 size={20} />,
  "Kokonainen variaattori": <Disc3 size={20} />,
  "Variaattori kitit": <Component size={20} />,
  "Variaattorin hihnat": <Cable size={20} />,
  Ketjukotelot: <Box size={20} />,
  "Ketjut & hihnat": <Cable size={20} />,
  "Kokonainen telasto": <Snowflake size={20} />,
  "Kokonainen alusta": <Activity size={20} />,
  Telasto: <Snowflake size={20} />,
  Etupukit: <Activity size={20} />,
  Takapukit: <Activity size={20} />,
  Liukurungot: <Layers size={20} />,
  "Tela- ja kääntöpyörät": <CircleDot size={20} />,
  Tukivarret: <Navigation size={20} />,
  "Täydellinen tukivarsi sarja": <Navigation size={20} />,
  "Ylä tukivarret oikea": <Navigation size={20} />,
  "Ala tukivarret oikea": <Navigation size={20} />,
  "Ylä tukivarret vasen": <Navigation size={20} />,
  "Ala tukivarret vasen": <Navigation size={20} />,
  "Olka-akselit": <Navigation size={20} />,
  Vetoakselit: <Gauge size={20} />,
  Telamatot: <Layers size={20} />,
  Iskunvaimentimet: <Activity size={20} />,
  "Kokonainen iskunvaimennussarja": <Activity size={20} />,
  Etuiskunvaimentimet: <Activity size={20} />,
  "Telaston iskunvaimentimet": <Activity size={20} />,
  "Kokonainen ohjaus": <Navigation size={20} />,
  Ohjaustangot: <Navigation size={20} />,
  Käsisuojat: <Shield size={20} />,
  "Tangon korokepalat": <Layers size={20} />,
  Kaasukahvat: <Gauge size={20} />,
  Kaasuvaijerit: <Cable size={20} />,
  "Kokonainen jarrujärjestelmä": <CircleDot size={20} />,
  Levyt: <Disc3 size={20} />,
  "Jarrusatulat & letkut": <CircleDot size={20} />,
  "Kahvat & puristimet": <Navigation size={20} />,
  Jarrupalat: <Layers size={20} />,
  Ohjausakselit: <Navigation size={20} />,
  Raidetangot: <Navigation size={20} />,
  "Muut ohjauksen osat": <Package size={20} />,
  Sukset: <Snowflake size={20} />,
  "Kokonainen sukset": <Snowflake size={20} />,
  Ohjainraudat: <Layers size={20} />,
  Suksikumit: <Layers size={20} />,
  "Kokonainen sähköjärjestelmä": <Zap size={20} />,
  "Staattorit & vauhtipyörät": <Disc3 size={20} />,
  Triggerit: <Zap size={20} />,
  Akut: <Battery size={20} />,
  Sytytyspuolat: <Zap size={20} />,
  "ECU & ohjainyksiköt": <Box size={20} />,
  Johtosarjat: <Cable size={20} />,
  Valot: <Zap size={20} />,
  Anturit: <Gauge size={20} />,
  Mittaristot: <Gauge size={20} />,
  "Kytkimet & katkaisijat": <Zap size={20} />,
  "Kokonainen jäähdytysjärjestelmä": <Thermometer size={20} />,
  "Kokonainen polttoainejärjestelmä": <Fuel size={20} />,
  Jäähdyttimet: <Fan size={20} />,
  Vesipumput: <Droplets size={20} />,
  Letkut: <Cable size={20} />,
  Polttoainepumput: <Fuel size={20} />,
  Kaasuttimet: <Fuel size={20} />,
  Ruiskutusjärjestelmät: <Fuel size={20} />,
  "Polttoainesäiliöt & tankit": <Fuel size={20} />,
  "Kokonainen pakoputkisto": <Wrench size={20} />,
  Alkukäyrät: <Wrench size={20} />,
  "Pakosarjat & Y-haarat": <Wrench size={20} />,
  Äänenvaimentimet: <Wrench size={20} />,
  Resonanssiputket: <Wrench size={20} />,
  "Kokonainen runko": <Shield size={20} />,
  "Kokonainen katesarja": <Layers size={20} />,
  Tunnelit: <Shield size={20} />,
  Keskirunko: <Shield size={20} />,
  Eturunko: <Shield size={20} />,
  "Kuomut & konepellit": <Layers size={20} />,
  Sivukatteet: <Layers size={20} />,
  Etupuskurit: <Shield size={20} />,
  Takapuskurit: <Shield size={20} />,
  "Istuimet & penkit": <Box size={20} />,
  Tuulilasit: <Shield size={20} />,
};

function leafName(value: string) {
  return value.split(" / ").map((part) => part.trim()).filter(Boolean).at(-1) ?? value;
}

function normalizeIconText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getCategorySearchText(value: string) {
  const normalized = normalizeIconText(value);
  if (!normalized.includes("telamat")) return normalized;

  return [
    normalized,
    "telamatto tela matto track drivmatta belte",
    "mitta mitat koko leveys levea pituus harjakorkeus harja jako pitch lug",
    "15 16 20 38 381 40 406 41 410 51 154 155 156 163 165 174 175 137 141 144 146"
  ].join(" ");
}

const customTrackMatDimensionValue = "__custom_track_mat_dimension__";

const trackMatDimensionOptions = [
  { cm: "307 cm x 38 cm x 6,4 cm", inch: "121 x 15 x 2.52" },
  { cm: "307 cm x 41 cm x 6,4 cm", inch: "121 x 16 x 2.52" },
  { cm: "325 cm x 38 cm x 6,4 cm", inch: "128 x 15 x 2.52" },
  { cm: "345 cm x 38 cm x 6,4 cm", inch: "136 x 15 x 2.52" },
  { cm: "348 cm x 38 cm x 7,3 cm", inch: "137 x 15 x 2.86" },
  { cm: "358 cm x 38 cm x 6,4 cm", inch: "141 x 15 x 2.52" },
  { cm: "366 cm x 34 cm x 6,4 cm", inch: "144 x 13.5 x 2.52" },
  { cm: "366 cm x 36 cm x 6,4 cm", inch: "144 x 14 x 2.52" },
  { cm: "366 cm x 38 cm x 6,4 cm", inch: "144 x 15 x 2.52" },
  { cm: "371 cm x 38 cm x 7,3 cm", inch: "146 x 15 x 2.86" },
  { cm: "383 cm x 38 cm x 6,4 cm", inch: "151 x 15 x 2.52" },
  { cm: "391 cm x 38 cm x 7,3 cm", inch: "154 x 15 x 2.86" },
  { cm: "391 cm x 41 cm x 7,3 cm", inch: "154 x 16 x 2.86" },
  { cm: "391 cm x 51 cm x 6,4 cm", inch: "154 x 20 x 2.52" },
  { cm: "396 cm x 38 cm x 6,4 cm", inch: "156 x 15 x 2.52" },
  { cm: "396 cm x 41 cm x 6,4 cm", inch: "156 x 16 x 2.52" },
  { cm: "396 cm x 51 cm x 6,4 cm", inch: "156 x 20 x 2.52" },
  { cm: "411 cm x 38 cm x 7,6 cm", inch: "162 x 15 x 3.00" },
  { cm: "414 cm x 41 cm x 7,6 cm", inch: "163 x 16 x 3.00" },
  { cm: "419 cm x 38 cm x 7,6 cm", inch: "165 x 15 x 3.00" },
  { cm: "442 cm x 38 cm x 7,6 cm", inch: "174 x 15 x 3.00" },
  { cm: "445 cm x 38 cm x 7,6 cm", inch: "175 x 15 x 3.00" }
].map((option) => ({
  value: `${option.cm} / ${option.inch}"`,
  label: `${option.cm} / ${option.inch}"`,
  ...option
}));

function isPresetTrackMatDimension(value: string) {
  return trackMatDimensionOptions.some((option) => option.value === value);
}

function isTrackMatContext(...values: string[]) {
  const text = normalizeIconText(values.join(" "));
  return text.includes("telamat") || text.includes("tela matto");
}

function isEngineContext(...values: string[]) {
  const text = normalizeIconText(values.join(" "));
  return text.includes("moottori") || text.includes("engine");
}

function isWheelModelContext(...values: string[]) {
  const text = normalizeIconText(values.join(" "));
  return text.includes("vante") || text.includes("vanne");
}

function isSuspensionModelContext(...values: string[]) {
  const text = normalizeIconText(values.join(" "));
  return (
    text.includes("iskunvaiment") ||
    text.includes("alusta") ||
    text.includes("tukivar") ||
    text.includes("olka aksel") ||
    text.includes("vetoaksel")
  );
}

function getPartDetailLabel(vehicle: string, category: string, group: string, detail: string) {
  if (isEngineContext(category, group, detail)) return "Moottorin tarkempi malli";
  if (isWheelModelContext(detail)) {
    const vehicleKey = getCommonVehicleKey(vehicle);
    if (vehicleKey === "atv") return "Mönkijän vanteen tarkempi malli";
    if (vehicleKey === "motocross") return "Crossin vanteen tarkempi malli";
    if (vehicleKey === "moped") return "Mopon vanteen tarkempi malli";
    return "Vanteen tarkempi malli";
  }
  if (isSuspensionModelContext(group, detail)) {
    if (isEngineContext(category, group, detail)) return "Tarkempi malli";
    if (normalizeIconText([group, detail].join(" ")).includes("iskunvaiment")) {
      return "Iskunvaimentimen tarkempi malli";
    }
    return "Alustan tarkempi malli";
  }
  return "Tarkempi malli";
}

type PartPictureKind =
  | "engine"
  | "drivetrain"
  | "cylinder"
  | "head"
  | "piston"
  | "crank"
  | "block"
  | "bearing"
  | "clutch"
  | "variator"
  | "belt"
  | "wheel"
  | "track"
  | "suspension"
  | "steering"
  | "controls"
  | "brake"
  | "ski"
  | "electric"
  | "battery"
  | "cooling"
  | "fuel"
  | "exhaust"
  | "frame"
  | "body"
  | "seat"
  | "glass"
  | "generic";

function getPartPictureKind(...values: Array<string | undefined>): PartPictureKind {
  const text = normalizeIconText(
    values
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => [value, leafName(value)])
      .join(" ")
  );

  if (text.includes("sylinter") && text.includes("kann")) return "head";
  if (text.includes("sylinter")) return "cylinder";
  if (text.includes("manna") || text.includes("manta")) return "piston";
  if (text.includes("kampiaksel")) return "crank";
  if (text.includes("lohko")) return "block";
  if (text.includes("laaker") || text.includes("tiivist")) return "bearing";
  if (text.includes("variaattor")) return "variator";
  if (text.includes("kytkin") || text.includes("vauhtipyor")) return "clutch";
  if (text.includes("hallintalait") || text.includes("kaasukahva") || text.includes("kaasuvaijeri")) return "controls";
  if (text.includes("hihna") || text.includes("ketju") || text.includes("vaijeri") || text.includes("letku") || text.includes("johtosarja")) return "belt";
  if (text.includes("rengas") || text.includes("renkaat") || text.includes("vanne") || text.includes("vanteet") || text.includes("vanneset")) return "wheel";
  if (text.includes("telasto") || text.includes("telamatto") || text.includes("liukurunko")) return "track";
  if (text.includes("iskunvaim") || text.includes("jous") || text.includes("tukivarsi") || text.includes("olka-aksel") || text.includes("vetoaksel") || text.includes("alusta")) return "suspension";
  if (text.includes("ohjaus") || text.includes("ohjaustanko") || text.includes("raidetanko") || text.includes("kasisuoj") || text.includes("korokepala")) return "steering";
  if (text.includes("jarru") || text.includes("levy") || text.includes("satula")) return "brake";
  if (text.includes("suksi") || text.includes("ohjainrauta") || text.includes("suksikumi")) return "ski";
  if (text.includes("akku")) return "battery";
  if (text.includes("sahko") || text.includes("sytytys") || text.includes("valo") || text.includes("trigger") || text.includes("ecu") || text.includes("anturi") || text.includes("mittar")) return "electric";
  if (text.includes("jaahd") || text.includes("vesipumppu") || text.includes("jaahdytin")) return "cooling";
  if (text.includes("polttoaine") || text.includes("kaasutin") || text.includes("ruiskutus") || text.includes("tankki")) return "fuel";
  if (text.includes("pakoput") || text.includes("alkukayra") || text.includes("pakosarja") || text.includes("aanenvaim") || text.includes("resonanssi")) return "exhaust";
  if (text.includes("istuin") || text.includes("penkki")) return "seat";
  if (text.includes("tuulilasi")) return "glass";
  if (text.includes("kate") || text.includes("kuomu") || text.includes("tunneli") || text.includes("konepelti")) return "body";
  if (text.includes("runko") || text.includes("puskuri")) return "frame";
  if (text.includes("moottori") && text.includes("voimansiirto")) return "engine";
  if (text.includes("voimansiirto")) return "drivetrain";
  if (text.includes("moottori")) return "engine";

  return "generic";
}

function PartPicture({ kind }: { kind: PartPictureKind }) {
  const common = {
    fill: "#071827",
    stroke: "#071827",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 3,
  };

  const shapes: Record<PartPictureKind, ReactNode> = {
    engine: (
      <>
        <rect x="17" y="22" width="30" height="22" rx="4" {...common} fill="none" />
        <path d="M24 22v-6h14v6M47 29h7M10 32h7M24 44v6h18v-6" {...common} fill="none" />
        <circle cx="27" cy="33" r="3" fill="#071827" />
        <circle cx="37" cy="33" r="3" fill="#071827" />
      </>
    ),
    drivetrain: (
      <>
        <circle cx="23" cy="32" r="11" {...common} fill="none" />
        <circle cx="43" cy="32" r="8" {...common} fill="none" />
        <path d="M23 21c10 0 18 4 20 11M23 43c10 0 18-4 20-11" {...common} fill="none" />
      </>
    ),
    cylinder: (
      <>
        <ellipse cx="32" cy="17" rx="13" ry="6" {...common} fill="none" />
        <path d="M19 17v28c0 4 26 4 26 0V17M21 27h22M21 36h22" {...common} fill="none" />
      </>
    ),
    head: (
      <>
        <path d="M18 21h28l5 7-19 12-19-12z" {...common} fill="none" />
        <path d="M18 34l14 9 14-9M18 43l14 9 14-9" {...common} fill="none" />
      </>
    ),
    piston: (
      <>
        <circle cx="32" cy="25" r="11" {...common} fill="none" />
        <path d="M24 25h16M26 34l-6 12M38 34l6 12M20 46h24" {...common} fill="none" />
        <circle cx="32" cy="25" r="3" fill="#071827" />
      </>
    ),
    crank: (
      <>
        <path d="M15 39l11-14 13 14 10-13" {...common} fill="none" />
        <circle cx="15" cy="39" r="5" {...common} fill="none" />
        <circle cx="26" cy="25" r="5" {...common} fill="none" />
        <circle cx="39" cy="39" r="5" {...common} fill="none" />
        <circle cx="49" cy="26" r="5" {...common} fill="none" />
      </>
    ),
    block: (
      <>
        <path d="M18 23l14-8 14 8v18l-14 8-14-8z" {...common} fill="none" />
        <path d="M18 23l14 8 14-8M32 31v18" {...common} fill="none" />
      </>
    ),
    bearing: (
      <>
        <circle cx="32" cy="32" r="17" {...common} fill="none" />
        <circle cx="32" cy="32" r="7" {...common} fill="none" />
        {[0, 60, 120, 180, 240, 300].map((rotation) => (
          <circle key={rotation} cx="32" cy="20" r="3" fill="#071827" transform={`rotate(${rotation} 32 32)`} />
        ))}
      </>
    ),
    clutch: (
      <>
        <circle cx="32" cy="32" r="18" {...common} fill="none" />
        <circle cx="32" cy="32" r="6" fill="#071827" />
        {[0, 72, 144, 216, 288].map((rotation) => (
          <path key={rotation} d="M32 15v10" {...common} transform={`rotate(${rotation} 32 32)`} />
        ))}
      </>
    ),
    variator: (
      <>
        <circle cx="23" cy="32" r="13" {...common} fill="none" />
        <circle cx="43" cy="32" r="13" {...common} fill="none" />
        <circle cx="23" cy="32" r="4" fill="#071827" />
        <circle cx="43" cy="32" r="4" fill="#071827" />
        <path d="M23 19c8 0 13 5 20 0M23 45c8 0 13-5 20 0" {...common} fill="none" />
      </>
    ),
    belt: (
      <>
        <path d="M16 24c5-8 27-8 32 0 5 9-4 20-16 20S11 33 16 24z" {...common} fill="none" />
        <path d="M23 28c4-3 14-3 18 0M21 36c6 4 16 4 22 0" {...common} fill="none" />
      </>
    ),
    track: (
      <>
        <rect x="13" y="23" width="38" height="20" rx="10" {...common} fill="none" />
        {[20, 28, 36, 44].map((x) => (
          <path key={x} d={`M${x} 23v20`} {...common} />
        ))}
      </>
    ),
    wheel: (
      <>
        <circle cx="32" cy="32" r="18" {...common} fill="none" />
        <circle cx="32" cy="32" r="7" {...common} fill="none" />
        {[0, 60, 120, 180, 240, 300].map((rotation) => (
          <path key={rotation} d="M32 14v11" {...common} transform={`rotate(${rotation} 32 32)`} />
        ))}
      </>
    ),
    suspension: (
      <>
        <path d="M18 45l28-28M21 23l20 20" {...common} fill="none" />
        <path d="M25 39l-6-6M31 33l-6-6M37 27l-6-6" {...common} fill="none" />
        <circle cx="18" cy="45" r="4" fill="#071827" />
        <circle cx="46" cy="17" r="4" fill="#071827" />
      </>
    ),
    steering: (
      <>
        <path d="M14 40l36-18-14 34-6-16z" {...common} fill="none" />
        <path d="M30 40l8-7" {...common} fill="none" />
      </>
    ),
    controls: (
      <>
        <rect x="15" y="24" width="34" height="16" rx="8" {...common} fill="none" />
        <circle cx="24" cy="32" r="4" fill="#071827" />
        <path d="M34 28h9M34 36h7" {...common} fill="none" />
      </>
    ),
    brake: (
      <>
        <circle cx="32" cy="32" r="17" {...common} fill="none" />
        <circle cx="32" cy="32" r="5" fill="#071827" />
        <path d="M44 20c8 6 8 18 0 24" {...common} fill="none" />
        <rect x="43" y="26" width="8" height="13" rx="3" fill="#071827" />
      </>
    ),
    ski: (
      <>
        <path d="M14 42c12 5 29 5 38-4M18 38l24-16M36 23l8 10" {...common} fill="none" />
        <path d="M47 37c5 0 8-3 8-7" {...common} fill="none" />
      </>
    ),
    electric: (
      <path d="M36 9L17 35h14l-3 20 19-28H33z" {...common} fill="none" />
    ),
    battery: (
      <>
        <rect x="15" y="24" width="32" height="20" rx="4" {...common} fill="none" />
        <path d="M47 30h4v8h-4M24 34h14M31 27v14" {...common} fill="none" />
      </>
    ),
    cooling: (
      <>
        <circle cx="32" cy="32" r="5" fill="#071827" />
        {[0, 90, 180, 270].map((rotation) => (
          <path key={rotation} d="M32 28c7-11 15-7 13 2-1 6-7 8-13 2" {...common} fill="none" transform={`rotate(${rotation} 32 32)`} />
        ))}
      </>
    ),
    fuel: (
      <>
        <path d="M32 11c10 13 15 21 15 29 0 8-6 13-15 13s-15-5-15-13c0-8 5-16 15-29z" {...common} fill="none" />
        <path d="M27 39c3 4 8 4 12 0" {...common} fill="none" />
      </>
    ),
    exhaust: (
      <>
        <path d="M14 39h20c9 0 13-6 16-16M34 39l6 9H18l-4-9M48 22l6-5" {...common} fill="none" />
        <path d="M49 17c4-3 7-3 9-1" {...common} fill="none" />
      </>
    ),
    frame: (
      <>
        <path d="M32 12l18 8v13c0 11-8 18-18 21-10-3-18-10-18-21V20z" {...common} fill="none" />
        <path d="M24 35h16M32 24v22" {...common} fill="none" />
      </>
    ),
    body: (
      <>
        <path d="M15 39l8-18h24l4 18z" {...common} fill="none" />
        <path d="M23 21l8 18M40 21l-4 18M17 47h32" {...common} fill="none" />
      </>
    ),
    seat: (
      <>
        <path d="M13 40c12-13 24-15 38-8 0 7-5 11-14 11H18c-4 0-6-1-5-3z" {...common} fill="none" />
        <path d="M24 44v6M45 40v8" {...common} fill="none" />
      </>
    ),
    glass: (
      <>
        <path d="M22 13h25l-8 39H15z" {...common} fill="none" />
        <path d="M25 21h14M22 32h17" {...common} fill="none" />
      </>
    ),
    generic: (
      <>
        <path d="M18 25l14-8 14 8v17l-14 8-14-8z" {...common} fill="none" />
        <path d="M18 25l14 8 14-8" {...common} fill="none" />
      </>
    ),
  };

  return (
    <svg className={`cd-part-picture cd-part-picture-${kind}`} viewBox="0 0 76 58" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cdPartCase" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#304457" />
          <stop offset="0.5" stopColor="#172c3e" />
          <stop offset="1" stopColor="#071827" />
        </linearGradient>
        <linearGradient id="cdPartSteel" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f1f5f8" />
          <stop offset="0.28" stopColor="#aeb9c4" />
          <stop offset="0.58" stopColor="#667889" />
          <stop offset="1" stopColor="#d7e0e8" />
        </linearGradient>
        <linearGradient id="cdPartSheen" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.58" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="cdPartDrop" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#000916" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="1.5" y="1.5" width="73" height="55" rx="11" fill="#061522" />
      <rect x="4.5" y="4.5" width="67" height="49" rx="8" fill="url(#cdPartCase)" />
      <path d="M8 12c16-7 39-8 60 2v17C48 24 26 27 8 38z" fill="url(#cdPartSheen)" opacity="0.72" />
      <path d="M7 47c15-7 38-8 61-1" fill="none" stroke="#d7e0e8" strokeOpacity="0.18" strokeWidth="2" />
      <g opacity="0.2" stroke="#d7e0e8" strokeWidth="1">
        <path d="M12 18h14M46 15h14M15 42h10M52 39h10" />
        <circle cx="18" cy="30" r="1.2" fill="#d7e0e8" />
        <circle cx="58" cy="27" r="1.2" fill="#d7e0e8" />
      </g>
      <g className="cd-part-shadow" transform="translate(10 5) scale(.84) translate(2 3)">
        {shapes[kind]}
      </g>
      <g className="cd-part-main" transform="translate(10 5) scale(.84)" filter="url(#cdPartDrop)">
        {shapes[kind]}
      </g>
      <rect x="4.5" y="4.5" width="67" height="49" rx="8" fill="none" stroke="rgba(255,255,255,.24)" strokeWidth="1" />
      <rect x="1.5" y="1.5" width="73" height="55" rx="11" fill="none" stroke="rgba(203,213,225,.38)" strokeWidth="1.5" />
    </svg>
  );
}

function getPartIcon(...values: Array<string | undefined>) {
  return <PartPicture kind={getPartPictureKind(...values)} />;

  const candidates = values
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => [value, leafName(value)]);

  for (const candidate of candidates) {
    const directIcon = partIcons[candidate] ?? categoryIcons[candidate];
    if (directIcon) return directIcon;
  }

  const text = normalizeIconText(candidates.join(" "));

  if (text.includes("sylinter") && text.includes("kann")) return <Layers size={20} />;
  if (text.includes("sylinter")) return <Cylinder size={20} />;
  if (text.includes("manna") || text.includes("manta")) return <CircleDot size={20} />;
  if (text.includes("kampiaksel")) return <Gauge size={20} />;
  if (text.includes("lohko")) return <Box size={20} />;
  if (text.includes("laaker") || text.includes("tiivist") || text.includes("mutter")) return <Nut size={20} />;
  if (text.includes("variaattor") || text.includes("kytkin") || text.includes("levy") || text.includes("vauhtipyor")) return <Disc3 size={20} />;
  if (text.includes("hihna") || text.includes("ketju") || text.includes("vaijeri") || text.includes("letku") || text.includes("johtosarja")) return <Cable size={20} />;
  if (text.includes("telasto") || text.includes("suksi") || text.includes("telamatto")) return <Snowflake size={20} />;
  if (text.includes("tukivarsi") || text.includes("ohjaus") || text.includes("raidetanko") || text.includes("aksel")) return <Navigation size={20} />;
  if (text.includes("jarru")) return <CircleDot size={20} />;
  if (text.includes("akku")) return <Battery size={20} />;
  if (text.includes("sahko") || text.includes("sytytys") || text.includes("valo") || text.includes("trigger")) return <Zap size={20} />;
  if (text.includes("mittar") || text.includes("anturi")) return <Gauge size={20} />;
  if (text.includes("jaahd") || text.includes("vesipumppu")) return <Thermometer size={20} />;
  if (text.includes("polttoaine") || text.includes("kaasutin") || text.includes("ruiskutus")) return <Fuel size={20} />;
  if (text.includes("pakoput") || text.includes("alkukayra") || text.includes("pakosarja") || text.includes("aanenvaim") || text.includes("resonanssi")) return <Wrench size={20} />;
  if (text.includes("runko") || text.includes("puskuri") || text.includes("tuulilasi")) return <Shield size={20} />;
  if (text.includes("kate") || text.includes("kuomu") || text.includes("tunneli")) return <Layers size={20} />;

  return defaultPartIcon;
}

function partPictureClass(...values: Array<string | undefined>) {
  return `cd-thumb-${getPartPictureKind(...values)}`;
}

const mainCategoryPhotoSlugs: Record<string, string> = {
  "Moottori & voimansiirto": "moottori-voimansiirto",
  "Alusta & telasto": "alusta-telasto",
  "Ohjaus & hallintalaitteet": "ohjaus-hallintalaitteet",
  "Sähköjärjestelmät": "sahkojarjestelmat",
  "Jäähdytys & polttoaine": "jaahdytys-polttoaine",
  "Pakoputkisto": "pakoputkisto",
  "Runko & katteet": "runko-katteet",
};

function mainCategoryPhotoClass(category: string): string {
  const slug = mainCategoryPhotoSlugs[category];
  return slug ? `cd-main-${slug}` : "";
}

const subGroupSlugs: Record<string, string> = {
  "Moottorit":             "moottorit",
  "Kytkimet":              "kytkimet",
  "Variaattorit":          "variaattorit",
  "Voimansiirto":          "voimansiirto",
  "Telasto":               "telasto",
  "Alusta":                "alusta",
  "Renkaat & vanteet":     "renkaat-vanteet",
  "Tukivarret":            "tukivarret",
  "Iskunvaimentimet":      "iskunvaimentimet",
  "Ohjaus akseli":         "ohjaus",
  "Hallintalaitteet":      "hallintalaitteet",
  "Jarrut":                "jarrut",
  "Sukset":                "sukset",
  "Sähkö":                 "sahko",
  "Sytytys":               "sytytys",
  "Jäähdytys":             "jaahdytys",
  "Polttoainejärjestelmä": "polttoaine",
  "Pakoputkisto":          "pakoputkisto",
  "Runko":                 "runko",
  "Katteet":               "katteet",
};

function subGroupClass(group: string): string {
  const slug = subGroupSlugs[group];
  return slug ? `cd-subgrp-${slug}` : "";
}

function removeDynamicGroupChild(
  dynamicMap: Map<string, string[]>,
  child: string
) {
  const slashIdx = child.indexOf(" / ");
  if (slashIdx === -1) return;

  const dynamicGroup = child.slice(0, slashIdx).trim();
  const children = dynamicMap.get(dynamicGroup);
  if (!children) return;

  const remaining = children.filter((item) => item !== child);
  if (remaining.length > 0) {
    dynamicMap.set(dynamicGroup, remaining);
  } else {
    dynamicMap.delete(dynamicGroup);
  }
}

/* ── component ──────────────────────────────────────── */
const CC_OPTIONS: Record<string, string[]> = {
  Moottorikelkka: ["250", "300", "400", "440", "500", "550", "600", "650", "700", "800", "850", "900", "1000", "1200+"],
  "Mönkijä":      ["250", "300", "400", "450", "500", "570", "650", "700", "800", "850", "1000", "1200+"],
  Motocross:      ["50", "65", "85", "125", "150", "250", "300", "350", "450", "500"],
  Mopot:          ["50", "65", "80", "90", "100", "110", "125", "150"],
};
const DEFAULT_CC_OPTIONS = ["250", "300", "400", "500", "600", "700", "800", "1000", "1200+"];
const YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() + 1 - 2000 },
  (_, index) => String(new Date().getFullYear() - index)
);

const ENGINE_MODELS: Record<string, Record<string, string[]>> = {
  Moottorikelkka: {
    Lynx:         ["Rotax 440", "Rotax 550F", "Rotax 600 ACE", "Rotax 600 H.O.", "Rotax 600 E-TEC", "Rotax 600 H.O. E-TEC", "Rotax 600RS", "Rotax 600R E-TEC", "Rotax 800R E-TEC", "Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo", "Rotax 900 ACE", "Rotax 900 ACE Turbo", "Rotax 900 ACE Turbo R"],
    "Ski-Doo":    ["Rotax 440", "Rotax 550F", "Rotax 600 ACE", "Rotax 600 H.O.", "Rotax 600 E-TEC", "Rotax 600 H.O. E-TEC", "Rotax 600RS", "Rotax 600R E-TEC", "Rotax 650 H.O.", "Rotax 800R E-TEC", "Rotax 850 E-TEC", "Rotax 900 ACE", "Rotax 900 ACE Turbo", "Rotax 900 ACE Turbo R", "Rotax 1200 4-TEC"],
    Polaris:      ["Liberty 440", "Liberty 500", "Liberty 550", "Liberty 600 HO", "Cleanfire 600", "Liberty 700", "Liberty 800", "RMK 800", "Patriot 550", "Patriot 600", "Patriot 600R", "Patriot 650", "Patriot 850", "Patriot Boost"],
    "Arctic Cat": ["500 2-stroke", "600 EFI", "650 H.O.", "700 EFI", "800 H.O.", "C-TEC2 600", "C-TEC2 800", "C-TEC4 1100"],
    Yamaha:       ["Genesis 500", "Genesis 500FI", "Genesis 700", "Genesis 973", "Genesis 1000FI", "VK Professional 500", "FX Nytro 1000", "SRX 1000"]
  },
  "Mönkijä": {
    "Can-Am": ["Rotax 450", "Rotax 570", "Rotax 650", "Rotax 700", "Rotax 800R", "Rotax 850", "Rotax 1000R", "Rotax 1000 DPS"],
    Polaris:  ["Polaris 325", "Polaris 400", "Polaris 450", "Polaris 500", "Polaris 500 H.O.", "Polaris 570", "Polaris 800", "Polaris 850", "Polaris 1000", "Pro Star 570", "Pro Star 850", "Pro Star 1000"],
    Yamaha:   ["Yamaha 350 Bruin", "Yamaha 400 Kodiak", "Yamaha 420 Kodiak", "Yamaha 450 Kodiak", "Yamaha 550 Grizzly", "Yamaha 660 Grizzly", "Yamaha 700 Grizzly", "Yamaha 700 EPS", "Yamaha 700 Kodiak EPS"],
    Honda:    ["TRX 250 Recon", "TRX 300", "TRX 400 Rancher", "TRX 420 Rancher", "TRX 500 Foreman", "TRX 500 Rubicon", "TRX 680 Rincon", "TRX 700XX"],
    CFMOTO:   ["CFMoto 400", "CFMoto 500", "CFMoto 520", "CFMoto 625", "CFMoto 800", "CFMoto 850", "CFMoto 1000"]
  },
  Motocross: {
    KTM:       ["SX 50", "SX 65", "SX 85", "SX 125", "SX 150", "SX 250", "SXF 250", "SXF 350", "SXF 450", "EXC 125", "EXC 200", "EXC 250", "EXC 300", "EXC-F 250", "EXC-F 350", "EXC-F 450", "EXC-F 500"],
    Yamaha:    ["YZ 65", "YZ 85", "YZ 125", "YZ 250", "YZ 250X", "YZ250F", "YZ450F", "WR250F", "WR450F"],
    Honda:     ["CRF 50", "CRF 80", "CRF 100", "CR 125R", "CR 250R", "CRF 150R", "CRF 250R", "CRF 450R", "CRF 250RX", "CRF 450RX"],
    Kawasaki:  ["KX 65", "KX 85", "KX 112", "KX 125", "KX 250", "KX 250F", "KX 450", "KX 450X"],
    Husqvarna: ["TC 50", "TC 65", "TC 85", "TC 125", "FC 250", "FC 350", "FC 450", "TE 150", "TE 250", "TE 300", "FE 250", "FE 350", "FE 450", "FE 501"],
    Suzuki:    ["RM 85", "RM 125", "RM 250", "RMZ 250", "RMZ 450"],
    GasGas:    ["MC 50", "MC 65", "MC 85", "MC 125", "MC 250F", "MC 350F", "MC 450F", "EC 250F", "EC 350F", "EC 450F"],
    Beta:      ["RR 125", "RR 200", "RR 250", "RR 300", "RR 350", "RR 390", "RR 430", "RR 480", "RR 498", "RX 300", "RX 450"],
    Sherco:    ["125 SE-R", "250 SE-R", "300 SE-R", "250 SE-F", "300 SE-F", "450 SE-F", "500 SE-F"],
    TM:        ["MX 85", "MX 125", "MX 144", "MX 250", "MX 300", "MX 450F", "MX 530F", "EN 300"]
  },
  Mopot: {
    Yamaha:  ["Minarelli AM6 (DT 50 R, TZR 50)", "Yamaha 2-tahti 80cc (DT 80, RD 80)", "Minarelli Pysty \u2013 Vertical skootteri (BW's, Slider, MBK Booster, Stunt)", "Minarelli Vaaka \u2013 Horizontal skootteri (Aerox, Jog, Neo's, MBK Nitro, Ovetto)", "4-tahti 125cc (Xenter 125, WR125)"],
    Honda:   ["Honda 2-tahti (NSR 50, MB 80)", "Honda 4-tahti skootteri (Dio, SH 50, Zoomer, Vision)", "Honda 4-tahti 125cc (MSX 125, PCX 125, CBF 125)"],
    Derbi:   ["Minarelli AM6 (GPR 50 -2005, Senda SM/DRD -2005)", "Derbi D50B0 (Senda 50 2006+, GPR 50 2006+)", "Minarelli Vaaka \u2013 Horizontal skootteri (Vamos 50)", "4-tahti 125cc (Mulhacen 125, Terra 125)"],
    Rieju:   ["Minarelli AM6 (RS1, RS2, RS3, MRT, RR, RRX, Spike, Marathon)"],
    KTM:     ["KTM 2-tahti mini (SX 50, SX 65)", "4-tahti 125cc (Duke 125, RC 125, Duke 200)"],
    Aprilia: ["Minarelli AM6 (RS 50 -2005, RX 50 -2005, MX 50)", "Derbi D50B0 (RS 50 2006+, RX 50 2006+, SX 50, RS4 50)", "Minarelli Vaaka \u2013 Horizontal skootteri (SR 50 R, Scarabeo 50)", "4-tahti 125cc (RS4 125, RS 125)"]
  }
};

const MODEL_ENGINE_OPTIONS: Record<string, Record<string, Record<string, string[]>>> = {
  Moottorikelkka: {
    Lynx: {
      "Rave RS": ["Rotax 600RS", "Rotax 600 E-TEC"],
      "Rave Racing": ["Rotax 600RS", "Rotax 600 E-TEC"],
      Rave: ["Rotax 550F", "Rotax 600 H.O.", "Rotax 600 E-TEC", "Rotax 850 E-TEC"],
      Shredder: ["Rotax 600R E-TEC", "Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo"],
      Commander: ["Rotax 600 ACE", "Rotax 600 E-TEC", "Rotax 900 ACE"],
      BoonDocker: ["Rotax 600 E-TEC", "Rotax 800R E-TEC", "Rotax 850 E-TEC"],
      Xterrain: ["Rotax 600R E-TEC", "Rotax 850 E-TEC", "Rotax 900 ACE Turbo"],
      Xtrim: ["Rotax 600 ACE", "Rotax 600 E-TEC", "Rotax 850 E-TEC"],
      Adventure: ["Rotax 600 ACE", "Rotax 900 ACE"],
      Ranger: ["Rotax 550F", "Rotax 600 ACE", "Rotax 900 ACE"],
      Yeti: ["Rotax 550F", "Rotax 600 ACE"],
      Spirit: ["Rotax 550F", "Rotax 600 ACE"]
    },
    "Ski-Doo": {
      "MXZ RS": ["Rotax 600RS", "Rotax 600R E-TEC"],
      MXZ: ["Rotax 600 ACE", "Rotax 600 E-TEC", "Rotax 850 E-TEC"],
      Freeride: ["Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo"],
      Summit: ["Rotax 600R E-TEC", "Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo"],
      Backcountry: ["Rotax 600R E-TEC", "Rotax 850 E-TEC"],
      Renegade: ["Rotax 600 ACE", "Rotax 600 E-TEC", "Rotax 900 ACE Turbo"],
      Expedition: ["Rotax 600 ACE", "Rotax 900 ACE", "Rotax 900 ACE Turbo"],
      Tundra: ["Rotax 550F", "Rotax 600 ACE"],
      Skandic: ["Rotax 550F", "Rotax 600 ACE", "Rotax 900 ACE"]
    },
    Polaris: {
      IQR: ["Liberty 440", "Liberty 600 HO"],
      "600R": ["Patriot 600R"],
      XCR: ["Patriot 600", "Patriot 650", "Patriot 850"],
      "Indy XC": ["Patriot 550", "Patriot 600", "Patriot 650"],
      RMK: ["Patriot 600", "Patriot 650", "Patriot 850", "Patriot Boost"],
      Switchback: ["Liberty 600", "Patriot 650", "Patriot 850"]
    },
    "Arctic Cat": {
      "ZR 600 R-XC": ["C-TEC2 600"],
      "ZR 6000 R XC": ["C-TEC2 600"],
      ZR: ["600 EFI", "C-TEC2 600", "C-TEC2 800"],
      "M-Series": ["800 H.O.", "C-TEC2 800"],
      "F-Series": ["500 2-stroke", "600 EFI", "700 EFI", "800 H.O."]
    }
  },
  "Mönkijä": {
    "Can-Am": {
      Outlander: ["Rotax 450", "Rotax 570", "Rotax 650", "Rotax 850", "Rotax 1000R"],
      Renegade: ["Rotax 570", "Rotax 850", "Rotax 1000R"],
      Commander: ["Rotax 700", "Rotax 800R", "Rotax 1000R"],
      Defender: ["Rotax 650", "Rotax 850", "Rotax 1000 DPS"],
      Maverick: ["Rotax 1000R", "Rotax 1000 DPS"]
    },
    Polaris: {
      Sportsman: ["Polaris 450", "Polaris 500", "Polaris 570", "Polaris 850", "Polaris 1000"],
      RZR: ["Pro Star 570", "Pro Star 850", "Pro Star 1000"],
      Ranger: ["Polaris 500", "Polaris 570", "Polaris 1000"],
      Scrambler: ["Polaris 850", "Polaris 1000"]
    },
    Yamaha: {
      Grizzly: ["Yamaha 550 Grizzly", "Yamaha 660 Grizzly", "Yamaha 700 Grizzly"],
      Kodiak: ["Yamaha 400 Kodiak", "Yamaha 420 Kodiak", "Yamaha 450 Kodiak", "Yamaha 700 Kodiak EPS"],
      Raptor: ["Yamaha 350 Bruin", "Yamaha 700 Grizzly"],
      YFZ: ["Yamaha 450 Kodiak"]
    }
  },
  Motocross: {
    KTM: {
      SX: ["2-tahti", "4-tahti"],
      "SX-F": ["4-tahti", "EFI"],
      EXC: ["2-tahti", "TPI"],
      "EXC-F": ["4-tahti", "EFI"]
    },
    Yamaha: {
      YZ: ["2-tahti"],
      YZF: ["4-tahti", "EFI"],
      WR: ["4-tahti", "EFI"]
    },
    Honda: {
      CR: ["2-tahti"],
      CRF: ["4-tahti", "EFI"]
    }
  },
  Mopot: {
    Yamaha: {
      "DT 50": ["Minarelli AM6 (DT 50 R, TZR 50)"],
      "DT 50 R": ["Minarelli AM6 (DT 50 R, TZR 50)"],
      Aerox: ["Minarelli Vaaka – Horizontal skootteri (Aerox, Jog, Neo's, MBK Nitro, Ovetto)"],
      Slider: ["Minarelli Pysty – Vertical skootteri (BW's, Slider, MBK Booster, Stunt)"],
      Jog: ["Minarelli Vaaka – Horizontal skootteri (Aerox, Jog, Neo's, MBK Nitro, Ovetto)"]
    },
    Derbi: {
      Senda: ["Derbi D50B0 (Senda 50 2006+, GPR 50 2006+)", "Minarelli AM6 (GPR 50 -2005, Senda SM/DRD -2005)"],
      GPR: ["Derbi D50B0 (Senda 50 2006+, GPR 50 2006+)", "Minarelli AM6 (GPR 50 -2005, Senda SM/DRD -2005)"]
    },
    Rieju: {
      MRT: ["Minarelli AM6 (RS1, RS2, RS3, MRT, RR, RRX, Spike, Marathon)"],
      RS2: ["Minarelli AM6 (RS1, RS2, RS3, MRT, RR, RRX, Spike, Marathon)"]
    }
  }
};

const CUSTOM_OPTION_LABEL = "Muu (kirjoita itse)";

function uniqueOptions(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

const VEHICLE_SUBTYPE_OPTIONS: Record<string, string[]> = {
  Moottorikelkka: [
    "Crossover - moottorikelkka",
    "Deep snow - moottorikelkka",
    "Sport - moottorikelkka",
    "Touring - moottorikelkka",
    "Työ - moottorikelkka",
    "Watercross - moottorikelkka"
  ],
  "Mönkijä": [
    "ATV - mönkijä",
    "UTV - mönkijä",
    "Sport - mönkijä",
    "Työ - mönkijä",
    "Maasto - mönkijä",
    "6x6 - mönkijä",
    "Lasten - mönkijä"
  ],
  Motocross: [
    "Motocross - crossi",
    "Enduro - crossi",
    "Supermoto - crossi",
    "Trial - crossi",
    "Pitbike - crossi",
    "Minicross - crossi"
  ],
  Mopot: [
    "Mopo - mopo",
    "Skootteri - mopo",
    "Supermoto - mopo",
    "Enduro - mopo",
    "Manki / monkey - mopo",
    "Piikki 125 - mopo"
  ],
  Mopo: [
    "Mopo - mopo",
    "Skootteri - mopo",
    "Supermoto - mopo",
    "Enduro - mopo",
    "Manki / monkey - mopo",
    "Piikki 125 - mopo"
  ]
};

function customValue(value: string) {
  return value === CUSTOM_OPTION_LABEL ? "" : value;
}

function getCategoryVehicleKey(vehicle: string) {
  return vehicle === "Mopot" ? "Mopo" : vehicle;
}

function getCommonVehicleKey(vehicle: string) {
  const normalized = normalizeIconText(vehicle);
  if (normalized.includes("moottorikelkka")) return "snowmobile";
  if (normalized.includes("monkija") || normalized.includes("nkij")) return "atv";
  if (normalized.includes("motocross")) return "motocross";
  if (normalized.includes("mopo")) return "moped";
  return normalized;
}

function getBrandModelOptions(vehicle: string, brand: string) {
  const vehicleKey = getCategoryVehicleKey(vehicle);
  const commonVehicleKey = getCommonVehicleKey(vehicle);
  if (!vehicle) {
    const localModels = Object.values(BRAND_MODELS).flatMap((modelsByBrand) => modelsByBrand[brand] ?? []);
    const commonModels = Object.values(COMMON_BRAND_MODELS_BY_VEHICLE).flatMap((modelsByBrand) => modelsByBrand[brand] ?? []);
    return uniqueOptions([...localModels, ...commonModels]);
  }

  const localModels = BRAND_MODELS[vehicle]?.[brand] ?? BRAND_MODELS[vehicleKey]?.[brand] ?? [];
  const commonModels = COMMON_BRAND_MODELS_BY_VEHICLE[commonVehicleKey]?.[brand] ?? [];
  return uniqueOptions([...localModels, ...commonModels]);
}

function getModelEngineOptions(
  vehicle: string,
  brand: string,
  model: string,
  fallback: string[]
) {
  const vehicleKey = getCategoryVehicleKey(vehicle);
  const commonVehicleKey = getCommonVehicleKey(vehicle);
  const brandModelEngines = MODEL_ENGINE_OPTIONS[vehicle]?.[brand] ?? MODEL_ENGINE_OPTIONS[vehicleKey]?.[brand];
  const commonBrandModelEngines = COMMON_MODEL_ENGINES_BY_VEHICLE[commonVehicleKey]?.[brand];
  if (model && (brandModelEngines || commonBrandModelEngines)) {
    const exact = brandModelEngines?.[model];
    const commonExact = commonBrandModelEngines?.[model];
    if (exact?.length || commonExact?.length) return uniqueOptions([...(exact ?? []), ...(commonExact ?? [])]);

    const normalizedModel = normalizeIconText(model);
    const fuzzy = Object.entries(brandModelEngines ?? {}).find(([key]) => {
      const normalizedKey = normalizeIconText(key);
      return normalizedModel.includes(normalizedKey) || normalizedKey.includes(normalizedModel);
    });
    const commonFuzzy = Object.entries(commonBrandModelEngines ?? {}).find(([key]) => {
      const normalizedKey = normalizeIconText(key);
      return normalizedModel.includes(normalizedKey) || normalizedKey.includes(normalizedModel);
    });
    if (fuzzy?.[1]?.length || commonFuzzy?.[1]?.length) {
      return uniqueOptions([...(fuzzy?.[1] ?? []), ...(commonFuzzy?.[1] ?? [])]);
    }
  }

  const commonBrandFallback = commonBrandModelEngines ? Object.values(commonBrandModelEngines).flat() : [];
  return uniqueOptions([...commonBrandFallback, ...fallback]);
}

type CategoryStartKind = string;

const BRAND_MODELS: Record<string, Record<string, string[]>> = {
  Moottorikelkka: {
    "Lynx":       ["Rave RS", "Rave Racing", "Rave", "Shredder", "Commander", "BoonDocker", "Xterrain", "Xtrim", "Adventure", "Ranger", "Yeti", "Spirit"],
    "Ski-Doo":    ["MXZ RS", "MXZ", "Freeride", "Summit", "Backcountry", "Renegade", "Expedition", "Tundra", "Skandic", "Grand Touring", "Enduro"],
    "Polaris":    ["IQR", "600R", "XCR", "Indy XC", "Indy", "Rush", "RMK", "Switchback", "Titan", "Voyageur", "Patriot", "Pro-RMK"],
    "Arctic Cat": ["ZR 600 R-XC", "ZR 6000 R XC", "ZR", "M-Series", "XF", "F-Series", "Pantera", "Bearcat", "Wildcat", "Norseman"],
  },
  "Mönkijä": {
    "Can-Am":  ["Outlander", "Renegade", "Commander", "Defender", "Maverick", "DS"],
    "Polaris": ["Sportsman", "RZR", "Ranger", "General", "Scrambler", "ACE"],
    "Yamaha":  ["Grizzly", "Kodiak", "Raptor", "Viking", "YFZ", "Wolverine", "Banshee"],
    "Honda":   ["FourTrax", "Foreman", "Rancher", "Rincon", "Pioneer", "Talon", "TRX"],
    "CFMOTO": ["CForce", "UForce", "ZForce", "600", "800", "1000"],
  },
  Motocross: {
    "KTM":       ["SX", "SX-F", "EXC", "EXC-F", "XC", "XC-W", "SMR", "Freeride"],
    "Husqvarna": ["TC", "FC", "TE", "FE", "TX", "FX", "FS"],
    "Honda":     ["CRF", "CR", "CRF250R", "CRF450R", "CRF250RX", "CRF450RX"],
    "Yamaha":    ["YZ", "YZF", "WR", "WRF", "YZ250F", "YZ450F"],
    "Kawasaki":  ["KX", "KXF", "KX250", "KX450", "KX250F"],
    "Suzuki":    ["RM", "RMZ", "RM-Z250", "RM-Z450"],
    "GasGas":    ["MC", "EC", "EX", "MC 125", "MC 250F", "MC 450F"],
    "Beta":      ["RR", "RX", "Xtrainer", "RR 125", "RR 250", "RR 300"],
    "Sherco":    ["SE", "SEF", "SE 250", "SE 300", "SEF 300", "SEF 450"],
    "TM":        ["MX", "EN", "MX 125", "MX 250F", "MX 450F"],
  },
  Mopot: {
    "Yamaha":  ["BWS Naked", "BWS Original", "Zuma", "BWS Next Generation", "BWS 10", "BWS 12", "Aerox", "Slider", "Jog", "Neos", "DT 50", "DT 50 R", "DT 50 MX", "DT 80", "TZR 50"],
    "Honda":   ["SH", "PCX", "Zoomer", "Dio", "Lead", "Vision"],
    "KTM":     ["Duke 125", "RC 125"],
    "Derbi":   ["Senda", "GPR", "Variant", "Atlantis"],
    "Rieju":   ["MRT", "Tango", "RS2", "RRX", "Century"],
    "Aprilia": ["SR", "Scarabeo", "RS 125", "RX 125", "SX 125"],
  },
};

const COMMON_BRAND_MODELS_BY_VEHICLE: Record<string, Record<string, string[]>> = {
  snowmobile: {
    Lynx: ["Rave RS", "Rave Racing", "Rave", "Rave RE", "Xtrim", "Xterrain", "Boondocker", "Shredder", "Commander", "Adventure", "49 Ranger", "69 Ranger", "Yeti", "GLX"],
    "Ski-Doo": ["MXZ RS", "MXZ", "MXZ X-RS", "Summit", "Freeride", "Renegade", "Backcountry", "Expedition", "Skandic", "Tundra", "Grand Touring", "Formula", "Mach Z"],
    Polaris: ["IQR", "600R", "XCR", "Indy XC", "Indy", "Indy VR1", "RMK", "Pro RMK", "SKS", "Switchback", "Voyageur", "Titan", "Matryx", "Rush", "Assault", "Widetrak"],
    "Arctic Cat": ["ZR 600 R-XC", "ZR 6000 R XC", "ZR", "ZR 600", "M", "M 8000", "Riot", "Norseman", "Pantera", "Blast", "Bearcat", "Thundercat", "F", "Crossfire"],
    Yamaha: ["SR Viper", "Sidewinder", "Apex", "Nytro", "Phazer", "Venture", "Viking", "RS Vector", "RX-1"],
    Taiga: ["Nomad", "Ekko", "Atlas"]
  },
  atv: {
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
  motocross: {
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
  moped: {
    Yamaha: ["BWS Naked", "BWS Original", "Zuma", "BWS Next Generation", "BWS 10", "BWS 12", "DT", "Aerox", "Jog", "Slider", "Neos", "TZR", "WR", "Why"],
    MBK: ["Booster Naked", "Booster Spirit 10", "Booster Spirit 12", "Booster Next Generation", "Nitro", "Ovetto", "X-Limit", "Stunt", "Rocket"],
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

const COMMON_MODEL_ENGINES_BY_VEHICLE: Record<string, Record<string, Record<string, string[]>>> = {
  snowmobile: {
    Yamaha: {
      "SR Viper": ["Yamaha Genesis 1049"],
      Sidewinder: ["Yamaha Genesis 998 Turbo"],
      Apex: ["Yamaha Genesis 998"],
      Nytro: ["Yamaha Genesis 1049"],
      Phazer: ["Yamaha 499 twin"],
      Venture: ["Yamaha Genesis 1049", "Yamaha 499 twin"],
      Viking: ["Yamaha 540 fan", "Yamaha Genesis 1049"],
      "RS Vector": ["Yamaha Genesis 973"],
      "RX-1": ["Yamaha Genesis 998"]
    },
    Taiga: {
      Nomad: ["Sähkö"],
      Ekko: ["Sähkö"],
      Atlas: ["Sähkö"]
    }
  },
  moped: {
    Yamaha: {
      DT: ["Minarelli AM6"],
      Aerox: ["Minarelli horizontal AC", "Minarelli horizontal LC"],
      "BWS Naked": ["Minarelli vertical AC"],
      "BWS Original": ["Minarelli vertical AC"],
      Zuma: ["Minarelli vertical AC"],
      "BWS Next Generation": ["Minarelli vertical AC"],
      "BWS 10": ["Minarelli vertical AC"],
      "BWS 12": ["Minarelli vertical AC"],
      "BW's": ["Minarelli vertical AC"],
      BWS: ["Minarelli vertical AC"],
      Booster: ["Minarelli vertical AC"],
      Jog: ["Minarelli horizontal AC", "Minarelli vertical AC"],
      Slider: ["Minarelli vertical AC"],
      Neos: ["Minarelli horizontal AC"],
      TZR: ["Minarelli AM6"],
      WR: ["Minarelli AM6"],
      Why: ["Minarelli horizontal AC"]
    },
    MBK: {
      "Booster Naked": ["Minarelli vertical AC"],
      "Booster Spirit 10": ["Minarelli vertical AC"],
      "Booster Spirit 12": ["Minarelli vertical AC"],
      "Booster Next Generation": ["Minarelli vertical AC"],
      Booster: ["Minarelli vertical AC"],
      Nitro: ["Minarelli horizontal LC"],
      Ovetto: ["Minarelli horizontal AC"],
      "X-Limit": ["Minarelli AM6"],
      Stunt: ["Minarelli vertical AC"],
      Rocket: ["Minarelli vertical AC"]
    },
    Derbi: {
      Senda: ["Derbi D50B0", "Derbi EBS", "Derbi EBE"],
      DRD: ["Derbi D50B0", "Derbi EBS"],
      Xtreme: ["Derbi D50B0", "Derbi EBS"],
      Racing: ["Derbi D50B0", "Derbi EBS"],
      GPR: ["Derbi D50B0", "Derbi EBS", "Derbi EBE"],
      Atlantis: ["Piaggio Hi-Per2", "Derbi EBS"],
      Variant: ["Piaggio Hi-Per2"],
      Terra: ["Derbi D50B0"]
    },
    Rieju: {
      MRT: ["Minarelli AM6"],
      MRX: ["Minarelli AM6"],
      RRX: ["Minarelli AM6"],
      RS: ["Minarelli AM6"],
      RS2: ["Minarelli AM6"],
      SMX: ["Minarelli AM6"],
      Tango: ["Minarelli AM6"],
      Spike: ["Minarelli AM6"]
    },
    Aprilia: {
      SX: ["Derbi D50B0", "Minarelli AM6"],
      RX: ["Derbi D50B0", "Minarelli AM6"],
      RS: ["Derbi D50B0", "Minarelli AM6"],
      SR: ["Piaggio Hi-Per2 AC", "Piaggio Hi-Per2 LC", "Minarelli horizontal AC", "Minarelli horizontal LC", "Morini"],
      Rally: ["Minarelli horizontal AC", "Piaggio Hi-Per2 AC"],
      Sonic: ["Minarelli horizontal AC", "Minarelli horizontal LC"],
      Mojito: ["Piaggio Hi-Per2 AC"],
      Tuono: ["Minarelli AM6"],
      Pegaso: ["Rotax 655"]
    },
    Peugeot: {
      Speedfight: ["Peugeot horizontal AC", "Peugeot horizontal LC"],
      Trekker: ["Peugeot horizontal AC"],
      Vivacity: ["Peugeot horizontal AC"],
      Ludix: ["Peugeot horizontal AC", "Peugeot horizontal LC"],
      Kisbee: ["Peugeot 4T", "GY6 139QMB"],
      XPS: ["Minarelli AM6"],
      XP6: ["Minarelli AM6"],
      Jetforce: ["Peugeot horizontal LC", "Peugeot TSDI"],
      Elyseo: ["Peugeot horizontal AC"]
    },
    Piaggio: {
      Zip: ["Piaggio Hi-Per2 AC", "Piaggio Hi-Per2 LC", "Piaggio 4T"],
      Typhoon: ["Piaggio Hi-Per2 AC"],
      NRG: ["Piaggio Hi-Per2 LC"],
      Liberty: ["Piaggio Hi-Per2 AC", "Piaggio 4T"],
      Sfera: ["Piaggio Hi-Per2 AC"],
      Fly: ["Piaggio Hi-Per2 AC", "Piaggio 4T"],
      "Vespa Primavera": ["Piaggio Hi-Per2 AC", "Piaggio iGet"],
      "Vespa Sprint": ["Piaggio Hi-Per2 AC", "Piaggio iGet"]
    },
    Gilera: {
      Runner: ["Piaggio Hi-Per2 LC", "Piaggio PureJet"],
      SMT: ["Derbi D50B0"],
      RCR: ["Derbi D50B0"],
      Stalker: ["Piaggio Hi-Per2 AC"],
      DNA: ["Piaggio Hi-Per2 LC"],
      Ice: ["Piaggio Hi-Per2 AC"],
      Storm: ["Piaggio Hi-Per2 AC"]
    },
    Beta: {
      RR: ["Minarelli AM6"],
      "RR Motard": ["Minarelli AM6"],
      Ark: ["Minarelli horizontal AC", "Minarelli horizontal LC"],
      Track: ["Minarelli horizontal AC"],
      Chrono: ["Minarelli horizontal AC"]
    },
    Honda: {
      Monkey: ["Honda horizontal 50", "Honda horizontal 125"],
      Dax: ["Honda horizontal 50", "Honda horizontal 125"],
      MTX: ["Honda AD06", "Honda MTX 80"],
      NSR: ["Honda NSR 50", "Honda NSR 125"],
      Vision: ["Honda AF"],
      Zoomer: ["Honda GET"],
      X8R: ["Honda AF"],
      SFX: ["Honda AF"]
    },
    Kymco: {
      Agility: ["GY6 139QMB", "Kymco 4T"],
      "Super 8": ["GY6 139QMB", "Kymco 2T"],
      People: ["Kymco 2T", "Kymco 4T"],
      Vitality: ["Kymco 2T"],
      Dink: ["Kymco 2T", "Kymco 4T"]
    },
    Keeway: {
      RY6: ["Minarelli horizontal copy AC"],
      "F-Act": ["Minarelli horizontal copy AC"],
      Matrix: ["Minarelli horizontal copy AC"],
      TX: ["Minarelli AM6 copy"],
      "X-Ray": ["Minarelli AM6 copy"]
    },
    CPI: {
      SM: ["Minarelli AM6 copy"],
      SX: ["Minarelli AM6 copy"],
      Oliver: ["Minarelli horizontal copy AC"],
      Aragon: ["Minarelli horizontal copy AC"],
      Popcorn: ["Minarelli horizontal copy AC"]
    },
    Generic: {
      Trigger: ["Minarelli AM6 copy"],
      XOR: ["Minarelli horizontal copy AC"],
      Ideo: ["Minarelli horizontal copy AC"],
      Race: ["Minarelli AM6 copy"]
    },
    Malaguti: {
      F12: ["Minarelli horizontal AC", "Minarelli horizontal LC"],
      F15: ["Minarelli horizontal LC"],
      XSM: ["Minarelli AM6"],
      XTM: ["Minarelli AM6"],
      Phantom: ["Minarelli horizontal AC", "Minarelli horizontal LC"]
    },
    Motorhispania: {
      RYZ: ["Minarelli AM6"],
      Furia: ["Minarelli AM6"],
      RX: ["Minarelli AM6"],
      Duna: ["Minarelli AM6"]
    },
    Sherco: {
      SM: ["Minarelli AM6"],
      SE: ["Minarelli AM6"],
      HRD: ["Minarelli AM6"]
    }
  }
};

function VehicleComboField({
  label,
  icon,
  value,
  options,
  placeholder,
  disabled,
  onChange,
  onOptionSelected,
  inputRef,
  allowCustom = true,
}: {
  label: string;
  icon?: ReactNode;
  value: string;
  options: readonly string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onOptionSelected?: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  allowCustom?: boolean;
}) {
  const comboId = useId();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(true);
  const [customSelected, setCustomSelected] = useState(false);
  const [mobilePickerMode, setMobilePickerMode] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const normalizedValue = normalizeIconText(value);
  const visibleOptions = showAll || !normalizedValue
    ? options
    : options.filter((option) => getCategorySearchText(option).includes(normalizedValue));
  const menuOptions = allowCustom ? uniqueOptions([...visibleOptions, CUSTOM_OPTION_LABEL]) : visibleOptions;
  const showFullMenu = menuOptions.length <= 12;

  useEffect(() => {
    function closeOtherCombos(event: Event) {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (detail?.id !== comboId) setOpen(false);
    }

    window.addEventListener("cd-combo-open", closeOtherCombos);
    return () => window.removeEventListener("cd-combo-open", closeOtherCombos);
  }, [comboId]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const syncMobilePickerMode = () => setMobilePickerMode(media.matches);

    syncMobilePickerMode();
    media.addEventListener("change", syncMobilePickerMode);
    return () => media.removeEventListener("change", syncMobilePickerMode);
  }, []);

  useEffect(() => {
    if (!open || !showFullMenu) return;

    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, showFullMenu]);

  function openMenu(showEveryOption = true) {
    if (disabled) return;
    setShowAll(showEveryOption);
    window.dispatchEvent(new CustomEvent("cd-combo-open", { detail: { id: comboId } }));
    setOpen(true);
  }

  function focusInputForKeyboard() {
    const input = inputRef?.current;
    if (!input) return;

    input.readOnly = false;
    input.focus({ preventScroll: true });

    const valueLength = input.value.length;
    try {
      input.setSelectionRange(valueLength, valueLength);
    } catch {
      /* Some input types do not support text selection. */
    }
  }

  function selectOption(option: string, focusCustomInput = false) {
    const isCustomOption = option === CUSTOM_OPTION_LABEL;
    const nextValue = customValue(option);
    setCustomSelected(isCustomOption);
    onChange(nextValue);
    setShowAll(true);
    setOpen(false);
    if (isCustomOption) {
      if (focusCustomInput) {
        focusInputForKeyboard();
      } else {
        window.setTimeout(focusInputForKeyboard, 60);
      }
    } else {
      onOptionSelected?.(nextValue);
    }
  }

  const inputIsReadOnly = !allowCustom || (mobilePickerMode && !customSelected);

  return (
    <div className="cd-detail-field">
      <label className="cd-field-label">{label}</label>
      <div
        className={`cd-combo-wrap${open ? " cd-combo-open" : ""}${disabled ? " cd-combo-disabled" : ""}`}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget as Node | null;
          if (!nextTarget || !event.currentTarget.contains(nextTarget)) setOpen(false);
        }}
      >
        <div className="cd-combo-control">
          {icon ? <span className="cd-combo-icon" aria-hidden="true">{icon}</span> : null}
          <input
            ref={inputRef}
            className="cd-cc-select cd-combo-input"
            value={value}
            onChange={(event) => {
              setCustomSelected(true);
              onChange(customValue(event.target.value));
              if (!customSelected) openMenu(false);
            }}
            onFocus={() => {
              if (customSelected) {
                setOpen(false);
              } else {
                openMenu(true);
              }
            }}
            readOnly={inputIsReadOnly}
            disabled={disabled}
            placeholder={customSelected ? "Kirjoita itse" : placeholder}
          />
          <button
            className="cd-combo-toggle"
            type="button"
            aria-label={`Avaa ${label.toLowerCase()} vaihtoehdot`}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!disabled) {
                if (open) {
                  setOpen(false);
                } else {
                  openMenu(true);
                }
              }
            }}
          >
            <ChevronDown size={16} />
          </button>
        </div>
        {open && !disabled && (
          <div
            ref={menuRef}
            className="cd-combo-menu"
            data-full-menu={showFullMenu ? "true" : "false"}
            role="listbox"
            tabIndex={-1}
          >
            {menuOptions.map((option) => (
              <button
                key={option}
                className={`cd-combo-option${option === value ? " cd-combo-option-active" : ""}${option === CUSTOM_OPTION_LABEL ? " cd-combo-option-custom" : ""}`}
                type="button"
                onPointerDown={(event) => {
                  if (option !== CUSTOM_OPTION_LABEL || event.pointerType === "mouse") return;
                  selectOption(option, true);
                }}
                onClick={() => selectOption(option, option === CUSTOM_OPTION_LABEL)}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrackMatDimensionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const isPresetValue = isPresetTrackMatDimension(value);
  const isCustomValue = Boolean(value.trim()) && !isPresetValue;
  const [open, setOpen] = useState(false);
  const [customSelected, setCustomSelected] = useState(false);
  const selectValue = isPresetValue ? value : isCustomValue ? customTrackMatDimensionValue : "";
  const selectedOption = trackMatDimensionOptions.find((option) => option.value === selectValue);
  const fieldRef = useRef<HTMLLabelElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isPresetValue) setCustomSelected(false);
  }, [isPresetValue]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      const isMobile = window.matchMedia("(max-width: 760px)").matches;
      const target = isMobile ? fieldRef.current : menuRef.current;
      target?.scrollIntoView({
        block: isMobile ? "center" : "nearest",
        inline: "nearest",
        behavior: "smooth"
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function chooseTrackMatDimension(nextValue: string) {
    setOpen(false);

    if (nextValue === customTrackMatDimensionValue) {
      setCustomSelected(true);
      onChange("");
      return;
    }

    setCustomSelected(false);
    onChange(nextValue);
  }

  return (
    <label
      ref={fieldRef}
      className="cd-extra-field cd-track-mat-field"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) setOpen(false);
      }}
    >
      <span className="cd-extra-label">Telamaton mitat (Pituus x Leveys x Jako)</span>
      <button
        className={`cd-track-mat-select-shell${open ? " is-open" : ""}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="cd-track-mat-icon" aria-hidden="true">
          <Snowflake size={18} />
        </span>
        <span className={`cd-track-mat-value${selectedOption ? "" : " cd-track-mat-value-empty"}`}>
          {selectedOption ? (
            <>
              <strong>{selectedOption.cm}</strong>
              <small>{selectedOption.inch}"</small>
            </>
          ) : (
            <strong>Valitse maton mitta</strong>
          )}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open ? (
        <div ref={menuRef} className="cd-track-mat-menu" role="listbox" tabIndex={-1}>
          {trackMatDimensionOptions.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                className={`cd-track-mat-option${active ? " is-active" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseTrackMatDimension(option.value)}
                role="option"
                aria-selected={active}
              >
                <strong>{option.cm}</strong>
                <span>{option.inch}"</span>
              </button>
            );
          })}
          <button
            type="button"
            className="cd-track-mat-option cd-track-mat-option-custom"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => chooseTrackMatDimension(customTrackMatDimensionValue)}
            role="option"
            aria-selected={customSelected}
          >
            <strong>Muu mitta</strong>
            <span>Kirjoita itse</span>
          </button>
        </div>
      ) : null}
      {(customSelected || isCustomValue) ? (
        <input
          className="cd-extra-input"
          value={isCustomValue ? value : ""}
          onChange={(event) => {
            setCustomSelected(true);
            onChange(event.target.value);
          }}
          placeholder="Kirjoita mitat, esim. 154 x 15 x 2.5"
        />
      ) : null}
    </label>
  );
}

function mergeCategorySources(
  baseCategories: Record<string, readonly string[]>,
  vehicleCategorySources: Record<string, Record<string, readonly string[]>>
) {
  const merged = new Map<string, string[]>();

  function addCategorySource(source: Record<string, readonly string[]>) {
    for (const [categoryName, subcategories] of Object.entries(source)) {
      const existing = merged.get(categoryName) ?? [];
      const next = [...existing];

      for (const subcategory of subcategories) {
        if (!next.includes(subcategory)) next.push(subcategory);
      }

      merged.set(categoryName, next);
    }
  }

  addCategorySource(baseCategories);
  for (const source of Object.values(vehicleCategorySources)) {
    addCategorySource(source);
  }

  return Object.fromEntries(merged.entries()) as Record<string, readonly string[]>;
}

export default function CategoryDrawer({
  isOpen, onClose,
  vehicleType: initVehicle, vehicleSubtype: initVehicleSubtype, brand: initBrand, model: initModel,
  year: initYear, engineCc: initCc, engineModel: initEngineModel, category: initCat, subcategory: initSub,
  openAtStep,
  onApply, vehicleBrands, vehicleCategories, partsCategories,
}: Props) {
  const { locale, t } = useLanguage();
  const [step, setStep]         = useState(3);
  const [vehicle, setVehicle]   = useState<VehicleType | "">(initVehicle);
  const [vehicleSubtype, setVehicleSubtype] = useState(initVehicleSubtype);
  const [brand,   setBrand]     = useState(initBrand);
  const [model,   setModel]     = useState(initModel);
  const [, setModelOpen] = useState(false);
  const [year,    setYear]      = useState(initYear);
  const [engineCc, setEngineCc]             = useState(initCc);
  const [engineCcOther, setEngineCcOther]   = useState("");
  const [engineModel, setEngineModel]       = useState(initEngineModel ?? "");
  const [engineModelOther, setEngineModelOther] = useState("");
  const [trackMatDimension, setTrackMatDimension] = useState("");
  const [partEngineDetail, setPartEngineDetail] = useState("");
  const [vehicleTypeMenuOpen, setVehicleTypeMenuOpen] = useState(false);
  const [vehicleTypeWasSelected, setVehicleTypeWasSelected] = useState(Boolean(initVehicle));
  const [vehicleSubtypeMenuOpen, setVehicleSubtypeMenuOpen] = useState(false);
  const [cat,     setCat]             = useState(initCat);
  const [subGroup, setSubGroup] = useState("");
  const [sub,     setSub]       = useState(initSub);
  const brandInputRef = useRef<HTMLInputElement | null>(null);
  const modelInputRef = useRef<HTMLInputElement | null>(null);
  const yearInputRef = useRef<HTMLInputElement | null>(null);
  const engineCcInputRef = useRef<HTMLInputElement | null>(null);
  const engineModelInputRef = useRef<HTMLInputElement | null>(null);
  const partCategoryInputRef = useRef<HTMLInputElement | null>(null);
  const partGroupInputRef = useRef<HTMLInputElement | null>(null);
  const partLeafInputRef = useRef<HTMLInputElement | null>(null);
  const categoryVehicleMenuAutoOpenedRef = useRef(false);

  function focusVehicleCombo(ref: RefObject<HTMLInputElement | null>) {
    window.setTimeout(() => {
      ref.current?.focus({ preventScroll: true });
    }, 90);
  }

  function openNextVehicleDetail(
    nextField: "brand" | "model" | "year" | "engineCc" | "engineModel" | "parts"
  ) {
    if (nextField === "brand") {
      focusVehicleCombo(brandInputRef);
      return;
    }

    if (nextField === "model") {
      focusVehicleCombo(modelInputRef);
      return;
    }

    if (nextField === "year") {
      focusVehicleCombo(yearInputRef);
      return;
    }

    if (nextField === "engineCc") {
      focusVehicleCombo(engineCcInputRef);
      return;
    }

    if (nextField === "engineModel") {
      if (brand) {
        focusVehicleCombo(engineModelInputRef);
        return;
      }

      window.setTimeout(() => setStep(3), 120);
      return;
    }

    focusPartCombo(partCategoryInputRef);
  }

  function focusPartCombo(ref: RefObject<HTMLInputElement | null>) {
    window.setTimeout(() => {
      ref.current?.focus({ preventScroll: true });
    }, 90);
  }

  useEffect(() => {
    setVehicle(initVehicle);
    setVehicleTypeWasSelected(Boolean(initVehicle));
  }, [initVehicle]);
  useEffect(() => {
    if (isOpen) {
      const requestedStep = openAtStep ?? (initVehicle ? 2 : 3);
      const nextStep = requestedStep < 2 ? 2 : requestedStep;

      setVehicle(initVehicle);
      setVehicleSubtype(initVehicleSubtype);
      setBrand(initBrand);
      setModel(initModel);
      setYear(initYear);
      setEngineCc(initCc);
      setEngineCcOther("");
      setEngineModel(initEngineModel ?? "");
      setEngineModelOther("");
      setVehicleTypeMenuOpen(false);
      setVehicleTypeWasSelected(Boolean(initVehicle));
      setVehicleSubtypeMenuOpen(false);
      categoryVehicleMenuAutoOpenedRef.current = false;
      setModelOpen(false);
      setCat(initCat);
      setSubGroup(resolveSubGroupFor(initCat, initSub));
      setSub(initSub);
      setStep(nextStep);
    }
  }, [isOpen, initVehicle, initVehicleSubtype, initBrand, initModel, initYear, initCc, initEngineModel, initCat, initSub, openAtStep]);

  useEffect(() => {
    if (isOpen && step < 2) setStep(2);
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    setVehicleTypeMenuOpen(false);
    setVehicleSubtypeMenuOpen(false);
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen || step !== 3 || vehicle || categoryVehicleMenuAutoOpenedRef.current) return;

    categoryVehicleMenuAutoOpenedRef.current = true;
    setVehicleTypeMenuOpen(true);
  }, [isOpen, step, vehicle]);

  function closeVehicleTypeMenus() {
    setVehicleTypeMenuOpen(false);
    setVehicleSubtypeMenuOpen(false);
  }

  function clearAllDrawerFilters() {
    setVehicle("");
    setVehicleSubtype("");
    setVehicleTypeWasSelected(false);
    setVehicleTypeMenuOpen(false);
    setVehicleSubtypeMenuOpen(false);
    categoryVehicleMenuAutoOpenedRef.current = false;
    setBrand("");
    setModel("");
    setModelOpen(false);
    setYear("");
    setEngineCc("");
    setEngineCcOther("");
    setEngineModel("");
    setEngineModelOther("");
    setTrackMatDimension("");
    setPartEngineDetail("");
    setCat("");
    setSubGroup("");
    setSub("");
    onApply({
      vehicleType: "",
      vehicleSubtype: "",
      brand: "",
      model: "",
      year: "",
      engineCc: "",
      engineModel: "",
      category: "",
      subcategory: ""
    });
  }

  function apply() {
    const appliedEngineModel = engineModel === "muu"
      ? engineModelOther
      : (engineModel || partEngineDetail);
    onApply({ vehicleType: vehicle, vehicleSubtype, brand, model, year,
      engineCc: engineCc === "muu" ? engineCcOther : engineCc,
      engineModel: appliedEngineModel,
      category: cat, subcategory: sub });
    onClose();
  }

  function applyFinalCategory(nextSub: string, nextSubGroup = subGroup) {
    setSubGroup(nextSubGroup);
    setSub(nextSub);
    if (
      isTrackMatContext(cat, nextSubGroup, nextSub) ||
      isEngineContext(cat, nextSubGroup, nextSub) ||
      isWheelModelContext(nextSub) ||
      isSuspensionModelContext(nextSubGroup, nextSub)
    ) {
      return;
    }
    onApply({
      vehicleType: vehicle,
      vehicleSubtype,
      brand,
      model,
      year,
      engineCc: engineCc === "muu" ? engineCcOther : engineCc,
      engineModel: engineModel === "muu" ? engineModelOther : engineModel,
      category: cat,
      subcategory: nextSub
    });
    onClose();
  }

  function closeDrawer(event?: React.MouseEvent | React.PointerEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    onClose();
  }

  function goBack() {
    if (step === 5) {
      setSub("");
      if (subGroup && currentSubcategoryGroups) {
        setSubGroup("");
        setStep(4);
        return;
      }
      setStep(3);
      return;
    }

    if (step === 4) {
      setCat("");
      setSubGroup("");
      setSub("");
      setStep(3);
      return;
    }

    if (step === 3) {
      setCat("");
      setSubGroup("");
      setSub("");
      setStep(2);
      return;
    }

    setStep(Math.max(vehicle ? 2 : 3, step - 1));
  }

  const cats = vehicle
    ? (vehicleCategories[vehicle as VehicleType] ?? partsCategories)
    : mergeCategorySources(partsCategories, vehicleCategories);
  const engineModelOptions = getModelEngineOptions(
    vehicle,
    brand,
    model,
    brand ? (ENGINE_MODELS[vehicle]?.[brand] ?? []) : []
  );
  const brandOptions = uniqueOptions([
    ...((vehicle ? vehicleBrands[vehicle as VehicleType] : []) ?? []).filter((b) => b !== "Kaikki"),
    ...Object.keys(BRAND_MODELS[vehicle] ?? {}),
    ...Object.keys(BRAND_MODELS[getCategoryVehicleKey(vehicle)] ?? {}),
    ...Object.keys(COMMON_BRAND_MODELS_BY_VEHICLE[getCommonVehicleKey(vehicle)] ?? {}),
    ...(!vehicle ? Object.values(BRAND_MODELS).flatMap((modelsByBrand) => Object.keys(modelsByBrand)) : []),
    ...(!vehicle ? Object.values(COMMON_BRAND_MODELS_BY_VEHICLE).flatMap((modelsByBrand) => Object.keys(modelsByBrand)) : [])
  ]);
  const modelOptions = brand ? getBrandModelOptions(vehicle, brand) : [];

  useEffect(() => {
    if (!engineModel || engineModel === "muu" || engineModelOptions.includes(engineModel)) return;
    setEngineModel("");
    setEngineModelOther("");
  }, [engineModel, engineModelOptions]);

  const subs: readonly string[] = cat ? (cats[cat] ?? []) : [];
  function getFilteredSubcategoryGroups(categoryName: string) {
    const categorySubs = cats[categoryName] ?? [];
    const baseGroups = subcategoryGroups[categoryName];

    // Build dynamic groups by parsing "Group / Leaf" pattern from the
    // dynamic taxonomy data. This ensures admin-added leaves show up even
    // if they aren't in the hardcoded `subcategoryGroups`.
    const dynamicMap = new Map<string, string[]>();
    const standalone: string[] = [];
    for (const sub of categorySubs) {
      const slashIdx = sub.indexOf(" / ");
      if (slashIdx !== -1) {
        const groupName = sub.slice(0, slashIdx).trim();
        const arr = dynamicMap.get(groupName) ?? [];
        arr.push(sub);
        dynamicMap.set(groupName, arr);
      } else {
        standalone.push(sub);
      }
    }

    // Merge with hardcoded order/grouping when available.
    const result: Record<string, string[]> = {};
    if (baseGroups) {
      for (const [group, children] of Object.entries(baseGroups)) {
        const allowedChildren = children.filter((c) => categorySubs.includes(c));
        const dynamicExtras = (dynamicMap.get(group) ?? []).filter(
          (c) => !allowedChildren.includes(c)
        );
        const merged = [...allowedChildren, ...dynamicExtras];
        const isGroupAllowed = children.length === 0 && categorySubs.includes(group);
        if (merged.length > 0) {
          result[group] = merged;
        } else if (isGroupAllowed) {
          result[group] = [];
        }
        for (const child of merged) {
          removeDynamicGroupChild(dynamicMap, child);
        }
        // Mark same-named groups as consumed so leftover dynamic groups don't duplicate.
        dynamicMap.delete(group);
      }
    }
    // Append any remaining dynamic groups not in hardcoded baseGroups.
    for (const [group, children] of dynamicMap.entries()) {
      if (children.length > 0) result[group] = children;
    }
    // Only show standalone leaves on this level for categories without a
    // grouped taxonomy. Grouped categories should first show only real
    // navigation groups; the leaf choices appear after the group is opened.
    if (!baseGroups) {
      for (const leaf of standalone) {
        if (!result[leaf]) result[leaf] = [];
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  function resolveSubGroupFor(categoryName: string, subcategoryName: string) {
    if (!categoryName || !subcategoryName) return "";

    const groups = getFilteredSubcategoryGroups(categoryName);
    if (!groups) return "";

    for (const [groupName, children] of Object.entries(groups)) {
      if (groupName === subcategoryName || children.includes(subcategoryName)) {
        return groupName;
      }
    }

    const slashIdx = subcategoryName.indexOf(" / ");
    return slashIdx === -1 ? "" : subcategoryName.slice(0, slashIdx).trim();
  }

  const startText = {
    fi: {
      title: "Mitä haluat kategorioida?",
      lead: "Valitse ensin ajoneuvoluokka. Sen jälkeen voit rajata merkin, mallin, vuosimallin ja tarkat osat.",
      snowmobiles: "Kelkat, telastot, moottorit",
      atvs: "ATV ja UTV osat",
      motocross: "Crossi ja enduro",
      mopeds: "Mopot ja piikit",
      all: "Selaa kaikkia varaosia"
    },
    en: {
      title: "What do you want to categorize?",
      lead: "Choose the vehicle class first. Then narrow by brand, model, year and exact parts.",
      snowmobiles: "Sleds, tracks, engines",
      atvs: "ATV and UTV parts",
      motocross: "MX and enduro",
      mopeds: "Mopeds and 125cc",
      all: "Browse every part"
    },
    sv: {
      title: "Vad vill du kategorisera?",
      lead: "Välj först fordonsklass. Sedan kan du avgränsa märke, modell, årsmodell och exakta delar.",
      snowmobiles: "Skotrar, boggier, motorer",
      atvs: "ATV- och UTV-delar",
      motocross: "Cross och enduro",
      mopeds: "Mopeder och 125cc",
      all: "Bläddra bland alla delar"
    },
    no: {
      title: "Hva vil du kategorisere?",
      lead: "Velg først kjøretøyklasse. Deretter kan du avgrense merke, modell, årsmodell og eksakte deler.",
      snowmobiles: "Scootere, belter, motorer",
      atvs: "ATV- og UTV-deler",
      motocross: "Cross og enduro",
      mopeds: "Mopeder og 125cc",
      all: "Bla gjennom alle deler"
    },
    et: {
      title: "Mida soovid kategoriseerida?",
      lead: "Vali esmalt sõidukiklass. Seejärel saad täpsustada margi, mudeli, aasta ja osad.",
      snowmobiles: "Saanid, roomikud, mootorid",
      atvs: "ATV ja UTV osad",
      motocross: "Kross ja enduro",
      mopeds: "Mopeedid ja 125cc",
      all: "Sirvi kõiki osi"
    }
  }[locale];
  const startTiles: Array<{
    kind: CategoryStartKind;
    label: string;
    helper: string;
  }> = [
    { kind: "Moottorikelkka", label: t.snowmobiles, helper: startText.snowmobiles },
    { kind: "Mönkijä", label: t.atvs, helper: startText.atvs },
    { kind: "Motocross", label: t.cars, helper: startText.motocross },
    { kind: "Mopot", label: t.mopeds, helper: startText.mopeds },
    { kind: "all", label: t.all, helper: startText.all },
  ];
  const vehicleCrumbLabel = (value: VehicleType) =>
    startTiles.find((tile) => tile.kind === value)?.label ?? value;

  function selectVehicleType(nextKind: CategoryStartKind) {
    const nextVehicle = nextKind === "all" ? "" : (nextKind as VehicleType);
    const hasSubtypeOptions = nextVehicle
      ? (VEHICLE_SUBTYPE_OPTIONS[nextVehicle] ?? []).length > 0
      : false;
    setVehicleTypeMenuOpen(false);
    setVehicleSubtypeMenuOpen(hasSubtypeOptions);
    setVehicleTypeWasSelected(true);
    setVehicle(nextVehicle);
    setBrand("");
    setVehicleSubtype("");
    setModel("");
    setModelOpen(false);
    setYear("");
    setEngineCc("");
    setEngineCcOther("");
    setEngineModel("");
    setEngineModelOther("");
    setCat("");
    setSubGroup("");
    setSub("");
  }

  function renderVehicleTypeMenu() {
    const selectedKind = vehicle || "all";
    const selectedLabel = vehicle
      ? startTiles.find((tile) => tile.kind === selectedKind)?.label ?? t.all
      : vehicleTypeWasSelected
        ? t.all
        : "Ajoneuvotyyppi";

    return (
      <div className={`cd-vehicle-type-menu${vehicleTypeMenuOpen ? " is-open" : ""}`}>
        <span>Ajoneuvo</span>
        <button
          type="button"
          className="cd-vehicle-type-trigger"
          onClick={() => {
            categoryVehicleMenuAutoOpenedRef.current = true;
            setVehicleSubtypeMenuOpen(false);
            setVehicleTypeMenuOpen((open) => !open);
          }}
          aria-haspopup="listbox"
          aria-expanded={vehicleTypeMenuOpen}
        >
          <Snowflake size={21} aria-hidden="true" />
          <strong>{selectedLabel}</strong>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {vehicleTypeMenuOpen && (
          <div
            className="cd-vehicle-type-options"
            role="listbox"
            style={{
              background: "#06182a",
              backgroundColor: "#06182a",
              color: "#ffffff",
              boxShadow: "inset 0 0 0 9999px #06182a, 0 18px 34px rgba(0, 8, 22, 0.44)"
            }}
          >
            {startTiles.map((tile) => {
              const active = tile.kind === selectedKind;
              return (
                <button
                  key={tile.kind}
                  type="button"
                  className={`cd-vehicle-type-option${active ? " is-active" : ""}`}
                  style={{
                    background: active ? "#92c2f1" : "#081f34",
                    backgroundColor: active ? "#92c2f1" : "#081f34",
                    color: active ? "#031326" : "#ffffff"
                  }}
                  onClick={() => selectVehicleType(tile.kind)}
                  role="option"
                  aria-selected={active}
                >
                  {tile.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderVehicleSubtypeMenu() {
    const subtypeOptions = vehicle ? (VEHICLE_SUBTYPE_OPTIONS[vehicle] ?? []) : [];
    const selectedLabel = vehicleSubtype || "Kaikki tyypit";
    const disabled = !vehicle || subtypeOptions.length === 0;

    return (
      <div className={`cd-vehicle-type-menu cd-vehicle-subtype-menu${disabled ? " is-disabled" : ""}`}>
        <span>Tyyppi</span>
        <button
          type="button"
          className="cd-vehicle-type-trigger"
          onClick={() => {
            if (!disabled) {
              setVehicleTypeMenuOpen(false);
              setVehicleSubtypeMenuOpen((open) => !open);
            }
          }}
          aria-haspopup="listbox"
          aria-expanded={vehicleSubtypeMenuOpen}
          disabled={disabled}
        >
          <ListFilter size={21} aria-hidden="true" />
          <strong>{selectedLabel}</strong>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {vehicleSubtypeMenuOpen && !disabled && (
          <div
            className="cd-vehicle-type-options"
            role="listbox"
            style={{
              background: "#06182a",
              backgroundColor: "#06182a",
              color: "#ffffff",
              boxShadow: "inset 0 0 0 9999px #06182a, 0 18px 34px rgba(0, 8, 22, 0.44)"
            }}
          >
            {["", ...subtypeOptions].map((option) => {
              const active = option === vehicleSubtype;
              return (
                <button
                  key={option || "all-subtypes"}
                  type="button"
                  className={`cd-vehicle-type-option${active ? " is-active" : ""}`}
                  style={{
                    background: active ? "#92c2f1" : "#081f34",
                    backgroundColor: active ? "#92c2f1" : "#081f34",
                    color: active ? "#031326" : "#ffffff"
                  }}
                  onClick={() => {
                    setVehicleSubtype(option);
                    setVehicleSubtypeMenuOpen(false);
                  }}
                  role="option"
                  aria-selected={active}
                >
                  {option || "Kaikki tyypit"}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const currentSubcategoryGroups =
    cat ? getFilteredSubcategoryGroups(cat) : null;
  const partCategoryOptions = Object.keys(cats);
  const partGroupOptions = currentSubcategoryGroups ? Object.keys(currentSubcategoryGroups) : [];
  const partLeafOptions = cat
    ? subGroup
      ? (currentSubcategoryGroups?.[subGroup] ?? subs)
      : currentSubcategoryGroups
        ? []
        : subs
    : [];
  const showTrackMatDimensionField = isTrackMatContext(cat, subGroup, sub);
  const showPartDetailField =
    isEngineContext(cat, subGroup, sub) ||
    isWheelModelContext(sub) ||
    isSuspensionModelContext(subGroup, sub);
  const partDetailLabel = getPartDetailLabel(vehicle, cat, subGroup, sub);

  useEffect(() => {
    if (!showTrackMatDimensionField) setTrackMatDimension("");
  }, [showTrackMatDimensionField]);

  useEffect(() => {
    if (!showPartDetailField) setPartEngineDetail("");
  }, [showPartDetailField]);

  function selectPartCategory(nextCategory: string) {
    setCat(nextCategory);
    setSubGroup("");
    setSub("");

    const groups = getFilteredSubcategoryGroups(nextCategory);
    const groupEntries = groups ? Object.entries(groups) : [];
    if (groupEntries.length === 1 && groupEntries[0][0] === nextCategory && groupEntries[0][1].length > 0) {
      setSubGroup(nextCategory);
      return;
    }
  }

  function selectPartGroup(nextGroup: string) {
    const children = currentSubcategoryGroups?.[nextGroup] ?? [];
    if (children.length === 0) {
      applyFinalCategory(nextGroup, "");
      return;
    }

    setSubGroup(nextGroup);
    setSub("");
  }

  function displayCategoryLabel(categoryName: string) {
    const vehicleForCategory = vehicle === "Mopot" ? "Mopo" : vehicle;
    return translateCategory(
      locale,
      displayCategoryForVehicle(vehicleForCategory, categoryName)
    );
  }

  /* ── breadcrumb segments ── */
  const crumbs: Array<{ label: string; toStep: number; onJump: () => void; onRemove: () => void }> = [];
  if (vehicle)  crumbs.push({ label: vehicleCrumbLabel(vehicle), toStep: 2,
      onJump: () => { setVehicleSubtype(""); setBrand(""); setModel(""); setModelOpen(false); setYear(""); setEngineCc(""); setEngineCcOther(""); setEngineModel(""); setEngineModelOther(""); setCat(""); setSubGroup(""); setSub(""); setStep(2); },
      onRemove: () => { setVehicleSubtype(""); setBrand(""); setModel(""); setModelOpen(false); setYear(""); setEngineCc(""); setEngineCcOther(""); setEngineModel(""); setEngineModelOther(""); setCat(""); setSubGroup(""); setSub(""); setStep(3); }
    });
    if (vehicleSubtype) crumbs.push({ label: vehicleSubtype, toStep: 2,
      onJump: () => { setBrand(""); setModel(""); setModelOpen(false); setYear(""); setEngineCc(""); setEngineCcOther(""); setEngineModel(""); setEngineModelOther(""); setCat(""); setSubGroup(""); setSub(""); setStep(2); },
      onRemove: () => { setVehicleSubtype(""); setStep(2); }
    });
    if (brand)    crumbs.push({ label: brand, toStep: 2,
      onJump: () => { setModel(""); setModelOpen(false); setYear(""); setEngineCc(""); setEngineCcOther(""); setEngineModel(""); setEngineModelOther(""); setCat(""); setSubGroup(""); setSub(""); setStep(2); },
      onRemove: () => { setBrand(""); setModel(""); setModelOpen(false); setYear(""); setEngineCc(""); setEngineCcOther(""); setEngineModel(""); setEngineModelOther(""); setCat(""); setSubGroup(""); setSub(""); setStep(2); }
    });
    if (model || year || engineCc || engineModel) crumbs.push({ label: [model, year, engineCc ? engineCc+"cc" : "", engineModel].filter(Boolean).join(" · ") || "Tiedot", toStep: 2,
      onJump: () => { setCat(""); setSubGroup(""); setSub(""); setStep(2); },
      onRemove: () => { setModel(""); setModelOpen(false); setYear(""); setEngineCc(""); setEngineCcOther(""); setEngineModel(""); setEngineModelOther(""); setStep(2); }
    });
    if (cat)      crumbs.push({ label: displayCategoryLabel(cat), toStep: 3,
      onJump: () => { setSubGroup(""); setSub(""); setStep(3); },
      onRemove: () => { setCat(""); setSubGroup(""); setSub(""); setStep(3); }
    });
    if (subGroup) crumbs.push({ label: translateCategory(locale, subGroup), toStep: 4,
      onJump: () => { setSub(""); setStep(4); },
      onRemove: () => { setSubGroup(""); setSub(""); setStep(4); }
    });
    if (sub) {
      const subLabel = sub.includes(" / ") ? sub.split(" / ").slice(1).join(" / ") : sub;
      crumbs.push({ label: translateCategory(locale, subLabel), toStep: 5,
        onJump: () => { setStep(5); },
        onRemove: () => { setSub(""); setStep(5); }
      });
    }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="cd-backdrop" onClick={closeDrawer} aria-hidden="true" />
      )}

      {/* Drawer */}
      {isOpen && (
      <aside className="cd-drawer cd-drawer-open" aria-label="Kategoriaselain">

        {/* Header */}
        <div className="cd-header">
          {step > 2 && (
            <button
              type="button"
              className="cd-back"
              onClick={goBack}
              aria-label="Takaisin"
              title="Takaisin"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <button
            type="button"
            className="cd-close"
            onPointerDown={closeDrawer}
            onClick={closeDrawer}
            aria-label="Sulje"
            title="Sulje"
          >
            <X size={18} />
          </button>
        </div>

        {/* Breadcrumb */}
        {false && crumbs.length > 0 && (
          <nav className="cd-crumbs" aria-label="Sijaintisi">
            {crumbs.map((c, i) => (
              <span key={i} className="cd-crumb-seg">
                {i > 0 && (
                  <button
                    type="button"
                    className="cd-crumb-sep"
                    onClick={() => c.onJump()}
                    aria-label={`Siirry kohtaan ${c.label}`}
                  >
                    <ChevronRight size={13} />
                  </button>
                )}
                <span className="cd-crumb-item">
                  <button
                    className={`cd-crumb-btn${i === crumbs.length - 1 ? " cd-crumb-current" : ""}`}
                    onClick={() => c.onJump()}
                  >
                    {c.label}
                  </button>
                  <button
                    className="cd-crumb-x"
                    onClick={(e) => { e.stopPropagation(); c.onRemove(); }}
                    aria-label={`Poista ${c.label}`}
                  >✕</button>
                </span>
              </span>
            ))}
          </nav>
        )}

        {/* Content */}
        <div className="cd-body">


          {/* Step 1: Brand */}
          {false && step === 1 && vehicle && (
            <>
              <div className="cd-step-hint">{t.cdSelectBrand}</div>
              <ul className="cd-list">
                {["Kaikki", ...brandOptions].map(b => (
                  <li key={b}>
                    <button
                      className={`cd-item cd-item-branch${brand === b || (b === "Kaikki" && !brand) ? " cd-item-active" : ""}`}
                      onClick={() => { setBrand(b === "Kaikki" ? "" : b); setModel(""); setModelOpen(false); setStep(2); }}
                    >
                      <span className="cd-label">{b}</span>
                      {brand === b && <Check size={15} className="cd-check" />}
                      <ChevronRight size={16} className="cd-arrow" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="cd-skip-row">
                <button className="cd-skip-btn" onClick={() => setStep(3)}>{t.cdSkipToParts}</button>
              </div>
            </>
          )}

          {/* Step 2: Vehicle details (model, year, CC) */}
          {step === 2 && (
            <section className="cd-vehicle-step" aria-label="Ajoneuvon tarkennus">
              <div className="cd-vehicle-step-head">
                <span className="cd-step-hint">
                  <span className="cd-step-hint-icon" aria-hidden="true">
                    <CarFront size={21} />
                  </span>
                  <span>{t.cdRefineVehicle}</span>
                </span>
                <div className="cd-vehicle-head-fields">
                  {renderVehicleTypeMenu()}
                  {renderVehicleSubtypeMenu()}
                </div>
              </div>
              <div
                className="cd-vehicle-detail-grid"
                onClickCapture={closeVehicleTypeMenus}
                onFocusCapture={closeVehicleTypeMenus}
              >
                <VehicleComboField
                  label="Merkki"
                  icon={<Tag size={20} />}
                  value={brand}
                  options={brandOptions}
                  disabled={false}
                  placeholder="Kaikki merkit"
                  inputRef={brandInputRef}
                  onChange={(nextValue) => {
                      setBrand(nextValue);
                      setModel("");
                      setModelOpen(false);
                      setEngineModel("");
                      setEngineModelOther("");
                  }}
                />

                <VehicleComboField
                  label="Malli"
                  icon={<Tag size={20} />}
                  value={model}
                  options={modelOptions}
                  disabled={!brand}
                  placeholder={brand ? "Kaikki mallit" : "Valitse ensin merkki"}
                  inputRef={modelInputRef}
                  onChange={(nextValue) => {
                      setModel(nextValue);
                      setEngineModel("");
                      setEngineModelOther("");
                  }}
                />

                <VehicleComboField
                  label="Vuosimalli"
                  icon={<CalendarDays size={20} />}
                  value={year}
                  options={YEAR_OPTIONS}
                  disabled={false}
                  placeholder="Vuosi tai kirjoita itse"
                  inputRef={yearInputRef}
                  onChange={setYear}
                />

                <VehicleComboField
                  label="Moottorin koko (cc)"
                  icon={<Gauge size={20} />}
                  value={engineCc}
                  options={vehicle ? (CC_OPTIONS[vehicle] ?? DEFAULT_CC_OPTIONS) : DEFAULT_CC_OPTIONS}
                  disabled={false}
                  placeholder={t.all}
                  inputRef={engineCcInputRef}
                  onChange={(nextValue) => {
                    setEngineCc(nextValue);
                    setEngineCcOther("");
                  }}
                />

                <VehicleComboField
                  label="Moottori"
                  icon={<Cog size={20} />}
                  value={engineModel}
                  options={engineModelOptions}
                  disabled={!brand}
                  placeholder={brand ? "Kaikki moottorit" : "Valitse merkki"}
                  inputRef={engineModelInputRef}
                  onChange={(nextValue) => {
                    setEngineModel(nextValue);
                    setEngineModelOther("");
                  }}
                />
              </div>
              <div className="cd-parts-inline-panel">
                <span className="cd-step-hint">
                  <span className="cd-step-hint-icon" aria-hidden="true">
                    <Box size={21} />
                  </span>
                  <span>Valitse osan kategoria</span>
                </span>
                <div className="cd-vehicle-detail-grid">
                  <VehicleComboField
                    label="Pääkategoria"
                    icon={<Box size={20} />}
                    value={cat}
                    options={partCategoryOptions}
                    placeholder="Valitse"
                    inputRef={partCategoryInputRef}
                    onChange={selectPartCategory}
                    allowCustom={false}
                  />

                  <VehicleComboField
                    label="Alakategoria"
                    icon={<Boxes size={20} />}
                    value={subGroup}
                    options={partGroupOptions}
                    disabled={!cat || partGroupOptions.length === 0}
                    placeholder={cat ? "Valitse" : "Valitse ensin"}
                    inputRef={partGroupInputRef}
                    onChange={selectPartGroup}
                    allowCustom={false}
                  />

                  <VehicleComboField
                    label="Tarkempi osa"
                    icon={<WrenchIcon size={20} />}
                    value={sub}
                    options={partLeafOptions}
                    disabled={!cat || partLeafOptions.length === 0}
                    placeholder={
                      cat
                        ? partGroupOptions.length > 0 && !subGroup
                          ? "Valitse alakategoria"
                          : "Valitse tarkempi osa"
                        : "Valitse ensin"
                    }
                    inputRef={partLeafInputRef}
                    onChange={setSub}
                    onOptionSelected={(nextValue) => applyFinalCategory(nextValue)}
                    allowCustom={false}
                  />
                </div>
                {(showTrackMatDimensionField || showPartDetailField) ? (
                  <div className="cd-extra-detail-panel">
                    {showTrackMatDimensionField ? (
                      <TrackMatDimensionField
                        value={trackMatDimension}
                        onChange={setTrackMatDimension}
                      />
                    ) : null}

                    {showPartDetailField ? (
                      <label className="cd-extra-field cd-engine-detail-field">
                        <span className="cd-extra-label">{partDetailLabel}</span>
                        <span className="cd-extra-input-shell">
                          <Cog size={18} aria-hidden="true" />
                          <input
                            className="cd-extra-input"
                            value={partEngineDetail}
                            onChange={(event) => setPartEngineDetail(event.target.value)}
                            placeholder={engineModel || "Kirjoita tarkempi malli"}
                          />
                        </span>
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="cd-vehicle-actions">
                <button className="cd-skip-btn cd-vehicle-next" type="button" onClick={() => focusPartCombo(partCategoryInputRef)}>
                  <Search size={21} aria-hidden="true" />
                  Jatka osiin
                </button>
                <button
                  className="cd-reset cd-vehicle-clear"
                  type="button"
                  onClick={clearAllDrawerFilters}
                >
                  <RotateCcw size={21} aria-hidden="true" />
                  Tyhjennä
                </button>
              </div>
            </section>
          )}

          {/* Step 3: Category */}
          {step === 3 && (
            <>
              {false && vehicle && (
                <section className="cd-inline-vehicle-panel" aria-label="Ajoneuvon tiedot">
                  <div className="cd-step-hint">Merkki, malli, vuosimalli ja moottori</div>
              <div
                className="cd-vehicle-detail-grid"
                onClickCapture={closeVehicleTypeMenus}
                onFocusCapture={closeVehicleTypeMenus}
              >
                    <div className="cd-detail-field">
                      <label className="cd-field-label">Merkki</label>
                      <select
                        className="cd-cc-select"
                        value={brand}
                        onChange={e => {
                          setBrand(e.target.value);
                          setModel("");
                          setModelOpen(false);
                          setEngineModel("");
                          setEngineModelOther("");
                        }}
                      >
                        <option value="">Kaikki merkit</option>
                        {brandOptions.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div className="cd-detail-field">
                      <label className="cd-field-label">Malli</label>
                      <select
                        className="cd-cc-select"
                        value={model}
                        onChange={e => {
                          setModel(e.target.value);
                          setEngineModel("");
                          setEngineModelOther("");
                        }}
                        disabled={!brand}
                      >
                        <option value="">{brand ? "Kaikki mallit" : "Valitse merkki ensin"}</option>
                        {modelOptions.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div className="cd-detail-field">
                      <label className="cd-field-label">Vuosimalli</label>
                      <select
                        className="cd-cc-select"
                        value={year}
                        onChange={e => setYear(e.target.value)}
                      >
                        <option value="">Kaikki vuodet</option>
                        {YEAR_OPTIONS.map((yearOption) => (
                          <option key={yearOption} value={yearOption}>{yearOption}</option>
                        ))}
                      </select>
                    </div>

                    <div className="cd-detail-field">
                      <label className="cd-field-label">Moottorin koko</label>
                      <select
                        className="cd-cc-select"
                        value={engineCc}
                        onChange={e => { setEngineCc(e.target.value); setEngineCcOther(""); }}
                      >
                        <option value="">{t.all}</option>
                        {(vehicle ? (CC_OPTIONS[vehicle] ?? DEFAULT_CC_OPTIONS) : DEFAULT_CC_OPTIONS).map((cc: string) => (
                          <option key={cc} value={cc}>{cc} cc</option>
                        ))}
                        <option value="muu">{t.sellOtherOption}</option>
                      </select>
                      {engineCc === "muu" && (
                        <input
                          className="cd-input"
                          type="number"
                          placeholder={t.sellTypeCc}
                          value={engineCcOther}
                          onChange={e => setEngineCcOther(e.target.value)}
                        />
                      )}
                    </div>

                    <div className="cd-detail-field">
                      <label className="cd-field-label">Moottori</label>
                      <select
                        className="cd-cc-select"
                        value={engineModel}
                        onChange={e => { setEngineModel(e.target.value); setEngineModelOther(""); }}
                        disabled={!brand}
                      >
                        <option value="">{brand ? "Kaikki moottorit" : t.sellSelectBrandFirst}</option>
                        {engineModelOptions.map((em: string) => (
                          <option key={em} value={em}>{em}</option>
                        ))}
                        {brand && <option value="muu">{t.sellOtherOption}</option>}
                      </select>
                      {engineModel === "muu" && (
                        <input
                          className="cd-input"
                          placeholder={t.sellTypeEngine}
                          value={engineModelOther}
                          onChange={e => setEngineModelOther(e.target.value)}
                        />
                      )}
                    </div>

                  </div>
                  <div className="cd-inline-actions">
                    <button className="cd-apply" type="button" onClick={apply}>Näytä tulokset</button>
                    <button
                      className="cd-reset"
                      type="button"
                      onClick={() => {
                        setBrand("");
                        setModel("");
                        setModelOpen(false);
                        setYear("");
                        setEngineCc("");
                        setEngineCcOther("");
                        setEngineModel("");
                        setEngineModelOther("");
                      }}
                    >
                      Tyhjennä
                    </button>
                  </div>
                </section>
              )}

              <ul className="cd-list cd-category-photo-list" onClickCapture={closeVehicleTypeMenus}>
                {Object.keys(cats).map(c => (
                  <li key={c}>
                    <button
                      className={`cd-category-photo-card ${partPictureClass(c)} ${mainCategoryPhotoClass(c)}${cat === c ? " cd-category-photo-active" : ""}`}
                      onClick={() => {
                        setCat(c); setSub(""); setSubGroup("");
                        const groups = getFilteredSubcategoryGroups(c);
                        const groupEntries = groups ? Object.entries(groups) : [];
                        if (groupEntries.length === 1 && groupEntries[0][0] === c && groupEntries[0][1].length > 0) {
                          setSubGroup(c);
                          setStep(5);
                        } else if (groups) setStep(4);
                        else if ((cats[c] ?? []).length > 0) setStep(5);
                      }}
                    >
                      <span className="cd-category-photo-title">{displayCategoryLabel(c)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Step 4: Sub-group */}
          {step === 4 && cat && currentSubcategoryGroups && (
            <ul className="cd-list cd-sub-group-list">
              {Object.entries(currentSubcategoryGroups).map(([group, children]) => {
                const hasChildren = children.length > 0;
                return (
                  <li key={group}>
                    {hasChildren ? (
                      <button
                        className={`cd-category-photo-card ${partPictureClass(group, cat)} ${subGroupClass(group)}${subGroup === group ? " cd-category-photo-active" : ""}`}
                        onClick={() => { setSubGroup(group); setSub(""); setStep(5); }}
                      >
                        <span className="cd-category-photo-title">{translateCategory(locale, group)}</span>
                      </button>
                    ) : (
                      <button
                        className={`cd-item cd-item-leaf cd-final-leaf-item${sub === group ? " cd-item-active" : ""}`}
                        onClick={() => applyFinalCategory(group, "")}
                      >
                        <span className="cd-label">{translateCategory(locale, group)}</span>
                        {sub === group ? <Check size={15} className="cd-check" /> : <ChevronRight size={15} className="cd-arrow" />}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Step 5: Leaf items under selected sub-group */}
          {step === 5 && cat && subGroup && (
            <ul className="cd-list cd-sub-group-list cd-final-leaf-list">
              {(currentSubcategoryGroups?.[subGroup] ?? subs).map(s => {
                const translatedFull = translateCategory(locale, s);
                const leafLabel = translatedFull.includes(" / ") ? translatedFull.split(" / ").slice(1).join(" / ") : translatedFull;
                return (
                  <li key={s}>
                    <button
                      className={`cd-item cd-item-leaf cd-final-leaf-item${sub === s ? " cd-item-active" : ""}`}
                      onClick={() => applyFinalCategory(s)}
                    >
                      <span className="cd-label">{leafLabel}</span>
                      {sub === s ? <Check size={15} className="cd-check" /> : <ChevronRight size={15} className="cd-arrow" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Step 5 fallback: Flat subcategories (no groups) */}
          {step === 5 && cat && !subGroup && (
            <ul className="cd-list cd-sub-group-list cd-final-leaf-list">
              {subs.map(s => (
                <li key={s}>
                  <button
                    className={`cd-item cd-item-leaf cd-final-leaf-item${sub === s ? " cd-item-active" : ""}`}
                    onClick={() => applyFinalCategory(s, "")}
                  >
                    <span className="cd-label">{translateCategory(locale, s)}</span>
                    {sub === s ? <Check size={15} className="cd-check" /> : <ChevronRight size={15} className="cd-arrow" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cd-results-footer">
          <button className="cd-results-button" type="button" onClick={apply}>
            <BarChart3 size={22} aria-hidden="true" />
            N&auml;yt&auml; tulokset
            <ChevronRight size={24} aria-hidden="true" />
          </button>
          <button
            className="cd-results-clear-button"
            type="button"
            onClick={clearAllDrawerFilters}
          >
            <RotateCcw size={21} aria-hidden="true" />
            Tyhjenn&auml;
          </button>
        </div>

      </aside>
      )}

      <style>{`
        .cd-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          z-index: 99; backdrop-filter: blur(2px);
        }
        .cd-drawer {
          position: fixed; right: 0; top: 0; bottom: 0;
          width: 320px; max-width: 90vw;
          background: #fff; z-index: 100;
          display: flex; flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.28s cubic-bezier(.4,0,.2,1);
          box-shadow: -4px 0 32px rgba(0,0,0,0.18);
        }
        .cd-drawer-open { transform: translateX(0); }
        .cd-header {
          display: flex; align-items: center; gap: 8px;
          padding: 16px 18px 12px;
          border-bottom: 1px solid #e8edf5;
          background: #f8fafc;
        }
        .cd-filter-submit {
          align-items: center;
          background: transparent;
          border: 0;
          border-radius: 12px;
          color: inherit;
          cursor: pointer;
          display: inline-flex;
          flex: 1;
          gap: 10px;
          min-width: 0;
          padding: 0;
          text-align: left;
        }
        .cd-filter-submit:hover .cd-title { color: #ffb454 !important; }
        .cd-title { flex: 1; font-size: 16px; font-weight: 800; color: #0f172a; }
        .cd-logo { font-size: 18px; }
        .cd-close {
          width: 40px; height: 40px; border: none; background: transparent;
          border-radius: 8px; cursor: pointer; display: grid; place-items: center;
          color: #64748b; margin-left: auto; position: relative; z-index: 2;
          touch-action: manipulation;
        }
        .cd-close:hover { background: #f1f5f9; color: #0f172a; }
        .cd-crumbs {
          display: flex; align-items: center; flex-wrap: wrap; gap: 2px;
          padding: 8px 18px 10px; border-bottom: 1px solid #f1f5f9;
          background: #f8fafc;
        }
        .cd-crumb-seg { display: inline-flex; align-items: center; gap: 2px; }
        .cd-crumb-sep { color: #cbd5e1; flex-shrink: 0; }
        .cd-crumb-btn {
          border: none; background: none; cursor: pointer; padding: 3px 6px;
          border-radius: 6px; font-size: 12px; font-weight: 700; color: #ff7a1a;
          transition: background .12s;
        }
        .cd-crumb-btn:hover { background: rgba(255, 122, 26, 0.14); }
        .cd-crumb-current { color: #0f172a; cursor: default; }
        .cd-crumb-current:hover { background: transparent; }
        .cd-crumb-item { display: inline-flex; align-items: center; gap: 1px;
          background: rgba(255, 122, 26, 0.14); border-radius: 7px; padding: 0 2px 0 0; }
        .cd-crumb-x {
          border: none; background: none; cursor: pointer; padding: 2px 4px;
          font-size: 10px; color: #94a3b8; line-height: 1; border-radius: 5px;
          transition: color .12s, background .12s;
        }
        .cd-crumb-x:hover { color: #ef4444; background: #fee2e2; }
        .cd-body { flex: 1; overflow-y: auto; padding: 8px 0 14px; }
        .cd-list { list-style: none; margin: 0; padding: 0; }
        .cd-item {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 12px 18px; border: none; background: transparent;
          cursor: pointer; text-align: left; font-size: 14px; font-weight: 600;
          color: #1e293b; transition: background .15s;
        }
        .cd-item:hover { background: #f8fafc; }
        .cd-item-active { background: rgba(255, 122, 26, 0.14); color: #ff8a24; }
        .cd-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: #f1f5f9; display: grid; place-items: center;
          flex-shrink: 0; color: #475569;
        }
        .cd-item-active .cd-icon { background: #dbeafe; color: #2563eb; }
        .cd-icon-sm { width: 30px; height: 30px; border-radius: 8px; }
        .cd-label { flex: 1; }
        .cd-arrow { color: #94a3b8; flex-shrink: 0; }
        .cd-check { color: #2563eb; flex-shrink: 0; }
        .cd-inputs { padding: 18px; display: flex; flex-direction: column; }
        .cd-field-label { font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .06em; color: #94a3b8; margin-bottom: 6px; }
        .cd-search-row {
          display: flex; align-items: center; gap: 8px;
          border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 9px 12px;
          color: #94a3b8;
        }
        .cd-input { flex: 1; border: none; outline: none; font-size: 14px;
          font-weight: 600; color: #0f172a; background: transparent; }
        .cd-next-btn {
          margin-top: 20px; padding: 12px; border-radius: 11px;
          background: #2563eb; color: #fff; border: none; cursor: pointer;
          font-size: 14px; font-weight: 700; display: flex; align-items: center;
          justify-content: center; gap: 6px;
        }
        .cd-next-btn:hover { background: #ff8a24; }
        .cd-footer {
          display: flex; gap: 10px; padding: 14px 18px;
          border-top: 1px solid #e8edf5; background: #f8fafc;
        }
        .cd-reset {
          flex: 1; padding: 11px; border-radius: 10px; border: 1.5px solid #e2e8f0;
          background: #fff; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer;
        }
        .cd-reset:hover { background: #f1f5f9; }
        .cd-apply {
          flex: 2; padding: 11px; border-radius: 10px; border: none;
          background: #2563eb; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
        }
        .cd-apply:hover { background: #ff8a24; }
        .cd-results-footer {
          background:
            linear-gradient(180deg, rgba(3, 19, 38, 0.74), rgba(3, 19, 38, 0.98)) !important;
          border-top: 1px solid rgba(126, 197, 240, 0.24) !important;
          box-shadow: 0 -16px 34px rgba(0, 8, 22, 0.28) !important;
          flex-shrink: 0 !important;
          padding: 12px 14px calc(12px + env(safe-area-inset-bottom)) !important;
        }
        .cd-results-button {
          align-items: center !important;
          background: linear-gradient(135deg, #ffad45 0%, #ff7a1f 48%, #e85a00 100%) !important;
          border: 1px solid rgba(255, 207, 160, 0.82) !important;
          border-radius: 12px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.22),
            0 14px 28px rgba(255, 106, 18, 0.25) !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: inline-flex !important;
          font-size: 15px !important;
          font-weight: 950 !important;
          justify-content: center !important;
          letter-spacing: 0 !important;
          line-height: 1.1 !important;
          min-height: 50px !important;
          padding: 0 18px !important;
          text-align: center !important;
          touch-action: manipulation !important;
          width: 100% !important;
        }
        .cd-results-button:hover {
          filter: brightness(1.05) !important;
        }
        .cd-step-hint {
          font-size: 11px; color: #94a3b8; padding: 10px 18px 4px;
          font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
        }
        .cd-skip-row {
          padding: 10px 18px 6px; border-top: 1px solid #f1f5f9; margin-top: 4px;
        }
        .cd-skip-btn {
          width: 100%; padding: 10px; border-radius: 10px; border: 1.5px dashed #cbd5e1;
          background: transparent; color: #64748b; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all .15s;
        }
        .cd-skip-btn:hover { background: #f8fafc; color: #2563eb; border-color: #93c5fd; }
        .cd-extra-filters {
          border-bottom: 1px solid #f1f5f9;
          padding-top: 12px;
          background: #fafcff;
        }
        .cd-extra-row {
          display: flex; flex-direction: column; gap: 10px;
          padding: 0 18px 12px;
        }
        .cd-extra-field { display: flex; flex-direction: column; gap: 5px; }
        .cd-clear-x {
          border: none; background: none; color: #94a3b8; cursor: pointer;
          font-size: 11px; padding: 0 2px; line-height: 1;
        }
        .cd-clear-x:hover { color: #ef4444; }
        .cd-cc-select {
          width: 100%; padding: 9px 10px; border: 1.5px solid #e2e8f0;
          border-radius: 10px; font-size: 13px; font-weight: 600;
          color: #0f172a; background: #fff; outline: none; cursor: pointer;
        }
        .cd-cc-select:focus { border-color: #ff7a1a; }
        .cd-model-chips {
          display: flex; flex-wrap: wrap; gap: 6px; padding-top: 4px;
        }
        .cd-model-panel {
          margin: 0 14px 14px !important;
          padding: 14px !important;
          border: 1px solid rgba(126, 197, 240, 0.22) !important;
          border-radius: 12px !important;
          background:
            radial-gradient(180px 90px at 0% 0%, rgba(255, 122, 26, 0.08), transparent 70%),
            rgba(5, 20, 34, 0.72) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 12px 24px rgba(0, 8, 22, 0.18) !important;
        }
        .cd-inline-vehicle-panel {
          display: none !important;
          margin: 12px 14px 8px !important;
          padding: 0 0 12px !important;
          border: 1px solid rgba(126, 197, 240, 0.22) !important;
          border-radius: 12px !important;
          background:
            radial-gradient(220px 120px at 0% 0%, rgba(255, 122, 26, 0.1), transparent 72%),
            linear-gradient(180deg, rgba(5, 28, 50, 0.96), rgba(3, 19, 38, 0.94)) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 14px 30px rgba(0, 8, 22, 0.22) !important;
          overflow: hidden !important;
        }
        .cd-inline-vehicle-panel .cd-step-hint {
          margin: 0 !important;
          border-left: 0 !important;
          border-right: 0 !important;
          border-top: 0 !important;
          border-radius: 0 !important;
        }
        .cd-inline-vehicle-panel .cd-vehicle-detail-grid {
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          padding: 12px !important;
        }
        .cd-inline-vehicle-panel .cd-input {
          margin-top: 6px !important;
          min-height: 38px !important;
          width: 100% !important;
        }
        .cd-inline-actions {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          gap: 8px !important;
          padding: 0 12px !important;
        }
        .cd-inline-actions .cd-apply,
        .cd-inline-actions .cd-reset {
          min-height: 38px !important;
          width: auto !important;
        }
        .cd-vehicle-step {
          align-content: start !important;
          display: grid !important;
          gap: 14px !important;
          min-height: calc(100dvh - 132px) !important;
          padding: 14px !important;
        }
        .cd-vehicle-step-head {
          background:
            radial-gradient(240px 130px at 0% 0%, rgba(255, 122, 26, 0.13), transparent 70%),
            linear-gradient(180deg, rgba(8, 39, 68, 0.98), rgba(3, 19, 38, 0.96)) !important;
          border: 1px solid rgba(126, 197, 240, 0.24) !important;
          border-radius: 12px !important;
          box-shadow: 0 14px 30px rgba(0, 8, 22, 0.18) !important;
          display: grid !important;
          gap: 6px !important;
          padding: 13px 14px !important;
        }
        .cd-vehicle-step-head .cd-step-hint {
          background: transparent !important;
          border: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .cd-vehicle-step-head strong {
          color: #ffffff !important;
          font-size: 20px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          line-height: 1.1 !important;
          overflow-wrap: anywhere !important;
        }
        .cd-vehicle-head-fields {
          display: grid !important;
          gap: 10px !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          width: 100% !important;
        }
        .cd-vehicle-type-menu {
          display: grid !important;
          gap: 7px !important;
          margin: 0 !important;
          min-width: 0 !important;
          width: 100% !important;
        }
        .cd-vehicle-type-menu.is-disabled {
          opacity: 0.58 !important;
        }
        .cd-vehicle-type-menu span {
          color: rgba(216, 226, 236, 0.72) !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          line-height: 1 !important;
          text-transform: uppercase !important;
        }
        .cd-vehicle-type-trigger {
          align-items: center !important;
          background:
            linear-gradient(180deg, rgba(8, 31, 52, 0.98), rgba(4, 19, 36, 0.98)) !important;
          border: 1px solid rgba(255, 122, 26, 0.82) !important;
          border-radius: 9px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 0 0 1px rgba(255, 122, 26, 0.12) !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: grid !important;
          gap: 10px !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          height: 46px !important;
          justify-content: center !important;
          min-width: 0 !important;
          padding: 0 12px !important;
          width: 100% !important;
        }
        .cd-vehicle-type-trigger:disabled {
          cursor: not-allowed !important;
        }
        .cd-vehicle-type-trigger strong {
          color: #ffffff !important;
          font-size: 20px !important;
          font-weight: 950 !important;
          line-height: 1.1 !important;
          min-width: 0 !important;
          overflow: hidden !important;
          text-align: left !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .cd-vehicle-type-trigger svg {
          color: #ff8a1c !important;
        }
        .cd-vehicle-type-options {
          background: #06182a !important;
          border: 1px solid rgba(126, 197, 240, 0.38) !important;
          border-radius: 9px !important;
          box-shadow: 0 18px 34px rgba(0, 8, 22, 0.44) !important;
          display: grid !important;
          gap: 3px !important;
          margin-top: 6px !important;
          max-height: min(236px, 42dvh) !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding: 5px !important;
          scrollbar-color: rgba(126, 197, 240, 0.45) transparent !important;
          scrollbar-width: thin !important;
          width: 100% !important;
          z-index: 84 !important;
        }
        .cd-vehicle-type-option {
          background: rgba(8, 31, 52, 0.72) !important;
          border: 0 !important;
          border-radius: 7px !important;
          color: #ffffff !important;
          cursor: pointer !important;
          font-size: 15px !important;
          font-weight: 950 !important;
          line-height: 1.1 !important;
          min-height: 36px !important;
          padding: 8px 10px !important;
          text-align: left !important;
          width: 100% !important;
        }
        .cd-vehicle-type-option:hover,
        .cd-vehicle-type-option.is-active {
          background: #92c2f1 !important;
          color: #031326 !important;
        }
        .cd-vehicle-kind-grid {
          display: grid !important;
          gap: 9px !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          margin: 0 !important;
          width: 100% !important;
        }
        .cd-vehicle-kind-card {
          align-items: center !important;
          background:
            linear-gradient(180deg, rgba(7, 31, 54, 0.98), rgba(3, 17, 32, 0.98)) !important;
          border: 1px solid rgba(126, 197, 240, 0.28) !important;
          border-radius: 10px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: grid !important;
          gap: 8px !important;
          grid-template-columns: 42px minmax(0, 1fr) !important;
          min-height: 58px !important;
          padding: 8px !important;
          text-align: left !important;
        }
        .cd-vehicle-kind-card .cd-start-picture {
          border-radius: 8px !important;
          height: 36px !important;
          min-height: 0 !important;
          width: 42px !important;
        }
        .cd-vehicle-kind-card .cd-start-photo {
          height: 100% !important;
          object-fit: cover !important;
          width: 100% !important;
        }
        .cd-vehicle-kind-copy {
          display: grid !important;
          gap: 2px !important;
          min-width: 0 !important;
        }
        .cd-vehicle-kind-copy strong {
          color: #ffffff !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          line-height: 1.15 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .cd-vehicle-kind-copy small {
          color: rgba(216, 226, 236, 0.68) !important;
          font-size: 11px !important;
          font-weight: 750 !important;
          line-height: 1.2 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }
        .cd-vehicle-kind-card-active {
          background:
            linear-gradient(180deg, rgba(255, 122, 26, 0.98), rgba(255, 104, 18, 0.98)) !important;
          border-color: rgba(255, 208, 160, 0.9) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.22),
            0 12px 26px rgba(255, 106, 18, 0.2) !important;
        }
        .cd-category-vehicle-inline {
          background: rgba(3, 17, 32, 0.72) !important;
          border: 1px solid rgba(126, 197, 240, 0.22) !important;
          border-radius: 12px !important;
          display: grid !important;
          gap: 8px !important;
          margin: 0 0 10px !important;
          padding: 10px !important;
        }
        .cd-category-vehicle-inline .cd-step-hint {
          background: transparent !important;
          border: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .cd-vehicle-kind-grid-compact {
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        }
        .cd-vehicle-kind-grid-compact .cd-vehicle-kind-card {
          gap: 6px !important;
          grid-template-columns: 24px minmax(0, 1fr) !important;
          min-height: 40px !important;
          padding: 6px 7px !important;
        }
        .cd-vehicle-kind-grid-compact .cd-vehicle-kind-card .cd-start-picture {
          height: 24px !important;
          width: 24px !important;
        }
        .cd-vehicle-kind-grid-compact .cd-vehicle-kind-copy strong {
          font-size: 11px !important;
        }
        .cd-vehicle-kind-grid-compact .cd-vehicle-kind-copy small {
          display: none !important;
        }
        .cd-vehicle-step > .cd-vehicle-detail-grid {
          align-content: start !important;
          background:
            linear-gradient(180deg, rgba(7, 31, 54, 0.98), rgba(3, 17, 32, 0.98)) !important;
          border: 1px solid rgba(126, 197, 240, 0.24) !important;
          border-radius: 12px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 16px 34px rgba(0, 8, 22, 0.2) !important;
          display: grid !important;
          gap: 12px !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          margin: 0 !important;
          padding: 14px !important;
        }
        .cd-vehicle-step .cd-detail-field {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          gap: 8px !important;
          padding: 0 !important;
        }
        .cd-vehicle-step .cd-field-label {
          color: rgba(216, 226, 236, 0.86) !important;
          font-size: 12px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          line-height: 1.15 !important;
          overflow-wrap: anywhere !important;
          text-transform: none !important;
        }
        .cd-vehicle-step .cd-cc-select,
        .cd-vehicle-step .cd-input {
          appearance: auto !important;
          background: linear-gradient(180deg, rgba(8, 31, 52, 0.98), rgba(4, 19, 36, 0.98)) !important;
          border: 1px solid rgba(126, 197, 240, 0.34) !important;
          border-radius: 8px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
          color: #ffffff !important;
          font-size: 13px !important;
          font-weight: 850 !important;
          line-height: 1.2 !important;
          min-height: 42px !important;
          overflow: hidden !important;
          padding: 0 10px !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          width: 100% !important;
        }
        .cd-vehicle-step .cd-cc-select:disabled {
          color: rgba(216, 226, 236, 0.55) !important;
          opacity: 1 !important;
        }
        .cd-vehicle-step .cd-combo-input::placeholder {
          color: rgba(216, 226, 236, 0.62) !important;
          opacity: 1 !important;
        }
        .cd-vehicle-step .cd-input {
          margin-top: 8px !important;
        }
        .cd-combo-wrap {
          position: relative !important;
          width: 100% !important;
        }
        .cd-combo-control {
          align-items: stretch !important;
          background: linear-gradient(180deg, rgba(8, 31, 52, 0.98), rgba(4, 19, 36, 0.98)) !important;
          border: 1px solid rgba(126, 197, 240, 0.34) !important;
          border-radius: 8px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) 36px !important;
          overflow: hidden !important;
          width: 100% !important;
        }
        .cd-combo-control .cd-combo-input {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          border-right: 0 !important;
          box-shadow: none !important;
        }
        .cd-combo-toggle {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          color: rgba(255, 255, 255, 0.86) !important;
          cursor: pointer !important;
          display: inline-flex !important;
          justify-content: center !important;
          min-height: 42px !important;
          padding: 0 !important;
        }
        .cd-combo-toggle:disabled {
          cursor: not-allowed !important;
          opacity: 0.55 !important;
        }
        .cd-combo-open .cd-combo-control {
          border-color: rgba(255, 122, 26, 0.86) !important;
        }
        .cd-combo-menu {
          background: #06182a !important;
          border: 1px solid rgba(126, 197, 240, 0.34) !important;
          border-radius: 9px !important;
          box-shadow: 0 18px 34px rgba(0, 8, 22, 0.34) !important;
          display: grid !important;
          gap: 3px !important;
          grid-template-columns: 1fr !important;
          left: 0 !important;
          max-height: min(238px, 42dvh) !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding: 5px !important;
          position: absolute !important;
          right: 0 !important;
          scrollbar-color: rgba(126, 197, 240, 0.45) transparent !important;
          scrollbar-width: thin !important;
          top: calc(100% + 6px) !important;
          z-index: 80 !important;
        }
        .cd-combo-menu[data-full-menu="true"] {
          max-height: none !important;
          overflow-y: visible !important;
          scrollbar-width: none !important;
        }
        .cd-combo-menu[data-full-menu="true"]::-webkit-scrollbar {
          display: none !important;
        }
        .cd-combo-option {
          background: rgba(8, 31, 52, 0.72) !important;
          border: 0 !important;
          border-radius: 7px !important;
          color: #ffffff !important;
          cursor: pointer !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          line-height: 1.15 !important;
          min-height: 30px !important;
          overflow: hidden !important;
          padding: 7px 9px !important;
          text-align: left !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          width: 100% !important;
        }
        .cd-combo-option:hover,
        .cd-combo-option-active {
          background: #92c2f1 !important;
          color: #031326 !important;
        }
        .cd-combo-option-custom {
          color: #ffffff !important;
          font-weight: 950 !important;
          margin-top: 4px !important;
        }
        .cd-vehicle-actions {
          align-self: start !important;
          display: grid !important;
          gap: 9px !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
        }
        .cd-vehicle-actions button {
          align-items: center !important;
          display: inline-flex !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          justify-content: center !important;
          line-height: 1.1 !important;
          min-height: 44px !important;
          padding: 0 14px !important;
          text-align: center !important;
          white-space: normal !important;
          width: 100% !important;
          writing-mode: horizontal-tb !important;
        }
        .cd-vehicle-actions .cd-vehicle-next {
          background: linear-gradient(135deg, #ffad45 0%, #ff7a1f 48%, #e85a00 100%) !important;
          border: 1px solid rgba(255, 190, 120, 0.72) !important;
          color: #ffffff !important;
        }
        .cd-vehicle-actions .cd-vehicle-clear {
          background: linear-gradient(180deg, #cbd6df, #9faebc) !important;
          border: 1px solid rgba(224, 233, 240, 0.68) !important;
          color: #071827 !important;
          min-width: 92px !important;
        }
        .cd-vehicle-detail-grid {
          display: grid !important;
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          gap: 14px 22px !important;
          padding: 16px 20px 18px !important;
          margin: 0 10px 12px !important;
          border: 1px solid rgba(126, 197, 240, 0.2) !important;
          border-radius: 12px !important;
          background: rgba(3, 19, 38, 0.38) !important;
        }
        .cd-detail-field {
          display: grid !important;
          gap: 7px !important;
          min-width: 0 !important;
        }
        .cd-detail-field .cd-field-label {
          color: #f4f8fc !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
        }
        .cd-detail-field .cd-cc-select,
        .cd-detail-field .cd-input {
          min-height: 40px !important;
          border-radius: 7px !important;
          border: 1px solid rgba(126, 197, 240, 0.2) !important;
          background: rgba(5, 22, 39, 0.96) !important;
          color: #dbe7f1 !important;
          font-size: 13px !important;
          font-weight: 850 !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
        }
        .cd-detail-field .cd-cc-select {
          appearance: auto !important;
          color-scheme: dark !important;
        }
        .cd-detail-field .cd-cc-select:disabled {
          opacity: 0.56 !important;
          cursor: not-allowed !important;
        }
        @media (max-width: 760px) {
          .cd-vehicle-detail-grid {
            grid-template-columns: 1fr !important;
            padding: 14px !important;
            gap: 12px !important;
          }
        }
        .cd-model-chip {
          padding: 5px 11px; border-radius: 20px; font-size: 12px; font-weight: 700;
          border: 1.5px solid #e2e8f0; background: #fff; color: #334155;
          cursor: pointer; transition: all .14s; white-space: nowrap;
        }
        .cd-model-chip:hover { border-color: #93c5fd; color: #ff8a24; background: rgba(255, 122, 26, 0.14); }
        .cd-model-chip-active { border-color: #ff7a1a !important; background: rgba(255, 122, 26, 0.14) !important; color: #ff8a24 !important; }
        .cd-model-chip-muu { border-style: dashed; color: #64748b; }
        .cd-drawer {
          background:
            radial-gradient(440px 280px at 0% 0%, rgba(255, 107, 22, 0.1), transparent 62%),
            linear-gradient(180deg, #062442 0%, #031326 100%) !important;
          border-left: 1px solid rgba(126, 197, 240, 0.28);
          border-right: 0;
          box-shadow: -18px 0 70px rgba(0, 8, 22, 0.46) !important;
          color: #d8e2ec;
        }
        .cd-header,
        .cd-crumbs,
        .cd-footer {
          background: rgba(3, 19, 38, 0.86) !important;
          border-color: rgba(126, 197, 240, 0.2) !important;
        }
        .cd-title,
        .cd-label,
        .cd-crumb-current {
          color: #d8e2ec !important;
        }
        .cd-step-hint,
        .cd-field-label {
          color: rgba(203, 213, 225, 0.72) !important;
        }
        .cd-item {
          color: #d8e2ec !important;
        }
        .cd-item:hover {
          background: rgba(126, 197, 240, 0.1) !important;
        }
        .cd-item-active {
          background: rgba(255, 107, 22, 0.16) !important;
          color: #ffffff !important;
        }
        .cd-icon,
        .cd-crumb-item,
        .cd-search-row,
        .cd-cc-select,
        .cd-model-chip,
        .cd-reset {
          background: rgba(203, 213, 225, 0.92) !important;
          border-color: rgba(126, 197, 240, 0.34) !important;
          color: #071827 !important;
        }
        .cd-item-active .cd-icon,
        .cd-model-chip-active {
          background: linear-gradient(135deg, #ffae3d 0%, #ff7a1f 48%, #e85a00 100%) !important;
          color: #ffffff !important;
          border-color: rgba(255, 210, 168, 0.72) !important;
        }
        .cd-extra-filters {
          background: rgba(3, 19, 38, 0.42) !important;
          border-color: rgba(126, 197, 240, 0.18) !important;
        }
        .cd-input {
          color: #071827 !important;
        }
        .cd-skip-row {
          border-color: rgba(126, 197, 240, 0.18) !important;
        }
        .cd-skip-btn {
          background: rgba(203, 213, 225, 0.92) !important;
          border-color: rgba(126, 197, 240, 0.38) !important;
          color: #071827 !important;
        }
        .cd-close,
        .cd-crumb-x,
        .cd-arrow {
          color: rgba(203, 213, 225, 0.76) !important;
        }
        .cd-header {
          min-height: 72px;
          padding: 14px 18px !important;
          gap: 12px !important;
          background:
            radial-gradient(220px 90px at 12% 0%, rgba(255, 126, 31, 0.18), transparent 70%),
            linear-gradient(135deg, rgba(3, 19, 38, 0.98) 0%, rgba(5, 35, 62, 0.94) 100%) !important;
          border-bottom: 1px solid rgba(126, 197, 240, 0.24) !important;
          box-shadow: 0 14px 30px rgba(0, 8, 22, 0.22);
        }
        .cd-logo {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          color: #ffffff;
          background:
            linear-gradient(135deg, rgba(255, 145, 38, 0.95), rgba(255, 93, 8, 0.95));
          box-shadow: 0 10px 24px rgba(255, 107, 22, 0.28);
          flex: 0 0 auto;
        }
        .cd-title {
          font-size: 17px !important;
          letter-spacing: 0 !important;
        }
        .cd-close {
          width: 36px !important;
          height: 36px !important;
          border-radius: 12px !important;
          background: rgba(216, 226, 236, 0.1) !important;
          border: 1px solid rgba(216, 226, 236, 0.16) !important;
        }
        .cd-close:hover {
          background: #ff7a1f !important;
          color: #ffffff !important;
          border-color: rgba(255, 210, 168, 0.72) !important;
          transform: translateY(-1px);
        }
        .cd-crumbs {
          padding: 10px 18px 12px !important;
          gap: 8px !important;
          background:
            linear-gradient(180deg, rgba(5, 28, 50, 0.96), rgba(3, 19, 38, 0.94)) !important;
          border-bottom: 1px solid rgba(126, 197, 240, 0.22) !important;
        }
        .cd-crumb-seg {
          gap: 7px !important;
        }
        .cd-crumb-sep {
          width: 18px;
          height: 18px;
          padding: 3px;
          border-radius: 999px;
          color: rgba(216, 226, 236, 0.76) !important;
          background: rgba(216, 226, 236, 0.1);
        }
        .cd-crumb-item {
          min-height: 32px;
          gap: 4px !important;
          padding: 3px 4px 3px 10px !important;
          border-radius: 10px !important;
          background:
            linear-gradient(135deg, rgba(216, 226, 236, 0.96), rgba(171, 190, 207, 0.9)) !important;
          border: 1px solid rgba(255, 255, 255, 0.34) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.56), 0 8px 18px rgba(0, 8, 22, 0.2);
        }
        .cd-crumb-btn {
          padding: 3px 3px !important;
          color: #071827 !important;
          font-size: 12px !important;
        }
        .cd-crumb-btn:hover,
        .cd-crumb-current:hover {
          background: transparent !important;
          color: #071827 !important;
        }
        .cd-crumb-x {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          padding: 0 !important;
          border-radius: 999px !important;
          color: #071827 !important;
          background: rgba(7, 24, 39, 0.1) !important;
        }
        .cd-crumb-x:hover {
          background: #ff7a1f !important;
          color: #ffffff !important;
        }
        .cd-skip-btn:hover,
        .cd-model-chip:hover {
          background: rgba(203, 213, 225, 0.98) !important;
          color: #071827 !important;
        }
        .cd-apply {
          background: linear-gradient(135deg, #ffae3d 0%, #ff7a1f 48%, #e85a00 100%) !important;
          box-shadow: 0 12px 28px rgba(255, 107, 22, 0.26);
        }
        .cd-apply:hover {
          background: linear-gradient(135deg, #ffb955 0%, #ff8129 48%, #f06608 100%) !important;
        }

        .cd-start {
          display: grid;
          gap: 16px;
          padding: 14px;
        }
        .cd-start-hero {
          background:
            radial-gradient(220px 130px at 12% 0%, rgba(255, 122, 31, 0.2), transparent 72%),
            linear-gradient(180deg, rgba(20, 52, 82, 0.96), rgba(8, 31, 57, 0.98));
          border: 1px solid rgba(126, 197, 240, 0.24);
          border-radius: 18px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 18px 38px rgba(0, 8, 22, 0.22);
          padding: 18px;
        }
        .cd-start-eyebrow {
          color: rgba(255, 154, 36, 0.94);
          display: block;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.12em;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .cd-start-hero h2 {
          color: #ffffff;
          font-size: 22px;
          line-height: 1.1;
          margin: 0;
        }
        .cd-start-hero p {
          color: rgba(216, 226, 236, 0.78);
          font-size: 13px;
          font-weight: 750;
          line-height: 1.45;
          margin: 10px 0 0;
        }
        .cd-start-grid {
          display: grid;
          gap: 10px;
        }
        .cd-start-card {
          align-items: center;
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.08), transparent 34%),
            linear-gradient(180deg, rgba(82, 96, 112, 0.94), rgba(55, 69, 86, 0.96));
          border: 1px solid rgba(173, 186, 201, 0.34);
          border-radius: 16px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 12px 26px rgba(0, 8, 22, 0.16);
          color: #ffffff;
          cursor: pointer;
          display: grid;
          gap: 12px;
          grid-template-columns: 88px minmax(0, 1fr) 26px;
          min-height: 82px;
          padding: 10px 12px 10px 10px;
          text-align: left;
          transition:
            border-color 160ms ease,
            background 160ms ease,
            transform 160ms ease;
        }
        .cd-start-card:hover {
          background:
            linear-gradient(90deg, rgba(255, 154, 36, 0.18), transparent 46%),
            linear-gradient(180deg, rgba(98, 113, 130, 0.98), rgba(66, 82, 101, 0.98));
          border-color: rgba(255, 210, 168, 0.58);
          transform: translateY(-1px);
        }
        .cd-start-card-active {
          border-color: rgba(255, 154, 36, 0.76);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 0 0 1px rgba(255, 122, 31, 0.18),
            0 16px 32px rgba(255, 107, 22, 0.14);
        }
        .cd-start-picture {
          align-items: center;
          background: linear-gradient(180deg, #26394b, #0b2133);
          border: 1px solid rgba(203, 213, 225, 0.34);
          border-radius: 14px;
          color: #e9f4fb;
          display: flex;
          height: 62px;
          justify-content: center;
          overflow: hidden;
          position: relative;
          width: 88px;
        }
        .cd-start-photo {
          border-radius: 13px;
          height: 100%;
          inset: 0;
          object-fit: cover;
          position: absolute;
          width: 100%;
        }
        .cd-vehicle-picture {
          color: #eaf6fb;
          display: block;
          height: 62px;
          width: 76px;
        }
        .cd-start-copy {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .cd-start-copy strong {
          color: #ffffff;
          font-size: 15px;
          font-weight: 950;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cd-start-copy small {
          color: rgba(216, 226, 236, 0.72);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.25;
        }
        .cd-start-arrow {
          background: rgba(203, 213, 225, 0.14);
          border: 1px solid rgba(203, 213, 225, 0.18);
          border-radius: 999px;
          color: #edf3f8;
          padding: 4px;
        }

        /* Final drawer structure: every choice is its own clear gray bar. */
        .cd-body {
          padding: 8px 0 14px !important;
        }
        .cd-list {
          display: grid !important;
          gap: 8px !important;
          padding: 10px 14px !important;
        }
        .cd-list li {
          margin: 0 !important;
        }
        .cd-item {
          min-height: 50px !important;
          padding: 9px 10px !important;
          border: 1px solid rgba(126, 197, 240, 0.22) !important;
          border-radius: 11px !important;
          background:
            linear-gradient(180deg, rgba(19, 53, 83, 0.92) 0%, rgba(11, 39, 66, 0.94) 100%) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 10px 20px rgba(0, 8, 22, 0.12) !important;
        }
        .cd-item-branch {
          background:
            linear-gradient(90deg, rgba(53, 65, 83, 0.24), transparent 34%),
            linear-gradient(180deg, rgba(18, 55, 88, 0.96) 0%, rgba(9, 41, 70, 0.96) 100%) !important;
        }
        .cd-item-leaf {
          background:
            linear-gradient(90deg, rgba(73, 199, 216, 0.08) 0%, transparent 40%),
            linear-gradient(180deg, rgba(10, 30, 52, 0.96) 0%, rgba(5, 18, 38, 0.98) 100%) !important;
          border: 1px solid rgba(73, 199, 216, 0.14) !important;
          padding-left: 20px !important;
          position: relative !important;
        }
        .cd-item-leaf::before {
          background: linear-gradient(180deg, rgba(73, 199, 216, 0.9), rgba(255, 149, 43, 0.6)) !important;
          border-radius: 999px !important;
          bottom: 20% !important;
          content: "" !important;
          display: block !important;
          left: 10px !important;
          position: absolute !important;
          top: 20% !important;
          width: 3px !important;
        }
        .cd-item-active.cd-item-leaf {
          background:
            linear-gradient(90deg, rgba(255, 149, 43, 0.12) 0%, transparent 50%),
            linear-gradient(180deg, rgba(12, 34, 58, 0.98) 0%, rgba(7, 20, 42, 0.99) 100%) !important;
          border-color: rgba(255, 149, 43, 0.5) !important;
        }
        .cd-item-active.cd-item-leaf::before {
          background: linear-gradient(180deg, #ffad45, #ff7a1f) !important;
        }
        .cd-item:hover {
          background:
            linear-gradient(90deg, rgba(166, 181, 196, 0.14), transparent 42%),
            linear-gradient(180deg, rgba(28, 67, 101, 0.98) 0%, rgba(13, 47, 78, 0.98) 100%) !important;
          border-color: rgba(166, 181, 196, 0.5) !important;
        }
        .cd-item-active {
          background:
            linear-gradient(90deg, rgba(255, 107, 22, 0.24), rgba(88, 96, 110, 0.26) 48%, rgba(20, 45, 70, 0.92) 100%) !important;
          border-color: rgba(255, 164, 90, 0.62) !important;
        }
        .cd-icon,
        .cd-icon-sm {
          background: linear-gradient(180deg, #b8c2cd 0%, #929eab 100%) !important;
          border: 1px solid rgba(123, 135, 149, 0.9) !important;
          color: #071827 !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28) !important;
        }
        .cd-icon svg,
        .cd-icon-sm svg {
          stroke: #071827 !important;
        }
        .cd-part-picture {
          display: block !important;
          height: 32px !important;
          width: 32px !important;
        }
        .cd-icon-sm .cd-part-picture {
          height: 30px !important;
          width: 30px !important;
        }
        .cd-arrow {
          width: 24px !important;
          height: 24px !important;
          padding: 4px !important;
          border-radius: 999px !important;
          background: rgba(166, 181, 196, 0.14) !important;
          color: rgba(216, 226, 236, 0.9) !important;
        }
        .cd-check {
          width: 24px !important;
          height: 24px !important;
          padding: 4px !important;
          border-radius: 999px !important;
          background: rgba(255, 107, 22, 0.18) !important;
          color: #ffffff !important;
        }
        .cd-step-hint {
          margin: 8px 14px 4px !important;
          padding: 9px 10px !important;
          border: 1px solid rgba(126, 197, 240, 0.18) !important;
          border-radius: 10px !important;
          background: rgba(8, 37, 63, 0.82) !important;
        }
        .cd-crumb-item,
        .cd-search-row,
        .cd-cc-select,
        .cd-model-chip,
        .cd-reset,
        .cd-skip-btn {
          background: linear-gradient(180deg, #b8c2cd 0%, #929eab 100%) !important;
          border-color: rgba(123, 135, 149, 0.9) !important;
          color: #071827 !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28) !important;
        }
        .cd-crumb-btn,
        .cd-crumb-current,
        .cd-skip-btn,
        .cd-reset {
          color: #071827 !important;
        }
        .cd-skip-row {
          padding: 10px 18px 8px !important;
        }

        .cd-skip-row .cd-skip-btn {
          background:
            radial-gradient(140px 60px at 0% 0%, rgba(255, 154, 36, 0.18), transparent 72%),
            linear-gradient(145deg, rgba(8, 37, 63, 0.96), rgba(3, 19, 38, 0.98)) !important;
          border: 1px solid rgba(255, 154, 36, 0.48) !important;
          border-radius: 12px !important;
          box-shadow:
            0 12px 24px rgba(0, 8, 22, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
          color: #e6f1fb !important;
        }

        .cd-skip-row .cd-skip-btn:hover {
          background:
            radial-gradient(140px 60px at 0% 0%, rgba(255, 154, 36, 0.24), transparent 72%),
            linear-gradient(145deg, rgba(12, 49, 80, 0.98), rgba(5, 25, 48, 0.98)) !important;
          border-color: rgba(255, 184, 94, 0.74) !important;
          color: #ffffff !important;
        }

        /* Final drawer gray treatment: bars must read as gray, and chip X must be clear. */
        .cd-item,
        .cd-item-branch,
        .cd-item-leaf {
          min-height: 60px !important;
          gap: 12px !important;
          padding: 8px 10px !important;
          background:
            linear-gradient(180deg, rgba(82, 96, 112, 0.94) 0%, rgba(55, 69, 86, 0.96) 100%) !important;
          border-color: rgba(173, 186, 201, 0.34) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 10px 22px rgba(0, 8, 22, 0.16) !important;
        }
        .cd-item:hover {
          background:
            linear-gradient(180deg, rgba(98, 113, 130, 0.98) 0%, rgba(66, 82, 101, 0.98) 100%) !important;
          border-color: rgba(203, 213, 225, 0.52) !important;
        }
        .cd-item-active {
          background:
            linear-gradient(90deg, rgba(255, 122, 31, 0.28), rgba(91, 102, 116, 0.98) 44%, rgba(63, 76, 92, 0.98) 100%) !important;
          border-color: rgba(255, 164, 90, 0.7) !important;
        }
        .cd-arrow {
          background: rgba(203, 213, 225, 0.22) !important;
          border: 1px solid rgba(203, 213, 225, 0.18) !important;
          color: #edf3f8 !important;
          stroke: #edf3f8 !important;
        }
        .cd-crumb-item {
          align-items: center !important;
          gap: 4px !important;
          padding: 2px 3px 2px 8px !important;
        }
        .cd-crumb-x {
          align-items: center !important;
          background: rgba(7, 24, 39, 0.18) !important;
          border: 1px solid rgba(7, 24, 39, 0.16) !important;
          border-radius: 999px !important;
          color: #071827 !important;
          display: inline-flex !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          height: 18px !important;
          justify-content: center !important;
          line-height: 1 !important;
          padding: 0 !important;
          width: 18px !important;
        }
        .cd-crumb-x:hover {
          background: #ff7a1f !important;
          border-color: rgba(255, 210, 168, 0.82) !important;
          color: #ffffff !important;
        }

        .cd-thumb {
          background:
            linear-gradient(180deg, #314557 0%, #0b2133 100%) !important;
          border: 1px solid rgba(203, 213, 225, 0.5) !important;
          border-radius: 10px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -10px 18px rgba(0, 8, 22, 0.28),
            0 6px 14px rgba(0, 8, 22, 0.2) !important;
          flex: 0 0 48px !important;
          height: 42px !important;
          padding: 2px !important;
          width: 48px !important;
          min-width: 48px !important;
          overflow: hidden !important;
        }
        .cd-icon-sm.cd-thumb {
          flex-basis: 44px !important;
          height: 38px !important;
          min-width: 44px !important;
          width: 44px !important;
        }
        .cd-item-active .cd-thumb {
          background:
            linear-gradient(180deg, #3b4f61 0%, #102a3f 100%) !important;
          border-color: rgba(255, 164, 90, 0.92) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -10px 18px rgba(0, 8, 22, 0.28),
            0 0 0 1px rgba(255, 122, 31, 0.3),
            0 8px 18px rgba(255, 107, 22, 0.18) !important;
        }
        .cd-thumb > svg:not(.cd-part-picture),
        .cd-thumb .lucide-more-horizontal,
        .cd-thumb .lucide-ellipsis {
          display: none !important;
        }
        .cd-thumb .cd-part-picture {
          display: block !important;
          border-radius: 8px !important;
          height: 100% !important;
          width: 100% !important;
        }
        .cd-thumb .cd-part-shadow * {
          fill: rgba(255, 255, 255, 0.18) !important;
          stroke: rgba(255, 255, 255, 0.22) !important;
        }
        .cd-thumb .cd-part-main * {
          stroke: #071827 !important;
        }
        .cd-thumb .cd-part-main circle,
        .cd-thumb .cd-part-main rect:not([fill="none"]) {
          fill: #071827 !important;
        }

        .cd-list:not(.cd-category-photo-list) {
          gap: 10px !important;
          padding: 12px 14px 16px !important;
        }
        .cd-list:not(.cd-category-photo-list) .cd-item {
          align-items: center !important;
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.08), transparent 38%),
            linear-gradient(180deg, rgba(75, 91, 109, 0.98) 0%, rgba(50, 64, 81, 0.98) 100%) !important;
          border-color: rgba(204, 216, 226, 0.38) !important;
          border-radius: 14px !important;
          display: flex !important;
          min-height: 58px !important;
          overflow: hidden !important;
          padding: 10px 12px !important;
          position: relative !important;
        }
        .cd-list:not(.cd-category-photo-list) .cd-item::before {
          background: rgba(205, 216, 226, 0.28) !important;
          bottom: 10px !important;
          content: "" !important;
          left: 0 !important;
          position: absolute !important;
          top: 10px !important;
          width: 3px !important;
        }
        .cd-list:not(.cd-category-photo-list) .cd-item-branch::before {
          background: linear-gradient(180deg, #ff9a24, #35d7f2) !important;
        }
        .cd-list:not(.cd-category-photo-list) .cd-item:hover {
          background:
            linear-gradient(90deg, rgba(255, 154, 36, 0.12), transparent 42%),
            linear-gradient(180deg, rgba(89, 106, 125, 1) 0%, rgba(60, 77, 96, 1) 100%) !important;
          border-color: rgba(255, 185, 112, 0.58) !important;
          transform: translateY(-1px) !important;
        }
        .cd-list:not(.cd-category-photo-list) .cd-item-active {
          background:
            linear-gradient(90deg, rgba(255, 122, 31, 0.32), rgba(80, 96, 113, 0.98) 48%, rgba(56, 72, 90, 0.98) 100%) !important;
          border-color: rgba(255, 166, 88, 0.82) !important;
        }
        .cd-list:not(.cd-category-photo-list) .cd-label {
          color: #f5f9fc !important;
          flex: 1 !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          line-height: 1.18 !important;
          min-width: 0 !important;
          text-shadow: 0 1px 10px rgba(0, 8, 22, 0.26) !important;
        }
        .cd-list:not(.cd-category-photo-list) .cd-item-leaf .cd-label {
          color: rgba(245, 249, 252, 0.92) !important;
          font-weight: 850 !important;
        }
        .cd-list:not(.cd-category-photo-list) .cd-icon-sm.cd-thumb {
          background:
            linear-gradient(180deg, rgba(229, 236, 243, 0.16), rgba(6, 21, 34, 0.16)),
            linear-gradient(180deg, #26394b 0%, #071827 100%) !important;
          border-color: rgba(203, 213, 225, 0.38) !important;
          border-radius: 12px !important;
          flex-basis: 42px !important;
          height: 40px !important;
          min-width: 42px !important;
          width: 42px !important;
        }
        .cd-list:not(.cd-category-photo-list) .cd-arrow,
        .cd-list:not(.cd-category-photo-list) .cd-check {
          margin-left: auto !important;
          flex: 0 0 auto !important;
        }

        .cd-drawer {
          max-width: min(94vw, 460px) !important;
          width: 460px !important;
        }

        .cd-category-photo-list {
          display: grid !important;
          gap: 14px !important;
          padding: 14px !important;
        }
        .cd-category-photo-list li {
          margin: 0 !important;
        }
        .cd-category-photo-card {
          --cd-category-photo: linear-gradient(135deg, #223445 0%, #071827 100%);
          align-items: flex-end !important;
          background:
            linear-gradient(180deg, rgba(5, 18, 31, 0.18), rgba(1, 10, 19, 0.78)),
            var(--cd-category-photo),
            radial-gradient(240px 130px at 78% 18%, rgba(126, 197, 240, 0.18), transparent 72%),
            linear-gradient(135deg, #223445 0%, #071827 100%) !important;
          background-position: center center, center center, center center, center center !important;
          background-repeat: no-repeat, no-repeat, no-repeat, no-repeat !important;
          background-size: cover, cover, cover, cover !important;
          border: 1px solid rgba(173, 186, 201, 0.28) !important;
          border-radius: 0 !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            inset 0 -50px 90px rgba(0, 8, 22, 0.66),
            0 18px 42px rgba(0, 8, 22, 0.34) !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: flex !important;
          min-height: 190px !important;
          overflow: hidden !important;
          padding: 22px !important;
          position: relative !important;
          text-align: left !important;
          width: 100% !important;
        }
        .cd-category-photo-card::before {
          display: none !important;
        }
        .cd-category-photo-card::after {
          background:
            linear-gradient(180deg, rgba(2, 12, 26, 0.12) 0%, rgba(2, 12, 26, 0.42) 48%, rgba(2, 12, 26, 0.94) 100%),
            linear-gradient(90deg, rgba(2, 12, 26, 0.68), rgba(2, 12, 26, 0.16) 60%, rgba(2, 12, 26, 0.3)) !important;
          content: "" !important;
          inset: 0 !important;
          position: absolute !important;
          z-index: 1 !important;
        }
        .cd-category-photo-card:hover {
          border-color: rgba(255, 164, 90, 0.72) !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -50px 90px rgba(0, 8, 22, 0.66),
            0 22px 52px rgba(0, 8, 22, 0.44),
            0 0 0 1px rgba(255, 122, 31, 0.2) !important;
          transform: translateY(-1px) !important;
        }
        .cd-category-photo-active {
          border-color: rgba(255, 164, 90, 0.9) !important;
        }
        .cd-category-photo-card.cd-thumb-engine,
        .cd-category-photo-card.cd-thumb-drivetrain {
          --cd-category-photo: url("/category-main/moottori-voimansiirto.png");
        }
        .cd-category-photo-card.cd-thumb-track,
        .cd-category-photo-card.cd-thumb-wheel,
        .cd-category-photo-card.cd-thumb-suspension,
        .cd-category-photo-card.cd-thumb-ski {
          --cd-category-photo: url("/category-main/alusta-telasto.png");
        }
        .cd-category-photo-card.cd-thumb-wheel {
          --cd-category-photo: url("/category-sub/rengas.png");
        }
        .cd-category-photo-card.cd-thumb-steering,
        .cd-category-photo-card.cd-thumb-controls,
        .cd-category-photo-card.cd-thumb-brake {
          --cd-category-photo: url("/category-main/ohjaus-hallintalaitteet.png");
        }
        .cd-category-photo-card.cd-thumb-electric,
        .cd-category-photo-card.cd-thumb-battery {
          --cd-category-photo: url("/category-main/sahkojarjestelmat.png");
        }
        .cd-category-photo-card.cd-thumb-cooling {
          --cd-category-photo: url("/category-sub/jaahdytys.png");
        }
        .cd-category-photo-card.cd-thumb-fuel {
          --cd-category-photo: url("/category-sub/polttoaine.png");
        }
        .cd-category-photo-card.cd-thumb-exhaust {
          --cd-category-photo: url("/category-main/pakoputkisto.png");
        }
        .cd-category-photo-card.cd-thumb-body,
        .cd-category-photo-card.cd-thumb-frame,
        .cd-category-photo-card.cd-thumb-glass,
        .cd-category-photo-card.cd-thumb-seat {
          --cd-category-photo: url("/category-main/runko-katteet.png");
        }
        .cd-category-photo-media {
          display: none !important;
        }
        .cd-category-photo-media::before,
        .cd-category-photo-media::after {
          display: none !important;
        }
        .cd-category-photo-media::before {
          background: linear-gradient(180deg, rgba(203, 213, 225, 0.18), rgba(203, 213, 225, 0.02)) !important;
          height: 44% !important;
          left: 0 !important;
          right: 0 !important;
          top: 0 !important;
        }
        .cd-category-photo-media::after {
          background:
            radial-gradient(circle at 22% 30%, rgba(230, 236, 242, 0.24) 0 8px, transparent 9px),
            radial-gradient(circle at 66% 26%, rgba(230, 236, 242, 0.18) 0 5px, transparent 6px),
            linear-gradient(90deg, rgba(230, 236, 242, 0.2), rgba(230, 236, 242, 0.04)) !important;
          height: 28% !important;
          left: -12% !important;
          opacity: 0.38 !important;
          top: 12% !important;
          transform: rotate(-8deg) !important;
          width: 124% !important;
        }
        .cd-category-photo-icon {
          display: none !important;
        }
        .cd-category-photo-icon .cd-part-picture {
          height: 86px !important;
          width: 118px !important;
        }
        .cd-category-photo-icon .cd-part-main *,
        .cd-category-photo-icon .cd-part-shadow * {
          stroke: rgba(229, 236, 243, 0.82) !important;
        }
        .cd-category-photo-icon .cd-part-main circle,
        .cd-category-photo-icon .cd-part-main rect:not([fill="none"]) {
          fill: rgba(229, 236, 243, 0.82) !important;
        }
        .cd-category-photo-title {
          color: #ffffff !important;
          font-size: 25px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          line-height: 1.02 !important;
          max-width: 86% !important;
          position: relative !important;
          text-shadow: 0 4px 18px rgba(0, 4, 12, 0.84) !important;
          text-transform: uppercase !important;
          z-index: 2 !important;
        }
        .cd-category-photo-arrow {
          display: none !important;
        }
        .cd-category-photo-card.cd-thumb-drivetrain::before,
        .cd-category-photo-card.cd-thumb-clutch::before,
        .cd-category-photo-card.cd-thumb-belt::before {
          background:
            repeating-linear-gradient(0deg, rgba(230, 236, 242, 0.1) 0 4px, transparent 4px 13px),
            radial-gradient(circle at 24% 28%, rgba(230, 236, 242, 0.26) 0 44px, transparent 46px),
            radial-gradient(circle at 72% 18%, rgba(230, 236, 242, 0.12) 0 30px, transparent 32px),
            linear-gradient(135deg, rgba(82, 96, 112, 0.56), rgba(5, 18, 31, 0.78)) !important;
        }
        .cd-category-photo-card.cd-thumb-suspension::before,
        .cd-category-photo-card.cd-thumb-track::before,
        .cd-category-photo-card.cd-thumb-ski::before {
          background:
            linear-gradient(108deg, transparent 0 32%, rgba(230, 236, 242, 0.16) 33% 36%, transparent 37%),
            radial-gradient(ellipse at 56% 42%, rgba(230, 236, 242, 0.2) 0 48px, transparent 50px),
            linear-gradient(135deg, rgba(35, 64, 88, 0.72), rgba(5, 18, 31, 0.82)) !important;
        }
        .cd-category-photo-card.cd-thumb-electric::before,
        .cd-category-photo-card.cd-thumb-battery::before {
          background:
            linear-gradient(112deg, transparent 0 45%, rgba(255, 169, 64, 0.22) 46% 49%, transparent 50%),
            radial-gradient(circle at 72% 24%, rgba(255, 169, 64, 0.16) 0 44px, transparent 46px),
            linear-gradient(135deg, rgba(47, 66, 83, 0.72), rgba(4, 15, 28, 0.82)) !important;
        }
        .cd-category-photo-card.cd-thumb-cooling::before,
        .cd-category-photo-card.cd-thumb-fuel::before {
          background:
            radial-gradient(ellipse at 72% 24%, rgba(95, 214, 235, 0.18) 0 44px, transparent 46px),
            radial-gradient(ellipse at 28% 52%, rgba(230, 236, 242, 0.15) 0 34px, transparent 36px),
            linear-gradient(135deg, rgba(28, 75, 92, 0.7), rgba(4, 15, 28, 0.84)) !important;
        }
        .cd-category-photo-card.cd-thumb-exhaust::before {
          background:
            linear-gradient(16deg, transparent 0 34%, rgba(230, 236, 242, 0.18) 35% 38%, transparent 39%),
            radial-gradient(ellipse at 66% 32%, rgba(230, 236, 242, 0.17) 0 48px, transparent 50px),
            linear-gradient(135deg, rgba(80, 86, 94, 0.68), rgba(4, 15, 28, 0.84)) !important;
        }
        .cd-category-photo-card.cd-thumb-frame::before,
        .cd-category-photo-card.cd-thumb-body::before,
        .cd-category-photo-card.cd-thumb-glass::before,
        .cd-category-photo-card.cd-thumb-seat::before {
          background:
            linear-gradient(126deg, transparent 0 18%, rgba(230, 236, 242, 0.12) 19% 42%, transparent 43%),
            radial-gradient(ellipse at 70% 34%, rgba(230, 236, 242, 0.13) 0 54px, transparent 56px),
            linear-gradient(135deg, rgba(68, 84, 101, 0.7), rgba(4, 15, 28, 0.84)) !important;
        }
        /* Sub-group list (step 4) */
        .cd-sub-group-list {
          display: grid !important;
          gap: 10px !important;
          padding: 12px 14px 16px !important;
        }
        .cd-sub-group-list li {
          margin: 0 !important;
        }
        .cd-sub-group-list .cd-category-photo-card {
          background:
            var(--cd-category-photo),
            linear-gradient(135deg, #223445 0%, #071827 100%) !important;
          background-position: center top !important;
          background-repeat: no-repeat !important;
          background-size: cover !important;
          border-radius: 14px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 -30px 50px rgba(0, 4, 14, 0.28),
            0 14px 32px rgba(0, 4, 14, 0.22) !important;
          min-height: 210px !important;
          padding: 16px 18px !important;
        }
        .cd-sub-group-list .cd-category-photo-card::after {
          background:
            linear-gradient(180deg, rgba(2, 10, 20, 0.0) 0%, rgba(2, 10, 20, 0.0) 65%, rgba(2, 10, 20, 0.82) 100%),
            linear-gradient(90deg, rgba(2, 10, 20, 0.04), transparent 50%) !important;
        }
        .cd-sub-group-list .cd-category-photo-title {
          font-size: 19px !important;
        }
        /* Sub-group image slots — point each subgroup at its dedicated PNG. */
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-moottorit {
          --cd-category-photo: url("/category-sub/moottorit.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-kytkimet {
          --cd-category-photo: url("/category-sub/kytkimet.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-variaattorit {
          --cd-category-photo: url("/category-sub/variaattorit.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-voimansiirto {
          --cd-category-photo: url("/category-sub/voimansiirto.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-telasto {
          --cd-category-photo: url("/category-sub/telasto.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-alusta {
          --cd-category-photo: url("/category-sub/alusta.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-renkaat-vanteet {
          --cd-category-photo: url("/category-sub/rengas.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-tukivarret {
          --cd-category-photo: url("/category-sub/tukivarret.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-iskunvaimentimet {
          --cd-category-photo: url("/category-sub/iskunvaimentimet.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-ohjaus {
          --cd-category-photo: url("/category-sub/ohjaus.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-hallintalaitteet {
          --cd-category-photo: url("/category-sub/Hallintalaitteet.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-jarrut {
          --cd-category-photo: url("/category-sub/jarrut.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-sukset {
          --cd-category-photo: url("/category-sub/sukset.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-sahko {
          --cd-category-photo: url("/category-sub/sahko.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-sytytys {
          --cd-category-photo: url("/category-sub/sytytys.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-jaahdytys {
          --cd-category-photo: url("/category-sub/jaahdytys.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-polttoaine {
          --cd-category-photo: url("/category-sub/polttoaine.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-pakoputkisto {
          --cd-category-photo: url("/category-sub/putkisto.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-runko {
          --cd-category-photo: url("/category-sub/runko.png") !important;
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-katteet {
          --cd-category-photo: url("/category-sub/katteet.png") !important;
        }

        /* Final category drawer cleanup: no grey slabs, and vehicle fields stay white. */
        .cd-start-hero {
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          padding: 2px 2px 10px !important;
        }
        .cd-start-eyebrow {
          background: transparent !important;
          background-image: none !important;
          box-shadow: none !important;
          display: inline-block !important;
          padding: 0 !important;
          width: auto !important;
        }
        .cd-extra-filters,
        .cd-extra-row,
        .cd-extra-field,
        .cd-skip-row {
          background: transparent !important;
          border-color: rgba(126, 197, 240, 0.18) !important;
          box-shadow: none !important;
        }
        .cd-extra-filters {
          padding-top: 10px !important;
        }
        .cd-search-row,
        .cd-cc-select,
        .cd-extra-field .cd-input {
          background: #eef6fc !important;
          border: 1px solid rgba(126, 197, 240, 0.42) !important;
          color: #071827 !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.75),
            0 8px 18px rgba(0, 8, 22, 0.12) !important;
        }
        .cd-search-row:focus-within,
        .cd-cc-select:focus,
        .cd-extra-field .cd-input:focus {
          border-color: rgba(255, 145, 38, 0.86) !important;
          box-shadow:
            0 0 0 1px rgba(255, 145, 38, 0.28),
            0 14px 30px rgba(255, 107, 22, 0.14) !important;
        }
        .cd-search-row .cd-input {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          color: #071827 !important;
        }
        .cd-input::placeholder {
          color: rgba(71, 85, 105, 0.72) !important;
        }
        .cd-cc-select option {
          background: #eef6fc;
          color: #071827;
        }

        @media (max-width: 520px) {
          .cd-drawer {
            width: 100vw !important;
            max-width: 100vw !important;
          }

          .cd-list:not(.cd-category-photo-list) {
            display: grid !important;
            gap: 9px !important;
            grid-template-columns: 1fr !important;
            padding: 12px 14px 18px !important;
          }

          .cd-list:not(.cd-category-photo-list) .cd-item,
          .cd-list:not(.cd-category-photo-list) .cd-item-leaf {
            align-items: center !important;
            display: grid !important;
            gap: 10px !important;
            grid-template-columns: 46px minmax(0, 1fr) 28px !important;
            min-height: 62px !important;
            padding: 9px 10px !important;
            width: 100% !important;
          }

          .cd-list:not(.cd-category-photo-list) .cd-item-leaf::before {
            left: 0 !important;
          }

          .cd-list:not(.cd-category-photo-list) .cd-icon-sm.cd-thumb {
            flex: 0 0 46px !important;
            height: 42px !important;
            min-width: 46px !important;
            width: 46px !important;
          }

          .cd-list:not(.cd-category-photo-list) .cd-label {
            display: block !important;
            font-size: 13px !important;
            line-height: 1.18 !important;
            min-width: 0 !important;
            overflow: visible !important;
            overflow-wrap: anywhere !important;
            text-overflow: clip !important;
            white-space: normal !important;
          }

          .cd-list:not(.cd-category-photo-list) .cd-arrow,
          .cd-list:not(.cd-category-photo-list) .cd-check {
            justify-self: end !important;
            margin-left: 0 !important;
          }

          .cd-category-photo-card {
            min-height: 166px !important;
            padding: 18px !important;
          }
          .cd-sub-group-list .cd-category-photo-card {
            min-height: 110px !important;
            padding: 14px 16px !important;
          }
          .cd-category-photo-title {
            font-size: 21px !important;
          }
          .cd-sub-group-list .cd-category-photo-title {
            font-size: 17px !important;
          }
          .cd-category-photo-icon {
            right: -18px !important;
            transform: scale(2.36) rotate(-5deg) !important;
          }
        }

        /* Final placement: keep the drawer below the app topbar and remove the stray filter pill. */
        .cd-backdrop {
          top: var(--topbar-h, 72px) !important;
          z-index: 980 !important;
        }

        .cd-drawer {
          top: var(--topbar-h, 72px) !important;
          bottom: 0 !important;
          height: calc(100dvh - var(--topbar-h, 72px)) !important;
          z-index: 990 !important;
          border-top: 1px solid rgba(151, 178, 205, 0.18) !important;
        }

        .cd-header {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          display: flex !important;
          gap: 8px !important;
          justify-content: flex-start !important;
          left: 16px !important;
          min-height: 46px !important;
          padding: 0 !important;
          pointer-events: none !important;
          position: absolute !important;
          right: 16px !important;
          top: 10px !important;
          z-index: 3020 !important;
        }

        .cd-body {
          inset: auto !important;
          position: relative !important;
          padding-top: 58px !important;
          width: auto !important;
        }

        .cd-category-photo-list {
          padding-top: 92px !important;
        }

        .cd-filter-submit {
          align-items: center !important;
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 100%) !important;
          border: 1px solid rgba(255, 224, 194, 0.78) !important;
          border-radius: 999px !important;
          box-shadow: 0 12px 24px rgba(255, 107, 22, 0.24) !important;
          color: #ffffff !important;
          display: inline-flex !important;
          flex: 0 0 34px !important;
          height: 34px !important;
          justify-content: center !important;
          max-width: 34px !important;
          min-height: 34px !important;
          min-width: 34px !important;
          padding: 0 !important;
          pointer-events: auto !important;
          margin-right: 4px !important;
          width: 34px !important;
        }

        .cd-close {
          align-items: center !important;
          background: linear-gradient(135deg, #ff9a24 0%, #ff6b16 100%) !important;
          border: 1px solid rgba(255, 224, 194, 0.78) !important;
          border-radius: 999px !important;
          box-shadow: 0 12px 24px rgba(255, 107, 22, 0.22) !important;
          color: #ffffff !important;
          display: inline-flex !important;
          flex: 0 0 34px !important;
          height: 34px !important;
          justify-content: center !important;
          margin-left: auto !important;
          max-width: 34px !important;
          min-height: 34px !important;
          min-width: 34px !important;
          padding: 0 !important;
          pointer-events: auto !important;
          position: relative !important;
          width: 34px !important;
          z-index: 21 !important;
        }

        .cd-back {
          align-items: center !important;
          background: rgba(8, 22, 36, 0.78) !important;
          border: 1px solid rgba(216, 226, 236, 0.32) !important;
          border-radius: 999px !important;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.32) !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: inline-flex !important;
          flex: 0 0 34px !important;
          height: 34px !important;
          justify-content: center !important;
          max-width: 34px !important;
          margin-right: 0 !important;
          min-height: 34px !important;
          min-width: 34px !important;
          padding: 0 !important;
          pointer-events: auto !important;
          position: relative !important;
          width: 34px !important;
          z-index: 21 !important;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .cd-back:hover {
          background: rgba(255, 122, 31, 0.92) !important;
          border-color: rgba(255, 210, 168, 0.78) !important;
        }

        .cd-crumbs {
          align-items: flex-start !important;
          background: rgba(4, 16, 31, 0.9) !important;
          border: 1px solid rgba(151, 178, 205, 0.18) !important;
          border-radius: 12px !important;
          box-shadow: none !important;
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
          margin: 58px 12px 0 !important;
          overflow: visible !important;
          padding: 10px !important;
          scrollbar-width: none !important;
          position: relative !important;
          z-index: 25 !important;
          white-space: normal !important;
        }

        .cd-crumbs::-webkit-scrollbar {
          display: none !important;
        }

        .cd-crumb-seg,
        .cd-crumb-item {
          align-items: center !important;
          display: inline-flex !important;
          flex: 0 0 auto !important;
        }

        .cd-crumb-item {
          background: rgba(13, 31, 49, 0.96) !important;
          border: 1px solid rgba(151, 178, 205, 0.28) !important;
          border-radius: 10px !important;
          gap: 2px !important;
          min-height: 30px !important;
          padding: 0 5px 0 9px !important;
        }

        .cd-crumb-btn {
          background: transparent !important;
          border: 0 !important;
          color: rgba(226, 235, 244, 0.92) !important;
          cursor: pointer !important;
          font-size: 12px !important;
          font-weight: 800 !important;
          min-height: 0 !important;
          padding: 0 !important;
          white-space: nowrap !important;
        }

        .cd-crumb-btn:hover,
        .cd-crumb-current:hover {
          background: transparent !important;
          color: #ffffff !important;
        }

        .cd-crumb-current {
          color: #ffffff !important;
        }

        .cd-crumb-x {
          align-items: center !important;
          background: rgba(151, 178, 205, 0.13) !important;
          border: 1px solid rgba(151, 178, 205, 0.28) !important;
          border-radius: 999px !important;
          color: rgba(226, 244, 255, 0.86) !important;
          cursor: pointer !important;
          display: inline-flex !important;
          font-size: 11px !important;
          font-weight: 900 !important;
          height: 22px !important;
          justify-content: center !important;
          margin-left: 5px !important;
          min-height: 22px !important;
          padding: 0 !important;
          width: 22px !important;
        }

        .cd-crumb-x:hover {
          background: rgba(239, 68, 68, 0.9) !important;
          border-color: rgba(255, 190, 190, 0.72) !important;
          color: #ffffff !important;
        }

        .cd-crumb-sep {
          color: rgba(151, 178, 205, 0.5) !important;
          flex: 0 0 auto !important;
          margin: 0 2px !important;
        }

        .cd-drawer:has(.cd-crumbs) .cd-body {
          padding-top: 14px !important;
        }

        .cd-drawer:has(.cd-crumbs) .cd-category-photo-list {
          padding-top: 18px !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-cylinder,
        .cd-list .cd-category-photo-card.cd-thumb-head,
        .cd-list .cd-category-photo-card.cd-thumb-piston,
        .cd-list .cd-category-photo-card.cd-thumb-crank,
        .cd-list .cd-category-photo-card.cd-thumb-block,
        .cd-list .cd-category-photo-card.cd-thumb-bearing {
          --cd-category-photo: url("/category-sub/moottorit.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-clutch {
          --cd-category-photo: url("/category-sub/kytkimet.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-variator {
          --cd-category-photo: url("/category-sub/variaattorit.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-belt {
          --cd-category-photo: url("/category-sub/voimansiirto.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-track {
          --cd-category-photo: url("/category-sub/telasto.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-wheel {
          --cd-category-photo: url("/category-sub/rengas.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-suspension {
          --cd-category-photo: url("/category-sub/alusta.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-steering {
          --cd-category-photo: url("/category-sub/ohjaus.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-controls {
          --cd-category-photo: url("/category-sub/Hallintalaitteet.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-brake {
          --cd-category-photo: url("/category-sub/jarrut.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-ski {
          --cd-category-photo: url("/category-sub/sukset.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-electric,
        .cd-list .cd-category-photo-card.cd-thumb-battery {
          --cd-category-photo: url("/category-sub/sahko.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-cooling {
          --cd-category-photo: url("/category-sub/jaahdytys.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-fuel {
          --cd-category-photo: url("/category-sub/polttoaine.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-exhaust {
          --cd-category-photo: url("/category-sub/putkisto.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-body,
        .cd-list .cd-category-photo-card.cd-thumb-glass {
          --cd-category-photo: url("/category-sub/katteet.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-thumb-frame,
        .cd-list .cd-category-photo-card.cd-thumb-seat {
          --cd-category-photo: url("/category-sub/runko.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-main-moottori-voimansiirto {
          --cd-category-photo: url("/category-main/moottori-voimansiirto.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-main-alusta-telasto {
          --cd-category-photo: url("/category-main/alusta-telasto.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-main-ohjaus-hallintalaitteet {
          --cd-category-photo: url("/category-main/ohjaus-hallintalaitteet.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-main-sahkojarjestelmat {
          --cd-category-photo: url("/category-main/sahkojarjestelmat.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-main-jaahdytys-polttoaine {
          --cd-category-photo: url("/category-main/jaahdytys-polttoaine.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-main-pakoputkisto {
          --cd-category-photo: url("/category-main/pakoputkisto.png") !important;
        }

        .cd-list .cd-category-photo-card.cd-main-runko-katteet {
          --cd-category-photo: url("/category-main/runko-katteet.png") !important;
        }

        .cd-list .cd-category-photo-card {
          background:
            linear-gradient(135deg, #223445 0%, #071827 100%) !important;
          border-color: rgba(173, 186, 201, 0.28) !important;
          color: #ffffff !important;
        }

        .cd-list .cd-category-photo-card::before {
          background: var(--cd-category-photo) !important;
          background-position: right center !important;
          background-repeat: no-repeat !important;
          background-size: cover !important;
          content: "" !important;
          display: block !important;
          filter: brightness(1.42) contrast(1.08) saturate(1.06) !important;
          inset: 0 !important;
          opacity: 0.94 !important;
          position: absolute !important;
          transform: scale(1.025) !important;
          z-index: 0 !important;
        }

        .cd-list .cd-category-photo-card::after {
          background:
            linear-gradient(90deg, rgba(2, 12, 26, 0.82) 0%, rgba(2, 12, 26, 0.42) 48%, rgba(2, 12, 26, 0.14) 100%),
            linear-gradient(180deg, rgba(2, 12, 26, 0.02) 0%, rgba(2, 12, 26, 0.32) 100%) !important;
          z-index: 1 !important;
        }

        .cd-list .cd-category-photo-card:hover,
        .cd-list .cd-category-photo-card.cd-category-photo-active {
          border-color: rgba(255, 164, 90, 0.9) !important;
          color: #ffffff !important;
        }

        .cd-leaf-photo-list {
          gap: 8px !important;
          padding: 10px 12px 14px !important;
        }

        .cd-leaf-photo-list .cd-category-photo-card {
          align-items: center !important;
          background:
            var(--cd-category-photo),
            linear-gradient(180deg, rgba(12, 28, 44, 0.96), rgba(7, 18, 31, 0.98)) !important;
          background-position: center !important;
          background-size: cover !important;
          border-color: rgba(151, 178, 205, 0.24) !important;
          box-shadow: none !important;
          min-height: 62px !important;
          padding: 10px 14px !important;
        }

        .cd-leaf-photo-list .cd-category-photo-card::before {
          background:
            linear-gradient(90deg, rgba(2, 12, 26, 0.78), rgba(2, 12, 26, 0.18)),
            var(--cd-category-photo) !important;
          background-position: center !important;
          background-size: cover !important;
          content: "" !important;
          display: block !important;
          inset: 0 !important;
          opacity: 0.86 !important;
          position: absolute !important;
          z-index: 0 !important;
        }

        .cd-leaf-photo-list .cd-category-photo-card::after {
          background: linear-gradient(90deg, rgba(2, 12, 26, 0.82), rgba(2, 12, 26, 0.26)) !important;
          z-index: 1 !important;
        }

        .cd-leaf-photo-list .cd-category-photo-title {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          font-size: 15px !important;
          line-height: 1.1 !important;
          min-height: 0 !important;
          padding: 0 !important;
          position: relative !important;
          z-index: 2 !important;
        }

        .cd-final-leaf-list {
          display: grid !important;
          gap: 8px !important;
          padding: 10px 12px 14px !important;
        }

        .cd-final-leaf-item {
          align-items: center !important;
          background:
            linear-gradient(180deg, rgba(8, 25, 41, 0.98), rgba(5, 17, 30, 0.98)) !important;
          border: 1px solid rgba(151, 178, 205, 0.28) !important;
          border-radius: 8px !important;
          box-shadow: none !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          min-height: 43px !important;
          padding: 0 14px !important;
        }

        .cd-final-leaf-item::before {
          display: none !important;
          content: none !important;
        }

        .cd-final-leaf-item .cd-label {
          color: #ffffff !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          line-height: 1.15 !important;
          min-width: 0 !important;
          overflow-wrap: anywhere !important;
        }

        .cd-final-leaf-item .cd-arrow,
        .cd-final-leaf-item .cd-check {
          justify-self: end !important;
          margin: 0 !important;
        }

        .cd-final-leaf-item:hover,
        .cd-final-leaf-item.cd-item-active {
          background:
            linear-gradient(180deg, rgba(15, 35, 52, 0.98), rgba(8, 23, 37, 0.98)) !important;
          border-color: rgba(255, 122, 24, 0.95) !important;
        }

        .cd-close {
          align-items: center !important;
          display: inline-flex !important;
          justify-content: center !important;
          margin-left: auto !important;
          position: relative !important;
          z-index: 5 !important;
        }

        body:has(.cd-drawer-open) .bottom-nav {
          display: none !important;
        }

        body:has(.cd-drawer-open) .universal-app-topbar {
          background: rgba(3, 9, 20, 0.96) !important;
          display: grid !important;
          left: 0 !important;
          min-height: var(--topbar-h, 72px) !important;
          opacity: 1 !important;
          position: fixed !important;
          right: 0 !important;
          top: 0 !important;
          transform: none !important;
          visibility: visible !important;
          width: 100% !important;
          z-index: 4000 !important;
        }

        body:has(.cd-drawer-open) .universal-app-topbar.universal-home-topbar,
        body:has(.cd-drawer-open) header.universal-app-topbar,
        body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar {
          background: rgba(3, 9, 20, 0.96) !important;
          display: grid !important;
          left: 0 !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          position: fixed !important;
          right: 0 !important;
          top: 0 !important;
          transform: none !important;
          visibility: visible !important;
          width: 100% !important;
          z-index: 4000 !important;
        }

        body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-navigation,
        body:has(.cd-drawer-open) header.universal-app-topbar .universal-primary-navigation,
        body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-brand,
        body:has(.cd-drawer-open) header.universal-app-topbar .universal-topbar-actions {
          opacity: 1 !important;
          pointer-events: auto !important;
          visibility: visible !important;
        }

        @media (max-width: 520px) {
          .cd-backdrop {
            top: var(--topbar-h, 72px) !important;
            z-index: 980 !important;
          }

          .cd-drawer {
            border-top: 1px solid rgba(151, 178, 205, 0.18) !important;
            top: var(--topbar-h, 72px) !important;
            height: calc(100dvh - var(--topbar-h, 72px)) !important;
            z-index: 990 !important;
          }

          .cd-header {
            padding-top: max(10px, env(safe-area-inset-top)) !important;
            right: 14px !important;
            top: max(10px, env(safe-area-inset-top)) !important;
          }
        }

        @media (max-width: 720px) {
          .cd-backdrop {
            inset: var(--topbar-h, 72px) 0 0 0 !important;
            top: var(--topbar-h, 72px) !important;
            z-index: 980 !important;
          }

          .cd-drawer {
            border-radius: 0 !important;
            border-top: 1px solid rgba(151, 178, 205, 0.18) !important;
            inset: var(--topbar-h, 72px) 0 0 0 !important;
            height: calc(100dvh - var(--topbar-h, 72px)) !important;
            max-height: calc(100dvh - var(--topbar-h, 72px)) !important;
            max-width: 100vw !important;
            top: var(--topbar-h, 72px) !important;
            width: 100vw !important;
            z-index: 990 !important;
          }

          .cd-body {
            padding-bottom: calc(24px + env(safe-area-inset-bottom)) !important;
            padding-top: calc(58px + env(safe-area-inset-top)) !important;
          }

          .cd-header {
            align-items: center !important;
            background: rgba(4, 16, 31, 0.78) !important;
            border: 1px solid rgba(151, 178, 205, 0.18) !important;
            border-radius: 18px !important;
            box-shadow: 0 14px 34px rgba(0, 8, 22, 0.26) !important;
            display: flex !important;
            gap: 8px !important;
            left: 12px !important;
            padding: 8px !important;
            right: 12px !important;
            top: max(8px, env(safe-area-inset-top)) !important;
            width: auto !important;
          }

          .cd-header .cd-filter-submit,
          .cd-header .cd-back,
          .cd-header .cd-close {
            flex: 0 0 34px !important;
            height: 34px !important;
            margin: 0 !important;
            min-height: 34px !important;
            min-width: 34px !important;
            width: 34px !important;
          }

          .cd-header .cd-close {
            margin-left: auto !important;
          }

          .cd-drawer .cd-crumbs {
            margin-top: calc(66px + env(safe-area-inset-top)) !important;
          }

          .cd-drawer:has(.cd-crumbs) .cd-body {
            padding-top: 8px !important;
          }

          body:has(.cd-drawer-open) .heroWrap,
          body:has(.cd-drawer-open) .topbar,
          body:has(.cd-drawer-open) .bottom-nav,
          body:has(.cd-drawer-open) .floating-chat,
          body:has(.cd-drawer-open) .fc-button {
            pointer-events: none !important;
          }
        }

        /* Final exact image map: exact category wins over generic part-kind guesses. */
        .cd-category-photo-card.cd-subgrp-moottorit {
          --cd-category-photo: url("/category-sub/moottorit.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-kytkimet {
          --cd-category-photo: url("/category-sub/kytkimet.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-variaattorit {
          --cd-category-photo: url("/category-sub/variaattorit.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-voimansiirto {
          --cd-category-photo: url("/category-sub/voimansiirto.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-telasto {
          --cd-category-photo: url("/category-sub/telasto.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-alusta {
          --cd-category-photo: url("/category-sub/alusta.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-renkaat-vanteet {
          --cd-category-photo: url("/category-sub/rengas.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-tukivarret {
          --cd-category-photo: url("/category-sub/tukivarret.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-iskunvaimentimet {
          --cd-category-photo: url("/category-sub/iskunvaimentimet.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-ohjaus {
          --cd-category-photo: url("/category-sub/ohjaus.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-hallintalaitteet {
          --cd-category-photo: url("/category-sub/Hallintalaitteet.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-jarrut {
          --cd-category-photo: url("/category-sub/jarrut.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-sukset {
          --cd-category-photo: url("/category-sub/sukset.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-sahko {
          --cd-category-photo: url("/category-sub/sahko.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-sytytys {
          --cd-category-photo: url("/category-sub/sytytys.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-jaahdytys {
          --cd-category-photo: url("/category-sub/jaahdytys.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-polttoaine {
          --cd-category-photo: url("/category-sub/polttoaine.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-pakoputkisto {
          --cd-category-photo: url("/category-sub/putkisto.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-runko {
          --cd-category-photo: url("/category-sub/runko.png") !important;
        }
        .cd-category-photo-card.cd-subgrp-katteet {
          --cd-category-photo: url("/category-sub/katteet.png") !important;
        }

        /* Same image lock with stronger specificity for every drawer/page. */
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-moottorit {
          --cd-category-photo: url("/category-sub/moottorit.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-kytkimet {
          --cd-category-photo: url("/category-sub/kytkimet.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-variaattorit {
          --cd-category-photo: url("/category-sub/variaattorit.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-voimansiirto {
          --cd-category-photo: url("/category-sub/voimansiirto.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-telasto {
          --cd-category-photo: url("/category-sub/telasto.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-alusta {
          --cd-category-photo: url("/category-sub/alusta.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-renkaat-vanteet {
          --cd-category-photo: url("/category-sub/rengas.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-tukivarret {
          --cd-category-photo: url("/category-sub/tukivarret.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-iskunvaimentimet {
          --cd-category-photo: url("/category-sub/iskunvaimentimet.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-ohjaus {
          --cd-category-photo: url("/category-sub/ohjaus.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-hallintalaitteet {
          --cd-category-photo: url("/category-sub/Hallintalaitteet.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-jarrut {
          --cd-category-photo: url("/category-sub/jarrut.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-sukset {
          --cd-category-photo: url("/category-sub/sukset.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-sahko {
          --cd-category-photo: url("/category-sub/sahko.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-sytytys {
          --cd-category-photo: url("/category-sub/sytytys.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-jaahdytys {
          --cd-category-photo: url("/category-sub/jaahdytys.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-polttoaine {
          --cd-category-photo: url("/category-sub/polttoaine.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-pakoputkisto {
          --cd-category-photo: url("/category-sub/putkisto.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-runko {
          --cd-category-photo: url("/category-sub/runko.png") !important;
        }
        .cd-list.cd-sub-group-list .cd-category-photo-card.cd-subgrp-katteet {
          --cd-category-photo: url("/category-sub/katteet.png") !important;
        }

        /* Final lock: vehicle refinement is a readable standalone page. */
        .cd-drawer .cd-body > .cd-vehicle-step {
          align-content: start !important;
          grid-template-rows: auto auto auto !important;
          padding: 14px !important;
        }
        .cd-drawer .cd-vehicle-step .cd-vehicle-step-head {
          align-self: start !important;
          min-height: 0 !important;
          padding: 12px 14px !important;
        }
        .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 12px !important;
          margin: 0 !important;
          padding: 14px !important;
        }
        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel {
          align-content: start !important;
          background:
            linear-gradient(180deg, rgba(7, 31, 54, 0.98), rgba(3, 17, 32, 0.98)) !important;
          border: 1px solid rgba(126, 197, 240, 0.24) !important;
          border-radius: 12px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 16px 34px rgba(0, 8, 22, 0.2) !important;
          display: grid !important;
          gap: 10px !important;
          margin: 0 !important;
          padding: 14px !important;
        }
        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel > .cd-step-hint {
          background: transparent !important;
          border: 0 !important;
          color: rgba(216, 226, 236, 0.72) !important;
          font-size: 11px !important;
          font-weight: 950 !important;
          line-height: 1 !important;
          margin: 0 !important;
          padding: 0 !important;
          text-transform: uppercase !important;
        }
        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel > .cd-vehicle-detail-grid {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          display: grid !important;
          gap: 12px !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel .cd-detail-field:last-child {
          grid-column: 1 / -1 !important;
        }

        .cd-drawer .cd-field-label {
          font-size: 12px !important;
          line-height: 1.05 !important;
        }

        .cd-drawer .cd-combo-control,
        .cd-drawer .cd-vehicle-type-trigger {
          min-height: 48px !important;
        }

        .cd-drawer .cd-combo-input,
        .cd-drawer .cd-vehicle-type-trigger strong {
          font-size: 13px !important;
        }

        .cd-drawer .cd-combo-control {
          grid-template-columns: 28px minmax(0, 1fr) 24px !important;
          padding: 0 10px !important;
        }
        .cd-drawer .cd-vehicle-step .cd-detail-field {
          min-width: 0 !important;
          overflow: visible !important;
          border: 0 !important;
          background: transparent !important;
          padding: 0 !important;
        }
        .cd-drawer .cd-vehicle-step .cd-field-label {
          white-space: normal !important;
        }
        .cd-drawer .cd-vehicle-step .cd-cc-select,
        .cd-drawer .cd-vehicle-step .cd-input {
          max-width: 100% !important;
          min-width: 0 !important;
        }
        .cd-drawer .cd-vehicle-step .cd-vehicle-actions {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto !important;
        }
        .cd-drawer .cd-vehicle-step .cd-vehicle-actions button {
          writing-mode: horizontal-tb !important;
        }
        /* Final lock: every dropdown surface inside the category drawer stays dark. */
        .cd-drawer .cd-cc-select,
        .cd-drawer .cd-combo-input {
          background:
            linear-gradient(180deg, rgba(8, 31, 52, 0.98), rgba(4, 19, 36, 0.98)) !important;
          border-color: rgba(126, 197, 240, 0.38) !important;
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }
        .cd-drawer .cd-cc-select option {
          background: #06182a !important;
          color: #ffffff !important;
          font-weight: 850 !important;
        }
        .cd-drawer .cd-combo-menu {
          background: #06182a !important;
          border-color: rgba(126, 197, 240, 0.38) !important;
          box-shadow: 0 18px 34px rgba(0, 8, 22, 0.44) !important;
          scrollbar-color: rgba(126, 197, 240, 0.45) transparent !important;
        }
        .cd-drawer .cd-combo-option {
          background: rgba(8, 31, 52, 0.72) !important;
          color: #ffffff !important;
        }
        .cd-drawer .cd-combo-option:hover,
        .cd-drawer .cd-combo-option-active {
          background: #92c2f1 !important;
          color: #031326 !important;
        }
        .cd-vehicle-type-menu .cd-vehicle-type-options,
        .cd-category-vehicle-inline .cd-vehicle-type-options,
        .cd-drawer .cd-vehicle-type-options {
          position: absolute !important;
          top: calc(100% + 8px) !important;
          right: 0 !important;
          left: 0 !important;
          z-index: 120 !important;
          background: #06182a !important;
          background-color: #06182a !important;
          background-image: none !important;
          color: #ffffff !important;
          box-shadow:
            inset 0 0 0 9999px #06182a,
            0 18px 34px rgba(0, 8, 22, 0.44) !important;
        }
        .cd-vehicle-type-menu,
        .cd-category-vehicle-inline .cd-vehicle-type-menu,
        .cd-drawer .cd-vehicle-type-menu {
          position: relative !important;
        }
        .cd-category-vehicle-inline {
          align-items: start !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          min-height: 172px !important;
          overflow: visible !important;
        }
        .cd-category-vehicle-inline .cd-step-hint {
          grid-column: 1 / -1 !important;
        }
        .cd-category-vehicle-inline .cd-vehicle-type-menu {
          align-self: start !important;
          min-width: 0 !important;
        }
        .cd-vehicle-step-head .cd-vehicle-type-trigger,
        .cd-category-vehicle-inline .cd-vehicle-type-trigger,
        .cd-drawer .cd-vehicle-type-trigger,
        .cd-drawer .cd-vehicle-type-menu.is-open .cd-vehicle-type-trigger,
        .cd-category-vehicle-inline .cd-vehicle-type-menu.is-open .cd-vehicle-type-trigger {
          border: 1.5px solid #ff7a1f !important;
          box-shadow:
            0 0 0 1px rgba(255, 122, 31, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
        }
        .cd-vehicle-step-head .cd-vehicle-type-options,
        .cd-category-vehicle-inline .cd-vehicle-type-options,
        .cd-drawer .cd-vehicle-type-options {
          border: 1.5px solid #ff7a1f !important;
        }
        .cd-vehicle-step-head .cd-vehicle-head-fields,
        .cd-category-vehicle-inline {
          grid-template-columns: minmax(170px, 1fr) minmax(170px, 1fr) !important;
        }
        .cd-vehicle-step-head .cd-vehicle-type-trigger,
        .cd-category-vehicle-inline .cd-vehicle-type-trigger,
        .cd-drawer .cd-vehicle-type-trigger {
          height: auto !important;
          min-height: 46px !important;
          padding: 7px 12px !important;
        }
        .cd-vehicle-step-head .cd-vehicle-type-trigger strong,
        .cd-category-vehicle-inline .cd-vehicle-type-trigger strong,
        .cd-drawer .cd-vehicle-type-trigger strong {
          font-size: clamp(12px, 1.05vw, 16px) !important;
          line-height: 1.12 !important;
          display: -webkit-box !important;
          max-height: 2.3em !important;
          overflow: hidden !important;
          overflow-wrap: normal !important;
          text-overflow: ellipsis !important;
          white-space: normal !important;
          word-break: normal !important;
          -webkit-box-orient: vertical !important;
          -webkit-line-clamp: 2 !important;
        }
        .cd-vehicle-step .cd-cc-select,
        .cd-vehicle-step .cd-input,
        .cd-vehicle-step .cd-combo-input,
        .cd-category-vehicle-inline .cd-cc-select,
        .cd-category-vehicle-inline .cd-input,
        .cd-category-vehicle-inline .cd-combo-input {
          font-size: clamp(11px, 1.05vw, 13px) !important;
          line-height: 1.22 !important;
          min-height: 46px !important;
          overflow: visible !important;
          overflow-wrap: anywhere !important;
          padding-bottom: 6px !important;
          padding-top: 6px !important;
          text-overflow: clip !important;
          white-space: normal !important;
        }
        .cd-drawer .cd-combo-control,
        .cd-category-vehicle-inline .cd-combo-control,
        .cd-vehicle-step .cd-combo-control {
          gap: 0 !important;
        }
        .cd-drawer .cd-combo-control .cd-combo-input,
        .cd-drawer .cd-combo-control .cd-combo-toggle,
        .cd-category-vehicle-inline .cd-combo-control .cd-combo-input,
        .cd-category-vehicle-inline .cd-combo-control .cd-combo-toggle,
        .cd-vehicle-step .cd-combo-control .cd-combo-input,
        .cd-vehicle-step .cd-combo-control .cd-combo-toggle {
          border-left: 0 !important;
          border-right: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .cd-drawer .cd-combo-control .cd-combo-input,
        .cd-category-vehicle-inline .cd-combo-control .cd-combo-input,
        .cd-vehicle-step .cd-combo-control .cd-combo-input {
          appearance: none !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          border: 0 !important;
          outline: 0 !important;
          -webkit-appearance: none !important;
        }
        .cd-drawer .cd-combo-control .cd-combo-toggle,
        .cd-category-vehicle-inline .cd-combo-control .cd-combo-toggle,
        .cd-vehicle-step .cd-combo-control .cd-combo-toggle {
          background: transparent !important;
          outline: 0 !important;
        }
        .cd-drawer .cd-detail-field .cd-cc-select,
        .cd-category-vehicle-inline .cd-detail-field .cd-cc-select,
        .cd-vehicle-step .cd-detail-field .cd-cc-select {
          background-image: linear-gradient(180deg, rgba(8, 31, 52, 0.98), rgba(4, 19, 36, 0.98)) !important;
        }
        .cd-drawer .cd-combo-disabled .cd-combo-control,
        .cd-vehicle-step .cd-combo-disabled .cd-combo-control {
          background:
            linear-gradient(180deg, rgba(7, 24, 42, 0.72), rgba(4, 17, 32, 0.72)) !important;
          border-color: rgba(255, 122, 31, 0.42) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03) !important;
          cursor: not-allowed !important;
          opacity: 0.58 !important;
        }
        .cd-drawer .cd-combo-disabled .cd-combo-input,
        .cd-vehicle-step .cd-combo-disabled .cd-combo-input {
          color: rgba(216, 226, 236, 0.58) !important;
          cursor: not-allowed !important;
          -webkit-text-fill-color: rgba(216, 226, 236, 0.58) !important;
        }
        .cd-drawer .cd-combo-disabled .cd-combo-input::placeholder,
        .cd-vehicle-step .cd-combo-disabled .cd-combo-input::placeholder {
          color: rgba(216, 226, 236, 0.58) !important;
          opacity: 1 !important;
        }
        .cd-drawer .cd-combo-disabled .cd-combo-toggle,
        .cd-vehicle-step .cd-combo-disabled .cd-combo-toggle {
          color: rgba(255, 138, 28, 0.58) !important;
          cursor: not-allowed !important;
          opacity: 1 !important;
        }
        .cd-vehicle-type-menu .cd-vehicle-type-options::before,
        .cd-category-vehicle-inline .cd-vehicle-type-options::before,
        .cd-drawer .cd-vehicle-type-options::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          border-radius: inherit;
          background: #06182a;
          pointer-events: none;
        }
        .cd-vehicle-type-menu .cd-vehicle-type-option,
        .cd-category-vehicle-inline .cd-vehicle-type-option,
        .cd-drawer .cd-vehicle-type-option {
          position: relative;
          z-index: 1;
          background: #081f34 !important;
          background-color: #081f34 !important;
          color: #ffffff !important;
        }
        .cd-vehicle-type-menu .cd-vehicle-type-option:hover,
        .cd-vehicle-type-menu .cd-vehicle-type-option.is-active,
        .cd-category-vehicle-inline .cd-vehicle-type-option:hover,
        .cd-category-vehicle-inline .cd-vehicle-type-option.is-active,
        .cd-drawer .cd-vehicle-type-option:hover,
        .cd-drawer .cd-vehicle-type-option.is-active {
          background: #92c2f1 !important;
          background-color: #92c2f1 !important;
          color: #031326 !important;
        }
        @media (max-width: 760px) {
          .cd-vehicle-kind-grid-compact {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .cd-category-vehicle-inline {
            margin: 0 0 8px !important;
            padding: 8px !important;
          }
        }
        @media (max-width: 520px) {
          .cd-drawer .cd-body > .cd-vehicle-step {
            min-height: calc(100dvh - 112px) !important;
            padding: 10px !important;
          }
          .cd-drawer .cd-vehicle-step .cd-vehicle-step-head {
            padding: 10px 12px !important;
          }
          .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid {
            grid-template-columns: 1fr !important;
            gap: 9px !important;
            padding: 10px !important;
          }
          .cd-drawer .cd-vehicle-step .cd-detail-field {
            padding: 0 !important;
          }
          .cd-drawer .cd-vehicle-step .cd-field-label {
            font-size: 12px !important;
          }
          .cd-drawer .cd-vehicle-step .cd-cc-select,
          .cd-drawer .cd-vehicle-step .cd-input {
            font-size: 14px !important;
            min-height: 43px !important;
          }
          .cd-drawer .cd-vehicle-step .cd-vehicle-actions {
            grid-template-columns: 1fr !important;
          }
          .cd-drawer .cd-vehicle-step .cd-vehicle-actions .cd-vehicle-clear {
            min-width: 0 !important;
          }
          .cd-drawer .cd-vehicle-kind-grid {
            grid-template-columns: 1fr !important;
          }
          .cd-drawer .cd-vehicle-kind-grid-compact {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .cd-drawer .cd-vehicle-kind-card {
            min-height: 46px !important;
          }
          .cd-vehicle-head-fields {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 720px) {
          .cd-drawer .cd-crumbs {
            align-items: flex-start !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 7px 8px !important;
            justify-content: flex-start !important;
            padding: 8px 10px 10px !important;
          }

          .cd-drawer .cd-crumb-seg {
            align-items: center !important;
            display: inline-flex !important;
            flex: 0 1 auto !important;
            gap: 5px !important;
            min-width: 0 !important;
          }

          .cd-drawer .cd-crumb-sep {
            align-items: center !important;
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            color: rgba(151, 178, 205, 0.72) !important;
            display: inline-flex !important;
            flex: 0 0 14px !important;
            height: 18px !important;
            justify-content: center !important;
            padding: 0 !important;
            stroke-width: 2.8 !important;
            width: 14px !important;
          }

          .cd-drawer button.cd-crumb-sep {
            appearance: none !important;
            -webkit-appearance: none !important;
            cursor: pointer !important;
            margin: 0 !important;
          }

          .cd-drawer button.cd-crumb-sep:hover,
          .cd-drawer button.cd-crumb-sep:focus-visible {
            color: rgba(255, 138, 31, 0.95) !important;
            outline: 0 !important;
          }

          .cd-drawer button.cd-crumb-sep svg {
            display: block !important;
            pointer-events: none !important;
          }

          .cd-drawer .cd-crumb-item {
            background:
              linear-gradient(180deg, rgba(20, 44, 66, 0.98), rgba(8, 27, 45, 0.98)) !important;
            border: 1px solid rgba(126, 197, 240, 0.34) !important;
            border-radius: 10px !important;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.08),
              0 6px 14px rgba(0, 8, 22, 0.16) !important;
            gap: 4px !important;
            max-width: min(100%, 250px) !important;
            min-height: 30px !important;
            padding: 4px 4px 4px 8px !important;
          }

          .cd-drawer .cd-crumb-btn {
            color: #f6fbff !important;
            cursor: pointer !important;
            font-size: 12px !important;
            font-weight: 900 !important;
            line-height: 1.12 !important;
            max-width: 206px !important;
            min-width: 0 !important;
            overflow: visible !important;
            padding: 0 !important;
            text-overflow: clip !important;
            white-space: normal !important;
            word-break: normal !important;
            overflow-wrap: anywhere !important;
            display: -webkit-box !important;
            -webkit-box-orient: vertical !important;
            -webkit-line-clamp: 3 !important;
          }

          .cd-drawer .cd-crumb-current {
            color: #f6fbff !important;
          }

          .cd-drawer .cd-crumb-seg:has(.cd-crumb-current) .cd-crumb-item {
            background:
              linear-gradient(180deg, rgba(28, 55, 78, 0.98), rgba(12, 35, 56, 0.98)) !important;
            border-color: rgba(255, 138, 31, 0.48) !important;
          }

          .cd-drawer .cd-crumb-x {
            flex: 0 0 20px !important;
            height: 20px !important;
            width: 20px !important;
          }

          .cd-drawer .cd-crumb-item .cd-crumb-x {
            background: transparent !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: #ff5a52 !important;
            flex: 0 0 16px !important;
            font-size: 13px !important;
            height: 18px !important;
            line-height: 1 !important;
            min-height: 18px !important;
            min-width: 16px !important;
            opacity: 0.95 !important;
            padding: 0 !important;
            width: 16px !important;
          }

          .cd-drawer .cd-crumb-item .cd-crumb-x:hover,
          .cd-drawer .cd-crumb-item .cd-crumb-x:focus-visible {
            background: transparent !important;
            border: 0 !important;
            color: #ff2f24 !important;
            outline: 0 !important;
          }

          .cd-drawer .cd-final-leaf-list {
            gap: 10px !important;
            padding: 10px 12px 18px !important;
          }

          .cd-drawer .cd-final-leaf-list .cd-final-leaf-item,
          .cd-drawer .cd-sub-group-list .cd-item-leaf.cd-final-leaf-item {
            align-items: center !important;
            background:
              radial-gradient(140px 80px at 0% 0%, rgba(255, 122, 31, 0.16), transparent 72%),
              linear-gradient(180deg, rgba(63, 80, 98, 0.98) 0%, rgba(36, 54, 73, 0.98) 100%) !important;
            border: 1px solid rgba(255, 158, 74, 0.46) !important;
            border-left-color: rgba(255, 132, 31, 0.76) !important;
            border-radius: 12px !important;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.16),
              inset 0 -14px 24px rgba(0, 8, 22, 0.18),
              0 10px 22px rgba(0, 8, 22, 0.22) !important;
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 34px !important;
            min-height: 54px !important;
            padding: 8px 12px !important;
            width: 100% !important;
          }

          .cd-drawer .cd-final-leaf-list .cd-final-leaf-item .cd-label,
          .cd-drawer .cd-sub-group-list .cd-item-leaf.cd-final-leaf-item .cd-label {
            color: #f8fbff !important;
            display: block !important;
            font-size: 15px !important;
            font-weight: 950 !important;
            letter-spacing: 0 !important;
            line-height: 1.15 !important;
            max-width: 100% !important;
            min-width: 0 !important;
            overflow: visible !important;
            overflow-wrap: normal !important;
            text-wrap: balance !important;
            white-space: normal !important;
            word-break: normal !important;
          }

          .cd-drawer .cd-final-leaf-list .cd-final-leaf-item .cd-arrow,
          .cd-drawer .cd-final-leaf-list .cd-final-leaf-item .cd-check,
          .cd-drawer .cd-sub-group-list .cd-item-leaf.cd-final-leaf-item .cd-arrow,
          .cd-drawer .cd-sub-group-list .cd-item-leaf.cd-final-leaf-item .cd-check {
            align-items: center !important;
            background: rgba(226, 238, 248, 0.16) !important;
            border: 1px solid rgba(226, 238, 248, 0.18) !important;
            border-radius: 999px !important;
            color: #ffffff !important;
            display: inline-flex !important;
            height: 28px !important;
            justify-content: center !important;
            justify-self: end !important;
            padding: 5px !important;
            width: 28px !important;
          }

          .cd-drawer .cd-final-leaf-list .cd-final-leaf-item:hover,
          .cd-drawer .cd-final-leaf-list .cd-final-leaf-item.cd-item-active,
          .cd-drawer .cd-sub-group-list .cd-item-leaf.cd-final-leaf-item:hover,
          .cd-drawer .cd-sub-group-list .cd-item-leaf.cd-final-leaf-item.cd-item-active {
            background:
              radial-gradient(160px 90px at 0% 0%, rgba(255, 138, 31, 0.26), transparent 74%),
              linear-gradient(180deg, rgba(72, 92, 112, 0.98) 0%, rgba(42, 62, 82, 0.98) 100%) !important;
            border-color: rgba(255, 166, 82, 0.82) !important;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.18),
              0 12px 26px rgba(0, 8, 22, 0.28),
              0 0 0 1px rgba(255, 122, 31, 0.14) !important;
          }
        }

        .cd-drawer .cd-body {
          padding-bottom: calc(104px + env(safe-area-inset-bottom)) !important;
        }

        .cd-drawer .cd-results-footer {
          bottom: 0 !important;
          left: 0 !important;
          position: absolute !important;
          right: 0 !important;
          z-index: 4090 !important;
        }

        .cd-drawer .cd-results-button {
          min-height: 52px !important;
        }

        /* Reference-style side drawer requested from the mockup. */
        .cd-backdrop {
          background:
            radial-gradient(800px 520px at 40% 0%, rgba(22, 52, 78, 0.28), transparent 72%),
            rgba(0, 7, 16, 0.72) !important;
          backdrop-filter: blur(5px) saturate(1.05) !important;
        }

        .cd-drawer {
          background:
            radial-gradient(540px 420px at 78% 12%, rgba(28, 68, 102, 0.24), transparent 72%),
            linear-gradient(180deg, rgba(9, 25, 42, 0.98), rgba(3, 13, 25, 0.99)) !important;
          border: 1px solid rgba(126, 158, 190, 0.38) !important;
          border-radius: 18px 0 0 18px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 34px 90px rgba(0, 8, 22, 0.44) !important;
          bottom: 0 !important;
          height: calc(100dvh - var(--topbar-h, 72px)) !important;
          left: auto !important;
          max-height: calc(100dvh - var(--topbar-h, 72px)) !important;
          max-width: min(465px, 100vw) !important;
          overflow: hidden !important;
          right: 0 !important;
          top: var(--topbar-h, 72px) !important;
          transform: translateX(0) !important;
          width: min(465px, 100vw) !important;
        }

        .cd-drawer-open {
          transform: translateX(0) !important;
        }

        .cd-header {
          background: transparent !important;
          border: 0 !important;
          min-height: 62px !important;
          padding: 12px 14px 0 18px !important;
        }

        .cd-drawer:not(:has(.cd-crumbs)) .cd-body {
          padding-top: 0 !important;
        }

        .cd-close,
        .cd-back {
          background: rgba(8, 22, 38, 0.86) !important;
          border: 1px solid rgba(126, 158, 190, 0.42) !important;
          border-radius: 999px !important;
          color: #ffffff !important;
        }

        .cd-close {
          height: 46px !important;
          width: 46px !important;
        }

        .cd-back {
          height: 46px !important;
          width: 46px !important;
        }

        .cd-crumbs {
          background: rgba(2, 13, 24, 0.78) !important;
          border: 1px solid rgba(126, 158, 190, 0.22) !important;
          border-radius: 22px !important;
          margin: 8px 18px 16px !important;
          min-height: 70px !important;
          padding: 12px !important;
        }

        .cd-crumb-item {
          background: linear-gradient(180deg, rgba(18, 41, 64, 0.92), rgba(8, 23, 40, 0.96)) !important;
          border: 1px solid rgba(126, 158, 190, 0.28) !important;
          border-radius: 999px !important;
          min-height: 44px !important;
          padding: 0 12px 0 20px !important;
        }

        .cd-crumb-btn {
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 950 !important;
        }

        .cd-crumb-x {
          color: #ffffff !important;
          font-size: 24px !important;
        }

        .cd-body {
          padding: 0 18px !important;
        }

        .cd-drawer .cd-body {
          padding-bottom: 0 !important;
        }

        .cd-drawer .cd-body > .cd-vehicle-step {
          gap: 14px !important;
          min-height: 0 !important;
          padding: 0 !important;
        }

        .cd-drawer .cd-vehicle-step .cd-vehicle-step-head,
        .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid,
        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel {
          background:
            radial-gradient(420px 180px at 18% 0%, rgba(21, 65, 104, 0.28), transparent 72%),
            linear-gradient(180deg, rgba(8, 31, 52, 0.82), rgba(4, 18, 34, 0.9)) !important;
          border: 1px solid rgba(126, 158, 190, 0.28) !important;
          border-radius: 14px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045) !important;
          padding: 14px !important;
        }

        .cd-drawer .cd-vehicle-step .cd-step-hint,
        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel > .cd-step-hint {
          color: rgba(216, 226, 236, 0.78) !important;
          font-size: 12px !important;
          font-weight: 950 !important;
          letter-spacing: 0.08em !important;
          line-height: 1.1 !important;
          text-transform: uppercase !important;
        }

        .cd-drawer .cd-vehicle-head-fields,
        .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid,
        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel > .cd-vehicle-detail-grid {
          gap: 12px !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel .cd-detail-field:last-child {
          grid-column: 1 / -1 !important;
        }

        .cd-drawer .cd-vehicle-step .cd-field-label,
        .cd-drawer .cd-vehicle-type-menu span {
          color: rgba(216, 226, 236, 0.78) !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          letter-spacing: 0.055em !important;
          text-transform: uppercase !important;
        }

        .cd-drawer .cd-combo-control,
        .cd-drawer .cd-vehicle-type-trigger {
          background:
            linear-gradient(180deg, rgba(10, 30, 50, 0.96), rgba(5, 18, 34, 0.98)) !important;
          border: 1.5px solid rgba(126, 158, 190, 0.44) !important;
          border-radius: 12px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045) !important;
          min-height: 48px !important;
        }

        .cd-drawer .cd-combo-open .cd-combo-control,
        .cd-drawer .cd-vehicle-type-menu.is-open .cd-vehicle-type-trigger {
          border-color: #ff8a1c !important;
          box-shadow:
            0 0 0 1px rgba(255, 138, 28, 0.22),
            0 18px 34px rgba(255, 122, 31, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
        }

        .cd-drawer .cd-combo-control {
          grid-template-columns: 38px minmax(0, 1fr) 38px !important;
        }

        .cd-drawer .cd-combo-icon {
          align-items: center !important;
          color: rgba(226, 238, 248, 0.86) !important;
          display: inline-flex !important;
          justify-content: center !important;
          min-width: 38px !important;
        }

        .cd-drawer .cd-combo-input,
        .cd-drawer .cd-vehicle-type-trigger strong {
          color: #ffffff !important;
          font-size: 15px !important;
          font-weight: 950 !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .cd-drawer .cd-combo-input::placeholder {
          color: rgba(216, 226, 236, 0.52) !important;
          -webkit-text-fill-color: rgba(216, 226, 236, 0.52) !important;
        }

        .cd-drawer .cd-vehicle-type-trigger {
          grid-template-columns: 32px minmax(0, 1fr) 28px !important;
          padding: 0 12px !important;
        }

        .cd-drawer .cd-vehicle-type-trigger > svg:first-child {
          color: rgba(226, 238, 248, 0.86) !important;
        }

        .cd-drawer .cd-combo-toggle svg,
        .cd-drawer .cd-vehicle-type-trigger > svg:last-child {
          color: rgba(226, 238, 248, 0.9) !important;
        }

        .cd-drawer .cd-vehicle-actions {
          border-bottom: 1px solid rgba(126, 197, 240, 0.16) !important;
          display: grid !important;
          gap: 10px !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
          padding-bottom: 14px !important;
        }

        .cd-drawer .cd-vehicle-actions button {
          border-radius: 12px !important;
          display: inline-flex !important;
          font-size: 14px !important;
          font-weight: 950 !important;
          gap: 8px !important;
          min-height: 46px !important;
        }

        .cd-drawer .cd-vehicle-actions .cd-vehicle-next {
          background: linear-gradient(135deg, #ffb047 0%, #ff7a1f 48%, #f05c00 100%) !important;
          border: 1px solid rgba(255, 190, 120, 0.76) !important;
          box-shadow: 0 18px 34px rgba(255, 104, 18, 0.24) !important;
          color: #ffffff !important;
        }

        .cd-drawer .cd-vehicle-actions .cd-vehicle-clear {
          background: linear-gradient(180deg, rgba(18, 41, 64, 0.92), rgba(8, 23, 40, 0.96)) !important;
          border: 1px solid rgba(126, 158, 190, 0.46) !important;
          color: #ffffff !important;
        }

        .cd-drawer .cd-results-footer {
          background: transparent !important;
          border-top: 0 !important;
          padding: 12px 18px 18px !important;
          position: static !important;
        }

        .cd-drawer .cd-results-button {
          align-items: center !important;
          background:
            radial-gradient(140px 80px at 100% 50%, rgba(255, 122, 31, 0.34), transparent 74%),
            linear-gradient(180deg, rgba(13, 34, 55, 0.98), rgba(5, 17, 32, 0.98)) !important;
          border: 1.5px solid rgba(255, 122, 31, 0.9) !important;
          border-radius: 16px !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 20px 44px rgba(0, 8, 22, 0.22) !important;
          color: #ffffff !important;
          display: grid !important;
          font-size: 18px !important;
          font-weight: 950 !important;
          grid-template-columns: 38px minmax(0, 1fr) 30px !important;
          justify-items: start !important;
          min-height: 66px !important;
          padding: 0 18px !important;
          text-align: left !important;
        }

        .cd-drawer .cd-results-button svg:first-child {
          color: #ff8a1c !important;
        }

        .cd-drawer .cd-results-button svg:last-child {
          color: #ffffff !important;
          justify-self: end !important;
        }

        .cd-drawer .cd-vehicle-actions,
        .cd-drawer .cd-vehicle-step .cd-vehicle-actions {
          display: none !important;
        }

        .cd-drawer .cd-results-footer {
          display: grid !important;
          gap: 10px !important;
          grid-template-columns: minmax(0, 1.35fr) minmax(132px, 0.65fr) !important;
        }

        .cd-drawer .cd-results-clear-button {
          align-items: center !important;
          background: linear-gradient(180deg, rgba(18, 41, 64, 0.92), rgba(8, 23, 40, 0.96)) !important;
          border: 1px solid rgba(126, 158, 190, 0.52) !important;
          border-radius: 16px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07) !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: inline-flex !important;
          font-size: 15px !important;
          font-weight: 950 !important;
          gap: 8px !important;
          justify-content: center !important;
          min-height: 66px !important;
          padding: 0 14px !important;
          white-space: nowrap !important;
        }

        .cd-drawer .cd-results-clear-button svg {
          color: #ffffff !important;
          flex: 0 0 auto !important;
        }

        @media (max-width: 760px) {
          .cd-drawer {
            border-radius: 0 !important;
            left: auto !important;
            max-height: calc(100dvh - var(--topbar-h, 72px)) !important;
            max-width: 100vw !important;
            right: 0 !important;
            top: var(--topbar-h, 72px) !important;
            transform: none !important;
            width: min(465px, 100vw) !important;
          }

          .cd-drawer-open {
            transform: none !important;
          }

          .cd-header {
            min-height: 58px !important;
            padding: 10px 12px 0 !important;
          }

          .cd-close {
            height: 42px !important;
            width: 42px !important;
          }

          .cd-crumbs {
            margin: 8px 16px 16px !important;
            min-height: 68px !important;
            padding: 12px !important;
          }

          .cd-body {
            padding: 0 16px !important;
          }

          .cd-drawer .cd-vehicle-head-fields,
          .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid,
          .cd-drawer .cd-vehicle-step .cd-parts-inline-panel > .cd-vehicle-detail-grid,
          .cd-drawer .cd-vehicle-actions {
            grid-template-columns: 1fr !important;
          }

          .cd-drawer .cd-vehicle-step .cd-vehicle-step-head,
          .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid,
          .cd-drawer .cd-vehicle-step .cd-parts-inline-panel {
            border-radius: 14px !important;
            padding: 16px !important;
          }

          .cd-drawer .cd-results-footer {
            padding: 16px !important;
          }

          .cd-drawer .cd-results-button {
            font-size: 18px !important;
            min-height: 62px !important;
          }
        }

        /* Actual final cleanup: compact side drawer, no overlapped header, readable fields. */
        body:has(.cd-drawer-open) header.universal-app-topbar,
        body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar {
          display: grid !important;
          min-height: 64px !important;
          opacity: 1 !important;
          position: fixed !important;
          top: 0 !important;
          visibility: visible !important;
          z-index: 7000 !important;
        }

        .cd-backdrop {
          inset: 64px 0 0 0 !important;
          top: 64px !important;
          z-index: 980 !important;
        }

        .cd-drawer {
          border-radius: 14px 0 0 14px !important;
          bottom: 0 !important;
          display: grid !important;
          grid-template-rows: 58px minmax(0, 1fr) auto !important;
          height: calc(100dvh - 64px) !important;
          left: auto !important;
          max-height: calc(100dvh - 64px) !important;
          max-width: min(465px, 100vw) !important;
          overflow: hidden !important;
          right: 0 !important;
          top: 64px !important;
          width: min(465px, 100vw) !important;
          z-index: 990 !important;
        }

        .cd-header {
          align-items: center !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          display: flex !important;
          grid-row: 1 !important;
          justify-content: flex-end !important;
          min-height: 58px !important;
          padding: 10px 12px 0 12px !important;
          position: static !important;
          width: auto !important;
        }

        .cd-close {
          flex: 0 0 42px !important;
          height: 42px !important;
          margin-left: auto !important;
          min-height: 42px !important;
          min-width: 42px !important;
          width: 42px !important;
        }

        .cd-body {
          grid-row: 2 !important;
          min-height: 0 !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          padding: 0 14px 12px !important;
        }

        .cd-results-footer {
          grid-row: 3 !important;
        }

        .cd-drawer .cd-vehicle-head-fields,
        .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid,
        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel > .cd-vehicle-detail-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }

        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel .cd-detail-field:last-child {
          grid-column: 1 / -1 !important;
        }

        .cd-drawer .cd-vehicle-actions,
        .cd-drawer .cd-vehicle-step .cd-vehicle-actions {
          display: none !important;
        }

        .cd-drawer .cd-vehicle-step .cd-vehicle-step-head,
        .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid,
        .cd-drawer .cd-vehicle-step .cd-parts-inline-panel {
          padding: 14px !important;
        }

        .cd-drawer .cd-combo-input,
        .cd-drawer .cd-vehicle-type-trigger strong {
          font-size: 11.5px !important;
          font-weight: 950 !important;
          line-height: 1.08 !important;
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: clip !important;
          white-space: nowrap !important;
          word-break: normal !important;
        }

        .cd-drawer .cd-combo-control,
        .cd-drawer .cd-vehicle-type-trigger {
          align-items: center !important;
          gap: 4px !important;
          grid-template-columns: 18px minmax(0, 1fr) 16px !important;
          min-height: 50px !important;
          padding: 0 7px !important;
        }

        .cd-drawer .cd-combo-icon,
        .cd-drawer .cd-vehicle-type-trigger > svg:first-child {
          height: 17px !important;
          width: 17px !important;
        }

        .cd-drawer .cd-combo-toggle,
        .cd-drawer .cd-vehicle-type-trigger > svg:last-child {
          height: 16px !important;
          min-width: 16px !important;
          width: 16px !important;
        }

        .cd-drawer .cd-combo-input {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          height: 100% !important;
          padding: 0 !important;
          width: 100% !important;
        }

        .cd-drawer .cd-combo-input::placeholder {
          color: rgba(222, 233, 242, 0.78) !important;
          -webkit-text-fill-color: rgba(222, 233, 242, 0.78) !important;
          opacity: 1 !important;
        }

        .cd-drawer .cd-combo-disabled .cd-combo-input,
        .cd-drawer .cd-combo-disabled .cd-combo-input::placeholder,
        .cd-drawer .cd-vehicle-type-trigger:disabled strong {
          color: rgba(205, 220, 232, 0.72) !important;
          -webkit-text-fill-color: rgba(205, 220, 232, 0.72) !important;
          opacity: 1 !important;
        }

        .cd-drawer .cd-combo-disabled .cd-combo-control,
        .cd-drawer .cd-vehicle-type-trigger:disabled {
          opacity: 0.76 !important;
        }

        .cd-drawer .cd-combo-control,
        .cd-drawer .cd-vehicle-type-trigger,
        .cd-drawer .cd-vehicle-step .cd-combo-control,
        .cd-drawer .cd-vehicle-step .cd-vehicle-type-trigger {
          column-gap: 8px !important;
          display: grid !important;
          grid-template-columns: 18px minmax(0, 1fr) 18px !important;
          padding-left: 12px !important;
          padding-right: 10px !important;
        }

        .cd-drawer .cd-combo-icon,
        .cd-drawer .cd-vehicle-type-trigger > svg:first-child {
          align-items: center !important;
          color: rgba(219, 234, 247, 0.9) !important;
          display: inline-flex !important;
          grid-column: 1 !important;
          justify-content: center !important;
          justify-self: center !important;
          margin: 0 !important;
        }

        .cd-drawer .cd-combo-icon svg {
          height: 17px !important;
          width: 17px !important;
        }

        .cd-drawer .cd-combo-input,
        .cd-drawer .cd-vehicle-type-trigger strong {
          grid-column: 2 !important;
          justify-self: stretch !important;
        }

        .cd-drawer .cd-combo-input {
          padding-left: 7px !important;
        }

        .cd-drawer .cd-vehicle-type-trigger strong {
          padding-left: 2px !important;
        }

        .cd-drawer .cd-combo-toggle,
        .cd-drawer .cd-vehicle-type-trigger > svg:last-child {
          grid-column: 3 !important;
          justify-self: end !important;
          margin: 0 !important;
        }

        .cd-drawer .cd-extra-detail-panel {
          border-top: 1px solid rgba(126, 197, 240, 0.14) !important;
          display: grid !important;
          gap: 10px !important;
          grid-column: 1 / -1 !important;
          margin-top: 2px !important;
          padding-top: 12px !important;
        }

        .cd-drawer .cd-extra-field {
          display: grid !important;
          gap: 7px !important;
          min-width: 0 !important;
        }

        .cd-drawer .cd-extra-label {
          color: rgba(216, 226, 236, 0.84) !important;
          font-size: 12px !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          line-height: 1.1 !important;
          text-transform: uppercase !important;
        }

        .cd-drawer .cd-track-mat-select-shell,
        .cd-drawer .cd-extra-input-shell {
          align-items: center !important;
          background: linear-gradient(180deg, rgba(8, 31, 52, 0.98), rgba(4, 19, 36, 0.98)) !important;
          border: 1px solid rgba(126, 197, 240, 0.42) !important;
          border-radius: 10px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
          color: #ffffff !important;
          display: grid !important;
          grid-template-columns: 22px minmax(0, 1fr) 18px !important;
          min-height: 52px !important;
          padding: 0 12px !important;
          position: relative !important;
          width: 100% !important;
        }

        .cd-drawer button.cd-track-mat-select-shell {
          cursor: pointer !important;
          font: inherit !important;
          text-align: left !important;
        }

        .cd-drawer .cd-track-mat-icon,
        .cd-drawer .cd-extra-input-shell > svg {
          align-items: center !important;
          color: #ff8a1c !important;
          display: inline-flex !important;
          justify-content: center !important;
        }

        .cd-drawer .cd-track-mat-value {
          display: grid !important;
          gap: 2px !important;
          min-width: 0 !important;
          padding: 0 8px !important;
        }

        .cd-drawer .cd-track-mat-value strong,
        .cd-drawer .cd-track-mat-value small {
          display: block !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .cd-drawer .cd-track-mat-value strong {
          color: #ffffff !important;
          font-size: 13px !important;
          font-weight: 950 !important;
          line-height: 1.05 !important;
        }

        .cd-drawer .cd-track-mat-value small {
          color: rgba(216, 226, 236, 0.78) !important;
          font-size: 11px !important;
          font-weight: 850 !important;
        }

        .cd-drawer .cd-track-mat-value-empty strong {
          color: rgba(216, 226, 236, 0.76) !important;
        }

        .cd-drawer .cd-track-mat-select-shell > svg:last-child {
          color: rgba(226, 238, 248, 0.92) !important;
          justify-self: end !important;
        }

        .cd-drawer .cd-track-mat-select-shell.is-open {
          border-color: rgba(255, 122, 26, 0.78) !important;
          box-shadow: 0 0 0 3px rgba(255, 122, 26, 0.12) !important;
        }

        .cd-drawer .cd-track-mat-select-shell.is-open > svg:last-child {
          transform: rotate(180deg) !important;
        }

        .cd-drawer .cd-track-mat-menu {
          background:
            radial-gradient(240px 160px at 12% 0%, rgba(36, 96, 142, 0.18), transparent 72%),
            #06182a !important;
          border: 1px solid rgba(126, 197, 240, 0.36) !important;
          border-radius: 12px !important;
          box-shadow: 0 18px 38px rgba(0, 8, 22, 0.5) !important;
          display: grid !important;
          gap: 4px !important;
          margin-top: 7px !important;
          max-height: min(300px, 42dvh) !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
          padding: 6px !important;
          scrollbar-color: rgba(126, 197, 240, 0.5) transparent !important;
          scrollbar-width: thin !important;
          width: 100% !important;
          -webkit-overflow-scrolling: touch !important;
        }

        .cd-drawer .cd-track-mat-option {
          align-items: center !important;
          background: rgba(8, 31, 52, 0.72) !important;
          border: 1px solid rgba(126, 197, 240, 0.12) !important;
          border-radius: 9px !important;
          color: #ffffff !important;
          cursor: pointer !important;
          display: grid !important;
          gap: 3px !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
          min-height: 40px !important;
          padding: 8px 10px !important;
          text-align: left !important;
          width: 100% !important;
        }

        .cd-drawer .cd-track-mat-option strong,
        .cd-drawer .cd-track-mat-option span {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        .cd-drawer .cd-track-mat-option strong {
          font-size: 13px !important;
          font-weight: 950 !important;
        }

        .cd-drawer .cd-track-mat-option span {
          color: rgba(216, 226, 236, 0.72) !important;
          font-size: 12px !important;
          font-weight: 850 !important;
        }

        .cd-drawer .cd-track-mat-option:hover,
        .cd-drawer .cd-track-mat-option.is-active {
          background: rgba(146, 194, 241, 0.96) !important;
          border-color: rgba(210, 232, 255, 0.7) !important;
          color: #031326 !important;
        }

        .cd-drawer .cd-track-mat-option:hover span,
        .cd-drawer .cd-track-mat-option.is-active span {
          color: rgba(3, 19, 38, 0.72) !important;
        }

        .cd-drawer .cd-track-mat-option-custom {
          border-color: rgba(255, 122, 26, 0.34) !important;
        }

        .cd-drawer .cd-extra-input {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          color: #ffffff !important;
          font: inherit !important;
          font-size: 13px !important;
          font-weight: 900 !important;
          min-width: 0 !important;
          outline: 0 !important;
          padding: 0 0 0 8px !important;
          width: 100% !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .cd-drawer .cd-extra-input::placeholder {
          color: rgba(216, 226, 236, 0.62) !important;
          opacity: 1 !important;
          -webkit-text-fill-color: rgba(216, 226, 236, 0.62) !important;
        }

        @media (min-width: 861px) {
          body:has(.cd-drawer-open) header.universal-app-topbar,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar {
            display: block !important;
            height: 64px !important;
            min-height: 64px !important;
            overflow: visible !important;
            padding: 0 !important;
          }

          body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-navigation,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-home-navigation,
          body:has(.cd-drawer-open) header.universal-app-topbar .universal-primary-navigation,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-primary-navigation {
            display: block !important;
            height: 64px !important;
            overflow: visible !important;
            width: 100% !important;
          }

          body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-brand,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-home-brand {
            align-items: center !important;
            display: inline-flex !important;
            height: 64px !important;
            left: 14px !important;
            opacity: 1 !important;
            position: absolute !important;
            top: 0 !important;
            transform: none !important;
            visibility: visible !important;
            width: 82px !important;
            z-index: 20 !important;
          }

          body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-brand-logo,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-home-brand-logo {
            display: block !important;
            height: auto !important;
            max-height: 50px !important;
            opacity: 1 !important;
            visibility: visible !important;
            width: 78px !important;
          }

          body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-primary-nav,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-home-primary-nav {
            align-items: center !important;
            display: flex !important;
            gap: clamp(14px, 1.8vw, 28px) !important;
            height: 64px !important;
            justify-content: center !important;
            left: 50% !important;
            margin: 0 !important;
            max-width: calc(100vw - 560px) !important;
            min-width: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            right: auto !important;
            top: 0 !important;
            transform: translateX(-50%) !important;
            width: max-content !important;
            z-index: 12 !important;
          }

          body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-primary-nav :is(a, button),
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-home-primary-nav :is(a, button),
          body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-primary-nav a.universal-contact-cta,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-home-primary-nav a.universal-contact-cta {
            flex: 0 1 auto !important;
            font-size: 13px !important;
            max-width: 116px !important;
            min-width: 0 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          body:has(.cd-drawer-open) header.universal-app-topbar .universal-topbar-actions,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-topbar-actions {
            align-items: center !important;
            display: flex !important;
            gap: 8px !important;
            height: 64px !important;
            justify-content: flex-end !important;
            margin: 0 !important;
            max-width: calc(100vw - 116px) !important;
            min-width: 0 !important;
            position: absolute !important;
            right: 14px !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            width: auto !important;
            z-index: 14 !important;
          }
        }

        @media (min-width: 861px) and (max-width: 1160px) {
          body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-primary-nav,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-home-primary-nav {
            gap: 12px !important;
            left: 42% !important;
            max-width: calc(100vw - 520px) !important;
          }

          body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-primary-nav :is(a, button),
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-home-primary-nav :is(a, button),
          body:has(.cd-drawer-open) header.universal-app-topbar .universal-home-primary-nav a.universal-contact-cta,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar .universal-home-primary-nav a.universal-contact-cta {
            font-size: 12px !important;
            max-width: 94px !important;
          }
        }

        @media (max-width: 520px) {
          body:has(.cd-drawer-open) header.universal-app-topbar,
          body:has(.cd-drawer-open) header.universal-app-topbar.universal-home-topbar {
            min-height: 72px !important;
          }

          .cd-backdrop {
            background:
              radial-gradient(520px 360px at 40% 0%, rgba(24, 74, 116, 0.28), transparent 70%),
              rgba(0, 7, 16, 0.76) !important;
            inset: 72px 0 0 0 !important;
            top: 72px !important;
          }

          .cd-drawer {
            background:
              radial-gradient(480px 320px at 20% 8%, rgba(34, 87, 126, 0.24), transparent 72%),
              linear-gradient(180deg, rgba(9, 26, 45, 0.99), rgba(2, 11, 22, 0.995)) !important;
            border: 1px solid rgba(126, 158, 190, 0.26) !important;
            border-radius: 18px 18px 0 0 !important;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.06),
              0 -18px 70px rgba(0, 8, 22, 0.44) !important;
            grid-template-rows: 64px minmax(0, 1fr) auto !important;
            height: calc(100dvh - 84px) !important;
            left: 6px !important;
            max-height: calc(100dvh - 84px) !important;
            max-width: calc(100vw - 12px) !important;
            right: 6px !important;
            top: 84px !important;
            width: calc(100vw - 12px) !important;
          }

          .cd-header {
            min-height: 64px !important;
            padding: 12px 12px 0 !important;
          }

          .cd-close {
            background: rgba(8, 22, 38, 0.9) !important;
            border-color: rgba(126, 158, 190, 0.42) !important;
            flex-basis: 44px !important;
            height: 44px !important;
            min-height: 44px !important;
            min-width: 44px !important;
            width: 44px !important;
          }

          .cd-body {
            padding: 0 16px 14px !important;
          }

          .cd-drawer .cd-body > .cd-vehicle-step {
            gap: 14px !important;
          }

          .cd-drawer .cd-vehicle-step .cd-vehicle-step-head,
          .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid,
          .cd-drawer .cd-vehicle-step .cd-parts-inline-panel {
            background:
              radial-gradient(380px 180px at 14% 0%, rgba(38, 94, 136, 0.24), transparent 72%),
              linear-gradient(180deg, rgba(8, 31, 52, 0.9), rgba(4, 18, 34, 0.94)) !important;
            border: 1px solid rgba(126, 158, 190, 0.34) !important;
            border-radius: 18px !important;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.055),
              0 12px 30px rgba(0, 8, 22, 0.18) !important;
            padding: 14px !important;
          }

          .cd-drawer .cd-vehicle-head-fields,
          .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid,
          .cd-drawer .cd-vehicle-step .cd-parts-inline-panel > .cd-vehicle-detail-grid {
            gap: 13px !important;
            grid-template-columns: 1fr !important;
          }

          .cd-drawer .cd-vehicle-step .cd-parts-inline-panel .cd-detail-field:last-child {
            grid-column: auto !important;
          }

          .cd-drawer .cd-field-label,
          .cd-drawer .cd-vehicle-step .cd-step-hint,
          .cd-drawer .cd-vehicle-step .cd-parts-inline-panel > .cd-step-hint {
            color: rgba(226, 238, 248, 0.84) !important;
            font-size: 13px !important;
            letter-spacing: 0.08em !important;
            line-height: 1.15 !important;
          }

          .cd-drawer .cd-vehicle-step .cd-vehicle-step-head > .cd-step-hint,
          .cd-drawer .cd-vehicle-step .cd-parts-inline-panel > .cd-step-hint {
            align-items: center !important;
            color: #ffffff !important;
            display: flex !important;
            font-size: clamp(17px, 5.2vw, 22px) !important;
            font-weight: 1000 !important;
            gap: 12px !important;
            letter-spacing: 0 !important;
            margin: 0 0 18px !important;
            text-transform: uppercase !important;
          }

          .cd-drawer .cd-step-hint-icon {
            align-items: center !important;
            background:
              radial-gradient(circle at 35% 30%, rgba(255, 154, 36, 0.34), transparent 46%),
              rgba(255, 122, 26, 0.08) !important;
            border: 1px solid rgba(255, 122, 26, 0.42) !important;
            border-radius: 999px !important;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
            color: #ff8a1c !important;
            display: inline-flex !important;
            flex: 0 0 38px !important;
            height: 38px !important;
            justify-content: center !important;
            width: 38px !important;
          }

          .cd-drawer .cd-combo-control,
          .cd-drawer .cd-vehicle-type-trigger,
          .cd-drawer .cd-vehicle-step .cd-combo-control,
          .cd-drawer .cd-vehicle-step .cd-vehicle-type-trigger {
            background: rgba(3, 15, 28, 0.72) !important;
            border: 1px solid rgba(148, 178, 207, 0.42) !important;
            border-radius: 14px !important;
            gap: 11px !important;
            grid-template-columns: 24px minmax(0, 1fr) 20px !important;
            min-height: 62px !important;
            padding: 0 14px !important;
          }

          .cd-drawer .cd-combo-input,
          .cd-drawer .cd-vehicle-type-trigger strong {
            color: #ffffff !important;
            font-size: clamp(14px, 4.3vw, 17px) !important;
            font-weight: 950 !important;
            line-height: 1.15 !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            -webkit-text-fill-color: #ffffff !important;
          }

          .cd-drawer .cd-combo-icon,
          .cd-drawer .cd-vehicle-type-trigger > svg:first-child {
            color: rgba(226, 238, 248, 0.88) !important;
            height: 24px !important;
            width: 24px !important;
          }

          body:has(.cd-drawer-open) .rebuilt-chat-button,
          body:has(.cd-drawer-open) .floating-chat,
          body:has(.cd-drawer-open) .fc-button {
            display: none !important;
          }

          .cd-drawer .cd-vehicle-type-menu {
            min-width: 0 !important;
            position: relative !important;
            width: 100% !important;
          }

          .cd-drawer .cd-vehicle-type-options {
            border-radius: 10px !important;
            box-shadow: 0 18px 34px rgba(0, 8, 22, 0.52) !important;
            left: 0 !important;
            min-width: 100% !important;
            padding: 5px !important;
            right: 0 !important;
            width: 100% !important;
            z-index: 160 !important;
          }

          .cd-drawer .cd-vehicle-head-fields .cd-vehicle-type-menu:not(.cd-vehicle-subtype-menu) .cd-vehicle-type-options {
            left: 0 !important;
            right: auto !important;
            min-width: 100% !important;
            width: 100% !important;
          }

          .cd-drawer .cd-vehicle-head-fields .cd-vehicle-subtype-menu .cd-vehicle-type-options {
            left: auto !important;
            right: 0 !important;
            min-width: 100% !important;
            width: 100% !important;
          }

          .cd-drawer .cd-vehicle-type-option,
          .cd-drawer .cd-combo-option {
            border-radius: 10px !important;
            font-size: 15px !important;
            font-weight: 950 !important;
            line-height: 1.15 !important;
            min-height: 48px !important;
            padding: 12px 14px !important;
            white-space: normal !important;
          }

          .cd-results-footer {
            background: linear-gradient(180deg, rgba(2, 11, 22, 0.68), rgba(2, 11, 22, 0.98)) !important;
            border-top: 1px solid rgba(126, 158, 190, 0.2) !important;
            gap: 10px !important;
            grid-template-columns: minmax(0, 1.18fr) minmax(108px, 0.82fr) !important;
            padding: 10px calc(14px + env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) calc(14px + env(safe-area-inset-left)) !important;
          }

          .cd-drawer .cd-results-button,
          .cd-drawer .cd-results-clear-button {
            border-radius: 14px !important;
            font-size: clamp(14px, 4vw, 17px) !important;
            min-height: 54px !important;
            padding: 0 12px !important;
          }

          .cd-drawer .cd-results-button {
            box-shadow:
              0 10px 24px rgba(255, 107, 22, 0.24),
              inset 0 1px 0 rgba(255, 255, 255, 0.18) !important;
            grid-template-columns: 26px minmax(0, 1fr) 16px !important;
          }

          .cd-drawer .cd-results-clear-button {
            gap: 7px !important;
          }

          .cd-drawer .cd-results-button svg,
          .cd-drawer .cd-results-clear-button svg {
            height: 20px !important;
            width: 20px !important;
          }

          .cd-drawer .cd-results-button span,
          .cd-drawer .cd-results-clear-button span {
            min-width: 0 !important;
          }
        }

        @media (max-width: 360px) {
          .cd-drawer .cd-vehicle-head-fields,
          .cd-drawer .cd-body > .cd-vehicle-step > .cd-vehicle-detail-grid,
          .cd-drawer .cd-vehicle-step .cd-parts-inline-panel > .cd-vehicle-detail-grid {
            grid-template-columns: 1fr !important;
          }

          .cd-drawer .cd-vehicle-step .cd-parts-inline-panel .cd-detail-field:last-child {
            grid-column: auto !important;
          }
        }
      `}</style>
    </>
  );
}
