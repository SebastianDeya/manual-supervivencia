// Mensajes de feedback editables. Nunca prometen resultados: solo reconocen avances reales.
// Placeholders: {dominados} {total} {clase} {acertadas} {preguntas}

export const MENSAJES = {
  acierto: [
    'Bien ahí. Ya dominás {dominados} de los {total} temas de {clase}.',
    'Esa la sacaste: {dominados} de {total} temas dominados en {clase}.',
    'Punto para vos. En {clase} ya llevás {dominados}/{total} temas.',
    'Cada acierto suma: {dominados} de {total} temas de {clase} bajo control.',
  ],
  aciertoSinTemas: [
    'Bien ahí. Ya acertaste {acertadas} de {preguntas} preguntas de {clase}.',
    'Punto para vos: {acertadas}/{preguntas} preguntas de {clase} ya las tenés.',
  ],
  aciertoTodosLosTemas: [
    'Ya dominás todos los temas de {clase}.',
    '{clase}: {total} de {total} temas dominados.',
  ],
  errorTitulo: [
    'Tranqui, para eso entrenamos.',
    'No salió, pero ahora sabés qué mirar.',
    'Pasa. Así se aprende de visitante.',
    'Se corrige: esta pregunta vuelve en unos días.',
  ],
  cierreDia: [
    'Entrenamiento del día completo.',
    'Listo por hoy. Mañana, más.',
    'Cumpliste con el entrenamiento de hoy.',
  ],
  racha: {
    protegida: 'Un día sin jugar: usamos un día libre para cuidar tu racha.',
    perdida: 'Hace unos días que no entrenás. Hoy arranca una racha nueva, sin drama.',
    diaLibreGanado: '¡Ganaste un día libre! Protege tu racha si un día no podés jugar.',
  },
};

let ultimo = {};

/** Elige un mensaje de la lista evitando repetir el anterior de esa misma lista. */
export function elegir(clave, datos = {}) {
  const lista = clave.split('.').reduce((o, k) => o[k], MENSAJES);
  let i = Math.floor(Math.random() * lista.length);
  if (lista.length > 1 && i === ultimo[clave]) i = (i + 1) % lista.length;
  ultimo[clave] = i;
  return lista[i].replace(/\{(\w+)\}/g, (_, k) => datos[k] ?? '');
}
