'use strict';
/* Generación de documentos Word (.docx) en el navegador, sin servidor.
   - registroPadres: diligencia la plantilla original "Formato registro padres.docx".
   - paq / informe: documentos nuevos construidos con OOXML mínimo. */
const Exp = (function () {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
  const XMLNS = 'http://www.w3.org/XML/1998/namespace';
  const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const x = s => String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 1. Plantilla original del registro de padres ---------- */
  function el(doc, name) { return doc.createElementNS(W, name); }
  function val(node, v) { node.setAttributeNS(W, 'w:val', String(v)); return node; }
  function runDom(doc, text, { b = false, sz = 20 } = {}) {
    const r = el(doc, 'w:r'), pr = el(doc, 'w:rPr');
    if (b) { pr.appendChild(el(doc, 'w:b')); pr.appendChild(el(doc, 'w:bCs')); }
    pr.appendChild(val(el(doc, 'w:sz'), sz)); pr.appendChild(val(el(doc, 'w:szCs'), sz));
    r.appendChild(pr);
    const t = el(doc, 'w:t'); t.setAttributeNS(XMLNS, 'xml:space', 'preserve'); t.textContent = text;
    r.appendChild(t); return r;
  }
  const hijos = (n, name) => Array.from(n.childNodes).filter(c => c.localName === name);

  function llenarCelda(doc, tc, texto) {
    const ps = hijos(tc, 'p');
    const p0 = ps[0];
    ps.slice(1).forEach(p => tc.removeChild(p));
    Array.from(p0.childNodes).filter(n => n.localName !== 'pPr').forEach(n => p0.removeChild(n));
    p0.removeAttributeNS(W14, 'paraId'); p0.removeAttributeNS(W14, 'textId');
    const modelo = p0.cloneNode(true);
    const lineas = String(texto || '').split('\n');
    lineas.forEach((ln, i) => {
      const p = i === 0 ? p0 : modelo.cloneNode(true);
      if (ln) p.appendChild(runDom(doc, ln));
      if (i > 0) tc.appendChild(p);
    });
  }

  async function registroPadres(filas, encabezado) {
    const res = await fetch('plantillas/formato-registro-padres.docx');
    if (!res.ok) throw new Error('No se pudo cargar la plantilla (' + res.status + ')');
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const xml = await zip.file('word/document.xml').async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const body = doc.getElementsByTagNameNS(W, 'body')[0];
    const tbl = doc.getElementsByTagNameNS(W, 'tbl')[0];
    const rows = hijos(tbl, 'tr');
    const head = rows[0], modelo = rows[1].cloneNode(true);
    const th = head.getElementsByTagNameNS(W, 'tblHeader')[0];
    if (th) val(th, 1); // el encabezado se repite en cada página
    rows.slice(1).forEach(r => tbl.removeChild(r));
    const vacias = filas.length ? 2 : 11; // 2 filas libres para anotar a mano (11 si se pide el formato vacío)
    filas.concat(Array.from({ length: vacias }, () => [])).forEach(f => {
      const tr = modelo.cloneNode(true);
      hijos(tr, 'tc').forEach((tc, i) => {
        const va = tc.getElementsByTagNameNS(W, 'vAlign')[0];
        if (va) val(va, 'top');
        llenarCelda(doc, tc, f[i] || '');
      });
      tbl.appendChild(tr);
    });
    if (encabezado) {
      const p = hijos(body, 'p')[0];
      if (p) {
        Array.from(p.childNodes).filter(n => n.localName === 'r').forEach(n => p.removeChild(n));
        p.appendChild(runDom(doc, encabezado.titulo, { b: true, sz: 24 }));
        if (encabezado.detalle) p.appendChild(runDom(doc, '   ' + encabezado.detalle, { sz: 20 }));
      }
    }
    zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
    return zip.generateAsync({ type: 'blob', mimeType: MIME, compression: 'DEFLATE' });
  }

  /* ---------- 2. Constructor OOXML mínimo ---------- */
  function R(t, o = {}) {
    let pr = '';
    if (o.b) pr += '<w:b/><w:bCs/>';
    if (o.i) pr += '<w:i/><w:iCs/>';
    if (o.color) pr += `<w:color w:val="${o.color}"/>`;
    if (o.sz) pr += `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`;
    return String(t ?? '').split('\n').map((s, i) =>
      `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(s)}</w:t></w:r>`).join('');
  }
  function P(c, o = {}) {
    const runs = typeof c === 'string' && !c.startsWith('<w:r') ? R(c, o) : (c || '');
    let pr = '';
    if (o.style) pr += `<w:pStyle w:val="${o.style}"/>`;
    if (o.keep) pr += '<w:keepNext/>';
    if (o.after != null || o.before != null) pr += `<w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 120}"/>`;
    if (o.ind) pr += `<w:ind w:left="${o.ind}" w:hanging="240"/>`;
    if (o.align) pr += `<w:jc w:val="${o.align}"/>`;
    return `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ''}${runs}</w:p>`;
  }
  const H1 = t => P(t, { style: 'Heading1' });
  const H2 = t => P(t, { style: 'Heading2' });
  const Bul = t => P(R('•  ') + (typeof t === 'string' ? R(t) : t), { ind: 360, after: 60 });
  const KV = (k, v) => P(R(k + ': ', { b: true }) + R(v), { after: 60 });

  function T(rows, { widths, head = true, sz = 20, align = [] } = {}) {
    const total = widths.reduce((a, b) => a + b, 0);
    const brd = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BFC8D8"/>`).join('') + '</w:tblBorders>';
    const trs = rows.map((r, ri) => {
      const h = head && ri === 0;
      return `<w:tr><w:trPr>${h ? '<w:tblHeader/>' : '<w:cantSplit/>'}</w:trPr>` + r.map((c, ci) =>
        `<w:tc><w:tcPr><w:tcW w:w="${widths[ci]}" w:type="dxa"/>${h ? '<w:shd w:val="clear" w:color="auto" w:fill="C9DAF8"/>' : ''}</w:tcPr>` +
        String(c ?? '').split('\n').map(ln => P(R(ln, { b: h, sz }), { after: 0, align: align[ci] })).join('') + '</w:tc>').join('') + '</w:tr>';
    }).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${brd}<w:tblLayout w:type="fixed"/>` +
      `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
      `<w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${trs}</w:tbl>` + P('', { after: 80 });
  }

  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-CO"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="1F3F7A"/><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="2F5FB3"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:bCs/><w:color w:val="1D2433"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style></w:styles>`;

  function empaquetar(body, { landscape = false } = {}) {
    const pg = landscape ? '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>' : '<w:pgSz w:w="11906" w:h="16838"/>';
    const z = new JSZip();
    z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
    z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    z.file('word/styles.xml', STYLES);
    z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr>${pg}<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`);
    return z.generateAsync({ type: 'blob', mimeType: MIME, compression: 'DEFLATE' });
  }

  /* ---------- 3. Cuestionario 6-PAQ ---------- */
  function paq(d) {
    let b = P('Cuestionario de Aceptación Parental (6-PAQ)', { style: 'Title' });
    b += P('Versión en español (Flujas-Contreras, García-Palacios y Gómez, 2020)', { i: true, color: '667085', after: 200 });
    if (d.nino) b += KV('Niño(a)', d.nino);
    b += KV('Responde', d.quien || '—') + KV('Fecha', d.fecha);
    b += P(d.instrucciones, { before: 160, sz: 21 });
    b += P('1 = Muy en desacuerdo / nunca   ·   2 = En desacuerdo / poco frecuente   ·   3 = De acuerdo / con frecuencia   ·   4 = Muy de acuerdo / siempre', { sz: 19, color: '444C5C' });
    const rows = [['#', 'Afirmación', '1', '2', '3', '4']];
    d.items.forEach((t, i) => { const v = d.respuestas[i]; rows.push([String(i + 1), t, v === 1 ? 'X' : '', v === 2 ? 'X' : '', v === 3 ? 'X' : '', v === 4 ? 'X' : '']); });
    b += T(rows, { widths: [450, 6738, 600, 600, 600, 650], align: ['center', '', 'center', 'center', 'center', 'center'] });
    b += H1('Resultado');
    b += KV('Puntaje total de inflexibilidad', `${d.total} (rango 16 a 64; más bajo = más flexibilidad psicológica)`);
    b += P(d.interpretacion);
    if (d.aConversar && d.aConversar.length) {
      b += H2('Afirmaciones para conversar con el equipo de psicología');
      d.aConversar.forEach(t => { b += Bul(t); });
    }
    if (d.nota) { b += H2('Observaciones'); b += P(d.nota); }
    b += P('Cálculo: los ítems 1, 4, 8, 13 y 16 están redactados en sentido de flexibilidad y se invierten (5 − respuesta); luego se suman los 16 ítems. Referencia orientativa: media de 29,1 (DE 5,7) en la muestra española de validación. El instrumento no tiene puntos de corte clínicos; no es un diagnóstico.', { sz: 18, color: '667085', before: 240 });
    return empaquetar(b);
  }

  /* ---------- 4. Informe de seguimiento ---------- */
  const tablaConteo = (titulo, lista, total) => {
    if (!lista || !lista.length) return '';
    const rows = [[titulo, 'Veces', '%']].concat(lista.map(r => [r.t, String(r.n), total ? Math.round(r.n * 100 / total) + ' %' : '']));
    return T(rows, { widths: [7038, 1300, 1300], align: ['', 'center', 'center'] });
  };
  function informe(r) {
    let b = P('Informe de seguimiento familiar', { style: 'Title' });
    b += P(`${r.nino ? r.nino + ' · ' : ''}Periodo: ${r.desdeTxt} a ${r.hastaTxt}`, { color: '444C5C', after: 60 });
    b += P(`Elaborado el ${r.generadoTxt}${r.quien ? ' · Registros de: ' + r.quien : ''}`, { color: '667085', sz: 19, after: 200 });

    const c = r.conductas;
    b += H1('Conductas registradas');
    if (!c.total) b += P('Sin registros de conducta en el periodo.');
    else {
      b += Bul(`${c.total} registros en ${c.dias} días con registro (${c.porDia} por día con registro, en promedio).`);
      if (c.intProm) b += Bul(`Intensidad promedio: ${c.intProm} de 5.`);
      if (c.duraciones.length) b += Bul(`Duración más frecuente: ${c.duraciones[0].t}.`);
      b += H2('Tipo de conducta'); b += tablaConteo('Conducta', c.tipos, c.total);
      b += H2('Función probable (¿para qué lo hizo?)'); b += tablaConteo('Función', c.funciones, c.total);
      b += H2('Situaciones que la antecedieron'); b += tablaConteo('Antecedente', c.antecedentes, c.total);
      b += H2('Momento del día y lugar'); b += tablaConteo('Momento', c.momentos, c.total); b += tablaConteo('Lugar', c.lugares, c.total);
      if (c.acciones.length) {
        b += H2('Lo que hicimos y lo que pasó después');
        const rows = [['Respuesta del adulto', 'Veces', 'Se calmó / volvió a la actividad', 'Aumentó o se repitió', 'Obtuvo lo que buscaba']]
          .concat(c.acciones.map(a => [a.t, String(a.n), String(a.calma), String(a.aumento), String(a.refuerzo)]));
        b += T(rows, { widths: [3638, 1000, 1800, 1600, 1600] });
        b += P('"Obtuvo lo que buscaba" incluye "consiguió lo que quería" y "evitó la tarea": son respuestas que pueden mantener la conducta en el tiempo.', { sz: 18, color: '667085' });
      }
      b += H1('Vivencia de los padres');
      b += tablaConteo('Emoción', c.emociones, c.total);
      b += tablaConteo('Sensación física', c.sensaciones, c.total);
      b += tablaConteo('Pensamiento', c.pensamientos, c.total);
    }

    const s = r.sueno;
    b += H1('Sueño');
    if (!s.noches) b += P('Sin registros de sueño en el periodo.');
    else {
      b += Bul(`${s.noches} noches registradas · promedio ${s.promHorasTxt} de sueño · ${s.promDesp} despertares por noche.`);
      if (s.obs.length) b += Bul('Observaciones nocturnas: ' + s.obs.map(o => `${o.t} (${o.n})`).join(', ') + '.');
      b += T([['Fecha', 'Se acostó', 'Se durmió', 'Despertó', 'Horas', 'Despertares', 'Observaciones']].concat(s.filas),
        { widths: [1150, 1000, 1000, 1000, 900, 1100, 3488], sz: 18 });
    }
    const a = r.alim;
    if (a.dias) {
      b += H2('Alimentación');
      b += tablaConteo('Cómo comió', a.como, a.dias);
      if (a.obs.length) b += tablaConteo('Observación', a.obs, a.dias);
    }
    if (r.animoProm) b += P(R('Regulación / ánimo general promedio: ', { b: true }) + R(r.animoProm + ' de 5'));

    b += H1('Terapias');
    if (r.orden && (r.orden.prestador || r.orden.inicio)) {
      b += P(`${r.orden.prestador ? 'Prestador: ' + r.orden.prestador + '. ' : ''}${r.orden.inicio ? 'Orden vigente del ' + r.orden.inicioTxt + ' al ' + (r.orden.finTxt || '—') + '.' : ''}`);
    }
    if (r.terapias.some(t => t.asistTotal || t.faltasPeriodo || t.ordenadas)) {
      b += T([['Terapia', 'Ordenadas', 'Asistidas en el periodo', 'Faltas en el periodo', 'Asistidas acumuladas']]
        .concat(r.terapias.map(t => [t.nombre, t.ordenadas || '—', String(t.asistPeriodo), String(t.faltasPeriodo), String(t.asistTotal)])),
        { widths: [3238, 1400, 1700, 1600, 1700] });
    } else b += P('Sin sesiones registradas.');
    if (r.tareas.length) {
      b += H2('Tareas para la casa recibidas');
      r.tareas.forEach(t => { b += Bul(`${t.fecha} · ${t.terapia}: ${t.tarea}`); });
    }

    if (r.objetivos.length) {
      b += H1('Objetivos y habilidades');
      b += T([['Objetivo', 'Área', 'Primer registro', 'Último registro']]
        .concat(r.objetivos.map(o => [o.nombre, o.area, o.inicial, o.actual])), { widths: [3638, 1700, 2150, 2150] });
    }
    if (r.paq.length) {
      b += H1('Cuestionario 6-PAQ (flexibilidad parental)');
      b += T([['Fecha', 'Responde', 'Puntaje total (16–64)']].concat(r.paq.map(p => [p.fecha, p.quien, String(p.total)])), { widths: [2500, 3638, 3500] });
      b += P('Más bajo = más flexibilidad psicológica. Referencia orientativa: media 29,1 (DE 5,7) en la validación española.', { sz: 18, color: '667085' });
    }
    if (r.logros.length) {
      b += H1('Logros y momentos positivos');
      r.logros.forEach(l => { b += Bul(`${l.fecha}: ${l.texto}`); });
    }
    if (r.citas.length) {
      b += H1('Próximas citas y pendientes');
      r.citas.forEach(ci => { b += Bul(`${ci.fecha}${ci.hora ? ' ' + ci.hora : ''} · ${ci.tipo || 'Pendiente'}: ${ci.desc}`); });
    }
    b += P('Información registrada por los cuidadores en la aplicación de seguimiento familiar. No reemplaza la valoración del equipo tratante.', { sz: 18, color: '667085', before: 300 });
    return empaquetar(b);
  }

  /* ---------- 5. Compartir / descargar ---------- */
  async function compartir(blob, nombre) {
    const file = new File([blob], nombre, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nombre }); return 'compartido'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelado'; }
    }
    descargar(blob, nombre); return 'descargado';
  }
  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
  }

  return { registroPadres, paq, informe, compartir, descargar, MIME };
})();
