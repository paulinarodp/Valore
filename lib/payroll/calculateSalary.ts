import { MAX_RAL, MIN_RAL } from "./constants.ts";
import { calculateContributions } from "./contributions.ts";
import { calculateEmploymentDeduction, calculateWedgeRelief } from "./deductions.ts";
import { money, percent, roundMoney, shortMoney } from "./format.ts";
import { calculateSurtax } from "./localTaxes.ts";
import { calculateProgressiveTax } from "./progressiveTax.ts";
import { findLocation } from "./rules/italy-2026.ts";
import type {
  CalculationStep,
  Location,
  PayrollRuleset,
  SalaryInput,
  SalaryResult,
} from "./types.ts";

/**
 * Converte una RAL nel netto annuale, per il caso standard descritto nel README.
 *
 * La sequenza è quella con cui il netto si costruisce davvero in busta paga:
 *
 *   RAL
 *   − contributi previdenziali        (deducibili: riducono l'imponibile)
 *   = imponibile fiscale
 *   − IRPEF netta                     (IRPEF lorda meno le detrazioni)
 *   − addizionale regionale
 *   − addizionale comunale
 *   + somma esente da cuneo fiscale   (solo sotto i 20.000 € di imponibile)
 *   = netto annuale
 *
 * Oltre ai numeri restituisce `steps`: la stessa sequenza con la formula di
 * ogni passaggio e la fonte della regola applicata. È quello che la pagina
 * mostra all'utente, quindi l'interfaccia non può divergere dal calcolo.
 */
