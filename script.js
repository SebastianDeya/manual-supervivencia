// Animación de scroll: fade-in / slide-up con IntersectionObserver
const revealEls = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealEls.forEach((el) => observer.observe(el));

// Formulario visual sin backend: no envía nada a ningún lado,
// solo simula una confirmación para que la sección "se sienta" funcional.
const shareForm = document.getElementById('shareForm');

if (shareForm) {
  shareForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = shareForm.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = '¡Gracias, la anotamos! ✔';
    btn.disabled = true;
    shareForm.reset();
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2500);
  });
}
