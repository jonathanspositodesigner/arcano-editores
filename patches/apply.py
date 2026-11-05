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
                          f'<title>{NOME} · Imagem</title>\n  <link rel="icon" href="arcano.svg" type="image/svg+xml">')
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
    copia(ASSETS / "arcano-128.png", pathlib.Path(r) / "assets/app-icon/hicolor/128x128/apps/ai.storyteller.photocraft.png")
    # Nome deles em qualquer texto que sobrou (menus, mensagens, traduções .tsv).
    nomes_restantes(r, pastas=("crates/ui-egui", "crates/engine", "apps/photocraft-web", "apps/photocraft-web-boot"),
                    nomes=(("PhotoCraft", None), ("ArtCraft", "ArcanoApp"), ("getartcraft.com", "arcanoapp.voxvisual.com.br")))


ASSETS = pathlib.Path(__file__).parent / "assets"


def copia(origem, destino):
    destino.write_bytes(origem.read_bytes())
    print(f"ok  {destino.name} <- {origem.name}")


def effectcraft(r):
    # Logo do ArtCraft (marca registrada deles, não é open source) vira o logo do Arcano.
    copia(ASSETS / "arcano-256.png", pathlib.Path(r) / "docs/brand/artcraft-mark.png")
    for nome, arq in (("favicon.svg", "arcano.svg"), ("icon-256.png", "arcano-256.png"), ("icon-512.png", "arcano-512.png")):
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
    # O plugin grava quadros/arquivos pelo script (no navegador vão para a memória do editor e
    # voltam ao PC pelo conector): liberado por padrão.
    troca(r, "crates/engine/src/settings/prefs/sections.rs", "    allow_scripts_write_files: bool = false,", "    allow_scripts_write_files: bool = true,")
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


def desktop(app, raiz):
    """Versão para instalar no PC: ícones do Arcano e nome Arcano Layers também nas partes
    que só existem no programa de computador (janela, diálogos)."""
    sys.path.insert(0, str(pathlib.Path(__file__).parent))
    import icones
    nomes = (("EffectCraft", None), ("PhotoCraft", None), ("ArtCraft", "ArcanoApp"), ("getartcraft.com", "arcanoapp.voxvisual.com.br"))
    if app == "effectcraft":
        icones.gerar("video", pathlib.Path(raiz) / "assets/app-icon", "effectcraft", "ai.storyteller.effectcraft")
        nomes_restantes(raiz, pastas=("apps/effectcraft/src",), nomes=nomes)
    else:
        icones.gerar("imagem", pathlib.Path(raiz) / "assets/app-icon", "photocraft", "ai.storyteller.photocraft")
        nomes_restantes(raiz, pastas=("apps/photocraft/src",), nomes=nomes)


if __name__ == "__main__":
    app, raiz = sys.argv[1], sys.argv[2]
    {"photocraft": photocraft, "effectcraft": effectcraft}[app](raiz)
    if "--desktop" in sys.argv[3:]:
        desktop(app, raiz)
    print("patches aplicados:", app)
