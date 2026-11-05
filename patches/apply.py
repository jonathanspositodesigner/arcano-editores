#!/usr/bin/env python3
"""Personalização Arcano Layers sobre o código original (PhotoCraft / EffectCraft).

Uso: python3 apply.py photocraft <pasta-do-codigo>
     python3 apply.py effectcraft <pasta-do-codigo>

Cada troca exige que o texto original exista; se não existir, o script falha
(sinal de que a versão do código mudou e o patch precisa ser revisto).
"""
import pathlib
import sys

NOME = "Arcano Layers"
GRUPO = "https://chat.whatsapp.com/GugrdeclB1WLetsn5eqnP8"  # o mesmo da página de isca (GRUPO_COMUNIDADE)
VOLTAR = "https://layers.voxvisual.com.br/"  # tela de escolher imagem ou vídeo

# Formato de arquivo: trocar o nome aqui quebraria abrir projetos.
NAO_MEXER = ("interchange/xml_project.rs", "disk_cache.rs")


def nomes_restantes(r, pastas=("crates", "apps"), nomes=(("EffectCraft", None), ("ArtCraft", "ArcanoApp"), ("getartcraft.com", "arcanoapp.voxvisual.com.br"), ("PhotoCraft", None))):
    """Troca o nome deles em todo arquivo de código/texto (menos testes e formatos de arquivo)."""
    total = 0
    for pasta in pastas:
        for p in sorted((pathlib.Path(r) / pasta).rglob("*")):
            if p.suffix not in (".rs", ".js", ".html", ".webmanifest", ".json", ".tsv") or not p.is_file():
                continue
            rel = p.as_posix()
            if "/tests/" in rel or "/tests.rs" in rel or rel.endswith("_tests.rs") or any(rel.endswith(x) for x in NAO_MEXER):
                continue
            t = p.read_text(encoding="utf-8")
            n = t
            for velho, novo in nomes:
                n = n.replace(velho, novo or NOME)
            if n != t:
                p.write_text(n, encoding="utf-8")
                total += 1
    print(f"ok  nome trocado em {total} arquivos")


def troca(raiz, arquivo, antigo, novo, todas=False):
    p = pathlib.Path(raiz) / arquivo
    texto = p.read_text(encoding="utf-8")
    n = texto.count(antigo)
    if n == 0:
        sys.exit(f"ERRO: texto não encontrado em {arquivo}:\n{antigo}")
    if n > 1 and not todas:
        sys.exit(f"ERRO: texto aparece {n}x em {arquivo} (esperado 1):\n{antigo}")
    p.write_text(texto.replace(antigo, novo), encoding="utf-8")
    print(f"ok  {arquivo}  ({n}x)")


def photocraft(r):
    # Idioma: no navegador o original sempre cai em inglês. Padrão português do Brasil.
    troca(r, "crates/ui-egui/src/i18n/system.rs",
          "#[cfg(all(not(test), target_arch = \"wasm32\"))]\nfn detect_system_tags() -> Vec<String> {\n    Vec::new()\n}",
          "#[cfg(all(not(test), target_arch = \"wasm32\"))]\nfn detect_system_tags() -> Vec<String> {\n    vec![\"pt-BR\".to_owned()]\n}")
    # Nome do app.
    troca(r, "crates/ui-egui/src/menus/native_menu.rs",
          'pub const APP_NAME: &str = "PhotoCraft";', f'pub const APP_NAME: &str = "{NOME}";')
    troca(r, "crates/ui-egui/src/panels/title_bar.rs", '"PhotoCraft"', f'"{NOME}"', todas=True)
    troca(r, "crates/ui-egui/src/panels/title_bar.rs", "\\u{2014} PhotoCraft", f"\\u{{2014}} {NOME}")
    # Tela inicial: título, sem Discord e sem links do ArtCraft.
    troca(r, "crates/ui-egui/src/canvas/start_screen.rs",
          'tl!("PhotoCraft").into()', f'String::from("{NOME}")')
    troca(r, "crates/ui-egui/src/canvas/start_screen.rs",
          'tl!("open source").into()', 'String::from("editor de imagem")')
    troca(r, "crates/ui-egui/src/canvas/start_screen.rs",
          "            ui.add_space(26.0);\n            crate::links::discord_button(app, ui, 190.0);\n            ui.add_space(10.0);\n            crate::links::link_row(app, ui);\n",
          "")
    # Sobre: mantém o crédito do projeto original (licença), tira o botão do Discord.
    troca(r, "crates/ui-egui/src/dialogs.rs",
          "                crate::links::discord_button(app, ui, 220.0);\n                ui.add_space(8.0);\n",
          "")
    # Links: grupo do WhatsApp (o da página de isca) e voltar ao ArcanoApp; nada do ArtCraft.
    links = "crates/ui-egui/src/links.rs"
    troca(r, links, 'pub const DISCORD: &str = "https://discord.gg/artcraft";', f'pub const DISCORD: &str = "{GRUPO}";')
    troca(r, links, 'pub const ARTCRAFT_WEBSITE: &str = "https://getartcraft.com";', f'pub const ARTCRAFT_WEBSITE: &str = "{VOLTAR}";')
    troca(r, links, 'pub const APP_PAGE: &str = "https://getartcraft.com/apps/photocraft";', f'pub const APP_PAGE: &str = "{VOLTAR}";')
    troca(r, links, 'pub const GITHUB: &str = "https://github.com/storytold/photocraft";', f'pub const GITHUB: &str = "{VOLTAR}";')
    troca(r, links, 'pub const ISSUES: &str = "https://github.com/storytold/photocraft/issues";', f'pub const ISSUES: &str = "{GRUPO}";')
    troca(r, links, 'let links = [(tl!("PhotoCraft website"), APP_PAGE), (tl!("GitHub"), GITHUB), (tl!("ArtCraft"), ARTCRAFT_WEBSITE)];',
          'let links = [("Voltar ao início", APP_PAGE), ("Entrar no grupo do WhatsApp", DISCORD)];')
    # Menu Ajuda: só grupo do WhatsApp, voltar ao ArcanoApp, informações do sistema e Sobre.
    troca(r, "crates/engine/src/shell_commands.rs",
          '    ("help.discord", "Join the ArtCraft Discord…", &["Help"], None),\n    ("help.website", "PhotoCraft Website", &["Help"], None),\n    ("help.artcraftWebsite", "ArtCraft Website", &["Help"], None),\n    ("help.github", "PhotoCraft on GitHub", &["Help"], None),\n    ("help.reportIssue", "Report an Issue…", &["Help"], None),\n',
          '    ("help.discord", "Entrar no grupo do WhatsApp", &["Help"], None),\n    ("help.website", "Voltar ao início", &["Help"], None),\n')
    # Sobre: texto nosso (a licença e os créditos ficam: a licença exige).
    troca(r, "crates/ui-egui/src/dialogs.rs",
          'ui.label(tl!("PhotoCraft — an open-source, native image editor written in Rust."));',
          'ui.label("Editor de imagem do ArcanoApp, direto no navegador. Feito a partir de software de código aberto.");')
    # Título da aba do navegador.
    for f in ("apps/photocraft-web/index.html", "apps/photocraft-web-boot/index.html"):
        p = pathlib.Path(r) / f
        t = p.read_text(encoding="utf-8")
        if "<title>PhotoCraft</title>" in t:
            t = t.replace("<title>PhotoCraft</title>",
                          f'<title>{NOME} · Imagem</title>\n  <link rel="icon" href="icone.png" type="image/png">')
            p.write_text(t, encoding="utf-8")
            print(f"ok  {f}")
    # Gancho do Arcano (trava de login, painel do Photoshop): mora em /painel, fora do build,
    # então muda sem recompilar o editor.
    troca(r, "apps/photocraft-web-boot/index.html",
          '<canvas id="photocraft_canvas"></canvas>',
          '<canvas id="photocraft_canvas"></canvas>\n  <script src="../painel/montar-imagem.js"></script>')
    # Tela de carregamento (a que aparece antes do editor abrir).
    troca(r, "apps/photocraft-web-boot/index.html", "<p>Loading PhotoCraft&hellip;</p>", f"<p>Carregando {NOME}&hellip;</p>")
    troca(r, "apps/photocraft-web-boot/index.html",
          "This is taking longer than usual. If PhotoCraft doesn't start, its files may have failed to\n      download or come from a different version of this page. <a href=\"\">Reload</a> to try again; the browser\n      console lists what failed.",
          "Está demorando mais que o normal. Se não abrir, <a href=\"\">recarregue a página</a>.")
    # Cor de destaque: o azul vira o roxo do ArcanoApp (#A855F7, o mesmo hsl 271 91% 65%).
    troca(r, "crates/ui-egui/src/theme.rs", "from_rgb(55, 142, 240)", "from_rgb(168, 85, 247)", todas=True)
    troca(r, "crates/ui-egui/src/theme.rs", "accent_text: Color32::from_rgb(0, 66, 150)", "accent_text: Color32::from_rgb(107, 33, 168)")
    troca(r, "crates/ui-egui/src/theme.rs", "accent_text: Color32::from_rgb(16, 98, 196)", "accent_text: Color32::from_rgb(126, 34, 206)")
    # Ícone do canto superior esquerdo (onde o Photoshop mostra o "Ps").
    copia(ASSETS / "imagem-128.png", pathlib.Path(r) / "assets/app-icon/hicolor/128x128/apps/ai.storyteller.photocraft.png")
    # Painel do Arcano Design (o plugin do Photoshop) falando com o editor de forma síncrona
    # (window.photocraftArcano, carregado pelo montar-imagem.js): apps/photocraft-web/src/arcano.rs.
    copia(pathlib.Path(__file__).parent / "arquivos/photocraft-web-arcano.rs", pathlib.Path(r) / "apps/photocraft-web/src/arcano.rs")
    troca(r, "apps/photocraft-web/src/main.rs", "#[cfg(target_arch = \"wasm32\")]\nmod web;",
          "#[cfg(target_arch = \"wasm32\")]\nmod web;\n\n#[cfg(target_arch = \"wasm32\")]\nmod arcano;")
    troca(r, "apps/photocraft-web/src/web.rs", "    fn logic(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {\n",
          "    fn logic(&mut self, ctx: &egui::Context, frame: &mut eframe::Frame) {\n        crate::arcano::entrar(&mut self.app, ctx);\n")
    troca(r, "apps/photocraft-web/src/web.rs", "        self.save_presets(ctx);\n        self.app.finish_type_reset_logic(ctx);\n    }",
          "        self.save_presets(ctx);\n        self.app.finish_type_reset_logic(ctx);\n        crate::arcano::sair();\n    }")
    troca(r, "apps/photocraft-web/src/web.rs", "    fn ui(&mut self, ui: &mut egui::Ui, frame: &mut eframe::Frame) {\n",
          "    fn ui(&mut self, ui: &mut egui::Ui, frame: &mut eframe::Frame) {\n        crate::arcano::entrar(&mut self.app, ui.ctx());\n")
    troca(r, "apps/photocraft-web/src/web.rs", "        self.app.finish_type_reset_pass(ui.ctx());\n    }",
          "        self.app.finish_type_reset_pass(ui.ctx());\n        crate::arcano::sair();\n    }")
    troca(r, "crates/ui-egui/src/file_open.rs", "    pub(crate) fn place_bytes(&mut self,", "    pub fn place_bytes(&mut self,")
    # Arcano Layers antigo + novo (05/11/2026): conta do ArcanoApp na barra do topo (créditos, Preços,
    # perfil) e a barra rápida da camada (pedido + referência, Upscale, Remover fundo, Cor). Vale para o
    # navegador e o programa de PC (o ui-egui é o mesmo). Quem faz a IA é o painel do Arcano Design.
    copia(pathlib.Path(__file__).parent / "arquivos/ui-arcano-barra.rs", pathlib.Path(r) / "crates/ui-egui/src/arcano.rs")
    troca(r, "crates/ui-egui/src/lib.rs", "pub mod links;\n", "pub mod arcano;\npub mod links;\n")
    troca(r, "crates/ui-egui/src/panels/title_bar.rs", "                    ui.spacing_mut().item_spacing.x = 6.0;\n",
          "                    ui.spacing_mut().item_spacing.x = 6.0;\n                    crate::arcano::conta_ui(app, ui);\n")
    troca(r, "crates/ui-egui/src/app/frame.rs", "        canvas::extra_windows(self, &ctx);\n",
          "        canvas::extra_windows(self, &ctx);\n        crate::arcano::barra(self, &ctx);\n")
    # arcano.rs guarda onde o app está entre quadros (um ponteiro, ver o SAFETY lá): este crate sai do
    # "unsafe proibido" do workspace (o resto do editor continua com ele).
    troca(r, "apps/photocraft-web/Cargo.toml", "[lints]\nworkspace = true\n", "")
    troca(r, "apps/photocraft-web/Cargo.toml", 'js-sys = "0.3"\n', 'js-sys = "0.3"\nserde_json = { workspace = true }\n')
    # Nome deles em qualquer texto que sobrou (menus, mensagens, traduções .tsv).
    nomes_restantes(r, pastas=("crates/ui-egui", "crates/engine", "apps/photocraft-web", "apps/photocraft-web-boot"),
                    nomes=(("PhotoCraft", None), ("ArtCraft", "ArcanoApp"), ("getartcraft.com", "arcanoapp.voxvisual.com.br")))


