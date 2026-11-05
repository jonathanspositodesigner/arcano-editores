/*
  Arcano Motion — tradução da interface (pt → en / es).

  O painel é escrito em português. Em vez de trocar cada texto do código por uma chave, este arquivo
  traduz o que aparece na TELA: cada texto e cada title/placeholder/aria-label/alt que entra no
  documento passa pelo dicionário (js/i18n-dados.js, gerado a partir dos textos do plugin).

    • exato:   "Comprar créditos" → ["Buy credits", "Comprar créditos"]
    • modelos: "Custa {0} créditos" → ["Costs {0} credits", "Cuesta {0} créditos"]
      (o {0} é o pedaço que muda — número, nome... — e volta igual, ou traduzido se também estiver no dicionário)

  O original em português fica guardado no próprio nó: trocar de idioma (inclusive de volta para o
  português) refaz a tela inteira na hora, sem recarregar. Conteúdo da pessoa e da IA (mensagens do
  chat, campos de texto) não é tocado.
*/
(function () {
  var D = window.ARCANO_I18N || { exato: {}, modelos: [] };
  var IDX = { en: 0, es: 1 };
  var idioma = 'pt';
  // No Photoshop (Arcano Design) a mesma tela fala do Photoshop: troca o nome do programa e do plugin
  // depois da tradução. Mensagens do chat e campos de texto continuam intocados.
  var PS = window.ARCANO_HOST === 'ps';
  function deHost(v) {
    if (!PS || v == null) { return v; }
    var s = String(v).replace(/Arcano Motion/g, 'Arcano Design').replace(/After Effects/g, 'Photoshop');
    // "After" sozinho só é o programa em português e espanhol (em inglês pode ser a palavra "depois")
    if (idioma !== 'en') { s = s.replace(/\bAfter\b/g, 'Photoshop'); }
    // em inglês "After" no começo da frase pode ser a palavra; no meio da frase, com maiúscula, é o programa
    else { s = s.replace(/\bAfter\b/g, function (m, pos, tudo) { return /(^|[.!?]\s+|\n\s*)$/.test(tudo.slice(0, pos)) ? m : 'Photoshop'; }); }
    return s;
  }
  var ATRIBUTOS = ['title', 'placeholder', 'aria-label', 'alt'];
  var PULAR = '[data-no-tr], .msg-usuario, .msg-claude, textarea, pre, code, script, style';
  var PULAR_ATRIB = '[data-no-tr], .msg-usuario, .msg-claude';   // em campos de texto, title/placeholder traduzem

  // ---------- modelos: expressão regular por modelo, indexados pela primeira palavra ----------
  var porPalavra = {}, comecaVariavel = [];
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  (D.modelos || []).forEach(function (m) {
    var pt = m[0], partes = pt.split(/(\{\d+\})/), ordem = [], re = '';
    // modelo com pouco texto fixo ("{0} de {1}", "{0}min"): as variáveis só podem ser números,
    // senão "{0} de {1}" casaria com qualquer frase que tenha " de "
    var curto = pt.replace(/\{\d+\}|[^A-Za-zÀ-ÿ]/g, '').length < 6;
    partes.forEach(function (p) {
      var ph = /^\{(\d+)\}$/.exec(p);
      if (ph) { ordem.push(+ph[1]); re += curto ? '([-+]?[\\d.,:%×x]*)' : '([\\s\\S]*?)'; } else { re += escapeRe(p); }
    });
    var citado = {};   // variáveis entre aspas no modelo ("{0}") são nomes: ficam como estão
    pt.replace(/["“'«]\{(\d+)\}["”'»]/g, function (_, k) { citado[k] = true; return _; });
    var item = { re: new RegExp('^' + re + '$'), ordem: ordem, tr: [m[1], m[2]], citado: citado };
    // a primeira palavra só serve de índice se for uma palavra inteira (sem variável grudada nela)
    var inicio = /^\s*(\S+)\s/.exec(pt.split(/\{\d+\}/)[0] + (/\{\d+\}/.test(pt) ? '' : ' '));
    var palavra = inicio ? inicio[1] : '';
    if (palavra) { (porPalavra[palavra] = porPalavra[palavra] || []).push(item); } else { comecaVariavel.push(item); }
  });
  function primeiraPalavra(s) { var m = /^\s*(\S+)/.exec(s); return m ? m[1] : ''; }

  var PT_FRASE = /[ãõçÃÕÇ]|(^|[^A-Za-zÀ-ÿ])(de|do|da|dos|das|em|para|com|que|não|uma|um|cada|seu|sua|seus|suas|os|no|na|nos|nas|você|camada|camadas)([^A-Za-zÀ-ÿ]|$)/i;
  // e-mail, endereço e site não são frase em português (".com" não é a palavra "com")
  function ehFrasePT(v) { return PT_FRASE.test(String(v).replace(/\S+@\S+|https?:\/\/\S+|\b[\w-]+(\.[\w-]+)+(\/\S*)?/g, ' ')); }
  function norm(s) { return String(s).replace(/\s+/g, ' ').replace(/^ | $/g, ''); }

  function exato(n) {
    var e = D.exato[n];
    return e ? e[IDX[idioma]] : null;
  }
  function porModelo(n, fundo) {
    var cands = (porPalavra[primeiraPalavra(n)] || []).concat(comecaVariavel);
    for (var i = 0; i < cands.length; i++) {
      var m = cands[i].re.exec(n);
      if (!m) { continue; }
      var alvo = cands[i].tr[IDX[idioma]];
      if (!alvo) { return null; }
      var grupos = {}, ruim = false;
      for (var g = 0; g < cands[i].ordem.length; g++) {
        var k0 = cands[i].ordem[g], v0 = m[g + 1], tv = fundo < 2 ? traduzirTrecho(v0, fundo + 1) : null;
        // pedaço variável que ainda é frase em português (e não um nome entre aspas): este modelo não serve
        if (tv == null && !cands[i].citado[k0] && ehFrasePT(v0)) { ruim = true; break; }
        grupos[k0] = tv == null ? v0 : tv;
      }
      if (ruim) { continue; }
      return alvo.replace(/\{(\d+)\}/g, function (_, k) { return grupos[k] === undefined ? '' : grupos[k]; });
    }
    return null;
  }
  // um pedaço (com os espaços em volta preservados)
  function traduzirTrecho(texto, fundo) {
    if (idioma === 'pt' || texto == null) { return null; }
    var s = String(texto);
    if (!/[A-Za-zÀ-ÿ]/.test(s)) { return null; }
    var antes = /^\s*/.exec(s)[0], depois = /\s*$/.exec(s)[0], n = norm(s);
    if (!n) { return null; }
    var r = exato(n);
    // pedaços inteiros primeiro (só vale se TODOS traduzem); depois os modelos com variáveis
    if (r == null && (fundo || 0) < 3) { var rp = porPartes(s, fundo || 0); if (rp != null) { return rp; } }
    if (r == null) { r = porModelo(n, fundo || 0); }
    // símbolo grudado na frente/atrás ("✓ Salvo", "Mais ▾", "📱 Pedido"): traduz o miolo
    if (r == null && (fundo || 0) < 3) {
      var mm = /^([^A-Za-zÀ-ÿ]*?)([A-Za-zÀ-ÿ][\s\S]*?)([^A-Za-zÀ-ÿ.!?)…"'»]*)$/.exec(n);
      if (mm && (mm[1] || mm[3])) { var miolo = traduzirTrecho(mm[2], (fundo || 0) + 1); if (miolo != null) { r = mm[1] + miolo.replace(/^\s+|\s+$/g, '') + mm[3]; } }
    }
    return r == null ? null : antes + r + depois;
  }
  // textos montados de pedaços (título + "\n" + dica, "Nome · descrição", "Rótulo: valor"...):
  // traduz pedaço por pedaço; só vale se nenhum pedaço com palavras ficar sem tradução
  var SEPARADORES = ['\n', ' — ', ' · ', '. '];
  function semPalavras(p) { return !/[A-Za-zÀ-ÿ]{2,}/.test(String(p).replace(/\S+@\S+\.\w+|https?:\/\/\S+|\b[\w-]+(\.[\w-]+)+(\/\S*)?/g, '')); }
  function porPartes(s, fundo) {
    for (var i = 0; i < SEPARADORES.length; i++) {
      var sep = SEPARADORES[i];
      if (s.indexOf(sep) < 0) { continue; }
      // ". " separa só o título do resto ("Nome. Descrição com várias frases.")
      var ps = sep === '. ' ? [s.slice(0, s.indexOf(sep)), s.slice(s.indexOf(sep) + 2)] : s.split(sep), ok = true, algum = false;
      for (var j = 0; j < ps.length; j++) {
        if (semPalavras(ps[j]) || /^\s*["“«].*["”»]\s*$/.test(ps[j])) { continue; }   // entre aspas = conteúdo da pessoa
        var alvo = ps[j];
        var tr = traduzirTrecho(alvo, fundo + 1);
        if (tr == null && j > 0 && sep.trim()) {   // modelos que começam com o separador ("· você tem {0}")
          var cs = traduzirTrecho(sep.replace(/^\s+/, '') + alvo, fundo + 1), pre = sep.replace(/^\s+/, '');
          if (cs != null && cs.indexOf(pre) === 0) { tr = cs.slice(pre.length); }
        }
        if (tr == null) { tr = rotuloValor(alvo, fundo + 1); }
        if (tr == null) { ok = false; break; }
        ps[j] = tr;
        algum = true;
      }
      if (ok && algum) { return ps.join(sep); }
    }
    // várias frases montadas ("Mensagem do servidor. Seus 200 créditos foram devolvidos."): frase a frase
    if (fundo < 2) { var rf = porFrases(s, fundo); if (rf != null) { return rf; } }
    // "frase (observação)" — ex.: "Efeito removido de 1 camada(s). (Ctrl+Z desfaz)"
    var pa = /^([\s\S]*\S)(\s+)(\([^()]*\))(\s*)$/.exec(s);
    if (pa) {
      var a1 = traduzirTrecho(pa[1], fundo + 1), a2 = traduzirTrecho(pa[3], fundo + 1);
      if (a1 != null && a2 != null) { return a1 + pa[2] + a2 + pa[4]; }
    }
    return rotuloValor(s, fundo + 1);
  }
  // corta nas pausas de frase (. ! ? seguidos de espaço) e junta o maior trecho que traduz de cada vez;
  // "1.5" e "máx. 5000" não atrapalham: se a frase cortada não traduz, tenta com a seguinte junto
  function porFrases(s, fundo) {
    var fr = [], ini = 0, i, j;
    for (i = 0; i < s.length; i++) {
      if ('.!?'.indexOf(s.charAt(i)) >= 0 && /\s/.test(s.charAt(i + 1))) {
        var fim = i + 1; while (fim < s.length && /\s/.test(s.charAt(fim))) { fim++; }
        fr.push(s.slice(ini, fim)); ini = fim; i = fim - 1;
      }
    }
    if (ini < s.length) { fr.push(s.slice(ini)); }
    if (fr.length < 2 || fr.length > 12) { return null; }
    var saida = '', algum = false;
    for (i = 0; i < fr.length;) {
      var achou = false;
      for (j = fr.length; j > i; j--) {
        if (i === 0 && j === fr.length) { continue; }   // o texto inteiro já foi tentado
        var cand = fr.slice(i, j).join(''), esp = /\s*$/.exec(cand)[0], tr = semPalavras(cand) ? null : traduzirTrecho(cand.replace(/\s+$/, ''), fundo + 1);
        if (tr != null) { saida += tr + esp; i = j; achou = algum = true; break; }
      }
      if (!achou) {
        if (!semPalavras(fr[i])) { return null; }
        saida += fr[i]; i++;
      }
    }
    return algum ? saida : null;
  }
  // "Duração: 0.5 s" → rótulo traduzido + o resto (traduzido se der)
  function rotuloValor(s, fundo) {
    var m = /^(\s*)([^:\n]{1,48}):(\s+)([\s\S]*)$/.exec(s);
    if (!m) { return null; }
    var rot = exato(norm(m[2]));
    if (rot == null) { return null; }
    var resto = semPalavras(m[4]) ? m[4] : traduzirTrecho(m[4], fundo + 1);
    if (resto == null) {
      if (ehFrasePT(m[4])) { return null; }   // o resto ainda é frase em português: não serve meia tradução
      resto = m[4];                           // nome/descrição (ex.: o que a IA escreveu): fica como está
    }
    return m[1] + rot + ':' + m[3] + resto;
  }
  function t(texto) {
    var r = traduzirTrecho(texto, 0);
    if (r == null && idioma !== 'pt' && window.__amFaltou) { try { window.__amFaltou(String(texto)); } catch (e) {} }   // só nos testes
    return r == null ? texto : r;
  }
  function tHost(texto) { return deHost(t(texto)); }

  // ---------- tela ----------
  var aplicando = false;
  function pular(no) {
    var el = no.nodeType === 1 ? no : no.parentNode;
    return !el || el.nodeType !== 1 || !!(el.closest && el.closest(PULAR));
  }
  function textoNo(no) {
    if (pular(no)) { return; }
    var atual = no.nodeValue;
    // a página mudou o texto depois da última tradução: o novo texto é o original
    if (no.__amPt === undefined || (atual !== no.__amTr && atual !== no.__amPt)) { no.__amPt = atual; }
    var alvo = deHost(idioma === 'pt' ? no.__amPt : t(no.__amPt));
    no.__amTr = alvo;
    if (atual !== alvo) { no.nodeValue = alvo; }
  }
  function atributosEl(el) {
    if (!el || el.nodeType !== 1 || (el.closest && el.closest(PULAR_ATRIB))) { return; }
    for (var i = 0; i < ATRIBUTOS.length; i++) {
      var a = ATRIBUTOS[i];
      if (!el.hasAttribute(a)) { continue; }
      var atual = el.getAttribute(a), mem = el.__amAt || (el.__amAt = {});
      if (!mem[a] || (atual !== mem[a].tr && atual !== mem[a].pt)) { mem[a] = { pt: atual }; }
      var alvo = deHost(idioma === 'pt' ? mem[a].pt : t(mem[a].pt));
      mem[a].tr = alvo;
      if (atual !== alvo) { el.setAttribute(a, alvo); }
    }
  }
  function percorrer(raiz) {
    if (!raiz) { return; }
    if (raiz.nodeType === 3) { textoNo(raiz); return; }
    if (raiz.nodeType !== 1 && raiz.nodeType !== 9 && raiz.nodeType !== 11) { return; }
    if (raiz.nodeType === 1) {
      atributosEl(raiz);
      if (raiz.closest && raiz.closest(PULAR)) { return; }
    }
    var w = document.createTreeWalker(raiz, 5, {
      acceptNode: function (n) {
        if (n.nodeType === 1 && n.matches && n.matches(PULAR)) { atributosEl(n); return 2; }   // 2 = REJECT: pula o conteúdo
        if (n.nodeType === 1) { return 1; }
        return 1;
      }
    }), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) { textoNo(n); } else { atributosEl(n); } }
  }
  function aplicarTudo() {
    aplicando = true;
    try { percorrer(document.body); } finally { aplicando = false; }
  }
  var obs = null, jaTraduziu = false;
  function vigiar() {
    if (obs || !window.MutationObserver || !document.body) { return; }
    obs = new MutationObserver(function (lista) {
      if (aplicando) { return; }
      aplicando = true;
      try {
        for (var i = 0; i < lista.length; i++) {
          var m = lista[i];
          if (m.type === 'childList') { for (var j = 0; j < m.addedNodes.length; j++) { percorrer(m.addedNodes[j]); } }
          else if (m.type === 'characterData') { textoNo(m.target); }
          else if (m.type === 'attributes') { atributosEl(m.target); }
        }
      } finally { aplicando = false; }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  }

  function definir(id) {
    idioma = id === 'en' || id === 'es' ? id : 'pt';
    if (!document.body) { document.addEventListener('DOMContentLoaded', function () { definir(idioma); }); return; }
    if (idioma !== 'pt' || jaTraduziu || PS) { aplicarTudo(); }
    if (idioma !== 'pt') { jaTraduziu = true; }
    // em português a tela fica exatamente como é escrita: só desfaz o que foi traduzido e para de vigiar
    // (no Photoshop continua vigiando, para trocar "After" por "Photoshop")
    if (idioma === 'pt' && !PS) { if (obs) { obs.disconnect(); obs = null; } return; }
    vigiar();
  }

  window.amI18n = { definir: definir, t: tHost, idioma: function () { return idioma; }, deHost: deHost, _dados: D };
})();
