//! Arcano Layers (programa de PC): atualização pelo próprio programa. Ao abrir, confere a última
//! versão publicada (versao-<app>-<sistema>.json na página de downloads do Arcano Layers); sendo
//! mais nova que esta, mostra o aviso "Atualizar agora": baixa o instalador novo, abre ele e fecha
//! o programa (o instalador põe a versão nova no lugar).
//! Confere ao abrir e quando a pessoa pede (Ajuda ▸ Procurar atualização), nunca sozinho depois. A janela
//! fica no canto de baixo à ESQUERDA: à direita fica o painel do Arcano (que é uma janela do sistema
//! e cobriria o aviso).

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

const BASE: &str = "https://github.com/jonathanspositodesigner/arcano-editores/releases/download/pc";

/// O número desta versão (o build que gerou o programa); sem ele (compilado à mão), não atualiza.
fn esta() -> u64 {
    option_env!("ARCANO_BUILD").and_then(|v| v.parse().ok()).unwrap_or(0)
}

#[derive(Clone)]
enum Estado {
    Nada,
    Disponivel { build: u64, arquivo: String },
    Baixando { feito: u64, total: u64 },
    Erro(String),
    Pronto,
    /// Pedido à mão e já está na mais nova.
    EmDia,
}

pub struct Atualizador {
    app: &'static str,
    estado: Arc<Mutex<Estado>>,
    dispensado: bool,
    /// Já conferiu ao abrir.
    conferiu: bool,
}

fn sistema() -> &'static str {
    if cfg!(windows) { "windows" } else if cfg!(target_os = "macos") { "mac" } else { "linux" }
}

impl Atualizador {
    pub fn new(app: &'static str) -> Self {
        Self { app, estado: Arc::new(Mutex::new(Estado::Nada)), dispensado: false, conferiu: false }
    }

    fn pegar(&self) -> Estado {
        self.estado.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone()
    }

    /// Confere a versão publicada: uma vez ao abrir e quando `pedido` (à mão: aí também avisa "já está
    /// na mais nova" ou o erro).
    fn conferir(&mut self, ctx: &egui::Context, pedido: bool) {
        if pedido {
            self.dispensado = false;
            if esta() == 0 || sistema() == "linux" {
                *self.estado.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Estado::Erro("esta cópia foi compilada à mão e não se atualiza sozinha".into());
                return;
            }
        } else if esta() == 0 || sistema() == "linux" || self.conferiu {
            return;
        }
        self.conferiu = true;
        let (estado, app, ctx) = (self.estado.clone(), self.app, ctx.clone());
        std::thread::spawn(move || {
            let url = format!("{BASE}/versao-{app}-{}.json", sistema());
            let r = ureq::get(&url).call().map_err(|e| e.to_string()).and_then(|mut r| r.body_mut().read_to_string().map_err(|e| e.to_string()));
            let v = r.and_then(|t| serde_json::from_str::<serde_json::Value>(&t).map_err(|e| e.to_string()));
            let novo = match v {
                Ok(v) => {
                    let build = v.get("build").and_then(serde_json::Value::as_u64).unwrap_or(0);
                    let arquivo = v.get("arquivo").and_then(|a| a.as_str()).unwrap_or("").to_string();
                    let seguro = !arquivo.is_empty() && arquivo.chars().all(|c| c.is_ascii_alphanumeric() || "-_.".contains(c));
                    if build > esta() && seguro {
                        Some(Estado::Disponivel { build, arquivo })
                    } else {
                        pedido.then_some(Estado::EmDia)
                    }
                }
                Err(e) => pedido.then(|| Estado::Erro(format!("não consegui conferir agora ({e})"))),
            };
            if let Some(n) = novo {
                *estado.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = n;
                ctx.request_repaint();
            }
        });
    }

