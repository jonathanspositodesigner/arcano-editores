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

const VERSAO = '0.1.0';
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

  // Navegador → só das origens do Arcano
  const origem = req.headers.origin;
  if (!origemPermitida(origem)) { res.writeHead(403); res.end(); return; }
  res._origem = origem;
  if (req.method === 'OPTIONS') { res.writeHead(204, cabecalhosCORS(origem)); res.end(); return; }
  const json = (status, obj) => { res.writeHead(status, cabecalhosJSON(origem)); res.end(JSON.stringify(obj)); };

  try {
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
