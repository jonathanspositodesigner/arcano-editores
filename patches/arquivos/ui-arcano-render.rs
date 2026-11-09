//! Arcano: a Fila de render mais direta (pedido do dono): cada item já aparece aberto, com uma
//! linha "Qualidade" (Original da composição, 1080p, 720p, 480p) e o botão "Escolher onde salvar"
//! (no navegador o vídeo vai para os Downloads).
//!
//! 09/11/2026 (programa mais leve): 1080p/720p/480p agora RENDERIZAM menor (Render Settings ▸
//! Resolution = lado menor / n, como a prévia em ½), em vez de renderizar a composição inteira e só
//! diminuir no fim (o Resize do módulo de saída fazia isso: uma comp 2000×3556 em "1080p" montava
//! 2000×3556 por quadro). O Resize fica só para acertar o tamanho exato (par). Item novo de comp
//! maior que 1080p já vem em 1080p (o público é rede social).

use std::collections::HashSet;
use std::sync::Mutex;

use effectcraft_engine::project::render_queue::{RenderQueueItem, RenderStatus};
use egui::{Align2, Rect, pos2, vec2};
use serde_json::{Value, json};
use web_time::{Duration, Instant};

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

/// Itens que já receberam (ou não precisavam) o padrão 1080p nesta sessão.
static PADRAO: Mutex<Option<HashSet<u64>>> = Mutex::new(None);

/// Render Settings ▸ Resolution para o lado menor `n` (nunca acima de 1: menor que isso a comp não
/// tem pixel a mais para dar, o Resize amplia como antes).
fn escala_para(w: u32, h: u32, n: u32) -> f64 {
    (n as f64 / w.min(h).max(1) as f64).min(1.0)
}

