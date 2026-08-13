import assert from "node:assert/strict";
import test from "node:test";

import { calculateSalary } from "../lib/payroll/calculateSalary.ts";
import { MAX_RAL, MIN_RAL } from "../lib/payroll/constants.ts";
import { calculateContributions } from "../lib/payroll/contributions.ts";
import {
  calculateEmploymentDeduction,
  calculateWedgeRelief,
} from "../lib/payroll/deductions.ts";
import {
  compareCompensationLevers,
  findRaiseTrap,
  grossUpForNet,
} from "../lib/payroll/levers.ts";
import { calculateSurtax } from "../lib/payroll/localTaxes.ts";
import { calculateProgressiveTax } from "../lib/payroll/progressiveTax.ts";
import { findLocation, ITALY_2026 } from "../lib/payroll/rules/italy-2026.ts";

const rules = ITALY_2026;
const milano = findLocation(rules, "milano");

const at = (annualGross: number, payPeriods: 12 | 13 | 14 = 13, locationId = "milano") =>
  calculateSalary({ annualGross, payPeriods, locationId }, rules);

test("IRPEF applies the 2026 rates exactly at the bracket boundaries", () => {
  const cases = [
    [27_999, 6_439.77],
    [28_000, 6_440],
    // Oltre 28.000 la quota eccedente è tassata al 33%, non al 35%.
    [28_100, 6_473],
    [49_999, 13_699.67],
    [50_000, 13_700],
    [50_100, 13_743],
  ] as const;

  for (const [income, expected] of cases) {
    assert.equal(
      calculateProgressiveTax(income, rules.irpefBrackets).amount,
      expected,
      `IRPEF su ${income}`,
    );
  }
});

test("progressive brackets tax only the slice inside each band", () => {
  const { slices } = calculateProgressiveTax(41_772.6, rules.irpefBrackets);

  assert.equal(slices.length, 2);
  assert.equal(slices[0]?.amount, 6_440);
  assert.equal(slices[1]?.amount, 4_544.96);
  assert.equal(slices.reduce((total, slice) => total + slice.amount, 0), 10_984.96);
});

test("Lombardia surtax is progressive across its four bands", () => {
  const cases = [
    [15_000, 184.5],
    [28_000, 389.9],
    [41_772.6, 626.79],
    [50_000, 768.3],
    [60_000, 941.3],
  ] as const;

  for (const [income, expected] of cases) {
    assert.equal(
      calculateSurtax(income, milano.regionalSurtax).amount,
      expected,
      `addizionale regionale su ${income}`,
    );
  }
});

test("the Milano exemption is a threshold, not an allowance", () => {
  const rule = milano.municipalSurtax;

  assert.equal(calculateSurtax(23_000, rule).amount, 0);
  // Superata la soglia l'aliquota colpisce l'intero imponibile, non solo l'eccedenza.
  assert.equal(calculateSurtax(23_001, rule).amount, 184.01);
});

test("the additional 1% contribution only applies above the 2026 pension band", () => {
  const threshold = rules.contributions.additionalRateThreshold;

  assert.equal(threshold, 56_224);
  assert.equal(calculateContributions(threshold, rules.contributions).detail.length, 0);

  const above = calculateContributions(threshold + 10_000, rules.contributions);
  assert.equal(above.detail.length, 2);
  assert.equal(above.detail[1]?.amount, 100);
  assert.equal(above.usesAnnualApproximation, true);
});