ASSETS = pathlib.Path(__file__).parent / "assets"


def copia(origem, destino):
    destino.write_bytes(origem.read_bytes())
    print(f"ok  {destino.name} <- {origem.name}")


def effectcraft(r):
    # Logo do ArtCraft (marca registrada deles, não é open source) vira o logo do Arcano.
    copia(ASSETS / "video-256.png", pathlib.Path(r) / "docs/brand/artcraft-mark.png")
    copia(ASSETS / "video-128.png", pathlib.Path(r) / "assets/app-icon/hicolor/128x128/apps/ai.storyteller.effectcraft.png")
    copia(ASSETS / "video-64.png", pathlib.Path(r) / "apps/effectcraft-web/web/favicon.png")
    troca(r, "apps/effectcraft-web/web/index.html", '<link rel="icon" href="favicon.svg" type="image/svg+xml">', '<link rel="icon" href="favicon.png" type="image/png">')
    troca(r, "apps/effectcraft-web/web/index.html", '<img src="favicon.svg" alt="">', '<img src="icon-256.png" alt="">')
    for nome, arq in (("favicon.svg", "arcano.svg"), ("icon-256.png", "video-256.png"), ("icon-512.png", "video-512.png")):
        destino = pathlib.Path(r) / "apps/effectcraft-web/web" / nome
        if destino.exists():
            copia(ASSETS / arq, destino)
        else:
            print(f"aviso: {nome} não está em web/ (copiado no workflow)")
    # Cor de destaque: azul vira o roxo do ArcanoApp (tema escuro e claro).
    tema = "crates/ui-egui/src/theme.rs"
    troca(r, tema, "from_rgb(0x2d, 0x8c, 0xeb)", "from_rgb(0xa8, 0x55, 0xf7)", todas=True)  # destaque
    troca(r, tema, "from_rgb(0x4a, 0xa0, 0xf5)", "from_rgb(0xc0, 0x84, 0xfc)", todas=True)  # destaque (hover)
    troca(r, tema, "from_rgb(0x3d, 0x8f, 0xf5)", "from_rgb(0xb3, 0x6b, 0xf9)", todas=True)  # texto quente, timecode, keyframe
    troca(r, tema, "from_rgb(0x00, 0x5a, 0x9c)", "from_rgb(0x7e, 0x22, 0xce)", todas=True)  # tema claro: texto quente
    troca(r, tema, "from_rgb(0xaa, 0xc8, 0xf0)", "from_rgb(0xe0, 0xc8, 0xfd)", todas=True)  # tema claro: linha selecionada
    troca(r, tema, "from_rgb(0xb0, 0xcf, 0xec)", "from_rgb(0xe4, 0xd0, 0xfd)", todas=True)  # tema claro: cabeçalho de efeito
    troca(r, "apps/effectcraft-web/web/index.html", "#2d8ceb", "#a855f7", todas=True)
    troca(r, "apps/effectcraft-web/web/index.html", "#4aa0f5", "#c084fc", todas=True)
    # Painel do Arcano Motion ao lado da composição (mora em /painel, fora do build:
    # muda sem recompilar o editor).
    troca(r, "apps/effectcraft-web/web/index.html",
          '<canvas id="effectcraft_canvas"></canvas>',
          '<canvas id="effectcraft_canvas"></canvas>\n  <script src="../painel/montar.js"></script>')
    # Telas de carregamento e de erro.
    troca(r, "apps/effectcraft-web/web/index.html", "Loading EffectCraft…", f"Carregando {NOME}…")
    troca(r, "apps/effectcraft-web/web/index.html", '"EffectCraft failed to start:\\n"', f'"{NOME} não conseguiu abrir:\\n"')
    troca(r, "apps/effectcraft-web/web/index.html",
          'content="EffectCraft: motion graphics and visual effects in the browser"',
          f'content="{NOME}: editor de vídeo e motion no navegador"')
    troca(r, "apps/effectcraft-web/js/host.js", '"The graphics device was lost"', '"A placa de vídeo parou de responder"')
    troca(r, "apps/effectcraft-web/js/host.js",
          '"EffectCraft can\'t update the display any more. Your project is still open. "',
          '"O editor não consegue mais atualizar a tela. Seu projeto continua aberto. "')
    troca(r, "apps/effectcraft-web/js/host.js",
          '"Reload to continue: the project and its unsaved changes come back."',
          '"Recarregue para continuar: o projeto e o que não foi salvo voltam."')
    troca(r, "apps/effectcraft-web/js/host.js",
          '"This session isn\'t kept in browser storage: save the project before you reload."',
          '"Esta sessão não fica salva no navegador: salve o projeto antes de recarregar."')
    troca(r, "apps/effectcraft-web/js/host.js", 'save.textContent = "Save Project";', 'save.textContent = "Salvar projeto";')
    troca(r, "apps/effectcraft-web/js/host.js", 'reload.textContent = "Reload";', 'reload.textContent = "Recarregar";')
    # Barra do topo: tira Discord, GitHub e site deles.
    troca(r, "crates/ui-egui/src/header.rs",
          "fn community_buttons(app: &mut EffectcraftApp, ui: &mut egui::Ui, p: &egui::Painter, mut rx: f32, cy: f32) -> f32 {\n",
          "fn community_buttons(app: &mut EffectcraftApp, ui: &mut egui::Ui, p: &egui::Painter, mut rx: f32, cy: f32) -> f32 {\n    if true {\n        let _ = (&app, &ui, &p, &mut rx, cy);\n        return rx;\n    }\n")
    # Tela inicial: sem links da comunidade e sem a lista de apps do ArtCraft.
    troca(r, "crates/ui-egui/src/panels/home.rs",
          "    let links = [\n        (Icon::Chat, \"Join the ArtCraft Discord\", \"help.discord\"),\n        (Icon::Globe, \"getartcraft.com\", \"help.website\"),\n        (Icon::Globe, \"EffectCraft home page\", \"help.appPage\"),\n        (Icon::Code, \"EffectCraft on GitHub\", \"help.github\"),\n    ];\n    let sib = effectcraft_engine::links::SIBLINGS;",
          "    let links: [(Icon, &str, &str); 0] = [];\n    let sib: &[(&str, &str)] = &[];")
    troca(r, "crates/ui-egui/src/panels/home.rs", 'tr("More ArtCraft apps")', '""')
    troca(r, "crates/ui-egui/src/panels/home.rs", 'tr("Community")', '""')
    # Textos com o nome deles que aparecem na tela.
    troca(r, "crates/ui-egui/src/panels/home.rs", 'tr("Welcome to EffectCraft")', f'"Boas-vindas ao {NOME}"')
    troca(r, "crates/ui-egui/src/panels/home.rs", 'tr("EffectCraft project")', f'"Projeto {NOME}"')
    troca(r, "crates/ui-egui/src/panels/home.rs", '"EffectCraft project"', f'"Projeto {NOME}"', todas=True)
    troca(r, "crates/ui-egui/src/header.rs", 'tr("About EffectCraft")', f'"Sobre o {NOME}"')
    troca(r, "crates/ui-egui/src/header.rs", '"About EffectCraft"', f'"Sobre o {NOME}"', todas=True)
    troca(r, "crates/ui-egui/src/panels/dialogs.rs", '"About EffectCraft"', f'"Sobre o {NOME}"', todas=True)
    troca(r, "crates/ui-egui/src/panels/learn.rs",
          'crate::i18n::tr("Hands-on tutorials that run inside EffectCraft. Do each step yourself, or press Show me.")',
          '"Tutoriais práticos que rodam dentro do editor. Faça cada passo ou toque em Mostrar."')
    troca(r, "crates/ui-egui/src/panels/settings.rs",
          'tr("EffectCraft didn\'t quit normally last time.")', '"O editor não foi fechado normalmente da última vez."')
    # Sobre: nome Arcano Layers, mantendo o crédito do projeto original.
    troca(r, "crates/ui-egui/src/panels/dialogs.rs",
          'Align2::LEFT_CENTER, "EffectCraft", Tokens::semibold(24.0)',
          f'Align2::LEFT_CENTER, "{NOME}", Tokens::semibold(24.0)')
    # Título da aba e do app instalado.
    troca(r, "crates/ui-egui/src/panels/unsaved.rs",
          'format!("EffectCraft - {doc}', f'format!("{NOME} · Vídeo - {{doc}}')
    troca(r, "apps/effectcraft-web/web/index.html",
          "<title>EffectCraft</title>", f"<title>{NOME} · Vídeo</title>")
    troca(r, "apps/effectcraft-web/web/manifest.webmanifest",
          '"name": "EffectCraft"', f'"name": "{NOME} · Vídeo"')
    troca(r, "apps/effectcraft-web/web/manifest.webmanifest",
          '"short_name": "EffectCraft"', '"short_name": "Arcano Vídeo"')

    # ── Compatibilidade com a biblioteca do plugin (arcano.jsx), testada no motor de script ──
    # O plugin grava quadros/renders pelo script e importa os arquivos da pessoa. Sem ligar a
    # preferência "Allow Scripts to Write Files" (ela libera tudo: rede, executar arquivo, gravar em
    # qualquer pasta), o script pode GRAVAR só nas pastas do Arcano e LER arquivos de mídia.
    rt = "crates/script/src/runtime.rs"
    troca(r, rt, """fn check_access(s: &Session, path: &str, write: bool) -> Result<std::path::PathBuf, String> {
    let p = normalize(path);
    if s.prefs.scripting.allow_scripts_write_files {
        return Ok(p);
    }""", """fn check_access(s: &Session, path: &str, write: bool) -> Result<std::path::PathBuf, String> {
    let p = normalize(path);
    if s.prefs.scripting.allow_scripts_write_files {
        return Ok(p);
    }
    if arcano_liberado(path, write) {
        return Ok(p);
    }""")
    troca(r, rt, "pub(crate) const GATE: &str =", """/// Arcano Layers (plugin Arcano Motion): gravar só nas pastas do Arcano; ler também arquivos de mídia.
fn arcano_liberado(path: &str, write: bool) -> bool {
    let t = path.replace('\\\\', "/").to_lowercase();
    if t.split('/').any(|c| c == "..") || t.contains('\\0') {
        return false;
    }
    let pastas = ["/appdata/local/temp/arcano", "/tmp/arcano", "/arcano-motion/", "/documents/arcano motion", "/documents/arcano design",
        "/appdata/roaming/arcanomotion/", "/appdata/roaming/arcanodesign/", "/application support/arcanomotion/", "/application support/arcanodesign/",
        "/.arcanomotion/"];
    let em_pasta = pastas.iter().any(|p| t.contains(p)) && !t.contains("/arcanomotion/bin/") && !t.contains("/arcanomotion/ouvido/");
    if em_pasta && !t.ends_with(".exe") && !t.ends_with(".bat") && !t.ends_with(".cmd") && !t.ends_with(".ps1") && !t.ends_with(".vbs") && !t.ends_with(".sh") {
        return true;
    }
    if write {
        return false;
    }
    let ext = t.rsplit('.').next().unwrap_or("");
    ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "psd", "psb", "ai", "svg", "eps", "pdf", "exr", "mp4", "mov", "m4v", "webm", "mkv", "avi", "wav", "mp3",
        "m4a", "aac", "ogg", "flac", "aif", "aiff", "aep", "aepx", "ecproj", "ttf", "otf", "json", "jsx", "cube", "txt", "srt"]
        .contains(&ext)
}

pub(crate) const GATE: &str =""")
    # matchName do Keylight no After ("Keylight 906"): o editor tem o Key Light com outros apelidos.
    troca(r, "crates/effects/src/keylight.rs", 'pub const KEYLIGHT_ALIASES: &[&str] = &["Keylight (1.2)", "Keylight"];',
          'pub const KEYLIGHT_ALIASES: &[&str] = &["Keylight (1.2)", "Keylight", "Keylight 906"];')
    # app.purge(PurgeTarget.ALL_CACHES) (limpar cache): o enum do After.
    troca(r, "crates/script/src/prelude.js", "var app = {",
          "var PurgeTarget = { ALL_CACHES: 1, UNDO_CACHES: 2, SNAPSHOT_CACHES: 3, IMAGE_CACHES: 4, ALL_MEMORY_CACHES: 5 };\nvar app = {")
    # outputModule.applyTemplate("H.264") com o módulo já em H.264: o After aceita; o editor dava "nothing to change".
    troca(r, "crates/script/src/prelude.js",
          '    __call("renderQueue.setOutputModule", { item: this.__rq.__id, module: this.__n, format: f });\n  },\n  remove: function () { throw __err("removing output modules is not supported"); },',
          '    try { __call("renderQueue.setOutputModule", { item: this.__rq.__id, module: this.__n, format: f }); }\n    catch (e) { if (String(e).indexOf("nothing to change") < 0) throw e; }\n  },\n  remove: function () { throw __err("removing output modules is not supported"); },')
    # ── Ponte com o plugin Arcano Motion (espelho): arquivos do PC no editor ──
    # O plugin trabalha com caminhos do PC (importar logo/vídeo, salvar quadros). O shim copia o
    # arquivo para a memória do editor com o MESMO caminho (putFile) e devolve ao PC o que o
    # editor gravou; gravar num caminho do PC não vira download no navegador.
    fw = "apps/effectcraft-web/src/files.rs"
    troca(r, fw, "pub fn get(path: &str) -> Option<Arc<[u8]>> {",
          "/// Arcano: arquivo do PC (vindo do plugin) só na memória, sem gravar no navegador.\n"
          "pub fn put_arcano(path: &str, data: Arc<[u8]>) {\n    STORE.put_file(path, data, false);\n}\n\n"
          "/// Arcano: caminho do PC (o plugin copia de volta pelo conector): sem download.\n"
          "pub fn caminho_do_pc(path: &str) -> bool {\n"
          "    let b = path.as_bytes();\n"
          "    (b.len() > 2 && b[1] == b':' && (b[2] == b'\\\\' || b[2] == b'/'))\n"
          "        || [\"/Users/\", \"/home/\", \"/tmp/\", \"/private/\", \"/var/folders/\"].iter().any(|p| path.starts_with(p))\n"
          "}\n\n"
          "pub fn get(path: &str) -> Option<Arc<[u8]>> {")
    troca(r, fw, "        if quiet || crate::is_worker() {\n            return Ok(());\n        }\n        download(",
          "        if quiet || crate::is_worker() || caminho_do_pc(path) {\n            return Ok(());\n        }\n        download(")
    # PSD/PSB (e PDF/AI) no navegador entravam chapados como imagem: o navegador importava direto, sem
    # a pergunta "Importar como" que o programa de PC faz (Composição / Composição - Manter tamanho das
    # camadas). Agora pergunta igual (o mesmo formulário do editor).
    troca(r, "apps/effectcraft-web/src/app.rs",
          '    if !media.is_empty() {\n        match app.session.execute("file.import", json!({"paths": media})) {',
          '    if !media.is_empty() && crate::arcano_fontes::segurar(app, &media) {\n        return;\n    }\n'
          '    if !media.is_empty() && effectcraft_ui_egui::panels::dialogs::open_form(app, "file.import", &json!({"paths": media.clone()})) {\n'
          '        return;\n    }\n'
          '    if !media.is_empty() {\n        match app.session.execute("file.import", json!({"paths": media})) {')
    psd_fiel(r)
    fontes_pc(r)
    projeto_after(r)
    carregando(r)
    tempo_real(r)
    render_simples(r)
    render_gpu_propria(r)
    memoria_video(r)
    troca(r, "apps/effectcraft-web/src/api.rs", "/// Put bytes into the file table under `/<name>` and open",
          "/// Arcano: guarda bytes com o caminho exato (do PC), sem abrir nem importar (ponte do plugin).\n"
          "#[wasm_bindgen(js_name = putFile)]\npub fn put_file(path: String, data: js_sys::Uint8Array) {\n"
          "    crate::files::put_arcano(&path, data.to_vec().into());\n}\n\n"
          "/// Put bytes into the file table under `/<name>` and open")
    # ── Travamento do Chrome (RESULT_CODE_HUNG / "placa de vídeo parou") ──
    # Causa: ao abrir, o editor compilava de uma vez os 237 programas de GPU (todos os efeitos,
    # um shader de 514 KB). No Chrome cada um vira compilação HLSL no processo da GPU; somados,
    # passam do tempo do vigia do Chrome, que mata a GPU. No navegador agora só os 15 do
    # compositor compilam ao abrir; cada efeito compila na primeira vez que é usado.
    ctx = "crates/gpu/src/context.rs"
    troca(r, ctx, "/// Compute entry points in `kernels.wgsl` (one pipeline each).",
          "/// No navegador os kernels de efeito compilam na primeira vez que são usados (Arcano Layers):\n"
          "/// compilar os 237 ao abrir travava o processo da GPU do Chrome.\n"
          "const LAZY: bool = cfg!(target_arch = \"wasm32\");\n\n"
          "/// Compute entry points in `kernels.wgsl` (one pipeline each).")
    troca(r, ctx, "    pipelines: HashMap<&'static str, wgpu::ComputePipeline>,\n",
          "    pipelines: HashMap<&'static str, wgpu::ComputePipeline>,\n"
          "    /// Kernels de efeito já compilados sob demanda (só no navegador, ver `LAZY`).\n"
          "    lazy: Mutex<HashMap<&'static str, wgpu::ComputePipeline>>,\n"
          "    kmodule: wgpu::ShaderModule,\n"
          "    klayout: wgpu::PipelineLayout,\n"
          "    klayout_ext: wgpu::PipelineLayout,\n")
    troca(r, ctx, "        let mut unavailable = vec![];\n        for e in EXT_ENTRIES {\n",
          "        let mut unavailable = vec![];\n        if !LAZY {\n        for e in EXT_ENTRIES {\n")
    troca(r, ctx,
          "                    log::warn!(\"gpu {name}: kernel {e} unavailable, its effects render on the CPU: {why}\");\n"
          "                    unavailable.push((*e, why));\n                }\n            }\n        }\n        let dmodule",
          "                    log::warn!(\"gpu {name}: kernel {e} unavailable, its effects render on the CPU: {why}\");\n"
          "                    unavailable.push((*e, why));\n                }\n            }\n        }\n        }\n        let dmodule")
    troca(r, ctx, "            pipelines,\n            unavailable,\n            display_bgl,\n",
          "            pipelines,\n            lazy: Mutex::new(HashMap::new()),\n            kmodule: module.clone(),\n            klayout: layout.clone(),\n            klayout_ext: layout_ext.clone(),\n            unavailable,\n            display_bgl,\n")
    troca(r, ctx, "            pipelines,\n            unavailable,\n            display_bgl: self.display_bgl.clone(),\n",
          "            pipelines,\n            lazy: Mutex::new(HashMap::new()),\n            kmodule: self.kmodule.clone(),\n            klayout: self.klayout.clone(),\n            klayout_ext: self.klayout_ext.clone(),\n            unavailable,\n            display_bgl: self.display_bgl.clone(),\n")
    troca(r, ctx, "    pub(crate) fn has_kernel(&self, entry: &str) -> bool {\n        self.pipelines.contains_key(entry)\n    }\n",
          "    pub(crate) fn has_kernel(&self, entry: &str) -> bool {\n        self.pipelines.contains_key(entry) || (LAZY && lazy_name(entry).is_some())\n    }\n\n"
          "    /// O pipeline do kernel `entry`: já compilado, ou (no navegador) compilado agora, uma vez.\n"
          "    pub(crate) fn kernel(&self, entry: &str) -> Option<wgpu::ComputePipeline> {\n"
          "        if let Some(p) = self.pipelines.get(entry) {\n            return Some(p.clone());\n        }\n"
          "        if !LAZY {\n            return None;\n        }\n"
          "        let nome = lazy_name(entry)?;\n"
          "        let mut m = self.lazy.lock().unwrap_or_else(|e| e.into_inner());\n"
          "        if let Some(p) = m.get(nome) {\n            return Some(p.clone());\n        }\n"
          "        let layout = if EXT_ENTRIES.contains(&nome) { &self.klayout_ext } else { &self.klayout };\n"
          "        let p = self.device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {\n"
          "            label: Some(nome),\n            layout: Some(layout),\n            module: &self.kmodule,\n"
          "            entry_point: Some(nome),\n            compilation_options: Default::default(),\n            cache: None,\n        });\n"
          "        m.insert(nome, p.clone());\n        Some(p)\n    }\n")
    troca(r, ctx, "        let Some(pipe) = g.pipelines.get(entry) else {",
          "        let kernel = g.kernel(entry);\n        let Some(pipe) = kernel.as_ref() else {")
    # Lista dos kernels que compilam sob demanda (os mesmos que o original compilava ao abrir).
    p = pathlib.Path(r) / ctx
    t = p.read_text(encoding="utf-8")
    t += """

/// O nome estático de um kernel que compila sob demanda (efeitos e Classic 3D), se `entry` for um.
fn lazy_name(entry: &str) -> Option<&'static str> {
    EXT_ENTRIES
        .iter()
        .chain(EFFECT_ENTRIES)
        .chain(crate::fx_color::KERNELS)
        .chain(crate::fx_distort::KERNELS)
        .chain(crate::fx_generate::KERNELS)
        .chain(crate::fx_key::KERNELS)
        .chain(crate::fx_stylize::KERNELS)
        .chain(crate::fx_noise::KERNELS)
        .chain(crate::fx_tone::KERNELS)
        .chain(crate::fx_warp::KERNELS)
        .chain(crate::fx_extra::KERNELS)
        .chain(crate::fx_depth::KERNELS)
        .chain(crate::fx_lut::KERNELS)
        .chain(crate::fx_sim::KERNELS)
        .chain(crate::fx_particles::KERNELS)
        .chain(crate::fx_vr::KERNELS)
        .chain(crate::fx_light::KERNELS)
        .chain(crate::fx_transition::KERNELS)
        .chain(crate::fx_text::KERNELS)
        .chain(crate::fx_time::KERNELS)
        .chain(crate::fx_pixel2::KERNELS)
        .chain(crate::fx_gen2::KERNELS)
        .find(|e| **e == entry)
        .copied()
}
"""
    p.write_text(t, encoding="utf-8")
    print(f"ok  {ctx}  (kernels sob demanda)")
    # ── Sem nada do ArtCraft/EffectCraft (pedido do dono, 04/11/2026) ──
    # Links: grupo do WhatsApp (o da página de isca) e voltar ao ArcanoApp.
    troca(r, "crates/engine/src/home/links.rs", 'pub const DISCORD: &str = "https://discord.gg/artcraft";', f'pub const DISCORD: &str = "{GRUPO}";')
    troca(r, "crates/engine/src/home/links.rs", 'pub const WEBSITE: &str = "https://getartcraft.com";', f'pub const WEBSITE: &str = "{VOLTAR}";')
    troca(r, "crates/engine/src/home/links.rs", 'pub const APP_PAGE: &str = "https://getartcraft.com/apps/effectcraft";', f'pub const APP_PAGE: &str = "{VOLTAR}";')
    troca(r, "crates/engine/src/home/links.rs", 'pub const GITHUB: &str = "https://github.com/storytold/effectcraft";', f'pub const GITHUB: &str = "{VOLTAR}";')
    troca(r, "crates/engine/src/home/links.rs", 'pub const ISSUES: &str = "https://github.com/storytold/effectcraft/issues";', f'pub const ISSUES: &str = "{GRUPO}";')
    troca(r, "crates/engine/src/home/links.rs", 'format!("https://github.com/storytold/{slug}")', f'{{ let _ = slug; String::from("{VOLTAR}") }}')
    troca(r, "crates/engine/src/home/links.rs", 'format!("https://getartcraft.com/apps/{slug}")', f'{{ let _ = slug; String::from("{VOLTAR}") }}')
    # F1 / ajuda abria a documentação deles no GitHub.
    troca(r, "crates/engine/src/cmd/help.rs", 'open(s, format!("{}/blob/main/{page}", links::GITHUB))', '{ let _ = page; open(s, links::WEBSITE.into()) }')
    # Menu Ajuda enxuto: sem Discord, GitHub, site e documentação deles.
    troca(r, "crates/engine/src/menus.rs",
          "Help\n  EffectCraft Help... | help.docs {\"page\":\"help\"} | F1\n  Scripting Help... | help.docs {\"page\":\"scripting\"}\n  Expression Reference... | help.docs {\"page\":\"expressions\"}\n  Effect Reference... | help.docs {\"page\":\"effects\"}\n  Animation Presets... | anim.browsePresets\n  Keyboard Shortcuts... | app.keyboardShortcuts\n  ---\n  In-App Tutorials... | help.inAppTutorials\n  Online Tutorials... | help.onlineTutorials\n  ---\n  System Compatibility Report... | help.systemReport\n  Enable Logging | help.enableLogging\n  Reveal Logging File | help.revealLogFile\n  ---\n  Join the ArtCraft Discord... | help.discord\n  Provide Feedback... | help.reportIssue\n  ---\n  ArtCraft Website | help.website\n  EffectCraft Home Page | help.appPage\n  EffectCraft on GitHub | help.github\n  Open Demo Project | file.openDemoProject\n",
          "Help\n  Animation Presets... | anim.browsePresets\n  Keyboard Shortcuts... | app.keyboardShortcuts\n  ---\n  In-App Tutorials... | help.inAppTutorials\n  Open Demo Project | file.openDemoProject\n  ---\n  System Compatibility Report... | help.systemReport\n  Enable Logging | help.enableLogging\n  Reveal Logging File | help.revealLogFile\n  ---\n  Entrar no grupo do WhatsApp | help.discord\n  Voltar ao início | help.website\n")
    # Sobre: texto nosso + só 2 botões (grupo do WhatsApp e voltar ao ArcanoApp).
    # O rodapé da licença (MIT/Apache) e a aba de créditos ficam: a licença exige.
    troca(r, "crates/ui-egui/src/panels/dialogs.rs",
          'format!("Version {}  •  Motion graphics & VFX in pure Rust", env!("CARGO_PKG_VERSION"))',
          'format!("Versão {}  •  editor de vídeo do ArcanoApp", env!("CARGO_PKG_VERSION"))')
    troca(r, "crates/ui-egui/src/panels/dialogs.rs",
          'ui.label(tr("A clean-room, open-source compositor for motion graphics and visual effects: native on macOS, Windows and Linux, and in the browser. Part of the ArtCraft family of creative apps."));',
          'ui.label("Editor de vídeo e motion do ArcanoApp, direto no navegador, com o painel do Arcano Motion ao lado. Feito a partir de software de código aberto (licença abaixo).");')
    troca(r, "crates/ui-egui/src/panels/dialogs.rs",
          '    let links: [(Icon, &str, &str, &\'static str); 4] = [\n        (Icon::Chat, "Join the ArtCraft Discord", effectcraft_engine::links::DISCORD, "help.discord"),\n        (Icon::Globe, "ArtCraft website", effectcraft_engine::links::WEBSITE, "help.website"),\n        (Icon::Sparkle, "EffectCraft home page", effectcraft_engine::links::APP_PAGE, "help.appPage"),\n        (Icon::Code, "Source code on GitHub", effectcraft_engine::links::GITHUB, "help.github"),\n    ];',
          '    let links: [(Icon, &str, &str, &\'static str); 2] = [\n        (Icon::Chat, "Entrar no grupo do WhatsApp", effectcraft_engine::links::DISCORD, "help.discord"),\n        (Icon::Globe, "Voltar ao início", effectcraft_engine::links::WEBSITE, "help.website"),\n    ];')
    troca(r, "crates/ui-egui/src/panels/dialogs.rs", "Color32::from_rgb(0x58, 0x65, 0xf2)", "Color32::from_rgb(0x1f, 0xa8, 0x55)")  # verde WhatsApp
    # Nome deles em qualquer texto que sobrou (menus, mensagens, tutoriais, traduções).
    nomes_restantes(r, pastas=("crates/ui-egui", "crates/engine", "crates/effects", "crates/script", "crates/export", "crates/lottie", "apps/effectcraft-web"),
                    nomes=(("EffectCraft", None), ("ArtCraft", "ArcanoApp"), ("getartcraft.com", "arcanoapp.voxvisual.com.br")))


