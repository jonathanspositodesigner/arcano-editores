//! Arcano Layers (editor de imagem, no navegador e no PC): o que junta o Arcano Layers antigo ao
//! editor novo.
//!
//! - **Conta na barra do topo** (o canto oposto aos menus): créditos, "Preços" e o perfil, como no
//!   topo do ArcanoApp. Tudo que é da conta (senha, configurações, planos) abre a página do ArcanoApp.
//! - **Barra rápida da camada** (a mesma do Arcano Layers antigo): flutua embaixo da camada
//!   escolhida, com a alça para arrastar, o "+" da referência, "O que mudar nesta camada?",
//!   Upscale, Remover fundo, Cor e a setinha. O que cobra pergunta antes ("Sim" com o preço).
//!
//! ⚠️ QUEM FAZ A IA É O PAINEL DO ARCANO DESIGN (o plugin): ele já tem a conta, os créditos, o envio
//! da imagem, a fila e a montagem do resultado na camada (o resultado entra acima, a original fica
//! desligada). Este módulo só desenha e conversa com ele por mensagens JSON:
//! - editor → painel: [`pedidos`] (navegador: `arcanoBarraPedidos` do photocraft-web; PC: o
//!   WebView do painel, `painel_arcano.rs`);
//! - painel → editor: [`receber`] (`{tipo: conta | custos | ocupada | livre | aviso}`).
//!
//! A Cor é NATIVA (não cobra): um Mapa de Gradiente (sombra · meio · luz, o tritônico do Arcano
//! Layers antigo) recortado na camada, chamado "Cor · <camada>". Intensidade = opacidade dele.

use std::sync::{Mutex, PoisonError};

use egui::{Color32, Id, Pos2, Rect, RichText, Sense, Stroke, Vec2, pos2, vec2};
use photocraft_doc::{LayerContent, LayerId};
use serde_json::{Value, json};

use crate::PhotocraftApp;
use crate::file_dialog::{FileDialogAnswer, FileDialogRequest};
use crate::theme::Tokens;

const SITE: &str = "https://arcanoapp.voxvisual.com.br";
const ROXO: Color32 = Color32::from_rgb(168, 85, 247);
const AZUL: Color32 = Color32::from_rgb(37, 99, 235);
const PREFIXO_COR: &str = "Cor · ";
/// Preços de reserva enquanto o painel não manda os do servidor (os do Arcano Layers antigo).
const CUSTO_PADRAO: [u32; 3] = [50, 60, 10];

#[derive(Clone, Default)]
struct Conta {
    logado: bool,
    nome: String,
    email: String,
    creditos: Option<f64>,
    premium: bool,
}

struct Referencia {
    nome: String,
    bytes: Vec<u8>,
    miniatura: Option<egui::TextureHandle>,
}

#[derive(Default)]
struct Estado {
    conta: Conta,
    /// Preço de alterar, upscale e remover fundo (0 = ainda não veio do painel).
    custos: [u32; 3],
    /// Camadas trabalhando (id, texto do andamento).
    ocupadas: Vec<(u64, String)>,
    /// Aviso curto embaixo da barra (texto, é erro) e até quando.
    aviso: Option<(String, bool, f64)>,
    saida: Vec<Value>,
    /// Pedidos mandados que o painel ainda não confirmou (camada, quando foi): sem resposta em 20 s,
    /// a barra solta a camada e avisa (painel fechado, sem login ou com o plugin antigo).
    esperando: Vec<(u64, f64)>,
    referencia: Option<Referencia>,
    ctx: Option<egui::Context>,
}

static ESTADO: Mutex<Option<Estado>> = Mutex::new(None);

fn com<R>(f: impl FnOnce(&mut Estado) -> R) -> R {
    let mut g = ESTADO.lock().unwrap_or_else(PoisonError::into_inner);
    f(g.get_or_insert_with(Estado::default))
}

fn agora(ctx: &egui::Context) -> f64 {
    ctx.input(|i| i.time)
}

/// Painel → editor (JSON). `conta`, `custos`, `ocupada`, `livre`, `aviso`.
pub fn receber(texto: &str) {
    let Ok(v) = serde_json::from_str::<Value>(texto) else { return };
    let s = |k: &str| v.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    let camada = v.get("layer").and_then(Value::as_u64).unwrap_or(0);
    com(|e| {
        match v.get("tipo").and_then(Value::as_str).unwrap_or("") {
            "conta" => {
                e.conta = Conta {
                    logado: v.get("logado").and_then(Value::as_bool).unwrap_or(false),
                    nome: s("nome"),
                    email: s("email"),
                    creditos: v.get("creditos").and_then(Value::as_f64),
                    premium: v.get("premium").and_then(Value::as_bool).unwrap_or(false),
                };
            }
            "custos" => {
                for (i, k) in ["alterar", "upscale", "fundo"].iter().enumerate() {
                    if let Some(n) = v.get(*k).and_then(Value::as_u64) {
                        e.custos[i] = u32::try_from(n).unwrap_or(0);
                    }
                }
            }
            "ocupada" => {
                e.esperando.retain(|w| w.0 != camada);
                let t = s("texto");
                match e.ocupadas.iter_mut().find(|o| o.0 == camada) {
                    Some(o) => o.1 = t,
                    None => e.ocupadas.push((camada, t)),
                }
            }
            "livre" => {
                e.esperando.retain(|w| w.0 != camada);
                e.ocupadas.retain(|o| o.0 != camada);
                let erro = s("erro");
                if !erro.is_empty() {
                    e.aviso = Some((erro, true, f64::MAX));
                } else if !s("texto").is_empty() {
                    e.aviso = Some((s("texto"), false, f64::MAX));
                }
            }
            "aviso" => e.aviso = Some((s("texto"), v.get("erro").and_then(Value::as_bool).unwrap_or(false), f64::MAX)),
            _ => {}
        }
        if let Some(ctx) = &e.ctx {
            ctx.request_repaint();
        }
    });
}

