//! Arcano: aviso de ARQUIVOS AUSENTES, igual ao After Effects (pedido do dono, 05/11/2026).
//!
//! "Se não achar o arquivo tem que avisar que o arquivo tá ausente, igual no After Effects normal.
//! Aqui não falou nada... fingindo que tava lá." Toda vez que o projeto passa a ter arquivo que não
//! foi achado (abrir projeto, abrir projeto do After pelo painel, salvar em outro lugar...) ou texto
//! com fonte que não está no computador, abre uma janela com a lista. No vídeo, o que falta aparece
//! com as barras coloridas (como no After), nunca some calado.
//!
//! Avisa uma vez por item: o que já foi avisado não volta a abrir a janela no mesmo projeto.

use std::collections::HashSet;
use std::sync::Mutex;
use web_time::{Duration, Instant};

use effectcraft_engine::arcano_pacote::Ausente;

use crate::EffectcraftApp;

#[derive(Default)]
struct Estado {
    conferido: Option<Instant>,
    projeto: usize,
    caminho: Option<String>,
    fontes_prontas: bool,
    lista: Vec<Ausente>,
    avisados: HashSet<String>,
    novos_desde: Option<Instant>,
    janela: Option<Vec<Ausente>>,
}

static ESTADO: Mutex<Option<Estado>> = Mutex::new(None);

/// A cada quadro: confere (no máximo 1 vez por segundo, e só quando o projeto mudou) e desenha a
/// janela quando há coisa nova faltando.
pub fn quadro(app: &mut EffectcraftApp, ctx: &egui::Context) {
    let mut g = ESTADO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    let e = g.get_or_insert_with(Estado::default);
    let agora = Instant::now();
    if e.janela.is_none() && e.conferido.is_none_or(|t| agora.duration_since(t) >= Duration::from_millis(900)) {
        e.conferido = Some(agora);
        if e.caminho != app.session.path {
            e.caminho = app.session.path.clone();
            e.avisados.clear();
        }
        // fontes do sistema: só depois que o editor terminou de ler as fontes do computador
        // (antes disso toda fonte instalada pareceria faltando)
        let fontes = cfg!(target_arch = "wasm32") || effectcraft_text::fonts::system_scanned();
        let ptr = std::sync::Arc::as_ptr(&app.session.project) as usize;
        if ptr != e.projeto || fontes != e.fontes_prontas {
            e.projeto = ptr;
            e.fontes_prontas = fontes;
            e.lista = effectcraft_engine::arcano_pacote::ausentes(&app.session.project, fontes);
            // o projeto ainda está mudando (montando um projeto do After): espera assentar
            e.novos_desde = if e.lista.iter().any(|a| !e.avisados.contains(&a.chave)) { Some(agora) } else { None };
        }
        if let Some(t) = e.novos_desde
            && agora.duration_since(t) >= Duration::from_millis(1500)
        {
            e.novos_desde = None;
            for a in &e.lista {
                e.avisados.insert(a.chave.clone());
            }
            e.janela = Some(e.lista.clone());
        }
    }
    if e.novos_desde.is_some() {
        ctx.request_repaint_after(Duration::from_millis(500));
    }
    let Some(lista) = e.janela.clone() else { return };
    drop(g);

    let t = app.tokens;
    let arquivos: Vec<&Ausente> = lista.iter().filter(|a| a.tipo == "arquivo").collect();
    let fontes: Vec<&Ausente> = lista.iter().filter(|a| a.tipo == "fonte").collect();
    let mut fechar = false;
    let mut procurar = false;
    egui::Modal::new(egui::Id::unique("arcano_ausentes"))
        .backdrop_color(egui::Color32::from_black_alpha(120))
        .frame(egui::Frame::window(&ctx.style_of(ctx.theme())).fill(t.panel_bg).inner_margin(egui::Margin::same(18)))
        .show(ctx, |ui| {
            ui.set_width(500.0);
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("⚠").size(20.0).color(egui::Color32::from_rgb(251, 191, 36)));
                let titulo = if arquivos.is_empty() { "Fontes ausentes" } else { "Arquivos ausentes" };
                ui.label(egui::RichText::new(titulo).size(17.0).strong().color(egui::Color32::from_gray(238)));
            });
            ui.add_space(6.0);
            let n = arquivos.len();
            if n > 0 {
                let texto = if n == 1 {
                    "1 arquivo deste projeto não foi encontrado. Ele aparece com barras coloridas no lugar até você colocar o arquivo de volta.".to_string()
                } else {
                    format!("{n} arquivos deste projeto não foram encontrados. Eles aparecem com barras coloridas no lugar até você colocar os arquivos de volta.")
                };
                ui.label(egui::RichText::new(texto).size(12.0).color(t.text_dim));
            }
            if !fontes.is_empty() {
                let k = fontes.len();
                ui.label(
                    egui::RichText::new(if k == 1 {
                        "1 fonte não está neste computador: o texto aparece com outra fonte no lugar.".to_string()
                    } else {
                        format!("{k} fontes não estão neste computador: os textos aparecem com outra fonte no lugar.")
                    })
                    .size(12.0)
                    .color(t.text_dim),
                );
            }
            ui.add_space(10.0);
            egui::ScrollArea::vertical().max_height(280.0).auto_shrink([false, true]).show(ui, |ui| {
                for a in &arquivos {
                    egui::Frame::new().fill(egui::Color32::from_rgb(32, 28, 40)).corner_radius(6.0).inner_margin(egui::Margin::symmetric(10, 7)).show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.label(egui::RichText::new(format!("🎞  {}", a.nome)).size(12.5).strong().color(egui::Color32::from_gray(230)));
                        if !a.detalhe.is_empty() {
                            ui.label(egui::RichText::new(&a.detalhe).size(11.0).monospace().color(t.text_faint));
                        }
                    });
                    ui.add_space(4.0);
                }
                for a in &fontes {
                    egui::Frame::new().fill(egui::Color32::from_rgb(32, 28, 40)).corner_radius(6.0).inner_margin(egui::Margin::symmetric(10, 7)).show(ui, |ui| {
                        ui.set_width(ui.available_width());
                        ui.label(egui::RichText::new(format!("🔤  {}", a.nome)).size(12.5).strong().color(egui::Color32::from_gray(230)));
                    });
                    ui.add_space(4.0);
                }
            });
            ui.add_space(10.0);
            let dica = if cfg!(target_arch = "wasm32") {
                "Projeto feito no computador: salve-o de novo no programa de PC do Arcano Layers (agora o arquivo do projeto leva vídeos, imagens e fontes dentro) e abra aqui."
            } else {
                "Depois de colocar tudo no lugar, salve (Ctrl+S): agora o arquivo do projeto leva vídeos, imagens e fontes dentro, igual ao PSD, e não precisa mais procurar nada."
            };
            ui.label(egui::RichText::new(dica).size(11.0).color(t.text_faint));
            ui.add_space(14.0);
            ui.horizontal(|ui| {
                if !cfg!(target_arch = "wasm32") && n > 0 && ui.button("📁  Procurar numa pasta…").clicked() {
                    procurar = true;
                }
                if ui.button("   OK   ").clicked() {
                    fechar = true;
                }
            });
        });
    if fechar || procurar {
        let mut g = ESTADO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        if let Some(e) = g.as_mut() {
            e.janela = None;
        }
    }
    if procurar {
        // Arquivo ▸ Dependências ▸ Reconectar gravações ausentes: escolhe a pasta e acha pelo nome
        if let Err(err) = crate::menus::invoke(app, ctx, "file.relinkFootage", serde_json::json!({})) {
            app.ui.status = err;
        }
    }
}
