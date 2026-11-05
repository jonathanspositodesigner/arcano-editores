//! Arcano Layers (programa de PC): o painel do Arcano Motion / Arcano Design DENTRO da janela do
//! programa, num espaço do próprio editor (o editor diz onde a cada quadro), como os painéis CEP
//! do After/Photoshop. É uma página web (o MESMO plugin do navegador) num WebView do sistema
//! (WebView2 no Windows, WKWebView no Mac), servida pelo Arcano Conector em 127.0.0.1.
//! Também trava o programa até a pessoa entrar com a conta do ArcanoApp (o login do painel fica
//! no conta.json comum, o mesmo do plugin do After/Photoshop).

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[cfg(any(windows, target_os = "macos"))]
use wry::raw_window_handle as wry_janela;
#[cfg(not(any(windows, target_os = "macos")))]
mod wry_janela {
    pub trait HasWindowHandle {}
    impl<T> HasWindowHandle for T {}
}

/// Onde o painel fica: o espaço que o editor reservou neste quadro (pontos do egui).
pub type Lugar = Option<egui::Rect>;

pub struct Painel {
    /// `video` ou `imagem` (vai na URL: ?pc=video | ?pc=imagem).
    app: &'static str,
    #[cfg(any(windows, target_os = "macos"))]
    web: Option<wry::WebView>,
    #[cfg(any(windows, target_os = "macos"))]
    _contexto: Option<wry::WebContext>,
    /// Endereço do conector (achado numa thread; `None` enquanto procura).
    conector: Arc<Mutex<Option<String>>>,
    procurando: bool,
    /// Quando começou a procurar o conector (para avisar se demorar).
    inicio: Option<Instant>,
    ultimo_lugar: Option<[i32; 4]>,
    visivel: bool,
    logado: bool,
    conferido: Option<Instant>,
    erro: Option<String>,
    /// Recados do painel para o editor (`window.ipc.postMessage` no WebView): a barra rápida e a
    /// conta do editor de imagem (`photocraft_ui_egui::arcano::receber`). O vídeo não usa.
    ao_receber: Option<fn(&str)>,
    /// Pedidos do editor esperando o painel abrir.
    fila: Vec<String>,
    /// Painel "só ferramentas" (editor de imagem, em cima do painel completo): o MESMO plugin, aberto
    /// direto na aba Ferramentas e sem a barra de abas (script injetado ao carregar a página).
    so_ferramentas: bool,
}

/// Painel de cima (só ferramentas): abre a aba Ferramentas do Photoshop (efeitos-ps), esconde a barra de
/// abas e NUNCA sai das ferramentas. Só valem a lista de ferramentas e as telas delas (Separar em
/// camadas); se o plugin pular para o chat (ex.: a IA revisar depois de decompor) ou outra aba, volta na hora.
const SCRIPT_SO_FERRAMENTAS: &str = r#"(function () {
  if (window.top !== window) { return; }
  window.ARCANO_SO_FERRAMENTAS = true;
  var PERMITIDOS = { 'painel-efeitos-ps': 1, 'painel-camadas': 1 };
  setInterval(function () {
    if (document.head && !document.getElementById('arcano-so-ferramentas')) {
      var s = document.createElement('style');
      s.id = 'arcano-so-ferramentas';
      s.textContent = '#abas-caixa,#sub-abas{display:none!important}';
      document.head.appendChild(s);
    }
    var b = document.querySelector('.aba[data-aba="efeitos-ps"]');
    if (!b) { return; }
    var fora = false, algum = false;
    var m = document.getElementById('mensagens'), cfgIA = document.getElementById('chat-config');
    if ((m && !m.hidden) || (cfgIA && !cfgIA.hidden)) { fora = true; }
    var ps = document.querySelectorAll('.painel-aba');
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].hidden) { continue; }
      algum = true;
      if (!PERMITIDOS[ps[i].id]) { fora = true; }
    }
    if (fora || !algum) { b.click(); }
  }, 400);
})();"#;

impl Painel {
    pub fn new(app: &'static str) -> Self {
        Self {
            app,
            #[cfg(any(windows, target_os = "macos"))]
            web: None,
            #[cfg(any(windows, target_os = "macos"))]
            _contexto: None,
            conector: Arc::new(Mutex::new(None)),
            procurando: false,
            inicio: None,
            ultimo_lugar: None,
            visivel: false,
            logado: false,
            conferido: None,
            erro: None,
            ao_receber: None,
            fila: Vec::new(),
            so_ferramentas: false,
        }
    }