def render_gpu_propria(r):
    """Render da fila no PC com um dispositivo de GPU só dele (pedido do dono: "graphics device lost"
    ao renderizar fechava o programa). Antes o render usava a mesma GPU da janela: se ela caía
    (memória de vídeo cheia com PSD grande), o programa inteiro fechava. Agora, se a GPU do render
    cair, o render segue no processador (o editor já fazia isso) e a janela continua aberta."""
    rq = "crates/engine/src/render_queue.rs"
    troca(r, rq, "/// Everything the worker needs, detached from the session.\nstruct Work {",
          "/// Arcano: GPU só do render da fila (programa de PC); sem ela, a da janela.\n"
          "pub static ACCEL_EXPORTACAO: std::sync::Mutex<Option<Arc<dyn effectcraft_render::Accelerator>>> = std::sync::Mutex::new(None);\n\n"
          "/// Everything the worker needs, detached from the session.\nstruct Work {")
    troca(r, rq, "        accel: s.accel.clone(),\n        exporter,\n",
          "        accel: ACCEL_EXPORTACAO.lock().unwrap_or_else(std::sync::PoisonError::into_inner).clone().or_else(|| s.accel.clone()),\n        exporter,\n")
    troca(r, "crates/ui-egui/src/app/gpu.rs",
          "                self.session.accel = Some(Arc::new(g.clone()));\n                self.gpu = Some(g);\n",
          "                self.session.accel = Some(Arc::new(g.clone()));\n"
          "                // Arcano: o render da fila ganha uma GPU só dele (se ela cair, a janela fica).\n"
          "                #[cfg(not(target_arch = \"wasm32\"))]\n"
          "                std::thread::spawn(|| {\n"
          "                    if let Some(e) = effectcraft_gpu::Gpu::headless() {\n"
          "                        // pouca memória de vídeo para o render: a janela também precisa\n"
          "                        e.context().set_upload_budget(384 << 20);\n"
          "                        log::info!(\"Arcano: GPU própria do render pronta\");\n"
          "                        *effectcraft_engine::render_queue::ACCEL_EXPORTACAO.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = Some(Arc::new(e));\n"
          "                    }\n"
          "                });\n"
          "                self.gpu = Some(g);\n")