    fn baixar(&mut self, arquivo: String, ctx: &egui::Context) {
        let (estado, ctx) = (self.estado.clone(), ctx.clone());
        *estado.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Estado::Baixando { feito: 0, total: 0 };
        std::thread::spawn(move || {
            let pasta = if cfg!(target_os = "macos") {
                std::env::var_os("HOME").map(PathBuf::from).map(|h| h.join("Downloads")).unwrap_or_else(std::env::temp_dir)
            } else {
                std::env::temp_dir()
            };
            let destino = pasta.join(&arquivo);
            let r = (|| -> Result<(), String> {
                let resp = ureq::get(&format!("{BASE}/{arquivo}")).call().map_err(|e| e.to_string())?;
                let total = resp.headers().get("content-length").and_then(|v| v.to_str().ok()).and_then(|v| v.parse().ok()).unwrap_or(0);
                let mut leitor = resp.into_body().into_reader();
                let mut f = std::fs::File::create(&destino).map_err(|e| e.to_string())?;
                let mut buf = vec![0u8; 1 << 16];
                let mut feito = 0u64;
                loop {
                    let n = std::io::Read::read(&mut leitor, &mut buf).map_err(|e| e.to_string())?;
                    if n == 0 {
                        break;
                    }
                    std::io::Write::write_all(&mut f, &buf[..n]).map_err(|e| e.to_string())?;
                    feito += n as u64;
                    *estado.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Estado::Baixando { feito, total };
                    ctx.request_repaint();
                }
                drop(f);
                abrir_instalador(&destino)
            })();
            *estado.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = match r {
                Ok(()) => Estado::Pronto,
                Err(e) => Estado::Erro(e),
            };
            ctx.request_repaint();
        });
    }

    /// A cada quadro: confere (ao abrir ou quando `pedido`, de Ajuda ▸ Procurar atualização) e mostra
    /// o aviso quando tem versão nova.
    pub fn quadro(&mut self, ctx: &egui::Context, nome: &str, pedido: bool) {
        self.conferir(ctx, pedido);
        let estado = self.pegar();
        if matches!(estado, Estado::Nada) || (self.dispensado && matches!(estado, Estado::Disponivel { .. })) {
            return;
        }
        if matches!(estado, Estado::Pronto) {
            // o instalador abriu: fecha o programa para ele trocar os arquivos
            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            return;
        }
        let mut baixar = None;
        egui::Window::new("Atualização do Arcano Layers")
            .id(egui::Id::unique("arcano_atualizacao"))
            .collapsible(false)
            .resizable(false)
            .anchor(egui::Align2::LEFT_BOTTOM, egui::vec2(16.0, -16.0))
            .show(ctx, |ui| {
                ui.set_max_width(320.0);
                match &estado {
                    Estado::Disponivel { arquivo, build } => {
                        ui.label(format!("Tem uma versão nova do {nome} (versão {build}; a sua é a {}).", esta()));
                        ui.label(egui::RichText::new("Salve o seu projeto antes: o programa fecha para atualizar.").size(12.0).weak());
                        ui.add_space(6.0);
                        ui.horizontal(|ui| {
                            let botao = egui::Button::new(egui::RichText::new("Atualizar agora").color(egui::Color32::WHITE).strong()).fill(egui::Color32::from_rgb(168, 85, 247));
                            if ui.add(botao).clicked() {
                                baixar = Some(arquivo.clone());
                            }
                            if ui.button("Depois").clicked() {
                                self.dispensado = true;
                            }
                        });
                    }
                    Estado::Baixando { feito, total } => {
                        let p = if *total > 0 { *feito as f32 / *total as f32 } else { 0.0 };
                        ui.label("Baixando a versão nova…");
                        ui.add(egui::ProgressBar::new(p).show_percentage());
                    }
                    Estado::EmDia => {
                        ui.label(format!("Você já está na versão mais nova do {nome} (versão {}).", esta()));
                        if ui.button("Fechar").clicked() {
                            *self.estado.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Estado::Nada;
                        }
                    }
                    Estado::Erro(e) => {
                        ui.label(format!("Atualização: {e} (sua versão: {}).", esta()));
                        if ui.button("Fechar").clicked() {
                            *self.estado.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Estado::Nada;
                        }
                    }
                    Estado::Nada | Estado::Pronto => {}
                }
            });
        if let Some(a) = baixar {
            self.baixar(a, ctx);
        }
    }
}

fn abrir_instalador(arquivo: &std::path::Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new(arquivo).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(arquivo).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        let _ = arquivo;
        Err("sem atualização automática neste sistema".into())
    }
}
