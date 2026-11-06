//! Arcano: o projeto salvo LEVA OS ARQUIVOS DENTRO, igual ao PSD (pedido do dono, 05/11/2026).
//!
//! "O After não coleta os arquivos na hora que salva... eu quero que salve igual o Photoshop:
//! salvou, abre o PSD, tá com tudo dentro." Arquivo ▸ Salvar (e Salvar como / Incrementar) grava o
//! `.ecproj` como um ZIP sem compressão (zip64) com:
//!   - `projeto.ecproj`: o projeto (JSON de sempre), com os caminhos das mídias trocados por
//!     `arcano-pacote:midia/<nome>`;
//!   - `midia/…`: cada vídeo, imagem, áudio, PSD e quadro de sequência usado;
//!   - `fontes/…`: os arquivos das fontes dos textos (as que não vêm com o editor);
//!   - `arcano/manifesto.json`: de onde veio cada mídia (caminho, tamanho e data), para não copiar
//!     de novo o que não mudou.
//! Qualquer descompactador (WinRAR, 7-Zip) abre o arquivo e mostra as mídias.
//!
//! SALVAR DE NOVO É RÁPIDO: no computador o arquivo só CRESCE no fim (as mídias que já estão
//! dentro ficam onde estão; entra só o que é novo, o projeto e um índice novo). Se o programa
//! cair no meio, o índice antigo continua lá e o projeto abre como estava no último salvamento.
//! Quando o lixo (versões antigas do projeto, mídias que saíram) passa do que está em uso, o
//! salvamento seguinte reescreve tudo limpo num arquivo temporário e troca no fim.
//!
//! ABRIR: lê o projeto de dentro; cada mídia usa o arquivo ORIGINAL se ele ainda estiver no mesmo
//! lugar e igual (mesmo tamanho e data); senão sai do projeto para `<HD de trabalho>/Projetos
//! abertos/<id>/` (uma vez só: na próxima abertura já está lá). Fontes que faltam no computador
//! entram direto do projeto. No navegador tudo vai para o armazenamento do navegador.
//!
//! Projeto antigo (JSON puro) abre igual a antes e, ao salvar, vira pacote.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::io::{Read, Seek, SeekFrom, Write};
use std::sync::{Mutex, OnceLock};

use effectcraft_project::{ItemKind, Project};
use serde_json::{Value, json};

use crate::{EngineError, Result, Session};

/// Como o projeto aponta para uma mídia que está dentro dele.
pub const PREFIXO: &str = "arcano-pacote:";
const PROJETO: &str = "projeto.ecproj";
const MANIFESTO: &str = "arcano/manifesto.json";
const FORMATO: &str = "arcano-pacote";

/// O arquivo de projeto vira pacote? (`.ecproj`; a cópia em XML continua texto.)
pub fn empacotar(caminho: &str) -> bool {
    caminho.to_ascii_lowercase().ends_with(".ecproj")
}

// ─────────────────────────────────────────────────────────────── CRC-32 (slicing-by-8)

fn tabela() -> &'static [[u32; 256]; 8] {
    static T: OnceLock<[[u32; 256]; 8]> = OnceLock::new();
    T.get_or_init(|| {
        let mut t = [[0u32; 256]; 8];
        for i in 0..256u32 {
            let mut c = i;
            for _ in 0..8 {
                c = if c & 1 != 0 { 0xEDB8_8320 ^ (c >> 1) } else { c >> 1 };
            }
            t[0][i as usize] = c;
        }
        for k in 1..8 {
            for i in 0..256 {
                let p = t[k - 1][i];
                t[k][i] = (p >> 8) ^ t[0][(p & 0xff) as usize];
            }
        }
        t
    })
}

#[derive(Clone, Copy)]
struct Crc(u32);
impl Crc {
    fn novo() -> Self {
        Crc(!0)
    }
    fn somar(&mut self, d: &[u8]) {
        let t = tabela();
        let mut c = self.0;
        let mut d = d;
        while d.len() >= 8 {
            let a = c ^ u32::from_le_bytes([d[0], d[1], d[2], d[3]]);
            let b = u32::from_le_bytes([d[4], d[5], d[6], d[7]]);
            c = t[7][(a & 0xff) as usize]
                ^ t[6][((a >> 8) & 0xff) as usize]
                ^ t[5][((a >> 16) & 0xff) as usize]
                ^ t[4][(a >> 24) as usize]
                ^ t[3][(b & 0xff) as usize]
                ^ t[2][((b >> 8) & 0xff) as usize]
                ^ t[1][((b >> 16) & 0xff) as usize]
                ^ t[0][(b >> 24) as usize];
            d = &d[8..];
        }
        for &x in d {
            c = t[0][((c ^ u32::from(x)) & 0xff) as usize] ^ (c >> 8);
        }
        self.0 = c;
    }
    fn fim(self) -> u32 {
        !self.0
    }
}

// ─────────────────────────────────────────────────────────────── ZIP (sem compressão, zip64)

/// Uma entrada do pacote: onde começa o cabeçalho local, o tamanho e o CRC dos dados.
#[derive(Clone, Debug)]
pub struct Entrada {
    pub nome: String,
    pub crc: u32,
    pub tamanho: u64,
    pub cabecalho: u64,
}

/// 01/01/2026 00:00 no formato do MS-DOS (a hora de verdade não importa para o projeto).
const DATA_DOS: u16 = ((2026 - 1980) << 9) | (1 << 5) | 1;
const LER: usize = 4 << 20;

fn u16le(v: u16) -> [u8; 2] {
    v.to_le_bytes()
}
fn u32le(v: u32) -> [u8; 4] {
    v.to_le_bytes()
}
fn u64le(v: u64) -> [u8; 8] {
    v.to_le_bytes()
}

