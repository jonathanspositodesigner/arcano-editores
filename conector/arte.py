"""Gera as imagens do instalador (identidade do ArcanoApp): lateral das telas de
boas-vindas/fim (164x314) e faixa do topo (150x57). BMP 24 bits, como o NSIS pede."""
import pathlib
from PIL import Image, ImageDraw, ImageFont

AQUI = pathlib.Path(__file__).parent
LOGO = Image.open(AQUI.parent / "patches/assets/arcano-256.png").convert("RGBA")
FUNDO = (20, 16, 28)


def fonte(tam, negrito=True):
    for f in (["segoeuib.ttf", "C:/Windows/Fonts/segoeuib.ttf"] if negrito else ["segoeui.ttf", "C:/Windows/Fonts/segoeui.ttf"]) + \
             ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if negrito else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        try:
            return ImageFont.truetype(f, tam)
        except OSError:
            pass
    return ImageFont.load_default()


def degrade(w, h, cima, baixo):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(cima[i] + (baixo[i] - cima[i]) * t) for i in range(3)))
    return im


def brilho(im, cx, cy, raio, cor, forca):
    camada = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    for r in range(raio, 0, -2):
        a = int(forca * (1 - r / raio) ** 2)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=cor + (a,))
    return Image.alpha_composite(im.convert("RGBA"), camada)


def logo(tam):
    """Logo com cantos arredondados (o PNG é um quadrado claro)."""
    im = LOGO.resize((tam, tam), Image.LANCZOS)
    m = Image.new("L", (tam * 4, tam * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, tam * 4 - 1, tam * 4 - 1], radius=tam, fill=255)
    im.putalpha(Image.composite(im.getchannel("A"), Image.new("L", (tam, tam), 0), m.resize((tam, tam), Image.LANCZOS)))
    return im


def lateral():
    im = degrade(164, 314, (38, 18, 64), FUNDO)
    im = brilho(im, 82, 92, 90, (168, 85, 247), 120)
    im.alpha_composite(logo(96), (34, 44))
    d = ImageDraw.Draw(im)
    for texto, y, f, cor in (("Arcano", 168, fonte(20), (255, 255, 255)), ("Conector", 192, fonte(20), (192, 132, 252))):
        w = d.textlength(texto, font=f)
        d.text(((164 - w) / 2, y), texto, font=f, fill=cor)
    f = fonte(10, False)
    for i, linha in enumerate(("Liga o Arcano Layers", "do navegador ao", "Claude do seu PC")):
        w = d.textlength(linha, font=f)
        d.text(((164 - w) / 2, 232 + i * 14), linha, font=f, fill=(170, 160, 190))
    d.rectangle([0, 310, 164, 314], fill=(168, 85, 247))
    im.convert("RGB").save(AQUI / "lado.bmp")


def topo():
    im = Image.new("RGBA", (150, 57), FUNDO + (255,))
    im = brilho(im, 120, 28, 40, (168, 85, 247), 90)
    im.alpha_composite(logo(38), (102, 10))
    im.convert("RGB").save(AQUI / "topo.bmp")


lateral()
topo()
print("ok lado.bmp topo.bmp")
