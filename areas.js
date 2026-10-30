/* CDP Tesorería · Panel Por área · Versión: 2026-10-29 23:00 ARG */
(function () {
  'use strict';
  const CFG = window.CDP_CONFIG;
  const vista = document.getElementById('vista');
  if (!window.supabase || !CFG || !vista) return;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const cache = new Map();
  const COLORES = { FF: 'var(--field)', HC: '#7c5cff', SC: 'var(--verde)', GE: '#8a94a8', GG: '#8a94a8' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => window.Rep.money(n);

  const estilo = document.createElement('style');
  estilo.textContent = `
    .areas-panel{margin-top:1rem}
    .areas-panel h2{display:flex;justify-content:space-between;align-items:baseline;gap:1rem}
    .areas-panel h2 a{font-size:.82rem;font-weight:600}
    .areas{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.9rem}
    .area{position:relative;padding:.95rem 1rem 1rem 1.2rem;border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--surface) 92%,transparent)}
    .area::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:4px;border-radius:4px;background:var(--ac)}
    .area-nom{font-weight:750;font-size:.95rem;display:flex;justify-content:space-between;gap:.5rem}
    .area-nom span{font-size:.72rem;color:var(--ink-2);font-weight:600}
    .area-ing{font-size:1.35rem;font-weight:800;font-stretch:108%;color:var(--in);margin:.3rem 0 .1rem;white-space:nowrap}
    .area-sub{font-size:.78rem;color:var(--ink-2)}
    .area-fila{display:flex;justify-content:space-between;font-size:.84rem;margin-top:.45rem;padding-top:.45rem;border-top:1px dashed var(--line)}
    .area-fila+.area-fila{border-top:0;margin-top:.15rem;padding-top:0}
    .area-fila strong.neg{color:var(--out)}
  `;
  document.head.appendChild(estilo);

  async function datos(anio) {
    const c = cache.get(anio);
    if (c && Date.now() - c.t < 60000) return c.v;
    const [cu, ca, ce] = await Promise.all([sb.from('cuentas').select('*'), sb.from('categorias').select('*'), sb.from('centros').select('*').order('orden')]);
    for (const r of [cu, ca, ce]) if (r.error) throw r.error;
    const movs = [];
    for (let d = 0; ; d += 1000) {
      const { data, error } = await sb.from('v_movimientos').select('*').gte('fecha', anio + '-01-01').lte('fecha', anio + '-12-31').order('fecha').order('id').range(d, d + 999);
      if (error) throw error;
      movs.push(...data.map((m) => ({ ...m, monto: Number(m.monto) })));
      if (data.length < 1000) break;
    }
    const ctx = window.Rep.contexto(cu.data.map((x) => ({ ...x, saldo_inicial: Number(x.saldo_inicial) })), ca.data, ce.data);
    const v = { ctx, movs };
    cache.set(anio, { t: Date.now(), v });
    return v;
  }

  async function poner() {
    const h1 = vista.querySelector('.cabecera h1');
    if (!h1 || !/^Hola/.test(h1.textContent) || vista.querySelector('.areas-panel')) return;
    const ancla = vista.querySelector('.grilla-2');
    if (!ancla || !window.Rep) return;
    const sel = vista.querySelector('[data-anio]');
    const anio = sel ? Number(sel.value) : new Date().getFullYear();
    const sec = document.createElement('section');
    sec.className = 'panel areas-panel';
    sec.innerHTML = `<h2>Por área en ${anio}<a href="#reportes">Ver reporte por centro</a></h2><div class="cargando" style="padding:1rem">Calculando…</div>`;
    ancla.insertAdjacentElement('beforebegin', sec);
    try {
      const { ctx, movs } = await datos(anio);
      const r = window.Rep.porCentro(movs, ctx);
      const lista = r.centros.filter((c) => c.ingresos || c.egresos);
      sec.querySelector('.cargando').outerHTML = `<div class="areas">${lista.map((c) => {
        const cuotas = c.detalle.ingresos.filter((n) => /^cuota/i.test(n.cat.nombre)).reduce((s, n) => s + n.total, 0);
        return `<div class="area" style="--ac:${COLORES[c.centro.codigo] || '#e0a02a'}">
          <div class="area-nom">${esc(c.centro.nombre)} <span>${esc(c.centro.codigo)}</span></div>
          <div class="area-ing">${money(c.ingresos)}</div>
          <div class="area-sub">${cuotas ? 'De cuotas: ' + money(cuotas) : 'Ingresos del año'}</div>
          <div class="area-fila"><span>Egresos</span><strong>${money(c.egresos)}</strong></div>
          <div class="area-fila"><span>Resultado</span><strong class="${c.resultado < 0 ? 'neg' : ''}">${money(c.resultado)}</strong></div>
        </div>`;
      }).join('')}</div>`;
    } catch (e) {
      const x = sec.querySelector('.cargando');
      if (x) x.textContent = 'No se pudo calcular el resumen por área.';
      if (window.console) console.warn(e);
    }
  }

  new MutationObserver(() => { poner(); }).observe(vista, { childList: true });
  poner();
})();
