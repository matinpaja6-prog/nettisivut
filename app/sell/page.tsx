"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ImagePlus,
  LockKeyhole,
  Phone,
  Plus,
  UserRound,
  X
} from "lucide-react";

import type {
  User
} from "@supabase/supabase-js";

import {
  createListing,
  getCompanySellers,
  getListingSlotUsage,
  getProfile,
  getProfileExtraSlots,
  isProfileCompleted,
  isSupabaseConfigured,
  supabase,
  type CompanySeller,
  type UserProfile
} from "@/lib/supabase";
import {
  BASE_LISTING_SLOT_LIMIT,
  LISTING_SLOT_STORAGE_EVENT,
  getListingSlotLimit
} from "@/lib/listing-slots";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

import {
  conditions,
  displayCategoryForVehicle,
} from "@/lib/listings";
import { translateCategory, useLanguage } from "@/lib/i18n";
import {
  buildSubcategoryGroupsForVehicle,
  buildVehicleCategoriesFromTaxonomy
} from "@/lib/taxonomy";
import { useTaxonomy } from "@/app/components/TaxonomyProvider";

/* =========================
   FORM DEFAULT
========================= */

const emptyListing = {
  title: "",
  price: "",
  vehicleType: "Moottorikelkka",
  brand: "",
  brandOther: "",
  model: "",
  modelOther: "",
  year: "",
  engineCc: "",
  engineCcOther: "",
  engineModel: "",
  engineModelOther: "",
  category: "",
  subcategory: "",
  partNumber: "",
  location: "",
  locationCountry: "Suomi",
  locationCity: "",
  condition: "Hyvä",
  description: ""
};

const vehicleOptions = [
  "Moottorikelkka",
  "Mönkijä",
  "Motocross",
  "Mopo"
] as const;

const vehicleCardData: Record<string, { desc: string; img: string }> = {
  Moottorikelkka: {
    desc: "Kelkat, telastot, moottorit",
    img: "/vehicles/moottorikelkka.png"
  },
  Mönkijä: {
    desc: "ATV ja UTV osat",
    img: "/vehicles/monkija.png"
  },
  Motocross: {
    desc: "Crossi ja enduro",
    img: "/vehicles/motocross.png"
  },
  Mopo: {
    desc: "Mopot ja piikit",
    img: "/vehicles/mopot.png"
  }
};

const categoryMainVisuals: Record<string, string> = {
  "Moottori & voimansiirto": "/category-main/moottori-voimansiirto.png",
  "Alusta & telasto": "/category-main/alusta-telasto.png",
  "Renkaat & vanteet": "/category-sub/rengas.png",
  "Ohjaus & hallintalaitteet": "/category-main/ohjaus-hallintalaitteet.png",
  "Sähköjärjestelmät": "/category-main/sahkojarjestelmat.png",
  "Jäähdytys & polttoaine": "/category-main/jaahdytys-polttoaine.png",
  "Pakoputkisto": "/category-main/pakoputkisto.png",
  "Runko & katteet": "/category-main/runko-katteet.png",
  "Runko & kw": "/category-sub/runko.png"
};

const categoryCardVisuals: Record<string, string> = {
  "Moottori & voimansiirto": "/category-sub/moottorit.png",
  "Alusta & telasto": "/category-sub/alusta.png",
  "Renkaat & vanteet": "/category-sub/rengas.png",
  "Renkaat, vanteet & alusta": "/category-sub/rengas.png",
  "Ohjaus & hallintalaitteet": "/category-sub/ohjaus.png",
  "Sähköjärjestelmät": "/category-sub/sahko.png",
  "Jäähdytys & polttoaine": "/category-sub/jaahdytys.png",
  Pakoputkisto: "/category-sub/putkisto.png",
  "Runko & katteet": "/category-sub/runko.png",
  "Runko & kw": "/category-sub/runko.png"
};

const subCategoryVisuals: Record<string, string> = {
  Moottorit: "/category-sub/moottorit.png",
  Kytkimet: "/category-sub/kytkimet.png",
  Variaattorit: "/category-sub/variaattorit.png",
  Voimansiirto: "/category-sub/voimansiirto.png",
  "Variaattorin hihnat": "/category-sub/voimansiirto.png",
  Ketjukotelot: "/category-sub/voimansiirto.png",
  "Ketjut & hihnat": "/category-sub/voimansiirto.png",
  "Alusta & telasto": "/category-sub/alusta.png",
  Alusta: "/category-sub/alusta.png",
  Telasto: "/category-sub/telasto.png",
  Tukivarret: "/category-sub/tukivarret.png",
  "Renkaat & vanteet": "/category-sub/rengas.png",
  Renkaat: "/category-sub/rengas.png",
  Vanteet: "/category-sub/rengas.png",
  Rengassarjat: "/category-sub/rengas.png",
  Vannesetit: "/category-sub/rengas.png",
  "Akselit & laakerit": "/category-sub/rengas.png",
  Sukset: "/category-sub/sukset.png",
  Iskunvaimentimet: "/category-sub/iskunvaimentimet.png",
  Jouset: "/category-sub/alusta.png",
  Ohjaus: "/category-sub/ohjaus.png",
  Jarrut: "/category-sub/jarrut.png",
  Hallintalaitteet: "/category-sub/Hallintalaitteet.png",
  "Kaasukahvat": "/category-sub/Hallintalaitteet.png",
  "Kaasuvaijerit": "/category-sub/Hallintalaitteet.png",
  Sähköjärjestelmät: "/category-sub/sahko.png",
  "Sähkö": "/category-sub/sahko.png",
  Sytytys: "/category-sub/sytytys.png",
  Valot: "/category-sub/sahko.png",
  Anturit: "/category-sub/sahko.png",
  "Jäähdytys & polttoaine": "/category-sub/jaahdytys.png",
  Jäähdytys: "/category-sub/jaahdytys.png",
  Jäähdyttimet: "/category-sub/jaahdytys.png",
  Polttoainejärjestelmä: "/category-sub/polttoaine.png",
  Polttoainepumput: "/category-sub/polttoaine.png",
  Kaasuttimet: "/category-sub/polttoaine.png",
  "Pakoputkisto": "/category-sub/putkisto.png",
  "Runko & katteet": "/category-sub/runko.png",
  "Runko & kw": "/category-sub/runko.png",
  Runko: "/category-sub/runko.png",
  Katteet: "/category-sub/katteet.png",
  "Kokonainen katesarja": "/category-sub/katteet.png",
  "Kuomut & konepellit": "/category-sub/katteet.png",
  Sivukatteet: "/category-sub/katteet.png",
  Etupuskurit: "/category-sub/runko.png",
  Takapuskurit: "/category-sub/runko.png",
  "Istuimet & penkit": "/category-sub/runko.png",
  Tuulilasit: "/category-sub/katteet.png"
};

function getCategoryCardVisual(category: string) {
  return categoryCardVisuals[category] || subCategoryVisuals[category] || categoryMainVisuals[category] || "/parts-blue-bg.svg";
}

const vehicleBrands: Record<string, string[]> = {
  Moottorikelkka: ["Lynx", "Ski-Doo", "Polaris", "Arctic Cat", "Yamaha"],
  Mönkijä: ["Can-Am", "Polaris", "Yamaha", "Honda", "CFMOTO"],
  Motocross: ["KTM", "Yamaha", "Honda", "Kawasaki", "Husqvarna", "Suzuki", "GasGas", "Beta", "Sherco", "TM"],
  Mopo: ["Yamaha", "Honda", "Derbi", "Rieju", "KTM", "Aprilia"]
};

const engineCcOptions: Record<string, string[]> = {
  Moottorikelkka: ["250", "440", "500", "550", "600", "650", "700", "800", "850", "900", "1000", "1100", "1200"],
  Mönkijä:        ["250", "300", "350", "400", "420", "450", "500", "520", "570", "650", "660", "680", "700", "800", "850", "900", "1000"],
  Motocross:      ["50", "65", "85", "105", "125", "144", "150", "200", "250", "300", "350", "390", "400", "430", "450", "480", "500", "530"],
  Mopo:           ["50", "65", "70", "80", "90", "125", "200"]
};

function buildLocation(city: string, country: string) {
  return [city.trim(), country.trim()].filter(Boolean).join(", ");
}

