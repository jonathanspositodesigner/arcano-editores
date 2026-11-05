/* Arcano Motion — catálogo de ícones, ferramentas e presets (v0.7)
   Ícones desenhados para o Arcano (traço 1.7, 24x24). Cada ícone tem partes com classe
   própria para as animações do CSS (a-*). */
(function () {
  function svg(corpo, extra) {
    return '<svg class="ic' + (extra ? ' ' + extra : '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + corpo + '</svg>';
  }

  var ABAS = [
    { id: 'editar', nome: 'Editar efeitos', curto: 'Editar', desc: 'Mude as configurações dos efeitos do Arcano na camada selecionada.', ic: svg('<path class="a-lapis" d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4" opacity=".6"/><path class="a-brilho" d="M19 15v4M17 17h4"/>', 'ic-editar') },
    { id: 'chat', nome: 'Chat IA', curto: 'Chat IA', desc: 'Peça em português o que fazer no After.', ic: svg('<path class="a-bolha" d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><circle class="a-p1" cx="8.5" cy="11" r=".9" fill="currentColor" stroke="none"/><circle class="a-p2" cx="12" cy="11" r=".9" fill="currentColor" stroke="none"/><circle class="a-p3" cx="15.5" cy="11" r=".9" fill="currentColor" stroke="none"/>', 'ic-chat') },
    { id: 'presets', nome: 'Presets IA', curto: 'Presets', desc: 'Receitas completas que a IA executa.', ic: svg('<path class="a-estrela" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path class="a-mini" d="M19 15v4M17 17h4"/>', 'ic-presets') },
    { id: 'montar', nome: 'Monte sua animação', curto: 'Monte sua animação', desc: 'Escolha entrada, título, pessoas, elementos, informações, final e efeitos: a IA anima a comp em 15 s. Salve como preset seu.', ic: svg('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle class="a-c1" cx="15" cy="6" r="2"/><circle class="a-c2" cx="9" cy="12" r="2"/><circle class="a-c3" cx="17" cy="18" r="2"/>', 'ic-montar') },
    { id: 'animar', nome: 'Animar', curto: 'Animar', desc: 'Entradas e saídas prontas, em keyframes editáveis.', ic: svg('<path class="a-rastro" d="M3 8h4M2 12h5M3 16h4"/><path class="a-play" d="M10 6.5v11l9-5.5z"/>', 'ic-animar') },
    { id: 'ferramentas', nome: 'Efeitos e ferramentas', curto: 'Efeitos', desc: 'Clique num efeito para ver a prévia e ajustar.', ic: svg('<path class="a-varinha" d="M4 20 15 9"/><path class="a-varinha" d="m14 6 4 4"/><path class="a-brilho" d="M19 3v3M17.5 4.5h3M7 4v2M6 5h2M20 14v2M19 15h2"/>', 'ic-ferr') },
    { id: 'parallax', nome: 'Parallax 2.5D', curto: 'Parallax', desc: 'Profundidade entre as camadas sem mudar o enquadramento.', ic: svg('<path class="a-c1" d="m12 3 9 4.5-9 4.5-9-4.5z"/><path class="a-c2" d="m3 12 9 4.5 9-4.5"/><path class="a-c3" d="m3 16.5 9 4.5 9-4.5"/>', 'ic-parallax') },
    { id: 'foco', nome: 'Pontos de foco', curto: 'Foco', desc: 'Monte o caminho da câmera parada por parada e escolha o ponto exato de foco em cada camada.', ic: svg('<path class="a-cantos" d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle class="a-mira" cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/>', 'ic-foco') },
    { id: 'camera', nome: 'FX Câmera 3D', curto: 'FX Câmera 3D', desc: 'Movimentos de câmera prontos: entrada pelo fundo, descida, dolly, órbita, rack focus, tremidas e mais.', ic: svg('<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle class="a-lente" cx="12" cy="13.5" r="3.5"/><circle class="a-flash" cx="18" cy="10.5" r=".6" fill="currentColor"/>', 'ic-camera') },
    { id: 'ia', nome: 'Gerar vídeo', curto: 'Vídeo IA', desc: 'Anima a camada com o Grok Imagine, usando seus créditos do ArcanoApp.', ic: svg('<path d="M3 10h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path class="a-claquete" d="m3 10 1.2-4.2a1 1 0 0 1 1.2-.7l14.3 3.9"/><path class="a-claquete" d="m8 6.3 2 3.5M13 7.6l2 3"/><path class="a-play2" d="m10.5 13 4 2-4 2z" fill="currentColor"/>', 'ic-video') },
    { id: 'img', nome: 'Gerar imagem', curto: 'Imagem IA', desc: 'Edita a camada ou cria imagem com o GPT Image, usando seus créditos do ArcanoApp.', ic: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle class="a-sol" cx="9" cy="9.5" r="1.8"/><path class="a-montanha" d="m3 18 5-5 4 4 3-3 6 6"/>', 'ic-img') },
    { id: 'aud', nome: 'Gerar áudio', curto: 'Áudio IA', desc: 'Narração com voz (Gemini) e trilha sonora (Suno) para o seu motion, usando seus créditos do ArcanoApp.', ic: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path class="a-onda1" d="M15.5 9a4 4 0 0 1 0 6"/><path class="a-onda2" d="M18 6.5a7.5 7.5 0 0 1 0 11"/>', 'ic-aud') },
    { id: 'biblioteca', nome: 'Biblioteca', curto: 'Biblioteca', desc: 'Seus sons, transições, textos e assets.', ic: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path class="a-nota" d="M14 11.5v4.2"/><path class="a-nota" d="M14 11.5l3-1v4"/><circle class="a-nota" cx="12.8" cy="15.8" r="1.2"/><circle class="a-nota" cx="15.8" cy="14.6" r="1.2"/>', 'ic-bib') },
    { id: 'conta', nome: 'Conta', curto: 'Conta', desc: 'Conta ArcanoApp, créditos, motor de IA e ajustes.', ic: svg('<circle cx="12" cy="12" r="9"/><circle class="a-cabeca" cx="12" cy="10" r="3"/><path class="a-ombro" d="M6.5 18.5c1.4-2.2 3.3-3.2 5.5-3.2s4.1 1 5.5 3.2"/>', 'ic-conta') },
    { id: 'clonar', oculta: true, pai: 'aud', nome: 'Clonar minha voz', curto: 'Clonar voz', desc: 'Grave ou envie a sua voz e a IA clona ela para narrar os seus vídeos.', ic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>', 'ic-clonar') },
    { id: 'camadas', oculta: true, pai: 'ferramentas', nome: 'Decompor em camadas', curto: 'Camadas', desc: 'Decompõe a imagem selecionada (ou o frame da comp) em camadas com IA, numa precomp no lugar da original.', ic: svg('<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5l9 4.5 9-4.5"/>', 'ic-camadas') },
  ];

  // ícones das ferramentas (todos animam no hover: class "ic-t")
  var I = {
    flash: svg('<path class="a-raio" d="M13 2 5 13h6l-1 9 8-11h-6z"/>', 'ic-t'),
    sweep: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path class="a-feixe" d="M9 5 6 19M13 5l-3 14"/>', 'ic-t'),
    glow: svg('<circle cx="12" cy="12" r="3.5"/><path class="a-raios" d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>', 'ic-t'),
    chroma: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 16c0-3 1.8-5 4-5s4 2 4 5"/><circle cx="12" cy="8.5" r="2"/><path class="a-gota" d="M19 2.5c-.9 1.2-1.4 2-1.4 2.7a1.4 1.4 0 0 0 2.8 0c0-.7-.5-1.5-1.4-2.7z"/>', 'ic-t'),
    turbulencia: svg('<path class="a-onda" d="M3 8c2-2 4 2 6 0s4-2 6 0 4 2 6 0"/><path class="a-onda" d="M3 13c2-2 4 2 6 0s4-2 6 0 4 2 6 0"/><path class="a-onda" d="M3 18c2-2 4 2 6 0s4-2 6 0 4 2 6 0"/>', 'ic-t'),
    inverter: svg('<path class="a-seta-d" d="M4 8h14l-3-3M18 8l-3 3"/><path class="a-seta-e" d="M20 16H6l3-3M6 16l3 3"/>', 'ic-t'),
    escalaIn: svg('<rect x="3" y="3" width="18" height="18" rx="2" opacity=".4"/><rect class="a-cresce" x="8" y="8" width="8" height="8" rx="1"/>', 'ic-t'),
    escalaOut: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><rect class="a-encolhe" x="8" y="8" width="8" height="8" rx="1" opacity=".5"/>', 'ic-t'),
    slide: svg('<rect class="a-desliza" x="11" y="7" width="10" height="10" rx="2"/><path d="M3 10h5M3 14h3" opacity=".6"/>', 'ic-t'),
    sequencia: svg('<rect class="a-s1" x="3" y="5" width="9" height="3" rx="1"/><rect class="a-s2" x="7" y="10.5" width="9" height="3" rx="1"/><rect class="a-s3" x="11" y="16" width="9" height="3" rx="1"/>', 'ic-t'),
    ancora: svg('<rect x="4" y="4" width="16" height="16" rx="2" opacity=".45"/><circle class="a-alvo" cx="12" cy="12" r="2"/><path class="a-alvo" d="M12 6v2.5M12 15.5V18M6 12h2.5M15.5 12H18"/>', 'ic-t'),
    cubo: svg('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path class="a-face" d="m4 7.5 8 4.5 8-4.5M12 12v9"/>', 'ic-t'),
    rotY: svg('<ellipse class="a-orbita" cx="12" cy="12" rx="9" ry="3.5"/><path d="M12 4v16" opacity=".5"/><path class="a-orbita" d="m18 9.2 2.6-.4-.6 2.6"/>', 'ic-t'),
    zIn: svg('<rect x="3" y="3" width="18" height="18" rx="2" opacity=".4"/><rect class="a-vem" x="9" y="9" width="6" height="6" rx="1"/><path d="M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6" opacity=".4"/>', 'ic-t'),
    perdeFoco: svg('<circle cx="12" cy="12" r="8" stroke-dasharray="3 2.2"/><circle class="a-pulso" cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>', 'ic-t'),
    zOut: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><rect class="a-vai" x="9" y="9" width="6" height="6" rx="1" opacity=".55"/>', 'ic-t'),
    rotInf: svg('<path class="a-gira" d="M20 12a8 8 0 1 1-2.3-5.7"/><path class="a-gira" d="M20 4v5h-5"/>', 'ic-t'),
    pendulo: svg('<path d="M5 3h14" opacity=".5"/><g class="a-balanca"><path d="M12 3v11"/><circle cx="12" cy="17" r="3"/></g>', 'ic-t'),
    esteira: svg('<rect x="3" y="8" width="18" height="8" rx="4"/><circle class="a-roda" cx="7" cy="12" r="1.5"/><circle class="a-roda" cx="17" cy="12" r="1.5"/><path class="a-esteira" d="M10 12h4"/>', 'ic-t'),
    videoInf: svg('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/><path class="a-gira" d="M7.5 12a2 2 0 1 0 2-2"/>', 'ic-t'),
    loop: svg('<path class="a-loop" d="M7 8c-3 0-4 2-4 4s1 4 4 4c4 0 6-8 10-8 3 0 4 2 4 4s-1 4-4 4c-4 0-6-8-10-8z"/>', 'ic-t'),
    contador: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path class="a-num" d="M8 10l1.5-1v6M13 9.5c.4-.4 1-.6 1.5-.6 1 0 1.6.6 1.6 1.4 0 1.6-3.1 2.6-3.1 4.7h3.2"/>', 'ic-t'),
    cascata: svg('<path class="a-l1" d="M5 6h14"/><path class="a-l2" d="M5 10h14"/><path class="a-l3" d="M5 14h14"/><path class="a-l4" d="M5 18h9"/>', 'ic-t'),
    expandir: svg('<rect x="7" y="7" width="10" height="10" rx="1" opacity=".5"/><path class="a-abre" d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/>', 'ic-t'),
    nulo: svg('<rect x="5" y="5" width="14" height="14" rx="1" stroke-dasharray="2.5 2.5"/><path class="a-alvo" d="M12 9v6M9 12h6"/>', 'ic-t'),
    batida: svg('<path class="a-b1" d="M5 10v4"/><path class="a-b2" d="M9 6v12"/><path class="a-b3" d="M13 8v8"/><path class="a-b4" d="M17 4v16"/><path class="a-b5" d="M21 10v4"/>', 'ic-t'),
    fadeAudio: svg('<path d="M4 9h3l4-4v14l-4-4H4z"/><path class="a-som" d="M15 9.5a3.5 3.5 0 0 1 0 5"/><path class="a-som2" d="M18 7a7 7 0 0 1 0 10" opacity=".55"/>', 'ic-t'),
    fadeFinal: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path class="a-escurece" d="M12 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7z" fill="currentColor" opacity=".5" stroke="none"/>', 'ic-t'),
    psd: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6" opacity=".6"/><path class="a-texto" d="M8 13h8M12 13v5"/>', 'ic-t'),
    apagar: svg('<path class="a-borracha" d="m15 4 5 5-9.5 9.5H6L4 16.5a1.5 1.5 0 0 1 0-2.1z"/><path d="M10 20h10" opacity=".5"/>', 'ic-t'),
    cache: svg('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" opacity=".55"/><path class="a-brilho" d="M19 2v2M18 3h2"/>', 'ic-t'),
    camDolly: svg('<rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path class="c-estica" d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4"/>', 'ic-t'),
    camOrbita: svg('<ellipse cx="12" cy="12" rx="9.5" ry="3.6" opacity=".45"/><rect class="c-orbita" x="9.5" y="8" width="5" height="8" rx="1"/><circle class="c-satelite" cx="12" cy="15.6" r="1.4" fill="currentColor" stroke="none"/>', 'ic-t'),
    camDescida: svg('<rect x="6" y="2.5" width="12" height="19" rx="1.5" opacity=".45"/><rect class="c-desce" x="7.5" y="4" width="9" height="6" rx="1"/>', 'ic-t'),
    camLateral: svg('<rect x="2.5" y="6" width="19" height="12" rx="1.5" opacity=".45"/><rect class="c-lado" x="4" y="7.5" width="7" height="9" rx="1"/>', 'ic-t'),
    camBatida: svg('<rect class="c-batida" x="5" y="5" width="14" height="14" rx="1.5"/><path class="c-onda" d="M8 12h1.5l1-2.5 2 5 1-2.5H16"/>', 'ic-t'),
    camImpacto: svg('<rect class="c-tremor" x="7.5" y="7.5" width="9" height="9" rx="1"/><path class="c-estouro" d="M3 3.5l2 2M21 3.5l-2 2M3 20.5l2-2M21 20.5l-2-2M12 1.5v2.5M12 20v2.5"/>', 'ic-t'),
    camRack: svg('<circle class="c-rack-a" cx="7.5" cy="12" r="4.2"/><circle class="c-rack-b" cx="16.5" cy="12" r="4.2"/>', 'ic-t'),
    camFuga: svg('<rect x="2.5" y="4" width="19" height="16" rx="1.5" opacity=".45"/><path d="M2.5 4l6.5 5M21.5 4L15 9M2.5 20l6.5-5M21.5 20L15 15" opacity=".35"/><rect class="c-fuga" x="9" y="9" width="6" height="6" rx="1"/>', 'ic-t'),
    foco: svg('<path class="c-cantos" d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle class="c-alvo" cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/>', 'ic-t'),
    entradaFundo: svg('<rect x="9" y="9" width="6" height="6" rx="1" opacity=".55"/><rect class="c-abre" x="3" y="3" width="18" height="18" rx="2"/>', 'ic-t'),
    mao: svg('<g class="c-mao"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3"/></g>', 'ic-t'),
    mira: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle class="c-mira" cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>', 'ic-t'),
    iaDecide: svg('<path class="c-estrela" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path class="c-mini" d="M19 15v4M17 17h4"/><path class="c-mini2" d="M5 3.5v3M3.5 5h3"/>', 'ic-t'),
    meuJeito: svg('<path d="M4 6h16M4 12h16M4 18h16" opacity=".4"/><circle class="c-k1" cx="8" cy="6" r="2" fill="var(--superficie,#1b1820)"/><circle class="c-k2" cx="15" cy="12" r="2" fill="var(--superficie,#1b1820)"/><circle class="c-k3" cx="10" cy="18" r="2" fill="var(--superficie,#1b1820)"/>', 'ic-t'),
    camera3d: svg('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" opacity=".5"/><circle class="a-lente" cx="12" cy="12" r="3"/>', 'ic-t'),
    deriva: svg('<rect class="a-desliza" x="8" y="8" width="8" height="8" rx="1.5"/><path d="M3 12h3M18 12h3M12 3v3M12 18v3" opacity=".5"/>', 'ic-t'),
    flicker: svg('<path d="M9 18h6M10 21h4"/><path class="a-pisca" d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>', 'ic-t'),
    glitch: svg('<path class="a-g1" d="M4 6h10"/><path class="a-g2" d="M8 10h12"/><path class="a-g3" d="M3 14h9"/><path class="a-g4" d="M10 18h10"/>', 'ic-t'),
    lut: svg('<circle class="a-c1" cx="9" cy="9" r="5"/><circle class="a-c2" cx="15" cy="9" r="5" opacity=".75"/><circle class="a-c3" cx="12" cy="14.5" r="5" opacity=".6"/>', 'ic-t'),
    // Atalhos rápidos (os presets de vídeo com IA) e os efeitos do Photoshop
    vFoto: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle class="a-texto" cx="12" cy="10" r="2.6"/><path class="a-texto" d="M7.5 18c.8-2.5 2.4-3.7 4.5-3.7s3.7 1.2 4.5 3.7"/><path class="a-brilho" d="M19 1.5v3M17.5 3h3"/>', 'ic-t'),
    vSelo: svg('<path d="M12 3l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.7 1 2.7-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9-2.4-1.8 1-2.7-1-2.7 2.4-1.8.9-2.9 3 .2z"/><path class="a-face" d="m10.5 9.4 4.2 2.6-4.2 2.6z" fill="currentColor" stroke="none"/>', 'ic-t'),
    vFundo: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path class="a-onda" d="M3 15c3-2.5 5-2.5 8 0s5 2.5 10 0"/><path class="a-brilho" d="M8 8.5v2M7 9.5h2M15.5 7v2M14.5 8h2"/>', 'ic-t'),
    vTextura: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><g class="a-onda"><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="14" cy="12" r=".9" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r=".9" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r=".9" fill="currentColor" stroke="none"/></g>', 'ic-t'),
    acRevisar: svg('<rect x="3" y="5" width="13" height="10" rx="1.5"/><path d="M7 8.5l4 1.5-4 1.5z"/><circle cx="17" cy="16" r="3.2"/><path d="M19.4 18.4 21.5 20.5"/>', 'ic-t'),
    acSons: svg('<path d="M4 9.5h3l4-3.5v12l-4-3.5H4z"/><path d="M14.5 9a4 4 0 0 1 0 6"/><path d="M17 6.5a7.5 7.5 0 0 1 0 11"/>', 'ic-t'),
    acBatidas: svg('<path d="M3 12h2l1.5-5 2.5 10 2.5-12 2.5 14 2-7H21"/>', 'ic-t'),
    vTransicao: svg('<rect x="2.5" y="6" width="9" height="12" rx="1.5" opacity=".5"/><rect x="12.5" y="6" width="9" height="12" rx="1.5"/><path class="a-feixe" d="M13 3 9 21"/>', 'ic-t'),
    psFundo: svg('<path d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4" stroke-dasharray="2 2"/><circle class="a-texto" cx="12" cy="9.5" r="2.6"/><path class="a-texto" d="M7.5 18.5c.8-2.6 2.4-3.8 4.5-3.8s3.7 1.2 4.5 3.8"/>', 'ic-t'),
    psUpscale: svg('<rect x="3" y="13" width="8" height="8" rx="1.2" opacity=".55"/><path class="a-abre" d="M13 3h8v8M21 3l-8.5 8.5"/><path class="a-brilho" d="M16.5 15.5v4M14.5 17.5h4"/>', 'ic-t'),
    psCloner: svg('<circle cx="8" cy="8" r="2.6"/><path d="M3.5 18c.6-2.6 2.2-4 4.5-4s3.9 1.4 4.5 4"/><g class="a-desliza"><circle cx="16" cy="8" r="2.6" opacity=".6"/><path d="M11.5 18c.6-2.6 2.2-4 4.5-4s3.9 1.4 4.5 4" opacity=".6"/></g>', 'ic-t'),
    psVeste: svg('<path class="a-texto" d="M9 3.5 12 5l3-1.5 5 3-2 3.5-2-1V20H8V9l-2 1-2-3.5z"/>', 'ic-t'),
    psPose: svg('<circle cx="12" cy="4.5" r="2"/><path d="M12 7v6M12 13l-3 7M12 13l3 7"/><path class="a-balanca" d="M12 9 7 6M12 9l5-3"/>', 'ic-t'),
    psExpandir: svg('<rect x="8" y="8" width="8" height="8" rx="1.2"/><path class="a-abre" d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/>', 'ic-t'),
    psStoriesFeed: svg('<rect x="2.5" y="3" width="8" height="15" rx="1.6"/><rect x="14" y="7.5" width="7.5" height="9.5" rx="1.4"/><path class="a-desliza" d="M8 21h8m-2-2 2 2-2 2"/>', 'ic-t'),
    psOrganizar: svg('<path d="M3 6.5h4l1.5 1.5H21v3H3z"/><path class="a-l1" d="M6 14h13"/><path class="a-l2" d="M6 17h13"/><path class="a-l3" d="M6 20h9"/>', 'ic-t'),
    psSeparar: svg('<path d="M12 3l8.5 4.3L12 11.6 3.5 7.3z"/><path class="a-c2" d="m3.5 12 8.5 4.3 8.5-4.3"/><path class="a-c3" d="m3.5 16.5 8.5 4.3 8.5-4.3"/>', 'ic-t'),
    psAmbientar: svg('<rect x="3" y="5" width="18" height="15" rx="2"/><rect class="a-cresce" x="8.5" y="10.5" width="7" height="6.5" rx="1"/><circle class="a-brilho" cx="17" cy="8.5" r="1.4"/><path d="M3 16.5c2-1.6 3.6-2 5.5-1.5" opacity=".55"/>', 'ic-t'),
    pasta: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', 'ic-t')
  };

  // tipos de opção: n (número), s (lista), b (sim/não)
  var FERRAMENTAS = [
    // Atalhos rápidos (pedido do dono, 29/10/2026): os presets de vídeo com IA que moravam na pasta "Vídeo IA" dos
    // Presets. Funcionam igual (abrem a mesma janela: camada, duração, resolução, custo): "preset" é o id em
    // window.ARCANO_PRESETS_VIDEO (js/presets.js). especial 'preset-video' = não é efeito do jsx, não leva o "+".
    { grupo: 'Atalhos rápidos', itens: [
      { id: 'atalho-decompor', especial: 'aba', aba: 'camadas', direto: true, novo: true, nome: 'Decompor em camadas', ic: I.psSeparar, desc: 'A IA separa a imagem selecionada (ou o frame atual da comp) em camadas: cada elemento numa camada com nome e o fundo reconstruído, numa precomp no lugar da original. Pronto para animar. Usa créditos.', ops: [] },
      { id: 'atalho-video-foto', preset: 'video-foto', especial: 'preset-video', direto: true, nome: 'Animar foto', ic: I.vFoto, desc: 'A IA gera um vídeo da foto selecionada com movimentos leves (respiração, cabeça, cabelo) e troca no mesmo lugar. Usa créditos.', ops: [] },
      { id: 'atalho-video-selo', preset: 'video-selo', especial: 'preset-video', direto: true, nome: 'Animar selo 3D', ic: I.vSelo, desc: 'O selo 3D selecionado se monta peça por peça e termina igual ao original, no mesmo lugar. Usa créditos.', ops: [] },
      { id: 'atalho-video-fundo', preset: 'video-fundo', especial: 'preset-video', direto: true, nome: 'Animar fundo', ic: I.vFundo, desc: 'O fundo selecionado ganha vida (luzes, fumaça, partículas) com o mesmo modo de mesclagem. Usa créditos.', ops: [] },
      { id: 'atalho-video-transicao', preset: 'video-transicao', especial: 'preset-video', direto: true, nome: 'Transição da arte', ic: I.vTransicao, desc: 'A IA gera uma transição de 2 s com os elementos e as cores da arte e coloca na agulha. Usa créditos.', ops: [] }
    ] },
    // Revisão e som (1.2.8): ações do próprio painel (não são efeitos do jsx nem pedidos à IA)
    { grupo: 'Revisão e som', itens: [
      { id: 'acao-revisar', acao: 'revisar', especial: 'acao', direto: true, nome: 'Revisar vídeo', ic: I.acRevisar, desc: 'Renderiza uma prévia leve (não fica salva) e aponta tela preta, trecho parado, salto sem transição, som estourando ou mudo, com o tempo de cada um. Dá para comparar lado a lado com a referência.', ops: [] },
      { id: 'acao-sons', acao: 'sons', especial: 'acao', direto: true, nome: 'Sons automáticos', ic: I.acSons, desc: 'Lê a animação da comp e põe o efeito sonoro certo da biblioteca em cada coisa que entra, sai, corta ou bate (whoosh, pop, impacto, glitch, digitação), no tempo certo e nivelado. Ctrl+Z desfaz.', ops: [] },
      { id: 'acao-batidas', acao: 'batidas', especial: 'acao', direto: true, nome: 'Marcar batidas', ic: I.acBatidas, desc: 'Mede as batidas da trilha que está na comp e marca na timeline o tempo 1 de cada compasso e o DROP, para cortar em cima da música.', ops: [] }
    ] },
    { grupo: 'Cor', itens: [
      { id: 'cores-psd', nome: 'Cores do PSD → LUT', ic: I.lut, especial: 'lut', desc: 'Um clique: pega todos os ajustes de cor do PSD (Curvas, Níveis, Pesquisa de cores, Matiz/Saturação...) e vira 1 LUT no After.', ops: [] }
    ] },
    { grupo: 'Efeitos', itens: [
      { id: 'flash', nome: 'Flash branco', ic: I.flash, desc: 'Flashes brancos de 1 frame a partir do tempo atual.', ops: [['vezes', 'Quantidade', 'n', 6, 1, 30], ['intervalo', 'Intervalo (frames)', 'n', 1, 1, 30]] },
      { id: 'light-sweep', nome: 'Light Sweep', ic: I.sweep, editavel: true, desc: 'Um brilho que atravessa a camada, uma vez ou em loop.', ops: [['intensidade', 'Intensidade do brilho', 'n', 60, 0, 200, '%'], ['velocidade', 'Duração de cada passada', 'n', 1, 0.1, 20, 's'], ['largura', 'Largura do brilho', 'n', 50, 1, 300, 'px'], ['direcao', 'Direção', 's', 'esq-dir', [['esq-dir', 'Esquerda → direita'], ['dir-esq', 'Direita → esquerda']]], ['repetir', 'Repetir até o fim da camada', 'b', true], ['intervalo', 'Pausa entre passadas', 'n', 1, 0, 60, 's']] },
      { id: 'glow', nome: 'Glow', ic: I.glow, editavel: true, desc: 'A luz respira: a opacidade sobe e desce em loop suave, ficando forte e fraca.', ops: [['intensidade', 'Intensidade (quanto a luz apaga)', 'n', 60, 5, 100, '%'], ['velocidade', 'Velocidade', 'n', 1, 0.05, 10, 'pulsos/s']] },
      { id: 'textura', nome: 'Animar textura', ic: I.vTextura, editavel: true, desc: 'A textura selecionada (grão, papel, poeira, glitter) fica mexendo só com a escala: espelha em ciclo (100/100, 100/-100, -100/100, -100/-100) com loop. Sem IA e sem créditos.', ops: [['velocidade', 'Velocidade', 'n', 8, 1, 30, 'trocas/s']] },
      { id: 'flicker', nome: 'Flicker', ic: I.flicker, editavel: true, desc: 'A camada pisca como lâmpada com mau contato.', ops: [['intensidade', 'Intensidade', 'n', 80, 5, 100, '%'], ['velocidade', 'Velocidade', 'n', 8, 0.5, 30, 'por s'], ['estilo', 'Estilo', 's', 'lampada', [['lampada', 'Lâmpada falhando'], ['constante', 'Constante'], ['suave', 'Suave']]]] },
      { id: 'glitch', nome: 'Glitch', ic: I.glitch, editavel: true, desc: 'Falhas digitais em rajadas.', ops: [['intensidade', 'Intensidade', 'n', 50, 1, 100, '%'], ['velocidade', 'Velocidade', 'n', 1.5, 0.1, 20, 'por s'], ['estilo', 'Estilo', 's', 'completo', [['completo', 'Completo'], ['fatias', 'Fatias'], ['tremida', 'Tremida'], ['cor', 'Cor']]]] },
      { id: 'chroma', nome: 'Chroma key', ic: I.chroma, visiveis: 7, desc: 'Tira o fundo verde (ou azul) com o Keylight: escolha a cor do fundo na imagem e ajuste o recorte e as bordas.', ops: [
        ['cor', 'Cor do fundo', 'cor', '#00b140'],
        ['forca', 'Força do recorte', 'n', 100, 0, 200, '%'],
        ['limparFundo', 'Limpar sujeira do fundo', 'n', 0, 0, 100],
        ['firmar', 'Firmar a pessoa (tira transparência)', 'n', 0, 0, 100],
        ['bordas', 'Bordas: comer ← → soltar', 'n', 0, -20, 20, 'px'],
        ['suavizar', 'Suavizar bordas', 'n', 0, 0, 50],
        ['ver', 'Ver', 's', 'final', [['final', 'Resultado final'], ['mascara', 'Máscara (P&B)']]],
        ['equilibrio', 'Equilíbrio da cor', 'n', 50, 0, 100]
      ] },
      { id: 'turbulencia', nome: 'Turbulência', ic: I.turbulencia, editavel: true, desc: 'Distorção que se move, fluida ou em pulsos.', ops: [['modo', 'Modo', 's', 'fluida', [['fluida', 'Fluida'], ['pulsos', 'Em pulsos']]], ['amplitude', 'Amplitude', 'n', 30, 1, 500], ['velocidade', 'Velocidade', 'n', 1, 0.05, 20, '×'], ['tamanho', 'Tamanho das ondas', 'n', 100, 2, 1000]] }
    ] },
    { grupo: 'Keyframes', itens: [
      { id: 'escala-in', nome: 'Escala in', ic: I.escalaIn, desc: 'Escala 0 → 100 na entrada da camada.', ops: [['duracao', 'Duração (s)', 'n', 0.5, 0.1, 10], ['curva', 'Curva', 's', 'back', [['back', 'Overshoot'], ['expo', 'Expo'], ['elastic', 'Elástica'], ['bounce', 'Quique'], ['ease', 'Suave']]]] },
      { id: 'escala-out', nome: 'Escala out', ic: I.escalaOut, desc: 'Escala 100 → 0 na saída da camada.', ops: [['duracao', 'Duração (s)', 'n', 0.5, 0.1, 10], ['curva', 'Curva', 's', 'back', [['back', 'Overshoot'], ['expo', 'Expo'], ['ease', 'Suave']]]] },
      { id: 'slide', nome: 'Slide', ic: I.slide, desc: 'Entra deslizando de fora do quadro, no começo da camada.', ops: [['direcao', 'Vem de', 's', 'baixo', [['baixo', 'Baixo'], ['cima', 'Cima'], ['esquerda', 'Esquerda'], ['direita', 'Direita']]], ['curva', 'Curva de velocidade', 's', 'expo', [['expo', 'Freada forte'], ['back', 'Passa e volta'], ['bounce', 'Quique'], ['elastic', 'Elástica']]], ['duracao', 'Duração', 'n', 0.7, 0.1, 10, 's']] },
      { id: 'sequencia', nome: 'Sequência', ic: I.sequencia, desc: 'Escalona as camadas no tempo, uma depois da outra.', ops: [['frames', 'Intervalo (frames)', 'n', 1, 1, 120], ['inverso', 'De baixo para cima', 'b', false]] },
      { id: 'inverter', nome: 'Inverter keys', ic: I.inverter, desc: 'Espelha no tempo os keyframes selecionados.', ops: [] },
      { id: 'ancora-centro', nome: 'Âncora no centro', ic: I.ancora, desc: 'Põe a âncora no centro da composição (ou da camada) sem a camada sair do lugar.', ops: [['alvo', 'Centralizar em', 's', 'comp', [['comp', 'Centro da composição'], ['camada', 'Centro da camada']]]] }
    ] },
    { grupo: '3D', itens: [
      { id: 'ativar-3d', nome: 'Ativar 3D', ic: I.cubo, desc: 'Liga 3D em tudo, inclusive dentro das precomps (vale onde elas forem usadas).', ops: [] },
      { id: 'rotacao-y', nome: 'Giro Y', ic: I.rotY, desc: 'Gira a camada no eixo Y a partir da agulha do tempo e sempre termina de frente (marcadores de início e fim na camada).', ops: [['voltas', 'Voltas (inteiras)', 'n', 2, 1, 50, '', 'inteiro'], ['duracao', 'Duração', 'n', 2, 0.1, 60, 's'], ['curva', 'Curva do giro', 's', 'termina-devagar', [['suave', 'Suave nas pontas'], ['forte', 'Bem suave'], ['comeca-devagar', 'Começa devagar'], ['termina-devagar', 'Termina devagar'], ['linear', 'Constante']]], ['sentido', 'Sentido', 's', 'horario', [['horario', 'Horário'], ['anti-horario', 'Anti-horário']]]] },
      { id: 'z-entrada', nome: 'Entrada Z', ic: I.zIn, desc: 'Vem do fundo pelo eixo Z.', ops: [['distancia', 'Distância', 'n', 2500, 100, 20000], ['duracao', 'Duração (s)', 'n', 0.8, 0.1, 10]] },
      { id: 'perde-foco', nome: 'Desfoque', ic: I.perdeFoco, editavel: true, desc: 'Na agulha do tempo, a câmera 3D desfoca, dá um leve zoom e gira, e volta a focar (uns 2 s).', ops: [['intensidade', 'Desfoque e zoom', 'n', 50, 5, 100, '%'], ['graus', 'Giro da câmera', 'n', 8, 0, 45, '°'], ['duracao', 'Duração', 'n', 2, 0.5, 6, 's'], ['giro', 'Gira para', 's', 'direita', [['esquerda', 'Esquerda'], ['direita', 'Direita']]]] },
      { id: 'z-saida', nome: 'Saída Z', ic: I.zOut, desc: 'Sai voando na direção da câmera.', ops: [['distancia', 'Distância', 'n', 900, 100, 20000], ['duracao', 'Duração (s)', 'n', 0.8, 0.1, 10]] }
    ] },
    { grupo: 'Loops', itens: [
      { id: 'rotacao-infinita', nome: 'Rotação contínua', ic: I.rotInf, desc: 'Gira sem parar até o fim da camada.', ops: [['velocidade', 'Velocidade do giro', 'n', 30, 1, 3600, '°/s'], ['sentido', 'Sentido', 's', 'horario', [['horario', 'Horário'], ['anti-horario', 'Anti-horário']]]] },
      { id: 'pendulo', nome: 'Pêndulo', ic: I.pendulo, desc: 'Balança em volta do ponto de âncora da camada (o que você deixou), até o fim dela.', ops: [['amplitude', 'Amplitude', 'n', 15, 1, 90, '°'], ['velocidade', 'Velocidade', 'n', 1.25, 0.05, 20, 'balanços/s'], ['amortecimento', 'Perde força com o tempo', 'n', 0, 0, 3]] },
      { id: 'esteira', nome: 'Esteira infinita', ic: I.esteira, desc: 'O conteúdo rola sem parar dentro da camada (efeito Offset).', ops: [['direcao', 'Direção da esteira', 's', 'cima', [['cima', 'Para cima'], ['baixo', 'Para baixo'], ['esquerda', 'Para a esquerda'], ['direita', 'Para a direita']]], ['velocidade', 'Velocidade', 'n', 150, 1, 5000, 'px/s']] },
      { id: 'video-infinito', nome: 'Vídeo infinito', ic: I.videoInf, desc: 'Repete o vídeo até o fim da comp.', ops: [] },
      { id: 'deriva', nome: 'Movimento constante', ic: I.deriva, editavel: true, desc: 'A camada anda devagar sem parar (para um lado, para cima...) ou flutua, até o fim.', ops: [['direcao', 'Direção', 's', 'direita', [['cima-esquerda', '↖'], ['cima', '↑'], ['cima-direita', '↗'], ['esquerda', '←'], ['flutuar', 'Flutuar'], ['direita', '→'], ['baixo-esquerda', '↙'], ['baixo', '↓'], ['baixo-direita', '↘']]], ['velocidade', 'Velocidade', 'n', 20, 1, 500, 'px/s'], ['amplitude', 'Amplitude (no Flutuar)', 'n', 40, 2, 1000, 'px'], ['suavidade', 'Suavidade no começo e no fim', 'n', 50, 0, 100, '%']] },
      { id: 'loop', nome: 'Loop de keys', ic: I.loop, desc: 'Repete a animação existente (loopOut).', ops: [['tipo', 'Tipo', 's', 'cycle', [['cycle', 'Cycle'], ['pingpong', 'Ping-pong'], ['offset', 'Offset'], ['continue', 'Continue']]]] }
    ] },
    { grupo: 'Texto e composição', itens: [
      { id: 'contador', nome: 'Contador', ic: I.contador, editavel: true, desc: 'Número animado a partir da agulha. Usa o texto selecionado ou cria um novo.', ops: [['de', 'Número inicial', 'n', 0, -1e6, 1e6], ['ate', 'Número final', 'n', 100, -1e6, 1e6], ['duracao', 'Duração', 'n', 3, 0.1, 600, 's'], ['curva', 'Curva de velocidade', 's', 'comeco-rapido', [['suave', 'Suave'], ['comeco-rapido', 'Rápido no começo'], ['final-rapido', 'Rápido no final'], ['linear', 'Constante']]], ['casas', 'Casas decimais', 'n', 0, 0, 4], ['milhar', 'Separar milhar com ponto (1.000)', 'b', true], ['prefixo', 'Antes do número (ex.: R$ )', 't', ''], ['sufixo', 'Depois do número (ex.: %)', 't', ''], ['tamanho', 'Tamanho da fonte (texto novo)', 'n', 150, 8, 1000, 'px']] },
      { id: 'cascata', nome: 'Cascata de texto', ic: I.cascata, editavel: true, desc: 'Cópias do texto saem de dentro dele em degraus e voltam a ser um só, em loop.', ops: [['quantidade', 'Quantidade de cópias', 'n', 4, 1, 40], ['espacamento', 'Espaço entre elas', 'n', 60, 1, 2000, 'px'], ['direcao', 'Para onde abre', 's', 'baixo', [['baixo', 'Baixo'], ['cima', 'Cima'], ['direita', 'Direita'], ['esquerda', 'Esquerda']]], ['velocidade', 'Tempo para abrir', 'n', 0.6, 0.05, 20, 's'], ['pausa', 'Tempo parado aberto/fechado', 'n', 0.6, 0, 30, 's'], ['escalonamento', 'Atraso entre cópias', 'n', 2, 0, 30, 'frames'], ['loop', 'Repetir em loop até o fim', 'b', true], ['esmaecer', 'Cópias mais transparentes', 'b', true]] },
      { id: 'expandir-fundo', nome: 'Expandir fundo', ic: I.expandir, desc: 'Aumenta a escala para sobrar borda em movimentos.', ops: [['escala', 'Escala (%)', 'n', 115, 101, 300]] },
      { id: 'nulo', nome: 'Nulo controlador', ic: I.nulo, desc: 'Cria um nulo e liga as camadas nele.', ops: [] },
      { id: 'texto-psd', nome: 'Texto do PSD', ic: I.psd, direto: true, desc: 'Um clique: todo texto de PSD da comp (e das precomps dela) vira texto editável.', ops: [] }
    ] },
    { grupo: 'Áudio e final', itens: [
      { id: 'batida', nome: 'Reagir à batida', ic: I.batida, editavel: true, desc: 'As camadas selecionadas pulsam com a música que você escolher (desta comp ou da comp mãe).', ops: [['audio', 'Música / áudio', 'audio', ''], ['alvo', 'O que pulsa', 's', 'escala', [['escala', 'Escala'], ['opacidade', 'Opacidade']]], ['forca', 'Força do pulso', 'n', 75, 1, 100, '%'], ['sensibilidade', 'Sensibilidade (pega batidas mais fracas)', 'n', 70, 5, 100, '%'], ['suavidade', 'Suavidade da volta', 'n', 50, 0, 95, '%'], ['canal', 'Canal', 's', 'ambos', [['ambos', 'Os dois'], ['esquerdo', 'Esquerdo'], ['direito', 'Direito']]]] },
      { id: 'fade-audio', nome: 'Fade de áudio', ic: I.fadeAudio, desc: 'Abaixa o som no fim da camada.', ops: [['duracao', 'Duração (s)', 'n', 1, 0.1, 30]] },
      { id: 'fade-final', nome: 'Fade final', ic: I.fadeFinal, desc: 'Escurece para preto no fim da comp.', ops: [['duracao', 'Duração (s)', 'n', 1, 0.1, 30]] }
    ] },
    { grupo: 'Limpeza', itens: [
      { id: 'apagar', nome: 'Limpar camada', ic: I.apagar, desc: 'Remove efeitos, expressões, keyframes e marcadores.', perigo: true, ops: [['efeitos', 'Efeitos', 'b', true], ['expressoes', 'Expressões', 'b', true], ['keyframes', 'Keyframes', 'b', true], ['marcadores', 'Marcadores', 'b', true]] },
      { id: 'limpar-cache', nome: 'Limpar cache', ic: I.cache, desc: 'Libera a memória e o cache do After. Apaga também o histórico de desfazer.', perigo: true, semDesfazer: true, ops: [] }
    ] }
  ];

  // presets do Animar: id igual ao do jsx; "css" é a animação da prévia
  var ANIMAR = [
    ['fade', 'Fade', 'pv-fade'], ['slide-cima', 'Slide', 'pv-slide', 'dir', 'baixo'], ['subida-suave', 'Deslize suave', 'pv-sobe', 'dir', 'baixo'],
    ['quique-lateral', 'Quique', 'pv-quique-l', 'dir', 'esquerda'],
    ['escala-elastica', 'Escala elástica', 'pv-elastica'], ['overshoot', 'Overshoot', 'pv-over'], ['snap', 'Snap', 'pv-snap'],
    ['zoom-profundo', 'Zoom profundo', 'pv-zoom', 'zoom', 'out'], ['chegada', 'Chegada', 'pv-chegada', 'zoom', 'out'], ['queda-giro', 'Queda com giro', 'pv-queda'],
    ['giro-baixo', 'Giro para baixo', 'pv-giro'], ['virar-x', 'Virar X', 'pv-flipx'], ['virar-y', 'Virar Y', 'pv-flipy'],
    ['cartao', 'Cartão', 'pv-cartao'], ['rolo', 'Rolo', 'pv-rolo', 'dir', 'esquerda'], ['balanco', 'Balanço', 'pv-balanco'],
    ['cortina-h', 'Cortina horizontal', 'pv-cortina-h'], ['cortina-v', 'Cortina vertical', 'pv-cortina-v'], ['desfoque', 'Desfoque', 'pv-blur']
  ];

  var CAMERA = [
    { id: 'entrada-fundo', nome: 'Entrada pelo fundo', ic: I.entradaFundo, desc: 'A câmera começa bem aproximada no fundo da arte e vai abrindo até mostrar o flyer inteiro, a partir da agulha.', ops: [['duracao', 'Duração (s)', 'n', 2.5, 0.2, 20], ['zoomInicial', 'Zoom inicial no fundo (×)', 'n', 5, 1.2, 15]] },
    { id: 'descida', nome: 'Descida pelo flyer', ic: I.camDescida, desc: 'Câmera aproximada percorre o flyer de cima para baixo (ou de baixo para cima).', ops: [['direcao', 'Sentido', 's', 'descer', [['descer', '↓ Descer'], ['subir', '↑ Subir']]], ['quanto', 'Quanto percorre do flyer', 'n', 100, 5, 100, '%'], ['duracao', 'Duração', 'n', 4, 0.5, 60, 's'], ['zoom', 'Zoom durante o percurso', 'n', 1.8, 1.1, 6, '×']] },
    { id: 'dolly', nome: 'Dolly zoom', ic: I.camDolly, desc: 'Efeito vertigem: a câmera anda e a lente compensa, o flyer fica do mesmo tamanho e o fundo estica.', ops: [['intensidade', 'Intensidade', 'n', 50, 5, 100, '%'], ['duracao', 'Duração', 'n', 2, 0.3, 20, 's'], ['direcao', 'Câmera', 's', 'afasta', [['afasta', 'Recua'], ['aproxima', 'Avança']]]] },
    { id: 'orbita', nome: 'Órbita', ic: I.camOrbita, desc: 'A câmera gira em volta da arte e volta de frente (mostra a profundidade do parallax).', ops: [['graus', 'Graus', 'n', 15, 1, 60, '°'], ['duracao', 'Duração', 'n', 3, 0.3, 30, 's'], ['curva', 'Curva da órbita', 's', 'termina-devagar', [['suave', 'Suave nas pontas'], ['forte', 'Bem suave'], ['comeca-devagar', 'Começa devagar'], ['termina-devagar', 'Termina devagar'], ['linear', 'Constante']]], ['sentido', 'Para', 's', 'direita', [['esquerda', 'Esquerda'], ['direita', 'Direita']]]] },
    { id: 'lateral', nome: 'Revelação lateral', ic: I.camLateral, desc: 'A câmera desliza de lado passando pelas camadas da frente.', ops: [['direcao', 'Para', 's', 'direita', [['esquerda', '← Esquerda'], ['direita', 'Direita →']]], ['duracao', 'Duração', 'n', 3, 0.3, 30, 's'], ['zoom', 'Zoom (1 = sem zoom)', 'n', 1.3, 1, 4, '×']] },
    { id: 'zoom-batida', nome: 'Zoom na batida', ic: I.camBatida, desc: 'Empurrõezinhos de câmera no ritmo da música, a partir da agulha.', ops: [['intensidade', 'Intensidade', 'n', 40, 2, 100, '%'], ['audio', 'Música', 'audio', '']] },
    { id: 'impacto', nome: 'Tremida de impacto', ic: I.camImpacto, desc: 'Um tremor curto e forte na agulha, que some suave (entrada de atração, drop).', ops: [['intensidade', 'Intensidade', 'n', 40, 2, 300, 'px'], ['duracao', 'Duração', 'n', 0.6, 0.15, 3, 's']] },
    { id: 'rack', nome: 'Rack focus', ic: I.camRack, desc: 'O foco passa de uma camada para outra sem a câmera andar.', ops: [['de', 'Foco começa em', 'camada', 'inicial', [['inicial', 'Foco inicial (toda a arte nítida)']]], ['para', 'Foco termina em', 'camada', ''], ['duracao', 'Duração', 'n', 1.2, 0.2, 10, 's'], ['abertura', 'Abertura (f/)', 'n', 2.8, 0.5, 22]] },
    { id: 'fuga', nome: 'Final de fuga', ic: I.camFuga, desc: 'A câmera atravessa o flyer até passar do fundo (transição de saída).', ops: [['duracao', 'Duração', 'n', 2, 0.3, 20, 's'], ['curva', 'Curva de velocidade', 's', 'termina-devagar', [['termina-devagar', 'Sai rápido, freia no fim'], ['comeca-devagar', 'Começa devagar e acelera'], ['suave', 'Suave nas pontas'], ['forte', 'Bem suave'], ['linear', 'Constante']]]] },
    { id: 'wiggle', nome: 'Câmera na mão', ic: I.mao, desc: 'Tremidinha natural na câmera (keyframes).', ops: [['amplitude', 'Amplitude (px)', 'n', 12, 1, 500], ['frequencia', 'Frequência (Hz)', 'n', 1.5, 0.2, 10], ['duracao', 'Duração (s)', 'n', 0, 0, 3600]] }
  ];

    var FOCO = { id: 'foco', nome: 'Pontos de foco', ic: I.foco, mapa: true, desc: 'Monte as paradas da câmera: em cada uma, a camada e quanto tempo ela fica.', ops: [['viagem', 'Viagem (s)', 'n', 1, 0.1, 10], ['pausa', 'Pausa em cada (s)', 'n', 1, 0, 30], ['aproximacao', 'Aproximação (×)', 'n', 1.6, 1, 10], ['voltar', 'Voltar ao início', 'b', true], ['parallax', 'Com parallax', 'b', false], ['desfoque', 'Desfocar o resto', 'b', false], ['forcaDesfoque', 'Força do desfoque (%)', 'n', 70, 1, 100]] };

  // Arcano Design (painel do Photoshop): só o que serve no Photoshop
  function abaDe(id) { for (var i = 0; i < ABAS.length; i++) { if (ABAS[i].id === id) { return ABAS[i]; } } return null; }
  // ordem do dono (30/10/2026): Chat IA, Presets, Ferramentas, Imagem IA, Arte PSD, Biblioteca, Conta.
  // Separar em camadas saiu da barra: abre pelo botão dele em Ferramentas (oculta; a aba Ferramentas fica acesa).
  var ABAS_PS = [
    { id: 'chat', nome: 'Chat IA', curto: 'Chat IA', desc: 'Peça em português o que fazer no Photoshop.', ic: abaDe('chat').ic },
    { id: 'presets-ps', nome: 'Presets', curto: 'Presets', desc: 'Um clique e a IA do chat faz na arte, com as ferramentas do próprio Photoshop.', ic: abaDe('presets').ic },
    { id: 'efeitos-ps', nome: 'Ferramentas', curto: 'Ferramentas', desc: 'As ferramentas do ArcanoApp na camada selecionada, iguais às do site e com os mesmos créditos.', ic: abaDe('ferramentas').ic },
    { id: 'img', nome: 'Gerar imagem', curto: 'Imagem IA', desc: 'Edita a camada ou cria imagem com o GPT Image, usando seus créditos do ArcanoApp.', ic: abaDe('img').ic },
    { id: 'artes', nome: 'Arte PSD', curto: 'Arte PSD', desc: 'Suas artes editáveis do ArcanoApp: clique e o PSD abre no Photoshop.', ic: svg('<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/><path class="a-brilho" d="M7 7.2v2.6M5.7 8.5h2.6"/>', 'ic-artes') },
    { id: 'biblioteca', nome: 'Biblioteca', curto: 'Biblioteca', desc: 'Assets de design do Arcano: clique para colocar no documento aberto.', ic: abaDe('biblioteca').ic },
    { id: 'conta', nome: 'Conta', curto: 'Conta', desc: 'Conta ArcanoApp, créditos, motor de IA e ajustes.', ic: abaDe('conta').ic },
    { id: 'camadas', oculta: true, pai: 'efeitos-ps', nome: 'Separar em camadas', curto: 'Camadas', desc: 'Separa a imagem selecionada em camadas editáveis com IA, organizadas e com nome, no mesmo documento.', ic: svg('<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5l9 4.5 9-4.5"/>', 'ic-camadas') }
  ];
  if (window.ARCANO_HOST === 'ps') { ABAS = ABAS_PS; }

  // Efeitos do Photoshop (aba "Efeitos" do Arcano Design): cada um manda um pedido para a IA do chat, que faz
  // com as ferramentas do próprio Photoshop na camada selecionada. Os pedidos ficam em js/app.js (PEDIDOS_EFEITOS_PS).
  // aba Ferramentas: as ferramentas do ArcanoApp, iguais às do site (mesma ponte, mesma biblioteca, mesmos créditos): js/app.js FERR_RH
  var EFEITOS_PS = [
    { grupo: 'Ferramentas do ArcanoApp', cards: true, itens: [
      { id: 'ps-separar', direto: true, especial: 'aba', aba: 'camadas', novo: true, nome: 'Separar em camadas', sub: 'Cada elemento numa camada', ic: I.psSeparar, desc: 'Separa a imagem selecionada em camadas editáveis com IA, organizadas e com nome, no mesmo documento. Usa créditos.' },
      { id: 'ps-upscale', direto: true, especial: 'rh', ferr: 'upscale', nome: 'Upscaler Arcano', sub: 'Mais nitidez e resolução', ic: I.psUpscale, desc: 'Aumenta a qualidade da camada selecionada com o Upscaler Arcano (V3 Turbo) do ArcanoApp: escolha o tipo da imagem e o tamanho. Usa créditos.' },
      { id: 'ps-remover-fundo', direto: true, especial: 'rh', ferr: 'fundo', nome: 'Remover fundo', sub: 'Recorta o assunto da imagem', ic: I.psFundo, desc: 'Tira o fundo da camada selecionada com o Remover Fundo do ArcanoApp. Usa créditos.' },
      { id: 'ps-cloner', direto: true, especial: 'rh', ferr: 'cloner', nome: 'Arcano Cloner', sub: 'A pessoa numa nova foto', ic: I.psCloner, desc: 'Clona a pessoa da camada selecionada numa foto de referência da biblioteca (ou sua). Usa créditos.' },
      { id: 'ps-veste', direto: true, especial: 'rh', ferr: 'veste', nome: 'Veste AI', sub: 'Troca a roupa da pessoa', ic: I.psVeste, desc: 'Veste a pessoa da camada selecionada com a roupa de uma referência da biblioteca (ou sua). Usa créditos.' },
      { id: 'ps-pose', direto: true, especial: 'rh', ferr: 'pose', nome: 'Pose Changer', sub: 'Muda a pose da pessoa', ic: I.psPose, desc: 'Coloca a pessoa da camada selecionada na pose de uma referência da biblioteca (ou sua). Usa créditos.' },
    ] }
  ];
  // aba Presets: pedidos prontos para a IA do chat, feitos com as ferramentas do próprio Photoshop (js/app.js PEDIDOS_EFEITOS_PS)
  var PRESETS_PS = [
    { grupo: 'Presets com IA', itens: [
      { id: 'ps-ambientar', direto: true, nome: 'Ambientar na arte', ic: I.psAmbientar, desc: 'Integra a foto ou imagem selecionada ao resto da arte: luz, cor, contraste, sombra e bordas, sem mexer no resto.' },
      { id: 'ps-expandir', direto: true, nome: 'Expandir imagem', ic: I.psExpandir, desc: 'A imagem selecionada ganha mais cenário em volta (até cobrir o documento), continuando o fundo, sem mudar o que já existe. Usa créditos da IA de imagem.' },
      { id: 'ps-stories-feed', direto: true, documento: true, nome: 'Stories ↔ Feed', ic: I.psStoriesFeed, desc: 'A arte em Stories vira Feed; em Feed vira Stories. Numa cópia do documento: mesma arte, rediagramada, sem esticar, sem borda ruim e sem perder nada.' },
      { id: 'ps-organizar', direto: true, documento: true, nome: 'Organizar camadas', ic: I.psOrganizar, desc: 'Organiza o painel Camadas no padrão dos PSDs do Arcano: grupos por função (AJUSTES, LUZ, LOGO, DATA, TÍTULO, RODAPÉ, BASE, ARTISTAS, BG) e nomes claros, sem mudar nada na arte.' }
    ] }
  ];

  window.ArcanoCatalogo = { ABAS: ABAS, FERRAMENTAS: FERRAMENTAS, EFEITOS_PS: EFEITOS_PS, PRESETS_PS: PRESETS_PS, ANIMAR: ANIMAR, CAMERA: CAMERA, FOCO: FOCO, ICONES: I };
})();
