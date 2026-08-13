# Valore — dalla RAL al netto

Prototipo per il take-home Jet HR, posizione Product Builder Cost-Saving.

- Applicazione: https://valore-theta.vercel.app/
- Flusso principale: RAL → residenza → mensilità → **Calcola** → netto e trattenute

## A. Cosa chiedeva il task

Il task richiede una pagina web che, partendo da una RAL, stimi:

- netto annuale;
- netto medio per mensilità;
- imposte;
- contributi a carico del dipendente;
- principali passaggi dal lordo al netto.

Il dominio payroll è ampio, quindi il prototipo privilegia un caso standard comprensibile e
verificabile. La scelta di fondo è semplice: **meglio dichiarare un limite che mostrare un numero
apparentemente preciso ma non supportato.**

## B. Cosa fa il calcolatore principale

L'utente inserisce RAL, residenza fiscale e numero di mensilità. Il risultato compare solo dopo
aver premuto **Calcola**; se uno degli input cambia, viene nascosto fino alla conferma successiva.

Il motore restituisce:

```text
RAL
  − contributi previdenziali a carico del dipendente
  = imponibile fiscale
  − IRPEF lorda per scaglioni
  + detrazione per lavoro dipendente
  + eventuale ulteriore detrazione
  = IRPEF netta
  − addizionale regionale
  − addizionale comunale
  + eventuale somma esente
  = netto annuale
```

Il netto per mensilità è una media (`netto annuale / 12, 13 o 14`), non la simulazione di un
cedolino. Le singole buste paga possono differire per tempistiche delle ritenute, addizionali e
conguagli.

Ogni riga espandibile mostra formula, dettaglio per scaglione, fonte e nota applicabile. La UI
consuma il `CalculationStep[]` restituito dal motore: non ricostruisce le spiegazioni a mano.

### Caso di riferimento

```text
RAL 46.000 €, Milano, 13 mensilità
  contributi      46.000,00 × 9,19%                      =  4.227,40
  imponibile      46.000,00 − 4.227,40                   = 41.772,60
  IRPEF lorda     28.000 × 23% + 13.772,60 × 33%         = 10.984,96
  detrazione      1.910 × (50.000 − 41.772,60) / 22.000  =    714,29
  IRPEF netta     10.984,96 − 714,29                     = 10.270,67
  add. regionale  per scaglioni                          =    626,79
  add. comunale   41.772,60 × 0,8%                       =    334,18
  netto annuale                                          = 30.540,96
```

## C. Assunzioni del caso standard

Il risultato principale copre:

- dipendente privato, profilo contributivo ordinario FPLD;
- contratto a tempo indeterminato, full-time, per tutto il 2026;
- nessun altro reddito;
- nessun familiare a carico;
- nessun regime fiscale speciale;
- nessun bonus, fringe benefit o previdenza complementare nella RAL;
- RAL da 18.000 € a 200.000 €;
- 12, 13 o 14 mensilità.

Restano fuori: part-time e anni parziali, più datori di lavoro, impatriati, apprendistato,
dirigenti, detrazioni familiari o personali, stock compensation, CCNL/qualifiche/fondi con profili
contributivi specifici ed esatta simulazione di cedolino o conguaglio.

### Località supportate

Ho selezionato cinque località rappresentative per testare strutture fiscali locali diverse senza
trasformare il prototipo in un database nazionale: Milano, Torino, Firenze, Venezia e Bari.

Il campione copre:

- addizionali regionali progressive e ad aliquota unica;
- addizionali comunali ad aliquota unica e per scaglioni;
- soglie di esenzione comunale differenti.

La selezione è una scelta di prodotto, non una dichiarazione sulla disponibilità dei dati delle
altre regioni. A parità di profilo cambiano soltanto le addizionali; IRPEF e contributi restano
nazionali.

Le addizionali regionali usano i dati MEF 2026. Per quelle comunali, il portale MEF non pubblica
ancora il dato 2026 delle località incluse: il ruleset usa esplicitamente l'ultima delibera
disponibile 2025 come **assunzione documentata**, con anno, nota e link visibili.

## D. Esplorazione Cost-Saving

Le viste secondarie mostrano come lo stesso rules engine possa supportare decisioni aziendali,
senza modificare il calcolo RAL → netto.

### Costo aziendale e cuneo

