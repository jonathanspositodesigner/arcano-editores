/*
 * ══════════════════════════════════════════════════════════════════════════════
 *  ESPELHO DO PLUGIN NO NAVEGADOR — o Arcano Motion (o MESMO js/app.js do After)
 *  rodando dentro do editor de vídeo do Arcano Layers.
 * ══════════════════════════════════════════════════════════════════════════════
 *  O plugin foi feito para o CEP do After: usa Node (arquivos, programas, internet)
 *  e o ExtendScript do After. Este arquivo faz o papel dos dois no navegador:
 *    - Node      → Arcano Conector no PC (127.0.0.1), pela API SEGURA /plugin/*:
 *                  só pastas do Arcano, só programas da lista, nada de comando livre.
 *    - ExtendScript (cep.evalScript) → editor de vídeo (EffectCraft, script.run),
 *                  pela página de cima (postMessage para o montar.js).
 *  Carrega ANTES dos scripts do plugin (o index-web.html gerado pelo
 *  publicar-versao.sh lista os scripts em window.ARCANO_SCRIPTS e este arquivo
 *  carrega eles na ordem quando o conector responde).
 */
(function () {
  'use strict';

  var PORTAS = [47821, 47822, 47823, 47824, 47825];
  var BASE = null;          // http://127.0.0.1:porta
  var INFO = null;          // /plugin/info
  var EXT_DIR = (function () { var p = decodeURIComponent(location.pathname); return p.slice(0, p.lastIndexOf('/')); })(); // ex.: /plugin

  // ─────────────────────────── conector ───────────────────────────
  function sincrono(rota, corpo) {
    var x = new XMLHttpRequest();
    x.open('POST', BASE + rota, false);
    x.setRequestHeader('Content-Type', 'text/plain');
    x.send(JSON.stringify(corpo || {}));
    if (x.status !== 200) { throw erroNode({ message: 'Arcano Conector não respondeu (' + x.status + ')', code: 'ECONN' }); }
    var r = JSON.parse(x.responseText);
    if (!r.ok) { throw erroNode(r.e || {}); }
    return dec(r.v);
  }
  function assincrono(rota, corpo) {
    return fetch(BASE + rota, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(corpo || {}) })
      .then(function (r) { return r.json(); });
  }
  function erroNode(e) { var er = new Error(e.message || 'erro'); if (e.code) { er.code = e.code; } return er; }

  // Buffer, Date, Stats, Dirent de/para JSON
  function cod(v) {
    if (v === undefined) { return { __u: 1 }; }
    if (v === null || typeof v !== 'object') { return v; }
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) { return { __b: Buffer.from(v).toString('base64') }; }
    if (v instanceof Date) { return { __d: v.toISOString() }; }
    if (Array.isArray(v)) { return v.map(cod); }
    var o = {}; Object.keys(v).forEach(function (k) { if (typeof v[k] !== 'function') { o[k] = cod(v[k]); } }); return o;
  }
  function dec(v) {
    if (v === null || typeof v !== 'object') { return v; }
    if (Array.isArray(v)) { return v.map(dec); }
    if (v.__b !== undefined) { return Buffer.from(v.__b, 'base64'); }
    if (v.__u) { return undefined; }
    if (v.__d) { return new Date(v.__d); }
    if (v.__de) { return dirent(v.__de); }
    var o = {}; Object.keys(v).forEach(function (k) { o[k] = dec(v[k]); }); return o;
  }
  function dirent(d) { return { name: d.name, isFile: function () { return d.arquivo; }, isDirectory: function () { return d.pasta; }, isSymbolicLink: function () { return d.link; } }; }
  function stats(s) {
    return {
      size: s.size, mode: s.mode, mtimeMs: s.mtimeMs, ctimeMs: s.ctimeMs, atimeMs: s.atimeMs, birthtimeMs: s.birthtimeMs,
      mtime: new Date(s.mtimeMs), ctime: new Date(s.ctimeMs), atime: new Date(s.atimeMs), birthtime: new Date(s.birthtimeMs),
      isFile: function () { return s.arquivo; }, isDirectory: function () { return s.pasta; }, isSymbolicLink: function () { return s.link; }
    };
  }

  // ─────────────────────────── EventEmitter ───────────────────────────
  function Emissor() { this._ev = {}; }
  Emissor.prototype.on = function (n, f) { (this._ev[n] = this._ev[n] || []).push(f); return this; };
  Emissor.prototype.addListener = Emissor.prototype.on;
  Emissor.prototype.once = function (n, f) { var s = this; function g() { s.removeListener(n, g); f.apply(s, arguments); } return this.on(n, g); };
  Emissor.prototype.removeListener = function (n, f) { var l = this._ev[n]; if (l) { var i = l.indexOf(f); if (i >= 0) { l.splice(i, 1); } } return this; };
  Emissor.prototype.off = Emissor.prototype.removeListener;
  Emissor.prototype.removeAllListeners = function (n) { if (n) { delete this._ev[n]; } else { this._ev = {}; } return this; };
  Emissor.prototype.listenerCount = function (n) { return (this._ev[n] || []).length; };
  Emissor.prototype.emit = function (n) {
    var a = Array.prototype.slice.call(arguments, 1), l = (this._ev[n] || []).slice();
    if (n === 'error' && !l.length) { try { console.error('[Arcano] erro sem tratamento', a[0]); } catch (e) {} return false; }
    l.forEach(function (f) { try { f.apply(this, a); } catch (e) { setTimeout(function () { throw e; }); } }, this);
    return l.length > 0;
  };
  function herda(F) { F.prototype = Object.create(Emissor.prototype); F.prototype.constructor = F; }
  var depois = function (f) { setTimeout(f, 0); };

  // ─────────────────────────── path ───────────────────────────
  var path = {};
  ['join', 'resolve', 'dirname', 'basename', 'extname', 'normalize', 'relative', 'isAbsolute', 'parse', 'format'].forEach(function (f) {
    path[f] = function () { return sincrono('/plugin/path', { f: f, a: cod(Array.prototype.slice.call(arguments)) }); };
  });

  // ─────────────────────────── fs ───────────────────────────
  // Arquivos do próprio plugin (img, prompt, termos…) vêm do site; o resto, do conector.
  function daExtensao(p) {
    var s = String(p || '').replace(/\\/g, '/');
    if (s.indexOf(EXT_DIR + '/') === 0) { return s; }
    return null;
  }
  function lerDoSite(url, enc) {
    var x = new XMLHttpRequest();
    x.open('GET', url, false);
    x.overrideMimeType('text/plain; charset=x-user-defined');
    x.send();
    if (x.status !== 200) { var e = new Error("ENOENT: no such file or directory, open '" + url + "'"); e.code = 'ENOENT'; throw e; }
    var t = x.responseText, b = Buffer.alloc(t.length);
    for (var i = 0; i < t.length; i++) { b[i] = t.charCodeAt(i) & 0xff; }
    return enc ? b.toString(enc) : b;
  }
  function encDe(o) { return typeof o === 'string' ? o : (o && o.encoding) || null; }
  function fsCall(f, args) { return sincrono('/plugin/fs', { f: f, a: cod(args) }); }
  var fs = {
    readFileSync: function (p, o) { var u = daExtensao(p); if (u) { return lerDoSite(u, encDe(o)); } return fsCall('readFileSync', [p, o]); },
    writeFileSync: function (p, d, o) { fsCall('writeFileSync', [p, typeof d === 'string' ? d : Buffer.from(d), o]); },
    appendFileSync: function (p, d, o) { fsCall('appendFileSync', [p, typeof d === 'string' ? d : Buffer.from(d), o]); },
    existsSync: function (p) { var u = daExtensao(p); if (u) { try { lerDoSite(u); return true; } catch (e) { return false; } } return fsCall('existsSync', [p]); },
    statSync: function (p) {
      var u = daExtensao(p);
      if (u) { var b = lerDoSite(u), n = Date.now(); return stats({ size: b.length, mtimeMs: n, ctimeMs: n, atimeMs: n, birthtimeMs: n, arquivo: true, pasta: false, link: false }); }
      return stats(fsCall('statSync', [p]));
    },
    lstatSync: function (p) { return fs.statSync(p); },
    readdirSync: function (p, o) { return fsCall('readdirSync', [p, o]); },
    unlinkSync: function (p) { fsCall('unlinkSync', [p]); },
    rmdirSync: function (p, o) { fsCall('rmdirSync', [p, o]); },
    rmSync: function (p, o) { fsCall('rmSync', [p, o]); },
    mkdirSync: function (p, o) { fsCall('mkdirSync', [p, o]); },
    renameSync: function (a, b) { fsCall('renameSync', [a, b]); },
    copyFileSync: function (a, b) {
      var u = daExtensao(a);
      if (u) { fs.writeFileSync(b, lerDoSite(u)); return; }
      fsCall('copyFileSync', [a, b]);
    },
    utimesSync: function (p, a, m) { fsCall('utimesSync', [p, a, m]); },
    chmodSync: function (p) { fsCall('chmodSync', [p]); },
    // descritor falso: o conector lê o trecho pedido de uma vez
    openSync: function (p) { return { __fd: p }; },
    readSync: function (fd, buf, off, len, pos) {
      var b = fsCall('lerTrecho', [fd.__fd, pos || 0, len]);
      b.copy(buf, off || 0);
      return b.length;
    },
    closeSync: function () {},
    readFile: function (p, o, cb) { if (typeof o === 'function') { cb = o; o = null; } depois(function () { try { cb(null, fs.readFileSync(p, o)); } catch (e) { cb(e); } }); },
    writeFile: function (p, d, o, cb) { if (typeof o === 'function') { cb = o; o = null; } depois(function () { try { fs.writeFileSync(p, d, o); cb && cb(null); } catch (e) { cb && cb(e); } }); },
    unlink: function (p, cb) { depois(function () { try { fs.unlinkSync(p); cb && cb(null); } catch (e) { cb && cb(e); } }); },
    stat: function (p, cb) { depois(function () { try { cb(null, fs.statSync(p)); } catch (e) { cb(e); } }); },
    createWriteStream: function (p, o) { return new Gravador(p, o); },
    constants: { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 }
  };
  // Grava ao terminar (ou o conector grava direto, quando vem de um download: ver Resposta.pipe).
  function Gravador(p, o) {
    Emissor.call(this);
    this.path = p; this._caminho = p; this._partes = []; this._acrescentar = !!(o && /a/.test(o.flags || ''));
    this.writable = true; this.bytesWritten = 0;
    var s = this; depois(function () { s.emit('open'); s.emit('ready'); });
  }
  herda(Gravador);
  Gravador.prototype.write = function (c, enc, cb) {
    if (typeof enc === 'function') { cb = enc; enc = null; }
    var b = Buffer.isBuffer(c) ? c : Buffer.from(c, enc || 'utf8');
    this._partes.push(b); this.bytesWritten += b.length;
    if (cb) { depois(cb); }
    return true;
  };
  Gravador.prototype.end = function (c, enc, cb) {
    if (typeof c === 'function') { cb = c; c = null; }
    if (typeof enc === 'function') { cb = enc; enc = null; }
    if (c) { this.write(c, enc); }
    if (this._fim) { return; }
    this._fim = true;
    var s = this;
    try {
      var tudo = Buffer.concat(s._partes);
      if (s._acrescentar) { fs.appendFileSync(s._caminho, tudo); } else { fs.writeFileSync(s._caminho, tudo); }
      depois(function () { s.emit('finish'); s.emit('close'); if (cb) { cb(); } });
    } catch (e) { depois(function () { s.emit('error', e); }); }
  };
  Gravador.prototype.close = function (cb) { if (!this._fim) { this.end(); } if (cb) { depois(cb); } };
  Gravador.prototype.destroy = function () { this._fim = true; this._partes = []; };
  Gravador.prototype.cork = Gravador.prototype.uncork = function () {};

  // ─────────────────────────── os / process ───────────────────────────
  var os = {
    tmpdir: function () { return INFO.tmp; }, homedir: function () { return INFO.home; }, hostname: function () { return INFO.hostname; },
    platform: function () { return INFO.platform; }, arch: function () { return INFO.arch; }, type: function () { return INFO.platform === 'win32' ? 'Windows_NT' : 'Darwin'; },
    cpus: function () { var l = []; for (var i = 0; i < INFO.cpus; i++) { l.push({ model: '', speed: 0 }); } return l; },
    networkInterfaces: function () { return {}; }, totalmem: function () { return 8 * 1073741824; }, freemem: function () { return 4 * 1073741824; },
    EOL: '\n'
  };

  // ─────────────────────────── crypto ───────────────────────────
  function Resumo(alg, chave) { this._alg = alg; this._chave = chave; this._d = []; }
  Resumo.prototype.update = function (d, enc) { this._d.push(Buffer.isBuffer(d) ? d : Buffer.from(String(d), enc || 'utf8')); return this; };
  Resumo.prototype.digest = function (enc) {
    var r = sincrono('/plugin/hash', { alg: String(this._alg).toLowerCase(), hmac: !!this._chave, chave: this._chave ? cod(Buffer.from(this._chave)) : null, dados: cod(this._d), enc: enc || null });
    return r;
  };
  var crypto = {
    createHash: function (alg) { return new Resumo(alg); },
    createHmac: function (alg, chave) { return new Resumo(alg, chave); },
    randomBytes: function (n) { var b = Buffer.alloc(n); window.crypto.getRandomValues(b); return b; },
    randomUUID: function () { return window.crypto.randomUUID(); }
  };

  // ─────────────────────────── url ───────────────────────────
  var url = {
    parse: function (u) {
      var x; try { x = new URL(u); } catch (e) { return { href: u, path: u, pathname: u }; }
      var q = x.search ? x.search.slice(1) : null;
      return { protocol: x.protocol, slashes: true, auth: x.username ? x.username + (x.password ? ':' + x.password : '') : null, host: x.host, port: x.port || null,
        hostname: x.hostname, hash: x.hash || null, search: x.search || null, query: q, pathname: x.pathname, path: x.pathname + x.search, href: x.href };
    },
    resolve: function (de, para) { try { return new URL(para, de).href; } catch (e) { return para; } },
    format: function (o) { return typeof o === 'string' ? o : (o.href || ''); },
    URL: URL, URLSearchParams: URLSearchParams
  };

  // ─────────────────────────── zlib ───────────────────────────
  var zlib = {};
  ['inflateRawSync', 'inflateSync', 'gunzipSync', 'unzipSync', 'deflateRawSync', 'deflateSync', 'gzipSync'].forEach(function (f) {
    zlib[f] = function (b) { return sincrono('/plugin/zlib', { f: f, a: cod([Buffer.from(b)]) }); };
  });
  // Transformação simples: junta tudo e descompacta no fim
  function Transformador(f) { Emissor.call(this); this._f = f; this._p = []; this.writable = this.readable = true; }
  herda(Transformador);
  Transformador.prototype.write = function (c) { this._p.push(Buffer.from(c)); return true; };
  Transformador.prototype.end = function (c) {
    if (c) { this.write(c); }
    var s = this;
    depois(function () { try { var r = zlib[s._f](Buffer.concat(s._p)); s.emit('data', r); s.emit('end'); s.emit('finish'); s.emit('close'); } catch (e) { s.emit('error', e); } });
  };
  Transformador.prototype.pipe = function (d) { this.on('data', function (x) { d.write(x); }); this.on('end', function () { if (d.end) { d.end(); } }); return d; };
  Transformador.prototype.setEncoding = function () { return this; };
  zlib.createInflate = function () { return new Transformador('inflateSync'); };
  zlib.createInflateRaw = function () { return new Transformador('inflateRawSync'); };
  zlib.createGunzip = function () { return new Transformador('gunzipSync'); };
  zlib.createUnzip = function () { return new Transformador('unzipSync'); };

  // ─────────────────────────── dns ───────────────────────────
  var dns = {
    lookup: function (host, op, cb) {
      if (typeof op === 'function') { cb = op; op = {}; }
      assincrono('/plugin/dns', { host: host, opcoes: op && typeof op === 'object' ? { family: op.family } : {} })
        .then(function (r) { if (r.ok) { cb(null, r.v[0], r.v[1]); } else { cb(erroNode(r.e || {})); } }, function (e) { cb(e); });
    }
  };

  // ─────────────────────────── https / http (cliente) ───────────────────────────
  function Pedido(proto, op, cb) {
    Emissor.call(this);
    this._proto = proto; this._op = op; this._partes = []; this._limite = 0;
    if (cb) { this.on('response', cb); }
  }
  herda(Pedido);
  Pedido.prototype.write = function (c, enc) { this._partes.push(Buffer.isBuffer(c) ? c : Buffer.from(c, enc || 'utf8')); return true; };
  Pedido.prototype.setHeader = function (k, v) { this._op.headers = this._op.headers || {}; this._op.headers[k] = v; };
  Pedido.prototype.setTimeout = function (ms, cb) { this._limite = ms; if (cb) { this.on('timeout', cb); } return this; };
  Pedido.prototype.abort = Pedido.prototype.destroy = function (e) { this._abortado = true; this.destroyed = true; if (e) { var s = this; depois(function () { s.emit('error', e); }); } };
  Pedido.prototype.end = function (c, enc) {
    if (c && typeof c !== 'function') { this.write(c, enc); }
    var s = this, corpo = this._partes.length ? Buffer.concat(this._partes).toString('base64') : null;
    var op = { hostname: this._op.hostname || this._op.host, port: this._op.port, path: this._op.path, method: this._op.method || 'GET', headers: this._op.headers || {} };
    assincrono('/plugin/http', { proto: this._proto, opts: cod(op), corpo: corpo, limite: this._limite || 0 }).then(function (r) {
      if (s._abortado) { if (r && r.id) { assincrono('/plugin/http/corpo', { id: r.id, descartar: true }); } return; }
      if (!r || r.err) {
        var e = erroNode((r && r.err) || { message: 'falha de rede' });
        if (/tempo esgotado/.test(e.message)) { s.emit('timeout'); }
        s.emit('error', e); return;
      }
      var res = new Resposta(r);
      s.emit('response', res);
      res._decidir();
    }, function (e) { if (!s._abortado) { s.emit('error', e); } });
    return this;
  };
  // Resposta: o corpo fica no conector até o plugin dizer o que quer (ler, gravar em arquivo, descartar).
  function Resposta(r) {
    Emissor.call(this);
    this._id = r.id; this.statusCode = r.status; this.statusMessage = r.statusMessage || ''; this.headers = r.headers || {};
    this._enc = null; this._modo = null;
  }
  herda(Resposta);
  Resposta.prototype.setEncoding = function (e) { this._enc = e; return this; };
  Resposta.prototype.resume = function () { if (!this._modo && !this.listenerCount('data')) { this._modo = 'descartar'; } return this; };
  Resposta.prototype.pause = function () { return this; };
  Resposta.prototype.destroy = function () { this._modo = this._modo || 'descartar'; return this; };
  Resposta.prototype.pipe = function (d) { this._modo = 'pipe'; this._destino = d; return d; };
  Resposta.prototype._decidir = function () {
    var s = this;
    depois(function () {
      if (s._modo === 'pipe') {
        var d = s._destino;
        if (d instanceof Gravador && !d._partes.length) {
          d._fim = true;
          assincrono('/plugin/http/corpo', { id: s._id, caminho: d._caminho, acrescentar: d._acrescentar }).then(function (r) {
            if (r.err) { var e = erroNode(r.err); d.emit('error', e); s.emit('error', e); return; }
            d.bytesWritten = r.bytes;
            s.emit('data', Buffer.alloc(0));
            s.emit('end'); d.emit('finish'); d.emit('close'); s.emit('close');
          }, function (e) { d.emit('error', e); });
          return;
        }
        s.on('data', function (x) { d.write(x); });
        s.on('end', function () { if (d.end) { d.end(); } });
        s._modo = 'ler';
      }
      if (s._modo === 'descartar') { assincrono('/plugin/http/corpo', { id: s._id, descartar: true }); depois(function () { s.emit('end'); s.emit('close'); }); return; }
      if (!s._modo && !s.listenerCount('data') && !s.listenerCount('end')) { s._decidir(); return; } // ainda decidindo
      assincrono('/plugin/http/corpo', { id: s._id }).then(function (r) {
        if (r.err) { s.emit('error', erroNode(r.err)); return; }
        var b = Buffer.from(r.corpo || '', 'base64');
        if (b.length) { s.emit('data', s._enc ? b.toString(s._enc) : b); }
        s.emit('end'); s.emit('close');
      }, function (e) { s.emit('error', e); });
    });
  };
  function clienteHttp(proto) {
    function pedido(a, b, c) {
      var op = {}, cb = null;
      if (typeof a === 'string' || a instanceof URL) { var u = new URL(String(a)); op = { hostname: u.hostname, port: u.port, path: u.pathname + u.search }; if (typeof b === 'object' && b) { Object.keys(b).forEach(function (k) { op[k] = b[k]; }); cb = c; } else { cb = b; } }
      else { op = a || {}; cb = b; }
      return new Pedido(op.protocol || proto, op, cb);
    }
    return {
      request: pedido,
      get: function (a, b, c) { var r = pedido(a, b, c); r.end(); return r; },
      Agent: function () {}, globalAgent: {},
      createServer: function (h) { return new ServidorRemoto(h); }
    };
  }
  // Servidor HTTP do plugin (o MCP do Claude): vem na próxima etapa, pelo conector.
  function ServidorRemoto(h) { Emissor.call(this); this._h = h; }
  herda(ServidorRemoto);
  ServidorRemoto.prototype.listen = function () { var s = this; depois(function () { s.emit('error', new Error('O chat ainda não está ligado nesta versão do navegador.')); }); return this; };
  ServidorRemoto.prototype.close = function (cb) { if (cb) { depois(cb); } };
  ServidorRemoto.prototype.address = function () { return { port: 0 }; };

  // ─────────────────────────── child_process ───────────────────────────
  // Só o que tem operação segura no conector. O resto responde "não disponível" (na próxima etapa vem pela lista de programas).
  function naoDisponivel(oQue) { var e = new Error('Ainda não disponível no navegador: ' + oQue); e.code = 'ENOSYS'; return e; }
  function Filho() { Emissor.call(this); this.stdout = new Emissor(); this.stderr = new Emissor(); this.stdin = { write: function () { return true; }, end: function () {}, on: function () {} }; this.pid = 0;
    this.stdout.setEncoding = this.stderr.setEncoding = function () {}; }
  herda(Filho);
  Filho.prototype.kill = function () { return true; };
  Filho.prototype.unref = function () {};
  function exec(cmd, op, cb) {
    if (typeof op === 'function') { cb = op; op = {}; }
    var f = new Filho(), c = String(cmd);
    var fim = function (e, so) { if (cb) { cb(e, so || '', ''); } f.emit('exit', e ? 1 : 0); f.emit('close', e ? 1 : 0); };
    depois(function () {
      if (/MachineGuid|IOPlatformExpertDevice/.test(c)) {
        try { var id = sincrono('/plugin/maquina', {}); fim(null, id ? (INFO.platform === 'win32' ? '    MachineGuid    REG_SZ    ' + id : '"IOPlatformUUID" = "' + id + '"') : ''); } catch (e) { fim(e); }
        return;
      }
      if (/Get-Clipboard|^pbpaste/.test(c)) {
        if (navigator.clipboard && navigator.clipboard.readText) { navigator.clipboard.readText().then(function (t) { fim(null, t); }, function (e) { fim(e); }); } else { fim(naoDisponivel('área de transferência')); }
        return;
      }
      var mUrl = /^start "" "?(https?:[^"]+)"?$/.exec(c);
      if (mUrl) { window.open(mUrl[1], '_blank', 'noopener'); fim(null, ''); return; }
      var mSel = /^explorer(?: \/select,)? ?"?([^"]+)"?$/.exec(c) || /^open -R "([^"]+)"$/.exec(c);
      if (mSel) { try { sincrono('/plugin/mostrar', { caminho: mSel[1] }); fim(null, ''); } catch (e) { fim(e); } return; }
      fim(naoDisponivel(c.split(' ')[0]));
    });
    return f;
  }
  function execFile(arq, args, op, cb) {
    if (typeof args === 'function') { cb = args; args = []; op = {}; }
    if (typeof op === 'function') { cb = op; op = {}; }
    var f = new Filho();
    depois(function () {
      if (arq === 'open' && args && /^https?:/.test(args[0])) { window.open(args[0], '_blank', 'noopener'); if (cb) { cb(null, '', ''); } return; }
      if (arq === 'open' && args && args[0] === '-R') { try { sincrono('/plugin/mostrar', { caminho: args[1] }); if (cb) { cb(null, '', ''); } } catch (e) { if (cb) { cb(e, '', ''); } } return; }
      if (arq === 'open' && args && args[0]) { try { sincrono('/plugin/mostrar', { caminho: args[0] }); if (cb) { cb(null, '', ''); } } catch (e) { if (cb) { cb(e, '', ''); } } return; }
      var e = naoDisponivel(String(arq).split(/[\\/]/).pop()); if (cb) { cb(e, '', ''); } f.emit('error', e); f.emit('close', 1);
    });
    return f;
  }
  function spawn(exe) {
    var f = new Filho(), e = naoDisponivel(String(exe).split(/[\\/]/).pop());
    depois(function () { f.emit('error', e); f.emit('close', 1); f.emit('exit', 1); });
    return f;
  }
  var child_process = { exec: exec, execFile: execFile, spawn: spawn };

  // ─────────────────────────── require ───────────────────────────
  var modulos = null;
  function requerer(nome) {
    nome = String(nome).replace(/^node:/, '');
    if (nome === 'buffer') { return { Buffer: Buffer }; }
    if (nome === 'events') { var E = Emissor; E.EventEmitter = Emissor; return E; }
    if (nome === 'tls') { return { connect: function () { throw naoDisponivel('proxy com túnel'); } }; }
    if (modulos[nome]) { return modulos[nome]; }
    throw new Error("Cannot find module '" + nome + "'");
  }

  // ─────────────────────────── CEP (o After) ───────────────────────────
  var jsxFonte = null, jsxCarregado = false, pedidos = {}, seq = 0;
  window.addEventListener('message', function (ev) {
    if (ev.source !== window.parent) { return; }
    var d = ev.data || {};
    if (d.arcano === 'eval-resposta' && pedidos[d.id]) { var cb = pedidos[d.id]; delete pedidos[d.id]; cb(d); }
  });
  function noEditor(codigo, cb) {
    var id = 'e' + (++seq);
    pedidos[id] = cb;
    window.parent.postMessage({ arcano: 'eval', id: id, codigo: codigo }, '*');
  }
  // O plugin carrega a biblioteca com $.evalFile(new File("…/jsx/arcano.jsx")): aqui o arquivo vem do site.
  var RE_EVALFILE = /\$\.evalFile\(new File\(("(?:[^"\\]|\\.)*")\)\);?/;
  function evalScript(codigo, cb) {
    cb = cb || function () {};
    var m = RE_EVALFILE.exec(codigo), passos = [];
    if (m) {
      var arq = JSON.parse(m[1]);
      if (/arcano(-ps)?\.jsx$/i.test(arq)) {
        if (!jsxCarregado) {
          try { jsxFonte = jsxFonte || lerDoSite(EXT_DIR + '/jsx/' + arq.split(/[\\/]/).pop(), 'utf8'); } catch (e) { cb('EvalScript error.'); return; }
          passos.push('var __arcanoJsx = ' + JSON.stringify(jsxFonte) + ';');
        }
        codigo = codigo.replace(RE_EVALFILE, '(0, eval)(__arcanoJsx);');
      }
    }
    var rodar = function () {
      noEditor(codigo, function (r) {
        if (!r.ok) { cb('EvalScript error.'); try { console.warn('[Arcano] script do editor:', r.erro); } catch (e) {} return; }
        cb(r.resultado == null ? '' : String(r.resultado));
      });
    };
    if (passos.length) { noEditor(passos.join('\n'), function (r) { if (r.ok) { jsxCarregado = true; } rodar(); }); } else { rodar(); }
  }
  var cepFalso = {
    evalScript: evalScript,
    getHostEnvironment: function () { return JSON.stringify({ appName: 'AEFT', appVersion: '26.0', appLocale: 'pt_BR', appUILocale: 'pt_BR', appId: 'AEFT', isAppOnline: true, appSkinInfo: { panelBackgroundColor: { color: { red: 35, green: 35, blue: 35 } } } }); },
    getCurrentApiVersion: function () { return JSON.stringify({ major: 12, minor: 0, micro: 0 }); },
    getExtensionId: function () { return 'com.arcano.motion.panel'; },
    getSystemPath: function () { return EXT_DIR; },
    dispatchEvent: function () {}, addEventListener: function () {}, removeEventListener: function () {},
    requestOpenExtension: function () {}, closeExtension: function () {}, invokeSync: function () { return ''; }, invokeAsync: function () {}
  };
  var cepUtil = {
    fs: {
      showOpenDialog: function (multi, pastas, titulo, inicial, tipos) { try { return sincrono('/plugin/janela', { a: [!!multi, !!pastas, titulo || '', inicial || '', tipos || []] }); } catch (e) { return { err: 1, data: [] }; } },
      showOpenDialogEx: function (multi, pastas, titulo, inicial, tipos) { return cepUtil.fs.showOpenDialog(multi, pastas, titulo, inicial, tipos); }
    },
    util: { openURLInDefaultBrowser: function (u) { window.open(u, '_blank', 'noopener'); } }
  };

  // ─────────────────────────── início ───────────────────────────
  function acharConector() {
    var tentativas = PORTAS.map(function (p) {
      var u = 'http://127.0.0.1:' + p;
      return fetch(u + '/status', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.app === 'arcano-conector') { return { url: u, status: j }; } throw new Error('outro programa');
      });
    });
    return new Promise(function (ok) {
      var falta = tentativas.length, achou = false;
      tentativas.forEach(function (t) { t.then(function (r) { if (!achou) { achou = true; ok(r); } }, function () { if (!--falta && !achou) { ok(null); } }); });
    });
  }
  function telaSemConector() {
    // O passo a passo de instalar o conector e liberar o Chrome (o mesmo do painel provisório).
    var f = document.getElementById('arcano-sem-conector');
    if (f) { return; }
    f = document.createElement('iframe');
    f.id = 'arcano-sem-conector';
    f.src = '/painel/index.html#so-conector';
    f.setAttribute('allow', 'local-network-access; clipboard-read; clipboard-write');
    f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:99999;background:#141416';
    document.body.appendChild(f);
  }
  function carregarScripts(lista, i) {
    if (i >= lista.length) { return; }
    var s = document.createElement('script');
    s.src = lista[i];
    s.onload = s.onerror = function () { carregarScripts(lista, i + 1); };
    document.body.appendChild(s);
  }
  function iniciar() {
    acharConector().then(function (r) {
      if (!r || !/^0\.[2-9]|^[1-9]/.test(String(r.status.versao || ''))) {
        // sem conector, ou conector antigo (sem a API do plugin): ensina a instalar/atualizar
        telaSemConector();
        setTimeout(iniciar, 4000);
        return;
      }
      var tela = document.getElementById('arcano-sem-conector');
      if (tela) { tela.parentNode.removeChild(tela); }
      BASE = r.url;
      try { INFO = sincrono('/plugin/info', {}); } catch (e) { telaSemConector(); setTimeout(iniciar, 4000); return; }
      modulos = { fs: fs, path: path, os: os, crypto: crypto, url: url, zlib: zlib, dns: dns, https: clienteHttp('https:'), http: clienteHttp('http:'), child_process: child_process };
      var processo = {
        platform: INFO.platform, arch: INFO.arch, env: INFO.env, version: INFO.version, versions: INFO.versions, pid: 1, execPath: '',
        cwd: function () { return INFO.home; }, nextTick: function (f) { var a = Array.prototype.slice.call(arguments, 1); depois(function () { f.apply(null, a); }); },
        on: function () {}, once: function () {}, emit: function () {}, hrtime: function () { var t = performance.now(); return [Math.floor(t / 1000), Math.floor((t % 1000) * 1e6)]; }
      };
      window.cep_node = { require: requerer, process: processo, Buffer: Buffer, global: window };
      window.__adobe_cep__ = cepFalso;
      window.cep = cepUtil;
      window.ARCANO_NAVEGADOR = true;
      carregarScripts(window.ARCANO_SCRIPTS || [], 0);
    });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', iniciar); } else { iniciar(); }
})();
