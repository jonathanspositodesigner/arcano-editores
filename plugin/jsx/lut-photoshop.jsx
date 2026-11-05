/* Arcano Motion — roda DENTRO do Photoshop (o After manda pelo BridgeTalk).
   Faz sozinho o que se fazia à mão com a imagem "Neutral-512":
     1. duplica o PSD (o original não é tocado) e deixa só os ajustes de cor visíveis
        (Curvas, Níveis, Pesquisa de cores, Matiz/Saturação, Mapa de gradiente, Cor seletiva,
        Filtro de foto, Equilíbrio de cores, Preto e branco, Mixer de canais, Exposição, Vibração,
        Cor sólida...), na mesma ordem, modo de mesclagem e opacidade;
     2. coloca embaixo deles a imagem neutra (HALD 64x64x64, 512x512, 16 bits);
     3. achata e salva em PNG 16 bits. Quem calcula as cores é o próprio Photoshop.
   O painel lê esse PNG e escreve o .cube.
   Entrada: ARCANO_LUT_JOB = { psd, hald, saida, resultado, inicio }  (definido antes do $.evalFile)
   ES3 de propósito (ExtendScript). */
(function () {
  var job = (typeof ARCANO_LUT_JOB !== 'undefined') ? ARCANO_LUT_JOB : null;
  if (!job) { return; }

  function cTID(s) { return charIDToTypeID(s); }
  function sTID(s) { return stringIDToTypeID(s); }

  function esc(s) {
    s = String(s);
    var out = '"', i, c, code, h;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i); code = s.charCodeAt(i);
      if (c === '"') { out += '\\"'; } else if (c === '\\') { out += '\\\\'; }
      else if (code < 32 || code > 126) { h = code.toString(16); while (h.length < 4) { h = '0' + h; } out += '\\u' + h; }
      else { out += c; }
    }
    return out + '"';
  }
  function ser(v) {
    var i, k, p = [];
    if (v === null || v === undefined) { return 'null'; }
    if (typeof v === 'boolean') { return v ? 'true' : 'false'; }
    if (typeof v === 'number') { return isFinite(v) ? String(v) : 'null'; }
    if (typeof v === 'string') { return esc(v); }
    if (v instanceof Array) { for (i = 0; i < v.length; i++) { p.push(ser(v[i])); } return '[' + p.join(',') + ']'; }
    for (k in v) { if (v.hasOwnProperty(k)) { p.push(esc(k) + ':' + ser(v[k])); } }
    return '{' + p.join(',') + '}';
  }
  function gravar(caminho, texto) {
    var tmp = new File(caminho + '.tmp'), fim = new File(caminho);
    tmp.encoding = 'UTF-8'; tmp.open('w'); tmp.write(texto); tmp.close();
    if (fim.exists) { fim.remove(); }
    tmp.rename(fim.name);
  }

  // avisa o painel que o Photoshop recebeu o pedido
  try { if (job.inicio) { gravar(job.inicio, 'ok'); } } catch (eI) {}

  var r = { ok: false, ajustes: [], ignoradas: 0, recortes: 0, grupos: 0, bits: 16 };
  var dlgAntes = app.displayDialogs, unAntes = app.preferences.rulerUnits;
  var src = null, abriu = false, dup = null, hald = null, idHald = null;

  // tipo da camada: 'ajuste' | 'cor' (cor sólida) | 'grupo' | 'outra'
  var KINDS = ['BLACKANDWHITE', 'BRIGHTNESSCONTRAST', 'CHANNELMIXER', 'COLORBALANCE', 'CURVES', 'EXPOSURE', 'GRADIENTMAP',
    'HUESATURATION', 'INVERSION', 'LEVELS', 'PHOTOFILTER', 'POSTERIZE', 'SELECTIVECOLOR', 'THRESHOLD', 'VIBRANCE', 'COLORLOOKUP'];
  function descCamada(l) {
    var ref = new ActionReference();
    ref.putIdentifier(cTID('Lyr '), l.id);
    return executeActionGet(ref);
  }
  function tipoCamada(l) {
    if (l.typename === 'LayerSet') { return 'grupo'; }
    var k = null, i;
    try { var d = descCamada(l); if (d.hasKey(sTID('layerKind'))) { k = d.getInteger(sTID('layerKind')); } } catch (e) {}
    if (k === 2) { return 'ajuste'; }
    if (k === 11) { return 'cor'; }
    if (k !== null) { return 'outra'; }
    for (i = 0; i < KINDS.length; i++) { try { if (LayerKind[KINDS[i]] !== undefined && l.kind === LayerKind[KINDS[i]]) { return 'ajuste'; } } catch (e2) {} }
    try { if (l.kind === LayerKind.SOLIDFILL) { return 'cor'; } } catch (e3) {}
    return 'outra';
  }
  function ehHald(l) { try { return idHald !== null && l.id === idHald; } catch (e) { return false; } }

  // tira tudo que não é ajuste de cor; devolve quantas camadas ficaram
  function limpar(colecao) {
    var ficou = 0, i, l, t, k;
    for (i = colecao.length - 1; i >= 0; i--) {
      l = colecao[i];
      if (ehHald(l)) { ficou++; continue; }
      t = tipoCamada(l);
      if (!l.visible) { l.remove(); continue; }
      if (t === 'grupo') {
        k = limpar(l.layers);
        if (!k) { l.remove(); continue; }
        // grupo em Normal isola o que tem dentro; sem as fotos, os ajustes dele não fariam nada.
        // Em "Passagem" eles agem na imagem neutra, como agiam nas fotos do grupo.
        try { if (l.blendMode === BlendMode.NORMAL) { l.blendMode = BlendMode.PASSTHROUGH; r.grupos++; } } catch (eB) {}
        desligarMascaras(l);
        ficou++;
        continue;
      }
      if (t === 'ajuste' || t === 'cor') {
        r.ajustes.push(l.name);
        try { if (l.grouped) { l.grouped = false; r.recortes++; } } catch (eG) {}
        desligarMascaras(l);
        ficou++;
        continue;
      }
      r.ignoradas++;
      try { if (l.isBackgroundLayer) { l.isBackgroundLayer = false; } } catch (eF) {}
      l.remove();
    }
    return ficou;
  }

  // o LUT vale para a imagem inteira: máscaras desligadas (senão só parte da imagem neutra recebe a cor)
  function desligarMascaras(l) {
    var d, temU = false, temV = false;
    try { d = descCamada(l); } catch (e) { return; }
    try { temU = d.hasKey(sTID('hasUserMask')) && d.getBoolean(sTID('hasUserMask')); } catch (e1) {}
    try { temV = d.hasKey(sTID('hasVectorMask')) && d.getBoolean(sTID('hasVectorMask')); } catch (e2) {}
    function setar(chave) {
      try {
        var desc = new ActionDescriptor(), ref = new ActionReference(), p = new ActionDescriptor();
        ref.putIdentifier(cTID('Lyr '), l.id);
        desc.putReference(cTID('null'), ref);
        p.putBoolean(sTID(chave), false);
        desc.putObject(cTID('T   '), cTID('Lyr '), p);
        executeAction(cTID('setd'), desc, DialogModes.NO);
      } catch (e3) {}
    }
    if (temU) { setar('userMaskEnabled'); }
    if (temV) { setar('vectorMaskEnabled'); }
  }

  try {
    app.displayDialogs = DialogModes.NO;
    app.preferences.rulerUnits = Units.PIXELS;

    var alvo = new File(job.psd), i;
    if (!alvo.exists) { throw new Error('Não achei o PSD: ' + job.psd); }
    for (i = 0; i < app.documents.length && !src; i++) {
      try { if (app.documents[i].fullName.fsName.toLowerCase() === alvo.fsName.toLowerCase()) { src = app.documents[i]; } } catch (eD) {}
    }
    if (!src) { src = app.open(alvo); abriu = true; }
    app.activeDocument = src;
    if (src.mode !== DocumentMode.RGB) { throw new Error('O PSD não está em RGB. No Photoshop: Imagem > Modo > Cor RGB, salve e tente de novo.'); }
    if (src.bitsPerChannel === BitsPerChannelType.THIRTYTWO) { throw new Error('O PSD está em 32 bits. No Photoshop: Imagem > Modo > 16 bits/canal, salve e tente de novo.'); }
    var perfil = null;
    try { perfil = src.colorProfileName; } catch (eP) { perfil = null; }

    // cópia do PSD em 16 bits com a tela do tamanho da imagem neutra
    dup = src.duplicate('Arcano LUT (temporario)', false);
    app.activeDocument = dup;
    if (dup.bitsPerChannel !== BitsPerChannelType.SIXTEEN) { dup.bitsPerChannel = BitsPerChannelType.SIXTEEN; }
    dup.resizeCanvas(UnitValue(512, 'px'), UnitValue(512, 'px'), AnchorPosition.TOPLEFT);

    // imagem neutra com o MESMO perfil (atribuído, sem converter): os números não mudam ao colar
    hald = app.open(new File(job.hald));
    app.activeDocument = hald;
    if (hald.bitsPerChannel !== BitsPerChannelType.SIXTEEN) { hald.bitsPerChannel = BitsPerChannelType.SIXTEEN; }
    try { if (perfil) { hald.colorProfileName = perfil; } else { hald.colorProfileType = ColorProfile.NONE; } } catch (eA) {}
    hald.selection.selectAll();
    hald.selection.copy();
    hald.close(SaveOptions.DONOTSAVECHANGES); hald = null;

    app.activeDocument = dup;
    dup.activeLayer = dup.layers[0];
    dup.paste();
    var camHald = dup.activeLayer;
    camHald.name = 'Arcano neutra';
    idHald = camHald.id;
    var b = camHald.bounds;
    if (b[0].as('px') !== 0 || b[1].as('px') !== 0) { camHald.translate(-b[0].as('px'), -b[1].as('px')); }

    limpar(dup.layers);
    if (!r.ajustes.length) { throw new Error('Não achei nenhum ajuste de cor visível no PSD (Curvas, Níveis, Pesquisa de cores, Matiz/Saturação...).'); }

    // a imagem neutra vai para o fundo, embaixo de todos os ajustes
    camHald.move(dup, ElementPlacement.PLACEATEND);
    try { camHald.blendMode = BlendMode.NORMAL; camHald.opacity = 100; camHald.fillOpacity = 100; camHald.visible = true; } catch (eH) {}

    dup.flatten();
    var opc = new PNGSaveOptions();
    try { opc.compression = 1; } catch (eC) {}
    try { opc.interlaced = false; } catch (eN) {}
    dup.saveAs(new File(job.saida), opc, true, Extension.LOWERCASE);
    try { r.bits = dup.bitsPerChannel === BitsPerChannelType.SIXTEEN ? 16 : 8; } catch (eBt) {}
    r.ok = true;
  } catch (e) {
    r.ok = false;
    r.erro = String(e.message || e) + (e.line ? ' (linha ' + e.line + ')' : '');
  } finally {
    try { if (hald) { hald.close(SaveOptions.DONOTSAVECHANGES); } } catch (f1) {}
    try { if (dup) { dup.close(SaveOptions.DONOTSAVECHANGES); } } catch (f2) {}
    try { if (abriu && src) { src.close(SaveOptions.DONOTSAVECHANGES); } } catch (f3) {}
    try { app.preferences.rulerUnits = unAntes; } catch (f4) {}
    try { app.displayDialogs = dlgAntes; } catch (f5) {}
  }
  try { gravar(job.resultado, ser(r)); } catch (eW) {}
})();
