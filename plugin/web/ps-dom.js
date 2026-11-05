/* Arcano Design no Arcano Layers (editor de imagem): o "Photoshop" que o arcano-ps.jsx e a IA usam
 * (app, documentos, camadas, texto, ActionDescriptor…), feito em cima dos comandos do editor.
 * O script do Photoshop é síncrono: cada acesso vira um pedido síncrono ao editor
 * (navegador: window.parent.photocraftArcano; PC: o conector, pelo canal local do programa).
 *
 *   var ps = ArcanoPS({ ed: <transporte>, fs: <fs do shim>, docs: <pasta Documentos>, temp: <pasta temp> });
 *   ps.avaliar(codigoExtendScript)  -> resultado (o que o evalScript devolveria)
 *
 * Transporte (ed): pedido(metodo, params) -> result (lança erro), colocar(caminho), abrir(caminho),
 * exportar(indiceDoc|null, caminho, qualidade). Mesma fonte para o navegador e o programa de PC.
 */
(function () {
  'use strict';

  function ArcanoPS(op) {
    var ed = op.ed, fs = op.fs;
    var G = {};            // escopo global do ExtendScript ($.global)

    // ───────────── unidades, enums, cores ─────────────
    function UnitValue(v, u) {
      if (!(this instanceof UnitValue)) { return new UnitValue(v, u); }
      if (typeof v === 'string' && u === undefined) { var m = /^\s*(-?[\d.]+)\s*([a-z%]*)/i.exec(v); this.value = m ? Number(m[1]) : 0; this.type = (m && m[2]) || 'px'; }
      else { this.value = Number(v) || 0; this.type = String(u || 'px'); }
    }
    var PT = 72;  // documento a 72 ppi: 1 pt = 1 px
    function emPx(v, t, res) {
      res = res || 72;
      switch (String(t).toLowerCase()) {
        case 'px': case 'pixels': return v;
        case 'pt': case 'points': return v * res / PT;
        case 'in': case 'inches': return v * res;
        case 'cm': return v * res / 2.54;
        case 'mm': return v * res / 25.4;
        case '%': return v;
        default: return v;
      }
    }
    UnitValue.prototype.as = function (u) { var p = emPx(this.value, this.type); if (/^(px|pixels)$/i.test(u)) { return p; } return p / emPx(1, u); };
    UnitValue.prototype.convert = function (u) { this.value = this.as(u); this.type = u; return true; };
    UnitValue.prototype.valueOf = function () { return this.value; };
    UnitValue.prototype.toString = function () { return this.value + ' ' + this.type; };
    function px(v) { if (v instanceof UnitValue) { return v.as('px'); } if (typeof v === 'string') { return new UnitValue(v).as('px'); } return Number(v) || 0; }

    function en(nome, lista) {
      var o = {};
      lista.forEach(function (k) { o[k] = { toString: function () { return nome + '.' + k; }, valueOf: function () { return nome + '.' + k; }, _n: k }; });
      return o;
    }
    var Units = en('Units', ['PIXELS', 'POINTS', 'INCHES', 'CM', 'MM', 'PERCENT', 'PICAS']);
    var TypeUnits = en('TypeUnits', ['PIXELS', 'POINTS', 'MM']);
    var DialogModes = en('DialogModes', ['NO', 'ERROR', 'ALL']);
    var LayerKind = en('LayerKind', ['NORMAL', 'TEXT', 'SMARTOBJECT', 'SOLIDFILL', 'GRADIENTFILL', 'PATTERNFILL', 'VIDEO', 'LAYER3D', 'BRIGHTNESSCONTRAST', 'LEVELS', 'CURVES', 'HUESATURATION', 'COLORBALANCE', 'BLACKANDWHITE', 'EXPOSURE', 'VIBRANCE', 'PHOTOFILTER', 'CHANNELMIXER', 'GRADIENTMAP', 'INVERSION', 'POSTERIZE', 'THRESHOLD', 'SELECTIVECOLOR', 'COLORLOOKUP']);
    var ElementPlacement = en('ElementPlacement', ['PLACEATBEGINNING', 'PLACEATEND', 'PLACEBEFORE', 'PLACEAFTER', 'INSIDE']);
    var AnchorPosition = en('AnchorPosition', ['TOPLEFT', 'TOPCENTER', 'TOPRIGHT', 'MIDDLELEFT', 'MIDDLECENTER', 'MIDDLERIGHT', 'BOTTOMLEFT', 'BOTTOMCENTER', 'BOTTOMRIGHT']);
    var ResampleMethod = en('ResampleMethod', ['NONE', 'NEARESTNEIGHBOR', 'BILINEAR', 'BICUBIC', 'BICUBICSHARPER', 'BICUBICSMOOTHER', 'AUTOMATIC', 'PRESERVEDETAILS']);
    var SaveOptions = en('SaveOptions', ['DONOTSAVECHANGES', 'SAVECHANGES', 'PROMPTTOSAVECHANGES']);
    var DocumentMode = en('DocumentMode', ['RGB', 'CMYK', 'GRAYSCALE', 'LAB', 'BITMAP', 'INDEXEDCOLOR', 'MULTICHANNEL', 'DUOTONE']);
    var ChangeMode = en('ChangeMode', ['RGB', 'CMYK', 'GRAYSCALE', 'LAB', 'BITMAP', 'INDEXEDCOLOR', 'MULTICHANNEL']);
    var BitsPerChannelType = en('BitsPerChannelType', ['ONE', 'EIGHT', 'SIXTEEN', 'THIRTYTWO']);
    var NewDocumentMode = en('NewDocumentMode', ['RGB', 'CMYK', 'GRAYSCALE', 'LAB', 'BITMAP']);
    var DocumentFill = en('DocumentFill', ['WHITE', 'BACKGROUNDCOLOR', 'TRANSPARENT']);
    var TextType = en('TextType', ['POINTTEXT', 'PARAGRAPHTEXT']);
    var TextCase = en('TextCase', ['NORMAL', 'ALLCAPS', 'SMALLCAPS']);
    var Justification = en('Justification', ['LEFT', 'CENTER', 'RIGHT', 'FULLYJUSTIFIED', 'LEFTJUSTIFIED', 'CENTERJUSTIFIED', 'RIGHTJUSTIFIED']);
    var Extension = en('Extension', ['LOWERCASE', 'UPPERCASE', 'NONE']);
    var FormatOptions = en('FormatOptions', ['STANDARDBASELINE', 'OPTIMIZEDBASELINE', 'PROGRESSIVE']);
    var MatteType = en('MatteType', ['NONE', 'WHITE', 'BLACK', 'FOREGROUND', 'BACKGROUND', 'NETSCAPE', 'SEMIGRAY']);
    var SelectionType = en('SelectionType', ['REPLACE', 'EXTEND', 'DIMINISH', 'INTERSECT']);
    var ColorBlendMode = en('ColorBlendMode', ['NORMAL', 'MULTIPLY', 'SCREEN', 'OVERLAY']);
    var BlendMode = en('BlendMode', ['NORMAL', 'PASSTHROUGH', 'DISSOLVE', 'DARKEN', 'MULTIPLY', 'COLORBURN', 'LINEARBURN', 'DARKERCOLOR', 'LIGHTEN', 'SCREEN', 'COLORDODGE', 'LINEARDODGE', 'LIGHTERCOLOR', 'OVERLAY', 'SOFTLIGHT', 'HARDLIGHT', 'VIVIDLIGHT', 'LINEARLIGHT', 'PINLIGHT', 'HARDMIX', 'DIFFERENCE', 'EXCLUSION', 'SUBTRACT', 'DIVIDE', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY']);
    var AntiAlias = en('AntiAlias', ['NONE', 'SHARP', 'CRISP', 'STRONG', 'SMOOTH']);
    var Direction = en('Direction', ['HORIZONTAL', 'VERTICAL']);
    var LayerType = en('LayerType', ['ARTLAYER', 'LAYERSET']);

    // BlendMode do Photoshop <-> modo do editor (camelCase)
    var MODOS = { NORMAL: 'normal', PASSTHROUGH: 'passThrough', DISSOLVE: 'dissolve', DARKEN: 'darken', MULTIPLY: 'multiply', COLORBURN: 'colorBurn', LINEARBURN: 'linearBurn', DARKERCOLOR: 'darkerColor', LIGHTEN: 'lighten', SCREEN: 'screen', COLORDODGE: 'colorDodge', LINEARDODGE: 'linearDodge', LIGHTERCOLOR: 'lighterColor', OVERLAY: 'overlay', SOFTLIGHT: 'softLight', HARDLIGHT: 'hardLight', VIVIDLIGHT: 'vividLight', LINEARLIGHT: 'linearLight', PINLIGHT: 'pinLight', HARDMIX: 'hardMix', DIFFERENCE: 'difference', EXCLUSION: 'exclusion', SUBTRACT: 'subtract', DIVIDE: 'divide', HUE: 'hue', SATURATION: 'saturation', COLOR: 'color', LUMINOSITY: 'luminosity' };
    function modoDoEditor(bm) { var k = bm && bm._n ? bm._n : String(bm || '').replace(/^BlendMode\./, ''); return MODOS[k] || 'normal'; }
    function modoDoPS(m) { m = String(m || 'normal').toLowerCase().replace(/[^a-z]/g, ''); for (var k in MODOS) { if (MODOS[k].toLowerCase() === m) { return BlendMode[k]; } } return BlendMode.NORMAL; }

    function hex2(n) { n = Math.max(0, Math.min(255, Math.round(Number(n) || 0))); return (n < 16 ? '0' : '') + n.toString(16).toUpperCase(); }
    function RGBColor() { this.red = 0; this.green = 0; this.blue = 0; }
    Object.defineProperty(RGBColor.prototype, 'hexValue', {
      get: function () { return hex2(this.red) + hex2(this.green) + hex2(this.blue); },
      set: function (h) { h = String(h).replace('#', ''); this.red = parseInt(h.slice(0, 2), 16) || 0; this.green = parseInt(h.slice(2, 4), 16) || 0; this.blue = parseInt(h.slice(4, 6), 16) || 0; }
    });
    function SolidColor() { this.rgb = new RGBColor(); this.model = 'ColorModel.RGB'; this.typename = 'SolidColor'; }
    SolidColor.prototype.isEqual = function (c) { return c && c.rgb && c.rgb.hexValue === this.rgb.hexValue; };
    function corDoHex(h) { var c = new SolidColor(); c.rgb.hexValue = String(h || '#000000'); return c; }
    function hexDaCor(c) { return '#' + (c && c.rgb ? c.rgb.hexValue : '000000').toLowerCase(); }

    function Opcoes(tipo) { return function () { this.typename = tipo; }; }
    var PNGSaveOptions = Opcoes('PNGSaveOptions'), JPEGSaveOptions = Opcoes('JPEGSaveOptions'), PhotoshopSaveOptions = Opcoes('PhotoshopSaveOptions'),
      TiffSaveOptions = Opcoes('TiffSaveOptions'), ExportOptionsSaveForWeb = Opcoes('ExportOptionsSaveForWeb'), GIFSaveOptions = Opcoes('GIFSaveOptions'),
      BMPSaveOptions = Opcoes('BMPSaveOptions'), PDFSaveOptions = Opcoes('PDFSaveOptions');
    var SaveDocumentType = en('SaveDocumentType', ['PNG', 'JPEG', 'PHOTOSHOP', 'TIFF', 'GIF', 'BMP']);
    var ExportType = en('ExportType', ['SAVEFORWEB', 'ILLUSTRATORPATHS']);

    // ───────────── arquivos (pelo conector: só as pastas do Arcano e o que a pessoa escolheu) ─────────────
    function normal(c) { return String(c || '').replace(/^~(?=\/|\\|$)/, op.casa || '~'); }
    function File(c) {
      if (!(this instanceof File)) { return new File(c); }
      if (c instanceof File || c instanceof Folder) { c = c.fsName; }
      this.fsName = normal(c); this.fullName = this.fsName; this.absoluteURI = this.fsName; this.typename = 'File';
      this.name = encodeURI(this.fsName.split(/[\\/]/).pop()); this.displayName = decodeURI(this.name);
      this._buf = null; this._modo = null; this.encoding = 'UTF-8'; this.error = '';
    }
    Object.defineProperty(File.prototype, 'exists', { get: function () { try { return fs.existsSync(this.fsName) && fs.statSync(this.fsName).isFile(); } catch (e) { return false; } } });
    Object.defineProperty(File.prototype, 'parent', { get: function () { return new Folder(this.fsName.replace(/[\\/][^\\/]*$/, '')); } });
    Object.defineProperty(File.prototype, 'length', { get: function () { try { return fs.statSync(this.fsName).size; } catch (e) { return -1; } } });
    Object.defineProperty(File.prototype, 'modified', { get: function () { try { return new Date(fs.statSync(this.fsName).mtimeMs); } catch (e) { return null; } } });
    File.prototype.open = function (modo) {
      this._modo = String(modo || 'r').charAt(0);
      try {
        if (this._modo === 'r') { this._buf = fs.readFileSync(this.fsName, 'utf8'); this._pos = 0; }
        else if (this._modo === 'a') { this._buf = this.exists ? fs.readFileSync(this.fsName, 'utf8') : ''; }
        else { this._buf = ''; fs.writeFileSync(this.fsName, ''); }
        return true;
      } catch (e) { this.error = e.message; return false; }
    };
    File.prototype.read = function (n) { var s = this._buf || ''; var r = n === undefined ? s.slice(this._pos) : s.slice(this._pos, this._pos + n); this._pos += r.length; return r; };
    File.prototype.readln = function () { var s = this._buf || '', i = s.indexOf('\n', this._pos), r = i < 0 ? s.slice(this._pos) : s.slice(this._pos, i); this._pos = i < 0 ? s.length : i + 1; return r.replace(/\r$/, ''); };
    Object.defineProperty(File.prototype, 'eof', { get: function () { return !this._buf || this._pos >= this._buf.length; } });
    File.prototype.write = function () { for (var i = 0; i < arguments.length; i++) { this._buf += String(arguments[i]); } return true; };
    File.prototype.writeln = function () { this.write.apply(this, arguments); this._buf += '\n'; return true; };
    File.prototype.close = function () { if (this._modo === 'w' || this._modo === 'a' || this._modo === 'e') { try { fs.writeFileSync(this.fsName, this._buf || '', 'utf8'); } catch (e) { this.error = e.message; return false; } } this._buf = null; return true; };
    File.prototype.remove = function () { try { fs.unlinkSync(this.fsName); return true; } catch (e) { return false; } };
    File.prototype.copy = function (dest) { try { fs.writeFileSync(dest instanceof File ? dest.fsName : normal(dest), fs.readFileSync(this.fsName)); return true; } catch (e) { return false; } };
    File.prototype.rename = function (n) { try { var d = this.parent.fsName + '/' + n; fs.renameSync(this.fsName, d); this.fsName = d; return true; } catch (e) { return false; } };
    File.prototype.execute = function () { return false; };
    File.prototype.toString = function () { return this.fsName; };
    File.openDialog = function () { return null; };
    File.saveDialog = function () { return null; };
    File.fs = op.windows ? 'Windows' : 'Macintosh';
    File.encode = encodeURI; File.decode = decodeURI;

    function Folder(c) {
      if (!(this instanceof Folder)) { return new Folder(c); }
      if (c instanceof File || c instanceof Folder) { c = c.fsName; }
      this.fsName = normal(c).replace(/[\\/]+$/, ''); this.fullName = this.fsName; this.absoluteURI = this.fsName; this.typename = 'Folder';
      this.name = encodeURI(this.fsName.split(/[\\/]/).pop());
    }
    Object.defineProperty(Folder.prototype, 'exists', { get: function () { try { return fs.existsSync(this.fsName) && fs.statSync(this.fsName).isDirectory(); } catch (e) { return false; } } });
    Object.defineProperty(Folder.prototype, 'parent', { get: function () { return new Folder(this.fsName.replace(/[\\/][^\\/]*$/, '')); } });
    Folder.prototype.create = function () { try { fs.mkdirSync(this.fsName, { recursive: true }); return true; } catch (e) { return false; } };
    Folder.prototype.remove = function () { try { fs.rmdirSync(this.fsName); return true; } catch (e) { return false; } };
    Folder.prototype.getFiles = function (filtro) {
      var self = this, nomes = [];
      try { nomes = fs.readdirSync(this.fsName); } catch (e) { return []; }
      var re = null;
      if (typeof filtro === 'string') { re = new RegExp('^' + filtro.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'); }
      return nomes.map(function (n) {
        var c = self.fsName + '/' + n, d = false;
        try { d = fs.statSync(c).isDirectory(); } catch (e) {}
        return d ? new Folder(c) : new File(c);
      }).filter(function (f) { if (re) { return re.test(decodeURI(f.name)); } if (typeof filtro === 'function') { return filtro(f); } return true; });
    };
    Folder.prototype.toString = function () { return this.fsName; };
    Object.defineProperty(Folder, 'myDocuments', { get: function () { return new Folder(op.docs); } });
    Object.defineProperty(Folder, 'temp', { get: function () { return new Folder(op.temp); } });
    Object.defineProperty(Folder, 'desktop', { get: function () { return new Folder(op.docs); } });
    Object.defineProperty(Folder, 'userData', { get: function () { return new Folder(op.dados || op.docs); } });
    Folder.selectDialog = function () { return null; };
    Folder.fs = File.fs;

    // ───────────── $ ─────────────
    var $ = {
      global: G, level: 0, version: '4.5', build: 'Arcano', os: op.windows ? 'Windows' : 'Macintosh', locale: 'pt_BR', engineName: 'main',
      writeln: function () { try { console.log('[Arcano Design]', Array.prototype.join.call(arguments, '')); } catch (e) {} },
      write: function () { try { console.log('[Arcano Design]', Array.prototype.join.call(arguments, '')); } catch (e) {} },
      sleep: function () {}, gc: function () {}, hiresTimer: 0,
      evalFile: function (f) { var c = f instanceof File ? f.fsName : String(f); return avaliar(op.lerScript ? op.lerScript(c) : fs.readFileSync(c, 'utf8')); },
      getenv: function () { return null; }, setenv: function () {},
      fileName: '', line: 0, stack: '', error: null
    };
    Object.defineProperty($, 'hiresTimer', { get: function () { return Math.round(performance.now() * 1000); } });

    var dom = op.criarDOM({ rodar: function (c) { return avaliar(c); }, ed: ed, fs: fs, op: op, UnitValue: UnitValue, px: px, File: File, Folder: Folder, SolidColor: SolidColor, corDoHex: corDoHex, hexDaCor: hexDaCor,
      modoDoEditor: modoDoEditor, modoDoPS: modoDoPS, LayerKind: LayerKind, ElementPlacement: ElementPlacement, AnchorPosition: AnchorPosition,
      DocumentMode: DocumentMode, BitsPerChannelType: BitsPerChannelType, TextType: TextType, TextCase: TextCase, Justification: Justification, DialogModes: DialogModes, Units: Units, TypeUnits: TypeUnits,
      SaveDocumentType: SaveDocumentType, DocumentFill: DocumentFill, BlendMode: BlendMode });

    var nomesGlobais = {
      UnitValue: UnitValue, Units: Units, TypeUnits: TypeUnits, DialogModes: DialogModes, LayerKind: LayerKind, ElementPlacement: ElementPlacement,
      AnchorPosition: AnchorPosition, ResampleMethod: ResampleMethod, SaveOptions: SaveOptions, DocumentMode: DocumentMode, ChangeMode: ChangeMode,
      BitsPerChannelType: BitsPerChannelType, NewDocumentMode: NewDocumentMode, DocumentFill: DocumentFill, TextType: TextType, TextCase: TextCase,
      Justification: Justification, Extension: Extension, FormatOptions: FormatOptions, MatteType: MatteType, SelectionType: SelectionType,
      ColorBlendMode: ColorBlendMode, BlendMode: BlendMode, AntiAlias: AntiAlias, Direction: Direction, LayerType: LayerType,
      SolidColor: SolidColor, RGBColor: RGBColor, PNGSaveOptions: PNGSaveOptions, JPEGSaveOptions: JPEGSaveOptions, PhotoshopSaveOptions: PhotoshopSaveOptions,
      TiffSaveOptions: TiffSaveOptions, ExportOptionsSaveForWeb: ExportOptionsSaveForWeb, GIFSaveOptions: GIFSaveOptions, BMPSaveOptions: BMPSaveOptions, PDFSaveOptions: PDFSaveOptions,
      SaveDocumentType: SaveDocumentType, ExportType: ExportType,
      File: File, Folder: Folder, $: $, app: dom.app, preferences: dom.app.preferences, documents: dom.app.documents,
      charIDToTypeID: dom.charIDToTypeID, stringIDToTypeID: dom.stringIDToTypeID, typeIDToCharID: dom.typeIDToCharID, typeIDToStringID: dom.typeIDToStringID,
      ActionDescriptor: dom.ActionDescriptor, ActionReference: dom.ActionReference, ActionList: dom.ActionList,
      executeAction: dom.executeAction, executeActionGet: dom.executeActionGet,
      alert: function (m) { $.writeln('alert: ', m); }, confirm: function () { return true; }, prompt: function (m, d) { return d || ''; },
      isNaN: isNaN, parseInt: parseInt, parseFloat: parseFloat
    };
    for (var k in nomesGlobais) { G[k] = nomesGlobais[k]; }

    // O código roda "dentro" do global do ExtendScript ($.global): o que ele guardar lá fica para a próxima chamada.
    var rodar = new Function('__G', '__codigo', 'with (__G) { return eval(__codigo); }');
    function avaliar(codigo) {
      codigo = String(codigo).replace(/^﻿/, '').replace(/^\s*#(target|targetengine|include|script|strict)\b.*$/gm, '');
      return rodar(G, codigo);
    }

    return {
      avaliar: function (codigo) {
        try {
          dom.inicioChamada();
          var r = avaliar(codigo);
          return r === undefined || r === null ? '' : String(r);
        } catch (e) {
          try { console.warn('[Arcano Design] erro no script:', e); } catch (x) {}
          return 'EvalScript error.';
        } finally { dom.fimChamada(); }
      },
      global: G
    };
  }

  window.ArcanoPS = ArcanoPS;
})();
