# Dalla RAL al netto

Prototipo per il take-home Jet HR, posizione Product Builder Cost-Saving.

Una pagina web: inserisci una RAL e scegli la residenza fiscale, e vedi subito il netto annuale,
il netto per mensilità e tutte le voci trattenute dal lordo, ciascuna con la formula applicata e
il link alla fonte ufficiale.

Poi la domanda che interessa a un'azienda: quanto costa quel netto, e qual è il modo meno caro di
aumentarlo.

Il calcolo è reattivo, senza pulsante. La traccia parlava di un pulsante "calcola", ma con tre
controlli su quattro che aggiornano da soli il pulsante diventava un cancello davanti a un
risultato già pronto, e un valore incompleto mentre si scrive non azzera la pagina: resta
l'ultimo risultato valido con l'avviso accanto.

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm test         # motore di calcolo + build + HTML renderizzato
npm run lint
npm run typecheck
```

## Il caso coperto

Come suggerito dalla traccia, il prototipo modella un solo caso, quello standard:

- dipendente del settore privato;
- contratto a tempo indeterminato, full-time, per tutto l'anno d'imposta 2026;
- residenza fiscale in una delle cinque località supportate;
- nessuna agevolazione, nessun familiare a carico, nessun altro reddito;
- RAL fra 18.000 € e 200.000 €, distribuita su 12, 13 o 14 mensilità.

### Perché cinque località e non venti

La traccia permetteva di fissare Milano e basta. Ho preferito rendere la residenza selezionabile,
perché è l'unico input che cambia davvero il risultato oltre alla RAL, e perché mette alla prova
la struttura del ruleset invece di lasciarla un'affermazione.

Sono supportate **Milano, Torino, Firenze, Venezia e Bari**: le località per cui il portale del
Dipartimento delle Finanze pubblica sia le aliquote regionali 2026 sia la delibera comunale
vigente. Roma, Napoli, Bologna e Genova restano fuori perché Lazio, Campania, Emilia-Romagna e
Liguria non hanno ancora pubblicato le aliquote regionali 2026: ripiegare su quelle dell'anno
prima darebbe un numero verosimile ma non verificabile, e un comune sbagliato in silenzio è
peggio di un comune assente.

Le cinque coprono comunque i casi strutturalmente diversi: aliquote regionali per scaglioni
(Lombardia, Piemonte, Toscana, Puglia) e ad aliquota unica (Veneto); addizionali comunali ad
aliquota unica (Milano, Firenze, Venezia, Bari) e per scaglioni (Torino); soglie di esenzione da
10.000 € (Venezia) a 25.000 € (Firenze).

I due limiti di RAL non sono arbitrari, ed è la ragione per cui ho scelto di fissarli:

- **sotto i 18.000 €** entrerebbe in gioco il trattamento integrativo (D.L. 3/2020), che spetta
  fino a 15.000 € di imponibile e che il prototipo non calcola;
- **sopra i 200.000 €** la legge di bilancio 2026 *sterilizza* il taglio dell'aliquota al 33%
  riducendo di 440 € le detrazioni per oneri. Quanto pesi dipende dagli oneri detraibili del
  singolo contribuente, quindi non è modellabile senza dati che il calcolatore non chiede.

Fuori da questi limiti il motore solleva un errore invece di restituire un numero plausibile ma
sbagliato. È la scelta di fondo di tutto il prototipo: meglio dire "non lo so" che approssimare
in silenzio.

## Come si arriva al netto

```
RAL
  − contributi previdenziali a carico del dipendente     (deducibili)
  = imponibile fiscale
  − IRPEF lorda per scaglioni
  + detrazione per lavoro dipendente
  + ulteriore detrazione (taglio del cuneo fiscale)
  = IRPEF netta
  − addizionale regionale Lombardia
  − addizionale comunale Milano
  + somma esente (taglio del cuneo fiscale, sotto i 20.000 €)
  = netto annuale
