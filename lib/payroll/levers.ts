import { calculateSalary } from "./calculateSalary.ts";
import { MAX_RAL } from "./constants.ts";
import { calculateContributions } from "./contributions.ts";
import { roundMoney, shortMoney } from "./format.ts";
import type { PayrollRuleset, RuleSource, SalaryInput, SalaryResult } from "./types.ts";

export type CompensationLever = {
  id: "salary" | "bonus" | "fringe";
  label: string;
  /** Se falso, la leva non è utilizzabile per questo dipendente. */
  available: boolean;
  /** Perché non è utilizzabile: mostrato al posto dei numeri. */
  unavailableReason?: string;
  /** Quanto deve spendere l'azienda per consegnare `netDelivered`. */
  employerCost: number;
  /** Netto effettivamente consegnato: misurato, non assunto. Può fermarsi sotto l'obiettivo. */
  netDelivered: number;
  /** Euro netti consegnati per ogni euro speso dall'azienda, in percentuale. */
  efficiency: number;
  /** Il vincolo che rende la leva non sempre applicabile. */
  constraint: string;
  source: RuleSource;
};

/**
 * Trova l'aumento di RAL che consegna `targetNet` euro netti in più.
 *
 * Non è invertibile in forma chiusa: scaglioni, detrazioni decrescenti e soglie
 * comunali rendono la funzione netto(RAL) continua ma a tratti. Una ricerca
 * binaria sul motore vero è esatta al centesimo e non duplica la logica fiscale.
 *
 * Restituisce anche il netto davvero consegnato, misurato richiamando il motore:
 * vicino al tetto di RAL supportato l'obiettivo può essere irraggiungibile, e in
 * quel caso dichiararlo raggiunto sarebbe una bugia con l'aria di un risultato.
 */
export function grossUpForNet(
  base: SalaryInput,
  baseNet: number,
  targetNet: number,
  ruleset: PayrollRuleset,
) {
  const headroom = MAX_RAL - base.annualGross;
  if (headroom <= 0) return null;

  const netAt = (increase: number) =>
    calculateSalary({ ...base, annualGross: base.annualGross + increase }, ruleset).annualNet - baseNet;

  let low = 0;
  let high = Math.min(targetNet * 4, headroom);

  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (netAt(mid) < targetNet) low = mid;
    else high = mid;
  }

  const increase = roundMoney(high);
  return { increase, netDelivered: roundMoney(netAt(increase)) };
}

/**
 * Trova il premio lordo che consegna `targetNet` euro netti, entro il tetto.
 *
 * Il premio entra nell'imponibile contributivo, quindi i contributi si calcolano
 * sul totale: se la RAL è già oltre la prima fascia pensionabile il premio porta
 * il 10,19% e non il 9,19%. La differenza si ottiene dal motore, non da una
 * costante.
 */
function grossUpBonusForNet(
  annualGross: number,
  targetNet: number,
  ruleset: PayrollRuleset,
) {
  const { substituteTaxRate, annualCap } = ruleset.levers.performanceBonus;
  const baseContributions = calculateContributions(annualGross, ruleset.contributions).amount;

  const netAt = (bonusGross: number) => {
    const contributions = calculateContributions(annualGross + bonusGross, ruleset.contributions).amount
      - baseContributions;
    return (bonusGross - contributions) * (1 - substituteTaxRate);
  };

  let low = 0;
  let high = annualCap;

  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (netAt(mid) < targetNet) low = mid;
    else high = mid;
  }

  const gross = roundMoney(high);
  return { gross, netDelivered: roundMoney(netAt(gross)) };
}

/**
 * Confronta le tre strade per consegnare lo stesso netto aggiuntivo.
 *
 * È la domanda che conta davvero per un'azienda: non "quanto prende il
 * dipendente", ma "quanto mi costa fargli arrivare duemila euro". Le tre leve
 * hanno la stessa destinazione, costi molto diversi, e non sono sempre tutte
 * disponibili: il risultato cambia con la RAL, con la località e con i figli.
 */
