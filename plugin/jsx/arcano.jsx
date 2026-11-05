/* Arcano Motion 0.9.67 - biblioteca ExtendScript.
   ES3 de proposito (motor de script do After 2020 a 2026).
   Tudo fica em $.global.__am */
(function () {
  var am = {};
  am.v = '1.0.33';

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
      else if (c === '\r') { out += '\\r'; }
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
    if (nivel > 8) { return esc('[profundidade maxima]'); }
    if (v instanceof Array) {
      for (i = 0; i < v.length; i++) { partes.push(ser(v[i], nivel + 1)); }
      return '[' + partes.join(',') + ']';
    }
    try { simples = (v.constructor === Object); } catch (e1) {}
    if (!simples) {
      try { classe = v.reflect.name; } catch (e2) {}
      try { if (v.name !== undefined) { nome = ' "' + v.name + '"'; } } catch (e3) {}
      return esc('[' + (classe || 'objeto') + nome + ']');
    }
    for (k in v) {
      if (v.hasOwnProperty(k)) { partes.push(esc(k) + ':' + ser(v[k], nivel + 1)); }
    }
    return '{' + partes.join(',') + '}';
  }
  am.ser = ser;

  // ---------- localizar comp ----------
  function ehComp(it) { return it && (it instanceof CompItem); }

  am.listarComps = function () {
    var p = app.project, lista = [], i;
    for (i = 1; i <= p.numItems; i++) {
      if (ehComp(p.item(i))) { lista.push(p.item(i)); }
    }
    return lista;
  };

  // Versão "só olhar" para as consultas automáticas do painel (a cada segundo):
  // NUNCA ativa o viewer nem muda o foco — senão o After tira a seleção do painel Projeto toda hora.
  am.compPassiva = function () {
    var p = app.project;
    try { if (ehComp(p.activeItem)) { return p.activeItem; } } catch (e) {}
    return null;
  };

  am.findComp = function (ref) {
    var p = app.project, i, it, comps;
    if (ref === undefined || ref === null || ref === '') {
      if (ehComp(p.activeItem)) { return p.activeItem; }
      try {
        if (app.activeViewer && app.activeViewer.type === ViewerType.VIEWER_COMPOSITION) {
          app.activeViewer.setActive();
          if (ehComp(p.activeItem)) { return p.activeItem; }
        }
      } catch (e) {}
      comps = am.listarComps();
      if (comps.length === 1) { return comps[0]; }
      if (comps.length === 0) { throw new Error('O projeto nao tem nenhuma composicao.'); }
      throw new Error('Nenhuma comp ativa. Clique na Timeline da comp desejada ou informe o nome da comp.');
    }
    var idNum = null;
    if (typeof ref === 'number') { idNum = ref; }
    else if (/^(id:)?\d+$/.test(String(ref))) { idNum = parseInt(String(ref).replace('id:', ''), 10); }
    for (i = 1; i <= p.numItems; i++) {
      it = p.item(i);
      if (!ehComp(it)) { continue; }
      if ((idNum !== null && it.id === idNum) || String(ref) === it.name) { return it; }
    }
    throw new Error('Comp nao encontrada: ' + ref);
  };

  // ---------- leitura do projeto ----------
  am.projectInfo = function () {
    var p = app.project, comps = [], lista = am.listarComps(), i, c, ativa = null, sel = [];
    for (i = 0; i < lista.length && i < 200; i++) {
      c = lista[i];
      comps.push({ id: c.id, nome: c.name, largura: c.width, altura: c.height, fps: c.frameRate, duracao: c.duration, layers: c.numLayers });
    }
    try {
      c = am.findComp();
      ativa = { id: c.id, nome: c.name, tempoAtual: c.time };
      for (i = 0; i < c.selectedLayers.length; i++) {
        sel.push({ indice: c.selectedLayers[i].index, nome: c.selectedLayers[i].name });
      }
    } catch (e) {}
    return {
      after: app.version,
      idioma: app.isoLanguage,
      arquivo: p.file ? p.file.fsName : '(projeto ainda nao salvo)',
      totalItens: p.numItems,
      comps: comps,
      compAtiva: ativa,
      layersSelecionadas: sel
    };
  };

  function tipoLayer(l) {
    try {
      if (l instanceof TextLayer) { return 'texto'; }
      if (l instanceof ShapeLayer) { return 'shape'; }
      if (l instanceof CameraLayer) { return 'camera'; }
      if (l instanceof LightLayer) { return 'luz'; }
      if (l.nullLayer) { return 'null'; }
      if (l.adjustmentLayer) { return 'ajuste'; }
      if (l.source instanceof CompItem) { return 'precomp'; }
      if (l.source && l.source.mainSource instanceof SolidSource) { return 'solido'; }
    } catch (e) {}
    return 'footage';
  }

  function lerProp(grupo, matchName) {
    var p, info;
    try { p = grupo.property(matchName); } catch (e) { return null; }
    if (!p) { return null; }
    info = { numKeyframes: 0 };
    try { info.valor = p.value; } catch (e1) { info.valor = null; }
    try { info.numKeyframes = p.numKeys; } catch (e2) {}
    try { if (p.expressionEnabled && p.expression) { info.expressao = p.expression; } } catch (e3) {}
    return info;
  }

  am.compInfo = function (ref) {
    var c = am.findComp(ref), layers = [], i, l, info, tr, fx, e;
    for (i = 1; i <= c.numLayers && i <= 150; i++) {
      l = c.layer(i);
      info = { indice: i, nome: l.name, tipo: tipoLayer(l), ativo: l.enabled, entrada: l.inPoint, saida: l.outPoint, pai: null };
      try { if (l.parent) { info.pai = l.parent.index; } } catch (e0) {}
      try { info.tresD = l.threeDLayer; } catch (e1) {}
      try { tr = l.property('ADBE Transform Group'); } catch (e2) { tr = null; }
      if (tr) {
        info.transform = {
          anchor: lerProp(tr, 'ADBE Anchor Point'),
          posicao: lerProp(tr, 'ADBE Position'),
          escala: lerProp(tr, 'ADBE Scale'),
          rotacao: lerProp(tr, 'ADBE Rotate Z'),
          opacidade: lerProp(tr, 'ADBE Opacity')
        };
      }
      try { fx = l.property('ADBE Effect Parade'); } catch (e3) { fx = null; }
      if (fx && fx.numProperties > 0) {
        info.efeitos = [];
        for (e = 1; e <= fx.numProperties; e++) {
          info.efeitos.push({ nome: fx.property(e).name, matchName: fx.property(e).matchName });
        }
      }
      layers.push(info);
    }
    return {
      id: c.id, nome: c.name, largura: c.width, altura: c.height, fps: c.frameRate,
      duracao: c.duration, tempoAtual: c.time, corDeFundo: c.bgColor,
      totalLayers: c.numLayers, layers: layers
    };
  };

  // ---------- mapa completo: comp + todas as precomps (recursivo) ----------
  var NOMES_MODO = ['NORMAL', 'DISSOLVE', 'DARKEN', 'MULTIPLY', 'COLOR_BURN', 'LINEAR_BURN', 'DARKER_COLOR', 'LIGHTEN', 'SCREEN', 'COLOR_DODGE', 'LINEAR_DODGE', 'ADD', 'LIGHTER_COLOR', 'OVERLAY', 'SOFT_LIGHT', 'HARD_LIGHT', 'LINEAR_LIGHT', 'VIVID_LIGHT', 'PIN_LIGHT', 'HARD_MIX', 'DIFFERENCE', 'EXCLUSION', 'SUBTRACT', 'DIVIDE', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY'];
  function nomeModo(l) {
    var i;
    try {
      for (i = 0; i < NOMES_MODO.length; i++) {
        if (BlendingMode[NOMES_MODO[i]] !== undefined && l.blendingMode === BlendingMode[NOMES_MODO[i]]) { return NOMES_MODO[i].toLowerCase(); }
      }
    } catch (e) {}
    return null;
  }
  function arred(v) {
    var i, r;
    if (typeof v === 'number') { return Math.round(v * 10) / 10; }
    if (v instanceof Array) { r = []; for (i = 0; i < v.length; i++) { r.push(Math.round(v[i] * 10) / 10); } return r; }
    return v;
  }

  am.compTree = function (ref) {
    var raiz = am.findComp(ref), vistos = {}, comps = [], total = 0;
    function visitar(c, nivel) {
      var info, filhas = [], i, l, d, tr, fx, e, m, op, es, k;
      if (vistos[c.id] || nivel > 6) { return; }
      vistos[c.id] = true;
      info = { id: c.id, nome: c.name, largura: c.width, altura: c.height, fps: c.frameRate, duracao: arred(c.duration), nivel: nivel, layers: [] };
      comps.push(info);
      for (i = 1; i <= c.numLayers; i++) {
        if (total >= 400) { info.cortado = true; break; }
        l = c.layer(i);
        total++;
        d = { i: i, nome: l.name, tipo: tipoLayer(l) };
        try { if (!l.enabled) { d.oculto = true; } } catch (e0) {}
        m = nomeModo(l);
        if (m && m !== 'normal') { d.modo = m; }
        try { if (l.parent) { d.pai = l.parent.index; } } catch (e1) {}
        try { if (l.threeDLayer) { d.tresD = true; } } catch (e2) {}
        try { if (l.adjustmentLayer) { d.ajuste = true; } } catch (e3) {}
        try { if (l.source && l.source.width) { d.tam = [l.source.width, l.source.height]; } } catch (e4) {}
        try {
          tr = l.property('ADBE Transform Group');
          d.pos = arred(tr.property('ADBE Position').value);
          es = tr.property('ADBE Scale').value;
          if (es[0] !== 100 || es[1] !== 100) { d.escala = arred(es); }
          op = tr.property('ADBE Opacity').value;
          if (op !== 100) { d.opac = arred(op); }
        } catch (e5) {}
        try {
          fx = l.property('ADBE Effect Parade');
          if (fx && fx.numProperties > 0) { d.efeitos = []; for (e = 1; e <= fx.numProperties; e++) { d.efeitos.push(fx.property(e).name); } }
        } catch (e6) {}
        try { if (l.source instanceof CompItem) { d.precomp = { id: l.source.id, nome: l.source.name }; filhas.push(l.source); } } catch (e7) {}
        info.layers.push(d);
      }
      for (k = 0; k < filhas.length; k++) { visitar(filhas[k], nivel + 1); }
    }
    visitar(raiz, 0);
    return { raiz: raiz.name, totalComps: comps.length, totalLayers: total, comps: comps };
  };

  // ---------- render de 1 frame em PNG ----------
  am.renderFrame = function (ref, tempo, caminho) {
    var c = am.findComp(ref), f, maximo;
    if (!c.saveFrameToPng) { throw new Error('Esta versao do After nao permite exportar frame por script (saveFrameToPng).'); }
    if (tempo === undefined || tempo === null) { tempo = c.time; }
    maximo = c.duration - c.frameDuration;
    if (tempo > maximo) { tempo = maximo; }
    if (tempo < 0) { tempo = 0; }
    f = new File(caminho);
    if (f.exists) { f.remove(); }
    c.saveFrameToPng(tempo, f);
    return { comp: c.name, tempo: tempo, largura: c.width, altura: c.height };
  };

  // ---------- render do video inteiro (controle remoto / ferramenta ae_renderizar_video) ----------
  // Usa a fila de render do After com o formato H.264 (After 2023+). Renderiza a comp inteira (ou o trecho
  // pedido), desliga temporariamente os outros itens da fila e devolve tudo como estava. O After fica
  // ocupado enquanto renderiza (igual a clicar em Render).
  am.renderizarVideo = function (ref, caminho, inicio, duracao, rapido) {
    var c = am.findComp(ref), rq = app.project.renderQueue, i, it, desligados = [], item = null, om, tpl = null, lista, saida, t0, ini, dur;
    if (rq.rendering) { throw new Error('A fila de render do After ja esta renderizando. Espere terminar.'); }
    for (i = 1; i <= rq.numItems; i++) {
      it = rq.item(i);
      try { if (it.render) { it.render = false; desligados.push(it); } } catch (e0) {}
    }
    try {
      item = rq.items.add(c);
      ini = (inicio !== undefined && inicio !== null && inicio !== '') ? Math.max(0, Number(inicio) || 0) : 0;
      dur = (duracao !== undefined && duracao !== null && Number(duracao) > 0) ? Number(duracao) : c.duration - ini;
      if (ini >= c.duration) { ini = 0; }
      dur = Math.max(c.frameDuration, Math.min(dur, c.duration - ini));
      item.timeSpanStart = ini;
      item.timeSpanDuration = dur;
      // revisão: meia resolução para sair rápido (After 2022+; se não der, renderiza normal)
      if (rapido) { try { item.setSetting('Resolution', 'Half'); } catch (eR) {} }
      om = item.outputModule(1);
      lista = om.templates;
      for (i = 0; i < lista.length; i++) { if (/H\.?264/i.test(lista[i]) && /15/.test(lista[i])) { tpl = lista[i]; break; } }
      if (!tpl) { for (i = 0; i < lista.length; i++) { if (/H\.?264/i.test(lista[i])) { tpl = lista[i]; break; } } }
      if (!tpl) { throw new Error('Nao achei o formato H.264 nos modelos de saida do After (precisa do After 2023 ou mais novo).'); }
      om.applyTemplate(tpl);
      saida = new File(caminho);
      if (saida.exists) { saida.remove(); }
      om.file = saida;
      t0 = new Date().getTime();
      try { app.beginSuppressDialogs(); } catch (e1) {}
      try { rq.render(); } finally { try { app.endSuppressDialogs(false); } catch (e2) {} }
      saida = om.file;
      if (!saida || !saida.exists) { throw new Error('O After terminou o render mas o arquivo nao apareceu.'); }
      return { arquivo: saida.fsName, tamanho: saida.length, comp: c.name, compId: c.id, largura: c.width, altura: c.height,
        inicio: ini, duracao: dur, fps: c.frameRate, segundos: Math.round((new Date().getTime() - t0) / 100) / 10, formato: tpl };
    } finally {
      try { if (item) { item.remove(); } } catch (e3) {}
      for (i = 0; i < desligados.length; i++) { try { desligados[i].render = true; } catch (e4) {} }
    }
  };

  // ---------- teste de permissao de gravacao ----------
  am.testeEscrita = function (caminho) {
    var f = new File(caminho);
    if (!f.open('w')) { throw new Error('O After bloqueou a gravacao de arquivos'); }
    f.write('ok');
    f.close();
    f.remove();
    return 'OK';
  };

  // ---------- executar codigo do Claude (1 passo de desfazer) ----------
  am.run = function (codigo, rotulo) {
    var fn, r;
    app.beginUndoGroup('Arcano Motion: ' + (rotulo || 'acao'));
    try {
      fn = eval('(function () {\n' + codigo + '\n})');
      r = fn();
      app.endUndoGroup();
      return { resultado: (r === undefined ? null : r) };
    } catch (e) {
      try { app.endUndoGroup(); } catch (e2) {}
      throw e;
    }
  };


  // ---------- IA (Kie): camada selecionada, exportar imagem, importar vídeo ----------
  var EXT_IMAGEM = /\.(jpe?g|png|webp)$/i;

  am.camadaIA = function (passivo) {
    var c = passivo ? am.compPassiva() : am.findComp();
    if (!c) { return { comp: null, camada: null, passivo: true }; }
    var info = { comp: c.name, compId: c.id, largura: c.width, altura: c.height, tempo: c.time, projeto: app.project.file ? app.project.file.fsName : null, camada: null };
    if (c.selectedLayers.length) {
      var l = c.selectedLayers[0], d = { indice: l.index, nome: l.name, temFonte: false, arquivo: null };
      try {
        if (l.source && l.source.width) {
          d.temFonte = true;
          d.largura = l.source.width;
          d.altura = l.source.height;
          try {
            if (l.source.mainSource && l.source.mainSource.file && EXT_IMAGEM.test(l.source.mainSource.file.name) && l.source.mainSource.isStill) {
              d.arquivo = l.source.mainSource.file.fsName;
            }
          } catch (e1) {}
        }
      } catch (e2) {}
      info.camada = d;
    }
    return info;
  };

  // Para a IA do chat: escolhe a camada por índice ou nome (sem depender da seleção) e devolve o mesmo formato do camadaIA
  am.camadaIAAlvo = function (compRef, camRef) {
    var c = am.findComp(compRef || null), l = null, i;
    var info = { comp: c.name, compId: c.id, largura: c.width, altura: c.height, tempo: c.time, duracao: c.duration, projeto: app.project.file ? app.project.file.fsName : null, camada: null };
    if (camRef !== undefined && camRef !== null && camRef !== '') {
      if (!isNaN(Number(camRef)) && Number(camRef) >= 1 && Number(camRef) <= c.numLayers) { l = c.layer(Number(camRef)); }
      if (!l) { for (i = 1; i <= c.numLayers; i++) { if (c.layer(i).name === String(camRef)) { l = c.layer(i); break; } } }
      if (!l) { throw new Error('Não achei a camada "' + camRef + '" na comp "' + c.name + '".'); }
    } else if (c.selectedLayers.length) { l = c.selectedLayers[0]; }
    if (l) {
      var d = { indice: l.index, nome: l.name, temFonte: false, arquivo: null };
      try {
        if (l.source && l.source.width && !(l instanceof TextLayer) && !(l instanceof ShapeLayer)) {
          d.temFonte = true; d.largura = l.source.width; d.altura = l.source.height;
          try { if (l.source.mainSource && l.source.mainSource.file && EXT_IMAGEM.test(l.source.mainSource.file.name) && l.source.mainSource.isStill) { d.arquivo = l.source.mainSource.file.fsName; } } catch (e1) {}
        }
      } catch (e2) {}
      info.camada = d;
    }
    return info;
  };

  // modo 'camada': só a camada (fundo transparente), no tamanho original dela. modo 'frame': a comp inteira no tempo atual.
  // fundoVerde: true (verde #00B140) ou uma cor "#rrggbb"; margem: 0 a 0.4 de borda extra em volta (para o
  // movimento do vídeo não cortar o objeto; o ae_trocar_midia usa a mesma margem para pôr no lugar certo)
  am.exportarImagemIA = function (compId, indice, modo, caminho, fundoVerde, margem) {
    var c = am.findComp('id:' + compId), f = new File(caminho), tmp, l, t;
    if (f.exists) { f.remove(); }
    if (modo === 'frame') {
      c.saveFrameToPng(Math.min(c.time, c.duration - c.frameDuration), f);
      return { tmpId: null, largura: c.width, altura: c.height };
    }
    l = c.layer(indice);
    if (!l || !l.source || !l.source.width) { throw new Error('A camada selecionada não tem imagem própria (texto ou shape). Use a opção "Frame atual da comp".'); }
    t = c.time - l.startTime;
    if (t < 0) { t = 0; }
    var mg = Math.max(0, Math.min(0.4, Number(margem) || 0)), W2 = Math.round(l.source.width * (1 + 2 * mg)), H2 = Math.round(l.source.height * (1 + 2 * mg));
    tmp = app.project.items.addComp('__arcano_ia_tmp', W2, H2, 1, Math.max(l.source.duration || 1, 1), c.frameRate);
    var nl = tmp.layers.add(l.source);
    try { nl.property('ADBE Transform Group').property('ADBE Position').setValue([W2 / 2, H2 / 2]); } catch (eP) {}
    // "animar foto/selo": vai para a IA sobre cor chapada (o vídeo já nasce pronto para o chroma key)
    if (fundoVerde) {
      var cf = /^#?([0-9a-f]{6})$/i.exec(String(fundoVerde)), hx = cf ? cf[1] : '00b140';
      var verde = tmp.layers.addSolid([parseInt(hx.substr(0, 2), 16) / 255, parseInt(hx.substr(2, 2), 16) / 255, parseInt(hx.substr(4, 2), 16) / 255], 'fundo', W2, H2, 1); verde.moveToEnd();
    }
    if (t > tmp.duration - tmp.frameDuration) { t = 0; }
    tmp.saveFrameToPng(t, f);
    return { tmpId: tmp.id, largura: W2, altura: H2 };
  };

  // Lista as camadas com imagem da comp ativa e das precomps dentro dela (para os presets de vídeo)
  am.arvoreCamadas = function () {
    var raiz = am.findComp(), lista = [], vistos = {};
    function andar(c, nivel, caminho) {
      if (vistos[c.id] || nivel > 5) { return; }
      vistos[c.id] = true;
      for (var i = 1; i <= c.numLayers; i++) {
        var l = c.layer(i), img = false, pre = false;
        try { pre = l.source instanceof CompItem; img = !!(l.source && l.source.width) && !(l instanceof TextLayer) && !(l instanceof ShapeLayer) && !l.nullLayer && !l.adjustmentLayer; } catch (e) {}
        if (l instanceof CameraLayer || l instanceof LightLayer) { continue; }
        var modo = ''; try { modo = String(l.blendingMode).replace(/^BlendingMode\./, ''); } catch (e2) {}
        lista.push({ compId: c.id, comp: c.name, caminho: caminho, nivel: nivel, indice: i, nome: l.name, imagem: img, precomp: pre, ligada: l.enabled,
          largura: img ? l.source.width : 0, altura: img ? l.source.height : 0, video: img && !pre && l.source.duration > 0 && !(l.source.mainSource && l.source.mainSource.isStill) });
        if (pre) { andar(l.source, nivel + 1, caminho + ' › ' + l.name); }
      }
    }
    andar(raiz, 0, raiz.name);
    return { comp: raiz.name, compId: raiz.id, largura: raiz.width, altura: raiz.height, tempo: raiz.time, duracao: raiz.duration, camadas: lista };
  };

  // Troca a imagem de uma camada pelo vídeo gerado, no MESMO lugar e com TUDO que ela tinha (efeitos, máscaras,
  // modo de mesclagem, opacidade, track matte, parent, posição). A original fica desligada logo abaixo, nunca apagada.
  // origRef/novoRef: índice ou nome. opcoes: { chroma: bool, cor: '#rrggbb', loop: bool (padrão true), final: 'loop'|'segurar'|'inverter', margem }
  am.trocarPorVideo = function (compRef, origRef, novoRef, opcoes) {
    opcoes = opcoes || {};
    return desfazivel('trocar pelo vídeo da IA', function () {
      var c = am.findComp(compRef || null), i;
      function achar(ref) {
        if (ref !== undefined && ref !== null && !isNaN(Number(ref)) && Number(ref) >= 1 && Number(ref) <= c.numLayers) { return c.layer(Number(ref)); }
        for (i = 1; i <= c.numLayers; i++) { if (c.layer(i).name === String(ref)) { return c.layer(i); } }
        throw new Error('Não achei a camada "' + ref + '" na comp "' + c.name + '".');
      }
      var novo = achar(novoRef), item = novo.source;
      // sem "original": é a camada logo abaixo do vídeo importado (a importação sempre põe o vídeo em cima da original)
      var orig = (origRef === undefined || origRef === null || origRef === '') ? (novo.index < c.numLayers ? c.layer(novo.index + 1) : null) : achar(origRef);
      if (!orig || orig === novo) { throw new Error('Diga qual é a camada original (nome ou índice).'); }
      if (!(item instanceof FootageItem) || !item.width) { throw new Error('A camada "' + novo.name + '" não é um vídeo importado.'); }
      if (!orig.source || !orig.source.width) { throw new Error('A camada "' + orig.name + '" não tem imagem para trocar.'); }
      var w0 = orig.source.width, h0 = orig.source.height, w1 = item.width, h1 = item.height;
      // margem usada na geração: o vídeo mostra a imagem com uma borda em volta, do mesmo centro
      var mg = Math.max(0, Math.min(0.4, Number(opcoes.margem) || 0));
      var k = Math.max(w0 * (1 + 2 * mg) / w1, h0 * (1 + 2 * mg) / h1), nome0 = orig.name, ini = orig.inPoint, fim = orig.outPoint;
      // cópia de segurança da imagem original, desligada, logo abaixo
      var copia = orig.duplicate();
      copia.moveAfter(orig);
      copia.enabled = false;
      try { copia.name = nome0 + ' (imagem original)'; } catch (eN) {}
      // Lê âncora, escala e máscaras ANTES da troca: o After mexe na âncora sozinho no replaceSource
      // (recentraliza/proporcionaliza no tamanho novo). Calcular em cima do valor de depois aplicava a conversão duas vezes
      // e jogava a camada pro canto. Então: foto antes -> conversão -> grava depois (valor absoluto).
      var foto = function (p) {
        if (!p) { return null; }
        var f = { p: p, keys: [] };
        if (p.numKeys) { for (var q = 1; q <= p.numKeys; q++) { f.keys.push(p.keyValue(q)); } } else { f.valor = p.value; }
        return f;
      };
      var gravar = function (f, conv) {
        if (!f) { return; }
        if (f.keys.length) { for (var q = 1; q <= f.keys.length && q <= f.p.numKeys; q++) { f.p.setValueAtKey(q, conv(f.keys[q - 1])); } } else { f.p.setValue(conv(f.valor)); }
      };
      var tr = orig.property('ADBE Transform Group');
      var fAnc = foto(tr.property('ADBE Anchor Point')), fEsc = foto(tr.property('ADBE Scale')), fMasc = [];
      var mp = orig.property('ADBE Mask Parade');
      if (mp) { for (i = 1; i <= mp.numProperties; i++) { fMasc.push(foto(mp.property(i).property('ADBE Mask Shape'))); } }
      // troca a fonte na própria camada: mantém efeitos, máscaras, mesclagem, matte, parent e posição na pilha
      orig.replaceSource(item, false);
      try { orig.name = nome0 + ' (IA)'; } catch (eN2) {}
      // ponto da imagem original -> ponto do vídeo (o vídeo cobre a área com escala k, centralizado)
      var mapa = function (v) { var r = [(v[0] - w0 / 2) / k + w1 / 2, (v[1] - h0 / 2) / k + h1 / 2]; if (v.length > 2) { r.push(v[2]); } return r; };
      gravar(fAnc, mapa);
      gravar(fEsc, function (v) { var r = [v[0] * k, v[1] * k]; if (v.length > 2) { r.push(v[2]); } return r; });
      // máscaras estão no espaço da camada: acompanham a troca de tamanho
      for (i = 0; i < fMasc.length; i++) {
        gravar(fMasc[i], function (sh) {
          var n = new Shape(), vs = [], j;
          for (j = 0; j < sh.vertices.length; j++) { vs.push(mapa(sh.vertices[j])); }
          n.vertices = vs;
          var it2 = [], ot2 = []; for (j = 0; j < sh.inTangents.length; j++) { it2.push([sh.inTangents[j][0] / k, sh.inTangents[j][1] / k]); ot2.push([sh.outTangents[j][0] / k, sh.outTangents[j][1] / k]); }
          n.inTangents = it2; n.outTangents = ot2; n.closed = sh.closed;
          return n;
        });
      }
      // tempo do vídeo pelo time remap:
      //   loop (padrão): repete até o fim da camada
      //   final "segurar": toca uma vez e congela no último quadro até o fim da camada
      //   final "inverter": toca de trás pra frente e termina (e congela) no PRIMEIRO quadro gerado,
      //     que é a imagem original exata (usado no selo 3D: a IA gera a desmontagem, aqui vira montagem)
      // ATENÇÃO: "final" é palavra reservada no ExtendScript (ES3): sempre opcoes['final'], nunca opcoes.final
      var modoFinal = opcoes['final'], modoTempo = modoFinal === 'inverter' ? 'inverter' : (modoFinal === 'segurar' || opcoes.loop === false ? 'segurar' : 'loop');
      try {
        orig.timeRemapEnabled = true;
        var tm = orig.property('ADBE Time Remapping');
        if (modoTempo === 'loop') {
          tm.expression = 'loopOut("cycle")';
        } else {
          try { tm.expression = ''; } catch (eX) {}
          while (tm.numKeys > 0) { tm.removeKey(1); }
          var fd = item.frameDuration || c.frameDuration, ult = Math.max(0, item.duration - fd), t0 = ini;
          // camada mais curta que o vídeo: no "inverter" começa antes para terminar montado no fim da camada
          if (modoTempo === 'inverter' && ini + ult > fim) { t0 = fim - ult; }
          tm.setValueAtTime(t0, modoTempo === 'inverter' ? ult : 0);
          tm.setValueAtTime(t0 + ult, modoTempo === 'inverter' ? 0 : ult);
        }
        orig.inPoint = ini; orig.outPoint = fim;
      } catch (eL) {}
      // chroma key (fundo verde) como PRIMEIRO efeito: os efeitos que já existiam continuam valendo por cima
      var ky = null;
      if (opcoes.chroma) {
        var fx = orig.property('ADBE Effect Parade');
        if (!fx.canAddProperty('Keylight 906')) { throw new Error('O Keylight não está disponível neste After para o chroma key.'); }
        ky = fx.addProperty('Keylight 906');
        try { ky.name = 'Arcano Chroma'; } catch (eK) {}
        var cor = /^#?([0-9a-f]{6})$/i.exec(String(opcoes.cor || '#00b140')), hx = cor ? cor[1] : '00b140';
        var pc = acharControle(ky, ['Screen Colour', 'Screen Color']);
        if (pc) { try { pc.setValue([parseInt(hx.substr(0, 2), 16) / 255, parseInt(hx.substr(2, 2), 16) / 255, parseInt(hx.substr(4, 2), 16) / 255, 1]); } catch (eC) {} }
        var cb = acharControle(ky, ['Clip Black']); if (cb) { try { cb.setValue(10); } catch (eB) {} }
        var cw = acharControle(ky, ['Clip White']); if (cw) { try { cw.setValue(90); } catch (eW) {} }
        try { ky.moveTo(1); } catch (eM) {}
      }
      // a camada importada só serviu de fonte: sai
      if (novo !== orig) { try { novo.remove(); } catch (eR) {} }
      return { camada: orig.name, indice: orig.index, original: copia.name, comp: c.name, escala: k, chroma: !!ky, loop: modoTempo === 'loop', 'final': modoTempo,
        mensagem: 'Trocado: "' + orig.name + '" com os mesmos efeitos, máscaras, mesclagem e lugar. A imagem original ficou desligada logo abaixo ("' + copia.name + '").' };
    });
  };

  // ---------- Gerador de preset: plano B para vídeo que o painel não consegue tocar (.mov ProRes etc.) ----------
  // Importa o vídeo de referência numa comp temporária (fora de qualquer pasta do usuário); o painel renderiza
  // os quadros com renderFrame('id:...') e depois apaga tudo com gpRemover.
  am.gpImportar = function (caminho) {
    var item = app.project.importFile(new ImportOptions(new File(caminho)));
    if (!item.width || !item.height || !item.duration) { try { item.remove(); } catch (e0) {} throw new Error('O After não leu esse arquivo como vídeo.'); }
    var fps = item.frameRate || 30, c = app.project.items.addComp('__arcano_gp_tmp', item.width, item.height, item.pixelAspect || 1, item.duration, fps);
    c.layers.add(item);
    return { compId: c.id, itemId: item.id, duracao: item.duration, largura: item.width, altura: item.height, fps: fps };
  };
  am.gpRemover = function (compId, itemId) {
    var i, it;
    for (i = app.project.numItems; i >= 1; i--) {
      it = app.project.item(i);
      if ((it instanceof CompItem && it.id === compId && it.name === '__arcano_gp_tmp') || (it.id === itemId && it instanceof FootageItem)) { try { it.remove(); } catch (e) {} }
    }
    return true;
  };

  am.removerTempIA = function (tmpId) {
    var i, it;
    for (i = app.project.numItems; i >= 1; i--) {
      it = app.project.item(i);
      if (it instanceof CompItem && it.id === tmpId && it.name === '__arcano_ia_tmp') { it.remove(); return true; }
    }
    return false;
  };

  function pastaIA() {
    var p = app.project, i, it;
    for (i = 1; i <= p.numItems; i++) {
      it = p.item(i);
      if (it instanceof FolderItem && it.name === 'Arcano IA') { return it; }
    }
    return p.items.addFolder('Arcano IA');
  }

  // Importa o vídeo e coloca acima da camada de origem, cobrindo a mesma área. Um passo de desfazer.
  am.importarVideoIA = function (compId, indice, nomeCamada, caminho, nomeLayer) {
    return colocarMidiaIA(compId, indice, nomeCamada, caminho, nomeLayer, false);
  };
  // Imagem: na edição cobre a camada original (mesmo tempo dela); imagem nova entra inteira na comp, do início ao fim
  // Arquivo baixado da internet (imagem/vídeo): entra na pasta "Arcano Web" do projeto e, se pedir, na comp
  am.importarWeb = function (caminho, compRef, colocar) {
    return desfazivel('arquivo da internet', function () {
      var item = app.project.importFile(new ImportOptions(new File(caminho))), pasta = null, p = app.project, i, it, res;
      for (i = 1; i <= p.numItems; i++) { it = p.item(i); if (it instanceof FolderItem && it.name === 'Arcano Web') { pasta = it; break; } }
      if (!pasta) { pasta = p.items.addFolder('Arcano Web'); }
      try { item.parentFolder = pasta; } catch (e0) {}
      res = { item: item.name, itemId: item.id, largura: item.width || 0, altura: item.height || 0, duracao: item.duration || 0 };
      if (colocar) {
        var c = am.findComp(compRef || null), l = c.layers.add(item), k;
        if (item.width && item.height) {
          k = Math.min(c.width * 0.8 / item.width, c.height * 0.8 / item.height, 1) * 100;
          l.property('ADBE Transform Group').property('ADBE Scale').setValue([k, k]);
        }
        res.camada = l.name; res.indice = l.index; res.comp = c.name; res.compId = c.id;
      }
      return res;
    });
  };

  // Arquivos que o usuário mandou pelo chat (logo, PSD, imagens, vídeos, áudio, PDF/AI): entram na pasta
  // "Arcano Arquivos" do projeto. PSD vira composição com as camadas separadas. Um passo de desfazer.
  am.importarArquivos = function (lista) {
    return desfazivel('arquivos do usuário', function () {
      var p = app.project, pasta = null, i, k, it, out = [], maiorId = 0;
      for (i = 1; i <= p.numItems; i++) {
        it = p.item(i);
        if (it.id > maiorId) { maiorId = it.id; }
        if (!pasta && it instanceof FolderItem && it.name === 'Arcano Arquivos') { pasta = it; }
      }
      if (!pasta) { pasta = p.items.addFolder('Arcano Arquivos'); }
      for (i = 0; i < lista.length; i++) {
        var a = lista[i], r = { nome: a.nome }, io, item;
        try {
          io = new ImportOptions(new File(a.caminho));
          if (/\.(psd|psb)$/i.test(a.caminho)) {
            try {
              if (io.canImportAs(ImportAsType.COMP_CROPPED_LAYERS)) { io.importAs = ImportAsType.COMP_CROPPED_LAYERS; }
              else if (io.canImportAs(ImportAsType.COMP)) { io.importAs = ImportAsType.COMP; }
            } catch (e1) {}
          }
          item = p.importFile(io);
          try { item.parentFolder = pasta; } catch (e2) {}
          r.item = item.name; r.id = item.id;
          r.tipo = (item instanceof CompItem) ? 'comp' : 'footage';
          r.largura = item.width || 0; r.altura = item.height || 0; r.duracao = item.duration || 0;
          if (item instanceof CompItem) {
            r.camadas = item.numLayers; r.nomesCamadas = [];
            for (k = 1; k <= item.numLayers && k <= 40; k++) { r.nomesCamadas.push(item.layer(k).name); }
          }
        } catch (e) { r.erro = String(e && e.message ? e.message : e); }
        out.push(r);
      }
      // a pasta "... Camadas/Layers" que o PSD cria na raiz vai para dentro de "Arcano Arquivos"
      for (i = p.numItems; i >= 1; i--) {
        it = p.item(i);
        if (it.id > maiorId && it instanceof FolderItem && it !== pasta && it.parentFolder === p.rootFolder) {
          try { it.parentFolder = pasta; } catch (e3) {}
        }
      }
      return out;
    });
  };

  // ===== ÁUDIO ORGANIZADO (v1.1.0, pedido do dono): nada de áudio solto na comp principal =====
  // Cada tipo mora na SUA comp, no fim da pilha da comp principal, alinhada no 0 (tempo de dentro = tempo de fora):
  //   "[AUDIO] Narração" · "[AUDIO] Efeitos sonoros" · "[AUDIO] Trilha sonora"
  var NOMES_AUDIO = { narracao: '[AUDIO] Narração', sfx: '[AUDIO] Efeitos sonoros', trilha: '[AUDIO] Trilha sonora' };
  function soAudio(l) { try { return l.hasAudio && !l.hasVideo && !(l.source instanceof CompItem); } catch (e) { return false; } }
  function tipoDoAudio(nome) {
    if (/narra|voz|voice|locu/i.test(nome)) { return 'narracao'; }
    if (/trilha|m[uú]sica|music|track|song|\bbgm\b|soundtrack/i.test(nome)) { return 'trilha'; }
    return 'sfx';
  }
  function compDeAudio(c, tipo, ateSeg) {
    var nome = NOMES_AUDIO[tipo], i, l, sub = null, lp = null;
    for (i = 1; i <= c.numLayers && !sub; i++) { l = c.layer(i); try { if (l.source instanceof CompItem && l.source.name === nome) { sub = l.source; lp = l; } } catch (e) {} }
    if (!sub) {
      sub = app.project.items.addComp(nome, c.width, c.height, c.pixelAspect, c.duration, c.frameRate);
      try { sub.parentFolder = pastaProjeto('Arcano Áudio'); } catch (e1) {}
      lp = c.layers.add(sub); lp.startTime = 0;
      try { lp.moveToEnd(); } catch (e2) {}
    }
    var dur = Math.max(sub.duration, c.duration, Number(ateSeg) || 0);
    if (dur > sub.duration) { sub.duration = dur; }
    try { if (lp.startTime === 0 && lp.outPoint < Math.min(sub.duration, c.duration)) { lp.outPoint = Math.min(sub.duration, c.duration); } } catch (e3) {}
    return sub;
  }
  // camadas de áudio soltas na comp principal (inclusive ocultas/desligadas) vão para a comp certa
  function organizarAudioSolto(c) {
    var i, l, soltas = [];
    for (i = 1; i <= c.numLayers; i++) { l = c.layer(i); if (soAudio(l)) { soltas.push(l); } }
    for (i = 0; i < soltas.length; i++) {
      l = soltas[i];
      var dest = compDeAudio(c, tipoDoAudio(l.name + ' ' + (l.source ? l.source.name : '')), l.outPoint);
      try { l.copyToComp(dest); l.remove(); } catch (e) {}
    }
  }
  // a versão anterior NÃO é apagada (pedido do dono, 1.1.0): vira BACKUP desligado, no fim da pilha da mesma comp
  function arquivarCamadasDeAudio(sub) {
    var i, l, ativas = [];
    for (i = 1; i <= sub.numLayers; i++) { l = sub.layer(i); if (!/^BACKUP · /.test(l.name)) { ativas.push(l); } }
    for (i = 0; i < ativas.length; i++) {
      l = ativas[i];
      try { l.name = 'BACKUP · ' + l.name; } catch (e1) {}
      try { l.audioEnabled = false; } catch (e2) {}
      try { l.moveToEnd(); } catch (e3) {}
    }
  }
  am.organizarAudio = function (compId) {
    return desfazivel('organizar áudio', function () {
      var c; try { c = am.findComp(compId ? 'id:' + compId : null); } catch (e0) { c = am.findComp(); }
      organizarAudioSolto(c);
      return { comp: c.name };
    });
  };

  // Narração / trilha da IA: entra na comp de áudio do tipo, começando em "inicio" (s), no topo.
  // A anterior vira "BACKUP · ..." desligada no fim da mesma comp (um vídeo = uma narração e uma trilha tocando),
  // a menos que "adicionar" venha true.
  am.importarAudioIA = function (compId, caminho, nomeLayer, inicio, tipo, adicionar) {
    return desfazivel('áudio da IA', function () {
      var c, item, l, ini = Number(inicio) || 0, sub;
      try { c = am.findComp(compId ? 'id:' + compId : null); } catch (e0) { c = am.findComp(); }
      tipo = tipo === 'trilha' ? 'trilha' : (tipo === 'narracao' ? 'narracao' : tipoDoAudio(nomeLayer));
      organizarAudioSolto(c);
      item = app.project.importFile(new ImportOptions(new File(caminho)));
      try { item.parentFolder = pastaIA(); } catch (e1) {}
      if (ini < 0) { ini = 0; }
      sub = compDeAudio(c, tipo, ini + item.duration);
      if (!adicionar) { arquivarCamadasDeAudio(sub); }
      l = sub.layers.add(item);
      l.name = nomeLayer;
      l.startTime = ini;
      return { camada: l.name, indice: l.index, comp: sub.name, compId: sub.id, comp_principal: c.name, duracao: item.duration, inicio: l.startTime, comp_duracao: c.duration };
    });
  };

  // ---------- Decompor em camadas (1.2.18): o mesmo motor do Arcano Layers / Separar em camadas do Photoshop ----------
  // Monta as camadas que a IA devolveu numa PRECOMP do tamanho da imagem separada (cada elemento numa camada,
  // no lugar certo, pronta para animar) e põe a precomp no lugar da camada original, que fica DESLIGADA logo
  // abaixo (nunca apagada). frame = true: separou o frame da comp inteira; a precomp cobre a comp.
  // itens: [{arquivo, nome, x, y, w, h}] de baixo (fundo) para cima, em pixels da imagem separada (W x H).
  am.montarCamadasAE = function (compId, indice, nomeCamada, itens, nomeGrupo, W, H, frame) {
    app.beginUndoGroup('Arcano Motion: decompor em camadas');
    var pc = null, arqs = null, v = null;
    try {
      var c, src = null, i, it, ft, l, tr, vt, pos, anc, esc, sx, sy, cx, cy, k, lista = [];
      try { c = am.findComp('id:' + compId); } catch (e0) { c = am.findComp(); }
      if (!frame) {
        if (indice && indice <= c.numLayers && c.layer(indice).name === nomeCamada) { src = c.layer(indice); }
        if (!src && nomeCamada) { try { src = c.layer(nomeCamada); } catch (e1) { src = null; } }
      }
      W = Math.max(4, Math.round(Number(W) || 0)); H = Math.max(4, Math.round(Number(H) || 0));
      var raiz = pastaProjeto('Arcano Camadas');
      pc = app.project.items.addComp(nomeGrupo, W, H, 1, c.duration, c.frameRate);
      pc.parentFolder = raiz;
      arqs = app.project.items.addFolder(nomeGrupo + ' · arquivos'); arqs.parentFolder = raiz;
      for (i = 0; i < itens.length; i++) {
        it = itens[i];
        ft = app.project.importFile(new ImportOptions(new File(it.arquivo)));
        ft.parentFolder = arqs;
        l = pc.layers.add(ft);
        l.name = String(it.nome || ('Camada ' + (i + 1))).substr(0, 100);
        tr = l.property('ADBE Transform Group');
        tr.property('ADBE Anchor Point').setValue([ft.width / 2, ft.height / 2]);
        tr.property('ADBE Position').setValue([Number(it.x) + Number(it.w) / 2, Number(it.y) + Number(it.h) / 2]);
        k = Number(it.w) / ft.width * 100;
        tr.property('ADBE Scale').setValue([k, k]);
        l.startTime = 0; l.inPoint = 0; l.outPoint = pc.duration;
      }
      for (i = 1; i <= pc.numLayers; i++) { lista.push({ id: i, nome: pc.layer(i).name }); }
      v = c.layers.add(pc);
      v.name = nomeGrupo;
      vt = v.property('ADBE Transform Group');
      vt.property('ADBE Anchor Point').setValue([W / 2, H / 2]);
      if (src && src.source && src.source.width) {
        tr = src.property('ADBE Transform Group');
        if (tr.property('ADBE Position').dimensionsSeparated) {
          pos = [tr.property('ADBE Position_0').value, tr.property('ADBE Position_1').value];
          if (src.threeDLayer) { pos.push(tr.property('ADBE Position_2').value); }
        } else { pos = tr.property('ADBE Position').value; }
        anc = tr.property('ADBE Anchor Point').value;
        esc = tr.property('ADBE Scale').value;
        sx = esc[0] / 100; sy = esc[1] / 100;
        cx = pos[0] + (src.source.width / 2 - anc[0]) * sx;
        cy = pos[1] + (src.source.height / 2 - anc[1]) * sy;
        k = src.source.width * Math.abs(sx) / W * 100;
        try { if (src.parent) { v.parent = src.parent; } } catch (e2) {}
        if (src.threeDLayer) { v.threeDLayer = true; vt.property('ADBE Position').setValue([cx, cy, pos.length > 2 ? pos[2] : 0]); }
        else { vt.property('ADBE Position').setValue([cx, cy]); }
        vt.property('ADBE Scale').setValue(v.threeDLayer ? [k, k, 100] : [k, k]);
        try { vt.property('ADBE Rotate Z').setValue(tr.property('ADBE Rotate Z').value); } catch (e3) {}
        try { vt.property('ADBE Opacity').setValue(tr.property('ADBE Opacity').value); } catch (e5) {}
        v.startTime = 0; v.inPoint = src.inPoint; v.outPoint = src.outPoint;
        v.moveBefore(src);
        src.enabled = false;
      } else {
        k = Math.min(c.width / W, c.height / H) * 100;
        vt.property('ADBE Position').setValue([c.width / 2, c.height / 2]);
        vt.property('ADBE Scale').setValue([k, k]);
        v.startTime = 0; v.inPoint = 0; v.outPoint = c.duration;
        v.moveToBeginning();
      }
      app.endUndoGroup();
      return { grupo: pc.name, grupoId: pc.id, camada: v.name, indice: v.index, comp: c.name, compId: c.id, documento: c.name, original: src ? src.name : null, originalIndice: src ? src.index : null, largura: W, altura: H, camadas: lista };
    } catch (e) {
      // não deixa precomp vazia nem pasta pela metade no projeto
      try { if (v) { v.remove(); } } catch (eR1) {}
      try { if (pc) { pc.remove(); } } catch (eR2) {}
      try { if (arqs) { arqs.remove(); } } catch (eR3) {}
      try { app.endUndoGroup(); } catch (e4) {}
      throw e;
    }
  };

  am.importarImagemIA = function (compId, indice, nomeCamada, caminho, nomeLayer) {
    return colocarMidiaIA(compId, indice, nomeCamada, caminho, nomeLayer, true);
  };

  function colocarMidiaIA(compId, indice, nomeCamada, caminho, nomeLayer, imagem) {
    var c, src = null, item, v, tr, vt, pos, anc, esc, sx, sy, cx, cy, k;
    app.beginUndoGroup(imagem ? 'Arcano Motion: imagem da IA' : 'Arcano Motion: vídeo da IA');
    try {
      try { c = am.findComp('id:' + compId); } catch (e0) { c = am.findComp(); }
      if (indice && indice <= c.numLayers && c.layer(indice).name === nomeCamada) { src = c.layer(indice); }
      if (!src && nomeCamada) { try { src = c.layer(nomeCamada); } catch (e1) { src = null; } }
      item = app.project.importFile(new ImportOptions(new File(caminho)));
      item.parentFolder = pastaIA();
      v = c.layers.add(item);
      v.name = nomeLayer;
      try { if (!imagem && v.hasAudio) { v.audioEnabled = false; } } catch (eAu) {}   // vídeo no lugar da imagem: só a imagem
      vt = v.property('ADBE Transform Group');
      vt.property('ADBE Anchor Point').setValue([item.width / 2, item.height / 2]);
      if (src && src.source && src.source.width) {
        tr = src.property('ADBE Transform Group');
        if (tr.property('ADBE Position').dimensionsSeparated) {
          pos = [tr.property('ADBE Position_0').value, tr.property('ADBE Position_1').value];
          if (src.threeDLayer) { pos.push(tr.property('ADBE Position_2').value); }
        } else { pos = tr.property('ADBE Position').value; }
        anc = tr.property('ADBE Anchor Point').value;
        esc = tr.property('ADBE Scale').value;
        sx = esc[0] / 100; sy = esc[1] / 100;
        cx = pos[0] + (src.source.width / 2 - anc[0]) * sx;
        cy = pos[1] + (src.source.height / 2 - anc[1]) * sy;
        k = Math.max(src.source.width * Math.abs(sx) / item.width, src.source.height * Math.abs(sy) / item.height) * 100;
        try { if (src.parent) { v.parent = src.parent; } } catch (e2) {}
        if (src.threeDLayer) { v.threeDLayer = true; vt.property('ADBE Position').setValue([cx, cy, pos.length > 2 ? pos[2] : 0]); }
        else { vt.property('ADBE Position').setValue([cx, cy]); }
        vt.property('ADBE Scale').setValue(v.threeDLayer ? [k, k, 100] : [k, k]);
        try { vt.property('ADBE Rotate Z').setValue(tr.property('ADBE Rotate Z').value); } catch (e3) {}
        if (imagem) { v.startTime = 0; v.inPoint = src.inPoint; v.outPoint = src.outPoint; }
        else { v.startTime = src.inPoint; }
        v.moveBefore(src);
      } else {
        // vídeo do frame: cobre a comp; imagem nova: cabe inteira na comp
        k = (imagem ? Math.min(c.width / item.width, c.height / item.height) : Math.max(c.width / item.width, c.height / item.height)) * 100;
        vt.property('ADBE Position').setValue([c.width / 2, c.height / 2]);
        vt.property('ADBE Scale').setValue([k, k]);
        if (imagem) { v.startTime = 0; v.inPoint = 0; v.outPoint = c.duration; }
        else { v.startTime = c.time; }
        if (src) { v.moveBefore(src); }
      }
      app.endUndoGroup();
      return { camada: v.name, indice: v.index, comp: c.name, duracao: item.duration, largura: item.width, altura: item.height, fps: item.frameRate || null, original: src ? src.name : null, itemId: item.id };
    } catch (e) {
      try { app.endUndoGroup(); } catch (e4) {}
      throw e;
    }
  }

  // =====================================================================
  // v0.7 — FERRAMENTAS DE UM CLIQUE, ANIMAR, CÂMERA, PARALLAX, CURVAS, BIBLIOTECA
  // Tudo vira KEYFRAME editável (expressão só onde não existe outro jeito:
  // contador de texto e loops). Cada ação é UM passo de desfazer.
  // =====================================================================

  function desfazivel(rotulo, fn) {
    app.beginUndoGroup('Arcano Motion: ' + rotulo);
    try {
      var r = fn();
      app.endUndoGroup();
      return r;
    } catch (e) {
      try { app.endUndoGroup(); } catch (e2) {}
      throw e;
    }
  }

  function selecao(c, exigir) {
    var s = c.selectedLayers, l = [], i;
    for (i = 0; i < s.length; i++) { l.push(s[i]); }
    l.sort(function (a, b) { return a.index - b.index; });
    if (exigir && !l.length) { throw new Error('Selecione pelo menos uma camada na timeline.'); }
    return l;
  }

  function T(l) { return l.property('ADBE Transform Group'); }
  function efeitos(l) { return l.property('ADBE Effect Parade'); }

  function ehVisual(l) {
    if (l instanceof CameraLayer || l instanceof LightLayer) { return false; }
    try { if (!l.hasVideo) { return false; } } catch (e) {}
    try { if (l.guideLayer) { return false; } } catch (e2) {}
    return true;
  }

  function nDimsEase(p) {
    var t = p.propertyValueType;
    if (t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL) { return 1; }
    if (t === PropertyValueType.TwoD) { return 2; }
    if (t === PropertyValueType.ThreeD) { return 3; }
    return 1;
  }

  function easeNaChave(p, idx, entrada, saida) {
    var n = nDimsEase(p), a = [], b = [], i;
    entrada = Math.max(0.1, Math.min(100, entrada));
    saida = Math.max(0.1, Math.min(100, saida));
    for (i = 0; i < n; i++) { a.push(new KeyframeEase(0, entrada)); b.push(new KeyframeEase(0, saida)); }
    p.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
    p.setTemporalEaseAtKey(idx, a, b);
  }

  function ehEspacial(p) {
    var t = p.propertyValueType;
    return t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL;
  }

  // lista: [[tempo, valor, easeEntrada, easeSaida], ...]; interp: 'ease' | 'linear' | 'hold'
  function chaves(p, lista, interp) {
    var i, idx, li, tempos = [], valores = [];
    for (i = 0; i < lista.length; i++) { tempos.push(lista[i][0]); valores.push(lista[i][1]); }
    try { p.setValuesAtTimes(tempos, valores); } catch (eV) { for (i = 0; i < lista.length; i++) { p.setValueAtTime(lista[i][0], lista[i][1]); } }
    for (i = 0; i < lista.length; i++) {
      li = lista[i];
      idx = p.nearestKeyIndex(li[0]);
      if (interp === 'linear') {
        p.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
      } else if (interp === 'hold') {
        p.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
      } else {
        easeNaChave(p, idx, li[2] === undefined ? 85 : li[2], li[3] === undefined ? 20 : li[3]);
      }
      if (ehEspacial(p)) {
        try {
          p.setSpatialAutoBezierAtKey(idx, false); p.setSpatialContinuousAtKey(idx, false);
          var z = p.propertyValueType === PropertyValueType.ThreeD_SPATIAL ? [0, 0, 0] : [0, 0];
          p.setSpatialTangentsAtKey(idx, z, z);
        } catch (e) {}
      }
    }
  }

  function mistura(a, b, k) {
    if (a !== null && typeof a === 'object' && a.length !== undefined) {
      var r = [], i;
      for (i = 0; i < a.length; i++) { r.push(a[i] + (b[i] - a[i]) * k); }
      return r;
    }
    return a + (b - a) * k;
  }

  // ---------- curvas (u de 0 a 1) ----------
  var CURVAS = {
    linear: function (u) { return u; },
    ease: function (u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; },
    expo: function (u) { return u >= 1 ? 1 : 1 - Math.pow(2, -10 * u); },
    back: function (u) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
    elastic: function (u) {
      if (u <= 0) { return 0; }
      if (u >= 1) { return 1; }
      return Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
    },
    bounce: function (u) {
      var n1 = 7.5625, d1 = 2.75;
      if (u < 1 / d1) { return n1 * u * u; }
      if (u < 2 / d1) { u -= 1.5 / d1; return n1 * u * u + 0.75; }
      if (u < 2.5 / d1) { u -= 2.25 / d1; return n1 * u * u + 0.9375; }
      u -= 2.625 / d1; return n1 * u * u + 0.984375;
    }
  };

  // anima p de "de" até "para" entre t0 e t0+dur com a curva. Curvas simples viram 2 keyframes com ease;
  // curvas com quique/elástico/overshoot viram keyframes assados (1 por frame, interpolação linear).
  function animarProp(p, t0, dur, de, para, curva, saida, fps) {
    if (curva === 'expo' || curva === 'ease' || curva === 'linear') {
      var infSai = curva === 'expo' ? 15 : (curva === 'ease' ? 25 : 0.1);   // dono (01/11/2026): sempre início rápido e fim suave
      var infEnt = curva === 'expo' ? 90 : (curva === 'ease' ? 85 : 0.1);
      if (saida) { var tmp = infSai; infSai = infEnt; infEnt = tmp; }
      if (curva === 'linear') { chaves(p, [[t0, de], [t0 + dur, para]], 'linear'); }
      else { chaves(p, [[t0, de, 50, infSai], [t0 + dur, para, infEnt, 50]], 'ease'); }
      return;
    }
    var fn = CURVAS[curva] || CURVAS.ease;
    var n = Math.max(2, Math.round(dur * fps)), lista = [], i, u, k;
    for (i = 0; i <= n; i++) {
      u = i / n;
      k = i === 0 ? 0 : (i === n ? 1 : (saida ? 1 - fn(1 - u) : fn(u)));
      lista.push([t0 + dur * u, mistura(de, para, k)]);
    }
    chaves(p, lista, 'linear');
  }

  // Posição com dimensões separadas vira X/Y(/Z) individuais
  function trilhaPosicao(l, t0, dur, de, para, curva, saida, fps) {
    var pos = T(l).property('ADBE Position');
    if (pos.dimensionsSeparated) {
      var nomes = ['ADBE Position_0', 'ADBE Position_1', 'ADBE Position_2'], i;
      for (i = 0; i < de.length && i < 3; i++) {
        if (i === 2 && !l.threeDLayer) { break; }
        if (de[i] !== para[i]) { animarProp(T(l).property(nomes[i]), t0, dur, de[i], para[i], curva, saida, fps); }
      }
      return;
    }
    animarProp(pos, t0, dur, de, para, curva, saida, fps);
  }

  function valorPos(l, t) {
    var pos = T(l).property('ADBE Position');
    if (pos.dimensionsSeparated) {
      var v = [T(l).property('ADBE Position_0').valueAtTime(t, false), T(l).property('ADBE Position_1').valueAtTime(t, false)];
      if (l.threeDLayer) { v.push(T(l).property('ADBE Position_2').valueAtTime(t, false)); }
      return v;
    }
    return pos.valueAtTime(t, false);
  }

  function retanguloCamada(l, t) {
    try { var r = l.sourceRectAtTime(t, false); if (r && r.width > 0) { return r; } } catch (e) {}
    try { return { left: 0, top: 0, width: l.source.width, height: l.source.height }; } catch (e2) {}
    return { left: 0, top: 0, width: 100, height: 100 };
  }

  function efeitoBlur(l) {
    var fx = efeitos(l), i;
    for (i = 1; i <= fx.numProperties; i++) { if (fx.property(i).matchName === 'ADBE Gaussian Blur 2' && fx.property(i).name.indexOf('Arcano') === 0) { return fx.property(i); } }
    var e = fx.addProperty('ADBE Gaussian Blur 2');
    e.name = 'Arcano Blur';
    return e;
  }

  function mascaraCortina(l, t, horizontal) {
    var r = retanguloCamada(l, t);
    var m = l.property('ADBE Mask Parade').addProperty('ADBE Mask Atom');
    m.name = 'Arcano Cortina';
    function forma(k) {
      var s = new Shape(), x0, x1, y0, y1;
      if (horizontal) {
        var cx = r.left + r.width / 2, meia = r.width / 2 * k + 0.01;
        x0 = cx - meia; x1 = cx + meia; y0 = r.top - 2; y1 = r.top + r.height + 2;
      } else {
        var cy = r.top + r.height / 2, meiaV = r.height / 2 * k + 0.01;
        x0 = r.left - 2; x1 = r.left + r.width + 2; y0 = cy - meiaV; y1 = cy + meiaV;
      }
      s.vertices = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      s.closed = true;
      return s;
    }
    return { prop: m.property('ADBE Mask Shape'), fechada: forma(0), aberta: forma(1) };
  }

  // ---------- presets de entrada/saída ----------
  // Cada trilha: [propriedade, deslocamento/valor inicial, curva]
  // propriedades: pos (fração da comp: [dx, dy]), escala (%), rot (graus), opac, rotX, rotY, blur, cortinaH, cortinaV
  var PRESETS = {
    'fade':            { trilhas: [['opac', 0, 'ease']] },
    'subida-suave':    { trilhas: [['pos', [0, 0.06], 'expo'], ['opac', 0, 'ease']] },
    'slide-cima':      { trilhas: [['pos', [0, 0.35], 'expo'], ['opac', 0, 'ease']] },
    'lateral':         { trilhas: [['pos', [-0.3, 0], 'expo'], ['opac', 0, 'ease']] },
    'quique-lateral':  { trilhas: [['pos', [-0.6, 0], 'bounce']] },
    'quique-vertical': { trilhas: [['pos', [0, -0.6], 'bounce']] },
    'escala-elastica': { trilhas: [['escala', 0, 'elastic']] },
    'overshoot':       { trilhas: [['escala', 0, 'back']] },
    'snap':            { trilhas: [['escala', 60, 'expo'], ['opac', 0, 'expo']], dur: 0.35 },
    'zoom-profundo':   { trilhas: [['escala', 400, 'expo'], ['opac', 0, 'ease'], ['blur', 40, 'expo']] },
    'chegada':         { trilhas: [['escala', 160, 'expo'], ['opac', 0, 'ease']] },
    'queda-giro':      { trilhas: [['pos', [0, -0.5], 'back'], ['rot', -180, 'expo']] },
    'giro-baixo':      { trilhas: [['rot', -90, 'back'], ['opac', 0, 'ease']] },
    'virar-x':         { trilhas: [['rotX', 90, 'expo'], ['opac', 0, 'ease']], tresD: true },
    'virar-y':         { trilhas: [['rotY', 90, 'expo'], ['opac', 0, 'ease']], tresD: true },
    'cartao':          { trilhas: [['rotY', -60, 'expo'], ['escala', 70, 'expo'], ['opac', 0, 'ease']], tresD: true },
    'rolo':            { trilhas: [['pos', [-0.6, 0], 'expo'], ['rot', -360, 'expo']] },
    'balanco':         { trilhas: [['rot', -25, 'elastic']], dur: 1.2 },
    'cortina-h':       { trilhas: [['cortinaH', 0, 'expo']] },
    'cortina-v':       { trilhas: [['cortinaV', 0, 'expo']] },
    'desfoque':        { trilhas: [['blur', 60, 'expo'], ['opac', 0, 'ease']] }
  };
  am.PRESETS_ANIMAR = PRESETS;
  // presets que aceitam direção (de onde vem) e os de zoom (in = cresce, out = encolhe)
  var DIRECIONAIS = { 'subida-suave': 0.06, 'slide-cima': 0.35, 'lateral': 0.35, 'quique-lateral': 0.6, 'quique-vertical': 0.6, 'rolo': 0.6 };
  var ZOOMS = { 'zoom-profundo': 1, 'chegada': 1 };
  function vetorDirecao(dir, m) { return ({ baixo: [0, m], cima: [0, -m], esquerda: [-m, 0], direita: [m, 0] })[dir] || null; }

  function aplicarPreset(c, l, id, saida, t0, dur, intensidade, extra) {
    var pr = PRESETS[id], fps = 1 / c.frameDuration, i, tr, tipo, v, curva, base, de, para, prop, k;
    extra = extra || {};
    if (!pr) { throw new Error('Preset desconhecido: ' + id); }
    k = intensidade === undefined ? 1 : intensidade / 100;
    if (pr.tresD && !l.threeDLayer) { l.threeDLayer = true; }
    for (i = 0; i < pr.trilhas.length; i++) {
      tr = pr.trilhas[i]; tipo = tr[0]; v = tr[1]; curva = tr[2];
      if (tipo === 'pos' && extra.direcao && DIRECIONAIS[id] !== undefined) { v = vetorDirecao(extra.direcao, DIRECIONAIS[id]) || v; }
      if (tipo === 'rot' && id === 'rolo' && extra.direcao) { v = (extra.direcao === 'direita' || extra.direcao === 'baixo') ? 360 : -360; }
      if (tipo === 'escala' && ZOOMS[id] && extra.zoom === 'in') { v = 10000 / v; }
      var tBase = saida ? t0 : t0 + dur;
      if (tipo === 'pos') {
        base = valorPos(l, tBase);
        de = base.slice(0);
        de[0] = base[0] + v[0] * c.width * k;
        de[1] = base[1] + v[1] * c.height * k;
        if (saida) { trilhaPosicao(l, t0, dur, base, de, curva, true, fps); } else { trilhaPosicao(l, t0, dur, de, base, curva, false, fps); }
        continue;
      }
      if (tipo === 'cortinaH' || tipo === 'cortinaV') {
        var mc = mascaraCortina(l, tBase, tipo === 'cortinaH');
        if (saida) { animarProp(mc.prop, t0, dur, mc.aberta, mc.fechada, curva === 'expo' ? 'ease' : curva, true, fps); }
        else { animarProp(mc.prop, t0, dur, mc.fechada, mc.aberta, curva === 'expo' ? 'ease' : curva, false, fps); }
        continue;
      }
      if (tipo === 'escala') {
        prop = T(l).property('ADBE Scale'); base = prop.valueAtTime(tBase, false);
        var f = 1 + (v / 100 - 1) * k;
        de = [base[0] * f, base[1] * f, base.length > 2 ? base[2] : 100];
      } else if (tipo === 'opac') {
        prop = T(l).property('ADBE Opacity'); base = prop.valueAtTime(tBase, false); de = Math.max(0, Math.min(100, base * (1 - Math.min(1, k))));
      } else if (tipo === 'rot') {
        prop = T(l).property('ADBE Rotate Z'); base = prop.valueAtTime(tBase, false); de = base + v * k;
      } else if (tipo === 'rotX') {
        prop = T(l).property('ADBE Rotate X'); base = prop.valueAtTime(tBase, false); de = base + v * k;
      } else if (tipo === 'rotY') {
        prop = T(l).property('ADBE Rotate Y'); base = prop.valueAtTime(tBase, false); de = base + v * k;
      } else if (tipo === 'blur') {
        prop = efeitoBlur(l).property(1); base = 0; de = v * k;
      } else { continue; }
      para = base;
      if (saida) { animarProp(prop, t0, dur, para, de, curva, true, fps); } else { animarProp(prop, t0, dur, de, para, curva, false, fps); }
    }
  }

  // opcoes: { modo: 'entrada'|'saida'|'ambos', duracao, escalonamento (frames), intensidade (%) }
  am.animar = function (id, opcoes) {
    opcoes = opcoes || {};
    return desfazivel('Animar ' + id, function () {
      var c0 = am.findComp(), ls0 = selecao(c0, true), m0 = opcoes.modo || 'entrada';
      if (!PRESETS[id]) { throw new Error('Preset desconhecido: ' + id); }
      return comRegistro(c0, 'animar:' + id + ':' + m0, opcoes, ls0, function () { return animarJa(id, opcoes); });
    });
  };
  function animarJa(id, opcoes) {
    {
      var c = am.findComp(), ls = selecao(c, true), i, l, dur, atraso, modo = opcoes.modo || 'entrada';
      var pr = PRESETS[id];
      dur = Number(opcoes.duracao) || pr.dur || 0.6;
      atraso = (Number(opcoes.escalonamento) || 0) * c.frameDuration;
      var pulados = [];
      for (i = 0; i < ls.length; i++) {
        l = ls[i];
        if (!ehVisual(l)) { pulados.push(l.name); continue; }
        // começa na agulha (se ela estiver dentro da camada); "entrada e saída": a saída termina no fim da camada
        var ag = Math.max(l.inPoint, Math.min(c.time, l.outPoint - c.frameDuration - dur)) + i * atraso;
        if (modo === 'entrada' || modo === 'ambos') { aplicarPreset(c, l, id, false, ag, dur, opcoes.intensidade, opcoes); }
        if (modo === 'saida') { aplicarPreset(c, l, id, true, ag, dur, opcoes.intensidade, opcoes); }
        if (modo === 'ambos') { aplicarPreset(c, l, id, true, Math.max(ag + dur, l.outPoint - c.frameDuration - dur - (ls.length - 1 - i) * atraso), dur, opcoes.intensidade, opcoes); }
      }
      return { camadas: ls.length - pulados.length, pulados: pulados };
    }
  }

  // ---------- utilidades de propriedades ----------
  function percorrer(grupo, fn) {
    var i, p;
    for (i = grupo.numProperties; i >= 1; i--) {
      try { p = grupo.property(i); } catch (e) { p = null; }
      if (!p) { continue; }
      if (p.propertyType === PropertyType.PROPERTY) { fn(p); }
      else { percorrer(p, fn); }
    }
  }

  function propsComChaves(c, ls) {
    var lista = [], sp = c.selectedProperties, i;
    for (i = 0; i < sp.length; i++) {
      if (sp[i].propertyType === PropertyType.PROPERTY && sp[i].numKeys > 0) { lista.push(sp[i]); }
    }
    return lista;
  }

  function camadasHierarquia(c, visto, saida) {
    var i, l;
    visto = visto || {}; saida = saida || [];
    if (visto[c.id]) { return saida; }
    visto[c.id] = true;
    for (i = 1; i <= c.numLayers; i++) {
      l = c.layer(i);
      saida.push(l);
      try { if (l.source && l.source instanceof CompItem) { camadasHierarquia(l.source, visto, saida); } } catch (e) {}
    }
    return saida;
  }

  function solido(c, cor, nome) {
    return c.layers.addSolid(cor, nome, c.width, c.height, c.pixelAspect, c.duration);
  }

  function efeitoObrigatorio(l, matchName, nomeAmigavel) {
    var fx = efeitos(l);
    if (!fx.canAddProperty(matchName)) { throw new Error('O efeito ' + nomeAmigavel + ' não está disponível neste After.'); }
    return fx.addProperty(matchName);
  }

  function comandoMenu(nomes) {
    var i, id;
    for (i = 0; i < nomes.length; i++) {
      try { id = app.findMenuCommandId(nomes[i]); } catch (e) { id = 0; }
      if (id > 0) { app.executeCommand(id); return true; }
    }
    return false;
  }

  function semAleatorio(seed) {
    var s = seed || 1;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  // Marcador na comp mostrando onde o efeito começa
  // (antes punha marcador na comp; agora os marcadores ficam na própria camada — ver aplicarTempo)
  function marcadorInicio(c, t, texto) { }

  // ---------- as ferramentas ----------
  var FERR = {};

  FERR['flash'] = function (c, o) {
    var n = Math.max(1, Math.round(o.vezes || 6)), gap = Math.max(1, Math.round(o.intervalo || 1)), t = c.time, fd = c.frameDuration;
    var s = solido(c, [1, 1, 1], 'Flash'), op = T(s).property('ADBE Opacity'), lista = [], i, ton;
    s.moveToBeginning();
    for (i = 0; i < n; i++) {
      ton = t + i * (1 + gap) * fd;
      lista.push([ton, 100]);
      lista.push([ton + fd, 0]);
    }
    chaves(op, lista, 'hold');
    s.inPoint = t;
    s.outPoint = Math.min(c.duration, t + n * (1 + gap) * fd + fd);
    return n + ' flashes a partir de ' + t.toFixed(2) + 's (camada "Flash").';
  };

  // ---------- registro dos efeitos do Arcano na própria camada (fica no comentário da camada) ----------
  var MARCA = '[arcano-motion]';
  function lerRegistro(l) {
    var c = '', i, fx = {};
    try { c = String(l.comment || ''); } catch (e) {}
    i = c.indexOf(MARCA);
    if (i < 0) { return { texto: c, fx: {} }; }
    try { fx = eval('(' + c.substring(i + MARCA.length) + ')') || {}; } catch (e2) { fx = {}; }
    return { texto: c.substring(0, i).replace(/\s+$/, ''), fx: fx };
  }
  function gravarRegistro(l, r) {
    var vazio = true, k;
    for (k in r.fx) { if (r.fx.hasOwnProperty(k)) { vazio = false; break; } }
    try { l.comment = (r.texto ? r.texto + (vazio ? '' : '\n') : '') + (vazio ? '' : MARCA + ser(r.fx)); } catch (e) {}
  }
  function registrar(l, id, o, extra) { var r = lerRegistro(l); r.fx[id] = { o: o, x: extra || {} }; gravarRegistro(l, r); }
  function desregistrar(l, id) { var r = lerRegistro(l); delete r.fx[id]; gravarRegistro(l, r); }
  // efeito pela posição na lista de efeitos da camada (referência nova, válida depois de outros addProperty)
  function efeitoNaPosicao(l, indice) { return efeitos(l).property(indice); }
  function acharEfeitoPorNome(l, nome) {
    var fx = efeitos(l), i;
    for (i = fx.numProperties; i >= 1; i--) { if (fx.property(i).name === nome) { return fx.property(i); } }
    return null;
  }
  function limitar(v, a, b, padrao) { v = Number(v); if (isNaN(v)) { v = padrao; } return Math.max(a, Math.min(b, v)); }
  function apagarChaves(p) { var k; for (k = p.numKeys; k >= 1; k--) { p.removeKey(k); } }

  // Desfaz o que uma ferramenta editável criou nesta camada (para reaplicar com outras opções)
  var REMOVER = {
    'glow': function (l, reg) {
      var op = T(l).property('ADBE Opacity');
      apagarChaves(op);
      if (reg && reg.x && reg.x.op !== undefined) { try { op.setValue(reg.x.op); } catch (e) {} }
    },
    'light-sweep': function (l) { var e = acharEfeitoPorNome(l, 'Arcano Light Sweep'); if (e) { e.remove(); } },
    'turbulencia': function (l) { var e = acharEfeitoPorNome(l, 'Arcano Turbulência'); if (e) { e.remove(); } },
    'cascata': function (l, reg) {
      var c = l.containingComp, i, nomes = (reg && reg.x && reg.x.copias) || [], q;
      for (q = 0; q < nomes.length; q++) { for (i = c.numLayers; i >= 1; i--) { if (c.layer(i).name === nomes[q]) { c.layer(i).remove(); break; } } }
    },
    'batida': function (l, reg) {
      var p = T(l).property(reg && reg.x && reg.x.prop === 'opacidade' ? 'ADBE Opacity' : 'ADBE Scale');
      apagarChaves(p);
      if (reg && reg.x && reg.x.base !== undefined) { try { p.setValue(reg.x.base); } catch (e) {} }
    },
    'textura': function (l, reg) {
      var p = T(l).property('ADBE Scale');
      try { p.expression = ''; } catch (eX) {}
      apagarChaves(p);
      if (reg && reg.x && reg.x.esc) { try { p.setValue(reg.x.esc); } catch (e) {} }
    },
    'flicker': function (l, reg) {
      var op = T(l).property('ADBE Opacity');
      apagarChaves(op);
      if (reg && reg.x && reg.x.op !== undefined) { try { op.setValue(reg.x.op); } catch (e) {} }
    },
    'glitch': function (l) {
      var nomes = ['Arcano Glitch fatias', 'Arcano Glitch tremida', 'Arcano Glitch cor'], i, e;
      for (i = 0; i < nomes.length; i++) { e = acharEfeitoPorNome(l, nomes[i]); if (e) { e.remove(); } }
    },
    'deriva': function (l, reg) {
      var p = T(l).property('ADBE Position');
      apagarChaves(p);
      if (reg && reg.x && reg.x.pos) { try { p.setValue(reg.x.pos); } catch (e) {} }
    },
    'perde-foco': function (l, reg) { tirarChavesPerdeFoco(l.containingComp, reg); },
    'pontos-foco': function (l, reg) {
      var c = l.containingComp, r = acharCamera(c), t = reg && reg.x ? reg.x.t : 0, ps = [T(l).property('ADBE Position')], k, j;
      if (r.cam) { var op = r.cam.property('ADBE Camera Options Group'); ps.push(op.property('ADBE Camera Aperture')); ps.push(op.property('ADBE Camera Focus Distance')); }
      for (j = 0; j < ps.length; j++) { try { for (k = ps[j].numKeys; k >= 1; k--) { if (ps[j].keyTime(k) >= t - 0.0001) { ps[j].removeKey(k); } } } catch (e) {} }
      // sem chaves sobrando: a câmera volta ao enquadramento do flyer todo
      try { if (!ps[0].numKeys && reg.x.repouso) { ps[0].setValue(reg.x.repouso); } } catch (e2) {}
    },
    'contador': function (l) { var e = acharEfeitoPorNome(l, 'Contador'); if (e) { e.remove(); } try { l.property('ADBE Text Properties').property('ADBE Text Document').expression = ''; } catch (x) {} }
  };
  function limparAnterior(l, id) {
    var r = lerRegistro(l);
    if (r.fx[id] && REMOVER[id]) { REMOVER[id](l, r.fx[id]); }
    return r.fx[id] || null;
  }

  // propriedade numérica de um efeito: tenta pelos nomes (inglês/português) e cai no índice
  function paramEfeito(e, nomes, indice) {
    var i, p;
    for (i = 0; i < nomes.length; i++) { try { p = e.property(nomes[i]); if (p) { return p; } } catch (x) {} }
    try { return e.property(indice); } catch (x2) { return null; }
  }

  FERR['light-sweep'] = function (c, o, ls) {
    var vel = limitar(o.velocidade, 0.1, 20, 1), inten = limitar(o.intensidade, 0, 200, 60), larg = limitar(o.largura, 1, 500, 50);
    var repetir = !!o.repetir, intervalo = limitar(o.intervalo, 0, 60, 1.5), dir = o.direcao === 'dir-esq';
    var i, l, e, centro, r, ok = 0, t;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      limparAnterior(l, 'light-sweep');
      e = efeitoObrigatorio(l, 'CC Light Sweep', 'CC Light Sweep');
      try { e.name = 'Arcano Light Sweep'; } catch (eN) {}
      centro = e.property(1);
      if (centro.propertyValueType !== PropertyValueType.TwoD_SPATIAL && centro.propertyValueType !== PropertyValueType.TwoD) { continue; }
      var pW = paramEfeito(e, ['Width', 'Largura'], 4), pI = paramEfeito(e, ['Sweep Intensity', 'Intensidade da varredura'], 5);
      try { if (pW && pW.propertyValueType === PropertyValueType.OneD) { pW.setValue(larg); } } catch (e1) {}
      try { if (pI && pI.propertyValueType === PropertyValueType.OneD) { pI.setValue(inten); } } catch (e2) {}
      t = Math.max(l.inPoint, c.time);
      r = retanguloCamada(l, t);
      var y = r.top + r.height / 2, x0 = r.left - r.width * 0.3, x1 = r.left + r.width * 1.3;
      if (dir) { var tmp = x0; x0 = x1; x1 = tmp; }
      var fim = repetir ? l.outPoint : t + vel, ciclo = vel + intervalo, lista = [], k = 0, tt;
      for (tt = t; tt < fim - 0.001 && k < 400; tt += ciclo, k++) { lista.push([tt, [x0, y]]); lista.push([Math.min(tt + vel, fim), [x1, y]]); if (!repetir) { break; } }
      chaves(centro, lista, 'linear');
      // segura no fim de cada passada e volta "escondido" para o começo
      var q;
      for (q = 1; q <= centro.numKeys; q++) {
        if (q % 2 === 0) { centro.setInterpolationTypeAtKey(q, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.HOLD); }
        else { easeNaChave(centro, q, 33, 33); }
      }
      registrar(l, 'light-sweep', { velocidade: vel, intensidade: inten, largura: larg, repetir: repetir, intervalo: intervalo, direcao: dir ? 'dir-esq' : 'esq-dir' });
      ok++;
    }
    if (!ok) { throw new Error('Nenhuma camada visual selecionada.'); }
    return 'Light Sweep em ' + ok + ' camada(s)' + (repetir ? ', repetindo até o fim da camada' : '') + '.';
  };

  // Glow = a luz "respira": a opacidade sobe e desce em loop suave até o fim da camada
  FERR['glow'] = function (c, o, ls) {
    var inten = limitar(o.intensidade, 5, 100, 60), vel = limitar(o.velocidade, 0.05, 10, 1);
    var meio = 1 / vel / 2, i, l, op, base, minimo, lista, t, alto, n = 0, reg;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      op = T(l).property('ADBE Opacity');
      reg = lerRegistro(l).fx.glow;
      if (!reg && op.numKeys > 0) { throw new Error('A camada "' + l.name + '" já tem keyframes de opacidade. Apague-os antes de aplicar o Glow.'); }
      base = reg && reg.x && reg.x.op !== undefined ? reg.x.op : op.value;
      limparAnterior(l, 'glow');
      minimo = base * (1 - inten / 100);
      lista = []; alto = true;
      for (t = l.inPoint; t <= l.outPoint + 0.0001 && lista.length < 3000; t += meio) { lista.push([t, alto ? base : minimo, 50, 50]); alto = !alto; }
      if (lista.length < 2) { lista.push([l.outPoint, minimo, 50, 50]); }
      chaves(op, lista, 'ease');
      registrar(l, 'glow', { intensidade: inten, velocidade: vel }, { op: base });
      n++;
    }
    if (!n) { throw new Error('Nenhuma camada visual selecionada.'); }
    return 'Glow pulsando em ' + n + ' camada(s): ' + vel + ' pulso(s) por segundo, varia ' + inten + '% da opacidade.';
  };

  // Flicker: a opacidade pisca como lâmpada com mau contato
  // Animar textura (1.2.19, pedido do dono): SÓ escala. A textura espelha em ciclo (100,100 → 100,-100 → -100,100 →
  // -100,-100) com keyframes de parada e loopOut("cycle"): parece que mexe de lugar, sem IA e sem créditos.
  // velocidade = trocas por segundo. Mantém o tamanho que a camada já tinha (só troca os sinais).
  FERR['textura'] = function (c, o, ls) {
    var vel = limitar(o.velocidade, 1, 30, 8), fd = c.frameDuration, d = Math.max(fd, Math.round((1 / vel) / fd) * fd), i, l, p, base, reg, n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      p = T(l).property('ADBE Scale');
      reg = lerRegistro(l).fx.textura;
      if (!reg && (p.numKeys > 0 || p.expressionEnabled)) { throw new Error('A camada "' + l.name + '" já tem keyframes ou expressão na escala. Apague antes do Animar textura.'); }
      base = reg && reg.x && reg.x.esc ? reg.x.esc : p.value;
      limparAnterior(l, 'textura');
      var sx = Math.abs(base[0]), sy = Math.abs(base[1]), z = base.length > 2 ? [base[2]] : [];
      var seq = [[sx, sy], [sx, -sy], [-sx, sy], [-sx, -sy], [sx, sy]], lista = [], k, t0 = l.inPoint;
      for (k = 0; k < seq.length; k++) { lista.push([t0 + k * d, seq[k].concat(z)]); }
      chaves(p, lista, 'hold');
      p.expression = 'loopOut("cycle")';
      registrar(l, 'textura', { velocidade: vel }, { esc: base });
      n++;
    }
    if (!n) { throw new Error('Nenhuma camada visual selecionada.'); }
    return 'Animar textura em ' + n + ' camada(s): a escala troca ' + vel + ' vez(es) por segundo, em loop até o fim da camada.';
  };

  FERR['flicker'] = function (c, o, ls) {
    var inten = limitar(o.intensidade, 5, 100, 80), vel = limitar(o.velocidade, 0.5, 30, 8), alea = limitar(o.aleatoriedade, 0, 100, 60) / 100;
    var estilo = o.estilo || 'lampada', trecho = o.trecho === 'agulha' ? 'agulha' : 'camada', durT = limitar(o.duracao, 0.1, 600, 2);
    var semente = Math.round(limitar(o.semente, 1, 9999, 7)), i, l, op, base, n = 0, reg;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      op = T(l).property('ADBE Opacity');
      reg = lerRegistro(l).fx.flicker;
      if (!reg && op.numKeys > 0) { throw new Error('A camada "' + l.name + '" já tem keyframes de opacidade. Apague-os antes do Flicker.'); }
      base = reg && reg.x && reg.x.op !== undefined ? reg.x.op : op.value;
      limparAnterior(l, 'flicker');
      var rnd = semAleatorio(semente + i * 31), t0 = trecho === 'agulha' ? Math.max(l.inPoint, c.time) : l.inPoint;
      var t1 = trecho === 'agulha' ? Math.min(l.outPoint, t0 + durT) : l.outPoint, fd = c.frameDuration, passo = 1 / vel;
      var lista = [], t = t0, apagado, calmo = 0, minimo = base * (1 - inten / 100);
      while (t < t1 && lista.length < 4000) {
        if (estilo === 'lampada' && calmo <= 0 && rnd() < 0.25) { calmo = 0.3 + rnd() * 1.2; }   // fica ligado um tempo e depois falha de novo
        if (calmo > 0) { lista.push([t, base]); t += Math.min(calmo, t1 - t); calmo = 0; continue; }
        apagado = estilo === 'constante' ? (lista.length % 2 === 1) : (rnd() < 0.5);
        var v = apagado ? minimo + (base - minimo) * rnd() * alea * 0.5 : base - (base - minimo) * rnd() * alea * 0.3;
        lista.push([t, Math.max(0, Math.min(100, v))]);
        var p2 = estilo === 'constante' ? passo / 2 : passo * (1 - alea * 0.8 + rnd() * alea * 1.6) / 2;
        t += Math.max(fd, Math.round(p2 / fd) * fd);
      }
      lista.push([t1, base]);
      chaves(op, lista, estilo === 'suave' ? 'linear' : 'hold');
      registrar(l, 'flicker', { intensidade: inten, velocidade: vel, estilo: estilo }, { op: base });
      n++;
    }
    if (!n) { throw new Error('Nenhuma camada visual selecionada.'); }
    return 'Flicker em ' + n + ' camada(s)' + (trecho === 'agulha' ? ' por ' + durT + 's a partir da agulha' : ' até o fim da camada') + '.';
  };

  // Glitch: rajadas de fatias deslocadas, tremida e piscada de cor (keyframes HOLD, tudo editável)
  FERR['glitch'] = function (c, o, ls) {
    var inten = limitar(o.intensidade, 1, 100, 50) / 100, vel = limitar(o.velocidade, 0.1, 20, 1.5), durRaj = Math.round(limitar(o.rajada, 1, 60, 6));
    var est = o.estilo || 'completo';
    var fatias = o.fatias !== undefined ? !!o.fatias : (est === 'completo' || est === 'fatias');
    var tremer = o.tremer !== undefined ? !!o.tremer : (est === 'completo' || est === 'tremida');
    var cor = o.cor !== undefined ? !!o.cor : (est === 'completo' || est === 'cor');
    var trecho = o.trecho === 'agulha' ? 'agulha' : 'camada', durT = limitar(o.duracao, 0.1, 600, 2), semente = Math.round(limitar(o.semente, 1, 9999, 3));
    var i, l, n = 0, fd = c.frameDuration;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      limparAnterior(l, 'glitch');
      var rnd = semAleatorio(semente + i * 17), t0 = trecho === 'agulha' ? Math.max(l.inPoint, c.time) : l.inPoint;
      var t1 = trecho === 'agulha' ? Math.min(l.outPoint, t0 + durT) : l.outPoint;
      var r = retanguloCamada(l, t0), w = r.width || c.width, h = r.height || c.height;
      // momentos de glitch: rajadas espalhadas no trecho
      var rajadas = [], t = t0 + rnd() / vel * 0.5;
      while (t < t1 && rajadas.length < 600) { rajadas.push(t); t += (0.4 + rnd() * 1.2) / vel; }
      if (trecho === 'agulha' && !rajadas.length) { rajadas.push(t0); }
      var eT = null, eO = null, eI = null, iT = 0, iO = 0, iI = 0, lT = [], lA = [], lO = [], lI = [], k, q, f;
      if (fatias) {
        eT = efeitoObrigatorio(l, 'ADBE Turbulent Displace', 'Turbulent Displace'); iT = eT.propertyIndex; try { eT.name = 'Arcano Glitch fatias'; } catch (x1) {}
        try { eT.property(1).setValue(8); } catch (x2) {}       // deslocamento horizontal
        try { eT.property(3).setValue(Math.max(4, h / 12)); eT.property(5).setValue(1); } catch (x3) {}
      }
      if (tremer) { eO = efeitoObrigatorio(l, 'ADBE Offset', 'Offset'); iO = eO.propertyIndex; try { eO.name = 'Arcano Glitch tremida'; } catch (x4) {} }
      if (cor) {
        eI = efeitoObrigatorio(l, 'ADBE Invert', 'Invert'); iI = eI.propertyIndex; try { eI.name = 'Arcano Glitch cor'; } catch (x5) {}
      }
      // No After, adicionar um efeito INVALIDA as referências aos efeitos adicionados antes na mesma
      // camada ("O objeto é inválido"). Pega os três de novo pela posição depois de adicionar todos.
      eT = iT ? efeitoNaPosicao(l, iT) : null; eO = iO ? efeitoNaPosicao(l, iO) : null; eI = iI ? efeitoNaPosicao(l, iI) : null;
      var centro = [w / 2, h / 2];
      if (r.left !== undefined) { try { centro = [r.left + w / 2, r.top + h / 2]; } catch (x6) {} }
      lT.push([t0, 0]); lA.push([t0, 0]); lO.push([t0, centro]); lI.push([t0, 100]);
      for (k = 0; k < rajadas.length; k++) {
        var tr = rajadas[k], fim = tr + durRaj * fd;
        for (q = 0; q < durRaj; q++) {
          f = tr + q * fd;
          if (f >= t1) { break; }
          var forte = rnd() < 0.7;
          lT.push([f, forte ? 40 + 160 * inten * rnd() : 0]);
          lA.push([f, rnd() * 360]);
          lO.push([f, [centro[0] + (rnd() - 0.5) * w * 0.12 * inten * (forte ? 1 : 0.3), centro[1] + (rnd() < 0.2 ? (rnd() - 0.5) * h * 0.05 * inten : 0)]]);
          lI.push([f, rnd() < 0.25 * inten + 0.05 ? 100 - 100 * inten * (0.5 + rnd() * 0.5) : 100]);
        }
        if (fim < t1) { lT.push([fim, 0]); lO.push([fim, centro]); lI.push([fim, 100]); }
      }
      if (eT) { chaves(eT.property(2), lT, 'hold'); try { chaves(eT.property(6), lA, 'hold'); } catch (x7) {} }
      if (eO) { chaves(eO.property(1), lO, 'hold'); }
      if (eI) { var mist = paramEfeito(eI, ['Blend With Original', 'Misturar com o original'], 2); if (mist) { chaves(mist, lI, 'hold'); } }
      registrar(l, 'glitch', { intensidade: Math.round(inten * 100), velocidade: vel, estilo: est });
      n++;
    }
    if (!n) { throw new Error('Nenhuma camada visual selecionada.'); }
    return 'Glitch em ' + n + ' camada(s)' + (trecho === 'agulha' ? ' por ' + durT + 's a partir da agulha' : ' até o fim da camada') + '.';
  };

  // procura um controle do efeito pelo nome (em qualquer grupo), sem diferenciar maiúsculas
  function acharControle(grupo, nomes, prof) {
    var i, p, k;
    if ((prof || 0) > 4) { return null; }
    for (i = 1; i <= grupo.numProperties; i++) {
      try {
        p = grupo.property(i);
        for (k = 0; k < nomes.length; k++) { if (String(p.name).toLowerCase() === nomes[k].toLowerCase()) { return p; } }
        if (p.numProperties) { var f = acharControle(p, nomes, (prof || 0) + 1); if (f) { return f; } }
      } catch (e) {}
    }
    return null;
  }
  function hexParaCor(h) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h || ''));
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255, 1] : null;
  }
  FERR['chroma'] = function (c, o, ls) {
    var i, l, e, n = 0, faltou = {}, cor = hexParaCor(o.cor) || [0, 177 / 255, 64 / 255, 1];
    // controles básicos do Keylight (nomes do próprio Keylight, que fica em inglês)
    var ajustes = [
      [['Screen Colour', 'Screen Color'], cor, 'cor do fundo'],
      [['Screen Gain'], limitar(o.forca, 0, 200, 100), 'força'],
      [['Screen Balance'], limitar(o.equilibrio, 0, 100, 50), 'equilíbrio'],
      [['Clip Black'], limitar(o.limparFundo, 0, 100, 0), 'limpar o fundo'],
      [['Clip White'], 100 - limitar(o.firmar, 0, 100, 0), 'firmar o recorte'],
      [['Screen Shrink/Grow'], limitar(o.bordas, -20, 20, 0), 'bordas'],
      [['Screen Softness'], limitar(o.suavizar, 0, 50, 0), 'suavizar bordas']
    ];
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      e = efeitoObrigatorio(l, 'Keylight 906', 'Keylight');
      try { e.name = 'Arcano Chroma'; } catch (eN) {}
      for (var k = 0; k < ajustes.length; k++) {
        var p = acharControle(e, ajustes[k][0]);
        if (!p) { faltou[ajustes[k][2]] = 1; continue; }
        try { p.setValue(ajustes[k][1]); } catch (eS) { faltou[ajustes[k][2]] = 1; }
      }
      // ver a máscara (preto e branco) para ajustar, ou o resultado final
      var vw = acharControle(e, ['View']);
      if (vw) { try { vw.setValue(o.ver === 'mascara' ? 5 : 11); } catch (eV) {} }
      n++;
    }
    if (!n) { throw new Error('Nenhuma camada visual selecionada.'); }
    var lf = []; for (var f in faltou) { if (faltou.hasOwnProperty(f)) { lf.push(f); } }
    return 'Chroma key (Keylight) em ' + n + ' camada(s)' + (o.ver === 'mascara' ? ', mostrando a máscara (branco fica, preto sai). Volte para "Resultado final" quando terminar.' : '.') +
      (lf.length ? ' Não achei no Keylight deste After: ' + lf.join(', ') + ' (ajuste no Effect Controls).' : '');
  };

  FERR['turbulencia'] = function (c, o, ls) {
    var i, l, e, amount, evol, tam, t0, t1, forca = limitar(o.amplitude !== undefined ? o.amplitude : o.forca, 1, 500, 30), vel = limitar(o.velocidade, 0.05, 20, 1), tamanho = limitar(o.tamanho, 2, 1000, 100), n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      limparAnterior(l, 'turbulencia');
      e = efeitoObrigatorio(l, 'ADBE Turbulent Displace', 'Turbulent Displace');
      try { e.name = 'Arcano Turbulência'; } catch (eN) {}
      amount = e.property(2); tam = e.property(3); evol = e.property(6);
      if (!amount || !evol || amount.propertyValueType !== PropertyValueType.OneD || evol.propertyValueType !== PropertyValueType.OneD) {
        throw new Error('Não reconheci os controles do Turbulent Displace nesta versão do After.');
      }
      t0 = l.inPoint; t1 = l.outPoint;
      amount.setValue(forca);
      try { if (tam && tam.propertyValueType === PropertyValueType.OneD) { tam.setValue(tamanho); } } catch (eT) {}
      chaves(evol, [[t0, 0], [t1, 360 * vel * (t1 - t0)]], 'linear');
      if (o.modo === 'pulsos') {
        var lista = [], t, alto = true, passo = 0.5 / Math.max(0.2, vel);
        for (t = t0; t <= t1 && lista.length < 3000; t += passo) { lista.push([t, alto ? forca : forca * 0.15, 60, 60]); alto = !alto; }
        chaves(amount, lista, 'ease');
      }
      registrar(l, 'turbulencia', { modo: o.modo === 'pulsos' ? 'pulsos' : 'fluida', amplitude: forca, velocidade: vel, tamanho: tamanho });
      n++;
    }
    if (!n) { throw new Error('Nenhuma camada visual selecionada.'); }
    return 'Turbulência ' + (o.modo === 'pulsos' ? 'em pulsos' : 'fluida') + ' em ' + n + ' camada(s).';
  };

  FERR['inverter'] = function (c) {
    var props = propsComChaves(c), i, j, p, sel, info, tmin, tmax, total = 0;
    if (!props.length) { throw new Error('Selecione os keyframes que quer inverter (na timeline).'); }
    for (i = 0; i < props.length; i++) {
      p = props[i]; sel = p.selectedKeys;
      if (!sel || sel.length < 2) { continue; }
      info = [];
      for (j = 0; j < sel.length; j++) {
        var k = sel[j], d = { t: p.keyTime(k), v: p.keyValue(k), ii: p.keyInInterpolationType(k), oi: p.keyOutInterpolationType(k) };
        try { d.ie = p.keyInTemporalEase(k); d.oe = p.keyOutTemporalEase(k); } catch (e1) {}
        if (ehEspacial(p)) { try { d.it = p.keyInSpatialTangent(k); d.ot = p.keyOutSpatialTangent(k); } catch (e2) {} }
        info.push(d);
      }
      tmin = info[0].t; tmax = info[info.length - 1].t;
      for (j = sel.length - 1; j >= 0; j--) { p.removeKey(sel[j]); }
      for (j = 0; j < info.length; j++) {
        var nt = tmin + tmax - info[j].t, idx = p.addKey(nt);
        p.setValueAtKey(idx, info[j].v);
      }
      for (j = 0; j < info.length; j++) {
        var id2 = p.nearestKeyIndex(tmin + tmax - info[j].t);
        try { p.setInterpolationTypeAtKey(id2, info[j].oi, info[j].ii); } catch (e3) {}
        try { if (info[j].ie) { p.setTemporalEaseAtKey(id2, info[j].oe, info[j].ie); } } catch (e4) {}
        try { if (info[j].it) { p.setSpatialTangentsAtKey(id2, info[j].ot, info[j].it); } } catch (e5) {}
      }
      total += info.length;
    }
    return total + ' keyframes invertidos no tempo.';
  };

  FERR['escala-in'] = function (c, o, ls) {
    var i, l, p, base, dur = Number(o.duracao) || 0.5, n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      p = T(l).property('ADBE Scale'); base = p.valueAtTime(l.inPoint + dur, false);
      animarProp(p, l.inPoint, dur, [0, 0, base[2]], base, o.curva || 'back', false, 1 / c.frameDuration); n++;
    }
    return 'Escala 0 → 100 na entrada de ' + n + ' camada(s).';
  };

  FERR['escala-out'] = function (c, o, ls) {
    var i, l, p, base, dur = Number(o.duracao) || 0.5, n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      p = T(l).property('ADBE Scale'); base = p.valueAtTime(l.outPoint - dur, false);
      animarProp(p, l.outPoint - dur, dur, base, [0, 0, base[2]], o.curva || 'back', true, 1 / c.frameDuration); n++;
    }
    return 'Escala 100 → 0 na saída de ' + n + ' camada(s).';
  };

  FERR['slide'] = function (c, o, ls) {
    var mapa = { esquerda: [-0.6, 0], direita: [0.6, 0], cima: [0, -0.6], baixo: [0, 0.6] };
    var dir = mapa[o.direcao] || mapa.baixo, curva = o.curva || 'expo', dur = Number(o.duracao) || 0.7, i, l, base, de, fps = 1 / c.frameDuration, n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      base = valorPos(l, l.inPoint + dur); de = base.slice(0);
      de[0] += dir[0] * c.width; de[1] += dir[1] * c.height;
      trilhaPosicao(l, l.inPoint, dur, de, base, curva, false, fps); n++;
    }
    return 'Slide (' + (o.direcao || 'baixo') + ', ' + curva + ') em ' + n + ' camada(s).';
  };

  FERR['sequencia'] = function (c, o, ls) {
    if (ls.length < 2) { throw new Error('Selecione 2 ou mais camadas para escalonar.'); }
    var gap = (Number(o.frames) || 1) * c.frameDuration, lista = ls.slice(0), i, inicio;
    if (o.inverso) { lista.reverse(); }
    inicio = lista[0].inPoint;
    for (i = 0; i < lista.length; i++) { lista[i].startTime += (inicio + i * gap) - lista[i].inPoint; }
    return lista.length + ' camadas escalonadas a cada ' + (Number(o.frames) || 1) + ' frame(s)' + (o.inverso ? ' (de baixo para cima).' : '.');
  };

  FERR['ancora-centro'] = function (c, o, ls) {
    var i, l, r, anc, pos, esc, nova, dx, dy, rad, n = 0, k, pulou = 0, noComp = o.alvo !== 'camada';
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      anc = T(l).property('ADBE Anchor Point'); pos = T(l).property('ADBE Position');
      if (anc.numKeys > 0 || anc.expression || pos.dimensionsSeparated || pos.expression) { pulou++; continue; }
      var a = anc.value;
      esc = T(l).property('ADBE Scale').value;
      rad = (T(l).property('ADBE Rotate Z').value || 0) * Math.PI / 180;
      if (noComp) {
        // ponto da camada que cai no centro da composição (desfaz posição, rotação e escala)
        var p = pos.valueAtTime(c.time, false), cx = c.width / 2 - p[0], cy = c.height / 2 - p[1];
        if (l.parent) { pulou++; continue; }
        var ux = cx * Math.cos(-rad) - cy * Math.sin(-rad), uy = cx * Math.sin(-rad) + cy * Math.cos(-rad);
        nova = [a[0] + ux / ((esc[0] || 100) / 100), a[1] + uy / ((esc[1] || 100) / 100)];
      } else {
        r = retanguloCamada(l, c.time);
        nova = [r.left + r.width / 2, r.top + r.height / 2];
      }
      var lx = (nova[0] - a[0]) * esc[0] / 100, ly = (nova[1] - a[1]) * esc[1] / 100;
      dx = lx * Math.cos(rad) - ly * Math.sin(rad); dy = lx * Math.sin(rad) + ly * Math.cos(rad);
      if (pos.numKeys > 0) { for (k = 1; k <= pos.numKeys; k++) { var pv = pos.keyValue(k); pv[0] += dx; pv[1] += dy; pos.setValueAtKey(k, pv); } }
      else { var p0 = pos.value; p0[0] += dx; p0[1] += dy; pos.setValue(p0); }
      anc.setValue(a.length > 2 ? [nova[0], nova[1], a[2]] : nova);
      n++;
    }
    if (!n && pulou) { throw new Error('Não deu para mover a âncora: a camada tem âncora/posição com keyframes, expressão, dimensões separadas ou está ligada a um parent.'); }
    return 'Âncora no centro da ' + (noComp ? 'composição "' + c.name + '"' : 'camada') + ' em ' + n + ' camada(s), sem sair do lugar.' + (pulou ? ' ' + pulou + ' camada(s) puladas.' : '');
  };


  FERR['ativar-3d'] = function (c) {
    var n = 0, visto = {};
    // só desce nas precomps que já estão com Collapse (as outras ficam como um plano só)
    (function marcar(comp) {
      var i, l;
      if (visto[comp.id]) { return; }
      visto[comp.id] = true;
      for (i = 1; i <= comp.numLayers; i++) {
        l = comp.layer(i);
        if (!ehVisual(l)) { continue; }
        try { if (!l.threeDLayer) { l.threeDLayer = true; n++; } } catch (e) {}
        try { if (l.source instanceof CompItem && l.collapseTransformation) { marcar(l.source); } } catch (e2) {}
      }
    })(c);
    return '3D ligado em ' + n + ' camada(s). O Collapse das precomps ficou como estava (ligar à força estraga luzes e texturas do PSD).';
  };

  FERR['rotacao-y'] = function (c, o, ls) {
    // sempre voltas inteiras e sempre termina de frente (múltiplo de 360°), mesmo se a camada já estava girada
    var voltas = Math.max(1, Math.round(limitar(o.voltas, 1, 50, 2))), dur = limitar(o.duracao, 0.1, 60, 2), sinal = o.sentido === 'anti-horario' ? -1 : 1;
    var curva = o.curva || 'termina-devagar', ini = c.time, i, l, p, b, t0, n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      l.threeDLayer = true;
      t0 = Math.max(l.inPoint, Math.min(ini, l.outPoint));
      p = T(l).property('ADBE Rotate Y'); b = p.valueAtTime(t0, false);
      var fimY = (sinal > 0 ? Math.round(b / 360 + voltas) : Math.round(b / 360 - voltas)) * 360;
      // influência do ease: [sai do 1º keyframe, chega no último]
      var inf = { suave: [70, 70], forte: [95, 95], 'comeca-devagar': [85, 0.1], 'termina-devagar': [0.1, 85], rapido: [15, 90] }[curva] || [70, 70];
      if (curva === 'linear') { chaves(p, [[t0, b], [t0 + dur, fimY]], 'linear'); }
      else { chaves(p, [[t0, b, 50, inf[0]], [t0 + dur, fimY, inf[1], 50]], 'ease'); }
      n++;
    }
    marcadorInicio(c, ini, 'Início: Giro Y');
    return 'Giro Y de ' + (360 * voltas) + '° em ' + n + ' camada(s), começando em ' + ini.toFixed(2) + 's. Arraste os marcadores Início/Fim da camada para mudar o tempo.';
  };


  FERR['z-entrada'] = function (c, o, ls) {
    var dist = Number(o.distancia) || 2500, dur = Number(o.duracao) || 0.8, i, l, b, de, n = 0, fps = 1 / c.frameDuration;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      l.threeDLayer = true;
      b = valorPos(l, l.inPoint + dur); if (b.length < 3) { b.push(0); }
      de = [b[0], b[1], b[2] + dist];
      trilhaPosicao(l, l.inPoint, dur, de, b, 'expo', false, fps);
      animarProp(T(l).property('ADBE Opacity'), l.inPoint, dur * 0.6, 0, T(l).property('ADBE Opacity').valueAtTime(l.inPoint + dur, false), 'ease', false, fps);
      n++;
    }
    return 'Entrada pelo eixo Z em ' + n + ' camada(s).';
  };

  FERR['z-saida'] = function (c, o, ls) {
    var dist = Number(o.distancia) || 900, dur = Number(o.duracao) || 0.8, i, l, b, para, t0, n = 0, fps = 1 / c.frameDuration;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      l.threeDLayer = true; t0 = l.outPoint - dur;
      b = valorPos(l, t0); if (b.length < 3) { b.push(0); }
      para = [b[0], b[1], b[2] - dist];
      trilhaPosicao(l, t0, dur, b, para, 'expo', true, fps);
      animarProp(T(l).property('ADBE Opacity'), l.outPoint - dur * 0.5, dur * 0.5, T(l).property('ADBE Opacity').valueAtTime(t0, false), 0, 'ease', true, fps);
      n++;
    }
    return 'Saída pelo eixo Z em ' + n + ' camada(s).';
  };

  FERR['rotacao-infinita'] = function (c, o, ls) {
    var vel = (Number(o.velocidade) || 30) * (o.sentido === 'anti-horario' ? -1 : 1), i, l, p, b, n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      p = T(l).property('ADBE Rotate Z'); b = p.valueAtTime(l.inPoint, false);
      chaves(p, [[l.inPoint, b], [l.outPoint, b + vel * (l.outPoint - l.inPoint)]], 'linear'); n++;
    }
    return 'Rotação contínua de ' + Math.abs(vel) + '°/s em ' + n + ' camada(s) (até o fim da camada).';
  };

  FERR['pendulo'] = function (c, o, ls) {
    var ang = limitar(o.amplitude !== undefined ? o.amplitude : o.angulo, 1, 90, 15);
    var meia = o.velocidade !== undefined ? 1 / limitar(o.velocidade, 0.05, 20, 1.25) : limitar(o.periodo, 0.2, 20, 1.6) / 2;
    var amort = limitar(o.amortecimento, 0, 5, 0), i, l, p, n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      // gira em volta do ponto de âncora que a camada já tem (não mexe na âncora)
      p = T(l).property('ADBE Rotate Z');
      var b = p.valueAtTime(l.inPoint, false), lista = [], t = l.inPoint, lado = 1, amp;
      lista.push([t, b - ang, 50, 55]);
      while (t + meia <= l.outPoint + 0.001 && lista.length < 2000) {
        t += meia; amp = ang * Math.exp(-amort * (t - l.inPoint));
        lista.push([t, b + lado * amp, 55, 55]); lado = -lado;
      }
      chaves(p, lista, 'ease'); n++;
    }
    return 'Pêndulo (±' + ang + '°, ' + (1 / meia).toFixed(2) + ' balanço(s)/s) em ' + n + ' camada(s), girando no ponto de âncora de cada uma.';
  };


  FERR['esteira'] = function (c, o, ls) {
    var vel = Number(o.velocidade) || 150, mapa = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] };
    var d = mapa[o.direcao] || mapa.cima, i, l, e, sh, w, h, dur, n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      e = efeitoObrigatorio(l, 'ADBE Offset', 'Offset');
      sh = e.property(1);
      try { w = l.source.width; h = l.source.height; } catch (x) { w = c.width; h = c.height; }
      if (!w || !h) { w = c.width; h = c.height; }
      dur = l.outPoint - l.inPoint;
      chaves(sh, [[l.inPoint, [w / 2, h / 2]], [l.outPoint, [w / 2 + d[0] * vel * dur, h / 2 + d[1] * vel * dur]]], 'linear');
      n++;
    }
    return 'Esteira infinita (' + vel + ' px/s) em ' + n + ' camada(s).';
  };

  FERR['video-infinito'] = function (c, o, ls) {
    var i, l, tr, n = 0, fd = c.frameDuration;
    for (i = 0; i < ls.length; i++) {
      l = ls[i];
      if (!l.canSetTimeRemapEnabled) { continue; }
      var durFonte = l.source.duration;
      l.timeRemapEnabled = true;
      tr = l.property('ADBE Time Remapping');
      while (tr.numKeys > 1) { tr.removeKey(tr.numKeys); }
      if (tr.numKeys === 0 || tr.keyTime(1) !== l.startTime) { while (tr.numKeys > 0) { tr.removeKey(tr.numKeys); } tr.setValueAtTime(l.startTime, 0); }
      tr.setValueAtTime(l.startTime + durFonte, durFonte);
      for (var kk = 1; kk <= tr.numKeys; kk++) { tr.setInterpolationTypeAtKey(kk, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); }
      tr.expression = 'loopOut("cycle")';
      l.outPoint = c.duration;
      n++;
    }
    if (!n) { throw new Error('Selecione uma camada de vídeo ou precomp.'); }
    return n + ' vídeo(s) repetindo até o fim da comp (Time Remap + loopOut).';
  };

  FERR['loop'] = function (c, o, ls) {
    var tipo = { 'cycle': 'cycle', 'pingpong': 'pingpong', 'offset': 'offset', 'continue': 'continue' }[o.tipo || 'cycle'] || 'cycle';
    var props = propsComChaves(c), i, n = 0;
    if (!props.length) {
      for (i = 0; i < ls.length; i++) {
        percorrer(T(ls[i]), function (p) { if (p.numKeys >= 2 && p.canSetExpression) { props.push(p); } });
      }
    }
    for (i = 0; i < props.length; i++) {
      if (props[i].numKeys >= (tipo === 'continue' ? 1 : 2) && props[i].canSetExpression) { props[i].expression = 'loopOut("' + tipo + '")'; n++; }
    }
    if (!n) { throw new Error('Nenhuma propriedade com keyframes. Anime algo primeiro (ou selecione a propriedade).'); }
    return 'loopOut("' + tipo + '") em ' + n + ' propriedade(s).';
  };

  FERR['contador'] = function (c, o, ls) {
    var lim = function (v) { return Math.max(-1000000, Math.min(1000000, v)); };
    var de = lim(Number(o.de) || 0), ate = lim((o.ate === undefined || o.ate === '') ? 100 : Number(o.ate));
    var dur = limitar(o.duracao, 0.1, 600, 3), casas = Math.round(limitar(o.casas, 0, 4, 0)), curva = o.curva || 'comeco-rapido';
    var milhar = o.milhar === undefined ? true : !!o.milhar, ini = (o.inicio !== undefined && !isNaN(Number(o.inicio))) ? Number(o.inicio) : c.time, t = null, i, fx, sl;
    // usa a camada de texto selecionada, se tiver; senão cria uma no centro
    for (i = 0; ls && i < ls.length; i++) { if (ls[i] instanceof TextLayer) { t = ls[i]; break; } }
    var nova = !t;
    if (nova) {
      t = c.layers.addText(String(de));
      t.name = 'Contador';
      try {
        var td = t.property('ADBE Text Properties').property('ADBE Text Document'), doc = td.value;
        doc.fontSize = limitar(o.tamanho, 8, 1000, 150); doc.applyFill = true; doc.fillColor = [1, 1, 1];
        try { doc.justification = ParagraphJustification.CENTER_JUSTIFY; } catch (eJ) {}
        td.setValue(doc);
      } catch (eT) {}
      T(t).property('ADBE Position').setValue([c.width / 2, c.height / 2]);
    }
    var velho = acharEfeitoPorNome(t, 'Contador');
    if (velho) { velho.remove(); }
    fx = efeitos(t).addProperty('ADBE Slider Control'); fx.name = 'Contador';
    sl = fx.property(1);
    if (curva === 'linear') { chaves(sl, [[ini, de], [ini + dur, ate]], 'linear'); }
    else {
      var e1 = { suave: [75, 75], 'comeco-rapido': [10, 90], 'final-rapido': [90, 10] }[curva] || [75, 75];
      chaves(sl, [[ini, de, 50, e1[0]], [ini + dur, ate, e1[1], 50]], 'ease');
    }
    var pre = String(o.prefixo || '').replace(/["\\\r\n]/g, ''), suf = String(o.sufixo || '').replace(/["\\\r\n]/g, '');
    t.property('ADBE Text Properties').property('ADBE Text Document').expression =
      'var v = effect("Contador")(1).value;\n' +
      'var s = Math.abs(v).toFixed(' + casas + ').split(".");\n' +
      (milhar ? 'var inteiro = s[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");\n' : 'var inteiro = s[0];\n') +
      '(v < 0 ? "-" : "") + "' + pre + '" + inteiro + (s.length > 1 ? "," + s[1] : "") + "' + suf + '";';
    if (o.inicio === undefined) { marcadorInicio(c, ini, 'Início: Contador'); }
    registrar(t, 'contador', { de: de, ate: ate, duracao: dur, curva: curva, casas: casas, milhar: milhar, prefixo: pre, sufixo: suf, inicio: ini });
    return 'Contador de ' + de + ' até ' + ate + ' em ' + dur + 's ' + (nova ? '(camada nova "Contador")' : 'na camada "' + t.name + '"') + '. Ajuste no slider "Contador" (efeitos) ou pela aba Editar.';
  };


  // Cascata: cópias do texto saem de dentro dele, abrem em degraus e voltam a ser um só, em loop
  FERR['cascata'] = function (c, o, ls) {
    var qtd = Math.round(limitar(o.quantidade !== undefined ? o.quantidade : (o.linhas ? o.linhas - 1 : 4), 1, 40, 4));
    var esp = limitar(o.espacamento, 1, 2000, 60), abre = limitar(o.velocidade, 0.05, 20, 0.6), pausa = limitar(o.pausa, 0, 30, 0.6);
    var atraso = limitar(o.escalonamento, 0, 30, 2) * c.frameDuration, dirTxt = o.direcao || 'baixo', loop = o.loop === undefined ? true : !!o.loop;
    var esmaecer = o.esmaecer === undefined ? true : !!o.esmaecer;
    var dirs = { baixo: [0, 1], cima: [0, -1], direita: [1, 0], esquerda: [-1, 0] }, d = dirs[dirTxt] || dirs.baixo;
    var i, j, l, n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i];
      if (!(l instanceof TextLayer)) { continue; }
      limparAnterior(l, 'cascata');
      var pos = T(l).property('ADBE Position');
      if (pos.numKeys || pos.dimensionsSeparated) { throw new Error('O texto "' + l.name + '" já tem keyframes de posição. Apague-os antes da Cascata.'); }
      var b = pos.value, nomes = [], ciclo = abre * 2 + pausa * 2 + atraso * qtd;
      for (j = 1; j <= qtd; j++) {
        var cp = l.duplicate();
        cp.name = l.name + ' · cascata ' + j;
        try { cp.moveAfter(j === 1 ? l : cp.containingComp.layer(nomes[nomes.length - 1])); } catch (eM) {}
        if (esmaecer) { try { T(cp).property('ADBE Opacity').setValue(Math.max(8, 100 - j * (85 / qtd))); } catch (eO) {} }
        var aberto = b.slice(0); aberto[0] = b[0] + d[0] * esp * j; aberto[1] = b[1] + d[1] * esp * j;
        var lista = [], t = l.inPoint, k = 0, fim = loop ? l.outPoint : l.inPoint + ciclo;
        while (t < fim - 0.0001 && k < 500) {
          var t0 = t + atraso * (j - 1);
          lista.push([t0, b.slice(0), 40, 80]);
          lista.push([t0 + abre, aberto, 80, 40]);
          lista.push([t0 + abre + pausa, aberto, 40, 80]);
          lista.push([t0 + abre * 2 + pausa, b.slice(0), 80, 40]);
          t += ciclo; k++;
          if (!loop) { break; }
        }
        chaves(T(cp).property('ADBE Position'), lista, 'ease');
        nomes.push(cp.name);
      }
      registrar(l, 'cascata', { quantidade: qtd, espacamento: esp, direcao: dirTxt, velocidade: abre, pausa: pausa, escalonamento: Math.round(atraso / c.frameDuration), loop: loop, esmaecer: esmaecer }, { copias: nomes });
      n++;
    }
    if (!n) { throw new Error('Selecione uma camada de TEXTO.'); }
    return 'Cascata com ' + qtd + ' cópia(s) em ' + n + ' texto(s)' + (loop ? ', abrindo e fechando em loop' : '') + '.';
  };


  FERR['expandir-fundo'] = function (c, o, ls) {
    var f = (Number(o.escala) || 115) / 100, i, k, p, v, n = 0;
    for (i = 0; i < ls.length; i++) {
      if (!ehVisual(ls[i])) { continue; }
      p = T(ls[i]).property('ADBE Scale');
      if (!p || p.expression) { continue; }
      if (p.numKeys) { for (k = 1; k <= p.numKeys; k++) { v = p.keyValue(k); p.setValueAtKey(k, [v[0] * f, v[1] * f, v[2]]); } }
      else { v = p.value; p.setValue([v[0] * f, v[1] * f, v[2]]); }
      n++;
    }
    return 'Escala × ' + f.toFixed(2) + ' em ' + n + ' camada(s) (sobra borda para câmera/parallax).';
  };

  FERR['nulo'] = function (c, o, ls) {
    var nulo = c.layers.addNull(c.duration), i, sx = 0, sy = 0, k = 0, p;
    nulo.name = 'CTRL';
    for (i = 0; i < ls.length; i++) {
      if (ls[i].parent) { continue; }
      p = valorPos(ls[i], c.time); sx += p[0]; sy += p[1]; k++;
    }
    T(nulo).property('ADBE Position').setValue(k ? [sx / k, sy / k] : [c.width / 2, c.height / 2]);
    for (i = 0; i < ls.length; i++) { if (ls[i] !== nulo && !ls[i].parent) { ls[i].parent = nulo; } }
    nulo.moveToBeginning();
    return 'Nulo "CTRL" criado e ligado como parent de ' + k + ' camada(s).';
  };

  // ---------- áudio: lista e mapa de tempo entre comps ----------
  // Tempo da comp "pai" equivalente ao tempo t da comp "filha" (soma o startTime das camadas no caminho)
  function deslocamento(pai, filha, nivel) {
    var i, l, d;
    if (pai === filha) { return 0; }
    if (nivel > 5) { return null; }
    for (i = 1; i <= pai.numLayers; i++) {
      l = pai.layer(i);
      try {
        if (l.source instanceof CompItem) {
          if (l.source === filha) { return l.startTime; }
          d = deslocamento(l.source, filha, nivel + 1);
          if (d !== null) { return l.startTime + d; }
        }
      } catch (e) {}
    }
    return null;
  }

  am.listarAudios = function () {
    var c = null, lista = [], i, j, it, l;
    try { c = am.findComp(); } catch (e) {}
    for (i = 1; i <= app.project.numItems; i++) {
      it = app.project.item(i);
      if (!(it instanceof CompItem)) { continue; }
      var rel = c ? deslocamento(it, c, 0) : null, relF = (c && rel === null && it !== c) ? deslocamento(c, it, 0) : null;
      for (j = 1; j <= it.numLayers; j++) {
        l = it.layer(j);
        var temAudio = false;
        try { temAudio = l.hasAudio && l.audioEnabled !== false && !(l.source instanceof CompItem); } catch (eA) {}
        if (!temAudio) { continue; }
        lista.push({ id: it.id + ':' + j, comp: it.name, camada: l.name, inicio: l.inPoint, fim: l.outPoint,
          relacao: !c ? 'outra' : (it === c ? 'esta' : (rel !== null ? 'mae' : (relF !== null ? 'filha' : 'outra'))), deslocamento: rel !== null ? rel : (relF !== null ? -relF : null), video: !!l.hasVideo,
          trilha: it.name === NOMES_AUDIO.trilha });
      }
    }
    // a trilha sonora (comp "[AUDIO] Trilha sonora") vem primeiro entre as comps de áudio de dentro: é o padrão da batida
    lista.sort(function (a, b) { var o = { esta: 0, filha: 1, mae: 2, outra: 3 }; return (o[a.relacao] - o[b.relacao]) || ((b.trilha ? 1 : 0) - (a.trilha ? 1 : 0)); });
    return { comp: c ? c.name : null, audios: lista };
  };

  // tempo na comp do áudio = tempo em c + deslAudio (a comp do áudio pode ser mãe de c ou estar DENTRO dela)
  function deslAudio(compAudio, c) {
    var d = deslocamento(compAudio, c, 0), f;
    if (d !== null) { return d; }
    f = compAudio === c ? null : deslocamento(c, compAudio, 0);
    return f !== null ? -f : 0;
  }

  function acharAudio(c, id) {
    var p, comp = null, idx, i;
    if (id) {
      p = String(id).split(':');
      for (i = 1; i <= app.project.numItems; i++) { if (app.project.item(i).id === Number(p[0])) { comp = app.project.item(i); } }
      idx = Number(p[1]);
      if (comp && idx >= 1 && idx <= comp.numLayers) { return { comp: comp, camada: comp.layer(idx) }; }
      throw new Error('O áudio escolhido não existe mais no projeto. Abra de novo a tela e escolha outro.');
    }
    var r = am.listarAudios(), a = r.audios[0];
    if (!a) { throw new Error('Este efeito precisa de um ÁUDIO: importe a música e coloque numa composição (esta ou a composição mãe).'); }
    return acharAudio(c, a.id);
  }

  // Lê a amplitude do áudio (Convert Audio to Keyframes) e devolve uma função tempo -> 0..1
  function amplitudeDoAudio(alvoComp, ref, canalNome) {
    var pai = ref.comp, cam = ref.camada, i, l, amp = null, antes = [];
    for (i = 1; i <= pai.numLayers; i++) { antes.push(pai.layer(i)); }
    function jaExistia(x) { for (var q = 0; q < antes.length; q++) { if (antes[q] === x) { return true; } } return false; }
    try { pai.openInViewer(); } catch (eV) {}
    for (i = 1; i <= pai.numLayers; i++) { pai.layer(i).selected = false; }
    cam.selected = true;
    if (!comandoMenu(['Convert Audio to Keyframes', 'Converter áudio em quadros-chave'])) {
      try { alvoComp.openInViewer(); } catch (eR) {}
      throw new Error('Não consegui rodar o "Convert Audio to Keyframes" sozinho nesta versão do After.');
    }
    for (i = 1; i <= pai.numLayers; i++) { l = pai.layer(i); if (!jaExistia(l) && l.nullLayer) { amp = l; break; } }
    if (!amp) { try { alvoComp.openInViewer(); } catch (eR2) {} throw new Error('O After não criou a camada "Audio Amplitude".'); }
    var n = { esquerdo: 1, direito: 2 }[canalNome] || 3, canal = efeitos(amp).property(n).property(1);
    var passo = alvoComp.frameDuration, t, max = 0.0001, valores = {}, inicio = cam.inPoint, fim = cam.outPoint;
    for (t = inicio; t <= fim; t += passo) { var v = canal.valueAtTime(t, false); valores[Math.round(t / passo)] = v; if (v > max) { max = v; } }
    try { amp.remove(); } catch (eX) {}
    try { alvoComp.openInViewer(); } catch (eR3) {}
    return { inicio: inicio, fim: fim, valor: function (tp) { var v = valores[Math.round(tp / passo)]; return v === undefined ? 0 : v / max; } };
  }

  FERR['batida'] = function (c, o, ls) {
    var alvos = [], i, j, t;
    for (i = 0; i < ls.length; i++) { if (ehVisual(ls[i]) && !(ls[i].hasAudio && !ls[i].hasVideo)) { alvos.push(ls[i]); } }
    if (!alvos.length) { throw new Error('Selecione as camadas que vão pulsar.'); }
    var ref = acharAudio(c, o.audio);
    var desl = deslAudio(ref.comp, c);
    var forca = limitar(o.forca, 1, 100, 75) / 100, limiar = limitar(o.sensibilidade !== undefined ? 100 - o.sensibilidade : 30, 0, 95, 30) / 100;
    var suav = limitar(o.suavidade, 0, 95, 50) / 100, alvo = o.alvo === 'opacidade' ? 'opacidade' : 'escala';
    var amp = amplitudeDoAudio(c, ref, o.canal);
    var passo = c.frameDuration, total = 0;
    for (j = 0; j < alvos.length; j++) {
      var l = alvos[j];
      limparAnterior(l, 'batida');
      var p = T(l).property(alvo === 'escala' ? 'ADBE Scale' : 'ADBE Opacity');
      if (p.numKeys > 0) { throw new Error('A camada "' + l.name + '" já tem keyframes de ' + alvo + '. Apague-os antes.'); }
      var base = p.value, lista = [], nivel = 0;
      for (t = l.inPoint; t < l.outPoint; t += passo * 2) {
        var tp = t + desl, k = (tp < amp.inicio || tp > amp.fim) ? 0 : amp.valor(tp);
        k = k <= limiar ? 0 : (k - limiar) / (1 - limiar);
        nivel = k > nivel ? k : nivel * suav + k * (1 - suav);   // sobe na hora, desce suave
        if (alvo === 'escala') { var f = 1 + 0.3 * forca * nivel; lista.push([t, base.length > 2 ? [base[0] * f, base[1] * f, base[2]] : [base[0] * f, base[1] * f]]); }
        else { lista.push([t, Math.max(0, Math.min(100, base * (1 - forca) + base * forca * nivel))]); }
      }
      chaves(p, lista, 'linear');
      registrar(l, 'batida', { audio: o.audio || '', alvo: alvo, forca: Math.round(forca * 100), sensibilidade: Math.round(100 - limiar * 100), suavidade: Math.round(suav * 100), canal: o.canal || 'ambos' }, { base: base, prop: alvo });
      total++;
    }
    return total + ' camada(s) pulsando na ' + alvo + ' com "' + ref.camada.name + '" (comp "' + ref.comp.name + '"' + (desl ? ', compensando ' + desl.toFixed(2) + 's da comp mãe' : '') + ').';
  };


  FERR['fade-audio'] = function (c, o, ls) {
    var dur = Number(o.duracao) || 1, i, l, p, n = 0;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!l.hasAudio) { continue; }
      p = l.property('ADBE Audio Group').property('ADBE Audio Levels');
      chaves(p, [[l.outPoint - dur, [0, 0], 50, 30], [l.outPoint, [-48, -48], 70, 50]], 'ease'); n++;
    }
    if (!n) { throw new Error('Selecione uma camada com áudio.'); }
    return 'Fade out de ' + dur + 's no áudio de ' + n + ' camada(s) (até -48 dB).';
  };

  FERR['fade-final'] = function (c, o) {
    var dur = Number(o.duracao) || 1, s = solido(c, [0, 0, 0], 'Fade final');
    s.moveToBeginning();
    s.inPoint = Math.max(0, c.duration - dur);
    chaves(T(s).property('ADBE Opacity'), [[c.duration - dur, 0, 50, 40], [c.duration - c.frameDuration, 100, 70, 50]], 'ease');
    return 'Fade para preto nos últimos ' + dur + 's.';
  };

  // Textos do PSD -> texto editável: pega TODAS as camadas de PSD da comp ativa e das precomps dentro dela
  // e roda o "Convert to Editable Text" do After. Só as que são texto no PSD viram texto; as outras ficam iguais.
  function idConverterTexto() {
    var nomes = ['Convert to Editable Text', 'Converter em texto editável', 'Converter em Texto Editável', 'Converter para texto editável', 'Converter para Texto Editável'], i, id;
    for (i = 0; i < nomes.length; i++) { try { id = app.findMenuCommandId(nomes[i]); } catch (e) { id = 0; } if (id > 0) { return id; } }
    return 3799;   // id do "Convert to Editable Text" quando o nome não é achado (After em outra língua)
  }
  FERR['texto-psd'] = function (c) {
    var comps = [c], vistos = {}, i, j, l, total = 0, achados = 0, original = c, cmd = idConverterTexto();
    for (i = 0; i < comps.length; i++) {
      vistos[comps[i].id] = true;
      for (j = 1; j <= comps[i].numLayers; j++) {
        try { var s = comps[i].layer(j).source; if (s instanceof CompItem && !vistos[s.id]) { comps.push(s); vistos[s.id] = true; } } catch (e) {}
      }
    }
    var ehPsd = function (x) {
      try {
        if (x instanceof TextLayer || !x.source || !(x.source instanceof FootageItem)) { return false; }
        var f = x.source.mainSource && x.source.mainSource.file;
        return !!f && /\.ps[db]$/i.test(String(f.name || f.fsName || ''));
      } catch (e) { return false; }
    };
    var textos = function (k) { var n = 0; for (var q = 1; q <= k.numLayers; q++) { if (k.layer(q) instanceof TextLayer) { n++; } } return n; };
    for (i = 0; i < comps.length; i++) {
      var k = comps[i], alvo = [];
      for (j = 1; j <= k.numLayers; j++) { l = k.layer(j); if (ehPsd(l) && !l.locked) { alvo.push(l); } }
      if (!alvo.length) { continue; }
      achados += alvo.length;
      var antes = textos(k);
      try { k.openInViewer(); } catch (eV) {}
      for (j = 1; j <= k.numLayers; j++) { try { k.layer(j).selected = false; } catch (eS) {} }
      for (j = 0; j < alvo.length; j++) { try { alvo[j].selected = true; } catch (eS2) {} }
      try { app.executeCommand(cmd); } catch (eC) {}
      total += Math.max(0, textos(k) - antes);
    }
    try { original.openInViewer(); } catch (e3) {}
    if (!achados) { throw new Error('Não achei camadas de PSD nesta comp nem nas precomps dela. Abra a composição do PSD importado (Importar como Composição) e tente de novo.'); }
    if (!total) { throw new Error('Achei ' + achados + ' camada(s) de PSD, mas nenhuma virou texto: ou o PSD não tem camadas de texto (texto rasterizado/convertido em forma não dá), ou o After não aceitou o comando. Dá para fazer na mão: selecione as camadas e use Camada › Criar › Converter em texto editável.'); }
    return total + ' texto(s) do PSD viraram texto editável (de ' + achados + ' camada(s) de PSD olhadas). As que não eram texto ficaram como estavam.';
  };

  FERR['apagar'] = function (c, o, ls) {
    var i, l, fx, cont = { efeitos: 0, expr: 0, chaves: 0, marc: 0 };
    var querEf = o.efeitos !== false, querEx = o.expressoes !== false, querKf = o.keyframes !== false, querMk = o.marcadores !== false;
    for (i = 0; i < ls.length; i++) {
      l = ls[i];
      if (querEf) { fx = efeitos(l); if (fx) { while (fx.numProperties > 0) { fx.property(fx.numProperties).remove(); cont.efeitos++; } } }
      percorrer(l, function (p) {
        try { if (querEx && p.canSetExpression && p.expression !== '') { p.expression = ''; cont.expr++; } } catch (e) {}
        try { if (querKf && p.numKeys > 0 && p.matchName !== 'ADBE Marker') { while (p.numKeys > 0) { p.removeKey(p.numKeys); cont.chaves++; } } } catch (e2) {}
      });
      if (querMk) { try { var mk = l.property('ADBE Marker'); while (mk.numKeys > 0) { mk.removeKey(mk.numKeys); cont.marc++; } } catch (e3) {} }
      if (o.animadores !== false) { try { var an = l.property('ADBE Text Properties').property('ADBE Text Animators'); while (an.numProperties > 0) { an.property(an.numProperties).remove(); } } catch (e4) {} }
    }
    return 'Limpo: ' + cont.efeitos + ' efeito(s), ' + cont.expr + ' expressão(ões), ' + cont.chaves + ' keyframe(s), ' + cont.marc + ' marcador(es).';
  };

  FERR['limpar-cache'] = function () {
    app.purge(PurgeTarget.ALL_CACHES);
    return 'Cache do After limpo.';
  };

  var SEM_SELECAO = { 'perde-foco': 1, 'flash': 1, 'ativar-3d': 1, 'contador': 1, 'fade-final': 1, 'texto-psd': 1, 'limpar-cache': 1, 'inverter': 1, 'batida': 1 };



  // ---------- Marcadores de início/fim na PRÓPRIA camada, que controlam o tempo do efeito ----------
  // Cada efeito ganha "Ini Nome" e "Fim Nome" (nome curto) na camada. Uma expressão nas propriedades animadas
  // lê esses marcadores: arrastar o início move o efeito; afastar/aproximar início e fim deixa mais lento/rápido.
  var NOMES_EFEITO = { 'textura': 'Animar textura', 'light-sweep': 'Light Sweep', 'glow': 'Glow', 'flicker': 'Flicker', 'glitch': 'Glitch', 'chroma': 'Chroma key', 'turbulencia': 'Turbulência',
    'escala-in': 'Escala in', 'escala-out': 'Escala out', 'slide': 'Slide', 'sequencia': 'Sequência', 'ancora-centro': 'Âncora no centro', 'rotacao-y': 'Giro Y',
    'z-entrada': 'Entrada Z', 'perde-foco': 'Desfoque', 'z-saida': 'Saída Z', 'rotacao-infinita': 'Rotação contínua', 'pendulo': 'Pêndulo', 'esteira': 'Esteira',
    'video-infinito': 'Vídeo infinito', 'deriva': 'Movimento constante', 'contador': 'Contador', 'cascata': 'Cascata', 'expandir-fundo': 'Expandir fundo',
    'nulo': 'Nulo', 'batida': 'Batida', 'fade-audio': 'Fade de áudio', 'pontos-foco': 'Pontos de foco',
    'cam-dolly': 'Dolly zoom', 'cam-orbita': 'Órbita', 'cam-descida': 'Descida pelo flyer', 'cam-lateral': 'Revelação lateral', 'cam-zoom-batida': 'Zoom na batida', 'cam-impacto': 'Tremida de impacto', 'cam-rack': 'Rack focus', 'cam-fuga': 'Final de fuga', 'cam-entrada-fundo': 'Entrada pelo fundo', 'cam-wiggle': 'Câmera na mão' };
  var NOMES_ANIMAR = { 'fade': 'Fade', 'slide-cima': 'Slide', 'subida-suave': 'Deslize suave', 'quique-lateral': 'Quique', 'escala-elastica': 'Escala elástica', 'overshoot': 'Overshoot',
    'snap': 'Snap', 'zoom-profundo': 'Zoom profundo', 'chegada': 'Chegada', 'queda-giro': 'Queda com giro', 'giro-baixo': 'Giro para baixo', 'virar-x': 'Virar X', 'virar-y': 'Virar Y',
    'cartao': 'Cartão', 'rolo': 'Rolo', 'balanco': 'Balanço', 'cortina-h': 'Cortina horizontal', 'cortina-v': 'Cortina vertical', 'desfoque': 'Desfoque' };
  function nomeEfeito(id) {
    var m = /^animar:([^:]+):(.+)$/.exec(id);
    if (m) { return (NOMES_ANIMAR[m[1]] || m[1]) + ' ' + ({ entrada: '(entrada)', saida: '(saída)', ambos: '(entrada e saída)' }[m[2]] || ''); }
    return NOMES_EFEITO[id] || id;
  }
  // marcadores com nome curto: "Ini Batida" / "Fim Batida" (antes era "Início: Zoom na batida"; o antigo continua sendo lido)
  var CURTOS = { 'Light Sweep': 'Sweep', 'Chroma key': 'Chroma', 'Turbulência': 'Turbul.', 'Escala in': 'Esc in', 'Escala out': 'Esc out', 'Sequência': 'Seq.',
    'Âncora no centro': 'Âncora', 'Entrada Z': 'Entr. Z', 'Rotação contínua': 'Rotação', 'Vídeo infinito': 'Loop vídeo', 'Movimento constante': 'Mov.',
    'Expandir fundo': 'Exp. fundo', 'Fade de áudio': 'Fade áudio', 'Pontos de foco': 'Foco', 'Dolly zoom': 'Dolly', 'Descida pelo flyer': 'Descida',
    'Revelação lateral': 'Lateral', 'Zoom na batida': 'Zoom batida', 'Tremida de impacto': 'Impacto', 'Rack focus': 'Rack', 'Final de fuga': 'Fuga', 'Entrada pelo fundo': 'Entr. fundo', 'Câmera na mão': 'Na mão',
    'Deslize suave': 'Deslize', 'Escala elástica': 'Elástica', 'Zoom profundo': 'Zoom prof.', 'Queda com giro': 'Queda', 'Giro para baixo': 'Giro baixo',
    'Cortina horizontal': 'Cortina H', 'Cortina vertical': 'Cortina V' };
  function curtoEfeito(nome) {
    var n = String(nome), m = /^(.*) \((entrada|saída|entrada e saída)\)$/.exec(n), suf = '';
    if (m) { n = m[1]; suf = { 'entrada': ' in', 'saída': ' out', 'entrada e saída': ' in/out' }[m[2]]; }
    n = CURTOS[n] || n.replace(/^Arcano\s+/, '');
    if (n.length > 14) { n = n.substring(0, 13) + '.'; }
    return n + suf;
  }
  function rotIni(nome) { return 'Ini ' + curtoEfeito(nome); }
  function rotFim(nome) { return 'Fim ' + curtoEfeito(nome); }
  function ehIni(cm, nome) { return cm === rotIni(nome) || cm === 'Início: ' + nome; }
  function ehFim(cm, nome) { return cm === rotFim(nome) || cm === 'Fim: ' + nome; }
  var MARCA_TEMPO = '// arcano-tempo ';
  function caminhoProp(p) { var s = []; try { while (p && p.propertyDepth > 0) { s.unshift(p.matchName + '#' + p.propertyIndex); p = p.parentProperty; } } catch (e) {} return s.join('/'); }
  function propsAnimaveis(l) {
    var lista = [];
    percorrer(l, function (p) {
      try {
        if (p.canVaryOverTime === false) { return; }
        if (p.matchName === 'ADBE Marker' || p.matchName === 'ADBE Text Document') { return; }
        lista.push(p);
      } catch (e) {}
    });
    return lista;
  }
  function temposChaves(l) {
    var m = {}, ps = propsAnimaveis(l), i, k, t;
    for (i = 0; i < ps.length; i++) { t = []; try { for (k = 1; k <= ps[i].numKeys; k++) { t.push(ps[i].keyTime(k)); } } catch (e) {} m[caminhoProp(ps[i])] = t; }
    return m;
  }
  function lerSegmentos(p) {
    var e = ''; try { e = String(p.expression || ''); } catch (x) {}
    if (e.indexOf(MARCA_TEMPO) !== 0) { return null; }
    try { return eval('(' + e.substring(MARCA_TEMPO.length).split(/[\r\n]/)[0] + ')'); } catch (x2) { return null; }
  }
  function expressaoTempo(segs, fonte) {
    var esc = function (t) { return String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }, s = [], i;
    for (i = 0; i < segs.length; i++) { s.push('["' + esc(segs[i][0]) + '",' + segs[i][1] + ',' + segs[i][2] + ',"' + esc(rotIni(segs[i][0])) + '","' + esc(rotFim(segs[i][0])) + '"]'); }
    var lista = '[' + s.join(',') + ']';
    return MARCA_TEMPO + lista + '\n' +
      '// Arraste os marcadores "Ini" e "Fim" da camada para mudar quando o efeito começa e a velocidade.\n' +
      'var S=' + lista + ', M=' + fonte + '.marker, W=[], i, t=time, r=null;\n' +
      'for(i=0;i<S.length;i++){var a=S[i][1],b=S[i][2],x=a,y=b;try{x=M.key(S[i][3]).time;}catch(e1){try{x=M.key("Início: "+S[i][0]).time;}catch(e3){}}try{y=M.key(S[i][4]).time;}catch(e2){try{y=M.key("Fim: "+S[i][0]).time;}catch(e4){}}W.push([a,b,x,y]);}\n' +
      'W.sort(function(p,q){return p[2]-q[2];});\n' +
      'for(i=0;i<W.length;i++){var w=W[i];if(t<w[2]){r=(i===0)?w[0]+(t-w[2]):Math.min(W[i-1][1]+(t-W[i-1][3]),w[0]);break;}if(t<=w[3]){r=w[0]+(t-w[2])*(w[1]-w[0])/Math.max(0.001,w[3]-w[2]);break;}}\n' +
      'if(r===null){var z=W[W.length-1];r=z[1]+(t-z[3]);}\n' +
      'valueAtTime(r);';
  }
  function tirarMarcadores(l, nome) {
    var mk, k, cm;
    try { mk = l.property('ADBE Marker'); } catch (e) { return; }
    for (k = mk.numKeys; k >= 1; k--) {
      try { cm = mk.keyValue(k).comment; if (ehIni(cm, nome) || ehFim(cm, nome)) { mk.removeKey(k); } } catch (e2) {}
    }
  }
  function lerMarcadores(l, nome) {
    var mk, k, cm, r = {};
    try { mk = l.property('ADBE Marker'); for (k = 1; k <= mk.numKeys; k++) { cm = mk.keyValue(k).comment; if (ehIni(cm, nome)) { r.i = mk.keyTime(k); } if (ehFim(cm, nome)) { r.f = mk.keyTime(k); } } } catch (e) {}
    return r.i !== undefined && r.f !== undefined ? r : null;
  }
  // depois de editar, os marcadores voltam para onde o usuário tinha arrastado
  function manterMarcadores(l, nome, mk) { if (!mk) { return; } tirarMarcadores(l, nome); marcar(l, mk.i, rotIni(nome)); marcar(l, mk.f, rotFim(nome)); }
  function marcar(l, t, texto) { try { l.property('ADBE Marker').setValueAtTime(t, new MarkerValue(texto)); } catch (e) {} }
  // tira o efeito "nome" das expressões de tempo (e os marcadores) da camada; props: lista extra de propriedades de outras camadas
  function temposDe(p) { var t = [], k; try { for (k = 1; k <= p.numKeys; k++) { t.push(p.keyTime(k)); } } catch (e) {} return t; }
  function nomeTempo(l, id) { return id === 'perde-foco' ? String(l.name).replace(/^Arcano\s+/, '') : nomeEfeito(id); }
  function propsDesfoqueCamera(c) { var r = acharCamera(c), l = []; try { if (r.cam) { l.push(propZoomCam(r.cam)); } if (r.ctrl) { l.push(T(r.ctrl).property('ADBE Rotate Z')); } } catch (e) {} return l; }
  function propsFocoCamera(c) { var r = acharCamera(c), l = []; try { if (r.cam) { var op = r.cam.property('ADBE Camera Options Group'); l.push(op.property('ADBE Camera Aperture')); l.push(op.property('ADBE Camera Focus Distance')); } } catch (e) {} return l; }
  function propsCameraTodas(c) { var r = acharCamera(c), l = []; try { if (r.cam) { var op = r.cam.property('ADBE Camera Options Group'); l.push(op.property('ADBE Camera Zoom')); l.push(op.property('ADBE Camera Aperture')); l.push(op.property('ADBE Camera Focus Distance')); } } catch (e) {} return l; }
  // desfaz um efeito de câmera: tira as chaves do trecho dele nas propriedades que ele usou
  function REMOVER_CAM(ctrl, reg, nome) {
    var c = ctrl.containingComp, x = (reg && reg.x) || {}, i, k, usadas = {};
    // as propriedades do CAM FX são guardadas com "fx:" na frente (o caminho delas é igual ao do CAM CTRL)
    var props = [T(ctrl).property('ADBE Position'), T(ctrl).property('ADBE Rotate Y'), T(ctrl).property('ADBE Rotate Z')].concat(propsCameraTodas(c)), chavesP = [], pfx = propsFX(c);
    for (i = 0; i < props.length; i++) { chavesP.push(caminhoProp(props[i])); }
    for (i = 0; i < pfx.length; i++) { props.push(pfx[i]); chavesP.push('fx:' + caminhoProp(pfx[i])); }
    for (i = 0; i < (x.props || []).length; i++) { usadas[x.props[i]] = true; }
    limparTempo(ctrl, nome, propsCameraTodas(c).concat(pfx));
    for (i = 0; i < props.length; i++) {
      if (!usadas[chavesP[i]]) { continue; }
      var a0 = x.ini !== undefined ? Math.min(x.ini, x.t) : x.t, a1 = x.ate !== undefined ? Math.max(x.ate, x.fim) : x.fim;
      try { for (k = props[i].numKeys; k >= 1; k--) { var tk = props[i].keyTime(k); if (tk >= a0 - 0.0001 && tk <= a1 + 0.0001) { props[i].removeKey(k); } } } catch (e) {}
    }
  }
  function limparTempo(l, nome, extras) {
    var ps = propsAnimaveis(l).concat(extras || []), i, j, segs, novos, fonte;
    tirarMarcadores(l, nome);
    for (i = 0; i < ps.length; i++) {
      segs = lerSegmentos(ps[i]);
      if (!segs) { continue; }
      novos = []; for (j = 0; j < segs.length; j++) { if (segs[j][0] !== nome) { novos.push(segs[j]); } }
      if (novos.length === segs.length) { continue; }
      fonte = /M=(thisComp\.layer\("[^"]*"\)|thisLayer)\.marker/.exec(String(ps[i].expression));
      try { ps[i].expression = novos.length ? expressaoTempo(novos, fonte ? fonte[1] : 'thisLayer') : ''; } catch (e) {}
    }
  }
  // depois que a ferramenta rodou: acha as chaves novas, põe os marcadores e a expressão de tempo
  // alvoMarcador: camada que recebe os marcadores (padrão: a própria); props: [propriedades] (padrão: as da camada)
  function aplicarTempo(l, nome, antes, props, fonte) {
    var ps = props || propsAnimaveis(l), i, k, novas = [], a = 1e9, b = -1e9, tA, tem, cam, segs;
    for (i = 0; i < ps.length; i++) {
      if (!ps[i].numKeys) { continue; }
      cam = caminhoProp(ps[i]); tA = (antes && antes[cam]) || [];
      tem = false;
      for (k = 1; k <= ps[i].numKeys; k++) {
        var t = ps[i].keyTime(k), velha = false, q;
        for (q = 0; q < tA.length; q++) { if (Math.abs(tA[q] - t) < 0.0005) { velha = true; break; } }
        if (!velha) { tem = true; a = Math.min(a, t); b = Math.max(b, t); }
      }
      if (tem) { novas.push({ p: ps[i], antes: tA }); }
    }
    if (!novas.length || b <= a) { return null; }
    tirarMarcadores(l, nome);
    marcar(l, a, rotIni(nome));
    marcar(l, b, rotFim(nome));
    for (i = 0; i < novas.length; i++) {
      var p = novas[i].p, e = '';
      try { e = String(p.expression || ''); } catch (x) {}
      if (!p.canSetExpression) { continue; }
      segs = lerSegmentos(p);
      if (e && !segs) { continue; } // expressão do usuário: não mexe
      segs = segs || [];
      // chaves que já existiam precisam estar dentro de outro efeito do Arcano; senão não dá para controlar sem bagunçar a animação do usuário
      var cobertas = true;
      for (k = 0; k < novas[i].antes.length; k++) {
        var dentro = false, j;
        for (j = 0; j < segs.length; j++) { if (novas[i].antes[k] >= segs[j][1] - 0.0005 && novas[i].antes[k] <= segs[j][2] + 0.0005) { dentro = true; } }
        if (!dentro) { cobertas = false; break; }
      }
      if (!cobertas) { continue; }
      var limpos = []; for (k = 0; k < segs.length; k++) { if (segs[k][0] !== nome) { limpos.push(segs[k]); } }
      limpos.push([nome, a, b]);
      try { p.expression = expressaoTempo(limpos, fonte || 'thisLayer'); } catch (x2) {}
    }
    return { inicio: a, fim: b };
  }

  // ---------- Registro genérico: TODA ferramenta/animação aplicada numa camada aparece no Editar ----------
  // Tira uma "foto" das propriedades antes, roda, compara com depois e guarda só o que mudou (para desfazer/editar depois).
  function easeLista(arr) { var o = [], i; for (i = 0; i < arr.length; i++) { o.push([arr[i].speed, arr[i].influence]); } return o; }
  function hashTexto(t) { var h = 5381, i; for (i = 0; i < t.length; i++) { h = ((h * 33) ^ t.charCodeAt(i)) % 2147483647; } return String(h) + ':' + t.length; }
  function estadoProp(p) {
    var st = { e: '', k: null, v: null }, j;
    try { st.e = p.expression || ''; } catch (e) {}
    try {
      if (p.numKeys) {
        st.k = [];
        for (j = 1; j <= p.numKeys; j++) {
          var ie = [], oe = [];
          try { ie = easeLista(p.keyInTemporalEase(j)); oe = easeLista(p.keyOutTemporalEase(j)); } catch (eE) {}
          st.k.push([p.keyTime(j), p.keyValue(j), p.keyInInterpolationType(j), p.keyOutInterpolationType(j), ie, oe]);
        }
      } else { st.v = p.value; }
    } catch (e2) {}
    return st;
  }
  function propsDaCamada(l) {
    var lista = [];
    var sep = false; try { sep = !!T(l).property('ADBE Position').dimensionsSeparated; } catch (eS) {}
    try {
      percorrer(T(l), function (p) {
        try {
          if (p.canVaryOverTime === false) { return; }
          // posição: só a forma que está em uso (junta ou separada em X/Y/Z)
          if (/^ADBE Position_\d$/.test(p.matchName) && !sep) { return; }
          if (p.matchName === 'ADBE Position' && sep) { return; }
          lista.push(p);
        } catch (e) {}
      });
    } catch (e1) {}
    try { var au = l.property('ADBE Audio Group'); if (au) { lista.push(au.property('ADBE Audio Levels')); } } catch (e2) {}
    try { var tr = l.property('ADBE Time Remapping'); if (tr) { lista.push(tr); } } catch (e3) {}
    return lista;
  }
  function chaveProp(p) { var n = p.matchName; try { if (p.parentProperty && p.parentProperty.matchName === 'ADBE Audio Group') { n = 'audio:' + n; } } catch (e) {} return n; }
  function fotoCamada(l) {
    var f = { p: {}, fx: [], t3d: null, col: null, st: l.startTime, par: l.parent ? l.parent.name : null, tre: null }, ps = propsDaCamada(l), i, fx;
    for (i = 0; i < ps.length; i++) { f.p[chaveProp(ps[i])] = estadoProp(ps[i]); }
    try { fx = efeitos(l); for (i = 1; i <= fx.numProperties; i++) { f.fx.push(fx.property(i).name); } } catch (e) {}
    try { f.t3d = !!l.threeDLayer; } catch (e1) {}
    try { if (l.source instanceof CompItem) { f.col = !!l.collapseTransformation; } } catch (e2) {}
    try { f.tre = !!l.timeRemapEnabled; } catch (e3) {}
    return f;
  }
  function acharPropPorChave(l, k) {
    var ps = propsDaCamada(l), i;
    for (i = 0; i < ps.length; i++) { if (chaveProp(ps[i]) === k) { return ps[i]; } }
    return null;
  }
  function restaurarProp(p, st) {
    var j, idx, li, KE = function (a) { var o = [], q; for (q = 0; q < a.length; q++) { o.push(new KeyframeEase(a[q][0], Math.max(0.1, Math.min(100, a[q][1])))); } return o; };
    try { if (p.expression) { p.expression = ''; } } catch (e) {}
    try { while (p.numKeys) { p.removeKey(p.numKeys); } } catch (e1) {}
    if (st.k && st.k.length) {
      for (j = 0; j < st.k.length; j++) { try { p.setValueAtTime(st.k[j][0], st.k[j][1]); } catch (e2) {} }
      for (j = 0; j < st.k.length; j++) {
        li = st.k[j];
        try { idx = p.nearestKeyIndex(li[0]); p.setInterpolationTypeAtKey(idx, li[2], li[3]); if (li[4].length && li[5].length) { p.setTemporalEaseAtKey(idx, KE(li[4]), KE(li[5])); } } catch (e3) {}
      }
    } else if (st.v !== null && st.v !== undefined) { try { p.setValue(st.v); } catch (e4) {} }
    if (st.e) { try { p.expression = st.e; } catch (e5) {} }
  }
  // o que mudou entre as duas fotos (guarda o "antes" e um resumo do "depois")
  function diferenca(antes, depois) {
    var d = { p: {}, h: {}, novosFx: [], mudou: false }, k, a, b;
    for (k in depois.p) {
      if (!depois.p.hasOwnProperty(k)) { continue; }
      a = antes.p[k] ? ser(antes.p[k]) : ''; b = ser(depois.p[k]);
      if (a !== b) {
        d.p[k] = antes.p[k] || { e: '', k: null, v: null };
        d.h[k] = hashTexto(b);
        // chaves que a ferramenta criou (para tirar só elas se depois alguém mexer na mesma propriedade)
        var tA = {}, q, novas = [];
        if (antes.p[k] && antes.p[k].k) { for (q = 0; q < antes.p[k].k.length; q++) { tA[antes.p[k].k[q][0].toFixed(4)] = 1; } }
        if (depois.p[k].k) { for (q = 0; q < depois.p[k].k.length; q++) { if (!tA[depois.p[k].k[q][0].toFixed(4)]) { novas.push(depois.p[k].k[q][0]); } } }
        d.p[k].novas = novas;
        d.mudou = true;
      }
    }
    if (depois.fx.length > antes.fx.length) { d.novosFx = depois.fx.slice(antes.fx.length); d.mudou = true; }
    if (antes.t3d !== depois.t3d) { d.t3d = antes.t3d; d.mudou = true; }
    if (antes.col !== depois.col) { d.col = antes.col; d.mudou = true; }
    if (Math.abs(antes.st - depois.st) > 1e-6) { d.st = antes.st; d.mudou = true; }
    if (antes.par !== depois.par) { d.par = antes.par; d.parMudou = true; d.mudou = true; }
    if (antes.tre !== depois.tre) { d.tre = antes.tre; d.mudou = true; }
    return d;
  }
  function desfazerGenerico(l, reg, id) {
    var g = reg && reg.x && reg.x.gen, k, p, i, j, c = l.containingComp;
    if (!g) { return; }
    var nomeT = id ? nomeEfeito(id) : null;
    for (k in g.p) {
      if (!g.p.hasOwnProperty(k)) { continue; }
      p = acharPropPorChave(l, k);
      if (!p) { continue; }
      if (g.h && g.h[k] && hashTexto(ser(estadoProp(p))) !== g.h[k] && g.p[k].novas) {
        // alguém mexeu depois: tira só as chaves que esta ferramenta criou
        for (j = g.p[k].novas.length - 1; j >= 0; j--) {
          try { var idx = p.nearestKeyIndex(g.p[k].novas[j]); if (Math.abs(p.keyTime(idx) - g.p[k].novas[j]) < 0.0005) { p.removeKey(idx); } } catch (eK) {}
        }
      } else { restaurarProp(p, g.p[k]); }
    }
    if (g.novosFx && g.novosFx.length) {
      var fx = efeitos(l);
      for (j = g.novosFx.length - 1; j >= 0; j--) {
        for (i = fx.numProperties; i >= 1; i--) { if (fx.property(i).name === g.novosFx[j]) { fx.property(i).remove(); break; } }
      }
    }
    if (g.tre === false) { try { l.timeRemapEnabled = false; } catch (eT) {} }
    if (g.t3d !== undefined && g.t3d !== null) { try { l.threeDLayer = !!g.t3d; } catch (e3) {} }
    if (g.col !== undefined && g.col !== null) { try { l.collapseTransformation = !!g.col; } catch (e4) {} }
    if (g.st !== undefined) { try { l.startTime = g.st; } catch (e5) {} }
    if (g.parMudou) {
      var pai = null;
      if (g.par) { for (i = 1; i <= c.numLayers; i++) { if (c.layer(i).name === g.par && c.layer(i) !== l) { pai = c.layer(i); break; } } }
      try { l.parent = pai; } catch (e6) {}
    }
    // tira este efeito das expressões de tempo que sobraram (quando outro efeito mexeu depois na mesma propriedade)
    if (nomeT) { limparTempo(l, nomeT); }
    if (g.criadas && g.criadas.length) {
      for (j = 0; j < g.criadas.length; j++) {
        for (i = c.numLayers; i >= 1; i--) { if (c.layer(i).name === g.criadas[j] && c.layer(i) !== l) { try { c.layer(i).remove(); } catch (e7) {} break; } }
      }
    }
  }
  // as opções chegam de outro contexto (JSON do painel): copia para um objeto comum para o registro conseguir salvar
  function copiaSimples(o) {
    var r = {}, k, v, i, a;
    if (!o) { return r; }
    for (k in o) {
      if (!o.hasOwnProperty(k)) { continue; }
      v = o[k];
      if (v instanceof Array) { a = []; for (i = 0; i < v.length; i++) { a.push(v[i]); } r[k] = a; }
      else if (v === null || typeof v !== 'object') { r[k] = v; }
    }
    return r;
  }
  function mesmaCamada(a, b) {
    try { if (a.id !== undefined && b.id !== undefined && a.id !== null) { return a.id === b.id; } } catch (e) {}
    return a === b;
  }
  // ferramentas que não ficam "presas" a uma camada (criam coisas novas ou mexem em tudo)
  var SEM_EDITAR = { 'flash': 1, 'fade-final': 1, 'texto-psd': 1, 'limpar-cache': 1, 'apagar': 1, 'inverter': 1, 'ativar-3d': 1, 'loop': 1 };
  function comRegistro(c, id, opcoes, ls, fn) {
    var i, reg, antes = [], camadasAntes = [], tAntes = c.time, usouTempo = false;
    var mkVelhos = [];
    for (i = 0; i < ls.length; i++) {
      reg = lerRegistro(ls[i]).fx[id];
      mkVelhos.push(reg ? lerMarcadores(ls[i], nomeEfeito(id)) : null);
      if (reg && reg.x && reg.x.gen) {
        // editando: volta ao estado de antes e mantém o mesmo ponto da timeline
        desfazerGenerico(ls[i], reg, id);
        if (reg.x.t !== undefined && !usouTempo) { try { c.time = reg.x.t; usouTempo = true; } catch (eT) {} }
      }
      antes.push(fotoCamada(ls[i]));
    }
    var t0 = c.time, chavesAntes = [];
    for (i = 1; i <= c.numLayers; i++) { camadasAntes.push(c.layer(i)); }
    for (i = 0; i < ls.length; i++) { tirarMarcadores(ls[i], nomeEfeito(id)); chavesAntes.push(temposChaves(ls[i])); }
    var res;
    try { res = fn(); } finally { if (usouTempo) { try { c.time = tAntes; } catch (eT2) {} } }
    for (i = 0; i < ls.length; i++) { if (aplicarTempo(ls[i], nomeEfeito(id), chavesAntes[i])) { manterMarcadores(ls[i], nomeEfeito(id), mkVelhos[i]); } }
    var criadas = [], q, nova;
    for (i = 1; i <= c.numLayers; i++) {
      nova = true;
      for (q = 0; q < camadasAntes.length; q++) { if (mesmaCamada(camadasAntes[q], c.layer(i))) { nova = false; break; } }
      if (nova) { criadas.push(c.layer(i).name); }
    }
    for (i = 0; i < ls.length; i++) {
      var d = diferenca(antes[i], fotoCamada(ls[i]));
      if (!d.mudou && !criadas.length) { continue; }
      d.criadas = criadas;
      registrar(ls[i], id, copiaSimples(opcoes), { gen: d, t: t0 });
    }
    return res;
  }

  am.ferramenta = function (id, opcoes) {
    if (!FERR[id]) { throw new Error('Ferramenta desconhecida: ' + id); }
    opcoes = opcoes || {};
    if (id === 'limpar-cache') { return { mensagem: FERR[id]() }; }
    return desfazivel(id, function () {
      var c = am.findComp(), ls = selecao(c, !SEM_SELECAO[id]);
      if (SEM_EDITAR[id] || !ls.length) { return { mensagem: FERR[id](c, opcoes, ls) }; }
      if (REMOVER[id]) {
        var antesT = [], q, msg;
        var mkV = [];
        for (q = 0; q < ls.length; q++) { mkV.push(lerMarcadores(ls[q], nomeEfeito(id))); if (lerRegistro(ls[q]).fx[id]) { limparTempo(ls[q], nomeEfeito(id)); } antesT.push(temposChaves(ls[q])); }
        msg = FERR[id](c, opcoes, ls);
        for (q = 0; q < ls.length; q++) { if (lerRegistro(ls[q]).fx[id] && aplicarTempo(ls[q], nomeEfeito(id), antesT[q])) { manterMarcadores(ls[q], nomeEfeito(id), mkV[q]); } }
        return { mensagem: msg };
      }
      return { mensagem: comRegistro(c, id, opcoes, ls, function () { return FERR[id](c, opcoes, ls); }) };
    });
  };
  // Quantas camadas e keyframes estão selecionados agora (o painel confere antes de aplicar)
  am.contarSelecao = function () {
    var c = am.compPassiva(), n = 0, k = 0, i, j, ps;
    if (!c) { try { c = am.findComp(); } catch (e) { return { comp: false, camadas: 0, keys: 0 }; } }
    n = c.selectedLayers.length;
    try { ps = c.selectedProperties; for (i = 0; i < ps.length; i++) { if (ps[i].selectedKeys) { k += ps[i].selectedKeys.length; } } } catch (e2) {}
    return { comp: true, nomeComp: c.name, camadas: n, keys: k };
  };

  // Efeitos do Arcano que estão na camada selecionada (aba Editar)
  function temParallax(c) {
    for (var i = 1; i <= c.numLayers; i++) { try { if (String(c.layer(i).comment || '').indexOf(MARCA_PX) === 0) { return true; } } catch (e) {} }
    return false;
  }
  am.temParallax = function () { var c = am.compPassiva(); return { comp: !!c, parallax: c ? temParallax(c) : false }; };
  am.efeitosArcano = function () {
    var c = am.compPassiva(), l, r, k, lista = [];
    if (!c) { return { comp: false }; }
    var px = temParallax(c);
    if (!c.selectedLayers.length) { return { comp: true, camada: null, parallax: px }; }
    l = c.selectedLayers[0];
    r = lerRegistro(l);
    for (k in r.fx) { if (r.fx.hasOwnProperty(k)) { lista.push({ id: k, o: r.fx[k].o }); } }
    return { comp: true, parallax: px, camada: { indice: l.index, nome: l.name, total: c.selectedLayers.length }, fx: lista };
  };

  // Tira um efeito do Arcano das camadas selecionadas
  am.removerArcano = function (id) {
    return desfazivel('Remover ' + id, function () {
      var c = am.findComp(), ls = selecao(c, true), i, n = 0, r;
      for (i = 0; i < ls.length; i++) {
        r = lerRegistro(ls[i]);
        if (r.fx[id] && /^mov:/.test(id)) { mvRemover(ls[i], { id: id.slice(4), nome: (r.fx[id].o && r.fx[id].o.nome) || id.slice(4) }, r.fx[id]); n++; continue; }
        if (r.fx[id] && /^cam-/.test(id)) { REMOVER_CAM(ls[i], r.fx[id], nomeEfeito(id)); desregistrar(ls[i], id); n++; continue; }
        if (r.fx[id]) { if (REMOVER[id]) { limparTempo(ls[i], nomeTempo(ls[i], id), id === 'perde-foco' ? propsDesfoqueCamera(ls[i].containingComp) : (id === 'pontos-foco' ? propsFocoCamera(ls[i].containingComp) : null)); REMOVER[id](ls[i], r.fx[id]); } else { desfazerGenerico(ls[i], r.fx[id], id); } desregistrar(ls[i], id); if (id === 'perde-foco') { try { ls[i].remove(); } catch (eR) {} } n++; }
      }
      return { mensagem: n ? 'Efeito removido de ' + n + ' camada(s).' : 'As camadas selecionadas não têm esse efeito.' };
    });
  };

  // PSDs usados pela comp ativa (e pelas precomps dela)
  am.psdsDaComp = function () {
    var c = am.findComp(), vistos = {}, lista = [], visto = {};
    function varrer(comp, nivel) {
      var i, l, f;
      if (nivel > 6 || visto[comp.id]) { return; }
      visto[comp.id] = true;
      for (i = 1; i <= comp.numLayers; i++) {
        l = comp.layer(i);
        try {
          if (l.source instanceof CompItem) { varrer(l.source, nivel + 1); continue; }
          f = l.source && l.source.mainSource && l.source.mainSource.file;
          if (f && /\.(psd|psb)$/i.test(f.name) && !vistos[f.fsName]) { vistos[f.fsName] = true; lista.push({ caminho: f.fsName, existe: f.exists }); }
        } catch (e) {}
      }
    }
    varrer(c, 0);
    var projeto = null;
    try { if (app.project.file) { projeto = app.project.file.fsName; } } catch (e2) {}
    return { comp: c.name, psds: lista, projeto: projeto };
  };

  // Cria a camada de ajuste com o Apply Color LUT no lugar dos ajustes de cor do PSD.
  // O After não deixa script escolher o arquivo do LUT: o painel copia o caminho e o usuário confirma na janela.
  am.criarAjusteLUT = function (nomeGrupo, indiceRaiz, nomes, nomeCamada) {
    return desfazivel('Cores do PSD → LUT', function () {
      var c = am.findComp(), alvo = null, melhor = 1e9, i, l, d;
      for (i = 1; i <= c.numLayers; i++) {
        l = c.layer(i);
        if (nomeGrupo && l.name === nomeGrupo) { d = Math.abs(i - (indiceRaiz || i)); if (d < melhor) { melhor = d; alvo = l; } }
      }
      if (!alvo && nomes && nomes.length) {
        for (i = 1; i <= c.numLayers && !alvo; i++) {
          var j; for (j = 0; j < nomes.length; j++) { if (c.layer(i).name === nomes[j]) { alvo = c.layer(i); break; } }
        }
      }
      var nome = nomeCamada || 'Pesquisa de cores (Arcano)';
      var existente = null;
      for (i = 1; i <= c.numLayers; i++) { if (c.layer(i).name === nome && c.layer(i).adjustmentLayer) { existente = c.layer(i); } }
      var aj = existente || c.layers.addSolid([1, 1, 1], nome, c.width, c.height, c.pixelAspect, c.duration);
      aj.adjustmentLayer = true;
      aj.label = 9;
      try { aj.startTime = 0; aj.inPoint = 0; aj.outPoint = c.duration; } catch (eT) {}
      if (alvo && alvo !== aj) { aj.moveBefore(alvo); } else if (!alvo) { aj.moveToBeginning(); }
      // os ajustes importados do PSD já estão dentro do LUT: desliga para não aplicar a cor duas vezes
      var desligadas = 0;
      if (nomes) {
        var todas = camadasHierarquia(c, {}, []), q, w;
        for (q = 0; q < todas.length; q++) {
          for (w = 0; w < nomes.length; w++) {
            try { if (todas[q].name === nomes[w] && todas[q].adjustmentLayer && todas[q] !== aj && todas[q].enabled) { todas[q].enabled = false; desligadas++; } } catch (eD) {}
          }
        }
      }
      var fx = efeitos(aj), lut = null, mn = ['ADBE Apply Color LUT2', 'ADBE Apply Color LUT', 'Apply Color LUT'], k;
      for (k = 0; k < fx.numProperties; k++) { if (/LUT/i.test(fx.property(k + 1).matchName)) { lut = fx.property(k + 1); } }
      for (k = 0; k < mn.length && !lut; k++) { try { if (fx.canAddProperty(mn[k])) { lut = fx.addProperty(mn[k]); } } catch (eA) {} }
      aj.selected = true;
      return { camada: aj.name, indice: aj.index, compId: c.id, comp: c.name, acima: alvo ? alvo.name : null, efeito: !!lut, desligadas: desligadas };
    });
  };

  // Janela de salvar do sistema (o usuário escolhe pasta e nome); devolve o caminho ou null se cancelar
  am.escolherOndeSalvar = function (sugestao, titulo) {
    var f = new File(sugestao), filtro = $.os.indexOf('Windows') >= 0 ? 'LUT (*.cube):*.cube' : function (x) { return x instanceof Folder || /\.cube$/i.test(x.name); };
    var escolhido = f.saveDlg(titulo || 'Salvar', filtro);
    return { caminho: escolhido ? escolhido.fsName : null };
  };

  // Manda o Photoshop gerar o LUT (jsx/lut-photoshop.jsx). Só envia: o resultado chega num arquivo,
  // que o painel espera. jobJson já vem pronto do painel (JSON vale como literal em ExtendScript).
  am.lutViaPhotoshop = function (script, jobJson) {
    if (typeof BridgeTalk === 'undefined') { return { erro: 'sem-bridgetalk' }; }
    var alvo = null;
    try { alvo = BridgeTalk.getSpecifier('photoshop'); } catch (e) { alvo = null; }
    if (!alvo) { return { erro: 'sem-photoshop' }; }
    var rodando = false;
    try { rodando = BridgeTalk.isRunning(alvo); } catch (e2) {}
    if (!rodando) { try { BridgeTalk.launch(alvo); } catch (e3) {} }
    var bt = new BridgeTalk();
    bt.target = alvo;
    bt.body = 'var ARCANO_LUT_JOB = ' + jobJson + ';\n$.evalFile(new File(' + esc(script) + '));';
    bt.send();
    return { enviado: true, alvo: alvo, jaAberto: rodando };
  };

  // Estado da camada do LUT (para conferir se o .cube foi escolhido): liga/desliga só quando pedido
  am.lutEstado = function (compId, nome, ligar) {
    var c, i, l = null;
    try { c = am.findComp(compId); } catch (e) { return { existe: false, motivo: 'comp' }; }
    for (i = 1; i <= c.numLayers; i++) { if (c.layer(i).name === nome && c.layer(i).adjustmentLayer) { l = c.layer(i); break; } }
    if (!l) { return { existe: false, motivo: 'camada' }; }
    var tem = false, fx = efeitos(l), k;
    for (k = 1; k <= fx.numProperties; k++) { if (/LUT/i.test(fx.property(k).matchName) && fx.property(k).enabled) { tem = true; } }
    var era = l.enabled;
    if (ligar === true || ligar === false) { l.enabled = ligar; }
    return { existe: true, efeito: tem, ligada: era, tempo: c.time };
  };

  // Limpar paradas: tira o caminho inteiro da câmera (chaves, marcadores, desfoque) e o registro
  am.removerFoco = function () {
    return desfazivel('Limpar pontos de foco', function () {
      var c = am.findComp(), r = acharCamera(c);
      if (!r.ctrl) { return { mensagem: 'Não há caminho de câmera nesta comp.' }; }
      var reg = lerRegistro(r.ctrl).fx['pontos-foco'];
      limparTempo(r.ctrl, 'Pontos de foco', propsFocoCamera(c));
      if (reg) { REMOVER['pontos-foco'](r.ctrl, reg); desregistrar(r.ctrl, 'pontos-foco'); }
      try { if (r.cam) { var op = r.cam.property('ADBE Camera Options Group'); if (String(r.cam.comment || '').indexOf(MARCA_DOF) >= 0) { tirarDesfoqueCamera(c); } } } catch (e) {}
      return { mensagem: reg ? 'Paradas removidas: a câmera voltou ao flyer todo.' : 'Não havia paradas aplicadas.' };
    });
  };

  // caminho de Pontos de foco já aplicado nesta comp (para editar)
  am.focoSalvo = function () {
    var c = am.compPassiva() || (function () { try { return am.findComp(); } catch (e) { return null; } })();
    if (!c) { return { existe: false }; }
    var r = acharCamera(c), reg = r.ctrl ? lerRegistro(r.ctrl).fx['pontos-foco'] : null;
    if (!reg || !reg.x || !reg.x.sequencia) { return { existe: false }; }
    var mk = lerMarcadores(r.ctrl, 'Pontos de foco');
    return { existe: true, sequencia: reg.x.sequencia, viagem: reg.o.viagem, voltar: reg.o.voltar, inicio: mk ? mk.i : reg.x.t };
  };

  am.listaFerramentas = function () { var k, l = []; for (k in FERR) { if (FERR.hasOwnProperty(k)) { l.push(k); } } return l; };

  // ---------- CÂMERA ----------
  function zoomPadrao(c) { return c.width * 50 / 36; }

  function acharCamera(c) {
    var i, l, cam = null, ctrl = null;
    for (i = 1; i <= c.numLayers; i++) {
      l = c.layer(i);
      if (!cam && l instanceof CameraLayer && l.enabled) { cam = l; }
      if (cam === l) {
        var reta = true;
        try {
          reta = l.autoOrient === AutoOrientType.NO_AUTO_ORIENT || !l.property('ADBE Transform Group').property('ADBE Anchor Point');
          var tg = l.property('ADBE Transform Group'), nomes = ['ADBE Rotate X', 'ADBE Rotate Y', 'ADBE Rotate Z'], q;
          for (q = 0; q < nomes.length; q++) { var pr = tg.property(nomes[q]); if (pr && (pr.numKeys || pr.value !== 0)) { reta = false; } }
          var ori = tg.property('ADBE Orientation'); if (ori && (ori.numKeys || ori.value[0] !== 0 || ori.value[1] !== 0 || ori.value[2] !== 0)) { reta = false; }
        } catch (eR) {}
        if (!reta) { cam = null; }
      }
      if (!ctrl && l.name === 'CAM CTRL' && l.nullLayer) { ctrl = l; }
    }
    // a câmera pode estar direto no CAM CTRL ou passando pelo "CAM FX" (camada dos efeitos que somam por cima)
    var fx = null;
    if (cam && ctrl && cam.parent && cam.parent !== ctrl && cam.parent.name === 'CAM FX' && cam.parent.parent === ctrl) { fx = cam.parent; }
    if (cam && ctrl && cam.parent !== ctrl && !fx) { ctrl = null; }
    return { cam: cam, ctrl: ctrl, fx: fx };
  }

  // "CAM FX": nulo entre o CAM CTRL e a câmera. Os efeitos de câmera (entrada pelo fundo, descida, órbita, tremida...)
  // são DESLOCAMENTOS neste nulo, somados ao caminho do CAM CTRL: nunca apagam nem achatam o que já existe lá.
  function garantirFX(c, r) {
    if (r.fx) { return r.fx; }
    var fx = c.layers.addNull(c.duration);
    fx.name = 'CAM FX';
    fx.threeDLayer = true;
    T(fx).property('ADBE Anchor Point').setValue([0, 0, 0]);
    // parent primeiro, depois zera: fica exatamente em cima do CAM CTRL
    fx.parent = r.ctrl;
    T(fx).property('ADBE Position').setValue([0, 0, 0]);
    T(fx).property('ADBE Scale').setValue([100, 100, 100]);
    try { fx.enabled = false; } catch (eE) {}
    try { fx.shy = true; } catch (eS) {}
    r.cam.parent = fx;
    fx.moveAfter(r.ctrl);
    r.fx = fx;
    return fx;
  }
  function propsFX(c) {
    var r = acharCamera(c), l = [];
    if (r.fx) { var tg = T(r.fx); l.push(tg.property('ADBE Position'), tg.property('ADBE Rotate Y'), tg.property('ADBE Rotate Z')); }
    return l;
  }

  function garantirCamera(c) {
    var r = acharCamera(c);
    if (r.cam && r.ctrl) { return r; }
    var zoom = zoomPadrao(c), nova = false, alvoCtrl;
    if (!r.cam) {
      r.cam = c.layers.addCamera('CAM', [c.width / 2, c.height / 2]);
      r.cam.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
      r.cam.property('ADBE Camera Options Group').property('ADBE Camera Zoom').setValue(zoom);
      nova = true;
    }
    var pc = T(r.cam).property('ADBE Position');
    if (pc.numKeys || pc.expression || r.cam.parent) { throw new Error('A câmera "' + r.cam.name + '" já está animada ou tem parent. Use uma comp sem câmera ou apague a câmera antiga.'); }
    var zAtual = r.cam.property('ADBE Camera Options Group').property('ADBE Camera Zoom').value;
    alvoCtrl = nova ? [c.width / 2, c.height / 2, 0] : [pc.value[0], pc.value[1], pc.value[2] + zAtual];
    r.ctrl = c.layers.addNull(c.duration);
    r.ctrl.name = 'CAM CTRL';
    r.ctrl.threeDLayer = true;
    T(r.ctrl).property('ADBE Anchor Point').setValue([0, 0, 0]);
    T(r.ctrl).property('ADBE Position').setValue(alvoCtrl);
    // PARENT PRIMEIRO, depois a posição relativa
    r.cam.parent = r.ctrl;
    T(r.cam).property('ADBE Position').setValue([0, 0, -zAtual]);
    try { r.cam.autoOrient = AutoOrientType.NO_AUTO_ORIENT; } catch (e) {}
    r.ctrl.moveToBeginning();
    r.cam.moveToBeginning();
    return r;
  }

  function ligar3dCena(c) {
    var i, l;
    for (i = 1; i <= c.numLayers; i++) {
      l = c.layer(i);
      if (ehVisual(l) && !l.threeDLayer && !l.nullLayer && !ehSobreposicao(c, l)) { try { l.threeDLayer = true; } catch (e) {} }
    }
  }


  // ---------- Caixa do CONTEÚDO visível de uma camada (para enquadrar nos Pontos de foco) ----------
  // Retângulo em coordenadas da comp que contém a camada (no plano da camada, sem perspectiva).
  function vt(p, t) { try { return p.valueAtTime(t, false); } catch (e) { try { return p.value; } catch (e2) { return null; } } }
  // ponto no espaço da camada → espaço da comp (âncora, escala, rotação Z, posição e a cadeia de parents)
  function paraComp(l, pt, t) {
    var tg = T(l), a = vt(tg.property('ADBE Anchor Point'), t) || [0, 0, 0], s = vt(tg.property('ADBE Scale'), t) || [100, 100, 100], pos = valorPos(l, t), rz = 0;
    try { rz = (vt(tg.property('ADBE Rotate Z'), t) || 0) * Math.PI / 180; } catch (e) {}
    var x = (pt[0] - a[0]) * s[0] / 100, y = (pt[1] - a[1]) * s[1] / 100, cs = Math.cos(rz), sn = Math.sin(rz);
    var q = [pos[0] + x * cs - y * sn, pos[1] + x * sn + y * cs];
    if (l.parent) { q = paraComp(l.parent, q, t); }
    return q;
  }
  function envelope(pts) {
    var x0 = 1e12, y0 = 1e12, x1 = -1e12, y1 = -1e12, i;
    for (i = 0; i < pts.length; i++) { x0 = Math.min(x0, pts[i][0]); y0 = Math.min(y0, pts[i][1]); x1 = Math.max(x1, pts[i][0]); y1 = Math.max(y1, pts[i][1]); }
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }
  function uniao(a, b) { if (!a) { return b; } if (!b) { return a; } return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }; }
  function cantos(r) { return [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]]; }
  function visivelEm(l, t) {
    try { if (!l.enabled || l.guideLayer || l.adjustmentLayer || l.nullLayer) { return false; } } catch (e) {}
    if (l instanceof CameraLayer || l instanceof LightLayer) { return false; }
    try { if (!l.hasVideo) { return false; } } catch (e2) {}
    if (t < l.inPoint - 0.0001 || t >= l.outPoint) { return false; }
    try { if ((vt(T(l).property('ADBE Opacity'), t) || 0) <= 0) { return false; } } catch (e3) {}
    return true;
  }
  // caixa no espaço da própria camada (fonte), já cortada pelas máscaras; regiaoFoco: só a máscara "FOCO"
  function caixaLocal(l, t, prof) {
    var r = null, rr;
    var mp = null; try { mp = l.property('ADBE Mask Parade'); } catch (e) {}
    // máscara chamada FOCO: o usuário definiu a região
    if (mp) { for (var m = 1; m <= mp.numProperties; m++) { try { if (/^foco$/i.test(mp.property(m).name)) { return caixaMascara(mp.property(m), t); } } catch (eF) {} } }
    if (ehPrecomp(l) && prof < 6) {
      var tIn = t - l.startTime;
      try { if (l.timeRemapEnabled) { tIn = vt(l.property('ADBE Time Remapping'), t); } } catch (eR) {}
      r = caixaDaComp(l.source, tIn, prof + 1);
      if (!r) { r = { x0: 0, y0: 0, x1: l.source.width, y1: l.source.height }; }
    } else {
      try { rr = l.sourceRectAtTime(t, true); if (rr && rr.width > 0 && rr.height > 0) { r = { x0: rr.left, y0: rr.top, x1: rr.left + rr.width, y1: rr.top + rr.height }; } } catch (e2) {}
      if (!r) { try { r = { x0: 0, y0: 0, x1: l.source.width, y1: l.source.height }; } catch (e3) { r = { x0: 0, y0: 0, x1: 100, y1: 100 }; } }
    }
    // máscaras (aditivas): interseção com a caixa da máscara
    if (mp && mp.numProperties) {
      var cm = null;
      for (var k = 1; k <= mp.numProperties; k++) {
        try { var mk = mp.property(k); if (mk.maskMode === MaskMode.NONE || mk.maskMode === MaskMode.SUBTRACT) { continue; } cm = uniao(cm, caixaMascara(mk, t)); } catch (eM) {}
      }
      if (cm) { r = { x0: Math.max(r.x0, cm.x0), y0: Math.max(r.y0, cm.y0), x1: Math.min(r.x1, cm.x1), y1: Math.min(r.y1, cm.y1) }; if (r.x1 <= r.x0 || r.y1 <= r.y0) { return null; } }
    }
    return r;
  }
  function caixaMascara(mk, t) {
    var sh = vt(mk.property('ADBE Mask Shape'), t), v = sh && sh.vertices ? sh.vertices : [];
    return v.length ? envelope(v) : null;
  }
  // caixa de uma camada no espaço da comp que a contém
  function caixaCamada(l, t, prof) {
    var loc = caixaLocal(l, t, prof || 0), pts = [], i, cs;
    if (!loc) { return null; }
    cs = cantos(loc);
    for (i = 0; i < 4; i++) { pts.push(paraComp(l, cs[i], t)); }
    return envelope(pts);
  }
  // união das camadas visíveis de uma comp (ignora fundos de quadro cheio se houver coisas menores)
  function caixaDaComp(comp, t, prof) {
    var i, l, b, cheias = null, outras = null, W = comp.width, H = comp.height;
    for (i = 1; i <= comp.numLayers; i++) {
      l = comp.layer(i);
      if (!visivelEm(l, t)) { continue; }
      b = caixaCamada(l, t, prof);
      if (!b) { continue; }
      b = { x0: Math.max(b.x0, 0), y0: Math.max(b.y0, 0), x1: Math.min(b.x1, W), y1: Math.min(b.y1, H) };
      if (b.x1 <= b.x0 || b.y1 <= b.y0) { continue; }
      if ((b.x1 - b.x0) >= W * 0.95 && (b.y1 - b.y0) >= H * 0.95) { cheias = uniao(cheias, b); } else { outras = uniao(outras, b); }
    }
    return outras || cheias;
  }
  // camada de quadro cheio que é luz/textura/efeito por cima (não deve ganhar profundidade nem bloquear a câmera)
  function ehSobreposicao(c, l) {
    try { if (l.adjustmentLayer) { return true; } } catch (e) {}
    var b = null; try { b = caixaCamada(l, c.time, 0); } catch (e2) {}
    if (!b || (b.x1 - b.x0) < c.width * 0.95 || (b.y1 - b.y0) < c.height * 0.95) { return false; }
    var modo = null; try { modo = l.blendingMode; } catch (e3) {}
    var normal = true; try { normal = modo === undefined || modo === null || modo === BlendingMode.NORMAL; } catch (e4) {}
    return !normal || /(effect|efeito|fx|textura|texture|vinheta|vignette|overlay|grain|granulado|flare|luz|light|lut|poeira|dust|ruido|noise)/i.test(l.name);
  }

  function posMundo(l, t) {
    var p = valorPos(l, t);
    if (p.length < 3) { p.push(0); }
    return p;
  }

  // Mapa da comp: retângulo de cada camada em coordenadas da comp (2D, aproximado), de cima para baixo
  am.mapaCamadas = function () {
    var c = am.findComp(), t = c.time, lista = [], i, l, r, p, a, e, rot, cs, sn, xs, ys, k, cx, cy;
    for (i = 1; i <= c.numLayers; i++) {
      l = c.layer(i);
      if (!ehVisual(l) || l.nullLayer || l.adjustmentLayer) { continue; }
      try {
        r = retanguloCamada(l, t); p = T(l).property('ADBE Position').valueAtTime(t, false); a = T(l).property('ADBE Anchor Point').valueAtTime(t, false);
        e = T(l).property('ADBE Scale').valueAtTime(t, false); rot = (T(l).property('ADBE Rotate Z').valueAtTime(t, false) || 0) * Math.PI / 180;
        cs = Math.cos(rot); sn = Math.sin(rot); xs = []; ys = [];
        var cantos = [[r.left, r.top], [r.left + r.width, r.top], [r.left, r.top + r.height], [r.left + r.width, r.top + r.height]];
        for (k = 0; k < 4; k++) {
          cx = (cantos[k][0] - a[0]) * e[0] / 100; cy = (cantos[k][1] - a[1]) * e[1] / 100;
          xs.push(p[0] + cx * cs - cy * sn); ys.push(p[1] + cx * sn + cy * cs);
        }
        var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
        lista.push({ indice: i, nome: l.name, x: x0, y: y0, w: Math.max.apply(null, xs) - x0, h: Math.max.apply(null, ys) - y0,
          ativa: l.enabled && t >= l.inPoint && t < l.outPoint, parent: !!l.parent, texto: l instanceof TextLayer });
      } catch (eM) {}
    }
    return { comp: c.name, largura: c.width, altura: c.height, tempo: t, camadas: lista };
  };

  // Movimento constante: a camada anda devagar numa direção (ou flutua) até o fim
  FERR['deriva'] = function (c, o, ls) {
    var dir = o.direcao || 'direita', vel = limitar(o.velocidade, 1, 2000, 20), suave = o.suavidade === undefined ? 50 : limitar(o.suavidade, 0, 100, 50);
    var amp = limitar(o.amplitude, 2, 5000, 40), semente = Math.round(Number(o.semente) || (1 + Math.floor(Math.random() * 999983)));
    var mapa = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0], 'cima-esquerda': [-0.7071, -0.7071], 'cima-direita': [0.7071, -0.7071], 'baixo-esquerda': [-0.7071, 0.7071], 'baixo-direita': [0.7071, 0.7071] };
    var i, l, p, base, n = 0, reg;
    for (i = 0; i < ls.length; i++) {
      l = ls[i]; if (!ehVisual(l)) { continue; }
      p = T(l).property('ADBE Position');
      if (p.dimensionsSeparated || p.expression) { throw new Error('A posição de "' + l.name + '" está com dimensões separadas ou expressão.'); }
      reg = lerRegistro(l).fx.deriva;
      if (!reg && p.numKeys > 0) { throw new Error('A camada "' + l.name + '" já tem keyframes de posição. Apague-os antes do Movimento constante.'); }
      base = reg && reg.x && reg.x.pos ? reg.x.pos : p.value;
      limparAnterior(l, 'deriva');
      var t0 = l.inPoint, t1 = l.outPoint, lista = [];
      if (dir === 'flutuar') {
        // passeio aleatório: alvos sorteados dentro da amplitude, cada trecho no tempo que a velocidade pede
        var rnd = semAleatorio(semente + i * 7919), t = t0, ux = 0, uy = 0, q, ang, raio, nx, ny, dist, seg;
        lista.push([t0, base.slice(0), 40, 40]);
        while (t < t1 - 0.05 && lista.length < 2000) {
          ang = rnd() * Math.PI * 2; raio = amp * (0.35 + 0.65 * rnd());
          nx = Math.cos(ang) * raio; ny = Math.sin(ang) * raio * 0.8;
          dist = Math.sqrt((nx - ux) * (nx - ux) + (ny - uy) * (ny - uy));
          seg = Math.max(0.4, dist / vel) * (0.8 + 0.4 * rnd());
          t = Math.min(t1, t + seg);
          q = base.slice(0); q[0] += nx; q[1] += ny;
          lista.push([t, q, 35 + 30 * rnd(), 35 + 30 * rnd()]);
          ux = nx; uy = ny;
        }
        chaves(p, lista, 'ease');
      } else {
        var d = mapa[dir] || mapa.direita, fim = base.slice(0), dur = t1 - t0;
        fim[0] += d[0] * vel * dur; fim[1] += d[1] * vel * dur;
        if (suave > 0) { chaves(p, [[t0, base, 33, Math.max(0.1, suave * 0.6)], [t1, fim, Math.max(0.1, suave * 0.6), 33]], 'ease'); }
        else { chaves(p, [[t0, base], [t1, fim]], 'linear'); }
      }
      registrar(l, 'deriva', { direcao: dir, velocidade: vel, amplitude: amp, suavidade: suave, semente: semente }, { pos: base });
      n++;
    }
    if (!n) { throw new Error('Nenhuma camada visual selecionada.'); }
    return 'Movimento constante (' + (dir === 'flutuar' ? 'flutuando ±' + amp + ' px a ' + vel + ' px/s' : dir + ', ' + vel + ' px/s') + ') em ' + n + ' camada(s) até o fim.';
  };


  // ---------- Perder o foco: a câmera desfoca, dá um leve zoom e gira um pouco, e volta a focar ----------
  var NOME_PF = 'Arcano Desfoque';
  function propZoomCam(cam) { return cam.property('ADBE Camera Options Group').property('ADBE Camera Zoom'); }
  // tira só as chaves que o efeito criou (pelos tempos guardados); o resto da animação fica
  function tirarChavesPerdeFoco(c, reg) {
    var x = (reg && reg.x) || {}, r = acharCamera(c), lista = [], i, k, p;
    if (r.cam) { lista.push(propZoomCam(r.cam)); }
    if (r.ctrl) { lista.push(T(r.ctrl).property('ADBE Rotate Z')); }
    for (i = 0; i < lista.length; i++) {
      p = lista[i];
      for (k = (x.tempos || []).length - 1; k >= 0; k--) {
        if (!p.numKeys) { break; }
        var idx = p.nearestKeyIndex(x.tempos[k]);
        if (Math.abs(p.keyTime(idx) - x.tempos[k]) < 0.0005) { p.removeKey(idx); }
      }
    }
  }
  FERR['perde-foco'] = function (c, o, ls) {
    var inten = limitar(o.intensidade, 5, 100, 50) / 100, dur = limitar(o.duracao, 0.5, 6, 2), sinal = o.giro === 'esquerda' ? 1 : -1;
    var graus = o.graus === undefined ? 1 + 5 * inten : limitar(o.graus, 0, 45, 8);
    var i, velha = null, t0 = c.time, reg;
    // editando: reaproveita o mesmo ponto da timeline e troca o efeito antigo
    for (i = 0; i < ls.length; i++) { reg = lerRegistro(ls[i]).fx['perde-foco']; if (reg) { velha = ls[i]; t0 = reg.x.t0; break; } }
    var nomeAj = NOME_PF;
    var mkPf = null;
    if (velha) { nomeAj = velha.name; mkPf = lerMarcadores(velha, nomeTempo(velha, 'perde-foco')); limparTempo(velha, nomeTempo(velha, 'perde-foco'), propsDesfoqueCamera(c)); tirarChavesPerdeFoco(c, lerRegistro(velha).fx['perde-foco']); velha.remove(); }
    else {
      // nome único para cada desfoque (os marcadores e a expressão apontam para a camada pelo nome)
      var nn = 1, existe = function (nm) { for (var j = 1; j <= c.numLayers; j++) { if (c.layer(j).name === nm) { return true; } } return false; };
      while (existe(nomeAj)) { nn++; nomeAj = NOME_PF + ' ' + nn; }
    }
    t0 = Math.max(0, Math.min(t0, c.duration - c.frameDuration));
    dur = Math.min(dur, Math.max(c.frameDuration * 4, c.duration - t0));
    ligar3dCena(c);
    var r = garantirCamera(c), fd = c.frameDuration;
    function q(t) { return Math.round(t / fd) * fd; } // keys em frame cheio
    var tempos = [q(t0), q(t0 + dur * 0.35), q(t0 + dur * 0.7), q(t0 + dur)];
    // leve zoom (lente da câmera, não mexe na posição)
    var pz = propZoomCam(r.cam), z = [], k;
    var prA = T(r.ctrl).property('ADBE Rotate Z'), antesCam = {};
    antesCam[caminhoProp(pz)] = temposDe(pz); antesCam[caminhoProp(prA)] = temposDe(prA);
    for (k = 0; k < 4; k++) { z.push(pz.valueAtTime(tempos[k], false)); }
    chaves(pz, [[tempos[0], z[0], 50, 40], [tempos[1], z[1] * (1 + 0.12 * inten), 60, 55], [tempos[2], z[2] * (1 + 0.025 * inten), 55, 60], [tempos[3], z[3], 75, 50]], 'ease');
    // leve rotação (no CAM CTRL, somando ao que já existe)
    // o CAM CTRL precisa ser 3D para girar a câmera (versões antigas podiam ter deixado 2D)
    try { if (!r.ctrl.threeDLayer) { r.ctrl.threeDLayer = true; } } catch (e3) {}
    var pr = T(r.ctrl).property('ADBE Rotate Z'), ang = sinal * graus, rv = [];
    try { if (pr.expression && !lerSegmentos(pr)) { pr.expression = ''; } } catch (e4) {}
    for (k = 0; k < 4; k++) { rv.push(pr.valueAtTime(tempos[k], false)); }
    chaves(pr, [[tempos[0], rv[0], 50, 40], [tempos[1], rv[1] + ang, 60, 55], [tempos[2], rv[2] - ang * 0.25, 55, 60], [tempos[3], rv[3], 75, 50]], 'ease');
    // desfoque: camada de ajuste só nesse trecho
    var aj = solido(c, [1, 1, 1], nomeAj), e, raio = Math.round(4 + 36 * inten), pb;
    aj.adjustmentLayer = true; // a camada cobre a comp toda: dá para arrastar os marcadores para qualquer ponto
    aj.moveToBeginning();
    if (efeitos(aj).canAddProperty('ADBE Camera Lens Blur')) { e = efeitos(aj).addProperty('ADBE Camera Lens Blur'); pb = paramEfeito(e, ['ADBE Camera Lens Blur-0001', 'Blur Radius', 'Raio de desfoque'], 1); }
    else { e = efeitoObrigatorio(aj, 'ADBE Gaussian Blur 2', 'Desfoque gaussiano'); pb = paramEfeito(e, ['ADBE Gaussian Blur 2-0001', 'Blurriness', 'Desfoque'], 1); raio = Math.round(raio * 0.8); }
    e.name = NOME_PF;
    chaves(pb, [[tempos[0], 0, 50, 35], [tempos[1], raio, 60, 50], [tempos[2], raio * 0.15, 50, 60], [tempos[3], 0, 80, 50]], 'ease');
    registrar(aj, 'perde-foco', { intensidade: Math.round(inten * 100), graus: graus, duracao: dur, giro: sinal > 0 ? 'esquerda' : 'direita' }, { t0: tempos[0], tempos: tempos });
    // marcadores Início/Fim na camada do desfoque controlam o tempo do desfoque, do zoom e do giro
    if (aplicarTempo(aj, nomeTempo(aj, 'perde-foco'), antesCam, [pb, pz, pr], 'thisComp.layer("' + aj.name.replace(/"/g, '\\"') + '")')) { manterMarcadores(aj, nomeTempo(aj, 'perde-foco'), mkPf); }
    return 'Desfoque da câmera em ' + tempos[0].toFixed(2) + 's e volta em ' + dur.toFixed(1) + 's (zoom +' + Math.round(12 * inten) + '%, giro ' + Math.abs(ang).toFixed(1) + '°, desfoque ' + raio + ' px na camada "' + aj.name + '"). Arraste os marcadores Início/Fim dessa camada para mudar o tempo.';
  };


  // z de uma camada no mundo (soma a cadeia de parents)
  function zMundo(l, t) { var p = valorPos(l, t), z = p.length > 2 ? p[2] : 0; if (l.parent) { z += zMundo(l.parent, t); } return z; }
  // Enquadra o CONTEÚDO do alvo: caixa visível → distância da câmera para ele ocupar "preench" do quadro,
  // sem cortar, sem atravessar camadas da frente. Funciona com ou sem parallax e em qualquer proporção.
  // ponto (u, v de 0 a 1) na imagem da camada → espaço da comp. Camadas com fonte (imagem, vídeo, precomp):
  // u, v na fonte inteira; texto e forma: u, v na caixa do conteúdo (sourceRectAtTime)
  function temFonteImagem(l) {
    try { if (l instanceof TextLayer || l instanceof ShapeLayer) { return false; } return !!(l.source && l.source.width && l.source.height); } catch (e) { return false; }
  }
  function pontoCamada(l, t, u, v) {
    u = Math.max(0, Math.min(1, Number(u))); v = Math.max(0, Math.min(1, Number(v)));
    if (isNaN(u) || isNaN(v)) { return null; }
    var loc = null;
    if (temFonteImagem(l)) { loc = [u * l.source.width, v * l.source.height]; }
    else { try { var rr = l.sourceRectAtTime(t, true); if (rr && rr.width > 0) { loc = [rr.left + u * rr.width, rr.top + v * rr.height]; } } catch (e) {} }
    return loc ? paraComp(l, loc, t) : null;
  }
  // imagem da camada para o usuário clicar no ponto de foco. Com fonte: PNG da fonte (o After grava em segundo plano;
  // o painel espera o arquivo e depois chama removerTempIA). Texto/forma: só as proporções da caixa.
  am.imagemFoco = function (indice, caminho) {
    var c = am.findComp(), l = c.layer(Number(indice)), t = c.time;
    if (!l) { throw new Error('Camada não encontrada.'); }
    if (!temFonteImagem(l)) {
      var rr = null; try { rr = l.sourceRectAtTime(t, true); } catch (e) {}
      return { tipo: 'caixa', largura: rr ? rr.width : 100, altura: rr ? rr.height : 100, nome: l.name };
    }
    var src = l.source, tIn = t - l.startTime, f = new File(caminho), tmp;
    try { if (l.timeRemapEnabled) { tIn = l.property('ADBE Time Remapping').valueAtTime(t, false); } } catch (eR) {}
    if (f.exists) { f.remove(); }
    var dur = Math.max(src.duration || 1, 1);
    if (tIn < 0 || tIn > dur - (c.frameDuration || 0.04)) { tIn = 0; }
    // imagem grande demais: reduz (só para clicar)
    var esc = Math.min(1, 1600 / Math.max(src.width, src.height));
    tmp = app.project.items.addComp('__arcano_ia_tmp', Math.max(4, Math.round(src.width * esc)), Math.max(4, Math.round(src.height * esc)), 1, dur, c.frameRate);
    var nova = tmp.layers.add(src);
    try { nova.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([0, 0]); nova.property('ADBE Transform Group').property('ADBE Position').setValue([0, 0]); nova.property('ADBE Transform Group').property('ADBE Scale').setValue([esc * 100, esc * 100]); } catch (eE) {}
    tmp.saveFrameToPng(tIn, f);
    return { tipo: 'imagem', largura: src.width, altura: src.height, tmpId: tmp.id, nome: l.name };
  };

  function enquadrar(c, r, alvo, t, repouso, preench, zoom, todos, mPedido, pontoFoco) {
    var W = c.width, H = c.height, camL = T(r.cam).property('ADBE Position').value;
    var camX = repouso[0] + camL[0], camY = repouso[1] + camL[1], camZ = repouso[2] + camL[2];
    var D = zMundo(alvo, t), d0 = D - camZ, k = d0 / zoom;            // distância em repouso e fator do parallax
    if (d0 <= 1) { d0 = zoom; k = 1; }
    var b = caixaCamada(alvo, t, 0);
    if (!b) { b = { x0: camX - W * k / 2, y0: camY - H * k / 2, x1: camX + W * k / 2, y1: camY + H * k / 2 }; }
    var w = (b.x1 - b.x0) / k, h = (b.y1 - b.y0) / k;                 // tamanho como aparece no quadro em repouso
    var X = (b.x0 + b.x1) / 2, Y = (b.y0 + b.y1) / 2, MAXM = 4;
    var mFit = Math.min(preench * W / Math.max(1, w), preench * H / Math.max(1, h));
    var m, cheio = (w >= W * 0.93 && h >= H * 0.93) || mFit < 1.05;
    if (mPedido) {
      // aproximação escolhida pelo usuário (relativa à parada anterior): centra no conteúdo do alvo
      // sem nunca mostrar fora do flyer (a janela da câmera fica dentro do quadro)
      m = Math.max(1, Math.min(12, mPedido)); cheio = false;
      var sx = W / 2 + (X - camX) / k, sy = H / 2 + (Y - camY) / k, hw = W / (2 * m), hh = H / (2 * m);
      sx = Math.max(hw, Math.min(W - hw, sx)); sy = Math.max(hh, Math.min(H - hh, sy));
      X = camX + (sx - W / 2) * k; Y = camY + (sy - H / 2) * k;
    } else if (cheio) {
      // alvo já ocupa o quadro: só um empurrãozinho, mirando o terço de cima do conteúdo
      m = 1 + 0.15 * (preench / 0.8);
      var meia = H * k / (2 * m);
      Y = Math.max(b.y0 + meia, Math.min(b.y1 - meia, b.y0 + (b.y1 - b.y0) * 0.3));
      var meiaX = W * k / (2 * m); X = Math.max(b.x0 + meiaX, Math.min(b.x1 - meiaX, X));
    } else { m = Math.max(1, Math.min(MAXM, mFit)); }
    // o conteúdo nunca sai do quadro: a caixa ampliada tem que caber com margem
    if (!mPedido) { m = Math.min(m, Math.max(1, 0.97 * Math.min(W / Math.max(1, w), H / Math.max(1, h))) * (cheio ? 10 : 1)); }
    var dist = d0 / m;
    // não atravessar camadas que estão na frente do alvo (fica uma folga)
    var zFrente = null, i, l, zl;
    for (i = 1; i <= c.numLayers; i++) {
      l = c.layer(i);
      if (l === alvo || l === r.cam || l === r.ctrl || l.parent || !visivelEm(l, t) || !l.threeDLayer || ehSobreposicao(c, l)) { continue; }
      zl = zMundo(l, t);
      if (zl < D - 1 && (zFrente === null || zl > zFrente)) { zFrente = zl; }
    }
    if (zFrente !== null) {
      var folga = Math.max(20, d0 * 0.02), minDist = D - zFrente + folga;
      if (dist < minDist) { dist = Math.min(minDist, d0); m = d0 / dist; }
    }
    // ponto de foco escolhido pelo usuário na camada (ex.: o rosto): centra nele, sem mostrar fora do flyer
    if (pontoFoco) {
      var pc = pontoCamada(alvo, t, pontoFoco.u, pontoFoco.v);
      if (pc) {
        var px = W / 2 + (pc[0] - camX) / k, py = H / 2 + (pc[1] - camY) / k, hw2 = W / (2 * m), hh2 = H / (2 * m);
        px = Math.max(hw2, Math.min(W - hw2, px)); py = Math.max(hh2, Math.min(H - hh2, py));
        X = camX + (px - W / 2) * k; Y = camY + (py - H / 2) * k;
      }
    }
    return { ctrl: [X - camL[0], Y - camL[1], D - dist - camL[2]], dist: dist, m: m, caixa: { w: w, h: h } };
  }

  function r0zoom(c) { var r = acharCamera(c); try { return r.cam ? r.cam.property('ADBE Camera Options Group').property('ADBE Camera Zoom').value : zoomPadrao(c); } catch (e) { return zoomPadrao(c); } }
  am.camera = function (acao, o) {
    o = o || {};
    return desfazivel('Câmera ' + acao, function () {
      var c = am.findComp(), r, ctrl, p, zoom, t = c.time, lista, i;
      // "inicio" (s): começa nesse tempo em vez da agulha (usado pelos presets da IA)
      if (o.inicio !== undefined && o.inicio !== null && o.inicio !== '' && !isNaN(Number(o.inicio))) { t = Math.max(0, Math.min(c.duration, Number(o.inicio))); }
      if (acao === 'foco') {
        // atualizando um caminho já aplicado: começa no mesmo ponto (o marcador "Início" se o usuário arrastou)
        if (o.atualizar) {
          var rAnt = acharCamera(c), regF = rAnt.ctrl ? lerRegistro(rAnt.ctrl).fx['pontos-foco'] : null;
          if (regF) { var mkA = lerMarcadores(rAnt.ctrl, 'Pontos de foco'); t = mkA ? mkA.i : (regF.x && regF.x.t !== undefined ? regF.x.t : t); }
        }
        var aproxs = [], zooms = [], pontos = [];
        var alvos = [], pausas = [], aberturas = [], viagem = Number(o.viagem) || 1, pausa = Number(o.pausa) || 1, aprox = Math.max(1, Number(o.aproximacao) || 1.6);
        if (o.sequencia && o.sequencia.length) {
          for (i = 0; i < o.sequencia.length; i++) {
            var si = o.sequencia[i], lay = null;
            aberturas.push(si.inicio ? 0 : Math.max(0, Number(si.abertura) || 0));
            // "preenchimento": quanto do quadro o conteúdo do alvo ocupa na parada (0.3–0.95)
            aproxs.push(si.preench ? Math.max(0.2, Math.min(0.95, Number(si.preench))) : 0.8);
            zooms.push(si.zoom === undefined || si.zoom === null || si.zoom === '' ? null : Math.max(-95, Math.min(1000, Number(si.zoom) || 0)));
            if (si.inicio) { alvos.push('INICIO'); pausas.push(si.pausa === undefined ? pausa : Math.max(0, Number(si.pausa))); continue; }
            try { lay = c.layer(Number(si.indice)); } catch (eS) {}
            if (si.nome && (!lay || lay.name !== si.nome)) { lay = null; for (var qn = 1; qn <= c.numLayers; qn++) { if (c.layer(qn).name === si.nome) { lay = c.layer(qn); break; } } }
            if (!lay) { throw new Error('A camada "' + (si.nome || si.indice) + '" não existe mais. Escolha outra nessa parada.'); }
            alvos.push(lay); pausas.push(si.pausa === undefined ? pausa : Math.max(0, Number(si.pausa)));
            pontos[i] = si.ponto && si.ponto.u !== undefined && si.ponto.v !== undefined ? { u: Number(si.ponto.u), v: Number(si.ponto.v) } : null;
          }
        } else { alvos = selecao(c, true); }
        // compatível com o pedido antigo (desfoque: true para todas as paradas)
        if (o.desfoque && !(o.sequencia && o.sequencia.length)) {
          var zc = r0zoom(c), fsAnt = zc / Math.max(5, (Number(o.forcaDesfoque) || 70) * 3);
          aberturas = []; for (i = 0; i < alvos.length; i++) { aberturas.push(fsAnt); }
        }
        ligar3dCena(c);
        r = garantirCamera(c); ctrl = r.ctrl; p = T(ctrl).property('ADBE Position');
        zoom = r.cam.property('ADBE Camera Options Group').property('ADBE Camera Zoom').valueAtTime(t, false);
        var opF = r.cam.property('ADBE Camera Options Group'), mkFoco = lerMarcadores(ctrl, 'Pontos de foco');
        limparTempo(ctrl, 'Pontos de foco', [opF.property('ADBE Camera Aperture'), opF.property('ADBE Camera Focus Distance')]);
        var inicio = p.valueAtTime(t, false), tt = t, kx;
        // o caminho começa na agulha: chaves que já existiam do ponto da agulha em diante saem (ex.: movimento do parallax)
        for (kx = p.numKeys; kx >= 1; kx--) { if (p.keyTime(kx) >= t - 0.0001) { p.removeKey(kx); } }
        // enquadramento inicial = o flyer todo (posição do CAM CTRL sem nenhum movimento)
        var inteiro = p.numKeys ? p.keyValue(1) : inicio;
        lista = [[tt, inicio, 70, 70]];
        var focos = [], abs = [[t, 0]]; // abs: [tempo, f-stop] (0 = sem desfoque)
        var comParent = [];
        var nAlvos = 0, mAnterior = 1;
        for (i = 0; i < alvos.length; i++) {
          if (alvos[i] === 'INICIO') {
            mAnterior = 1;
            tt += i === 0 && tt === t ? 0 : viagem; if (tt > t) { lista.push([tt, inteiro, 80, 80]); } else { lista[0][1] = inteiro; }
            focos.push([tt, zoom]); abs.push([tt, 0]); tt += (pausas.length ? pausas[i] : pausa); lista.push([tt, inteiro, 80, 80]); focos.push([tt, zoom]); abs.push([tt, 0]); nAlvos++;
            continue;
          }
          if (alvos[i] === r.cam || alvos[i] === ctrl) { continue; }
          nAlvos++;
          // zoom relativo à parada anterior: +50% = 1,5× o que estava; -30% = 0,7×
          var mPed = zooms[i] === null || zooms[i] === undefined ? null : Math.max(1, mAnterior * (1 + zooms[i] / 100));
          var quadro = enquadrar(c, r, alvos[i], tt + viagem, inteiro, aproxs[i] || 0.8, zoom, alvos, mPed, pontos[i] || null);
          mAnterior = quadro.m;
          var destino = quadro.ctrl;
          tt += viagem; lista.push([tt, destino, 80, 80]);
          focos.push([tt, quadro.dist]); abs.push([tt, aberturas[i] || 0, quadro.dist]);
          tt += (pausas.length ? pausas[i] : pausa); lista.push([tt, destino, 80, 80]);
          focos.push([tt, quadro.dist]); abs.push([tt, aberturas[i] || 0, quadro.dist]);
        }
        if (o.voltar !== false) { tt += viagem; lista.push([tt, inteiro, 80, 70]); focos.push([tt, zoom]); abs.push([tt, 0]); }
        var antesF = {}; antesF[caminhoProp(p)] = temposDe(p); antesF['ap'] = temposDe(opF.property('ADBE Camera Aperture')); antesF['fd'] = temposDe(opF.property('ADBE Camera Focus Distance'));
        for (kx = antesF[caminhoProp(p)].length - 1; kx >= 0; kx--) { if (antesF[caminhoProp(p)][kx] >= t - 0.0001) { antesF[caminhoProp(p)].splice(kx, 1); } }
        chaves(p, lista, 'ease');
        // desfoque por parada: abertura (f-stop) escolhida em cada uma; foco sempre na camada da parada
        var algumDesfoque = false;
        for (i = 0; i < abs.length; i++) { if (abs[i][1] > 0) { algumDesfoque = true; } }
        if (algumDesfoque) {
          var op = r.cam.property('ADBE Camera Options Group'), pa = op.property('ADBE Camera Aperture'), pf = op.property('ADBE Camera Focus Distance');
          op.property('ADBE Camera Depth of Field').setValue(1);
          for (kx = pa.numKeys; kx >= 1; kx--) { if (pa.keyTime(kx) >= t - 0.0001) { pa.removeKey(kx); } }
          for (kx = pf.numKeys; kx >= 1; kx--) { if (pf.keyTime(kx) >= t - 0.0001) { pf.removeKey(kx); } }
          var la = [], fl = [[t, zoom, 70, 70]];
          // abertura proporcional à distância da câmera até o alvo (mesmo desfoque perto ou longe)
          for (i = 0; i < abs.length; i++) { la.push([abs[i][0], abs[i][1] > 0 ? (abs[i][2] || zoom) / abs[i][1] : 0.5, 80, 80]); }
          for (i = 0; i < focos.length; i++) { fl.push([focos[i][0], focos[i][1], 80, 80]); }
          chaves(pa, la, 'ease');
          chaves(pf, fl, 'ease');
          try { if (String(r.cam.comment || '').indexOf(MARCA_DOF) < 0) { r.cam.comment = (r.cam.comment ? r.cam.comment + ' ' : '') + MARCA_DOF; } } catch (eM) {}
        }
        // marcadores Início/Fim no CAM CTRL controlam o tempo de todo o caminho
        var antesMap = {}; antesMap[caminhoProp(p)] = antesF[caminhoProp(p)];
        antesMap[caminhoProp(opF.property('ADBE Camera Aperture'))] = []; antesMap[caminhoProp(opF.property('ADBE Camera Focus Distance'))] = [];
        if (aplicarTempo(ctrl, 'Pontos de foco', antesMap, [p, opF.property('ADBE Camera Aperture'), opF.property('ADBE Camera Focus Distance')], 'thisComp.layer("CAM CTRL")')) { manterMarcadores(ctrl, 'Pontos de foco', null); }
        // guarda o caminho no CAM CTRL para dar para editar e atualizar depois (aba Câmera ou Editar)
        if (o.sequencia && o.sequencia.length) {
          var seqG = [];
          for (i = 0; i < o.sequencia.length; i++) { var sq = o.sequencia[i]; seqG.push(sq.inicio ? { inicio: true, pausa: Number(sq.pausa) || 0 } : { indice: Number(sq.indice) || 0, nome: String(sq.nome || ''), pausa: Number(sq.pausa) || 0, abertura: Number(sq.abertura) || 0, preench: Number(sq.preench) || 0.8, zoom: sq.zoom === undefined ? null : Number(sq.zoom) || 0, ponto: sq.ponto && sq.ponto.u !== undefined ? { u: Number(sq.ponto.u), v: Number(sq.ponto.v) } : null }); }
          registrar(ctrl, 'pontos-foco', { paradas: seqG.length, viagem: viagem, voltar: o.voltar !== false }, { t: t, sequencia: seqG, repouso: inteiro });
        }
        return { mensagem: (o.atualizar ? 'Caminho atualizado: ' : 'Câmera passando por ') + nAlvos + ' parada(s), de ' + t.toFixed(2) + 's até ' + tt.toFixed(2) + 's. Arraste os marcadores Início/Fim do CAM CTRL para mudar o tempo.' + (comParent.length ? ' Puladas por terem parent: ' + comParent.join(', ') + '.' : '') };
      }
      // ---------- efeitos de câmera (todos começam na agulha; marcadores Início/Fim no CAM CTRL controlam o tempo) ----------
      var EFEITOS_CAM = { 'entrada-fundo': 'Entrada pelo fundo', wiggle: 'Câmera na mão', dolly: 'Dolly zoom', orbita: 'Órbita', descida: 'Descida pelo flyer', lateral: 'Revelação lateral', 'zoom-batida': 'Zoom na batida', impacto: 'Tremida de impacto', rack: 'Rack focus', fuga: 'Final de fuga' };
      if (EFEITOS_CAM[acao]) {
        var nomeE = EFEITOS_CAM[acao];
        ligar3dCena(c);
        r = garantirCamera(c); ctrl = r.ctrl; p = T(ctrl).property('ADBE Position');
        // editando pela aba Editar: tira o efeito anterior e mantém o mesmo ponto da timeline
        var regAnt = lerRegistro(ctrl).fx['cam-' + acao];
        if (regAnt && o.editar) { var mkE = lerMarcadores(ctrl, nomeE); t = mkE ? mkE.i : (regAnt.x.t || t); }
        if (regAnt) { REMOVER_CAM(ctrl, regAnt, nomeE); desregistrar(ctrl, 'cam-' + acao); }
        // os movimentos vão no CAM FX (deslocamento somado ao caminho do CAM CTRL, que fica intacto)
        var fxL = garantirFX(c, r), pP = T(fxL).property('ADBE Position');
        var opC = r.cam.property('ADBE Camera Options Group'), pZoom = opC.property('ADBE Camera Zoom'), pRotY = T(fxL).property('ADBE Rotate Y'), pRotZ = T(fxL).property('ADBE Rotate Z');
        var pFoc = opC.property('ADBE Camera Focus Distance'), pAb = opC.property('ADBE Camera Aperture');
        var W = c.width, H = c.height, du = Math.max(0.1, Number(o.duracao) || 2), fdC = c.frameDuration;
        var zoomC = pZoom.valueAtTime(t, false), camLC = T(r.cam).property('ADBE Position').value;
        var rep0 = p.numKeys ? p.keyValue(1) : p.valueAtTime(t, false);       // enquadramento do flyer todo
        var base = p.valueAtTime(t, false);
        var plano0 = rep0[2] + camLC[2];                                        // z da câmera em repouso
        var antesC = {}, todasC = [pP, pZoom, pRotY, pRotZ, pFoc, pAb], qC;
        limparTempo(ctrl, nomeE, [pZoom, pFoc, pAb, pP, pRotY, pRotZ]);
        for (qC = 0; qC < todasC.length; qC++) { antesC[caminhoProp(todasC[qC])] = temposDe(todasC[qC]); }
        var usados = [], msgC = '';
        // tira chaves deste trecho que sobraram de uma aplicação anterior deste efeito (só nas propriedades do CAM FX
        // e da lente; o caminho do CAM CTRL nunca é apagado)
        var limparTrecho = function (prop) { for (var kk = prop.numKeys; kk >= 1; kk--) { var tk = prop.keyTime(kk); if (tk > t + 0.0001 && tk < t + du - 0.0001) { prop.removeKey(kk); } } };
        var fr = c.frameDuration;
        // deslocamento que leva a câmera a um enquadramento ABSOLUTO no tempo tk, considerando o CAM CTRL naquele tempo
        var paraAlvo = function (tk, alvo) { var cv = p.valueAtTime(tk, false); return [alvo[0] - cv[0], alvo[1] - cv[1], alvo[2] - cv[2]]; };
        // antes do efeito o deslocamento é zero (não muda nada antes da agulha); depois, se o CAM CTRL tem animação
        // mais à frente, volta a zero em 0,5 s para não deslocar o resto do caminho
        var depoisTem = function (tf) { for (var kk = 1; kk <= p.numKeys; kk++) { if (p.keyTime(kk) > tf + 0.0001) { return true; } } return false; };
        var bordaIni = null, bordaFim = null;
        var comBordas = function (lista, zero) {
          var out = lista.slice(0);
          if (t - fr > 0) { out.unshift([t - fr, zero, 50, 50]); bordaIni = bordaIni === null ? t - fr : Math.min(bordaIni, t - fr); }
          var tf = lista[lista.length - 1][0];
          if (depoisTem(tf)) { var tv = Math.min(c.duration, tf + 0.5); out.push([tv, zero, 60, 60]); bordaFim = bordaFim === null ? tv : Math.max(bordaFim, tv); }
          return out;
        };
        // somar um deslocamento ao que já existe (não destrói o caminho que já estava no CAM CTRL)
        var somar = function (prop, lista) { var out = [], q; for (q = 0; q < lista.length; q++) { var bv = prop.valueAtTime(lista[q][0], false), d = lista[q][1], v; if (bv instanceof Array) { v = []; for (var z = 0; z < bv.length; z++) { v.push(bv[z] + (d[z] || 0)); } } else { v = bv + d; } out.push([lista[q][0], v, lista[q][2], lista[q][3]]); } return out; };
        if (acao === 'dolly') {
          // câmera recua (ou avança) enquanto a lente compensa: o plano do flyer fica do mesmo tamanho e o fundo "estica"
          var a = Math.max(0.05, Math.min(1, (Number(o.intensidade) || 50) / 100)) * 1.5, sinalD = o.direcao === 'aproxima' ? -1 : 1;
          var dRep = 0 - (base[2] + camLC[2]); if (dRep <= 1) { dRep = zoomC; }
          var fator = sinalD > 0 ? 1 + a : 1 / (1 + a), dzD = -(dRep * fator - dRep);
          chaves(pP, somar(pP, comBordas([[t, [0, 0, 0], 40, 40], [t + du, [0, 0, dzD], 60, 40]], [0, 0, 0])), 'ease');
          chaves(pZoom, somar(pZoom, comBordas([[t, 0, 40, 40], [t + du, zoomC * (fator - 1), 60, 40]], 0)), 'ease');
          usados = [pP, pZoom]; msgC = (sinalD > 0 ? 'recua' : 'avança') + ' e a lente compensa (' + Math.round(a / 1.5 * 100) + '%)';
        } else if (acao === 'orbita') {
          var g = Math.max(1, Math.min(60, Number(o.graus) || 15)) * (o.sentido === 'esquerda' ? -1 : 1);
          limparTrecho(pRotY);
          // curva igual à dos efeitos: [saída do 1º keyframe, chegada no último]; no meio a volta é sempre suave
          var curO = o.curva || 'termina-devagar', infO = { suave: [70, 70], forte: [95, 95], 'comeca-devagar': [85, 40], 'termina-devagar': [40, 85] }[curO] || [70, 70];
          if (curO === 'linear') { chaves(pRotY, somar(pRotY, [[t, 0], [t + du / 2, g], [t + du, 0]]), 'linear'); }
          else { chaves(pRotY, somar(pRotY, [[t, 0, 50, infO[0]], [t + du / 2, g, 50, 50], [t + du, 0, infO[1], 50]]), 'ease'); }
          usados = [pRotY]; msgC = Math.abs(g) + '° para a ' + (g < 0 ? 'esquerda' : 'direita') + ' e volta de frente';
        } else if (acao === 'descida' || acao === 'lateral') {
          // percorre o flyer aproximado, sem nunca mostrar fora dele
          var mm = Math.max(acao === 'lateral' ? 1 : 1.1, Math.min(6, Number(o.zoom) || (acao === 'descida' ? 1.8 : 1.3)));
          var dR = 0 - plano0; if (dR <= 1) { dR = zoomC; }
          var zDest = rep0[2] + (dR - dR / mm), hw = W / (2 * mm), hh = H / (2 * mm), ini, fimP;
          if (acao === 'descida') {
            var quanto = Math.max(0.05, Math.min(1, (Number(o.quanto) || 100) / 100)), yTopo = hh, yBase = H - hh;
            var desce = o.direcao !== 'subir';
            var y0 = desce ? yTopo : yBase, y1 = desce ? yTopo + (yBase - yTopo) * quanto : yBase - (yBase - yTopo) * quanto;
            ini = [rep0[0], rep0[1] + (y0 - H / 2), zDest]; fimP = [rep0[0], rep0[1] + (y1 - H / 2), zDest];
            msgC = (desce ? 'desce' : 'sobe') + ' ' + Math.round(quanto * 100) + '% do flyer com ' + mm + '×';
          } else {
            var paraDireita = o.direcao !== 'esquerda', xE = hw, xD = W - hw;
            // sem zoom (1×) não sobra flyer dos lados: a câmera anda 10% da largura só para o parallax aparecer
            if (xD - xE < W * 0.1) { xE = W / 2 - W * 0.05; xD = W / 2 + W * 0.05; }
            ini = [rep0[0] + ((paraDireita ? xE : xD) - W / 2), rep0[1], zDest]; fimP = [rep0[0] + ((paraDireita ? xD : xE) - W / 2), rep0[1], zDest];
            msgC = 'desliza para a ' + (paraDireita ? 'direita' : 'esquerda') + (mm < 1.1 ? ' sem zoom (as bordas do fundo podem aparecer um pouco; se aparecerem, use 1,1×)' : ' com ' + mm + '×');
          }
          limparTrecho(pP);
          chaves(pP, somar(pP, comBordas([[t, paraAlvo(t, ini), 30, 30], [t + du, paraAlvo(t + du, fimP), 45, 30]], [0, 0, 0])), 'ease');
          usados = [pP];
        } else if (acao === 'impacto') {
          var px = Math.max(2, Math.min(300, Number(o.intensidade) || 40)), rndI = semAleatorio(97), listaI = [], listaR = [], tI;
          du = Math.max(0.15, Math.min(3, Number(o.duracao) || 0.6));
          limparTrecho(pP); limparTrecho(pRotZ);
          for (tI = 0; tI <= du + 0.0001; tI += fdC) {
            var dec = Math.pow(1 - tI / du, 2), ox = tI >= du ? 0 : (rndI() * 2 - 1) * px * dec, oy = tI >= du ? 0 : (rndI() * 2 - 1) * px * dec;
            listaI.push([t + tI, [ox, oy, 0]]); listaR.push([t + tI, tI >= du ? 0 : (rndI() * 2 - 1) * px * 0.04 * dec]);
          }
          chaves(pP, somar(pP, listaI), 'linear'); chaves(pRotZ, somar(pRotZ, listaR), 'linear');
          usados = [pP, pRotZ]; msgC = '±' + px + ' px por ' + du + 's';
        } else if (acao === 'zoom-batida') {
          var refA = acharAudio(c, o.audio), deslA = deslAudio(refA.comp, c), ampA = amplitudeDoAudio(c, refA, o.canal);
          var forcaA = Math.max(0.02, Math.min(1, (Number(o.intensidade) || 40) / 100)) * 0.25, limA = 0.3, nivA = 0, listaZ = [], tA;
          var t1A = Math.min(c.duration, ampA.fim - deslA);
          for (tA = t; tA < t1A; tA += fdC * 2) {
            var kA = ampA.valor(tA + deslA); kA = kA <= limA ? 0 : (kA - limA) / (1 - limA);
            nivA = kA > nivA ? kA : nivA * 0.6 + kA * 0.4;
            listaZ.push([tA, zoomC * forcaA * nivA]);
          }
          if (!listaZ.length) { throw new Error('O áudio não toca a partir da agulha.'); }
          listaZ.push([Math.min(c.duration, tA), 0]);
          // soma ao zoom que já existe (dolly, etc.) em vez de substituir
          chaves(pZoom, somar(pZoom, listaZ), 'linear'); du = tA - t;
          usados = [pZoom]; msgC = 'empurrões no ritmo de "' + refA.camada.name + '"';
        } else if (acao === 'rack') {
          var achar = function (nm) { for (var q = 1; q <= c.numLayers; q++) { if (c.layer(q).name === nm) { return c.layer(q); } } return null; };
          // "inicial" (ou vazio): começa com toda a arte nítida e o foco vai fechando na camada de destino
          var inicial = !o.de || o.de === 'inicial', la = inicial ? null : achar(o.de), lb = achar(o.para);
          if ((!inicial && !la) || !lb) { throw new Error('Escolha as camadas do rack focus (de onde começa e para qual camada vai).'); }
          var fsR = Math.max(0.5, Math.min(22, Number(o.abertura) || 2.8)), camZr = base[2] + camLC[2];
          var dB = Math.max(1, zMundo(lb, t + du) - camZr), dA = inicial ? dB : Math.max(1, zMundo(la, t) - camZr);
          opC.property('ADBE Camera Depth of Field').setValue(1);
          limparTrecho(pFoc); limparTrecho(pAb);
          chaves(pFoc, [[t, dA, 40, 40], [t + du, dB, 70, 40]], 'ease');
          chaves(pAb, [[t, inicial ? 0.5 : dA / fsR, 40, 40], [t + du, dB / fsR, 70, 40]], 'ease');
          try { if (String(r.cam.comment || '').indexOf(MARCA_DOF) < 0) { r.cam.comment = (r.cam.comment ? r.cam.comment + ' ' : '') + MARCA_DOF; } } catch (eM) {}
          usados = [pFoc, pAb]; msgC = (inicial ? 'do foco inicial (tudo nítido)' : 'de "' + la.name + '"') + ' para "' + lb.name + '" com f/' + fsR;
        } else if (acao === 'fuga') {
          // atravessa o flyer até passar do fundo (a câmera "some" dentro da arte)
          var zFu = -1e12, lu;
          for (qC = 1; qC <= c.numLayers; qC++) { lu = c.layer(qC); if (lu === r.cam || lu === ctrl || lu.parent || !visivelEm(lu, t) || ehSobreposicao(c, lu)) { continue; } zFu = Math.max(zFu, zMundo(lu, t)); }
          if (zFu < -1e11) { zFu = 0; }
          var alvoZ = zFu - camLC[2] + Math.max(200, zoomC * 0.2), dzF = alvoZ - p.valueAtTime(t + du, false)[2];
          limparTrecho(pP);
          // curva de velocidade: [saída do 1º keyframe, chegada no último]
          var curF = o.curva || 'termina-devagar', infF = { 'termina-devagar': [10, 95], 'comeca-devagar': [90, 10], suave: [70, 70], forte: [95, 95] }[curF] || [10, 95];
          if (curF === 'linear') { chaves(pP, somar(pP, comBordas([[t, [0, 0, 0]], [t + du, [0, 0, dzF]]], [0, 0, 0])), 'linear'); }
          else { chaves(pP, somar(pP, comBordas([[t, [0, 0, 0], 30, infF[0]], [t + du, [0, 0, dzF], infF[1], 30]], [0, 0, 0])), 'ease'); }
          usados = [pP];
        } else if (acao === 'entrada-fundo') {
          // começa aproximada no FUNDO (camada mais distante) e abre até o enquadramento que o CAM CTRL já tem
          du = Math.max(0.2, Number(o.duracao) || 2.5);
          var mIni = Math.max(1.2, Math.min(15, Number(o.zoomInicial) || 5)), fundo = null, zF = -1e12, li, lf;
          for (li = c.numLayers; li >= 1; li--) {
            lf = c.layer(li);
            if (lf === r.cam || lf === ctrl || lf === fxL || lf.parent || !visivelEm(lf, t) || ehSobreposicao(c, lf)) { continue; }
            var zz = zMundo(lf, t); if (zz > zF) { zF = zz; fundo = lf; }
          }
          if (!fundo) { throw new Error('Não achei a camada de fundo nesta comp.'); }
          var camZf = p.valueAtTime(t, false)[2] + camLC[2], d0 = zF - camZf;
          if (d0 <= 1) { d0 = zoomC; }
          var dzE = d0 - d0 / mIni;
          limparTrecho(pP);
          chaves(pP, somar(pP, comBordas([[t, [0, 0, dzE], 50, 10], [t + du, [0, 0, 0], 90, 50]], [0, 0, 0])), 'ease');
          usados = [pP]; msgC = 'começa com ' + mIni + '× no "' + fundo.name + '" e abre até o enquadramento atual';
        } else if (acao === 'wiggle') {
          var amp = Number(o.amplitude) || 12, freq = Math.max(0.2, Number(o.frequencia) || 1.5), rnd = semAleatorio(7), listaW = [];
          du = Number(o.duracao) || (c.duration - t);
          for (var tw = t; tw <= t + du + 0.001; tw += 1 / freq) { listaW.push([tw, tw > t && tw < t + du - 0.001 ? [(rnd() * 2 - 1) * amp, (rnd() * 2 - 1) * amp, 0] : [0, 0, 0], 60, 60]); }
          limparTrecho(pP);
          chaves(pP, somar(pP, listaW), 'ease');
          usados = [pP]; msgC = '±' + amp + ' px, ' + freq + ' Hz'; msgC = 'atravessa até depois do fundo';
        }
        aplicarTempo(ctrl, nomeE, antesC, usados, 'thisComp.layer("CAM CTRL")');
        var listaP = []; for (qC = 0; qC < usados.length; qC++) { var ehFx = false; try { ehFx = usados[qC].propertyGroup(usados[qC].propertyDepth) === fxL; } catch (eF) { ehFx = usados[qC] === pP || usados[qC] === pRotY || usados[qC] === pRotZ; } listaP.push((ehFx ? 'fx:' : '') + caminhoProp(usados[qC])); }
        var oSalvo = copiaSimples(o); delete oSalvo.editar;
        registrar(ctrl, 'cam-' + acao, oSalvo, { t: t, fim: t + du, ini: bordaIni === null ? t : bordaIni, ate: bordaFim === null ? t + du : bordaFim, props: listaP });
        return { mensagem: nomeE + ': ' + msgC + ', a partir de ' + t.toFixed(2) + 's (' + du.toFixed(1) + 's). Arraste os marcadores Início/Fim do CAM CTRL para mudar o tempo.' };
      }
      throw new Error('Ação de câmera desconhecida: ' + acao);
    });
  };

  // ---------- PARALLAX 2.5D ----------
  var MARCA_PX = 'arcano-parallax:';

  // A guarda do parallax fica na 1ª linha do comentário (o resto do comentário — inclusive o registro do Arcano — fica intacto)
  function lerGuardaPx(l) {
    var txt = '', fim, g = null;
    try { txt = String(l.comment || ''); } catch (e) { return null; }
    if (txt.indexOf(MARCA_PX) !== 0) { return null; }
    fim = txt.indexOf('\n'); if (fim < 0) { fim = txt.length; }
    try { g = eval('(' + txt.substring(MARCA_PX.length, fim) + ')'); } catch (e2) { g = null; }
    if (g) { g.__resto = g.cm !== undefined ? String(g.cm) : txt.substring(fim + 1); }
    return g;
  }
  function gravarGuardaPx(l, g) {
    var txt = String(l.comment || '');
    try { l.comment = MARCA_PX + ser(g) + (txt ? '\n' + txt : ''); } catch (e) {}
  }

  function temFilhos(c, l) { for (var i = 1; i <= c.numLayers; i++) { if (c.layer(i).parent === l) { return true; } } return false; }
  function ehPrecomp(l) { try { return l.source instanceof CompItem; } catch (e) { return false; } }
  function ehCamOuLuz(l) { return l instanceof CameraLayer || l instanceof LightLayer; }
  function renderiza(l) {
    if (ehCamOuLuz(l)) { return false; }
    try { if (l.guideLayer) { return false; } } catch (e) {}
    try { if (!l.hasVideo && !l.nullLayer) { return false; } } catch (e2) {}
    return true;
  }
  // precomp do tamanho da comp de fora, centralizada e sem transformação própria: dá para espaçar o interior
  function precompNeutra(l, w, h) {
    try {
      var s = l.source, tg = T(l), p = tg.property('ADBE Position'), a = tg.property('ADBE Anchor Point'), e = tg.property('ADBE Scale'), pv = p.value, av = a.value, ev = e.value, nomes = ['ADBE Rotate X', 'ADBE Rotate Y', 'ADBE Rotate Z'], q, o;
      if (s.width !== w || s.height !== h || l.parent) { return false; }
      if (p.numKeys || a.numKeys || e.numKeys || p.expression || e.expression || p.dimensionsSeparated) { return false; }
      if (Math.abs(pv[0] - w / 2) > 0.5 || Math.abs(pv[1] - h / 2) > 0.5 || (pv.length > 2 && Math.abs(pv[2]) > 0.5)) { return false; }
      if (Math.abs(av[0] - w / 2) > 0.5 || Math.abs(av[1] - h / 2) > 0.5) { return false; }
      if (Math.abs(ev[0] - 100) > 0.01 || Math.abs(ev[1] - 100) > 0.01) { return false; }
      for (q = 0; q < nomes.length; q++) { o = tg.property(nomes[q]); if (o && (o.numKeys || Math.abs(o.value) > 0.001)) { return false; } }
      o = tg.property('ADBE Orientation'); if (o && (o.numKeys || o.value[0] || o.value[1] || o.value[2])) { return false; }
      return true;
    } catch (e3) { return false; }
  }

  // Liga 3D (e Collapse nas precomps) em toda a hierarquia, guardando como estava
  function ligar3dHierarquia(c, visto, pr) {
    var i, l, g;
    if (visto[c.id]) { return; }
    visto[c.id] = true;
    for (i = 1; i <= c.numLayers; i++) {
      l = c.layer(i);
      if (l === pr.cam || l === pr.ctrl || !renderiza(l)) { continue; }
      if (ehSobreposicao(c, l)) { continue; }
      g = lerGuardaPx(l);
      if (!g) {
        g = { t3d: !!l.threeDLayer, col: null };
        gravarGuardaPx(l, g);
      }
      try { if (!l.threeDLayer) { l.threeDLayer = true; } } catch (e) {}
      // NUNCA mexe no Collapse Transformations: ligar à força faz luzes/texturas do PSD (Linear Dodge, Screen,
      // "preservar transparência") vazarem para a cena toda e estourarem a arte. Só desce nas precomps que JÁ
      // estavam colapsadas; as outras viram um plano só (3D na própria camada) e a recursão para ali.
      if (ehPrecomp(l) && l.collapseTransformation) {
        pr.precomps[l.source.id] = l.source;
        ligar3dHierarquia(l.source, visto, pr);
      }
    }
  }

  // muda posição (valor ou cada keyframe) e escala de uma camada; guarda os originais
  function moverCamadaPx(l, fn, kEsc, pr) {
    var pos = T(l).property('ADBE Position'), esc = T(l).property('ADBE Scale'), j, v, g = lerGuardaPx(l) || {};
    if (pos.expression || esc.expression || pos.dimensionsSeparated) { pr.pulados.push(l.name); return false; }
    g.pk = []; g.sk = []; g.p = null; g.s = null; g.sp = true;
    if (pos.numKeys) { for (j = 1; j <= pos.numKeys; j++) { v = pos.keyValue(j); g.pk.push(v); pos.setValueAtKey(j, fn(v)); } }
    else { v = pos.value; g.p = v; pos.setValue(fn(v)); }
    if (esc.numKeys) { for (j = 1; j <= esc.numKeys; j++) { v = esc.keyValue(j); g.sk.push(v); esc.setValueAtKey(j, [v[0] * kEsc, v[1] * kEsc, v[2]]); } }
    else { v = esc.value; g.s = v; esc.setValue([v[0] * kEsc, v[1] * kEsc, v[2]]); }
    var resto = g.__resto; delete g.__resto;
    try { l.comment = MARCA_PX + ser(g) + (resto ? '\n' + resto : ''); } catch (e) {}
    return true;
  }

  // camadas que ganham profundidade própria: sem parent, que renderizam; nulls só se forem pais de alguém
  function elegiveisPx(c, pr) {
    var i, l, lista = [];
    for (i = 1; i <= c.numLayers; i++) {
      l = c.layer(i);
      if (l === pr.cam || l === pr.ctrl || l.parent || !renderiza(l)) { continue; }
      if (l.nullLayer && !temFilhos(c, l)) { continue; }
      // luz/textura/efeito de quadro cheio e camadas de ajuste ficam 2D e fora da profundidade (senão somem no foco)
      if (ehSobreposicao(c, l)) { continue; }
      lista.push(l);
    }
    return lista;
  }

  // interior de uma precomp neutra (Collapse ligado): zPai = z no mundo do plano da precomp, sPai = escala acumulada (x/y) até ela
  // fatia = espaço em Z que a precomp tem até a próxima camada de fora: o interior se espalha DENTRO dessa fatia,
  // senão uma camada de dentro vai parar atrás do fundo e some
  function espacarInterior(comp, zPai, sPai, pr, nivel, fatia) {
    if (nivel > 6 || pr.feitas[comp.id]) { return; }
    pr.feitas[comp.id] = true;
    var ls = elegiveisPx(comp, pr), i, l, cxp = comp.width / 2, cyp = comp.height / 2, passo = (fatia === undefined ? pr.base : fatia) / Math.max(1, ls.length);
    for (i = 0; i < ls.length; i++) {
      l = ls[i];
      var dInt = i * passo, pv = T(l).property('ADBE Position').value, z0 = pv.length > 2 ? pv[2] : 0;
      var dw = zPai + z0 + dInt - pr.camZ;
      if (dw <= 1) { pr.pulados.push(l.name); continue; }
      var kRel = dw / (sPai * pr.zoom);
      (function (k, dz) {
        moverCamadaPx(l, function (v) { return [cxp + (v[0] - cxp) * k, cyp + (v[1] - cyp) * k, (v.length > 2 ? v[2] : 0) + dz]; }, k, pr);
      })(kRel, dInt);
      pr.n++; pr.interno++;
      if (ehPrecomp(l) && precompNeutra(l, comp.width, comp.height)) { espacarInterior(l.source, zPai + z0 + dInt, sPai * kRel, pr, nivel + 1, passo); }
    }
  }

  function aplicarParallax(c, intensidade, movimento) {
    removerParallax(c); // reaplicar sempre parte do original
    var r = garantirCamera(c), cxc = c.width / 2, cyc = c.height / 2;
    var zoom = r.cam.property('ADBE Camera Options Group').property('ADBE Camera Zoom').valueAtTime(0, false);
    var pc = T(r.ctrl).property('ADBE Position').valueAtTime(0, false), lc = T(r.cam).property('ADBE Position').valueAtTime(0, false);
    var pr = { cam: r.cam, ctrl: r.ctrl, zoom: zoom, base: Math.max(0.1, intensidade), camX: pc[0] + lc[0], camY: pc[1] + lc[1], camZ: pc[2] + lc[2], pulados: [], precomps: {}, feitas: {}, n: 0, interno: 0 };
    // 1) 3D em tudo, inclusive dentro das precomps, e Collapse nas precomps
    var eraT3d = {}, i, l, ls = elegiveisPx(c, pr);
    for (i = 0; i < ls.length; i++) { eraT3d[i] = !!ls[i].threeDLayer; }
    ligar3dHierarquia(c, {}, pr);
    // 2) profundidade na comp ativa: a de cima fica na frente; compensação para a imagem parada ficar igual
    var zFoco = null;
    for (i = 0; i < ls.length; i++) {
      l = ls[i];
      var pv = T(l).property('ADBE Position').value, z0 = pv.length > 2 ? pv[2] : 0, d = i * pr.base, zN = z0 + d;
      if (zN - pr.camZ <= 1 || (eraT3d[i] && z0 - pr.camZ <= 1)) { pr.pulados.push(l.name); continue; }
      var ok;
      if (!eraT3d[i]) {
        // era 2D: aparecia sem perspectiva, centrado na comp
        var k2 = (zN - pr.camZ) / zoom;
        ok = moverCamadaPx(l, function (v) { return [pr.camX + (v[0] - cxc) * k2, pr.camY + (v[1] - cyc) * k2, (v.length > 2 ? v[2] : 0) + d]; }, k2, pr);
        if (ok && zFoco === null) { zFoco = zN; }
        // distância só entre as camadas da comp mãe: dentro das precomps tudo fica no mesmo plano da precomp
        // (3D + Collapse ligados, mas sem afastar), senão uma camada de dentro pode ir para trás do fundo
        if (ok) { pr.n++; }
      } else {
        // já era 3D: mantém a perspectiva que tinha
        var k3 = (zN - pr.camZ) / (z0 - pr.camZ);
        ok = moverCamadaPx(l, function (v) { return [pr.camX + (v[0] - pr.camX) * k3, pr.camY + (v[1] - pr.camY) * k3, (v.length > 2 ? v[2] : 0) + d]; }, k3, pr);
        if (ok && zFoco === null) { zFoco = zN; }
        if (ok) { pr.n++; }
      }
    }
    if (movimento && movimento !== 'nenhum') {
      var p = T(r.ctrl).property('ADBE Position');
      if (!p.numKeys) {
        var b = p.value, fim = b.slice(0);
        if (movimento === 'lateral') { fim[0] += c.width * 0.06; } else { fim[2] += zoom * 0.12; }
        chaves(p, [[0, b, 30, 30], [c.duration, fim, 30, 30]], 'ease');
      }
    }
    var np = 0, k; for (k in pr.precomps) { if (pr.precomps.hasOwnProperty(k)) { np++; } }
    return { camadas: pr.n, internas: pr.interno, precomps: np, pulados: pr.pulados, zFoco: zFoco, cam: r.cam, ctrl: r.ctrl, zoom: zoom };
  }

  // Volta tudo como estava (posição, escala, 3D e Collapse), na comp e dentro das precomps
  function removerParallax(c) {
    var n = 0, visto = {};
    function varrer(comp) {
      var i, l, g, pos, esc, j;
      if (visto[comp.id]) { return; }
      visto[comp.id] = true;
      for (i = 1; i <= comp.numLayers; i++) {
        l = comp.layer(i);
        g = lerGuardaPx(l);
        if (g) {
          pos = T(l).property('ADBE Position'); esc = T(l).property('ADBE Scale');
          try {
            if (g.pk && g.pk.length) { for (j = 0; j < g.pk.length && j < pos.numKeys; j++) { pos.setValueAtKey(j + 1, g.pk[j]); } } else if (g.p) { pos.setValue(g.p.length > 2 ? g.p : [g.p[0], g.p[1], 0]); }
            if (g.sk && g.sk.length) { for (j = 0; j < g.sk.length && j < esc.numKeys; j++) { esc.setValueAtKey(j + 1, g.sk[j]); } } else if (g.s) { esc.setValue(g.s); }
          } catch (eV) {}
          try { if (g.col !== null && g.col !== undefined) { l.collapseTransformation = !!g.col; } } catch (eC) {}
          try { l.threeDLayer = !!g.t3d; } catch (e3) {}
          try { l.comment = g.__resto || ''; } catch (eM) {}
          if (g.sp) { n++; }
        }
        if (ehPrecomp(l)) { varrer(l.source); }
      }
    }
    varrer(c);
    return n;
  }

  // Desfoque de profundidade: a primeira camada (a de cima) é o ponto de foco; o resto desfoca pela distância.
  // abertura = f-stop (1.4 = muito desfoque … 22 = quase nada). Aperture do After (px) ≈ zoom / f-stop.
  var MARCA_DOF = '[arcano-dof]';
  function aplicarDesfoqueCamera(c, r, fstop, zFoco) {
    var op = r.cam.property('ADBE Camera Options Group'), fd = op.property('ADBE Camera Focus Distance');
    var zoom = op.property('ADBE Camera Zoom').value, camZ = T(r.cam).property('ADBE Position').value[2], pc = T(r.ctrl).property('ADBE Position'), k, lista = [];
    op.property('ADBE Camera Depth of Field').setValue(1);
    op.property('ADBE Camera Aperture').setValue(Math.max(1, zoom / fstop));
    apagarChaves(fd);
    // distância da câmera até o plano da camada de foco (acompanha o CAM CTRL se ele andar em Z)
    if (pc.numKeys) {
      for (k = 1; k <= pc.numKeys; k++) { lista.push([pc.keyTime(k), Math.max(1, zFoco - (pc.keyValue(k)[2] + camZ)), 30, 30]); }
      chaves(fd, lista, 'ease');
    } else { fd.setValue(Math.max(1, zFoco - (pc.value[2] + camZ))); }
    try { if (String(r.cam.comment || '').indexOf(MARCA_DOF) < 0) { r.cam.comment = (r.cam.comment ? r.cam.comment + ' ' : '') + MARCA_DOF; } } catch (e) {}
  }
  function tirarDesfoqueCamera(c) {
    var r = acharCamera(c), op, txt;
    if (!r.cam) { return false; }
    txt = String(r.cam.comment || '');
    if (txt.indexOf(MARCA_DOF) < 0) { return false; }
    op = r.cam.property('ADBE Camera Options Group');
    op.property('ADBE Camera Depth of Field').setValue(0);
    apagarChaves(op.property('ADBE Camera Focus Distance'));
    apagarChaves(op.property('ADBE Camera Aperture'));
    r.cam.comment = txt.replace(MARCA_DOF, '').replace(/\s+$/, '');
    return true;
  }

  am.parallax = function (acao, o) {
    o = o || {};
    return desfazivel('Parallax ' + acao, function () {
      var c = am.findComp(), i, l, n = 0;
      if (acao === 'aplicar') {
        var r = aplicarParallax(c, Math.max(0.1, Math.min(999.9, Number(o.intensidade) || 100)), o.movimento || 'aproximar');
        var fs = Number(o.abertura) || 0, txtDof = '';
        if (fs > 0 && r.zFoco !== null) { fs = Math.max(0.5, Math.min(64, fs)); aplicarDesfoqueCamera(c, r, fs, r.zFoco); txtDof = ' Desfoque f/' + fs + ' com foco na primeira camada.'; }
        else if (!fs) { tirarDesfoqueCamera(c); }
        return { mensagem: 'Parallax em ' + r.camadas + ' camada(s)' + (r.internas ? ' (' + r.internas + ' dentro de precomps)' : '') + '; 3D ligado' + (r.precomps ? ' (e dentro de ' + r.precomps + ' precomp(s) que já tinham Collapse)' : '') + '. O Collapse das precomps não foi mexido' + (r.pulados.length ? '. Puladas (expressão, posição separada ou atrás da câmera): ' + r.pulados.join(', ') : '') + '. A imagem parada continua igual.' + txtDof };
      }
      if (acao === 'remover') {
        n = removerParallax(c);
        tirarDesfoqueCamera(c);
        return { mensagem: n ? 'Parallax removido de ' + n + ' camada(s). A câmera ficou (apague se não quiser).' : 'Nenhuma camada com parallax do Arcano nesta comp.' };
      }
      throw new Error('Ação de parallax desconhecida: ' + acao);
    });
  };

  // ---------- CURVAS ----------
  am.aplicarCurva = function (entrada, saida, linear) {
    return desfazivel('Curva', function () {
      var c = am.findComp(), sp = c.selectedProperties, i, j, p, n = 0;
      for (i = 0; i < sp.length; i++) {
        p = sp[i];
        if (p.propertyType !== PropertyType.PROPERTY || !p.numKeys || p.matchName === 'ADBE Marker') { continue; }
        try { if (!p.isInterpolationTypeValid(KeyframeInterpolationType.BEZIER)) { continue; } } catch (eI) {}
        var ks = p.selectedKeys;
        for (j = 0; j < ks.length; j++) {
          if (linear) { p.setInterpolationTypeAtKey(ks[j], KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); }
          else { easeNaChave(p, ks[j], entrada, saida); }
          n++;
        }
      }
      if (!n) { throw new Error('Selecione keyframes na timeline (clique ou arraste sobre eles).'); }
      return { mensagem: 'Curva aplicada em ' + n + ' keyframe(s).' };
    });
  };

  am.lerCurva = function () {
    var c = am.findComp(), sp = c.selectedProperties, i, p, k;
    for (i = 0; i < sp.length; i++) {
      p = sp[i];
      if (p.propertyType !== PropertyType.PROPERTY || !p.numKeys || !p.selectedKeys.length || p.matchName === 'ADBE Marker') { continue; }
      try { if (!p.isInterpolationTypeValid(KeyframeInterpolationType.BEZIER)) { continue; } } catch (eI) {}
      k = p.selectedKeys[0];
      return { entrada: p.keyInTemporalEase(k)[0].influence, saida: p.keyOutTemporalEase(k)[0].influence };
    }
    throw new Error('Selecione um keyframe para ler a curva dele.');
  };

  // ---------- BIBLIOTECA (arquivos do próprio usuário) ----------
  function pastaProjeto(nome) {
    var p = app.project, i, it;
    for (i = 1; i <= p.numItems; i++) { it = p.item(i); if (it instanceof FolderItem && it.name === nome) { return it; } }
    return p.items.addFolder(nome);
  }

  function itemJaImportado(caminho) {
    var p = app.project, i, it, f = new File(caminho);
    for (i = 1; i <= p.numItems; i++) {
      it = p.item(i);
      try { if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) { return it; } } catch (e) {}
    }
    return null;
  }

  // Fontes instaladas (After 2024+ tem app.fonts). familia: devolve os estilos com o nome PostScript (o que vai em textDocument.font)
  am.fontes = function (familia) {
    var lista, i, j, f, grupo, fams = {}, nomes = [], alvo = familia ? String(familia).toLowerCase() : '';
    try { lista = app.fonts.allFonts; } catch (e) { lista = null; }
    if (!lista) { return { semApi: true }; }
    for (i = 0; i < lista.length; i++) {
      grupo = (lista[i] && lista[i].familyName === undefined && lista[i].length !== undefined) ? lista[i] : [lista[i]];   // allFonts = famílias (arrays de FontObject)
      for (j = 0; j < grupo.length; j++) {
        f = grupo[j];
        var fam = '', est = '', ps = '';
        try { fam = String(f.familyName || ''); est = String(f.styleName || ''); ps = String(f.postScriptName || ''); } catch (e2) {}
        if (!fam) { continue; }
        if (!fams[fam]) { fams[fam] = []; nomes.push(fam); }
        if (alvo && fam.toLowerCase().indexOf(alvo) >= 0) { fams[fam].push(est + ' = ' + ps); }
      }
    }
    nomes.sort();
    if (!alvo) { return { total: nomes.length, familias: nomes }; }
    var achadas = [];
    for (i = 0; i < nomes.length; i++) { if (nomes[i].toLowerCase().indexOf(alvo) >= 0) { achadas.push({ familia: nomes[i], estilos: fams[nomes[i]] }); } }
    return { busca: familia, familias: achadas };
  };

  // opcoes (a IA usa): { comp, inicio (s), mesclagem: normal|tela|adicionar|sobrepor|luz-suave, opacidade }
  am.usarBiblioteca = function (caminho, tipo, opcoes) {
    opcoes = opcoes || {};
    return desfazivel('Biblioteca', function () {
      var c = am.findComp(opcoes.comp || undefined), f = new File(caminho), item, l, sel = selecao(c, false), nome = decodeURI(f.name).replace(/\.[^.]+$/, '');
      if (!f.exists) { throw new Error('Arquivo não encontrado: ' + caminho); }
      if (/\.aep$/i.test(f.name)) {
        var pasta = app.project.importFile(new ImportOptions(f)), i, comp = null, achados = [];
        pasta.parentFolder = pastaProjeto('Arcano Biblioteca');
        var busca = function (fd) { var k; for (k = 1; k <= fd.numItems; k++) { var it = fd.item(k); if (it instanceof CompItem) { achados.push(it); } else if (it instanceof FolderItem) { busca(it); } } };
        busca(pasta);
        for (i = 0; i < achados.length; i++) { if (achados[i].name.toLowerCase() === nome.toLowerCase()) { comp = achados[i]; } }
        if (!comp && achados.length) {
          // a comp que não é usada dentro de nenhuma outra é a principal
          for (i = 0; i < achados.length && !comp; i++) { if (!achados[i].usedIn.length) { comp = achados[i]; } }
        }
        if (!comp) { throw new Error('O .aep não tem composição.'); }
        item = comp;
      } else {
        item = itemJaImportado(caminho);
        if (!item) { item = app.project.importFile(new ImportOptions(f)); item.parentFolder = pastaProjeto('Arcano Biblioteca'); }
      }
      if (item === c) { throw new Error('Não dá para colocar a comp dentro dela mesma.'); }
      var iniB = (opcoes.inicio !== null && opcoes.inicio !== undefined && !isNaN(opcoes.inicio)) ? Number(opcoes.inicio) : c.time;
      if (tipo === 'sons') {
        // som da biblioteca = EFEITO SONORO: vai para a comp "[AUDIO] Efeitos sonoros", no mesmo tempo
        organizarAudioSolto(c);
        var subS = compDeAudio(c, 'sfx', iniB + (item.duration || 0));
        l = subS.layers.add(item);
        l.startTime = iniB;
        return { mensagem: '"' + l.name + '" colocado em ' + l.startTime.toFixed(2) + 's (comp "' + subS.name + '").', camada: l.name, indice: l.index, comp: subS.name, comp_principal: c.name, inicio: l.startTime, fim: l.outPoint };
      }
      l = c.layers.add(item);
      l.startTime = iniB;
      if (sel.length) { l.moveBefore(sel[0]); }
      // transição, logo animada, overlay: só a IMAGEM — o áudio do arquivo misturava com a narração/trilha
      try { if (l.hasAudio) { l.audioEnabled = false; } } catch (eAu) {}
      if (opcoes.mesclagem) {
        try {
          var MESCLA = { 'normal': BlendingMode.NORMAL, 'tela': BlendingMode.SCREEN, 'screen': BlendingMode.SCREEN, 'adicionar': BlendingMode.ADD, 'add': BlendingMode.ADD, 'sobrepor': BlendingMode.OVERLAY, 'overlay': BlendingMode.OVERLAY, 'luz-suave': BlendingMode.SOFT_LIGHT };
          var modoM = MESCLA[String(opcoes.mesclagem).toLowerCase()];
          if (modoM !== undefined) { l.blendingMode = modoM; }
        } catch (eM) {}
      }
      if (opcoes.opacidade !== null && opcoes.opacidade !== undefined && !isNaN(opcoes.opacidade)) { T(l).property('ADBE Opacity').setValue(Math.max(0, Math.min(100, Number(opcoes.opacidade)))); }
      if (item.width && item.height && (tipo === 'assets' || tipo === 'transicoes') && (item.width !== c.width || item.height !== c.height)) {
        var k2 = Math.max(c.width / item.width, c.height / item.height) * 100;
        T(l).property('ADBE Scale').setValue([k2, k2]);
        T(l).property('ADBE Position').setValue([c.width / 2, c.height / 2]);
      }
      return { mensagem: '"' + l.name + '" colocado em ' + l.startTime.toFixed(2) + 's.', camada: l.name, indice: l.index, comp: c.name, inicio: l.startTime, fim: l.outPoint, largura: item.width || null, altura: item.height || null };
    });
  };


  // ---------- ponto de entrada unico ----------
  // Qual .aep está aberto (o painel guarda o histórico da conversa por projeto)
  am.projetoAtual = function () {
    var p = null;
    try { if (app.project && app.project.file) { p = app.project.file.fsName; } } catch (e) {}
    return { projeto: p };
  };

  // =====================================================================
  // v1.0.30 — BIBLIOTECA DE MOVIMENTOS (aba Animar em pastas)
  // A spec de cada item vem do painel (js/movimentos.js). Tudo em keyframes nativos, editáveis.
  // Seletores de texto (Range/Wiggly) e efeitos nativos onde o After não tem outro jeito.
  // =====================================================================

  // [[tempo, valor, easeEntrada, easeSaida, seguraNaSaida], ...] — ease por chave, "hold" opcional
  function mvChaves(p, lista) {
    var i, li, idx, tempos = [], vals = [];
    lista.sort(function (a, b) { return a[0] - b[0]; });
    for (i = 0; i < lista.length; i++) { tempos.push(lista[i][0]); vals.push(mvDim(p, lista[i][1])); }
    try { p.setValuesAtTimes(tempos, vals); } catch (eV) { for (i = 0; i < lista.length; i++) { p.setValueAtTime(tempos[i], vals[i]); } }
    for (i = 0; i < lista.length; i++) {
      li = lista[i];
      idx = p.nearestKeyIndex(li[0]);
      try { easeNaChave(p, idx, li[2] === undefined ? 70 : li[2], li[3] === undefined ? 70 : li[3]); } catch (e1) {}
      if (li[4]) { try { p.setInterpolationTypeAtKey(idx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.HOLD); } catch (e2) {} }
      if (ehEspacial(p)) {
        try {
          p.setSpatialAutoBezierAtKey(idx, false); p.setSpatialContinuousAtKey(idx, false);
          var z = p.propertyValueType === PropertyValueType.ThreeD_SPATIAL ? [0, 0, 0] : [0, 0];
          p.setSpatialTangentsAtKey(idx, z, z);
        } catch (e3) {}
      }
    }
  }
  // ajusta o tamanho do array ao da propriedade (2D x 3D)
  function mvDim(p, v) {
    if (!(v instanceof Array)) { return v; }
    var atual = null;
    try { atual = p.value; } catch (e) {}
    if (atual instanceof Array && atual.length < v.length) { return v.slice(0, atual.length); }
    if (atual instanceof Array && atual.length > v.length) { var r = v.slice(0); while (r.length < atual.length) { r.push(atual[r.length]); } return r; }
    return v;
  }
  function mvSet(p, v) { try { p.setValue(mvDim(p, v)); } catch (e) {} }

  // chaves de uma lista em u (0..1). Na saída o tempo é espelhado (e os eases trocam de lado).
  function mvChavesU(p, lista, t0, dur, saida, conv) {
    var out = [], i, li, u, a, b, x;
    for (i = 0; i < lista.length; i++) {
      li = lista[i]; u = saida ? 1 - li[0] : li[0]; a = li[2]; b = li[3];
      if (saida) { x = a; a = b; b = x; }
      out.push([t0 + dur * u, conv(li[1]), a, b]);
    }
    mvChaves(p, out);
  }

  function mvCor(hex, padrao) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) { return padrao; }
    var h = m[1];
    return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
  }
  function mvCor4(c) { return [c[0], c[1], c[2], 1]; }
  function mvLinhas(txt) {
    var p = String(txt || '').split(/\r\n|\r|\n/), r = [], i, s;
    for (i = 0; i < p.length; i++) { s = p[i].replace(/^\s+|\s+$/g, ''); if (s) { r.push(s); } }
    return r;
  }

  // ---------------- conversões (closures fora dos laços: ES3) ----------------
  function mvConvPos(base, H, k) { return function (v) { var r = base.slice(0); r[0] = base[0] + v[0] * H * k; r[1] = base[1] + v[1] * H * k; return r; }; }
  function mvConvNum(base, fator) { return function (v) { return base + v * fator; }; }
  function mvConvEscala(base, k) {
    return function (v) {
      var sx = (v instanceof Array) ? v[0] : v, sy = (v instanceof Array) ? v[1] : v;
      return [base[0] * (1 + (sx / 100 - 1) * k), base[1] * (1 + (sy / 100 - 1) * k), base.length > 2 ? base[2] : 100];
    };
  }
  function mvConvOpac(base, k) { return function (v) { return Math.max(0, Math.min(100, base * (1 - (1 - v / 100) * Math.min(1, k)))); }; }

  function mvEfeitoNomeado(l, matchName, nome) {
    var fx = efeitos(l), i;
    for (i = 1; i <= fx.numProperties; i++) { if (fx.property(i).matchName === matchName && fx.property(i).name === nome) { return fx.property(i).propertyIndex; } }
    var e = efeitoObrigatorio(l, matchName, nome);
    try { e.name = nome; } catch (x) {}
    return e.propertyIndex;
  }

  // n-ésimo parâmetro de um efeito com o tipo de valor pedido (ex.: 3º ponto 2D, 2ª cor): não depende do idioma nem dos grupos
  function mvParamTipo(e, tipos, n) {
    var i, p, c = 0, j;
    for (i = 1; i <= e.numProperties; i++) {
      try { p = e.property(i); } catch (x) { continue; }
      for (j = 0; j < tipos.length; j++) { if (p.propertyValueType === tipos[j]) { c++; if (c === n) { return p; } break; } }
    }
    return null;
  }
  var MV_PONTO = [PropertyValueType.TwoD_SPATIAL, PropertyValueType.TwoD], MV_COR = [PropertyValueType.COLOR];


  function mvTexto(c, str, tam, cor, just, fonte, nome) {
    var l = c.layers.addText(str), p = l.property('ADBE Text Properties').property('ADBE Text Document'), td = p.value;
    try { l.name = nome; } catch (e0) {}
    try { td.resetCharStyle(); } catch (e1) {}
    try { td.resetParagraphStyle(); } catch (e2) {}
    td.fontSize = tam; td.applyFill = true; td.fillColor = cor; td.applyStroke = false; td.justification = just;
    try { td.tracking = 0; } catch (e3) {}
    if (fonte) { try { td.font = fonte; } catch (e4) {} }
    try { p.setValue(td); } catch (e5) {
      td = p.value; td.fontSize = tam; td.applyFill = true; td.fillColor = cor; td.justification = just; p.setValue(td);
    }
    return l;
  }
  // âncora no meio da altura do texto e, na horizontal, na esquerda/centro/direita
  function mvAncora(l, t, lado) {
    var r = retanguloCamada(l, t), ax = lado === 'l' ? r.left : (lado === 'r' ? r.left + r.width : r.left + r.width / 2);
    mvSet(T(l).property('ADBE Anchor Point'), [ax, r.top + r.height / 2, 0]);
    return r;
  }
  function mvPos(l, x, y) { mvSet(T(l).property('ADBE Position'), [x, y, 0]); }
  function mvTempo(l, a, b) { try { l.inPoint = a; l.outPoint = b; } catch (e) {} }

  function mvConteudo(l) { return l.property('ADBE Root Vectors Group'); }
  // grupo de forma: d = { forma: 'ret'|'elipse'|'caminho', tam, pos, raio, pontos, cor, traco (largura), aparar }
  function mvGrupoForma(l, d) {
    var gi = mvConteudo(l).addProperty('ADBE Vector Group').propertyIndex;
    var V = function () { return mvConteudo(l).property(gi).property('ADBE Vectors Group'); };
    V().addProperty(d.forma === 'elipse' ? 'ADBE Vector Shape - Ellipse' : (d.forma === 'caminho' ? 'ADBE Vector Shape - Group' : 'ADBE Vector Shape - Rect'));
    if (d.aparar) { V().addProperty('ADBE Vector Filter - Trim'); }
    V().addProperty(d.traco ? 'ADBE Vector Graphic - Stroke' : 'ADBE Vector Graphic - Fill');
    var f = V().property(1);
    if (d.forma === 'elipse') {
      f.property('ADBE Vector Ellipse Size').setValue(d.tam); f.property('ADBE Vector Ellipse Position').setValue(d.pos || [0, 0]);
    } else if (d.forma === 'caminho') {
      var s = new Shape(); s.vertices = d.pontos; s.closed = !!d.fechado; f.property('ADBE Vector Shape').setValue(s);
    } else {
      f.property('ADBE Vector Rect Size').setValue(d.tam); f.property('ADBE Vector Rect Position').setValue(d.pos || [0, 0]);
      try { f.property('ADBE Vector Rect Roundness').setValue(d.raio || 0); } catch (eR) {}
    }
    var g = V().property(d.aparar ? 3 : 2);
    if (d.traco) {
      g.property('ADBE Vector Stroke Color').setValue(mvCor4(d.cor)); g.property('ADBE Vector Stroke Width').setValue(d.traco);
      try { g.property('ADBE Vector Stroke Line Cap').setValue(2); } catch (eC) {}
      try { g.property('ADBE Vector Stroke Line Join').setValue(2); } catch (eJ) {}
    } else { g.property('ADBE Vector Fill Color').setValue(mvCor4(d.cor)); }
    return gi;
  }
  function mvTrim(l, gi, qual) { return mvConteudo(l).property(gi).property('ADBE Vectors Group').property(2).property(qual === 'ini' ? 'ADBE Vector Trim Start' : 'ADBE Vector Trim End'); }


  function mvSolido(c, cor, nome, a, b) {
    var l = c.layers.addSolid(cor, nome, c.width, c.height, c.pixelAspect, Math.max(c.frameDuration, b - a));
    try { l.startTime = a; } catch (e) {}
    mvTempo(l, a, b);
    return l;
  }
  function mvCirculo(cx, cy, r) {
    var k = 0.5523 * r, s = new Shape();
    s.vertices = [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
    s.inTangents = [[-k, 0], [0, -k], [k, 0], [0, k]];
    s.outTangents = [[k, 0], [0, k], [-k, 0], [0, -k]];
    s.closed = true; return s;
  }
  function mvLosango(cx, cy, r) { var s = new Shape(); s.vertices = [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]]; s.closed = true; return s; }
  function mvQuad(pts) { var s = new Shape(); s.vertices = pts; s.closed = true; return s; }
  function mvMascara(l, forma, subtrair) {
    var m = l.property('ADBE Mask Parade').addProperty('ADBE Mask Atom'), mi = m.propertyIndex;
    try { l.property('ADBE Mask Parade').property(mi).maskMode = subtrair ? MaskMode.SUBTRACT : MaskMode.ADD; } catch (e) {}
    l.property('ADBE Mask Parade').property(mi).property('ADBE Mask Shape').setValue(forma);
    return l.property('ADBE Mask Parade').property(mi).property('ADBE Mask Shape');
  }
  // cobre a tela com 2 cores crescendo de um ponto e abre na próxima cena (forma(r) devolve o Shape)
  function mvCobrirAbrir(c, cores, forma, R, t0, tc, t1, cobrir, abrir) {
    var h = tc - t0, h2 = t1 - tc, a, b, n = 0;
    if (cobrir) {
      a = mvSolido(c, cores[0], 'Arcano Transição cor 1', t0, tc); mvChaves(mvMascara(a, forma(0.5), false), [[t0, forma(0.5), 50, 30], [t0 + h * 0.75, forma(R), 80, 50]]);
      b = mvSolido(c, cores[1], 'Arcano Transição cor 2', t0, tc); mvChaves(mvMascara(b, forma(0.5), false), [[t0 + h * 0.25, forma(0.5), 50, 30], [tc, forma(R), 80, 50]]);
      n += 2;
    }
    if (abrir) {
      a = mvSolido(c, cores[0], 'Arcano Transição cor 1', tc, t1); mvChaves(mvMascara(a, forma(0.5), true), [[tc + h2 * 0.25, forma(0.5), 50, 30], [t1, forma(R), 80, 50]]);
      b = mvSolido(c, cores[1], 'Arcano Transição cor 2', tc, t1); mvChaves(mvMascara(b, forma(0.5), true), [[tc, forma(0.5), 50, 30], [tc + h2 * 0.75, forma(R), 80, 50]]);
      n += 2;
    }
    return n;
  }
  function mvFormaCirculo(cx, cy) { return function (r) { return mvCirculo(cx, cy, r); }; }
  function mvFormaLosango(cx, cy) { return function (r) { return mvLosango(cx, cy, r); }; }

  function mvPalavra(c, o, tam, cor, a, b) {
    var l = mvTexto(c, o.palavra || 'ARCANO', tam, cor, ParagraphJustification.CENTER_JUSTIFY, 'Arial-BoldMT', 'Arcano Transição palavra');
    mvAncora(l, a, 'c'); mvPos(l, c.width / 2, c.height / 2); mvTempo(l, a, b); l.moveToBeginning();
    return l;
  }

  // ================= 1.0.30: texto e loops em EXPRESSÃO lida de marcadores =================
  // Marcadores na camada: "Ini <nome>" e "Fim <nome>" (texto: "<nome> in" / "<nome> out").
  // Arrastar o Ini muda quando começa; afastar/aproximar o Fim deixa mais lento/rápido.
  function mvStr(s) { return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
  function mvNum(v) { v = Number(v); if (isNaN(v) || !isFinite(v)) { v = 0; } return String(Math.round(v * 10000) / 10000); }
  function mvCab(rot, a, b) {
    return 'var M=thisLayer.marker,A=' + mvNum(a) + ',B=' + mvNum(b) + ';try{A=M.key(' + mvStr('Ini ' + rot) + ').time;}catch(e1){}try{B=M.key(' + mvStr('Fim ' + rot) + ').time;}catch(e2){}\n';
  }
  function mvMarcar(l, t, texto) { try { l.property('ADBE Marker').setValueAtTime(t, new MarkerValue(texto)); } catch (e) {} }
  function mvLerMk(l, texto) {
    var mk, k; try { mk = l.property('ADBE Marker'); for (k = 1; k <= mk.numKeys; k++) { if (mk.keyValue(k).comment === texto) { return mk.keyTime(k); } } } catch (e) {}
    return null;
  }
  function mvTirarMk(l, textos) {
    var mk, k, cm, j; try { mk = l.property('ADBE Marker'); } catch (e) { return; }
    for (k = mk.numKeys; k >= 1; k--) { try { cm = mk.keyValue(k).comment; for (j = 0; j < textos.length; j++) { if (cm === textos[j]) { mk.removeKey(k); break; } } } catch (e2) {} }
  }

  // ---- blocos de expressão: vários efeitos do Arcano convivem na mesma propriedade ----
  var MV_EXPR = '// arcano-mov';
  function mvBlocos(e) {
    var r = [], re = /\/\*\[([^\]\/]+)\]\*\/[\s\S]*?\/\*\[\/\1\]\*\//g, m;
    while ((m = re.exec(e))) { r.push({ id: m[1], txt: m[0] }); }
    return r;
  }
  function mvMontarExpr(bl) {
    if (!bl.length) { return ''; }
    var s = MV_EXPR + ' (Arcano Motion: edite pela aba Editar do painel)\nvar v=value;\n', i;
    for (i = 0; i < bl.length; i++) { s += bl[i].txt + '\n'; }
    return s + 'v;';
  }
  // false = a propriedade tem uma expressão que não é do Arcano (não mexe)
  function mvPorBloco(p, id, codigo) {
    if (!p) { return false; }
    try { if (!p.canSetExpression) { return false; } } catch (x0) {}
    var e = ''; try { e = String(p.expression || ''); } catch (x) {}
    if (e && e.indexOf(MV_EXPR) !== 0) { return false; }
    var bl = mvBlocos(e), novos = [], i;
    for (i = 0; i < bl.length; i++) { if (bl[i].id !== id) { novos.push(bl[i]); } }
    novos.push({ id: id, txt: '/*[' + id + ']*/v=(function(v){\n' + codigo + '\n})(v);/*[/' + id + ']*/' });
    try { p.expression = mvMontarExpr(novos); } catch (x2) { return false; }
    return true;
  }
  function mvTirarBloco(p, id) {
    if (!p) { return; }
    var e = ''; try { e = String(p.expression || ''); } catch (x) { return; }
    if (e.indexOf(MV_EXPR) !== 0) { return; }
    var bl = mvBlocos(e), novos = [], i;
    for (i = 0; i < bl.length; i++) { if (bl[i].id !== id) { novos.push(bl[i]); } }
    try { p.expression = mvMontarExpr(novos); } catch (x2) {}
  }
  function mvPropsTransform(l) {
    var t = T(l), r = [], nomes = ['ADBE Position', 'ADBE Position_0', 'ADBE Position_1', 'ADBE Anchor Point', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Rotate X', 'ADBE Rotate Y', 'ADBE Opacity'], i;
    for (i = 0; i < nomes.length; i++) { try { var p = t.property(nomes[i]); if (p) { r.push(p); } } catch (e) {} }
    return r;
  }
  // deslocamento [dx, dy] na posição (funciona com as dimensões separadas também)
  function mvBlocoPos(l, id, corpo) {
    var pos = T(l).property('ADBE Position');
    if (pos.dimensionsSeparated) {
      var a = mvPorBloco(T(l).property('ADBE Position_0'), id, corpo + '\nreturn v+d[0];');
      var b = mvPorBloco(T(l).property('ADBE Position_1'), id, corpo + '\nreturn v+d[1];');
      return a && b;
    }
    return mvPorBloco(pos, id, corpo + '\nvar r=v.slice(0);r[0]+=d[0];r[1]+=d[1];return r;');
  }
  // trecho que liga/desliga o loop entre os marcadores, com entrada e saída suaves
  var MV_ENV = 'if(time<A||time>B)return v;var R=Math.min(.4,(B-A)/3),en=Math.max(0,Math.min(1,(time-A)/R,(B-time)/R));en=en*en*(3-2*en);var t=time-A;\n';
  var MV_ESC = '\nvar r=[v[0]*q,v[1]*q];if(v.length>2)r.push(v[2]);return r;';
  var PI2 = '6.283185307';

  // ---------------- loops de movimento (objeto) ----------------
  function mvLoopObj(c, l, sp, o, A, B, rot) {
    var id = sp.id, cab = mvCab(rot, A, B), H = c.height, k = limitar(o.intensidade, 10, 300, 100) / 100, vp = limitar(o.velocidade, 20, 400, 100) / 100, ok = true;
    var tipo = sp.loop;
    if (tipo === 'balanco') {
      var amp = limitar(o.amplitude, 1, 5000, 30), fb = limitar(o.velocidade, 0.1, 20, 2);
      ok = mvBlocoPos(l, id, cab + MV_ENV + 'var d=[noise(t*' + mvNum(fb) + ')*' + mvNum(amp * 1.4) + '*en,0];');
    } else if (tipo === 'onda') {
      var f1 = 0.5 * vp;
      ok = mvBlocoPos(l, id, cab + MV_ENV + 'var d=[0,' + mvNum(H * 0.02 * k) + '*Math.sin(' + PI2 + '*' + mvNum(f1) + '*t)*en];');
      mvPorBloco(T(l).property('ADBE Rotate Z'), id, cab + MV_ENV + 'return v+' + mvNum(5 * k) + '*Math.sin(' + PI2 + '*' + mvNum(f1) + '*t+1.5708)*en;');
      mvPorBloco(T(l).property('ADBE Scale'), id, cab + MV_ENV + 'var q=1+' + mvNum(0.05 * k) + '*Math.sin(' + PI2 + '*' + mvNum(f1 * 2) + '*t)*en;' + MV_ESC);
    } else if (tipo === 'quique' || tipo === 'quiqueBalanco') {
      var hq = limitar(o.altura, 1, 5000, 80), fq = limitar(o.velocidade, 0.1, 10, 1.5), lq = limitar(o.largura, 0, 5000, 60);
      ok = mvBlocoPos(l, id, cab + MV_ENV + 'var ph=(t*' + mvNum(fq) + ')%1;var d=[' + (tipo === 'quiqueBalanco' ? mvNum(lq) + '*Math.sin(3.14159265*t*' + mvNum(fq) + ')*en' : '0') + ',-' + mvNum(hq) + '*4*ph*(1-ph)*en];');
      if (tipo === 'quique' && o.amassar !== false) {
        mvPorBloco(T(l).property('ADBE Scale'), id, cab + MV_ENV + 'var ph=(t*' + mvNum(fq) + ')%1,g=Math.max(0,1-Math.min(ph,1-ph)/.1),q2=.14*g*g*en;var r=[v[0]*(1+q2),v[1]*(1-q2)];if(v.length>2)r.push(v[2]);return r;');
      }
    } else if (tipo === 'flutuacao') {
      var ff = 0.4 * vp, af = H * 0.02 * k;
      ok = mvBlocoPos(l, id, cab + MV_ENV + 'var d=[' + mvNum(af * 0.5) + '*Math.sin(' + PI2 + '*' + mvNum(ff * 0.67) + '*t+1)*en,' + mvNum(af) + '*Math.sin(' + PI2 + '*' + mvNum(ff) + '*t)*en];');
      mvPorBloco(T(l).property('ADBE Rotate Z'), id, cab + MV_ENV + 'return v+' + mvNum(3 * k) + '*Math.sin(' + PI2 + '*' + mvNum(ff * 0.8) + '*t+2)*en;');
    } else if (tipo === 'pulsacao') {
      var sp2 = limitar(o.intensidade, 1, 100, 8) / 100, fp = limitar(o.velocidade, 0.1, 10, 1.2);
      ok = mvPorBloco(T(l).property('ADBE Scale'), id, cab + MV_ENV + 'var b=.5-.5*Math.cos(' + PI2 + '*' + mvNum(fp) + '*t),q=1+' + mvNum(sp2) + '*b*en;' + MV_ESC);
    } else if (tipo === 'pendulo') {
      var ang = limitar(o.angulo, 1, 90, 15), fpd = limitar(o.velocidade, 0.05, 10, 0.8), amo = limitar(o.amortecimento, 0, 3, 0);
      var frente = o.movimento === 'frente';
      if (frente && !l.threeDLayer) { l.threeDLayer = true; }
      // ponto de âncora escolhido, sem a camada sair do lugar (expressão na âncora e na posição)
      var r = retanguloCamada(l, c.time), a0 = T(l).property('ADBE Anchor Point').valueAtTime(c.time, false), alvo;
      var mx = r.left + r.width / 2, my = r.top + r.height / 2;
      alvo = ({ topo: [mx, r.top], base: [mx, r.top + r.height], esquerda: [r.left, my], direita: [r.left + r.width, my], centro: [mx, my] })[o.ancora || 'topo'] || [mx, r.top];
      var dx = alvo[0] - a0[0], dy = alvo[1] - a0[1];
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        mvPorBloco(T(l).property('ADBE Anchor Point'), id, 'var r=v.slice(0);r[0]+=' + mvNum(dx) + ';r[1]+=' + mvNum(dy) + ';return r;');
        mvBlocoPos(l, id, 'var s=transform.scale;var d=[' + mvNum(dx) + '*s[0]/100,' + mvNum(dy) + '*s[1]/100];');
      }
      ok = mvPorBloco(T(l).property(frente ? 'ADBE Rotate X' : 'ADBE Rotate Z'), id, cab + MV_ENV + 'return v+' + mvNum(ang) + '*Math.exp(-' + mvNum(amo) + '*t)*Math.sin(' + PI2 + '*' + mvNum(fpd) + '*t)*en;');
    }
    return ok;
  }

  // ---------------- texto ----------------
  var MV_TXTP = { o: 'ADBE Text Opacity', p: 'ADBE Text Position 3D', s: 'ADBE Text Scale 3D', r: 'ADBE Text Rotation', t: 'ADBE Text Tracking Amount', b: 'ADBE Text Blur', sk: 'ADBE Text Skew', co: 'ADBE Text Character Offset' };
  function mvAnimadores(l) { return l.property('ADBE Text Properties').property('ADBE Text Animators'); }
  function mvTamFonte(l) { try { return l.property('ADBE Text Properties').property('ADBE Text Document').value.fontSize || 80; } catch (e) { return 80; } }
  // valor do animador com a intensidade k (o e s partem do normal: 100)
  function mvValTxt(chave, v, k, fs, W, H) {
    var s;
    if (chave === 'o') { return Math.max(0, Math.min(100, 100 + (v - 100) * Math.min(1, k))); }
    if (chave === 's') { s = Math.max(0, 100 + (v - 100) * k); return [s, s, 100]; }
    if (chave === 'p') { return [v[0] * fs / 100 * k, v[1] * fs / 100 * k, 0]; }
    if (chave === 'pc') { return [v[0] * W * k, v[1] * H * k, 0]; }
    if (chave === 'b') { return [v * k, v * k]; }
    return v * k;
  }
  // cria um animador com as propriedades e um Seletor de Expressão com a expressão do "Amount"
  function mvAnimTxt(l, nome, valores, exprAmount, base) {
    var ia = mvAnimadores(l).addProperty('ADBE Text Animator').propertyIndex, ch, mn, p;
    var A = function () { return mvAnimadores(l).property(ia); };
    try { A().name = nome; } catch (e) {}
    for (ch in valores) { if (valores.hasOwnProperty(ch)) { mn = MV_TXTP[ch === 'pc' ? 'p' : ch]; try { A().property('ADBE Text Animator Properties').addProperty(mn); } catch (e2) {} } }
    for (ch in valores) {
      if (!valores.hasOwnProperty(ch)) { continue; }
      p = null; try { p = A().property('ADBE Text Animator Properties').property(MV_TXTP[ch === 'pc' ? 'p' : ch]); } catch (e3) {}
      if (!p) { continue; }
      if (typeof valores[ch] === 'string') { try { p.expression = valores[ch]; } catch (e4) {} } else { mvSet(p, valores[ch]); }
    }
    var is = A().property('ADBE Text Selectors').addProperty('ADBE Text Expressible Selector').propertyIndex;
    var S = function () { return A().property('ADBE Text Selectors').property(is); };
    var bo = paramEfeito(S(), ['ADBE Text Range Type2'], 1); if (bo) { mvSet(bo, base || 2); }
    var am = paramEfeito(S(), ['ADBE Text Expressible Amount'], 2);
    if (!am) { throw new Error('Este After não aceitou o seletor de expressão do texto.'); }
    am.expression = exprAmount;
    return ia;
  }
  var MV_CURVAS = 'function io(x){return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;}' +
    'function bk(x){var c=1.70158*F,e=c+1;return 1+e*Math.pow(x-1,3)+c*Math.pow(x-1,2);}' +
    'function bo(x){var n=7.5625,e=2.75;if(x<1/e)return n*x*x;if(x<2/e){x-=1.5/e;return n*x*x+.75;}if(x<2.5/e){x-=2.25/e;return n*x*x+.9375;}x-=2.625/e;return n*x*x+.984375;}\n';
  // u = progresso da unidade (letra/palavra/linha) de 0 a 1, conforme a ordem
  function mvU(S, ordem, semente) {
    var ord = ordem === 'dir' ? 'k=n-1-i;' : (ordem === 'centro' ? 'k=Math.abs(i-(n-1)/2)*2;' : (ordem === 'rand' ? 'seedRandom(' + semente + '+i*31,true);k=random()*(n-1);' : ''));
    return 'var n=textTotal,i=textIndex-1,d=Math.max(n-1,1),k=i;' + ord +
      'var p=(time-A)/Math.max(B-A,.001),S=' + mvNum(Math.min(0.95, S)) + ',u=(p-(k/d)*S)/(1-S);u=Math.min(Math.max(u,0),1);\n';
  }
  function mvCurvaE(curva, saida) {
    if (saida) { return 'var E=io(u);'; }
    if (curva === 'salto') { return 'var E=1-bk(u);'; }
    if (curva === 'quique') { return 'var E=1-bo(u);'; }
    return 'var E=1-io(u);';
  }

  function mvTxt(c, l, sp, o, saida, A, B, rot) {
    var fs = mvTamFonte(l), k = limitar(o.intensidade, 10, 300, 100) / 100, base = sp.S > 0 ? (sp.base || 2) : 2, i, an, ch, val;
    var ordem = o.ordem || sp.ordem || 'esq', sem = 7, parte = saida ? 'saída' : 'entrada';
    var cab = mvCab(rot, A, B) + 'var F=' + mvNum(sp.F || 1) + ';' + MV_CURVAS + mvU(sp.S || 0, ordem, sem);
    var E = mvCurvaE(sp.curva, saida);
    for (i = 0; i < sp.an.length; i++) {
      an = sp.an[i];
      var nomeA = 'Arcano · ' + sp.nome + ' · ' + parte + (sp.an.length > 1 ? ' ' + (i + 1) : '');
      if (an.k === 'decode') {
        var ord2 = cab + (saida ? 'p=1-p;' : '') + 'var ap=(k/d)*.35,rs=.3+(k/d)*.65;\n';
        mvAnimTxt(l, nomeA + ' · some', { o: 0 }, ord2 + 'var Q=p<ap?100:0;[Q,Q,Q];', base);
        mvAnimTxt(l, nomeA + ' · troca', { co: 'seedRandom(Math.floor(time*16),true);Math.round(random(5,40));' }, ord2 + 'var Q=(p>=ap&&p<rs)?100:0;[Q,Q,Q];', base);
        if (an.pisca) { mvAnimTxt(l, nomeA + ' · pisca', { o: 25 }, ord2 + 'var Q=0;if(p>=ap&&p<rs){seedRandom(i*7+Math.floor(time*20),true);Q=random()<.4?100:0;}[Q,Q,Q];', base); }
        mvAnimTxt(l, nomeA + ' · pop', { s: [100 + 25 * k, 100 + 25 * k, 100] }, ord2 + 'var x=(p-rs)/.12,Q=(x>0&&x<1)?Math.sin(3.14159265*x)*100:0;[Q,Q,Q];', base);
        continue;
      }
      val = {};
      for (ch in an.pr) { if (an.pr.hasOwnProperty(ch)) { val[ch] = mvValTxt(ch, an.pr[ch], k, fs, c.width, c.height); } }
      var amt;
      if (an.k === 'base') { amt = cab + E + 'var Q=E*100;[Q,Q,Q];'; }
      else if (an.k === 'piscar') { amt = cab + E + 'var Q=0;if(E>.02&&E<.98){seedRandom(i*7+Math.floor(time*24),true);Q=random()<.5?100:0;}[Q,Q,Q];'; }
      else {
        // cada unidade numa direção sorteada; com hz, ela treme enquanto chega e PARA quando assenta
        var rnd = an.hz ? 'var rx=Math.max(-1,Math.min(1,noise(time*' + mvNum(an.hz) + '+i*13.7)*1.6)),ry=Math.max(-1,Math.min(1,noise(time*' + mvNum(an.hz) + '+i*13.7+71)*1.6));'
          : 'seedRandom(' + (sem + 11 + i * 3) + '+i*17,true);var rx=random(-1,1),ry=random(-1,1);';
        var ehP = an.pr.p || an.pr.pc;
        amt = cab + E + rnd + 'var Q=E*100;' + (ehP ? '[rx*Q,ry*Q,0];' : '[rx*Q,rx*Q,rx*Q];');
      }
      mvAnimTxt(l, nomeA, val, amt, base);
    }
  }

  function mvTxtLoop(c, l, sp, o, A, B, rot) {
    var fs = mvTamFonte(l), k = limitar(o.intensidade, 10, 300, 100) / 100, V = limitar(o.velocidade, 20, 400, 100) / 100, nome = 'Arcano · ' + sp.nome;
    var cab = mvCab(rot, A, B) + 'var on=time>=A&&time<=B,n=textTotal,i=textIndex-1;\n';
    if (sp.loop === 'turb') {
      var it = mvEfeitoNomeado(l, 'ADBE Turbulent Displace', nome), e = function () { return efeitos(l).property(it); };
      try { e().property(2).expression = cab + 'on?' + mvNum(18 * k) + ':0;'; } catch (x1) {}
      try { e().property(3).setValue(Math.max(4, fs * 0.25)); } catch (x2) {}
      try { e().property(6).expression = 'posterizeTime(' + mvNum(8 * V) + ');random(360);'; } catch (x3) {}
      return;
    }
    if (sp.loop === 'decode' || sp.loop === 'fade') {
      var T0 = (sp.loop === 'fade' ? 0.18 : 0.12) / V, ch = Math.min(0.9, (sp.chance || 0.08) * k);
      var slot = cab + 'seedRandom(' + (sp.loop === 'fade' ? 41 : 23) + '+i*13+Math.floor(time/' + mvNum(T0) + '),true);var ligado=on&&random()<' + mvNum(ch) + ';\n';
      if (sp.loop === 'fade') { mvAnimTxt(l, nome + ' · pisca', { o: 15 }, slot + 'var Q=ligado?100:0;[Q,Q,Q];', 2); return; }
      mvAnimTxt(l, nome + ' · troca', { co: 'seedRandom(Math.floor(time*' + mvNum(14 * V) + '),true);Math.round(random(5,40));' }, slot + 'var Q=ligado?100:0;[Q,Q,Q];', 2);
      if (sp.pisca) {
        mvAnimTxt(l, nome + ' · pisca', { o: 30, s: [115, 115, 100] }, slot + 'var Q=0;if(ligado){seedRandom(i*5+Math.floor(time*24),true);Q=random()<.5?100:0;}[Q,Q,Q];', 2);
      }
      return;
    }
    if (sp.loop === 'skew') { mvAnimTxt(l, nome, { sk: 15 * k }, cab + 'var Q=on?noise(time*' + mvNum(2.5 * V) + ')*110:0;[Q,Q,Q];', 2); return; }
    if (sp.loop === 'inquietas') {
      mvAnimTxt(l, nome + ' · posição', { p: [12 * fs / 100 * k, 12 * fs / 100 * k, 0] }, cab + 'var Q=on?100:0;[noise(time*' + mvNum(2 * V) + '+i*7.3)*Q*1.4,noise(time*' + mvNum(2 * V) + '+i*7.3+50)*Q*1.4,0];', 2);
      mvAnimTxt(l, nome + ' · giro', { r: 12 * k }, cab + 'var Q=on?noise(time*' + mvNum(2 * V) + '+i*9.1+20)*140:0;[Q,Q,Q];', 2);
      return;
    }
    if (sp.loop === 'onda') { mvAnimTxt(l, nome, { p: [0, -40 * fs / 100 * k, 0] }, cab + 'var Q=on?Math.sin(' + PI2 + '*time*' + mvNum(0.8 * V) + '-i*.55)*100:0;[Q,Q,Q];', 2); }
  }

  // tira tudo que um movimento pôs na camada (animadores, efeito, blocos de expressão e marcadores)
  function mvRemover(l, sp, reg) {
    var nome = sp.nome, pre = 'Arcano · ' + nome, i, a, j;
    try {
      a = mvAnimadores(l);
      for (i = a.numProperties; i >= 1; i--) { var nm = a.property(i).name; if (nm === pre || nm.indexOf(pre + ' · ') === 0) { a.property(i).remove(); } }
    } catch (e) {}
    try { var fx = efeitos(l); for (i = fx.numProperties; i >= 1; i--) { if (fx.property(i).name === pre) { fx.property(i).remove(); } } } catch (e2) {}
    var ps = mvPropsTransform(l);
    for (j = 0; j < ps.length; j++) { mvTirarBloco(ps[j], sp.id); }
    mvTirarMk(l, ['Ini ' + nome, 'Fim ' + nome, 'Ini ' + nome + ' in', 'Fim ' + nome + ' in', 'Ini ' + nome + ' out', 'Fim ' + nome + ' out']);
    if (reg && reg.x && reg.x.t3d === false) { try { l.threeDLayer = false; } catch (e3) {} }
    desregistrar(l, 'mov:' + sp.id);
  }
  // movimentos do Arcano que já estão nas camadas selecionadas (para avisar de conflito)
  am.movimentosNaSelecao = function () {
    var c = am.findComp(), ls = selecao(c, false), i, k, r, lista = [];
    for (i = 0; i < ls.length; i++) {
      r = lerRegistro(ls[i]); var fx = [];
      for (k in r.fx) { if (r.fx.hasOwnProperty(k) && /^mov:/.test(k)) { fx.push({ id: k, o: r.fx[k].o }); } }
      lista.push({ camada: ls[i].name, fx: fx });
    }
    return { camadas: lista };
  };
  am.removerMovimento = function (sp) {
    return desfazivel('Remover ' + sp.nome, function () {
      var c = am.findComp(), ls = selecao(c, true), i, n = 0;
      for (i = 0; i < ls.length; i++) { var reg = lerRegistro(ls[i]).fx['mov:' + sp.id]; if (reg) { mvRemover(ls[i], sp, reg); n++; } }
      return { mensagem: n ? sp.nome + ' removido de ' + n + ' camada(s).' : 'As camadas selecionadas não têm esse efeito.' };
    });
  };
  // palavra no centro com entrada e saída em keyframes (dentro da composição da transição)
  function mvPalavraAnim(l, tIn, dIn, sIn, tOut, dOut, sOut) {
    mvChaves(T(l).property('ADBE Opacity'), [[tIn, 0, 50, 30], [tIn + dIn, 100, 75, 50], [tOut, 100, 50, 60], [tOut + dOut, 0, 40, 50]]);
    mvChaves(T(l).property('ADBE Scale'), [[tIn, [sIn, sIn, 100], 50, 20], [tIn + dIn, [100, 100, 100], 85, 50], [tOut, [100, 100, 100], 50, 70], [tOut + dOut, [sOut, sOut, 100], 30, 50]]);
  }
  // Transição: COMEÇA NA AGULHA. O corte entre as cenas fica no meio, no marcador "Corte".
  // Câmera e glitch: camada de ajuste (mexe nas camadas de baixo). Luz e shapes: uma composição nova "Arcano Transição · nome".
  function mvTransicao(c0, sp, o, nomeItem) {
    var fd = c0.frameDuration, t0c = c0.time, durPed = limitar(o.duracao, 0.2, 10, 1);
    var t1c = Math.min(c0.duration, t0c + durPed);
    if (t1c - t0c < 4 * fd) { throw new Error('A agulha está no fim da composição: volte um pouco a agulha para caber a transição.'); }
    var dur = t1c - t0c, tcc = t0c + dur / 2, precomp = sp.fam === 'luz' || sp.fam === 'forma', c = c0, t0 = t0c, tc = tcc, t1 = t1c;
    var W = c0.width, H = c0.height, cx = W / 2, cy = H / 2, k = limitar(o.intensidade, 10, 300, 100) / 100;
    if (precomp) {
      c = app.project.items.addComp('Arcano Transição · ' + nomeItem, W, H, c0.pixelAspect, dur, 1 / fd);
      try { c.bgColor = [0, 0, 0]; } catch (eBg) {}
      t0 = 0; tc = dur / 2; t1 = dur;
      try { c.markerProperty.setValueAtTime(tc, new MarkerValue('Corte')); } catch (eM) {}
    }
    var h = tc - t0, h2 = t1 - tc;
    var c1 = mvCor(o.cor1, [0.49, 0.36, 0.94]), c2 = mvCor(o.cor2, [1, 0.42, 0.1]), n = 0, l, e, p, i;
    var diag = Math.sqrt(W * W + H * H);
    var fim = function (camada, extra) {
      var lay = camada;
      if (precomp) { lay = c0.layers.add(c); try { lay.startTime = t0c; } catch (eS) {} mvTempo(lay, t0c, t1c); if (sp.fam === 'luz') { try { lay.blendingMode = sp.v === 2 ? BlendingMode.SCREEN : BlendingMode.ADD; } catch (eB2) {} } }
      mvMarcar(lay, tcc, 'Corte');
      return { mensagem: nomeItem + ' na agulha (' + t0c.toFixed(2) + 's a ' + t1c.toFixed(2) + 's). O corte entre as cenas é no marcador "Corte" (' + tcc.toFixed(2) + 's)' + (extra || '') + '.' };
    };

    if (sp.fam === 'cam') {
      if (sp.mov === 'preto') {
        l = mvSolido(c, [0, 0, 0], 'Arcano Fade preto', t0, t1);
        mvChaves(T(l).property('ADBE Opacity'), [[t0, 0, 50, 40], [tc, 100, 60, 60], [t1, 0, 40, 50]]);
        return fim(l);
      }
      l = mvSolido(c, [1, 1, 1], 'Arcano Transição', t0, t1); l.adjustmentLayer = true;
      var iTile = mvEfeitoNomeado(l, 'ADBE Tile', 'Arcano Repetir bordas');
      var eT = efeitos(l).property(iTile);
      p = paramEfeito(eT, ['Output Width', 'Largura de saída'], 4); if (p) { mvSet(p, 500); }
      p = paramEfeito(efeitos(l).property(iTile), ['Output Height', 'Altura de saída'], 5); if (p) { mvSet(p, 500); }
      p = paramEfeito(efeitos(l).property(iTile), ['Mirror Edges', 'Espelhar bordas'], 6); if (p) { mvSet(p, 1); }
      var iTw = 0;
      if (sp.twirl) { iTw = mvEfeitoNomeado(l, 'ADBE Twirl', 'Arcano Redemoinho'); }
      var iTf = mvEfeitoNomeado(l, 'ADBE Geometry2', 'Arcano Câmera');
      var iOp = 0;
      if (sp.dist || sp.mov === 'tremida') { iOp = mvEfeitoNomeado(l, 'ADBE Optics Compensation', 'Arcano Lente'); }
      var TF = function () { return efeitos(l).property(iTf); };
      p = paramEfeito(TF(), ['ADBE Geometry2-0009'], 10); if (p) { mvSet(p, 0); }
      p = paramEfeito(TF(), ['ADBE Geometry2-0010'], 11); if (p) { mvSet(p, 360); }
      var pEsc = paramEfeito(TF(), ['ADBE Geometry2-0003'], 4);
      var pPos = paramEfeito(TF(), ['ADBE Geometry2-0002'], 2);
      var pRot = paramEfeito(TF(), ['ADBE Geometry2-0007'], 8);
      if (!pEsc || !pPos) { throw new Error('Não achei o efeito Transformar (Transform) neste After.'); }
      var zz = 1 + 3 * k, zo = 1 + 2.3 * k;
      if (sp.mov === 'zin') {
        mvChaves(pEsc, [[t0, 100, 50, 65], [tc - fd, 100 * zz, 3, 50, true], [tc, 100 / zz, 50, 3], [t1, 100, 65, 50]]);
      } else if (sp.mov === 'zout') {
        mvChaves(pEsc, [[t0, 100, 50, 65], [tc - fd, 100 / zo, 3, 50, true], [tc, 100 * zo, 50, 3], [t1, 100, 65, 50]]);
        if (sp.giro && pRot) { mvChaves(pRot, [[t0, 0, 50, 70], [t1, -180 * Math.min(2, k), 70, 50]]); }
      } else if (sp.mov === 'chicote') {
        var vd = ({ esquerda: [-2 * W, 0], direita: [2 * W, 0], cima: [0, -2 * H], baixo: [0, 2 * H] })[o.direcao] || [-2 * W, 0];
        mvChaves(pPos, [[t0, [cx, cy], 50, 85], [t1, [cx + vd[0], cy + vd[1]], 85, 50]]);
      } else if (sp.mov === 'giro') {
        mvChaves(pRot, [[t0, 0, 50, 85], [t1, o.sentido === 'anti' ? -360 : 360, 85, 50]]);
        mvChaves(pEsc, [[t0, 100, 50, 60], [tc, 125, 60, 60], [t1, 100, 60, 50]]);
      } else if (sp.mov === 'tremida') {
        var rnd = semAleatorio(9), lp = [], lr = [], t, env;
        for (t = t0; t <= t1 + 0.0001; t += 2 * fd) {
          env = Math.max(0, 1 - Math.abs(t - tc) / Math.max(h, h2));
          lp.push([t, [cx + (rnd() - 0.5) * H * 0.08 * k * env, cy + (rnd() - 0.5) * H * 0.08 * k * env], 30, 30]);
          lr.push([t, (rnd() - 0.5) * 8 * k * env, 30, 30]);
        }
        lp[0][1] = [cx, cy]; lp[lp.length - 1][1] = [cx, cy]; lr[0][1] = 0; lr[lr.length - 1][1] = 0;
        mvChaves(pPos, lp); if (pRot) { mvChaves(pRot, lr); }
        mvChaves(pEsc, [[t0, 100, 50, 60], [tc, 115, 60, 60], [t1, 100, 60, 50]]);
      }
      if (iOp) {
        var pf = paramEfeito(efeitos(l).property(iOp), ['Field Of View (FOV)', 'Campo de visão (FOV)'], 1);
        if (pf) { mvChaves(pf, [[t0, 0, 50, 60], [tc, Math.min(150, (sp.mov === 'tremida' ? 60 : 90) * k), 60, 60], [t1, 0, 60, 50]]); }
      }
      if (iTw) {
        var pa = paramEfeito(efeitos(l).property(iTw), ['Angle', 'Ângulo'], 1); if (pa) { mvChaves(pa, [[t0, 0, 50, 70], [tc, 360 * k, 60, 60], [t1, 0, 70, 50]]); }
        var prad = paramEfeito(efeitos(l).property(iTw), ['Twirl Radius', 'Raio do redemoinho'], 2); if (prad) { mvSet(prad, 75); }
      }
      return fim(l, '; os keyframes ficam na camada de ajuste "Arcano Transição"');
    }

    if (sp.fam === 'glitch') {
      l = mvSolido(c, [1, 1, 1], 'Arcano Transição glitch', t0, t1); l.adjustmentLayer = true;
      FERR['glitch'](c, { intensidade: Math.min(100, 70 * k), velocidade: 7, rajada: 4, estilo: 'completo', trecho: 'agulha', duracao: t1 - t0, semente: 5 }, [l]);
      return fim(l);
    }

    if (sp.fam === 'luz') {
      var v = sp.v, CORES = {
        1: [[1, 0.45, 0.08], [1, 0.75, 0.3], [0.85, 0.15, 0.05], [0, 0, 0]],
        2: [[1, 0.96, 0.86], [1, 0.88, 0.7], [1, 1, 0.95], [0.9, 0.7, 0.5]],
        3: [[1, 0.35, 0.7], [0.65, 0.45, 1], [0, 0, 0], [0, 0, 0]],
        4: [[1, 0.4, 0.65], [1, 0.55, 0.2], [0, 0, 0], [0.6, 0.2, 0.5]]
      }[v] || [[1, 0.5, 0.1], [1, 0.8, 0.4], [0, 0, 0], [0, 0, 0]];
      var PONTOS = {
        1: [[[-0.2, 0.3], [0.6, 0.4]], [[0.1, 0.9], [0.9, 0.7]], [[0.5, -0.1], [1.2, 0.2]], [[1.2, 1.2], [1.2, 1.2]]],
        2: [[[0.3, 0.3], [0.5, 0.45]], [[0.7, 0.7], [0.55, 0.6]], [[0.2, 0.9], [0.4, 0.6]], [[0.9, 0.1], [0.7, 0.3]]],
        3: [[[1.3, 0.3], [0.5, 0.4]], [[1.2, 0.9], [0.4, 0.7]], [[-0.3, -0.2], [-0.3, -0.2]], [[-0.3, 1.2], [-0.3, 1.2]]],
        4: [[[0.1, 0.2], [0.6, 0.5]], [[0.9, 0.8], [0.3, 0.5]], [[1.2, -0.2], [1.2, -0.2]], [[-0.2, 1.2], [0.5, 1.1]]]
      }[v] || [];
      l = mvSolido(c, [0, 0, 0], 'Arcano Luz ' + v, t0, t1);
      var ig = mvEfeitoNomeado(l, 'ADBE 4ColorGradient', 'Arcano Luz');
      for (i = 0; i < 4; i++) {
        var pc = mvParamTipo(efeitos(l).property(ig), MV_COR, i + 1); if (pc) { mvSet(pc, mvCor4(CORES[i])); }
        var pp = mvParamTipo(efeitos(l).property(ig), MV_PONTO, i + 1);
        if (pp && PONTOS[i]) { mvChaves(pp, [[t0, [PONTOS[i][0][0] * W, PONTOS[i][0][1] * H], 50, 50], [t1, [PONTOS[i][1][0] * W, PONTOS[i][1][1] * H], 50, 50]]); }
      }
      if (v === 4) {
        var iw4 = mvEfeitoNomeado(l, 'ADBE Wave Warp', 'Arcano Ondas');
        var ph4 = paramEfeito(efeitos(l).property(iw4), ['Wave Height', 'Altura da onda'], 2); if (ph4) { mvSet(ph4, H * 0.06); }
        var pw4 = paramEfeito(efeitos(l).property(iw4), ['Wave Width', 'Largura da onda'], 3); if (pw4) { mvSet(pw4, W * 0.35); }
      }
      mvChaves(T(l).property('ADBE Opacity'), [[t0, 0, 50, 40], [tc, 100, 60, 60], [t1, 0, 40, 50]]);
      // clarão na cor da luz bem no corte: esconde a troca de cena
      var cl0 = CORES[v === 2 ? 2 : 1], cla = mvSolido(c, [Math.min(1, cl0[0] * 0.6 + 0.4), Math.min(1, cl0[1] * 0.6 + 0.4), Math.min(1, cl0[2] * 0.6 + 0.4)], 'Arcano Clarão', t0, t1);
      mvChaves(T(cla).property('ADBE Opacity'), [[tc - h * 0.45, 0, 50, 30], [tc, Math.min(100, 85 * k), 70, 70], [tc + h2 * 0.45, 0, 30, 50]]);
      var lb = mvEfeitoNomeado(l, 'ADBE Gaussian Blur 2', 'Arcano Suave'); try { efeitos(l).property(lb).property(1).setValue(H * 0.08); } catch (eLb) {}
      return fim(null, '; a luz entra em modo Adicionar');
    }

    if (sp.fam === 'forma') {
      var cores = [c1, c2];
      if (sp.mov === 'circulo') {
        var px = sp.canto ? 0 : cx, py = sp.canto ? 0 : cy, R = sp.canto ? diag * 1.02 : diag / 2 * 1.05;
        n = mvCobrirAbrir(c, cores, mvFormaCirculo(px, py), R, t0, tc, t1, true, true);
      } else if (sp.mov === 'faixa') {
        var s = sp.inclina ? H * 0.35 : 0;
        var esp = o.direcao === 'direita';
        var q = function (xl, xr) { var P = [[xl + s, -2], [xr + s, -2], [xr - s, H + 2], [xl - s, H + 2]], j; if (esp) { for (j = 0; j < 4; j++) { P[j][0] = W - P[j][0]; } } return mvQuad(P); };
        var zE = q(-s - 4, -s - 4), cheio = q(-s - 4, W + s + 4), zD = q(W + s + 4, W + s + 4);
        var a1 = mvSolido(c, c1, 'Arcano Transição cor 1', t0, t1);
        mvChaves(mvMascara(a1, zE, false), [[t0, zE, 50, 25], [t0 + h * 0.8, cheio, 80, 50], [tc + h2 * 0.2, cheio, 50, 25], [t1, zD, 80, 50]]);
        var a2 = mvSolido(c, c2, 'Arcano Transição cor 2', t0, t1);
        mvChaves(mvMascara(a2, zE, false), [[t0 + h * 0.2, zE, 50, 25], [tc, cheio, 80, 50], [tc + h2 * 0.8, zD, 80, 50]]);
        n = 2;
      } else if (sp.mov === 'liquido') {
        l = mvSolido(c, c1, 'Arcano Transição líquido', t0, t1);
        var iR = mvEfeitoNomeado(l, 'ADBE Ramp', 'Arcano Degradê');
        p = mvParamTipo(efeitos(l).property(iR), MV_PONTO, 1); if (p) { mvSet(p, [cx, 0]); }
        p = mvParamTipo(efeitos(l).property(iR), MV_COR, 1); if (p) { mvSet(p, mvCor4(c1)); }
        p = mvParamTipo(efeitos(l).property(iR), MV_PONTO, 2); if (p) { mvSet(p, [cx, H]); }
        p = mvParamTipo(efeitos(l).property(iR), MV_COR, 2); if (p) { mvSet(p, mvCor4(c2)); }
        var rq = function (topo, base) { return mvQuad([[-W * 0.1, topo], [W * 1.1, topo], [W * 1.1, base], [-W * 0.1, base]]); };
        var mv0 = rq(H * 1.2, H * 1.2), mvC = rq(-H * 0.2, H * 1.2), mvF = rq(-H * 0.2, -H * 0.2);
        mvChaves(mvMascara(l, mv0, false), [[t0, mv0, 50, 30], [t0 + h * 0.85, mvC, 75, 50], [tc + h2 * 0.15, mvC, 50, 25], [t1, mvF, 75, 50]]);
        var iTd = mvEfeitoNomeado(l, 'ADBE Turbulent Displace', 'Arcano Líquido');
        try { efeitos(l).property(iTd).property(2).setValue(90); } catch (x1) {}
        try { efeitos(l).property(iTd).property(3).setValue(W * 0.12); } catch (x2) {}
        try { chaves(efeitos(l).property(iTd).property(6), [[t0, 0], [t1, 180]], 'linear'); } catch (x3) {}
        n = 2;
      } else if (sp.mov === 'palavra1') {
        var fundo = mvSolido(c, c1, 'Arcano Transição fundo', t0 + h * 0.75, tc);
        mvChaves(T(fundo).property('ADBE Opacity'), [[t0 + h * 0.75, 0, 50, 50], [tc - fd, 100, 50, 50]]);
        var pg = mvPalavra(c, o, H * 0.28, c1, t0, tc);
        mvChaves(T(pg).property('ADBE Scale'), [[t0, [100, 100, 100], 50, 70], [t0 + h * 0.6, [300, 300, 100], 40, 40], [tc, [3000, 3000, 100], 5, 50]]);
        mvChaves(T(pg).property('ADBE Opacity'), [[t0, 0, 50, 50], [t0 + h * 0.2, 100, 50, 50]]);
        n = 2 + mvCobrirAbrir(c, [c2, c1], mvFormaCirculo(cx, cy), diag / 2 * 1.05, t0, tc, t1, false, true);
      } else if (sp.mov === 'palavra2') {
        var preto = mvSolido(c, [0.04, 0.04, 0.05], 'Arcano Transição bloco', t0, t1);
        var rb = function (topo, base) { return mvQuad([[-2, topo], [W + 2, topo], [W + 2, base], [-2, base]]); };
        var b0 = rb(H + 2, H + 2), bC = rb(-2, H + 2), bF = rb(-2, -2);
        mvChaves(mvMascara(preto, b0, false), [[t0, b0, 50, 20], [t0 + h * 0.8, bC, 85, 50], [tc + h2 * 0.2, bC, 50, 20], [t1, bF, 85, 50]]);
        var fsW = H * 0.16, pw = mvPalavra(c, o, fsW, [1, 1, 1], t0 + h * 0.5, tc + h2 * 0.6);
        mvPalavraAnim(pw, t0 + h * 0.5, h * 0.45, 85, tc + h2 * 0.2, h2 * 0.35, 100);
        var linhasL = c.layers.addShape(); linhasL.name = 'Arcano Transição linhas';
        var Lw = W * 0.5, g1 = mvGrupoForma(linhasL, { forma: 'caminho', pontos: [[-Lw / 2, -fsW * 0.85], [Lw / 2, -fsW * 0.85]], cor: [1, 1, 1], traco: Math.max(1, H * 0.002), aparar: true });
        var g2 = mvGrupoForma(linhasL, { forma: 'caminho', pontos: [[Lw / 2, fsW * 0.85], [-Lw / 2, fsW * 0.85]], cor: [1, 1, 1], traco: Math.max(1, H * 0.002), aparar: true });
        mvPos(linhasL, cx, cy); mvTempo(linhasL, t0 + h * 0.5, tc + h2 * 0.6);
        mvChaves(mvTrim(linhasL, g1, 'fim'), [[t0 + h * 0.5, 0, 50, 20], [tc, 100, 85, 50]]);
        mvChaves(mvTrim(linhasL, g2, 'fim'), [[t0 + h * 0.6, 0, 50, 20], [tc, 100, 85, 50]]);
        mvChaves(mvTrim(linhasL, g1, 'ini'), [[tc + h2 * 0.1, 0, 50, 50], [tc + h2 * 0.5, 100, 50, 50]]);
        mvChaves(mvTrim(linhasL, g2, 'ini'), [[tc + h2 * 0.1, 0, 50, 50], [tc + h2 * 0.5, 100, 50, 50]]);
        n = 3;
      } else if (sp.mov === 'tunel') {
        var N = 5, Rd = (W + H) / 2 * 1.08;
        for (i = 0; i < N; i++) {
          var ta = t0 + i * h * 0.12, sl = mvSolido(c, i % 2 ? c2 : c1, 'Arcano Túnel ' + (i + 1), ta, tc);
          mvChaves(mvMascara(sl, mvLosango(cx, cy, 0.5), false), [[ta, mvLosango(cx, cy, 0.5), 50, 30], [Math.min(tc, ta + h * 0.5), mvLosango(cx, cy, Rd), 80, 50]]);
        }
        n = N + mvCobrirAbrir(c, [i % 2 ? c2 : c1, (N - 1) % 2 ? c2 : c1], mvFormaLosango(cx, cy), Rd, t0, tc, t1, false, true);
      }
      return fim(null);
    }
    throw new Error('Transição desconhecida.');
  }


  // ---------------- ponto de entrada ----------------
  // sp = receita do item (js/movimentos.js); o = opções da tela do efeito (modo, intensidade, velocidade, ordem...)
  // Aplica na AGULHA. Se a camada já tem este efeito (editando), troca pelo novo e mantém os marcadores onde estavam.
  am.movimento = function (sp, o) {
    o = o || {};
    var nome = String(sp.nome || o.nome || 'Animação');
    return desfazivel(nome, function () {
      var c = am.findComp(), fd = c.frameDuration;
      if (sp.tipo === 'tr') { return mvTransicao(c, sp, o, nome); }
      var ls = selecao(c, true), i, l, ok = 0, pulados = [], semExpr = [], agulha = c.time;
      var modo = o.modo || 'entrada', vel = limitar(o.velocidade, 20, 400, 100) / 100, atraso = limitar(o.escalonamento, 0, 240, 0) * fd;
      var dur = Math.max(4 * fd, (Number(sp.dur) || 1) / vel);
      var texto = sp.tipo === 'txt' || sp.tipo === 'txtloop';
      for (i = 0; i < ls.length; i++) {
        l = ls[i];
        if (texto ? !(l instanceof TextLayer) : !ehVisual(l)) { pulados.push(l.name); continue; }
        // o usuário escolheu SUBSTITUIR efeitos que mexem na mesma coisa
        if (o.substituir && o.substituir.length) {
          var q, rs;
          for (q = 0; q < o.substituir.length; q++) { rs = lerRegistro(l).fx['mov:' + o.substituir[q]]; if (rs) { mvRemover(l, { id: o.substituir[q], nome: (rs.o && rs.o.nome) || o.substituir[q] }, rs); } }
        }
        var reg = lerRegistro(l).fx['mov:' + sp.id], t3dAntes = !!l.threeDLayer;
        // editando: os marcadores ficam onde a pessoa deixou
        var mk = { ii: mvLerMk(l, 'Ini ' + nome + ' in'), fi: mvLerMk(l, 'Fim ' + nome + ' in'), io: mvLerMk(l, 'Ini ' + nome + ' out'), fo: mvLerMk(l, 'Fim ' + nome + ' out'), il: mvLerMk(l, 'Ini ' + nome), fl: mvLerMk(l, 'Fim ' + nome) };
        if (reg) { if (reg.x && reg.x.t3d === false) { t3dAntes = false; } mvRemover(l, sp, reg); }
        var ini = Math.max(l.inPoint, Math.min(agulha, l.outPoint - fd)) + ok * atraso;
        if (sp.tipo === 'loop' || sp.tipo === 'txtloop') {
          var A = mk.il !== null ? mk.il : ini, B = mk.fl !== null ? mk.fl : l.outPoint;
          var foi = sp.tipo === 'loop' ? mvLoopObj(c, l, sp, o, A, B, nome) : (mvTxtLoop(c, l, sp, o, A, B, nome), true);
          if (!foi) { semExpr.push(l.name); }
          mvMarcar(l, A, 'Ini ' + nome); mvMarcar(l, B, 'Fim ' + nome);
        } else {
          // entrada na agulha; saída sozinha também na agulha; "entrada e saída": a saída termina no fim da camada
          var dE = Math.min(dur, Math.max(2 * fd, l.outPoint - ini));
          if (modo !== 'saida') {
            var a1 = mk.ii !== null ? mk.ii : ini, b1 = mk.fi !== null ? mk.fi : ini + dE;
            mvTxt(c, l, sp, o, false, a1, b1, nome + ' in');
            mvMarcar(l, a1, 'Ini ' + nome + ' in'); mvMarcar(l, b1, 'Fim ' + nome + ' in');
          }
          if (modo !== 'entrada') {
            var iniS = modo === 'saida' ? ini : Math.max(ini + dE, l.outPoint - fd - dE - (ls.length - 1 - i) * atraso);
            var a2 = mk.io !== null ? mk.io : iniS, b2 = mk.fo !== null ? mk.fo : Math.min(l.outPoint, iniS + dE);
            mvTxt(c, l, sp, o, true, a2, b2, nome + ' out');
            mvMarcar(l, a2, 'Ini ' + nome + ' out'); mvMarcar(l, b2, 'Fim ' + nome + ' out');
          }
        }
        registrar(l, 'mov:' + sp.id, copiaSimples(o), { t3d: t3dAntes });
        ok++;
      }
      if (!ok) { throw new Error(texto ? 'Selecione uma camada de TEXTO na timeline.' : 'Nenhuma camada visual selecionada.'); }
      var msg = nome + ' em ' + ok + ' camada(s), a partir da agulha. Arraste os marcadores "Ini" e "Fim" na camada para mudar o tempo.' +
        (semExpr.length ? ' Não mexi em ' + semExpr.join(', ') + ': a propriedade já tinha uma expressão sua.' : '') +
        (pulados.length ? ' Puladas: ' + pulados.join(', ') + '.' : '');
      return { camadas: ok, pulados: pulados, mensagem: msg };
    });
  };

  // ================= 1.2.8: SOM AUTOMÁTICO, BATIDAS E REVISÃO =================
  // Eventos da animação (o que entra, sai, corta, bate), lidos de keyframes, marcadores do Animar e cortes.
  // Os tempos das camadas de dentro de precomps são levados para o tempo da comp principal.
  function refComp(x) { if (x === undefined || x === null || x === '') { return null; } return /^(id:)?\d+$/.test(String(x)) ? 'id:' + String(x).replace('id:', '') : String(x); }
  am.eventosAnim = function (compId) {
    var c = am.findComp(refComp(compId));
    var ev = [], W = c.width, H = c.height;
    function add(t, tipo, nome, forca) { if (isNaN(t) || t < -0.01 || t > c.duration) { return; } ev.push({ t: Math.round(Math.max(0, t) * 1000) / 1000, tipo: tipo, camada: nome, forca: Math.round(Math.min(1, forca) * 100) / 100 }); }
    function tipoMarcador(cm) {
      var s = String(cm).toLowerCase();
      if (/ out$|saida|sai\b/.test(s)) { return 'some'; }
      if (/glitch|tremid/.test(s)) { return 'glitch'; }
      if (/flash|impacto|batida|carimbo|stamp/.test(s)) { return 'impacto'; }
      if (/digit|typew|m[aá]quina/.test(s)) { return 'digita'; }
      if (/gir|rota|spin|flip/.test(s)) { return 'giro'; }
      if (/escala|pop|bounce|elastic|zoom|surge|cresce|mola/.test(s)) { return 'surge'; }
      return 'movimento';
    }
    function val(p, k) { var v = p.keyValue(k); return (v instanceof Array) ? v : [v]; }
    function dist(a, b) { var s = 0, i; for (i = 0; i < Math.min(a.length, b.length, 2); i++) { s += (a[i] - b[i]) * (a[i] - b[i]); } return Math.sqrt(s); }
    function segs(p) { var r = [], k; try { if (!p || p.numKeys < 2) { return r; } for (k = 1; k < p.numKeys; k++) { r.push({ t1: p.keyTime(k), t2: p.keyTime(k + 1), v1: val(p, k), v2: val(p, k + 1) }); } } catch (e) {} return r; }
    function varre(comp, mapa, nivel, janela) {
      var i, l, src, tr, nome, j, s, d, dur, mk, k, cm, grande, ehCam, ehLogo, sx, sy;
      for (i = 1; i <= comp.numLayers; i++) {
        l = comp.layer(i);
        try { if (!l.enabled) { continue; } } catch (e1) {}
        nome = l.name;
        if (/^BACKUP · |^\[AUDIO\]|^Som auto · /.test(nome)) { continue; }
        try { if (l.guideLayer) { continue; } } catch (e2) {}
        src = null; try { src = l.source; } catch (e3) {}
        if (src instanceof CompItem && /^\[AUDIO\]/.test(src.name)) { continue; }
        ehCam = (l instanceof CameraLayer) || /^CAM (CTRL|FX)$/i.test(nome);
        try { if (!ehCam && l.hasVideo === false) { continue; } } catch (e4) {}
        var tIn = mapa(l.inPoint), tOut = mapa(l.outPoint);
        if (janela && (tOut <= janela[0] || tIn >= janela[1])) { continue; }
        ehLogo = /logo|marca\b/i.test(nome);
        tr = null; try { tr = l.property('ADBE Transform Group'); } catch (e5) {}
        grande = false;
        try {
          if (src && src.width) { sx = 100; sy = 100; try { var sc = tr.property('ADBE Scale').valueAtTime(l.inPoint, false); sx = sc[0]; sy = sc[1]; } catch (eS) {} grande = (src.width * Math.abs(sx) / 100) * (src.height * Math.abs(sy) / 100) >= 0.6 * W * H; }
        } catch (e6) {}
        // corte de cena: camada grande que entra no meio da comp principal
        if (nivel === 0 && !ehCam && grande && l.inPoint > 0.15) { add(tIn, 'corte', nome, 1); }
        if (/^flash$/i.test(nome)) { add(tIn, 'impacto', nome, 0.9); }
        if (tr) {
          // posição (junta ou separada)
          var pos = [];
          try {
            var pp = tr.property('ADBE Position');
            if (pp.dimensionsSeparated) { pos = segs(tr.property('ADBE Position_0')).concat(segs(tr.property('ADBE Position_1'))); }
            else { pos = segs(pp); }
          } catch (e7) {}
          for (j = 0; j < pos.length; j++) {
            s = pos[j]; dur = s.t2 - s.t1; if (dur <= 0) { continue; }
            d = (s.v1.length === 1 ? Math.abs(s.v2[0] - s.v1[0]) : dist(s.v1, s.v2)) / W;
            if (ehCam) { if (d > 0.12) { add(mapa(s.t1), 'camera', nome, d); } }
            else if (d > 0.18 && dur <= 1.2) { add(mapa(s.t1), 'movimento', nome, d); if (ehLogo) { add(mapa(s.t2), 'impacto', nome, 0.8); } }
          }
          // escala
          var esc = []; try { esc = segs(tr.property('ADBE Scale')); } catch (e8) {}
          for (j = 0; j < esc.length; j++) {
            s = esc[j]; dur = s.t2 - s.t1; if (dur <= 0) { continue; }
            var a = Math.abs(s.v1[0]), b = Math.abs(s.v2[0]);
            if (a <= 45 && b >= 70 && dur <= 1.2) { add(mapa(s.t1), 'surge', nome, 0.6); if (ehLogo) { add(mapa(s.t2), 'impacto', nome, 0.8); } }
            else if (a >= 70 && b <= 30 && dur <= 1.2) { add(mapa(s.t1), 'some', nome, 0.5); }
            else if (ehCam && (b / Math.max(1, a) > 1.4 || a / Math.max(1, b) > 1.4)) { add(mapa(s.t1), 'camera', nome, 0.7); }
          }
          // rotação
          var rot = []; try { rot = segs(tr.property(l.threeDLayer ? 'ADBE Rotate Z' : 'ADBE Rotate Z')); } catch (e9) {}
          for (j = 0; j < rot.length; j++) { s = rot[j]; if (Math.abs(s.v2[0] - s.v1[0]) >= 90 && s.t2 - s.t1 <= 1.2) { add(mapa(s.t1), 'giro', nome, 0.6); } }
          // opacidade que acende rápido
          var op = []; try { op = segs(tr.property('ADBE Opacity')); } catch (e10) {}
          for (j = 0; j < op.length; j++) { s = op[j]; if (s.v1[0] <= 5 && s.v2[0] >= 90 && s.t2 - s.t1 <= 0.25 && !/^flash$/i.test(nome)) { add(mapa(s.t1), 'surge', nome, 0.4); } }
        }
        // câmera 3D de verdade
        if (l instanceof CameraLayer) {
          try { var cp = segs(l.property('ADBE Transform Group').property('ADBE Position')); for (j = 0; j < cp.length; j++) { if (dist(cp[j].v1, cp[j].v2) / W > 0.12) { add(mapa(cp[j].t1), 'camera', nome, 0.7); } } } catch (e11) {}
        }
        // texto digitando (Source Text com várias chaves)
        try { if (l instanceof TextLayer) { var stx = l.property('ADBE Text Properties').property('ADBE Text Document'); if (stx.numKeys >= 3) { add(mapa(stx.keyTime(1)), 'digita', nome, 0.4); } } } catch (e12) {}
        // marcadores do Animar ("Ini <efeito>", "Ini <efeito> in/out") e "Corte"
        try {
          mk = l.property('ADBE Marker');
          for (k = 1; k <= mk.numKeys; k++) {
            cm = mk.keyValue(k).comment;
            if (/^Ini /.test(cm)) { add(mapa(mk.keyTime(k)), tipoMarcador(cm.replace(/^Ini /, '')), nome, 0.6); }
            else if (cm === 'Corte') { add(mapa(mk.keyTime(k)), 'corte', nome, 1); }
          }
        } catch (e13) {}
        // dentro da precomp (até 2 níveis), no tempo de fora
        if (src instanceof CompItem && nivel < 2) {
          (function (lay, mapaPai) {
            var st = 1; try { st = lay.stretch / 100; } catch (eSt) {}
            var ini = lay.startTime;
            varre(lay.source, function (t) { return mapaPai(ini + t * st); }, nivel + 1, [mapaPai(lay.inPoint), mapaPai(lay.outPoint)]);
          })(l, mapa);
        }
      }
    }
    varre(c, function (t) { return t; }, 0, null);
    try { var cmk = c.markerProperty, q; for (q = 1; q <= cmk.numKeys; q++) { if (cmk.keyValue(q).comment === 'Corte') { add(cmk.keyTime(q), 'corte', '(comp)', 1); } } } catch (e14) {}
    ev.sort(function (x, y) { return x.t - y.t; });
    var temNarr = false;
    try { var ii, lx; for (ii = 1; ii <= c.numLayers; ii++) { lx = c.layer(ii); if (lx.source instanceof CompItem && lx.source.name === NOMES_AUDIO.narracao && lx.audioEnabled !== false) { var sn = lx.source, jj; for (jj = 1; jj <= sn.numLayers; jj++) { if (!/^BACKUP · /.test(sn.layer(jj).name)) { temNarr = true; } } } } } catch (e15) {}
    return { compId: c.id, comp: c.name, duracao: c.duration, fps: c.frameRate, narracao: temNarr, eventos: ev.slice(0, 600) };
  };

  // Coloca os efeitos sonoros (lista: [{arquivo, inicio, ganho (dB), nome}]) na "[AUDIO] Efeitos sonoros".
  // Os "Som auto · " da rodada anterior viram BACKUP desligado (nada é apagado); os sons que o usuário pôs à mão ficam.
  am.colocarSons = function (compId, lista) {
    return desfazivel('sons automáticos', function () {
      var c = am.findComp(refComp(compId));
      organizarAudioSolto(c);
      var fim = 0, i; for (i = 0; i < lista.length; i++) { fim = Math.max(fim, Number(lista[i].inicio) + 3); }
      var sub = compDeAudio(c, 'sfx', fim), l, velhos = [];
      for (i = 1; i <= sub.numLayers; i++) { l = sub.layer(i); if (/^Som auto · /.test(l.name)) { velhos.push(l); } }
      for (i = 0; i < velhos.length; i++) { try { velhos[i].name = 'BACKUP · ' + velhos[i].name; velhos[i].audioEnabled = false; velhos[i].moveToEnd(); } catch (eV) {} }
      var cache = {}, it, k, f, item, n = 0, pasta = null;
      for (i = 0; i < lista.length; i++) {
        f = new File(lista[i].arquivo); if (!f.exists) { continue; }
        item = cache[f.fsName];
        if (!item) {
          for (k = 1; k <= app.project.numItems && !item; k++) { it = app.project.item(k); try { if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) { item = it; } } catch (eF) {} }
          if (!item) { item = app.project.importFile(new ImportOptions(f)); try { if (!pasta) { pasta = pastaProjeto('Arcano Sons'); } item.parentFolder = pasta; } catch (eP) {} }
          cache[f.fsName] = item;
        }
        l = sub.layers.add(item);
        l.name = 'Som auto · ' + lista[i].nome;
        l.startTime = Math.max(0, Number(lista[i].inicio) || 0);
        try { var g = Number(lista[i].ganho) || 0; l.property('ADBE Audio Group').property('ADBE Audio Levels').setValue([g, g]); } catch (eG) {}
        l.moveToBeginning();
        n++;
      }
      return { comp: c.name, colocados: n, arquivados: velhos.length, compSons: sub.name };
    });
  };

  // A trilha que toca na comp: a camada ativa da "[AUDIO] Trilha sonora" (ou um áudio solto com nome de música).
  am.audioDaTrilha = function (compId) {
    var c = am.findComp(refComp(compId));
    var i, l, j, s, achada = null, dono = null;
    function ok(x) { try { return x.hasAudio && x.audioEnabled !== false && !/^BACKUP · /.test(x.name) && x.source && x.source.file; } catch (e) { return false; } }
    for (i = 1; i <= c.numLayers && !achada; i++) {
      l = c.layer(i);
      try { if (l.source instanceof CompItem && l.source.name === NOMES_AUDIO.trilha) { s = l.source; for (j = 1; j <= s.numLayers; j++) { if (ok(s.layer(j))) { achada = s.layer(j); dono = l; break; } } } } catch (e1) {}
    }
    for (i = 1; i <= c.numLayers && !achada; i++) { l = c.layer(i); if (ok(l) && /trilha|m[uú]sica|music|track|song|bgm/i.test(l.name + ' ' + l.source.name)) { achada = l; } }
    if (!achada) { throw new Error('Nao achei a trilha na comp (nem na "' + NOMES_AUDIO.trilha + '"). Gere ou coloque a musica antes.'); }
    var desloc = dono ? dono.startTime : 0;
    return { arquivo: achada.source.file.fsName, camada: achada.name, compDaCamada: achada.containingComp.id, indice: achada.index,
      inicio: achada.startTime + desloc, entra: achada.inPoint + desloc, sai: achada.outPoint + desloc, compId: c.id, comp: c.name, duracao: c.duration };
  };

  // Marca as batidas: na camada da trilha (todas, "♪") e na comp principal (tempo 1 de cada compasso "♪ 1" e o "♪ DROP").
  // Tempos em segundos DA COMP PRINCIPAL. Os marcadores "♪" antigos saem antes.
  am.marcarBatidas = function (compId, info, batidas, compassos, drop) {
    return desfazivel('marcar batidas', function () {
      var c = am.findComp(refComp(compId));
      var lc = null, sub = null, i, mk, k;
      try { var it = app.project.itemByID(info.compDaCamada); if (it) { sub = it; lc = it.layer(info.indice); } } catch (e1) {}
      function limpa(prop) { try { for (k = prop.numKeys; k >= 1; k--) { if (/^♪/.test(prop.keyValue(k).comment)) { prop.removeKey(k); } } } catch (e) {} }
      var desloc = (sub && sub !== c) ? (info.inicio - lc.startTime) : 0;
      if (lc) { mk = lc.property('ADBE Marker'); limpa(mk); for (i = 0; i < batidas.length; i++) { try { mk.setValueAtTime(batidas[i] - desloc, new MarkerValue('♪')); } catch (e2) {} } }
      limpa(c.markerProperty);
      for (i = 0; i < compassos.length; i++) { try { c.markerProperty.setValueAtTime(compassos[i], new MarkerValue('♪ 1')); } catch (e3) {} }
      if (drop !== null && drop !== undefined && drop >= 0) { try { c.markerProperty.setValueAtTime(drop, new MarkerValue('♪ DROP')); } catch (e4) {} }
      return { comp: c.name, batidas: batidas.length, compassos: compassos.length, drop: drop };
    });
  };

  // Leva a agulha da comp para um tempo (revisão: "ir para")
  am.irPara = function (compId, t) {
    var c = am.findComp(refComp(compId));
    try { c.openInViewer(); } catch (e1) {}
    c.time = Math.max(0, Math.min(c.duration, Number(t) || 0));
    return { comp: c.name, tempo: c.time };
  };

  am.call = function (nome, args) {
    try {
      return ser({ ok: true, resultado: am[nome].apply(null, args || []) });
    } catch (e) {
      return ser({ ok: false, erro: String(e), linha: (e && e.line) ? e.line : null });
    }
  };

  $.global.__am = am;
})();
