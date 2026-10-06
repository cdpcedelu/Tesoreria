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
    if (r.error) { aviso('No se pudo enviar el correo: ' + (window.CDP_traducirError ? window.CDP_traducirError(r.error.message) : r.error.message)); return; }
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

/* ===== Opción de menú lateral o arriba · 2026-09-29 18:40 ARG ===== */
(function () {
  'use strict';
  const raiz = document.documentElement;
  let pos = 'lateral';
  try { pos = localStorage.getItem('cdp-menu') === 'arriba' ? 'arriba' : 'lateral'; } catch (e) { }
  const aplicar = (p) => {
    pos = p;
    if (p === 'arriba') raiz.dataset.menu = 'arriba'; else delete raiz.dataset.menu;
    try { localStorage.setItem('cdp-menu', p); } catch (e) { }
    document.querySelectorAll('[data-menu-opc]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.menuOpc === p)));
  };
  const pie = document.querySelector('.nav-pie');
  if (pie && !document.querySelector('.menu-sel')) {
    const sel = document.createElement('div');
    sel.className = 'tema menu-sel';
    sel.setAttribute('role', 'group');
    sel.setAttribute('aria-label', 'Posición del menú');
    sel.style.gridTemplateColumns = '1fr 1fr';
    sel.innerHTML = '<button type="button" data-menu-opc="lateral" title="Menú al costado">Lateral</button><button type="button" data-menu-opc="arriba" title="Menú arriba">Arriba</button>';
    pie.insertBefore(sel, pie.firstChild);
    sel.querySelectorAll('button').forEach((b) => { b.onclick = () => aplicar(b.dataset.menuOpc); });
  }
  aplicar(pos);
})();

/* ===== Fecha y hora al lado del saludo de Inicio · 2026-09-29 19:00 ARG ===== */
(function () {
  'use strict';
  const vista = document.getElementById('vista');
  if (!vista) return;
  const zona = 'America/Argentina/Buenos_Aires';
  const fDia = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: zona });
  const fHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona });
  const texto = () => { const d = new Date(), dia = fDia.format(d); return fHora.format(d) + ' hs · ' + dia.charAt(0).toUpperCase() + dia.slice(1); };
  function poner() {
    const h1 = vista.querySelector('.cabecera h1');
    if (!h1 || !/^Hola/.test(h1.textContent)) return;
    let s = h1.parentNode.querySelector('.saludo-reloj');
    if (!s) { s = document.createElement('span'); s.className = 'saludo-reloj'; h1.insertAdjacentElement('afterend', s); }
    s.textContent = texto();
  }
  new MutationObserver(poner).observe(vista, { childList: true });
  poner();
  setTimeout(function () { poner(); setInterval(poner, 60000); }, (60 - new Date().getSeconds()) * 1000);
})();

/* ===== Ajustes de pantalla detrás de una rueda · 2026-09-29 19:10 ARG ===== */
(function () {
  'use strict';
  const usuario = document.querySelector('.nav-usuario');
  if (!usuario || document.querySelector('.ajustes-btn')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn texto ajustes-btn';
  btn.title = 'Ajustes de pantalla';
  btn.setAttribute('aria-label', 'Ajustes de pantalla');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.47.47 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.46.46 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>';
  usuario.insertBefore(btn, document.getElementById('btn-salir'));
  const pop = document.createElement('div');
  pop.className = 'ajustes-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Ajustes de pantalla');
  pop.innerHTML = '<div class="ajustes-tit">Ajustes de pantalla</div><div class="ajustes-fila" data-f="menu"><span>Menú</span></div><div class="ajustes-fila" data-f="tema"><span>Apariencia</span></div>';
  document.body.appendChild(pop);
  const menuSel = document.querySelector('.nav-pie .menu-sel');
  const temaSel = document.querySelector('.nav-pie [data-tema-selector]');
  if (menuSel) pop.querySelector('[data-f=menu]').appendChild(menuSel); else pop.querySelector('[data-f=menu]').remove();
  if (temaSel) pop.querySelector('[data-f=tema]').appendChild(temaSel);
  const ubicar = () => {
    const r = btn.getBoundingClientRect(), w = 260;
    pop.style.left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8) + 'px';
    const alto = pop.offsetHeight;
    let top = r.bottom + 8;
    if (top + alto > innerHeight - 8) top = r.top - alto - 8;
    pop.style.top = Math.max(8, top) + 'px';
  };
  const abrir = (v) => { pop.hidden = !v; btn.setAttribute('aria-expanded', String(v)); if (v) ubicar(); };
  btn.onclick = (e) => { e.stopPropagation(); abrir(pop.hidden); };
  pop.addEventListener('click', (e) => { e.stopPropagation(); if (e.target.closest('[data-menu-opc], [data-tema]')) setTimeout(() => abrir(false), 120); });
  document.addEventListener('click', () => { if (!pop.hidden) abrir(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { abrir(false); btn.focus(); } });
  addEventListener('resize', () => { if (!pop.hidden) ubicar(); });
})();

