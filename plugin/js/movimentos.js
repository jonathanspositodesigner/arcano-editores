/* Arcano Motion 1.0.30 — Biblioteca de movimentos da aba Animar.
   Texto e loops: EXPRESSÕES que leem os marcadores "Ini <nome>" e "Fim <nome>" da camada (começam na agulha;
   arrastar os marcadores muda quando começa e a velocidade). Transições: começam na agulha, com o marcador
   "Corte" no meio. Cada item tem "ops" (as configurações da tela do efeito e da aba Editar) e "sp" (a receita
   que o motor do After usa: am.movimento em jsx/arcano.jsx). A prévia do painel usa as mesmas contas.

   TEXTO (tipo 'txt'): base 2 letras · 3 palavras · 4 linhas; S = quanto as unidades se espalham no tempo (0 = o
   bloco junto); curva 'suave' | 'salto' (passa do ponto e volta) | 'quique'; an = animadores:
     { k: 'base', pr }                 todas as unidades com a mesma curva
     { k: 'disp', pr, hz }             cada unidade numa direção sorteada (hz > 0: treme enquanto chega e para)
     { k: 'piscar', pr }               pisca enquanto a unidade está chegando
     { k: 'decode', pisca }            letras sorteadas trocando até formar o texto
   pr: o opacidade · p [x, y] em % do tamanho da fonte · pc [x, y] em fração da comp · s escala % · r graus ·
       t espaçamento · b desfoque · sk inclinação */
