// `useGrouping: "always"` è necessario: in italiano il separatore delle
// migliaia verrebbe altrimenti omesso sui numeri di quattro cifre ("2349 €").
const euroWithCents = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});

const euroRounded = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  useGrouping: "always",
});

const rateFormat = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Arrotondamento al centesimo, come in busta paga. */
export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Importo con i centesimi: usato nel dettaglio del calcolo, dove i conti devono tornare. */
export function money(value: number) {
  return euroWithCents.format(value);
}

/** Importo arrotondato all'euro: usato nei numeri di sintesi. */
export function shortMoney(value: number) {
  return euroRounded.format(value);
}

/** Aliquota espressa in percentuale, ad esempio 0.0919 → "9,19%". */
export function percent(rate: number) {
  return `${rateFormat.format(roundMoney(rate * 100))}%`;
}