test("the employment deduction follows art. 13 TUIR across every band", () => {
  assert.equal(calculateEmploymentDeduction(15_000).amount, 1_955);
  assert.equal(calculateEmploymentDeduction(20_000).amount, 2_642.31);

  // La maggiorazione di 65 € del comma 1.1 è trasversale alle bande del comma 1:
  // vale sia sotto sia sopra i 28.000 €, e si accende e spegne di scatto.
  assert.equal(calculateEmploymentDeduction(25_000).amount, 2_184.62);
  assert.equal(calculateEmploymentDeduction(25_001).amount, 2_249.52);
  assert.equal(calculateEmploymentDeduction(26_000).amount, 2_158.08);
  assert.equal(calculateEmploymentDeduction(30_000).amount, 1_801.36);
  assert.equal(calculateEmploymentDeduction(35_000).amount, 1_367.27);
  assert.equal(calculateEmploymentDeduction(35_001).amount, 1_302.19);

  // Senza la maggiorazione la detrazione è continua sulla soglia dei 28.000.
  assert.ok(Math.abs(
    calculateEmploymentDeduction(28_001).amount - calculateEmploymentDeduction(27_999).amount,
  ) < 1);
  assert.equal(calculateEmploymentDeduction(40_000).amount, 868.18);
  assert.equal(calculateEmploymentDeduction(50_000).amount, 0);
  assert.equal(calculateEmploymentDeduction(50_001).amount, 0);
});

test("the wedge relief switches from tax-free sum to extra deduction at 20.000 euro", () => {
  assert.equal(calculateWedgeRelief(8_500, 8_500).taxFreeBonus, 603.5);
  assert.equal(calculateWedgeRelief(19_000, 19_000).taxFreeBonus, 912);
  assert.equal(calculateWedgeRelief(19_000, 19_000).extraDeduction, 0);

  assert.equal(calculateWedgeRelief(25_000, 25_000).taxFreeBonus, 0);
  assert.equal(calculateWedgeRelief(25_000, 25_000).extraDeduction, 1_000);
  assert.equal(calculateWedgeRelief(36_000, 36_000).extraDeduction, 500);
  assert.equal(calculateWedgeRelief(40_000, 40_000).extraDeduction, 0);
});

test("end-to-end net salary matches the manually computed reference cases", () => {
  // Riferimento calcolato a mano per RAL 46.000:
  //   contributi        46.000,00 × 9,19%        = 4.227,40
  //   imponibile        46.000,00 − 4.227,40     = 41.772,60
  //   IRPEF lorda       28.000 × 23% + 13.772,60 × 33% = 10.984,96
  //   detrazione        1.910 × (50.000 − 41.772,60) / 22.000 =   714,29
  //   IRPEF netta       10.984,96 − 714,29       = 10.270,67
  //   add. regionale    per scaglioni            =   626,79
  //   add. comunale     41.772,60 × 0,8%         =   334,18
  //   netto             46.000 − 4.227,40 − 10.270,67 − 626,79 − 334,18 = 30.540,96
  const cases = [
    [18_000, 16_141.92],
    [20_000, 17_432.62],
    [30_000, 23_425.52],
    [46_000, 30_540.96],
    [60_000, 37_554.66],
    [100_000, 57_122.46],
  ] as const;

  for (const [gross, expectedNet] of cases) {
    assert.equal(
      at(gross, 13).annualNet,
      expectedNet,
      `netto annuale per RAL ${gross}`,
    );
  }
});

test("every displayed figure reconciles with the others", () => {
  for (const gross of [18_000, 20_000, 35_000, 46_000, 120_000, MAX_RAL]) {
    const result = at(gross, 13);

    assert.equal(
      result.totalTaxes,
      Math.round((result.netIrpef + result.regionalSurtax + result.municipalSurtax) * 100) / 100,
      `imposte totali per ${gross}`,
    );
    assert.equal(
      result.totalWithheld,
      Math.round((result.contributions + result.totalTaxes) * 100) / 100,
      `trattenute totali per ${gross}`,
    );
    assert.equal(
      result.annualNet,
      Math.round((gross - result.totalWithheld + result.taxFreeBonus) * 100) / 100,
      `netto per ${gross}`,
    );
    assert.ok(result.annualNet < gross, `il netto deve essere inferiore alla RAL per ${gross}`);
  }
});

