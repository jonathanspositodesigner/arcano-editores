//! Arcano (09/11/2026): a imagem achatada de verdade de um documento do Photoshop.
//!
//! O Photoshop só grava a imagem mesclada ("composta") quando "Maximizar compatibilidade" está
//! ligado. Desligado, a mesclada vem BRANCA e o recurso 1057 (VersionInfo) diz `hasRealMergedData = 0`.
//! Acontece muito com o arquivo DENTRO de um objeto inteligente (.psb): o editor usava essa mesclada e o
//! objeto inteligente aparecia como um retângulo branco (cantor, pincéis e estrelas do flyer do MC Gabzin).
//! Aqui, sem mesclada de verdade (ou com uma mesclada de cor única num documento com camadas), as camadas
//! são compostas: os pixels que o Photoshop grava de cada camada (texto, objeto inteligente aninhado e
//! preenchimento já vêm renderizados), máscara, visibilidade, opacidade e preenchimento, grupos, recorte
//! (clipping) e os modos de mesclagem. Fica de fora o que o Photoshop não grava em pixels: estilos de
//! camada (sombra, traçado...) e camadas de ajuste.

use super::limits::Result;
use super::model::{Node, Pixels};
use super::Psd;

/// Maior documento que se compõe por camadas (16 bytes por pixel em cada buffer).
const MAX_PIXELS: u64 = 64 * 1024 * 1024;

impl Psd {
    /// A imagem do documento como o Photoshop mostra: a mesclada gravada quando ela é de verdade,
    /// senão as camadas compostas.
    pub fn achatada(&self) -> Result<Pixels> {
        let tem_camadas = self.layers.iter().any(|l| !l.is_group() && !l.hidden && (l.has_pixels() || l.fill.is_some()));
        let cabe = u64::from(self.width) * u64::from(self.height) <= MAX_PIXELS;
        if !tem_camadas || !cabe {
            return self.composite();
        }
        if self.arcano_mesclada_real != Some(false) {
            let m = self.composite()?;
            if !cor_unica(&m) {
                return Ok(m);
            }
        }
        match self.compor_camadas() {
            Some(p) => Ok(p),
            None => self.composite(),
        }
    }

    fn compor_camadas(&self) -> Option<Pixels> {
        let n = self.width as usize * self.height as usize;
        let mut out = vec![[0.0f32; 4]; n];
        self.compor_nos(&self.tree(), &mut out, 0);
        if out.iter().all(|p| p[3] <= 0.0) {
            return None;
        }
        Some(Pixels { width: self.width, height: self.height, data: out })
    }

    /// `nos`: topo da pilha primeiro (como [`Psd::tree`]); compõe de baixo para cima.
    fn compor_nos(&self, nos: &[Node], dest: &mut [[f32; 4]], nivel: usize) {
        let n = dest.len();
        // alfa da camada base do recorte (clipping) em andamento
        let mut base: Option<Vec<f32>> = None;
        for no in nos.iter().rev() {
            let (i, filhos) = match no {
                Node::Layer(i) => (*i, None),
                Node::Group { layer, children } => (*layer, Some(children)),
            };
            let Some(l) = self.layers.get(i) else { continue };
            let src: Option<Vec<[f32; 4]>> = if l.hidden || l.adjustment.is_some() {
                None
            } else if let Some(filhos) = filhos {
                if nivel >= 32 {
                    None
                } else {
                    let mut g = vec![[0.0f32; 4]; n];
                    self.compor_nos(filhos, &mut g, nivel + 1);
                    Some(g)
                }
            } else if l.has_pixels() || l.fill.is_some() {
                self.layer_pixels(i, true).ok().filter(|p| p.data.len() == n).map(|p| p.data)
            } else {
                None
            };
            if !l.clipping {
                base = None;
            }
            let Some(mut src) = src else {
                if !l.clipping {
                    // camada que não aparece não recorta nada por cima
                    base = Some(vec![0.0; n]);
                }
                continue;
            };
            if l.clipping {
                if let Some(b) = &base {
                    for (p, a) in src.iter_mut().zip(b) {
                        p[3] *= a;
                    }
                }
            } else {
                base = Some(src.iter().map(|p| p[3]).collect());
            }
            let mut opac = l.opacity as f32 / 255.0;
            if filhos.is_none() {
                opac *= l.fill_opacity as f32 / 255.0;
            }
            let modo = if filhos.is_some() && l.blend_key() == "pass" { "norm" } else { l.blend_key() };
            for (d, s) in dest.iter_mut().zip(&src) {
                let a = s[3].clamp(0.0, 1.0) * opac;
                if a > 0.0 {
                    *d = misturar(*d, [s[0], s[1], s[2]], a, modo);
                }
            }
        }
    }
}