/// Editor → painel: os pedidos desde a última vez (cada um um objeto JSON com `acao`).
pub fn pedidos() -> Vec<Value> {
    com(|e| std::mem::take(&mut e.saida))
}

fn mandar(v: Value) {
    com(|e| e.saida.push(v));
}

fn abrir(app: &mut PhotocraftApp, ctx: &egui::Context, caminho: &str) {
    let url = format!("{SITE}{caminho}");
    crate::links::open(app, ctx, &url);
}

fn milhar(n: f64) -> String {
    let n = n.max(0.0).round() as u64;
    let s = n.to_string();
    let mut out = String::new();
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push('.');
        }
        out.push(c);
    }
    out
}

// ─────────────────────────────────────────────────────────────── conta na barra do topo

/// Créditos, Preços e o perfil, no grupo da ponta da barra do topo (layout da direita para a
/// esquerda: o primeiro desenhado fica na ponta).
pub fn conta_ui(app: &mut PhotocraftApp, ui: &mut egui::Ui) {
    let c = com(|e| {
        if e.ctx.is_none() {
            e.ctx = Some(ui.ctx().clone());
        }
        e.conta.clone()
    });
    if !c.logado {
        return;
    }
    let t = Tokens::get(ui.ctx());
    let ctx = ui.ctx().clone();
    // o perfil (a bolinha com a inicial)
    let inicial = c.nome.chars().next().or_else(|| c.email.chars().next()).map(|ch| ch.to_uppercase().to_string()).unwrap_or_else(|| "?".into());
    let (r, perfil) = ui.allocate_exact_size(vec2(24.0, 24.0), Sense::click());
    let fundo = if perfil.hovered() { ROXO } else { t.accent_soft };
    ui.painter().circle_filled(r.center(), 12.0, fundo);
    ui.painter().text(r.center(), egui::Align2::CENTER_CENTER, &inicial, egui::FontId::proportional(12.0), Color32::WHITE);
    let perfil = perfil.on_hover_text("Sua conta do ArcanoApp");
    let mut ir: Option<&str> = None;
    let mut sair = false;
    egui::Popup::menu(&perfil).close_behavior(egui::PopupCloseBehavior::CloseOnClickOutside).show(|ui| {
        ui.set_min_width(220.0);
        ui.add_space(2.0);
        ui.label(RichText::new(if c.nome.is_empty() { c.email.split('@').next().unwrap_or("Meu perfil") } else { c.nome.as_str() }).strong());
        if !c.email.is_empty() {
            ui.label(RichText::new(&c.email).size(11.0).color(t.text_dim));
        }
        if c.premium {
            ui.label(RichText::new("★ Premium ativo").size(11.0).color(Color32::from_rgb(245, 158, 11)));
        }
        ui.separator();
        ui.horizontal(|ui| {
            ui.label(RichText::new("● ").color(Color32::from_rgb(250, 204, 21)));
            ui.label("Créditos");
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui.small_button("+").on_hover_text("Comprar créditos").clicked() {
                    ir = Some("/planos-2");
                }
                ui.label(RichText::new(c.creditos.map(milhar).unwrap_or_else(|| "…".into())).strong());
            });
        });
        ui.separator();
        if ui.button("Alterar senha").clicked() {
            ir = Some("/change-password");
        }
        if ui.button("Configurações").clicked() {
            ir = Some("/profile-settings");
        }
        if ui.button("Minhas criações").clicked() {
            ir = Some("/minhas-criacoes");
        }
        ui.separator();
        if ui.button(RichText::new("Sair").color(Color32::from_rgb(248, 113, 113))).clicked() {
            sair = true;
        }
    });
    // Preços (o botão roxo do ArcanoApp)
    let precos = ui.add(egui::Button::new(RichText::new("Preços").color(Color32::WHITE).strong().size(12.0)).fill(ROXO).corner_radius(12.0));
    if precos.on_hover_text("Planos e créditos do ArcanoApp").clicked() {
        ir = Some("/planos-2");
    }
    // os créditos
    let txt = c.creditos.map(milhar).unwrap_or_else(|| "…".into());
    let pilula = ui.add(
        egui::Button::new(RichText::new(format!("● {txt}")).size(12.0).color(t.text))
            .fill(t.field)
            .stroke(Stroke::new(1.0, t.field_border))
            .corner_radius(12.0),
    );
    if pilula.on_hover_text("Seus créditos do ArcanoApp. Clique para recarregar.").clicked() {
        ir = Some("/planos-2");
    }
    if c.premium {
        ui.label(RichText::new("★ Premium").size(11.0).strong().color(Color32::from_rgb(245, 158, 11)));
    }
    if let Some(caminho) = ir {
        abrir(app, &ctx, caminho);
    }
    if sair {
        mandar(json!({"acao": "sair"}));
    }
}

// ─────────────────────────────────────────────────────────────── a barra rápida da camada