type ModelEngineData = { engineCc: string; engineModel: string };
const brandModelEngineMap: Record<string, Record<string, Record<string, ModelEngineData>>> = {
  Moottorikelkka: {
    Lynx: {
      "Rave RE 600 E-TEC":        { engineCc: "600", engineModel: "Rotax 600 E-TEC" },
      "Rave RE 600 ACE":          { engineCc: "600", engineModel: "Rotax 600 ACE" },
      "Rave RE 600R E-TEC":       { engineCc: "600", engineModel: "Rotax 600R E-TEC" },
      "Commander 600 ACE":        { engineCc: "600", engineModel: "Rotax 600 ACE" },
      "Commander 800R E-TEC":     { engineCc: "800", engineModel: "Rotax 800R E-TEC" },
      "Commander 850 E-TEC":      { engineCc: "850", engineModel: "Rotax 850 E-TEC" },
      "BoonDocker 850 E-TEC":     { engineCc: "850", engineModel: "Rotax 850 E-TEC" },
      "Shredder RE 850 E-TEC":    { engineCc: "850", engineModel: "Rotax 850 E-TEC" },
      "Adventure 900 ACE":        { engineCc: "900", engineModel: "Rotax 900 ACE" },
      "Adventure 900 ACE Turbo":  { engineCc: "900", engineModel: "Rotax 900 ACE Turbo" },
    },
    "Ski-Doo": {
      "MXZ 550F":              { engineCc: "550", engineModel: "Rotax 550F" },
      "MXZ 600 ACE":           { engineCc: "600", engineModel: "Rotax 600 ACE" },
      "MXZ 600 E-TEC":         { engineCc: "600", engineModel: "Rotax 600 E-TEC" },
      "MXZ 600R E-TEC":        { engineCc: "600", engineModel: "Rotax 600R E-TEC" },
      "MXZ 850 E-TEC":         { engineCc: "850", engineModel: "Rotax 850 E-TEC" },
      "Renegade 600 E-TEC":    { engineCc: "600", engineModel: "Rotax 600 E-TEC" },
      "Renegade 850 E-TEC":    { engineCc: "850", engineModel: "Rotax 850 E-TEC" },
      "Renegade 900 ACE":      { engineCc: "900", engineModel: "Rotax 900 ACE" },
      "Summit 600 E-TEC":      { engineCc: "600", engineModel: "Rotax 600 E-TEC" },
      "Summit 850 E-TEC":      { engineCc: "850", engineModel: "Rotax 850 E-TEC" },
      "Summit 900 ACE Turbo":  { engineCc: "900", engineModel: "Rotax 900 ACE Turbo" },
      "Expedition 600 ACE":    { engineCc: "600", engineModel: "Rotax 600 ACE" },
      "Expedition 900 ACE":    { engineCc: "900", engineModel: "Rotax 900 ACE" },
      "Skandic 550F":          { engineCc: "550", engineModel: "Rotax 550F" },
      "Skandic 600 ACE":       { engineCc: "600", engineModel: "Rotax 600 ACE" },
      "Skandic 900 ACE":       { engineCc: "900", engineModel: "Rotax 900 ACE" },
    },
    Polaris: {
      "Indy 550":          { engineCc: "550", engineModel: "Patriot 550" },
      "Indy 600":          { engineCc: "600", engineModel: "Liberty 600 HO" },
      "Indy 650":          { engineCc: "650", engineModel: "Patriot 650" },
      "Indy 800 RMK":      { engineCc: "800", engineModel: "Liberty 800" },
      "Indy 850":          { engineCc: "850", engineModel: "Patriot 850" },
      "Rush 600":          { engineCc: "600", engineModel: "Liberty 600 HO" },
      "Rush 800":          { engineCc: "800", engineModel: "Liberty 800" },
      "Switchback 600":    { engineCc: "600", engineModel: "Liberty 600 HO" },
      "Switchback 800":    { engineCc: "800", engineModel: "Liberty 800" },
      "Switchback 850":    { engineCc: "850", engineModel: "Patriot 850" },
      "RMK 600":           { engineCc: "600", engineModel: "Liberty 600 HO" },
      "RMK 800":           { engineCc: "800", engineModel: "RMK 800" },
      "800 Pro-RMK":       { engineCc: "800", engineModel: "Liberty 800" },
      "850 Pro-RMK":       { engineCc: "850", engineModel: "Patriot 850" },
      "Voyageur 550":      { engineCc: "550", engineModel: "Liberty 550" },
      "Patriot Boost":     { engineCc: "850", engineModel: "Patriot Boost" },
    },
    "Arctic Cat": {
      "ZR 600":         { engineCc: "600", engineModel: "C-TEC2 600" },
      "ZR 800":         { engineCc: "800", engineModel: "C-TEC2 800" },
      "M 6000 154":     { engineCc: "600", engineModel: "C-TEC2 600" },
      "M 8000 154":     { engineCc: "800", engineModel: "C-TEC2 800" },
      "XF 6000":        { engineCc: "600", engineModel: "C-TEC2 600" },
      "XF 8000":        { engineCc: "800", engineModel: "C-TEC2 800" },
      "Pantera 7000":   { engineCc: "600", engineModel: "C-TEC2 600" },
      "Bearcat Z1 XT": { engineCc: "1100", engineModel: "C-TEC4 1100" },
    },
    Yamaha: {
      "Phazer 500":        { engineCc: "500", engineModel: "Genesis 500" },
      "RS Viking 500":     { engineCc: "500", engineModel: "Genesis 500FI" },
      "VK Professional":   { engineCc: "500", engineModel: "VK Professional 500" },
      "Nytro XTX":         { engineCc: "1000", engineModel: "FX Nytro 1000" },
      "Sidewinder L-TX":   { engineCc: "1000", engineModel: "Genesis 1000FI" },
      "Sidewinder SRX":    { engineCc: "1000", engineModel: "SRX 1000" },
    },
  },
  Mönkijä: {
    "Can-Am": {
      "Outlander 450":    { engineCc: "450", engineModel: "Rotax 450" },
      "Outlander 570":    { engineCc: "570", engineModel: "Rotax 570" },
      "Outlander 650":    { engineCc: "650", engineModel: "Rotax 650" },
      "Outlander 700":    { engineCc: "700", engineModel: "Rotax 700" },
      "Outlander 850":    { engineCc: "850", engineModel: "Rotax 850" },
      "Outlander 1000R":  { engineCc: "1000", engineModel: "Rotax 1000R" },
      "Renegade 570":     { engineCc: "570", engineModel: "Rotax 570" },
      "Renegade 650":     { engineCc: "650", engineModel: "Rotax 650" },
      "Renegade 850":     { engineCc: "850", engineModel: "Rotax 850" },
      "Renegade 1000R":   { engineCc: "1000", engineModel: "Rotax 1000R" },
      "DS 450":           { engineCc: "450", engineModel: "Rotax 450" },
      "DS 650":           { engineCc: "650", engineModel: "Rotax 650" },
    },
    Polaris: {
      "Sportsman 450 H.O.":  { engineCc: "450", engineModel: "Polaris 450" },
      "Sportsman 500":       { engineCc: "500", engineModel: "Polaris 500" },
      "Sportsman 570":       { engineCc: "570", engineModel: "Pro Star 570" },
      "Sportsman 850":       { engineCc: "850", engineModel: "Pro Star 850" },
      "Sportsman 1000":      { engineCc: "1000", engineModel: "Pro Star 1000" },
      "Scrambler 850":       { engineCc: "850", engineModel: "Pro Star 850" },
      "Scrambler 1000":      { engineCc: "1000", engineModel: "Pro Star 1000" },
      "Ranger 500":          { engineCc: "500", engineModel: "Polaris 500" },
      "Ranger 570":          { engineCc: "570", engineModel: "Pro Star 570" },
      "Ranger 800":          { engineCc: "800", engineModel: "Polaris 800" },
    },
    Yamaha: {
      "Bruin 350":       { engineCc: "350", engineModel: "Yamaha 350 Bruin" },
      "Kodiak 400":      { engineCc: "400", engineModel: "Yamaha 400 Kodiak" },
      "Kodiak 450":      { engineCc: "450", engineModel: "Yamaha 450 Kodiak" },
      "Kodiak 700":      { engineCc: "700", engineModel: "Yamaha 700 Kodiak EPS" },
      "Grizzly 350":     { engineCc: "350", engineModel: "Yamaha 350 Bruin" },
      "Grizzly 450":     { engineCc: "450", engineModel: "Yamaha 450 Kodiak" },
      "Grizzly 550":     { engineCc: "550", engineModel: "Yamaha 550 Grizzly" },
      "Grizzly 660":     { engineCc: "660", engineModel: "Yamaha 660 Grizzly" },
      "Grizzly 700":     { engineCc: "700", engineModel: "Yamaha 700 Grizzly" },
      "Grizzly 700 EPS": { engineCc: "700", engineModel: "Yamaha 700 EPS" },
    },
    Honda: {
      "Recon 250":    { engineCc: "250", engineModel: "TRX 250 Recon" },
      "Rancher 420":  { engineCc: "420", engineModel: "TRX 420 Rancher" },
      "Foreman 500":  { engineCc: "500", engineModel: "TRX 500 Foreman" },
      "Rubicon 500":  { engineCc: "500", engineModel: "TRX 500 Rubicon" },
      "Rincon 680":   { engineCc: "680", engineModel: "TRX 680 Rincon" },
      "TRX 700XX":    { engineCc: "700", engineModel: "TRX 700XX" },
    },
    CFMOTO: {
      "CForce 400":  { engineCc: "400", engineModel: "CFMoto 400" },
      "CForce 500":  { engineCc: "500", engineModel: "CFMoto 500" },
      "CForce 520":  { engineCc: "520", engineModel: "CFMoto 520" },
      "CForce 625":  { engineCc: "625", engineModel: "CFMoto 625" },
      "CForce 800":  { engineCc: "800", engineModel: "CFMoto 800" },
      "CForce 1000": { engineCc: "1000", engineModel: "CFMoto 1000" },
    },
  },
  Motocross: {
    KTM: {
      "SX 65":     { engineCc: "65",  engineModel: "SX 65" },
      "SX 85":     { engineCc: "85",  engineModel: "SX 85" },
      "SX 125":    { engineCc: "125", engineModel: "SX 125" },
      "SX 150":    { engineCc: "150", engineModel: "SX 150" },
      "SX 250":    { engineCc: "250", engineModel: "SX 250" },
      "SXF 250":   { engineCc: "250", engineModel: "SXF 250" },
      "SXF 350":   { engineCc: "350", engineModel: "SXF 350" },
      "SXF 450":   { engineCc: "450", engineModel: "SXF 450" },
      "EXC 125":   { engineCc: "125", engineModel: "EXC 125" },
      "EXC 200":   { engineCc: "200", engineModel: "EXC 200" },
      "EXC 250":   { engineCc: "250", engineModel: "EXC 250" },
      "EXC 300":   { engineCc: "300", engineModel: "EXC 300" },
      "EXC-F 350": { engineCc: "350", engineModel: "EXC-F 350" },
      "EXC-F 450": { engineCc: "450", engineModel: "EXC-F 450" },
      "EXC-F 500": { engineCc: "500", engineModel: "EXC-F 500" },
    },
    Yamaha: {
      "YZ 65":   { engineCc: "65",  engineModel: "YZ 65" },
      "YZ 85":   { engineCc: "85",  engineModel: "YZ 85" },
      "YZ 125":  { engineCc: "125", engineModel: "YZ 125" },
      "YZ 250":  { engineCc: "250", engineModel: "YZ 250" },
      "YZ 250X": { engineCc: "250", engineModel: "YZ 250X" },
      "YZ 250F": { engineCc: "250", engineModel: "YZ250F" },
      "YZ 450F": { engineCc: "450", engineModel: "YZ450F" },
      "WR 250F": { engineCc: "250", engineModel: "WR250F" },
      "WR 450F": { engineCc: "450", engineModel: "WR450F" },
    },
    Honda: {
      "CR 125R":    { engineCc: "125", engineModel: "CR 125R" },
      "CR 250R":    { engineCc: "250", engineModel: "CR 250R" },
      "CRF 150R":   { engineCc: "150", engineModel: "CRF 150R" },
      "CRF 250R":   { engineCc: "250", engineModel: "CRF 250R" },
      "CRF 450R":   { engineCc: "450", engineModel: "CRF 450R" },
      "CRF 250RX":  { engineCc: "250", engineModel: "CRF 250RX" },
      "CRF 450RX":  { engineCc: "450", engineModel: "CRF 450RX" },
      "CRF 250X":   { engineCc: "250", engineModel: "CRF 250X" },
    },
    Kawasaki: {
      "KX 65":   { engineCc: "65",  engineModel: "KX 65" },
      "KX 85":   { engineCc: "85",  engineModel: "KX 85" },
      "KX 100":  { engineCc: "100", engineModel: "KX 100" },
      "KX 112":  { engineCc: "112", engineModel: "KX 112" },
      "KX 125":  { engineCc: "125", engineModel: "KX 125" },
      "KX 250":  { engineCc: "250", engineModel: "KX 250" },
      "KX 250F": { engineCc: "250", engineModel: "KX 250F" },
      "KX 450":  { engineCc: "450", engineModel: "KX 450" },
      "KX 450X": { engineCc: "450", engineModel: "KX 450X" },
    },
    Husqvarna: {
      "TC 85":   { engineCc: "85",  engineModel: "TC 85" },
      "TC 125":  { engineCc: "125", engineModel: "TC 125" },
      "FC 250":  { engineCc: "250", engineModel: "FC 250" },
      "FC 350":  { engineCc: "350", engineModel: "FC 350" },
      "FC 450":  { engineCc: "450", engineModel: "FC 450" },
      "TE 150":  { engineCc: "150", engineModel: "TE 150" },
      "TE 250":  { engineCc: "250", engineModel: "TE 250" },
      "TE 300":  { engineCc: "300", engineModel: "TE 300" },
      "FE 350":  { engineCc: "350", engineModel: "FE 350" },
      "FE 450":  { engineCc: "450", engineModel: "FE 450" },
      "FE 501":  { engineCc: "500", engineModel: "FE 501" },
    },
    Suzuki: {
      "RM 85":   { engineCc: "85",  engineModel: "RM 85" },
      "RM 125":  { engineCc: "125", engineModel: "RM 125" },
      "RM 250":  { engineCc: "250", engineModel: "RM 250" },
      "RMZ 250": { engineCc: "250", engineModel: "RMZ 250" },
      "RMZ 450": { engineCc: "450", engineModel: "RMZ 450" },
    },
    GasGas: {
      "MC 85":    { engineCc: "85",  engineModel: "MC 85" },
      "MC 125":   { engineCc: "125", engineModel: "MC 125" },
      "MC 250F":  { engineCc: "250", engineModel: "MC 250F" },
      "MC 350F":  { engineCc: "350", engineModel: "MC 350F" },
      "MC 450F":  { engineCc: "450", engineModel: "MC 450F" },
      "EC 250F":  { engineCc: "250", engineModel: "EC 250F" },
      "EC 350F":  { engineCc: "350", engineModel: "EC 350F" },
      "EC 450F":  { engineCc: "450", engineModel: "EC 450F" },
    },
    Beta: {
      "RR 125":  { engineCc: "125", engineModel: "RR 125" },
      "RR 200":  { engineCc: "200", engineModel: "RR 200" },
      "RR 250":  { engineCc: "250", engineModel: "RR 250" },
      "RR 300":  { engineCc: "300", engineModel: "RR 300" },
      "RR 350":  { engineCc: "350", engineModel: "RR 350" },
      "RR 390":  { engineCc: "390", engineModel: "RR 390" },
      "RR 430":  { engineCc: "430", engineModel: "RR 430" },
      "RR 480":  { engineCc: "480", engineModel: "RR 480" },
    },
    Sherco: {
      "125 SE-R":  { engineCc: "125", engineModel: "125 SE-R" },
      "250 SE-R":  { engineCc: "250", engineModel: "250 SE-R" },
      "300 SE-R":  { engineCc: "300", engineModel: "300 SE-R" },
      "250 SE-F":  { engineCc: "250", engineModel: "250 SE-F" },
      "450 SE-F":  { engineCc: "450", engineModel: "450 SE-F" },
      "500 SE-F":  { engineCc: "500", engineModel: "500 SE-F" },
    },
    TM: {
      "MX 125":  { engineCc: "125", engineModel: "MX 125" },
      "MX 250":  { engineCc: "250", engineModel: "MX 250" },
      "MX 300":  { engineCc: "300", engineModel: "MX 300" },
      "MX 450F": { engineCc: "450", engineModel: "MX 450F" },
      "EN 300":  { engineCc: "300", engineModel: "EN 300" },
    },
  },
  Mopo: {
    Yamaha: {
      "Aerox 50":    { engineCc: "50",  engineModel: "Minarelli Vaaka – Horizontal skootteri (Aerox, Jog, Neo's, MBK Nitro, Ovetto)" },
      "Jog 50":      { engineCc: "50",  engineModel: "Minarelli Vaaka – Horizontal skootteri (Aerox, Jog, Neo's, MBK Nitro, Ovetto)" },
      "Neo's 50":    { engineCc: "50",  engineModel: "Minarelli Vaaka – Horizontal skootteri (Aerox, Jog, Neo's, MBK Nitro, Ovetto)" },
      "BW's 50":     { engineCc: "50",  engineModel: "Minarelli Pysty – Vertical skootteri (BW's, Slider, MBK Booster, Stunt)" },
      "Slider 50":   { engineCc: "50",  engineModel: "Minarelli Pysty – Vertical skootteri (BW's, Slider, MBK Booster, Stunt)" },
      "DT 50":       { engineCc: "50",  engineModel: "Minarelli AM6 (DT 50 R, TZR 50)" },
      "DT 50 R":     { engineCc: "50",  engineModel: "Minarelli AM6 (DT 50 R, TZR 50)" },
      "DT 50 MX":    { engineCc: "50",  engineModel: "Minarelli AM6 (DT 50 R, TZR 50)" },
      "DT 80":       { engineCc: "80",  engineModel: "Yamaha 2-tahti 80cc (DT 80, RD 80)" },
      "TZR 50":      { engineCc: "50",  engineModel: "Minarelli AM6 (DT 50 R, TZR 50)" },
      "Xenter 125":  { engineCc: "125", engineModel: "4-tahti 125cc (Xenter 125, WR125)" },
    },
    Honda: {
      "Dio 50":        { engineCc: "50",  engineModel: "Honda 4-tahti skootteri (Dio, SH 50, Zoomer, Vision)" },
      "SH 50":         { engineCc: "50",  engineModel: "Honda 4-tahti skootteri (Dio, SH 50, Zoomer, Vision)" },
      "Zoomer 50":     { engineCc: "50",  engineModel: "Honda 4-tahti skootteri (Dio, SH 50, Zoomer, Vision)" },
      "Vision 50":     { engineCc: "50",  engineModel: "Honda 4-tahti skootteri (Dio, SH 50, Zoomer, Vision)" },
      "NSR 50":        { engineCc: "50",  engineModel: "Honda 2-tahti (NSR 50, MB 80, CR 80)" },
      "MSX 125 Grom":  { engineCc: "125", engineModel: "Honda 4-tahti 125cc (MSX 125, PCX 125, CBF 125)" },
      "PCX 125":       { engineCc: "125", engineModel: "Honda 4-tahti 125cc (MSX 125, PCX 125, CBF 125)" },
      "CBF 125":       { engineCc: "125", engineModel: "Honda 4-tahti 125cc (MSX 125, PCX 125, CBF 125)" },
    },
    Derbi: {
      "Senda 50 R (-2005)":   { engineCc: "50",  engineModel: "Minarelli AM6 (GPR 50 -2005, Senda SM -2005)" },
      "Senda 50 R (2006+)":   { engineCc: "50",  engineModel: "Derbi D50B0 (Senda 50 2006+, GPR 50 2006+)" },
      "Senda 50 DRD":         { engineCc: "50",  engineModel: "Derbi D50B0 (Senda 50 2006+, GPR 50 2006+)" },
      "GPR 50 (-2005)":       { engineCc: "50",  engineModel: "Minarelli AM6 (GPR 50 -2005, Senda SM -2005)" },
      "GPR 50 (2006+)":       { engineCc: "50",  engineModel: "Derbi D50B0 (Senda 50 2006+, GPR 50 2006+)" },
      "Vamos 50":             { engineCc: "50",  engineModel: "Minarelli Vaaka – Horizontal (Aerox, Jog, BW's, Neos, Slider)" },
      "Mulhacen 125":         { engineCc: "125", engineModel: "4-tahti 125cc (Xenter 125, WR125)" },
    },
    Rieju: {
      "RS2 50":      { engineCc: "50",  engineModel: "Minarelli AM6 (RS2, RS3, MRT 50, Spike, Marathon)" },
      "RS3 50":      { engineCc: "50",  engineModel: "Minarelli AM6 (RS2, RS3, MRT 50, Spike, Marathon)" },
      "MRT 50":      { engineCc: "50",  engineModel: "Minarelli AM6 (RS2, RS3, MRT 50, Spike, Marathon)" },
      "Spike 50":    { engineCc: "50",  engineModel: "Minarelli AM6 (RS2, RS3, MRT 50, Spike, Marathon)" },
      "Marathon 50": { engineCc: "50",  engineModel: "Minarelli AM6 (RS2, RS3, MRT 50, Spike, Marathon)" },
      "MRT 125":     { engineCc: "125", engineModel: "4-tahti 125cc (Xenter 125, WR125)" },
    },
    KTM: {
      "SX 50":    { engineCc: "50",  engineModel: "KTM 2-tahti mini (SX 50, SX 65)" },
      "SX 65":    { engineCc: "65",  engineModel: "KTM 2-tahti mini (SX 50, SX 65)" },
      "Duke 125": { engineCc: "125", engineModel: "4-tahti 125cc (Duke 125, RC 125, Duke 200)" },
      "RC 125":   { engineCc: "125", engineModel: "4-tahti 125cc (Duke 125, RC 125, Duke 200)" },
      "Duke 200": { engineCc: "200", engineModel: "4-tahti 125cc (Duke 125, RC 125, Duke 200)" },
    },
    Aprilia: {
      "RS 50 (-2005)":   { engineCc: "50",  engineModel: "Minarelli AM6 (RS 50 -2005, RX 50 -2005, MX 50)" },
      "RX 50 (-2005)":   { engineCc: "50",  engineModel: "Minarelli AM6 (RS 50 -2005, RX 50 -2005, MX 50)" },
      "MX 50":           { engineCc: "50",  engineModel: "Minarelli AM6 (RS 50 -2005, RX 50 -2005, MX 50)" },
      "RS 50 (2006+)":   { engineCc: "50",  engineModel: "Derbi D50B0 (RS 50 2006+, RX 50 2006+, SX 50, RS4 50)" },
      "RX 50 (2006+)":   { engineCc: "50",  engineModel: "Derbi D50B0 (RS 50 2006+, RX 50 2006+, SX 50, RS4 50)" },
      "SX 50":           { engineCc: "50",  engineModel: "Derbi D50B0 (RS 50 2006+, RX 50 2006+, SX 50, RS4 50)" },
      "RS4 50":          { engineCc: "50",  engineModel: "Derbi D50B0 (RS 50 2006+, RX 50 2006+, SX 50, RS4 50)" },
      "SR 50 R":         { engineCc: "50",  engineModel: "Minarelli Vaaka – Horizontal (SR 50 R, Scarabeo 50)" },
      "Scarabeo 50":     { engineCc: "50",  engineModel: "Minarelli Vaaka – Horizontal (SR 50 R, Scarabeo 50)" },
      "RS4 125":         { engineCc: "125", engineModel: "4-tahti 125cc (RS4 125, RS 125, SMV 50)" },
      "RS 125":          { engineCc: "125", engineModel: "4-tahti 125cc (RS4 125, RS 125, SMV 50)" },
    },
  },
};

const brandEngineModels: Record<string, Record<string, string[]>> = {
  Moottorikelkka: {
    Lynx: [
      "Rotax 550F", "Rotax 600 ACE", "Rotax 600 E-TEC", "Rotax 600 H.O. E-TEC",
      "Rotax 600R E-TEC", "Rotax 800R E-TEC", "Rotax 850 E-TEC", "Rotax 850 E-TEC Turbo",
      "Rotax 900 ACE", "Rotax 900 ACE Turbo", "Rotax 900 ACE Turbo R"
    ],
    "Ski-Doo": [
      "Rotax 550F", "Rotax 600 ACE", "Rotax 600 E-TEC", "Rotax 600 H.O. E-TEC",
      "Rotax 600R E-TEC", "Rotax 650 H.O.", "Rotax 800R E-TEC", "Rotax 850 E-TEC",
      "Rotax 900 ACE", "Rotax 900 ACE Turbo", "Rotax 900 ACE Turbo R", "Rotax 1200 4-TEC"
    ],
    Polaris: [
      "Liberty 500", "Liberty 550", "Liberty 600 HO", "Liberty 700",
      "Liberty 800", "RMK 800", "Patriot 550", "Patriot 600",
      "Patriot 650", "Patriot 850", "Patriot Boost"
    ],
    "Arctic Cat": [
      "500 2-stroke", "600 EFI", "650 H.O.", "700 EFI",
      "800 H.O.", "C-TEC2 600", "C-TEC2 800", "C-TEC4 1100"
    ],
    Yamaha: [
      "Genesis 500", "Genesis 500FI", "Genesis 700", "Genesis 973",
      "Genesis 1000FI", "VK Professional 500", "FX Nytro 1000", "SRX 1000"
    ]
  },
  Mönkijä: {
    "Can-Am": [
      "Rotax 450", "Rotax 570", "Rotax 650", "Rotax 700",
      "Rotax 800R", "Rotax 850", "Rotax 1000R", "Rotax 1000 DPS"
    ],
    Polaris: [
      "Polaris 325", "Polaris 400", "Polaris 450", "Polaris 500",
      "Polaris 500 H.O.", "Polaris 570", "Polaris 800", "Polaris 850",
      "Polaris 1000", "Pro Star 570", "Pro Star 850", "Pro Star 1000"
    ],
    Yamaha: [
      "Yamaha 350 Bruin", "Yamaha 400 Kodiak", "Yamaha 420 Kodiak",
      "Yamaha 450 Kodiak", "Yamaha 550 Grizzly", "Yamaha 660 Grizzly",
      "Yamaha 700 Grizzly", "Yamaha 700 EPS", "Yamaha 700 Kodiak EPS"
    ],
    Honda: [
      "TRX 250 Recon", "TRX 300", "TRX 400 Rancher", "TRX 420 Rancher",
      "TRX 500 Foreman", "TRX 500 Rubicon", "TRX 680 Rincon", "TRX 700XX"
    ],
    CFMOTO: [
      "CFMoto 400", "CFMoto 500", "CFMoto 520", "CFMoto 625",
      "CFMoto 800", "CFMoto 850", "CFMoto 1000"
    ]
  },
  Motocross: {
    KTM: [
      "SX 50", "SX 65", "SX 85", "SX 105", "SX 125", "SX 150", "SX 250",
      "SXF 250", "SXF 350", "SXF 450",
      "EXC 125", "EXC 200", "EXC 250", "EXC 300",
      "EXC-F 250", "EXC-F 350", "EXC-F 450", "EXC-F 500"
    ],
    Yamaha: [
      "YZ 65", "YZ 85", "YZ 125", "YZ 250", "YZ 250X",
      "YZ250F", "YZ450F",
      "WR250F", "WR450F"
    ],
    Honda: [
      "CRF 50", "CRF 80", "CRF 100", "CR 125R", "CR 250R",
      "CRF 150R", "CRF 250R", "CRF 450R",
      "CRF 250X", "CRF 450X", "CRF 250RX", "CRF 450RX"
    ],
    Kawasaki: [
      "KX 65", "KX 85", "KX 100", "KX 112",
      "KX 125", "KX 250",
      "KX 250F", "KX 450", "KX 450X", "KLX 300"
    ],
    Husqvarna: [
      "TC 50", "TC 65", "TC 85", "TC 125",
      "FC 250", "FC 350", "FC 450",
      "TE 150", "TE 250", "TE 300",
      "FE 250", "FE 350", "FE 450", "FE 501"
    ],
    Suzuki: [
      "RM 85", "RM 125", "RM 250",
      "RMZ 250", "RMZ 450"
    ],
    GasGas: [
      "MC 50", "MC 65", "MC 85", "MC 125",
      "MC 250F", "MC 350F", "MC 450F",
      "EC 250F", "EC 350F", "EC 450F"
    ],
    Beta: [
      "RR 125", "RR 200", "RR 250", "RR 300",
      "RR 350", "RR 390", "RR 430", "RR 480", "RR 498",
      "RX 300", "RX 450"
    ],
    Sherco: [
      "125 SE-R", "250 SE-R", "300 SE-R",
      "250 SE-F", "300 SE-F", "450 SE-F", "500 SE-F"
    ],
    TM: [
      "MX 85", "MX 125", "MX 144", "MX 250", "MX 300",
      "MX 450F", "MX 530F", "EN 300"
    ]
  },
  Mopo: {
    Yamaha: [
      "Minarelli AM6 (DT 50 R, TZR 50)",
      "Yamaha 2-tahti 80cc (DT 80, RD 80)",
      "Minarelli Pysty – Vertical skootteri (BW's, Slider, MBK Booster, Stunt)",
      "Minarelli Vaaka – Horizontal skootteri (Aerox, Jog, Neo's, MBK Nitro, Ovetto)",
      "4-tahti 125cc (Xenter 125, WR125)"
    ],
    Honda: [
      "Honda 2-tahti (NSR 50, MB 80)",
      "Honda 4-tahti skootteri (Dio, SH 50, Zoomer, Vision)",
      "Honda 4-tahti 125cc (MSX 125, PCX 125, CBF 125)"
    ],
    Derbi: [
      "Minarelli AM6 (GPR 50 -2005, Senda SM/DRD -2005)",
      "Derbi D50B0 (Senda 50 2006+, GPR 50 2006+, Aprilia RS/RX 2006+)",
      "Minarelli Vaaka – Horizontal skootteri (Vamos 50)",
      "4-tahti 125cc (Mulhacen 125, Terra 125)"
    ],
    Rieju: [
      "Minarelli AM6 (RS1, RS2, RS3, MRT, RR, RRX, Spike, Marathon)"
    ],
    KTM: [
      "KTM 2-tahti mini (SX 50, SX 65)",
      "4-tahti 125cc (Duke 125, RC 125, Duke 200)"
    ],
    Aprilia: [
      "Minarelli AM6 (RS 50 -2005, RX 50 -2005, MX 50, AF1 50, Tuono 50)",
      "Derbi D50B0 (RS 50 2006+, RX 50 2006+, SX 50, RS4 50)",
      "Minarelli Vaaka – Horizontal skootteri (SR 50 R, Scarabeo 50)",
      "4-tahti 125cc (RS4 125, RS 125, SMV 50)"
    ]
  }
};