```

Tre passaggi che vale la pena chiamare per nome, perché sono quelli in cui i calcolatori online
sbagliano più spesso:

1. **I contributi si tolgono prima dell'IRPEF.** Sono oneri deducibili, quindi l'imposta non si
   calcola sulla RAL ma sull'imponibile che resta. Su 46.000 € di RAL la differenza vale circa
   1.400 € di imposta.
2. **A Milano i 23.000 € sono una soglia di esenzione, non una franchigia.** Sotto non si paga
   nulla; superata di un euro, lo 0,8% si applica all'intero imponibile. È un salto, non una
   rampa.
3. **Il taglio del cuneo fiscale cambia natura a 20.000 €.** Sotto è una somma esente che il
   datore eroga senza tassarla, quindi si *somma* al netto; sopra diventa una detrazione che
   *riduce l'IRPEF*. Trattarli allo stesso modo sbaglia il netto di diverse centinaia di euro.

## Il lato azienda, e le tre leve

Il netto da solo racconta metà della storia. Su una RAL di 46.000 € l'azienda ne spende 63.209
fra contributi a suo carico e TFR, e al dipendente ne arrivano netti 30.541: **il 48% di quel che
è stato speso**. Il resto è cuneo.

Da lì nasce la domanda che vale davvero per chi si occupa di cost saving: non "quanto prende il
dipendente", ma *quanto costa fargli arrivare più soldi netti*. L'obiettivo è un input, perché il
confronto racconta cose diverse a cifre diverse: sotto i 1.000 € il fringe benefit copre tutto,
oltre i 5.000 € nemmeno il premio ci arriva. Con il default di 2.000 € netti:

| Leva | Costo azienda | Netto consegnato | Efficienza |
| --- | --- | --- | --- |
| Aumento di RAL | 5.424 € | 2.000 € | 37% |
| Premio di risultato (imposta sostitutiva 1%) | 3.057 € | 2.000 € | 65% |
| Fringe benefit | 1.000 € | 1.000 €, poi si ferma | 100% |

I numeri qui sopra valgono per il caso di default (RAL 46.000 a Milano, obiettivo 2.000 €) e si
muovono con tutti e tre.

Un euro netto consegnato via RAL costa all'azienda **2,71 €**; via fringe benefit ne costa **1,00**.

### I vincoli non sono una nota a piè di pagina

Le tre leve non sono sempre disponibili, e il confronto cambia con il caso. È la parte che conta:
un numero valido per tutti sarebbe stato un numero sbagliato per quasi tutti.

- **L'aumento di RAL** costa quanto l'aliquota marginale di quel dipendente: consegnare 2.000 €
  netti costa 4.259 € a RAL 18.000 (efficienza 47%) e 5.618 € a RAL 60.000 (35,6%). Al tetto dei
  200.000 € la leva sparisce, perché il prototipo non modella oltre.
- **Il premio di risultato** vale solo con reddito da lavoro dipendente sotto 80.000 € nell'anno
  precedente. Sopra quella soglia la carta non viene mostrata con un numero più caro: viene
  dichiarata *non disponibile*, perché l'agevolazione non esiste e mostrarla sarebbe peggio che
  tacerla. Sotto soglia il costo cambia comunque: oltre la prima fascia pensionabile il premio
  porta il 10,19% di contributi invece del 9,19%, e passa da 3.057 € a 3.091 €.
- **Il fringe benefit** è l'unico la cui efficienza non cambia mai, ed è corretto così: entro la
  soglia è esente del tutto, quindi un euro speso è un euro netto a qualsiasi reddito. Quello che
  cambia è quanta parte dell'obiettivo riesce a coprire, e il suo vantaggio relativo.

Il premio lordo non si ricava da una costante: il premio entra nell'imponibile contributivo, e
l'aliquota dipende da dove si trova la RAL rispetto alla prima fascia pensionabile. Anche lì uso
una ricerca binaria sul motore dei contributi.

Un test attraversa RAL da 18.000 a 200.000 e verifica che nessuna leva dichiari mai di consegnare
più netto di quanto costa: il fringe benefit al 100% è il limite teorico, e un'efficienza sopra
quella soglia sarebbe la firma di un errore.

Il calcolo dell'aumento di RAL non è invertibile in forma chiusa: scaglioni, detrazioni
decrescenti e soglie comunali rendono `netto(RAL)` continua ma a tratti. Uso una ricerca binaria
sul motore vero, esatta al centesimo, invece di riscrivere la fiscalità al contrario. Un test
verifica il risultato ricalcolandolo con il motore, non con la formula usata per trovarlo.

### Quando un aumento fa scendere il netto

Cercando se l'ordine di convenienza delle tre leve si inverta mai, ho scoperto che non si inverte
(il fringe benefit è esente da tutto, quindi il suo 100% è un limite teorico che nessuna leva può
superare), ma ho trovato una cosa più interessante: **due fasce di RAL in cui un aumento riduce il
netto in busta**.

| Fascia | Causa | Effetto di +100 € di RAL |
| --- | --- | --- |
| RAL ~25.300 a Milano | L'imponibile supera i 23.000 € e l'addizionale comunale colpisce l'intero importo | **−124 €** netti |
| RAL ~38.500 | L'imponibile supera i 35.000 € e si spegne la maggiorazione di 65 € dell'art. 13 co. 1.1 | **−26 €** netti |

Sono soglie, non franchigie: superarle di un euro fa scattare l'onere per intero. La prima dipende
dal comune, ed è verificabile a colpo d'occhio nel prototipo: alla stessa RAL, a Firenze (dove
l'esenzione è a 25.000 €) la trappola non c'è.

In quelle fasce la risposta alla domanda "come do più soldi a questa persona" non è un aumento di
RAL, ed è il caso in cui una leva agevolata non è solo più efficiente ma è l'unica che non
peggiora la situazione. La pagina lo dice prima, con un avviso che compare solo quando la RAL
corrente si trova in una di quelle zone, calcolato scandendo il motore vero e non da una lista di
soglie cablata.

### Un bug trovato per questa strada

Il primo scandaglio segnalava un rendimento marginale assurdo attorno ai 30.800 € di RAL: +100 €
lordi davano +118 € netti. Non era una regola, era un mio errore. Applicavo la maggiorazione di
65 € dell'art. 13 co. 1.1 solo alla banda sopra i 28.000 €, mentre il comma 1.1 aumenta la
detrazione del comma 1 **in tutte le sue bande** fra 25.000 e 35.000 € di reddito complessivo.
Il risultato era un salto artificiale di 65 € esattamente sulla soglia dei 28.000, e un netto
sottostimato di 65 € per gli imponibili fra 25.000 e 28.000.

Corretto: la maggiorazione è ora un'aggiunta trasversale, e un test verifica che la detrazione
resti continua attraversando i 28.000.

### I figli a carico non cambiano il netto

È il risultato più controintuitivo del prototipo, ed è corretto: dal 2022 l'assegno unico ha
sostituito le detrazioni per i figli sotto i 21 anni, e l'assegno non è reddito imponibile.

Per questo il controllo non sta nel form del profilo insieme a RAL, comune e mensilità: metterlo
lì avrebbe promesso un effetto sul netto che non ha. Sta dentro la card delle leve, accanto
all'obiettivo, dove il suo effetto si vede davvero, cioè il raddoppio della soglia esente dei
fringe benefit. La spiegazione lo segue, perché è il tipo di cosa che si dà per scontata al
contrario.

## Il confronto fra località

Sotto il calcolo, la stessa RAL viene ricalcolata per tutte e cinque le località e messa in
tabella. Non è un secondo simulatore: è lo stesso motore chiamato cinque volte.

Il risultato è più interessante di quanto sembri. Su una RAL di 46.000 € il divario fra la
località più conveniente e la meno conveniente è di circa 575 € l'anno, l'1,25% della RAL: IRPEF e
contributi sono nazionali, quindi il comune muove solo le addizionali. E dentro quel divario pesa
più la regione del comune, il che è esattamente il contrario di come se ne parla di solito.

## Il layout

Quello che la traccia chiede resta sempre in vista, sopra tutto il resto: gli input e il
risultato, cioè netto annuale, netto per mensilità e totale trattenute. Non sono dentro nessuna
sezione, così cambiando vista non spariscono mai.

Sotto, il resto è diviso in quattro sezioni navigabili:

| Sezione | Contenuto |
| --- | --- |
| Il calcolo | Il dettaglio riga per riga, accanto al costo per l'azienda |
| Aumentare il netto | Le tre leve, l'obiettivo netto e l'avviso sulle trappole |
| Località | Il confronto fra le cinque località supportate |
| Perimetro e fonti | Cosa è incluso, cosa no, e da dove viene ogni aliquota |

In una pagina sola quel materiale faceva 3.465 pixel di scorrimento, e la struttura si perdeva:
il lettore non poteva sapere quanto mancava né cosa stesse leggendo. Per sezioni si sta sotto i
1.700, e ognuna ha una tesi sola.

I pannelli sono tutti nell'HTML e vengono nascosti con l'attributo `hidden`, non rimossi: è il
comportamento standard delle tab ARIA, mantiene il contenuto raggiungibile senza JavaScript e
permette ai test di verificarlo sull'HTML renderizzato. La navigazione risponde anche alle frecce
oltre che al clic.

Dentro ogni sezione, dove ci sono due card si accostano per significato e non solo per riempire:
il dettaglio del calcolo accanto al costo aziendale, cioè la stessa retribuzione dai due lati; il
perimetro accanto alle fonti. L'unica card che resta a tutta larghezza è quella delle tre leve,
perché il confronto funziona solo se le tre stanno affiancate.

## Come è fatto

```
lib/payroll/
  rules/italy-2026.ts   aliquote, scaglioni, soglie e località, ognuna con la sua fonte
  calculateSalary.ts    l'unico motore di calcolo
  contributions.ts      contributi INPS
  progressiveTax.ts     imposta per scaglioni (IRPEF e addizionali)
  deductions.ts         detrazioni art. 13 TUIR e taglio del cuneo fiscale
  localTaxes.ts         addizionali regionale e comunale
  levers.ts             confronto fra RAL, premio di risultato e fringe benefit