/// Grava uma entrada lendo `fonte` até o fim (ou até `limite` bytes). O CRC e o tamanho são
/// conferidos enquanto copia e escritos de volta no cabeçalho.
fn gravar_entrada<D: Write + Seek + ?Sized, F: Read + ?Sized>(d: &mut D, nome: &str, fonte: &mut F, limite: Option<u64>, crc_sabido: Option<u32>) -> std::io::Result<Entrada> {
    let ini = d.stream_position()?;
    let n = nome.as_bytes();
    let mut h = Vec::with_capacity(30 + n.len() + 20);
    h.extend_from_slice(&u32le(0x0403_4b50));
    h.extend_from_slice(&u16le(45));
    h.extend_from_slice(&u16le(0x0800)); // nome em UTF-8
    h.extend_from_slice(&u16le(0)); // sem compressão
    h.extend_from_slice(&u16le(0));
    h.extend_from_slice(&u16le(DATA_DOS));
    h.extend_from_slice(&u32le(0)); // CRC: escrito depois
    h.extend_from_slice(&u32le(u32::MAX));
    h.extend_from_slice(&u32le(u32::MAX));
    h.extend_from_slice(&u16le(n.len() as u16));
    h.extend_from_slice(&u16le(20));
    h.extend_from_slice(n);
    h.extend_from_slice(&u16le(1));
    h.extend_from_slice(&u16le(16));
    h.extend_from_slice(&u64le(0));
    h.extend_from_slice(&u64le(0));
    d.write_all(&h)?;
    let mut crc = Crc::novo();
    let mut total: u64 = 0;
    let mut buf = vec![0u8; LER];
    loop {
        let quer = match limite {
            Some(l) if total >= l => break,
            Some(l) => (l - total).min(LER as u64) as usize,
            None => LER,
        };
        let k = fonte.read(&mut buf[..quer])?;
        if k == 0 {
            break;
        }
        if crc_sabido.is_none() {
            crc.somar(&buf[..k]);
        }
        d.write_all(&buf[..k])?;
        total += k as u64;
    }
    if let Some(l) = limite
        && total != l
    {
        return Err(std::io::Error::other(format!("{nome}: o arquivo terminou antes da hora ({total} de {l} bytes)")));
    }
    let crc = crc_sabido.unwrap_or_else(|| crc.fim());
    let fim = d.stream_position()?;
    d.seek(SeekFrom::Start(ini + 14))?;
    d.write_all(&u32le(crc))?;
    d.seek(SeekFrom::Start(ini + 30 + n.len() as u64 + 4))?;
    d.write_all(&u64le(total))?;
    d.write_all(&u64le(total))?;
    d.seek(SeekFrom::Start(fim))?;
    Ok(Entrada { nome: nome.to_string(), crc, tamanho: total, cabecalho: ini })
}

/// O índice (diretório central + fim zip64) depois das entradas.
fn gravar_indice<D: Write + Seek + ?Sized>(d: &mut D, entradas: &[Entrada]) -> std::io::Result<()> {
    let ini = d.stream_position()?;
    let mut b = Vec::with_capacity(entradas.len() * 110 + 100);
    for e in entradas {
        let n = e.nome.as_bytes();
        b.extend_from_slice(&u32le(0x0201_4b50));
        b.extend_from_slice(&u16le(45));
        b.extend_from_slice(&u16le(45));
        b.extend_from_slice(&u16le(0x0800));
        b.extend_from_slice(&u16le(0));
        b.extend_from_slice(&u16le(0));
        b.extend_from_slice(&u16le(DATA_DOS));
        b.extend_from_slice(&u32le(e.crc));
        b.extend_from_slice(&u32le(u32::MAX));
        b.extend_from_slice(&u32le(u32::MAX));
        b.extend_from_slice(&u16le(n.len() as u16));
        b.extend_from_slice(&u16le(28));
        b.extend_from_slice(&u16le(0));
        b.extend_from_slice(&u16le(0));
        b.extend_from_slice(&u16le(0));
        b.extend_from_slice(&u32le(0));
        b.extend_from_slice(&u32le(u32::MAX));
        b.extend_from_slice(n);
        b.extend_from_slice(&u16le(1));
        b.extend_from_slice(&u16le(24));
        b.extend_from_slice(&u64le(e.tamanho));
        b.extend_from_slice(&u64le(e.tamanho));
        b.extend_from_slice(&u64le(e.cabecalho));
    }
    let tam = b.len() as u64;
    let z = ini + tam;
    let qtd = entradas.len() as u64;
    b.extend_from_slice(&u32le(0x0606_4b50));
    b.extend_from_slice(&u64le(44));
    b.extend_from_slice(&u16le(45));
    b.extend_from_slice(&u16le(45));
    b.extend_from_slice(&u32le(0));
    b.extend_from_slice(&u32le(0));
    b.extend_from_slice(&u64le(qtd));
    b.extend_from_slice(&u64le(qtd));
    b.extend_from_slice(&u64le(tam));
    b.extend_from_slice(&u64le(ini));
    b.extend_from_slice(&u32le(0x0706_4b50));
    b.extend_from_slice(&u32le(0));
    b.extend_from_slice(&u64le(z));
    b.extend_from_slice(&u32le(1));
    b.extend_from_slice(&u32le(0x0605_4b50));
    b.extend_from_slice(&u16le(0));
    b.extend_from_slice(&u16le(0));
    b.extend_from_slice(&u16le(u16::MAX));
    b.extend_from_slice(&u16le(u16::MAX));
    b.extend_from_slice(&u32le(u32::MAX));
    b.extend_from_slice(&u32le(u32::MAX));
    b.extend_from_slice(&u16le(0));
    d.write_all(&b)
}

fn ler_em<R: Read + Seek + ?Sized>(r: &mut R, pos: u64, n: usize) -> std::io::Result<Vec<u8>> {
    r.seek(SeekFrom::Start(pos))?;
    let mut v = vec![0u8; n];
    r.read_exact(&mut v)?;
    Ok(v)
}
fn le16(b: &[u8], i: usize) -> u16 {
    u16::from_le_bytes([b[i], b[i + 1]])
}
fn le32(b: &[u8], i: usize) -> u32 {
    u32::from_le_bytes([b[i], b[i + 1], b[i + 2], b[i + 3]])
}
fn le64(b: &[u8], i: usize) -> u64 {
    u64::from_le_bytes(b[i..i + 8].try_into().unwrap_or([0; 8]))
}

/// O índice que começa no fim de diretório em `fim` (`None` se ali não há um índice válido).
fn indice_em<R: Read + Seek + ?Sized>(r: &mut R, fim: u64, tamanho: u64) -> Option<Vec<Entrada>> {
    let e = ler_em(r, fim, 22).ok()?;
    if le32(&e, 0) != 0x0605_4b50 {
        return None;
    }
    let (mut qtd, mut cd_tam, mut cd_ini) = (u64::from(le16(&e, 10)), u64::from(le32(&e, 12)), u64::from(le32(&e, 16)));
    if fim >= 20
        && let Ok(l) = ler_em(r, fim - 20, 20)
        && le32(&l, 0) == 0x0706_4b50
    {
        let z = le64(&l, 8);
        let zz = ler_em(r, z, 56).ok()?;
        if le32(&zz, 0) != 0x0606_4b50 {
            return None;
        }
        qtd = le64(&zz, 32);
        cd_tam = le64(&zz, 40);
        cd_ini = le64(&zz, 48);
    }
    if cd_ini.checked_add(cd_tam)? > fim || cd_tam > 512 << 20 || qtd > 10_000_000 {
        return None;
    }
    let cd = ler_em(r, cd_ini, cd_tam as usize).ok()?;
    let mut v = Vec::with_capacity(qtd as usize);
    let mut i = 0usize;
    while i + 46 <= cd.len() && (v.len() as u64) < qtd {
        if le32(&cd, i) != 0x0201_4b50 {
            return None;
        }
        let metodo = le16(&cd, i + 10);
        let crc = le32(&cd, i + 16);
        let mut comp = u64::from(le32(&cd, i + 20));
        let mut tam = u64::from(le32(&cd, i + 24));
        let (nl, xl, cl) = (le16(&cd, i + 28) as usize, le16(&cd, i + 30) as usize, le16(&cd, i + 32) as usize);
        let mut off = u64::from(le32(&cd, i + 42));
        let nome = String::from_utf8_lossy(cd.get(i + 46..i + 46 + nl)?).into_owned();
        let extra = cd.get(i + 46 + nl..i + 46 + nl + xl)?;
        let mut j = 0;
        while j + 4 <= extra.len() {
            let (id, sz) = (le16(extra, j), le16(extra, j + 2) as usize);
            if id == 1 {
                let mut k = j + 4;
                if tam == u64::from(u32::MAX) && k + 8 <= extra.len() {
                    tam = le64(extra, k);
                    k += 8;
                }
                if comp == u64::from(u32::MAX) && k + 8 <= extra.len() {
                    comp = le64(extra, k);
                    k += 8;
                }
                if off == u64::from(u32::MAX) && k + 8 <= extra.len() {
                    off = le64(extra, k);
                }
            }
            j += 4 + sz;
        }
        // Só lemos o que está guardado sem compressão (é o que este editor grava).
        if metodo != 0 || comp != tam || off.checked_add(tam)? > tamanho {
            return None;
        }
        v.push(Entrada { nome, crc, tamanho: tam, cabecalho: off });
        i += 46 + nl + xl + cl;
    }
    if (v.len() as u64) != qtd {
        return None;
    }
    Some(v)
}