Il costo aziendale stimato è:

```text
RAL + contributi datore + TFR
```

Il **cuneo fiscale e contributivo** contiene esclusivamente:

```text
contributi datore + contributi dipendente + imposte
```

Il TFR è mostrato separatamente perché è retribuzione differita del dipendente, non imposta né
contributo. L'aliquota datoriale complessiva del 30% è un'assunzione del profilo standard; il
costo reale varia per settore, dimensione, CCNL e rischio INAIL.

### Aumentare il netto

La sezione confronta tre leve illustrative:

- aumento di RAL;
- premio di risultato;
- fringe benefit.

Ogni numero deriva dagli input disponibili e dalle regole dichiarate:

- **Aumento di RAL:** il motore cerca il primo aumento supportato che raggiunge l'obiettivo netto.
  Scansiona la RAL in avanti e rifinisce solo il primo intervallo utile al centesimo; non assume
  monotonicità globale, perché alcune soglie possono far scendere temporaneamente il netto.
- **Premio di risultato:** l'agevolazione dipende dal reddito da lavoro dipendente dell'anno
  precedente. La RAL corrente non viene usata come proxy. Finché questo dato non è inserito, la
  card mostra “eleggibilità da verificare” e non espone un costo numerico. Il confronto agevolato
  presuppone inoltre le condizioni e l'accordo collettivo richiesti dalla norma.
- **Fringe benefit:** il controllo sui figli è usato esclusivamente per scegliere la soglia
  esente 1.000/2.000 € dello scenario fringe benefit. Non modifica il calcolo standard e non
  pretende di modellare gli altri effetti fiscali familiari.

Queste sono stime secondarie sul profilo contributivo standard, non un motore completo di
compensation optimization.

## E. Architettura e limiti

```text
app/page.tsx                 interfaccia; nessuna aliquota fiscale
lib/payroll/
  calculateSalary.ts        unico motore RAL → netto e calculation trace
  progressiveTax.ts         calcolo per scaglioni
  contributions.ts          contributi dipendente
  deductions.ts             art. 13 TUIR e taglio del cuneo
  localTaxes.ts             addizionali ed esenzioni
  levers.ts                 scenari Cost-Saving che richiamano il motore
  rules/italy-2026.ts       regole, fonti, versione e località
  types.ts                   contratti fra ruleset, motore e UI
tests/                       confini, integrazione, regressioni e HTML
```

`calculateSalary(profile, ruleset)` è l'unica funzione che produce il netto. Confronti di
località e aumenti di RAL cambiano gli input e richiamano lo stesso motore.

Approssimazioni dichiarate:

- l'1% INPS oltre 56.224 € è annualizzato; in busta paga è applicato con criteri mensili;
- contributi datore al 30%; INAIL escluso;
- addizionali comunali 2025 usate come assunzione per la proiezione 2026;
- proiezione annuale, non cedolino o conguaglio.

## Fonti principali

| Regola | Fonte |
| --- | --- |
| IRPEF 2026 | [L. 199/2025, legge di bilancio 2026](https://www.mef.gov.it/focus/Principali-misure-della-legge-di-bilancio-2026/) |
| Detrazione lavoro dipendente | [D.P.R. 917/1986, art. 13, Normattiva](https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1986-12-22;917) |
| Contributi FPLD | [INPS](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2023.02.circolare-numero-24-del-20-02-2023_14085.html) |
| Prima fascia pensionabile 2026 | [INPS, circolare n. 6/2026](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html) |
| Premio di risultato 2026 | [L. 199/2025](https://www.mef.gov.it/focus/Principali-misure-della-legge-di-bilancio-2026/) |
| Fringe benefit 2025-2027 | [L. 207/2024, art. 1 co. 390-391](https://www.mef.gov.it/focus/Principali-misure-della-legge-di-bilancio-2026/) |
| Addizionali regionali e comunali | [MEF, Fiscalità regionale e locale](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/) |

## Esecuzione e verifica

```bash
npm install
npm run dev
npm test
npm run build
npm run lint
npm run typecheck
```

I test verificano scaglioni IRPEF, detrazioni, contributi, soglie locali, riconciliazione dei
totali, perimetro RAL, calculation trace, cambio località, cuneo senza TFR, eleggibilità del premio
basata sull'anno precedente e gross-up prima/dopo i salti fiscali noti.
