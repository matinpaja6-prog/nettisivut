"use client";
import { useState, useEffect, type ReactNode } from "react";
import { displayCategoryForVehicle, subcategoryGroups } from "@/lib/listings";
import { useLanguage, translateCategory } from "@/lib/i18n";
import {
  X, ChevronRight, Wrench,
  Settings2, Zap, Thermometer, Droplets, Shield, Activity,
  Navigation, Circle, MoreHorizontal, Search, Check,
  Battery, Box, Boxes, Cable, CircleDot, Cog, Component,
  Cylinder, Disc3, Fan, Fuel, Gauge, Layers, Nut, Package,
  Snowflake
} from "lucide-react";

/* ── types ─────────────────────────────────────────── */
export type VehicleType = "Moottorikelkka" | "Mönkijä" | "Motocross" | "Mopot";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vehicleType: VehicleType | "";
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
    brand: string;
    model: string;
    year: string;
    engineCc: string;
    engineModel: string;
    category: string;
    subcategory: string;
  }) => void;
  vehicleBrands: Record<VehicleType, string[]>;
  vehicleCategories: Record<VehicleType, Record<string, readonly string[]>>;
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
  "Oikea ylä": <Navigation size={20} />,
  "Oikea ala": <Navigation size={20} />,
  "Vasen ylä": <Navigation size={20} />,
  "Vasen ala": <Navigation size={20} />,
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
  | "belt"
  | "wheel"
  | "track"
  | "suspension"
  | "steering"
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
  if (text.includes("kytkin") || text.includes("variaattor") || text.includes("vauhtipyor")) return "clutch";
  if (text.includes("hihna") || text.includes("ketju") || text.includes("vaijeri") || text.includes("letku") || text.includes("johtosarja")) return "belt";
  if (text.includes("rengas") || text.includes("renkaat") || text.includes("vanne") || text.includes("vanteet") || text.includes("vanneset")) return "wheel";
  if (text.includes("telasto") || text.includes("telamatto") || text.includes("liukurunko")) return "track";
  if (text.includes("iskunvaim") || text.includes("jous") || text.includes("tukivarsi") || text.includes("olka-aksel") || text.includes("vetoaksel") || text.includes("alusta")) return "suspension";
  if (text.includes("ohjaus") || text.includes("hallintalait") || text.includes("raidetanko") || text.includes("kaasukahva") || text.includes("korokepala")) return "steering";
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
  "Ohjaus":                "ohjaus",
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

/* ── component ──────────────────────────────────────── */
const CC_OPTIONS: Record<string, string[]> = {
  Moottorikelkka: ["250", "300", "400", "440", "500", "550", "600", "650", "700", "800", "850", "900", "1000", "1200+"],
  "Mönkijä":      ["250", "300", "400", "450", "500", "570", "650", "700", "800", "850", "1000", "1200+"],
  Motocross:      ["50", "65", "85", "125", "150", "250", "300", "350", "450", "500"],
  Mopot:          ["50", "65", "80", "90", "100", "110", "125", "150"],
};
const DEFAULT_CC_OPTIONS = ["250", "300", "400", "500", "600", "700", "800", "1000", "1200+"];

const VEHICLE_PHOTOS: Record<CategoryStartKind, string> = {
  Moottorikelkka: "/vehicles/moottorikelkka.png",
  "Mönkijä":       "/vehicles/monkija.png",
  Motocross:      "/vehicles/motocross.png",
  Mopot:          "/vehicles/mopot.png",
  all:            "/vehicles/all.png",
};

