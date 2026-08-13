import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/** Renderizza la pagina attraverso il worker prodotto dalla build. */
async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("the page ships a working calculator in its server-rendered HTML", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();

  // Gli input richiesti dalla traccia e il pulsante che produce il risultato.
  assert.match(html, /<input[^>]+id="ral"/i);
  assert.match(html, /Retribuzione annua lorda/i);
  assert.match(html, /<select[^>]+id="location"/i);
  assert.match(html, /Residenza fiscale/i);
  assert.match(html, /Mensilità/i);
  assert.match(html, /Figli a carico/i);
  // Il calcolo è reattivo: non esiste un pulsante che faccia da cancello.
  assert.doesNotMatch(html, /Calcola<\/button>|Premi Calcola/i);

  // Gli output richiesti dalla traccia, già visibili al primo caricamento.
  assert.match(html, /Netto annuale/i);
  assert.match(html, /Netto per mensilità/i);
  assert.match(html, /Totale trattenute/i);

  // Il caso di default (RAL 46.000, 13 mensilità) con i valori attesi.
  assert.match(html, /46\.000/);
  assert.match(html, /30\.541/); // netto annuale
  assert.match(html, /2\.349/); // netto per mensilità
});

test("every item withheld from the gross salary is shown", async () => {
  const html = await (await render()).text();

  for (const line of [
    "Contributi previdenziali a carico del dipendente",
    "Imponibile fiscale",
    "IRPEF lorda",
    "Detrazione per lavoro dipendente",
    "IRPEF netta",
    "Addizionale regionale Lombardia",
    "Addizionale comunale Milano",
  ]) {
    assert.match(html, new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), line);
  }

  // Gli importi del dettaglio sono al centesimo, così i conti tornano a vista.
  assert.match(html, /4\.227,40/); // contributi
  assert.match(html, /41\.772,60/); // imponibile fiscale
  assert.match(html, /10\.270,67/); // IRPEF netta
});

test("the page is organised in navigable sections, all present in the HTML", async () => {
  const html = await (await render()).text();

  assert.match(html, /role="tablist"/);
  for (const id of ["calcolo", "leve", "localita", "perimetro"]) {
    assert.match(html, new RegExp(`id="tab-${id}"[^>]*role="tab"`), `tab ${id}`);
    assert.match(html, new RegExp(`id="panel-${id}"[^>]*role="tabpanel"`), `panel ${id}`);
  }

  // La prima sezione è aperta, le altre sono nel DOM ma nascoste.
  assert.match(html, /id="panel-calcolo"(?![^>]*hidden)/);
  assert.match(html, /id="panel-leve"[^>]*hidden/);

  // Input e risultato restano fuori dalle sezioni, sempre visibili.
  const beforeTabs = html.slice(0, html.indexOf('role="tablist"'));
  assert.match(beforeTabs, /<input[^>]+id="ral"/);
  assert.match(beforeTabs, /Netto annuale/);
  assert.match(beforeTabs, /30\.541/);
});

test("assumptions, limits and sources are stated on the page", async () => {
  const html = await (await render()).text();

  assert.match(html, /Cosa considera il calcolo/i);
  assert.match(html, /Non incluso/i);
  assert.match(html, /Fonti/i);
  assert.match(html, /gazzettaufficiale|mef\.gov\.it|inps\.it|regione\.lombardia\.it|comune\.milano\.it/i);
  assert.match(html, /non sostituisce il cedolino/i);
});

test("no leftover scaffolding from the previous prototype is rendered", async () => {
  const html = await (await render()).text();

  // La pagina non deve più nascondere il calcolo dietro un questionario,
  // né mostrare funzionalità disattivate o dichiarate come roadmap.
  assert.doesNotMatch(html, /Verifica il tuo profilo|risposte|Confronto disattivato/i);
  assert.doesNotMatch(html, /Roadmap|Prova di concetto|Regulatory intelligence/i);
  assert.doesNotMatch(html, /Spiegami questo calcolo|Confronto disattivato/i);
});

