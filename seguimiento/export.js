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
    const vacias = encabezado && encabezado.vacias != null ? encabezado.vacias : filas.length ? 2 : 11; // 2 filas libres para anotar a mano (11 si se pide el formato vacío)
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

  /* ---------- 3. Modelo de bloques (sirve para Word y PDF) ---------- */
  // Tipos: title, sub, h1, h2, p, bul, kv, table
  function aDocx(bl) {
    let b = '';
    bl.forEach(k => {
      switch (k.t) {
        case 'title': b += P(k.x, { style: 'Title' }); break;
        case 'sub': b += P(k.x, { i: !!k.italic, color: k.muted ? '667085' : '444C5C', sz: k.small ? 19 : undefined, after: k.after != null ? k.after : 60 }); break;
        case 'h1': b += H1(k.x); break;
        case 'h2': b += H2(k.x); break;
        case 'p': b += k.small ? P(k.x, { sz: 18, color: '667085', before: k.before || 0, after: 120 }) : P(k.x); break;
        case 'bul': b += Bul(k.x); break;
        case 'kv': b += KV(k.k, k.v); break;
        case 'table': b += T(k.rows, { widths: k.widths, align: k.align || [], sz: k.sz || 20 }); break;
      }
    });
    return empaquetar(b);
  }

  /* ---------- 4. PDF (jsPDF, se carga solo cuando se necesita) ---------- */
  let pdfListo = null;
  function cargarScript(src) {
    return new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar ' + src + '. Revisa la conexión e inténtalo de nuevo.')); document.head.appendChild(s); });
  }
  function cargarPdf() {
    if (!pdfListo) pdfListo = cargarScript('vendor/jspdf.umd.min.js').then(() => cargarScript('vendor/jspdf.plugin.autotable.min.js')).catch(e => { pdfListo = null; throw e; });
    return pdfListo;
  }
  const AT = (doc, o) => (typeof window.autoTable === 'function' ? window.autoTable(doc, o) : doc.autoTable(o));
  // Las fuentes estándar del PDF usan WinAnsi: se reemplazan los caracteres que no existen allí.
  const pt = s => String(s ?? '').replace(/−/g, '-').replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/[^\n\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, '');
  const C = { tinta: [29, 36, 51], gris: [102, 112, 133], gris2: [68, 76, 92], azul: [47, 95, 179], azulOsc: [31, 63, 122], cab: [201, 218, 248], borde: [191, 200, 216] };
  function pies(doc, texto) {
    const n = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.gris);
      if (texto) doc.text(pt(texto), 10, H - 6);
      doc.text(`Página ${i} de ${n}`, W - 10, H - 6, { align: 'right' });
    }
  }
  async function aPdf(bl, { pie = '' } = {}) {
    await cargarPdf();
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 18, ancho = W - 2 * M;
    let y = M;
    const salto = h => { if (y + h > H - 16) { doc.addPage(); y = M; } };
    const fuente = (size, estilo, color) => { doc.setFont('helvetica', estilo || 'normal'); doc.setFontSize(size); doc.setTextColor(...(color || C.tinta)); };
    const texto = (t, { size = 10.5, estilo = 'normal', color, ind = 0, after = 2 } = {}) => {
      fuente(size, estilo, color);
      const lh = size * 0.3528 * 1.35;
      doc.splitTextToSize(pt(t), ancho - ind).forEach(l => { salto(lh); doc.text(l, M + ind, y + size * 0.3528); y += lh; });
      y += after;
    };
    for (const k of bl) {
      switch (k.t) {
        case 'title': texto(k.x, { size: 19, estilo: 'bold', color: C.azulOsc, after: 1.5 }); break;
        case 'sub': texto(k.x, { size: k.small ? 8.5 : 10, estilo: k.italic ? 'italic' : 'normal', color: k.muted ? C.gris : C.gris2, after: k.after != null ? k.after / 40 : 1.5 }); break;
        case 'h1': y += 4; salto(34); texto(k.x, { size: 14, estilo: 'bold', color: C.azul, after: 2 }); break;
        case 'h2': y += 2; salto(28); texto(k.x, { size: 11.5, estilo: 'bold', after: 1.5 }); break;
        case 'p': if (k.before) y += k.before / 40; texto(k.x, k.small ? { size: 8.5, color: C.gris } : {}); break;
        case 'bul': {
          fuente(10.5, 'normal'); const lh = 10.5 * 0.3528 * 1.35;
          doc.splitTextToSize(pt(k.x), ancho - 6).forEach((l, i) => { salto(lh); if (i === 0) doc.text('•', M + 1.5, y + 3.7); doc.text(l, M + 6, y + 3.7); y += lh; });
          y += 1; break;
        }
        case 'kv': {
          fuente(10.5, 'bold'); const kw = doc.getTextWidth(pt(k.k) + ': ');
          fuente(10.5, 'normal'); const vl = doc.splitTextToSize(pt(k.v), ancho - kw); const lh = 10.5 * 0.3528 * 1.35;
          vl.forEach((l, i) => { salto(lh); if (i === 0) { fuente(10.5, 'bold'); doc.text(pt(k.k) + ': ', M, y + 3.7); fuente(10.5, 'normal'); } doc.text(l, M + kw, y + 3.7); y += lh; });
          y += 1; break;
        }
        case 'table': {
          const tot = k.widths.reduce((a, b) => a + b, 0), al = k.align || [];
          const cs = {}; k.widths.forEach((w, i) => { cs[i] = { cellWidth: w / tot * ancho, halign: al[i] || 'left' }; });
          salto(22); // evita dejar el encabezado de la tabla solo al final de la página
          AT(doc, {
            startY: y, head: [k.rows[0].map(pt)], body: k.rows.slice(1).map(r => r.map(pt)), theme: 'grid',
            margin: { left: M, right: M, top: M, bottom: 16 }, showHead: 'everyPage', rowPageBreak: 'avoid',
            styles: { font: 'helvetica', fontSize: (k.sz || 20) <= 18 ? 7.5 : 8.5, cellPadding: 1.5, lineColor: C.borde, lineWidth: 0.2, textColor: C.tinta, valign: 'top', overflow: 'linebreak' },
            headStyles: { fillColor: C.cab, textColor: C.tinta, fontStyle: 'bold' }, columnStyles: cs
          });
          y = doc.lastAutoTable.finalY + 4; break;
        }
      }
    }
    pies(doc, pie);
    return doc.output('blob');
  }

  async function registroPadresPdf(filas, encabezado) {
    await cargarPdf();
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const M = 10, ancho = doc.internal.pageSize.getWidth() - 2 * M;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0, 0, 0);
    doc.text(pt(encabezado.titulo), M, 14);
    if (encabezado.detalle) { const tw = doc.getTextWidth(pt(encabezado.titulo)); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(pt(encabezado.detalle), M + tw + 5, 14); }
    const grid = [825, 2145, 2340, 2010, 2115, 1815, 2190, 2685], tot = grid.reduce((a, b) => a + b, 0);
    const cs = {}; grid.forEach((g, i) => { cs[i] = { cellWidth: g / tot * ancho }; });
    const head = [['Fecha', 'Situación\n¿Qué pasó antes?', 'Conducta inadecuada\n¿Qué hizo mi hijo?', 'Función\n¿Para qué lo hizo?', '¿Qué sentí?\nEmociones y sensaciones físicas', '¿Qué pensé?\nImágenes, recuerdos, etc.', '¿Qué hice o dejé de hacer?', '¿Qué ocurrió después?\nReacciones del entorno o de mi hijo, cambios en sensaciones, etc.']];
    const vacias = encabezado.vacias != null ? encabezado.vacias : (filas.length ? 2 : 11);
    const body = filas.map(f => f.map(pt)).concat(Array.from({ length: vacias }, () => Array(8).fill('')));
    AT(doc, {
      startY: 18, head: head.map(r => r.map(pt)), body, theme: 'grid', showHead: 'everyPage', columnStyles: cs,
      margin: { left: M, right: M, top: 12, bottom: 12 },
      styles: { font: 'helvetica', fontSize: 7.8, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0], valign: 'top', overflow: 'linebreak' },
      headStyles: { fillColor: C.cab, textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8 },
      didParseCell: d => { if (d.section === 'body' && d.row.index >= filas.length) d.cell.styles.minCellHeight = 16; }
    });
    pies(doc, 'Formato registro padres');
    return doc.output('blob');
  }

  /* ---------- 5. Contenido: Cuestionario 6-PAQ ---------- */
  function bloquesPaq(d) {
    const bl = [
      { t: 'title', x: 'Cuestionario de Aceptación Parental (6-PAQ)' },
      { t: 'sub', x: 'Versión en español (Flujas-Contreras, García-Palacios y Gómez, 2020)', italic: true, muted: true, after: 200 }
    ];
    if (d.nino) bl.push({ t: 'kv', k: 'Niño(a)', v: d.nino });
    bl.push({ t: 'kv', k: 'Responde', v: d.quien || '—' }, { t: 'kv', k: 'Fecha', v: d.fecha });
    bl.push({ t: 'p', x: d.instrucciones });
    bl.push({ t: 'p', small: true, x: '1 = Muy en desacuerdo / nunca   ·   2 = En desacuerdo / poco frecuente   ·   3 = De acuerdo / con frecuencia   ·   4 = Muy de acuerdo / siempre' });
    const rows = [['#', 'Afirmación', '1', '2', '3', '4']];
    d.items.forEach((t, i) => { const v = d.respuestas[i]; rows.push([String(i + 1), t, v === 1 ? 'X' : '', v === 2 ? 'X' : '', v === 3 ? 'X' : '', v === 4 ? 'X' : '']); });
    bl.push({ t: 'table', rows, widths: [450, 6738, 600, 600, 600, 650], align: ['center', 'left', 'center', 'center', 'center', 'center'] });
    bl.push({ t: 'h1', x: 'Resultado' });
    bl.push({ t: 'kv', k: 'Puntaje total de inflexibilidad', v: `${d.total} (rango 16 a 64; más bajo = más flexibilidad psicológica)` });
    bl.push({ t: 'p', x: d.interpretacion });
    if (d.aConversar && d.aConversar.length) {
      bl.push({ t: 'h2', x: 'Afirmaciones para conversar con el equipo de psicología' });
      d.aConversar.forEach(x => bl.push({ t: 'bul', x }));
    }
    if (d.nota) bl.push({ t: 'h2', x: 'Observaciones' }, { t: 'p', x: d.nota });
    bl.push({ t: 'p', small: true, before: 240, x: 'Cálculo: los ítems 1, 4, 8, 13 y 16 están redactados en sentido de flexibilidad y se invierten (5 - respuesta); luego se suman los 16 ítems. Referencia orientativa: media de 29,1 (DE 5,7) en la muestra española de validación. El instrumento no tiene puntos de corte clínicos; no es un diagnóstico.' });
    return bl;
  }
  const paq = (d, formato = 'docx') => (formato === 'pdf' ? aPdf(bloquesPaq(d), { pie: 'Cuestionario 6-PAQ' }) : aDocx(bloquesPaq(d)));

  /* ---------- 6. Contenido: Informe de seguimiento ---------- */
  const conteo = (titulo, lista, total) => (!lista || !lista.length ? [] : [{
    t: 'table', widths: [7038, 1300, 1300], align: ['left', 'center', 'center'],
    rows: [[titulo, 'Veces', '%']].concat(lista.map(r => [r.t, String(r.n), total ? Math.round(r.n * 100 / total) + ' %' : '']))
  }]);
  function bloquesInforme(r) {
    const bl = [
      { t: 'title', x: 'Informe de seguimiento familiar' },
      { t: 'sub', x: `${r.nino ? r.nino + ' · ' : ''}Periodo: ${r.desdeTxt} a ${r.hastaTxt}` },
      { t: 'sub', x: `Elaborado el ${r.generadoTxt}${r.quien ? ' · Registros de: ' + r.quien : ''}`, muted: true, small: true, after: 200 }
    ];
    const add = (...xs) => xs.forEach(x => (Array.isArray(x) ? bl.push(...x) : bl.push(x)));
    const c = r.conductas;
    add({ t: 'h1', x: 'Conductas registradas' });
    if (!c.total) add({ t: 'p', x: 'Sin registros de conducta en el periodo.' });
    else {
      add({ t: 'bul', x: `${c.total} registros en ${c.dias} días con registro (${c.porDia} por día con registro, en promedio).` });
      if (c.intProm) add({ t: 'bul', x: `Intensidad promedio: ${c.intProm} de 5.` });
      if (c.duraciones.length) add({ t: 'bul', x: `Duración más frecuente: ${c.duraciones[0].t}.` });
      add({ t: 'h2', x: 'Tipo de conducta' }, conteo('Conducta', c.tipos, c.total));
      add({ t: 'h2', x: 'Función probable (¿para qué lo hizo?)' }, conteo('Función', c.funciones, c.total));
      add({ t: 'h2', x: 'Situaciones que la antecedieron' }, conteo('Antecedente', c.antecedentes, c.total));
      add({ t: 'h2', x: 'Momento del día y lugar' }, conteo('Momento', c.momentos, c.total), conteo('Lugar', c.lugares, c.total));
      if (c.acciones.length) {
        add({ t: 'h2', x: 'Lo que hicimos y lo que pasó después' }, {
          t: 'table', widths: [3638, 1000, 1800, 1600, 1600], align: ['left', 'center', 'center', 'center', 'center'],
          rows: [['Respuesta del adulto', 'Veces', 'Se calmó / volvió a la actividad', 'Aumentó o se repitió', 'Obtuvo lo que buscaba']].concat(c.acciones.map(a => [a.t, String(a.n), String(a.calma), String(a.aumento), String(a.refuerzo)]))
        }, { t: 'p', small: true, x: '"Obtuvo lo que buscaba" incluye "consiguió lo que quería" y "evitó la tarea": son respuestas que pueden mantener la conducta en el tiempo.' });
      }
      add({ t: 'h1', x: 'Vivencia de los padres' }, conteo('Emoción', c.emociones, c.total), conteo('Sensación física', c.sensaciones, c.total), conteo('Pensamiento', c.pensamientos, c.total));
    }
    const s = r.sueno;
    add({ t: 'h1', x: 'Sueño' });
    if (!s.noches) add({ t: 'p', x: 'Sin registros de sueño en el periodo.' });
    else {
      add({ t: 'bul', x: `${s.noches} noches registradas · promedio ${s.promHorasTxt} de sueño · ${s.promDesp} despertares por noche.` });
      if (s.obs.length) add({ t: 'bul', x: 'Observaciones nocturnas: ' + s.obs.map(o => `${o.t} (${o.n})`).join(', ') + '.' });
      add({ t: 'table', sz: 18, widths: [1150, 1000, 1000, 1000, 900, 1100, 3488], align: ['left', 'center', 'center', 'center', 'center', 'center', 'left'], rows: [['Fecha', 'Se acostó', 'Se durmió', 'Despertó', 'Horas', 'Despertares', 'Observaciones']].concat(s.filas) });
    }
    if (r.alim.dias) add({ t: 'h2', x: 'Alimentación' }, conteo('Cómo comió', r.alim.como, r.alim.dias), conteo('Observación', r.alim.obs, r.alim.dias));
    if (r.animoProm) add({ t: 'kv', k: 'Regulación / ánimo general promedio', v: r.animoProm + ' de 5' });
    add({ t: 'h1', x: 'Terapias' });
    if (r.orden && (r.orden.prestador || r.orden.inicio)) add({ t: 'p', x: `${r.orden.prestador ? 'Prestador: ' + r.orden.prestador + '. ' : ''}${r.orden.inicio ? 'Orden vigente del ' + r.orden.inicioTxt + ' al ' + (r.orden.finTxt || '—') + '.' : ''}` });
    if (r.terapias.some(t => t.asistTotal || t.faltasPeriodo || t.ordenadas)) {
      add({ t: 'table', widths: [3238, 1400, 1700, 1600, 1700], align: ['left', 'center', 'center', 'center', 'center'], rows: [['Terapia', 'Ordenadas', 'Asistidas en el periodo', 'Faltas en el periodo', 'Asistidas acumuladas']].concat(r.terapias.map(t => [t.nombre, t.ordenadas || '—', String(t.asistPeriodo), String(t.faltasPeriodo), String(t.asistTotal)])) });
    } else add({ t: 'p', x: 'Sin sesiones registradas.' });
    if (r.tareas.length) { add({ t: 'h2', x: 'Tareas para la casa recibidas' }); r.tareas.forEach(t => add({ t: 'bul', x: `${t.fecha} · ${t.terapia}: ${t.tarea}` })); }
    if (r.objetivos.length) add({ t: 'h1', x: 'Objetivos y habilidades' }, { t: 'table', widths: [3638, 1700, 2150, 2150], rows: [['Objetivo', 'Área', 'Primer registro', 'Último registro']].concat(r.objetivos.map(o => [o.nombre, o.area, o.inicial, o.actual])) });
    if (r.paq.length) add({ t: 'h1', x: 'Cuestionario 6-PAQ (flexibilidad parental)' }, { t: 'table', widths: [2500, 3638, 3500], align: ['left', 'left', 'center'], rows: [['Fecha', 'Responde', 'Puntaje total (16–64)']].concat(r.paq.map(p => [p.fecha, p.quien, String(p.total)])) }, { t: 'p', small: true, x: 'Más bajo = más flexibilidad psicológica. Referencia orientativa: media 29,1 (DE 5,7) en la validación española.' });
    if (r.logros.length) { add({ t: 'h1', x: 'Logros y momentos positivos' }); r.logros.forEach(l => add({ t: 'bul', x: `${l.fecha}: ${l.texto}` })); }
    if (r.citas.length) { add({ t: 'h1', x: 'Próximas citas y pendientes' }); r.citas.forEach(ci => add({ t: 'bul', x: `${ci.fecha}${ci.hora ? ' ' + ci.hora : ''} · ${ci.tipo || 'Pendiente'}: ${ci.desc}` })); }
    add({ t: 'p', small: true, before: 300, x: 'Información registrada por los cuidadores en la aplicación de seguimiento familiar. No reemplaza la valoración del equipo tratante.' });
    return bl;
  }
  const informe = (r, formato = 'docx') => (formato === 'pdf' ? aPdf(bloquesInforme(r), { pie: 'Informe de seguimiento familiar' + (r.nino ? ' · ' + r.nino : '') }) : aDocx(bloquesInforme(r)));

  /* ---------- 7. Compartir / descargar ---------- */
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

  return { registroPadres, registroPadresPdf, paq, informe, compartir, descargar, cargarPdf, MIME };
})();
