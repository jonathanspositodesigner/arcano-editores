/*
 * Gancho do Arcano no editor de imagem (carregado pelo index.html do editor, patch do build).
 * Fica FORA do build: trava de login, voltar ao início e o painel do Arcano Design (o MESMO
 * plugin do Photoshop, em modo Photoshop) ao lado da imagem.
 * O painel fala com o editor de forma síncrona por window.photocraftArcano (arcano.rs no build):
 * é o mesmo módulo que o carregador do editor já abriu (mesma URL = mesma instância).
 */
(function () {
  'use strict';
  window.ARCANO_GANCHO_IMAGEM = true;
  // Porta (login do ArcanoApp) e o botão de baixar pro PC quando o navegador não aguenta.
  ['porta.js', 'falha.js', 'voltar.js'].forEach(function (n) { var s = document.createElement('script'); s.src = '../painel/' + n; document.head.appendChild(s); });

  // Ponte síncrona com o editor: o módulo do editor (o carregador já importou; aqui só pega a mesma instância).
  function ligarPonte(n) {
    import(new URL('app/photocraft-web.js', location.href).href).then(function (m) {
      if (m && typeof m.arcanoPedido === 'function') {
        var teste = JSON.parse(m.arcanoPedido('ui.inspect', '{}'));
        if (!teste.ok && /abrindo/.test(String(teste.error))) { throw new Error('abrindo'); }
        window.photocraftArcano = m;
        return;
      }
      throw new Error('sem ponte');
    }).catch(function () { if ((n || 0) < 300) { setTimeout(function () { ligarPonte((n || 0) + 1); }, 400); } });
  }
  ligarPonte(0);

  var LARGURA = 400, CHAVE = 'arcano-painel-imagem-aberto';
  var aberto = true;
  try { aberto = localStorage.getItem(CHAVE) !== '0'; } catch (e) { /* sem storage */ }

  var css = document.createElement('style');
  css.textContent =
    ':root{--arcano-painel:' + LARGURA + 'px}' +
    'body.arcano-com-painel canvas#photocraft_canvas{width:calc(100% - var(--arcano-painel))!important;right:auto!important}' +
    'body.arcano-com-painel #photocraft_loading{right:var(--arcano-painel)}' +
    '#arcano-painel{position:absolute;top:0;right:0;height:100%;width:var(--arcano-painel);border:0;border-left:1px solid #2a2a2e;background:#141416;z-index:5}' +
    'body:not(.arcano-com-painel) #arcano-painel{display:none}' +
    '#arcano-alca{position:absolute;top:50%;z-index:6;width:18px;height:64px;margin-top:-32px;border:1px solid #3a2a55;border-right:0;border-radius:8px 0 0 8px;background:#1d1626;color:#c084fc;cursor:pointer;font:12px system-ui;padding:0}' +
    'body.arcano-com-painel #arcano-alca{right:var(--arcano-painel)}' +
    'body:not(.arcano-com-painel) #arcano-alca{right:0}' +
    '#arcano-alca:hover{background:#2a1d3a}';
  document.head.appendChild(css);

  var painel = document.createElement('iframe');
  painel.id = 'arcano-painel';
  painel.title = 'Arcano Design';
  painel.src = '../plugin/index-web.html?host=ps';
  painel.setAttribute('allow', 'clipboard-read; clipboard-write; local-network-access');

  var alca = document.createElement('button');
  alca.id = 'arcano-alca';
  alca.type = 'button';
  function aplicar() {
    document.body.classList.toggle('arcano-com-painel', aberto);
    alca.textContent = aberto ? '›' : '‹';
    alca.title = aberto ? 'Fechar o painel Arcano Design' : 'Abrir o painel Arcano Design';
    window.dispatchEvent(new Event('resize'));
  }
  alca.onclick = function () {
    aberto = !aberto;
    try { localStorage.setItem(CHAVE, aberto ? '1' : '0'); } catch (e) { /* sem storage */ }
    aplicar();
  };

  // Barra rápida da camada e conta do ArcanoApp (arcano.rs do editor, desenhadas pelo editor): os
  // pedidos do editor (alterar, upscale, remover fundo, sair) vão para o painel do Arcano Design, que
  // faz a IA; os recados do painel (conta, preços, andamento, erro) voltam para o editor.
  var recados = [];
  setInterval(function () {
    var m = window.photocraftArcano;
    if (!m || typeof m.arcanoBarraPedidos !== 'function') { return; }
    while (recados.length) { try { m.arcanoBarraReceber(JSON.stringify(recados.shift())); } catch (e) { /* segue */ } }
    var lista = [];
    try { lista = JSON.parse(m.arcanoBarraPedidos()) || []; } catch (e) { return; }
    lista.forEach(function (p) { try { painel.contentWindow.postMessage({ arcanoBarraPedido: p }, location.origin); } catch (e) { /* sem painel */ } });
  }, 150);
  window.addEventListener('message', function (e) {
    if (e.source !== painel.contentWindow || e.origin !== location.origin || !e.data || !e.data.arcanoBarra) { return; }
    recados.push(e.data.arcanoBarra);
  });

  function montar() {
    document.body.appendChild(painel);
    document.body.appendChild(alca);
    aplicar();
  }
  if (document.body) { montar(); } else { document.addEventListener('DOMContentLoaded', montar); }
})();
