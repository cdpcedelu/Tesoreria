/* CDP Tesorería · Recuperar contraseña · Versión: 2026-09-24 19:40 ARG */
(function () {
  'use strict';
  var CFG = window.CDP_CONFIG;
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  var form = document.getElementById('login-form');
  var err = document.getElementById('login-error');
  var p = document.createElement('p');
  p.style.cssText = 'margin:0;text-align:center;font-size:.85rem';
  p.innerHTML = '<a href="#" id="olvide">Olvidé mi contraseña</a>';
  form.appendChild(p);
  function aviso(msg, ok) { err.hidden = false; err.style.color = ok ? 'var(--in)' : ''; err.textContent = msg; }
  function limpio(u) { return u.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ''); }
  document.getElementById('olvide').addEventListener('click', async function (e) {
    e.preventDefault();
    var u = limpio(form.usuario.value);
    if (!u) { aviso('Escribí tu usuario y después tocá "Olvidé mi contraseña".'); form.usuario.focus(); return; }
    var email = u.indexOf('@') >= 0 ? u : (await sb.rpc('email_de_usuario', { p_usuario: u })).data;
    if (!email || /@cdpcdelu\.ar$/.test(email)) { aviso('Ese usuario no tiene un correo cargado. Pedile al administrador que te cambie la contraseña.'); return; }
    var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (r.error) { aviso('No se pudo enviar el correo: ' + r.error.message); return; }
    aviso('Te mandamos un correo a ' + email.replace(/^(.{2}).*(@.*)$/, '$1•••$2') + ' con un link para elegir una contraseña nueva.', true);
  });
  sb.auth.onAuthStateChange(async function (ev) {
    if (ev !== 'PASSWORD_RECOVERY') return;
    var nueva = window.prompt('Escribí tu contraseña nueva (mínimo 8 caracteres):');
    if (!nueva) return;
    if (nueva.length < 8) { alert('La contraseña tiene que tener al menos 8 caracteres. Pedí el correo de nuevo.'); return; }
    var r = await sb.auth.updateUser({ password: nueva });
    alert(r.error ? 'No se pudo cambiar: ' + r.error.message : 'Listo, tu contraseña se cambió.');
    location.replace(location.origin + location.pathname);
  });
})();
