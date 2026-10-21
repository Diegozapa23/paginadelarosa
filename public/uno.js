// ============================================
// PRELOADER (video rosa + mariposa, fallback en CSS)
// ============================================

(function () {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;

  const video = document.getElementById('preloaderVideo');
  const inicio = Date.now();

  const MIN_SIN_VIDEO = 3000;  // fallback CSS: 3 s y fuera
  const MIN_SIN_ANIM = 500;    // prefers-reduced-motion: casi inmediato
  const ESPERA_VIDEO = 8.0;    // segundos de video: la mariposa posada, antes de que se borre
  const ESPERA_LENTA = 4.0;    // si el video va lento, se revela antes
  const MAX_MS = 9500;         // nunca mas de 9,5 s reteniendo al visitante

  const sinAnimacion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let oculto = false;
  let paginaLista = false;
  let videoListo = false;
  let reproduciendo = false;
  let lento = false;

  document.body.classList.add('preloader-active');

  function ocultar() {
    if (oculto) return;
    oculto = true;
    preloader.classList.add('hidden');
    document.body.classList.remove('preloader-active');
    setTimeout(() => preloader.remove(), 2400);
  }

  function reproducir() {
    if (!video) return;
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  function mostrarVideo() {
    videoListo = true;
    preloader.classList.add('preloader-video-ready');
    video.classList.add('visible');
  }

  // el logo del fallback solo se descarga si el video no arranca
  function cargarFallback() {
    const img = preloader.querySelector('.preloader-logo');
    if (img && img.dataset.src && !img.src) img.src = img.dataset.src;
  }

  if (video && !sinAnimacion) {
    video.addEventListener('canplay', () => {
      // solo se oculta el fallback si el video arranca de verdad
      const p = video.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { mostrarVideo(); reproduciendo = true; })
         .catch(() => { cargarFallback(); });
      } else {
        mostrarVideo();
      }
    });
    video.addEventListener('playing', () => { mostrarVideo(); reproduciendo = true; });
    // si el video falla, se queda el fallback en CSS
    video.addEventListener('error', () => {
      videoListo = false;
      reproduciendo = false;
      cargarFallback();
    });
  }

  // si el video tarda mucho en arrancar, se completa el fallback
  setTimeout(() => { if (!videoListo) cargarFallback(); }, 3000);

  function listoParaRevelar() {
    if (sinAnimacion) return paginaLista && (Date.now() - inicio) >= MIN_SIN_ANIM;
    if (videoListo && reproduciendo) {
      // si el video no avanza a buen ritmo, se revela antes de esperar 8 s
      if (!lento && (Date.now() - inicio) > 6000 && video.currentTime < 4.5) lento = true;
      return paginaLista && video.currentTime >= (lento ? ESPERA_LENTA : ESPERA_VIDEO);
    }
    return paginaLista && (Date.now() - inicio) >= MIN_SIN_VIDEO;
  }

  function chequear() {
    if (oculto) return;
    if (listoParaRevelar() || (Date.now() - inicio) >= MAX_MS) ocultar();
    else setTimeout(chequear, 100);
  }

  window.addEventListener('load', () => { paginaLista = true; });
  setTimeout(chequear, 120);

  // clic para saltar
  preloader.addEventListener('click', ocultar);
})();

// ============================================
// MENÚ HAMBURGUESA
// ============================================

const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', function(e) {
    e.preventDefault();
    menuToggle.classList.toggle('active');
    mobileMenu.classList.toggle('active');
  });

  const menuLinks = mobileMenu.querySelectorAll('a');
  menuLinks.forEach(link => {
    link.addEventListener('click', () => {
      menuToggle.classList.remove('active');
      mobileMenu.classList.remove('active');
    });
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('header')) {
      menuToggle.classList.remove('active');
      mobileMenu.classList.remove('active');
    }
  });
}

// ============================================
// PREGUNTAS FRECUENTES (FAQ)
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  const faqToggles = document.querySelectorAll('.faq-toggle');

  faqToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      const contentId = this.getAttribute('aria-controls');
      const content = document.getElementById(contentId);
      this.setAttribute('aria-expanded', !isExpanded);
      content.classList.toggle('open', !isExpanded);
    });
  });
});
