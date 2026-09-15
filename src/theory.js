// The theory tab, as data. Prose sits next to its translation; the `sub`
// blocks are functions of the derived state, so every equation on the page can
// be shown again with the figures from the sight currently on the timeline.

import { fmtAngle, fmtNumber, cosd, sind, degToNm } from './core/angles.js';
import { NM_PER_CLOCK_SECOND } from './core/horizon.js';
import { fmtClock, daysBetween } from './core/time.js';
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
          cs: 'V každém okamžiku stojí Slunce v nadhlavníku právě nad jediným místem na Zemi — nad svým podslunečním bodem. Výška, kterou naměříte, a vaše vzdálenost od toho místa jsou totéž číslo, jen obrácené naruby.',
        },
      },
      { k: 'math', tex: 'z = 90^\\circ - H_o' },
      {
        k: 'sub',
        // Not fmtNm here: its thousands separator would come through tex() as
        // a decimal comma, and bare letters in maths mode set italic.
        fn: (d) =>
          `z = 90^\\circ - ${A(d.sight.Ho)} = ${A(d.z)} = ${Math.round(degToNm(d.z))}\\,\\text{nm}`,
      },
      {
        k: 'p',
        text: {
          en: 'So a single sight puts you somewhere on a circle drawn round the GP, and never at a point. Everything that follows is working out where that circle lies.',
          cs: 'Jediné měření vás tedy umístí někam na kružnici kolem podslunečního bodu, nikdy do jednoho bodu. Všechno ostatní je hledání toho, kde ta kružnice leží.',
        },
      },
      {
        k: 'p',
        text: {
          en: 'The almanac gives the GP in two independent halves. Its latitude is the sun’s declination, which is a function of the date and drifts by at most a minute of arc an hour. Its longitude is set by the Earth’s rotation, at fifteen degrees an hour. Dates are cheap. Time is not.',
          cs: 'Ročenka udává podsluneční bod ve dvou nezávislých polovinách. Jeho šířka je deklinace Slunce, funkce data, která se mění nejvýš o jednu úhlovou minutu za hodinu. Jeho délku určuje rotace Země, patnáct stupňů za hodinu. Datum je laciné. Čas nikoli.',
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
          en: 'Three points on the celestial sphere carry the whole problem: the elevated pole P, your zenith Z, and the sun X. Join them with great circles and you have the navigational triangle. Drag the sphere to turn it.',
          cs: 'Celý problém nesou tři body na nebeské sféře: povýšený pól P, váš zenit Z a Slunce X. Spojte je hlavními kružnicemi a máte navigační trojúhelník. Tažením sférou otočíte.',
        },
      },
      { k: 'fig', id: 'pzx3d' },
      {
        k: 'p',
        text: {
          en: 'Its three sides are exactly the three quantities a sight is about.',
          cs: 'Jeho tři strany jsou přesně ty tři veličiny, o které v měření jde.',
        },
      },
      {
        k: 'math',
        tex: 'PZ = 90^\\circ-\\varphi \\qquad PX = 90^\\circ-\\delta \\qquad ZX = z = 90^\\circ-H',
      },
      { k: 'fig', id: 'pzxFlat' },
      {
        k: 'p',
        text: {
          en: 'The angle at P is the local hour angle t — how far the sun stands from your meridian, and therefore a measure of time. The angle at Z is the azimuth, the bearing you would take of the sun. The spherical cosine rule for sides ties them together:',
          cs: 'Úhel při P je místní hodinový úhel t — jak daleko stojí Slunce od vašeho poledníku, tedy míra času. Úhel při Z je azimut, tedy směr, ve kterém Slunce vidíte. Sférická kosinová věta pro strany je spojuje dohromady:',
        },
      },
      { k: 'math', tex: '\\cos ZX = \\cos PZ \\, \\cos PX + \\sin PZ \\, \\sin PX \\, \\cos P' },
      {
        k: 'p',
        text: {
          en: 'Substitute the three sides and use \\(\\cos(90^\\circ-x)=\\sin x\\), and out falls the equation every sight reduction in the world rests on:',
          cs: 'Dosaďte tři strany a použijte \\(\\cos(90^\\circ-x)=\\sin x\\) — a vypadne rovnice, na které stojí každý navigační výpočet na světě:',
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
          cs: 'V té řádce se skrývají tři neznámé: \\(\\varphi\\), \\(\\delta\\) a \\(t\\). Ročenka vám dá \\(\\delta\\) ze samotného data. Zbytek této stránky jsou dva různé způsoby, jak se zbavit ještě jedné.',
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
          en: 'The zenith distance is simply the difference of two latitudes — yours and the sun’s. Which way round depends only on which side of your zenith the sun passed, and you can see that:',
          cs: 'Zenitová vzdálenost je prostě rozdíl dvou šířek — vaší a sluneční. Na kterou stranu, závisí jen na tom, kterou stranou zenitu Slunce prošlo, a to je vidět:',
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
          en: 'The same fact arrives by a second route. The elevated pole stands at an altitude equal to your latitude, which is why one sight of Polaris is a latitude and nothing else:',
          cs: 'Tentýž fakt přichází ještě druhou cestou. Povýšený pól stojí ve výšce rovné vaší šířce — proto je jediné zaměření Polárky rovnou zeměpisnou šířkou:',
        },
      },
      { k: 'math', tex: 'H_P = \\varphi' },
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
          en: 'What the sky does offer is the sun’s hour angle at Greenwich, which is pure rotation:',
          cs: 'Co obloha nabízí, je hodinový úhel Slunce vůči Greenwichi, a to je čirá rotace:',
        },
      },
      { k: 'math', tex: '\\mathrm{GHA} = 15^\\circ\\!/\\mathrm{h} \\cdot (\\mathrm{UT} - 12^\\mathrm{h}) + E' },
      {
        k: 'p',
        text: {
          en: 'and your own hour angle differs from it by exactly your longitude:',
          cs: 'a váš vlastní hodinový úhel se od něj liší přesně o vaši zeměpisnou délku:',
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
          cs: 'Dvě věci v té řádce vám musí někdo sdělit a ani jedna není na obloze: \\(\\mathrm{UT}_{\\text{LAN}}\\) z chronometru, který udržel greenwichský čas přes celý oceán, a \\(E\\) z ročenky. Hodiny byly nutné. Nikdy nebyly dostačující.',
        },
      },
      {
        k: 'p',
        text: {
          en: 'And a chronometer is not judged by whether it is right. It is judged by whether its rate is constant: you have it rated ashore, you apply that known rate at sea, and what is left to hurt you is only the part of the rate nobody knew about.',
          cs: 'A chronometr se neposuzuje podle toho, jestli jde přesně. Posuzuje se podle toho, jestli má stálý chod: necháte si ho na břehu vyměřit, na moři ten známý chod započítáte, a uškodit vám může jen ta část chodu, o které nikdo nevěděl.',
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
          en: 'Finding \\(\\mathrm{UT}_{\\text{LAN}}\\) by watching for the highest altitude does not work, because near culmination the altitude is flat: half a minute of reading error becomes a minute of time. Equal altitudes finds it instead. The sun passes each altitude twice, and noon lies halfway between:',
          cs: 'Hledat \\(\\mathrm{UT}_{\\text{LAN}}\\) vyčkáváním na nejvyšší výšku nefunguje, protože v okolí kulminace je výška plochá: půl úhlové minuty chyby odečtu se změní v minutu času. Místo toho slouží metoda stejných výšek. Slunce projde každou výškou dvakrát a poledne leží přesně uprostřed:',
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
          en: '\\(\\Delta\\) is the equation of equal altitudes: the declination moves between the two sights, so the midpoint is not quite noon. Note what it needs — the latitude. That is why a navigator works the noon latitude out first, and then the longitude.',
          cs: '\\(\\Delta\\) je rovnice stejných výšek: mezi oběma měřeními se posune deklinace, takže střed není tak docela poledne. Všimněte si, co k tomu potřebuje — zeměpisnou šířku. Proto navigátor nejdřív spočítá polední šířku a teprve pak délku.',
        },
      },
      {
        k: 'sub',
        fn: (d, s) => {
          const e = d.logResult.equalAlt;
          if (!e) return null;
          const p = e.pair;
          return `\\lambda = 15^\\circ\\!/\\mathrm{h}\\cdot(12^\\mathrm{h} - \\text{${fmtClock(e.lanChrono)}}) - ${SIGNED(e.eotMin, 'min')} = ${LON(e.lon)}`;
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
    id: 'sensitivity',
    title: { en: 'Why one is free and the other is not', cs: 'Proč je jedno zadarmo a druhé ne' },
    tag: { en: 'one derivative', cs: 'jedna derivace' },
    blocks: [
      {
        k: 'p',
        text: {
          en: 'Differentiate the altitude equation with respect to the hour angle, at constant declination, and one line answers the whole question:',
          cs: 'Zderivujte rovnici pro výšku podle hodinového úhlu při konstantní deklinaci — a jediná řádka zodpoví celou otázku:',
        },
      },
      { k: 'math', tex: '\\frac{\\partial H}{\\partial t} = \\cos\\varphi \\, \\sin Z_n', big: true },
      {
        k: 'p',
        text: {
          en: 'On the meridian \\(Z_n = 180^\\circ\\), \\(\\sin Z_n = 0\\), and the derivative vanishes: a clock error cannot reach the sight at all. On the prime vertical \\(|\\sin Z_n| = 1\\) and it is at its maximum: the sight is nothing but the clock. The same instrument, the same sun, two hours apart.',
          cs: 'Na poledníku je \\(Z_n = 180^\\circ\\), \\(\\sin Z_n = 0\\) a derivace mizí: chyba hodin se k měření vůbec nedostane. Na prvním vertikálu je \\(|\\sin Z_n| = 1\\) a derivace je maximální: měření pak není nic než hodiny. Týž přístroj, totéž Slunce, o dvě hodiny jinde.',
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
          en: 'In distance, an error of \\(\\Delta T\\) on the chronometer becomes',
          cs: 'Ve vzdálenosti se chyba \\(\\Delta T\\) na chronometru promění v',
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
          en: 'The Longitude Act of 1714 asked for half a degree on a voyage to the West Indies. Half a degree is two minutes of time; over a six-week passage that is a rate of three seconds a day, in a damp cabin swinging through forty degrees of temperature.',
          cs: 'Zákon o zeměpisné délce z roku 1714 žádal půl stupně na plavbě do Západní Indie. Půl stupně jsou dvě minuty času; na šestitýdenní plavbě to znamená tři sekundy denně — ve vlhké kajutě, houpající se čtyřiceti stupni teplotních změn.',
        },
      },
    ],
  },
];
