/*
 * Service worker do Arcano Motion no NAVEGADOR (layers.voxvisual.com.br/plugin/). No After não faz nada.
 * Igual ao After: quando sai versão nova, o painel avisa, a pessoa clica em "Baixar e instalar" e o painel
 * baixa o MESMO zip publicado (latest.json) e guarda os arquivos no Cache Storage ('arcano-plugin-<versão>').
 * Este arquivo serve esses arquivos no lugar dos do servidor. Sem versão instalada, ou se o servidor já tiver
 * uma mais nova (arquivo VERSAO), passa direto para o servidor (sempre conferindo, sem cópia velha do navegador).
 */
var PREF = 'arcano-plugin-';
var BASE = self.registration.scope;   // https://.../plugin/
var ativa = null;                      // promessa: versão instalada que vale agora (ou null)

function comparar(a, b) {
  var x = String(a).split('.'), y = String(b).split('.');
  for (var i = 0; i < Math.max(x.length, y.length); i++) {
    var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
    if (d) { return d; }
  }
  return 0;
}

function versaoAtiva() {
  if (ativa) { return ativa; }
  ativa = caches.open(PREF + 'ativa')
    .then(function (c) { return c.match(BASE + '__ativa__'); })
    .then(function (r) { return r ? r.text() : null; })
    .then(function (v) {
      v = (v || '').trim();
      if (!v) { return null; }
      return fetch(BASE + 'VERSAO?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.text() : ''; }, function () { return ''; })
        // versão IGUAL à do servidor: serve a instalada (é a mesma versão, e o servidor pode estar entregando
        // arquivos velhos do cache HTTP de 4 h: era isso que fazia o aviso de atualização voltar sem parar)
        .then(function (s) { s = s.trim(); return s && comparar(s, v) > 0 ? null : v; });
    })
    .catch(function () { return null; });
  return ativa;
}

// do servidor sem usar a cópia guardada no navegador sem conferir (o cache HTTP de 4 h podia misturar versões)
function rede(req) {
  if (req.mode === 'navigate') { return fetch(req); }
  try { return fetch(new Request(req, { cache: 'no-cache' })); } catch (e) { return fetch(req); }
}

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('message', function (e) { if (e.data && e.data.arcano === 'versao') { ativa = null; } });

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.url.indexOf(BASE) !== 0) { return; }
  var u = new URL(req.url), rel = u.pathname.slice(new URL(BASE).pathname.length);
  if (rel === 'sw.js' || rel === 'VERSAO') { return; }
  e.respondWith(versaoAtiva().then(function (v) {
    if (!v) { return rede(req); }
    return caches.open(PREF + v)
      .then(function (c) { return c.match(u.origin + u.pathname); })
      .then(function (r) { return r || rede(req); });
  }, function () { return rede(req); }));
});
