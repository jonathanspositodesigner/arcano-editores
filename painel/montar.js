/*
 * Monta o painel do Arcano Motion ao lado da composição (editor de vídeo).
 * Carregado pelo index.html do editor (patch do build). Fica FORA do build:
 * mudar o painel não exige recompilar o editor.
 */
(function () {
  'use strict';

  /*
   * ⚠️ ANTES DO EDITOR ABRIR (este script roda antes do módulo dele, que lê a URL):
   * - nogpuworkers: um motor de GPU só. Com vários (um por trabalhador de render) o processo de GPU
   *   do Chrome caía ("GPU device lost… external Instance") e o Chrome bloqueava a GPU do site até
   *   reiniciar. Os trabalhadores passam a renderizar no processador.
   * - nosw: sem service worker. Ele guardava a versão velha do editor no navegador do cliente.
   * Quem quiser o comportamento original: ?gpuworkers na URL.
   */
  try {
    var u = new URL(location.href), mudou = false;
    if (!u.searchParams.has('gpuworkers') && !u.searchParams.has('nogpuworkers')) { u.searchParams.set('nogpuworkers', ''); mudou = true; }
    if (!u.searchParams.has('nosw')) { u.searchParams.set('nosw', ''); mudou = true; }
    if (mudou) { history.replaceState(history.state, '', u.pathname + '?' + u.searchParams.toString().replace(/=(&|$)/g, '$1') + u.hash); }
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
      if (window.caches && caches.keys) { caches.keys().then(function (ks) { ks.forEach(function (k) { if (/^effectcraft/.test(k)) { caches.delete(k); } }); }); }
    }
  } catch (e) { /* segue normal */ }

  // Botão de voltar ao ArcanoApp.
  (function () { var s = document.createElement('script'); s.src = '../painel/voltar.js'; document.head.appendChild(s); })();

  var LARGURA = 380, CHAVE = 'arcano-painel-aberto';
  var aberto = true;
  try { aberto = localStorage.getItem(CHAVE) !== '0'; } catch (e) { /* sem storage */ }

  var css = document.createElement('style');
  css.textContent =
    ':root{--arcano-painel:' + LARGURA + 'px}' +
    'body.arcano-com-painel canvas#effectcraft_canvas{width:calc(100% - var(--arcano-painel))!important;right:auto!important}' +
    'body.arcano-com-painel #loading{right:var(--arcano-painel)}' +
    '#arcano-painel{position:absolute;top:0;right:0;height:100%;width:var(--arcano-painel);border:0;border-left:1px solid #2a2a2e;background:#141416;z-index:5}' +
    'body:not(.arcano-com-painel) #arcano-painel{display:none}' +
    '#arcano-alca{position:absolute;top:50%;z-index:6;width:18px;height:64px;margin-top:-32px;border:1px solid #3a2a55;border-right:0;border-radius:8px 0 0 8px;background:#1d1626;color:#c084fc;cursor:pointer;font:12px system-ui;padding:0}' +
    'body.arcano-com-painel #arcano-alca{right:var(--arcano-painel)}' +
    'body:not(.arcano-com-painel) #arcano-alca{right:0}' +
    '#arcano-alca:hover{background:#2a1d3a}';
  document.head.appendChild(css);

  function aplicar() {
    document.body.classList.toggle('arcano-com-painel', aberto);
    alca.textContent = aberto ? '›' : '‹';
    alca.title = aberto ? 'Fechar o painel Arcano Motion' : 'Abrir o painel Arcano Motion';
    // O editor mede o canvas pelo tamanho na tela: avisa que mudou.
    window.dispatchEvent(new Event('resize'));
  }

  var painel = document.createElement('iframe');
  painel.id = 'arcano-painel';
  painel.title = 'Arcano Motion';
  painel.src = '../painel/index.html';
  painel.setAttribute('allow', 'clipboard-read; clipboard-write; local-network-access');

  var alca = document.createElement('button');
  alca.id = 'arcano-alca';
  alca.type = 'button';
  alca.onclick = function () {
    aberto = !aberto;
    try { localStorage.setItem(CHAVE, aberto ? '1' : '0'); } catch (e) { /* sem storage */ }
    aplicar();
  };

  function montar() {
    document.body.appendChild(painel);
    document.body.appendChild(alca);
    aplicar();
  }
  if (document.body) { montar(); } else { document.addEventListener('DOMContentLoaded', montar); }
})();
