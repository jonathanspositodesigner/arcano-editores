"""Tira do .wasm só as seções de depuração ('name' e 'producers'): nomes de função para
o programador ler erro. Não muda nenhuma função do editor (o navegador ignora essas seções)."""
import sys

def leb(b, i):
    r = s = 0
    while True:
        x = b[i]; i += 1; r |= (x & 0x7f) << s; s += 7
        if x < 128:
            return r, i

arq = sys.argv[1]
b = open(arq, 'rb').read()
assert b[:4] == b'\0asm', 'não é wasm'
out = bytearray(b[:8]); i = 8; tirou = 0
while i < len(b):
    sid = b[i]; sz, j = leb(b, i + 1)
    nome = ''
    if sid == 0:
        n, k = leb(b, j); nome = b[k:k + n].decode('utf8', 'replace')
    if nome in ('name', 'producers'):
        tirou += j + sz - i
    else:
        out += b[i:j + sz]
    i = j + sz
open(arq, 'wb').write(out)
print(f'{arq}: {len(b)/1e6:.1f} MB -> {len(out)/1e6:.1f} MB (tirou {tirou/1e6:.1f} MB de depuração)')
