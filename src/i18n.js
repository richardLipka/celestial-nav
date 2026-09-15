// Czech and English, side by side. Every string the user can read lives here
// except for the scenario and place names, which sit next to their own data.
//
// Czech conventions worth knowing if you edit this file:
//   - the decimal separator is a comma, so 50° 05,3′ and not 50° 05.3′
//   - the compass rose reads S V J Z (sever, východ, jih, západ)
//   - coordinates take s.š. / j.š. for latitude and v.d. / z.d. for longitude,
//     because a bare "S" would mean north in Czech and south in English

import { setDecimalSeparator } from './core/angles.js';

export const LANGS = ['cs', 'en'];
const STORE_KEY = 'celestial-nav.lang';

const dict = {
  en: {
    'app.title': 'Sun, Sextant, Chronometer',
    'app.tagline':
      'The sun stands overhead at one point on Earth. That point’s latitude is a calendar fact; its longitude is a clock fact.',
    'app.langLabel': 'Language',

    'tab.theory': 'Theory',
    'tab.simulation': 'Simulation',
    'theory.withYourFigures': 'with your figures',

    'panel.log': 'Sight log',
    'panel.log.sub': 'what you actually observed',

    'log.take': 'Take a sight',
    'log.sunDown': 'Sun below the horizon',
    'log.clear': 'Clear',
    'log.count': '{n} logged',
    'log.empty': 'No sights yet.',
    'log.no': '#',
    'log.chrono': 'chronometer',
    'log.hs': 'Hs',
    'log.ho': 'Ho',
    'log.bearing': 'bearing',
    'log.match': 'watch it down',
    'log.matchTip': 'Clamp the sextant here and note the time the sun returns to this altitude',
    'log.remove': 'Delete this sight',
    'log.hint.start': 'Move along the day and take sights. You will need the sun on both sides of noon.',
    'log.hint.bracket': 'Your highest sight is still at one end of the log. Take more on the other side of noon.',
    'log.hint.equal': 'Now take a morning sight and watch the sun back down to the same altitude — that is what gives you the moment of noon.',
    'log.hint.done': 'Paired at {ho}, {span} h apart, and the crossing was actually observed. That pair is your noon.',
    'log.hint.interp': 'Paired at {ho}, {span} h apart — but the afternoon crossing had to be interpolated between two sights, which can cost a minute of time. Use “watch it down” on a morning sight to observe the crossing instead.',

    'wu.needLog': 'Nothing to reduce yet. Take a few sights in the log and they will be worked up here.',
    'wu.fitted': 'peak, fitted',
    'wu.pmInterp': '(interpolated)',
    'wu.pairAt': 'equal altitudes at',
    'wu.amAt': 'morning',
    'wu.pmAt': 'afternoon',
    'wu.midpoint': 'midpoint',
    'wu.eqAltCorr': 'equation of equal alt.',
    'wu.lanFound': 'noon, found',
    'wu.peakAt': 'highest sight at',
    'wu.barByPeak': 'by highest sight',
    'wu.notePeakOnly': 'Without a matched pair, noon is only the time of your highest sight — and near culmination the altitude is flat, which is why that costs {d}.',
    'wu.noteMethods': 'The time of the highest sight puts you {peak} out. Equal altitudes puts you {equal} out. Same sextant, same sun, same chronometer — only a better way of asking when noon was.',

    'rail.sextantNoise': 'sextant reading error',

    'fig.pole': 'elevated pole',
    'fig.zenith': 'your zenith',
    'fig.sun': 'the sun',
    'fig.pzxNote': 'the sky, seen from outside',
    'fig.greenwich': 'Greenwich',
    'fig.yourMeridian': 'your meridian',
    'fig.rotation': 'Earth turns',
    'fig.hourAngleNote': 'looking down on the pole',

    'degen.heading': 'the same sight, three times',
    'degen.cover': 'Cover the magenta and these are the same picture.',
    'degen.held': 'declination held still, so that only the rotation varies',
    'aria.degeneracy': 'Three observers at three longitudes, each at local noon, reading the same altitude',
    'aria.pzx': 'The navigational triangle on the celestial sphere',
    'aria.pzxFlat': 'The navigational triangle with its sides and angles labelled',
    'aria.hourAngle': 'The Earth from above the pole, showing Greenwich hour angle, local hour angle and longitude',

    'panel.sky': 'Sky',
    'panel.sky.sub': 'what the navigator sees',
    'panel.earth': 'Earth',
    'panel.earth.sub': 'where that puts you',
    'panel.meridian': 'Meridian section',
    'panel.meridian.sub': 'why latitude is a subtraction',
    'panel.workup': 'The noon work-up',
    'panel.workup.sub': 'the two reductions, and what they cost',

    'sky.pole': 'pole',
    'sky.poleAlt': 'altitude {a} = latitude',
    'sky.zenith': 'zenith',
    'sky.celEquator': 'celestial equator',
    'sky.belowHorizon': 'the sun is below the horizon',
    'sky.N': 'N',
    'sky.E': 'E',
    'sky.S': 'S',
    'sky.W': 'W',

    'globe.gp': 'GP',
    'globe.gpAssumed': 'assumed GP',
    'globe.you': 'you',
    'globe.drag': 'drag to turn the globe',
    'globe.lha': 'LHA',
    'globe.rowGp': 'GP',
    'globe.rowYou': 'you',

    'mer.N': 'N',
    'mer.S': 'S',
    'mer.equatorPlane': 'equatorial plane',
    'mer.zenith': 'zenith',
    'mer.noClock': 'no clock appears here',
    'mer.atLan': 'at LAN {t} UTC',

    'wu.latitude': 'Latitude',
    'wu.longitude': 'Longitude',
    'wu.needsDate': 'needs a date',
    'wu.needsClock': 'needs a clock',
    'wu.hs': 'sextant  Hs',
    'wu.ho': 'observed  Ho',
    'wu.z': 'zenith distance  z',
    'wu.dec': 'declination  δ',
    'wu.culminates': 'sun culminates',
    'wu.chronoReads': 'chronometer reads',
    'wu.clockError': 'clock error',
    'wu.eot': 'equation of time',
    'wu.ignored': 'ignored',
    'wu.hoursFromNoon': 'hours from UTC noon',
    'wu.times15': '× 15° per hour',
    'wu.noSight':
      'The sun does not rise here on this date, so there is no noon sight to take. The figures below are geometry, not a measurement.',
    'wu.lowSight':
      'The sun only reaches {h} at noon here. Below 5° the refraction model stops meaning anything, and so does the sight.',
    'wu.errorTitle': 'Error in the fix',
    'wu.barLon': 'longitude',
    'wu.barLat': 'latitude',
    'wu.noteClean':
      'With a true chronometer and the almanac applied, both reductions land on the ship. Put an error on the clock and watch which one moves.',
    'wu.noteNoLat': 'The latitude is untouched. The longitude is out by {d}.',
    'wu.noteAll':
      'The fix is {total} from the ship, and the longitude carries essentially all of it. The small latitude error is only the declination drifting — never the clock.',
    'wu.noteRatio':
      'The fix is {total} from the ship. The longitude error is {ratio} times the latitude error, and the latitude error is only the declination drifting — never the clock.',

    'corr.ie': 'index error',
    'corr.dip': 'dip',
    'corr.refr': 'refraction',
    'corr.sd': 'semi-diameter',
    'corr.par': 'parallax',

    'tl.title': 'The ship’s day',
    'tl.goNoon': 'Go to local apparent noon',
    'tl.utc': 'UTC',
    'tl.chrono': 'chronometer',
    'tl.apparent': 'ship’s apparent',
    'tl.sunrise': 'sunrise',
    'tl.sunset': 'sunset',
    'tl.noon': 'local apparent noon',
    'tl.dayLabel': 'Time of day, UTC',

    'gauge.title': 'dependence on the clock',
    'gauge.meridian': 'meridian',
    'gauge.primeVertical': 'prime vertical',
    'gauge.free': 'a clock error costs nothing here',
    'gauge.down': 'the sun is down',
    'gauge.over10': 'over 10 minutes of clock error per mile',
    'gauge.perNm': '{s} s of clock error = 1 nm',
    'gauge.aria': 'How much this sight depends on the clock',

    'rail.scenario': 'Scenario',
    'rail.place': 'Place',
    'rail.ship': 'The ship',
    'rail.chronometer': 'The chronometer',
    'rail.sextant': 'The sextant',
    'rail.overlays': 'Overlays',
    'rail.latitude': 'latitude',
    'rail.longitude': 'longitude',
    'rail.date': 'date',
    'rail.error': 'error',
    'rail.setRight': 'Set it right',
    'rail.useEot': 'apply the equation of time',
    'rail.eyeHeight': 'height of eye',
    'rail.indexError': 'index error',
    'rail.corrections': 'corrections',
    'rail.eyeVal': '{m} m — dip {d}′',
    'rail.customPlace': '— custom position —',

    'show.cop': 'circle of equal altitude',
    'show.lop': 'line of position',
    'show.equator': 'celestial equator',
    'show.night': 'day and night',
    'show.belowHorizon': 'the sun below the horizon',

    'clock.fast': 'fast',
    'clock.slow': 'slow',
    'clock.correct': 'correct',

    'unit.nm': 'nm',
    'unit.min': 'min',

    'suffix.N': 'N',
    'suffix.S': 'S',
    'suffix.E': 'E',
    'suffix.W': 'W',

    'places.cz': 'Czech towns',
    'places.world': 'Around the world',

    'aria.sky': 'The sun in the observer’s sky, zenith at the centre',
    'aria.globe': 'The Earth, the point beneath the sun, and the circle of position',
    'aria.meridian': 'Cross-section of the Earth through the observer’s meridian at noon',
  },

  cs: {
    'app.title': 'Slunce, sextant, chronometr',
    'app.tagline':
      'Slunce stojí v nadhlavníku právě nad jediným bodem Země. Zeměpisná šířka toho bodu plyne z kalendáře, jeho délka z hodin.',
    'app.langLabel': 'Jazyk',

    'tab.theory': 'Teorie',
    'tab.simulation': 'Simulace',
    'theory.withYourFigures': 's vašimi čísly',

    'panel.log': 'Deník měření',
    'panel.log.sub': 'co jste skutečně pozorovali',

    'log.take': 'Změřit výšku',
    'log.sunDown': 'Slunce pod obzorem',
    'log.clear': 'Vymazat',
    'log.count': 'zapsáno: {n}',
    'log.empty': 'Zatím žádná měření.',
    'log.no': 'č.',
    'log.chrono': 'chronometr',
    'log.hs': 'Hs',
    'log.ho': 'Ho',
    'log.bearing': 'azimut',
    'log.match': 'počkat na návrat',
    'log.matchTip': 'Zaaretujte sextant na této výšce a zapište čas, kdy se k ní Slunce vrátí',
    'log.remove': 'Smazat toto měření',
    'log.hint.start': 'Posouvejte se dnem a měřte výšky. Budete potřebovat Slunce na obou stranách poledne.',
    'log.hint.bracket': 'Vaše nejvyšší měření je stále na okraji deníku. Změřte další na druhé straně poledne.',
    'log.hint.equal': 'Teď změřte dopolední výšku a počkejte, až se k ní Slunce vrátí — právě to vám dá okamžik poledne.',
    'log.hint.done': 'Dvojice na {ho}, odstup {span} h, a průchod byl skutečně pozorován. Ta dvojice je vaše poledne.',
    'log.hint.interp': 'Dvojice na {ho}, odstup {span} h — jenže odpolední průchod se musel interpolovat mezi dvěma měřeními, což může stát minutu času. Použijte u dopoledního měření „počkat na návrat“ a průchod skutečně pozorujte.',

    'wu.needLog': 'Zatím není co počítat. Zapište v deníku několik měření a tady se zpracují.',
    'wu.fitted': 'vrchol, proložený',
    'wu.pmInterp': '(interpolováno)',
    'wu.pairAt': 'stejné výšky na',
    'wu.amAt': 'dopoledne',
    'wu.pmAt': 'odpoledne',
    'wu.midpoint': 'střed',
    'wu.eqAltCorr': 'rovnice stejných výšek',
    'wu.lanFound': 'nalezené poledne',
    'wu.peakAt': 'nejvyšší měření v',
    'wu.barByPeak': 'podle nejvyššího',
    'wu.notePeakOnly': 'Bez spárované dvojice je poledne jen časem vašeho nejvyššího měření — a v okolí kulminace je výška plochá, což stojí {d}.',
    'wu.noteMethods': 'Čas nejvyššího měření vás posune o {peak} vedle. Metoda stejných výšek o {equal}. Týž sextant, totéž Slunce, týž chronometr — jen lepší způsob, jak se zeptat, kdy bylo poledne.',

    'rail.sextantNoise': 'chyba odečtu sextantu',

    'fig.pole': 'povýšený pól',
    'fig.zenith': 'váš zenit',
    'fig.sun': 'Slunce',
    'fig.pzxNote': 'obloha, viděná zvenčí',
    'fig.greenwich': 'Greenwich',
    'fig.yourMeridian': 'váš poledník',
    'fig.rotation': 'Země se otáčí',
    'fig.hourAngleNote': 'pohled shora na pól',

    'degen.heading': 'totéž měření, třikrát',
    'degen.cover': 'Zakryjte purpurové a jsou to tytéž obrázky.',
    'degen.held': 'deklinace držena na místě, aby se měnila jen rotace',
    'aria.degeneracy': 'Tři pozorovatelé na třech délkách, každý v místním poledni, měří tutéž výšku',
    'aria.pzx': 'Navigační trojúhelník na nebeské sféře',
    'aria.pzxFlat': 'Navigační trojúhelník s popsanými stranami a úhly',
    'aria.hourAngle': 'Země shora od pólu s greenwichským a místním hodinovým úhlem a zeměpisnou délkou',

    'panel.sky': 'Obloha',
    'panel.sky.sub': 'co vidí navigátor',
    'panel.earth': 'Země',
    'panel.earth.sub': 'kam vás to umístí',
    'panel.meridian': 'Řez poledníkem',
    'panel.meridian.sub': 'proč je šířka pouhé odčítání',
    'panel.workup': 'Polední výpočet',
    'panel.workup.sub': 'dva výpočty a co který stál',

    'sky.pole': 'pól',
    'sky.poleAlt': 'výška {a} = šířka',
    'sky.zenith': 'zenit',
    'sky.celEquator': 'nebeský rovník',
    'sky.belowHorizon': 'Slunce je pod obzorem',
    'sky.N': 'S',
    'sky.E': 'V',
    'sky.S': 'J',
    'sky.W': 'Z',

    'globe.gp': 'PB',
    'globe.gpAssumed': 'domnělý PB',
    'globe.you': 'vy',
    'globe.drag': 'tažením otočíte zeměkouli',
    'globe.lha': 'MHÚ',
    'globe.rowGp': 'PB',
    'globe.rowYou': 'vy',

    'mer.N': 'S',
    'mer.S': 'J',
    'mer.equatorPlane': 'rovina rovníku',
    'mer.zenith': 'zenit',
    'mer.noClock': 'žádné hodiny se tu neobjeví',
    'mer.atLan': 'v pravé poledne {t} UTC',

    'wu.latitude': 'Zeměpisná šířka',
    'wu.longitude': 'Zeměpisná délka',
    'wu.needsDate': 'potřebuje datum',
    'wu.needsClock': 'potřebuje hodiny',
    'wu.hs': 'sextant  Hs',
    'wu.ho': 'pravá výška  Ho',
    'wu.z': 'zenitová vzdálenost  z',
    'wu.dec': 'deklinace  δ',
    'wu.culminates': 'Slunce kulminuje',
    'wu.chronoReads': 'chronometr ukazuje',
    'wu.clockError': 'chyba hodin',
    'wu.eot': 'časová rovnice',
    'wu.ignored': 'ignorována',
    'wu.hoursFromNoon': 'hodin od poledne UTC',
    'wu.times15': '× 15° za hodinu',
    'wu.noSight':
      'Na tomto místě dnes Slunce nevychází, takže není co v poledne měřit. Čísla níže jsou geometrie, ne měření.',
    'wu.lowSight':
      'Slunce tu v poledne vystoupá jen na {h}. Pod 5° přestává model refrakce cokoli znamenat — a s ním i celé měření.',
    'wu.errorTitle': 'Chyba určené pozice',
    'wu.barLon': 'délka',
    'wu.barLat': 'šířka',
    'wu.noteClean':
      'Se správným chronometrem a s použitou ročenkou padnou oba výpočty přesně na loď. Rozhoďte hodiny a sledujte, který z nich se pohne.',
    'wu.noteNoLat': 'Šířka zůstala nedotčená. Délka je mimo o {d}.',
    'wu.noteAll':
      'Určená pozice leží {total} od lodi a prakticky celou tu chybu nese délka. Malá chyba šířky je jen posun deklinace — nikdy ne hodiny.',
    'wu.noteRatio':
      'Určená pozice leží {total} od lodi. Chyba délky je {ratio}× větší než chyba šířky, a ta je jen posunem deklinace — nikdy ne hodinami.',

    'corr.ie': 'indexová chyba',
    'corr.dip': 'deprese obzoru',
    'corr.refr': 'refrakce',
    'corr.sd': 'poloměr Slunce',
    'corr.par': 'paralaxa',

    'tl.title': 'Den na lodi',
    'tl.goNoon': 'Skočit na pravé poledne',
    'tl.utc': 'UTC',
    'tl.chrono': 'chronometr',
    'tl.apparent': 'místní pravý čas',
    'tl.sunrise': 'východ Slunce',
    'tl.sunset': 'západ Slunce',
    'tl.noon': 'místní pravé poledne',
    'tl.dayLabel': 'Denní doba, UTC',

    'gauge.title': 'závislost na hodinách',
    'gauge.meridian': 'poledník',
    'gauge.primeVertical': 'první vertikál',
    'gauge.free': 'chyba hodin tu nic nestojí',
    'gauge.down': 'Slunce je pod obzorem',
    'gauge.over10': 'přes 10 minut chyby hodin na míli',
    'gauge.perNm': '{s} s chyby hodin = 1 nm',
    'gauge.aria': 'Jak moc toto měření závisí na hodinách',

    'rail.scenario': 'Scénář',
    'rail.place': 'Místo',
    'rail.ship': 'Loď',
    'rail.chronometer': 'Chronometr',
    'rail.sextant': 'Sextant',
    'rail.overlays': 'Vrstvy',
    'rail.latitude': 'šířka',
    'rail.longitude': 'délka',
    'rail.date': 'datum',
    'rail.error': 'chyba',
    'rail.setRight': 'Seřídit',
    'rail.useEot': 'použít časovou rovnici',
    'rail.eyeHeight': 'výška oka',
    'rail.indexError': 'indexová chyba',
    'rail.corrections': 'opravy',
    'rail.eyeVal': '{m} m — deprese {d}′',
    'rail.customPlace': '— vlastní poloha —',

    'show.cop': 'kružnice stejné výšky',
    'show.lop': 'poziční přímka',
    'show.equator': 'nebeský rovník',
    'show.night': 'den a noc',
    'show.belowHorizon': 'Slunce pod obzorem',

    'clock.fast': 'napřed',
    'clock.slow': 'pozadu',
    'clock.correct': 'jdou přesně',

    'unit.nm': 'nm',
    'unit.min': 'min',

    'suffix.N': 's.š.',
    'suffix.S': 'j.š.',
    'suffix.E': 'v.d.',
    'suffix.W': 'z.d.',

    'places.cz': 'Česká města',
    'places.world': 'Po světě',

    'aria.sky': 'Slunce na obloze pozorovatele, zenit uprostřed',
    'aria.globe': 'Země, podsluneční bod a kružnice stejné výšky',
    'aria.meridian': 'Řez Zemí poledníkem pozorovatele v pravé poledne',
  },
};

