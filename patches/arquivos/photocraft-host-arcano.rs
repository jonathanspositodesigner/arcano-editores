//! Arcano Layers Imagem (programa de PC): o editor com o painel do Arcano Design numa coluna à
//! direita, dentro da janela (como o painel do plugin no Photoshop), e a trava de login.

use photocraft_ui_egui::PhotocraftApp;

pub struct Host {
    app: PhotocraftApp,
    painel: crate::painel_arcano::Painel,
    /// As ferramentas do plugin (aba Ferramentas) num painel em cima do painel completo (pedido do dono).
    ferramentas: crate::painel_arcano::Painel,
    /// Quanto da coluna fica com as ferramentas (0,2 a 0,75; arrasta a divisória).
    divisao: f32,
    atualizador: crate::atualizador_arcano::Atualizador,
}

impl Host {
    pub fn new(app: PhotocraftApp) -> Self {
        let mut painel = crate::painel_arcano::Painel::new("imagem");
        // a barra rápida e a conta do editor conversam com o painel do Arcano Design
        painel.ao_receber(photocraft_ui_egui::arcano::receber);
        Self { app, painel, ferramentas: crate::painel_arcano::Painel::ferramentas("imagem"), divisao: 0.42, atualizador: crate::atualizador_arcano::Atualizador::new("imagem") }
    }
}

impl eframe::App for Host {
    fn on_exit(&mut self) {
        eframe::App::on_exit(&mut self.app);
        self.ferramentas.sair();
        self.painel.sair();
    }

    fn logic(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {
        eframe::App::logic(&mut self.app, ctx, frame);
    }

    fn raw_input_hook(&mut self, ctx: &egui::Context, raw_input: &mut egui::RawInput) {
        eframe::App::raw_input_hook(&mut self.app, ctx, raw_input);
    }

    fn ui(&mut self, ui: &mut egui::Ui, frame: &mut eframe::Frame) {
        let fundo = egui::Frame::NONE.fill(egui::Color32::from_rgb(20, 20, 22));
        let mut divisao = self.divisao;
        let (cima, lugar) = egui::Panel::right("arcano_painel")
            .resizable(true)
            .default_size(420.0)
            .size_range(320.0..=760.0)
            .frame(fundo)
            .show(ui, |ui| {
                let r = ui.max_rect();
                // em cima as ferramentas, embaixo o painel completo; a divisória (6 px) arrasta
                let y = r.min.y + r.height() * divisao;
                let cima = egui::Rect::from_min_max(r.min, egui::pos2(r.max.x, y - 3.0));
                let baixo = egui::Rect::from_min_max(egui::pos2(r.min.x, y + 3.0), r.max);
                let barra = egui::Rect::from_min_max(egui::pos2(r.min.x, y - 3.0), egui::pos2(r.max.x, y + 3.0));
                let p = ui.painter();
                p.text(cima.center(), egui::Align2::CENTER_CENTER, "Abrindo as ferramentas…", egui::FontId::proportional(13.0), egui::Color32::from_gray(150));
                p.text(baixo.center(), egui::Align2::CENTER_CENTER, "Abrindo o Arcano Design…", egui::FontId::proportional(13.0), egui::Color32::from_gray(150));
                let arrasto = ui.interact(barra, egui::Id::unique("arcano_divisao"), egui::Sense::drag()).on_hover_cursor(egui::CursorIcon::ResizeVertical);
                p.rect_filled(barra, 0.0, if arrasto.hovered() || arrasto.dragged() { egui::Color32::from_rgb(168, 85, 247) } else { egui::Color32::from_rgb(40, 38, 46) });
                if arrasto.dragged() && r.height() > 1.0 {
                    divisao = ((y + arrasto.drag_delta().y - r.min.y) / r.height()).clamp(0.2, 0.75);
                }
                ui.allocate_rect(r, egui::Sense::hover());
                (cima, baixo)
            })
            .inner;
        self.divisao = divisao;
        eframe::App::ui(&mut self.app, ui, frame);
        for p in photocraft_ui_egui::arcano::pedidos() {
            self.painel.mandar(&p.to_string());
        }
        // sem a conta, o painel completo ocupa a coluna toda (para entrar); as ferramentas esperam
        let lugar_todo = lugar.union(cima);
        let logado = self.painel.logado();
        self.ferramentas.quadro(ui.ctx(), frame, Some(cima));
        self.painel.quadro(ui.ctx(), frame, Some(if logado { lugar } else { lugar_todo }));
        self.painel.trava(ui.ctx(), "Arcano Design");
        self.atualizador.quadro(ui.ctx(), "Arcano Layers Imagem", photocraft_ui_egui::ARCANO_CONFERIR_ATUALIZACAO.swap(false, std::sync::atomic::Ordering::Relaxed));
    }
}
