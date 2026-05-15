"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState
} from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  Check,
  ChevronRight,
  ImagePlus,
  LockKeyhole,
  Package,
  Phone,
  Plus,
  UserRound,
  Wrench,
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

import {
  buildVehicleCategories,
  categories,
  conditions,
  displayCategoryForVehicle,
  isVehiclePartAllowed,
  subcategoryGroups
} from "@/lib/listings";
import { translateCategory, useLanguage } from "@/lib/i18n";

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
  "Runko & katteet": "/category-main/runko-katteet.png"
};

const subCategoryVisuals: Record<string, string> = {
  Moottorit: "/category-sub/moottorit.png",
  Kytkimet: "/category-sub/kytkimet.png",
  Variaattorit: "/category-sub/variaattorit.png",
  Voimansiirto: "/category-sub/voimansiirto.png",
  "Variaattorin hihnat": "/category-sub/voimansiirto.png",
  Ketjukotelot: "/category-sub/voimansiirto.png",
  "Ketjut & hihnat": "/category-sub/voimansiirto.png",
  "Alusta & telasto": "/category-main/alusta-telasto.png",
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
  Sähköjärjestelmät: "/category-main/sahkojarjestelmat.png",
  "Sähkö": "/category-sub/sahko.png",
  Sytytys: "/category-sub/sytytys.png",
  Valot: "/category-sub/sähko.png",
  Anturit: "/category-sub/sähko.png",
  "Jäähdytys & polttoaine": "/category-main/jaahdytys-polttoaine.png",
  Jäähdytys: "/category-sub/jaahdytys.png",
  Jäähdyttimet: "/category-sub/jaahdytys.png",
  Polttoainejärjestelmä: "/category-sub/polttoaine.png",
  Polttoainepumput: "/category-sub/polttoaine.png",
  Kaasuttimet: "/category-sub/polttoaine.png",
  "Pakoputkisto": "/category-main/pakoputkisto.png",
  "Runko & katteet": "/category-main/runko-katteet.png",
  Runko: "/category-sub/runko.png",
  Katteet: "/category-sub/katteet.png",
  "Kokonainen katesarja": "/category-sub/katteet.png",
  "Kuomut & konepellit": "/category-sub/katteet.png",
  Sivukatteet: "/category-sub/katteet.png",
  Etupuskurit: "/category-main/runko-katteet.png",
  Takapuskurit: "/category-main/runko-katteet.png",
  "Istuimet & penkit": "/category-main/runko-katteet.png",
  Tuulilasit: "/category-sub/katteet.png"
};

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

