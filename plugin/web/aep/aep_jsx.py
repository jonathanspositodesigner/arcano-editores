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


# =====================================================================================================
# Editor -> projeto do After (.aep): "Arquivo > Salvar como projeto do After". O painel lê o projeto
# do editor com um script no modelo do After (app.project, camadas, propriedades com matchName,
# keyframes com easing) e manda o JSON para cá; o py-aep grava o .aep. O que o py-aep não sabe criar
# do zero (efeitos fora o Transformar, que o After só tem na própria instalação) sai do .aep e vira aviso.
# =====================================================================================================

from py_aep.enums import KeyframeInterpolationType


def _cor3(c):
    c = list(c or [0, 0, 0])[:3]
    while len(c) < 3:
        c.append(0)
    return [max(0.0, min(1.0, float(x))) for x in c]


def _limite(x, lo, hi):
    return max(lo, min(hi, x))


class Gravador:
    def __init__(self, dados: dict, windows: bool):
        self.d = dados
        self.windows = windows
        self.avisos: list[str] = []
        self.app = py_aep.new(platform="windows" if windows else "macos")
        self.pr = self.app.project
        self.itens: dict = {}  # id do editor -> item do py-aep
        self.efeitos_fora: dict = {}

    def aviso(self, t: str):
        if t not in self.avisos and len(self.avisos) < 400:
            self.avisos.append(t)

    # ---------------------------------------------------------------- itens
    def pasta(self, pid):
        if not pid:
            return self.pr.root_folder
        if pid in self.itens:
            return self.itens[pid]
        d = self.por_id.get(pid)
        if not d or d.get("tipo") != "pasta":
            return self.pr.root_folder
        f = self.pasta(d.get("pai")).add_folder(d.get("nome") or "Pasta")
        self.itens[pid] = f
        return f

    def arquivo(self, d):
        from py_aep.data.file_formats import get_file_format
        from py_aep.models.items.footage import FootageItem
        from py_aep.models.sources.file import FileSource

        caminho = d.get("arquivo") or ""
        w, h = int(d.get("w") or 1920), int(d.get("h") or 1080)
        dur = float(d.get("dur") or 0)
        fps = float(d.get("fps") or 0)
        ext = caminho.rsplit(".", 1)[-1].lower() if "." in caminho else ""
        try:
            fmt = get_file_format("." + ext)
            parado = bool(d.get("still")) or dur <= 0
            fonte = FileSource._new(
                caminho,
                source_format=fmt.source_format,
                width=_limite(w, 1, 30000),
                height=_limite(h, 1, 30000),
                duration=0.0 if parado else dur,
                frame_rate=0.0 if parado else (fps or 30.0),
                has_alpha=ext in ("png", "psd", "tif", "tiff", "tga", "webp", "mov", "exr"),
                audio_sample_rate=48000.0 if d.get("audio") else 0.0,
                windows=self.windows,
            )
            item = FootageItem._new(fonte, project=self.pr, parent_folder=self.pr.root_folder)
            cont = self.pr.root_folder._children_container
            cont.append(item._item_list)
            cont.extend(item._view_data)
            self.pr.items[item.id] = item
            self.pr.root_folder.items.append(item)
        except Exception as e:  # formato que o py-aep não conhece: espaço reservado com o mesmo tamanho
            self.aviso(f"arquivo {caminho or d.get('nome')}: entrou como espaço reservado ({e})")
            item = self.pr.import_placeholder(d.get("nome") or "Arquivo", _limite(w, 4, 30000), _limite(h, 4, 30000),
                                              _limite(fps or 30.0, 1.0, 99.0), _limite(dur or 10.0, 0.04, 10800.0))
        try:
            item.name = d.get("nome") or item.name
        except Exception:
            pass
        return item

    def mover(self, item, pid):
        if not pid:
            return
        try:
            item.parent_folder = self.pasta(pid)
        except Exception as e:
            self.aviso(f"{getattr(item, 'name', '?')}: não deu para pôr na pasta ({e})")

    # ---------------------------------------------------------------- valores
    def valor(self, prop, v):
        if isinstance(v, dict):
            if "forma" in v:
                f = v["forma"]
                return py_aep.Shape(f.get("v") or [], f.get("i"), f.get("o"), closed=bool(f.get("c", True)))
            if "texto" in v:
                t = v["texto"]
                doc = prop.value
                try:
                    doc.text = t.get("t", "")
                    if t.get("fonte"):
                        doc.font = t["fonte"]
                    if t.get("tam"):
                        doc.font_size = float(t["tam"])
                    if t.get("cor") is not None:
                        doc.fill_color = _cor3(t["cor"])
                    if "preenche" in t:
                        doc.apply_fill = bool(t["preenche"])
                    if t.get("contorno") is not None:
                        doc.stroke_color = _cor3(t["contorno"])
                    if "contornar" in t:
                        doc.apply_stroke = bool(t["contornar"])
                    if t.get("largura") is not None:
                        doc.stroke_width = float(t["largura"])
                    if t.get("espaco") is not None:
                        doc.tracking = float(t["espaco"])
                    if t.get("entrelinha"):
                        doc.leading = float(t["entrelinha"])
                    if t.get("just") and hasattr(ParagraphJustification, t["just"]):
                        doc.justification = getattr(ParagraphJustification, t["just"])
                except Exception as e:
                    self.aviso(f"texto: {e}")
                return doc
        return v

    def chaves(self, prop, chaves, rotulo):
        for k in chaves:
            try:
                prop.set_value_at_time(float(k["t"]), self.valor(prop, k.get("v")))
            except Exception as e:
                self.aviso(f"{rotulo}: keyframe em {k.get('t')} s não entrou ({e})")
                continue
            try:
                kf = prop.nearest_key(float(k["t"]))
                ii, oi = k.get("ii"), k.get("oi")
                if ii and hasattr(KeyframeInterpolationType, ii):
                    kf.in_interpolation_type = getattr(KeyframeInterpolationType, ii)
                if oi and hasattr(KeyframeInterpolationType, oi):
                    kf.out_interpolation_type = getattr(KeyframeInterpolationType, oi)
                if k.get("ie"):
                    kf.in_temporal_ease = [py_aep.KeyframeEase(float(e[0]), _limite(float(e[1]), 0.1, 100.0)) for e in k["ie"]]
                if k.get("oe"):
                    kf.out_temporal_ease = [py_aep.KeyframeEase(float(e[0]), _limite(float(e[1]), 0.1, 100.0)) for e in k["oe"]]
            except Exception as e:
                self.aviso(f"{rotulo}: suavização do keyframe em {k.get('t')} s ({e})")

    def props(self, grupo, lista, rotulo, indexado=False):
        for p in lista or []:
            mn = p.get("mn")
            if not mn:
                continue
            nome = f"{rotulo} > {p.get('nome') or mn}"
            if "g" in p:  # grupo
                if mn == "ADBE Effect Parade":
                    self.efeitos(grupo, p, rotulo)
                    continue
                try:
                    filho = grupo.add_property(mn) if indexado else grupo.property(mn)
                except Exception as e:
                    self.aviso(f"{nome}: não entrou ({e})")
                    continue
                if filho is None:
                    self.aviso(f"{nome}: não existe no After")
                    continue
                if indexado and p.get("nome"):
                    try:
                        filho.name = p["nome"]
                    except Exception:
                        pass
                for chave in ("modo", "inverter"):
                    if chave in p:
                        try:
                            if chave == "modo" and hasattr(MaskMode, p["modo"]):
                                filho.mask_mode = getattr(MaskMode, p["modo"])
                            if chave == "inverter":
                                filho.inverted = bool(p["inverter"])
                        except Exception:
                            pass
                if p.get("separado"):
                    try:
                        filho.dimensions_separated = True
                    except Exception:
                        pass
                self.props(filho, p["g"], nome, bool(p.get("i")))
                continue
            try:
                prop = grupo.property(mn)
            except Exception:
                prop = None
            if prop is None:
                self.aviso(f"{nome}: não existe no After")
                continue
            if p.get("separado"):
                try:
                    prop.dimensions_separated = True
                except Exception:
                    pass
            if p.get("k"):
                self.chaves(prop, p["k"], nome)
            elif "v" in p:
                try:
                    prop.value = self.valor(prop, p["v"])
                except Exception as e:
                    self.aviso(f"{nome}: valor não entrou ({e})")
            if p.get("e"):
                try:
                    prop.expression = p["e"]
                    if p.get("eoff"):
                        prop.expression_enabled = False
                except Exception as e:
                    self.aviso(f"{nome}: expressão não entrou ({e})")

    def efeitos(self, camada, p, rotulo):
        try:
            grupo = camada.property("ADBE Effect Parade")
        except Exception:
            grupo = None
        for fx in p.get("g") or []:
            mn = fx.get("mn")
            try:
                novo = grupo.add_property(mn) if grupo is not None else None
            except Exception:
                novo = None
            if novo is None:
                self.efeitos_fora[fx.get("nome") or mn] = self.efeitos_fora.get(fx.get("nome") or mn, 0) + 1
                continue
            try:
                if fx.get("nome"):
                    novo.name = fx["nome"]
                if fx.get("desligado"):
                    novo.enabled = False
            except Exception:
                pass
            self.props(novo, fx.get("g"), f"{rotulo} > {fx.get('nome') or mn}")

    def marcas(self, prop, lista, rotulo):
        if prop is None or not lista:
            return
        for m in lista:
            try:
                mv = py_aep.MarkerValue(str(m.get("c") or ""), str(m.get("cap") or ""))
                if m.get("d"):
                    mv.duration = float(m["d"])
                prop.set_value_at_time(float(m.get("t") or 0), mv)
            except Exception as e:
                self.aviso(f"{rotulo}: marcador em {m.get('t')} s ({e})")

    # ---------------------------------------------------------------- camadas
    def camada(self, comp, c, rotulo):
        mn = c.get("mn")
        if mn == "ADBE Text Layer":
            caixa = c.get("caixa")
            return comp.add_box_text(caixa, c.get("texto", "")) if caixa else comp.add_text(c.get("texto", ""))
        if mn == "ADBE Vector Layer":
            return comp.add_shape()
        if mn == "ADBE Camera Layer":
            return comp.add_camera(c.get("nome"), [comp.width / 2, comp.height / 2])
        if mn == "ADBE Light Layer":
            return comp.add_light(c.get("nome"), [comp.width / 2, comp.height / 2])
        if c.get("nulo"):
            return comp.add_null()
        f = self.por_id.get(c.get("fonte"))
        if f and f.get("tipo") == "solido":
            return comp.add_solid(_cor3(f.get("cor")), f.get("nome"), _limite(int(f.get("w") or comp.width), 1, 30000),
                                  _limite(int(f.get("h") or comp.height), 1, 30000), float(f.get("pa") or 1.0))
        item = self.itens.get(c.get("fonte"))
        if item is None:
            self.aviso(f"{rotulo}: sem a fonte, entrou como nulo")
            return comp.add_null()
        return comp.add(item)

    def atributos(self, L, c, rotulo):
        def por(attr, v):
            try:
                setattr(L, attr, v)
            except Exception as e:
                self.aviso(f"{rotulo}: {attr} ({e})")

        if c.get("nome"):
            por("name", c["nome"])
        for a, k in (("three_d_layer", "td"), ("adjustment_layer", "adj"), ("collapse_transformation", "colapso"),
                     ("motion_blur", "mb"), ("guide_layer", "guia"), ("audio_enabled", "audio")):
            if c.get(k) is not None and c.get(k) is not False:
                por(a, bool(c[k]))
        if c.get("estica") not in (None, 100, 100.0):
            por("stretch", float(c["estica"]))
        por("start_time", float(c.get("ini") or 0))
        por("in_point", float(c.get("inP") or 0))
        por("out_point", float(c.get("outP") or 0))
        if c.get("modo") and c["modo"] != "NORMAL" and hasattr(BlendingMode, c["modo"]):
            por("blending_mode", getattr(BlendingMode, c["modo"]))
        for a, k in (("shy", "shy"), ("solo", "solo")):
            if c.get(k):
                por(a, True)
        if c.get("ativa") is False:
            por("enabled", False)

    def comp(self, d, comp):
        self.marcas(getattr(comp, "marker_property", None), d.get("marcas"), d.get("nome") or "Comp")
        camadas = d.get("camadas") or []
        criadas = {}
        # o py-aep põe cada camada nova no topo: cria de baixo para cima
        for c in sorted(camadas, key=lambda x: -int(x.get("idx") or 0)):
            rotulo = f"{d.get('nome')} > {c.get('nome')}"
            try:
                L = self.camada(comp, c, rotulo)
            except Exception as e:
                self.aviso(f"{rotulo}: não entrou ({e})")
                continue
            criadas[int(c.get("idx") or 0)] = L
            self.atributos(L, c, rotulo)
            self.props(L, c.get("props"), rotulo)
            self.marcas(getattr(L, "marker", None), c.get("marcas"), rotulo)
        # pais e mates depois que todas existem
        for c in camadas:
            L = criadas.get(int(c.get("idx") or 0))
            if L is None:
                continue
            rotulo = f"{d.get('nome')} > {c.get('nome')}"
            if c.get("pai") and criadas.get(int(c["pai"])) is not None:
                try:
                    L.parent = criadas[int(c["pai"])]
                except Exception as e:
                    self.aviso(f"{rotulo}: pai ({e})")
            m = c.get("mate")
            if m and criadas.get(int(m.get("idx") or 0)) is not None and hasattr(TrackMatteType, m.get("tipo", "")):
                try:
                    L.set_track_matte(criadas[int(m["idx"])], getattr(TrackMatteType, m["tipo"]))
                except Exception as e:
                    self.aviso(f"{rotulo}: fosco ({e})")
        for c in camadas:  # trava depois (camada travada não aceita mudança)
            L = criadas.get(int(c.get("idx") or 0))
            if L is not None and c.get("trava"):
                try:
                    L.locked = True
                except Exception:
                    pass

    def gravar(self, caminho: str):
        lista = self.d.get("itens") or []
        self.por_id = {i.get("id"): i for i in lista}
        for i in lista:
            if i.get("tipo") == "pasta":
                self.pasta(i.get("id"))
        for i in lista:
            t = i.get("tipo")
            try:
                if t == "arquivo":
                    self.itens[i["id"]] = self.arquivo(i)
                elif t == "reservado":
                    self.itens[i["id"]] = self.pr.import_placeholder(i.get("nome"), _limite(int(i.get("w") or 1920), 4, 30000), _limite(int(i.get("h") or 1080), 4, 30000),
                                                                     _limite(float(i.get("fps") or 30), 1.0, 99.0), _limite(float(i.get("dur") or 10), 0.04, 10800.0))
                elif t == "comp":
                    self.itens[i["id"]] = self.pr.root_folder.add_comp(
                        i.get("nome") or "Comp", _limite(int(i.get("w") or 1920), 4, 30000), _limite(int(i.get("h") or 1080), 4, 30000),
                        float(i.get("pa") or 1.0), _limite(float(i.get("dur") or 10), 0.04, 10800.0), _limite(float(i.get("fps") or 30), 1.0, 99.0))
                    if i.get("fundo"):
                        try:
                            self.itens[i["id"]].bg_color = _cor3(i["fundo"])
                        except Exception:
                            pass
            except Exception as e:
                self.aviso(f"{i.get('nome')}: não entrou ({e})")
                continue
            if t in ("arquivo", "reservado", "comp") and i["id"] in self.itens:
                self.mover(self.itens[i["id"]], i.get("pai"))
        for i in lista:
            if i.get("tipo") == "comp" and i["id"] in self.itens:
                self.comp(i, self.itens[i["id"]])
        for nome, n in sorted(self.efeitos_fora.items()):
            self.aviso(f"efeito {nome} ({n}x): o .aep sai sem ele (o After só tem esse efeito na própria instalação)")
        import os

        if os.path.exists(caminho):  # o py-aep não grava por cima
            os.remove(caminho)
        self.pr.save(caminho)


def gravar(dados_json: str, windows: bool, caminho: str = "/tmp/saida.aep") -> str:
    """JSON do projeto do editor -> .aep em `caminho`. Devolve {caminho, avisos} em JSON."""
    import os.path as _op

    # O py-aep faz `abspath` no caminho do arquivo; aqui (navegador/Pyodide, que é "Linux") um caminho do
    # Windows (C:\..., \\servidor\...) viraria relativo à pasta atual. Caminho do Windows passa direto.
    original = _op.abspath

    def _abs(p):
        t = str(p)
        if (len(t) > 2 and t[1] == ":" and t[2] in "\\/") or t.startswith("\\\\"):
            return t
        return original(t)

    _op.abspath = _abs
    try:
        g = Gravador(json.loads(dados_json), bool(windows))
        g.gravar(caminho)
    finally:
        _op.abspath = original
    return json.dumps({"caminho": caminho, "avisos": g.avisos}, ensure_ascii=False)