(function () {
  var OP_MODO = ['modo', 'Quando', 's', 'entrada', [['entrada', 'Entrada'], ['saida', 'Saída'], ['ambos', 'Entrada e saída']]];
  var OP_INT = ['intensidade', 'Intensidade', 'n', 100, 10, 300, '%'];
  var OP_VEL = ['velocidade', 'Velocidade', 'n', 100, 20, 400, '%'];
  var OP_ORDEM = ['ordem', 'Ordem', 's', 'esq', [['esq', 'Esq → dir'], ['dir', 'Dir → esq'], ['centro', 'Do centro'], ['rand', 'Sorteada']]];
  var OP_ESC = ['escalonamento', 'Atraso entre camadas', 'n', 0, 0, 120, 'frames'];

  // ---------------- texto: entradas e saídas ----------------
  function TX(id, nome, desc, dur, sp) {
    var ops = [OP_MODO, OP_INT, OP_VEL];
    if (sp.S > 0) { ops.push(['ordem', 'Ordem', 's', sp.ordem || 'esq', OP_ORDEM[4]]); }
    ops.push(OP_ESC);
    sp.tipo = 'txt'; sp.dur = dur;
    return { id: id, nome: nome, desc: desc, dur: dur, sp: sp, ops: ops };
  }
  var TXT = [
    TX('mv-t-fade-letra', 'Fade Letra a Letra', 'As letras acendem uma por uma, suave.', 1.2, { base: 2, S: 0.75, curva: 'suave', an: [{ k: 'base', pr: { o: 0 } }] }),
    TX('mv-t-fade-bloco', 'Fade em Bloco', 'O texto aparece todo junto, suave.', 0.8, { base: 2, S: 0, curva: 'suave', an: [{ k: 'base', pr: { o: 0 } }] }),
    TX('mv-t-caindo-girando', 'Letras Caindo Girando', 'Cada letra cai de cima girando e encaixa.', 1.4, { base: 2, S: 0.7, curva: 'salto', an: [{ k: 'base', pr: { o: 0, p: [0, -120], r: -90 } }] }),
    TX('mv-t-espalhadas', 'Letras Espalhadas', 'As letras vêm de pontos espalhados da tela e se juntam formando o texto.', 1.6, { base: 2, S: 0.25, curva: 'suave', ordem: 'rand', an: [{ k: 'base', pr: { o: 0, s: 40 } }, { k: 'disp', pr: { pc: [0.45, 0.4] } }, { k: 'disp', pr: { r: 140 } }] }),
    TX('mv-t-salto', 'Letras com Salto', 'Cada letra sobe, passa do ponto e volta, em cascata.', 1.2, { base: 2, S: 0.7, curva: 'salto', an: [{ k: 'base', pr: { o: 0, p: [0, 80] } }] }),
    TX('mv-t-salto-escala', 'Letras com Salto e Escala', 'Sobem crescendo, passam do ponto e assentam.', 1.2, { base: 2, S: 0.7, curva: 'salto', an: [{ k: 'base', pr: { o: 0, s: 0, p: [0, 60] } }] }),
    TX('mv-t-escala', 'Escala Letra a Letra', 'Cada letra cresce do zero, em sequência.', 1.1, { base: 2, S: 0.7, curva: 'suave', an: [{ k: 'base', pr: { s: 0 } }] }),
    TX('mv-t-escala-rand', 'Escala Aleatória', 'As letras crescem do zero em ordem sorteada.', 1.1, { base: 2, S: 0.7, curva: 'suave', ordem: 'rand', an: [{ k: 'base', pr: { s: 0 } }] }),
    TX('mv-t-pop', 'Pop Letra a Letra', 'Cada letra estoura maior e volta, em sequência.', 1.1, { base: 2, S: 0.7, curva: 'salto', F: 1.6, an: [{ k: 'base', pr: { s: 0, o: 0 } }] }),
    TX('mv-t-escala-espaco', 'Escala com Espaçamento', 'O texto entra largo, com as letras afastadas, e se fecha.', 1.3, { base: 2, S: 0, curva: 'suave', an: [{ k: 'base', pr: { t: 400, s: 120, o: 0 } }] }),
    TX('mv-t-decode-pisca', 'Decodificação Piscando', 'Letras sorteadas piscam e trocam até formar o texto certo.', 1.8, { base: 2, S: 1, curva: 'suave', an: [{ k: 'decode', pisca: true }] }),
    TX('mv-t-decode', 'Decodificação', 'Letras sorteadas trocam rápido até virar o texto certo.', 1.5, { base: 2, S: 1, curva: 'suave', an: [{ k: 'decode' }] }),
    TX('mv-t-linhas-sobem', 'Linhas Sobem', 'Cada linha sobe de baixo no seu tempo.', 1.2, { base: 4, S: 0.5, curva: 'suave', an: [{ k: 'base', pr: { o: 0, p: [0, 110] } }] }),
    TX('mv-t-linhas-deslizam', 'Linhas Deslizam', 'Cada linha entra pela lateral.', 1.2, { base: 4, S: 0.5, curva: 'suave', an: [{ k: 'base', pr: { o: 0, p: [-200, 0] } }] }),
    TX('mv-t-palavras-caem', 'Palavras Caem com Salto', 'Cada palavra cai de cima e quica no lugar.', 1.5, { base: 3, S: 0.6, curva: 'quique', an: [{ k: 'base', pr: { o: 0, p: [0, -180] } }] }),
    TX('mv-t-palavras-girando', 'Palavras Girando', 'As palavras sobem girando devagar e se alinham.', 1.8, { base: 3, S: 0.55, curva: 'suave', an: [{ k: 'base', pr: { o: 0, p: [0, 90], r: 60 } }] }),
    TX('mv-t-tremendo-girando', 'Letras Tremendo e Girando', 'As letras chegam tremendo e girando e param no lugar.', 1.5, { base: 2, S: 0.6, curva: 'suave', ordem: 'rand', an: [{ k: 'base', pr: { o: 0 } }, { k: 'disp', pr: { p: [60, 60] }, hz: 4 }, { k: 'disp', pr: { r: 50 }, hz: 4 }] }),
    TX('mv-t-agitadas', 'Agitadas Aleatórias', 'As letras chegam crescendo e tremendo, em ordem sorteada, e param no lugar.', 1.5, { base: 2, S: 0.6, curva: 'suave', ordem: 'rand', an: [{ k: 'base', pr: { s: 0, o: 0 } }, { k: 'disp', pr: { p: [50, 50] }, hz: 3 }] }),
    TX('mv-t-escala-linha', 'Escala de Linha', 'Cada linha cresce do zero.', 1.2, { base: 4, S: 0.5, curva: 'suave', an: [{ k: 'base', pr: { s: 0 } }] }),
    TX('mv-t-escala-agitada', 'Escala Agitada', 'As letras crescem pulsando em tamanhos diferentes e assentam.', 1.4, { base: 2, S: 0.6, curva: 'suave', ordem: 'rand', an: [{ k: 'base', pr: { s: 0 } }, { k: 'disp', pr: { s: 160 }, hz: 3 }] }),
    TX('mv-t-fade-agitado', 'Fade Agitado', 'As letras acendem piscando, em ordem sorteada.', 1.4, { base: 2, S: 0.7, curva: 'suave', ordem: 'rand', an: [{ k: 'base', pr: { o: 0 } }, { k: 'piscar', pr: { o: 0 } }] }),
    TX('mv-t-fade-sobe', 'Fade e Sobe', 'Cada linha aparece subindo.', 1.2, { base: 4, S: 0.5, curva: 'suave', an: [{ k: 'base', pr: { o: 0, p: [0, 60] } }] }),
    TX('mv-t-deslize-lateral', 'Deslize Lateral', 'O texto inteiro desliza de lado com rastro de desfoque.', 1, { base: 2, S: 0, curva: 'suave', an: [{ k: 'base', pr: { p: [-220, 0], b: 30, o: 0 } }] }),
    TX('mv-t-deslize-vertical', 'Deslize Vertical', 'O texto inteiro sobe de baixo.', 1, { base: 2, S: 0, curva: 'suave', an: [{ k: 'base', pr: { p: [0, 150], o: 0 } }] }),
    TX('mv-t-escala-pos-rand', 'Escala e Posição Aleatória', 'As letras chegam de lugares sorteados, crescendo.', 1.5, { base: 2, S: 0.5, curva: 'suave', ordem: 'rand', an: [{ k: 'base', pr: { s: 0, o: 0 } }, { k: 'disp', pr: { pc: [0.3, 0.3] } }] }),
    TX('mv-t-espaco-linha', 'Espaçamento Linha a Linha', 'Cada linha entra larga e se fecha.', 1.3, { base: 4, S: 0.5, curva: 'suave', an: [{ k: 'base', pr: { t: 600, o: 0 } }] }),
    TX('mv-t-espaco-agitado', 'Espaçamento Agitado', 'O texto entra largo e tremendo e se fecha.', 1.3, { base: 2, S: 0, curva: 'suave', an: [{ k: 'base', pr: { t: 500, o: 0 } }, { k: 'disp', pr: { p: [20, 20] }, hz: 5 }] })
  ];

  // ---------------- texto: loops (da agulha até o fim da camada) ----------------
  function TL(id, nome, desc, sp) { sp.tipo = 'txtloop'; return { id: id, nome: nome, desc: desc, sp: sp, ops: [OP_INT, OP_VEL] }; }
  var TXTLOOP = [
    TL('mv-tl-decode', 'Decodificação Contínua', 'O texto fica legível e, de vez em quando, uma letra troca rápido e volta.', { loop: 'decode', chance: 0.07 }),
    TL('mv-tl-decode-pisca', 'Decodificação Piscando Contínua', 'O texto fica legível e algumas letras trocam piscando e voltam.', { loop: 'decode', chance: 0.09, pisca: true }),
    TL('mv-tl-fade-agitado', 'Fade Agitado Contínuo', 'O texto fica legível e uma letra ou outra pisca de leve.', { loop: 'fade', chance: 0.1 }),
    TL('mv-tl-inclinacao', 'Inclinação Tremida', 'O texto entorta pros lados, nervoso.', { loop: 'skew' }),
    TL('mv-tl-turbulenta', 'Distorção Turbulenta', 'As bordas das letras tremem como desenho animado.', { loop: 'turb' }),
    TL('mv-tl-inquietas', 'Letras Inquietas', 'Cada letra treme e inclina de leve, sozinha.', { loop: 'inquietas' }),
    TL('mv-tl-ondulando', 'Letras Ondulando', 'As letras sobem e descem em onda.', { loop: 'onda' })
  ];

  // ---------------- loops de movimento (objeto) ----------------
  var OP_ANCORA = ['ancora', 'Ponto de âncora', 's', 'topo', [['topo', 'Topo'], ['centro', 'Centro'], ['base', 'Base'], ['esquerda', 'Esquerda'], ['direita', 'Direita']]];
  var LOOP = [
    { id: 'mv-balanco-lateral', nome: 'Balanço Lateral', desc: 'Balança de um lado pro outro, solto.', sp: { tipo: 'loop', loop: 'balanco' },
      ops: [['amplitude', 'Amplitude', 'n', 30, 1, 1000, 'px'], ['velocidade', 'Velocidade', 'n', 2, 0.1, 20, 'vezes/s']] },
    { id: 'mv-onda-gira-escala', nome: 'Onda Gira e Escala', desc: 'Sobe, desce, gira e pulsa em ritmo regular.', sp: { tipo: 'loop', loop: 'onda' }, ops: [OP_INT, OP_VEL] },
    { id: 'mv-quique', nome: 'Quique', desc: 'Quica no lugar como bola, amassando ao tocar o chão.', sp: { tipo: 'loop', loop: 'quique' },
      ops: [['altura', 'Altura do quique', 'n', 80, 1, 2000, 'px'], ['velocidade', 'Velocidade', 'n', 1.5, 0.1, 10, 'quiques/s'], ['amassar', 'Amassar ao tocar o chão', 'b', true]] },
    { id: 'mv-quique-balanco', nome: 'Quique com Balanço', desc: 'Quica e vai de um lado pro outro.', sp: { tipo: 'loop', loop: 'quiqueBalanco' },
      ops: [['altura', 'Altura do quique', 'n', 70, 1, 2000, 'px'], ['largura', 'Distância para os lados', 'n', 60, 0, 2000, 'px'], ['velocidade', 'Velocidade', 'n', 1.5, 0.1, 10, 'quiques/s']] },
    { id: 'mv-flutuacao', nome: 'Flutuação', desc: 'Flutua suave subindo, descendo e inclinando.', sp: { tipo: 'loop', loop: 'flutuacao' }, ops: [OP_INT, OP_VEL] },
    { id: 'mv-pendulo', nome: 'Pêndulo', desc: 'Balança preso num ponto, como pêndulo. Escolha onde fica preso e para onde balança.', sp: { tipo: 'loop', loop: 'pendulo' },
      ops: [OP_ANCORA, ['movimento', 'Balança', 's', 'lado', [['lado', 'Para os lados'], ['frente', 'Pra frente e pra trás (3D)']]], ['angulo', 'Ângulo', 'n', 15, 1, 90, '°'], ['velocidade', 'Velocidade', 'n', 0.8, 0.05, 10, 'balanços/s'], ['amortecimento', 'Perde força com o tempo', 'n', 0, 0, 3]] },
    { id: 'mv-pulsacao', nome: 'Pulsação', desc: 'Cresce e diminui sem parar, como coração batendo.', sp: { tipo: 'loop', loop: 'pulsacao' },
      ops: [['intensidade', 'Quanto cresce', 'n', 8, 1, 100, '%'], ['velocidade', 'Velocidade', 'n', 1.2, 0.1, 10, 'batidas/s']] }
  ];

  // ---------------- transições (começam na agulha; o corte fica no meio, no marcador "Corte") ----------------
  var OP_TDUR = ['duracao', 'Duração', 'n', 1, 0.2, 10, 's'];
  var OP_COR1 = ['cor1', 'Cor 1', 'cor', '#7d5cf0'], OP_COR2 = ['cor2', 'Cor 2', 'cor', '#ff6a1a'];
  var OP_DIR4 = ['direcao', 'Direção', 's', 'esquerda', [['esquerda', '←'], ['direita', '→'], ['cima', '↑'], ['baixo', '↓']]];
  var OP_DIR2 = ['direcao', 'Vem de', 's', 'esquerda', [['esquerda', 'Esquerda'], ['direita', 'Direita']]];
  function TR(id, nome, desc, sp, ops) { sp.tipo = 'tr'; return { id: id, nome: nome, desc: desc, sp: sp, ops: ops }; }
  var TR_CAM = [
    TR('mv-tr-fade-preto', 'Fade pro Preto', 'Escurece até o preto e clareia na próxima cena.', { fam: 'cam', mov: 'preto' }, [OP_TDUR]),
    TR('mv-tr-chicote', 'Chicote', 'A imagem corre de lado com desfoque de movimento forte e para na próxima.', { fam: 'cam', mov: 'chicote' }, [OP_TDUR, OP_DIR4, OP_INT]),
    TR('mv-tr-giro', 'Giro', 'A imagem gira rápido com desfoque e a próxima entra terminando o giro.', { fam: 'cam', mov: 'giro' }, [OP_TDUR, ['sentido', 'Sentido', 's', 'horario', [['horario', 'Horário'], ['anti', 'Anti-horário']]], OP_INT]),
    TR('mv-tr-tremida', 'Tremida com Distorção', 'Sacode e entorta a imagem no corte.', { fam: 'cam', mov: 'tremida' }, [OP_TDUR, OP_INT]),
    TR('mv-tr-zoom-in', 'Zoom Pra Dentro', 'Avança a câmera com desfoque de movimento até a próxima cena.', { fam: 'cam', mov: 'zin' }, [OP_TDUR, OP_INT]),
    TR('mv-tr-zoom-out', 'Zoom Pra Fora', 'Recua a câmera com desfoque de movimento.', { fam: 'cam', mov: 'zout' }, [OP_TDUR, OP_INT]),
    TR('mv-tr-zoom-out-dist', 'Zoom Pra Fora Distorcido', 'Recua com efeito olho de peixe.', { fam: 'cam', mov: 'zout', dist: true }, [OP_TDUR, OP_INT]),
    TR('mv-tr-zoom-giro', 'Zoom e Giro', 'Recua girando, com desfoque.', { fam: 'cam', mov: 'zout', giro: true }, [OP_TDUR, OP_INT]),
    TR('mv-tr-redemoinho', 'Zoom Redemoinho', 'Avança torcendo a imagem em espiral.', { fam: 'cam', mov: 'zin', twirl: true }, [OP_TDUR, OP_INT])
  ];
  var TR_GLITCH = [TR('mv-tr-glitch', 'Glitch Digital', 'Cortes de faixas, cores invertidas e tremida no corte.', { fam: 'glitch' }, [OP_TDUR, OP_INT])];
  var TR_LUZ = [
    TR('mv-tr-luz-1', 'Vazamento de Luz 1', 'Luz laranja quente invade a tela e revela a próxima cena.', { fam: 'luz', v: 1 }, [OP_TDUR, OP_INT]),
    TR('mv-tr-luz-2', 'Vazamento de Luz 2', 'Clarão creme que estoura a tela inteira.', { fam: 'luz', v: 2 }, [OP_TDUR, OP_INT]),
    TR('mv-tr-luz-3', 'Vazamento de Luz 3', 'Luz rosa e lilás entrando pela lateral.', { fam: 'luz', v: 3 }, [OP_TDUR, OP_INT]),
    TR('mv-tr-luz-4', 'Vazamento de Luz 4', 'Luz rosa e laranja suave, em ondas.', { fam: 'luz', v: 4 }, [OP_TDUR, OP_INT])
  ];
  var TR_FORMA = [
    TR('mv-tr-circulos-centro', 'Círculos do Centro', 'Dois círculos coloridos crescem do centro cobrindo a tela e abrem na próxima.', { fam: 'forma', mov: 'circulo' }, [OP_TDUR, OP_COR1, OP_COR2]),
    TR('mv-tr-circulos-canto', 'Círculos do Canto', 'O mesmo, nascendo de um canto.', { fam: 'forma', mov: 'circulo', canto: true }, [OP_TDUR, OP_COR1, OP_COR2]),
    TR('mv-tr-faixas-diagonais', 'Faixas Diagonais', 'Duas faixas coloridas varrem a tela na diagonal.', { fam: 'forma', mov: 'faixa', inclina: true }, [OP_TDUR, OP_DIR2, OP_COR1, OP_COR2]),
    TR('mv-tr-retangulos', 'Retângulos', 'Dois blocos coloridos deslizam da lateral cobrindo e revelando.', { fam: 'forma', mov: 'faixa' }, [OP_TDUR, OP_DIR2, OP_COR1, OP_COR2]),
    TR('mv-tr-liquido', 'Líquido', 'Forma líquida em degradê sobe pela tela cobrindo e revela a próxima cena.', { fam: 'forma', mov: 'liquido' }, [OP_TDUR, OP_COR1, OP_COR2]),
    TR('mv-tr-tunel', 'Túnel', 'Losangos coloridos um dentro do outro avançam como túnel e abrem na próxima cena.', { fam: 'forma', mov: 'tunel' }, [OP_TDUR, OP_COR1, OP_COR2])
  ];

  var PASTAS = [
    { id: 'loop', nome: 'Loops de movimento', tipo: 'loop', itens: LOOP, dica: 'Começam na agulha e vão até o fim da camada. Clique para ver as opções.' },
    { id: 'texto', nome: 'Texto', filhos: [
      { id: 'texto-entradas', nome: 'Entradas e saídas', tipo: 'txt', itens: TXT, dica: 'Numa camada de texto. Começa na agulha: arraste os marcadores para mudar o tempo.' },
      { id: 'texto-loops', nome: 'Loops', tipo: 'txtloop', itens: TXTLOOP, dica: 'Numa camada de texto. Da agulha até o fim da camada.' }
    ] },
    { id: 'transicoes', nome: 'Transições', filhos: [
      { id: 'tr-cam', nome: 'Câmera', tipo: 'tr', itens: TR_CAM, dica: 'Começa na agulha; o corte entre as cenas fica no marcador "Corte".' },
      { id: 'tr-glitch', nome: 'Glitch', tipo: 'tr', itens: TR_GLITCH, dica: 'Começa na agulha; o corte entre as cenas fica no marcador "Corte".' },
      { id: 'tr-luz', nome: 'Luz', tipo: 'tr', itens: TR_LUZ, dica: 'Vira uma composição na agulha; o corte fica no marcador "Corte".' },
      { id: 'tr-forma', nome: 'Shapes', tipo: 'tr', itens: TR_FORMA, dica: 'Vira uma composição na agulha; o corte fica no marcador "Corte".' }
    ] }
  ];

  var ITENS = {};
  PASTAS.forEach(function (p) {
    (p.filhos || [p]).forEach(function (f) { f.itens.forEach(function (it) { it.pasta = f.id; it.tipo = f.tipo; it.sp.nome = it.nome; it.sp.id = it.id; ITENS[it.id] = it; }); });
  });
  window.ArcanoMovimentos = { PASTAS: PASTAS, ITENS: ITENS };
})();
