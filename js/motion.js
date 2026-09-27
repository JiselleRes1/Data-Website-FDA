// Shared motion layer: smooth scroll, scroll-triggered reveals, count-up
// numbers, tilt cards, scroll progress bar, hero spotlight. Loaded on both
// pages after GSAP/ScrollTrigger/Lenis/vanilla-tilt from CDN.

(function () {
  gsap.registerPlugin(ScrollTrigger);

  // ---- Smooth scroll (Lenis) driving GSAP's ticker ----
  const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;

  // ---- Scroll progress bar ----
  const bar = document.querySelector('.scroll-progress');
  if (bar) {
    ScrollTrigger.create({
      start: 0,
      end: () => document.documentElement.scrollHeight - window.innerHeight,
      onUpdate: (self) => { bar.style.width = `${self.progress * 100}%`; },
    });
  }

  // ---- Reveal-on-scroll for any .reveal element ----
  window.initReveals = function initReveals(selector = '.reveal') {
    document.querySelectorAll(selector).forEach((el, i) => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          gsap.to(el, { opacity: 1, y: 0, duration: 0.8, delay: (i % 4) * 0.05, ease: 'power3.out' });
        },
      });
    });
  };

  // ---- Count-up number animation ----
  window.countUp = function countUp(el, target, { decimals = 0, prefix = '', suffix = '', duration = 1.4 } = {}) {
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          v: target,
          duration,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = prefix + obj.v.toLocaleString(undefined, {
              minimumFractionDigits: decimals, maximumFractionDigits: decimals,
            }) + suffix;
          },
        });
      },
    });
  };

  // ---- Immediate (non-scroll-gated) number animation, for live dashboard updates ----
  window.animateValue = function animateValue(el, target, { decimals = 0, prefix = '', suffix = '', duration = 0.6 } = {}) {
    const current = parseFloat((el.dataset.raw || '0').replace(/,/g, '')) || 0;
    const obj = { v: current };
    el.dataset.raw = target;
    gsap.to(obj, {
      v: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = prefix + obj.v.toLocaleString(undefined, {
          minimumFractionDigits: decimals, maximumFractionDigits: decimals,
        }) + suffix;
      },
    });
  };

  // ---- Tilt on cards ----
  window.initTilt = function initTilt(selector) {
    const els = document.querySelectorAll(selector);
    if (els.length && window.VanillaTilt) {
      VanillaTilt.init(els, { max: 5, speed: 400, glare: false, scale: 1.01 });
    }
  };

  // ---- Hero spotlight follows cursor ----
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.addEventListener('pointermove', (e) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      hero.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  }

  // ---- Hero headline: split lines into spans and animate in ----
  window.animateHeroLines = function animateHeroLines(selector) {
    const lines = document.querySelectorAll(`${selector} .line`);
    gsap.set(lines, { yPercent: 110 });
    gsap.to(lines, { yPercent: 0, duration: 1.1, stagger: 0.12, ease: 'power4.out', delay: 0.2 });
  };

  document.addEventListener('DOMContentLoaded', () => {
    ScrollTrigger.refresh();
  });
})();
