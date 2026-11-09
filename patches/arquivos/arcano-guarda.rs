//! Arcano: guarda contra travamento e queda do programa de PC (08/11/2026).
//!
//! O dono perdeu o projeto 3 vezes num dia com o programa "Não respondendo", sem nada no registro
//! que dissesse onde. Isto grava o que for preciso para achar a causa na próxima vez:
//! - **travou:** uma linha de vigia confere a cada segundo se a janela do programa parou de
//!   responder (a mesma conta do Windows que mostra "Não respondendo", `IsHungAppWindow`). Parada
//!   por 8 s: escreve no registro `[TRAVOU]` com a memória do PC e do programa e grava um retrato
//!   do programa (`travou-<data>.dmp` na pasta Logs) com a pilha de todas as linhas de execução:
//!   com o .pdb do build dá para ver a função exata onde ficou parado. Voltou: escreve quanto durou.
//! - **caiu:** erro fatal do Windows (acesso inválido, estouro de pilha, driver) grava
//!   `caiu-<data>.dmp` antes de fechar e escreve `[CAIU]` no registro.
//! - `memoria()`: memória livre do PC e usada pelo programa (para o registro do render).
//!
//! Crate próprio porque o workspace proíbe `unsafe` e essas chamadas do Windows precisam.
//! Fora do Windows não faz nada.

use std::path::PathBuf;

/// (MB livres do PC, MB totais do PC, MB usados pelo programa), quando o sistema diz.
#[cfg(windows)]
pub fn memoria() -> Option<(u64, u64, u64)> {
    use windows::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    use windows::Win32::System::Threading::GetCurrentProcess;
    let mut m = MEMORYSTATUSEX { dwLength: size_of::<MEMORYSTATUSEX>() as u32, ..Default::default() };
    // SAFETY: estrutura do tamanho que a API pede, preenchida por ela.
    unsafe { GlobalMemoryStatusEx(&mut m) }.ok()?;
    let mut p = PROCESS_MEMORY_COUNTERS { cb: size_of::<PROCESS_MEMORY_COUNTERS>() as u32, ..Default::default() };
    // SAFETY: idem; o processo é o próprio.
    let usado = unsafe { GetProcessMemoryInfo(GetCurrentProcess(), &mut p, p.cb) }.ok().map_or(0, |_| p.WorkingSetSize as u64);
    Some((m.ullAvailPhys >> 20, m.ullTotalPhys >> 20, usado >> 20))
}

#[cfg(not(windows))]
pub fn memoria() -> Option<(u64, u64, u64)> {
    None
}

/// Texto curto da memória para o registro.
pub fn memoria_texto() -> String {
    match memoria() {
        Some((livre, total, usado)) => format!("memória do PC: {livre} MB livres de {total} MB; programa usando {usado} MB"),
        None => "memória: não disponível".into(),
    }
}

#[cfg(windows)]
static PASTA: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();

/// Liga a vigia e o retrato de queda. `pasta`: a pasta Logs (os .dmp ficam junto do registro).
#[cfg(windows)]
pub fn ligar(pasta: PathBuf) {
    use windows::Win32::System::Diagnostics::Debug::SetUnhandledExceptionFilter;
    let _ = std::fs::create_dir_all(&pasta);
    let _ = PASTA.set(pasta.clone());
    // SAFETY: registra uma função `extern "system"` com a assinatura que a API pede.
    unsafe { SetUnhandledExceptionFilter(Some(caiu)) };
    let _ = std::thread::Builder::new().name("arcano-vigia".into()).spawn(move || vigia(pasta));
    log::info!("vigia de travamento ligada ({})", memoria_texto());
}

#[cfg(not(windows))]
pub fn ligar(_pasta: PathBuf) {}

#[cfg(windows)]
fn carimbo() -> String {
    let s = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_secs());
    // dia e hora em UTC, sem depender de fuso
    let (d, h) = (s / 86400, s % 86400);
    let (y, m, dia) = civil(d as i64);
    format!("{y:04}{m:02}{dia:02}-{:02}{:02}{:02}", h / 3600, h % 3600 / 60, h % 60)
}

#[cfg(windows)]
fn civil(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (yoe + era * 400 + i64::from(m <= 2), m, d)
}

