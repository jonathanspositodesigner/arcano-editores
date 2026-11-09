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
    salvar_aep(r)
    pacote_e_ausentes(r)
    gpu_que_volta(r)
    coletar_arquivos(r)
    psd_uma_vez(r)
    gpu_camadas(r)
    guarda_crate(r)
    render_rapido(r)
    previa_guardada(r)
    destino_navegador(r)
    worker_que_tenta_de_novo(r)
    worker_com_memoria_de_navegador(r)
    caminho_do_navegador(r)
    desfoque_3d_navegador(r)
    imagem_grande_navegador(r)
    ladrilho_navegador(r)
    tempo_real(r)
    render_simples(r)
    # render_gpu_propria(r): DESLIGADO (05/11, pedido do dono): a 2ª GPU só do render enchia a memória de
    # vídeo da RTX 3050, o render caía para o processador no meio e ficava lento. O render volta a usar a
    # GPU da janela (como no original); a memória fixa menor (memoria_video) é o que evita o Out of Memory.
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
    # 06/11: o registro do dono mostrou o cache de camadas CHEIO nos 768 MB e "Out of Memory" logo em
    # seguida (RTX 3050). O cache da GPU é um espelho do cache de camadas da RAM: guarda textura de
    # toda camada viva; a camada que sai dele só sobe de novo (2 MB cada num 1/4 de 1080p, barato).
    # Menos memória fixa na placa, mais folga pro resto (janela, WebView do painel, outros programas).
    troca(r, ctx, "const UPLOAD_BUDGET: usize = 1536 << 20;", "const UPLOAD_BUDGET: usize = 384 << 20;")
    troca(r, ctx, "const POOL_BUDGET: usize = 768 << 20;", "const POOL_BUDGET: usize = 256 << 20;")
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
    """Prévia: cache quando ocioso ligado por padrão (parado, o editor já vai renderizando a área de
    trabalho por trás). O "som segue sem imagem" (05/11) foi desfeito a pedido do dono: a prévia volta
    a esperar o quadro, como antes."""
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


def salvar_aep(r):
    """Arquivo ▸ Salvar como projeto do After (.aep) (navegador e PC): o editor guarda o pedido; o painel
    do Arcano Motion lê o projeto (script no modelo do After) e grava o .aep com o py-aep. PC: a pessoa
    escolhe onde salvar aqui e o programa grava o que o painel devolve; navegador: vai para os Downloads."""
    troca(r, "crates/engine/src/menus.rs", "    Save a Copy As XML... | file.saveCopyAsXml\n",
          "    Save a Copy As XML... | file.saveCopyAsXml\n  Salvar como projeto do After (.aep)... | arcano.salvarAep\n")
    troca(r, "crates/ui-egui/src/menus/entries.rs", '    if e.command == "window.panel" {\n',
          '    if e.command == "arcano.salvarAep" {\n        return true;\n    }\n    if e.command == "window.panel" {\n')
    troca(r, "crates/ui-egui/src/menus/invoke.rs", "    if crate::arcano_carregando::adiar(id, &params) {\n",
          "    if id == \"arcano.salvarAep\" {\n"
          "        let caminho_atual = app.session.path.clone();\n"
          "        let nome = caminho_atual.as_deref().and_then(|p| std::path::Path::new(p).file_stem().map(|s| s.to_string_lossy().to_string())).unwrap_or_else(|| \"Projeto\".into());\n"
          "        let mut pedido = serde_json::json!({\"tipo\": \"salvar-aep\", \"nome\": nome});\n"
          "        if !cfg!(target_arch = \"wasm32\") {\n"
          "            let padrao = caminho_atual.as_deref().map(|p| std::path::Path::new(p).with_extension(\"aep\").to_string_lossy().to_string()).unwrap_or_else(|| format!(\"{nome}.aep\"));\n"
          "            match app.hooks.save_dialog(&padrao) {\n"
          "                Some(Some(c)) => {\n"
          "                    let c = if c.to_ascii_lowercase().ends_with(\".aep\") { c } else { format!(\"{c}.aep\") };\n"
          "                    pedido[\"caminho\"] = serde_json::json!(c);\n"
          "                }\n"
          "                Some(None) => return Ok(Value::Null),\n"
          "                None => {}\n"
          "            }\n"
          "        }\n"
          "        effectcraft_engine::arcano_aep::pedir_salvar(pedido.to_string());\n"
          "        app.session.toast(\"Salvando como projeto do After pelo painel do Arcano Motion…\");\n"
          "        ctx.request_repaint();\n"
          "        return Ok(Value::Null);\n"
          "    }\n"
          "    if crate::arcano_carregando::adiar(id, &params) {\n")


def pacote_e_ausentes(r):
    """Projeto com os ARQUIVOS DENTRO, igual ao PSD, e aviso de ARQUIVOS AUSENTES igual ao After
    (pedido do dono, 05/11/2026). arquivos/engine-arcano-pacote.rs: Salvar grava o .ecproj como
    pacote (zip sem compressão, zip64) com vídeos, imagens, áudios e fontes; Abrir tira de dentro
    (ou usa o original, se ainda está igual). arquivos/ui-arcano-ausentes.rs: janela com o que
    falta. O que falta aparece com barras coloridas (antes sumia sem aviso)."""
    copia(pathlib.Path(__file__).parent / "arquivos/engine-arcano-pacote.rs", pathlib.Path(r) / "crates/engine/src/arcano_pacote.rs")
    troca(r, "crates/engine/src/lib.rs", "pub mod arcano_aep;\n", "pub mod arcano_aep;\npub mod arcano_pacote;\n")
    # Abrir: pacote → texto do projeto com as mídias fora
    troca(r, "crates/engine/src/cmd/file.rs",
          '    let bytes = s.services.read_file(path).map_err(|e| EngineError::Other(format!("cannot read {path}: {e}")))?;\n'
          '    let text = String::from_utf8(bytes).map_err(|_| EngineError::Other("not a text project file".into()))?;\n',
          '    // Arcano: projeto com os arquivos dentro (crate::arcano_pacote)\n'
          '    let text = match crate::arcano_pacote::abrir(s, path) {\n'
          '        Some(t) => t?,\n'
          '        None => {\n'
          '            let bytes = s.services.read_file(path).map_err(|e| EngineError::Other(format!("cannot read {path}: {e}")))?;\n'
          '            String::from_utf8(bytes).map_err(|_| EngineError::Other("not a text project file".into()))?\n'
          '        }\n'
          '    };\n')
    # Salvar (Salvar, Salvar como, Incrementar e salvar): pacote
    troca(r, "crates/engine/src/cmd/file.rs",
          "fn save_to(s: &mut Session, path: &str) -> Result<Value> {\n",
          "fn save_to(s: &mut Session, path: &str) -> Result<Value> {\n"
          "    // Arcano: o .ecproj leva os arquivos dentro, igual ao PSD (crate::arcano_pacote)\n"
          "    if crate::arcano_pacote::empacotar(path) {\n"
          "        return crate::arcano_pacote::salvar(s, path);\n"
          "    }\n")
    # Importar projeto (Arquivo ▸ Importar um .ecproj): também lê o pacote
    troca(r, "crates/engine/src/cmd/import_project.rs",
          '    let bytes = s.services.read_file(path).map_err(|e| EngineError::Other(format!("cannot read {path}: {e}")))?;\n'
          '    let text = String::from_utf8(bytes).map_err(|_| bad(C, format!("{path} is not a text project file")))?;\n',
          '    let text = match crate::arcano_pacote::abrir(s, path) {\n'
          '        Some(t) => t?,\n'
          '        None => {\n'
          '            let bytes = s.services.read_file(path).map_err(|e| EngineError::Other(format!("cannot read {path}: {e}")))?;\n'
          '            String::from_utf8(bytes).map_err(|_| bad(C, format!("{path} is not a text project file")))?\n'
          '        }\n'
          '    };\n')
    # O que falta aparece com as barras coloridas, como no After (antes não aparecia nada)
    troca(r, "crates/media/src/pool.rs",
          "    fn frame_sized(&self, _item: ItemId, footage: &Footage, t: Tick, size: Option<(u32, u32)>, float: FloatCurve) -> Option<Arc<Image>> {\n"
          "        if footage.missing {\n"
          "            return None;\n"
          "        }\n",
          "    fn frame_sized(&self, _item: ItemId, footage: &Footage, t: Tick, size: Option<(u32, u32)>, float: FloatCurve) -> Option<Arc<Image>> {\n"
          "        if footage.missing {\n"
          "            // Arcano: arquivo ausente = barras coloridas, como no After Effects (antes sumia calado)\n"
          "            if !footage.has_video {\n"
          "                return None;\n"
          "            }\n"
          "            let (w, h) = size.unwrap_or((footage.width, footage.height));\n"
          "            return Some(barras_de_ausente(w, h));\n"
          "        }\n")
    troca(r, "crates/media/src/pool.rs",
          "#[derive(Clone, PartialEq, Eq, Hash)]\nstruct Key {\n",
          "/// Arcano: as barras do arquivo ausente, guardadas por tamanho (não refaz a cada quadro).\n"
          "fn barras_de_ausente(w: u32, h: u32) -> Arc<Image> {\n"
          "    static GUARDADAS: std::sync::Mutex<Vec<((u32, u32), Arc<Image>)>> = std::sync::Mutex::new(Vec::new());\n"
          "    let mut g = GUARDADAS.lock().unwrap_or_else(std::sync::PoisonError::into_inner);\n"
          "    if let Some((_, i)) = g.iter().find(|(k, _)| *k == (w, h)) {\n"
          "        return i.clone();\n"
          "    }\n"
          "    let i = Arc::new(colour_bars(w, h));\n"
          "    if g.len() >= 4 {\n"
          "        g.remove(0);\n"
          "    }\n"
          "    g.push(((w, h), i.clone()));\n"
          "    i\n"
          "}\n"
          "#[derive(Clone, PartialEq, Eq, Hash)]\nstruct Key {\n")
    troca(r, "crates/engine/src/footage/footage_check.rs",
          's.toast(format!("{missing} footage item(s) missing (File ▸ Dependencies ▸ Relink Missing Footage…)"));',
          's.toast(format!("{missing} arquivo(s) ausente(s): aparecem com barras coloridas até você localizar."));')
    # Navegador: confere os arquivos ao abrir projeto (no PC já conferia)
    # teste do psd_import: o TextInfo ganhou `runs` (psd_fiel) e o teste não compilava
    troca(r, "crates/engine/src/interchange/psd_import.rs",
          "            bounds: Some([0.0, 0.0, f64::INFINITY, 1.0]),\n        };\n",
          "            bounds: Some([0.0, 0.0, f64::INFINITY, 1.0]),\n            runs: Vec::new(),\n        };\n")
    troca(r, "apps/effectcraft-web/src/app.rs",
          "                let mut session = session();\n                session.load_settings();\n",
          "                let mut session = session();\n                // Arcano: ao abrir projeto, confere se os arquivos estão aqui (aviso de ausentes)\n                session.check_footage_on_open = true;\n                session.load_settings();\n")
    # A janela de ausentes
    copia(pathlib.Path(__file__).parent / "arquivos/ui-arcano-ausentes.rs", pathlib.Path(r) / "crates/ui-egui/src/arcano_ausentes.rs")
    troca(r, "crates/ui-egui/src/lib.rs", "pub mod arcano_carregando;\n", "pub mod arcano_ausentes;\npub mod arcano_carregando;\n")
    troca(r, "crates/ui-egui/src/app/frame.rs", "        crate::arcano_carregando::quadro(self, &ctx);\n",
          "        crate::arcano_carregando::quadro(self, &ctx);\n        crate::arcano_ausentes::quadro(self, &ctx);\n")


