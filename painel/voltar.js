/*
 * Botão "Voltar ao ArcanoApp" nos dois editores (vídeo e imagem). Fica FORA do build.
 * Dentro do ArcanoApp (iframe), volta a página de cima; aberto direto, volta nesta aba.
 */
(function () {
  'use strict';
  var DESTINO = 'https://arcanoapp.voxvisual.com.br/arcano-layers';
  function voltar() {
    try { if (window.top !== window) { window.top.location.href = DESTINO; return; } } catch (e) { /* outra origem: segue */ }
    location.href = DESTINO;
  }
  var css = document.createElement('style');
  // Aba pequena na borda direita (logo abaixo da alça do painel no editor de vídeo),
  // para não cobrir menu, timeline nem barra de status dos editores.
  css.textContent =
    '#arcano-voltar{position:fixed;right:0;top:50%;margin-top:40px;z-index:7;width:18px;height:64px;padding:0;display:flex;align-items:center;justify-content:center;' +
    'border:1px solid #3a2a55;border-right:0;border-radius:8px 0 0 8px;background:#1d1626;color:#c084fc;cursor:pointer}' +
    '#arcano-voltar:hover{background:#2a1d3a;color:#e9d5ff}' +
    '#arcano-voltar svg{width:13px;height:13px}' +
    'body.arcano-com-painel #arcano-voltar{right:var(--arcano-painel,0px)}';
  document.head.appendChild(css);
  var b = document.createElement('button');
  b.id = 'arcano-voltar';
  b.type = 'button';
  b.title = 'Voltar ao ArcanoApp (escolher editar imagem ou vídeo)';
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>';
  b.onclick = voltar;
  function montar() { document.body.appendChild(b); }
  if (document.body) { montar(); } else { document.addEventListener('DOMContentLoaded', montar); }
})();
