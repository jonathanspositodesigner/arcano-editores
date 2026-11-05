//! Arcano: a Fila de render mais direta (pedido do dono): cada item já aparece aberto, com uma
//! linha "Qualidade" (Original da composição, 1080p, 720p, 480p; padrão Original) e o botão
//! "Escolher onde salvar" (no navegador o vídeo vai para os Downloads).

use std::collections::HashSet;
use std::sync::Mutex;

use effectcraft_engine::project::render_queue::RenderQueueItem;
use egui::{Align2, Rect, pos2, vec2};
use serde_json::{Value, json};

use crate::theme::Tokens;
use crate::{EffectcraftApp, widgets};

static VISTOS: Mutex<Option<HashSet<u64>>> = Mutex::new(None);

/// Item novo na fila aparece aberto (com a qualidade e onde salvar à vista).
pub fn abrir_novos(open: &mut Vec<u64>, queue: &[RenderQueueItem]) {
    let mut g = VISTOS.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let vistos = g.get_or_insert_with(HashSet::new);
    for it in queue {
        if vistos.insert(it.id) && !open.contains(&it.id) {
            open.push(it.id);
        }
    }
}

const ALTURAS: [(&str, u32); 3] = [("1080p", 1080), ("720p", 720), ("480p", 480)];

fn par(n: f64) -> u32 {
    ((n / 2.0).round() as u32 * 2).max(2)
}

/// Tamanho com o lado menor em `n` pixels, mantendo a proporção da composição.
fn tamanho(w: u32, h: u32, n: u32) -> (u32, u32) {
    let menor = w.min(h).max(1) as f64;
    let k = n as f64 / menor;
    (par(w as f64 * k), par(h as f64 * k))
}

/// A linha "Qualidade" de um item aberto da fila.
#[allow(clippy::too_many_arguments)]
pub fn qualidade(app: &mut EffectcraftApp, ui: &mut egui::Ui, lp: &egui::Painter, r: Rect, x_rotulo: f32, x: f32, it: &RenderQueueItem, rendering: bool, actions: &mut Vec<(&'static str, Value)>) {
    let t = app.tokens;
    lp.text(pos2(x_rotulo, r.center().y), Align2::LEFT_CENTER, "Qualidade:", Tokens::ui(11.5), t.text_dim);
    let Some(c) = app.session.project.comp(it.comp) else { return };
    let (w, h) = it.settings.output_size(c);
    let mut nomes = vec![format!("Original da composição ({w}×{h})")];
    let mut tamanhos = vec![None];
    for (nome, n) in ALTURAS {
        let (a, b) = tamanho(w, h, n);
        nomes.push(format!("{nome} ({a}×{b})"));
        tamanhos.push(Some((a, b)));
    }
    let o = &it.output.resize;
    let atual = if !o.enabled { Some(0) } else { tamanhos.iter().position(|s| *s == Some((o.width, o.height))) };
    let texto = match atual {
        Some(i) => nomes[i].clone(),
        None => format!("Personalizado ({}×{})", o.width, o.height),
    };
    let dd = Rect::from_min_size(pos2(x, r.min.y + 3.0), vec2(220.0, r.height() - 6.0));
    let id = egui::Id::unique(("arcano-rq-qualidade", it.id));
    let resp = widgets::dropdown(ui, dd, &texto, &t, id);
    if resp.clicked() && !rendering {
        widgets::open_popup(ui, id);
    }
    app.auto.add(&format!("renderQueue.item.{}.qualidade", it.id), dd, &texto);
    if let Some(i) = widgets::popup_menu(ui, id, dd.left_bottom(), &nomes, atual) {
        let resize = match tamanhos[i] {
            None => json!(false),
            Some((a, b)) => json!({"enabled": true, "width": a, "height": b, "lockAspect": false, "quality": "high"}),
        };
        actions.push(("renderQueue.setOutputModule", json!({"item": it.id, "resize": resize})));
    }
    // onde salvar
    let bt = Rect::from_min_size(pos2(dd.max.x + 12.0, r.min.y + 3.0), vec2(170.0, r.height() - 6.0));
    let destino = app.session.resolve_output(it).unwrap_or_default();
    let tem_janela = app.hooks.pick_save.is_some();
    if tem_janela {
        let b = ui.put(bt, egui::Button::new(egui::RichText::new("📁 Escolher onde salvar").size(11.5)));
        app.auto.add(&format!("renderQueue.item.{}.escolher", it.id), bt, "Escolher onde salvar");
        if b.clicked() && !rendering
            && let Some(Some(caminho)) = app.hooks.save_dialog(&destino)
        {
            actions.push(("renderQueue.setOutput", json!({"item": it.id, "path": caminho})));
        }
    } else {
        lp.text(pos2(bt.min.x, r.center().y), Align2::LEFT_CENTER, "O vídeo vai para os Downloads do navegador", Tokens::ui(11.0), t.text_faint);
    }
}
