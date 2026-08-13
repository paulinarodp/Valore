/**
 * Limiti di RAL entro cui il prototipo produce un risultato attendibile.
 *
 * Il minimo evita di modellare il trattamento integrativo (D.L. 3/2020), che
 * spetta solo sotto i 15.000 € di imponibile e che il prototipo non calcola.
 *
 * Il massimo è il limite oltre cui la legge di bilancio 2026 "sterilizza" il
 * taglio dell'aliquota al 33% riducendo di 440 € le detrazioni per oneri: una
 * regola che dipende dagli oneri detraibili del singolo contribuente e che
 * questo prototipo, per scelta, non modella.
 */
export const MIN_RAL = 18_000;
export const MAX_RAL = 200_000;

export const DEFAULT_RAL = 46_000;

/**
 * Netto aggiuntivo da consegnare nel confronto fra le leve retributive.
 *
 * Il default è 2.000 € perché è il punto in cui si vedono entrambe le soglie
 * dei fringe benefit: senza figli a carico la leva copre metà dell'obiettivo,
 * con figli lo copre tutto. Resta comunque un input, perché il confronto
 * cambia parecchio a seconda della cifra.
 */
export const DEFAULT_TARGET_NET = 2_000;
export const MIN_TARGET_NET = 100;
export const MAX_TARGET_NET = 10_000;
