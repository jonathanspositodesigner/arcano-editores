//! Arcano: telas de "Carregando…" do editor de vídeo (navegador e programa de PC).
//!
//! 1. Importar ou abrir arquivo (PSD grande, projeto): o comando trava o editor enquanto lê. Ele
//!    espera dois quadros: primeiro aparece a tela "Carregando seu arquivo…", depois o editor lê
//!    (a tela fica na frente o tempo todo, nunca parece travado sem aviso).
//! 2. Composição aberta e a prévia ainda não chegou (o primeiro quadro de um PSD pesado demora):
//!    "Gerando a prévia…" animado por cima do visualizador até o quadro aparecer.

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use serde_json::Value;

use crate::EffectcraftApp;

struct Pesado {
    id: String,
    params: Value,
    nome: String,
    desde: Instant,
    quadros: u32,
}

static PESADO: Mutex<Option<Pesado>> = Mutex::new(None);
/// O comando adiado está rodando agora (não adia de novo).
static RODANDO: AtomicBool = AtomicBool::new(false);
/// Composição esperando a prévia: (composição, desde quando).
static PREVIA: Mutex<Option<(u64, Instant)>> = Mutex::new(None);

fn nome_do_arquivo(p: &Value) -> Option<String> {
    let c = p.get("paths").and_then(|v| v.as_array()).and_then(|a| a.first()).and_then(Value::as_str).or_else(|| p.get("path").and_then(Value::as_str))?;
    let n = c.rsplit(['/', '\\']).next().unwrap_or(c);
    Some(n.to_owned())
}

/// Comando que lê arquivo e trava o editor: guarda para rodar daqui a dois quadros, com a tela de
/// carregando já na frente. `true` = adiado (quem chamou só segue).
pub fn adiar(id: &str, params: &Value) -> bool {
    if RODANDO.load(Ordering::Relaxed) || !matches!(id, "file.import" | "file.importMultiple" | "file.open" | "file.importProject") {
        return false;
    }
    let Some(nome) = nome_do_arquivo(params) else { return false };
    let mut g = PESADO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if g.is_some() {
        return false;
    }
    *g = Some(Pesado { id: id.to_owned(), params: params.clone(), nome, desde: Instant::now(), quadros: 0 });
    true
}

fn tela(ctx: &egui::Context, sobre: egui::Rect, titulo: &str, detalhe: &str, id: &str, escurecer: bool) {
    egui::Area::new(egui::Id::unique(id)).order(egui::Order::Foreground).fixed_pos(sobre.min).interactable(true).show(ctx, |ui| {
        ui.set_min_size(sobre.size());
        if escurecer {
            ui.painter().rect_filled(sobre, 0.0, egui::Color32::from_black_alpha(150));
        }
        let caixa = egui::Rect::from_center_size(sobre.center(), egui::vec2(340.0_f32.min(sobre.width() - 16.0).max(160.0), 112.0));
        ui.painter().rect_filled(caixa, 10.0, egui::Color32::from_rgb(24, 22, 30));
        ui.painter().rect_stroke(caixa, 10.0, egui::Stroke::new(1.0, egui::Color32::from_rgb(88, 56, 140)), egui::StrokeKind::Inside);
        let mut filho = ui.new_child(egui::UiBuilder::new().max_rect(caixa.shrink(14.0)).layout(egui::Layout::top_down(egui::Align::Center)));
        filho.add(egui::Spinner::new().size(26.0).color(egui::Color32::from_rgb(192, 132, 252)));
        filho.add_space(8.0);
        filho.label(egui::RichText::new(titulo).size(14.0).strong().color(egui::Color32::from_gray(235)));
        if !detalhe.is_empty() {
            filho.label(egui::RichText::new(detalhe).size(11.0).color(egui::Color32::from_gray(160)));
        }
    });
}

fn area_do_visualizador(app: &EffectcraftApp) -> Option<egui::Rect> {
    app.auto
        .elements
        .iter()
        .find(|e| e.id == "viewer.area")
        .map(|e| egui::Rect::from_min_size(egui::pos2(e.rect[0], e.rect[1]), egui::vec2(e.rect[2], e.rect[3])))
        .filter(|r| r.width() > 40.0 && r.height() > 40.0)
}

/// A cada quadro, depois dos painéis: as telas de carregando e o comando adiado.
pub fn quadro(app: &mut EffectcraftApp, ctx: &egui::Context) {
    // 1. arquivo sendo lido
    let rodar = {
        let mut g = PESADO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        match g.as_mut() {
            Some(p) => {
                p.quadros += 1;
                tela(ctx, ctx.content_rect(), "Carregando seu arquivo…", &p.nome, "arcano_carregando_arquivo", true);
                if p.quadros >= 3 && p.desde.elapsed() >= Duration::from_millis(150) {
                    g.take()
                } else {
                    ctx.request_repaint();
                    None
                }
            }
            None => None,
        }
    };
    if let Some(p) = rodar {
        RODANDO.store(true, Ordering::Relaxed);
        let r = crate::menus::invoke(app, ctx, &p.id, p.params);
        RODANDO.store(false, Ordering::Relaxed);
        if let Err(e) = r {
            app.ui.status = e;
        }
        ctx.request_repaint();
        return;
    }
    // 2. a prévia da composição ainda não chegou
    let ativa = app.session.active_comp_id().map(|c| c.0);
    let mostrada = app.viewer_shown.as_ref().map(|(_, k)| k.comp);
    let mut g = PREVIA.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    match ativa {
        Some(c) if mostrada != Some(c) => {
            let desde = match *g {
                Some((cc, t)) if cc == c => t,
                _ => {
                    *g = Some((c, Instant::now()));
                    Instant::now()
                }
            };
            // só se demorar (composição leve aparece antes e a tela nem pisca)
            if desde.elapsed() >= Duration::from_millis(600)
                && let Some(r) = area_do_visualizador(app)
            {
                tela(ctx, r, "Gerando a prévia…", "Arquivos grandes demoram um pouco na primeira vez.", "arcano_carregando_previa", false);
            }
            if area_do_visualizador(app).is_some() {
                ctx.request_repaint_after(Duration::from_millis(100));
            }
        }
        _ => *g = None,
    }
}
