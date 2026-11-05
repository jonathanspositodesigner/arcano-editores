//! Arcano Layers: o painel do Arcano Design (o mesmo plugin do Photoshop) fala com o editor por
//! aqui, de forma SÍNCRONA (o script do Photoshop é síncrono). Fica em `window.photocraftArcano`
//! (index.html). Cada chamada roda entre dois quadros: o painel só chama em eventos dele, nunca
//! durante o desenho do editor (`EM_QUADRO` recusa se acontecer).

use std::cell::{Cell, RefCell};

use serde_json::{Value, json};
use wasm_bindgen::prelude::*;

thread_local! {
    static APP: Cell<*mut photocraft_ui_egui::PhotocraftApp> = const { Cell::new(std::ptr::null_mut()) };
    static CTX: RefCell<Option<egui::Context>> = const { RefCell::new(None) };
    static EM_QUADRO: Cell<bool> = const { Cell::new(false) };
}

/// Começo de um quadro do editor (logic/ui): guarda onde o app está e bloqueia as chamadas.
pub(crate) fn entrar(app: &mut photocraft_ui_egui::PhotocraftApp, ctx: &egui::Context) {
    APP.with(|a| a.set(app as *mut _));
    CTX.with(|c| {
        if c.borrow().is_none() {
            *c.borrow_mut() = Some(ctx.clone());
        }
    });
    EM_QUADRO.with(|q| q.set(true));
}

/// Fim do quadro: as chamadas do painel voltam a valer.
pub(crate) fn sair() {
    EM_QUADRO.with(|q| q.set(false));
}

fn com_app<T>(f: impl FnOnce(&mut photocraft_ui_egui::PhotocraftApp, &egui::Context) -> T) -> Result<T, String> {
    if EM_QUADRO.with(Cell::get) {
        return Err("o editor está desenhando; tente de novo".into());
    }
    let p = APP.with(Cell::get);
    let ctx = CTX.with(|c| c.borrow().clone());
    match (p.is_null(), ctx) {
        (false, Some(ctx)) => {
            // SAFETY: o app vive na caixa do eframe até a página fechar; JS e wasm usam uma só
            // thread, e fora de um quadro ninguém mais tem referência a ele.
            let app = unsafe { &mut *p };
            let r = f(app, &ctx);
            ctx.request_repaint();
            Ok(r)
        }
        _ => Err("o editor ainda está abrindo".into()),
    }
}

fn texto(v: Value) -> String {
    v.to_string()
}

/// Um pedido do canal de controle (`engine.execute`, `ui.inspect`…), respondido na hora:
/// `{"ok": true, "result": …}` ou `{"ok": false, "error": "…"}`.
#[wasm_bindgen(js_name = arcanoPedido)]
pub fn pedido(metodo: String, params: String) -> String {
    let params: Value = serde_json::from_str(&params).unwrap_or_else(|_| json!({}));
    let r = com_app(|app, ctx| {
        let (req, _rx) = photocraft_ui_egui::ControlRequest::new(metodo.clone(), params);
        match photocraft_ui_egui::control::handle(app, ctx, &req) {
            photocraft_ui_egui::control::Outcome::Done(v) => v,
            _ => json!({"ok": false, "error": format!("{metodo}: resposta só depois de outro quadro (use wait: false)")}),
        }
    });
    texto(r.unwrap_or_else(|e| json!({"ok": false, "error": e})))
}

/// Abre os bytes como documento novo (o File › Open com um arquivo do PC).
#[wasm_bindgen(js_name = arcanoAbrir)]
pub fn abrir(nome: String, dados: js_sys::Uint8Array) -> String {
    let bytes = dados.to_vec();
    let r = com_app(|app, _| app.open_bytes(&nome, &bytes));
    texto(match r {
        Ok(Ok(avisos)) => json!({"ok": true, "result": {"avisos": avisos}}),
        Ok(Err(e)) | Err(e) => json!({"ok": false, "error": e}),
    })
}

/// Coloca os bytes como Smart Object no documento ativo (File › Place Embedded).
#[wasm_bindgen(js_name = arcanoColocar)]
pub fn colocar(nome: String, dados: js_sys::Uint8Array) -> String {
    let bytes = dados.to_vec();
    let r = com_app(|app, _| app.place_bytes(&nome, bytes, None));
    texto(match r {
        Ok(Ok(v)) => json!({"ok": true, "result": v}),
        Ok(Err(e)) | Err(e) => json!({"ok": false, "error": e}),
    })
}

/// O documento (índice; vazio = o ativo) gravado no formato do nome (`x.png`, `x.jpg`, `x.psd`…).
/// `qualidade`: JPEG 1..=100. Devolve os bytes, ou `undefined` com o erro em `arcanoErro()`.
#[wasm_bindgen(js_name = arcanoExportar)]
pub fn exportar(documento: Option<u32>, nome: String, qualidade: Option<u8>) -> JsValue {
    let r = com_app(|app, _| {
        let s = &app.session;
        let d = match documento {
            Some(i) => s.documents().get(i as usize).ok_or_else(|| format!("sem documento {i}"))?,
            None => s.active().ok_or("nenhum documento aberto")?,
        };
        let mut o = photocraft_io::ExportOptions::default();
        if let Some(q) = qualidade {
            o.encode.jpeg_quality = q.clamp(1, 100);
        }
        photocraft_io::export(&d.doc, &nome, &o).map(|r| r.bytes).map_err(|e| e.to_string())
    });
    match r {
        Ok(Ok(b)) => js_sys::Uint8Array::from(&b[..]).into(),
        Ok(Err(e)) | Err(e) => {
            ERRO.with(|x| *x.borrow_mut() = e);
            JsValue::UNDEFINED
        }
    }
}

thread_local! {
    static ERRO: RefCell<String> = const { RefCell::new(String::new()) };
}

#[wasm_bindgen(js_name = arcanoErro)]
pub fn erro() -> String {
    ERRO.with(|x| x.borrow().clone())
}
