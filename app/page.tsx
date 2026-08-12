"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Euro,
  Info,
  RefreshCw,
  Save,
  Scale,
  WalletCards,
} from "lucide-react";

type View = "offer" | "benchmark" | "checklist";
type Level = "Junior" | "Mid-level" | "Senior";
type Role = "Product Manager" | "Data Analyst" | "Software Engineer" | "Marketing Manager";

const roleBenchmarks: Record<Role, Record<Level, [number, number]>> = {
  "Product Manager": {
    Junior: [32000, 40000],
    "Mid-level": [40000, 52000],
    Senior: [52000, 70000],
  },
  "Data Analyst": {
    Junior: [30000, 38000],
    "Mid-level": [38000, 48000],
    Senior: [48000, 62000],
  },
  "Software Engineer": {
    Junior: [34000, 44000],
    "Mid-level": [44000, 58000],
    Senior: [58000, 78000],
  },
  "Marketing Manager": {
    Junior: [32000, 42000],
    "Mid-level": [42000, 55000],
    Senior: [55000, 72000],
  },
};

const defaultChecklist = [
  "RAL e livello indicati nella lettera di assunzione",
  "Formula, soglia e data di pagamento del bonus",
  "Giorni di lavoro da remoto messi per iscritto",
  "Periodo di prova e preavviso confermati",
  "Buoni pasto e welfare separati dalla RAL",
];

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function estimateNetFactor(ral: number) {
  if (ral <= 28000) return 0.73;
  if (ral <= 40000) return 0.69;
  if (ral <= 55000) return 0.65;
  if (ral <= 75000) return 0.62;
  return 0.59;
}

function positionLabel(ral: number, range: [number, number]) {
  if (ral < range[0]) return "Sotto il range";
  if (ral > range[1]) return "Sopra il range";
  return "Nel range";
}