test("the steps shown to the user reproduce the returned totals", () => {
  const result = at(46_000, 13);
  const byId = new Map(result.steps.map((step) => [step.id, step]));

  assert.equal(byId.get("gross")?.amount, result.annualGross);
  assert.equal(byId.get("contributions")?.amount, result.contributions);
  assert.equal(byId.get("taxable")?.amount, result.taxableIncome);
  assert.equal(byId.get("gross-irpef")?.amount, result.grossIrpef);
  assert.equal(byId.get("employment-deduction")?.amount, result.employmentDeduction);
  assert.equal(byId.get("net-irpef")?.amount, result.netIrpef);
  assert.equal(byId.get("regional-surtax")?.amount, result.regionalSurtax);
  assert.equal(byId.get("municipal-surtax")?.amount, result.municipalSurtax);
  assert.equal(byId.get("net")?.amount, result.annualNet);

  // Il ledger deve chiudere da solo: partendo dalla RAL e applicando i segni
  // mostrati in pagina si deve arrivare esattamente al netto annuale. È questo
  // che rende il calcolo verificabile a occhio da chi legge la pagina.
  const ledger = result.steps
    .filter((step) => step.effect === "subtract" || step.effect === "add")
    .reduce(
      (total, step) => step.effect === "subtract" ? total - step.amount : total + step.amount,
      result.annualGross,
    );
  assert.equal(Math.round(ledger * 100) / 100, result.annualNet);
});

test("net per pay period follows the selected number of payments", () => {
  for (const payPeriods of [12, 13, 14] as const) {
    const result = at(46_000, payPeriods);
    assert.equal(result.netPerPayPeriod, Math.round((result.annualNet / payPeriods) * 100) / 100);
  }
});

test("the tax-free wedge sum is added on top of the net, not deducted from tax", () => {
  const result = at(20_000, 13);

  assert.ok(result.taxFreeBonus > 0);
  assert.equal(result.annualNet > result.annualGross - result.totalWithheld, true);
  assert.equal(
    result.annualNet,
    Math.round((result.annualGross - result.totalWithheld + result.taxFreeBonus) * 100) / 100,
  );
});

test("deductions can reduce IRPEF to zero but never turn it into a credit", () => {
  const result = at(MIN_RAL, 13);

  assert.ok(result.netIrpef >= 0);
  assert.ok(result.employmentDeduction <= result.grossIrpef);
});

test("the supported RAL range is enforced by the engine, not only by the UI", () => {
  for (const gross of [MIN_RAL - 1, MAX_RAL + 1, Number.NaN]) {
    assert.throws(() => at(gross, 13), /La RAL deve essere compresa/);
  }

  assert.equal(at(MIN_RAL, 13).annualGross, MIN_RAL);
  assert.equal(at(MAX_RAL, 13).annualGross, MAX_RAL);
});

test("only the surtaxes change with the location: IRPEF and contributions are national", () => {
  const results = rules.locations.map((location) => at(46_000, 13, location.id));
  const reference = results[0]!;

  for (const result of results) {
    assert.equal(result.contributions, reference.contributions);
    assert.equal(result.taxableIncome, reference.taxableIncome);
    assert.equal(result.grossIrpef, reference.grossIrpef);
    assert.equal(result.netIrpef, reference.netIrpef);
  }

  // Le addizionali invece devono davvero differenziarsi.
  const surtaxes = new Set(results.map((r) => r.regionalSurtax + r.municipalSurtax));
  assert.ok(surtaxes.size > 1, "le addizionali devono variare fra le località");
});