test("calculation logic lives in the engine, not in the React view", async () => {
  const [page, engine, rules] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/payroll/calculateSalary.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payroll/rules/italy-2026.ts", import.meta.url), "utf8"),
  ]);

  // La pagina consuma il motore e ne mostra i passaggi: non calcola imposte.
  assert.match(page, /calculateSalary\(/);
  assert.match(page, /result\.steps/);
  assert.doesNotMatch(page, /0\.0919|0\.23|0\.33|0\.43|1_?955|1_?910/);
  // Nemmeno l'elenco delle località è cablato nella vista.
  assert.match(page, /ITALY_2026\.locations/);
  assert.doesNotMatch(page, /"Torino"|"Firenze"|"Venezia"|"Bari"/);

  // Le aliquote stanno solo nel ruleset, non sparse nel motore.
  assert.match(rules, /0\.0919/);
  assert.match(rules, /56_224/);
  assert.doesNotMatch(engine, /0\.0919|56_224|0\.008/);
});

test("every supported location is selectable and compared on the page", async () => {
  const html = await (await render()).text();

  for (const city of ["Milano", "Torino", "Firenze", "Venezia", "Bari"]) {
    assert.match(html, new RegExp(`<option[^>]*>${city}</option>`), `opzione ${city}`);
  }
  for (const region of ["Lombardia", "Piemonte", "Toscana", "Veneto", "Puglia"]) {
    assert.match(html, new RegExp(region), `regione ${region}`);
  }

  assert.match(html, /Quanto pesa il comune di residenza/i);
  // Le addizionali di Milano e Torino a RAL 46.000, calcolate a mano nei test del motore.
  assert.match(html, /961/);
  assert.match(html, /1\.423/);
});

test("locations without published 2026 regional rates are excluded, not approximated", async () => {
  const html = await (await render()).text();

  assert.doesNotMatch(html, /<option[^>]*>(Roma|Napoli|Bologna|Genova)<\/option>/);
  assert.match(html, /Roma, Napoli, Bologna, Genova/);
});

test("the employer side of the same salary is shown", async () => {
  const html = await (await render()).text();

  assert.match(html, /Quanto costa all&#x27;azienda|Quanto costa all'azienda/i);
  assert.match(html, /Costo aziendale/i);
  assert.match(html, /Cuneo fiscale e contributivo/i);
  assert.match(html, /TFR accantonato/i);
  // RAL 46.000 + 30% contributi datore + 7,41% TFR = 63.209 €.
  assert.match(html, /63\.209/);
  // L'INAIL è escluso di proposito, e la pagina lo dice.
  assert.match(html, /INAIL/);
});

test("the three compensation levers are compared with their constraints", async () => {
  const html = await (await render()).text();

  assert.match(html, /le tre strade/i);
  // L'obiettivo è un input, non una costante cablata nella pagina.
  assert.match(html, /<input[^>]+id="target-net"/i);
  assert.match(html, /Obiettivo netto/i);
  // Con obiettivo 2.000 € la soglia base dei fringe benefit si vede davvero.
  // React separa testo ed espressioni con commenti, quindi la regex li tollera.
  assert.match(html, /su (<!-- -->)?2\.000\s€/);
  assert.match(html, /si ferma a (<!-- -->)?1\.000\s€/);
  assert.match(html, /Aumento di RAL/);
  assert.match(html, /Premio di risultato/);
  assert.match(html, /Fringe benefit/);
  assert.match(html, /più efficiente/);

  // Ogni leva agevolata dichiara il proprio vincolo: tetto, condizioni, natura.
  assert.match(html, /accordo collettivo di secondo livello/i);
  assert.match(html, /5\.000\s€/);
  assert.match(html, /superata la soglia anche di un euro/i);
  assert.match(html, /beni e servizi, non denaro/i);
});
