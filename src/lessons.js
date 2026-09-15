// Guided lessons: what turns a sandbox into something you can learn from alone.
//
// Each step is data. `state` is a patch applied to the store, `tab` and `view`
// put the right thing on screen, `panel` marks one panel so the eye knows where
// to go, and `text` says what to notice. Nothing is gated -- a reader can step
// forward at their own pace, or leave and fiddle and come back.

// A reader may step past the part where they were asked to do something. The
// lesson still has to be able to show its point, so a step can make sure the
// log holds what the next sentence talks about -- without touching anything
// they did for themselves.

/** Log sights at these offsets from local noon, if the log is empty. */
const ensureSights = (store, hours) => {
  const d = store.get();
  if (d.observations.length) return;
  for (const hr of hours) store.addSight(new Date(d.lan.getTime() + hr * 3600000));
};

/** Put the passage on a known footing, so a step can quote a real figure. */
const ensureVoyage = (store, carryChronometer) => {
  store.applyRoute('trades');
  store.setIn('voyage', { carryChronometer });
};

/** Make sure an equal-altitude pair exists, by watching a morning sight down. */
const ensurePair = (store) => {
  const d = store.get();
  if (d.logResult.equalAlt) return;
  const morning = d.observations
    .filter((o) => o.Az < 180 && o.Ho > 5)
    .sort((a, b) => a.t - b.t)[0];
  if (morning) store.matchSight(morning);
};

