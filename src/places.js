// Somewhere to stand. The Czech towns span less than two degrees of latitude
// and five and a half of longitude, which makes them a good way to see how
// little the noon sight changes across a country -- and how much the
// longitude reduction does.

export const places = [
  // --- Czech towns --------------------------------------------------------
  { id: 'praha', group: 'cz', name: { en: 'Prague', cs: 'Praha' }, lat: 50.0755, lon: 14.4378 },
  { id: 'plzen', group: 'cz', name: { en: 'Plzeň', cs: 'Plzeň' }, lat: 49.7475, lon: 13.3776 },
  { id: 'brno', group: 'cz', name: { en: 'Brno', cs: 'Brno' }, lat: 49.1951, lon: 16.6068 },
  { id: 'ostrava', group: 'cz', name: { en: 'Ostrava', cs: 'Ostrava' }, lat: 49.8209, lon: 18.2625 },
  { id: 'olomouc', group: 'cz', name: { en: 'Olomouc', cs: 'Olomouc' }, lat: 49.5938, lon: 17.2509 },
  {
    id: 'budejovice', group: 'cz',
    name: { en: 'České Budějovice', cs: 'České Budějovice' },
    lat: 48.9745, lon: 14.4743,
  },
  {
    id: 'hradec', group: 'cz',
    name: { en: 'Hradec Králové', cs: 'Hradec Králové' },
    lat: 50.2092, lon: 15.8328,
  },
  {
    id: 'vary', group: 'cz',
    name: { en: 'Karlovy Vary', cs: 'Karlovy Vary' },
    lat: 50.2306, lon: 12.8712,
  },
  { id: 'liberec', group: 'cz', name: { en: 'Liberec', cs: 'Liberec' }, lat: 50.7663, lon: 15.0543 },
  {
    id: 'usti', group: 'cz',
    name: { en: 'Ústí nad Labem', cs: 'Ústí nad Labem' },
    lat: 50.6607, lon: 14.0323,
  },

  // --- Around the world ---------------------------------------------------
  {
    id: 'greenwich', group: 'world',
    name: { en: 'Greenwich Observatory', cs: 'Hvězdárna v Greenwichi' },
    lat: 51.4779, lon: -0.0015,
  },
  {
    id: 'scilly', group: 'world',
    name: { en: 'Isles of Scilly', cs: 'Ostrovy Scilly' },
    lat: 49.916, lon: -6.3167,
  },
  { id: 'gibraltar', group: 'world', name: { en: 'Gibraltar', cs: 'Gibraltar' }, lat: 36.1408, lon: -5.3536 },
  { id: 'reykjavik', group: 'world', name: { en: 'Reykjavík', cs: 'Reykjavík' }, lat: 64.1466, lon: -21.9426 },
  {
    id: 'nordkapp', group: 'world',
    name: { en: 'North Cape, Norway', cs: 'Nordkapp, Norsko' },
    lat: 71.171, lon: 25.7836,
  },
  {
    id: 'quito', group: 'world',
    name: { en: 'Quito, on the equator', cs: 'Quito, na rovníku' },
    lat: -0.1807, lon: -78.4678,
  },
  {
    id: 'kingston', group: 'world',
    name: { en: 'Kingston, Jamaica', cs: 'Kingston, Jamajka' },
    lat: 17.9712, lon: -76.7936,
  },
  {
    id: 'bridgetown', group: 'world',
    name: { en: 'Bridgetown, Barbados', cs: 'Bridgetown, Barbados' },
    lat: 13.1132, lon: -59.5988,
  },
  { id: 'singapore', group: 'world', name: { en: 'Singapore', cs: 'Singapur' }, lat: 1.3521, lon: 103.8198 },
  {
    id: 'capetown', group: 'world',
    name: { en: 'Cape Town', cs: 'Kapské Město' },
    lat: -33.9249, lon: 18.4241,
  },
  { id: 'sydney', group: 'world', name: { en: 'Sydney', cs: 'Sydney' }, lat: -33.8688, lon: 151.2093 },
  {
    id: 'ushuaia', group: 'world',
    name: { en: 'Ushuaia, Tierra del Fuego', cs: 'Ushuaia, Ohňová země' },
    lat: -54.8019, lon: -68.303,
  },
];

export const GROUPS = ['cz', 'world'];

export const placeById = (id) => places.find((p) => p.id === id);

/** Which place, if any, the ship is currently sitting on. */
export const findPlace = (lat, lon) =>
  places.find((p) => Math.abs(p.lat - lat) < 0.005 && Math.abs(p.lon - lon) < 0.005);

export function applyPlace(p) {
  // The hour on the clock is left alone: it is UTC, it means the same thing
  // everywhere, and a reader who has set it to watch something happen does
  // not want it snapped back for having moved the ship. A scenario is a
  // different matter -- that is a whole setting, clock included.
  return {
    lat: p.lat,
    lon: p.lon,
    globeCenter: { lat: Math.max(-60, Math.min(60, p.lat)), lon: p.lon + 18 },
  };
}