/* ===== Mensajes de error en castellano · 2026-10-06 17:40 ARG ===== */
(function () {
  'use strict';
  const UNICOS = {
    centros_codigo_key: 'Ya existe un centro de costo con ese código. Usá otro código.',
    cuentas_nombre_key: 'Ya existe una cuenta con ese nombre.',
    categorias_codigo_key: 'Ya existe una categoría con ese código.',
    cheques_cuenta_id_numero_key: 'Ese número de cheque ya está cargado en esa cuenta.',
    recibos_numero_key: 'Ese número de recibo ya existe.',
    cuotas_padron_periodo_categoria_id_tipo_key: 'Hay dos tipos de socio con el mismo nombre en ese mes.',
    conciliaciones_cuenta_id_periodo_key: 'Ese mes ya tiene un saldo cargado para esa cuenta.',
    perfiles_usuario_key: 'Ya existe un usuario con ese nombre.'
  };
  const REGLAS = [
    [/duplicate key value violates unique constraint "([^"]+)"/i, (m) => UNICOS[m[1]] || 'Ya existe un registro con esos mismos datos.'],
    [/violates foreign key constraint/i, () => 'No se puede hacer: hay otros datos (movimientos, cheques o recibos) que dependen de esto. Desactivalo en lugar de borrarlo.'],
    [/chk_mov_transferencia/i, () => 'Una transferencia necesita cuenta de origen y de destino distintas, y no lleva categoría. Un ingreso o egreso necesita categoría.'],
    [/chk_mov_anulado/i, () => 'Para anular hay que escribir el motivo.'],
    [/chk_cheque_pendiente/i, () => 'Un cheque pendiente tiene que tener importe.'],
    [/violates check constraint/i, () => 'Algún dato no es válido. Revisá importes, fechas y campos obligatorios.'],
    [/null value in column "([^"]+)"/i, (m) => 'Falta completar un dato obligatorio (' + m[1].replace(/_id$/, '').replace(/_/g, ' ') + ').'],
    [/invalid input syntax/i, () => 'Hay un dato con formato inválido (fecha, número o importe).'],
    [/value too long/i, () => 'Algún texto es demasiado largo. Acortalo y probá de nuevo.'],
    [/numeric field overflow/i, () => 'El importe es demasiado grande.'],
    [/JWT expired|Invalid Refresh Token|refresh_token_not_found|session.*(missing|expired)/i, () => 'Tu sesión venció. Salí y volvé a ingresar.'],
    [/rate limit|too many requests|over_email_send_rate_limit/i, () => 'Se hicieron demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.'],
    [/Password should|weak.?password|password.*(at least|characters)/i, () => 'La contraseña tiene que tener al menos 10 caracteres, con mayúscula, minúscula y número.'],
    [/Invalid login credentials/i, () => 'Usuario o contraseña incorrectos.'],
    [/Email not confirmed/i, () => 'El correo de ese usuario no está confirmado. Pedile al administrador que lo active.'],
    [/User not found|user_not_found/i, () => 'No existe un usuario con esos datos.'],
    [/Signups not allowed|signup.*disabled/i, () => 'El registro está cerrado. Los usuarios los crea el administrador.'],
    [/payload too large|exceeded the maximum allowed size|entity too large/i, () => 'El archivo es demasiado grande (máximo 10 MB).'],
    [/mime type .* is not supported|invalid_mime_type/i, () => 'Ese tipo de archivo no se acepta. Subí una foto (JPG, PNG) o un PDF.'],
    [/does not exist/i, () => 'Falta actualizar algo en la base de datos. Avisale al administrador.'],
    [/timeout|timed out|AbortError/i, () => 'El servidor tardó demasiado en responder. Probá de nuevo.'],
    [/Failed to fetch|NetworkError|Load failed/i, () => 'Sin conexión con el servidor. Revisá internet y probá de nuevo.']
  ];
  const INGLES = /\b(the|is|are|was|not|does|cannot|can't|unable|failed|invalid|error|value|column|relation|function|violates|constraint|unexpected|unknown|denied|required|missing|exceeded)\b/i;
  window.CDP_traducirError = function (msg) {
    const t = String(msg || '');
    for (const [re, fn] of REGLAS) { const m = t.match(re); if (m) return fn(m); }
    const castellano = /[áéíóúñ¿¡]/i.test(t) || /\b(de|del|la|las|el|los|que|para|con|una?|es|hay|faltan?|ya|se|puede|tiene|solo)\b/i.test(t);
    if (t && (INGLES.test(t) || !castellano) && !castellano) {
      if (window.console) console.warn('Error original:', t);
      return 'Ocurrió un error inesperado. Probá de nuevo y, si sigue, avisale al administrador.';
    }
    return t;
  };
})();
