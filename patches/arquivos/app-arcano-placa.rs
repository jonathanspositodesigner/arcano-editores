//! Arcano (09/11/2026, programa mais leve): placa de vídeo para ABRIR e GRAVAR vídeo no PC.
//!
//! - Abrir: os decodificadores H.264/HEVC do sistema (Media Foundation/DXVA no Windows com qualquer
//!   placa, VideoToolbox no Mac) na frente dos do processador, pelo `filmcraft-platform` (o mesmo
//!   FilmCraft que o editor já usa, mesma revisão; é o que o EffectCraft faz no PR #819). O que a
//!   placa não abre, ou que falha no meio, volta sozinho para o processador.
//! - Gravar (só Windows com NVIDIA): o render H.264 pelo NVENC; sem NVIDIA, ou se a placa recusar,
//!   vai pelo encoder de sempre.
//! - Editar ▸ "Usar a placa de vídeo..." desliga os dois (vale para o que abrir daqui pra frente).

/// Liga tudo (uma vez, ao abrir o programa). Registrar os decodificadores sonda os drivers
/// (0,3–0,6 s): fica numa thread separada para não segurar a janela.
pub fn ligar() {
    let feito = std::thread::Builder::new().name("arcano-placa".into()).spawn(|| {
        let t0 = std::time::Instant::now();
        let disponivel = filmcraft_platform::register();
        log::info!("[placa] abrir vídeo pela placa: {disponivel:?} ({:.0} ms)", t0.elapsed().as_secs_f64() * 1e3);
    });
    if let Err(e) = feito {
        log::warn!("[placa] não deu para ligar a placa para abrir vídeo: {e}");
    }
    effectcraft_render::arcano_placa::ao_mudar(|on| filmcraft_codecs::hw::set_hardware_decoding(on));
    #[cfg(windows)]
    effectcraft_export::arcano_placa::registrar(nvenc::abrir);
}

#[cfg(windows)]
mod nvenc {
    use effectcraft_export::arcano_placa::{H264Placa, Pacote};
    use filmcraft_isobmff::{AvcConfig, SampleEntry};
    use filmcraft_platform::nvenc::{Config, Nvenc, Packet, Profile};

    struct NaPlaca {
        enc: Nvenc,
        w: u32,
        h: u32,
        den: i64,
    }

    pub fn abrir(w: u32, h: u32, num: i64, den: i64, kbps: u32) -> Option<Box<dyn H264Placa>> {
        let (Ok(n), Ok(d)) = (u32::try_from(num), u32::try_from(den)) else { return None };
        if n == 0 || d == 0 || w == 0 || h == 0 || w > u32::from(u16::MAX) || h > u32::from(u16::MAX) {
            return None;
        }
        let kbps = kbps.max(100);
        let cfg = Config {
            width: w,
            height: h,
            fps: (n, d),
            bitrate_kbps: kbps,
            max_bitrate_kbps: kbps.saturating_add(kbps / 2),
            cbr: false,
            keyint: (f64::from(n) / f64::from(d) * 2.0).round().max(1.0) as u32,
            profile: Profile::High,
            level: None,
            sar: None,
            bframes: true,
        };
        match Nvenc::new(&cfg) {
            Ok(enc) => Some(Box::new(NaPlaca { enc, w, h, den })),
            Err(e) => {
                log::info!("[placa] gravar pela placa (NVENC) não deu: {e}");
                None
            }
        }
    }

    fn pacotes(ps: Vec<Packet>, den: i64) -> Vec<Pacote> {
        ps.into_iter()
            .map(|p| {
                let cto = p.pts.saturating_sub(p.dts).saturating_mul(den);
                Pacote { dados: p.data, chave: p.key, cto: i32::try_from(cto).unwrap_or(if cto < 0 { i32::MIN } else { i32::MAX }) }
            })
            .collect()
    }

    impl H264Placa for NaPlaca {
        fn sample_entry(&self) -> SampleEntry {
            let (sps, pps) = self.enc.parameter_sets();
            SampleEntry::avc(AvcConfig::new(vec![sps.to_vec()], vec![pps.to_vec()], 4), self.w as u16, self.h as u16)
        }
        fn codificar(&mut self, y: &[u8], u: &[u8], v: &[u8], index: u64) -> Result<Vec<Pacote>, String> {
            let den = self.den;
            self.enc.encode(y, u, v, index).map(|ps| pacotes(ps, den))
        }
        fn terminar(&mut self) -> Result<Vec<Pacote>, String> {
            let den = self.den;
            self.enc.flush().map(|ps| pacotes(ps, den))
        }
        fn inicio(&self) -> Option<i64> {
            (self.enc.delay() > 0).then(|| i64::from(self.enc.delay()).saturating_mul(self.den))
        }
    }
}
