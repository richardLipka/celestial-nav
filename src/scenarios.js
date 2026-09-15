// Presets are the curriculum; the sliders are what you fiddle with afterwards.
// Historical figures here are flavour, not physics -- the simulation does the
// arguing, and these just put it somewhere.

export const scenarios = [
  {
    id: 'jamaica',
    date: [1762, 1, 19],
    lat: 18.0,
    lon: -76.8,
    clockErrorSec: 5,
    name: { en: 'The Jamaica trial, 1762', cs: 'Zkouška na Jamajku, 1762' },
    note: {
      en:
        'Harrison’s H4 came home from Jamaica having lost about five seconds in eighty-one days. ' +
        'Five seconds is what the clock is out by here. Run it up and see how little margin there was.',
      cs:
        'Harrisonovy hodiny H4 se vrátily z Jamajky se ztrátou asi pěti sekund za jedenaosmdesát dní. ' +
        'O pět sekund se tu hodiny mýlí. Zvyšte chybu a uvidíte, jak málo prostoru ve skutečnosti bylo.',
    },
  },
  {
    id: 'equinox',
    date: [2025, 3, 20],
    lat: 0,
    lon: 0,
    clockErrorSec: 0,
    name: { en: 'Equinox, on the equator', cs: 'Rovnodennost, na rovníku' },
    note: {
      en:
        'Declination is zero, so the noon sight collapses to φ = 90° − Ho and nothing else. ' +
        'The degenerate easy case, and the right place to start.',
      cs:
        'Deklinace je nulová, takže se polední měření smrskne na φ = 90° − Ho a nic víc. ' +
        'Nejjednodušší možný případ a správné místo, kde začít.',
    },
  },
  {
    id: 'greenwich',
    date: [2025, 6, 21],
    lat: 51.4826,
    lon: 0,
    clockErrorSec: 0,
    name: { en: 'Midsummer at Greenwich', cs: 'Letní slunovrat v Greenwichi' },
    note: {
      en:
        'The sun’s highest arc of the year, 62° at noon. On the prime meridian at midsummer, ' +
        'apparent noon and UTC noon nearly coincide — which makes the longitude method look far simpler than it is.',
      cs:
        'Nejvyšší dráha Slunce v roce, v poledne 62°. Na nultém poledníku o slunovratu pravé poledne ' +
        'a poledne UTC téměř splývají — a metoda určení délky tak vypadá mnohem jednodušeji, než je.',
    },
  },
  {
    id: 'eot',
    date: [2025, 11, 3],
    lat: 0,
    lon: -30,
    clockErrorSec: 0,
    useEoT: false,
    name: { en: 'Equation of time at its worst', cs: 'Časová rovnice v nejhorším' },
    note: {
      en:
        'Early November: the sundial runs sixteen minutes ahead of the clock. The chronometer here is perfect ' +
        'and the fix is still 246 nm out, because the almanac has been switched off. The clock was never sufficient on its own.',
      cs:
        'Začátek listopadu: sluneční hodiny jdou šestnáct minut napřed před hodinami. Chronometr je tu naprosto přesný, ' +
        'a pozice je přesto o 246 nm vedle, protože je vypnutá ročenka. Samotné hodiny nikdy nestačily.',
    },
  },
  {
    id: 'latsail',
    date: [1700, 5, 12],
    lat: 25,
    lon: -45,
    clockErrorSec: 1800,
    name: { en: 'Latitude sailing', cs: 'Plavba po rovnoběžce' },
    note: {
      en:
        'The pre-chronometer workaround. With the clock half an hour out the longitude is worthless, but the ' +
        'latitude still lands within a mile — so you find your destination’s parallel, hold it, and run down the westing until land appears.',
      cs:
        'Řešení z doby před chronometrem. S hodinami o půl hodiny vedle je délka bezcenná, ale šířka stále sedí na míli ' +
        '— najdete si tedy rovnoběžku cíle, držíte se jí a jedete na západ, dokud se neobjeví země.',
    },
  },
  {
    id: 'scilly',
    date: [1707, 10, 22],
    lat: 49.9333,
    lon: -6.3333,
    clockErrorSec: 900,
    name: { en: 'Scilly, October 1707', cs: 'Scilly, říjen 1707' },
    note: {
      en:
        'Days of overcast, dead reckoning only, and a fleet that found the rocks before it found its position. ' +
        'The disaster that put £20,000 on the table seven years later.',
      cs:
        'Dny pod mraky, jen navigace odhadem, a loďstvo, které našlo skály dřív než svou pozici. ' +
        'Katastrofa, která o sedm let později položila na stůl 20 000 liber.',
    },
  },
];

export const byId = (id) => scenarios.find((s) => s.id === id) || scenarios[0];

export function applyScenario(sc) {
  const [y, m, d] = sc.date;
  return {
    scenario: sc.id,
    date: new Date(Date.UTC(y, m - 1, d)),
    lat: sc.lat,
    lon: sc.lon,
    clockErrorSec: sc.clockErrorSec ?? 0,
    useEoT: sc.useEoT ?? true,
    secondOfDay: null, // snap to local apparent noon
    globeCenter: { lat: Math.max(-60, Math.min(60, sc.lat)), lon: sc.lon + 18 },
  };
}
