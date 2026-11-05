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
  // ─────────────────────────── eventos do conector (programas, servidor) ───────────────────────────
  var SID = 's' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  var ouvintes = {}, escutando = false;
  function escutarEventos() {
    if (escutando) { return; }
    escutando = true;
    (function ciclo() {
      assincrono('/plugin/eventos', { sid: SID }).then(function (r) {
        ((r && r.eventos) || []).forEach(function (ev) { var f = ouvintes[ev.id]; if (f) { try { f(ev); } catch (e) { console.error('[Arcano] evento', e); } } });
        ciclo();
      }, function () { setTimeout(ciclo, 1500); });
    })();
  }
  function op(rota, corpo) { corpo = corpo || {}; corpo.sid = SID; return assincrono(rota, corpo).then(function (r) { if (!r.ok) { throw erroNode(r.e || {}); } return dec(r.v); }); }

  // ─────────────────────────── servidor HTTP do plugin (o MCP do Claude/Codex) ───────────────────────────
  // O conector escuta no PC (127.0.0.1) e repassa cada pedido para cá; a resposta volta pelo conector.
  function ServidorRemoto(h) { Emissor.call(this); if (h) { this.on('request', h); } this._porta = 0; this._id = null; }
  herda(ServidorRemoto);
  ServidorRemoto.prototype.listen = function () {
    var s = this, cb = null;
    for (var i = 0; i < arguments.length; i++) { if (typeof arguments[i] === 'function') { cb = arguments[i]; } }
    if (cb) { this.once('listening', cb); }
    escutarEventos();
    op('/plugin/servidor', {}).then(function (r) {
      if (r.err) { s.emit('error', erroNode(r.err)); return; }
      s._id = r.id; s._porta = r.porta;
      ouvintes[r.id] = function (ev) { if (ev.t === 'req') { s._pedido(ev); } };
      s.listening = true;
      s.emit('listening');
    }, function (e) { s.emit('error', e); });
    return this;
  };
  ServidorRemoto.prototype._pedido = function (ev) {
    var req = new Emissor(), res = new Emissor(), partes = [], status = 200, cab = {};
    req.method = ev.method; req.url = ev.url; req.headers = ev.headers || {}; req._enc = null;
    req.setEncoding = function (e) { req._enc = e; return req; };
    req.socket = { remoteAddress: '127.0.0.1' };
    res.headersSent = false; res.statusCode = 200;
    res.setHeader = function (k, v) { cab[String(k).toLowerCase()] = v; };
    res.getHeader = function (k) { return cab[String(k).toLowerCase()]; };
    res.writeHead = function (st, a, b) { status = st; res.statusCode = st; var h = typeof a === 'object' ? a : b; if (h) { Object.keys(h).forEach(function (k) { cab[k] = h[k]; }); } res.headersSent = true; return res; };
    res.write = function (c, enc) { partes.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c), enc || 'utf8')); return true; };
    res.end = function (c, enc) {
      if (c && typeof c !== 'function') { res.write(c, enc); }
      if (res._fim) { return; } res._fim = true;
      op('/plugin/servidor/resposta', { rid: ev.rid, status: status, headers: cab, corpo: partes.length ? Buffer.concat(partes).toString('base64') : null }).catch(function () {});
      res.emit('finish');
    };
    this.emit('request', req, res);
    depois(function () {
      var b = Buffer.from(ev.corpo || '', 'base64');
      if (b.length) { req.emit('data', req._enc ? b.toString(req._enc) : b); }
      req.emit('end');
    });
  };
  ServidorRemoto.prototype.close = function (cb) { if (this._id) { op('/plugin/servidor/fechar', { id: this._id }).catch(function () {}); delete ouvintes[this._id]; } this.listening = false; if (cb) { depois(cb); } return this; };
  ServidorRemoto.prototype.address = function () { return { port: this._porta, address: '127.0.0.1', family: 'IPv4' }; };
  ServidorRemoto.prototype.unref = ServidorRemoto.prototype.ref = function () { return this; };

  // ─────────────────────────── child_process ───────────────────────────
  // Os programas da LISTA rodam no conector (ele confere programa e argumentos). Comandos de sistema que o plugin usa
  // viram operações fixas do conector (procurar o Claude, abrir janela de instalação/login, gravar o microfone, descompactar…).
  function naoDisponivel(oQue) { var e = new Error('Não disponível no navegador: ' + oQue); e.code = 'ENOSYS'; return e; }
  function Fluxo() { Emissor.call(this); this._enc = null; }
  herda(Fluxo);
  Fluxo.prototype.setEncoding = function (e) { this._enc = e; return this; };
  Fluxo.prototype.pipe = function (d) { this.on('data', function (x) { d.write(x); }); return d; };
  Fluxo.prototype.resume = Fluxo.prototype.pause = function () { return this; };
  Fluxo.prototype._dado = function (b) { this.emit('data', this._enc ? b.toString(this._enc) : b); };
  function Filho() {
    Emissor.call(this);
    var s = this;
    this.stdout = new Fluxo(); this.stderr = new Fluxo(); this.pid = 0; this.killed = false; this.exitCode = null; this._id = null; this._fila = [];
    this.stdin = {
      writable: true,
      write: function (d, enc) { s._stdin({ d: (Buffer.isBuffer(d) ? d : Buffer.from(String(d), enc || 'utf8')).toString('base64') }); return true; },
      end: function (d, enc) { if (d) { this.write(d, enc); } s._stdin({ fim: true }); },
      on: function () { return this; }, once: function () { return this; }, setEncoding: function () {}
    };
  }
  herda(Filho);
  Filho.prototype._stdin = function (o) { if (!this._id) { this._fila.push(o); return; } o.id = this._id; op('/plugin/proc/stdin', o).catch(function () {}); };
  Filho.prototype.kill = function (sinal) { this.killed = true; if (this._id) { op('/plugin/proc/matar', { id: this._id, sinal: sinal || null }).catch(function () {}); } else { this._matarAoIniciar = true; } return true; };
  Filho.prototype.unref = Filho.prototype.ref = function () { return this; };
  Filho.prototype._ligar = function (r) {
    var s = this;
    s._id = r.id; s.pid = r.pid || 0;
    ouvintes[r.id] = function (ev) {
      if (ev.t === 'stdout') { s.stdout._dado(Buffer.from(ev.d, 'base64')); }
      else if (ev.t === 'stderr') { s.stderr._dado(Buffer.from(ev.d, 'base64')); }
      else if (ev.t === 'error') { s.emit('error', erroNode(ev.e || {})); }
      else if (ev.t === 'exit') { s.exitCode = ev.code; s.emit('exit', ev.code, ev.sinal || null); }
      else if (ev.t === 'close') { s.stdout.emit('end'); s.stderr.emit('end'); s.emit('close', ev.code, ev.sinal || null); delete ouvintes[r.id]; }
    };
    s._fila.forEach(function (o) { s._stdin(o); }); s._fila = [];
    if (s._matarAoIniciar) { s.kill(); }
    s.emit('spawn');
  };
  function falhar(f, e) { depois(function () { f.emit('error', e); f.emit('close', -1, null); }); return f; }
  function remoto(rota, corpo) {
    var f = new Filho();
    escutarEventos();
    op(rota, corpo).then(function (r) { f._ligar(r); }, function (e) { falhar(f, e); });
    return f;
  }
  // "aspas" do plugin: "C:\a b\claude.cmd" "-p" "--x" → ['C:\a b\claude.cmd', '-p', '--x']
  function separarAspas(t) { var l = [], re = /"((?:[^"\\]|\\.)*)"|(\S+)/g, m; while ((m = re.exec(t))) { l.push(m[1] !== undefined ? m[1].replace(/\\"/g, '"') : m[2]); } return l; }
  function soVars(env) { var o = {}; if (env) { Object.keys(env).forEach(function (k) { if (/^(ARCANO_[A-Z_]+|DYLD_LIBRARY_PATH)$/.test(k)) { o[k] = String(env[k]); } }); } return o; }
  function ehCurl(exe) { return /(^|[\\/])curl(\.exe)?$/i.test(String(exe)); }

  // curl (o plugin usa como reserva de rede e para baixar): vira pedido HTTP pelo conector
  function curl(args) {
    var f = new Filho(), url = null, metodo = 'GET', cab = {}, saidaArq = null, formato = '', dadosStdin = false, partes = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a === '-X') { metodo = args[++i]; } else if (a === '-H') { var h = args[++i], k = h.indexOf(':'); cab[h.slice(0, k).trim()] = h.slice(k + 1).trim(); }
      else if (a === '-o') { saidaArq = args[++i]; } else if (a === '-w') { formato = args[++i]; } else if (a === '--data-binary') { dadosStdin = args[++i] === '@-'; }
      else if (a === '--max-time' || a === '--proxy' || a === '--resolve') { i++; } else if (/^https?:/.test(a)) { url = a; }
    }
    f.stdin = { write: function (d) { partes.push(Buffer.from(d)); return true; }, end: function (d) { if (d) { partes.push(Buffer.from(d)); } enviar(); }, on: function () { return this; } };
    var enviado = false;
    function enviar() {
      if (enviado) { return; } enviado = true;
      var u = new URL(url), corpo = partes.length ? Buffer.concat(partes) : null;
      var req = clienteHttp(u.protocol).request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: metodo, headers: cab }, function (res) {
        var fimOk = function (corpoBuf) {
          var w = formato.replace('%{http_code}', res.statusCode).replace('%{remote_ip}', '').replace('%{content_type}', res.headers['content-type'] || '').replace(/\\n/g, '\n');
          if (corpoBuf) { f.stdout._dado(corpoBuf); }
          f.stdout._dado(Buffer.from(w));
          f.emit('exit', 0); f.emit('close', 0);
        };
        if (saidaArq) { res.pipe(fs.createWriteStream(saidaArq)).on('finish', function () { fimOk(null); }).on('error', function (e) { f.stderr._dado(Buffer.from(e.message)); f.emit('close', 23); }); }
        else { var p = []; res.on('data', function (d) { p.push(Buffer.from(d)); }); res.on('end', function () { fimOk(Buffer.concat(p)); }); }
      });
      req.on('error', function (e) { f.stderr._dado(Buffer.from('curl: ' + e.message)); f.emit('exit', 6); f.emit('close', 6); });
      if (corpo) { req.write(corpo); }
      req.end();
    }
    if (!dadosStdin) { depois(enviar); }
    return f;
  }
  function spawn(exe, args, opcoes) {
    args = args || []; opcoes = opcoes || {};
    if (opcoes.shell && !args.length) { var t = separarAspas(String(exe)); exe = t[0]; args = t.slice(1); }
    var b = String(exe).split(/[\\/]/).pop().toLowerCase();
    if (ehCurl(exe)) { return curl(args); }
    if (/^powershell(\.exe)?$/.test(b) && args.indexOf('-File') >= 0 && args.indexOf('-saida') >= 0) {
      return remoto('/plugin/microfone', { saida: args[args.indexOf('-saida') + 1], stop: args[args.indexOf('-stop') + 1], max: args[args.indexOf('-max') + 1] });
    }
    if (b === 'open' && args[0] === '-a') { return falhar(new Filho(), naoDisponivel('abrir o Photoshop pelo navegador')); }
    return remoto('/plugin/proc', { exe: String(exe), args: args.map(String), cwd: opcoes.cwd || null, envExtra: soVars(opcoes.env) });
  }
  function juntarSaida(f, op2, cb) {
    var so = [], se = [], timer = null;
    f.stdout.on('data', function (d) { so.push(Buffer.from(d)); });
    f.stderr.on('data', function (d) { se.push(Buffer.from(d)); });
    if (op2 && op2.timeout) { timer = setTimeout(function () { f.kill(); }, op2.timeout); }
    var feito = false;
    function fim(code, e) {
      if (feito) { return; } feito = true; clearTimeout(timer);
      var enc = op2 && op2.encoding === 'buffer' ? null : 'utf8', a = Buffer.concat(so), b2 = Buffer.concat(se);
      var o1 = enc ? a.toString(enc) : a, o2 = enc ? b2.toString(enc) : b2;
      if (e || code) { var er = e || new Error('Command failed with code ' + code + ': ' + String(o2).slice(0, 300)); er.code = er.code || code; er.killed = f.killed; er.stdout = o1; er.stderr = o2; if (cb) { cb(er, o1, o2); } }
      else if (cb) { cb(null, o1, o2); }
    }
    f.on('close', function (c) { fim(c); });
    f.on('error', function (e) { fim(1, e); });
    return f;
  }
  // Janela de instalação/login (o plugin escreve um .bat ou manda um comando ao Terminal do Mac):
  // o conector abre a JANELA DELE, com os comandos dele. Daqui só vai qual é a janela.
  function janelaDoTexto(t, cb) {
    var f = new Filho(), tipo = null, exe = null, m;
    if (/claude\.ai\/install/.test(t)) { tipo = 'instalarClaude'; }
    else if (/@openai\/codex/.test(t)) { tipo = 'instalarCodex'; }
    else if ((m = /"([^"]*claude[^"]*)"\s+auth login/i.exec(t))) { tipo = 'loginClaude'; exe = m[1]; }
    else if ((m = /"([^"]*codex[^"]*)"\s+login/i.exec(t))) { tipo = 'loginCodex'; exe = m[1]; }
    depois(function () {
      if (!tipo) { var e = naoDisponivel('janela de comando'); if (cb) { cb(e, '', ''); } f.emit('close', 1); return; }
      op('/plugin/janela', { tipo: tipo, exe: exe }).then(function () { if (cb) { cb(null, '', ''); } f.emit('close', 0); }, function (e) { if (cb) { cb(e, '', ''); } f.emit('close', 1); });
    });
    return f;
  }
  function execFile(arq, args, opcoes, cb) {
    if (typeof args === 'function') { cb = args; args = []; opcoes = {}; }
    if (typeof opcoes === 'function') { cb = opcoes; opcoes = {}; }
    args = args || []; opcoes = opcoes || {};
    var b = String(arq).split(/[\\/]/).pop().toLowerCase();
    if (b === 'open' || b === 'explorer') {
      var f0 = new Filho();
      depois(function () {
        if (/^https?:/.test(args[0])) { window.open(args[0], '_blank', 'noopener'); }
        else { try { sincrono('/plugin/mostrar', { caminho: args[0] === '-R' ? args[1] : args[0] }); } catch (e) { if (cb) { cb(e, '', ''); } return; } }
        if (cb) { cb(null, '', ''); } f0.emit('close', 0);
      });
      return f0;
    }
    if (b === 'osascript') { return janelaDoTexto(args.join('\n'), cb); }
    if (/^tar(\.exe)?$/.test(b) && args[0] === '-xjf') {
      var f1 = new Filho();
      op('/plugin/extrair', { arquivo: args[1], pasta: args[3] }).then(function (r) {
        if (r && r.err) { var e = erroNode(r.err); if (cb) { cb(e, '', r.stderr || ''); } f1.emit('close', 1); return; }
        if (cb) { cb(null, '', ''); } f1.emit('close', 0);
      }, function (e) { if (cb) { cb(e, '', ''); } f1.emit('close', 1); });
      return f1;
    }
    return juntarSaida(spawn(arq, args, opcoes), opcoes, cb);
  }
  function exec(cmd, opcoes, cb) {
    if (typeof opcoes === 'function') { cb = opcoes; opcoes = {}; }
    var f = new Filho(), c = String(cmd), m;
    var fim = function (e, so) { if (cb) { cb(e || null, so || '', ''); } f.emit('exit', e ? 1 : 0); f.emit('close', e ? 1 : 0); };
    depois(function () {
      if (/MachineGuid|IOPlatformExpertDevice/.test(c)) {
        try { var id = sincrono('/plugin/maquina', {}); fim(null, id ? (INFO.platform === 'win32' ? '    MachineGuid    REG_SZ    ' + id : '"IOPlatformUUID" = "' + id + '"') : ''); } catch (e) { fim(e); }
        return;
      }
      if (/Get-Clipboard|^pbpaste/.test(c)) {
        if (navigator.clipboard && navigator.clipboard.readText) { navigator.clipboard.readText().then(function (t) { fim(null, t); }, function (e) { fim(e); }); } else { fim(naoDisponivel('área de transferência')); }
        return;
      }
      // proxy do sistema: o conector já sai pela rede do PC
      if (/Internet Settings|netsh winhttp|scutil --proxy/.test(c)) { fim(null, ''); return; }
      if ((m = /^where (claude|codex)$/.exec(c)) || (m = /command -v (claude|codex)/.exec(c)) || (m = /which -a (claude|codex)/.exec(c))) {
        op('/plugin/achar', { nome: m[1], todos: /which -a/.test(c) }).then(function (r) { fim(null, r.saida); }, function (e) { fim(e); });
        return;
      }
      if ((m = /^start "" "?([^"]+\.bat)"?$/i.exec(c))) { var texto = ''; try { texto = fs.readFileSync(m[1], 'utf8'); } catch (e) {} janelaDoTexto(texto, function (e) { fim(e); }); return; }
      if ((m = /^start "" "?(https?:[^"]+)"?$/.exec(c))) { window.open(m[1], '_blank', 'noopener'); fim(null, ''); return; }
      if ((m = /^taskkill \/pid (\d+)/i.exec(c))) { op('/plugin/proc/matarPid', { pid: Number(m[1]) }).then(function () { fim(null, ''); }, function (e) { fim(e); }); return; }
      if ((m = /Compress-Archive -Path '(.+)\\\*' -DestinationPath '(.+)' -Force/.exec(c)) || (m = /^cd "(.+)" && zip -q -r "(.+)" \.$/.exec(c))) {
        op('/plugin/zipar', { pasta: m[1], zip: m[2] }).then(function (r) { fim(r && r.err ? erroNode(r.err) : null, ''); }, function (e) { fim(e); });
        return;
      }
      if ((m = /^explorer(?: \/select,)? ?"?([^"]+)"?$/.exec(c)) || (m = /^open -R "([^"]+)"$/.exec(c))) { try { sincrono('/plugin/mostrar', { caminho: m[1] }); fim(null, ''); } catch (e) { fim(e); } return; }
      fim(naoDisponivel(c.split(' ')[0]));
    });
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
  // Arquivos do PC citados no script (logo, vídeo, áudio…) vão para a memória do editor com o MESMO
  // caminho; o que o editor gravar num caminho do PC (quadros, renders) volta para o PC pelo conector.
  var RE_CAMINHO = /"((?:[A-Za-z]:\\\\|\/Users\/|\/home\/|\/tmp\/|\/private\/|\/var\/folders\/)(?:[^"\\]|\\.)*)"/g;
  var enviados = {};
  function arquivosDoScript(codigo) {
    var lista = [], vistos = {}, m;
    RE_CAMINHO.lastIndex = 0;
    while ((m = RE_CAMINHO.exec(codigo))) {
      var c; try { c = JSON.parse('"' + m[1] + '"'); } catch (e) { continue; }
      if (vistos[c]) { continue; } vistos[c] = true;
      try {
        var st = fs.statSync(c);
        if (!st.isFile() || st.size > 1536 * 1048576) { continue; }
        var marca = st.size + ':' + st.mtimeMs;
        if (enviados[c] === marca) { continue; }
        var b = fs.readFileSync(c);
        lista.push({ caminho: c, bytes: new Uint8Array(b.buffer, b.byteOffset, b.length) });
        enviados[c] = marca;
      } catch (e) { /* não existe ou o Arcano não tem acesso: segue sem */ }
    }
    return lista;
  }
  function devolverAoPC(arquivos) {
    (arquivos || []).forEach(function (a) {
      try { fs.writeFileSync(a.caminho, Buffer.from(a.bytes)); var st = fs.statSync(a.caminho); enviados[a.caminho] = st.size + ':' + st.mtimeMs; }
      catch (e) { try { console.warn('[Arcano] não consegui gravar no PC:', a.caminho, e.message); } catch (x) {} }
    });
  }
  // Programa de PC (?pc=video): o painel está numa janela do navegador ao lado do programa instalado;
  // o script vai direto para ele pelo conector (os arquivos já estão no PC, nada para copiar).
  var MODO_PC = (/[?&]pc=(video|imagem)\b/.exec(location.search) || [])[1] || null;
  // Photoshop (Arcano Design): no editor de imagem (?host=ps) ou no programa de PC de imagem (?pc=imagem).
  var MODO_PS = /[?&]host=ps\b/.test(location.search) || MODO_PC === 'imagem';
  var ps = null;
  function transportePS() {
    if (MODO_PC === 'imagem') {
      // programa de PC: cada pedido vai síncrono ao conector, que fala com o programa (canal com senha)
      var ped = function (metodo, params) { return sincrono('/plugin/editorpc/pedido', { app: 'imagem', metodo: metodo, params: params || {} }); };
      var cmd = function (c, p) { return ped('engine.execute', { command: c, params: p || {} }); };
      var ativo = function () { return (cmd('document.activate', { offset: 0 }) || {}).document; };
      return {
        pedido: ped,
        abrir: function (caminho) { return ped('app.open', { path: caminho }); },
        // o canal do programa não coloca arquivo direto: abre, copia as camadas para o documento e fecha
        colocar: function (caminho) {
          var alvo = ativo();
          ped('app.open', { path: caminho });
          var novo = ativo(), ids = ((cmd('layer.list', {}) || {}).layers || []).map(function (l) { return l.id; });
          try { cmd('layer.copyToDocument', { document: alvo, layers: ids, source: novo, center: true }); }
          finally { try { cmd('file.close', { document: novo }); } catch (e) { /* já fechou */ } cmd('document.activate', { document: alvo }); }
          return true;
        },
        exportar: function (doc, caminho, qualidade) {
          if (doc !== null && doc !== undefined) { cmd('document.activate', { document: doc }); }
          var p = { path: caminho };
          if (qualidade && /\.jpe?g$/i.test(caminho)) { p.quality = Math.max(0, Math.min(12, Math.round(qualidade * 12 / 100))); }
          return ped('app.save', p);
        }
      };
    }
    var api = function () {
      var m = null; try { m = window.parent && window.parent.photocraftArcano; } catch (e) { m = null; }
      if (!m) { throw new Error('O editor de imagem ainda está abrindo.'); }
      return m;
    };
    var resp = function (t) { var r = JSON.parse(t); if (!r.ok) { throw new Error(r.error || 'erro no editor'); } return r.result; };
    var bytes = function (c) { var b = fs.readFileSync(c); return new Uint8Array(b.buffer, b.byteOffset, b.length); };
    return {
      pedido: function (metodo, params) { return resp(api().arcanoPedido(metodo, JSON.stringify(params || {}))); },
      colocar: function (caminho) { return resp(api().arcanoColocar(caminho.split(/[\\/]/).pop(), bytes(caminho))); },
      abrir: function (caminho) { return resp(api().arcanoAbrir(caminho.split(/[\\/]/).pop(), bytes(caminho))); },
      exportar: function (doc, caminho, qualidade) {
        var m = api(), b = m.arcanoExportar(doc === null || doc === undefined ? undefined : doc, caminho.split(/[\\/]/).pop(), qualidade || undefined);
        if (!b) { throw new Error(m.arcanoErro() || 'não consegui gravar o arquivo'); }
        fs.writeFileSync(caminho, Buffer.from(b));
        return true;
      }
    };
  }
  function motorPS() {
    if (ps) { return ps; }
    var sep = INFO.platform === 'win32' ? '\\' : '/';
    ps = window.ArcanoPS({
      ed: transportePS(), fs: fs, criarDOM: window.ArcanoPSDOM, windows: INFO.platform === 'win32', casa: INFO.home,
      docs: INFO.home + sep + 'Documents', temp: INFO.tmp, dados: INFO.env && (INFO.env.APPDATA || INFO.home),
      lerScript: function (c) { return /arcano(-ps)?\.jsx$/i.test(c) ? lerDoSite(EXT_DIR + '/jsx/' + c.split(/[\\/]/).pop(), 'utf8') : fs.readFileSync(c, 'utf8'); }
    });
    return ps;
  }
  function noEditor(codigo, cb) {
    if (MODO_PC) {
      op('/plugin/editorpc', { app: MODO_PC, codigo: codigo }).then(function (r) { cb(r || { ok: false, erro: 'sem resposta', transporte: true }); }, function (e) { cb({ ok: false, erro: e.message, transporte: true }); });
      return;
    }
    var id = 'e' + (++seq);
    var arquivos = arquivosDoScript(codigo);
    pedidos[id] = function (r) { devolverAoPC(r.arquivos); cb(r); };
    window.parent.postMessage({ arcano: 'eval', id: id, codigo: codigo, arquivos: arquivos }, '*');
  }
  // O plugin carrega a biblioteca com $.evalFile(new File("…/jsx/arcano.jsx")): aqui o arquivo vem do site.
  var RE_EVALFILE = /\$\.evalFile\(new File\(("(?:[^"\\]|\\.)*")\)\);?/;
  function evalScript(codigo, cb) {
    cb = cb || function () {};
    if (MODO_PS) {
      var r;
      try { r = motorPS().avaliar(codigo); } catch (e) { r = 'EvalScript error.'; try { console.warn('[Arcano Design]', e); } catch (x) {} }
      depois(function () { cb(r); });
      return;
    }
    var m = RE_EVALFILE.exec(codigo), passos = [];
    if (m) {
      var arq = JSON.parse(m[1]);
      if (/arcano(-ps)?\.jsx$/i.test(arq)) {
        // programa de PC: o programa pode ter sido fechado e aberto; manda a biblioteca junto sempre (é local)
        if (!jsxCarregado || MODO_PC) {
          try { jsxFonte = jsxFonte || lerDoSite(EXT_DIR + '/jsx/' + arq.split(/[\\/]/).pop(), 'utf8'); } catch (e) { cb('EvalScript error.'); return; }
          passos.push('var __arcanoJsx = ' + JSON.stringify(jsxFonte) + ';');
        }
        codigo = codigo.replace(RE_EVALFILE, '(0, eval)(__arcanoJsx);');
      }
    }
    var rodar = function () {
      noEditor(codigo, function (r) {
        if (!r.ok) {
          try { console.warn('[Arcano] script do editor:', r.erro); } catch (e) {}
          // programa de PC fora do ar / canal fechado: o motivo vai para o painel (e para a IA), não um "recusou" genérico
          if (r.transporte) { cb(JSON.stringify({ ok: false, erro: 'Não consegui falar com o Arcano Layers ' + (MODO_PS ? 'Imagem' : 'Vídeo') + ': ' + r.erro + '. Abra o programa (ou feche e abra de novo) e tente outra vez.' })); return; }
          cb('EvalScript error.'); return;
        }
        cb(r.resultado == null ? '' : String(r.resultado));
      });
    };
    if (passos.length) { noEditor(passos.join('\n'), function (r) { if (r.ok) { jsxCarregado = true; } rodar(); }); } else { rodar(); }
  }
  // Aviso "abra o programa" no modo PC (e recarrega a biblioteca quando o programa reabre).
  function vigiarProgramaPC() {
    var aviso = null, estava = null;
    var ver = function () {
      op('/plugin/editorpc/aberto', { app: MODO_PC }).then(function (aberto) {
        if (aberto && estava === false) { jsxCarregado = false; }
        estava = !!aberto;
        if (!aberto && !aviso) {
          aviso = document.createElement('div');
          aviso.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99998;padding:12px 14px;border-radius:12px;background:#2a1747;border:1px solid #7c3aed;color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)';
          aviso.textContent = MODO_PS ? 'Abra o Arcano Layers Imagem no seu computador: o painel do Arcano Design conversa com ele.' : 'Abra o Arcano Layers Vídeo no seu computador: o painel do Arcano Motion conversa com ele.';
          document.body.appendChild(aviso);
        } else if (aberto && aviso) { aviso.parentNode.removeChild(aviso); aviso = null; }
      }, function () {}).then(function () { setTimeout(ver, 3000); });
    };
    ver();
  }
  var cepFalso = {
    evalScript: evalScript,
    getHostEnvironment: function () { return JSON.stringify({ appName: MODO_PS ? 'PHXS' : 'AEFT', appVersion: MODO_PS ? '27.0' : '26.0', appLocale: 'pt_BR', appUILocale: 'pt_BR', appId: 'AEFT', isAppOnline: true, appSkinInfo: { panelBackgroundColor: { color: { red: 35, green: 35, blue: 35 } } } }); },
    getCurrentApiVersion: function () { return JSON.stringify({ major: 12, minor: 0, micro: 0 }); },
    getExtensionId: function () { return MODO_PS ? 'com.arcano.design.panel' : 'com.arcano.motion.panel'; },
    getSystemPath: function () { return EXT_DIR; },
    dispatchEvent: function () {}, addEventListener: function () {}, removeEventListener: function () {},
    requestOpenExtension: function () {}, closeExtension: function () {}, invokeSync: function () { return ''; }, invokeAsync: function () {}
  };
  var cepUtil = {
    fs: {
      showOpenDialog: function (multi, pastas, titulo, inicial, tipos) { try { return sincrono('/plugin/escolher', { a: [!!multi, !!pastas, titulo || '', inicial || '', tipos || []] }); } catch (e) { return { err: 1, data: [] }; } },
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
    f.src = '../painel/index.html#so-conector';
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
      if (!r || !(MODO_PC ? /^0\.[3-9]|^[1-9]/ : /^0\.[2-9]|^[1-9]/).test(String(r.status.versao || ''))) {
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
        platform: INFO.platform, arch: INFO.arch,
        // no Windows o nome das variáveis não diferencia maiúsculas (ProgramFiles = PROGRAMFILES)
        env: new Proxy(INFO.env || {}, { get: function (o, k) { if (typeof k !== 'string') { return o[k]; } if (k in o) { return o[k]; } var l = k.toLowerCase(); for (var x in o) { if (x.toLowerCase() === l) { return o[x]; } } return undefined; } }), version: INFO.version, versions: INFO.versions, pid: 1, execPath: '',
        cwd: function () { return INFO.home; }, nextTick: function (f) { var a = Array.prototype.slice.call(arguments, 1); depois(function () { f.apply(null, a); }); },
        on: function () {}, once: function () {}, emit: function () {}, hrtime: function () { var t = performance.now(); return [Math.floor(t / 1000), Math.floor((t % 1000) * 1e6)]; }
      };
      window.cep_node = { require: requerer, process: processo, Buffer: Buffer, global: window };
      window.__adobe_cep__ = cepFalso;
      window.cep = cepUtil;
      window.ARCANO_NAVEGADOR = true;
      window.ARCANO_PC = !!MODO_PC;
      if (MODO_PS) { window.__arcanoHost = 'ps'; }
      // Photoshop: a camada que imita o Photoshop (ps-dom.js) entra antes do plugin
      carregarScripts((MODO_PS ? ['web/ps-dom.js', 'web/ps-dom-camadas.js'] : []).concat(window.ARCANO_SCRIPTS || []), 0);
      if (MODO_PC) { document.title = MODO_PS ? 'Arcano Design' : 'Arcano Motion'; vigiarProgramaPC(); }
    });
  }
  // atualizador (igual ao After): o sw.js serve a versão que o painel instalou pelo botão "Baixar e instalar"
  try { if (navigator.serviceWorker) { navigator.serviceWorker.register(EXT_DIR + '/sw.js', { scope: EXT_DIR + '/' }).catch(function (e) { console.warn('[Arcano] atualizador', e); }); } } catch (e) {}
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', iniciar); } else { iniciar(); }
})();