def gpu_que_volta(r):
    """Prévia travando (dono, 06/11/2026: "carrega um pouquinho e fica horas travado, no 1/4"):
    qualquer tropeço da placa (Out of Memory, leitura da GPU que passou de 10 s) APOSENTAVA o
    compositor da GPU pelo resto da sessão e a prévia virava só processador. Agora: (1) leitura
    que demora não aposenta mais a placa: só aquela leitura falha (o quadro vai pelo processador) e
    o prazo é 45 s; (2) a GPU volta sozinha depois de cair (arquivos/ui-arcano-gpu.rs), com metade
    da memória de camadas a cada volta."""
    rb = "crates/gpu/src/readback.rs"
    troca(r, rb, "pub(crate) const TIMEOUT: Duration = Duration::from_secs(10);", "pub(crate) const TIMEOUT: Duration = Duration::from_secs(45);")
    troca(r, rb,
          "    if s.retired.is_some() || !s.pending.values().any(|e| now >= e.deadline) {\n"
          "        return None;\n"
          "    }\n"
          "    s.retired = Some(TIMED_OUT.to_string());\n"
          "    Some(std::mem::take(&mut s.pending).into_values().collect())\n",
          "    if s.retired.is_some() || !s.pending.values().any(|e| now >= e.deadline) {\n"
          "        return None;\n"
          "    }\n"
          "    // Arcano: a leitura que passou do prazo falha sozinha (o quadro vai pelo processador);\n"
          "    // a placa continua em uso. Antes aposentava o compositor inteiro pela sessão.\n"
          "    let vencidas: Vec<u64> = s.pending.iter().filter(|(_, e)| now >= e.deadline).map(|(id, _)| *id).collect();\n"
          "    Some(vencidas.into_iter().filter_map(|id| s.pending.remove(&id)).collect())\n")
    # os testes do prazo esperavam a aposentadoria: agora a placa continua viva
    troca(r, rb, "        assert!(me.check().is_err());\n", "        assert!(me.check().is_ok());\n", todas=True)
    # a ponte de falha limpa (para a volta) e o spawn/attach ficam visíveis ao módulo novo
    troca(r, "crates/ui-egui/src/gpu_failure.rs",
          "    pub fn failure(&self) -> Option<GpuFailure> {\n",
          "    /// Arcano: esquece a falha (a placa continua viva) para montar o compositor de novo.\n"
          "    pub fn clear(&self) {\n"
          "        self.state.lock().unwrap_or_else(std::sync::PoisonError::into_inner).failure = None;\n"
          "    }\n"
          "    pub fn failure(&self) -> Option<GpuFailure> {\n")
    g = "crates/ui-egui/src/app/gpu.rs"
    troca(r, g, "    fn spawn_gpu_build(&mut self, ctx: &egui::Context, rs: &eframe::egui_wgpu::RenderState) -> bool {",
          "    pub(crate) fn spawn_gpu_build(&mut self, ctx: &egui::Context, rs: &eframe::egui_wgpu::RenderState) -> bool {")
    troca(r, g, "    fn attach_gpu(&mut self, built: GpuBuild, rs: Option<&eframe::egui_wgpu::RenderState>) {",
          "    pub(crate) fn attach_gpu(&mut self, built: GpuBuild, rs: Option<&eframe::egui_wgpu::RenderState>) {")
    troca(r, g,
          "                log::info!(\"GPU compositor: {}\", effectcraft_engine::render::Accelerator::name(&g));\n",
          "                log::info!(\"GPU compositor: {}\", effectcraft_engine::render::Accelerator::name(&g));\n"
          "                crate::arcano_gpu::ajustar(&g);\n")
    copia(pathlib.Path(__file__).parent / "arquivos/ui-arcano-gpu.rs", pathlib.Path(r) / "crates/ui-egui/src/arcano_gpu.rs")
    troca(r, "crates/ui-egui/src/lib.rs", "pub mod arcano_carregando;\n", "pub mod arcano_carregando;\npub mod arcano_gpu;\n")
    troca(r, "crates/ui-egui/src/app/frame.rs",
          "        self.init_gpu(ctx, frame);\n        self.apply_gpu_failure(ctx);\n",
          "        self.init_gpu(ctx, frame);\n        self.apply_gpu_failure(ctx);\n"
          "        #[cfg(not(target_arch = \"wasm32\"))]\n        crate::arcano_gpu::quadro(self, ctx, frame);\n")


def gpu_camadas(r):
    """Render lento / prévia lenta (dono, 06/11/2026, medido): o cache de camadas da GPU é LRU puro.
    Quando as camadas de UM quadro passam do orçamento (PSD de 50 camadas em 1080×1920 = ~500 MB
    em RGBA f32; orçamento 384 MB), ele expulsa as mais antigas — que são exatamente as que o
    próximo quadro usa primeiro — e a placa recebe TODAS as camadas de novo a cada quadro (o
    próprio aviso do código: "re-uploads them every frame"). Agora: (1) nunca expulsa camada usada
    no quadro atual; o que não cabe sobe sem ficar guardado (só a sobra reenvia); (2) o orçamento
    vem da memória da placa (DXGI no Windows; arquivos/gpu-arcano-vram.rs): um terço, 512 MB a 2 GB
    (RTX 3050 de 6 GB → 2 GB, cabe o PSD inteiro); sem saber, 768 MB no PC e 384 MB no navegador."""
    ctx = "crates/gpu/src/context.rs"
    troca(r, ctx, "struct Upload {\n    buf: Weak<Buf>,\n    img: GpuImage,\n    bytes: usize,\n    last_use: u64,\n}\n",
          "struct Upload {\n    buf: Weak<Buf>,\n    img: GpuImage,\n    bytes: usize,\n    last_use: u64,\n"
          "    /// Arcano: o último quadro que usou esta camada (não é expulsa no quadro em que é usada).\n    quadro: u64,\n}\n")
    troca(r, ctx, "struct Uploads {\n    map: HashMap<usize, Upload>,\n    bytes: usize,\n    clock: u64,\n}\n",
          "struct Uploads {\n    map: HashMap<usize, Upload>,\n    bytes: usize,\n    clock: u64,\n"
          "    /// Arcano: número do quadro em andamento (`novo_quadro`).\n    quadro: u64,\n}\n")
    troca(r, ctx,
          "    /// Upload a (layer cache) buffer, reusing the texture while the same `Arc` is alive: static\n"
          "    /// layers upload once, not every frame.\n"
          "    pub(crate) fn upload_buf(&self, buf: &Arc<Buf>) -> Option<GpuImage> {\n",
          "    /// Arcano: começa um quadro novo do compositor (as camadas usadas a partir daqui ficam\n"
          "    /// protegidas da expulsão até o próximo quadro).\n"
          "    pub(crate) fn novo_quadro(&self) {\n"
          "        if let Ok(mut u) = self.uploads.lock() {\n            u.quadro += 1;\n        }\n    }\n"
          "    /// Upload a (layer cache) buffer, reusing the texture while the same `Arc` is alive: static\n"
          "    /// layers upload once, not every frame.\n"
          "    pub(crate) fn upload_buf(&self, buf: &Arc<Buf>) -> Option<GpuImage> {\n")
    troca(r, ctx,
          "            if let Some(e) = u.map.get_mut(&key)\n                && e.buf.upgrade().is_some_and(|b| Arc::ptr_eq(&b, buf))\n            {\n                e.last_use = now;\n                return Some(e.img.clone());\n            }\n",
          "            let quadro_atual = u.quadro;\n            if let Some(e) = u.map.get_mut(&key)\n                && e.buf.upgrade().is_some_and(|b| Arc::ptr_eq(&b, buf))\n            {\n                e.last_use = now;\n                e.quadro = quadro_atual;\n                return Some(e.img.clone());\n            }\n")
    troca(r, ctx,
          "            let bytes = buf.img.data.len() * 16;\n            let now = u.clock;\n            if let Some(old) = u.map.insert(key, Upload { buf: Arc::downgrade(buf), img: img.clone(), bytes, last_use: now }) {\n                u.bytes -= old.bytes;\n            }\n            u.bytes += bytes;\n",
          "            let bytes = buf.img.data.len() * 16;\n            let now = u.clock;\n            let quadro = u.quadro;\n"
          "            // Arcano: expulsa primeiro o que já não tem dono, depois o que NÃO foi usado neste quadro;\n"
          "            // se mesmo assim esta camada não cabe, ela sobe sem ficar guardada (a textura vive só\n"
          "            // até o fim do quadro). Antes, o LRU puro expulsava as camadas deste mesmo quadro e a\n"
          "            // placa recebia todas de novo a cada quadro.\n"
          "            let budget = self.upload_budget();\n"
          "            let dead: Vec<usize> = u.map.iter().filter(|(_, e)| e.buf.strong_count() == 0).map(|(k, _)| *k).collect();\n"
          "            for k in dead {\n                if let Some(e) = u.map.remove(&k) {\n                    u.bytes -= e.bytes;\n                }\n            }\n"
          "            while u.bytes + bytes > budget {\n"
          "                let Some(k) = u.map.iter().filter(|(_, e)| e.quadro < quadro).min_by_key(|(_, e)| e.last_use).map(|(k, _)| *k) else { break };\n"
          "                if let Some(e) = u.map.remove(&k) {\n                    u.bytes -= e.bytes;\n                }\n            }\n"
          "            if u.bytes + bytes > budget {\n"
          "                if !self.upload_full_warned.swap(true, std::sync::atomic::Ordering::Relaxed) {\n"
          "                    log::warn!(target: \"effectcraft_gpu\", \"GPU upload cache full ({} MB): as camadas deste quadro passam dele; a sobra sobe de novo a cada quadro\", budget >> 20);\n"
          "                }\n"
          "                return Some(img);\n"
          "            }\n"
          "            if let Some(old) = u.map.insert(key, Upload { buf: Arc::downgrade(buf), img: img.clone(), bytes, last_use: now, quadro }) {\n                u.bytes -= old.bytes;\n            }\n            u.bytes += bytes;\n")
    # o trecho antigo de expulsão (LRU puro) sai
    troca(r, ctx,
          "            // Drop textures of freed buffers at once (a layer whose buffer changes every frame\n"
          "            // makes a new one each time, and nothing can hit the old one again), then the least\n"
          "            // recently used over budget.\n"
          "            let budget = self.upload_budget();\n"
          "            let dead: Vec<usize> = u.map.iter().filter(|(_, e)| e.buf.strong_count() == 0).map(|(k, _)| *k).collect();\n"
          "            for k in dead {\n                if let Some(e) = u.map.remove(&k) {\n                    u.bytes -= e.bytes;\n                }\n            }\n"
          "            if u.bytes > budget && !self.upload_full_warned.swap(true, std::sync::atomic::Ordering::Relaxed) {\n"
          "                log::warn!(\n                    target: \"effectcraft_gpu\",\n"
          "                    \"GPU upload cache full ({} MB): evicting layer textures, which upload again when next used; a frame whose static layers exceed it re-uploads them every frame\",\n"
          "                    budget >> 20\n                );\n            }\n"
          "            while u.bytes > budget {\n"
          "                let Some(k) = u.map.iter().min_by_key(|(_, e)| e.last_use).map(|(k, _)| *k) else { break };\n"
          "                if let Some(e) = u.map.remove(&k) {\n                    u.bytes -= e.bytes;\n                }\n            }\n",
          "")
    # todo quadro do compositor (prévia e render) começa um quadro novo do cache
    troca(r, "crates/gpu/src/walk.rs",
          "    let ctx = r.eval_ctx(comp_id, t)?;\n    let (w, h) = effectcraft_render::frame_size(ctx.comp.width, ctx.comp.height, r.opts.scale);\n    if r.depth() > 16 || !e.g.fits(w, h) {\n",
          "    let ctx = r.eval_ctx(comp_id, t)?;\n    e.g.novo_quadro();\n    let (w, h) = effectcraft_render::frame_size(ctx.comp.width, ctx.comp.height, r.opts.scale);\n    if r.depth() > 16 || !e.g.fits(w, h) {\n")
    # memória da placa (DXGI no Windows): crate próprio (o workspace proíbe `unsafe`, e o DXGI precisa)
    d = pathlib.Path(r) / "crates/arcano-vram"
    (d / "src").mkdir(parents=True, exist_ok=True)
    copia(pathlib.Path(__file__).parent / "arquivos/gpu-arcano-vram.rs", d / "src/lib.rs")
    (d / "Cargo.toml").write_text(
        '[package]\nname = "arcano-vram"\ndescription = "Arcano: memória da placa de vídeo (DXGI no Windows)"\n'
        'version.workspace = true\nedition.workspace = true\nlicense.workspace = true\nrust-version.workspace = true\n'
        '[dependencies]\n'
        "[target.'cfg(windows)'.dependencies]\n"
        'windows = { version = "0.62", features = ["Win32_Graphics_Dxgi", "Win32_Graphics_Dxgi_Common"] }\n', encoding="utf-8")
    print("ok  crates/arcano-vram")
    troca(r, "crates/gpu/src/lib.rs", "mod adv3d;\n", "pub use arcano_vram;\nmod adv3d;\n")
    troca(r, "crates/gpu/Cargo.toml", "[dependencies]\n", "[dependencies]\narcano-vram = { path = \"../arcano-vram\" }\n")


