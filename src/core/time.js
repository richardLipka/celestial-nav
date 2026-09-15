// Time. Every Date in this application is UTC; there is no local timezone
// anywhere in the core, because the whole subject is the difference between
// two clocks and a third one would only confuse it.

export const MS_DAY = 86400000;
export const MS_HOUR = 3600000;
export const J2000 = 2451545.0;

/** Julian Day from a JS Date. The constant is JD at the Unix epoch. */
export const julianDay = (date) => date.getTime() / MS_DAY + 2440587.5;

export const daysFromJ2000 = (date) => julianDay(date) - J2000;

/** Julian centuries of 36525 days from J2000 — the argument every long series wants. */
export const julianCenturies = (date) => daysFromJ2000(date) / 36525;

/**
 * Delta T: dynamical time minus universal time, in seconds.
 *
 * Two different clocks, and the difference between them is not a constant.
 * UT is the Earth's rotation, which is irregular and slowing; dynamical time
 * is the uniform time the equations of motion actually run on. An ephemeris
 * is a function of the second, a sextant sight of the first.
 *
 * It matters here because of the moon. The sun moves 2.5 arcseconds a minute
 * and a minute of Delta T is invisible; the moon moves 33 arcminutes an hour,
 * so a minute of it puts the moon half an arcminute out of place — and a
 * lunar distance is read to a tenth of that.
 *
 * Polynomial fits from Espenak and Meeus, covering 1600 to 2150. Nobody
 * measured Delta T before it was measured; for the eighteenth century these
 * are reconstructions from eclipse records and are themselves uncertain by
 * seconds, which is worth knowing when reading a lunar taken in 1765.
 */
export function deltaT(date) {
  const y = date.getUTCFullYear() + (date.getUTCMonth() + 0.5) / 12;
  const p = (t, ...c) => c.reduce((acc, k, i) => acc + k * t ** i, 0);

  if (y < 1600) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (y < 1700) return p(y - 1600, 120, -0.9808, -0.01532, 1 / 7129);
  if (y < 1800) return p(y - 1700, 8.83, 0.1603, -0.0059285, 0.00013336, -1 / 1174000);
  if (y < 1860) {
    return p(y - 1800, 13.72, -0.332447, 0.0068612, 0.0041116, -0.00037436,
      0.0000121272, -0.0000001699, 0.000000000875);
  }
  if (y < 1900) return p(y - 1860, 7.62, 0.5737, -0.251754, 0.01680668, -0.0004473624, 1 / 233174);
  if (y < 1920) return p(y - 1900, -2.79, 1.494119, -0.0598939, 0.0061966, -0.000197);
  if (y < 1941) return p(y - 1920, 21.20, 0.84493, -0.076100, 0.0020936);
  if (y < 1961) return p(y - 1950, 29.07, 0.407, -1 / 233, 1 / 2547);
  if (y < 1986) return p(y - 1975, 45.45, 1.067, -1 / 260, -1 / 718);
  if (y < 2005) {
    return p(y - 2000, 63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599);
  }
  if (y < 2050) return p(y - 2000, 62.92, 0.32217, 0.005589);
  if (y < 2150) return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y);
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u;
}

/** The same instant, as the dynamical time an ephemeris wants. */
export const terrestrialTime = (date) => new Date(date.getTime() + deltaT(date) * 1000);

/** Hours elapsed since UTC midnight, as a real number. */
export const utcHours = (date) =>
  date.getUTCHours() +
  date.getUTCMinutes() / 60 +
  date.getUTCSeconds() / 3600 +
  date.getUTCMilliseconds() / 3600000;

export const utcMidnight = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

/** The instant at `h` hours UTC on the same calendar day as `date`. */
export const atHours = (date, h) => new Date(utcMidnight(date).getTime() + h * MS_HOUR);

export const addSeconds = (date, s) => new Date(date.getTime() + s * 1000);

export const fromParts = (y, mo, d, h = 0, mi = 0, s = 0) =>
  new Date(Date.UTC(y, mo - 1, d, h, mi, s));

const p2 = (n) => String(n).padStart(2, '0');

export const fmtClock = (date, seconds = true) =>
  `${p2(date.getUTCHours())}:${p2(date.getUTCMinutes())}` +
  (seconds ? `:${p2(date.getUTCSeconds())}` : '');

/**
 * The same, to a tenth of a second.
 *
 * One second of time is a quarter of a nautical mile of longitude, so a clock
 * read only to the second cannot appear in a derivation whose answer is shown
 * to a tenth of an arcminute -- the line would not multiply out, and a reader
 * checking it would be right and the page wrong.
 */
export const fmtClockTenths = (date) => {
  const tenths = Math.round(date.getUTCMilliseconds() / 100);
  // A carry at .95 would otherwise print :07.10
  const carried = tenths === 10 ? new Date(date.getTime() + 100) : date;
  const t = tenths === 10 ? 0 : tenths;
  return `${p2(carried.getUTCHours())}:${p2(carried.getUTCMinutes())}:${p2(carried.getUTCSeconds())}.${t}`;
};

export const fmtDate = (date) =>
  `${date.getUTCFullYear()}-${p2(date.getUTCMonth() + 1)}-${p2(date.getUTCDate())}`;

/** Hours as hh:mm:ss, for quantities that are durations rather than instants. */
export function fmtHours(h) {
  const neg = h < 0;
  let t = Math.round(Math.abs(h) * 3600);
  const hh = Math.floor(t / 3600);
  t -= hh * 3600;
  return `${neg ? '−' : ''}${p2(hh)}:${p2(Math.floor(t / 60))}:${p2(t % 60)}`;
}

/** Days elapsed between two instants, as a real number. */
export const daysBetween = (a, b) => (b - a) / MS_DAY;

/**
 * What a chronometer reads, minus the truth, at a given instant.
 *
 * A chronometer is not judged by whether it is right. It is judged by whether
 * its rate is constant: you have it rated ashore, you apply that known rate at
 * sea, and what is left over is the part of the rate you did not know about.
 * `rateSecPerDay` is that residue, positive when the watch gains.
 *
 *     error(t) = errorAtDeparture + rate * (t - departure)
 *
 * Before departure the watch is still on the bench being rated, so the days
 * are clamped at zero rather than running backwards.
 */
export function chronometerError(departure, at, errorAtDepartureSec = 0, rateSecPerDay = 0) {
  const days = Math.max(0, daysBetween(departure, at));
  return errorAtDepartureSec + rateSecPerDay * days;
}

/**
 * A signed clock error, in the way a rate certificate would state it.
 * `words` carries the three localised terms, so this file stays language-free.
 */
export function fmtClockError(sec, words = { fast: 'fast', slow: 'slow', correct: 'correct' }) {
  if (sec === 0) return words.correct;
  const a = Math.abs(sec);
  const m = Math.floor(a / 60);
  const s = a % 60;
  const mag = m ? `${m}m ${p2(s)}s` : `${s}s`;
  return `${mag} ${sec > 0 ? words.fast : words.slow}`;
}
