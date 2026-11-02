// Extracción de texto de PDF, Word (.docx) y PowerPoint (.pptx) en el navegador.
// Devuelve { secciones: [{ titulo, texto }], texto } conservando títulos y subtítulos,
// porque cada pregunta tiene que citar el tema de donde sale.
// Las librerías se cargan desde CDN recién cuando se sube un archivo.

import { CONFIG } from './config.js';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

const scripts = {};
function cargarScript(url) {
  if (!scripts[url]) {
    scripts[url] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No pudimos cargar el lector de archivos. Revisá tu conexión.'));
      document.head.appendChild(s);
    });
  }
  return scripts[url];
}

/** Arma las secciones a partir de una lista de bloques { titulo: bool, texto }. */
function armarSecciones(bloques) {
  const secciones = [];
  let actual = null;
  for (const b of bloques) {
    const t = b.texto.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (b.titulo) {
      // Títulos consecutivos sin cuerpo en el medio se unen en uno solo
      if (actual && actual.lineas.length === 0) actual.titulo += ' ' + t;
      else { actual = { titulo: t, lineas: [] }; secciones.push(actual); }
    } else {
      if (!actual) { actual = { titulo: 'Introducción', lineas: [] }; secciones.push(actual); }
      actual.lineas.push(t);
    }
  }
  return secciones
    .map((s) => ({ titulo: s.titulo, texto: s.lineas.join('\n') }))
    .filter((s) => s.texto);
}

function resultado(secciones) {
  const texto = secciones.map((s) => `## ${s.titulo}\n${s.texto}`).join('\n\n');
  const cuerpo = secciones.reduce((n, s) => n + s.texto.length, 0);
  if (cuerpo < CONFIG.minCaracteresMaterial) {
    const e = new Error('No encontramos texto en este archivo. Si es un PDF escaneado (una foto de las hojas), no podemos leerlo: probá con otra versión del material.');
    e.codigo = 'SIN_TEXTO';
    throw e;
  }
  return { secciones, texto };
}

// ---------- PDF ----------
// Los títulos se detectan por tamaño de letra: líneas cortas bastante más grandes que la mediana.
async function extraerPdf(buffer) {
  await cargarScript(PDFJS);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const lineas = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const tc = await (await pdf.getPage(n)).getTextContent();
    const porY = [];
    for (const it of tc.items) {
      if (!it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const alto = it.height || Math.abs(it.transform[3]);
      let l = porY.find((l) => Math.abs(l.y - y) <= 2);
      if (!l) { l = { y, alto: 0, partes: [] }; porY.push(l); }
      l.partes.push({ x: it.transform[4], s: it.str });
      l.alto = Math.max(l.alto, alto);
    }
    porY.sort((a, b) => b.y - a.y).forEach((l) =>
      lineas.push({ alto: l.alto, texto: l.partes.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ') }));
  }
  const altos = lineas.map((l) => l.alto).sort((a, b) => a - b);
  const mediana = altos[Math.floor(altos.length / 2)] || 0;
  return resultado(armarSecciones(lineas.map((l) => ({
    titulo: mediana > 0 && l.alto >= mediana * 1.25 && l.texto.length >= 3 && l.texto.length <= 100,
    texto: l.texto,
  }))));
}

const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
const textoDe = (nodo, tag) => [...nodo.getElementsByTagName(tag)].map((t) => t.textContent).join('');

// ---------- Word ----------
// Los encabezados se detectan por el estilo del párrafo (Heading 1, Título 1, etc.).
async function extraerDocx(buffer) {
  await cargarScript(JSZIP);
  const zip = await window.JSZip.loadAsync(buffer);
  const archivo = zip.file('word/document.xml');
  if (!archivo) throw new Error('Este archivo de Word no parece válido.');
  const doc = xml(await archivo.async('string'));
  const bloques = [...doc.getElementsByTagName('w:p')].map((p) => {
    const estilo = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') || '';
    return { titulo: /^(heading|ttulo|titulo|title|subttulo|subtitle)/i.test(estilo), texto: textoDe(p, 'w:t') };
  });
  return resultado(armarSecciones(bloques));
}

// ---------- PowerPoint ----------
// Cada diapositiva es una sección; su título es el cuadro de título (placeholder "title"/"ctrTitle").
async function extraerPptx(buffer) {
  await cargarScript(JSZIP);
  const zip = await window.JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .map((n) => n.match(/^ppt\/slides\/slide(\d+)\.xml$/))
    .filter(Boolean)
    .sort((a, b) => a[1] - b[1]);
  if (!slides.length) throw new Error('Este archivo de PowerPoint no parece válido.');
  const bloques = [];
  for (const m of slides) {
    const doc = xml(await zip.file(m[0]).async('string'));
    let titulo = '';
    const cuerpo = [];
    for (const sp of doc.getElementsByTagName('p:sp')) {
      const tipo = sp.getElementsByTagName('p:ph')[0]?.getAttribute('type') || '';
      const parrafos = [...sp.getElementsByTagName('a:p')].map((p) => textoDe(p, 'a:t'));
      if (/^(title|ctrTitle)$/.test(tipo)) titulo = parrafos.join(' ');
      else cuerpo.push(...parrafos);
    }
    // Sin título: lo ponemos igual para no mezclar diapositivas
    bloques.push({ titulo: true, texto: titulo.trim() || `Diapositiva ${m[1]}` });
    cuerpo.forEach((t) => bloques.push({ titulo: false, texto: t }));
  }
  return resultado(armarSecciones(bloques));
}

export async function extraerTexto(archivo) {
  const nombre = archivo.name.toLowerCase();
  const buffer = await archivo.arrayBuffer();
  if (nombre.endsWith('.pdf')) return extraerPdf(buffer);
  if (nombre.endsWith('.docx')) return extraerDocx(buffer);
  if (nombre.endsWith('.pptx')) return extraerPptx(buffer);
  throw new Error('Formato no soportado. Subí un PDF, un Word (.docx) o un PowerPoint (.pptx).');
}
