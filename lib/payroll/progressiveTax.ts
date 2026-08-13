import { money, percent, roundMoney, shortMoney } from "./format.ts";
import type { TaxBracket } from "./types.ts";

export type BracketSlice = {
  label: string;
  formula: string;
  amount: number;
};

/**
 * Imposta progressiva per scaglioni: ogni aliquota si applica solo alla quota
 * di reddito compresa nel proprio scaglione, non all'intero importo.
 *
 * Restituisce anche il dettaglio scaglione per scaglione, che è il modo più
 * diretto per mostrare all'utente perché l'aliquota effettiva è più bassa di
 * quella marginale.
 */
export function calculateProgressiveTax(taxableIncome: number, brackets: TaxBracket[]) {
  const slices: BracketSlice[] = [];
  let lowerBound = 0;

  for (const bracket of brackets) {
    const upperBound = bracket.upTo ?? Number.POSITIVE_INFINITY;
    const slice = roundMoney(Math.max(0, Math.min(taxableIncome, upperBound) - lowerBound));

    if (slice > 0) {
      // Le soglie sono importi tondi: i centesimi restano sugli importi calcolati.
      const range = bracket.upTo === null
        ? `oltre ${shortMoney(lowerBound)}`
        : lowerBound === 0
          ? `fino a ${shortMoney(bracket.upTo)}`
          : `da ${shortMoney(lowerBound)} a ${shortMoney(bracket.upTo)}`;

      slices.push({
        label: `${percent(bracket.rate)} ${range}`,
        formula: `${money(slice)} × ${percent(bracket.rate)}`,
        amount: roundMoney(slice * bracket.rate),
      });
    }

    lowerBound = upperBound;
    if (taxableIncome <= upperBound) break;
  }

  return {
    amount: roundMoney(slices.reduce((total, slice) => total + slice.amount, 0)),
    slices,
  };
}