def render_rapido(r):
    """Render (dono, 06/11/2026: 12 min num vídeo que o After faz em 2–3): (1) "Abrir pasta do
    arquivo" depois de renderizado (aviso no canto + botão na linha do item); (2) a barra mostra
    se está na GPU ou no processador e os ms por quadro (fato medido, não chute); (3) render pedido
    com a GPU caída/voltando espera ela (até 20 s) em vez de ir inteiro pelo processador; (4) H.264
    com o preset Speed do encoder (medido aqui: 2,3× mais rápido que Balanced no mesmo bitrate)."""
    # encoder H.264: Speed
    troca(r, "crates/export/src/encode.rs",
          "        cfg.format = filmcraft_h264enc::PacketFormat::LengthPrefixed;\n        cfg.aud = false;\n",
          "        cfg.format = filmcraft_h264enc::PacketFormat::LengthPrefixed;\n        cfg.aud = false;\n"
          "        // Arcano: Speed (medido: 2,3× mais rápido que Balanced; no bitrate do app a diferença visual é mínima)\n"
          "        cfg.preset = filmcraft_h264enc::Preset::Speed;\n")
    # o teste pina os bytes exatos do H.264 (preset Balanced): com Speed os bytes mudam, de propósito
    troca(r, "crates/export/tests/it/movie_bytes.rs", "#[test]\nfn h264_movie_bytes_are_pinned() {",
          "#[test]\n#[ignore = \"Arcano: H.264 com preset Speed, os bytes pinados eram do Balanced\"]\nfn h264_movie_bytes_are_pinned() {")
    # a fila sabe se o render usa a GPU
    rq = "crates/engine/src/render_queue.rs"
    troca(r, rq, "    pub items_total: usize,\n    pub finished: bool,\n}\n",
          "    pub items_total: usize,\n    pub finished: bool,\n    /// Arcano: os quadros vão pela GPU (compositor vivo e Mercury GPU ligado no projeto).\n    #[serde(default)]\n    pub gpu: bool,\n}\n")
    troca(r, rq, "        let shared = Arc::new(JobShared::default());\n        if wait {\n",
          "        let shared = Arc::new(JobShared::default());\n"
          "        lock(&shared.state).gpu = work.accel.as_ref().is_some_and(|a| a.available()) && work.project.settings.gpu_acceleration;\n"
          "        if wait {\n")
    # painel: GPU/Processador + ms por quadro na barra; botão da pasta; espera da GPU; aviso no fim
    pn = "crates/ui-egui/src/panels/render_queue.rs"
    troca(r, pn, "        (Some(pr), Some(n)) if rendering => format!(\"Rendering “{n}”   {} / {} frames\", pr.done, pr.total),\n",
          "        (Some(pr), Some(n)) if rendering => format!(\"Rendering “{n}”   {} / {} frames{}\", pr.done, pr.total, crate::arcano_render::ritmo(pr)),\n")
    troca(r, "crates/ui-egui/src/menus/invoke.rs",
          "            if id == \"renderQueue.render\" && params.get(\"wait\").is_none() {\n"
          "                // The UI renders in the background; the panel shows progress.\n"
          "                let mut p = params.clone();\n"
          "                if let Some(m) = p.as_object_mut() {\n"
          "                    m.insert(\"wait\".into(), json!(false));\n"
          "                } else {\n"
          "                    p = json!({\"wait\": false});\n"
          "                }\n"
          "                app.show_panel(PanelKind::RenderQueue);\n"
          "                return app.session.execute(id, p).map_err(|e| e.to_string());\n",
          "            if id == \"renderQueue.render\" && params.get(\"wait\").is_none() {\n"
          "                // The UI renders in the background; the panel shows progress.\n"
          "                let mut p = params.clone();\n"
          "                if let Some(m) = p.as_object_mut() {\n"
          "                    m.insert(\"wait\".into(), json!(false));\n"
          "                } else {\n"
          "                    p = json!({\"wait\": false});\n"
          "                }\n"
          "                app.show_panel(PanelKind::RenderQueue);\n"
          "                if crate::arcano_render::esperar_gpu(app, ctx, &p) {\n"
          "                    return Ok(json!({\"adiado\": true}));\n"
          "                }\n"
          "                return app.session.execute(id, p).map_err(|e| e.to_string());\n", todas=True)
    troca(r, "crates/ui-egui/src/app/frame.rs",
          "        crate::arcano_carregando::quadro(self, &ctx);\n",
          "        crate::arcano_carregando::quadro(self, &ctx);\n        crate::arcano_render::quadro(self, &ctx);\n")


def previa_guardada(r):
    """Prévia que some ao trocar de composição (dono, 06/11/2026, PC e navegador): (1) o cache de
    prévia tinha 3 GB fixos (quadros em ponto flutuante, 16 B/px: 1080×1920 em 1/2 = ~8 MB por
    quadro, ~12 s de vídeo); no PC, com o valor padrão, passa a ser 40% da RAM (48 GB → ~19 GB),
    dentro do teto que o editor já confere (RAM menos a reserva); (2) quadro feito em segundo plano
    (adiantar/cache quando ocioso) nunca expulsa quadro de OUTRA composição: só os da própria; se
    não couber, ele não fica. Só o quadro que você está vendo pode expulsar outros (o mais antigo)."""
    troca(r, "crates/engine/src/settings/prefs/queries.rs",
          "        let (mut l, mut m, mut p) = (self.layer_cache_bytes() as u64, self.media_cache_bytes() as u64, self.preview_cache_bytes() as u64);\n",
          "        let (mut l, mut m, mut p) = (self.layer_cache_bytes() as u64, self.media_cache_bytes() as u64, self.preview_cache_bytes() as u64);\n"
          "        // Arcano: com o valor padrão (3 GB), no PC a prévia usa 40% da RAM (a troca de composição não apaga a outra)\n"
          "        if !web && p == 3072 << 20 && let Some(t) = mem.as_ref().map(|m| m.total).filter(|t| *t > 0) {\n"
          "            p = p.max(t / 5 * 2);\n"
          "        }\n")
    f = "crates/ui-egui/src/frames.rs"
    troca(r, f,
          "impl Cache {\n    fn insert(&mut self, k: FrameKey, img: FrameImage) {\n",
          "impl Cache {\n"
          "    /// Arcano: quadro feito em segundo plano (não é o da tela): só expulsa quadros da MESMA\n"
          "    /// composição (o mais antigo); se só sobrar de outras, ele mesmo sai. A prévia de uma\n"
          "    /// composição não some mais ao trocar para outra (o cache ocioso da nova enchia e a apagava).\n"
          "    fn insert_sem_tirar_outras(&mut self, k: FrameKey, img: FrameImage) {\n"
          "        let (sz, gpu) = (img.bytes(), img.is_gpu());\n"
          "        if let Some(old) = self.map.insert(k, img) {\n            self.forget(&old);\n        } else {\n            self.order.push_back(k);\n        }\n"
          "        self.bytes += sz;\n        if gpu {\n            self.gpu_bytes += sz;\n        }\n"
          "        while self.bytes > self.budget || self.gpu_bytes > self.gpu_budget {\n"
          "            let so_gpu = self.bytes <= self.budget;\n"
          "            let i = self.order.iter().position(|o| o.content == k.content && *o != k && (!so_gpu || self.map.get(o).is_some_and(FrameImage::is_gpu)));\n"
          "            let alvo = match i.and_then(|i| self.order.remove(i)) {\n"
          "                Some(o) => o,\n"
          "                None => {\n"
          "                    // só há quadros de outras composições: este não fica\n"
          "                    if let Some(j) = self.order.iter().rposition(|o| *o == k) {\n                        self.order.remove(j);\n                    }\n"
          "                    k\n"
          "                }\n"
          "            };\n"
          "            self.remove(&alvo);\n"
          "            if alvo == k {\n                break;\n            }\n"
          "        }\n"
          "    }\n"
          "    fn insert(&mut self, k: FrameKey, img: FrameImage) {\n")
    troca(r, f,
          "        if let Ok(mut c) = self.cache.lock()\n            && (!img.is_gpu() || !self.gpu_retired.load(Ordering::Acquire))\n        {\n            c.insert(key, img);\n        }\n",
          "        if let Ok(mut c) = self.cache.lock()\n            && (!img.is_gpu() || !self.gpu_retired.load(Ordering::Acquire))\n        {\n"
          "            if urgent {\n                c.insert(key, img);\n            } else {\n                c.insert_sem_tirar_outras(key, img);\n            }\n        }\n")


