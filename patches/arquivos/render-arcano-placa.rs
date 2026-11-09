//! Arcano (09/11/2026): a opção "Usar a placa de vídeo para abrir e gravar vídeo" (Editar).
//! Fica neste crate porque a interface, o render e o programa de PC enxergam ele.
//! Ligada por padrão; o programa de PC registra o que fazer quando muda ([`ao_mudar`]).

use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};

static LIGADA: AtomicBool = AtomicBool::new(true);
static AO_MUDAR: OnceLock<fn(bool)> = OnceLock::new();

/// Se o editor pode usar a placa de vídeo para abrir e gravar vídeo.
pub fn ligada() -> bool {
    LIGADA.load(Ordering::Relaxed)
}

/// Liga ou desliga (vem das preferências). Avisa o programa de PC só quando muda.
pub fn definir(on: bool) {
    let antes = LIGADA.swap(on, Ordering::Relaxed);
    if let Some(f) = AO_MUDAR.get() {
        f(on);
    }
    if antes != on {
        log::info!("[placa] usar a placa de vídeo: {}", if on { "ligado" } else { "desligado" });
    }
}

/// Programa de PC: o que fazer quando a opção muda (e já aplica a de agora).
pub fn ao_mudar(f: fn(bool)) {
    let _ = AO_MUDAR.set(f);
    f(ligada());
}
