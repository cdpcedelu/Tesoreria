/* CDP Tesorería · Recibos · Versión: 2026-09-29 10:00 ARG */
(function () {
  'use strict';

  let C = null, recibos = [], proximo = 1;
  const st = { texto: '' };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const puede = () => ['admin', 'tesorero'].includes(C.perfil.rol);
  const nro = (n) => String(n).padStart(6, '0');
  const intOrNull = (v) => (v === '' || v == null ? null : Number(v));
  function parseMonto(txt) {
    let s = String(txt || '').replace(/[$\s]/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    else if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '');
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }

  const UNI = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
    'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const CEN = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  function menorMil(n) {
    if (n === 0) return '';
    if (n === 100) return 'cien';
    const c = Math.floor(n / 100), r = n % 100;
    let t = CEN[c];
    if (r) {
      const s = r < 30 ? UNI[r] : DEC[Math.floor(r / 10)] + (r % 10 ? ' y ' + UNI[r % 10] : '');
      t = (t ? t + ' ' : '') + s;
    }
    return t;
  }
  function enLetras(n) {
    n = Math.floor(n);
    if (n === 0) return 'cero';
    const partes = [];
    const millones = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), resto = n % 1000;
    const apocope = (t) => t.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
    if (millones) partes.push(millones === 1 ? 'un millón' : apocope(enLetras(millones)) + ' millones');
    if (miles) partes.push(miles === 1 ? 'mil' : apocope(menorMil(miles)) + ' mil');
    if (resto) partes.push(menorMil(resto));
    return partes.join(' ');
  }
  function importeEnLetras(x) {
    const ent = Math.floor(x + 1e-9), cent = Math.round((x - ent) * 100);
    const t = enLetras(ent);
    return `${t.charAt(0).toUpperCase() + t.slice(1)} con ${String(cent).padStart(2, '0')}/100`;
  }

  function estilos() {
    if ($('#rc-estilos')) return;
    const s = document.createElement('style');
    s.id = 'rc-estilos';
    s.textContent = `
      .rc-top{display:flex;flex-wrap:wrap;gap:1rem;align-items:end;justify-content:space-between;margin-bottom:1rem}
      .rc-prox{display:inline-flex;align-items:center;gap:.6rem;padding:.55rem .9rem;border-radius:12px;background:color-mix(in srgb,var(--field) 10%,transparent);color:var(--field);font-weight:700}
      .rc-prox strong{font-size:1.15rem;font-stretch:110%}
      .rc-acc{white-space:nowrap;text-align:right}
      .rc-acc .btn{min-height:32px;padding:0 .6rem;font-size:.85rem}
      .rc-num{font-weight:700;font-stretch:108%;white-space:nowrap}
      .rc-prev{border:1px dashed var(--line);border-radius:12px;padding:.9rem 1rem;background:var(--surface-2);font-size:.9rem;line-height:1.5}
      .rc-prev b{font-stretch:108%}
      .rc-seg{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);border-radius:12px;overflow:hidden}
      .rc-seg button{border:0;background:transparent;padding:.6rem;cursor:pointer;font-weight:600}
      .rc-seg button+button{border-left:1px solid var(--line)}
      .rc-seg button[aria-pressed=true][data-t=ingreso]{background:var(--in);color:#fff}
      .rc-seg button[aria-pressed=true][data-t=egreso]{background:var(--out);color:#fff}
    `;
    document.head.appendChild(s);
  }

  async function cargar() {
    const r = await C.sb.from('recibos').select('*').order('numero', { ascending: false });
    if (r.error) throw r.error;
    recibos = r.data.map((x) => ({ ...x, importe: Number(x.importe) }));
    const a = await C.sb.from('ajustes').select('valor').eq('clave', 'recibo_proximo').maybeSingle();
    const desdeTabla = recibos.length ? recibos[0].numero + 1 : 1;
    proximo = Math.max(a.data ? Number(a.data.valor) : 1, desdeTabla);
  }

  async function render(ctx) {
    C = ctx;
    estilos();
    C.vista.innerHTML = '<div class="cargando">Cargando…</div>';
    await cargar();
    pintar();
  }

  function pintar() {
    const t = st.texto.toLowerCase();
    const lista = recibos.filter((r) => !t || `${r.numero} ${r.persona} ${r.concepto} ${r.documento || ''}`.toLowerCase().includes(t));
    C.vista.innerHTML = `
      <div class="cabecera">
        <div><h1>Recibos</h1><p>Recibos numerados con el logo del club, listos para descargar o imprimir. Si querés, se anotan solos en la caja.</p></div>
        <div class="acciones">${puede() ? '<button class="btn primario" data-nuevo>Nuevo recibo</button>' : ''}</div>
      </div>
      <div class="rc-top">
        <div class="rc-prox">Próximo recibo <strong>N.º ${nro(proximo)}</strong>${C.perfil.rol === 'admin' ? ' <button class="btn texto" data-cambiar style="min-height:28px">Cambiar</button>' : ''}</div>
        <label style="max-width:360px;flex:1">Buscar<input type="search" data-buscar value="${C.esc(st.texto)}" placeholder="Número, nombre o concepto"></label>
      </div>
      ${lista.length ? `<div class="tabla-wrap"><table>
        <thead><tr><th>N.º</th><th>Fecha</th><th>Tipo</th><th>Nombre y concepto</th><th class="num">Importe</th><th>Caja</th><th></th></tr></thead>
        <tbody>${lista.map((r) => `<tr class="${r.anulado ? 'anulado' : ''}">
          <td class="rc-num">${nro(r.numero)}</td>
          <td>${C.fecha(r.fecha)}</td>
          <td>${r.tipo === 'ingreso' ? '<span class="etq ch-ok" style="color:var(--in)">Cobro</span>' : '<span class="etq" style="color:var(--out)">Pago</span>'}</td>
          <td>${C.esc(r.persona)}<span class="sub">${C.esc(r.concepto)}${r.anulado ? ' · Anulado: ' + C.esc(r.motivo_anulacion || '') : ''}</span></td>
          <td class="num">${C.money(r.importe)}</td>
          <td>${r.movimiento_id ? `<span class="etq">Mov. N.º ${r.movimiento_id}</span>` : '<span class="muted">-</span>'}</td>
          <td class="rc-acc acc"><button class="btn" data-pdf="${r.id}">PDF</button> <button class="btn" data-imprimir="${r.id}">Imprimir</button>${puede() && !r.anulado ? ` <button class="btn texto peligro" data-anular="${r.id}">Anular</button>` : ''}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<div class="panel"><div class="vacio">${recibos.length ? 'No hay recibos con esa búsqueda.' : 'Todavía no hay recibos.'}${puede() && !recibos.length ? ' <button class="btn" data-nuevo2>Hacer el primero</button>' : ''}</div></div>`}`;

    const bn = $('[data-nuevo]', C.vista); if (bn) bn.onclick = () => formRecibo();
    const bn2 = $('[data-nuevo2]', C.vista); if (bn2) bn2.onclick = () => formRecibo();
    const bc = $('[data-cambiar]', C.vista); if (bc) bc.onclick = cambiarNumero;
    let h; const bus = $('[data-buscar]', C.vista);
    bus.oninput = () => { clearTimeout(h); h = setTimeout(() => { st.texto = bus.value.trim(); const p = bus.selectionStart; pintar(); const n = $('[data-buscar]', C.vista); n.focus(); n.setSelectionRange(p, p); }, 250); };
    $$('[data-pdf]', C.vista).forEach((b) => b.onclick = () => pdf(recibos.find((r) => r.id === Number(b.dataset.pdf)), 'descargar'));
    $$('[data-imprimir]', C.vista).forEach((b) => b.onclick = () => pdf(recibos.find((r) => r.id === Number(b.dataset.imprimir)), 'imprimir'));
    $$('[data-anular]', C.vista).forEach((b) => b.onclick = () => anular(recibos.find((r) => r.id === Number(b.dataset.anular))));
  }

  function opcionesCategorias(tipo, sel) {
    let h = '<option value="">Elegí una categoría</option>';
    for (const r of C.categorias.filter((c) => c.tipo === tipo && !c.padre_id && c.activa)) {
      h += `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${C.esc(r.nombre)}</option>`;
      for (const x of C.categorias.filter((c) => c.padre_id === r.id && c.activa)) h += `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${C.esc(r.nombre)} / ${C.esc(x.nombre)}</option>`;
    }
    return h;
  }

  function formRecibo() {
    let tipo = 'ingreso';
    const efectivo = C.cuentas.find((c) => c.tipo === 'efectivo' && c.activa) || C.cuentas[0];
    const card = C.abrirModal(`<div class="modal-cab"><h2 id="modal-titulo">Nuevo recibo N.º ${nro(proximo)}</h2><button type="button" class="cerrar" data-cerrar aria-label="Cerrar">×</button></div>
      <form class="form" novalidate>
        <div class="rc-seg" role="group" aria-label="Tipo de recibo">
          <button type="button" data-t="ingreso" aria-pressed="true">Cobro (el club recibe)</button>
          <button type="button" data-t="egreso" aria-pressed="false">Pago (el club paga)</button>
        </div>
        <div class="dos">
          <label>Fecha<input type="date" name="fecha" value="${hoy()}" required></label>
          <label class="monto-grande">Importe<input name="importe" inputmode="decimal" placeholder="0,00" required autofocus></label>
        </div>
        <div class="dos">
          <label><span data-lbl>Recibimos de</span><input name="persona" maxlength="120" placeholder="Nombre y apellido o razón social" required></label>
          <label>DNI / CUIT (opcional)<input name="documento" maxlength="20"></label>
        </div>
        <label>En concepto de<input name="concepto" maxlength="200" placeholder="Ej.: Alquiler de quincho 12/10, cuota social septiembre" required></label>
        <label>Forma de pago<select name="forma_pago"><option>Efectivo</option><option>Transferencia</option><option>Cheque</option><option>Mercado Pago</option><option>Otro</option></select></label>
        <label class="check"><input type="checkbox" name="registrar" checked> Anotarlo también en la caja</label>
        <div class="dos" data-caja>
          <label>Cuenta<select name="cuenta">${C.cuentas.filter((c) => c.activa && c.tipo !== 'inversion').map((c) => `<option value="${c.id}" ${efectivo && c.id === efectivo.id ? 'selected' : ''}>${C.esc(c.nombre)}</option>`).join('')}</select></label>
          <label>Categoría<select name="categoria">${opcionesCategorias('ingreso', null)}</select></label>
          <label>Centro de costo<select name="centro"><option value="">Sin centro</option>${C.centros.filter((c) => c.activo).map((c) => `<option value="${c.id}">${C.esc(c.nombre)} (${C.esc(c.codigo)})</option>`).join('')}</select></label>
        </div>
        <div class="rc-prev" data-prev>Completá los datos para ver cómo queda.</div>
        <p class="error" role="alert" hidden></p>
        <div class="modal-pie"><div class="der"><button type="button" class="btn" data-no>Cancelar</button><button type="submit" class="btn primario">Emitir recibo</button></div></div>
      </form>`, { ancho: true });
    const f = $('form', card);
    $('[data-cerrar]', card).onclick = C.cerrarModal; $('[data-no]', card).onclick = C.cerrarModal;
    const prev = () => {
      const imp = parseMonto(f.importe.value);
      $('[data-prev]', card).innerHTML = imp > 0 && f.persona.value.trim()
        ? `${tipo === 'ingreso' ? 'Recibimos de' : 'Pagamos a'} <b>${C.esc(f.persona.value.trim())}</b>${f.documento.value.trim() ? ' (' + C.esc(f.documento.value.trim()) + ')' : ''} la suma de <b>pesos ${C.esc(importeEnLetras(imp).toLowerCase())}</b> (${C.money(imp)}) en concepto de <b>${C.esc(f.concepto.value.trim() || '...')}</b>. Forma de pago: ${C.esc(f.forma_pago.value)}.`
        : 'Completá los datos para ver cómo queda.';
    };
    $$('.rc-seg button', card).forEach((b) => b.onclick = () => {
      tipo = b.dataset.t;
      $$('.rc-seg button', card).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('[data-lbl]', card).textContent = tipo === 'ingreso' ? 'Recibimos de' : 'Pagamos a';
      f.categoria.innerHTML = opcionesCategorias(tipo, null);
      prev();
    });
    f.registrar.onchange = () => { $('[data-caja]', card).hidden = !f.registrar.checked; };
    f.addEventListener('input', prev);
    f.importe.onblur = () => { const n = parseMonto(f.importe.value); if (Number.isFinite(n)) f.importe.value = n.toLocaleString('es-AR', { minimumFractionDigits: 2 }); prev(); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const err = $('.error', card), imp = parseMonto(f.importe.value), reg = f.registrar.checked;
      const p = !f.fecha.value ? 'Poné la fecha.' : !(imp > 0) ? 'El importe tiene que ser mayor a cero.' : !f.persona.value.trim() ? 'Poné el nombre.' : !f.concepto.value.trim() ? 'Poné el concepto.' : reg && !f.categoria.value ? 'Para anotarlo en la caja elegí la categoría.' : null;
      if (p) { err.textContent = p; err.hidden = false; return; }
      const btn = $('button[type=submit]', card); btn.disabled = true;
      const { data, error } = await C.sb.rpc('emitir_recibo', {
        p_fecha: f.fecha.value, p_tipo: tipo, p_persona: f.persona.value.trim(), p_documento: f.documento.value.trim(),
        p_concepto: f.concepto.value.trim(), p_importe: imp, p_forma_pago: f.forma_pago.value, p_registrar: reg,
        p_cuenta: reg ? intOrNull(f.cuenta.value) : null, p_categoria: reg ? intOrNull(f.categoria.value) : null, p_centro: reg ? intOrNull(f.centro.value) : null
      });
      btn.disabled = false;
      if (error) { err.textContent = C.errorTexto(error); err.hidden = false; return; }
      const r = Array.isArray(data) ? data[0] : data;
      if (reg && C.invalidar) C.invalidar();
      C.cerrarModal();
      C.toast(`Recibo N.º ${nro(r.numero)} emitido${reg ? ' y anotado en la caja' : ''}`);
      await cargar(); pintar();
      pdf({ ...r, importe: Number(r.importe) }, 'descargar');
    };
  }

  async function cambiarNumero() {
    const v = window.prompt('¿Con qué número sigue la numeración de recibos? (no puede ser menor al último emitido)', String(proximo));
    if (v == null) return;
    const n = parseInt(v, 10);
    const ultimo = recibos.length ? recibos[0].numero : 0;
    if (!(n > ultimo)) { C.toast(`Tiene que ser mayor que ${ultimo}.`, true); return; }
    const r = await C.sb.from('ajustes').upsert({ clave: 'recibo_proximo', valor: String(n) }).select();
    if (r.error) { C.toast(C.errorTexto(r.error), true); return; }
    C.toast(`El próximo recibo será el N.º ${nro(n)}`);
    await cargar(); pintar();
  }

  function anular(r) {
    const card = C.abrirModal(`<div class="modal-cab"><h2 id="modal-titulo">Anular recibo N.º ${nro(r.numero)}</h2><button type="button" class="cerrar" data-cerrar aria-label="Cerrar">×</button></div>
      <p>${C.esc(r.persona)}, ${C.money(r.importe)}. El número queda usado y el recibo figura como anulado.${r.movimiento_id ? ' El movimiento de caja N.º ' + r.movimiento_id + ' hay que anularlo aparte en Movimientos.' : ''}</p>
      <form class="form" novalidate><label>Motivo<textarea name="motivo" maxlength="300" required></textarea></label>
      <p class="error" role="alert" hidden></p>
      <div class="modal-pie"><div class="der"><button type="button" class="btn" data-no>Cancelar</button><button type="submit" class="btn peligro">Anular recibo</button></div></div></form>`);
    $('[data-cerrar]', card).onclick = C.cerrarModal; $('[data-no]', card).onclick = C.cerrarModal;
    $('form', card).onsubmit = async (e) => {
      e.preventDefault();
      const m = e.target.motivo.value.trim(), err = $('.error', card);
      if (!m) { err.textContent = 'Escribí el motivo.'; err.hidden = false; return; }
      const x = await C.sb.from('recibos').update({ anulado: true, motivo_anulacion: m }).eq('id', r.id).select();
      if (x.error || !x.data.length) { err.textContent = x.error ? C.errorTexto(x.error) : 'No tenés permiso.'; err.hidden = false; return; }
      C.cerrarModal(); C.toast('Recibo anulado'); await cargar(); pintar();
    };
  }

  function pdf(r, modo) {
    if (!window.jspdf) { C.toast('No se pudo cargar el generador de PDF.', true); return; }
    const meta = C.metaPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const AZUL = [41, 67, 148], VERDE = [60, 127, 60], GRIS = [95, 105, 120], TINTA = [20, 26, 43], ROJO = [179, 38, 30];
    const bloque = (y0, copia) => {
      const x0 = 14, w = W - 28, h = 132;
      doc.setDrawColor(200, 206, 218); doc.setLineWidth(0.4); doc.roundedRect(x0, y0, w, h, 3, 3);
      doc.setFillColor(...AZUL); doc.rect(x0, y0, w / 3, 2.2, 'F'); doc.setFillColor(...VERDE); doc.rect(x0 + w / 3, y0, w / 3, 2.2, 'F'); doc.setFillColor(...AZUL); doc.rect(x0 + 2 * w / 3, y0, w / 3, 2.2, 'F');
      let xl = x0 + 6;
      if (meta.logo) { try { doc.addImage(meta.logo, 'PNG', x0 + 6, y0 + 7, 30, 17.4); xl = x0 + 40; } catch (e) { } }
      doc.setTextColor(...TINTA); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(meta.club, xl, y0 + 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS); doc.text(meta.ciudad, xl, y0 + 18.5);
      doc.setTextColor(...AZUL); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('RECIBO', x0 + w - 6, y0 + 13, { align: 'right' });
      doc.setFontSize(11); doc.setTextColor(...TINTA); doc.text(`N.º ${nro(r.numero)}`, x0 + w - 6, y0 + 19.5, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIS); doc.text(`Fecha: ${C.fecha(r.fecha)}`, x0 + w - 6, y0 + 25, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...(copia === 'ORIGINAL' ? AZUL : GRIS)); doc.text(copia, x0 + w - 6, y0 + 30, { align: 'right' });
      doc.setDrawColor(225, 229, 238); doc.line(x0 + 6, y0 + 33, x0 + w - 6, y0 + 33);

      let y = y0 + 43;
      const fila = (etq, valor, bold) => {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRIS); doc.text(etq, x0 + 8, y);
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(11); doc.setTextColor(...TINTA);
        const lines = doc.splitTextToSize(valor, w - 60);
        doc.text(lines, x0 + 48, y);
        doc.setDrawColor(210, 215, 226); doc.setLineDashPattern([0.6, 0.8], 0); doc.line(x0 + 48, y + 1.6 + (lines.length - 1) * 5, x0 + w - 8, y + 1.6 + (lines.length - 1) * 5); doc.setLineDashPattern([], 0);
        y += 9 + (lines.length - 1) * 5;
      };
      fila(r.tipo === 'ingreso' ? 'Recibimos de:' : 'Pagamos a:', r.persona + (r.documento ? `   (${r.documento})` : ''), true);
      fila('La suma de pesos:', importeEnLetras(r.importe));
      fila('En concepto de:', r.concepto);
      fila('Forma de pago:', r.forma_pago || '-');

      doc.setFillColor(238, 242, 250); doc.roundedRect(x0 + 8, y0 + h - 30, 70, 16, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIS); doc.text('IMPORTE', x0 + 12, y0 + h - 24.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...AZUL); doc.text(C.money(r.importe), x0 + 12, y0 + h - 17.5);
      doc.setDrawColor(...GRIS); doc.setLineWidth(0.3); doc.line(x0 + w - 78, y0 + h - 16, x0 + w - 8, y0 + h - 16);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
      doc.text(r.tipo === 'ingreso' ? 'Firma y aclaración por el club' : 'Firma y aclaración de quien recibe', x0 + w - 43, y0 + h - 11.5, { align: 'center' });
      if (r.anulado) {
        doc.setTextColor(...ROJO); doc.setFont('helvetica', 'bold'); doc.setFontSize(46);
        doc.text('ANULADO', W / 2, y0 + h / 2 + 8, { align: 'center', angle: 18 });
      }
    };
    bloque(10, 'ORIGINAL');
    doc.setDrawColor(190, 196, 208); doc.setLineDashPattern([2, 2], 0); doc.line(8, 148.5, W - 8, 148.5); doc.setLineDashPattern([], 0);
    doc.setFontSize(7); doc.setTextColor(150, 156, 170); doc.text('cortar por aquí', W / 2, 147, { align: 'center' });
    bloque(155, 'DUPLICADO');
    const nombre = `CDP_recibo_${nro(r.numero)}.pdf`;
    if (modo === 'imprimir') {
      doc.autoPrint();
      const url = doc.output('bloburl');
      const w = window.open(url, '_blank');
      if (!w) doc.save(nombre);
    } else doc.save(nombre);
  }

  window.CDP_Recibos = { render };
})();
