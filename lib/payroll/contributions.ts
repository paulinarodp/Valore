import { money, percent, roundMoney, shortMoney } from "./format.ts";
import type { BracketSlice } from "./progressiveTax.ts";
import type { ContributionRule } from "./types.ts";

/**
 * Contributi previdenziali a carico del dipendente.
 *
 * Due componenti: l'aliquota IVS ordinaria sull'intera retribuzione, più l'1%
 * aggiuntivo sulla sola quota che eccede la prima fascia di retribuzione
 * pensionabile.
 */
export function calculateContributions(annualGross: number, rule: ContributionRule) {
  const base = roundMoney(annualGross * rule.employeeRate);
  const aboveThreshold = roundMoney(Math.max(0, annualGross - rule.additionalRateThreshold));
  const additional = roundMoney(aboveThreshold * rule.additionalRate);

  // Il dettaglio serve solo quando le componenti sono due: con la sola aliquota
  // base ripeterebbe la formula già mostrata sopra di esso.
  const detail: BracketSlice[] = additional > 0
    ? [
      {
        label: `Aliquota IVS ${percent(rule.employeeRate)} sull'intera RAL`,
        formula: `${money(annualGross)} × ${percent(rule.employeeRate)}`,
        amount: base,
      },
      {
        label: `Aliquota aggiuntiva ${percent(rule.additionalRate)} oltre ${shortMoney(rule.additionalRateThreshold)}`,
        formula: `${money(aboveThreshold)} × ${percent(rule.additionalRate)}`,
        amount: additional,
      },
    ]
    : [];

  return {
    amount: roundMoney(base + additional),
    detail,
    /** L'1% aggiuntivo in busta paga si calcola mese per mese, non sull'anno. */
    usesAnnualApproximation: additional > 0,
  };
}