def memoria_video(r):
    """Memória de vídeo (registro do dono: "uncaptured GPU error: Out of Memory" numa RTX 3050 com o
    disco C: quase cheio, e o programa fechou): o compositor guardava até ~2,5 GB fixos (camadas
    1,5 GB + texturas de trabalho 768 MB + leitura 256 MB), qualquer que fosse a placa. Agora metade."""
    ctx = "crates/gpu/src/context.rs"
    troca(r, ctx, "const UPLOAD_BUDGET: usize = 1536 << 20;", "const UPLOAD_BUDGET: usize = 768 << 20;")
    troca(r, ctx, "const POOL_BUDGET: usize = 768 << 20;", "const POOL_BUDGET: usize = 384 << 20;")
    troca(r, ctx, "const STAGING_BUDGET: u64 = 256 << 20;", "const STAGING_BUDGET: u64 = 128 << 20;")


def render_simples(r):
    """Fila de render direta (pedido do dono): item novo já aberto, linha "Qualidade" (Original da
    composição, 1080p, 720p, 480p; padrão Original) e "Escolher onde salvar" (arquivos/ui-arcano-render.rs)."""
    copia(pathlib.Path(__file__).parent / "arquivos/ui-arcano-render.rs", pathlib.Path(r) / "crates/ui-egui/src/arcano_render.rs")
    troca(r, "crates/ui-egui/src/lib.rs", "pub mod menus;\n", "pub mod arcano_render;\npub mod menus;\n")
    rq = "crates/ui-egui/src/panels/render_queue.rs"
    troca(r, rq, "    let (mut open, mut selected): (Vec<u64>, Option<u64>) = ui.data(|d| d.get_temp(state_id).unwrap_or_default());\n",
          "    let (mut open, mut selected): (Vec<u64>, Option<u64>) = ui.data(|d| d.get_temp(state_id).unwrap_or_default());\n"
          "    crate::arcano_render::abrir_novos(&mut open, &queue);\n")
    troca(r, rq,
          "        for sub in 0..2 {\n            let r = Rect::from_min_size(pos2(list.min.x, y), vec2(list.width(), ROW_H));\n            y += ROW_H;\n            lp.rect_filled(r, 0.0, t.panel_bg);\n",
          "        for sub in 0..3 {\n            let r = Rect::from_min_size(pos2(list.min.x, y), vec2(list.width(), ROW_H));\n            y += ROW_H;\n            lp.rect_filled(r, 0.0, t.panel_bg);\n"
          "            if sub == 2 {\n"
          "                crate::arcano_render::qualidade(app, ui, &lp, r, cx_num - 6.0, ix + 70.0, it, rendering, &mut actions);\n"
          "                continue;\n"
          "            }\n")


