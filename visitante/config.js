// Valores editables del Modo Visitante. Tocá acá para ajustar el juego.
export const CONFIG = {
  // --- Puntos y rangos ---
  puntosPorAcierto: 10,
  puntosPorAciertoPretemporada: 5,
  rangos: [
    { nombre: 'Debutante', desde: 0 },
    { nombre: 'Titular visitante', desde: 100 },
    { nombre: 'Capitán visitante', desde: 250 },
    { nombre: 'Leyenda de la tribuna', desde: 500 },
  ],

  // --- Entrenamiento ---
  preguntasPorDia: 3,
  preguntasPretemporada: 10,

  // --- Pesos del repaso espaciado (ver seleccion.js) ---
  pesos: {
    recencia: 1.0, // la clase más reciente pesa más
    error: 3.0,    // las preguntas falladas vuelven antes
    olvido: 1.5,   // los temas que hace tiempo no aparecen suben
    base: 0.2,     // piso para que ninguna pregunta quede en cero
  },
  diasMaxOlvido: 14, // a partir de cuántos días sin verse un tema pesa el máximo

  // --- Racha e insignias ---
  diasRachaParaDiaLibre: 7,
  rachaSemanaInvicta: 7,
  aciertosMemoriaTitular: 10,

  // --- Generación de preguntas (local, sin IA) ---
  preguntasPorClase: 18,        // objetivo por clase (15 a 20)
  minCaracteresMaterial: 300,   // menos que esto = archivo sin texto útil
  minPreguntasValidas: 5,

  carreras: ['Sistemas', 'Diseño', 'Administración', 'Comunicación', 'Derecho', 'Ingeniería', 'Psicología', 'Otra'],
};