/// As ações que levam o item `it` à opção escolhida (`None` = Original). Só manda o que muda: o
/// comando recusa um pedido que não muda nada ("nothing to change", conferido no CLI).
fn acoes_qualidade(it: &RenderQueueItem, alvo: Option<((u32, u32), f64)>, actions: &mut Vec<(&'static str, Value)>) {
    let id = it.id;
    let k = alvo.map_or(1.0, |(_, k)| k);
    if (it.settings.resolution - k).abs() > 1e-6 {
        actions.push(("renderQueue.setRenderSettings", json!({"item": id, "resolution": k})));
    }
    let o = &it.output.resize;
    match alvo {
        None if o.enabled => actions.push(("renderQueue.setOutputModule", json!({"item": id, "resize": false}))),
        None => {}
        Some(((a, b), _)) if o.enabled && (o.width, o.height) == (a, b) && !o.lock_aspect => {}
        Some(((a, b), _)) => {
            actions.push(("renderQueue.setOutputModule", json!({"item": id, "resize": {"enabled": true, "width": a, "height": b, "lockAspect": false, "quality": "high"}})));
        }
    }
}

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
    // tamanho da composição (sem a Resolution do render, que agora muda com a escolha)
    let (w, h) = (c.width.max(1), c.height.max(1));
    let mut nomes = vec![format!("Original da composição ({w}×{h})")];
    let mut tamanhos: Vec<Option<((u32, u32), f64)>> = vec![None];
    for (nome, n) in ALTURAS {
        let (a, b) = tamanho(w, h, n);
        nomes.push(format!("{nome} ({a}×{b})"));
        tamanhos.push(Some(((a, b), escala_para(w, h, n))));
    }
    let o = &it.output.resize;
    let cheia = (it.settings.resolution - 1.0).abs() < 1e-6;
    let atual = if !o.enabled && cheia { Some(0) } else if !o.enabled { None } else { tamanhos.iter().position(|s| s.is_some_and(|(t, _)| t == (o.width, o.height))) };
    // item novo de comp maior que 1080p: já vem em 1080p (uma vez por item; quem trocar fica com a troca)
    {
        let mut g = PADRAO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        if g.get_or_insert_with(HashSet::new).insert(it.id)
            && !rendering
            && it.status == RenderStatus::Queued
            && it.last_output.is_none()
            && atual == Some(0)
            && w.min(h) > 1080
        {
            acoes_qualidade(it, tamanhos[1], actions);
        }
    }
    let texto = match atual {
        Some(i) => nomes[i].clone(),
        None if !o.enabled => format!("Personalizado ({}×{})", (w as f64 * it.settings.resolution).round(), (h as f64 * it.settings.resolution).round()),
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
        acoes_qualidade(it, tamanhos[i], actions);
    }
    // onde salvar
    let bt = Rect::from_min_size(pos2(dd.max.x + 12.0, r.min.y + 3.0), vec2(170.0, r.height() - 6.0));
    let destino = app.session.resolve_output(it).unwrap_or_default();
    // no navegador o pick_save existe mas só devolve um nome interno (não abre janela nenhuma)
    let tem_janela = !cfg!(target_arch = "wasm32") && app.hooks.pick_save.is_some();
    let web = DESTINO_WEB.get().filter(|_| cfg!(target_arch = "wasm32"));
    if let Some(d) = web {
        // navegador (Chrome/Edge): a janela de salvar do próprio navegador; o vídeo vai direto para lá
        let nome = std::path::Path::new(&destino).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        let escolhido = (d.escolhido)(&nome);
        if (d.pode)() {
            let b = ui.put(bt, egui::Button::new(egui::RichText::new("📁 Escolher onde salvar").size(11.5)));
            app.auto.add(&format!("renderQueue.item.{}.escolher", it.id), bt, "Escolher onde salvar");
            if b.clicked() && !rendering && !nome.is_empty() {
                (d.escolher)(&nome);
                ui.ctx().request_repaint_after(std::time::Duration::from_millis(500));
            }
            let texto = if escolhido.is_empty() { "Sem escolher: vai para os Downloads".to_string() } else { format!("Salva em: {escolhido}") };
            lp.text(pos2(bt.max.x + 10.0, r.center().y), Align2::LEFT_CENTER, texto, Tokens::ui(11.0), t.text_faint);
        } else {
            lp.text(pos2(bt.min.x, r.center().y), Align2::LEFT_CENTER, "O vídeo vai para os Downloads (para escolher a pasta, use o Chrome ou o Edge)", Tokens::ui(11.0), t.text_faint);
        }
    } else if tem_janela {
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
    // depois de renderizado: abrir a pasta do vídeo (programa de PC)
    if tem_janela && it.status == RenderStatus::Done && let Some(caminho) = it.last_output.clone() {
        let pb = Rect::from_min_size(pos2(bt.max.x + 12.0, r.min.y + 3.0), vec2(150.0, r.height() - 6.0));
        let b = ui.put(pb, egui::Button::new(egui::RichText::new("📂 Abrir pasta do vídeo").size(11.5)));
        app.auto.add(&format!("renderQueue.item.{}.pasta", it.id), pb, "Abrir pasta do vídeo");
        if b.clicked() {
            abrir_pasta(&caminho);
        }
    }
}

/// Navegador: a janela "Salvar como" do navegador (File System Access, Chrome/Edge), ligada pelo
/// effectcraft-web (`arcano_destino.rs`). Chave = nome do arquivo de saída.
pub struct DestinoWeb {
    pub pode: fn() -> bool,
    pub escolher: fn(&str) -> bool,
    pub escolhido: fn(&str) -> String,
}
pub static DESTINO_WEB: std::sync::OnceLock<DestinoWeb> = std::sync::OnceLock::new();

// ---------------------------------------------------------------- Abrir pasta / render concluído

/// Abre a pasta do arquivo no Explorer/Finder com o arquivo selecionado (pedido do dono, 06/11/2026).
pub fn abrir_pasta(caminho: &str) {
    #[cfg(target_arch = "wasm32")]
    {
        let _ = caminho;
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let p = std::path::Path::new(caminho);
        let r = if cfg!(target_os = "windows") {
            // explorer /select,"C:\pasta\arquivo.mp4" (um argumento só, com a vírgula)
            std::process::Command::new("explorer").arg(format!("/select,{}", p.display())).spawn().map(|_| ())
        } else if cfg!(target_os = "macos") {
            std::process::Command::new("open").arg("-R").arg(p).spawn().map(|_| ())
        } else {
            std::process::Command::new("xdg-open").arg(p.parent().unwrap_or(p)).spawn().map(|_| ())
        };
        if let Err(e) = r {
            log::warn!("abrir a pasta de {caminho}: {e}");
        }
    }
}

struct Concluido {
    /// a fila estava renderizando no último quadro
    renderizando: bool,
    /// (caminho do vídeo, quando terminou) do último render concluído, enquanto o aviso fica
    aviso: Option<(String, Instant)>,
    /// pedido de render esperando a GPU voltar: (parâmetros, prazo)
    esperando_gpu: Option<(Value, Instant)>,
    /// render que falhou: (composição, motivo) — janela com o motivo, até fechar
    falha: Option<(String, String)>,
}

static CONCLUIDO: Mutex<Concluido> = Mutex::new(Concluido { renderizando: false, aviso: None, esperando_gpu: None, falha: None });

/// Quanto tempo o aviso "Render concluído" fica na tela.
const AVISO_SEGUNDOS: u64 = 120;

/// "GPU · 120 ms/quadro" (ou "Processador") para a barra de progresso.
pub fn ritmo(pr: &effectcraft_engine::render_queue::JobState) -> String {
    let onde = if pr.gpu { "GPU" } else { "Processador" };
    if pr.done > 0 && pr.item_elapsed > 0.0 {
        format!("   ·   {onde} · {:.0} ms/quadro", pr.item_elapsed * 1000.0 / pr.done as f64)
    } else {
        format!("   ·   {onde}")
    }
}

/// Render pedido com a GPU da prévia caída ou ainda sendo montada de novo (programa de PC):
/// segura o pedido até ela voltar (no máximo 20 s), senão o vídeo inteiro sairia pelo processador.
/// `true`: o pedido ficou guardado (o chamador não executa agora).
#[cfg(target_arch = "wasm32")]
pub fn esperar_gpu(_app: &mut EffectcraftApp, _ctx: &egui::Context, _params: &Value) -> bool {
    false
}

#[cfg(not(target_arch = "wasm32"))]
pub fn esperar_gpu(app: &mut EffectcraftApp, ctx: &egui::Context, params: &Value) -> bool {
    if !app.session.project.settings.gpu_acceleration || app.session.accel.is_some() {
        return false;
    }
    let caiu = app.gpu_failures.as_ref().and_then(|b| b.failure()).is_some_and(|f| !f.presentation_lost);
    let montando = app.gpu_build.is_some();
    if !caiu && !montando {
        return false;
    }
    let mut g = CONCLUIDO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if g.esperando_gpu.is_some() {
        return true;
    }
    g.esperando_gpu = Some((params.clone(), Instant::now() + Duration::from_secs(20)));
    drop(g);
    crate::arcano_gpu::agora();
    app.ui.status = "Esperando a placa de vídeo voltar para renderizar na GPU…".into();
    ctx.request_repaint_after(Duration::from_millis(200));
    true
}

/// A cada quadro: solta o render que esperava a GPU, e mostra "Render concluído" com o botão
/// "Abrir pasta" quando a fila termina com um vídeo pronto.
pub fn quadro(app: &mut EffectcraftApp, ctx: &egui::Context) {
    // render esperando a GPU
    let pendente = {
        let mut g = CONCLUIDO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        match &g.esperando_gpu {
            Some((p, prazo)) if app.session.accel.is_some() || Instant::now() >= *prazo => {
                let p = p.clone();
                g.esperando_gpu = None;
                Some(p)
            }
            Some(_) => {
                crate::arcano_gpu::agora();
                ctx.request_repaint_after(Duration::from_millis(200));
                None
            }
            None => None,
        }
    };
    if let Some(p) = pendente {
        if app.session.accel.is_none() {
            log::warn!("a GPU não voltou em 20 s: o render vai pelo processador");
        }
        if let Err(e) = crate::menus::invoke(app, ctx, "renderQueue.render", p) {
            app.ui.status = e;
        }
    }
    // fim do render → aviso
    let renderizando = app.session.is_rendering();
    // registro do ritmo a cada 150 quadros (pra achar render que fica lento no meio, vídeo longo)
    if renderizando && let Some(pr) = app.session.render_progress() {
        static MARCA: std::sync::Mutex<(u64, f64)> = std::sync::Mutex::new((0, 0.0));
        let mut m = MARCA.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        if pr.done < m.0 {
            *m = (0, 0.0);
        }
        if pr.done >= m.0 + 150 && pr.item_elapsed > m.1 {
            let n = pr.done - m.0;
            let ms = (pr.item_elapsed - m.1) * 1000.0 / n as f64;
            log::info!(
                "[render] quadro {}/{} · {:.0} ms/quadro nos últimos {n} · {} · {}",
                pr.done,
                pr.total,
                ms,
                if pr.gpu { "GPU" } else { "Processador" },
                arcano_guarda::memoria_texto()
            );
            *m = (pr.done, pr.item_elapsed);
        }
    }
    let mut g = CONCLUIDO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if g.renderizando && !renderizando {
        // o item que terminou por último (o mais recente a começar)
        let ultimo = app.session.project.render_queue.iter().filter(|i| i.started.is_some()).max_by_key(|i| i.started.unwrap_or(0)).cloned();
        if let Some(i) = ultimo {
            match &i.status {
                RenderStatus::Done => {
                    log::info!("[render] concluído: {} ({})", i.last_output.clone().unwrap_or_default(), arcano_guarda::memoria_texto());
                    if let Some(c) = i.last_output.clone()
                        && !cfg!(target_arch = "wasm32")
                        && app.hooks.pick_save.is_some()
                    {
                        g.aviso = Some((c, Instant::now()));
                    }
                }
                RenderStatus::Failed(motivo) => {
                    let nome = app.session.project.item(i.comp).map(|c| c.name.clone()).unwrap_or_default();
                    log::error!("render falhou ({nome}): {motivo}");
                    g.falha = Some((nome, motivo.clone()));
                }
                _ => {}
            }
        }
    }
    g.renderizando = renderizando;
    if let Some((nome, motivo)) = g.falha.clone() {
        drop(g);
        janela_de_falha(app, ctx, &nome, &motivo);
        g = CONCLUIDO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    }
    let Some((caminho, desde)) = g.aviso.clone() else { return };
    if desde.elapsed() > Duration::from_secs(AVISO_SEGUNDOS) || renderizando {
        g.aviso = None;
        return;
    }
    drop(g);
    let t = app.tokens;
    let nome = std::path::Path::new(&caminho).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| caminho.clone());
    let mut fechar = false;
    let mut abrir = false;
    egui::Area::new(egui::Id::unique("arcano_render_concluido"))
        .anchor(Align2::RIGHT_BOTTOM, vec2(-18.0, -18.0))
        .order(egui::Order::Foreground)
        .show(ctx, |ui| {
            egui::Frame::window(&ctx.style_of(ctx.theme()))
                .fill(t.panel_bg)
                .corner_radius(10.0)
                .inner_margin(egui::Margin::same(14))
                .show(ui, |ui| {
                    ui.set_width(340.0);
                    ui.horizontal(|ui| {
                        ui.label(egui::RichText::new("✅").size(18.0));
                        ui.label(egui::RichText::new("Render concluído").size(14.0).strong().color(egui::Color32::from_gray(238)));
                    });
                    ui.add_space(4.0);
                    ui.label(egui::RichText::new(&nome).size(12.0).color(t.text_dim));
                    ui.add_space(10.0);
                    ui.horizontal(|ui| {
                        if ui.button(egui::RichText::new("📂  Abrir pasta do arquivo").size(12.5)).clicked() {
                            abrir = true;
                        }
                        if ui.button(egui::RichText::new("Fechar").size(12.0)).clicked() {
                            fechar = true;
                        }
                    });
                });
        });
    if abrir {
        abrir_pasta(&caminho);
    }
    if abrir || fechar {
        CONCLUIDO.lock().unwrap_or_else(std::sync::PoisonError::into_inner).aviso = None;
    }
}

