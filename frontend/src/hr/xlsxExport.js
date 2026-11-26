export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const enc = new TextEncoder();
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const zip = (files) => {
  const chunks = [];
  const central = [];
  let offset = 0;
  const d = new Date();
  const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  files.forEach((f) => {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true); local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true); local.setUint32(18, size, true); local.setUint32(22, size, true);
    local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, f.data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true); cen.setUint16(12, dosTime, true); cen.setUint16(14, dosDate, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, size, true); cen.setUint32(24, size, true);
    cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + size;
  });
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: XLSX_MIME });
};
const esc = (v) => String(v ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (i) => { // 0 -> A
  let n = i + 1; let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};
const argb = (hex) => `FF${String(hex || '000000').replace('#', '').toUpperCase()}`;
// Excel stores dates as days since 1899-12-30 (local time)
const serial = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000 + 25569;
};
const FMT = { date: 'dd mmm yyyy', datetime: 'dd mmm yyyy, hh:mm AM/PM' };
// ---------------------------------------------------------------- styles registry
const makeStyles = () => {
  const fonts = ['<font><sz val="11"/><color rgb="FF222222"/><name val="Calibri"/><family val="2"/></font>'];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = [
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    '<border>' + ['left', 'right', 'top', 'bottom'].map((s) => `<${s} style="thin"><color rgb="FFD5DAD7"/></${s}>`).join('') + '<diagonal/></border>',
  ];
  const numFmts = [];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  const cache = new Map();
  const idx = (list, xml) => { const i = list.indexOf(xml); if (i >= 0) return i; list.push(xml); return list.length - 1; };
  const style = (o = {}) => {
    const key = JSON.stringify(o);
    if (cache.has(key)) return cache.get(key);
    const font = idx(fonts, `<font>${o.bold ? '<b/>' : ''}${o.underline ? '<u/>' : ''}<sz val="${o.size || 11}"/><color rgb="${argb(o.color || '222222')}"/><name val="Calibri"/><family val="2"/></font>`);
    const fill = o.fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(o.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const border = o.border === false ? 0 : 1;
    let numFmtId = 0;
    if (o.fmt) {
      let i = numFmts.indexOf(o.fmt);
      if (i < 0) { numFmts.push(o.fmt); i = numFmts.length - 1; }
      numFmtId = 164 + i;
    }
    const align = `<alignment horizontal="${o.align || 'left'}" vertical="${o.valign || 'center'}"${o.wrap ? ' wrapText="1"' : ''}/>`;
    const xf = `<xf numFmtId="${numFmtId}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"${numFmtId ? ' applyNumberFormat="1"' : ''}>${align}</xf>`;
    xfs.push(xf);
    cache.set(key, xfs.length - 1);
    return xfs.length - 1;
  };
  const xml = () =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + (numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join('')}</numFmts>` : '')
    + `<fonts count="${fonts.length}">${fonts.join('')}</fonts>`
    + `<fills count="${fills.length}">${fills.join('')}</fills>`
    + `<borders count="${borders.length}">${borders.join('')}</borders>`
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';
  return { style, xml };
};
// ---------------------------------------------------------------- build
// options: { sheetName, title, subtitle, headerColor, columns: [{ header, width }], rows: Cell[][] }
export const buildXlsx = ({ sheetName = 'Sheet1', title = '', subtitle = '', headerColor = '1F5C3F', columns, rows }) => {
  const { style, xml: stylesXml } = makeStyles();
  const lastCol = colName(columns.length - 1);
  const HEAD_ROW = 4;
  const sheetRows = [];
  const textCell = (ref, s, v) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  // title + subtitle
  const titleStyle = style({ bold: true, size: 16, color: headerColor, border: false });
  const subStyle = style({ size: 10, color: '6B7280', border: false });
  sheetRows.push(`<row r="1" ht="26" customHeight="1">${textCell('A1', titleStyle, title)}</row>`);
  sheetRows.push(`<row r="2" ht="16" customHeight="1">${textCell('A2', subStyle, subtitle)}</row>`);
  // header
  const headStyle = style({ bold: true, color: 'FFFFFF', fill: headerColor, align: 'center', wrap: true });
  sheetRows.push(`<row r="${HEAD_ROW}" ht="30" customHeight="1">${columns.map((c, i) => textCell(`${colName(i)}${HEAD_ROW}`, headStyle, c.header)).join('')}</row>`);
  // data
  rows.forEach((row, ri) => {
    const r = HEAD_ROW + 1 + ri;
    const zebra = ri % 2 === 1 ? 'F5F8F6' : null;
    const cells = columns.map((col, ci) => {
      const raw = row[ci];
      const o = raw !== null && typeof raw === 'object' && !(raw instanceof Date) ? raw : { v: raw };
      const type = o.type || (typeof o.v === 'number' ? 'num' : 'text');
      const ref = `${colName(ci)}${r}`;
      const base = { fill: o.fill || zebra, color: o.color, bold: o.bold, wrap: o.wrap, align: o.align || col.align };
      if (o.v === '' || o.v === null || o.v === undefined) return `<c r="${ref}" s="${style(base)}"/>`;
      if (type === 'num') return `<c r="${ref}" s="${style({ ...base, fmt: o.fmt })}"><v>${Number(o.v)}</v></c>`;
      if (type === 'date' || type === 'datetime') {
        const n = serial(o.v);
        if (n === null) return `<c r="${ref}" s="${style(base)}"/>`;
        return `<c r="${ref}" s="${style({ ...base, fmt: FMT[type], align: o.align || col.align || 'center' })}"><v>${n}</v></c>`;
      }
      if (type === 'link' && o.url && String(o.url).length < 250) {
        const s = style({ ...base, color: '1D4ED8', underline: true });
        return `<c r="${ref}" s="${s}" t="str"><f>HYPERLINK("${esc(o.url)}","${esc(o.v)}")</f><v>${esc(o.v)}</v></c>`;
      }
      return textCell(ref, style(base), o.v);
    });
    sheetRows.push(`<row r="${r}">${cells.join('')}</row>`);
  });
  const lastRow = HEAD_ROW + Math.max(rows.length, 1);
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'
    + `<dimension ref="A1:${lastCol}${lastRow}"/>`
    + `<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="${HEAD_ROW}" topLeftCell="A${HEAD_ROW + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>`
    + '<sheetFormatPr defaultRowHeight="20"/>'
    + `<cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 16}" customWidth="1"/>`).join('')}</cols>`
    + `<sheetData>${sheetRows.join('')}</sheetData>`
    + `<autoFilter ref="A${HEAD_ROW}:${lastCol}${lastRow}"/>`
    + `<mergeCells count="2"><mergeCell ref="A1:${lastCol}1"/><mergeCell ref="A2:${lastCol}2"/></mergeCells>`
    + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'
    + '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
    + '</worksheet>';
  const safeSheet = String(sheetName).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1';
  const files = [
    { name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(safeSheet)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${esc(safeSheet)}'!$A$${HEAD_ROW}:$${lastCol}$${lastRow}</definedName></definedNames></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', text: stylesXml() },
    { name: 'xl/worksheets/sheet1.xml', text: sheet },
  ].map((f) => ({ name: f.name, data: enc.encode(f.text) }));
  return zip(files);
};
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
