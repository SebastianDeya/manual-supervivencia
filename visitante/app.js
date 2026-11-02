// Interfaz del Modo Visitante. Una sola página con vistas según el hash:
//   #/ (landing) · #/onboarding · #/temporada · #/cargar · #/entrenar · #/pretemporada

import { CONFIG } from './config.js';
import * as store from './gameStore.js';
import { extraerTexto } from './extraer.js';
import { generarPreguntas } from './generar.js';
import { seleccionar } from './seleccion.js';
import * as juego from './juego.js';
import { elegir, MENSAJES } from './mensajes.js';
import { obtenerRanking } from './copa.js';
import { compartirImagen } from './compartir.js';

const $app = document.getElementById('app');
const $toast = document.getElementById('toast');
const LETRAS = ['A', 'B', 'C', 'D'];

let estado, clases, preguntas;
let sesion = null;       // entrenamiento en curso { tipo, ids, idx, elegida, fb, aciertos, resumen }
let archivoElegido = null;
let ocupado = null;      // texto de estado mientras se procesa algo

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoy = () => juego.hoyISO();
const ir = (ruta) => { location.hash = ruta; };

async function cargar() {
  estado = await store.getEstado();
  clases = (await store.listarClases()).sort((a, b) => a.orden - b.orden);
  preguntas = await store.listarPreguntas();
}
const guardarEstado = () => store.setEstado(estado);
const ultimaClaseId = () => clases.length ? clases[clases.length - 1].id : null;

// ---------- Avisos e insignias ----------
let colaToast = [];
function avisar(html, ms = 3500) {
  colaToast.push({ html, ms });
  if (colaToast.length === 1) mostrarToast();
}
function mostrarToast() {
  const t = colaToast[0];
  if (!t) return;
  $toast.innerHTML = t.html;
  $toast.hidden = false;
  $toast.classList.remove('v-toast--in');
  void $toast.offsetWidth; // reinicia la animación (se anula con prefers-reduced-motion)
  $toast.classList.add('v-toast--in');
  setTimeout(() => {
    $toast.hidden = true;
    colaToast.shift();
    mostrarToast();
  }, t.ms);
}
async function revisarInsignias() {
  const nuevas = juego.evaluarInsignias(estado, clases, preguntas);
  for (const id of nuevas) {
    estado.insignias[id] = hoy();
    const i = juego.INSIGNIAS.find((x) => x.id === id);
    avisar(`<strong>Insignia desbloqueada</strong><span>${esc(i.nombre)}</span>`, 4000);
  }
  if (nuevas.length) await guardarEstado();
}

// ---------- Piezas de vista ----------
const ICONOS = {
  llama: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/></svg>',
  primer: '<path d="M5 12l4 4 10-10"/>',
  pretemporada: '<path d="M7 3h8l4 4v14H7z M15 3v4h4"/>',
  semana: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  memoria: '<path d="M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10c1 1 1 3 1 3h6s0-2 1-3a6 6 0 0 0-4-10z"/>',
  dominada: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  invicto: '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z M9 12l2 2 4-4"/>',
  candado: '<path d="M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3"/>',
};
const icono = (id) => `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[id]}</svg>`;

function cabecera(titulo, activa) {
  const racha = juego.rachaVisible(estado, hoy());
  const tab = (ruta, txt) => `<a href="#/${ruta}" ${activa === ruta ? 'aria-current="page"' : ''}>${txt}</a>`;
  return `
    <div class="v-top">
      <span class="v-top__title">// ${esc(titulo)}</span>
      <span class="v-chip" title="Días de racha">${ICONOS.llama} ${racha} ${racha === 1 ? 'día' : 'días'}</span>
    </div>
    <nav class="v-tabs" aria-label="Modo Visitante">
      ${tab('temporada', 'Mi temporada')}${tab('cargar', 'Cargar clase')}${tab('entrenar', 'Entrenar')}
    </nav>`;
}

