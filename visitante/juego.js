// Reglas del juego: fechas, rangos, racha, progreso por tema e insignias.
// Son funciones puras sobre el estado (sin tocar el DOM ni la base).

import { CONFIG } from './config.js';

// ---------- Fechas (día local, formato YYYY-MM-DD) ----------
export function hoyISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function diasEntre(a, b) {
  const t = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

// ---------- Rangos ----------
export function rangoActual(puntos) {
  const rs = CONFIG.rangos;
  let i = 0;
  rs.forEach((r, idx) => { if (puntos >= r.desde) i = idx; });
  return { ...rs[i], indice: i, siguiente: rs[i + 1] || null };
}

// ---------- Racha ----------
/**
 * Situación de la racha hoy:
 *  ok        → al día (o todavía no hay nada que cuidar)
 *  protegida → faltaron días pero alcanzan los días libres
 *  perdida   → faltaron más días que los días libres: la racha vuelve a empezar
 */
export function estadoRacha(estado, hoy) {
  if (!estado.ultimoDia) return { tipo: 'ok' };
  const perdidos = diasEntre(estado.ultimoDia, hoy) - 1;
  if (perdidos <= 0) return { tipo: 'ok' };
  return estado.diasLibres >= perdidos ? { tipo: 'protegida', perdidos } : { tipo: 'perdida' };
}

export const rachaVisible = (estado, hoy) => (estadoRacha(estado, hoy).tipo === 'perdida' ? 0 : estado.racha);

/**
 * Registra un entrenamiento diario completo. Modifica `estado`.
 * Cada `diasRachaParaDiaLibre` días de racha se gana un día libre.
 */
export function completarDia(estado, hoy) {
  const r = estadoRacha(estado, hoy);
  if (r.tipo === 'perdida') { estado.racha = 1; }
  else {
    if (r.tipo === 'protegida') estado.diasLibres -= r.perdidos; // se gastan solos
    estado.racha += 1;
  }
  estado.mejorRacha = Math.max(estado.mejorRacha, estado.racha);
  estado.ultimoDia = hoy;
  estado.entrenamientosCompletos += 1;
  const gano = estado.racha % CONFIG.diasRachaParaDiaLibre === 0;
  if (gano) estado.diasLibres += 1;
  return { racha: r.tipo, ganoDiaLibre: gano };
}

// ---------- Progreso por tema ----------
const dominada = (p) => p.historial.length > 0 && p.historial[p.historial.length - 1].ok;

/** Temas de una clase: un tema está dominado si su última respuesta en cada pregunta fue correcta. */
export function temasDeClase(preguntas, claseId) {
  const mapa = new Map();
  for (const p of preguntas) {
    if (p.claseId !== claseId || p.reportada) continue;
    const t = mapa.get(p.tema) || { tema: p.tema, total: 0, dominadas: 0 };
    t.total++;
    if (dominada(p)) t.dominadas++;
    mapa.set(p.tema, t);
  }
  return [...mapa.values()].map((t) => ({ ...t, dominado: t.dominadas === t.total }));
}

// ---------- Insignias ----------
export const INSIGNIAS = [
  { id: 'primer', nombre: 'Primer entrenamiento', desc: 'Completá tu primer entrenamiento diario.' },
  { id: 'pretemporada', nombre: 'Pretemporada', desc: 'Subí el material de tu primera clase.' },
  { id: 'semana', nombre: 'Semana invicta', desc: 'Sostené una racha de 7 días.' },
  { id: 'memoria', nombre: 'Memoria de titular', desc: 'Acertá 10 preguntas de clases anteriores a la más reciente.' },
  { id: 'dominada', nombre: 'Clase dominada', desc: 'Respondé bien todas las preguntas de una clase.' },
  { id: 'invicto', nombre: 'Invicto de visitante', desc: 'Terminá la cursada sosteniendo el entrenamiento.' },
];

/** Devuelve los ids de insignias que se cumplen y todavía no se ganaron. */
export function evaluarInsignias(estado, clases, preguntas) {
  const cumple = {
    primer: estado.entrenamientosCompletos >= 1,
    pretemporada: clases.length >= 1,
    semana: estado.mejorRacha >= CONFIG.rachaSemanaInvicta,
    memoria: estado.aciertosAnteriores >= CONFIG.aciertosMemoriaTitular,
    dominada: clases.some((c) => {
      const qs = preguntas.filter((p) => p.claseId === c.id && !p.reportada);
      return qs.length > 0 && qs.every((p) => p.historial.some((h) => h.ok));
    }),
    invicto: estado.cursadaTerminada && estado.racha >= CONFIG.rachaSemanaInvicta,
  };
  return INSIGNIAS.filter((i) => cumple[i.id] && !estado.insignias[i.id]).map((i) => i.id);
}
