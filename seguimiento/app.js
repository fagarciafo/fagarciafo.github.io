'use strict';
/* Seguimiento familiar — aplicación local (sin servidor).
   Todos los datos se guardan SOLO en este dispositivo (localStorage). */
(function () {
  const KEY = 'seguimiento.datos.v1', DRAFT = 'seguimiento.borrador.v1';
  const app = document.getElementById('app');
  const titleEl = document.getElementById('title');
  const backBtn = document.getElementById('btnBack');

  /* ================= Utilidades ================= */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hoy = () => iso(new Date());
  const ahora = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const parseISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
  const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
  const fF = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return d + '/' + m + '/' + y; };
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fCorta = s => { const d = parseISO(s); return DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]; };
  const fLarga = s => { const d = parseISO(s); return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()] + ' ' + d.getDate() + ' de ' + ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][d.getMonth()] + ' de ' + d.getFullYear(); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setp = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
  const lista = a => (a && a.length ? a.join(', ') : '');
  const L = (...p) => p.filter(Boolean).join('\n');
  const contar = (arr) => { const m = new Map(); arr.forEach(v => { if (v) m.set(v, (m.get(v) || 0) + 1); }); return [...m].map(([t, n]) => ({ t, n })).sort((a, b) => b.n - a.n); };
  const prom = arr => { const v = arr.filter(n => typeof n === 'number' && !isNaN(n)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const r1 = n => Math.round(n * 10) / 10;
  const hm = h => { if (h == null) return '—'; const t = Math.round(h * 60); return Math.floor(t / 60) + ' h ' + pad(t % 60) + ' min'; };
  let toastT;
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

  /* ================= Catálogos ================= */
  const CAT = {
    lugares: ['Casa', 'Colegio', 'Centro de terapias', 'Calle / transporte', 'Tienda / centro comercial', 'Parque', 'Casa de familiares', 'Consultorio / EPS'],
    antecedentes: ['Le dije "no"', 'Le quité algo', 'Terminó una actividad que le gusta', 'Cambio de actividad / transición', 'Le pedí hacer una tarea', 'Cambio en la rutina', 'Tuvo que esperar', 'Ruido, luces o mucha gente', 'Estaba solo / sin atención', 'Cansancio o sueño', 'Hambre', 'Malestar o dolor', 'Persona o lugar nuevo', 'Sin causa aparente'],
    conductas: ['Llanto / rabieta', 'Gritos', 'Tirarse al piso', 'Golpear a otros', 'Morder', 'Pellizcar / arañar', 'Autolesión (golpearse, morderse)', 'Tirar objetos', 'Romper cosas', 'Huir / escaparse', 'Negarse / oponerse', 'Estereotipias intensas', 'Escupir', 'Quitarse la ropa'],
    duraciones: ['Menos de 1 min', '1 a 5 min', '5 a 15 min', '15 a 30 min', 'Más de 30 min'],
    funciones: [
      { v: 'Escapar o evitar algo', d: 'una tarea, un lugar, un ruido, una persona' },
      { v: 'Obtener atención', d: 'que lo miren, le hablen, lo carguen' },
      { v: 'Obtener algo', d: 'un objeto, comida, el celular, una actividad' },
      { v: 'Sensorial / autorregulación', d: 'la conducta en sí le da una sensación o lo calma' },
      { v: 'Expresar malestar físico', d: 'dolor, hambre, sueño, incomodidad' },
      { v: 'No estoy seguro', d: '' }
    ],
    emociones: ['Ansiedad', 'Rabia', 'Frustración', 'Tristeza', 'Culpa', 'Vergüenza', 'Miedo', 'Impotencia', 'Cansancio', 'Desesperación', 'Calma', 'Compasión'],
    sensaciones: ['Tensión muscular', 'Corazón acelerado', 'Calor en la cara', 'Nudo en el estómago', 'Nudo en la garganta', 'Respiración rápida', 'Dolor de cabeza', 'Ganas de llorar', 'Temblor', 'Agotamiento'],
    pensamientos: ['"Soy un mal padre / madre"', '"Esto no va a cambiar"', '"¿Qué van a pensar los demás?"', '"Ya no puedo más"', '"Lo hace a propósito"', '"Es mi culpa"', '"Tengo que hacer que pare ya"', 'Recuerdos de otras crisis', 'Preocupación por el futuro'],
    acciones: ['Le hablé con calma', 'Le anticipé / ofrecí opciones', 'Usé apoyo visual o gestos', 'Lo ignoré (sin peligro)', 'Le di un espacio seguro', 'Lo saqué del lugar', 'Lo contuve para protegerlo', 'Le di lo que quería', 'Le quité la tarea', 'Lo regañé / le grité', 'Me alejé para calmarme', 'Respiré antes de actuar', 'Pedí ayuda'],
    despues: ['Se calmó rápido', 'Se calmó después de un rato', 'Volvió a la actividad', 'La conducta aumentó', 'Se repitió más tarde', 'Consiguió lo que quería', 'Evitó la tarea', 'Yo me calmé', 'Me sentí peor', 'Otras personas intervinieron', 'Hubo una lesión'],
    suenoObs: ['Ronquidos', 'Pausas al respirar', 'Respira por la boca', 'Muy inquieto', 'Se despertó llorando', 'Sudoración', 'Durmió con los padres', 'Le costó dormirse', 'Despertó muy temprano'],
    comio: ['Comió bien', 'Comió poco', 'Rechazó la comida'],
    alimObs: ['Tos o atoro al comer', 'Probó un alimento nuevo', 'Solo aceptó lo de siempre', 'Necesitó ayuda para comer', 'Vómito', 'Estreñimiento'],
    medic: ['Tomó todo', 'Olvidó alguna dosis', 'No aplica'],
    tiposCita: ['Control médico', 'Examen o procedimiento', 'Valoración / evaluación', 'Trámite EPS', 'Colegio', 'Otro'],
    areas: ['Comunicación', 'Autonomía', 'Interacción social', 'Conducta y regulación', 'Alimentación', 'Sueño', 'Motricidad', 'Juego'],
    niveles: ['No lo logra todavía', 'Con ayuda total', 'Con ayuda parcial', 'Lo hace solo'],
    sugeridos: [
      ['Comunicación', 'Pide lo que quiere con gestos, señas o pictogramas'], ['Comunicación', 'Responde cuando lo llaman por su nombre'], ['Comunicación', 'Sigue una instrucción sencilla'],
      ['Conducta y regulación', 'Tolera esperar su turno (1 minuto)'], ['Conducta y regulación', 'Acepta un cambio de rutina si se le anticipa'], ['Conducta y regulación', 'Tolera el corte de pelo o de uñas'],
      ['Autonomía', 'Avisa o pide ir al baño'], ['Autonomía', 'Se pone una prenda con ayuda mínima'], ['Autonomía', 'Se lava las manos'],
      ['Alimentación', 'Acepta probar un alimento nuevo'], ['Alimentación', 'Come sentado en la mesa hasta terminar'],
      ['Sueño', 'Duerme en su cama toda la noche'], ['Interacción social', 'Comparte un juego con otra persona'], ['Juego', 'Juega de forma funcional con un juguete']
    ]
  };
  const CALMA = ['Se calmó rápido', 'Se calmó después de un rato', 'Volvió a la actividad'];
  const AUMENTO = ['La conducta aumentó', 'Se repitió más tarde', 'Hubo una lesión'];
  const REFUERZO = ['Consiguió lo que quería', 'Evitó la tarea'];

  const PAQ_ITEMS = [
    'Soy constante en la manera de educar a mis hijos',
    'Prefiero ceder en algo con mi hijo antes de que monte una escena en público',
    'Me molesto si las cosas no salen a mi manera cuando me relaciono con mi hijo',
    'Tengo claros mis valores relacionados con la forma de educar a mis hijos',
    'Si alguien me critica como padre/madre, debe ser que soy un mal padre/madre',
    'Siento que mi mente está en otro sitio cuando estoy jugando con mi hijo',
    'Cuando mi hijo se comporta mal, me siento atrapado en mis emociones en lugar de tratar su comportamiento',
    'Mis acciones como padre/madre son coherentes con mis valores',
    'Tengo pensamientos negativos sobre mí mismo cuando mi hijo se porta mal',
    'Es difícil iniciar o mantener una rutina porque no quiero enfrentarme a las reacciones de mi hijo',
    'Cuando mi manera de educar no funciona como esperaba me siento un fracasado',
    'Evito llevar a mi hijo a las tiendas por miedo a su comportamiento',
    'Soy capaz de sacrificar mi comodidad por una disciplina efectiva',
    'Soy un mal padre/madre cuando mi hijo se porta mal',
    'Suelo planificar mi día y pensar en las cosas que tengo que hacer mientras paso tiempo con mi hijo',
    'Tengo claros valores como padre/madre que guían mi interacción con mi hijo'
  ];
  const PAQ_INV = [1, 4, 8, 13, 16];
  const PAQ_INSTR = 'Lea cuidadosamente cada una de las siguientes afirmaciones. A continuación, elija la respuesta o la descripción que mejor describa sus pensamientos, sentimientos o estilo de interactuar con su hijo. Ninguna de las cosas que se dicen es verdadera ni falsa, sencillamente, usted estará más de acuerdo con unas cosas que con otras. Sus respuestas deben reflejar sus sentimientos y reacciones más consistentes que han estado presentes en los últimos meses.';
  const PAQ_ESC = ['Muy en desacuerdo / nunca', 'En desacuerdo / poco frecuente', 'De acuerdo / con frecuencia', 'Muy de acuerdo / siempre'];
  const paqPuntos = (i, v) => (PAQ_INV.includes(i + 1) ? 5 - v : v);
  const paqTotal = r => r.reduce((s, v, i) => s + (v ? paqPuntos(i, v) : 0), 0);
  function paqLectura(t) {
    if (t <= 29) return 'Puntaje igual o menor al promedio de padres y madres del estudio de validación español (29,1): indica un nivel de flexibilidad psicológica similar o mayor al habitual.';
    if (t <= 34) return 'Puntaje algo por encima del promedio de la validación española (29,1): hay algunas áreas de inflexibilidad que vale la pena trabajar.';
    return 'Puntaje más de una desviación estándar por encima del promedio de la validación española (29,1 ± 5,7): conviene revisarlo con el equipo de psicología familiar.';
  }

  /* ================= Estado ================= */
  function base() {
    return {
      v: 1,
      perfil: { nino: '', cuidadores: ['Papá', 'Mamá'], quien: 'Papá' },
      orden: { prestador: '', inicio: '', fin: '' },
      terapias: [
        { id: 'fono', nombre: 'Fonoaudiología', ordenadas: '' },
        { id: 'to', nombre: 'Terapia ocupacional', ordenadas: '' },
        { id: 'psi', nombre: 'Psicología individual', ordenadas: '' },
        { id: 'psifam', nombre: 'Psicología familiar', ordenadas: '' }
      ],
      conductas: [], diario: [], sesiones: [], citas: [], paq: [], objetivos: [],
      meta: { respaldo: null, creado: new Date().toISOString(), avisoInstalar: false }
    };
  }
  function load() {
    try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && j.v) { const b = base(); return Object.assign(b, j, { meta: Object.assign(b.meta, j.meta || {}), perfil: Object.assign(b.perfil, j.perfil || {}), orden: Object.assign(b.orden, j.orden || {}) }); } } catch (e) { /* datos dañados: se inicia vacío */ }
    return base();
  }
  let S = load();
  function save() {
    S.meta.modificado = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { alert('No se pudo guardar en el celular: ' + e.message); }
  }
  const nRegistros = () => S.conductas.length + S.diario.length + S.sesiones.length + S.citas.length + S.paq.length + S.objetivos.length;
  const terapia = id => S.terapias.find(t => t.id === id) || { nombre: 'Terapia' };
  const nino = () => S.perfil.nino || 'el niño';

  /* ================= Formularios ================= */
  let F = null, FK = null, HOOK = null, LAST = null;
  function draftSave() { if (FK === 'conducta') try { localStorage.setItem(DRAFT, JSON.stringify({ F, t: Date.now() })); } catch (e) { } }
  function draftGet() { try { const d = JSON.parse(localStorage.getItem(DRAFT)); return d && d.F ? d : null; } catch (e) { return null; } }
  function draftClear() { localStorage.removeItem(DRAFT); }

  const chips = (field, opts, cur, single = false) => `<div class="chips">${opts.map(o => {
    const v = typeof o === 'string' ? o : o.v, t = typeof o === 'string' ? esc(o) : `${esc(o.v)}${o.d ? `<br><small style="opacity:.75">${esc(o.d)}</small>` : ''}`;
    const on = single ? cur === v : (cur || []).includes(v);
    return `<button type="button" class="chip${on ? ' on' : ''}" data-chip="${field}" data-v="${esc(v)}"${single ? ' data-single' : ''}${typeof o === 'string' ? '' : ' style="text-align:left;border-radius:14px"'}>${t}</button>`;
  }).join('')}</div>`;
  const scale = (field, cur, n = 5, lo = '', hi = '') => `<div class="scale" data-scale="${field}">${Array.from({ length: n }, (_, i) => `<button type="button" data-v="${i + 1}" class="${cur == i + 1 ? 'on' : ''}">${i + 1}</button>`).join('')}</div>${lo || hi ? `<div class="scale-labels"><span>${lo}</span><span>${hi}</span></div>` : ''}`;
  const inp = (field, v, type = 'text', ph = '', extra = '') => `<input type="${type}" data-m="${field}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" ${extra}>`;
  const ta = (field, v, ph = '') => `<textarea data-m="${field}" placeholder="${esc(ph)}">${esc(v ?? '')}</textarea>`;
  const lab = (t, hint = '') => `<label class="f">${t}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const sec = (n, t) => `<div class="section-title"><span class="n">${n}</span>${t}</div>`;

  app.addEventListener('click', e => {
    const ch = e.target.closest('[data-chip]');
    if (ch && F) {
      const f = ch.dataset.chip, v = ch.dataset.v;
      if (ch.hasAttribute('data-single')) {
        const nv = get(F, f) === v ? '' : v; setp(F, f, nv);
        app.querySelectorAll(`[data-chip="${CSS.escape(f)}"]`).forEach(b => b.classList.toggle('on', b.dataset.v === nv));
      } else {
        const arr = (get(F, f) || []).slice(); const i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else arr.push(v);
        setp(F, f, arr); ch.classList.toggle('on', i < 0);
      }
      changed(); return;
    }
    const sc = e.target.closest('[data-scale] button');
    if (sc && F) {
      const box = sc.parentElement, f = box.dataset.scale, v = Number(sc.dataset.v);
      const nv = Number(get(F, f)) === v ? 0 : v; setp(F, f, nv);
      box.querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.v) === nv));
      changed(); return;
    }
    const act = e.target.closest('[data-act]');
    if (act) { const fn = ACT[act.dataset.act]; if (fn) { e.preventDefault(); fn(act, e); } return; }
    const go = e.target.closest('[data-go]');
    if (go) { location.hash = go.dataset.go; }
  });
  const onInput = e => {
    const el = e.target; if (!el.dataset || !el.dataset.m || !F) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = el.value === '' ? '' : Number(el.value);
    setp(F, el.dataset.m, v); changed();
  };
  app.addEventListener('input', onInput);
  app.addEventListener('change', onInput);
  function changed() { draftSave(); if (HOOK) HOOK(); }

  /* ================= Router ================= */
  const R = [];
  const ruta = (re, fn, tab, sub = false) => R.push({ re, fn, tab, sub });
  function render() {
    const h = location.hash.slice(1) || '/inicio';
    for (const r of R) {
      const m = h.match(r.re);
      if (m) {
        F = null; FK = null; HOOK = null;
        document.querySelectorAll('nav.bottom button').forEach(b => b.classList.toggle('on', b.dataset.tab === r.tab));
        backBtn.hidden = !r.sub;
        r.fn(m); window.scrollTo(0, 0); return;
      }
    }
    location.replace('#/inicio');
  }
  window.addEventListener('hashchange', render);
  document.getElementById('nav').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) location.hash = '#/' + b.dataset.tab; });
  backBtn.addEventListener('click', () => { if (history.length > 1) history.back(); else location.hash = '#/inicio'; });
  const titulo = t => { titleEl.textContent = t; document.title = t + ' · Seguimiento'; };
  const view = (t, html) => { titulo(t); app.innerHTML = html; };
  const volver = h => location.replace(h);

  /* ================= Análisis ================= */
  const enRango = (f, d, h) => (!d || f >= d) && (!h || f <= h);
  const momento = h => { const x = parseInt(String(h || '').slice(0, 2), 10); if (isNaN(x)) return ''; return x < 6 ? 'Madrugada (0–6 h)' : x < 12 ? 'Mañana (6–12 h)' : x < 18 ? 'Tarde (12–18 h)' : 'Noche (18–24 h)'; };
  const minutos = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
  function horasSueno(s) {
    if (!s) return null; const a = minutos(s.durmio || s.acosto), b = minutos(s.desperto);
    if (a == null || b == null) return null; let d = b - a; if (d <= 0) d += 1440; return d / 60;
  }
  const filtroQuien = (arr, q) => (!q || q === 'Todos' ? arr : arr.filter(x => (x.registra || '') === q));

  function analizarConductas(cs) {
    const total = cs.length;
    const dias = new Set(cs.map(c => c.fecha)).size;
    const acc = new Map();
    cs.forEach(c => (c.acciones || []).forEach(a => {
      const o = acc.get(a) || { t: a, n: 0, calma: 0, aumento: 0, refuerzo: 0 };
      o.n++; const d = c.despues || [];
      if (d.some(x => CALMA.includes(x))) o.calma++;
      if (d.some(x => AUMENTO.includes(x))) o.aumento++;
      if (d.some(x => REFUERZO.includes(x))) o.refuerzo++;
      acc.set(a, o);
    }));
    const ip = prom(cs.map(c => c.intensidad || null).filter(Boolean));
    return {
      total, dias, porDia: dias ? r1(total / dias) : 0, intProm: ip ? r1(ip) : null,
      tipos: contar(cs.flatMap(c => c.tipos || [])), funciones: contar(cs.flatMap(c => c.funciones || [])),
      antecedentes: contar(cs.flatMap(c => c.antecedentes || [])), momentos: contar(cs.map(c => momento(c.hora))),
      lugares: contar(cs.map(c => c.lugar)), duraciones: contar(cs.map(c => c.duracion)),
      emociones: contar(cs.flatMap(c => c.emociones || [])), sensaciones: contar(cs.flatMap(c => c.sensaciones || [])),
      pensamientos: contar(cs.flatMap(c => c.pensChips || [])), acciones: [...acc.values()].sort((a, b) => b.n - a.n)
    };
  }
  function analizarSueno(ds) {
    const con = ds.filter(d => d.sueno && (d.sueno.desperto || d.sueno.acosto || (d.sueno.obs || []).length)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const hs = con.map(d => horasSueno(d.sueno)).filter(h => h != null);
    const desp = con.map(d => d.sueno.despertares === '' || d.sueno.despertares == null ? null : Number(d.sueno.despertares)).filter(v => v != null && !isNaN(v));
    const ph = prom(hs);
    return {
      noches: con.length, promHoras: ph, promHorasTxt: hm(ph), promDesp: desp.length ? r1(prom(desp)) : '—',
      obs: contar(con.flatMap(d => d.sueno.obs || [])),
      filas: con.map(d => { const s = d.sueno; return [fF(d.fecha), s.acosto || '', s.durmio || '', s.desperto || '', horasSueno(s) != null ? hm(horasSueno(s)) : '', s.despertares === '' || s.despertares == null ? '' : String(s.despertares), lista(s.obs)]; })
    };
  }
  function resumen(desde, hasta, quien) {
    const cs = filtroQuien(S.conductas.filter(c => enRango(c.fecha, desde, hasta)), quien);
    const ds = filtroQuien(S.diario.filter(d => enRango(d.fecha, desde, hasta)), quien);
    const ses = S.sesiones.filter(s => enRango(s.fecha, desde, hasta));
    const alimDias = ds.filter(d => d.alim && (d.alim.como || (d.alim.obs || []).length));
    const an = prom(ds.map(d => d.animo || null).filter(Boolean));
    const enOrden = s => enRango(s.fecha, S.orden.inicio || null, S.orden.fin || null);
    return {
      nino: S.perfil.nino, desdeTxt: fF(desde), hastaTxt: fF(hasta), generadoTxt: fLarga(hoy()), quien: quien && quien !== 'Todos' ? quien : '',
      conductas: analizarConductas(cs), sueno: analizarSueno(ds),
      alim: { dias: alimDias.length, como: contar(alimDias.map(d => d.alim.como)), obs: contar(alimDias.flatMap(d => d.alim.obs || [])) },
      animoProm: an ? r1(an) : null,
      orden: Object.assign({}, S.orden, { inicioTxt: fF(S.orden.inicio), finTxt: fF(S.orden.fin) }),
      terapias: S.terapias.map(t => ({
        nombre: t.nombre, ordenadas: t.ordenadas ? String(t.ordenadas) : '',
        asistPeriodo: ses.filter(s => s.terapia === t.id && s.asistio !== 'no').length,
        faltasPeriodo: ses.filter(s => s.terapia === t.id && s.asistio === 'no').length,
        asistTotal: S.sesiones.filter(s => s.terapia === t.id && s.asistio !== 'no' && enOrden(s)).length
      })),
      tareas: ses.filter(s => s.tarea).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(s => ({ fecha: fF(s.fecha), terapia: terapia(s.terapia).nombre, tarea: s.tarea })),
      objetivos: S.objetivos.map(o => {
        const rs = (o.registros || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
        const f = r => (r ? `${CAT.niveles[r.nivel - 1]} (${fF(r.fecha)})` : '—');
        return { nombre: o.nombre, area: o.area || '', inicial: f(rs[0]), actual: f(rs[rs.length - 1]) };
      }),
      paq: S.paq.filter(p => enRango(p.fecha, desde, hasta)).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(p => ({ fecha: fF(p.fecha), quien: p.quien || '—', total: paqTotal(p.r) })),
      logros: ds.filter(d => d.logros).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(d => ({ fecha: fF(d.fecha), texto: d.logros })),
      citas: S.citas.filter(c => !c.hecho && c.fecha >= hoy()).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)).map(c => ({ fecha: fF(c.fecha), hora: c.hora, tipo: c.tipo, desc: c.desc }))
    };
  }

  /* ================= Gráficas ================= */
  function vbars(data, { h = 130, color = '#2f5fb3', fmt = v => v } = {}) {
    const bw = 30, W = Math.max(data.length * bw, 200), max = Math.max(1, ...data.map(d => d.v || 0));
    const bars = data.map((d, i) => {
      const bh = ((d.v || 0) / max) * (h - 38), x = i * bw + 5, y = h - 20 - bh;
      return `<rect x="${x}" y="${y}" width="${bw - 10}" height="${Math.max(bh, d.v ? 2 : 0)}" rx="4" fill="${color}" opacity="${d.v ? 1 : .15}"/>` +
        (d.v ? `<text x="${x + (bw - 10) / 2}" y="${y - 4}" font-size="10" text-anchor="middle" fill="#344054" font-weight="600">${fmt(d.v)}</text>` : '') +
        `<text x="${x + (bw - 10) / 2}" y="${h - 5}" font-size="9.5" text-anchor="middle" fill="#667085">${esc(d.lab)}</text>`;
    }).join('');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${h}" role="img">${(data.every(d => !d.v)) ? `<rect x="5" y="${h - 22}" width="${W - 10}" height="2" fill="#e3e8f2"/>` : ''}${bars}</svg></div>`;
  }
  function hbars(list, total, max = 8) {
    if (!list.length) return '<p class="muted small">Sin datos.</p>';
    const top = list.slice(0, max), m = Math.max(...top.map(x => x.n));
    return top.map(x => `<div style="margin:8px 0"><div class="row small"><span class="grow">${esc(x.t)}</span><b>${x.n}</b>${total ? `<span class="muted" style="width:44px;text-align:right">${Math.round(x.n * 100 / total)}%</span>` : ''}</div><div class="bar"><i style="width:${(x.n / m) * 100}%"></i></div></div>`).join('');
  }
  const ultimosDias = n => Array.from({ length: n }, (_, i) => addDays(hoy(), i - n + 1));

  /* ================= INICIO ================= */
  ruta(/^\/(inicio)?$/, vInicio, 'inicio');
  function vInicio() {
    const avisos = [];
    if (!S.perfil.nino) avisos.push(`<div class="notice info">Empieza en <b>Ajustes</b>: escribe el nombre del niño, quién usa este celular y las sesiones ordenadas de cada terapia. <a href="#/ajustes">Ir a Ajustes ›</a></div>`);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (!standalone && !S.meta.avisoInstalar) avisos.push(`<div class="notice info"><b>Instálala en tu pantalla de inicio</b> para usarla como app y proteger mejor los datos: ${ios ? 'en Safari toca <b>Compartir</b> → <b>Agregar a inicio</b>' : 'en el menú del navegador toca <b>Instalar app</b> o <b>Agregar a pantalla principal</b>'}. <a href="#" data-act="ocultar-instalar">Entendido</a></div>`);
    const dr = S.meta.respaldo ? diffDays(S.meta.respaldo.slice(0, 10), hoy()) : null;
    if (nRegistros() > 0 && (dr == null || dr >= 7)) avisos.push(`<div class="notice">${dr == null ? 'Aún no has hecho un respaldo.' : `Tu último respaldo fue hace ${dr} días.`} Los datos viven solo en este celular. <a href="#/respaldo">Hacer respaldo ›</a></div>`);
    if (S.orden.fin) {
      const dd = diffDays(hoy(), S.orden.fin);
      if (dd < 0) avisos.push(`<div class="notice">La orden de terapias venció el ${fF(S.orden.fin)}. Verifica la renovación con el médico tratante y la EPS.</div>`);
      else if (dd <= 30) avisos.push(`<div class="notice">La orden de terapias vence el <b>${fF(S.orden.fin)}</b> (en ${dd} días). Recuerda gestionar la renovación a tiempo.</div>`);
    }
    const prox = S.citas.filter(c => !c.hecho && c.fecha >= hoy() && diffDays(hoy(), c.fecha) <= 7).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    const venc = S.citas.filter(c => !c.hecho && c.fecha < hoy());
    if (prox.length) avisos.push(`<div class="notice info"><b>Próximos 7 días:</b><br>${prox.map(c => `${fCorta(c.fecha)}${c.hora ? ' ' + c.hora : ''} · ${esc(c.desc || c.tipo)}`).join('<br>')}</div>`);
    if (venc.length) avisos.push(`<div class="notice">${venc.length} pendiente(s) con fecha pasada sin marcar como hecho. <a href="#/terapias">Revisar ›</a></div>`);

    const d14 = ultimosDias(14);
    const c14 = S.conductas.filter(c => c.fecha >= d14[0]);
    const an = analizarConductas(c14);
    const s7 = analizarSueno(S.diario.filter(d => d.fecha >= addDays(hoy(), -6)));
    const ult = S.conductas.slice().sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)).slice(0, 3);
    const hora = new Date().getHours();
    view('Inicio', `
      <div class="card hero"><div class="small muted">${fLarga(hoy())}</div>
        <div style="font-size:21px;font-weight:750;margin-top:2px">${hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'}${S.perfil.quien ? ', ' + esc(S.perfil.quien) : ''}</div>
        <div class="small muted" style="margin-top:4px">Seguimiento de ${esc(nino())}</div></div>
      ${avisos.join('')}
      <div class="quick">
        <button class="main" data-go="#/conducta/nueva"><span>＋</span><div>Registrar una conducta<div class="small" style="opacity:.85;font-weight:500">Formato registro padres</div></div></button>
        <button data-go="#/dia/hoy"><span>🌙</span>Diario de hoy</button>
        <button data-go="#/sesion/nueva"><span>🗓️</span>Registrar sesión</button>
        <button data-go="#/paq"><span>📝</span>Cuestionario 6-PAQ</button>
        <button data-go="#/exportar"><span>📄</span>Exportar a Word</button>
      </div>
      <div class="card"><h2>Últimos 14 días</h2>
        <div class="grid3"><div class="stat"><b>${an.total}</b><small>conductas registradas</small></div>
          <div class="stat"><b>${an.intProm ?? '—'}</b><small>intensidad promedio /5</small></div>
          <div class="stat"><b>${s7.promHoras != null ? r1(s7.promHoras) : '—'}</b><small>horas de sueño (7 días)</small></div></div>
        <h3>Conductas por día</h3>
        ${vbars(d14.map(d => ({ lab: parseISO(d).getDate(), v: S.conductas.filter(c => c.fecha === d).length })))}
        ${an.funciones.length ? `<p class="small" style="margin:8px 0 0">Función más frecuente: <b>${esc(an.funciones[0].t)}</b> (${an.funciones[0].n} de ${an.total}).</p>` : ''}
      </div>
      ${tarjetaTerapias(true)}
      <div class="card"><div class="row"><h2 class="grow" style="margin:0">Últimos registros</h2><a href="#/conductas" class="small">Ver todos ›</a></div>
        ${ult.length ? ult.map(itemConducta).join('') : '<div class="empty">Todavía no hay registros. Usa el botón azul después de una situación difícil.</div>'}</div>`);
  }

  /* ================= CONDUCTAS ================= */
  let segConductas = 'lista', periodo = 30;
  ruta(/^\/conductas$/, vConductas, 'conductas');
  const resumenConducta = c => [lista(c.tipos), c.conducta].filter(Boolean).join(' · ') || 'Conducta sin describir';
  const itemConducta = c => `<div class="item" data-go="#/conducta/${c.id}"><div class="t">${esc(resumenConducta(c)).slice(0, 120)}</div>
    <div class="s">${fCorta(c.fecha)}${c.hora ? ' · ' + c.hora : ''}${c.lugar ? ' · ' + esc(c.lugar) : ''}${c.registra ? ' · ' + esc(c.registra) : ''}</div>
    <div>${(c.funciones || []).map(f => `<span class="tag">${esc(f)}</span>`).join('')}${c.intensidad ? `<span class="tag ${c.intensidad >= 4 ? 'bad' : c.intensidad >= 3 ? 'warn' : 'ok'}">Intensidad ${c.intensidad}/5</span>` : ''}</div></div>`;
  function vConductas() {
    const cs = S.conductas.slice().sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
    const seg = `<div class="seg"><button data-act="seg-c" data-v="lista" class="${segConductas === 'lista' ? 'on' : ''}">Registros</button><button data-act="seg-c" data-v="analisis" class="${segConductas === 'analisis' ? 'on' : ''}">Análisis</button></div>`;
    if (segConductas === 'lista') {
      let html = '', fecha = '';
      cs.forEach(c => { if (c.fecha !== fecha) { fecha = c.fecha; html += `<h3>${fLarga(c.fecha)}</h3>`; } html += itemConducta(c); });
      view('Registro de padres', seg + `
        <div class="grid2" style="margin-bottom:12px"><button class="btn" data-go="#/conducta/nueva">＋ Nuevo registro</button><button class="btn sec" data-go="#/exportar">📄 Exportar Word</button></div>
        <div class="card">${cs.length ? html : '<div class="empty">Sin registros todavía.<br>Cada registro llena una fila del <b>Formato registro padres</b>.</div>'}</div>`);
    } else {
      const desde = periodo ? addDays(hoy(), -periodo + 1) : null;
      const sel = cs.filter(c => !desde || c.fecha >= desde);
      const a = analizarConductas(sel);
      const per = `<div class="chips" style="margin-bottom:12px">${[[7, '7 días'], [30, '30 días'], [90, '90 días'], [0, 'Todo']].map(([v, t]) => `<button class="chip ${periodo === v ? 'on' : ''}" data-act="periodo" data-v="${v}">${t}</button>`).join('')}</div>`;
      view('Análisis de conductas', seg + per + (a.total ? `
        <div class="card"><div class="grid3"><div class="stat"><b>${a.total}</b><small>registros</small></div><div class="stat"><b>${a.porDia}</b><small>por día con registro</small></div><div class="stat"><b>${a.intProm ?? '—'}</b><small>intensidad /5</small></div></div></div>
        <div class="card"><h2>¿Para qué lo hace? (función)</h2>${hbars(a.funciones, a.total)}</div>
        <div class="card"><h2>¿Qué pasó antes?</h2>${hbars(a.antecedentes, a.total)}</div>
        <div class="card"><h2>Conductas más frecuentes</h2>${hbars(a.tipos, a.total)}</div>
        <div class="card"><h2>Momento del día</h2>${hbars(a.momentos, a.total)}<h3>Lugar</h3>${hbars(a.lugares, a.total)}</div>
        <div class="card"><h2>Lo que hicimos → qué pasó</h2><p class="small muted">Cuántas veces, después de cada respuesta, se calmó, aumentó o consiguió lo que buscaba. Lo que “refuerza” puede hacer que la conducta se repita.</p>
          ${a.acciones.length ? a.acciones.map(x => `<div class="item" style="cursor:default"><div class="t">${esc(x.t)} <span class="muted small">(${x.n})</span></div><div>${x.calma ? `<span class="tag ok">Se calmó ${x.calma}</span>` : ''}${x.aumento ? `<span class="tag bad">Aumentó ${x.aumento}</span>` : ''}${x.refuerzo ? `<span class="tag warn">Obtuvo lo que buscaba ${x.refuerzo}</span>` : ''}</div></div>`).join('') : '<p class="muted small">Sin datos.</p>'}</div>
        <div class="card"><h2>Lo que yo sentí y pensé</h2>${hbars(a.emociones, a.total)}<h3>Sensaciones físicas</h3>${hbars(a.sensaciones, a.total)}<h3>Pensamientos</h3>${hbars(a.pensamientos, a.total)}</div>`
        : '<div class="card empty">No hay registros en este periodo.</div>'));
    }
  }

  ruta(/^\/conducta\/nueva$/, () => formConducta(null), 'conductas', true);
  ruta(/^\/conducta\/([^/]+)\/editar$/, m => formConducta(m[1]), 'conductas', true);
  ruta(/^\/conducta\/([^/]+)$/, m => detalleConducta(m[1]), 'conductas', true);
  function nuevaConducta() {
    return { id: uid(), fecha: hoy(), hora: ahora(), registra: S.perfil.quien || '', lugar: '', antecedentes: [], situacion: '', tipos: [], conducta: '', intensidad: 0, duracion: '', funciones: [], funcion: '', emociones: [], intEmocion: 0, sensaciones: [], sentir: '', pensChips: [], pensamientos: '', acciones: [], accion: '', despues: [], consecuencia: '' };
  }
  function formConducta(id) {
    const ed = id ? S.conductas.find(c => c.id === id) : null;
    if (id && !ed) return volver('#/conductas');
    let aviso = '';
    if (ed) { F = clone(ed); FK = 'conducta-ed'; }
    else {
      const d = draftGet();
      if (d) { F = Object.assign(nuevaConducta(), d.F); aviso = `<div class="notice info">Se recuperó un registro que no alcanzaste a guardar. <a href="#" data-act="descartar-borrador">Empezar de cero</a></div>`; }
      else F = nuevaConducta();
      FK = 'conducta';
    }
    view(ed ? 'Editar registro' : 'Nuevo registro', `${aviso}
      <div class="card">
        <div class="grid2"><div>${lab('Fecha')}${inp('fecha', F.fecha, 'date')}</div><div>${lab('Hora')}${inp('hora', F.hora, 'time')}</div></div>
        ${lab('¿Quién registra?')}${chips('registra', S.perfil.cuidadores, F.registra, true)}
        ${lab('Lugar')}${chips('lugar', CAT.lugares, F.lugar, true)}

        ${sec(1, 'Situación · ¿Qué pasó antes?')}
        ${chips('antecedentes', CAT.antecedentes, F.antecedentes)}
        ${lab('Describe la situación', 'Dónde estaban, qué estaba haciendo, quién estaba, qué se le pidió.')}${ta('situacion', F.situacion, 'Ej.: Estábamos en la sala, le apagué el televisor para ir a bañarse…')}

        ${sec(2, 'Conducta inadecuada · ¿Qué hizo mi hijo?')}
        ${chips('tipos', CAT.conductas, F.tipos)}
        ${lab('Descríbela como si fuera una cámara', 'Lo que se vio y escuchó, sin interpretar.')}${ta('conducta', F.conducta, 'Ej.: Se tiró al piso, lloró y pateó la puerta…')}
        ${lab('Intensidad')}${scale('intensidad', F.intensidad, 5, 'Leve', 'Muy intensa')}
        ${lab('Duración')}${chips('duracion', CAT.duraciones, F.duracion, true)}

        ${sec(3, 'Función · ¿Para qué lo hizo?')}
        ${chips('funciones', CAT.funciones, F.funciones)}
        ${lab('¿Por qué crees que fue eso?')}${ta('funcion', F.funcion, 'Ej.: Quería seguir viendo televisión y evitar el baño.')}

        ${sec(4, '¿Qué sentí? · Emociones y sensaciones físicas')}
        ${chips('emociones', CAT.emociones, F.emociones)}
        ${lab('¿Qué tan intensa fue mi emoción?')}${scale('intEmocion', F.intEmocion, 5, 'Poco', 'Muchísimo')}
        ${lab('Sensaciones en el cuerpo')}${chips('sensaciones', CAT.sensaciones, F.sensaciones)}
        ${lab('Algo más sobre lo que sentí')}${ta('sentir', F.sentir, '')}

        ${sec(5, '¿Qué pensé? · Imágenes, recuerdos…')}
        ${chips('pensChips', CAT.pensamientos, F.pensChips)}
        ${lab('Con mis propias palabras')}${ta('pensamientos', F.pensamientos, 'Ej.: Pensé que los vecinos iban a creer que lo maltratamos…')}

        ${sec(6, '¿Qué hice o dejé de hacer?')}
        ${chips('acciones', CAT.acciones, F.acciones)}
        ${lab('Detalle')}${ta('accion', F.accion, '')}

        ${sec(7, '¿Qué ocurrió después?')}
        <p class="small muted" style="margin:6px 0 8px">Reacciones del entorno o de mi hijo, cambios en mis sensaciones, etc.</p>
        ${chips('despues', CAT.despues, F.despues)}
        ${lab('Detalle')}${ta('consecuencia', F.consecuencia, '')}
      </div>
      <div class="sticky-actions"><button class="btn" data-act="guardar-conducta">Guardar registro</button></div>`);
  }
  function detalleConducta(id) {
    const c = S.conductas.find(x => x.id === id); if (!c) return volver('#/conductas');
    const col = columnas(c);
    const nombres = ['Fecha', 'Situación · ¿Qué pasó antes?', 'Conducta · ¿Qué hizo mi hijo?', 'Función · ¿Para qué lo hizo?', '¿Qué sentí?', '¿Qué pensé?', '¿Qué hice o dejé de hacer?', '¿Qué ocurrió después?'];
    view('Registro', `<div class="card detail">${nombres.map((n, i) => `<div class="lbl">${n}</div><p>${esc(col[i]) || '<span class="muted">—</span>'}</p>`).join('')}</div>
      <div class="grid2"><button class="btn sec" data-go="#/conducta/${c.id}/editar">Editar</button><button class="btn danger" data-act="borrar" data-col="conductas" data-id="${c.id}" data-ret="#/conductas">Eliminar</button></div>`);
  }
  function columnas(c) {
    const emo = lista(c.emociones);
    return [
      L(fF(c.fecha).slice(0, 5), c.fecha.slice(0, 4), c.hora, c.registra ? `(${c.registra})` : ''),
      L(c.lugar ? 'Lugar: ' + c.lugar : '', lista(c.antecedentes), c.situacion),
      L(lista(c.tipos), c.conducta, [c.intensidad ? `Intensidad ${c.intensidad}/5` : '', c.duracion ? 'Duración: ' + c.duracion : ''].filter(Boolean).join(' · ')),
      L(lista(c.funciones), c.funcion),
      L(emo ? emo + (c.intEmocion ? ` (intensidad ${c.intEmocion}/5)` : '') : (c.intEmocion ? `Intensidad ${c.intEmocion}/5` : ''), (c.sensaciones || []).length ? 'En el cuerpo: ' + lista(c.sensaciones) : '', c.sentir),
      L(lista(c.pensChips), c.pensamientos),
      L(lista(c.acciones), c.accion),
      L(lista(c.despues), c.consecuencia)
    ];
  }

  /* ================= DIARIO ================= */
  ruta(/^\/diario$/, vDiario, 'diario');
  ruta(/^\/dia\/hoy$/, () => { const e = S.diario.find(d => d.fecha === hoy() && (d.registra || '') === (S.perfil.quien || '')); volver(e ? '#/dia/' + e.id : '#/dia/nuevo'); }, 'diario', true);
  ruta(/^\/dia\/nuevo$/, () => formDia(null), 'diario', true);
  ruta(/^\/dia\/([^/]+)$/, m => formDia(m[1]), 'diario', true);
  function vDiario() {
    const ds = S.diario.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const d14 = ultimosDias(14);
    const s = analizarSueno(S.diario.filter(d => d.fecha >= d14[0]));
    const horasDia = d => { const e = S.diario.filter(x => x.fecha === d).map(x => horasSueno(x.sueno)).filter(h => h != null); return e.length ? r1(prom(e)) : 0; };
    view('Diario', `
      <button class="btn block" data-go="#/dia/hoy" style="margin-bottom:12px">🌙 Diario de hoy</button>
      <div class="card"><h2>Sueño · últimos 14 días</h2>
        <div class="grid3"><div class="stat"><b>${s.promHoras != null ? r1(s.promHoras) : '—'}</b><small>horas promedio</small></div><div class="stat"><b>${s.promDesp}</b><small>despertares / noche</small></div><div class="stat"><b>${s.noches}</b><small>noches registradas</small></div></div>
        <h3>Horas dormidas por noche</h3>${vbars(d14.map(d => ({ lab: parseISO(d).getDate(), v: horasDia(d) })), { color: '#5b6bd6' })}
        ${s.obs.length ? `<h3>Observaciones nocturnas</h3><div>${s.obs.map(o => `<span class="tag ${/Pausas|Ronquidos/.test(o.t) ? 'warn' : ''}">${esc(o.t)} · ${o.n}</span>`).join('')}</div>` : ''}
        <p class="small muted" style="margin-bottom:0">Útil para llevar a la cita de sueño o neuropediatría: el informe en Word incluye la tabla noche por noche.</p></div>
      <div class="card"><h2>Días registrados</h2>${ds.length ? ds.map(d => {
        const h = horasSueno(d.sueno);
        return `<div class="item" data-go="#/dia/${d.id}"><div class="t">${fLarga(d.fecha)}</div><div class="s">${[h != null ? '😴 ' + hm(h) : '', d.sueno && d.sueno.despertares !== '' && d.sueno.despertares != null ? d.sueno.despertares + ' despertares' : '', d.alim && d.alim.como ? '🍽️ ' + d.alim.como : '', d.animo ? 'Día ' + d.animo + '/5' : '', d.registra || ''].filter(Boolean).join(' · ')}</div>${d.logros ? `<div class="small" style="margin-top:3px">⭐ ${esc(d.logros).slice(0, 100)}</div>` : ''}</div>`;
      }).join('') : '<div class="empty">Sin días registrados.</div>'}</div>`);
  }
  function formDia(id) {
    const ed = id ? S.diario.find(d => d.id === id) : null;
    if (id && !ed) return volver('#/diario');
    F = ed ? clone(ed) : { id: uid(), fecha: hoy(), registra: S.perfil.quien || '', sueno: { acosto: '', durmio: '', desperto: '', despertares: '', siestaMin: '', calidad: 0, obs: [] }, alim: { como: '', obs: [], nota: '' }, animo: 0, medic: '', logros: '', notas: '' };
    FK = 'dia';
    HOOK = () => { const h = horasSueno(F.sueno); const el = document.getElementById('hsueno'); if (el) el.textContent = h != null ? 'Durmió aproximadamente ' + hm(h) : ''; };
    view(ed ? 'Editar día' : 'Diario del día', `
      <div class="card">
        <div class="grid2"><div>${lab('Fecha')}${inp('fecha', F.fecha, 'date')}</div><div>${lab('Registra')}${chips('registra', S.perfil.cuidadores, F.registra, true)}</div></div>
        ${sec('🌙', 'Sueño de anoche')}
        <div class="grid3"><div>${lab('Se acostó')}${inp('sueno.acosto', F.sueno.acosto, 'time')}</div><div>${lab('Se durmió')}${inp('sueno.durmio', F.sueno.durmio, 'time')}</div><div>${lab('Despertó')}${inp('sueno.desperto', F.sueno.desperto, 'time')}</div></div>
        <p class="small" id="hsueno" style="color:var(--pri);font-weight:650;margin:8px 0 0"></p>
        <div class="grid2"><div>${lab('Despertares en la noche')}${inp('sueno.despertares', F.sueno.despertares, 'number', '0', 'min="0" inputmode="numeric"')}</div><div>${lab('Siesta (minutos)')}${inp('sueno.siestaMin', F.sueno.siestaMin, 'number', '0', 'min="0" inputmode="numeric"')}</div></div>
        ${lab('Calidad del sueño')}${scale('sueno.calidad', F.sueno.calidad, 5, 'Muy mala', 'Muy buena')}
        ${lab('Observaciones de la noche')}${chips('sueno.obs', CAT.suenoObs, F.sueno.obs)}
        ${sec('🍽️', 'Alimentación')}
        ${chips('alim.como', CAT.comio, F.alim.como, true)}
        <div style="margin-top:10px">${chips('alim.obs', CAT.alimObs, F.alim.obs)}</div>
        ${lab('Notas de alimentación')}${inp('alim.nota', F.alim.nota, 'text', 'Qué comió, qué rechazó…')}
        ${sec('☀️', 'El día')}
        ${lab('¿Cómo estuvo su regulación / ánimo en general?')}${scale('animo', F.animo, 5, 'Muy difícil', 'Muy bueno')}
        ${lab('Medicamentos')}${chips('medic', CAT.medic, F.medic, true)}
        ${lab('⭐ Logros y momentos buenos del día', 'Algo nuevo que hizo, un momento de conexión, algo que salió bien.')}${ta('logros', F.logros, '')}
        ${lab('Otras notas')}${ta('notas', F.notas, '')}
      </div>
      <div class="sticky-actions"><button class="btn" data-act="guardar-dia">Guardar día</button>${ed ? `<button class="btn danger" style="flex:0 0 auto" data-act="borrar" data-col="diario" data-id="${ed.id}" data-ret="#/diario">Eliminar</button>` : ''}</div>`);
    HOOK();
  }

  /* ================= TERAPIAS ================= */
  function tarjetaTerapias(compacta) {
    const enOrden = s => enRango(s.fecha, S.orden.inicio || null, S.orden.fin || null);
    const filas = S.terapias.map(t => {
      const as = S.sesiones.filter(s => s.terapia === t.id && s.asistio !== 'no' && enOrden(s)).length;
      const fa = S.sesiones.filter(s => s.terapia === t.id && s.asistio === 'no' && enOrden(s)).length;
      const ord = Number(t.ordenadas) || 0;
      return `<div style="margin:12px 0"><div class="row small"><b class="grow">${esc(t.nombre)}</b><span>${as}${ord ? ' de ' + ord : ''} asistidas${fa ? ` · <span style="color:var(--bad)">${fa} falta${fa === 1 ? '' : 's'}</span>` : ''}</span></div>${ord ? `<div class="bar" style="margin-top:5px"><i style="width:${Math.min(100, as * 100 / ord)}%"></i></div>` : ''}</div>`;
    }).join('');
    let vig = '';
    if (S.orden.inicio || S.orden.fin) {
      const dd = S.orden.fin ? diffDays(hoy(), S.orden.fin) : null;
      vig = `<p class="small muted" style="margin:0">${S.orden.prestador ? esc(S.orden.prestador) + ' · ' : ''}Orden ${S.orden.inicio ? 'del ' + fF(S.orden.inicio) : ''} ${S.orden.fin ? 'al ' + fF(S.orden.fin) : ''}${dd != null ? (dd >= 0 ? ` · quedan ${dd} días` : ' · <b style="color:var(--bad)">vencida</b>') : ''}</p>`;
    }
    return `<div class="card"><div class="row"><h2 class="grow" style="margin:0">Terapias</h2>${compacta ? '<a href="#/terapias" class="small">Ver ›</a>' : '<a href="#/ajustes" class="small">Configurar ›</a>'}</div>${vig}${filas}</div>`;
  }
  ruta(/^\/terapias$/, vTerapias, 'terapias');
  function vTerapias() {
    const ses = S.sesiones.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 30);
    const pend = S.citas.filter(c => !c.hecho).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
    const hechas = S.citas.filter(c => c.hecho).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
    const itemCita = c => `<div class="item row"><button class="chip ${c.hecho ? 'on' : ''}" style="padding:6px 10px" data-act="cita-hecho" data-id="${c.id}" aria-label="Marcar como hecho">${c.hecho ? '✓' : '○'}</button><div class="grow" data-go="#/cita/${c.id}"><div class="t">${esc(c.desc || c.tipo || 'Pendiente')}</div><div class="s">${c.fecha ? fCorta(c.fecha) : 'Sin fecha'}${c.hora ? ' · ' + c.hora : ''}${c.tipo ? ' · ' + esc(c.tipo) : ''}${c.lugar ? ' · ' + esc(c.lugar) : ''}${!c.hecho && c.fecha && c.fecha < hoy() ? ' · <b style="color:var(--bad)">fecha pasada</b>' : ''}</div></div></div>`;
    view('Terapias y citas', `
      <div class="grid2" style="margin-bottom:12px"><button class="btn" data-go="#/sesion/nueva">＋ Sesión</button><button class="btn sec" data-go="#/cita/nueva">＋ Cita o pendiente</button></div>
      ${tarjetaTerapias(false)}
      <div class="card"><h2>Citas y pendientes</h2>${pend.length ? pend.map(itemCita).join('') : '<p class="muted small">Nada pendiente. Agrega controles médicos, exámenes (p. ej. polisomnografía, audiometría), renovación de órdenes o trámites con la EPS.</p>'}
        ${hechas.length ? `<details style="margin-top:8px"><summary class="small muted">Hechas recientemente (${hechas.length})</summary>${hechas.map(itemCita).join('')}</details>` : ''}</div>
      <div class="card"><h2>Sesiones recientes</h2>${ses.length ? ses.map(s => `<div class="item" data-go="#/sesion/${s.id}"><div class="t">${esc(terapia(s.terapia).nombre)} ${s.asistio === 'no' ? '<span class="tag bad">No asistió</span>' : ''}</div><div class="s">${fCorta(s.fecha)}${s.trabajaron ? ' · ' + esc(s.trabajaron).slice(0, 80) : ''}</div>${s.tarea ? `<div class="small" style="margin-top:3px">🏠 ${esc(s.tarea).slice(0, 100)}</div>` : ''}</div>`).join('') : '<div class="empty">Sin sesiones registradas.</div>'}</div>`);
  }
  ruta(/^\/sesion\/nueva$/, () => formSesion(null), 'terapias', true);
  ruta(/^\/sesion\/([^/]+)$/, m => formSesion(m[1]), 'terapias', true);
  function formSesion(id) {
    const ed = id ? S.sesiones.find(s => s.id === id) : null;
    if (id && !ed) return volver('#/terapias');
    F = ed ? Object.assign(clone(ed), { terapias: [ed.terapia] }) : { id: uid(), fecha: hoy(), terapias: [], asistio: 'si', motivo: '', trabajaron: '', tarea: '', obs: '', como: 0 };
    FK = 'sesion';
    HOOK = () => { const m = document.getElementById('motivo'); if (m) m.hidden = F.asistio !== 'no'; };
    const opts = S.terapias.map(t => ({ v: t.id, t: t.nombre }));
    view(ed ? 'Editar sesión' : 'Registrar sesión', `
      <div class="card">
        ${lab('Fecha')}${inp('fecha', F.fecha, 'date')}
        ${lab(ed ? 'Terapia' : 'Terapia(s)', ed ? '' : 'Puedes marcar varias si fueron el mismo día.')}
        <div class="chips">${opts.map(o => `<button type="button" class="chip ${F.terapias.includes(o.v) ? 'on' : ''}" data-chip="terapias" data-v="${esc(o.v)}">${esc(o.t)}</button>`).join('')}</div>
        ${lab('¿Asistió?')}${chips('asistio', [{ v: 'si', d: '' }, { v: 'no', d: '' }].map(o => o.v), F.asistio, true).replace('>si<', '>Sí asistió<').replace('>no<', '>No asistió<')}
        <div id="motivo">${lab('Motivo de la falta')}${inp('motivo', F.motivo, 'text', 'Enfermedad, cancelación del centro, transporte…')}</div>
        ${lab('¿Qué trabajaron?')}${ta('trabajaron', F.trabajaron, 'Objetivos o actividades de la sesión')}
        ${lab('🏠 Tarea o recomendación para la casa')}${ta('tarea', F.tarea, '')}
        ${lab('Observaciones del terapeuta')}${ta('obs', F.obs, '')}
        ${lab('¿Cómo le fue en la sesión?')}${scale('como', F.como, 5, 'Difícil', 'Muy bien')}
      </div>
      <div class="sticky-actions"><button class="btn" data-act="guardar-sesion">Guardar</button>${ed ? `<button class="btn danger" style="flex:0 0 auto" data-act="borrar" data-col="sesiones" data-id="${ed.id}" data-ret="#/terapias">Eliminar</button>` : ''}</div>`);
    HOOK();
  }
  ruta(/^\/cita\/nueva$/, () => formCita(null), 'terapias', true);
  ruta(/^\/cita\/([^/]+)$/, m => formCita(m[1]), 'terapias', true);
  function formCita(id) {
    const ed = id ? S.citas.find(c => c.id === id) : null;
    if (id && !ed) return volver('#/terapias');
    F = ed ? clone(ed) : { id: uid(), fecha: hoy(), hora: '', tipo: '', desc: '', lugar: '', notas: '', hecho: false };
    FK = 'cita';
    view(ed ? 'Editar cita' : 'Nueva cita o pendiente', `
      <div class="card">
        ${lab('¿Qué es?')}${inp('desc', F.desc, 'text', 'Ej.: Control neuropediatría, renovar orden de terapias…')}
        ${lab('Tipo')}${chips('tipo', CAT.tiposCita, F.tipo, true)}
        <div class="grid2"><div>${lab('Fecha')}${inp('fecha', F.fecha, 'date')}</div><div>${lab('Hora')}${inp('hora', F.hora, 'time')}</div></div>
        ${lab('Lugar')}${inp('lugar', F.lugar, 'text', '')}
        ${lab('Notas', 'Qué llevar, preguntas para el médico, número de autorización…')}${ta('notas', F.notas, '')}
        <label class="row" style="margin-top:14px;font-weight:600"><input type="checkbox" data-m="hecho" ${F.hecho ? 'checked' : ''} style="width:22px;height:22px"> Ya está hecho</label>
      </div>
      <div class="sticky-actions"><button class="btn" data-act="guardar-cita">Guardar</button>${ed ? `<button class="btn danger" style="flex:0 0 auto" data-act="borrar" data-col="citas" data-id="${ed.id}" data-ret="#/terapias">Eliminar</button>` : ''}</div>`);
  }

  /* ================= MÁS ================= */
  ruta(/^\/mas$/, () => view('Más', `
    <div class="card">
      <div class="item" data-go="#/paq"><div class="t">📝 Cuestionario 6-PAQ</div><div class="s">Aceptación parental · 16 afirmaciones · puntaje e historial</div></div>
      <div class="item" data-go="#/objetivos"><div class="t">🎯 Objetivos y habilidades</div><div class="s">Avances en comunicación, autonomía, regulación…</div></div>
      <div class="item" data-go="#/guia"><div class="t">📘 Guía rápida</div><div class="s">Cómo llenar el registro, funciones de la conducta, flexibilidad para padres</div></div>
      <div class="item" data-go="#/exportar"><div class="t">📄 Exportar e informes</div><div class="s">Formato registro padres, 6-PAQ e informe de seguimiento en Word</div></div>
      <div class="item" data-go="#/respaldo"><div class="t">💾 Respaldo y datos</div><div class="s">Guardar copia, pasar datos a otro celular, combinar con el otro cuidador</div></div>
      <div class="item" data-go="#/ajustes"><div class="t">⚙️ Ajustes</div><div class="s">Nombre, cuidadores, orden y terapias</div></div>
    </div>
    <p class="small muted" style="text-align:center">Los datos se guardan solo en este dispositivo. Nada se envía a internet.</p>`), 'mas');

  /* ----- 6-PAQ ----- */
  ruta(/^\/paq$/, vPaq, 'mas', true);
  function vPaq() {
    const ps = S.paq.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    const asc = ps.slice().reverse();
    view('Cuestionario 6-PAQ', `
      <div class="card"><p style="margin-top:0">El <b>Cuestionario de Aceptación Parental (6-PAQ)</b> mide la flexibilidad psicológica como padre o madre: qué tanto puedes estar presente, aceptar emociones difíciles y actuar según tus valores cuando tu hijo tiene conductas difíciles.</p>
        <p class="small muted">16 afirmaciones · 3 minutos · Responde pensando en los últimos meses. Repetirlo cada 1–2 meses permite ver el cambio.</p>
        <button class="btn block" data-go="#/paq/nuevo">Responder ahora</button></div>
      ${asc.length > 1 ? `<div class="card"><h2>Evolución (más bajo = más flexibilidad)</h2>${vbars(asc.slice(-10).map(p => ({ lab: fF(p.fecha).slice(0, 5), v: paqTotal(p.r) })), { color: '#7a5bd6' })}</div>` : ''}
      <div class="card"><h2>Aplicaciones</h2>${ps.length ? ps.map(p => { const t = paqTotal(p.r); return `<div class="item" data-go="#/paq/${p.id}"><div class="row"><div class="grow"><div class="t">${fLarga(p.fecha)}</div><div class="s">${esc(p.quien || '')}</div></div><span class="tag ${t <= 29 ? 'ok' : t <= 34 ? 'warn' : 'bad'}" style="font-size:15px">${t}</span></div></div>`; }).join('') : '<div class="empty">Aún no hay respuestas guardadas.</div>'}</div>`);
  }
  ruta(/^\/paq\/nuevo$/, () => formPaq(null), 'mas', true);
  ruta(/^\/paq\/([^/]+)\/editar$/, m => formPaq(m[1]), 'mas', true);
  ruta(/^\/paq\/([^/]+)$/, m => resultadoPaq(m[1]), 'mas', true);
  function formPaq(id) {
    const ed = id ? S.paq.find(p => p.id === id) : null;
    if (id && !ed) return volver('#/paq');
    F = ed ? clone(ed) : { id: uid(), fecha: hoy(), quien: S.perfil.quien || '', r: Array(16).fill(0), nota: '' };
    FK = 'paq';
    HOOK = () => { const n = F.r.filter(Boolean).length; const el = document.getElementById('paqn'); if (el) el.textContent = `${n} de 16 respondidas`; };
    view('6-PAQ', `
      <div class="card">
        <div class="grid2"><div>${lab('Fecha')}${inp('fecha', F.fecha, 'date')}</div><div>${lab('Responde')}${chips('quien', S.perfil.cuidadores, F.quien, true)}</div></div>
        <p class="small" style="margin-top:14px">${PAQ_INSTR}</p>
        <div class="notice info small" style="margin:0">1 = Muy en desacuerdo / nunca · 2 = En desacuerdo / poco frecuente · 3 = De acuerdo / con frecuencia · 4 = Muy de acuerdo / siempre</div>
        ${PAQ_ITEMS.map((t, i) => `<div class="paq-item"><p><span class="num">${i + 1}.</span>${esc(t)}</p>${scale('r.' + i, F.r[i], 4)}<div class="scale-labels"><span>Nunca</span><span>Siempre</span></div></div>`).join('')}
        ${lab('Observaciones (opcional)')}${ta('nota', F.nota, '')}
      </div>
      <div class="sticky-actions"><button class="btn" data-act="guardar-paq">Ver resultado · <span id="paqn"></span></button></div>`);
    HOOK();
  }
  function resultadoPaq(id) {
    const p = S.paq.find(x => x.id === id); if (!p) return volver('#/paq');
    const t = paqTotal(p.r);
    const prev = S.paq.filter(x => x.id !== p.id && (x.quien || '') === (p.quien || '') && x.fecha < p.fecha).sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    const conversar = PAQ_ITEMS.map((it, i) => ({ it, i, pts: paqPuntos(i, p.r[i]) })).filter(x => x.pts >= 3);
    const pct = Math.round((t - 16) * 100 / 48);
    view('Resultado 6-PAQ', `
      <div class="card"><div class="small muted">${fLarga(p.fecha)} · ${esc(p.quien || '')}</div>
        <div style="display:flex;align-items:baseline;gap:8px;margin:6px 0"><b style="font-size:40px;color:var(--pri)">${t}</b><span class="muted">de 64 · rango 16–64</span></div>
        <div class="bar" style="height:12px;position:relative"><i style="width:${pct}%;background:${t <= 29 ? 'var(--ok)' : t <= 34 ? 'var(--warn)' : 'var(--bad)'}"></i></div>
        <div class="scale-labels"><span>Más flexibilidad</span><span>Más inflexibilidad</span></div>
        <p>${paqLectura(t)}</p>
        ${prev ? `<p class="small"><b>Comparado con ${fF(prev.fecha)}:</b> ${paqTotal(prev.r)} → ${t} (${t < paqTotal(prev.r) ? 'mejoró la flexibilidad' : t > paqTotal(prev.r) ? 'subió la inflexibilidad' : 'sin cambio'}).</p>` : ''}
        <p class="small muted">Orientativo, no es un diagnóstico: el cuestionario no tiene puntos de corte clínicos. Los ítems 1, 4, 8, 13 y 16 se puntúan invertidos.</p></div>
      ${conversar.length ? `<div class="card"><h2>Para conversar en psicología familiar</h2><p class="small muted">Afirmaciones respondidas en la dirección de menor flexibilidad.</p>${conversar.map(x => `<div class="item" style="cursor:default"><div class="t small">${x.i + 1}. ${esc(x.it)}</div><div class="s">Respondiste: ${PAQ_ESC[p.r[x.i] - 1]}</div></div>`).join('')}</div>` : ''}
      <div class="grid2"><button class="btn" data-act="exp-paq" data-id="${p.id}">📄 Word</button><button class="btn sec" data-go="#/paq/${p.id}/editar">Editar</button></div>
      <div id="resultado-export"></div>
      <button class="btn danger block" style="margin-top:10px" data-act="borrar" data-col="paq" data-id="${p.id}" data-ret="#/paq">Eliminar</button>`);
  }

  /* ----- Objetivos ----- */
  ruta(/^\/objetivos$/, vObjetivos, 'mas', true);
  const nivelUlt = o => { const rs = (o.registros || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha)); return rs[rs.length - 1]; };
  const nivelBar = n => `<div class="levels">${[1, 2, 3, 4].map(i => `<i class="${n >= i ? 'on' : ''}"></i>`).join('')}</div>`;
  function vObjetivos() {
    const porArea = {};
    S.objetivos.forEach(o => { (porArea[o.area || 'Otros'] = porArea[o.area || 'Otros'] || []).push(o); });
    const usados = new Set(S.objetivos.map(o => o.nombre));
    const sug = CAT.sugeridos.filter(([, n]) => !usados.has(n));
    view('Objetivos y habilidades', `
      <button class="btn block" data-go="#/objetivo/nuevo" style="margin-bottom:12px">＋ Nuevo objetivo</button>
      ${Object.keys(porArea).length ? Object.entries(porArea).map(([a, os]) => `<div class="card"><h2>${esc(a)}</h2>${os.map(o => { const u = nivelUlt(o); return `<div class="item" data-go="#/objetivo/${o.id}"><div class="t">${esc(o.nombre)}</div><div class="s">${u ? CAT.niveles[u.nivel - 1] + ' · ' + fF(u.fecha) : 'Sin registros de avance'}</div>${nivelBar(u ? u.nivel : 0)}</div>`; }).join('')}</div>`).join('') : '<div class="card empty">Agrega los objetivos que les dejan en terapia para registrar cómo avanza en casa.</div>'}
      ${sug.length ? `<div class="card"><h2>Sugerencias rápidas</h2><p class="small muted">Toca para agregar. Ajústalas con lo que les indiquen las terapeutas.</p>${sug.map(([a, n]) => `<div class="item row" data-act="sugerido" data-a="${esc(a)}" data-n="${esc(n)}"><div class="grow"><div class="t small">${esc(n)}</div><div class="s">${esc(a)}</div></div><span style="color:var(--pri);font-size:22px">＋</span></div>`).join('')}</div>` : ''}`);
  }
  ruta(/^\/objetivo\/nuevo$/, () => formObjetivo(null), 'mas', true);
  ruta(/^\/objetivo\/([^/]+)\/editar$/, m => formObjetivo(m[1]), 'mas', true);
  ruta(/^\/objetivo\/([^/]+)$/, m => detalleObjetivo(m[1]), 'mas', true);
  function formObjetivo(id) {
    const ed = id ? S.objetivos.find(o => o.id === id) : null;
    if (id && !ed) return volver('#/objetivos');
    F = ed ? clone(ed) : { id: uid(), area: '', nombre: '', desc: '', creado: hoy(), registros: [] };
    FK = 'objetivo';
    view(ed ? 'Editar objetivo' : 'Nuevo objetivo', `<div class="card">
      ${lab('Objetivo', 'Escríbelo como algo observable: “Pide agua con el pictograma”.')}${inp('nombre', F.nombre, 'text', '')}
      ${lab('Área')}${chips('area', CAT.areas, F.area, true)}
      ${lab('Cómo se practica en casa (opcional)')}${ta('desc', F.desc, '')}</div>
      <div class="sticky-actions"><button class="btn" data-act="guardar-objetivo">Guardar</button></div>`);
  }
  function detalleObjetivo(id) {
    const o = S.objetivos.find(x => x.id === id); if (!o) return volver('#/objetivos');
    F = { fecha: hoy(), nivel: '', nota: '' }; FK = 'avance';
    const rs = (o.registros || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    view('Objetivo', `
      <div class="card"><div class="small muted">${esc(o.area || '')}</div><h2 style="margin-top:4px">${esc(o.nombre)}</h2>${o.desc ? `<p class="small">${esc(o.desc)}</p>` : ''}
        ${rs.length > 1 ? vbars(rs.slice(0, 12).reverse().map(r => ({ lab: fF(r.fecha).slice(0, 5), v: r.nivel })), { color: '#1f8a5b', h: 110 }) : ''}</div>
      <div class="card"><h2>Registrar avance</h2>
        ${lab('Fecha')}${inp('fecha', F.fecha, 'date')}
        ${lab('¿Cómo lo hizo?')}${chips('nivel', CAT.niveles.map((t, i) => ({ v: String(i + 1), d: '' })).map(x => x.v), F.nivel, true).replace(/>(\d)</g, (m, d) => '>' + d + ' · ' + CAT.niveles[d - 1] + '<')}
        ${lab('Nota')}${inp('nota', F.nota, 'text', 'Ej.: lo hizo 3 de 5 veces')}
        <button class="btn block" style="margin-top:12px" data-act="guardar-avance" data-id="${o.id}">Agregar avance</button></div>
      <div class="card"><h2>Historial</h2>${rs.length ? rs.map(r => `<div class="item row" style="cursor:default"><div class="grow"><div class="t small">${CAT.niveles[r.nivel - 1]}</div><div class="s">${fCorta(r.fecha)}${r.nota ? ' · ' + esc(r.nota) : ''}</div>${nivelBar(r.nivel)}</div><button class="btn sm ghost" data-act="borrar-avance" data-o="${o.id}" data-id="${r.id}">✕</button></div>`).join('') : '<p class="muted small">Sin registros.</p>'}</div>
      <div class="grid2"><button class="btn sec" data-go="#/objetivo/${o.id}/editar">Editar</button><button class="btn danger" data-act="borrar" data-col="objetivos" data-id="${o.id}" data-ret="#/objetivos">Eliminar</button></div>`);
  }

  /* ----- Guía ----- */
  ruta(/^\/guia$/, () => view('Guía rápida', `
    <p class="small muted" style="margin-top:0">Orientaciones generales. Siempre priman las indicaciones del equipo tratante.</p>
    <details class="guide" open><summary>Cómo llenar el registro de padres</summary><div class="body">
      <p>Registra lo antes posible después de la situación, cuando ya estés en calma. Si no alcanzas a terminar, la app guarda el borrador.</p>
      <ol><li><b>Situación:</b> qué pasaba justo antes (lugar, actividad, qué se le pidió o se le quitó).</li>
      <li><b>Conducta:</b> descríbela como una cámara: lo que se vio y escuchó, sin calificar (“se tiró al piso y gritó”, no “hizo una pataleta porque es terco”).</li>
      <li><b>Función:</b> tu mejor hipótesis de para qué le sirvió.</li>
      <li><b>¿Qué sentí?</b> emociones y lo que notaste en el cuerpo.</li>
      <li><b>¿Qué pensé?</b> pensamientos, imágenes o recuerdos que aparecieron.</li>
      <li><b>¿Qué hice o dejé de hacer?</b> tu respuesta, sin juzgarte.</li>
      <li><b>¿Qué ocurrió después?</b> cómo reaccionó él, cómo reaccionaron otros y cómo cambiaron tus sensaciones.</li></ol>
      <p>Con varios registros aparecen patrones: horarios, situaciones que disparan las crisis y respuestas que ayudan o empeoran. Eso es lo que más le sirve a la psicóloga.</p></div></details>
    <details class="guide"><summary>Las funciones de la conducta</summary><div class="body">
      <p>Toda conducta “le sirve” para algo. Identificar la función orienta qué hacer:</p>
      <p><b>Escapar o evitar:</b> la conducta aparece ante una exigencia o algo molesto. Suele ayudar anticipar con apoyos visuales, dividir la tarea, ofrecer pausas pedidas con un gesto o pictograma, y evitar que la crisis termine con el retiro total de la tarea.</p>
      <p><b>Obtener atención:</b> dar mucha atención cuando está tranquilo, enseñar una forma adecuada de llamar, y reducir la atención a la conducta problema cuando no hay riesgo.</p>
      <p><b>Obtener algo:</b> enseñar a pedirlo (gesto, seña, pictograma), usar “primero… después…”, y ser consistentes para que el berrinche no sea el camino para conseguirlo.</p>
      <p><b>Sensorial / autorregulación:</b> ofrecer alternativas que den una sensación parecida de forma segura y revisar con terapia ocupacional su perfil sensorial.</p>
      <p><b>Malestar físico:</b> en niños con poca comunicación verbal o con dificultades auditivas, el dolor, el sueño o el hambre pueden expresarse como conducta. Si aparece algo nuevo o distinto, descarta primero una causa médica.</p></div></details>
    <details class="guide"><summary>Durante una crisis</summary><div class="body">
      <ul><li>Primero la seguridad: retira objetos peligrosos y protege la cabeza si se golpea.</li>
      <li>Pocas palabras, voz baja y frases cortas. Baja estímulos: luz, ruido, gente alrededor.</li>
      <li>En el pico de la crisis no es momento de enseñar ni negociar; acompaña y espera.</li>
      <li>Cuando se calme, retoma la rutina con apoyo y refuerza la calma.</li>
      <li>Cuida tu propia regulación: respira y nombra lo que sientes antes de actuar.</li></ul></div></details>
    <details class="guide"><summary>Flexibilidad psicológica para padres (6-PAQ)</summary><div class="body">
      <p>El 6-PAQ se basa en seis habilidades que se pueden entrenar:</p>
      <p><b>Aceptación:</b> permitir la emoción difícil sin que mande tus acciones. <b>Defusión:</b> ver los pensamientos como pensamientos (“estoy teniendo el pensamiento de que soy mal padre”), no como verdades. <b>Momento presente:</b> estar de verdad en el juego o la rutina con tu hijo. <b>Yo como contexto:</b> tú eres más que este momento difícil. <b>Valores:</b> qué tipo de padre o madre quieres ser. <b>Acción comprometida:</b> pasos pequeños y consistentes hacia esos valores, aunque sea incómodo.</p>
      <p><b>Pausa de 3 pasos</b> para usar en el momento: 1) para y respira lento tres veces; 2) nota qué sientes y qué piensas, sin pelear con ello; 3) pregúntate qué haría ahora el padre o la madre que quiero ser, y da ese paso.</p></div></details>
    <details class="guide"><summary>Antes de cada cita médica</summary><div class="body">
      <ul><li>Lleva el informe en Word del último mes (sueño, conductas, terapias).</li>
      <li>Anota preguntas en la cita dentro de la app (campo “Notas”).</li>
      <li>Revisa la vigencia de las órdenes y autorizaciones; programa la renovación unas semanas antes del vencimiento.</li>
      <li>Para el estudio de sueño, registra varias noches seguidas: hora de dormir, despertares, ronquidos o pausas al respirar.</li></ul></div></details>
    <details class="guide"><summary>Cuándo buscar atención urgente</summary><div class="body">
      <p>Ante una lesión que necesite atención, golpes fuertes en la cabeza, una convulsión, atragantamiento o dificultad para respirar, o un cambio brusco y sin explicación en su comportamiento o en su estado general, acude a urgencias o llama a la línea <b>123</b>.</p></div></details>`), 'mas', true);

  /* ----- Exportar ----- */
  ruta(/^\/exportar$/, vExportar, 'mas', true);
  function vExportar() {
    F = { desde: addDays(hoy(), -29), hasta: hoy(), quien: 'Todos', paqId: (S.paq.slice().sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || {}).id || '' };
    FK = 'export';
    view('Exportar e informes', `
      <div class="card"><h2>Periodo</h2>
        <div class="grid2"><div>${lab('Desde')}${inp('desde', F.desde, 'date')}</div><div>${lab('Hasta')}${inp('hasta', F.hasta, 'date')}</div></div>
        ${lab('Registros de')}${chips('quien', ['Todos'].concat(S.perfil.cuidadores), F.quien, true)}</div>
      <div class="card"><h2>📄 Formato registro padres</h2><p class="small muted">El mismo documento de Word de la psicóloga, con una fila por cada registro del periodo.</p>
        <button class="btn block" data-act="exp-registro">Generar Word</button></div>
      <div class="card"><h2>📊 Informe de seguimiento</h2><p class="small muted">Resumen para el equipo tratante: conductas y sus funciones, respuestas de los padres, sueño, alimentación, asistencia a terapias, objetivos, 6-PAQ y logros.</p>
        <button class="btn block" data-act="exp-informe">Generar Word</button></div>
      <div class="card"><h2>📝 Cuestionario 6-PAQ</h2>${S.paq.length ? `<select data-m="paqId">${S.paq.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map(p => `<option value="${p.id}">${fF(p.fecha)} · ${esc(p.quien || '')} · ${paqTotal(p.r)} pts</option>`).join('')}</select>
        <button class="btn block" style="margin-top:10px" data-act="exp-paq">Generar Word</button>` : '<p class="muted small">Aún no hay cuestionarios respondidos.</p>'}</div>
      <div class="card"><h2>📈 Tabla para Excel</h2><p class="small muted">Todos los registros de conducta del periodo en formato CSV.</p><button class="btn sec block" data-act="exp-csv">Generar CSV</button></div>
      <div id="resultado-export"></div>`);
  }
  function mostrarResultado(blob, nombre, detalle) {
    LAST = { blob, nombre };
    const box = document.getElementById('resultado-export');
    const html = `<div class="card" style="border:2px solid var(--pri)"><h2>✅ Listo</h2><p class="small" style="margin-top:0"><b>${esc(nombre)}</b>${detalle ? '<br>' + esc(detalle) : ''}</p>
      <div class="grid2"><button class="btn" data-act="compartir">Compartir / Guardar</button><button class="btn sec" data-act="descargar">Descargar</button></div>
      <p class="small muted" style="margin-bottom:0">En el iPhone, “Compartir” permite guardarlo en Drive o Archivos, o enviarlo por WhatsApp o correo.</p></div>`;
    if (box) { box.innerHTML = html; box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  const sufijo = () => (S.perfil.nino ? '-' + slug(S.perfil.nino.split(' ')[0]) : '');

  /* ----- Respaldo ----- */
  ruta(/^\/respaldo$/, vRespaldo, 'mas', true);
  function vRespaldo() {
    F = { modo: 'Combinar' }; FK = 'respaldo';
    view('Respaldo y datos', `
      <div class="notice info">Los datos viven <b>solo en este celular</b>, dentro del navegador. Si borras los datos de Safari/Chrome, desinstalas la app o cambias de celular, se pierden. Descarga un respaldo cada semana y guárdalo en Drive.</div>
      <div class="card"><h2>💾 Descargar respaldo</h2><p class="small muted">Último respaldo: ${S.meta.respaldo ? fLarga(S.meta.respaldo.slice(0, 10)) : 'nunca'}</p>
        <div class="kv small"><dt>Conductas</dt><dd>${S.conductas.length}</dd><dt>Días de diario</dt><dd>${S.diario.length}</dd><dt>Sesiones</dt><dd>${S.sesiones.length}</dd><dt>Citas y pendientes</dt><dd>${S.citas.length}</dd><dt>6-PAQ</dt><dd>${S.paq.length}</dd><dt>Objetivos</dt><dd>${S.objetivos.length}</dd></div>
        <button class="btn block" style="margin-top:12px" data-act="respaldo">Crear archivo de respaldo</button></div>
      <div id="resultado-export"></div>
      <div class="card"><h2>📥 Importar respaldo</h2><p class="small muted"><b>Combinar</b> suma los registros del archivo a los de este celular (sirve para unir lo que registró el otro cuidador). <b>Reemplazar</b> borra lo de este celular y deja solo lo del archivo.</p>
        ${chips('modo', ['Combinar', 'Reemplazar'], F.modo, true)}
        <input type="file" id="archivo" accept=".json,application/json" style="margin-top:12px">
        <button class="btn sec block" style="margin-top:10px" data-act="importar">Importar</button></div>
      <div class="card"><h2>Borrar todo</h2><p class="small muted">Elimina todos los datos de este celular. Haz un respaldo antes.</p><button class="btn danger block" data-act="borrar-todo">Borrar todos los datos</button></div>`);
  }

  /* ----- Ajustes ----- */
  ruta(/^\/ajustes$/, vAjustes, 'mas', true);
  function vAjustes() {
    F = { perfil: clone(S.perfil), orden: clone(S.orden), terapias: clone(S.terapias), cuidadoresTxt: S.perfil.cuidadores.join(', ') };
    FK = 'ajustes';
    view('Ajustes', `
      <div class="card"><h2>Familia</h2>
        ${lab('Nombre del niño')}${inp('perfil.nino', F.perfil.nino, 'text', '')}
        ${lab('Cuidadores que registran', 'Separados por coma. Ej.: Papá, Mamá, Abuela')}${inp('cuidadoresTxt', F.cuidadoresTxt, 'text', '')}
        ${lab('¿Quién usa este celular?', 'Se marca por defecto en cada registro.')}<div id="quien">${chips('perfil.quien', S.perfil.cuidadores, F.perfil.quien, true)}</div></div>
      <div class="card"><h2>Orden de terapias</h2>
        ${lab('Prestador / institución')}${inp('orden.prestador', F.orden.prestador, 'text', '')}
        <div class="grid2"><div>${lab('Inicio')}${inp('orden.inicio', F.orden.inicio, 'date')}</div><div>${lab('Vence')}${inp('orden.fin', F.orden.fin, 'date')}</div></div>
        <h3>Terapias y sesiones ordenadas</h3>
        <div id="ters">${F.terapias.map((t, i) => `<div class="row" style="margin-bottom:8px"><div class="grow">${inp('terapias.' + i + '.nombre', t.nombre, 'text', 'Nombre')}</div><div style="width:92px">${inp('terapias.' + i + '.ordenadas', t.ordenadas, 'number', 'N.º', 'min="0" inputmode="numeric"')}</div><button class="btn sm ghost" data-act="quitar-terapia" data-i="${i}">✕</button></div>`).join('')}</div>
        <button class="btn sm sec" data-act="agregar-terapia">＋ Agregar terapia</button></div>
      <div class="sticky-actions"><button class="btn" data-act="guardar-ajustes">Guardar ajustes</button></div>
      <p class="small muted" style="text-align:center;margin-top:20px">Versión 1.0 · Funciona sin internet una vez abierta.</p>`);
  }

  /* ================= Acciones ================= */
  const ACT = {
    'ocultar-instalar'() { S.meta.avisoInstalar = true; save(); render(); },
    'seg-c'(b) { segConductas = b.dataset.v; render(); },
    periodo(b) { periodo = Number(b.dataset.v); render(); },
    'descartar-borrador'() { draftClear(); render(); },
    'guardar-conducta'() {
      if (!F.fecha) return alert('Falta la fecha.');
      if (!(F.tipos.length || F.conducta.trim())) return alert('Describe al menos qué hizo (sección 2).');
      F.editado = new Date().toISOString(); if (!F.creado) F.creado = F.editado;
      const i = S.conductas.findIndex(c => c.id === F.id);
      if (i >= 0) S.conductas[i] = F; else S.conductas.push(F);
      save(); if (FK === 'conducta') draftClear();
      toast('Registro guardado'); volver('#/conductas');
    },
    'guardar-dia'() {
      if (!F.fecha) return alert('Falta la fecha.');
      F.editado = new Date().toISOString();
      const i = S.diario.findIndex(d => d.id === F.id);
      if (i >= 0) S.diario[i] = F; else S.diario.push(F);
      save(); toast('Día guardado'); volver('#/diario');
    },
    'guardar-sesion'() {
      if (!F.fecha) return alert('Falta la fecha.');
      if (!F.terapias.length) return alert('Selecciona la terapia.');
      const ed = S.sesiones.findIndex(s => s.id === F.id);
      const baseS = { fecha: F.fecha, asistio: F.asistio || 'si', motivo: F.asistio === 'no' ? F.motivo : '', trabajaron: F.trabajaron, tarea: F.tarea, obs: F.obs, como: F.como, editado: new Date().toISOString() };
      if (ed >= 0) { S.sesiones[ed] = Object.assign({ id: F.id, terapia: F.terapias[0] }, baseS); }
      else F.terapias.forEach((t, k) => S.sesiones.push(Object.assign({ id: k ? uid() : F.id, terapia: t }, baseS)));
      save(); toast(F.terapias.length > 1 && ed < 0 ? F.terapias.length + ' sesiones guardadas' : 'Sesión guardada'); volver('#/terapias');
    },
    'guardar-cita'() {
      if (!F.desc.trim() && !F.tipo) return alert('Escribe qué es la cita o pendiente.');
      F.editado = new Date().toISOString();
      const i = S.citas.findIndex(c => c.id === F.id);
      if (i >= 0) S.citas[i] = F; else S.citas.push(F);
      save(); toast('Guardado'); volver('#/terapias');
    },
    'cita-hecho'(b) { const c = S.citas.find(x => x.id === b.dataset.id); if (c) { c.hecho = !c.hecho; c.editado = new Date().toISOString(); save(); render(); } },
    'guardar-paq'() {
      const falt = F.r.map((v, i) => (v ? 0 : i + 1)).filter(Boolean);
      if (falt.length) return alert('Faltan por responder: ' + falt.join(', '));
      F.editado = new Date().toISOString();
      const i = S.paq.findIndex(p => p.id === F.id);
      if (i >= 0) S.paq[i] = F; else S.paq.push(F);
      save(); volver('#/paq/' + F.id);
    },
    'guardar-objetivo'() {
      if (!F.nombre.trim()) return alert('Escribe el objetivo.');
      F.editado = new Date().toISOString();
      const i = S.objetivos.findIndex(o => o.id === F.id);
      if (i >= 0) S.objetivos[i] = F; else S.objetivos.push(F);
      save(); volver('#/objetivo/' + F.id);
    },
    sugerido(b) {
      const o = { id: uid(), area: b.dataset.a, nombre: b.dataset.n, desc: '', creado: hoy(), registros: [], editado: new Date().toISOString() };
      S.objetivos.push(o); save(); toast('Objetivo agregado'); render();
    },
    'guardar-avance'(b) {
      if (!F.nivel) return alert('Elige cómo lo hizo.');
      const o = S.objetivos.find(x => x.id === b.dataset.id); if (!o) return;
      o.registros = o.registros || []; o.registros.push({ id: uid(), fecha: F.fecha || hoy(), nivel: Number(F.nivel), nota: F.nota || '' });
      o.editado = new Date().toISOString(); save(); toast('Avance registrado'); render();
    },
    'borrar-avance'(b) {
      const o = S.objetivos.find(x => x.id === b.dataset.o); if (!o || !confirm('¿Eliminar este avance?')) return;
      o.registros = o.registros.filter(r => r.id !== b.dataset.id); o.editado = new Date().toISOString(); save(); render();
    },
    borrar(b) {
      if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
      S[b.dataset.col] = S[b.dataset.col].filter(x => x.id !== b.dataset.id); save(); toast('Eliminado'); volver(b.dataset.ret);
    },
    async 'exp-registro'() {
      if (F.desde > F.hasta) return alert('La fecha "desde" es posterior a "hasta".');
      const cs = filtroQuien(S.conductas.filter(c => enRango(c.fecha, F.desde, F.hasta)), F.quien).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
      if (!cs.length && !confirm('No hay registros en ese periodo. ¿Generar el formato vacío?')) return;
      try {
        const blob = await Exp.registroPadres(cs.map(columnas), { titulo: 'Formato registro padres', detalle: [S.perfil.nino ? 'Niño(a): ' + S.perfil.nino : '', 'Periodo: ' + fF(F.desde) + ' a ' + fF(F.hasta), F.quien !== 'Todos' ? 'Registra: ' + F.quien : ''].filter(Boolean).join('   ·   ') });
        mostrarResultado(blob, `Formato registro padres${sufijo()} ${F.desde} a ${F.hasta}.docx`, cs.length + ' registros');
      } catch (e) { alert('No se pudo generar el Word: ' + e.message); }
    },
    async 'exp-informe'() {
      if (F.desde > F.hasta) return alert('La fecha "desde" es posterior a "hasta".');
      try { const blob = await Exp.informe(resumen(F.desde, F.hasta, F.quien)); mostrarResultado(blob, `Informe de seguimiento${sufijo()} ${F.desde} a ${F.hasta}.docx`); }
      catch (e) { alert('No se pudo generar el informe: ' + e.message); }
    },
    async 'exp-paq'(b) {
      const p = S.paq.find(x => x.id === (b.dataset.id || F.paqId)); if (!p) return;
      const t = paqTotal(p.r);
      try {
        const blob = await Exp.paq({ nino: S.perfil.nino, quien: p.quien, fecha: fLarga(p.fecha), instrucciones: PAQ_INSTR, items: PAQ_ITEMS, respuestas: p.r, total: t, interpretacion: paqLectura(t), nota: p.nota, aConversar: PAQ_ITEMS.map((it, i) => ({ it, i })).filter(x => paqPuntos(x.i, p.r[x.i]) >= 3).map(x => `${x.i + 1}. ${x.it} — ${PAQ_ESC[p.r[x.i] - 1]}`) });
        mostrarResultado(blob, `6-PAQ${sufijo()} ${slug(p.quien)} ${p.fecha}.docx`, 'Puntaje total: ' + t);
      } catch (e) { alert('No se pudo generar el Word: ' + e.message); }
    },
    'exp-csv'() {
      const cs = filtroQuien(S.conductas.filter(c => enRango(c.fecha, F.desde, F.hasta)), F.quien).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
      const head = ['Fecha', 'Hora', 'Registra', 'Lugar', 'Antecedentes', 'Situación', 'Conductas', 'Descripción', 'Intensidad', 'Duración', 'Función', 'Nota función', 'Emociones', 'Intensidad emoción', 'Sensaciones', 'Sentí (detalle)', 'Pensamientos', 'Pensé (detalle)', 'Qué hice', 'Hice (detalle)', 'Qué pasó después', 'Después (detalle)'];
      const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const rows = cs.map(c => [c.fecha, c.hora, c.registra, c.lugar, lista(c.antecedentes), c.situacion, lista(c.tipos), c.conducta, c.intensidad || '', c.duracion, lista(c.funciones), c.funcion, lista(c.emociones), c.intEmocion || '', lista(c.sensaciones), c.sentir, lista(c.pensChips), c.pensamientos, lista(c.acciones), c.accion, lista(c.despues), c.consecuencia]);
      const csv = '﻿' + [head].concat(rows).map(r => r.map(q).join(';')).join('\r\n');
      mostrarResultado(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `Registros de conducta${sufijo()} ${F.desde} a ${F.hasta}.csv`, cs.length + ' registros');
    },
    async compartir() { if (!LAST) return; const r = await Exp.compartir(LAST.blob, LAST.nombre); if (LAST.respaldo && r !== 'cancelado') marcarRespaldo(); },
    descargar() { if (!LAST) return; Exp.descargar(LAST.blob, LAST.nombre); if (LAST.respaldo) marcarRespaldo(); },
    respaldo() {
      const data = JSON.stringify(Object.assign({}, S, { exportado: new Date().toISOString(), app: 'seguimiento-familiar' }), null, 1);
      mostrarResultado(new Blob([data], { type: 'application/json' }), `respaldo-seguimiento${sufijo()}-${hoy()}.json`, 'Guárdalo en Drive o envíatelo por correo.');
      LAST.respaldo = true;
    },
    async importar() {
      const f = document.getElementById('archivo').files[0];
      if (!f) return alert('Elige el archivo de respaldo (.json).');
      let d; try { d = JSON.parse(await f.text()); } catch (e) { return alert('El archivo no es un respaldo válido.'); }
      if (!d || !d.v || !Array.isArray(d.conductas)) return alert('El archivo no es un respaldo de esta app.');
      if (F.modo === 'Reemplazar') {
        if (!confirm('Se borrarán los datos de este celular y quedarán solo los del archivo. ¿Continuar?')) return;
        const b = base(); S = Object.assign(b, d, { meta: Object.assign(b.meta, d.meta || {}) }); delete S.exportado; delete S.app;
      } else {
        const r = combinar(d);
        alert(`Combinado: ${r} registros nuevos o actualizados.`);
      }
      save(); toast('Importación lista'); volver('#/inicio');
    },
    'borrar-todo'() {
      if (!confirm('¿Borrar TODOS los datos de este celular?')) return;
      if (prompt('Escribe BORRAR para confirmar') !== 'BORRAR') return;
      S = base(); save(); draftClear(); toast('Datos borrados'); volver('#/inicio');
    },
    'agregar-terapia'() { F.terapias.push({ id: uid(), nombre: '', ordenadas: '' }); repintarTerapias(); },
    'quitar-terapia'(b) {
      const t = F.terapias[Number(b.dataset.i)];
      if (t && S.sesiones.some(s => s.terapia === t.id) && !confirm('Esta terapia tiene sesiones registradas. ¿Quitarla de todas formas? (las sesiones se conservan)')) return;
      F.terapias.splice(Number(b.dataset.i), 1); repintarTerapias();
    },
    'guardar-ajustes'() {
      const cuid = String(F.cuidadoresTxt || '').split(',').map(s => s.trim()).filter(Boolean);
      S.perfil = Object.assign({}, F.perfil, { nino: (F.perfil.nino || '').trim(), cuidadores: cuid.length ? cuid : ['Papá', 'Mamá'] });
      if (!S.perfil.cuidadores.includes(S.perfil.quien)) S.perfil.quien = S.perfil.cuidadores[0];
      S.orden = F.orden;
      S.terapias = F.terapias.filter(t => (t.nombre || '').trim()).map(t => Object.assign(t, { nombre: t.nombre.trim() }));
      save(); toast('Ajustes guardados'); volver('#/inicio');
    }
  };
  function repintarTerapias() {
    document.getElementById('ters').innerHTML = F.terapias.map((t, i) => `<div class="row" style="margin-bottom:8px"><div class="grow">${inp('terapias.' + i + '.nombre', t.nombre, 'text', 'Nombre')}</div><div style="width:92px">${inp('terapias.' + i + '.ordenadas', t.ordenadas, 'number', 'N.º', 'min="0" inputmode="numeric"')}</div><button class="btn sm ghost" data-act="quitar-terapia" data-i="${i}">✕</button></div>`).join('');
  }
  function marcarRespaldo() { S.meta.respaldo = new Date().toISOString(); save(); }
  function combinar(d) {
    let n = 0;
    ['conductas', 'diario', 'sesiones', 'citas', 'paq', 'objetivos'].forEach(k => {
      (d[k] || []).forEach(x => {
        if (!x || !x.id) return;
        const i = S[k].findIndex(y => y.id === x.id);
        if (i < 0) { S[k].push(x); n++; }
        else {
          const a = S[k][i];
          if (k === 'objetivos') {
            const ids = new Set((a.registros || []).map(r => r.id));
            const extra = (x.registros || []).filter(r => !ids.has(r.id));
            if (extra.length) { a.registros = (a.registros || []).concat(extra); n++; }
          } else if ((x.editado || '') > (a.editado || '')) { S[k][i] = x; n++; }
        }
      });
    });
    if (!S.perfil.nino && d.perfil && d.perfil.nino) S.perfil.nino = d.perfil.nino;
    if (!S.orden.inicio && d.orden && d.orden.inicio) S.orden = d.orden;
    (d.terapias || []).forEach(t => { const e = S.terapias.find(x => x.id === t.id); if (!e) S.terapias.push(t); else if (!e.ordenadas && t.ordenadas) e.ordenadas = t.ordenadas; });
    return n;
  }

  /* ================= Arranque ================= */
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  render();
})();
