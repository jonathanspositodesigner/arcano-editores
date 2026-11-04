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
    # Menu Ajuda: o item do Discord passa a abrir o ArcanoApp.
    troca(r, "crates/ui-egui/src/links.rs",
          'pub const DISCORD: &str = "https://discord.gg/artcraft";',
          'pub const DISCORD: &str = "https://arcanoapp.voxvisual.com.br";')
    troca(r, "crates/engine/src/shell_commands.rs",
          '"Join the ArtCraft Discord…"', '"Abrir o ArcanoApp…"')
    # Título da aba do navegador.
    for f in ("apps/photocraft-web/index.html", "apps/photocraft-web-boot/index.html"):
        p = pathlib.Path(r) / f
        t = p.read_text(encoding="utf-8")
        if "<title>PhotoCraft</title>" in t:
            t = t.replace("<title>PhotoCraft</title>",
                          f'<title>{NOME} · Imagem</title>\n  <link rel="icon" href="arcano.svg" type="image/svg+xml">')
            p.write_text(t, encoding="utf-8")
            print(f"ok  {f}")
    # Tela de carregamento (a que aparece antes do editor abrir).
    troca(r, "apps/photocraft-web-boot/index.html", "<p>Loading PhotoCraft&hellip;</p>", f"<p>Carregando {NOME}&hellip;</p>")
    troca(r, "apps/photocraft-web-boot/index.html",
          "This is taking longer than usual. If PhotoCraft doesn't start, its files may have failed to\n      download or come from a different version of this page. <a href=\"\">Reload</a> to try again; the browser\n      console lists what failed.",
          "Está demorando mais que o normal. Se não abrir, <a href=\"\">recarregue a página</a>.")
    # Ícone do canto superior esquerdo (onde o Photoshop mostra o "Ps").
    copia(ASSETS / "arcano-128.png", pathlib.Path(r) / "assets/app-icon/hicolor/128x128/apps/ai.storyteller.photocraft.png")


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


if __name__ == "__main__":
    app, raiz = sys.argv[1], sys.argv[2]
    {"photocraft": photocraft, "effectcraft": effectcraft}[app](raiz)
    print("patches aplicados:", app)