    /// O painel de ferramentas de cima (editor de imagem): só aparece com a conta entrada.
    pub fn ferramentas(app: &'static str) -> Self {
        Self { so_ferramentas: true, ..Self::new(app) }
    }

    /// O programa está fechando: solta o painel ainda com a janela viva e garante que o processo
    /// termina (o WebView do sistema não pode segurar o programa aberto com a janela escura).
    pub fn sair(&mut self) {
        #[cfg(any(windows, target_os = "macos"))]
        {
            if let Some(web) = &self.web {
                let _ = web.set_visible(false);
            }
            self.web = None;
            self._contexto = None;
        }
        std::thread::spawn(|| {
            std::thread::sleep(Duration::from_secs(8));
            log::warn!("o programa não terminou 8 s depois de fechar: encerrando");
            std::process::exit(0);
        });
    }

    /// O que fazer com os recados do painel (o editor de imagem liga a barra rápida aqui).
    pub fn ao_receber(&mut self, f: fn(&str)) {
        self.ao_receber = Some(f);
    }

    /// Um pedido do editor para o painel (JSON): vai para `window.arcanoBarra(...)` do plugin.
    pub fn mandar(&mut self, json: &str) {
        self.fila.push(json.to_string());
    }

    /// A pasta comum do Arcano (a mesma do plugin): ArcanoMotion/.
    fn pasta_comum() -> Option<PathBuf> {
        let casa = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from);
        if cfg!(windows) {
            std::env::var_os("APPDATA").map(PathBuf::from).or_else(|| casa.map(|c| c.join("AppData").join("Roaming"))).map(|p| p.join("ArcanoMotion"))
        } else if cfg!(target_os = "macos") {
            casa.map(|c| c.join("Library/Application Support/ArcanoMotion"))
        } else {
            casa.map(|c| c.join(".arcanomotion"))
        }
    }

    /// Entrou com a conta do ArcanoApp (no painel deste programa ou no plugin do After/Photoshop).
    pub fn logado(&mut self) -> bool {
        if self.conferido.is_some_and(|t| t.elapsed() < Duration::from_secs(2)) {
            return self.logado;
        }
        self.conferido = Some(Instant::now());
        self.logado = Self::pasta_comum()
            .and_then(|p| std::fs::read_to_string(p.join("conta.json")).ok())
            .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
            .is_some_and(|v| v.get("refresh").and_then(|r| r.as_str()).is_some_and(|r| !r.is_empty()) && v.get("uid").is_some_and(|u| !u.is_null()));
        self.logado
    }

    /// Procura o Arcano Conector (portas 47821-47825); se não está rodando, abre ele.
    fn procurar_conector(&mut self) {
        if self.procurando {
            return;
        }
        self.procurando = true;
        self.inicio = Some(Instant::now());
        let alvo = self.conector.clone();
        std::thread::spawn(move || {
            let mut abriu = false;
            loop {
                for porta in 47821..=47825u16 {
                    if responde(porta) {
                        *alvo.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some(format!("http://127.0.0.1:{porta}"));
                        return;
                    }
                }
                if !abriu {
                    abriu = true;
                    abrir_conector();
                }
                std::thread::sleep(Duration::from_millis(1500));
            }
        });
    }

    /// A cada quadro: põe o painel no espaço reservado (ou o esconde). Sem login e sem espaço
    /// (painel fechado), aparece na direita mesmo assim, para dar para entrar.
    pub fn quadro<W: wry_janela::HasWindowHandle>(&mut self, ctx: &egui::Context, frame: &W, lugar: Lugar) {
        let lugar = match lugar {
            Some(r) => Some(r),
            None if !self.so_ferramentas && !self.logado() => {
                let t = ctx.content_rect();
                let w = 420.0_f32.min(t.width() * 0.5);
                Some(egui::Rect::from_min_max(egui::pos2(t.max.x - w, t.min.y + 28.0), t.max))
            }
            None => None,
        };
        // menu, lista ou janela de aviso aberta (ex.: "Salvar alterações?" ao fechar o programa): o
        // painel é uma janela do sistema e ficaria por cima, aceso no meio do fundo escurecido.
        // Também qualquer janela, menu ou caixa do editor que passe por cima do espaço do painel
        // (Nova composição, Configurações, efeitos...): o painel sai da frente enquanto ela existir.
        let aviso = ctx.memory(|m| m.top_modal_layer().is_some());
        let coberto = lugar.is_some_and(|r| {
            let meus = [egui::Id::unique("arcano_painel_estado_video"), egui::Id::unique("arcano_painel_estado_imagem")];
            ctx.memory(|m| {
                m.areas().visible_layer_ids().into_iter().any(|l| {
                    matches!(l.order, egui::Order::Middle | egui::Order::Foreground)
                        && !meus.contains(&l.id)
                        && m.area_rect(l.id).is_some_and(|a| a.intersects(r.shrink(2.0)))
                })
            })
        });
        let lugar = if (self.logado && egui::Popup::is_any_open(ctx)) || aviso || coberto || (self.so_ferramentas && !self.logado()) { None } else { lugar };
        #[cfg(any(windows, target_os = "macos"))]
        {
            if self.web.is_none() && lugar.is_some() && self.erro.is_none() {
                let base = self.conector.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone();
                match base {
                    None => {
                        self.procurar_conector();
                        ctx.request_repaint_after(Duration::from_millis(300));
                    }
                    Some(base) => self.criar(&base, frame),
                }
            }
            if let Some(web) = &self.web {
                match lugar {
                    Some(r) => {
                        let ppp = ctx.pixels_per_point();
                        let q = [(r.min.x * ppp).round() as i32, (r.min.y * ppp).round() as i32, (r.width() * ppp).round().max(1.0) as i32, (r.height() * ppp).round().max(1.0) as i32];
                        if self.ultimo_lugar != Some(q) {
                            self.ultimo_lugar = Some(q);
                            let _ = web.set_bounds(wry::Rect {
                                position: wry::dpi::PhysicalPosition::new(q[0], q[1]).into(),
                                size: wry::dpi::PhysicalSize::new(q[2] as u32, q[3] as u32).into(),
                            });
                        }
                        if !self.visivel {
                            self.visivel = true;
                            let _ = web.set_visible(true);
                        }
                    }
                    None => {
                        if self.visivel {
                            self.visivel = false;
                            let _ = web.set_visible(false);
                            let _ = web.focus_parent();
                        }
                    }
                }
                // Clique no editor (o clique dentro do painel não chega ao egui): o teclado volta para
                // o editor. Sem isso o painel continuava com o foco e Delete, Ctrl+Z e os atalhos iam
                // para ele, não para a composição/linha do tempo.
                if ctx.input(|i| i.pointer.any_pressed()) {
                    let _ = web.focus_parent();
                }
            }
        }
        #[cfg(any(windows, target_os = "macos"))]
        if let Some(web) = &self.web
            && !self.fila.is_empty()
        {
            for p in std::mem::take(&mut self.fila) {
                let _ = web.evaluate_script(&format!("window.arcanoBarra && window.arcanoBarra({p})"));
            }
        }
        #[cfg(not(any(windows, target_os = "macos")))]
        let _ = frame;
        if let Some(r) = lugar {
            self.estado(ctx, r);
        }
    }

    /// Embaixo do painel (só aparece quando o painel não está por cima): o que está acontecendo,
    /// o erro, se houver, e os botões "Tentar de novo" e "Abrir no navegador". Nunca fica parado
    /// num "Abrindo…" sem explicação.
    fn estado(&mut self, ctx: &egui::Context, r: egui::Rect) {
        let nome = if self.app == "video" { "Arcano Motion" } else { "Arcano Design" };
        let base = self.conector.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone();
        let demorou = base.is_none() && self.inicio.is_some_and(|t| t.elapsed() > Duration::from_secs(12));
        let texto = match (&self.erro, &base) {
            (Some(e), _) => format!(
                "Não consegui abrir o painel do {nome} aqui dentro.\n\n{e}\n\nNo Windows, instale o Microsoft Edge WebView2 e abra o programa de novo. Enquanto isso, use \"Abrir no navegador\"."
            ),
            (None, None) if demorou => "O Arcano Conector não está respondendo.\nToque em \"Tentar de novo\". Se continuar, reinstale o programa (o conector vem junto).".to_owned(),
            (None, None) => "Procurando o Arcano Conector…".to_owned(),
            (None, Some(_)) => format!("Abrindo o painel do {nome}…\nSe ficar parado aqui, use \"Abrir no navegador\"."),
        };
        if self.erro.is_none() {
            ctx.request_repaint_after(Duration::from_secs(1));
        }
        let url = format!("{}/ui/plugin/index-web.html?pc={}", base.as_deref().unwrap_or("http://127.0.0.1:47821"), self.app);
        let mostrar_tentar = self.erro.is_some() || demorou;
        let mut tentar = false;
        egui::Area::new(egui::Id::unique(if self.app == "video" { "arcano_painel_estado_video" } else { "arcano_painel_estado_imagem" }))
            .order(egui::Order::Foreground)
            .fixed_pos(r.min)
            .show(ctx, |ui| {
                ui.set_width(r.width());
                ui.set_height(r.height());
                ui.painter().rect_filled(r, 0.0, egui::Color32::from_rgb(20, 20, 22));
                ui.add_space((r.height() * 0.3).min(160.0));
                ui.vertical_centered(|ui| {
                    ui.set_max_width((r.width() - 32.0).max(120.0));
                    ui.label(egui::RichText::new(texto).size(13.0).color(egui::Color32::from_gray(200)));
                    ui.add_space(12.0);
                    if mostrar_tentar && ui.button("Tentar de novo").clicked() {
                        tentar = true;
                    }
                    ui.add_space(6.0);
                    if ui.button("Abrir no navegador").clicked() {
                        abrir_no_navegador(&url);
                    }
                });
            });
        if tentar {
            self.erro = None;
            self.ultimo_lugar = None;
            self.visivel = false;
            self.inicio = Some(Instant::now());
            #[cfg(any(windows, target_os = "macos"))]
            {
                self.web = None;
                self._contexto = None;
            }
            if base.is_none() {
                abrir_conector();
            }
        }
    }

    #[cfg(any(windows, target_os = "macos"))]
    fn criar<W: wry_janela::HasWindowHandle>(&mut self, base: &str, frame: &W) {
        let url = format!("{base}/ui/plugin/index-web.html?pc={}{}", self.app, if self.so_ferramentas { "&so=ferramentas" } else { "" });
        // Windows: os dados do WebView ficam na pasta do usuário (Arquivos de Programas não é gravável).
        let dados = Self::pasta_comum().map(|p| p.join(format!("painel-{}", self.app)));
        let mut contexto = wry::WebContext::new(dados);
        let ao_receber = self.ao_receber;
        let mut construtor = wry::WebViewBuilder::new_with_web_context(&mut contexto);
        if self.so_ferramentas {
            construtor = construtor.with_initialization_script(SCRIPT_SO_FERRAMENTAS);
        }
        let r = construtor
            // recados do painel para o editor (barra rápida, conta)
            .with_ipc_handler(move |pedido: wry::http::Request<String>| {
                if let Some(f) = ao_receber {
                    f(pedido.body());
                }
            })
            .with_url(url)
            .with_visible(false)
            // link que sai do Arcano (site, cadastro, suporte, pagamento): abre no navegador do PC
            .with_new_window_req_handler(|u, _| {
                abrir_no_navegador(&u);
                wry::NewWindowResponse::Deny
            })
            .with_navigation_handler(|u| {
                let dentro = u.starts_with("http://127.0.0.1") || u.starts_with("http://localhost") || u.starts_with("about:") || u.starts_with("data:") || u.starts_with("blob:");
                if !dentro {
                    abrir_no_navegador(&u);
                }
                dentro
            })
            .with_bounds(wry::Rect { position: wry::dpi::PhysicalPosition::new(0, 0).into(), size: wry::dpi::PhysicalSize::new(10u32, 10u32).into() })
            .build_as_child(frame);
        match r {
            Ok(web) => {
                self.web = Some(web);
                self._contexto = Some(contexto);
                self.ultimo_lugar = None;
                self.visivel = false;
            }
            Err(e) => {
                log::error!("painel do Arcano: {e}");
                // fica anotado também na pasta do Arcano (ArcanoMotion/painel-<app>-erro.txt), fácil de achar
                if let Some(p) = Self::pasta_comum() {
                    let _ = std::fs::create_dir_all(&p);
                    let _ = std::fs::write(p.join(format!("painel-{}-erro.txt", self.app)), format!("{e:?}\n{e}\n"));
                }
                self.erro = Some(format!("{e}"));
            }
        }
    }

    /// Sem login: cobre o editor com o aviso, com "Criar conta" (abre o ArcanoApp no navegador).
    /// O painel, por cima, continua clicável para entrar.
    pub fn trava(&mut self, ctx: &egui::Context, nome_painel: &str) {
        if self.logado() {
            return;
        }
        ctx.request_repaint_after(Duration::from_secs(2));
        let tela = ctx.content_rect();
        egui::Area::new(egui::Id::unique("arcano_trava")).order(egui::Order::Foreground).fixed_pos(tela.min).show(ctx, |ui| {
            let _ = ui.allocate_rect(tela, egui::Sense::click_and_drag());
            ui.painter().rect_filled(tela, 0.0, egui::Color32::from_rgba_unmultiplied(12, 10, 18, 240));
        });
        // o centro da área livre (sem a coluna do painel, à direita)
        let livre = egui::Rect::from_min_max(tela.min, egui::pos2((tela.max.x - 420.0).max(tela.min.x + 200.0), tela.max.y));
        let erro = self.erro.clone();
        egui::Area::new(egui::Id::unique("arcano_trava_conteudo"))
            .order(egui::Order::Tooltip)
            .pivot(egui::Align2::CENTER_CENTER)
            .fixed_pos(livre.center())
            .show(ctx, |ui| {
                ui.set_max_width(420.0);
                ui.vertical_centered(|ui| {
                    let cor = egui::Color32::from_rgb(235, 228, 250);
                    match erro {
                        Some(e) => {
                            ui.label(egui::RichText::new(format!("Não consegui abrir o painel do {nome_painel}.")).size(20.0).color(cor).strong());
                            ui.add_space(8.0);
                            ui.label(egui::RichText::new(format!("{e}\nNo Windows, instale o Microsoft Edge WebView2 e abra o programa de novo.")).size(14.0).color(cor));
                        }
                        None => {
                            ui.label(egui::RichText::new("Entre com a sua conta do ArcanoApp").size(22.0).color(cor).strong());
                            ui.add_space(6.0);
                            ui.label(egui::RichText::new(format!("Use o mesmo e-mail e senha do site, no painel do {nome_painel} à direita.")).size(14.0).color(egui::Color32::from_gray(190)));
                            ui.add_space(18.0);
                            let criar = egui::Button::new(egui::RichText::new("Criar conta no ArcanoApp").size(16.0).color(egui::Color32::WHITE).strong())
                                .fill(egui::Color32::from_rgb(168, 85, 247))
                                .corner_radius(10.0)
                                .min_size(egui::vec2(260.0, 44.0));
                            if ui.add(criar).clicked() {
                                abrir_no_navegador(CRIAR_CONTA);
                            }
                            ui.add_space(8.0);
                            ui.label(egui::RichText::new("Abre o site do ArcanoApp. Depois de criar, volte e entre no painel.").size(12.0).color(egui::Color32::from_gray(150)));
                        }
                    }
                });
            });
    }
}

