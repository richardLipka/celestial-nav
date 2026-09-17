// The theory tab, as data. Prose sits next to its translation; the `sub`
// blocks are functions of the derived state, so every equation on the page can
// be shown again with the figures from the sight currently on the timeline.

import { fmtAngle, fmtNumber, cosd, sind, degToNm } from './core/angles.js';
import { NM_PER_CLOCK_SECOND } from './core/horizon.js';
import { fmtClock, fmtClockTenths, daysBetween } from './core/time.js';
import { fLon } from './ui/format.js';

// --- turning formatted values into TeX ------------------------------------

/** "50° 04,5′" -> "50^\circ\,04{,}5'" */
export const tex = (s) =>
  String(s)
    .replace(/°/g, '^\\circ')
    .replace(/′/g, "'")
    .replace(/−/g, '-')
    .replace(/,/g, '{,}')
    .replace(/ /g, '\\,');

const A = (deg) => tex(fmtAngle(deg));
/**
 * The same, bracketed when it is negative, for an angle standing immediately
 * after an operator. Below the horizon the altitude goes negative and
 * "90° − −09° 31,8′" is arithmetic nobody should have to read twice.
 */
const AB = (deg) => (deg < 0 ? `(${A(deg)})` : A(deg));
const N = (v, p = 1) => tex(fmtNumber(v, p));

/** A longitude in the form the rest of the application uses, safe for maths mode. */
const LON = (deg) => {
  const parts = fLon(deg).split(' ');
  const suffix = parts.pop();
  return `${tex(parts.join(' '))}\\;\\text{${suffix}}`;
};

/** A signed quantity in brackets, so that subtracting a negative reads properly. */
const SIGNED = (v, unit) =>
  `(${v < 0 ? '-' : '+'}${N(Math.abs(v))}\\,\\text{${unit}})`;