function initial() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    /* private browsing, or storage disabled */
  }
  return typeof navigator !== 'undefined' && /^cs/i.test(navigator.language || '') ? 'cs' : 'en';
}

let lang = initial();
applySideEffects();

export const getLang = () => lang;

export function setLang(next) {
  if (!LANGS.includes(next) || next === lang) return false;
  lang = next;
  try {
    localStorage.setItem(STORE_KEY, lang);
  } catch {
    /* nothing to do; the choice just will not persist */
  }
  applySideEffects();
  return true;
}

function applySideEffects() {
  // Czech writes 50° 05,3′. The separator affects formatting only, never
  // arithmetic -- see the note in core/angles.js.
  setDecimalSeparator(lang === 'cs' ? ',' : '.');
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.title = dict[lang]['app.title'];
  }
}

/** Look up a string, substituting {placeholders}. */
export function t(key, vars) {
  let s = dict[lang][key] ?? dict.en[key] ?? key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}

/** Pick the current language out of a { en, cs } pair. */
export const pick = (pair) => (pair && pair[lang]) ?? pair?.en ?? '';

/** Hemisphere suffixes for coordinates, in the current language. */
export const latSuffix = () => [t('suffix.N'), t('suffix.S')];
export const lonSuffix = () => [t('suffix.E'), t('suffix.W')];

export const dictionaries = dict; // exported for the completeness test