def worker_que_tenta_de_novo(r):
    """Render no navegador falhando no PC de outra pessoa (dono, 06/11/2026; sem mensagem): o render
    roda num worker; se ele caía (memória, GPU que some, travamento), o item virava "Failed" na hora.
    Agora: tenta de novo num worker NOVO (memória limpa; os workers eram reaproveitados e guardavam
    todo arquivo já mandado) e, na 3ª vez, sem GPU. Só depois disso falha."""
    # o motivo REAL do pânico (antes o worker só dizia "RuntimeError: unreachable": o wasm não imprime pânico)
    troca(r, "apps/effectcraft-web/src/worker.rs",
          "pub fn worker_init() {\n    crate::set_worker();\n    eframe::WebLogger::init(log::LevelFilter::Info).ok();\n",
          "pub fn worker_init() {\n    crate::set_worker();\n    eframe::WebLogger::init(log::LevelFilter::Info).ok();\n"
          "    // Arcano: o texto do pânico vai para a página (janela \"O render falhou\") antes do wasm parar\n"
          "    std::panic::set_hook(Box::new(|info| {\n"
          "        let texto = format!(\"{info}\");\n"
          "        log::error!(\"pânico no worker: {texto}\");\n"
          "        post(&obj(&[(\"type\", \"panico\".into()), (\"texto\", texto.as_str().into())]), None);\n"
          "    }));\n")
    h = "apps/effectcraft-web/js/host.js"
    troca(r, h, "      } else if (m.type === \"stats\") {\n",
          "      } else if (m.type === \"panico\") {\n        w.panico = String(m.texto || \"\");\n      } else if (m.type === \"stats\") {\n")
    troca(r, h, "export function workerRun(id, json, files, base, onMessage) {\n  let w;\n  try {\n    w = idle.pop() ?? spawn(base);\n",
          "export function workerRun(id, json, files, base, onMessage, tentativa = 0) {\n  let w;\n"
          "  // Arcano: worker que caiu → de novo num worker novo (memória limpa); na 3ª vez, sem GPU\n"
          "  const deNovo = (motivo) => {\n"
          "    if (tentativa >= 2 || !running.has(id)) { return false; }\n"
          "    running.delete(id);\n"
          "    console.warn(\"[Arcano] o trabalho caiu no worker (\" + motivo + \"): tentando de novo (\" + (tentativa + 2) + \"/3)\");\n"
          "    const gpuAntes = jobWorkerGpu;\n"
          "    if (tentativa >= 1) { jobWorkerGpu = false; }\n"
          "    try { workerRun(id, json, files, base, onMessage, tentativa + 1); } finally { jobWorkerGpu = gpuAntes; }\n"
          "    return true;\n"
          "  };\n"
          "  try {\n    w = (tentativa > 0 ? null : idle.pop()) ?? spawn(base);\n")
    troca(r, h,
          "    w.worker.onerror = (e) => {\n      running.delete(id);\n      onMessage(\"error\", String(e.message || \"worker error\"), null, null);\n      w.worker.terminate();\n    };\n",
          "    w.worker.onerror = (e) => {\n      w.worker.terminate();\n"
          "      const motivo = w.panico ? (\"erro interno: \" + w.panico) : String(e.message || \"worker error\");\n"
          "      if (deNovo(motivo)) { return; }\n"
          "      running.delete(id);\n      onMessage(\"error\", motivo, null, null);\n    };\n")
    troca(r, h,
          "    // The worker didn't start (#216): the job fails and the worker goes.\n    running.delete(id);\n    w.worker.terminate();\n    onMessage(\"error\", String(e.message || e), null, null);\n",
          "    // The worker didn't start (#216): the job fails and the worker goes.\n    w.worker.terminate();\n    if (deNovo(String(e.message || e))) { return; }\n"
          "    running.delete(id);\n    onMessage(\"error\", String(e.message || e), null, null);\n")


def worker_com_memoria_de_navegador(r):
    """Render no navegador caindo com "RuntimeError: unreachable" (projeto ARCANO • LED DJ GUUGA do dono,
    06/11/2026, reproduzido aqui até sem GPU): o worker de render criava os caches com os padrões de PC
    (mídia 1 GB + camadas do render 1 GB), fora o cache de PSD, o arquivo do projeto e a memória do
    quadro; um quadro desse projeto passa de 3,5 GB e o worker do navegador tem 4 GB: estourava e o wasm
    abortava. A página já usava os limites de navegador (WEB_LAYER_CACHE/WEB_MEDIA_CACHE); agora o worker e
    o render também."""
    troca(r, "apps/effectcraft-web/src/worker.rs",
          "    let pool = Arc::new(effectcraft_media::MediaPool::new());\n    POOL.with(|p| *p.borrow_mut() = Some(pool.clone()));\n",
          "    // Arcano: limite de navegador, igual ao da página (WEB_MEDIA_CACHE = 256 MB; antes 1 GB, o padrão de PC)\n"
          "    let pool = Arc::new(effectcraft_media::MediaPool::with_budget(256 << 20));\n"
          "    POOL.with(|p| *p.borrow_mut() = Some(pool.clone()));\n")
    # e os caches da sessão do worker (camadas da prévia/render) com os limites de navegador, como a página
    troca(r, "apps/effectcraft-web/src/worker.rs",
          "        ..Default::default()\n    };\n    SESSION.with(|c| *c.borrow_mut() = Some(s));\n}\n",
          "        ..Default::default()\n    };\n"
          "    // Arcano: os limites de memória de navegador (cache de camadas 512 MB, mídia 256 MB), como na página\n"
          "    let mut s = s;\n    s.apply_cache_budgets();\n"
          "    SESSION.with(|c| *c.borrow_mut() = Some(s));\n}\n")
    troca(r, "crates/export/src/pipeline.rs",
          "        let cache = LayerCache::default();\n        // With deferred readbacks,",
          "        // Arcano: no navegador o worker tem 4 GB pra tudo; o cache de camadas do render fica em 128 MB (antes 1 GB)\n"
          "        #[cfg(target_arch = \"wasm32\")]\n        let cache = LayerCache::new(128 << 20);\n"
          "        #[cfg(not(target_arch = \"wasm32\"))]\n        let cache = LayerCache::default();\n        // With deferred readbacks,")


def caminho_do_navegador(r):
    """Projeto aberto no NAVEGADOR com tudo ausente (dono, 06/11/2026: o pacote com o PSD dentro abria
    no PC certinho e no navegador com as barras coloridas): no wasm o Rust não acha "/Projetos/…/x.psd"
    absoluto (Path::is_absolute = false, testado), a regra de caminhos recusava e marcava os 43 itens
    como ausentes. No navegador "/…" é o caminho da tabela de arquivos: vale como está."""
    troca(r, "crates/engine/src/footage/doc_path.rs",
          "pub fn resolve(stored: &str, project: Option<&str>) -> Result<PathBuf, NotFollowed> {\n",
          "pub fn resolve(stored: &str, project: Option<&str>) -> Result<PathBuf, NotFollowed> {\n"
          "    // Arcano: no navegador \"/…\" é o caminho da tabela de arquivos (o std do wasm não o acha absoluto)\n"
          "    #[cfg(target_arch = \"wasm32\")]\n"
          "    if stored.starts_with('/') && !stored.starts_with(\"//\") && !stored.split('/').any(|c| c == \"..\") {\n"
          "        return Ok(PathBuf::from(stored));\n"
          "    }\n")


def imagem_grande_navegador(r):
    """ARCANO • LED DJ GUUGA no navegador: a camada 'COR DO FUNDO' é uma imagem de 7684×4324 (PSD);
    em resolução cheia o buffer dela tem 33 M px (16 B/px = 531 MB, mais a cópia) e montá-la levou o
    worker de 774 MB a 2836 MB num passo só (medido com memory_size no worker); o quadro seguinte
    passou de 4 GB. SÓ NO NAVEGADOR (wasm): imagem/vídeo com mais de ~8 M px na escala do render é
    pedida já reduzida a ~8 M px (≈ 4× um quadro 1080p: quase nunca aparece). PC não muda nada."""
    f = "crates/render/src/pipeline.rs"
    troca(r, f, "        let s = self.opts.scale;\n        (s < 0.75).then(",
          "        let s = self.opts.scale;\n"
          "        #[cfg(target_arch = \"wasm32\")]\n"
          "        {\n"
          "            let px = w as f64 * h as f64 * s * s;\n"
          "            if px > 8.0e6 {\n"
          "                let k = s * (8.0e6 / px).sqrt();\n"
          "                return Some((((w as f64 * k).round() as u32).max(1), ((h as f64 * k).round() as u32).max(1)));\n"
          "            }\n"
          "        }\n"
          "        (s < 0.75).then(")
    # o buffer reduzido assim tem a escala dele (no PC continua a do render)
    troca(r, f, "            Some(size) if (img.width, img.height) == size => Buf { img: img.clone(), offset: [0.0; 2], scale: s },\n",
          "            #[cfg(target_arch = \"wasm32\")]\n"
          "            Some(size) if (img.width, img.height) == size => Buf { img: img.clone(), offset: [0.0; 2], scale: size.0 as f64 / w.max(1) as f64 },\n"
          "            #[cfg(not(target_arch = \"wasm32\"))]\n"
          "            Some(size) if (img.width, img.height) == size => Buf { img: img.clone(), offset: [0.0; 2], scale: s },\n")
    # imagem que veio maior que o orçamento mesmo assim (a interpretação por pixel pede o quadro inteiro):
    # reduzida aqui, antes de virar buffer de camada (que fica guardado e passa pelo 3D/desfoque)
    troca(r, f, "        let mut buf = match self.reduced_size(w, h) {\n",
          "        #[cfg(target_arch = \"wasm32\")]\n"
          "        let reduzida;\n"
          "        #[cfg(target_arch = \"wasm32\")]\n"
          "        let img = {\n"
          "            let px = img.width as f64 * img.height as f64;\n"
          "            if px > 8.0e6 {\n"
          "                let q = (8.0e6 / px).sqrt();\n"
          "                reduzida = effectcraft_raster::resample(img, ((img.width as f64 * q).round() as u32).max(1), ((img.height as f64 * q).round() as u32).max(1));\n"
          "                &reduzida\n"
          "            } else {\n"
          "                img\n"
          "            }\n"
          "        };\n"
          "        #[cfg(target_arch = \"wasm32\")]\n"
          "        let k = if img.width > 0 { w.max(1) as f64 / img.width as f64 } else { 1.0 };\n"
          "        let mut buf = match self.reduced_size(w, h) {\n")
    troca(r, f, "            Some((rw, rh)) if k <= 1.0 + 1e-9 => Buf { img: effectcraft_raster::resample(img, rw, rh), offset: [0.0; 2], scale: s },\n",
          "            #[cfg(target_arch = \"wasm32\")]\n"
          "            Some((rw, rh)) if k <= 1.0 + 1e-9 => Buf { img: effectcraft_raster::resample(img, rw, rh), offset: [0.0; 2], scale: rw as f64 / w.max(1) as f64 },\n"
          "            #[cfg(not(target_arch = \"wasm32\"))]\n"
          "            Some((rw, rh)) if k <= 1.0 + 1e-9 => Buf { img: effectcraft_raster::resample(img, rw, rh), offset: [0.0; 2], scale: s },\n")