test("each supported location computes its own documented surtaxes", () => {
  // Valori calcolati a mano su imponibile 41.772,60 (RAL 46.000).
  const expected: Record<string, { regional: number; municipal: number }> = {
    // Lombardia per scaglioni; Milano 0,8% oltre l'esenzione di 23.000.
    milano: { regional: 626.79, municipal: 334.18 },
    // Piemonte per scaglioni; Torino per scaglioni comunali.
    torino: { regional: 1_047.27, municipal: 375.5 },
    // Toscana per scaglioni; Firenze 0,2% oltre l'esenzione di 25.000.
    firenze: { regional: 856.15, municipal: 83.55 },
    // Veneto aliquota unica 1,23%; Venezia 0,8% oltre l'esenzione di 10.000.
    venezia: { regional: 513.8, municipal: 334.18 },
    // Puglia per scaglioni; Bari 0,8% oltre l'esenzione di 15.000.
    bari: { regional: 921.25, municipal: 334.18 },
  };

  for (const [locationId, amounts] of Object.entries(expected)) {
    const result = at(46_000, 13, locationId);
    assert.equal(result.regionalSurtax, amounts.regional, `addizionale regionale ${locationId}`);
    assert.equal(result.municipalSurtax, amounts.municipal, `addizionale comunale ${locationId}`);
  }
});

test("a per-scaglioni municipal surtax shows its bracket breakdown", () => {
  const torino = at(46_000, 13, "torino");
  const milano = at(46_000, 13, "milano");
  const detailOf = (result: typeof torino) =>
    result.steps.find((step) => step.id === "municipal-surtax")?.detail ?? [];

  // Torino applica scaglioni comunali: il dettaglio deve mostrarli.
  const brackets = detailOf(torino);
  assert.equal(brackets.length, 3);
  assert.equal(
    Math.round(brackets.reduce((total, row) => total + row.amount, 0) * 100) / 100,
    torino.municipalSurtax,
  );

  // Milano ha aliquota unica: la formula basta, senza dettaglio ridondante.
  assert.equal(detailOf(milano).length, 0);
});

test("a municipal exemption threshold zeroes the surtax below it", () => {
  // Con RAL 26.000 l'imponibile è 23.610,60: sopra la soglia di Milano (23.000),
  // sotto quella di Firenze (25.000).
  assert.ok(at(26_000, 13, "milano").municipalSurtax > 0);
  assert.equal(at(26_000, 13, "firenze").municipalSurtax, 0);
});

test("an unknown location is rejected instead of silently falling back", () => {
  assert.throws(() => at(46_000, 13, "roma"), /Località non supportata/);
});

