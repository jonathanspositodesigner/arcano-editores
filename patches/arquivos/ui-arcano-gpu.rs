//! Arcano: a GPU da prévia VOLTA sozinha depois de cair (pedido do dono, 06/11/2026).
//!
//! Antes, qualquer tropeço da placa (memória de vídeo cheia = "uncaptured GPU error: Out of
//! Memory", ou uma leitura que demorou) "aposentava" o compositor da GPU pelo resto da sessão: a
//! prévia passava a ser montada só no processador e, numa comp pesada, parecia travada ("carrega
//! um pouquinho e fica horas parado"). Agora, quando a placa continua viva (não foi perda do
//! dispositivo), o editor espera uns segundos e monta o compositor de novo na mesma placa, com
//! menos memória de vídeo a cada volta (metade), até 6 vezes por sessão.

use std::sync::Mutex;
#[cfg(not(target_arch = "wasm32"))]
use web_time::Duration;
use web_time::Instant;

#[cfg(not(target_arch = "wasm32"))]
use crate::EffectcraftApp;

#[allow(dead_code)]
struct Estado {
    /// quantas vezes a GPU já voltou nesta sessão
    voltas: u32,
    /// quando tentar de novo (depois de uma queda)
    tentar_em: Option<Instant>,
    /// a última causa, para o registro
    causa: String,
}

static ESTADO: Mutex<Estado> = Mutex::new(Estado { voltas: 0, tentar_em: None, causa: String::new() });

#[cfg(not(target_arch = "wasm32"))]
const MAXIMO_DE_VOLTAS: u32 = 6;

/// Memória de vídeo das camadas depois de `voltas` quedas: 384 MB → 192 → 96 → 64 (mínimo).
pub fn orcamento_de_camadas(voltas: u32) -> usize {
    ((384usize << 20) >> voltas.min(3)).max(64 << 20)
}

#[cfg(not(target_arch = "wasm32"))]
/// Chamado logo depois de `apply_gpu_failure`, a cada quadro. Quando o compositor caiu e a
/// placa continua viva, agenda a volta; quando chega a hora, limpa a falha e monta de novo.
pub fn quadro(app: &mut EffectcraftApp, ctx: &egui::Context, frame: &eframe::Frame) {
    let Some(bridge) = app.gpu_failures.clone() else { return };
    let Some(falha) = bridge.failure() else { return };
    if falha.presentation_lost || app.gpu_failure_applied != Some(false) || app.gpu_build.is_some() {
        return;
    }
    let agora = Instant::now();
    let mut e = ESTADO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if e.voltas >= MAXIMO_DE_VOLTAS {
        return;
    }
    let Some(quando) = e.tentar_em else {
        // 4 s, 8 s, 16 s... entre a queda e a volta (a placa precisa de um respiro)
        let espera = Duration::from_secs(4u64 << e.voltas.min(4));
        e.tentar_em = Some(agora + espera);
        e.causa = falha.reason.clone();
        log::warn!("GPU da prévia caiu ({}); volta em {} s", falha.reason, espera.as_secs());
        app.ui.status = format!("A placa de vídeo tropeçou; a prévia volta pra GPU em {} s (enquanto isso, processador).", espera.as_secs());
        ctx.request_repaint_after(espera);
        return;
    };
    if agora < quando {
        ctx.request_repaint_after(quando - agora);
        return;
    }
    let Some(rs) = frame.wgpu_render_state() else { return };
    e.tentar_em = None;
    e.voltas += 1;
    let voltas = e.voltas;
    drop(e);
    bridge.clear();
    app.gpu_failure_applied = None;
    app.gpu_checked = true;
    log::warn!("montando o compositor da GPU de novo (volta {voltas}, {} MB de camadas)", orcamento_de_camadas(voltas) >> 20);
    app.ui.status = format!("Religando a GPU da prévia (tentativa {voltas})...");
    if !app.spawn_gpu_build(ctx, rs) {
        // sem thread: monta aqui mesmo
        let built = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| effectcraft_gpu::Gpu::new(&rs.adapter, rs.device.clone(), rs.queue.clone())));
        app.attach_gpu(built, Some(rs));
    }
    ctx.request_repaint();
}

/// Depois que um compositor foi montado (a 1ª vez ou numa volta): memória conforme as quedas.
pub fn ajustar(gpu: &effectcraft_gpu::Gpu) {
    let voltas = ESTADO.lock().unwrap_or_else(std::sync::PoisonError::into_inner).voltas;
    if voltas > 0 {
        gpu.context().set_upload_budget(orcamento_de_camadas(voltas));
    }
}