def ladrilho_navegador(r):
    """O que estourava de verdade o ARCANO • LED DJ GUUGA no navegador: a camada 'COR DO FUNDO'
    (1920×1080) tem Motion Tile com saída de 400% → buffer de 7684×4324 (33 M px, 531 MB por cópia),
    e as cópias dele (estilos, 3D, desfoque) levaram o worker de 774 MB a 2836 MB e depois a 4 GB
    (medido: footage 1920×1080, plano 7684×4324). SÓ NO NAVEGADOR (wasm): antes da pilha de efeitos,
    se o Motion Tile ligado vai fazer o buffer passar de ~8 M px, a entrada é reduzida pra caber (os
    efeitos usam a escala do buffer, então o desenho sai igual, só com menos pixels). PC não muda."""
    f = "crates/render/src/pipeline.rs"
    troca(r, f, "        let origin = if adjustment { [0.0; 2] } else { ctx.effect_bounds(layer).1 };\n        buf.rebase(origin);\n",
          "        let origin = if adjustment { [0.0; 2] } else { ctx.effect_bounds(layer).1 };\n"
          "        #[cfg(target_arch = \"wasm32\")]\n"
          "        if !adjustment && layer.switches.effects && let Some(fx) = layer.effects() {\n"
          "            let mut cresce = 1.0f64;\n"
          "            for g in fx.groups().take(limit).filter(|g| g.enabled) {\n"
          "                if matches!(&g.kind, GroupKind::Effect { effect } if effect == \"ec.stylize.motiontile\") {\n"
          "                    let p = self.effect_params(ctx, layer, g);\n"
          "                    cresce *= (p.f(\"outputWidth\") / 100.0).max(1.0) * (p.f(\"outputHeight\") / 100.0).max(1.0);\n"
          "                }\n"
          "            }\n"
          "            let px = buf.img.width as f64 * buf.img.height as f64 * cresce;\n"
          "            if cresce > 1.0 && px > 8.0e6 && buf.img.width > 16 && buf.img.height > 16 {\n"
          "                let q = (8.0e6 / px).sqrt();\n"
          "                let (nw, nh) = (((buf.img.width as f64 * q).round() as u32).max(1), ((buf.img.height as f64 * q).round() as u32).max(1));\n"
          "                let kx = nw as f64 / buf.img.width as f64;\n"
          "                buf = Buf { img: effectcraft_raster::resample(&buf.img, nw, nh), offset: [buf.offset[0] * kx, buf.offset[1] * kx], scale: buf.scale * kx };\n"
          "            }\n"
          "        }\n"
          "        buf.rebase(origin);\n")


def desfoque_3d_navegador(r):
    """Render do projeto ARCANO • LED DJ GUUGA caindo no navegador ("RuntimeError: unreachable" =
    memória do worker acabou; medido com heaptrack, 1 núcleo como o worker): a profundidade de campo
    da câmera 3D guarda uma cópia desfocada (com borda, 16 B/px) de CADA camada 3D do quadro ao mesmo
    tempo — o 3D junta todas pixel a pixel por profundidade — e isso sozinho chegou a 2,65 GB; o worker
    do navegador tem 4 GB pra tudo. SÓ NO NAVEGADOR (wasm): camada com desfoque de 4 px ou mais é
    desfocada e guardada em meia resolução (memória ÷4; numa camada desfocada não há detalhe fino pra
    perder). O programa de PC não muda nada."""
    f = "crates/render/src/three_d/compose.rs"
    # orçamento do desfoque: no navegador 4 M px por imagem com borda (antes 16 M: várias delas ao mesmo
    # tempo davam ~2,6 GB num passo só, medido no worker). Com a meia resolução do desfoque grande, a
    # borda máxima em pixels da tela continua a mesma.
    troca(r, f, "const DOF_PAD_BUDGET: f64 = 16.0e6;\n",
          "#[cfg(not(target_arch = \"wasm32\"))]\nconst DOF_PAD_BUDGET: f64 = 16.0e6;\n"
          "#[cfg(target_arch = \"wasm32\")]\nconst DOF_PAD_BUDGET: f64 = 4.0e6;\n")
    # cada camada 3D sem a borda transparente (pré-composições do tamanho da tela quase vazias: confete,
    # raios...): o 3D guarda todas ao mesmo tempo; pixel transparente não aparece, o quadro sai igual
    troca(r, f,
          "    let PlaneInput { mut buf, local } = plane;\n    if buf.img.is_empty() {\n        return None;\n    }\n",
          "    let PlaneInput { mut buf, local } = plane;\n    if buf.img.is_empty() {\n        return None;\n    }\n"
          "    #[cfg(target_arch = \"wasm32\")]\n"
          "    {\n        buf = match sem_borda_transparente(&buf) {\n            Some(b) => Arc::new(b),\n            None if buf.img.data.iter().all(|p| p[3] <= 0.0) => return None,\n            None => buf,\n        };\n    }\n")
    troca(r, f,
          "/// Depth of field for one plane: highlights boosted, then a bokeh-shaped blur by depth.\n",
          "/// Arcano (só navegador): o buffer sem a borda totalmente transparente (`None`: não vale a pena\n"
          "/// recortar, ou está todo transparente). Deslocamento ajustado: o quadro sai igual.\n"
          "#[cfg(target_arch = \"wasm32\")]\n"
          "fn sem_borda_transparente(b: &Buf) -> Option<Buf> {\n"
          "    let (w, h) = (b.img.width as usize, b.img.height as usize);\n"
          "    let (mut x0, mut y0, mut x1, mut y1) = (w, h, 0usize, 0usize);\n"
          "    for y in 0..h {\n"
          "        let linha = &b.img.data[y * w..(y + 1) * w];\n"
          "        if let Some(a) = linha.iter().position(|p| p[3] > 0.0) {\n"
          "            let z = linha.iter().rposition(|p| p[3] > 0.0).unwrap_or(a);\n"
          "            x0 = x0.min(a);\n            x1 = x1.max(z + 1);\n            y0 = y0.min(y);\n            y1 = y + 1;\n"
          "        }\n"
          "    }\n"
          "    if x1 <= x0 || y1 <= y0 {\n        return None;\n    }\n"
          "    // 1 px de margem: a amostragem bilinear/bicúbica da borda continua igual\n"
          "    let (x0, y0, x1, y1) = (x0.saturating_sub(2), y0.saturating_sub(2), (x1 + 2).min(w), (y1 + 2).min(h));\n"
          "    let (nw, nh) = (x1 - x0, y1 - y0);\n"
          "    if nw * nh * 10 > w * h * 8 {\n        return None;\n    }\n"
          "    let mut img = Image::new(nw as u32, nh as u32);\n"
          "    for y in 0..nh {\n"
          "        img.data[y * nw..(y + 1) * nw].copy_from_slice(&b.img.data[(y0 + y) * w + x0..(y0 + y) * w + x1]);\n"
          "    }\n"
          "    Some(Buf { img, offset: [b.offset[0] - x0 as f64, b.offset[1] - y0 as f64], scale: b.scale })\n"
          "}\n\n"
          "/// Depth of field for one plane: highlights boosted, then a bokeh-shaped blur by depth.\n")
    troca(r, f,
          "fn dof_blur(cam: &CameraState, dof: &super::camera::Dof, world: Mat4, buf: Arc<Buf>) -> Arc<Buf> {\n"
          "    let cap = dof_radius_cap(dof, buf.img.width, buf.img.height);\n"
          "    let radii = dof_radii(cam, dof, world, &buf, cap);\n",
          "fn dof_blur(cam: &CameraState, dof: &super::camera::Dof, world: Mat4, buf: Arc<Buf>) -> Arc<Buf> {\n"
          "    let cap = dof_radius_cap(dof, buf.img.width, buf.img.height);\n"
          "    let radii = dof_radii(cam, dof, world, &buf, cap);\n"
          "    // Arcano (só navegador): desfoque grande → feito e guardado em meia resolução (memória ÷4)\n"
          "    #[cfg(target_arch = \"wasm32\")]\n"
          "    if buf.img.width >= 16 && buf.img.height >= 16 && radii.iter().copied().fold(0.0f32, f32::max) >= 4.0 {\n"
          "        return dof_blur_inteiro(cam, dof, world, Arc::new(meia_resolucao(&buf)));\n"
          "    }\n"
          "    dof_blur_inteiro_com(cam, dof, world, buf, cap, radii)\n"
          "}\n\n"
          "/// Arcano: o buffer em meia resolução (média de 2×2), com escala e deslocamento ajustados.\n"
          "#[cfg(target_arch = \"wasm32\")]\n"
          "fn meia_resolucao(b: &Buf) -> Buf {\n"
          "    let (w, h) = (b.img.width as usize, b.img.height as usize);\n"
          "    let (w2, h2) = (w.div_ceil(2), h.div_ceil(2));\n"
          "    let mut img = Image::new(w2 as u32, h2 as u32);\n"
          "    for y in 0..h2 {\n"
          "        for x in 0..w2 {\n"
          "            let mut s = [0.0f32; 4];\n"
          "            let mut n = 0.0f32;\n"
          "            for (dx, dy) in [(0, 0), (1, 0), (0, 1), (1, 1)] {\n"
          "                let (sx, sy) = (2 * x + dx, 2 * y + dy);\n"
          "                if sx < w && sy < h {\n"
          "                    let p = b.img.data[sy * w + sx];\n"
          "                    for c in 0..4 {\n                        s[c] += p[c];\n                    }\n"
          "                    n += 1.0;\n"
          "                }\n"
          "            }\n"
          "            img.data[y * w2 + x] = [s[0] / n, s[1] / n, s[2] / n, s[3] / n];\n"
          "        }\n"
          "    }\n"
          "    Buf { img, offset: [b.offset[0] * 0.5, b.offset[1] * 0.5], scale: b.scale * 0.5 }\n"
          "}\n\n"
          "#[cfg(target_arch = \"wasm32\")]\n"
          "fn dof_blur_inteiro(cam: &CameraState, dof: &super::camera::Dof, world: Mat4, buf: Arc<Buf>) -> Arc<Buf> {\n"
          "    let cap = dof_radius_cap(dof, buf.img.width, buf.img.height);\n"
          "    let radii = dof_radii(cam, dof, world, &buf, cap);\n"
          "    dof_blur_inteiro_com(cam, dof, world, buf, cap, radii)\n"
          "}\n\n"
          "fn dof_blur_inteiro_com(cam: &CameraState, dof: &super::camera::Dof, world: Mat4, buf: Arc<Buf>, cap: f64, radii: Vec<f32>) -> Arc<Buf> {\n")


