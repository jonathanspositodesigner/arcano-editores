/* Arcano Motion — Ajustes de cor do Photoshop → LUT para o After.
   Método HALD (o mesmo dos geradores de LUT por imagem): uma imagem neutra 512x512 em que cada pixel
   é uma cor diferente (64 níveis de vermelho, verde e azul) recebe, DENTRO do Photoshop, todos os
   ajustes de cor do PSD (jsx/lut-photoshop.jsx). O pixel de volta diz para onde cada cor foi:
   lido em ordem, vira o .cube (vermelho varia mais rápido, LUT_3D_SIZE 64).
   Aqui: gerar a imagem neutra (PNG 16 bits), ler o PNG que o Photoshop devolve, montar e escrever o LUT.
   ES5 de propósito (painel do After). Sem dependência: Buffer e zlib do Node. */
(function () {
  'use strict';
  function req(n) { try { var r = (typeof cep_node !== 'undefined' && cep_node.require) ? cep_node.require : require; return r(n); } catch (e) { return null; } }
  var Buffer = (req('buffer') || {}).Buffer, zlib = req('zlib');

  var PASSOS = 8;                       // 8 -> imagem 512x512 (8³), LUT 64 (8²)
  var LADO = PASSOS * PASSOS * PASSOS;  // 512
  var N = PASSOS * PASSOS;              // 64

  // ---------------------------------------------------------------- PNG
  var TAB_CRC = (function () {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); } t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) {
    var c = 0xFFFFFFFF, i;
    for (i = 0; i < buf.length; i++) { c = TAB_CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function bloco(tipo, dados) {
    var cab = Buffer.alloc(8), fim = Buffer.alloc(4), corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados]);
    cab.writeUInt32BE(dados.length, 0); cab.write(tipo, 4, 'latin1');
    fim.writeUInt32BE(crc32(corpo), 0);
    return Buffer.concat([cab, dados, fim]);
  }

  // Imagem neutra (HALD nível 8) em PNG RGB 16 bits. Pixel i (linha a linha): r = i % 64, g = (i/64) % 64, b = i/4096
  function gerarHaldPNG() {
    var linha = 1 + LADO * 6, cru = Buffer.alloc(linha * LADO), y, x, i, p, v;
    for (y = 0; y < LADO; y++) {
      p = y * linha; cru[p++] = 0;
      for (x = 0; x < LADO; x++) {
        i = y * LADO + x;
        v = Math.round((i % N) * 65535 / (N - 1)); cru.writeUInt16BE(v, p); p += 2;
        v = Math.round((Math.floor(i / N) % N) * 65535 / (N - 1)); cru.writeUInt16BE(v, p); p += 2;
        v = Math.round(Math.floor(i / (N * N)) * 65535 / (N - 1)); cru.writeUInt16BE(v, p); p += 2;
      }
    }
    var ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(LADO, 0); ihdr.writeUInt32BE(LADO, 4);
    ihdr[8] = 16; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', zlib.deflateSync(cru)), bloco('IEND', Buffer.alloc(0))]);
  }

  // Lê PNG (8 ou 16 bits; cinza, RGB ou RGBA; sem entrelaçamento). Devolve pixels já sem filtro.
  function lerPNG(buf) {
    if (!buf || buf.length < 33 || buf.readUInt32BE(0) !== 0x89504E47) { throw new Error('O arquivo devolvido pelo Photoshop não é PNG.'); }
    var p = 8, w = 0, h = 0, prof = 0, tipo = 0, entrel = 0, partes = [];
    while (p + 8 <= buf.length) {
      var tam = buf.readUInt32BE(p), t = buf.toString('latin1', p + 4, p + 8), d = buf.slice(p + 8, p + 8 + tam);
      if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); prof = d[8]; tipo = d[9]; entrel = d[12]; }
      else if (t === 'IDAT') { partes.push(d); }
      else if (t === 'IEND') { break; }
      p += 12 + tam;
    }
    var canais = { 0: 1, 2: 3, 4: 2, 6: 4 }[tipo];
    if (!canais) { throw new Error('PNG com paleta de cores não é suportado.'); }
    if (prof !== 8 && prof !== 16) { throw new Error('PNG com ' + prof + ' bits não é suportado.'); }
    if (entrel) { throw new Error('PNG entrelaçado não é suportado.'); }
    var bpp = canais * prof / 8, linha = w * bpp, cru = zlib.inflateSync(Buffer.concat(partes)), dados = Buffer.alloc(linha * h);
    var y, x, f, a, b, c, pa, pb, pc, de, para, ant;
    for (y = 0; y < h; y++) {
      f = cru[y * (linha + 1)]; de = y * (linha + 1) + 1; para = y * linha; ant = para - linha;
      for (x = 0; x < linha; x++) {
        a = x >= bpp ? dados[para + x - bpp] : 0;
        b = y ? dados[ant + x] : 0;
        c = (x >= bpp && y) ? dados[ant + x - bpp] : 0;
        var v = cru[de + x];
        if (f === 1) { v += a; } else if (f === 2) { v += b; } else if (f === 3) { v += (a + b) >> 1; }
        else if (f === 4) { pa = Math.abs(b - c); pb = Math.abs(a - c); pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
        dados[para + x] = v & 0xFF;
      }
    }
    return { largura: w, altura: h, bits: prof, canais: canais, dados: dados };
  }

  // PNG da imagem neutra já com os ajustes -> LUT 3D (tabela no padrão do .cube: vermelho mais rápido)
  function haldParaLUT(png) {
    var w = png.largura, passos = Math.round(Math.pow(w, 1 / 3));
    if (w !== png.altura || passos * passos * passos !== w) { throw new Error('Imagem neutra com tamanho errado (' + w + 'x' + png.altura + ').'); }
    var n = passos * passos, total = w * w, t = new Float32Array(total * 3), d = png.dados;
    var bytes = png.bits / 8, passo = png.canais * bytes, max = png.bits === 16 ? 65535 : 255, cinza = png.canais < 3, i, o, k;
    for (i = 0; i < total; i++) {
      o = i * passo;
      for (k = 0; k < 3; k++) {
        var off = o + (cinza ? 0 : k * bytes);
        t[i * 3 + k] = (bytes === 2 ? d.readUInt16BE(off) : d[off]) / max;
      }
    }
    return { N: n, tabela: t, min: [0, 0, 0], max: [1, 1, 1], bits: png.bits };
  }

  // ---------------------------------------------------------------- .cube
  function lerCube(txt) {
    var linhas = String(txt).split(/\r?\n/), n = 0, min = [0, 0, 0], max = [1, 1, 1], v = [];
    for (var i = 0; i < linhas.length; i++) {
      var l = linhas[i].replace(/#.*/, '').replace(/^\s+|\s+$/g, '');
      if (!l) { continue; }
      var m;
      if ((m = /^LUT_3D_SIZE\s+(\d+)/i.exec(l))) { n = +m[1]; continue; }
      if ((m = /^DOMAIN_MIN\s+(\S+)\s+(\S+)\s+(\S+)/i.exec(l))) { min = [+m[1], +m[2], +m[3]]; continue; }
      if ((m = /^DOMAIN_MAX\s+(\S+)\s+(\S+)\s+(\S+)/i.exec(l))) { max = [+m[1], +m[2], +m[3]]; continue; }
      if (/^LUT_1D_SIZE/i.test(l)) { throw new Error('LUT 1D (só 3D é suportado).'); }
      if (/^[A-Za-z_]/.test(l)) { continue; }
      var p = l.split(/\s+/);
      if (p.length >= 3) { v.push(+p[0], +p[1], +p[2]); }
    }
    if (!n || v.length < n * n * n * 3) { throw new Error('Arquivo .cube incompleto.'); }
    var t = new Float32Array(n * n * n * 3);
    for (var k = 0; k < t.length; k++) { t[k] = v[k]; }
    return { N: n, tabela: t, min: min, max: max };
  }
  function lerLUT(dados) { return lerCube(Buffer.isBuffer(dados) ? dados.toString('latin1') : String(dados)); }

  function paraCube(lut, titulo) {
    var partes = ['TITLE "' + String(titulo || 'Arcano Motion').replace(/"/g, '') + '"', '# Gerado pelo Arcano Motion: ajustes de cor do Photoshop', 'LUT_3D_SIZE ' + lut.N, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0', ''];
    var t = lut.tabela, linhas = new Array(t.length / 3), k, j = 0;
    for (k = 0; k < t.length; k += 3) { linhas[j++] = t[k].toFixed(6) + ' ' + t[k + 1].toFixed(6) + ' ' + t[k + 2].toFixed(6); }
    return partes.join('\n') + linhas.join('\n') + '\n';
  }

  // Interpolação tetraédrica (usada para conferir no After se o LUT foi aplicado)
  function aplicar(lut, r, g, b, saida) {
    var n = lut.N, t = lut.tabela, M = n - 1;
    var x = (r - lut.min[0]) / (lut.max[0] - lut.min[0]) * M, y = (g - lut.min[1]) / (lut.max[1] - lut.min[1]) * M, z = (b - lut.min[2]) / (lut.max[2] - lut.min[2]) * M;
    x = x < 0 ? 0 : (x > M ? M : x); y = y < 0 ? 0 : (y > M ? M : y); z = z < 0 ? 0 : (z > M ? M : z);
    var x0 = Math.min(Math.floor(x), M - 1), y0 = Math.min(Math.floor(y), M - 1), z0 = Math.min(Math.floor(z), M - 1);
    var fx = x - x0, fy = y - y0, fz = z - z0;
    function id(i, j, k) { return ((k * n + j) * n + i) * 3; }
    var c000 = id(x0, y0, z0), c111 = id(x0 + 1, y0 + 1, z0 + 1), a, w0, w1, w2, w3, p1, p2;
    if (fx > fy) {
      if (fy > fz) { p1 = id(x0 + 1, y0, z0); p2 = id(x0 + 1, y0 + 1, z0); w0 = 1 - fx; w1 = fx - fy; w2 = fy - fz; w3 = fz; }
      else if (fx > fz) { p1 = id(x0 + 1, y0, z0); p2 = id(x0 + 1, y0, z0 + 1); w0 = 1 - fx; w1 = fx - fz; w2 = fz - fy; w3 = fy; }
      else { p1 = id(x0, y0, z0 + 1); p2 = id(x0 + 1, y0, z0 + 1); w0 = 1 - fz; w1 = fz - fx; w2 = fx - fy; w3 = fy; }
    } else {
      if (fz > fy) { p1 = id(x0, y0, z0 + 1); p2 = id(x0, y0 + 1, z0 + 1); w0 = 1 - fz; w1 = fz - fy; w2 = fy - fx; w3 = fx; }
      else if (fz > fx) { p1 = id(x0, y0 + 1, z0); p2 = id(x0, y0 + 1, z0 + 1); w0 = 1 - fy; w1 = fy - fz; w2 = fz - fx; w3 = fx; }
      else { p1 = id(x0, y0 + 1, z0); p2 = id(x0 + 1, y0 + 1, z0); w0 = 1 - fy; w1 = fy - fx; w2 = fx - fz; w3 = fz; }
    }
    for (a = 0; a < 3; a++) { saida[a] = w0 * t[c000 + a] + w1 * t[p1 + a] + w2 * t[p2 + a] + w3 * t[c111 + a]; }
    return saida;
  }

  // ---------------------------------------------------------------- Photoshop
  // Acha o Photoshop instalado (para abrir direto, se o BridgeTalk do After não responder)
  function acharPhotoshop() {
    var fs = req('fs'), path = req('path'), proc = (typeof cep_node !== 'undefined' && cep_node.process) ? cep_node.process : (typeof process !== 'undefined' ? process : null);
    var plat = proc ? proc.platform : '', bases, achados = [];
    function ano(n) { var m = /(\d{4})/.exec(n); return m ? +m[1] : 0; }
    if (plat === 'win32') {
      bases = [path.join(proc.env.ProgramFiles || 'C:\\Program Files', 'Adobe'), 'C:\\Program Files\\Adobe'];
      bases.forEach(function (b) {
        try { fs.readdirSync(b).forEach(function (d) { var exe = path.join(b, d, 'Photoshop.exe'); if (/photoshop/i.test(d) && fs.existsSync(exe)) { achados.push({ caminho: exe, ano: ano(d) }); } }); } catch (e) {}
      });
    } else if (plat === 'darwin') {
      try { fs.readdirSync('/Applications').forEach(function (d) { var app = path.join('/Applications', d, d + '.app'); if (/^Adobe Photoshop/i.test(d) && fs.existsSync(app)) { achados.push({ caminho: app, ano: ano(d) }); } }); } catch (e2) {}
    }
    achados.sort(function (a, b) { return b.ano - a.ano; });
    return achados.length ? achados[0].caminho : null;
  }

  window.ArcanoLUT = { PASSOS: PASSOS, N: N, gerarHaldPNG: gerarHaldPNG, lerPNG: lerPNG, haldParaLUT: haldParaLUT, lerLUT: lerLUT, lerCube: lerCube, paraCube: paraCube, aplicar: aplicar, acharPhotoshop: acharPhotoshop };
})();
