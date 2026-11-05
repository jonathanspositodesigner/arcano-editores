//! Arcano: prévia em tempo real, como os editores de celular (CapCut) e de vídeo (Premiere,
//! DaVinci): o som e o relógio NUNCA param esperando quadro.
//!
//! - Quadro que não ficou pronto a tempo é pulado: a tela mostra o último quadro pronto até onde o
//!   relógio está (antes: o som parava e a prévia ia quadro a quadro "armazenando em cache").
//! - O que renderiza é sempre o que está logo à frente do relógio, no passo que o computador dá
//!   conta (quadro sim, quadro não…), nunca quadro que já passou.
//! - Resolução automática: com a prévia em Auto e sem dar conta, cai para metade, um terço e um
//!   quarto enquanto toca (volta ao normal quando para).
//! - Cache quando ocioso ligado: parado, o editor já vai renderizando a área de trabalho por trás.

use std::sync::Mutex;

use crate::Playback;

/// O quadro do relógio no último passo atrasado: (quadro, quando).
static ALVO: Mutex<Option<(i64, f64)>> = Mutex::new(None);
/// A prévia começou em Auto (pode baixar a resolução) e quando a resolução mudou pela última vez.
static AUTO: Mutex<(bool, f64)> = Mutex::new((false, 0.0));

/// A prévia começou: `auto` = a resolução da prévia é Auto.
pub fn comecou(auto: bool, now: f64) {
    *AUTO.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = (auto, now);
    *ALVO.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = None;
}

/// O relógio está em `f` e o quadro dele não ficou pronto.
pub fn atrasado(f: i64, now: f64) {
    *ALVO.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some((f, now));
}

/// Onde o relógio está, se ficou atrasado há pouco (meio segundo).
pub fn alvo(now: f64) -> Option<i64> {
    ALVO.lock().unwrap_or_else(std::sync::PoisonError::into_inner).filter(|(_, t)| now - *t <= 0.5).map(|(f, _)| f)
}

/// Passo entre os quadros pedidos: 1 quando a prévia dá conta, maior quando não dá.
pub fn passo(pb: &Playback) -> i64 {
    match pb.achieved_fps() {
        Some(a) if a > 0.2 && a < pb.fps * 0.85 => ((pb.fps / a).ceil() as i64).clamp(1, 8),
        _ => 1,
    }
}

/// O último quadro pronto até `alvo` (`cached` em ordem), se for outro que o da tela.
pub fn melhor_pronto(cached: &[i64], cur: i64, alvo: i64) -> Option<i64> {
    let i = match cached.binary_search(&alvo) {
        Ok(i) => i,
        Err(0) => return None,
        Err(i) => i - 1,
    };
    let f = *cached.get(i)?;
    // depois de voltar ao início (loop) o quadro da tela pode estar "à frente" do alvo
    (f != cur && (f > cur || alvo < cur)).then_some(f)
}

/// Prévia em Auto que não dá conta: baixa a resolução (metade → um terço → um quarto), no máximo
/// uma vez a cada 1,5 s.
pub fn ajustar_resolucao(pb: &mut Playback, now: f64) {
    let mut g = AUTO.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if !g.0 || now - g.1 < 1.5 {
        return;
    }
    let Some(a) = pb.achieved_fps() else { return };
    if a >= pb.fps * 0.6 {
        return;
    }
    let nova = match pb.res {
        None | Some(1) => 2,
        Some(2) => 3,
        Some(3) => 4,
        _ => return,
    };
    pb.res = Some(nova);
    pb.shown_at.clear();
    g.1 = now;
}

#[cfg(test)]
mod testes {
    use super::melhor_pronto;

    #[test]
    fn pega_o_ultimo_pronto_ate_o_relogio() {
        assert_eq!(melhor_pronto(&[1, 2, 5, 9], 2, 7), Some(5));
        assert_eq!(melhor_pronto(&[1, 2, 5, 9], 5, 7), None);
        assert_eq!(melhor_pronto(&[3, 4], 1, 2), None);
        assert_eq!(melhor_pronto(&[0, 1, 30], 30, 1), Some(1));
    }
}
