/*
 * ══════════════════════════════════════════════════════════════════════════════
 *  ARCANO CONECTOR — liga o painel do Arcano Layers (navegador) ao Claude Code
 *  oficial instalado no PC do cliente. Mesmo princípio do plugin Arcano Motion.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  Navegador (layers.voxvisual.com.br)  ⇄  este conector (127.0.0.1)  ⇄  claude (CLI oficial)
 *
 *  ⚠️ O LOGIN DO CLAUDE NUNCA SAI DO PC. O conector só abre o Claude Code oficial
 *  (como o plugin faz no After); quem fala com a Anthropic é ele. O navegador não
 *  recebe token nenhum: recebe só o texto da conversa e os pedidos de ferramenta.
 *
 *  ⚠️ SÓ AS ORIGENS DO ARCANO FALAM COM ELE. Qualquer outro site que tentar
 *  chamar 127.0.0.1 leva 403 (o navegador sempre manda o Origin verdadeiro).
 *
 *  ⚠️ AS FERRAMENTAS VÊM DO PAINEL. O conector é genérico: a lista de
 *  ferramentas (nome, descrição, schema) chega junto com cada pedido de chat, e
 *  cada chamada da IA é repassada ao navegador, que executa no editor. Assim dá
 *  pra melhorar o painel sem reinstalar nada no PC.
 *
 *  Node 20+, sem dependências.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const VERSAO = '0.4.0';
const PORTAS = [47821, 47822, 47823, 47824, 47825];
const ORIGENS = [
  'https://layers.voxvisual.com.br',
  'https://arcanoapp.voxvisual.com.br',
];
const ORIGEM_DEV = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const VERSOES_MCP = ['2025-06-18', '2025-03-26', '2024-11-05'];
const WIN = process.platform === 'win32';

function pastaConfig() {
  const base = WIN ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')) : path.join(os.homedir(), '.config');
  const p = path.join(base, 'ArcanoConector');
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function log(...a) {
  const linha = new Date().toISOString() + ' ' + a.map(String).join(' ');
  console.log(linha);
  try { fs.appendFileSync(path.join(pastaConfig(), 'conector.log'), linha + '\n'); } catch (e) { /* sem log */ }
}

// ─── Claude Code: achar, verificar, instalar, login (mesma lógica do plugin) ───