/// O índice do pacote: o do fim do arquivo; se o último salvamento caiu no meio, o anterior.
fn ler_indice<R: Read + Seek + ?Sized>(r: &mut R) -> std::io::Result<Vec<Entrada>> {
    let tamanho = r.seek(SeekFrom::End(0))?;
    if tamanho >= 22
        && let Some(v) = indice_em(r, tamanho - 22, tamanho)
        && v.iter().any(|e| e.nome == PROJETO)
    {
        return Ok(v);
    }
    // procura de trás para a frente o último índice inteiro
    let mut fim = tamanho;
    let bloco: u64 = 4 << 20;
    while fim > 0 {
        let ini = fim.saturating_sub(bloco);
        let ate = (fim + 3).min(tamanho);
        let b = ler_em(r, ini, (ate - ini) as usize)?;
        let mut i = b.len().saturating_sub(4);
        loop {
            if i + 4 <= b.len() && le32(&b, i) == 0x0605_4b50 {
                let pos = ini + i as u64;
                if let Some(v) = indice_em(r, pos, tamanho)
                    && v.iter().any(|e| e.nome == PROJETO)
                {
                    return Ok(v);
                }
            }
            if i == 0 {
                break;
            }
            i -= 1;
        }
        fim = ini;
    }
    Err(std::io::Error::other("o arquivo não tem um índice de projeto inteiro"))
}

/// Onde começam os dados de uma entrada (depois do cabeçalho local).
fn dados_de<R: Read + Seek + ?Sized>(r: &mut R, e: &Entrada) -> std::io::Result<u64> {
    let h = ler_em(r, e.cabecalho, 30)?;
    if le32(&h, 0) != 0x0403_4b50 {
        return Err(std::io::Error::other(format!("{}: cabeçalho estragado", e.nome)));
    }
    Ok(e.cabecalho + 30 + u64::from(le16(&h, 26)) + u64::from(le16(&h, 28)))
}

fn ler_entrada<R: Read + Seek + ?Sized>(r: &mut R, e: &Entrada) -> std::io::Result<Vec<u8>> {
    let ini = dados_de(r, e)?;
    if e.tamanho > 2 << 30 {
        return Err(std::io::Error::other(format!("{}: grande demais para ler de uma vez", e.nome)));
    }
    ler_em(r, ini, e.tamanho as usize)
}

/// O arquivo começa como pacote?
pub fn eh_pacote(inicio: &[u8]) -> bool {
    inicio.starts_with(b"PK\x03\x04")
}

// ─────────────────────────────────────────────────────────────── manifesto e registro

/// Mídias que vieram de dentro de um pacote nesta sessão: caminho extraído → (pacote, entrada).
/// Ao salvar de novo, elas não são copiadas outra vez.
static EXTRAIDOS: Mutex<BTreeMap<String, (String, String)>> = Mutex::new(BTreeMap::new());

fn extraidos() -> std::sync::MutexGuard<'static, BTreeMap<String, (String, String)>> {
    EXTRAIDOS.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn novo_id(caminho: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    caminho.hash(&mut h);
    web_time::SystemTime::now().duration_since(web_time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0).hash(&mut h);
    format!("{:016x}", h.finish())
}

fn nome_de(caminho: &str) -> String {
    let n = caminho.rsplit(['/', '\\']).next().unwrap_or(caminho).trim();
    let n: String = n.chars().map(|c| if c.is_control() || matches!(c, ':' | '*' | '?' | '"' | '<' | '>' | '|') { '_' } else { c }).collect();
    if n.is_empty() { "arquivo".into() } else { n }
}

fn unico(pasta: &str, nome: &str, usados: &mut HashSet<String>) -> String {
    let mut c = format!("{pasta}/{nome}");
    let mut k = 2;
    while !usados.insert(c.to_ascii_lowercase()) {
        c = format!("{pasta}/{k}_{nome}");
        k += 1;
    }
    c
}

// ─────────────────────────────────────────────────────────────── o que vai dentro

/// Os arquivos de mídia que o projeto usa (cada quadro de sequência é um arquivo).
fn arquivos_de_midia(p: &Project) -> Vec<String> {
    let mut v = Vec::new();
    let mut vistos = HashSet::new();
    for it in p.items.values() {
        let ItemKind::Footage(f) = &it.kind else { continue };
        if f.missing || f.path.is_empty() || f.path.starts_with(PREFIXO) {
            continue;
        }
        let lista: Vec<&String> = if f.sequence.is_empty() { vec![&f.path] } else { f.sequence.iter().collect() };
        for c in lista {
            if vistos.insert(c.clone()) {
                v.push(c.clone());
            }
        }
    }
    v
}

/// (família, estilo) de cada fonte usada nos textos (o documento e os trechos de estilo, em todos
/// os keyframes do Texto de origem).
fn fontes_usadas(p: &Project) -> Vec<(String, String)> {
    let mut v: Vec<(String, String)> = Vec::new();
    let mut por = |f: &str, e: &str| {
        let f = f.trim();
        if !f.is_empty() && !v.iter().any(|(a, b)| a == f && b == e) {
            v.push((f.to_string(), e.to_string()));
        }
    };
    for (_, c) in p.comps() {
        for l in &c.layers {
            let Some(pr) = l.props.prop("text/sourceText") else { continue };
            let docs = std::iter::once(&pr.value).chain(pr.keys.iter().map(|k| &k.value));
            for val in docs {
                if let Some(doc) = val.as_text() {
                    por(&doc.font, &doc.style);
                    for r in &doc.runs {
                        if !r.style.font.is_empty() {
                            por(&r.style.font, &r.style.style);
                        }
                    }
                }
            }
        }
    }
    v
}