def tempo_real(r):
    """Prévia em tempo real (pedido do dono: "como o CapCut, nunca trava"): som e relógio não param
    esperando quadro; quadro atrasado é pulado; o que renderiza é o que está à frente do relógio;
    resolução Auto baixa sozinha se não der conta; cache quando ocioso ligado por padrão
    (arquivos/ui-arcano-tempo-real.rs)."""
    copia(pathlib.Path(__file__).parent / "arquivos/ui-arcano-tempo-real.rs", pathlib.Path(r) / "crates/ui-egui/src/arcano_tempo_real.rs")
    troca(r, "crates/ui-egui/src/lib.rs", "pub mod menus;\n", "pub mod arcano_tempo_real;\npub mod menus;\n")
    pf = "crates/ui-egui/src/app/prefetch.rs"
    # resolução automática enquanto toca
    troca(r, pf, "        let plan = self.playback.plan.filter(|_| self.playback.playing);\n        let (wa, wb) = match plan {",
          "        if self.playback.playing && !self.playback.caching {\n            crate::arcano_tempo_real::ajustar_resolucao(&mut self.playback, now);\n        }\n"
          "        let plan = self.playback.plan.filter(|_| self.playback.playing);\n        let (wa, wb) = match plan {")
    # pedir à frente do relógio quando atrasado
    troca(r, pf, "        let cached = self.frames.cached_frames(&series);\n        let uncached = |f: i64| cached.binary_search(&f).is_err();\n",
          "        let cached = self.frames.cached_frames(&series);\n"
          "        // Arcano (tempo real): atrasada, a prévia pede os quadros À FRENTE do relógio, no passo\n"
          "        // que o computador dá conta (nunca quadro que já passou).\n"
          "        if self.playback.playing\n"
          "            && video\n"
          "            && let (Some(p), Some(alvo)) = (plan, crate::arcano_tempo_real::alvo(pass.now))\n"
          "        {\n"
          "            let passo = crate::arcano_tempo_real::passo(&self.playback);\n"
          "            for k in 1..=(ahead * 2) {\n"
          "                if queued >= ahead as usize {\n"
          "                    break;\n"
          "                }\n"
          "                let Some(f) = p.frame_after(alvo, k * passo) else { break };\n"
          "                if cached.binary_search(&f).is_err() {\n"
          "                    self.request_frame(cid, f, scale);\n"
          "                    queued += 1;\n"
          "                }\n"
          "            }\n"
          "            return;\n"
          "        }\n"
          "        let uncached = |f: i64| cached.binary_search(&f).is_err();\n")
    # relógio do som: não para o som, pula o quadro atrasado
    troca(r, pf,
          "        } else {\n"
          "            // Rendering can't keep up: rather than skip frames, the sound stops and every\n"
          "            // frame shows as it renders until the frames ahead are cached again.\n"
          "            self.audio = None;\n"
          "            self.playback.audio_held = true;\n"
          "            self.playback.waiting = true;\n"
          "            // The rate measured before the stall no longer says it keeps up.\n"
          "            self.playback.shown_at.clear();\n"
          "            self.playback.start_wall = now;\n"
          "            self.playback.start_frame = cur;\n"
          "        }\n",
          "        } else {\n"
          "            // Arcano (tempo real): o som segue; a tela mostra o último quadro pronto até o relógio.\n"
          "            crate::arcano_tempo_real::atrasado(target, now);\n"
          "            self.playback.waiting = false;\n"
          "            if let Some(f) = crate::arcano_tempo_real::melhor_pronto(&self.frames.cached_frames(&series), cur, target) {\n"
          "                self.session.set_time(fr.tick_of(f));\n"
          "                self.playback.frame_shown(now);\n"
          "            }\n"
          "        }\n")
    # relógio de parede (sem som): o relógio não para
    troca(r, pf,
          "            // Not cached yet: hold the clock at the current frame (cache first, then play).\n"
          "            self.playback.waiting = true;\n"
          "            let next = plan.and_then(|p| p.frame_after(cur, 1)).unwrap_or(if cur + 1 > wb { wa } else { cur + 1 });\n"
          "            if self.frames.is_cached(&FrameKey { frame: next, ..series }) {\n"
          "                self.session.set_time(fr.tick_of(next));\n"
          "            }\n"
          "            self.playback.start_wall = now;\n"
          "            self.playback.start_frame = fr.frame_at(self.session.time());\n",
          "            // Arcano (tempo real): o relógio não para; a tela mostra o último quadro pronto até ele.\n"
          "            crate::arcano_tempo_real::atrasado(target, now);\n"
          "            self.playback.waiting = false;\n"
          "            if let Some(f) = crate::arcano_tempo_real::melhor_pronto(&self.frames.cached_frames(&series), cur, target) {\n"
          "                self.session.set_time(fr.tick_of(f));\n"
          "                self.playback.frame_shown(now);\n"
          "            }\n")
    # começar na hora, som e imagem juntos (sem esperar encher o cache)
    troca(r, "crates/ui-egui/src/app/playback.rs",
          "        if !self.playback.caching {\n"
          "            if plan.video {\n"
          "                let audible = self.audio_plays();\n"
          "                self.playback.audio_held = audible;\n"
          "                self.playback.starting = audible;\n"
          "            } else {\n"
          "                self.start_audio(fr.tick_of(plan.first));\n"
          "            }\n"
          "        }\n",
          "        crate::arcano_tempo_real::comecou(self.playback.res.is_none(), now);\n"
          "        if !self.playback.caching {\n"
          "            // Arcano (tempo real): som e imagem começam juntos, na hora.\n"
          "            self.start_audio(fr.tick_of(plan.first));\n"
          "        }\n")
    # cache quando ocioso ligado por padrão
    troca(r, "crates/engine/src/settings/prefs/sections.rs", "    cache_frames_when_idle: bool = false,", "    cache_frames_when_idle: bool = true,")
    troca(r, "crates/ui-egui/src/state.rs", "            cache_when_idle: false,\n", "            cache_when_idle: true,\n")
    # quem já tinha o programa guardou "desligado": liga ao abrir (o menu ainda desliga na hora)
    troca(r, "crates/ui-egui/src/app/prefs.rs", "        self.ui.cache_when_idle = p.previews.cache_frames_when_idle;", "        self.ui.cache_when_idle = true;\n        let _ = p.previews.cache_frames_when_idle;")


def carregando(r):
    """Telas de "Carregando seu arquivo…" (importar/abrir trava o editor: o comando espera a tela
    aparecer) e "Gerando a prévia…" até o primeiro quadro da composição (arquivos/ui-arcano-carregando.rs)."""
    copia(pathlib.Path(__file__).parent / "arquivos/ui-arcano-carregando.rs", pathlib.Path(r) / "crates/ui-egui/src/arcano_carregando.rs")
    troca(r, "crates/ui-egui/src/lib.rs", "pub mod menus;\n", "pub mod arcano_carregando;\npub mod menus;\n")
    troca(r, "crates/ui-egui/src/app/frame.rs", "        panels::dialogs::show(self, &ctx);\n",
          "        panels::dialogs::show(self, &ctx);\n        crate::arcano_carregando::quadro(self, &ctx);\n")
    troca(r, "crates/ui-egui/src/menus/invoke.rs",
          "pub fn invoke(app: &mut EffectcraftApp, ctx: &egui::Context, id: &str, params: Value) -> Result<Value, String> {\n",
          "pub fn invoke(app: &mut EffectcraftApp, ctx: &egui::Context, id: &str, params: Value) -> Result<Value, String> {\n"
          "    if crate::arcano_carregando::adiar(id, &params) {\n        ctx.request_repaint();\n        return Ok(serde_json::json!({\"adiado\": true}));\n    }\n")
    troca(r, "apps/effectcraft-web/src/app.rs",
          '    if !media.is_empty() {\n        match app.session.execute("file.import", json!({"paths": media})) {',
          '    if !media.is_empty() && effectcraft_ui_egui::arcano_carregando::adiar("file.import", &json!({"paths": media.clone()})) {\n        return;\n    }\n'
          '    if !media.is_empty() {\n        match app.session.execute("file.import", json!({"paths": media})) {')


def projeto_after(r):
    """Projeto do After (.aep/.aet) jogado no editor de vídeo: o file.import guarda numa fila e o
    painel do Arcano Motion monta o projeto inteiro numa pasta (arquivos/engine-arcano-aep.rs; quem
    lê o .aep é o painel, com o py-aep no navegador)."""
    copia(pathlib.Path(__file__).parent / "arquivos/engine-arcano-aep.rs", pathlib.Path(r) / "crates/engine/src/arcano_aep.rs")
    troca(r, "crates/engine/src/lib.rs", "pub mod cmd;\n", "pub mod arcano_aep;\npub mod cmd;\n")
    troca(r, "crates/engine/src/cmd/file.rs",
          "    let (project_paths, mut paths): (Vec<String>, Vec<String>) = paths.into_iter().partition(|x| super::import_project::is_project_path(x));\n",
          "    let (project_paths, paths): (Vec<String>, Vec<String>) = paths.into_iter().partition(|x| super::import_project::is_project_path(x));\n"
          "    // Arcano: projeto do After (.aep/.aet): o painel do Arcano Motion abre (crate::arcano_aep).\n"
          "    let (aep_paths, mut paths): (Vec<String>, Vec<String>) = paths.into_iter().partition(|x| crate::arcano_aep::eh_aep(x));\n"
          "    if !aep_paths.is_empty() {\n"
          "        crate::arcano_aep::pedir(&aep_paths);\n"
          "        s.toast(\"Abrindo o projeto do After no painel do Arcano Motion…\".to_string());\n"
          "    }\n")


def fontes_pc(r):
    """Fontes do PC no editor de vídeo do navegador: antes de importar um PSD, pede ao painel (Arcano
    Conector) as fontes que o navegador não tem (arquivos/effectcraft-web-fontes.rs)."""
    copia(pathlib.Path(__file__).parent / "arquivos/effectcraft-web-fontes.rs", pathlib.Path(r) / "apps/effectcraft-web/src/arcano_fontes.rs")
    troca(r, "apps/effectcraft-web/src/lib.rs", "#[cfg(target_arch = \"wasm32\")]\npub mod api;\n",
          "#[cfg(target_arch = \"wasm32\")]\npub mod api;\n#[cfg(target_arch = \"wasm32\")]\npub mod arcano_fontes;\n")
    troca(r, "apps/effectcraft-web/Cargo.toml", "effectcraft-ui-egui = { workspace = true }\n",
          "effectcraft-ui-egui = { workspace = true }\neffectcraft-psd = { workspace = true }\neffectcraft-text = { workspace = true }\n")
    # o montar.js (painel) lê os pedidos de fonte pelo window.effectcraft.arcano
    troca(r, "apps/effectcraft-web/web/index.html", "      files: () => ec.files(),\n", "      arcano: ec,\n      files: () => ec.files(),\n")


