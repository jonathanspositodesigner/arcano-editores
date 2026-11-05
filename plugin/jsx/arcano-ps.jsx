/* Arcano Design 1.2.32 - biblioteca ExtendScript do PHOTOSHOP (o painel do After usa jsx/arcano.jsx).
   ES3 de propósito (motor de script do Photoshop 2020 a 2026). Tudo fica em $.global.__am.
   Mesmos nomes do After onde o painel compartilha o fluxo (IA de imagem, anexos, internet, diagnóstico):
   camadaIA, camadaIAAlvo, exportarImagemIA, importarImagemIA, importarWeb, projetoAtual, projectInfo,
   exportarParaSeparar, montarCamadas (Separar em camadas), exportarParaUpscale, colocarUpscale (Upscale Arcano),
   testeEscrita, fontes, run. No Photoshop: "compId" = id do documento, "indice" = id da camada.
   Cada chamada roda com réguas em PIXELS, texto em PONTOS e sem diálogos; tudo volta como estava no fim. */
(function () {
  var am = {};
  am.v = '1.2.32';

  function cTID(s) { return charIDToTypeID(s); }
  function sTID(s) { return stringIDToTypeID(s); }

  // ---------- serializacao JSON (o ExtendScript nao tem JSON nativo) ----------
  function esc(s) {
    s = String(s);
    var out = '"', i, c, code, h;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      code = s.charCodeAt(i);
      if (c === '"') { out += '\\"'; }
      else if (c === '\\') { out += '\\\\'; }
      else if (c === '\n') { out += '\\n'; }
      else if (c === '\r') { out += '\\n'; }
      else if (c === '\t') { out += '\\t'; }
      else if (code < 32 || code === 0x2028 || code === 0x2029) {
        h = code.toString(16);
        while (h.length < 4) { h = '0' + h; }
        out += '\\u' + h;
      } else { out += c; }
    }
    return out + '"';
  }

  function ser(v, nivel) {
    var i, k, partes = [], simples = false, nome = '', classe = '';
    if (nivel === undefined) { nivel = 0; }
    if (v === null || v === undefined) { return 'null'; }
    if (typeof v === 'number') { return isFinite(v) ? String(v) : 'null'; }
    if (typeof v === 'boolean') { return v ? 'true' : 'false'; }
    if (typeof v === 'string') { return esc(v); }
    if (typeof v === 'function') { return 'null'; }
    if (nivel > 12) { return esc('[profundidade maxima]'); }
    try { if (v instanceof UnitValue) { return ser(Math.round(v.as('px') * 100) / 100, nivel); } } catch (eU) {}
    if (v instanceof Array) {
      for (i = 0; i < v.length; i++) { partes.push(ser(v[i], nivel + 1)); }
      return '[' + partes.join(',') + ']';
    }
    try { simples = (v.constructor === Object); } catch (e1) {}
    if (!simples) {
      try { classe = v.typename || v.reflect.name; } catch (e2) {}
      try { if (v.name !== undefined) { nome = ' "' + v.name + '"'; } } catch (e3) {}
      return esc('[' + (classe || 'objeto') + nome + ']');
    }
    for (k in v) {
      if (v.hasOwnProperty(k)) { partes.push(esc(k) + ':' + ser(v[k], nivel + 1)); }
    }
    return '{' + partes.join(',') + '}';
  }
  am.ser = ser;

  // ---------- unidades e diálogos: o mesmo ambiente em toda chamada ----------
  function comAmbiente(fn) {
    var reg = null, tipo = null, dlg = null, r;
    try { reg = app.preferences.rulerUnits; app.preferences.rulerUnits = Units.PIXELS; } catch (e1) {}
    try { tipo = app.preferences.typeUnits; app.preferences.typeUnits = TypeUnits.POINTS; } catch (e2) {}
    try { dlg = app.displayDialogs; app.displayDialogs = DialogModes.NO; } catch (e3) {}
    try { r = fn(); }
    finally {
      try { if (reg !== null) { app.preferences.rulerUnits = reg; } } catch (e4) {}
      try { if (tipo !== null) { app.preferences.typeUnits = tipo; } } catch (e5) {}
      try { if (dlg !== null) { app.displayDialogs = dlg; } } catch (e6) {}
    }
    return r;
  }

  // UM passo no Histórico (Ctrl+Z desfaz tudo). O suspendHistory roda um TEXTO no escopo global e não deixa o erro
  // sair com a mensagem original: a função e o erro passam por variáveis globais.
  function historico(rotulo, fn) {
    var doc = null;
    try { doc = app.activeDocument; } catch (e) { doc = null; }
    if (!doc || $.global.__amEmHistorico) { return fn(); }   // já dentro de um passo: não abre outro
    $.global.__amFn = fn; $.global.__amRes = undefined; $.global.__amErr = null; $.global.__amEmHistorico = true;
    try {
      doc.suspendHistory('Arcano Design: ' + String(rotulo || 'ação').replace(/["'\\\r\n]/g, ' ').slice(0, 60),
        'try { __amRes = __amFn(); } catch (e) { __amErr = e; }');
    } catch (eS) {
      if (!$.global.__amErr) { $.global.__amErr = eS; }
    }
    var erro = $.global.__amErr, res = $.global.__amRes;
    $.global.__amFn = null; $.global.__amRes = undefined; $.global.__amErr = null; $.global.__amEmHistorico = false;
    if (erro) { throw erro; }
    return res;
  }
  am.historico = historico;

  function px(u) {
    if (u === null || u === undefined) { return 0; }
    if (typeof u === 'number') { return u; }
    try { return u.as('px'); } catch (e) {}
    try { return Number(u.value); } catch (e2) {}
    return Number(u) || 0;
  }
  function arred(n) { return Math.round(n * 100) / 100; }

  // ---------- documento e camadas ----------
  function docAtivo() {
    var d = null;
    try { d = app.activeDocument; } catch (e) { d = null; }
    if (!d) { throw new Error('Nenhum documento aberto no Photoshop. Abra um PSD (ou crie um documento) primeiro.'); }
    return d;
  }
  am.doc = docAtivo;

  function docPorId(id) {
    var i;
    if (id === null || id === undefined || id === '') { return docAtivo(); }
    for (i = 0; i < app.documents.length; i++) {
      try { if (String(app.documents[i].id) === String(id)) { return app.documents[i]; } } catch (e) {}
    }
    for (i = 0; i < app.documents.length; i++) { if (app.documents[i].name === String(id)) { return app.documents[i]; } }
    throw new Error('O documento desta geração não está mais aberto no Photoshop.');
  }
  function ativar(doc) { try { if (idDe(app.activeDocument) !== idDe(doc)) { app.activeDocument = doc; } } catch (e) { app.activeDocument = doc; } }

  function idDe(l) { try { return l.id; } catch (e) { return null; } }
  function todas(container, saida) {
    var i, l;
    saida = saida || [];
    for (i = 0; i < container.layers.length; i++) {
      l = container.layers[i];
      saida.push(l);
      if (l.typename === 'LayerSet') { todas(l, saida); }
    }
    return saida;
  }
  am.todas = function () { return todas(docAtivo()); };

  // ref: id numérico (o "id" do ps_documento_info), "id:N" ou o nome exato. Vazio = a camada ativa.
  function camada(ref, doc) {
    doc = doc || docAtivo();
    var lista, i, idNum = null, s;
    if (ref === undefined || ref === null || ref === '') {
      try { return doc.activeLayer; } catch (e) { throw new Error('Nenhuma camada selecionada.'); }
    }
    if (typeof ref === 'object' && ref.typename) { return ref; }
    s = String(ref);
    if (/^(id:)?\d+$/.test(s)) { idNum = parseInt(s.replace('id:', ''), 10); }
    lista = todas(doc);
    var porId = null, porNome = null;
    if (idNum !== null) { for (i = 0; i < lista.length; i++) { if (idDe(lista[i]) === idNum) { porId = lista[i]; break; } } }
    for (i = 0; i < lista.length; i++) { if (lista[i].name === s) { porNome = lista[i]; break; } }
    // camada de texto se chama pelo conteúdo ("2025", "50"): número que é id de uma e nome de outra = ambíguo
    if (porId && porNome && idDe(porId) !== idDe(porNome) && typeof ref !== 'number' && !/^id:/.test(s)) {
      throw new Error('"' + s + '" é o id de "' + porId.name + '" e também o nome de outra camada. Use "id:' + s + '" para a do id ou o nome exato da outra.');
    }
    if (porId) { return porId; }
    if (porNome) { return porNome; }
    for (i = 0; i < lista.length; i++) { if (lista[i].name.toLowerCase() === s.toLowerCase()) { return lista[i]; } }
    throw new Error('Não achei a camada "' + s + '" no documento "' + doc.name + '". Use o id que o ps_documento_info mostra.');
  }
  am.camada = function (ref) { return camada(ref); };

  // seleciona sem ligar a camada escondida (o activeLayer do DOM liga a camada)
  function selecionar(l) {
    var id = idDe(l);
    if (id !== null) {
      try {
        var d = new ActionDescriptor(), r = new ActionReference();
        r.putIdentifier(cTID('Lyr '), id);
        d.putReference(cTID('null'), r);
        d.putBoolean(cTID('MkVs'), false);
        executeAction(cTID('slct'), d, DialogModes.NO);
        return l;
      } catch (e) {}
    }
    var vis = l.visible;
    app.activeDocument.activeLayer = l;
    try { if (l.visible !== vis) { l.visible = vis; } } catch (e3) {}
    return l;
  }
  am.selecionar = selecionar;

  // caixa da camada em px (com efeitos de camada); vazia = { l: 0, a: 0 }
  // sem a sombra/contorno dos estilos de camada (boundsNoEffects, Photoshop 2020+); reserva: bounds
  function caixa(l) {
    var b = null;
    try { b = l.boundsNoEffects; } catch (e) { b = null; }
    if (!b || !b.length) { b = l.bounds; }
    var x = px(b[0]), y = px(b[1]), x2 = px(b[2]), y2 = px(b[3]);
    return { x: arred(x), y: arred(y), x2: arred(x2), y2: arred(y2), l: arred(x2 - x), a: arred(y2 - y) };
  }
  am.caixa = caixa;
  // a parte da caixa que está dentro da tela
  function caixaNaTela(l, doc) {
    var c = caixa(l), W = px(doc.width), H = px(doc.height);
    var x = Math.max(0, c.x), y = Math.max(0, c.y), x2 = Math.min(W, c.x2), y2 = Math.min(H, c.y2);
    if (x2 - x < 1 || y2 - y < 1) { return null; }
    return { x: Math.round(x), y: Math.round(y), x2: Math.round(x2), y2: Math.round(y2), l: Math.round(x2) - Math.round(x), a: Math.round(y2) - Math.round(y) };
  }

  am.cor = function (hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')), c = new SolidColor();
    if (!m) { throw new Error('Cor inválida: "' + hex + '" (use #rrggbb).'); }
    c.rgb.hexValue = m[1].toUpperCase();
    return c;
  };
  am.mover = function (l, x, y) { var c = caixa(l); l.translate(new UnitValue(Number(x) - c.x, 'px'), new UnitValue(Number(y) - c.y, 'px')); return caixa(l); };
  // escala proporcional e centraliza na caixa (x, y, largura, altura). modo: cobrir | caber
  function encaixar(l, x, y, w, h, modo) {
    var c = caixa(l), k;
    if (c.l <= 0 || c.a <= 0) { return c; }
    k = (modo === 'caber') ? Math.min(w / c.l, h / c.a) : Math.max(w / c.l, h / c.a);
    if (Math.abs(k - 1) > 0.0005) { l.resize(k * 100, k * 100, AnchorPosition.MIDDLECENTER); }
    c = caixa(l);
    l.translate(new UnitValue((x + w / 2) - (c.x + c.l / 2), 'px'), new UnitValue((y + h / 2) - (c.y + c.a / 2), 'px'));
    return caixa(l);
  }
  am.encaixar = function (l, x, y, w, h, modo) { return encaixar(l, Number(x), Number(y), Number(w), Number(h), modo); };
  // exatamente na caixa (x, y, largura, altura): a proporção já vem certa do painel (PNG aparado), então escala
  // cada eixo pelo que falta — sem o "cobrir" que passaria um pouco da caixa quando o arredondamento difere
  function caixaExata(l, x, y, w, h) {
    var c = caixa(l);
    if (c.l <= 0 || c.a <= 0 || !(w > 0) || !(h > 0)) { return c; }
    var kx = w / c.l * 100, ky = h / c.a * 100;
    if (Math.abs(kx - 100) > 0.05 || Math.abs(ky - 100) > 0.05) { l.resize(kx, ky, AnchorPosition.TOPLEFT); }
    c = caixa(l);
    l.translate(new UnitValue(x - c.x, 'px'), new UnitValue(y - c.y, 'px'));
    return caixa(l);
  }
  am.cTID = cTID; am.sTID = sTID;
  $.global.cTID = cTID; $.global.sTID = sTID;

  var TIPOS = {};
  function tipoCamada(l) {
    if (l.typename === 'LayerSet') { return 'grupo'; }
    var k;
    try { k = l.kind; } catch (e) { return 'pixel'; }
    if (!TIPOS.ok) {
      TIPOS.ok = true;
      try {
        TIPOS[String(LayerKind.NORMAL)] = 'pixel'; TIPOS[String(LayerKind.TEXT)] = 'texto'; TIPOS[String(LayerKind.SMARTOBJECT)] = 'smart';
        TIPOS[String(LayerKind.SOLIDFILL)] = 'preenchimento'; TIPOS[String(LayerKind.GRADIENTFILL)] = 'preenchimento'; TIPOS[String(LayerKind.PATTERNFILL)] = 'preenchimento';
        TIPOS[String(LayerKind.VIDEO)] = 'video'; TIPOS[String(LayerKind.LAYER3D)] = '3d';
      } catch (e2) {}
    }
    return TIPOS[String(k)] || 'ajuste';
  }
  function temImagem(l) { var t = tipoCamada(l); return t === 'pixel' || t === 'smart' || t === 'grupo' || t === 'preenchimento'; }
  function nomeEnum(v) { return String(v).replace(/^[A-Za-z]+\./, '').toLowerCase(); }

  // estilos misturados e escala da camada de texto (o DOM não mostra): Action Manager pelo id
  function textoAM(l) {
    var o = { estilos: 1, escala: 1 };
    try {
      var r = new ActionReference();
      r.putIdentifier(cTID('Lyr '), idDe(l));
      var tk = executeActionGet(r).getObjectValue(sTID('textKey'));
      try {
        var lista = tk.getList(sTID('textStyleRange')), vistos = {}, n = 0, j;
        for (j = 0; j < lista.count; j++) {
          var ts = lista.getObjectValue(j).getObjectValue(sTID('textStyle')), chave = '';
          try { chave += ts.getString(sTID('fontPostScriptName')); } catch (e1) {}
          try { chave += '|' + ts.getUnitDoubleValue(sTID('size')); } catch (e2) { try { chave += '|' + ts.getDouble(sTID('size')); } catch (e2b) {} }
          try { var c = ts.getObjectValue(sTID('color')); chave += '|' + Math.round(c.getDouble(sTID('red'))) + ',' + Math.round(c.getDouble(sTID('grain'))) + ',' + Math.round(c.getDouble(sTID('blue'))); } catch (e3) {}
          if (!vistos[chave]) { vistos[chave] = true; n++; }
        }
        o.estilos = Math.max(1, n);
      } catch (e4) {}
      try {
        if (tk.hasKey(sTID('transform'))) {
          var t = tk.getObjectValue(sTID('transform')), yx = t.getDouble(sTID('yx')), yy = t.getDouble(sTID('yy'));
          var k = Math.sqrt(yx * yx + yy * yy);
          if (k > 0.001) { o.escala = k; }
        }
      } catch (e5) {}
    } catch (e) {}
    return o;
  }

  function infoTexto(l) {
    var t = l.textItem, o = {};
    try { o.conteudo = String(t.contents).replace(/\r/g, '\n'); if (o.conteudo.length > 400) { o.conteudo = o.conteudo.slice(0, 400) + '…'; } } catch (e1) {}
    try { o.fonte = t.font; } catch (e2) {}
    var am2 = textoAM(l);
    try { o.tamanho = arred((t.size.as ? t.size.as('pt') : Number(t.size)) * am2.escala); } catch (e3) {}
    if (am2.estilos > 1) { o.estilos = am2.estilos; }
    try { o.cor = '#' + t.color.rgb.hexValue.toLowerCase(); } catch (e4) {}
    try { if (t.kind === TextType.PARAGRAPHTEXT) { o.paragrafo = true; } } catch (e5) {}
    return o;
  }

  function infoCamada(l, nivel, max, cont) {
    cont.n++;
    var o = { id: idDe(l), nome: l.name, tipo: tipoCamada(l) }, c;
    try { if (!l.visible) { o.visivel = false; } } catch (e1) {}
    try { if (l.opacity < 100) { o.opacidade = Math.round(l.opacity); } } catch (e2) {}
    try { var bm = nomeEnum(l.blendMode); if (bm !== 'normal' && bm !== 'passthrough') { o.mescla = bm; } } catch (e3) {}
    try { if (l.typename === 'ArtLayer' && l.grouped) { o.clip = true; } } catch (e4) {}
    try { if (l.allLocked) { o.bloqueada = true; } else if (l.typename === 'ArtLayer' && l.positionLocked) { o.bloqueada = 'posicao'; } } catch (e5) {}
    try { if (l.typename === 'ArtLayer' && l.isBackgroundLayer) { o.fundo = true; } } catch (e6) {}
    try { c = caixa(l); o.caixa = { x: Math.round(c.x), y: Math.round(c.y), l: Math.round(c.l), a: Math.round(c.a) }; } catch (e7) {}
    if (o.tipo === 'texto') { o.texto = infoTexto(l); }
    if (l.typename === 'LayerSet') {
      o.qtd = l.layers.length;
      if (nivel < max && cont.n < 500) {
        o.filhas = [];
        for (var i = 0; i < l.layers.length && cont.n < 500; i++) { o.filhas.push(infoCamada(l.layers[i], nivel + 1, max, cont)); }
      }
    }
    return o;
  }

  function caminhoDoc(d) { try { return d.fullName.fsName; } catch (e) { return null; } }

  am.documentoInfo = function (profundidade, grupoRef) {
    var d = docAtivo(), docs = [], i, cont = { n: 0 }, max = Math.max(0, Math.min(12, Number(profundidade) || 6)), raiz = d, camadas = [];
    for (i = 0; i < app.documents.length; i++) { docs.push({ nome: app.documents[i].name, id: idDe(app.documents[i]), ativo: idDe(app.documents[i]) === idDe(d) }); }
    if (grupoRef) { raiz = camada(grupoRef, d); if (raiz.typename !== 'LayerSet') { return { camada: infoCamada(raiz, 0, max, cont) }; } }
    for (i = 0; i < raiz.layers.length && cont.n < 500; i++) { camadas.push(infoCamada(raiz.layers[i], 0, max, cont)); }
    var r = {
      documentos: docs,
      ativo: { nome: d.name, id: idDe(d), arquivo: caminhoDoc(d), largura: Math.round(px(d.width)), altura: Math.round(px(d.height)), resolucao: Math.round(Number(d.resolution) || 72), modo: nomeEnum(d.mode), bits: nomeEnum(d.bitsPerChannel), salvo: (function () { try { return d.saved; } catch (e) { return null; } })() },
      selecionada: (function () { try { return { id: idDe(d.activeLayer), nome: d.activeLayer.name }; } catch (e) { return null; } })(),
      camadas: camadas,
      ordem: 'de cima para baixo'
    };
    if (cont.n >= 500) { r.aviso = 'Documento com muitas camadas: mostrei as primeiras 500. Use o parâmetro grupo para ver um grupo.'; }
    if (grupoRef) { r.grupo = { id: idDe(raiz), nome: raiz.name }; }
    return r;
  };

  // ---------- executar código da IA (1 passo no Histórico) ----------
  am.run = function (codigo, rotulo) {
    var fn = eval('(function () {\n' + codigo + '\n})');
    var r = historico(rotulo || 'ação', fn);
    return { resultado: (r === undefined ? null : r) };
  };

  // ---------- prévias e exportação ----------
  function paraRGB8(d) {
    try { if (d.mode !== DocumentMode.RGB) { d.changeMode(ChangeMode.RGB); } }
    catch (e) { try { d.changeMode(ChangeMode.GRAYSCALE); d.changeMode(ChangeMode.RGB); } catch (e2) {} }
    try { if (d.bitsPerChannel !== BitsPerChannelType.EIGHT) { d.bitsPerChannel = BitsPerChannelType.EIGHT; } } catch (e3) {}
  }
  function reduzir(d, lado) {
    var w = px(d.width), h = px(d.height), k;
    if (!lado || Math.max(w, h) <= lado) { return; }
    k = lado / Math.max(w, h);
    d.resizeImage(new UnitValue(Math.max(1, Math.round(w * k)), 'px'), new UnitValue(Math.max(1, Math.round(h * k)), 'px'), undefined, ResampleMethod.BICUBIC);
  }
  function salvarJPG(d, caminho, qualidade) {
    var o = new JPEGSaveOptions();
    o.quality = qualidade || 10; o.embedColorProfile = true; o.formatOptions = FormatOptions.STANDARDBASELINE; o.matte = MatteType.WHITE;
    d.saveAs(new File(caminho), o, true, Extension.LOWERCASE);
  }
  function salvarPNG(d, caminho) {
    var o = new PNGSaveOptions();
    try { o.compression = 6; } catch (e) {}
    o.interlaced = false;
    d.saveAs(new File(caminho), o, true, Extension.LOWERCASE);
  }
  function fechar(d) { try { d.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {} }

  // cópia achatada do que está visível (o original não é tocado)
  function copiaAchatada(doc, nome) {
    ativar(doc);
    var dup = doc.duplicate(nome || '__arcano_copia', true);
    ativar(dup);
    return dup;
  }

  // documento novo só com a camada (mesmo tamanho, modo e bits), recortado na caixa dela dentro da tela
  function copiaDaCamada(doc, l) {
    var cx = caixaNaTela(l, doc);
    if (!cx) { throw new Error('A camada "' + l.name + '" está vazia ou fora da tela.'); }
    ativar(doc);
    selecionar(l);
    var novo = null;
    try {
      var d = new ActionDescriptor(), r = new ActionReference(), r2 = new ActionReference();
      r.putClass(cTID('Dcmn')); d.putReference(cTID('null'), r);
      d.putString(cTID('Nm  '), '__arcano_camada');
      r2.putEnumerated(cTID('Lyr '), cTID('Ordn'), cTID('Trgt')); d.putReference(cTID('Usng'), r2);
      d.putInteger(cTID('Vrsn'), 5);
      executeAction(cTID('Mk  '), d, DialogModes.NO);
      novo = app.activeDocument;
      if (idDe(novo) === idDe(doc)) { novo = null; }
    } catch (e) { novo = null; }
    if (!novo) {
      novo = app.documents.add(doc.width, doc.height, doc.resolution, '__arcano_camada', NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
      ativar(doc);
      l.duplicate(novo, ElementPlacement.PLACEATBEGINNING);
      ativar(novo);
      while (novo.layers.length > 1) { novo.layers[novo.layers.length - 1].remove(); }
    }
    ativar(novo);
    try { for (var i = 0; i < novo.layers.length; i++) { novo.layers[i].visible = true; } } catch (e2) {}
    try { if (novo.layers[0].typename === 'ArtLayer' && novo.layers[0].grouped) { novo.layers[0].grouped = false; } } catch (e3) {}
    novo.crop([new UnitValue(cx.x, 'px'), new UnitValue(cx.y, 'px'), new UnitValue(cx.x2, 'px'), new UnitValue(cx.y2, 'px')]);
    return { doc: novo, caixa: cx };
  }

  // prévia para a IA ver (ps_ver). camRef vazio = o documento inteiro em JPG; com camada = PNG só dela
  am.previa = function (camRef, lado, caminho) {
    var doc = docAtivo(), f = new File(caminho), tmp = null, info;
    if (f.exists) { f.remove(); }
    try {
      if (camRef) {
        var l = camada(camRef, doc), c = copiaDaCamada(doc, l);
        tmp = c.doc;
        paraRGB8(tmp); reduzir(tmp, lado); salvarPNG(tmp, caminho);
        info = { documento: doc.name, camada: l.name, id: idDe(l), tipo: tipoCamada(l), caixa: { x: c.caixa.x, y: c.caixa.y, l: c.caixa.l, a: c.caixa.a }, visivel: l.visible, previa: Math.round(px(tmp.width)) + 'x' + Math.round(px(tmp.height)) };
      } else {
        tmp = copiaAchatada(doc, '__arcano_previa');
        try { tmp.flatten(); } catch (eF) {}
        paraRGB8(tmp); reduzir(tmp, lado); salvarJPG(tmp, caminho, 9);
        info = { documento: doc.name, largura: Math.round(px(doc.width)), altura: Math.round(px(doc.height)), previa: Math.round(px(tmp.width)) + 'x' + Math.round(px(tmp.height)) };
      }
    } finally {
      if (tmp) { fechar(tmp); }
      ativar(doc);
    }
    return info;
  };

  function semExtensao(n) { return String(n || '').replace(/\.[^.]+$/, ''); }
  function nomeSeguro(n) { return String(n || 'arte').replace(/[\\\/:*?"<>|\r\n]+/g, '_').replace(/^\s+|\s+$/g, '').slice(0, 80) || 'arte'; }
  function carimbo() { var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds()); }
  function pastaPara(doc, pastaPadrao, sub) {
    var base = null, p;
    try { base = doc.fullName.parent.fsName + '/Arcano Design'; } catch (e) { base = null; }
    if (!base) { base = pastaPadrao || (Folder.myDocuments.fsName + '/Arcano Design'); }
    p = new Folder(base + (sub ? '/' + sub : ''));
    if (!p.exists) { p.create(); }
    return p;
  }
  function arquivoLivre(pasta, nome, ext) {
    var f = new File(pasta.fsName + '/' + nome + '.' + ext), n = 1;
    while (f.exists) { n++; f = new File(pasta.fsName + '/' + nome + ' (' + n + ').' + ext); }
    return f;
  }

  am.exportar = function (formato, nome, largura, pastaPadrao) {
    var doc = docAtivo(), fmt = /^(png|psd)$/i.test(formato) ? String(formato).toLowerCase() : 'jpg';
    var pasta = pastaPara(doc, pastaPadrao, 'Exportados'), f = arquivoLivre(pasta, nomeSeguro(nome || semExtensao(doc.name)), fmt), tmp = null, w, h;
    if (fmt === 'psd') {
      var o = new PhotoshopSaveOptions(); o.layers = true; o.embedColorProfile = true;
      doc.saveAs(f, o, true, Extension.LOWERCASE);
      return { arquivo: f.fsName, formato: 'psd', largura: Math.round(px(doc.width)), altura: Math.round(px(doc.height)) };
    }
    try {
      tmp = copiaAchatada(doc, '__arcano_exportar');
      if (fmt === 'jpg') { try { tmp.flatten(); } catch (eF) {} }
      paraRGB8(tmp);
      if (Number(largura) > 0 && Math.abs(Number(largura) - px(tmp.width)) >= 1) {
        var k = Number(largura) / px(tmp.width);
        tmp.resizeImage(new UnitValue(Math.round(Number(largura)), 'px'), new UnitValue(Math.max(1, Math.round(px(tmp.height) * k)), 'px'), undefined, ResampleMethod.BICUBIC);
      }
      w = Math.round(px(tmp.width)); h = Math.round(px(tmp.height));
      if (fmt === 'jpg') { salvarJPG(tmp, f.fsName, 11); } else { salvarPNG(tmp, f.fsName); }
    } finally {
      if (tmp) { fechar(tmp); }
      ativar(doc);
    }
    return { arquivo: f.fsName, formato: fmt, largura: w, altura: h };
  };

  am.salvar = function (nome, pastaPadrao) {
    var doc = docAtivo(), caminho = caminhoDoc(doc);
    if (caminho && /\.(psd|psb)$/i.test(caminho)) { doc.save(); return { arquivo: caminho, salvo: true }; }
    var pasta = new Folder(pastaPadrao || (Folder.myDocuments.fsName + '/Arcano Design'));
    if (!pasta.exists) { pasta.create(); }
    var f = arquivoLivre(pasta, nomeSeguro(nome || semExtensao(doc.name)), 'psd'), o = new PhotoshopSaveOptions();
    o.layers = true; o.embedColorProfile = true;
    doc.saveAs(f, o, false, Extension.LOWERCASE);
    return { arquivo: f.fsName, salvo: true, novo: true };
  };

  // ---------- fontes ----------
  function listaFontes() {
    var c = $.global.__amFontesCache;
    if (c && (new Date().getTime()) - c.em < 300000) { return c; }
    var fams = {}, nomes = [], ps = {}, i, f, fam, n = app.fonts.length;
    for (i = 0; i < n; i++) {
      f = app.fonts[i];
      try { fam = String(f.family); } catch (e) { continue; }
      if (!fams[fam]) { fams[fam] = []; nomes.push(fam); }
      var p = '', est = '';
      try { p = String(f.postScriptName); est = String(f.style); } catch (e2) {}
      fams[fam].push(est + ' = ' + p);
      if (p) { ps[p] = true; }
    }
    nomes.sort();
    c = { em: new Date().getTime(), fams: fams, nomes: nomes, ps: ps };
    $.global.__amFontesCache = c;
    return c;
  }
  function fontesDoDocumento(doc) {
    var lista = todas(doc), usadas = {}, out = [], i;
    for (i = 0; i < lista.length && i < 800; i++) {
      if (tipoCamada(lista[i]) !== 'texto') { continue; }
      try { var fn = lista[i].textItem.font; if (fn && !usadas[fn]) { usadas[fn] = true; out.push(fn); } } catch (e) {}
    }
    return out;
  }
  am.fontes = function (familia) {
    var c = listaFontes(), alvo = familia ? String(familia).toLowerCase() : '', r = {}, i, doc = null;
    if (!alvo) { r.total = c.nomes.length; r.familias = c.nomes; }
    else {
      r.busca = familia; r.familias = [];
      for (i = 0; i < c.nomes.length; i++) { if (c.nomes[i].toLowerCase().indexOf(alvo) >= 0) { r.familias.push({ familia: c.nomes[i], estilos: c.fams[c.nomes[i]] }); } }
    }
    try { doc = app.activeDocument; } catch (e) { doc = null; }
    if (doc) {
      var usadas = fontesDoDocumento(doc), falta = [];
      for (i = 0; i < usadas.length; i++) { if (!c.ps[usadas[i]]) { falta.push(usadas[i]); } }
      r.documento = { usadas: usadas, faltando: falta };
    }
    return r;
  };

  // ---------- texto ----------
  am.trocarTexto = function (ref, texto, op) {
    op = op || {};
    var doc = docAtivo(), l = camada(ref, doc);
    if (tipoCamada(l) !== 'texto') { throw new Error('A camada "' + l.name + '" não é de texto (é ' + tipoCamada(l) + ').'); }
    if (op.fonte) {
      var c = listaFontes();
      if (!c.ps[op.fonte]) { throw new Error('A fonte "' + op.fonte + '" não está instalada (use o nome PostScript que o ps_fontes mostra).'); }
    }
    var cor = op.cor ? am.cor(op.cor) : null, am2 = textoAM(l);
    if (am2.estilos > 1 && !op.estiloUnico) {
      throw new Error('A camada "' + l.name + '" tem ' + am2.estilos + ' estilos misturados (cores/fontes/tamanhos). Trocar o texto deixaria tudo com o estilo do primeiro caractere. Separe em camadas com ps_run_jsx, ou chame de novo com estilo_unico true se ficar com um estilo só.');
    }
    return historico('texto "' + l.name + '"', function () {
      var t = l.textItem;
      t.contents = String(texto).replace(/\r\n|\n/g, '\r');
      if (op.fonte) { t.font = op.fonte; }
      // tamanho pedido = o que aparece na tela; a camada pode estar escalada (transformação livre)
      if (op.tamanho > 0) { t.size = new UnitValue(Number(op.tamanho) / am2.escala, 'pt'); }
      if (cor) { t.color = cor; }
      if (op.caixaAlta) { try { t.capitalization = TextCase.ALLCAPS; } catch (e) {} }
      var cx = caixa(l), info = infoTexto(l);
      return { id: idDe(l), nome: l.name, texto: info.conteudo, fonte: info.fonte, tamanho: info.tamanho, cor: info.cor, caixa: { x: Math.round(cx.x), y: Math.round(cx.y), l: Math.round(cx.l), a: Math.round(cx.a) } };
    });
  };

  // ---------- imagens ----------
  function colocarArquivo(arquivo) {
    var f = new File(arquivo);
    if (!f.exists) { throw new Error('Arquivo não encontrado: ' + arquivo); }
    var d = new ActionDescriptor();
    d.putPath(cTID('null'), f);
    d.putEnumerated(cTID('FTcs'), cTID('QCSt'), cTID('Qcsa'));
    var o = new ActionDescriptor();
    o.putUnitDouble(cTID('Hrzn'), cTID('#Pxl'), 0); o.putUnitDouble(cTID('Vrtc'), cTID('#Pxl'), 0);
    d.putObject(cTID('Ofst'), cTID('Ofst'), o);
    executeAction(cTID('Plc '), d, DialogModes.NO);
    return app.activeDocument.activeLayer;
  }
  // máscara de camada mostrando só a caixa (a imagem nova não vaza para fora do lugar da antiga)
  function mascararNaCaixa(doc, l, cx) {
    selecionar(l);
    doc.selection.select([[cx.x, cx.y], [cx.x2, cx.y], [cx.x2, cx.y2], [cx.x, cx.y2]]);
    try {
      var d = new ActionDescriptor(), r = new ActionReference();
      d.putClass(cTID('Nw  '), cTID('Chnl'));
      r.putEnumerated(cTID('Chnl'), cTID('Chnl'), cTID('Msk '));
      d.putReference(cTID('At  '), r);
      d.putEnumerated(cTID('Usng'), cTID('UsrM'), cTID('RvlS'));
      executeAction(cTID('Mk  '), d, DialogModes.NO);
    } finally { try { doc.selection.deselect(); } catch (e) {} }
  }
  function nomeDoArquivo(arquivo) { return semExtensao(decodeURI(new File(arquivo).name)); }

  // modo: substituir | acima | recorte | conteudo | novo ; ajuste: cobrir | caber
  function colocar(doc, arquivo, alvo, modo, ajuste, nome) {
    var cx, l, W = px(doc.width), H = px(doc.height);
    if (modo === 'conteudo') {
      if (!alvo || tipoCamada(alvo) !== 'smart') { throw new Error('O modo "conteudo" só funciona numa camada Smart Object.'); }
      selecionar(alvo);
      var d = new ActionDescriptor();
      d.putPath(cTID('null'), new File(arquivo));
      executeAction(sTID('placedLayerReplaceContents'), d, DialogModes.NO);
      l = doc.activeLayer;
      cx = caixa(l);
      return { camada: l.name, id: idDe(l), modo: modo, caixa: { x: Math.round(cx.x), y: Math.round(cx.y), l: Math.round(cx.l), a: Math.round(cx.a) } };
    }
    if (alvo && modo === 'recorte') {
      var fundoA = false; try { fundoA = alvo.isBackgroundLayer; } catch (eB) {}
      if (fundoA || alvo.typename === 'LayerSet') { throw new Error('Não dá para recortar dentro de "' + alvo.name + '" (é ' + (fundoA ? 'o Fundo travado' : 'um grupo') + '). Use o modo "substituir" ou mire a forma/foto da moldura.'); }
    }
    if (alvo && modo !== 'novo') {
      cx = caixaNaTela(alvo, doc);
      if (!cx) { throw new Error('A camada alvo "' + alvo.name + '" está vazia ou fora da tela.'); }
      selecionar(alvo);
    } else {
      cx = { x: 0, y: 0, x2: W, y2: H, l: W, a: H };
      try { selecionar(doc.layers[0]); } catch (e0) {}
    }
    l = colocarArquivo(arquivo);
    if (alvo && modo !== 'novo') { try { l.move(alvo, ElementPlacement.PLACEBEFORE); } catch (eM) {} }
    else { try { l.move(doc, ElementPlacement.PLACEATBEGINNING); } catch (eM2) {} }
    encaixar(l, cx.x, cx.y, cx.l, cx.a, ajuste === 'caber' ? 'caber' : 'cobrir');
    if (modo === 'recorte' && alvo) { l.grouped = true; }
    else {
      // acima de uma camada que já está recortada (dentro de uma moldura): continua recortada junto
      var alvoRecortado = false; try { alvoRecortado = alvo && alvo.typename === 'ArtLayer' && alvo.grouped; } catch (eR) {}
      if (alvoRecortado && modo !== 'novo') { try { l.grouped = true; } catch (eG) {} }
      if (alvo && modo !== 'novo' && ajuste !== 'caber') { try { mascararNaCaixa(doc, l, cx); } catch (eK) {} }
    }
    if (modo === 'substituir' && alvo) { try { alvo.visible = false; } catch (eV) {} }
    l.name = nome || ('Arcano · ' + nomeDoArquivo(arquivo));
    var c2 = caixa(l);
    return { camada: l.name, id: idDe(l), modo: modo, original: alvo ? alvo.name : null, originalDesligada: modo === 'substituir' && !!alvo, caixa: { x: Math.round(c2.x), y: Math.round(c2.y), l: Math.round(c2.l), a: Math.round(c2.a) } };
  }

  am.colocarImagem = function (arquivo, ref, modo, ajuste, nome) {
    var doc = docAtivo();
    modo = /^(substituir|acima|recorte|conteudo|novo)$/.test(modo) ? modo : 'substituir';
    var alvo = ref ? camada(ref, doc) : null;
    if (!alvo && (modo === 'conteudo' || modo === 'recorte')) { throw new Error('Diga qual camada (id ou nome) para o modo "' + modo + '".'); }
    return historico('imagem ' + nomeDoArquivo(arquivo), function () { return colocar(doc, arquivo, alvo, alvo ? modo : 'novo', ajuste, nome); });
  };

  am.abrirArquivo = function (caminho) {
    var f = new File(caminho);
    if (!f.exists) { throw new Error('Arquivo não encontrado: ' + caminho); }
    var d = app.open(f), r = { documento: d.name, id: idDe(d), largura: Math.round(px(d.width)), altura: Math.round(px(d.height)), camadas: 0 };
    try { r.camadas = todas(d).length; } catch (e) {}
    try {
      var c = listaFontes(), usadas = fontesDoDocumento(d), falta = [], i;
      for (i = 0; i < usadas.length; i++) { if (!c.ps[usadas[i]]) { falta.push(usadas[i]); } }
      r.fontesFaltando = falta;
    } catch (e2) {}
    return r;
  };

  // ---------- IA de imagem (mesmo fluxo do After: o painel sobe a imagem e coloca o resultado) ----------
  function infoIA(doc, l) {
    var info = { comp: doc.name, compId: idDe(doc), largura: Math.round(px(doc.width)), altura: Math.round(px(doc.height)), tempo: 0, duracao: 0, projeto: caminhoDoc(doc), camada: null };
    if (l) {
      var cx = null;
      try { cx = caixaNaTela(l, doc); } catch (e) {}
      info.camada = { indice: idDe(l), nome: l.name, tipo: tipoCamada(l), temFonte: temImagem(l) && !!cx, arquivo: null, largura: cx ? cx.l : 0, altura: cx ? cx.a : 0 };
    }
    return info;
  }
  am.camadaIA = function () {
    var doc = docAtivo(), l = null;
    try { l = doc.activeLayer; } catch (e) { l = null; }
    return infoIA(doc, l);
  };
  am.camadaIAAlvo = function (docRef, camRef) {
    var doc = docRef ? docPorId(docRef) : docAtivo(), l = null;
    if (camRef !== undefined && camRef !== null && camRef !== '') { l = camada(camRef, doc); }
    else { try { l = doc.activeLayer; } catch (e) { l = null; } }
    return infoIA(doc, l);
  };
  // modo 'camada': só a camada, recortada na caixa dela; 'frame': a arte inteira (o que está visível)
  am.exportarImagemIA = function (docId, layerId, modo, caminho) {
    var doc = docPorId(docId), atual = null, tmp = null, f = new File(caminho), w, h;
    try { atual = app.activeDocument; } catch (e0) {}
    if (f.exists) { f.remove(); }
    try {
      if (modo === 'frame') { tmp = copiaAchatada(doc, '__arcano_ia'); }
      else {
        var l = camada(layerId, doc);
        if (!temImagem(l)) { throw new Error('A camada "' + l.name + '" não tem imagem própria (texto ou ajuste). Use origem "documento".'); }
        tmp = copiaDaCamada(doc, l).doc;
      }
      paraRGB8(tmp); reduzir(tmp, 2560); salvarPNG(tmp, caminho);
      w = Math.round(px(tmp.width)); h = Math.round(px(tmp.height));
    } finally {
      if (tmp) { fechar(tmp); }
      try { ativar(atual || doc); } catch (e1) {}
    }
    return { tmpId: null, largura: w, altura: h };
  };
  am.removerTempIA = function () { return true; };

  // ---------- Biblioteca do Arcano Design (aba Biblioteca): o asset baixado do Drive ----------
  // imagem/PSD/vetor: Smart Object no documento ativo, cabendo nele (sem documento: abre o arquivo);
  // pincel, padrão, estilo, gradiente, ação, amostras e formas: carrega no Photoshop (app.load)
  // Imagem da pasta BRUSHES vira pincel: a forma é a parte não transparente (ou o escuro, se a imagem não tem
  // transparência), em preto sobre branco, como o "Definir predefinição de pincel" (Editar) faz. Máx. 2500 px.
  function definirPincelDeImagem(f, nome) {
    var antes = null; try { antes = app.activeDocument; } catch (e0) {}
    var d = app.open(f), preto = new SolidColor(), branco = new SolidColor();
    preto.rgb.red = 0; preto.rgb.green = 0; preto.rgb.blue = 0; branco.rgb.red = 255; branco.rgb.green = 255; branco.rgb.blue = 255;
    try {
      if (d.mode !== DocumentMode.RGB) { d.changeMode(ChangeMode.RGB); }
      var lado = Math.max(px(d.width), px(d.height));
      if (lado > 2500) { d.resizeImage(UnitValue(px(d.width) * 2500 / lado, 'px'), UnitValue(px(d.height) * 2500 / lado, 'px'), null, ResampleMethod.BICUBIC); }
      var l = d.activeLayer;
      if (!l.isBackgroundLayer) {
        // forma = a transparência da camada, pintada de preto
        d.activeLayer = l;
        selecionarTransparencia();
        var forma = d.artLayers.add();
        d.selection.fill(preto);
        d.selection.deselect();
        l.visible = false;
        var fundo = d.artLayers.add();
        fundo.move(forma, ElementPlacement.PLACEAFTER);
        d.activeLayer = fundo; d.selection.selectAll(); d.selection.fill(branco); d.selection.deselect();
        l.remove();
      }
      d.flatten();
      d.selection.selectAll();
      var desc = new ActionDescriptor(), ref = new ActionReference(), usar = new ActionReference();
      ref.putClass(cTID('Brsh')); desc.putReference(cTID('null'), ref);
      desc.putString(cTID('Nm  '), nome);
      usar.putProperty(cTID('Prpr'), sTID('selection')); usar.putEnumerated(cTID('Dcmn'), cTID('Ordn'), cTID('Trgt'));
      desc.putReference(cTID('Usng'), usar);
      executeAction(cTID('Mk  '), desc, DialogModes.NO);
    } finally {
      try { d.close(SaveOptions.DONOTSAVECHANGES); } catch (eC) {}
      try { if (antes) { app.activeDocument = antes; } } catch (eA) {}
    }
    return { tipo: 'pincel', nome: nome };
  }
  am.usarBibliotecaPS = function (caminho, nome, pincel) {
    var f = new File(caminho);
    if (!f.exists) { throw new Error('Arquivo não encontrado: ' + caminho); }
    var ext = String((/\.([a-z0-9]+)$/i.exec(caminho) || ['', ''])[1]).toLowerCase();
    if (/^(abr|pat|asl|grd|atn|aco|csh)$/.test(ext)) { app.load(f); return { tipo: 'preset', ext: ext }; }
    if (pincel && /^(png|jpe?g|webp|psd)$/.test(ext)) { return definirPincelDeImagem(f, nome || nomeDoArquivo(caminho)); }
    var doc = null;
    try { doc = app.activeDocument; } catch (e) { doc = null; }
    if (!doc) { var d = app.open(f); return { tipo: 'aberto', documento: d.name }; }
    return historico('biblioteca ' + nome, function () {
      var r = colocar(doc, caminho, null, 'novo', 'caber', nome || nomeDoArquivo(caminho));
      r.tipo = 'colocado';
      return r;
    });
  };

  // ---------- Upscale Arcano (aba Efeitos) ----------
  // carrega como seleção a transparência da camada ATIVA (o Ctrl+clique na miniatura)
  function selecionarTransparencia() {
    var d = new ActionDescriptor(), r = new ActionReference(), r2 = new ActionReference();
    r.putProperty(cTID('Chnl'), cTID('fsel')); d.putReference(cTID('null'), r);
    r2.putEnumerated(cTID('Chnl'), cTID('Chnl'), cTID('Trsp')); d.putReference(cTID('T   '), r2);
    executeAction(cTID('setd'), d, DialogModes.NO);
  }
  // A camada sozinha, achatada no branco, em JPG com o lado maior de até `lado` px (o mesmo que o site manda: Upscaler
  // 1024, Cloner / Veste AI / Pose Changer 1536, sempre JPEG).
  // transparente = a camada tem recorte (selo, logo, pessoa sem fundo): o resultado ganha a mesma máscara.
  am.exportarParaUpscale = function (docId, layerId, caminho, lado) {
    var doc = docPorId(docId), atual = null, tmp = null, f = new File(caminho), w, h, l, transparente = false;
    try { atual = app.activeDocument; } catch (e0) {}
    if (f.exists) { f.remove(); }
    try {
      l = camada(layerId, doc);
      if (!temImagem(l)) { throw new Error('A camada "' + l.name + '" não tem imagem (texto ou ajuste). Selecione a foto ou imagem.'); }
      tmp = copiaDaCamada(doc, l).doc;
      try {
        selecionarTransparencia();
        var b = tmp.selection.bounds, W = px(tmp.width), H = px(tmp.height);
        transparente = !(tmp.selection.solid && px(b[0]) <= 0 && px(b[1]) <= 0 && px(b[2]) >= W && px(b[3]) >= H);
      } catch (eT) { transparente = false; }
      try { tmp.selection.deselect(); } catch (eD) {}
      // 'site' = a regra do Remover Fundo do site: vai do tamanho que é; passando de 2000 px, 1536
      if (lado === 'site') { lado = Math.max(px(tmp.width), px(tmp.height)) > 2000 ? 1536 : 0; }
      paraRGB8(tmp); if (lado !== 0) { reduzir(tmp, lado || 1024); }
      try { tmp.flatten(); } catch (eF) {}
      salvarJPG(tmp, caminho, 11);
      w = Math.round(px(tmp.width)); h = Math.round(px(tmp.height));
    } finally {
      if (tmp) { fechar(tmp); }
      try { ativar(atual || doc); } catch (e1) {}
    }
    return { largura: w, altura: h, camada: l.name, id: idDe(l), transparente: transparente };
  };
  // Cloner, Veste AI e Pose Changer: o resultado entra logo acima da camada da foto, cabendo na caixa dela,
  // e a original fica desligada (nunca apagada: liga de volta no olho)
  am.colocarResultadoIA = function (docId, layerId, caminho, nome) {
    var doc = docPorId(docId), src = camada(layerId, doc);
    ativar(doc);
    return historico(nome, function () { return colocar(doc, caminho, src, 'substituir', 'caber', nome); });
  };
  // O resultado entra logo acima da original, cobrindo a mesma caixa, e a original fica desligada (nunca apagada).
  // Com recorte: a máscara passa a ser a transparência da original (em vez da caixa).
  am.colocarUpscale = function (docId, layerId, caminho, nome, transparente) {
    var doc = docPorId(docId), src = camada(layerId, doc);
    ativar(doc);
    return historico('Upscale Arcano', function () {
      var r = colocar(doc, caminho, src, 'substituir', 'cobrir', nome), nova = camada(r.id, doc);
      r.mascara = 'caixa';
      if (transparente) {
        try {
          selecionar(nova);
          try {
            var dd = new ActionDescriptor(), rr = new ActionReference();
            rr.putEnumerated(cTID('Chnl'), cTID('Chnl'), cTID('Msk ')); dd.putReference(cTID('null'), rr);
            executeAction(cTID('Dlt '), dd, DialogModes.NO);
          } catch (eSem) {}
          selecionar(src); selecionarTransparencia(); selecionar(nova);
          var d = new ActionDescriptor(), r2 = new ActionReference();
          d.putClass(cTID('Nw  '), cTID('Chnl'));
          r2.putEnumerated(cTID('Chnl'), cTID('Chnl'), cTID('Msk '));
          d.putReference(cTID('At  '), r2);
          d.putEnumerated(cTID('Usng'), cTID('UsrM'), cTID('RvlS'));
          executeAction(cTID('Mk  '), d, DialogModes.NO);
          r.mascara = 'recorte';
        } catch (eM) { r.mascara = 'caixa'; }
        try { doc.selection.deselect(); } catch (eDs) {}
        try { selecionar(nova); } catch (eS) {}
      }
      return r;
    });
  };
  // resultado da IA: em cima da camada de origem, cobrindo a mesma caixa (a original fica); imagem nova: cabe no documento
  am.importarImagemIA = function (docId, layerId, nomeCamada, caminho, nomeLayer) {
    var doc = docPorId(docId), src = null;
    ativar(doc);
    if (layerId !== null && layerId !== undefined && layerId !== '') { try { src = camada(layerId, doc); } catch (e) { src = null; } }
    if (!src && nomeCamada) { try { src = camada(nomeCamada, doc); } catch (e2) { src = null; } }
    var r = historico('imagem da IA', function () {
      return src ? colocar(doc, caminho, src, 'acima', 'cobrir', nomeLayer) : colocar(doc, caminho, null, 'novo', 'caber', nomeLayer);
    });
    var c = caixa(doc.activeLayer);
    return { camada: r.camada, id: r.id, indice: r.id, comp: doc.name, largura: Math.round(c.l), altura: Math.round(c.a), original: src ? src.name : null };
  };
  am.importarWeb = function (caminho, docRef, colocarJa) {
    if (!colocarJa) { return {}; }
    if (/\.(mp4|mov|webm|m4v|avi)$/i.test(caminho)) { throw new Error('Vídeo não vai para o documento do Photoshop: só imagens.'); }
    var doc = docAtivo();
    return historico('imagem da internet', function () {
      var W = px(doc.width), H = px(doc.height);
      try { selecionar(doc.layers[0]); } catch (e0) {}
      var l = colocarArquivo(caminho);
      try { l.move(doc, ElementPlacement.PLACEATBEGINNING); } catch (eM) {}
      encaixar(l, W * 0.1, H * 0.1, W * 0.8, H * 0.8, 'caber');
      l.name = 'Web · ' + nomeDoArquivo(caminho);
      var c = caixa(l);
      return { camada: l.name, id: idDe(l), documento: doc.name, caixa: { x: Math.round(c.x), y: Math.round(c.y), l: Math.round(c.l), a: Math.round(c.a) } };
    });
  };

  // ---------- painel: projeto, diagnóstico ----------
  // ---------- Separar em camadas (Seedream Layerize, pelo servidor do Arcano Layers) ----------
  // Exporta SÓ a camada selecionada (recortada na caixa dela dentro da tela), no tamanho que o modelo aceita:
  // no mínimo 512×512 de área (262.144 px; amplia se for menor) e no máximo 2560 no lado maior.
  am.exportarParaSeparar = function (docId, layerId, caminho) {
    var doc = docPorId(docId), atual = null, tmp = null, f = new File(caminho), l, c, w, h, k;
    try { atual = app.activeDocument; } catch (e0) {}
    if (f.exists) { f.remove(); }
    try {
      l = camada(layerId, doc);
      if (!temImagem(l)) { throw new Error('A camada "' + l.name + '" não tem imagem própria (texto ou ajuste). Selecione uma foto, arte, smart object ou grupo.'); }
      c = copiaDaCamada(doc, l);
      tmp = c.doc;
      paraRGB8(tmp); reduzir(tmp, 2560);
      w = px(tmp.width); h = px(tmp.height);
      if (w * h < 262144) {
        k = Math.sqrt(262144 / (w * h)) * 1.02;
        tmp.resizeImage(new UnitValue(Math.ceil(w * k), 'px'), new UnitValue(Math.ceil(h * k), 'px'), undefined, ResampleMethod.BICUBIC);
      }
      salvarPNG(tmp, caminho);
      w = Math.round(px(tmp.width)); h = Math.round(px(tmp.height));
    } finally {
      if (tmp) { fechar(tmp); }
      try { ativar(atual || doc); } catch (e1) {}
    }
    return { largura: w, altura: h, camada: l.name, id: idDe(l), documento: doc.name, documentoId: idDe(doc), projeto: caminhoDoc(doc), caixa: { x: c.caixa.x, y: c.caixa.y, l: c.caixa.l, a: c.caixa.a } };
  };

  // Monta o resultado: um grupo acima da camada original, cada camada como Smart Object, de baixo (o fundo
  // reconstruído) para cima, no lugar e no tamanho certos (x, y, w, h em pixels do documento, já calculados
  // pelo painel sobre o PNG aparado). A original fica escondida, nunca apagada. Um passo no Histórico.
  am.montarCamadas = function (docId, layerId, itens, nomeGrupo) {
    var doc = docPorId(docId);
    ativar(doc);
    // a camada original pode ter sido apagada enquanto a IA trabalhava: aí o grupo vai para o topo
    var src = null;
    if (layerId !== null && layerId !== undefined && layerId !== '') { try { src = camada('id:' + layerId, doc); } catch (eC) { src = null; } }
    return historico('separar em camadas', function () {
      var g, i, it, l, feitas = [];
      if (src) { selecionar(src); } else { try { selecionar(doc.layers[0]); } catch (eT) {} }
      g = doc.layerSets.add();
      g.name = String(nomeGrupo || 'Camadas').slice(0, 100);
      if (src) { try { g.move(src, ElementPlacement.PLACEBEFORE); } catch (eG) {} }
      else { try { g.move(doc, ElementPlacement.PLACEATBEGINNING); } catch (eG2) {} }
      for (i = 0; i < itens.length; i++) {
        it = itens[i];
        try { selecionar(g.layers.length ? g.layers[0] : g); } catch (eS) {}
        l = colocarArquivo(it.arquivo);
        if (g.layers.length && idDe(g.layers[0]) !== idDe(l)) { try { l.move(g.layers[0], ElementPlacement.PLACEBEFORE); } catch (eM) {} }
        else if (!g.layers.length || idDe(l.parent) !== idDe(g)) { try { l.move(g, ElementPlacement.INSIDE); } catch (eM2) { try { l.move(g, ElementPlacement.PLACEATBEGINNING); } catch (eM3) {} } }
        caixaExata(l, Number(it.x), Number(it.y), Number(it.w), Number(it.h));
        l.name = String(it.nome || ('Camada ' + (i + 1))).slice(0, 100);
        feitas.push({ id: idDe(l), nome: l.name });
      }
      if (src) { try { src.visible = false; } catch (eV) {} }
      feitas.reverse();   // de cima para baixo, como no painel Camadas
      return { grupo: g.name, grupoId: idDe(g), documento: doc.name, original: src ? src.name : null, originalId: src ? idDe(src) : null, camadas: feitas };
    });
  };

  am.projetoAtual = function () {
    var d = null;
    try { d = app.activeDocument; } catch (e) { d = null; }
    return { projeto: d ? caminhoDoc(d) : null, documento: d ? d.name : null };
  };
  am.projectInfo = function () {
    var docs = [], i, ativo = null;
    for (i = 0; i < app.documents.length; i++) { docs.push(app.documents[i].name); }
    try { ativo = app.activeDocument.name; } catch (e) {}
    return { versao: app.version, idioma: (function () { try { return app.locale; } catch (e2) { return '?'; } })(), documentos: docs, ativo: ativo };
  };
  am.testeEscrita = function (caminho) {
    var f = new File(caminho);
    if (!f.open('w')) { throw new Error('O Photoshop bloqueou a gravação de arquivos'); }
    f.write('ok');
    f.close();
    f.remove();
    return 'OK';
  };

  var SEM_AMBIENTE = { projetoAtual: true, projectInfo: true, testeEscrita: true, pastaDocumentos: true };
  am.pastaDocumentos = function () { return { pasta: Folder.myDocuments.fsName }; };

  am.call = function (nome, args) {
    try {
      if (typeof am[nome] !== 'function') { throw new Error('Função desconhecida no Arcano Design: ' + nome); }
      if (SEM_AMBIENTE[nome]) { return ser({ ok: true, resultado: am[nome].apply(null, args || []) }); }   // consultas de toda hora: sem mexer nas preferências
      return ser({ ok: true, resultado: comAmbiente(function () { return am[nome].apply(null, args || []); }) });
    } catch (e) {
      return ser({ ok: false, erro: String(e && e.message ? e.message : e), linha: (e && e.line) ? e.line : null });
    }
  };

  $.global.__am = am;
})();