/// Cadastro do ArcanoApp (a página de login abre direto no "criar conta").
const CRIAR_CONTA: &str = "https://arcanoapp.voxvisual.com.br/login?signup=1";

/// Abre um endereço no navegador padrão (links do painel que saem do Arcano: site, suporte, cadastro).
pub fn abrir_no_navegador(url: &str) {
    if !(url.starts_with("https://") || url.starts_with("http://") || url.starts_with("mailto:")) {
        return;
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", url]).creation_flags(0x0800_0000).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(url).spawn();
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
}

/// A porta do canal do painel: a primeira livre a partir de `base` (no Windows, faixas de porta
/// podem estar reservadas pelo sistema). Fica anotada em ArcanoMotion/controle-<app>.porta, onde o
/// Arcano Conector procura.
pub fn porta_livre(app: &str, base: u16) -> u16 {
    let porta = (base..base.saturating_add(40)).find(|p| std::net::TcpListener::bind(("127.0.0.1", *p)).is_ok()).unwrap_or(base);
    if let Some(pasta) = Painel::pasta_comum() {
        let _ = std::fs::create_dir_all(&pasta);
        let _ = std::fs::write(pasta.join(format!("controle-{app}.porta")), porta.to_string());
    }
    porta
}

fn responde(porta: u16) -> bool {
    use std::io::{Read, Write};
    let Ok(mut s) = std::net::TcpStream::connect_timeout(&std::net::SocketAddr::from(([127, 0, 0, 1], porta)), Duration::from_millis(400)) else {
        return false;
    };
    let _ = s.set_read_timeout(Some(Duration::from_millis(1500)));
    // o conector só aceita Host COM a porta (senão 403) e, sem Origin, responde na hora
    // (com Origin ele ainda confere o Claude Code, que pode passar do tempo de espera)
    if s.write_all(format!("GET /status HTTP/1.0\r\nHost: 127.0.0.1:{porta}\r\n\r\n").as_bytes()).is_err() {
        return false;
    }
    let mut r = String::new();
    let _ = s.take(8192).read_to_string(&mut r);
    // só o conector que serve o painel (0.4 ou mais novo); um antigo na porta não serve
    let versao = r.split("\"versao\":\"").nth(1).and_then(|v| v.split('"').next()).unwrap_or("");
    let mut partes = versao.split('.').map(|n| n.parse::<u32>().unwrap_or(0));
    let (maior, menor) = (partes.next().unwrap_or(0), partes.next().unwrap_or(0));
    r.contains("arcano-conector") && (maior > 0 || menor >= 4)
}

/// O Arcano Conector instalado junto (Windows: %LOCALAPPDATA%\ArcanoConector; Mac: Application Support/Arcano).
fn abrir_conector() {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        if let Some(p) = std::env::var_os("LOCALAPPDATA").map(PathBuf::from).map(|p| p.join("ArcanoConector").join("ArcanoConector.exe"))
            && p.is_file()
        {
            let _ = std::process::Command::new(p).creation_flags(0x0800_0000).spawn();
        }
    }
    #[cfg(target_os = "macos")]
    {
        let p = PathBuf::from("/Library/Application Support/Arcano/ArcanoConector");
        if p.is_file() {
            let _ = std::process::Command::new(p).spawn();
        }
    }
}

