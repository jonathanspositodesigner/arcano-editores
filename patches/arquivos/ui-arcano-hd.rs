//! Arcano (programa de PC, editor de vídeo): escolher o HD onde o editor trabalha (pedido do dono).
//!
//! O editor guarda no disco o cache da prévia (até o tamanho máximo, padrão 20 GB), o cache de
//! mídia (resumo das ondas de áudio) e o áudio convertido dos vídeos. O padrão é a pasta do
//! usuário no C:. Esta tela (Editar ▸ HD de trabalho…) lista os HDs com o espaço livre e muda as
//! três pastas de uma vez para "<HD>\Arcano Layers Cache\…". O cache antigo é esvaziado na troca
//! (libera o C:).
//!
//! Abre sozinha (uma vez por sessão) quando o HD do cache está quase cheio e o editor parou de
//! guardar a prévia no disco (o que deixa a prévia mais lenta).

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use serde_json::json;

use crate::EffectcraftApp;

static ABERTO: AtomicBool = AtomicBool::new(false);
/// Aberta pelo aviso de disco cheio (mostra o aviso no topo).
static PELO_AVISO: AtomicBool = AtomicBool::new(false);
/// O aviso já apareceu nesta sessão.
static AVISADO: AtomicBool = AtomicBool::new(false);
/// O espaço dos HDs, lido por trás (no Windows a leitura demora).
static DISCOS: Mutex<Option<Leitura>> = Mutex::new(None);

#[derive(Clone)]
struct Disco {
    raiz: PathBuf,
    /// (total, livre) em bytes.
    espaco: Option<(u64, u64)>,
}

#[derive(Clone)]
struct Leitura {
    pronta: bool,
    discos: Vec<Disco>,
}

const SUBPASTA: &str = "Arcano Layers Cache";
/// Abaixo disso o cache do disco quase não cabe: avisa.
const POUCO: u64 = 2 << 30;

/// Editar ▸ HD de trabalho…
pub fn abrir() {
    PELO_AVISO.store(false, Ordering::Relaxed);
    ABERTO.store(true, Ordering::Relaxed);
    ler_discos();
}

fn gb(b: u64) -> String {
    let g = b as f64 / (1u64 << 30) as f64;
    if g >= 100.0 { format!("{g:.0} GB") } else { format!("{g:.1} GB").replace('.', ",") }
}

/// Os HDs do computador (Windows: as letras que existem; Mac/Linux: a raiz e a pasta do usuário).
fn raizes() -> Vec<PathBuf> {
    if cfg!(windows) {
        (b'A'..=b'Z').map(|l| PathBuf::from(format!("{}:\\", l as char))).filter(|p| p.is_dir()).collect()
    } else {
        let mut v = vec![PathBuf::from("/")];
        if let Some(h) = std::env::var_os("HOME") {
            v.push(PathBuf::from(h));
        }
        if let Ok(rd) = std::fs::read_dir("/Volumes") {
            v.extend(rd.flatten().map(|e| e.path()));
        }
        v
    }
}

fn ler_discos() {
    {
        let mut g = DISCOS.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        if g.as_ref().is_some_and(|l| !l.pronta) {
            return; // já está lendo
        }
        *g = Some(Leitura { pronta: false, discos: g.as_ref().map(|l| l.discos.clone()).unwrap_or_default() });
    }
    std::thread::spawn(|| {
        let discos = raizes().into_iter().map(|raiz| Disco { espaco: effectcraft_engine::sysinfo::disk_space(&raiz), raiz }).collect();
        *DISCOS.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some(Leitura { pronta: true, discos });
    });
}

/// O HD (raiz) de um caminho, entre os listados.
fn disco_de<'a>(discos: &'a [Disco], p: &Path) -> Option<&'a Disco> {
    let alvo = p.to_string_lossy().to_lowercase();
    discos.iter().filter(|d| alvo.starts_with(&d.raiz.to_string_lossy().to_lowercase())).max_by_key(|d| d.raiz.as_os_str().len())
}

