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

  // Porta (login do ArcanoApp) e o botão de baixar pro PC quando o navegador não aguenta.
  ['porta.js', 'falha.js'].forEach(function (n) { var s = document.createElement('script'); s.src = '../painel/' + n; document.head.appendChild(s); });
  // Botão de voltar ao ArcanoApp.
  (function () { var s = document.createElement('script'); s.src = '../painel/voltar.js'; document.head.appendChild(s); })();

  var LARGURA = 400, CHAVE = 'arcano-painel-aberto';
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
  // O PLUGIN de verdade (espelho do Arcano Motion, mesma versão do After). ?painelantigo = o painel provisório.
  painel.src = /[?&]painelantigo/.test(location.search) ? '../painel/index.html' : '../plugin/index-web.html';
  painel.setAttribute('allow', 'clipboard-read; clipboard-write; local-network-access');

  var alca = document.createElement('button');
  alca.id = 'arcano-alca';
  alca.type = 'button';
  alca.onclick = function () {
    aberto = !aberto;
    try { localStorage.setItem(CHAVE, aberto ? '1' : '0'); } catch (e) { /* sem storage */ }
    aplicar();
  };

  // Ponte do plugin com o editor: o que no After seria cep.evalScript (ExtendScript) roda aqui no
  // script.run do editor (mesmo modelo do After: app.project, comps, layers…), no contexto que
  // guarda as variáveis entre chamadas (a biblioteca arcano.jsx fica carregada).
  function quandoEditorPronto(f, n) {
    if (window.effectcraft && window.effectcraft.request) { f(); return; }
    if ((n || 0) > 600) { f(new Error('o editor não abriu')); return; }
    setTimeout(function () { quandoEditorPronto(f, (n || 0) + 1); }, 200);
  }
  // Fontes do PC para o PSD: o editor pede as que o navegador não tem, o painel busca pelo Arcano
  // Conector e devolve os arquivos (o editor importa o PSD depois; sem resposta em 25 s importa assim mesmo).
  setInterval(function () {
    var m = window.effectcraft && window.effectcraft.arcano;
    if (!m || typeof m.arcanoFontesPedido !== 'function') { return; }
    var p = ''; try { p = m.arcanoFontesPedido(); } catch (e) { return; }
    if (p) {
      p = JSON.parse(p);
      try { painel.contentWindow.postMessage({ arcano: 'fontes', id: p.id, nomes: p.nomes }, location.origin); } catch (e) { m.arcanoFontesResposta(p.id, []); }
    }
    // Projeto do After (.aep/.aet) jogado no editor: o painel do Arcano Motion lê e monta tudo numa pasta.
    if (typeof m.arcanoAepPedidos === 'function') {
      var lista = []; try { lista = JSON.parse(m.arcanoAepPedidos()) || []; } catch (e) { lista = []; }
      lista.forEach(function (caminho) {
        var b = null; try { b = window.effectcraft.readFile(caminho); } catch (e) { b = null; }
        var nome = String(caminho).split(/[\\/]/).pop();
        if (b && !(b instanceof Uint8Array)) { b = new Uint8Array(b); }
        if (b) { b = b.slice(); }
        try { painel.contentWindow.postMessage({ arcano: 'aep', nome: nome, bytes: b }, location.origin, b ? [b.buffer] : []); } catch (e) { /* sem painel */ }
      });
    }
    // Arquivo > Salvar como projeto do After (.aep): o painel monta o .aep e devolve para baixar
    if (typeof m.arcanoAepSalvar === 'function') {
      var sal = []; try { sal = JSON.parse(m.arcanoAepSalvar()) || []; } catch (e) { sal = []; }
      sal.forEach(function (p) {
        try { painel.contentWindow.postMessage({ arcano: 'salvar-aep', nome: p.nome || 'Projeto' }, location.origin); } catch (e) { /* sem painel */ }
      });
    }
  }, 300);
  window.addEventListener('message', function (ev) {
    if (ev.source !== painel.contentWindow) { return; }
    var d = ev.data || {};
    // o .aep pronto (Salvar como projeto do After): baixa
    if (d.arcano === 'aep-baixar' && d.bytes) {
      try {
        var url = URL.createObjectURL(new Blob([d.bytes], { type: 'application/octet-stream' }));
        var a = document.createElement('a');
        a.href = url; a.download = String(d.nome || 'Projeto.aep');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      } catch (e) { /* o painel avisa */ }
      return;
    }
    if (d.arcano === 'fontes-resposta') {
      var m = window.effectcraft && window.effectcraft.arcano;
      if (m) { try { m.arcanoFontesResposta(d.id, (d.fontes || []).map(function (f) { return f.dados; }).filter(function (b) { return b instanceof Uint8Array; })); } catch (e) { /* o editor importa sozinho depois */ } }
      return;
    }
    // fontes do PC para um projeto do After que o painel vai montar (só instala no editor)
    if (d.arcano === 'fontes-adicionar') {
      var m2 = window.effectcraft && window.effectcraft.arcano, n = 0;
      if (m2 && typeof m2.arcanoFontesAdicionar === 'function') { try { n = m2.arcanoFontesAdicionar((d.fontes || []).filter(function (b) { return b instanceof Uint8Array; })); } catch (e) { n = 0; } }
      painel.contentWindow.postMessage({ arcano: 'fontes-adicionadas', id: d.id, n: n }, location.origin);
      return;
    }
    if (d.arcano !== 'eval') { return; }
    var responder = function (o) { o.arcano = 'eval-resposta'; o.id = d.id; painel.contentWindow.postMessage(o, '*'); };
    // arquivos do PC usados pelo script (mesmo caminho) e o que o script gravar em caminho do PC (volta ao plugin)
    var ec = window.effectcraft;
    var ehDoPC = function (p) { return /^[A-Za-z]:[\\/]|^\/(Users|home|tmp|private|var\/folders)\//.test(p); };
    var antes = {};
    var fotografar = function () { var m = {}; try { (ec.files() || []).forEach(function (f) { m[f.path] = f.size; }); } catch (e) {} return m; };
    var novos = function () {
      var depois = fotografar(), lista = [];
      Object.keys(depois).forEach(function (p) {
        if (!ehDoPC(p) || antes[p] === depois[p] && String(d.codigo).indexOf(JSON.stringify(p).slice(1, -1)) < 0) { return; }
        if ((d.arquivos || []).some(function (a) { return a.caminho === p; })) { return; } // o que acabou de chegar do PC
        var b = ec.readFile(p); if (b) { lista.push({ caminho: p, bytes: b }); }
      });
      return lista;
    };
    var tentar = function (n) {
      if (n === 0) {
        (d.arquivos || []).forEach(function (a) { try { if (ec.putFile) { ec.putFile(a.caminho, a.bytes); } } catch (e) { /* editor antigo */ } });
        antes = fotografar();
      }
      Promise.resolve(ec.request('engine.execute', { command: 'script.run', params: { code: String(d.codigo || ''), name: 'arcano-motion', console: true } }))
        .then(function (r) {
          r = r || {};
          var arquivos = novos();
          if (r.error) { responder({ ok: false, erro: typeof r.error === 'string' ? r.error : JSON.stringify(r.error), arquivos: arquivos }); return; }
          responder({ ok: true, resultado: r.result, arquivos: arquivos });
        }, function (er) {
          // o editor ainda está abrindo: tenta de novo por até 2 minutos
          if (/not running yet/i.test(String(er)) && n < 240) { setTimeout(function () { tentar(n + 1); }, 500); return; }
          responder({ ok: false, erro: String((er && er.message) || er) });
        });
    };
    quandoEditorPronto(function (e) {
      if (e) { responder({ ok: false, erro: e.message }); return; }
      tentar(0);
    });
  });

  function montar() {
    document.body.appendChild(painel);
    document.body.appendChild(alca);
    aplicar();
  }
  if (document.body) { montar(); } else { document.addEventListener('DOMContentLoaded', montar); }
})();