/// O que está perguntando antes de cobrar.
#[derive(Clone)]
struct Pergunta {
    acao: &'static str,
    titulo: String,
    custo: u32,
    camada: u64,
    pedido: String,
}

/// O estado da barra entre os quadros (só desta tela).
#[derive(Clone, Default)]
struct Barra {
    camada: u64,
    arrasto: Vec2,
    texto: String,
    pergunta: Option<Pergunta>,
    cor_aberta: bool,
    cor: Option<Cor>,
    cor_aplicada_em: f64,
    cor_pendente: bool,
}

/// A cor da camada: o meio (escolhido na roda) e, se a pessoa mexeu, a sombra e a luz.
#[derive(Clone, Copy, PartialEq)]
struct Cor {
    h: f32,
    s: f32,
    v: f32,
    escuro: Option<Color32>,
    claro: Option<Color32>,
    forca: f32,
}

fn id_barra() -> Id {
    Id::unique("arcano_barra_rapida")
}

/// A barra embaixo (ou em cima) da camada escolhida. Chamada a cada quadro, depois do editor.
pub fn barra(app: &mut PhotocraftApp, ctx: &egui::Context) {
    com(|e| {
        if e.ctx.is_none() {
            e.ctx = Some(ctx.clone());
        }
    });
    let conta = com(|e| e.conta.clone());
    if !conta.logado || app.drag.is_some() || app.file_dialog_open() {
        return;
    }
    let Some(xf) = crate::canvas::ViewXform::active(app) else { return };
    let Some(st) = app.session.active() else { return };
    let doc_n = app.session.active_index().map_or(1, |i| i + 1);
    let Some(lid) = st.active_layer else { return };
    if st.selected_layers.len() > 1 {
        return;
    }
    let Some(l) = st.doc.layer(lid) else { return };
    if !l.visible || matches!(l.content, LayerContent::Group(_) | LayerContent::Adjustment(_) | LayerContent::Fill(_)) {
        return;
    }
    let Some(b) = photocraft_engine::layer_multi_cmds::layer_bounds(l) else { return };
    let nome = l.name.clone();
    let camada = lid.0;
    // a caixa da camada na tela
    let cantos = [(b.x0, b.y0), (b.x1, b.y0), (b.x0, b.y1), (b.x1, b.y1)].map(|(x, y)| xf.to_screen(x as f32, y as f32));
    let caixa = Rect::from_points(&cantos);
    let tela = xf.rect;
    if !tela.intersects(caixa) {
        return;
    }

    let mut bar: Barra = ctx.data(|d| d.get_temp(id_barra())).unwrap_or_default();
    if bar.camada != camada {
        bar = Barra { camada, ..Barra::default() };
    }
    // pedido que o painel não confirmou em 20 s: solta a camada e explica
    let t_agora = agora(ctx);
    com(|e| {
        let vencidos: Vec<u64> = e.esperando.iter().filter(|w| t_agora - w.1 > 20.0).map(|w| w.0).collect();
        if !vencidos.is_empty() {
            e.esperando.retain(|w| !vencidos.contains(&w.0));
            e.ocupadas.retain(|o| !vencidos.contains(&o.0));
            e.aviso = Some(("O painel do Arcano Design não respondeu. Deixe o painel aberto (à direita), entre na conta e, se ele pedir, atualize o plugin.".into(), true, f64::MAX));
        }
        if !e.esperando.is_empty() {
            ctx.request_repaint_after(std::time::Duration::from_secs(1));
        }
    });
    let ocupada = com(|e| e.ocupadas.iter().find(|o| o.0 == camada).map(|o| o.1.clone()));
    let custos = com(|e| {
        let mut c = e.custos;
        for (i, v) in c.iter_mut().enumerate() {
            if *v == 0 {
                *v = CUSTO_PADRAO[i];
            }
        }
        c
    });
    let t = Tokens::get(ctx);

    let largura = 392.0_f32.min(tela.width() - 16.0).max(240.0);
    let altura = 38.0;
    let mut pos = pos2(caixa.center().x - largura / 2.0, caixa.bottom() + 12.0);
    if pos.y + altura > tela.bottom() - 8.0 {
        pos.y = (caixa.top() - altura - 12.0).max(tela.top() + 8.0);
        if caixa.top() - altura - 12.0 < tela.top() + 8.0 {
            pos.y = tela.bottom() - altura - 12.0;
        }
    }
    pos += bar.arrasto;
    pos.x = pos.x.clamp(tela.left() + 8.0, (tela.right() - largura - 8.0).max(tela.left() + 8.0));
    pos.y = pos.y.clamp(tela.top() + 8.0, (tela.bottom() - altura - 8.0).max(tela.top() + 8.0));

    let mut acao: Option<&'static str> = None;
    let mut anexar = false;
    let mut tirar_ref = false;
    let area = egui::Area::new(Id::unique("arcano_barra_area"))
        .order(egui::Order::Foreground)
        .fixed_pos(pos)
        .constrain(false)
        .show(ctx, |ui| {
            egui::Frame::new()
                .fill(Color32::from_rgba_unmultiplied(20, 16, 26, 242))
                .stroke(Stroke::new(1.0, Color32::from_rgba_unmultiplied(168, 85, 247, 150)))
                .corner_radius(19.0)
                .inner_margin(egui::Margin { left: 6, right: 6, top: 5, bottom: 5 })
                .shadow(egui::Shadow { offset: [0, 4], blur: 16, spread: 0, color: Color32::from_rgba_unmultiplied(124, 58, 237, 70) })
                .show(ui, |ui| {
                    ui.set_width(largura - 12.0);
                    ui.horizontal_centered(|ui| {
                        ui.spacing_mut().item_spacing.x = 4.0;
                        // a alça: arrasta a barra
                        let (ra, alca) = ui.allocate_exact_size(vec2(12.0, 26.0), Sense::drag());
                        for (dx, dy) in [(-2.5, -5.0), (2.5, -5.0), (-2.5, 0.0), (2.5, 0.0), (-2.5, 5.0), (2.5, 5.0)] {
                            ui.painter().circle_filled(ra.center() + vec2(dx, dy), 1.3, if alca.hovered() { Color32::WHITE } else { t.text_faint });
                        }
                        if alca.hovered() || alca.dragged() {
                            ui.ctx().set_cursor_icon(if alca.dragged() { egui::CursorIcon::Grabbing } else { egui::CursorIcon::Grab });
                        }
                        if alca.dragged() {
                            bar.arrasto += alca.drag_delta();
                        }
                        if let Some(txt) = &ocupada {
                            ui.add(egui::Spinner::new().size(16.0).color(ROXO));
                            ui.label(RichText::new(txt).size(12.0).color(Color32::from_gray(225)));
                            return;
                        }
                        // o "+" da referência (ou a miniatura dela)
                        let tem_ref = com(|e| e.referencia.as_ref().map(|r| (r.nome.clone(), r.miniatura.clone())));
                        match tem_ref {
                            Some((nome_ref, mini)) => {
                                let (rr, resp) = ui.allocate_exact_size(vec2(26.0, 26.0), Sense::click());
                                match mini {
                                    Some(tex) => {
                                        ui.painter().image(tex.id(), rr, Rect::from_min_max(pos2(0.0, 0.0), pos2(1.0, 1.0)), Color32::WHITE);
                                    }
                                    None => {
                                        ui.painter().rect_filled(rr, 6.0, t.accent_soft);
                                    }
                                }
                                ui.painter().rect_stroke(rr, 6.0, Stroke::new(1.0, ROXO), egui::StrokeKind::Inside);
                                if resp.hovered() {
                                    ui.painter().rect_filled(rr, 6.0, Color32::from_black_alpha(140));
                                    crate::icons::paint(ui, rr, "x", 14.0, Color32::WHITE);
                                }
                                if resp.on_hover_text(format!("Referência: {nome_ref} (clique para tirar)")).clicked() {
                                    tirar_ref = true;
                                }
                            }
                            None => {
                                if crate::icons::button(ui, "plus", 26.0, false, "Anexar uma imagem de referência").clicked() {
                                    anexar = true;
                                }
                            }
                        }
                        let botoes = 4.0 * 30.0;
                        let campo = (ui.available_width() - botoes).max(60.0);
                        let edit = ui.add(
                            egui::TextEdit::singleline(&mut bar.texto)
                                .hint_text("O que mudar nesta camada?")
                                .desired_width(campo)
                                .frame(egui::Frame::NONE)
                                .text_color(Color32::WHITE),
                        );
                        if edit.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) && !bar.texto.trim().is_empty() {
                            acao = Some("alterar");
                        }
                        if crate::icons::button(ui, "maximize-2", 26.0, false, &format!("Upscale da camada ({} créditos)", custos[1])).clicked() {
                            acao = Some("upscale");
                        }
                        if crate::icons::button(ui, "eraser-background", 26.0, false, &format!("Remover o fundo ({} créditos)", custos[2])).clicked() {
                            acao = Some("fundo");
                        }
                        // a cor: a rodinha colorida
                        let (rc, cor) = ui.allocate_exact_size(vec2(26.0, 26.0), Sense::click());
                        roda_pequena(ui.painter(), rc.center(), if cor.hovered() || bar.cor_aberta { 11.0 } else { 10.0 });
                        if cor.on_hover_text("Cor da camada (não gasta créditos)").clicked() {
                            bar.cor_aberta = !bar.cor_aberta;
                        }
                        // a setinha
                        let (rs, envia) = ui.allocate_exact_size(vec2(26.0, 26.0), Sense::click());
                        let pronto = !bar.texto.trim().is_empty();
                        ui.painter().circle_filled(rs.center(), 13.0, if pronto { ROXO } else { Color32::from_gray(60) });
                        crate::icons::paint(ui, rs, "chevron-up", 15.0, Color32::WHITE);
                        if envia.on_hover_text(format!("Fazer a alteração ({} créditos)", custos[0])).clicked() && pronto {
                            acao = Some("alterar");
                        }
                    });
                });
        });
    let rect_barra = area.response.rect;

    if anexar {
        let ext = ["png", "jpg", "jpeg", "webp"].iter().map(|s| (*s).to_string()).collect();
        let _ = app.ask_file(FileDialogRequest::Open { multiple: false, initial_dir: None, extensions: Some(ext) }, |_app, resposta| {
            let lido = match resposta {
                FileDialogAnswer::Contents(nome, bytes) => Some((nome, bytes)),
                FileDialogAnswer::Paths(p) => p.first().and_then(|c| {
                    let nome = std::path::Path::new(c).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "referencia.png".into());
                    std::fs::read(c).ok().map(|b| (nome, b))
                }),
                _ => None,
            };
            if let Some((nome, bytes)) = lido {
                if bytes.len() > 20 * 1024 * 1024 {
                    com(|e| e.aviso = Some(("A referência passa de 20 MB. Use uma imagem menor.".into(), true, f64::MAX)));
                } else {
                    let ctx = com(|e| e.ctx.clone());
                    let miniatura = ctx.and_then(|c| miniatura(&c, &bytes));
                    com(|e| e.referencia = Some(Referencia { nome, bytes, miniatura }));
                }
            }
            Ok(Value::Null)
        });
    }
    if tirar_ref {
        com(|e| e.referencia = None);
    }
    if let Some(a) = acao {
        let (titulo, custo) = match a {
            "upscale" => ("Fazer o upscale desta camada?", custos[1]),
            "fundo" => ("Remover o fundo desta camada?", custos[2]),
            _ => ("Fazer a alteração nesta camada?", custos[0]),
        };
        bar.pergunta = Some(Pergunta { acao: a, titulo: titulo.into(), custo, camada, pedido: bar.texto.trim().to_string() });
        bar.cor_aberta = false;
    }

    // a pergunta antes de cobrar (Sim em destaque azul, com o preço)
    if let Some(p) = bar.pergunta.clone() {
        let mut fechar = false;
        let acima = pos2(rect_barra.left(), rect_barra.top() - 8.0);
        egui::Area::new(Id::unique("arcano_barra_pergunta"))
            .order(egui::Order::Foreground)
            .fixed_pos(acima)
            .pivot(egui::Align2::LEFT_BOTTOM)
            .show(ctx, |ui| {
                egui::Frame::new().fill(Color32::from_rgb(24, 20, 32)).stroke(Stroke::new(1.0, t.card_border)).corner_radius(12.0).inner_margin(12.0).show(ui, |ui| {
                    ui.set_max_width(300.0);
                    ui.label(RichText::new(&p.titulo).strong().color(Color32::WHITE));
                    if p.acao == "alterar" {
                        ui.label(RichText::new(format!("\"{}\"", p.pedido)).size(12.0).color(Color32::from_gray(200)));
                        if com(|e| e.referencia.is_some()) {
                            ui.label(RichText::new("Com a imagem de referência.").size(11.0).color(Color32::from_gray(170)));
                        }
                    }
                    ui.label(RichText::new("O resultado entra acima da camada; a original fica desligada.").size(11.0).color(Color32::from_gray(160)));
                    ui.add_space(6.0);
                    ui.horizontal(|ui| {
                        let sim = ui.add(egui::Button::new(RichText::new(format!("Sim · {} créditos", p.custo)).color(Color32::WHITE).strong()).fill(AZUL).corner_radius(8.0));
                        if sim.clicked() {
                            let mut pedido = json!({"acao": p.acao, "doc": doc_n, "layer": p.camada, "nome": nome, "custo": p.custo});
                            if p.acao == "alterar" {
                                pedido["pedido"] = json!(p.pedido);
                                if let Some(r) = com(|e| e.referencia.take()) {
                                    use base64::Engine as _;
                                    pedido["ref"] = json!({"nome": r.nome, "base64": base64::engine::general_purpose::STANDARD.encode(&r.bytes)});
                                }
                                bar.texto.clear();
                            }
                            let quando = agora(ctx);
                            com(|e| {
                                e.ocupadas.push((p.camada, "Enviando…".into()));
                                e.esperando.push((p.camada, quando));
                                e.aviso = None;
                            });
                            mandar(pedido);
                            fechar = true;
                        }
                        if ui.button("Não").clicked() {
                            fechar = true;
                        }
                    });
                });
            });
        if fechar || ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
            bar.pergunta = None;
        }
    }

    // o aviso (erro ou pronto) embaixo da barra, até a pessoa fechar
    if let Some((texto, erro, _)) = com(|e| e.aviso.clone()) {
        let mut fechar = false;
        egui::Area::new(Id::unique("arcano_barra_aviso"))
            .order(egui::Order::Foreground)
            .fixed_pos(pos2(rect_barra.left(), rect_barra.bottom() + 6.0))
            .show(ctx, |ui| {
                egui::Frame::new()
                    .fill(if erro { Color32::from_rgb(69, 10, 10) } else { Color32::from_rgb(20, 40, 28) })
                    .corner_radius(10.0)
                    .inner_margin(8.0)
                    .show(ui, |ui| {
                        ui.set_max_width(largura - 16.0);
                        ui.horizontal(|ui| {
                            ui.label(RichText::new(&texto).size(12.0).color(Color32::WHITE));
                            if ui.small_button("✕").clicked() {
                                fechar = true;
                            }
                        });
                    });
            });
        if fechar {
            com(|e| e.aviso = None);
        }
        let _ = agora(ctx);
    }

    // a cor da camada (nativa)
    if bar.cor_aberta {
        janela_cor(app, ctx, &mut bar, lid, &nome, rect_barra);
    }
    ctx.data_mut(|d| d.insert_temp(id_barra(), bar));
}