/// Muda as três pastas do editor para `base` (vazio = volta ao padrão, no disco do sistema).
fn trabalhar_em(app: &mut EffectcraftApp, base: Option<PathBuf>) {
    let atual = app.session.disk_cache.as_ref().map(|d| d.folder().to_path_buf());
    let (cache, midia, audio) = match &base {
        Some(b) => {
            let r = b.join(SUBPASTA);
            let p = (r.join("Cache da previa"), r.join("Cache de midia"), r.join("Audio convertido"));
            for d in [&p.0, &p.1, &p.2] {
                if let Err(e) = std::fs::create_dir_all(d) {
                    app.session.toast(format!("Não consegui usar {}: {e}", b.display()));
                    return;
                }
            }
            (p.0.to_string_lossy().into_owned(), p.1.to_string_lossy().into_owned(), p.2.to_string_lossy().into_owned())
        }
        None => (String::new(), String::new(), String::new()),
    };
    // o cache antigo sai do HD de antes (libera o espaço)
    if atual.as_deref().map(|a| a.to_string_lossy().into_owned()) != Some(cache.clone())
        && let Some(dc) = &app.session.disk_cache
    {
        dc.clear();
    }
    for (k, v) in [("disk.diskCacheFolder", cache), ("disk.mediaCacheFolder", midia), ("disk.conformedMediaFolder", audio)] {
        if let Err(e) = app.session.prefs.set(k, json!(v)) {
            app.session.toast(e);
            return;
        }
    }
    let _ = app.session.prefs.set("disk.diskCacheEnabled", json!(true));
    app.session.prefs_changed();
    app.session.save_prefs();
    app.session.toast(match &base {
        Some(b) => format!("Pronto: o editor agora trabalha em {}", b.join(SUBPASTA).display()),
        None => "Pronto: o editor voltou a trabalhar na pasta padrão".to_string(),
    });
    ler_discos();
}

