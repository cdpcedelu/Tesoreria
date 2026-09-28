/* CDP Tesorería · Conciliación bancaria · Versión: 2026-09-28 16:00 ARG */
(function () {
  'use strict';

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  let C = null;
  const st = { cuenta: null, anio: new Date().getFullYear(), abierto: null };
  let movs = [], concs = [], cheques = [], nombres = new Map();

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const finMes = (y, m) => `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
  const inicioSig = (y, m) => (m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`);
  const puede = () => ['admin', 'tesorero'].includes(C.perfil.rol);
  function parseMonto(txt) {
    let s = String(txt || '').replace(/[$\s]/g, '');
    if (!s) return NaN;
    const neg = s.startsWith('-'); s = s.replace(/^-/, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    else if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '');
    const n = Number(s);
    return Number.isFinite(n) ? (neg ? -1 : 1) * Math.round(n * 100) / 100 : NaN;
  }
  const fmtInput = (n) => (n == null ? '' : Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  function estilos() {
    if ($('#cc-estilos')) return;
    const s = document.createElement('style');
    s.id = 'cc-estilos';
    s.textContent = `
      .cc-barra{display:flex;flex-wrap:wrap;gap:.75rem;align-items:end;margin-bottom:1rem}
      .cc-barra label{width:auto;min-width:200px}
      .cc-tabla td{vertical-align:middle}
      .cc-tabla input{max-width:190px;text-align:right;font-weight:600}
      .cc-ok{color:var(--in);font-weight:700;white-space:nowrap}
      .cc-mal{color:var(--out);font-weight:700;white-space:nowrap}
      .cc-nada{color:var(--ink-2);white-space:nowrap}
      .cc-nota{font-size:.8rem;color:var(--ink-2);display:block;max-width:260px}
      .cc-fila-abierta td{background:var(--surface-2)}
      .cc-ayuda{padding:1rem 1.1rem;border-left:3px solid var(--field)}
      .cc-ayuda h3{margin:0 0 .5rem}
      .cc-ayuda ul{margin:.25rem 0 .75rem 1.1rem;padding:0}
      .cc-ayuda li{margin:.2rem 0}
      .cc-pista{display:inline-block;padding:.35rem .6rem;border-radius:6px;background:var(--warn-bg);color:var(--warn);font-weight:600;margin:.25rem 0 .5rem}
      .cc-resumen{display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:1rem}
      .cc-resumen div{font-size:.9rem;color:var(--ink-2)}
      .cc-resumen strong{display:block;font-size:1.25rem;color:var(--ink);font-stretch:110%}
      .cc-hero{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface);margin-bottom:1rem}
      .cc-hero>div{padding:1.2rem 1.35rem 1.3rem;border-right:1px solid var(--line);min-width:0}
      .cc-hero>div:last-child{border-right:0}
      .cc-hero span{display:block;font-size:.85rem;font-weight:650;color:var(--ink-2)}
      .cc-hero strong{display:block;margin:.2rem 0 .3rem;font-size:clamp(1.1rem,1.55vw,1.5rem);font-weight:750;font-stretch:104%;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cc-hero small{display:block;font-size:.8rem;color:var(--ink-2);line-height:1.35}
      .cc-hero .cc-banco{background:var(--field);color:var(--on-field)}
      .cc-hero .cc-banco span,.cc-hero .cc-banco small{color:inherit;opacity:.85}
      .cc-hero .cc-est-ok{background:color-mix(in srgb,var(--in) 10%,var(--surface))}
      .cc-hero .cc-est-ok strong{color:var(--in)}
      .cc-hero .cc-est-mal{background:color-mix(in srgb,var(--out) 9%,var(--surface))}
      .cc-hero .cc-est-mal strong{color:var(--out)}
      .cc-hero .cc-sello{display:inline-block;margin-top:.35rem;padding:.15rem .55rem;border-radius:999px;font-size:.78rem;font-weight:700}
      .cc-est-ok .cc-sello{background:var(--in);color:#fff}
      .cc-est-mal .cc-sello{background:var(--out);color:#fff}
      .cc-prog{display:flex;align-items:center;gap:.75rem;margin:-.25rem 0 1rem;font-size:.85rem;color:var(--ink-2)}
      .cc-prog .pista{flex:1;max-width:320px;height:6px;border-radius:3px;background:var(--surface-2)}
      .cc-prog .relleno{height:100%;border-radius:3px;background:var(--in)}
      @media (max-width:860px){.cc-hero{grid-template-columns:1fr}.cc-hero>div{border-right:0;border-bottom:1px solid var(--line)}.cc-hero>div:last-child{border-bottom:0}}
    `;
    document.head.appendChild(s);
  }

  async function cargar() {
    const todos = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await C.sb.from('v_movimientos').select('id,fecha,tipo,cuenta_id,cuenta_destino_id,monto,detalle,comprobante,anulado,categoria_nombre')
        .order('fecha').order('id').range(desde, desde + 999);
      if (error) throw error;
      todos.push(...data.map((m) => ({ ...m, monto: Number(m.monto) })));
      if (data.length < 1000) break;
    }
    movs = todos;
    const c = await C.sb.from('conciliaciones').select('*');
    if (c.error) throw c.error;
    concs = c.data.map((x) => ({ ...x, saldo_banco: Number(x.saldo_banco) }));
    const ch = await C.sb.from('cheques').select('numero,fecha_pago,beneficiario,concepto,importe,estado,cuenta_id,fecha_cobro');
    cheques = ch.error ? [] : ch.data.map((x) => ({ ...x, importe: Number(x.importe) }));
    const p = await C.sb.from('perfiles').select('id,nombre');
    nombres = new Map((p.data || []).map((x) => [x.id, x.nombre]));
  }

  function saldoApp(cuenta, y, m) {
    return window.Rep.saldoAntesDe(cuenta, inicioSig(y, m), movs);
  }

  function filas() {
    const cuenta = C.cuentas.find((c) => c.id === st.cuenta);
    const hoy = new Date();
    const hastaMes = st.anio < hoy.getFullYear() ? 12 : hoy.getMonth() + 1;
    const out = [];
    for (let m = 1; m <= hastaMes; m++) {
      const fm = finMes(st.anio, m);
      if (fm <= cuenta.fecha_saldo_inicial) continue;
      const app = saldoApp(cuenta, st.anio, m);
      const c = concs.find((x) => x.cuenta_id === cuenta.id && x.periodo === fm);
      const dif = c ? r2(c.saldo_banco - app) : null;
      out.push({ m, fm, app, c, dif });
    }
    return { cuenta, lista: out };
  }

  function explicar(cuenta, f) {
    const y = st.anio, m = f.m;
    const desde = `${y}-${pad(m)}-01`, hasta = f.fm;
    const delMes = movs.filter((x) => !x.anulado && x.fecha >= desde && x.fecha <= hasta && (x.cuenta_id === cuenta.id || x.cuenta_destino_id === cuenta.id));
    const dif = f.dif, abs = Math.abs(dif);
    const pistas = [];
    const chPend = cheques.filter((c) => c.cuenta_id === cuenta.id && c.estado === 'pendiente' && c.fecha_pago && c.fecha_pago <= hasta);
    const sumaCh = r2(chPend.reduce((s, c) => s + c.importe, 0));
    if (chPend.length && dif < 0 && Math.abs(sumaCh - abs) < 1) pistas.push(`La diferencia coincide exacto con los ${chPend.length} cheques vencidos sin confirmar: probablemente ya se debitaron.`);
    const chUno = chPend.filter((c) => Math.abs(c.importe - abs) < 1);
    chUno.forEach((c) => pistas.push(`El cheque N.º ${c.numero} (${C.money(c.importe)}) coincide con la diferencia: ¿ya se debitó?`));
    delMes.filter((x) => Math.abs(x.monto - abs) < 1).forEach((x) => pistas.push(`El movimiento "${x.detalle}" es por ${C.money(x.monto)}, justo la diferencia: revisá si está duplicado, falta o tiene el signo al revés.`));
    delMes.filter((x) => Math.abs(x.monto * 2 - abs) < 1).forEach((x) => pistas.push(`"${x.detalle}" (${C.money(x.monto)}) es la mitad de la diferencia: puede estar cargado como ingreso en vez de egreso, o al revés.`));
    const vistos = new Map();
    delMes.forEach((x) => { const k = `${x.tipo}|${x.monto}|${x.detalle.trim().toLowerCase()}`; vistos.set(k, (vistos.get(k) || 0) + 1); });
    const dups = [...vistos.entries()].filter(([, n]) => n > 1).map(([k, n]) => ({ det: k.split('|')[2], monto: Number(k.split('|')[1]), n }));
    const ant = f.m > 1 ? filas().lista.find((x) => x.m === f.m - 1) : null;
    if (ant && ant.dif != null && Math.abs(ant.dif - dif) < 1 && Math.abs(dif) > 0.5) pistas.push('Es la misma diferencia que el mes anterior: el problema viene de antes, empezá por ese mes.');
    return { delMes, chPend, sumaCh, pistas, dups };
  }

  async function render(ctx) {
    C = ctx;
    estilos();
    if (!st.cuenta) st.cuenta = (C.cuentas.find((c) => c.tipo === 'banco' && c.activa) || C.cuentas[0]).id;
    C.vista.innerHTML = '<div class="cargando">Cargando…</div>';
    await cargar();
    pintar();
  }

  function pintar() {
    const { cuenta, lista } = filas();
    const cargados = lista.filter((f) => f.c);
    const ok = cargados.filter((f) => Math.abs(f.dif) < 0.5).length;
    const ultimo = [...cargados].reverse()[0];
    const anios = []; for (let y = new Date().getFullYear(); y >= 2026; y--) anios.push(y);
    const hoyD = new Date(), manana = new Date(hoyD.getFullYear(), hoyD.getMonth(), hoyD.getDate() + 1);
    const saldoHoy = window.Rep.saldoAntesDe(cuenta, `${manana.getFullYear()}-${pad(manana.getMonth() + 1)}-${pad(manana.getDate())}`, movs);
    const propios = movs.filter((x) => !x.anulado && (x.cuenta_id === cuenta.id || x.cuenta_destino_id === cuenta.id));
    const ultMov = propios.length ? propios[propios.length - 1].fecha : null;
    const todosC = concs.filter((x) => x.cuenta_id === cuenta.id).sort((a, b) => (a.periodo < b.periodo ? 1 : -1));
    const ult = todosC[0] || null;
    let difUlt = null, posteriores = [];
    if (ult) {
      const [yy, mm] = ult.periodo.split('-').map(Number);
      difUlt = r2(ult.saldo_banco - saldoApp(cuenta, yy, mm));
      posteriores = propios.filter((x) => x.fecha > ult.periodo);
    }
    const cuando = ult ? new Date(ult.updated_at || ult.created_at) : null;
    const diasDesde = cuando ? Math.floor((hoyD - cuando) / 864e5) : null;
    const quien = ult ? nombres.get(ult.updated_by || ult.created_by) : null;
    const fh = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const esBanco = cuenta.tipo !== 'efectivo';
    const okUlt = ult && Math.abs(difUlt) < 0.5;

    C.vista.innerHTML = `
      <div class="cabecera">
        <div><h1>Conciliación bancaria</h1><p>Cargá el saldo del extracto a fin de cada mes y la app te dice si coincide. La meta: diferencia en cero.</p></div>
      </div>
      <div class="cc-barra">
        <label>Cuenta<select data-cuenta>${C.cuentas.filter((c) => c.activa && c.tipo !== 'inversion').map((c) => `<option value="${c.id}" ${c.id === st.cuenta ? 'selected' : ''}>${C.esc(c.nombre)}${c.numero ? ' (' + C.esc(c.numero) + ')' : ''}</option>`).join('')}</select></label>
        <label>Año<select data-anio>${anios.map((y) => `<option ${y === st.anio ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
      </div>
      <section class="cc-hero" aria-label="Estado de la conciliación">
        <div>
          <span>Saldo en la app hoy</span>
          <strong>${C.money(saldoHoy)}</strong>
          <small>${ultMov ? 'Último movimiento cargado: ' + C.fecha(ultMov) : 'Sin movimientos'}</small>
        </div>
        <div class="cc-banco">
          <span>${esBanco ? 'Saldo en el banco' : 'Saldo contado en caja'}</span>
          <strong>${ult ? C.money(ult.saldo_banco) : 'Sin cargar'}</strong>
          <small>${ult ? `Según ${esBanco ? 'extracto' : 'arqueo'} al ${C.fecha(ult.periodo)}<br>Actualizado el ${fh(cuando)}${quien ? ' por ' + C.esc(quien) : ''}` : `Cargá el saldo del ${esBanco ? 'extracto' : 'arqueo'} en la tabla de abajo`}</small>
        </div>
        <div class="${ult ? (okUlt ? 'cc-est-ok' : 'cc-est-mal') : ''}">
          <span>${ult ? 'Diferencia al ' + C.fecha(ult.periodo) : 'Diferencia'}</span>
          <strong>${ult ? C.money(difUlt) : '-'}</strong>
          <small>${ult ? (diasDesde === 0 ? 'Actualizado hoy' : `Hace ${diasDesde} día${diasDesde === 1 ? '' : 's'} de la última actualización`) : 'Todavía no hay conciliaciones'}${ult && posteriores.length ? `<br>Después del extracto se cargaron ${posteriores.length} movimientos` : ''}</small>
          ${ult ? `<span class="cc-sello">${okUlt ? '✓ Conciliado' : 'No coincide'}</span>` : ''}
        </div>
      </section>
      <div class="cc-prog"><span>${ok} de ${lista.length} meses conciliados</span><div class="pista"><div class="relleno" style="width:${lista.length ? (ok / lista.length * 100).toFixed(0) : 0}%"></div></div></div>
      ${cuenta.tipo === 'efectivo' ? '<p class="muted" style="margin-top:-.5rem">Para Efectivo, cargá lo que contaste en la caja (arqueo).</p>' : ''}
      <div class="tabla-wrap"><table class="cc-tabla">
        <thead><tr><th>Mes</th><th class="num">Saldo según la app</th><th class="num">Saldo según ${cuenta.tipo === 'efectivo' ? 'arqueo' : 'extracto'}</th><th class="num">Diferencia</th><th>Estado</th><th></th></tr></thead>
        <tbody>${lista.map((f) => `
          <tr class="${st.abierto === f.m ? 'cc-fila-abierta' : ''}">
            <td><strong>${MESES[f.m - 1]}</strong><span class="sub">al ${C.fecha(f.fm)}</span></td>
            <td class="num">${C.money(f.app)}</td>
            <td class="num">${puede()
              ? `<input data-saldo="${f.m}" inputmode="decimal" value="${f.c ? fmtInput(f.c.saldo_banco) : ''}" placeholder="Cargar" aria-label="Saldo ${MESES[f.m - 1]}">`
              : (f.c ? C.money(f.c.saldo_banco) : '<span class="muted">-</span>')}
              ${f.c && f.c.nota ? `<span class="cc-nota">${C.esc(f.c.nota)}</span>` : ''}</td>
            <td class="num ${f.c ? (Math.abs(f.dif) < 0.5 ? 'cc-ok' : 'cc-mal') : ''}">${f.c ? C.money(f.dif) : ''}</td>
            <td>${!f.c ? '<span class="cc-nada">Sin cargar</span>' : Math.abs(f.dif) < 0.5 ? '<span class="cc-ok">✓ Conciliado</span>' : '<span class="cc-mal">No coincide</span>'}</td>
            <td class="num">${f.c && Math.abs(f.dif) >= 0.5 ? `<button class="btn texto" data-ver="${f.m}">${st.abierto === f.m ? 'Cerrar' : 'Buscar la diferencia'}</button>` : ''}
              ${puede() && f.c ? `<button class="btn texto" data-nota="${f.m}">Nota</button>` : ''}</td>
          </tr>
          ${st.abierto === f.m && f.c ? `<tr><td colspan="6">${ayudaHTML(cuenta, f)}</td></tr>` : ''}`).join('')}
        </tbody>
      </table></div>
      <p class="muted" style="font-size:.85rem;margin-top:.75rem">El saldo según la app es el de la cuenta al último día del mes, con todos los movimientos cargados hasta esa fecha. Si ponés el saldo del extracto y la diferencia es cero, ese mes queda conciliado.</p>`;

    $('[data-cuenta]', C.vista).onchange = (e) => { st.cuenta = Number(e.target.value); st.abierto = null; pintar(); };
    $('[data-anio]', C.vista).onchange = (e) => { st.anio = Number(e.target.value); st.abierto = null; pintar(); };
    $$('[data-ver]', C.vista).forEach((b) => b.onclick = () => { const m = Number(b.dataset.ver); st.abierto = st.abierto === m ? null : m; pintar(); });
    $$('[data-saldo]', C.vista).forEach((inp) => {
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } };
      inp.onchange = () => guardar(Number(inp.dataset.saldo), inp.value);
    });
    $$('[data-nota]', C.vista).forEach((b) => b.onclick = () => nota(Number(b.dataset.nota)));
  }

  function ayudaHTML(cuenta, f) {
    const x = explicar(cuenta, f);
    const signo = f.dif > 0
      ? `El ${cuenta.tipo === 'efectivo' ? 'arqueo' : 'banco'} tiene <strong>${C.money(f.dif)} más</strong> que la app: falta cargar algún ingreso, o hay un egreso de más.`
      : `El ${cuenta.tipo === 'efectivo' ? 'arqueo' : 'banco'} tiene <strong>${C.money(-f.dif)} menos</strong> que la app: falta cargar algún egreso (débitos, comisiones, cheques), o hay un ingreso de más.`;
    return `<div class="cc-ayuda">
      <h3>Buscando la diferencia de ${MESES[f.m - 1]}</h3>
      <p style="margin:.25rem 0 .5rem">${signo}</p>
      ${x.pistas.length ? x.pistas.map((p) => `<div class="cc-pista">${C.esc(p)}</div>`).join('<br>') : '<p class="muted">No encontré un movimiento o cheque que coincida exacto. Revisá el extracto línea por línea con la lista de abajo.</p>'}
      ${x.chPend.length ? `<p style="margin:.75rem 0 .25rem"><strong>Cheques vencidos a esa fecha sin confirmar</strong> (${C.money(x.sumaCh)}):</p>
        <ul>${x.chPend.map((c) => `<li>N.º ${c.numero}, ${C.fecha(c.fecha_pago)}: ${C.esc(c.beneficiario ? c.beneficiario + ' - ' : '')}${C.esc(c.concepto)}, ${C.money(c.importe)}</li>`).join('')}</ul>` : ''}
      ${x.dups.length ? `<p style="margin:.75rem 0 .25rem"><strong>Posibles duplicados en el mes:</strong></p><ul>${x.dups.map((d) => `<li>${C.esc(d.det)}: ${d.n} veces por ${C.money(d.monto)}</li>`).join('')}</ul>` : ''}
      <p style="margin:.75rem 0 .25rem"><strong>Movimientos del mes en ${C.esc(cuenta.nombre)}</strong> (${x.delMes.length}): <a href="#movimientos" data-ir-mov>ver en Movimientos</a></p>
    </div>`;
  }

  async function guardar(m, valor) {
    const cuenta = C.cuentas.find((c) => c.id === st.cuenta);
    const fm = finMes(st.anio, m);
    const existe = concs.find((x) => x.cuenta_id === cuenta.id && x.periodo === fm);
    if (!String(valor).trim()) {
      if (existe) {
        const { error } = await C.sb.from('conciliaciones').delete().eq('id', existe.id);
        if (error) { C.toast(C.errorTexto(error), true); return; }
        concs = concs.filter((x) => x.id !== existe.id);
      }
      pintar(); return;
    }
    const n = parseMonto(valor);
    if (!Number.isFinite(n)) { C.toast('No entendí el importe. Escribilo como 1.234.567,89', true); pintar(); return; }
    const fila = { cuenta_id: cuenta.id, periodo: fm, saldo_banco: n };
    const r = existe
      ? await C.sb.from('conciliaciones').update({ saldo_banco: n }).eq('id', existe.id).select()
      : await C.sb.from('conciliaciones').insert(fila).select();
    if (r.error || !r.data.length) { C.toast(r.error ? C.errorTexto(r.error) : 'No tenés permiso para hacer esto.', true); return; }
    const g = { ...r.data[0], saldo_banco: Number(r.data[0].saldo_banco) };
    concs = concs.filter((x) => x.id !== g.id).concat(g);
    const app = saldoApp(cuenta, st.anio, m), dif = r2(n - app);
    C.toast(Math.abs(dif) < 0.5 ? `${MESES[m - 1]} conciliado ✓` : `${MESES[m - 1]}: diferencia de ${C.money(dif)}`, Math.abs(dif) >= 0.5);
    if (Math.abs(dif) >= 0.5) st.abierto = m;
    pintar();
  }

  function nota(m) {
    const cuenta = C.cuentas.find((c) => c.id === st.cuenta);
    const c = concs.find((x) => x.cuenta_id === cuenta.id && x.periodo === finMes(st.anio, m));
    if (!c) return;
    const card = C.abrirModal(`<div class="modal-cab"><h2 id="modal-titulo">Nota de ${MESES[m - 1]}</h2><button type="button" class="cerrar" data-cerrar aria-label="Cerrar">×</button></div>
      <form class="form" novalidate>
        <label>Nota<textarea name="nota" maxlength="400" placeholder="Ej.: la diferencia es el cheque 2347 que se debitó el 24/9">${C.esc(c.nota || '')}</textarea></label>
        <p class="error" role="alert" hidden></p>
        <div class="modal-pie"><div class="der"><button type="button" class="btn" data-no>Cancelar</button><button type="submit" class="btn primario">Guardar</button></div></div>
      </form>`);
    $('[data-cerrar]', card).onclick = C.cerrarModal; $('[data-no]', card).onclick = C.cerrarModal;
    $('form', card).onsubmit = async (e) => {
      e.preventDefault();
      const v = e.target.nota.value.trim() || null;
      const r = await C.sb.from('conciliaciones').update({ nota: v }).eq('id', c.id).select();
      if (r.error || !r.data.length) { const p = $('.error', card); p.textContent = r.error ? C.errorTexto(r.error) : 'No tenés permiso.'; p.hidden = false; return; }
      c.nota = v; C.cerrarModal(); C.toast('Nota guardada'); pintar();
    };
  }

  window.CDP_Conciliacion = { render };
})();