/// A miniatura da referência (até 64 px), para mostrar no lugar do "+".
fn miniatura(ctx: &egui::Context, bytes: &[u8]) -> Option<egui::TextureHandle> {
    use photocraft_codecs::{ChannelLayout, SampleType};
    let img = photocraft_codecs::decode(bytes).ok()?.convert(ChannelLayout::Rgba, SampleType::U8);
    let (w, h) = (img.width() as usize, img.height() as usize);
    let dados = img.data();
    if w == 0 || h == 0 || dados.len() != w * h * 4 {
        return None;
    }
    let lado = 64usize;
    let (mw, mh) = if w >= h { (lado, (h * lado / w).max(1)) } else { ((w * lado / h).max(1), lado) };
    let mut px = Vec::with_capacity(mw * mh * 4);
    for y in 0..mh {
        for x in 0..mw {
            let i = ((y * h / mh) * w + (x * w / mw)) * 4;
            px.extend_from_slice(&dados[i..i + 4]);
        }
    }
    Some(ctx.load_texture("arcano_barra_ref", egui::ColorImage::from_rgba_unmultiplied([mw, mh], &px), egui::TextureOptions::LINEAR))
}

fn roda_pequena(p: &egui::Painter, c: Pos2, r: f32) {
    let n = 36;
    for i in 0..n {
        let a0 = i as f32 / n as f32 * std::f32::consts::TAU;
        let a1 = (i + 1) as f32 / n as f32 * std::f32::consts::TAU;
        let cor = crate::widgets::hue_color(i as f32 / n as f32 * 360.0);
        p.add(egui::Shape::convex_polygon(vec![c, c + Vec2::angled(a0) * r, c + Vec2::angled(a1) * r], cor, Stroke::NONE));
    }
    p.circle_stroke(c, r, Stroke::new(1.0, Color32::from_white_alpha(120)));
}

