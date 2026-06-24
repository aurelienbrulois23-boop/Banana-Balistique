/* ============================================================
   Banana Balistique — bibliothèque de sauvegarde partagée (v2)
   Source unique de vérité : hub + niveaux.

   Modèle :
   - owner  : le DÉDICATAIRE, gravé une seule fois, immuable. Il voyage
              avec le fichier .save (PC, tablette, smartphone). C'est « à qui
              appartient l'édition » — la coupe ne change jamais de nom.
   - sessions : plusieurs joueurs sur une même édition (prêt local). Chacun a
                SA progression. La dédicace, elle, reste celle du propriétaire.
   - activeSession : le joueur en cours ; toute la progression s'y rattache.

   Compatible avec les anciennes sauvegardes v1 (migration automatique).
   Expose window.BB. Aucune dépendance.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'BB_SAVE';
  var LEVEL_ORDER = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'];
  // Passe-partout administrateur (déverrouille TOUT, ignore aussi la progression).
  // Non-secret cryptographiquement (lisible dans ce fichier) — change-le si besoin.
  var ADMIN_CODE = 'AETHONYX-MAITRE-DES-CLES';

  function nowISO() { return new Date().toISOString(); }
  function sanitizeName(name) { return String(name || '').replace(/[<>]/g, '').trim().slice(0, 24); }
  function blankSession() { return { levels: {}, created: nowISO(), updated: nowISO() }; }
  function blank() { return { v: 2, owner: '', tier: 1, admin: false, pseudo: '', code: '', created: nowISO(), updated: nowISO(), activeSession: '', sessions: {}, hof: [] }; }

  /* Migration v1 -> v2 : l'ancien { owner, player, levels } devient une édition
     avec une session unique (le player, sinon l'owner) portant l'ancienne progression. */
  function migrate(o) {
    if (!o || o.v !== 1) return o;
    var n = blank();
    n.owner = typeof o.owner === 'string' ? o.owner : '';
    n.created = o.created || nowISO();
    var who = (o.player && String(o.player)) || n.owner || '';
    var hadLevels = o.levels && typeof o.levels === 'object' && Object.keys(o.levels).length;
    if (who || hadLevels) {
      var name = sanitizeName(who) || 'Joueur';
      n.sessions[name] = { levels: (o.levels && typeof o.levels === 'object') ? o.levels : {}, created: n.created, updated: nowISO() };
      n.activeSession = name;
    }
    return n;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return blank();
      if (o.v === 1) o = migrate(o);
      if (o.v !== 2 || typeof o.sessions !== 'object' || o.sessions === null) return blank();
      if (typeof o.owner !== 'string') o.owner = '';
      if (typeof o.activeSession !== 'string') o.activeSession = '';
      if (!Array.isArray(o.hof)) o.hof = [];
      var t = parseInt(o.tier, 10); o.tier = (t >= 1 && t <= 3) ? t : 1;
      o.admin = !!o.admin;
      if (typeof o.pseudo !== 'string') o.pseudo = '';
      if (typeof o.code !== 'string') o.code = '';
      return o;
    } catch (e) { return blank(); }
  }

  function save(o) { o.updated = nowISO(); try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} return o; }

  /* — Résout le nom de la session active SANS rien créer (lecture pure). — */
  function resolveActive(o) {
    if (o.activeSession && o.sessions[o.activeSession]) return o.activeSession;
    if (o.owner && o.sessions[o.owner]) return o.owner;
    var keys = Object.keys(o.sessions);
    return keys.length ? keys[0] : '';
  }
  /* — En écriture seulement : garantit une session active (ne crée 'Joueur' qu'en tout dernier recours). — */
  function ensureActiveForWrite(o) {
    var name = resolveActive(o);
    if (!name) { name = o.owner || 'Joueur'; o.sessions[name] = blankSession(); }
    o.activeSession = name;
    return o;
  }

  /* — Propriétaire / engramme définitif — */
  function getOwner() { return load().owner || ''; }
  function hasOwner() { return !!getOwner(); }
  function setOwner(name) {
    var o = load();
    if (o.owner) return o;                 // déjà gravé : une dédicace ne se réécrit jamais
    var nm = sanitizeName(name);
    if (!nm) return o;
    o.owner = nm;
    if (!o.sessions[nm]) o.sessions[nm] = blankSession();
    o.activeSession = nm;
    return save(o);
  }

  /* — Sessions (prêt local) — */
  function getActiveSession() { return resolveActive(load()); }
  function listSessions() { return Object.keys(load().sessions); }
  function createSession(name) {
    var o = load();
    var nm = sanitizeName(name);
    if (!nm) return o;
    if (!o.sessions[nm]) o.sessions[nm] = blankSession();
    o.activeSession = nm;
    return save(o);
  }
  function switchSession(name) {
    var o = load();
    var nm = sanitizeName(name);
    if (o.sessions[nm]) { o.activeSession = nm; save(o); }
    return o;
  }
  function removeSession(name) {
    var o = load();
    var nm = sanitizeName(name);
    if (nm === o.owner) return o;          // on ne supprime pas la session du propriétaire
    if (o.sessions[nm]) {
      delete o.sessions[nm];
      if (o.activeSession === nm) { o.activeSession = resolveActive(o); }
      save(o);
    }
    return o;
  }

  /* — Progression : toujours rattachée à la session active — */
  function activeLevels(o) { var name = resolveActive(o); return (name && o.sessions[name]) ? o.sessions[name].levels : {}; }
  function isDone(id) { var l = activeLevels(load())[id]; return !!(l && l.done); }
  function markDone(id, extra) {
    var o = ensureActiveForWrite(load());
    var sess = o.sessions[o.activeSession];
    var prev = sess.levels[id] || {};
    var merged = {};
    for (var k in prev) if (Object.prototype.hasOwnProperty.call(prev, k)) merged[k] = prev[k];
    merged.done = true; merged.completedAt = nowISO();
    if (extra) for (var j in extra) if (Object.prototype.hasOwnProperty.call(extra, j)) merged[j] = extra[j];
    sess.levels[id] = merged; sess.updated = nowISO();
    return save(o);
  }
  function isUnlocked(id) {
    var i = LEVEL_ORDER.indexOf(id);
    if (i <= 0) return true;
    return isDone(LEVEL_ORDER[i - 1]);
  }
  function doneCount() {
    var lv = activeLevels(load()), n = 0;
    LEVEL_ORDER.forEach(function (id) { if (lv[id] && lv[id].done) n++; });
    return n;
  }
  /* Réinitialise la progression de la SESSION ACTIVE uniquement (dédicace + autres sessions intactes). */
  function resetProgress() {
    var o = load();
    var name = resolveActive(o);
    if (!name) return o;
    o.sessions[name].levels = {};
    o.sessions[name].updated = nowISO();
    return save(o);
  }

  /* — Hall of Fame interne : meilleur score par joueur (conservé, écrasé seulement si battu) — */
  function submitScore(name, points) {
    var o = load();
    if (!Array.isArray(o.hof)) o.hof = [];
    var nm = sanitizeName(name) || 'Anonyme';
    var pts = Math.max(0, Math.round(Number(points) || 0));
    var found = null;
    for (var i = 0; i < o.hof.length; i++) { if (o.hof[i].name === nm) { found = o.hof[i]; break; } }
    if (found) { if (pts > found.points) { found.points = pts; found.date = nowISO(); } }
    else { o.hof.push({ name: nm, points: pts, date: nowISO() }); }
    o.hof.sort(function (a, b) { return b.points - a.points; });
    if (o.hof.length > 12) o.hof = o.hof.slice(0, 12);
    return save(o);
  }
  function getHof() { var o = load(); return Array.isArray(o.hof) ? o.hof.slice() : []; }

  /* — Tier d'accès (1=Bronze, 2=Argent, 3=Or) & pseudo officiel — */
  function getTier() { var t = parseInt(load().tier, 10); return (t >= 1 && t <= 3) ? t : 1; }
  function getPseudo() { return load().pseudo || ''; }

  /* — Dernier score de la session active (pour l'accueil « ton dernier score… ») — */
  function setLastScore(points) {
    var o = ensureActiveForWrite(load());
    o.sessions[o.activeSession].lastScore = Math.max(0, Math.round(Number(points) || 0));
    return save(o);
  }
  function getLastScore() {
    var o = load(), name = resolveActive(o);
    return (name && o.sessions[name] && o.sessions[name].lastScore) || 0;
  }

  /* — Codes champion : base64 + somme de contrôle ASSUMÉE. Anti-faute de frappe et anti-bricolage
       grossier, PAS un verrou cryptographique (impossible en statique sans serveur). — */
  function checksum(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) { h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; }
    return h.toString(36);
  }
  function b64enc(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64dec(str) { return decodeURIComponent(escape(atob(str))); }

  function makeCode(p) {
    var core = JSON.stringify({
      t: Math.max(1, Math.min(3, parseInt(p.tier, 10) || 1)),
      p: sanitizeName(p.pseudo),
      n: sanitizeName(p.name),
      s: String(p.saison || '')
    });
    return 'BBQ1-' + b64enc(JSON.stringify({ c: core, k: checksum(core) }));
  }
  function decodeCode(code) {
    var raw = String(code || '').trim();
    if (raw.indexOf('BBQ1-') === 0) raw = raw.slice(5);
    var wrap;
    try { wrap = JSON.parse(b64dec(raw)); } catch (e) { throw new Error('Code illisible (mauvais format).'); }
    if (!wrap || typeof wrap.c !== 'string' || checksum(wrap.c) !== wrap.k) throw new Error('Code invalide ou altéré.');
    var core = JSON.parse(wrap.c);
    return {
      tier: Math.max(1, Math.min(3, parseInt(core.t, 10) || 1)),
      pseudo: sanitizeName(core.p),
      name: sanitizeName(core.n),
      saison: String(core.s || '')
    };
  }
  function isAdmin() { return !!load().admin; }
  function applyCode(code) {
    var raw = String(code || '').trim();
    if (raw && raw === ADMIN_CODE) {
      var oa = load();
      if (!oa.owner) oa.owner = 'Administrateur';
      if (oa.owner && !oa.sessions[oa.owner]) oa.sessions[oa.owner] = blankSession();
      if (oa.owner) oa.activeSession = oa.owner;
      oa.tier = 3; oa.admin = true; oa.pseudo = oa.pseudo || 'ADMIN'; oa.code = raw;
      save(oa);
      return { tier: 3, pseudo: 'ADMIN', name: oa.owner, saison: '', admin: true };
    }
    var p = decodeCode(code);               // lève une erreur si invalide
    var o = load();
    var who = p.name || p.pseudo;
    if (!o.owner && who) o.owner = who;
    if (who && !o.sessions[who]) o.sessions[who] = blankSession();
    if (who) o.activeSession = who;
    o.pseudo = p.pseudo;
    o.tier = p.tier;
    o.code = String(code).trim();
    save(o);
    return p;
  }

  /* — Export / import du fichier .save (toute l'édition : propriétaire + sessions) — */
  function download(filename) {
    var o = load();
    var safe = (o.owner || 'edition').replace(/[^\w\-]+/g, '-');
    var name = filename || ('banana-balistique_' + safe + '_' + nowISO().slice(0, 10) + '.save');
    var blob = new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 120);
    return name;
  }
  function importText(text) {
    var o = JSON.parse(text);
    if (o && o.v === 1) o = migrate(o);
    if (!o || o.v !== 2 || typeof o.sessions !== 'object' || o.sessions === null) {
      throw new Error('Fichier de sauvegarde invalide ou corrompu.');
    }
    if (typeof o.owner !== 'string') o.owner = '';
    if (typeof o.activeSession !== 'string') o.activeSession = '';
    if (!Array.isArray(o.hof)) o.hof = [];
    var t = parseInt(o.tier, 10); o.tier = (t >= 1 && t <= 3) ? t : 1;
    o.admin = !!o.admin;
    if (typeof o.pseudo !== 'string') o.pseudo = '';
    if (typeof o.code !== 'string') o.code = '';
    save(o);
    return o;
  }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} }

  window.BB = {
    KEY: KEY, LEVEL_ORDER: LEVEL_ORDER, nowISO: nowISO,
    load: load, save: save,
    getOwner: getOwner, hasOwner: hasOwner, setOwner: setOwner,
    getActiveSession: getActiveSession, listSessions: listSessions,
    createSession: createSession, switchSession: switchSession, removeSession: removeSession,
    isDone: isDone, markDone: markDone, isUnlocked: isUnlocked, doneCount: doneCount, resetProgress: resetProgress,
    submitScore: submitScore, getHof: getHof,
    getTier: getTier, getPseudo: getPseudo, isAdmin: isAdmin, getLastScore: getLastScore, setLastScore: setLastScore,
    makeCode: makeCode, decodeCode: decodeCode, applyCode: applyCode,
    download: download, importText: importText, reset: reset
  };
})();
