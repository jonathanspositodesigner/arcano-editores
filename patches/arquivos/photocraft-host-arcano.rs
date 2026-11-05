//! Arcano Layers Imagem (programa de PC): o editor com o painel do Arcano Design numa coluna à
//! direita, dentro da janela (como o painel do plugin no Photoshop), e a trava de login.

use photocraft_ui_egui::PhotocraftApp;

pub struct Host {
    app: PhotocraftApp,
    painel: crate::painel_arcano::Painel,
}

impl Host {
    pub fn new(app: PhotocraftApp) -> Self {
        Self { app, painel: crate::painel_arcano::Painel::new("imagem") }
    }
}

impl eframe::App for Host {
    fn on_exit(&mut self) {
        eframe::App::on_exit(&mut self.app);
    }

    fn logic(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {
        eframe::App::logic(&mut self.app, ctx, frame);
    }

    fn raw_input_hook(&mut self, ctx: &egui::Context, raw_input: &mut egui::RawInput) {
        eframe::App::raw_input_hook(&mut self.app, ctx, raw_input);
    }

    fn ui(&mut self, ui: &mut egui::Ui, frame: &mut eframe::Frame) {
        let fundo = egui::Frame::NONE.fill(egui::Color32::from_rgb(20, 20, 22));
        let lugar = egui::Panel::right("arcano_painel")
            .resizable(true)
            .default_size(420.0)
            .size_range(320.0..=760.0)
            .frame(fundo)
            .show(ui, |ui| {
                let r = ui.max_rect();
                ui.painter().text(r.center(), egui::Align2::CENTER_CENTER, "Abrindo o Arcano Design…", egui::FontId::proportional(13.0), egui::Color32::from_gray(150));
                ui.allocate_rect(r, egui::Sense::hover());
                r
            })
            .inner;
        eframe::App::ui(&mut self.app, ui, frame);
        self.painel.quadro(ui.ctx(), frame, Some(lugar));
        self.painel.trava(ui.ctx(), "Arcano Design");
    }
}