export default function Home() {
  const [view, setView] = useState<View>("offer");
  const [role, setRole] = useState<Role>("Product Manager");
  const [level, setLevel] = useState<Level>("Mid-level");
  const [ral, setRal] = useState(46000);
  const [currentRal, setCurrentRal] = useState(40000);
  const [bonus, setBonus] = useState(8);
  const [months, setMonths] = useState<13 | 14>(13);
  const [remoteDays, setRemoteDays] = useState(2);
  const [mealVoucher, setMealVoucher] = useState(8);
  const [contract, setContract] = useState("CCNL Commercio");
  const [checkedItems, setCheckedItems] = useState<number[]>([0, 4]);
  const [saved, setSaved] = useState(false);

  const results = useMemo(() => {
    const targetBonus = ral * (bonus / 100);
    const mealValue = mealVoucher * 220;
    const flexibilityValue = remoteDays * 520;
    const packageValue = ral + targetBonus + mealValue + flexibilityValue;
    const estimatedAnnualNet = ral * estimateNetFactor(ral) + targetBonus * 0.58;
    const monthlyNet = estimatedAnnualNet / months;
    const increase = currentRal > 0 ? ((ral - currentRal) / currentRal) * 100 : 0;
    const range = roleBenchmarks[role][level];
    const marker = Math.max(2, Math.min(98, ((ral - range[0]) / (range[1] - range[0])) * 100));
    return {
      targetBonus,
      mealValue,
      flexibilityValue,
      packageValue,
      monthlyNet,
      increase,
      range,
      marker,
      position: positionLabel(ral, range),
    };
  }, [bonus, currentRal, level, mealVoucher, months, ral, remoteDays, role]);

  function resetScenario() {
    setRole("Product Manager");
    setLevel("Mid-level");
    setRal(46000);
    setCurrentRal(40000);
    setBonus(8);
    setMonths(13);
    setRemoteDays(2);
    setMealVoucher(8);
    setContract("CCNL Commercio");
    setCheckedItems([0, 4]);
  }

  function saveScenario() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function toggleChecklist(index: number) {
    setCheckedItems((items) =>
      items.includes(index) ? items.filter((item) => item !== index) : [...items, index],
    );
  }

  const navItems = [
    { id: "offer" as const, label: "Offerta", icon: WalletCards },
    { id: "benchmark" as const, label: "Benchmark", icon: BarChart3 },
    { id: "checklist" as const, label: "Checklist", icon: ClipboardCheck },
  ];

  return (
    <main className="app-shell">
      <aside className="side-rail">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">V</div>
          <div>
            <strong>Valore</strong>
            <span>Offer intelligence</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Viste principali">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={view === item.id ? "nav-button active" : "nav-button"}
                onClick={() => setView(item.id)}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.id === "checklist" ? (
                  <span className="nav-count">{checkedItems.length}/5</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="scope-note">
          <Info size={16} />
          <p>Stime indicative per l&apos;Italia. Due CCNL nel perimetro demo.</p>
        </div>
      </aside>

      <section className="workbench">
        <header className="topbar">
          <div>
            <span className="context-label">Scenario personale</span>
            <span className="scenario-name">Nuova offerta · Italia</span>
          </div>
          <div className="topbar-actions">
            <button type="button" className="icon-action" onClick={resetScenario} title="Ripristina scenario" aria-label="Ripristina scenario">
              <RefreshCw size={17} />
            </button>
            <button type="button" className="primary-action" onClick={saveScenario}>
              {saved ? <Check size={17} /> : <Save size={17} />}
              {saved ? "Salvato" : "Salva scenario"}
            </button>
          </div>
        </header>

        {view === "offer" ? (
          <OfferView
            role={role}
            setRole={setRole}
            level={level}
            setLevel={setLevel}
            ral={ral}
            setRal={setRal}
            currentRal={currentRal}
            setCurrentRal={setCurrentRal}
            bonus={bonus}
            setBonus={setBonus}
            months={months}
            setMonths={setMonths}
            remoteDays={remoteDays}
            setRemoteDays={setRemoteDays}
            mealVoucher={mealVoucher}
            setMealVoucher={setMealVoucher}
            contract={contract}
            setContract={setContract}
            results={results}
            onOpenBenchmark={() => setView("benchmark")}
            onOpenChecklist={() => setView("checklist")}
          />
        ) : null}

        {view === "benchmark" ? (
          <BenchmarkView role={role} level={level} ral={ral} results={results} onBack={() => setView("offer")} />
        ) : null}

        {view === "checklist" ? (
          <ChecklistView
            items={defaultChecklist}
            checkedItems={checkedItems}
            toggle={toggleChecklist}
            bonus={bonus}
            remoteDays={remoteDays}
            contract={contract}
            onBack={() => setView("offer")}
          />
        ) : null}
      </section>
    </main>
  );
}

type Results = {
  targetBonus: number;
  mealValue: number;
  flexibilityValue: number;
  packageValue: number;
  monthlyNet: number;
  increase: number;
  range: [number, number];
  marker: number;
  position: string;
};

type OfferViewProps = {
  role: Role;
  setRole: (value: Role) => void;
  level: Level;
  setLevel: (value: Level) => void;
  ral: number;
  setRal: (value: number) => void;
  currentRal: number;
  setCurrentRal: (value: number) => void;
  bonus: number;
  setBonus: (value: number) => void;
  months: 13 | 14;
  setMonths: (value: 13 | 14) => void;
  remoteDays: number;
  setRemoteDays: (value: number) => void;
  mealVoucher: number;
  setMealVoucher: (value: number) => void;
  contract: string;
  setContract: (value: string) => void;
  results: Results;
  onOpenBenchmark: () => void;
  onOpenChecklist: () => void;
};

function OfferView(props: OfferViewProps) {
  const {
    role, setRole, level, setLevel, ral, setRal, currentRal, setCurrentRal,
    bonus, setBonus, months, setMonths, remoteDays, setRemoteDays,
    mealVoucher, setMealVoucher, contract, setContract, results,
    onOpenBenchmark, onOpenChecklist,
  } = props;

  const verdict = results.position === "Sotto il range" ? "Da rinegoziare" : "Offerta competitiva";

  return (
    <div className="view-frame">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Valutazione</span>
          <h1>La tua offerta</h1>
          <p>Inserisci i pochi dati che cambiano davvero il valore del pacchetto.</p>
        </div>
        <div className="status-chip"><span /> Aggiornamento istantaneo</div>
      </div>

      <div className="offer-layout">
        <section className="input-panel" aria-labelledby="offer-inputs-title">
          <div className="section-heading">
            <div>
              <span className="section-index">01</span>
              <h2 id="offer-inputs-title">Dati essenziali</h2>
            </div>
            <CircleHelp size={18} aria-label="Informazioni sui dati richiesti" />
          </div>

          <div className="field-grid">
            <label className="field wide">
              <span>Ruolo</span>
              <div className="select-wrap">
                <BriefcaseBusiness size={17} />
                <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                  {Object.keys(roleBenchmarks).map((item) => <option key={item}>{item}</option>)}
                </select>
                <ChevronDown size={15} />
              </div>
            </label>

            <label className="field">
              <span>Seniority</span>
              <div className="select-wrap no-icon">
                <select value={level} onChange={(event) => setLevel(event.target.value as Level)}>
                  <option>Junior</option>
                  <option>Mid-level</option>
                  <option>Senior</option>
                </select>
                <ChevronDown size={15} />
              </div>
            </label>

            <label className="field">
              <span>RAL offerta</span>
              <div className="money-input">
                <Euro size={16} />
                <input type="number" min="18000" step="1000" value={ral} onChange={(event) => setRal(Number(event.target.value))} />
              </div>
            </label>

            <label className="field">
              <span>RAL attuale</span>
              <div className="money-input muted">
                <Euro size={16} />
                <input type="number" min="0" step="1000" value={currentRal} onChange={(event) => setCurrentRal(Number(event.target.value))} />
              </div>
            </label>

            <label className="field">
              <span>Bonus target</span>
              <div className="suffix-input">
                <input type="number" min="0" max="40" value={bonus} onChange={(event) => setBonus(Number(event.target.value))} />
                <span>% RAL</span>
              </div>
            </label>

            <div className="field">
              <span>Mensilità</span>
              <div className="segmented" aria-label="Mensilità">
                {[13, 14].map((value) => (
                  <button key={value} type="button" className={months === value ? "selected" : ""} onClick={() => setMonths(value as 13 | 14)}>{value}</button>
                ))}
              </div>
            </div>

            <div className="field wide">
              <span>Smart working · giorni/settimana</span>
              <div className="segmented four" aria-label="Giorni di smart working">
                {[0, 1, 2, 3].map((value) => (
                  <button key={value} type="button" className={remoteDays === value ? "selected" : ""} onClick={() => setRemoteDays(value)}>{value}</button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Buono pasto</span>
              <div className="suffix-input">
                <input type="number" min="0" max="20" value={mealVoucher} onChange={(event) => setMealVoucher(Number(event.target.value))} />
                <span>€/giorno</span>
              </div>
            </label>

            <label className="field">
              <span>Contratto</span>
              <div className="select-wrap no-icon">
                <select value={contract} onChange={(event) => setContract(event.target.value)}>
                  <option>CCNL Commercio</option>
                  <option>CCNL Metalmeccanico</option>
                </select>
                <ChevronDown size={15} />
              </div>
            </label>
          </div>
        </section>

        <section className="analysis-panel" aria-labelledby="analysis-title">
          <div className="verdict-row">
            <div>
              <span className="eyebrow">Lettura dell&apos;offerta</span>
              <h2 id="analysis-title">{verdict}</h2>
            </div>
            <span className={results.position === "Sotto il range" ? "market-status warning" : "market-status"}>{results.position}</span>
          </div>
          <p className="verdict-copy">
            La componente fissa è {results.position === "Sotto il range" ? "debole per il livello selezionato" : "coerente con il mercato"}. Il bonus pesa {bonus}% e va verificato prima di considerarlo reddito certo.
          </p>

          <div className="metric-strip">
            <Metric label="Netto indicativo" value={euro.format(results.monthlyNet)} detail={`su ${months} mensilità`} tone="blue" />
            <Metric label="Valore annuo" value={euro.format(results.packageValue)} detail="fisso + variabile + benefit" tone="green" />
            <Metric label="Aumento RAL" value={`${results.increase >= 0 ? "+" : ""}${results.increase.toFixed(1)}%`} detail={`da ${euro.format(currentRal)}`} tone="amber" />
          </div>

          <div className="breakdown-section">
            <div className="subsection-title">
              <div>
                <span className="section-index">02</span>
                <h3>Composizione del valore</h3>
              </div>
              <span>{euro.format(results.packageValue)} / anno</span>
            </div>
            <div className="value-bar" aria-label="Composizione del pacchetto">
              <span className="fixed" style={{ width: `${(ral / results.packageValue) * 100}%` }} />
              <span className="variable" style={{ width: `${(results.targetBonus / results.packageValue) * 100}%` }} />
              <span className="benefits" style={{ flex: 1 }} />
            </div>
            <div className="legend-row">
              <Legend color="fixed" label="Fisso" value={euro.format(ral)} />
              <Legend color="variable" label="Bonus target" value={euro.format(results.targetBonus)} />
              <Legend color="benefits" label="Benefit stimati" value={euro.format(results.mealValue + results.flexibilityValue)} />
            </div>
          </div>

          <div className="attention-box">
            <div className="attention-icon"><Scale size={19} /></div>
            <div>
              <strong>Da chiarire prima di firmare</strong>
              <p>Chiedi quale percentuale del bonus è stata erogata mediamente negli ultimi due anni.</p>
            </div>
            <button type="button" onClick={onOpenChecklist}>Apri checklist <ArrowRight size={15} /></button>
          </div>

          <button type="button" className="benchmark-link" onClick={onOpenBenchmark}>
            Vedi il benchmark completo
            <ArrowRight size={17} />
          </button>

          <p className="estimate-note">Stima orientativa, non calcolo fiscale né simulazione di cedolino.</p>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="legend-item">
      <span className={`legend-dot ${color}`} />
      <div><span>{label}</span><strong>{value}</strong></div>
    </div>
  );
}

function BenchmarkView({ role, level, ral, results, onBack }: { role: Role; level: Level; ral: number; results: Results; onBack: () => void }) {
  const midpoint = (results.range[0] + results.range[1]) / 2;
  const delta = ((ral - midpoint) / midpoint) * 100;
  return (
    <div className="view-frame secondary-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Benchmark indicativo</span>
          <h1>{role} · {level}</h1>
          <p>Una fascia leggibile per orientare la conversazione, non una sentenza sul mercato.</p>
        </div>
        <button type="button" className="quiet-action" onClick={onBack}>Torna all&apos;offerta</button>
      </div>

      <section className="benchmark-band">
        <div className="benchmark-header">
          <div><span>Range RAL indicativo</span><strong>{euro.format(results.range[0])} – {euro.format(results.range[1])}</strong></div>
          <span className="market-status">{results.position}</span>
        </div>
        <div className="range-visual">
          <div className="range-labels"><span>{euro.format(results.range[0])}</span><span>Mediana {euro.format(midpoint)}</span><span>{euro.format(results.range[1])}</span></div>
          <div className="range-track">
            <span className="range-fill" />
            <span className="offer-marker" style={{ left: `${results.marker}%` }}><b>{euro.format(ral)}</b></span>
          </div>
        </div>
      </section>

      <div className="benchmark-grid">
        <section className="benchmark-summary">
          <span className="section-index">01</span>
          <h2>Come leggere la posizione</h2>
          <p>La tua RAL è <strong>{Math.abs(delta).toFixed(1)}% {delta >= 0 ? "sopra" : "sotto"} la mediana</strong> della fascia selezionata.</p>
          <div className="signal-list">
            <div><CheckCircle2 size={18} /><span>Il confronto usa ruolo e seniority, non la città come scorciatoia.</span></div>
            <div><CheckCircle2 size={18} /><span>Il bonus è escluso dal benchmark della componente fissa.</span></div>
            <div><Info size={18} /><span>I dati sono dimostrativi e vanno validati con una fonte di mercato.</span></div>
          </div>
        </section>

        <section className="benchmark-summary muted-section">
          <span className="section-index">02</span>
          <h2>Le tre domande utili</h2>
          <ol className="numbered-questions">
            <li><span>1</span><p>Qual è il budget approvato per questa posizione?</p></li>
            <li><span>2</span><p>Quando è prevista la prima salary review?</p></li>
            <li><span>3</span><p>Il livello contrattuale è coerente con le responsabilità?</p></li>
          </ol>
        </section>
      </div>
    </div>
  );
}

function ChecklistView({ items, checkedItems, toggle, bonus, remoteDays, contract, onBack }: { items: string[]; checkedItems: number[]; toggle: (index: number) => void; bonus: number; remoteDays: number; contract: string; onBack: () => void }) {
  return (
    <div className="view-frame secondary-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Prima della firma</span>
          <h1>Checklist dell&apos;offerta</h1>
          <p>Cinque verifiche concrete. Nessun copione di negoziazione.</p>
        </div>
        <button type="button" className="quiet-action" onClick={onBack}>Torna all&apos;offerta</button>
      </div>

      <div className="checklist-layout">
        <section className="checklist-panel">
          <div className="check-progress">
            <div><span>Completamento</span><strong>{checkedItems.length} di {items.length}</strong></div>
            <div className="progress-track"><span style={{ width: `${(checkedItems.length / items.length) * 100}%` }} /></div>
          </div>
          <div className="check-list">
            {items.map((item, index) => {
              const checked = checkedItems.includes(index);
              return (
                <label key={item} className={checked ? "check-row checked" : "check-row"}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(index)} />
                  <span className="custom-check">{checked ? <Check size={15} /> : null}</span>
                  <span>{item}</span>
                </label>
              );
            })}
          </div>
        </section>

        <aside className="scenario-brief">
          <span className="section-index">Scenario attuale</span>
          <h2>Tre punti da portare al colloquio</h2>
          <div className="brief-item"><span>Bonus</span><strong>{bonus}% target</strong><p>Chiedi regole e storico di erogazione.</p></div>
          <div className="brief-item"><span>Flessibilità</span><strong>{remoteDays} giorni/settimana</strong><p>Verifica che sia parte dell&apos;accordo.</p></div>
          <div className="brief-item"><span>Inquadramento</span><strong>{contract.replace("CCNL ", "")}</strong><p>Controlla livello, prova e preavviso.</p></div>
        </aside>
      </div>
    </div>
  );
}
