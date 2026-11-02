// Copa de Carreras: ranking colectivo por cantidad de entrenamientos completados.
// Nunca muestra personas, solo carreras.
//
// DATOS SIMULADOS: no hay backend compartido, así que se usan cifras de ejemplo más
// los entrenamientos de este dispositivo. Para conectarla de verdad, reemplazá
// `obtenerRanking` por un fetch a un endpoint que devuelva [{ carrera, entrenamientos }]
// y sumá los entrenamientos propios con otro endpoint.

const EJEMPLO = [
  { carrera: 'Sistemas', entrenamientos: 1284 },
  { carrera: 'Diseño', entrenamientos: 1107 },
  { carrera: 'Administración', entrenamientos: 962 },
  { carrera: 'Comunicación', entrenamientos: 845 },
  { carrera: 'Derecho', entrenamientos: 720 },
  { carrera: 'Ingeniería', entrenamientos: 690 },
  { carrera: 'Psicología', entrenamientos: 560 },
];

export async function obtenerRanking(estado) {
  const filas = EJEMPLO.map((f) => ({ ...f }));
  const propia = estado.perfil.carrera;
  if (propia && propia !== 'Otra') {
    const fila = filas.find((f) => f.carrera === propia);
    if (fila) fila.entrenamientos += estado.entrenamientosCompletos;
    else filas.push({ carrera: propia, entrenamientos: estado.entrenamientosCompletos });
  }
  return filas.sort((a, b) => b.entrenamientos - a.entrenamientos).slice(0, 5);
}