export const theory = [
  // =====================================================================
  {
    id: 'fact',
    title: { en: 'One measurement, one circle', cs: 'Jedno měření, jedna kružnice' },
    tag: { en: 'the governing fact', cs: 'základní fakt' },
    blocks: [
      {
        k: 'p',
        text: {
          en: 'At any instant the sun stands directly overhead at exactly one place on Earth — its geographical position, or GP. The altitude you measure and your distance from that place are the same number, turned inside out.',
          cs: 'V každém okamžiku stojí Slunce v nadhlavníku právě nad jediným místem na Zemi — nad svým podslunečním bodem, na obrázcích PB. Výška, kterou naměříte, a vaše vzdálenost od toho místa jsou totéž číslo, jen obrácené naruby.',
        },
      },
      {
        k: 'p',
        text: {
          en: 'Altitude is the angle from the horizon up to the body, and what is left of the quarter circle above you is the zenith distance z. Write \\(H_o\\) for the altitude a sextant reading becomes once the corrections are applied — index error, dip, refraction, semi-diameter, parallax — because every reduction works on that and never on the raw reading.',
          cs: 'Výška je úhel od obzoru nahoru k tělesu a to, co ze čtvrtkružnice nad vámi zbývá, je zenitová vzdálenost z. Symbolem \\(H_o\\) se značí výška, na kterou se odečet ze sextantu promění po započtení oprav — indexové chyby, deprese obzoru, refrakce, poloměru Slunce a paralaxy — protože každý výpočet pracuje s ní, a nikdy se surovým odečtem.',
        },
      },
      { k: 'math', tex: 'z = 90^\\circ - H_o' },
      {
        k: 'sub',
        // Not fmtNm here: its thousands separator would come through tex() as
        // a decimal comma, and bare letters in maths mode set italic.
        fn: (d) =>
          `z = 90^\\circ - ${AB(d.sight.Ho)} = ${A(d.z)} = ${Math.round(degToNm(d.z))}\\,\\text{nm}`,
      },
      {
        k: 'p',
        text: {
          en: 'So a single sight puts you somewhere on a circle drawn round the GP — the circle of equal altitude — and never at a point. Everything that follows is working out where that circle lies.',
          cs: 'Jediné měření vás tedy umístí někam na kružnici stejné výšky kolem podslunečního bodu, nikdy do jednoho bodu. Všechno ostatní je hledání toho, kde ta kružnice leží.',
        },
      },
      {
        k: 'p',
        text: {
          en: 'The almanac gives the GP in two independent halves. Its latitude is the sun’s declination, which is a function of the date and drifts by at most a minute of arc an hour. Its longitude is set by the Earth’s rotation, at fifteen degrees an hour. Dates are cheap. Time is not.',
          cs: 'Námořní almanach udává podsluneční bod ve dvou nezávislých polovinách. Jeho šířka je deklinace Slunce, funkce data, která se mění nejvýš o jednu úhlovou minutu za hodinu. Jeho délku určuje rotace Země, patnáct stupňů za hodinu. Datum je laciné. Čas nikoli.',
        },
      },
    ],
  },

  // =====================================================================
  {
    id: 'triangle',
    title: { en: 'The navigational triangle', cs: 'Navigační trojúhelník' },
    tag: { en: 'where both answers come from', cs: 'odkud plynou obě odpovědi' },
    blocks: [
      {
        k: 'p',
        text: {
          en: 'Three points on the celestial sphere — the sky taken as a sphere of unlimited radius, on which only directions count — carry the whole problem. The sky appears to turn about two fixed points, the **celestial poles**, which stand over the Earth’s own two; the sphere marks them Pn and Ps, and one of the pair is always below your horizon. The one above it is the first of the three: the **elevated pole P**, which is Pn north of the equator and Ps south of it. The second is your zenith Z, the point straight overhead. The third is the sun X. Join them with great circles and you have the navigational triangle. Drag the sphere to turn it, and move the hour in the rail to watch the triangle open and close — at noon it has no interior at all, which is the whole of the next section.',
          cs: 'Celý problém nesou tři body na nebeské sféře — na obloze chápané jako koule o nekonečném poloměru, na níž záleží jen na směrech. Obloha se zdánlivě otáčí kolem dvou pevných bodů, **nebeských pólů**, které stojí nad oběma póly Země; sféra je značí Pn a Ps a jeden z nich je vždycky pod vaším obzorem. Ten nad obzorem je první ze tří bodů: **povýšený pól P**, tedy Pn severně od rovníku a Ps jižně od něj. Druhý je váš zenit Z, bod přímo nad hlavou. Třetí je Slunce X. Spojte je hlavními kružnicemi a máte navigační trojúhelník. Tažením sférou otočíte a posunutím hodiny v panelu uvidíte, jak se trojúhelník otevírá a zavírá — v poledne nemá vnitřek vůbec žádný, a právě o tom je celá další část.',
        },
      },
      { k: 'fig', id: 'pzx3d' },
      {
        k: 'p',
        text: {
          en: 'Its three sides carry exactly the three quantities a sight is about: your latitude \\(\\varphi\\), the sun’s declination \\(\\delta\\), and the altitude \\(H\\). Each side is the complement of one of them, because a side runs from a pole or a zenith while the quantity itself is measured from an equator or a horizon. They are written here for an observer north of the equator; south of it the pole above the horizon is the southern one and every sign mirrors — which is why the equation they lead to carries latitude and declination with their signs rather than as magnitudes, and holds either way.',
          cs: 'Jeho tři strany nesou přesně ty tři veličiny, o které v měření jde: vaši zeměpisnou šířku \\(\\varphi\\), deklinaci Slunce \\(\\delta\\) a výšku \\(H\\). Každá strana je doplňkem jedné z nich do 90°, protože strana vede od pólu nebo od zenitu, kdežto sama veličina se měří od rovníku nebo od obzoru. Jsou zapsány pro pozorovatele severně od rovníku; jižně od něj je pólem nad obzorem ten jižní a všechna znaménka se obrátí — proto rovnice, ke které vedou, nese šířku a deklinaci se znaménkem, a ne jen jejich velikost, a platí tak i tak.',
        },
      },
      {
        k: 'math',
        tex: 'PZ = 90^\\circ-\\varphi \\qquad PX = 90^\\circ-\\delta \\qquad ZX = z = 90^\\circ-H',
      },
      {
        k: 'p',
        text: {
          en: 'The figure below is that same triangle laid flat. It cannot be laid flat with three straight sides: the angles of a spherical triangle add to more than \\(180^\\circ\\), and the excess is the triangle’s area. Drawn this way instead, every angle on the page is the angle on the sphere, and the sides bend to pay for it — their lengths on the page mean nothing, which is why each one is written on.',
          cs: 'Obrázek níže je týž trojúhelník rozložený do roviny. Se třemi rovnými stranami to nejde: úhly sférického trojúhelníku dávají v součtu víc než \\(180^\\circ\\) a ten přebytek je jeho obsah. Nakreslený takto má každý úhel na papíře přesně ten, který je na sféře, a zaplatí se za to zakřivením stran — jejich délky na papíře neznamenají nic, a proto je u každé napsaná.',
        },
      },
      { k: 'fig', id: 'pzxFlat' },
      {
        k: 'p',
        text: {
          en: 'The angle at P is the local hour angle \\(t\\) — how far the sun stands from your meridian, and therefore a measure of time. The angle at Z is the azimuth angle \\(Z\\), which is the sun’s bearing with one caveat: bearings run from north the whole way round, and an angle in a triangle cannot pass \\(180^\\circ\\). North of the equator \\(Z_n = Z\\) with the sun in the east and \\(Z_n = 360^\\circ - Z\\) with it in the west. It is \\(Z_n\\) that goes on a chart, and \\(Z_n\\) that the rest of this page uses. The spherical cosine rule for sides ties the triangle together:',
          cs: 'Úhel při P je místní hodinový úhel \\(t\\) — jak daleko stojí Slunce od vašeho poledníku, tedy míra času. Úhel při Z je azimutální úhel \\(Z\\), což je náměr Slunce s jednou výhradou: náměry se počítají od severu dokola, ale úhel v trojúhelníku nemůže přesáhnout \\(180^\\circ\\). Severně od rovníku platí \\(Z_n = Z\\), je-li Slunce na východě, a \\(Z_n = 360^\\circ - Z\\), je-li na západě. Do mapy se nanáší \\(Z_n\\) a se \\(Z_n\\) pracuje i zbytek této stránky. Sférická kosinová věta pro strany spojuje trojúhelník dohromady:',
        },
      },
      { k: 'math', tex: '\\cos ZX = \\cos PZ \\, \\cos PX + \\sin PZ \\, \\sin PX \\, \\cos P' },
      {
        k: 'p',
        text: {
          en: 'Substitute the three sides and use \\(\\cos(90^\\circ-x)=\\sin x\\) on the cosines and \\(\\sin(90^\\circ-x)=\\cos x\\) on the sines, and out falls the equation every sight reduction in the world rests on:',
          cs: 'Dosaďte tři strany, na kosiny použijte \\(\\cos(90^\\circ-x)=\\sin x\\) a na siny \\(\\sin(90^\\circ-x)=\\cos x\\) — a vypadne rovnice, na které stojí každý navigační výpočet na světě:',
        },
      },
      { k: 'math', tex: '\\sin H = \\sin\\varphi \\, \\sin\\delta + \\cos\\varphi \\, \\cos\\delta \\, \\cos t', big: true },
      {
        k: 'sub',
        fn: (d, s) =>
          `\\sin H = \\sin(${A(s.lat)}) \\sin(${A(d.sky.solar.dec)}) + \\cos(${A(s.lat)}) \\cos(${A(d.sky.solar.dec)}) \\cos(${A(d.sky.lha)}) = ${N(sind(d.sky.H), 4)}`,
      },
      { k: 'sub', fn: (d) => `H = ${A(d.sky.H)}` },
      {
        k: 'note',
        text: {
          en: 'Three unknowns hide in that line: \\(\\varphi\\), \\(\\delta\\) and \\(t\\). The almanac hands you \\(\\delta\\) from the date alone. The rest of this page is the two different ways of getting rid of one more.',
          cs: 'V té řádce se skrývají tři neznámé: \\(\\varphi\\), \\(\\delta\\) a \\(t\\). Almanach vám dá \\(\\delta\\) ze samotného data. Zbytek této stránky jsou dva různé způsoby, jak se zbavit ještě jedné.',
        },
      },
    ],
  },

  // =====================================================================
  {
    id: 'latitude',
    kind: 'lat',
    title: { en: 'Latitude', cs: 'Zeměpisná šířka' },
    tag: { en: 'kill the hour angle', cs: 'zbavit se hodinového úhlu' },
    blocks: [
      {
        k: 'p',
        text: {
          en: 'Wait until the sun crosses your meridian. Then \\(t = 0\\), \\(\\cos t = 1\\), and the equation collapses onto a cosine of a difference:',
          cs: 'Počkejte, až Slunce projde vaším poledníkem. Pak je \\(t = 0\\), \\(\\cos t = 1\\) a rovnice se sesype na kosinus rozdílu:',
        },
      },
      {
        k: 'math',
        tex: '\\sin H = \\sin\\varphi \\, \\sin\\delta + \\cos\\varphi \\, \\cos\\delta = \\cos(\\varphi-\\delta)',
      },
      { k: 'math', tex: 'H = 90^\\circ - |\\varphi-\\delta| \\qquad\\Longrightarrow\\qquad z = |\\varphi-\\delta|' },
      {
        k: 'p',
        text: {
          en: 'The zenith distance is simply the difference of two latitudes — yours and the sun’s. Which way round depends only on which side of your zenith the sun passed: bearing south, \\(\\varphi = \\delta + z\\); bearing north, \\(\\varphi = \\delta - z\\). Both hold with the declination carrying its own sign, and you can see which case you are in:',
          cs: 'Zenitová vzdálenost je prostě rozdíl dvou šířek — vaší a sluneční. Na kterou stranu, závisí jen na tom, kterou stranou zenitu Slunce prošlo: míří-li na jih, je \\(\\varphi = \\delta + z\\), míří-li na sever, je \\(\\varphi = \\delta - z\\). Obojí platí s deklinací i s jejím znaménkem, a je vidět, který případ nastal:',
        },
      },
      {
        k: 'math',
        tex: '\\varphi = \\delta + z \\;\\; (\\text{S}) \\qquad\\qquad \\varphi = \\delta - z \\;\\; (\\text{N})',
        big: true,
      },
      {
        k: 'p',
        text: {
          en: 'Geometrically the triangle has vanished. P, Z and X all lie on one great circle — your meridian — so the spherical triangle degenerates into a straight line, and spherical trigonometry becomes addition.',
          cs: 'Geometricky trojúhelník zmizel. P, Z i X leží na jedné hlavní kružnici — na vašem poledníku — takže sférický trojúhelník se zvrhne v úsečku a sférická trigonometrie se scvrkne na sčítání.',
        },
      },
      { k: 'fig', id: 'meridian' },
      {
        k: 'sub',
        fn: (d, s) => {
          const r = d.logResult;
          if (r.stage === 'none') return null;
          const sign = r.sunBearsSouth ? '+' : '-';
          return `\\varphi = ${A(r.dec)} ${sign} ${A(r.z)} = ${A(r.lat)}`;
        },
        empty: {
          en: 'Log a noon sight in the simulation and this line fills in with your own figures.',
          cs: 'Zapište v simulaci polední měření a tato řádka se doplní vašimi vlastními čísly.',
        },
      },
      {
        k: 'note',
        kind: 'good',
        text: {
          en: 'There is no \\(t\\) anywhere in that derivation, so there is no clock in it either — and the observation is self-timing, because you simply watch the altitude stop rising. That is the whole reason latitude was never the problem.',
          cs: 'V celém odvození není nikde \\(t\\), a tedy ani žádné hodiny — a samo měření si určuje čas, protože prostě sledujete, kdy výška přestane růst. To je celý důvod, proč šířka nikdy nebyla problém.',
        },
      },
      {
        k: 'p',
        text: {
          en: 'The same fact arrives by a second route. Whichever pole stands above your horizon does so at an altitude equal to your latitude — which is why, north of the equator, a single sight of Polaris is very nearly a latitude and nothing else. Only very nearly: in 1762 Polaris stood two degrees from the pole, a hundred and twenty miles of it, and the almanac carries its own table to take that out. Today it is under forty minutes of arc.',
          cs: 'Tentýž fakt přichází ještě druhou cestou. Ten pól, který máte nad obzorem, stojí ve výšce rovné vaší šířce — proto je severně od rovníku jediné zaměření Polárky téměř rovnou zeměpisnou šířkou. Jen téměř: v roce 1762 stála Polárka dva stupně od pólu, tedy sto dvacet námořních mil, a almanach na to má vlastní tabulku. Dnes je to méně než čtyřicet úhlových minut.',
        },
      },
      { k: 'math', tex: 'H_P = |\\varphi|' },
      { k: 'sub', fn: (d, s) => `H_P = ${A(Math.abs(s.lat))}` },
    ],
  },

  // =====================================================================
  {
    id: 'longitude',
    kind: 'lon',
    title: { en: 'Longitude', cs: 'Zeměpisná délka' },
    tag: { en: 'the hour angle is the answer', cs: 'hodinový úhel je ta odpověď' },
    blocks: [
      {
        k: 'p',
        text: {
          en: 'Longitude has no equator. The prime meridian is a mark painted on a turning body, so nothing in the sky can point at it — it has to be carried with you.',
          cs: 'Zeměpisná délka nemá rovník. Nultý poledník je značka namalovaná na otáčejícím se tělese, takže na něj nic na obloze nemůže ukázat — musíte si ho přivézt s sebou.',
        },
      },
      {
        k: 'p',
        text: {
          en: 'Here is that statement as a picture. Three ships at three longitudes, each at its own local apparent noon, each reading the same altitude off the same instrument. The three panels differ in exactly one thing — where Greenwich is drawn — and Greenwich is the one line on Earth that none of them can see.',
          cs: 'Tady je totéž tvrzení jako obrázek. Tři lodě na třech zeměpisných délkách, každá ve svém místním pravém poledni, každá naměří tutéž výšku týmž přístrojem. Ty tři panely se liší přesně v jediné věci — v tom, kde je nakreslený Greenwich — a Greenwich je jediná čára na Zemi, kterou žádná z nich nevidí.',
        },
      },
      { k: 'fig', id: 'degeneracy', wide: true },
      {
        k: 'note',
        kind: 'bad',
        text: {
          en: 'This is an exact symmetry, not an approximation: turning the Earth while advancing the clock leaves every observable untouched. Only the declination breaks it, and only by creeping a minute of arc an hour — far too little, and far too ambiguous about which side of the solstice you are on, to serve as a clock. That is why the moon was worth the trouble: it moves thirty times faster against the stars.',
          cs: 'Jde o přesnou symetrii, ne o přiblížení: pootočíte-li Zemí a zároveň posunete hodiny, žádná měřitelná veličina se nezmění. Poruší ji jedině deklinace, a to jen posunem o úhlovou minutu za hodinu — příliš málo a příliš nejednoznačné vzhledem k tomu, na které straně slunovratu jste, než aby to mohlo sloužit jako hodiny. Proto stál Měsíc za tu námahu: vůči hvězdám se pohybuje třicetkrát rychleji.',
        },
      },
      {
        k: 'p',
        text: {
          en: 'What the sky does offer is the sun’s hour angle at Greenwich: pure rotation, and one number out of an almanac — the equation of time \\(E\\), by which the sun in the sky and the sun a clock keeps differ. It runs from sixteen minutes of time one way at the start of November to fifteen the other in February, it is a function of the date, and nothing you can measure will give it to you; below it enters as an angle, a minute of time being fifteen minutes of arc.',
          cs: 'Co obloha nabízí, je hodinový úhel Slunce vůči Greenwichi: čirá rotace a jedno číslo z almanachu — časová rovnice \\(E\\), o kterou se liší Slunce na obloze a Slunce, které ukazují hodiny. Pohybuje se od šestnácti minut času na jednu stranu začátkem listopadu po patnáct na druhou v únoru, je funkcí data a nic, co změříte, vám ji nedá; do rovnice níže vstupuje jako úhel, neboť minuta času je patnáct úhlových minut.',
        },
      },
      { k: 'math', tex: '\\mathrm{GHA} = 15^\\circ\\!/\\mathrm{h} \\cdot (\\mathrm{UT} - 12^\\mathrm{h}) + E' },
      {
        k: 'p',
        text: {
          en: 'and your own hour angle differs from it by exactly your longitude \\(\\lambda\\), counted positive to the east:',
          cs: 'a váš vlastní hodinový úhel se od něj liší přesně o vaši zeměpisnou délku \\(\\lambda\\), počítanou kladně na východ:',
        },
      },
      { k: 'math', tex: 't = \\mathrm{GHA} + \\lambda' },
      { k: 'fig', id: 'hourAngle' },
      {
        k: 'sub',
        fn: (d, s) =>
          `t = ${A(d.sky.solar.gha)} + (${A(s.lon)}) = ${A(d.sky.lha)}`,
      },
      {
        k: 'p',
        text: {
          en: 'At local apparent noon the sun crosses your meridian, so \\(t = 0\\) and the longitude falls straight out:',
          cs: 'V místní pravé poledne prochází Slunce vaším poledníkem, takže \\(t = 0\\) a zeměpisná délka vypadne přímo:',
        },
      },
      {
        k: 'math',
        tex: '\\lambda = -\\mathrm{GHA}_{\\text{LAN}} = 15^\\circ\\!/\\mathrm{h} \\cdot (12^\\mathrm{h} - \\mathrm{UT}_{\\text{LAN}}) - E',
        big: true,
      },
      {
        k: 'note',
        kind: 'bad',
        text: {
          en: 'Two things in that line must be told to you, and neither is in the sky: \\(\\mathrm{UT}_{\\text{LAN}}\\), from a chronometer that has held Greenwich time across an ocean, and \\(E\\), from an almanac. The clock was necessary. It was never sufficient.',
          cs: 'Dvě věci v té řádce vám musí někdo sdělit a ani jedna není na obloze: \\(\\mathrm{UT}_{\\text{LAN}}\\) z chronometru, který udržel greenwichský čas přes celý oceán, a \\(E\\) z almanachu. Hodiny byly nutné. Nikdy nebyly dostačující.',
        },
      },
      {
        k: 'p',
        text: {
          en: 'And a chronometer is not judged by whether it is right. It is judged by whether its rate is constant: you have it rated ashore, you apply that known rate at sea, and what is left to hurt you is only the part of the rate nobody knew about. Below, \\(\\Delta T_0\\) is the error it carried on the day \\(t_0\\) it was rated, and \\(\\dot{r}\\) is that unknown part of the daily rate.',
          cs: 'A chronometr se neposuzuje podle toho, jestli jde přesně. Posuzuje se podle toho, jestli má stálý chod: necháte si ho na břehu vyměřit, na moři ten známý chod započítáte, a uškodit vám může jen ta část chodu, o které nikdo nevěděl. Níže je \\(\\Delta T_0\\) chyba, kterou měl v den \\(t_0\\), kdy byl vyměřen, a \\(\\dot{r}\\) ta neznámá část denního chodu.',
        },
      },
      { k: 'math', tex: '\\Delta T(t) = \\Delta T_0 + \\dot{r} \\, (t - t_0)' },
      {
        k: 'sub',
        fn: (d, s) => {
          const days = daysBetween(s.departureDate, d.now);
          if (days < 0.5) return null;
          // One decimal on the days, so that the line actually multiplies out:
          // rounding 42.7 to 43 would leave the arithmetic visibly wrong.
          return `\\Delta T = ${N(s.clockErrorSec, 1)}\\,\\text{s} + ${N(s.clockRateSecPerDay, 3)}\\,\\text{s/d} \\times ${N(days, 2)}\\,\\text{d} = ${N(d.clockErrorSec, 1)}\\,\\text{s}`;
        },
        empty: {
          en: 'Give the watch a departure date in the rail and this line fills in as the days accumulate.',
          cs: 'Zadejte v panelu datum vyplutí a tato řádka se doplní, jak budou přibývat dny.',
        },
      },
      {
        k: 'note',
        text: {
          en: 'That is what the £20,000 actually bought. Half a degree on a voyage to the West Indies is two minutes of time; over a six-week passage it is a rate held to under three seconds a day, in a damp cabin swinging through forty degrees of temperature. H4 held a twelfth of a second.',
          cs: 'Přesně za tohle se platilo těch 20 000 liber. Půl stupně na plavbě do Západní Indie jsou dvě minuty času; na šestitýdenní plavbě to znamená udržet chod pod třemi sekundami denně, ve vlhké kajutě houpající se čtyřiceti stupni teplotních změn. H4 držely dvanáctinu sekundy.',
        },
      },
      {
        k: 'p',
        text: {
          en: 'Finding \\(\\mathrm{UT}_{\\text{LAN}}\\) by watching for the highest altitude does not work, because near culmination the altitude is flat. Half a minute of reading error puts the moment of the maximum one to five minutes of time out of place — one when the sun climbs nearly overhead, five when it culminates low — and a minute of time is fifteen miles of longitude at the equator. Equal altitudes finds it instead. The sun passes each altitude twice, and noon lies halfway between:',
          cs: 'Hledat \\(\\mathrm{UT}_{\\text{LAN}}\\) vyčkáváním na nejvyšší výšku nefunguje, protože v okolí kulminace je výška plochá. Půl úhlové minuty chyby odečtu posune okamžik vrcholu o jednu až pět minut času — o jednu, když Slunce vystoupá téměř do nadhlavníku, o pět, když kulminuje nízko — a minuta času je patnáct mil zeměpisné délky na rovníku. Místo toho slouží metoda stejných výšek. Slunce projde každou výškou dvakrát a poledne leží přesně uprostřed:',
        },
      },
      { k: 'math', tex: '\\mathrm{LAN} = \\dfrac{T_1 + T_2}{2} - \\Delta' },
      {
        k: 'math',
        tex: '\\Delta = \\dfrac{\\Delta\\delta}{2}\\left(\\dfrac{\\tan\\varphi}{\\sin t} - \\dfrac{\\tan\\delta}{\\tan t}\\right)',
      },
      {
        k: 'p',
        text: {
          en: '\\(\\Delta\\) is the equation of equal altitudes. \\(\\Delta\\delta\\) is how far the declination moved between the two sights — it moves, so the midpoint is not quite noon — and \\(t\\) here is the sun’s hour angle at either of them, which is half the interval between them turned into an angle at fifteen degrees an hour. Note what it needs — the latitude. That is why a navigator works the noon latitude out first, and then the longitude.',
          cs: '\\(\\Delta\\) je rovnice stejných výšek. \\(\\Delta\\delta\\) je to, o kolik se mezi oběma měřeními posunula deklinace — posune se, a proto střed není tak docela poledne — a \\(t\\) je zde hodinový úhel Slunce při kterémkoli z nich, tedy polovina intervalu mezi nimi převedená na úhel patnácti stupni za hodinu. Všimněte si, co k tomu potřebuje — zeměpisnou šířku. Proto navigátor nejdřív spočítá polední šířku a teprve pak délku.',
        },
      },
      {
        k: 'sub',
        fn: (d, s) => {
          const e = d.logResult.equalAlt;
          if (!e) return null;
          const p = e.pair;
          // Both inputs are shown fine enough for the line to multiply out at
          // the tenth of an arcminute its answer is given to. A tenth of a
          // second of time is 0.025' of longitude; the equation of time as an
          // angle rather than as minutes of time is another 0.05'. Quoted in
          // whole seconds and tenths of a minute, as this line first was, the
          // two roundings came to most of an arcminute and it visibly did not
          // add up -- which is worse than useless in a derivation.
          const E = e.eotMin / 4; // minutes of time -> degrees of hour angle
          return `\\lambda = 15^\\circ\\!/\\mathrm{h}\\cdot(12^\\mathrm{h} - \\text{${fmtClockTenths(e.lanChrono)}}) - (${E < 0 ? '-' : '+'}${A(Math.abs(E))}) = ${LON(e.lon)}`;
        },
        empty: {
          en: 'Take a morning sight in the simulation, then watch the sun back down to it, and this line fills in.',
          cs: 'Změřte v simulaci dopolední výšku, pak sledujte Slunce zpátky dolů na ni — a tato řádka se doplní.',
        },
      },
    ],
  },

  // =====================================================================
  {
    id: 'crossing',
    title: { en: 'Crossing two sights', cs: 'Zkřížení dvou měření' },
    tag: { en: 'a point, not a line', cs: 'bod, ne přímka' },
    blocks: [
      {
        k: 'p',
        text: {
          en: 'A noon sight is a special case, and a generous one: it hands you a latitude directly and asks nothing of the clock. The general method asks a different question. Guess where you are — an assumed position, conventionally at a round degree, because that is what made the tables easy — and work out what the altitude *would* be there. Call that one \\(H_c\\), the computed altitude, against the \\(H_o\\) you actually observed.',
          cs: 'Polední měření je zvláštní a velkorysý případ: rovnou vám dá šířku a na hodinách nežádá nic. Obecná metoda se ptá jinak. Odhadněte, kde jste — domnělá pozice, obvykle v celých stupních, protože s tou se dobře počítalo z tabulek — a spočítejte, jaká *by tam* výška byla. Označme ji \\(H_c\\), výška vypočtená, proti \\(H_o\\), kterou jste opravdu naměřili.',
        },
      },
      { k: 'math', tex: 'p = H_o - H_c', big: true },
      {
        k: 'p',
        text: {
          en: 'The difference \\(p\\) is the **intercept**, in minutes of arc and therefore in nautical miles. It is how far the ship lies toward the sun from your guess, or away from it, measured along the sun’s bearing \\(Z_n\\). The line of position runs at right angles to that bearing, and it is the circle of the first section arriving a second time: the bearing points at the GP, which is that circle’s centre, and a tangent stands at right angles to its radius.',
          cs: 'Rozdíl \\(p\\) je **intercept**, v úhlových minutách, a tedy v námořních mílích. Udává, o kolik leží loď od vašeho odhadu směrem ke Slunci, nebo od něj, měřeno podél náměru Slunce \\(Z_n\\). Poziční linie vede kolmo na tento směr a je to kružnice z první části, která přichází podruhé: náměr míří na podsluneční bod, tedy do středu té kružnice, a tečna stojí kolmo na její poloměr.',
        },
      },
      {
        k: 'p',
        text: {
          en: 'Measure east and north from the assumed position in nautical miles — \\(x\\) to the east, \\(y\\) to the north — and a line of position is nothing but',
          cs: 'Měřte od domnělé pozice na východ a na sever v námořních mílích — \\(x\\) na východ, \\(y\\) na sever — a poziční linie není nic jiného než',
        },
      },
      { k: 'math', tex: 'x \\sin Z_n + y \\cos Z_n = p', big: true },
      {
        k: 'p',
        text: {
          en: 'so crossing two sights is a pair of linear equations, and the determinant is \\(\\sin(Z_{n1} - Z_{n2})\\). Two sights on the same bearing give a determinant of zero and no fix at all: the lines are parallel. A navigator calls that a poor cut, and the remedy is to take the second sight hours away from the first, when the sun has moved round the sky.',
          cs: 'takže zkřížení dvou měření jsou dvě lineární rovnice a determinant je \\(\\sin(Z_{n1} - Z_{n2})\\). Dvě měření ve stejném směru dají nulový determinant a žádnou pozici: ty dvě linie jsou rovnoběžné. Námořník tomu říká špatné protnutí a lékem je změřit druhou výšku o hodiny později, až Slunce obejde oblohu.',
        },
      },
      {
        k: 'sub',
        fn: (d) => {
          const c = d.cross;
          if (!c || !c.enough || c.poorCut) return null;
          const [a, b] = c.lines;
          return `\\det = \\sin(${A(a.zn)} - ${A(b.zn)}) = ${N(sind(a.zn - b.zn), 3)} \\qquad p_1 = ${N(a.p)}\\,\\text{nm} \\qquad p_2 = ${N(b.p)}\\,\\text{nm}`;
        },
        empty: {
          en: 'Take two sights hours apart in the simulation and this line fills in with their intercepts.',
          cs: 'Změřte v simulaci dvě výšky s odstupem hodin a tato řádka se doplní jejich intercepty.',
        },
      },
      {
        k: 'note',
        kind: 'good',
        text: {
          en: 'This gives a position from the sun alone, with no noon in it anywhere — and it is still a clock that carries the longitude. Both sights are reduced against a GP whose longitude came from the chronometer, so the crossing inherits the clock error exactly as the noon sight does. Changing the method never changes the arithmetic of the Earth.',
          cs: 'Tohle dá pozici z pouhého Slunce a bez jakéhokoli poledne — a délku stále nese jedině hodinami. Obě měření se počítají vůči podslunečnímu bodu, jehož délka přišla z chronometru, takže protnutí zdědí chybu hodin úplně stejně jako polední měření. Změna metody nikdy nezmění aritmetiku Země.',
        },
      },
    ],
  },

  // =====================================================================
  {
    id: 'sensitivity',
    title: { en: 'Why one is free and the other is not', cs: 'Proč je jedno zadarmo a druhé ne' },
    tag: { en: 'one derivative', cs: 'jedna derivace' },
    blocks: [
      {
        k: 'p',
        text: {
          en: 'Differentiate the altitude equation with respect to the hour angle, holding the position and the declination fixed, and one line answers the whole question:',
          cs: 'Zderivujte rovnici pro výšku podle hodinového úhlu při pevné poloze a konstantní deklinaci — a jediná řádka zodpoví celou otázku:',
        },
      },
      { k: 'math', tex: '\\frac{\\partial H}{\\partial t} = \\cos\\varphi \\, \\sin Z_n', big: true },
      {
        k: 'p',
        text: {
          en: 'On the meridian \\(Z_n = 180^\\circ\\), \\(\\sin Z_n = 0\\), and the derivative vanishes: a clock error cannot reach the sight at all. On the prime vertical — the great circle through your zenith and the east and west points, so the sun bearing 090 or 270 — \\(|\\sin Z_n| = 1\\) and it is at its maximum: the sight is nothing but the clock. The same instrument, the same sun, two hours apart.',
          cs: 'Na poledníku je \\(Z_n = 180^\\circ\\), \\(\\sin Z_n = 0\\) a derivace mizí: chyba hodin se k měření vůbec nedostane. Na prvním vertikálu — na hlavní kružnici procházející vaším zenitem a východním a západním bodem obzoru, tedy při náměru Slunce 090 nebo 270 — je \\(|\\sin Z_n| = 1\\) a derivace je maximální: měření pak není nic než hodiny. Týž přístroj, totéž Slunce, o dvě hodiny jinde.',
        },
      },
      {
        k: 'sub',
        fn: (d, s) =>
          `\\frac{\\partial H}{\\partial t} = \\cos(${A(s.lat)}) \\cdot \\sin(${tex(fmtAngle(d.sky.Az))}) = ${N(d.sens, 3)}`,
      },
      {
        k: 'p',
        text: {
          en: 'In distance, an error of \\(\\Delta T\\) on the chronometer becomes a displacement in longitude, and that difference of longitude becomes a *departure* — the east-west distance it actually comes to, which shrinks with the cosine of the latitude:',
          cs: 'Ve vzdálenosti se chyba \\(\\Delta T\\) na chronometru promění nejprve v posun zeměpisné délky a ten pak v *departure* — ve vzdálenost ve směru východ–západ, které ten rozdíl délky opravdu odpovídá a která se krátí s kosinem šířky:',
        },
      },
      {
        k: 'math',
        tex: '\\Delta\\lambda = 15^\\circ\\!/\\mathrm{h} \\cdot \\Delta T \\qquad \\text{dep} = 60\\,\\Delta\\lambda\\,\\cos\\varphi \\;\\;[\\text{nm}]',
      },
      {
        k: 'sub',
        fn: (d, s) =>
          `1\\,\\text{s} \\rightarrow ${N(NM_PER_CLOCK_SECOND * cosd(s.lat), 3)}\\,\\text{nm} \\qquad 1\\,\\text{min} \\rightarrow ${N(15 * cosd(s.lat), 1)}\\,\\text{nm} \\qquad 1\\,\\text{h} \\rightarrow ${Math.round(900 * cosd(s.lat))}\\,\\text{nm}`,
      },
      {
        k: 'note',
        text: {
          en: 'So the same instrument, the same sun and the same chronometer give a longitude that is worth everything at one hour of the day and nothing at another. A navigator did not take sights when it suited him. He took them for longitude when the sun was near the prime vertical, for latitude when it was on his meridian, and carried the first forward to the second — which is the whole of the day’s routine, and it comes out of this one derivative.',
          cs: 'Týž přístroj, totéž Slunce a týž chronometr tedy dají délku, která v jednu denní dobu platí všechno a v jinou nic. Navigátor neměřil, kdy se mu zachtělo. Pro délku měřil, když bylo Slunce blízko prvního vertikálu, pro šířku, když bylo na jeho poledníku, a první měření přenášel k druhému — a v tom je celá denní rutina, která plyne z této jedné derivace.',
        },
      },
    ],
  },
];
