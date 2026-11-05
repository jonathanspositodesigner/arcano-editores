"""Projeto do After Effects (.aep/.aet) -> script do editor (modelo do After).

Roda no painel do Arcano Motion (Pyodide, no navegador e no programa de PC). Lê o projeto com o
py-aep (MIT) e escreve um script no modelo do After (app.project, comps, layers, properties) que o
editor executa: monta, dentro de uma pasta com o nome do arquivo, as pastas, os arquivos, as
composições e as camadas do jeito que estavam no After (tempos, transformações com keyframes e
easing, efeitos, máscaras, formas, textos, expressões, pais e mates).

O que o editor não tiver (efeito de terceiros, propriedade desconhecida) não para a importação:
vira um aviso na lista que o script devolve.
"""

from __future__ import annotations

import json
import math
import sys
import types

# No navegador (Pyodide) alguns módulos da biblioteca padrão vêm à parte (lzma). O py-aep só usa
# para medir mídia: um substituto vazio basta (falha só se alguém chamar).
for _m in ("lzma",):
    try:
        __import__(_m)
    except ImportError:
        _f = types.ModuleType(_m)

        def _falta(*a, _n=_m, **k):
            raise ImportError(_n + " indisponível no navegador")

        _f.__getattr__ = lambda nome, _falta=_falta: _falta
        sys.modules[_m] = _f

import py_aep
from py_aep.enums import BlendingMode, MaskMode, ParagraphJustification, TrackMatteType

# Grupos da camada que não entram (dados internos do After, sem efeito na imagem ou não suportados).
_IGNORAR = {
    "ADBE MTrackers", "ADBE Layer Overrides", "ADBE Layer Sets", "ADBE Source Options Group",
    "ADBE Data Group", "ADBE Plane Options Group", "ADBE Extrsn Options Group", "ADBE Marker",
    "ADBE Effect Built In Params", "ADBE Layer Source Alternate", "ADBE Envir Appear in Reflect",
}
# Os grupos do 3D só importam em camada 3D.
_SO_3D = {"ADBE Material Options Group"}

# Estilo de camada do After -> estilo do editor (layer.style.add).
_ESTILOS = {
    "dropShadow/enabled": "dropShadow", "innerShadow/enabled": "innerShadow", "outerGlow/enabled": "outerGlow",
    "innerGlow/enabled": "innerGlow", "bevelEmboss/enabled": "bevelEmboss", "chromeFX/enabled": "satin",
    "solidFill/enabled": "colorOverlay", "gradientFill/enabled": "gradientOverlay", "frameFX/enabled": "stroke",
}

# Nome interno diferente no editor (propriedade).
_NOMES = {
    "ADBE Vector Repeater Anchor": "ADBE Vector Anchor", "ADBE Vector Repeater Position": "ADBE Vector Position",
    "ADBE Vector Repeater Scale": "ADBE Vector Scale", "ADBE Vector Repeater Rotation": "ADBE Vector Rotation",
    "ADBE Vector Repeater Opacity 1": "startOpacity", "ADBE Vector Repeater Opacity 2": "endOpacity",
}
# Efeito antigo do After -> efeito do editor + parâmetros (sufixo antigo -> novo).
_EFEITOS = {
    "ADBE Easy Levels": ("ADBE Easy Levels2", {"0001": "0001", "0003": "0002", "0004": "0003", "0005": "0004",
                                               "0006": "0005", "0007": "0006", "0008": "0007", "0009": "0008"}),
}

_INTERP = {6612: "KeyframeInterpolationType.LINEAR", 6613: "KeyframeInterpolationType.BEZIER", 6614: "KeyframeInterpolationType.HOLD"}


def _enum(cls, v):
    """Nome do enum do After (o editor numera alguns enums em outra ordem: usar sempre o NOME)."""
    try:
        return cls(int(v)).name
    except Exception:
        return None


def _js(v) -> str:
    """Valor Python -> literal JavaScript."""
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            return "0"
        r = round(float(v), 6)
        return str(int(r)) if r == int(r) and abs(r) < 1e15 else repr(r)
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, (list, tuple)):
        return "[" + ",".join(_js(x) for x in v) + "]"
    return json.dumps(str(v), ensure_ascii=False)