// ─────────────────────────────────────────────────────────────── a cor (Mapa de Gradiente)

fn hsv_rgb(h: f32, s: f32, v: f32) -> Color32 {
    let h = (h.rem_euclid(1.0)) * 6.0;
    let i = h.floor();
    let f = h - i;
    let (p, q, t) = (v * (1.0 - s), v * (1.0 - s * f), v * (1.0 - s * (1.0 - f)));
    let (r, g, b) = match i as i32 {
        0 => (v, t, p),
        1 => (q, v, p),
        2 => (p, v, t),
        3 => (p, q, v),
        4 => (t, p, v),
        _ => (v, p, q),
    };
    Color32::from_rgb((r * 255.0).round() as u8, (g * 255.0).round() as u8, (b * 255.0).round() as u8)
}

fn rgb_hsv(c: Color32) -> (f32, f32, f32) {
    let (r, g, b) = (f32::from(c.r()) / 255.0, f32::from(c.g()) / 255.0, f32::from(c.b()) / 255.0);
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let d = max - min;
    let h = if d <= f32::EPSILON {
        0.0
    } else if (max - r).abs() <= f32::EPSILON {
        ((g - b) / d).rem_euclid(6.0) / 6.0
    } else if (max - g).abs() <= f32::EPSILON {
        ((b - r) / d + 2.0) / 6.0
    } else {
        ((r - g) / d + 4.0) / 6.0
    };
    (h, if max <= 0.0 { 0.0 } else { d / max }, max)
}

