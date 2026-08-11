// Nettimoton julkisesta hausta 11.8.2026. Mopo ja Skootteri ovat
// Nettimotossa eri ajoneuvolajeja, joten niitä ei saa yhdistää samaan
// mallivalikkoon. Avaimet on rajattu Maskinesissa tuettuihin merkkeihin.

export type NettimotoMopedSubtype = "moped" | "scooter";

export const NETTIMOTO_MOPED_MODELS_BY_SUBTYPE: Record<
  NettimotoMopedSubtype,
  Record<string, string[]>
> = {
  moped: {
    Yamaha: ["DT", "dt 50cc", "PW", "TT-R", "TZR"],
    MBK: ["Mach", "Muu", "X-limit"],
    Derbi: ["DRD", "DRD Evo Limited Edition", "GPR", "Senda", "Sm", "X-Race", "X-Treme"],
    Rieju: ["E-Bike", "MRT", "MRX", "RR", "RRX", "Tango", "Trophy"],
    Aprilia: ["Mini RX", "MX", "RS", "RX", "SX"],
    Peugeot: ["Looxor", "Muu", "XP", "XPS"],
    Piaggio: ["APE", "Ciao", "Liberty", "NRG", "Typhoon"],
    Gilera: ["Muu", "RCR", "Runner", "Runner 50", "SMT"],
    Beta: ["RR", "Super Moto"],
    KTM: ["Camping", "SX-E"],
    Honda: ["C110", "CB 50J", "CRF", "Monkey", "NS", "PX", "QR", "SS", "XR"],
    Suzuki: ["Jr", "PV", "R", "R50", "RM", "S-1", "Street Magic", "TS"],
    Kymco: ["Agility", "K-Pipe", "Super", "ZX"],
    Keeway: ["Cooper", "Enduro", "Manki", "Matrix", "Pantera", "Pony", "TX", "X-RAY"],
    CPI: ["GTR", "SM", "SX"],
    Generic: ["Trigger"],
    Malaguti: ["Grizzly", "XSM"],
    Motorhispania: ["FuriaMax", "MH10 50", "MH10 50 Pro", "RX", "RYZ", "RYZ 50", "YR11 50"],
    Sherco: ["Muu", "SE-RS", "SM", "SM-R", "SM-RS", "Supermotard"],
    Tunturi: ["Break", "City", "Hopper", "Magnum", "Maxi", "Mikro", "Pappa", "Sport", "Super Sport", "Tiger", "Tiger Aqua", "trial"],
    Puch: ["MS"],
    Solifer: ["3-SPEED", "4-SPEED", "Automat", "Capri", "Export", "GT", "Pappa", "SM", "SM MOPO", "STM"],
  },
  scooter: {
    Aprilia: ["Amico", "Atlantic", "Habana", "Mojito", "Rally", "Scarabeo", "Sportcity", "SR"],
    Benelli: ["49X", "LX"],
    BMW: ["C", "C1", "CE 04"],
    Fantic: ["Concord Lei"],
    Honda: ["ADV", "Bali EX", "CUV e", "FES", "FJS600", "Forza", "Lead110", "Lead125", "NC", "NSC", "PCX", "SFX", "SH", "Silver Wing", "SRX", "Vision", "X8R-X", "X8RS", "Zoomer"],
    Keeway: ["Agora", "F-act", "FLASH", "Focus", "Hacker", "Hurricane", "Kite", "Leone", "Matrix", "RX6", "RX8", "RY6", "Swan", "Urban Blade", "X-Blade", "Zahara"],
    Kymco: ["300i", "Agility", "Cobra", "DJ", "Downtown", "Exciting", "Grand Dink", "Ionex I-One", "Like", "Movie", "People", "Super", "Super8", "Xciting", "ZX"],
    Piaggio: ["1", "Beverly", "Fly", "Free", "Hexagon", "Liberty", "MP3", "NRG", "Sfera", "Skipper", "Typhoon", "X8", "X9", "X10", "Xevo", "ZIP"],
    Suzuki: ["AN", "AY", "Estilete", "Katana", "Love", "UK110"],
    SYM: ["Allo 50", "Fiddle II 50", "Jet4 50", "Jet4 50 R", "Jet 14", "Jet BasiX", "Jet EuroX 50", "Jet SportX 50 S", "Jet SportX 50 SR", "Mask", "Orbit 50", "Orbit 125", "Orbit II 50", "RS 50", "Symphony ST 50"],
    Vespa: ["Commercial", "Elettrica", "ET2", "ET4", "Granturismo", "GTS", "GTV", "ie 250", "LX", "P", "Piaggio", "PK", "Primavera", "PX", "Rally", "S", "Sprint"],
    Yamaha: ["Aerox", "Beluga", "BW´S", "Jog", "Majesty", "Neons", "Neos", "NMAX", "RayZR 125", "Slider", "T-Max", "Tricity", "Versity", "X-City", "X-MaX", "YP"],
    MBK: ["Booster", "Nitro", "Ovetto", "Skyliner", "Stunt"],
    Derbi: ["Atlantis", "Boulevard", "GP 1", "Predator"],
    Rieju: ["Blast Urban"],
    Peugeot: ["Django", "Elyseo", "Elystar", "Elysée", "Jet c-Tech", "Jet Force", "Kisbee", "Ludix", "Satelis", "Speedfight", "Speedfight 2", "Speedfight 3", "Speedfight 4", "Squab", "Street Zone", "SV", "TKR", "Trekker", "Tweet", "V-Clic", "Vivacity", "XP"],
    Gilera: ["RUNNER SP 50", "Stalker"],
    CPI: ["Aragon", "Formula", "GTR", "Hussar", "Oliver", "Popcorn"],
    Generic: ["XOR"],
    Malaguti: ["Crosser", "Phantom"],
    Solifer: ["Crosser", "Phantom"],
  },
};

export function getNettimotoMopedSubtypeModels(
  vehicle: string,
  subtype: string,
  _supportedModels: Record<string, string[]>
) {
  const vehicleKey = vehicle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fi");
  const subtypeKey = subtype
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fi");

  const group = subtypeKey.startsWith("skootteri")
    ? NETTIMOTO_MOPED_MODELS_BY_SUBTYPE.scooter
    : vehicleKey === "mopo" || vehicleKey === "mopot"
      ? NETTIMOTO_MOPED_MODELS_BY_SUBTYPE.moped
      : null;

  if (!group) return null;

  return Object.fromEntries(
    Object.entries(group).map(([brand, models]) => [brand, [...models]])
  );
}
