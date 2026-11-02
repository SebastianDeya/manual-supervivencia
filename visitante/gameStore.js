// Capa de datos del Modo Visitante. Hoy guarda todo en IndexedDB (en el dispositivo).
// Si más adelante hay backend, alcanza con reimplementar estas funciones.
// Solo se guarda el texto extraído de cada clase, nunca el archivo original.

const DB_NAME = 'manual-visitante';
let dbPromise;

function abrir() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        db.createObjectStore('meta');
        db.createObjectStore('clases', { keyPath: 'id' });
        db.createObjectStore('preguntas', { keyPath: 'id' }).createIndex('claseId', 'claseId');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbPromise;
}

async function pedir(store, modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(store, modo).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function transaccion(stores, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, 'readwrite');
    fn(t);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

const ESTADO_INICIAL = {
  activo: false,
  perfil: { carrera: '', materia: '' },
  puntos: 0,
  racha: 0,
  mejorRacha: 0,
  diasLibres: 0,
  ultimoDia: null,            // último día con entrenamiento completo (YYYY-MM-DD)
  entrenamientosCompletos: 0,
  aciertosAnteriores: 0,      // aciertos en clases que no eran la más reciente
  insignias: {},              // id -> fecha
  dias: {},                   // fecha -> { ids, respondidas, completo }
  cursadaTerminada: false,
  siguienteOrden: 1,
};

export async function getEstado() {
  const e = await pedir('meta', 'readonly', (s) => s.get('estado'));
  return { ...structuredClone(ESTADO_INICIAL), ...(e || {}) };
}
export const setEstado = (e) => pedir('meta', 'readwrite', (s) => s.put(e, 'estado'));

export const listarClases = () => pedir('clases', 'readonly', (s) => s.getAll());
export const guardarClase = (c) => pedir('clases', 'readwrite', (s) => s.put(c));

export const listarPreguntas = () => pedir('preguntas', 'readonly', (s) => s.getAll());
export const guardarPregunta = (p) => pedir('preguntas', 'readwrite', (s) => s.put(p));
export const guardarPreguntas = (ps) =>
  transaccion('preguntas', (t) => ps.forEach((p) => t.objectStore('preguntas').put(p)));

/** Borra la clase y todas sus preguntas del banco. */
export const eliminarClase = (id) =>
  transaccion(['clases', 'preguntas'], (t) => {
    t.objectStore('clases').delete(id);
    const cur = t.objectStore('preguntas').index('claseId').openKeyCursor(IDBKeyRange.only(id));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { t.objectStore('preguntas').delete(c.primaryKey); c.continue(); }
    };
  });

/** Reinicia todo el progreso. */
export const reiniciarTodo = () =>
  transaccion(['meta', 'clases', 'preguntas'], (t) => {
    ['meta', 'clases', 'preguntas'].forEach((s) => t.objectStore(s).clear());
  });
