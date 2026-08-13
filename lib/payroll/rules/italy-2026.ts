import type { Location, PayrollRuleset } from "../types.ts";

/**
 * Fonti ufficiali per le addizionali locali.
 *
 * Il portale del Dipartimento delle Finanze è la fonte primaria: pubblica le
 * aliquote regionali per anno e le delibere comunali vigenti. I link puntano
 * alla singola interrogazione, così ogni valore è verificabile in un clic.
 */
const mefRegion = (code: number, region: string) => ({
  name: `MEF, addizionale regionale IRPEF ${region} 2026`,
  url: `https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=${code}`,
  year: 2026,
  status: "verified" as const,
});

const mefMunicipality = (province: string, cadastralCode: string, municipality: string) => ({
  name: `MEF, addizionale comunale IRPEF di ${municipality}, ultima delibera disponibile 2025`,
  url: `https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/risultato.htm?anno=2025&cm=&pr=${province}&cc=${cadastralCode}&r=1`,
  year: 2025,
  status: "assumption_documented" as const,
  note: `Il portale MEF non pubblica ancora dati comunali 2026 per ${municipality}. Il prototipo usa esplicitamente l'ultima delibera disponibile, relativa al 2025, come assunzione.`,
});

/**
 * Località supportate.
 *
 * Ne compaiono cinque e non venti: sono quelle per cui il portale MEF pubblica
 * le aliquote regionali 2026. Per la componente comunale il portale non espone
 * ancora dati 2026: il prototipo usa la delibera 2025 come assunzione esplicita,
 * versionata e visibile all'utente, mai come fallback silenzioso.
 */
const LOCATIONS: Location[] = [
  {
    id: "milano",
    municipality: "Milano",
    region: "Lombardia",
    regionalSurtax: {
      id: "LOMBARDIA_2026",
      label: "Addizionale regionale Lombardia",
      application: "progressive",
      exemptionThreshold: 0,
      brackets: [
        { upTo: 15_000, rate: 0.0123 },
        { upTo: 28_000, rate: 0.0158 },
        { upTo: 50_000, rate: 0.0172 },
        { upTo: null, rate: 0.0173 },
      ],
      source: mefRegion(10, "Lombardia"),
    },
    municipalSurtax: {
      id: "MILANO_2025_ASSUMPTION",
      label: "Addizionale comunale Milano",
      application: "flatAboveThreshold",
      exemptionThreshold: 23_000,
      brackets: [{ upTo: null, rate: 0.008 }],
      source: mefMunicipality("MI", "F205", "Milano"),
    },
  },
  {
    id: "torino",
    municipality: "Torino",
    region: "Piemonte",
    regionalSurtax: {
      id: "PIEMONTE_2026",
      label: "Addizionale regionale Piemonte",
      application: "progressive",
      exemptionThreshold: 0,
      brackets: [
        { upTo: 15_000, rate: 0.0162 },
        { upTo: 28_000, rate: 0.0268 },
        { upTo: 50_000, rate: 0.0331 },
        { upTo: null, rate: 0.0333 },
      ],
      source: mefRegion(13, "Piemonte"),
    },
    /** Unico comune del gruppo con aliquote comunali per scaglioni. */
    municipalSurtax: {
      id: "TORINO_2025_ASSUMPTION",
      label: "Addizionale comunale Torino",
      application: "progressive",
      exemptionThreshold: 11_790,
      brackets: [
        { upTo: 15_000, rate: 0.008 },
        { upTo: 28_000, rate: 0.008 },
        { upTo: 50_000, rate: 0.011 },
        { upTo: null, rate: 0.012 },
      ],
      source: mefMunicipality("TO", "L219", "Torino"),
    },
  },
  {
    id: "firenze",
    municipality: "Firenze",
    region: "Toscana",
    regionalSurtax: {
      id: "TOSCANA_2026",
      label: "Addizionale regionale Toscana",
      application: "progressive",
      exemptionThreshold: 0,
      brackets: [
        { upTo: 15_000, rate: 0.0142 },
        { upTo: 28_000, rate: 0.0143 },
        { upTo: 50_000, rate: 0.0332 },
        { upTo: null, rate: 0.0333 },
      ],
      source: mefRegion(17, "Toscana"),
    },
    municipalSurtax: {
      id: "FIRENZE_2025_ASSUMPTION",
      label: "Addizionale comunale Firenze",
      application: "flatAboveThreshold",
      exemptionThreshold: 25_000,
      brackets: [{ upTo: null, rate: 0.002 }],
      source: mefMunicipality("FI", "D612", "Firenze"),
    },
  },
  {
    id: "venezia",
    municipality: "Venezia",
    region: "Veneto",
    /** Il Veneto applica un'aliquota unica, non scaglioni. */
    regionalSurtax: {
      id: "VENETO_2026",
      label: "Addizionale regionale Veneto",
      application: "progressive",
      exemptionThreshold: 0,
      brackets: [{ upTo: null, rate: 0.0123 }],
      source: mefRegion(21, "Veneto"),
    },
    municipalSurtax: {
      id: "VENEZIA_2025_ASSUMPTION",
      label: "Addizionale comunale Venezia",
      application: "flatAboveThreshold",
      exemptionThreshold: 10_000,
      brackets: [{ upTo: null, rate: 0.008 }],
      source: mefMunicipality("VE", "L736", "Venezia"),
    },
  },
  {
    id: "bari",
    municipality: "Bari",
    region: "Puglia",
    regionalSurtax: {
      id: "PUGLIA_2026",
      label: "Addizionale regionale Puglia",
      application: "progressive",
      exemptionThreshold: 0,
      brackets: [
        { upTo: 15_000, rate: 0.0133 },
        { upTo: 28_000, rate: 0.0213 },
        { upTo: 50_000, rate: 0.0323 },
        { upTo: null, rate: 0.0333 },
      ],
      source: mefRegion(14, "Puglia"),
    },
    municipalSurtax: {
      id: "BARI_2025_ASSUMPTION",
      label: "Addizionale comunale Bari",
      application: "flatAboveThreshold",
      exemptionThreshold: 15_000,
      brackets: [{ upTo: null, rate: 0.008 }],
      source: mefMunicipality("BA", "A662", "Bari"),
    },
  },
];