export function compareCompensationLevers(
  result: SalaryResult,
  ruleset: PayrollRuleset,
  options: { targetNet: number; hasDependentChildren: boolean },
): CompensationLever[] {
  const { targetNet, hasDependentChildren } = options;
  const { performanceBonus, fringeBenefit } = ruleset.levers;
  // Su retribuzione ordinaria e premi l'azienda paga contributi e accantona TFR.
  const employerLoad = 1 + ruleset.employer.contributionRate + ruleset.employer.tfrRate;
  const efficiency = (net: number, cost: number) => cost <= 0 ? 0 : roundMoney((net / cost) * 100);

  // 1. Aumento di RAL: la strada più cara, perché paga tutto il cuneo.
  const grossUp = grossUpForNet(
    { annualGross: result.annualGross, payPeriods: result.payPeriods, locationId: result.location.id },
    result.annualNet,
    targetNet,
    ruleset,
  );
  const salaryCost = grossUp ? roundMoney(grossUp.increase * employerLoad) : 0;
  const salary: CompensationLever = grossUp && grossUp.netDelivered > 0
    ? {
      id: "salary",
      label: "Aumento di RAL",
      available: true,
      employerCost: salaryCost,
      netDelivered: grossUp.netDelivered,
      efficiency: efficiency(grossUp.netDelivered, salaryCost),
      constraint: "Sempre applicabile, ma permanente: entra nella RAL e in tutti gli anni successivi.",
      source: ruleset.irpefSource,
    }
    : {
      id: "salary",
      label: "Aumento di RAL",
      available: false,
      unavailableReason: `La RAL è già al tetto supportato dal prototipo, ${shortMoney(MAX_RAL)}.`,
      employerCost: 0,
      netDelivered: 0,
      efficiency: 0,
      constraint: "Sempre applicabile, ma permanente: entra nella RAL e in tutti gli anni successivi.",
      source: ruleset.irpefSource,
    };

  // 2. Premio di risultato: i contributi restano, l'IRPEF diventa l'1%.
  const bonusConstraint = `Richiede un accordo collettivo di secondo livello, vale fino a ${shortMoney(performanceBonus.annualCap)} l'anno e solo con reddito da lavoro dipendente sotto ${shortMoney(performanceBonus.eligibilityIncomeCap)} nell'anno precedente.`;
  let bonus: CompensationLever;

  if (result.annualGross > performanceBonus.eligibilityIncomeCap) {
    // Sopra la soglia il premio non è agevolato: mostrarlo sarebbe un'agevolazione inesistente.
    bonus = {
      id: "bonus",
      label: "Premio di risultato",
      available: false,
      unavailableReason: `Con una RAL sopra ${shortMoney(performanceBonus.eligibilityIncomeCap)} l'imposta sostitutiva non spetta: il premio verrebbe tassato come normale retribuzione.`,
      employerCost: 0,
      netDelivered: 0,
      efficiency: 0,
      constraint: bonusConstraint,
      source: performanceBonus.source,
    };
  } else {
    const computed = grossUpBonusForNet(result.annualGross, targetNet, ruleset);
    const bonusCost = roundMoney(computed.gross * employerLoad);
    bonus = {
      id: "bonus",
      label: "Premio di risultato",
      available: true,
      employerCost: bonusCost,
      netDelivered: computed.netDelivered,
      efficiency: efficiency(computed.netDelivered, bonusCost),
      constraint: bonusConstraint,
      source: performanceBonus.source,
    };
  }

  // 3. Fringe benefit: nessun contributo, nessuna imposta, nessun TFR.
  const fringeCap = hasDependentChildren
    ? fringeBenefit.thresholdWithChildren
    : fringeBenefit.threshold;
  const fringeNet = Math.min(targetNet, fringeCap);
  const fringe: CompensationLever = {
    id: "fringe",
    label: "Fringe benefit",
    available: true,
    employerCost: fringeNet,
    netDelivered: fringeNet,
    efficiency: 100,
    constraint: `Esente entro ${shortMoney(fringeCap)} l'anno: superata la soglia anche di un euro, l'intero valore diventa imponibile. Sono beni e servizi, non denaro.`,
    source: fringeBenefit.source,
  };

  return [salary, bonus, fringe];
}

export type RaiseTrap = {
  /** RAL in cui il netto tocca il minimo dentro la finestra esaminata. */
  bottomGross: number;
  /** Di quanto scende il netto rispetto a quello attuale. */
  netDrop: number;
  /** RAL a cui il netto torna almeno al livello di partenza. */
  recoveryGross: number;
};

/**
 * Cerca, appena sopra la RAL attuale, un aumento che farebbe *scendere* il netto.
 *
 * Non è un caso teorico: diverse regole italiane sono soglie e non franchigie,
 * e superarle di un euro fa scattare l'intero onere. Due esempi reali dentro il
 * perimetro del prototipo sono l'esenzione dell'addizionale comunale di Milano
 * a 23.000 € di imponibile e la maggiorazione di 65 € dell'art. 13 co. 1.1 che
 * si spegne a 35.000 €.
 *
 * In quelle zone la risposta giusta alla domanda "come do più soldi a questa
 * persona" non è un aumento di RAL, ed è esattamente ciò che la pagina deve
 * dire invece di lasciarlo scoprire in busta paga.
 */
export function findRaiseTrap(
  base: SalaryInput,
  baseNet: number,
  ruleset: PayrollRuleset,
  windowSize = 2_000,
  step = 25,
): RaiseTrap | null {
  const limit = Math.min(windowSize, MAX_RAL - base.annualGross);
  if (limit <= 0) return null;

  let bottomGross = base.annualGross;
  let bottomNet = baseNet;

  for (let delta = step; delta <= limit; delta += step) {
    const gross = base.annualGross + delta;
    const net = calculateSalary({ ...base, annualGross: gross }, ruleset).annualNet;
    if (net < bottomNet) {
      bottomNet = net;
      bottomGross = gross;
    }
  }

  if (bottomNet >= baseNet) return null;

  // Da dove in poi l'aumento torna a convenire.
  let recoveryGross = bottomGross;
  for (let gross = bottomGross + step; gross <= base.annualGross + limit; gross += step) {
    if (calculateSalary({ ...base, annualGross: gross }, ruleset).annualNet >= baseNet) {
      recoveryGross = gross;
      break;
    }
  }

  return {
    bottomGross,
    netDrop: roundMoney(baseNet - bottomNet),
    recoveryGross,
  };
}