/// De onde vêm os bytes de uma fonte usada (as que vêm com o editor não precisam ir junto).
enum BytesDaFonte {
    Arquivo(std::path::PathBuf),
    Memoria(std::sync::Arc<Vec<u8>>),
}

fn fonte_para_levar(familia: &str, estilo: &str) -> Option<(String, BytesDaFonte)> {
    let r = effectcraft_text::resolve(familia, estilo);
    if r.missing {
        return None;
    }
    let face = effectcraft_text::fonts::face(r.face);
    if face.info.origin == "bundled" {
        return None;
    }
    match &face.info.data {
        effectcraft_text::fonts::FaceData::File(p) => Some((nome_de(&p.to_string_lossy()), BytesDaFonte::Arquivo(p.clone()))),
        effectcraft_text::fonts::FaceData::Shared(b) => Some((format!("{}.ttf", nome_de(familia)), BytesDaFonte::Memoria(b.clone()))),
        effectcraft_text::fonts::FaceData::Static(_) => None,
    }
}

// ─────────────────────────────────────────────────────────────── itens ausentes (o aviso)

/// Um item que o projeto usa e não está aqui.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Ausente {
    /// "arquivo" ou "fonte"
    pub tipo: &'static str,
    pub nome: String,
    pub detalhe: String,
    /// identifica o item entre as conferências (para avisar só do que é novo)
    pub chave: String,
}

/// Arquivos que não foram achados (e os espaços reservados que o projeto do After deixou no
/// lugar de arquivo que faltou) e fontes que não estão no computador.
pub fn ausentes(p: &Project, conferir_fontes: bool) -> Vec<Ausente> {
    let mut v = Vec::new();
    for it in p.items.values() {
        let ItemKind::Footage(f) = &it.kind else { continue };
        if !f.missing {
            continue;
        }
        let do_after = it.comment.strip_prefix("Arquivo ausente: ");
        if f.path.is_empty() && do_after.is_none() {
            continue; // espaço reservado criado de propósito
        }
        let detalhe = do_after.map(str::to_string).unwrap_or_else(|| f.path.clone());
        v.push(Ausente { tipo: "arquivo", nome: it.name.clone(), chave: format!("a|{}|{}", it.id.0, detalhe), detalhe });
    }
    if conferir_fontes {
        for (familia, estilo) in fontes_usadas(p) {
            if effectcraft_text::resolve(&familia, &estilo).missing {
                let nome = if estilo.is_empty() { familia.clone() } else { format!("{familia} {estilo}") };
                if !v.iter().any(|a| a.tipo == "fonte" && a.nome == nome) {
                    v.push(Ausente { tipo: "fonte", chave: format!("f|{nome}"), nome, detalhe: String::new() });
                }
            }
        }
    }
    v
}

// ─────────────────────────────────────────────────────────────── salvar

enum Plano {
    /// já está no pacote de destino, no mesmo lugar
    Fica(Entrada),
    /// copiar de outro pacote (aberto antes) sem recalcular nada
    DeOutroPacote { pacote: String, entrada: Entrada, nome: String },
    /// ler do arquivo
    DoArquivo { origem: String, nome: String },
    /// fonte que está na memória (navegador, fonte que veio do Arcano Conector)
    DaMemoria { bytes: std::sync::Arc<Vec<u8>>, nome: String },
}

struct Antigo {
    indice: Vec<Entrada>,
    manifesto: Value,
    tamanho: u64,
}

fn ler_antigo(s: &Session, caminho: &str) -> Option<Antigo> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = s;
        let mut f = std::fs::File::open(caminho).ok()?;
        let mut ini = [0u8; 4];
        f.read_exact(&mut ini).ok()?;
        if !eh_pacote(&ini) {
            return None;
        }
        let tamanho = f.seek(SeekFrom::End(0)).ok()?;
        let indice = ler_indice(&mut f).ok()?;
        let manifesto = indice
            .iter()
            .find(|e| e.nome == MANIFESTO)
            .and_then(|e| ler_entrada(&mut f, e).ok())
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or(Value::Null);
        Some(Antigo { indice, manifesto, tamanho })
    }
    #[cfg(target_arch = "wasm32")]
    {
        let b = s.services.read_file(caminho).ok()?;
        if !eh_pacote(&b) {
            return None;
        }
        let tamanho = b.len() as u64;
        let mut c = std::io::Cursor::new(b);
        let indice = ler_indice(&mut c).ok()?;
        let manifesto = indice
            .iter()
            .find(|e| e.nome == MANIFESTO)
            .and_then(|e| ler_entrada(&mut c, e).ok())
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or(Value::Null);
        Some(Antigo { indice, manifesto, tamanho })
    }
}

