/*
 * Porta dos editores: só entra quem tem conta no ArcanoApp (mesmo e-mail e senha do site).
 * Login direto no Supabase do ArcanoApp (chave pública "anon", a mesma do site). A IA continua
 * exigindo a assinatura do Arcano Motion (quem confere é o plugin). Fica FORA do build.
 */
(function () {
  'use strict';
  var SUPA = 'https://jooojbaljrshgpaxdlou.supabase.co', ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impvb29qYmFsanJzaGdwYXhkbG91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MDY2NzgsImV4cCI6MjA4MDE4MjY3OH0.BtfO6nYtDomQEqkX3mQyL4S0U8IPz1xzNAz0nbfy9Q0', CHAVE = 'arcano-layers-sessao';
  var SITE = 'https://arcanoapp.voxvisual.com.br';
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { return null; } }
  function gravar(s) { try { localStorage.setItem(CHAVE, JSON.stringify(s)); } catch (e) {} }
  function auth(tipo, corpo) {
    return fetch(SUPA + '/auth/v1/token?grant_type=' + tipo, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) { throw new Error(j.error_description || j.msg || j.error || 'falhou'); } return j; }); });
  }
  function guardar(j) { gravar({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at, email: j.user && j.user.email }); }
  function valida() {
    var s = ler();
    if (!s || !s.refresh_token) { return Promise.resolve(false); }
    if (s.expires_at && s.expires_at * 1000 > Date.now() + 60000) { return Promise.resolve(true); }
    return auth('refresh_token', { refresh_token: s.refresh_token }).then(function (j) { guardar(j); return true; }, function () { return false; });
  }
  var css = document.createElement('style');
  css.textContent = '#arcano-porta{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at top,#2a1450 0%,#0c0a12 70%);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#eee}' +
    '#arcano-porta .cx{width:min(380px,92vw);background:rgba(22,18,30,.92);border:1px solid #3a2a55;border-radius:16px;padding:28px 26px;box-shadow:0 20px 60px rgba(0,0,0,.5)}' +
    '#arcano-porta img{width:56px;height:56px;border-radius:14px;display:block;margin:0 auto 12px}' +
    '#arcano-porta h1{font-size:20px;margin:0 0 4px;text-align:center}#arcano-porta p{margin:0 0 18px;text-align:center;color:#b9b0c8;font-size:13px}' +
    '#arcano-porta label{display:block;font-size:12px;color:#b9b0c8;margin:10px 0 4px}' +
    '#arcano-porta input{width:100%;box-sizing:border-box;background:#0f0c16;border:1px solid #3a2a55;border-radius:10px;padding:10px 12px;color:#fff;font-size:14px;outline:none}' +
    '#arcano-porta input:focus{border-color:#a855f7}' +
    '#arcano-porta button{width:100%;margin-top:18px;border:0;border-radius:10px;padding:11px;font-weight:700;font-size:14px;color:#fff;background:linear-gradient(90deg,#a855f7,#7c3aed);cursor:pointer}' +
    '#arcano-porta button:disabled{opacity:.6}#arcano-porta .erro{color:#f87171;font-size:12px;min-height:16px;margin-top:10px;text-align:center}' +
    '#arcano-porta .links{display:flex;justify-content:center;gap:14px;margin-top:14px;font-size:12px}#arcano-porta a{color:#c084fc}';
  function mostrar() {
    if (document.getElementById('arcano-porta')) { return; }
    document.head.appendChild(css);
    var d = document.createElement('div');
    d.id = 'arcano-porta';
    d.innerHTML = '<form class="cx"><img src="../painel/arcano-128.png" alt=""><h1>Arcano Layers</h1><p>Entre com a sua conta do ArcanoApp (o mesmo e-mail e senha do site).</p>' +
      '<label>E-mail</label><input type="email" name="email" autocomplete="email" required>' +
      '<label>Senha</label><input type="password" name="senha" autocomplete="current-password" required>' +
      '<button type="submit">Entrar</button><div class="erro"></div>' +
      '<div class="links"><a href="' + SITE + '/forgot-password" target="_blank" rel="noopener">Esqueci minha senha</a><a href="' + SITE + '/login" target="_blank" rel="noopener">Criar conta</a></div></form>';
    document.body.appendChild(d);
    var f = d.querySelector('form'), b = f.querySelector('button'), er = f.querySelector('.erro');
    f.onsubmit = function (ev) {
      ev.preventDefault();
      b.disabled = true; b.textContent = 'Entrando…'; er.textContent = '';
      auth('password', { email: f.email.value.trim(), password: f.senha.value }).then(function (j) {
        guardar(j); d.parentNode.removeChild(d);
      }, function (e) {
        b.disabled = false; b.textContent = 'Entrar';
        er.textContent = /invalid/i.test(e.message) ? 'E-mail ou senha errados.' : 'Não consegui entrar: ' + e.message;
      });
    };
  }
  window.ARCANO_SAIR = function () { try { localStorage.removeItem(CHAVE); } catch (e) {} location.reload(); };
  function iniciar() { valida().then(function (ok) { if (!ok) { mostrar(); } }); }
  if (document.body) { iniciar(); } else { document.addEventListener('DOMContentLoaded', iniciar); }
})();