export function calculateSalary(
  { annualGross, payPeriods, locationId }: SalaryInput,
  ruleset: PayrollRuleset,
): SalaryResult {
  if (!Number.isFinite(annualGross) || annualGross < MIN_RAL || annualGross > MAX_RAL) {
    throw new Error(`La RAL deve essere compresa fra ${MIN_RAL} e ${MAX_RAL} euro`);
  }

  // Comune e regione cambiano solo le addizionali: IRPEF e contributi sono nazionali.
  const location = findLocation(ruleset, locationId);

  // 1. Contributi previdenziali a carico del dipendente.
  const contributions = calculateContributions(annualGross, ruleset.contributions);

  // 2. I contributi sono deducibili: l'IRPEF si calcola su quel che resta.
  const taxableIncome = roundMoney(annualGross - contributions.amount);

  // 3. IRPEF lorda per scaglioni.
  const irpef = calculateProgressiveTax(taxableIncome, ruleset.irpefBrackets);

  // 4. Detrazioni: non possono generare un credito, quindi si fermano a zero.
  const employmentDeduction = calculateEmploymentDeduction(taxableIncome);
  const wedgeRelief = calculateWedgeRelief(taxableIncome, taxableIncome);
  const appliedEmploymentDeduction = roundMoney(
    Math.min(employmentDeduction.amount, irpef.amount),
  );
  const appliedExtraDeduction = roundMoney(Math.min(
    wedgeRelief.extraDeduction,
    Math.max(0, irpef.amount - appliedEmploymentDeduction),
  ));
  const netIrpef = roundMoney(irpef.amount - appliedEmploymentDeduction - appliedExtraDeduction);

  // 5. Addizionali locali, sullo stesso imponibile ma senza detrazioni.
  const regional = calculateSurtax(taxableIncome, location.regionalSurtax);
  const municipal = calculateSurtax(taxableIncome, location.municipalSurtax);

  const totalTaxes = roundMoney(netIrpef + regional.amount + municipal.amount);
  const totalWithheld = roundMoney(contributions.amount + totalTaxes);
  const annualNet = roundMoney(annualGross - totalWithheld + wedgeRelief.taxFreeBonus);

  const steps: CalculationStep[] = [
    {
      id: "gross",
      label: "Retribuzione annua lorda (RAL)",
      amount: annualGross,
      effect: "base",
      formula: "Importo inserito",
    },
    {
      id: "contributions",
      label: "Contributi previdenziali a carico del dipendente",
      amount: contributions.amount,
      effect: "subtract",
      formula: `${money(annualGross)} × ${percent(ruleset.contributions.employeeRate)}`,
      source: ruleset.contributions.source,
      detail: contributions.detail,
      note: contributions.usesAnnualApproximation
        ? "L'1% aggiuntivo è calcolato sulla RAL annua. In busta paga INPS lo applica mese per mese, quindi con retribuzioni non uniformi il risultato può differire di qualche euro."
        : undefined,
    },
    {
      id: "taxable",
      label: "Imponibile fiscale",
      amount: taxableIncome,
      effect: "subtotal",
      formula: `${money(annualGross)} − ${money(contributions.amount)}`,
      note: "I contributi previdenziali sono deducibili: l'IRPEF non si calcola sulla RAL ma su questo importo.",
    },
    {
      id: "gross-irpef",
      label: "IRPEF lorda",
      amount: irpef.amount,
      effect: "subtract",
      formula: `${money(taxableIncome)} tassato per scaglioni`,
      source: ruleset.irpefSource,
      detail: irpef.slices,
    },
    {
      id: "employment-deduction",
      label: "Detrazione per lavoro dipendente",
      amount: appliedEmploymentDeduction,
      effect: "add",
      formula: employmentDeduction.formula,
      source: ruleset.employmentDeductionSource,
    },
  ];

  if (appliedExtraDeduction > 0) {
    steps.push({
      id: "extra-deduction",
      label: "Ulteriore detrazione (taglio del cuneo fiscale)",
      amount: appliedExtraDeduction,
      effect: "add",
      formula: wedgeRelief.formula,
      source: ruleset.employmentDeductionSource,
    });
  }

  steps.push(
    {
      id: "net-irpef",
      label: "IRPEF netta",
      amount: netIrpef,
      effect: "subtotal",
      formula: `${money(irpef.amount)} − ${money(appliedEmploymentDeduction + appliedExtraDeduction)} di detrazioni`,
    },
    {
      id: "regional-surtax",
      label: location.regionalSurtax.label,
      amount: regional.amount,
      effect: "subtract",
      formula: regional.formula,
      source: location.regionalSurtax.source,
      detail: regional.detail,
    },
    {
      id: "municipal-surtax",
      label: location.municipalSurtax.label,
      amount: municipal.amount,
      effect: "subtract",
      formula: municipal.formula,
      source: location.municipalSurtax.source,
      detail: municipal.detail,
      note: [
        location.municipalSurtax.source.note,
        municipalExemptionNote(location),
      ].filter(Boolean).join(" "),
    },
  );

  if (wedgeRelief.taxFreeBonus > 0) {
    steps.push({
      id: "tax-free-bonus",
      label: "Somma esente (taglio del cuneo fiscale)",
      amount: wedgeRelief.taxFreeBonus,
      effect: "add",
      formula: wedgeRelief.formula,
      source: ruleset.employmentDeductionSource,
      note: "Non è una detrazione: è una somma che il datore di lavoro eroga senza tassarla, quindi si somma al netto.",
    });
  }

  steps.push({
    id: "net",
    label: "Netto annuale",
    amount: annualNet,
    effect: "total",
    formula: `${money(annualGross)} − ${money(totalWithheld)} di trattenute`,
  });

  // 6. Il lato azienda: quanto costa davvero questa RAL.
  const employerContributions = roundMoney(annualGross * ruleset.employer.contributionRate);
  const tfr = roundMoney(annualGross * ruleset.employer.tfrRate);
  const employerCost = roundMoney(annualGross + employerContributions + tfr);

  return {
    rulesetId: ruleset.id,
    taxYear: ruleset.taxYear,
    verifiedAt: ruleset.verifiedAt,

    annualGross,
    payPeriods,
    location,

    contributions: contributions.amount,
    taxableIncome,
    grossIrpef: irpef.amount,
    employmentDeduction: appliedEmploymentDeduction,
    extraDeduction: appliedExtraDeduction,
    netIrpef,
    regionalSurtax: regional.amount,
    municipalSurtax: municipal.amount,
    taxFreeBonus: wedgeRelief.taxFreeBonus,

    totalTaxes,
    totalWithheld,

    annualNet,
    netPerPayPeriod: roundMoney(annualNet / payPeriods),
    withheldRate: roundMoney((totalWithheld / annualGross) * 100),

    employerContributions,
    tfr,
    employerCost,
    // Il TFR resta al dipendente, ma differito: nel cuneo dell'anno non entra
    // come netto disponibile, e va letto per quello che è.
    taxWedgeRate: roundMoney(((employerCost - annualNet) / employerCost) * 100),

    steps,
  };
}

/**
 * A seconda del comune la soglia funziona in modo diverso, ed è la fonte più
 * comune di errore: con l'aliquota unica superare la soglia tassa l'intero
 * imponibile, mentre con gli scaglioni la soglia apre solo il calcolo.
 */
function municipalExemptionNote(location: Location) {
  const threshold = shortMoney(location.municipalSurtax.exemptionThreshold);
  return location.municipalSurtax.application === "flatAboveThreshold"
    ? `A ${location.municipality} i ${threshold} sono una soglia di esenzione, non una franchigia: superata, l'aliquota si applica all'intero imponibile.`
    : `A ${location.municipality} sotto i ${threshold} non si paga nulla; sopra, l'imponibile è tassato per scaglioni.`;
}