def psd_fiel(r):
    """PSD no editor de vídeo igual ao editor de imagem (pedido do dono, 05/11/2026):
    - fonte: o PSD guarda o nome PostScript (`Dirtyline36Daysoftype2022-Regular`); o importador cortava
      no "-" e procurava uma família que não existe (`Dirtyline36Daysoftype2022`), caindo na Inter.
      Agora acha a fonte INSTALADA pelo nome PostScript (como o editor de imagem) e usa a família/estilo
      dela; sem a fonte, guarda o nome inteiro (acha sozinho quando a fonte for instalada);
    - texto com vários estilos (duas fontes na mesma linha): cada trecho com a sua fonte, tamanho e cor
      (antes o 1º estilo valia pro texto todo);
    - recorte (clipping) só dentro da camada base, como no Photoshop: virou matte de alfa da base. O
      "preservar transparência" usava tudo o que está embaixo e, em grupo atravessado, a textura do
      título virava um retângulo por cima da arte."""
    # Preenchimento (Fill) de camada de ajuste: no Photoshop age como a opacidade (Matiz/Saturação
    # com preenchimento 15% = efeito a 15%). Camada de ajuste não tem estilo, então entrava 100%.
    troca(r, "crates/engine/src/interchange/psd_import.rs",
          "    if pl.fill_opacity < 255 && layer.can_have_styles() {\n",
          "    if pl.fill_opacity < 255 && layer.switches.adjustment {\n"
          "        set_scalar(&mut layer, \"transform/opacity\", pl.opacity as f64 / 255.0 * pl.fill_opacity as f64 / 255.0 * 100.0);\n"
          "    }\n"
          "    if pl.fill_opacity < 255 && layer.can_have_styles() {\n")
    ed = "crates/psd/src/engine_data.rs"
    troca(r, ed, 'pub fn text_style(ed: &EValue) -> TextStyle {\n    let engine = ed.get("EngineDict").unwrap_or(ed);',
          'pub fn text_style(ed: &EValue) -> TextStyle {\n    text_style_at(ed, 0)\n}\n\n'
          '/// Arcano: os estilos de TODOS os trechos (tamanho em unidades UTF-16, como o Photoshop conta), na ordem.\n'
          'pub fn text_runs(ed: &EValue) -> Vec<(usize, TextStyle)> {\n'
          '    let engine = ed.get("EngineDict").unwrap_or(ed);\n'
          '    let Some(EValue::Array(lens)) = engine.path("StyleRun/RunLengthArray") else { return Vec::new() };\n'
          '    lens.iter().enumerate().filter_map(|(i, n)| Some((n.num()?.max(0.0) as usize, text_style_at(ed, i)))).collect()\n'
          '}\n\n'
          '/// Os atributos do trecho `i` (sem o atributo, vale o estilo normal do documento).\n'
          'pub fn text_style_at(ed: &EValue, i: usize) -> TextStyle {\n    let engine = ed.get("EngineDict").unwrap_or(ed);')
    troca(r, ed, '    let run = engine.path("StyleRun/RunArray/0/StyleSheet/StyleSheetData");',
          '    let run = engine.path(&format!("StyleRun/RunArray/{i}/StyleSheet/StyleSheetData"));')
    troca(r, "crates/psd/src/model.rs",
          "    /// Text bounds (left, top, right, bottom) relative to the origin, when stored.\n    pub bounds: Option<[f64; 4]>,\n}",
          "    /// Text bounds (left, top, right, bottom) relative to the origin, when stored.\n    pub bounds: Option<[f64; 4]>,\n"
          "    /// Arcano: cada trecho de estilo (tamanho em UTF-16, estilo), na ordem do texto.\n    pub runs: Vec<(usize, engine_data::TextStyle)>,\n}")
    troca(r, "crates/psd/src/parse.rs",
          '                let style = d.raw("EngineData").map(|e| engine_data::text_style(&engine_data::parse(e))).unwrap_or_default();',
          '                let ed = d.raw("EngineData").map(engine_data::parse);\n'
          '                let style = ed.as_ref().map(engine_data::text_style).unwrap_or_default();\n'
          '                let runs = ed.as_ref().map(engine_data::text_runs).unwrap_or_default();')
    troca(r, "crates/psd/src/parse.rs", "                l.text = Some(TextInfo { text, transform: t, style, bounds });",
          "                l.text = Some(TextInfo { text, transform: t, style, bounds, runs });")
    pi = "crates/engine/src/interchange/psd_import.rs"
    # Ajustes que o editor de vídeo deixava VAZIOS (camada de ajuste sem efeito): Equilíbrio de Cores,
    # Cor Seletiva e Pesquisa de Cores (o .cube que o PSD guarda dentro). Viram os efeitos do editor.
    troca(r, "crates/psd/src/model.rs", "    /// Another adjustment (its tagged-block key, e.g. `curv`, `blnc`).\n    Other(String),",
          "    /// Arcano: Equilíbrio de Cores (ciano-vermelho, magenta-verde, amarelo-azul: -100..100).\n"
          "    ColorBalance { shadows: [f64; 3], midtones: [f64; 3], highlights: [f64; 3], preserve: bool },\n"
          "    /// Arcano: Cor Seletiva (vermelhos, amarelos, verdes, cianos, azuis, magentas, brancos, neutros, pretos; C M Y K -100..100).\n"
          "    SelectiveColor { absolute: bool, ranges: [[f64; 4]; 9] },\n"
          "    /// Arcano: Pesquisa de Cores com o .cube guardado no PSD.\n"
          "    ColorLookup { cube: String },\n"
          "    /// Another adjustment (its tagged-block key, e.g. `curv`, `blnc`).\n    Other(String),")
    troca(r, "crates/psd/src/parse.rs",
          '            b"curv" | b"blnc" | b"post" | b"thrs" | b"selc" | b"mixr" | b"phfl" | b"vibA" | b"blwh" | b"grdm" | b"clrL" if l.adjustment.is_none() => {',
          '            b"blnc" => {\n'
          '                let mut tres = || -> Result<[f64; 3]> { Ok([f64::from(r.i16()?), f64::from(r.i16()?), f64::from(r.i16()?)]) };\n'
          '                let (shadows, midtones, highlights) = (tres()?, tres()?, tres()?);\n'
          '                let preserve = r.u8().map(|v| v != 0).unwrap_or(true);\n'
          '                l.adjustment = Some(Adjustment::ColorBalance { shadows, midtones, highlights, preserve });\n'
          '            }\n'
          '            b"selc" => {\n'
          '                let _ver = r.u16()?;\n'
          '                let absolute = r.u16()? == 1;\n'
          '                r.skip(8)?;\n'
          '                let mut ranges = [[0.0f64; 4]; 9];\n'
          '                for faixa in ranges.iter_mut() {\n'
          '                    for v in faixa.iter_mut() {\n'
          '                        *v = f64::from(r.i16()?);\n'
          '                    }\n'
          '                }\n'
          '                l.adjustment = Some(Adjustment::SelectiveColor { absolute, ranges });\n'
          '            }\n'
          '            b"clrL" => {\n'
          '                let _ver = r.u16()?;\n'
          '                let _dver = r.u32()?;\n'
          '                let d = descriptor::read_descriptor(&mut r)?;\n'
          '                let cube = d.raw("LUT3DFileData").map(|b| String::from_utf8_lossy(b).into_owned()).filter(|s| s.contains("LUT_3D_SIZE"));\n'
          '                l.adjustment = Some(match cube {\n'
          '                    Some(cube) => Adjustment::ColorLookup { cube },\n'
          '                    None => Adjustment::Other("clrL".into()),\n'
          '                });\n'
          '            }\n'
          '            b"curv" | b"post" | b"thrs" | b"mixr" | b"phfl" | b"vibA" | b"blwh" | b"grdm" if l.adjustment.is_none() => {')
    troca(r, pi, "        Adjustment::Other(k) => warnings.push(",
          "        Adjustment::ColorBalance { shadows, midtones, highlights, preserve } => {\n"
          "            let ids = [\"shadowRed\", \"shadowGreen\", \"shadowBlue\", \"midRed\", \"midGreen\", \"midBlue\", \"hiRed\", \"hiGreen\", \"hiBlue\"];\n"
          "            let vals: Vec<f64> = shadows.iter().chain(midtones.iter()).chain(highlights.iter()).copied().collect();\n"
          "            let mut p: Vec<(&str, Value)> = ids.iter().zip(vals).map(|(k, v)| (*k, Value::Scalar(v))).collect();\n"
          "            p.push((\"preserveLuminosity\", Value::Bool(*preserve)));\n"
          "            add_effect(proj, l, \"Color Balance\", comp, &p)\n"
          "        }\n"
          "        Adjustment::SelectiveColor { absolute, ranges } => {\n"
          "            const G: [&str; 9] = [\"reds\", \"yellows\", \"greens\", \"cyans\", \"blues\", \"magentas\", \"whites\", \"neutrals\", \"blacks\"];\n"
          "            const C: [&str; 4] = [\"Cyan\", \"Magenta\", \"Yellow\", \"Black\"];\n"
          "            let ids: Vec<String> = G.iter().flat_map(|g| C.iter().map(move |c| format!(\"details/{g}/{g}{c}\"))).collect();\n"
          "            let mut p: Vec<(&str, Value)> = vec![(\"method\", Value::Enum(u32::from(*absolute)))];\n"
          "            for (k, id) in ids.iter().enumerate() {\n"
          "                p.push((id.as_str(), Value::Scalar(ranges[k / 4][k % 4])));\n"
          "            }\n"
          "            add_effect(proj, l, \"Selective Color\", comp, &p)\n"
          "        }\n"
          "        Adjustment::ColorLookup { cube } => add_effect(proj, l, \"Apply Color LUT\", comp, &[(\"lut\", Value::Str(cube.clone()))]),\n"
          "        Adjustment::Other(k) => warnings.push(")
    troca(r, pi, "fn text_doc(t: &effectcraft_psd::TextInfo) -> TextDoc {",
          "/// Arcano: o nome PostScript do PSD → a família e o estilo da fonte INSTALADA (como o editor de\n"
          "/// imagem acha). Sem a fonte: o nome inteiro (acha sozinho quando for instalada).\n"
          "fn fonte_instalada(ps: &str) -> (String, String) {\n"
          "    let r = effectcraft_text::resolve(ps, \"\");\n"
          "    if r.missing {\n"
          "        return (ps.to_string(), String::new());\n"
          "    }\n"
          "    let f = effectcraft_text::fonts::face(r.face);\n"
          "    (f.info.family.clone(), f.info.style.clone())\n"
          "}\n\n"
          "/// Arcano: alguma fonte do texto não está instalada (no navegador, só as que vêm com o editor).\n"
          "fn fonte_faltando(t: &effectcraft_psd::TextInfo) -> bool {\n"
          "    t.style.font.iter().chain(t.runs.iter().filter_map(|(_, s)| s.font.as_ref())).any(|f| effectcraft_text::resolve(f, \"\").missing)\n"
          "}\n\n"
          "fn text_doc(t: &effectcraft_psd::TextInfo) -> TextDoc {")
    # Sem a fonte instalada: o texto entra como a imagem que o próprio PSD guarda (igual ao original, sem
    # editar), como o Photoshop mostra; com a fonte instalada, importar de novo traz o texto editável.
    troca(r, pi, "    } else if let Some(t) = &pl.text {\n        text_layer(proj, comp, &name, t)",
          "    } else if let Some(t) = pl.text.as_ref().filter(|t| !(fonte_faltando(t) && pl.has_pixels())) {\n        text_layer(proj, comp, &name, t)")
    troca(r, pi, "    if let Some(f) = &t.style.font {\n        let (fam, style) = font_names(f);\n        d.font = fam;\n        d.style = style;\n    }",
          "    if let Some(f) = &t.style.font {\n        let (fam, style) = fonte_instalada(f);\n        d.font = fam;\n        d.style = style;\n    }")
    troca(r, pi, "    d.faux_bold = t.style.faux_bold;\n    d.faux_italic = t.style.faux_italic;\n",
          "    d.faux_bold = t.style.faux_bold;\n    d.faux_italic = t.style.faux_italic;\n"
          "    // Arcano: cada trecho com a sua fonte, tamanho e cor (duas fontes na mesma linha, como no Photoshop).\n"
          "    if t.runs.len() > 1 {\n"
          "        let chars: Vec<char> = t.text.chars().collect();\n"
          "        let mut ci = 0usize;\n"
          "        for (len16, st) in &t.runs {\n"
          "            let ini = ci;\n"
          "            let mut n = 0usize;\n"
          "            while n < *len16 && ci < chars.len() {\n"
          "                n += chars[ci].len_utf16();\n"
          "                ci += 1;\n"
          "            }\n"
          "            if ci == ini {\n"
          "                continue;\n"
          "            }\n"
          "            let fonte = st.font.as_deref().map(fonte_instalada);\n"
          "            let tam = st.size.map(|s| s * scale).filter(|s| s.is_finite() && *s > 0.0);\n"
          "            d.apply_style(ini..ci, |c| {\n"
          "                if let Some((fam, sty)) = &fonte {\n"
          "                    c.font = fam.clone();\n"
          "                    c.style = sty.clone();\n"
          "                }\n"
          "                if let Some(s) = tam {\n"
          "                    c.size = s;\n"
          "                }\n"
          "                if let Some(k) = st.color {\n"
          "                    c.fill = [k[0] as f32, k[1] as f32, k[2] as f32, 1.0];\n"
          "                }\n"
          "                if let Some(tr) = st.tracking.filter(|v| v.is_finite()) {\n"
          "                    c.tracking = tr;\n"
          "                }\n"
          "                c.faux_bold = st.faux_bold;\n"
          "                c.faux_italic = st.faux_italic;\n"
          "            });\n"
          "        }\n"
          "    }\n")
    troca(r, pi, "    for n in nodes {\n        if let Some(l) = build_layer(proj, cx, &comp, n) {\n            comp.layers.push(l);\n        }\n    }\n    styles::sync_comp(&mut comp);",
          "    // Arcano: máscara de pixels de grupo/objeto inteligente/texto/ajuste = camada de máscara (mate de alfa)\n"
          "    let mut mates_de_mascara: Vec<effectcraft_project::LayerId> = Vec::new();\n"
          "    for n in nodes {\n        if let Some(mut l) = build_layer(proj, cx, &comp, n) {\n"
          "            if let Some(m) = mascara_psd(proj, cx, &comp, n, &mut l) {\n"
          "                mates_de_mascara.push(m.id);\n"
          "                comp.layers.push(m);\n"
          "            }\n"
          "            comp.layers.push(l);\n        }\n    }\n"
          "    // Arcano: recorte (clipping) = só dentro da camada base (a 1ª sem recorte abaixo), como no Photoshop.\n"
          "    let recortes: Vec<(usize, Option<(effectcraft_project::LayerId, bool)>)> = comp\n"
          "        .layers\n"
          "        .iter()\n"
          "        .enumerate()\n"
          "        .filter(|(_, l)| l.preserve_transparency)\n"
          "        .map(|(k, _)| (k, comp.layers.iter().skip(k + 1).find(|l| !l.preserve_transparency && !mates_de_mascara.contains(&l.id)).map(|b| (b.id, b.switches.video))))\n"
          "        .collect();\n"
          "    for (k, base) in recortes {\n"
          "        if let (Some((id, visivel)), Some(l)) = (base, comp.layers.get_mut(k)) {\n"
          "            l.track_matte = Some(effectcraft_project::TrackMatte { layer: id, kind: effectcraft_project::MatteKind::Alpha });\n"
          "            l.preserve_transparency = false;\n"
          "            if !visivel {\n"
          "                l.switches.video = false;\n"
          "            }\n"
          "        }\n"
          "    }\n"
          "    styles::sync_comp(&mut comp);")
    mascaras_psd(r)


