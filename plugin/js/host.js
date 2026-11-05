/* Arcano Motion / Arcano Design — em qual programa o painel está aberto.
   O MESMO código roda no After Effects (pasta com.arcano.motion) e no Photoshop (pasta com.arcano.design,
   que é uma cópia com outro CSXS/manifest.xml). Este arquivo roda primeiro e decide o "host":
     window.ARCANO_HOST = 'ae' | 'ps'
   Quem manda é o próprio CEP (getHostEnvironment().appName: PHXS/PHSP = Photoshop, AEFT = After).
   Reserva: o nome da pasta da extensão. Nos testes automáticos: window.__arcanoHost. ES5. */
(function () {
  var host = 'ae';
  try {
    if (window.__arcanoHost === 'ps' || window.__arcanoHost === 'ae') { host = window.__arcanoHost; }
    else {
      var app = '';
      try { app = String(JSON.parse(window.__adobe_cep__.getHostEnvironment()).appName || ''); } catch (e) {}
      if (/^PH(XS|SP)$/i.test(app)) { host = 'ps'; }
      else if (!app && /com\.arcano\.design/i.test(decodeURIComponent(window.location.pathname || ''))) { host = 'ps'; }
    }
  } catch (e2) {}
  window.ARCANO_HOST = host;
  try { document.documentElement.classList.add('host-' + host); } catch (e3) {}
  try { if (host === 'ps') { document.title = 'Arcano Design'; } } catch (e4) {}
})();