function barraTemas(clase) {
  const temas = juego.temasDeClase(preguntas, clase.id);
  const dom = temas.filter((t) => t.dominado).length;
  return { temas, dom, html: `
    <div class="v-clase__row">
      <span class="v-clase__name">${esc(clase.nombre)}</span>
      <span class="v-bar" role="img" aria-label="${dom} de ${temas.length} temas dominados"><i style="width:${temas.length ? (dom / temas.length) * 100 : 0}%"></i></span>
      <span class="v-clase__n">${dom}/${temas.length}</span>
    </div>` };
}

// ---------- Vistas ----------
function vistaLanding() {
  return `
    <section class="v-wrap">
      <p class="v-kicker">// Modo Visitante</p>
      <h1 class="v-h1">Entrená tu cursada de visitante</h1>
      <p class="v-lead">Subís el material de cada clase y todos los días respondés 3 preguntas armadas a partir de lo que ya cargaste. Es opcional: el Manual se lee igual sin jugar.</p>
      <ul class="v-list">
        <li>Preguntas armadas solo con la info de tu material.</li>
        <li>Racha, rangos e insignias, sin culpas.</li>
        <li>Tu material queda en tu dispositivo.</li>
      </ul>
      <button class="v-btn" data-acc="empezar">Activar Modo Visitante</button>
      <p class="v-link"><a href="index.html">← Volver al Manual</a></p>
    </section>`;
}

