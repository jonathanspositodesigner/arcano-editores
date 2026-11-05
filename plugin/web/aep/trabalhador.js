/*
 * Leitor de projeto do After (.aep/.aet) num Web Worker (não trava o editor nem o painel).
 * Usa o Pyodide (Python no navegador, baixado do jsDelivr na 1ª vez; o navegador guarda) com o
 * py-aep (MIT) e o aep_jsx.py, que escreve o script que monta o projeto no editor.
 *
 * Pedido:   { id, bytes: Uint8Array, nome, pyodide: url base, rodas: url base dos .whl, conversor: url do aep_jsx.py }
 * Respostas: { id, progresso: texto } ... { id, ok: true, jsx, avisos, fontes } | { id, ok: false, erro }
 * Gravar (.aep): { id, acao: 'gravar', dados: JSON do projeto do editor, windows, ...urls } -> { id, ok: true, bytes, avisos }
 */
/* global importScripts, loadPyodide */
'use strict';

var RODAS = ['attrs-26.1.0-py3-none-any.whl', 'fonttools-4.68.0-py3-none-any.whl', 'py_aep-0.18.2-py3-none-any.whl'];
var py = null;

function baixar(url) {
  return fetch(url, { cache: 'force-cache' }).then(function (r) {
    if (!r.ok) { throw new Error('não consegui baixar ' + url.split('/').pop() + ' (' + r.status + ')'); }
    return r.arrayBuffer();
  }).then(function (b) { return new Uint8Array(b); });
}

function preparar(d, avisar) {
  if (py) { return py; }
  py = (function () {
    avisar('Baixando o leitor de projetos do After (só na primeira vez)...');
    importScripts(d.pyodide + 'pyodide.js');
    return loadPyodide({ indexURL: d.pyodide }).then(function (p) {
      avisar('Preparando o leitor...');
      return Promise.all(RODAS.map(function (n) { return baixar(d.rodas + n); }).concat([baixar(d.rodas + 'pyyaml-puro.zip'), baixar(d.conversor)]))
        .then(function (arqs) {
          var site = p.runPython('import site; site.getsitepackages()[0]');
          for (var i = 0; i < RODAS.length; i++) { p.unpackArchive(arqs[i], 'wheel'); }
          p.unpackArchive(arqs[RODAS.length], 'zip', { extractDir: site });
          p.FS.writeFile(site + '/aep_jsx.py', arqs[RODAS.length + 1]);
          p.runPython('import aep_jsx');
          return p;
        });
    });
  })();
  py.catch(function () { py = null; });
  return py;
}

self.onmessage = function (ev) {
  var d = ev.data || {};
  var avisar = function (t) { self.postMessage({ id: d.id, progresso: t }); };
  Promise.resolve().then(function () { return preparar(d, avisar); }).then(function (p) {
    if (d.acao === 'gravar') {
      // editor -> .aep (Arquivo > Salvar como projeto do After)
      avisar('Gravando o projeto do After...');
      p.globals.set('arcano_dados', String(d.dados || '{}'));
      p.globals.set('arcano_win', !!d.windows);
      var g = JSON.parse(p.runPython("aep_jsx.gravar(arcano_dados, arcano_win, '/tmp/saida.aep')"));
      var bytes = p.FS.readFile('/tmp/saida.aep');
      try { p.FS.unlink('/tmp/saida.aep'); } catch (e) { /* tanto faz */ }
      self.postMessage({ id: d.id, ok: true, bytes: bytes, avisos: g.avisos || [] }, [bytes.buffer]);
      return;
    }
    avisar('Lendo o projeto do After...');
    p.FS.writeFile('/tmp/projeto.aep', d.bytes);
    p.globals.set('arcano_nome', String(d.nome || 'Projeto do After'));
    var r = JSON.parse(p.runPython("aep_jsx.converter('/tmp/projeto.aep', arcano_nome)"));
    try { p.FS.unlink('/tmp/projeto.aep'); } catch (e) { /* tanto faz */ }
    self.postMessage({ id: d.id, ok: true, jsx: r.jsx, avisos: r.avisos || [], fontes: r.fontes || [] });
  }).catch(function (e) {
    var msg = String((e && e.message) || e);
    // erro do Python: a última linha diz o que foi
    var linhas = msg.trim().split('\n');
    self.postMessage({ id: d.id, ok: false, erro: linhas[linhas.length - 1].slice(0, 400) });
  });
};
