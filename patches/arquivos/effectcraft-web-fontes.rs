//! Arcano: fontes do PC para o PSD no navegador.
//!
//! O navegador não enxerga as fontes instaladas no computador. Antes de importar um PSD, o editor
//! lista as fontes dos textos que ele não tem e pede ao painel do Arcano Motion (montar.js →
//! shim do plugin → Arcano Conector `/plugin/fontes`), que devolve os arquivos das fontes do PC.
//! Elas entram no editor (`effectcraft_text::fonts::add_font_data`) e só então o PSD é importado.
//! Sem conector, sem painel ou sem resposta em 25 s: importa assim mesmo (fonte que faltar vira a
//! imagem do texto guardada no PSD, igual ao programa de PC).

use std::cell::{Cell, RefCell};
use std::collections::HashSet;

use serde_json::json;
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;

use effectcraft_ui_egui::EffectcraftApp;

struct Pedido {
    id: u32,
    nomes: Vec<String>,
    caminhos: Vec<String>,
    entregue: bool,
}

thread_local! {
    static PEDIDO: RefCell<Option<Pedido>> = const { RefCell::new(None) };
    static SEQ: Cell<u32> = const { Cell::new(0) };
    /// Caminhos que já passaram pela busca de fontes (a importação que volta depois da resposta).
    static LIBERADOS: RefCell<HashSet<String>> = RefCell::new(HashSet::new());
}

fn eh_psd(p: &str) -> bool {
    let p = p.to_ascii_lowercase();
    p.ends_with(".psd") || p.ends_with(".psb")
}

fn coletar(psd: &effectcraft_psd::Psd, nomes: &mut Vec<String>) {
    for l in &psd.layers {
        if let Some(t) = &l.text {
            for f in t.style.font.iter().chain(t.runs.iter().filter_map(|(_, s)| s.font.as_ref())) {
                if !f.is_empty() && !nomes.iter().any(|n| n == f) {
                    nomes.push(f.clone());
                }
            }
        }
    }
}

/// Fontes dos textos do PSD (e dos PSDs embutidos nos objetos inteligentes) que o editor não tem.
fn fontes_faltando(bytes: std::sync::Arc<[u8]>, nomes: &mut Vec<String>, nivel: u32) {
    let Ok(psd) = effectcraft_psd::Psd::parse(bytes.clone()) else { return };
    coletar(&psd, nomes);
    if nivel < 2 {
        for lf in &psd.linked {
            if let Some(r) = lf.data.clone()
                && r.end <= bytes.len()
                && effectcraft_psd::is_psd(&bytes[r.clone()])
            {
                fontes_faltando(std::sync::Arc::from(&bytes[r]), nomes, nivel + 1);
            }
        }
    }
}

/// Segura a importação enquanto as fontes do PC chegam. `true` = segurou (a importação volta sozinha).
pub fn segurar(app: &mut EffectcraftApp, caminhos: &[String]) -> bool {
    let mut psds = Vec::new();
    LIBERADOS.with(|l| {
        let mut l = l.borrow_mut();
        for p in caminhos.iter().filter(|p| eh_psd(p)) {
            if !l.remove(p) {
                psds.push(p.clone());
            }
        }
    });
    if psds.is_empty() {
        return false;
    }
    let mut nomes = Vec::new();
    for p in &psds {
        if let Some(b) = crate::files::get(p) {
            fontes_faltando(b, &mut nomes, 0);
        }
    }
    nomes.retain(|n| effectcraft_text::resolve(n, "").missing);
    if nomes.is_empty() {
        return false;
    }
    let id = SEQ.with(|s| {
        s.set(s.get().wrapping_add(1));
        s.get()
    });
    PEDIDO.with(|p| *p.borrow_mut() = Some(Pedido { id, nomes, caminhos: caminhos.to_vec(), entregue: false }));
    app.ui.status = "Buscando no seu computador as fontes do PSD…".into();
    if let Some(w) = web_sys::window() {
        let cb = Closure::once_into_js(move || fontes_resposta(id, js_sys::Array::new()));
        let _ = w.set_timeout_with_callback_and_timeout_and_arguments_0(cb.unchecked_ref(), 25_000);
    }
    true
}

/// O pedido de fontes que ainda não foi entregue ao painel (`""` se não houver).
#[wasm_bindgen(js_name = arcanoFontesPedido)]
pub fn fontes_pedido() -> String {
    PEDIDO.with(|p| match p.borrow_mut().as_mut() {
        Some(p) if !p.entregue => {
            p.entregue = true;
            json!({"id": p.id, "nomes": p.nomes}).to_string()
        }
        _ => String::new(),
    })
}

/// A resposta do painel: os arquivos das fontes (`Uint8Array`), talvez nenhum. Instala e importa o PSD.
#[wasm_bindgen(js_name = arcanoFontesResposta)]
pub fn fontes_resposta(id: u32, fontes: js_sys::Array) {
    let Some(pedido) = PEDIDO.with(|p| {
        let mut p = p.borrow_mut();
        if p.as_ref().is_some_and(|x| x.id == id) { p.take() } else { None }
    }) else {
        return;
    };
    let mut novas = 0usize;
    for f in fontes.iter() {
        if let Ok(b) = f.dyn_into::<js_sys::Uint8Array>() {
            novas += effectcraft_text::fonts::add_font_data(b.to_vec()).len();
        }
    }
    let faltando = pedido.nomes.iter().filter(|n| effectcraft_text::resolve(n, "").missing).count();
    LIBERADOS.with(|l| l.borrow_mut().extend(pedido.caminhos.iter().filter(|p| eh_psd(p)).cloned()));
    let caminhos = pedido.caminhos;
    crate::app::post(move |app| {
        app.ui.status = match (novas, faltando) {
            (0, _) => String::new(),
            (_, 0) => "Fontes do PSD carregadas do seu computador.".into(),
            (_, n) => format!("{n} fonte(s) do PSD não estão no seu computador: esses textos ficam como imagem."),
        };
        crate::app::open_or_import(app, caminhos);
    });
    crate::app::repaint();
}

/// Fontes do PC mandadas pelo painel (projeto do After aberto pelo painel): só instala.
#[wasm_bindgen(js_name = arcanoFontesAdicionar)]
pub fn fontes_adicionar(fontes: js_sys::Array) -> u32 {
    let mut n = 0u32;
    for f in fontes.iter() {
        if let Ok(b) = f.dyn_into::<js_sys::Uint8Array>() {
            n += effectcraft_text::fonts::add_font_data(b.to_vec()).len() as u32;
        }
    }
    crate::app::repaint();
    n
}

/// Projetos do After (.aep/.aet) que o file.import guardou para o painel abrir (JSON, lista de caminhos).
#[wasm_bindgen(js_name = arcanoAepPedidos)]
pub fn aep_pedidos() -> String {
    json!(effectcraft_engine::arcano_aep::pendentes()).to_string()
}

/// Arquivo ▸ Salvar como projeto do After: pedidos para o painel (JSON, lista de {tipo, nome}).
#[wasm_bindgen(js_name = arcanoAepSalvar)]
pub fn aep_salvar() -> String {
    let lista: Vec<serde_json::Value> = effectcraft_engine::arcano_aep::pedidos_salvar().iter().filter_map(|p| serde_json::from_str(p).ok()).collect();
    json!(lista).to_string()
}