def _nome_tipo(o) -> str:
    return type(o).__name__


def _tem_valor(p) -> bool:
    """Parâmetro com valor (não marcador de grupo nem desenho do efeito)."""
    try:
        t = p.property_value_type
        return t is None or getattr(t, "name", "") != "NO_VALUE"
    except Exception:
        return True


def _eh_grupo(p) -> bool:
    return hasattr(p, "properties") and not hasattr(p, "keyframes")


class Conversor:
    def __init__(self, proj, nome_arquivo: str):
        self.proj = proj
        self.nome = nome_arquivo
        self.L: list[str] = []
        self.n = 0
        self.avisos: list[str] = []
        self.fontes: list[str] = []
        self.trechos: list = []

    def v(self) -> str:
        self.n += 1
        return f"v{self.n}"

    def w(self, s: str) -> None:
        self.L.append(s)

    # ------------------------------------------------------------------ itens
    def itens(self) -> None:
        raiz = self.proj.root_folder
        pastas, arquivos, comps = [], [], []

        def andar(pasta):
            for it in pasta.items:
                t = _nome_tipo(it)
                if t == "FolderItem":
                    pastas.append(it)
                    andar(it)
                elif t == "CompItem":
                    comps.append(it)
                elif t == "FootageItem":
                    arquivos.append(it)

        andar(raiz)
        self.raiz_id = getattr(raiz, "id", None)

        def pai(it):
            p = it.parent_folder
            return "RAIZ" if p is None or p is raiz else f"IT[{_js(p.id)}]"

        for f in pastas:
            self.w(f"IT[{_js(f.id)}]=P.items.addFolder({_js(f.name)});IT[{_js(f.id)}].label={_js(int(f.label))};")
        for f in pastas:
            self.w(f"IT[{_js(f.id)}].parentFolder={pai(f)};")
        for a in arquivos:
            src = a.main_source
            ts = _nome_tipo(src)
            dur = float(getattr(a, "duration", 0) or 0)
            fps = float(getattr(a, "frame_rate", 0) or 0)
            w, h = int(getattr(a, "width", 0) or 0), int(getattr(a, "height", 0) or 0)
            if ts == "SolidSource":
                cor = list(src.color)[:3]
                self.w(f"SOL[{_js(a.id)}]={{nome:{_js(a.name)},cor:{_js(cor)},w:{w},h:{h},par:{_js(a.pixel_aspect)},pai:{pai(a)}}};")
                continue
            caminho = getattr(src, "file", None) or ""
            camada = getattr(src, "layer_name", None) if ts == "FileSource" else None
            self.w(f"ARQ({_js(a.id)},{_js(a.name)},{_js(caminho)},{_js(camada)},{w},{h},{_js(fps)},{_js(dur)},{pai(a)});")
        for c in comps:
            bg = list(c.bg_color)[:3] if getattr(c, "bg_color", None) is not None else [0, 0, 0]
            self.w(
                f"IT[{_js(c.id)}]=P.items.addComp({_js(c.name)},{int(c.width)},{int(c.height)},{_js(c.pixel_aspect)},{_js(c.duration)},{_js(c.frame_rate)});"
                f"COMP({_js(c.id)},{pai(c)},{_js(bg)},{_js(c.display_start_time)},{_js(c.work_area_start)},{_js(c.work_area_duration)},{_js(int(c.label))});"
            )
        self.comps = comps

    # ----------------------------------------------------------------- camadas
    def camadas(self) -> None:
        for c in self.comps:
            ls = list(c.layers)
            self.w(f"C=IT[{_js(c.id)}];")
            # O add põe no topo: de baixo para cima mantém a ordem do After.
            for l in reversed(ls):
                self.camada(c, l)
        # Pais e mates depois de todas as camadas existirem.
        for c in self.comps:
            for l in c.layers:
                ref = f"LY[{_js(f'{c.id}_{l.id}')}]"
                par = getattr(l, "parent", None)
                if par is not None:
                    self.w(f"T(function(){{{ref}.parent=LY[{_js(f'{c.id}_{par.id}')}];}},'pai de '+{_js(l.name)});")
                tm = getattr(l, "track_matte_layer", None)
                tt = getattr(l, "track_matte_type", None)
                nt = _enum(TrackMatteType, tt) if tt is not None else None
                if tm is not None and nt and nt != "NO_TRACK_MATTE":
                    self.w(f"T(function(){{{ref}.setTrackMatte(LY[{_js(f'{c.id}_{tm.id}')}],TrackMatteType[{_js(nt)}]);}},'mate de '+{_js(l.name)});")

    def camada(self, c, l) -> None:
        t = _nome_tipo(l)
        ref = f"LY[{_js(f'{c.id}_{l.id}')}]"
        src = getattr(l, "source", None)
        nome = l.name
        if t == "TextLayer":
            self.w(f"L=C.layers.addText('');")
        elif t == "ShapeLayer":
            self.w("L=C.layers.addShape();")
        elif t == "CameraLayer":
            self.w(f"L=C.layers.addCamera({_js(nome)},[{c.width / 2},{c.height / 2}]);")
        elif t == "LightLayer":
            self.w(f"L=C.layers.addLight({_js(nome)},[{c.width / 2},{c.height / 2}]);")
        elif getattr(l, "null_layer", False):
            self.w("L=C.layers.addNull();")
        elif src is not None and _nome_tipo(src) == "FootageItem" and _nome_tipo(src.main_source) == "SolidSource":
            self.w(f"L=SOLIDA(C,{_js(src.id)});")
        elif src is not None:
            self.w(f"L=FONTE(C,{_js(src.id)},{_js(nome)});")
        else:
            self.avisos.append(f"camada sem origem: {nome}")
            self.w("L=C.layers.addNull();")
        self.w(f"{ref}=L;")
        props = []
        for k, js in (("name", "name"), ("enabled", "enabled"), ("shy", "shy"), ("solo", "solo"),
                      ("three_d_layer", "threeDLayer"), ("adjustment_layer", "adjustmentLayer"),
                      ("motion_blur", "motionBlur"), ("collapse_transformation", "collapseTransformation"),
                      ("guide_layer", "guideLayer"), ("audio_enabled", "audioEnabled")):
            try:
                val = getattr(l, k)
            except Exception:
                continue
            if val is None:
                continue
            if k == "name" or val:
                props.append(f"L.{js}={_js(val)}")
            elif k in ("enabled", "audio_enabled"):
                props.append(f"L.{js}=false")
        try:
            props.append(f"L.label={_js(int(l.label))}")
        except Exception:
            pass
        nb = _enum(BlendingMode, getattr(l, "blending_mode", 5212))
        if nb and nb != "NORMAL":
            props.append(f"L.blendingMode=EN(BlendingMode,{_js(nb)})")
        for p in props:
            self.w(f"T(function(){{{p};}},{_js(nome)});")
        # Tempo: início, velocidade e corte (nessa ordem, como no After).
        try:
            st, stretch, i, o = float(l.start_time), float(getattr(l, "stretch", 100) or 100), float(l.in_point), float(l.out_point)
            self.w(f"TEMPO(L,{_js(st)},{_js(stretch)},{_js(i)},{_js(o)});")
        except Exception as e:
            self.avisos.append(f"tempo de {nome}: {e}")
        try:
            if getattr(l, "time_remap_enabled", False):
                self.w("T(function(){L.timeRemapEnabled=true;},'remapear tempo');")
        except Exception:
            pass
        self.e3d = bool(getattr(l, "three_d_layer", False))
        for g in l.properties:
            self.grupo_raiz(g)
        if t == "TextLayer":
            pass

    # ------------------------------------------------------------- propriedades
    def grupo_raiz(self, g) -> None:
        mn = g.match_name
        if mn in _IGNORAR or (mn in _SO_3D and not self.e3d):
            return
        if not _eh_grupo(g):
            self.prop("L", g)
            return
        if mn == "ADBE Layer Styles":
            self.estilos(g)
            return
        var = self.v()
        corpo_ini = len(self.L)
        self.w(f"var {var}=G(L,{_js(mn)});if({var}){{")
        self.filhos(var, g)
        if len(self.L) == corpo_ini + 1:
            self.L.pop()
            return
        self.w("}")

    def estilos(self, g) -> None:
        """Estilos de camada (Sombra projetada, Sobreposição de cor...): o editor tem os mesmos, com
        os mesmos nomes de propriedade do After; cada propriedade vai pelo nome."""
        for s in g.properties:
            try:
                if not _eh_grupo(s) or s.match_name == "ADBE Blend Options Group" or not getattr(s, "enabled", False):
                    continue
            except Exception:
                continue
            ident = _ESTILOS.get(s.match_name)
            if not ident:
                self.avisos.append(f"estilo de camada {s.name}")
                continue
            v2 = self.v()
            self.w(f"var {v2}=ESTILO(L,{_js(ident)},{_js(s.name)});if({v2}){{")
            for p in s.properties:
                if not _eh_grupo(p):
                    self.prop(v2, p, por_nome=True)
            self.w("}")

    def filhos(self, var: str, g) -> None:
        # Posição X/Y/Z separadas só valem com "Separar dimensões" ligado (senão o After nem lê).
        separadas = set()
        for p in g.properties:
            try:
                if not _eh_grupo(p) and getattr(p, "dimensions_separated", False):
                    separadas.add(p.match_name)
            except Exception:
                pass
        indexado = False
        try:
            indexado = int(g.property_type) == 6214
        except Exception:
            pass
        # Efeito: o editor agrupa os parâmetros e alguns efeitos de terceiros têm outro nome interno.
        # Cada parâmetro com valor leva a posição dele (o editor acha pela posição se não achar pelo nome).
        efeito = {}
        try:
            pai = g.parent_property
            if pai is not None and pai.match_name == "ADBE Effect Parade":
                for p in g.properties:
                    if not _eh_grupo(p) and _tem_valor(p):
                        efeito[p.match_name] = len(efeito)
        except Exception:
            efeito = {}
        self.efeito_atual = (efeito, len(efeito)) if efeito else None
        for p in g.properties:
            mn = p.match_name
            if mn in _IGNORAR or (mn in _SO_3D and not self.e3d):
                continue
            if "_" in mn and mn.rsplit("_", 1)[1] in ("0", "1", "2") and mn.rsplit("_", 1)[0] not in separadas:
                continue
            if _eh_grupo(p):
                v2 = self.v()
                ini = len(self.L)
                if indexado:
                    self.w(f"var {v2}=ADD({var},{_js(_EFEITOS[mn][0] if mn in _EFEITOS else mn)});if({v2}){{")
                    try:
                        if p.name and getattr(p, "is_name_set", False):
                            self.w(f"T(function(){{{v2}.name={_js(p.name)};}});")
                    except Exception:
                        pass
                    try:
                        if not p.enabled:
                            self.w(f"T(function(){{{v2}.enabled=false;}});")
                    except Exception:
                        pass
                    if mn == "ADBE Mask Atom":
                        mm = _enum(MaskMode, getattr(p, "mask_mode", 6813))
                        if mm and mm != "ADD":
                            self.w(f"T(function(){{{v2}.maskMode=EN(MaskMode,{_js(mm)});}},'máscara');")
                        if getattr(p, "inverted", False):
                            self.w(f"T(function(){{{v2}.inverted=true;}},'máscara');")
                else:
                    self.w(f"var {v2}=G({var},{_js(mn)});if({v2}){{")
                self.filhos(v2, p)
                if not indexado and len(self.L) == ini + 1:
                    self.L.pop()
                    continue
                self.w("}")
            else:
                if not _tem_valor(p):
                    continue
                if g.match_name in _EFEITOS:
                    novo, mapa = _EFEITOS[g.match_name]
                    suf = mn.rsplit("-", 1)[-1]
                    if suf in mapa:
                        self.prop(var, p, nome=f"{novo}-{mapa[suf]}")
                    continue
                self.prop(var, p, efeito=(efeito[mn], len(efeito)) if mn in efeito else None)

    def valor(self, p, v):
        """Valor de propriedade -> JavaScript (Shape, TextDocument, cor, número...)."""
        tn = _nome_tipo(v)
        if tn == "Shape":
            return f"SH({_js(v.vertices)},{_js(v.in_tangents)},{_js(v.out_tangents)},{_js(bool(v.closed))})"
        if tn == "TextDocument":
            return self.texto(v)
        if tn == "Gradient":
            return self.gradiente(v)
        if tn in ("MarkerValue", "Curves"):
            return None
        if isinstance(v, (int, float, list, tuple)):
            return _js(list(v) if isinstance(v, tuple) else v)
        return None

    def gradiente(self, g):
        """Gradiente (Sobreposição de gradiente, preenchimento de forma): paradas de cor e de opacidade."""
        try:
            cores = [[float(c.offset), float(c.midpoint), [float(x) for x in list(c.color)[:3]]] for c in g.color_stops]
            alfas = [[float(a.offset), float(a.midpoint), float(a.alpha)] for a in g.alpha_stops]
        except Exception:
            return None
        return f"GR({_js(cores)},{_js(alfas)})"

    def texto(self, d) -> str:
        o = {}
        for k, js in (("text", "text"), ("font", "font"), ("font_size", "fontSize"), ("fill_color", "fillColor"),
                      ("stroke_color", "strokeColor"), ("apply_fill", "applyFill"), ("apply_stroke", "applyStroke"),
                      ("stroke_width", "strokeWidth"), ("stroke_over_fill", "strokeOverFill"), ("tracking", "tracking"),
                      ("leading", "leading"), ("auto_leading", "autoLeading"), ("faux_bold", "fauxBold"),
                      ("faux_italic", "fauxItalic"), ("horizontal_scale", "horizontalScale"),
                      ("vertical_scale", "verticalScale"), ("baseline_shift", "baselineShift"),
                      ("box_text", "boxText"), ("box_text_size", "boxTextSize"), ("box_text_pos", "boxTextPos")):
            try:
                val = getattr(d, k)
            except Exception:
                continue
            if val is None:
                continue
            if isinstance(val, tuple):
                val = list(val)
            if hasattr(val, "__iter__") and not isinstance(val, (str, list)):
                try:
                    val = list(val)
                except Exception:
                    continue
            o[js] = val
        if isinstance(o.get("font"), str) and o["font"] not in self.fontes:
            self.fontes.append(o["font"])
        try:
            j = _enum(ParagraphJustification, d.justification)
            if j:
                o["justification"] = j
        except Exception:
            pass
        try:
            caps = d.all_caps
            if caps:
                o["allCaps"] = True
        except Exception:
            pass
        self.trechos = self._trechos(d)
        return "TD(" + _js_obj(o) + ")"

    def _trechos(self, d) -> list:
        """Trechos do texto com estilo próprio (fonte, tamanho, cor... diferentes na mesma camada)."""
        try:
            from py_aep.cos.cos import run_spans

            spans = run_spans(d._doc, "6", "6")
            fontes = d._fonts
        except Exception:
            return []
        if len({(st.get("0"), st.get("1"), str(st.get("53")), st.get("8"), st.get("2"), st.get("3")) for _, _, st in spans}) < 2:
            return []
        n = len(d.text)
        out = []
        for a, b, st in spans:
            a, b = min(a, n), min(b, n)
            if b <= a:
                continue
            o = {"range": [a, b]}
            i = st.get("0")
            if isinstance(i, int) and 0 <= i < len(fontes):
                try:
                    o["font"] = fontes[i].post_script_name
                    if o["font"] not in self.fontes:
                        self.fontes.append(o["font"])
                except Exception:
                    pass
            if isinstance(st.get("1"), (int, float)):
                o["size"] = float(st["1"])
            if isinstance(st.get("8"), (int, float)):
                o["tracking"] = float(st["8"])
            for k, js in (("2", "fauxBold"), ("3", "fauxItalic")):
                if isinstance(st.get(k), bool):
                    o[js] = st[k]
            for k, js in (("53", "fill"), ("54", "stroke")):
                try:
                    argb = st.get(k)["0"]["1"]
                    o[js] = [float(argb[1]), float(argb[2]), float(argb[3]), 1]
                except Exception:
                    pass
            out.append(o)
        return out

    def prop(self, var: str, p, por_nome: bool = False, efeito=None, nome=None) -> None:
        mn = p.match_name
        if mn in _IGNORAR:
            return
        try:
            kfs = list(p.keyframes or [])
        except Exception:
            kfs = []
        try:
            ex = p.expression or ""
        except Exception:
            ex = ""
        try:
            mod = bool(p.is_modified)
        except Exception:
            mod = True
        if not kfs and not ex and not mod:
            # o py-aep não marca gradiente como mudado: confere pelo tipo
            try:
                mod = _nome_tipo(p.value) == "Gradient"
            except Exception:
                mod = False
        if not kfs and not ex and not mod:
            return
        try:
            sep = bool(getattr(p, "dimensions_separated", False))
        except Exception:
            sep = False
        ed = p.name if por_nome else (nome or _NOMES.get(mn, mn))
        alvo = f"P_({var},{_js(ed)})" if efeito is None else f"PE({var},{_js(mn)},{efeito[0]},{efeito[1]})"
        linhas = []
        if sep:
            linhas.append(f"p.dimensionsSeparated=true;")
        elif kfs:
            tempos, vals = [], []
            ok = True
            for k in kfs:
                try:
                    vv = self.valor(p, k.value)
                except Exception:
                    vv = None
                if vv is None:
                    ok = False
                    break
                tempos.append(_js(k.time))
                vals.append(vv)
            if ok:
                ei, eo, ii, io, si, so, fl = [], [], [], [], [], [], []
                for k in kfs:
                    ii.append(int(k.in_interpolation_type))
                    io.append(int(k.out_interpolation_type))
                    try:
                        ei.append([[e.speed, e.influence] for e in k.in_temporal_ease])
                        eo.append([[e.speed, e.influence] for e in k.out_temporal_ease])
                    except Exception:
                        ei.append(None)
                        eo.append(None)
                    try:
                        a, b = k.in_spatial_tangent, k.out_spatial_tangent
                        si.append(list(a) if a is not None else None)
                        so.append(list(b) if b is not None else None)
                    except Exception:
                        si.append(None)
                        so.append(None)
                    f = 0
                    for bit, nome in ((1, "roving"), (2, "temporal_continuous"), (4, "temporal_auto_bezier"),
                                      (8, "spatial_continuous"), (16, "spatial_auto_bezier")):
                        try:
                            if getattr(k, nome):
                                f |= bit
                        except Exception:
                            pass
                    fl.append(f)
                linhas.append(
                    f"K(p,[{','.join(tempos)}],[{','.join(vals)}],{_js(ii)},{_js(io)},{_js(ei)},{_js(eo)},{_js(si)},{_js(so)},{_js(fl)});"
                )
            else:
                self.avisos.append(f"keyframes de {p.name} ({mn})")
        elif mod:
            self.trechos = []
            try:
                vv = self.valor(p, p.value)
            except Exception:
                vv = None
            if vv is not None:
                linhas.append(f"SV(p,{vv});")
                if self.trechos:
                    linhas.append(f"TRECHOS(L,{_js_lista_obj(self.trechos)});")
                self.trechos = []
        if ex:
            linhas.append(f"p.expression={_js(ex)};")
            try:
                if not p.expression_enabled:
                    linhas.append("p.expressionEnabled=false;")
            except Exception:
                pass
        if linhas:
            self.w(f"T(function(){{var p={alvo};if(!p)return;{''.join(linhas)}}},{_js(mn)});")

    # ---------------------------------------------------------------- tudo
    def gerar(self) -> str:
        self.itens()
        self.camadas()
        corpo = "\n".join(self.L)
        return PRELUDIO.replace("__NOME__", _js(self.nome)) + corpo + "\n" + FIM


