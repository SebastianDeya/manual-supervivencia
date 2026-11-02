// Generación de preguntas SIN IA y sin servidor: todo corre en el navegador, sin costo.
// A partir del texto de la clase arma dos tipos de pregunta de opción múltiple:
//   1. Definición: "¿Cómo define el material a X?" cuando hay una frase "X es/se define como Y".
//      Los distractores son las definiciones de otros conceptos del mismo material.
//   2. Completar: una frase del material con un término clave en blanco.
//      Los distractores son otros términos del mismo material.
// Cada pregunta guarda la frase original como respaldo, así que nada sale de afuera del material.

import { CONFIG } from './config.js';

const normalizar = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const mezclar = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const recortar = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/**
 * Valida una pregunta. Descarta si el esquema no se cumple o si el fragmento de
 * respaldo no aparece textualmente en el material. Devuelve la pregunta con las
 * opciones mezcladas, o null.
 */
export function validarPregunta(q, textoMaterial) {
  try {
    const str = (v) => typeof v === 'string' && v.trim().length > 0;
    if (!q || !str(q.enunciado) || !str(q.concepto) || !str(q.tema) || !str(q.fragmento)) return null;
    if (!Array.isArray(q.opciones) || q.opciones.length !== 4 || !q.opciones.every(str)) return null;
    if (new Set(q.opciones.map(normalizar)).size !== 4) return null;
    if (!Number.isInteger(q.correcta) || q.correcta < 0 || q.correcta > 3) return null;
    if (!Array.isArray(q.porQueNo) || q.porQueNo.length !== 4) return null;
    for (let i = 0; i < 4; i++) if (i !== q.correcta && !str(q.porQueNo[i])) return null;
    const frag = normalizar(q.fragmento);
    if (frag.length < 15 || !normalizar(textoMaterial).includes(frag)) return null;

    // Mezclamos para que la correcta no caiga siempre en la misma letra
    const orden = mezclar([0, 1, 2, 3]);
    return {
      enunciado: q.enunciado.trim(),
      opciones: orden.map((i) => q.opciones[i].trim()),
      correcta: orden.indexOf(q.correcta),
      porQueNo: orden.map((i) => (i === q.correcta ? '' : String(q.porQueNo[i]).trim())),
      concepto: q.concepto.trim(),
      tema: q.tema.trim(),
      fragmento: q.fragmento.trim(),
    };
  } catch { return null; }
}

// ---------- Análisis del texto ----------
const PALABRAS_COMUNES = new Set(`porque también entonces cuando donde mientras además aunque sobre entre hacia desde hasta según durante través ejemplo
forma manera mismo misma mismos mismas cada todos todas otros otras algunos algunas muchos muchas puede pueden pueda podría tiene tienen tener hacer
hace hacen está están estar sería serán fueron siendo cualquier cualquiera ninguno ninguna nuestro nuestra ellos ellas estos estas esos esas
siempre nunca ahora luego después antes primero segundo tercero parte partes tipo tipos nivel casos caso cosas cosa gran grandes nuevo nueva
nuevos nuevas mucho mucha varios varias través dentro fuera además incluso solo sólo como cual cuales quien quienes cuyo cuya`.split(/\s+/).map(normalizar));

const RE_PALABRA = /[\p{L}\p{N}][\p{L}\p{N}-]{5,}/gu;
const esTermino = (w) => !PALABRAS_COMUNES.has(normalizar(w)) && !/^\d+$/.test(w);

/** Parte las secciones en frases utilizables: ni muy cortas ni muy largas, sin preguntas ni títulos de lista. */
function frasesDe(secciones) {
  const out = [];
  secciones.forEach((sec, si) => {
    for (const linea of sec.texto.split('\n')) {
      const limpia = linea.replace(/^\s*(?:[•\-–*·▪]|\d+[.)])\s*/, '');
      for (let f of limpia.split(/(?<=[.!?])\s+/)) {
        f = f.trim();
        const palabras = f.split(/\s+/).length;
        if (f.length < 40 || f.length > 240 || palabras < 6 || /[?:]$/.test(f) || /^[¿]/.test(f)) continue;
        out.push({ texto: f, sin: f.replace(/[.!;]+$/, ''), tema: sec.titulo, seccion: si });
      }
    }
  });
  return out;
}

/** Frecuencia de cada término clave en todo el material (clave normalizada → { forma, veces }). */
function indiceTerminos(frases) {
  const mapa = new Map();
  for (const f of frases) {
    for (const w of f.texto.match(RE_PALABRA) || []) {
      if (!esTermino(w)) continue;
      const k = normalizar(w);
      const e = mapa.get(k) || { forma: w, veces: 0 };
      e.veces++;
      mapa.set(k, e);
    }
  }
  return mapa;
}

// "X es / son / se define como / se denomina / consiste en  Y"
const RE_DEF = /^((?:(?:el|la|los|las|un|una)\s+)?[^,;:()]{3,60}?)\s+(?:es|son|se define como|se denomina|se llama|significa|consiste en|se refiere a)\s+(.{20,160})$/i;

function parDefinicion(f) {
  const m = f.sin.match(RE_DEF);
  if (!m || m[1].split(/\s+/).length > 7) return null;
  return { sujeto: m[1].replace(/^(El|La|Los|Las|Un|Una)\s/, (a) => a.toLowerCase()), definicion: m[2] };
}

// ---------- Armado de preguntas ----------
const aSujeto = (s) => (/^el /.test(s) ? `al ${s.slice(3)}` : `a ${s}`);