def mascaras_psd(r):
    """Máscara de pixels (máscara de camada) em grupo (pré-composição), objeto inteligente, texto
    editável e camada de ajuste: antes era descartada (só a camada de pixels já vinha recortada).
    Agora vira uma camada de máscara escondida logo acima, usada como mate de alfa (footage do
    próprio PSD só com a máscara: SourceLayer.embedded = "arcano:mascara")."""
    pi = "crates/engine/src/interchange/psd_import.rs"
    troca(r, "crates/psd/src/pixels.rs",
          "    pub fn layer_pixels(&self, index: usize, canvas: bool) -> Result<Pixels> {\n",
          "    /// Arcano: só a máscara de pixels da camada (branco, alfa = máscara), no tamanho do documento.\n"
          "    pub fn layer_mask_pixels(&self, index: usize) -> Result<Pixels> {\n"
          "        let mut budget = Budget::new(DECODE_BUDGET);\n"
          "        let l = self.layers.get(index).ok_or_else(|| Error::Invalid(format!(\"no layer {index}\")))?;\n"
          "        let doc = Rect { top: 0, left: 0, bottom: self.height as i32, right: self.width as i32 };\n"
          "        let n = decode_pixels(self.width as usize, self.height as usize)?;\n"
          "        budget.check(16 * n as u64)?;\n"
          "        let mut out = budget.filled(n, [1.0f32; 4])?;\n"
          "        self.apply_layer_mask(l, doc, &mut out, &mut budget)?;\n"
          "        Ok(Pixels { width: self.width, height: self.height, data: out })\n"
          "    }\n\n"
          "    pub fn layer_pixels(&self, index: usize, canvas: bool) -> Result<Pixels> {\n")
    troca(r, "crates/media/src/layered.rs",
          "        // A smart object's embedded file: an embedded document's merged image, or an image.\n",
          "        // Arcano: a máscara de pixels de uma camada (mate de grupo/objeto inteligente/texto/ajuste).\n"
          "        if let Some(l) = footage.layer.as_ref()\n"
          "            && l.embedded.as_deref() == Some(\"arcano:mascara\")\n"
          "        {\n"
          "            let px = psd.layer_mask_pixels(l.index as usize).map_err(|e| MediaError::Decode(format!(\"{path}: {e}\")))?;\n"
          "            return Ok(Some(straight_to_image(px.width, px.height, &px.data, op)));\n"
          "        }\n"
          "        // A smart object's embedded file: an embedded document's merged image, or an image.\n")
    troca(r, "crates/media/src/pool.rs",
          "+ if l.embedded.is_some() { 1 << 40 } else { 0 })",
          "+ if l.embedded.is_some() { 1 << 40 } else { 0 } + if l.embedded.as_deref() == Some(\"arcano:mascara\") { 1 << 41 } else { 0 })")
    p = pathlib.Path(r) / pi
    p.write_text(p.read_text(encoding="utf-8") + MASCARA_PSD_RS, encoding="utf-8")


MASCARA_PSD_RS = """
/// Arcano: a máscara de pixels de uma camada que não vem recortada pelo PSD (grupo, objeto
/// inteligente, texto editável, ajuste): uma camada escondida com só a máscara, logo acima, e a
/// camada usa ela como mate de alfa. Camada de pixels já vem com a máscara aplicada.
fn mascara_psd(proj: &mut Project, cx: &mut Ctx, comp: &Comp, n: &Node, l: &mut Layer) -> Option<Layer> {
    let index = match n {
        Node::Layer(i) => *i,
        Node::Group { layer, .. } => *layer,
    };
    let pl = cx.psd.layers.get(index)?.clone();
    let m = pl.mask.filter(|m| !m.disabled)?;
    if m.rect.is_empty() || !pl.channels.iter().any(|c| c.id == -2) {
        return None;
    }
    let assada = match l.source {
        LayerSource::Footage { item } => {
            matches!(proj.item(item).map(|i| &i.kind), Some(ItemKind::Footage(f)) if f.layer.as_ref().is_some_and(|s| s.embedded.is_none()))
        }
        _ => false,
    };
    if assada {
        return None;
    }
    let nome = if pl.name.is_empty() { format!("Layer {}", index + 1) } else { pl.name.clone() };
    if l.track_matte.is_some() || l.preserve_transparency {
        cx.warnings.push(format!("{nome}: máscara de camada junto com recorte (só o recorte entrou)"));
        return None;
    }
    let file = std::path::Path::new(cx.path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let f = Footage {
        path: cx.path.to_string(),
        kind: FootageKind::Still,
        width: cx.psd.width,
        height: cx.psd.height,
        pixel_aspect: 1.0,
        frame_rate: cx.rate,
        native_rate: None,
        duration: Tick::ZERO,
        has_video: true,
        has_audio: false,
        alpha: AlphaMode::Straight,
        premul_color: [0.0; 3],
        loop_count: 1,
        codec: "PSD".into(),
        missing: false,
        sequence: vec![],
        color_profile: None,
        layer: Some(SourceLayer { index: index as u32, name: pl.name.clone(), layer_size: false, embedded: Some("arcano:mascara".into()), placed: false }),
        ..Default::default()
    };
    let item = proj.add_item(&format!("{nome} (máscara)/{file}"), Label::Lavender, Some(cx.folder), ItemKind::Footage(f));
    cx.items.push(item);
    // Grupo "atravessar" (pass-through): as camadas dele se misturam com o que está embaixo; um mate
    // no grupo inteiro isolaria o grupo (os modos Tela/Adição viravam mancha). A máscara vai DENTRO,
    // em cada camada do grupo.
    if let LayerSource::Comp { item: sub } = l.source
        && l.switches.collapse
    {
        let base = match proj.item(sub).map(|i| &i.kind) {
            Some(ItemKind::Comp(c)) => (**c).clone(),
            _ => return None,
        };
        let mut ml = build::layer(proj, &base, &format!("{nome} · máscara"), LayerSource::Footage { item }, (cx.psd.width, cx.psd.height), None);
        ml.switches.video = false;
        let id = ml.id;
        if let Some(it) = proj.item_mut(sub)
            && let ItemKind::Comp(c) = &mut it.kind
        {
            let c = Arc::make_mut(c);
            for f in c.layers.iter_mut() {
                if f.track_matte.is_none() {
                    f.track_matte = Some(effectcraft_project::TrackMatte { layer: id, kind: effectcraft_project::MatteKind::Alpha });
                }
            }
            c.layers.insert(0, ml);
        }
        return None;
    }
    let mut ml = build::layer(proj, comp, &format!("{nome} · máscara"), LayerSource::Footage { item }, (cx.psd.width, cx.psd.height), None);
    ml.switches.video = false;
    l.track_matte = Some(effectcraft_project::TrackMatte { layer: ml.id, kind: effectcraft_project::MatteKind::Alpha });
    Some(ml)
}
"""


def painel_pc_video(r):
    """Programa de PC (vídeo): o painel do Arcano Motion (o MESMO do After) DENTRO do programa, numa
    aba da doca acima do Preview (como um painel CEP), mostrado por um WebView do sistema
    (painel_arcano.rs). O painel manda os scripts pelo Arcano Conector para o canal local do
    programa (127.0.0.1:47890). O programa só libera depois do login do ArcanoApp."""
    arq = pathlib.Path(__file__).parent / "arquivos"
    m = "apps/effectcraft/src/main.rs"
    troca(r, m, "            if let Some(port) = control_port {\n                disable_app_nap();",
          "            if let Some(port) = control_port.or_else(|| Some(painel_arcano::porta_livre(\"video\", ARCANO_PORTA))) {\n                disable_app_nap();")
    troca(r, m, "/// Driven by an agent (`--control`): don't activate the app on launch",
          "/// Canal do painel do Arcano Motion (o conector manda os scripts por aqui).\nconst ARCANO_PORTA: u16 = 47890;\n\n"
          "/// Driven by an agent (`--control`): don't activate the app on launch")
    # o painel dentro da janela + a trava de login
    copia(arq / "painel_arcano.rs", pathlib.Path(r) / "apps/effectcraft/src/painel_arcano.rs")
    troca(r, m, "mod control_server;", "mod atualizador_arcano;\nmod control_server;\nmod painel_arcano;")
    copia(arq / "atualizador_arcano.rs", pathlib.Path(r) / "apps/effectcraft/src/atualizador_arcano.rs")
    troca(r, "apps/effectcraft/Cargo.toml", "serde_json = { workspace = true }\n", "serde_json = { workspace = true }\nureq = \"3\"\n")
    troca(r, m, "    /// The first frame was drawn (logged once).\n    drawn: bool,\n}",
          "    /// The first frame was drawn (logged once).\n    drawn: bool,\n    /// O painel do Arcano Motion dentro da janela.\n    painel: painel_arcano::Painel,\n    /// Atualização pelo próprio programa.\n    atualizador: atualizador_arcano::Atualizador,\n}")
    troca(r, m, "                launch,\n                drawn: false,\n            }))",
          "                launch,\n                drawn: false,\n                painel: painel_arcano::Painel::new(\"video\"),\n                atualizador: atualizador_arcano::Atualizador::new(\"video\"),\n            }))")
    # fechar o programa: solta o painel e garante que o processo termina
    troca(r, m, "        let _ = self.app.session.execute(\"file.runShutdownScripts\", json!({}));\n",
          "        let _ = self.app.session.execute(\"file.runShutdownScripts\", json!({}));\n        self.painel.sair();\n")
    troca(r, m, "    fn ui(&mut self, ui: &mut egui::Ui, frame: &mut eframe::Frame) {\n        self.app.ui(ui, frame);\n",
          "    fn ui(&mut self, ui: &mut egui::Ui, frame: &mut eframe::Frame) {\n        self.app.ui(ui, frame);\n"
          "        let lugar = effectcraft_ui_egui::arcano_painel::lugar(ui.ctx());\n"
          "        self.painel.quadro(ui.ctx(), frame, lugar);\n"
          "        for aep in effectcraft_engine::arcano_aep::pendentes() {\n"
          "            match painel_arcano::aep_para_painel(&aep) {\n"
          "                Some(recado) => self.painel.mandar(&recado),\n"
          "                None => self.app.ui.status = format!(\"Não consegui abrir o projeto do After {aep}\"),\n"
          "            }\n"
          "        }\n"
          "        self.painel.trava(ui.ctx(), \"Arcano Motion\");\n"
          "        self.atualizador.quadro(ui.ctx(), \"Arcano Layers Vídeo\");\n")
    p = pathlib.Path(r) / "apps/effectcraft/Cargo.toml"
    p.write_text(p.read_text(encoding="utf-8") + '\n[target.\'cfg(any(windows, target_os = "macos"))\'.dependencies]\nwry = "0.57"\n', encoding="utf-8")
    # a aba "Arcano Motion" da doca (no lugar do VR Comp Editor), acima do Preview no layout padrão
    copia(arq / "ui-arcano-painel.rs", pathlib.Path(r) / "crates/ui-egui/src/arcano_painel.rs")
    troca(r, "crates/ui-egui/src/lib.rs", "pub mod control;\n", "pub mod arcano_painel;\npub mod control;\n")
    troca(r, "crates/ui-egui/src/panels.rs", "        PanelKind::VrCompEditor => path_vr_panels::vr_editor(app, ui, rect),",
          "        PanelKind::VrCompEditor => {\n            let _ = &app;\n            crate::arcano_painel::reservar(ui, rect)\n        }")
    troca(r, "crates/ui-egui/src/dock.rs", '            PanelKind::VrCompEditor => "VR Comp Editor",', '            PanelKind::VrCompEditor => "Arcano Motion",')
    troca(r, "crates/ui-egui/src/dock.rs",
          "        _ => hsplit(\n            FixedSecond(300.0),\n            vsplit(\n                Ratio(0.56),\n                hsplit(FixedFirst(300.0), tabs(&[Project, EffectControls], 0), tabs(&[Composition, Layer], 0)),\n                tabs(&[Timeline, RenderQueue], 0),\n            ),\n            vsplit(FixedFirst(PREVIEW_FRAME), tabs(&[Preview], 0), tabs(&[Properties, Align, Audio, EffectsPresets], 0)),\n        ),",
          "        _ => hsplit(\n            FixedSecond(420.0),\n            vsplit(\n                Ratio(0.56),\n                hsplit(FixedFirst(300.0), tabs(&[Project, EffectControls], 0), tabs(&[Composition, Layer], 0)),\n                tabs(&[Timeline, RenderQueue], 0),\n            ),\n            vsplit(\n                Ratio(0.62),\n                tabs(&[VrCompEditor], 0),\n                vsplit(FixedFirst(PREVIEW_FRAME), tabs(&[Preview], 0), tabs(&[Properties, Align, Audio, EffectsPresets], 0)),\n            ),\n        ),")
    # layout novo para quem já abriu o programa (o salvo não tem a aba do Arcano)
    troca(r, "crates/ui-egui/src/lib.rs", 'pub const WORKSPACES_FILE: &str = "workspaces.json";', 'pub const WORKSPACES_FILE: &str = "workspaces-arcano.json";')
    troca(r, "crates/ui-egui/src/workspace_state.rs", 'const FILE: &str = "workspaces.json";', 'const FILE: &str = "workspaces-arcano.json";')


