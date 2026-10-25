/* Installable shell for the same RhymeOrbit site, not a second deployment. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .catch(() => { /* Normal online browsing works without service workers. */ });
  }, { once: true });
})();
