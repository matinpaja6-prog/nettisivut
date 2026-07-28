export type VehicleBrandModels = Record<string, string[]>;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fi")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAny(value: string, terms: string[]) {
  const normalized = ` ${normalize(value)} `;
  return terms.some((term) => normalized.includes(` ${normalize(term)} `));
}

function includesFragment(value: string, terms: string[]) {
  const normalized = normalize(value);
  return terms.some((term) => normalized.includes(normalize(term)));
}

function subtypeModelPredicate(vehicle: string, subtype: string) {
  const vehicleKey = normalize(vehicle);
  const subtypeKey = normalize(subtype).split(" moottori")[0].split(" crossi")[0].split(" monkija")[0];

  if (vehicleKey === "moottoripyora") {
    const groups: Record<string, string[]> = {
      naked: ["cb", "duke", "gsx s", "monster", "mt ", "sv", "street triple", "streetfighter", "tuono", "vitpilen", "svartpilen", " z"],
      sport: ["cbr", "daytona", "gsx r", "hayabusa", "ninja", "panigale", " r1", " r3", " r6", " r7", "rc ", "rs ", "rsv", "supersport", "yzf"],
      "sport touring": ["fjr", "gt", "ninja 1000", "nt1100", "smt", "sport 660", "tracer", "vfr", "versys", "xr"],
      touring: ["challenger", "chieftain", "gold wing", "grand touring", "gtl", "pursuit", "road glide", "road king", "roadmaster", "rt", "street glide"],
      adventure: ["adventure", "africa twin", "caponord", "desertx", "gs", "himalayan", "multistrada", "norden", "scram", "tiger", "transalp", "tuareg", "v strom", "x adv", "tenere"],
      enduro: ["ec ", "enduro", "exc", "fe ", "freeride", "pr7", "rr ", "se ", "sef", "te ", "wre", "wr125", "xef", "xl", "xr"],
      supermoto: ["dorsoduro", "motard", "sm ", "smc", "sms", "supermoto", "sx 125", "wr125x", "xmf"],
      cruiser: ["bolt", "breakout", "chief", "eliminator", "fat bob", "fat boy", "forty eight", "iron", "meteor", "nightster", "rebel", "scout", "sport glide", "sportster", "street bob", "vulcan"],
      custom: ["bonneville", "breakout", "chief", "diavel", "fat bob", "fat boy", "forty eight", "low rider", "nine", "rebel", "rocket", "scout", "speed twin", "sportster", "street bob", "thruxton"],
      "classic retro": ["bonneville", "bullet", "classic", "continental", "cromwell", "dax", "felsberg", "gold star", "hunter", "interceptor", "leoncino", "monkey", "nine", "scrambler", "speed twin", "sunray", "super cub", "thruxton", "w800", "xsr"]
    };
    if (subtypeKey.startsWith("skootteri")) {
      return (model: string) => includesFragment(model, ["address", "agility", "ak ", "beverly", "burgman", "cruisym", "downtown", "forza", "gts", "gtv", "jet x", "maxsym", "mp3", "nmax", "pcx", "people", "primavera", "sprint", "tmax", "x adv", "xciting", "xmax"]);
    }
    const terms = groups[subtypeKey.replace(" / ", " ")];
    if (terms) return (model: string) => includesFragment(model, terms);
  }

  if (vehicleKey === "mopo" || vehicleKey === "mopot") {
    const scooterModels = [
      "aerox", "agility", "ark", "aragon", "atlantis", "booster", "bws", "chrono",
      "dink", "dio", "elyseo", "f act", "fly", "ice", "ideo", "jetforce", "jog",
      "katana", "kisbee", "lead", "liberty", "ludix", "matrix", "mojito", "neos",
      "nitro", "nrg", "oliver", "ovetto", "people", "phantom", "popcorn", "primavera",
      "rocket", "runner", "ry6", "scooter", "scarabeo", "sfera", "sfx", "sh", "slider",
      "sonic", "speedfight", "sprint", "sr", "stalker", "stunt", "super 8", "trekker",
      "typhoon", "variant", "vespa", "vitality", "vivacity", "why", "x8r", "xor", "zip",
      "zoomer", "zuma"
    ];
    if (subtypeKey === "skootteri") return (model: string) => includesFragment(model, scooterModels);
    if (subtypeKey === "mopo") return (model: string) => !includesFragment(model, scooterModels);
  }

  if (vehicleKey === "moottorikelkka") {
    const groups: Record<string, string[]> = {
      crossover: ["backcountry", "crossfire", "riot", "renegade", "switchback", "xf", "xterrain", "xtrim"],
      "deep snow": ["boondocker", "freeride", "m series", "m 8000", "pro rmk", "rmk", "shredder", "sks", "summit"],
      sport: ["600r", "f series", "indy", "iqr", "mach z", "mxz", "rave", "rush", "thundercat", "xcr", "zr"],
      touring: ["adventure", "apex", "grand touring", "pantera", "rs vector", "venture"],
      tyo: ["49 ranger", "69 ranger", "bearcat", "commander", "expedition", "norseman", "ranger", "skandic", "titan", "tundra", "viking", "voyageur", "widetrak", "yeti"],
      watercross: ["600r", "iqr", "mxz", "rave", "rush", "xcr", "zr"]
    };
    const terms = groups[subtypeKey];
    if (terms) return (model: string) => includesFragment(model, terms);
  }

  if (vehicleKey === "monkija") {
    const utv = ["ace", "commander", "defender", "fugleman", "general", "maverick", "mule", "pioneer", "prowler", "ranger", "rzr", "sector", "strike", "t boss", "talon", "teryx", "traxter", "uforce", "uxv", "viking", "villain", "wildcat", "wolverine", "zforce"];
    const sport = ["banshee", "blaster", "ds", "dvx", "kfx", "lt r", "lt z", "outlaw", "phoenix", "raptor", "renegade", "scrambler", "talon", "warrior", "yfz"];
    const work = ["alterra", "blade", "cforce", "defender", "foreman", "fourtrax", "grizzly", "kodiak", "kingquad", "landmax", "outlander", "rancher", "ranger", "rincon", "rubicon", "snarler", "sportsman", "target", "traxter"];
    if (subtypeKey === "utv") return (model: string) => includesFragment(model, utv);
    if (subtypeKey === "sport") return (model: string) => includesFragment(model, sport);
    if (subtypeKey === "tyo") return (model: string) => includesFragment(model, work);
    if (subtypeKey === "maasto") return () => true;
    if (subtypeKey === "atv") return (model: string) => !includesFragment(model, utv);
    if (subtypeKey === "6x6") return (model: string) => includesFragment(model, ["6x6", "big boss", "outlander", "ranger", "sportsman"]);
    if (subtypeKey === "lasten") return (model: string) => includesFragment(model, ["ds", "kfx", "lt z", "outlaw", "phoenix", "raptor", "trx"]);
  }

  if (vehicleKey === "motocross") {
    const motocross = ["cr", "crf r", "fc", "kx", "mc", "mx", "rm", "rm z", "sx", "sx f", "tc", "tx", "yz", "yz f"];
    const enduro = ["crf x", "dr", "dr z", "ec", "en", "exc", "exc f", "fe", "freeride", "kdx", "klx", "rr", "se", "sef", "te", "wr", "xc w", "xe", "xef", "xtrainer", "xr"];
    if (subtypeKey === "motocross") return (model: string) => includesAny(model, motocross) || includesFragment(model, ["crf250r", "crf450r", "kx250", "kx450", "rmz"]);
    if (subtypeKey === "enduro") return (model: string) => includesAny(model, enduro) || includesFragment(model, ["crf250rx", "crf450rx", "wr250", "wr450"]);
    if (subtypeKey === "supermoto") return (model: string) => includesFragment(model, ["dr z", "fs", "sm", "smr"]);
    if (subtypeKey === "trial") return (model: string) => includesFragment(model, ["evo", "st", "txt"]);
    if (subtypeKey === "pitbike") return (model: string) => includesFragment(model, ["crf 50", "crf 80", "crf 100", "klx", "ttr", "xr"]);
    if (subtypeKey === "minicross") return (model: string) => includesFragment(model, ["50", "65", "85", "pw"]);
  }

  return null;
}

export function mergeVehicleBrandModels(...sources: Array<VehicleBrandModels | null | undefined>) {
  const merged: VehicleBrandModels = {};
  for (const source of sources) {
    for (const [brand, models] of Object.entries(source ?? {})) {
      merged[brand] = Array.from(new Set([...(merged[brand] ?? []), ...models].filter(Boolean)));
    }
  }
  return merged;
}

export function filterVehicleBrandModelsBySubtype(
  vehicle: string,
  subtype: string,
  source: VehicleBrandModels
): VehicleBrandModels | null {
  if (!vehicle || !subtype) return null;
  const predicate = subtypeModelPredicate(vehicle, subtype);
  if (!predicate) return null;

  return Object.fromEntries(
    Object.entries(source)
      .map(([brand, models]) => [brand, models.filter(predicate)] as const)
      .filter(([, models]) => models.length > 0)
  );
}