/// Janela "O render falhou" com o motivo (antes só num balãozinho na coluna Status) e "Copiar erro".
fn janela_de_falha(app: &mut EffectcraftApp, ctx: &egui::Context, nome: &str, motivo: &str) {
    let t = app.tokens;
    let mut fechar = false;
    egui::Modal::new(egui::Id::unique("arcano_render_falhou"))
        .backdrop_color(egui::Color32::from_black_alpha(120))
        .frame(egui::Frame::window(&ctx.style_of(ctx.theme())).fill(t.panel_bg).inner_margin(egui::Margin::same(18)))
        .show(ctx, |ui| {
            ui.set_width(480.0);
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("⚠").size(20.0).color(egui::Color32::from_rgb(248, 113, 113)));
                ui.label(egui::RichText::new("O render falhou").size(17.0).strong().color(egui::Color32::from_gray(238)));
            });
            ui.add_space(6.0);
            if !nome.is_empty() {
                ui.label(egui::RichText::new(format!("Composição: {nome}")).size(12.0).color(t.text_dim));
            }
            ui.add_space(8.0);
            egui::ScrollArea::vertical().max_height(200.0).show(ui, |ui| {
                ui.label(egui::RichText::new(motivo).size(12.0).monospace().color(egui::Color32::from_gray(225)));
            });
            ui.add_space(12.0);
            ui.horizontal(|ui| {
                if ui.button("📋  Copiar erro").clicked() {
                    ui.ctx().copy_text(format!("Render falhou ({nome}): {motivo}"));
                    app.ui.status = "Erro copiado.".into();
                }
                if ui.button("   OK   ").clicked() {
                    fechar = true;
                }
            });
        });
    if fechar {
        CONCLUIDO.lock().unwrap_or_else(std::sync::PoisonError::into_inner).falha = None;
    }
}

