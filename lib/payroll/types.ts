/** Numero di mensilità con cui la RAL viene distribuita nell'anno. */
export type PayPeriods = 12 | 13 | 14;

/** Riferimento alla fonte ufficiale da cui è stata presa una regola. */
export type RuleSource = {
  name: string;
  url: string;
  /** Anno del dato consultato, quando la fonte pubblica serie annuali. */
  year?: number;
  /** Distingue una regola verificata da una semplificazione dichiarata. */
  status?: "verified" | "assumption_documented";
  note?: string;
};

/** Scaglione di un'imposta progressiva: `upTo: null` indica l'ultimo scaglione. */
export type TaxBracket = {
  upTo: number | null;
  rate: number;
};

export type SurtaxRule = {
  id: string;
  label: string;
  brackets: TaxBracket[];
  /**
   * `progressive`: l'aliquota si applica per scaglioni (addizionale regionale).
   * `flatAboveThreshold`: sotto la soglia di esenzione non si paga nulla, sopra
   * l'aliquota si applica all'intero imponibile (addizionale comunale di Milano).
   */
  application: "progressive" | "flatAboveThreshold";
  exemptionThreshold: number;
  source: RuleSource;
};

export type ContributionRule = {
  /** Aliquota IVS a carico del dipendente. */
  employeeRate: number;
  /** Aliquota aggiuntiva sulla quota eccedente la prima fascia pensionabile. */
  additionalRate: number;
  additionalRateThreshold: number;
  source: RuleSource;
  thresholdSource: RuleSource;
};

/**
 * Una residenza fiscale selezionabile: il comune, la sua regione e le due
 * addizionali che ne derivano. IRPEF e contributi non dipendono dal comune.
 */
export type Location = {
  id: string;
  municipality: string;
  region: string;
  regionalSurtax: SurtaxRule;
  municipalSurtax: SurtaxRule;
};

/** Oneri che l'azienda sostiene sopra la RAL. */
export type EmployerCostRule = {
  /** Contributi a carico del datore di lavoro, in percentuale sulla RAL. */
  contributionRate: number;
  /** Quota IVS certa dentro l'aliquota complessiva, usata solo per spiegarla. */
  ivsRate: number;
  /** Accantonamento TFR: retribuzione / 13,5. */
  tfrRate: number;
  source: RuleSource;
};

/**
 * Le tre strade per dare più soldi netti a un dipendente. Hanno costi molto
 * diversi per l'azienda, ed è lì che nasce il risparmio.
 */
export type CompensationLeverRules = {
  performanceBonus: {
    /** Imposta sostitutiva che sostituisce IRPEF e addizionali. */
    substituteTaxRate: number;
    annualCap: number;
    /** Reddito da lavoro dipendente dell'anno precedente oltre cui non spetta. */
    eligibilityIncomeCap: number;
    source: RuleSource;
  };
  fringeBenefit: {
    threshold: number;
    thresholdWithChildren: number;
    source: RuleSource;
  };
};

export type PayrollRuleset = {
  id: string;
  taxYear: number;
  /** Data in cui le regole sono state verificate sulle fonti ufficiali. */
  verifiedAt: string;
  irpefBrackets: TaxBracket[];
  irpefSource: RuleSource;
  employmentDeductionSource: RuleSource;
  contributions: ContributionRule;
  employer: EmployerCostRule;
  levers: CompensationLeverRules;
  locations: Location[];
};

/** Riga della sequenza di calcolo mostrata all'utente. */
export type CalculationStep = {
  id: string;
  label: string;
  /** Importo sempre positivo: il segno è dato da `effect`. */
  amount: number;
  effect: "base" | "subtract" | "add" | "subtotal" | "total";
  /** L'aritmetica di questa riga, in chiaro. */
  formula: string;
  source?: RuleSource;
  /** Semplificazione o approssimazione applicata in questo passaggio. */
  note?: string;
  /** Passaggi intermedi, ad esempio i singoli scaglioni IRPEF. */
  detail?: {
    label: string;
    formula: string;
    amount: number;
  }[];
};

export type SalaryInput = {
  annualGross: number;
  payPeriods: PayPeriods;
  locationId: string;
};

export type SalaryResult = {
  rulesetId: string;
  taxYear: number;
  verifiedAt: string;

  annualGross: number;
  payPeriods: PayPeriods;
  location: Location;

  contributions: number;
  taxableIncome: number;
  grossIrpef: number;
  employmentDeduction: number;
  extraDeduction: number;
  netIrpef: number;
  regionalSurtax: number;
  municipalSurtax: number;
  /** Somma non imponibile (taglio del cuneo fiscale): si aggiunge al netto. */
  taxFreeBonus: number;

  /** IRPEF netta + addizionali. */
  totalTaxes: number;
  /** Imposte + contributi: tutto ciò che viene trattenuto dal lordo. */
  totalWithheld: number;

  annualNet: number;
  netPerPayPeriod: number;
  /** Percentuale della RAL trattenuta fra imposte e contributi. */
  withheldRate: number;

  /** Contributi a carico del datore di lavoro. */
  employerContributions: number;
  /** Accantonamento TFR dell'anno. */
  tfr: number;
  /** RAL più contributi datore più TFR. */
  employerCost: number;
  /**
   * Quota del costo aziendale che non arriva netta al dipendente: il cuneo
   * fiscale e contributivo, in percentuale.
   */
  taxWedgeRate: number;

  steps: CalculationStep[];
};
