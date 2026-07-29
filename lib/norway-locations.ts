// Norjan virallinen vuoden 2026 lääni-kuntajako. Nimet ovat norjaksi.
// Lähde: Statistisk sentralbyrå (SSB), Standard for kommuneinndeling 2026.
export const NORWAY_MUNICIPALITIES_BY_COUNTY: Record<string, string[]> = {
  "Rogaland": ["Eigersund", "Stavanger", "Haugesund", "Sandnes", "Sokndal", "Lund", "Bjerkreim", "Hå", "Klepp", "Time", "Gjesdal", "Sola", "Randaberg", "Strand", "Hjelmeland", "Suldal", "Sauda", "Kvitsøy", "Bokn", "Tysvær", "Karmøy", "Utsira", "Vindafjord"],
  "Møre og Romsdal": ["Kristiansund", "Molde", "Ålesund", "Vanylven", "Sande", "Herøy (Møre og Romsdal)", "Ulstein", "Hareid", "Ørsta", "Stranda", "Sykkylven", "Sula", "Giske", "Vestnes", "Rauma", "Aukra", "Averøy", "Gjemnes", "Tingvoll", "Sunndal", "Surnadal", "Smøla", "Aure", "Volda", "Fjord", "Hustadvika", "Haram"],
  "Nordland": ["Bodø", "Narvik", "Bindal", "Sømna", "Brønnøy", "Vega", "Vevelstad", "Herøy (Nordland)", "Alstahaug", "Leirfjord", "Vefsn", "Grane", "Aarborte", "Dønna", "Nesna", "Hemnes", "Rana", "Lurøy", "Træna", "Rødøy", "Meløy", "Gildeskål", "Beiarn", "Saltdal", "Fauske", "Sørfold", "Steigen", "Lødingen", "Evenes", "Røst", "Værøy", "Flakstad", "Vestvågøy", "Vågan", "Hadsel", "Bø", "Øksnes", "Sortland", "Andøy", "Moskenes", "Hábmer"],
  "Østfold": ["Halden", "Moss", "Sarpsborg", "Fredrikstad", "Hvaler", "Råde", "Våler (Østfold)", "Skiptvet", "Indre Østfold", "Rakkestad", "Marker", "Aremark"],
  "Akershus": ["Bærum", "Asker", "Lillestrøm", "Nordre Follo", "Ullensaker", "Nesodden", "Frogn", "Vestby", "Ås", "Enebakk", "Lørenskog", "Rælingen", "Aurskog-Høland", "Nes", "Gjerdrum", "Nittedal", "Lunner", "Jevnaker", "Nannestad", "Eidsvoll", "Hurdal"],
  "Buskerud": ["Drammen", "Kongsberg", "Ringerike", "Hole", "Lier", "Øvre Eiker", "Modum", "Krødsherad", "Flå", "Nesbyen", "Gol", "Hemsedal", "Ål", "Hol", "Sigdal", "Flesberg", "Rollag", "Nore og Uvdal"],
  "Innlandet": ["Kongsvinger", "Hamar", "Lillehammer", "Gjøvik", "Ringsaker", "Løten", "Stange", "Nord-Odal", "Sør-Odal", "Eidskog", "Grue", "Åsnes", "Våler (Innlandet)", "Elverum", "Trysil", "Åmot", "Stor-Elvdal", "Rendalen", "Engerdal", "Tolga", "Tynset", "Alvdal", "Folldal", "Os", "Dovre", "Lesja", "Skjåk", "Lom", "Vågå", "Nord-Fron", "Sel", "Sør-Fron", "Ringebu", "Øyer", "Gausdal", "Østre Toten", "Vestre Toten", "Gran", "Søndre Land", "Nordre Land", "Sør-Aurdal", "Etnedal", "Nord-Aurdal", "Vestre Slidre", "Øystre Slidre", "Vang"],
  "Vestfold": ["Horten", "Holmestrand", "Tønsberg", "Sandefjord", "Larvik", "Færder"],
  "Telemark": ["Porsgrunn", "Skien", "Notodden", "Siljan", "Bamble", "Kragerø", "Drangedal", "Nome", "Midt-Telemark", "Seljord", "Hjartdal", "Tinn", "Kviteseid", "Nissedal", "Fyresdal", "Tokke", "Vinje"],
  "Agder": ["Risør", "Grimstad", "Arendal", "Kristiansand", "Lindesnes", "Farsund", "Flekkefjord", "Gjerstad", "Vegårshei", "Tvedestrand", "Froland", "Lillesand", "Birkenes", "Åmli", "Iveland", "Evje og Hornnes", "Bygland", "Valle", "Bykle", "Vennesla", "Åseral", "Lyngdal", "Hægebostad", "Kvinesdal", "Sirdal"],
  "Vestland": ["Bergen", "Kinn", "Etne", "Sveio", "Bømlo", "Stord", "Fitjar", "Tysnes", "Kvinnherad", "Ullensvang", "Eidfjord", "Ulvik", "Voss", "Kvam", "Samnanger", "Bjørnafjorden", "Austevoll", "Øygarden", "Askøy", "Vaksdal", "Modalen", "Osterøy", "Alver", "Austrheim", "Fedje", "Masfjorden", "Gulen", "Solund", "Hyllestad", "Høyanger", "Vik", "Sogndal", "Aurland", "Lærdal", "Årdal", "Luster", "Askvoll", "Fjaler", "Sunnfjord", "Bremanger", "Stad", "Gloppen", "Stryn"],
  "Trøndelag": ["Trondheim", "Steinkjer", "Namsos", "Frøya", "Osen", "Oppdal", "Rennebu", "Røros", "Holtålen", "Midtre Gauldal", "Melhus", "Skaun", "Malvik", "Selbu", "Tydal", "Meråker", "Stjørdal", "Frosta", "Levanger", "Verdal", "Snåase", "Lierne", "Raarvihke", "Namsskogan", "Grong", "Høylandet", "Overhalla", "Flatanger", "Leka", "Inderøy", "Indre Fosen", "Heim", "Hitra", "Ørland", "Åfjord", "Orkland", "Nærøysund", "Rindal"],
  "Troms": ["Tromsø", "Harstad", "Kvæfjord", "Dielddanuorri", "Ibestad", "Gratangen", "Loabák", "Bardu", "Salangen", "Målselv", "Sørreisa", "Dyrøy", "Senja", "Balsfjord", "Karlsøy", "Lyngen", "Storfjord", "Gáivuotna", "Skjervøy", "Nordreisa", "Kvænangen"],
  "Finnmark": ["Alta", "Hammerfest", "Sør-Varanger", "Vadsø", "Kárášjohka", "Guovdageaidnu", "Loppa", "Hasvik", "Måsøy", "Nordkapp", "Porsanger", "Lebesby", "Gamvik", "Deatnu", "Berlevåg", "Båtsfjord", "Vardø", "Unjárga"],
  "Oslo": ["Oslo"],
};

export const NORWAY_COUNTIES = Object.keys(NORWAY_MUNICIPALITIES_BY_COUNTY);

export const NORWAY_MUNICIPALITIES = Array.from(
  new Set(Object.values(NORWAY_MUNICIPALITIES_BY_COUNTY).flat())
).sort((first, second) =>
  first.localeCompare(second, "nb", { sensitivity: "base" })
);