function preguntaDefinicion(f, def, otras) {
  // Distractores: definiciones de otros conceptos, de largo parecido
  const cand = otras
    .filter((o) => normalizar(o.definicion) !== normalizar(def.definicion) && normalizar(o.sujeto) !== normalizar(def.sujeto))
    .sort((a, b) => Math.abs(a.definicion.length - def.definicion.length) - Math.abs(b.definicion.length - def.definicion.length) + (Math.random() - 0.5) * 40);
  const vistos = new Set([normalizar(def.definicion)]);
  const dis = [];
  for (const c of cand) {
    const k = normalizar(c.definicion);
    if (vistos.has(k)) continue;
    vistos.add(k);
    dis.push(c);
    if (dis.length === 3) break;
  }
  if (dis.length < 3) return null;
  return {
    enunciado: `Según el material, ¿cómo se define ${def.sujeto}?`,
    opciones: [def.definicion, ...dis.map((d) => d.definicion)],
    correcta: 0,
    porQueNo: ['', ...dis.map((d) => `Esa descripción corresponde ${aSujeto(d.sujeto)}, no ${aSujeto(def.sujeto)}.`)],
    concepto: `El material lo plantea así: «${f.texto}»`,
    tema: f.tema,
    fragmento: f.texto,
  };
}

function preguntaCompletar(f, indice, frases) {
  const enFrase = new Set((f.texto.match(RE_PALABRA) || []).map(normalizar));
  // Término a ocultar: palabra poco repetida en todo el material (suele ser un concepto clave)
  const candidatos = (f.texto.match(RE_PALABRA) || [])
    .filter((w) => esTermino(w) && indice.get(normalizar(w))?.veces <= 3)
    .sort((a, b) => b.length - a.length);
  const termino = candidatos[0];
  if (!termino) return null;
  const kT = normalizar(termino);

  // Distractores: otros términos del material, de largo y terminación parecidos, que no estén en la frase
  const pool = [...indice.entries()]
    .filter(([k]) => k !== kT && !enFrase.has(k) && !kT.includes(k) && !k.includes(kT))
    .map(([k, e]) => ({ k, forma: e.forma, p: -Math.abs(e.forma.length - termino.length) + (k.slice(-2) === kT.slice(-2) ? 3 : 0) + Math.random() * 2 }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);
  if (pool.length < 3) return null;

  // Respetamos la mayúscula inicial del original
  const conforma = (w) => (termino[0] === termino[0].toUpperCase() ? w[0].toUpperCase() + w.slice(1) : w[0].toLowerCase() + w.slice(1));
  const hueco = f.texto.replace(termino, '_____');
  const otraFrase = (k) => frases.find((x) => x !== f && normalizar(x.texto).split(' ').includes(k));
  return {
    enunciado: `Completá la frase del material: «${hueco}»`,
    opciones: [termino, ...pool.map((d) => conforma(d.forma))],
    correcta: 0,
    porQueNo: ['', ...pool.map((d) => {
      const o = otraFrase(d.k);
      return o ? `«${conforma(d.forma)}» aparece en el material en otro contexto: «${recortar(o.texto, 110)}»` : `«${conforma(d.forma)}» no encaja en esta frase.`;
    })],
    concepto: `El material lo plantea así: «${f.texto}»`,
    tema: f.tema,
    fragmento: f.texto,
  };
}

/**
 * Genera el grupo de preguntas de una clase. `clase` = { id, nombre, secciones, orden }.
 * `evitar`: enunciados que ya existen (para reponer el banco sin repetir).
 * `alProgreso(hechas, total)` se mantiene por compatibilidad con la interfaz.
 */
export async function generarPreguntas(clase, evitar = [], alProgreso = () => {}) {
  alProgreso(0, 1);
  const texto = clase.secciones.map((s) => `## ${s.titulo}\n${s.texto}`).join('\n\n');
  const frases = frasesDe(clase.secciones);
  const indice = indiceTerminos(frases);
  const defs = frases.map((f) => ({ f, def: parDefinicion(f) })).filter((x) => x.def);

  // Una frase candidata por vez, repartidas entre secciones (round-robin) para cubrir todos los temas
  const porSeccion = new Map();
  for (const f of mezclar(frases)) {
    if (!porSeccion.has(f.seccion)) porSeccion.set(f.seccion, []);
    porSeccion.get(f.seccion).push(f);
  }
  const colas = [...porSeccion.values()];
  const vistas = new Set(evitar.map(normalizar));
  const validas = [];
  let quedan = true;
  while (validas.length < CONFIG.preguntasPorClase && quedan) {
    quedan = false;
    for (const cola of colas) {
      if (validas.length >= CONFIG.preguntasPorClase) break;
      const f = cola.shift();
      if (!f) continue;
      quedan = true;
      const d = defs.find((x) => x.f === f)?.def;
      const cruda = (d && preguntaDefinicion(f, d, defs.map((x) => x.def))) || preguntaCompletar(f, indice, frases);
      const q = cruda && validarPregunta(cruda, texto);
      if (!q || vistas.has(normalizar(q.enunciado))) continue;
      vistas.add(normalizar(q.enunciado));
      validas.push(q);
    }
  }
  alProgreso(1, 1);

  if (validas.length < CONFIG.minPreguntasValidas) {
    throw new Error('Este material no tiene suficientes frases completas para armar preguntas. Probá con apuntes en oraciones (no solo listas de palabras sueltas).');
  }
  return validas.map((q) => ({
    ...q,
    id: `${clase.id}-${crypto.randomUUID()}`,
    claseId: clase.id,
    reportada: false,
    historial: [], // [{ fecha, ok }]
  }));
}