const vehicleTypeCategories: Record<string, Record<string, string[]>> = {
  Moottorikelkka: Object.fromEntries(
    Object.entries(categories).filter(([key]) => key !== "Kaikki")
  ) as unknown as Record<string, string[]>,
  Mönkijä: buildVehicleCategories("Mönkijä") as Record<string, string[]>,
  Motocross: buildVehicleCategories("Motocross") as Record<string, string[]>,
  Mopo: buildVehicleCategories("Mopo") as Record<string, string[]>
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

  const [user, setUser] =
    useState<User | null>(null);

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [form, setForm] =
    useState(emptyListing);

  const [listingMode, setListingMode] =
    useState<"" | "single" | "multiple">("single");

  const [selectedParts, setSelectedParts] =
    useState<string[]>([]);

  const [selectedPresetIds, setSelectedPresetIds] =
    useState<string[]>([]);

  const [selectedSubGroup, setSelectedSubGroup] = useState("");

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

  const [customPart, setCustomPart] =
    useState("");

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
        if (d.listingMode) setListingMode(d.listingMode);
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

  function togglePart(part: string) {
    setSelectedParts((prev) => {
      const existingPart = prev.find((item) => item.toLowerCase() === part.toLowerCase());
      if (existingPart) {
        const partToRemove = existingPart;
        setPartPrices((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setPartImages((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setPartTitles((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setPartDescriptions((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setPartNumbers((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setPartConditions((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setExpandedParts((p) => { const n = { ...p }; delete n[partToRemove]; return n; });
        setSelectedPresetIds((current) =>
          current.filter((id) => {
            const preset = partPresets.find((item) => item.id === id);
            return !preset?.parts.some((presetPart) => presetPart.toLowerCase() === partToRemove.toLowerCase());
          })
        );
        return prev.filter((item) => item.toLowerCase() !== part.toLowerCase());
      }
      setExpandedParts((p) => ({ ...p, [part]: true }));
      setExpandedPartGroups((p) => ({ ...p, [partGroupKey(part)]: true }));
      return [...prev, part];
    });
  }

  function addCustomPart() {
    const value = customPart.trim();

    if (!value) return;

    const key = partKey(form.category, value);

    setSelectedParts((prev) => {
      if (prev.some((item) => item.toLowerCase() === key.toLowerCase())) return prev;
      setExpandedParts((p) => ({ ...p, [key]: true }));
      setExpandedPartGroups((p) => ({ ...p, [partGroupKey(key)]: true }));
      return [...prev, key];
    });
    setCustomPart("");
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
      { id: "variator", emoji: "⚙️", label: "Variaattori-setti", desc: "Kokonainen variaattori, hihnat, ketjukotelo",
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
      { id: "variator", emoji: "⚙️", label: "Variaattori-setti", desc: "Kokonainen variaattori, hihnat, voimansiirto",
        parts: [
          "Moottori & voimansiirto / Variaattorit / Kokonainen variaattori",
          "Moottori & voimansiirto / Variaattorit / Variaattori kitit",
          "Moottori & voimansiirto / Variaattorit / Jouset",
          "Moottori & voimansiirto / Variaattorin hihnat",
          "Moottori & voimansiirto / Kokonainen voimansiirto",
          "Moottori & voimansiirto / Ketjukotelot",
          "Moottori & voimansiirto / Ketjut & hihnat"
        ] },
      { id: "chassis", emoji: "🛞", label: "Alusta & tukivarret", desc: "Kokonainen alusta, tukivarret, olka- ja vetoakselit",
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
      { id: "controls", emoji: "🕹️", label: "Ohjaus & jarrut", desc: "Kokonainen ohjaus, tangot, kaasu, jarrut",
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
      { id: "chassis", emoji: "🛞", label: "Renkaat, vanteet & alusta", desc: "Renkaat, vanteet, alusta ja akselit",
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
      { id: "controls", emoji: "🕹️", label: "Ohjaus & jarrut", desc: "Kokonainen ohjaus, tangot, kaasu, jarrut",
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
      { id: "fuel", emoji: "⛽", label: "Polttoaine & jäähdytys", desc: "Kaasuttimet, jäähdyttimet, pumput",
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
      { id: "variator", emoji: "⚙️", label: "Variaattori-setti", desc: "Kokonainen variaattori, hihnat, voimansiirto",
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
      { id: "chassis", emoji: "🛞", label: "Renkaat, vanteet & alusta", desc: "Renkaat, vanteet, alusta ja akselit",
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
      { id: "controls", emoji: "🕹️", label: "Ohjaus & jarrut", desc: "Kokonainen ohjaus, tangot, kaasu, jarrut",
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
      { id: "fuel", emoji: "⛽", label: "Polttoaine & kaasuttimet", desc: "Kaasuttimet, polttoainejärjestelmä, jäähdytys",
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

  const wholePresetByVehicle: Record<string, Preset> = {
    Moottorikelkka: buildWholePreset("Moottorikelkka", "Koko kelkka", "🛷"),
    Mönkijä: buildWholePreset("Mönkijä", "Koko mönkijä", "🚜"),
    Motocross: buildWholePreset("Motocross", "Koko pyörä", "🏍️"),
    Mopo: buildWholePreset("Mopo", "Koko mopo", "🛵")
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
      ) &&
      isVehiclePartAllowed(vehicleType, category, subcategory)
    );
  }

  const basePartPresets =
    partPresetsByVehicle[form.vehicleType] ?? partPresetsByVehicle.Moottorikelkka;

  const partPresets: Preset[] =
    basePartPresets
      .map((preset) =>
        ({
          ...preset,
          parts: preset.parts.filter((part) =>
            isPresetPartAllowed(form.vehicleType, part)
          )
        })
      )
      .filter((preset) => preset.parts.length > 0);

  const effectiveSelectedParts = useMemo(() => {
    const parts = new Map<string, string>();

    selectedParts.forEach((part) => {
      parts.set(part.toLowerCase(), part);
    });

    return Array.from(parts.values());
  }, [selectedParts]);

  const readyToPublishParts = useMemo(
    () => effectiveSelectedParts.filter((part) => partPrices[part] || form.price),
    [effectiveSelectedParts, form.price, partPrices]
  );

  const effectiveSelectedPartKeySet = useMemo(
    () => new Set(effectiveSelectedParts.map((part) => part.toLowerCase())),
    [effectiveSelectedParts]
  );

  const publishListingCount =
    listingMode === "multiple"
      ? effectiveSelectedParts.length
      : 1;

  const readyPublishListingCount =
    listingMode === "multiple"
      ? readyToPublishParts.length
      : 1;

  function getPresetVisual(preset: Preset) {
    if (preset.id === "whole") return vehicleCardData[form.vehicleType]?.img || "/vehicles/all.png";
    if (preset.id === "engine") return categoryMainVisuals["Moottori & voimansiirto"];
    if (preset.id === "variator" || preset.id === "drive") return subCategoryVisuals.Variaattorit;
    if (preset.id === "track" || preset.id === "chassis") return subCategoryVisuals.Alusta;
    if (preset.id === "controls") return subCategoryVisuals.Jarrut;
    if (preset.id === "suspension") return subCategoryVisuals.Iskunvaimentimet;
    if (preset.id === "electric") return categoryMainVisuals["Sähköjärjestelmät"];
    if (preset.id === "fuel") return categoryMainVisuals["Jäähdytys & polttoaine"];
    if (preset.id === "exhaust") return categoryMainVisuals.Pakoputkisto;
    if (preset.id === "fairings") return subCategoryVisuals.Katteet;
    return "/parts-blue-bg.svg";
  }

  const selectedPartGroups = (() => {
    const groups = new Map<string, { key: string; label: string; desc: string; visual: string; parts: string[] }>();

    effectiveSelectedParts.forEach((part) => {
      const segments = part.split(" / ").filter(Boolean);
      const category = segments[0] || "Muut tuotteet";
      const group = segments[1] || category;
      const key = category;
      const existing = groups.get(key);

      if (existing) {
        existing.parts.push(part);
        return;
      }

      groups.set(key, {
        key,
        label: translateCategory(locale, category),
        desc: group === category
          ? "Avaa tämän ryhmän tuotteet"
          : translateCategory(locale, group),
        visual: categoryMainVisuals[category] || getSubCategoryVisual(group),
        parts: [part]
      });
    });

    return Array.from(groups.values());
  })();

  function applyPreset(preset: Preset) {
    const parts = preset.parts;
    const presetGroupKeys = new Set(parts.map((part) => partGroupKey(part).toLowerCase()));
    const canUseGroupFallback =
      presetGroupKeys.size === 1 &&
      partPresets.every((otherPreset) =>
        otherPreset.id === preset.id ||
        !otherPreset.parts.some((part) => presetGroupKeys.has(partGroupKey(part).toLowerCase()))
      );
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

    const presetLower = new Set(parts.map((part) => part.toLowerCase()));
    const selectedLower = new Set(selectedParts.map((part) => part.toLowerCase()));
    const selectedPresetParts = selectedParts.filter((part) =>
      presetLower.has(part.toLowerCase()) ||
      (canUseGroupFallback && presetGroupKeys.has(partGroupKey(part).toLowerCase()))
    );
    const presetAlreadyAdded =
      selectedPresetIds.includes(preset.id) ||
      parts.some((part) => selectedLower.has(part.toLowerCase())) ||
      selectedPresetParts.length > 0;

    if (presetAlreadyAdded) {
      removePartData([...parts, ...selectedPresetParts]);
      setSelectedPresetIds((current) => current.filter((id) => id !== preset.id));
      setSelectedParts((current) =>
        current.filter((part) =>
          !presetLower.has(part.toLowerCase()) &&
          !(canUseGroupFallback && presetGroupKeys.has(partGroupKey(part).toLowerCase()))
        )
      );
      return;
    }

    setSelectedPresetIds((current) =>
      current.includes(preset.id) ? current : [...current, preset.id]
    );

    setExpandedParts((expanded) => {
      const next = { ...expanded };
      parts.forEach((part) => {
        next[part] = false;
      });
      return next;
    });

    if (preset.id !== "whole") {
      setExpandedPartGroups((groups) => {
        const next = { ...groups };
        parts.forEach((part) => {
          next[partGroupKey(part)] = true;
        });
        return next;
      });
    }

    setSelectedParts((current) => {
      const currentLower = new Set(current.map((part) => part.toLowerCase()));
      const additions = parts.filter((part) => !currentLower.has(part.toLowerCase()));
      return additions.length > 0 ? [...current, ...additions] : current;
    });
  }

  function isPresetActive(preset: Preset) {
    const presetGroupKeys = new Set(preset.parts.map((part) => partGroupKey(part).toLowerCase()));
    const canUseGroupFallback =
      presetGroupKeys.size === 1 &&
      partPresets.every((otherPreset) =>
        otherPreset.id === preset.id ||
        !otherPreset.parts.some((part) => presetGroupKeys.has(partGroupKey(part).toLowerCase()))
      );
    return (
      selectedPresetIds.includes(preset.id) ||
      preset.parts.some((part) => effectiveSelectedPartKeySet.has(part.toLowerCase())) ||
      (canUseGroupFallback &&
        effectiveSelectedParts.some((part) => presetGroupKeys.has(partGroupKey(part).toLowerCase())))
    );
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

  const publishLocked =
    locked ||
    !phoneVerified ||
    (listingMode === "multiple" && publishListingCount === 0);

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

  function handleImageUpload(
    file: File | undefined
  ) {

    if (!file) return;

    if (!isAllowedImageFile(file)) {

      setStatus(
        videoBlockedStatus
      );

      return;

    }

    const reader =
      new FileReader();

    reader.onload = () => {

      const result =
        reader.result;

      if (
        typeof result === "string"
      ) {

        setImages((prev) => [
          ...prev,
          result
        ]);

      }

    };

    reader.readAsDataURL(file);

  }

  function handlePartImageUpload(
    part: string,
    file: File | undefined
  ) {

    if (!file) return;

    if (!isAllowedImageFile(file)) {
      setStatus(videoBlockedStatus);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setPartImages((prev) => ({
          ...prev,
          [part]: [...(prev[part] || []), result]
        }));
      }
    };

    reader.readAsDataURL(file);

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

    if (listingMode === "single" && !form.price) {

      setStatus(t.sellEnterPrice);

      return;

    }

    if (listingMode === "multiple" && effectiveSelectedParts.length === 0) {

      setStatus(t.sellSelectOnePart);

      return;

    }

    const plannedListingCount =
      listingMode === "multiple"
        ? readyPublishListingCount
        : 1;

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

    // ── Moderation check ──────────────────────────────────────────────────────
    try {
      const modRes = await fetch("/api/moderate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price: Number(form.price),
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
      // Only publish parts that have a price set (per-part or default)
      const partsToPublish = effectiveSelectedParts.filter(
        (p) => partPrices[p] || form.price
      );
      const skippedCount = effectiveSelectedParts.length - partsToPublish.length;

      if (partsToPublish.length === 0) {
        setStatus(t.sellSetPriceRequired);
        return;
      }

      // Auto-remove parts without a price from the UI so they don't reappear
      if (skippedCount > 0) {
        setSelectedParts(partsToPublish);
        setSelectedPresetIds([]);
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
        const partPrice = partPrices[part] ? Number(partPrices[part]) : Number(form.price);
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

      const BATCH_SIZE = 25;
      for (let batchStart = 0; batchStart < partsToPublish.length; batchStart += BATCH_SIZE) {
        const batch = partsToPublish.slice(batchStart, batchStart + BATCH_SIZE);
        setStatus(`${t.sellPublishing} ${Math.min(batchStart + batch.length, partsToPublish.length)}/${partsToPublish.length}`);

        const results = await Promise.all(
          batch.map((part) => createListing(buildPayload(part)))
        );

        results.forEach((res, idx) => {
          if (res.error && isSupabaseConfigured) {
            failCount++;
            const e = (res.error || {}) as Record<string, unknown>;
            lastErrMsg =
              (typeof e.message === "string" && e.message) ||
              (typeof e.details === "string" && e.details) ||
              (typeof e.code === "string" && e.code) ||
              (typeof e.hint === "string" && e.hint) ||
              String(res.error);
            console.error(`createListing error (part ${batchStart + idx + 1}):`, e);
          } else {
            successCount++;
          }
        });
      }

      if (failCount > 0 && lastErrMsg) {
        setStatus(`Virhe: ${lastErrMsg}`);
      }

      if (failCount > 0) return;

      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setForm(emptyListing);
      setListingMode("single");
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
      setCustomPart("");
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
      await createListing({
        seller_id: user.id,
        title: listingTitle,
        original_language: locale,
        price: Number(form.price),
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

  const hasCategorySelection =
    listingMode === "multiple"
      ? selectedParts.length > 0 || Boolean(form.category)
      : Boolean(form.category || form.subcategory);
  const hasListingImages =
    images.length > 0 ||
    Object.values(partImages).some((partImageList) => partImageList.length > 0);
  const activeWizardStep = hasListingImages ? 4 : hasCategorySelection ? 3 : 1;
  const typeStepTarget =
    profile?.account_type === "company" ? "sell-step-seller" : "sell-step-mode";
  const imagesStepTarget = listingMode === "single" ? "sell-step-images" : "sell-step-category";
  const listingSlotsLabel = t.sellSlotsUsed.replace(/:\s*$/, "");
  const wizardSteps = [
    { number: 1, label: t.vehicleDetails, target: "sell-step-vehicle" },
    { number: 2, label: t.conditionAndLocation, target: "sell-step-location" },
    { number: 3, label: t.sellListingType, target: typeStepTarget },
    { number: 4, label: t.images, target: imagesStepTarget },
    { number: 5, label: t.description, target: "sell-step-description" }
  ];

  function goToWizardStep(targetId: string) {
    const target =
      document.getElementById(targetId) ??
      document.getElementById("sell-step-mode");
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="sell-container">
      <aside className="sell-sidebar" aria-label="Ilmoituksen vaiheet">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} />
          {t.back}
        </Link>

        <nav className={`sell-wizard-stepper sell-wizard-stepper-clickable is-step-${activeWizardStep}`} aria-label="Ilmoituksen vaiheet">
          {wizardSteps.map((step) => {
            const stateClass =
              step.number === activeWizardStep
                ? " is-active"
                : step.number < activeWizardStep
                ? " is-done"
                : "";
            return (
              <button
                key={step.number}
                type="button"
                className={`sell-wizard-step${stateClass}`}
                onClick={() => goToWizardStep(step.target)}
                aria-current={step.number === activeWizardStep ? "step" : undefined}
              >
                <span>{step.number}</span>
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
        <Link href="/" className="sell-wordmark" aria-label="Arctic Parts">
          <span>Arctic</span><strong>Parts</strong>
        </Link>
        <div className="section-heading-slots">
          <span className="slot-count">{listingSlotUsed} / {listingSlotLimit}</span>
          <span className="slot-label">{listingSlotsLabel}</span>
          <div className="slot-bar">
            <div className="slot-bar-fill" style={{ width: `${Math.min(100, (listingSlotUsed / listingSlotLimit) * 100)}%` }} />
          </div>
        </div>
      </div>

      {locked ? (
        <div className="profile-alert">
          <LockKeyhole size={18} />
          {t.loginAndCompleteProfile}
        </div>
      ) : null}

      {!locked && profile?.account_type !== "company" && !phoneVerified ? (
        <div className="profile-alert">
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
        <div className="profile-alert">
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

        {/* ── Step 0: Mode ── */}
        <div className="sell-section sell-section-mode" id="sell-step-mode">
          <p className="sell-section-question">{t.sellWhatSelling}</p>
          <div className="sell-mode-grid">
            <button
              type="button"
              disabled={locked}
              className={listingMode === "single" ? "sell-mode-card active" : "sell-mode-card"}
              onClick={() => { setListingMode("single"); setSelectedParts([]); setSelectedPresetIds([]); setExpandedPartGroups({}); setTimeout(() => goToWizardStep("sell-step-vehicle"), 80); }}
            >
              <span className="sell-mode-icon">
                <Package size={24} />
              </span>
              <strong>{t.sellSingleProduct}</strong>
              <span>{t.sellSingleDesc}</span>
            </button>
            <button
              type="button"
              disabled={locked}
              className={listingMode === "multiple" ? "sell-mode-card active" : "sell-mode-card"}
              onClick={() => { setListingMode("multiple"); setTimeout(() => goToWizardStep("sell-step-vehicle"), 80); }}
            >
              <span className="sell-mode-icon">
                <Wrench size={24} />
              </span>
              <strong>{t.sellMultipleProducts}</strong>
              <span>{t.sellMultipleDesc}</span>
            </button>
          </div>
        </div>

        {listingMode && (<>

        {/* ── Step 1: Vehicle ── */}
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
            <label className="field-stack">
              <span className="field-label">{t.brand}</span>
              <select value={form.brand} disabled={locked} onChange={(e) => setForm({ ...form, brand: e.target.value, brandOther: "", model: "", modelOther: "", engineCc: "", engineCcOther: "", engineModel: "", engineModelOther: "" })}>
                <option value="">{t.selectBrand}</option>
                {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value="muu">{t.sellOtherOption}</option>
              </select>
              {form.brand === "muu" && (
                <input
                  placeholder={t.sellTypeBrand}
                  value={form.brandOther}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, brandOther: e.target.value })}
                  style={{ marginTop: 6 }}
                />
              )}
            </label>
            <label className="field-stack">
              <span className="field-label">{t.model}</span>
              <select
                value={form.model}
                disabled={locked || !form.brand}
                onChange={(e) => {
                  const m = e.target.value;
                  const eng = brandModelEngineMap[form.vehicleType]?.[form.brand]?.[m];
                  setForm({
                    ...form,
                    model: m,
                    modelOther: "",
                    engineCc: eng ? eng.engineCc : "",
                    engineCcOther: "",
                    engineModel: eng ? eng.engineModel : "",
                    engineModelOther: ""
                  });
                }}
              >
                <option value="">
                  {form.brand ? "Valitse malli" : "Valitse merkki ensin"}
                </option>
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {form.model && form.model !== "muu" && !modelOptions.includes(form.model) && (
                  <option value={form.model}>{form.model}</option>
                )}
                <option value="muu">{t.sellOtherOption}</option>
              </select>
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
                  style={{ alignSelf: "flex-start", background: "rgba(255, 154, 36, 0.12)", border: "1px solid rgba(255, 154, 36, 0.34)", borderRadius: 999, color: "#ffb45f", cursor: "pointer", fontSize: 12, fontWeight: 800, lineHeight: 1, marginTop: 6, padding: "7px 10px" }}
                  title={t.sellClearField}
                >
                  Tyhjennä
                </button>
              )}
              <span className="sell-model-helper">
                Oman mallin voi kirjoittaa vasta, kun valitset listasta “Muu”.
              </span>
            </label>
            <label className="field-stack">
              <span className="field-label">{t.year}</span>
              <input type="number" placeholder={t.yearPlaceholder} value={form.year} disabled={locked} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </label>
          </div>

          <div className="sell-grid-2">
            <label className="field-stack">
              <span className="field-label">{t.sellEngineSize}</span>
              <select value={form.engineCc} disabled={locked} onChange={(e) => setForm({ ...form, engineCc: e.target.value, engineCcOther: "" })}>
                <option value="">{t.sellSelectCc}</option>
                {(engineCcOptions[form.vehicleType] ?? []).map((cc) => (
                  <option key={cc} value={cc}>{cc} cc</option>
                ))}
                <option value="muu">{t.sellOtherOption}</option>
              </select>
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
            </label>
            <label className="field-stack">
              <span className="field-label">{t.sellEngineType}</span>
              <select value={form.engineModel} disabled={locked || !form.brand} onChange={(e) => setForm({ ...form, engineModel: e.target.value, engineModelOther: "" })}>
                <option value="">{form.brand ? t.sellSelectEngine : t.sellSelectBrandFirst}</option>
                {(brandEngineModels[form.vehicleType]?.[form.brand === "muu" ? "" : form.brand] ?? []).map((m: string) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="muu">{t.sellOtherOption}</option>
              </select>
              {form.engineModel === "muu" && (
                <input
                  placeholder={t.sellTypeEngine}
                  value={form.engineModelOther}
                  disabled={locked}
                  onChange={(e) => setForm({ ...form, engineModelOther: e.target.value })}
                  style={{ marginTop: 6 }}
                />
              )}
            </label>
          </div>

          {listingMode === "single" ? (
            <div className="sell-grid-2">
              <label className="field-stack">
                <span className="field-label">{t.title} <span className="field-required">*</span></span>
                <input placeholder="esim. Mäntäsarja" value={form.title} disabled={locked} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="field-stack">
                <span className="field-label">{t.price} (€) <span className="field-required">*</span></span>
                <input type="number" placeholder="0" value={form.price} disabled={locked} onChange={(e) => setForm({ ...form, price: e.target.value })} />
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
              <span className="field-label">{t.sellDefaultPriceLabel} <span className="field-hint">— {t.sellDefaultPriceHint}</span></span>
              <input type="number" placeholder="esim. 50" value={form.price} disabled={locked} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
          )}
        </div>

        {/* ── Step 2: Category / Parts ── */}
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
                  const presetAdded = isPresetActive(preset);
                  const newCount = preset.parts.filter((p) =>
                    !effectiveSelectedPartKeySet.has(p.toLowerCase())
                  ).length;
                  const partial = !presetAdded && newCount < preset.parts.length;
                  const cardClass = ["preset-card", presetAdded ? "added" : "", partial ? "partial" : ""].filter(Boolean).join(" ");
                  const handlePresetClick = () => {
                    if (!locked) applyPreset(preset);
                  };
                  return (
                    <div
                      key={preset.id}
                      role="button"
                      tabIndex={locked ? -1 : 0}
                      aria-disabled={locked}
                      className={cardClass}
                      onClick={handlePresetClick}
                      onKeyDown={(event) => {
                        if (locked) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          applyPreset(preset);
                        }
                      }}
                      title={presetAdded ? t.sellPresetRemove : t.sellPresetAdd}
                    >
                      <span className="preset-emoji">
                        <img src={getPresetVisual(preset)} alt="" />
                      </span>
                      <div className="preset-text">
                        <strong>{preset.label}</strong>
                        <span>{preset.desc}</span>
                      </div>
                      <button
                        type="button"
                        className="preset-count"
                        disabled={locked}
                        onClick={(event) => {
                          event.stopPropagation();
                          applyPreset(preset);
                        }}
                      >
                        {presetAdded ? t.sellPresetRemoveLabel : t.sellPresetAddLabel}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="field-stack">
            <span className="field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{listingMode === "multiple" ? t.sellOrSelectOne : t.mainCategory}</span>
              {form.category && (
                <button type="button" className="chip-clear-btn" onClick={() => { setForm({ ...form, category: "", subcategory: "" }); setSelectedSubGroup(""); }}>
                  {displayCategory(form.category)} ✕
                </button>
              )}
            </span>
            <div className="sell-category-card-list">
              {currentCategoryNames.map((item) => {
                const isActive = form.category === item;
                const image = categoryMainVisuals[item] || "/parts-blue-bg.svg";

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
                      } else {
                        setForm({ ...form, category: item, subcategory: "" });
                        const rawGroups = subcategoryGroups[item];
                        if (rawGroups) {
                          const entries = Object.entries(rawGroups);
                          if (entries.length === 1 && entries[0][0] === item && (entries[0][1] as string[]).length > 0) {
                            setSelectedSubGroup(item);
                            return;
                          }
                        }
                        setSelectedSubGroup("");
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
          </div>

          {/* ── Sub-group navigation (3-level) ── */}
          {form.category && currentSubcategoryGroups ? (
            <>
              <div className="field-stack">
                <span className="field-label">{listingMode === "multiple" ? t.sellSelectProducts : t.detailedPart}</span>
                <div className="sell-subcategory-card-list">
                  {Object.entries(currentSubcategoryGroups).map(([group, children]) => {
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
                                setSelectedSubGroup(selectedSubGroup === group ? "" : group);
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
                            {getSubCategoryVisual(group) && (
                              <span className="sell-subcategory-thumb">
                                <img src={getSubCategoryVisual(group)} alt="" />
                              </span>
                            )}
                            <span className="sell-subcategory-text">
                              <strong>{translateCategory(locale, group)}</strong>
                            </span>
                            <span className="sell-selection-dot" aria-hidden="true" />
                            {hasChildren && <ChevronRight size={18} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {selectedSubGroup && (currentSubcategoryGroups[selectedSubGroup]?.length ?? 0) > 0 && (
                    <div className="field-stack subgroup-items">
                      <span className="field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button type="button" className="chip-back-btn" onClick={() => setSelectedSubGroup("")}>← Takaisin</button>
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
                              <span className="sell-selection-dot" aria-hidden="true" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : subcategories.length > 0 ? (
                <div className="field-stack">
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
                          <span className="sell-selection-dot" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {listingMode === "multiple" ? (
                <div className="multi-products-box">
                  <div className="multi-products-head">
                    <div>
                      <strong>{t.sellListingProducts}</strong>
                      <span>{t.sellAddAllParts}</span>
                    </div>
                    <small>{publishListingCount} {t.sellProductsCount}</small>
                  </div>

                  <div className="multi-product-add">
                    <input
                      value={customPart}
                      disabled={locked}
                      placeholder={t.sellAddCustomPartPh}
                      onChange={(event) => setCustomPart(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCustomPart();
                        }
                      }}
                    />
                    <button type="button" disabled={locked} onClick={addCustomPart}>
                      <Plus size={16} />
                      {t.sellAddBtn}
                    </button>
                  </div>

                  {publishListingCount > 0 ? (
                    <div className="part-group-list">
                      {selectedPartGroups.map((group) => {
                        const groupOpen = expandedPartGroups[group.key] ?? false;

                        return (
                          <section key={group.key} className={`part-group ${groupOpen ? "open" : ""}`}>
                            <button
                              type="button"
                              className="part-group-toggle"
                              onClick={() => setExpandedPartGroups((prev) => ({ ...prev, [group.key]: !(prev[group.key] ?? false) }))}
                            >
                              <span className="part-group-visual">
                                <img src={group.visual} alt="" />
                              </span>
                              <span className="part-group-text">
                                <strong>{group.label}</strong>
                                <small>{group.desc}</small>
                              </span>
                              <span className="part-group-count">{group.parts.length} tuotetta</span>
                              <span
                                role="button"
                                tabIndex={0}
                                className="part-group-action"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setExpandedPartGroups((prev) => ({ ...prev, [group.key]: !groupOpen }));
                                }}
                                onKeyDown={(event) => {
                                  if (event.key !== "Enter" && event.key !== " ") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setExpandedPartGroups((prev) => ({ ...prev, [group.key]: !groupOpen }));
                                }}
                              >
                                {groupOpen ? "Sulje" : "Avaa"}
                              </span>
                            </button>

                            {groupOpen && (
                              <div className="part-cards part-cards-flat part-group-items">
                      {group.parts.map((part) => {
                        const isPartExpanded = expandedParts[part] ?? false;
                        const partPrice = partPrices[part]?.trim();
                        const partNumber = partNumbers[part]?.trim();
                        const partImageCount = partImages[part]?.length ?? 0;

                        return (
                        <div key={part} className={`part-card ${isPartExpanded ? "is-expanded" : "is-collapsed"}`}>
                          <div className="part-card-header">
                            <div className="part-card-label">
                              <span className="part-card-index">{effectiveSelectedParts.indexOf(part) + 1}</span>
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
                              >
                                {expandedParts[part] ? t.sellCollapse : t.sellExpand}
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
                              className="part-price-input"
                              placeholder={`Hinta (€)${form.price ? ` — oletus ${form.price}€` : ""}`}
                              value={partPrices[part] || ""}
                              onChange={(e) => setPartPrices((prev) => ({ ...prev, [part]: e.target.value }))}
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
                                style={{ display: "none" }}
                                onChange={(e) => handlePartImageUpload(part, e.target.files?.[0])}
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
                            )}
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="multi-product-empty">
                      {t.sellNoProducts}
                    </p>
                  )}
                </div>
              ) : null}
        </div>

        {/* ── Step 3: Location & Condition ── */}
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

        {profile?.account_type === "company" && (
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

        {listingMode === "single" && (<>
        {/* ── Step 4: Images ── */}
          <div className="sell-section" id="sell-step-images">
          <div className="sell-section-header">
            <span className="sell-step">4</span>
            <h2>{t.images}</h2>
          </div>
          <label className="upload-box">
            <ImagePlus size={28} />
            <strong>{t.uploadImages}</strong>
            <span>PNG, JPG, WEBP</span>
            <input type="file" accept={imageFileAccept} disabled={locked} onChange={(e) => handleImageUpload(e.target.files?.[0])} />
          </label>
          {images.length > 0 && (
            <div className="image-grid">
              {images.map((img, index) => (
                <div key={index} className="img-box">
                  <img src={img} alt={`Kuva ${index + 1}`} />
                  <button type="button" onClick={() => removeImage(index)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Step 5: Description ── */}
        <div className="sell-section" id="sell-step-description">
          <div className="sell-section-header">
            <span className="sell-step">5</span>
            <h2>{t.description}</h2>
          </div>
          <textarea placeholder={t.description} value={form.description} disabled={locked} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        </>)}

        {/* ── Total estimate (multiple mode) ── */}
        {listingMode === "multiple" && publishListingCount > 0 && (() => {
          const total = effectiveSelectedParts.reduce((sum, p) => {
            const price = partPrices[p] ? Number(partPrices[p]) : (form.price ? Number(form.price) : 0);
            return sum + price;
          }, 0);
          const ready = readyPublishListingCount;
          return total > 0 ? (
            <div className="sell-total-estimate">
              <span>{t.sellTotalEstimate} ({ready} {t.sellPartsCount}):</span>
              <strong>{total.toLocaleString("fi-FI")} €</strong>
            </div>
          ) : null;
        })()}

        {/* ── Submit ── */}
        <div className="sell-submit-bar" id="sell-step-publish">
          {status && <p className={status.includes("julkaistu") ? "sell-status-ok" : "sell-status-err"}>{status}</p>}
          <button type="submit" className="sell-submit-btn" disabled={publishLocked}>
            <Check size={18} />
            {listingMode === "multiple"
              ? `${t.publish} ${publishListingCount}`
              : t.publish}
          </button>
        </div>

        </>)}

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
