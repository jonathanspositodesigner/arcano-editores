/* Sinônimos da busca da biblioteca de referências (Cloner, Veste AI, Pose Changer).
   GERADO de src/lib/synonyms.ts do ArcanoApp (esbuild): mesmo dicionário e mesma expansão do site. Mudou lá, gere de novo. */
var ArcanoSinonimos = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/lib/synonyms.ts
  var synonyms_exports = {};
  __export(synonyms_exports, {
    expandSearchTerms: () => expandSearchTerms,
    getSynonyms: () => getSynonyms,
    removeAccents: () => removeAccents
  });
  function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  var SYNONYM_GROUPS = [
    // Gênero / Pessoas
    ["homem", "rapaz", "garoto", "masculino", "cara", "boy", "menino", "jovem homem", "senhor", "macho"],
    ["mulher", "garota", "mo\xE7a", "feminino", "girl", "menina", "senhora", "dama", "lady"],
    ["casal", "couple", "dupla", "par", "namorados", "juntos"],
    ["crian\xE7a", "kid", "infantil", "beb\xEA", "baby", "nen\xE9m", "child"],
    ["idoso", "velho", "anci\xE3o", "terceira idade", "elderly"],
    // Eventos
    ["festa", "balada", "party", "evento", "celebra\xE7\xE3o", "comemora\xE7\xE3o", "night", "noite"],
    ["casamento", "noiva", "noivo", "wedding", "matrim\xF4nio", "bodas", "cerim\xF4nia"],
    ["anivers\xE1rio", "birthday", "niver", "parab\xE9ns"],
    ["formatura", "graduation", "cola\xE7\xE3o", "diploma"],
    ["churrasco", "bbq", "barbecue", "churras"],
    ["natal", "christmas", "natalino", "xmas"],
    ["halloween", "dia das bruxas", "fantasia terror"],
    ["carnaval", "carnival", "folia", "bloco"],
    ["r\xE9veillon", "ano novo", "new year", "virada"],
    ["show", "concert", "concerto", "espet\xE1culo", "apresenta\xE7\xE3o", "live", "gig"],
    // Roupas / Moda
    ["roupa", "vestimenta", "traje", "outfit", "look", "vestu\xE1rio"],
    ["terno", "suit", "blazer", "palet\xF3", "costume"],
    ["vestido", "dress", "longo", "curto"],
    ["camiseta", "camisa", "t-shirt", "blusa", "top"],
    ["cal\xE7a", "pants", "jeans", "cal\xE7a jeans", "bermuda", "shorts"],
    ["saia", "skirt", "minissaia"],
    ["sapato", "shoe", "t\xEAnis", "sneaker", "bota", "sand\xE1lia", "chinelo"],
    ["bon\xE9", "cap", "chap\xE9u", "hat", "gorro", "touca"],
    ["\xF3culos", "glasses", "sunglasses", "\xF3culos de sol"],
    ["rel\xF3gio", "watch", "acess\xF3rio"],
    ["jaqueta", "jacket", "casaco", "moletom", "hoodie", "agasalho", "blusa de frio"],
    ["biqu\xEDni", "bikini", "mai\xF4", "moda praia", "beachwear"],
    ["lingerie", "underwear", "roupa \xEDntima", "calcinha", "suti\xE3"],
    // Estilo / Aparência
    ["elegante", "sofisticado", "chique", "luxuoso", "classy", "fino", "requintado"],
    ["casual", "despojado", "informal", "relaxado", "descontra\xEDdo"],
    ["sexy", "sensual", "sedutor", "sedutora", "hot"],
    ["esportivo", "sport", "atl\xE9tico", "fitness", "gym", "academia"],
    ["vintage", "retr\xF4", "retro", "antigo", "old school"],
    ["moderno", "modern", "contempor\xE2neo", "atual", "trendy"],
    ["streetwear", "urban", "urbano", "street"],
    ["g\xF3tico", "gothic", "dark", "sombrio"],
    ["punk", "rock", "rocker", "roqueiro"],
    ["rom\xE2ntico", "romantic", "delicado", "suave"],
    // Cores
    ["preto", "black", "escuro", "negro", "dark"],
    ["branco", "white", "claro", "alvo"],
    ["vermelho", "red", "rubro", "encarnado", "bord\xF4"],
    ["azul", "blue", "celeste", "marinho", "navy"],
    ["verde", "green", "esmeralda"],
    ["amarelo", "yellow", "dourado", "gold", "ouro"],
    ["rosa", "pink", "rosado", "magenta"],
    ["roxo", "purple", "violeta", "lil\xE1s", "lavanda"],
    ["laranja", "orange"],
    ["cinza", "gray", "grey", "prata", "silver"],
    ["marrom", "brown", "bege", "caramelo", "caf\xE9"],
    // Cenários / Locais
    ["praia", "beach", "litoral", "mar", "oceano", "costa"],
    ["cidade", "city", "urbano", "metr\xF3pole", "downtown"],
    ["campo", "rural", "fazenda", "s\xEDtio", "natureza", "nature"],
    ["montanha", "mountain", "serra", "morro"],
    ["floresta", "forest", "mata", "bosque", "jungle", "selva"],
    ["est\xFAdio", "studio", "fundo neutro", "backdrop"],
    ["rua", "street", "avenida", "cal\xE7ada"],
    ["bar", "pub", "lounge", "nightclub", "boate", "club"],
    ["restaurante", "restaurant", "caf\xE9", "cafeteria"],
    ["igreja", "church", "templo", "chapel", "capela"],
    ["piscina", "pool", "swimming"],
    ["jardim", "garden", "parque", "park"],
    ["escrit\xF3rio", "office", "corporativo", "trabalho"],
    ["casa", "home", "lar", "resid\xEAncia", "apartamento"],
    // Poses / Ações
    ["sentado", "sitting", "sentada"],
    ["em p\xE9", "standing", "de p\xE9"],
    ["deitado", "lying", "deitada", "reclinado"],
    ["andando", "walking", "caminhando"],
    ["correndo", "running", "jogging"],
    ["dan\xE7ando", "dancing", "dan\xE7a"],
    ["sorrindo", "smiling", "sorriso", "feliz", "happy"],
    ["s\xE9rio", "serious", "pensativo", "contemplativo"],
    ["olhando", "looking", "encarando", "fitando"],
    // Iluminação / Fotografia
    ["noturno", "night", "noite", "escuro", "nocturnal"],
    ["diurno", "day", "dia", "daylight", "luz do dia"],
    ["p\xF4r do sol", "sunset", "golden hour", "entardecer", "crep\xFAsculo"],
    ["neon", "neons", "luz neon", "colorido"],
    ["contraluz", "backlight", "silhueta", "silhouette"],
    // Cabelo
    ["cabelo", "hair", "penteado", "corte"],
    ["loiro", "loira", "blonde", "dourado"],
    ["moreno", "morena", "brunette", "castanho"],
    ["ruivo", "ruiva", "redhead", "ginger"],
    ["careca", "bald", "raspado"],
    ["barba", "beard", "barbado"],
    ["bigode", "mustache", "moustache"],
    // Tatuagem / Body
    ["tatuagem", "tattoo", "tatuado", "tatuada", "tattooed"],
    ["musculoso", "muscular", "forte", "definido", "bodybuilder"],
    ["magro", "slim", "thin", "esbelto", "esguio"],
    ["gordo", "fat", "plus size", "gordinho", "cheio"],
    // Música (contexto do app)
    ["cantor", "singer", "vocalista", "vocalist"],
    ["rapper", "rap", "mc", "hip hop", "hiphop"],
    ["dj", "disc jockey", "produtor", "producer"],
    ["guitarrista", "guitar", "guitarra", "viol\xE3o"],
    ["baterista", "drummer", "bateria", "drums"],
    ["funk", "funkeiro", "mc funk", "baile funk"],
    ["sertanejo", "country", "sertaneja"],
    ["pagode", "samba", "pagodeiro", "sambista"],
    ["trap", "drill", "phonk"],
    ["rock", "metal", "heavy metal", "hardcore"],
    ["pop", "popstar", "mainstream"],
    ["gospel", "religioso", "crist\xE3o", "worship"],
    ["reggae", "reggaeton", "rastafari", "rasta"],
    // Objetos
    ["carro", "car", "autom\xF3vel", "ve\xEDculo", "auto"],
    ["moto", "motorcycle", "motocicleta", "bike"],
    ["celular", "phone", "smartphone", "telefone"],
    ["microfone", "mic", "microphone"],
    ["dinheiro", "money", "cash", "grana", "nota"],
    ["arma", "gun", "pistola", "weapon"],
    ["corrente", "chain", "colar", "necklace", "cord\xE3o"],
    ["anel", "ring", "alian\xE7a"],
    // Expressões / Vibe
    ["luxo", "luxury", "rico", "ostenta\xE7\xE3o", "glamour", "premium"],
    ["simples", "simple", "minimalista", "clean", "b\xE1sico"],
    ["art\xEDstico", "art", "arte", "artistic", "criativo", "creative"],
    ["profissional", "professional", "corporativo", "business", "executivo"],
    ["engra\xE7ado", "funny", "humor", "com\xE9dia", "divertido"],
    ["triste", "sad", "melanc\xF3lico", "solit\xE1rio"],
    ["raiva", "anger", "angry", "bravo", "furioso"],
    ["misterioso", "mysterious", "enigm\xE1tico", "sombrio"],
    // Flyer-specific
    ["flyer", "panfleto", "cartaz", "banner", "poster"],
    ["convite", "invitation", "invite", "convite digital"],
    ["promo\xE7\xE3o", "promo", "oferta", "desconto", "sale"],
    ["abertura", "inaugura\xE7\xE3o", "opening", "grand opening", "estreia"],
    ["lineup", "atra\xE7\xE3o", "artista", "line up", "programa\xE7\xE3o"]
  ];
  var synonymMap = /* @__PURE__ */ new Map();
  for (const group of SYNONYM_GROUPS) {
    const normalizedGroup = group.map((w) => w.toLowerCase().trim());
    const groupSet = new Set(normalizedGroup);
    for (const w of normalizedGroup) {
      const stripped = removeAccents(w);
      if (stripped !== w) groupSet.add(stripped);
    }
    for (const word of Array.from(groupSet)) {
      const variants = [word, removeAccents(word)];
      for (const variant of variants) {
        if (synonymMap.has(variant)) {
          const existing = synonymMap.get(variant);
          for (const w of groupSet) existing.add(w);
          for (const w of existing) synonymMap.set(w, existing);
        } else {
          synonymMap.set(variant, groupSet);
        }
      }
    }
  }
  function getSynonyms(word) {
    const normalized = word.toLowerCase().trim();
    if (!normalized) return [];
    const group = synonymMap.get(normalized) || synonymMap.get(removeAccents(normalized));
    return group ? Array.from(group) : [normalized];
  }
  function expandSearchTerms(search) {
    const words = search.toLowerCase().trim().split(/\s+/).filter((w) => w.length >= 2);
    if (words.length === 0) return [];
    const allTerms = /* @__PURE__ */ new Set();
    for (const word of words) {
      allTerms.add(word);
      allTerms.add(removeAccents(word));
      for (const synonym of getSynonyms(word)) {
        allTerms.add(synonym);
        allTerms.add(removeAccents(synonym));
      }
    }
    return Array.from(allTerms);
  }
  return __toCommonJS(synonyms_exports);
})();
