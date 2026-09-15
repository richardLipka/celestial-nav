// Formatting that needs to know the language. The core formatters stay
// language-free and take their words as arguments; these are the wrappers the
// views actually call.

import { fmtLat, fmtLon, fmtNumber } from '../core/angles.js';
import { fmtClockError } from '../core/time.js';
import { t, latSuffix, lonSuffix } from '../i18n.js';

// Exactly zero belongs to neither hemisphere: the equator is not north, and
// the prime meridian is not east. Suppress the suffix rather than pick one.
const zeroish = (deg, places) => Math.abs(deg) * 60 < 0.5 / 10 ** places;

export const fLat = (deg, places = 1) =>
  fmtLat(deg, places, zeroish(deg, places) ? ['', ''] : latSuffix()).trimEnd();

export const fLon = (deg, places = 1) =>
  fmtLon(deg, places, zeroish(deg, places) ? ['', ''] : lonSuffix()).trimEnd();

/** A chronometer's rate, in the idiom a rate certificate would use. */
export const fRate = (secPerDay) => {
  if (Math.abs(secPerDay) < 0.005) return t('clock.steady');
  const word = secPerDay > 0 ? t('clock.gaining') : t('clock.losing');
  return `${word} ${fmtNumber(Math.abs(secPerDay), 2)} ${t('unit.secPerDay')}`;
};

export const fClockError = (sec) =>
  fmtClockError(sec, {
    fast: t('clock.fast'),
    slow: t('clock.slow'),
    correct: t('clock.correct'),
  });