app/page.tsx            la pagina: legge il risultato, non calcola nulla
```

Due scelte che tengono insieme il resto:

**Le regole stanno solo nel ruleset.** Nessuna aliquota è scritta dentro il motore: aggiornare
l'IRPEF per il 2027, o aggiungere un comune, è una modifica dichiarativa a un file di dati. Due
test lo verificano, cercando le aliquote dentro `calculateSalary.ts` e i nomi delle città dentro
`page.tsx`, e fallendo se li trovano.

Le addizionali hanno due sole modalità di applicazione, `progressive` e `flatAboveThreshold`, e
bastano a coprire tutte e dieci le regole locali: aggiungere Torino, che è l'unico comune con
scaglioni comunali, non ha richiesto una riga di logica nuova.

**Il calcolo produce anche la sua spiegazione.** `calculateSalary` restituisce i numeri *e*
`steps`: la stessa sequenza con la formula di ogni passaggio, il dettaglio per scaglione e la
fonte. La pagina mostra quella struttura, quindi l'interfaccia non può divergere dal calcolo, e
un test verifica che partendo dalla RAL e applicando i segni mostrati a schermo si arrivi
esattamente al netto.

## Cosa non fa, e perché

Fuori perimetro per scelta: familiari a carico, altre detrazioni e oneri deducibili; regimi
agevolati (impatriati, apprendistato, dirigenti); differenze contributive fra CCNL, qualifiche o
fondi specifici; TFR, bonus, fringe benefit, previdenza complementare; anni parziali, part-time,
più datori di lavoro.

Due approssimazioni note, dichiarate anche in pagina:

- l'1% aggiuntivo INPS oltre la prima fascia pensionabile è calcolato sulla RAL annua, mentre in
  busta paga si applica mese per mese: con retribuzioni non uniformi il risultato può scostarsi
  di qualche euro;
- l'aliquota a carico del datore di lavoro è fissata al 30%. Il 23,81% di IVS è certo, il resto
  (NASpI, malattia, maternità, fondi minori) cambia per settore, dimensione e CCNL. L'INAIL è
  escluso del tutto: varia dallo 0,4% al 6% secondo la classe di rischio, e senza sapere la
  lavorazione qualsiasi numero sarebbe inventato;
- il risultato è una proiezione annuale, non un cedolino. Le addizionali si versano a rate
  nell'anno successivo, quindi le singole buste paga non corrispondono al netto annuale diviso
  per le mensilità.

## Fonti

| Regola | Fonte |
| --- | --- |
| Aliquote IRPEF 2026 (23% / 33% / 43%) | [L. 199/2025, legge di bilancio 2026](https://www.mef.gov.it/focus/Principali-misure-della-legge-di-bilancio-2026/) |
| Detrazioni lavoro dipendente | [Art. 13 TUIR](https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-i/art13.html) |
| Taglio del cuneo fiscale | L. 207/2024, art. 1 co. 4-9 |
| Aliquota IVS a carico del lavoratore (9,19%) | [INPS](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2023.02.circolare-numero-24-del-20-02-2023_14085.html) |
| Prima fascia pensionabile 2026 (56.224 €) | [INPS, circolare n. 6 del 30/01/2026](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html) |
| Contributi a carico del datore e TFR | [INPS](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2023.02.circolare-numero-24-del-20-02-2023_14085.html) |
| Premi di risultato, imposta sostitutiva 1% (2026-2027) | [L. 199/2025](https://www.mef.gov.it/focus/Principali-misure-della-legge-di-bilancio-2026/) |
| Fringe benefit, soglie 1.000 / 2.000 € (2025-2027) | [L. 207/2024, art. 1 co. 390-391](https://www.mef.gov.it/focus/Principali-misure-della-legge-di-bilancio-2026/) |
| Addizionali regionali 2026 | [MEF, Dipartimento delle Finanze](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=10) (una pagina per regione) |
| Delibere comunali vigenti | [MEF, addizionale comunale all'IRPEF](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/sceltaregione.htm) (una interrogazione per comune) |

Per le addizionali locali la fonte è sempre il portale del Dipartimento delle Finanze, non il sito
del singolo ente: è l'unico punto in cui la delibera diventa efficace, e ogni link in pagina punta
alla singola interrogazione, così il valore è verificabile in un clic.

| Località | Addizionale regionale | Addizionale comunale |
| --- | --- | --- |
| Milano, Lombardia | 1,23 / 1,58 / 1,72 / 1,73% per scaglioni | 0,8% unica, esenzione 23.000 € |
| Torino, Piemonte | 1,62 / 2,68 / 3,31 / 3,33% per scaglioni | 0,8 / 0,8 / 1,1 / 1,2% per scaglioni, esenzione 11.790 € |
| Firenze, Toscana | 1,42 / 1,43 / 3,32 / 3,33% per scaglioni | 0,2% unica, esenzione 25.000 € |
| Venezia, Veneto | 1,23% aliquota unica | 0,8% unica, esenzione 10.000 € |
| Bari, Puglia | 1,33 / 2,13 / 3,23 / 3,33% per scaglioni | 0,8% unica, esenzione 15.000 € |

## Verifica

`npm test` esegue 32 test sul motore, poi la build, poi 10 test sull'HTML effettivamente
renderizzato.

Il caso di riferimento è verificato a mano e documentato dentro il test, così chi legge può
rifare i conti senza eseguire il codice:

```
RAL 46.000 €, 13 mensilità
  contributi      46.000,00 × 9,19%                      =  4.227,40
  imponibile      46.000,00 − 4.227,40                   = 41.772,60
  IRPEF lorda     28.000 × 23% + 13.772,60 × 33%         = 10.984,96
  detrazione      1.910 × (50.000 − 41.772,60) / 22.000  =    714,29
  IRPEF netta     10.984,96 − 714,29                     = 10.270,67
  add. regionale  per scaglioni                          =    626,79
  add. comunale   41.772,60 × 0,8%                       =    334,18
  netto annuale                                          = 30.540,96
