/* CDP Tesorería · Socios y cuotas · Versión: 2026-09-28 21:30 ARG */
(function () {
  'use strict';

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const TIPOS_BASE = [
    { tipo: 'Activo sin IC', cantidad: 0, valor: 45000, social: 18000 },
    { tipo: 'Activo con IC', cantidad: 0, valor: 58500, social: 18000 },
    { tipo: 'Colaborador', cantidad: 0, valor: 18000, social: 18000 },
    { tipo: 'Pasivo', cantidad: 0, valor: 18000, social: 18000 }
  ];
  let C = null, padron = [], cobrado = new Map();
  const hoyMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const st = { categoria: null, mes: hoyMes(), filas: null, sucio: false };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const puede = () => ['admin', 'tesorero'].includes(C.perfil.rol);
  const nombreMes = (m) => { const [y, mm] = m.split('-'); return `${MESES[+mm - 1]} ${y}`; };
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function parseMonto(txt) {
    let s = String(txt ?? '').replace(/[$\s]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    else if (/^\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });

  function estilos() {
    if ($('#pd-estilos')) return;
    const s = document.createElement('style');
    s.id = 'pd-estilos';
    s.textContent = `
      .pd-barra{display:flex;flex-wrap:wrap;gap:.75rem;align-items:end;margin-bottom:1rem}
      .pd-barra label{width:auto;min-width:200px}
      .pd-tipos{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:1rem;margin-bottom:1rem}
      .pd-tipo{position:relative;border-radius:16px;padding:1rem 1.1rem 1.05rem 1.3rem;background:color-mix(in srgb,var(--surface) 88%,transparent);border:1px solid var(--line);box-shadow:0 10px 30px -14px rgba(20,26,43,.18)}
      .pd-tipo::before{content:'';position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:4px;background:var(--pd-c,var(--field))}
      .pd-tipo input{min-height:34px;padding:.3rem .5rem;font-size:.9rem}
      .pd-tipo .pd-nombre{font-size:.8rem;font-weight:700;letter-spacing:.04em;color:var(--ink-2);border:0;background:transparent;padding:0;min-height:0;text-transform:uppercase}
      .pd-tipo .pd-cant{font-size:2rem;font-weight:800;font-stretch:112%;border:0;background:transparent;padding:0;min-height:0;width:100%;color:var(--ink)}
      .pd-tipo .pd-cant:focus,.pd-tipo .pd-nombre:focus{box-shadow:none;outline:2px dashed color-mix(in srgb,var(--field) 40%,transparent);outline-offset:2px}
      .pd-tipo .pd-dos{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin:.4rem 0 .5rem}
      .pd-tipo .pd-dos label{font-size:.72rem}
      .pd-tipo .pd-total{font-size:1.1rem;font-weight:750;color:var(--in)}
      .pd-tipo .pd-sub{font-size:.78rem;color:var(--ink-2)}
      .pd-tipo .pd-quitar{position:absolute;top:.5rem;right:.5rem;min-height:28px;padding:0 .45rem}
      .pd-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1rem}
      .pd-res div{padding:1rem 1.1rem;border-radius:14px;background:color-mix(in srgb,var(--surface) 88%,transparent);border:1px solid var(--line)}
      .pd-res span{display:block;font-size:.8rem;font-weight:650;color:var(--ink-2)}
      .pd-res strong{display:block;font-size:1.3rem;font-stretch:108%;margin-top:.15rem;white-space:nowrap}
      .pd-res small{color:var(--ink-2);font-size:.78rem}
      .pd-res .pd-social{border-left:4px solid var(--field)}
      .pd-res .pd-deport{border-left:4px solid var(--verde)}
      .pd-aviso{font-size:.85rem;color:var(--ink-2);margin:.25rem 0 1rem}
    `;
    document.head.appendChild(s);
  }

  async function cargar() {
    const p = await C.sb.from('cuotas_padron').select('*').order('periodo').order('orden');
    if (p.error) throw p.error;
    padron = p.data.map((x) => ({ ...x, cantidad: Number(x.cantidad), valor: Number(x.valor), social: Number(x.social) }));
    cobrado = new Map();
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await C.sb.from('movimientos').select('fecha,monto,categoria_id,tipo,anulado').eq('tipo', 'ingreso').eq('anulado', false).range(desde, desde + 999);
      if (error) throw error;
      for (const m of data) { const k = m.categoria_id + '|' + m.fecha.slice(0, 7); cobrado.set(k, (cobrado.get(k) || 0) + Number(m.monto)); }
      if (data.length < 1000) break;
    }
    if (window.Rep && window.Rep.setReparto) window.Rep.setReparto(padron);
  }

  const categoriasCuota = () => C.categorias.filter((c) => c.tipo === 'ingreso' && !c.padre_id && c.activa);

  function filasDelMes(cat, mes) {
    return padron.filter((x) => x.categoria_id === cat && String(x.periodo).slice(0, 7) === mes)
      .map((x) => ({ tipo: x.tipo, cantidad: x.cantidad, valor: x.valor, social: x.social }));
  }
  function mesAnteriorConDatos(cat, mes) {
    const meses = [...new Set(padron.filter((x) => x.categoria_id === cat).map((x) => String(x.periodo).slice(0, 7)))].filter((m) => m < mes).sort();
    return meses.length ? meses[meses.length - 1] : null;
  }
  const totales = (filas) => filas.reduce((t, f) => {
    t.socios += f.cantidad; t.total += f.cantidad * f.valor; t.social += f.cantidad * f.social; return t;
  }, { socios: 0, total: 0, social: 0 });

  async function render(ctx) {
    C = ctx;
    estilos();
    if (!st.categoria) {
      const fut = C.categorias.find((c) => c.codigo === 'ING_CUOTA_FUT') || categoriasCuota()[0];
      st.categoria = fut && fut.id;
    }
    C.vista.innerHTML = '<div class="cargando">Cargando…</div>';
    await cargar();
    st.filas = null;
    pintar();
  }

  function pintar() {
    const cat = st.categoria, mes = st.mes;
    if (!st.filas) {
      const propias = filasDelMes(cat, mes);
      st.filas = propias.length ? propias : [];
      st.origen = propias.length ? 'cargado' : 'vacio';
      st.sucio = false;
    }
    const f = st.filas, t = totales(f);
    const dep = t.total - t.social;
    const cob = cobrado.get(cat + '|' + mes) || 0;
    const ant = mesAnteriorConDatos(cat, mes);
    const historial = [...new Set(padron.filter((x) => x.categoria_id === cat).map((x) => String(x.periodo).slice(0, 7)))].sort().reverse();
    const colores = ['var(--field)', '#7c5cff', '#e0a02a', '#8a94a8', 'var(--verde)', '#d0508f'];
    const ed = puede();

    C.vista.innerHTML = `
      <div class="cabecera">
        <div><h1>Socios y cuotas</h1><p>Cargá cuántos socios pagan cada tipo de cuota por mes. Con eso, los reportes separan la cuota social de la deportiva.</p></div>
        <div class="acciones">${ed ? `${ant && st.origen !== 'cargado' ? `<button class="btn" data-copiar>Copiar de ${nombreMes(ant)}</button>` : ''}<button class="btn" data-agregar>Agregar tipo</button><button class="btn primario" data-guardar ${st.sucio ? '' : 'disabled'}>Guardar ${nombreMes(mes)}</button>` : ''}</div>
      </div>
      <div class="pd-barra">
        <label>Cuotas de<select data-cat>${categoriasCuota().map((c) => `<option value="${c.id}" ${c.id === cat ? 'selected' : ''}>${C.esc(c.nombre)}</option>`).join('')}</select></label>
        <label>Mes<input type="month" data-mes value="${mes}"></label>
      </div>
      ${!f.length ? `<div class="panel" style="margin-bottom:1rem"><p style="margin:0">No hay socios cargados para ${nombreMes(mes)}.${ed ? (ant ? ` Tocá <strong>Copiar de ${nombreMes(ant)}</strong> y actualizá las cantidades, o <strong>Agregar tipo</strong>.` : ' Tocá <strong>Agregar tipo</strong> o empezá con los tipos habituales.') : ''}</p>
        ${ed && !ant ? '<button class="btn" data-base style="margin-top:.75rem">Usar tipos habituales (Activo sin IC, Activo con IC, Colaborador, Pasivo)</button>' : ''}</div>` : ''}
      <div class="pd-tipos">${f.map((x, i) => `
        <div class="pd-tipo" style="--pd-c:${colores[i % colores.length]}">
          ${ed ? `<button class="btn texto pd-quitar" data-quitar="${i}" aria-label="Quitar tipo">×</button>` : ''}
          <input class="pd-nombre" data-i="${i}" data-k="tipo" value="${C.esc(x.tipo)}" ${ed ? '' : 'readonly'} aria-label="Tipo de socio">
          <input class="pd-cant" data-i="${i}" data-k="cantidad" inputmode="numeric" value="${x.cantidad}" ${ed ? '' : 'readonly'} aria-label="Cantidad">
          <div class="pd-dos">
            <label>Cuota c/u<input data-i="${i}" data-k="valor" inputmode="decimal" value="${fmt(x.valor)}" ${ed ? '' : 'readonly'}></label>
            <label>De eso, social<input data-i="${i}" data-k="social" inputmode="decimal" value="${fmt(x.social)}" ${ed ? '' : 'readonly'}></label>
          </div>
          <div class="pd-total">${C.money(x.cantidad * x.valor)}</div>
          <div class="pd-sub">Social ${C.money(x.cantidad * x.social)} · Deportiva ${C.money(x.cantidad * (x.valor - x.social))}</div>
        </div>`).join('')}
      </div>
      ${f.length ? `<section class="pd-res">
        <div><span>Socios</span><strong>${t.socios}</strong><small>${nombreMes(mes)}</small></div>
        <div><span>Recaudación esperada</span><strong>${C.money(t.total)}</strong><small>Cobrado en el mes: ${C.money(cob)}${cob ? ` (${cob >= t.total ? '+' : ''}${C.money(cob - t.total)})` : ''}</small></div>
        <div class="pd-social"><span>Cuota social</span><strong>${C.money(t.social)}</strong><small>${t.total ? (t.social / t.total * 100).toFixed(1) : 0} % del total</small></div>
        <div class="pd-deport"><span>Cuota deportiva</span><strong>${C.money(dep)}</strong><small>${t.total ? (dep / t.total * 100).toFixed(1) : 0} % del total</small></div>
      </section>` : ''}
      <p class="pd-aviso">Los reportes reparten lo cobrado en "${C.esc((C.categorias.find((c) => c.id === cat) || {}).nombre || '')}" con estos porcentajes. Si un mes no tiene socios cargados, usa el último mes cargado anterior.</p>
      ${historial.length ? `<section class="panel"><h2>Meses cargados</h2><div class="tabla-wrap"><table>
        <thead><tr><th>Mes</th><th class="num">Socios</th><th class="num">Esperado</th><th class="num">Social</th><th class="num">Deportiva</th><th class="num">Cobrado</th></tr></thead>
        <tbody>${historial.map((m) => { const tt = totales(filasDelMes(cat, m)); return `<tr class="clic" data-ir="${m}"><td>${cap(nombreMes(m))}</td><td class="num">${tt.socios}</td><td class="num">${C.money(tt.total)}</td><td class="num">${C.money(tt.social)}</td><td class="num">${C.money(tt.total - tt.social)}</td><td class="num">${C.money(cobrado.get(cat + '|' + m) || 0)}</td></tr>`; }).join('')}</tbody>
      </table></div></section>` : ''}`;

    $('[data-cat]', C.vista).onchange = (e) => { if (!confirmarSalida()) { e.target.value = st.categoria; return; } st.categoria = Number(e.target.value); st.filas = null; pintar(); };
    $('[data-mes]', C.vista).onchange = (e) => { if (!e.target.value) return; if (!confirmarSalida()) { e.target.value = st.mes; return; } st.mes = e.target.value; st.filas = null; pintar(); };
    $$('[data-ir]', C.vista).forEach((tr) => tr.onclick = () => { if (!confirmarSalida()) return; st.mes = tr.dataset.ir; st.filas = null; pintar(); window.scrollTo({ top: 0 }); });
    $$('.pd-tipo input', C.vista).forEach((inp) => {
      inp.onchange = () => {
        const i = +inp.dataset.i, k = inp.dataset.k;
        if (k === 'tipo') st.filas[i].tipo = inp.value.trim();
        else if (k === 'cantidad') st.filas[i].cantidad = Math.max(0, parseInt(inp.value, 10) || 0);
        else { const n = parseMonto(inp.value); if (Number.isFinite(n)) st.filas[i][k] = n; }
        if (st.filas[i].social > st.filas[i].valor) st.filas[i].social = st.filas[i].valor;
        st.sucio = true; pintar();
      };
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } };
    });
    const bq = $$('[data-quitar]', C.vista); bq.forEach((b) => b.onclick = () => { st.filas.splice(+b.dataset.quitar, 1); st.sucio = true; pintar(); });
    const ba = $('[data-agregar]', C.vista); if (ba) ba.onclick = () => { st.filas.push({ tipo: 'Nuevo tipo', cantidad: 0, valor: 0, social: 0 }); st.sucio = true; pintar(); };
    const bb = $('[data-base]', C.vista); if (bb) bb.onclick = () => { st.filas = TIPOS_BASE.map((x) => ({ ...x })); st.sucio = true; pintar(); };
    const bc = $('[data-copiar]', C.vista); if (bc) bc.onclick = () => { st.filas = filasDelMes(cat, ant); st.origen = 'copiado'; st.sucio = true; pintar(); C.toast(`Copiado de ${nombreMes(ant)}: actualizá las cantidades y guardá`); };
    const bg = $('[data-guardar]', C.vista); if (bg) bg.onclick = guardar;
  }

  function confirmarSalida() {
    return !st.sucio || window.confirm('Tenés cambios sin guardar en este mes. ¿Descartarlos?');
  }

  async function guardar() {
    const f = st.filas;
    const nombres = f.map((x) => x.tipo.trim().toLowerCase());
    if (nombres.some((n) => !n)) { C.toast('Todos los tipos tienen que tener nombre.', true); return; }
    if (new Set(nombres).size !== nombres.length) { C.toast('Hay dos tipos con el mismo nombre.', true); return; }
    const periodo = st.mes + '-01';
    const del = await C.sb.from('cuotas_padron').delete().eq('categoria_id', st.categoria).eq('periodo', periodo);
    if (del.error) { C.toast(C.errorTexto(del.error), true); return; }
    if (f.length) {
      const ins = await C.sb.from('cuotas_padron').insert(f.map((x, i) => ({
        periodo, categoria_id: st.categoria, tipo: x.tipo.trim(), orden: i, cantidad: x.cantidad, valor: x.valor, social: x.social
      }))).select('id');
      if (ins.error) { C.toast(C.errorTexto(ins.error), true); return; }
    }
    await cargar();
    st.filas = null;
    C.toast(`${cap(nombreMes(st.mes))} guardado`);
    pintar();
  }

  window.CDP_Padron = { render, cargarReparto: async (sb) => {
    const p = await sb.from('cuotas_padron').select('categoria_id,periodo,cantidad,valor,social');
    if (!p.error && window.Rep && window.Rep.setReparto) window.Rep.setReparto(p.data);
  } };
})();