def destino_navegador(r):
    """Navegador: "Escolher onde salvar" abre a janela Salvar como do navegador (Chrome/Edge) e o
    render é gravado lá (arquivos/web-arcano-destino.rs); antes o botão só trocava um nome interno."""
    copia(pathlib.Path(__file__).parent / "arquivos/web-arcano-destino.rs", pathlib.Path(r) / "apps/effectcraft-web/src/arcano_destino.rs")
    troca(r, "apps/effectcraft-web/src/lib.rs", "pub mod arcano_fontes;\n", "pub mod arcano_fontes;\npub mod arcano_destino;\n")
    troca(r, "apps/effectcraft-web/src/app.rs", "    app.hooks.audio_device = Some(Box::new(audio::open));\n",
          "    app.hooks.audio_device = Some(Box::new(audio::open));\n    crate::arcano_destino::ligar();\n")
    troca(r, "apps/effectcraft-web/src/files.rs", "        1 => download(&out[0].0, &out[0].1),\n",
          "        // Arcano: o lugar escolhido em \"Escolher onde salvar\" (senão, Downloads)\n"
          "        1 if crate::arcano_destino::gravar(&out[0].0, &out[0].1) => Ok(()),\n"
          "        1 => download(&out[0].0, &out[0].1),\n")


def coletar_arquivos(r):
    """Arquivo ▸ Dependências ▸ Coletar arquivos (dono, 06/11/2026): o mesmo PSD importado camada por
    camada era copiado uma vez por item (50 × 143 MB, nomes 50_49_48_...) lendo tudo na memória na
    thread da janela (tela travada). Agora: cada arquivo uma vez, cópia em segundo plano com
    progresso no painel Progresso (cancelável)."""
    f = "crates/engine/src/cmd/file_more.rs"
    troca(r, f, '    let protected = s.protected_files();\n    let mut used_names = BTreeSet::new();\n    let mut plan: Vec<(ItemId, Vec<(String, String)>)> = vec![];\n    for it in s.project.items.values() {\n        let ItemKind::Footage(f) = &it.kind else { continue };\n        if f.path.is_empty() {\n            continue;\n        }\n        let files: Vec<&String> = if f.sequence.is_empty() { vec![&f.path] } else { f.sequence.iter().collect() };\n        let mut pairs = vec![];\n        for src in files {\n            let mut name = std::path::Path::new(src).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "footage".into());\n            let mut k = 2;\n            while !used_names.insert(name.clone()) {\n                name = format!("{k}_{name}");\n                k += 1;\n            }\n            let dst = format!("{folder}/(Footage)/{name}");\n            // A file that is already where its copy goes stays (it is not copied onto itself).\n            if !crate::output_guard::same_file(std::path::Path::new(src), std::path::Path::new(&dst))\n                && let Some(source) = protected.find(std::path::Path::new(&dst))\n            {\n                return Err(EngineError::Other(format!("Nothing was collected. {}", source.refusal(&dst, crate::output_guard::Use::Export))));\n            }\n            pairs.push((src.clone(), dst));\n        }\n        plan.push((it.id, pairs));\n    }\n    if let Some(source) = protected.find(std::path::Path::new(&out)) {\n        return Err(EngineError::Other(format!("Nothing was collected. {}", source.refusal(&out, crate::output_guard::Use::Export))));\n    }\n    // Collect Files makes its folder (and the footage folder inside it).\n', '    let protected = s.protected_files();\n    let mut used_names = BTreeSet::new();\n    // Arcano: o MESMO arquivo usado por vários itens (um PSD importado camada por camada) é\n    // copiado UMA vez (antes: 50 itens do mesmo PSD = 50 cópias de 143 MB e nomes "50_49_48_...").\n    let mut destino_de: BTreeMap<String, String> = BTreeMap::new();\n    let mut plan: Vec<(ItemId, Vec<(String, String)>)> = vec![];\n    for it in s.project.items.values() {\n        let ItemKind::Footage(f) = &it.kind else { continue };\n        if f.path.is_empty() {\n            continue;\n        }\n        let files: Vec<&String> = if f.sequence.is_empty() { vec![&f.path] } else { f.sequence.iter().collect() };\n        let mut pairs = vec![];\n        for src in files {\n            if let Some(dst) = destino_de.get(src) {\n                pairs.push((src.clone(), dst.clone()));\n                continue;\n            }\n            let base = std::path::Path::new(src).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "footage".into());\n            let mut name = base.clone();\n            let mut k = 2;\n            while !used_names.insert(name.to_ascii_lowercase()) {\n                name = format!("{k}_{base}");\n                k += 1;\n            }\n            let dst = format!("{folder}/(Footage)/{name}");\n            // A file that is already where its copy goes stays (it is not copied onto itself).\n            if !crate::output_guard::same_file(std::path::Path::new(src), std::path::Path::new(&dst))\n                && let Some(source) = protected.find(std::path::Path::new(&dst))\n            {\n                return Err(EngineError::Other(format!("Nothing was collected. {}", source.refusal(&dst, crate::output_guard::Use::Export))));\n            }\n            destino_de.insert(src.clone(), dst.clone());\n            pairs.push((src.clone(), dst));\n        }\n        plan.push((it.id, pairs));\n    }\n    if let Some(source) = protected.find(std::path::Path::new(&out)) {\n        return Err(EngineError::Other(format!("Nothing was collected. {}", source.refusal(&out, crate::output_guard::Use::Export))));\n    }\n')
    troca(r, f, '    #[cfg(not(target_arch = "wasm32"))]\n    std::fs::create_dir_all(format!("{folder}/(Footage)")).map_err(|e| EngineError::Other(format!("cannot create {folder}: {e}")))?;\n    let mut proj = (*s.project).clone();\n    let mut copied = 0;\n    let mut errors = vec![];\n    for (id, pairs) in plan {\n        let mut new_paths = vec![];\n        for (src, dst) in &pairs {\n            if crate::output_guard::same_file(std::path::Path::new(src), std::path::Path::new(dst)) {\n                copied += 1;\n            } else {\n                match s.services.read_file(src).and_then(|bytes| s.write_output_with(&protected, dst, &bytes).map_err(std::io::Error::other)) {\n                    Ok(()) => copied += 1,\n                    Err(e) => errors.push(format!("{src}: {e}")),\n                }\n            }\n            new_paths.push(dst.clone());\n        }\n        let Some(ItemKind::Footage(f)) = proj.items.get_mut(&id).map(|it| &mut it.kind) else { continue };\n        if f.sequence.is_empty() {\n            f.path = new_paths.pop().unwrap_or_default();\n        } else {\n            f.path = new_paths.first().cloned().unwrap_or_default();\n            f.sequence = new_paths;\n        }\n    }\n', '    // Arcano: a cópia roda em segundo plano (painel Progresso, com cancelar), arquivo por arquivo\n    // direto do disco (antes lia cada arquivo inteiro na memória e travava a janela até acabar).\n    let mut proj = (*s.project).clone();\n    for (id, pairs) in &plan {\n        let new_paths: Vec<String> = pairs.iter().map(|(_, d)| d.clone()).collect();\n        let Some(ItemKind::Footage(f)) = proj.items.get_mut(id).map(|it| &mut it.kind) else { continue };\n        if f.sequence.is_empty() {\n            f.path = new_paths.last().cloned().unwrap_or_default();\n        } else {\n            f.path = new_paths.first().cloned().unwrap_or_default();\n            f.sequence = new_paths;\n        }\n    }\n    let copias: Vec<(String, String)> = destino_de.into_iter().collect();\n    let projeto_json = proj.to_json();\n    let services = s.services.clone();\n    let wait = p.get("wait").and_then(Value::as_bool).unwrap_or(false);\n    let folder2 = folder.clone();\n    let out2 = out.clone();\n    let n = copias.len();\n    s.spawn_task("collectFiles", format!("Coletando arquivos ({n})"), wait, move |ctl| {\n        #[cfg(not(target_arch = "wasm32"))]\n        std::fs::create_dir_all(format!("{folder2}/(Footage)")).map_err(|e| format!("cannot create {folder2}: {e}"))?;\n        let total = copias.len() as u64;\n        let mut copied = 0usize;\n        let mut errors = vec![];\n        for (k, (src, dst)) in copias.iter().enumerate() {\n            if !ctl.progress(k as u64, total) {\n                return Err(crate::render_queue::CANCELLED.into());\n            }\n            ctl.message(std::path::Path::new(src).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default());\n            if crate::output_guard::same_file(std::path::Path::new(src), std::path::Path::new(dst)) {\n                copied += 1;\n                continue;\n            }\n            #[cfg(not(target_arch = "wasm32"))]\n            let r = std::fs::copy(src, dst).map(|_| ()).map_err(|e| e.to_string());\n            #[cfg(target_arch = "wasm32")]\n            let r = services.read_file(src).and_then(|b| services.write_file(dst, &b)).map_err(|e| e.to_string());\n            match r {\n                Ok(()) => copied += 1,\n                Err(e) => errors.push(format!("{src}: {e}")),\n            }\n        }\n        ctl.progress(total, total);\n        services.write_file(&out2, projeto_json.as_bytes()).map_err(|e| format!("cannot write {out2}: {e}"))?;\n        Ok(Box::new(move |s: &mut Session| {\n            s.toast(format!("Coletado: {copied} arquivo(s) em {folder2}{}", if errors.is_empty() { String::new() } else { format!(" ({} com erro)", errors.len()) }));\n            Ok(json!({"project": out2, "copied": copied, "errors": errors}))\n        }) as crate::jobs::Apply)\n    })\n}\n', todas=False)
    troca(r, f, '    s.write_output_with(&protected, &out, proj.to_json().as_bytes())?;\n    s.toast(format!("Collected {copied} file(s) into {folder}"));\n    Ok(json!({"project": out, "copied": copied, "errors": errors}))\n}\n', '')