/// Sombra e luz automáticas a partir do meio (como o tritônico do Arcano Layers antigo: a luz bem
/// clara e menos saturada; a sombra escura, com um pouco menos de cor).
fn tons(cor: &Cor) -> (Color32, Color32, Color32) {
    let meio = hsv_rgb(cor.h, cor.s, cor.v);
    let claro = cor.claro.unwrap_or_else(|| hsv_rgb(cor.h, cor.s * 0.35, (cor.v + (1.0 - cor.v) * 0.85).min(1.0)));
    let escuro = cor.escuro.unwrap_or_else(|| hsv_rgb(cor.h, (cor.s * 1.05).min(1.0), cor.v * 0.28));
    (escuro, meio, claro)
}

fn hex(c: Color32) -> String {
    format!("#{:02x}{:02x}{:02x}", c.r(), c.g(), c.b())
}

/// O Mapa de Gradiente "Cor · ..." recortado logo acima da camada, se já existe.
fn camada_cor(app: &PhotocraftApp, alvo: LayerId) -> Option<(LayerId, Vec<(f32, [f32; 3])>, f32)> {
    let st = app.session.active()?;
    fn achar(lista: &[photocraft_doc::Layer], alvo: LayerId) -> Option<(LayerId, Vec<(f32, [f32; 3])>, f32)> {
        for (i, l) in lista.iter().enumerate() {
            if l.id == alvo {
                let acima = lista.get(i + 1)?;
                return match &acima.content {
                    LayerContent::Adjustment(photocraft_doc::adjust::Adjustment::GradientMap { stops, .. }) if acima.clipped && acima.name.starts_with(PREFIXO_COR) => {
                        Some((acima.id, stops.clone(), acima.opacity))
                    }
                    _ => None,
                };
            }
            if let LayerContent::Group(g) = &l.content
                && let Some(r) = achar(&g.children, alvo)
            {
                return Some(r);
            }
        }
        None
    }
    achar(&st.doc.layers, alvo)
}