def painel_pc_imagem(r):
    """Programa de PC (imagem): o painel do Arcano Design abre numa janela do Chrome/Edge e fala com o
    programa pelo canal de controle dele (127.0.0.1:47891), que pede a senha (token) guardada em
    ArcanoDesign/controle.token na pasta do usuário (o conector lê de lá)."""
    m = "apps/photocraft/src/main.rs"
    troca(r, m, "    let control = control_setup(control_port, auth, &automation);",
          "    let (auth, automation) = arcano_controle(control_port, auth, automation);\n"
          "    let control = control_setup(control_port.or_else(|| Some(painel_arcano::porta_livre(\"imagem\", ARCANO_PORTA))), auth, &automation);")
    troca(r, m, """        Err(error) => {
            eprintln!("photocraft: control server failed to bind 127.0.0.1:{port}: {error}");
            std::process::exit(2);
        }""", """        Err(error) => {
            eprintln!("photocraft: control server failed to bind 127.0.0.1:{port}: {error}");
            if port == ARCANO_PORTA {
                return None;
            }
            std::process::exit(2);
        }""")
    troca(r, m, "/// The control server's port, token and workspace, when it is on (exits 2 on a bad configuration).",
          """/// Canal do painel do Arcano Design (o conector conversa com o programa por aqui, com senha).
const ARCANO_PORTA: u16 = 47891;

/// O token do canal do painel (ArcanoDesign/controle.token, criado na 1ª vez) e as pastas que o
/// painel pode abrir/gravar pelo canal, quando nada disso veio na linha de comando.
fn arcano_controle(
    cli_port: Option<u16>,
    mut auth: photocraft_automation::args::ControlArgs,
    mut automation: photocraft_automation::args::AutomationArgs,
) -> (photocraft_automation::args::ControlArgs, photocraft_automation::args::AutomationArgs) {
    if cli_port.is_some() {
        return (auth, automation);
    }
    let casa = std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(std::path::PathBuf::from);
    let pasta = if cfg!(windows) {
        std::env::var_os("APPDATA").map(std::path::PathBuf::from).map(|p| p.join("ArcanoDesign"))
    } else if cfg!(target_os = "macos") {
        casa.clone().map(|p| p.join("Library/Application Support/ArcanoDesign"))
    } else {
        casa.clone().map(|p| p.join(".arcanodesign"))
    };
    if auth.control_token.is_none() && auth.control_token_file.is_none()
        && let Some(pasta) = pasta
        && std::fs::create_dir_all(&pasta).is_ok()
    {
        auth.control_token_file = Some(pasta.join("controle.token"));
    }
    let raiz = if cfg!(windows) {
        std::path::PathBuf::from(format!("{}\\\\", std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into())))
    } else {
        std::path::PathBuf::from("/")
    };
    if automation.automation_read_root.is_none() {
        automation.automation_read_root = Some(raiz.clone());
    }
    if automation.automation_write_root.is_none() {
        automation.automation_write_root = Some(raiz);
    }
    (auth, automation)
}

/// The control server's port, token and workspace, when it is on (exits 2 on a bad configuration).""")
    # O painel dentro da janela (coluna à direita) + a trava de login.
    arq = pathlib.Path(__file__).parent / "arquivos"
    copia(arq / "painel_arcano.rs", pathlib.Path(r) / "apps/photocraft/src/painel_arcano.rs")
    copia(arq / "photocraft-host-arcano.rs", pathlib.Path(r) / "apps/photocraft/src/host_arcano.rs")
    troca(r, m, "mod app_dirs;", "mod app_dirs;\nmod atualizador_arcano;\nmod host_arcano;\nmod painel_arcano;")
    copia(arq / "atualizador_arcano.rs", pathlib.Path(r) / "apps/photocraft/src/atualizador_arcano.rs")
    troca(r, "apps/photocraft/Cargo.toml", "serde_json = { workspace = true }\n", "serde_json = { workspace = true }\nureq = \"3\"\n")
    troca(r, m, "            Ok(Box::new(app))\n        }),", "            Ok(Box::new(host_arcano::Host::new(app)))\n        }),")
    # barra de título do sistema (a do editor ficaria embaixo da coluna do painel)
    troca(r, m, "    CUSTOM_TITLEBAR && !prefs.interface.system_title_bar\n}", "    let _ = (CUSTOM_TITLEBAR, prefs.interface.system_title_bar);\n    false\n}")
    p = pathlib.Path(r) / "apps/photocraft/Cargo.toml"
    p.write_text(p.read_text(encoding="utf-8") + '\n[target.\'cfg(any(windows, target_os = "macos"))\'.dependencies]\nwry = "0.57"\n', encoding="utf-8")


def hd_trabalho(r):
    """Programa de PC (vídeo): Editar ▸ HD de trabalho… escolhe o HD do cache da prévia, do cache
    de mídia e do áudio convertido (os três de uma vez); abre sozinha quando o HD do cache está
    quase cheio (arquivos/ui-arcano-hd.rs). No navegador o cache fica no próprio navegador."""
    copia(pathlib.Path(__file__).parent / "arquivos/ui-arcano-hd.rs", pathlib.Path(r) / "crates/ui-egui/src/arcano_hd.rs")
    troca(r, "crates/ui-egui/src/lib.rs", "pub mod arcano_carregando;\n", "pub mod arcano_carregando;\npub mod arcano_hd;\n")
    troca(r, "crates/ui-egui/src/app/frame.rs", "        crate::arcano_carregando::quadro(self, &ctx);\n",
          "        crate::arcano_carregando::quadro(self, &ctx);\n        crate::arcano_hd::quadro(self, &ctx);\n")
    troca(r, "crates/ui-egui/src/menus/invoke.rs", "    if crate::arcano_carregando::adiar(id, &params) {\n",
          "    if id == \"arcano.hdTrabalho\" {\n        crate::arcano_hd::abrir();\n        ctx.request_repaint();\n        return Ok(Value::Null);\n    }\n"
          "    if crate::arcano_carregando::adiar(id, &params) {\n")
    troca(r, "crates/ui-egui/src/menus/entries.rs", '    if e.command == "window.panel" {\n',
          '    if e.command == "arcano.hdTrabalho" {\n        return true;\n    }\n    if e.command == "window.panel" {\n')
    troca(r, "crates/engine/src/menus.rs", '    Snapshot | edit.purge {"what":"snapshot"} | Cmd+Shift+F5\n',
          '    Snapshot | edit.purge {"what":"snapshot"} | Cmd+Shift+F5\n  HD de trabalho (cache)... | arcano.hdTrabalho\n')


def desktop(app, raiz):
    """Versão para instalar no PC: ícones do Arcano e nome Arcano Layers também nas partes
    que só existem no programa de computador (janela, diálogos)."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent))
    import icones
    nomes = (("EffectCraft", None), ("PhotoCraft", None), ("ArtCraft", "ArcanoApp"), ("getartcraft.com", "arcanoapp.voxvisual.com.br"))
    if app == "effectcraft":
        icones.gerar("video", pathlib.Path(raiz) / "assets/app-icon", "effectcraft", "ai.storyteller.effectcraft")
        painel_pc_video(raiz)
        hd_trabalho(raiz)
        # Sem o atualizador do programa original (baixaria a versão deles, com o nome deles): quem atualiza somos nós.
        troca(raiz, "apps/effectcraft/src/main.rs", "            app.set_startup_update_check(true);", "            app.set_startup_update_check(false);")
        troca(raiz, "crates/ui-egui/src/menus/frontend.rs", "            crate::updates_ui::check(app);\n            Value::Null", "            let _ = &app;\n            Value::Null")
        # Nome gravado no .exe (Gerenciador de Tarefas, barra de tarefas, propriedades do arquivo).
        troca(raiz, "apps/effectcraft/build.rs", '.set("ProductName", "EffectCraft")', f'.set("ProductName", "{NOME} Vídeo")')
        troca(raiz, "apps/effectcraft/build.rs", '.set("FileDescription", "EffectCraft motion graphics and visual effects")', f'.set("FileDescription", "{NOME} Vídeo")')
        nomes_restantes(raiz, pastas=("apps/effectcraft/src",), nomes=nomes)
    else:
        icones.gerar("imagem", pathlib.Path(raiz) / "assets/app-icon", "photocraft", "ai.storyteller.photocraft")
        painel_pc_imagem(raiz)
        # Sem o atualizador do programa original (quem atualiza somos nós).
        troca(raiz, "apps/photocraft/src/services.rs", "        check_updates: Some(crate::updates::service()),", "        check_updates: None,")
        # Nome gravado no .exe (Gerenciador de Tarefas, barra de tarefas, propriedades do arquivo).
        troca(raiz, "apps/photocraft/build.rs", '.set("ProductName", "PhotoCraft")', f'.set("ProductName", "{NOME} Imagem")')
        troca(raiz, "apps/photocraft/build.rs", '.set("FileDescription", "PhotoCraft image editor")', f'.set("FileDescription", "{NOME} Imagem")')
        troca(raiz, "apps/photocraft/build.rs", '.set("CompanyName", "Learning Machines LLC")', '.set("CompanyName", "ArcanoApp")')
        nomes_restantes(raiz, pastas=("apps/photocraft/src",), nomes=nomes)


if __name__ == "__main__":
    app, raiz = sys.argv[1], sys.argv[2]
    {"photocraft": photocraft, "effectcraft": effectcraft}[app](raiz)
    if "--desktop" in sys.argv[3:]:
        desktop(app, raiz)
    print("patches aplicados:", app)