/// Projeto do After (.aep/.aet) jogado no programa de vídeo: copia para a pasta temporária que o
/// conector deixa o painel ler ("arcano-aep") e devolve o recado para o painel montar o projeto.
#[allow(dead_code)]
pub fn aep_para_painel(caminho: &str) -> Option<String> {
    let origem = std::path::Path::new(caminho);
    let nome = origem.file_name()?.to_string_lossy().to_string();
    let pasta = std::env::temp_dir().join("arcano-aep");
    std::fs::create_dir_all(&pasta).ok()?;
    let destino = pasta.join(format!("{}-{nome}", std::process::id()));
    std::fs::copy(origem, &destino).ok()?;
    Some(serde_json::json!({"tipo": "aep", "caminho": destino.to_string_lossy(), "nome": nome}).to_string())
}

/// Avisos para o editor mostrar (toast), vindos dos recados do painel.
static AVISOS: std::sync::Mutex<Vec<String>> = std::sync::Mutex::new(Vec::new());

/// Os avisos que chegaram (e esvazia).
#[allow(dead_code)]
pub fn avisos() -> Vec<String> {
    std::mem::take(&mut *AVISOS.lock().unwrap_or_else(std::sync::PoisonError::into_inner))
}

fn avisar(t: String) {
    AVISOS.lock().unwrap_or_else(std::sync::PoisonError::into_inner).push(t);
}

