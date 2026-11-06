
const D = (globalThis.__arcanoDestinos = globalThis.__arcanoDestinos || {});
const TIPOS = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', gif: 'image/gif', wav: 'audio/wav', aif: 'audio/aiff', aiff: 'audio/aiff', zip: 'application/zip', png: 'image/png' };
export function arcano_pode() { return typeof globalThis.showSaveFilePicker === 'function'; }
export function arcano_escolher(nome) {
  if (typeof globalThis.showSaveFilePicker !== 'function') { return false; }
  const ext = (nome.split('.').pop() || '').toLowerCase();
  const op = { suggestedName: nome, id: 'arcano-render' };
  if (TIPOS[ext]) { op.types = [{ description: ext.toUpperCase(), accept: { [TIPOS[ext]]: ['.' + ext] } }]; }
  globalThis.showSaveFilePicker(op).then((h) => { D[nome] = h; }, (e) => { if (!e || e.name !== 'AbortError') { console.warn('[Arcano] escolher onde salvar:', e && e.message); } });
  return true;
}
export function arcano_escolhido(nome) { const h = D[nome]; return h ? h.name : ''; }
export function arcano_gravar(nome, bytes) {
  const h = D[nome];
  if (!h) { return false; }
  const copia = bytes.slice();
  (async () => { const w = await h.createWritable(); await w.write(copia); await w.close(); console.info('[Arcano] render salvo em', h.name); })().catch((e) => {
    console.warn('[Arcano] não consegui gravar no lugar escolhido, baixando:', e && e.message);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([copia])); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  });
  return true;
}
