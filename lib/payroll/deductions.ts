import { money, roundMoney } from "./format.ts";

/**
 * Detrazione per redditi da lavoro dipendente (art. 13 TUIR).
 *
 * Il comma 1 dà l'importo base, decrescente col reddito e azzerato a 50.000 €.
 * Il comma 1.1 aggiunge 65 € fra 25.000 e 35.000 € di reddito complessivo.
 *
 * La maggiorazione è trasversale alle bande del comma 1: vale sia sopra sia
 * sotto i 28.000 €. Applicarla solo sopra creerebbe un salto artificiale di
 * 65 € proprio sulla soglia, e in quel punto un aumento di RAL sembrerebbe
 * rendere molto più di quanto rende davvero.
 */
export function calculateEmploymentDeduction(taxableIncome: number) {
  if (taxableIncome <= 0) {
    return { amount: 0, formula: "nessun reddito imponibile" };
  }

  const base = employmentDeductionBase(taxableIncome);
  const surcharge = taxableIncome > 25_000 && taxableIncome <= 35_000 ? 65 : 0;

  return {
    amount: roundMoney(base.amount + surcharge),
    formula: surcharge > 0 ? `${base.formula} + 65 €` : base.formula,
  };
}

/** Comma 1: l'importo prima della maggiorazione. */
function employmentDeductionBase(taxableIncome: number) {
  if (taxableIncome <= 15_000) {
    return { amount: 1_955, formula: "importo fisso per imponibile fino a 15.000 €" };
  }

  if (taxableIncome <= 28_000) {
    return {
      amount: 1_910 + 1_190 * ((28_000 - taxableIncome) / 13_000),
      formula: `1.910 € + 1.190 € × (28.000 € − ${money(taxableIncome)}) / 13.000 €`,
    };
  }

  if (taxableIncome <= 50_000) {
    return {
      amount: 1_910 * ((50_000 - taxableIncome) / 22_000),
      formula: `1.910 € × (50.000 € − ${money(taxableIncome)}) / 22.000 €`,
    };
  }

  return { amount: 0, formula: "la detrazione si azzera oltre 50.000 € di imponibile" };
}

/**
 * Taglio del cuneo fiscale (L. 207/2024, art. 1 co. 4-9), in vigore anche nel 2026.
 *
 * Sotto i 20.000 € di reddito complessivo è una somma esente che si aggiunge
 * al netto; fra 20.000 e 40.000 € cambia natura e diventa una detrazione che
 * riduce l'IRPEF, con azzeramento progressivo dai 32.000 € in su.
 */
export function calculateWedgeRelief(employmentIncome: number, totalIncome: number) {
  if (employmentIncome <= 0 || totalIncome <= 0) {
    return { taxFreeBonus: 0, extraDeduction: 0, formula: "" };
  }

  if (totalIncome <= 20_000) {
    const rate = employmentIncome <= 8_500 ? 0.071 : employmentIncome <= 15_000 ? 0.053 : 0.048;
    return {
      taxFreeBonus: roundMoney(employmentIncome * rate),
      extraDeduction: 0,
      formula: `${money(employmentIncome)} × ${(rate * 100).toString().replace(".", ",")}%`,
    };
  }

  if (totalIncome <= 32_000) {
    return {
      taxFreeBonus: 0,
      extraDeduction: 1_000,
      formula: "importo pieno per reddito complessivo fino a 32.000 €",
    };
  }

  if (totalIncome < 40_000) {
    return {
      taxFreeBonus: 0,
      extraDeduction: roundMoney(1_000 * ((40_000 - totalIncome) / 8_000)),
      formula: `1.000 € × (40.000 € − ${money(totalIncome)}) / 8.000 €`,
    };
  }

  return { taxFreeBonus: 0, extraDeduction: 0, formula: "" };
}
