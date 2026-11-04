"""Ícones dos programas instalados (Windows .ico, Mac .icns, PNGs que o app embute).
Vídeo (o "After") usa o ícone do Arcano Motion; imagem (o "Photoshop") usa o do ArcanoApp.
Uso: python3 icones.py <video|imagem> <pasta assets/app-icon do código> <prefixo dos arquivos>"""
import pathlib
import sys
from PIL import Image, ImageDraw

AQUI = pathlib.Path(__file__).parent / "assets" / "fontes"


def fonte(app):
    if app == "video":
        return Image.open(AQUI / "arcano-motion.png").convert("RGBA"), True   # logo transparente: vai num quadrado escuro
    return Image.open(AQUI / "arcanoapp-1080.png").convert("RGBA"), False  # já tem fundo claro


def ladrilho(app, tam, margem=0.0):
    """Quadrado arredondado (estilo ícone de app) com o logo, numa tela `tam` com margem."""
    logo, transparente = fonte(app)
    corpo = round(tam * (1 - 2 * margem))
    tile = Image.new("RGBA", (corpo, corpo), (0, 0, 0, 0))
    if transparente:
        fundo = Image.new("RGBA", (corpo, corpo))
        d = ImageDraw.Draw(fundo)
        for y in range(corpo):  # degradê roxo escuro do ArcanoApp
            t = y / max(1, corpo - 1)
            d.line([(0, y), (corpo, y)], fill=(int(52 + (24 - 52) * t), int(26 + (16 - 26) * t), int(88 + (36 - 88) * t), 255))
        lg = logo.resize((round(corpo * 0.92),) * 2, Image.LANCZOS)
        fundo.alpha_composite(lg, ((corpo - lg.width) // 2, (corpo - lg.height) // 2))
    else:
        fundo = logo.resize((corpo, corpo), Image.LANCZOS)
    m = Image.new("L", (corpo * 4, corpo * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, corpo * 4 - 1, corpo * 4 - 1], radius=round(corpo * 4 * 0.225), fill=255)
    tile.paste(fundo, (0, 0), m.resize((corpo, corpo), Image.LANCZOS))
    tela = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    tela.alpha_composite(tile, ((tam - corpo) // 2, (tam - corpo) // 2))
    return tela


def gerar(app, destino, prefixo, ident):
    destino = pathlib.Path(destino)
    grande = ladrilho(app, 1024)
    grande.save(destino / f"{prefixo}-1024.png")
    mac = ladrilho(app, 1024, margem=100 / 1024)  # grade da Apple: corpo 824 numa tela 1024
    if (destino / f"{prefixo}-macos-512.png").exists():
        mac.resize((512, 512), Image.LANCZOS).save(destino / f"{prefixo}-macos-512.png")
    mac.save(destino / f"{prefixo}.icns")
    grande.save(destino / f"{prefixo}.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    for s in (16, 24, 32, 48, 64, 128, 256, 512):
        p = destino / "hicolor" / f"{s}x{s}" / "apps" / f"{ident}.png"
        if p.parent.exists():
            grande.resize((s, s), Image.LANCZOS).save(p)
    print(f"ok  ícones {app} -> {destino} ({prefixo})")


if __name__ == "__main__":
    app, destino, prefixo = sys.argv[1:4]
    gerar(app, destino, prefixo, f"ai.storyteller.{prefixo}")
