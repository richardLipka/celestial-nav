// Passages worth sailing. Each one carries a departure date, because the watch
// is rated on the day it sails and the voyage and the chronometer share it.

export const routes = [
  {
    id: 'trades',
    from: { lat: 28.13, lon: -15.43 },
    to: { lat: 13.11, lon: -59.6 },
    departure: [1765, 5, 1],
    speedKts: 5,
    driftKts: 0.6,
    setDeg: 275,
    name: { en: 'Las Palmas to Bridgetown', cs: 'Las Palmas – Bridgetown' },
    note: {
      en: 'The trade-wind crossing, and the passage the Longitude Act was written about. The North Equatorial Current sets you west the whole way.',
      cs: 'Plavba v pasátech — právě o téhle trase byl napsán zákon o zeměpisné délce. Severní rovníkový proud vás po celou dobu snáší k západu.',
    },
  },
  {
    id: 'h4',
    from: { lat: 50.8, lon: -1.09 },
    to: { lat: 17.94, lon: -76.84 },
    departure: [1761, 11, 18],
    speedKts: 5.5,
    driftKts: 0.4,
    setDeg: 250,
    name: { en: 'Portsmouth to Port Royal', cs: 'Portsmouth – Port Royal' },
    note: {
      en: 'H4’s own trial, sailed in HMS Deptford in the winter of 1761. Set the rate to a twelfth of a second a day and sail it as Harrison did.',
      cs: 'Vlastní zkouška hodin H4 na palubě HMS Deptford v zimě 1761. Nastavte chod na dvanáctinu sekundy denně a proplujte ji jako Harrison.',
    },
  },
  {
    id: 'north',
    from: { lat: 60.39, lon: 5.32 },
    to: { lat: 64.15, lon: -21.94 },
    departure: [1765, 12, 1],
    speedKts: 5,
    driftKts: 0.3,
    setDeg: 60,
    name: { en: 'Bergen to Reykjavík, December', cs: 'Bergen – Reykjavík, prosinec' },
    note: {
      en: 'North in midwinter, where the noon sun barely clears the horizon. Once it drops below five degrees there is no usable sight at all, and the latitude stops being free.',
      cs: 'Na sever uprostřed zimy, kde se polední Slunce sotva zvedne nad obzor. Jakmile klesne pod pět stupňů, není co měřit — a šířka přestává být zadarmo.',
    },
  },
];

export const routeById = (id) => routes.find((r) => r.id === id) || routes[0];