fn aplicar_cor(app: &mut PhotocraftApp, alvo: LayerId, nome: &str, cor: &Cor) {
    let (e, m, c) = tons(cor);
    let stops = json!([[0.0, hex(e)], [0.5, hex(m)], [1.0, hex(c)]]);
    let r = match camada_cor(app, alvo) {
        Some((id, _, _)) => app
            .run("layer.setAdjustment", json!({"layer": id.0, "stops": stops}))
            .and_then(|_| app.run("layer.setProps", json!({"layer": id.0, "opacity": cor.forca}))),
        None => app
            .run("layer.select", json!({"layer": alvo.0, "mode": "replace"}))
            .and_then(|_| app.run("layer.newAdjustmentLayer.gradientMap", json!({"stops": stops})))
            .and_then(|v| {
                let id = v.get("layer").and_then(Value::as_u64).ok_or_else(|| "sem camada".to_string())?;
                app.run("layer.setProps", json!({"layer": id, "name": format!("{PREFIXO_COR}{nome}"), "clipped": true, "opacity": cor.forca}))
            })
            .and_then(|_| app.run("layer.select", json!({"layer": alvo.0, "mode": "replace"}))),
    };
    if let Err(e) = r {
        com(|s| s.aviso = Some((format!("Não consegui aplicar a cor: {e}"), true, f64::MAX)));
    }
}

fn tirar_cor(app: &mut PhotocraftApp, alvo: LayerId) {
    if let Some((id, _, _)) = camada_cor(app, alvo) {
        let _ = app.run("layer.delete", json!({"layer": id.0}));
        let _ = app.run("layer.select", json!({"layer": alvo.0, "mode": "replace"}));
    }
}

const AMOSTRAS: [&str; 10] = ["#e11d48", "#ef4444", "#f97316", "#eab308", "#22c55e", "#0ea5e9", "#3b82f6", "#8b5cf6", "#ffffff", "#111111"];

fn de_hex(s: &str) -> Color32 {
    let n = u32::from_str_radix(s.trim_start_matches('#'), 16).unwrap_or(0);
    Color32::from_rgb((n >> 16) as u8, (n >> 8) as u8, n as u8)
}

fn janela_cor(app: &mut PhotocraftApp, ctx: &egui::Context, bar: &mut Barra, alvo: LayerId, nome: &str, rect_barra: Rect) {
    let existente = camada_cor(app, alvo);
    let mut cor = bar.cor.unwrap_or_else(|| match &existente {
        Some((_, stops, opacidade)) if stops.len() >= 2 => {
            let pega = |k: usize| stops.get(k).map(|s| Color32::from_rgb((s.1[0] * 255.0) as u8, (s.1[1] * 255.0) as u8, (s.1[2] * 255.0) as u8));
            let meio = pega(stops.len() / 2).unwrap_or(Color32::from_rgb(225, 29, 72));
            let (h, s, v) = rgb_hsv(meio);
            Cor { h, s, v, escuro: pega(0), claro: pega(stops.len() - 1), forca: *opacidade }
        }
        _ => {
            let (h, s, v) = rgb_hsv(Color32::from_rgb(225, 29, 72));
            Cor { h, s, v, escuro: None, claro: None, forca: 1.0 }
        }
    });
    let antes = cor;
    let mut fechar = false;
    let mut tirar = false;
    egui::Area::new(Id::unique("arcano_barra_cor"))
        .order(egui::Order::Foreground)
        .fixed_pos(pos2(rect_barra.left(), rect_barra.top() - 8.0))
        .pivot(egui::Align2::LEFT_BOTTOM)
        .show(ctx, |ui| {
            egui::Frame::new().fill(Color32::from_rgb(28, 26, 34)).stroke(Stroke::new(1.0, Color32::from_gray(60))).corner_radius(14.0).inner_margin(12.0).show(ui, |ui| {
                ui.set_width(200.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new("Cor da camada").strong().color(Color32::WHITE));
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui.small_button("✕").clicked() {
                            fechar = true;
                        }
                    });
                });
                ui.add_space(4.0);
                roda_grande(ui, &mut cor);
                ui.add_space(6.0);
                ui.horizontal_wrapped(|ui| {
                    ui.spacing_mut().item_spacing = vec2(5.0, 5.0);
                    for a in AMOSTRAS {
                        let c = de_hex(a);
                        let (r, resp) = ui.allocate_exact_size(vec2(15.0, 15.0), Sense::click());
                        ui.painter().circle_filled(r.center(), 7.0, c);
                        ui.painter().circle_stroke(r.center(), 7.0, Stroke::new(1.0, Color32::from_white_alpha(60)));
                        if resp.clicked() {
                            let (h, s, v) = rgb_hsv(c);
                            cor = Cor { h, s, v, escuro: None, claro: None, ..cor };
                        }
                    }
                });
                ui.add_space(6.0);
                ui.label(RichText::new("SOMBRA · MEIO · LUZ").size(10.0).color(Color32::from_gray(150)));
                let (e, m, c) = tons(&cor);
                ui.horizontal(|ui| {
                    let mut esc = e;
                    if crate::widgets::color_edit_button_srgba(ui, &mut esc, "Sombras").changed() {
                        cor.escuro = Some(esc);
                    }
                    let mut me = m;
                    if crate::widgets::color_edit_button_srgba(ui, &mut me, "Meio").changed() {
                        let (h, s, v) = rgb_hsv(me);
                        cor.h = h;
                        cor.s = s;
                        cor.v = v;
                    }
                    let mut cl = c;
                    if crate::widgets::color_edit_button_srgba(ui, &mut cl, "Luzes").changed() {
                        cor.claro = Some(cl);
                    }
                });
                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new("Intensidade").size(11.0).color(Color32::from_gray(190)));
                    let mut pct = cor.forca * 100.0;
                    if ui.add(egui::Slider::new(&mut pct, 0.0..=100.0).suffix("%").show_value(true)).changed() {
                        cor.forca = (pct / 100.0).clamp(0.0, 1.0);
                    }
                });
                ui.add_space(6.0);
                let pode_tirar = existente.is_some();
                if ui.add_enabled(pode_tirar, egui::Button::new("Tirar a cor (voltar ao original)").min_size(vec2(196.0, 24.0))).clicked() {
                    tirar = true;
                }
            });
        });
    let agora = agora(ctx);
    if cor != antes {
        bar.cor_pendente = true;
    }
    bar.cor = Some(cor);
    // aplica no máximo a cada 150 ms enquanto arrasta, e sempre ao soltar
    let solto = !ctx.input(|i| i.pointer.any_down());
    if bar.cor_pendente && (solto || agora - bar.cor_aplicada_em > 0.15) {
        aplicar_cor(app, alvo, nome, &cor);
        bar.cor_pendente = false;
        bar.cor_aplicada_em = agora;
    }
    if bar.cor_pendente {
        ctx.request_repaint_after(std::time::Duration::from_millis(160));
    }
    if tirar {
        tirar_cor(app, alvo);
        bar.cor = None;
        bar.cor_pendente = false;
    }
    if fechar || ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
        bar.cor_aberta = false;
    }
}