```

Gli altri test coprono i confini degli scaglioni, le soglie di esenzione comunali, il passaggio
del cuneo fiscale a 20.000 €, il fatto che le detrazioni non possano generare un credito
d'imposta, e la coerenza fra tutti i numeri mostrati in pagina.

Sulle località, i test verificano che cambiando comune si muovano solo le addizionali (IRPEF e
contributi sono nazionali), che ognuna delle cinque produca le addizionali calcolate a mano, e
che un comune non supportato venga rifiutato invece di ricadere in silenzio su un altro.

## Se dovessi continuare

Nell'ordine: gli altri comuni, man mano che le regioni pubblicano le aliquote 2026 (il ruleset
li accoglie senza toccare la logica); familiari a carico e oneri deducibili, che sono la prima
cosa che un utente reale chiede; il passaggio da anno intero a periodo di lavoro effettivo.

Sull'AI, la mia posizione è che non debba stare nel calcolo. L'aritmetica del payroll è
deterministica e verificabile, e un numero sbagliato con sicurezza è peggio di nessun numero.
Dove invece la userei subito è a monte: monitorare le fonti normative, segnalare che un'aliquota
è cambiata e preparare la modifica al ruleset per una revisione umana. Il valore sta
nell'accorgersi del cambiamento, non nel fare il conto.