test("regional rates are verified for 2026 and municipal rates declare the 2025 assumption", () => {
  for (const location of rules.locations) {
    assert.equal(location.regionalSurtax.source.year, 2026, location.id);
    assert.equal(location.regionalSurtax.source.status, "verified", location.id);

    assert.equal(location.municipalSurtax.source.year, 2025, location.id);
    assert.equal(location.municipalSurtax.source.status, "assumption_documented", location.id);
    assert.match(location.municipalSurtax.source.url, /anno=2025/, location.id);
    assert.match(location.municipalSurtax.source.note ?? "", /non pubblica ancora dati comunali 2026/i);

    for (const surtax of [location.regionalSurtax, location.municipalSurtax]) {
      assert.match(surtax.source.url, /^https:\/\/www1\.finanze\.gov\.it\//, location.id);
      assert.ok(surtax.brackets.length > 0, location.id);
    }
  }

  const municipalStep = at(46_000).steps.find((step) => step.id === "municipal-surtax");
  assert.match(municipalStep?.note ?? "", /ultima delibera disponibile.*2025/i);
});

test("employer cost adds contributions and TFR on top of the gross salary", () => {
  const result = at(46_000);
  const expectedTfr = Math.round((46_000 / 13.5) * 100) / 100;

  // 46.000 × 30% = 13.800; il TFR è esattamente retribuzione / 13,5.
  assert.equal(result.employerContributions, 13_800);
  assert.equal(result.tfr, expectedTfr);
  assert.equal(result.employerCost, 46_000 + 13_800 + expectedTfr);

  // Il cuneo contiene solo imposte e contributi: il TFR è retribuzione differita.
  const expectedWedge = result.employerContributions + result.contributions + result.totalTaxes;
  assert.equal(result.taxAndContributionWedge, expectedWedge);
  assert.equal(
    result.taxWedgeRate,
    Math.round((expectedWedge / result.employerCost) * 10_000) / 100,
  );
  assert.equal(
    result.annualNet + result.taxAndContributionWedge + result.tfr,
    result.employerCost,
  );
  assert.ok(result.taxWedgeRate > 40 && result.taxWedgeRate < 60);
});

test("employer cost keeps the tax-free sum outside the RAL composition", () => {
  const result = at(20_000);
  const netFromGross = result.annualNet - result.taxFreeBonus;

  assert.ok(result.taxFreeBonus > 0);
  assert.ok(result.annualNet > netFromGross);
  assert.ok(
    Math.abs(
      netFromGross + result.taxAndContributionWedge + result.tfr - result.employerCost
    ) < 0.01,
  );
});

test("the gross-up search finds the RAL increase that delivers the target net", () => {
  const base = { annualGross: 46_000, payPeriods: 13 as const, locationId: "milano" };
  const baseNet = at(46_000).annualNet;

  for (const target of [500, 1_000, 3_000]) {
    const found = grossUpForNet(base, baseNet, target, rules);
    assert.ok(found !== null);

    // Verifica contro il motore vero, non contro la formula usata per cercarlo.
    const delivered = calculateSalary(
      { ...base, annualGross: 46_000 + found!.increase },
      rules,
    ).annualNet - baseNet;
    assert.ok(
      Math.abs(delivered - target) < 0.02,
      `aumento di ${found!.increase} consegna ${delivered}, atteso ${target}`,
    );
    // Il netto dichiarato deve coincidere con quello misurato.
    assert.ok(Math.abs(found!.netDelivered - delivered) < 0.02);
    if (found!.increase >= 0.01) {
      const previousCent = calculateSalary(
        { ...base, annualGross: 46_000 + found!.increase - 0.01 },
        rules,
      ).annualNet - baseNet;
      assert.ok(previousCent < target, "deve restituire il primo aumento utile");
    }
  }
});

test("the gross-up finds the first valid result across known net-salary cliffs", () => {
  for (const [annualGross, targetNet] of [[25_300, 100], [38_500, 100]] as const) {
    const base = { annualGross, payPeriods: 13 as const, locationId: "milano" };
    const baseNet = at(annualGross).annualNet;
    const found = grossUpForNet(base, baseNet, targetNet, rules);
    assert.ok(found, `soluzione attesa da RAL ${annualGross}`);

    const delivered = calculateSalary(
      { ...base, annualGross: annualGross + found!.increase },
      rules,
    ).annualNet - baseNet;
    const previousCent = calculateSalary(
      { ...base, annualGross: annualGross + found!.increase - 0.01 },
      rules,
    ).annualNet - baseNet;

    assert.ok(delivered >= targetNet, `consegna ${delivered} da RAL ${annualGross}`);
    assert.ok(previousCent < targetNet, `non salta una soluzione più bassa da RAL ${annualGross}`);
  }
});

test("the levers change with the case, they are not fixed numbers", () => {
  const levers = (gross: number) =>
    compareCompensationLevers(at(gross), rules, {
      targetNet: 2_000,
      hasDependentChildren: false,
      previousYearEmployeeIncome: 46_000,
    });
  const costOf = (gross: number, id: string) =>
    levers(gross).find((lever) => lever.id === id)!.employerCost;

  // Il costo di un aumento di RAL cresce con l'aliquota marginale.
  assert.ok(costOf(20_000, "salary") < costOf(46_000, "salary"));
  assert.ok(costOf(46_000, "salary") < costOf(70_000, "salary"));

  // Oltre la prima fascia pensionabile il premio porta il 10,19% di contributi,
  // quindi costa di più che sotto la soglia.
  assert.ok(costOf(70_000, "bonus") > costOf(46_000, "bonus"));
});

test("performance-bonus eligibility uses previous-year employee income, never current RAL", () => {
  const cap = rules.levers.performanceBonus.eligibilityIncomeCap;
  const unknown = compareCompensationLevers(at(46_000), rules, {
    targetNet: 2_000,
    hasDependentChildren: false,
    previousYearEmployeeIncome: null,
  }).find((lever) => lever.id === "bonus")!;
  const eligibleDespiteCurrentRal = compareCompensationLevers(at(90_000), rules, {
    targetNet: 2_000,
    hasDependentChildren: false,
    previousYearEmployeeIncome: cap,
  }).find((lever) => lever.id === "bonus")!;
  const notEligibleDespiteCurrentRal = compareCompensationLevers(at(46_000), rules, {
    targetNet: 2_000,
    hasDependentChildren: false,
    previousYearEmployeeIncome: cap + 1,
  }).find((lever) => lever.id === "bonus")!;

  assert.equal(unknown.available, false);
  assert.equal(unknown.verificationRequired, true);
  assert.equal(unknown.employerCost, 0);
  assert.match(unknown.unavailableReason ?? "", /anno precedente/i);

  assert.equal(eligibleDespiteCurrentRal.available, true);
  assert.ok(eligibleDespiteCurrentRal.employerCost > 0);

  // Sopra la soglia l'agevolazione non esiste: non va mostrata come se esistesse.
  assert.equal(notEligibleDespiteCurrentRal.available, false);
  assert.equal(notEligibleDespiteCurrentRal.employerCost, 0);
  assert.match(notEligibleDespiteCurrentRal.unavailableReason ?? "", /imposta sostitutiva non spetta/i);
});

test("no lever ever claims to deliver more net than it costs", () => {
  for (const gross of [18_000, 46_000, 90_000, 150_000, 199_000, MAX_RAL]) {
    for (const lever of compareCompensationLevers(at(gross), rules, {
      targetNet: 2_000,
      hasDependentChildren: false,
      previousYearEmployeeIncome: 46_000,
    })) {
      if (!lever.available) {
        assert.equal(lever.efficiency, 0, `${lever.id} non disponibile a ${gross}`);
        continue;
      }
      // Il fringe benefit è il limite teorico: un euro speso, un euro netto.
      assert.ok(
        lever.efficiency <= 100.000001,
        `${lever.id} a RAL ${gross} dichiara efficienza ${lever.efficiency}%`,
      );
      assert.ok(lever.netDelivered <= lever.employerCost + 0.01);
    }
  }
});

test("near the RAL ceiling the salary lever reports what it can actually deliver", () => {
  // A 199.000 restano 1.000 € di margine: non bastano per 2.000 € netti.
  const salary = compareCompensationLevers(at(199_000), rules, {
    targetNet: 2_000,
    hasDependentChildren: false,
    previousYearEmployeeIncome: 46_000,
  }).find((lever) => lever.id === "salary")!;

  assert.equal(salary.available, false);
  assert.equal(salary.netDelivered, 0);
  assert.match(salary.unavailableReason ?? "", /non è raggiungibile/i);

  // Al tetto esatto la leva sparisce del tutto, con la sua ragione.
  const atCeiling = compareCompensationLevers(at(MAX_RAL), rules, {
    targetNet: 2_000,
    hasDependentChildren: false,
    previousYearEmployeeIncome: 46_000,
  }).find((lever) => lever.id === "salary")!;
  assert.equal(atCeiling.available, false);
  assert.match(atCeiling.unavailableReason ?? "", /tetto supportato/i);
});

test("fringe benefit is the most efficient lever, salary the least", () => {
  const levers = compareCompensationLevers(at(46_000), rules, {
    targetNet: 1_000,
    hasDependentChildren: false,
    previousYearEmployeeIncome: 46_000,
  });
  const byId = new Map(levers.map((lever) => [lever.id, lever]));

  const salary = byId.get("salary")!;
  const bonus = byId.get("bonus")!;
  const fringe = byId.get("fringe")!;

  // Ordine atteso: il fringe benefit non paga né contributi né imposte.
  assert.ok(fringe.efficiency > bonus.efficiency);
  assert.ok(bonus.efficiency > salary.efficiency);
  assert.equal(fringe.efficiency, 100);
  assert.equal(fringe.employerCost, 1_000);

  // Tutte devono consegnare il netto obiettivo, entro i rispettivi tetti.
  for (const lever of levers) {
    assert.ok(lever.netDelivered <= 1_000 + 0.01);
    assert.ok(lever.employerCost > 0);
  }
});

test("lever caps are respected: fringe benefit stops at its threshold", () => {
  const result = at(46_000);
  const withoutChildren = compareCompensationLevers(result, rules, {
    targetNet: 3_000,
    hasDependentChildren: false,
    previousYearEmployeeIncome: 46_000,
  }).find((lever) => lever.id === "fringe")!;
  const withChildren = compareCompensationLevers(result, rules, {
    targetNet: 3_000,
    hasDependentChildren: true,
    previousYearEmployeeIncome: 46_000,
  }).find((lever) => lever.id === "fringe")!;

  // Oltre la soglia la leva non può consegnare di più, e il tetto raddoppia con figli.
  assert.equal(withoutChildren.netDelivered, 1_000);
  assert.equal(withChildren.netDelivered, 2_000);
});

test("the performance bonus keeps contributions and only replaces income tax", () => {
  const lever = compareCompensationLevers(at(46_000), rules, {
    targetNet: 1_000,
    hasDependentChildren: false,
    previousYearEmployeeIncome: 46_000,
  }).find((item) => item.id === "bonus")!;

  // Netto = (lordo − contributi) × (1 − 1%): i contributi restano dovuti.
  const grossFromCost = lever.employerCost
    / (1 + rules.employer.contributionRate + rules.employer.tfrRate);
  const contributions = grossFromCost * rules.contributions.employeeRate;
  const expectedNet = (grossFromCost - contributions)
    * (1 - rules.levers.performanceBonus.substituteTaxRate);

  assert.ok(
    Math.abs(lever.netDelivered - expectedNet) < 0.02,
    `atteso ${expectedNet}, ottenuto ${lever.netDelivered}`,
  );
  assert.ok(lever.efficiency < 100, "il premio non può essere efficiente al 100%");
});

test("a raise can lower the net salary where a threshold is a cliff", () => {
  const trap = (gross: number, locationId = "milano") => findRaiseTrap(
    { annualGross: gross, payPeriods: 13, locationId },
    at(gross, 13, locationId).annualNet,
    rules,
  );

  // Superata l'esenzione comunale di Milano (23.000 di imponibile) l'aliquota
  // colpisce l'intero imponibile in un colpo solo: il netto scende.
  const milano = trap(25_300);
  assert.ok(milano, "a Milano la trappola dell'addizionale comunale deve esistere");
  assert.ok(milano!.netDrop > 100, `caduta attesa oltre 100 €, trovata ${milano!.netDrop}`);
  assert.ok(milano!.recoveryGross > 25_300);

  // A Firenze la soglia è a 25.000 di imponibile, quindi la stessa RAL è pulita.
  assert.equal(trap(25_300, "firenze"), null);

  // Spegnimento della maggiorazione di 65 € a 35.000 di imponibile.
  const surcharge = trap(38_500);
  assert.ok(surcharge, "la trappola della maggiorazione deve esistere");
  assert.ok(surcharge!.netDrop > 20 && surcharge!.netDrop < 70);
});

test("most salaries have no raise trap at all", () => {
  for (const gross of [20_000, 46_000, 60_000, 100_000, 150_000]) {
    assert.equal(
      findRaiseTrap({ annualGross: gross, payPeriods: 13, locationId: "milano" }, at(gross).annualNet, rules),
      null,
      `RAL ${gross} non dovrebbe avere trappole`,
    );
  }
});

test("the upper bound keeps the calculation below the 200.000 euro sterilisation rule", () => {
  // Oltre 200.000 euro di reddito complessivo la legge di bilancio 2026 annulla
  // il beneficio del 33% riducendo le detrazioni: fuori dal perimetro modellato.
  assert.equal(MAX_RAL, 200_000);
  assert.ok(at(MAX_RAL, 13).taxableIncome < 200_000);
});
