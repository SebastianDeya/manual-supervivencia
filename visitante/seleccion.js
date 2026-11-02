// Selección de preguntas con repaso espaciado.
// Cada pregunta recibe un puntaje con tres criterios (pesos en config.js):
//   recencia: las clases más nuevas tienen más probabilidad.
//   error:    las preguntas falladas vuelven antes.
//   olvido:   los temas que hace más tiempo no aparecen suben su prioridad.
// Después se sortea con probabilidad proporcional al puntaje, evitando repetir tema.

import { CONFIG } from './config.js';
import { diasEntre } from './juego.js';

const claveTema = (p) => `${p.claseId}|${p.tema}`;

export function seleccionar({ preguntas, clases, n, hoy, excluirIds = [], soloClases = null }) {
  const w = CONFIG.pesos;
  const ordenadas = [...clases].sort((a, b) => a.orden - b.orden);
  const recencia = new Map(ordenadas.map((c, i) => [c.id, (i + 1) / ordenadas.length]));

  // Última vez que apareció algún ejercicio de cada tema
  const ultimaVez = new Map();
  for (const p of preguntas) {
    for (const h of p.historial) {
      const k = claveTema(p);
      if (!ultimaVez.has(k) || h.fecha > ultimaVez.get(k)) ultimaVez.set(k, h.fecha);
    }
  }

  const puntaje = (p) => {
    const rec = recencia.get(p.claseId) ?? 0;
    const h = p.historial;
    let err = 0;
    if (h.length) err = !h[h.length - 1].ok ? 1 : (h.filter((x) => !x.ok).length / h.length) * 0.5;
    const vez = ultimaVez.get(claveTema(p));
    const olv = vez ? Math.min(1, diasEntre(vez.slice(0, 10), hoy) / CONFIG.diasMaxOlvido) : 1;
    return w.recencia * rec + w.error * err + w.olvido * olv + w.base;
  };

  let pool = preguntas.filter((p) =>
    !p.reportada && !excluirIds.includes(p.id) && (!soloClases || soloClases.includes(p.claseId)));
  const elegidas = [];
  while (elegidas.length < n && pool.length) {
    // Evitamos que las preguntas del día sean del mismo tema, si hay alternativa
    const usados = new Set(elegidas.map(claveTema));
    const candidatas = pool.filter((p) => !usados.has(claveTema(p)));
    const base = candidatas.length ? candidatas : pool;
    const pesos = base.map(puntaje);
    let r = Math.random() * pesos.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < base.length - 1 && (r -= pesos[i]) > 0) i++;
    elegidas.push(base[i]);
    pool = pool.filter((p) => p !== base[i]);
  }
  return elegidas;
}