/// Arquivo ▸ Salvar / Salvar como / Incrementar: o projeto com as mídias e fontes dentro.
pub(crate) fn salvar(s: &mut Session, caminho: &str) -> Result<Value> {
    let antigo = ler_antigo(s, caminho);
    let id = antigo
        .as_ref()
        .and_then(|a| a.manifesto.get("id").and_then(Value::as_str).map(str::to_string))
        .unwrap_or_else(|| novo_id(caminho));
    let midias_antes: HashMap<String, Value> = antigo
        .as_ref()
        .and_then(|a| a.manifesto.get("midias").and_then(Value::as_object).cloned())
        .map(|m| m.into_iter().collect())
        .unwrap_or_default();
    let no_antigo = |nome: &str| antigo.as_ref().and_then(|a| a.indice.iter().find(|e| e.nome == nome).cloned());

    let mut usados: HashSet<String> = [PROJETO.to_string(), MANIFESTO.to_string()].into_iter().collect();
    let mut planos: Vec<Plano> = Vec::new();
    let mut destino_de: HashMap<String, String> = HashMap::new(); // origem → entrada
    let mut midias_json = serde_json::Map::new();
    let reg = extraidos().clone();

    // 1. o que ficou no mesmo lugar (reservar os nomes antes de dar nome ao que é novo)
    let origens = arquivos_de_midia(&s.project);
    let mut pendentes: Vec<String> = Vec::new();
    for o in &origens {
        if let Some((pac, ent)) = reg.get(o)
            && pac == caminho
            && let Some(e) = no_antigo(ent)
        {
            usados.insert(ent.to_ascii_lowercase());
            destino_de.insert(o.clone(), ent.clone());
            if let Some(m) = midias_antes.get(ent) {
                midias_json.insert(ent.clone(), m.clone());
            }
            planos.push(Plano::Fica(e));
            continue;
        }
        // arquivo comum que já foi salvo antes e não mudou (mesmo caminho, tamanho e data)
        let carimbo = s.services.stamp(o);
        let igual = carimbo.and_then(|(t, m)| {
            midias_antes.iter().find(|(ent, v)| {
                v.get("origem").and_then(Value::as_str) == Some(o.as_str())
                    && v.get("tamanho").and_then(Value::as_u64) == Some(t)
                    && v.get("modificado").and_then(Value::as_str) == Some(m.to_string().as_str())
                    && !usados.contains(&ent.to_ascii_lowercase())
                    && no_antigo(ent).is_some_and(|e| e.tamanho == t)
            })
        });
        if let Some((ent, v)) = igual {
            let ent = ent.clone();
            usados.insert(ent.to_ascii_lowercase());
            destino_de.insert(o.clone(), ent.clone());
            midias_json.insert(ent.clone(), v.clone());
            planos.push(Plano::Fica(no_antigo(&ent).expect("conferido acima")));
            continue;
        }
        pendentes.push(o.clone());
    }
    // 2. o que é novo (ou veio de outro pacote)
    for o in pendentes {
        let nome = unico("midia", &nome_de(&o), &mut usados);
        destino_de.insert(o.clone(), nome.clone());
        let mut m = json!({"origem": o});
        if let Some((pac, ent)) = reg.get(&o)
            && let Some(e) = entrada_de_outro(s, pac, ent)
        {
            if let Some(orig) = outro_manifesto_origem(s, pac, ent) {
                m["origem"] = json!(orig);
            }
            planos.push(Plano::DeOutroPacote { pacote: pac.clone(), entrada: e, nome: nome.clone() });
        } else {
            if let Some((t, md)) = s.services.stamp(&o) {
                m["tamanho"] = json!(t);
                m["modificado"] = json!(md.to_string());
            }
            planos.push(Plano::DoArquivo { origem: o.clone(), nome: nome.clone() });
        }
        midias_json.insert(nome, m);
    }
    // 3. fontes (as que não vêm com o editor)
    let fontes_antes: Vec<Value> = antigo.as_ref().and_then(|a| a.manifesto.get("fontes").and_then(Value::as_array).cloned()).unwrap_or_default();
    let mut fontes_json = Vec::new();
    let mut fontes_vistas = HashSet::new();
    for (familia, estilo) in fontes_usadas(&s.project) {
        let Some((arquivo, bytes)) = fonte_para_levar(&familia, &estilo) else { continue };
        let ja = fontes_antes.iter().find(|f| {
            f.get("familia").and_then(Value::as_str) == Some(familia.as_str()) && f.get("estilo").and_then(Value::as_str) == Some(estilo.as_str())
        });
        if let Some(f) = ja
            && let Some(ent) = f.get("entrada").and_then(Value::as_str)
            && let Some(e) = no_antigo(ent)
            && !usados.contains(&ent.to_ascii_lowercase())
        {
            usados.insert(ent.to_ascii_lowercase());
            fontes_json.push(f.clone());
            planos.push(Plano::Fica(e));
            continue;
        }
        // a mesma fonte (arquivo) usada com outro estilo vai uma vez só
        let chave = match &bytes {
            BytesDaFonte::Arquivo(p) => p.to_string_lossy().to_string(),
            BytesDaFonte::Memoria(b) => format!("mem:{:p}", b.as_ptr()),
        };
        if let Some(ent) = fontes_vistas.iter().find_map(|(k, e): &(String, String)| (k == &chave).then(|| e.clone())) {
            fontes_json.push(json!({"entrada": ent, "familia": familia, "estilo": estilo}));
            continue;
        }
        let nome = unico("fontes", &arquivo, &mut usados);
        fontes_vistas.insert((chave, nome.clone()));
        fontes_json.push(json!({"entrada": nome, "familia": familia, "estilo": estilo}));
        planos.push(match bytes {
            BytesDaFonte::Arquivo(p) => Plano::DoArquivo { origem: p.to_string_lossy().to_string(), nome },
            BytesDaFonte::Memoria(b) => Plano::DaMemoria { bytes: b, nome },
        });
    }

    // 4. o projeto com os caminhos trocados
    let mut proj = (*s.project).clone();
    for it in proj.items.values_mut() {
        let ItemKind::Footage(f) = &mut it.kind else { continue };
        if let Some(e) = destino_de.get(&f.path) {
            f.path = format!("{PREFIXO}{e}");
        }
        for q in &mut f.sequence {
            if let Some(e) = destino_de.get(q) {
                *q = format!("{PREFIXO}{e}");
            }
        }
    }
    let compacto = s.prefs.project.compact_project_files;
    let texto = proj.to_file_json_with_view(&s.saved_view(), compacto)?;
    let manifesto = json!({
        "formato": FORMATO,
        "versao": 1,
        "id": id,
        "gerador": format!("Arcano Layers {}", env!("CARGO_PKG_VERSION")),
        "midias": Value::Object(midias_json),
        "fontes": fontes_json,
    });
    let manifesto = serde_json::to_vec_pretty(&manifesto).unwrap_or_default();

    let n_midias = destino_de.values().collect::<HashSet<_>>().len();
    let n_fontes = fontes_json_len(&manifesto);
    let bytes = gravar(s, caminho, antigo.as_ref(), planos, texto.as_bytes(), &manifesto)?;

    // as mídias que vieram de outro pacote agora estão neste
    {
        let mut g = extraidos();
        for (o, ent) in &destino_de {
            if let Some(v) = g.get_mut(o) {
                *v = (caminho.to_string(), ent.clone());
            }
        }
    }
    s.path = Some(caminho.to_string());
    s.mark_saved();
    s.note_project_path(caminho);
    let mb = bytes as f64 / (1024.0 * 1024.0);
    s.toast(format!(
        "Projeto salvo com {n_midias} arquivo{} e {n_fontes} fonte{} dentro ({mb:.1} MB): abre em qualquer computador com tudo no lugar.",
        if n_midias == 1 { "" } else { "s" },
        if n_fontes == 1 { "" } else { "s" }
    ));
    Ok(json!({"path": caminho, "bytes": bytes, "arquivos": n_midias, "fontes": n_fontes, "pacote": true}))
}

fn fontes_json_len(manifesto: &[u8]) -> usize {
    serde_json::from_slice::<Value>(manifesto).ok().and_then(|v| v.get("fontes").and_then(Value::as_array).map(Vec::len)).unwrap_or(0)
}

fn entrada_de_outro(s: &Session, pacote: &str, nome: &str) -> Option<Entrada> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = s;
        let mut f = std::fs::File::open(pacote).ok()?;
        ler_indice(&mut f).ok()?.into_iter().find(|e| e.nome == nome)
    }
    #[cfg(target_arch = "wasm32")]
    {
        let b = s.services.read_file(pacote).ok()?;
        ler_indice(&mut std::io::Cursor::new(b)).ok()?.into_iter().find(|e| e.nome == nome)
    }
}

fn outro_manifesto_origem(s: &Session, pacote: &str, nome: &str) -> Option<String> {
    let a = ler_antigo(s, pacote)?;
    a.manifesto.get("midias")?.get(nome)?.get("origem")?.as_str().map(str::to_string)
}