fn cor_unica(m: &Pixels) -> bool {
    let Some(p0) = m.data.first() else { return true };
    m.data.iter().all(|p| (0..4).all(|c| (p[c] - p0[c]).abs() < 1.0 / 512.0))
}

fn lum(c: [f32; 3]) -> f32 {
    0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
}

fn um(b: f32, s: f32, modo: &str) -> f32 {
    match modo {
        "mul " => b * s,
        "scrn" => b + s - b * s,
        "over" => um(s, b, "hLit"),
        "hLit" => if s <= 0.5 { b * 2.0 * s } else { let t = 2.0 * s - 1.0; b + t - b * t },
        "sLit" => {
            if s <= 0.5 {
                b - (1.0 - 2.0 * s) * b * (1.0 - b)
            } else {
                let d = if b <= 0.25 { ((16.0 * b - 12.0) * b + 4.0) * b } else { b.sqrt() };
                b + (2.0 * s - 1.0) * (d - b)
            }
        }
        "dark" => b.min(s),
        "lite" => b.max(s),
        "diff" => (b - s).abs(),
        "smud" => b + s - 2.0 * b * s,
        "lbrn" => (b + s - 1.0).max(0.0),
        "lddg" => (b + s).min(1.0),
        "div " => if b <= 0.0 { 0.0 } else if s >= 1.0 { 1.0 } else { (b / (1.0 - s)).min(1.0) },
        "idiv" => if b >= 1.0 { 1.0 } else if s <= 0.0 { 0.0 } else { 1.0 - ((1.0 - b) / s).min(1.0) },
        "vLit" => if s <= 0.5 { um(b, 2.0 * s, "idiv") } else { um(b, 2.0 * s - 1.0, "div ") },
        "lLit" => (b + 2.0 * s - 1.0).clamp(0.0, 1.0),
        "pLit" => if s <= 0.5 { b.min(2.0 * s) } else { b.max(2.0 * s - 1.0) },
        "hMix" => if b + s >= 1.0 { 1.0 } else { 0.0 },
        "fsub" => (b - s).max(0.0),
        "fdiv" => if s <= 0.0 { 1.0 } else { (b / s).min(1.0) },
        _ => s,
    }
}

/// `s` (cor, alfa `a`) sobre `d` (alfa reto) com o modo de mesclagem `modo` (chave do Photoshop).
fn misturar(d: [f32; 4], s: [f32; 3], a: f32, modo: &str) -> [f32; 4] {
    let ab = d[3].clamp(0.0, 1.0);
    let cb = [d[0], d[1], d[2]];
    let mix: [f32; 3] = match modo {
        "dkCl" => if lum(s) < lum(cb) { s } else { cb },
        "lgCl" => if lum(s) > lum(cb) { s } else { cb },
        _ => [um(cb[0], s[0], modo), um(cb[1], s[1], modo), um(cb[2], s[2], modo)],
    };
    let ao = a + ab * (1.0 - a);
    if ao <= 0.0 {
        return [0.0; 4];
    }
    let mut o = [0.0f32; 4];
    for c in 0..3 {
        let co = a * (1.0 - ab) * s[c] + a * ab * mix[c] + (1.0 - a) * ab * cb[c];
        o[c] = co / ao;
    }
    o[3] = ao;
    o
}

/// Recurso 1057 (VersionInfo) da seção de recursos `data[ini..fim]`: `Some(false)` quando o arquivo diz
/// que a mesclada NÃO é de verdade ("Maximizar compatibilidade" desligado). `None` sem o recurso.
pub(crate) fn mesclada_real(data: &[u8], ini: usize, fim: usize) -> Option<bool> {
    let fim = fim.min(data.len());
    let mut p = ini;
    while p + 12 <= fim {
        if &data[p..p + 4] != b"8BIM" {
            return None;
        }
        let id = u16::from_be_bytes([data[p + 4], data[p + 5]]);
        let nome = data[p + 6] as usize;
        let mut q = p + 6 + 1 + nome;
        if (1 + nome) % 2 == 1 {
            q += 1;
        }
        if q + 4 > fim {
            return None;
        }
        let tam = u32::from_be_bytes([data[q], data[q + 1], data[q + 2], data[q + 3]]) as usize;
        let corpo = q + 4;
        if id == 1057 {
            return data.get(corpo + 4).map(|b| *b != 0);
        }
        p = corpo.checked_add(tam + (tam & 1))?;
    }
    None
}
