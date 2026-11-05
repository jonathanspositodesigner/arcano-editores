//! Arcano: projeto do After Effects (.aep/.aet) jogado no editor.
//!
//! O formato do After é fechado; quem lê é o painel do Arcano Motion (o py-aep, rodando no
//! navegador), que escreve o script que monta o projeto inteiro numa pasta (pastas, arquivos,
//! composições, camadas, keyframes, efeitos, textos). Aqui fica só a fila: o `file.import` guarda o
//! caminho e o programa (ou a página do navegador) entrega ao painel.

use std::sync::Mutex;

static FILA: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// Arquivo de projeto do After (projeto ou modelo).
pub fn eh_aep(caminho: &str) -> bool {
    let c = caminho.to_ascii_lowercase();
    c.ends_with(".aep") || c.ends_with(".aet")
}

/// Guarda os projetos do After para o painel abrir.
pub fn pedir(caminhos: &[String]) {
    FILA.lock().unwrap_or_else(std::sync::PoisonError::into_inner).extend(caminhos.iter().cloned());
}

/// Os projetos que esperam o painel (e esvazia a fila).
pub fn pendentes() -> Vec<String> {
    std::mem::take(&mut *FILA.lock().unwrap_or_else(std::sync::PoisonError::into_inner))
}

/// Arquivo ▸ Salvar como projeto do After (.aep): pedidos ao painel (JSON {tipo, nome, caminho?}).
static SALVAR: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// Guarda um pedido de salvar como .aep para o painel.
pub fn pedir_salvar(pedido: String) {
    SALVAR.lock().unwrap_or_else(std::sync::PoisonError::into_inner).push(pedido);
}

/// Os pedidos de salvar como .aep que esperam o painel (e esvazia a fila).
pub fn pedidos_salvar() -> Vec<String> {
    std::mem::take(&mut *SALVAR.lock().unwrap_or_else(std::sync::PoisonError::into_inner))
}
