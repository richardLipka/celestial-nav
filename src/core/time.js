// Time. Every Date in this application is UTC; there is no local timezone
// anywhere in the core, because the whole subject is the difference between
// two clocks and a third one would only confuse it.

export const MS_DAY = 86400000;
export const MS_HOUR = 3600000;
export const J2000 = 2451545.0;

/** Julian Day from a JS Date. The constant is JD at the Unix epoch. */
export const julianDay = (date) => date.getTime() / MS_DAY + 2440587.5;

export const daysFromJ2000 = (date) => julianDay(date) - J2000;

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
