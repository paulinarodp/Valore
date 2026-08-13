import { money, percent, roundMoney, shortMoney } from "./format.ts";
import { calculateProgressiveTax, type BracketSlice } from "./progressiveTax.ts";
import type { SurtaxRule } from "./types.ts";

/**
 * Addizionali regionali e comunali, calcolate sullo stesso imponibile
 * dell'IRPEF ma senza beneficiare delle detrazioni.
 */
export function calculateSurtax(taxableIncome: number, rule: SurtaxRule) {
  if (taxableIncome <= rule.exemptionThreshold) {
    return {
      amount: 0,
      formula: `esente fino a ${shortMoney(rule.exemptionThreshold)} di imponibile`,
      detail: [] as BracketSlice[],
    };
  }

  if (rule.application === "flatAboveThreshold") {
    const rate = rule.brackets[rule.brackets.length - 1]!.rate;
    return {
      amount: roundMoney(taxableIncome * rate),
      formula: `${money(taxableIncome)} × ${percent(rate)}`,
      detail: [] as BracketSlice[],
    };
  }

  const progressive = calculateProgressiveTax(taxableIncome, rule.brackets);
  return {
    amount: progressive.amount,
    formula: `${money(taxableIncome)} tassato per scaglioni`,
    detail: progressive.slices,
  };
}
