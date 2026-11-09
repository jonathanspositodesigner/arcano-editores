//! Arcano: quanta memória a placa de vídeo tem (06/11/2026).
//!
//! O wgpu não diz a memória da placa em nenhuma plataforma. No Windows, o DXGI diz: memória
//! dedicada de cada adaptador e o orçamento que o sistema dá ao processo. O editor usa isso pra
//! dimensionar o cache de camadas da GPU (`orcamento_de_camadas`): numa RTX 3050 de 6 GB cabem
//! 2 GB de camadas; o valor fixo de antes (384 MB) não segurava um PSD grande inteiro e a placa
//! recebia TODAS as camadas de novo a cada quadro (a prévia e o render ficavam lentos).

/// (nome, memória dedicada em bytes, orçamento do processo em bytes se o sistema disser) das
/// placas do PC, na ordem do sistema (a primeira costuma ser a principal).
#[cfg(windows)]
pub fn placas() -> Vec<(String, u64, Option<u64>)> {
    use windows::Win32::Graphics::Dxgi::{CreateDXGIFactory1, DXGI_MEMORY_SEGMENT_GROUP_LOCAL, DXGI_QUERY_VIDEO_MEMORY_INFO, IDXGIAdapter3, IDXGIFactory1};
    use windows::core::Interface;
    let mut v = Vec::new();
    // SAFETY: chamadas do DXGI com os tipos que a própria API pede; nada é guardado além do retorno.
    let Ok(factory) = (unsafe { CreateDXGIFactory1::<IDXGIFactory1>() }) else { return v };
    for i in 0..16 {
        let Ok(a) = (unsafe { factory.EnumAdapters1(i) }) else { break };
        let Ok(desc) = (unsafe { a.GetDesc1() }) else { continue };
        let nome = String::from_utf16_lossy(&desc.Description).trim_end_matches('\0').trim().to_string();
        let dedicada = desc.DedicatedVideoMemory as u64;
        let orcamento = a.cast::<IDXGIAdapter3>().ok().and_then(|a3| {
            let mut info = DXGI_QUERY_VIDEO_MEMORY_INFO::default();
            unsafe { a3.QueryVideoMemoryInfo(0, DXGI_MEMORY_SEGMENT_GROUP_LOCAL, &mut info) }.ok().map(|_| info.Budget)
        });
        v.push((nome, dedicada, orcamento));
    }
    v
}

#[cfg(not(windows))]
pub fn placas() -> Vec<(String, u64, Option<u64>)> {
    Vec::new()
}

/// Memória dedicada (bytes) da placa chamada `nome` (o nome que o wgpu dá ao adaptador), ou da
/// maior placa do PC quando o nome não casa. `None`: não dá pra saber (Mac, Linux, navegador).
pub fn memoria_dedicada(nome: &str) -> Option<u64> {
    let placas = placas();
    let n = nome.trim().to_lowercase();
    if let Some((_, m, _)) = placas.iter().find(|(p, ..)| !n.is_empty() && (p.to_lowercase() == n || p.to_lowercase().contains(&n) || n.contains(&p.to_lowercase()))) {
        return Some(*m);
    }
    placas.iter().map(|(_, m, _)| *m).max().filter(|m| *m > 0)
}

/// Orçamento do cache de camadas da GPU pela memória da placa: um terço dela, entre 512 MB e
/// 2 GB (placa com menos de 1 GB: 256 MB). Sem saber a memória: 768 MB no PC (metade do padrão original de 1,5 GB) e 384 MB no
/// navegador.
pub fn orcamento_base(nome_da_placa: &str) -> usize {
    if cfg!(target_arch = "wasm32") {
        return 384 << 20;
    }
    // o compositor chama a placa de "NVIDIA GeForce RTX 3050 (Vulkan)": só o nome
    let nome = nome_da_placa.rsplit_once(" (").map_or(nome_da_placa, |(a, _)| a);
    match memoria_dedicada(nome) {
        // placa integrada ou com menos de 1 GB próprio (registro de 09/11/2026: AMD Radeon com 495 MB):
        // o piso de 512 MB passava da memória da placa; 256 MB
        Some(m) if m < (1 << 30) => 256 << 20,
        Some(m) => ((m / 3) as usize).clamp(512 << 20, 2048 << 20),
        None => 768 << 20,
    }
}