/// base64 padrão (o .aep vem do painel assim pelo `window.ipc.postMessage`).
fn de_base64(s: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let (mut buf, mut bits) = (0u32, 0u32);
    for c in s.bytes() {
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' | b'\n' | b'\r' | b' ' => continue,
            _ => return None,
        };
        buf = (buf << 6) | u32::from(v);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    Some(out)
}

/// Recados do painel para o programa de vídeo: "Salvar como projeto do After" pronto ({tipo:
/// "aep-salvo", caminho, dados (base64)}): o programa grava no lugar que a pessoa escolheu (o conector
/// só grava nas pastas do Arcano).
#[allow(dead_code)]
pub fn receber_video(texto: &str) {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(texto) else { return };
    if v.get("tipo").and_then(|t| t.as_str()) != Some("aep-salvo") {
        return;
    }
    let caminho = v.get("caminho").and_then(|c| c.as_str()).unwrap_or("");
    let ok = !caminho.is_empty() && caminho.to_ascii_lowercase().ends_with(".aep");
    match (ok, v.get("dados").and_then(|d| d.as_str()).and_then(de_base64)) {
        (true, Some(b)) if !b.is_empty() => match std::fs::write(caminho, &b) {
            Ok(()) => avisar(format!("Projeto do After salvo em {caminho}")),
            Err(e) => avisar(format!("Não consegui salvar o projeto do After em {caminho}: {e}")),
        },
        _ => avisar("Não consegui salvar o projeto do After (o painel mandou um arquivo inválido)".into()),
    }
}

impl Painel {
    /// O mesmo painel, com quem trata os recados dele.
    #[allow(dead_code)]
    pub fn com_receber(mut self, f: fn(&str)) -> Self {
        self.ao_receber = Some(f);
        self
    }
}