def psd_uma_vez(r):
    """PSD lido e interpretado UMA vez (dono, 06/11/2026, projeto "after de domingo"): cada camada
    importada do mesmo PSD (50 itens do mesmo arquivo de 143 MB) relia o arquivo do disco, copiava
    os 143 MB e interpretava o PSD inteiro de novo a cada decodificação; quando o cache de mídia
    (1 GB) soltava uma camada, era tudo de novo (segundos por camada = "carrega um pouco e trava").
    Agora o documento interpretado fica num cache (até 8 arquivos / 1,5 GB), achado pelo caminho +
    tamanho + data SEM reler o arquivo, ou pelo conteúdo (cópias iguais do mesmo PSD, como as que o
    Coletar arquivos antigo fazia); a camada só é extraída dele. Medido no projeto do dono (2 núcleos,
    sem GPU): 1º quadro de 7,1 s → ver CLAUDE.md."""
    lay = "crates/media/src/layered.rs"
    troca(r, lay, "pub(crate) fn decode(path: &str, bytes: &[u8], footage: &Footage, op: AlphaOp) -> Result<Option<Image>> {\n    if effectcraft_psd::is_psd(bytes) {\n        let psd = effectcraft_psd::Psd::parse(bytes.to_vec()).map_err(|e| MediaError::Decode(format!(\"{path}: {e}\")))?;\n",
          "/// Arcano: os PSDs interpretados, guardados por arquivo (caminho + tamanho + data) e por conteúdo\n"
          "/// (tamanho + amostra dos bytes: cópias iguais do mesmo PSD contam uma vez): as camadas de um mesmo\n"
          "/// documento saem do mesmo `Psd`, sem reler nem interpretar o arquivo de novo.\n"
          "struct PsdGuardado {\n"
          "    caminho: String,\n"
          "    carimbo: u64,\n"
          "    conteudo: u64,\n"
          "    psd: std::sync::Arc<effectcraft_psd::Psd>,\n"
          "    bytes: usize,\n"
          "}\n"
          "static PSDS_GUARDADOS: std::sync::Mutex<Vec<PsdGuardado>> = std::sync::Mutex::new(Vec::new());\n"
          "// navegador: a memória do wasm é curta (4 GB por página/worker, com os arquivos e caches juntos)\n"
          "#[cfg(not(target_arch = \"wasm32\"))]\nconst PSDS_MAXIMO: usize = 8;\n"
          "#[cfg(not(target_arch = \"wasm32\"))]\nconst PSDS_BYTES_MAXIMO: usize = 1536 << 20;\n"
          "#[cfg(target_arch = \"wasm32\")]\nconst PSDS_MAXIMO: usize = 1;\n"
          "#[cfg(target_arch = \"wasm32\")]\nconst PSDS_BYTES_MAXIMO: usize = 1;\n"
          "fn carimbo_do_arquivo(path: &str) -> Option<u64> {\n"
          "    #[cfg(not(target_arch = \"wasm32\"))]\n"
          "    {\n"
          "        let m = std::fs::metadata(path).ok()?;\n"
          "        let t = m.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_nanos() as u64).unwrap_or(0);\n"
          "        Some(m.len().rotate_left(17) ^ t)\n"
          "    }\n"
          "    #[cfg(target_arch = \"wasm32\")]\n"
          "    {\n"
          "        let _ = path;\n"
          "        None\n"
          "    }\n"
          "}\n"
          "fn conteudo_do_arquivo(bytes: &[u8]) -> u64 {\n"
          "    use std::hash::{Hash, Hasher};\n"
          "    let mut h = std::collections::hash_map::DefaultHasher::new();\n"
          "    bytes.len().hash(&mut h);\n"
          "    let n = bytes.len();\n"
          "    let k = 64 << 10;\n"
          "    bytes[..n.min(k)].hash(&mut h);\n"
          "    if n > 2 * k {\n"
          "        bytes[n / 2..(n / 2 + k).min(n)].hash(&mut h);\n"
          "        bytes[n - k..].hash(&mut h);\n"
          "    }\n"
          "    h.finish()\n"
          "}\n"
          "fn psd_guardado_pelo_caminho(path: &str) -> Option<std::sync::Arc<effectcraft_psd::Psd>> {\n"
          "    let carimbo = carimbo_do_arquivo(path)?;\n"
          "    let mut g = PSDS_GUARDADOS.lock().unwrap_or_else(std::sync::PoisonError::into_inner);\n"
          "    let i = g.iter().position(|e| e.caminho == path && e.carimbo == carimbo)?;\n"
          "    let e = g.remove(i);\n"
          "    let psd = e.psd.clone();\n"
          "    g.push(e);\n"
          "    Some(psd)\n"
          "}\n"
          "fn psd_guardado(path: &str, bytes: &std::sync::Arc<[u8]>) -> Result<std::sync::Arc<effectcraft_psd::Psd>> {\n"
          "    if let Some(p) = psd_guardado_pelo_caminho(path) {\n"
          "        return Ok(p);\n"
          "    }\n"
          "    let carimbo = carimbo_do_arquivo(path).unwrap_or(bytes.len() as u64);\n"
          "    let conteudo = conteudo_do_arquivo(bytes);\n"
          "    let mut g = PSDS_GUARDADOS.lock().unwrap_or_else(std::sync::PoisonError::into_inner);\n"
          "    let psd = match g.iter().find(|e| e.conteudo == conteudo && e.bytes == bytes.len()) {\n"
          "        Some(e) => e.psd.clone(),\n"
          "        None => {\n"
          "            drop(g);\n"
          "            let p = std::sync::Arc::new(effectcraft_psd::Psd::parse(bytes.clone()).map_err(|e| MediaError::Decode(format!(\"{path}: {e}\")))?);\n"
          "            g = PSDS_GUARDADOS.lock().unwrap_or_else(std::sync::PoisonError::into_inner);\n"
          "            p\n"
          "        }\n"
          "    };\n"
          "    g.retain(|e| e.caminho != path);\n"
          "    g.push(PsdGuardado { caminho: path.to_string(), carimbo, conteudo, psd: psd.clone(), bytes: bytes.len() });\n"
          "    // o mesmo documento por vários caminhos conta uma vez no limite de bytes\n"
          "    let total = |g: &Vec<PsdGuardado>| {\n"
          "        let mut vistos: Vec<*const effectcraft_psd::Psd> = Vec::new();\n"
          "        g.iter().filter(|e| { let p = std::sync::Arc::as_ptr(&e.psd); if vistos.contains(&p) { false } else { vistos.push(p); true } }).map(|e| e.bytes).sum::<usize>()\n"
          "    };\n"
          "    while g.len() > PSDS_MAXIMO * 8 || (total(&g) > PSDS_BYTES_MAXIMO && g.len() > 1) {\n"
          "        g.remove(0);\n"
          "    }\n"
          "    Ok(psd)\n"
          "}\n"
          "/// Arcano: decodifica uma camada de PSD já guardado SEM ler o arquivo (`None`: não guardado).\n"
          "pub(crate) fn decode_psd_guardado(path: &str, footage: &Footage, op: AlphaOp) -> Option<Result<Image>> {\n"
          "    let psd = psd_guardado_pelo_caminho(path)?;\n"
          "    Some(decode_psd(path, &psd, footage, op))\n"
          "}\n"
          "fn decode_psd(path: &str, psd: &effectcraft_psd::Psd, footage: &Footage, op: AlphaOp) -> Result<Image> {\n"
          "    {\n")
    # o corpo antigo do ramo PSD vira o corpo de decode_psd: troca os `return Ok(Some(x))` por `return Ok(x)` e fecha
    troca(r, lay, "            return Ok(Some(straight_to_image(px.width, px.height, &px.data, op)));\n        }\n        // A smart object's embedded file",
          "            return Ok(straight_to_image(px.width, px.height, &px.data, op));\n        }\n        // A smart object's embedded file")
    troca(r, lay, "                    return Ok(Some(straight_to_image(baked.width, baked.height, &baked.data, op)));\n",
          "                    return Ok(straight_to_image(baked.width, baked.height, &baked.data, op));\n")
    troca(r, lay, "            return Ok(Some(straight_to_image(px.width, px.height, &px.data, op)));\n        }\n        let px = match &footage.layer {",
          "            return Ok(straight_to_image(px.width, px.height, &px.data, op));\n        }\n        let px = match &footage.layer {")
    troca(r, lay, "        .map_err(|e| MediaError::Decode(format!(\"{path}: {e}\")))?;\n        return Ok(Some(straight_to_image(px.width, px.height, &px.data, op)));\n    }\n    if is_svg(path, bytes) || is_pdf_like(path, bytes) {",
          "        .map_err(|e| MediaError::Decode(format!(\"{path}: {e}\")))?;\n        Ok(straight_to_image(px.width, px.height, &px.data, op))\n    }\n}\n"
          "pub(crate) fn decode(path: &str, bytes: &std::sync::Arc<[u8]>, footage: &Footage, op: AlphaOp) -> Result<Option<Image>> {\n"
          "    if effectcraft_psd::is_psd(bytes) {\n"
          "        let psd = psd_guardado(path, bytes)?;\n"
          "        return decode_psd(path, &psd, footage, op).map(Some);\n"
          "    }\n"
          "    if is_svg(path, bytes) || is_pdf_like(path, bytes) {")
    # os testes passavam &[u8]: agora `decode` quer Arc<[u8]>
    troca(r, lay, 'let e = decode("huge.svg", huge, &footage,', 'let e = decode("huge.svg", &std::sync::Arc::from(&huge[..]), &footage,')
    troca(r, lay, 'let img = decode("small.svg", small, &footage,', 'let img = decode("small.svg", &std::sync::Arc::from(&small[..]), &footage,')
    troca(r, "crates/media/src/pool.rs",
          "        let bytes = self.read(path)?;\n        if let Some(img) = crate::dpx::decode(path, &bytes)? {",
          "        // Arcano: PSD já interpretado: a camada sai dele sem reler o arquivo\n"
          "        if let Some(r) = crate::layered::decode_psd_guardado(path, footage, op) {\n"
          "            return r;\n"
          "        }\n"
          "        let bytes = self.read(path)?;\n        if let Some(img) = crate::dpx::decode(path, &bytes)? {")


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
          "                launch,\n                drawn: false,\n                painel: painel_arcano::Painel::new(\"video\").com_receber(painel_arcano::receber_video),\n                atualizador: atualizador_arcano::Atualizador::new(\"video\"),\n            }))")
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
          "        // Arquivo > Salvar como projeto do After: o painel monta o .aep e devolve (painel_arcano::receber_video)\n"
          "        for pedido in effectcraft_engine::arcano_aep::pedidos_salvar() {\n"
          "            self.painel.mandar(&pedido);\n"
          "        }\n"
          "        for aviso in painel_arcano::avisos() {\n"
          "            self.app.session.toast(aviso);\n"
          "        }\n"
          "        self.painel.trava(ui.ctx(), \"Arcano Motion\");\n"
          "        self.atualizador.quadro(ui.ctx(), \"Arcano Layers Vídeo\", effectcraft_ui_egui::ARCANO_CONFERIR_ATUALIZACAO.swap(false, std::sync::atomic::Ordering::Relaxed));\n")
    p = pathlib.Path(r) / "apps/effectcraft/Cargo.toml"
    p.write_text(p.read_text(encoding="utf-8") + '\n[target.\'cfg(any(windows, target_os = "macos"))\'.dependencies]\nwry = "0.57"\n', encoding="utf-8")
    # a aba "Arcano Motion" da doca (no lugar do VR Comp Editor), acima do Preview no layout padrão
    copia(arq / "ui-arcano-painel.rs", pathlib.Path(r) / "crates/ui-egui/src/arcano_painel.rs")
    troca(r, "crates/ui-egui/src/lib.rs", "pub mod control;\n", "pub mod arcano_painel;\npub mod control;\n")
    troca(r, "crates/ui-egui/src/panels.rs", "        PanelKind::VrCompEditor => path_vr_panels::vr_editor(app, ui, rect),",
          "        PanelKind::VrCompEditor => {\n            let _ = &app;\n            crate::arcano_painel::reservar(ui, rect)\n        }")
    troca(r, "crates/ui-egui/src/dock.rs", '            PanelKind::VrCompEditor => "VR Comp Editor",', '            PanelKind::VrCompEditor => "Arcano Motion",')
    # Janela ▸ Arcano Motion reabre a aba depois de fechada (o item existia com o nome antigo "VR Comp Editor")
    troca(r, "crates/engine/src/menus.rs", '  VR Comp Editor | window.panel {"panel":"vrCompEditor"}\n', '  Arcano Motion | window.panel {"panel":"vrCompEditor"}\n')
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


