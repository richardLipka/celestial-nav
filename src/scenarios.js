// Presets are the curriculum; the sliders are what you fiddle with afterwards.
// Historical figures here are flavour, not physics -- the simulation does the
// arguing, and these just put it somewhere.

export const scenarios = [
  {
    id: 'jamaica',
    date: [1762, 1, 19],
    departure: [1761, 11, 18], // Portsmouth, with HMS Deptford
    lat: 18.0,
    lon: -76.8,
    clockErrorSec: 0,
    clockRateSecPerDay: 5 / 62, // the five seconds it lost, spread over the passage
    name: { en: 'The Jamaica trial, 1762', cs: 'Zkouška na Jamajku, 1762' },
    note: {
      en:
        'Harrison’s H4 lost about five seconds on the passage to Jamaica — not because it kept perfect ' +
        'time, but because its rate was steady enough to be known and corrected for. Here that residue is a rate ' +
        'of a twelfth of a second a day, accumulating since Portsmouth. Run it up and see how little margin there was.',
      cs:
        'Harrisonovy hodiny H4 ztratily na plavbě na Jamajku asi pět sekund — ne proto, že by šly naprosto přesně, ' +
        'ale proto, že jejich chod byl dost stálý na to, aby se dal znát a započítat. Tady je ten zbytek chodem ' +
        'dvanáctiny sekundy denně, který se sčítá od Portsmouthu. Zvyšte ho a uvidíte, jak málo prostoru ve skutečnosti bylo.',
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
        'and the fix is still 247 nm out, because the almanac has been switched off. The clock was never sufficient on its own.',
      cs:
        'Začátek listopadu: sluneční hodiny jdou šestnáct minut napřed před hodinami. Chronometr je tu naprosto přesný, ' +
        'a pozice je přesto o 247 nm vedle, protože je vypnutá ročenka. Samotné hodiny nikdy nestačily.',
    },
  },
  {
    id: 'act',
    date: [1765, 6, 12],
    departure: [1765, 5, 1], // six weeks earlier
    lat: 13.1,
    lon: -59.6,
    clockErrorSec: 0,
    clockRateSecPerDay: 120 / 42, // exactly the prize threshold, spread over the passage
    name: { en: 'The Longitude Act’s demand', cs: 'Požadavek zákona o délce' },
    note: {
      en:
        'Half a degree on a voyage to the West Indies was what £20,000 bought. Half a degree is two minutes of ' +
        'time; over a six-week passage that is a rate of under three seconds a day. This clock keeps exactly that ' +
        'rate — so the longer it stays at sea the closer it creeps to that threshold, and it is the length of ' +
        'the passage that decides whether it wins.',
      cs:
        'Půl stupně na plavbě do Západní Indie — za to se platilo 20 000 liber. Půl stupně jsou dvě minuty času; ' +
        'na šestitýdenní plavbě to znamená chod necelé tři sekundy denně. Tyhle hodiny jdou přesně tímto chodem, ' +
        'takže čím déle jsou na moři, tím blíž se k té hranici dostanou — a o výhře rozhoduje délka plavby.',
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
  const dep = sc.departure ?? sc.date;
  return {
    scenario: sc.id,
    date: new Date(Date.UTC(y, m - 1, d)),
    departureDate: new Date(Date.UTC(dep[0], dep[1] - 1, dep[2])),
    clockRateSecPerDay: sc.clockRateSecPerDay ?? 0,
    lat: sc.lat,
    lon: sc.lon,
    clockErrorSec: sc.clockErrorSec ?? 0,
    useEoT: sc.useEoT ?? true,
    secondOfDay: null, // snap to local apparent noon
    globeCenter: { lat: Math.max(-60, Math.min(60, sc.lat)), lon: sc.lon + 18 },
  };
}