/**
 * Regole fiscali e contributive usate dal calcolatore, anno d'imposta 2026.
 *
 * Ogni valore qui dentro ha una fonte e uno stato esplicito: verificato oppure
 * assunzione documentata. Il motore di calcolo non contiene numeri hardcoded:
 * legge tutto da questo file, così aggiornare un'aliquota o aggiungere un
 * comune è una modifica dichiarativa e non tocca la logica.
 */
export const ITALY_2026: PayrollRuleset = {
  id: "IT-2026",
  taxYear: 2026,
  verifiedAt: "2026-08-13",

  /**
   * La legge di bilancio 2026 (L. 199/2025) riduce la seconda aliquota IRPEF
   * dal 35% al 33%. Prima e terza aliquota restano invariate.
   */
  irpefBrackets: [
    { upTo: 28_000, rate: 0.23 },
    { upTo: 50_000, rate: 0.33 },
    { upTo: null, rate: 0.43 },
  ],
  irpefSource: {
    name: "Legge 199/2025 (legge di bilancio 2026), art. 1 co. 1",
    url: "https://www.mef.gov.it/focus/Principali-misure-della-legge-di-bilancio-2026/",
  },
  employmentDeductionSource: {
    name: "Art. 13 TUIR e L. 207/2024, art. 1 co. 4-9",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1986-12-22;917",
  },

  contributions: {
    // Aliquota IVS ordinaria a carico del dipendente, FPLD.
    employeeRate: 0.0919,
    // 1% aggiuntivo sulla quota oltre la prima fascia di retribuzione pensionabile.
    additionalRate: 0.01,
    additionalRateThreshold: 56_224,
    source: {
      name: "INPS, aliquota IVS a carico del lavoratore (FPLD)",
      url: "https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2023.02.circolare-numero-24-del-20-02-2023_14085.html",
    },
    thresholdSource: {
      name: "INPS, circolare n. 6 del 30 gennaio 2026 (prima fascia 2026: 56.224 €)",
      url: "https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html",
    },
  },

  /**
   * Costo del lavoro a carico dell'azienda.
   *
   * Il 23,81% di IVS è certo. Il resto (NASpI, malattia, maternità, CUAF, fondi
   * minori) cambia per settore, dimensione e CCNL, quindi il 30% complessivo è
   * un valore tipico per industria e commercio, non una regola universale.
   * L'INAIL è escluso di proposito: varia dallo 0,4% al 6% secondo la classe di
   * rischio, e senza sapere la lavorazione qualsiasi numero sarebbe inventato.
   */
  employer: {
    contributionRate: 0.30,
    ivsRate: 0.2381,
    // Quota TFR maturata nell'anno: retribuzione / 13,5.
    tfrRate: 0.0741,
    source: {
      name: "INPS, aliquote contributive datore di lavoro (FPLD, industria e commercio)",
      url: "https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2023.02.circolare-numero-24-del-20-02-2023_14085.html",
    },
  },

  levers: {
    /**
     * La legge di bilancio 2026 porta l'imposta sostitutiva dall'5% all'1% per
     * il 2026 e il 2027, e alza il tetto da 3.000 a 5.000 €. Sostituisce IRPEF
     * e addizionali, ma non i contributi, che restano dovuti da entrambe le parti.
     */
    performanceBonus: {
      substituteTaxRate: 0.01,
      annualCap: 5_000,
      eligibilityIncomeCap: 80_000,
      source: {
        name: "Legge 199/2025, imposta sostitutiva 1% sui premi di risultato",
        url: "https://www.mef.gov.it/focus/Principali-misure-della-legge-di-bilancio-2026/",
      },
    },
    /**
     * Soglie confermate dalla L. 207/2024 per il triennio 2025-2027. Dentro la
     * soglia il valore è esente sia fiscalmente sia contributivamente; superata
     * anche di un euro, diventa imponibile per intero.
     */
    fringeBenefit: {
      threshold: 1_000,
      thresholdWithChildren: 2_000,
      source: {
        name: "L. 207/2024, art. 1 co. 390-391, soglie fringe benefit 2025-2027",
        url: "https://www.mef.gov.it/focus/Principali-misure-della-legge-di-bilancio-2026/",
      },
    },
  },

  locations: LOCATIONS,
};

export const DEFAULT_LOCATION_ID = "milano";

export function findLocation(ruleset: PayrollRuleset, locationId: string) {
  const location = ruleset.locations.find((item) => item.id === locationId);
  if (!location) throw new Error(`Località non supportata: ${locationId}`);
  return location;
}