def procurar_atualizacao(r, app):
    """Programa de PC: Ajuda ▸ Procurar atualização confere na hora o build publicado (o atualizador do
    Arcano, arquivos/atualizador_arcano.rs, mostra "Atualizar agora", "já está na mais nova" ou o erro,
    com o número da versão). O do programa original ficava desligado (cinza) no editor de imagem."""
    lib = pathlib.Path(r) / "crates/ui-egui/src/lib.rs"
    lib.write_text(lib.read_text(encoding="utf-8") + "\n/// Arcano: Ajuda ▸ Procurar atualização foi pedido (o programa de PC confere e mostra o resultado).\n"
                   "pub static ARCANO_CONFERIR_ATUALIZACAO: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);\n", encoding="utf-8")
    if app == "effectcraft":
        troca(r, "crates/engine/src/menus.rs", "  Voltar ao início | help.website\n", "  Voltar ao início | help.website\n  Procurar atualização... | help.checkForUpdates\n")
        troca(r, "crates/ui-egui/src/menus/entries.rs", '    if e.command == "window.panel" {\n',
              '    if e.command == "help.checkForUpdates" {\n        return true;\n    }\n    if e.command == "window.panel" {\n')
    else:
        troca(r, "crates/ui-egui/src/menus/invoke.rs", "    if id == \"help.checkForUpdates\" {\n        return Some(crate::updates_ui::check(app, ctx, params.clone()));\n    }\n",
              "    if id == \"help.checkForUpdates\" {\n        crate::ARCANO_CONFERIR_ATUALIZACAO.store(true, std::sync::atomic::Ordering::Relaxed);\n        ctx.request_repaint();\n        return Some(Ok(Value::Null));\n    }\n")
        troca(r, "crates/ui-egui/src/menus/state.rs", "pub fn is_enabled(app: &PhotocraftApp, id: &str) -> bool {\n",
              "pub fn is_enabled(app: &PhotocraftApp, id: &str) -> bool {\n    if id == \"help.checkForUpdates\" {\n        return true;\n    }\n")


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


def guarda_crate(r):
    """Crate arcano-guarda (arquivos/arcano-guarda.rs): vigia de travamento, retrato de queda e
    memória do PC (Windows; nos outros sistemas não faz nada). Usado pelo registro do render
    (ui-arcano-render.rs) nas duas versões e ligado no programa de PC (guarda_travamento)."""
    d = pathlib.Path(r) / "crates/arcano-guarda"
    (d / "src").mkdir(parents=True, exist_ok=True)
    copia(pathlib.Path(__file__).parent / "arquivos/arcano-guarda.rs", d / "src/lib.rs")
    (d / "Cargo.toml").write_text(
        '[package]\nname = "arcano-guarda"\ndescription = "Arcano: vigia de travamento e retrato de queda"\n'
        'version.workspace = true\nedition.workspace = true\nlicense.workspace = true\nrust-version.workspace = true\n'
        '[dependencies]\nlog = { workspace = true }\n'
        "[target.'cfg(windows)'.dependencies]\n"
        'windows = { version = "0.62", features = ["Win32_Foundation", "Win32_System_Diagnostics_Debug", "Win32_System_Kernel", '
        '"Win32_System_Memory", "Win32_Storage_FileSystem", "Win32_System_Threading", "Win32_System_ProcessStatus", '
        '"Win32_System_SystemInformation", "Win32_UI_WindowsAndMessaging"] }\n', encoding="utf-8")
    print("ok  crates/arcano-guarda")
    troca(r, "crates/ui-egui/Cargo.toml", "[dependencies]\n", "[dependencies]\narcano-guarda = { path = \"../arcano-guarda\" }\n")


def guarda_travamento(r):
    """Programa de PC (vídeo), 08/11/2026: o dono perdeu o projeto 3 vezes num dia com o programa
    "Não respondendo" e nada no registro dizia onde. (1) Vigia de travamento e retrato de queda
    (crate arcano-guarda): parado 8 s grava [TRAVOU] + travou-<data>.dmp na pasta Logs; erro fatal
    grava [CAIU] + caiu-<data>.dmp. (2) Guarda os registros das últimas 8 aberturas (eram 2: depois
    de 3 quedas o da 1ª já tinha sumido). (3) Salvamento automático a cada 2 min (eram 20: perdia
    até 20 min de trabalho; quem escolheu outro valor que não 20 fica com o dele). (4) Ajuda ▸
    Abrir pasta de erros e registros. (5) Registro de quanto cada salvamento levou."""
    troca(r, "apps/effectcraft/Cargo.toml", "[dependencies]\n", "[dependencies]\narcano-guarda = { path = \"../../crates/arcano-guarda\" }\n")
    troca(r, "apps/effectcraft/src/main.rs",
          '            Ok(path) => log::info!("effectcraft {}, log file {}", env!("CARGO_PKG_VERSION"), path.display()),\n',
          '            Ok(path) => {\n'
          '                log::info!("effectcraft {}, log file {}", env!("CARGO_PKG_VERSION"), path.display());\n'
          '                arcano_guarda::ligar(effectcraft_engine::logging::log_dir(Some(&dir)));\n'
          '            }\n')
    troca(r, "crates/engine/src/system/logging.rs", "pub const KEEP: usize = 2;\n", "pub const KEEP: usize = 8;\n")
    troca(r, "crates/engine/src/settings/prefs/sections.rs", "    interval_minutes: u32 = 20,\n", "    interval_minutes: u32 = 2,\n")
    troca(r, "crates/engine/src/settings/session_settings.rs",
          "        let interval = a.interval_minutes.max(1) as f64 * 60.0;\n",
          "        // Arcano: 20 era o padrão antigo (preferência já gravada com ele) → 2 min\n"
          "        let minutos = if a.interval_minutes == 20 { 2 } else { a.interval_minutes };\n"
          "        let interval = minutos.max(1) as f64 * 60.0;\n")
    # salvar: quanto levou (o salvamento roda na janela; se demora, a janela para enquanto isso)
    troca(r, "crates/engine/src/cmd/file.rs",
          "    if crate::arcano_pacote::empacotar(path) {\n        return crate::arcano_pacote::salvar(s, path);\n    }\n",
          "    if crate::arcano_pacote::empacotar(path) {\n"
          "        let t0 = std::time::Instant::now();\n"
          "        log::info!(\"[salvar] começando: {path}\");\n"
          "        let r = crate::arcano_pacote::salvar(s, path);\n"
          "        log::info!(\"[salvar] {} em {:.1} s\", if r.is_ok() { \"ok\" } else { \"FALHOU\" }, t0.elapsed().as_secs_f64());\n"
          "        return r;\n"
          "    }\n")
    # Ajuda ▸ Abrir pasta de erros e registros
    troca(r, "crates/engine/src/menus.rs", "  Procurar atualização... | help.checkForUpdates\n",
          "  Procurar atualização... | help.checkForUpdates\n  Abrir pasta de erros e registros | arcano.abrirRegistros\n")
    troca(r, "crates/ui-egui/src/menus/entries.rs", '    if e.command == "help.checkForUpdates" {\n',
          '    if e.command == "arcano.abrirRegistros" {\n        return true;\n    }\n    if e.command == "help.checkForUpdates" {\n')
    troca(r, "crates/ui-egui/src/menus/invoke.rs", "    if id == \"arcano.hdTrabalho\" {\n",
          "    if id == \"arcano.abrirRegistros\" {\n"
          "        match effectcraft_engine::logging::session_file() {\n"
          "            Some(f) => crate::arcano_render::abrir_pasta(&f.to_string_lossy()),\n"
          "            None => app.ui.status = \"Sem pasta de registros nesta sessão\".into(),\n"
          "        }\n"
          "        return Ok(Value::Null);\n"
          "    }\n"
          "    if id == \"arcano.hdTrabalho\" {\n")


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
        troca(raiz, "crates/ui-egui/src/menus/frontend.rs", "            crate::updates_ui::check(app);\n            Value::Null",
              "            let _ = &app;\n            crate::ARCANO_CONFERIR_ATUALIZACAO.store(true, std::sync::atomic::Ordering::Relaxed);\n            Value::Null")
        procurar_atualizacao(raiz, "effectcraft")
        guarda_travamento(raiz)
        # Nome gravado no .exe (Gerenciador de Tarefas, barra de tarefas, propriedades do arquivo).
        troca(raiz, "apps/effectcraft/build.rs", '.set("ProductName", "EffectCraft")', f'.set("ProductName", "{NOME} Vídeo")')
        troca(raiz, "apps/effectcraft/build.rs", '.set("FileDescription", "EffectCraft motion graphics and visual effects")', f'.set("FileDescription", "{NOME} Vídeo")')
        nomes_restantes(raiz, pastas=("apps/effectcraft/src",), nomes=nomes)
    else:
        icones.gerar("imagem", pathlib.Path(raiz) / "assets/app-icon", "photocraft", "ai.storyteller.photocraft")
        painel_pc_imagem(raiz)
        procurar_atualizacao(raiz, "photocraft")
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