function ambienteLimpo() {
  const env = { ...process.env };
  // Sem chave de API: o Claude Code usa a assinatura do cliente, não cobrança por API.
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  env.ENABLE_TOOL_SEARCH = 'false';
  env.MCP_PROTOCOL_NEGOTIATION = 'legacy';
  if (!WIN) {
    const atuais = String(env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin').split(':');
    for (const d of [os.homedir() + '/.local/bin', '/opt/homebrew/bin', '/usr/local/bin']) if (!atuais.includes(d)) atuais.push(d);
    env.PATH = atuais.join(':');
  }
  return env;
}

function aspas(a) { return '"' + String(a).replace(/"/g, '\\"') + '"'; }

function iniciarProcesso(exe, args, opcoes = {}) {
  const cwd = opcoes.cwd || pastaConfig();
  fs.mkdirSync(cwd, { recursive: true });
  const o = { cwd, env: ambienteLimpo(), windowsHide: true };
  if (/\.(cmd|bat)$/i.test(exe)) return cp.spawn(aspas(exe) + ' ' + args.map(aspas).join(' '), [], { ...o, shell: true });
  return cp.spawn(exe, args, o);
}

function rodarAteFim(exe, args, limiteMs) {
  return new Promise((resolve) => {
    let filho, saida = '', erro = '', fim = false;
    const terminar = (codigo) => { if (fim) return; fim = true; clearTimeout(t); resolve({ codigo, saida, erro }); };
    try { filho = iniciarProcesso(exe, args); } catch (e) { resolve({ codigo: -1, saida: '', erro: e.message }); return; }
    const t = setTimeout(() => { try { filho.kill(); } catch (e) { /* já morreu */ } terminar(-2); }, limiteMs);
    filho.stdout.on('data', (d) => { saida += d; });
    filho.stderr.on('data', (d) => { erro += d; });
    filho.on('error', (e) => { erro += e.message; terminar(-1); });
    filho.on('close', (c) => terminar(c));
    try { filho.stdin.on('error', () => {}); filho.stdin.end(); } catch (e) { /* sem stdin */ }
  });
}

function candidatosClaude() {
  const home = os.homedir(), env = process.env, lista = [];
  if (WIN) {
    lista.push(path.join(home, '.local', 'bin', 'claude.exe'));
    if (env.LOCALAPPDATA) lista.push(path.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links', 'claude.exe'));
    if (env.APPDATA) lista.push(path.join(env.APPDATA, 'npm', 'claude.cmd'));
  } else {
    lista.push(path.join(home, '.local', 'bin', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude', path.join(home, '.npm-global', 'bin', 'claude'));
  }
  return lista;
}

function procurarNaExtensaoVSCode() {
  const base = path.join(os.homedir(), '.vscode', 'extensions'), alvo = WIN ? 'claude.exe' : 'claude';
  let pastas;
  try { pastas = fs.readdirSync(base).filter((n) => n.startsWith('anthropic.claude-code')).sort().reverse(); } catch (e) { return null; }
  const buscar = (dir, nivel) => {
    if (nivel > 5) return null;
    let itens; try { itens = fs.readdirSync(dir); } catch (e) { return null; }
    for (const i of itens) { const c = path.join(dir, i); try { if (fs.statSync(c).isFile() && i === alvo) return c; } catch (e) { /* segue */ } }
    for (const i of itens) {
      const d = path.join(dir, i);
      try { if (i !== 'node_modules' && fs.statSync(d).isDirectory()) { const r = buscar(d, nivel + 1); if (r) return r; } } catch (e) { /* segue */ }
    }
    return null;
  };
  for (const p of pastas) { const r = buscar(path.join(base, p), 0); if (r) return r; }
  return null;
}

async function localizarClaude() {
  for (const c of candidatosClaude()) { try { if (fs.statSync(c).isFile()) return c; } catch (e) { /* não existe */ } }
  const r = await new Promise((res) => cp.exec(WIN ? 'where claude' : '/bin/zsh -lc "command -v claude"', { timeout: 8000, windowsHide: true }, (err, saida) => res(String(saida || ''))));
  const linhas = r.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const exe = linhas.find((l) => !WIN || /\.exe$/i.test(l)) || linhas[0];
  return exe || procurarNaExtensaoVSCode();
}

let caminhoClaude = null;

async function verificarClaudeCode() {
  caminhoClaude = await localizarClaude();
  if (!caminhoClaude) return { instalado: false, mensagem: 'O Claude Code não está instalado neste computador.' };
  const rv = await rodarAteFim(caminhoClaude, ['--version'], 30000);
  const versao = (rv.saida.match(/\d+\.\d+\.\d+/) || [])[0];
  if (rv.codigo !== 0 || !versao) return { instalado: false, caminho: caminhoClaude, mensagem: 'Achei o Claude Code, mas ele não respondeu.' };
  const ra = await rodarAteFim(caminhoClaude, ['auth', 'status'], 25000);
  const info = { instalado: true, versao };
  let json = null; try { json = JSON.parse(ra.saida); } catch (e) { /* texto */ }
  if (ra.codigo === 0) {
    info.logado = true;
    info.metodo = (json && json.authMethod) || 'desconhecido';
    info.email = json ? String(json.email || json.emailAddress || (json.account && json.account.email) || '') : '';
    if (info.metodo === 'api_key' || info.metodo === 'api_key_helper') {
      info.aviso = 'Logado com CHAVE DE API, não com a assinatura. Isso cobra à parte. Faça login com a conta do seu plano.';
    }
  } else {
    info.logado = false;
    info.mensagem = ra.codigo === -2 ? 'O Claude Code não respondeu à verificação de login. Atualize com "claude update".' : 'Falta fazer login no Claude Code.';
  }
  return info;
}

function abrirJanela(linhasBat, comandoMac) {
  if (WIN) {
    const bat = path.join(os.tmpdir(), 'arcano-conector-' + Date.now() + '.bat');
    fs.writeFileSync(bat, ['@echo off', 'chcp 65001 >nul', ...linhasBat].join('\r\n') + '\r\n', 'utf8');
    cp.exec('start "" ' + aspas(bat), { windowsHide: false });
  } else {
    cp.execFile('osascript', ['-e', 'tell application "Terminal" to do script ' + JSON.stringify(comandoMac), '-e', 'tell application "Terminal" to activate']);
  }
}

function instalarClaude() {
  abrirJanela([
    'title Instalando o Claude Code',
    'echo Instalando o Claude Code com o instalador oficial da Anthropic...',
    'echo.',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; irm https://claude.ai/install.ps1 | iex"',
    'if not exist "%USERPROFILE%\\.local\\bin\\claude.exe" (',
    '  echo.',
    '  echo O instalador direto nao terminou. Tentando pelo winget...',
    '  winget install -e --id Anthropic.ClaudeCode --accept-source-agreements --accept-package-agreements',
    ')',
    'echo.',
    'echo Terminou. Pode fechar esta janela e voltar ao Arcano Layers no navegador.',
    'pause',
  ], 'curl -fsSL https://claude.ai/install.sh | bash');
}

function loginClaude() {
  if (!caminhoClaude) return false;
  abrirJanela([
    'title Login no Claude',
    'set ANTHROPIC_API_KEY=',
    'echo Vai abrir o navegador. Entre com a conta do seu plano Pro ou Max e autorize.',
    'echo.',
    aspas(caminhoClaude) + ' auth login',
    'echo.',
    'echo Se apareceu que deu certo, pode fechar esta janela e voltar ao Arcano Layers.',
    'pause',
  ], 'unset ANTHROPIC_API_KEY; ' + aspas(caminhoClaude) + ' auth login');
  return true;
}

// ─── Estado da conversa em andamento ───

const tokenMCP = crypto.randomBytes(24).toString('hex');
let portaAtual = 0;
let conversa = null; // { res, ferramentas, processo, pendentes: Map(id → resolve) }

function enviarAoNavegador(obj) {
  if (!conversa || conversa.res.writableEnded) return false;
  conversa.res.write('data: ' + JSON.stringify(obj) + '\n\n');
  return true;
}

function pedirFerramenta(nome, args) {
  return new Promise((resolve) => {
    if (!conversa) { resolve({ texto: 'O painel do navegador não está conectado.', erro: true }); return; }
    const id = crypto.randomBytes(8).toString('hex');
    const limite = setTimeout(() => { conversa && conversa.pendentes.delete(id); resolve({ texto: 'O editor demorou demais para responder (2 min).', erro: true }); }, 120000);
    conversa.pendentes.set(id, (r) => { clearTimeout(limite); resolve(r); });
    if (!enviarAoNavegador({ tipo: 'ferramenta', id, nome, args })) { clearTimeout(limite); resolve({ texto: 'O painel do navegador fechou.', erro: true }); }
  });
}

// ─── MCP para o Claude Code (só 127.0.0.1, com token, sem Origin) ───

async function processarRPC(m) {
  if (!m || typeof m.method !== 'string') return m && m.id !== undefined ? { jsonrpc: '2.0', id: m.id, error: { code: -32600, message: 'Invalid Request' } } : null;
  if (m.id === undefined || m.id === null) return null;
  const p = m.params || {};
  const ok = (result) => ({ jsonrpc: '2.0', id: m.id, result });
  switch (m.method) {
    case 'initialize':
      return ok({
        protocolVersion: VERSOES_MCP.includes(p.protocolVersion) ? p.protocolVersion : VERSOES_MCP[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'arcano-layers', version: VERSAO },
        instructions: 'Ferramentas que controlam o editor do Arcano Layers aberto no navegador do usuário.',
      });
    case 'ping': return ok({});
    case 'tools/list':
      return ok({ tools: (conversa ? conversa.ferramentas : []).map((f) => ({ name: f.name, description: f.description, inputSchema: f.inputSchema, _meta: { 'anthropic/alwaysLoad': true } })) });
    case 'tools/call': {
      const r = await pedirFerramenta(p.name, p.arguments || {});
      const content = [];
      if (r.imagem && r.imagem.base64) content.push({ type: 'image', data: r.imagem.base64, mimeType: r.imagem.mime || 'image/png' });
      content.push({ type: 'text', text: String(r.texto == null ? '' : r.texto) });
      return ok({ content, isError: !!r.erro });
    }
    case 'resources/list': return ok({ resources: [] });
    case 'resources/templates/list': return ok({ resourceTemplates: [] });
    case 'prompts/list': return ok({ prompts: [] });
    default: return { jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'Method not found' } };
  }
}

// ─── Chat: roda o Claude Code e transmite tudo ao navegador (SSE) ───

function rodarChat(corpo, res) {
  if (conversa) { try { conversa.processo && conversa.processo.kill(); } catch (e) { /* já parou */ } }
  if (!caminhoClaude) { res.writeHead(409, cabecalhosJSON()); res.end(JSON.stringify({ erro: 'Claude Code não encontrado.' })); return; }
  const pasta = pastaConfig();
  const pastaSessao = path.join(pasta, 'sessao');
  fs.mkdirSync(pastaSessao, { recursive: true });
  const arquivoMCP = path.join(pasta, 'mcp.json');
  const arquivoInstr = path.join(pasta, 'instrucoes.md');
  fs.writeFileSync(arquivoMCP, JSON.stringify({ mcpServers: { arcano: { type: 'http', url: 'http://127.0.0.1:' + portaAtual + '/mcp', headers: { Authorization: 'Bearer ' + tokenMCP }, alwaysLoad: true } } }, null, 2));
  fs.writeFileSync(arquivoInstr, String(corpo.instrucoes || ''), 'utf8');

  const args = ['-p', '--output-format', 'stream-json', '--verbose',
    '--mcp-config', arquivoMCP, '--strict-mcp-config',
    '--tools', '', '--allowedTools', 'mcp__arcano__*',
    '--permission-mode', 'dontAsk',
    '--append-system-prompt-file', arquivoInstr,
    '--setting-sources', 'user',
    '--max-turns', String(Math.min(Number(corpo.maxTurnos) || 40, 80))];
  if (corpo.sessao && /^[\w-]{8,80}$/.test(corpo.sessao)) args.push('--resume', corpo.sessao);
  if (corpo.modelo && /^[\w.-]{2,40}$/.test(corpo.modelo)) args.push('--model', corpo.modelo);
  if (corpo.esforco && /^(low|medium|high|xhigh|max)$/.test(corpo.esforco)) args.push('--effort', corpo.esforco);

  res.writeHead(200, { ...cabecalhosCORS(res._origem), 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const estado = { res, ferramentas: Array.isArray(corpo.ferramentas) ? corpo.ferramentas : [], processo: null, pendentes: new Map() };
  conversa = estado;
  const pulso = setInterval(() => { if (!res.writableEnded) res.write(': pulso\n\n'); }, 15000);

  let filho;
  try { filho = iniciarProcesso(caminhoClaude, args, { cwd: pastaSessao }); } catch (e) {
    enviarAoNavegador({ tipo: 'fim', ok: false, texto: 'Não consegui iniciar o Claude Code: ' + e.message });
    clearInterval(pulso); res.end(); conversa = null; return;
  }
  estado.processo = filho;
  let buffer = '', erroTxt = '';
  filho.stdout.setEncoding('utf8');
  filho.stdout.on('data', (d) => {
    buffer += d;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const l = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
      if (!l) continue;
      let e; try { e = JSON.parse(l); } catch (x) { continue; }
      if (conversa === estado) enviarAoNavegador({ tipo: 'evento', e });
    }
  });
  filho.stderr.on('data', (d) => { erroTxt = (erroTxt + d).slice(-4000); });
  filho.on('close', (codigo) => {
    clearInterval(pulso);
    if (conversa === estado) {
      enviarAoNavegador({ tipo: 'fim', ok: codigo === 0, codigo, erro: codigo === 0 ? '' : erroTxt });
      for (const r of estado.pendentes.values()) r({ texto: 'Conversa encerrada.', erro: true });
      conversa = null;
    }
    if (!res.writableEnded) res.end();
  });
  filho.stdin.on('error', () => {});
  filho.stdin.write(String(corpo.pedido || ''));
  filho.stdin.end();
  res.on('close', () => { if (conversa === estado) { try { filho.kill(); } catch (e) { /* já parou */ } } });
}

// ─── HTTP ───

/*
 * ══════════════════════════════════════════════════════════════════════════════
 *  API DO PLUGIN (espelho no navegador) — versão SEGURA
 * ══════════════════════════════════════════════════════════════════════════════
 *  O plugin Arcano Motion (o mesmo código do After) roda no navegador e pede ao
 *  conector o que no After ele faria com o Node. Aqui NÃO existe "rode qualquer
 *  coisa": cada pedido é uma operação com nome, e cada parâmetro é conferido.
 *
 *  ⚠️ ARQUIVOS: só dentro das pastas do Arcano (RAIZES) e nos arquivos que a
 *     própria pessoa escolheu na janela de abrir (liberados só para leitura).
 *  ⚠️ PROGRAMAS: só os desta lista (ver PROGRAMAS em processos), nunca comando
 *     livre, nunca script escrito pelo navegador.
 *  ⚠️ PASTAS DE PROGRAMAS (bin, ouvido): o navegador não grava lá. Quem baixa e
 *     atualiza esses programas é o conector, de endereços fixos.
 *
 */
const https = require('https');
const zlib = require('zlib');

// ─── Pastas permitidas ───
function pastasArcano() {
  const casa = os.homedir();
  const docs = path.join(casa, 'Documents');
  const appdata = WIN ? (process.env.APPDATA || path.join(casa, 'AppData', 'Roaming'))
    : (process.platform === 'darwin' ? path.join(casa, 'Library', 'Application Support') : casa);
  const comum = WIN || process.platform === 'darwin' ? path.join(appdata, 'ArcanoMotion') : path.join(casa, '.arcanomotion');
  const design = WIN || process.platform === 'darwin' ? path.join(appdata, 'ArcanoDesign') : path.join(casa, '.arcanodesign');
  return {
    comum,
    design,
    // Gravar e ler livremente (menos as pastas de programas, abaixo).
    escrita: [comum, design, path.join(docs, 'Arcano Motion'), path.join(docs, 'Arcano Motion IA'), path.join(docs, 'Arcano Motion LUTs'),
      path.join(docs, 'Arcano Design'), path.join(casa, 'Downloads', 'Arcano')],
    // Programas que só o conector instala: o navegador lê (para saber se existem), não grava.
    programas: [path.join(comum, 'bin'), path.join(comum, 'ouvido')],
    tmp: os.tmpdir(),
  };
}

const liberadosLeitura = new Set(); // arquivos escolhidos pela pessoa (janela de abrir) e arrastados

function normal(p) {
  if (typeof p !== 'string' || !p || p.indexOf('\0') >= 0) throw codigoErro('EACCES', 'caminho inválido');
  return path.resolve(p);
}
function dentro(p, raiz) {
  const r = path.resolve(raiz);
  const a = WIN ? p.toLowerCase() : p, b = WIN ? r.toLowerCase() : r;
  return a === b || a.startsWith(b + path.sep);
}
// O caminho real (atalhos/links resolvidos) do arquivo ou da pasta mais próxima que existe.
function real(p) {
  let atual = p, resto = [];
  for (let i = 0; i < 64; i++) {
    try { return path.join(fs.realpathSync.native(atual), ...resto.reverse()); } catch (e) { /* ainda não existe */ }
    const pai = path.dirname(atual);
    if (pai === atual) return p;
    resto.push(path.basename(atual));
    atual = pai;
  }
  return p;
}
function codigoErro(code, msg) { const e = new Error(msg + ' (' + code + ')'); e.code = code; return e; }

// modo: 'ler' | 'gravar'
function conferirCaminho(caminho, modo) {
  const p = normal(caminho);
  const r = real(p);
  const P = pastasArcano();
  const tmpOk = (x) => {
    if (!dentro(x, P.tmp)) return false;
    const primeiro = path.relative(P.tmp, x).split(path.sep)[0] || '';
    return /^arcano/i.test(primeiro);
  };
  const ok = (x) => {
    if (P.programas.some((d) => dentro(x, d))) return modo === 'ler';
    if (P.escrita.some((d) => dentro(x, d)) || tmpOk(x)) return true;
    if (modo === 'ler' && liberadosLeitura.has(WIN ? x.toLowerCase() : x)) return true;
    return false;
  };
  if (!ok(p) || !ok(r)) throw codigoErro('EACCES', 'o Arcano não tem acesso a ' + p);
  return p;
}
// Caminho dentro das pastas de programas (bin, ouvido) ou null.
function emProgramas(p) { try { const n = real(normal(p)); return pastasArcano().programas.some((d) => dentro(n, d)) ? n : null; } catch (e) { return null; } }
const urlsConfiaveis = new Set(); // destinos de redirecionamento das releases oficiais (yt-dlp, sherpa-onnx)
function liberarLeitura(p) { const n = normal(p); liberadosLeitura.add(WIN ? n.toLowerCase() : n); const r = real(n); liberadosLeitura.add(WIN ? r.toLowerCase() : r); }

// ─── Codificação (Buffer, Stats, Date) entre conector e navegador ───
function cod(v) {
  if (v === undefined) return { __u: 1 };
  if (v === null || typeof v !== 'object') return v;
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { __b: Buffer.from(v).toString('base64') };
  if (v instanceof Date) return { __d: v.toISOString() };
  if (Array.isArray(v)) return v.map(cod);
  const o = {};
  for (const k of Object.keys(v)) if (typeof v[k] !== 'function') o[k] = cod(v[k]);
  return o;
}
function dec(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(dec);
  if (v.__b !== undefined) return Buffer.from(v.__b, 'base64');
  if (v.__u) return undefined;
  if (v.__d) return new Date(v.__d);
  const o = {};
  for (const k of Object.keys(v)) o[k] = dec(v[k]);
  return o;
}
function erroJSON(e) { return { message: String((e && e.message) || e), code: e && e.code }; }
function stat(st) {
  return { size: st.size, mode: st.mode, mtimeMs: st.mtimeMs, ctimeMs: st.ctimeMs, atimeMs: st.atimeMs, birthtimeMs: st.birthtimeMs,
    arquivo: st.isFile(), pasta: st.isDirectory(), link: st.isSymbolicLink() };
}
// Só opções simples (encoding, flag, recursive, withFileTypes): nada de funções nem descritores.
function opcoes(o) {
  if (o == null) return undefined;
  if (typeof o === 'string') return o;
  const r = {};
  for (const k of ['encoding', 'flag', 'recursive', 'withFileTypes', 'mode']) if (o[k] !== undefined) r[k] = o[k];
  return r;
}

// ─── Arquivos ───
function opArquivo(c) {
  const a = dec(c.a || []);
  switch (c.f) {
    case 'readFileSync': {
      if (ehConfigCodex(a[0])) return fs.readFileSync(normal(a[0]), opcoes(a[1]));
      const p = conferirCaminho(a[0], 'ler'); return fs.readFileSync(p, opcoes(a[1]));
    }
    case 'writeFileSync': {
      if (ehConfigCodex(a[0])) { gravarConfigCodex(normal(a[0]), String(a[1])); return undefined; }
      const p = conferirCaminho(a[0], 'gravar'); fs.writeFileSync(p, a[1], opcoes(a[2])); return undefined;
    }
    case 'appendFileSync': { const p = conferirCaminho(a[0], 'gravar'); fs.appendFileSync(p, a[1], opcoes(a[2])); return undefined; }
    // Só metadados (existe? tamanho? data?): o plugin procura Chrome, Claude, Codex, tar… fora das pastas do Arcano.
    case 'existsSync': { try { return fs.existsSync(normal(a[0])); } catch (e) { return false; } }
    case 'statSync': case 'lstatSync': { const p = normal(a[0]); return stat(fs[c.f](p)); }
    case 'readdirSync': {
      const p = conferirCaminho(a[0], 'ler'), o = opcoes(a[1]) || {};
      if (o && o.withFileTypes) return fs.readdirSync(p, { withFileTypes: true }).map((d) => ({ __de: { name: d.name, arquivo: d.isFile(), pasta: d.isDirectory(), link: d.isSymbolicLink() } }));
      return fs.readdirSync(p, typeof o === 'string' ? o : undefined);
    }
    case 'unlinkSync': fs.unlinkSync(emProgramas(a[0]) || conferirCaminho(a[0], 'gravar')); return undefined;
    case 'rmdirSync': fs.rmdirSync(conferirCaminho(a[0], 'gravar'), opcoes(a[1])); return undefined;
    case 'rmSync': fs.rmSync(conferirCaminho(a[0], 'gravar'), opcoes(a[1])); return undefined;
    case 'mkdirSync': fs.mkdirSync(emProgramas(a[0]) || conferirCaminho(a[0], 'gravar'), opcoes(a[1])); return undefined;
    case 'renameSync': {
      // dentro da pasta de programas só de lá para lá (o arquivo veio de um download confiável)
      const p1 = emProgramas(a[0]), p2 = emProgramas(a[1]);
      if (p1 || p2) { if (!(p1 && p2)) throw codigoErro('EACCES', 'não pode mover para a pasta de programas'); fs.renameSync(p1, p2); return undefined; }
      fs.renameSync(conferirCaminho(a[0], 'gravar'), conferirCaminho(a[1], 'gravar')); return undefined;
    }
    case 'copyFileSync': fs.copyFileSync(conferirCaminho(a[0], 'ler'), conferirCaminho(a[1], 'gravar')); return undefined;
    case 'utimesSync': fs.utimesSync(emProgramas(a[0]) || conferirCaminho(a[0], 'gravar'), a[1], a[2]); return undefined;
    case 'chmodSync': { const p = emProgramas(a[0]); if (p) fs.chmodSync(p, 0o755); else conferirCaminho(a[0], 'gravar'); return undefined; } // executável só na pasta de programas
    case 'lerTrecho': { // openSync + readSync + closeSync de um pedaço
      const p = conferirCaminho(a[0], 'ler'), fd = fs.openSync(p, 'r');
      try { const b = Buffer.alloc(Math.min(a[2] || 0, 64 * 1048576)); const n = fs.readSync(fd, b, 0, b.length, a[1] || 0); return b.slice(0, n); } finally { fs.closeSync(fd); }
    }
    default: throw codigoErro('ENOSYS', 'operação de arquivo não permitida: ' + c.f);
  }
}

// ─── Funções puras (path, url, zlib, hash, dns) ───
const PATH_OK = ['join', 'resolve', 'dirname', 'basename', 'extname', 'normalize', 'relative', 'isAbsolute', 'parse', 'format', 'toNamespacedPath'];
function opCaminho(c) {
  if (!PATH_OK.includes(c.f)) throw codigoErro('ENOSYS', 'path.' + c.f);
  return path[c.f](...dec(c.a || []));
}
function opZlib(c) {
  const ok = ['inflateRawSync', 'inflateSync', 'gunzipSync', 'unzipSync', 'deflateRawSync', 'deflateSync', 'gzipSync'];
  if (!ok.includes(c.f)) throw codigoErro('ENOSYS', 'zlib.' + c.f);
  const a = dec(c.a || []);
  return zlib[c.f](a[0]);
}
function opHash(c) {
  const algs = ['md5', 'sha1', 'sha256', 'sha512'];
  if (!algs.includes(c.alg)) throw codigoErro('ENOSYS', 'hash ' + c.alg);
  const h = c.hmac ? crypto.createHmac(c.alg, dec(c.chave)) : crypto.createHash(c.alg);
  for (const d of dec(c.dados || [])) h.update(d);
  return h.digest(c.enc || undefined);
}

// ─── Janela de escolher arquivos (o que a pessoa escolher fica liberado para leitura) ───
function janelaArquivos(a) {
  const [multi, soPasta, titulo, , exts] = a || [];
  let lista = [];
  try {
    if (WIN) {
      const filtro = Array.isArray(exts) && exts.length ? 'Arquivos|' + exts.filter((e) => /^[a-z0-9]{1,8}$/i.test(e)).map((e) => '*.' + e).join(';') + '|Todos|*.*' : 'Todos|*.*';
      const t = String(titulo || 'Escolher arquivos').replace(/[`$"']/g, '');
      const ps = soPasta
        ? `Add-Type -AssemblyName System.Windows.Forms;$d=New-Object System.Windows.Forms.FolderBrowserDialog;$d.Description='${t}';if($d.ShowDialog((New-Object System.Windows.Forms.Form -Property @{TopMost=$true}))-eq 'OK'){$d.SelectedPath}`
        : `Add-Type -AssemblyName System.Windows.Forms;$d=New-Object System.Windows.Forms.OpenFileDialog;$d.Multiselect=$${multi ? 'true' : 'false'};$d.Title='${t}';$d.Filter='${filtro}';if($d.ShowDialog((New-Object System.Windows.Forms.Form -Property @{TopMost=$true}))-eq 'OK'){$d.FileNames -join [char]10}`;
      lista = cp.execFileSync('powershell', ['-NoProfile', '-STA', '-Command', ps], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/);
    } else if (process.platform === 'darwin') {
      const tipo = soPasta ? 'choose folder' : 'choose file' + (multi ? ' with multiple selections allowed' : '');
      const t = JSON.stringify(String(titulo || 'Escolher arquivos'));
      const script = `set r to ${tipo} with prompt ${t}\nset s to ""\nrepeat with f in (r as list)\nset s to s & POSIX path of f & linefeed\nend repeat\nreturn s`;
      lista = cp.execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).split('\n');
    }
  } catch (e) { lista = []; } // cancelou
  lista = lista.map((x) => x.trim()).filter(Boolean);
  lista.forEach(liberarLeitura);
  return { err: 0, data: lista };
}

// ─── ID do computador (licença por PC, igual ao plugin) ───
function idMaquina() {
  try {
    if (WIN) {
      const s = cp.execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true });
      const m = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/.exec(s); return m ? m[1].toLowerCase() : null;
    }
    if (process.platform === 'darwin') {
      const s = cp.execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], { encoding: 'utf8' });
      const m = /"IOPlatformUUID"\s*=\s*"([^"]+)"/.exec(s); return m ? m[1].toLowerCase() : null;
    }
  } catch (e) { /* sem id */ }
  return null;
}

// ─── Mostrar na pasta (só pastas do Arcano) ───
function mostrarNaPasta(p) {
  const c = conferirCaminho(p, 'ler');
  if (WIN) cp.spawn('explorer.exe', ['/select,', c], { detached: true, stdio: 'ignore' }).unref();
  else if (process.platform === 'darwin') cp.spawn('open', ['-R', c], { detached: true, stdio: 'ignore' }).unref();
  return true;
}

// ─── Internet (pedido feito pelo conector; resposta guardada até o navegador pedir o corpo) ───
const respostasHttp = new Map();
let seqHttp = 0;
function opHttp(c) {
  return new Promise((resolve) => {
    const o = dec(c.opts) || {};
    const proto = c.proto === 'http:' ? 'http:' : 'https:';
    // http puro só para o próprio PC não: nada de falar com 127.0.0.1/rede local pelo navegador.
    const host = String(o.hostname || o.host || '').toLowerCase();
    if (proto === 'http:' || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1)/.test(host)) { resolve({ err: { message: 'endereço não permitido' } }); return; }
    const op = { hostname: o.hostname || o.host, port: o.port, path: o.path || '/', method: o.method || 'GET', headers: o.headers || {} };
    let fim = false;
    const acabar = (x) => { if (!fim) { fim = true; resolve(x); } };
    const req = https.request(op, (res) => {
      res.pause();
      const urlPedida = 'https://' + host + String(o.path || '/');
      const oficial = host === 'github.com' && /^\/(yt-dlp\/yt-dlp|k2-fsa\/sherpa-onnx)\/releases\//.test(String(o.path || ''));
      res._confiavel = oficial || urlsConfiaveis.has(urlPedida);
      // redirecionamento de uma release oficial: o destino também é confiável (só ele, uma vez)
      if (res._confiavel && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        try { urlsConfiaveis.add(new URL(res.headers.location, urlPedida).href); } catch (e) { /* endereço estranho */ }
      }
      const id = 'h' + (++seqHttp);
      respostasHttp.set(id, res);
      setTimeout(() => { if (respostasHttp.get(id) === res) { respostasHttp.delete(id); res.resume(); } }, 10 * 60000);
      acabar({ id, status: res.statusCode, statusMessage: res.statusMessage, headers: res.headers });
    });
    req.on('error', (e) => acabar({ err: erroJSON(e) }));
    if (c.limite) req.setTimeout(c.limite, () => req.destroy(new Error('tempo esgotado')));
    if (c.corpo) req.write(Buffer.from(c.corpo, 'base64'));
    req.end();
  });
}
function opHttpCorpo(c) {
  const res = respostasHttp.get(c.id);
  if (!res) return Promise.resolve({ err: { message: 'resposta não existe mais' } });
  respostasHttp.delete(c.id);
  return new Promise((resolve) => {
    if (c.descartar) { res.resume(); resolve({ ok: true }); return; }
    if (c.caminho) {
      let destino;
      try {
        const P = pastasArcano(), alvo = real(normal(c.caminho));
        const deProgramas = P.programas.some((d) => dentro(alvo, d));
        // Programas (yt-dlp, ouvido) só baixados das releases oficiais no GitHub.
        if (deProgramas && res._confiavel) { fs.mkdirSync(path.dirname(alvo), { recursive: true }); destino = alvo; }
        else destino = conferirCaminho(c.caminho, 'gravar');
      } catch (e) { res.resume(); resolve({ err: erroJSON(e) }); return; }
      const out = fs.createWriteStream(destino, { flags: c.acrescentar ? 'a' : 'w' });
      let bytes = 0;
      res.on('data', (d) => { bytes += d.length; });
      out.on('finish', () => resolve({ bytes }));
      out.on('error', (e) => resolve({ err: erroJSON(e) }));
      res.on('error', (e) => resolve({ err: erroJSON(e) }));
      res.pipe(out);
      return;
    }
    const partes = [];
    res.on('data', (d) => partes.push(d));
    res.on('end', () => resolve({ corpo: Buffer.concat(partes).toString('base64') }));
    res.on('error', (e) => resolve({ err: erroJSON(e) }));
    res.resume();
  });
}

function infoPlugin() {
  const P = pastasArcano();
  const env = {};
  for (const k of ['APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOME', 'SystemRoot', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432', 'CODEX_HOME', 'LANG', 'PATH', 'Path', 'USERNAME', 'USER', 'COMPUTERNAME']) if (process.env[k]) env[k] = process.env[k];
  return {
    platform: process.platform, arch: process.arch, version: process.version, versions: { node: process.versions.node },
    env, home: os.homedir(), tmp: os.tmpdir(), hostname: os.hostname(), cpus: (os.cpus() || []).length || 2,
    sep: path.sep, delimiter: path.delimiter, pastas: P, conector: VERSAO,
  };
}

// ─── Codex: o plugin liga/desliga o bloco do Arcano no ~/.codex/config.toml. Só esse bloco pode mudar,
// e só com servidor http em 127.0.0.1 (um servidor de "comando" ali rodaria qualquer programa).
function pastaCodexConector() { return process.env.CODEX_HOME || path.join(os.homedir(), '.codex'); }
function ehConfigCodex(p) {
  try { const n = normal(p), alvo = path.join(pastaCodexConector(), 'config.toml'); return WIN ? n.toLowerCase() === alvo.toLowerCase() : n === alvo; } catch (e) { return false; }
}
const RE_BLOCO_CODEX = /# >>> arcano[^\n]*\n[\s\S]*?# <<< arcano[^\n]*\n?/g;
function semBlocosArcano(t) { return String(t || '').replace(RE_BLOCO_CODEX, '').replace(/\s+$/, ''); }
function gravarConfigCodex(arq, novo) {
  let atual = '';
  try { atual = fs.readFileSync(arq, 'utf8'); } catch (e) { /* ainda não existe */ }
  if (semBlocosArcano(novo) !== semBlocosArcano(atual)) throw codigoErro('EACCES', 'só o bloco do Arcano pode mudar no config.toml do Codex');
  const blocos = String(novo).match(RE_BLOCO_CODEX) || [];
  const linhaOk = /^(# (>>>|<<<) arcano.*|\[mcp_servers\.arcano_(motion|design)\]|url = "http:\/\/127\.0\.0\.1:\d{1,5}\/mcp"|bearer_token_env_var = "[A-Z_]+"|enabled = (true|false)|required = (true|false)|default_tools_approval_mode = "approve"|startup_timeout_sec = \d+|tool_timeout_sec = \d+|)$/;
  for (const b of blocos) for (const l of b.split('\n')) if (!linhaOk.test(l.trim())) throw codigoErro('EACCES', 'linha não permitida no bloco do Codex: ' + l.slice(0, 60));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, novo, 'utf8');
}

// ─── Eventos para o navegador (saída dos programas, pedidos ao servidor MCP do plugin) ───
const sessoesPlugin = new Map(); // sid → { fila, acordar }
function sessaoPlugin(sid) { let s = sessoesPlugin.get(sid); if (!s) { s = { fila: [], acordar: null }; sessoesPlugin.set(sid, s); } return s; }
function avisar(sid, ev) { const s = sessaoPlugin(sid); s.fila.push(ev); if (s.acordar) { const f = s.acordar; s.acordar = null; f(); } }

// ─── Programas da LISTA ───
// Nada de comando livre: cada programa tem regra do executável e dos argumentos.
const procsPlugin = new Map(); // id → ChildProcess
let seqProc = 0;
function base(p) { return path.basename(String(p || '')).toLowerCase(); }
function foraDasPastasGravaveis(p) {
  const P = pastasArcano(), n = real(normal(p));
  if (P.escrita.some((d) => dentro(n, d)) || dentro(n, P.tmp) || dentro(n, path.join(os.homedir(), 'Downloads'))) return false;
  return true;
}
function emPastaArcano(p) { try { conferirCaminho(p, 'ler'); return true; } catch (e) { return false; } }
function exigir(cond, msg) { if (!cond) throw codigoErro('EACCES', 'programa ou argumento não permitido: ' + msg); }

function regraClaude(args) {
  if (args.length === 1 && args[0] === '--version') return;
  if (args.length === 1 && args[0] === 'update') return;
  if (args.length === 2 && args[0] === 'auth' && (args[1] === 'status' || args[1] === 'logout')) return;
  exigir(args[0] === '-p', 'claude ' + args[0]);
  const comValor = { '--output-format': /^stream-json$/, '--mcp-config': 'arquivo-mcp', '--tools': /^(|Read)$/, '--allowedTools': /^(mcp__arcano__\*|Read)$/,
    '--permission-mode': /^dontAsk$/, '--append-system-prompt-file': 'arquivo', '--setting-sources': /^user$/, '--max-turns': /^\d{1,3}$/,
    '--resume': /^[\w-]{6,80}$/, '--model': /^[\w.\-\[\]]{1,60}$/, '--effort': /^(low|medium|high|xhigh|max)$/, '--input-format': /^(text|stream-json)$/ };
  const semValor = ['-p', '--verbose', '--strict-mcp-config', '--no-session-persistence', '--include-partial-messages'];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (semValor.includes(a)) continue;
    if (a === '--disallowedTools') { while (i + 1 < args.length && /^mcp__arcano__\w+$/.test(args[i + 1])) i++; continue; }
    const r = comValor[a];
    exigir(r, 'claude ' + a);
    const v = args[++i];
    exigir(v !== undefined, 'claude ' + a + ' sem valor');
    if (r === 'arquivo') exigir(emPastaArcano(v), 'claude ' + a);
    else if (r === 'arquivo-mcp') conferirMCP(v);
    else exigir(r.test(v), 'claude ' + a + ' ' + v);
  }
}
// O arquivo de MCP só pode apontar para o servidor do plugin em 127.0.0.1 (http). Comando ali rodaria qualquer coisa.
function conferirMCP(arq) {
  exigir(emPastaArcano(arq), 'mcp-config fora das pastas do Arcano');
  let j; try { j = JSON.parse(fs.readFileSync(conferirCaminho(arq, 'ler'), 'utf8')); } catch (e) { exigir(false, 'mcp-config inválido'); }
  const srv = (j && j.mcpServers) || {};
  for (const k of Object.keys(srv)) {
    const s = srv[k] || {};
    exigir(s.type === 'http' && /^http:\/\/127\.0\.0\.1:\d{1,5}\/mcp$/.test(String(s.url || '')) && !s.command, 'servidor MCP ' + k);
  }
}
function regraCodex(args) {
  if (args.length === 1 && args[0] === '--version') return;
  if (args.length === 2 && args[0] === 'login' && args[1] === 'status') return;
  exigir(args[0] === 'exec', 'codex ' + args[0]);
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (['--json', '--skip-git-repo-check', '-', 'resume'].includes(a)) continue;
    if (a === '--sandbox') { exigir(args[++i] === 'read-only', 'codex sandbox'); continue; }
    if (a === '-m') { exigir(/^[\w.\-]{1,60}$/.test(args[++i] || ''), 'codex -m'); continue; }
    if (a === '-c') { exigir(/^model_reasoning_effort=(minimal|low|medium|high|xhigh)$/.test(args[++i] || ''), 'codex -c'); continue; }
    if (a === '--image') { String(args[++i] || '').split(',').forEach((f) => exigir(emPastaArcano(f), 'codex imagem')); continue; }
    if (args[i - 1] === 'resume' && /^[\w-]{6,80}$/.test(a)) continue;
    exigir(false, 'codex ' + a);
  }
}
function regraYtdlp(args) {
  if (args.length === 1 && args[0] === '-U') return;
  const semValor = ['--no-playlist', '--quiet', '--progress', '--newline', '--no-mtime', '--no-warnings', '--no-part'];
  const comValor = { '-S': /^[\w:,.]+$/, '--merge-output-format': /^(mp4|mkv|mov)$/, '--match-filter': /^duration<=\?\d+$/, '--max-filesize': /^\d+[KMG]?$/,
    '--cookies-from-browser': /^(chrome|edge|firefox|safari)$/, '-f': /^[\w+\/\[\]<>=:.-]+$/ };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (semValor.includes(a)) continue;
    if (a === '-o') { const v = args[++i] || ''; exigir(emPastaArcano(v.replace(/%\([^)]*\)s/g, 'x')), 'yt-dlp -o'); continue; }
    if (comValor[a]) { exigir(comValor[a].test(args[++i] || ''), 'yt-dlp ' + a); continue; }
    if (i === args.length - 1 && /^https?:\/\/[^\s]+$/.test(a)) continue; // o link
    exigir(false, 'yt-dlp ' + a);
  }
}
function regraOuvido(args) {
  for (const a of args) {
    if (/^--(whisper-language|whisper-task|num-threads)=[\w.-]+$/.test(a)) continue;
    const m = /^--(whisper-encoder|whisper-decoder|tokens)=(.+)$/.exec(a);
    if (m) { exigir(emPastaArcano(m[2]), 'ouvido ' + m[1]); continue; }
    exigir(!a.startsWith('-') && emPastaArcano(a), 'ouvido ' + a.slice(0, 40));
  }
}
const FLAGS_NAVEGADOR = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--mute-audio',
  '--hide-scrollbars', '--disable-blink-features=AutomationControlled', '--dump-dom'];
function regraNavegador(args) {
  args.forEach((a, i) => {
    if (FLAGS_NAVEGADOR.includes(a) || /^--lang=[\w-]+$/.test(a) || /^--window-size=\d+,\d+$/.test(a) || /^--virtual-time-budget=\d+$/.test(a) || /^--user-agent=[^"]{1,300}$/.test(a)) return;
    const m = /^--user-data-dir=(.+)$/.exec(a);
    if (m) { exigir(emPastaArcano(m[1]), 'navegador perfil'); return; }
    exigir(i === args.length - 1 && /^https?:\/\/[^\s]+$/.test(a), 'navegador ' + a.slice(0, 60));
  });
}
function classificar(exe, args) {
  const b = base(exe), P = pastasArcano();
  if (/^claude(\.exe|\.cmd)?$/.test(b)) { exigir(foraDasPastasGravaveis(exe), 'claude em pasta gravável'); regraClaude(args); return 'claude'; }
  if (/^codex(\.exe|\.cmd)?$/.test(b)) { exigir(foraDasPastasGravaveis(exe), 'codex em pasta gravável'); regraCodex(args); return 'codex'; }
  if (/^node(\.exe)?$/.test(b)) { exigir(args.length === 1 && args[0] === '--version', 'node'); return 'node'; }
  if (/^yt-dlp(\.exe|_macos)?$/.test(b)) { exigir(dentro(real(normal(exe)), path.join(P.comum, 'bin')), 'yt-dlp fora da pasta'); regraYtdlp(args); return 'ytdlp'; }
  if (/^sherpa-onnx-offline(\.exe)?$/.test(b)) { exigir(dentro(real(normal(exe)), path.join(P.comum, 'ouvido')), 'ouvido fora da pasta'); regraOuvido(args); return 'ouvido'; }
  if (/^(chrome\.exe|msedge\.exe|google chrome|microsoft edge|chromium|google-chrome)$/.test(b)) { exigir(foraDasPastasGravaveis(exe), 'navegador'); regraNavegador(args); return 'navegador'; }
  exigir(false, b);
}
// Ambiente do conector (o navegador não manda variáveis): sem chave de API, com as pastas do Node/npm no PATH.
function ambienteProgramas(tipo) {
  const env = ambienteLimpo();
  const extra = [];
  if (WIN) { if (env.ProgramFiles) extra.push(path.join(env.ProgramFiles, 'nodejs')); if (env.APPDATA) extra.push(path.join(env.APPDATA, 'npm')); extra.push(path.join(os.homedir(), '.local', 'bin')); }
  else extra.push('/opt/homebrew/bin', '/usr/local/bin', path.join(os.homedir(), '.local', 'bin'));
  const k = Object.keys(env).find((x) => x.toLowerCase() === 'path') || 'PATH';
  env[k] = [env[k] || ''].concat(extra).join(path.delimiter);
  if (tipo === 'codex' && process.env.ARCANO_CODEX_TOKEN) env.ARCANO_CODEX_TOKEN = process.env.ARCANO_CODEX_TOKEN;
  return env;
}
function iniciarProg(c, sid) {
  const exe = String(c.exe || ''), args = (c.args || []).map(String);
  const tipo = classificar(exe, args);
  let cwd = c.cwd && emPastaArcano(c.cwd) ? c.cwd : pastasArcano().comum;
  try { fs.mkdirSync(cwd, { recursive: true }); } catch (e) { cwd = os.tmpdir(); }
  const env = ambienteProgramas(tipo);
  if (c.envExtra && typeof c.envExtra === 'object') {
    // só as variáveis que o plugin passa de propósito (token do MCP do Codex, biblioteca do ouvido no Mac)
    for (const k of Object.keys(c.envExtra)) if (/^(ARCANO_[A-Z_]+|DYLD_LIBRARY_PATH)$/.test(k)) env[k] = String(c.envExtra[k]);
  }
  const usarShell = WIN && /\.(cmd|bat)$/i.test(exe);
  const filho = usarShell
    ? cp.spawn(aspas(exe) + ' ' + args.map(aspas).join(' '), [], { cwd, env, windowsHide: true, shell: true })
    : cp.spawn(exe, args, { cwd, env, windowsHide: true });
  const id = 'p' + (++seqProc);
  procsPlugin.set(id, filho);
  const ev = (o) => avisar(sid, Object.assign({ id }, o));
  if (filho.stdout) filho.stdout.on('data', (d) => ev({ t: 'stdout', d: d.toString('base64') }));
  if (filho.stderr) filho.stderr.on('data', (d) => ev({ t: 'stderr', d: d.toString('base64') }));
  if (filho.stdin) filho.stdin.on('error', () => {});
  filho.on('error', (e) => ev({ t: 'error', e: erroJSON(e) }));
  filho.on('exit', (code, sinal) => ev({ t: 'exit', code, sinal }));
  filho.on('close', (code, sinal) => { ev({ t: 'close', code, sinal }); setTimeout(() => procsPlugin.delete(id), 60000); });
  log('programa', tipo, base(exe), id);
  return { id, pid: filho.pid, tipo };
}
function matarArvoreConector(filho) {
  try {
    if (WIN && filho.pid) cp.execFile('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { windowsHide: true }, () => {});
    else filho.kill('SIGTERM');
  } catch (e) { /* já saiu */ }
}

// ─── Operações fixas (o conector tem o próprio script; o navegador só passa parâmetros conferidos) ───
const SCRIPT_MIC = [
  'param([string]$saida, [string]$stop, [int]$max)',
  'Add-Type -TypeDefinition \'using System; using System.Text; using System.Runtime.InteropServices; public class ArcMci { [DllImport("winmm.dll", CharSet = CharSet.Unicode)] public static extern int mciSendString(string c, StringBuilder r, int l, IntPtr h); }\'',
  '$e = [ArcMci]::mciSendString("open new type waveaudio alias arcrec", $null, 0, [IntPtr]::Zero)',
  'if ($e -ne 0) { Write-Output "ERRO_ABRIR $e"; exit 2 }',
  '[void][ArcMci]::mciSendString("set arcrec bitspersample 16 channels 1 samplespersec 24000 alignment 2 bytespersec 48000", $null, 0, [IntPtr]::Zero)',
  '$e = [ArcMci]::mciSendString("record arcrec", $null, 0, [IntPtr]::Zero)',
  'if ($e -ne 0) { Write-Output "ERRO_GRAVAR $e"; [void][ArcMci]::mciSendString("close arcrec", $null, 0, [IntPtr]::Zero); exit 3 }',
  'Write-Output "GRAVANDO"',
  '$ini = Get-Date',
  'while (-not (Test-Path $stop) -and ((Get-Date) - $ini).TotalSeconds -lt $max) { Start-Sleep -Milliseconds 100 }',
  '[void][ArcMci]::mciSendString("stop arcrec", $null, 0, [IntPtr]::Zero)',
  '$e = [ArcMci]::mciSendString(\'save arcrec "\' + $saida + \'"\', $null, 0, [IntPtr]::Zero)',
  '[void][ArcMci]::mciSendString("close arcrec", $null, 0, [IntPtr]::Zero)',
  'if ($e -ne 0) { Write-Output "ERRO_SALVAR $e"; exit 4 }',
  'Write-Output "OK"',
].join('\r\n');
function opMicrofone(c, sid) {
  exigir(WIN, 'microfone (só Windows)');
  const saida = conferirCaminho(c.saida, 'gravar'), stop = conferirCaminho(c.stop, 'gravar');
  const max = Math.max(1, Math.min(600, Number(c.max) || 120));
  const ps1 = path.join(pastaConfig(), 'gravar-microfone.ps1');
  fs.writeFileSync(ps1, '\ufeff' + SCRIPT_MIC, 'utf8');
  const filho = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-saida', saida, '-stop', stop, '-max', String(max)], { windowsHide: true });
  const id = 'p' + (++seqProc);
  procsPlugin.set(id, filho);
  const ev = (o) => avisar(sid, Object.assign({ id }, o));
  filho.stdout.on('data', (d) => ev({ t: 'stdout', d: d.toString('base64') }));
  filho.stderr.on('data', (d) => ev({ t: 'stderr', d: d.toString('base64') }));
  filho.on('error', (e) => ev({ t: 'error', e: erroJSON(e) }));
  filho.on('close', (code) => { ev({ t: 'exit', code }); ev({ t: 'close', code }); });
  return { id, pid: filho.pid };
}
function opExtrair(c) {
  const arquivo = normal(c.arquivo), pasta = normal(c.pasta), P = pastasArcano();
  const ok = (x) => emPastaArcano(x) || dentro(real(x), path.join(P.comum, 'ouvido')) || dentro(real(x), path.join(P.comum, 'bin'));
  exigir(ok(arquivo) && ok(pasta), 'tar');
  return new Promise((resolve) => {
    const tar = WIN ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : '/usr/bin/tar';
    cp.execFile(tar, ['-xjf', arquivo, '-C', pasta], { windowsHide: true, timeout: 600000, maxBuffer: 4 * 1048576 },
      (e, so, se) => resolve(e ? { err: erroJSON(e), stderr: String(se || '') } : { ok: true }));
  });
}
function opZipar(c) {
  const pasta = conferirCaminho(c.pasta, 'ler'), zip = conferirCaminho(c.zip, 'gravar');
  return new Promise((resolve) => {
    const cb = (e) => resolve(e ? { err: erroJSON(e) } : { ok: true });
    if (WIN) cp.execFile('powershell', ['-NoProfile', '-Command', 'Compress-Archive', '-Path', path.join(pasta, '*'), '-DestinationPath', zip, '-Force'], { timeout: 300000, windowsHide: true }, cb);
    else cp.execFile('zip', ['-q', '-r', zip, '.'], { cwd: pasta, timeout: 300000 }, cb);
  });
}
async function opAcharPrograma(c) {
  const nome = c.nome === 'codex' ? 'codex' : 'claude';
  const cmd = WIN ? 'where' : '/bin/zsh', args = WIN ? [nome] : ['-lc', (c.todos ? 'which -a ' : 'command -v ') + nome];
  return new Promise((resolve) => cp.execFile(cmd, args, { timeout: 8000, windowsHide: true, env: ambienteProgramas(nome) }, (e, so) => resolve({ saida: String(so || '') })));
}
// Janelas de instalação/login: o conector tem os próprios comandos (o navegador só diz qual).
function opJanela(c) {
  const exe = c.exe ? String(c.exe) : '';
  if (exe) exigir(foraDasPastasGravaveis(exe) && /^(claude|codex)(\.exe|\.cmd)?$/.test(base(exe)), 'janela');
  const q = (x) => '"' + x.replace(/"/g, '') + '"';
  const W = {
    instalarClaude: ['title Instalando o Claude Code', 'powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; irm https://claude.ai/install.ps1 | iex"',
      'if not exist "%USERPROFILE%\\.local\\bin\\claude.exe" ( winget install -e --id Anthropic.ClaudeCode --accept-source-agreements --accept-package-agreements )', 'echo.', 'echo Terminou. Pode fechar esta janela.', 'pause'],
    loginClaude: ['title Login no Claude', 'set ANTHROPIC_API_KEY=', 'echo Vai abrir o navegador. Entre com a conta do seu plano Pro ou Max e autorize.', q(exe) + ' auth login', 'echo.', 'echo Se deu certo, pode fechar esta janela.', 'pause'],
    instalarCodex: ['title Instalando o Codex', 'set "PATH=%PATH%;%ProgramFiles%\\nodejs;%APPDATA%\\npm"', 'where node >nul 2>nul || (winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements)',
      'set "PATH=%PATH%;%ProgramFiles%\\nodejs;%APPDATA%\\npm"', 'call npm install -g @openai/codex', 'echo.', 'echo Terminou. Pode fechar esta janela.', 'pause'],
    loginCodex: ['title Login no Codex', 'set "PATH=%PATH%;%ProgramFiles%\\nodejs;%APPDATA%\\npm"', 'call ' + q(exe) + ' login', 'echo.', 'echo Se deu certo, pode fechar esta janela.', 'pause'],
  };
  const M = {
    instalarClaude: 'curl -fsSL https://claude.ai/install.sh | bash',
    loginClaude: q(exe) + ' auth login',
    instalarCodex: 'export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"; if command -v npm >/dev/null; then npm install -g @openai/codex; elif command -v brew >/dev/null; then brew install --cask codex; else open https://nodejs.org/; fi',
    loginCodex: q(exe) + ' login',
  };
  exigir(W[c.tipo], 'janela ' + c.tipo);
  exigir(!/^login/.test(c.tipo) || exe, 'janela sem programa');
  abrirJanela(['@echo off', 'chcp 65001 >nul'].concat(W[c.tipo]), M[c.tipo]);
  return true;
}

// ─── Servidor do plugin (o MCP que o Claude/Codex chamam): o conector escuta e repassa ao navegador ───
const servidoresPlugin = new Map();
const pedidosPlugin = new Map();
let seqSrv = 0;
function opServidor(sid) {
  return new Promise((resolve) => {
    const id = 's' + (++seqSrv);
    const srv = http.createServer((req, res) => {
      const rid = 'r' + (++seqSrv);
      const partes = [];
      req.on('data', (d) => partes.push(d));
      req.on('end', () => {
        pedidosPlugin.set(rid, res);
        res.on('close', () => pedidosPlugin.delete(rid));
        avisar(sid, { t: 'req', id, rid, method: req.method, url: req.url, headers: req.headers, corpo: Buffer.concat(partes).toString('base64') });
      });
    });
    srv.on('error', (e) => resolve({ err: erroJSON(e) }));
    srv.listen(0, '127.0.0.1', () => { servidoresPlugin.set(id, srv); resolve({ id, porta: srv.address().port }); });
  });
}

// Programa de PC do Arcano Layers (vídeo): o painel do plugin roda numa janela do navegador e o
// ExtendScript vai para o editor instalado pelo canal de controle local (127.0.0.1:47890). Só
// script.run passa (o script do editor só grava nas pastas do Arcano: regra do próprio editor).
const PORTA_EDITOR_PC = { video: 47890, imagem: 47891 };
// O programa de imagem pede senha no canal: ele grava em ArcanoDesign/controle.token (pasta do usuário).
function tokenImagem() {
  const os = require('os'), path = require('path'), fs = require('fs');
  const base = process.platform === 'win32' ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
    : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : null;
  const arq = base ? path.join(base, 'ArcanoDesign', 'controle.token') : path.join(os.homedir(), '.arcanodesign', 'controle.token');
  try { return fs.readFileSync(arq, 'utf8').trim(); } catch (e) { return null; }
}
const conexoesEditor = new Map();
function conexaoEditor(app) {
  // a porta que o programa anotou (ArcanoMotion/controle-<app>.porta); sem ela, a padrão
  let porta = PORTA_EDITOR_PC[app];
  try {
    const os = require('os'), path = require('path');
    const base = process.platform === 'win32' ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
      : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : null;
    const arq = base ? path.join(base, 'ArcanoMotion', 'controle-' + app + '.porta') : path.join(os.homedir(), '.arcanomotion', 'controle-' + app + '.porta');
    const n = Number(String(require('fs').readFileSync(arq, 'utf8')).trim());
    if (porta && n >= 1024 && n < 65536) porta = n;
  } catch (e) { /* sem arquivo: porta padrão */ }
  if (!porta) return Promise.reject(new Error('programa desconhecido'));
  const atual = conexoesEditor.get(app);
  if (atual && !atual.fechada) return Promise.resolve(atual);
  return new Promise((resolve, reject) => {
    const net = require('net');
    const sock = net.connect({ host: '127.0.0.1', port: porta });
    const con = { sock, fechada: false, seq: 0, esperando: new Map(), resto: '' };
    sock.setEncoding('utf8');
    sock.on('connect', () => {
      if (app !== 'imagem') { conexoesEditor.set(app, con); resolve(con); return; }
      const token = tokenImagem();
      if (!token) { sock.destroy(); reject(new Error('o programa do Arcano Layers Imagem não está aberto')); return; }
      con.esperando.set('auth', (r) => {
        if (r.ok) { conexoesEditor.set(app, con); resolve(con); } else { sock.destroy(); reject(new Error('o programa recusou a senha do canal: ' + (r.error || ''))); }
      });
      sock.write(JSON.stringify({ id: 'auth', method: 'auth', params: { token } }) + '\n');
    });
    sock.on('data', (d) => {
      con.resto += d;
      let i;
      while ((i = con.resto.indexOf('\n')) >= 0) {
        const linha = con.resto.slice(0, i); con.resto = con.resto.slice(i + 1);
        if (!linha.trim()) continue;
        let r; try { r = JSON.parse(linha); } catch (e) { continue; }
        const cb = con.esperando.get(r.id);
        if (cb) { con.esperando.delete(r.id); cb(r); }
      }
    });
    const fechar = (e) => {
      con.fechada = true; conexoesEditor.delete(app);
      for (const cb of con.esperando.values()) cb({ ok: false, error: 'o programa do Arcano Layers fechou' });
      con.esperando.clear();
      reject(e || new Error('fechou'));
    };
    sock.on('error', (e) => fechar(new Error(e.code === 'ECONNREFUSED' ? 'o programa do Arcano Layers não está aberto' : e.message)));
    sock.on('close', () => fechar());
  });
}
// Um pedido qualquer do canal (o painel do Arcano Design imita o Photoshop em cima deles).
// Métodos permitidos: os do canal de controle do programa, menos fechar o programa.
async function pedidoEditorPC(app, metodo, params) {
  metodo = String(metodo || '');
  if (!/^[a-z][A-Za-z0-9.]*$/.test(metodo) || metodo === 'app.quit' || metodo === 'auth') throw new Error('pedido não permitido: ' + metodo);
  const con = await conexaoEditor(app);
  const id = ++con.seq;
  const r = await new Promise((resolve) => {
    const t = setTimeout(() => { con.esperando.delete(id); resolve({ ok: false, error: 'o programa não respondeu em 10 minutos' }); }, 600000);
    con.esperando.set(id, (x) => { clearTimeout(t); resolve(x); });
    con.sock.write(JSON.stringify({ id, method: metodo, params: params && typeof params === 'object' ? params : {} }) + '\n');
  });
  if (!r.ok) throw new Error(String(r.error || 'erro no programa'));
  return r.result;
}

async function opEditorPC(c) {
  const codigo = String(c.codigo || '');
  if (codigo.length > 64 * 1048576) throw new Error('script grande demais');
  const con = await conexaoEditor(String(c.app || 'video'));
  const id = ++con.seq;
  const r = await new Promise((resolve) => {
    const t = setTimeout(() => { con.esperando.delete(id); resolve({ ok: false, error: 'o editor não respondeu em 10 minutos' }); }, 600000);
    con.esperando.set(id, (x) => { clearTimeout(t); resolve(x); });
    con.sock.write(JSON.stringify({ id, method: 'engine.execute', params: { command: 'script.run', params: { code: codigo, name: 'arcano-motion', console: true } } }) + '\n');
  });
  if (!r.ok) return { ok: false, erro: String(r.error || 'erro no editor') };
  const res = r.result || {};
  if (res.error) return { ok: false, erro: typeof res.error === 'string' ? res.error : JSON.stringify(res.error) };
  return { ok: true, resultado: res.result === undefined ? null : res.result };
}

async function tratarPlugin2(url, json, c) {
  const sid = String(c.sid || 'x');
  const tentar = async (fn) => { try { json(200, { ok: true, v: cod(await fn()) }); } catch (e) { json(200, { ok: false, e: erroJSON(e) }); } };
  switch (url) {
    case '/plugin/proc': await tentar(() => iniciarProg(c, sid)); return true;
    case '/plugin/proc/stdin': await tentar(() => { const p = procsPlugin.get(c.id); if (p && p.stdin) { if (c.d) p.stdin.write(Buffer.from(c.d, 'base64')); if (c.fim) p.stdin.end(); } return !!p; }); return true;
    case '/plugin/proc/matar': await tentar(() => { const p = procsPlugin.get(c.id); if (p) { if (c.arvore) matarArvoreConector(p); else try { p.kill(c.sinal || undefined); } catch (e) { /* já saiu */ } } return !!p; }); return true;
    case '/plugin/proc/matarPid': await tentar(() => { for (const p of procsPlugin.values()) if (p.pid === Number(c.pid)) { matarArvoreConector(p); return true; } return false; }); return true;
    case '/plugin/microfone': await tentar(() => opMicrofone(c, sid)); return true;
    case '/plugin/extrair': await tentar(() => opExtrair(c)); return true;
    case '/plugin/zipar': await tentar(() => opZipar(c)); return true;
    case '/plugin/achar': await tentar(() => opAcharPrograma(c)); return true;
    case '/plugin/janela': await tentar(() => opJanela(c)); return true;
    case '/plugin/editorpc': await tentar(() => opEditorPC(c)); return true;
    case '/plugin/editorpc/pedido': await tentar(() => pedidoEditorPC(String(c.app || 'imagem'), c.metodo, c.params)); return true;
    case '/plugin/editorpc/aberto': await tentar(() => conexaoEditor(String(c.app || 'video')).then(() => true, () => false)); return true;
    case '/plugin/servidor': await tentar(() => opServidor(sid)); return true;
    case '/plugin/servidor/fechar': await tentar(() => { const s = servidoresPlugin.get(c.id); if (s) { s.close(); servidoresPlugin.delete(c.id); } return true; }); return true;
    case '/plugin/servidor/resposta': await tentar(() => {
      const res = pedidosPlugin.get(c.rid);
      if (res) { pedidosPlugin.delete(c.rid); res.writeHead(c.status || 200, c.headers || {}); res.end(c.corpo ? Buffer.from(c.corpo, 'base64') : undefined); }
      return !!res;
    }); return true;
    case '/plugin/eventos': {
      const s = sessaoPlugin(sid);
      if (!s.fila.length) await new Promise((r) => { s.acordar = r; setTimeout(r, 25000); });
      const fila = s.fila; s.fila = [];
      json(200, { ok: true, eventos: fila }); return true;
    }
    default: return false;
  }
}

// Rotas /plugin/* (POST, corpo JSON). Devolve true se tratou.
async function tratarPlugin(url, json, texto) {
  let c;
  try { c = texto ? JSON.parse(texto) : {}; } catch (e) { json(400, { ok: false, e: { message: 'JSON inválido' } }); return true; }
  const sync = (fn) => { try { json(200, { ok: true, v: cod(fn()) }); } catch (e) { json(200, { ok: false, e: erroJSON(e) }); } };
  switch (url) {
    case '/plugin/info': sync(infoPlugin); return true;
    case '/plugin/fs': sync(() => opArquivo(c)); return true;
    case '/plugin/path': sync(() => opCaminho(c)); return true;
    case '/plugin/zlib': sync(() => opZlib(c)); return true;
    case '/plugin/hash': sync(() => opHash(c)); return true;
    case '/plugin/escolher': sync(() => janelaArquivos(c.a)); return true;
    case '/plugin/maquina': sync(idMaquina); return true;
    case '/plugin/mostrar': sync(() => mostrarNaPasta(c.caminho)); return true;
    case '/plugin/dns': {
      require('dns').lookup(String(c.host || ''), c.opcoes || {}, (e, end, fam) => json(200, e ? { ok: false, e: erroJSON(e) } : { ok: true, v: [end, fam] }));
      return true;
    }
    case '/plugin/http': json(200, await opHttp(c)); return true;
    case '/plugin/http/corpo': json(200, await opHttpCorpo(c)); return true;
    default: return tratarPlugin2(url, json, c);
  }
}

function origemPermitida(o) { return !!o && (ORIGENS.includes(o) || ORIGEM_DEV.test(o)); }
function cabecalhosCORS(origem) {
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
    Vary: 'Origin',
  };
}
function cabecalhosJSON(origem) { return { ...(origem ? cabecalhosCORS(origem) : {}), 'Content-Type': 'application/json' }; }

function lerCorpo(req, limite = 25 * 1048576) {
  return new Promise((resolve, reject) => {
    let corpo = '', tam = 0;
    req.setEncoding('utf8');
    req.on('data', (c) => { tam += c.length; if (tam > limite) { reject(new Error('corpo grande demais')); req.destroy(); } else corpo += c; });
    req.on('end', () => resolve(corpo));
    req.on('error', reject);
  });
}

const SITE_PAINEL = process.env.ARCANO_SITE_PAINEL || 'https://layers.voxvisual.com.br';   // variável só para teste local
function servirPainel(req, res) {
  const bruto = String(req.url).slice(3);   // /plugin/... ou /painel/...
  const caminho = bruto.split('?')[0];
  if (caminho.includes('..') || caminho.includes('\\') || !/^\/(plugin|painel)\/[A-Za-z0-9._\/-]*$/.test(caminho)) { res.writeHead(404); res.end(); return; }
  const r = (SITE_PAINEL.startsWith('http:') ? require('http') : https).get(SITE_PAINEL + bruto, { headers: { 'User-Agent': 'ArcanoConector/' + VERSAO, 'Accept-Encoding': 'identity' }, timeout: 30000 }, (up) => {
    const h = { 'Content-Type': up.headers['content-type'] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    if (up.headers['content-length']) h['Content-Length'] = up.headers['content-length'];
    res.writeHead(up.statusCode === 200 ? 200 : (up.statusCode || 502), h);
    up.pipe(res);
  });
  r.on('timeout', () => r.destroy(new Error('tempo esgotado')));
  r.on('error', () => { if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); } res.end('Sem internet para abrir o painel do Arcano.'); });
}

async function tratar(req, res) {
  const url = String(req.url).split('?')[0];
  const host = String(req.headers.host || '');
  if (host !== '127.0.0.1:' + portaAtual && host !== 'localhost:' + portaAtual) { res.writeHead(403); res.end(); return; }

  // Claude Code → MCP (sem Origin, com token)
  if (url === '/mcp') {
    if (req.headers.origin || req.headers.authorization !== 'Bearer ' + tokenMCP) { res.writeHead(401); res.end(); return; }
    if (req.method === 'DELETE') { res.writeHead(200); res.end(); return; }
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); res.end(); return; }
    let msg;
    try { msg = JSON.parse(await lerCorpo(req)); } catch (e) { res.writeHead(400, cabecalhosJSON()); res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })); return; }
    const lista = Array.isArray(msg) ? msg : [msg];
    const respostas = (await Promise.all(lista.map(processarRPC))).filter(Boolean);
    if (!respostas.length) { res.writeHead(202); res.end(); return; }
    res.writeHead(200, cabecalhosJSON());
    res.end(JSON.stringify(Array.isArray(msg) ? respostas : respostas[0]));
    return;
  }

  // Painel dentro do programa de PC (Arcano Layers Vídeo/Imagem): a página do plugin servida daqui
  // (mesma origem da API, sem permissão de rede local nem conteúdo misto). Vem do site do Arcano.
  if (req.method === 'GET' && /^\/ui\/(plugin|painel)\//.test(url)) { servirPainel(req, res); return; }
  // a página servida daqui pergunta o /status sem Origin (GET da mesma origem)
  if (req.method === 'GET' && url === '/status' && !req.headers.origin) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ app: 'arcano-conector', versao: VERSAO, so: process.platform }));
    return;
  }

  // Navegador → só das origens do Arcano
  const origem = req.headers.origin;
  if (!origemPermitida(origem)) { res.writeHead(403); res.end(); return; }
  res._origem = origem;
  if (req.method === 'OPTIONS') { res.writeHead(204, cabecalhosCORS(origem)); res.end(); return; }
  const json = (status, obj) => { res.writeHead(status, cabecalhosJSON(origem)); res.end(JSON.stringify(obj)); };

  try {
    if (url.startsWith('/plugin/') && req.method === 'POST') { if (await tratarPlugin(url, json, await lerCorpo(req, 700 * 1048576))) return; }
    if (url === '/status' && req.method === 'GET') { json(200, { app: 'arcano-conector', versao: VERSAO, so: process.platform, claude: await verificarClaudeCode() }); return; }
    if (url === '/claude/instalar' && req.method === 'POST') { instalarClaude(); json(200, { ok: true }); return; }
    if (url === '/claude/login' && req.method === 'POST') { if (!caminhoClaude) await verificarClaudeCode(); json(200, { ok: loginClaude() }); return; }
    if (url === '/chat' && req.method === 'POST') { rodarChat(JSON.parse(await lerCorpo(req)), res); return; }
    if (url === '/chat/parar' && req.method === 'POST') { if (conversa && conversa.processo) { try { conversa.processo.kill(); } catch (e) { /* já parou */ } } json(200, { ok: true }); return; }
    if (url === '/ferramenta/resultado' && req.method === 'POST') {
      const r = JSON.parse(await lerCorpo(req));
      const fn = conversa && conversa.pendentes.get(r.id);
      if (fn) { conversa.pendentes.delete(r.id); fn(r); }
      json(200, { ok: !!fn });
      return;
    }
    json(404, { erro: 'rota desconhecida' });
  } catch (e) {
    log('erro', url, e.message);
    if (!res.headersSent) json(500, { erro: e.message });
  }
}

function escutar(i = 0) {
  if (i >= PORTAS.length) { log('Nenhuma porta livre entre', PORTAS.join(', ')); process.exit(1); }
  const servidor = http.createServer((req, res) => { tratar(req, res).catch((e) => { log('erro', e.message); try { res.end(); } catch (x) { /* fechado */ } }); });
  servidor.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      // Outra cópia do conector já está rodando nessa porta? Então não precisa de duas.
      http.get({ host: '127.0.0.1', port: PORTAS[i], path: '/status', headers: { Origin: ORIGENS[0] }, timeout: 3000 }, (r) => {
        let d = ''; r.on('data', (c) => { d += c; }); r.on('end', () => { if (/arcano-conector/.test(d)) { log('Já existe um Arcano Conector rodando na porta', PORTAS[i]); process.exit(0); } else escutar(i + 1); });
      }).on('error', () => escutar(i + 1));
      return;
    }
    log('erro no servidor', e.message); process.exit(1);
  });
  servidor.listen(PORTAS[i], '127.0.0.1', () => {
    portaAtual = PORTAS[i];
    log('Arcano Conector ' + VERSAO + ' pronto em http://127.0.0.1:' + portaAtual);
  });
}

if (require.main === module) {
  escutar();
  verificarClaudeCode().then((s) => log('Claude Code:', JSON.stringify(s))).catch(() => {});
}

module.exports = { origemPermitida, processarRPC, VERSAO, PORTAS };
