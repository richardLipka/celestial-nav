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

/** Make sure there is a round of lunars to talk about. */
const ensureLunars = (store) => {
  if (store.get().lunar.sights.length) return;
  if (store.get().lunar.usable.ok) store.addLunarRound();
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
          en: 'We are on the equator, on the day of the equinox, and the sun is about to cross your meridian — the line that runs from due north, over the point above your head, to due south. The circle is your horizon and the dot at its centre is the point straight overhead — your zenith. Watch the dashed track: that is the sun’s path across the sky for the whole day.',
          cs: 'Jsme na rovníku, v den rovnodennosti, a Slunce se chystá projít vaším poledníkem — čarou, která vede od severu přes bod nad vaší hlavou k jihu. Kružnice je váš obzor a tečka uprostřed je bod přímo nad hlavou — váš zenit. Sledujte čárkovanou dráhu: to je cesta Slunce po obloze za celý den.',
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
          en: 'Now take the sight yourself. Swing the arc until the sun drops into the telescope field, then drag inside the field to bring its lower limb — its bottom edge — exactly down onto the horizon. When it sits on the line, log it.',
          cs: 'Teď to změřte sami. Otáčejte obloukem, dokud Slunce nespadne do zorného pole dalekohledu, pak tažením uvnitř pole stáhněte jeho spodní okraj přesně na obzor. Jakmile sedí na čáře, zapište to.',
        },
      },
      {
        tab: 'simulation', view: 'dome', panel: 'p-workup',
        act: (store) => ensureSights(store, [0]),
        text: {
          en: 'There is your latitude. The sun’s declination — the latitude of the spot it is standing over — came from the almanac, from the date and the date alone, and the zenith distance came off the arc. Put the two together, minding which side of your zenith the sun passed, and you have it. Nowhere in that sum is there a time.',
          cs: 'A tady je vaše šířka. Deklinace Slunce — zeměpisná šířka místa, nad kterým Slunce stojí — přišla z almanachu, z data a jen z data, a zenitová vzdálenost z oblouku. Složte je dohromady podle toho, kterou stranou zenitu Slunce prošlo, a je to. Nikde v tom součtu není žádný čas.',
        },
      },
      {
        state: { clockErrorSec: 3600 },
        tab: 'simulation', panel: 'p-workup',
        text: {
          en: 'To prove it: the chronometer has just been put a full hour wrong. The longitude jumps nine hundred miles. The latitude moves one mile — and only because the declination was looked up an hour late, which at the equinox is as fast as it ever changes. The sight itself was self-timing: you watched the altitude stop rising, and the sun told you when. That is why latitude was never the problem.',
          cs: 'A důkaz: chronometr právě dostal chybu celou hodinu. Délka poskočí o devět set mil. Šířka se pohne o jednu míli — a jen proto, že se deklinace vyhledala o hodinu později, což je o rovnodennosti její nejrychlejší změna vůbec. Samo měření si čas určilo: čekali jste, až výška přestane růst, a Slunce vám řeklo kdy. Proto šířka nikdy nebyla ten problém.',
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
          en: 'Back off Jamaica, with the log you have. Now take hold of the chronometer error slider in the rail and pull it. Watch the two bars: the longitude runs away at a mile for every four seconds, while the latitude barely stirs — half a mile for a whole hour of error, and only because the declination was looked up late. More than a thousand to one, and that asymmetry is the whole subject.',
          cs: 'Zpátky u Jamajky, s deníkem, který máte. Vezměte v panelu posuvník chyby chronometru a zatáhněte za něj. Sledujte oba sloupce: délka utíká o míli za každé čtyři sekundy, zatímco šířka se sotva pohne — půl míle za celou hodinu chyby, a jen proto, že se deklinace vyhledala později. Víc než tisíc ku jedné, a ta nesouměrnost je celé téma.',
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
          en: 'And here is that same watch on a passage to the West Indies. It arrives, and the landfall is a couple of dozen miles from the harbour — the rate had only three and a half weeks to work in, not the six the prize allowed, so the ship comes in comfortably inside half a degree. Now untick “carry a chronometer” and sail it again.',
          cs: 'A tady jsou tytéž hodiny na plavbě do Západní Indie. Doplují, a přistání je pár desítek mil od přístavu — chod měl na práci jen tři a půl týdne, ne šest, které cena připouštěla, takže se loď vejde pohodlně pod půl stupně. Teď odškrtněte „vézt chronometr“ a proplujte to znovu.',
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

  // =====================================================================
  {
    id: 'lunars',
    title: { en: 'The clock in the sky', cs: 'Hodiny na obloze' },
    blurb: {
      en: 'The other answer to the longitude — the one that almost worked.',
      cs: 'Druhá odpověď na problém délky — ta, která skoro fungovala.',
    },
    steps: [
      {
        state: { scenario: 'jamaica', clockErrorSec: 0, clockRateSecPerDay: 0, lunarSights: [] },
        tab: 'lunars', panel: 'p-lunsky',
        text: {
          en: 'Suppose you have no chronometer at all. There is still a clock overhead: the moon moves its own width against the background every hour, so the angle between the moon and the sun is a function of absolute time — the same function for every ship on Earth. Measure that angle and the almanac tells you the hour at Greenwich.',
          cs: 'Dejme tomu, že nemáte vůbec žádný chronometr. Přesto máte hodiny nad hlavou: Měsíc se za hodinu posune proti pozadí o svůj vlastní průměr, takže úhel mezi Měsícem a Sluncem je funkcí absolutního času — a je to tatáž funkce pro každou loď na světě. Změřte ten úhel a almanach vám řekne, kolik je v Greenwichi.',
        },
      },
      {
        tab: 'lunars', panel: 'p-lunlog',
        act: (store) => ensureLunars(store),
        text: {
          en: 'A round of five has been taken, three minutes apart. Each is three readings at once — the moon’s altitude, the sun’s, and the distance between their near limbs — which meant three observers and one voice counting. Look at the spread: the same sky, five answers, and a minute or so of Greenwich time between the best of them and the worst. That scatter is the observer, and averaging is the only thing to be done about it.',
          cs: 'Byla změřena série pěti měření po třech minutách. Každé jsou tři odečty naráz — výška Měsíce, výška Slunce a vzdálenost jejich přivrácených okrajů — což znamenalo tři pozorovatele a jeden hlas, který odpočítával. Podívejte se na rozptyl: tatáž obloha, pět odpovědí a zhruba minuta greenwichského času mezi tou nejlepší a nejhorší. Ten rozptyl je pozorovatel a jediné, co s ním jde dělat, je průměrovat.',
        },
      },
      {
        tab: 'lunars', panel: 'p-lunwork',
        act: (store) => ensureLunars(store),
        text: {
          en: 'Now the reduction, and the reason lunars were dreaded. Refraction — the air bending the light on its way down — lifts both bodies; parallax — your standing on the surface and not at the centre of the Earth — drops the moon by a whole degree. Neither changes the angle at the zenith between them, and that is the hinge the clearing turns on. Notice how far the clearing moves the measured distance — and that every line of it was done in logarithms, by hand, twice.',
          cs: 'A teď výpočet — a důvod, proč se lunárních vzdáleností báli. Refrakce — ohyb světla ve vzduchu cestou dolů — zvedá obě tělesa, paralaxa — to, že stojíte na povrchu, a ne ve středu Země — snižuje Měsíc o celý stupeň. Ani jedno nemění úhel u zenitu mezi nimi, a právě o ten se celá oprava opírá. Všimněte si, jak daleko oprava naměřenou vzdálenost posune — a že každý její řádek se počítal v logaritmech, ručně, a pro kontrolu dvakrát.',
        },
      },
      {
        tab: 'lunars', panel: 'p-luncost',
        act: (store) => ensureLunars(store),
        text: {
          en: 'And here is why it lost. The moon closes on the sun at half a degree an hour, so one arcminute of error in the cleared distance is two minutes of Greenwich time and some thirty miles of longitude. A noon sight turns the same arcminute into one mile. Thirty to one, four hours of arithmetic, and a clear sky with both bodies up — against a watch you simply read.',
          cs: 'A tady je důvod, proč prohrály. Měsíc se ke Slunci blíží o půl stupně za hodinu, takže jedna úhlová minuta chyby v opravené vzdálenosti znamená dvě minuty greenwichského času a nějakých třicet mil délky. Polední měření z téže úhlové minuty udělá jednu míli. Třicet ku jedné, čtyři hodiny počítání a jasná obloha s oběma tělesy nad obzorem — proti hodinám, na které se prostě podíváte.',
        },
      },
    ],
  },
];

export const lessonById = (id) => lessons.find((l) => l.id === id) || null;
