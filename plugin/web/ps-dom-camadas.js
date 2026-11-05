/* Arcano Design no Arcano Layers — o DOM do Photoshop (app, documentos, camadas, texto, seleção,
 * Action Manager) sobre os comandos do editor de imagem. Usado pelo ps-dom.js (window.ArcanoPS).
 * Cada leitura pergunta ao editor (document.inspect, type.info); cada mudança é um comando
 * (layer.setProps, edit.transform, type.setStyle…). Documento = índice no editor (id = índice + 1);
 * camada = id do editor dentro do documento dela. */
(function () {
  'use strict';

  window.ArcanoPSDOM = function (k) {
    var ed = k.ed, UnitValue = k.UnitValue, px = k.px, File = k.File;
    var cache = {};                 // por chamada: inspeção dos documentos (zerado a cada mudança)
    function limpar() { cache = {}; }

    // ───────────── pedidos ao editor ─────────────
    function x(cmd, params) { limpar(); return ed.pedido('engine.execute', { command: cmd, params: params || {} }); }
    function q(cmd, params) { return ed.pedido('engine.execute', { command: cmd, params: params || {} }); }

    function inspecao(i) {
      var c = 'd' + i;
      if (!cache[c]) { cache[c] = q('document.inspect', { document: i }); }
      return cache[c];
    }
    function quantosDocs() {
      if (cache.n !== undefined) { return cache.n; }
      var n = 0;
      for (; n < 200; n++) { try { inspecao(n); } catch (e) { break; } }
      cache.n = n;
      return n;
    }
    function ativoIdx() {
      if (cache.ativo !== undefined) { return cache.ativo; }
      if (!quantosDocs()) { cache.ativo = -1; return -1; }
      var r = null;
      try { r = q('document.activate', { offset: 0 }); } catch (e) { r = null; }
      cache.ativo = r && typeof r.document === 'number' ? r.document : 0;
      return cache.ativo;
    }
    function ativar(i) { if (ativoIdx() !== i) { x('document.activate', { document: i }); cache.ativo = i; } }

    // ───────────── documentos ─────────────
    var docsObj = {};
    function Doc(i) { this._i = i; this.typename = 'Document'; }
    function doc(i) { return docsObj[i] || (docsObj[i] = new Doc(i)); }
    function info(d) { return inspecao(d._i); }
    function noDoc(d, f) { ativar(d._i); return f(); }
    function ppx(v) { return new UnitValue(Math.round(v * 1000) / 1000, 'px'); }

    Object.defineProperties(Doc.prototype, {
      id: { get: function () { return this._i + 1; } },
      name: { get: function () { var p = info(this).path; var n = info(this).name; return p ? String(p).split(/[\\/]/).pop() : n; } },
      width: { get: function () { return ppx(info(this).width); } },
      height: { get: function () { return ppx(info(this).height); } },
      resolution: { get: function () { return Number(info(this).resolution) || 72; } },
      mode: { get: function () { var m = String(info(this).mode || 'Rgb').toUpperCase(); return k.DocumentMode[m === 'GRAY' || m === 'GRAYSCALE' ? 'GRAYSCALE' : m] || k.DocumentMode.RGB; } },
      bitsPerChannel: {
        get: function () { var b = Number(info(this).depth) || 8; return k.BitsPerChannelType[b === 16 ? 'SIXTEEN' : b === 32 ? 'THIRTYTWO' : 'EIGHT']; },
        set: function (v) { var d = this; var b = String(v).indexOf('SIXTEEN') >= 0 ? 16 : String(v).indexOf('THIRTY') >= 0 ? 32 : 8; noDoc(d, function () { x('image.mode.bits' + b, {}); }); }
      },
      saved: { get: function () { return !!info(this).path && !info(this).canUndo; } },
      fullName: { get: function () { var p = info(this).path; if (!p) { throw new Error('O documento ainda não foi salvo.'); } return new File(p); } },
      path: { get: function () { var p = info(this).path; if (!p) { throw new Error('O documento ainda não foi salvo.'); } return new File(p).parent; } },
      layers: { get: function () { return colecao(this, null, 'todas'); } },
      artLayers: { get: function () { return colecao(this, null, 'art'); } },
      layerSets: { get: function () { return colecao(this, null, 'set'); } },
      activeLayer: {
        get: function () { var a = info(this).activeLayer; if (a === null || a === undefined) { throw new Error('Nenhuma camada selecionada.'); } return camadaPorId(this, a); },
        set: function (l) { var d = this; noDoc(d, function () { x('layer.select', { layer: l.id }); x('layer.setProps', { layer: l.id, visible: true }); }); }
      },
      selection: { get: function () { return new Selecao(this); } },
      info: { get: function () { return {}; } },
      colorProfileName: { get: function () { return 'sRGB IEC61966-2.1'; } },
      historyStates: { get: function () { return []; } }
    });
    Doc.prototype.toString = function () { return '[Document ' + this.name + ']'; };
    Doc.prototype.suspendHistory = function (nome, codigo) { return k.rodar(codigo); };
    Doc.prototype.duplicate = function (nome, soMesclado) {
      var d = this;
      return noDoc(d, function () { var r = x('image.duplicate', { name: String(nome || (d.name + ' cópia')), mergedOnly: !!soMesclado }); var i = r && typeof r.document === 'number' ? r.document : quantosDocs() - 1; cache.ativo = undefined; return doc(i); });
    };
    Doc.prototype.close = function () {
      var i = this._i;
      x('file.close', { document: i });
      // os índices depois deste descem um
      var novo = {}; Object.keys(docsObj).forEach(function (j) { j = Number(j); if (j < i) { novo[j] = docsObj[j]; } else if (j > i) { docsObj[j]._i = j - 1; novo[j - 1] = docsObj[j]; } });
      docsObj = novo; this._i = -1;
    };
    Doc.prototype.flatten = function () { var d = this; noDoc(d, function () { x('layer.flattenImage', {}); }); };
    Doc.prototype.mergeVisibleLayers = function () { var d = this; noDoc(d, function () { x('layer.mergeVisible', {}); }); };
    Doc.prototype.crop = function (b) {
      var d = this, x1 = px(b[0]), y1 = px(b[1]), x2 = px(b[2]), y2 = px(b[3]);
      noDoc(d, function () { x('image.crop', { x: Math.round(x1), y: Math.round(y1), width: Math.round(x2 - x1), height: Math.round(y2 - y1) }); });
    };
    Doc.prototype.trim = function () { var d = this; noDoc(d, function () { x('image.trim', {}); }); };
    Doc.prototype.resizeImage = function (w, h, res) {
      var d = this, p = {};
      if (w !== undefined && w !== null) { p.width = Math.max(1, Math.round(w instanceof UnitValue && w.type === '%' ? px(d.width) * w.value / 100 : px(w))); }
      if (h !== undefined && h !== null) { p.height = Math.max(1, Math.round(h instanceof UnitValue && h.type === '%' ? px(d.height) * h.value / 100 : px(h))); }
      if (res) { p.resolution = Number(res); }
      if (p.width && !p.height) { p.height = Math.max(1, Math.round(px(d.height) * p.width / px(d.width))); }
      if (p.height && !p.width) { p.width = Math.max(1, Math.round(px(d.width) * p.height / px(d.height))); }
      noDoc(d, function () { x('image.imageSize', p); });
    };
    Doc.prototype.resizeCanvas = function (w, h, ancora) {
      var d = this, a = String(ancora || 'MIDDLECENTER').replace(/^AnchorPosition\./, '');
      var mapa = { TOPLEFT: 'topLeft', TOPCENTER: 'top', TOPRIGHT: 'topRight', MIDDLELEFT: 'left', MIDDLECENTER: 'center', MIDDLERIGHT: 'right', BOTTOMLEFT: 'bottomLeft', BOTTOMCENTER: 'bottom', BOTTOMRIGHT: 'bottomRight' };
      noDoc(d, function () { x('image.canvasSize', { width: Math.round(px(w)), height: Math.round(px(h)), anchor: mapa[a] || 'center' }); });
    };
    Doc.prototype.changeMode = function (m) { var d = this, n = String(m).replace(/^ChangeMode\./, '').toLowerCase(); noDoc(d, function () { x('image.mode.' + (n === 'grayscale' ? 'grayscale' : n), {}); }); };
    Doc.prototype.rotateCanvas = function (a) { var d = this; noDoc(d, function () { x('image.rotation.arbitrary', { angle: Number(a) }); }); };
    Doc.prototype.flipCanvas = function (dir) { var d = this; noDoc(d, function () { x(String(dir).indexOf('VERTICAL') >= 0 ? 'image.imageRotation.flipCanvasVertical' : 'image.imageRotation.flipCanvasHorizontal', {}); }); };
    Doc.prototype.paste = function () { var d = this; return noDoc(d, function () { x('edit.paste', {}); return d.activeLayer; }); };
    function gravar(d, arq, opcoes) {
      var c = arq instanceof File ? arq.fsName : String(arq), tipo = opcoes && opcoes.typename || '';
      var ext = /JPEG/.test(tipo) ? 'jpg' : /PNG/.test(tipo) ? 'png' : /Photoshop/.test(tipo) ? 'psd' : /Tiff/.test(tipo) ? 'tif' : /GIF/.test(tipo) ? 'gif' : /BMP/.test(tipo) ? 'bmp' : '';
      if (ext && !new RegExp('\\.' + (ext === 'jpg' ? 'jpe?g' : ext) + '$', 'i').test(c)) { c = c.replace(/\.[^.\\/]*$/, '') + '.' + ext; }
      var qual = opcoes && opcoes.quality !== undefined ? Math.round(Math.max(1, Math.min(100, Number(opcoes.quality) * 100 / 12))) : null;
      ed.exportar(d._i, c, qual);
      return new File(c);
    }
    Doc.prototype.saveAs = function (arq, opcoes) { gravar(this, arq, opcoes); limpar(); };
    Doc.prototype.save = function () { var p = info(this).path; if (!p) { throw new Error('O documento ainda não foi salvo: use Salvar como.'); } gravar(this, p, null); limpar(); };
    Doc.prototype.exportDocument = function (arq, tipo, opcoes) {
      var t = String(opcoes && opcoes.format || tipo || ''); var o = { typename: /JPEG/.test(t) ? 'JPEGSaveOptions' : 'PNGSaveOptions', quality: opcoes && opcoes.quality !== undefined ? Number(opcoes.quality) * 12 / 100 : 10 };
      gravar(this, arq, o);
    };

    // ───────────── camadas ─────────────
    var TIPOS = { 'Pixel': 'NORMAL', 'Type': 'TEXT', 'Smart Object': 'SMARTOBJECT', 'Fill': 'SOLIDFILL', 'Gradient Fill': 'GRADIENTFILL', 'Pattern Fill': 'PATTERNFILL', 'Video': 'VIDEO', 'Shape': 'SOLIDFILL' };
    function acharNo(lista, id, pai) {
      for (var i = 0; i < (lista || []).length; i++) {
        var l = lista[i];
        if (l.id === id) { return { dado: l, pai: pai, irmas: lista, indice: i }; }
        if (l.children) { var r = acharNo(l.children, id, l); if (r) { return r; } }
      }
      return null;
    }
    function Camada(d, id) { this._d = d; this._id = id; }
    function camadaPorId(d, id) {
      var n = acharNo(info(d).layers, id, null);
      if (!n) { throw new Error('A camada ' + id + ' não existe mais no documento.'); }
      return n.dado.kind === 'Group' ? new Grupo(d, id) : new Arte(d, id);
    }
    function dado(l) { var n = acharNo(info(l._d).layers, l._id, null); if (!n) { throw new Error('A camada não existe mais.'); } return n; }
    function mudar(l, cmd, p) { p = p || {}; if (p.layer === undefined && !p.layers) { p.layer = l._id; } return noDoc(l._d, function () { return x(cmd, p); }); }
    function caixa(l) { var b = dado(l).dado.bounds; return b ? { x: b[0], y: b[1], w: b[2], h: b[3] } : { x: 0, y: 0, w: 0, h: 0 }; }

    var propsComuns = {
      id: { get: function () { return this._id; } },
      name: { get: function () { return dado(this).dado.name; }, set: function (v) { mudar(this, 'layer.renameLayer', { name: String(v) }); } },
      visible: { get: function () { return !!dado(this).dado.visible; }, set: function (v) { mudar(this, 'layer.setProps', { visible: !!v }); } },
      opacity: { get: function () { return Math.round(Number(dado(this).dado.opacity) * 10000) / 100; }, set: function (v) { mudar(this, 'layer.setProps', { opacity: Math.max(0, Math.min(1, Number(v) / 100)) }); } },
      fillOpacity: { get: function () { return Math.round(Number(dado(this).dado.fill) * 10000) / 100; }, set: function (v) { mudar(this, 'layer.setProps', { fill: Math.max(0, Math.min(1, Number(v) / 100)) }); } },
      blendMode: { get: function () { return k.modoDoPS(dado(this).dado.blend); }, set: function (v) { mudar(this, 'layer.setProps', { blend: k.modoDoEditor(v) }); } },
      bounds: { get: function () { var c = caixa(this); return [ppx(c.x), ppx(c.y), ppx(c.x + c.w), ppx(c.y + c.h)]; } },
      boundsNoEffects: { get: function () { return this.bounds; } },
      parent: { get: function () { var n = dado(this); return n.pai ? new Grupo(this._d, n.pai.id) : this._d; } },
      allLocked: { get: function () { var lk = dado(this).dado.locks; return !!(lk && lk.all); }, set: function (v) { mudar(this, 'layer.setProps', { locks: { all: !!v } }); } },
      linkedLayers: { get: function () { return []; } },
      itemIndex: { get: function () { return dado(this).indice; } }
    };
    function Arte(d, id) { Camada.call(this, d, id); this.typename = 'ArtLayer'; }
    function Grupo(d, id) { Camada.call(this, d, id); this.typename = 'LayerSet'; }
    Object.defineProperties(Arte.prototype, propsComuns);
    Object.defineProperties(Grupo.prototype, propsComuns);
    Object.defineProperties(Arte.prototype, {
      kind: {
        get: function () { var t = dado(this).dado.kind; return k.LayerKind[TIPOS[t] || (/adjust/i.test(t) ? 'LEVELS' : 'NORMAL')]; },
        set: function (v) {
          if (String(v).indexOf('TEXT') < 0 || this.kind === k.LayerKind.TEXT) { return; }
          // camada vazia virando texto (o jeito do Photoshop de criar texto pelo DOM)
          var d = this._d, velho = this._id, nome = this.name, W = px(d.width), H = px(d.height);
          var r = noDoc(d, function () { return x('type.create', { x: Math.round(W / 2), y: Math.round(H / 2), text: 'Texto', size: 24, color: '#000000', name: nome }); });
          noDoc(d, function () { x('layer.moveTo', { layer: r.layer, target: velho, position: 'above' }); x('layer.delete', { layer: velho }); });
          this._id = r.layer;
        }
      },
      isBackgroundLayer: {
        get: function () { var n = dado(this); return !n.pai && n.indice === n.irmas.length - 1 && n.dado.kind === 'Pixel' && /^(Background|Fundo|Plano de fundo)$/i.test(n.dado.name); },
        set: function (v) { if (!v && this.isBackgroundLayer) { mudar(this, 'layer.new.layerFromBackground', {}); } }
      },
      grouped: { get: function () { return !!dado(this).dado.clipped; }, set: function (v) { mudar(this, 'layer.setProps', { clipped: !!v }); } },
      positionLocked: { get: function () { var lk = dado(this).dado.locks; return !!(lk && lk.position); }, set: function (v) { mudar(this, 'layer.setProps', { locks: { position: !!v } }); } },
      pixelsLocked: { get: function () { var lk = dado(this).dado.locks; return !!(lk && lk.pixels); }, set: function (v) { mudar(this, 'layer.setProps', { locks: { pixels: !!v } }); } },
      transparentPixelsLocked: { get: function () { var lk = dado(this).dado.locks; return !!(lk && lk.transparency); }, set: function (v) { mudar(this, 'layer.setProps', { locks: { transparency: !!v } }); } },
      textItem: { get: function () { if (dado(this).dado.kind !== 'Type') { throw new Error('A camada "' + this.name + '" não é de texto.'); } return new Texto(this); } }
    });
    Object.defineProperties(Grupo.prototype, {
      layers: { get: function () { return colecao(this._d, this, 'todas'); } },
      artLayers: { get: function () { return colecao(this._d, this, 'art'); } },
      layerSets: { get: function () { return colecao(this._d, this, 'set'); } },
      enabledChannels: { get: function () { return []; } }
    });
    function metodos(P) {
      P.toString = function () { return '[' + this.typename + ' ' + this.name + ']'; };
      P.translate = function (dx, dy) { var a = px(dx), b = px(dy); if (Math.abs(a) < 1e-6 && Math.abs(b) < 1e-6) { return; } mudar(this, 'edit.transform', { dx: a, dy: b }); };
      P.resize = function (sx, sy, ancora) {
        var antes = caixa(this), kx = sx === undefined || sx === null ? 100 : Number(sx), ky = sy === undefined || sy === null ? kx : Number(sy);
        mudar(this, 'edit.transform', { scaleX: kx, scaleY: ky });
        var a = String(ancora || 'MIDDLECENTER').replace(/^AnchorPosition\./, ''), depois = caixa(this);
        var fx = /LEFT$/.test(a) ? 0 : /RIGHT$/.test(a) ? 1 : 0.5, fy = /^TOP/.test(a) ? 0 : /^BOTTOM/.test(a) ? 1 : 0.5;
        var dx = (antes.x + antes.w * fx) - (depois.x + depois.w * fx), dy = (antes.y + antes.h * fy) - (depois.y + depois.h * fy);
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) { mudar(this, 'edit.transform', { dx: dx, dy: dy }); }
      };
      P.rotate = function (ang) { mudar(this, 'edit.transform', { rotate: Number(ang) }); };
      P.remove = function () { mudar(this, 'layer.delete', {}); };
      P.duplicate = function (rel, onde) {
        var d = this._d, eu = this;
        if (rel && rel.typename === 'Document' && rel._i !== d._i) {
          var r = noDoc(d, function () { return x('layer.copyToDocument', { document: rel._i, layers: [eu._id], source: d._i }); });
          var idNovo = r && (r.layer || (r.layers && r.layers[0]));
          cache.ativo = undefined;
          var nova = idNovo !== undefined ? camadaPorId(rel, idNovo) : rel.activeLayer;
          if (onde) { try { nova.move(rel, onde); } catch (e) { /* fica onde entrou */ } }
          return nova;
        }
        var r2 = mudar(this, 'layer.duplicate', {});
        var c = camadaPorId(d, r2.layer);
        if (rel && onde) { c.move(rel, onde); }
        return c;
      };
      P.move = function (rel, onde) {
        var o = String(onde || 'PLACEBEFORE').replace(/^ElementPlacement\./, ''), d = this._d, alvo, pos;
        if (rel && rel.typename === 'Document') {
          var top = info(d).layers;
          if (!top.length) { return; }
          if (o === 'PLACEATEND') { alvo = top[top.length - 1].id; pos = 'below'; } else { alvo = top[0].id; pos = 'above'; }
          if (alvo === this._id) { return; }
        } else if (rel && rel.typename === 'LayerSet' && (o === 'INSIDE' || o === 'PLACEATBEGINNING' || o === 'PLACEATEND')) {
          var filhas = dado(rel).dado.children || [];
          if (!filhas.length || o === 'INSIDE') { alvo = rel._id; pos = 'into'; }
          else if (o === 'PLACEATEND') { alvo = filhas[filhas.length - 1].id; pos = 'below'; }
          else { alvo = filhas[0].id; pos = 'above'; }
        } else {
          alvo = rel._id; pos = o === 'PLACEAFTER' ? 'below' : 'above';
        }
        mudar(this, 'layer.moveTo', { target: alvo, position: pos });
      };
      P.merge = function () { var r = mudar(this, 'layer.mergeDown', {}); return r && r.layer !== undefined ? camadaPorId(this._d, r.layer) : this._d.activeLayer; };
      P.rasterize = function () { mudar(this, 'layer.rasterize.layer', {}); };
      P.link = function () {}; P.unlink = function () {};
      P.clear = function () { var eu = this; noDoc(eu._d, function () { x('layer.select', { layer: eu._id }); x('edit.clear', {}); }); };
      P.invert = function () { var eu = this; noDoc(eu._d, function () { x('layer.select', { layer: eu._id }); x('image.adjustments.invert', {}); }); };
      P.desaturate = function () { var eu = this; noDoc(eu._d, function () { x('layer.select', { layer: eu._id }); x('image.adjustments.desaturate', {}); }); };
      P.applyGaussianBlur = function (r) { var eu = this; noDoc(eu._d, function () { x('layer.select', { layer: eu._id }); x('filter.blur.gaussianBlur', { radius: Number(r) }); }); };
      P.adjustBrightnessContrast = function (b, c) { var eu = this; noDoc(eu._d, function () { x('layer.select', { layer: eu._id }); x('image.adjustments.brightnessContrast', { brightness: Number(b) || 0, contrast: Number(c) || 0 }); }); };
    }
    metodos(Arte.prototype); metodos(Grupo.prototype);

    // ───────────── coleções (layers / artLayers / layerSets) ─────────────
    function colecao(d, grupo, tipo) {
      var lista = grupo ? (dado(grupo).dado.children || []) : info(d).layers;
      var arr = [];
      lista.forEach(function (l) {
        var g = l.kind === 'Group';
        if (tipo === 'art' && g) { return; }
        if (tipo === 'set' && !g) { return; }
        arr.push(g ? new Grupo(d, l.id) : new Arte(d, l.id));
      });
      arr.typename = tipo === 'art' ? 'ArtLayers' : tipo === 'set' ? 'LayerSets' : 'Layers';
      arr.parent = grupo || d;
      arr.getByName = function (n) { for (var i = 0; i < arr.length; i++) { if (arr[i].name === n) { return arr[i]; } } throw new Error('Não achei "' + n + '".'); };
      arr.index = function (l) { for (var i = 0; i < arr.length; i++) { if (arr[i].id === l.id) { return i; } } return -1; };
      arr.removeAll = function () { arr.forEach(function (l) { l.remove(); }); };
      arr.add = function () {
        var r;
        // entra acima da ativa; dentro de um grupo: no topo dele
        if (grupo) {
          var filhas = dado(grupo).dado.children || [];
          noDoc(d, function () { x('layer.select', { layer: filhas.length ? filhas[0].id : grupo._id }); });
        }
        r = noDoc(d, function () { return x(tipo === 'set' ? 'layer.new.group' : 'layer.new.layer', {}); });
        var nova = tipo === 'set' ? new Grupo(d, r.layer) : new Arte(d, r.layer);
        if (grupo) { try { var n = dado(nova); if (!n.pai || n.pai.id !== grupo._id) { nova.move(grupo, k.ElementPlacement.PLACEATBEGINNING); } } catch (e) { /* fica */ } }
        return nova;
      };
      return arr;
    }

    // ───────────── texto ─────────────
    function Texto(l) { this._l = l; this.typename = 'TextItem'; }
    function tinfo(t) { var c = 't' + t._l._d._i + ':' + t._l._id; if (!cache[c]) { cache[c] = noDoc(t._l._d, function () { return q('type.info', { layer: t._l._id }); }); } return cache[c]; }
    function estilo(t) { var r = tinfo(t).runs || []; return (r[0] && r[0].style) || {}; }
    function setStyle(t, p) { p.layer = t._l._id; noDoc(t._l._d, function () { x('type.setStyle', p); }); }
    function corDoEstilo(c) {
      var sc = new k.SolidColor();
      if (c && c.c) { sc.rgb.red = Math.round(c.c[0] * 255); sc.rgb.green = Math.round(c.c[1] * 255); sc.rgb.blue = Math.round(c.c[2] * 255); }
      return sc;
    }
    Object.defineProperties(Texto.prototype, {
      contents: { get: function () { return String(tinfo(this).text || '').replace(/\n/g, '\r'); }, set: function (v) { var t = this; noDoc(t._l._d, function () { x('type.edit', { layer: t._l._id, text: String(v).replace(/\r\n|\r/g, '\n') }); }); } },
      font: { get: function () { var s = estilo(this); return s.postscript_name || s.font_family; }, set: function (v) { setStyle(this, { font: String(v) }); } },
      size: { get: function () { return new UnitValue(Number(estilo(this).size_pt) || 12, 'pt'); }, set: function (v) { setStyle(this, { size: v instanceof UnitValue ? v.as('pt') : Number(v) }); } },
      color: { get: function () { return corDoEstilo(estilo(this).color); }, set: function (c) { setStyle(this, { color: k.hexDaCor(c) }); } },
      kind: { get: function () { return tinfo(this).shape === 'Point' ? k.TextType.POINTTEXT : k.TextType.PARAGRAPHTEXT; }, set: function (v) { var t = this, b = this._l.bounds; noDoc(t._l._d, function () { x('type.edit', String(v).indexOf('PARAGRAPH') >= 0 ? { layer: t._l._id, box: [px(b[0]), px(b[1]), Math.max(10, px(b[2]) - px(b[0])), Math.max(10, px(b[3]) - px(b[1]))] } : { layer: t._l._id, point: [px(b[0]), px(b[3])] }); }); } },
      position: {
        get: function () { var m = tinfo(this).transform || [1, 0, 0, 1, 0, 0]; return [new UnitValue(m[4], 'px'), new UnitValue(m[5], 'px')]; },
        set: function (p) { var t = this; noDoc(t._l._d, function () { x('type.edit', { layer: t._l._id, point: [px(p[0]), px(p[1])] }); }); }
      },
      justification: {
        get: function () { var p = (tinfo(this).paragraphs || [])[0], a = p && p.style && p.style.align || 'Left'; return k.Justification[String(a).toUpperCase() === 'JUSTIFY' ? 'FULLYJUSTIFIED' : String(a).toUpperCase()] || k.Justification.LEFT; },
        set: function (v) { var a = String(v).replace(/^Justification\./, ''); setStyle(this, { align: a === 'CENTER' ? 'center' : a === 'RIGHT' ? 'right' : /JUSTIFIED/.test(a) ? 'justify' : 'left' }); }
      },
      capitalization: { get: function () { return String(estilo(this).caps) === 'All' ? k.TextCase.ALLCAPS : k.TextCase.NORMAL; }, set: function (v) { setStyle(this, { caps: String(v).indexOf('ALLCAPS') >= 0 ? 'all' : String(v).indexOf('SMALL') >= 0 ? 'small' : 'normal' }); } },
      tracking: { get: function () { return Number(estilo(this).tracking) || 0; }, set: function (v) { setStyle(this, { tracking: Number(v) }); } },
      leading: { get: function () { return new UnitValue(Number(estilo(this).leading_pt) || 0, 'pt'); }, set: function (v) { setStyle(this, { leading: v instanceof UnitValue ? v.as('pt') : Number(v) }); } },
      useAutoLeading: { get: function () { return estilo(this).leading_pt === null || estilo(this).leading_pt === undefined; }, set: function (v) { if (v) { setStyle(this, { leading: 'auto' }); } } },
      fauxBold: { get: function () { return !!estilo(this).faux_bold; }, set: function (v) { setStyle(this, { fauxBold: !!v }); } },
      fauxItalic: { get: function () { return !!estilo(this).faux_italic; }, set: function (v) { setStyle(this, { fauxItalic: !!v }); } },
      underline: { get: function () { return !!estilo(this).underline; }, set: function (v) { setStyle(this, { underline: !!v && String(v) !== 'UnderlineType.UNDERLINEOFF' }); } },
      horizontalScale: { get: function () { return (Number(estilo(this).horizontal_scale) || 1) * 100; }, set: function (v) { setStyle(this, { horizontalScale: Number(v) }); } },
      verticalScale: { get: function () { return (Number(estilo(this).vertical_scale) || 1) * 100; }, set: function (v) { setStyle(this, { verticalScale: Number(v) }); } },
      baselineShift: { get: function () { return new UnitValue(Number(estilo(this).baseline_shift_pt) || 0, 'pt'); }, set: function (v) { setStyle(this, { baselineShift: v instanceof UnitValue ? v.as('pt') : Number(v) }); } },
      width: { get: function () { var b = tinfo(this).bounds || [0, 0, 0, 0]; return new UnitValue(b[2] - b[0], 'px'); }, set: function () {} },
      height: { get: function () { var b = tinfo(this).bounds || [0, 0, 0, 0]; return new UnitValue(b[3] - b[1], 'px'); }, set: function () {} },
      antiAliasMethod: { get: function () { return 'AntiAlias.SMOOTH'; }, set: function () {} },
      direction: { get: function () { return 'Direction.HORIZONTAL'; }, set: function () {} }
    });
    Texto.prototype.convertToShape = function () { var t = this; noDoc(t._l._d, function () { x('type.convertToShape', { layer: t._l._id }); }); };
    Texto.prototype.createPath = function () {};

    // ───────────── seleção ─────────────
    function Selecao(d) { this._d = d; this.typename = 'Selection'; }
    Object.defineProperties(Selecao.prototype, {
      bounds: { get: function () { var b = info(this._d).selectionBounds; if (!b) { throw new Error('Não há seleção.'); } return [ppx(b[0]), ppx(b[1]), ppx(b[0] + b[2]), ppx(b[1] + b[3])]; } },
      solid: { get: function () { return !!info(this._d).hasSelection; } },
      parent: { get: function () { return this._d; } }
    });
    Selecao.prototype.select = function (pontos, tipo, pena) {
      var xs = pontos.map(function (p) { return px(p[0]); }), ys = pontos.map(function (p) { return px(p[1]); });
      var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys), x1 = Math.max.apply(null, xs), y1 = Math.max.apply(null, ys);
      var m = String(tipo || '').indexOf('EXTEND') >= 0 ? 'add' : String(tipo || '').indexOf('DIMINISH') >= 0 ? 'subtract' : String(tipo || '').indexOf('INTERSECT') >= 0 ? 'intersect' : 'replace';
      var d = this._d; noDoc(d, function () { x('select.rect', { x: Math.round(x0), y: Math.round(y0), width: Math.max(1, Math.round(x1 - x0)), height: Math.max(1, Math.round(y1 - y0)), mode: m, feather: Number(pena) || 0 }); });
    };
    Selecao.prototype.selectAll = function () { var d = this._d; noDoc(d, function () { x('select.all', {}); }); };
    Selecao.prototype.deselect = function () { var d = this._d; noDoc(d, function () { x('select.deselect', {}); }); };
    Selecao.prototype.invert = function () { var d = this._d; noDoc(d, function () { x('select.inverse', {}); }); };
    Selecao.prototype.fill = function (cor, modo, opac) { var d = this._d; noDoc(d, function () { x('edit.fill', { contents: 'color', color: k.hexDaCor(cor), opacity: opac === undefined ? 100 : Number(opac) }); }); };
    Selecao.prototype.clear = function () { var d = this._d; noDoc(d, function () { x('edit.clear', {}); }); };
    Selecao.prototype.copy = function (mesclado) { var d = this._d; noDoc(d, function () { x(mesclado ? 'edit.copyMerged' : 'edit.copy', {}); }); };
    Selecao.prototype.cut = function () { var d = this._d; noDoc(d, function () { x('edit.cut', {}); }); };
    Selecao.prototype.feather = function (r) { var d = this._d; noDoc(d, function () { x('select.modify.feather', { radius: Number(r) }); }); };
    Selecao.prototype.expand = function (r) { var d = this._d; noDoc(d, function () { x('select.modify.expand', { by: Math.round(px(r)) }); }); };
    Selecao.prototype.contract = function (r) { var d = this._d; noDoc(d, function () { x('select.modify.contract', { by: Math.round(px(r)) }); }); };
    Selecao.prototype.stroke = function (cor, largura) { var d = this._d; noDoc(d, function () { x('edit.stroke', { width: Math.round(Number(largura) || 1), color: k.hexDaCor(cor) }); }); };

    // ───────────── app ─────────────
    var prefs = { rulerUnits: k.Units.PIXELS, typeUnits: k.TypeUnits.POINTS };
    var app = { typename: 'Application', name: 'Adobe Photoshop', version: '27.0.0', locale: 'pt_BR', preferences: prefs, displayDialogs: k.DialogModes.NO, notifiersEnabled: false, playbackDisplayDialogs: k.DialogModes.NO };
    var corFrente = k.corDoHex('#000000'), corFundo = k.corDoHex('#ffffff');
    Object.defineProperties(app, {
      documents: {
        get: function () {
          var n = quantosDocs(), arr = [];
          for (var i = 0; i < n; i++) { arr.push(doc(i)); }
          arr.typename = 'Documents';
          arr.getByName = function (nome) { for (var j = 0; j < arr.length; j++) { if (arr[j].name === nome) { return arr[j]; } } throw new Error('Documento "' + nome + '" não está aberto.'); };
          arr.add = function (w, h, res, nome, modo, fundo) {
            var f = String(fundo || 'DocumentFill.WHITE');
            var r = x('file.new', { width: Math.round(px(w || 1920)), height: Math.round(px(h || 1080)), resolution: Number(res) || 72, name: String(nome || 'Sem título'),
              mode: String(modo || '').indexOf('GRAYSCALE') >= 0 ? 'gray' : 'rgb', background: f.indexOf('TRANSPARENT') >= 0 ? 'transparent' : f.indexOf('BACKGROUND') >= 0 ? 'backgroundColor' : 'white' });
            cache.ativo = undefined;
            return doc(r && typeof r.document === 'number' ? r.document : quantosDocs() - 1);
          };
          return arr;
        }
      },
      activeDocument: {
        get: function () { var i = ativoIdx(); if (i < 0) { throw new Error('Nenhum documento aberto.'); } return doc(i); },
        set: function (d) { ativar(d._i); }
      },
      fonts: {
        get: function () {
          if (cache.fontes) { return cache.fontes; }
          var fams = (q('type.fonts', {}) || {}).families || [], arr = [];
          fams.forEach(function (f) {
            var faces = [];
            try { faces = (q('type.fonts', { family: f }) || {}).faces || []; } catch (e) { faces = []; }
            if (!faces.length) { faces = [{ family: f, style: 'Regular', postscriptName: f.replace(/\s+/g, '') }]; }
            faces.forEach(function (fc) { arr.push({ typename: 'TextFont', family: fc.family || f, style: fc.style || 'Regular', postScriptName: fc.postscriptName || f, name: (fc.family || f) + ' ' + (fc.style || '') }); });
          });
          arr.getByName = function (n) { for (var i = 0; i < arr.length; i++) { if (arr[i].postScriptName === n || arr[i].name === n) { return arr[i]; } } throw new Error('Fonte "' + n + '" não instalada.'); };
          cache.fontes = arr;
          return arr;
        }
      },
      foregroundColor: { get: function () { return corFrente; }, set: function (c) { corFrente = c; try { x('tools.setColors', { foreground: k.hexDaCor(c) }); } catch (e) { /* só guarda */ } } },
      backgroundColor: { get: function () { return corFundo; }, set: function (c) { corFundo = c; try { x('tools.setColors', { background: k.hexDaCor(c) }); } catch (e) { /* só guarda */ } } }
    });
    app.open = function (arq) {
      var c = arq instanceof File ? arq.fsName : String(arq);
      ed.abrir(c); limpar();
      return doc(ativoIdx());
    };
    app.load = function () { throw new Error('Carregar pincéis/padrões/estilos ainda não funciona no editor de imagem do Arcano Layers.'); };
    app.purge = function () {}; app.refresh = function () {}; app.beep = function () {}; app.bringToFront = function () {};
    app.doAction = function () { throw new Error('Ações gravadas do Photoshop não rodam no editor do Arcano Layers.'); };
    app.batch = app.doAction;

    // ───────────── Action Manager (só os pedidos que o Arcano usa + os comuns) ─────────────
    var am = acoes();
    app.charIDToTypeID = am.charIDToTypeID; app.stringIDToTypeID = am.stringIDToTypeID;
    app.executeAction = function (a, b, c) { return am.executeAction(a, b, c); };
    app.executeActionGet = function (r) { return am.executeActionGet(r); };
    function acoes() {
      var ids = {}, nomes = {}, prox = 1000;
      // charID e stringID que são a mesma coisa no Photoshop viram o mesmo número
      var PARES = { 'Lyr ': 'layer', 'Dcmn': 'document', 'Chnl': 'channel', 'Msk ': 'mask', 'slct': 'select', 'Mk  ': 'make', 'Plc ': 'placeEvent', 'setd': 'set', 'Dlt ': 'delete',
        'null': 'target', 'Nm  ': 'name', 'Usng': 'using', 'At  ': 'at', 'T   ': 'to', 'fsel': 'selection', 'Trsp': 'transparencyEnum', 'Ordn': 'ordinal', 'Trgt': 'targetEnum', 'Nw  ': 'new',
        'Brsh': 'brush', 'Prpr': 'property', 'Ofst': 'offset', 'Hrzn': 'horizontal', 'Vrtc': 'vertical', '#Pxl': 'pixelsUnit', 'FTcs': 'freeTransformCenterState', 'MkVs': 'makeVisible', 'Vrsn': 'version',
        'Trnf': 'transform', 'Wdth': 'width', 'Hght': 'height', 'Prc ': 'percentUnit', 'Angl': 'angle', 'Shw ': 'show', 'Hd  ': 'hide', 'Dplc': 'duplicate', 'Mrg2': 'mergeLayersNew', 'FlIm': 'flattenImage',
        'Opct': 'opacity', 'Md  ': 'mode', 'Clr ': 'color', 'RGBC': 'RGBColor', 'Rd  ': 'red', 'Grn ': 'grain', 'Bl  ': 'blue', 'Txt ': 'textKey', 'TxLr': 'textLayer', 'Cntn': 'contentLayer', 'Lefr': 'left', 'Top ': 'top', 'Btom': 'bottom', 'Rght': 'right',
        'All ': 'allEnum', 'None': 'none', 'Rctn': 'rectangle', 'UsrM': 'userMaskEnabled', 'RvlS': 'revealSelection', 'RvlA': 'revealAll', 'HdAl': 'hideAll', 'Hd  S': 'hideSelection', 'Ply ': 'play', 'Actn': 'action', 'ASet': 'actionSet' };
      Object.keys(PARES).forEach(function (c) { var n = prox++; ids['c:' + c] = n; ids['s:' + PARES[c]] = n; nomes[n] = { c: c, s: PARES[c] }; });
      function cid(s) { s = String(s); if (ids['c:' + s] === undefined) { var n = prox++; ids['c:' + s] = n; nomes[n] = { c: s }; } return ids['c:' + s]; }
      function sid(s) { s = String(s); if (ids['s:' + s] === undefined) { var n = prox++; ids['s:' + s] = n; nomes[n] = { s: s }; } return ids['s:' + s]; }
      function nome(n) { var o = nomes[n] || {}; return o.s || o.c || String(n); }
      function eh(n, s) { return nome(n) === s; }

      function Desc() { this._v = {}; this._o = []; this.typename = 'ActionDescriptor'; }
      Object.defineProperty(Desc.prototype, 'count', { get: function () { return this._o.length; } });
      function por(t) { return function (chave, a, b) { if (!(chave in this._v)) { this._o.push(chave); } this._v[chave] = { t: t, a: a, b: b }; }; }
      ['putBoolean', 'putInteger', 'putDouble', 'putString', 'putPath', 'putReference', 'putList', 'putClass', 'putData', 'putLargeInteger', 'putIdentifier'].forEach(function (m) { Desc.prototype[m] = por(m.slice(3).toLowerCase()); });
      Desc.prototype.putUnitDouble = function (c, u, v) { if (!(c in this._v)) { this._o.push(c); } this._v[c] = { t: 'unitdouble', a: v, u: u }; };
      Desc.prototype.putEnumerated = function (c, t, v) { if (!(c in this._v)) { this._o.push(c); } this._v[c] = { t: 'enumerated', a: v, et: t }; };
      Desc.prototype.putObject = function (c, cl, v) { if (!(c in this._v)) { this._o.push(c); } this._v[c] = { t: 'object', a: v, cl: cl }; };
      Desc.prototype.hasKey = function (c) { return c in this._v; };
      Desc.prototype.getKey = function (i) { return this._o[i]; };
      Desc.prototype.erase = function (c) { delete this._v[c]; this._o = this._o.filter(function (x2) { return x2 !== c; }); };
      Desc.prototype.clear = function () { this._v = {}; this._o = []; };
      function get(t) { return function (c) { if (!(c in this._v)) { throw new Error('Chave ' + nome(c) + ' não existe neste descritor.'); } return this._v[c].a; }; }
      ['getBoolean', 'getInteger', 'getDouble', 'getString', 'getReference', 'getList', 'getObjectValue', 'getData', 'getLargeInteger', 'getClass', 'getEnumerationValue', 'getUnitDoubleValue'].forEach(function (m) { Desc.prototype[m] = get(m); });
      Desc.prototype.getPath = function (c) { if (!(c in this._v)) { throw new Error('Chave ' + nome(c) + ' não existe.'); } var a = this._v[c].a; return a instanceof File ? a : new File(String(a)); };
      Desc.prototype.getType = function (c) { return 'DescValueType.' + String(this._v[c] && this._v[c].t || '').toUpperCase() + 'TYPE'; };
      Desc.prototype.getEnumerationType = function (c) { return this._v[c].et; };
      Desc.prototype.getObjectType = function (c) { return this._v[c].cl; };
      Desc.prototype.getUnitDoubleType = function (c) { return this._v[c].u; };
      Desc.prototype.toStream = function () { return ''; };

      function Ref() { this._p = []; this.typename = 'ActionReference'; }
      ['putClass', 'putEnumerated', 'putIdentifier', 'putIndex', 'putName', 'putOffset', 'putProperty'].forEach(function (m) {
        Ref.prototype[m] = function (cl, a, b) { this._p.push({ t: m.slice(3).toLowerCase(), cl: cl, a: a, b: b }); return this; };
      });
      Ref.prototype.getForm = function () { return this._p[0] ? 'ReferenceFormType.' + this._p[0].t.toUpperCase() : null; };
      Ref.prototype.getDesiredClass = function () { return this._p[0] && this._p[0].cl; };
      Ref.prototype.getIdentifier = function () { return this._p[0] && this._p[0].a; };
      Ref.prototype.getIndex = function () { return this._p[0] && this._p[0].a; };
      Ref.prototype.getName = function () { return this._p[0] && this._p[0].a; };
      Ref.prototype.getEnumeratedValue = function () { return this._p[0] && this._p[0].b; };
      Ref.prototype.getContainer = function () { var r = new Ref(); r._p = this._p.slice(1); return r; };

      function Lista() { this._l = []; this.typename = 'ActionList'; }
      Object.defineProperty(Lista.prototype, 'count', { get: function () { return this._l.length; } });
      ['putBoolean', 'putInteger', 'putDouble', 'putString', 'putPath', 'putReference', 'putList', 'putClass', 'putIdentifier'].forEach(function (m) { Lista.prototype[m] = function (a, b) { this._l.push(b === undefined ? a : b); }; });
      Lista.prototype.putUnitDouble = function (u, v) { this._l.push(v); };
      Lista.prototype.putEnumerated = function (t, v) { this._l.push(v); };
      Lista.prototype.putObject = function (c, v) { this._l.push(v); };
      ['getBoolean', 'getInteger', 'getDouble', 'getString', 'getReference', 'getList', 'getObjectValue', 'getPath', 'getUnitDoubleValue', 'getEnumerationValue', 'getClass', 'getIdentifier'].forEach(function (m) { Lista.prototype[m] = function (i) { return this._l[i]; }; });

      // camada citada numa referência (id, índice, nome ou a selecionada)
      function camadaDaRef(r) {
        var d = app.activeDocument, p = r && r._p && r._p.filter(function (x2) { return eh(x2.cl, 'layer'); })[0];
        if (!p || p.t === 'enumerated' || p.t === 'property') { return d.activeLayer; }
        if (p.t === 'identifier') { return camadaPorId(d, Number(p.a)); }
        if (p.t === 'name') { return d.layers.getByName(String(p.a)); }
        if (p.t === 'index') { var todas = []; (function walk(ls) { ls.forEach(function (l) { todas.push(l); if (l.children) { walk(l.children); } }); })(info(d).layers); todas.reverse(); var n = todas[Number(p.a) - 1]; if (!n) { throw new Error('Não achei a camada ' + p.a + '.'); } return camadaPorId(d, n.id); }
        return d.activeLayer;
      }
      function v(dsc, s) { var c = sid(s); return dsc && dsc._v[c] ? dsc._v[c] : null; }

      function executeAction(ev, dsc) {
        var e = nome(ev), alvo = v(dsc, 'target'), d;
        if (e === 'select' && alvo && alvo.a && alvo.a._p) {
          var p0 = alvo.a._p[0];
          if (p0 && eh(p0.cl, 'document')) { var nd = app.documents; app.activeDocument = nd.getByName ? (p0.t === 'name' ? nd.getByName(p0.a) : nd[Number(p0.a) - 1] || nd[0]) : nd[0]; return new Desc(); }
          var l = camadaDaRef(alvo.a); d = l._d;
          noDoc(d, function () { x('layer.select', { layer: l._id }); });
          return new Desc();
        }
        if (e === 'placeEvent') {
          var arq = alvo && alvo.a; ed.colocar(arq instanceof File ? arq.fsName : String(arq)); limpar();
          return new Desc();
        }
        if (e === 'make') {
          var nw = v(dsc, 'new'), usando = v(dsc, 'using');
          if (alvo && alvo.a && alvo.a._p && alvo.a._p[0] && eh(alvo.a._p[0].cl, 'document') && usando && usando.a && usando.a._p) {
            // documento novo a partir da camada (Camada › Duplicar para documento novo)
            var lc = camadaDaRef(usando.a), nomeD = v(dsc, 'name');
            noDoc(lc._d, function () { x('layer.duplicate', { layer: lc._id, document: 'new', documentName: nomeD ? String(nomeD.a) : 'Sem título' }); });
            cache.ativo = undefined;
            return new Desc();
          }
          if (nw && eh(nw.a, 'channel') && usando) {
            var modo = nome(usando.a);
            d = app.activeDocument;
            noDoc(d, function () { x(modo === 'hideSelection' ? 'layer.layerMask.hideSelection' : modo === 'revealAll' ? 'layer.layerMask.revealAll' : modo === 'hideAll' ? 'layer.layerMask.hideAll' : 'layer.layerMask.revealSelection', {}); });
            return new Desc();
          }
          if (alvo && alvo.a && alvo.a._p && alvo.a._p[0] && eh(alvo.a._p[0].cl, 'layer')) { d = app.activeDocument; d.artLayers.add(); return new Desc(); }
          throw new Error('Criar "' + (alvo && alvo.a && alvo.a._p && alvo.a._p[0] ? nome(alvo.a._p[0].cl) : '?') + '" pelo Action Manager ainda não funciona no editor de imagem do Arcano Layers.');
        }
        if (e === 'set' && alvo && alvo.a && alvo.a._p && alvo.a._p[0] && eh(alvo.a._p[0].cl, 'channel') && eh(alvo.a._p[0].a, 'selection')) {
          var para = v(dsc, 'to');
          d = app.activeDocument;
          if (para && para.a && para.a._p && para.a._p[0] && eh(para.a._p[0].b, 'transparencyEnum')) {
            var lt = d.activeLayer; noDoc(d, function () { x('select.loadSelection', { channel: 'transparency', layer: lt._id }); });
          } else if (para && (eh(para.a, 'none') || (para.a && para.a._p && para.a._p[0] && eh(para.a._p[0].b, 'none')))) { d.selection.deselect(); }
          else if (para && (eh(para.a, 'allEnum') || (para.a && para.a._p && para.a._p[0] && eh(para.a._p[0].b, 'allEnum')))) { d.selection.selectAll(); }
          else { throw new Error('Esse tipo de seleção pelo Action Manager ainda não funciona no editor do Arcano Layers.'); }
          return new Desc();
        }
        if (e === 'delete' && alvo && alvo.a && alvo.a._p && alvo.a._p[0]) {
          var p1 = alvo.a._p[0];
          d = app.activeDocument;
          if (eh(p1.cl, 'channel') && eh(p1.b, 'mask')) { noDoc(d, function () { x('layer.layerMask.delete', {}); }); return new Desc(); }
          if (eh(p1.cl, 'layer')) { camadaDaRef(alvo.a).remove(); return new Desc(); }
        }
        if (e === 'show' || e === 'hide') { camadaDaRef(alvo && alvo.a && alvo.a._p ? alvo.a : null).visible = e === 'show'; return new Desc(); }
        if (e === 'flattenImage') { app.activeDocument.flatten(); return new Desc(); }
        if (e === 'mergeLayersNew') { d = app.activeDocument; noDoc(d, function () { x('layer.mergeLayers', {}); }); return new Desc(); }
        throw new Error('A ação "' + e + '" do Photoshop ainda não funciona no editor de imagem do Arcano Layers. Use o DOM (app.activeDocument, camadas, textItem).');
      }

      function executeActionGet(r) {
        var p = r && r._p && r._p[0], out = new Desc();
        if (p && eh(p.cl, 'layer')) {
          var l = camadaDaRef(r), dd = dado(l).dado;
          out.putString(sid('name'), dd.name); out.putInteger(sid('layerID'), l._id); out.putBoolean(sid('visible'), !!dd.visible);
          out.putUnitDouble(sid('opacity'), sid('percentUnit'), Math.round(dd.opacity * 255));
          var b = new Desc(), c = caixa(l);
          b.putUnitDouble(sid('left'), sid('pixelsUnit'), c.x); b.putUnitDouble(sid('top'), sid('pixelsUnit'), c.y);
          b.putUnitDouble(sid('right'), sid('pixelsUnit'), c.x + c.w); b.putUnitDouble(sid('bottom'), sid('pixelsUnit'), c.y + c.h);
          b.putUnitDouble(sid('width'), sid('pixelsUnit'), c.w); b.putUnitDouble(sid('height'), sid('pixelsUnit'), c.h);
          out.putObject(sid('bounds'), sid('rectangle'), b); out.putObject(sid('boundsNoEffects'), sid('rectangle'), b);
          out.putBoolean(sid('group'), !!dd.clipped);
          return out;
        }
        if (p && eh(p.cl, 'document')) {
          var d2 = app.activeDocument, i2 = info(d2);
          out.putString(sid('title'), d2.name); out.putInteger(sid('documentID'), d2.id);
          out.putUnitDouble(sid('width'), sid('pixelsUnit'), i2.width); out.putUnitDouble(sid('height'), sid('pixelsUnit'), i2.height);
          out.putDouble(sid('resolution'), Number(i2.resolution) || 72); out.putInteger(sid('numberOfLayers'), (i2.layers || []).length);
          return out;
        }
        return out;
      }

      return { charIDToTypeID: cid, stringIDToTypeID: sid, typeIDToCharID: function (n) { return (nomes[n] || {}).c || ''; }, typeIDToStringID: function (n) { return (nomes[n] || {}).s || ''; },
        ActionDescriptor: Desc, ActionReference: Ref, ActionList: Lista, executeAction: executeAction, executeActionGet: executeActionGet };
    }

    return {
      app: app, charIDToTypeID: am.charIDToTypeID, stringIDToTypeID: am.stringIDToTypeID, typeIDToCharID: am.typeIDToCharID, typeIDToStringID: am.typeIDToStringID,
      ActionDescriptor: am.ActionDescriptor, ActionReference: am.ActionReference, ActionList: am.ActionList,
      executeAction: am.executeAction, executeActionGet: am.executeActionGet,
      inicioChamada: function () { limpar(); }, fimChamada: function () { limpar(); }
    };
  };
})();
