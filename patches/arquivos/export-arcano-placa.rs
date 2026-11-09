//! Arcano (09/11/2026, programa mais leve): H.264 gravado pela PLACA DE VÍDEO no render.
//!
//! O encoder da placa não mora aqui (este crate não tem código de sistema e compila para o
//! navegador): o programa de PC registra uma fábrica ([`registrar`]) que abre o NVENC da NVIDIA
//! pelo `filmcraft-platform` (o mesmo FilmCraft que o editor já usa, mesma revisão). Sem fábrica
//! (navegador, Mac, placa que não é NVIDIA), sem a opção ligada, ou se a placa recusar o tamanho,
//! o render usa o encoder H.264 de sempre, pelo processador. Os quadros chegam em 4:2:0 BT.709
//! (os mesmos que o encoder do processador recebe, convertidos pela GPU do render).

use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};

use filmcraft_isobmff::SampleEntry;

/// Um pacote H.264: dados (NALs com tamanho de 4 bytes), quadro-chave, pts − dts na escala do
/// arquivo (`rate.num`, um quadro = `rate.den`).
pub struct Pacote {
    pub dados: Vec<u8>,
    pub chave: bool,
    pub cto: i32,
}

/// Um encoder H.264 da placa de vídeo.
pub trait H264Placa: Send {
    /// A entrada `avc1` do MP4 (vale depois do 1º quadro).
    fn sample_entry(&self) -> SampleEntry;
    /// Codifica o quadro `index` (Y com linhas de `w` bytes; U e V com `w / 2`).
    fn codificar(&mut self, y: &[u8], u: &[u8], v: &[u8], index: u64) -> Result<Vec<Pacote>, String>;
    fn terminar(&mut self) -> Result<Vec<Pacote>, String>;
    /// Início da mídia na escala do arquivo (atraso dos quadros B).
    fn inicio(&self) -> Option<i64>;
}

/// Abre o encoder da placa para `w`×`h` a `num`/`den` qps e `kbps`, ou `None` (vai pelo processador).
pub type Fabrica = fn(w: u32, h: u32, num: i64, den: i64, kbps: u32) -> Option<Box<dyn H264Placa>>;

static FABRICA: OnceLock<Fabrica> = OnceLock::new();
/// A placa falhou no meio de um render: os próximos vão pelo processador até reabrir o programa.
static FALHOU: AtomicBool = AtomicBool::new(false);

/// Programa de PC: liga o encoder da placa.
pub fn registrar(f: Fabrica) {
    let _ = FABRICA.set(f);
}

/// Se o próximo render pode tentar a placa.
pub fn disponivel() -> bool {
    FABRICA.get().is_some() && effectcraft_render::arcano_placa::ligada() && !FALHOU.load(Ordering::Relaxed)
}

pub(crate) fn abrir(w: u32, h: u32, num: i64, den: i64, kbps: u32) -> Option<Box<dyn H264Placa>> {
    if !disponivel() || w % 2 != 0 || h % 2 != 0 {
        return None;
    }
    let f = FABRICA.get()?;
    let r = f(w, h, num, den, kbps);
    if r.is_some() {
        log::info!("[render] H.264 pela placa de vídeo ({w}x{h})");
    } else {
        log::info!("[render] H.264 pelo processador ({w}x{h}): a placa não abriu o encoder");
    }
    r
}

pub(crate) fn marcar_falha(e: &str) {
    FALHOU.store(true, Ordering::Relaxed);
    log::warn!("[render] a placa de vídeo falhou ao gravar ({e}): os próximos renders vão pelo processador");
}