/// A cada quadro: o aviso de disco cheio e a tela, se aberta.
pub fn quadro(app: &mut EffectcraftApp, ctx: &egui::Context) {
    // Aviso: o espaço livre do HD do cache já limita o cache a quase nada (o disco é lido por
    // trás a cada poucos segundos; antes da 1ª leitura o limite é "desconhecido" e não avisa).
    if !AVISADO.load(Ordering::Relaxed)
        && let Some(dc) = &app.session.disk_cache
        && dc.limit_bytes() < dc.max_bytes()
        && dc.limit_bytes() < POUCO
    {
        AVISADO.store(true, Ordering::Relaxed);
        PELO_AVISO.store(true, Ordering::Relaxed);
        ABERTO.store(true, Ordering::Relaxed);
        ler_discos();
    }
    if !ABERTO.load(Ordering::Relaxed) {
        return;
    }
    let leitura = DISCOS.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone();
    if leitura.as_ref().is_some_and(|l| !l.pronta) {
        ctx.request_repaint_after(std::time::Duration::from_millis(200));
    }
    let t = app.tokens;
    let pasta = app.session.disk_cache.as_ref().map(|d| d.folder().to_path_buf());
    let personalizada = !app.session.prefs.disk.disk_cache_folder.trim().is_empty();
    let mut max_gb = app.session.prefs.disk.disk_cache_max_gb;
    let mut escolher: Option<Option<PathBuf>> = None;
    let mut pedir_pasta = false;
    let mut fechar = false;
    let id = egui::Id::unique("arcano_hd_trabalho");
    egui::Modal::new(id)
        .backdrop_color(egui::Color32::from_black_alpha(120))
        .frame(egui::Frame::window(&ctx.style_of(ctx.theme())).fill(t.panel_bg).inner_margin(egui::Margin::same(18)))
        .show(ctx, |ui| {
            ui.set_width(460.0);
            ui.label(egui::RichText::new("HD de trabalho do editor").size(16.0).strong().color(egui::Color32::from_gray(235)));
            ui.add_space(6.0);
            if PELO_AVISO.load(Ordering::Relaxed) {
                let letra = pasta.as_deref().and_then(|p| leitura.as_ref().and_then(|l| disco_de(&l.discos, p))).map(|d| d.raiz.display().to_string()).unwrap_or_else(|| "do sistema".into());
                egui::Frame::new().fill(egui::Color32::from_rgb(60, 24, 24)).corner_radius(6.0).inner_margin(egui::Margin::same(10)).show(ui, |ui| {
                    ui.label(
                        egui::RichText::new(format!("O disco {letra} está quase cheio: o editor parou de guardar a prévia no disco e fica mais lento. Escolha um HD com espaço."))
                            .size(12.0)
                            .color(egui::Color32::from_rgb(255, 196, 196)),
                    );
                });
                ui.add_space(8.0);
            }
            ui.label(egui::RichText::new("Aqui o editor guarda o cache da prévia, o cache de mídia e o áudio convertido dos vídeos. Seus projetos e renders continuam onde você salvar.").size(11.5).color(t.text_dim));
            ui.add_space(8.0);
            ui.label(egui::RichText::new("Agora:").size(11.5).color(t.text_dim));
            let agora = match &pasta {
                Some(p) => p.display().to_string(),
                None => "cache do disco desligado".into(),
            };
            ui.label(egui::RichText::new(agora).size(12.0).monospace().color(egui::Color32::from_gray(225)));
            ui.add_space(10.0);
            ui.label(egui::RichText::new("Escolha o HD:").size(11.5).color(t.text_dim));
            match &leitura {
                Some(l) if !l.discos.is_empty() || l.pronta => {
                    let meu = pasta.as_deref().and_then(|p| disco_de(&l.discos, p)).map(|d| d.raiz.clone());
                    egui::Grid::new("arcano_hd_lista").num_columns(3).spacing([14.0, 6.0]).show(ui, |ui| {
                        for d in &l.discos {
                            ui.label(egui::RichText::new(d.raiz.display().to_string()).size(13.0).strong().color(egui::Color32::from_gray(230)));
                            match d.espaco {
                                Some((total, livre)) => {
                                    let cor = if livre < 10 << 30 { egui::Color32::from_rgb(248, 113, 113) } else { egui::Color32::from_gray(200) };
                                    ui.label(egui::RichText::new(format!("{} livres de {}", gb(livre), gb(total))).size(12.0).color(cor));
                                }
                                None => {
                                    ui.label(egui::RichText::new(if l.pronta { "espaço desconhecido" } else { "lendo…" }).size(12.0).color(t.text_faint));
                                }
                            }
                            if meu.as_ref() == Some(&d.raiz) && personalizada {
                                ui.label(egui::RichText::new("✔ em uso").size(12.0).color(egui::Color32::from_rgb(192, 132, 252)));
                            } else if ui.button("Usar este HD").clicked() {
                                escolher = Some(Some(d.raiz.clone()));
                            }
                            ui.end_row();
                        }
                    });
                    if !l.pronta {
                        ui.horizontal(|ui| {
                            ui.add(egui::Spinner::new().size(14.0));
                            ui.label(egui::RichText::new("Lendo o espaço dos HDs…").size(11.5).color(t.text_faint));
                        });
                    }
                }
                _ => {
                    ui.horizontal(|ui| {
                        ui.add(egui::Spinner::new().size(14.0));
                        ui.label(egui::RichText::new("Lendo os HDs…").size(11.5).color(t.text_faint));
                    });
                }
            }
            ui.add_space(8.0);
            if app.hooks.pick_folder.is_some() && ui.button("📁 Escolher uma pasta…").clicked() {
                pedir_pasta = true;
            }
            ui.add_space(10.0);
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("Tamanho máximo do cache da prévia:").size(11.5).color(t.text_dim));
                ui.add(egui::DragValue::new(&mut max_gb).range(1..=2000).suffix(" GB"));
            });
            ui.add_space(14.0);
            ui.horizontal(|ui| {
                if ui.button(if PELO_AVISO.load(Ordering::Relaxed) { "Agora não" } else { "Fechar" }).clicked() {
                    fechar = true;
                }
                if personalizada && ui.button("Voltar ao padrão").clicked() {
                    escolher = Some(None);
                }
            });
        });
    if max_gb != app.session.prefs.disk.disk_cache_max_gb {
        let _ = app.session.prefs.set("disk.diskCacheMaxGb", json!(max_gb));
        app.session.prefs_changed();
        app.session.save_prefs();
    }
    if pedir_pasta && let Some(f) = app.hooks.pick_folder.as_ref().and_then(|f| f()) {
        escolher = Some(Some(PathBuf::from(f)));
    }
    if let Some(base) = escolher {
        trabalhar_em(app, base);
        PELO_AVISO.store(false, Ordering::Relaxed);
    }
    if fechar || ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
        ABERTO.store(false, Ordering::Relaxed);
        PELO_AVISO.store(false, Ordering::Relaxed);
    }
}
