// Dependency-free text readers for Word (.docx) and PDF. They use only Node's built-in zlib,
// so resume fetching keeps working even when the optional npm packages are missing.
import zlib from 'zlib';

// ---------------- DOCX (a .docx is a zip file of XML) ----------------
const readZipEntries = (buf) => {
  // find the End Of Central Directory record
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a valid Word file.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries[name] = { method, compSize, localOffset };
    p += 46 + nameLen + extraLen + commentLen;
  }
  const read = (name) => {
    const e = entries[name];
    if (!e) return null;
    const lo = e.localOffset;
    const start = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
    const data = buf.subarray(start, start + e.compSize);
    return e.method === 0 ? data : zlib.inflateRawSync(data);
  };
  return { names: Object.keys(entries), read };
};

const decodeXml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

const xmlToText = (xml) =>
  decodeXml(
    xml
      .replace(/<w:tab\/>/g, ' ')
      .replace(/<w:(?:br|cr)[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tc>/g, ' | ')
      .replace(/<\/w:tr>/g, '\n')
      .replace(/<[^>]+>/g, '')
  );

export const docxText = (buf) => {
  const zip = readZipEntries(buf);
  const parts = ['word/document.xml', ...zip.names.filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n))];
  const out = [];
  // headers first: that's where many resumes put the name and contact details
  parts.sort((a, b) => (/header/.test(b) ? 1 : 0) - (/header/.test(a) ? 1 : 0));
  parts.forEach((n) => {
    const data = zip.read(n);
    if (data) out.push(xmlToText(data.toString('utf8')));
  });
  return out.join('\n');
};

// ---------------- PDF (basic: text-based PDFs with standard fonts) ----------------
const ascii85 = (str) => {
  const s = str.replace(/\s+/g, '').replace(/^<~/, '').replace(/~>.*$/s, '');
  const out = [];
  let group = [];
  const flush = (g, n) => {
    const pad = g.concat(Array(5 - g.length).fill(84));
    let v = 0;
    pad.forEach((c) => { v = v * 85 + c; });
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...bytes.slice(0, n));
  };
  for (const ch of s) {
    if (ch === 'z' && group.length === 0) { out.push(0, 0, 0, 0); continue; }
    group.push(ch.charCodeAt(0) - 33);
    if (group.length === 5) { flush(group, 4); group = []; }
  }
  if (group.length > 1) flush(group, group.length - 1);
  return Buffer.from(out);
};

const unescapePdfString = (s) =>
  s.replace(/\\([nrtbf()\\]|[0-7]{1,3}|\r?\n)/g, (_, c) => {
    if (c === 'n') return '\n';
    if (c === 'r') return '\r';
    if (c === 't') return '\t';
    if (c === 'b' || c === 'f') return '';
    if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8));
    if (c === '\n' || c === '\r\n' || c === '\r') return '';
    return c;
  });

const hexToText = (h) => {
  const clean = h.replace(/\s+/g, '');
  const bytes = Buffer.from(clean.length % 2 ? `${clean}0` : clean, 'hex');
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return bytes.subarray(2).swap16().toString('utf16le');
  return bytes.toString('latin1');
};

const textFromContent = (content) => {
  let out = '';
  const re = /\((?:\\.|[^\\()])*\)\s*(?:Tj|'|")|\[(?:[^\]]*)\]\s*TJ|<([0-9a-fA-F\s]+)>\s*Tj|(?:\bT[dD*m]\b|\bT\*)|\bET\b/g;
  let m;
  while ((m = re.exec(content))) {
    const tok = m[0];
    if (/^(?:T[dDm*]|T\*|ET)$/.test(tok)) { out += '\n'; continue; }
    if (tok.startsWith('[')) {
      const parts = tok.match(/\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]+>|-?\d+(?:\.\d+)?/g) || [];
      parts.forEach((p) => {
        if (p[0] === '(') out += unescapePdfString(p.slice(1, -1));
        else if (p[0] === '<') out += hexToText(p.slice(1, -1));
        else if (Number(p) < -200) out += ' '; // big negative kerning = a word gap
      });
    } else if (m[1]) out += hexToText(m[1]);
    else out += unescapePdfString(tok.replace(/\)\s*(?:Tj|'|")$/, '').slice(1));
    if (/['"]$/.test(tok)) out += '\n';
  }
  return out;
};

export const pdfText = (buf) => {
  const raw = buf.toString('latin1');
  const chunks = [];
  const re = /<<((?:(?!>>\s*stream)[\s\S])*?)>>\s*stream\r?\n/g;
  let m;
  while ((m = re.exec(raw))) {
    const dict = m[1];
    const start = re.lastIndex;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    let data = Buffer.from(raw.slice(start, end), 'latin1');
    try {
      if (/ASCII85Decode/.test(dict)) data = ascii85(data.toString('latin1'));
      if (/FlateDecode/.test(dict)) data = zlib.inflateSync(data);
      else if (/LZWDecode|DCTDecode|JPXDecode|CCITTFax/.test(dict)) continue;
    } catch { continue; }
    const content = data.toString('latin1');
    if (/\bBT\b/.test(content)) chunks.push(textFromContent(content));
    re.lastIndex = end;
  }
  return chunks.join('\n');
};
