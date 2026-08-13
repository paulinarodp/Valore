"use client";

import { useMemo, useState } from "react";
import { BadgeEuro, ChevronDown, ExternalLink, ShieldCheck } from "lucide-react";

import { calculateSalary } from "@/lib/payroll/calculateSalary.ts";
import { compareCompensationLevers, findRaiseTrap } from "@/lib/payroll/levers.ts";
import {
  DEFAULT_RAL,
  DEFAULT_TARGET_NET,
  MAX_RAL,
  MAX_TARGET_NET,
  MIN_RAL,
  MIN_TARGET_NET,
} from "@/lib/payroll/constants.ts";
import { money, percent, shortMoney } from "@/lib/payroll/format.ts";
import { DEFAULT_LOCATION_ID, ITALY_2026 } from "@/lib/payroll/rules/italy-2026.ts";
import type { CalculationStep, PayPeriods, SalaryResult } from "@/lib/payroll/types.ts";

const PAY_PERIOD_OPTIONS: PayPeriods[] = [12, 13, 14];

type SectionId = "calcolo" | "leve" | "localita" | "perimetro";

const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
  { id: "calcolo", label: "Il calcolo", hint: "Voce per voce, dal lordo al netto" },
  { id: "leve", label: "Aumentare il netto", hint: "Le tre strade e quanto costano" },
  { id: "localita", label: "Località", hint: "Quanto pesa il comune di residenza" },
  { id: "perimetro", label: "Perimetro e fonti", hint: "Cosa è incluso e da dove viene" },
];

/** Accetta sia "46000" sia "46.000", con o senza simbolo di valuta. */
function parseRal(input: string) {
  const digits = input.replace(/[^\d]/g, "");
  return digits === "" ? Number.NaN : Number(digits);
}

/**
 * Raggruppa le migliaia. Applicato solo quando il campo perde il focus: farlo
 * a ogni battuta sposterebbe il cursore mentre si scrive.
 */
function groupThousands(input: string) {
  const value = parseRal(input);
  return Number.isFinite(value) ? value.toLocaleString("it-IT", { useGrouping: "always" }) : input;
}