/// Grava o pacote. No computador: acrescenta no fim do mesmo arquivo quando dá (rápido), ou
/// escreve tudo num temporário e troca no fim. No navegador: monta na memória e grava.
fn gravar(s: &Session, caminho: &str, antigo: Option<&Antigo>, planos: Vec<Plano>, projeto: &[u8], manifesto: &[u8]) -> Result<u64> {
    let erro = |e: std::io::Error| EngineError::Other(format!("não deu para salvar {caminho}: {e}"));
    let em_uso: u64 = planos.iter().map(|p| if let Plano::Fica(e) = p { e.tamanho } else { 0 }).sum();
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = s;
        // acrescentar no fim só se o lixo ainda for pouco
        let acrescentar = antigo.is_some_and(|a| a.tamanho < (64 << 20) || a.tamanho.saturating_sub(em_uso) <= em_uso);
        if acrescentar {
            let mut f = std::fs::OpenOptions::new().read(true).write(true).open(caminho).map_err(erro)?;
            let fim = f.seek(SeekFrom::End(0)).map_err(erro)?;
            match escrever(&mut f, planos, projeto, manifesto, None) {
                Ok(()) => {
                    let total = f.stream_position().map_err(erro)?;
                    f.set_len(total).map_err(erro)?;
                    f.sync_all().map_err(erro)?;
                    return Ok(total);
                }
                Err(e) => {
                    // volta ao índice anterior: o projeto continua como no último salvamento
                    let _ = f.set_len(fim);
                    return Err(erro(e));
                }
            }
        }
        let temp = format!("{caminho}.arcano-salvando");
        let resultado = (|| -> std::io::Result<u64> {
            let mut f = std::fs::File::create(&temp)?;
            let mut origem = if antigo.is_some() { Some(std::fs::File::open(caminho)?) } else { None };
            escrever(&mut f, planos, projeto, manifesto, origem.as_mut().map(|o| o as &mut dyn LerPacote))?;
            let total = f.stream_position()?;
            f.sync_all()?;
            drop(f);
            std::fs::rename(&temp, caminho)?;
            Ok(total)
        })();
        if resultado.is_err() {
            let _ = std::fs::remove_file(&temp);
        }
        resultado.map_err(erro)
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = em_uso;
        let velho = antigo.and_then(|_| s.services.read_file(caminho).ok());
        let mut origem = velho.map(std::io::Cursor::new);
        let mut c = std::io::Cursor::new(Vec::new());
        let mut leitor = PacotesNaMemoria { s };
        escrever_com(&mut c, planos, projeto, manifesto, origem.as_mut().map(|o| o as &mut dyn LerPacote), &mut leitor).map_err(erro)?;
        let v = c.into_inner();
        s.services.write_file(caminho, &v).map_err(erro)?;
        Ok(v.len() as u64)
    }
}

/// Um pacote aberto para ler (arquivo no computador, bytes no navegador).
trait LerPacote: Read + Seek {}
impl<T: Read + Seek> LerPacote for T {}

/// Quem lê os arquivos de mídia e os outros pacotes.
trait Leitor {
    fn arquivo(&mut self, caminho: &str) -> std::io::Result<Box<dyn Read + '_>>;
    fn pacote(&mut self, caminho: &str) -> std::io::Result<Box<dyn LerPacote>>;
}

#[cfg(not(target_arch = "wasm32"))]
struct Disco;
#[cfg(not(target_arch = "wasm32"))]
impl Leitor for Disco {
    fn arquivo(&mut self, caminho: &str) -> std::io::Result<Box<dyn Read + '_>> {
        Ok(Box::new(std::io::BufReader::with_capacity(LER, std::fs::File::open(caminho)?)))
    }
    fn pacote(&mut self, caminho: &str) -> std::io::Result<Box<dyn LerPacote>> {
        Ok(Box::new(std::fs::File::open(caminho)?))
    }
}

#[cfg(target_arch = "wasm32")]
struct PacotesNaMemoria<'a> {
    s: &'a Session,
}
#[cfg(target_arch = "wasm32")]
impl Leitor for PacotesNaMemoria<'_> {
    fn arquivo(&mut self, caminho: &str) -> std::io::Result<Box<dyn Read + '_>> {
        Ok(Box::new(std::io::Cursor::new(self.s.services.read_file(caminho)?)))
    }
    fn pacote(&mut self, caminho: &str) -> std::io::Result<Box<dyn LerPacote>> {
        Ok(Box::new(std::io::Cursor::new(self.s.services.read_file(caminho)?)))
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn escrever<D: Write + Seek + ?Sized>(d: &mut D, planos: Vec<Plano>, projeto: &[u8], manifesto: &[u8], origem: Option<&mut dyn LerPacote>) -> std::io::Result<()> {
    escrever_com(d, planos, projeto, manifesto, origem, &mut Disco)
}

/// Escreve as entradas novas, o projeto, o manifesto e o índice. `origem`: o pacote velho no
/// mesmo caminho, quando tudo é reescrito (as entradas que ficam são copiadas dele); sem ele, as
/// que ficam já estão no arquivo (acrescentando no fim).
fn escrever_com<D: Write + Seek + ?Sized>(
    d: &mut D,
    planos: Vec<Plano>,
    projeto: &[u8],
    manifesto: &[u8],
    mut origem: Option<&mut dyn LerPacote>,
    leitor: &mut dyn Leitor,
) -> std::io::Result<()> {
    let mut entradas = Vec::with_capacity(planos.len() + 2);
    let mut abertos: HashMap<String, Box<dyn LerPacote>> = HashMap::new();
    for p in planos {
        match p {
            Plano::Fica(e) => match origem.as_deref_mut() {
                None => entradas.push(e),
                Some(o) => {
                    let ini = dados_de(o, &e)?;
                    o.seek(SeekFrom::Start(ini))?;
                    let nova = gravar_entrada(d, &e.nome, o, Some(e.tamanho), Some(e.crc))?;
                    entradas.push(nova);
                }
            },
            Plano::DeOutroPacote { pacote, entrada, nome } => {
                if !abertos.contains_key(&pacote) {
                    let o = leitor.pacote(&pacote)?;
                    abertos.insert(pacote.clone(), o);
                }
                let o = abertos.get_mut(&pacote).expect("aberto acima");
                let ini = dados_de(o, &entrada)?;
                o.seek(SeekFrom::Start(ini))?;
                entradas.push(gravar_entrada(d, &nome, o, Some(entrada.tamanho), Some(entrada.crc))?);
            }
            Plano::DoArquivo { origem: o, nome } => {
                let mut r = leitor.arquivo(&o).map_err(|e| std::io::Error::new(e.kind(), format!("{o}: {e}")))?;
                entradas.push(gravar_entrada(d, &nome, &mut r, None, None)?);
            }
            Plano::DaMemoria { bytes, nome } => {
                entradas.push(gravar_entrada(d, &nome, &mut std::io::Cursor::new(bytes.as_slice()), None, None)?);
            }
        }
    }
    entradas.push(gravar_entrada(d, PROJETO, &mut std::io::Cursor::new(projeto), None, None)?);
    entradas.push(gravar_entrada(d, MANIFESTO, &mut std::io::Cursor::new(manifesto), None, None)?);
    gravar_indice(d, &entradas)?;
    d.flush()
}

// ─────────────────────────────────────────────────────────────── abrir

/// Pasta onde as mídias saem do pacote (`<HD de trabalho>/Projetos abertos/<id>`).
#[cfg(not(target_arch = "wasm32"))]
fn pasta_de_extracao(s: &Session, id: &str) -> std::path::PathBuf {
    let base = s
        .media_cache_folder()
        .map(|m| m.parent().map(std::path::Path::to_path_buf).unwrap_or(m))
        .unwrap_or_else(|| std::env::temp_dir().join("Arcano Layers"));
    base.join("Projetos abertos").join(id)
}

/// O texto do projeto de um pacote, com as mídias já fora dele e os caminhos trocados.
/// `None`: não é pacote (o JSON de sempre).
pub(crate) fn abrir(s: &Session, caminho: &str) -> Option<Result<String>> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let mut f = std::fs::File::open(caminho).ok()?;
        let mut ini = [0u8; 4];
        if f.read_exact(&mut ini).is_err() || !eh_pacote(&ini) {
            return None;
        }
        Some(abrir_de(s, caminho, &mut f))
    }
    #[cfg(target_arch = "wasm32")]
    {
        let b = s.services.read_file(caminho).ok()?;
        if !eh_pacote(&b) {
            return None;
        }
        Some(abrir_de(s, caminho, &mut std::io::Cursor::new(b)))
    }
}