/// Grava o retrato do processo. `excecao`: o erro fatal (queda) ou nada (travamento).
#[cfg(windows)]
fn retrato(nome: &str, excecao: Option<(*const windows::Win32::System::Diagnostics::Debug::EXCEPTION_POINTERS, u32)>) -> Option<PathBuf> {
    use std::os::windows::io::AsRawHandle;
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::Diagnostics::Debug::{MINIDUMP_EXCEPTION_INFORMATION, MINIDUMP_TYPE, MiniDumpWriteDump};
    use windows::Win32::System::Threading::{GetCurrentProcess, GetCurrentProcessId};
    let pasta = PASTA.get()?;
    limpar_antigos(pasta);
    let caminho = pasta.join(format!("{nome}-{}.dmp", carimbo()));
    let f = std::fs::File::create(&caminho).ok()?;
    // pilhas de todas as linhas, dados das linhas, módulos e a memória que as pilhas apontam
    // (Normal | HandleData | UnloadedModules | IndirectlyReferencedMemory | FullMemoryInfo | ThreadInfo)
    let tipo = MINIDUMP_TYPE(0x4 | 0x20 | 0x40 | 0x800 | 0x1000);
    let info = excecao.map(|(p, linha)| MINIDUMP_EXCEPTION_INFORMATION { ThreadId: linha, ExceptionPointers: p as *mut _, ClientPointers: false.into() });
    // SAFETY: arquivo aberto e vivo até o fim da chamada; a exceção (se houver) é a que o Windows entregou.
    let ok = unsafe {
        MiniDumpWriteDump(GetCurrentProcess(), GetCurrentProcessId(), HANDLE(f.as_raw_handle()), tipo, info.as_ref().map(|i| i as *const _), None, None)
    }
    .is_ok();
    drop(f);
    if ok {
        Some(caminho)
    } else {
        let _ = std::fs::remove_file(&caminho);
        None
    }
}

/// Deixa só os 6 retratos mais novos (cada um pode ter dezenas de MB).
#[cfg(windows)]
fn limpar_antigos(pasta: &std::path::Path) {
    let Ok(rd) = std::fs::read_dir(pasta) else { return };
    let mut v: Vec<(std::time::SystemTime, PathBuf)> = rd
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x.eq_ignore_ascii_case("dmp")))
        .filter_map(|p| Some((std::fs::metadata(&p).ok()?.modified().ok()?, p)))
        .collect();
    v.sort_by_key(|e| std::cmp::Reverse(e.0));
    for (_, p) in v.into_iter().skip(5) {
        let _ = std::fs::remove_file(p);
    }
}

#[cfg(windows)]
unsafe extern "system" fn caiu(p: *const windows::Win32::System::Diagnostics::Debug::EXCEPTION_POINTERS) -> i32 {
    use windows::Win32::System::Threading::GetCurrentThreadId;
    // SAFETY: o Windows entrega um ponteiro válido durante o filtro.
    let codigo = unsafe { p.as_ref().and_then(|e| e.ExceptionRecord.as_ref()).map_or(0, |r| r.ExceptionCode.0 as u32) };
    // SAFETY: id da linha que caiu (é esta).
    let linha = unsafe { GetCurrentThreadId() };
    // retrato primeiro (o registro pode estar travado pela própria linha que caiu)
    let feito = retrato("caiu", Some((p, linha)));
    log::error!("[CAIU] erro fatal do Windows 0x{codigo:08X} ({})", memoria_texto());
    log::error!("[CAIU] retrato: {}", feito.map_or_else(|| "não deu para gravar".into(), |c| c.display().to_string()));
    log::logger().flush();
    0 // EXCEPTION_CONTINUE_SEARCH: o Windows segue e fecha como antes
}

/// As janelas visíveis deste processo.
#[cfg(windows)]
fn janelas() -> Vec<windows::Win32::Foundation::HWND> {
    use windows::Win32::Foundation::{HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowThreadProcessId, IsWindowVisible};
    unsafe extern "system" fn uma(h: HWND, l: LPARAM) -> windows::core::BOOL {
        let mut pid = 0u32;
        // SAFETY: `l` é o ponteiro para o Vec abaixo, vivo durante o EnumWindows.
        unsafe {
            GetWindowThreadProcessId(h, Some(&mut pid));
            if pid == std::process::id() && IsWindowVisible(h).as_bool() {
                (*(l.0 as *mut Vec<HWND>)).push(h);
            }
        }
        true.into()
    }
    let mut v: Vec<HWND> = Vec::new();
    // SAFETY: a função de volta só usa o Vec, que vive até o fim da chamada.
    let _ = unsafe { EnumWindows(Some(uma), LPARAM(&mut v as *mut Vec<HWND> as isize)) };
    v
}

#[cfg(windows)]
fn vigia(_pasta: PathBuf) {
    use windows::Win32::UI::WindowsAndMessaging::IsHungAppWindow;
    const LIMITE: u64 = 8; // segundos parado até gravar
    let mut parado = 0u64;
    let mut gravou = false;
    loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        let js = janelas();
        // SAFETY: janelas deste processo, conferidas agora.
        let travada = !js.is_empty() && js.iter().any(|h| unsafe { IsHungAppWindow(*h) }.as_bool());
        if travada {
            parado += 1;
            if parado == LIMITE && !gravou {
                gravou = true;
                log::error!("[TRAVOU] a janela parou de responder há {LIMITE} s ({})", memoria_texto());
                let r = retrato("travou", None);
                log::error!("[TRAVOU] retrato: {}", r.map_or_else(|| "não deu para gravar".into(), |c| c.display().to_string()));
                log::logger().flush();
            } else if parado % 30 == 0 && parado > LIMITE {
                log::error!("[TRAVOU] ainda parado: {parado} s ({})", memoria_texto());
                log::logger().flush();
            }
        } else {
            if parado >= LIMITE {
                log::warn!("[TRAVOU] voltou a responder depois de ~{} s", parado + 5);
                log::logger().flush();
            }
            parado = 0;
            gravou = false;
        }
    }
}