export default function Home() {
  const [ralInput, setRalInput] = useState(() => groupThousands(String(DEFAULT_RAL)));
  const [payPeriods, setPayPeriods] = useState<PayPeriods>(13);
  const [locationId, setLocationId] = useState(DEFAULT_LOCATION_ID);
  const [hasChildren, setHasChildren] = useState(false);
  const [section, setSection] = useState<SectionId>("calcolo");
  /** Ultima RAL valida: regge il risultato mentre si sta ancora scrivendo. */
  const [appliedRal, setAppliedRal] = useState(DEFAULT_RAL);
  const [targetInput, setTargetInput] = useState(() => groupThousands(String(DEFAULT_TARGET_NET)));
  const [appliedTarget, setAppliedTarget] = useState(DEFAULT_TARGET_NET);

  const parsedRal = parseRal(ralInput);
  const isValid = Number.isFinite(parsedRal) && parsedRal >= MIN_RAL && parsedRal <= MAX_RAL;
  const isOutOfRange = ralInput.trim() !== "" && !isValid;

  /**
   * Il calcolo è derivato dagli input, non salvato in stato: ogni modifica si
   * riflette subito. Un valore incompleto o fuori intervallo non azzera la
   * pagina, lascia in vista l'ultimo risultato valido con un avviso accanto.
   */
  const result: SalaryResult = useMemo(
    () => calculateSalary({ annualGross: appliedRal, payPeriods, locationId }, ITALY_2026),
    [appliedRal, payPeriods, locationId],
  );

  function handleRal(value: string) {
    setRalInput(value);
    const next = parseRal(value);
    if (Number.isFinite(next) && next >= MIN_RAL && next <= MAX_RAL) setAppliedRal(next);
  }

  function handleTarget(value: string) {
    setTargetInput(value);
    const next = parseRal(value);
    if (Number.isFinite(next) && next >= MIN_TARGET_NET && next <= MAX_TARGET_NET) {
      setAppliedTarget(next);
    }
  }

  return (
    <main className="page">
      <header className="masthead">
        <div className="masthead-copy">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true"><BadgeEuro size={21} /></span>
            <span>
              <strong>Valore</strong>
              <small>Payroll intelligence</small>
            </span>
          </div>
          <h1>Dalla RAL al netto</h1>
          <p className="standfirst">
            Quanto resta in tasca a un dipendente, e quanto costa all&apos;azienda fargli
            arrivare quel netto.
          </p>
        </div>
        <span className="year-badge">
          <ShieldCheck size={17} aria-hidden="true" />
          <span>
            Anno d&apos;imposta {ITALY_2026.taxYear}
            <small>Regole verificate · {ITALY_2026.id}</small>
          </span>
        </span>
      </header>

      <form className="card calculator" onSubmit={(event) => event.preventDefault()}>
        <div className="inputs">
          <div className="field">
            <label htmlFor="ral">Retribuzione annua lorda</label>
            <div className={isOutOfRange ? "money-input invalid" : "money-input"}>
              <span aria-hidden="true">€</span>
              <input
                id="ral"
                name="ral"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={ralInput}
                aria-describedby="ral-help"
                aria-invalid={isOutOfRange ? true : undefined}
                onChange={(event) => handleRal(event.target.value)}
                onBlur={() => setRalInput(groupThousands(String(appliedRal)))}
              />
            </div>
            <p className="help" id="ral-help">
              {isOutOfRange
                ? `Fuori intervallo: da ${shortMoney(MIN_RAL)} a ${shortMoney(MAX_RAL)}`
                : `Da ${shortMoney(MIN_RAL)} a ${shortMoney(MAX_RAL)}`}
            </p>
          </div>

          <div className="field">
            <label htmlFor="location">Residenza fiscale</label>
            <div className="select-input">
              <select
                id="location"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                {ITALY_2026.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.municipality}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
            <p className="help">{result.location.region}</p>
          </div>

          <div className="field">
            <span className="label" id="pay-periods-label">Mensilità</span>
            <div className="segmented" role="group" aria-labelledby="pay-periods-label">
              {PAY_PERIOD_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={payPeriods === value ? "selected" : ""}
                  aria-pressed={payPeriods === value}
                  onClick={() => setPayPeriods(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="help">Su quante mensilità è distribuita la RAL</p>
          </div>
        </div>

        <p className="profile">
          <strong>Profilo:</strong> dipendente del settore privato, contratto a tempo
          indeterminato full-time per tutto l&apos;anno, nessuna agevolazione o detrazione oltre a
          quelle spettanti a tutti i lavoratori dipendenti.
        </p>
      </form>

      <Result result={result} />

      <SectionNav active={section} onChange={setSection} />

      <div
        className="panel"
        id="panel-calcolo"
        role="tabpanel"
        aria-labelledby="tab-calcolo"
        hidden={section !== "calcolo"}
      >
        <div className="split">
          <Ledger result={result} />
          <EmployerCost result={result} />
        </div>
      </div>

      <div
        className="panel"
        id="panel-leve"
        role="tabpanel"
        aria-labelledby="tab-leve"
        hidden={section !== "leve"}
      >
        <CompensationLevers
          result={result}
          hasChildren={hasChildren}
          onChildrenChange={setHasChildren}
          targetNet={appliedTarget}
          targetInput={targetInput}
          onTargetChange={handleTarget}
          onTargetBlur={() => setTargetInput(groupThousands(String(appliedTarget)))}
        />
      </div>

      <div
        className="panel"
        id="panel-localita"
        role="tabpanel"
        aria-labelledby="tab-localita"
        hidden={section !== "localita"}
      >
        <LocationComparison result={result} onSelect={setLocationId} />
      </div>

      <div
        className="panel"
        id="panel-perimetro"
        role="tabpanel"
        aria-labelledby="tab-perimetro"
        hidden={section !== "perimetro"}
      >
        <div className="split">
          <Assumptions />
          <Sources />
        </div>
      </div>

      <footer className="colophon">
        <span>Regole {result.rulesetId}, verificate il {formatDate(result.verifiedAt)}.</span>
        <span>Stima indicativa: non sostituisce il cedolino né il conguaglio di fine anno.</span>
      </footer>
    </main>
  );
}

/** Navigazione fra le sezioni, con le frecce oltre al clic. */
function SectionNav({
  active,
  onChange,
}: {
  active: SectionId;
  onChange: (id: SectionId) => void;
}) {
  function handleKey(event: React.KeyboardEvent, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = SECTIONS[(index + delta + SECTIONS.length) % SECTIONS.length]!;
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  return (
    <div className="section-nav" role="tablist" aria-label="Sezioni del calcolatore">
      {SECTIONS.map((item, index) => (
        <button
          key={item.id}
          type="button"
          id={`tab-${item.id}`}
          role="tab"
          className={active === item.id ? "section-tab active" : "section-tab"}
          aria-selected={active === item.id}
          aria-controls={`panel-${item.id}`}
          tabIndex={active === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => handleKey(event, index)}
        >
          <strong>{item.label}</strong>
          <small>{item.hint}</small>
        </button>
      ))}
    </div>
  );
}

function Result({ result }: { result: SalaryResult }) {
  const netFromGross = result.annualNet - result.taxFreeBonus;
  const surtaxes = result.regionalSurtax + result.municipalSurtax;
  const share = (value: number) => `${(value / result.annualGross) * 100}%`;


  return (
      <section className="card headline" aria-labelledby="headline-title">
        <div className="headline-figures">
          <div className="figure primary">
            <span className="figure-label" id="headline-title">Netto annuale</span>
            <strong>{shortMoney(result.annualNet)}</strong>
          </div>
          <div className="figure">
            <span className="figure-label">Netto per mensilità</span>
            <strong>{shortMoney(result.netPerPayPeriod)}</strong>
            <span className="figure-note">× {result.payPeriods} mensilità</span>
          </div>
          <div className="figure">
            <span className="figure-label">Totale trattenute</span>
            <strong>{shortMoney(result.totalWithheld)}</strong>
            <span className="figure-note">{percent(result.withheldRate / 100)} della RAL</span>
          </div>
        </div>

        <div className="composition">
          <div className="bar" role="img" aria-label={`Su ${shortMoney(result.annualGross)} di RAL, ${shortMoney(netFromGross)} restano netti`}>
            <span className="seg net" style={{ width: share(netFromGross) }} />
            <span className="seg contributions" style={{ width: share(result.contributions) }} />
            <span className="seg irpef" style={{ width: share(result.netIrpef) }} />
            <span className="seg surtax" style={{ width: share(surtaxes) }} />
          </div>
          <ul className="legend">
            <LegendItem tone="net" label="Netto" value={netFromGross} />
            <LegendItem tone="contributions" label="Contributi" value={result.contributions} />
            <LegendItem tone="irpef" label="IRPEF netta" value={result.netIrpef} />
            <LegendItem tone="surtax" label="Addizionali" value={surtaxes} />
          </ul>
        </div>

      </section>
  );
}

/** La sequenza completa dal lordo al netto, riga per riga. */
function Ledger({ result }: { result: SalaryResult }) {
  return (
    <section className="card ledger" aria-labelledby="ledger-title">
      <div className="card-header">
        <h2 id="ledger-title">Dal lordo al netto</h2>
        <p>Apri una riga per vedere il calcolo e la fonte della regola applicata.</p>
      </div>
      <ol className="steps">
        {result.steps.map((step) => <Step key={step.id} step={step} />)}
      </ol>
    </section>
  );
}

/**
 * Il lato azienda. Il netto da solo racconta metà della storia: l'altra metà è
 * quanto quel netto costa a chi lo paga, che è il numero da cui parte qualsiasi
 * ragionamento di cost saving.
 */
function EmployerCost({ result }: { result: SalaryResult }) {
  const share = (value: number) => `${(value / result.employerCost) * 100}%`;
  const taxesAndContributions = result.employerCost - result.annualNet - result.tfr;

  return (
    <section className="card employer" aria-labelledby="employer-title">
      <div className="card-header">
        <h2 id="employer-title">Quanto costa all&apos;azienda</h2>
        <p>La stessa retribuzione vista dal lato di chi la paga.</p>
      </div>

      <div className="employer-figures">
        <div className="figure">
          <span className="figure-label">Costo aziendale</span>
          <strong>{shortMoney(result.employerCost)}</strong>
          <span className="figure-note">RAL, contributi datore e TFR</span>
        </div>
        <div className="figure">
          <span className="figure-label">Netto al dipendente</span>
          <strong className="accent-net">{shortMoney(result.annualNet)}</strong>
          <span className="figure-note">
            {percent(result.annualNet / result.employerCost)} del costo
          </span>
        </div>
        <div className="figure">
          <span className="figure-label">Cuneo fiscale e contributivo</span>
          <strong>{percent(result.taxWedgeRate / 100)}</strong>
          <span className="figure-note">del costo aziendale</span>
        </div>
      </div>

      <div className="bar wedge-bar" role="img" aria-label={`Su ${shortMoney(result.employerCost)} di costo aziendale, ${shortMoney(result.annualNet)} arrivano netti al dipendente`}>
        <span className="seg net" style={{ width: share(result.annualNet) }} />
        <span className="seg irpef" style={{ width: share(taxesAndContributions) }} />
        <span className="seg tfr" style={{ width: share(result.tfr) }} />
      </div>
      <ul className="legend">
        <LegendItem tone="net" label="Netto in busta" value={result.annualNet} />
        <LegendItem tone="irpef" label="Imposte e contributi" value={taxesAndContributions} />
        <LegendItem tone="tfr" label="TFR accantonato" value={result.tfr} />
      </ul>

      <p className="employer-note">
        Su ogni <strong>100 €</strong> spesi dall&apos;azienda ne arrivano netti{" "}
        <strong>{Math.round((result.annualNet / result.employerCost) * 100)} €</strong>. Il TFR
        resta comunque del dipendente, ma differito. L&apos;INAIL è escluso: varia dallo 0,4% al 6%
        secondo la lavorazione, e senza saperla ogni numero sarebbe inventato.
      </p>
    </section>
  );
}

/**
 * Il punto di tutto: a parità di netto consegnato, le tre leve costano
 * all'azienda cifre molto diverse. È qui che si vede il risparmio.
 *
 * L'obiettivo è un input, non una costante: sotto i 1.000 € il fringe benefit
 * copre tutto, sopra i 5.000 € nemmeno il premio ci arriva, e il confronto
 * racconta cose diverse nei due casi.
 */
function CompensationLevers({
  result,
  hasChildren,
  onChildrenChange,
  targetNet,
  targetInput,
  onTargetChange,
  onTargetBlur,
}: {
  result: SalaryResult;
  hasChildren: boolean;
  onChildrenChange: (value: boolean) => void;
  targetNet: number;
  targetInput: string;
  onTargetChange: (value: string) => void;
  onTargetBlur: () => void;
}) {
  const levers = compareCompensationLevers(result, ITALY_2026, {
    targetNet,
    hasDependentChildren: hasChildren,
  });
  // Da certe RAL un aumento fa scendere il netto: va detto prima, non dopo.
  const trap = findRaiseTrap(
    {
      annualGross: result.annualGross,
      payPeriods: result.payPeriods,
      locationId: result.location.id,
    },
    result.annualNet,
    ITALY_2026,
  );
  // Il confronto si fa solo fra le leve davvero utilizzabili in questo caso.
  const usable = levers.filter((lever) => lever.available);
  const best = usable.reduce<typeof levers[number] | null>(
    (a, b) => (a === null || b.efficiency > a.efficiency ? b : a),
    null,
  );
  const salary = usable.find((lever) => lever.id === "salary");
  const fringe = usable.find((lever) => lever.id === "fringe");

  return (
    <section className="card levers" aria-labelledby="levers-title">
      <div className="card-header with-control">
        <div className="card-header-copy">
          <h2 id="levers-title">
            Dare {shortMoney(targetNet)} netti in più: le tre strade
          </h2>
          <p>
            Stesso netto in tasca al dipendente, costo per l&apos;azienda molto diverso.
          </p>
        </div>
        <div className="field target-field">
          <label htmlFor="target-net">Obiettivo netto</label>
          <div className="money-input compact">
            <span aria-hidden="true">€</span>
            <input
              id="target-net"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={targetInput}
              onChange={(event) => onTargetChange(event.target.value)}
              onBlur={onTargetBlur}
              aria-describedby="target-net-help"
            />
          </div>
          <p className="help" id="target-net-help">
            Da {shortMoney(MIN_TARGET_NET)} a {shortMoney(MAX_TARGET_NET)}
          </p>
        </div>

        <div className="field">
          <span className="label" id="children-label">Figli a carico</span>
          <div className="segmented" role="group" aria-labelledby="children-label">
            <button
              type="button"
              className={hasChildren ? "" : "selected"}
              aria-pressed={!hasChildren}
              onClick={() => onChildrenChange(false)}
            >
              No
            </button>
            <button
              type="button"
              className={hasChildren ? "selected" : ""}
              aria-pressed={hasChildren}
              onClick={() => onChildrenChange(true)}
            >
              Sì
            </button>
          </div>
          <p className="help">Raddoppia la soglia esente</p>
        </div>
      </div>

      {trap ? (
        <p className="raise-trap">
          <strong>Attenzione:</strong> da questa RAL un aumento fa <em>scendere</em> il netto. A{" "}
          {shortMoney(trap.bottomGross)} di RAL il dipendente incassa{" "}
          <strong>{shortMoney(trap.netDrop)} in meno</strong> di adesso, e il netto torna al livello
          attuale solo dai {shortMoney(trap.recoveryGross)} in su. Succede perché una soglia qui
          vicino non è una franchigia: superata, l&apos;onere si applica per intero. In questa
          fascia le leve agevolate non sono solo più efficienti, sono l&apos;unica strada che non
          peggiora la situazione.
        </p>
      ) : null}

      <div className="lever-grid">
        {levers.map((lever) => (
          <article
            key={lever.id}
            className={[
              "lever",
              lever.available ? "" : "unavailable",
              lever.id === best?.id ? "best" : "",
            ].filter(Boolean).join(" ")}
          >
            <header>
              <h3>{lever.label}</h3>
              {lever.id === best?.id ? <span className="badge">più efficiente</span> : null}
              {lever.available ? null : <span className="badge muted">non disponibile</span>}
            </header>

            {lever.available ? (
              <dl>
                <div>
                  <dt>Costo azienda</dt>
                  <dd className="lever-cost">{shortMoney(lever.employerCost)}</dd>
                </div>
                <div>
                  <dt>Netto consegnato</dt>
                  <dd className={lever.netDelivered < targetNet ? "capped" : undefined}>
                    {shortMoney(lever.netDelivered)}
                    {lever.netDelivered < targetNet
                      ? <small>su {shortMoney(targetNet)}</small>
                      : null}
                  </dd>
                </div>
                <div>
                  <dt>Efficienza</dt>
                  <dd>{percent(lever.efficiency / 100)}</dd>
                </div>
              </dl>
            ) : (
              <p className="lever-unavailable">{lever.unavailableReason}</p>
            )}

            <p className="lever-constraint">{lever.constraint}</p>
            <a href={lever.source.url} target="_blank" rel="noreferrer" className="step-source">
              {lever.source.name}
              <ExternalLink size={13} />
            </a>
          </article>
        ))}
      </div>

      {salary && fringe ? (
        <p className="levers-note">
          Ogni euro netto consegnato via RAL costa all&apos;azienda{" "}
          <strong>{(salary.employerCost / salary.netDelivered).toFixed(2).replace(".", ",")} €</strong>,
          contro <strong>1,00 €</strong> in fringe benefit: circa{" "}
          <strong>
            {(salary.employerCost / salary.netDelivered).toFixed(1).replace(".", ",")} volte
          </strong>{" "}
          tanto, per lo stesso risultato in tasca.{" "}
          {fringe && fringe.netDelivered < targetNet
            ? `Il fringe benefit però si ferma a ${shortMoney(fringe.netDelivered)}: oltre la soglia l'intero valore diventerebbe imponibile${hasChildren ? "" : ", e con figli a carico la soglia raddoppia"}. `
            : ""}
          Le leve agevolate hanno tetti e condizioni, quindi non sostituiscono la retribuzione: la
          rendono più efficiente ai margini.
        </p>
      ) : null}

      <p className="scope-callout">
        I figli a carico non cambiano il netto in busta: dal 2022 l&apos;assegno unico ha sostituito
        le detrazioni per i figli sotto i 21 anni, e l&apos;assegno non è reddito imponibile. Qui
        incidono solo sulla soglia esente dei fringe benefit.
      </p>
    </section>
  );
}

/**
 * Confronto fra tutte le località supportate a parità di RAL e mensilità.
 *
 * Non serve un secondo selettore: sono cinque, entrano tutte in una tabella, e
 * vederle insieme risponde alla domanda meglio di un confronto a due.
 */
function LocationComparison({
  result,
  onSelect,
}: {
  result: SalaryResult;
  onSelect: (locationId: string) => void;
}) {
  const rows = ITALY_2026.locations
    .map((location) => {
      const scenario = location.id === result.location.id
        ? result
        : calculateSalary(
          {
            annualGross: result.annualGross,
            payPeriods: result.payPeriods,
            locationId: location.id,
          },
          ITALY_2026,
        );
      return {
        location,
        annualNet: scenario.annualNet,
        surtaxes: scenario.regionalSurtax + scenario.municipalSurtax,
        delta: scenario.annualNet - result.annualNet,
      };
    })
    .sort((a, b) => b.annualNet - a.annualNet);

  const spread = rows[0]!.annualNet - rows[rows.length - 1]!.annualNet;

  return (
    <section className="card comparison" aria-labelledby="comparison-title">
      <div className="card-header">
        <h2 id="comparison-title">Quanto pesa il comune di residenza</h2>
        <p>
          Stessa RAL di {shortMoney(result.annualGross)} e stesse {result.payPeriods} mensilità,
          nelle località supportate.
        </p>
      </div>

      <table className="comparison-table">
        <thead>
          <tr>
            <th scope="col">Località</th>
            <th scope="col" className="numeric">Addizionali</th>
            <th scope="col" className="numeric">Netto annuale</th>
            <th scope="col" className="numeric">Differenza</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = row.location.id === result.location.id;
            return (
              <tr key={row.location.id} className={selected ? "selected" : ""}>
                <th scope="row">
                  <button type="button" onClick={() => onSelect(row.location.id)}>
                    {row.location.municipality}
                  </button>
                  <small>{row.location.region}</small>
                </th>
                <td className="numeric muted">{shortMoney(row.surtaxes)}</td>
                <td className="numeric strong">{shortMoney(row.annualNet)}</td>
                <td className="numeric">
                  {selected
                    ? <span className="muted">selezionata</span>
                    : (
                      <span className={row.delta > 0 ? "positive" : "negative"}>
                        {row.delta > 0 ? "+" : "−"}{shortMoney(Math.abs(row.delta))}
                      </span>
                    )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="comparison-note">
        Fra la località più conveniente e la meno conveniente ballano{" "}
        <strong>{shortMoney(spread)}</strong> l&apos;anno, circa{" "}
        {percent(spread / result.annualGross)} della RAL: IRPEF e contributi sono nazionali, quindi
        il comune muove solo le addizionali. Contano più le aliquote della regione che quelle del
        comune.
      </p>
    </section>
  );
}

function LegendItem({ tone, label, value }: { tone: string; label: string; value: number }) {
  return (
    <li>
      <span className={`dot ${tone}`} aria-hidden="true" />
      <span className="legend-label">{label}</span>
      <span className="legend-value">{shortMoney(value)}</span>
    </li>
  );
}

function Step({ step }: { step: CalculationStep }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(step.detail?.length || step.source || step.note);
  // Una voce a zero (per esempio un'addizionale in esenzione) resta in elenco,
  // ma senza segno: "−0,00 €" si leggerebbe come un errore.
  const isZero = step.amount === 0;
  const sign = isZero ? "" : step.effect === "subtract" ? "−" : step.effect === "add" ? "+" : "";

  return (
    <li className={isZero ? `step ${step.effect} zero` : `step ${step.effect}`}>
      <button
        type="button"
        className="step-row"
        onClick={() => setOpen(!open)}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
      >
        <span className="step-label">{step.label}</span>
        <span className="step-amount">{sign}{money(step.amount)}</span>
        <span className="step-chevron" aria-hidden="true">
          {expandable ? <ChevronDown size={16} /> : null}
        </span>
      </button>

      {open ? (
        <div className="step-body">
          <p className="step-formula">{step.formula}</p>

          {step.detail?.length ? (
            <table className="detail">
              <tbody>
                {step.detail.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td className="detail-formula">{row.formula}</td>
                    <td className="detail-amount">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {step.note ? <p className="step-note">{step.note}</p> : null}

          {step.source ? (
            <a className="step-source" href={step.source.url} target="_blank" rel="noreferrer">
              {step.source.name}
              <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

const INCLUDED = [
  "Contributi previdenziali a carico del dipendente, aliquota IVS ordinaria FPLD",
  "Aliquota aggiuntiva dell'1% sulla quota oltre la prima fascia pensionabile",
  "IRPEF per scaglioni con le aliquote 2026",
  "Detrazione per lavoro dipendente (art. 13 TUIR)",
  "Taglio del cuneo fiscale: somma esente o ulteriore detrazione, secondo il reddito",
  "Addizionali regionali e comunali delle cinque località supportate",
  "Costo aziendale: contributi a carico del datore e accantonamento TFR",
  "Confronto fra aumento di RAL, premio di risultato e fringe benefit",
];

const EXCLUDED = [
  "Detrazioni per familiari a carico e altri oneri deducibili o detraibili",
  "Previdenza complementare e altre forme di welfare oltre ai fringe benefit",
  "Regimi agevolati come impatriati, apprendistato o dirigenti",
  "Differenze contributive fra CCNL, qualifiche o fondi specifici",
  "INAIL, che varia dallo 0,4% al 6% secondo la classe di rischio",
  "Anni parziali, part-time, più datori di lavoro",
  "Detrazioni regionali per figli a carico, previste da Piemonte e Puglia",
  "Comuni le cui regioni non hanno pubblicato le aliquote 2026: Roma, Napoli, Bologna, Genova",
  "Tempistiche reali delle ritenute: le addizionali si versano a rate nell'anno successivo",
];

function Assumptions() {
  return (
    <section className="card scope" aria-labelledby="scope-title">
      <div className="card-header">
        <h2 id="scope-title">Cosa considera il calcolo</h2>
        <p>
          Il calcolo copre un caso standard. Tutto ciò che è fuori perimetro è escluso in modo
          esplicito, non approssimato.
        </p>
      </div>
      <div className="scope-columns">
        <div>
          <h3 className="scope-heading included">Incluso</h3>
          <ul className="scope-list included">
            {INCLUDED.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="scope-heading excluded">Non incluso</h3>
          <ul className="scope-list excluded">
            {EXCLUDED.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

const NATIONAL_SOURCES = [
  ITALY_2026.irpefSource,
  ITALY_2026.employmentDeductionSource,
  ITALY_2026.contributions.source,
  ITALY_2026.contributions.thresholdSource,
];

const LOCAL_SOURCES = ITALY_2026.locations.flatMap((location) => [
  location.regionalSurtax.source,
  location.municipalSurtax.source,
]);

function Sources() {
  return (
    <section className="card sources" aria-labelledby="sources-title">
      <div className="card-header">
        <h2 id="sources-title">Fonti</h2>
        <p>Ogni aliquota usata dal calcolatore viene da uno di questi riferimenti.</p>
      </div>
      <div className="source-columns">
        <div>
          <h3 className="scope-heading">Regole nazionali</h3>
          <SourceList sources={NATIONAL_SOURCES} />
        </div>
        <div>
          <h3 className="scope-heading">Addizionali locali</h3>
          <SourceList sources={LOCAL_SOURCES} />
        </div>
      </div>
    </section>
  );
}

function SourceList({ sources }: { sources: { name: string; url: string }[] }) {
  return (
    <ul className="source-list">
      {sources.map((source) => (
        <li key={source.url}>
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.name}
            <ExternalLink size={13} />
          </a>
        </li>
      ))}
    </ul>
  );
}

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}