// ---------------------------------------------------------------- prévia parada durante o render

/// Render rodando agora (a prévia não pede quadro enquanto isso).
static RENDER_RODANDO: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Se a prévia está parada porque tem render rodando.
pub fn previa_parada() -> bool {
    RENDER_RODANDO.load(std::sync::atomic::Ordering::Relaxed)
}

/// Dono, 09/11/2026 ("pra que prévia enquanto renderiza?"): o registro do PC dele mostrou a prévia
/// montando quadros AO MESMO TEMPO que o render, os dois disputando a memória da placa (6 GB),
/// "Out of Memory" 16 s depois de começar e a placa caindo no meio. Agora, a cada passada da
/// janela: começou um render → para o play, larga os quadros da prévia na fila e solta a memória
/// de camadas que a prévia guarda na placa (fica no mínimo); acabou → a prévia volta com a
/// memória de sempre. Enquanto isso o visor mostra o último quadro que já tinha.
pub fn previa_durante_render(app: &mut EffectcraftApp) {
    let agora = app.session.is_rendering();
    let antes = RENDER_RODANDO.swap(agora, std::sync::atomic::Ordering::Relaxed);
    if agora && !antes {
        app.stop();
        app.frames.arcano_largar_fila();
        if let Some(g) = &app.gpu {
            g.context().set_upload_budget(64 << 20);
            g.context().clear_uploads();
        }
        // PC com pouca memória livre (registro de 09/11/2026: 7,8 GB usados, ~1 GB livre, travou 3
        // vezes): solta também os quadros da prévia guardados na memória (até 3 GB) pro render.
        // Com memória sobrando eles ficam (a prévia volta sem montar tudo de novo).
        if let Some((livre, total, _)) = arcano_guarda::memoria()
            && livre < 2048.max(total / 4)
        {
            app.frames.clear();
            log::info!("[render] pouca memória livre ({livre} MB de {total} MB): quadros da prévia soltos pro render");
        }
        app.ui.status = "Renderizando: a prévia volta quando o render terminar.".into();
        log::info!("[render] prévia parada enquanto renderiza (memória da placa liberada pro render)");
    } else if !agora && antes {
        if let Some(g) = &app.gpu {
            crate::arcano_gpu::ajustar(g);
        }
        log::info!("[render] render acabou: prévia de volta");
    }
}
