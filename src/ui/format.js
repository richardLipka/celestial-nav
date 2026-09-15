// Formatting that needs to know the language. The core formatters stay
// language-free and take their words as arguments; these are the wrappers the
// views actually call.

import { fmtLat, fmtLon } from '../core/angles.js';
import { fmtClockError } from '../core/time.js';
import { t, latSuffix, lonSuffix } from '../i18n.js';

export const fLat = (deg, places = 1) => fmtLat(deg, places, latSuffix());

export const fLon = (deg, places = 1) => fmtLon(deg, places, lonSuffix());

export const fClockError = (sec) =>
  fmtClockError(sec, {
    fast: t('clock.fast'),
    slow: t('clock.slow'),
    correct: t('clock.correct'),
  });
