/* CDP Tesorería · Cheques · Versión: 2026-09-28 14:30 ARG */
(function () {
  'use strict';

  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  let C = null;
  let cheques = [];
  const st = { filtro: 'proximos', texto: '' };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoy = () => iso(new Date());
  const dias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  function sumarMeses(f, n) {
    const [y, m, d] = f.split('-').map(Number);
    const base = new Date(y, m - 1 + n, 1);
    const ult = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    return iso(new Date(base.getFullYear(), base.getMonth(), Math.min(d, ult)));
  }
  function parseMonto(txt) {
    let s = String(txt || '').replace(/[$\s]/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    else if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '');
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }
  const puede = () => ['admin', 'tesorero'].includes(C.perfil.rol);

  function situacion(ch) {
    if (ch.estado !== 'pendiente') return ch.estado;
    if (!ch.fecha_pago) return 'sinfecha';
    const d = dias(hoy(), ch.fecha_pago);
    if (d < 0) return 'vencido';
    if (d <= 7) return 'proximo';
    return 'pendiente';
  }
  function etiqueta(ch) {
    const s = situacion(ch), h = hoy();
    if (s === 'cobrado') return `<span class="etq ch-ok">Cobrado${ch.fecha_cobro ? ' el ' + C.fecha(ch.fecha_cobro) : ''}</span>`;
    if (s === 'anulado') return '<span class="etq">Anulado</span>';
    if (s === 'sinfecha') return '<span class="etq warn">Sin fecha</span>';
    const d = dias(h, ch.fecha_pago);
    if (s === 'vencido') return `<span class="etq ch-venc">Venció hace ${-d} día${d === -1 ? '' : 's'}</span>`;
    if (d === 0) return '<span class="etq warn">Vence hoy</span>';
    if (s === 'proximo') return `<span class="etq warn">Vence en ${d} día${d === 1 ? '' : 's'}</span>`;
    return `<span class="etq">Vence en ${d} días</span>`;
  }

  function opcionesCategorias(sel) {
    const raices = C.categorias.filter((c) => c.tipo === 'egreso' && !c.padre_id && (c.activa || c.id === sel));
    let h = '<option value="">Elegí una categoría</option>';
    for (const r of raices) {
      h += `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${C.esc(r.nombre)}</option>`;
      for (const x of C.categorias.filter((c) => c.padre_id === r.id && (c.activa || c.id === sel))) {
        h += `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${C.esc(r.nombre)} / ${C.esc(x.nombre)}</option>`;
      }
    }
    return h;
  }
  const opcionesCentros = (sel) => '<option value="">Sin centro</option>' +
    C.centros.filter((c) => c.activo || c.id === sel).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${C.esc(c.nombre)} (${C.esc(c.codigo)})</option>`).join('');
  const opcionesCuentas = (sel) => C.cuentas.filter((c) => c.tipo === 'banco' && (c.activa || c.id === sel))
    .map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${C.esc(c.nombre)}${c.numero ? ' (' + C.esc(c.numero) + ')' : ''}</option>`).join('');
  const intOrNull = (v) => (v === '' || v == null ? null : Number(v));
  const cab = (t) => `<div class="modal-cab"><h2 id="modal-titulo">${C.esc(t)}</h2><button type="button" class="cerrar" data-cerrar aria-label="Cerrar">×</button></div>`;

  function estilos() {
    if ($('#ch-estilos')) return;
    const s = document.createElement('style');
    s.id = 'ch-estilos';
    s.textContent = `
      .ch-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;margin-bottom:1rem}
      .ch-kpi{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:1rem 1.15rem}
      .ch-kpi span{display:block;font-size:.82rem;color:var(--ink-2);font-weight:600}
      .ch-kpi strong{display:block;font-size:1.45rem;font-stretch:112%;font-weight:750;margin-top:.15rem;white-space:nowrap}
      .ch-kpi small{color:var(--ink-2);font-size:.78rem}
      .ch-kpi.destacado{background:var(--field);border-color:var(--field);color:var(--on-field)}
      .ch-kpi.destacado span,.ch-kpi.destacado small{color:inherit;opacity:.85}
      .ch-kpi.alerta{border-color:var(--out)}
      .ch-kpi.alerta strong{color:var(--out)}
      .ch-cal{display:flex;gap:.6rem;overflow-x:auto;padding-bottom:.25rem}
      .ch-mes{flex:0 0 118px;border:1px solid var(--line);border-radius:8px;padding:.7rem .75rem;background:var(--surface);cursor:pointer;text-align:left}
      .ch-mes:hover{border-color:var(--ink-2)}
      .ch-mes b{display:block;font-size:.8rem;color:var(--ink-2)}
      .ch-mes strong{display:block;font-size:1rem;margin:.15rem 0 .4rem;white-space:nowrap}
      .ch-mes .pista{height:5px;border-radius:3px;background:var(--surface-2)}
      .ch-mes .relleno{height:100%;border-radius:3px;background:var(--field)}
      .ch-mes small{display:block;margin-top:.35rem;color:var(--ink-2);font-size:.75rem}
      .ch-mes.vacio{opacity:.55}
      .ch-num{font-weight:700;font-stretch:108%;white-space:nowrap}
      #vista td .etq{white-space:nowrap}
      .etq.ch-venc{background:transparent;color:var(--out);border-color:var(--out)}
      .etq.ch-ok{color:var(--in);border-color:transparent}
      .ch-acc{white-space:nowrap;text-align:right}
      .ch-acc .btn{min-height:32px;padding:0 .6rem;font-size:.85rem}
      .ch-serie-prev{max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:6px}
      .ch-serie-prev td{padding:.35rem .6rem;font-size:.85rem}
      @media (max-width:860px){.ch-kpis{grid-template-columns:1fr 1fr}.ch-kpi strong{font-size:1.1rem}}
    `;
    document.head.appendChild(s);
  }

  async function cargar() {
    const { data, error } = await C.sb.from('cheques').select('*').order('numero');
    if (error) throw error;
    cheques = data.map((c) => ({ ...c, importe: c.importe == null ? null : Number(c.importe) }));
  }

  function filtrados() {
    const t = st.texto.toLowerCase();
    return cheques.filter((c) => {
      const s = situacion(c);
      const okF =
        st.filtro === 'todos' ||
        (st.filtro === 'proximos' && c.estado === 'pendiente' && s !== 'vencido') ||
        (st.filtro === 'vencidos' && s === 'vencido') ||
        (st.filtro === 'cobrados' && c.estado === 'cobrado') ||
        (st.filtro === 'anulados' && c.estado === 'anulado') ||
        (st.filtro.startsWith('mes:') && c.estado === 'pendiente' && (c.fecha_pago || '').slice(0, 7) === st.filtro.slice(4));
      const okT = !t || `${c.numero} ${c.beneficiario || ''} ${c.concepto || ''}`.toLowerCase().includes(t);
      return okF && okT;
    }).sort((a, b) => {
      const fa = a.fecha_pago || '9999', fb = b.fecha_pago || '9999';
      if (st.filtro === 'cobrados' || st.filtro === 'todos' || st.filtro === 'anulados') return b.numero - a.numero;
      return fa === fb ? a.numero - b.numero : fa < fb ? -1 : 1;
    });
  }

  async function render(ctx) {
    C = ctx;
    estilos();
    C.vista.innerHTML = '<div class="cargando">Cargando…</div>';
    await cargar();
    pintar();
  }

  function pintar() {
    const h = hoy();
    const pend = cheques.filter((c) => c.estado === 'pendiente');
    const futuros = pend.filter((c) => c.fecha_pago && c.fecha_pago >= h);
    const vencidos = pend.filter((c) => c.fecha_pago && c.fecha_pago < h);
    const prox30 = futuros.filter((c) => dias(h, c.fecha_pago) <= 30);
    const cobradosAnio = cheques.filter((c) => c.estado === 'cobrado' && (c.fecha_cobro || c.fecha_pago || '').startsWith(h.slice(0, 4)));
    const suma = (l) => l.reduce((s, c) => s + (c.importe || 0), 0);

    const meses = [];
    for (let i = 0; i < 12; i++) {
      const f = sumarMeses(h.slice(0, 8) + '01', i);
      const clave = f.slice(0, 7);
      const l = futuros.filter((c) => c.fecha_pago.slice(0, 7) === clave);
      meses.push({ clave, y: +f.slice(0, 4), m: +f.slice(5, 7), total: suma(l), n: l.length });
    }
    const maxMes = Math.max(1, ...meses.map((m) => m.total));
    const lista = filtrados();
    const FILTROS = [['proximos', 'Por pagar'], ['vencidos', `Vencidos sin confirmar${vencidos.length ? ' (' + vencidos.length + ')' : ''}`], ['cobrados', 'Cobrados'], ['anulados', 'Anulados'], ['todos', 'Todos']];

    C.vista.innerHTML = `
      <div class="cabecera">
        <div><h1>Cheques</h1><p>Chequera del club: pagos diferidos, vencimientos y cobros.</p></div>
        <div class="acciones">
          <button class="btn" data-pdf>PDF de pendientes</button>
          ${puede() ? '<button class="btn" data-serie>Emitir en cuotas</button><button class="btn primario" data-nuevo>Nuevo cheque</button>' : ''}
        </div>
      </div>

      <section class="ch-kpis" aria-label="Resumen de cheques">
        <div class="ch-kpi destacado"><span>Comprometido a futuro</span><strong>${C.money(suma(futuros))}</strong><small>${futuros.length} cheques por pagar</small></div>
        <div class="ch-kpi"><span>Próximos 30 días</span><strong>${C.money(suma(prox30))}</strong><small>${prox30.length} cheques</small></div>
        <div class="ch-kpi ${vencidos.length ? 'alerta' : ''}"><span>Vencidos sin confirmar</span><strong>${C.money(suma(vencidos))}</strong><small>${vencidos.length ? 'Confirmá si se debitaron' : 'Todo al día'}</small></div>
        <div class="ch-kpi"><span>Cobrados en ${h.slice(0, 4)}</span><strong>${C.money(suma(cobradosAnio))}</strong><small>${cobradosAnio.length} cheques</small></div>
      </section>

      <section class="panel">
        <h2>Calendario de pagos</h2>
        <div class="ch-cal">
          ${meses.map((m) => `<button type="button" class="ch-mes ${m.n ? '' : 'vacio'}" data-mes="${m.clave}" ${st.filtro === 'mes:' + m.clave ? 'aria-pressed="true"' : ''}>
            <b>${MESES[m.m - 1]} ${String(m.y).slice(2)}</b>
            <strong>${m.n ? C.money(m.total) : '-'}</strong>
            <div class="pista"><div class="relleno" style="width:${(m.total / maxMes * 100).toFixed(1)}%"></div></div>
            <small>${m.n ? m.n + ' cheque' + (m.n > 1 ? 's' : '') : 'Sin pagos'}</small>
          </button>`).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="presets" role="group" aria-label="Filtro">
          ${FILTROS.map(([k, t]) => `<button type="button" data-f="${k}" aria-pressed="${st.filtro === k}">${t}</button>`).join('')}
          ${st.filtro.startsWith('mes:') ? `<button type="button" aria-pressed="true" data-f="proximos">${MESES_L[+st.filtro.slice(9) - 1]} ${st.filtro.slice(4, 8)} ×</button>` : ''}
        </div>
        <label class="buscar" style="margin-bottom:.75rem;max-width:420px">Buscar<input type="search" data-buscar value="${C.esc(st.texto)}" placeholder="Número, beneficiario o concepto"></label>
        ${lista.length ? `<div class="tabla-wrap"><table>
          <thead><tr><th>N.º</th><th>Pago</th><th>Beneficiario y concepto</th><th class="num">Importe</th><th>Estado</th><th></th></tr></thead>
          <tbody>${lista.map((c) => `<tr>
            <td class="ch-num">${c.numero}</td>
            <td>${c.fecha_pago ? C.fecha(c.fecha_pago) : '<span class="muted">-</span>'}</td>
            <td>${C.esc(c.beneficiario || '')}${c.beneficiario ? '<span class="sub">' : ''}${C.esc(c.concepto || '')}${c.beneficiario ? '</span>' : ''}${c.estado === 'anulado' && c.motivo_anulacion ? `<span class="sub">Motivo: ${C.esc(c.motivo_anulacion)}</span>` : ''}${c.movimiento_id ? `<span class="sub">Movimiento N.º ${c.movimiento_id}</span>` : ''}${c.estado === 'cobrado' && !c.movimiento_id ? '<span class="sub">Sin movimiento cargado en el banco</span>' : ''}</td>
            <td class="num">${c.importe != null ? C.money(c.importe) : ''}</td>
            <td>${etiqueta(c)}</td>
            <td class="ch-acc">${puede() && c.estado === 'pendiente' ? `<button class="btn" data-cobrar="${c.id}">Confirmar cobro</button> <button class="btn texto" data-editar="${c.id}">Editar</button> <button class="btn texto peligro" data-anular="${c.id}">Anular</button>` : ''}</td>
          </tr>`).join('')}</tbody>
          <tfoot><tr><td></td><td></td><td>${lista.length} cheques</td><td class="num">${C.money(suma(lista))}</td><td></td><td></td></tr></tfoot>
        </table></div>` : '<div class="vacio">No hay cheques en esta vista.</div>'}
      </section>`;

    $$('[data-f]', C.vista).forEach((b) => b.onclick = () => { st.filtro = b.dataset.f; pintar(); });
    $$('[data-mes]', C.vista).forEach((b) => b.onclick = () => { st.filtro = st.filtro === 'mes:' + b.dataset.mes ? 'proximos' : 'mes:' + b.dataset.mes; pintar(); });
    let t; const bus = $('[data-buscar]', C.vista);
    bus.oninput = () => { clearTimeout(t); t = setTimeout(() => { st.texto = bus.value.trim(); const pos = bus.selectionStart; pintar(); const n = $('[data-buscar]', C.vista); n.focus(); n.setSelectionRange(pos, pos); }, 250); };
    const bn = $('[data-nuevo]', C.vista); if (bn) bn.onclick = () => formCheque(null);
    const bs = $('[data-serie]', C.vista); if (bs) bs.onclick = formSerie;
    $('[data-pdf]', C.vista).onclick = pdfPendientes;
    $$('[data-cobrar]', C.vista).forEach((b) => b.onclick = () => formCobro(cheques.find((c) => c.id === Number(b.dataset.cobrar))));
    $$('[data-editar]', C.vista).forEach((b) => b.onclick = () => formCheque(cheques.find((c) => c.id === Number(b.dataset.editar))));
    $$('[data-anular]', C.vista).forEach((b) => b.onclick = () => formAnular(cheques.find((c) => c.id === Number(b.dataset.anular))));
  }

  async function recargar(msg) {
    C.cerrarModal();
    if (msg) C.toast(msg);
    await cargar();
    pintar();
  }
  const errorEn = (card, e) => { const p = $('.error', card); p.textContent = C.errorTexto ? C.errorTexto(e) : (e.message || String(e)); p.hidden = false; };

  function formCheque(ch) {
    const nuevo = !ch;
    const banco = C.cuentas.find((c) => c.tipo === 'banco' && c.activa);
    const siguiente = cheques.length ? Math.max(...cheques.map((c) => c.numero)) + 1 : '';
    const d = ch || { numero: siguiente, fecha_emision: hoy(), fecha_pago: '', beneficiario: '', concepto: '', importe: null, cuenta_id: banco && banco.id };
    const card = C.abrirModal(`${cab(nuevo ? 'Nuevo cheque' : 'Editar cheque N.º ' + ch.numero)}
      <form class="form" novalidate>
        <div class="dos">
          <label>Número<input name="numero" inputmode="numeric" value="${d.numero ?? ''}" required ${nuevo ? '' : 'readonly'}></label>
          <label>Cuenta<select name="cuenta_id">${opcionesCuentas(d.cuenta_id)}</select></label>
        </div>
        <div class="dos">
          <label>Fecha de emisión<input type="date" name="fecha_emision" value="${d.fecha_emision || ''}"></label>
          <label>Fecha de pago<input type="date" name="fecha_pago" value="${d.fecha_pago || ''}" required></label>
        </div>
        <label>A la orden de<input name="beneficiario" value="${C.esc(d.beneficiario || '')}" maxlength="120" placeholder="Proveedor o persona"></label>
        <label>Concepto<input name="concepto" value="${C.esc(d.concepto || '')}" maxlength="200" placeholder="Ej.: Materiales ampliación quincho" required></label>
        <label class="monto-grande">Importe<input name="importe" inputmode="decimal" value="${d.importe != null ? d.importe.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : ''}" placeholder="0,00" required></label>
        <div class="dos">
          <label>Categoría del gasto<select name="categoria_id">${opcionesCategorias(d.categoria_id)}</select></label>
          <label>Centro de costo<select name="centro_id">${opcionesCentros(d.centro_id)}</select></label>
        </div>
        <label>Notas<input name="notas" value="${C.esc(d.notas || '')}" maxlength="200"></label>
        <p class="error" role="alert" hidden></p>
        <div class="modal-pie"><div class="der"><button type="button" class="btn" data-no>Cancelar</button><button type="submit" class="btn primario">Guardar</button></div></div>
      </form>`);
    $('[data-cerrar]', card).onclick = C.cerrarModal; $('[data-no]', card).onclick = C.cerrarModal;
    const f = $('form', card);
    f.importe.onblur = () => { const n = parseMonto(f.importe.value); if (Number.isFinite(n)) f.importe.value = n.toLocaleString('es-AR', { minimumFractionDigits: 2 }); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = {
        numero: Number(f.numero.value), cuenta_id: intOrNull(f.cuenta_id.value),
        fecha_emision: f.fecha_emision.value || null, fecha_pago: f.fecha_pago.value || null,
        beneficiario: f.beneficiario.value.trim() || null, concepto: f.concepto.value.trim(),
        importe: parseMonto(f.importe.value), categoria_id: intOrNull(f.categoria_id.value),
        centro_id: intOrNull(f.centro_id.value), notas: f.notas.value.trim() || null
      };
      const p = !(v.numero > 0) ? 'Poné el número del cheque.' : !v.cuenta_id ? 'Elegí la cuenta.' : !v.fecha_pago ? 'Poné la fecha de pago.' : !v.concepto ? 'Escribí el concepto.' : !(v.importe > 0) ? 'El importe tiene que ser mayor a cero.' : null;
      if (p) { errorEn(card, new Error(p)); return; }
      if (nuevo && cheques.some((c) => c.numero === v.numero && c.cuenta_id === v.cuenta_id)) { errorEn(card, new Error(`El cheque N.º ${v.numero} ya está cargado.`)); return; }
      if (!nuevo) delete v.numero;
      const r = nuevo ? await C.sb.from('cheques').insert(v).select() : await C.sb.from('cheques').update(v).eq('id', ch.id).select();
      if (r.error || !r.data.length) { errorEn(card, r.error || new Error('No tenés permiso para hacer esto.')); return; }
      recargar(nuevo ? 'Cheque cargado' : 'Cambios guardados');
    };
  }

  function formSerie() {
    const banco = C.cuentas.find((c) => c.tipo === 'banco' && c.activa);
    const siguiente = cheques.length ? Math.max(...cheques.map((c) => c.numero)) + 1 : '';
    const card = C.abrirModal(`${cab('Emitir cheques en cuotas')}
      <p class="muted" style="margin-top:-.5rem">Para compras en cuotas: carga varios cheques correlativos, uno por mes.</p>
      <form class="form" novalidate>
        <div class="dos">
          <label>Primer número<input name="desde" inputmode="numeric" value="${siguiente}" required></label>
          <label>Cantidad de cheques<input name="cant" inputmode="numeric" value="3" required></label>
        </div>
        <div class="dos">
          <label>Importe de cada cheque<input name="importe" inputmode="decimal" placeholder="0,00" required></label>
          <label>Primer pago<input type="date" name="fecha" value="${sumarMeses(hoy(), 1)}" required></label>
        </div>
        <div class="dos">
          <label>A la orden de<input name="beneficiario" maxlength="120" required></label>
          <label>Cuenta<select name="cuenta_id">${opcionesCuentas(banco && banco.id)}</select></label>
        </div>
        <label>Concepto<input name="concepto" maxlength="160" placeholder="Ej.: Tractor John Deere" required></label>
        <div class="dos">
          <label>Categoría del gasto<select name="categoria_id">${opcionesCategorias(null)}</select></label>
          <label>Centro de costo<select name="centro_id">${opcionesCentros(null)}</select></label>
        </div>
        <div data-prev></div>
        <p class="error" role="alert" hidden></p>
        <div class="modal-pie"><div class="der"><button type="button" class="btn" data-no>Cancelar</button><button type="submit" class="btn primario">Cargar cheques</button></div></div>
      </form>`, { ancho: true });
    $('[data-cerrar]', card).onclick = C.cerrarModal; $('[data-no]', card).onclick = C.cerrarModal;
    const f = $('form', card);
    const armar = () => {
      const desde = Number(f.desde.value), n = Math.min(60, Number(f.cant.value)), imp = parseMonto(f.importe.value);
      if (!(desde > 0) || !(n > 0) || !f.fecha.value) return [];
      return Array.from({ length: n }, (_, i) => ({
        numero: desde + i, cuenta_id: intOrNull(f.cuenta_id.value), fecha_emision: hoy(),
        fecha_pago: sumarMeses(f.fecha.value, i), beneficiario: f.beneficiario.value.trim() || null,
        concepto: `${f.concepto.value.trim()} (cuota ${i + 1} de ${n})`, importe: imp,
        categoria_id: intOrNull(f.categoria_id.value), centro_id: intOrNull(f.centro_id.value)
      }));
    };
    const prev = () => {
      const l = armar(), imp = parseMonto(f.importe.value);
      $('[data-prev]', card).innerHTML = l.length && imp > 0 ? `<div class="ch-serie-prev"><table><tbody>${l.map((c) => `<tr><td class="ch-num">${c.numero}</td><td>${C.fecha(c.fecha_pago)}</td><td class="num">${C.money(c.importe)}</td></tr>`).join('')}</tbody><tfoot><tr><td>${l.length} cheques</td><td></td><td class="num">${C.money(imp * l.length)}</td></tr></tfoot></table></div>` : '';
    };
    f.addEventListener('input', prev);
    f.importe.onblur = () => { const n = parseMonto(f.importe.value); if (Number.isFinite(n)) f.importe.value = n.toLocaleString('es-AR', { minimumFractionDigits: 2 }); prev(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const l = armar();
      const p = !l.length ? 'Completá número, cantidad y fecha.' : !(l[0].importe > 0) ? 'Poné el importe de cada cheque.' : !l[0].beneficiario ? 'Poné a la orden de quién.' : !f.concepto.value.trim() ? 'Escribí el concepto.' : !l[0].cuenta_id ? 'Elegí la cuenta.' : null;
      if (p) { errorEn(card, new Error(p)); return; }
      const rep = l.filter((x) => cheques.some((c) => c.numero === x.numero && c.cuenta_id === x.cuenta_id)).map((x) => x.numero);
      if (rep.length) { errorEn(card, new Error(`Ya existen los cheques N.º ${rep.join(', ')}.`)); return; }
      const r = await C.sb.from('cheques').insert(l).select('id');
      if (r.error) { errorEn(card, r.error); return; }
      recargar(`${r.data.length} cheques cargados`);
    };
  }

  function formCobro(ch) {
    const h = hoy();
    const card = C.abrirModal(`${cab('Confirmar cobro del cheque N.º ' + ch.numero)}
      <p>${C.esc(ch.beneficiario ? ch.beneficiario + ': ' : '')}${C.esc(ch.concepto)}, <strong>${C.money(ch.importe)}</strong>.</p>
      <form class="form" novalidate>
        <label>Fecha en que se debitó<input type="date" name="fecha" value="${ch.fecha_pago && ch.fecha_pago <= h ? ch.fecha_pago : h}" required></label>
        <label class="check"><input type="checkbox" name="registrar" checked> Registrar el egreso en ${C.esc((C.cuentas.find((c) => c.id === ch.cuenta_id) || {}).nombre || 'el banco')}</label>
        <div class="dos" data-reg>
          <label>Categoría<select name="categoria_id">${opcionesCategorias(ch.categoria_id)}</select></label>
          <label>Centro de costo<select name="centro_id">${opcionesCentros(ch.centro_id)}</select></label>
        </div>
        <p class="muted" style="font-size:.85rem;margin:0">Destildá la opción si el pago ya está cargado como movimiento, así no se duplica.</p>
        <p class="error" role="alert" hidden></p>
        <div class="modal-pie"><div class="der"><button type="button" class="btn" data-no>Cancelar</button><button type="submit" class="btn primario">Confirmar cobro</button></div></div>
      </form>`);
    $('[data-cerrar]', card).onclick = C.cerrarModal; $('[data-no]', card).onclick = C.cerrarModal;
    const f = $('form', card);
    f.registrar.onchange = () => { $('[data-reg]', card).hidden = !f.registrar.checked; };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const reg = f.registrar.checked, cat = intOrNull(f.categoria_id.value);
      if (!f.fecha.value) { errorEn(card, new Error('Poné la fecha.')); return; }
      if (reg && !cat) { errorEn(card, new Error('Elegí la categoría del gasto.')); return; }
      const { error } = await C.sb.rpc('cobrar_cheque', { p_id: ch.id, p_fecha: f.fecha.value, p_registrar: reg, p_categoria: cat, p_centro: intOrNull(f.centro_id.value) });
      if (error) { errorEn(card, error); return; }
      if (C.invalidar) C.invalidar();
      recargar(reg ? 'Cheque cobrado y egreso registrado' : 'Cheque marcado como cobrado');
    };
  }

  function formAnular(ch) {
    const card = C.abrirModal(`${cab('Anular cheque N.º ' + ch.numero)}
      <p>${C.esc(ch.concepto)}${ch.importe ? ', ' + C.money(ch.importe) : ''}.</p>
      <form class="form" novalidate>
        <label>Motivo<textarea name="motivo" maxlength="300" required placeholder="Ej.: error de firma, reemplazado por el N.º 3011"></textarea></label>
        <p class="error" role="alert" hidden></p>
        <div class="modal-pie"><div class="der"><button type="button" class="btn" data-no>Cancelar</button><button type="submit" class="btn peligro">Anular cheque</button></div></div>
      </form>`);
    $('[data-cerrar]', card).onclick = C.cerrarModal; $('[data-no]', card).onclick = C.cerrarModal;
    const f = $('form', card);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const m = f.motivo.value.trim();
      if (!m) { errorEn(card, new Error('Escribí el motivo.')); return; }
      const r = await C.sb.from('cheques').update({ estado: 'anulado', motivo_anulacion: m }).eq('id', ch.id).select();
      if (r.error || !r.data.length) { errorEn(card, r.error || new Error('No tenés permiso para hacer esto.')); return; }
      recargar('Cheque anulado');
    };
  }

  function pdfPendientes() {
    if (!window.jspdf) { C.toast('No se pudo cargar el generador de PDF.', true); return; }
    const meta = C.metaPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const AZUL = [41, 67, 148], VERDE = [60, 127, 60], GRIS = [90, 104, 97], TINTA = [22, 33, 28], ROJO = [179, 38, 30];
    doc.setFillColor(...AZUL); doc.rect(0, 0, W, 3, 'F'); doc.setFillColor(...VERDE); doc.rect(W / 3, 0, W / 3, 3, 'F');
    let x = 14;
    if (meta.logo) { try { doc.addImage(meta.logo, 'PNG', 14, 6.5, 19, 11); x = 37; } catch (e) { } }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TINTA); doc.text(meta.club, x, 12);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS); doc.text(meta.ciudad, x, 16.5);
    doc.text(`Emitido el ${meta.emitido}`, W - 14, 12, { align: 'right' }); doc.text(`por ${meta.usuario}`, W - 14, 16.5, { align: 'right' });
    doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Cheques pendientes de pago', 14, 28);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...GRIS); doc.text(`Situación al ${C.fecha(hoy())}`, 14, 34);
    doc.setDrawColor(210, 220, 214); doc.line(14, 38, W - 14, 38);

    const h = hoy();
    const pend = cheques.filter((c) => c.estado === 'pendiente').sort((a, b) => (a.fecha_pago || '9') < (b.fecha_pago || '9') ? -1 : 1);
    const venc = pend.filter((c) => c.fecha_pago && c.fecha_pago < h), fut = pend.filter((c) => !c.fecha_pago || c.fecha_pago >= h);
    const money = (n) => C.money(n || 0);
    const body = [];
    if (venc.length) {
      body.push([{ content: 'Vencidos sin confirmar cobro', colSpan: 4, styles: { fontStyle: 'bold', textColor: ROJO } }]);
      venc.forEach((c) => body.push([String(c.numero), C.fecha(c.fecha_pago), (c.beneficiario ? c.beneficiario + ' - ' : '') + c.concepto, money(c.importe)]));
      body.push([{ content: 'Subtotal vencidos', colSpan: 3, styles: { fontStyle: 'bold' } }, { content: money(venc.reduce((s, c) => s + (c.importe || 0), 0)), styles: { fontStyle: 'bold' } }]);
    }
    let mesAct = null, subt = 0;
    const cerrarMes = () => { if (mesAct) body.push([{ content: `Subtotal ${mesAct}`, colSpan: 3, styles: { fontStyle: 'bold' } }, { content: money(subt), styles: { fontStyle: 'bold' } }]); };
    fut.forEach((c) => {
      const m = c.fecha_pago ? `${MESES_L[+c.fecha_pago.slice(5, 7) - 1]} ${c.fecha_pago.slice(0, 4)}` : 'Sin fecha';
      if (m !== mesAct) { cerrarMes(); mesAct = m; subt = 0; body.push([{ content: m.charAt(0).toUpperCase() + m.slice(1), colSpan: 4, styles: { fontStyle: 'bold', textColor: AZUL } }]); }
      subt += c.importe || 0;
      body.push([String(c.numero), c.fecha_pago ? C.fecha(c.fecha_pago) : '-', (c.beneficiario ? c.beneficiario + ' - ' : '') + c.concepto, money(c.importe)]);
    });
    cerrarMes();
    doc.autoTable({
      startY: 44, theme: 'plain', margin: { left: 14, right: 14 },
      head: [['N.º', 'Pago', 'Beneficiario y concepto', 'Importe']], body,
      foot: [['', '', `Total pendiente (${pend.length} cheques)`, money(pend.reduce((s, c) => s + (c.importe || 0), 0))]],
      styles: { font: 'helvetica', fontSize: 8.5, textColor: TINTA, cellPadding: 1.6, lineColor: [225, 231, 227], lineWidth: { bottom: 0.2 } },
      headStyles: { fontStyle: 'bold', textColor: GRIS, fillColor: [241, 245, 242] },
      footStyles: { fontStyle: 'bold', fillColor: [241, 245, 242] },
      columnStyles: { 0: { cellWidth: 16 }, 1: { cellWidth: 22 }, 3: { halign: 'right', cellWidth: 34 } },
      didParseCell: (d) => { if (d.column.index === 3 && d.section !== 'body') d.cell.styles.halign = 'right'; }
    });
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text(`${meta.club}, Tesorería`, 14, H - 8); doc.text(`Página ${i} de ${n}`, W - 14, H - 8, { align: 'right' }); }
    doc.save(`CDP_cheques_pendientes_${hoy()}.pdf`);
  }

  window.CDP_Cheques = { render };
})();
