//! Arcano Layers (programa de PC): o espaço do painel do Arcano Motion na doca do editor. O
//! programa põe o painel (uma página web) exatamente aqui a cada quadro.

use std::sync::Mutex;

static LUGAR: Mutex<Option<(egui::Rect, u64)>> = Mutex::new(None);

/// Desenha o fundo do painel e guarda onde ele ficou neste quadro.
pub fn reservar(ui: &mut egui::Ui, rect: egui::Rect) {
    ui.painter().rect_filled(rect, 0.0, egui::Color32::from_rgb(20, 20, 22));
    ui.painter().text(rect.center(), egui::Align2::CENTER_CENTER, "Abrindo o Arcano Motion…", egui::FontId::proportional(13.0), egui::Color32::from_gray(150));
    *LUGAR.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some((rect, ui.ctx().cumulative_pass_nr()));
}

/// Onde o painel está neste quadro (`None`: fechado ou atrás de outra aba).
pub fn lugar(ctx: &egui::Context) -> Option<egui::Rect> {
    let g = LUGAR.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    g.and_then(|(r, n)| (n == ctx.cumulative_pass_nr()).then_some(r))
}
