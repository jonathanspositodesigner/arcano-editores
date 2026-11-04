"""Dados de cada programa instalável (lido pelo build do PC)."""
import json
import sys

APPS = {
    "video": {"repo": "storytold/effectcraft", "ref_var": "EFFECTCRAFT_REF", "crate": "effectcraft", "patch": "effectcraft",
              "nome": "Arcano Layers Vídeo", "pasta": "ArcanoLayersVideo", "arquivo": "ArcanoLayers-Video",
              "id": "br.com.voxvisual.arcano.layers.video",
              "titulo2": "Vídeo", "linhas": "Editor de vídeo e motion|com o Arcano Motion|no seu computador"},
    "imagem": {"repo": "storytold/photocraft", "ref_var": "PHOTOCRAFT_REF", "crate": "photocraft", "patch": "photocraft",
               "nome": "Arcano Layers Imagem", "pasta": "ArcanoLayersImagem", "arquivo": "ArcanoLayers-Imagem",
               "id": "br.com.voxvisual.arcano.layers.imagem",
               "titulo2": "Imagem", "linhas": "Editor de imagem|com o Arcano Motion|no seu computador"},
}

if __name__ == "__main__":
    app = sys.argv[1]
    for k, v in APPS[app].items():
        print(f"{k.upper()}={v}")
