// ============================================
// PRELOADER (video rosa + mariposa, fallback en CSS)
// ============================================

(function () {
  const preloader = document.getElementById('preloader');
  if (!preloader) return;

  const video = document.getElementById('preloaderVideo');
  const inicio = Date.now();

  const MIN_SIN_VIDEO = 1400;  // sin video (iPhone con autoplay bloqueado): fallback y fuera
  const MIN_SIN_ANIM = 500;    // prefers-reduced-motion: casi inmediato
  const ESPERA_VIDEO = 8.0;    // segundos de video: la mariposa posada, antes de que se borre
  const ESPERA_LENTA = 4.0;    // si el video va lento, se revela antes
  const MAX_MS = 9500;         // nunca mas de 9,5 s reteniendo al visitante
  const ESPERA_FALLBACK = 2200; // si en 2,2 s el video no arranca, se muestra el fallback

  const sinAnimacion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let oculto = false;
  let paginaLista = false;
  let videoListo = false;
  let reproduciendo = false;
  let lento = false;
  let fallbackVisible = false;

  document.body.classList.add('preloader-active');

  function ocultar() {
    if (oculto) return;
    oculto = true;
    preloader.classList.add('hidden');
    document.body.classList.remove('preloader-active');
    setTimeout(() => preloader.remove(), 2400);
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

  // iOS puede bloquear el autoplay (Low Power Mode, politicas de datos):
  // en vez de dejar un fotograma congelado, se muestra el preloader en CSS
  function mostrarFallback() {
    if (fallbackVisible || reproduciendo) return;
    fallbackVisible = true;
    cargarFallback();
    preloader.classList.remove('preloader-video-ready');
    if (video) video.classList.remove('visible');
    setTimeout(ocultar, MIN_SIN_VIDEO);
  }

  if (video && !sinAnimacion) {
    video.addEventListener('canplay', () => {
      // solo se oculta el fallback si el video arranca de verdad
      const p = video.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { mostrarVideo(); reproduciendo = true; })
         .catch(() => { mostrarFallback(); });
      } else {
        mostrarVideo();
      }
    });
    video.addEventListener('playing', () => { mostrarVideo(); reproduciendo = true; });
    video.addEventListener('error', () => { videoListo = false; reproduciendo = false; mostrarFallback(); });
  }

  // watchdog: si el video no está corriendo, se cambia al fallback en CSS
  setTimeout(() => {
    if (!reproduciendo) mostrarFallback();
  }, ESPERA_FALLBACK);

  function listoParaRevelar() {
    if (sinAnimacion) return paginaLista && (Date.now() - inicio) >= MIN_SIN_ANIM;
    if (videoListo && reproduciendo) {
      // si el video no avanza a buen ritmo, se revela antes de esperar 8 s
      if (!lento && (Date.now() - inicio) > 6000 && video.currentTime < 3.5) lento = true;
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
  setTimeout(chequear, 100);

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