fn abrir_de<R: Read + Seek + ?Sized>(s: &Session, caminho: &str, r: &mut R) -> Result<String> {
    let erro = |e: std::io::Error| EngineError::Other(format!("{caminho}: não deu para abrir o projeto ({e})"));
    let indice = ler_indice(r).map_err(erro)?;
    let achar = |n: &str| indice.iter().find(|e| e.nome == n).cloned();
    let projeto = achar(PROJETO).ok_or_else(|| EngineError::Other(format!("{caminho}: o arquivo não tem o projeto dentro")))?;
    let mut texto = String::from_utf8(ler_entrada(r, &projeto).map_err(erro)?).map_err(|_| EngineError::Other(format!("{caminho}: projeto estragado")))?;
    let manifesto: Value = achar(MANIFESTO).and_then(|e| ler_entrada(r, &e).ok()).and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or(Value::Null);
    let id = manifesto.get("id").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| novo_id(caminho));

    // fontes que este computador não tem
    if let Some(fontes) = manifesto.get("fontes").and_then(Value::as_array) {
        let mut ja = HashSet::new();
        for f in fontes {
            let (Some(ent), Some(fam)) = (f.get("entrada").and_then(Value::as_str), f.get("familia").and_then(Value::as_str)) else { continue };
            let est = f.get("estilo").and_then(Value::as_str).unwrap_or("");
            if !effectcraft_text::resolve(fam, est).missing || !ja.insert(ent.to_string()) {
                continue;
            }
            if let Some(e) = achar(ent)
                && let Ok(b) = ler_entrada(r, &e)
            {
                effectcraft_text::fonts::add_font_data(b);
            }
        }
    }

    // mídias
    let midias = manifesto.get("midias").and_then(Value::as_object).cloned().unwrap_or_default();
    let mut trocas: Vec<(String, String)> = Vec::new();
    let mut registrar: Vec<(String, String)> = Vec::new();
    let mut falhas: Vec<String> = Vec::new();
    for e in indice.iter().filter(|e| e.nome.starts_with("midia/")) {
        let m = midias.get(&e.nome);
        let origem = m.and_then(|m| m.get("origem")).and_then(Value::as_str);
        let destino = match destino_da_midia(s, r, &id, e, m, origem) {
            Ok((d, extraido)) => {
                if extraido {
                    registrar.push((d.clone(), e.nome.clone()));
                }
                d
            }
            Err(err) => {
                falhas.push(format!("{}: {err}", e.nome));
                // fica apontando para o original: se não existir, aparece como ausente
                match origem {
                    Some(o) => o.to_string(),
                    None => continue,
                }
            }
        };
        trocas.push((format!("{PREFIXO}{}", e.nome), destino));
    }
    for (de, para) in trocas {
        let a = serde_json::to_string(&de).unwrap_or_default();
        let b = serde_json::to_string(&para).unwrap_or_default();
        texto = texto.replace(&a, &b);
    }
    {
        let mut g = extraidos();
        for (d, ent) in registrar {
            g.insert(d, (caminho.to_string(), ent));
        }
    }
    if !falhas.is_empty() {
        log::warn!("pacote {caminho}: mídias que não saíram: {falhas:?}");
    }
    Ok(texto)
}

