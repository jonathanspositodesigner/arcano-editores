//! Arcano (13/11/2026, SÓ ADMIN, teste do dono): botão destacado "⚡ Render no modo CapCut" na fila de
//! render. Ligado, o próximo render vai com a placa em 8 bits numa conexão própria, H.264 pelo NVENC,
//! vídeo aberto pelo decodificador do sistema e 2 quadros na placa ao mesmo tempo
//! (`effectcraft_render::arcano_placa::capcut`). Desligado = o render original. Some para quem não é
//! admin (a conta do conta.json, conferida no servidor pelo programa de PC). Navegador: nada.

use egui::{Align2, Color32, CornerRadius, Pos2, Rect, Sense, Stroke, StrokeKind, vec2};

use crate::theme::Tokens;

/// Desenha o botão (só admin, só PC). `canto`: canto de cima à esquerda.
#[cfg(not(target_arch = "wasm32"))]
pub fn botao(ui: &mut egui::Ui, p: &egui::Painter, canto: Pos2, rendering: bool, t: &Tokens) {
    use effectcraft_render::arcano_placa as ap;
    ap::pedir_admin();
    if !ap::admin() {
        return;
    }
    let on = ap::capcut();
    let texto = if on { "⚡ Render no modo CapCut: LIGADO (8 bits)" } else { "⚡ Render no modo CapCut (teste · só admin)" };
    let fonte = Tokens::semibold(11.5);
    let largura = ui.fonts_mut(|f| f.layout_no_wrap(texto.to_string(), fonte.clone(), Color32::WHITE).size().x) + 22.0;
    let r = Rect::from_min_size(canto, vec2(largura, 22.0));
    let resp = ui.interact(r, egui::Id::unique("arcano-capcut"), if rendering { Sense::hover() } else { Sense::click() });
    let laranja = Color32::from_rgb(255, 122, 0);
    let (fundo, borda, cor) = if on {
        (laranja, laranja, Color32::BLACK)
    } else if resp.hovered() && !rendering {
        (Color32::from_rgba_unmultiplied(255, 122, 0, 60), laranja, laranja)
    } else {
        (Color32::from_rgba_unmultiplied(255, 122, 0, 28), laranja, laranja)
    };
    p.rect_filled(r, CornerRadius::same(11), fundo);
    p.rect_stroke(r, CornerRadius::same(11), Stroke::new(1.5, borda), StrokeKind::Inside);
    p.text(r.center(), Align2::CENTER_CENTER, texto, fonte, if rendering { t.text_dim } else { cor });
    if resp.clicked() && !rendering {
        ap::definir_capcut(!on);
    }
    resp.on_hover_text(if rendering {
        "Espere o render terminar para trocar."
    } else {
        "Teste só pra admin. Ligado: imagens na placa em 8 bits (como CapCut/celular: mais rápido, 256 níveis de cor, \
         nada mais claro que o branco), conexão própria com a placa, H.264 pela placa (NVIDIA) e vídeo aberto pelo \
         decodificador do sistema (vale pro vídeo aberto depois de ligar). Desligado: o render de sempre. Volta a \
         desligar quando o programa abre de novo."
    });
}

#[cfg(target_arch = "wasm32")]
pub fn botao(_ui: &mut egui::Ui, _p: &egui::Painter, _canto: Pos2, _rendering: bool, _t: &Tokens) {}