/// A roda: anel de matiz com o quadrado de saturação/brilho no meio (como a do Arcano Layers antigo).
fn roda_grande(ui: &mut egui::Ui, cor: &mut Cor) {
    let lado = 176.0;
    let (r, resp) = ui.allocate_exact_size(vec2(lado, lado), Sense::click_and_drag());
    let c = r.center();
    let (ext, int) = (lado / 2.0 - 2.0, lado / 2.0 - 16.0);
    let p = ui.painter();
    let n = 90;
    for i in 0..n {
        let a0 = i as f32 / n as f32 * std::f32::consts::TAU - std::f32::consts::FRAC_PI_2;
        let a1 = (i + 1) as f32 / n as f32 * std::f32::consts::TAU - std::f32::consts::FRAC_PI_2 + 0.01;
        let h = crate::widgets::hue_color(i as f32 / n as f32 * 360.0);
        p.add(egui::Shape::convex_polygon(
            vec![c + Vec2::angled(a0) * int, c + Vec2::angled(a0) * ext, c + Vec2::angled(a1) * ext, c + Vec2::angled(a1) * int],
            h,
            Stroke::NONE,
        ));
    }
    let q = (int - 8.0) * std::f32::consts::FRAC_1_SQRT_2 * 2.0;
    let quad = Rect::from_center_size(c, vec2(q, q));
    let pura = hsv_rgb(cor.h, 1.0, 1.0);
    let mut mesh = egui::Mesh::default();
    let base = mesh.vertices.len() as u32;
    for (pt, col) in [(quad.left_top(), Color32::WHITE), (quad.right_top(), pura), (quad.right_bottom(), pura), (quad.left_bottom(), Color32::WHITE)] {
        mesh.colored_vertex(pt, col);
    }
    mesh.add_triangle(base, base + 1, base + 2);
    mesh.add_triangle(base, base + 2, base + 3);
    let base = mesh.vertices.len() as u32;
    for (pt, col) in [(quad.left_top(), Color32::TRANSPARENT), (quad.right_top(), Color32::TRANSPARENT), (quad.right_bottom(), Color32::BLACK), (quad.left_bottom(), Color32::BLACK)] {
        mesh.colored_vertex(pt, col);
    }
    mesh.add_triangle(base, base + 1, base + 2);
    mesh.add_triangle(base, base + 2, base + 3);
    p.add(egui::Shape::mesh(mesh));
    // marcadores
    let ah = cor.h * std::f32::consts::TAU - std::f32::consts::FRAC_PI_2;
    p.circle_stroke(c + Vec2::angled(ah) * ((ext + int) / 2.0), 6.0, Stroke::new(2.0, Color32::WHITE));
    let ps = pos2(quad.left() + cor.s * quad.width(), quad.top() + (1.0 - cor.v) * quad.height());
    p.circle_filled(ps, 5.0, hsv_rgb(cor.h, cor.s, cor.v));
    p.circle_stroke(ps, 6.0, Stroke::new(2.0, Color32::WHITE));
    // mexer: no anel muda a matiz; no quadrado, saturação e brilho
    let modo_id = Id::unique("arcano_roda_modo");
    if resp.drag_started() || resp.clicked() {
        if let Some(pp) = resp.interact_pointer_pos() {
            let d = (pp - c).length();
            let modo: u8 = if quad.contains(pp) { 2 } else if d >= int - 4.0 && d <= ext + 4.0 { 1 } else { 0 };
            ui.ctx().data_mut(|dd| dd.insert_temp(modo_id, modo));
        }
    }
    let modo: u8 = ui.ctx().data(|dd| dd.get_temp(modo_id)).unwrap_or(0);
    if (resp.dragged() || resp.clicked())
        && let Some(pp) = resp.interact_pointer_pos()
    {
        match modo {
            1 => {
                let v = pp - c;
                cor.h = ((v.y.atan2(v.x) + std::f32::consts::FRAC_PI_2) / std::f32::consts::TAU).rem_euclid(1.0);
                cor.escuro = None;
                cor.claro = None;
            }
            2 => {
                cor.s = ((pp.x - quad.left()) / quad.width()).clamp(0.0, 1.0);
                cor.v = (1.0 - (pp.y - quad.top()) / quad.height()).clamp(0.0, 1.0);
                cor.escuro = None;
                cor.claro = None;
            }
            _ => {}
        }
    }
}
