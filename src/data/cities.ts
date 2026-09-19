import type { MajorCity } from "../domain/city";

/**
 * The best-known cities of each voivodeship, for visitors who recognise
 * "Kraków" or "Gdańsk" but not "Małopolskie" or "Pomorskie". Ordered by
 * relevance to a foreign visitor (capital first, then population/fame).
 *
 * Coordinates are approximate city-centre WGS84 positions — precise enough
 * to place a marker on a country-scale map. They are projected at render
 * time with the constants embedded in the map SVG (see
 * scripts/convert-map.mjs and src/domain/parse-map-svg.ts).
 */
export const MAJOR_CITIES: readonly MajorCity[] = [
  // Dolnośląskie
  { name: "Wrocław", regionSlug: "dolnoslaskie", lat: 51.11, lon: 17.03, isCapital: true, aliases: ["Breslau"], mapVisibility: "always" },
  { name: "Legnica", regionSlug: "dolnoslaskie", lat: 51.21, lon: 16.16, isCapital: false, mapVisibility: "never" },
  { name: "Wałbrzych", regionSlug: "dolnoslaskie", lat: 50.77, lon: 16.28, isCapital: false, mapVisibility: "never" },
  { name: "Jelenia Góra", regionSlug: "dolnoslaskie", lat: 50.9, lon: 15.73, isCapital: false, mapVisibility: "never" },

  // Kujawsko-Pomorskie
  { name: "Bydgoszcz", regionSlug: "kujawsko-pomorskie", lat: 53.12, lon: 18.01, isCapital: true, mapVisibility: "always", labelAnchor: "end" },
  { name: "Toruń", regionSlug: "kujawsko-pomorskie", lat: 53.01, lon: 18.6, isCapital: false, mapVisibility: "wide" },
  { name: "Włocławek", regionSlug: "kujawsko-pomorskie", lat: 52.65, lon: 19.07, isCapital: false, mapVisibility: "never" },

  // Lubelskie
  { name: "Lublin", regionSlug: "lubelskie", lat: 51.25, lon: 22.57, isCapital: true, mapVisibility: "always" },
  { name: "Zamość", regionSlug: "lubelskie", lat: 50.72, lon: 23.25, isCapital: false, mapVisibility: "never" },
  { name: "Chełm", regionSlug: "lubelskie", lat: 51.14, lon: 23.47, isCapital: false, mapVisibility: "never" },

  // Lubuskie
  { name: "Gorzów Wielkopolski", regionSlug: "lubuskie", lat: 52.73, lon: 15.24, isCapital: true, aliases: ["Gorzow"], mapVisibility: "always" },
  { name: "Zielona Góra", regionSlug: "lubuskie", lat: 51.94, lon: 15.5, isCapital: false, mapVisibility: "wide" },

  // Łódzkie
  { name: "Łódź", regionSlug: "lodzkie", lat: 51.76, lon: 19.46, isCapital: true, aliases: ["Lodz"], mapVisibility: "always" },
  { name: "Piotrków Trybunalski", regionSlug: "lodzkie", lat: 51.41, lon: 19.7, isCapital: false, mapVisibility: "never" },

  // Małopolskie
  { name: "Kraków", regionSlug: "malopolskie", lat: 50.06, lon: 19.94, isCapital: true, aliases: ["Cracow", "Krakow"], mapVisibility: "always" },
  { name: "Tarnów", regionSlug: "malopolskie", lat: 50.01, lon: 20.99, isCapital: false, mapVisibility: "never" },
  { name: "Nowy Sącz", regionSlug: "malopolskie", lat: 49.62, lon: 20.7, isCapital: false, mapVisibility: "never" },
  { name: "Zakopane", regionSlug: "malopolskie", lat: 49.3, lon: 19.95, isCapital: false, mapVisibility: "wide" },
  { name: "Oświęcim", regionSlug: "malopolskie", lat: 50.03, lon: 19.22, isCapital: false, aliases: ["Auschwitz"], mapVisibility: "never" },

  // Mazowieckie
  { name: "Warsaw", regionSlug: "mazowieckie", lat: 52.23, lon: 21.01, isCapital: true, aliases: ["Warszawa"], mapVisibility: "always" },
  { name: "Radom", regionSlug: "mazowieckie", lat: 51.4, lon: 21.15, isCapital: false, mapVisibility: "never" },
  { name: "Płock", regionSlug: "mazowieckie", lat: 52.55, lon: 19.7, isCapital: false, mapVisibility: "never" },
  { name: "Siedlce", regionSlug: "mazowieckie", lat: 52.17, lon: 22.29, isCapital: false, mapVisibility: "never" },

  // Opolskie
  { name: "Opole", regionSlug: "opolskie", lat: 50.67, lon: 17.93, isCapital: true, mapVisibility: "always" },
  { name: "Kędzierzyn-Koźle", regionSlug: "opolskie", lat: 50.35, lon: 18.21, isCapital: false, mapVisibility: "never" },

  // Podkarpackie
  { name: "Rzeszów", regionSlug: "podkarpackie", lat: 50.04, lon: 22.0, isCapital: true, mapVisibility: "always" },
  { name: "Przemyśl", regionSlug: "podkarpackie", lat: 49.78, lon: 22.77, isCapital: false, mapVisibility: "never" },
  { name: "Krosno", regionSlug: "podkarpackie", lat: 49.69, lon: 21.77, isCapital: false, mapVisibility: "never" },

  // Podlaskie
  { name: "Białystok", regionSlug: "podlaskie", lat: 53.13, lon: 23.16, isCapital: true, mapVisibility: "always", labelAnchor: "end" },
  { name: "Suwałki", regionSlug: "podlaskie", lat: 54.1, lon: 22.93, isCapital: false, mapVisibility: "never" },
  { name: "Łomża", regionSlug: "podlaskie", lat: 53.18, lon: 22.06, isCapital: false, mapVisibility: "never" },

  // Pomorskie
  { name: "Gdańsk", regionSlug: "pomorskie", lat: 54.35, lon: 18.65, isCapital: true, aliases: ["Danzig"], mapVisibility: "always" },
  { name: "Gdynia", regionSlug: "pomorskie", lat: 54.52, lon: 18.53, isCapital: false, mapVisibility: "never" },
  { name: "Sopot", regionSlug: "pomorskie", lat: 54.44, lon: 18.56, isCapital: false, mapVisibility: "never" },
  { name: "Słupsk", regionSlug: "pomorskie", lat: 54.46, lon: 17.03, isCapital: false, mapVisibility: "never" },

  // Śląskie
  { name: "Katowice", regionSlug: "slaskie", lat: 50.26, lon: 19.02, isCapital: true, mapVisibility: "always", labelAnchor: "end" },
  { name: "Częstochowa", regionSlug: "slaskie", lat: 50.81, lon: 19.12, isCapital: false, mapVisibility: "wide", labelAnchor: "end" },
  { name: "Gliwice", regionSlug: "slaskie", lat: 50.29, lon: 18.67, isCapital: false, mapVisibility: "never" },
  { name: "Bielsko-Biała", regionSlug: "slaskie", lat: 49.82, lon: 19.04, isCapital: false, mapVisibility: "never" },

  // Świętokrzyskie
  { name: "Kielce", regionSlug: "swietokrzyskie", lat: 50.87, lon: 20.63, isCapital: true, mapVisibility: "always" },
  { name: "Ostrowiec Świętokrzyski", regionSlug: "swietokrzyskie", lat: 50.93, lon: 21.39, isCapital: false, mapVisibility: "never" },

  // Warmińsko-Mazurskie
  { name: "Olsztyn", regionSlug: "warminsko-mazurskie", lat: 53.78, lon: 20.49, isCapital: true, mapVisibility: "always" },
  { name: "Elbląg", regionSlug: "warminsko-mazurskie", lat: 54.16, lon: 19.4, isCapital: false, mapVisibility: "never" },
  { name: "Ełk", regionSlug: "warminsko-mazurskie", lat: 53.83, lon: 22.36, isCapital: false, mapVisibility: "never" },

  // Wielkopolskie
  { name: "Poznań", regionSlug: "wielkopolskie", lat: 52.41, lon: 16.93, isCapital: true, aliases: ["Poznan"], mapVisibility: "always" },
  { name: "Kalisz", regionSlug: "wielkopolskie", lat: 51.76, lon: 18.09, isCapital: false, mapVisibility: "never" },
  { name: "Konin", regionSlug: "wielkopolskie", lat: 52.22, lon: 18.25, isCapital: false, mapVisibility: "never" },

  // Zachodniopomorskie
  { name: "Szczecin", regionSlug: "zachodniopomorskie", lat: 53.43, lon: 14.55, isCapital: true, aliases: ["Stettin"], mapVisibility: "always" },
  { name: "Koszalin", regionSlug: "zachodniopomorskie", lat: 54.19, lon: 16.18, isCapital: false, mapVisibility: "never" },
  { name: "Kołobrzeg", regionSlug: "zachodniopomorskie", lat: 54.18, lon: 15.58, isCapital: false, mapVisibility: "never" },
  { name: "Świnoujście", regionSlug: "zachodniopomorskie", lat: 53.91, lon: 14.25, isCapital: false, mapVisibility: "never" },
];
