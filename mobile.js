/* ============================================================
   Banana Balistique — aide responsive partagée (jeux d'action)
   À inclure APRÈS bb_save.js dans les niveaux-jeux (N1, N3, N5, N6).
   - Affiche un écran « tourne ton téléphone » en mode portrait.
   - Met la <.stage> à la plus grande taille 16/9 qui tient dans
     l'écran, commandes comprises (plus de débordement en paysage).
   Expose window.bbFit() pour un recalage manuel.
   ============================================================ */
(function () {
  'use strict';

  var css = document.createElement('style');
  css.textContent =
    'html, body { overflow: hidden; }' +
    '#bb-rotate { position: fixed; inset: 0; z-index: 99999; display: none; place-items: center;' +
    '  text-align: center; background: radial-gradient(circle at 50% 30%, #1b2347, #070b18);' +
    '  color: #f7f3df; font-family: system-ui, sans-serif; padding: 24px; }' +
    '#bb-rotate .rot { font-size: 3.4rem; display: inline-block; animation: bbrot 1.8s ease-in-out infinite; }' +
    '#bb-rotate h2 { margin: 14px 0 6px; font-size: 1.4rem; }' +
    '#bb-rotate p { margin: 0; color: #b9bfd5; max-width: 280px; }' +
    '@keyframes bbrot { 0%,100% { transform: rotate(-12deg); } 50% { transform: rotate(80deg); } }' +
    '@media (orientation: portrait) and (max-width: 940px) { #bb-rotate { display: grid; } }';
  document.head.appendChild(css);

  function buildPrompt() {
    if (document.getElementById('bb-rotate')) return;
    var d = document.createElement('div');
    d.id = 'bb-rotate';
    d.innerHTML = '<div><span class="rot">📱</span>' +
      '<h2>Tourne ton téléphone</h2>' +
      '<p>Ce niveau se joue en <strong>mode paysage</strong> (horizontal) — bien plus confortable.</p></div>';
    document.body.appendChild(d);
  }

  function fitStage() {
    var stage = document.querySelector('.stage');
    if (!stage) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    // hauteur réservée aux éléments hors-scène (barre de commandes, indice…)
    var reserved = 0;
    var sibs = document.querySelectorAll('.controls, .hint, .menu-row, .game-shell > p');
    for (var i = 0; i < sibs.length; i++) {
      var el = sibs[i];
      if (stage.contains(el)) continue;
      var r = el.getBoundingClientRect();
      if (r.height > 0) reserved += r.height + 8;
    }
    var availW = Math.min(vw - 12, 1280);
    var availH = vh - reserved - 22;            // marge corps
    var floor = vh * 0.40;                        // la scène garde toujours ≥ 40% de la hauteur
    if (availH < floor) availH = floor;
    var w = Math.min(availW, availH * 16 / 9);
    w = Math.max(260, Math.floor(w));
    stage.style.width = w + 'px';
    stage.style.height = Math.floor(w * 9 / 16) + 'px';
    stage.style.flex = 'none';
    stage.style.margin = '0 auto';
    stage.style.maxWidth = '100%';
  }

  function boot() {
    buildPrompt();
    fitStage();
    // recale quand les commandes apparaissent/disparaissent (menu ↔ jeu)
    try {
      var mo = new MutationObserver(function () { fitStage(); });
      document.querySelectorAll('.controls, .modal').forEach(function (el) {
        mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
      });
    } catch (e) { /* MutationObserver indispo : on s'appuie sur les timers */ }
    [120, 350, 800].forEach(function (ms) { setTimeout(fitStage, ms); });
  }

  window.bbFit = fitStage;
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', function () { setTimeout(fitStage, 200); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