/* =========================
   HELPERS
========================= */

function getErrorMessage(error: unknown) {

  if (!error) {
    return "Tuntematon virhe.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (
    typeof error === "object" &&
    "message" in error
  ) {

    return String(
      (error as { message: string }).message
    );

  }

  return "Toiminto epäonnistui.";

}

const LISTING_CREATE_TIMEOUT_MS = 25000;

type CreateListingPayload = Parameters<typeof createListing>[0];
type CreateListingResult = Awaited<ReturnType<typeof createListing>>;

async function createListingWithTimeout(
  listing: CreateListingPayload,
  timeoutMs = LISTING_CREATE_TIMEOUT_MS
): Promise<CreateListingResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutResult = new Promise<CreateListingResult>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({
        data: null,
        error: new Error(
          "Julkaisu aikakatkaistiin. Tarkista omista ilmoituksista, tallentuiko ilmoitus, ja yritä tarvittaessa uudelleen."
        )
      });
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      createListing(listing),
      timeoutResult
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/* =========================
   PAGE
========================= */

export default function SellPage() {
  return (
    <Suspense fallback={<main className="sell-container" />}>
      <SellPageContent />
    </Suspense>
  );
}

function SellPageContent() {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ===== Dynamic taxonomy from admin (overrides hardcoded constants) =====
  const taxonomy = useTaxonomy();
  const vehicleOptions = useMemo(
    () => taxonomy.vehicles.map((v) => v.key),
    [taxonomy]
  );
  const vehicleCardData: Record<string, { desc: string; img: string }> = useMemo(() => {
    const out: Record<string, { desc: string; img: string }> = {};
    for (const v of taxonomy.vehicles) {
      out[v.key] = {
        desc: v.desc || "",
        img: v.image || "/vehicles/all.png"
      };
    }
    return out;
  }, [taxonomy]);
  const vehicleBrands: Record<string, string[]> = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const v of taxonomy.vehicles) out[v.key] = [...v.brands];
    return out;
  }, [taxonomy]);
  const vehicleTypeCategories: Record<string, Record<string, string[]>> = useMemo(() => {
    const out: Record<string, Record<string, string[]>> = {};
    for (const v of taxonomy.vehicles) {
      out[v.key] = buildVehicleCategoriesFromTaxonomy(taxonomy, v.key);
    }
    return out;
  }, [taxonomy]);
  const vehicleSubcategoryGroups: Record<string, Record<string, Record<string, string[]>>> = useMemo(() => {
    const out: Record<string, Record<string, Record<string, string[]>>> = {};
    for (const v of taxonomy.vehicles) {
      out[v.key] = buildSubcategoryGroupsForVehicle(taxonomy, v.key);
    }
    return out;
  }, [taxonomy]);

  const [user, setUser] =
    useState<User | null>(null);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [form, setForm] =
    useState(emptyListing);

  const [listingMode, setListingMode] =
    useState<"" | "single" | "multiple">("");

  const [selectedParts, setSelectedParts] =
    useState<string[]>([]);

  const [customPartName, setCustomPartName] =
    useState("");

  const [selectedPresetIds, setSelectedPresetIds] =
    useState<string[]>([]);

  const [selectedSubGroup, setSelectedSubGroup] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const [partPrices, setPartPrices] =
    useState<Record<string, string>>({});

  const [partImages, setPartImages] =
    useState<Record<string, string[]>>({});

  const [partTitles, setPartTitles] =
    useState<Record<string, string>>({});

  const [partDescriptions, setPartDescriptions] =
    useState<Record<string, string>>({});

  const [partNumbers, setPartNumbers] =
    useState<Record<string, string>>({});

  const [partConditions, setPartConditions] =
    useState<Record<string, string>>({});

  const [expandedParts, setExpandedParts] =
    useState<Record<string, boolean>>({}); 

  const [expandedPartGroups, setExpandedPartGroups] =
    useState<Record<string, boolean>>({});

  const [images, setImages] =
    useState<string[]>([]);

  const [previewImage, setPreviewImage] =
    useState<string | null>(null);

  const [status, setStatus] =
    useState("");

  const [priceSuggestion, setPriceSuggestion] =
    useState<{ avg: number; min: number; max: number; q1: number; q3: number; count: number; label: string } | null>(null);

  const [partSuggestions, setPartSuggestions] =
    useState<Record<string, { avg: number; min: number; max: number; q1: number; q3: number; count: number; label: string } | null>>({});

  useEffect(() => {
    const engine = form.engineModel === "muu" ? form.engineModelOther : form.engineModel;
    const engineCc = form.engineCc === "muu" ? form.engineCcOther : form.engineCc;
    const cat    = form.category;
    const sub    = form.subcategory;
    // Require both category AND a real engine model selection
    if (!cat || !sub || !engine) { setPriceSuggestion(null); return; }
    const params = new URLSearchParams({ category: cat, subcategory: sub, engine_model: engine });
    if (engineCc) params.set("engine_cc", engineCc);
    if (form.year) params.set("year", form.year);
    fetch(`/api/price-suggestion?${params}`)
      .then((r) => r.json())
      .then((d) => setPriceSuggestion(d.suggestion ?? null))
      .catch(() => setPriceSuggestion(null));
  }, [form.category, form.subcategory, form.engineCc, form.engineCcOther, form.engineModel, form.engineModelOther, form.year]);

  useEffect(() => {
    if (listingMode !== "multiple") return;
    const engine = form.engineModel === "muu" ? form.engineModelOther : form.engineModel;
    const engineCc = form.engineCc === "muu" ? form.engineCcOther : form.engineCc;
    if (!engine) { setPartSuggestions({}); return; }
    const newSuggestions: Record<string, { avg: number; min: number; max: number; q1: number; q3: number; count: number; label: string } | null> = {};
    const fetches = selectedParts.map(async (part) => {
      const slashIdx = part.indexOf(" / ");
      if (slashIdx === -1) { newSuggestions[part] = null; return; }
      const cat = part.slice(0, slashIdx);
      const sub = part.slice(slashIdx + 3);
      if (!cat || !sub) { newSuggestions[part] = null; return; }
      const params = new URLSearchParams({ category: cat, subcategory: sub, engine_model: engine });
      if (engineCc) params.set("engine_cc", engineCc);
      if (form.year) params.set("year", form.year);
      try {
        const r = await fetch(`/api/price-suggestion?${params}`);
        const d = await r.json();
        newSuggestions[part] = d.suggestion ?? null;
      } catch {
        newSuggestions[part] = null;
      }
    });
    void Promise.all(fetches).then(() => setPartSuggestions({ ...newSuggestions }));
  }, [listingMode, selectedParts, form.engineCc, form.engineCcOther, form.engineModel, form.engineModelOther, form.year]);

  const [listingSlotUsed, setListingSlotUsed] =
    useState(0);

  const [listingSlotLimit, setListingSlotLimit] =
    useState(BASE_LISTING_SLOT_LIMIT);

  const [companySellers, setCompanySellers] =
    useState<CompanySeller[]>([]);

  const [selectedCompanySellerIds, setSelectedCompanySellerIds] =
    useState<string[]>([]);

  const hasUrlParams = !!(searchParams.get("make") || searchParams.get("model") || searchParams.get("year") || searchParams.get("vehicleType"));

  useEffect(() => {
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const year = searchParams.get("year");
    const vehicleType = searchParams.get("vehicleType");

    if (make || model || year || vehicleType) {
      setForm((prev) => ({
        ...prev,
        brand: make || prev.brand,
        model: model || prev.model,
        modelOther: "",
        year: year || prev.year,
        vehicleType: vehicleType || prev.vehicleType
      }));
      setListingMode("multiple");
    }
  }, [searchParams]);

  const DRAFT_KEY = "sell_draft_v1";

  useEffect(() => {
    if (hasUrlParams) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.form) {
          setForm({
            ...d.form,
            locationCountry: d.form.locationCountry ?? "Suomi",
            locationCity: d.form.locationCity ?? d.form.location ?? "",
            category: "",
            subcategory: ""
          });
        }
        if (d.images) setImages(d.images);
      }
      setSelectedSubGroup("");
      setSelectedParts([]);
      setSelectedPresetIds([]);
      setPartPrices({});
      setPartImages({});
      setPartTitles({});
      setPartDescriptions({});
      setPartNumbers({});
      setPartConditions({});
      setExpandedParts({});
      setExpandedPartGroups({});
    } catch {}
  }, []);

  useEffect(() => {
    const draft = {
      form,
      listingMode,
      selectedParts,
      partPrices,
      partTitles,
      partDescriptions,
      partNumbers,
      partConditions,
      images,
      partImages
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      try {
        const { images: _i, partImages: _pi, ...withoutImages } = draft;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(withoutImages));
      } catch {}
    }
  }, [form, listingMode, selectedParts, partPrices, partTitles, partDescriptions, partNumbers, partConditions, images, partImages]);

  const currentCategories =
    vehicleTypeCategories[form.vehicleType] ?? vehicleTypeCategories.Moottorikelkka;

  const currentCategoryNames = Object.keys(currentCategories);

  function displayCategory(category: string) {
    return translateCategory(
      locale,
      displayCategoryForVehicle(form.vehicleType, category)
    );
  }

  const subcategories =
    currentCategories[form.category] || [];

  const subcategoryGroups = vehicleSubcategoryGroups[form.vehicleType] ?? {};

  const currentSubcategoryGroups =
    form.category && subcategoryGroups[form.category]
      ? Object.fromEntries(
          Object.entries(subcategoryGroups[form.category])
            .map(([group, children]) => {
              const allowedChildren =
                children.filter((child) => subcategories.includes(child));
              const isGroupAllowed =
                children.length === 0 && subcategories.includes(group);

              if (children.length > 0 && allowedChildren.length > 0) {
                return [group, allowedChildren];
              }

              if (isGroupAllowed) {
                return [group, []];
              }

              return null;
            })
            .filter((entry): entry is [string, string[]] => Boolean(entry))
        )
      : null;

  const currentSubcategoryEntries = currentSubcategoryGroups
    ? Object.entries(currentSubcategoryGroups)
    : [];
  const skipsSinglePassthroughGroup =
    currentSubcategoryEntries.length === 1 &&
    currentSubcategoryEntries[0][0] === form.category &&
    currentSubcategoryEntries[0][1].length > 0;

  function getSubCategoryVisual(name: string) {
    const leafName = name.includes(" / ") ? name.split(" / ").pop() || name : name;
    return (
      subCategoryVisuals[name] ||
      subCategoryVisuals[leafName] ||
      categoryMainVisuals[name] ||
      categoryMainVisuals[form.category] ||
      "/parts-blue-bg.svg"
    );
  }

  const brandOptions =
    vehicleBrands[form.vehicleType] || [];

  const modelOptions =
    Object.keys(brandModelEngineMap[form.vehicleType]?.[form.brand] ?? {});

  function chooseBrand(value: string) {
    setForm({
      ...form,
      brand: value,
      brandOther: "",
      model: "",
      modelOther: "",
      engineCc: "",
      engineCcOther: "",
      engineModel: "",
      engineModelOther: ""
    });
    setBrandPickerOpen(false);
    setModelPickerOpen(false);
    if (value && value !== "muu") {
      window.setTimeout(() => {
        document.getElementById("sell-field-model")?.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
        setModelPickerOpen(true);
      }, 160);
    }
  }

  function chooseModel(value: string) {
    const eng = brandModelEngineMap[form.vehicleType]?.[form.brand]?.[value];
    setForm({
      ...form,
      model: value,
      modelOther: "",
      engineCc: eng ? eng.engineCc : "",
      engineCcOther: "",
      engineModel: eng ? eng.engineModel : "",
      engineModelOther: ""
    });
    setModelPickerOpen(false);
    if (value && value !== "muu") {
      setTimeout(() => {
        document.getElementById("sell-field-year")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }, 80);
    }
  }

  function chooseEngineCc(value: string) {
    setForm({
      ...form,
      engineCc: value,
      engineCcOther: ""
    });
    setEngineCcPickerOpen(false);
  }

  function chooseEngineModel(value: string) {
    setForm({
      ...form,
      engineModel: value,
      engineModelOther: ""
    });
    setEngineModelPickerOpen(false);
  }

  const resolvedModel =
    form.model === "muu" ? (form.modelOther || "").trim() : form.model;

  function partKey(category: string, part: string) {
    return `${category} / ${part}`;
  }

  function partGroupKey(part: string) {
    return part.split(" / ").filter(Boolean)[0] || "Muut tuotteet";
  }

  function displayPart(part: string) {
    const segments = part.split(" / ").filter(Boolean);

    if (segments.length === 0) return part;
    if (segments.length === 1) return translateCategory(locale, segments[0]);

    return segments.map((s) => translateCategory(locale, s)).join(" / ");
  }

  function getPartDisplayGroup(category: string, subcategoryPath: string) {
    const first = subcategoryPath.split(" / ").filter(Boolean)[0] || category;

    if (category === "Ohjaus & hallintalaitteet") {
      if (first === "Ohjaus" || first === "Kokonainen ohjaus" || first === "Ohjaustangot" || first === "Käsisuojat" || first === "Tangon korokepalat" || first === "Sukset") {
        return "Ohjaus";
      }
      return "Hallintalaitteet";
    }

    if (category === "Jäähdytys & polttoaine") {
      if (first === "Kokonainen jäähdytysjärjestelmä" || first === "Jäähdyttimet" || first === "Vesipumput" || first === "Letkut") {
        return "Jäähdytys";
      }
      return "Polttoaine";
    }

    if (category === "Runko & katteet") {
      if (first === "Kokonainen runko" || first === "Tunnelit") {
        return "Runko";
      }
      return "Katteet";
    }

    if (category === "Alusta & telasto") {
      if (first === "Kokonainen telasto" || first === "Telasto" || first === "Telamatot") {
        return "Telasto";
      }
      return "Alusta";
    }

    if (category === "Moottori & voimansiirto") {
      if (first === "Variaattorit") {
        return "Variaattorit";
      }
      if (first === "Variaattorin hihnat" || first === "Kokonainen voimansiirto" || first === "Ketjukotelot" || first === "Ketjut & hihnat") {
        return "Voimansiirto";
      }
    }

    return category;
  }

  function togglePart(part: string) {
    setSelectedParts((prev) => {
      const existingPart = prev.find((item) => item.toLowerCase() === part.toLowerCase());
      if (existingPart) {
        const partToRemove = existingPart;
        setPartPrices((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setPartImages((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setPartTitles((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setPartDescriptions((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setPartConditions((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setExpandedParts((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        return prev.filter((item) => item.toLowerCase() !== part.toLowerCase());
      }
      setExpandedParts((p) => ({ ...p, [part]: true }));
      setExpandedPartGroups((p) => ({ ...p, [partGroupKey(part)]: true }));
      return [...prev, part];
    });
  }

  function removePartGroup(parts: string[]) {
    const removedLower = new Set(parts.map((part) => part.toLowerCase()));
    const cleanRecord = <T,>(record: Record<string, T>) =>
      Object.fromEntries(
        Object.entries(record).filter(([key]) => !removedLower.has(key.toLowerCase()))
      ) as Record<string, T>;

    setSelectedParts((prev) =>
      prev.filter((part) => !removedLower.has(part.toLowerCase()))
    );
    setPartPrices((current) => cleanRecord(current));
    setPartImages((current) => cleanRecord(current));
    setPartTitles((current) => cleanRecord(current));
    setPartDescriptions((current) => cleanRecord(current));
    setPartNumbers((current) => cleanRecord(current));
    setPartConditions((current) => cleanRecord(current));
    setExpandedParts((current) => cleanRecord(current));
    setExpandedPartGroups((current) => {
      const next = { ...current };
      parts.forEach((part) => {
        delete next[partGroupKey(part)];
      });
      return next;
    });
  }

  function addCustomPart() {
    const name = customPartName.trim();
    if (!name) return;
    const category = form.category || "Oma tuote";
    const customPart = `${category} / ${name}`;
    const exists = selectedParts.some((part) => part.toLowerCase() === customPart.toLowerCase());
    if (!exists) {
      setSelectedParts((prev) => [...prev, customPart]);
      setExpandedParts((prev) => ({ ...prev, [customPart]: true }));
      setExpandedPartGroups((prev) => ({ ...prev, [partGroupKey(customPart)]: true }));
    }
    setCustomPartName("");
  }

  type Preset = { id: string; emoji: string; label: string; desc: string; parts: string[] };

  // Auto-build "whole vehicle" preset from current categories
  function buildWholePreset(vt: string, label: string, emoji: string): Preset {
    const cats = vehicleTypeCategories[vt] || {};
    const allParts: string[] = [];
    Object.entries(cats).forEach(([cat, subs]) => {
      (subs as string[]).forEach((s) => allParts.push(`${cat} / ${s}`));
    });
    return {
      id: "whole",
      emoji,
      label,
      desc: "Kaikki osat — täytä vain ne joita myyt",
      parts: allParts
    };
  }

  const partPresetsByVehicle: Record<string, Preset[]> = {
    Moottorikelkka: [
      buildWholePreset("Moottorikelkka", "Koko kelkka", "🛷"),
      { id: "engine", emoji: "🔧", label: "Koko moottori", desc: "Kokonainen moottori, sylinterit, männät, kampiakseli",
        parts: [
          "Moottori & voimansiirto / Kokonainen moottori",
          "Moottori & voimansiirto / Moottorit / Sylinterit",
          "Moottori & voimansiirto / Moottorit / Sylinterin kannet",
          "Moottori & voimansiirto / Moottorit / Männät",
          "Moottori & voimansiirto / Moottorit / Kampiakselit",
          "Moottori & voimansiirto / Moottorit / Moottorin lohkot",
          "Moottori & voimansiirto / Moottorit / Laakerit & tiivisteet",
          "Moottori & voimansiirto / Kytkimet / Kokonainen kytkin",
          "Moottori & voimansiirto / Kytkimet / Kytkin kitit",
          "Moottori & voimansiirto / Kytkimet / Jouset",
          "Moottori & voimansiirto / Kytkimet / Painovarret"
        ] },
      { id: "variator", emoji: "⚙️", label: "Voimansiirto", desc: "Variaattorit, hihnat, ketjukotelo",
        parts: [
          "Moottori & voimansiirto / Variaattorit / Kokonainen variaattori",
          "Moottori & voimansiirto / Variaattorit / Variaattori kitit",
          "Moottori & voimansiirto / Variaattorit / Jouset",
          "Moottori & voimansiirto / Variaattorin hihnat",
          "Moottori & voimansiirto / Kokonainen voimansiirto",
          "Moottori & voimansiirto / Ketjukotelot",
          "Moottori & voimansiirto / Ketjut & hihnat"
        ] },
      { id: "track", emoji: "❄️", label: "Alusta & telasto", desc: "Kokonainen telasto, tukivarret, telamatot",
        parts: [
          "Alusta & telasto / Kokonainen telasto",
          "Alusta & telasto / Telasto / Etupukit",
          "Alusta & telasto / Telasto / Takapukit",
          "Alusta & telasto / Telasto / Liukurungot",
          "Alusta & telasto / Telasto / Tela- ja kääntöpyörät",
          "Alusta & telasto / Telamatot",
          "Alusta & telasto / Tukivarret / Oikea ylä",
          "Alusta & telasto / Tukivarret / Oikea ala",
          "Alusta & telasto / Tukivarret / Vasen ylä",
          "Alusta & telasto / Tukivarret / Vasen ala",
          "Alusta & telasto / Olka-akselit",
          "Alusta & telasto / Vetoakselit",
          "Alusta & telasto / Jouset"
        ] },
      { id: "controls", emoji: "🕹️", label: "Ohjaus & hallintalaitteet", desc: "Tangot, kaasu, jarrut, sukset",
        parts: [
          "Ohjaus & hallintalaitteet / Kokonainen ohjaus",
          "Ohjaus & hallintalaitteet / Ohjaustangot",
          "Ohjaus & hallintalaitteet / Käsisuojat",
          "Ohjaus & hallintalaitteet / Tangon korokepalat",
          "Ohjaus & hallintalaitteet / Kaasukahvat",
          "Ohjaus & hallintalaitteet / Kaasuvaijerit",
          "Ohjaus & hallintalaitteet / Jarrut / Kokonainen jarrujärjestelmä",
          "Ohjaus & hallintalaitteet / Jarrut / Levyt",
          "Ohjaus & hallintalaitteet / Jarrut / Jarrusatulat & letkut",
          "Ohjaus & hallintalaitteet / Jarrut / Kahvat & puristimet",
          "Ohjaus & hallintalaitteet / Jarrut / Jarrupalat",
          "Ohjaus & hallintalaitteet / Ohjaus / Ohjausakselit",
          "Ohjaus & hallintalaitteet / Ohjaus / Raidetangot",
          "Ohjaus & hallintalaitteet / Ohjaus / Muut ohjauksen osat",
          "Ohjaus & hallintalaitteet / Sukset / Kokonainen sukset",
          "Ohjaus & hallintalaitteet / Sukset / Ohjainraudat",
          "Ohjaus & hallintalaitteet / Sukset / Suksikumit"
        ] },
      { id: "suspension", emoji: "🛞", label: "Iskunvaimentimet", desc: "Etu- ja telaston iskunvaimentimet, jouset",
        parts: [
          "Alusta & telasto / Iskunvaimentimet / Kokonainen iskunvaimennussarja",
          "Alusta & telasto / Iskunvaimentimet / Etuiskunvaimentimet",
          "Alusta & telasto / Iskunvaimentimet / Telaston iskunvaimentimet",
          "Alusta & telasto / Jouset"
        ] },
      { id: "electric", emoji: "⚡", label: "Sähköjärjestelmä", desc: "Staattorit, sytytyspuolat, akku, valot",
        parts: [
          "Sähköjärjestelmät / Kokonainen sähköjärjestelmä",
          "Sähköjärjestelmät / Staattorit & vauhtipyörät",
          "Sähköjärjestelmät / Triggerit",
          "Sähköjärjestelmät / Sytytyspuolat",
          "Sähköjärjestelmät / Akut",
          "Sähköjärjestelmät / ECU & ohjainyksiköt",
          "Sähköjärjestelmät / Johtosarjat",
          "Sähköjärjestelmät / Valot",
          "Sähköjärjestelmät / Anturit",
          "Sähköjärjestelmät / Mittaristot",
          "Sähköjärjestelmät / Kytkimet & katkaisijat"
        ] },
      { id: "fuel", emoji: "⛽", label: "Jäähdytys & polttoaine", desc: "Jäähdyttimet, kaasuttimet, pumput",
        parts: [
          "Jäähdytys & polttoaine / Kokonainen jäähdytysjärjestelmä",
          "Jäähdytys & polttoaine / Kokonainen polttoainejärjestelmä",
          "Jäähdytys & polttoaine / Jäähdyttimet",
          "Jäähdytys & polttoaine / Vesipumput",
          "Jäähdytys & polttoaine / Letkut",
          "Jäähdytys & polttoaine / Polttoainepumput",
          "Jäähdytys & polttoaine / Kaasuttimet",
          "Jäähdytys & polttoaine / Ruiskutusjärjestelmät",
          "Jäähdytys & polttoaine / Polttoainesäiliöt & tankit"
        ] },
      { id: "exhaust", emoji: "💨", label: "Pakoputkisto", desc: "Alkukäyrät, pakosarjat, äänenvaimentimet",
        parts: [
          "Pakoputkisto / Kokonainen pakoputkisto",
          "Pakoputkisto / Alkukäyrät",
          "Pakoputkisto / Pakosarjat & Y-haarat",
          "Pakoputkisto / Äänenvaimentimet",
          "Pakoputkisto / Resonanssiputket"
        ] },
      { id: "fairings", emoji: "🪟", label: "Runko & katteet", desc: "Tunnelit, kuomut, puskurit, tuulilasit",
        parts: [
          "Runko & katteet / Kokonainen runko",
          "Runko & katteet / Kokonainen katesarja",
          "Runko & katteet / Tunnelit / Keskirunko",
          "Runko & katteet / Tunnelit / Eturunko",
          "Runko & katteet / Kuomut & konepellit",
          "Runko & katteet / Sivukatteet",
          "Runko & katteet / Etupuskurit",
          "Runko & katteet / Takapuskurit",
          "Runko & katteet / Istuimet & penkit",
          "Runko & katteet / Tuulilasit"
        ] }
    ],
    Mönkijä: [
      buildWholePreset("Mönkijä", "Koko mönkijä", "🚜"),
      { id: "engine", emoji: "🔧", label: "Koko moottori", desc: "Kokonainen moottori, sylinterit, männät, kampiakseli",
        parts: [
          "Moottori & voimansiirto / Kokonainen moottori",
          "Moottori & voimansiirto / Moottorit / Sylinterit",
          "Moottori & voimansiirto / Moottorit / Sylinterin kannet",
          "Moottori & voimansiirto / Moottorit / Männät",
          "Moottori & voimansiirto / Moottorit / Kampiakselit",
          "Moottori & voimansiirto / Moottorit / Moottorin lohkot",
          "Moottori & voimansiirto / Moottorit / Laakerit & tiivisteet",
          "Moottori & voimansiirto / Kytkimet / Kokonainen kytkin",
          "Moottori & voimansiirto / Kytkimet / Kytkin kitit",
          "Moottori & voimansiirto / Kytkimet / Jouset",
          "Moottori & voimansiirto / Kytkimet / Painovarret"
        ] },
      { id: "variator", emoji: "⚙️", label: "Voimansiirto", desc: "Variaattorit, hihnat, voimansiirto",
        parts: [
          "Moottori & voimansiirto / Variaattorit / Kokonainen variaattori",
          "Moottori & voimansiirto / Variaattorit / Variaattori kitit",
          "Moottori & voimansiirto / Variaattorit / Jouset",
          "Moottori & voimansiirto / Variaattorin hihnat",
          "Moottori & voimansiirto / Kokonainen voimansiirto",
          "Moottori & voimansiirto / Ketjukotelot",
          "Moottori & voimansiirto / Ketjut & hihnat"
        ] },
      { id: "chassis", emoji: "🛞", label: "Alusta & telasto", desc: "Alusta, telasto, tukivarret ja akselit",
        parts: [
          "Alusta & telasto / Kokonainen telasto",
          "Alusta & telasto / Telasto / Etupukit",
          "Alusta & telasto / Telasto / Takapukit",
          "Alusta & telasto / Telasto / Liukurungot",
          "Alusta & telasto / Telasto / Tela- ja kääntöpyörät",
          "Alusta & telasto / Telamatot",
          "Alusta & telasto / Kokonainen alusta",
          "Alusta & telasto / Renkaat & vanteet / Renkaat",
          "Alusta & telasto / Renkaat & vanteet / Vanteet",
          "Alusta & telasto / Renkaat & vanteet / Rengassarjat",
          "Alusta & telasto / Renkaat & vanteet / Vannesetit",
          "Alusta & telasto / Tukivarret / Oikea ylä",
          "Alusta & telasto / Tukivarret / Oikea ala",
          "Alusta & telasto / Tukivarret / Vasen ylä",
          "Alusta & telasto / Tukivarret / Vasen ala",
          "Alusta & telasto / Olka-akselit",
          "Alusta & telasto / Vetoakselit",
          "Alusta & telasto / Jouset"
        ] },
      { id: "suspension", emoji: "🌀", label: "Iskunvaimentimet", desc: "Kokonainen iskunvaimennussarja, etu- ja taka-iskunvaimentimet",
        parts: [
          "Alusta & telasto / Iskunvaimentimet / Kokonainen iskunvaimennussarja",
          "Alusta & telasto / Iskunvaimentimet / Etuiskunvaimentimet",
          "Alusta & telasto / Iskunvaimentimet / Takaiskunvaimentimet",
          "Alusta & telasto / Jouset"
        ] },
      { id: "controls", emoji: "🕹️", label: "Ohjaus & hallintalaitteet", desc: "Ohjaus, hallintalaitteet ja jarrut",
        parts: [
          "Ohjaus & hallintalaitteet / Kokonainen ohjaus",
          "Ohjaus & hallintalaitteet / Ohjaustangot",
          "Ohjaus & hallintalaitteet / Käsisuojat",
          "Ohjaus & hallintalaitteet / Tangon korokepalat",
          "Ohjaus & hallintalaitteet / Kaasukahvat",
          "Ohjaus & hallintalaitteet / Kaasuvaijerit",
          "Ohjaus & hallintalaitteet / Jarrut / Kokonainen jarrujärjestelmä",
          "Ohjaus & hallintalaitteet / Jarrut / Levyt",
          "Ohjaus & hallintalaitteet / Jarrut / Jarrusatulat & letkut",
          "Ohjaus & hallintalaitteet / Jarrut / Kahvat & puristimet",
          "Ohjaus & hallintalaitteet / Jarrut / Jarrupalat",
          "Ohjaus & hallintalaitteet / Ohjaus / Ohjausakselit",
          "Ohjaus & hallintalaitteet / Ohjaus / Raidetangot",
          "Ohjaus & hallintalaitteet / Ohjaus / Muut ohjauksen osat"
        ] },
      { id: "electric", emoji: "⚡", label: "Sähköjärjestelmä", desc: "Kokonainen sähköjärjestelmä, staattorit, akku, valot",
        parts: [
          "Sähköjärjestelmät / Kokonainen sähköjärjestelmä",
          "Sähköjärjestelmät / Staattorit & vauhtipyörät",
          "Sähköjärjestelmät / Triggerit",
          "Sähköjärjestelmät / Sytytyspuolat",
          "Sähköjärjestelmät / Akut",
          "Sähköjärjestelmät / ECU & ohjainyksiköt",
          "Sähköjärjestelmät / Johtosarjat",
          "Sähköjärjestelmät / Valot",
          "Sähköjärjestelmät / Anturit",
          "Sähköjärjestelmät / Mittaristot",
          "Sähköjärjestelmät / Kytkimet & katkaisijat"
        ] },
      { id: "fuel", emoji: "⛽", label: "Jäähdytys & polttoaine", desc: "Jäähdyttimet, kaasuttimet, pumput",
        parts: [
          "Jäähdytys & polttoaine / Kokonainen jäähdytysjärjestelmä",
          "Jäähdytys & polttoaine / Kokonainen polttoainejärjestelmä",
          "Jäähdytys & polttoaine / Jäähdyttimet",
          "Jäähdytys & polttoaine / Vesipumput",
          "Jäähdytys & polttoaine / Letkut",
          "Jäähdytys & polttoaine / Polttoainepumput",
          "Jäähdytys & polttoaine / Kaasuttimet",
          "Jäähdytys & polttoaine / Ruiskutusjärjestelmät",
          "Jäähdytys & polttoaine / Polttoainesäiliöt & tankit"
        ] },
      { id: "exhaust", emoji: "💨", label: "Pakoputkisto", desc: "Kokonainen pakoputkisto, pakosarjat, äänenvaimentimet",
        parts: [
          "Pakoputkisto / Kokonainen pakoputkisto",
          "Pakoputkisto / Alkukäyrät",
          "Pakoputkisto / Pakosarjat & Y-haarat",
          "Pakoputkisto / Äänenvaimentimet",
          "Pakoputkisto / Resonanssiputket"
        ] },
      { id: "fairings", emoji: "🪟", label: "Runko & katteet", desc: "Kokonainen runko, katteet, puskurit, istuimet",
        parts: [
          "Runko & katteet / Kokonainen runko",
          "Runko & katteet / Kokonainen katesarja",
          "Runko & katteet / Kuomut & konepellit",
          "Runko & katteet / Sivukatteet",
          "Runko & katteet / Etupuskurit",
          "Runko & katteet / Takapuskurit",
          "Runko & katteet / Istuimet & penkit",
          "Runko & katteet / Tuulilasit"
        ] }
    ],
    Motocross: [
      buildWholePreset("Motocross", "Koko pyörä", "🏍️"),
      { id: "engine", emoji: "🔧", label: "Koko moottori", desc: "Kokonainen moottori, sylinterit, männät",
        parts: [
          "Moottori & voimansiirto / Kokonainen moottori",
          "Moottori & voimansiirto / Moottorit / Sylinterit",
          "Moottori & voimansiirto / Moottorit / Sylinterin kannet",
          "Moottori & voimansiirto / Moottorit / Männät",
          "Moottori & voimansiirto / Moottorit / Kampiakselit",
          "Moottori & voimansiirto / Moottorit / Moottorin lohkot",
          "Moottori & voimansiirto / Moottorit / Laakerit & tiivisteet",
          "Moottori & voimansiirto / Kytkimet / Kokonainen kytkin",
          "Moottori & voimansiirto / Kytkimet / Kytkin kitit",
          "Moottori & voimansiirto / Kytkimet / Jouset",
          "Moottori & voimansiirto / Kytkimet / Painovarret"
        ] },
      { id: "drive", emoji: "⚙️", label: "Voimansiirto", desc: "Kokonainen voimansiirto, ketjut, ketjukotelo",
        parts: [
          "Moottori & voimansiirto / Kokonainen voimansiirto",
          "Moottori & voimansiirto / Ketjukotelot",
          "Moottori & voimansiirto / Ketjut & hihnat"
        ] },
      { id: "suspension", emoji: "🌀", label: "Iskunvaimentimet", desc: "Kokonainen iskunvaimennussarja, etuhaarukka, takaiskari",
        parts: [
          "Alusta & telasto / Iskunvaimentimet / Kokonainen iskunvaimennussarja",
          "Alusta & telasto / Iskunvaimentimet / Etuiskunvaimentimet",
          "Alusta & telasto / Iskunvaimentimet / Takaiskunvaimentimet",
          "Alusta & telasto / Jouset"
        ] },
      { id: "chassis", emoji: "🛞", label: "Alusta & telasto", desc: "Alusta, telasto, renkaat ja akselit",
        parts: [
          "Alusta & telasto / Kokonainen alusta",
          "Alusta & telasto / Renkaat & vanteet / Renkaat",
          "Alusta & telasto / Renkaat & vanteet / Vanteet",
          "Alusta & telasto / Renkaat & vanteet / Rengassarjat",
          "Alusta & telasto / Renkaat & vanteet / Vannesetit",
          "Alusta & telasto / Renkaat & vanteet / Akselit & laakerit",
          "Alusta & telasto / Tukivarret / Oikea ylä",
          "Alusta & telasto / Tukivarret / Oikea ala",
          "Alusta & telasto / Tukivarret / Vasen ylä",
          "Alusta & telasto / Tukivarret / Vasen ala",
          "Alusta & telasto / Olka-akselit",
          "Alusta & telasto / Vetoakselit"
        ] },
      { id: "controls", emoji: "🕹️", label: "Ohjaus & hallintalaitteet", desc: "Ohjaus, hallintalaitteet ja jarrut",
        parts: [
          "Ohjaus & hallintalaitteet / Kokonainen ohjaus",
          "Ohjaus & hallintalaitteet / Ohjaustangot",
          "Ohjaus & hallintalaitteet / Käsisuojat",
          "Ohjaus & hallintalaitteet / Tangon korokepalat",
          "Ohjaus & hallintalaitteet / Kaasukahvat",
          "Ohjaus & hallintalaitteet / Kaasuvaijerit",
          "Ohjaus & hallintalaitteet / Jarrut / Kokonainen jarrujärjestelmä",
          "Ohjaus & hallintalaitteet / Jarrut / Levyt",
          "Ohjaus & hallintalaitteet / Jarrut / Jarrusatulat & letkut",
          "Ohjaus & hallintalaitteet / Jarrut / Kahvat & puristimet",
          "Ohjaus & hallintalaitteet / Jarrut / Jarrupalat",
          "Ohjaus & hallintalaitteet / Ohjaus / Ohjausakselit",
          "Ohjaus & hallintalaitteet / Ohjaus / Raidetangot",
          "Ohjaus & hallintalaitteet / Ohjaus / Muut ohjauksen osat"
        ] },
      { id: "electric", emoji: "⚡", label: "Sähköjärjestelmä", desc: "Kokonainen sähköjärjestelmä, sytytys, akku, valot",
        parts: [
          "Sähköjärjestelmät / Kokonainen sähköjärjestelmä",
          "Sähköjärjestelmät / Staattorit & vauhtipyörät",
          "Sähköjärjestelmät / Triggerit",
          "Sähköjärjestelmät / Sytytyspuolat",
          "Sähköjärjestelmät / Akut",
          "Sähköjärjestelmät / ECU & ohjainyksiköt",
          "Sähköjärjestelmät / Johtosarjat",
          "Sähköjärjestelmät / Valot",
          "Sähköjärjestelmät / Anturit",
          "Sähköjärjestelmät / Mittaristot",
          "Sähköjärjestelmät / Kytkimet & katkaisijat"
        ] },
      { id: "fuel", emoji: "⛽", label: "Jäähdytys & polttoaine", desc: "Jäähdyttimet, kaasuttimet ja pumput",
        parts: [
          "Jäähdytys & polttoaine / Kokonainen jäähdytysjärjestelmä",
          "Jäähdytys & polttoaine / Kokonainen polttoainejärjestelmä",
          "Jäähdytys & polttoaine / Jäähdyttimet",
          "Jäähdytys & polttoaine / Vesipumput",
          "Jäähdytys & polttoaine / Letkut",
          "Jäähdytys & polttoaine / Polttoainepumput",
          "Jäähdytys & polttoaine / Kaasuttimet",
          "Jäähdytys & polttoaine / Ruiskutusjärjestelmät",
          "Jäähdytys & polttoaine / Polttoainesäiliöt & tankit"
        ] },
      { id: "exhaust", emoji: "💨", label: "Pakoputkisto", desc: "Kokonainen pakoputkisto, pakosarjat, äänenvaimentimet",
        parts: [
          "Pakoputkisto / Kokonainen pakoputkisto",
          "Pakoputkisto / Alkukäyrät",
          "Pakoputkisto / Pakosarjat & Y-haarat",
          "Pakoputkisto / Äänenvaimentimet",
          "Pakoputkisto / Resonanssiputket"
        ] },
      { id: "fairings", emoji: "🪟", label: "Runko & katteet", desc: "Kokonainen runko, katteet, puskurit, istuimet",
        parts: [
          "Runko & katteet / Kokonainen runko",
          "Runko & katteet / Kokonainen katesarja",
          "Runko & katteet / Sivukatteet",
          "Runko & katteet / Etupuskurit",
          "Runko & katteet / Takapuskurit",
          "Runko & katteet / Istuimet & penkit"
        ] }
    ],
    Mopo: [
      buildWholePreset("Mopo", "Koko mopo", "🛵"),
      { id: "engine", emoji: "🔧", label: "Koko moottori", desc: "Kokonainen moottori, sylinteri, männät",
        parts: [
          "Moottori & voimansiirto / Kokonainen moottori",
          "Moottori & voimansiirto / Moottorit / Sylinterit",
          "Moottori & voimansiirto / Moottorit / Sylinterin kannet",
          "Moottori & voimansiirto / Moottorit / Männät",
          "Moottori & voimansiirto / Moottorit / Kampiakselit",
          "Moottori & voimansiirto / Moottorit / Moottorin lohkot",
          "Moottori & voimansiirto / Moottorit / Laakerit & tiivisteet",
          "Moottori & voimansiirto / Kytkimet / Kokonainen kytkin",
          "Moottori & voimansiirto / Kytkimet / Kytkin kitit",
          "Moottori & voimansiirto / Kytkimet / Jouset",
          "Moottori & voimansiirto / Kytkimet / Painovarret"
        ] },
      { id: "variator", emoji: "⚙️", label: "Voimansiirto", desc: "Variaattorit, hihnat, voimansiirto",
        parts: [
          "Moottori & voimansiirto / Variaattorit / Kokonainen variaattori",
          "Moottori & voimansiirto / Variaattorit / Variaattori kitit",
          "Moottori & voimansiirto / Variaattorit / Jouset",
          "Moottori & voimansiirto / Variaattorin hihnat",
          "Moottori & voimansiirto / Kokonainen voimansiirto",
          "Moottori & voimansiirto / Ketjukotelot",
          "Moottori & voimansiirto / Ketjut & hihnat"
        ] },
      { id: "suspension", emoji: "🌀", label: "Iskunvaimentimet", desc: "Kokonainen iskunvaimennussarja, etu- ja taka-iskunvaimentimet",
        parts: [
          "Alusta & telasto / Iskunvaimentimet / Kokonainen iskunvaimennussarja",
          "Alusta & telasto / Iskunvaimentimet / Etuiskunvaimentimet",
          "Alusta & telasto / Iskunvaimentimet / Takaiskunvaimentimet",
          "Alusta & telasto / Jouset"
        ] },
      { id: "chassis", emoji: "🛞", label: "Alusta & telasto", desc: "Alusta, telasto, renkaat ja akselit",
        parts: [
          "Alusta & telasto / Kokonainen alusta",
          "Alusta & telasto / Renkaat & vanteet / Renkaat",
          "Alusta & telasto / Renkaat & vanteet / Vanteet",
          "Alusta & telasto / Renkaat & vanteet / Rengassarjat",
          "Alusta & telasto / Renkaat & vanteet / Vannesetit",
          "Alusta & telasto / Renkaat & vanteet / Akselit & laakerit",
          "Alusta & telasto / Olka-akselit",
          "Alusta & telasto / Vetoakselit",
          "Alusta & telasto / Jouset"
        ] },
      { id: "controls", emoji: "🕹️", label: "Ohjaus & hallintalaitteet", desc: "Ohjaus, hallintalaitteet ja jarrut",
        parts: [
          "Ohjaus & hallintalaitteet / Kokonainen ohjaus",
          "Ohjaus & hallintalaitteet / Ohjaustangot",
          "Ohjaus & hallintalaitteet / Käsisuojat",
          "Ohjaus & hallintalaitteet / Tangon korokepalat",
          "Ohjaus & hallintalaitteet / Kaasukahvat",
          "Ohjaus & hallintalaitteet / Kaasuvaijerit",
          "Ohjaus & hallintalaitteet / Jarrut / Kokonainen jarrujärjestelmä",
          "Ohjaus & hallintalaitteet / Jarrut / Levyt",
          "Ohjaus & hallintalaitteet / Jarrut / Jarrusatulat & letkut",
          "Ohjaus & hallintalaitteet / Jarrut / Kahvat & puristimet",
          "Ohjaus & hallintalaitteet / Jarrut / Jarrupalat",
          "Ohjaus & hallintalaitteet / Ohjaus / Ohjausakselit",
          "Ohjaus & hallintalaitteet / Ohjaus / Raidetangot",
          "Ohjaus & hallintalaitteet / Ohjaus / Muut ohjauksen osat"
        ] },
      { id: "electric", emoji: "⚡", label: "Sähköjärjestelmä", desc: "Kokonainen sähköjärjestelmä, sytytys, akku, valot",
        parts: [
          "Sähköjärjestelmät / Kokonainen sähköjärjestelmä",
          "Sähköjärjestelmät / Staattorit & vauhtipyörät",
          "Sähköjärjestelmät / Triggerit",
          "Sähköjärjestelmät / Sytytyspuolat",
          "Sähköjärjestelmät / Akut",
          "Sähköjärjestelmät / ECU & ohjainyksiköt",
          "Sähköjärjestelmät / Johtosarjat",
          "Sähköjärjestelmät / Valot",
          "Sähköjärjestelmät / Anturit",
          "Sähköjärjestelmät / Mittaristot",
          "Sähköjärjestelmät / Kytkimet & katkaisijat"
        ] },
      { id: "fuel", emoji: "⛽", label: "Jäähdytys & polttoaine", desc: "Jäähdyttimet, kaasuttimet ja pumput",
        parts: [
          "Jäähdytys & polttoaine / Kokonainen polttoainejärjestelmä",
          "Jäähdytys & polttoaine / Kokonainen jäähdytysjärjestelmä",
          "Jäähdytys & polttoaine / Jäähdyttimet",
          "Jäähdytys & polttoaine / Vesipumput",
          "Jäähdytys & polttoaine / Letkut",
          "Jäähdytys & polttoaine / Polttoainepumput",
          "Jäähdytys & polttoaine / Kaasuttimet",
          "Jäähdytys & polttoaine / Ruiskutusjärjestelmät",
          "Jäähdytys & polttoaine / Polttoainesäiliöt & tankit"
        ] },
      { id: "exhaust", emoji: "💨", label: "Pakoputkisto", desc: "Kokonainen pakoputkisto, pakosarjat, äänenvaimentimet",
        parts: [
          "Pakoputkisto / Kokonainen pakoputkisto",
          "Pakoputkisto / Alkukäyrät",
          "Pakoputkisto / Pakosarjat & Y-haarat",
          "Pakoputkisto / Äänenvaimentimet",
          "Pakoputkisto / Resonanssiputket"
        ] },
      { id: "fairings", emoji: "🪟", label: "Runko & katteet", desc: "Kokonainen runko, katteet, puskurit, istuimet",
        parts: [
          "Runko & katteet / Kokonainen runko",
          "Runko & katteet / Kokonainen katesarja",
          "Runko & katteet / Sivukatteet",
          "Runko & katteet / Etupuskurit",
          "Runko & katteet / Takapuskurit",
          "Runko & katteet / Istuimet & penkit"
        ] }
    ]
  };

  function isPresetPartAllowed(vehicleType: string, part: string) {
    const [category, ...rest] = part.split(" / ");
    const subcategory = rest.join(" / ");
    return Boolean(
      category &&
      subcategory &&
      (
        currentCategories[category]?.includes(subcategory) ||
        Boolean(subcategoryGroups[category]?.[subcategory])
      )
    );
  }

  const basePartPresets =
    partPresetsByVehicle[form.vehicleType] ?? partPresetsByVehicle.Moottorikelkka;

  const clutchPreset: Preset = {
    id: "clutch",
    emoji: "⚙️",
    label: "Kytkinpaketti",
    desc: "Kytkin, kytkin kitit, jouset ja painovarret",
    parts: [
      "Moottori & voimansiirto / Kytkimet / Kokonainen kytkin",
      "Moottori & voimansiirto / Kytkimet / Kytkin kitit",
      "Moottori & voimansiirto / Kytkimet / Jouset",
      "Moottori & voimansiirto / Kytkimet / Painovarret"
    ]
  };

  const cleanedBasePartPresets = basePartPresets.flatMap((preset) => {
    if (preset.id !== "engine") return [preset];

    const engineOnlyPreset = {
      ...preset,
      desc: "Moottorin runko ja sisäosat ilman kytkintä",
      parts: preset.parts.filter((part) => !part.includes(" / Kytkimet / "))
    };

    if (basePartPresets.some((item) => item.id === clutchPreset.id)) {
      return [engineOnlyPreset];
    }

    return [engineOnlyPreset, clutchPreset];
  });

  const partPresets: Preset[] =
    cleanedBasePartPresets
      .map((preset) =>
        ({
          ...preset,
          parts: preset.parts.filter((part) =>
            isPresetPartAllowed(form.vehicleType, part)
          )
        })
      )
      .filter((preset) => preset.parts.length > 0);

  useEffect(() => {
    setSelectedPresetIds((current) => {
      const selectedPartKeys = new Set(selectedParts.map((part) => part.toLowerCase()));
      const next = current.filter((id) => {
        const preset = partPresets.find((item) => item.id === id);
        return Boolean(
          preset &&
          preset.parts.length > 0 &&
          preset.parts.every((part) => selectedPartKeys.has(part.toLowerCase()))
        );
      });

      return next.length === current.length && next.every((id, index) => id === current[index])
        ? current
        : next;
    });
  }, [partPresets, selectedParts]);

  function getPresetVisual(preset: Preset) {
    if (preset.id === "whole") return vehicleCardData[form.vehicleType]?.img || "/vehicles/all.png";
    if (preset.id === "engine") return "/category-sub/moottorit.png";
    if (preset.id === "clutch") return "/category-sub/kytkimet.png";
    if (preset.id === "variator" || preset.id === "drive") return "/category-sub/voimansiirto.png";
    if (preset.id === "track" || preset.id === "chassis") return "/category-sub/alusta.png";
    if (preset.id === "controls") return "/category-sub/ohjaus.png";
    if (preset.id === "suspension") return "/category-sub/iskunvaimentimet.png";
    if (preset.id === "electric") return "/category-sub/sahko.png";
    if (preset.id === "fuel") return "/category-sub/polttoaine.png";
    if (preset.id === "exhaust") return "/category-sub/putkisto.png";
    if (preset.id === "fairings") return "/category-sub/runko.png";
    return "/parts-blue-bg.svg";
  }

  type SelectedPartSubgroup = {
    key: string;
    label: string;
    desc: string;
    visual: string;
    parts: string[];
  };

  type SelectedPartGroup = SelectedPartSubgroup & {
    subgroups: SelectedPartSubgroup[];
  };

  const selectedPartGroups = (() => {
    const groups = new Map<string, SelectedPartGroup>();

    selectedParts.forEach((part) => {
      const segments = part.split(" / ").filter(Boolean);
      const category = segments[0] || "Muut tuotteet";
      const subcategoryPath = segments.slice(1).join(" / ");
      const group = subcategoryPath ? getPartDisplayGroup(category, subcategoryPath) : category;
      const key = category;
      const subgroupKey = group === category ? category : `${category} / ${group}`;
      const existing = groups.get(key);

      if (existing) {
        existing.parts.push(part);
        const subgroup = existing.subgroups.find((item) => item.key === subgroupKey);
        if (subgroup) {
          subgroup.parts.push(part);
        } else {
          existing.subgroups.push({
            key: subgroupKey,
            label: translateCategory(locale, group),
            desc: translateCategory(locale, category),
            visual: subCategoryVisuals[group] || categoryCardVisuals[group] || getSubCategoryVisual(group),
            parts: [part]
          });
        }
        return;
      }

      groups.set(key, {
        key,
        label: translateCategory(locale, category),
        desc: group === category
          ? "Avaa tämän ryhmän tuotteet"
          : translateCategory(locale, group),
        visual: categoryCardVisuals[category] || subCategoryVisuals[category] || getSubCategoryVisual(category),
        parts: [part],
        subgroups: [{
          key: subgroupKey,
          label: translateCategory(locale, group),
          desc: translateCategory(locale, category),
          visual: subCategoryVisuals[group] || categoryCardVisuals[group] || getSubCategoryVisual(group),
          parts: [part]
        }]
      });
    });

    return Array.from(groups.values());
  })();

  function renderPartCards(parts: string[]) {
    return (
      <div className="part-cards part-cards-flat part-group-items">
        {parts.map((part) => {
          const isPartExpanded = expandedParts[part] ?? false;
          const partPrice = partPrices[part]?.trim();
          const partNumber = partNumbers[part]?.trim();
          const partImageCount = partImages[part]?.length ?? 0;

          return (
            <div key={part} className={`part-card ${isPartExpanded ? "is-expanded" : "is-collapsed"}`}>
              <div className="part-card-header">
                <div className="part-card-label">
                  <span className="part-card-index">{selectedParts.indexOf(part) + 1}</span>
                  <div className="part-card-title-group">
                    {part.split(" / ").length > 1 && (
                      <span className="part-card-category">
                        {part.split(" / ").slice(0, -1).map(s => translateCategory(locale, s)).join(" › ")}
                      </span>
                    )}
                    <span className="part-card-name">
                      {translateCategory(locale, part.split(" / ").pop() || part)}
                    </span>
                    {!isPartExpanded && (partPrice || partNumber || partImageCount > 0) ? (
                      <span className="part-card-summary">
                        {partPrice ? <small>{partPrice} €</small> : null}
                        {partNumber ? <small>{partNumber}</small> : null}
                        {partImageCount > 0 ? <small>{partImageCount} kuvaa</small> : null}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="part-card-header-actions">
                  <button
                    type="button"
                    className="part-card-toggle"
                    onClick={() => setExpandedParts((p) => ({ ...p, [part]: !p[part] }))}
                    aria-label={expandedParts[part] ? t.sellCollapse : t.sellExpand}
                    title={expandedParts[part] ? t.sellCollapse : t.sellExpand}
                  >
                    {expandedParts[part] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  <button type="button" className="part-card-remove" onClick={() => togglePart(part)} aria-label={`Poista ${part}`}>
                    <X size={13} />
                  </button>
                </div>
              </div>

              {isPartExpanded && (
                <div className="part-card-quick">
                  <input
                    type="number"
                    min="1"
                    className="part-price-input"
                    placeholder={`Hinta (€)${form.price ? ` — oletus ${form.price}€` : ""}`}
                    value={partPrices[part] || ""}
                    onChange={(e) => setPartPrices((prev) => ({ ...prev, [part]: normalizePriceInput(e.target.value) }))}
                  />
                  <input
                    className="part-number-input"
                    placeholder="Varaosanumero"
                    value={partNumbers[part] || ""}
                    onChange={(e) => setPartNumbers((prev) => ({ ...prev, [part]: e.target.value }))}
                  />
                  {partSuggestions[part] && partSuggestions[part]!.count >= 5 && (
                    <div
                      className="part-price-hint"
                      title={`${partSuggestions[part]!.count} ${t.sellSalesCount} · ${t.sellPriceRange} ${partSuggestions[part]!.min}–${partSuggestions[part]!.max} € · ${t.sellAverage} ${partSuggestions[part]!.avg} €`}
                    >
                      <span>💡</span>
                      <span>{t.sellTypicalPriceHint}</span>
                      <strong>{partSuggestions[part]!.q1}–{partSuggestions[part]!.q3} €</strong>
                      <small>{partSuggestions[part]!.count} {t.sellSalesCount}</small>
                      <small>{t.sellPriceRange} {partSuggestions[part]!.min}–{partSuggestions[part]!.max} €</small>
                    </div>
                  )}
                  <label className="part-img-upload" title={t.sellAddImageTitle}>
                    <ImagePlus size={14} />
                    {partImages[part]?.length ? (
                      <span className="part-img-count">{partImages[part].length}</span>
                    ) : null}
                    <input
                      type="file"
                      accept={imageFileAccept}
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        handlePartImageUpload(part, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {partImages[part]?.map((img, idx) => (
                    <span key={idx} className="part-img-thumb">
                      <button
                        type="button"
                        className="part-img-preview-btn"
                        onClick={() => setPreviewImage(img)}
                        aria-label={`Avaa kuva ${idx + 1}`}
                      >
                        <img src={img} alt={`kuva ${idx + 1}`} />
                      </button>
                      <button
                        type="button"
                        className="part-img-remove"
                        onClick={() => removePartImage(part, idx)}
                        aria-label={`Poista kuva ${idx + 1}`}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {isPartExpanded && (
                <div className="part-card-details">
                  <label className="field-stack">
                    <span className="field-label">{t.title}</span>
                    <input
                      placeholder={`esim. ${(part.split(" / ")[1] || part)} - ${[form.brand, resolvedModel, form.year].filter(Boolean).join(" ")}`}
                      value={partTitles[part] || ""}
                      onChange={(e) => setPartTitles((prev) => ({ ...prev, [part]: e.target.value }))}
                    />
                  </label>
                  <label className="field-stack">
                    <span className="field-label">{t.sellCondition}</span>
                    <select
                      value={partConditions[part] || form.condition}
                      onChange={(e) => setPartConditions((prev) => ({ ...prev, [part]: e.target.value }))}
                    >
                      {conditions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field-stack">
                    <span className="field-label">{t.sellPartNotes}</span>
                    <textarea
                      rows={2}
                      placeholder={t.sellPartNotesPh}
                      value={partDescriptions[part] || ""}
                      onChange={(e) => setPartDescriptions((prev) => ({ ...prev, [part]: e.target.value }))}
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function applyPreset(preset: Preset) {
    const parts = preset.parts;
    const presetMarkedAdded = selectedPresetIds.includes(preset.id);
    const removePartData = (removedParts: string[]) => {
      const removedLower = new Set(removedParts.map((part) => part.toLowerCase()));
      const cleanRecord = <T,>(record: Record<string, T>) =>
        Object.fromEntries(
          Object.entries(record).filter(([key]) => !removedLower.has(key.toLowerCase()))
        ) as Record<string, T>;

      setPartPrices((current) => cleanRecord(current));
      setPartImages((current) => cleanRecord(current));
      setPartTitles((current) => cleanRecord(current));
      setPartDescriptions((current) => cleanRecord(current));
      setPartNumbers((current) => cleanRecord(current));
      setPartConditions((current) => cleanRecord(current));
      setExpandedParts((current) => cleanRecord(current));
      setExpandedPartGroups((current) => {
        const next = { ...current };
        removedParts.forEach((part) => {
          delete next[partGroupKey(part)];
        });
        return next;
      });
    };

    setSelectedParts((prev) => {
      const allAdded =
        presetMarkedAdded ||
        parts.every((p) =>
          prev.some((existing) => existing.toLowerCase() === p.toLowerCase())
        );
      if (allAdded) {
        const lower = parts.map((p) => p.toLowerCase());
        const removedParts = prev.filter((existing) =>
          lower.includes(existing.toLowerCase())
        );
        removePartData(removedParts);
        setSelectedPresetIds((current) => current.filter((id) => id !== preset.id));
        return prev.filter((existing) => !lower.includes(existing.toLowerCase()));
      }
      const additions = parts.filter(
        (p) => !prev.some((existing) => existing.toLowerCase() === p.toLowerCase())
      );
      if (additions.length === 0) {
        return prev;
      }
      additions.forEach((p) => setExpandedParts((e) => ({ ...e, [p]: false })));
      if (preset.id !== "whole") {
        setExpandedPartGroups((groups) => {
          const next = { ...groups };
          additions.forEach((part) => {
            next[partGroupKey(part)] = true;
          });
          return next;
        });
      }
      setSelectedPresetIds((current) =>
        current.includes(preset.id) ? current : [...current, preset.id]
      );
      return [...prev, ...additions];
    });
  }

  /* =========================
     AUTH
  ========================= */

  useEffect(() => {

    if (!supabase) return;

    supabase.auth
      .getSession()
      .then(({ data }) => {

        setUser(
          data.session?.user ?? null
        );

      });

    const { data: listener } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {

          setUser(
            session?.user ?? null
          );

        }
      );

    return () => {

      listener.subscription.unsubscribe();

    };

  }, []);

  /* =========================
     PROFILE
  ========================= */

  useEffect(() => {

    if (!user) return;

    getProfile(user.id).then(({ data }) => {

      if (
        data &&
        isProfileCompleted(data)
      ) {

        setProfile(data);
        if (data.account_type === "company") {
          getCompanySellers(data.id)
            .then(({ data: sellers }) => {
              const nextSellers = sellers ?? [];
              setCompanySellers(nextSellers);
              setSelectedCompanySellerIds((current) => {
                const validIds = current.filter((id) =>
                  nextSellers.some((s) => s.id === id)
                );
                if (validIds.length > 0) return validIds;
                return nextSellers[0] ? [nextSellers[0].id] : [];
              });
            })
            .catch(() => setCompanySellers([]));
        } else {
          setCompanySellers([]);
          setSelectedCompanySellerIds([]);
        }

        setForm((prev) => ({
          ...prev,
          location: buildLocation(data.city || "", data.country || "Suomi"),
          locationCity: data.city || "",
          locationCountry: data.country || "Suomi"
        }));

      }

    });

  }, [user]);

  useEffect(() => {
    if (!user) {
      setListingSlotUsed(0);
      setListingSlotLimit(BASE_LISTING_SLOT_LIMIT);
      return;
    }

    async function refreshSlots() {
      const dbExtras = await getProfileExtraSlots(user!.id);
      setListingSlotLimit(getListingSlotLimit(user!.id, undefined, dbExtras));
      getListingSlotUsage(user!.id)
        .then(({ data }) => setListingSlotUsed(data))
        .catch(() => setListingSlotUsed(0));
    }

    refreshSlots();
    window.addEventListener(LISTING_SLOT_STORAGE_EVENT, refreshSlots);
    window.addEventListener("storage", refreshSlots);

    return () => {
      window.removeEventListener(LISTING_SLOT_STORAGE_EVENT, refreshSlots);
      window.removeEventListener("storage", refreshSlots);
    };
  }, [user]);

  const locked =
    !user || !profile;

  const phoneVerified =
    Boolean(
      profile?.phone &&
      profile.phone_verified_at
    );

  const selectedCompanySellers =
    companySellers.filter((seller) => selectedCompanySellerIds.includes(seller.id));

  const listingSellerName =
    (selectedCompanySellers.length > 0
      ? selectedCompanySellers.map((s) => s.name).join(", ")
      : "") ||
    profile?.company_name ||
    profile?.full_name ||
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();

  const listingSellerPhone =
    (selectedCompanySellers.length > 0
      ? selectedCompanySellers.map((s) => s.phone).join(", ")
      : "") ||
    profile?.phone ||
    null;

  const minimumListingPrice = 1;

  const normalizePriceInput = (value: string) => {
    if (value.trim() === "") return "";
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric < minimumListingPrice) return String(minimumListingPrice);
    return value;
  };

  const normalizePriceForSubmit = (value: string | number | null | undefined) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= minimumListingPrice
      ? numeric
      : minimumListingPrice;
  };

  const hasPositivePrice = (value: string | null | undefined) =>
    Number(value) >= minimumListingPrice;

  const defaultPriceReady =
    hasPositivePrice(form.price);

  const publishableParts =
    listingMode === "multiple"
      ? selectedParts.filter((part) => hasPositivePrice(partPrices[part]) || defaultPriceReady)
      : [];

  const publishPriceReady =
    listingMode === "multiple"
      ? publishableParts.length > 0
      : defaultPriceReady;

  const publishLocked =
    locked ||
    !phoneVerified ||
    !publishPriceReady;

  /* =========================
     IMAGE UPLOAD
  ========================= */

  const imageFileAccept =
    "image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif";

  const videoBlockedStatus =
    "Videoita ei voi julkaista myynti-ilmoitukseen. Valitse kuvatiedosto.";

  function isAllowedImageFile(file: File) {
    const allowedTypes =
      new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/heic",
        "image/heif"
      ]);
    const allowedExtensions =
      /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i;

    if (file.type.startsWith("video/")) {
      return false;
    }

    if (file.type) {
      return allowedTypes.has(file.type);
    }

    return allowedExtensions.test(file.name);
  }

  function hasVideoMediaSource(values: string[]) {
    return values.some((value) =>
      value.startsWith("data:video/") ||
      value.startsWith("blob:video/") ||
      /\.(mp4|mov|m4v|webm|avi|mkv)(?:$|[?#])/i.test(value)
    );
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(reader.error ?? new Error("Kuvan lukeminen epäonnistui."));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") resolve(result);
        else reject(new Error("Kuvan lukeminen epäonnistui."));
      };

      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Kuvan käsittely epäonnistui."));
      img.src = src;
    });
  }

  async function prepareListingImage(file: File): Promise<string> {
    const originalDataUrl = await readFileAsDataUrl(file);

    if (file.type === "image/gif" || file.type === "image/avif" || file.type === "image/heic" || file.type === "image/heif") {
      return originalDataUrl;
    }

    try {
      const image = await loadImageElement(originalDataUrl);
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) return originalDataUrl;

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);

      const optimized = canvas.toDataURL("image/jpeg", 0.78);

      return optimized.length < originalDataUrl.length ? optimized : originalDataUrl;
    } catch {
      return originalDataUrl;
    }
  }

  function handleImageUpload(
    files: FileList | File[] | File | undefined | null
  ) {
    if (!files) return;
    const list: File[] = files instanceof File
      ? [files]
      : Array.from(files);
    let blocked = false;
    for (const file of list) {
      if (!isAllowedImageFile(file)) {
        blocked = true;
        continue;
      }
      void prepareListingImage(file)
        .then((result) => {
          setImages((prev) => [...prev, result]);
        })
        .catch(() => setStatus("Kuvan lisääminen epäonnistui."));
    }
    if (blocked) setStatus(videoBlockedStatus);
  }

  function handlePartImageUpload(
    part: string,
    files: FileList | File[] | File | undefined | null
  ) {
    if (!files) return;
    const list: File[] = files instanceof File
      ? [files]
      : Array.from(files);
    let blocked = false;
    for (const file of list) {
      if (!isAllowedImageFile(file)) {
        blocked = true;
        continue;
      }
      void prepareListingImage(file)
        .then((result) => {
          setPartImages((prev) => ({
            ...prev,
            [part]: [...(prev[part] || []), result]
          }));
        })
        .catch(() => setStatus("Kuvan lisääminen epäonnistui."));
    }
    if (blocked) setStatus(videoBlockedStatus);

  }

  function removePartImage(
    part: string,
    index: number
  ) {
    setPartImages((prev) => ({
      ...prev,
      [part]: (prev[part] || []).filter((_, i) => i !== index)
    }));
  }

  function removeImage(
    index: number
  ) {

    setImages((prev) =>
      prev.filter(
        (_, i) => i !== index
      )
    );

  }

  /* =========================
     SUBMIT
  ========================= */

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {

    e.preventDefault();

    if (
      !user ||
      !profile
    ) {

      setStatus(t.sellLoginRequired);

      return;

    }

    const listingLocation =
      buildLocation(form.locationCity, form.locationCountry) || form.location;

    const phoneOk =
      phoneVerified;

    if (!phoneOk) {

      setStatus(
        profile.account_type === "company"
          ? t.sellVerifyCompanyPhone
          : t.sellVerifyPhone
      );

      return;

    }

    if (listingMode === "single" && !form.title.trim()) {

      // Yritetään johtaa otsikko automaattisesti muista täytetyistä kentistä
      // (alakategoria / kategoria + merkki + malli), jotta käyttäjän ei tarvitse
      // syöttää erillistä otsikkoa, jos osa-/ajoneuvotiedot riittävät.
      const autoTitleParts = [
        form.subcategory || form.category,
        form.brand,
        resolvedModel,
        form.year
      ].filter((part) => typeof part === "string" && part.trim().length > 0);

      if (autoTitleParts.length === 0) {
        setStatus(t.sellEnterTitle);
        return;
      }

      // Asetetaan automaattinen otsikko lomakkeeseen, jotta lähetys jatkuu
      form.title = autoTitleParts.join(" ");

    }

    if (listingMode === "single" && !hasPositivePrice(form.price)) {

      setStatus(t.sellEnterPrice);

      return;

    }

    if (listingMode === "multiple" && selectedParts.length === 0) {

      setStatus(t.sellSelectOnePart);

      return;

    }

    if (
      listingMode === "multiple" &&
      publishableParts.length === 0
    ) {
      setStatus(t.sellSetPriceRequired);
      return;
    }

    const plannedListingCount =
      listingMode === "multiple"
        ? publishableParts.length
        : 1;

    if (FEATURE_FLAGS.listingSlots) {
      const dbExtras = await getProfileExtraSlots(user.id);
      const slotLimit = getListingSlotLimit(user.id, undefined, dbExtras);
      const { data: activeListings } = await getListingSlotUsage(user.id);

      if (activeListings + plannedListingCount > slotLimit) {
        setListingSlotUsed(activeListings);
        setListingSlotLimit(slotLimit);
        setStatus(
          `Ilmoituspaikat täynnä: käytössä ${activeListings}/${slotLimit}. Tämä julkaisu tarvitsee ${plannedListingCount} paikkaa. Osta lisää Kaupasta.`
        );
        return;
      }
    }

    // ── Moderation check ──────────────────────────────────────────────────────
    try {
      const modRes = await fetch("/api/moderate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price: normalizePriceForSubmit(form.price),
          location: listingLocation,
        }),
      });
      if (modRes.ok) {
        const mod = await modRes.json();
        if (!mod.allowed) {
          setStatus(t.sellRejectedMsg + "\n" + mod.reasons.join("\n"));
          return;
        }
      }
    } catch {
      // Moderation API failure → allow through (don't block on network error)
    }
    // ──────────────────────────────────────────────────────────────────────────

    const imageUrl =
      images[0] ||
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3";

    const vehicleDetails = [
      form.vehicleType,
      form.brand,
      resolvedModel,
      form.year
    ].filter(Boolean);

    const baseDescription = form.description.trim();

    if (
      hasVideoMediaSource(images) ||
      Object.values(partImages).some((partImageList) => hasVideoMediaSource(partImageList))
    ) {
      setStatus(videoBlockedStatus);
      return;
    }

    if (listingMode === "multiple") {
      const partsToPublish = publishableParts;
      const skippedCount = selectedParts.length - partsToPublish.length;

      if (partsToPublish.length === 0) {
        setStatus(t.sellSetPriceRequired);
        return;
      }

      // Auto-remove parts without a price from the UI so they don't reappear
      if (skippedCount > 0) {
        setSelectedParts(partsToPublish);
        const cleanupKeys = (obj: Record<string, unknown>) => {
          const next: Record<string, unknown> = {};
          for (const k of partsToPublish) {
            if (k in obj) next[k] = obj[k];
          }
          return next;
        };
        setPartPrices((prev) => cleanupKeys(prev) as typeof prev);
        setPartImages((prev) => cleanupKeys(prev) as typeof prev);
        setPartTitles((prev) => cleanupKeys(prev) as typeof prev);
        setPartDescriptions((prev) => cleanupKeys(prev) as typeof prev);
      setPartNumbers((prev) => cleanupKeys(prev) as typeof prev);
      setPartConditions((prev) => cleanupKeys(prev) as typeof prev);
      setExpandedParts((prev) => cleanupKeys(prev) as typeof prev);
      }

      let successCount = 0;
      let failCount = 0;
      let lastErrMsg = "";

      const buildPayload = (part: string) => {
        const partSegs = part.split(" / ");
        const partCategory = partSegs[0];
        const partSubcategory = partSegs.slice(1).join(" / ");
        const partLeafName = partSegs[partSegs.length - 1];
        const autoTitle = [
          partLeafName || part,
          vehicleDetails.length > 0 ? vehicleDetails.join(" ") : ""
        ].filter(Boolean).join(" - ");
        const partTitle = partTitles[part]?.trim() || autoTitle;
        const partPrice = normalizePriceForSubmit(partPrices[part] || form.price);
        const partNumber = partNumbers[part]?.trim() || null;
        const thisImages = partImages[part]?.length ? partImages[part] : images;
        const thisImageUrl = thisImages[0] || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3";
        const partDesc = partDescriptions[part]?.trim() || "";
        const partCondition = partConditions[part] || form.condition;

        return {
          seller_id: user.id,
          title: partTitle,
          original_language: locale,
          price: partPrice,
          vehicle_type: form.vehicleType,
          category: partCategory || form.category,
          subcategory: partSubcategory || form.subcategory,
          part_number: partNumber,
          location: listingLocation,
          condition: partCondition,
          description: partDesc,
          image_url: thisImageUrl,
          image_urls: thisImages,
          seller_name: listingSellerName,
          company_name: profile?.account_type === "company" ? (profile.company_name || null) : null,
          seller_avatar_url: profile?.avatar_url || null,
          seller_email: profile.email || user.email || "",
          seller_phone: listingSellerPhone,
          brand: form.brand,
          model: resolvedModel || null,
          year: form.year || null,
          engine_cc: (form.engineCc === "muu" ? form.engineCcOther : form.engineCc) || null,
          engine_model: (form.engineModel === "muu" ? form.engineModelOther : form.engineModel) || null
        } as Parameters<typeof createListing>[0];
      };

      for (let partIndex = 0; partIndex < partsToPublish.length; partIndex++) {
        const part = partsToPublish[partIndex];
        setStatus(`${t.sellPublishing} ${partIndex + 1}/${partsToPublish.length}`);

        const res = await createListingWithTimeout(buildPayload(part));

        if (res.error && isSupabaseConfigured) {
          failCount++;
          const e = (res.error || {}) as Record<string, unknown>;
          lastErrMsg =
            (typeof e.message === "string" && e.message) ||
            (typeof e.details === "string" && e.details) ||
            (typeof e.code === "string" && e.code) ||
            (typeof e.hint === "string" && e.hint) ||
            String(res.error);
          console.error(`createListing error (part ${partIndex + 1}):`, e);
          break;
        } else {
          successCount++;
        }
      }

      if (failCount > 0 && lastErrMsg) {
        setStatus(`Virhe: ${lastErrMsg}`);
      }

      if (failCount > 0) return;

      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setForm(emptyListing);
      setListingMode("single");
      setSelectedParts([]);
      setPartPrices({});
      setPartImages({});
      setPartTitles({});
      setPartDescriptions({});
      setPartNumbers({});
      setPartConditions({});
      setExpandedParts({});
      setExpandedPartGroups({});
      setImages([]);
      const skipMsg = skippedCount > 0 ? ` (${skippedCount} tyhjää ohitettu)` : "";
      setListingSlotUsed((prev) => prev + successCount);
      if (failCount === 0) {
        router.push("/");
      } else {
        setStatus(`${successCount} julkaistu, ${failCount} epäonnistui.${skipMsg}`);
      }
      return;
    }

    setStatus(t.sellPublishing);

    const listingTitle = vehicleDetails.length > 0
      ? `${form.title} - ${vehicleDetails.join(" ")}`
      : form.title;

    const { error } =
      await createListingWithTimeout({
        seller_id: user.id,
        title: listingTitle,
        original_language: locale,
        price: normalizePriceForSubmit(form.price),
        vehicle_type: form.vehicleType,
        category: form.category,
        subcategory: form.subcategory,
        part_number: form.partNumber.trim() || null,
        location: listingLocation,
        condition: form.condition,
        description: baseDescription,
        image_url: imageUrl,
        image_urls: images,
        seller_name: listingSellerName,
        company_name: profile?.account_type === "company" ? (profile.company_name || null) : null,
        seller_avatar_url: profile?.avatar_url || null,
        seller_email: profile.email || user.email || "",
        seller_phone: listingSellerPhone,
        brand: form.brand,
        model: resolvedModel || null,
        year: form.year || null,
        engine_cc: (form.engineCc === "muu" ? form.engineCcOther : form.engineCc) || null,
        engine_model: (form.engineModel === "muu" ? form.engineModelOther : form.engineModel) || null
      } as Parameters<typeof createListing>[0]);

    if (error && isSupabaseConfigured) {
      setStatus(getErrorMessage(error));
      return;
    }

    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setListingSlotUsed((prev) => prev + 1);
    router.push("/");

  }

  /* =========================
     UI
  ========================= */

  const listingSlotsLabel = t.sellSlotsUsed.replace(/:\s*$/, "");

  // ===== Wizard step definitions =====
  type WizardStepId =
    | "mode"
    | "vehicle"
    | "category"
    | "location"
    | "seller"
    | "images"
    | "description"
    | "publish";

  const wizardStepDefs = useMemo(() => {
    const arr: { id: WizardStepId; label: string }[] = [
      { id: "mode", label: t.sellListingType },
      { id: "vehicle", label: t.vehicleDetails },
      { id: "category", label: listingMode === "multiple" ? t.sellSelectPartsTitle : t.categoryAndPart },
      { id: "location", label: t.conditionAndLocation }
    ];
    if (profile?.account_type === "company") {
      arr.push({ id: "seller", label: t.sellListingSeller });
    }
    if (listingMode === "single") {
      arr.push({ id: "images", label: t.images });
      arr.push({ id: "description", label: t.description });
    }
    arr.push({ id: "publish", label: t.publish });
    return arr;
  }, [listingMode, profile?.account_type, t]);

  const [currentStep, setCurrentStep] = useState<WizardStepId>("mode");
  const brandPickerRef = useRef<HTMLDivElement | null>(null);
  const modelPickerRef = useRef<HTMLDivElement | null>(null);
  const engineCcPickerRef = useRef<HTMLDivElement | null>(null);
  const engineModelPickerRef = useRef<HTMLDivElement | null>(null);
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [engineCcPickerOpen, setEngineCcPickerOpen] = useState(false);
  const [engineModelPickerOpen, setEngineModelPickerOpen] = useState(false);

  // Auto-correct currentStep if the active step disappears (e.g. mode change).
  useEffect(() => {
    if (!wizardStepDefs.some((s) => s.id === currentStep)) {
      setCurrentStep(wizardStepDefs[0]?.id ?? "mode");
    }
  }, [wizardStepDefs, currentStep]);

  useEffect(() => {
    function closeSmoothPickers(event: MouseEvent) {
      if (!brandPickerRef.current?.contains(event.target as Node)) {
        setBrandPickerOpen(false);
      }
      if (!modelPickerRef.current?.contains(event.target as Node)) {
        setModelPickerOpen(false);
      }
      if (!engineCcPickerRef.current?.contains(event.target as Node)) {
        setEngineCcPickerOpen(false);
      }
      if (!engineModelPickerRef.current?.contains(event.target as Node)) {
        setEngineModelPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", closeSmoothPickers);
    return () => document.removeEventListener("mousedown", closeSmoothPickers);
  }, []);

  const currentStepIndex = Math.max(
    0,
    wizardStepDefs.findIndex((s) => s.id === currentStep)
  );

  // Map legacy element IDs -> step ids so existing handlers keep working.
  const STEP_ID_MAP: Record<string, WizardStepId> = {
    "sell-step-mode": "mode",
    "sell-step-vehicle": "vehicle",
    "sell-field-brand": "vehicle",
    "sell-field-model": "vehicle",
    "sell-field-year": "vehicle",
    "sell-step-category": "category",
    "sell-field-subcategory": "category",
    "sell-field-subleaf": "category",
    "sell-step-location": "location",
    "sell-step-seller": "seller",
    "sell-step-images": "images",
    "sell-step-description": "description",
    "sell-step-publish": "publish"
  };

  function goToWizardStep(targetId: string) {
    const stepId = STEP_ID_MAP[targetId];
    const isStepRoot = targetId.startsWith("sell-step-");
    if (stepId && stepId !== currentStep) {
      setCurrentStep(stepId);
      // Scroll to top of main panel after switching step.
      requestAnimationFrame(() => {
        document.querySelector(".sell-main-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      // Then focus the original sub-target if it exists in the new step.
      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({
          behavior: "smooth",
          block: isStepRoot ? "start" : "nearest"
        });
      }, 250);
      return;
    }
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: isStepRoot ? "start" : "nearest"
    });
  }

  function scrollToSubleafMenu() {
    window.setTimeout(() => {
      const target = document.getElementById("sell-field-subleaf");
      if (!target) return;
      const top =
        target.getBoundingClientRect().top +
        window.scrollY -
        (window.innerWidth <= 720 ? 88 : 96);
      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth"
      });
    }, 180);
  }

  function scrollToSubcategoryMenu() {
    window.setTimeout(() => {
      const target = document.getElementById("sell-field-subcategory");
      if (!target) return;
      const top =
        target.getBoundingClientRect().top +
        window.scrollY -
        (window.innerWidth <= 720 ? 84 : 96);
      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth"
      });
    }, 180);
  }

  function scrollToCategoryPicker() {
    window.setTimeout(() => {
      const target = document.querySelector(".category-picker-block");
      if (!(target instanceof HTMLElement)) return;
      const top =
        target.getBoundingClientRect().top +
        window.scrollY -
        (window.innerWidth <= 720 ? 84 : 96);
      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth"
      });
    }, 80);
  }

  function closeSubleafMenu() {
    setSelectedSubGroup("");
    window.setTimeout(() => {
      const target = document.getElementById("sell-field-subcategory");
      if (!target) return;
      const top =
        target.getBoundingClientRect().top +
        window.scrollY -
        (window.innerWidth <= 720 ? 132 : 96);
      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth"
      });
    }, 80);
  }

  function gotoStepById(id: WizardStepId) {
    setCurrentStep(id);
    requestAnimationFrame(() => {
      document.querySelector(".sell-main-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goNextStep() {
    const next = wizardStepDefs[currentStepIndex + 1];
    if (next) gotoStepById(next.id);
  }
  function goPrevStep() {
    const prev = wizardStepDefs[currentStepIndex - 1];
    if (prev) gotoStepById(prev.id);
  }

  function WizardNav({
    onPrev,
    onNext,
    nextLabel
  }: {
    onPrev: (() => void) | null;
    onNext: (() => void) | null;
    nextLabel: string;
  }) {
    return (
      <div className="sell-wizard-nav">
        {onPrev ? (
          <button type="button" className="sell-wizard-nav-prev" onClick={onPrev}>
            <ArrowLeft size={16} /> Edellinen
          </button>
        ) : <span />}
        {onNext ? (
          <button
            type="button"
            className="sell-wizard-nav-next"
            onClick={onNext}
          >
            {nextLabel} <ChevronRight size={16} />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <main className={`sell-container sell-current-${currentStep}`}>
      <aside className="sell-sidebar" aria-label="Ilmoituksen vaiheet">
        <nav className={`sell-wizard-stepper sell-wizard-stepper-clickable is-step-${currentStepIndex + 1}`} aria-label="Ilmoituksen vaiheet">
          {wizardStepDefs.map((step, idx) => {
            const stateClass =
              idx === currentStepIndex
                ? " is-active"
                : idx < currentStepIndex
                ? " is-done"
                : "";
            return (
              <button
                key={step.id}
                type="button"
                className={`sell-wizard-step${stateClass}`}
                onClick={() => gotoStepById(step.id)}
                aria-current={idx === currentStepIndex ? "step" : undefined}
              >
                <span>{idx + 1}</span>
                <strong>{step.label}</strong>
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="sell-main-panel">

      <div className="section-heading">
        <div className="section-heading-text">
          <h1>{t.createListing}</h1>
          <p>{t.sellCreateSubtitle}</p>
        </div>
        {FEATURE_FLAGS.listingSlots ? (
          <div className="section-heading-slots">
            <span className="slot-count">{listingSlotUsed} / {listingSlotLimit}</span>
            <span className="slot-label">{listingSlotsLabel}</span>
            <div className="slot-bar">
              <div className="slot-bar-fill" style={{ width: `${Math.min(100, (listingSlotUsed / listingSlotLimit) * 100)}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {locked ? (
        <div className="profile-alert">
          <LockKeyhole size={18} />
          {t.loginAndCompleteProfile}
        </div>
      ) : null}

      {!locked && profile?.account_type !== "company" && !phoneVerified ? (
        <div className="profile-alert sell-phone-alert">
          <LockKeyhole size={18} />
          <span>
            {t.sellVerifyPhone}
          </span>
          <Link href="/profile">
            {t.sellGoToProfile}
          </Link>
        </div>
      ) : null}

      {!locked && profile?.account_type === "company" && !phoneVerified ? (
        <div className="profile-alert sell-phone-alert">
          <LockKeyhole size={18} />
          <span>
            {t.sellVerifyCompanyPhone}
          </span>
          <Link href="/profile#yritys">
            {t.sellGoToCompanyInfo}
          </Link>
        </div>
      ) : null}


      <form id="sell-listing-form" onSubmit={handleSubmit} className="sell-form">

        {/* ── Step: Mode ── */}
        {currentStep === "mode" && (
        <div className="sell-section" id="sell-step-mode">
          <div className="sell-section-header">
            <span className="sell-step">1</span>
            <h2>{t.sellListingType}</h2>
          </div>
          <div className="sell-listing-type-toggle" role="group" aria-label={t.sellListingType}>
            <button
              type="button"
              className={listingMode === "single" ? "active" : ""}
              aria-pressed={listingMode === "single"}
              onClick={() => {
                setListingMode("single");
                setTimeout(() => goToWizardStep("sell-step-vehicle"), 80);
              }}
            >
              <span className="sell-listing-type-check">
                <Check size={14} />
              </span>
              <span>
                <strong>Yksittäinen ilmoitus</strong>
                <small>Yksi osa, oma hinta ja kuvat</small>
              </span>
            </button>
            <button
              type="button"
              className={listingMode === "multiple" ? "active" : ""}
              aria-pressed={listingMode === "multiple"}
              onClick={() => {
                setListingMode("multiple");
                setTimeout(() => goToWizardStep("sell-step-vehicle"), 80);
              }}
            >
              <span className="sell-listing-type-check">
                <Check size={14} />
              </span>
              <span>
                <strong>Multi-ilmoitus</strong>
                <small>Lisää monta osaa samalla kertaa</small>
              </span>
            </button>
          </div>
          <WizardNav
            onPrev={null}
            onNext={listingMode ? goNextStep : null}
            nextLabel="Seuraava"
          />
        </div>
        )}

        {/* ── Step: Vehicle ── */}
        {currentStep === "vehicle" && (<>
        <div className="sell-section" id="sell-step-vehicle">
          <div className="sell-section-header">
            <span className="sell-step">1</span>
            <h2>{t.vehicleDetails}</h2>
          </div>

          <div className="field-stack">
            <span className="field-label">{t.selectVehicleClass}</span>
            <div className="vehicle-card-list">
              {vehicleOptions.map((vehicle) => {
                const vd = vehicleCardData[vehicle];
                return (
                  <button
                    key={vehicle}
                    type="button"
                    disabled={locked}
                    className={form.vehicleType === vehicle ? "vehicle-card active" : "vehicle-card"}
                    onClick={() => {
                      setForm({
                        ...form,
                        vehicleType: vehicle,
                        brand: "",
                        brandOther: "",
                        model: "",
                        modelOther: "",
                        engineCc: "",
                        engineCcOther: "",
                        engineModel: "",
                        engineModelOther: "",
                        category: "",
                        subcategory: ""
                      });
                      setSelectedSubGroup("");
                      setBrandPickerOpen(false);
                      setTimeout(() => {
                        goToWizardStep("sell-step-vehicle");
                        setBrandPickerOpen(true);
                        if (window.matchMedia("(max-width: 720px)").matches) {
                          document.getElementById("sell-field-brand")?.scrollIntoView({
                            behavior: "smooth",
                            block: "center"
                          });
                        }
                      }, 120);
                    }}
                  >
                    <div className="vehicle-card-img">
                      {vd?.img && <img src={vd.img} alt={vehicle} />}
                    </div>
                    <div className="vehicle-card-body">
                      <strong>{vehicle}</strong>
                      {vd?.desc && <span>{vd.desc}</span>}
                    </div>
                    <ChevronRight size={20} className="vehicle-card-arrow" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sell-grid-3">
            <div className="field-stack" id="sell-field-brand">
              <span className="field-label">{t.brand}</span>
              <div ref={brandPickerRef} className={`smooth-select ${brandPickerOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="smooth-select-trigger"
                  disabled={locked}
                  aria-haspopup="listbox"
                  aria-expanded={brandPickerOpen}
                  onClick={() => setBrandPickerOpen((open) => !open)}
                >
                  <span>{form.brand ? (form.brand === "muu" ? t.sellOtherOption : form.brand) : t.selectBrand}</span>
                  <ChevronDown size={18} />
                </button>
                {brandPickerOpen && (
                  <div className="smooth-select-menu" role="listbox">
                    <button
                      type="button"
                      className={!form.brand ? "active" : ""}
                      onClick={() => chooseBrand("")}
                    >
                      {t.selectBrand}
                    </button>
                    {brandOptions.map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={form.brand === b ? "active" : ""}
                        onClick={() => chooseBrand(b)}
                      >
                        {b}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={form.brand === "muu" ? "active" : ""}
                      onClick={() => chooseBrand("muu")}
                    >
                      {t.sellOtherOption}
                    </button>
                  </div>
                )}
              </div>
              {form.brand === "muu" && (
                <input
                  placeholder={t.sellTypeBrand}
                  value={form.brandOther}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, brandOther: e.target.value })}
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
            <div className="field-stack" id="sell-field-model">
              <span className="field-label">{t.model}</span>
              <div ref={modelPickerRef} className={`smooth-select ${modelPickerOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="smooth-select-trigger"
                  disabled={locked || !form.brand}
                  aria-haspopup="listbox"
                  aria-expanded={modelPickerOpen}
                  onClick={() => setModelPickerOpen((open) => !open)}
                >
                  <span>
                    {form.model
                      ? form.model === "muu"
                        ? t.sellOtherOption
                        : form.model
                      : form.brand
                      ? "Valitse malli"
                      : "Valitse merkki ensin"}
                  </span>
                  <ChevronDown size={18} />
                </button>
                {modelPickerOpen && (
                  <div className="smooth-select-menu" role="listbox">
                    <button
                      type="button"
                      className={!form.model ? "active" : ""}
                      onClick={() => chooseModel("")}
                    >
                      {form.brand ? "Valitse malli" : "Valitse merkki ensin"}
                    </button>
                    {modelOptions.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={form.model === m ? "active" : ""}
                        onClick={() => chooseModel(m)}
                      >
                        {m}
                      </button>
                    ))}
                    {form.model && form.model !== "muu" && !modelOptions.includes(form.model) && (
                      <button
                        type="button"
                        className="active"
                        onClick={() => chooseModel(form.model)}
                      >
                        {form.model}
                      </button>
                    )}
                    <button
                      type="button"
                      className={form.model === "muu" ? "active" : ""}
                      onClick={() => chooseModel("muu")}
                    >
                      {t.sellOtherOption}
                    </button>
                  </div>
                )}
              </div>
              {form.model === "muu" && (
                <input
                  placeholder="Kirjoita malli"
                  value={form.modelOther || ""}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, modelOther: e.target.value })}
                  style={{ marginTop: 6 }}
                />
              )}
              {form.model && !locked && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, model: "", modelOther: "", engineCc: "", engineCcOther: "", engineModel: "", engineModelOther: "" })}
                  className="sell-inline-clear-btn"
                  title={t.sellClearField}
                >
                  Tyhjennä
                </button>
              )}
            </div>
            <label className="field-stack" id="sell-field-year">
              <span className="field-label">{t.year}</span>
              <input
                type="number"
                placeholder={t.yearPlaceholder}
                value={form.year}
                disabled={locked}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                onBlur={(e) => {
                  if (e.target.value.trim().length >= 2) {
                    setTimeout(() => goToWizardStep("sell-step-category"), 80);
                  }
                }}
              />
            </label>
          </div>

          <div className="sell-grid-2">
            <div className="field-stack">
              <span className="field-label">{t.sellEngineSize}</span>
              <div ref={engineCcPickerRef} className={`smooth-select ${engineCcPickerOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="smooth-select-trigger"
                  disabled={locked}
                  aria-haspopup="listbox"
                  aria-expanded={engineCcPickerOpen}
                  onClick={() => setEngineCcPickerOpen((open) => !open)}
                >
                  <span>
                    {form.engineCc
                      ? form.engineCc === "muu"
                        ? t.sellOtherOption
                        : `${form.engineCc} cc`
                      : t.sellSelectCc}
                  </span>
                  <ChevronDown size={18} />
                </button>
                {engineCcPickerOpen && (
                  <div className="smooth-select-menu" role="listbox">
                    <button
                      type="button"
                      className={!form.engineCc ? "active" : ""}
                      onClick={() => chooseEngineCc("")}
                    >
                      {t.sellSelectCc}
                    </button>
                    {(engineCcOptions[form.vehicleType] ?? []).map((cc) => (
                      <button
                        key={cc}
                        type="button"
                        className={form.engineCc === cc ? "active" : ""}
                        onClick={() => chooseEngineCc(cc)}
                      >
                        {cc} cc
                      </button>
                    ))}
                    <button
                      type="button"
                      className={form.engineCc === "muu" ? "active" : ""}
                      onClick={() => chooseEngineCc("muu")}
                    >
                      {t.sellOtherOption}
                    </button>
                  </div>
                )}
              </div>
              {form.engineCc === "muu" && (
                <input
                  type="number"
                  placeholder={t.sellTypeCc}
                  value={form.engineCcOther}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, engineCcOther: e.target.value })}
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
            <div className="field-stack">
              <span className="field-label">{t.sellEngineType}</span>
              <div ref={engineModelPickerRef} className={`smooth-select ${engineModelPickerOpen ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="smooth-select-trigger"
                  disabled={locked || !form.brand}
                  aria-haspopup="listbox"
                  aria-expanded={engineModelPickerOpen}
                  onClick={() => setEngineModelPickerOpen((open) => !open)}
                >
                  <span>
                    {form.engineModel
                      ? form.engineModel === "muu"
                        ? t.sellOtherOption
                        : form.engineModel
                      : form.brand
                      ? t.sellSelectEngine
                      : t.sellSelectBrandFirst}
                  </span>
                  <ChevronDown size={18} />
                </button>
                {engineModelPickerOpen && (
                  <div className="smooth-select-menu" role="listbox">
                    <button
                      type="button"
                      className={!form.engineModel ? "active" : ""}
                      onClick={() => chooseEngineModel("")}
                    >
                      {form.brand ? t.sellSelectEngine : t.sellSelectBrandFirst}
                    </button>
                    {(brandEngineModels[form.vehicleType]?.[form.brand === "muu" ? "" : form.brand] ?? []).map((m: string) => (
                      <button
                        key={m}
                        type="button"
                        className={form.engineModel === m ? "active" : ""}
                        onClick={() => chooseEngineModel(m)}
                      >
                        {m}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={form.engineModel === "muu" ? "active" : ""}
                      onClick={() => chooseEngineModel("muu")}
                    >
                      {t.sellOtherOption}
                    </button>
                  </div>
                )}
              </div>
              {form.engineModel === "muu" && (
                <input
                  placeholder={t.sellTypeEngine}
                  value={form.engineModelOther}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, engineModelOther: e.target.value })}
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
          </div>

          {listingMode === "single" ? (
            <div className="sell-grid-2">
              <label className="field-stack">
                <span className="field-label">{t.title} <span className="field-required">*</span></span>
                <input placeholder="esim. Mäntäsarja" value={form.title} disabled={locked} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="field-stack">
                <span className="field-label">{t.price} (€) <span className="field-required">*</span></span>
                <input type="number" min="1" placeholder="1" value={form.price} disabled={locked} onChange={(e) => setForm({ ...form, price: normalizePriceInput(e.target.value) })} />
                {priceSuggestion && (
                  <div className="price-suggestion">
                    <span className="price-suggestion-icon">💡</span>
                    <div className="price-suggestion-body">
                      <span className="price-suggestion-label">{priceSuggestion.label}</span>
                      <span className="price-suggestion-range">
                        {priceSuggestion.q1}–{priceSuggestion.q3} €
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "rgba(255,195,120,0.82)", marginLeft: 8 }}>
                          {t.sellTypicalPrice}
                        </span>
                      </span>
                      <span className="price-suggestion-meta">
                        {t.sellAverage} {priceSuggestion.avg} € · {t.sellPriceRange} {priceSuggestion.min}–{priceSuggestion.max} € · {priceSuggestion.count} {t.sellSalesCount}
                      </span>
                    </div>
                  </div>
                )}
              </label>
              <label className="field-stack">
                <span className="field-label">Varaosanumero / OEM-numero</span>
                <input
                  placeholder="esim. 8CR-11631-00, 420222425"
                  value={form.partNumber}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, partNumber: e.target.value })}
                />
              </label>
            </div>
          ) : (
            <label className="field-stack">
              <span className="field-label">{t.sellDefaultPriceLabel}</span>
              <input type="number" min="1" placeholder="esim. 50" value={form.price} disabled={locked} onChange={(e) => setForm({ ...form, price: normalizePriceInput(e.target.value) })} />
            </label>
          )}
        </div>

        {/* End of Vehicle step */}
        <WizardNav onPrev={goPrevStep} onNext={goNextStep} nextLabel="Seuraava" />
        </>)}

        {/* ── Step: Category / Parts ── */}
        {currentStep === "category" && (<>
        <div className="sell-section" id="sell-step-category">
          <div className="sell-section-header">
            <span className="sell-step">2</span>
            <h2>{listingMode === "multiple" ? t.sellSelectPartsTitle : t.categoryAndPart}</h2>
          </div>

          {listingMode === "multiple" && (
            <div className="part-presets">
              <span className="field-label">{t.sellQuickPick}</span>
              <div className="preset-grid">
                {partPresets.map((preset) => {
                  const selectedPartKeys = new Set(
                    selectedParts.map((part) => part.toLowerCase())
                  );
                  const allAdded =
                    preset.parts.length > 0 &&
                    preset.parts.every((p) => selectedPartKeys.has(p.toLowerCase()));
                  const presetAdded = allAdded || selectedPresetIds.includes(preset.id);
                  const newCount = preset.parts.filter((p) =>
                    !selectedPartKeys.has(p.toLowerCase())
                  ).length;
                  const partial = !presetAdded && newCount < preset.parts.length;
                  const cardClass = ["preset-card", presetAdded ? "added" : "", partial ? "partial" : ""].filter(Boolean).join(" ");
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={locked}
                      className={cardClass}
                      aria-pressed={presetAdded}
                      onClick={() => applyPreset(preset)}
                      title={presetAdded ? t.sellPresetRemove : t.sellPresetAdd}
                    >
                      <span className="preset-emoji">
                        <img src={getPresetVisual(preset)} alt="" />
                      </span>
                      <div className="preset-text">
                        <strong>{preset.label}</strong>
                        <span>{preset.desc}</span>
                        <small>{preset.parts.length} osaa paketissa</small>
                      </div>
                      <span className="preset-count">
                        {presetAdded ? t.sellPresetRemoveLabel : t.sellPresetAddLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {listingMode === "multiple" && (
            <div className="multi-custom-add">
              <div className="multi-custom-copy">
                <strong>Lisää itse</strong>
                <span>Kirjoita oma tuote, jos sitä ei löydy valmiista kategorioista.</span>
              </div>
              <div className="multi-custom-controls">
                <input
                  value={customPartName}
                  disabled={locked}
                  onChange={(event) => setCustomPartName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomPart();
                    }
                  }}
                  placeholder="esim. Öljysäiliö, johtosarja, kytkin..."
                />
                <button
                  type="button"
                  disabled={locked || !customPartName.trim()}
                  onClick={addCustomPart}
                >
                  <Plus size={16} />
                  Lisää
                </button>
              </div>
            </div>
          )}

          <div className={`field-stack category-picker-block ${listingMode === "single" ? "is-always-open" : ""}`}>
            <div
              className={`category-picker-toggle ${(categoryPickerOpen || listingMode === "single") ? "is-open" : ""}`}
              role={listingMode === "single" ? undefined : "button"}
              tabIndex={listingMode === "single" ? undefined : 0}
              onClick={listingMode === "single" ? undefined : () => setCategoryPickerOpen((open) => !open)}
              onKeyDown={listingMode === "single" ? undefined : (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setCategoryPickerOpen((open) => !open);
                }
              }}
              aria-expanded={listingMode === "single" ? undefined : categoryPickerOpen}
            >
              <span className="category-picker-toggle-main">
                <strong>Yksittäinen kategoria</strong>
                <small>{form.category ? displayCategory(form.category) : "Valitse tuotteen pääkategoria"}</small>
              </span>
              {listingMode !== "single" && (
                <span className="category-picker-toggle-action" aria-hidden="true">
                  {categoryPickerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              )}
            </div>
            {form.category && (
            <span className="field-label sell-category-selected-row" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {form.category && (
                <button type="button" className="chip-clear-btn" onClick={() => { setForm({ ...form, category: "", subcategory: "" }); setSelectedSubGroup(""); }}>
                  {displayCategory(form.category)} ✕
                </button>
              )}
            </span>
            )}
            {(categoryPickerOpen || listingMode === "single") && (
            <div className="sell-category-card-list">
              {currentCategoryNames.map((item) => {
                const isActive = form.category === item;
                const image = getCategoryCardVisual(item);

                return (
                  <button
                    key={item}
                    type="button"
                    disabled={locked}
                    className={isActive ? "sell-category-card active" : "sell-category-card"}
                    onClick={() => {
                      if (form.category === item) {
                        setForm({ ...form, category: "", subcategory: "" });
                        setSelectedSubGroup("");
                        setCategoryPickerOpen(false);
                      } else {
                        setForm({ ...form, category: item, subcategory: "" });
                        setCategoryPickerOpen(false);
                        const rawGroups = subcategoryGroups[item];
                        if (rawGroups) {
                          const entries = Object.entries(rawGroups);
                          if (entries.length === 1 && entries[0][0] === item && (entries[0][1] as string[]).length > 0) {
                            setSelectedSubGroup(item);
                            scrollToSubleafMenu();
                            return;
                          }
                        }
                        setSelectedSubGroup("");
                        scrollToSubcategoryMenu();
                      }
                    }}
                  >
                    <span className="sell-category-card-image">
                      <img src={image} alt="" />
                    </span>
                    <span className="sell-category-card-body">
                      <strong>{displayCategory(item)}</strong>
                    </span>
                    <ChevronRight size={18} className="sell-category-card-arrow" />
                  </button>
                );
              })}
            </div>
            )}
          </div>

          {/* ── Sub-group navigation (3-level) ── */}
          {form.category && currentSubcategoryGroups ? (
            <>
              {!skipsSinglePassthroughGroup && (
                <div className="field-stack" id="sell-field-subcategory">
                  <span className="field-label sell-subcategory-head">
                    <button type="button" className="chip-back-btn sell-mobile-category-back" onClick={scrollToCategoryPicker}>← Takaisin</button>
                    <span>{listingMode === "multiple" ? t.sellSelectProducts : t.detailedPart}</span>
                  </span>
                  <div className="sell-subcategory-card-list">
                    {currentSubcategoryEntries.map(([group, children]) => {
                      const hasChildren = children.length > 0;
                      const isGroupLeafSelected = !hasChildren && (
                        listingMode === "multiple"
                          ? selectedParts.some((part) => part.toLowerCase() === partKey(form.category, group).toLowerCase())
                          : form.subcategory === group
                      );
                      const cardState =
                        selectedSubGroup === group
                          ? "active"
                          : isGroupLeafSelected
                          ? "active"
                          : "";
                      const cardClass = [
                        "sell-subcategory-card",
                        hasChildren ? "is-branch" : "is-leaf",
                        cardState
                      ].filter(Boolean).join(" ");

                      return (
                            <button
                              key={group}
                              type="button"
                              disabled={locked}
                              className={cardClass}
                              onClick={() => {
                                if (hasChildren) {
                                  const next = selectedSubGroup === group ? "" : group;
                                  setSelectedSubGroup(next);
                                  if (next) scrollToSubleafMenu();
                                } else {
                                  setSelectedSubGroup("");
                                  if (listingMode === "multiple") {
                                    togglePart(partKey(form.category, group));
                                  } else {
                                    setForm({
                                      ...form,
                                      subcategory: form.subcategory === group ? "" : group
                                    });
                                  }
                                }
                              }}
                            >
                              <span className="sell-subcategory-text">
                                <strong>{translateCategory(locale, group)}</strong>
                              </span>
                              {hasChildren && <ChevronRight size={18} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
              )}
                  {selectedSubGroup && (currentSubcategoryGroups[selectedSubGroup]?.length ?? 0) > 0 && (
                    <div className="field-stack subgroup-items" id="sell-field-subleaf">
                      <span className="field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button type="button" className="chip-back-btn" onClick={closeSubleafMenu}>← Takaisin</button>
                        <span>{translateCategory(locale, selectedSubGroup)}</span>
                      </span>
                      <div className="sell-subcategory-card-list compact">
                        {currentSubcategoryGroups[selectedSubGroup].map((sub) => {
                          const leafLabel = sub.includes(" / ") ? sub.split(" / ").slice(1).join(" / ") : sub;
                          const isSelected =
                            listingMode === "multiple"
                              ? selectedParts.some((part) => part.toLowerCase() === partKey(form.category, sub).toLowerCase())
                              : form.subcategory === sub;
                          return (
                            <button
                              key={sub}
                              type="button"
                              disabled={locked}
                              className={isSelected ? "sell-subcategory-card is-leaf active" : "sell-subcategory-card is-leaf"}
                              onClick={() => {
                                if (listingMode === "multiple") {
                                  togglePart(partKey(form.category, sub));
                                } else {
                                  setForm({
                                    ...form,
                                    subcategory: form.subcategory === sub ? "" : sub
                                  });
                                }
                              }}
                            >
                              <span className="sell-subcategory-text">
                                <strong>{translateCategory(locale, leafLabel)}</strong>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : subcategories.length > 0 ? (
                <div className="field-stack" id="sell-field-subcategory">
                  <span className="field-label">{listingMode === "multiple" ? t.sellSelectProducts : t.detailedPart}</span>
                  <div className="sell-subcategory-card-list compact">
                    {subcategories.map((sub) => {
                      const isSelected =
                        listingMode === "multiple"
                          ? selectedParts.some((part) => part.toLowerCase() === partKey(form.category, sub).toLowerCase())
                          : form.subcategory === sub;

                      return (
                        <button
                          key={sub}
                          type="button"
                          disabled={locked}
                          className={isSelected ? "sell-subcategory-card is-leaf active" : "sell-subcategory-card is-leaf"}
                          onClick={() => {
                            if (listingMode === "multiple") {
                              togglePart(partKey(form.category, sub));
                              return;
                            }
                            setForm({
                              ...form,
                              subcategory: form.subcategory === sub ? "" : sub
                            });
                          }}
                        >
                          <span className="sell-subcategory-text">
                            <strong>{translateCategory(locale, sub)}</strong>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {listingMode === "multiple" && selectedParts.length > 0 ? (
                <div className="part-group-list">
                      {selectedPartGroups.map((group) => {
                        const groupOpen = expandedPartGroups[group.key] ?? false;

                        return (
                          <section key={group.key} className={`part-group ${groupOpen ? "open" : ""}`}>
                            <div className="part-group-toggle">
                              <button
                                type="button"
                                className="part-group-main"
                                onClick={() => setExpandedPartGroups((prev) => ({ ...prev, [group.key]: !(prev[group.key] ?? false) }))}
                              >
                                <span className="part-group-text">
                                  <strong>{group.label}</strong>
                                  <small>{group.desc}</small>
                                </span>
                                <span className="part-group-count">{group.parts.length} tuotetta</span>
                                <span className="part-group-action">{groupOpen ? "Sulje" : "Avaa"}</span>
                              </button>
                              <button
                                type="button"
                                className="part-group-remove"
                                onClick={() => removePartGroup(group.parts)}
                                aria-label={`Poista ${group.label}`}
                                title={`Poista ${group.label}`}
                              >
                                <X size={14} />
                              </button>
                            </div>

                            {groupOpen && (() => {
                              const hasSubgroups =
                                group.subgroups.length > 1 ||
                                group.subgroups.some((subgroup) => subgroup.key !== group.key);

                              if (!hasSubgroups) {
                                return renderPartCards(group.parts);
                              }

                              return (
                                <div className="part-subgroup-list">
                                  {group.subgroups.map((subgroup) => {
                                    const subgroupOpen = expandedPartGroups[subgroup.key] ?? false;

                                    return (
                                      <section key={subgroup.key} className={`part-subgroup ${subgroupOpen ? "open" : ""}`}>
                                        <div className="part-subgroup-toggle">
                                          <button
                                            type="button"
                                            className="part-subgroup-main"
                                            onClick={() => setExpandedPartGroups((prev) => ({ ...prev, [subgroup.key]: !(prev[subgroup.key] ?? false) }))}
                                          >
                                            <span className="part-group-text">
                                              <strong>{subgroup.label}</strong>
                                              <small>{subgroup.desc}</small>
                                            </span>
                                            <span className="part-group-count">{subgroup.parts.length} tuotetta</span>
                                            <span className="part-group-action">{subgroupOpen ? "Sulje" : "Avaa"}</span>
                                          </button>
                                          <button
                                            type="button"
                                            className="part-group-remove"
                                            onClick={() => removePartGroup(subgroup.parts)}
                                            aria-label={`Poista ${subgroup.label}`}
                                            title={`Poista ${subgroup.label}`}
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>

                                        {subgroupOpen && renderPartCards(subgroup.parts)}
                                      </section>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </section>
                        );
                      })}
                </div>
              ) : null}
        </div>

        {/* End of Category step */}
        <WizardNav onPrev={goPrevStep} onNext={goNextStep} nextLabel="Seuraava" />
        </>)}

        {/* ── Step: Location ── */}
        {currentStep === "location" && (<>
        <div className="sell-section" id="sell-step-location">
          <div className="sell-section-header">
            <span className="sell-step">3</span>
            <h2>{listingMode === "multiple" ? t.sellLocationCondition : t.conditionAndLocation}</h2>
          </div>
          {listingMode === "multiple" && (
            <p className="sell-section-hint">{t.sellDefaultConditionHint}</p>
          )}
          <div className="sell-grid-2">
            <label className="field-stack">
              <span className="field-label">{t.authCountry}</span>
              <input
                placeholder="esim. Suomi"
                value={form.locationCountry}
                disabled={locked}
                onChange={(e) => {
                  const locationCountry = e.target.value;
                  setForm({
                    ...form,
                    locationCountry,
                    location: buildLocation(form.locationCity, locationCountry)
                  });
                }}
              />
            </label>
            <label className="field-stack">
              <span className="field-label">{t.authCity}</span>
              <input
                placeholder="esim. Oulu"
                value={form.locationCity}
                disabled={locked}
                onChange={(e) => {
                  const locationCity = e.target.value;
                  setForm({
                    ...form,
                    locationCity,
                    location: buildLocation(locationCity, form.locationCountry)
                  });
                }}
              />
            </label>
            <label className="field-stack">
              <span className="field-label">{t.sellCondition}</span>
              <select value={form.condition} disabled={locked} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* End of Location step */}
        <WizardNav
          onPrev={goPrevStep}
          onNext={currentStepIndex < wizardStepDefs.length - 1 ? goNextStep : null}
          nextLabel="Seuraava"
        />
        </>)}

        {currentStep === "seller" && profile?.account_type === "company" && (
          <div className="sell-section company-seller-selector" id="sell-step-seller">
            <div className="sell-section-header">
              <span className="sell-step">4</span>
              <h2>{t.sellListingSeller}</h2>
            </div>
            {companySellers.length > 0 ? (
              <>
                <div className="field-stack">
                  <span className="field-label">{t.sellSelectSellers}</span>
                  <div className="company-seller-checkbox-list">
                    {companySellers.map((seller) => {
                      const checked = selectedCompanySellerIds.includes(seller.id);
                      return (
                        <label
                          key={seller.id}
                          className={`company-seller-checkbox${checked ? " is-checked" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={(event) => {
                              setSelectedCompanySellerIds((prev) =>
                                event.target.checked
                                  ? [...prev, seller.id]
                                  : prev.filter((id) => id !== seller.id)
                              );
                            }}
                          />
                          <span className="company-seller-checkbox-text">
                            <strong>{seller.name}</strong>
                            <span>{seller.phone}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {selectedCompanySellerIds.length === 0 && (
                    <span className="company-seller-hint">{t.sellSelectAtLeastOne}</span>
                  )}
                </div>
                {selectedCompanySellers.length > 0 && (
                  <div className="selected-company-seller-card">
                    <span className="selected-company-seller-icon">
                      <UserRound size={18} />
                    </span>
                    <div>
                      <strong>{listingSellerName}</strong>
                      <span><Phone size={13} /> {listingSellerPhone}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="company-seller-missing">
                <p>{t.sellNoSellersAdded}</p>
                <Link href="/profile#myyjat">{t.sellAddSellerInProfile}</Link>
              </div>
            )}
          </div>
        )}

        {currentStep === "seller" && profile?.account_type === "company" && (
          <div style={{ marginTop: -8 }}>
            <WizardNav
              onPrev={goPrevStep}
              onNext={currentStepIndex < wizardStepDefs.length - 1 ? goNextStep : null}
              nextLabel="Seuraava"
            />
          </div>
        )}

        {/* ── Step: Images (single only) ── */}
        {currentStep === "images" && listingMode === "single" && (<>
          <div className="sell-section" id="sell-step-images">
          <div className="sell-section-header">
            <span className="sell-step">4</span>
            <h2>{t.images}</h2>
          </div>
          <label className="upload-box upload-box-pretty">
            <ImagePlus size={32} />
            <strong>{t.uploadImages}</strong>
            <span>PNG, JPG, WEBP — voit valita useita kerralla</span>
            <input
              type="file"
              accept={imageFileAccept}
              multiple
              disabled={locked}
              onChange={(e) => {
                handleImageUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          {images.length > 0 && (
            <div className="image-grid">
              {images.map((img, index) => (
                <div key={index} className="img-box">
                  <button
                    type="button"
                    className="image-open-btn"
                    onClick={() => setPreviewImage(img)}
                    aria-label={`Avaa kuva ${index + 1}`}
                  >
                    <img src={img} alt={`Kuva ${index + 1}`} />
                  </button>
                  <button
                    type="button"
                    className="image-remove-btn"
                    onClick={() => removeImage(index)}
                    aria-label={`Poista kuva ${index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* End of Images step */}
        <WizardNav onPrev={goPrevStep} onNext={goNextStep} nextLabel="Seuraava" />
        </>)}

        {/* ── Step: Description (single only) ── */}
        {currentStep === "description" && listingMode === "single" && (
        <div className="sell-section" id="sell-step-description">
          <div className="sell-section-header">
            <span className="sell-step">5</span>
            <h2>{t.description}</h2>
          </div>
          <textarea placeholder={t.description} value={form.description} disabled={locked} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <WizardNav onPrev={goPrevStep} onNext={goNextStep} nextLabel="Seuraava" />
        </div>
        )}

        {/* ── Step: Publish ── */}
        {currentStep === "publish" && (
          <div className="sell-section sell-publish-section" id="sell-step-publish">
            <div className="sell-section-header">
              <span className="sell-step">{currentStepIndex + 1}</span>
              <h2>{t.publish}</h2>
            </div>
            <div className="sell-publish-summary">
              <div>
                <span>Tyyppi</span>
                <strong>{listingMode === "multiple" ? "Multi-ilmoitus" : "Yksittäinen ilmoitus"}</strong>
              </div>
              <div>
                <span>Ajoneuvo</span>
                <strong>{[form.vehicleType, form.brand, resolvedModel, form.year].filter(Boolean).join(" ") || "-"}</strong>
              </div>
              <div>
                <span>Tuotteet</span>
                <strong>{listingMode === "multiple" ? `${publishableParts.length} / ${selectedParts.length} tuotetta` : (form.title || form.subcategory || "-")}</strong>
              </div>
              <div>
                <span>Sijainti</span>
                <strong>{form.location || buildLocation(form.locationCity, form.locationCountry) || "-"}</strong>
              </div>
            </div>
            {!phoneVerified && (
              <p className="sell-publish-warning">Vahvista puhelinnumero ennen julkaisua.</p>
            )}
            <WizardNav onPrev={goPrevStep} onNext={null} nextLabel="Seuraava" />
          </div>
        )}

        {/* ── Total estimate (multiple mode) ── */}
        {currentStep === "publish" && listingMode === "multiple" && selectedParts.length > 0 && (() => {
          const total = publishableParts.reduce((sum, p) => {
            const price = partPrices[p] ? Number(partPrices[p]) : (form.price ? Number(form.price) : 0);
            return sum + price;
          }, 0);
          const ready = publishableParts.length;
          return total > 0 ? (
            <div className="sell-total-estimate">
              <span className="sell-total-estimate-icon" aria-hidden="true">€</span>
              <span className="sell-total-estimate-copy">
                <span>{t.sellTotalEstimate}</span>
                <small>{ready} {t.sellPartsCount}</small>
              </span>
              <strong>{total.toLocaleString("fi-FI")} €</strong>
            </div>
          ) : null;
        })()}

        {/* ── Submit (only on last step) ── */}
        {currentStep === "publish" && (
        <div className="sell-submit-bar" id="sell-publish-fixed">
          {status && <p className={status.includes("julkaistu") ? "sell-status-ok" : "sell-status-err"}>{status}</p>}
          <button type="submit" className="sell-submit-btn" disabled={publishLocked}>
            <Check size={18} />
            {listingMode === "multiple"
              ? `${t.publish} ${publishableParts.length}`
              : t.publish}
          </button>
        </div>
        )}

        {previewImage && (
          <div className="part-image-preview-modal" role="dialog" aria-modal="true" aria-label="Kuvan esikatselu">
            <button
              type="button"
              className="part-image-preview-backdrop"
              onClick={() => setPreviewImage(null)}
              aria-label="Sulje kuvan esikatselu"
            />
            <div className="part-image-preview-panel">
              <img src={previewImage} alt="Tuotekuva isona" />
              <button
                type="button"
                className="part-image-preview-close"
                onClick={() => setPreviewImage(null)}
                aria-label="Sulje"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}
      </form>
      </div>
    </main>
  );
}
