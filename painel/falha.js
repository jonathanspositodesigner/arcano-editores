/*
 * Quando o editor não abre no navegador (placa de vídeo, WebGPU), oferece o programa para o PC.
 * Os instaladores ficam na página de downloads do GitHub (release "pc"). Fica FORA do build.
 */
(function () {
  'use strict';
  var R = 'https://github.com/jonathanspositodesigner/arcano-editores/releases/download/pc/';
  var ehVideo = /\/video\//.test(location.pathname);
  var nome = ehVideo ? 'Video' : 'Imagem';
  var RE = /placa de vídeo parou|não conseguiu abrir|failed to create|WebGPU|device lost|não abriu/i;
  function caixa() {
    if (document.getElementById('arcano-baixar-pc')) { return; }
    var d = document.createElement('div');
    d.id = 'arcano-baixar-pc';
    d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483645;background:#16121e;border:1px solid #3a2a55;border-radius:14px;padding:16px 18px;color:#eee;font:13px system-ui,sans-serif;box-shadow:0 16px 50px rgba(0,0,0,.5);max-width:92vw;text-align:center';
    var bt = 'display:inline-block;margin:10px 6px 0;padding:9px 14px;border-radius:10px;color:#fff;font-weight:700;text-decoration:none;background:linear-gradient(90deg,#a855f7,#7c3aed)';
    d.innerHTML = '<b style="font-size:14px">O navegador deste computador não aguentou abrir o editor.</b><br>Instale o Arcano Layers no PC (mesmo programa, com o Arcano Conector):<br>' +
      '<a style="' + bt + '" href="' + R + 'ArcanoLayers-' + nome + '-Windows.exe">Baixar para Windows</a>' +
      '<a style="' + bt + '" href="' + R + 'ArcanoLayers-' + nome + '-Mac.pkg">Baixar para Mac</a>' +
      '<div style="margin-top:10px;color:#9b93a8;font-size:12px">Windows: se aparecer "O Windows protegeu o computador", clique em Mais informações → Executar assim mesmo. Mac: clique com o botão direito no instalador → Abrir.</div>';
    document.body.appendChild(d);
  }
  function olhar() { if (RE.test(document.body ? document.body.innerText || '' : '')) { caixa(); } }
  var obs = new MutationObserver(function () { olhar(); });
  function ligar() { obs.observe(document.body, { childList: true, subtree: true, characterData: true }); olhar(); }
  if (document.body) { ligar(); } else { document.addEventListener('DOMContentLoaded', ligar); }
  window.addEventListener('error', function (e) { if (RE.test(String(e.message || ''))) { caixa(); } });
})();