export const lessons = [
  // =====================================================================
  {
    id: 'noon',
    title: { en: 'Latitude at noon', cs: 'Šířka v poledne' },
    blurb: {
      en: 'The easy half, and why it is easy. Twenty minutes with no clock at all.',
      cs: 'Ta snadná polovina a proč je snadná. Dvacet minut úplně bez hodin.',
    },
    steps: [
      {
        state: { scenario: 'equinox', clockErrorSec: 0, clockRateSecPerDay: 0, sights: [] },
        tab: 'simulation', view: 'dome', panel: 'p-sky',
        text: {
          en: 'We are on the equator, on the day of the equinox, and the sun is about to cross the meridian. The circle is your horizon and the dot at its centre is the point straight overhead — your zenith. Watch the dashed track: that is the sun’s path across the sky for the whole day.',
          cs: 'Jsme na rovníku, v den rovnodennosti, a Slunce se chystá projít poledníkem. Kružnice je váš obzor a tečka uprostřed je bod přímo nad hlavou — váš zenit. Sledujte čárkovanou dráhu: to je cesta Slunce po obloze za celý den.',
        },
      },
      {
        tab: 'simulation', view: 'dome', panel: 'p-sky',
        text: {
          en: 'Drag the day slider at the bottom. The sun climbs, slows, hangs, and falls. The green line from the horizon up to it is the altitude H, and the violet line from it to the zenith is the zenith distance z. They are the two pieces of one straight line, so they always add to ninety degrees.',
          cs: 'Táhněte posuvníkem dne dole. Slunce stoupá, zpomaluje, chvíli visí a klesá. Zelená čára od obzoru k němu je výška H a fialová od něj k zenitu je zenitová vzdálenost z. Jsou to dva kusy jedné přímky, takže vždycky dávají dohromady devadesát stupňů.',
        },
      },
      {
        state: { secondOfDay: null },
        tab: 'simulation', view: 'sextant', panel: 'p-sky',
        text: {
          en: 'Now take the sight yourself. Swing the arc until the sun drops into the telescope field, then drag inside the field to bring its lower edge exactly down onto the horizon. When it sits on the line, log it.',
          cs: 'Teď to změřte sami. Otáčejte obloukem, dokud Slunce nespadne do zorného pole dalekohledu, pak tažením uvnitř pole stáhněte jeho spodní okraj přesně na obzor. Jakmile sedí na čáře, zapište to.',
        },
      },
      {
        tab: 'simulation', view: 'dome', panel: 'p-workup',
        act: (store) => ensureSights(store, [0]),
        text: {
          en: 'There is your latitude. The sun’s declination came from the almanac — from the date, and the date alone — and the zenith distance came off the arc. Add them and you have it. Nowhere in that sum is there a time.',
          cs: 'A tady je vaše šířka. Deklinace Slunce přišla z ročenky — z data, a jen z data — a zenitová vzdálenost z oblouku. Sečtěte je a je to. Nikde v tom součtu není žádný čas.',
        },
      },
      {
        state: { clockErrorSec: 3600 },
        tab: 'simulation', panel: 'p-workup',
        text: {
          en: 'To prove it: the chronometer has just been put a full hour wrong. The longitude jumps nine hundred miles. The latitude moves a mile and a half — and only because the declination was looked up an hour late, which at the equinox is as fast as it ever changes. The sight itself was self-timing: you watched the altitude stop rising, and the sun told you when. That is why latitude was never the problem.',
          cs: 'A důkaz: chronometr právě dostal chybu celou hodinu. Délka poskočí o devět set mil. Šířka se pohne o míli a půl — a jen proto, že se deklinace vyhledala o hodinu později, což je o rovnodennosti její nejrychlejší změna vůbec. Samo měření si čas určilo: čekali jste, až výška přestane růst, a Slunce vám řeklo kdy. Proto šířka nikdy nebyla ten problém.',
        },
      },
    ],
  },

  // =====================================================================
  {
    id: 'degeneracy',
    title: { en: 'Why the sky hides the longitude', cs: 'Proč obloha skrývá délku' },
    blurb: {
      en: 'Not difficult. Impossible — and the reason is a symmetry.',
      cs: 'Není to těžké. Je to nemožné — a důvodem je symetrie.',
    },
    steps: [
      {
        state: { clockErrorSec: 0, clockRateSecPerDay: 0 },
        tab: 'theory', panel: null,
        text: {
          en: 'Scroll to the section called Longitude. The first thing it says is that longitude has no equator: the prime meridian is a mark painted on a turning body, and nothing in the sky points at it.',
          cs: 'Sjeďte k části Zeměpisná délka. První, co říká, je že délka nemá rovník: nultý poledník je značka namalovaná na otáčejícím se tělese a nic na obloze na něj neukazuje.',
        },
      },
      {
        tab: 'theory', panel: null,
        text: {
          en: 'Find the picture of three Earths. Three ships at three longitudes, each at its own local noon, each reading the same altitude off the same instrument. Cover the magenta with your thumb and the three pictures are one picture.',
          cs: 'Najděte obrázek tří Zemí. Tři lodě na třech délkách, každá ve svém místním poledni, každá naměří tutéž výšku týmž přístrojem. Zakryjte palcem purpurové a ty tři obrázky jsou jeden obrázek.',
        },
      },
      {
        tab: 'theory', panel: null,
        text: {
          en: 'This is exact, not approximate. Turning the Earth while advancing the clock changes nothing you can measure. So no observation, however careful, can tell those three ships apart — and the only thing that can is a clock you brought from somewhere else.',
          cs: 'Je to přesné, ne přibližné. Pootočit Zemí a zároveň posunout hodiny nezmění nic, co lze změřit. Žádné pozorování, jakkoli pečlivé, ty tři lodě nerozliší — a jediné, co je rozliší, jsou hodiny, které jste si odněkud přivezli.',
        },
      },
    ],
  },

  // =====================================================================
  {
    id: 'equalalt',
    title: { en: 'Longitude by equal altitudes', cs: 'Délka metodou stejných výšek' },
    blurb: {
      en: 'Take the sights yourself, and find the moment of noon properly.',
      cs: 'Změřte si to sami a najděte okamžik poledne pořádně.',
    },
    steps: [
      {
        state: { scenario: 'jamaica', sights: [], clockErrorSec: 0, clockRateSecPerDay: 0 },
        tab: 'simulation', view: 'dome', panel: 'p-log', asks: true,
        text: {
          en: 'A new day, off Jamaica, and a chronometer that is right for now. Longitude is the difference between your local time and Greenwich time, so what you need is the exact moment the sun crosses your meridian. Start by logging a sight about three hours before noon — move the day slider back and take one.',
          cs: 'Nový den u Jamajky a chronometr, který zatím jde přesně. Délka je rozdíl mezi vaším místním časem a greenwichským, takže potřebujete přesný okamžik, kdy Slunce projde vaším poledníkem. Začněte měřením asi tři hodiny před polednem — vraťte posuvník dne a jedno zapište.',
        },
      },
      {
        tab: 'simulation', panel: 'p-log',
        act: (store) => ensureSights(store, [-3, -0.15, 0.15]),
        text: {
          en: 'Now the trick that makes it work. In the log, press “watch it down” on that morning sight. That is the real method: clamp the sextant at the angle you measured, wait through the afternoon, and note the moment the sun comes back down to exactly the same altitude. Noon is halfway between.',
          cs: 'Teď ten trik, který to celé umožňuje. V deníku stiskněte u dopoledního měření „počkat na návrat“. To je ta skutečná metoda: zaaretujte sextant na naměřeném úhlu, počkejte přes odpoledne a zapište okamžik, kdy se Slunce vrátí přesně na tutéž výšku. Poledne je přesně uprostřed.',
        },
      },
      {
        tab: 'simulation', panel: 'p-workup',
        act: (store) => { ensureSights(store, [-3, -0.15, 0.15]); ensurePair(store); },
        text: {
          en: 'The work-up has found noon and turned it into a longitude. Notice the small correction called the equation of equal altitudes: the sun’s declination crept between the two sights, so the midpoint is not quite noon. And notice that it needed your latitude — which is why a navigator works the latitude out first.',
          cs: 'Výpočet našel poledne a proměnil ho v zeměpisnou délku. Všimněte si malé opravy zvané rovnice stejných výšek: mezi oběma měřeními se posunula deklinace, takže střed není tak docela poledne. A všimněte si, že potřebovala vaši šířku — proto navigátor počítá nejdřív šířku.',
        },
      },
      {
        tab: 'simulation', panel: 'p-workup',
        act: (store) => { ensureSights(store, [-3, -0.15, 0.15]); ensurePair(store); },
        text: {
          en: 'Compare the two bars. One is what you get by calling the highest sight noon; the other is what equal altitudes gives. Same sextant, same sun, same chronometer — only a better way of asking when noon was. Near culmination the altitude is flat, so the peak is easy to measure and its *moment* is not.',
          cs: 'Porovnejte ty dva sloupce. Jeden je to, co dostanete, když za poledne prohlásíte nejvyšší měření; druhý je metoda stejných výšek. Týž sextant, totéž Slunce, týž chronometr — jen lepší způsob, jak se zeptat, kdy bylo poledne. V okolí kulminace je výška plochá, takže vrchol se měří snadno, ale jeho *okamžik* ne.',
        },
      },
    ],
  },

  // =====================================================================
  {
    id: 'clock',
    title: { en: 'What a wrong clock costs', cs: 'Co stojí špatné hodiny' },
    blurb: {
      en: 'Three seconds a day, for six weeks, for twenty thousand pounds.',
      cs: 'Tři sekundy denně, šest týdnů, za dvacet tisíc liber.',
    },
    steps: [
      {
        state: { scenario: 'jamaica' },
        tab: 'simulation', panel: 'p-workup',
        act: (store) => { ensureSights(store, [-3, -0.15, 0.15]); ensurePair(store); },
        text: {
          en: 'Back off Jamaica, with the log you have. Now take hold of the chronometer error slider in the rail and pull it. Watch the two bars: the longitude runs away and the latitude does not move at all. That asymmetry is the whole subject.',
          cs: 'Zpátky u Jamajky, s deníkem, který máte. Vezměte v panelu posuvník chyby chronometru a zatáhněte za něj. Sledujte oba sloupce: délka utíká a šířka se vůbec nehne. Ta nesouměrnost je celé téma.',
        },
      },
      {
        state: { scenario: 'act' },
        tab: 'simulation', panel: null,
        text: {
          en: 'A watch is not really judged by its error, though. It is judged by its *rate*: you have it rated ashore, you apply that known rate at sea, and only the part nobody knew about hurts you. This preset is a watch keeping the rate the Longitude Act demanded — under three seconds a day, for six weeks.',
          cs: 'Hodiny se ale doopravdy neposuzují podle chyby. Posuzují se podle *chodu*: necháte si je na břehu vyměřit, na moři ten známý chod započítáte, a uškodí vám jen ta část, o které nikdo nevěděl. Tenhle scénář jsou hodiny s chodem, jaký žádal zákon o délce — necelé tři sekundy denně, po šest týdnů.',
        },
      },
      {
        state: { scenario: 'act' },
        tab: 'voyage', panel: null,
        act: (store) => ensureVoyage(store, true),
        text: {
          en: 'And here is that same watch on a passage to the West Indies. It arrives, and the landfall is a couple of dozen miles from the harbour — the rate had only three weeks to work in, not the six the prize allowed, so the ship comes in comfortably inside half a degree. Now untick “carry a chronometer” and sail it again.',
          cs: 'A tady jsou tytéž hodiny na plavbě do Západní Indie. Doplují, a přistání je pár desítek mil od přístavu — chod měl na práci jen tři týdny, ne šest, které cena připouštěla, takže se loď vejde pohodlně pod půl stupně. Teď odškrtněte „vézt chronometr“ a proplujte to znovu.',
        },
      },
      {
        tab: 'voyage', panel: null,
        act: (store) => ensureVoyage(store, false),
        text: {
          en: 'Without one, the ship never finds the island. Look where it ends up: on very nearly the right parallel, and hundreds of miles along it. The noon sight fixed the latitude every single day of the passage and could do nothing whatever about the longitude. That is the problem, and a clock is the answer to it.',
          cs: 'Bez něj loď ostrov nikdy nenajde. Podívejte, kde skončí: skoro přesně na správné rovnoběžce a stovky mil podél ní. Polední měření určilo šířku každý jediný den plavby a s délkou nezmohlo vůbec nic. To je ten problém — a hodiny jsou odpověď na něj.',
        },
      },
    ],
  },
];

export const lessonById = (id) => lessons.find((l) => l.id === id) || null;