function vistaOnboarding() {
  return `
    <section class="v-wrap">
      <p class="v-kicker">// Antes de arrancar</p>
      <h1 class="v-h1">¿De dónde sos y qué cursás?</h1>
      <form data-form="onboarding" class="v-form">
        <label for="carrera">Tu carrera</label>
        <select id="carrera" required>
          <option value="" disabled ${estado.perfil.carrera ? '' : 'selected'}>Elegí una</option>
          ${CONFIG.carreras.map((c) => `<option ${estado.perfil.carrera === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <label for="materia">Materia que cursás fuera de tu carrera</label>
        <input id="materia" type="text" required maxlength="80" placeholder="Ej: Taller de Narrativas Digitales" value="${esc(estado.perfil.materia)}">
        <button class="v-btn" type="submit">Listo, a cargar mi primera clase</button>
      </form>
    </section>`;
}

async function vistaTemporada() {
  const h = hoy();
  const rango = juego.rangoActual(estado.puntos);
  const pct = rango.siguiente ? Math.min(100, ((estado.puntos - rango.desde) / (rango.siguiente.desde - rango.desde)) * 100) : 100;
  const racha = juego.estadoRacha(estado, h);
  const avisoRacha = racha.tipo === 'protegida' ? MENSAJES.racha.protegida : racha.tipo === 'perdida' ? MENSAJES.racha.perdida : '';
  const ranking = await obtenerRanking(estado);
  const insignias = juego.INSIGNIAS.map((i) => estado.insignias[i.id]
    ? `<button class="v-badge" data-acc="compartir-insignia" data-id="${i.id}" title="Compartir esta insignia">${icono(i.id)}<span>${esc(i.nombre)}</span></button>`
    : `<div class="v-badge v-badge--lock" title="${esc(i.desc)}">${icono('candado')}<span>${esc(i.nombre)}</span></div>`).join('');

  return `
    ${cabecera('Mi temporada', 'temporada')}
    <section class="v-wrap">
      <p class="v-sub">${esc(estado.perfil.carrera)} → ${esc(estado.perfil.materia)}</p>
      ${avisoRacha ? `<p class="v-aviso">${esc(avisoRacha)}</p>` : ''}
      <div class="v-rank">
        <p class="v-rank__label">Tu rango</p>
        <p class="v-rank__name">${esc(rango.nombre)}</p>
        <div class="v-rank__bar"><i style="width:${pct}%"></i></div>
        <p class="v-rank__pts">${rango.siguiente ? `${estado.puntos} / ${rango.siguiente.desde} pts para ${esc(rango.siguiente.nombre)}` : `${estado.puntos} pts · rango máximo`}</p>
      </div>
      <div class="v-stats">
        <div><b>${juego.rachaVisible(estado, h)}</b><span>${juego.rachaVisible(estado, h) === 1 ? 'día' : 'días'} de racha</span></div>
        <div><b>${estado.diasLibres}</b><span>${estado.diasLibres === 1 ? 'día libre' : 'días libres'}</span></div>
        <div><b>${clases.length}</b><span>${clases.length === 1 ? 'clase cargada' : 'clases cargadas'}</span></div>
      </div>

      <h2 class="v-h2">// Insignias · ${Object.keys(estado.insignias).length} de ${juego.INSIGNIAS.length}</h2>
      <div class="v-badges">${insignias}</div>

      <h2 class="v-h2">// Tus clases</h2>
      ${clases.length ? clases.map((c) => {
        const b = barraTemas(c);
        return `<details class="v-clase"><summary>${b.html}</summary>
          <ul class="v-temas">${b.temas.map((t) => `<li><span>${esc(t.tema)}</span><span class="v-bar v-bar--s"><i style="width:${(t.dominadas / t.total) * 100}%"></i></span><span>${t.dominadas}/${t.total}</span></li>`).join('')}</ul>
        </details>`;
      }).join('') : '<p class="v-muted">Todavía no cargaste ninguna clase.</p>'}

      <h2 class="v-h2">// Copa de Carreras</h2>
      <div class="v-copa">
        <ol>${ranking.map((f, i) => `<li ${f.carrera === estado.perfil.carrera ? 'class="v-copa__yo"' : ''}><span>${i + 1}</span><span>${esc(f.carrera)}</span><span>${f.entrenamientos.toLocaleString('es-AR')} entrenamientos</span></li>`).join('')}</ol>
        <p class="v-muted">Tu carrera suma con cada entrenamiento tuyo. Nadie ve tus resultados personales. (Datos de ejemplo por ahora.)</p>
      </div>

      <div class="v-actions">
        <a class="v-btn" href="#/entrenar">Entrenamiento del día</a>
        <a class="v-btn v-btn--sec" href="#/pretemporada">Entrenamiento de pretemporada</a>
        <button class="v-btn v-btn--sec" data-acc="compartir-rango">Compartir mi rango en stories</button>
      </div>

      <details class="v-ajustes">
        <summary>Ajustes</summary>
        ${estado.cursadaTerminada ? '' : '<button class="v-btn v-btn--sec" data-acc="terminar">Marcar cursada como terminada</button>'}
        <button class="v-btn v-btn--sec" data-acc="desactivar">Desactivar Modo Visitante</button>
        <button class="v-btn v-btn--peligro" data-acc="reiniciar">Reiniciar todo mi progreso</button>
      </details>
    </section>`;
}

function vistaCargar() {
  return `
    ${cabecera('Modo Visitante', 'cargar')}
    <section class="v-wrap">
      <p class="v-kicker">Cap. 03 · "Esto nunca lo vi"</p>
      <h1 class="v-h1">Cargá tu clase</h1>
      <p class="v-lead">Subí el material que vieron hoy y armamos tus preguntas. Sin vueltas.</p>

      <label class="v-drop" id="drop" tabindex="0">
        <input type="file" id="archivo" accept=".pdf,.docx,.pptx" hidden>
        <strong id="dropTxt">${archivoElegido ? esc(archivoElegido.name) : 'Arrastrá o elegí tu archivo'}</strong>
        <span>PDF · WORD · POWERPOINT</span>
      </label>

      <label for="nombreClase" class="v-label">Nombre de la clase</label>
      <input id="nombreClase" class="v-input" type="text" maxlength="80" placeholder="Ej: Clase 8 — Narrativa transmedia">

      <p class="v-aviso" id="estadoCarga" role="status" aria-live="polite" ${ocupado ? '' : 'hidden'}>${esc(ocupado || '')}</p>

      <h2 class="v-h2">// Tus clases cargadas</h2>
      ${clases.length ? clases.map((c) => `
        <div class="v-clase v-clase--fila">${barraTemas(c).html}
          <button class="v-x" data-acc="borrar-clase" data-id="${esc(c.id)}" aria-label="Eliminar ${esc(c.nombre)}">Eliminar</button>
        </div>`).join('') : '<p class="v-muted">Todavía no cargaste ninguna.</p>'}

      <p class="v-muted">Tu material se usa solo para armar tus preguntas. No lo publicamos ni lo compartimos con nadie. Todo se procesa en tu dispositivo: el archivo no se sube a ningún lado y solo guardamos el texto extraído.</p>
      <button class="v-btn" data-acc="armar" ${ocupado ? 'disabled' : ''}>Armar mis preguntas</button>
    </section>`;
}

// ----- Entrenamiento -----
const preguntaDe = (id) => preguntas.find((p) => p.id === id);

async function reponerBanco() {
  // Si de una clase no queda ninguna pregunta sin ver, generamos otras desde su texto (una vez por día).
  for (const c of clases) {
    const sinVer = preguntas.filter((p) => p.claseId === c.id && !p.reportada && p.historial.length === 0).length;
    if (sinVer > 0 || c.repuestaEl === hoy()) continue;
    try {
      const nuevas = await generarPreguntas(c, preguntas.filter((p) => p.claseId === c.id).map((p) => p.enunciado));
      await store.guardarPreguntas(nuevas);
      preguntas.push(...nuevas);
    } catch { /* si falla seguimos con lo que hay */ }
    c.repuestaEl = hoy();
    await store.guardarClase(c);
  }
}

async function iniciarDiario() {
  if (!clases.length) return;
  const h = hoy();
  let dia = estado.dias[h];
  if (!dia) dia = estado.dias[h] = { ids: [], respondidas: [], completo: false };
  if (dia.completo) { sesion = { tipo: 'diario', completo: true }; return; }
  // Si se borró o reportó alguna pregunta del día, se reemplaza para no romper la tanda
  const hechas = dia.respondidas.map((r) => r.id);
  const pendientes = dia.ids.filter((id) => !hechas.includes(id) && preguntaDe(id) && !preguntaDe(id).reportada);
  dia.ids = [...hechas, ...pendientes];
  if (dia.ids.length < CONFIG.preguntasPorDia) {
    if (!dia.ids.length) {
      ocupado = 'Preparando tu entrenamiento…';
      $app.innerHTML = vistaEntrenar();
      await reponerBanco();
      ocupado = null;
    }
    const nuevas = seleccionar({ preguntas, clases, n: CONFIG.preguntasPorDia - dia.ids.length, hoy: h, excluirIds: dia.ids });
    dia.ids.push(...nuevas.map((p) => p.id));
    await guardarEstado();
  }
  sesion = { tipo: 'diario', ids: dia.ids, idx: dia.respondidas.length, elegida: null, fb: null, aciertos: dia.respondidas.filter((r) => r.ok).length };
}

function iniciarPretemporada(idsClases) {
  const ps = seleccionar({ preguntas, clases, n: CONFIG.preguntasPretemporada, hoy: hoy(), soloClases: idsClases });
  sesion = { tipo: 'pre', ids: ps.map((p) => p.id), idx: 0, elegida: null, fb: null, aciertos: 0 };
}

function segmentos() {
  const dia = estado.dias[hoy()];
  return sesion.ids.map((_, i) => {
    let cls = '';
    if (i < sesion.idx || (i === sesion.idx && sesion.fb)) {
      const ok = sesion.tipo === 'diario' ? dia?.respondidas[i]?.ok : sesion.resultados?.[i];
      cls = ok ? 'v-seg--ok' : 'v-seg--mal';
    } else if (i === sesion.idx) cls = 'v-seg--act';
    return `<i class="v-seg ${cls}"></i>`;
  }).join('');
}

function vistaPregunta() {
  const p = preguntaDe(sesion.ids[sesion.idx]);
  const clase = clases.find((c) => c.id === p.claseId);
  const pts = sesion.tipo === 'diario' ? CONFIG.puntosPorAcierto : CONFIG.puntosPorAciertoPretemporada;
  const racha = juego.rachaVisible(estado, hoy());
  return `
    <div class="v-top v-top--q">
      <a class="v-cerrar" href="#/temporada" aria-label="Salir del entrenamiento">✕</a>
      <div class="v-segs">${segmentos()}</div>
      <span class="v-chip">${ICONOS.llama} ${racha}</span>
    </div>
    <section class="v-wrap">
      <div class="v-qhead"><span>Pregunta ${sesion.idx + 1} de ${sesion.ids.length}</span><span>+${pts} pts</span></div>
      <p class="v-tag">${esc(clase.nombre)} · Tema: ${esc(p.tema)}</p>
      <h1 class="v-q">${esc(p.enunciado)}</h1>
      <div class="v-opts" role="group" aria-label="Opciones">
        ${p.opciones.map((o, i) => `<button class="v-opt ${sesion.elegida === i ? 'is-sel' : ''}" data-acc="elegir" data-i="${i}" aria-pressed="${sesion.elegida === i}"><b>${LETRAS[i]}</b><span>${esc(o)}</span></button>`).join('')}
      </div>
      <button class="v-btn" data-acc="responder" ${sesion.elegida === null ? 'disabled' : ''}>Responder</button>
      <button class="v-link-btn" data-acc="reportar">Reportar pregunta</button>
    </section>`;
}

function vistaFeedback() {
  const p = preguntaDe(sesion.ids[sesion.idx]);
  const clase = clases.find((c) => c.id === p.claseId);
  const ok = sesion.fb.ok;
  const temas = juego.temasDeClase(preguntas, clase.id);
  const dom = temas.filter((t) => t.dominado).length;
  const delClase = preguntas.filter((q) => q.claseId === clase.id && !q.reportada);
  const acertadas = delClase.filter((q) => q.historial.length && q.historial[q.historial.length - 1].ok).length;
  // Si todavía no hay ningún tema completo, mostramos el avance por preguntas
  const clave = dom === temas.length ? 'aciertoTodosLosTemas' : dom === 0 ? 'aciertoSinTemas' : 'acierto';
  const msj = ok
    ? elegir(clave, { dominados: dom, total: temas.length, clase: clase.nombre, acertadas, preguntas: delClase.length })
    : elegir('errorTitulo');
  const ultima = sesion.idx === sesion.ids.length - 1;
  return `
    <div class="v-top v-top--q">
      <a class="v-cerrar" href="#/temporada" aria-label="Salir del entrenamiento">✕</a>
      <div class="v-segs">${segmentos()}</div>
      <span class="v-chip">${sesion.idx + 1} / ${sesion.ids.length}</span>
    </div>
    <section class="v-wrap">
      <p class="v-sello ${ok ? '' : 'v-sello--mal'}" ${ok ? '' : 'role="alert"'}>${ok ? '¡Golazo!' : 'Uhhh…'}</p>
      <h1 class="v-q">${esc(msj)}</h1>
      ${ok ? '' : `<div class="v-resp v-resp--mal"><b>Tu respuesta (${LETRAS[sesion.fb.elegida]}):</b> ${esc(p.opciones[sesion.fb.elegida])}</div>`}
      <div class="v-resp v-resp--bien"><b>Correcta (${LETRAS[p.correcta]}):</b> ${esc(p.opciones[p.correcta])}</div>
      <div class="v-nota">
        ${ok ? '' : `<p class="v-nota__t">// Por qué no</p><p>${esc(p.porQueNo[sesion.fb.elegida])}</p>`}
        <p class="v-nota__t">// El concepto</p><p>${esc(p.concepto)}</p>
        <p class="v-tag v-tag--r">Ver en: ${esc(clase.nombre)} · Tema: ${esc(p.tema)}</p>
      </div>
      <button class="v-btn" data-acc="seguir" autofocus>${ultima ? 'Terminar' : 'Seguir'}</button>
      <button class="v-link-btn" data-acc="reportar">Reportar pregunta</button>
    </section>`;
}

function vistaFin() {
  const r = sesion.resumen;
  return `
    ${cabecera('Entrenamiento', 'entrenar')}
    <section class="v-wrap">
      <p class="v-sello">${sesion.aciertos} de ${sesion.ids.length}</p>
      <h1 class="v-h1">${esc(r.titulo)}</h1>
      <p class="v-lead">${esc(r.texto)}</p>
      <div class="v-actions">
        <a class="v-btn" href="#/temporada">Ver mi temporada</a>
        ${sesion.tipo === 'diario' ? '<a class="v-btn v-btn--sec" href="#/pretemporada">Entrenamiento de pretemporada</a>' : ''}
      </div>
    </section>`;
}

function vistaEntrenar() {
  if (ocupado) return `${cabecera('Entrenamiento', 'entrenar')}<section class="v-wrap"><p class="v-aviso" role="status">${esc(ocupado)}</p></section>`;
  if (!clases.length) return `${cabecera('Entrenamiento', 'entrenar')}<section class="v-wrap"><h1 class="v-h1">Primero cargá una clase</h1><p class="v-lead">El entrenamiento se arma con tu propio material.</p><a class="v-btn" href="#/cargar">Cargar mi primera clase</a></section>`;
  if (sesion?.completo) return `${cabecera('Entrenamiento', 'entrenar')}<section class="v-wrap"><h1 class="v-h1">Hoy ya entrenaste</h1><p class="v-lead">Volvé mañana por tus próximas ${CONFIG.preguntasPorDia} preguntas. Si querés seguir practicando, hay entrenamiento de pretemporada: no afecta tu racha.</p><div class="v-actions"><a class="v-btn" href="#/pretemporada">Entrenamiento de pretemporada</a><a class="v-btn v-btn--sec" href="#/temporada">Ver mi temporada</a></div></section>`;
  if (!sesion?.ids?.length) return `${cabecera('Entrenamiento', 'entrenar')}<section class="v-wrap"><h1 class="v-h1">No hay preguntas disponibles</h1><p class="v-lead">Cargá otra clase o revisá tu banco.</p><a class="v-btn" href="#/cargar">Cargar clase</a></section>`;
  if (sesion.resumen) return vistaFin();
  return sesion.fb ? vistaFeedback() : vistaPregunta();
}

function vistaPretemporada() {
  if (sesion?.tipo === 'pre' && sesion.ids?.length) return sesion.resumen ? vistaFin() : (sesion.fb ? vistaFeedback() : vistaPregunta());
  return `
    ${cabecera('Pretemporada', 'entrenar')}
    <section class="v-wrap">
      <h1 class="v-h1">Entrenamiento de pretemporada</h1>
      <p class="v-lead">Elegí una o varias clases y practicá una tanda de ${CONFIG.preguntasPretemporada} preguntas antes de un examen. No reemplaza el entrenamiento diario ni afecta tu racha.</p>
      ${clases.length ? `<form data-form="pre" class="v-form">
        ${clases.map((c) => `<label class="v-check"><input type="checkbox" name="clase" value="${esc(c.id)}"> ${esc(c.nombre)}</label>`).join('')}
        <button class="v-btn" type="submit">Empezar</button>
      </form>` : '<p class="v-muted">Cargá una clase primero.</p>'}
    </section>`;
}

// ---------- Render y rutas ----------
async function render() {
  await cargar();
  const ruta = location.hash.replace(/^#\/?/, '') || '';
  document.body.classList.toggle('v-en-juego', /^(entrenar|pretemporada)$/.test(ruta) && !!sesion?.ids?.length && !sesion.resumen);

  if (!estado.activo && ruta !== 'onboarding') { $app.innerHTML = vistaLanding(); return; }
  if (estado.activo && (ruta === '' || ruta === 'onboarding')) { ir('#/temporada'); return; }

  if (ruta === 'onboarding') $app.innerHTML = vistaOnboarding();
  else if (ruta === 'cargar') $app.innerHTML = vistaCargar();
  else if (ruta === 'pretemporada') $app.innerHTML = vistaPretemporada();
  else if (ruta === 'entrenar') {
    if (!sesion || sesion.tipo !== 'diario') { await iniciarDiario(); }
    $app.innerHTML = vistaEntrenar();
  } else $app.innerHTML = await vistaTemporada();

  if (ruta === 'cargar') enlazarCarga();
  window.scrollTo(0, 0);
}

// ---------- Carga de clases ----------
function enlazarCarga() {
  const drop = document.getElementById('drop');
  const input = document.getElementById('archivo');
  const elegirArchivo = (f) => {
    if (!f) return;
    archivoElegido = f;
    document.getElementById('dropTxt').textContent = f.name;
    const nombre = document.getElementById('nombreClase');
    if (!nombre.value) nombre.value = f.name.replace(/\.(pdf|docx|pptx)$/i, '');
  };
  input.addEventListener('change', () => elegirArchivo(input.files[0]));
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); elegirArchivo(e.dataTransfer.files[0]); });
}

function estadoCarga(txt, error = false) {
  ocupado = txt && !error ? txt : null;
  const el = document.getElementById('estadoCarga');
  if (!el) return;
  el.hidden = !txt;
  el.textContent = txt || '';
  el.classList.toggle('v-aviso--error', error);
  const btn = document.querySelector('[data-acc="armar"]');
  if (btn) btn.disabled = !!ocupado;
}

async function armarPreguntas() {
  const nombre = document.getElementById('nombreClase').value.trim();
  if (!archivoElegido) return estadoCarga('Elegí un archivo primero.', true);
  if (!nombre) return estadoCarga('Poné un nombre o número de clase.', true);
  try {
    estadoCarga('Leyendo el archivo…');
    const { secciones } = await extraerTexto(archivoElegido);
    const clase = { id: crypto.randomUUID(), nombre, orden: estado.siguienteOrden, secciones, fecha: new Date().toISOString() };
    estadoCarga('Armando tus preguntas…');
    const nuevas = await generarPreguntas(clase, [], (h, t) => estadoCarga(`Armando tus preguntas… (${h}/${t})`));
    await store.guardarClase(clase);
    await store.guardarPreguntas(nuevas);
    estado.siguienteOrden++;
    await guardarEstado();
    archivoElegido = null;
    await cargar();
    await revisarInsignias();
    ocupado = null;
    avisar(`<strong>Clase cargada</strong><span>${nuevas.length} preguntas nuevas en tu banco</span>`);
    render();
  } catch (e) {
    estadoCarga(e.message || 'No pudimos procesar el archivo.', true);
  }
}

// ---------- Responder ----------
async function responder() {
  const p = preguntaDe(sesion.ids[sesion.idx]);
  const ok = sesion.elegida === p.correcta;
  p.historial.push({ fecha: new Date().toISOString(), ok });
  await store.guardarPregunta(p);
  if (ok) {
    estado.puntos += sesion.tipo === 'diario' ? CONFIG.puntosPorAcierto : CONFIG.puntosPorAciertoPretemporada;
    if (p.claseId !== ultimaClaseId()) estado.aciertosAnteriores++;
    sesion.aciertos++;
  }
  if (sesion.tipo === 'diario') estado.dias[hoy()].respondidas.push({ id: p.id, ok, elegida: sesion.elegida });
  else (sesion.resultados ||= [])[sesion.idx] = ok;
  sesion.fb = { ok, elegida: sesion.elegida };
  await guardarEstado();
  await revisarInsignias();
  $app.innerHTML = vistaFeedback();
  window.scrollTo(0, 0);
}

async function seguir() {
  sesion.idx++;
  sesion.fb = null;
  sesion.elegida = null;
  if (sesion.idx >= sesion.ids.length) await finalizar();
  render();
}

async function finalizar() {
  let titulo = '¡Terminaste la tanda!';
  let texto = `Acertaste ${sesion.aciertos} de ${sesion.ids.length}. Las que fallaste vuelven pronto.`;
  if (sesion.tipo === 'diario') {
    const dia = estado.dias[hoy()];
    dia.completo = true;
    const r = juego.completarDia(estado, hoy());
    titulo = elegir('cierreDia');
    texto = `Acertaste ${sesion.aciertos} de ${sesion.ids.length}. Racha: ${estado.racha} ${estado.racha === 1 ? 'día' : 'días'}.`;
    if (r.ganoDiaLibre) avisar(`<strong>Día libre</strong><span>${esc(MENSAJES.racha.diaLibreGanado)}</span>`, 4500);
  }
  await guardarEstado();
  await revisarInsignias();
  sesion.resumen = { titulo, texto };
}

async function reportar() {
  const p = preguntaDe(sesion.ids[sesion.idx]);
  p.reportada = true;
  await store.guardarPregunta(p);
  if (sesion.fb) { avisar('<strong>Pregunta reportada</strong><span>La sacamos de circulación.</span>'); return; }
  // Todavía no respondida: la reemplazamos por otra
  const [otra] = seleccionar({ preguntas, clases, n: 1, hoy: hoy(), excluirIds: sesion.ids });
  if (otra) sesion.ids[sesion.idx] = otra.id; else sesion.ids.splice(sesion.idx, 1);
  if (sesion.tipo === 'diario') estado.dias[hoy()].ids = sesion.ids;
  await guardarEstado();
  avisar('<strong>Pregunta reportada</strong><span>La sacamos de circulación.</span>');
  if (sesion.idx >= sesion.ids.length) { await finalizar(); }
  render();
}

// ---------- Acciones ----------
const acciones = {
  empezar: () => ir('#/onboarding'),
  elegir: (el) => { sesion.elegida = Number(el.dataset.i); $app.innerHTML = vistaPregunta(); },
  responder: () => responder(),
  seguir: () => seguir(),
  reportar: () => reportar(),
  armar: () => armarPreguntas(),
  'borrar-clase': async (el) => {
    const c = clases.find((x) => x.id === el.dataset.id);
    if (!confirm(`¿Eliminar "${c.nombre}"? Sus preguntas también salen de tu banco.`)) return;
    await store.eliminarClase(c.id);
    sesion = null;
    render();
  },
  'compartir-rango': () => {
    const r = juego.rangoActual(estado.puntos);
    compartirImagen({ kicker: 'Sobreviví de visitante', titulo: r.nombre, detalle: `${estado.puntos} pts · racha de ${juego.rachaVisible(estado, hoy())} días` });
  },
  'compartir-insignia': (el) => {
    const i = juego.INSIGNIAS.find((x) => x.id === el.dataset.id);
    compartirImagen({ kicker: 'Insignia desbloqueada', titulo: i.nombre, detalle: i.desc });
  },
  terminar: async () => {
    if (!confirm('¿Marcar la cursada como terminada?')) return;
    estado.cursadaTerminada = true;
    await guardarEstado();
    await revisarInsignias();
    render();
  },
  desactivar: async () => {
    if (!confirm('¿Desactivar el Modo Visitante? Tu progreso se guarda por si volvés.')) return;
    estado.activo = false;
    await guardarEstado();
    sesion = null;
    render();
  },
  reiniciar: async () => {
    if (!confirm('Esto borra tus clases, preguntas, puntos e insignias. ¿Seguro?')) return;
    await store.reiniciarTodo();
    sesion = null;
    archivoElegido = null;
    ir('#/');
    render();
  },
};

$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-acc]');
  if (el && !el.disabled) acciones[el.dataset.acc]?.(el);
});

$app.addEventListener('submit', async (e) => {
  e.preventDefault();
  const tipo = e.target.dataset.form;
  if (tipo === 'onboarding') {
    estado.activo = true;
    estado.perfil = { carrera: e.target.carrera.value, materia: e.target.materia.value.trim() };
    await guardarEstado();
    ir('#/cargar');
  } else if (tipo === 'pre') {
    const ids = [...e.target.querySelectorAll('input:checked')].map((i) => i.value);
    if (!ids.length) return avisar('<strong>Elegí al menos una clase</strong>');
    iniciarPretemporada(ids);
    if (!sesion.ids.length) { sesion = null; return avisar('<strong>No hay preguntas en esas clases</strong>'); }
    render();
  }
});

// Al cambiar de vista se descarta una pretemporada a medio hacer
window.addEventListener('hashchange', () => {
  // El progreso del día ya está guardado; la tanda en memoria se descarta al salir
  if (location.hash !== '#/pretemporada' && sesion?.tipo === 'pre') sesion = null;
  if (location.hash !== '#/entrenar' && sesion?.tipo === 'diario') sesion = null;
  render();
});
render();