/// Onde fica a mídia ao abrir: o original, se ainda está igual; senão, a cópia que sai do pacote.
/// Devolve (caminho, saiu do pacote?).
fn destino_da_midia<R: Read + Seek + ?Sized>(s: &Session, r: &mut R, id: &str, e: &Entrada, m: Option<&Value>, origem: Option<&str>) -> std::io::Result<(String, bool)> {
    let nome = e.nome.trim_start_matches("midia/");
    #[cfg(not(target_arch = "wasm32"))]
    {
        if let (Some(o), Some(m)) = (origem, m)
            && let Some((t, md)) = s.services.stamp(o)
            && t == e.tamanho
            && m.get("tamanho").and_then(Value::as_u64) == Some(t)
            && m.get("modificado").and_then(Value::as_str) == Some(md.to_string().as_str())
        {
            return Ok((o.to_string(), false));
        }
        let pasta = pasta_de_extracao(s, id);
        let dest = pasta.join(nome);
        if std::fs::metadata(&dest).is_ok_and(|x| x.len() == e.tamanho) {
            return Ok((dest.to_string_lossy().to_string(), true));
        }
        std::fs::create_dir_all(&pasta)?;
        let temp = pasta.join(format!("{nome}.arcano-saindo"));
        let ini = dados_de(r, e)?;
        r.seek(SeekFrom::Start(ini))?;
        {
            let mut w = std::io::BufWriter::with_capacity(LER, std::fs::File::create(&temp)?);
            let copiado = std::io::copy(&mut Read::take(&mut *r, e.tamanho), &mut w)?;
            if copiado != e.tamanho {
                return Err(std::io::Error::other("o pacote terminou antes da hora"));
            }
            w.flush()?;
        }
        std::fs::rename(&temp, &dest)?;
        Ok((dest.to_string_lossy().to_string(), true))
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = (m, origem);
        let dest = format!("/Projetos/{id}/{nome}");
        // 06/11/2026: além da tabela de arquivos, o leitor de mídia (pool) tem que receber os bytes,
        // como num arquivo importado; senão ele procurava no disco ("operation not supported on this
        // platform") e o projeto do navegador abria sem as imagens/vídeos.
        let b = match s.services.read_file(&dest) {
            Ok(b) if b.len() as u64 == e.tamanho => b,
            _ => {
                let b = ler_entrada(r, e)?;
                s.services.store_file(&dest, &b)?;
                b
            }
        };
        if let Some(imp) = &s.importer {
            imp.register(&dest, &b);
        }
        Ok((dest, true))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crc_conhecido() {
        let mut c = Crc::novo();
        c.somar(b"123456789");
        assert_eq!(c.fim(), 0xCBF4_3926);
        let mut c = Crc::novo();
        let dados: Vec<u8> = (0..100_003u32).map(|i| (i * 31 % 251) as u8).collect();
        c.somar(&dados[..17]);
        c.somar(&dados[17..]);
        let mut d = Crc::novo();
        for b in &dados {
            d.somar(std::slice::from_ref(b));
        }
        assert_eq!(c.fim(), d.fim());
    }

    #[test]
    fn grava_le_e_acrescenta() {
        let mut c = std::io::Cursor::new(Vec::new());
        let a = gravar_entrada(&mut c, "midia/a.bin", &mut std::io::Cursor::new(vec![7u8; 5000]), None, None).unwrap();
        let p = gravar_entrada(&mut c, PROJETO, &mut std::io::Cursor::new(b"{\"x\":1}".to_vec()), None, None).unwrap();
        gravar_indice(&mut c, &[a.clone(), p]).unwrap();
        let idx = ler_indice(&mut c).unwrap();
        assert_eq!(idx.len(), 2);
        assert_eq!(ler_entrada(&mut c, &idx[0]).unwrap(), vec![7u8; 5000]);
        // acrescenta: novo projeto, a mídia fica onde está
        c.seek(SeekFrom::End(0)).unwrap();
        let p2 = gravar_entrada(&mut c, PROJETO, &mut std::io::Cursor::new(b"{\"x\":2}".to_vec()), None, None).unwrap();
        gravar_indice(&mut c, &[a, p2]).unwrap();
        let idx = ler_indice(&mut c).unwrap();
        let proj = idx.iter().find(|e| e.nome == PROJETO).unwrap();
        assert_eq!(ler_entrada(&mut c, proj).unwrap(), b"{\"x\":2}");
        // salvamento que caiu no meio: lixo no fim, volta ao índice anterior
        let mut v = c.into_inner();
        v.extend_from_slice(&[1, 2, 3, 0x50, 0x4b, 5, 6, 9, 9]);
        let mut c = std::io::Cursor::new(v);
        let idx = ler_indice(&mut c).unwrap();
        let proj = idx.iter().find(|e| e.nome == PROJETO).unwrap();
        assert_eq!(ler_entrada(&mut c, proj).unwrap(), b"{\"x\":2}");
    }

    fn sessao_com(arquivos: &[&std::path::Path]) -> Session {
        let mut s = Session::default();
        for (i, p) in arquivos.iter().enumerate() {
            let f = effectcraft_project::Footage { path: p.to_string_lossy().to_string(), width: 64, height: 48, has_video: true, ..Default::default() };
            std::sync::Arc::make_mut(&mut s.project).add_item(&format!("f{i}"), crate::color::Label::None, None, ItemKind::Footage(f));
        }
        s
    }
    fn caminhos(s: &Session) -> Vec<String> {
        s.project.items.values().filter_map(|i| if let ItemKind::Footage(f) = &i.kind { Some(f.path.clone()) } else { None }).collect()
    }

    #[test]
    fn salva_com_tudo_dentro_e_abre_sem_o_original() {
        let dir = std::env::temp_dir().join(format!("arcano-pacote-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let a = dir.join("video a.mp4");
        let b = dir.join("foto.png");
        std::fs::write(&a, vec![3u8; 300_000]).unwrap();
        std::fs::write(&b, vec![9u8; 1234]).unwrap();
        let proj = dir.join("Meu projeto.ecproj");
        let proj_s = proj.to_string_lossy().to_string();
        let mut s = sessao_com(&[&a, &b]);
        let r = s.execute("file.saveAs", json!({"path": proj_s})).unwrap();
        assert_eq!(r["arquivos"], json!(2), "{r}");
        let tam1 = std::fs::metadata(&proj).unwrap().len();
        assert!(tam1 > 300_000);

        // salvar de novo sem mudar nada: só cresce o projeto e o índice (as mídias ficam)
        s.execute("file.save", json!({})).unwrap();
        let tam2 = std::fs::metadata(&proj).unwrap().len();
        assert!(tam2 - tam1 < 50_000, "{tam1} -> {tam2}");

        // apaga os originais e abre em outra sessão: as mídias saem de dentro do projeto
        std::fs::remove_file(&a).unwrap();
        std::fs::remove_file(&b).unwrap();
        let mut o = Session::default();
        o.execute("file.open", json!({"path": proj_s})).unwrap();
        let cs = caminhos(&o);
        assert_eq!(cs.len(), 2);
        for c in &cs {
            assert!(!c.starts_with(PREFIXO), "{c}");
            assert!(std::path::Path::new(c).exists(), "{c}");
        }
        let lido: Vec<u64> = cs.iter().map(|c| std::fs::metadata(c).unwrap().len()).collect();
        assert!(lido.contains(&300_000) && lido.contains(&1234));

        // salvar de novo (no mesmo arquivo) não copia as mídias outra vez
        let tam3 = std::fs::metadata(&proj).unwrap().len();
        o.execute("file.save", json!({})).unwrap();
        let tam4 = std::fs::metadata(&proj).unwrap().len();
        assert!(tam4 - tam3 < 50_000, "{tam3} -> {tam4}");

        // Salvar como em outro lugar: leva as mídias junto (copiadas do pacote)
        let outro = dir.join("copia.ecproj");
        let r = o.execute("file.saveAs", json!({"path": outro.to_string_lossy()})).unwrap();
        assert_eq!(r["arquivos"], json!(2), "{r}");
        let mut f = std::fs::File::open(&outro).unwrap();
        let idx = ler_indice(&mut f).unwrap();
        let m: Vec<&Entrada> = idx.iter().filter(|e| e.nome.starts_with("midia/")).collect();
        assert_eq!(m.len(), 2);
        let v = m.iter().find(|e| e.tamanho == 300_000).unwrap();
        assert_eq!(ler_entrada(&mut f, v).unwrap(), vec![3u8; 300_000]);

        // projeto antigo em JSON abre como antes
        let json_velho = dir.join("velho.ecproj");
        std::fs::write(&json_velho, Session::default().project.to_json()).unwrap();
        let mut v = Session::default();
        v.execute("file.open", json!({"path": json_velho.to_string_lossy()})).unwrap();
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn ausente_aparece_na_lista() {
        let s = sessao_com(&[std::path::Path::new("/nao/existe/clip.mp4")]);
        let mut p = (*s.project).clone();
        for it in p.items.values_mut() {
            if let ItemKind::Footage(f) = &mut it.kind {
                f.missing = true;
            }
        }
        let l = ausentes(&p, true);
        assert_eq!(l.len(), 1);
        assert_eq!(l[0].detalhe, "/nao/existe/clip.mp4");
    }
}
