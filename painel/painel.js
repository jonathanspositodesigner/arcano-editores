/*
 * ══════════════════════════════════════════════════════════════════════════════
 *  PAINEL ARCANO MOTION — no navegador, ao lado da composição
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Mesmo princípio do plugin do After: a IA é o Claude Code oficial no PC do
 * cliente, com a conta dele. O navegador não roda programa, então o Arcano
 * Conector (app pequeno no PC) faz a ponte:
 *
 *   painel (aqui) ⇄ Arcano Conector (127.0.0.1) ⇄ Claude Code oficial
 *
 * As ferramentas que a IA usa são definidas AQUI e executadas no editor de
 * vídeo pela API dele (window.effectcraft, na página que contém este painel).
 */
(function () {
  'use strict';

  var PORTAS = [47821, 47822, 47823, 47824, 47825];
  var LINK_INSTALADOR = '../downloads/ArcanoConector-Instalador.exe';

  var $ = function (s) { return document.querySelector(s); };
  var base = null;        // http://127.0.0.1:porta do conector
  var statusClaude = null;
  var abaAtual = 'chat';
  var rodando = false;
  var sessao = ler('arcano-sessao');
  var verificando = null;

  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravar(k, v) { try { if (v == null) { localStorage.removeItem(k); } else { localStorage.setItem(k, v); } } catch (e) { /* sem storage */ } }

  // ─── O editor (página de cima) ───
  function editor() {
    try { return window.parent && window.parent.effectcraft; } catch (e) { return null; }
  }
  function esperarEditor(ms) {
    var fim = Date.now() + (ms || 60000);
    return new Promise(function (ok, falha) {
      (function tentar() {
        var ec = editor();
        if (ec) { ok(ec); return; }
        if (Date.now() > fim) { falha(new Error('O editor de vídeo ainda não abriu.')); return; }
        setTimeout(tentar, 400);
      })();
    });
  }

  // ─── Ferramentas que a IA pode usar (o conector repassa as chamadas pra cá) ───
  function texto(v) { return typeof v === 'string' ? v : JSON.stringify(v, null, 1); }
  var FERRAMENTAS = [
    {
      name: 'ae_project_info',
      description: 'Resumo do projeto aberto no editor de vídeo (composições, itens, comp ativa). Use primeiro, para saber o que existe.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      rodar: function (ec) { return ec.execute('project.summary', {}).then(function (r) { return { texto: texto(r) }; }); }
    },
    {
      name: 'ae_comp_info',
      description: 'Detalhes de uma composição (tamanho, duração, fps) e a árvore das camadas. Sem "comp", usa a composição ativa.',
      inputSchema: { type: 'object', properties: { comp: { type: 'string', description: 'nome da composição (opcional)' }, depth: { type: 'number', description: 'profundidade da árvore (padrão 2)' } }, additionalProperties: false },
      rodar: function (ec, a) {
        var p = a.comp ? { comp: a.comp } : {};
        return Promise.all([
          ec.execute('comp.info', p),
          ec.execute('layer.tree', Object.assign({ depth: a.depth || 2 }, p)).catch(function (e) { return { erro: String(e && e.message || e) }; })
        ]).then(function (r) { return { texto: texto({ comp: r[0], camadas: r[1] }) }; });
      }
    },
    {
      name: 'ae_run_jsx',
      description: 'Executa um script no estilo do After Effects (app, app.project, CompItem, Layer, Property, keyframes, expressões). É a ferramenta principal para criar e animar. Cada execução vira um passo de desfazer. Devolve o resultado da última expressão e o que foi impresso com $.writeln.',
      inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'JavaScript estilo ExtendScript do After Effects' } }, required: ['code'], additionalProperties: false },
      rodar: function (ec, a) {
        return ec.execute('script.run', { code: String(a.code || '') }).then(function (r) {
          if (r && r.error) { return { texto: texto(r), erro: true }; }
          return { texto: texto(r) };
        });
      }
    },
    {
      name: 'ae_render_frames',
      description: 'Renderiza um quadro da composição para você VER o resultado (imagem). Use para conferir o que fez.',
      inputSchema: { type: 'object', properties: { time: { type: 'number', description: 'tempo em segundos' }, comp: { type: 'string' }, width: { type: 'number', description: 'largura da imagem (padrão 960)' } }, required: ['time'], additionalProperties: false },
      rodar: function (ec, a) {
        var p = { time: Number(a.time) || 0, width: Math.min(Number(a.width) || 960, 1920) };
        if (a.comp) { p.comp = a.comp; }
        return ec.renderFrame(p).then(function (r) {
          return { texto: 'Quadro em ' + p.time + ' s (' + r.width + 'x' + r.height + ').', imagem: { base64: r.png, mime: 'image/png' } };
        });
      }
    },
    {
      name: 'ec_comandos',
      description: 'Lista comandos nativos do editor (camadas, efeitos, máscaras, câmera, render…). Filtre por palavra, ex.: "effect", "text", "mask".',
      inputSchema: { type: 'object', properties: { filtro: { type: 'string' } }, additionalProperties: false },
      rodar: function (ec, a) {
        return ec.execute('command.list', { filter: a.filtro || '', enabledOnly: false }).then(function (lista) {
          var curta = (lista || []).map(function (c) { return c.id + ' ' + (c.params || ''); }).slice(0, 150);
          return { texto: curta.join('\n') || 'Nenhum comando com esse filtro.' };
        });
      }
    },
    {
      name: 'ec_comando',
      description: 'Executa um comando nativo do editor pelo id (veja ec_comandos), com seus parâmetros.',
      inputSchema: { type: 'object', properties: { command: { type: 'string' }, params: { type: 'object' } }, required: ['command'], additionalProperties: false },
      rodar: function (ec, a) { return ec.execute(String(a.command), a.params || {}).then(function (r) { return { texto: texto(r) }; }); }
    }
  ];

  var INSTRUCOES = [
    'Você é o Arcano Motion, a IA de motion design do ArcanoApp, trabalhando dentro do editor de vídeo do Arcano Layers no navegador do usuário.',
    'O editor é compatível com o After Effects: composições, camadas, keyframes, expressões e um modelo de script igual ao do After (app.project, CompItem, Layer...). Algumas partes do After podem não existir: se um script falhar, leia o erro e ajuste.',
    'Fluxo: comece com ae_project_info (e ae_comp_info) para saber o que existe; crie e anime com ae_run_jsx; confira com ae_render_frames nos momentos importantes; use ec_comandos/ec_comando para recursos nativos.',
    'Responda sempre em português do Brasil, curto e direto. Diga o que fez, não o código.',
    'Organização: nomes claros nas camadas, uma precomp por cena, nada solto.',
    'Texto SEM contorno e SEM sombra. Legibilidade por fonte, peso, contraste e área limpa.',
    'Fonte é primordial: combine com o nicho e o clima da peça, nunca uma fonte genérica de sistema.'
  ].join('\n');

  // ─── Conector ───
  function comTempo(p, ms) {
    return new Promise(function (ok, falha) {
      var t = setTimeout(function () { falha(new Error('tempo esgotado')); }, ms);
      p.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); falha(e); });
    });
  }
  function acharConector() {
    var tentativas = PORTAS.map(function (porta) {
      var url = 'http://127.0.0.1:' + porta;
      return comTempo(fetch(url + '/status', { cache: 'no-store' }), 20000)
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.app === 'arcano-conector') { return { url: url, status: j }; } throw new Error('outro programa'); });
    });
    return new Promise(function (ok) {
      var restantes = tentativas.length, achou = false;
      tentativas.forEach(function (t) {
        t.then(function (r) { if (!achou) { achou = true; ok(r); } })
          .catch(function () { restantes--; if (!restantes && !achou) { ok(null); } });
      });
    });
  }
  function postar(caminho, corpo) {
    return fetch(base + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) })
      .then(function (r) { return r.json(); });
  }

  // ─── Configuração (conector → Claude Code → login) ───
  function marcarPassos(atual) {
    var ordem = ['conector', 'claude', 'login'], i = ordem.indexOf(atual);
    document.querySelectorAll('.passo').forEach(function (el) {
      var j = ordem.indexOf(el.dataset.passo);
      el.classList.toggle('feito', i < 0 || j < i);
      el.classList.toggle('atual', j === i);
    });
  }
  var telaMostrada = '';  // evita redesenhar a mesma tela a cada consulta ao conector
  function corpoConfigurar(html, chave) { $('#configurar-corpo').innerHTML = html; telaMostrada = chave || ''; }

  function verificar() {
    if (verificando) { return verificando; }
    verificando = acharConector().then(function (r) {
      verificando = null;
      if (!r) { base = null; statusClaude = null; mostrar(); return; }
      base = r.url; statusClaude = r.status.claude || {};
      mostrar();
    });
    return verificando;
  }

  // ─── Passo 1: conector (baixar → instalar → liberar o Chrome), com tutorial ───
  // O Chrome pede licença para o site falar com programas do próprio PC. Sem ela o painel
  // nunca acha o conector, então o passo a passo ensina a liberar (com desenho da tela).
  var ETAPA = 'arcano-conector-etapa';
  function etapa(v) {
    try { if (v) { localStorage.setItem(ETAPA, v); } return localStorage.getItem(ETAPA) || 'baixar'; } catch (e) { return v || 'baixar'; }
  }
  function permissaoRede() {
    if (!navigator.permissions || !navigator.permissions.query) { return Promise.resolve('?'); }
    var nomes = ['loopback-network', 'local-network-access'], estados = [];
    return Promise.all(nomes.map(function (n) {
      return navigator.permissions.query({ name: n }).then(function (p) { estados.push(p.state); }, function () { /* não existe neste Chrome */ });
    })).then(function () {
      if (estados.indexOf('denied') >= 0) { return 'denied'; }
      if (estados.indexOf('prompt') >= 0) { return 'prompt'; }
      return estados.length ? 'granted' : '?';
    });
  }
  function recarregarTudo() { try { window.top.location.reload(); } catch (e) { location.reload(); } }

  var DESENHO_PERGUNTA =
    '<div class="tela-chrome"><div class="barra"><span class="icone-site">⚙</span><span class="url">layers.voxvisual.com.br</span></div>' +
    '<div class="balao"><b>layers.voxvisual.com.br quer</b><span>Acessar outros apps e serviços neste dispositivo</span>' +
    '<div class="balao-bt"><span class="bt-falso">Bloquear</span><span class="bt-falso sim alvo">Permitir</span></div></div></div>';
  var DESENHO_DESBLOQUEAR =
    '<div class="tela-chrome"><div class="barra"><span class="icone-site alvo">⚙</span><span class="url">layers.voxvisual.com.br</span></div>' +
    '<div class="balao"><b>layers.voxvisual.com.br</b>' +
    '<span class="linha-menu">🔒 A ligação é segura</span>' +
    '<span class="linha-menu">Pop-ups e redirecionamentos <i class="interruptor ligado"></i></span>' +
    '<span class="linha-menu alvo2">🖥 Apps no dispositivo <i class="interruptor"></i></span></div></div>';

  function telaConector() {
    var e = etapa();
    var cab = '<div class="mini-passos">' + ['Baixar', 'Instalar', 'Liberar o Chrome'].map(function (t, i) {
      var k = ['baixar', 'instalar', 'liberar'][i], at = ['baixar', 'instalar', 'liberar'].indexOf(e);
      return '<span class="' + (i < at ? 'feito' : i === at ? 'atual' : '') + '">' + (i + 1) + '. ' + t + '</span>';
    }).join('') + '</div>';

    if (e === 'baixar') {
      corpoConfigurar(cab +
        '<h3>Instale o Arcano Conector</h3>' +
        '<p>É um app pequeno que liga este painel ao Claude do seu computador. Você instala uma vez só.</p>' +
        '<div class="botoes"><a class="pri" id="b-baixar" href="' + LINK_INSTALADOR + '" download>Baixar o instalador (Windows)</a>' +
        '<button class="sec" id="b-ja">Já tenho instalado</button></div>', 'conector:baixar');
      $('#b-baixar').onclick = function () { setTimeout(function () { etapa('instalar'); telaConector(); }, 300); };
      $('#b-ja').onclick = function () { etapa('liberar'); telaConector(); };
      return;
    }
    if (e === 'instalar') {
      corpoConfigurar(cab +
        '<h3>Abra o instalador</h3>' +
        '<ol class="tuto">' +
        '<li>Clique no arquivo <b>ArcanoConector-Instalador.exe</b> que baixou (fica nos downloads do Chrome, no canto de cima).</li>' +
        '<li>Se aparecer <b>“O Windows protegeu o computador”</b>, clique em <b>Mais informações</b> e depois em <b>Executar assim mesmo</b>.</li>' +
        '<li>Clique em <b>Instalar</b> e depois em <b>Concluir</b>.</li>' +
        '</ol>' +
        '<div class="botoes"><button class="pri" id="b-instalei">Já instalei</button>' +
        '<a class="sec" href="' + LINK_INSTALADOR + '" download>Baixar de novo</a></div>', 'conector:instalar');
      $('#b-instalei').onclick = function () { etapa('liberar'); telaConector(); };
      return;
    }
    // liberar
    telaMostrada = 'conector:liberar';
    permissaoRede().then(function (estado) {
      if (etapa() !== 'liberar' || base) { return; }
      if (estado === 'denied') {
        corpoConfigurar(cab +
          '<h3>Destrave o Chrome</h3>' +
          '<p>O Chrome está <b>bloqueando</b> este site de falar com o conector do seu PC. Para liberar:</p>' +
          DESENHO_DESBLOQUEAR +
          '<ol class="tuto">' +
          '<li>Clique no ícone <b>à esquerda do endereço</b> do site, lá em cima (o desenho mostra onde).</li>' +
          '<li>Na janelinha que abre, <b>ligue a chave “Apps no dispositivo”</b> (fica azul/verde).</li>' +
          '<li>Volte aqui e clique em <b>Recarregar</b>.</li>' +
          '</ol>' +
          '<div class="botoes"><button class="pri" id="b-recarregar">Recarregar</button><button class="sec" id="b-voltar-inst">Ainda não instalei</button></div>', 'conector:liberar:bloqueado');
        $('#b-recarregar').onclick = recarregarTudo;
      } else {
        corpoConfigurar(cab +
          '<h3>Libere o Chrome</h3>' +
          '<p>Clique em <b>Conectar</b>. O Chrome vai mostrar um aviso lá em cima, perto do endereço do site: clique em <b>Permitir</b>.</p>' +
          DESENHO_PERGUNTA +
          '<div class="botoes"><button class="pri" id="b-conectar">Conectar</button><button class="sec" id="b-voltar-inst">Ainda não instalei</button></div>' +
          '<p class="nota">Não apareceu aviso? Clique no ícone à esquerda do endereço do site e <b>ligue a chave “Apps no dispositivo”</b>. Depois clique em Conectar de novo.</p>' +
          '<p class="nota" id="conectando"></p>', 'conector:liberar');
        $('#b-conectar').onclick = function () {
          // O pedido sai do clique: é isso que faz o Chrome mostrar o aviso de permissão.
          $('#conectando').textContent = 'Procurando o conector… se o Chrome perguntar, clique em Permitir.';
          verificar().then(function () {
            if (base) { return; }
            permissaoRede().then(function (st) {
              if (st === 'denied') { telaConector(); return; }
              $('#conectando').innerHTML = 'Ainda não achei o conector. Confira se você terminou a instalação (o instalador diz <b>Pronto!</b> no fim) e clique em Conectar de novo.';
            });
          });
        };
      }
      var v = $('#b-voltar-inst');
      if (v) { v.onclick = function () { etapa('instalar'); telaConector(); }; }
    });
  }

  // Muda a tela sozinho quando a pessoa libera ou bloqueia no Chrome.
  try {
    ['loopback-network', 'local-network-access'].forEach(function (n) {
      navigator.permissions.query({ name: n }).then(function (p) {
        p.onchange = function () { if (!base) { if (p.state === 'granted') { verificar(); } else { telaConector(); } } };
      }, function () {});
    });
  } catch (e) { /* sem API de permissões */ }

  var repetir = null;
  function verificarDeTempos(ms) {
    clearInterval(repetir);
    repetir = setInterval(function () {
      verificar().then(function () { if (pronto()) { clearInterval(repetir); } });
    }, ms || 4000);
  }

  function pronto() { return !!(base && statusClaude && statusClaude.instalado && statusClaude.logado); }

  function telaConfigurar() {
    if (!base) {
      marcarPassos('conector');
      if (telaMostrada.indexOf('conector:' + etapa()) !== 0) { telaConector(); }
      verificarDeTempos(4000);
      return;
    }
    if (!statusClaude.instalado) {
      marcarPassos('claude');
      corpoConfigurar(
        '<h3>Instalar o Claude Code</h3>' +
        '<p>' + (statusClaude.mensagem || 'O Claude Code não está neste computador.') + ' Vamos instalar com o instalador oficial da Anthropic.</p>' +
        '<div class="botoes"><button class="pri" id="b-instalar">Instalar o Claude Code</button></div>' +
        '<p class="nota">Abre uma janela no seu PC. Quando terminar, este painel segue sozinho.</p>');
      $('#b-instalar').onclick = function () { postar('/claude/instalar'); this.disabled = true; this.textContent = 'Instalando… aguarde'; verificarDeTempos(5000); };
      return;
    }
    marcarPassos('login');
    corpoConfigurar(
      '<h3>Entrar no Claude</h3>' +
      '<p>' + (statusClaude.mensagem || 'Falta fazer login.') + ' Entre com a conta do seu plano <b>Pro ou Max</b>.</p>' +
      '<div class="botoes"><button class="pri" id="b-login">Fazer login no Claude</button></div>' +
      '<p class="nota">Abre o navegador para você autorizar. O login fica só no seu PC.</p>');
    $('#b-login').onclick = function () { postar('/claude/login'); this.disabled = true; this.textContent = 'Esperando o login…'; verificarDeTempos(4000); };
  }

  function telaConta() {
    var c = $('#conta-corpo');
    if (!base) { c.innerHTML = '<h3>Conta</h3><p>Arcano Conector não encontrado neste computador.</p>'; return; }
    var s = statusClaude || {};
    c.innerHTML =
      '<h3>Conta</h3>' +
      '<p><span class="ok">●</span> Arcano Conector conectado</p>' +
      '<p>Claude Code ' + (s.versao || '') + (s.logado ? ' · <span class="ok">logado</span>' + (s.email ? ' como ' + s.email : '') : ' · sem login') + '</p>' +
      (s.aviso ? '<div class="aviso">' + s.aviso + '</div>' : '') +
      '<div class="botoes"><button class="sec" id="b-relogin">Entrar com outra conta</button><button class="sec" id="b-reverificar">Verificar de novo</button></div>';
    $('#b-relogin').onclick = function () { postar('/claude/login'); verificarDeTempos(4000); };
    $('#b-reverificar').onclick = function () { verificar(); };
  }

  function mostrar() {
    document.querySelectorAll('.abas button').forEach(function (b) { b.classList.toggle('ativa', b.dataset.aba === abaAtual); });
    var precisaConfigurar = !pronto();
    $('#configurar').hidden = !(abaAtual === 'chat' && precisaConfigurar);
    $('#chat').hidden = !(abaAtual === 'chat' && !precisaConfigurar);
    $('#conta').hidden = abaAtual !== 'conta';
    if (abaAtual === 'chat' && precisaConfigurar) { telaConfigurar(); }
    if (abaAtual === 'conta') { telaConta(); }
    if (statusClaude && statusClaude.aviso && pronto() && !document.getElementById('aviso-chave')) {
      var a = document.createElement('div'); a.className = 'aviso'; a.id = 'aviso-chave'; a.textContent = statusClaude.aviso;
      $('#mensagens').prepend(a);
    }
    if (!$('#mensagens').children.length) {
      $('#mensagens').innerHTML = '<div class="vazio"><b>O que vamos animar?</b>Peça em português: "anima esse título entrando de baixo", "faz uma vinheta de 5 segundos com o logo"…</div>';
    }
  }

  // ─── Chat ───
  function adicionar(classe, conteudo) {
    var vazio = $('#mensagens .vazio'); if (vazio) { vazio.remove(); }
    var el = document.createElement('div'); el.className = classe; el.textContent = conteudo;
    $('#mensagens').appendChild(el); $('#mensagens').scrollTop = 1e9;
    return el;
  }

  function nomeFerramenta(n) { return String(n || '').replace(/^mcp__arcano__/, ''); }
  var ROTULOS = { ae_project_info: 'lendo o projeto', ae_comp_info: 'lendo a composição', ae_run_jsx: 'animando', ae_render_frames: 'conferindo o quadro', ec_comandos: 'procurando comandos', ec_comando: 'usando um recurso do editor' };

  function executarFerramenta(m) {
    var f = FERRAMENTAS.filter(function (x) { return x.name === m.nome; })[0];
    var p = !f ? Promise.resolve({ texto: 'Ferramenta desconhecida: ' + m.nome, erro: true })
      : esperarEditor(30000).then(function (ec) { return f.rodar(ec, m.args || {}); });
    p.catch(function (e) { return { texto: 'Erro: ' + (e && e.message || e), erro: true }; })
      .then(function (r) { return postar('/ferramenta/resultado', { id: m.id, texto: r.texto, imagem: r.imagem, erro: !!r.erro }); })
      .catch(function () { /* conector caiu: o fim da conversa avisa */ });
  }

  function enviar(pedido) {
    if (rodando || !pedido.trim()) { return; }
    rodando = true; $('#enviar').textContent = 'Parar'; $('#enviar').classList.add('rodando');
    adicionar('msg eu', pedido);
    var bolha = null, pensando = adicionar('pensando', 'pensando…');

    fetch(base + '/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedido: pedido, instrucoes: INSTRUCOES, sessao: sessao, modelo: $('#modelo').value,
        ferramentas: FERRAMENTAS.map(function (f) { return { name: f.name, description: f.description, inputSchema: f.inputSchema }; })
      })
    }).then(function (r) {
      if (!r.ok || !r.body) { return r.json().then(function (j) { throw new Error(j.erro || ('HTTP ' + r.status)); }); }
      var leitor = r.body.getReader(), dec = new TextDecoder(), buf = '';
      function tratar(m) {
        if (m.tipo === 'ferramenta') { executarFerramenta(m); return; }
        if (m.tipo === 'evento') {
          var e = m.e;
          if (e.type === 'system' && e.subtype === 'init' && e.session_id) { sessao = e.session_id; gravar('arcano-sessao', sessao); }
          if (e.type === 'assistant' && e.message && e.message.content) {
            e.message.content.forEach(function (b) {
              if (b.type === 'text' && b.text) { bolha = adicionar('msg ia', b.text); }
              if (b.type === 'tool_use') { adicionar('ferr', ROTULOS[nomeFerramenta(b.name)] || nomeFerramenta(b.name)); }
            });
            $('#mensagens').appendChild(pensando);
          }
          if (e.type === 'result' && e.is_error) { adicionar('msg erro', e.result || 'A IA parou com erro.'); }
          return;
        }
        if (m.tipo === 'fim') {
          if (!m.ok && m.erro) {
            var t = String(m.erro);
            if (/login|oauth|401|authenticate/i.test(t)) { statusClaude.logado = false; mostrar(); }
            adicionar('msg erro', 'A conversa parou: ' + t.slice(-300));
          }
        }
      }
      function ler() {
        return leitor.read().then(function (x) {
          if (x.done) { return; }
          buf += dec.decode(x.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            var bloco = buf.slice(0, i); buf = buf.slice(i + 2);
            if (bloco.indexOf('data: ') === 0) { try { tratar(JSON.parse(bloco.slice(6))); } catch (err) { /* linha estranha */ } }
          }
          return ler();
        });
      }
      return ler();
    }).catch(function (e) {
      adicionar('msg erro', 'Não consegui falar com o Arcano Conector: ' + (e && e.message || e));
      verificar();
    }).then(function () {
      rodando = false; pensando.remove();
      $('#enviar').textContent = 'Enviar'; $('#enviar').classList.remove('rodando');
    });
  }

  // ─── Eventos ───
  document.querySelectorAll('.abas button').forEach(function (b) { b.onclick = function () { abaAtual = b.dataset.aba; mostrar(); }; });
  $('#form-chat').onsubmit = function (ev) {
    ev.preventDefault();
    if (rodando) { postar('/chat/parar'); return; }
    var t = $('#pedido').value; $('#pedido').value = ''; enviar(t);
  };
  $('#pedido').onkeydown = function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); $('#form-chat').requestSubmit(); } };
  $('#nova').onclick = function () { sessao = null; gravar('arcano-sessao', null); $('#mensagens').innerHTML = ''; mostrar(); };
  var modeloSalvo = ler('arcano-modelo'); if (modeloSalvo) { $('#modelo').value = modeloSalvo; }
  $('#modelo').onchange = function () { gravar('arcano-modelo', this.value); };

  corpoConfigurar('<p>Procurando o Arcano Conector no seu computador…</p>');
  $('#configurar').hidden = false;
  verificar();
})();