const ENGINE_MODELS: Record<string, Record<string, string[]>> = {
  Moottorikelkka: {
    Lynx:         ["Rotax 550F", "Rotax 600 ACE", "Rotax 600 E-TEC", "Rotax 600 H.O. E-TEC", "Rotax 600R E-TEC", "Rotax 800R E-TEC", "Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo", "Rotax 900 ACE", "Rotax 900 ACE Turbo", "Rotax 900 ACE Turbo R"],
    "Ski-Doo":    ["Rotax 550F", "Rotax 600 ACE", "Rotax 600 E-TEC", "Rotax 600 H.O. E-TEC", "Rotax 600R E-TEC", "Rotax 650 H.O.", "Rotax 800R E-TEC", "Rotax 850 E-TEC", "Rotax 900 ACE", "Rotax 900 ACE Turbo", "Rotax 900 ACE Turbo R", "Rotax 1200 4-TEC"],
    Polaris:      ["Liberty 500", "Liberty 550", "Liberty 600 HO", "Liberty 700", "Liberty 800", "RMK 800", "Patriot 550", "Patriot 600", "Patriot 650", "Patriot 850", "Patriot Boost"],
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

type CategoryStartKind = VehicleType | "all";

function VehicleTileImage({ kind }: { kind: CategoryStartKind }) {
  return (
    <span className="cd-start-picture">
      <VehiclePicture kind={kind} />
      <img
        key={VEHICLE_PHOTOS[kind]}
        src={VEHICLE_PHOTOS[kind]}
        alt=""
        className="cd-start-photo"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </span>
  );
}

function VehiclePicture({ kind }: { kind: CategoryStartKind }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 3,
  };

  const shapes: Record<CategoryStartKind, ReactNode> = {
    Moottorikelkka: (
      <>
        <path d="M13 41c13 5 35 5 50-2M20 37l19-18h16l7 10" {...stroke} />
        <path d="M30 30h20M38 20l8 18M54 29c8 1 12-2 14-8" {...stroke} />
        <circle cx="26" cy="42" r="5" fill="currentColor" />
      </>
    ),
    "Mönkijä": (
      <>
        <path d="M15 35h10l8-12h16l9 12h7M29 35h21M38 23l-5-8h13l5 8" {...stroke} />
        <circle cx="20" cy="41" r="7" {...stroke} />
        <circle cx="60" cy="41" r="7" {...stroke} />
      </>
    ),
    Motocross: (
      <>
        <path d="M18 42l17-21h11l14 21M35 21l9 21M45 21l10-7M30 31h20" {...stroke} />
        <circle cx="19" cy="43" r="8" {...stroke} />
        <circle cx="61" cy="43" r="8" {...stroke} />
      </>
    ),
    Mopot: (
      <>
        <path d="M18 41h14l9-18h13l7 18M34 34h20M47 23l8-7M25 30h10" {...stroke} />
        <circle cx="19" cy="43" r="7" {...stroke} />
        <circle cx="61" cy="43" r="7" {...stroke} />
      </>
    ),
    all: (
      <>
        <path d="M20 24l18-10 18 10v22L38 56 20 46z" {...stroke} />
        <path d="M20 24l18 10 18-10M38 34v22" {...stroke} />
        <path d="M58 18h9M63 13v10M13 45H5M9 41v8" {...stroke} />
      </>
    ),
  };

  const safeKind = kind === "all" ? "all" : normalizeIconText(kind).replace(/[^a-z0-9]+/g, "-");

  return (
    <svg className={`cd-vehicle-picture cd-vehicle-picture-${safeKind}`} viewBox="0 0 76 62" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`cdVehicleGlow-${safeKind}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#eaf8ff" />
          <stop offset="0.46" stopColor="#8eb8c9" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect x="2" y="3" width="72" height="56" rx="13" fill="rgba(255,255,255,.1)" />
      <path d="M10 14c17-8 39-8 56 1v14c-18-6-40-5-56 8z" fill={`url(#cdVehicleGlow-${safeKind})`} opacity="0.28" />
      <g transform="translate(0 -2)">
        {shapes[kind]}
      </g>
    </svg>
  );
}

const BRAND_MODELS: Record<string, Record<string, string[]>> = {
  Moottorikelkka: {
    "Lynx":       ["Rave", "Shredder", "Commander", "BoonDocker", "Xterrain", "Xtrim", "Adventure", "Ranger", "Yeti", "Spirit"],
    "Ski-Doo":    ["MXZ", "Freeride", "Summit", "Backcountry", "Renegade", "Expedition", "Tundra", "Skandic", "Grand Touring", "Enduro"],
    "Polaris":    ["Indy", "Rush", "RMK", "Switchback", "Titan", "Voyageur", "Patriot", "Pro-RMK"],
    "Arctic Cat": ["ZR", "M-Series", "XF", "F-Series", "Pantera", "Bearcat", "Wildcat", "Norseman"],
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
    "Yamaha":  ["Aerox", "Slider", "Jog", "BWs", "Neos", "Zuma", "DT 50", "DT 50 R", "DT 50 MX", "DT 80", "TZR 50"],
    "Honda":   ["SH", "PCX", "Zoomer", "Dio", "Lead", "Vision"],
    "KTM":     ["Duke 125", "RC 125"],
    "Derbi":   ["Senda", "GPR", "Variant", "Atlantis"],
    "Rieju":   ["MRT", "Tango", "RS2", "RRX", "Century"],
    "Aprilia": ["SR", "Scarabeo", "RS 125", "RX 125", "SX 125"],
  },
};

export default function CategoryDrawer({
  isOpen, onClose,
  vehicleType: initVehicle, brand: initBrand, model: initModel,
  year: initYear, engineCc: initCc, engineModel: initEngineModel, category: initCat, subcategory: initSub,
  openAtStep,
  onApply, vehicleBrands, vehicleCategories, partsCategories,
}: Props) {
  const { locale, t } = useLanguage();
  const [step, setStep]         = useState(3);
  const [vehicle, setVehicle]   = useState<VehicleType | "">(initVehicle);
  const [brand,   setBrand]     = useState(initBrand);
  const [model,   setModel]     = useState(initModel);
  const [modelOpen, setModelOpen] = useState(false);
  const [year,    setYear]      = useState(initYear);
  const [engineCc, setEngineCc]             = useState(initCc);
  const [engineCcOther, setEngineCcOther]   = useState("");
  const [engineModel, setEngineModel]       = useState(initEngineModel ?? "");
  const [engineModelOther, setEngineModelOther] = useState("");
  const [cat,     setCat]             = useState(initCat);
  const [subGroup, setSubGroup] = useState("");
  const [sub,     setSub]       = useState(initSub);

  useEffect(() => {
    if (isOpen && openAtStep === 0) return;
    setVehicle(initVehicle);
  }, [initVehicle, isOpen, openAtStep]);
  useEffect(() => {
    if (isOpen) {
      const startsFresh = openAtStep === 0;
      setVehicle(startsFresh ? "" : initVehicle);
      setBrand(startsFresh ? "" : initBrand);
      setModel(startsFresh ? "" : initModel);
      setYear(startsFresh ? "" : initYear);
      setEngineCc(startsFresh ? "" : initCc);
      setEngineCcOther("");
      setEngineModel(startsFresh ? "" : (initEngineModel ?? ""));
      setEngineModelOther("");
      setModelOpen(false);
      setCat("");
      setSubGroup("");
      setSub("");
      setStep(openAtStep ?? 3);
    }
  }, [isOpen, initVehicle, initBrand, initModel, initYear, initCc, initEngineModel, openAtStep]);

  function apply() {
    onApply({ vehicleType: vehicle, brand, model, year,
      engineCc: engineCc === "muu" ? engineCcOther : engineCc,
      engineModel: engineModel === "muu" ? engineModelOther : engineModel,
      category: cat, subcategory: sub });
    onClose();
  }

  function applyLeaf(nextSub: string, nextSubGroup = subGroup) {
    const nextValue = sub === nextSub ? "" : nextSub;
    setSubGroup(nextSubGroup);
    setSub(nextValue);
    onApply({
      vehicleType: vehicle,
      brand,
      model,
      year,
      engineCc: engineCc === "muu" ? engineCcOther : engineCc,
      engineModel: engineModel === "muu" ? engineModelOther : engineModel,
      category: cat,
      subcategory: nextValue,
    });
    onClose();
  }

  function closeDrawer(event?: React.MouseEvent | React.PointerEvent) {
    event?.preventDefault();
    event?.stopPropagation();
    onClose();
  }

  const cats = vehicle
    ? (vehicleCategories[vehicle as VehicleType] ?? partsCategories)
    : partsCategories;

  const subs: readonly string[] = cat ? (cats[cat] ?? []) : [];
  function getFilteredSubcategoryGroups(categoryName: string) {
    const categorySubs = cats[categoryName] ?? [];
    const groups = subcategoryGroups[categoryName];

    if (!groups) return null;

    return Object.fromEntries(
      Object.entries(groups)
        .map(([group, children]) => {
          const allowedChildren = children.filter((child) => categorySubs.includes(child));
          const isGroupAllowed = children.length === 0 && categorySubs.includes(group);

          if (children.length > 0 && allowedChildren.length > 0) {
            return [group, allowedChildren];
          }

          if (isGroupAllowed) {
            return [group, []];
          }

          return null;
        })
        .filter((entry): entry is [string, string[]] => Boolean(entry))
    );
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

  const currentSubcategoryGroups =
    cat ? getFilteredSubcategoryGroups(cat) : null;

  function displayCategoryLabel(categoryName: string) {
    const vehicleForCategory = vehicle === "Mopot" ? "Mopo" : vehicle;
    return translateCategory(
      locale,
      displayCategoryForVehicle(vehicleForCategory, categoryName)
    );
  }

  /* ── breadcrumb segments ── */
  const crumbs: Array<{ label: string; toStep: number; onRemove: () => void }> = [];
  if (step !== 0) {
    if (vehicle)  crumbs.push({ label: vehicleCrumbLabel(vehicle), toStep: 1,
      onRemove: () => { setVehicle(""); setBrand(""); setModel(""); setModelOpen(false); setYear(""); setEngineCc(""); setEngineCcOther(""); setEngineModel(""); setEngineModelOther(""); setCat(""); setSubGroup(""); setSub(""); setStep(1); }
    });
    if (brand)    crumbs.push({ label: brand, toStep: 1,
      onRemove: () => { setBrand(""); setModel(""); setModelOpen(false); setYear(""); setEngineCc(""); setEngineCcOther(""); setEngineModel(""); setEngineModelOther(""); setCat(""); setSubGroup(""); setSub(""); setStep(1); }
    });
    if (model || year || engineCc || engineModel) crumbs.push({ label: [model, year, engineCc ? engineCc+"cc" : "", engineModel].filter(Boolean).join(" · ") || "Tiedot", toStep: 2,
      onRemove: () => { setModel(""); setModelOpen(false); setYear(""); setEngineCc(""); setEngineCcOther(""); setEngineModel(""); setEngineModelOther(""); setStep(2); }
    });
    if (cat)      crumbs.push({ label: displayCategoryLabel(cat), toStep: 3,
      onRemove: () => { setCat(""); setSubGroup(""); setSub(""); setStep(3); }
    });
    if (subGroup) crumbs.push({ label: translateCategory(locale, subGroup), toStep: 4,
      onRemove: () => { setSubGroup(""); setSub(""); setStep(4); }
    });
    if (sub) {
      const subLabel = sub.includes(" / ") ? sub.split(" / ").slice(1).join(" / ") : sub;
      crumbs.push({ label: translateCategory(locale, subLabel), toStep: 5,
        onRemove: () => { setSub(""); setStep(5); }
      });
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="cd-backdrop" onClick={closeDrawer} aria-hidden="true" />
      )}

      {/* Drawer */}
      <aside className={`cd-drawer${isOpen ? " cd-drawer-open" : ""}`} aria-label="Kategoriaselain">

        {/* Header */}
        <div className="cd-header">
          <button
            type="button"
            className="cd-filter-submit"
            onClick={apply}
            aria-label={t.cdShowResults}
          >
            <span className="cd-logo"><Search size={18} /></span>
            <span className="cd-title">{t.cdFilter}</span>
          </button>
          <button
            type="button"
            className="cd-close"
            onPointerDown={closeDrawer}
            onClick={closeDrawer}
            aria-label="Sulje"
          >
            <X size={18} />
          </button>
        </div>

        {/* Breadcrumb */}
        {crumbs.length > 0 && (
          <nav className="cd-crumbs" aria-label="Sijaintisi">
            {crumbs.map((c, i) => (
              <span key={i} className="cd-crumb-seg">
                {i > 0 && <ChevronRight size={13} className="cd-crumb-sep" />}
                <span className="cd-crumb-item">
                  <button
                    className={`cd-crumb-btn${i === crumbs.length - 1 ? " cd-crumb-current" : ""}`}
                    onClick={() => setStep(c.toStep)}
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


          {/* Step 0: Choose what to categorize first */}
          {(step === 0 || (step === 1 && !vehicle)) && (
            <div className="cd-start">
              <div className="cd-start-hero">
                <span className="cd-start-eyebrow">{t.categories}</span>
                <h2>{startText.title}</h2>
                <p>{startText.lead}</p>
              </div>

              <div className="cd-start-grid">
                {startTiles.map((tile) => {
                  const selected =
                    tile.kind === "all"
                      ? !vehicle
                      : vehicle === tile.kind;

                  return (
                    <button
                      key={tile.kind}
                      type="button"
                      className={`cd-start-card${selected ? " cd-start-card-active" : ""}`}
                      onClick={() => {
                        setBrand("");
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

                        if (tile.kind === "all") {
                          setVehicle("");
                          setStep(3);
                          return;
                        }

                        setVehicle(tile.kind);
                        setStep(1);
                      }}
                    >
                      <VehicleTileImage kind={tile.kind} />
                      <span className="cd-start-copy">
                        <strong>{tile.label}</strong>
                        <small>{tile.helper}</small>
                      </span>
                      <ChevronRight size={18} className="cd-start-arrow" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Brand */}
          {step === 1 && vehicle && (
            <>
              <div className="cd-step-hint">{t.cdSelectBrand}</div>
              <ul className="cd-list">
                {(vehicle ? vehicleBrands[vehicle as VehicleType] : ["Kaikki"]).map(b => (
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
            <>
              <div className="cd-step-hint">{t.cdRefineVehicle}</div>
              <div className="cd-extra-filters">
                <div className="cd-extra-field" style={{ padding: "0 18px 12px" }}>
                  <label className="cd-field-label">{t.model}</label>
                  {brand && vehicle && BRAND_MODELS[vehicle]?.[brand] && !modelOpen ? (
                    <div className="cd-model-chips">
                      {BRAND_MODELS[vehicle][brand].map((m: string) => (
                        <button
                          key={m}
                          className={`cd-model-chip${model === m ? " cd-model-chip-active" : ""}`}
                          onClick={() => setModel(model === m ? "" : m)}
                        >{m}</button>
                      ))}
                      <button
                        className={`cd-model-chip cd-model-chip-muu${modelOpen || (model && !BRAND_MODELS[vehicle]?.[brand]?.includes(model)) ? " cd-model-chip-active" : ""}`}
                        onClick={() => setModelOpen(true)}
                      >{t.cdOther}</button>
                    </div>
                  ) : (
                    <div className="cd-search-row">
                      <Search size={14} />
                      <input
                        className="cd-input"
                        placeholder={t.cdModelPh}
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        autoFocus={modelOpen}
                      />
                      {model && <button className="cd-clear-x" onClick={() => setModel("")}>✕</button>}
                      {brand && vehicle && BRAND_MODELS[vehicle]?.[brand] && modelOpen && (
                        <button className="cd-clear-x" style={{ color: "#3b82f6" }} onClick={() => setModelOpen(false)}>←</button>
                      )}
                    </div>
                  )}
                </div>
                <div className="cd-extra-row">
                  <div className="cd-extra-field">
                    <label className="cd-field-label">{t.year}</label>
                    <div className="cd-search-row">
                      <input
                        className="cd-input"
                        placeholder={t.yearPlaceholder}
                        maxLength={4}
                        value={year}
                        onChange={e => setYear(e.target.value.replace(/\D/g, ""))}
                      />
                      {year && <button className="cd-clear-x" onClick={() => setYear("")}>✕</button>}
                    </div>
                  </div>
                </div>
                <div className="cd-extra-field" style={{ padding: "0 18px 12px" }}>
                  <label className="cd-field-label">{t.cdEngineSize}</label>
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
                      style={{ marginTop: 6 }}
                      type="number"
                      placeholder={t.sellTypeCc}
                      value={engineCcOther}
                      onChange={e => setEngineCcOther(e.target.value)}
                    />
                  )}
                </div>
              </div>
              <div className="cd-extra-field" style={{ padding: "0 18px 12px" }}>
                <label className="cd-field-label">{t.sellEngineType}</label>
                <select
                  className="cd-cc-select"
                  value={engineModel}
                  onChange={e => { setEngineModel(e.target.value); setEngineModelOther(""); }}
                  disabled={!brand}
                >
                  <option value="">{brand ? t.all : t.sellSelectBrandFirst}</option>
                  {(ENGINE_MODELS[vehicle]?.[brand] ?? []).map((em: string) => (
                    <option key={em} value={em}>{em}</option>
                  ))}
                  {brand && <option value="muu">{t.sellOtherOption}</option>}
                </select>
                {engineModel === "muu" && (
                  <input
                    className="cd-input"
                    style={{ marginTop: 6 }}
                    placeholder={t.sellTypeEngine}
                    value={engineModelOther}
                    onChange={e => setEngineModelOther(e.target.value)}
                  />
                )}
              </div>
              <div className="cd-skip-row" style={{ borderTop: "1px solid #f0f4f8", paddingTop: 10 }}>
                <button className="cd-apply" style={{ width: "100%" }} onClick={() => setStep(3)}>{t.cdContinueToParts}</button>
              </div>
            </>
          )}

          {/* Step 3: Category */}
          {step === 3 && (
            <ul className="cd-list cd-category-photo-list">
              {Object.keys(cats).map(c => (
                <li key={c}>
                  <button
                    className={`cd-category-photo-card ${partPictureClass(c)}${cat === c ? " cd-category-photo-active" : ""}`}
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
                        className={`cd-item cd-item-leaf${sub === group ? " cd-item-active" : ""}`}
                        onClick={() => applyLeaf(group, "")}
                      >
                        <span className="cd-icon-sm cd-thumb" aria-hidden="true">
                          <PartPicture kind={getPartPictureKind(group, cat)} />
                        </span>
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
            <ul className="cd-list">
              {(currentSubcategoryGroups?.[subGroup] ?? subs).map(s => {
                const translatedFull = translateCategory(locale, s);
                const leafLabel = translatedFull.includes(" / ") ? translatedFull.split(" / ").slice(1).join(" / ") : translatedFull;
                return (
                  <li key={s}>
                    <button
                      className={`cd-item cd-item-leaf${sub === s ? " cd-item-active" : ""}`}
                      onClick={() => applyLeaf(s)}
                    >
                      <span className="cd-icon-sm cd-thumb" aria-hidden="true">
                        <PartPicture kind={getPartPictureKind(s, subGroup, cat)} />
                      </span>
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
            <ul className="cd-list">
              {subs.map(s => (
                <li key={s}>
                  <button
                    className={`cd-item cd-item-leaf${sub === s ? " cd-item-active" : ""}`}
                    onClick={() => applyLeaf(s, "")}
                  >
                    <span className="cd-icon-sm cd-thumb" aria-hidden="true">
                      <PartPicture kind={getPartPictureKind(s, cat)} />
                    </span>
                    <span className="cd-label">{translateCategory(locale, s)}</span>
                    {sub === s ? <Check size={15} className="cd-check" /> : <ChevronRight size={15} className="cd-arrow" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </aside>

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
          border-radius: 6px; font-size: 12px; font-weight: 700; color: #3b82f6;
          transition: background .12s;
        }
        .cd-crumb-btn:hover { background: #eff6ff; }
        .cd-crumb-current { color: #0f172a; cursor: default; }
        .cd-crumb-current:hover { background: transparent; }
        .cd-crumb-item { display: inline-flex; align-items: center; gap: 1px;
          background: #eff6ff; border-radius: 7px; padding: 0 2px 0 0; }
        .cd-crumb-x {
          border: none; background: none; cursor: pointer; padding: 2px 4px;
          font-size: 10px; color: #94a3b8; line-height: 1; border-radius: 5px;
          transition: color .12s, background .12s;
        }
        .cd-crumb-x:hover { color: #ef4444; background: #fee2e2; }
        .cd-body { flex: 1; overflow-y: auto; padding: 8px 0; }
        .cd-list { list-style: none; margin: 0; padding: 0; }
        .cd-item {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 12px 18px; border: none; background: transparent;
          cursor: pointer; text-align: left; font-size: 14px; font-weight: 600;
          color: #1e293b; transition: background .15s;
        }
        .cd-item:hover { background: #f8fafc; }
        .cd-item-active { background: #eff6ff; color: #1d4ed8; }
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
        .cd-next-btn:hover { background: #1d4ed8; }
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
        .cd-apply:hover { background: #1d4ed8; }
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
        .cd-cc-select:focus { border-color: #3b82f6; }
        .cd-model-chips {
          display: flex; flex-wrap: wrap; gap: 6px; padding-top: 4px;
        }
        .cd-model-chip {
          padding: 5px 11px; border-radius: 20px; font-size: 12px; font-weight: 700;
          border: 1.5px solid #e2e8f0; background: #fff; color: #334155;
          cursor: pointer; transition: all .14s; white-space: nowrap;
        }
        .cd-model-chip:hover { border-color: #93c5fd; color: #1d4ed8; background: #eff6ff; }
        .cd-model-chip-active { border-color: #3b82f6 !important; background: #eff6ff !important; color: #1d4ed8 !important; }
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
        .cd-category-photo-card.cd-thumb-brake {
          --cd-category-photo: url("/category-main/ohjaus-hallintalaitteet.png");
        }
        .cd-category-photo-card.cd-thumb-electric,
        .cd-category-photo-card.cd-thumb-battery {
          --cd-category-photo: url("/category-main/sahkojarjestelmat.png");
        }
        .cd-category-photo-card.cd-thumb-cooling,
        .cd-category-photo-card.cd-thumb-fuel {
          --cd-category-photo: url("/category-main/jaahdytys-polttoaine.png");
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
        /* Sub-group image slots — put images in public/category-sub/ (.jpg or .png both work) */
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-moottorit {
          --cd-category-photo: url("/category-sub/moottorit.jpg"), url("/category-sub/moottorit.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-kytkimet {
          --cd-category-photo: url("/category-sub/kytkimet.jpg"), url("/category-sub/kytkimet.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-variaattorit {
          --cd-category-photo: url("/category-sub/variaattorit.jpg"), url("/category-sub/variaattorit.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-voimansiirto {
          --cd-category-photo: url("/category-sub/voimansiirto.jpg"), url("/category-sub/voimansiirto.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-telasto {
          --cd-category-photo: url("/category-sub/telasto.jpg"), url("/category-sub/telasto.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-alusta {
          --cd-category-photo: url("/category-sub/alusta.jpg"), url("/category-sub/alusta.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-tukivarret {
          --cd-category-photo: url("/category-sub/tukivarret.jpg"), url("/category-sub/tukivarret.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-iskunvaimentimet {
          --cd-category-photo: url("/category-sub/iskunvaimentimet.jpg"), url("/category-sub/iskunvaimentimet.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-ohjaus {
          --cd-category-photo: url("/category-sub/ohjaus.jpg"), url("/category-sub/ohjaus.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-hallintalaitteet {
          --cd-category-photo: url("/category-sub/hallintalaitteet.jpg"), url("/category-sub/hallintalaitteet.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-jarrut {
          --cd-category-photo: url("/category-sub/jarrut.jpg"), url("/category-sub/jarrut.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-sukset {
          --cd-category-photo: url("/category-sub/sukset.jpg"), url("/category-sub/sukset.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-sahko {
          --cd-category-photo: url("/category-sub/sahko.jpg"), url("/category-sub/sahko.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-sytytys {
          --cd-category-photo: url("/category-sub/sytytys.jpg"), url("/category-sub/sytytys.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-jaahdytys {
          --cd-category-photo: url("/category-sub/jaahdytys.jpg"), url("/category-sub/jaahdytys.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-polttoaine {
          --cd-category-photo: url("/category-sub/polttoaine.jpg"), url("/category-sub/polttoaine.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-pakoputkisto {
          --cd-category-photo: url("/category-sub/pakoputkisto.jpg"), url("/category-sub/pakoputkisto.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-runko {
          --cd-category-photo: url("/category-sub/runko.jpg"), url("/category-sub/runko.png");
        }
        .cd-sub-group-list .cd-category-photo-card.cd-subgrp-katteet {
          --cd-category-photo: url("/category-sub/katteet.jpg"), url("/category-sub/katteet.png");
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
      `}</style>
    </>
  );
}
