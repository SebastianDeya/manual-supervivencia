// Genera una imagen vertical (1080x1920) para stories y la comparte o la descarga.

function ajustarTexto(ctx, texto, maxAncho) {
  const lineas = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width > maxAncho && actual) { lineas.push(actual); actual = palabra; }
    else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** `kicker` y `titulo` van grandes; `detalle` es una línea chica al pie. */
export async function compartirImagen({ kicker, titulo, detalle }) {
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#1c1a17';
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = '#ff5a3c';
  ctx.fillRect(90, 520, 900, 760);
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(70, 500, 900, 760);

  ctx.fillStyle = '#1c1a17';
  ctx.textAlign = 'center';
  ctx.font = '700 40px "Space Mono", monospace';
  ctx.fillText(kicker.toUpperCase(), 520, 600);

  ctx.font = '110px "Archivo Black", sans-serif';
  const lineas = ajustarTexto(ctx, titulo.toUpperCase(), 780);
  lineas.forEach((l, i) => ctx.fillText(l, 520, 780 + i * 130));

  ctx.font = '700 38px "Space Mono", monospace';
  ctx.fillText(detalle, 520, 1180);

  ctx.fillStyle = '#f4efe4';
  ctx.font = '48px "Archivo Black", sans-serif';
  ctx.fillText('MANUAL DE SUPERVIVENCIA', 540, 1560);
  ctx.font = '700 34px "Space Mono", monospace';
  ctx.fillText('¿Y vos?', 540, 1620);

  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const archivo = new File([blob], 'mi-temporada.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = archivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