def _js_lista_obj(l: list) -> str:
    return "[" + ",".join(_js_obj(o) for o in l) + "]"


def _js_obj(o: dict) -> str:
    return "{" + ",".join(f"{json.dumps(k)}:{_js(v)}" for k, v in o.items()) + "}"


PRELUDIO = r"""(function(){
var P=app.project,AV=[],FALTA=[],IT={},SOL={},LY={},C=null,L=null;
app.beginUndoGroup("Importar projeto do After");
var RAIZ=P.items.addFolder(__NOME__);
function T(f,o){try{f();}catch(e){AV.push((o?o+': ':'')+(e&&e.message?e.message:e));}}
// sem o grupo de áudio = camada sem som (ou arquivo que faltou): não é aviso
function G(g,m){var r=null;try{r=g.property(m);}catch(e){}if(!r&&m!=='ADBE Audio Group')AV.push('sem '+m);return r;}
function ADD(g,m){var r=null;try{r=g.addProperty(m);}catch(e){AV.push('sem '+m+' ('+(e&&e.message?e.message:e)+')');return null;}if(!r)AV.push('sem '+m);return r;}
// propriedade pelo nome interno; o editor agrupa alguns parâmetros de efeito (o After deixa soltos):
// procura também dentro dos grupos. Marcador de grupo do After (sem valor) não é aviso.
function FUNDO(g,m,n){if(n>3)return null;var t=0;try{t=g.numProperties;}catch(e){return null;}
 for(var i=1;i<=t;i++){var c=null;try{c=g.property(i);}catch(e){continue;}if(!c)continue;
  try{if(c.matchName===m)return c;}catch(e){}try{if(c.propertyType!==PropertyType.PROPERTY){var r=FUNDO(c,m,n+1);if(r)return r;}}catch(e){}}return null;}
// parâmetro de efeito: pelo nome interno; se não achar, pela posição entre os parâmetros com valor
// (mesma quantidade no After e no editor)
function VALS(g,o){var t=0;try{t=g.numProperties;}catch(e){return o;}for(var i=1;i<=t;i++){var c=null;try{c=g.property(i);}catch(e){continue;}if(!c)continue;
 var k=0;try{k=c.propertyType;}catch(e){}if(k===PropertyType.PROPERTY)o.push(c);else VALS(c,o);}return o;}
function PE(g,m,i,n){var r=null;try{r=g.property(m);}catch(e){}if(!r)r=FUNDO(g,m,0);
 if(r){try{if(r.propertyType===PropertyType.PROPERTY)return r;}catch(e){return r;}}
 if(!g.__vals)g.__vals=VALS(g,[]);if(g.__vals.length===n)return g.__vals[i];AV.push('sem '+m);return null;}
function P_(g,m){var r=null;try{r=g.property(m);}catch(e){}if(!r)r=FUNDO(g,m,0);if(!r){AV.push('sem '+m);return null;}
 try{if(r.propertyType!==PropertyType.PROPERTY)return null;}catch(e){}return r;}
function SH(v,i,o,c){var s=new Shape();s.vertices=v;s.inTangents=i;s.outTangents=o;s.closed=c;return s;}
function ESTILO(l,id,nome){try{__call("layer.style.add",l.__p({style:id}));}catch(e){AV.push('estilo '+nome+': '+(e&&e.message?e.message:e));return null;}
 var s=G(l,'ADBE Layer Styles');if(!s)return null;var g=null;try{g=s.property(nome);}catch(e){}if(!g)AV.push('estilo '+nome);return g;}
function TRECHOS(l,t){for(var i=0;i<t.length;i++){var o=t[i];T(function(){__call("layer.setText",l.__p1(o));},'estilo do texto');}}
function SV(p,v){if(v&&v.t==="Gradient"){__call("prop.set",p.__ref({value:v}));return;}
 if(typeof v==='number'){var a;try{a=p.value;}catch(e){}if(typeof a==='string')return;}p.setValue(v);}
function GR(c,a){
 // paradas do After [posição, meio, cor/alfa] -> gradiente do editor; o "meio" fora de 50% vira uma parada a mais
 function mist(x,y,t){if(typeof x==='number')return x+(y-x)*t;var r=[];for(var i=0;i<x.length;i++)r.push(x[i]+(y[i]-x[i])*t);return r;}
 function paradas(l){var o=[];for(var i=0;i<l.length;i++){o.push([l[i][0],l[i][2]]);
  if(i+1<l.length&&Math.abs(l[i][1]-0.5)>0.01){var p=l[i][0]+(l[i+1][0]-l[i][0])*l[i][1];o.push([p,mist(l[i][2],l[i+1][2],0.5)]);}}return o;}
 var cs=paradas(c).map(function(x){return [x[0],[x[1][0],x[1][1],x[1][2],1]];});
 return {t:"Gradient",v:{colors:cs,opacities:paradas(a)}};}
function EN(e,n){if(e[n]===undefined)throw new Error('sem '+n);return e[n];}
function TD(o){var d=new TextDocument(o.text||'');for(var k in o){if(k==='text'||k==='boxTextSize'||k==='boxTextPos')continue;try{d[k]=k==='justification'?EN(ParagraphJustification,o[k]):o[k];}catch(e){AV.push('texto '+k+': '+(e&&e.message?e.message:e));}}return d;}
function ARQ(id,nome,cam,camada,w,h,fps,dur,pai){var it=null;
 try{var a={paths:[cam]};if(camada!==null&&camada!==undefined)a.layer=camada;var r=__call("file.import",a);
  if(r&&r.items&&r.items.length&&!(r.errors&&r.errors.length))it=__item(r.items[0]);}catch(e){}
 if(!it){try{it=P.importPlaceholder(nome,w||1920,h||1080,fps||30,dur||10);}catch(e){}FALTA.push(cam);}
 if(it){T(function(){it.name=nome;});T(function(){it.parentFolder=pai;});IT[id]=it;}}
function COMP(id,pai,bg,ds,was,wad,lab){var c=IT[id];T(function(){c.parentFolder=pai;});T(function(){c.bgColor=bg;});
 if(ds)T(function(){c.displayStartTime=ds;});T(function(){c.workAreaStart=was;c.workAreaDuration=wad;});T(function(){c.label=lab;});}
function SOLIDA(c,id){var s=SOL[id];if(IT[id])return c.layers.add(IT[id]);
 var l=c.layers.addSolid(s.cor,s.nome,s.w||c.width,s.h||c.height,s.par||1);IT[id]=l.source;T(function(){IT[id].parentFolder=s.pai;});return l;}
function FONTE(c,id,nome){if(IT[id])return c.layers.add(IT[id]);AV.push('origem não encontrada: '+nome);return c.layers.addNull();}
function TEMPO(l,st,str,i,o){T(function(){l.startTime=st;});if(str!==100)T(function(){l.stretch=str;});T(function(){l.inPoint=i;});T(function(){l.outPoint=o;});}
function K(p,t,v,ii,io,ei,eo,si,so,fl){
 p.setValuesAtTimes(t,v);
 for(var k=0;k<t.length;k++){var n=k+1;
  try{p.setInterpolationTypeAtKey(n,ii[k],io[k]);}catch(e){}
  if(ei[k]&&eo[k]&&ii[k]!==6612&&io[k]!==6612||ei[k]&&eo[k]){try{
   var a=[],b=[];for(var j=0;j<ei[k].length;j++){a.push(new KeyframeEase(ei[k][j][0],Math.max(0.1,Math.min(100,ei[k][j][1]))));}
   for(var j2=0;j2<eo[k].length;j2++){b.push(new KeyframeEase(eo[k][j2][0],Math.max(0.1,Math.min(100,eo[k][j2][1]))));}
   p.setTemporalEaseAtKey(n,a,b);}catch(e){}}
  if(si[k]&&so[k]){try{p.setSpatialTangentsAtKey(n,si[k],so[k]);}catch(e){}}
  try{if(fl[k]&2)p.setTemporalContinuousAtKey(n,true);if(fl[k]&4)p.setTemporalAutoBezierAtKey(n,true);
   if(fl[k]&8)p.setSpatialContinuousAtKey(n,true);if(fl[k]&16)p.setSpatialAutoBezierAtKey(n,true);if(fl[k]&1)p.setRovingAtKey(n,true);}catch(e){}
 }}
"""

FIM = r"""app.endUndoGroup();
var comps=[];for(var k in IT){try{if(IT[k] instanceof CompItem)comps.push(IT[k].name);}catch(e){}}
return JSON.stringify({pasta:RAIZ.name,comps:comps.length,faltando:FALTA,avisos:AV});
})();
"""


def converter(caminho: str, nome: str) -> str:
    """Lê o .aep/.aet e devolve JSON {jsx, avisos} (avisos do lado do leitor)."""
    proj = py_aep.parse(caminho).project
    c = Conversor(proj, nome)
    jsx = c.gerar()
    return json.dumps({"jsx": jsx, "avisos": c.avisos, "fontes": c.fontes}, ensure_ascii=False)


if __name__ == "__main__":
    import sys

    r = json.loads(converter(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else sys.argv[1]))
    sys.stdout.write(r["jsx"])
    sys.stderr.write("\n".join(r["avisos"]) + "\n")
